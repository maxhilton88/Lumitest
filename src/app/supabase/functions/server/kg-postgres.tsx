/**
 * kg-postgres.tsx — Kindergarten Postgres Routes
 *
 * These routes operate on the `kindergartens`, `kg_requests`, and
 * `kg_parent_connections` Postgres tables (NOT KV).
 *
 * Endpoints:
 *   POST /csv-upload        — Bulk CSV import (super-admin only)
 *   GET  /list              — List/search kindergartens (admin)
 *   GET  /search            — Public search by name/postcode (parents)
 *   POST /claim             — Claim a KG by claim code
 *   GET  /stats             — Summary counts (admin)
 *   POST /requests          — Submit "KG not found" form (parent)
 *   GET  /requests          — List requests (admin)
 *   PUT  /requests/:id      — Update request status (admin)
 *   PUT  /:id/trial         — Set trial duration (admin)
 *   POST /bulk-trial        — Bulk set trial (admin)
 *   PUT  /:id               — Update KG record (admin)
 *   POST /create            — Create a single KG (admin)
 *   POST /claim-signup      — Claim signup (public)
 *   GET  /pending-claims    — List pending claims (admin)
 *   PUT  /claim-approve     — Approve a claim (admin)
 *   PUT  /claim-reject      — Reject a claim (admin)
 *   GET  /validate-claim-code — Validate a claim code (public)
 *   POST /new-kg-signup     — New KG registration (public, no claim code)
 *   DELETE /:id             — Delete a KG record (admin)
 */

import { Hono } from "npm:hono";
import { createClient } from "npm:@supabase/supabase-js@2";
import { verifyToken } from "./auth.tsx";
import { supabaseAdmin } from "./auth.tsx";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function getAdminClient() {
  return createClient(supabaseUrl, supabaseServiceKey);
}

export const kgPostgresRoutes = new Hono();

// ─── HELPERS ──────────────────────────────────────────────────

/**
 * Sync trial data from Postgres KG → KV school records.
 * When a Postgres KG has `claimed_by` (a Supabase auth user ID),
 * update that user's KV school records with trial info + linked PG KG ID.
 */
async function syncTrialToKV(
  userId: string,
  pgKgId: string,
  trialExpiresAt: string,
  subscriptionTier: string,
  pgKgName?: string,
): Promise<{ synced: boolean; error?: string }> {
  try {
    // Update the school_accounts record for this user
    const { data: school } = await supabaseAdmin
      .from('school_accounts')
      .select('id')
      .eq('user_id', userId)
      .limit(1)
      .single();

    if (!school) {
      console.log(`[KG-BRIDGE] No school_accounts record found for user ${userId} — skip sync`);
      return { synced: false, error: 'No school_accounts record for user' };
    }

    const { error: updateError } = await supabaseAdmin
      .from('school_accounts')
      .update({
        trial_expires_at: trialExpiresAt,
        subscription_tier: subscriptionTier,
        linked_pg_kg_id: pgKgId,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    if (updateError) {
      console.error(`[KG-BRIDGE] Failed to sync trial for user ${userId}:`, updateError.message);
      return { synced: false, error: updateError.message };
    }

    console.log(`[KG-BRIDGE] Synced trial to school_accounts for user ${userId} (PG KG: ${pgKgId}, tier: ${subscriptionTier}, expires: ${trialExpiresAt})`);
    return { synced: true };
  } catch (err: any) {
    console.error(`[KG-BRIDGE] Failed to sync trial for user ${userId}:`, err);
    return { synced: false, error: err.message };
  }
}

/** Exported for use by login/session endpoints in index.tsx */
export { syncTrialToKV };

/** Generate a random 8-char alphanumeric claim code */
function generateClaimCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous 0/O/1/I
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/** Auto-detect delimiter: if first line has more tabs than commas, use tab */
function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/)[0] || "";
  const tabs = (firstLine.match(/\t/g) || []).length;
  const commas = (firstLine.match(/,/g) || []).length;
  return tabs > commas ? "\t" : ",";
}

/** Strip trailing empty fields from a row (handles extra tabs/commas at end) */
function trimTrailingEmpty(row: string[]): string[] {
  let end = row.length;
  while (end > 0 && row[end - 1] === "") end--;
  return row.slice(0, end);
}

/** CSV/TSV parser — auto-detects delimiter, handles quoted fields, newlines in quotes */
function parseCSV(text: string): string[][] {
  const delimiter = detectDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i++; // skip escaped quote
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === delimiter) {
        row.push(field.trim());
        field = "";
      } else if (ch === "\n" || (ch === "\r" && next === "\n")) {
        row.push(field.trim());
        const trimmed = trimTrailingEmpty(row);
        if (trimmed.some(f => f !== "")) rows.push(trimmed);
        row = [];
        field = "";
        if (ch === "\r") i++; // skip \n after \r
      } else {
        field += ch;
      }
    }
  }
  // Last field/row
  row.push(field.trim());
  const trimmed = trimTrailingEmpty(row);
  if (trimmed.some(f => f !== "")) rows.push(trimmed);

  return rows;
}

// ─── CSV UPLOAD (Super Admin) ─────────────────────────────────

kgPostgresRoutes.post("/csv-upload", async (c) => {
  try {
    const userTokenHeader = c.req.header("X-User-Token");
    const { error: authError, user } = await verifyToken(userTokenHeader);
    if (authError || !user) {
      return c.json({ error: `Unauthorized for KG CSV upload: ${authError || "No user"}` }, 401);
    }

    const body = await c.req.json();
    const { csvText, columnMapping } = body;

    if (!csvText || typeof csvText !== "string") {
      return c.json({ error: "Missing csvText field" }, 400);
    }

    console.log(`[KG-PG] CSV upload by ${user.email}, text length: ${csvText.length}`);

    const rows = parseCSV(csvText);
    if (rows.length < 2) {
      return c.json({ error: "CSV must have at least a header row and one data row" }, 400);
    }

    const headers = rows[0].map(h => h.toLowerCase().replace(/[^a-z0-9_]/g, "_"));
    const dataRows = rows.slice(1);

    // Column mapping — maps CSV column names to our DB columns
    // User can provide explicit mapping, or we auto-detect common names
    const defaultMapping: Record<string, string[]> = {
      name: ["name", "school_name", "kindergarten_name", "kg_name", "nama", "nama_tadika", "tadika"],
      address: ["address", "alamat", "full_address", "street"],
      postcode: ["postcode", "zip", "zipcode", "postal_code", "poskod"],
      state: ["state", "negeri", "region"],
      city: ["city", "bandar", "town", "district", "daerah"],
      phone: ["phone", "telefon", "tel", "contact", "phone_number", "no_tel", "no_telefon"],
      email: ["email", "emel", "e_mail"],
      principal_name: ["principal", "principal_name", "pengetua", "nama_pengetua", "contact_person"],
      latitude: ["latitude", "lat", "y", "coord_lat"],
      longitude: ["longitude", "lng", "lon", "long", "x", "coord_lng", "coord_lon"],
    };

    const mapping: Record<string, number> = {};
    const userMapping = columnMapping || {};

    for (const [dbCol, aliases] of Object.entries(defaultMapping)) {
      // Check user-provided mapping first
      if (userMapping[dbCol] !== undefined) {
        const idx = headers.indexOf(userMapping[dbCol].toLowerCase().replace(/[^a-z0-9_]/g, "_"));
        if (idx >= 0) { mapping[dbCol] = idx; continue; }
      }
      // Auto-detect
      for (const alias of aliases) {
        const idx = headers.indexOf(alias);
        if (idx >= 0) { mapping[dbCol] = idx; break; }
      }
    }

    if (mapping.name === undefined) {
      return c.json({
        error: "Could not find a 'name' column in CSV. Expected one of: name, school_name, kindergarten_name, kg_name, nama, nama_tadika, tadika",
        detected_headers: headers,
      }, 400);
    }

    console.log(`[KG-PG] Column mapping: ${JSON.stringify(mapping)}, headers: ${JSON.stringify(headers)}`);

    const db = getAdminClient();
    const results = { inserted: 0, skipped: 0, errors: [] as string[] };

    // Process in batches of 100
    const BATCH_SIZE = 100;
    for (let batchStart = 0; batchStart < dataRows.length; batchStart += BATCH_SIZE) {
      const batch = dataRows.slice(batchStart, batchStart + BATCH_SIZE);
      const insertRows = [];

      for (let i = 0; i < batch.length; i++) {
        const row = batch[i];
        const rowNum = batchStart + i + 2; // +2 for header + 1-indexed
        const name = row[mapping.name] || "";

        if (!name) {
          results.skipped++;
          continue;
        }

        // Generate unique claim code
        const claimCode = generateClaimCode();

        insertRows.push({
          name,
          address: mapping.address !== undefined ? (row[mapping.address] || null) : null,
          postcode: mapping.postcode !== undefined ? (row[mapping.postcode] || null) : null,
          state: mapping.state !== undefined ? (row[mapping.state] || null) : null,
          city: mapping.city !== undefined ? (row[mapping.city] || null) : null,
          phone: mapping.phone !== undefined ? (row[mapping.phone] || null) : null,
          email: mapping.email !== undefined ? (row[mapping.email] || null) : null,
          principal_name: mapping.principal_name !== undefined ? (row[mapping.principal_name] || null) : null,
          claim_code: claimCode,
          status: "unclaimed",
          plan_tier: "free",
          lat: mapping.latitude !== undefined ? (parseFloat(row[mapping.latitude]) || null) : null,
          lng: mapping.longitude !== undefined ? (parseFloat(row[mapping.longitude]) || null) : null,
        });
      }

      if (insertRows.length > 0) {
        const { data, error } = await db.from("kindergartens").insert(insertRows).select("id");
        if (error) {
          console.error(`[KG-PG] Batch insert error at row ${batchStart + 2}:`, error);
          // Fall back to row-by-row inserts so one bad row doesn't kill the whole batch
          console.log(`[KG-PG] Falling back to row-by-row insert for batch starting at row ${batchStart + 2}...`);
          for (let r = 0; r < insertRows.length; r++) {
            const rowNum = batchStart + r + 2;
            const { data: singleData, error: singleError } = await db
              .from("kindergartens")
              .insert(insertRows[r])
              .select("id");
            if (singleError) {
              // Only keep first 20 error messages to avoid massive responses
              if (results.errors.length < 20) {
                results.errors.push(`Row ${rowNum} ("${insertRows[r].name?.slice(0, 40)}"): ${singleError.message}`);
              } else if (results.errors.length === 20) {
                results.errors.push(`... and more errors (capped at 20 shown)`);
              }
            } else {
              results.inserted += (singleData?.length || 0);
            }
          }
        } else {
          results.inserted += (data?.length || 0);
        }
      }
    }

    console.log(`[KG-PG] CSV import done: ${results.inserted} inserted, ${results.skipped} skipped, ${results.errors.length} errors`);

    return c.json({
      success: true,
      total_rows: dataRows.length,
      inserted: results.inserted,
      skipped: results.skipped,
      errors: results.errors,
      detected_headers: headers,
      column_mapping: mapping,
    });
  } catch (error: any) {
    console.error("[KG-PG] CSV upload error:", error);
    return c.json({ error: `CSV upload failed: ${error.message}` }, 500);
  }
});

// ─── LIST KINDERGARTENS (Admin) ───────────────────────────────

kgPostgresRoutes.get("/list", async (c) => {
  try {
    const userTokenHeader = c.req.header("X-User-Token");
    const { error: authError, user } = await verifyToken(userTokenHeader);
    if (authError || !user) {
      return c.json({ error: `Unauthorized: ${authError || "No user"}` }, 401);
    }

    const search = c.req.query("search") || "";
    const status = c.req.query("status") || "";
    const state = c.req.query("state") || "";
    const page = parseInt(c.req.query("page") || "1");
    const limit = Math.min(parseInt(c.req.query("limit") || "50"), 200);
    const offset = (page - 1) * limit;

    const db = getAdminClient();
    let query = db.from("kindergartens").select("*", { count: "exact" });

    if (search) {
      query = query.or(`name.ilike.%${search}%,postcode.ilike.%${search}%,city.ilike.%${search}%,email.ilike.%${search}%`);
    }
    if (status) {
      query = query.eq("status", status);
    }
    if (state) {
      query = query.eq("state", state);
    }

    query = query.order("created_at", { ascending: false }).range(offset, offset + limit - 1);

    const { data, error, count } = await query;
    if (error) {
      console.error("[KG-PG] List error:", error);
      return c.json({ error: `Failed to list kindergartens: ${error.message}` }, 500);
    }

    return c.json({
      success: true,
      kindergartens: data || [],
      total: count || 0,
      page,
      limit,
      total_pages: Math.ceil((count || 0) / limit),
    });
  } catch (error: any) {
    console.error("[KG-PG] List error:", error);
    return c.json({ error: `Failed to list kindergartens: ${error.message}` }, 500);
  }
});

// ─── SEARCH KINDERGARTENS (Public — for parents) ──────────────

kgPostgresRoutes.get("/search", async (c) => {
  try {
    const q = c.req.query("q") || "";
    const postcode = c.req.query("postcode") || "";

    if (!q && !postcode) {
      return c.json({ error: "Provide 'q' (name) or 'postcode' parameter" }, 400);
    }

    const db = getAdminClient();
    let query = db.from("kindergartens")
      .select("id, name, address, postcode, state, city, status")
      .limit(20);

    if (postcode) {
      query = query.eq("postcode", postcode);
    }
    if (q) {
      query = query.ilike("name", `%${q}%`);
    }

    query = query.order("name", { ascending: true });

    const { data, error } = await query;
    if (error) {
      console.error("[KG-PG] Search error:", error);
      return c.json({ error: `Search failed: ${error.message}` }, 500);
    }

    return c.json({
      success: true,
      results: (data || []).map(kg => ({
        id: kg.id,
        name: kg.name,
        address: kg.address,
        postcode: kg.postcode,
        state: kg.state,
        city: kg.city,
        status: kg.status,
      })),
    });
  } catch (error: any) {
    console.error("[KG-PG] Search error:", error);
    return c.json({ error: `Search failed: ${error.message}` }, 500);
  }
});

// ─── CLAIM KINDERGARTEN ───────────────────────────────────────

// ─── MAP DATA (Public — lightweight KG data for territory map) ──

kgPostgresRoutes.get("/map-data", async (c) => {
  try {
    const db = getAdminClient();

    // Fetch all KGs with coordinates — minimal fields for map rendering
    // Use a try/catch to gracefully handle missing latitude/longitude columns
    const { data, error } = await db.from("kindergartens")
      .select("id, name, lat, lng, status, plan_tier, state, city, postcode, claimed_by, claim_code")
      .not("lat", "is", null)
      .not("lng", "is", null)
      .order("name", { ascending: true });

    if (error) {
      // If the columns don't exist yet, return empty nodes with a helpful message
      if (error.message?.includes("does not exist")) {
        console.log("[KG-PG] Map data: lat/lng columns not found in kindergartens table");
        return c.json({
          success: true,
          nodes: [],
          total: 0,
          notice: "lat and lng columns have not been added to the kindergartens table yet.",
        });
      }
      console.error("[KG-PG] Map data error:", error);
      return c.json({ error: `Failed to load map data: ${error.message}` }, 500);
    }

    // Determine territory status for each KG
    const mapNodes = (data || []).map((kg: any) => ({
      id: kg.id,
      name: kg.name,
      lat: kg.lat,
      lng: kg.lng,
      state: kg.state,
      city: kg.city,
      postcode: kg.postcode,
      claim_code: kg.status === 'unclaimed' ? kg.claim_code : null,
      status: kg.status, // unclaimed | claimed | active
      plan_tier: kg.plan_tier, // free | trial | active | founder
      has_owner: !!kg.claimed_by,
      // Territory status derived from plan_tier + status
      territory: kg.plan_tier === 'active' || kg.plan_tier === 'founder'
        ? 'locked'
        : kg.status === 'claimed'
          ? 'claimed'
          : 'unclaimed',
    }));

    console.log(`[KG-PG] Map data: ${mapNodes.length} KGs with coordinates`);

    return c.json({
      success: true,
      nodes: mapNodes,
      total: mapNodes.length,
    });
  } catch (error: any) {
    console.error("[KG-PG] Map data error:", error);
    return c.json({ error: `Map data failed: ${error.message}` }, 500);
  }
});

// ─── LOCK TERRITORY (KG owner pays to lock) ──────────────────

kgPostgresRoutes.post("/lock-territory", async (c) => {
  try {
    const userTokenHeader = c.req.header("X-User-Token");
    const { error: authError, user } = await verifyToken(userTokenHeader);
    if (authError || !user) {
      return c.json({ error: `Unauthorized: ${authError || "No user"}` }, 401);
    }

    const { kindergarten_id, radius_km } = await c.req.json();
    if (!kindergarten_id) {
      return c.json({ error: "Missing kindergarten_id" }, 400);
    }

    const db = getAdminClient();

    // Verify the KG belongs to this user
    const { data: kgs, error: findError } = await db.from("kindergartens")
      .select("*")
      .eq("id", kindergarten_id)
      .eq("claimed_by", user.id)
      .limit(1);

    if (findError || !kgs || kgs.length === 0) {
      return c.json({ error: "Kindergarten not found or not owned by you" }, 404);
    }

    const kg = kgs[0];

    // Check if already on a paid plan
    if (kg.plan_tier !== 'active' && kg.plan_tier !== 'founder') {
      return c.json({
        error: "Territory lock requires an active subscription (RM 1,800/month). Please upgrade first.",
        requires_upgrade: true,
      }, 402);
    }

    // Update the KG with territory lock data
    const lockRadius = radius_km || 3; // Default 3km radius
    const { error: updateError } = await db.from("kindergartens")
      .update({
        territory_locked: true,
        territory_radius_km: lockRadius,
        territory_locked_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", kindergarten_id);

    if (updateError) {
      return c.json({ error: `Lock failed: ${updateError.message}` }, 500);
    }

    console.log(`[KG-PG] Territory locked for ${kg.name} (${kindergarten_id}): ${lockRadius}km radius`);

    return c.json({
      success: true,
      kindergarten_id,
      territory_radius_km: lockRadius,
      message: `Territory locked! ${lockRadius}km radius secured for "${kg.name}".`,
    });
  } catch (error: any) {
    console.error("[KG-PG] Lock territory error:", error);
    return c.json({ error: `Lock territory failed: ${error.message}` }, 500);
  }
});

kgPostgresRoutes.post("/claim", async (c) => {
  try {
    const userTokenHeader = c.req.header("X-User-Token");
    const { error: authError, user } = await verifyToken(userTokenHeader);
    if (authError || !user) {
      return c.json({ error: `Unauthorized for claim: ${authError || "No user"}` }, 401);
    }

    const { claim_code } = await c.req.json();
    if (!claim_code || typeof claim_code !== "string") {
      return c.json({ error: "Missing claim_code" }, 400);
    }

    const code = claim_code.trim().toUpperCase();
    const db = getAdminClient();

    // Find kindergarten by claim code
    const { data: kgs, error: findError } = await db.from("kindergartens")
      .select("*")
      .eq("claim_code", code)
      .limit(1);

    if (findError) {
      return c.json({ error: `Lookup failed: ${findError.message}` }, 500);
    }

    if (!kgs || kgs.length === 0) {
      return c.json({ error: "Invalid claim code. Please check and try again." }, 404);
    }

    const kg = kgs[0];

    if (kg.status === "claimed" || kg.status === "active") {
      return c.json({ error: "This kindergarten has already been claimed." }, 409);
    }

    // Update kindergarten: mark as claimed, link to user
    const { error: updateError } = await db.from("kindergartens")
      .update({
        status: "claimed",
        claimed_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", kg.id);

    if (updateError) {
      return c.json({ error: `Claim update failed: ${updateError.message}` }, 500);
    }

    console.log(`[KG-PG] Kindergarten claimed: ${kg.name} (${kg.id}) by user ${user.id}`);

    // ── BRIDGE: Sync Postgres KG data → school_accounts table ──
    const pgSyncData: Record<string, any> = {
      linked_pg_kg_id: kg.id,
      updated_at: new Date().toISOString(),
    };
    if (kg.trial_expires_at) {
      pgSyncData.trial_expires_at = kg.trial_expires_at;
      pgSyncData.subscription_tier = kg.plan_tier || 'trial';
    }
    try {
      await supabaseAdmin.from('school_accounts').update(pgSyncData).eq('user_id', user.id);
      console.log(`[KG-BRIDGE] Claim sync: linked PG KG ${kg.id} to school_accounts for user ${user.id}`);
    } catch (syncErr: any) {
      console.error(`[KG-BRIDGE] Claim sync failed (non-fatal):`, syncErr);
    }

    return c.json({
      success: true,
      kindergarten: {
        id: kg.id,
        name: kg.name,
        address: kg.address,
        postcode: kg.postcode,
        state: kg.state,
        status: "claimed",
      },
      message: `Successfully claimed "${kg.name}"!`,
    });
  } catch (error: any) {
    console.error("[KG-PG] Claim error:", error);
    return c.json({ error: `Claim failed: ${error.message}` }, 500);
  }
});

// ─── STATS (Admin) ────────────────────────────────────────────

kgPostgresRoutes.get("/stats", async (c) => {
  try {
    const userTokenHeader = c.req.header("X-User-Token");
    const { error: authError, user } = await verifyToken(userTokenHeader);
    if (authError || !user) {
      return c.json({ error: `Unauthorized: ${authError || "No user"}` }, 401);
    }

    const db = getAdminClient();

    // Get counts by status
    const { count: total } = await db.from("kindergartens").select("*", { count: "exact", head: true });
    const { count: unclaimed } = await db.from("kindergartens").select("*", { count: "exact", head: true }).eq("status", "unclaimed");
    const { count: claimed } = await db.from("kindergartens").select("*", { count: "exact", head: true }).eq("status", "claimed");
    const { count: active } = await db.from("kindergartens").select("*", { count: "exact", head: true }).eq("status", "active");

    // Get counts by state
    const { data: stateData } = await db.from("kindergartens").select("state").not("state", "is", null);
    const stateCounts: Record<string, number> = {};
    (stateData || []).forEach((row: any) => {
      const s = row.state || "Unknown";
      stateCounts[s] = (stateCounts[s] || 0) + 1;
    });

    // KG requests count
    const { count: requestCount } = await db.from("kg_requests").select("*", { count: "exact", head: true }).eq("status", "new");

    return c.json({
      success: true,
      stats: {
        total: total || 0,
        unclaimed: unclaimed || 0,
        claimed: claimed || 0,
        active: active || 0,
        pending_requests: requestCount || 0,
        by_state: stateCounts,
      },
    });
  } catch (error: any) {
    console.error("[KG-PG] Stats error:", error);
    return c.json({ error: `Failed to get KG stats: ${error.message}` }, 500);
  }
});

// ─── KG REQUESTS (Parent submits "KG not found") ─────────────

kgPostgresRoutes.post("/requests", async (c) => {
  try {
    const body = await c.req.json();
    const { kg_name, kg_location, kg_postcode, principal_name, principal_phone, principal_email, parent_message, parent_id } = body;

    if (!kg_name) {
      return c.json({ error: "Kindergarten name is required" }, 400);
    }

    const db = getAdminClient();
    const { data, error } = await db.from("kg_requests").insert({
      parent_id: parent_id || null,
      kg_name,
      kg_location: kg_location || null,
      kg_postcode: kg_postcode || null,
      principal_name: principal_name || null,
      principal_phone: principal_phone || null,
      principal_email: principal_email || null,
      parent_message: parent_message || null,
      status: "new",
    }).select("id");

    if (error) {
      console.error("[KG-PG] Request insert error:", error);
      return c.json({ error: `Failed to submit request: ${error.message}` }, 500);
    }

    console.log(`[KG-PG] New KG request: "${kg_name}" from parent ${parent_id || "anonymous"}`);

    return c.json({
      success: true,
      request_id: data?.[0]?.id,
      message: "Thank you! We'll contact the kindergarten and let you know.",
    });
  } catch (error: any) {
    console.error("[KG-PG] Request error:", error);
    return c.json({ error: `Request failed: ${error.message}` }, 500);
  }
});

// ─── LIST KG REQUESTS (Admin) ────────────────────────────────

kgPostgresRoutes.get("/requests", async (c) => {
  try {
    const userTokenHeader = c.req.header("X-User-Token");
    const { error: authError, user } = await verifyToken(userTokenHeader);
    if (authError || !user) {
      return c.json({ error: `Unauthorized: ${authError || "No user"}` }, 401);
    }

    const statusFilter = c.req.query("status") || "";
    const db = getAdminClient();

    let query = db.from("kg_requests").select("*").order("created_at", { ascending: false }).limit(100);

    if (statusFilter) {
      query = query.eq("status", statusFilter);
    }

    const { data, error } = await query;
    if (error) {
      console.error("[KG-PG] Requests list error:", error);
      return c.json({ error: `Failed to list requests: ${error.message}` }, 500);
    }

    return c.json({ success: true, requests: data || [] });
  } catch (error: any) {
    console.error("[KG-PG] Requests list error:", error);
    return c.json({ error: `Failed to list requests: ${error.message}` }, 500);
  }
});

// ─── UPDATE KG RECORD (Admin) ─────────────────────────────────

kgPostgresRoutes.put("/:id", async (c) => {
  try {
    const userTokenHeader = c.req.header("X-User-Token");
    const { error: authError, user } = await verifyToken(userTokenHeader);
    if (authError || !user) {
      return c.json({ error: `Unauthorized: ${authError || "No user"}` }, 401);
    }

    const id = c.req.param("id");
    // Avoid matching sub-routes like /requests/:id or /:id/trial
    if (id === "requests" || id === "bulk-trial") {
      return c.json({ error: "Invalid kindergarten ID" }, 400);
    }

    const body = await c.req.json();

    // Whitelist of allowed update fields
    // Core columns always present in kindergartens table:
    const coreFields = [
      "name", "address", "postcode", "state", "city", "phone", "email",
      "principal_name", "status", "plan_tier", "lat", "lng",
    ];
    // Optional columns that may or may not exist yet:
    const optionalFields = ["territory_locked", "territory_radius_km"];
    const numericFields = new Set(["lat", "lng", "territory_radius_km"]);
    const booleanFields = new Set(["territory_locked"]);

    const updates: Record<string, any> = {};
    for (const key of [...coreFields, ...optionalFields]) {
      if (body[key] !== undefined) {
        if (numericFields.has(key)) {
          updates[key] = body[key] === null || body[key] === "" ? null : parseFloat(body[key]);
          if (updates[key] !== null && isNaN(updates[key])) {
            return c.json({ error: `Invalid numeric value for ${key}` }, 400);
          }
        } else if (booleanFields.has(key)) {
          updates[key] = !!body[key];
        } else {
          updates[key] = body[key] === "" ? null : body[key];
        }
      }
    }

    if (Object.keys(updates).length === 0) {
      return c.json({ error: "No valid fields to update" }, 400);
    }

    updates.updated_at = new Date().toISOString();

    const db = getAdminClient();
    let { data, error } = await db.from("kindergartens")
      .update(updates)
      .eq("id", id)
      .select("*")
      .single();

    // If the update fails due to a missing column, retry without optional fields
    if (error && error.message?.includes("column") && error.message?.includes("schema cache")) {
      console.log(`[KG-PG] Retrying update without optional columns. Original error: ${error.message}`);
      for (const optKey of optionalFields) {
        delete updates[optKey];
      }
      if (Object.keys(updates).length <= 1) { // only updated_at left
        return c.json({ error: "No valid fields to update (optional columns not available in DB)" }, 400);
      }
      const retry = await db.from("kindergartens")
        .update(updates)
        .eq("id", id)
        .select("*")
        .single();
      data = retry.data;
      error = retry.error;
    }

    if (error) {
      console.log(`[KG-PG] Update KG error for ${id}:`, error.message);
      return c.json({ error: `Update failed: ${error.message}` }, 500);
    }

    if (!data) {
      return c.json({ error: `Kindergarten not found: ${id}` }, 404);
    }

    console.log(`[KG-PG] Updated KG ${id}: ${JSON.stringify(Object.keys(updates))}`);
    return c.json({ success: true, kindergarten: data });
  } catch (err: any) {
    console.log("[KG-PG] Update KG exception:", err.message);
    return c.json({ error: `Update KG error: ${err.message}` }, 500);
  }
});

// ─── UPDATE KG REQUEST STATUS (Admin) ───────���─────────────────

kgPostgresRoutes.put("/requests/:id", async (c) => {
  try {
    const userTokenHeader = c.req.header("X-User-Token");
    const { error: authError, user } = await verifyToken(userTokenHeader);
    if (authError || !user) {
      return c.json({ error: `Unauthorized: ${authError || "No user"}` }, 401);
    }

    const id = c.req.param("id");
    const { status, admin_notes } = await c.req.json();

    if (!status) {
      return c.json({ error: "Missing status field" }, 400);
    }

    const db = getAdminClient();
    const { error } = await db.from("kg_requests")
      .update({ status, admin_notes: admin_notes || null })
      .eq("id", id);

    if (error) {
      return c.json({ error: `Update failed: ${error.message}` }, 500);
    }

    console.log(`[KG-PG] Request ${id} updated to status: ${status}`);
    return c.json({ success: true });
  } catch (error: any) {
    console.error("[KG-PG] Request update error:", error);
    return c.json({ error: `Update failed: ${error.message}` }, 500);
  }
});

// ─── SET TRIAL DURATION (Admin) ───────────────────────────────

kgPostgresRoutes.put("/:id/trial", async (c) => {
  try {
    const userTokenHeader = c.req.header("X-User-Token");
    const { error: authError, user } = await verifyToken(userTokenHeader);
    if (authError || !user) {
      return c.json({ error: `Unauthorized: ${authError || "No user"}` }, 401);
    }

    const id = c.req.param("id");
    const { months, plan_tier } = await c.req.json();

    if (!months || typeof months !== "number" || months < 1 || months > 36) {
      return c.json({ error: "months must be a number between 1 and 36" }, 400);
    }

    const db = getAdminClient();

    // Look up the KG first
    const { data: kgs, error: findError } = await db.from("kindergartens")
      .select("*")
      .eq("id", id)
      .limit(1);

    if (findError || !kgs || kgs.length === 0) {
      return c.json({ error: `Kindergarten not found: ${findError?.message || id}` }, 404);
    }

    const kg = kgs[0];
    const now = new Date();
    const trialStart = now.toISOString();
    const trialEnd = new Date(now.getTime() + months * 30 * 24 * 60 * 60 * 1000).toISOString();
    const newTier = plan_tier || "trial";

    const { error: updateError } = await db.from("kindergartens")
      .update({
        plan_tier: newTier,
        trial_start: trialStart,
        trial_expires_at: trialEnd,
        updated_at: trialStart,
      })
      .eq("id", id);

    if (updateError) {
      return c.json({ error: `Trial update failed: ${updateError.message}` }, 500);
    }

    console.log(`[KG-PG] Trial set for ${kg.name} (${id}): ${months} months, tier=${newTier}, expires=${trialEnd}`);

    // ── BRIDGE: If this KG is claimed, sync trial to the owner's KV school record ──
    let kvSyncResult = null;
    if (kg.claimed_by) {
      kvSyncResult = await syncTrialToKV(kg.claimed_by, kg.id, trialEnd, newTier, kg.name);
    }

    return c.json({
      success: true,
      kindergarten_id: id,
      plan_tier: newTier,
      trial_start: trialStart,
      trial_expires_at: trialEnd,
      months,
      kv_synced: kvSyncResult?.synced || false,
    });
  } catch (error: any) {
    console.error("[KG-PG] Trial set error:", error);
    return c.json({ error: `Failed to set trial: ${error.message}` }, 500);
  }
});

// ─── BULK SET TRIAL (Admin) ──────────────────────────────────

kgPostgresRoutes.post("/bulk-trial", async (c) => {
  try {
    const userTokenHeader = c.req.header("X-User-Token");
    const { error: authError, user } = await verifyToken(userTokenHeader);
    if (authError || !user) {
      return c.json({ error: `Unauthorized: ${authError || "No user"}` }, 401);
    }

    const { months, status_filter, plan_tier } = await c.req.json();

    if (!months || typeof months !== "number" || months < 1 || months > 36) {
      return c.json({ error: "months must be a number between 1 and 36" }, 400);
    }

    const db = getAdminClient();
    const now = new Date();
    const trialStart = now.toISOString();
    const trialEnd = new Date(now.getTime() + months * 30 * 24 * 60 * 60 * 1000).toISOString();
    const newTier = plan_tier || "trial";

    let query = db.from("kindergartens").update({
      plan_tier: newTier,
      trial_start: trialStart,
      trial_expires_at: trialEnd,
      updated_at: trialStart,
    });

    if (status_filter) {
      query = query.eq("status", status_filter);
    }

    const { error: updateError, count } = await query.select("id", { count: "exact" });

    if (updateError) {
      return c.json({ error: `Bulk trial update failed: ${updateError.message}` }, 500);
    }

    console.log(`[KG-PG] Bulk trial set: ${months} months, filter=${status_filter || "all"}, affected=${count}`);

    // ── BRIDGE: Sync trial to KV for all claimed KGs affected by bulk update ──
    let kvSyncCount = 0;
    try {
      let claimedQuery = db.from("kindergartens")
        .select("id, claimed_by, name")
        .not("claimed_by", "is", null);
      if (status_filter) {
        claimedQuery = claimedQuery.eq("status", status_filter);
      }
      const { data: claimedKgs } = await claimedQuery;
      if (claimedKgs && claimedKgs.length > 0) {
        for (const ckg of claimedKgs) {
          if (ckg.claimed_by) {
            const result = await syncTrialToKV(ckg.claimed_by, ckg.id, trialEnd, newTier, ckg.name);
            if (result.synced) kvSyncCount++;
          }
        }
        console.log(`[KG-BRIDGE] Bulk trial KV sync: ${kvSyncCount}/${claimedKgs.length} claimed KGs synced`);
      }
    } catch (syncErr: any) {
      console.error(`[KG-BRIDGE] Bulk trial KV sync error (non-fatal):`, syncErr);
    }

    return c.json({
      success: true,
      affected: count || 0,
      plan_tier: newTier,
      trial_expires_at: trialEnd,
      months,
      kv_synced: kvSyncCount,
    });
  } catch (error: any) {
    console.error("[KG-PG] Bulk trial error:", error);
    return c.json({ error: `Bulk trial failed: ${error.message}` }, 500);
  }
});

// ─── CREATE SINGLE KG (Admin) ─────────────────────────────────

kgPostgresRoutes.post("/create", async (c) => {
  try {
    const userTokenHeader = c.req.header("X-User-Token");
    const { error: authError, user } = await verifyToken(userTokenHeader);
    if (authError || !user) {
      return c.json({ error: `Unauthorized: ${authError || "No user"}` }, 401);
    }

    const body = await c.req.json();

    if (!body.name || !body.name.trim()) {
      return c.json({ error: "Name is required" }, 400);
    }

    const claimCode = generateClaimCode();

    const row: Record<string, any> = {
      name: body.name.trim(),
      address: body.address || null,
      postcode: body.postcode || null,
      state: body.state || null,
      city: body.city || null,
      phone: body.phone || null,
      email: body.email || null,
      principal_name: body.principal_name || null,
      claim_code: claimCode,
      status: body.status || "unclaimed",
      plan_tier: body.plan_tier || "free",
      territory_locked: !!body.territory_locked,
      territory_radius_km: body.territory_radius_km ? parseFloat(body.territory_radius_km) : null,
    };

    // Handle optional lat/lng
    if (body.latitude !== undefined && body.latitude !== null && body.latitude !== "") {
      const latVal = parseFloat(body.latitude);
      if (isNaN(latVal)) return c.json({ error: "Invalid latitude value" }, 400);
      row.lat = latVal;
    }
    if (body.longitude !== undefined && body.longitude !== null && body.longitude !== "") {
      const lngVal = parseFloat(body.longitude);
      if (isNaN(lngVal)) return c.json({ error: "Invalid longitude value" }, 400);
      row.lng = lngVal;
    }

    const db = getAdminClient();
    const { data, error } = await db.from("kindergartens").insert(row).select("*").single();

    if (error) {
      console.log(`[KG-PG] Create KG error:`, error.message);
      return c.json({ error: `Create failed: ${error.message}` }, 500);
    }

    console.log(`[KG-PG] Created KG "${data.name}" id=${data.id} claim_code=${claimCode}`);
    return c.json({ success: true, kindergarten: data }, 201);
  } catch (err: any) {
    console.log("[KG-PG] Create KG exception:", err.message);
    return c.json({ error: `Create KG error: ${err.message}` }, 500);
  }
});

// ─── CLAIM SIGNUP (Public — KG owner claims a listing) ────────

kgPostgresRoutes.post("/claim-signup", async (c) => {
  try {
    const body = await c.req.json();
    const { claim_code, name, email, password, whatsapp, phone } = body;

    if (!claim_code || !name || !email || !password) {
      return c.json({ error: "Missing required fields: claim_code, name, email, password" }, 400);
    }

    const code = claim_code.trim().toUpperCase();
    const db = getAdminClient();

    // 1. Validate claim code exists and KG is unclaimed
    const { data: kgs, error: findError } = await db.from("kindergartens")
      .select("*")
      .eq("claim_code", code)
      .limit(1);

    if (findError) {
      return c.json({ error: `Lookup failed: ${findError.message}` }, 500);
    }

    if (!kgs || kgs.length === 0) {
      return c.json({ error: "Invalid claim code. Please check and try again." }, 404);
    }

    const kg = kgs[0];

    if (kg.status === "claimed" || kg.status === "active") {
      return c.json({ error: "This kindergarten has already been claimed." }, 409);
    }

    // 2. Check if there's already a pending claim for this KG
    const { data: existingClaim } = await supabaseAdmin.from('kg_claims').select('status').eq('claim_code', code).eq('status', 'pending').limit(1).single();
    if (existingClaim) {
      return c.json({ error: "There is already a pending claim for this kindergarten. Please wait for admin review." }, 409);
    }

    // 3. Create Supabase auth user
    const { data: authData, error: authError } = await db.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password,
      email_confirm: true,
      user_metadata: {
        name,
        school_name: kg.name,
        claim_code: code,
        role: 'kindergarten',
      },
    });

    if (authError) {
      console.error("[KG-PG] Claim signup auth error:", authError);
      return c.json({ error: `Failed to create account: ${authError.message}` }, 400);
    }

    const userId = authData.user.id;

    // 4. Create school_accounts record with pending claim status
    const schoolId = crypto.randomUUID();
    await supabaseAdmin.from('school_accounts').insert({
      id: schoolId,
      user_id: userId,
      school_name: kg.name,
      email: email.trim().toLowerCase(),
      kindergarten_url: '',
      short_code: code.slice(0, 5),
      subscription_tier: 'pending_claim',
      claim_status: 'pending',
      claim_code: code,
      linked_pg_kg_id: kg.id,
      whatsapp_no: whatsapp || '',
      phone: phone || '',
      claimant_name: name,
    });

    // 5. Create kg_claims record
    await supabaseAdmin.from('kg_claims').insert({
      claim_code: code,
      kindergarten_id: kg.id,
      kg_name: kg.name,
      kg_state: kg.state,
      kg_city: kg.city,
      user_id: userId,
      claimant_name: name,
      email: email.trim().toLowerCase(),
      whatsapp: whatsapp || '',
      phone: phone || '',
      status: 'pending',
    });

    console.log(`[KG-PG] Claim signup: ${name} (${email}) claimed "${kg.name}" (code: ${code}), pending approval`);

    return c.json({
      success: true,
      message: "Your claim has been submitted! An admin will verify and approve your claim shortly.",
      claim: {
        claim_code: code,
        kg_name: kg.name,
        status: 'pending',
      },
    });
  } catch (error: any) {
    console.error("[KG-PG] Claim signup error:", error);
    return c.json({ error: `Claim signup failed: ${error.message}` }, 500);
  }
});

// ─── PENDING CLAIMS (Admin) ───────────────────────────────────

kgPostgresRoutes.get("/pending-claims", async (c) => {
  try {
    const userTokenHeader = c.req.header("X-User-Token");
    const { error: authError, user } = await verifyToken(userTokenHeader);
    if (authError || !user) {
      return c.json({ error: `Unauthorized: ${authError || "No user"}` }, 401);
    }

    // Fetch all claims from kg_claims table
    const { data: claims, error: claimsError } = await supabaseAdmin
      .from('kg_claims')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);

    if (claimsError) throw claimsError;

    // Sort: pending first
    const sorted = (claims || []).sort((a: any, b: any) => {
      if (a.status === 'pending' && b.status !== 'pending') return -1;
      if (a.status !== 'pending' && b.status === 'pending') return 1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    const pending = sorted.filter((c: any) => c.status === 'pending').length;

    console.log(`[KG-PG] Pending claims: ${pending} pending, ${sorted.length} total`);

    return c.json({
      success: true,
      claims: sorted,
      pending_count: pending,
      total: sorted.length,
    });
  } catch (error: any) {
    console.error("[KG-PG] Pending claims error:", error);
    return c.json({ error: `Failed to list pending claims: ${error.message}` }, 500);
  }
});

// ─── APPROVE CLAIM (Admin) ────────────────────────────────────

kgPostgresRoutes.put("/claim-approve", async (c) => {
  try {
    const userTokenHeader = c.req.header("X-User-Token");
    const { error: authError, user } = await verifyToken(userTokenHeader);
    if (authError || !user) {
      return c.json({ error: `Unauthorized: ${authError || "No user"}` }, 401);
    }

    const { claim_code, admin_notes } = await c.req.json();
    if (!claim_code) {
      return c.json({ error: "Missing claim_code" }, 400);
    }

    const code = claim_code.trim().toUpperCase();

    // 1. Get the claim record from kg_claims table
    const { data: claimRecord } = await supabaseAdmin.from('kg_claims').select('*').eq('claim_code', code).limit(1).single();
    if (!claimRecord) {
      return c.json({ error: "Claim not found" }, 404);
    }
    if (claimRecord.status !== 'pending') {
      return c.json({ error: `Claim is already ${claimRecord.status}` }, 409);
    }

    const db = getAdminClient();
    const now = new Date().toISOString();
    let pgKgId = claimRecord.kindergarten_id;
    const kgDisplayName = claimRecord.kg_name || 'Unknown KG';

    // 2. Postgres: either update existing row or insert a new one
    // Check if this is a new registration (no kindergarten_id)
    if (!pgKgId) {
      // ── NEW REGISTRATION: create a Postgres KG row ──
      const newClaimCode = generateClaimCode();
      const { data: schoolRec } = await supabaseAdmin.from('school_accounts').select('*').eq('user_id', claimRecord.user_id).limit(1).single();

      const newKgRow: any = {
        name: kgDisplayName,
        address: schoolRec?.school_address || null,
        city: schoolRec?.school_city || null,
        state: schoolRec?.school_state || null,
        postcode: schoolRec?.school_postcode || null,
        phone: claimRecord.claimant_whatsapp || schoolRec?.owner_whatsapp || null,
        email: claimRecord.claimant_email || schoolRec?.owner_email || null,
        principal_name: claimRecord.claimant_name || schoolRec?.owner_name || null,
        claim_code: newClaimCode,
        claimed_by: claimRecord.user_id,
        status: "claimed",
        plan_tier: "free",
        created_at: now,
        updated_at: now,
      };

      const { data: insertedKg, error: insertError } = await db
        .from("kindergartens")
        .insert(newKgRow)
        .select("id")
        .single();

      if (insertError) {
        console.error("[KG-PG] New KG insert on approve error:", insertError);
        return c.json({ error: `Failed to create kindergarten record: ${insertError.message}` }, 500);
      }

      pgKgId = insertedKg.id;
      console.log(`[KG-PG] Created new PG KG "${kgDisplayName}" id=${pgKgId} during approve`);

      // Also update the kg_request status to 'approved' if we have a reference
      if (claimRecord.kg_request_id) {
        const { error: reqErr } = await db.from("kg_requests")
          .update({ status: "approved", updated_at: now })
          .eq("id", claimRecord.kg_request_id);
        if (reqErr) console.error("[KG-PG] kg_request status update error (non-fatal):", reqErr);
      }
    } else {
      // ── EXISTING LISTING CLAIM: update the existing Postgres row ──
      if (!pgKgId) {
        return c.json({ error: "Claim record has no kindergarten_id and is not a new registration" }, 400);
      }

      const { error: updateError } = await db.from("kindergartens")
        .update({
          claimed_by: claimRecord.user_id,
          status: "claimed",
          updated_at: now,
        })
        .eq("id", pgKgId);

      if (updateError) {
        return c.json({ error: `Failed to update kindergarten: ${updateError.message}` }, 500);
      }
    }

    // 3. Update kg_claims record
    await supabaseAdmin.from('kg_claims').update({
      status: 'approved',
      kindergarten_id: pgKgId,
      reviewed_at: now,
      reviewed_by: user.id,
      admin_notes: admin_notes || null,
    }).eq('claim_code', code);

    // 4. Update school_accounts: activate + link PG KG id
    await supabaseAdmin.from('school_accounts').update({
      claim_status: 'approved',
      subscription_tier: 'trial',
      linked_pg_kg_id: pgKgId,
      updated_at: now,
    }).eq('user_id', claimRecord.user_id);

    const updatedClaim = { ...claimRecord, status: 'approved', kindergarten_id: pgKgId, reviewed_at: now, reviewed_by: user.id, admin_notes: admin_notes || null };

    console.log(`[KG-PG] Claim approved: "${kgDisplayName}" (${code}) pgKgId=${pgKgId} by admin ${user.id}`);

    return c.json({
      success: true,
      message: `Claim approved! "${kgDisplayName}" is now claimed by ${claimRecord.claimant_name}.`,
      claim: updatedClaim,
      kindergarten_id: pgKgId,
    });
  } catch (error: any) {
    console.error("[KG-PG] Claim approve error:", error);
    return c.json({ error: `Approve failed: ${error.message}` }, 500);
  }
});

// ─── REJECT CLAIM (Admin) ─────────────────────────────────────

kgPostgresRoutes.put("/claim-reject", async (c) => {
  try {
    const userTokenHeader = c.req.header("X-User-Token");
    const { error: authError, user } = await verifyToken(userTokenHeader);
    if (authError || !user) {
      return c.json({ error: `Unauthorized: ${authError || "No user"}` }, 401);
    }

    const { claim_code, admin_notes } = await c.req.json();
    if (!claim_code) {
      return c.json({ error: "Missing claim_code" }, 400);
    }

    const code = claim_code.trim().toUpperCase();

    // 1. Get the claim record
    const { data: claimRecord } = await supabaseAdmin.from('kg_claims').select('*').eq('claim_code', code).limit(1).single();
    if (!claimRecord) {
      return c.json({ error: "Claim not found" }, 404);
    }
    if (claimRecord.status !== 'pending') {
      return c.json({ error: `Claim is already ${claimRecord.status}` }, 409);
    }

    const now = new Date().toISOString();

    // 2. Update kg_claims record
    await supabaseAdmin.from('kg_claims').update({
      status: 'rejected',
      reviewed_at: now,
      reviewed_by: user.id,
      admin_notes: admin_notes || null,
    }).eq('claim_code', code);

    // 3. Update school_accounts record
    await supabaseAdmin.from('school_accounts').update({
      claim_status: 'rejected',
      updated_at: now,
    }).eq('user_id', claimRecord.user_id);

    console.log(`[KG-PG] Claim rejected: "${claimRecord.kg_name}" (${code}) by admin ${user.id}`);

    return c.json({
      success: true,
      message: `Claim rejected for "${claimRecord.kg_name}".`,
      claim: { ...claimRecord, status: 'rejected', reviewed_at: now, reviewed_by: user.id, admin_notes: admin_notes || null },
    });
  } catch (error: any) {
    console.error("[KG-PG] Claim reject error:", error);
    return c.json({ error: `Reject failed: ${error.message}` }, 500);
  }
});

// ─── VALIDATE CLAIM CODE (Public — check if code is valid) ────

kgPostgresRoutes.get("/validate-claim-code", async (c) => {
  try {
    const code = (c.req.query("code") || "").trim().toUpperCase();
    if (!code) {
      return c.json({ error: "Missing code parameter" }, 400);
    }

    const db = getAdminClient();
    const { data: kgs, error } = await db.from("kindergartens")
      .select("id, name, address, city, state, postcode, status")
      .eq("claim_code", code)
      .limit(1);

    if (error) {
      return c.json({ error: `Lookup failed: ${error.message}` }, 500);
    }

    if (!kgs || kgs.length === 0) {
      return c.json({ valid: false, error: "Invalid claim code" }, 404);
    }

    const kg = kgs[0];

    if (kg.status === "claimed" || kg.status === "active") {
      return c.json({ valid: false, error: "This kindergarten has already been claimed", kg_name: kg.name }, 409);
    }

    // Check for pending claim
    const { data: existingClaim } = await supabaseAdmin.from('kg_claims').select('status').eq('claim_code', code).eq('status', 'pending').limit(1).single();
    if (existingClaim) {
      return c.json({ valid: false, error: "There is already a pending claim for this kindergarten", kg_name: kg.name }, 409);
    }

    return c.json({
      valid: true,
      kindergarten: {
        id: kg.id,
        name: kg.name,
        address: kg.address,
        city: kg.city,
        state: kg.state,
        postcode: kg.postcode,
      },
    });
  } catch (error: any) {
    console.error("[KG-PG] Validate claim code error:", error);
    return c.json({ error: `Validation failed: ${error.message}` }, 500);
  }
});

// ─── NEW KG SIGNUP (Public — KG not in our database yet) ──────

kgPostgresRoutes.post("/new-kg-signup", async (c) => {
  try {
    const body = await c.req.json();
    const { kg_name, kg_address, kg_city, kg_state, kg_postcode, name, email, password, whatsapp, phone } = body;

    if (!kg_name || !name || !email || !password) {
      return c.json({ error: "Missing required fields: kg_name, name, email, password" }, 400);
    }

    const db = getAdminClient();

    // 1. Create auth user
    const { data: authData, error: authError } = await db.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password,
      user_metadata: {
        name: name.trim(),
        role: 'kindergarten',
        whatsapp: whatsapp || null,
        phone: phone || null,
      },
      email_confirm: true,
    });

    if (authError) {
      if (authError.message?.includes('already been registered') || authError.message?.includes('already exists')) {
        return c.json({ error: "An account with this email already exists. Please sign in instead." }, 409);
      }
      return c.json({ error: `Account creation failed: ${authError.message}` }, 500);
    }

    const userId = authData.user.id;
    const now = new Date().toISOString();

    // 2. Insert into kg_requests table (admin reviews and creates the PG record)
    const { data: requestData, error: requestError } = await db.from("kg_requests").insert({
      parent_id: userId,
      kg_name: kg_name.trim(),
      kg_location: [kg_address, kg_city, kg_state].filter(Boolean).join(', '),
      kg_postcode: kg_postcode || null,
      principal_name: name.trim(),
      principal_phone: whatsapp || phone || null,
      principal_email: email.trim().toLowerCase(),
      parent_message: `New KG registration via signup page. Owner: ${name.trim()}`,
      status: "new",
    }).select("id");

    if (requestError) {
      console.error("[KG-PG] New KG signup — request insert error:", requestError);
      // Non-fatal: user is created, we can still proceed
    }

    // 3. Create school_accounts record (pending_new — no PG KG yet)
    const schoolId = crypto.randomUUID();
    await supabaseAdmin.from('school_accounts').insert({
      id: schoolId,
      user_id: userId,
      school_name: kg_name.trim(),
      email: email.trim().toLowerCase(),
      address: [kg_address, kg_city, kg_state].filter(Boolean).join(', '),
      phone: phone || null,
      whatsapp_no: whatsapp || '',
      subscription_tier: 'pending_new',
      claim_status: 'pending_new',
      claimant_name: name.trim(),
    });

    // 4. Also store in kg_claims table so it appears in admin Pending Claims tab
    const pseudoCode = `NEW-${schoolId.slice(0, 8).toUpperCase()}`;
    await supabaseAdmin.from('kg_claims').insert({
      claim_code: pseudoCode,
      kindergarten_id: null,
      kg_name: kg_name.trim(),
      kg_state: kg_state || null,
      kg_city: kg_city || null,
      user_id: userId,
      claimant_name: name.trim(),
      email: email.trim().toLowerCase(),
      whatsapp: whatsapp || null,
      phone: phone || null,
      status: 'pending',
      admin_notes: `New KG registration. Request ID: ${requestData?.[0]?.id || 'N/A'}`,
    });

    console.log(`[KG-PG] New KG signup: "${kg_name}" by ${email} (userId: ${userId})`);

    return c.json({
      success: true,
      message: "Registration submitted! An admin will review and set up your kindergarten.",
      user_id: userId,
      school_id: schoolId,
      request_id: requestData?.[0]?.id || null,
    }, 201);
  } catch (error: any) {
    console.error("[KG-PG] New KG signup error:", error);
    return c.json({ error: `Registration failed: ${error.message}` }, 500);
  }
});

// ─── DELETE KG RECORD (Admin) ────────────────────────────────

kgPostgresRoutes.delete("/:id", async (c) => {
  try {
    const userTokenHeader = c.req.header("X-User-Token");
    const { error: authError, user } = await verifyToken(userTokenHeader);
    if (authError || !user) {
      return c.json({ error: `Unauthorized: ${authError || "No user"}` }, 401);
    }

    const id = c.req.param("id");
    // Avoid matching sub-routes like /requests/:id or /:id/trial
    if (id === "requests" || id === "bulk-trial") {
      return c.json({ error: "Invalid kindergarten ID" }, 400);
    }

    const db = getAdminClient();
    const { error } = await db.from("kindergartens")
      .delete()
      .eq("id", id);

    if (error) {
      console.log(`[KG-PG] Delete KG error for ${id}:`, error.message);
      return c.json({ error: `Delete failed: ${error.message}` }, 500);
    }

    console.log(`[KG-PG] Deleted KG ${id}`);
    return c.json({ success: true });
  } catch (err: any) {
    console.log("[KG-PG] Delete KG exception:", err.message);
    return c.json({ error: `Delete KG error: ${err.message}` }, 500);
  }
});