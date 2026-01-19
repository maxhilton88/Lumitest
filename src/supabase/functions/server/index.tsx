import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import * as kv from "./kv_store.tsx";

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
  return c.json({ status: "ok" });
});

// ===== LEAD MANAGEMENT =====

// Submit a new lead (from parent test completion)
app.post("/make-server-221a61bc/leads", async (c) => {
  try {
    const body = await c.req.json();
    const { schoolId, childName, parentName, whatsapp, score, answers } = body;

    if (!schoolId || !childName || !parentName || !whatsapp) {
      return c.json({ error: "Missing required fields" }, 400);
    }

    const leadId = `lead_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const leadData = {
      id: leadId,
      schoolId,
      childName,
      parentName,
      whatsapp,
      score,
      answers,
      date: new Date().toISOString(),
      createdAt: Date.now()
    };

    await kv.set(`lead:${leadId}`, leadData);
    
    // Also add to school's leads list
    const schoolLeadsKey = `school:${schoolId}:leads`;
    const existingLeads = await kv.get(schoolLeadsKey) || [];
    existingLeads.push(leadId);
    await kv.set(schoolLeadsKey, existingLeads);

    console.log(`Lead created: ${leadId} for school: ${schoolId}`);
    return c.json({ success: true, leadId, lead: leadData });
  } catch (error) {
    console.error("Error creating lead:", error);
    return c.json({ error: "Failed to create lead", details: error.message }, 500);
  }
});

// Get all leads for a specific school
app.get("/make-server-221a61bc/schools/:schoolId/leads", async (c) => {
  try {
    const schoolId = c.req.param("schoolId");
    const schoolLeadsKey = `school:${schoolId}:leads`;
    
    const leadIds = await kv.get(schoolLeadsKey) || [];
    const leads = [];

    for (const leadId of leadIds) {
      const lead = await kv.get(`lead:${leadId}`);
      if (lead) {
        leads.push(lead);
      }
    }

    // Sort by date descending
    leads.sort((a, b) => b.createdAt - a.createdAt);

    return c.json({ success: true, leads });
  } catch (error) {
    console.error("Error fetching leads:", error);
    return c.json({ error: "Failed to fetch leads", details: error.message }, 500);
  }
});

// ===== SCHOOL MANAGEMENT =====

// Create/register a new school
app.post("/make-server-221a61bc/schools", async (c) => {
  try {
    const body = await c.req.json();
    const { name, email, logo, thankYouMessage } = body;

    if (!name || !email) {
      return c.json({ error: "School name and email are required" }, 400);
    }

    const schoolId = `school_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const schoolData = {
      id: schoolId,
      name,
      email,
      logo: logo || '',
      thankYouMessage: thankYouMessage || '',
      subscriptionStatus: 'trial',
      subscriptionStartDate: new Date().toISOString(),
      subscriptionExpiryDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 day trial
      createdAt: Date.now()
    };

    await kv.set(`school:${schoolId}`, schoolData);
    
    // Add to schools list
    const allSchools = await kv.get('schools:all') || [];
    allSchools.push(schoolId);
    await kv.set('schools:all', allSchools);

    console.log(`School created: ${schoolId}`);
    return c.json({ success: true, schoolId, school: schoolData });
  } catch (error) {
    console.error("Error creating school:", error);
    return c.json({ error: "Failed to create school", details: error.message }, 500);
  }
});

// Get school details
app.get("/make-server-221a61bc/schools/:schoolId", async (c) => {
  try {
    const schoolId = c.req.param("schoolId");
    const school = await kv.get(`school:${schoolId}`);

    if (!school) {
      return c.json({ error: "School not found" }, 404);
    }

    return c.json({ success: true, school });
  } catch (error) {
    console.error("Error fetching school:", error);
    return c.json({ error: "Failed to fetch school", details: error.message }, 500);
  }
});

// Update school settings
app.put("/make-server-221a61bc/schools/:schoolId", async (c) => {
  try {
    const schoolId = c.req.param("schoolId");
    const body = await c.req.json();
    
    const school = await kv.get(`school:${schoolId}`);
    if (!school) {
      return c.json({ error: "School not found" }, 404);
    }

    const updatedSchool = {
      ...school,
      ...body,
      updatedAt: Date.now()
    };

    await kv.set(`school:${schoolId}`, updatedSchool);

    console.log(`School updated: ${schoolId}`);
    return c.json({ success: true, school: updatedSchool });
  } catch (error) {
    console.error("Error updating school:", error);
    return c.json({ error: "Failed to update school", details: error.message }, 500);
  }
});

// Get all schools (Super Admin)
app.get("/make-server-221a61bc/schools", async (c) => {
  try {
    const allSchoolIds = await kv.get('schools:all') || [];
    const schools = [];

    for (const schoolId of allSchoolIds) {
      const school = await kv.get(`school:${schoolId}`);
      if (school) {
        // Get lead count for this school
        const schoolLeadsKey = `school:${schoolId}:leads`;
        const leadIds = await kv.get(schoolLeadsKey) || [];
        school.leadsGenerated = leadIds.length;
        schools.push(school);
      }
    }

    // Sort by creation date descending
    schools.sort((a, b) => b.createdAt - a.createdAt);

    return c.json({ success: true, schools });
  } catch (error) {
    console.error("Error fetching schools:", error);
    return c.json({ error: "Failed to fetch schools", details: error.message }, 500);
  }
});

// ===== ANALYTICS =====

// Get global statistics (Super Admin)
app.get("/make-server-221a61bc/stats/global", async (c) => {
  try {
    const allSchoolIds = await kv.get('schools:all') || [];
    let totalLeads = 0;
    let totalRevenue = 0;

    for (const schoolId of allSchoolIds) {
      const school = await kv.get(`school:${schoolId}`);
      const schoolLeadsKey = `school:${schoolId}:leads`;
      const leadIds = await kv.get(schoolLeadsKey) || [];
      
      totalLeads += leadIds.length;
      
      // Calculate revenue (RM356 per active subscription)
      if (school && school.subscriptionStatus === 'active') {
        totalRevenue += 356;
      }
    }

    return c.json({
      success: true,
      stats: {
        totalSchools: allSchoolIds.length,
        totalLeads,
        totalRevenue,
        activeSchools: allSchoolIds.filter(async (id) => {
          const school = await kv.get(`school:${id}`);
          return school && school.subscriptionStatus === 'active';
        }).length
      }
    });
  } catch (error) {
    console.error("Error fetching global stats:", error);
    return c.json({ error: "Failed to fetch stats", details: error.message }, 500);
  }
});

Deno.serve(app.fetch);