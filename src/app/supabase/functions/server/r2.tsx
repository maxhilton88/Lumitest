/**
 * Cloudflare R2 helper — lightweight native fetch with AWS Signature V4
 * Zero external dependencies — instant cold start (no @aws-sdk)
 *
 * Env vars required:
 *   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_URL
 */

const enc = new TextEncoder();

function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}

async function hmac(key: ArrayBuffer, msg: string): Promise<ArrayBuffer> {
  const k = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return crypto.subtle.sign("HMAC", k, enc.encode(msg));
}

async function sha256(data: Uint8Array): Promise<string> {
  return toHex(await crypto.subtle.digest("SHA-256", data));
}

async function deriveSigningKey(secret: string, dateStamp: string, region: string, service: string): Promise<ArrayBuffer> {
  let k = await hmac(enc.encode(`AWS4${secret}`), dateStamp);
  k = await hmac(k, region);
  k = await hmac(k, service);
  k = await hmac(k, "aws4_request");
  return k;
}

// ── Env helpers ──────────────────────────────────────────
function env(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function getPublicUrl(): string {
  return env("R2_PUBLIC_URL").replace(/\/+$/, "");
}

// ── Core: sign and execute an S3-compatible request ──────
async function s3Fetch(
  method: string,
  key: string,
  body?: Uint8Array,
  contentType?: string,
): Promise<Response> {
  const accountId = env("R2_ACCOUNT_ID");
  const accessKeyId = env("R2_ACCESS_KEY_ID");
  const secretAccessKey = env("R2_SECRET_ACCESS_KEY");
  const bucket = env("R2_BUCKET_NAME");

  const host = `${accountId}.r2.cloudflarestorage.com`;
  const path = `/${bucket}/${key}`;
  const region = "auto";
  const service = "s3";

  const now = new Date();
  const amzDate = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const dateStamp = amzDate.slice(0, 8);

  // Payload hash
  const payloadHash = await sha256(body ?? new Uint8Array(0));

  // Headers to sign (must be sorted by key)
  const headers: Record<string, string> = {
    host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
  };
  if (contentType) headers["content-type"] = contentType;
  if (body) headers["content-length"] = String(body.length);

  const signedHeaderKeys = Object.keys(headers).sort();
  const canonicalHeaders = signedHeaderKeys.map(k => `${k}:${headers[k]}\n`).join("");
  const signedHeaders = signedHeaderKeys.join(";");

  // Canonical request
  const canonicalRequest = [
    method,
    path,
    "",                  // no query string
    canonicalHeaders,    // already ends with \n
    signedHeaders,
    payloadHash,
  ].join("\n");

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;

  // String to sign
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    await sha256(enc.encode(canonicalRequest)),
  ].join("\n");

  // Signature
  const sk = await deriveSigningKey(secretAccessKey, dateStamp, region, service);
  const signature = toHex(await hmac(sk, stringToSign));

  const authorization =
    `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const url = `https://${host}${path}`;
  console.log(`[R2] ${method} ${url} (${body ? body.length : 0} bytes)`);

  const resp = await fetch(url, {
    method,
    headers: { ...headers, authorization },
    body: body ?? undefined,
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => "(no body)");
    console.error(`[R2] ${method} failed (${resp.status}):`, errText);
    throw new Error(`R2 ${method} failed (${resp.status}): ${errText.slice(0, 300)}`);
  }

  return resp;
}

// ── Upload ──────────────────────────────────────────────
export async function uploadToR2(
  key: string,
  body: Uint8Array,
  contentType: string,
): Promise<{ key: string; publicUrl: string }> {
  await s3Fetch("PUT", key, body, contentType);
  const publicUrl = `${getPublicUrl()}/${key}`;
  console.log(`[R2] Uploaded: ${key} (${contentType}, ${body.length} bytes) -> ${publicUrl}`);
  return { key, publicUrl };
}

// ── Delete ──────────────────────────────────────────────
export async function deleteFromR2(key: string): Promise<void> {
  await s3Fetch("DELETE", key);
  console.log(`[R2] Deleted: ${key}`);
}

// ── Delete multiple ─────────────────────────────────────
export async function deleteMultipleFromR2(keys: string[]): Promise<void> {
  for (const key of keys) {
    try {
      await deleteFromR2(key);
    } catch (err) {
      console.error(`[R2] Failed to delete ${key}:`, err);
    }
  }
}

// ── Resolve R2 key -> public URL ─────────────────────────
export function r2PublicUrl(key: string): string {
  return `${getPublicUrl()}/${key}`;
}

// ── Key prefix constants ────────────────────────────────
// Stored in KV as "r2:audio/uuid.mp3" or "r2:art/uuid.jpg"
export const R2_AUDIO_PREFIX = "r2:audio/";
export const R2_ART_PREFIX = "r2:art/";
export const R2_QUEST_IMAGE_PREFIX = "r2:quest-images/";

// Check whether a stored path is an R2 key
export function isR2Key(path: string): boolean {
  return path.startsWith("r2:");
}

// Convert a full R2 public URL back to a "r2:" storage key for KV persistence
// e.g. "https://pub-xxx.r2.dev/art/uuid.jpg" → "r2:art/uuid.jpg"
// Returns the original value if it's not an R2 public URL
export function unresolveR2Url(url: string): string {
  try {
    const base = getPublicUrl(); // e.g. "https://pub-xxx.r2.dev"
    if (url.startsWith(base + "/")) {
      return "r2:" + url.slice(base.length + 1);
    }
  } catch {}
  return url;
}

// Extract the actual R2 object key from the stored KV value
// "r2:audio/uuid.mp3" -> "audio/uuid.mp3"
export function extractR2Key(storedPath: string): string {
  return storedPath.replace(/^r2:/, "");
}