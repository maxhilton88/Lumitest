import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import * as kv from "./kv_store.tsx"; // retained for media_category / media_audio (no PG table)
import { supabaseAdmin, verifyToken, getSchoolForUser } from "./auth.tsx";
import { stripeRoutes, grantDiamondInbox } from "./stripe.tsx";
import { kgPostgresRoutes, syncTrialToKV } from "./kg-postgres.tsx";
import { fmcg } from "./fmcg.tsx";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  uploadToR2,
  deleteFromR2,
  deleteMultipleFromR2,
  r2PublicUrl,
  isR2Key,
  extractR2Key,
  unresolveR2Url,
  R2_AUDIO_PREFIX,
  R2_ART_PREFIX,
  R2_QUEST_IMAGE_PREFIX,
} from "./r2.tsx";

// ===== SUPER ADMIN ROLE GUARD =====
// Emails in this whitelist get role: 'superadmin' on login/session.
// Additional admins can be promoted via user_metadata.role = 'superadmin' in Supabase dashboard.
const SUPER_ADMIN_EMAILS = new Set([
  'hey@pitchdeck.my',
]);

function resolveUserRole(email: string, userMetadata?: Record<string, any>): 'superadmin' | 'kindergarten' {
  if (SUPER_ADMIN_EMAILS.has(email)) return 'superadmin';
  if (userMetadata?.role === 'superadmin') return 'superadmin';
  return 'kindergarten';
}

const app = new Hono();

// ===== CANONICAL SUBJECT ID NORMALIZATION =====
// Maps all known aliases (from CSV bank, quest system, etc.) to the 7 canonical
// IDs used by RealmMasteryPage: english, numbers, bahasa, mandarin, science, sejarah, geography
// Single source of truth — used by both mastery-log POST and mastery-profile GET
const SUBJECT_ALIAS_MAP: Record<string, string> = {
  english: "english", eng: "english", inggeris: "english", "bahasa inggeris": "english",
  numbers: "numbers", number: "numbers", math: "numbers", maths: "numbers",
  mathematics: "numbers", matematik: "numbers", nombor: "numbers", numeracy: "numbers",
  bahasa: "bahasa", bm: "bahasa", malay: "bahasa", melayu: "bahasa",
  "bahasa melayu": "bahasa", "bahasa malaysia": "bahasa",
  mandarin: "mandarin", chinese: "mandarin", cina: "mandarin",
  "bahasa cina": "mandarin", zh: "mandarin",
  science: "science", sains: "science", stem: "science", discovery: "science",
  sejarah: "sejarah", history: "sejarah",
  geography: "geography", geografi: "geography", geo: "geography",
};
function normalizeSubjectId(raw: string): string {
  const lower = raw.toLowerCase().trim();
  return SUBJECT_ALIAS_MAP[lower] || lower;
}

// ===== RESILIENT UPSERT HELPER =====
// Parse age_target from number OR KSSR display label (e.g. "Prasekolah Thn 1" → 4)
function parseAgeTarget(val: any): number | null {
  if (val === null || val === undefined || val === '') return null;
  const n = Number(val);
  if (!isNaN(n) && n >= 4 && n <= 12) return n;
  const labelMap: Record<string, number> = {
    'prasekolah thn 1': 4, 'prasekolah thn 2': 5, 'prasekolah thn 3': 6,
    'tahun 1': 7, 'tahun 2': 8, 'tahun 3': 9,
    'tahun 4': 10, 'tahun 5': 11, 'tahun 6': 12,
    'ps1': 4, 'ps2': 5, 'ps3': 6,
    't1': 7, 't2': 8, 't3': 9, 't4': 10, 't5': 11, 't6': 12,
    'thn 1': 7, 'thn 2': 8, 'thn 3': 9, 'thn 4': 10, 'thn 5': 11, 'thn 6': 12,
    'year 1': 7, 'year 2': 8, 'year 3': 9, 'year 4': 10, 'year 5': 11, 'year 6': 12,
    'prasekolah': 4,
  };
  const key = String(val).trim().toLowerCase();
  return labelMap[key] ?? null;
}

// Attempts upsert; if a column is missing from the PG schema cache,
// strips that column from all rows and retries (up to 5 times).
async function resilientUpsert(
  table: string,
  rows: Record<string, any>[],
  options: { onConflict: string },
  maxRetries = 15,
): Promise<{ data: any[] | null; error: any; strippedColumns: string[] }> {
  const strippedColumns: string[] = [];
  // Sanitize: convert empty strings to null to prevent "invalid input syntax for type integer" errors
  let currentRows = rows.map((row: Record<string, any>) => {
    const sanitized: Record<string, any> = {};
    for (const [k, v] of Object.entries(row)) {
      sanitized[k] = v === '' ? null : v;
    }
    return sanitized;
  });

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const { data, error } = await supabaseAdmin
      .from(table)
      .upsert(currentRows, options)
      .select('q_id');

    if (!error) {
      if (strippedColumns.length > 0) {
        console.log(`[RESILIENT-UPSERT] Success after stripping columns: ${strippedColumns.join(', ')}`);
      }
      return { data, error: null, strippedColumns };
    }

    // Check if error is a missing column error
    const colMatch = error.message?.match(/Could not find the '(\w+)' column/);
    if (colMatch && attempt < maxRetries) {
      const missingCol = colMatch[1];
      strippedColumns.push(missingCol);
      console.log(`[RESILIENT-UPSERT] Column '${missingCol}' missing from ${table}, stripping and retrying (attempt ${attempt + 1})`);
      currentRows = currentRows.map((row: Record<string, any>) => {
        const { [missingCol]: _removed, ...rest } = row;
        return rest;
      });
      continue;
    }

    // Check if error is a type mismatch (e.g. empty string into integer column)
    const typeMatch = error.message?.match(/invalid input syntax for type (\w+)/);
    if (typeMatch && attempt < maxRetries) {
      // Try to find column name in error.details or error.hint
      const detailColMatch = error.details?.match(/column "(\w+)"/);
      if (detailColMatch) {
        const badCol = detailColMatch[1];
        strippedColumns.push(badCol);
        console.log(`[RESILIENT-UPSERT] Type error on column '${badCol}' in ${table}, stripping and retrying (attempt ${attempt + 1})`);
        currentRows = currentRows.map((row: Record<string, any>) => {
          const { [badCol]: _removed, ...rest } = row;
          return rest;
        });
        continue;
      }
      console.error(`[RESILIENT-UPSERT] Type error but cannot identify column: ${error.message} | details: ${error.details} | hint: ${error.hint}`);
    }

    // Non-column error or max retries exceeded
    return { data: null, error, strippedColumns };
  }

  return { data: null, error: { message: 'Max retries exceeded in resilientUpsert' }, strippedColumns };
}

// ===== STORAGE BUCKET SETUP =====
const QUEST_IMAGE_BUCKET = 'make-221a61bc-quest-images';
const ANSWER_IMAGE_BUCKET = 'make-221a61bc-answer-images';

// Idempotently create storage buckets on startup
(async () => {
  try {
    const { data: buckets } = await supabaseAdmin.storage.listBuckets();
    // Quest images bucket
    const bucketExists = buckets?.some(bucket => bucket.name === QUEST_IMAGE_BUCKET);
    if (!bucketExists) {
      await supabaseAdmin.storage.createBucket(QUEST_IMAGE_BUCKET, { public: false });
      console.log(`[STORAGE] Created bucket: ${QUEST_IMAGE_BUCKET}`);
    } else {
      console.log(`[STORAGE] Bucket already exists: ${QUEST_IMAGE_BUCKET}`);
    }
    // Answer images bucket (for MCQ-image answer options)
    const answerBucketExists = buckets?.some(bucket => bucket.name === ANSWER_IMAGE_BUCKET);
    if (!answerBucketExists) {
      await supabaseAdmin.storage.createBucket(ANSWER_IMAGE_BUCKET, { public: false });
      console.log(`[STORAGE] Created bucket: ${ANSWER_IMAGE_BUCKET}`);
    } else {
      console.log(`[STORAGE] Bucket already exists: ${ANSWER_IMAGE_BUCKET}`);
    }

    // Create test video with DynTube key if it doesn't exist
    const testVideoId = 'video_test_dyntube_001';
    const { data: existingTestVideo } = await supabaseAdmin.from('videos').select('id').eq('id', testVideoId).limit(1).single();
    if (!existingTestVideo) {
      await supabaseAdmin.from('videos').insert({
        id: testVideoId,
        title: 'Test Video - Foxy Adventure',
        subtitle: 'DynTube Integration Test',
        category: 'english',
        language: 'en',
        duration: '5:00',
        thumbnail: 'https://images.unsplash.com/photo-1769072385024-c962e061c523?w=480&h=270&fit=crop',
        dyntube_key: 'sNwOT9edCEVH7aaOyvng',
        is_premium: false,
        is_new: true,
        is_featured: true,
        status: 'active',
        sort_order: 0,
      });
      console.log('[VIDEO] Created test DynTube video:', testVideoId);
    } else {
      console.log('[VIDEO] Test DynTube video already exists');
    }
  } catch (err) {
    console.error('[STORAGE] Failed to create buckets:', err);
  }
})();

// ===== GOOGLE DRIVE URL NORMALIZER =====
// Converts drive.google.com/uc?id=FILE_ID&export=download → lh3.googleusercontent.com/d/FILE_ID
// lh3 URLs serve raw binary directly (no HTML wrapper), required for server-side fetch
function normalizeGoogleDriveUrl(url: string): string {
  if (!url) return url;
  try {
    const u = new URL(url);
    if (u.hostname === 'drive.google.com' && u.pathname === '/uc') {
      const fileId = u.searchParams.get('id');
      if (fileId) {
        return `https://lh3.googleusercontent.com/d/${fileId}`;
      }
    }
  } catch {}
  return url;
}

// ===== DOWNLOAD FROM URL → STORE IN R2 =====
// Generic helper: fetches binary from any HTTPS URL, validates, uploads to R2
// Returns { r2Key, publicUrl } on success, { error } on failure
async function downloadAndStoreToR2(
  sourceUrl: string,
  r2Key: string,
  opts: { maxBytes?: number; allowedPrefixes?: string[] } = {}
): Promise<{ r2Key: string; publicUrl: string } | { error: string }> {
  const maxBytes = opts.maxBytes ?? 500 * 1024; // default 500KB
  const allowedPrefixes = opts.allowedPrefixes ?? ['image/', 'audio/'];

  try {
    // Normalize Google Drive URLs
    const fetchUrl = normalizeGoogleDriveUrl(sourceUrl);
    console.log(`[R2-DL] Fetching: ${fetchUrl} (original: ${sourceUrl === fetchUrl ? 'same' : sourceUrl})`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout

    const response = await fetch(fetchUrl, { signal: controller.signal });
    clearTimeout(timeout);

    if (!response.ok) {
      return { error: `HTTP ${response.status} fetching ${fetchUrl}` };
    }

    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    // Allow application/octet-stream if URL has a known file extension matching the allowed type
    const knownAudioExts = ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.webm'];
    const knownImageExts = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp'];
    const urlPath = new URL(fetchUrl).pathname.toLowerCase();
    const isOctetStream = contentType === 'application/octet-stream';
    let effectiveContentType = contentType;
    if (isOctetStream) {
      if (allowedPrefixes.includes('audio/') && knownAudioExts.some(ext => urlPath.endsWith(ext))) {
        effectiveContentType = 'audio/mpeg';
      } else if (allowedPrefixes.includes('image/') && knownImageExts.some(ext => urlPath.endsWith(ext))) {
        effectiveContentType = 'image/png';
      }
    }
    if (!allowedPrefixes.some(p => effectiveContentType.startsWith(p))) {
      return { error: `Invalid content-type "${contentType}" for ${fetchUrl}` };
    }

    const arrayBuffer = await response.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    if (bytes.length > maxBytes) {
      return { error: `File too large (${(bytes.length / 1024).toFixed(0)}KB > ${(maxBytes / 1024).toFixed(0)}KB) from ${fetchUrl}` };
    }

    if (bytes.length === 0) {
      return { error: `Empty file from ${fetchUrl}` };
    }

    const result = await uploadToR2(r2Key, bytes, effectiveContentType);
    return { r2Key: `r2:${r2Key}`, publicUrl: result.publicUrl };
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return { error: `Download timeout (>15s) for ${sourceUrl}` };
    }
    return { error: `Download failed for ${sourceUrl}: ${err.message}` };
  }
}

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: (origin: string | undefined) => {
      if (!origin) return ""; // Stripe webhooks / server-to-server
      if (origin === "https://projectlumi.org") return origin;
      if (origin === "https://www.projectlumi.org") return origin;
      if (origin.startsWith("http://localhost:")) return origin;
      if (origin.endsWith(".figma.site")) return origin;
      if (origin.endsWith(".figma.net")) return origin;
      return "";
    },
    allowHeaders: ["Content-Type", "Authorization", "X-User-Token"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// Health check endpoint
app.get("/make-server-221a61bc/health", (c) => {
  return c.json({ status: "ok", version: "1.0" });
});

// DEBUG: Verify leads exist in KV (no auth, temp endpoint for debugging)
app.get("/make-server-221a61bc/debug/leads/:schoolId", async (c) => {
  try {
    const schoolId = c.req.param('schoolId');
    console.log(`[DEBUG] Checking leads for school: ${schoolId}`);
    
    const { data: leads } = await supabaseAdmin.from('leads').select('*').eq('school_id', schoolId);
    console.log(`[DEBUG] Found ${(leads||[]).length} leads`);
    
    // Also check the school_accounts table
    const { data: school } = await supabaseAdmin.from('school_accounts').select('*').eq('id', schoolId).limit(1).single();
    
    return c.json({
      schoolId,
      schoolExists: !!school,
      schoolName: school?.school_name || 'NOT FOUND',
      prefix,
      leadCount: (leads||[]).length,
      leads: (leads||[]).map((l: any) => ({
        id: l.id,
        child_name: l.child_name,
        status: l.status,
        score: l.score,
        total_questions: l.total_questions,
        school_id: l.school_id,
        created_at: l.created_at,
        updated_at: l.updated_at,
      }))
    });
  } catch (error) {
    return c.json({ error: error.message }, 500);
  }
});

// ===== SCHOOL LOOKUP (Public - for child test flow) =====

// Resolve school by email (dev mode) or kindergarten URL slug (production)
app.get("/make-server-221a61bc/schools/resolve", async (c) => {
  try {
    const email = c.req.query('email');
    const url = c.req.query('url');

    if (!email && !url) {
      return c.json({ error: "Must provide 'email' or 'url' query parameter" }, 400);
    }

    let schoolData = null;

    if (url) {
      // Production mode: lookup by kindergarten URL slug
      console.log(`Resolving school by URL: ${url}`);
      const { data } = await supabaseAdmin.from('school_accounts').select('*').eq('kindergarten_url', url).limit(1).single();
      schoolData = data;
    }

    if (!schoolData && email) {
      // Dev mode: lookup by email
      console.log(`Resolving school by email: ${email}`);
      const { data } = await supabaseAdmin.from('school_accounts').select('*').eq('email', email).limit(1).single();
      schoolData = data;
    }

    if (!schoolData) {
      console.log(`No school found for email=${email}, url=${url}`);
      return c.json({ error: 'School not found' }, 404);
    }

    console.log(`School resolved: ${schoolData.school_name} (${schoolData.id})`);

    return c.json({
      success: true,
      school: {
        id: schoolData.id,
        schoolName: schoolData.school_name,
        kindergartenUrl: schoolData.kindergarten_url,
        shortCode: schoolData.short_code || null,
        subscriptionTier: schoolData.subscription_tier,
        trialExpiresAt: schoolData.trial_expires_at || null,
      }
    });
  } catch (error) {
    console.error('Resolve school error:', error);
    return c.json({ error: `Failed to resolve school: ${error.message}` }, 500);
  }
});

// Resolve school by shortCode or slug (for /t/:code branded test links)
// e.g. GET /schools/resolve/TGJ01 or GET /schools/resolve/little-stars
app.get("/make-server-221a61bc/schools/resolve/:code", async (c) => {
  try {
    const code = c.req.param('code');
    if (!code) {
      return c.json({ error: 'Missing school code' }, 400);
    }

    console.log(`[SCHOOL] Resolving school by code: ${code}`);

    // Strategy 1: Lookup by shortCode (e.g. TGJ01)
    let schoolData = null;
    const { data: byCode } = await supabaseAdmin.from('school_accounts').select('*').eq('short_code', code.toUpperCase()).limit(1).single();
    schoolData = byCode;

    // Strategy 2: Fallback to URL slug
    if (!schoolData) {
      const { data: byUrl } = await supabaseAdmin.from('school_accounts').select('*').eq('kindergarten_url', code).limit(1).single();
      schoolData = byUrl;
    }

    if (!schoolData) {
      console.log(`[SCHOOL] No school found for code: ${code}`);
      return c.json({ error: 'School not found' }, 404);
    }

    console.log(`[SCHOOL] Resolved: ${schoolData.school_name} (${schoolData.id}) via code ${code}`);

    return c.json({
      success: true,
      school: {
        id: schoolData.id,
        schoolName: schoolData.school_name,
        kindergartenUrl: schoolData.kindergarten_url,
        shortCode: schoolData.short_code || null,
        subscriptionTier: schoolData.subscription_tier,
        branding: {
          logoUrl: schoolData.logo_url || '',
          primaryColor: schoolData.primary_color || '#7cc643',
        },
      },
    });
  } catch (error) {
    console.error('[SCHOOL] Resolve by code error:', error);
    return c.json({ error: `Failed to resolve school: ${error.message}` }, 500);
  }
});

// ===== AUTHENTICATION =====

// Signup - Create new school account with user
app.post("/make-server-221a61bc/auth/signup", async (c) => {
  try {
    const body = await c.req.json();
    const { email, password, schoolName, kindergartenUrl } = body;

    if (!email || !password || !schoolName || !kindergartenUrl) {
      return c.json({ error: "Missing required fields: email, password, schoolName, kindergartenUrl" }, 400);
    }

    console.log(`Signup attempt for email: ${email}, school: ${schoolName}`);

    // Create user in Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm since no email server configured
      user_metadata: {
        school_name: schoolName,
      }
    });

    if (authError) {
      console.error('Auth signup error:', authError);
      return c.json({ error: `Failed to create user: ${authError.message}` }, 400);
    }

    console.log(`User created with ID: ${authData.user.id}`);

    // Generate a 5-char shortCode: first 3 letters of school name (uppercase) + 2-digit number
    // e.g. "Tadika Genius Junior" → "TGJ01"
    const generateShortCode = async (name: string): Promise<string> => {
      const words = name.replace(/[^a-zA-Z\s]/g, '').split(/\s+/).filter(Boolean);
      const prefix = words.length >= 3
        ? words.slice(0, 3).map(w => w[0].toUpperCase()).join('')
        : words.map(w => w[0]?.toUpperCase() || '').join('').padEnd(3, 'X').slice(0, 3);
      // Try codes 01-99 to avoid collisions
      for (let i = 1; i <= 99; i++) {
        const code = `${prefix}${String(i).padStart(2, '0')}`;
        const { data: existing } = await supabaseAdmin.from('school_accounts').select('id').eq('short_code', code).limit(1).single();
        if (!existing) return code;
      }
      // Fallback: random suffix
      return `${prefix}${Math.random().toString(36).substring(2, 4).toUpperCase()}`;
    };

    // Create school record in KV store
    const schoolId = crypto.randomUUID();
    const shortCode = await generateShortCode(schoolName);
    const schoolData = {
      id: schoolId,
      user_id: authData.user.id,
      school_name: schoolName,
      email,
      kindergarten_url: kindergartenUrl,
      short_code: shortCode,
      subscription_tier: 'trial',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    try {
      const { error: insertError } = await supabaseAdmin.from('school_accounts').insert(schoolData);
      if (insertError) throw insertError;
      console.log(`School created successfully: ${schoolId}, shortCode: ${shortCode}`);
    } catch (pgError: any) {
      console.error('School creation error:', pgError);
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return c.json({ error: `Failed to create school: ${pgError.message}` }, 500);
    }

    return c.json({
      success: true,
      user: {
        id: authData.user.id,
        email: authData.user.email,
      },
      school: schoolData,
      message: "Account created successfully! Please sign in."
    });
  } catch (error) {
    console.error("Signup error:", error);
    return c.json({ error: `Signup failed: ${error.message}` }, 500);
  }
});

// Login - Sign in existing user
app.post("/make-server-221a61bc/auth/login", async (c) => {
  try {
    const body = await c.req.json();
    const { email, password } = body;

    if (!email || !password) {
      return c.json({ error: "Missing required fields: email, password" }, 400);
    }

    console.log(`Login attempt for email: ${email}`);

    // Create a fresh Supabase client for authentication
    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!
    );

    // Sign in with password to get real session token
    const { data: authData, error: authError } = await supabaseAuth.auth.signInWithPassword({
      email,
      password,
    });

    if (authError || !authData.user) {
      console.error('Authentication failed:', authError);
      return c.json({ error: 'Invalid credentials' }, 401);
    }

    console.log(`User authenticated: ${authData.user.id}`);
    console.log(`Session token present: ${!!authData.session?.access_token}`);

    // Resolve role FIRST — superadmin does not require a school_accounts row
    const role = resolveUserRole(authData.user.email!, authData.user.user_metadata);
    console.log(`User role resolved: ${role}`);

    // ── SUPERADMIN: skip school lookup entirely ──
    if (role === 'superadmin') {
      console.log(`[AUTH] Superadmin login — skipping school lookup for ${authData.user.email}`);
      return c.json({
        success: true,
        user: {
          id: authData.user.id,
          email: authData.user.email,
          role,
        },
        school: {
          id: 'superadmin',
          school_name: 'Super Admin',
          short_code: '',
          kindergarten_url: '',
          subscription_tier: 'superadmin',
          user_id: authData.user.id,
        },
        session: {
          access_token: authData.session.access_token,
          refresh_token: authData.session.refresh_token,
        },
        message: "Login successful!"
      });
    }

    // Get school for this user from school_accounts
    const { data: schoolData } = await supabaseAdmin.from('school_accounts').select('*').eq('user_id', authData.user.id).limit(1).single();

    if (!schoolData) {
      console.error('No school found for user:', authData.user.id);
      return c.json({ error: 'No school associated with this account' }, 404);
    }

    console.log(`Login successful for school: ${schoolData.school_name}`);

    // ── BRIDGE: Login-time Postgres → KV trial sync ──
    // If this school has a linked Postgres KG, check for newer trial data
    let enrichedSchool = schoolData;
    if (role === 'kindergarten') {
      try {
        const pgDb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
        let pgKg = null;

        // Strategy 1: Use linked_pg_kg_id if available
        if (schoolData.linked_pg_kg_id) {
          const { data } = await pgDb.from('kindergartens').select('*').eq('id', schoolData.linked_pg_kg_id).limit(1);
          pgKg = data?.[0];
        }

        // Strategy 2: Find by claimed_by user ID
        if (!pgKg) {
          const { data } = await pgDb.from('kindergartens').select('*').eq('claimed_by', authData.user.id).limit(1);
          pgKg = data?.[0];
        }

        // ── CLAIM-STATUS SYNC at login ──
        if (pgKg && pgKg.claimed_by === authData.user.id && enrichedSchool.claim_status === 'pending') {
          console.log(`[KG-BRIDGE] Login: claim approved detected for user ${authData.user.id}, upgrading claim_status`);
          await supabaseAdmin.from('school_accounts').update({
            claim_status: 'approved', subscription_tier: pgKg.plan_tier || 'trial', updated_at: new Date().toISOString(),
          }).eq('user_id', authData.user.id);
          enrichedSchool = { ...enrichedSchool, claim_status: 'approved', subscription_tier: pgKg.plan_tier || 'trial' };
        }

        if (pgKg && pgKg.trial_expires_at) {
          const pgExpiry = new Date(pgKg.trial_expires_at).getTime();
          const kvExpiry = schoolData.trial_expires_at ? new Date(schoolData.trial_expires_at).getTime() : 0;
          const now = Date.now();

          if (pgExpiry < now && pgKg.plan_tier === 'trial') {
            console.log(`[TRIAL-EXPIRE] Login auto-expire for PG KG ${pgKg.id}`);
            await pgDb.from('kindergartens').update({ plan_tier: 'free', updated_at: new Date().toISOString() }).eq('id', pgKg.id);
            await syncTrialToKV(authData.user.id, pgKg.id, pgKg.trial_expires_at, 'free', pgKg.name);
            const { data: updated } = await supabaseAdmin.from('school_accounts').select('*').eq('user_id', authData.user.id).limit(1).single();
            if (updated) enrichedSchool = updated;
          } else if (pgExpiry > kvExpiry) {
            await syncTrialToKV(authData.user.id, pgKg.id, pgKg.trial_expires_at, pgKg.plan_tier || 'trial', pgKg.name);
            const { data: updated } = await supabaseAdmin.from('school_accounts').select('*').eq('user_id', authData.user.id).limit(1).single();
            if (updated) enrichedSchool = updated;
          }
        } else if (pgKg && !schoolData.linked_pg_kg_id) {
          await supabaseAdmin.from('school_accounts').update({ linked_pg_kg_id: pgKg.id, updated_at: new Date().toISOString() }).eq('user_id', authData.user.id);
          enrichedSchool = { ...enrichedSchool, linked_pg_kg_id: pgKg.id };
          console.log(`[KG-BRIDGE] Login: linked PG KG ${pgKg.id}`);
        }
      } catch (bridgeErr: any) {
        console.error('[KG-BRIDGE] Login-time sync error (non-fatal):', bridgeErr);
      }
    }

    return c.json({
      success: true,
      user: {
        id: authData.user.id,
        email: authData.user.email,
        role, // 'superadmin' | 'kindergarten'
      },
      school: enrichedSchool,
      session: {
        access_token: authData.session.access_token,
        refresh_token: authData.session.refresh_token,
      },
      message: "Login successful!"
    });
  } catch (error) {
    console.error("Login error:", error);
    return c.json({ error: `Login failed: ${error.message}` }, 500);
  }
});

// Session validation - Verify token and return user/school info
app.get("/make-server-221a61bc/auth/session", async (c) => {
  try {
    const userTokenHeader = c.req.header('X-User-Token');
    console.log('Session check - X-User-Token:', userTokenHeader ? 'Present' : 'Missing');

    const { error: authError, user } = await verifyToken(userTokenHeader);

    if (authError || !user) {
      console.log('Session check failed:', authError);
      return c.json({ error: authError || 'Invalid session', valid: false }, 401);
    }

    const role = resolveUserRole(user.email!, user.user_metadata);

    // ── SUPERADMIN: skip school lookup entirely ──
    if (role === 'superadmin') {
      console.log(`[AUTH] Session valid for superadmin: ${user.id}`);
      return c.json({
        valid: true,
        user: {
          id: user.id,
          email: user.email,
          role,
        },
        school: {
          id: 'superadmin',
          school_name: 'Super Admin',
          short_code: '',
          kindergarten_url: '',
          subscription_tier: 'superadmin',
          user_id: user.id,
        },
      });
    }

    // Get school for this user
    const { error: schoolError, school } = await getSchoolForUser(user.id);

    if (schoolError || !school) {
      console.log('Session check - no school found:', schoolError);
      return c.json({ error: 'No school found', valid: false }, 404);
    }

    console.log(`Session valid for user: ${user.id}, school: ${school.school_name}, role: ${role}`);

    // ── BRIDGE: Session-time Postgres → KV trial sync + auto-expire ──
    let enrichedSchool = school;
    if (role === 'kindergarten') {
      try {
        const pgDb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
        let pgKg = null;

        if (school.linked_pg_kg_id) {
          const { data } = await pgDb.from('kindergartens').select('id, trial_expires_at, plan_tier, name, claimed_by').eq('id', school.linked_pg_kg_id).limit(1);
          pgKg = data?.[0];
        }
        if (!pgKg) {
          const { data } = await pgDb.from('kindergartens').select('id, trial_expires_at, plan_tier, name, claimed_by').eq('claimed_by', user.id).limit(1);
          pgKg = data?.[0];
        }

        // ── CLAIM-STATUS SYNC ──
        if (pgKg && pgKg.claimed_by === user.id && enrichedSchool.claim_status === 'pending') {
          console.log(`[KG-BRIDGE] Session: claim approved detected for user ${user.id}`);
          await supabaseAdmin.from('school_accounts').update({
            claim_status: 'approved', subscription_tier: pgKg.plan_tier || 'trial', updated_at: new Date().toISOString(),
          }).eq('user_id', user.id);
          enrichedSchool = { ...enrichedSchool, claim_status: 'approved', subscription_tier: pgKg.plan_tier || 'trial' };
        }

        if (pgKg && pgKg.trial_expires_at) {
          const pgExpiry = new Date(pgKg.trial_expires_at).getTime();
          const kvExpiry = school.trial_expires_at ? new Date(school.trial_expires_at).getTime() : 0;
          const now = Date.now();

          if (pgExpiry < now && pgKg.plan_tier === 'trial') {
            await pgDb.from('kindergartens').update({ plan_tier: 'free', updated_at: new Date().toISOString() }).eq('id', pgKg.id);
            await syncTrialToKV(user.id, pgKg.id, pgKg.trial_expires_at, 'free', pgKg.name);
            const { data: updated } = await supabaseAdmin.from('school_accounts').select('*').eq('user_id', user.id).limit(1).single();
            if (updated) enrichedSchool = updated;
            console.log(`[TRIAL-EXPIRE] Downgraded KG ${pgKg.id} from 'trial' → 'free'`);
          } else if (pgExpiry > kvExpiry) {
            await syncTrialToKV(user.id, pgKg.id, pgKg.trial_expires_at, pgKg.plan_tier || 'trial', pgKg.name);
            const { data: updated } = await supabaseAdmin.from('school_accounts').select('*').eq('user_id', user.id).limit(1).single();
            if (updated) enrichedSchool = updated;
          }
        } else if (pgKg && !school.linked_pg_kg_id) {
          await supabaseAdmin.from('school_accounts').update({ linked_pg_kg_id: pgKg.id, updated_at: new Date().toISOString() }).eq('user_id', user.id);
          enrichedSchool = { ...enrichedSchool, linked_pg_kg_id: pgKg.id };
        }

        // ── AUTO-EXPIRE: Check PG-only trials ──
        if (!pgKg && enrichedSchool.trial_expires_at && enrichedSchool.subscription_tier === 'trial') {
          const trialExpiry = new Date(enrichedSchool.trial_expires_at).getTime();
          if (trialExpiry < Date.now()) {
            console.log(`[TRIAL-EXPIRE] Auto-expiring trial for user ${user.id}`);
            await supabaseAdmin.from('school_accounts').update({ subscription_tier: 'free', updated_at: new Date().toISOString() }).eq('user_id', user.id);
            enrichedSchool = { ...enrichedSchool, subscription_tier: 'free' };
          }
        }
      } catch (bridgeErr: any) {
        console.error('[KG-BRIDGE] Session sync error (non-fatal):', bridgeErr);
      }
    }

    return c.json({
      valid: true,
      user: {
        id: user.id,
        email: user.email,
        role, // 'superadmin' | 'kindergarten'
      },
      school: enrichedSchool,
    });
  } catch (error) {
    console.error("Session check error:", error);
    return c.json({ error: `Session check failed: ${error.message}`, valid: false }, 500);
  }
});

// ===== SCHOOL SETTINGS (self-service by KG owner) =====
app.put("/make-server-221a61bc/school/settings", async (c) => {
  try {
    const userTokenHeader = c.req.header('X-User-Token');
    const { error: authError, user } = await verifyToken(userTokenHeader);
    if (authError || !user) {
      return c.json({ error: `Unauthorized: ${authError || 'No user'}` }, 401);
    }

    const { error: schoolError, school } = await getSchoolForUser(user.id);
    if (schoolError || !school) {
      return c.json({ error: `School not found for user: ${schoolError || 'No school'}` }, 404);
    }

    const updates = await c.req.json();
    console.log(`[SCHOOL-SETTINGS] Saving settings for school ${school.id}:`, Object.keys(updates));

    // Whitelist of self-service editable fields
    const allowedFields = [
      'school_name', 'logo_url', 'primary_color',
      'email', 'phone', 'whatsapp_no', 'address',
    ];

    const merged = { ...school };
    for (const key of allowedFields) {
      if (updates[key] !== undefined) {
        merged[key] = updates[key];
      }
    }
    merged.updated_at = new Date().toISOString();

    const { error: updateError } = await supabaseAdmin.from('school_accounts').update(merged).eq('id', school.id);
    if (updateError) {
      console.error('[SCHOOL-SETTINGS] Update error:', updateError.message);
      return c.json({ error: `Failed to save settings: ${updateError.message}` }, 500);
    }

    console.log(`[SCHOOL-SETTINGS] School ${school.id} settings saved successfully`);
    return c.json({ success: true, school: merged });
  } catch (error) {
    console.error('[SCHOOL-SETTINGS] Save error:', error);
    return c.json({ error: `Failed to save settings: ${error.message}` }, 500);
  }
});

// ===== QUESTION BANK MANAGEMENT =====

// Save/Update question
app.post("/make-server-221a61bc/questions", async (c) => {
  try {
    const userTokenHeader = c.req.header('X-User-Token');
    const { error: authError, user } = await verifyToken(userTokenHeader);
    
    if (authError || !user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Get school for this user
    const { error: schoolError, school } = await getSchoolForUser(user.id);
    
    if (schoolError || !school) {
      return c.json({ error: 'No school found for user' }, 404);
    }

    const body = await c.req.json();
    const { questions } = body;

    if (!questions || !Array.isArray(questions)) {
      return c.json({ error: 'Questions array is required' }, 400);
    }

    console.log(`Saving ${questions.length} questions for school ${school.id}`);

    const savedQuestions = [];

    for (const q of questions) {
      const questionId = q.id || crypto.randomUUID();
      const questionData = {
        id: questionId,
        school_id: school.id,
        quest: q.quest,
        language: q.language || 'global',
        age_difficulty: q.ageDifficulty || 5,
        type: q.type,
        question_text: q.question,
        options: q.options,
        correct_answer: q.correctAnswer,
        foxy_message: q.foxyMessage,
        hotspot_image: q.hotspotImage || null,
        skills: q.skills || [],
        created_by: user.id,
        created_at: q.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      await supabaseAdmin.from('school_questions').upsert(questionData);
      
      savedQuestions.push(questionData);
    }

    console.log(`Successfully saved ${savedQuestions.length} questions`);

    return c.json({
      success: true,
      message: `${savedQuestions.length} questions saved`,
      questions: savedQuestions
    });
  } catch (error) {
    console.error('Save questions error:', error);
    return c.json({ error: `Failed to save questions: ${error.message}` }, 500);
  }
});

// Get all questions for a school
app.get("/make-server-221a61bc/questions", async (c) => {
  try {
    const userTokenHeader = c.req.header('X-User-Token');
    const { error: authError, user } = await verifyToken(userTokenHeader);
    
    if (authError || !user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Get school for this user
    const { error: schoolError, school } = await getSchoolForUser(user.id);
    
    if (schoolError || !school) {
      return c.json({ error: 'No school found for user' }, 404);
    }

    console.log(`Fetching questions for school ${school.id}`);

    // Get all questions for this school
    const { data: questions } = await supabaseAdmin.from('school_questions').select('*').eq('school_id', school.id).order('created_at', { ascending: false });
    const questionsArr = questions || [];

    // Transform to frontend format
    const transformedQuestions = questionsArr.map(q => ({
      id: q.id,
      type: q.type,
      quest: q.quest,
      language: q.language,
      ageDifficulty: q.age_difficulty,
      question: q.question_text,
      options: q.options,
      correctAnswer: q.correct_answer,
      foxyMessage: q.foxy_message,
      hotspotImage: q.hotspot_image,
      skills: q.skills || []
    }));

    // Already sorted by created_at desc from query

    console.log(`Returning ${transformedQuestions.length} questions`);

    return c.json({
      success: true,
      questions: transformedQuestions
    });
  } catch (error) {
    console.error('Get questions error:', error);
    return c.json({ error: `Failed to get questions: ${error.message}` }, 500);
  }
});

// Delete question
app.delete("/make-server-221a61bc/questions/:id", async (c) => {
  try {
    const userTokenHeader = c.req.header('X-User-Token');
    const { error: authError, user } = await verifyToken(userTokenHeader);
    
    if (authError || !user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Get school for this user
    const { error: schoolError, school } = await getSchoolForUser(user.id);
    
    if (schoolError || !school) {
      return c.json({ error: 'No school found for user' }, 404);
    }

    const questionId = c.req.param('id');

    console.log(`Deleting question ${questionId}`);

    await supabaseAdmin.from('school_questions').delete().eq('id', questionId).eq('school_id', school.id);

    return c.json({
      success: true,
      message: 'Question deleted'
    });
  } catch (error) {
    console.error('Delete question error:', error);
    return c.json({ error: `Failed to delete question: ${error.message}` }, 500);
  }
});

// ===== LEADS MANAGEMENT =====

// Lookup existing in-progress lead by phone+school (public — for session resume)
app.get("/make-server-221a61bc/leads/lookup", async (c) => {
  try {
    const phone = c.req.query('phone');
    const schoolId = c.req.query('schoolId');

    if (!phone || !schoolId) {
      return c.json({ error: 'Missing required query params: phone, schoolId' }, 400);
    }

    const normalizedPhone = phone.replace(/[\s\-]/g, '');

    console.log(`[LEAD-LOOKUP] Checking for existing lead: phone=${normalizedPhone}, school=${schoolId}`);

    const { data: leadData } = await supabaseAdmin.from('leads').select('*')
      .eq('school_id', schoolId).eq('whatsapp', normalizedPhone)
      .order('created_at', { ascending: false }).limit(1).single();

    if (!leadData) {
      console.log('[LEAD-LOOKUP] No existing lead found');
      return c.json({ success: true, found: false, lead: null });
    }

    // Only return resumable leads (in_progress with some completed modules)
    const completedModules = leadData.completed_modules || [];
    const isResumable = leadData.status === 'in_progress' && completedModules.length > 0;

    console.log(`[LEAD-LOOKUP] Found lead ${existingLeadId}: status=${leadData.status}, completed_modules=${completedModules.length}, resumable=${isResumable}`);

    return c.json({
      success: true,
      found: true,
      resumable: isResumable,
      lead: {
        id: leadData.id,
        child_name: leadData.child_name,
        parent_name: leadData.parent_name,
        whatsapp: leadData.whatsapp,
        child_age: leadData.child_age,
        include_mandarin_test: leadData.include_mandarin_test,
        status: leadData.status,
        score: leadData.score || 0,
        total_questions: leadData.total_questions || 0,
        answers: leadData.answers || [],
        quest_results: leadData.quest_results || [],
        age_performance: leadData.age_performance || [],
        completed_modules: completedModules,
        created_at: leadData.created_at,
        updated_at: leadData.updated_at,
      }
    });
  } catch (error) {
    console.error('[LEAD-LOOKUP] Error:', error);
    return c.json({ error: `Lead lookup failed: ${error.message}` }, 500);
  }
});

// Submit or upsert a lead (public endpoint - no auth required)
// Uses WhatsApp number as unique identifier per school
// If same phone+school exists, updates the existing lead with latest data
app.post("/make-server-221a61bc/leads", async (c) => {
  try {
    const body = await c.req.json();
    const { 
      schoolId, 
      childName, 
      parentName, 
      whatsapp, 
      childAge,
      includeMandarin,
      answers,
      score,
      totalQuestions,
      questResults,
      agePerformance,
      status,
      referralCode
    } = body;

    if (!schoolId || !childName || !parentName || !whatsapp) {
      return c.json({ error: "Missing required fields: schoolId, childName, parentName, whatsapp" }, 400);
    }

    // Verify the school exists
    const { data: schoolData } = await supabaseAdmin.from('school_accounts').select('id').eq('id', schoolId).limit(1).single();
    if (!schoolData) {
      console.error(`School not found: ${schoolId}`);
      return c.json({ error: "School not found. Please check the school ID." }, 404);
    }

    // Normalize phone number for lookup (strip spaces/dashes)
    const normalizedPhone = whatsapp.replace(/[\s\-]/g, '');

    // Check if a lead with this phone+school already exists
    const { data: existingLead } = await supabaseAdmin.from('leads').select('id, created_at')
      .eq('school_id', schoolId).eq('whatsapp', normalizedPhone).limit(1).single();

    let leadId: string;
    let isUpdate = false;

    if (existingLead) {
      leadId = existingLead.id;
      isUpdate = true;
      console.log(`Updating existing lead ${leadId} for phone ${normalizedPhone} at school ${schoolId}`);
    } else {
      leadId = crypto.randomUUID();
      console.log(`Creating new lead ${leadId} for phone ${normalizedPhone} at school ${schoolId}`);
    }

    const now = new Date().toISOString();
    const leadData: Record<string, any> = {
      id: leadId,
      school_id: schoolId,
      child_name: childName,
      parent_name: parentName,
      whatsapp,
      child_age: childAge || 5,
      include_mandarin_test: includeMandarin || false,
      answers: answers || [],
      score: score || 0,
      total_questions: totalQuestions || 0,
      quest_results: questResults || [],
      age_performance: agePerformance || [],
      status: status || 'in_progress',
      source: referralCode ? 'referral' : 'direct',
      referral_code_used: referralCode || null,
      referred_by_parent_id: null,
      created_at: isUpdate ? (existingLead?.created_at || now) : now,
      updated_at: now
    };

    // Resolve referral code → parent ID if provided (only on new leads)
    if (referralCode && !isUpdate) {
      try {
        const { data: referrerRow } = await supabaseAdmin.from('parents').select('id').eq('referral_code', referralCode).limit(1).single();
        if (referrerRow) {
          leadData.referred_by_parent_id = referrerRow.id;
          console.log(`[LEAD] Referral attributed: code=${referralCode} → parent=${referrerRow.id}`);
        } else {
          console.warn(`[LEAD] Referral code not found: ${referralCode}`);
        }
      } catch (refErr) {
        console.error(`[LEAD] Referral resolution failed:`, refErr);
      }
    }

    // Upsert into leads table
    if (isUpdate) {
      await supabaseAdmin.from('leads').update(leadData).eq('id', leadId);
    } else {
      await supabaseAdmin.from('leads').insert(leadData);
    }

    console.log(`Lead ${isUpdate ? 'updated' : 'created'} successfully: ${leadId}, status: ${leadData.status}, score: ${score}/${totalQuestions}`);

    return c.json({
      success: true,
      leadId: leadId,
      isUpdate: isUpdate,
      message: isUpdate ? "Lead updated successfully!" : "Lead created successfully!"
    });
  } catch (error) {
    console.error("Submit lead error:", error);
    return c.json({ error: `Failed to submit lead: ${error.message}` }, 500);
  }
});

// Update an existing lead (public endpoint - for module-by-module progress updates)
app.put("/make-server-221a61bc/leads/:id", async (c) => {
  try {
    const leadId = c.req.param('id');
    const body = await c.req.json();

    console.log(`Updating lead ${leadId} with fields:`, Object.keys(body));

    // Get existing lead
    const { data: existingLead } = await supabaseAdmin.from('leads').select('*').eq('id', leadId).limit(1).single();
    if (!existingLead) {
      console.error(`Lead not found for update: ${leadId}`);
      return c.json({ error: "Lead not found" }, 404);
    }

    // Merge updates (protect immutable fields)
    const updatedFields = { ...body, updated_at: new Date().toISOString() };
    delete updatedFields.id;
    delete updatedFields.school_id;
    delete updatedFields.created_at;

    await supabaseAdmin.from('leads').update(updatedFields).eq('id', leadId);

    console.log(`Lead ${leadId} updated. Status: ${updatedFields.status || existingLead.status}`);

    return c.json({
      success: true,
      leadId: leadId,
      message: "Lead updated successfully!"
    });
  } catch (error) {
    console.error("Update lead error:", error);
    return c.json({ error: `Failed to update lead: ${error.message}` }, 500);
  }
});

// Get leads for kindergarten (protected)
app.get("/make-server-221a61bc/leads", async (c) => {
  try {
    const userTokenHeader = c.req.header('X-User-Token');
    console.log('Get leads - X-User-Token:', userTokenHeader ? 'Present' : 'Missing');
    
    const { error: authError, user } = await verifyToken(userTokenHeader);
    
    if (authError || !user) {
      console.error('Auth verification failed:', authError);
      return c.json({ error: authError || 'Unauthorized', _debug: { step: 'auth_failed' } }, 401);
    }

    console.log('User authenticated:', user.id, user.email);

    // Get school for this user
    const { error: schoolError, school } = await getSchoolForUser(user.id);
    
    if (schoolError || !school) {
      console.error('School fetch failed:', schoolError);
      return c.json({ error: schoolError || 'No school found for user', _debug: { step: 'school_not_found', userId: user.id } }, 404);
    }

    console.log(`Fetching leads for school ${school.id} (${school.school_name})`);

    // Get all leads for this school from Postgres
    const { data: leads, error: leadsError } = await supabaseAdmin.from('leads').select('*')
      .eq('school_id', school.id).order('created_at', { ascending: false });

    if (leadsError) throw leadsError;

    console.log(`Returning ${(leads||[]).length} leads for school ${school.id}`);

    return c.json({
      success: true,
      leads: leads || [],
      _debug: {
        schoolId: school.id,
        schoolName: school.school_name,
        userId: user.id,
        userEmail: user.email,
        leadCount: (leads||[]).length,
      }
    });
  } catch (error) {
    console.error('Get leads error:', error);
    return c.json({ error: `Failed to get leads: ${error.message}`, _debug: { step: 'exception', message: error.message } }, 500);
  }
});

// Delete lead (for kindergarten admin)
app.delete("/make-server-221a61bc/leads/:id", async (c) => {
  try {
    const userTokenHeader = c.req.header('X-User-Token');
    const { error: authError, user } = await verifyToken(userTokenHeader);
    
    if (authError || !user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Get school for this user
    const { error: schoolError, school } = await getSchoolForUser(user.id);
    
    if (schoolError || !school) {
      return c.json({ error: 'No school found for user' }, 404);
    }

    const leadId = c.req.param('id');

    console.log(`Deleting lead ${leadId}`);

    await supabaseAdmin.from('leads').delete().eq('id', leadId).eq('school_id', school.id);

    return c.json({
      success: true,
      message: 'Lead deleted'
    });
  } catch (error) {
    console.error('Delete lead error:', error);
    return c.json({ error: `Failed to delete lead: ${error.message}` }, 500);
  }
});

// ===== GLOBAL QUESTION BANK (Static CSV Approach) =====
// Questions are stored globally (not per-school). Super Admin uploads CSV,
// frontend parses it, sends structured JSON array, server validates and stores.
// Child flow reads from here via public GET endpoint.
// KV key pattern: gq:{q_id}

// Upload / upsert questions (auth required)
app.post("/make-server-221a61bc/question-bank/upload", async (c) => {
  try {
    const userTokenHeader = c.req.header('X-User-Token');
    const { error: authError, user } = await verifyToken(userTokenHeader);
    if (authError || !user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const body = await c.req.json();
    const { questions } = body;

    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      return c.json({ error: 'Questions array is required and must not be empty' }, 400);
    }

    console.log(`[QUESTION-BANK] Uploading ${questions.length} questions by user ${user.id}`);

    // --- Auto-generate q_id: fetch existing questions to find max per subject-age ---
    const { data: existingQuestions } = await supabaseAdmin.from('questions').select('q_id');
    const existingQs = existingQuestions || [];
    const counterMap: Record<string, number> = {};
    for (const eq of existingQs) {
      if (!eq.q_id) continue;
      const parts = eq.q_id.split('-');
      if (parts.length >= 3) {
        const num = parseInt(parts[parts.length - 1], 10);
        const prefix = parts.slice(0, -1).join('-');
        if (!isNaN(num) && (!counterMap[prefix] || num > counterMap[prefix])) {
          counterMap[prefix] = num;
        }
      }
    }

    const errors: string[] = [];
    const validQuestions: any[] = [];

    // Build a subject abbreviation map
    const subjectAbbrev = (subject: string): string => {
      const map: Record<string, string> = {
        'english': 'ENG',
        'math': 'MATH',
        'mathematics': 'MATH',
        'bahasa melayu': 'BM',
        'science': 'SCI',
        'moral': 'MORAL',
        'pendidikan moral': 'MORAL',
        'chinese': 'ZH',
        'mandarin': 'ZH',
        'bahasa cina': 'ZH',
        'music': 'MUS',
        'art': 'ART',
        'seni': 'ART',
        'pendidikan seni visual': 'ART',
        'health': 'HLTH',
        'pendidikan kesihatan': 'HLTH',
        'physical education': 'PE',
        'pendidikan jasmani': 'PE',
      };
      return map[subject.toLowerCase()] || subject.toUpperCase().replace(/\s+/g, '').substring(0, 4);
    };

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const rowNum = i + 1;

      // Validate required fields (q_id is NO LONGER required — auto-generated)
      const parsedAge = parseAgeTarget(q.age_target);
      if (parsedAge === null) {
        errors.push(`Row ${rowNum}: age_target must be 4-12 or a KSSR label (e.g. "Prasekolah Thn 1", "Tahun 3")`); continue;
      }
      if (!q.subject) { errors.push(`Row ${rowNum}: Missing subject`); continue; }
      if (!q.question_text_en) { errors.push(`Row ${rowNum}: Missing question_text_en`); continue; }
      if (!q.question_text_ms) { errors.push(`Row ${rowNum}: Missing question_text_ms`); continue; }
      if (!q.input_type || !['mcq', 'sequence', 'hotspot'].includes(q.input_type)) {
        errors.push(`Row ${rowNum}: input_type must be mcq, sequence, or hotspot`); continue;
      }
      if (!q.correct_answer && q.correct_answer !== 0) {
        errors.push(`Row ${rowNum}: Missing correct_answer`); continue;
      }
      if (!q.options_en) { errors.push(`Row ${rowNum}: Missing options_en`); continue; }
      if (!q.options_ms) { errors.push(`Row ${rowNum}: Missing options_ms`); continue; }

      // Auto-generate q_id: {ABBREV}-{AGE}-{001}
      const age = parsedAge;
      const abbrev = subjectAbbrev(q.subject);
      const prefix = `${abbrev}-${age}`;
      const currentMax = counterMap[prefix] || 0;
      const nextNum = currentMax + 1;
      counterMap[prefix] = nextNum; // Increment for next question in same group
      const generatedId = `${prefix}-${String(nextNum).padStart(3, '0')}`;

      // Parse options per language — accept JSON string, pipe-delimited string, or array
      const parseOptions = (raw: any): any[] => {
        if (Array.isArray(raw)) return raw;
        if (typeof raw === 'string' && raw.trim()) {
          try {
            return JSON.parse(raw);
          } catch {
            return raw.split('|').map((text: string, idx: number) => ({
              id: String.fromCharCode(97 + idx),
              text: text.trim()
            }));
          }
        }
        return [];
      };

      const parsedOptionsEn = parseOptions(q.options_en);
      const parsedOptionsMs = parseOptions(q.options_ms);
      const parsedOptionsZh = parseOptions(q.options_zh || '');

      // Download header image to R2 if it's an external HTTPS URL (CSV import)
      let resolvedImageUrl = q.image_url || '';
      if (resolvedImageUrl && resolvedImageUrl.startsWith('https://') && !isR2Key(resolvedImageUrl)) {
        const r2Key = `mcq-header/${generatedId}`;
        const result = await downloadAndStoreToR2(resolvedImageUrl, r2Key, {
          maxBytes: 500 * 1024,
          allowedPrefixes: ['image/'],
        });
        if ('error' in result) {
          errors.push(`Row ${rowNum}, header image: ${result.error} (non-fatal)`);
        } else {
          resolvedImageUrl = result.r2Key;
        }
      }

      const questionData: any = {
        q_id: generatedId,
        age_target: age,
        subject: q.subject.trim(),
        dskp_code: (q.dskp_code || '').trim(),
        kssr_level: parseAgeTarget(q.kssr_level) ?? parseAgeTarget(q.age_target) ?? null,
        topic: (q.topic || '').trim(),
        skill_name: (q.skill_name || '').trim(),
        question_text_en: q.question_text_en.trim(),
        question_text_ms: q.question_text_ms.trim(),
        question_text_zh: (q.question_text_zh || '').trim(),
        input_type: q.input_type.trim(),
        options_en: parsedOptionsEn,
        options_ms: parsedOptionsMs,
        options_zh: parsedOptionsZh,
        correct_answer: String(q.correct_answer).trim(),
        visual_prompt: q.visual_prompt || '',
        image_url: resolvedImageUrl,
        uploaded_by: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      // Preserve answer_type if provided (e.g. 'mcq-image' from manual create)
      if (q.answer_type) questionData.answer_type = q.answer_type;
      // Download TTS audio files to R2 if external URLs, or preserve existing R2 keys
      for (const lang of ['en', 'ms', 'zh'] as const) {
        const ttsVal = q[`tts_${lang}`] || '';
        if (!ttsVal) continue;
        if (ttsVal.startsWith('r2:')) {
          questionData[`tts_${lang}`] = ttsVal;
        } else if (ttsVal.startsWith('https://')) {
          const r2Key = `mcq-tts/${generatedId}/${lang}`;
          const result = await downloadAndStoreToR2(ttsVal, r2Key, {
            maxBytes: 2 * 1024 * 1024,
            allowedPrefixes: ['audio/'],
          });
          if ('error' in result) {
            errors.push(`Row ${rowNum}, TTS ${lang}: ${result.error} (non-fatal)`);
            // Fallback: store the original URL so TTS can still play from external source
            questionData[`tts_${lang}`] = ttsVal;
          } else {
            questionData[`tts_${lang}`] = result.r2Key;
          }
        } else {
          questionData[`tts_${lang}`] = ttsVal;
        }
      }

      validQuestions.push(questionData);
    }

    if (errors.length > 0 && validQuestions.length === 0) {
      return c.json({ success: false, error: 'All rows had validation errors', errors }, 400);
    }

    // Store questions in Postgres (resilient — auto-strips missing columns)
    let actuallyStored = 0;
    if (validQuestions.length > 0) {
      const { error: insertError, data: insertData, strippedColumns } = await resilientUpsert('questions', validQuestions, { onConflict: 'q_id' });
      if (insertError) {
        console.error('[QUESTION-BANK] Upsert error:', insertError.message, insertError.details, insertError.hint);
        errors.push(`Database upsert failed: ${insertError.message}${insertError.details ? ` — ${insertError.details}` : ''}${insertError.hint ? ` (hint: ${insertError.hint})` : ''}`);
        actuallyStored = 0;
      } else {
        actuallyStored = insertData?.length || validQuestions.length;
        if (strippedColumns.length > 0) {
          errors.push(`Warning: columns [${strippedColumns.join(', ')}] missing from questions table — data for these fields was not saved. Add them via Supabase Dashboard.`);
        }
      }
    }

    console.log(`[QUESTION-BANK] Stored ${actuallyStored}/${validQuestions.length} questions, ${errors.length} errors`);

    return c.json({
      success: actuallyStored > 0,
      stored: actuallyStored,
      created_ids: actuallyStored > 0 ? validQuestions.map(q => q.q_id) : [],
      errors,
      message: actuallyStored > 0
        ? `${actuallyStored} questions stored${errors.length > 0 ? `, ${errors.length} rows had errors` : ''}`
        : `No questions stored. ${errors.length} errors: ${errors.join('; ')}`
    });
  } catch (error) {
    console.error('[QUESTION-BANK] Upload error:', error);
    return c.json({ error: `Upload failed: ${error.message}` }, 500);
  }
});

// ===== MCQ-IMAGE UPLOAD =====
app.post("/make-server-221a61bc/question-bank/upload-mcq-image", async (c) => {
  try {
    const userTokenHeader = c.req.header('X-User-Token');
    const { error: authError, user } = await verifyToken(userTokenHeader);
    if (authError || !user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const body = await c.req.json();
    const { questions } = body;

    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      return c.json({ error: 'Questions array is required and must not be empty' }, 400);
    }

    console.log(`[MCQ-IMAGE] Uploading ${questions.length} image-MCQ questions by user ${user.id}`);

    // Fetch existing questions for auto-ID generation
    const { data: existingQuestions } = await supabaseAdmin.from('questions').select('q_id');
    const existingQs2 = existingQuestions || [];
    const counterMap: Record<string, number> = {};
    for (const eq of existingQs2) {
      if (!eq.q_id) continue;
      const parts = eq.q_id.split('-');
      if (parts.length >= 3) {
        const num = parseInt(parts[parts.length - 1], 10);
        const prefix = parts.slice(0, -1).join('-');
        if (!isNaN(num) && (!counterMap[prefix] || num > counterMap[prefix])) {
          counterMap[prefix] = num;
        }
      }
    }

    const subjectAbbrev = (subject: string): string => {
      const map: Record<string, string> = {
        'english': 'ENG', 'math': 'MATH', 'mathematics': 'MATH',
        'bahasa melayu': 'BM', 'science': 'SCI', 'moral': 'MORAL',
        'pendidikan moral': 'MORAL', 'chinese': 'ZH', 'mandarin': 'ZH',
        'bahasa cina': 'ZH', 'music': 'MUS', 'art': 'ART',
        'seni': 'ART', 'pendidikan seni visual': 'ART',
        'health': 'HLTH', 'pendidikan kesihatan': 'HLTH',
        'physical education': 'PE', 'pendidikan jasmani': 'PE',
      };
      return map[subject.toLowerCase()] || subject.toUpperCase().replace(/\s+/g, '').substring(0, 4);
    };

    const errors: string[] = [];
    const validQuestions: any[] = [];
    let assetsProcessed = 0;

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const rowNum = i + 1;

      // Validate required fields
      const parsedAge2 = parseAgeTarget(q.age_target);
      if (parsedAge2 === null) {
        errors.push(`Row ${rowNum}: age_target must be 4-12 or a KSSR label (e.g. "Prasekolah Thn 1", "Tahun 3")`); continue;
      }
      if (!q.subject) { errors.push(`Row ${rowNum}: Missing subject`); continue; }
      if (!q.question_text_en) { errors.push(`Row ${rowNum}: Missing question_text_en`); continue; }
      if (!q.question_text_ms) { errors.push(`Row ${rowNum}: Missing question_text_ms`); continue; }
      if (!q.correct_answer && q.correct_answer !== 0) {
        errors.push(`Row ${rowNum}: Missing correct_answer`); continue;
      }

      // Validate all 4 image URLs present
      const imageUrls = [q.option_a_image_url, q.option_b_image_url, q.option_c_image_url, q.option_d_image_url];
      const missingImages = ['a', 'b', 'c', 'd'].filter((_, idx) => !imageUrls[idx]?.trim());
      if (missingImages.length > 0) {
        errors.push(`Row ${rowNum}: Missing image URL(s) for option(s) ${missingImages.join(', ')}`); continue;
      }

      // Validate URLs are HTTPS
      const invalidUrls = imageUrls.filter(url => url && !url.trim().startsWith('https://'));
      if (invalidUrls.length > 0) {
        errors.push(`Row ${rowNum}: Image URLs must start with https://`); continue;
      }

      // Auto-generate q_id
      const age = parsedAge2;
      const abbrev = subjectAbbrev(q.subject);
      const prefix = `${abbrev}-${age}`;
      const currentMax = counterMap[prefix] || 0;
      const nextNum = currentMax + 1;
      counterMap[prefix] = nextNum;
      const generatedId = `${prefix}-${String(nextNum).padStart(3, '0')}`;

      console.log(`[MCQ-IMAGE] Processing row ${rowNum}/${questions.length}: ${generatedId}`);

      // Download and store all 4 answer option images → R2
      const optionIds = ['a', 'b', 'c', 'd'];
      const imagePaths: Record<string, string> = {};
      let rowHasError = false;

      for (let j = 0; j < 4; j++) {
        const url = imageUrls[j].trim();
        const r2Key = `mcq-img/${generatedId}/${optionIds[j]}`;
        const result = await downloadAndStoreToR2(url, r2Key, {
          maxBytes: 500 * 1024,
          allowedPrefixes: ['image/'],
        });
        assetsProcessed++;
        if ('error' in result) {
          errors.push(`Row ${rowNum}, option ${optionIds[j]}: ${result.error}`);
          rowHasError = true;
          break;
        }
        imagePaths[optionIds[j]] = result.r2Key; // e.g. "r2:mcq-img/ENG-4-001/a"
      }

      if (rowHasError) continue;

      // Download header image → R2 (optional)
      let headerImageKey = '';
      if (q.image_url?.trim() && q.image_url.trim().startsWith('https://')) {
        const r2Key = `mcq-header/${generatedId}`;
        const result = await downloadAndStoreToR2(q.image_url.trim(), r2Key, {
          maxBytes: 500 * 1024,
          allowedPrefixes: ['image/'],
        });
        assetsProcessed++;
        if ('error' in result) {
          errors.push(`Row ${rowNum}, header image: ${result.error} (non-fatal)`);
        } else {
          headerImageKey = result.r2Key;
        }
      }

      // Download TTS audio files → R2 (optional, up to 3 languages)
      const ttsKeys: Record<string, string> = {};
      for (const lang of ['en', 'ms', 'zh'] as const) {
        const ttsUrl = (q[`TTS_${lang}`] || q[`tts_${lang}`] || '').trim();
        if (ttsUrl && ttsUrl.startsWith('https://')) {
          const r2Key = `mcq-tts/${generatedId}/${lang}`;
          const result = await downloadAndStoreToR2(ttsUrl, r2Key, {
            maxBytes: 2 * 1024 * 1024, // 2MB for audio
            allowedPrefixes: ['audio/'],
          });
          assetsProcessed++;
          if ('error' in result) {
            errors.push(`Row ${rowNum}, TTS ${lang}: ${result.error} (non-fatal)`);
            // Fallback: store the original URL so TTS can still play from external source
            ttsKeys[lang] = ttsUrl;
          } else {
            ttsKeys[lang] = result.r2Key;
          }
        }
      }

      // Build options arrays with R2 keys (same images for all languages)
      const buildOptions = (labels?: string[]) => {
        return optionIds.map((id, idx) => ({
          id,
          text: labels?.[idx]?.trim() || '',
          image: imagePaths[id], // r2: prefixed key
        }));
      };

      // Parse optional labels (pipe-delimited)
      const parseLabels = (raw: string | undefined): string[] | undefined => {
        if (!raw || !raw.trim()) return undefined;
        return raw.split('|').map(l => l.trim());
      };

      const labelsEn = parseLabels(q.option_labels_en);
      const labelsMs = parseLabels(q.option_labels_ms);
      const labelsZh = parseLabels(q.option_labels_zh);

      const questionData: any = {
        q_id: generatedId,
        age_target: age,
        subject: q.subject.trim(),
        dskp_code: (q.dskp_code || '').trim(),
        kssr_level: parseAgeTarget(q.kssr_level) ?? parseAgeTarget(q.age_target) ?? null,
        topic: (q.topic || '').trim(),
        skill_name: (q.skill_name || '').trim(),
        question_text_en: q.question_text_en.trim(),
        question_text_ms: q.question_text_ms.trim(),
        question_text_zh: (q.question_text_zh || '').trim(),
        input_type: 'mcq',
        answer_type: 'mcq-image',
        options_en: buildOptions(labelsEn),
        options_ms: buildOptions(labelsMs),
        options_zh: buildOptions(labelsZh),
        correct_answer: String(q.correct_answer).trim(),
        visual_prompt: q.visual_prompt || '',
        image_url: headerImageKey, // r2: key or ''
        uploaded_by: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Add TTS keys if any were downloaded
      if (ttsKeys.en) questionData.tts_en = ttsKeys.en;
      if (ttsKeys.ms) questionData.tts_ms = ttsKeys.ms;
      if (ttsKeys.zh) questionData.tts_zh = ttsKeys.zh;

      validQuestions.push(questionData);
      console.log(`[MCQ-IMAGE] Row ${rowNum} OK: ${generatedId}, assets stored to R2`);
    }

    if (errors.length > 0 && validQuestions.length === 0) {
      return c.json({ success: false, error: 'All rows had errors', errors }, 400);
    }

    // Store questions in Postgres (resilient — auto-strips missing columns)
    let actuallyStored = 0;
    if (validQuestions.length > 0) {
      const { error: insertErr, data: insertData, strippedColumns } = await resilientUpsert('questions', validQuestions, { onConflict: 'q_id' });
      if (insertErr) {
        console.error('[MCQ-IMAGE] Upsert error:', insertErr.message, insertErr.details, insertErr.hint);
        errors.push(`Database upsert failed: ${insertErr.message}${insertErr.details ? ` — ${insertErr.details}` : ''}${insertErr.hint ? ` (hint: ${insertErr.hint})` : ''}`);
        actuallyStored = 0;
      } else {
        actuallyStored = insertData?.length || validQuestions.length;
        if (strippedColumns.length > 0) {
          errors.push(`Warning: columns [${strippedColumns.join(', ')}] missing from questions table — data for these fields was not saved. Add them via Supabase Dashboard.`);
        }
      }
    }

    console.log(`[MCQ-IMAGE] Stored ${actuallyStored}/${validQuestions.length} questions (${assetsProcessed} assets to R2), ${errors.length} errors`);

    return c.json({
      success: actuallyStored > 0,
      stored: actuallyStored,
      assetsProcessed,
      errors,
      message: actuallyStored > 0
        ? `${actuallyStored} image-MCQ questions stored (${assetsProcessed} assets → R2)${errors.length > 0 ? `, ${errors.length} warnings/errors` : ''}`
        : `No questions stored. ${errors.length} errors: ${errors.join('; ')}`
    });
  } catch (error) {
    console.error('[MCQ-IMAGE] Upload error:', error);
    return c.json({ error: `MCQ-image upload failed: ${error.message}` }, 500);
  }
});

// Clear all global questions (auth required) — POST for safety
app.post("/make-server-221a61bc/question-bank/clear-all", async (c) => {
  try {
    const userTokenHeader = c.req.header('X-User-Token');
    const { error: authError, user } = await verifyToken(userTokenHeader);
    if (authError || !user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    console.log(`[QUESTION-BANK] Clearing ALL questions, requested by user ${user.id}`);

    const { count, error: delError } = await supabaseAdmin.from('questions').delete().neq('q_id', '').select('*', { count: 'exact', head: true });
    if (delError) throw delError;

    console.log(`[QUESTION-BANK] Cleared ${count || 0} questions`);
    return c.json({ success: true, deleted: count || 0 });
  } catch (error) {
    console.error('[QUESTION-BANK] Clear all error:', error);
    return c.json({ error: `Failed to clear questions: ${error.message}` }, 500);
  }
});

// Get question bank stats — subjects with counts per age (public)
app.get("/make-server-221a61bc/question-bank/stats", async (c) => {
  try {
    const { data: allQuestions } = await supabaseAdmin.from('questions').select('subject, age_target');
    const qs = allQuestions || [];

    const subjectMap: Record<string, { count: number; ages: Record<number, number> }> = {};

    for (const q of qs) {
      const subj = q.subject || 'Unknown';
      if (!subjectMap[subj]) {
        subjectMap[subj] = { count: 0, ages: { 4: 0, 5: 0, 6: 0, 7: 0 } };
      }
      subjectMap[subj].count++;
      const age = Number(q.age_target);
      if (subjectMap[subj].ages[age] !== undefined) {
        subjectMap[subj].ages[age]++;
      }
    }

    const subjects = Object.entries(subjectMap).map(([name, data]) => ({
      name,
      count: data.count,
      ages: data.ages
    }));

    console.log(`[QUESTION-BANK] Stats: ${subjects.length} subjects, ${qs.length} total questions`);

    return c.json({
      success: true,
      subjects,
      totalQuestions: qs.length
    });
  } catch (error) {
    console.error('[QUESTION-BANK] Stats error:', error);
    return c.json({ error: `Failed to get stats: ${error.message}` }, 500);
  }
});

// Get questions from bank (public — for child flow + admin panel)
// Optional query params: ?subject=English&age_target=5&page=1&limit=50&search=abc
// page=0 or omitted = return ALL (legacy mode for child assessment flow)
// page>=1 = paginated mode (admin panel) — only resolves URLs for the current slice
app.get("/make-server-221a61bc/question-bank", async (c) => {
  try {
    const subject = c.req.query('subject');
    const ageTarget = c.req.query('age_target');
    const search = c.req.query('search');
    const page = parseInt(c.req.query('page') || '0', 10);
    const limit = Math.min(200, Math.max(1, parseInt(c.req.query('limit') || '50', 10)));

    console.log(`[QUESTION-BANK] Fetching: subject=${subject || 'all'}, age=${ageTarget || 'all'}, search=${search || 'none'}, page=${page}, limit=${limit}`);

    const { data: allQuestionsRaw } = await supabaseAdmin.from('questions').select('*');
    let filtered = (allQuestionsRaw || []);

    if (subject) {
      filtered = filtered.filter((q: any) => q.subject?.toLowerCase() === subject.toLowerCase());
    }
    if (ageTarget) {
      filtered = filtered.filter((q: any) => String(q.age_target) === ageTarget);
    }
    if (search) {
      const s = search.toLowerCase();
      filtered = filtered.filter((q: any) =>
        (q.q_id && q.q_id.toLowerCase().includes(s)) ||
        (q.question_text_en && q.question_text_en.toLowerCase().includes(s)) ||
        (q.subject && q.subject.toLowerCase().includes(s)) ||
        (q.dskp_code && q.dskp_code.toLowerCase().includes(s))
      );
    }

    // Sort consistently: by subject then age then q_id
    filtered.sort((a: any, b: any) => {
      const subjCmp = (a.subject || '').localeCompare(b.subject || '');
      if (subjCmp !== 0) return subjCmp;
      const ageCmp = (a.age_target || 0) - (b.age_target || 0);
      if (ageCmp !== 0) return ageCmp;
      return (a.q_id || '').localeCompare(b.q_id || '');
    });

    const totalFiltered = filtered.length;

    // Paginate: only resolve URLs for the current page slice (huge perf win at scale)
    let pageSlice: any[];
    let totalPages: number;
    let currentPage: number;
    if (page > 0) {
      currentPage = Math.max(1, page);
      totalPages = Math.max(1, Math.ceil(totalFiltered / limit));
      const start = (currentPage - 1) * limit;
      pageSlice = filtered.slice(start, start + limit);
    } else {
      // Legacy: return everything (child assessment flow needs all for a subject)
      pageSlice = filtered;
      totalPages = 1;
      currentPage = 1;
    }

    // Resolve storage paths to signed URLs — ONLY for the page slice (not entire dataset)
    const resolvedQuestions = await Promise.all(pageSlice.map(async (q: any) => {
      const resolved = { ...q };

      // Resolve question image_url: R2 keys → public URL, legacy Supabase paths → signed URL
      if (q.image_url && !q.image_url.startsWith('http')) {
        if (isR2Key(q.image_url)) {
          resolved.image_url = r2PublicUrl(extractR2Key(q.image_url));
        } else {
          try {
            const { data: urlData } = await supabaseAdmin.storage
              .from(QUEST_IMAGE_BUCKET)
              .createSignedUrl(q.image_url, 3600);
            resolved.image_url = urlData?.signedUrl || q.image_url;
          } catch {}
        }
      }

      // Resolve answer images for mcq-image type questions
      if (q.answer_type === 'mcq-image') {
        const resolveOptionsImages = async (options: any[]): Promise<any[]> => {
          if (!Array.isArray(options)) return options;
          return Promise.all(options.map(async (opt: any) => {
            if (opt.image && !opt.image.startsWith('http')) {
              if (isR2Key(opt.image)) {
                return { ...opt, image_path: opt.image, image: r2PublicUrl(extractR2Key(opt.image)) };
              }
              try {
                const { data } = await supabaseAdmin.storage
                  .from(ANSWER_IMAGE_BUCKET)
                  .createSignedUrl(opt.image, 3600);
                return { ...opt, image_path: opt.image, image: data?.signedUrl || opt.image };
              } catch {
                return { ...opt, image_path: opt.image };
              }
            }
            return opt;
          }));
        };
        if (resolved.options_en) resolved.options_en = await resolveOptionsImages(resolved.options_en);
        if (resolved.options_ms) resolved.options_ms = await resolveOptionsImages(resolved.options_ms);
        if (resolved.options_zh) resolved.options_zh = await resolveOptionsImages(resolved.options_zh);
      }

      // Resolve TTS audio: R2 keys → public URLs
      for (const lang of ['en', 'ms', 'zh']) {
        const ttsField = `tts_${lang}`;
        if (q[ttsField] && !q[ttsField].startsWith('http')) {
          if (isR2Key(q[ttsField])) {
            resolved[ttsField] = r2PublicUrl(extractR2Key(q[ttsField]));
          }
        }
      }

      return resolved;
    }));

    console.log(`[QUESTION-BANK] Returning ${resolvedQuestions.length} of ${totalFiltered} filtered (${allQuestionsRaw?.length || 0} total in PG)`);

    return c.json({
      success: true,
      questions: resolvedQuestions,
      total: totalFiltered,
      page: currentPage,
      limit,
      totalPages,
    });
  } catch (error) {
    console.error('[QUESTION-BANK] Fetch error:', error);
    return c.json({ error: `Failed to fetch questions: ${error.message}` }, 500);
  }
});

// Delete single question (auth required)
app.delete("/make-server-221a61bc/question-bank/:q_id", async (c) => {
  try {
    const userTokenHeader = c.req.header('X-User-Token');
    const { error: authError, user } = await verifyToken(userTokenHeader);
    if (authError || !user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const qId = c.req.param('q_id');
    console.log(`[QUESTION-BANK] Deleting question: ${qId}`);

    await supabaseAdmin.from('questions').delete().eq('q_id', qId);

    return c.json({ success: true, message: `Question ${qId} deleted` });
  } catch (error) {
    console.error('[QUESTION-BANK] Delete error:', error);
    return c.json({ error: `Failed to delete question: ${error.message}` }, 500);
  }
});

// Update single question (auth required)
app.put("/make-server-221a61bc/question-bank/:q_id", async (c) => {
  try {
    const userTokenHeader = c.req.header('X-User-Token');
    const { error: authError, user } = await verifyToken(userTokenHeader);
    if (authError || !user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const qId = c.req.param('q_id');
    const updates = await c.req.json();

    console.log(`[QUESTION-BANK] Updating question: ${qId} by user ${user.id}`);

    // Fetch existing question
    const { data: existing } = await supabaseAdmin.from('questions').select('*').eq('q_id', qId).limit(1).single();
    if (!existing) {
      return c.json({ error: `Question ${qId} not found` }, 404);
    }

    // Parse options if provided as pipe-delimited strings
    const parseOptions = (raw: any): any[] => {
      if (Array.isArray(raw)) return raw;
      if (typeof raw === 'string' && raw.trim()) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) return parsed;
        } catch {
          // pipe-delimited
        }
        return raw.split('|').map((text: string, idx: number) => ({
          id: String.fromCharCode(97 + idx),
          text: text.trim()
        }));
      }
      return [];
    };

    // Merge updates into existing question
    const updated = { ...existing };

    if (updates.question_text_en !== undefined) updated.question_text_en = updates.question_text_en.trim();
    if (updates.question_text_ms !== undefined) updated.question_text_ms = updates.question_text_ms.trim();
    if (updates.question_text_zh !== undefined) updated.question_text_zh = (updates.question_text_zh || '').trim();
    if (updates.age_target !== undefined) {
      const age = parseAgeTarget(updates.age_target);
      if (age === null) {
        return c.json({ error: 'age_target must be 4-12 or a KSSR label (e.g. "Prasekolah Thn 1")' }, 400);
      }
      updated.age_target = age;
    }
    if (updates.subject !== undefined) updated.subject = updates.subject.trim();
    if (updates.dskp_code !== undefined) updated.dskp_code = (updates.dskp_code || '').trim();
    if (updates.kssr_level !== undefined) updated.kssr_level = parseAgeTarget(updates.kssr_level) ?? parseAgeTarget(updates.age_target) ?? null;
    if (updates.topic !== undefined) updated.topic = (updates.topic || '').trim();
    if (updates.skill_name !== undefined) updated.skill_name = (updates.skill_name || '').trim();
    if (updates.input_type !== undefined) {
      if (!['mcq'].includes(updates.input_type)) {
        return c.json({ error: 'input_type must be mcq' }, 400);
      }
      updated.input_type = updates.input_type;
    }
    if (updates.correct_answer !== undefined) updated.correct_answer = String(updates.correct_answer).trim();
    if (updates.visual_prompt !== undefined) updated.visual_prompt = updates.visual_prompt || '';
    if (updates.image_url !== undefined) updated.image_url = updates.image_url || '';
    if (updates.options_en !== undefined) updated.options_en = parseOptions(updates.options_en);
    if (updates.options_ms !== undefined) updated.options_ms = parseOptions(updates.options_ms);
    if (updates.options_zh !== undefined) updated.options_zh = parseOptions(updates.options_zh);

    // Preserve TTS fields
    if (updates.tts_en !== undefined) updated.tts_en = updates.tts_en || '';
    if (updates.tts_ms !== undefined) updated.tts_ms = updates.tts_ms || '';
    if (updates.tts_zh !== undefined) updated.tts_zh = updates.tts_zh || '';

    updated.updated_at = new Date().toISOString();

    await supabaseAdmin.from('questions').update(updated).eq('q_id', qId);

    console.log(`[QUESTION-BANK] Updated question ${qId} successfully`);
    return c.json({ success: true, question: updated });
  } catch (error) {
    console.error('[QUESTION-BANK] Update error:', error);
    return c.json({ error: `Failed to update question: ${error.message}` }, 500);
  }
});

// ===== QUEST CONFIGURATION =====
// Quests define what cards appear in the child flow.
// Each quest is linked to a subject from the question bank.
// Only "live" quests appear as playable cards.
// KV key pattern: quest_config:{id}

// Create quest (auth required)
app.post("/make-server-221a61bc/quests", async (c) => {
  try {
    const userTokenHeader = c.req.header('X-User-Token');
    const { error: authError, user } = await verifyToken(userTokenHeader);
    if (authError || !user) {
      console.error('[QUESTS] Auth failed on create:', authError);
      return c.json({ error: `Unauthorized: ${authError || 'No user'}` }, 401);
    }

    const body = await c.req.json();
    const { subject, name, status, question_count, icon, conditional_key, image_path, is_mandarin } = body;

    if (!subject || !name) {
      return c.json({ error: 'subject and name are required' }, 400);
    }

    const questId = crypto.randomUUID();
    const questData = {
      id: questId,
      subject: subject.trim(),
      name: typeof name === 'string' ? { en: name, ms: name, zh: name } : name,
      status: status || 'draft',
      question_count: Number(question_count) || 10,
      icon: icon || '📚',
      is_mandarin: !!is_mandarin,
      conditional_key: conditional_key || null,
      image_path: image_path || null,
      created_by: user.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    await supabaseAdmin.from('quest_configs').upsert(questData);

    console.log(`[QUESTS] Created: ${questId} — ${subject} (${questData.status})`);

    return c.json({ success: true, quest: questData });
  } catch (error) {
    console.error('[QUESTS] Create error:', error);
    return c.json({ error: `Failed to create quest: ${error.message}` }, 500);
  }
});

// Get live quests only (public — for child flow)
// IMPORTANT: This route MUST be defined before GET /quests/:id (if any)
app.get("/make-server-221a61bc/quests/live", async (c) => {
  try {
    const { data: allQuests_ } = await supabaseAdmin.from('quest_configs').select('*');
    const allQuests = allQuests_ || [];
    const liveQuests = allQuests
      .filter((q: any) => q.status === 'live')
      .sort((a: any, b: any) => (a.created_at || '').localeCompare(b.created_at || ''));

    // Resolve image URLs server-side
    // R2 paths (r2:quest-images/...) → public URL (never expires)
    // Legacy Supabase paths → signed URL (24h TTL, backward compat)
    const resolvedQuests = await Promise.all(
      liveQuests.map(async (q: any) => {
        if (!q.image_path) return q;
        try {
          if (isR2Key(q.image_path)) {
            // R2 — permanent public URL
            const publicUrl = r2PublicUrl(extractR2Key(q.image_path));
            return { ...q, signed_image_url: publicUrl };
          } else {
            // Legacy Supabase Storage — signed URL
            const { data } = await supabaseAdmin.storage
              .from(QUEST_IMAGE_BUCKET)
              .createSignedUrl(q.image_path, 86400);
            return { ...q, signed_image_url: data?.signedUrl || null };
          }
        } catch (err) {
          console.error(`[QUESTS] Image resolve failed for "${q.subject}":`, err);
          return { ...q, signed_image_url: null };
        }
      })
    );

    console.log(`[QUESTS] Returning ${resolvedQuests.length} live quests with image URLs (${allQuests.length} total)`);
    resolvedQuests.forEach((q: any) => {
      console.log(`[QUESTS]   → "${q.subject}" (${q.id}): image_path=${q.image_path || 'NONE'}, url=${q.signed_image_url ? 'YES' : 'NO'}`);
    });

    return c.json({ success: true, quests: resolvedQuests });
  } catch (error) {
    console.error('[QUESTS] Fetch live error:', error);
    return c.json({ error: `Failed to fetch live quests: ${error.message}` }, 500);
  }
});

// Get all quests (auth required — admin view)
app.get("/make-server-221a61bc/quests", async (c) => {
  try {
    const userTokenHeader = c.req.header('X-User-Token');
    const { error: authError, user } = await verifyToken(userTokenHeader);
    if (authError || !user) {
      console.error('[QUESTS] Auth failed on fetch:', authError);
      return c.json({ error: `Unauthorized: ${authError || 'No user'}` }, 401);
    }

    const { data: quests_ } = await supabaseAdmin.from('quest_configs').select('*');
    const quests = quests_ || [];
    quests.sort((a: any, b: any) => (a.created_at || '').localeCompare(b.created_at || ''));

    // Resolve image URLs: R2 → public URL, legacy Supabase → signed URL
    const resolvedQuests = await Promise.all(
      quests.map(async (q: any) => {
        if (!q.image_path) return q;
        try {
          if (isR2Key(q.image_path)) {
            return { ...q, signed_image_url: r2PublicUrl(extractR2Key(q.image_path)) };
          } else {
            const { data } = await supabaseAdmin.storage
              .from(QUEST_IMAGE_BUCKET)
              .createSignedUrl(q.image_path, 86400);
            return { ...q, signed_image_url: data?.signedUrl || null };
          }
        } catch {
          return { ...q, signed_image_url: null };
        }
      })
    );

    console.log(`[QUESTS] Returning all ${resolvedQuests.length} quests with image URLs (admin)`);

    return c.json({ success: true, quests: resolvedQuests });
  } catch (error) {
    console.error('[QUESTS] Fetch error:', error);
    return c.json({ error: `Failed to fetch quests: ${error.message}` }, 500);
  }
});

// Update quest (auth required)
app.put("/make-server-221a61bc/quests/:id", async (c) => {
  try {
    const userTokenHeader = c.req.header('X-User-Token');
    const { error: authError, user } = await verifyToken(userTokenHeader);
    if (authError || !user) {
      console.error('[QUESTS] Auth failed on update:', authError);
      return c.json({ error: `Unauthorized: ${authError || 'No user'}` }, 401);
    }

    const questId = c.req.param('id');
    const body = await c.req.json();

    const { data: existing } = await supabaseAdmin.from('quest_configs').select('*').eq('id', questId).limit(1).single();
    if (!existing) {
      return c.json({ error: 'Quest not found' }, 404);
    }

    // Handle name field — accept string or multilingual object
    if (body.name && typeof body.name === 'string') {
      body.name = { en: body.name, ms: body.name, zh: body.name };
    }

    // If image_path changed, delete old image from storage
    if (body.image_path && existing.image_path && body.image_path !== existing.image_path) {
      try {
        if (isR2Key(existing.image_path)) {
          await deleteFromR2(extractR2Key(existing.image_path));
          console.log(`[QUESTS] Deleted old R2 image on update: ${existing.image_path}`);
        } else {
          await supabaseAdmin.storage.from(QUEST_IMAGE_BUCKET).remove([existing.image_path]);
          console.log(`[QUESTS] Deleted old Supabase image on update: ${existing.image_path}`);
        }
      } catch (imgErr) {
        console.error(`[QUESTS] Failed to delete old image on update: ${imgErr}`);
      }
    }

    const updated = {
      ...existing,
      ...body,
      id: questId,
      created_at: existing.created_at,
      created_by: existing.created_by,
      updated_at: new Date().toISOString()
    };

    await supabaseAdmin.from('quest_configs').update(updated).eq('id', questId);

    console.log(`[QUESTS] Updated ${questId}: status=${updated.status}, image_path=${updated.image_path || 'none'}`);

    return c.json({ success: true, quest: updated });
  } catch (error) {
    console.error('[QUESTS] Update error:', error);
    return c.json({ error: `Failed to update quest: ${error.message}` }, 500);
  }
});

// Delete quest (auth required)
app.delete("/make-server-221a61bc/quests/:id", async (c) => {
  try {
    const userTokenHeader = c.req.header('X-User-Token');
    const { error: authError, user } = await verifyToken(userTokenHeader);
    if (authError || !user) {
      console.error('[QUESTS] Auth failed on delete:', authError);
      return c.json({ error: `Unauthorized: ${authError || 'No user'}` }, 401);
    }

    const questId = c.req.param('id');
    console.log(`[QUESTS] Deleting quest: ${questId}`);

    // Also delete the quest image from storage if it exists
    const { data: existing } = await supabaseAdmin.from('quest_configs').select('*').eq('id', questId).limit(1).single();
    if (existing?.image_path) {
      try {
        if (isR2Key(existing.image_path)) {
          await deleteFromR2(extractR2Key(existing.image_path));
          console.log(`[QUESTS] Deleted R2 image: ${existing.image_path}`);
        } else {
          await supabaseAdmin.storage.from(QUEST_IMAGE_BUCKET).remove([existing.image_path]);
          console.log(`[QUESTS] Deleted Supabase image: ${existing.image_path}`);
        }
      } catch (imgErr) {
        console.error(`[QUESTS] Failed to delete image: ${imgErr}`);
      }
    }

    await supabaseAdmin.from('quest_configs').delete().eq('id', questId);

    return c.json({ success: true, message: `Quest ${questId} deleted` });
  } catch (error) {
    console.error('[QUESTS] Delete error:', error);
    return c.json({ error: `Failed to delete quest: ${error.message}` }, 500);
  }
});

// ===== QUEST IMAGE UPLOAD =====
// Upload quest card image to Cloudflare R2 (auth required)
// Accepts base64 image data in JSON body
// Stores as r2:quest-images/uuid.ext — public URL, no signed URLs needed
app.post("/make-server-221a61bc/quest-image", async (c) => {
  try {
    const userTokenHeader = c.req.header('X-User-Token');
    const { error: authError, user } = await verifyToken(userTokenHeader);
    if (authError || !user) {
      console.error('[QUEST-IMAGE] Auth failed on upload:', authError);
      return c.json({ error: `Unauthorized: ${authError || 'No user'}` }, 401);
    }

    const body = await c.req.json();
    const { data, filename, contentType } = body;

    if (!data || !filename || !contentType) {
      return c.json({ error: 'Missing required fields: data (base64), filename, contentType' }, 400);
    }

    // Decode base64 to Uint8Array
    const binaryStr = atob(data);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    // Generate a unique filename to avoid collisions
    const ext = filename.split('.').pop() || 'png';
    const r2ObjectKey = `quest-images/${crypto.randomUUID()}.${ext}`;

    console.log(`[QUEST-IMAGE] Uploading to R2: ${r2ObjectKey} (${contentType}, ${bytes.length} bytes)`);

    const { key, publicUrl } = await uploadToR2(r2ObjectKey, bytes, contentType);

    // Store as r2: prefixed path in KV (e.g. "r2:quest-images/uuid.png")
    const storedPath = `r2:${key}`;

    console.log(`[QUEST-IMAGE] Uploaded to R2: ${storedPath} → ${publicUrl}`);

    return c.json({
      success: true,
      image_path: storedPath,
      signed_url: publicUrl, // R2 public URL — never expires
    });
  } catch (error) {
    console.error('[QUEST-IMAGE] Error:', error);
    return c.json({ error: `Image upload failed: ${error.message}` }, 500);
  }
});

// Upload question header image to R2 (auth required)
app.post("/make-server-221a61bc/question-image", async (c) => {
  try {
    const userTokenHeader = c.req.header('X-User-Token');
    const { error: authError, user } = await verifyToken(userTokenHeader);
    if (authError || !user) {
      return c.json({ error: `Unauthorized: ${authError || 'No user'}` }, 401);
    }

    const body = await c.req.json();
    const { data, filename, contentType } = body;

    if (!data || !filename || !contentType) {
      return c.json({ error: 'Missing required fields: data (base64), filename, contentType' }, 400);
    }

    const binaryStr = atob(data);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    if (bytes.length > 500 * 1024) {
      return c.json({ error: `Image too large (${(bytes.length / 1024).toFixed(0)}KB > 500KB)` }, 400);
    }

    const ext = filename.split('.').pop() || 'png';
    const r2Key = `mcq-header/${crypto.randomUUID()}.${ext}`;

    console.log(`[QUESTION-IMAGE] Uploading to R2: ${r2Key} (${contentType}, ${bytes.length} bytes)`);

    const result = await uploadToR2(r2Key, bytes, contentType);

    console.log(`[QUESTION-IMAGE] Uploaded to R2: ${r2Key} -> ${result.publicUrl}`);

    return c.json({
      success: true,
      image_path: `r2:${r2Key}`,
      public_url: result.publicUrl,
    });
  } catch (error) {
    console.error('[QUESTION-IMAGE] Error:', error);
    return c.json({ error: `Image upload failed: ${error.message}` }, 500);
  }
});

// Upload TTS audio file to R2 (auth required)
app.post("/make-server-221a61bc/question-tts", async (c) => {
  try {
    const userTokenHeader = c.req.header('X-User-Token');
    const { error: authError, user } = await verifyToken(userTokenHeader);
    if (authError || !user) {
      return c.json({ error: `Auth failed for TTS upload: ${authError}` }, 401);
    }

    const formData = await c.req.formData();
    const file = formData.get("file") as File | null;
    const qId = formData.get("q_id") as string | null;
    const lang = formData.get("lang") as string | null;

    if (!file || !qId || !lang) {
      return c.json({ error: "Missing file, q_id, or lang" }, 400);
    }
    if (!["en", "ms", "zh"].includes(lang)) {
      return c.json({ error: `Invalid lang: ${lang}. Must be en, ms, or zh` }, 400);
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes.length > 2 * 1024 * 1024) {
      return c.json({ error: "Audio file too large. Max 2MB." }, 400);
    }

    const contentType = file.type || "audio/mpeg";
    const ext = file.name?.split(".").pop() || "mp3";
    const r2Key = `mcq-tts/${qId}/${lang}.${ext}`;

    console.log(`[QUESTION-TTS] Uploading to R2: ${r2Key} (${contentType}, ${bytes.length} bytes)`);

    const result = await uploadToR2(r2Key, bytes, contentType);

    console.log(`[QUESTION-TTS] Uploaded: ${r2Key} -> ${result.publicUrl}`);

    return c.json({
      public_url: result.publicUrl,
      image_path: `r2:${r2Key}`,
      r2_key: r2Key,
    });
  } catch (error) {
    console.error('[QUESTION-TTS] Error:', error);
    return c.json({ error: `TTS upload failed: ${error.message}` }, 500);
  }
});

// Upload answer option image to R2 (auth required)
app.post("/make-server-221a61bc/answer-option-image", async (c) => {
  try {
    const userTokenHeader = c.req.header('X-User-Token');
    const { error: authError, user } = await verifyToken(userTokenHeader);
    if (authError || !user) {
      return c.json({ error: `Unauthorized: ${authError || 'No user'}` }, 401);
    }

    const body = await c.req.json();
    const { data, filename, contentType, questionId, optionId } = body;

    if (!data || !filename || !contentType) {
      return c.json({ error: 'data, filename, and contentType are required' }, 400);
    }
    if (!questionId || !optionId) {
      return c.json({ error: 'questionId and optionId are required' }, 400);
    }

    const binaryStr = atob(data);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    if (bytes.length > 500 * 1024) {
      return c.json({ error: `Image too large (${(bytes.length / 1024).toFixed(0)}KB > 500KB). Compress it first.` }, 400);
    }

    const ext = filename.split('.').pop() || 'png';
    const r2Key = `mcq-img/${questionId}/${optionId}.${ext}`;

    console.log(`[ANSWER-OPTION-IMAGE] Uploading to R2: ${r2Key} (${contentType}, ${bytes.length} bytes)`);

    const result = await uploadToR2(r2Key, bytes, contentType);

    console.log(`[ANSWER-OPTION-IMAGE] Uploaded to R2: ${r2Key} -> ${result.publicUrl}`);

    return c.json({
      success: true,
      image_path: `r2:${r2Key}`,
      public_url: result.publicUrl,
    });
  } catch (error) {
    console.error('[ANSWER-OPTION-IMAGE] Error:', error);
    return c.json({ error: `Answer option image upload failed: ${error.message}` }, 500);
  }
});

// Delete quest image from storage (auth required) — handles R2 and legacy Supabase
app.delete("/make-server-221a61bc/quest-image/:path", async (c) => {
  try {
    const userTokenHeader = c.req.header('X-User-Token');
    const { error: authError, user } = await verifyToken(userTokenHeader);
    if (authError || !user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const imagePath = decodeURIComponent(c.req.param('path'));
    console.log(`[QUEST-IMAGE] Deleting: ${imagePath}`);

    if (isR2Key(imagePath)) {
      await deleteFromR2(extractR2Key(imagePath));
    } else {
      const { error: deleteError } = await supabaseAdmin.storage
        .from(QUEST_IMAGE_BUCKET)
        .remove([imagePath]);
      if (deleteError) {
        console.error('[QUEST-IMAGE] Supabase delete error:', deleteError);
        return c.json({ error: `Failed to delete image: ${deleteError.message}` }, 500);
      }
    }

    return c.json({ success: true });
  } catch (error) {
    console.error('[QUEST-IMAGE] Delete error:', error);
    return c.json({ error: `Image delete failed: ${error.message}` }, 500);
  }
});

// Get URL for a quest image (public — for child flow)
// R2 images return public URL, legacy Supabase returns signed URL
app.get("/make-server-221a61bc/quest-image/:path", async (c) => {
  try {
    const imagePath = decodeURIComponent(c.req.param('path'));

    if (isR2Key(imagePath)) {
      return c.json({ success: true, signed_url: r2PublicUrl(extractR2Key(imagePath)) });
    }

    const { data, error } = await supabaseAdmin.storage
      .from(QUEST_IMAGE_BUCKET)
      .createSignedUrl(imagePath, 3600);

    if (error) {
      console.error('[QUEST-IMAGE] Signed URL error:', error);
      return c.json({ error: `Failed to get image URL: ${error.message}` }, 404);
    }

    return c.json({ success: true, signed_url: data.signedUrl });
  } catch (error) {
    console.error('[QUEST-IMAGE] Error:', error);
    return c.json({ error: `Failed to get image: ${error.message}` }, 500);
  }
});

// ===== SUPER ADMIN: KV KEY SCANNER =====
// Returns all KV keys grouped by prefix for diagnostics.
app.get("/make-server-221a61bc/admin/kv-scan", async (c) => {
  try {
    const userTokenHeader = c.req.header('X-User-Token');
    const { error: authError, user } = await verifyToken(userTokenHeader);
    if (authError || !user) return c.json({ error: `Unauthorized` }, 401);
    const role = resolveUserRole(user.email!, user.user_metadata);
    if (role !== 'superadmin') return c.json({ error: 'Superadmin only' }, 403);

    const kvDb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: rows, error } = await kvDb.from('kv_store_221a61bc').select('key').order('key');
    if (error) return c.json({ error: error.message }, 500);

    const keys = (rows || []).map((r: any) => r.key);
    const groups: Record<string, number> = {};
    for (const key of keys) {
      const colonIdx = key.indexOf(':');
      const prefix = colonIdx > -1 ? key.substring(0, colonIdx + 1) : '(no-prefix)';
      groups[prefix] = (groups[prefix] || 0) + 1;
    }

    console.log(`[KV-SCAN] ${keys.length} total keys, ${Object.keys(groups).length} prefixes`);
    return c.json({ success: true, total_keys: keys.length, groups, all_keys: keys });
  } catch (error: any) {
    return c.json({ error: `KV scan failed: ${error.message}` }, 500);
  }
});

// ===== SUPER ADMIN: KV → PG DATA MIGRATION =====
// One-time migration endpoint: reads orphaned KV data and writes to PG tables.
// Safe to call multiple times (upsert on conflict).
app.post("/make-server-221a61bc/admin/migrate-kv-to-pg", async (c) => {
  try {
    const userTokenHeader = c.req.header('X-User-Token');
    const { error: authError, user } = await verifyToken(userTokenHeader);
    if (authError || !user) return c.json({ error: `Unauthorized: ${authError || 'No user'}` }, 401);

    const role = resolveUserRole(user.email!, user.user_metadata);
    if (role !== 'superadmin') return c.json({ error: 'Superadmin only' }, 403);

    const results: Record<string, any> = {};
    const kvDb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // ── 1. Quest configs: KV prefix "quest_config:" → PG "quest_configs" ──
    try {
      const { data: kvRows } = await kvDb.from('kv_store_221a61bc').select('key, value').like('key', 'quest_config:%');
      const questRows = kvRows || [];
      let migrated = 0;
      for (const row of questRows) {
        const v = row.value;
        if (!v || !v.id) continue;
        const pgRow: Record<string, any> = {
          id: v.id,
          subject: v.subject || '',
          name: typeof v.name === 'string' ? { en: v.name, ms: v.name, zh: v.name } : (v.name || { en: '', ms: '', zh: '' }),
          status: v.status || 'draft',
          question_count: Number(v.question_count || v.questionCount) || 10,
          icon: v.icon || '📚',
          is_mandarin: !!v.is_mandarin,
          conditional_key: v.conditional_key || v.conditionalKey || null,
          image_path: v.image_path || v.imagePath || null,
          created_by: v.created_by || v.createdBy || user.id,
          created_at: v.created_at || v.createdAt || new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        const { error } = await supabaseAdmin.from('quest_configs').upsert(pgRow, { onConflict: 'id' });
        if (!error) migrated++;
        else console.error(`[MIGRATE] quest_config ${v.id} error:`, error.message);
      }
      results.quest_configs = { found: questRows.length, migrated };
    } catch (e: any) {
      results.quest_configs = { error: e.message };
    }

    // ── 2. Videos: try multiple KV prefixes → PG "videos" ──
    try {
      const prefixes = ['admin_video:', 'video:', 'vid:', 'videos:', 'dyntube_video:', 'dyntube:'];
      let allVideoRows: any[] = [];
      for (const prefix of prefixes) {
        const { data: kvRows } = await kvDb.from('kv_store_221a61bc').select('key, value').like('key', `${prefix}%`);
        if (kvRows && kvRows.length > 0) {
          allVideoRows = [...allVideoRows, ...kvRows];
          console.log(`[MIGRATE] Found ${kvRows.length} video rows with prefix "${prefix}"`);
        }
      }
      let migrated = 0;
      for (const row of allVideoRows) {
        const v = row.value;
        if (!v || !v.id) continue;
        if (v.id === 'video_test_dyntube_001') continue;
        const pgRow: Record<string, any> = {
          id: v.id,
          title: v.title || '',
          subtitle: v.subtitle || '',
          category: v.category || 'english',
          language: v.language || null,
          duration: v.duration || '',
          thumbnail: v.thumbnail || v.thumbnailUrl || '',
          dyntube_key: v.dyntube_key || v.dyntubeKey || '',
          is_premium: v.is_premium ?? v.isPremium ?? false,
          is_new: v.is_new ?? v.isNew ?? false,
          is_featured: v.is_featured ?? v.isFeatured ?? false,
          status: v.status || 'active',
          sort_order: v.sort_order ?? v.sortOrder ?? v.order ?? 0,
          series_id: v.series_id || v.seriesId || null,
          created_at: v.created_at || v.createdAt || new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        const { error } = await supabaseAdmin.from('videos').upsert(pgRow, { onConflict: 'id' });
        if (!error) migrated++;
        else console.error(`[MIGRATE] video ${v.id} error:`, error.message);
      }
      results.videos = { found: allVideoRows.length, migrated };
    } catch (e: any) {
      results.videos = { error: e.message };
    }

    // ── 3. Shop items: KV prefix "shop_item:" → PG "shop_items" ──
    try {
      const { data: kvRows } = await kvDb.from('kv_store_221a61bc').select('key, value').like('key', 'shop_item:%');
      const shopRows = kvRows || [];
      let migrated = 0;
      for (const row of shopRows) {
        const v = row.value;
        if (!v || !v.id) continue;
        const pgRow: Record<string, any> = {
          id: v.id,
          name: v.name || '',
          description: v.description || '',
          image_slug: v.imageSlug || v.image_slug || '',
          price: Number(v.price) || 0,
          currency: v.currency || 'gold',
          rarity: v.rarity || 'common',
          category: v.category || 'consumable',
          equip_slot: v.equipSlot || v.equip_slot || null,
          effects: v.effects || [],
          emoji: v.emoji || '',
          sort_order: v.sortOrder ?? v.sort_order ?? 999,
          is_active: v.isActive ?? v.is_active ?? true,
          updated_at: new Date().toISOString(),
        };
        const { error } = await supabaseAdmin.from('shop_items').upsert(pgRow, { onConflict: 'id' });
        if (!error) migrated++;
        else console.error(`[MIGRATE] shop_item ${v.id} error:`, error.message);
      }
      results.shop_items = { found: shopRows.length, migrated };
    } catch (e: any) {
      results.shop_items = { error: e.message };
    }

    // ── 4. School accounts: KV prefix "school:" → PG "school_accounts" ──
    try {
      const { data: kvRows } = await kvDb.from('kv_store_221a61bc').select('key, value').like('key', 'school:%');
      const schoolRows = kvRows || [];
      let migrated = 0;
      for (const row of schoolRows) {
        const v = row.value;
        if (!v || !v.id) continue;
        const { data: existing } = await supabaseAdmin.from('school_accounts').select('id').eq('id', v.id).limit(1).single();
        if (existing) continue;
        const pgRow: Record<string, any> = {
          id: v.id,
          user_id: v.user_id || v.userId || '',
          school_name: v.school_name || v.schoolName || '',
          short_code: v.short_code || v.shortCode || '',
          kindergarten_url: v.kindergarten_url || v.kindergartenUrl || '',
          subscription_tier: v.subscription_tier || v.subscriptionTier || 'trial',
          claim_status: v.claim_status || v.claimStatus || null,
          linked_pg_kg_id: v.linked_pg_kg_id || v.linkedPgKgId || null,
          trial_expires_at: v.trial_expires_at || v.trialExpiresAt || null,
          created_at: v.created_at || v.createdAt || new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        if (!pgRow.user_id) continue;
        const { error } = await supabaseAdmin.from('school_accounts').upsert(pgRow, { onConflict: 'id' });
        if (!error) {
          migrated++;
        } else if (error.message?.includes('short_code')) {
          // Duplicate short_code — retry with a unique suffix
          pgRow.short_code = `${(pgRow.short_code || 'SCH').slice(0, 3)}${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
          const { error: retryErr } = await supabaseAdmin.from('school_accounts').upsert(pgRow, { onConflict: 'id' });
          if (!retryErr) migrated++;
          else console.error(`[MIGRATE] school ${v.id} retry error:`, retryErr.message);
        } else {
          console.error(`[MIGRATE] school ${v.id} error:`, error.message);
        }
      }
      results.school_accounts = { found: schoolRows.length, migrated };
    } catch (e: any) {
      results.school_accounts = { error: e.message };
    }

    // ── 5. Questions: KV prefix "gq:" → PG "questions" ──
    try {
      const { data: kvRows } = await kvDb.from('kv_store_221a61bc').select('key, value').like('key', 'gq:%');
      const qRows = kvRows || [];
      let migrated = 0;
      for (const row of qRows) {
        const v = row.value;
        if (!v) continue;
        const qId = v.q_id || v.qId || row.key.replace('gq:', '');
        if (!qId) continue;
        // NOTE: dskp_code, kssr_level, topic, skill_name columns do not exist
        // in the PG questions table yet. Excluded to prevent upsert errors.
        // Add these columns via Supabase Dashboard SQL editor if needed.
        const pgRow: Record<string, any> = {
          q_id: qId,
          subject: v.subject || '',
          age_target: parseAgeTarget(v.age_target || v.ageTarget) || null,
          question_text_en: v.question_text_en || v.questionTextEn || '',
          question_text_ms: v.question_text_ms || v.questionTextMs || '',
          question_text_zh: v.question_text_zh || v.questionTextZh || '',
          options_en: v.options_en || v.optionsEn || [],
          options_ms: v.options_ms || v.optionsMs || [],
          options_zh: v.options_zh || v.optionsZh || [],
          correct_answer: v.correct_answer || v.correctAnswer || 'a',
          input_type: v.input_type || v.inputType || 'mcq',
          image_url: v.image_url || v.imageUrl || null,
          created_at: v.created_at || v.createdAt || new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        const { error } = await resilientUpsert('questions', [pgRow], { onConflict: 'q_id' });
        if (!error) migrated++;
        else console.error(`[MIGRATE] question ${qId} error:`, error.message);
      }
      results.questions = { found: qRows.length, migrated };
    } catch (e: any) {
      results.questions = { error: e.message };
    }

    console.log('[MIGRATE] KV→PG migration complete:', JSON.stringify(results));
    return c.json({ success: true, results, message: 'Migration complete. Check results for per-table details.' });
  } catch (error: any) {
    console.error('[MIGRATE] Error:', error);
    return c.json({ error: `Migration failed: ${error.message}` }, 500);
  }
});

// ===== SUPER ADMIN PLATFORM STATS =====
// Aggregates ALL schools, leads, quests, and question bank data (auth required)
app.get("/make-server-221a61bc/admin/platform-stats", async (c) => {
  try {
    const userTokenHeader = c.req.header('X-User-Token');
    const { error: authError, user } = await verifyToken(userTokenHeader);
    if (authError || !user) {
      console.error('[ADMIN] Auth failed on platform-stats:', authError);
      return c.json({ error: `Unauthorized: ${authError || 'No user'}` }, 401);
    }

    console.log(`[ADMIN] Platform stats requested by user: ${user.id}`);

    // Fetch all data in parallel
    const [allSchools, allLeadsRaw, allQuests, allQuestions] = await Promise.all([
      supabaseAdmin.from('school_accounts').select('*').then(r => r.data || []),
      supabaseAdmin.from('leads').select('*').then(r => r.data || []),
      supabaseAdmin.from('quest_configs').select('*').then(r => r.data || []),
      supabaseAdmin.from('questions').select('*').then(r => r.data || []),
    ]);

    // Filter out non-lead entries (lead: prefix only, exclude phone lookups which are strings)
    const allLeads = allLeadsRaw.filter((l: any) => l && typeof l === 'object' && l.id && l.child_name);

    // Build per-school lead counts
    const schoolLeadCounts: Record<string, number> = {};
    const schoolCompletedCounts: Record<string, number> = {};
    for (const lead of allLeads) {
      const sid = lead.school_id;
      if (sid) {
        schoolLeadCounts[sid] = (schoolLeadCounts[sid] || 0) + 1;
        if (lead.status === 'completed') {
          schoolCompletedCounts[sid] = (schoolCompletedCounts[sid] || 0) + 1;
        }
      }
    }

    // Enrich schools with lead counts
    const schools = allSchools.map((s: any) => ({
      id: s.id,
      school_name: s.school_name,
      email: s.email,
      kindergarten_url: s.kindergarten_url,
      subscription_tier: s.subscription_tier || 'trial',
      trial_expires_at: s.trial_expires_at || null,
      created_at: s.created_at,
      lead_count: schoolLeadCounts[s.id] || 0,
      completed_count: schoolCompletedCounts[s.id] || 0,
    }));

    // Sort schools by creation date (newest first)
    schools.sort((a: any, b: any) => (b.created_at || '').localeCompare(a.created_at || ''));

    // Lead status breakdown
    const leadsByStatus: Record<string, number> = {};
    for (const lead of allLeads) {
      const status = lead.status || 'unknown';
      leadsByStatus[status] = (leadsByStatus[status] || 0) + 1;
    }

    // Leads sorted by updated_at desc (most recent activity first)
    const recentLeads = [...allLeads]
      .sort((a: any, b: any) => (b.updated_at || b.created_at || '').localeCompare(a.updated_at || a.created_at || ''))
      .slice(0, 100) // Cap at 100 most recent
      .map((l: any) => ({
        id: l.id,
        child_name: l.child_name,
        parent_name: l.parent_name,
        whatsapp: l.whatsapp,
        child_age: l.child_age,
        school_id: l.school_id,
        status: l.status || 'unknown',
        score: l.score || 0,
        total_questions: l.total_questions || 0,
        quest_results: l.quest_results || [],
        created_at: l.created_at,
        updated_at: l.updated_at,
      }));

    // Quest stats
    const liveQuests = allQuests.filter((q: any) => q.status === 'live').length;
    const draftQuests = allQuests.filter((q: any) => q.status === 'draft').length;

    // Question bank subject breakdown
    const subjectMap: Record<string, number> = {};
    for (const q of allQuestions) {
      const subj = q.subject || 'Unknown';
      subjectMap[subj] = (subjectMap[subj] || 0) + 1;
    }

    console.log(`[ADMIN] Platform stats: ${schools.length} schools, ${allLeads.length} leads, ${allQuests.length} quests, ${allQuestions.length} questions`);

    return c.json({
      success: true,
      overview: {
        total_schools: schools.length,
        total_leads: allLeads.length,
        completed_assessments: leadsByStatus['completed'] || 0,
        in_progress: leadsByStatus['in_progress'] || 0,
        total_quests: allQuests.length,
        live_quests: liveQuests,
        draft_quests: draftQuests,
        total_questions: allQuestions.length,
        leads_by_status: leadsByStatus,
        questions_by_subject: subjectMap,
      },
      schools,
      recent_leads: recentLeads,
    });
  } catch (error) {
    console.error('[ADMIN] Platform stats error:', error);
    return c.json({ error: `Failed to fetch platform stats: ${error.message}` }, 500);
  }
});

// ===== SUPER ADMIN — ALL USERS (parents + kindergartens + auth details) =====
app.get("/make-server-221a61bc/admin/all-users", async (c) => {
  try {
    const userTokenHeader = c.req.header('X-User-Token');
    const { error: authError, user } = await verifyToken(userTokenHeader);
    if (authError || !user) {
      return c.json({ error: `Unauthorized: ${authError || 'No user'}` }, 401);
    }

    console.log(`[ADMIN] All-users requested by user: ${user.id}`);

    // 1. Fetch ALL Supabase Auth users (email, created_at, last_sign_in, metadata)
    const { data: authList, error: listError } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    if (listError) {
      console.error('[ADMIN] Failed to list auth users:', listError);
      return c.json({ error: `Failed to list auth users: ${listError.message}` }, 500);
    }
    const authUsers = authList?.users || [];
    console.log(`[ADMIN] Auth users found: ${authUsers.length}`);

    // 2. Fetch ALL parent KV records & school KV records in parallel
    const [allParents, allSchools] = await Promise.all([
      supabaseAdmin.from('parents').select('*').then(r => r.data || []),
      supabaseAdmin.from('school_accounts').select('*').then(r => r.data || []),
    ]);

    // Build lookup maps
    const parentByAuthId: Record<string, any> = {};
    for (const p of allParents) {
      if (p && p.id) parentByAuthId[p.id] = p;
    }

    const schoolByUserId: Record<string, any> = {};
    for (const s of allSchools) {
      if (s && s.user_id) schoolByUserId[s.user_id] = s;
    }

    // 3. Merge auth users with KV data
    const users = authUsers.map((au: any) => {
      const parentKv = parentByAuthId[au.id];
      const schoolKv = schoolByUserId[au.id];
      const role = parentKv ? 'parent' : schoolKv ? 'kindergarten' : (au.user_metadata?.role || 'unknown');

      return {
        id: au.id,
        email: au.email || '—',
        role,
        name: parentKv?.name || schoolKv?.school_name || au.user_metadata?.name || au.user_metadata?.school_name || '—',
        created_at: au.created_at,
        last_sign_in_at: au.last_sign_in_at || null,
        email_confirmed: !!au.email_confirmed_at,
        // Parent-specific fields
        subscription_plan: parentKv?.subscription_plan || null,
        subscription_status: parentKv?.subscription_status || null,
        referral_code: parentKv?.referral_code || null,
        referral_credits: parentKv?.referral_credits || 0,
        referral_count: parentKv?.referral_count || 0,
        referred_by: parentKv?.referred_by || null,
        origin_tag: parentKv?.origin_tag || null,
        test_count_today: parentKv?.test_count_today || 0,
        watch_count_today: parentKv?.watch_count_today || 0,
        child_name: parentKv?.child_name || null,
        child_age: parentKv?.child_age || null,
        // Kindergarten-specific fields
        school_name: schoolKv?.school_name || null,
        kindergarten_url: schoolKv?.kindergarten_url || null,
        school_tier: schoolKv?.subscription_tier || null,
        school_id: schoolKv?.id || null,
      };
    });

    // Sort: parents first, then kindergartens, then unknown; within each group by created_at desc
    const rolePriority: Record<string, number> = { parent: 0, kindergarten: 1, unknown: 2 };
    users.sort((a: any, b: any) => {
      const rp = (rolePriority[a.role] ?? 2) - (rolePriority[b.role] ?? 2);
      if (rp !== 0) return rp;
      return (b.created_at || '').localeCompare(a.created_at || '');
    });

    console.log(`[ADMIN] Returning ${users.length} users (${allParents.length} parents, ${allSchools.length} schools)`);

    return c.json({
      success: true,
      users,
      summary: {
        total: users.length,
        parents: users.filter((u: any) => u.role === 'parent').length,
        kindergartens: users.filter((u: any) => u.role === 'kindergarten').length,
        unknown: users.filter((u: any) => u.role === 'unknown').length,
        paid_parents: users.filter((u: any) => u.role === 'parent' && u.subscription_plan && u.subscription_plan !== 'free').length,
        free_parents: users.filter((u: any) => u.role === 'parent' && (!u.subscription_plan || u.subscription_plan === 'free')).length,
      },
    });
  } catch (error) {
    console.error('[ADMIN] All-users error:', error);
    return c.json({ error: `Failed to fetch all users: ${error.message}` }, 500);
  }
});

// ===== SUPER ADMIN — UPDATE USER (edit parent/kindergarten fields + plan) =====
app.put("/make-server-221a61bc/admin/update-user", async (c) => {
  try {
    const userTokenHeader = c.req.header('X-User-Token');
    const { error: authError, user } = await verifyToken(userTokenHeader);
    if (authError || !user) {
      return c.json({ error: `Unauthorized: ${authError || 'No user'}` }, 401);
    }

    const body = await c.req.json();
    const { userId, role, updates } = body;

    if (!userId || !role || !updates) {
      return c.json({ error: "Missing required fields: userId, role, updates" }, 400);
    }

    console.log(`[ADMIN] Update user ${userId} (${role}) by admin ${user.id}:`, JSON.stringify(updates));

    if (role === 'parent') {
      // Read existing parent record
      const { data: existing, error: readErr } = await supabaseAdmin.from('parents').select('*').eq('id', userId).limit(1).single();
      if (readErr || !existing) {
        return c.json({ error: `Parent record not found for user ${userId}: ${readErr?.message || 'not found'}` }, 404);
      }

      // Whitelist of editable parent fields
      const allowedFields = [
        'name', 'child_name', 'child_age', 'child_birthdate', 'excluded_subjects',
        'subscription_plan', 'subscription_status',
        'referral_credits', 'referral_count',
        'origin_tag', 'referred_by',
        'test_count_today', 'watch_count_today',
      ];

      // Fields whose Postgres column type does NOT accept empty strings —
      // uuid, integer, date, jsonb, etc. Empty strings MUST become null.
      const nullifyIfEmpty = new Set([
        'referred_by',           // text (referral code) — but keep sanitized for safety
        'child_age',             // integer
        'child_birthdate',       // date / timestamptz
        'excluded_subjects',     // jsonb array
        'referral_credits',      // integer
        'referral_count',        // integer
        'test_count_today',      // integer
        'watch_count_today',     // integer
        'origin_tag',            // uuid — FK to school_accounts.id
      ]);

      // Build ONLY the changed fields — never spread all existing columns
      const updatePayload: Record<string, any> = { updated_at: new Date().toISOString() };
      for (const key of allowedFields) {
        if (updates[key] !== undefined) {
          const val = updates[key];
          // Sanitize: empty/blank strings in non-text columns → null
          if (nullifyIfEmpty.has(key) && (val === '' || val === null)) {
            updatePayload[key] = null;
          } else {
            updatePayload[key] = val;
          }
        }
      }
      console.log(`[ADMIN] Sanitized update payload for parent ${userId}:`, JSON.stringify(updatePayload));

      const { error: updateErr } = await supabaseAdmin.from('parents').update(updatePayload).eq('id', userId);
      if (updateErr) {
        console.error(`[ADMIN] Failed to update parent ${userId}:`, updateErr);
        return c.json({ error: `Failed to update parent record: ${updateErr.message}` }, 500);
      }
      console.log(`[ADMIN] Parent ${userId} updated successfully:`, JSON.stringify(updatePayload));

      return c.json({ success: true, user: { ...existing, ...updatePayload } });

    } else if (role === 'kindergarten') {
      // Find the school record for this user
      const { data: schoolRecord } = await supabaseAdmin.from('school_accounts').select('*').eq('user_id', userId).limit(1).single();

      if (!schoolRecord) {
        return c.json({ error: `School record not found for user ${userId}` }, 404);
      }

      const allowedFields = [
        'school_name', 'kindergarten_url', 'subscription_tier', 'trial_expires_at',
      ];
      const merged: Record<string, any> = { updated_at: new Date().toISOString() };
      for (const key of allowedFields) {
        if (updates[key] !== undefined) {
          merged[key] = updates[key];
        }
      }

      const { error: updateErr } = await supabaseAdmin.from('school_accounts').update(merged).eq('id', schoolRecord.id);
      if (updateErr) {
        console.error(`[ADMIN] Failed to update school ${schoolRecord.id}:`, updateErr);
        return c.json({ error: `Failed to update school record: ${updateErr.message}` }, 500);
      }

      // Skip the old email key update — no longer needed
      const emailKey = `_deprecated`;
      console.log(`[ADMIN] Kindergarten ${userId} (school ${schoolRecord.id}) updated successfully`);
      return c.json({ success: true, school: { ...schoolRecord, ...merged } });

    } else {
      return c.json({ error: `Unsupported role: ${role}` }, 400);
    }
  } catch (error) {
    console.error('[ADMIN] Update user error:', error);
    return c.json({ error: `Failed to update user: ${error.message}` }, 500);
  }
});

// ===== SUPER ADMIN — DELETE USER (removes auth user + all KV data) =====
app.delete("/make-server-221a61bc/admin/delete-user/:userId", async (c) => {
  try {
    const userTokenHeader = c.req.header('X-User-Token');
    const { error: authError, user } = await verifyToken(userTokenHeader);
    if (authError || !user) {
      return c.json({ error: `Unauthorized: ${authError || 'No user'}` }, 401);
    }

    const targetUserId = c.req.param('userId');
    if (!targetUserId) {
      return c.json({ error: "Missing userId parameter" }, 400);
    }

    // Prevent admin from deleting themselves
    if (targetUserId === user.id) {
      return c.json({ error: "Cannot delete your own account from admin panel" }, 400);
    }

    console.log(`[ADMIN-DELETE] Admin ${user.id} deleting user ${targetUserId}`);

    const deletedKeys: string[] = [];

    // 1. Delete parent data from Postgres
    try {
      await supabaseAdmin.from('parent_activities').delete().eq('parent_id', targetUserId);
      await supabaseAdmin.from('parent_assessments').delete().eq('parent_id', targetUserId);
      await supabaseAdmin.from('watch_history').delete().eq('user_id', targetUserId);
      await supabaseAdmin.from('realm_daily_logs').delete().eq('user_id', targetUserId);
      await supabaseAdmin.from('diamond_inbox').delete().eq('user_id', targetUserId);
      await supabaseAdmin.from('kg_claims').delete().eq('user_id', targetUserId);
      await supabaseAdmin.from('parents').delete().eq('id', targetUserId);
      deletedKeys.push('parent_data');
    } catch (e) { console.error('[ADMIN-DELETE] Parent PG cleanup error:', e); }

    // 2. Delete school data from Postgres
    try {
      await supabaseAdmin.from('school_accounts').delete().eq('user_id', targetUserId);
      deletedKeys.push('school_data');
    } catch (e) { console.error('[ADMIN-DELETE] School PG cleanup error:', e); }

    // 3. Delete the Supabase Auth user
    let authDeleted = false;
    try {
      const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(targetUserId);
      if (deleteAuthError) {
        console.error(`[ADMIN-DELETE] Auth user deletion failed:`, deleteAuthError.message);
      } else {
        authDeleted = true;
      }
    } catch (e) {
      console.error('[ADMIN-DELETE] Auth deletion exception:', e);
    }

    console.log(`[ADMIN-DELETE] User ${targetUserId} deleted by admin ${user.id}. Keys: ${deletedKeys.length}, Auth: ${authDeleted}`);

    return c.json({ success: true, deletedKeys: deletedKeys.length, authDeleted });
  } catch (error) {
    console.error('[ADMIN-DELETE] Delete user error:', error);
    return c.json({ error: `Failed to delete user: ${error.message}` }, 500);
  }
});

// ===== MOUNT STRIPE ROUTES =====
app.route("/make-server-221a61bc/stripe", stripeRoutes);

// ===== MOUNT KG POSTGRES ROUTES =====
app.route("/make-server-221a61bc/kg-db", kgPostgresRoutes);

// ===== PARENT AUTH & MANAGEMENT =====

// Parent signup (email/password) — creates a "parent" role user
app.post("/make-server-221a61bc/parent/signup", async (c) => {
  try {
    const body = await c.req.json();
    const { email, password, name, originTag, referredBy } = body;

    if (!email || !password || !name) {
      return c.json({ error: "Missing required fields: email, password, name" }, 400);
    }

    console.log(`[PARENT] Signup attempt: ${email}, name: ${name}`);

    // Create user in Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, role: "parent" },
    });

    if (authError) {
      console.error("[PARENT] Auth signup error:", authError);
      return c.json({ error: `Failed to create user: ${authError.message}` }, 400);
    }

    const parentId = authData.user.id;
    const referralCode = `FOXY-${name.split(' ')[0].toUpperCase().slice(0, 4)}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    // Resolve origin_tag from referrer chain if referredBy provided
    let resolvedOriginTag = originTag || null;
    if (referredBy && !resolvedOriginTag) {
      const { data: referrerRow } = await supabaseAdmin.from('parents').select('id, origin_tag').eq('referral_code', referredBy).limit(1).single();
      if (referrerRow?.origin_tag) {
        resolvedOriginTag = referrerRow.origin_tag;
        console.log(`[PARENT] Inherited origin_tag ${resolvedOriginTag} from referrer ${referredBy}`);
      }
    }

    const parentData = {
      id: parentId,
      email,
      name,
      role: "parent",
      referral_code: referralCode,
      referred_by: referredBy || null,
      origin_tag: resolvedOriginTag,
      subscription_plan: "free",
      subscription_status: "free",
      referral_credits: 0,
      referral_count: 0,
      test_count_today: 0,
      watch_count_today: 0,
      last_test_date: null,
      last_watch_date: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await supabaseAdmin.from('parents').insert(parentData);

    // ── Bible v5: Grant +1💎 to referrer on free signup ──
    if (referredBy) {
      try {
        const { data: referrerRow } = await supabaseAdmin.from('parents').select('id, email').eq('referral_code', referredBy).limit(1).single();
        if (referrerRow) {
          await grantDiamondInbox(referrerRow.id, 1, `Free signup referral: ${name}`);
          // Track referrer got 1💎 for this referred user
          const metaUpdate: Record<string, any> = { updated_at: new Date().toISOString() };
          metaUpdate[`_ref_free_diamond_${parentId}`] = 1;
          await supabaseAdmin.from('parents').update(metaUpdate).eq('id', referrerRow.id);
          console.log(`[PARENT] Granted +1💎 to referrer ${referrerRow.id} for free signup of ${parentId}`);
        }
      } catch (refErr) {
        console.warn(`[PARENT] Free signup diamond grant failed:`, refErr);
      }
    }

    // Track signup for origin kindergarten
    if (resolvedOriginTag) {
      await supabaseAdmin.rpc('increment_counter', { table_name: 'school_accounts', column_name: 'free_parent_count', row_id: resolvedOriginTag }).catch(() => {
        // Fallback: read-modify-write
        supabaseAdmin.from('school_accounts').select('free_parent_count').eq('id', resolvedOriginTag).limit(1).single().then(({ data: kgData }) => {
          if (kgData) supabaseAdmin.from('school_accounts').update({ free_parent_count: (kgData.free_parent_count || 0) + 1, updated_at: new Date().toISOString() }).eq('id', resolvedOriginTag);
        });
      });
    }

    // Sign in immediately to return session
    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!
    );
    const { data: signInData, error: signInError } = await supabaseAuth.auth.signInWithPassword({ email, password });

    console.log(`[PARENT] Signup success: ${parentId}, referral: ${referralCode}`);

    return c.json({
      success: true,
      user: { id: parentId, email, name },
      parent: parentData,
      session: signInData?.session ? {
        access_token: signInData.session.access_token,
        refresh_token: signInData.session.refresh_token,
      } : null,
    });
  } catch (error) {
    console.error("[PARENT] Signup error:", error);
    return c.json({ error: `Parent signup failed: ${error.message}` }, 500);
  }
});

// Parent login (email/password)
app.post("/make-server-221a61bc/parent/login", async (c) => {
  try {
    const body = await c.req.json();
    const { email, password } = body;

    if (!email || !password) {
      return c.json({ error: "Missing email or password" }, 400);
    }

    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!
    );

    const { data: authData, error: authError } = await supabaseAuth.auth.signInWithPassword({ email, password });

    if (authError || !authData.user) {
      return c.json({ error: "Invalid credentials" }, 401);
    }

    // Look up parent record
    const { data: parentData } = await supabaseAdmin.from('parents').select('*').eq('id', authData.user.id).limit(1).single();
    if (!parentData) {
      return c.json({ error: "No parent account found. Please sign up first." }, 404);
    }

    // Reset daily counters if new day
    const today = new Date().toISOString().split("T")[0];
    const updates: Record<string, any> = { updated_at: new Date().toISOString() };
    if (parentData.last_test_date !== today) {
      updates.test_count_today = 0;
      updates.last_test_date = today;
    }
    if (parentData.last_watch_date !== today) {
      updates.watch_count_today = 0;
      updates.last_watch_date = today;
    }
    await supabaseAdmin.from('parents').update(updates).eq('id', authData.user.id);
    Object.assign(parentData, updates);

    console.log(`[PARENT] Login success: ${authData.user.id}`);

    return c.json({
      success: true,
      user: { id: authData.user.id, email: authData.user.email },
      parent: parentData,
      session: {
        access_token: authData.session.access_token,
        refresh_token: authData.session.refresh_token,
      },
    });
  } catch (error) {
    console.error("[PARENT] Login error:", error);
    return c.json({ error: `Login failed: ${error.message}` }, 500);
  }
});

// Parent OAuth completion — ensures a parent KV record exists for social-login users
// Called by the frontend after returning from Google/Facebook OAuth redirect
// Accepts optional { referredBy } in body — read from the 365-day referral cookie
app.post("/make-server-221a61bc/parent/oauth-complete", async (c) => {
  try {
    const userTokenHeader = c.req.header("X-User-Token");
    const { error: authError, user } = await verifyToken(userTokenHeader);

    if (authError || !user) {
      console.error("[PARENT-OAUTH] Token verification failed:", authError);
      return c.json({ error: authError || "Invalid token", valid: false }, 401);
    }

    // Parse optional fields from request body
    let referredBy: string | null = null;
    let directOriginTag: string | null = null;
    let leadPhone: string | null = null;
    let leadChildName: string | null = null;
    let leadChildAge: number | null = null;
    try {
      const body = await c.req.json();
      referredBy = body?.referredBy || null;
      directOriginTag = body?.originTag || null;
      leadPhone = body?.phone || null;
      leadChildName = body?.child_name || null;
      leadChildAge = body?.child_age || null;
    } catch {
      // No body or invalid JSON — that's fine, all fields stay null
    }

    console.log(`[PARENT-OAUTH] OAuth complete for user ${user.id} (${user.email}), referredBy: ${referredBy || '(none)'}, originTag: ${directOriginTag || '(none)'}, phone: ${leadPhone ? '***' : '(none)'}`);

    // Check if parent record already exists (returning OAuth user)
    let { data: parentData } = await supabaseAdmin.from('parents').select('*').eq('id', user.id).limit(1).single() as { data: any };

    if (parentData) {
      console.log(`[PARENT-OAUTH] Existing parent found: ${parentData.name}`);

      const today = new Date().toISOString().split("T")[0];
      const dayUpdates: Record<string, any> = {};
      if (parentData.last_test_date !== today) {
        dayUpdates.test_count_today = 0;
        dayUpdates.last_test_date = today;
      }
      if (parentData.last_watch_date !== today) {
        dayUpdates.watch_count_today = 0;
        dayUpdates.last_watch_date = today;
      }
      if (Object.keys(dayUpdates).length > 0) {
        dayUpdates.updated_at = new Date().toISOString();
        await supabaseAdmin.from('parents').update(dayUpdates).eq('id', user.id);
        Object.assign(parentData, dayUpdates);
      }

      return c.json({ success: true, isNew: false, parent: parentData });
    }

    // New OAuth user — create parent record from auth metadata
    const userName = user.user_metadata?.full_name
      || user.user_metadata?.name
      || user.email?.split("@")[0]
      || "Parent";
    const referralCode = `FOXY-${userName.split(" ")[0].toUpperCase().slice(0, 4)}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    // Resolve origin_tag from referrer chain (same logic as email signup)
    let resolvedOriginTag: string | null = null;
    if (referredBy) {
      const { data: referrerRow } = await supabaseAdmin.from('parents').select('id, origin_tag').eq('referral_code', referredBy).limit(1).single();
      if (referrerRow?.origin_tag) {
        resolvedOriginTag = referrerRow.origin_tag;
        console.log(`[PARENT-OAUTH] Inherited origin_tag ${resolvedOriginTag} from referrer ${referredBy}`);
      } else if (!referrerRow) {
        console.warn(`[PARENT-OAUTH] Referral code ${referredBy} not found — storing anyway`);
      }
    }
    // If no origin resolved from referral chain, use direct originTag from the /t/:code test funnel
    if (!resolvedOriginTag && directOriginTag) {
      resolvedOriginTag = directOriginTag;
      console.log(`[PARENT-OAUTH] Using direct origin_tag from test funnel: ${resolvedOriginTag}`);
    }

    parentData = {
      id: user.id,
      email: user.email,
      name: userName,
      phone: leadPhone || null,
      child_name: leadChildName || null,
      child_age: leadChildAge || null,
      avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
      role: "parent",
      auth_provider: user.app_metadata?.provider || "oauth",
      referral_code: referralCode,
      referred_by: referredBy,
      origin_tag: resolvedOriginTag,
      subscription_plan: "free",
      subscription_status: "free",
      referral_credits: 0,
      referral_count: 0,
      test_count_today: 0,
      watch_count_today: 0,
      practice_count_today: 0,
      total_tests: 0,
      total_watches: 0,
      total_practices: 0,
      total_practice_questions: 0,
      last_test_date: null,
      last_watch_date: null,
      last_practice_date: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await supabaseAdmin.from('parents').insert(parentData);

    // ── Bible v5: Grant +1💎 to referrer on free OAuth signup ──
    if (referredBy) {
      try {
        const { data: refRow } = await supabaseAdmin.from('parents').select('id, email').eq('referral_code', referredBy).limit(1).single();
        if (refRow) {
          await grantDiamondInbox(refRow.id, 1, `Free signup referral: ${userName}`);
          const metaUpd: Record<string, any> = { updated_at: new Date().toISOString() };
          metaUpd[`_ref_free_diamond_${user.id}`] = 1;
          await supabaseAdmin.from('parents').update(metaUpd).eq('id', refRow.id);
          console.log(`[PARENT-OAUTH] Granted +1💎 to referrer ${refRow.id} for free signup of ${user.id}`);
        }
      } catch (refErr) {
        console.warn(`[PARENT-OAUTH] Free signup diamond grant failed:`, refErr);
      }
    }

    // Track signup for origin kindergarten
    if (resolvedOriginTag) {
      supabaseAdmin.from('school_accounts').select('free_parent_count').eq('id', resolvedOriginTag).limit(1).single().then(({ data: kgData }) => {
        if (kgData) supabaseAdmin.from('school_accounts').update({ free_parent_count: (kgData.free_parent_count || 0) + 1, updated_at: new Date().toISOString() }).eq('id', resolvedOriginTag);
      }).catch(() => {});
    }

    console.log(`[PARENT-OAUTH] New parent created: ${userName} (${user.id}), referral: ${referralCode}, referred_by: ${referredBy || '(none)'}, origin: ${resolvedOriginTag || '(none)'}`);

    return c.json({ success: true, isNew: true, parent: parentData });
  } catch (error) {
    console.error("[PARENT-OAUTH] Error:", error);
    return c.json({ error: `OAuth completion failed: ${error.message}` }, 500);
  }
});

// Parent session validation
app.get("/make-server-221a61bc/parent/session", async (c) => {
  try {
    const userTokenHeader = c.req.header("X-User-Token");
    const { error: authError, user } = await verifyToken(userTokenHeader);

    if (authError || !user) {
      return c.json({ error: authError || "Invalid session", valid: false }, 401);
    }

    const { data: parentData } = await supabaseAdmin.from('parents').select('*').eq('id', user.id).limit(1).single() as { data: any };
    if (!parentData) {
      return c.json({ error: "No parent account found", valid: false }, 404);
    }

    // Reset daily counters if new day
    const today = new Date().toISOString().split("T")[0];
    let updated = false;
    if (parentData.last_test_date !== today) {
      parentData.test_count_today = 0;
      parentData.last_test_date = today;
      updated = true;
    }
    if (parentData.last_watch_date !== today) {
      parentData.watch_count_today = 0;
      parentData.last_watch_date = today;
      updated = true;
    }
    if (parentData.last_practice_date !== today) {
      parentData.practice_count_today = 0;
      parentData.last_practice_date = today;
      updated = true;
    }
    // Initialize lifetime counters if missing
    if (parentData.total_tests === undefined) { parentData.total_tests = 0; updated = true; }
    if (parentData.total_watches === undefined) { parentData.total_watches = 0; updated = true; }
    if (parentData.total_practices === undefined) { parentData.total_practices = 0; updated = true; }
    if (parentData.total_practice_questions === undefined) { parentData.total_practice_questions = 0; updated = true; }

    // ── FMCG Premium Trial expiry check ──
    // If premium_source is 'fmcg_trial' and premium_expires_at has passed, downgrade
    if (parentData.premium_source === "fmcg_trial" && parentData.premium_expires_at) {
      const expiryDate = new Date(parentData.premium_expires_at);
      if (expiryDate <= new Date()) {
        console.log(`[PARENT] FMCG trial expired for ${user.id} (expired: ${parentData.premium_expires_at})`);
        parentData.subscription_status = "expired";
        parentData.subscription_plan = "free";
        updated = true;
      }
    }

    if (updated) {
      parentData.updated_at = new Date().toISOString();
      await supabaseAdmin.from('parents').update(parentData).eq('id', user.id);
    }

    return c.json({ valid: true, user: { id: user.id, email: user.email }, parent: parentData });
  } catch (error) {
    console.error("[PARENT] Session error:", error);
    return c.json({ error: `Session check failed: ${error.message}`, valid: false }, 500);
  }
});

// Update parent profile (e.g. phone number, child info)
app.put("/make-server-221a61bc/parent/profile", async (c) => {
  try {
    const userTokenHeader = c.req.header("X-User-Token");
    const { error: authError, user } = await verifyToken(userTokenHeader);
    if (authError || !user) return c.json({ error: `Unauthorized: ${authError || 'No user'}` }, 401);

    const body = await c.req.json();
    const { phone, child_name, child_age, child_birthdate, excluded_subjects, name, include_mandarin_test, language, character_type } = body;

    const { data: parentData } = await supabaseAdmin.from('parents').select('*').eq('id', user.id).limit(1).single() as { data: any };
    if (!parentData) return c.json({ error: "Parent not found" }, 404);

    // Update only provided fields
    const profileUpdates: Record<string, any> = { updated_at: new Date().toISOString() };
    if (phone !== undefined) profileUpdates.phone = phone;
    if (child_name !== undefined) profileUpdates.child_name = child_name;
    if (child_age !== undefined) profileUpdates.child_age = child_age;
    if (child_birthdate !== undefined) profileUpdates.child_birthdate = child_birthdate;
    if (excluded_subjects !== undefined) profileUpdates.excluded_subjects = excluded_subjects;
    if (name !== undefined) profileUpdates.name = name;
    if (include_mandarin_test !== undefined) profileUpdates.include_mandarin_test = include_mandarin_test;
    if (language !== undefined) profileUpdates.language = language;
    if (character_type !== undefined) profileUpdates.character_type = character_type;

    await supabaseAdmin.from('parents').update(profileUpdates).eq('id', user.id);
    Object.assign(parentData, profileUpdates);

    console.log(`[PARENT] Profile updated for ${user.id}:`, { phone, child_name, child_age, child_birthdate, excluded_subjects, name, include_mandarin_test, language, character_type });

    return c.json({ success: true, parent: parentData });
  } catch (error) {
    console.error("[PARENT] Profile update error:", error);
    return c.json({ error: `Profile update failed: ${error.message}` }, 500);
  }
});

// ===== DELETE PARENT ACCOUNT =====
// Removes all parent KV data, assessment history, activity logs, referral code,
// and finally deletes the Supabase Auth user entirely.
app.delete("/make-server-221a61bc/parent/account", async (c) => {
  try {
    const userTokenHeader = c.req.header("X-User-Token");
    const { error: authError, user } = await verifyToken(userTokenHeader);
    if (authError || !user) return c.json({ error: `Unauthorized: ${authError || 'No user'}` }, 401);

    const { data: parentData } = await supabaseAdmin.from('parents').select('*').eq('id', user.id).limit(1).single();
    if (!parentData) {
      console.warn(`[PARENT-DELETE] No parent record found for ${user.id}, proceeding with auth deletion`);
    }

    const deletedKeys: string[] = [];

    // 1. Delete all related data from Postgres
    try {
      await supabaseAdmin.from('parent_activities').delete().eq('parent_id', user.id);
      await supabaseAdmin.from('parent_assessments').delete().eq('parent_id', user.id);
      await supabaseAdmin.from('watch_history').delete().eq('user_id', user.id);
      await supabaseAdmin.from('realm_daily_logs').delete().eq('user_id', user.id);
      await supabaseAdmin.from('diamond_inbox').delete().eq('user_id', user.id);
      await supabaseAdmin.from('kg_claims').delete().eq('user_id', user.id);
      await supabaseAdmin.from('parents').delete().eq('id', user.id);
      deletedKeys.push('all_parent_pg_data');
    } catch (e) { console.warn('[PARENT-DELETE] Error deleting parent PG data:', e); }

    // 6. Delete the Supabase Auth user
    try {
      const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(user.id);
      if (deleteAuthError) {
        console.error(`[PARENT-DELETE] Auth user deletion failed for ${user.id}:`, deleteAuthError.message);
      } else {
        console.log(`[PARENT-DELETE] Auth user deleted: ${user.id}`);
      }
    } catch (e) {
      console.error('[PARENT-DELETE] Auth deletion exception:', e);
    }

    console.log(`[PARENT-DELETE] Account fully deleted for ${user.id} (${parentData?.email || 'unknown email'}). Keys removed: ${deletedKeys.length}`);

    return c.json({ success: true, deletedKeys: deletedKeys.length });
  } catch (error) {
    console.error("[PARENT-DELETE] Account deletion error:", error);
    return c.json({ error: `Account deletion failed: ${error.message}` }, 500);
  }
});

// Increment parent daily usage counter (test, watch, or practice) + lifetime counters + activity log
// ──────────────────────────────────────────────────────────────────────────────
// UNIFIED: Limits now read from realm_reward_config (Gold Economy Settings)
// instead of hardcoded 1/day. Also cross-writes to realm_daily:{userId}:{date}
// so Realm and Parent Dashboard share a single source of truth.
// Legacy type mapping: "test"→"test", "watch"→"video", "practice"→"practice"
// ──────────────────────────────────────────────────────────────────────────────
app.post("/make-server-221a61bc/parent/use", async (c) => {
  try {
    const userTokenHeader = c.req.header("X-User-Token");
    const { error: authError, user } = await verifyToken(userTokenHeader);
    if (authError || !user) return c.json({ error: "Unauthorized" }, 401);

    const { type, questions_answered, questions_correct } = await c.req.json();
    if (!["test", "watch", "practice"].includes(type)) {
      return c.json({ error: "type must be 'test', 'watch', or 'practice'" }, 400);
    }

    // Map legacy types to unified activity types
    const activityTypeMap: Record<string, string> = { test: "test", watch: "video", practice: "practice" };
    const activityType = activityTypeMap[type];

    const today = new Date().toISOString().split("T")[0];

    // Fetch parentData, reward config, and realm daily log in parallel
    const [parentRes, rewardConfig, realmDailyRes] = await Promise.all([
      supabaseAdmin.from('parents').select('*').eq('id', user.id).limit(1).single(),
      kv.get(REWARD_CONFIG_KEY),
      supabaseAdmin.from('realm_daily_logs').select('*').eq('user_id', user.id).eq('date', today).limit(1).single(),
    ]);
    const parentData = parentRes.data as any;
    const realmDailyLog = realmDailyRes.data?.log_data || null;

    if (!parentData) return c.json({ error: "Parent not found" }, 404);

    const config = rewardConfig || DEFAULT_REWARD_CONFIG_SERVER;
    const activityConfig = config.activities?.[activityType];

    // ── Config-driven access limit check ──
    const subStatus = parentData.subscription_status || "free";
    const hasFmcgPremium = parentData.premium_expires_at && new Date(parentData.premium_expires_at) > new Date();
    const isPaid = subStatus === "active" || subStatus === "founder" || !!hasFmcgPremium;
    const maxPerDay = isPaid
      ? (activityConfig?.premiumMaxPerDay ?? -1)
      : (activityConfig?.freeMaxPerDay ?? -1);

    // Count from realm daily log (single source of truth for daily counts)
    const realmLog = realmDailyLog || {};
    const realmActivityEntry = realmLog[activityType] || { count: 0, goldAwarded: false };
    const currentCount = realmActivityEntry.count;

    if (maxPerDay !== -1 && currentCount >= maxPerDay) {
      console.log(`[PARENT/USE] ACCESS BLOCKED: ${user.id} ${type}->${activityType} count=${currentCount} max=${maxPerDay} isPaid=${isPaid}`);
      return c.json({
        error: isPaid
          ? `Daily limit reached for ${type}. You've completed ${currentCount}/${maxPerDay} today.`
          : `Daily free limit reached for ${type}. Upgrade to Premium for unlimited!`,
        allowed: false,
        limit: true,
        accessBlocked: true,
        currentCount,
        maxPerDay,
      }, 403);
    }

    // ── Cross-write to realm daily log (keep both systems in sync) ──
    realmActivityEntry.count += 1;
    realmLog[activityType] = realmActivityEntry;
    await supabaseAdmin.from('realm_daily_logs').upsert({ user_id: user.id, date: today, log_data: realmLog }, { onConflict: 'user_id,date' });

    // ── Update parentData lifetime + daily counters (legacy compat) ──
    if (parentData.total_tests === undefined) parentData.total_tests = 0;
    if (parentData.total_watches === undefined) parentData.total_watches = 0;
    if (parentData.total_practices === undefined) parentData.total_practices = 0;
    if (parentData.total_practice_questions === undefined) parentData.total_practice_questions = 0;

    if (type === "test") {
      if (parentData.last_test_date !== today) {
        parentData.test_count_today = 0;
        parentData.last_test_date = today;
      }
      parentData.test_count_today++;
      parentData.total_tests++;
    } else if (type === "watch") {
      if (parentData.last_watch_date !== today) {
        parentData.watch_count_today = 0;
        parentData.last_watch_date = today;
      }
      parentData.watch_count_today++;
      parentData.total_watches++;
    } else {
      if (parentData.last_practice_date !== today) {
        parentData.practice_count_today = 0;
        parentData.last_practice_date = today;
      }
      parentData.practice_count_today++;
      parentData.total_practices++;
      if (questions_answered && typeof questions_answered === 'number' && questions_answered > 0) {
        parentData.total_practice_questions = (parentData.total_practice_questions || 0) + questions_answered;
      }
    }

    parentData.updated_at = new Date().toISOString();
    await supabaseAdmin.from('parents').update(parentData).eq('id', user.id);

    // ── Log activity for timeline heatmap ──
    const { data: existingActivityRow } = await supabaseAdmin.from('parent_activities').select('*').eq('parent_id', user.id).eq('date', today).limit(1).single();
    const existingActivity = existingActivityRow || { parent_id: user.id, date: today, tests: 0, watches: 0, practices: 0, questions_total: 0, questions_correct: 0 };
    if (existingActivity.questions_total === undefined) existingActivity.questions_total = 0;
    if (existingActivity.questions_correct === undefined) existingActivity.questions_correct = 0;
    if (existingActivity.videos_watched === undefined) existingActivity.videos_watched = 0;
    if (existingActivity.songs_listened === undefined) existingActivity.songs_listened = 0;
    if (existingActivity.flashcards_completed === undefined) existingActivity.flashcards_completed = 0;
    if (existingActivity.battles === undefined) existingActivity.battles = 0;

    if (type === "test") existingActivity.tests++;
    else if (type === "watch") {
      existingActivity.watches++;
      existingActivity.videos_watched++;
    } else {
      existingActivity.practices++;
      if (questions_answered && typeof questions_answered === 'number' && questions_answered > 0) {
        existingActivity.questions_total += questions_answered;
      }
      if (questions_correct && typeof questions_correct === 'number' && questions_correct > 0) {
        existingActivity.questions_correct += questions_correct;
      }
    }
    await supabaseAdmin.from('parent_activities').upsert(existingActivity, { onConflict: 'parent_id,date' });

    const countMap: Record<string, number> = {
      test: parentData.test_count_today,
      watch: parentData.watch_count_today,
      practice: parentData.practice_count_today,
    };

    console.log(`[PARENT/USE] OK: ${user.id} ${type}->${activityType} realmCount=${realmActivityEntry.count} max=${maxPerDay} isPaid=${isPaid}`);
    return c.json({ success: true, allowed: true, count: countMap[type], maxPerDay, currentCount: realmActivityEntry.count });
  } catch (error) {
    console.error("[PARENT] Use error:", error);
    return c.json({ error: `Failed: ${error.message}` }, 500);
  }
});

// Get parent activity timeline (last 60 days)
app.get("/make-server-221a61bc/parent/activity", async (c) => {
  try {
    const userTokenHeader = c.req.header("X-User-Token");
    const { error: authError, user } = await verifyToken(userTokenHeader);
    if (authError || !user) return c.json({ error: "Unauthorized" }, 401);

    const { data: activities_ } = await supabaseAdmin.from('parent_activities').select('*').eq('parent_id', user.id).order('date', { ascending: false });
    const activities = activities_ || [];
    // Sort by date desc
    activities.sort((a: any, b: any) => (b.date || '').localeCompare(a.date || ''));
    // Cap at last 60 entries
    const recent = activities.slice(0, 60);

    return c.json({ success: true, activities: recent });
  } catch (error) {
    console.error("[PARENT] Activity error:", error);
    return c.json({ error: `Failed: ${error.message}` }, 500);
  }
});

// Get parent referral info
app.get("/make-server-221a61bc/parent/referrals", async (c) => {
  try {
    const userTokenHeader = c.req.header("X-User-Token");
    const { error: authError, user } = await verifyToken(userTokenHeader);
    if (authError || !user) return c.json({ error: "Unauthorized" }, 401);

    const { data: parentData } = await supabaseAdmin.from('parents').select('*').eq('id', user.id).limit(1).single();
    if (!parentData) return c.json({ error: "Parent not found" }, 404);

    // Fetch referral transactions for this parent
    const { data: myTxns_ } = await supabaseAdmin.from('referral_transactions').select('*').eq('referrer_id', user.id);
    const myTxns = myTxns_ || [];

    return c.json({
      success: true,
      referral_code: parentData.referral_code,
      referral_credits: parentData.referral_credits || 0,
      referral_count: parentData.referral_count || 0,
      transactions: myTxns.map((t: any) => ({
        id: t.id,
        amount: t.reward_amount,
        plan: t.plan,
        created_at: t.created_at,
      })),
    });
  } catch (error) {
    console.error("[PARENT] Referrals error:", error);
    return c.json({ error: `Failed: ${error.message}` }, 500);
  }
});

// ===== SUPER ADMIN: VIDEO MANAGER (for Video Mode) =====
app.post("/make-server-221a61bc/admin/videos", async (c) => {
  try {
    const userTokenHeader = c.req.header("X-User-Token");
    const { error: authError, user } = await verifyToken(userTokenHeader);
    if (authError || !user) return c.json({ error: "Unauthorized" }, 401);

    const body = await c.req.json();
    const { title, subtitle, dyntube_key, thumbnail_url, category, duration, episode, is_premium, is_featured, order, language } = body;
    if (!title) return c.json({ error: "title is required" }, 400);
    if (!category) return c.json({ error: "category is required" }, 400);

    const videoId = crypto.randomUUID();
    const videoData = {
      id: videoId,
      title,
      subtitle: subtitle || "",
      dyntube_key: dyntube_key || "",
      thumbnail_url: thumbnail_url || "",
      category: category || "english",
      language: language || "",
      duration: duration || "0:00",
      episode: episode || null,
      series_id: body.series_id || null,
      is_premium: is_premium || false,
      is_featured: is_featured || false,
      order: order || 0,
      status: "active",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await supabaseAdmin.from('videos').upsert(videoData);
    console.log(`[VIDEOS] Created video: ${videoId} — ${title} [${category}] lang=${language || 'none'}`);
    return c.json({ success: true, video: videoData });
  } catch (error) {
    console.error("[VIDEOS] Create error:", error);
    return c.json({ error: `Failed to create video: ${error.message}` }, 500);
  }
});

// Update a video
app.put("/make-server-221a61bc/admin/videos/:id", async (c) => {
  try {
    const userTokenHeader = c.req.header("X-User-Token");
    const { error: authError, user } = await verifyToken(userTokenHeader);
    if (authError || !user) return c.json({ error: "Unauthorized" }, 401);

    const videoId = c.req.param("id");
    const { data: existing } = await supabaseAdmin.from('videos').select('*').eq('id', videoId).limit(1).single();
    if (!existing) return c.json({ error: "Video not found" }, 404);

    const body = await c.req.json();
    const updated = {
      ...existing,
      ...body,
      id: videoId,
      updated_at: new Date().toISOString(),
    };

    await supabaseAdmin.from('videos').update(updated).eq('id', videoId);
    console.log(`[VIDEOS] Updated video: ${videoId} — ${updated.title}`);
    return c.json({ success: true, video: updated });
  } catch (error) {
    console.error("[VIDEOS] Update error:", error);
    return c.json({ error: `Failed to update video: ${error.message}` }, 500);
  }
});

// Delete a video (soft delete)
app.delete("/make-server-221a61bc/admin/videos/:id", async (c) => {
  try {
    const userTokenHeader = c.req.header("X-User-Token");
    const { error: authError, user } = await verifyToken(userTokenHeader);
    if (authError || !user) return c.json({ error: "Unauthorized" }, 401);

    const videoId = c.req.param("id");
    const { data: existing } = await supabaseAdmin.from('videos').select('id').eq('id', videoId).limit(1).single();
    if (!existing) return c.json({ error: "Video not found" }, 404);

    await supabaseAdmin.from('videos').update({ status: "deleted", updated_at: new Date().toISOString() }).eq('id', videoId);
    console.log(`[VIDEOS] Deleted video: ${videoId}`);
    return c.json({ success: true });
  } catch (error) {
    console.error("[VIDEOS] Delete error:", error);
    return c.json({ error: `Failed to delete video: ${error.message}` }, 500);
  }
});

// Upload video thumbnail to R2 (admin only)
app.post("/make-server-221a61bc/admin/videos/upload-thumbnail", async (c) => {
  try {
    const userTokenHeader = c.req.header("X-User-Token");
    const { error: authError, user } = await verifyToken(userTokenHeader);
    if (authError || !user) return c.json({ error: "Unauthorized" }, 401);

    const body = await c.req.json();
    const { data, filename, contentType } = body;

    if (!data || !filename || !contentType) {
      return c.json({ error: "Missing required fields: data (base64), filename, contentType" }, 400);
    }

    const binaryStr = atob(data);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    const ext = filename.split('.').pop() || 'png';
    const r2Key = `video-thumbnails/${crypto.randomUUID()}.${ext}`;

    console.log(`[VIDEO-THUMB] Uploading to R2: ${r2Key} (${contentType}, ${bytes.length} bytes)`);

    const { publicUrl } = await uploadToR2(r2Key, bytes, contentType);

    console.log(`[VIDEO-THUMB] Uploaded to R2: ${r2Key} -> ${publicUrl}`);

    return c.json({
      success: true,
      // Store r2: prefixed key in KV for consistency with other R2 assets
      image_path: `r2:${r2Key}`,
      // Permanent public URL (no expiry!)
      public_url: publicUrl,
      // Keep signed_url field for backward compat (same permanent URL)
      signed_url: publicUrl,
    });
  } catch (error) {
    console.error("[VIDEO-THUMB] Error:", error);
    return c.json({ error: `Thumbnail upload failed: ${error.message}` }, 500);
  }
});

// ===== SERIES MANAGEMENT =====

// Create / update a series
app.post("/make-server-221a61bc/admin/series", async (c) => {
  try {
    const userTokenHeader = c.req.header("X-User-Token");
    const { error: authError, user } = await verifyToken(userTokenHeader);
    if (authError || !user) return c.json({ error: "Unauthorized" }, 401);

    const body = await c.req.json();
    const { id, title, description, thumbnail, category, order } = body;
    if (!title) return c.json({ error: "title is required" }, 400);

    const seriesId = id || crypto.randomUUID();
    const existing = id ? (await supabaseAdmin.from('video_series').select('*').eq('id', id).limit(1).single()).data : null;
    const seriesData = {
      ...(existing || {}),
      id: seriesId,
      title,
      description: description || "",
      thumbnail: thumbnail || "",
      category: category || "english",
      order: order ?? (existing?.order ?? 0),
      status: "active",
      created_at: existing?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await supabaseAdmin.from('video_series').upsert(seriesData);
    console.log(`[SERIES] ${existing ? 'Updated' : 'Created'} series: ${seriesId} — ${title}`);
    return c.json({ success: true, series: seriesData });
  } catch (error) {
    console.error("[SERIES] Save error:", error);
    return c.json({ error: `Failed: ${error.message}` }, 500);
  }
});

// Get all series (public)
app.get("/make-server-221a61bc/series", async (c) => {
  try {
    const { data: allSeriesData } = await supabaseAdmin.from('video_series').select('*');
    const active = (allSeriesData || [])
      .filter((s: any) => s && s.status === "active")
      .sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
    return c.json({ success: true, series: active });
  } catch (error) {
    return c.json({ error: `Failed: ${error.message}` }, 500);
  }
});

// Delete a series (soft delete)
app.delete("/make-server-221a61bc/admin/series/:id", async (c) => {
  try {
    const userTokenHeader = c.req.header("X-User-Token");
    const { error: authError, user } = await verifyToken(userTokenHeader);
    if (authError || !user) return c.json({ error: "Unauthorized" }, 401);

    const seriesId = c.req.param("id");
    const { data: existing } = await supabaseAdmin.from('video_series').select('*').eq('id', seriesId).limit(1).single();
    if (!existing) return c.json({ error: "Series not found" }, 404);

    await supabaseAdmin.from('video_series').update({ status: "deleted", updated_at: new Date().toISOString() }).eq('id', seriesId);
    console.log(`[SERIES] Deleted series: ${seriesId}`);
    return c.json({ success: true });
  } catch (error) {
    return c.json({ error: `Failed: ${error.message}` }, 500);
  }
});

// ===== VIDEO CATEGORIES (dynamic, KV-based) =====

// Get all video categories (public)
app.get("/make-server-221a61bc/video-categories", async (c) => {
  try {
    const { data: cats_ } = await supabaseAdmin.from('video_categories').select('*');
    const cats = cats_ || [];
    const active = cats
      .filter((cat: any) => cat && cat.status !== "deleted")
      .sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
    return c.json({ success: true, categories: active });
  } catch (error) {
    return c.json({ error: `Failed: ${error.message}` }, 500);
  }
});

// Create / update a video category (admin)
app.post("/make-server-221a61bc/admin/video-categories", async (c) => {
  try {
    const userTokenHeader = c.req.header("X-User-Token");
    const { error: authError, user } = await verifyToken(userTokenHeader);
    if (authError || !user) return c.json({ error: "Unauthorized" }, 401);

    const body = await c.req.json();
    const { id, label, order } = body;
    if (!label) return c.json({ error: "label is required" }, 400);

    const catId = id || label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const existing = id ? (await supabaseAdmin.from('video_categories').select('*').eq('id', id).limit(1).single()).data : null;
    const catData = {
      ...(existing || {}),
      id: catId,
      label,
      order: order ?? (existing?.order ?? 0),
      status: "active",
      created_at: existing?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await supabaseAdmin.from('video_categories').upsert(catData);
    console.log(`[VIDEO-CAT] ${existing ? 'Updated' : 'Created'} category: ${catId} — ${label}`);
    return c.json({ success: true, category: catData });
  } catch (error) {
    return c.json({ error: `Failed: ${error.message}` }, 500);
  }
});

// Delete a video category (admin)
app.delete("/make-server-221a61bc/admin/video-categories/:id", async (c) => {
  try {
    const userTokenHeader = c.req.header("X-User-Token");
    const { error: authError, user } = await verifyToken(userTokenHeader);
    if (authError || !user) return c.json({ error: "Unauthorized" }, 401);

    const catId = c.req.param("id");
    const { data: existing } = await supabaseAdmin.from('video_categories').select('*').eq('id', catId).limit(1).single();
    if (!existing) return c.json({ error: "Category not found" }, 404);

    await supabaseAdmin.from('video_categories').update({ status: "deleted", updated_at: new Date().toISOString() }).eq('id', catId);
    console.log(`[VIDEO-CAT] Deleted category: ${catId}`);
    return c.json({ success: true });
  } catch (error) {
    return c.json({ error: `Failed: ${error.message}` }, 500);
  }
});

// ===== DYNTUBE UPLOAD PROXY =====
// Upload a video file to DynTube via their REST API (server-to-server)
// DynTube expects multipart/form-data with the file — single-step upload
app.post("/make-server-221a61bc/admin/dyntube/upload", async (c) => {
  try {
    const userTokenHeader = c.req.header("X-User-Token");
    const { error: authError, user } = await verifyToken(userTokenHeader);
    if (authError || !user) return c.json({ error: "Unauthorized" }, 401);

    const dyntubeApiKey = Deno.env.get("DYNTUBE_API_KEY");
    if (!dyntubeApiKey) return c.json({ error: "DYNTUBE_API_KEY not configured" }, 500);

    // Parse incoming FormData from the frontend
    const formData = await c.req.formData();
    const file = formData.get("file") as File | null;
    const title = (formData.get("title") as string) || "Foxy Video";

    if (!file) {
      return c.json({ error: "No file provided in form data" }, 400);
    }

    console.log(`[DYNTUBE] Uploading video: title="${title}", size=${file.size}, type=${file.type}`);

    // Build FormData for DynTube API
    const dyntubeForm = new FormData();
    dyntubeForm.append("file", file, file.name || "video.mp4");
    dyntubeForm.append("title", title);

    // POST directly to DynTube — they expect multipart/form-data with the file
    const uploadRes = await fetch("https://api.dyntube.com/v1/videos", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${dyntubeApiKey}`,
        // Do NOT set Content-Type — fetch auto-sets it with boundary for FormData
      },
      body: dyntubeForm,
    });

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      console.error(`[DYNTUBE] Upload failed (${uploadRes.status}):`, errText);
      return c.json({
        error: `DynTube upload failed (${uploadRes.status}): ${errText}`,
        status: uploadRes.status,
      }, 500);
    }

    const result = await uploadRes.json();
    console.log("[DYNTUBE] Upload response:", JSON.stringify(result));

    // DynTube typically returns: { id, key, channelKey, status, ... }
    const videoKey = result.key || result.videoKey || result.id || "";
    const videoId = result.id || result.videoId || "";

    if (!videoKey) {
      console.warn("[DYNTUBE] No key in response, returning raw:", result);
      return c.json({
        success: true,
        dyntube_key: "",
        message: "Video uploaded but no key returned. Check DynTube dashboard.",
        raw: result,
      });
    }

    return c.json({
      success: true,
      dyntube_key: videoKey,
      dyntube_id: videoId,
      raw: result,
    });
  } catch (error) {
    console.error("[DYNTUBE] Upload proxy error:", error);
    return c.json({ error: `DynTube upload failed: ${error.message}` }, 500);
  }
});

// Get DynTube video status/info
app.get("/make-server-221a61bc/admin/dyntube/:key", async (c) => {
  try {
    const userTokenHeader = c.req.header("X-User-Token");
    const { error: authError, user } = await verifyToken(userTokenHeader);
    if (authError || !user) return c.json({ error: "Unauthorized" }, 401);

    const dyntubeApiKey = Deno.env.get("DYNTUBE_API_KEY");
    if (!dyntubeApiKey) return c.json({ error: "DYNTUBE_API_KEY not configured" }, 500);

    const videoKey = c.req.param("key");
    const res = await fetch(`https://api.dyntube.com/v1/videos/${videoKey}`, {
      headers: { "Authorization": `Bearer ${dyntubeApiKey}` },
    });

    if (!res.ok) {
      const errText = await res.text();
      return c.json({ error: `DynTube fetch failed: ${errText}` }, 500);
    }

    const data = await res.json();
    return c.json({ success: true, video: data });
  } catch (error) {
    return c.json({ error: `Failed: ${error.message}` }, 500);
  }
});

// Get DynTube playback URL (public — used by video player)
// Calls DynTube API server-side, extracts the actual HLS URL, returns it.
// Caches in KV to avoid repeated API calls.
app.get("/make-server-221a61bc/videos/playback/:key", async (c) => {
  try {
    const videoKey = c.req.param("key");
    if (!videoKey) return c.json({ error: "Missing video key" }, 400);

    // Check PG cache first (cache for 24h)
    const { data: cached } = await supabaseAdmin.from('playback_cache').select('*').eq('video_key', videoKey).limit(1).single();
    if (cached && cached.hls_url && cached.cached_at && (Date.now() - new Date(cached.cached_at).getTime() < 86400000)) {
      console.log(`[DYNTUBE] Playback cache hit for ${videoKey}`);
      return c.json({ success: true, hlsUrl: cached.hls_url, thumbnail: cached.thumbnail || "", cached: true });
    }

    const dyntubeApiKey = Deno.env.get("DYNTUBE_API_KEY");
    if (!dyntubeApiKey) return c.json({ error: "DYNTUBE_API_KEY not configured" }, 500);

    const res = await fetch(`https://api.dyntube.com/v1/videos?search=${videoKey}`, {
      headers: { "Authorization": `Bearer ${dyntubeApiKey}` },
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[DYNTUBE] Playback fetch failed (${res.status}):`, errText);
      return c.json({ error: `DynTube API error: ${errText}` }, 500);
    }

    const data = await res.json();
    console.log(`[DYNTUBE] Full API response for ${videoKey}:`, JSON.stringify(data).slice(0, 2000));

    // DynTube returns various structures — try to extract playback URL
    let video = data;
    if (Array.isArray(data)) {
      video = data.find((v: any) => v.key === videoKey || v.videoKey === videoKey) || data[0];
    } else if (data.videos && Array.isArray(data.videos)) {
      video = data.videos.find((v: any) => v.key === videoKey || v.videoKey === videoKey) || data.videos[0];
    }

    // Try multiple possible field paths for the HLS URL
    const hlsUrl = video?.playback?.hls
      || video?.hlsUrl
      || video?.planUrl
      || video?.hlsPlaybackUrl
      || video?.playbackUrl
      || "";

    const thumbnail = video?.playback?.thumbnail
      || video?.thumbnailUrl
      || video?.thumbnail
      || video?.posterUrl
      || "";

    if (hlsUrl) {
      await supabaseAdmin.from('playback_cache').upsert({ video_key: videoKey, hls_url: hlsUrl, thumbnail, cached_at: new Date().toISOString() }, { onConflict: 'video_key' });
      console.log(`[DYNTUBE] Playback URL resolved for ${videoKey}: ${hlsUrl}`);
    } else {
      console.warn(`[DYNTUBE] Could not extract HLS URL for ${videoKey}. Full video object:`, JSON.stringify(video).slice(0, 1000));
    }

    return c.json({
      success: true,
      hlsUrl,
      thumbnail,
      raw: video,
    });
  } catch (error) {
    console.error("[DYNTUBE] Playback URL error:", error);
    return c.json({ error: `Failed: ${error.message}` }, 500);
  }
});

// ===== PLAY EVENT TRACKING (video/music counts for daily report) =====
app.post("/make-server-221a61bc/parent/play-event", async (c) => {
  try {
    const userTokenHeader = c.req.header("X-User-Token");
    const { error: authError, user } = await verifyToken(userTokenHeader);
    if (authError || !user) return c.json({ error: "Unauthorized" }, 401);

    const body = await c.req.json();
    const { type, videoId, trackId } = body; // type: 'video' | 'music'
    if (!type || (type !== 'video' && type !== 'music')) {
      return c.json({ error: "type must be 'video' or 'music'" }, 400);
    }

    const today = new Date().toISOString().split("T")[0];
    const { data: existingRow } = await supabaseAdmin.from('parent_activities').select('*').eq('parent_id', user.id).eq('date', today).limit(1).single();
    const existing = existingRow || {
      parent_id: user.id,
      date: today, tests: 0, watches: 0, practices: 0,
      questions_total: 0, questions_correct: 0,
      videos_watched: 0, songs_listened: 0,
    };

    if (existing.videos_watched === undefined) existing.videos_watched = 0;
    if (existing.songs_listened === undefined) existing.songs_listened = 0;

    if (type === 'video') {
      existing.videos_watched++;
    } else {
      existing.songs_listened++;
    }

    await supabaseAdmin.from('parent_activities').upsert(existing, { onConflict: 'parent_id,date' });

    // Also track watch history for "Watch Again" feature (video only)
    if (type === 'video' && videoId) {
      await supabaseAdmin.from('watch_history').insert({
        user_id: user.id,
        video_id: videoId,
        watched_at: new Date().toISOString(),
      });
    }

    console.log(`[PLAY-EVENT] ${type} play logged for user ${user.id} on ${today}`);
    return c.json({ success: true });
  } catch (error) {
    console.error("[PLAY-EVENT] Error:", error);
    return c.json({ error: `Failed: ${error.message}` }, 500);
  }
});

// Get watch history for "Watch Again" section
app.get("/make-server-221a61bc/parent/watch-history", async (c) => {
  try {
    const userTokenHeader = c.req.header("X-User-Token");
    const { error: authError, user } = await verifyToken(userTokenHeader);
    if (authError || !user) return c.json({ error: "Unauthorized" }, 401);

    const { data: historyRows } = await supabaseAdmin.from('watch_history').select('video_id, watched_at').eq('user_id', user.id).order('watched_at', { ascending: false }).limit(50);
    const history = (historyRows || []).map((h: any) => ({ videoId: h.video_id, watchedAt: h.watched_at }));
    return c.json({ success: true, history });
  } catch (error) {
    return c.json({ error: `Failed: ${error.message}` }, 500);
  }
});

// Helper: resolve video thumbnail storage paths to viewable URLs
// Handles: r2: prefixed keys (permanent), legacy Supabase Storage paths (signed, 24h), and plain URLs (passthrough)
async function resolveVideoThumbnails(videos: any[]) {
  return Promise.all(videos.map(async (v: any) => {
    if (!v.thumbnail_url) return v;

    // New R2 path: "r2:video-thumbnails/uuid.png" → permanent public URL
    if (isR2Key(v.thumbnail_url)) {
      const actualKey = extractR2Key(v.thumbnail_url);
      return { ...v, thumbnail_url: r2PublicUrl(actualKey) };
    }

    // Legacy Supabase Storage path: "video-thumbnails/uuid.png" → signed URL (24h)
    if (v.thumbnail_url.startsWith('video-thumbnails/')) {
      try {
        const { data } = await supabaseAdmin.storage
          .from(QUEST_IMAGE_BUCKET)
          .createSignedUrl(v.thumbnail_url, 86400);
        return { ...v, thumbnail_url: data?.signedUrl || v.thumbnail_url };
      } catch {
        return v;
      }
    }

    // Already a full URL (https://...) — passthrough
    return v;
  }));
}

// Get all videos + series (public for Video Mode)
app.get("/make-server-221a61bc/videos", async (c) => {
  try {
    const { data: videos_ } = await supabaseAdmin.from('videos').select('*').eq('status', 'active').order('order');
    const resolved = await resolveVideoThumbnails(videos_ || []);

    // Also return active series
    const { data: activeSeries_ } = await supabaseAdmin.from('video_series').select('*').eq('status', 'active').order('order');
    const activeSeries = activeSeries_ || [];

    // Also return video categories
    const { data: activeCats_ } = await supabaseAdmin.from('video_categories').select('*').neq('status', 'deleted').order('order');
    const activeCats = activeCats_ || [];

    return c.json({ success: true, videos: resolved, series: activeSeries, categories: activeCats });
  } catch (error) {
    return c.json({ error: `Failed: ${error.message}` }, 500);
  }
});

// Get all videos for admin (includes all non-deleted)
app.get("/make-server-221a61bc/admin/videos", async (c) => {
  try {
    const userTokenHeader = c.req.header("X-User-Token");
    const { error: authError, user } = await verifyToken(userTokenHeader);
    if (authError || !user) return c.json({ error: "Unauthorized" }, 401);

    const { data: videos_ } = await supabaseAdmin.from('videos').select('*').neq('status', 'deleted').order('order');
    const sorted = videos_ || [];
    const resolved = await resolveVideoThumbnails(sorted);
    return c.json({ success: true, videos: resolved });
  } catch (error) {
    return c.json({ error: `Failed: ${error.message}` }, 500);
  }
});

// ===== KINDERGARTEN: Parent Directory =====
app.get("/make-server-221a61bc/kindergarten/parents", async (c) => {
  try {
    const userTokenHeader = c.req.header("X-User-Token");
    const { error: authError, user } = await verifyToken(userTokenHeader);
    if (authError || !user) return c.json({ error: "Unauthorized" }, 401);

    const { error: schoolError, school } = await getSchoolForUser(user.id);
    if (schoolError || !school) return c.json({ error: "No school found" }, 404);

    // Get all parents with this origin_tag
    const { data: kgParents_ } = await supabaseAdmin.from('parents').select('*').eq('origin_tag', school.id);
    const kgParents = kgParents_ || [];

    const totalSignups = kgParents.length;
    const totalPaid = kgParents.filter((p: any) => p.subscription_status === "active").length;
    const totalEarnings = (school.parent_earnings || 0);

    return c.json({
      success: true,
      total_signups: totalSignups,
      total_paid: totalPaid,
      total_earnings: totalEarnings,
      parents: kgParents.map((p: any) => ({
        id: p.id,
        name: p.name,
        email: p.email,
        plan: p.subscription_plan || "free",
        status: p.subscription_status || "free",
        referral_code: p.referral_code,
        created_at: p.created_at,
      })),
    });
  } catch (error) {
    return c.json({ error: `Failed: ${error.message}` }, 500);
  }
});

/** Map snake_case PG parent_assessments row → camelCase for frontend */
function mapAssessmentRowToCamel(r: any) {
  if (!r) return null;
  return {
    id: r.id,
    parentId: r.parent_id,
    date: r.date,
    timestamp: r.timestamp,
    childAge: r.child_age,
    overallPct: r.overall_pct,
    totalStars: r.total_stars,
    maxStars: r.max_stars,
    tpLevel: r.tp_level,
    readinessPct: r.readiness_pct,
    totalQuestions: r.total_questions,
    totalCorrect: r.total_correct,
    subjectSummary: r.subject_summary,
    createdAt: r.created_at,
  };
}

// Save assessment snapshot for progress-over-time tracking
app.post("/make-server-221a61bc/parent/save-assessment", async (c) => {
  try {
    const userTokenHeader = c.req.header("X-User-Token");
    const { error: authError, user } = await verifyToken(userTokenHeader);
    if (authError || !user) return c.json({ error: "Unauthorized" }, 401);

    const body = await c.req.json();
    const { childAge, overallPct, totalStars, maxStars, tpLevel, readinessPct, subjectSummary, totalQuestions, totalCorrect } = body;

    const timestamp = new Date().toISOString();
    const dateStr = timestamp.split("T")[0];

    const snapshotRow = {
      parent_id: user.id,
      date: dateStr,
      timestamp,
      child_age: childAge || 5,
      overall_pct: overallPct || 0,
      total_stars: totalStars || 0,
      max_stars: maxStars || 0,
      tp_level: tpLevel || 1,
      readiness_pct: readinessPct || 0,
      total_questions: totalQuestions || 0,
      total_correct: totalCorrect || 0,
      subject_summary: subjectSummary || [], // [{ name, pct, functionalAge }]
    };

    await supabaseAdmin.from('parent_assessments').insert(snapshotRow);

    // Also accumulate question counts into the daily activity record
    try {
      const { data: existingActivityRow } = await supabaseAdmin.from('parent_activities').select('*').eq('parent_id', user.id).eq('date', dateStr).limit(1).single();
      const existingActivity = existingActivityRow || { parent_id: user.id, date: dateStr, tests: 0, watches: 0, practices: 0, questions_total: 0, questions_correct: 0 };
      existingActivity.questions_total = (existingActivity.questions_total || 0) + (totalQuestions || 0);
      existingActivity.questions_correct = (existingActivity.questions_correct || 0) + (totalCorrect || 0);
      await supabaseAdmin.from('parent_activities').upsert(existingActivity, { onConflict: 'parent_id,date' });
    } catch (e) {
      console.warn('[PARENT] Failed to update daily activity with question counts:', e);
    }

    console.log(`[PARENT] Saved assessment snapshot for ${user.id} at ${dateStr}`);
    return c.json({ success: true, snapshot });
  } catch (error) {
    console.error("[PARENT] Save assessment error:", error);
    return c.json({ error: `Failed: ${error.message}` }, 500);
  }
});

// Get assessment history for progress-over-time charts
app.get("/make-server-221a61bc/parent/history", async (c) => {
  try {
    const userTokenHeader = c.req.header("X-User-Token");
    const { error: authError, user } = await verifyToken(userTokenHeader);
    if (authError || !user) return c.json({ error: "Unauthorized" }, 401);

    const { data: assessments_ } = await supabaseAdmin.from('parent_assessments').select('*').eq('parent_id', user.id).order('timestamp', { ascending: true });
    const assessments = (assessments_ || []).map(mapAssessmentRowToCamel);

    return c.json({ success: true, assessments });
  } catch (error) {
    console.error("[PARENT] History error:", error);
    return c.json({ error: `Failed: ${error.message}` }, 500);
  }
});

// ===== MARKETING ARTWORK MANAGEMENT =====
// Super admin uploads promotional artwork for KG partners to share.
// Each artwork has platform variants (whatsapp, facebook, instagram) with different dimensions.
// KV key pattern: mkt_artwork:{id}

// Get all active marketing artwork (public for KG dashboard)
app.get("/make-server-221a61bc/marketing/artwork", async (c) => {
  try {
    const { data: artworks_ } = await supabaseAdmin.from('marketing_artworks').select('*').neq('status', 'deleted');
    const active = (artworks_ || [])
      .sort((a: any, b: any) => (a.order || 0) - (b.order || 0));

    // Resolve storage paths to signed URLs
    const resolved = await Promise.all(active.map(async (art: any) => {
      const resolvedVariants: any[] = [];
      for (const variant of (art.variants || [])) {
        if (variant.image_path && !variant.image_path.startsWith('http')) {
          try {
            const { data } = await supabaseAdmin.storage
              .from(QUEST_IMAGE_BUCKET)
              .createSignedUrl(variant.image_path, 86400);
            resolvedVariants.push({ ...variant, signed_url: data?.signedUrl || null });
          } catch {
            resolvedVariants.push({ ...variant, signed_url: null });
          }
        } else {
          resolvedVariants.push({ ...variant, signed_url: variant.image_path || null });
        }
      }
      return { ...art, variants: resolvedVariants };
    }));

    return c.json({ success: true, artworks: resolved });
  } catch (error) {
    console.error("[MARKETING] Fetch artwork error:", error);
    return c.json({ error: `Failed to fetch artwork: ${error.message}` }, 500);
  }
});

// Upload marketing artwork (super admin only)
app.post("/make-server-221a61bc/admin/marketing/artwork", async (c) => {
  try {
    const userTokenHeader = c.req.header("X-User-Token");
    const { error: authError, user } = await verifyToken(userTokenHeader);
    if (authError || !user) return c.json({ error: "Unauthorized" }, 401);

    const role = resolveUserRole(user.email!, user.user_metadata);
    if (role !== "superadmin") return c.json({ error: "Forbidden — super admin only" }, 403);

    const body = await c.req.json();
    const { title, description, platform, width, height, data: imageData, filename, contentType } = body;

    if (!title || !platform || !imageData || !filename || !contentType) {
      return c.json({ error: "Missing required fields: title, platform, data (base64), filename, contentType" }, 400);
    }

    const binaryStr = atob(imageData);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    const ext = filename.split('.').pop() || 'png';
    const storagePath = `marketing/${crypto.randomUUID()}.${ext}`;

    console.log(`[MARKETING] Uploading artwork: ${storagePath} (${platform}, ${width}x${height}, ${bytes.length} bytes)`);

    const { error: uploadError } = await supabaseAdmin.storage
      .from(QUEST_IMAGE_BUCKET)
      .upload(storagePath, bytes, { contentType, upsert: true });

    if (uploadError) {
      console.error("[MARKETING] Upload error:", uploadError);
      return c.json({ error: `Storage upload failed: ${uploadError.message}` }, 500);
    }

    // Check if artwork with this title exists — append variant
    const { data: existingArtworks_ } = await supabaseAdmin.from('marketing_artworks').select('*');
    const existingArtworks = existingArtworks_ || [];
    const existingArt = existingArtworks.find((a: any) => a.title === title && a.status !== "deleted");

    const variant = {
      platform,
      width: width || (platform === 'instagram' ? 1080 : 1200),
      height: height || (platform === 'instagram' ? 1080 : 630),
      image_path: storagePath,
    };

    if (existingArt) {
      existingArt.variants = [...(existingArt.variants || []), variant];
      existingArt.updated_at = new Date().toISOString();
      await supabaseAdmin.from('marketing_artworks').update(existingArt).eq('id', existingArt.id);
      console.log(`[MARKETING] Added ${platform} variant to existing artwork: ${existingArt.id}`);

      const { data: urlData } = await supabaseAdmin.storage
        .from(QUEST_IMAGE_BUCKET)
        .createSignedUrl(storagePath, 86400);

      return c.json({ success: true, artwork: existingArt, variant: { ...variant, signed_url: urlData?.signedUrl || null } });
    }

    const artworkId = crypto.randomUUID();
    const artworkData = {
      id: artworkId,
      title,
      description: description || "",
      variants: [variant],
      status: "active",
      order: existingArtworks.filter((a: any) => a.status !== "deleted").length,
      created_by: user.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await supabaseAdmin.from('marketing_artworks').insert(artworkData);
    console.log(`[MARKETING] Created artwork: ${artworkId} — ${title} (${platform})`);

    const { data: urlData } = await supabaseAdmin.storage
      .from(QUEST_IMAGE_BUCKET)
      .createSignedUrl(storagePath, 86400);

    return c.json({ success: true, artwork: artworkData, variant: { ...variant, signed_url: urlData?.signedUrl || null } });
  } catch (error) {
    console.error("[MARKETING] Upload artwork error:", error);
    return c.json({ error: `Failed to upload artwork: ${error.message}` }, 500);
  }
});

// Delete marketing artwork (super admin only)
app.delete("/make-server-221a61bc/admin/marketing/artwork/:id", async (c) => {
  try {
    const userTokenHeader = c.req.header("X-User-Token");
    const { error: authError, user } = await verifyToken(userTokenHeader);
    if (authError || !user) return c.json({ error: "Unauthorized" }, 401);

    const role = resolveUserRole(user.email!, user.user_metadata);
    if (role !== "superadmin") return c.json({ error: "Forbidden" }, 403);

    const artworkId = c.req.param("id");
    const { data: existing } = await supabaseAdmin.from('marketing_artworks').select('*').eq('id', artworkId).limit(1).single();
    if (!existing) return c.json({ error: "Artwork not found" }, 404);

    for (const variant of (existing.variants || [])) {
      if (variant.image_path && !variant.image_path.startsWith('http')) {
        try {
          await supabaseAdmin.storage.from(QUEST_IMAGE_BUCKET).remove([variant.image_path]);
        } catch {}
      }
    }

    existing.status = "deleted";
    await supabaseAdmin.from('marketing_artworks').update({ status: 'deleted', updated_at: new Date().toISOString() }).eq('id', artworkId);

    console.log(`[MARKETING] Deleted artwork: ${artworkId}`);
    return c.json({ success: true });
  } catch (error) {
    console.error("[MARKETING] Delete artwork error:", error);
    return c.json({ error: `Failed to delete artwork: ${error.message}` }, 500);
  }
});

// Delete a single variant from an artwork (super admin only)
app.delete("/make-server-221a61bc/admin/marketing/artwork/:id/variant/:platform", async (c) => {
  try {
    const userTokenHeader = c.req.header("X-User-Token");
    const { error: authError, user } = await verifyToken(userTokenHeader);
    if (authError || !user) return c.json({ error: "Unauthorized" }, 401);

    const role = resolveUserRole(user.email!, user.user_metadata);
    if (role !== "superadmin") return c.json({ error: "Forbidden" }, 403);

    const artworkId = c.req.param("id");
    const platform = c.req.param("platform");
    const { data: existing } = await supabaseAdmin.from('marketing_artworks').select('*').eq('id', artworkId).limit(1).single();
    if (!existing) return c.json({ error: "Artwork not found" }, 404);

    const variantToRemove = (existing.variants || []).find((v: any) => v.platform === platform);
    if (variantToRemove?.image_path && !variantToRemove.image_path.startsWith('http')) {
      try {
        await supabaseAdmin.storage.from(QUEST_IMAGE_BUCKET).remove([variantToRemove.image_path]);
      } catch {}
    }

    const updatedVariants = (existing.variants || []).filter((v: any) => v.platform !== platform);
    await supabaseAdmin.from('marketing_artworks').update({ variants: updatedVariants, updated_at: new Date().toISOString() }).eq('id', artworkId);
    existing.variants = updatedVariants;

    console.log(`[MARKETING] Removed ${platform} variant from artwork: ${artworkId}`);
    return c.json({ success: true, artwork: existing });
  } catch (error) {
    console.error("[MARKETING] Delete variant error:", error);
    return c.json({ error: `Failed: ${error.message}` }, 500);
  }
});

// ===== SHAREABLE REPORTS =====
// Public shareable report links for kindergarten → parent funnel.
// Reports expire after 30 days unless claimed by a parent account.
// Stored in PG `reports` table with snake_case columns.

/** Map snake_case PG report row → camelCase for frontend */
function mapReportRowToCamel(r: any) {
  if (!r) return null;
  return {
    id: r.id,
    leadId: r.lead_id,
    childName: r.child_name,
    childAge: r.child_age,
    parentName: r.parent_name,
    parentPhone: r.parent_phone,
    schoolId: r.school_id,
    schoolName: r.school_name,
    schoolLogoUrl: r.school_logo_url,
    schoolShortCode: r.school_short_code,
    schoolEmail: r.school_email,
    schoolPhone: r.school_phone,
    schoolWhatsApp: r.school_whatsapp,
    schoolAddress: r.school_address,
    answers: r.answers,
    moduleResults: r.module_results,
    score: r.score,
    totalQuestions: r.total_questions,
    questInfo: r.quest_info,
    createdAt: r.created_at,
    expiresAt: r.expires_at,
    claimedBy: r.claimed_by,
    claimedAt: r.claimed_at,
    viewCount: r.view_count,
    firstViewedAt: r.first_viewed_at,
    lastViewedAt: r.last_viewed_at,
  };
}

// Create a shareable report from a completed lead
app.post("/make-server-221a61bc/reports", async (c) => {
  try {
    const userTokenHeader = c.req.header('X-User-Token');
    const { error: authError, user } = await verifyToken(userTokenHeader);
    if (authError || !user) {
      return c.json({ error: `Unauthorized: ${authError || 'No user'}` }, 401);
    }

    const body = await c.req.json();
    const { leadId } = body;

    if (!leadId) {
      return c.json({ error: 'Missing required field: leadId' }, 400);
    }

    // Check if a report already exists for this lead (dedup)
    const { data: existingReport } = await supabaseAdmin.from('reports').select('*').eq('lead_id', leadId).limit(1).single();
    if (existingReport) {
      console.log(`[REPORT] Existing report found for lead ${leadId}: ${existingReport.id}`);
      return c.json({
        success: true,
        reportId: existingReport.id,
        isExisting: true,
        report: existingReport,
      });
    }

    // Fetch the lead data
    const { data: leadData } = await supabaseAdmin.from('leads').select('*').eq('id', leadId).limit(1).single();
    if (!leadData) {
      return c.json({ error: `Lead not found: ${leadId}` }, 404);
    }

    if (leadData.status !== 'completed') {
      return c.json({ error: 'Cannot create report for incomplete assessment' }, 400);
    }

    // Fetch school data for branding
    const schoolData = leadData.school_id ? (await supabaseAdmin.from('school_accounts').select('*').eq('id', leadData.school_id).limit(1).single()).data : null;

    // Fetch quest configs for name/icon mapping
    const { data: allQuests_ } = await supabaseAdmin.from('quest_configs').select('*').eq('status', 'live');
    const allQuests = allQuests_ || [];
    const questInfo = allQuests
      .filter((q: any) => q.status === 'live')
      .map((q: any) => ({
        id: q.id,
        subject: q.subject,
        name: q.name,
        icon: q.icon,
        is_mandarin: q.is_mandarin || false,
      }));

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days
    const reportId = crypto.randomUUID();

    const reportRow = {
      id: reportId,
      lead_id: leadData.id,
      child_name: leadData.child_name,
      child_age: leadData.child_age || 5,
      parent_name: leadData.parent_name,
      parent_phone: leadData.whatsapp,
      school_id: leadData.school_id,
      school_name: schoolData?.school_name || 'Kindergarten',
      school_logo_url: schoolData?.logo_url || '',
      school_short_code: schoolData?.short_code || '',
      school_email: schoolData?.email || '',
      school_phone: schoolData?.phone || '',
      school_whatsapp: schoolData?.whatsapp_no || '',
      school_address: schoolData?.address || '',
      answers: leadData.answers || [],
      module_results: leadData.quest_results || [],
      score: leadData.score || 0,
      total_questions: leadData.total_questions || 0,
      quest_info: questInfo,
      created_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
      claimed_by: null,
      view_count: 0,
      first_viewed_at: null,
      last_viewed_at: null,
    };

    await supabaseAdmin.from('reports').insert(reportRow);

    console.log(`[REPORT] Created report ${reportId} for lead ${leadId}, expires ${expiresAt.toISOString()}`);

    return c.json({
      success: true,
      reportId,
      isExisting: false,
      report: mapReportRowToCamel(reportRow),
    });
  } catch (error) {
    console.error('[REPORT] Create error:', error);
    return c.json({ error: `Failed to create report: ${error.message}` }, 500);
  }
});

// Get report status for KG dashboard (view count, claimed, etc.)
// IMPORTANT: This static-prefix route MUST be defined BEFORE the dynamic :reportId route
app.get("/make-server-221a61bc/reports/status/:leadId", async (c) => {
  try {
    const leadId = c.req.param('leadId');
    const { data: reportData } = await supabaseAdmin.from('reports').select('*').eq('lead_id', leadId).limit(1).single();

    if (!reportData) {
      return c.json({ success: true, hasReport: false });
    }

    return c.json({
      success: true,
      hasReport: true,
      reportId: reportData.id,
      viewCount: reportData.view_count || 0,
      firstViewedAt: reportData.first_viewed_at,
      lastViewedAt: reportData.last_viewed_at,
      isClaimed: !!reportData.claimed_by,
      claimedAt: reportData.claimed_at || null,
      expiresAt: reportData.expires_at,
    });
  } catch (error) {
    console.error('[REPORT] Status error:', error);
    return c.json({ error: `Failed to get report status: ${error.message}` }, 500);
  }
});

// Get a shareable report (PUBLIC — no auth required)
app.get("/make-server-221a61bc/reports/:reportId", async (c) => {
  try {
    const reportId = c.req.param('reportId');
    if (!reportId) {
      return c.json({ error: 'Missing reportId' }, 400);
    }

    const { data: reportData } = await supabaseAdmin.from('reports').select('*').eq('id', reportId).limit(1).single();
    if (!reportData) {
      return c.json({ error: 'Report not found' }, 404);
    }

    // Check expiry (only for unclaimed reports)
    const now = new Date();
    const expiresAt = new Date(reportData.expires_at);
    const isExpired = !reportData.claimed_by && now > expiresAt;
    const daysRemaining = reportData.claimed_by
      ? null
      : Math.max(0, Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

    // Increment view count (fire-and-forget)
    supabaseAdmin.from('reports').update({
      view_count: (reportData.view_count || 0) + 1,
      first_viewed_at: reportData.first_viewed_at || now.toISOString(),
      last_viewed_at: now.toISOString(),
    }).eq('id', reportId).then(() => {}).catch((err: any) =>
      console.error(`[REPORT] Failed to update view count for ${reportId}:`, err)
    );

    const reportCamel = mapReportRowToCamel(reportData);

    if (isExpired) {
      return c.json({
        success: true,
        expired: true,
        report: {
          id: reportCamel.id,
          childName: reportCamel.childName,
          schoolName: reportCamel.schoolName,
          schoolShortCode: reportCamel.schoolShortCode,
          expiresAt: reportCamel.expiresAt,
          createdAt: reportCamel.createdAt,
        },
      });
    }

    return c.json({
      success: true,
      expired: false,
      daysRemaining,
      isClaimed: !!reportCamel.claimedBy,
      report: reportCamel,
    });
  } catch (error) {
    console.error('[REPORT] Fetch error:', error);
    return c.json({ error: `Failed to fetch report: ${error.message}` }, 500);
  }
});

// Claim a report (link to parent account permanently)
app.post("/make-server-221a61bc/reports/:reportId/claim", async (c) => {
  try {
    const reportId = c.req.param('reportId');
    const userTokenHeader = c.req.header('X-User-Token');
    const { error: authError, user } = await verifyToken(userTokenHeader);

    if (authError || !user) {
      return c.json({ error: `Unauthorized: ${authError || 'No user'}` }, 401);
    }

    const { data: reportData } = await supabaseAdmin.from('reports').select('*').eq('id', reportId).limit(1).single();
    if (!reportData) {
      return c.json({ error: 'Report not found' }, 404);
    }

    if (reportData.claimed_by && reportData.claimed_by !== user.id) {
      return c.json({ error: 'Report already claimed by another user' }, 409);
    }

    // Claim the report
    const claimedAt = new Date().toISOString();
    await supabaseAdmin.from('reports').update({ claimed_by: user.id, claimed_at: claimedAt }).eq('id', reportId);

    // Also link to parent profile
    const { data: parentData } = await supabaseAdmin.from('parents').select('*').eq('id', user.id).limit(1).single();
    if (parentData) {
      const reports = parentData.claimed_reports || [];
      if (!reports.includes(reportId)) {
        reports.push(reportId);
        await supabaseAdmin.from('parents').update({
          claimed_reports: reports,
          child_name: parentData.child_name || reportData.child_name,
          child_age: parentData.child_age || reportData.child_age,
          updated_at: new Date().toISOString(),
        }).eq('id', user.id);
      }
    }

    console.log(`[REPORT] Report ${reportId} claimed by parent ${user.id}`);

    const updatedReportCamel = mapReportRowToCamel({ ...reportData, claimed_by: user.id, claimed_at: claimedAt });
    return c.json({ success: true, report: updatedReportCamel });
  } catch (error) {
    console.error('[REPORT] Claim error:', error);
    return c.json({ error: `Failed to claim report: ${error.message}` }, 500);
  }
});

// ===== KG REFERRAL SOURCES (for KG Dashboard) =====
app.get("/make-server-221a61bc/referrals/school-sources", async (c) => {
  try {
    const userTokenHeader = c.req.header("X-User-Token");
    const { error: authError, user } = await verifyToken(userTokenHeader);
    if (authError || !user) return c.json({ error: "Unauthorized" }, 401);

    const { error: schoolError, school } = await getSchoolForUser(user.id);
    if (schoolError || !school) return c.json({ error: "No school found for user" }, 404);

    const schoolId = school.id;

    // Get all leads for this school
    const { data: allLeads_ } = await supabaseAdmin.from('leads').select('*').eq('school_id', schoolId);
    const allLeads = allLeads_ || [];
    console.log(`[REFERRAL] Fetching sources for school ${schoolId}: ${allLeads.length} leads`);

    let directCount = 0;
    let referralCount = 0;
    const referrerMap: Record<string, { parentId: string; count: number; convertedCount: number; lastReferralAt: string }> = {};

    for (const lead of allLeads) {
      if (lead.source === 'referral' && lead.referred_by_parent_id) {
        referralCount++;
        const pid = lead.referred_by_parent_id;
        if (!referrerMap[pid]) {
          referrerMap[pid] = { parentId: pid, count: 0, convertedCount: 0, lastReferralAt: '' };
        }
        referrerMap[pid].count++;
        // Check if this lead's parent signed up (report claimed)
        if (lead.status === 'claimed' || lead.is_claimed) {
          referrerMap[pid].convertedCount++;
        }
        const leadDate = lead.created_at || lead.updated_at || '';
        if (leadDate > referrerMap[pid].lastReferralAt) {
          referrerMap[pid].lastReferralAt = leadDate;
        }
      } else {
        directCount++;
      }
    }

    // Resolve parent names for top referrers
    const topReferrers = Object.values(referrerMap)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const enrichedReferrers = [];
    for (const ref of topReferrers) {
      let parentName = 'Unknown Parent';
      try {
        const { data: parentRow } = await supabaseAdmin.from('parents').select('name').eq('id', ref.parentId).limit(1).single();
        if (parentRow?.name) parentName = parentRow.name;
      } catch (_) {}

      // Also check report statuses for conversion
      const referredLeads = allLeads.filter((l: any) => l.referred_by_parent_id === ref.parentId);
      let signedUp = 0;
      if (referredLeads.length > 0) {
        const leadIds = referredLeads.map((rl: any) => rl.id);
        const { data: claimedReports } = await supabaseAdmin.from('reports').select('id').in('lead_id', leadIds).not('claimed_by', 'is', null);
        signedUp = claimedReports?.length || 0;
      }

      enrichedReferrers.push({
        parentId: ref.parentId,
        parentName,
        referrals: ref.count,
        signedUp,
        lastReferralAt: ref.lastReferralAt,
      });
    }

    return c.json({
      success: true,
      sources: {
        total: allLeads.length,
        direct: directCount,
        referral: referralCount,
      },
      topReferrers: enrichedReferrers,
    });
  } catch (error) {
    console.error("[REFERRAL] School sources error:", error);
    return c.json({ error: `Failed: ${error.message}` }, 500);
  }
});

// ===== PARENT: ENHANCED REFERRAL NETWORK =====
app.get("/make-server-221a61bc/parent/referral-network", async (c) => {
  try {
    const userTokenHeader = c.req.header("X-User-Token");
    const { error: authError, user } = await verifyToken(userTokenHeader);
    if (authError || !user) return c.json({ error: "Unauthorized" }, 401);

    const { data: parentData } = await supabaseAdmin.from('parents').select('*').eq('id', user.id).limit(1).single();
    if (!parentData) return c.json({ error: "Parent not found" }, 404);

    // 1. Who referred me
    let referredByInfo = null;
    if (parentData.referred_by) {
      try {
        const { data: referrerData } = await supabaseAdmin.from('parents').select('name, origin_tag').eq('referral_code', parentData.referred_by).limit(1).single();
        if (referrerData) {
          let kgName = null;
          if (referrerData.origin_tag) {
            const { data: kgData } = await supabaseAdmin.from('school_accounts').select('school_name, name').eq('id', referrerData.origin_tag).limit(1).single();
            if (kgData) kgName = kgData.school_name || kgData.name;
          }
          referredByInfo = {
            name: referrerData.name || 'A fellow parent',
            kindergarten: kgName,
          };
        }
      } catch (_) {}
    }

    // 2. People I've referred
    const myReferrals: any[] = [];
    try {
      const { data: referredLeads } = await supabaseAdmin.from('leads').select('*').eq('referred_by_parent_id', user.id);
      for (const lead of (referredLeads || [])) {
        let status = 'test_started';
        if (lead.status === 'completed') status = 'test_completed';
        try {
          const { data: report } = await supabaseAdmin.from('reports').select('id, claimed_by, view_count').eq('lead_id', lead.id).limit(1).single();
          if (report) {
            if (report.claimed_by) status = 'signed_up';
            else if ((report.view_count || 0) > 0) status = 'report_viewed';
            else status = 'report_sent';
          }
        } catch (_) {}

        myReferrals.push({
          leadId: lead.id,
          childName: lead.child_name,
          parentName: lead.parent_name,
          status,
          date: lead.created_at,
        });
      }
    } catch (_) {}

    // 3. Summary stats
    const totalReferred = myReferrals.length;
    const signedUpCount = myReferrals.filter(r => r.status === 'signed_up').length;

    return c.json({
      success: true,
      referredBy: referredByInfo,
      referralCode: parentData.referral_code,
      myReferrals,
      stats: { totalReferred, signedUpCount },
    });
  } catch (error) {
    console.error("[PARENT] Referral network error:", error);
    return c.json({ error: `Failed: ${error.message}` }, 500);
  }
});

// ═══════════════════════════════════════════════════════════
// MEDIA MANAGER — Audio Tracks & Dynamic Categories
// ═══════════════════════════════════════════════════════════
// KV key patterns:
//   media_category:{id}       — category metadata (type: 'video' | 'audio')
//   media_audio:{id}          — audio track metadata

// ── List all media categories ──
app.get("/make-server-221a61bc/media/categories", async (c) => {
  try {
    const categories = await kv.getByPrefix('media_category:');
    categories.sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
    return c.json({ success: true, categories });
  } catch (error) {
    console.error('[MEDIA] Fetch categories error:', error);
    return c.json({ error: `Failed to fetch categories: ${error.message}` }, 500);
  }
});

// ── Create / update a media category (auth required) ──
app.post("/make-server-221a61bc/media/categories", async (c) => {
  try {
    const userTokenHeader = c.req.header('X-User-Token');
    const { error: authError, user } = await verifyToken(userTokenHeader);
    if (authError || !user) return c.json({ error: 'Unauthorized' }, 401);

    const body = await c.req.json();
    const { id, name, type, icon, color, order } = body;

    if (!name || !type || !['video', 'audio'].includes(type)) {
      return c.json({ error: 'name and type (video|audio) are required' }, 400);
    }

    const catId = id || crypto.randomUUID();
    const existing = id ? await kv.get(`media_category:${id}`) : null;

    const categoryData = {
      id: catId,
      name: name.trim(),
      type,
      icon: icon || '🎵',
      color: color || '#d4a44a',
      order: order ?? (existing?.order ?? 0),
      created_at: existing?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await kv.set(`media_category:${catId}`, categoryData);
    console.log(`[MEDIA] Category saved: ${catId} (${name}, ${type})`);
    return c.json({ success: true, category: categoryData });
  } catch (error) {
    console.error('[MEDIA] Save category error:', error);
    return c.json({ error: `Failed to save category: ${error.message}` }, 500);
  }
});

// ── Delete a media category (auth required) ──
app.delete("/make-server-221a61bc/media/categories/:id", async (c) => {
  try {
    const userTokenHeader = c.req.header('X-User-Token');
    const { error: authError, user } = await verifyToken(userTokenHeader);
    if (authError || !user) return c.json({ error: 'Unauthorized' }, 401);

    const catId = c.req.param('id');
    await kv.del(`media_category:${catId}`);
    console.log(`[MEDIA] Category deleted: ${catId}`);
    return c.json({ success: true });
  } catch (error) {
    console.error('[MEDIA] Delete category error:', error);
    return c.json({ error: `Failed to delete category: ${error.message}` }, 500);
  }
});

// ── List all audio tracks (admin, auth required) ──
app.get("/make-server-221a61bc/media/audio", async (c) => {
  try {
    const userTokenHeader = c.req.header('X-User-Token');
    const { error: authError, user } = await verifyToken(userTokenHeader);
    if (authError || !user) return c.json({ error: 'Unauthorized' }, 401);

    const tracks = await kv.getByPrefix('media_audio:');
    tracks.sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
    // Resolve r2: / Supabase Storage paths to displayable URLs for the admin UI
    const resolved = await resolveAudioUrls(tracks);
    console.log(`[MEDIA] Admin audio tracks: ${resolved.length}`);
    return c.json({ success: true, tracks: resolved });
  } catch (error) {
    console.error('[MEDIA] Fetch audio tracks error:', error);
    return c.json({ error: `Failed to fetch audio: ${error.message}` }, 500);
  }
});

// ── Public audio tracks (for parent browsing, no auth) ──
app.get("/make-server-221a61bc/media/audio/public", async (c) => {
  try {
    const tracks = await kv.getByPrefix('media_audio:');
    const publicTracks = tracks
      .filter((t: any) => t.status !== 'draft')
      .map((t: any) => ({
        id: t.id,
        title: t.title,
        artist: t.artist,
        album_art: t.album_art,
        audio_url: t.audio_url,
        duration: t.duration,
        duration_sec: t.duration_sec,
        category: t.category,
        is_premium: t.is_premium,
        is_featured: t.is_featured,
        order: t.order,
      }))
      .sort((a: any, b: any) => (a.order || 0) - (b.order || 0));

    // Resolve storage paths to signed URLs for playback
    const resolved = await resolveAudioUrls(publicTracks);

    const categories = (await kv.getByPrefix('media_category:'))
      .filter((c: any) => c.type === 'audio')
      .sort((a: any, b: any) => (a.order || 0) - (b.order || 0));

    return c.json({ success: true, tracks: resolved, categories });
  } catch (error) {
    console.error('[MEDIA] Public audio error:', error);
    return c.json({ error: `Failed: ${error.message}` }, 500);
  }
});

// ── Create / update audio track (auth required) ──
app.post("/make-server-221a61bc/media/audio", async (c) => {
  try {
    const userTokenHeader = c.req.header('X-User-Token');
    const { error: authError, user } = await verifyToken(userTokenHeader);
    if (authError || !user) return c.json({ error: 'Unauthorized' }, 401);

    const body = await c.req.json();
    const { id, title, artist, album_art, audio_url, duration, duration_sec, category, is_premium, is_featured, order, status } = body;

    if (!title) return c.json({ error: 'title is required' }, 400);

    const trackId = id || crypto.randomUUID();
    const existing = id ? await kv.get(`media_audio:${id}`) : null;

    const trackData = {
      id: trackId,
      title: title.trim(),
      artist: (artist || 'Foxy & Friends').trim(),
      album_art: unresolveR2Url(album_art || ''),
      audio_url: unresolveR2Url(audio_url || ''),
      duration: duration || '0:00',
      duration_sec: duration_sec || 0,
      category: category || 'general',
      is_premium: is_premium || false,
      is_featured: is_featured || false,
      order: order ?? (existing?.order ?? 0),
      status: status || 'active',
      created_by: existing?.created_by || user.id,
      created_at: existing?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await kv.set(`media_audio:${trackId}`, trackData);
    console.log(`[MEDIA] Audio track saved: ${trackId} (${title})`);
    return c.json({ success: true, track: trackData });
  } catch (error) {
    console.error('[MEDIA] Save audio track error:', error);
    return c.json({ error: `Failed to save track: ${error.message}` }, 500);
  }
});

// ── Delete audio track (auth required) ──
app.delete("/make-server-221a61bc/media/audio/:id", async (c) => {
  try {
    const userTokenHeader = c.req.header('X-User-Token');
    const { error: authError, user } = await verifyToken(userTokenHeader);
    if (authError || !user) return c.json({ error: 'Unauthorized' }, 401);

    const trackId = c.req.param('id');
    // Clean up storage files (R2 + legacy Supabase Storage)
    const existing = await kv.get(`media_audio:${trackId}`);
    if (existing) {
      const r2KeysToDelete: string[] = [];
      const supabasePathsToDelete: string[] = [];

      // Audio file
      if (existing.audio_url) {
        if (isR2Key(existing.audio_url)) {
          r2KeysToDelete.push(extractR2Key(existing.audio_url));
        } else if (existing.audio_url.startsWith('audio-files/')) {
          supabasePathsToDelete.push(existing.audio_url);
        }
      }
      // Album art
      if (existing.album_art) {
        if (isR2Key(existing.album_art)) {
          r2KeysToDelete.push(extractR2Key(existing.album_art));
        } else if (existing.album_art.startsWith('audio-art/')) {
          supabasePathsToDelete.push(existing.album_art);
        }
      }

      if (r2KeysToDelete.length > 0) {
        await deleteMultipleFromR2(r2KeysToDelete);
        console.log(`[MEDIA] Cleaned up R2 for track ${trackId}:`, r2KeysToDelete);
      }
      if (supabasePathsToDelete.length > 0) {
        await supabaseAdmin.storage.from(QUEST_IMAGE_BUCKET).remove(supabasePathsToDelete);
        console.log(`[MEDIA] Cleaned up Supabase Storage for track ${trackId}:`, supabasePathsToDelete);
      }
    }
    await kv.del(`media_audio:${trackId}`);
    console.log(`[MEDIA] Audio track deleted: ${trackId}`);
    return c.json({ success: true });
  } catch (error) {
    console.error('[MEDIA] Delete audio track error:', error);
    return c.json({ error: `Failed to delete track: ${error.message}` }, 500);
  }
});

// ── Upload audio file to Cloudflare R2 (admin only) ──
// Accepts multipart FormData with a 'file' field (no base64 overhead)
app.post("/make-server-221a61bc/media/audio/upload", async (c) => {
  try {
    const userTokenHeader = c.req.header('X-User-Token');
    const { error: authError, user } = await verifyToken(userTokenHeader);
    if (authError || !user) return c.json({ error: 'Unauthorized' }, 401);

    const formData = await c.req.formData();
    const file = formData.get('file') as File | null;
    if (!file) {
      return c.json({ error: 'Missing file in form data' }, 400);
    }

    const contentType = file.type || 'audio/mpeg';
    if (!contentType.startsWith('audio/')) {
      return c.json({ error: `Invalid type: ${contentType}. Must be audio/*` }, 400);
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes.length > 50 * 1024 * 1024) {
      return c.json({ error: 'Audio file too large. Max 50MB.' }, 400);
    }

    const ext = (file.name || 'track.mp3').split('.').pop() || 'mp3';
    const r2Key = `audio/${crypto.randomUUID()}.${ext}`;
    console.log(`[AUDIO-UPLOAD] Uploading to R2: ${r2Key} (${contentType}, ${bytes.length} bytes)`);

    const { publicUrl } = await uploadToR2(r2Key, bytes, contentType);

    const storedPath = `r2:${r2Key}`;
    console.log(`[AUDIO-UPLOAD] R2 success: ${storedPath} → ${publicUrl}`);
    return c.json({ success: true, audio_path: storedPath, signed_url: publicUrl });
  } catch (error: any) {
    console.error('[AUDIO-UPLOAD] Error:', error);
    return c.json({ error: `Audio upload failed: ${error.message}` }, 500);
  }
});

// ── Upload album art to Cloudflare R2 (admin only) ──
// Accepts multipart FormData with a 'file' field (no base64 overhead)
app.post("/make-server-221a61bc/media/audio/upload-art", async (c) => {
  try {
    const userTokenHeader = c.req.header('X-User-Token');
    const { error: authError, user } = await verifyToken(userTokenHeader);
    if (authError || !user) return c.json({ error: 'Unauthorized' }, 401);

    const formData = await c.req.formData();
    const file = formData.get('file') as File | null;
    if (!file) {
      return c.json({ error: 'Missing file in form data' }, 400);
    }

    const contentType = file.type || 'image/jpeg';
    if (!contentType.startsWith('image/')) {
      return c.json({ error: `Invalid type: ${contentType}. Must be image/*` }, 400);
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes.length > 5 * 1024 * 1024) {
      return c.json({ error: 'Image too large. Max 5MB.' }, 400);
    }

    const ext = (file.name || 'art.jpg').split('.').pop() || 'jpg';
    const r2Key = `art/${crypto.randomUUID()}.${ext}`;
    console.log(`[AUDIO-ART] Uploading to R2: ${r2Key} (${contentType}, ${bytes.length} bytes)`);

    const { publicUrl } = await uploadToR2(r2Key, bytes, contentType);

    const storedPath = `r2:${r2Key}`;
    console.log(`[AUDIO-ART] R2 success: ${storedPath} → ${publicUrl}`);
    return c.json({ success: true, image_path: storedPath, signed_url: publicUrl });
  } catch (error: any) {
    console.error('[AUDIO-ART] Error:', error);
    return c.json({ error: `Album art upload failed: ${error.message}` }, 500);
  }
});

// ── Get resolved audio URL for playback ──
app.get("/make-server-221a61bc/media/audio-url/:trackId", async (c) => {
  try {
    const trackId = c.req.param('trackId');
    const track = await kv.get(`media_audio:${trackId}`);
    if (!track) return c.json({ error: 'Track not found' }, 404);

    let resolvedAudioUrl = track.audio_url || '';
    let resolvedArtUrl = track.album_art || '';

    // R2 paths (new): "r2:audio/uuid.mp3" → public URL
    if (isR2Key(resolvedAudioUrl)) {
      resolvedAudioUrl = r2PublicUrl(extractR2Key(resolvedAudioUrl));
    }
    // Legacy Supabase Storage paths: "audio-files/uuid.mp3" → signed URL
    else if (resolvedAudioUrl.startsWith('audio-files/')) {
      const { data } = await supabaseAdmin.storage
        .from(QUEST_IMAGE_BUCKET)
        .createSignedUrl(resolvedAudioUrl, 3600);
      resolvedAudioUrl = data?.signedUrl || resolvedAudioUrl;
    }

    if (isR2Key(resolvedArtUrl)) {
      resolvedArtUrl = r2PublicUrl(extractR2Key(resolvedArtUrl));
    } else if (resolvedArtUrl.startsWith('audio-art/')) {
      const { data } = await supabaseAdmin.storage
        .from(QUEST_IMAGE_BUCKET)
        .createSignedUrl(resolvedArtUrl, 86400);
      resolvedArtUrl = data?.signedUrl || resolvedArtUrl;
    }

    return c.json({ success: true, audio_url: resolvedAudioUrl, album_art: resolvedArtUrl });
  } catch (error: any) {
    console.error('[MEDIA] Audio URL error:', error);
    return c.json({ error: `Failed: ${error.message}` }, 500);
  }
});

// ── Helper: resolve audio storage paths to playable URLs ──
// Supports both R2 (new: "r2:audio/...") and legacy Supabase Storage ("audio-files/...")
async function resolveAudioUrls(tracks: any[]) {
  return Promise.all(tracks.map(async (t: any) => {
    let audio_url = t.audio_url || '';
    let album_art = t.album_art || '';

    // Audio URL resolution
    if (isR2Key(audio_url)) {
      audio_url = r2PublicUrl(extractR2Key(audio_url));
    } else if (audio_url.startsWith('audio-files/')) {
      try {
        const { data } = await supabaseAdmin.storage.from(QUEST_IMAGE_BUCKET).createSignedUrl(audio_url, 3600);
        audio_url = data?.signedUrl || audio_url;
      } catch {}
    }

    // Album art resolution
    if (isR2Key(album_art)) {
      album_art = r2PublicUrl(extractR2Key(album_art));
    } else if (album_art.startsWith('audio-art/')) {
      try {
        const { data } = await supabaseAdmin.storage.from(QUEST_IMAGE_BUCKET).createSignedUrl(album_art, 86400);
        album_art = data?.signedUrl || album_art;
      } catch {}
    }

    return { ...t, audio_url, album_art };
  }));
}

// ===================================================================
// ===== KG ↔ PARENT CONNECTION =====
// ===================================================================

// Parent: Connect to a kindergarten using its short code
app.post("/make-server-221a61bc/parent/connect-kg", async (c) => {
  try {
    const userTokenHeader = c.req.header("X-User-Token");
    const { error: authError, user } = await verifyToken(userTokenHeader);
    if (authError || !user) return c.json({ error: "Unauthorized" }, 401);

    const { code } = await c.req.json();
    if (!code) return c.json({ error: "Missing code" }, 400);

    const upperCode = code.trim().toUpperCase();

    let schoolData: any = null;
    const { data: byCode } = await supabaseAdmin.from('school_accounts').select('*').ilike('short_code', upperCode).limit(1).single();
    if (byCode) {
      schoolData = byCode;
    } else {
      const { data: byUrl } = await supabaseAdmin.from('school_accounts').select('*').eq('kindergarten_url', code.trim()).limit(1).single();
      if (byUrl) schoolData = byUrl;
    }
    if (!schoolData) {
      return c.json({ error: "Invalid kindergarten code. Please check and try again." }, 404);
    }

    const { data: parentData } = await supabaseAdmin.from('parents').select('*').eq('id', user.id).limit(1).single();
    if (!parentData) return c.json({ error: "Parent record not found" }, 404);

    if (parentData.kg_connection?.kgId === schoolData.id) {
      return c.json({ error: "Already connected to this kindergarten." }, 400);
    }

    // Remove old KV connection if switching KGs
    if (parentData.kg_connection?.kgId) {
      try { await kv.del(`kg_student:${parentData.kg_connection.kgId}:${user.id}`); } catch (_) {}
    }

    const connectedAt = new Date().toISOString();
    const connection = {
      kgId: schoolData.id,
      kgName: schoolData.school_name,
      shortCode: schoolData.short_code || upperCode,
      kgLogoUrl: schoolData.logo_url || '',
      connectedAt,
    };

    await supabaseAdmin.from('parents').update({
      kg_connection: connection,
      updated_at: connectedAt,
    }).eq('id', user.id);

    // KG-Parent connections stay on KV (no kg_students PG table)
    await kv.set(`kg_student:${schoolData.id}:${user.id}`, {
      kgId: schoolData.id, kgName: schoolData.school_name,
      parentId: user.id, parentName: parentData.name || '',
      parentEmail: parentData.email || '', childName: parentData.child_name || '',
      childAge: parentData.child_age || 0, connectedAt,
    });

    console.log(`[KG-CONNECT] Parent ${user.id} connected to KG ${schoolData.id} (${schoolData.school_name})`);
    return c.json({ success: true, connection });
  } catch (error) {
    console.error("[KG-CONNECT] Error:", error);
    return c.json({ error: `Failed to connect: ${error.message}` }, 500);
  }
});

// Parent: Disconnect from their kindergarten
app.delete("/make-server-221a61bc/parent/connect-kg", async (c) => {
  try {
    const userTokenHeader = c.req.header("X-User-Token");
    const { error: authError, user } = await verifyToken(userTokenHeader);
    if (authError || !user) return c.json({ error: "Unauthorized" }, 401);

    const { data: parentData } = await supabaseAdmin.from('parents').select('*').eq('id', user.id).limit(1).single();
    if (!parentData) return c.json({ error: "Parent record not found" }, 404);

    const kgId = parentData.kg_connection?.kgId;
    if (!kgId) return c.json({ error: "Not connected to any kindergarten" }, 400);

    try { await kv.del(`kg_student:${kgId}:${user.id}`); } catch (_) {}

    await supabaseAdmin.from('parents').update({
      kg_connection: null,
      updated_at: new Date().toISOString(),
    }).eq('id', user.id);

    console.log(`[KG-DISCONNECT] Parent ${user.id} disconnected from KG ${kgId}`);
    return c.json({ success: true });
  } catch (error) {
    console.error("[KG-DISCONNECT] Error:", error);
    return c.json({ error: `Failed to disconnect: ${error.message}` }, 500);
  }
});

// KG: List all connected students (KV-based — no kg_students PG table)
app.get("/make-server-221a61bc/kg/students", async (c) => {
  try {
    const userTokenHeader = c.req.header("X-User-Token");
    const { error: authError, user } = await verifyToken(userTokenHeader);
    if (authError || !user) return c.json({ error: "Unauthorized" }, 401);

    const { error: schoolError, school } = await getSchoolForUser(user.id);
    if (schoolError || !school) return c.json({ error: "School not found" }, 404);

    const studentEntries = await kv.getByPrefix(`kg_student:${school.id}:`);
    const students = (studentEntries || [])
      .map((e: any) => (typeof e === 'string' ? JSON.parse(e) : e))
      .sort((a: any, b: any) => (b.connectedAt || '').localeCompare(a.connectedAt || ''));

    console.log(`[KG-STUDENTS] ${school.school_name}: ${students.length} connected students`);
    return c.json({ success: true, students });
  } catch (error) {
    console.error("[KG-STUDENTS] Error:", error);
    return c.json({ error: `Failed to fetch students: ${error.message}` }, 500);
  }
});

// KG: Get detailed data for one student (profile + assessments + activity)
app.get("/make-server-221a61bc/kg/student/:parentId", async (c) => {
  try {
    const userTokenHeader = c.req.header("X-User-Token");
    const { error: authError, user } = await verifyToken(userTokenHeader);
    if (authError || !user) return c.json({ error: "Unauthorized" }, 401);

    const { error: schoolError, school } = await getSchoolForUser(user.id);
    if (schoolError || !school) return c.json({ error: "School not found" }, 404);

    const parentId = c.req.param("parentId");
    // Verify student is connected to this KG via KV
    const studentRecordRaw = await kv.get(`kg_student:${school.id}:${parentId}`);
    if (!studentRecordRaw) return c.json({ error: "Student not connected to your kindergarten" }, 404);
    const studentRecord = typeof studentRecordRaw === 'string' ? JSON.parse(studentRecordRaw) : studentRecordRaw;

    const { data: parentData } = await supabaseAdmin.from('parents').select('*').eq('id', parentId).limit(1).single();
    if (!parentData) return c.json({ error: "Parent record not found" }, 404);

    const { data: assessments_ } = await supabaseAdmin.from('parent_assessments').select('*').eq('parent_id', parentId).order('timestamp', { ascending: true });
    const assessments = (assessments_ || []).map(mapAssessmentRowToCamel);

    const { data: activities_ } = await supabaseAdmin.from('parent_activities').select('*').eq('parent_id', parentId).order('date', { ascending: false });
    const activities = activities_ || [];

    return c.json({
      success: true,
      student: {
        parentId, parentName: parentData.name || '', parentEmail: parentData.email || '',
        childName: parentData.child_name || '', childAge: parentData.child_age || 0,
        subscriptionStatus: parentData.subscription_status || 'free',
        connectedAt: studentRecord.connectedAt,
        totalTests: parentData.total_tests || 0,
        totalWatches: parentData.total_watches || 0,
        totalPractices: parentData.total_practices || 0,
        totalPracticeQuestions: parentData.total_practice_questions || 0,
      },
      assessments,
      activities: activities.slice(0, 60),
    });
  } catch (error) {
    console.error("[KG-STUDENT-DETAIL] Error:", error);
    return c.json({ error: `Failed to fetch student detail: ${error.message}` }, 500);
  }
});

// KG: Disconnect a student (KV-based)
app.delete("/make-server-221a61bc/kg/student/:parentId", async (c) => {
  try {
    const userTokenHeader = c.req.header("X-User-Token");
    const { error: authError, user } = await verifyToken(userTokenHeader);
    if (authError || !user) return c.json({ error: "Unauthorized" }, 401);

    const { error: schoolError, school } = await getSchoolForUser(user.id);
    if (schoolError || !school) return c.json({ error: "School not found" }, 404);

    const parentId = c.req.param("parentId");
    const studentRecord = await kv.get(`kg_student:${school.id}:${parentId}`);
    if (!studentRecord) return c.json({ error: "Student not found in your school" }, 404);

    await kv.del(`kg_student:${school.id}:${parentId}`);

    try {
      const { data: parentData } = await supabaseAdmin.from('parents').select('kg_connection').eq('id', parentId).limit(1).single();
      if (parentData?.kg_connection?.kgId === school.id) {
        await supabaseAdmin.from('parents').update({
          kg_connection: null,
          updated_at: new Date().toISOString(),
        }).eq('id', parentId);
      }
    } catch (_) {}

    console.log(`[KG-STUDENT-DISCONNECT] KG ${school.id} disconnected student ${parentId}`);
    return c.json({ success: true });
  } catch (error) {
    console.error("[KG-STUDENT-DISCONNECT] Error:", error);
    return c.json({ error: `Failed to disconnect student: ${error.message}` }, 500);
  }
});

// ===== FLASHCARD SYSTEM =====
// KV patterns:
//   fc_category:{id}  → { id, name_en, name_bm, name_zh, emoji, color, order, created_at }
//   fc_card:{id}      → { id, category_id, word_en, word_bm, word_zh, image_key, video_key, audio_en_key, audio_bm_key, audio_zh_key, order, created_at }

const FC_R2_PREFIX = "flashcards/";

// ── List categories (public) ──
app.get("/make-server-221a61bc/flashcards/categories", async (c) => {
  try {
    const cats = await kv.getByPrefix("fc_category:");
    cats.sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
    const resolved = cats.map((cat: any) => ({
      ...cat,
      image_url: cat.image_key ? r2PublicUrl(cat.image_key) : null,
    }));
    return c.json({ success: true, categories: resolved });
  } catch (error) {
    return c.json({ error: `Failed to fetch categories: ${error.message}` }, 500);
  }
});

// ── Create/update category (admin auth) ──
app.post("/make-server-221a61bc/flashcards/categories", async (c) => {
  try {
    const userTokenHeader = c.req.header("X-User-Token");
    const { error: authError, user } = await verifyToken(userTokenHeader);
    if (authError || !user) return c.json({ error: "Unauthorized" }, 401);

    const body = await c.req.json();
    const { id, name_en, name_bm, name_zh, emoji, color, order, image_key } = body;
    if (!name_en) return c.json({ error: "name_en is required" }, 400);

    const catId = id || crypto.randomUUID();
    const existing = id ? await kv.get(`fc_category:${id}`) : null;

    const catData = {
      ...(existing || {}),
      id: catId,
      name_en: name_en || "",
      name_bm: name_bm || name_en || "",
      name_zh: name_zh || name_en || "",
      emoji: emoji || "📚",
      color: color || "#7cc643",
      image_key: image_key || existing?.image_key || null,
      order: order ?? existing?.order ?? 0,
      created_at: existing?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await kv.set(`fc_category:${catId}`, catData);
    console.log(`[FLASHCARDS] Category ${id ? "updated" : "created"}: ${catId} — ${name_en}`);
    return c.json({ success: true, category: { ...catData, image_url: catData.image_key ? r2PublicUrl(catData.image_key) : null } });
  } catch (error) {
    return c.json({ error: `Failed to save category: ${error.message}` }, 500);
  }
});

// ── Delete category (admin auth) ──
app.delete("/make-server-221a61bc/flashcards/categories/:id", async (c) => {
  try {
    const userTokenHeader = c.req.header("X-User-Token");
    const { error: authError, user } = await verifyToken(userTokenHeader);
    if (authError || !user) return c.json({ error: "Unauthorized" }, 401);

    const catId = c.req.param("id");
    await kv.del(`fc_category:${catId}`);

    const cards = await kv.getByPrefix("fc_card:");
    const catCards = cards.filter((card: any) => card.category_id === catId);
    for (const card of catCards) {
      await kv.del(`fc_card:${card.id}`);
    }

    console.log(`[FLASHCARDS] Deleted category ${catId} and ${catCards.length} cards`);
    return c.json({ success: true, deletedCards: catCards.length });
  } catch (error) {
    return c.json({ error: `Failed to delete category: ${error.message}` }, 500);
  }
});

// ── List cards (public, optionally filter by category) ──
app.get("/make-server-221a61bc/flashcards/cards", async (c) => {
  try {
    const categoryId = c.req.query("category");
    let cards = await kv.getByPrefix("fc_card:");
    if (categoryId) {
      cards = cards.filter((card: any) => card.category_id === categoryId);
    }
    cards.sort((a: any, b: any) => (a.order || 0) - (b.order || 0));

    const resolved = cards.map((card: any) => ({
      ...card,
      image_url: card.image_key ? r2PublicUrl(card.image_key) : null,
      video_url: card.video_key ? r2PublicUrl(card.video_key) : null,
      audio_en_url: card.audio_en_key ? r2PublicUrl(card.audio_en_key) : null,
      audio_bm_url: card.audio_bm_key ? r2PublicUrl(card.audio_bm_key) : null,
      audio_zh_url: card.audio_zh_key ? r2PublicUrl(card.audio_zh_key) : null,
    }));

    return c.json({ success: true, cards: resolved });
  } catch (error) {
    return c.json({ error: `Failed to fetch cards: ${error.message}` }, 500);
  }
});

// ── Create/update a single card (admin auth) ──
app.post("/make-server-221a61bc/flashcards/cards", async (c) => {
  try {
    const userTokenHeader = c.req.header("X-User-Token");
    const { error: authError, user } = await verifyToken(userTokenHeader);
    if (authError || !user) return c.json({ error: "Unauthorized" }, 401);

    const body = await c.req.json();
    const { id, category_id, word_en, word_bm, word_zh, image_key, video_key, audio_en_key, audio_bm_key, audio_zh_key, order } = body;
    if (!category_id || !word_en) return c.json({ error: "category_id and word_en are required" }, 400);

    const cardId = id || crypto.randomUUID();
    const existing = id ? await kv.get(`fc_card:${id}`) : null;

    const cardData = {
      ...(existing || {}),
      id: cardId,
      category_id,
      word_en: word_en || "",
      word_bm: word_bm || word_en || "",
      word_zh: word_zh || word_en || "",
      image_key: image_key ?? existing?.image_key ?? null,
      video_key: video_key ?? existing?.video_key ?? null,
      audio_en_key: audio_en_key ?? existing?.audio_en_key ?? null,
      audio_bm_key: audio_bm_key ?? existing?.audio_bm_key ?? null,
      audio_zh_key: audio_zh_key ?? existing?.audio_zh_key ?? null,
      order: order ?? existing?.order ?? 0,
      created_at: existing?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await kv.set(`fc_card:${cardId}`, cardData);
    console.log(`[FLASHCARDS] Card ${id ? "updated" : "created"}: ${cardId} — ${word_en}`);

    return c.json({
      success: true,
      card: {
        ...cardData,
        image_url: cardData.image_key ? r2PublicUrl(cardData.image_key) : null,
        video_url: cardData.video_key ? r2PublicUrl(cardData.video_key) : null,
        audio_en_url: cardData.audio_en_key ? r2PublicUrl(cardData.audio_en_key) : null,
        audio_bm_url: cardData.audio_bm_key ? r2PublicUrl(cardData.audio_bm_key) : null,
        audio_zh_url: cardData.audio_zh_key ? r2PublicUrl(cardData.audio_zh_key) : null,
      },
    });
  } catch (error) {
    return c.json({ error: `Failed to save card: ${error.message}` }, 500);
  }
});

// ── Delete card (admin auth) ──
app.delete("/make-server-221a61bc/flashcards/cards/:id", async (c) => {
  try {
    const userTokenHeader = c.req.header("X-User-Token");
    const { error: authError, user } = await verifyToken(userTokenHeader);
    if (authError || !user) return c.json({ error: "Unauthorized" }, 401);

    const cardId = c.req.param("id");
    await kv.del(`fc_card:${cardId}`);
    console.log(`[FLASHCARDS] Deleted card ${cardId}`);
    return c.json({ success: true });
  } catch (error) {
    return c.json({ error: `Failed to delete card: ${error.message}` }, 500);
  }
});

// ── CSV bulk upload (admin auth) ──
app.post("/make-server-221a61bc/flashcards/csv-upload", async (c) => {
  try {
    const userTokenHeader = c.req.header("X-User-Token");
    const { error: authError, user } = await verifyToken(userTokenHeader);
    if (authError || !user) return c.json({ error: "Unauthorized" }, 401);

    const body = await c.req.json();
    const { csv } = body;
    if (!csv) return c.json({ error: "csv field is required" }, 400);

    const lines = csv.trim().split("\n");
    if (lines.length < 2) return c.json({ error: "CSV must have header + at least 1 data row" }, 400);

    const header = lines[0].split(",").map((h: string) => h.trim().toLowerCase());
    if (!header.includes("category") || !header.includes("word_en")) {
      return c.json({ error: "CSV must have 'category' and 'word_en' columns" }, 400);
    }

    const existingCats = await kv.getByPrefix("fc_category:");
    const catMap = new Map<string, string>();
    for (const cat of existingCats) {
      catMap.set(cat.name_en.toLowerCase(), cat.id);
    }

    let cardsCreated = 0;
    let categoriesCreated = 0;
    const errors: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const values: string[] = [];
      let current = "";
      let inQuotes = false;
      for (const ch of line) {
        if (ch === '"') { inQuotes = !inQuotes; continue; }
        if (ch === ',' && !inQuotes) { values.push(current.trim()); current = ""; continue; }
        current += ch;
      }
      values.push(current.trim());

      const row: Record<string, string> = {};
      header.forEach((col: string, idx: number) => { row[col] = values[idx] || ""; });

      if (!row.category || !row.word_en) {
        errors.push(`Row ${i + 1}: missing category or word_en`);
        continue;
      }

      const catNameLower = row.category.toLowerCase();
      if (!catMap.has(catNameLower)) {
        const newCatId = crypto.randomUUID();
        await kv.set(`fc_category:${newCatId}`, {
          id: newCatId,
          name_en: row.category,
          name_bm: row.category_bm || row.category,
          name_zh: row.category_zh || row.category,
          emoji: row.category_emoji || "📚",
          color: row.category_color || "#7cc643",
          image_key: null,
          order: catMap.size,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        catMap.set(catNameLower, newCatId);
        categoriesCreated++;
      }

      const categoryId = catMap.get(catNameLower)!;
      const cardId = crypto.randomUUID();
      await kv.set(`fc_card:${cardId}`, {
        id: cardId,
        category_id: categoryId,
        word_en: row.word_en || "",
        word_bm: row.word_bm || row.word_en || "",
        word_zh: row.word_zh || row.word_en || "",
        image_key: row.image_key || null,
        video_key: row.video_key || null,
        audio_en_key: row.audio_en_key || null,
        audio_bm_key: row.audio_bm_key || null,
        audio_zh_key: row.audio_zh_key || null,
        order: cardsCreated,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      cardsCreated++;
    }

    console.log(`[FLASHCARDS-CSV] Done: ${cardsCreated} cards, ${categoriesCreated} new categories, ${errors.length} errors`);
    return c.json({ success: true, cards_created: cardsCreated, categories_created: categoriesCreated, errors: errors.length > 0 ? errors : undefined });
  } catch (error) {
    console.error("[FLASHCARDS-CSV] Upload error:", error);
    return c.json({ error: `CSV upload failed: ${error.message}` }, 500);
  }
});

// ── Upload flashcard asset to R2 (admin auth) ──
app.post("/make-server-221a61bc/flashcards/upload-asset", async (c) => {
  try {
    const userTokenHeader = c.req.header("X-User-Token");
    const { error: authError, user } = await verifyToken(userTokenHeader);
    if (authError || !user) return c.json({ error: "Unauthorized" }, 401);

    const body = await c.req.json();
    const { data, filename, contentType, subfolder } = body;
    if (!data || !filename || !contentType) return c.json({ error: "data, filename, contentType required" }, 400);

    const binaryStr = atob(data);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) { bytes[i] = binaryStr.charCodeAt(i); }

    const ext = filename.split(".").pop() || "bin";
    const r2Key = `${FC_R2_PREFIX}${subfolder || "misc"}/${crypto.randomUUID()}.${ext}`;
    const result = await uploadToR2(r2Key, bytes, contentType);

    console.log(`[FLASHCARDS] Asset uploaded: ${r2Key} (${bytes.length} bytes)`);
    return c.json({ success: true, key: r2Key, publicUrl: result.publicUrl });
  } catch (error) {
    return c.json({ error: `Failed to upload asset: ${error.message}` }, 500);
  }
});

// ===== RPG ASSET MANAGER =====
// Upload, list, and delete RPG game assets (sprites, backgrounds, etc.)
// Assets stored in R2 under "rpg/{category}/{slug}.{ext}"
// Metadata stored in KV as "rpg_asset:{slug}"

const RPG_ASSET_KV_PREFIX = "rpg_asset:";
const RPG_R2_PREFIX = "rpg/";

const RPG_CATEGORIES = [
  'background', 'foxy', 'enemy', 'item', 'ui', 'effect', 'map', 'avatar', 'misc',
];

// Upload RPG asset (auth required)
app.post("/make-server-221a61bc/rpg-assets/upload", async (c) => {
  try {
    const userTokenHeader = c.req.header("X-User-Token");
    const { error: authError, user } = await verifyToken(userTokenHeader);
    if (authError || !user) return c.json({ error: `Unauthorized: ${authError || "No user"}` }, 401);

    const body = await c.req.json();
    const { data, filename, contentType, category, slug } = body;

    if (!data || !filename || !contentType) {
      return c.json({ error: "Missing required fields: data (base64), filename, contentType" }, 400);
    }
    if (!slug || !/^[a-z0-9][a-z0-9_-]*$/.test(slug)) {
      return c.json({ error: "Invalid slug: use lowercase letters, numbers, hyphens, underscores (e.g. 'foxy-idle', 'realm_bg_01')" }, 400);
    }

    const assetCategory = RPG_CATEGORIES.includes(category) ? category : "misc";

    const binaryStr = atob(data);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) { bytes[i] = binaryStr.charCodeAt(i); }

    if (bytes.length > 5 * 1024 * 1024) {
      return c.json({ error: `File too large (${(bytes.length / 1024 / 1024).toFixed(1)}MB > 5MB limit)` }, 400);
    }

    const ext = filename.split(".").pop() || "png";
    const r2Key = `${RPG_R2_PREFIX}${assetCategory}/${slug}.${ext}`;

    // Overwrite existing — delete old R2 object if different key
    const existing = await kv.get(`${RPG_ASSET_KV_PREFIX}${slug}`);
    if (existing) {
      const oldR2Key = (existing as any).r2Key;
      if (oldR2Key && oldR2Key !== `r2:${r2Key}`) {
        try { await deleteFromR2(extractR2Key(oldR2Key)); } catch {}
      }
    }

    const result = await uploadToR2(r2Key, bytes, contentType);

    const assetMeta = {
      slug, category: assetCategory, filename, r2Key: `r2:${r2Key}`,
      publicUrl: result.publicUrl, contentType,
      sizeKB: Math.round(bytes.length / 1024),
      createdAt: existing ? (existing as any).createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await kv.set(`${RPG_ASSET_KV_PREFIX}${slug}`, assetMeta);

    console.log(`[RPG-ASSETS] Uploaded: ${slug} -> ${r2Key} (${assetCategory}, ${bytes.length} bytes)`);
    return c.json({ success: true, asset: assetMeta });
  } catch (error) {
    console.error("[RPG-ASSETS] Upload error:", error);
    return c.json({ error: `RPG asset upload failed: ${error.message}` }, 500);
  }
});

// List all RPG assets (public — game art URLs are not sensitive)
app.get("/make-server-221a61bc/rpg-assets", async (c) => {
  try {
    const assets = await kv.getByPrefix(RPG_ASSET_KV_PREFIX);
    const categoryFilter = c.req.query("category");

    let result = assets || [];
    if (categoryFilter && categoryFilter !== "all") {
      result = result.filter((a: any) => a.category === categoryFilter);
    }
    result.sort((a: any, b: any) => {
      if (a.category !== b.category) return a.category.localeCompare(b.category);
      return a.slug.localeCompare(b.slug);
    });

    return c.json({ success: true, assets: result, categories: RPG_CATEGORIES, total: result.length });
  } catch (error) {
    console.error("[RPG-ASSETS] List error:", error);
    return c.json({ error: `Failed to list RPG assets: ${error.message}` }, 500);
  }
});

// Delete RPG asset (auth required)
app.delete("/make-server-221a61bc/rpg-assets/:slug", async (c) => {
  try {
    const userTokenHeader = c.req.header("X-User-Token");
    const { error: authError, user } = await verifyToken(userTokenHeader);
    if (authError || !user) return c.json({ error: `Unauthorized: ${authError || "No user"}` }, 401);

    const slug = c.req.param("slug");
    const existing = await kv.get(`${RPG_ASSET_KV_PREFIX}${slug}`);
    if (!existing) return c.json({ error: `Asset not found: ${slug}` }, 404);

    const r2Key = (existing as any).r2Key;
    if (r2Key) {
      try { await deleteFromR2(extractR2Key(r2Key)); } catch (err) {
        console.error(`[RPG-ASSETS] R2 delete failed for ${r2Key}:`, err);
      }
    }

    await kv.del(`${RPG_ASSET_KV_PREFIX}${slug}`);
    console.log(`[RPG-ASSETS] Deleted: ${slug}`);
    return c.json({ success: true, deleted: slug });
  } catch (error) {
    console.error("[RPG-ASSETS] Delete error:", error);
    return c.json({ error: `Failed to delete RPG asset: ${error.message}` }, 500);
  }
});

// ===== REALM STATS PERSISTENCE =====
// KV keys: realm_stats:{userId}, realm_quests:{userId}

// ── Reward Config (global Gold Economy settings) ──
// KV key: realm_reward_config (single global object)
const REWARD_CONFIG_KEY = "realm_reward_config";

const DEFAULT_REWARD_CONFIG_SERVER = {
  version: 2,
  updatedAt: new Date().toISOString(),
  activities: {
    test:      { gold: 0,  xp: 0,  dailyLimit: false, freeMaxPerDay: -1, premiumMaxPerDay: -1 },
    practice:  { gold: 0,  xp: 0,  dailyLimit: false, freeMaxPerDay: -1, premiumMaxPerDay: -1 },
    flashcard: { gold: 5,  xp: 5,  dailyLimit: true,  freeMaxPerDay: 3,  premiumMaxPerDay: -1, ageMin: 4, ageMax: 6 },
    video:     { gold: 0,  xp: 0,  dailyLimit: false, freeMaxPerDay: 2,  premiumMaxPerDay: -1 },
    music:     { gold: 0,  xp: 0,  dailyLimit: false, freeMaxPerDay: -1, premiumMaxPerDay: -1 },
    battle:    { gold: 0,  xp: 0,  dailyLimit: true,  freeMaxPerDay: 1,  premiumMaxPerDay: -1 },
  },
  ageBonuses: [4,5,6,7,8,9,10,11,12].map(age => {
    const s = 1 + (age - 4) * 0.375;
    return {
      age,
      sessionXp: Math.round(20 * s),
      above80: { gold: Math.round(10*s), xp: 0 },
      above90: { gold: Math.round(25*s), xp: 0 },
      perfect: { gold: Math.round(60*s), xp: 0 },
    };
  }),
};

// GET reward config (public — consumed by realm pages)
app.get("/make-server-221a61bc/realm/reward-config", async (c) => {
  try {
    let config = await kv.get(REWARD_CONFIG_KEY);
    if (!config) {
      config = { ...DEFAULT_REWARD_CONFIG_SERVER, updatedAt: new Date().toISOString() };
      await kv.set(REWARD_CONFIG_KEY, config);
      console.log("[REALM] Seeded default reward config");
    }
    return c.json({ success: true, config });
  } catch (error: any) {
    console.error("[REALM] Get reward config error:", error);
    return c.json({ error: `Failed to get reward config: ${error.message}` }, 500);
  }
});

// PUT save reward config (admin only)
app.put("/make-server-221a61bc/realm/reward-config", async (c) => {
  try {
    const token = c.req.header("X-User-Token")?.split("Bearer ")[1];
    if (!token) return c.json({ error: "Unauthorized — no token" }, 401);
    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
    if (authErr || !user) return c.json({ error: "Unauthorized — invalid token" }, 401);

    const body = await c.req.json();
    const { config } = body;
    if (!config) return c.json({ error: "Missing config object" }, 400);

    const toSave = { ...config, updatedAt: new Date().toISOString() };
    await kv.set(REWARD_CONFIG_KEY, toSave);
    console.log(`[REALM] Saved reward config by ${user.email}: version=${toSave.version}`);
    return c.json({ success: true, config: toSave });
  } catch (error: any) {
    console.error("[REALM] Save reward config error:", error);
    return c.json({ error: `Failed to save reward config: ${error.message}` }, 500);
  }
});

// ── Gold Economy Analytics (SuperAdmin only) ──
// Aggregates all realm_stats:* records for economy health monitoring
app.get("/make-server-221a61bc/realm/economy-analytics", async (c) => {
  try {
    const userTokenHeader = c.req.header("X-User-Token");
    const { error: authErr, user } = await verifyToken(userTokenHeader);
    if (authErr || !user) return c.json({ error: `Auth error: ${authErr}` }, 401);
    const role = resolveUserRole(user.email, user.user_metadata);
    if (role !== "superadmin") return c.json({ error: "Forbidden — superadmin only" }, 403);

    const { data: allStats_ } = await supabaseAdmin.from('realm_stats').select('*');
    const allStats = allStats_ || [];
    let totalGold = 0, totalDiamond = 0, totalXp = 0;
    let totalGoldSpent = 0, totalDiamondSpent = 0;
    let maxGold = 0, maxDiamond = 0, maxLevel = 0;
    let maxGoldUser = "", maxDiamondUser = "", maxLevelUser = "";
    const now = Date.now();
    const sevenDaysAgo = now - 7 * 86400000;
    const thirtyDaysAgo = now - 30 * 86400000;
    let active7d = 0, active30d = 0;
    const goldDistribution: number[] = [];
    const levelDistribution: Record<number, number> = {};
    const bagSlotDistribution: Record<number, number> = {};

    for (const s of allStats) {
      const gold = s.gold || 0;
      const diamond = s.diamond || 0;
      const xp = s.xp || 0;
      const spent = s.total_gold_spent || 0;
      const dSpent = s.total_diamond_spent || 0;
      const level = s.level || 1;
      const bagSlots = s.bag_slots || 5;

      totalGold += gold;
      totalDiamond += diamond;
      totalXp += xp;
      totalGoldSpent += spent;
      totalDiamondSpent += dSpent;

      if (gold > maxGold) { maxGold = gold; maxGoldUser = s.user_id || "?"; }
      if (diamond > maxDiamond) { maxDiamond = diamond; maxDiamondUser = s.user_id || "?"; }
      if (level > maxLevel) { maxLevel = level; maxLevelUser = s.user_id || "?"; }

      goldDistribution.push(gold);
      levelDistribution[level] = (levelDistribution[level] || 0) + 1;
      bagSlotDistribution[bagSlots] = (bagSlotDistribution[bagSlots] || 0) + 1;

      const updatedAt = s.updated_at ? new Date(s.updated_at).getTime() : 0;
      if (updatedAt > sevenDaysAgo) active7d++;
      if (updatedAt > thirtyDaysAgo) active30d++;
    }

    const totalUsers = allStats.length;
    const avgGold = totalUsers > 0 ? Math.round(totalGold / totalUsers) : 0;
    const avgDiamond = totalUsers > 0 ? Math.round(totalDiamond / totalUsers) : 0;
    const totalGoldMinted = totalGold + totalGoldSpent;

    goldDistribution.sort((a, b) => a - b);
    const medianGold = totalUsers > 0 ? goldDistribution[Math.floor(totalUsers / 2)] : 0;

    // Gini coefficient (simplified — cap at 500 users for O(n²))
    let gini = 0;
    const giniSample = goldDistribution.length > 500 ? goldDistribution.filter((_, i) => i % Math.ceil(goldDistribution.length / 500) === 0) : goldDistribution;
    if (giniSample.length > 1) {
      let num = 0;
      const mean = giniSample.reduce((a, b) => a + b, 0) / giniSample.length;
      for (let i = 0; i < giniSample.length; i++) {
        for (let j = 0; j < giniSample.length; j++) {
          num += Math.abs(giniSample[i] - giniSample[j]);
        }
      }
      gini = mean > 0 ? num / (2 * giniSample.length * giniSample.length * mean) : 0;
    }

    const brackets = [
      { label: "0-99", min: 0, max: 99, count: 0 },
      { label: "100-499", min: 100, max: 499, count: 0 },
      { label: "500-999", min: 500, max: 999, count: 0 },
      { label: "1K-4,999", min: 1000, max: 4999, count: 0 },
      { label: "5K-9,999", min: 5000, max: 9999, count: 0 },
      { label: "10K+", min: 10000, max: Infinity, count: 0 },
    ];
    for (const g of goldDistribution) {
      for (const b of brackets) {
        if (g >= b.min && g <= b.max) { b.count++; break; }
      }
    }

    return c.json({
      success: true,
      analytics: {
        totalUsers,
        active7d,
        active30d,
        supply: {
          totalGoldInCirculation: totalGold,
          totalGoldSpent,
          totalGoldMinted,
          totalDiamondInCirculation: totalDiamond,
          totalDiamondSpent,
          totalXp,
        },
        averages: { avgGold, avgDiamond, medianGold },
        maxHolders: {
          gold: { amount: maxGold, userId: maxGoldUser },
          diamond: { amount: maxDiamond, userId: maxDiamondUser },
          level: { level: maxLevel, userId: maxLevelUser },
        },
        giniCoefficient: parseFloat(gini.toFixed(3)),
        goldBrackets: brackets.map(b => ({ label: b.label, count: b.count })),
        levelDistribution: Object.entries(levelDistribution)
          .map(([level, count]) => ({ level: parseInt(level), count }))
          .sort((a, b) => a.level - b.level),
        bagSlotDistribution: Object.entries(bagSlotDistribution)
          .map(([slots, count]) => ({ slots: parseInt(slots), count }))
          .sort((a, b) => a.slots - b.slots),
      },
    });
  } catch (error: any) {
    console.error("[REALM] Economy analytics error:", error);
    return c.json({ error: `Failed to compute economy analytics: ${error.message}` }, 500);
  }
});

// ── Practice Gate Config (session rules per age + subject) ──
// KV key: practice_gate_config (single global object)
const PRACTICE_GATE_CONFIG_KEY = "practice_gate_config";

const DEFAULT_PRACTICE_GATE_CONFIG_SERVER = {
  version: 1,
  updatedAt: new Date().toISOString(),
  rules: [
    { id: 'default-4-6', ageMin: 4, ageMax: 6, subject: 'all', timeLimitSeconds: 180, minQuestions: 5, passingScore: 60, isActive: true },
    { id: 'default-7-9', ageMin: 7, ageMax: 9, subject: 'all', timeLimitSeconds: 300, minQuestions: 10, passingScore: 60, isActive: true },
    { id: 'default-10-12', ageMin: 10, ageMax: 12, subject: 'all', timeLimitSeconds: 420, minQuestions: 15, passingScore: 60, isActive: true },
  ],
};

// GET practice gate config (public — consumed by PracticeScreen)
app.get("/make-server-221a61bc/realm/practice-gate-config", async (c) => {
  try {
    let config = await kv.get(PRACTICE_GATE_CONFIG_KEY);
    if (!config) {
      config = { ...DEFAULT_PRACTICE_GATE_CONFIG_SERVER, updatedAt: new Date().toISOString() };
      await kv.set(PRACTICE_GATE_CONFIG_KEY, config);
      console.log("[PRACTICE-GATE] Seeded default practice gate config");
    }
    return c.json({ success: true, config });
  } catch (error: any) {
    console.error("[PRACTICE-GATE] Get config error:", error);
    return c.json({ error: `Failed to get practice gate config: ${error.message}` }, 500);
  }
});

// PUT save practice gate config (admin only)
app.put("/make-server-221a61bc/realm/practice-gate-config", async (c) => {
  try {
    const token = c.req.header("X-User-Token")?.split("Bearer ")[1];
    if (!token) return c.json({ error: "Unauthorized — no token" }, 401);
    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
    if (authErr || !user) return c.json({ error: "Unauthorized — invalid token" }, 401);

    const body = await c.req.json();
    const { config } = body;
    if (!config) return c.json({ error: "Missing config object" }, 400);

    const toSave = { ...config, updatedAt: new Date().toISOString() };
    await kv.set(PRACTICE_GATE_CONFIG_KEY, toSave);
    console.log(`[PRACTICE-GATE] Saved config by ${user.email}: ${toSave.rules?.length || 0} rules`);
    return c.json({ success: true, config: toSave });
  } catch (error: any) {
    console.error("[PRACTICE-GATE] Save config error:", error);
    return c.json({ error: `Failed to save practice gate config: ${error.message}` }, 500);
  }
});

// ── Daily Limit Tracking ──
// KV key: realm_daily:{userId}:{YYYY-MM-DD}
// Value: Record<ActivityType, { count: number; goldAwarded: boolean }>
// Gold capped 1x/day when dailyLimit=true; XP always awarded.

function todayDateStr(): string {
  return new Date().toISOString().slice(0, 10);
}

// GET daily activity log for a user (today)
app.get("/make-server-221a61bc/realm/daily-log/:userId", async (c) => {
  try {
    const userId = c.req.param("userId");
    const date = todayDateStr();
    const { data: row } = await supabaseAdmin.from('realm_daily_logs').select('log_data').eq('user_id', userId).eq('date', date).limit(1).single();
    return c.json({ success: true, date, log: row?.log_data || {} });
  } catch (error: any) {
    console.error("[REALM] Get daily log error:", error);
    return c.json({ error: `Failed to get daily log: ${error.message}` }, 500);
  }
});

// POST record an activity completion → returns { goldAwarded, xpAwarded }
// Also enforces free/premium daily ACCESS limits from config.
app.post("/make-server-221a61bc/realm/daily-log/:userId", async (c) => {
  try {
    const userId = c.req.param("userId");
    const body = await c.req.json();
    const { activityType } = body;
    if (!activityType) return c.json({ error: "Missing activityType" }, 400);

    const date = todayDateStr();

    const [configRes, dailyRes, parentRes] = await Promise.all([
      kv.get(REWARD_CONFIG_KEY),
      supabaseAdmin.from('realm_daily_logs').select('log_data').eq('user_id', userId).eq('date', date).limit(1).single(),
      supabaseAdmin.from('parents').select('subscription_status, premium_expires_at').eq('id', userId).limit(1).single(),
    ]);

    const rewardConfig = configRes || DEFAULT_REWARD_CONFIG_SERVER;
    const log = dailyRes.data?.log_data || {};
    const parentData = parentRes.data;
    const activityLog = log[activityType] || { count: 0, goldAwarded: false };

    const activityConfig = rewardConfig.activities?.[activityType];
    if (!activityConfig) {
      return c.json({ error: `Unknown activity type: ${activityType}` }, 400);
    }

    // ── Access Limit Check (free vs premium) ──
    const subStatus = parentData?.subscription_status || "free";
    const hasFmcgPremium = parentData?.premium_expires_at && new Date(parentData.premium_expires_at) > new Date();
    const isPaid = subStatus === "active" || subStatus === "founder" || !!hasFmcgPremium;
    const maxPerDay = isPaid
      ? (activityConfig.premiumMaxPerDay ?? -1)
      : (activityConfig.freeMaxPerDay ?? -1);

    if (maxPerDay !== -1 && activityLog.count >= maxPerDay) {
      console.log(`[REALM] ACCESS BLOCKED: ${userId} ${activityType} (${date}) count=${activityLog.count} max=${maxPerDay} isPaid=${isPaid}`);
      return c.json({
        error: isPaid
          ? `Daily limit reached for ${activityType}. You've completed ${activityLog.count}/${maxPerDay} today.`
          : `Daily free limit reached for ${activityType}. Upgrade to Premium for more!`,
        accessBlocked: true,
        limitReached: true,
        currentCount: activityLog.count,
        maxPerDay,
        isPaid,
      }, 403);
    }

    const isLimited = activityConfig.dailyLimit;
    const alreadyGotGold = activityLog.goldAwarded;

    // Gold: only if daily limit is off OR first time today
    const goldAwarded = (!isLimited || !alreadyGotGold) ? activityConfig.gold : 0;
    // XP: always awarded (cap gold but add experience)
    const xpAwarded = activityConfig.xp;

    activityLog.count += 1;
    if (goldAwarded > 0) activityLog.goldAwarded = true;
    log[activityType] = activityLog;

    await supabaseAdmin.from('realm_daily_logs').upsert({ user_id: userId, date, log_data: log }, { onConflict: 'user_id,date' });
    console.log(`[REALM] Daily log: ${userId} ${activityType} (${date}) count=${activityLog.count} gold=${goldAwarded} xp=${xpAwarded} limited=${isLimited}`);

    // ── Cross-write to parent_activity for Mastery Dashboard heatmap ──
    try {
      const { data: existingPA } = await supabaseAdmin.from('parent_activities').select('*').eq('parent_id', userId).eq('date', date).limit(1).single();
      const parentActivity = existingPA || {
        parent_id: userId, date, tests: 0, watches: 0, practices: 0,
        questions_total: 0, questions_correct: 0,
        videos_watched: 0, songs_listened: 0,
        flashcards_completed: 0, battles: 0,
      };
      // Ensure all fields exist on legacy records
      if (parentActivity.videos_watched === undefined) parentActivity.videos_watched = 0;
      if (parentActivity.songs_listened === undefined) parentActivity.songs_listened = 0;
      if (parentActivity.flashcards_completed === undefined) parentActivity.flashcards_completed = 0;
      if (parentActivity.battles === undefined) parentActivity.battles = 0;

      // Map realm activity types → parent activity fields
      switch (activityType) {
        case 'test':      parentActivity.tests++; break;
        case 'practice':  parentActivity.practices++; break;
        case 'flashcard': parentActivity.flashcards_completed++; break;
        case 'video':     parentActivity.videos_watched++; break;
        case 'music':     parentActivity.songs_listened++; break;
        case 'battle':    parentActivity.battles++; break;
      }
      // If score data is provided (e.g. from gated practice sessions), accumulate it
      if (typeof body.questionsTotal === 'number') {
        parentActivity.questions_total = (parentActivity.questions_total || 0) + body.questionsTotal;
      }
      if (typeof body.questionsCorrect === 'number') {
        parentActivity.questions_correct = (parentActivity.questions_correct || 0) + body.questionsCorrect;
      }
      const { id: _paId, ...paUpsert } = parentActivity;
      await supabaseAdmin.from('parent_activities').upsert(paUpsert, { onConflict: 'parent_id,date' });
      console.log(`[REALM->PARENT] Cross-wrote ${activityType} to parent_activity for ${userId} (${date})${body.questionsTotal ? ` score: ${body.questionsCorrect}/${body.questionsTotal}` : ''}`);
    } catch (crossErr: any) {
      // Non-fatal: don't fail the main response if cross-write fails
      console.warn(`[REALM->PARENT] Cross-write failed for ${userId}: ${crossErr.message}`);
    }

    return c.json({
      success: true,
      goldAwarded,
      xpAwarded,
      isLimited,
      dailyGoldCapped: isLimited && alreadyGotGold,
      activityCount: activityLog.count,
      maxPerDay,
      isPaid,
      accessBlocked: false,
    });
  } catch (error: any) {
    console.error("[REALM] Daily log post error:", error);
    return c.json({ error: `Failed to record daily activity: ${error.message}` }, 500);
  }
});

// GET realm activity timeline (reads parent_activity by userId — matches daily-log write path)
app.get("/make-server-221a61bc/realm/activity/:userId", async (c) => {
  try {
    const userId = c.req.param("userId");
    if (!userId) return c.json({ error: "Missing userId" }, 400);

    // Auth gate — verify the requesting user owns this data
    const userTokenHeader = c.req.header("X-User-Token");
    if (userTokenHeader) {
      const { error: authError, user } = await verifyToken(userTokenHeader);
      if (authError || !user) {
        return c.json({ error: `Unauthorized: ${authError || 'Invalid token'}` }, 401);
      }
      if (user.id !== userId) {
        console.warn(`[REALM] Activity timeline access denied: token user ${user.id} != requested ${userId}`);
        return c.json({ error: "Forbidden: cannot access another user's activity" }, 403);
      }
    }

    const { data: activities_ } = await supabaseAdmin.from('parent_activities').select('*').eq('parent_id', userId).order('date', { ascending: false }).limit(60);
    const recent = activities_ || [];

    console.log(`[REALM] Activity timeline for ${userId}: ${recent.length} days`);
    return c.json({ success: true, activities: recent });
  } catch (error: any) {
    console.error("[REALM] Activity timeline error:", error);
    return c.json({ error: `Failed to get activity timeline: ${error.message}` }, 500);
  }
});

// GET realm stats (fox stats, wallet, level, xp)
app.get("/make-server-221a61bc/realm/stats/:userId", async (c) => {
  try {
    const userId = c.req.param("userId");
    const { data: row } = await supabaseAdmin.from('realm_stats').select('*').eq('user_id', userId).limit(1).single();
    const stats = row ? { userId: row.user_id, gold: row.gold, diamond: row.diamond, xp: row.xp, level: row.level, bagSlots: row.bag_slots, inventory: row.inventory, equipped: row.equipped, goldSpent: row.total_gold_spent, diamondSpent: row.total_diamond_spent, updatedAt: row.updated_at } : null;
    console.log(`[REALM] Loaded stats for ${userId}: ${stats ? 'found' : 'not found'}`);
    return c.json({ success: true, stats });
  } catch (error) {
    console.error("[REALM] Get stats error:", error);
    return c.json({ error: `Failed to get realm stats: ${error.message}` }, 500);
  }
});

// PUT save realm stats
app.put("/make-server-221a61bc/realm/stats/:userId", async (c) => {
  try {
    const userId = c.req.param("userId");
    const body = await c.req.json();
    const { stats } = body;
    if (!stats) return c.json({ error: "Missing stats object" }, 400);

    await supabaseAdmin.from('realm_stats').upsert({
      user_id: userId, gold: stats.gold ?? 0, diamond: stats.diamond ?? 0, xp: stats.xp ?? 0,
      level: stats.level ?? 1, bag_slots: stats.bagSlots ?? 5, inventory: stats.inventory ?? {},
      equipped: stats.equipped ?? {}, total_gold_spent: stats.goldSpent ?? 0, total_diamond_spent: stats.diamondSpent ?? 0,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
    console.log(`[REALM] Saved stats for ${userId}: level=${stats.level}, gold=${stats.gold}, xp=${stats.xp}`);
    return c.json({ success: true });
  } catch (error) {
    console.error("[REALM] Save stats error:", error);
    return c.json({ error: `Failed to save realm stats: ${error.message}` }, 500);
  }
});

// POST alias for realm stats — needed by navigator.sendBeacon (which only sends POST)
app.post("/make-server-221a61bc/realm/stats/:userId", async (c) => {
  try {
    const userId = c.req.param("userId");
    const body = await c.req.json();
    const { stats } = body;
    if (!stats) return c.json({ error: "Missing stats object" }, 400);

    await supabaseAdmin.from('realm_stats').upsert({
      user_id: userId, gold: stats.gold ?? 0, diamond: stats.diamond ?? 0, xp: stats.xp ?? 0,
      level: stats.level ?? 1, bag_slots: stats.bagSlots ?? 5, inventory: stats.inventory ?? {},
      equipped: stats.equipped ?? {}, total_gold_spent: stats.goldSpent ?? 0, total_diamond_spent: stats.diamondSpent ?? 0,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
    console.log(`[REALM] Saved stats via beacon for ${userId}: level=${stats.level}, gold=${stats.gold}, xp=${stats.xp}`);
    return c.json({ success: true });
  } catch (error) {
    console.error("[REALM] Save stats (beacon) error:", error);
    return c.json({ error: `Failed to save realm stats: ${error.message}` }, 500);
  }
});

// ── Diamond Inbox: GET pending diamond grants for a user ──
// Bible v5: Diamonds are rare currency from referrals/milestones.
// Inbox pattern avoids race conditions with online user's local state.
app.get("/make-server-221a61bc/realm/diamond-inbox/:userId", async (c) => {
  try {
    const userId = c.req.param("userId");
    const { data: grants } = await supabaseAdmin.from('diamond_inbox').select('*').eq('user_id', userId).eq('consumed', false);
    const grantList = (grants || []).map((g: any) => ({ amount: g.amount, reason: g.reason, grantedAt: g.granted_at }));
    const total = grantList.reduce((sum: number, g: any) => sum + g.amount, 0);
    console.log(`[DIAMOND-INBOX] Read for ${userId}: ${total > 0 ? `${total}💎 pending` : 'empty'}`);
    return c.json({ success: true, inbox: { total, grants: grantList } });
  } catch (error) {
    console.error("[DIAMOND-INBOX] Read error:", error);
    return c.json({ error: `Failed to read diamond inbox: ${error.message}` }, 500);
  }
});

// ── Diamond Inbox: CLAIM (consume) pending diamonds ──
// Frontend calls this after adding inbox diamonds to local realm stats.
app.delete("/make-server-221a61bc/realm/diamond-inbox/:userId", async (c) => {
  try {
    const userId = c.req.param("userId");
    const { data: grants } = await supabaseAdmin.from('diamond_inbox').select('*').eq('user_id', userId).eq('consumed', false);
    const grantList = (grants || []).map((g: any) => ({ amount: g.amount, reason: g.reason, grantedAt: g.granted_at }));
    const total = grantList.reduce((sum: number, g: any) => sum + g.amount, 0);
    if (total > 0) {
      const ids = (grants || []).map((g: any) => g.id);
      await supabaseAdmin.from('diamond_inbox').update({ consumed: true }).in('id', ids);
      console.log(`[DIAMOND-INBOX] Claimed ${total}💎 for ${userId}`);
      return c.json({ success: true, claimed: total, grants: grantList });
    }
    return c.json({ success: true, claimed: 0, grants: [] });
  } catch (error) {
    console.error("[DIAMOND-INBOX] Claim error:", error);
    return c.json({ error: `Failed to claim diamond inbox: ${error.message}` }, 500);
  }
});

// ── Special Shop Item: Daily Quest Refresh ──
// Resets the parent's daily activity counters (test/watch/practice) so they can earn rewards again.
app.post("/make-server-221a61bc/realm/daily-refresh/:userId", async (c) => {
  try {
    const userId = c.req.param("userId");
    const { data: parentData } = await supabaseAdmin.from('parents').select('id').eq('id', userId).limit(1).single();
    if (!parentData) {
      return c.json({ error: "Parent not found" }, 404);
    }

    await supabaseAdmin.from('parents').update({
      test_count_today: 0,
      watch_count_today: 0,
      practice_count_today: 0,
      updated_at: new Date().toISOString(),
    }).eq('id', userId);

    console.log(`[REALM] Daily refresh applied for ${userId}: all daily counters reset to 0`);
    return c.json({ success: true, message: "Daily activity counters reset" });
  } catch (error) {
    console.error("[REALM] Daily refresh error:", error);
    return c.json({ error: `Daily refresh failed: ${error.message}` }, 500);
  }
});

// GET quest completion data (completed quests, module results, stars)
app.get("/make-server-221a61bc/realm/quests/:userId", async (c) => {
  try {
    const userId = c.req.param("userId");
    const data = await kv.get(`realm_quests:${userId}`);
    console.log(`[REALM] Loaded quest data for ${userId}: ${data ? `${(data.completedQuests || []).length} completed` : 'not found'}`);
    return c.json({
      success: true,
      data: data || { completedQuests: [], moduleResults: {}, questStars: {} },
    });
  } catch (error) {
    console.error("[REALM] Get quest data error:", error);
    return c.json({ error: `Failed to get quest data: ${error.message}` }, 500);
  }
});

// PUT save quest completion data
app.put("/make-server-221a61bc/realm/quests/:userId", async (c) => {
  try {
    const userId = c.req.param("userId");
    const body = await c.req.json();
    const { completedQuests, moduleResults, questStars } = body;

    await kv.set(`realm_quests:${userId}`, {
      completedQuests: completedQuests || [],
      moduleResults: moduleResults || {},
      questStars: questStars || {},
      updatedAt: new Date().toISOString(),
    });
    console.log(`[REALM] Saved quest data for ${userId}: ${(completedQuests || []).length} completed quests`);
    return c.json({ success: true });
  } catch (error) {
    console.error("[REALM] Save quest data error:", error);
    return c.json({ error: `Failed to save quest data: ${error.message}` }, 500);
  }
});

// POST alias for quest data — needed by navigator.sendBeacon (which only sends POST)
app.post("/make-server-221a61bc/realm/quests/:userId", async (c) => {
  try {
    const userId = c.req.param("userId");
    const body = await c.req.json();
    const { quests } = body;
    if (!quests) return c.json({ error: "Missing quests object" }, 400);

    await kv.set(`realm_quests:${userId}`, {
      completedQuests: quests.completedQuests || [],
      moduleResults: quests.moduleResults || {},
      questStars: quests.questStars || {},
      updatedAt: new Date().toISOString(),
    });
    console.log(`[REALM] Saved quest data via beacon for ${userId}: ${(quests.completedQuests || []).length} completed quests`);
    return c.json({ success: true });
  } catch (error) {
    console.error("[REALM] Save quest data (beacon) error:", error);
    return c.json({ error: `Failed to save quest data: ${error.message}` }, 500);
  }
});

// ===== SHOP ITEM MANAGER =====
// Admin-configurable shop items stored in KV as "shop_item:{id}"
// Effects: { type: 'xp' | 'energy' | 'hp' | 'level', value: number, isPercent: boolean }

const SHOP_ITEM_KV_PREFIX = "shop_item:";
const BATTLE_SKILL_KV_PREFIX = "battle_skill:";

// GET all battle skills (public)
app.get("/make-server-221a61bc/battle/skills", async (c) => {
  try {
    const items = await kv.getByPrefix(BATTLE_SKILL_KV_PREFIX);
    const result = (items || [])
      .map((item: any) => item.value || item)
      .sort((a: any, b: any) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999));
    return c.json({ success: true, skills: result });
  } catch (error) {
    console.error("[BATTLE] List skills error:", error);
    return c.json({ error: `Failed to list battle skills: ${error.message}` }, 500);
  }
});

// GET single battle skill
app.get("/make-server-221a61bc/battle/skills/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const skill = await kv.get(`${BATTLE_SKILL_KV_PREFIX}${id}`);
    if (!skill) return c.json({ error: "Skill not found" }, 404);
    return c.json({ success: true, skill });
  } catch (error) {
    console.error("[BATTLE] Get skill error:", error);
    return c.json({ error: `Failed to get battle skill: ${error.message}` }, 500);
  }
});

// POST create/update battle skill (admin only)
app.post("/make-server-221a61bc/battle/skills", async (c) => {
  try {
    const userTokenHeader = c.req.header("X-User-Token");
    const { error: authError, user } = await verifyToken(userTokenHeader);
    if (authError || !user) return c.json({ error: `Unauthorized: ${authError || "No user"}` }, 401);

    const body = await c.req.json();
    const {
      id, name, nameMs, nameZh,
      description, descriptionMs, descriptionZh,
      subject, element, baseDamage,
      iconSlug, color, glowColor,
      ageMin, ageMax, sortOrder, isActive,
    } = body;

    if (!id || !name || !subject || !element || baseDamage === undefined) {
      return c.json({ error: "Missing required fields: id, name, subject, element, baseDamage" }, 400);
    }

    const skillData = {
      id,
      name,
      nameMs: nameMs || "",
      nameZh: nameZh || "",
      description: description || "",
      descriptionMs: descriptionMs || "",
      descriptionZh: descriptionZh || "",
      subject,
      element,
      baseDamage: Number(baseDamage),
      iconSlug: iconSlug || "",
      color: color || "#ffffff",
      glowColor: glowColor || "#ffffff",
      ageMin: ageMin ?? 4,
      ageMax: ageMax ?? 12,
      sortOrder: sortOrder ?? 999,
      isActive: isActive !== false,
      updatedAt: new Date().toISOString(),
    };

    await kv.set(`${BATTLE_SKILL_KV_PREFIX}${id}`, skillData);
    console.log(`[BATTLE] Saved skill: ${id} (${name}, ${element}/${subject}, dmg=${baseDamage})`);
    return c.json({ success: true, skill: skillData });
  } catch (error) {
    console.error("[BATTLE] Save skill error:", error);
    return c.json({ error: `Failed to save battle skill: ${error.message}` }, 500);
  }
});

// DELETE battle skill (admin only)
app.delete("/make-server-221a61bc/battle/skills/:id", async (c) => {
  try {
    const userTokenHeader = c.req.header("X-User-Token");
    const { error: authError, user } = await verifyToken(userTokenHeader);
    if (authError || !user) return c.json({ error: `Unauthorized: ${authError || "No user"}` }, 401);

    const id = c.req.param("id");
    await kv.del(`${BATTLE_SKILL_KV_PREFIX}${id}`);
    console.log(`[BATTLE] Deleted skill: ${id}`);
    return c.json({ success: true, deleted: id });
  } catch (error) {
    console.error("[BATTLE] Delete skill error:", error);
    return c.json({ error: `Failed to delete battle skill: ${error.message}` }, 500);
  }
});

// GET all shop items (public) — auto-seeds Lumicore items if missing
app.get("/make-server-221a61bc/shop/items", async (c) => {
  try {
    const { data: items_, error: fetchErr } = await supabaseAdmin.from('shop_items').select('*').order('sort_order', { ascending: true });
    if (fetchErr) {
      console.error("[SHOP] Fetch error:", fetchErr);
      return c.json({ error: `Failed to list shop items: ${fetchErr.message}` }, 500);
    }

    let items = items_ || [];

    // ── Auto-seed Lumicore items (Pokeball equivalents) if missing ──
    const LUMICORE_SEEDS = [
      {
        id: 'lumicore-basic', name: 'Lumicore',
        description: 'A crystallized light orb that can capture wild spirits. ~40% catch rate.',
        image_slug: 'lumicore-basic', price: 150, currency: 'gold',
        rarity: 'common', category: 'battle',
        effects: [{ type: 'hp', value: 0, isPercent: false }],
        sort_order: 1, is_active: true,
      },
      {
        id: 'lumicore-great', name: 'Great Lumicore',
        description: 'An enhanced light orb with stronger resonance. ~65% catch rate.',
        image_slug: 'lumicore-great', price: 400, currency: 'gold',
        rarity: 'rare', category: 'battle',
        effects: [{ type: 'hp', value: 0, isPercent: false }],
        sort_order: 2, is_active: true,
      },
      {
        id: 'lumicore-ultra', name: 'Ultra Lumicore',
        description: 'A perfected light orb infused with ancient gold energy. ~85% catch rate.',
        image_slug: 'lumicore-ultra', price: 5, currency: 'diamond',
        rarity: 'epic', category: 'battle',
        effects: [{ type: 'hp', value: 0, isPercent: false }],
        sort_order: 3, is_active: true,
      },
    ];
    const existingIds = new Set(items.map((r: any) => r.id));
    const missing = LUMICORE_SEEDS.filter(s => !existingIds.has(s.id));
    if (missing.length > 0) {
      console.log(`[SHOP] Auto-seeding ${missing.length} Lumicore items...`);
      const now = new Date().toISOString();
      const rows = missing.map(s => ({ ...s, updated_at: now }));
      const { error: seedErr } = await supabaseAdmin.from('shop_items').upsert(rows, { onConflict: 'id' });
      if (seedErr) {
        console.error("[SHOP] Lumicore seed error:", seedErr);
      } else {
        console.log(`[SHOP] Seeded ${missing.length} Lumicore items successfully`);
        // Re-fetch to include seeded items in sorted order
        const { data: refreshed } = await supabaseAdmin.from('shop_items').select('*').order('sort_order', { ascending: true });
        items = refreshed || items;
      }
    }

    const result = items.map((r: any) => ({
      id: r.id, name: r.name, description: r.description, imageSlug: r.image_slug,
      price: r.price, currency: r.currency, rarity: r.rarity, category: r.category,
      equipSlot: r.equip_slot, effects: r.effects, emoji: r.emoji, sortOrder: r.sort_order,
      isActive: r.is_active, updatedAt: r.updated_at,
    }));
    return c.json({ success: true, items: result });
  } catch (error) {
    console.error("[SHOP] List error:", error);
    return c.json({ error: `Failed to list shop items: ${error.message}` }, 500);
  }
});

// GET single shop item
app.get("/make-server-221a61bc/shop/items/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const { data: r } = await supabaseAdmin.from('shop_items').select('*').eq('id', id).limit(1).single();
    if (!r) return c.json({ error: "Item not found" }, 404);
    const item = { id: r.id, name: r.name, description: r.description, imageSlug: r.image_slug, price: r.price, currency: r.currency, rarity: r.rarity, category: r.category, equipSlot: r.equip_slot, effects: r.effects, emoji: r.emoji, sortOrder: r.sort_order, isActive: r.is_active, updatedAt: r.updated_at };
    return c.json({ success: true, item });
  } catch (error) {
    console.error("[SHOP] Get item error:", error);
    return c.json({ error: `Failed to get shop item: ${error.message}` }, 500);
  }
});

// POST create/update shop item (admin only)
app.post("/make-server-221a61bc/shop/items", async (c) => {
  try {
    const userTokenHeader = c.req.header("X-User-Token");
    const { error: authError, user } = await verifyToken(userTokenHeader);
    if (authError || !user) return c.json({ error: `Unauthorized: ${authError || "No user"}` }, 401);

    const body = await c.req.json();
    const { id, name, description, imageSlug, price, currency, rarity, category, effects, sortOrder, isActive, battleLimit, equipSlot } = body;

    if (!id || !name || price === undefined || !currency) {
      return c.json({ error: "Missing required fields: id, name, price, currency" }, 400);
    }

    const itemData: Record<string, any> = {
      id,
      name,
      description: description || "",
      imageSlug: imageSlug || "",
      price: Number(price),
      currency,
      rarity: rarity || "common",
      category: category || "consumable",
      effects: effects || [],
      sortOrder: sortOrder ?? 999,
      isActive: isActive !== false,
      updatedAt: new Date().toISOString(),
    };
    if (battleLimit !== undefined && battleLimit !== null) itemData.battleLimit = Number(battleLimit);
    if (equipSlot) itemData.equipSlot = equipSlot;

    await supabaseAdmin.from('shop_items').upsert({
      id, name, description: itemData.description, image_slug: itemData.imageSlug,
      price: itemData.price, currency: itemData.currency, rarity: itemData.rarity,
      category: itemData.category, effects: itemData.effects, sort_order: itemData.sortOrder,
      is_active: itemData.isActive, equip_slot: itemData.equipSlot || null,
      updated_at: itemData.updatedAt,
    }, { onConflict: 'id' });
    console.log(`[SHOP] Saved item: ${id} (${name}, ${price} ${currency})`);
    return c.json({ success: true, item: itemData });
  } catch (error) {
    console.error("[SHOP] Save item error:", error);
    return c.json({ error: `Failed to save shop item: ${error.message}` }, 500);
  }
});

// DELETE shop item (admin only)
app.delete("/make-server-221a61bc/shop/items/:id", async (c) => {
  try {
    const userTokenHeader = c.req.header("X-User-Token");
    const { error: authError, user } = await verifyToken(userTokenHeader);
    if (authError || !user) return c.json({ error: `Unauthorized: ${authError || "No user"}` }, 401);

    const id = c.req.param("id");
    await supabaseAdmin.from('shop_items').delete().eq('id', id);
    console.log(`[SHOP] Deleted item: ${id}`);
    return c.json({ success: true, deleted: id });
  } catch (error) {
    console.error("[SHOP] Delete item error:", error);
    return c.json({ error: `Failed to delete shop item: ${error.message}` }, 500);
  }
});

// ── Shop Realm Availability (KV-backed) ──
const REALM_AVAILABILITY_KV_KEY = 'shop:realm_availability';

// GET realm store availability map (public)
app.get("/make-server-221a61bc/shop/realm-availability", async (c) => {
  try {
    const raw = await kv.get(REALM_AVAILABILITY_KV_KEY);
    const availability = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : {};
    return c.json({ success: true, availability });
  } catch (error) {
    console.error("[SHOP] Realm availability fetch error:", error);
    return c.json({ error: `Failed to fetch realm store availability: ${error.message}` }, 500);
  }
});

// POST save realm store availability map (admin only)
app.post("/make-server-221a61bc/shop/realm-availability", async (c) => {
  try {
    const userTokenHeader = c.req.header("X-User-Token");
    const { error: authError, user } = await verifyToken(userTokenHeader);
    if (authError || !user) return c.json({ error: `Unauthorized: ${authError || "No user"}` }, 401);

    const body = await c.req.json();
    const availability = body.availability || {};
    await kv.set(REALM_AVAILABILITY_KV_KEY, JSON.stringify(availability));
    console.log(`[SHOP] Saved realm store availability: ${Object.keys(availability).length} items configured`);
    return c.json({ success: true });
  } catch (error) {
    console.error("[SHOP] Realm availability save error:", error);
    return c.json({ error: `Failed to save realm store availability: ${error.message}` }, 500);
  }
});

// GET player inventory (reads from canonical realm_stats inventory)
app.get("/make-server-221a61bc/shop/inventory/:userId", async (c) => {
  try {
    const userId = c.req.param("userId");
    const { data: row } = await supabaseAdmin.from('realm_stats').select('inventory').eq('user_id', userId).limit(1).single();
    const inventory = row?.inventory || {};
    return c.json({ success: true, inventory });
  } catch (error) {
    console.error("[SHOP] Get inventory error:", error);
    return c.json({ error: `Failed to get inventory: ${error.message}` }, 500);
  }
});

// POST buy item / update inventory (writes to canonical realm_stats.inventory)
app.post("/make-server-221a61bc/shop/inventory/:userId/buy", async (c) => {
  try {
    const userId = c.req.param("userId");
    const { itemId, quantity } = await c.req.json();
    if (!itemId) return c.json({ error: "Missing itemId" }, 400);

    const { data: item } = await supabaseAdmin.from('shop_items').select('*').eq('id', itemId).limit(1).single();
    if (!item) return c.json({ error: "Item not found in shop" }, 404);

    const { data: row } = await supabaseAdmin.from('realm_stats').select('*').eq('user_id', userId).limit(1).single();
    const stats = row || { user_id: userId, gold: 0, diamond: 0, xp: 0, inventory: {} };
    if (!stats.inventory) stats.inventory = {};
    const qty = quantity || 1;
    const STACK_LIMIT = 99;
    const current = stats.inventory[itemId] || 0;
    stats.inventory[itemId] = Math.min(STACK_LIMIT, current + qty);
    await supabaseAdmin.from('realm_stats').upsert({ user_id: userId, inventory: stats.inventory, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });

    console.log(`[SHOP] Player ${userId} bought ${qty}x ${itemId}`);
    return c.json({ success: true, inventory: stats.inventory });
  } catch (error) {
    console.error("[SHOP] Buy error:", error);
    return c.json({ error: `Failed to process purchase: ${error.message}` }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════════
// GRANT ITEM — Add item to inventory without payment (evolution rewards)
// ═══════════════════════════════════════════════════════════════════════
// POST /shop/inventory/:userId/grant
// Body: { itemId, itemDef? } — if itemDef is provided, upsert it to shop_item KV
app.post("/make-server-221a61bc/shop/inventory/:userId/grant", async (c) => {
  try {
    const userId = c.req.param("userId");
    const { itemId, itemDef } = await c.req.json();
    if (!itemId) return c.json({ error: "Missing itemId" }, 400);

    // If itemDef provided, upsert the shop item definition so BagPage can render it
    if (itemDef) {
      const { data: existing } = await supabaseAdmin.from('shop_items').select('id').eq('id', itemId).limit(1).single();
      if (!existing) {
        await supabaseAdmin.from('shop_items').insert({
          id: itemId,
          name: itemDef.name || itemId,
          description: itemDef.description || '',
          image_slug: itemDef.imageSlug || '',
          price: 0,
          currency: 'gold',
          rarity: itemDef.rarity || 'common',
          category: 'treasure',
          effects: itemDef.effects || [],
          equip_slot: itemDef.equipSlot || null,
          sort_order: 9999,
          is_active: true,
          updated_at: new Date().toISOString(),
        });
        console.log(`[GRANT] Upserted shop item def: ${itemId}`);
      }
    }

    // Write to canonical realm_stats.inventory (flat Record<string, number>)
    const STACK_LIMIT = 99;
    const { data: row } = await supabaseAdmin.from('realm_stats').select('*').eq('user_id', userId).limit(1).single();
    const stats = row || { user_id: userId, gold: 0, diamond: 0, xp: 0, inventory: {} };
    if (!stats.inventory) stats.inventory = {};
    const current = stats.inventory[itemId] || 0;
    stats.inventory[itemId] = Math.min(STACK_LIMIT, current + 1);
    await supabaseAdmin.from('realm_stats').upsert({ user_id: userId, inventory: stats.inventory, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });

    console.log(`[GRANT] Granted item ${itemId} to user ${userId} (realm_stats.inventory)`);
    return c.json({ success: true, inventory: stats.inventory });
  } catch (error) {
    console.error("[GRANT] Error:", error);
    return c.json({ error: `Failed to grant item: ${error.message}` }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════════
// MASTERY LOG — Cumulative per-skill mastery tracking
// ═══════════════════════════════════════════════════════════════════════
// KV key: mastery_log:{userId}:{subjectId}:{skillCode}
// Value:  { subjectId, skillCode, topicName, totalAttempts, totalCorrect,
//           byMode: { quest|practice|battle|test: { attempts, correct } },
//           ladderLevel, currentStreak, bestStreak, lastAnsweredAt }

/**
 * POST /parent/mastery-log — Record answer(s) into mastery_log
 *
 * Body: {
 *   answers: [{
 *     subjectId: string,      // e.g. "english"
 *     skillCode: string,       // e.g. "ENG-R-1.1"
 *     topicName: string,       // e.g. "Reading Comprehension"
 *     isCorrect: boolean,
 *     mode: "quest" | "practice" | "battle" | "test",
 *     ladderLevel?: number,    // optional adaptive ladder position
 *   }]
 * }
 */
app.post("/make-server-221a61bc/parent/mastery-log", async (c) => {
  try {
    const userTokenHeader = c.req.header("X-User-Token");
    const { error: authError, user } = await verifyToken(userTokenHeader);
    if (authError || !user) return c.json({ error: "Unauthorized (mastery-log write)" }, 401);

    const body = await c.req.json();
    const answers: any[] = body.answers;

    if (!Array.isArray(answers) || answers.length === 0) {
      return c.json({ error: "Missing or empty answers array" }, 400);
    }

    const now = new Date().toISOString();

    // Uses top-level normalizeSubjectId() + SUBJECT_ALIAS_MAP (single source of truth)

    // Group answers by composite key (subjectId + skillCode)
    const keyMap: Record<string, any[]> = {};
    for (const ans of answers) {
      if (!ans.subjectId || !ans.skillCode || typeof ans.isCorrect !== "boolean" || !ans.mode) {
        console.warn("[MASTERY] Skipping invalid answer entry:", JSON.stringify(ans));
        continue;
      }
      ans.subjectId = normalizeSubjectId(ans.subjectId);
      const compositeKey = `${ans.subjectId}:${ans.skillCode}`;
      if (!keyMap[compositeKey]) keyMap[compositeKey] = [];
      keyMap[compositeKey].push(ans);
    }

    const compositeKeys = Object.keys(keyMap);
    if (compositeKeys.length === 0) {
      return c.json({ error: "No valid answers to record" }, 400);
    }

    // Fetch existing records from mastery_logs
    const skillCodes = compositeKeys.map(k => k.split(':')[1]);
    const { data: existingRows } = await supabaseAdmin.from('mastery_logs').select('*').eq('user_id', user.id).in('skill_code', skillCodes);
    const existingMap: Record<string, any> = {};
    for (const row of (existingRows || [])) {
      existingMap[`${row.subject_id}:${row.skill_code}`] = row;
    }

    // Merge each answer group into existing (or new) records
    const upsertRows: any[] = [];

    for (const compositeKey of compositeKeys) {
      const answerGroup = keyMap[compositeKey];
      const first = answerGroup[0];
      const existing = existingMap[compositeKey];

      let record = existing ? {
        totalAttempts: existing.total_attempts || 0,
        totalCorrect: existing.total_correct || 0,
        byMode: existing.by_mode || {},
        ladderLevel: existing.ladder_level || 1,
        currentStreak: existing.current_streak || 0,
        bestStreak: existing.best_streak || 0,
        topicName: existing.topic_name || "Unknown",
        level: existing.level || "",
        skillName: existing.skill_name || "",
      } : {
        totalAttempts: 0,
        totalCorrect: 0,
        byMode: {},
        ladderLevel: 1,
        currentStreak: 0,
        bestStreak: 0,
        topicName: first.topicName || "Unknown",
        level: first.level || "",
        skillName: first.skillName || "",
      };

      for (const ans of answerGroup) {
        record.totalAttempts += 1;
        if (ans.isCorrect) record.totalCorrect += 1;

        const mode = ans.mode || "quest";
        if (!record.byMode[mode]) {
          record.byMode[mode] = { attempts: 0, correct: 0 };
        }
        record.byMode[mode].attempts += 1;
        if (ans.isCorrect) record.byMode[mode].correct += 1;

        if (ans.isCorrect) {
          record.currentStreak = (record.currentStreak || 0) + 1;
          if (record.currentStreak > (record.bestStreak || 0)) {
            record.bestStreak = record.currentStreak;
          }
        } else {
          record.currentStreak = 0;
        }

        if (typeof ans.ladderLevel === "number") record.ladderLevel = ans.ladderLevel;
        if (ans.topicName) record.topicName = ans.topicName;
        if (ans.level) record.level = ans.level;
        if (ans.skillName) record.skillName = ans.skillName;
      }

      upsertRows.push({
        user_id: user.id,
        subject_id: first.subjectId,
        skill_code: first.skillCode,
        topic_name: record.topicName,
        level: record.level,
        skill_name: record.skillName,
        total_attempts: record.totalAttempts,
        total_correct: record.totalCorrect,
        by_mode: record.byMode,
        ladder_level: record.ladderLevel,
        current_streak: record.currentStreak,
        best_streak: record.bestStreak,
        last_answered_at: now,
      });
    }

    // Batch upsert
    await supabaseAdmin.from('mastery_logs').upsert(upsertRows, { onConflict: 'user_id,subject_id,skill_code' });

    // ── Daily mastery snapshot for trend tracking ──
    try {
      const today = now.slice(0, 10);
      const { data: allLogs_ } = await supabaseAdmin.from('mastery_logs').select('subject_id, total_attempts, total_correct').eq('user_id', user.id);
      const subjAgg: Record<string, { attempts: number; correct: number }> = {};
      for (const log of (allLogs_ || [])) {
        const sid = normalizeSubjectId(log.subject_id);
        if (!subjAgg[sid]) subjAgg[sid] = { attempts: 0, correct: 0 };
        subjAgg[sid].attempts += log.total_attempts || 0;
        subjAgg[sid].correct += log.total_correct || 0;
      }
      const subjectsSnapshot: Record<string, { attempts: number; correct: number; percentage: number }> = {};
      for (const [sid, agg] of Object.entries(subjAgg)) {
        subjectsSnapshot[sid] = {
          attempts: agg.attempts,
          correct: agg.correct,
          percentage: agg.attempts > 0 ? Math.round((agg.correct / agg.attempts) * 100) : 0,
        };
      }
      await supabaseAdmin.from('mastery_trends').upsert({
        user_id: user.id, date: today, subjects: subjectsSnapshot, updated_at: now,
      }, { onConflict: 'user_id,date' });
      console.log(`[MASTERY] Updated daily snapshot for ${user.id}: ${Object.keys(subjectsSnapshot).length} subjects`);
    } catch (snapErr) {
      console.warn("[MASTERY] Snapshot update failed (non-critical):", snapErr);
    }

    const subjectsSeen = [...new Set(answers.map((a: any) => a.subjectId))].join(', ');
    console.log(`[MASTERY] Recorded ${answers.length} answers across ${upsertRows.length} skill keys for user ${user.id} | subjects: ${subjectsSeen}`);
    return c.json({ success: true, recorded: answers.length, skills: upsertRows.length });
  } catch (error) {
    console.error("[MASTERY] mastery-log write error:", error);
    return c.json({ error: `Failed to record mastery log: ${error.message}` }, 500);
  }
});

/**
 * GET /parent/mastery-profile — Read aggregated mastery profile
 *
 * Reads all mastery_log:{userId}:* keys, aggregates by subject,
 * builds topic drill-down, and returns the full profile.
 */
app.get("/make-server-221a61bc/parent/mastery-profile", async (c) => {
  try {
    const userTokenHeader = c.req.header("X-User-Token");
    const { error: authError, user } = await verifyToken(userTokenHeader);
    if (authError || !user) return c.json({ error: "Unauthorized (mastery-profile read)" }, 401);

    const { data: rawRecords } = await supabaseAdmin.from('mastery_logs').select('*').eq('user_id', user.id);
    const records = (rawRecords || []).map((r: any) => ({
      subjectId: r.subject_id, skillCode: r.skill_code, topicName: r.topic_name,
      level: r.level, skillName: r.skill_name, totalAttempts: r.total_attempts,
      totalCorrect: r.total_correct, byMode: r.by_mode, ladderLevel: r.ladder_level,
      currentStreak: r.current_streak, bestStreak: r.best_streak, lastAnsweredAt: r.last_answered_at,
    }));

    // Aggregate by subject
    const subjectMap: Record<string, {
      subjectId: string;
      totalAttempts: number;
      totalCorrect: number;
      byMode: Record<string, { attempts: number; correct: number }>;
      topicMap: Record<string, { topicName: string; skillCodes: string[]; totalAttempts: number; totalCorrect: number }>;
      skillMap: Record<string, { skillCode: string; skillName: string; topicName: string; level: string; totalAttempts: number; totalCorrect: number }>;
      lastAnsweredAt: string | null;
    }> = {};

    let grandTotalAttempts = 0;
    let grandTotalCorrect = 0;
    let lastUpdated: string | null = null;

    for (const rec of records) {
      if (!rec || !rec.subjectId) continue;

      const sid = normalizeSubjectId(rec.subjectId);
      if (!subjectMap[sid]) {
        subjectMap[sid] = {
          subjectId: sid,
          totalAttempts: 0,
          totalCorrect: 0,
          byMode: {},
          topicMap: {},
          skillMap: {},
          lastAnsweredAt: null,
        };
      }

      const subj = subjectMap[sid];
      subj.totalAttempts += rec.totalAttempts || 0;
      subj.totalCorrect += rec.totalCorrect || 0;
      grandTotalAttempts += rec.totalAttempts || 0;
      grandTotalCorrect += rec.totalCorrect || 0;

      // Merge mode breakdowns
      if (rec.byMode) {
        for (const [mode, stats] of Object.entries(rec.byMode)) {
          const s = stats as { attempts: number; correct: number };
          if (!subj.byMode[mode]) subj.byMode[mode] = { attempts: 0, correct: 0 };
          subj.byMode[mode].attempts += s.attempts || 0;
          subj.byMode[mode].correct += s.correct || 0;
        }
      }

      // Topic aggregation
      const topicKey = rec.topicName || "Uncategorized";
      if (!subj.topicMap[topicKey]) {
        subj.topicMap[topicKey] = { topicName: topicKey, skillCodes: [], totalAttempts: 0, totalCorrect: 0 };
      }
      const topic = subj.topicMap[topicKey];
      topic.totalAttempts += rec.totalAttempts || 0;
      topic.totalCorrect += rec.totalCorrect || 0;
      if (rec.skillCode && !topic.skillCodes.includes(rec.skillCode)) {
        topic.skillCodes.push(rec.skillCode);
      }

      // Per-skill aggregation for weakness detection
      if (rec.skillCode) {
        if (!subj.skillMap[rec.skillCode]) {
          subj.skillMap[rec.skillCode] = {
            skillCode: rec.skillCode,
            skillName: rec.skillName || "",
            topicName: rec.topicName || "Uncategorized",
            level: rec.level || "",
            totalAttempts: 0,
            totalCorrect: 0,
          };
        }
        const sk = subj.skillMap[rec.skillCode];
        sk.totalAttempts += rec.totalAttempts || 0;
        sk.totalCorrect += rec.totalCorrect || 0;
        if (rec.skillName) sk.skillName = rec.skillName;
        if (rec.level) sk.level = rec.level;
      }

      // Track latest timestamp
      if (rec.lastAnsweredAt && (!subj.lastAnsweredAt || rec.lastAnsweredAt > subj.lastAnsweredAt)) {
        subj.lastAnsweredAt = rec.lastAnsweredAt;
      }
      if (rec.lastAnsweredAt && (!lastUpdated || rec.lastAnsweredAt > lastUpdated)) {
        lastUpdated = rec.lastAnsweredAt;
      }
    }

    // Build response
    const subjects = Object.values(subjectMap).map((subj) => {
      const skills = Object.values(subj.skillMap).map((sk) => ({
        ...sk,
        percentage: sk.totalAttempts > 0 ? Math.round((sk.totalCorrect / sk.totalAttempts) * 100) : 0,
      }));
      // Sort weakest skills first for quick access
      skills.sort((a, b) => a.percentage - b.percentage);
      return {
        subjectId: subj.subjectId,
        totalAttempts: subj.totalAttempts,
        totalCorrect: subj.totalCorrect,
        percentage: subj.totalAttempts > 0 ? Math.round((subj.totalCorrect / subj.totalAttempts) * 100) : 0,
        byMode: subj.byMode,
        topics: Object.values(subj.topicMap).map((t) => ({
          ...t,
          percentage: t.totalAttempts > 0 ? Math.round((t.totalCorrect / t.totalAttempts) * 100) : 0,
        })),
        skills,
      };
    });

    console.log(`[MASTERY] Profile for ${user.id}: ${records.length} raw records → ${subjects.length} subjects: ${subjects.map(s => `${s.subjectId}(${s.percentage}%)`).join(', ')}`);

    return c.json({
      subjects,
      totalQuestions: grandTotalAttempts,
      totalCorrect: grandTotalCorrect,
      lastUpdated,
    });
  } catch (error) {
    console.error("[MASTERY] mastery-profile read error:", error);
    return c.json({ error: `Failed to read mastery profile: ${error.message}` }, 500);
  }
});

/**
 * GET /parent/mastery-trend — Fetch daily mastery snapshots for trend charting
 *
 * Query params:
 *   days — number of days to look back (default 30, max 90)
 *
 * Returns: { snapshots: [{ date, subjects: { [subjectId]: { attempts, correct, percentage } } }] }
 */
app.get("/make-server-221a61bc/parent/mastery-trend", async (c) => {
  try {
    const userTokenHeader = c.req.header("X-User-Token");
    const { error: authError, user } = await verifyToken(userTokenHeader);
    if (authError || !user) return c.json({ error: "Unauthorized (mastery-trend read)" }, 401);

    const daysParam = parseInt(c.req.query("days") || "30") || 30;
    const days = Math.min(Math.max(daysParam, 7), 90);

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const cutoffStr = cutoffDate.toISOString().slice(0, 10);

    const { data: snapRows } = await supabaseAdmin.from('mastery_trends').select('date, subjects, updated_at').eq('user_id', user.id).gte('date', cutoffStr).order('date', { ascending: true });
    const filtered = (snapRows || []).map((r: any) => ({ date: r.date, subjects: r.subjects, updatedAt: r.updated_at }));

    console.log(`[MASTERY] Trend for ${user.id}: ${filtered.length} snapshots within ${days}d window`);

    return c.json({ snapshots: filtered });
  } catch (error) {
    console.error("[MASTERY] mastery-trend read error:", error);
    return c.json({ error: `Failed to read mastery trend: ${error.message}` }, 500);
  }
});

// ===== SUPER ADMIN — ADD GOLD/XP/DIAMONDS TO USER =====
app.post("/make-server-221a61bc/admin/add-currency", async (c) => {
  try {
    const userTokenHeader = c.req.header('X-User-Token');
    const { error: authError, user } = await verifyToken(userTokenHeader);
    if (authError || !user) {
      return c.json({ error: `Unauthorized: ${authError || 'No user'}` }, 401);
    }

    // Verify superadmin role
    const role = resolveUserRole(user.email || '', user.user_metadata);
    if (role !== 'superadmin') {
      return c.json({ error: 'Forbidden: superadmin only' }, 403);
    }

    const body = await c.req.json();
    const { targetUserId, gold, xp, diamond, reason } = body;

    if (!targetUserId) return c.json({ error: 'Missing targetUserId' }, 400);

    const goldAmt = parseInt(gold) || 0;
    const xpAmt = parseInt(xp) || 0;
    const diamondAmt = parseInt(diamond) || 0;

    if (goldAmt === 0 && xpAmt === 0 && diamondAmt === 0) {
      return c.json({ error: 'At least one currency amount must be non-zero' }, 400);
    }

    // Load existing realm stats
    const { data: existing } = await supabaseAdmin.from('realm_stats').select('*').eq('user_id', targetUserId).limit(1).single();
    if (!existing) {
      return c.json({ error: `No realm stats found for user ${targetUserId}. The user may not have entered the Realm yet.` }, 404);
    }

    // Apply currency changes (allow negative for deductions)
    const updatedStats = {
      gold: Math.max(0, (existing.gold || 0) + goldAmt),
      xp: Math.max(0, (existing.xp || 0) + xpAmt),
      diamond: Math.max(0, (existing.diamond || 0) + diamondAmt),
      updated_at: new Date().toISOString(),
    };

    await supabaseAdmin.from('realm_stats').update(updatedStats).eq('user_id', targetUserId);

    console.log(`[ADMIN] Currency added by ${user.email} to ${targetUserId}: gold=${goldAmt}, xp=${xpAmt}, diamond=${diamondAmt}, reason=${reason || 'admin_grant'}`);

    return c.json({
      success: true,
      applied: { gold: goldAmt, xp: xpAmt, diamond: diamondAmt },
      newBalance: { gold: updatedStats.gold, xp: updatedStats.xp, diamond: updatedStats.diamond },
    });
  } catch (error) {
    console.error('[ADMIN] add-currency error:', error);
    return c.json({ error: `Failed to add currency: ${error.message}` }, 500);
  }
});

// ===== TAXONOMY MANAGEMENT (KV-based) =====
const KSSR_TAXONOMY_KV_KEY = 'KSSR_TAXONOMY';

// GET /taxonomy — returns the live taxonomy from KV
app.get('/make-server-221a61bc/taxonomy', async (c) => {
  try {
    const raw = await kv.get(KSSR_TAXONOMY_KV_KEY);
    if (!raw) return c.json({ skills: [], source: 'empty' });
    const skills = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return c.json({ skills, source: 'kv', count: Array.isArray(skills) ? skills.length : 0 });
  } catch (error: any) {
    console.log(`[TAXONOMY] GET error: ${error.message}`);
    return c.json({ error: `Failed to load taxonomy: ${error.message}` }, 500);
  }
});

// POST /taxonomy/upload — CSV parse + validate + save
app.post('/make-server-221a61bc/taxonomy/upload', async (c) => {
  try {
    const { error: authErr, user } = await verifyToken(c.req.header('X-User-Token'));
    if (authErr || !user) return c.json({ error: `Unauthorized (upload): ${authErr || 'No user'}` }, 401);
    const role = resolveUserRole(user.email || '', user.user_metadata);
    if (role !== 'superadmin') return c.json({ error: 'Superadmin only' }, 403);

    const body = await c.req.json();
    const csvText = body.csv;
    if (!csvText || typeof csvText !== 'string') {
      return c.json({ error: 'Missing csv field in request body' }, 400);
    }

    const lines = csvText.trim().split('\n');
    if (lines.length < 2) return c.json({ error: 'CSV must have header + at least 1 row' }, 400);

    const headers = lines[0].trim().split(',').map((h: string) => h.trim().toLowerCase().replace(/\s+/g, '_'));
    const subjectIdx = headers.findIndex((h: string) => h === 'subject');
    const topicIdx = headers.findIndex((h: string) => h === 'topic');
    const subtopicIdx = headers.findIndex((h: string) => h === 'subtopic');
    const skillCodeIdx = headers.findIndex((h: string) => h === 'skill_code' || h === 'skillcode' || h === 'dskp_code' || h === 'code');
    const ageIdx = headers.findIndex((h: string) => h === 'age' || h === 'umur');

    if (subjectIdx < 0 || topicIdx < 0 || subtopicIdx < 0 || skillCodeIdx < 0) {
      return c.json({ error: `Missing required headers. Found: [${headers.join(', ')}]. Need: Subject, Topic, Subtopic, Skill Code (Age is optional)`, headers }, 400);
    }

    console.log(`[TAXONOMY] CSV headers: [${headers.join(', ')}], ageIdx=${ageIdx}`);

    const skills: any[] = [];
    const errors: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const cells: string[] = [];
      let current = '';
      let inQuotes = false;
      for (const ch of line) {
        if (ch === '"') { inQuotes = !inQuotes; continue; }
        if (ch === ',' && !inQuotes) { cells.push(current.trim()); current = ''; continue; }
        current += ch;
      }
      cells.push(current.trim());

      const subject = cells[subjectIdx] || '';
      const topic = cells[topicIdx] || '';
      const subtopic = cells[subtopicIdx] || '';
      const skillCode = cells[skillCodeIdx] || '';
      const ageRaw = ageIdx >= 0 ? (cells[ageIdx] || '') : '';
      const age = ageRaw ? parseInt(ageRaw, 10) : null;

      if (!subject || !skillCode) { errors.push(`Row ${i + 1}: missing subject or skill code`); continue; }
      const skill: any = { subject, topic, subtopic, skillCode };
      if (age != null && !isNaN(age) && age >= 4 && age <= 12) {
        skill.age = age;
      }
      skills.push(skill);
    }

    if (skills.length === 0) return c.json({ error: 'No valid skills parsed from CSV', errors }, 400);

    await kv.set(KSSR_TAXONOMY_KV_KEY, JSON.stringify(skills));
    console.log(`[TAXONOMY] Uploaded ${skills.length} skills by ${user.email}`);
    return c.json({ success: true, count: skills.length, errors: errors.length > 0 ? errors : undefined, message: `Taxonomy saved: ${skills.length} skills${errors.length > 0 ? `, ${errors.length} rows skipped` : ''}` });
  } catch (error: any) {
    console.log(`[TAXONOMY] Upload error: ${error.message}`);
    return c.json({ error: `Taxonomy upload failed: ${error.message}` }, 500);
  }
});

// DELETE /taxonomy/all — remove entire taxonomy from KV
app.delete('/make-server-221a61bc/taxonomy/all', async (c) => {
  try {
    const { error: authErr, user } = await verifyToken(c.req.header('X-User-Token'));
    if (authErr || !user) return c.json({ error: `Unauthorized (delete-all): ${authErr || 'No user'}` }, 401);
    if (resolveUserRole(user.email || '', user.user_metadata) !== 'superadmin') return c.json({ error: 'Superadmin only' }, 403);

    await kv.del(KSSR_TAXONOMY_KV_KEY);
    console.log(`[TAXONOMY] All skills deleted by ${user.email}`);
    return c.json({ success: true, message: 'All taxonomy skills removed' });
  } catch (error: any) {
    console.log(`[TAXONOMY] Delete-all error: ${error.message}`);
    return c.json({ error: `Failed to delete taxonomy: ${error.message}` }, 500);
  }
});

// POST /taxonomy/skill — add a single skill
app.post('/make-server-221a61bc/taxonomy/skill', async (c) => {
  try {
    const { error: authErr, user } = await verifyToken(c.req.header('X-User-Token'));
    if (authErr || !user) return c.json({ error: `Unauthorized (add-skill): ${authErr || 'No user'}` }, 401);
    if (resolveUserRole(user.email || '', user.user_metadata) !== 'superadmin') return c.json({ error: 'Superadmin only' }, 403);

    const { subject, topic, subtopic, skillCode } = await c.req.json();
    if (!subject || !skillCode) return c.json({ error: 'subject and skillCode required' }, 400);

    const raw = await kv.get(KSSR_TAXONOMY_KV_KEY);
    const skills: any[] = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : [];
    if (skills.some((s: any) => s.skillCode === skillCode)) return c.json({ error: `Skill code ${skillCode} already exists` }, 409);

    skills.push({ subject, topic: topic || '', subtopic: subtopic || '', skillCode });
    await kv.set(KSSR_TAXONOMY_KV_KEY, JSON.stringify(skills));
    console.log(`[TAXONOMY] Added skill ${skillCode} by ${user.email}`);
    return c.json({ success: true, count: skills.length });
  } catch (error: any) {
    return c.json({ error: `Failed to add skill: ${error.message}` }, 500);
  }
});

// PUT /taxonomy/:kod — update a skill by code
app.put('/make-server-221a61bc/taxonomy/:kod', async (c) => {
  try {
    const { error: authErr, user } = await verifyToken(c.req.header('X-User-Token'));
    if (authErr || !user) return c.json({ error: `Unauthorized (update-skill): ${authErr || 'No user'}` }, 401);
    if (resolveUserRole(user.email || '', user.user_metadata) !== 'superadmin') return c.json({ error: 'Superadmin only' }, 403);

    const kod = decodeURIComponent(c.req.param('kod'));
    const updates = await c.req.json();
    const raw = await kv.get(KSSR_TAXONOMY_KV_KEY);
    const skills: any[] = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : [];
    const idx = skills.findIndex((s: any) => s.skillCode === kod);
    if (idx < 0) return c.json({ error: `Skill ${kod} not found` }, 404);

    if (updates.subject !== undefined) skills[idx].subject = updates.subject;
    if (updates.topic !== undefined) skills[idx].topic = updates.topic;
    if (updates.subtopic !== undefined) skills[idx].subtopic = updates.subtopic;
    if (updates.skillCode !== undefined && updates.skillCode !== kod) {
      if (skills.some((s: any, i: number) => i !== idx && s.skillCode === updates.skillCode)) {
        return c.json({ error: `Skill code ${updates.skillCode} already exists` }, 409);
      }
      skills[idx].skillCode = updates.skillCode;
    }

    await kv.set(KSSR_TAXONOMY_KV_KEY, JSON.stringify(skills));
    console.log(`[TAXONOMY] Updated skill ${kod} by ${user.email}`);
    return c.json({ success: true, skill: skills[idx] });
  } catch (error: any) {
    return c.json({ error: `Failed to update skill: ${error.message}` }, 500);
  }
});

// DELETE /taxonomy/:kod — delete a skill by code
app.delete('/make-server-221a61bc/taxonomy/:kod', async (c) => {
  try {
    const { error: authErr, user } = await verifyToken(c.req.header('X-User-Token'));
    if (authErr || !user) return c.json({ error: `Unauthorized (delete-skill): ${authErr || 'No user'}` }, 401);
    if (resolveUserRole(user.email || '', user.user_metadata) !== 'superadmin') return c.json({ error: 'Superadmin only' }, 403);

    const kod = decodeURIComponent(c.req.param('kod'));
    const raw = await kv.get(KSSR_TAXONOMY_KV_KEY);
    const skills: any[] = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : [];
    const idx = skills.findIndex((s: any) => s.skillCode === kod);
    if (idx < 0) return c.json({ error: `Skill ${kod} not found` }, 404);

    skills.splice(idx, 1);
    await kv.set(KSSR_TAXONOMY_KV_KEY, JSON.stringify(skills));
    console.log(`[TAXONOMY] Deleted skill ${kod} by ${user.email}`);
    return c.json({ success: true, count: skills.length });
  } catch (error: any) {
    return c.json({ error: `Failed to delete skill: ${error.message}` }, 500);
  }
});

// ===== FMCG QR COLLABORATION SYSTEM (Prompt 2) =====
app.route("/make-server-221a61bc/fmcg", fmcg);

// ===== RPG GAME ENTITY MANAGER =====
// Game-aware entity CRUD with Supabase Storage for file uploads (dev-friendly, verifiable).
// Entities: zones, spirits, powers, characters — metadata in KV, files in Supabase Storage.
// Migration to R2 can be done later via a one-click endpoint.

const RPG_BUCKET = "rpg-assets-221a61bc";
const RPG_ENTITY_PREFIX = "rpg_entity:";

// Ensure Supabase Storage bucket exists (idempotent — called on first request)
let _rpgBucketReady = false;
async function ensureRpgBucket() {
  if (_rpgBucketReady) return;
  try {
    const { data: buckets } = await supabaseAdmin.storage.listBuckets();
    const exists = buckets?.some((b: any) => b.name === RPG_BUCKET);
    if (!exists) {
      await supabaseAdmin.storage.createBucket(RPG_BUCKET, { public: false });
      console.log(`[RPG-GAME] Created Supabase Storage bucket: ${RPG_BUCKET}`);
    }
    _rpgBucketReady = true;
  } catch (err) {
    console.error("[RPG-GAME] Bucket init error:", err);
  }
}

// ── Upload file to Supabase Storage ──
app.post("/make-server-221a61bc/rpg-game/upload", async (c) => {
  try {
    const userTokenHeader = c.req.header("X-User-Token");
    const { error: authError, user } = await verifyToken(userTokenHeader);
    if (authError || !user) return c.json({ error: `Unauthorized: ${authError || "No user"}` }, 401);

    await ensureRpgBucket();

    const body = await c.req.json();
    const { data, filename, contentType, path: storagePath } = body;

    if (!data || !filename || !storagePath) {
      return c.json({ error: "Missing required fields: data (base64), filename, path" }, 400);
    }

    const binaryStr = atob(data);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) { bytes[i] = binaryStr.charCodeAt(i); }

    if (bytes.length > 10 * 1024 * 1024) {
      return c.json({ error: `File too large (${(bytes.length / 1024 / 1024).toFixed(1)}MB > 10MB limit)` }, 400);
    }

    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from(RPG_BUCKET)
      .upload(storagePath, bytes, { contentType: contentType || "image/png", upsert: true });

    if (uploadError) {
      console.error("[RPG-GAME] Storage upload error:", uploadError);
      return c.json({ error: `Storage upload failed: ${uploadError.message}` }, 500);
    }

    const { data: signedData } = await supabaseAdmin.storage
      .from(RPG_BUCKET)
      .createSignedUrl(storagePath, 3600);

    console.log(`[RPG-GAME] Uploaded: ${storagePath} (${bytes.length} bytes)`);
    return c.json({
      success: true,
      path: storagePath,
      signedUrl: signedData?.signedUrl || null,
      sizeKB: Math.round(bytes.length / 1024),
    });
  } catch (error: any) {
    console.error("[RPG-GAME] Upload error:", error);
    return c.json({ error: `RPG game upload failed: ${error.message}` }, 500);
  }
});

// ── Delete file from Supabase Storage ──
app.delete("/make-server-221a61bc/rpg-game/file", async (c) => {
  try {
    const userTokenHeader = c.req.header("X-User-Token");
    const { error: authError, user } = await verifyToken(userTokenHeader);
    if (authError || !user) return c.json({ error: `Unauthorized: ${authError || "No user"}` }, 401);

    await ensureRpgBucket();
    const { path: storagePath } = await c.req.json();
    if (!storagePath) return c.json({ error: "Missing path" }, 400);

    const { error: delError } = await supabaseAdmin.storage.from(RPG_BUCKET).remove([storagePath]);
    if (delError) return c.json({ error: `Storage delete failed: ${delError.message}` }, 500);

    console.log(`[RPG-GAME] Deleted file: ${storagePath}`);
    return c.json({ success: true, deleted: storagePath });
  } catch (error: any) {
    return c.json({ error: `RPG game file delete failed: ${error.message}` }, 500);
  }
});

// ── Get signed URL for a file ──
app.post("/make-server-221a61bc/rpg-game/signed-url", async (c) => {
  try {
    await ensureRpgBucket();
    const { path: storagePath } = await c.req.json();
    if (!storagePath) return c.json({ error: "Missing path" }, 400);

    const { data: signedData, error } = await supabaseAdmin.storage
      .from(RPG_BUCKET)
      .createSignedUrl(storagePath, 3600);

    if (error) return c.json({ error: `Signed URL failed: ${error.message}` }, 500);
    return c.json({ success: true, signedUrl: signedData?.signedUrl });
  } catch (error: any) {
    return c.json({ error: `Signed URL error: ${error.message}` }, 500);
  }
});

// ── Batch signed URLs ──
app.post("/make-server-221a61bc/rpg-game/signed-urls", async (c) => {
  try {
    await ensureRpgBucket();
    const { paths } = await c.req.json();
    if (!paths || !Array.isArray(paths)) return c.json({ error: "Missing paths array" }, 400);

    const results: Record<string, string> = {};
    for (const p of paths) {
      const { data } = await supabaseAdmin.storage.from(RPG_BUCKET).createSignedUrl(p, 3600);
      if (data?.signedUrl) results[p] = data.signedUrl;
    }
    return c.json({ success: true, urls: results });
  } catch (error: any) {
    return c.json({ error: `Batch signed URL error: ${error.message}` }, 500);
  }
});

// ── List files in a storage folder ──
app.get("/make-server-221a61bc/rpg-game/files", async (c) => {
  try {
    await ensureRpgBucket();
    const folder = c.req.query("folder") || "";
    const { data, error } = await supabaseAdmin.storage.from(RPG_BUCKET).list(folder, { limit: 500 });
    if (error) return c.json({ error: `List failed: ${error.message}` }, 500);
    return c.json({ success: true, files: data || [] });
  } catch (error: any) {
    return c.json({ error: `List files error: ${error.message}` }, 500);
  }
});

// ── GENERIC ENTITY CRUD (zones, spirits, powers, characters) ──

const VALID_ENTITY_TYPES = ["zone", "spirit", "power", "character", "map"];

function entityKvKey(type: string, id: string) {
  return `${RPG_ENTITY_PREFIX}${type}:${id}`;
}
function entityKvPrefix(type: string) {
  return `${RPG_ENTITY_PREFIX}${type}:`;
}

// Save entity (create or update)
app.post("/make-server-221a61bc/rpg-game/entity", async (c) => {
  try {
    const userTokenHeader = c.req.header("X-User-Token");
    const { error: authError, user } = await verifyToken(userTokenHeader);
    if (authError || !user) return c.json({ error: `Unauthorized: ${authError || "No user"}` }, 401);

    const { type, id, data } = await c.req.json();
    if (!type || !VALID_ENTITY_TYPES.includes(type)) {
      return c.json({ error: `Invalid entity type: ${type}. Valid: ${VALID_ENTITY_TYPES.join(", ")}` }, 400);
    }
    if (!id) return c.json({ error: "Missing entity id" }, 400);
    if (!data || typeof data !== "object") return c.json({ error: "Missing entity data object" }, 400);

    const existing = await kv.get(entityKvKey(type, id));
    const entity = {
      ...data,
      id,
      type,
      createdAt: existing ? (existing as any).createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await kv.set(entityKvKey(type, id), entity);
    console.log(`[RPG-GAME] Saved ${type}: ${id} by ${user.email}`);
    return c.json({ success: true, entity });
  } catch (error: any) {
    console.error("[RPG-GAME] Entity save error:", error);
    return c.json({ error: `Entity save failed: ${error.message}` }, 500);
  }
});

// List entities by type
app.get("/make-server-221a61bc/rpg-game/entities/:type", async (c) => {
  try {
    const type = c.req.param("type");
    if (!VALID_ENTITY_TYPES.includes(type)) {
      return c.json({ error: `Invalid entity type: ${type}` }, 400);
    }

    const entities = await kv.getByPrefix(entityKvPrefix(type));
    const sorted = (entities || []).sort((a: any, b: any) => {
      return (a.name || a.id || "").localeCompare(b.name || b.id || "");
    });

    return c.json({ success: true, entities: sorted, total: sorted.length });
  } catch (error: any) {
    console.error("[RPG-GAME] Entity list error:", error);
    return c.json({ error: `Entity list failed: ${error.message}` }, 500);
  }
});

// Get single entity
app.get("/make-server-221a61bc/rpg-game/entity/:type/:id", async (c) => {
  try {
    const type = c.req.param("type");
    const id = c.req.param("id");
    if (!VALID_ENTITY_TYPES.includes(type)) {
      return c.json({ error: `Invalid entity type: ${type}` }, 400);
    }
    const entity = await kv.get(entityKvKey(type, id));
    if (!entity) return c.json({ error: `Entity not found: ${type}/${id}` }, 404);
    return c.json({ success: true, entity });
  } catch (error: any) {
    return c.json({ error: `Entity get failed: ${error.message}` }, 500);
  }
});

// Delete entity (+ cleanup storage files)
app.delete("/make-server-221a61bc/rpg-game/entity/:type/:id", async (c) => {
  try {
    const userTokenHeader = c.req.header("X-User-Token");
    const { error: authError, user } = await verifyToken(userTokenHeader);
    if (authError || !user) return c.json({ error: `Unauthorized: ${authError || "No user"}` }, 401);

    const type = c.req.param("type");
    const id = c.req.param("id");
    if (!VALID_ENTITY_TYPES.includes(type)) {
      return c.json({ error: `Invalid entity type: ${type}` }, 400);
    }

    const entity = await kv.get(entityKvKey(type, id));
    if (!entity) return c.json({ error: `Entity not found: ${type}/${id}` }, 404);

    // Delete associated storage files
    const assets = (entity as any).assets || {};
    const filePaths = Object.values(assets).filter((v: any) => typeof v === "string" && v.length > 0) as string[];
    if (filePaths.length > 0) {
      try {
        await ensureRpgBucket();
        await supabaseAdmin.storage.from(RPG_BUCKET).remove(filePaths);
        console.log(`[RPG-GAME] Deleted ${filePaths.length} storage files for ${type}/${id}`);
      } catch (err) {
        console.error(`[RPG-GAME] Storage cleanup error for ${type}/${id}:`, err);
      }
    }

    await kv.del(entityKvKey(type, id));
    console.log(`[RPG-GAME] Deleted ${type}: ${id} by ${user.email}`);
    return c.json({ success: true, deleted: { type, id } });
  } catch (error: any) {
    console.error("[RPG-GAME] Entity delete error:", error);
    return c.json({ error: `Entity delete failed: ${error.message}` }, 500);
  }
});

Deno.serve(app.fetch);