import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import * as kv from "./kv_store.tsx";
import { supabaseAdmin, verifyToken, getSchoolForUser } from "./auth.tsx";
import { stripeRoutes } from "./stripe.tsx";
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
  } catch (err) {
    console.error('[STORAGE] Failed to create buckets:', err);
  }
})();

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
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
    const prefix = `school_lead:${schoolId}:`;
    console.log(`[DEBUG] Checking leads with prefix: ${prefix}`);
    
    const leads = await kv.getByPrefix(prefix);
    console.log(`[DEBUG] Found ${leads.length} leads`);
    
    // Also check the school_by_id key
    const school = await kv.get(`school_by_id:${schoolId}`);
    
    return c.json({
      schoolId,
      schoolExists: !!school,
      schoolName: school?.school_name || 'NOT FOUND',
      prefix,
      leadCount: leads.length,
      leads: leads.map((l: any) => ({
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
      schoolData = await kv.get(`school_by_url:${url}`);
    }

    if (!schoolData && email) {
      // Dev mode: lookup by email - find the user first, then the school
      console.log(`Resolving school by email: ${email}`);
      
      // List all users to find one with matching email
      const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers();
      
      if (error) {
        console.error('Error listing users:', error);
        return c.json({ error: 'Failed to lookup user' }, 500);
      }

      const user = users?.find(u => u.email === email);
      if (user) {
        schoolData = await kv.get(`school:${user.id}`);
      }
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
    let schoolData = await kv.get(`school_by_code:${code.toUpperCase()}`);

    // Strategy 2: Fallback to URL slug (e.g. little-stars-kindergarten)
    if (!schoolData) {
      schoolData = await kv.get(`school_by_url:${code}`);
    }

    // Strategy 3: Scan school_by_id entries for a matching short_code field
    if (!schoolData) {
      const allSchools = await kv.getByPrefix('school_by_id:');
      schoolData = allSchools.find((s: any) =>
        s && (s.short_code?.toUpperCase() === code.toUpperCase() ||
              s.kindergarten_url === code)
      ) || null;
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
        const existing = await kv.get(`school_by_code:${code}`);
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
      await kv.set(`school:${authData.user.id}`, schoolData);
      await kv.set(`school_by_id:${schoolId}`, schoolData);
      await kv.set(`school_by_url:${kindergartenUrl}`, schoolData);
      await kv.set(`school_by_code:${shortCode}`, schoolData);
      console.log(`School created successfully: ${schoolId}, shortCode: ${shortCode}`);
    } catch (kvError) {
      console.error('School creation error:', kvError);
      // Rollback: delete the user if school creation fails
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return c.json({ error: `Failed to create school: ${kvError.message}` }, 500);
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

    // Get school for this user from KV store
    const schoolData = await kv.get(`school:${authData.user.id}`);

    if (!schoolData) {
      console.error('No school found for user:', authData.user.id);
      return c.json({ error: 'No school associated with this account' }, 404);
    }

    console.log(`Login successful for school: ${schoolData.school_name}`);

    const role = resolveUserRole(authData.user.email!, authData.user.user_metadata);
    console.log(`User role resolved: ${role}`);

    return c.json({
      success: true,
      user: {
        id: authData.user.id,
        email: authData.user.email,
        role, // 'superadmin' | 'kindergarten'
      },
      school: schoolData,
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

    // Get school for this user
    const { error: schoolError, school } = await getSchoolForUser(user.id);

    if (schoolError || !school) {
      console.log('Session check - no school found:', schoolError);
      return c.json({ error: 'No school found', valid: false }, 404);
    }

    const role = resolveUserRole(user.email!, user.user_metadata);
    console.log(`Session valid for user: ${user.id}, school: ${school.school_name}, role: ${role}`);

    return c.json({
      valid: true,
      user: {
        id: user.id,
        email: user.email,
        role, // 'superadmin' | 'kindergarten'
      },
      school: school,
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

    await kv.set(`school_by_id:${school.id}`, merged);

    // Also update related KV keys
    if (school.email) {
      try {
        const emailRecord = await kv.get(`school_by_email:${school.email}`);
        if (emailRecord) {
          await kv.set(`school_by_email:${school.email}`, { ...emailRecord, ...merged });
        }
      } catch (_) {}
    }
    if (school.kindergarten_url) {
      try {
        await kv.set(`school_by_url:${school.kindergarten_url}`, merged);
      } catch (_) {}
    }
    if (school.short_code) {
      try {
        await kv.set(`school_by_code:${school.short_code}`, merged);
      } catch (_) {}
    }
    // Also update the school:{userId} key
    try {
      await kv.set(`school:${user.id}`, merged);
    } catch (_) {}

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

      await kv.set(`question:${questionId}`, questionData);
      await kv.set(`school_question:${school.id}:${questionId}`, questionData);
      
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
    const questions = await kv.getByPrefix(`school_question:${school.id}:`);

    // Transform to frontend format
    const transformedQuestions = questions.map(q => ({
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

    // Sort by created_at descending
    transformedQuestions.sort((a, b) => {
      const dateA = new Date(questions.find(q => q.id === a.id)?.created_at || 0);
      const dateB = new Date(questions.find(q => q.id === b.id)?.created_at || 0);
      return dateB.getTime() - dateA.getTime();
    });

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

    await kv.del(`question:${questionId}`);
    await kv.del(`school_question:${school.id}:${questionId}`);

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
    const phoneLookupKey = `school_lead_phone:${schoolId}:${normalizedPhone}`;

    console.log(`[LEAD-LOOKUP] Checking for existing lead: phone=${normalizedPhone}, school=${schoolId}`);

    const existingLeadId = await kv.get(phoneLookupKey);
    if (!existingLeadId) {
      console.log('[LEAD-LOOKUP] No existing lead found');
      return c.json({ success: true, found: false, lead: null });
    }

    const leadData = await kv.get(`lead:${existingLeadId}`);
    if (!leadData) {
      console.log(`[LEAD-LOOKUP] Lead ID found (${existingLeadId}) but data missing`);
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
    const schoolData = await kv.get(`school_by_id:${schoolId}`);
    if (!schoolData) {
      console.error(`School not found: ${schoolId}`);
      return c.json({ error: "School not found. Please check the school ID." }, 404);
    }

    // Normalize phone number for lookup (strip spaces/dashes)
    const normalizedPhone = whatsapp.replace(/[\s\-]/g, '');
    const phoneLookupKey = `school_lead_phone:${schoolId}:${normalizedPhone}`;

    // Check if a lead with this phone+school already exists
    let existingLeadId = await kv.get(phoneLookupKey);
    let leadId: string;
    let isUpdate = false;

    if (existingLeadId) {
      // Existing lead found — update it
      leadId = existingLeadId;
      isUpdate = true;
      console.log(`Updating existing lead ${leadId} for phone ${normalizedPhone} at school ${schoolId}`);
    } else {
      // New lead
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
      created_at: isUpdate ? (await kv.get(`lead:${leadId}`))?.created_at || now : now,
      updated_at: now
    };

    // Resolve referral code → parent ID if provided (only on new leads)
    if (referralCode && !isUpdate) {
      try {
        const referrerParentId = await kv.get(`referral_code:${referralCode}`);
        if (referrerParentId) {
          leadData.referred_by_parent_id = referrerParentId;
          // Append to referrals-by-parent list
          const listKey = `referrals_by_parent:${referrerParentId}`;
          const existing = await kv.get(listKey) || [];
          if (!existing.includes(leadId)) {
            existing.push(leadId);
            await kv.set(listKey, existing);
          }
          console.log(`[LEAD] Referral attributed: code=${referralCode} → parent=${referrerParentId}`);
        } else {
          console.warn(`[LEAD] Referral code not found: ${referralCode}`);
        }
      } catch (refErr) {
        console.error(`[LEAD] Referral resolution failed:`, refErr);
      }
    }

    // Write to all KV keys
    await kv.set(`lead:${leadId}`, leadData);
    await kv.set(`school_lead:${schoolId}:${leadId}`, leadData);
    await kv.set(phoneLookupKey, leadId); // phone → leadId lookup

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
    const existingLead = await kv.get(`lead:${leadId}`);
    if (!existingLead) {
      console.error(`Lead not found for update: ${leadId}`);
      return c.json({ error: "Lead not found" }, 404);
    }

    // Merge updates into existing lead
    const updatedLead = {
      ...existingLead,
      ...body,
      id: leadId, // Prevent ID overwrite
      school_id: existingLead.school_id, // Prevent school overwrite
      created_at: existingLead.created_at, // Preserve original creation time
      updated_at: new Date().toISOString()
    };

    // Write to all KV keys
    await kv.set(`lead:${leadId}`, updatedLead);
    await kv.set(`school_lead:${existingLead.school_id}:${leadId}`, updatedLead);

    console.log(`Lead ${leadId} updated. Status: ${updatedLead.status}, Score: ${updatedLead.score}/${updatedLead.total_questions}`);

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

    const queryPrefix = `school_lead:${school.id}:`;
    console.log(`Fetching leads for school ${school.id} (${school.school_name}), prefix: ${queryPrefix}`);

    // Get all leads for this school
    const leads = await kv.getByPrefix(queryPrefix);

    // Sort by created_at descending
    leads.sort((a, b) => {
      const dateA = new Date(a.created_at || 0);
      const dateB = new Date(b.created_at || 0);
      return dateB.getTime() - dateA.getTime();
    });

    console.log(`Returning ${leads.length} leads for school ${school.id}`);

    return c.json({
      success: true,
      leads: leads || [],
      _debug: {
        schoolId: school.id,
        schoolName: school.school_name,
        userId: user.id,
        userEmail: user.email,
        queryPrefix,
        leadCount: leads.length,
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

    await kv.del(`lead:${leadId}`);
    await kv.del(`school_lead:${school.id}:${leadId}`);

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
    const existingQuestions = await kv.getByPrefix('gq:');
    const counterMap: Record<string, number> = {};
    for (const eq of existingQuestions) {
      if (!eq.q_id) continue;
      // Parse existing q_id like "MATH-4-012" to extract subject, age, and number
      const parts = eq.q_id.split('-');
      if (parts.length >= 3) {
        const num = parseInt(parts[parts.length - 1], 10);
        const prefix = parts.slice(0, -1).join('-'); // e.g. "MATH-4"
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
      if (!q.age_target || ![4, 5, 6, 7].includes(Number(q.age_target))) {
        errors.push(`Row ${rowNum}: age_target must be 4, 5, 6, or 7`); continue;
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
      const age = Number(q.age_target);
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

      validQuestions.push({
        q_id: generatedId,
        age_target: age,
        subject: q.subject.trim(),
        dskp_code: q.dskp_code || '',
        question_text_en: q.question_text_en.trim(),
        question_text_ms: q.question_text_ms.trim(),
        question_text_zh: (q.question_text_zh || '').trim(),
        input_type: q.input_type.trim(),
        options_en: parsedOptionsEn,
        options_ms: parsedOptionsMs,
        options_zh: parsedOptionsZh,
        correct_answer: String(q.correct_answer).trim(),
        visual_prompt: q.visual_prompt || '',
        image_url: q.image_url || '',
        uploaded_by: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }

    if (errors.length > 0 && validQuestions.length === 0) {
      return c.json({ success: false, error: 'All rows had validation errors', errors }, 400);
    }

    // Store each valid question (mset for efficiency)
    const kvKeys = validQuestions.map(q => `gq:${q.q_id}`);
    const kvValues = validQuestions.map(q => q);
    await kv.mset(kvKeys, kvValues);

    console.log(`[QUESTION-BANK] Stored ${validQuestions.length} questions, ${errors.length} errors`);

    return c.json({
      success: true,
      stored: validQuestions.length,
      errors,
      message: `${validQuestions.length} questions stored${errors.length > 0 ? `, ${errors.length} rows had errors` : ''}`
    });
  } catch (error) {
    console.error('[QUESTION-BANK] Upload error:', error);
    return c.json({ error: `Upload failed: ${error.message}` }, 500);
  }
});

// ===== MCQ-IMAGE UPLOAD: Download answer images from URLs, re-upload to Storage =====
// CSV has image URLs for answer options; server downloads, validates, stores permanently
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
    const existingQuestions = await kv.getByPrefix('gq:');
    const counterMap: Record<string, number> = {};
    for (const eq of existingQuestions) {
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

    // Helper: download image from URL → upload to Supabase Storage
    const downloadAndStore = async (imageUrl: string, qId: string, optionId: string): Promise<{ storagePath: string } | { error: string }> => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

        const response = await fetch(imageUrl, { signal: controller.signal });
        clearTimeout(timeout);

        if (!response.ok) {
          return { error: `HTTP ${response.status} for ${imageUrl}` };
        }

        const contentType = response.headers.get('content-type') || '';
        if (!contentType.startsWith('image/')) {
          return { error: `Not an image (${contentType}) for ${imageUrl}` };
        }

        const arrayBuffer = await response.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);

        // Validate size (max 200KB)
        if (bytes.length > 200 * 1024) {
          return { error: `Image too large (${(bytes.length / 1024).toFixed(0)}KB > 200KB) for ${imageUrl}` };
        }

        // Determine extension from content-type
        const extMap: Record<string, string> = {
          'image/png': 'png', 'image/jpeg': 'jpg', 'image/jpg': 'jpg',
          'image/webp': 'webp', 'image/gif': 'gif', 'image/svg+xml': 'svg',
        };
        const ext = extMap[contentType] || 'png';
        const storagePath = `${qId}/${optionId}.${ext}`;

        const { error: uploadError } = await supabaseAdmin.storage
          .from(ANSWER_IMAGE_BUCKET)
          .upload(storagePath, bytes, { contentType, upsert: true });

        if (uploadError) {
          return { error: `Storage upload failed for ${optionId}: ${uploadError.message}` };
        }

        return { storagePath };
      } catch (err: any) {
        if (err.name === 'AbortError') {
          return { error: `Download timeout (>10s) for ${imageUrl}` };
        }
        return { error: `Download failed for ${imageUrl}: ${err.message}` };
      }
    };

    const errors: string[] = [];
    const validQuestions: any[] = [];
    let imagesProcessed = 0;
    const totalImages = questions.length * 4; // 4 options per question

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const rowNum = i + 1;

      // Validate required fields
      if (!q.age_target || ![4, 5, 6, 7].includes(Number(q.age_target))) {
        errors.push(`Row ${rowNum}: age_target must be 4, 5, 6, or 7`); continue;
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
      const age = Number(q.age_target);
      const abbrev = subjectAbbrev(q.subject);
      const prefix = `${abbrev}-${age}`;
      const currentMax = counterMap[prefix] || 0;
      const nextNum = currentMax + 1;
      counterMap[prefix] = nextNum;
      const generatedId = `${prefix}-${String(nextNum).padStart(3, '0')}`;

      // Download and store all 4 answer images
      console.log(`[MCQ-IMAGE] Processing row ${rowNum}/${questions.length}: ${generatedId} (images ${imagesProcessed + 1}-${imagesProcessed + 4}/${totalImages})`);

      const optionIds = ['a', 'b', 'c', 'd'];
      const imagePaths: Record<string, string> = {};
      let rowHasError = false;

      for (let j = 0; j < 4; j++) {
        const result = await downloadAndStore(imageUrls[j].trim(), generatedId, optionIds[j]);
        imagesProcessed++;
        if ('error' in result) {
          errors.push(`Row ${rowNum}, option ${optionIds[j]}: ${result.error}`);
          rowHasError = true;
          break;
        }
        imagePaths[optionIds[j]] = result.storagePath;
      }

      if (rowHasError) continue;

      // Build options arrays with image storage paths (same images for all languages)
      const buildOptions = (labels?: string[]) => {
        return optionIds.map((id, idx) => ({
          id,
          text: labels?.[idx]?.trim() || '',
          image: imagePaths[id],
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

      validQuestions.push({
        q_id: generatedId,
        age_target: age,
        subject: q.subject.trim(),
        dskp_code: q.dskp_code || '',
        question_text_en: q.question_text_en.trim(),
        question_text_ms: q.question_text_ms.trim(),
        question_text_zh: (q.question_text_zh || '').trim(),
        input_type: 'mcq',
        answer_type: 'mcq-image', // Distinguishes from text MCQ
        options_en: buildOptions(labelsEn),
        options_ms: buildOptions(labelsMs),
        options_zh: buildOptions(labelsZh),
        correct_answer: String(q.correct_answer).trim(),
        visual_prompt: q.visual_prompt || '',
        image_url: q.image_url || '',
        uploaded_by: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      console.log(`[MCQ-IMAGE] Row ${rowNum} OK: ${generatedId}, 4 images stored`);
    }

    if (errors.length > 0 && validQuestions.length === 0) {
      return c.json({ success: false, error: 'All rows had errors', errors }, 400);
    }

    // Store each valid question
    const kvKeys = validQuestions.map(q => `gq:${q.q_id}`);
    const kvValues = validQuestions.map(q => q);
    await kv.mset(kvKeys, kvValues);

    console.log(`[MCQ-IMAGE] Stored ${validQuestions.length} questions (${imagesProcessed} images processed), ${errors.length} errors`);

    return c.json({
      success: true,
      stored: validQuestions.length,
      imagesProcessed,
      errors,
      message: `${validQuestions.length} image-MCQ questions stored (${imagesProcessed} images downloaded)${errors.length > 0 ? `, ${errors.length} rows had errors` : ''}`
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

    const allQuestions = await kv.getByPrefix('gq:');
    const keys = allQuestions.map((q: any) => `gq:${q.q_id}`);

    if (keys.length > 0) {
      await kv.mdel(keys);
    }

    console.log(`[QUESTION-BANK] Cleared ${keys.length} questions`);
    return c.json({ success: true, deleted: keys.length });
  } catch (error) {
    console.error('[QUESTION-BANK] Clear all error:', error);
    return c.json({ error: `Failed to clear questions: ${error.message}` }, 500);
  }
});

// Get question bank stats — subjects with counts per age (public)
app.get("/make-server-221a61bc/question-bank/stats", async (c) => {
  try {
    const allQuestions = await kv.getByPrefix('gq:');

    const subjectMap: Record<string, { count: number; ages: Record<number, number> }> = {};

    for (const q of allQuestions) {
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

    console.log(`[QUESTION-BANK] Stats: ${subjects.length} subjects, ${allQuestions.length} total questions`);

    return c.json({
      success: true,
      subjects,
      totalQuestions: allQuestions.length
    });
  } catch (error) {
    console.error('[QUESTION-BANK] Stats error:', error);
    return c.json({ error: `Failed to get stats: ${error.message}` }, 500);
  }
});

// Get questions from bank (public — for child flow)
// Optional query params: ?subject=English&age_target=5
app.get("/make-server-221a61bc/question-bank", async (c) => {
  try {
    const subject = c.req.query('subject');
    const ageTarget = c.req.query('age_target');

    console.log(`[QUESTION-BANK] Fetching: subject=${subject || 'all'}, age=${ageTarget || 'all'}`);

    const allQuestions = await kv.getByPrefix('gq:');
    let filtered = allQuestions.map((item: any) => item.value || item);

    if (subject) {
      filtered = filtered.filter((q: any) => q.subject?.toLowerCase() === subject.toLowerCase());
    }
    if (ageTarget) {
      filtered = filtered.filter((q: any) => String(q.age_target) === ageTarget);
    }

    // Resolve storage paths to signed URLs for image_url fields AND answer images
    const resolvedQuestions = await Promise.all(filtered.map(async (q: any) => {
      const resolved = { ...q };

      // Resolve question image_url if it's a storage path
      if (q.image_url && !q.image_url.startsWith('http')) {
        try {
          const { data: urlData } = await supabaseAdmin.storage
            .from(QUEST_IMAGE_BUCKET)
            .createSignedUrl(q.image_url, 3600);
          resolved.image_url = urlData?.signedUrl || q.image_url;
        } catch {}
      }

      // Resolve answer images for mcq-image type questions
      if (q.answer_type === 'mcq-image') {
        const resolveOptionsImages = async (options: any[]): Promise<any[]> => {
          if (!Array.isArray(options)) return options;
          return Promise.all(options.map(async (opt: any) => {
            if (opt.image && !opt.image.startsWith('http')) {
              try {
                const { data } = await supabaseAdmin.storage
                  .from(ANSWER_IMAGE_BUCKET)
                  .createSignedUrl(opt.image, 3600);
                return { ...opt, image: data?.signedUrl || opt.image };
              } catch {
                return opt;
              }
            }
            return opt;
          }));
        };
        if (resolved.options_en) resolved.options_en = await resolveOptionsImages(resolved.options_en);
        if (resolved.options_ms) resolved.options_ms = await resolveOptionsImages(resolved.options_ms);
        if (resolved.options_zh) resolved.options_zh = await resolveOptionsImages(resolved.options_zh);
      }

      return resolved;
    }));

    console.log(`[QUESTION-BANK] Returning ${resolvedQuestions.length} of ${allQuestions.length} questions`);

    return c.json({
      success: true,
      questions: resolvedQuestions,
      total: resolvedQuestions.length,
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

    await kv.del(`gq:${qId}`);

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
    const existing = await kv.get(`gq:${qId}`);
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
      const age = Number(updates.age_target);
      if (![4, 5, 6, 7].includes(age)) {
        return c.json({ error: 'age_target must be 4, 5, 6, or 7' }, 400);
      }
      updated.age_target = age;
    }
    if (updates.subject !== undefined) updated.subject = updates.subject.trim();
    if (updates.dskp_code !== undefined) updated.dskp_code = updates.dskp_code.trim();
    if (updates.input_type !== undefined) {
      if (!['mcq', 'sequence', 'hotspot'].includes(updates.input_type)) {
        return c.json({ error: 'input_type must be mcq, sequence, or hotspot' }, 400);
      }
      updated.input_type = updates.input_type;
    }
    if (updates.correct_answer !== undefined) updated.correct_answer = String(updates.correct_answer).trim();
    if (updates.visual_prompt !== undefined) updated.visual_prompt = updates.visual_prompt || '';
    if (updates.image_url !== undefined) updated.image_url = updates.image_url || '';
    if (updates.options_en !== undefined) updated.options_en = parseOptions(updates.options_en);
    if (updates.options_ms !== undefined) updated.options_ms = parseOptions(updates.options_ms);
    if (updates.options_zh !== undefined) updated.options_zh = parseOptions(updates.options_zh);

    updated.updated_at = new Date().toISOString();

    await kv.set(`gq:${qId}`, updated);

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

    await kv.set(`quest_config:${questId}`, questData);

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
    const allQuests = await kv.getByPrefix('quest_config:');
    const liveQuests = allQuests
      .filter((q: any) => q.status === 'live')
      .sort((a: any, b: any) => (a.created_at || '').localeCompare(b.created_at || ''));

    // Resolve signed image URLs server-side (24h TTL) so frontend doesn't need separate calls
    const resolvedQuests = await Promise.all(
      liveQuests.map(async (q: any) => {
        if (!q.image_path) return q;
        try {
          const { data } = await supabaseAdmin.storage
            .from(QUEST_IMAGE_BUCKET)
            .createSignedUrl(q.image_path, 86400); // 24 hours
          return { ...q, signed_image_url: data?.signedUrl || null };
        } catch {
          return { ...q, signed_image_url: null };
        }
      })
    );

    console.log(`[QUESTS] Returning ${resolvedQuests.length} live quests with signed URLs (${allQuests.length} total)`);

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

    const quests = await kv.getByPrefix('quest_config:');
    quests.sort((a: any, b: any) => (a.created_at || '').localeCompare(b.created_at || ''));

    // Resolve signed image URLs server-side (24h TTL) so frontend doesn't need separate calls
    const resolvedQuests = await Promise.all(
      quests.map(async (q: any) => {
        if (!q.image_path) return q;
        try {
          const { data } = await supabaseAdmin.storage
            .from(QUEST_IMAGE_BUCKET)
            .createSignedUrl(q.image_path, 86400); // 24 hours
          return { ...q, signed_image_url: data?.signedUrl || null };
        } catch {
          return { ...q, signed_image_url: null };
        }
      })
    );

    console.log(`[QUESTS] Returning all ${resolvedQuests.length} quests with signed URLs (admin)`);

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

    const existing = await kv.get(`quest_config:${questId}`);
    if (!existing) {
      return c.json({ error: 'Quest not found' }, 404);
    }

    // Handle name field — accept string or multilingual object
    if (body.name && typeof body.name === 'string') {
      body.name = { en: body.name, ms: body.name, zh: body.name };
    }

    const updated = {
      ...existing,
      ...body,
      id: questId,
      created_at: existing.created_at,
      created_by: existing.created_by,
      updated_at: new Date().toISOString()
    };

    await kv.set(`quest_config:${questId}`, updated);

    console.log(`[QUESTS] Updated ${questId}: status=${updated.status}, questions=${updated.question_count}`);

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

    // Also delete the quest image from Storage if it exists
    const existing = await kv.get(`quest_config:${questId}`);
    if (existing?.image_path) {
      await supabaseAdmin.storage.from(QUEST_IMAGE_BUCKET).remove([existing.image_path]);
      console.log(`[QUESTS] Deleted image: ${existing.image_path}`);
    }

    await kv.del(`quest_config:${questId}`);

    return c.json({ success: true, message: `Quest ${questId} deleted` });
  } catch (error) {
    console.error('[QUESTS] Delete error:', error);
    return c.json({ error: `Failed to delete quest: ${error.message}` }, 500);
  }
});

// ===== QUEST IMAGE UPLOAD =====
// Upload quest card image to Supabase Storage (auth required)
// Accepts base64 image data in JSON body
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
    const storagePath = `${crypto.randomUUID()}.${ext}`;

    console.log(`[QUEST-IMAGE] Uploading: ${storagePath} (${contentType}, ${bytes.length} bytes)`);

    const { error: uploadError } = await supabaseAdmin.storage
      .from(QUEST_IMAGE_BUCKET)
      .upload(storagePath, bytes, {
        contentType,
        upsert: true,
      });

    if (uploadError) {
      console.error('[QUEST-IMAGE] Upload error:', uploadError);
      return c.json({ error: `Storage upload failed: ${uploadError.message}` }, 500);
    }

    // Generate a signed URL (1 hour TTL — frontend will refresh as needed)
    const { data: urlData, error: urlError } = await supabaseAdmin.storage
      .from(QUEST_IMAGE_BUCKET)
      .createSignedUrl(storagePath, 3600);

    if (urlError) {
      console.error('[QUEST-IMAGE] Signed URL error:', urlError);
    }

    console.log(`[QUEST-IMAGE] Uploaded successfully: ${storagePath}`);

    return c.json({
      success: true,
      image_path: storagePath,
      signed_url: urlData?.signedUrl || null,
    });
  } catch (error) {
    console.error('[QUEST-IMAGE] Error:', error);
    return c.json({ error: `Image upload failed: ${error.message}` }, 500);
  }
});

// Upload question image to Supabase Storage (auth required)
// Stored under questions/ subfolder in the same bucket
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

    const ext = filename.split('.').pop() || 'png';
    const storagePath = `questions/${crypto.randomUUID()}.${ext}`;

    console.log(`[QUESTION-IMAGE] Uploading: ${storagePath} (${contentType}, ${bytes.length} bytes)`);

    const { error: uploadError } = await supabaseAdmin.storage
      .from(QUEST_IMAGE_BUCKET)
      .upload(storagePath, bytes, { contentType, upsert: true });

    if (uploadError) {
      console.error('[QUESTION-IMAGE] Upload error:', uploadError);
      return c.json({ error: `Storage upload failed: ${uploadError.message}` }, 500);
    }

    const { data: urlData, error: urlError } = await supabaseAdmin.storage
      .from(QUEST_IMAGE_BUCKET)
      .createSignedUrl(storagePath, 3600);

    if (urlError) {
      console.error('[QUESTION-IMAGE] Signed URL error:', urlError);
    }

    console.log(`[QUESTION-IMAGE] Uploaded successfully: ${storagePath}`);

    return c.json({
      success: true,
      image_path: storagePath,
      signed_url: urlData?.signedUrl || null,
    });
  } catch (error) {
    console.error('[QUESTION-IMAGE] Error:', error);
    return c.json({ error: `Image upload failed: ${error.message}` }, 500);
  }
});

// Delete quest image from Storage (auth required)
app.delete("/make-server-221a61bc/quest-image/:path", async (c) => {
  try {
    const userTokenHeader = c.req.header('X-User-Token');
    const { error: authError, user } = await verifyToken(userTokenHeader);
    if (authError || !user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const imagePath = c.req.param('path');
    console.log(`[QUEST-IMAGE] Deleting: ${imagePath}`);

    const { error: deleteError } = await supabaseAdmin.storage
      .from(QUEST_IMAGE_BUCKET)
      .remove([imagePath]);

    if (deleteError) {
      console.error('[QUEST-IMAGE] Delete error:', deleteError);
      return c.json({ error: `Failed to delete image: ${deleteError.message}` }, 500);
    }

    return c.json({ success: true });
  } catch (error) {
    console.error('[QUEST-IMAGE] Delete error:', error);
    return c.json({ error: `Image delete failed: ${error.message}` }, 500);
  }
});

// Get signed URL for a quest image (public — for child flow)
app.get("/make-server-221a61bc/quest-image/:path", async (c) => {
  try {
    const imagePath = c.req.param('path');

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
      kv.getByPrefix('school_by_id:'),
      kv.getByPrefix('lead:'),
      kv.getByPrefix('quest_config:'),
      kv.getByPrefix('gq:'),
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
      kv.getByPrefix('parent:'),
      kv.getByPrefix('school_by_id:'),
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
      const existing = await kv.get(`parent:${userId}`);
      if (!existing) {
        return c.json({ error: `Parent record not found for user ${userId}` }, 404);
      }

      // Whitelist of editable parent fields
      const allowedFields = [
        'name', 'child_name', 'child_age',
        'subscription_plan', 'subscription_status',
        'referral_credits', 'referral_count',
        'origin_tag', 'referred_by',
        'test_count_today', 'watch_count_today',
      ];
      const merged = { ...existing };
      for (const key of allowedFields) {
        if (updates[key] !== undefined) {
          merged[key] = updates[key];
        }
      }
      merged.updated_at = new Date().toISOString();

      await kv.set(`parent:${userId}`, merged);
      console.log(`[ADMIN] Parent ${userId} updated successfully`);

      return c.json({ success: true, user: merged });

    } else if (role === 'kindergarten') {
      // Find the school record for this user
      const allSchools = await kv.getByPrefix('school_by_id:');
      const schoolRecord = allSchools.find((s: any) => s && s.user_id === userId);

      if (!schoolRecord) {
        return c.json({ error: `School record not found for user ${userId}` }, 404);
      }

      // Whitelist of editable kindergarten fields
      const allowedFields = [
        'school_name', 'kindergarten_url', 'subscription_tier',
      ];
      const merged = { ...schoolRecord };
      for (const key of allowedFields) {
        if (updates[key] !== undefined) {
          merged[key] = updates[key];
        }
      }
      merged.updated_at = new Date().toISOString();

      await kv.set(`school_by_id:${schoolRecord.id}`, merged);

      // Also update the school_by_email key if school_name changed
      if (updates.school_name && schoolRecord.email) {
        const emailKey = `school_by_email:${schoolRecord.email}`;
        const emailRecord = await kv.get(emailKey);
        if (emailRecord) {
          await kv.set(emailKey, { ...emailRecord, school_name: updates.school_name, updated_at: merged.updated_at });
        }
      }

      console.log(`[ADMIN] Kindergarten ${userId} (school ${schoolRecord.id}) updated successfully`);
      return c.json({ success: true, school: merged });

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

    // 1. Try to find and delete parent KV data
    const parentData = await kv.get(`parent:${targetUserId}`);
    if (parentData) {
      try { await kv.del(`parent:${targetUserId}`); deletedKeys.push(`parent:${targetUserId}`); } catch (e) {}
      if (parentData.email) {
        try { await kv.del(`parent_by_email:${parentData.email}`); deletedKeys.push(`parent_by_email:${parentData.email}`); } catch (e) {}
      }
      if (parentData.referral_code) {
        try { await kv.del(`referral_code:${parentData.referral_code}`); deletedKeys.push(`referral_code:${parentData.referral_code}`); } catch (e) {}
      }
      // Delete activity logs
      try {
        const activities = await kv.getByPrefix(`parent_activity:${targetUserId}:`);
        for (const act of activities) {
          if (act?.date) {
            await kv.del(`parent_activity:${targetUserId}:${act.date}`);
            deletedKeys.push(`parent_activity:${targetUserId}:${act.date}`);
          }
        }
      } catch (e) {}
      // Delete assessments
      try {
        const assessments = await kv.getByPrefix(`parent_assessment:${targetUserId}:`);
        for (const a of assessments) {
          if (a?.timestamp) {
            await kv.del(`parent_assessment:${targetUserId}:${a.timestamp}`);
            deletedKeys.push(`parent_assessment:${targetUserId}:${a.timestamp}`);
          }
        }
      } catch (e) {}
    }

    // 2. Try to find and delete school KV data
    const allSchools = await kv.getByPrefix('school_by_id:');
    const schoolRecord = allSchools.find((s: any) => s && s.user_id === targetUserId);
    if (schoolRecord) {
      try { await kv.del(`school_by_id:${schoolRecord.id}`); deletedKeys.push(`school_by_id:${schoolRecord.id}`); } catch (e) {}
      if (schoolRecord.email) {
        try { await kv.del(`school_by_email:${schoolRecord.email}`); deletedKeys.push(`school_by_email:${schoolRecord.email}`); } catch (e) {}
      }
      try { await kv.del(`school:${targetUserId}`); deletedKeys.push(`school:${targetUserId}`); } catch (e) {}
    }

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
      const referrerParentId = await kv.get(`referral_code:${referredBy}`);
      if (referrerParentId) {
        const referrerData = await kv.get(`parent:${referrerParentId}`);
        if (referrerData?.origin_tag) {
          resolvedOriginTag = referrerData.origin_tag;
          console.log(`[PARENT] Inherited origin_tag ${resolvedOriginTag} from referrer ${referredBy}`);
        }
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

    await kv.set(`parent:${parentId}`, parentData);
    await kv.set(`parent_by_email:${email}`, parentData);
    await kv.set(`referral_code:${referralCode}`, parentId);

    // Track signup for origin kindergarten
    if (resolvedOriginTag) {
      const kgData = await kv.get(`school_by_id:${resolvedOriginTag}`);
      if (kgData) {
        await kv.set(`school_by_id:${resolvedOriginTag}`, {
          ...kgData,
          free_parent_count: (kgData.free_parent_count || 0) + 1,
          updated_at: new Date().toISOString(),
        });
      }
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
    const parentData = await kv.get(`parent:${authData.user.id}`);
    if (!parentData) {
      return c.json({ error: "No parent account found. Please sign up first." }, 404);
    }

    // Reset daily counters if new day
    const today = new Date().toISOString().split("T")[0];
    if (parentData.last_test_date !== today) {
      parentData.test_count_today = 0;
      parentData.last_test_date = today;
    }
    if (parentData.last_watch_date !== today) {
      parentData.watch_count_today = 0;
      parentData.last_watch_date = today;
    }
    parentData.updated_at = new Date().toISOString();
    await kv.set(`parent:${authData.user.id}`, parentData);

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
    let parentData = await kv.get(`parent:${user.id}`);

    if (parentData) {
      console.log(`[PARENT-OAUTH] Existing parent found: ${parentData.name}`);

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
      if (updated) {
        parentData.updated_at = new Date().toISOString();
        await kv.set(`parent:${user.id}`, parentData);
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
      const referrerParentId = await kv.get(`referral_code:${referredBy}`);
      if (referrerParentId) {
        const referrerData = await kv.get(`parent:${referrerParentId}`);
        if (referrerData?.origin_tag) {
          resolvedOriginTag = referrerData.origin_tag;
          console.log(`[PARENT-OAUTH] Inherited origin_tag ${resolvedOriginTag} from referrer ${referredBy}`);
        }
      } else {
        console.warn(`[PARENT-OAUTH] Referral code ${referredBy} not found in KV — storing anyway`);
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

    await kv.set(`parent:${user.id}`, parentData);
    await kv.set(`parent_by_email:${user.email}`, parentData);
    await kv.set(`referral_code:${referralCode}`, user.id);

    // Track signup for origin kindergarten (same as email signup)
    if (resolvedOriginTag) {
      const kgData = await kv.get(`school_by_id:${resolvedOriginTag}`);
      if (kgData) {
        await kv.set(`school_by_id:${resolvedOriginTag}`, {
          ...kgData,
          free_parent_count: (kgData.free_parent_count || 0) + 1,
          updated_at: new Date().toISOString(),
        });
        console.log(`[PARENT-OAUTH] Incremented free_parent_count for KG ${resolvedOriginTag}`);
      }
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

    const parentData = await kv.get(`parent:${user.id}`);
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

    if (updated) {
      parentData.updated_at = new Date().toISOString();
      await kv.set(`parent:${user.id}`, parentData);
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
    const { phone, child_name, child_age, name, include_mandarin_test, language } = body;

    const parentData = await kv.get(`parent:${user.id}`);
    if (!parentData) return c.json({ error: "Parent not found" }, 404);

    // Update only provided fields
    if (phone !== undefined) parentData.phone = phone;
    if (child_name !== undefined) parentData.child_name = child_name;
    if (child_age !== undefined) parentData.child_age = child_age;
    if (name !== undefined) parentData.name = name;
    if (include_mandarin_test !== undefined) parentData.include_mandarin_test = include_mandarin_test;
    if (language !== undefined) parentData.language = language;
    parentData.updated_at = new Date().toISOString();

    await kv.set(`parent:${user.id}`, parentData);
    // Also update the email-indexed record
    if (parentData.email) {
      await kv.set(`parent_by_email:${parentData.email}`, parentData);
    }

    console.log(`[PARENT] Profile updated for ${user.id}:`, { phone, child_name, child_age, name, include_mandarin_test, language });

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

    const parentData = await kv.get(`parent:${user.id}`);
    if (!parentData) {
      console.warn(`[PARENT-DELETE] No parent record found for ${user.id}, proceeding with auth deletion`);
    }

    const deletedKeys: string[] = [];

    // 1. Delete parent KV record
    try {
      await kv.del(`parent:${user.id}`);
      deletedKeys.push(`parent:${user.id}`);
    } catch (e) { console.warn('[PARENT-DELETE] Error deleting parent record:', e); }

    // 2. Delete email-indexed record
    if (parentData?.email) {
      try {
        await kv.del(`parent_by_email:${parentData.email}`);
        deletedKeys.push(`parent_by_email:${parentData.email}`);
      } catch (e) { console.warn('[PARENT-DELETE] Error deleting email index:', e); }
    }

    // 3. Delete referral code mapping
    if (parentData?.referral_code) {
      try {
        await kv.del(`referral_code:${parentData.referral_code}`);
        deletedKeys.push(`referral_code:${parentData.referral_code}`);
      } catch (e) { console.warn('[PARENT-DELETE] Error deleting referral code:', e); }
    }

    // 4. Delete all activity logs
    try {
      const activities = await kv.getByPrefix(`parent_activity:${user.id}:`);
      for (const act of activities) {
        if (act?.date) {
          await kv.del(`parent_activity:${user.id}:${act.date}`);
          deletedKeys.push(`parent_activity:${user.id}:${act.date}`);
        }
      }
    } catch (e) { console.warn('[PARENT-DELETE] Error deleting activity logs:', e); }

    // 5. Delete all assessment snapshots
    try {
      const assessments = await kv.getByPrefix(`parent_assessment:${user.id}:`);
      for (const a of assessments) {
        if (a?.timestamp) {
          await kv.del(`parent_assessment:${user.id}:${a.timestamp}`);
          deletedKeys.push(`parent_assessment:${user.id}:${a.timestamp}`);
        }
      }
    } catch (e) { console.warn('[PARENT-DELETE] Error deleting assessments:', e); }

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
app.post("/make-server-221a61bc/parent/use", async (c) => {
  try {
    const userTokenHeader = c.req.header("X-User-Token");
    const { error: authError, user } = await verifyToken(userTokenHeader);
    if (authError || !user) return c.json({ error: "Unauthorized" }, 401);

    const { type, questions_answered, questions_correct } = await c.req.json(); // "test", "watch", or "practice"
    if (!["test", "watch", "practice"].includes(type)) {
      return c.json({ error: "type must be 'test', 'watch', or 'practice'" }, 400);
    }

    const parentData = await kv.get(`parent:${user.id}`);
    if (!parentData) return c.json({ error: "Parent not found" }, 404);

    const today = new Date().toISOString().split("T")[0];
    const isPaid = parentData.subscription_status === "active";

    // Initialize lifetime counters if missing
    if (parentData.total_tests === undefined) parentData.total_tests = 0;
    if (parentData.total_watches === undefined) parentData.total_watches = 0;
    if (parentData.total_practices === undefined) parentData.total_practices = 0;
    if (parentData.total_practice_questions === undefined) parentData.total_practice_questions = 0;

    if (type === "test") {
      if (parentData.last_test_date !== today) {
        parentData.test_count_today = 0;
        parentData.last_test_date = today;
      }
      if (!isPaid && parentData.test_count_today >= 1) {
        return c.json({ error: "Daily test limit reached. Upgrade for unlimited!", allowed: false, limit: true }, 403);
      }
      parentData.test_count_today++;
      parentData.total_tests++;
    } else if (type === "watch") {
      if (parentData.last_watch_date !== today) {
        parentData.watch_count_today = 0;
        parentData.last_watch_date = today;
      }
      if (!isPaid && parentData.watch_count_today >= 1) {
        return c.json({ error: "Daily watch limit reached. Upgrade for unlimited!", allowed: false, limit: true }, 403);
      }
      parentData.watch_count_today++;
      parentData.total_watches++;
    } else {
      // practice
      if (parentData.last_practice_date !== today) {
        parentData.practice_count_today = 0;
        parentData.last_practice_date = today;
      }
      if (!isPaid && parentData.practice_count_today >= 1) {
        return c.json({ error: "Daily practice limit reached. Upgrade for unlimited!", allowed: false, limit: true }, 403);
      }
      parentData.practice_count_today++;
      parentData.total_practices++;
      // Track individual practice questions answered
      if (questions_answered && typeof questions_answered === 'number' && questions_answered > 0) {
        parentData.total_practice_questions = (parentData.total_practice_questions || 0) + questions_answered;
      }
    }

    parentData.updated_at = new Date().toISOString();
    await kv.set(`parent:${user.id}`, parentData);
    await kv.set(`parent_by_email:${parentData.email}`, parentData);

    // Log activity for timeline heatmap
    const activityKey = `parent_activity:${user.id}:${today}`;
    const existingActivity = await kv.get(activityKey) || { date: today, tests: 0, watches: 0, practices: 0, questions_total: 0, questions_correct: 0 };
    // Ensure new fields exist on legacy records
    if (existingActivity.questions_total === undefined) existingActivity.questions_total = 0;
    if (existingActivity.questions_correct === undefined) existingActivity.questions_correct = 0;
    if (type === "test") existingActivity.tests++;
    else if (type === "watch") existingActivity.watches++;
    else {
      existingActivity.practices++;
      // Accumulate practice question counts if provided
      if (questions_answered && typeof questions_answered === 'number' && questions_answered > 0) {
        existingActivity.questions_total += questions_answered;
      }
      if (questions_correct && typeof questions_correct === 'number' && questions_correct > 0) {
        existingActivity.questions_correct += questions_correct;
      }
    }
    await kv.set(activityKey, existingActivity);

    const countMap: Record<string, number> = {
      test: parentData.test_count_today,
      watch: parentData.watch_count_today,
      practice: parentData.practice_count_today,
    };

    return c.json({ success: true, allowed: true, count: countMap[type] });
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

    const activities = await kv.getByPrefix(`parent_activity:${user.id}:`);
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

    const parentData = await kv.get(`parent:${user.id}`);
    if (!parentData) return c.json({ error: "Parent not found" }, 404);

    // Fetch referral transactions for this parent
    const allTxns = await kv.getByPrefix("referral_txn:");
    const myTxns = allTxns.filter((t: any) => t.referrer_id === user.id);

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
    const { title, subtitle, youtube_url, dyntube_key, thumbnail_url, category, duration, episode, is_premium, is_featured, order } = body;
    if (!title || (!youtube_url && !dyntube_key)) return c.json({ error: "title and either youtube_url or dyntube_key required" }, 400);
    if (!category) return c.json({ error: "category is required" }, 400);

    const videoId = crypto.randomUUID();
    const videoData = {
      id: videoId,
      title,
      subtitle: subtitle || "",
      youtube_url: youtube_url || "",
      dyntube_key: dyntube_key || "",
      thumbnail_url: thumbnail_url || "",
      category: category || "english",
      duration: duration || "0:00",
      episode: episode || null,
      is_premium: is_premium || false,
      is_featured: is_featured || false,
      order: order || 0,
      status: "active",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await kv.set(`foxy_video:${videoId}`, videoData);
    console.log(`[VIDEOS] Created video: ${videoId} — ${title} [${category}]`);
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
    const existing = await kv.get(`foxy_video:${videoId}`);
    if (!existing) return c.json({ error: "Video not found" }, 404);

    const body = await c.req.json();
    const updated = {
      ...existing,
      ...body,
      id: videoId,
      updated_at: new Date().toISOString(),
    };

    await kv.set(`foxy_video:${videoId}`, updated);
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
    const existing = await kv.get(`foxy_video:${videoId}`);
    if (!existing) return c.json({ error: "Video not found" }, 404);

    const deleted = { ...existing, status: "deleted", updated_at: new Date().toISOString() };
    await kv.set(`foxy_video:${videoId}`, deleted);
    console.log(`[VIDEOS] Deleted video: ${videoId}`);
    return c.json({ success: true });
  } catch (error) {
    console.error("[VIDEOS] Delete error:", error);
    return c.json({ error: `Failed to delete video: ${error.message}` }, 500);
  }
});

// Upload video thumbnail to Supabase Storage (admin only)
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
    const storagePath = `video-thumbnails/${crypto.randomUUID()}.${ext}`;

    console.log(`[VIDEO-THUMB] Uploading: ${storagePath} (${contentType}, ${bytes.length} bytes)`);

    const { error: uploadError } = await supabaseAdmin.storage
      .from(QUEST_IMAGE_BUCKET)
      .upload(storagePath, bytes, { contentType, upsert: true });

    if (uploadError) {
      console.error("[VIDEO-THUMB] Upload error:", uploadError);
      return c.json({ error: `Storage upload failed: ${uploadError.message}` }, 500);
    }

    const { data: urlData, error: urlError } = await supabaseAdmin.storage
      .from(QUEST_IMAGE_BUCKET)
      .createSignedUrl(storagePath, 86400);

    if (urlError) {
      console.error("[VIDEO-THUMB] Signed URL error:", urlError);
    }

    console.log(`[VIDEO-THUMB] Uploaded successfully: ${storagePath}`);

    return c.json({
      success: true,
      image_path: storagePath,
      signed_url: urlData?.signedUrl || null,
    });
  } catch (error) {
    console.error("[VIDEO-THUMB] Error:", error);
    return c.json({ error: `Thumbnail upload failed: ${error.message}` }, 500);
  }
});

// Helper: resolve video thumbnail storage paths to signed URLs
async function resolveVideoThumbnails(videos: any[]) {
  return Promise.all(videos.map(async (v: any) => {
    if (v.thumbnail_url && v.thumbnail_url.startsWith('video-thumbnails/')) {
      try {
        const { data } = await supabaseAdmin.storage
          .from(QUEST_IMAGE_BUCKET)
          .createSignedUrl(v.thumbnail_url, 86400);
        return { ...v, thumbnail_url: data?.signedUrl || v.thumbnail_url };
      } catch {
        return v;
      }
    }
    return v;
  }));
}

// Get all videos (public for Video Mode)
app.get("/make-server-221a61bc/videos", async (c) => {
  try {
    const videos = await kv.getByPrefix("foxy_video:");
    const active = videos
      .filter((v: any) => v.status === "active")
      .sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
    const resolved = await resolveVideoThumbnails(active);
    return c.json({ success: true, videos: resolved });
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

    const videos = await kv.getByPrefix("foxy_video:");
    const sorted = videos
      .filter((v: any) => v.status !== "deleted")
      .sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
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
    const allParents = await kv.getByPrefix("parent:");
    const kgParents = allParents.filter((p: any) =>
      p && typeof p === "object" && p.origin_tag === school.id
    );

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

    const snapshot = {
      date: dateStr,
      timestamp,
      childAge: childAge || 5,
      overallPct: overallPct || 0,
      totalStars: totalStars || 0,
      maxStars: maxStars || 0,
      tpLevel: tpLevel || 1,
      readinessPct: readinessPct || 0,
      totalQuestions: totalQuestions || 0,
      totalCorrect: totalCorrect || 0,
      subjectSummary: subjectSummary || [], // [{ name, pct, functionalAge }]
    };

    const key = `parent_assessment:${user.id}:${timestamp}`;
    await kv.set(key, snapshot);

    // Also accumulate question counts into the daily activity record
    try {
      const activityKey = `parent_activity:${user.id}:${dateStr}`;
      const existingActivity = await kv.get(activityKey) || { date: dateStr, tests: 0, watches: 0, practices: 0, questions_total: 0, questions_correct: 0 };
      existingActivity.questions_total = (existingActivity.questions_total || 0) + (totalQuestions || 0);
      existingActivity.questions_correct = (existingActivity.questions_correct || 0) + (totalCorrect || 0);
      await kv.set(activityKey, existingActivity);
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

    const assessments = await kv.getByPrefix(`parent_assessment:${user.id}:`);
    // Sort by timestamp ascending (oldest first)
    assessments.sort((a: any, b: any) => (a.timestamp || '').localeCompare(b.timestamp || ''));

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
    const artworks = await kv.getByPrefix("mkt_artwork:");
    const active = artworks
      .filter((a: any) => a && a.status !== "deleted")
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
    const existingArtworks = await kv.getByPrefix("mkt_artwork:");
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
      await kv.set(`mkt_artwork:${existingArt.id}`, existingArt);
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

    await kv.set(`mkt_artwork:${artworkId}`, artworkData);
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
    const existing = await kv.get(`mkt_artwork:${artworkId}`);
    if (!existing) return c.json({ error: "Artwork not found" }, 404);

    for (const variant of (existing.variants || [])) {
      if (variant.image_path && !variant.image_path.startsWith('http')) {
        try {
          await supabaseAdmin.storage.from(QUEST_IMAGE_BUCKET).remove([variant.image_path]);
        } catch {}
      }
    }

    existing.status = "deleted";
    existing.updated_at = new Date().toISOString();
    await kv.set(`mkt_artwork:${artworkId}`, existing);

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
    const existing = await kv.get(`mkt_artwork:${artworkId}`);
    if (!existing) return c.json({ error: "Artwork not found" }, 404);

    const variantToRemove = (existing.variants || []).find((v: any) => v.platform === platform);
    if (variantToRemove?.image_path && !variantToRemove.image_path.startsWith('http')) {
      try {
        await supabaseAdmin.storage.from(QUEST_IMAGE_BUCKET).remove([variantToRemove.image_path]);
      } catch {}
    }

    existing.variants = (existing.variants || []).filter((v: any) => v.platform !== platform);
    existing.updated_at = new Date().toISOString();
    await kv.set(`mkt_artwork:${artworkId}`, existing);

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
// KV key patterns:
//   report:{reportId}         — full report data
//   report_by_lead:{leadId}   — maps lead → reportId (dedup)

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
    const existingReportId = await kv.get(`report_by_lead:${leadId}`);
    if (existingReportId) {
      const existingReport = await kv.get(`report:${existingReportId}`);
      if (existingReport) {
        console.log(`[REPORT] Existing report found for lead ${leadId}: ${existingReportId}`);
        return c.json({
          success: true,
          reportId: existingReportId,
          isExisting: true,
          report: existingReport,
        });
      }
    }

    // Fetch the lead data
    const leadData = await kv.get(`lead:${leadId}`);
    if (!leadData) {
      return c.json({ error: `Lead not found: ${leadId}` }, 404);
    }

    if (leadData.status !== 'completed') {
      return c.json({ error: 'Cannot create report for incomplete assessment' }, 400);
    }

    // Fetch school data for branding
    const schoolData = leadData.school_id ? await kv.get(`school_by_id:${leadData.school_id}`) : null;

    // Fetch quest configs for name/icon mapping
    const allQuests = await kv.getByPrefix('quest_config:');
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

    const reportData = {
      id: reportId,
      leadId: leadData.id,
      childName: leadData.child_name,
      childAge: leadData.child_age || 5,
      parentName: leadData.parent_name,
      parentPhone: leadData.whatsapp,
      schoolId: leadData.school_id,
      schoolName: schoolData?.school_name || 'Kindergarten',
      schoolLogoUrl: schoolData?.logo_url || '',
      schoolShortCode: schoolData?.short_code || '',
      schoolEmail: schoolData?.email || '',
      schoolPhone: schoolData?.phone || '',
      schoolWhatsApp: schoolData?.whatsapp_no || '',
      schoolAddress: schoolData?.address || '',
      answers: leadData.answers || [],
      moduleResults: leadData.quest_results || [],
      score: leadData.score || 0,
      totalQuestions: leadData.total_questions || 0,
      questInfo,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      claimedBy: null,
      viewCount: 0,
      firstViewedAt: null,
      lastViewedAt: null,
    };

    await kv.set(`report:${reportId}`, reportData);
    await kv.set(`report_by_lead:${leadId}`, reportId);

    console.log(`[REPORT] Created report ${reportId} for lead ${leadId}, expires ${expiresAt.toISOString()}`);

    return c.json({
      success: true,
      reportId,
      isExisting: false,
      report: reportData,
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
    const reportId = await kv.get(`report_by_lead:${leadId}`);

    if (!reportId) {
      return c.json({ success: true, hasReport: false });
    }

    const reportData = await kv.get(`report:${reportId}`);
    if (!reportData) {
      return c.json({ success: true, hasReport: false });
    }

    return c.json({
      success: true,
      hasReport: true,
      reportId: reportData.id,
      viewCount: reportData.viewCount || 0,
      firstViewedAt: reportData.firstViewedAt,
      lastViewedAt: reportData.lastViewedAt,
      isClaimed: !!reportData.claimedBy,
      claimedAt: reportData.claimedAt || null,
      expiresAt: reportData.expiresAt,
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

    const reportData = await kv.get(`report:${reportId}`);
    if (!reportData) {
      return c.json({ error: 'Report not found' }, 404);
    }

    // Check expiry (only for unclaimed reports)
    const now = new Date();
    const expiresAt = new Date(reportData.expiresAt);
    const isExpired = !reportData.claimedBy && now > expiresAt;
    const daysRemaining = reportData.claimedBy
      ? null
      : Math.max(0, Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

    // Increment view count (fire-and-forget)
    const updatedReport = {
      ...reportData,
      viewCount: (reportData.viewCount || 0) + 1,
      firstViewedAt: reportData.firstViewedAt || now.toISOString(),
      lastViewedAt: now.toISOString(),
    };
    kv.set(`report:${reportId}`, updatedReport).catch((err: any) =>
      console.error(`[REPORT] Failed to update view count for ${reportId}:`, err)
    );

    if (isExpired) {
      // Return expired status with minimal info (enough for the expired page)
      return c.json({
        success: true,
        expired: true,
        report: {
          id: reportData.id,
          childName: reportData.childName,
          schoolName: reportData.schoolName,
          schoolShortCode: reportData.schoolShortCode,
          expiresAt: reportData.expiresAt,
          createdAt: reportData.createdAt,
        },
      });
    }

    return c.json({
      success: true,
      expired: false,
      daysRemaining,
      isClaimed: !!reportData.claimedBy,
      report: reportData,
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

    const reportData = await kv.get(`report:${reportId}`);
    if (!reportData) {
      return c.json({ error: 'Report not found' }, 404);
    }

    if (reportData.claimedBy && reportData.claimedBy !== user.id) {
      return c.json({ error: 'Report already claimed by another user' }, 409);
    }

    // Claim the report
    const updatedReport = {
      ...reportData,
      claimedBy: user.id,
      claimedAt: new Date().toISOString(),
    };
    await kv.set(`report:${reportId}`, updatedReport);

    // Also link to parent profile
    const parentData = await kv.get(`parent:${user.id}`);
    if (parentData) {
      const reports = parentData.claimed_reports || [];
      if (!reports.includes(reportId)) {
        reports.push(reportId);
        await kv.set(`parent:${user.id}`, {
          ...parentData,
          claimed_reports: reports,
          child_name: parentData.child_name || reportData.childName,
          child_age: parentData.child_age || reportData.childAge,
          updated_at: new Date().toISOString(),
        });
      }
    }

    console.log(`[REPORT] Report ${reportId} claimed by parent ${user.id}`);

    return c.json({ success: true, report: updatedReport });
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
    const allLeads = await kv.getByPrefix(`school_lead:${schoolId}:`);
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
        const parentData = await kv.get(`parent:${ref.parentId}`);
        if (parentData?.name) parentName = parentData.name;
      } catch (_) {}

      // Also check report statuses for conversion
      const referredLeads = allLeads.filter((l: any) => l.referred_by_parent_id === ref.parentId);
      let signedUp = 0;
      for (const rl of referredLeads) {
        try {
          const reportId = await kv.get(`report_by_lead:${rl.id}`);
          if (reportId) {
            const report = await kv.get(`report:${reportId}`);
            if (report?.is_claimed) signedUp++;
          }
        } catch (_) {}
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

    const parentData = await kv.get(`parent:${user.id}`);
    if (!parentData) return c.json({ error: "Parent not found" }, 404);

    // 1. Who referred me
    let referredByInfo = null;
    if (parentData.referred_by) {
      try {
        const referrerParentId = await kv.get(`referral_code:${parentData.referred_by}`);
        if (referrerParentId) {
          const referrerData = await kv.get(`parent:${referrerParentId}`);
          if (referrerData) {
            // Find which KG the referrer is from
            let kgName = null;
            if (referrerData.origin_tag) {
              const kgData = await kv.get(`school_by_id:${referrerData.origin_tag}`);
              if (kgData) kgName = kgData.school_name || kgData.name;
            }
            referredByInfo = {
              name: referrerData.name || 'A fellow parent',
              kindergarten: kgName,
            };
          }
        }
      } catch (_) {}
    }

    // 2. People I've referred (from referrals_by_parent list)
    const myReferrals: any[] = [];
    try {
      const referredLeadIds = await kv.get(`referrals_by_parent:${user.id}`) || [];
      for (const leadId of referredLeadIds) {
        try {
          const lead = await kv.get(`lead:${leadId}`);
          if (!lead) continue;
          // Determine status
          let status = 'test_started';
          if (lead.status === 'completed') status = 'test_completed';
          // Check if report exists and was viewed/claimed
          try {
            const reportId = await kv.get(`report_by_lead:${leadId}`);
            if (reportId) {
              const report = await kv.get(`report:${reportId}`);
              if (report?.is_claimed) status = 'signed_up';
              else if (report?.view_count > 0) status = 'report_viewed';
              else status = 'report_sent';
            }
          } catch (_) {}

          myReferrals.push({
            leadId,
            childName: lead.child_name,
            parentName: lead.parent_name,
            status,
            date: lead.created_at,
          });
        } catch (_) {}
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

Deno.serve(app.fetch);