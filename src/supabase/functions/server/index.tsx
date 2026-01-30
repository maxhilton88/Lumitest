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

    // Create school record in database
    const { data: schoolData, error: schoolError } = await supabaseAdmin
      .from('schools')
      .insert({
        user_id: authData.user.id,
        school_name: schoolName,
        email,
        kindergarten_url: kindergartenUrl,
      })
      .select()
      .single();

    if (schoolError) {
      console.error('School creation error:', schoolError);
      // Rollback: delete the user if school creation fails
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return c.json({ error: `Failed to create school: ${schoolError.message}` }, 500);
    }

    console.log(`School created successfully: ${schoolData.id}`);

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
      Deno.env.get('CUSTOM_ANON_KEY')!
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

    // Get school for this user
    const { data: schoolData, error: schoolError } = await supabaseAdmin
      .from('schools')
      .select('*')
      .eq('user_id', authData.user.id)
      .maybeSingle();

    if (schoolError) {
      console.error('School fetch error:', schoolError);
      return c.json({ error: `Error fetching school: ${schoolError.message}` }, 500);
    }

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
      const { data, error } = await supabaseAdmin
        .from('questions')
        .upsert({
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
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'id'
        })
        .select()
        .single();

      if (error) {
        console.error('Error saving question:', error);
        return c.json({ error: `Failed to save question: ${error.message}` }, 500);
      }

      savedQuestions.push(data);
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

    const { data: questions, error } = await supabaseAdmin
      .from('questions')
      .select('*')
      .eq('school_id', school.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching questions:', error);
      return c.json({ error: `Failed to fetch questions: ${error.message}` }, 500);
    }

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

    const questionId = c.req.param('id');

    console.log(`Deleting question ${questionId}`);

    const { error } = await supabaseAdmin
      .from('questions')
      .delete()
      .eq('id', questionId);

    if (error) {
      console.error('Error deleting question:', error);
      return c.json({ error: `Failed to delete question: ${error.message}` }, 500);
    }

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

    // Insert lead into database
    const { data: leadData, error: leadError } = await supabaseAdmin
      .from('leads')
      .insert({
        school_id: schoolId,
        child_name: childName,
        parent_name: parentName,
        whatsapp,
        child_age: childAge || 5,
        include_mandarin_test: includeMandarin || false,
      })
      .select()
      .single();

    if (leadError) {
      console.error('Lead creation error:', leadError);
      return c.json({ error: `Failed to submit lead: ${leadError.message}` }, 500);
    }

    console.log(`Lead created successfully: ${leadData.id}`);

    return c.json({
      success: true,
      leadId: leadData.id,
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

    const { data: leads, error } = await supabaseAdmin
      .from('leads')
      .select('*')
      .eq('school_id', school.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching leads:', error);
      return c.json({ error: `Failed to fetch leads: ${error.message}` }, 500);
    }

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

    const leadId = c.req.param('id');

    console.log(`Deleting lead ${leadId}`);

    const { error } = await supabaseAdmin
      .from('leads')
      .delete()
      .eq('id', leadId);

    if (error) {
      console.error('Error deleting lead:', error);
      return c.json({ error: `Failed to delete lead: ${error.message}` }, 500);
    }

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