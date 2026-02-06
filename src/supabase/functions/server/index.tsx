import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import * as kv from "./kv_store.tsx";
import { supabaseAdmin, verifyToken, getSchoolForUser } from "./auth.tsx";
import { createClient } from "npm:@supabase/supabase-js@2";

const app = new Hono();

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// Health check endpoint
app.get("/make-server-221a61bc/health", (c) => {
  return c.json({ status: "ok", version: "1.0" });
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

    // Create school record in KV store
    const schoolId = crypto.randomUUID();
    const schoolData = {
      id: schoolId,
      user_id: authData.user.id,
      school_name: schoolName,
      email,
      kindergarten_url: kindergartenUrl,
      subscription_tier: 'trial',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    try {
      await kv.set(`school:${authData.user.id}`, schoolData);
      await kv.set(`school_by_id:${schoolId}`, schoolData);
      await kv.set(`school_by_url:${kindergartenUrl}`, schoolData);
      console.log(`School created successfully: ${schoolId}`);
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

    // Create a regular Supabase client for authentication
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

    // Get school for this user from KV store
    const schoolData = await kv.get(`school:${authData.user.id}`);

    if (!schoolData) {
      console.error('No school found for user:', authData.user.id);
      return c.json({ error: 'No school associated with this account' }, 404);
    }

    console.log(`Login successful for school: ${schoolData.school_name}`);

    return c.json({
      success: true,
      user: {
        id: authData.user.id,
        email: authData.user.email,
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

// ===== QUESTION BANK MANAGEMENT =====

// Save/Update question
app.post("/make-server-221a61bc/questions", async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    const { error: authError, user } = await verifyToken(authHeader);
    
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
    const authHeader = c.req.header('Authorization');
    const { error: authError, user } = await verifyToken(authHeader);
    
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
    const authHeader = c.req.header('Authorization');
    const { error: authError, user } = await verifyToken(authHeader);
    
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

// Submit a new lead (public endpoint - no auth required)
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
      totalQuestions 
    } = body;

    if (!schoolId || !childName || !parentName || !whatsapp) {
      return c.json({ error: "Missing required fields: schoolId, childName, parentName, whatsapp" }, 400);
    }

    console.log(`Submitting lead for school ${schoolId}: ${childName}`);

    // Create lead in KV store
    const leadId = crypto.randomUUID();
    const leadData = {
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
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    await kv.set(`lead:${leadId}`, leadData);
    await kv.set(`school_lead:${schoolId}:${leadId}`, leadData);

    console.log(`Lead created successfully: ${leadId}`);

    return c.json({
      success: true,
      leadId: leadId,
      message: "Lead submitted successfully!"
    });
  } catch (error) {
    console.error("Submit lead error:", error);
    return c.json({ error: `Failed to submit lead: ${error.message}` }, 500);
  }
});

// Get leads for kindergarten (protected)
app.get("/make-server-221a61bc/leads", async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    console.log('Get leads - Auth header:', authHeader ? 'Present' : 'Missing');
    
    const { error: authError, user } = await verifyToken(authHeader);
    
    if (authError || !user) {
      console.error('Auth verification failed:', authError);
      return c.json({ error: authError || 'Unauthorized' }, 401);
    }

    console.log('User authenticated:', user.id);

    // Get school for this user
    const { error: schoolError, school } = await getSchoolForUser(user.id);
    
    if (schoolError || !school) {
      console.error('School fetch failed:', schoolError);
      return c.json({ error: schoolError || 'No school found for user' }, 404);
    }

    console.log(`Fetching leads for school ${school.id} (${school.school_name})`);

    // Get all leads for this school
    const leads = await kv.getByPrefix(`school_lead:${school.id}:`);

    // Sort by created_at descending
    leads.sort((a, b) => {
      const dateA = new Date(a.created_at || 0);
      const dateB = new Date(b.created_at || 0);
      return dateB.getTime() - dateA.getTime();
    });

    console.log(`Returning ${leads.length} leads`);

    return c.json({
      success: true,
      leads: leads || []
    });
  } catch (error) {
    console.error('Get leads error:', error);
    return c.json({ error: `Failed to get leads: ${error.message}` }, 500);
  }
});

// Delete lead (for kindergarten admin)
app.delete("/make-server-221a61bc/leads/:id", async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    const { error: authError, user } = await verifyToken(authHeader);
    
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

Deno.serve(app.fetch);