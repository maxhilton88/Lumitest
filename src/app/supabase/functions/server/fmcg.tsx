/**
 * fmcg.tsx — FMCG QR Collaboration System (Prompt 2)
 *
 * Modular Hono sub-app for:
 *   Part A — QR scan & reward claim flow
 *   Part B — SuperAdmin campaign CRUD + QR batch generation
 *   Part C — FMCG partner portal (read-only analytics)
 *
 * MIGRATED: All KV calls → Postgres tables:
 *   fmcg_campaigns, fmcg_qr_codes, fmcg_claims, fmcg_partners, shop_items,
 *   realm_stats, parents
 *
 * Mounted at /make-server-221a61bc/fmcg/* from index.tsx
 */

import { Hono } from "npm:hono";
import { supabaseAdmin } from "./auth.tsx";
import { verifyToken } from "./auth.tsx";
import { uploadToR2 } from "./r2.tsx";

const fmcg = new Hono();

// ═══════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════

/** Generate a cryptographically secure alphanumeric code (10 chars) */
function generateSecureCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const bytes = new Uint8Array(10);
  crypto.getRandomValues(bytes);
  let code = "";
  for (let i = 0; i < 10; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
}

/** Check if user is superadmin via token */
async function requireSuperAdmin(c: any): Promise<{ user: any } | Response> {
  const token = c.req.header("X-User-Token");
  const { error, user } = await verifyToken(token);
  if (error || !user) {
    return c.json({ error: `Unauthorized: ${error || "No user"}` }, 401);
  }
  const SUPER_ADMIN_EMAILS = new Set(["hey@pitchdeck.my"]);
  const isSuperAdmin =
    SUPER_ADMIN_EMAILS.has(user.email) ||
    user.user_metadata?.role === "superadmin";
  if (!isSuperAdmin) {
    return c.json({ error: "Forbidden: superadmin role required" }, 403);
  }
  return { user };
}

/** Check if user is an FMCG partner for a given campaign */
async function requirePartner(
  c: any
): Promise<{ user: any; partner: any } | Response> {
  const token = c.req.header("X-User-Token");
  const { error, user } = await verifyToken(token);
  if (error || !user) {
    return c.json({ error: `Unauthorized: ${error || "No user"}` }, 401);
  }
  const { data: partner } = await supabaseAdmin.from('fmcg_partners').select('*').eq('email', user.email).limit(1).single();
  if (!partner) {
    return c.json(
      { error: "Forbidden: no FMCG partner access for this account" },
      403
    );
  }
  return { user, partner };
}

// Campaign status derived from dates
function deriveCampaignStatus(
  campaign: any
): "draft" | "upcoming" | "active" | "expired" {
  if (campaign.status === "draft") return "draft";
  const now = Date.now();
  const start = new Date(campaign.start_date || campaign.startDate).getTime();
  const end = new Date(campaign.expiry_date || campaign.expiryDate).getTime();
  if (now < start) return "upcoming";
  if (now > end) return "expired";
  return "active";
}

// ═══════════════════════════════════════════════════════════════════════
// LOGO UPLOAD TO R2
// ═══════════════════════════════════════════════════════════════════════

fmcg.post("/upload-logo", async (c) => {
  try {
    const auth = await requireSuperAdmin(c);
    if (auth instanceof Response) return auth;

    const formData = await c.req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return c.json({ error: "No file provided" }, 400);

    const allowed = ["image/png", "image/jpeg", "image/jpg", "image/svg+xml", "image/webp"];
    if (!allowed.includes(file.type)) {
      return c.json({ error: `Invalid file type: ${file.type}. Allowed: PNG, JPG, SVG, WebP` }, 400);
    }

    if (file.size > 5 * 1024 * 1024) {
      return c.json({ error: "File too large. Max 5MB." }, 400);
    }

    const ext = file.name.split(".").pop() || "png";
    const key = `fmcg-logos/${crypto.randomUUID()}.${ext}`;
    const arrayBuf = await file.arrayBuffer();
    const body = new Uint8Array(arrayBuf);

    const result = await uploadToR2(key, body, file.type);
    console.log(`[FMCG] Logo uploaded: ${key} (${file.size} bytes)`);

    return c.json({ success: true, publicUrl: result.publicUrl, key: result.key });
  } catch (error: any) {
    console.error("[FMCG] Logo upload error:", error);
    return c.json({ error: `Failed to upload logo: ${error.message}` }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════════
// PART B — SUPERADMIN CAMPAIGN CRUD
// ═══════════════════════════════════════════════════════════════════════

// GET /campaigns — list all FMCG campaigns
fmcg.get("/campaigns", async (c) => {
  try {
    const auth = await requireSuperAdmin(c);
    if (auth instanceof Response) return auth;

    const { data: campaigns, error } = await supabaseAdmin
      .from('fmcg_campaigns')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const enriched = (campaigns || []).map((camp: any) => ({
      ...camp,
      // Normalize field names for frontend compat
      brandName: camp.brand_name,
      brandLogoUrl: camp.brand_logo_url,
      brandColour: camp.brand_colour,
      batchSize: camp.batch_size,
      startDate: camp.start_date,
      expiryDate: camp.expiry_date,
      rewardConfig: camp.reward_config,
      customItemId: camp.custom_item_id,
      partnerEmail: camp.partner_email,
      csvUrl: camp.csv_url,
      csvR2Key: camp.csv_r2_key,
      generatedTotal: camp.generated_total,
      kvTracked: camp.kv_tracked,
      liveStatus: deriveCampaignStatus(camp),
      totalCodes: camp.generated_total || 0,
      claimedCount: camp.claimed_count || 0,
    }));

    return c.json({ success: true, campaigns: enriched });
  } catch (error: any) {
    console.error("[FMCG] List campaigns error:", error);
    return c.json({ error: `Failed to list campaigns: ${error.message}` }, 500);
  }
});

// GET /campaigns/:id — single campaign detail
fmcg.get("/campaigns/:id", async (c) => {
  try {
    const auth = await requireSuperAdmin(c);
    if (auth instanceof Response) return auth;

    const id = c.req.param("id");
    const { data: campaign } = await supabaseAdmin.from('fmcg_campaigns').select('*').eq('id', id).limit(1).single();
    if (!campaign) return c.json({ error: "Campaign not found" }, 404);

    const { count } = await supabaseAdmin.from('fmcg_qr_codes').select('*', { count: 'exact', head: true }).eq('campaign_id', id);

    return c.json({
      success: true,
      campaign: {
        ...campaign,
        brandName: campaign.brand_name,
        brandLogoUrl: campaign.brand_logo_url,
        brandColour: campaign.brand_colour,
        startDate: campaign.start_date,
        expiryDate: campaign.expiry_date,
        rewardConfig: campaign.reward_config,
        liveStatus: deriveCampaignStatus(campaign),
        totalCodes: count || 0,
      },
    });
  } catch (error: any) {
    console.error("[FMCG] Get campaign error:", error);
    return c.json({ error: `Failed to get campaign: ${error.message}` }, 500);
  }
});

// POST /campaigns — create new campaign
fmcg.post("/campaigns", async (c) => {
  try {
    const auth = await requireSuperAdmin(c);
    if (auth instanceof Response) return auth;

    const body = await c.req.json();
    const {
      name,
      brandName,
      brandLogoUrl,
      brandColour,
      batchSize,
      startDate,
      expiryDate,
      rewardConfig,
      customItem,
      partnerEmail,
    } = body;

    if (!name || name.length > 60) return c.json({ error: "Campaign name is required (max 60 chars)" }, 400);
    if (!brandName) return c.json({ error: "Brand name is required" }, 400);
    if (!batchSize || batchSize < 1 || batchSize > 500000) return c.json({ error: "Batch size must be between 1 and 500,000" }, 400);
    if (!startDate || !expiryDate) return c.json({ error: "Start date and expiry date are required" }, 400);
    if (new Date(expiryDate) <= new Date(startDate)) return c.json({ error: "Expiry date must be after start date" }, 400);
    if (!rewardConfig || !Array.isArray(rewardConfig) || rewardConfig.length === 0) return c.json({ error: "At least one reward is required in rewardConfig" }, 400);

    const campaignId = crypto.randomUUID();
    const now = new Date().toISOString();

    // If custom item is provided, save it to shop_items
    let customItemId: string | null = null;
    if (customItem) {
      customItemId = `fmcg_item_${campaignId.slice(0, 8)}`;
      await supabaseAdmin.from('shop_items').insert({
        id: customItemId,
        name: customItem.name,
        description: customItem.flavourText || "",
        image_slug: "",
        price: 0,
        currency: "gold",
        rarity: "fmcg_exclusive",
        category: "treasure",
        equip_slot: customItem.equipSlot || null,
        effects: customItem.statType
          ? [{ type: customItem.statType.toLowerCase(), value: customItem.statValue || 10, isPercent: customItem.statType === "xp_percent" }]
          : [],
        fmcg_exclusive: true,
        campaign_id: campaignId,
        emoji: customItem.emoji || "🎁",
        sort_order: 9999,
        is_active: true,
      });
      console.log(`[FMCG] Created custom item: ${customItemId} (${customItem.name})`);
    }

    const processedRewards = rewardConfig.map((r: any) => ({
      type: r.type,
      amount: r.amount || undefined,
      itemId: r.type === "customItem" ? customItemId : r.itemId || undefined,
      quantity: r.quantity || undefined,
      label: r.label || undefined,
    }));

    const { error } = await supabaseAdmin.from('fmcg_campaigns').insert({
      id: campaignId,
      name,
      brand_name: brandName,
      brand_logo_url: brandLogoUrl || "",
      brand_colour: brandColour || "#7cc643",
      batch_size: batchSize,
      start_date: startDate,
      expiry_date: expiryDate,
      status: "draft",
      reward_config: processedRewards,
      custom_item_id: customItemId,
      partner_email: partnerEmail || null,
      created_by: (auth as any).user.id,
      created_at: now,
    });

    if (error) throw error;

    // If partner email provided, create/update partner access
    if (partnerEmail) {
      const { data: existingPartner } = await supabaseAdmin.from('fmcg_partners').select('*').eq('email', partnerEmail).limit(1).single();
      if (existingPartner) {
        const ids = existingPartner.campaign_ids || [];
        if (!ids.includes(campaignId)) {
          ids.push(campaignId);
          await supabaseAdmin.from('fmcg_partners').update({ campaign_ids: ids }).eq('email', partnerEmail);
        }
      } else {
        await supabaseAdmin.from('fmcg_partners').insert({
          email: partnerEmail,
          campaign_ids: [campaignId],
        });
      }
      console.log(`[FMCG] Partner access granted: ${partnerEmail} → campaign ${campaignId}`);
    }

    console.log(`[FMCG] Campaign created: ${campaignId} (${name}) by ${(auth as any).user.email}`);

    // Return with camelCase for frontend compat
    return c.json({
      success: true,
      campaign: {
        id: campaignId, name, brandName, brandLogoUrl: brandLogoUrl || "", brandColour: brandColour || "#7cc643",
        batchSize, startDate, expiryDate, status: "draft", rewardConfig: processedRewards,
        customItemId, partnerEmail: partnerEmail || null, createdAt: now,
      },
    });
  } catch (error: any) {
    console.error("[FMCG] Create campaign error:", error);
    return c.json({ error: `Failed to create campaign: ${error.message}` }, 500);
  }
});

// PUT /campaigns/:id — update campaign
fmcg.put("/campaigns/:id", async (c) => {
  try {
    const auth = await requireSuperAdmin(c);
    if (auth instanceof Response) return auth;

    const id = c.req.param("id");
    const { data: existing } = await supabaseAdmin.from('fmcg_campaigns').select('*').eq('id', id).limit(1).single();
    if (!existing) return c.json({ error: "Campaign not found" }, 404);

    const updates = await c.req.json();
    const pgUpdates: Record<string, any> = { updated_at: new Date().toISOString() };

    // Map camelCase to snake_case
    const fieldMap: Record<string, string> = {
      name: 'name', brandName: 'brand_name', brandLogoUrl: 'brand_logo_url',
      brandColour: 'brand_colour', batchSize: 'batch_size', startDate: 'start_date',
      expiryDate: 'expiry_date', status: 'status', rewardConfig: 'reward_config',
      partnerEmail: 'partner_email',
    };

    for (const [camel, snake] of Object.entries(fieldMap)) {
      if (updates[camel] !== undefined) pgUpdates[snake] = updates[camel];
    }

    await supabaseAdmin.from('fmcg_campaigns').update(pgUpdates).eq('id', id);

    console.log(`[FMCG] Campaign updated: ${id} (${existing.name})`);
    return c.json({ success: true, campaign: { ...existing, ...pgUpdates } });
  } catch (error: any) {
    console.error("[FMCG] Update campaign error:", error);
    return c.json({ error: `Failed to update campaign: ${error.message}` }, 500);
  }
});

// DELETE /campaigns/:id — delete campaign (and its codes)
fmcg.delete("/campaigns/:id", async (c) => {
  try {
    const auth = await requireSuperAdmin(c);
    if (auth instanceof Response) return auth;

    const id = c.req.param("id");
    const { data: existing } = await supabaseAdmin.from('fmcg_campaigns').select('*').eq('id', id).limit(1).single();
    if (!existing) return c.json({ error: "Campaign not found" }, 404);

    // Delete QR codes (CASCADE from fmcg_qr_codes FK will handle this, but let's be explicit)
    const { count } = await supabaseAdmin.from('fmcg_qr_codes').delete().eq('campaign_id', id).select('*', { count: 'exact', head: true });

    // Delete claims
    await supabaseAdmin.from('fmcg_claims').delete().eq('campaign_id', id);

    // Delete campaign
    await supabaseAdmin.from('fmcg_campaigns').delete().eq('id', id);

    // Clean up custom item if any
    if (existing.custom_item_id) {
      await supabaseAdmin.from('shop_items').delete().eq('id', existing.custom_item_id);
    }

    console.log(`[FMCG] Campaign deleted: ${id} (${existing.name}), ${count || 0} codes removed`);
    return c.json({ success: true, deletedCodes: count || 0 });
  } catch (error: any) {
    console.error("[FMCG] Delete campaign error:", error);
    return c.json({ error: `Failed to delete campaign: ${error.message}` }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════════
// QR BATCH GENERATION
// ═══════════════════════════════════════════════════════════════════════

fmcg.post("/campaigns/:id/generate-codes", async (c) => {
  try {
    const auth = await requireSuperAdmin(c);
    if (auth instanceof Response) return auth;

    const id = c.req.param("id");
    const { data: campaign } = await supabaseAdmin.from('fmcg_campaigns').select('*').eq('id', id).limit(1).single();
    if (!campaign) return c.json({ error: "Campaign not found" }, 404);

    // Check if codes already generated
    const { count: existingCount } = await supabaseAdmin.from('fmcg_qr_codes').select('*', { count: 'exact', head: true }).eq('campaign_id', id);
    if ((existingCount || 0) > 0) {
      return c.json({ error: `Codes already generated (${existingCount} exist). Delete campaign and recreate to regenerate.` }, 400);
    }

    const rewards: any[] = campaign.reward_config || [];
    const hasQuantities = rewards.some((r: any) => r.quantity && r.quantity > 0);

    let batchSize: number;
    let lootAssignments: any[] = [];

    if (hasQuantities) {
      const totalFromQuantities = rewards.reduce((sum: number, r: any) => sum + (r.quantity || 0), 0);
      batchSize = Math.min(totalFromQuantities, 500000);
      const assignments: number[] = [];
      for (let ri = 0; ri < rewards.length; ri++) {
        const qty = rewards[ri].quantity || 0;
        for (let q = 0; q < qty && assignments.length < batchSize; q++) {
          assignments.push(ri);
        }
      }
      // Fisher-Yates shuffle
      for (let i = assignments.length - 1; i > 0; i--) {
        const bytes = new Uint8Array(4);
        crypto.getRandomValues(bytes);
        const j = (bytes[0] | (bytes[1] << 8) | (bytes[2] << 16) | ((bytes[3] & 0x7f) << 24)) % (i + 1);
        [assignments[i], assignments[j]] = [assignments[j], assignments[i]];
      }
      lootAssignments = assignments.map(ri => rewards[ri]);
    } else {
      batchSize = Math.min(campaign.batch_size, 10000);
      lootAssignments = new Array(batchSize).fill(null);
    }

    console.log(`[FMCG] Generating ${batchSize} QR codes for campaign ${id}`);
    console.time(`[FMCG] Code generation ${id}`);

    const codes: string[] = [];
    const codeSet = new Set<string>();
    while (codes.length < batchSize) {
      const code = generateSecureCode();
      if (!codeSet.has(code)) {
        codeSet.add(code);
        codes.push(code);
      }
    }

    // Build CSV
    const baseUrl = "https://app.projectlumi.org/qr?code=";
    let csv = "serial_number,url,reward_type,reward_detail\n";
    for (let i = 0; i < codes.length; i++) {
      const serial = String(i + 1).padStart(6, "0");
      const url = `${baseUrl}${codes[i]}`;
      let rewardType = "all_rewards";
      let rewardDetail = "";
      if (lootAssignments[i] !== null && lootAssignments[i] !== undefined) {
        const loot = lootAssignments[i];
        rewardType = loot.type || "unknown";
        if (loot.amount) rewardDetail = `x${loot.amount}`;
        if (loot.label) rewardDetail = loot.label;
      }
      csv += `${serial},${url},${rewardType},${rewardDetail}\n`;
    }

    // Upload CSV to R2
    const csvKey = `fmcg-csv/${id}-${campaign.brand_name.replace(/\s+/g, '_')}-${batchSize}codes.csv`;
    const csvBytes = new TextEncoder().encode(csv);
    const csvUpload = await uploadToR2(csvKey, csvBytes, "text/csv");
    console.log(`[FMCG] CSV uploaded to R2: ${csvUpload.publicUrl} (${csvBytes.length} bytes)`);

    // Insert QR codes into Postgres in batches
    const CHUNK = 500;
    for (let i = 0; i < batchSize; i += CHUNK) {
      const chunk = codes.slice(i, i + CHUNK);
      const rows = chunk.map((code, ci) => {
        const idx = i + ci;
        const assignedReward = lootAssignments[idx] !== null && lootAssignments[idx] !== undefined
          ? lootAssignments[idx]
          : null;
        return {
          code,
          campaign_id: id,
          assigned_reward: assignedReward,
          claimed_by: null,
          claimed_at: null,
        };
      });
      const { error } = await supabaseAdmin.from('fmcg_qr_codes').insert(rows);
      if (error) console.error(`[FMCG] QR insert batch error at ${i}:`, error.message);
      if ((i + CHUNK) % 2000 === 0 || i + CHUNK >= batchSize) {
        console.log(`[FMCG] PG progress: ${Math.min(i + CHUNK, batchSize)}/${batchSize} codes inserted`);
      }
    }

    // Update campaign
    await supabaseAdmin.from('fmcg_campaigns').update({
      status: "active",
      csv_url: csvUpload.publicUrl,
      csv_r2_key: csvUpload.key,
      generated_total: batchSize,
      kv_tracked: batchSize, // All in PG now
      updated_at: new Date().toISOString(),
    }).eq('id', id);

    console.timeEnd(`[FMCG] Code generation ${id}`);
    console.log(`[FMCG] Generated ${batchSize} codes, CSV at ${csvUpload.publicUrl}`);

    return c.json({
      success: true,
      generated: batchSize,
      kvTracked: batchSize,
      csvUrl: csvUpload.publicUrl,
      status: "active",
    });
  } catch (error: any) {
    console.error("[FMCG] Generate codes error:", error);
    return c.json({ error: `Failed to generate codes: ${error.message}` }, 500);
  }
});

// GET /campaigns/:id/codes — list codes with optional status filter
fmcg.get("/campaigns/:id/codes", async (c) => {
  try {
    const auth = await requireSuperAdmin(c);
    if (auth instanceof Response) return auth;

    const id = c.req.param("id");
    const statusFilter = c.req.query("status");
    const page = parseInt(c.req.query("page") || "1", 10);
    const limit = Math.min(parseInt(c.req.query("limit") || "100", 10), 500);
    const offset = (page - 1) * limit;

    let query = supabaseAdmin.from('fmcg_qr_codes').select('*', { count: 'exact' }).eq('campaign_id', id);

    if (statusFilter === "claimed") {
      query = query.not('claimed_by', 'is', null);
    } else if (statusFilter === "unclaimed") {
      query = query.is('claimed_by', null);
    }

    const { data: codes, count, error } = await query.range(offset, offset + limit - 1);
    if (error) throw error;

    return c.json({
      success: true,
      codes: codes || [],
      total: count || 0,
      page,
      pages: Math.ceil((count || 0) / limit),
    });
  } catch (error: any) {
    console.error("[FMCG] List codes error:", error);
    return c.json({ error: `Failed to list codes: ${error.message}` }, 500);
  }
});

// GET /campaigns/:id/codes/csv — download codes as CSV
fmcg.get("/campaigns/:id/codes/csv", async (c) => {
  try {
    const auth = await requireSuperAdmin(c);
    if (auth instanceof Response) return auth;

    const id = c.req.param("id");
    const { data: campaign } = await supabaseAdmin.from('fmcg_campaigns').select('brand_name').eq('id', id).limit(1).single();
    if (!campaign) return c.json({ error: "Campaign not found" }, 404);

    const { data: records } = await supabaseAdmin.from('fmcg_qr_codes').select('code, claimed_by, claimed_at').eq('campaign_id', id);

    const baseUrl = "https://app.projectlumi.org/qr?code=";
    let csv = "code,url,status,claimedBy,claimedAt\n";
    for (const rec of (records || [])) {
      const status = rec.claimed_by ? "claimed" : "unclaimed";
      csv += `${rec.code},${baseUrl}${rec.code},${status},${rec.claimed_by || ""},${rec.claimed_at || ""}\n`;
    }

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${campaign.brand_name}-${id.slice(0, 8)}-codes.csv"`,
      },
    });
  } catch (error: any) {
    console.error("[FMCG] CSV download error:", error);
    return c.json({ error: `Failed to generate CSV: ${error.message}` }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════════
// PART A — QR SCAN & REWARD CLAIM FLOW
// ═══════════════════════════════════════════════════════════════════════

// GET /qr/:code — Resolve QR code info (public)
fmcg.get("/qr/:code", async (c) => {
  try {
    const code = c.req.param("code");
    const { data: qr } = await supabaseAdmin.from('fmcg_qr_codes').select('*').eq('code', code).limit(1).single();

    if (!qr) {
      return c.json({ error: "Invalid QR code", status: "invalid" }, 404);
    }

    const { data: campaign } = await supabaseAdmin.from('fmcg_campaigns').select('*').eq('id', qr.campaign_id).limit(1).single();
    if (!campaign) {
      return c.json({ error: "Campaign not found for this code", status: "invalid" }, 404);
    }

    const liveStatus = deriveCampaignStatus(campaign);
    const isClaimed = qr.claimed_by !== null;

    return c.json({
      success: true,
      code,
      campaignId: campaign.id,
      brandName: campaign.brand_name,
      brandLogoUrl: campaign.brand_logo_url,
      brandColour: campaign.brand_colour,
      campaignName: campaign.name,
      campaignStatus: liveStatus,
      isClaimed,
      claimedAt: qr.claimed_at,
      rewardConfig: isClaimed ? [] : campaign.reward_config,
      startDate: campaign.start_date,
      expiryDate: campaign.expiry_date,
    });
  } catch (error: any) {
    console.error("[FMCG] QR resolve error:", error);
    return c.json({ error: `Failed to resolve QR code: ${error.message}` }, 500);
  }
});

// POST /claim — Claim a QR code (requires auth)
fmcg.post("/claim", async (c) => {
  try {
    const token = c.req.header("X-User-Token");
    const { error: authError, user } = await verifyToken(token);
    if (authError || !user) {
      return c.json({ error: `Unauthorized: ${authError || "No user"}`, status: "unauthorized" }, 401);
    }

    const { code } = await c.req.json();
    if (!code) return c.json({ error: "Missing QR code", status: "invalid" }, 400);

    // 1. Resolve QR code
    const { data: qr } = await supabaseAdmin.from('fmcg_qr_codes').select('*').eq('code', code).limit(1).single();
    if (!qr) {
      return c.json({ error: "Invalid QR code", status: "invalid" }, 404);
    }

    // 2. Load campaign
    const { data: campaign } = await supabaseAdmin.from('fmcg_campaigns').select('*').eq('id', qr.campaign_id).limit(1).single();
    if (!campaign) {
      return c.json({ error: "Campaign not found", status: "invalid" }, 404);
    }

    // 3. Check campaign status
    const liveStatus = deriveCampaignStatus(campaign);
    if (liveStatus === "expired") {
      return c.json({ error: "This campaign has expired", status: "expired", expiryDate: campaign.expiry_date, brandName: campaign.brand_name });
    }
    if (liveStatus === "upcoming") {
      return c.json({ error: "This campaign has not started yet", status: "upcoming", startDate: campaign.start_date, brandName: campaign.brand_name });
    }

    // 4. Check if already claimed
    if (qr.claimed_by !== null) {
      return c.json({ error: "This code has already been redeemed", status: "already_claimed", claimedAt: qr.claimed_at, brandName: campaign.brand_name });
    }

    // 5. CLAIM
    const now = new Date().toISOString();
    await supabaseAdmin.from('fmcg_qr_codes').update({ claimed_by: user.id, claimed_at: now }).eq('code', code);

    // 6. GRANT REWARDS
    const grantedRewards: any[] = [];
    const { data: statsRow } = await supabaseAdmin.from('realm_stats').select('*').eq('user_id', user.id).limit(1).single();
    const stats: any = statsRow || { gold: 0, diamond: 0, xp: 0, bag_slots: 5, inventory: {} };

    const rewardsToGrant = qr.assigned_reward ? [qr.assigned_reward] : campaign.reward_config;

    for (const reward of rewardsToGrant) {
      switch (reward.type) {
        case "gold": {
          const amount = reward.amount || 100;
          stats.gold = (stats.gold || 0) + amount;
          grantedRewards.push({ type: "gold", amount, label: `${amount} Gold` });
          break;
        }
        case "diamonds": {
          const amount = reward.amount || 1;
          stats.diamond = (stats.diamond || 0) + amount;
          grantedRewards.push({ type: "diamonds", amount, label: `${amount} Diamond${amount > 1 ? "s" : ""}` });
          break;
        }
        case "bagSlot": {
          const currentSlots = stats.bag_slots || 5;
          if (currentSlots >= 20) {
            stats.gold = (stats.gold || 0) + 100;
            grantedRewards.push({ type: "gold", amount: 100, label: "100 Gold (bag slot max reached)", fallback: true });
          } else {
            stats.bag_slots = currentSlots + 1;
            grantedRewards.push({ type: "bagSlot", amount: 1, label: `+1 Bag Slot (now ${currentSlots + 1})` });
          }
          break;
        }
        case "premiumDays": {
          const days = reward.amount || 7;
          const { data: parentData } = await supabaseAdmin.from('parents').select('*').eq('id', user.id).limit(1).single();
          if (parentData) {
            const nowDate = new Date();
            const currentExpiry = parentData.premium_expires_at ? new Date(parentData.premium_expires_at) : null;
            const isStripePaid = parentData.subscription_status === "active" && parentData.premium_source === "stripe";
            const baseDate = (currentExpiry && currentExpiry > nowDate) ? currentExpiry : nowDate;
            const newExpiry = new Date(baseDate.getTime() + days * 86400000);

            const parentUpdates: Record<string, any> = {
              premium_expires_at: newExpiry.toISOString(),
              updated_at: nowDate.toISOString(),
            };
            if (!isStripePaid) {
              parentUpdates.subscription_status = "active";
              parentUpdates.subscription_plan = parentData.subscription_plan || "fmcg_trial";
              parentUpdates.premium_source = parentData.premium_source || "fmcg_trial";
            }
            // Track brand attribution in extra JSONB
            const extra = parentData.extra || {};
            if (!extra.premium_grants) extra.premium_grants = [];
            extra.premium_grants.push({
              brandName: campaign.brand_name, campaignId: campaign.id,
              days, grantedAt: nowDate.toISOString(), expiresAt: newExpiry.toISOString(),
            });
            parentUpdates.extra = extra;

            await supabaseAdmin.from('parents').update(parentUpdates).eq('id', user.id);

            grantedRewards.push({ type: "premiumDays", amount: days, label: `${days}-Day Premium Trial` });
            console.log(`[FMCG] Granted ${days} premium days to user ${user.id}, expires: ${newExpiry.toISOString()}`);
          }
          break;
        }
        case "existingItem":
        case "customItem": {
          const itemId = reward.itemId;
          if (itemId) {
            if (!stats.inventory) stats.inventory = {};
            const currentQty = stats.inventory[itemId] || 0;
            const STACK_LIMIT = 99;

            const { data: itemDef } = await supabaseAdmin.from('shop_items').select('*').eq('id', itemId).limit(1).single();
            const isEquipment = itemDef?.category === "treasure" && !!itemDef?.equip_slot;

            if (!isEquipment && currentQty === 0) {
              const bagSlots = stats.bag_slots || 5;
              let usedSlots = 0;
              for (const [id, qty] of Object.entries(stats.inventory)) {
                if ((qty as number) <= 0) continue;
                const { data: def } = await supabaseAdmin.from('shop_items').select('category, equip_slot').eq('id', id).limit(1).single();
                const isEquip = def?.category === "treasure" && !!def?.equip_slot;
                if (isEquip) continue;
                usedSlots += Math.ceil((qty as number) / STACK_LIMIT);
              }
              if (usedSlots >= bagSlots) {
                stats.gold = (stats.gold || 0) + 100;
                grantedRewards.push({ type: "gold", amount: 100, label: "100 Gold (bag full)", fallback: true });
                continue;
              }
            }

            stats.inventory[itemId] = Math.min(STACK_LIMIT, currentQty + 1);

            grantedRewards.push({
              type: reward.type,
              itemId,
              amount: 1,
              label: itemDef?.name || itemId,
              emoji: itemDef?.emoji || "🎁",
            });
          }
          break;
        }
      }
    }

    // Save updated realm stats
    if (statsRow) {
      await supabaseAdmin.from('realm_stats').update({
        gold: stats.gold,
        diamond: stats.diamond,
        xp: stats.xp,
        bag_slots: stats.bag_slots,
        inventory: stats.inventory,
        updated_at: now,
      }).eq('user_id', user.id);
    } else {
      await supabaseAdmin.from('realm_stats').insert({
        user_id: user.id,
        gold: stats.gold,
        diamond: stats.diamond,
        xp: stats.xp,
        bag_slots: stats.bag_slots,
        inventory: stats.inventory,
        updated_at: now,
      });
    }

    // 7. LOG CLAIM EVENT
    await supabaseAdmin.from('fmcg_claims').insert({
      campaign_id: qr.campaign_id,
      code,
      user_id: user.id,
      brand_name: campaign.brand_name,
      rewards: grantedRewards,
      claimed_at: now,
    });

    // Update campaign claimed counter
    await supabaseAdmin.from('fmcg_campaigns').update({
      claimed_count: (campaign.claimed_count || 0) + 1,
      updated_at: now,
    }).eq('id', qr.campaign_id);

    console.log(`[FMCG] QR claimed: code=${code}, user=${user.id}, campaign=${campaign.name}, rewards=${grantedRewards.length}`);

    return c.json({
      success: true,
      status: "claimed",
      brandName: campaign.brand_name,
      brandLogoUrl: campaign.brand_logo_url,
      brandColour: campaign.brand_colour,
      campaignName: campaign.name,
      rewards: grantedRewards,
    });
  } catch (error: any) {
    console.error("[FMCG] Claim error:", error);
    return c.json({ error: `Failed to claim reward: ${error.message}`, status: "error" }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════════
// PART C — FMCG PARTNER PORTAL (read-only)
// ═══════════════════════════════════════════════════════════════════════

// GET /partner/campaigns — list campaigns accessible to the partner
fmcg.get("/partner/campaigns", async (c) => {
  try {
    const auth = await requirePartner(c);
    if (auth instanceof Response) return auth;

    const { partner } = auth as { user: any; partner: any };
    const campaignIds: string[] = partner.campaign_ids || [];

    if (campaignIds.length === 0) {
      return c.json({ success: true, campaigns: [] });
    }

    const { data: campaigns } = await supabaseAdmin.from('fmcg_campaigns').select('*').in('id', campaignIds);

    const enriched = await Promise.all(
      (campaigns || []).map(async (camp: any) => {
        const { count } = await supabaseAdmin.from('fmcg_qr_codes').select('*', { count: 'exact', head: true }).eq('campaign_id', camp.id);
        return {
          id: camp.id,
          name: camp.name,
          brandName: camp.brand_name,
          brandColour: camp.brand_colour,
          brandLogoUrl: camp.brand_logo_url,
          startDate: camp.start_date,
          expiryDate: camp.expiry_date,
          liveStatus: deriveCampaignStatus(camp),
          totalCodes: count || 0,
          claimedCount: camp.claimed_count || 0,
          redemptionRate: (count || 0) > 0 ? ((camp.claimed_count || 0) / (count || 1)) * 100 : 0,
          rewards: camp.reward_config || [],
        };
      })
    );

    return c.json({ success: true, campaigns: enriched });
  } catch (error: any) {
    console.error("[FMCG] Partner campaigns error:", error);
    return c.json({ error: `Failed to load partner campaigns: ${error.message}` }, 500);
  }
});

// GET /partner/campaigns/:id/stats — campaign analytics for partner
fmcg.get("/partner/campaigns/:id/stats", async (c) => {
  try {
    const auth = await requirePartner(c);
    if (auth instanceof Response) return auth;

    const { partner } = auth as { user: any; partner: any };
    const id = c.req.param("id");

    if (!(partner.campaign_ids || []).includes(id)) {
      return c.json({ error: "You do not have access to this campaign" }, 403);
    }

    const { data: campaign } = await supabaseAdmin.from('fmcg_campaigns').select('*').eq('id', id).limit(1).single();
    if (!campaign) return c.json({ error: "Campaign not found" }, 404);

    const { count: totalCodes } = await supabaseAdmin.from('fmcg_qr_codes').select('*', { count: 'exact', head: true }).eq('campaign_id', id);

    // Fetch claim events
    const { data: claimEvents } = await supabaseAdmin.from('fmcg_claims').select('*').eq('campaign_id', id);

    const claimsByDay: Record<string, number> = {};
    const claimsByHour: Record<string, number> = {};
    let premiumDaysGranted = 0;
    let premiumDaysClaimCount = 0;

    for (const evt of (claimEvents || [])) {
      const day = (evt.claimed_at || "").slice(0, 10);
      if (day) claimsByDay[day] = (claimsByDay[day] || 0) + 1;

      const hour = new Date(evt.claimed_at).getHours().toString().padStart(2, "0") + ":00";
      claimsByHour[hour] = (claimsByHour[hour] || 0) + 1;

      if (evt.rewards && Array.isArray(evt.rewards)) {
        for (const r of evt.rewards) {
          if (r.type === "premiumDays") {
            premiumDaysGranted += r.amount || 0;
            premiumDaysClaimCount++;
          }
        }
      }
    }

    // Premium conversion check
    let premiumConvertedCount = 0;
    if (premiumDaysClaimCount > 0) {
      const premiumRecipientIds = new Set<string>();
      for (const evt of (claimEvents || [])) {
        if (evt.rewards && Array.isArray(evt.rewards)) {
          for (const r of evt.rewards) {
            if (r.type === "premiumDays" && evt.user_id) {
              premiumRecipientIds.add(evt.user_id);
            }
          }
        }
      }
      if (premiumRecipientIds.size > 0) {
        const { data: parentRecords } = await supabaseAdmin.from('parents')
          .select('subscription_status, premium_source')
          .in('id', Array.from(premiumRecipientIds));
        for (const p of (parentRecords || [])) {
          if (p.subscription_status === "active" && p.premium_source !== "fmcg_trial") {
            premiumConvertedCount++;
          }
        }
      }
    }

    return c.json({
      success: true,
      campaign: {
        id: campaign.id, name: campaign.name, brandName: campaign.brand_name,
        brandColour: campaign.brand_colour, startDate: campaign.start_date,
        expiryDate: campaign.expiry_date, liveStatus: deriveCampaignStatus(campaign),
        csvUrl: campaign.csv_url || null, generatedTotal: campaign.generated_total || null,
        rewards: campaign.reward_config || [],
      },
      stats: {
        totalCodes: totalCodes || 0,
        totalClaimed: (claimEvents || []).length,
        redemptionRate: (totalCodes || 0) > 0 ? (((claimEvents || []).length / (totalCodes || 1)) * 100).toFixed(1) : "0.0",
        premiumDaysGranted,
        premiumDaysClaimCount,
        premiumConvertedCount,
        claimsByDay: Object.entries(claimsByDay).map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date)),
        claimsByHour: Object.entries(claimsByHour).map(([hour, count]) => ({ hour, count })).sort((a, b) => a.hour.localeCompare(b.hour)),
      },
    });
  } catch (error: any) {
    console.error("[FMCG] Partner stats error:", error);
    return c.json({ error: `Failed to load campaign stats: ${error.message}` }, 500);
  }
});

// GET /partner/campaigns/:id/codes — partner code download (read-only)
fmcg.get("/partner/campaigns/:id/codes", async (c) => {
  try {
    const auth = await requirePartner(c);
    if (auth instanceof Response) return auth;

    const { partner } = auth as { user: any; partner: any };
    const id = c.req.param("id");

    if (!(partner.campaign_ids || []).includes(id)) {
      return c.json({ error: "Access denied to this campaign" }, 403);
    }

    const statusFilter = c.req.query("status");
    const { data: campaign } = await supabaseAdmin.from('fmcg_campaigns').select('brand_name').eq('id', id).limit(1).single();

    let query = supabaseAdmin.from('fmcg_qr_codes').select('code, claimed_by, claimed_at').eq('campaign_id', id);
    if (statusFilter === "claimed") {
      query = query.not('claimed_by', 'is', null);
    } else if (statusFilter === "unclaimed") {
      query = query.is('claimed_by', null);
    }

    const { data: records } = await query;

    const baseUrl = "https://app.projectlumi.org/qr?code=";
    let csv = "code,url,status,claimedAt\n";
    for (const rec of (records || [])) {
      const status = rec.claimed_by ? "claimed" : "unclaimed";
      csv += `${rec.code},${baseUrl}${rec.code},${status},${rec.claimed_at || ""}\n`;
    }

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${campaign?.brand_name || "fmcg"}-codes-${statusFilter || "all"}.csv"`,
      },
    });
  } catch (error: any) {
    console.error("[FMCG] Partner CSV error:", error);
    return c.json({ error: `Failed to download codes: ${error.message}` }, 500);
  }
});

export { fmcg };
