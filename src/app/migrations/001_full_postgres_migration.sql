-- ============================================================================
-- FOXY ADVENTURE — FULL KV → POSTGRES MIGRATION
-- Run in Supabase Dashboard → SQL Editor
-- Date: 2026-03-13
-- Covers ALL 40+ KV key patterns across index.tsx, stripe.tsx, fmcg.tsx, kg-postgres.tsx
-- ============================================================================

-- ============================================================================
-- 1. PARENTS (from parent:{userId}, parent_by_email:{email}, referral_code:{code})
-- Eliminates 3 KV keys per user + kills getByPrefix('parent:') death query
-- ============================================================================
CREATE TABLE IF NOT EXISTS parents (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  child_name TEXT,
  child_age INT,
  child_birthdate DATE,
  avatar_url TEXT,
  auth_provider TEXT DEFAULT 'email',
  role TEXT DEFAULT 'parent',
  -- Referral system
  referral_code TEXT UNIQUE,
  referred_by TEXT,              -- referral code used during signup
  origin_tag UUID,               -- FK to school_accounts.id (which KG funnel they came from)
  -- Subscription
  subscription_plan TEXT DEFAULT 'free',
  subscription_status TEXT DEFAULT 'free',
  premium_source TEXT,           -- 'stripe' | 'fmcg_trial' | null
  premium_expires_at TIMESTAMPTZ,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  -- Referral rewards
  referral_credits NUMERIC DEFAULT 0,
  referral_count INT DEFAULT 0,
  -- Daily counters (legacy compat — realm_daily_logs is source of truth)
  test_count_today INT DEFAULT 0,
  watch_count_today INT DEFAULT 0,
  practice_count_today INT DEFAULT 0,
  total_tests INT DEFAULT 0,
  total_watches INT DEFAULT 0,
  total_practices INT DEFAULT 0,
  total_practice_questions INT DEFAULT 0,
  last_test_date DATE,
  last_watch_date DATE,
  last_practice_date DATE,
  -- Preferences
  excluded_subjects JSONB DEFAULT '[]',
  include_mandarin_test BOOLEAN DEFAULT false,
  language TEXT DEFAULT 'en',
  -- Toy addon
  toy_purchased BOOLEAN DEFAULT false,
  toy_purchased_at TIMESTAMPTZ,
  shipping_address JSONB,
  -- Flexible extra fields (for _ref_free_diamond_{id} tracking etc.)
  extra JSONB DEFAULT '{}',
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_parents_origin ON parents(origin_tag);
CREATE INDEX IF NOT EXISTS idx_parents_email ON parents(email);
CREATE INDEX IF NOT EXISTS idx_parents_referral_code ON parents(referral_code);
CREATE INDEX IF NOT EXISTS idx_parents_status ON parents(subscription_status);
CREATE INDEX IF NOT EXISTS idx_parents_created ON parents(created_at DESC);

-- ============================================================================
-- 2. PARENT ACTIVITIES (from parent_activity:{userId}:{date})
-- Time-series daily activity log for heatmap/timeline
-- ============================================================================
CREATE TABLE IF NOT EXISTS parent_activities (
  id BIGSERIAL PRIMARY KEY,
  parent_id UUID NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  tests INT DEFAULT 0,
  watches INT DEFAULT 0,
  practices INT DEFAULT 0,
  questions_total INT DEFAULT 0,
  questions_correct INT DEFAULT 0,
  videos_watched INT DEFAULT 0,
  songs_listened INT DEFAULT 0,
  flashcards_completed INT DEFAULT 0,
  battles INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(parent_id, date)
);

CREATE INDEX IF NOT EXISTS idx_pa_parent_date ON parent_activities(parent_id, date DESC);

-- ============================================================================
-- 3. PARENT ASSESSMENTS (from parent_assessment:{userId}:{timestamp})
-- Progress-over-time snapshots saved after each test
-- ============================================================================
CREATE TABLE IF NOT EXISTS parent_assessments (
  id BIGSERIAL PRIMARY KEY,
  parent_id UUID NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  "timestamp" TIMESTAMPTZ NOT NULL,
  child_age INT DEFAULT 5,
  overall_pct NUMERIC DEFAULT 0,
  total_stars INT DEFAULT 0,
  max_stars INT DEFAULT 0,
  tp_level INT DEFAULT 1,
  readiness_pct NUMERIC DEFAULT 0,
  total_questions INT DEFAULT 0,
  total_correct INT DEFAULT 0,
  subject_summary JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pass_parent_ts ON parent_assessments(parent_id, "timestamp" DESC);

-- ============================================================================
-- 4. SCHOOL ACCOUNTS (from school:{userId}, school_by_id:{id},
--    school_by_url:{slug}, school_by_code:{code}, school_by_email:{email})
-- Eliminates 5x data duplication per school
-- NOTE: This is separate from the existing `kindergartens` PG directory table
-- ============================================================================
CREATE TABLE IF NOT EXISTS school_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  school_name TEXT NOT NULL,
  email TEXT,
  kindergarten_url TEXT,
  short_code TEXT UNIQUE,
  -- Subscription
  subscription_tier TEXT DEFAULT 'trial',   -- trial | free | pro | pending_claim
  trial_expires_at TIMESTAMPTZ,
  -- KG claim system
  claim_status TEXT,                         -- pending | approved | rejected
  claim_code TEXT,
  claimant_name TEXT,
  linked_pg_kg_id INT,                       -- FK to kindergartens.id (PG directory)
  -- Branding
  logo_url TEXT,
  primary_color TEXT DEFAULT '#7cc643',
  -- Contact
  phone TEXT,
  whatsapp_no TEXT,
  address TEXT,
  -- Metrics (aggregated)
  free_parent_count INT DEFAULT 0,
  paid_parent_count INT DEFAULT 0,
  parent_earnings NUMERIC DEFAULT 0,
  -- Stripe
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sa_user ON school_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_sa_email ON school_accounts(email);
CREATE INDEX IF NOT EXISTS idx_sa_url ON school_accounts(kindergarten_url);
CREATE INDEX IF NOT EXISTS idx_sa_code ON school_accounts(short_code);
CREATE INDEX IF NOT EXISTS idx_sa_tier ON school_accounts(subscription_tier);

-- ============================================================================
-- 5. KG CLAIMS (from kg_claim:{code}, kg_claim_by_user:{userId})
-- Kindergarten claim/approval workflow
-- ============================================================================
CREATE TABLE IF NOT EXISTS kg_claims (
  id BIGSERIAL PRIMARY KEY,
  claim_code TEXT NOT NULL,
  kindergarten_id INT,                       -- FK to kindergartens.id
  kg_name TEXT,
  kg_state TEXT,
  kg_city TEXT,
  user_id UUID NOT NULL,
  claimant_name TEXT,
  email TEXT,
  whatsapp TEXT,
  phone TEXT,
  status TEXT DEFAULT 'pending',             -- pending | approved | rejected
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID,
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(claim_code)
);

CREATE INDEX IF NOT EXISTS idx_kgc_user ON kg_claims(user_id);
CREATE INDEX IF NOT EXISTS idx_kgc_status ON kg_claims(status);

-- ============================================================================
-- 6. LEADS (from lead:{leadId}, school_lead:{schoolId}:{leadId},
--    lead_phone:{schoolId}:{phone})
-- Eliminates 3 KV keys per lead + kills getByPrefix('lead:') death query
-- ============================================================================
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL,
  child_name TEXT,
  child_age INT DEFAULT 5,
  parent_name TEXT,
  whatsapp TEXT,
  include_mandarin_test BOOLEAN DEFAULT false,
  answers JSONB DEFAULT '[]',
  score INT DEFAULT 0,
  total_questions INT DEFAULT 0,
  quest_results JSONB DEFAULT '[]',
  age_performance JSONB DEFAULT '[]',
  status TEXT DEFAULT 'pending',             -- pending | in_progress | completed
  source TEXT DEFAULT 'direct',              -- direct | referral
  referral_code_used TEXT,
  referred_by_parent_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leads_school ON leads(school_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_phone ON leads(school_id, whatsapp);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);

-- ============================================================================
-- 7. REPORTS (from report:{reportId}, report_by_lead:{leadId})
-- Shareable assessment reports
-- ============================================================================
CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  child_name TEXT,
  child_age INT DEFAULT 5,
  parent_name TEXT,
  parent_phone TEXT,
  school_id UUID,
  school_name TEXT,
  school_logo_url TEXT,
  school_short_code TEXT,
  school_email TEXT,
  school_phone TEXT,
  school_whatsapp TEXT,
  school_address TEXT,
  answers JSONB DEFAULT '[]',
  module_results JSONB DEFAULT '[]',
  quest_info JSONB DEFAULT '[]',
  score INT DEFAULT 0,
  total_questions INT DEFAULT 0,
  view_count INT DEFAULT 0,
  claimed_by UUID,
  claimed_at TIMESTAMPTZ,
  first_viewed_at TIMESTAMPTZ,
  last_viewed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reports_lead ON reports(lead_id);
CREATE INDEX IF NOT EXISTS idx_reports_school ON reports(school_id);

-- ============================================================================
-- 8. GLOBAL QUESTION BANK (from gq:{q_id})
-- Kills the deadliest getByPrefix('gq:') — called 6+ times for every filter/stat/list
-- ============================================================================
CREATE TABLE IF NOT EXISTS questions (
  q_id TEXT PRIMARY KEY,
  subject TEXT NOT NULL,
  age_target INT NOT NULL,
  question_text TEXT NOT NULL DEFAULT '',
  question_type TEXT DEFAULT 'mcq',          -- mcq | mcq-image | audio-mcq
  options JSONB DEFAULT '[]',
  correct_answer TEXT,
  image_url TEXT,
  audio_url TEXT,
  art_url TEXT,
  -- KSSR taxonomy
  skill_code TEXT,
  kssr_level INT,
  topic TEXT,
  skill_name TEXT,
  -- Metadata
  difficulty TEXT DEFAULT 'normal',
  source TEXT,                               -- 'csv' | 'manual' | 'google-drive'
  -- MCQ-image specific
  answer_image_urls JSONB,                   -- array of R2 URLs for image answer options
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_q_subject_age ON questions(subject, age_target);
CREATE INDEX IF NOT EXISTS idx_q_skill ON questions(skill_code);
CREATE INDEX IF NOT EXISTS idx_q_topic ON questions(topic);
CREATE INDEX IF NOT EXISTS idx_q_type ON questions(question_type);

-- ============================================================================
-- 9. SCHOOL-SPECIFIC QUESTIONS (from question:{questionId},
--    school_question:{schoolId}:{questionId})
-- Per-school custom questions (separate from global bank)
-- ============================================================================
CREATE TABLE IF NOT EXISTS school_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL,
  question_text TEXT NOT NULL,
  question_type TEXT DEFAULT 'mcq',
  options JSONB DEFAULT '[]',
  correct_answer TEXT,
  image_url TEXT,
  audio_url TEXT,
  subject TEXT,
  age_target INT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sq_school ON school_questions(school_id);

-- ============================================================================
-- 10. QUEST CONFIGS (from quest_config:{questId})
-- Admin-managed quest definitions (low volume, but properly typed)
-- ============================================================================
CREATE TABLE IF NOT EXISTS quest_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject TEXT NOT NULL,
  name JSONB NOT NULL,                       -- { en, ms, zh }
  status TEXT DEFAULT 'draft',               -- draft | live | archived
  question_count INT DEFAULT 10,
  icon TEXT DEFAULT '📚',
  is_mandarin BOOLEAN DEFAULT false,
  conditional_key TEXT,
  image_path TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_qc_status ON quest_configs(status);
CREATE INDEX IF NOT EXISTS idx_qc_subject ON quest_configs(subject);

-- ============================================================================
-- 11. REALM STATS (from realm_stats:{userId})
-- Player currency, inventory, equipment, XP
-- ============================================================================
CREATE TABLE IF NOT EXISTS realm_stats (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  gold INT DEFAULT 0,
  diamond INT DEFAULT 0,
  xp INT DEFAULT 0,
  level INT DEFAULT 1,
  bag_slots INT DEFAULT 5,
  inventory JSONB DEFAULT '{}',              -- Record<itemId, quantity>
  equipped JSONB DEFAULT '{}',               -- Record<slot, itemId>
  -- Spending trackers
  total_gold_spent INT DEFAULT 0,
  total_diamond_spent INT DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- 12. REALM DAILY LOGS (from realm_daily:{userId}:{date})
-- Daily activity counts for gold reward gating
-- ============================================================================
CREATE TABLE IF NOT EXISTS realm_daily_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  date DATE NOT NULL,
  log_data JSONB DEFAULT '{}',               -- { test: {count,goldAwarded}, video: {...}, practice: {...} }
  UNIQUE(user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_rdl_user_date ON realm_daily_logs(user_id, date DESC);

-- ============================================================================
-- 13. DIAMOND INBOX (from realm_diamond_inbox:{userId})
-- Queued diamond grants consumed by RealmContext on init
-- ============================================================================
CREATE TABLE IF NOT EXISTS diamond_inbox (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  amount INT NOT NULL DEFAULT 0,
  reason TEXT,
  consumed BOOLEAN DEFAULT false,
  granted_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_di_user ON diamond_inbox(user_id, consumed);

-- ============================================================================
-- 14. MASTERY LOGS (from mastery_log:{userId}:{subjectId}:{skillCode})
-- Per-skill cumulative mastery tracking — grows N skills × M users
-- ============================================================================
CREATE TABLE IF NOT EXISTS mastery_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  subject_id TEXT NOT NULL,
  skill_code TEXT NOT NULL,
  topic_name TEXT DEFAULT 'Unknown',
  level TEXT DEFAULT '',
  skill_name TEXT DEFAULT '',
  total_attempts INT DEFAULT 0,
  total_correct INT DEFAULT 0,
  by_mode JSONB DEFAULT '{}',                -- { quest: {attempts,correct}, practice: {...}, ... }
  ladder_level INT DEFAULT 1,
  current_streak INT DEFAULT 0,
  best_streak INT DEFAULT 0,
  last_answered_at TIMESTAMPTZ,
  UNIQUE(user_id, subject_id, skill_code)
);

CREATE INDEX IF NOT EXISTS idx_ml_user ON mastery_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_ml_user_subject ON mastery_logs(user_id, subject_id);
CREATE INDEX IF NOT EXISTS idx_ml_skill ON mastery_logs(skill_code);

-- ============================================================================
-- 15. MASTERY TRENDS (from mastery_trend:{userId}:{date})
-- Daily mastery snapshot for trend charts
-- ============================================================================
CREATE TABLE IF NOT EXISTS mastery_trends (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  date DATE NOT NULL,
  subjects JSONB DEFAULT '{}',               -- { english: {attempts,correct,percentage}, ... }
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_mt_user_date ON mastery_trends(user_id, date DESC);

-- ============================================================================
-- 16. REFERRAL TRANSACTIONS (from referral_txn:{txnId})
-- Payment referral rewards history
-- ============================================================================
CREATE TABLE IF NOT EXISTS referral_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL,
  referred_id UUID NOT NULL,
  referral_code TEXT,
  reward_amount NUMERIC DEFAULT 0,
  diamond_reward INT DEFAULT 0,
  origin_tag UUID,
  kg_reward NUMERIC DEFAULT 0,
  plan TEXT,
  type TEXT DEFAULT 'paid_subscription',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reftxn_referrer ON referral_transactions(referrer_id);
CREATE INDEX IF NOT EXISTS idx_reftxn_referred ON referral_transactions(referred_id);

-- ============================================================================
-- 17. WATCH HISTORY (from watch_history:{userId})
-- "Watch Again" feature — last 50 videos per user
-- ============================================================================
CREATE TABLE IF NOT EXISTS watch_history (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  video_id TEXT NOT NULL,
  watched_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wh_user ON watch_history(user_id, watched_at DESC);

-- ============================================================================
-- 18. VIDEOS (from foxy_video:{videoId})
-- DynTube video catalogue
-- ============================================================================
CREATE TABLE IF NOT EXISTS videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  subtitle TEXT DEFAULT '',
  dyntube_key TEXT DEFAULT '',
  thumbnail_url TEXT DEFAULT '',
  category TEXT DEFAULT 'english',
  language TEXT DEFAULT '',
  duration TEXT DEFAULT '0:00',
  episode INT,
  series_id UUID,
  is_premium BOOLEAN DEFAULT false,
  is_featured BOOLEAN DEFAULT false,
  "order" INT DEFAULT 0,
  status TEXT DEFAULT 'active',              -- active | deleted
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_videos_status ON videos(status, "order");
CREATE INDEX IF NOT EXISTS idx_videos_category ON videos(category);
CREATE INDEX IF NOT EXISTS idx_videos_series ON videos(series_id);

-- ============================================================================
-- 19. VIDEO SERIES (from foxy_series:{seriesId})
-- ============================================================================
CREATE TABLE IF NOT EXISTS video_series (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  thumbnail TEXT DEFAULT '',
  category TEXT DEFAULT 'english',
  "order" INT DEFAULT 0,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- 20. VIDEO CATEGORIES (from foxy_video_category:{catId})
-- ============================================================================
CREATE TABLE IF NOT EXISTS video_categories (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  "order" INT DEFAULT 0,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- 21. SHOP ITEMS (from shop_item:{itemId}, fmcg_custom_item:{itemId})
-- RPG item catalogue
-- ============================================================================
CREATE TABLE IF NOT EXISTS shop_items (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  image_slug TEXT DEFAULT '',
  price INT DEFAULT 0,
  currency TEXT DEFAULT 'gold',              -- gold | diamond
  rarity TEXT DEFAULT 'common',
  category TEXT DEFAULT 'treasure',          -- food | potion | treasure | weapon
  equip_slot TEXT,                           -- head | body | weapon | ring | null
  effects JSONB DEFAULT '[]',
  emoji TEXT DEFAULT '🎁',
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  -- FMCG campaign link
  fmcg_exclusive BOOLEAN DEFAULT false,
  campaign_id UUID,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_si_category ON shop_items(category);
CREATE INDEX IF NOT EXISTS idx_si_active ON shop_items(is_active);

-- ============================================================================
-- 22. FMCG CAMPAIGNS (from fmcg_campaign:{campaignId})
-- ============================================================================
CREATE TABLE IF NOT EXISTS fmcg_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  brand_name TEXT NOT NULL,
  brand_logo_url TEXT DEFAULT '',
  brand_colour TEXT DEFAULT '#7cc643',
  batch_size INT DEFAULT 100,
  start_date TEXT,
  expiry_date TEXT,
  status TEXT DEFAULT 'draft',               -- draft | active | expired
  reward_config JSONB DEFAULT '[]',
  custom_item_id TEXT,
  partner_email TEXT,
  csv_url TEXT,
  csv_r2_key TEXT,
  generated_total INT DEFAULT 0,
  kv_tracked INT DEFAULT 0,
  claimed_count INT DEFAULT 0,
  loot_table JSONB,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fmcg_camp_status ON fmcg_campaigns(status);

-- ============================================================================
-- 23. FMCG PARTNERS (from fmcg_partner:{email})
-- ============================================================================
CREATE TABLE IF NOT EXISTS fmcg_partners (
  email TEXT PRIMARY KEY,
  campaign_ids JSONB DEFAULT '[]',           -- array of campaign UUIDs
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- 24. FMCG QR CODES (from fmcg_qr:{code})
-- Can be 50K+ per campaign — MUST be Postgres
-- ============================================================================
CREATE TABLE IF NOT EXISTS fmcg_qr_codes (
  code TEXT PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES fmcg_campaigns(id) ON DELETE CASCADE,
  assigned_reward JSONB,                     -- specific loot table entry or null
  claimed_by UUID,
  claimed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_fmcg_qr_campaign ON fmcg_qr_codes(campaign_id);
CREATE INDEX IF NOT EXISTS idx_fmcg_qr_claimed ON fmcg_qr_codes(claimed_by);

-- ============================================================================
-- 25. FMCG CLAIMS (from fmcg_claim:{campaignId}:{code})
-- Claim event log for analytics
-- ============================================================================
CREATE TABLE IF NOT EXISTS fmcg_claims (
  id BIGSERIAL PRIMARY KEY,
  campaign_id UUID NOT NULL,
  code TEXT NOT NULL,
  user_id UUID NOT NULL,
  brand_name TEXT,
  rewards JSONB DEFAULT '[]',
  claimed_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(campaign_id, code)
);

CREATE INDEX IF NOT EXISTS idx_fmcg_claims_campaign ON fmcg_claims(campaign_id);
CREATE INDEX IF NOT EXISTS idx_fmcg_claims_user ON fmcg_claims(user_id);

-- ============================================================================
-- 26. MARKETING ARTWORK (from mkt_artwork:{artworkId})
-- Promotional artwork for KG partners
-- ============================================================================
CREATE TABLE IF NOT EXISTS marketing_artworks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  variants JSONB DEFAULT '[]',               -- [{platform, width, height, image_path}]
  status TEXT DEFAULT 'active',
  "order" INT DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- 27. STRIPE EVENTS (from stripe_event:{eventId})
-- Webhook idempotency dedup
-- ============================================================================
CREATE TABLE IF NOT EXISTS stripe_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT,
  processed_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- 28. DYNTUBE PLAYBACK CACHE (from dyntube_playback:{key})
-- 24h cache for DynTube HLS URL resolution
-- ============================================================================
CREATE TABLE IF NOT EXISTS playback_cache (
  video_key TEXT PRIMARY KEY,
  hls_url TEXT,
  thumbnail TEXT DEFAULT '',
  cached_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- 29. REFERRALS BY PARENT (from referrals_by_parent:{parentId})
-- List of lead IDs referred by each parent — derived from leads table
-- No separate table needed; use: SELECT id FROM leads WHERE referred_by_parent_id = ?
-- ============================================================================

-- ============================================================================
-- ENABLE ROW LEVEL SECURITY ON ALL TABLES
-- Service role key bypasses RLS, so server code works unchanged.
-- If you add client-side direct access later, add policies per table.
-- ============================================================================
ALTER TABLE parents ENABLE ROW LEVEL SECURITY;
ALTER TABLE parent_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE parent_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE kg_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE quest_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE realm_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE realm_daily_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE diamond_inbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE mastery_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE mastery_trends ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE watch_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_series ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE fmcg_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE fmcg_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE fmcg_qr_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE fmcg_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_artworks ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE playback_cache ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- SERVICE ROLE BYPASS POLICIES
-- Ensures the Hono server (using SUPABASE_SERVICE_ROLE_KEY) can read/write all tables
-- ============================================================================
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'parents', 'parent_activities', 'parent_assessments',
      'school_accounts', 'kg_claims', 'leads', 'reports',
      'questions', 'school_questions', 'quest_configs',
      'realm_stats', 'realm_daily_logs', 'diamond_inbox',
      'mastery_logs', 'mastery_trends', 'referral_transactions',
      'watch_history', 'videos', 'video_series', 'video_categories',
      'shop_items', 'fmcg_campaigns', 'fmcg_partners',
      'fmcg_qr_codes', 'fmcg_claims', 'marketing_artworks',
      'stripe_events', 'playback_cache'
    ])
  LOOP
    -- Drop existing policy if any, then create fresh
    BEGIN
      EXECUTE format('DROP POLICY IF EXISTS "service_role_all_%s" ON %I', tbl, tbl);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    EXECUTE format(
      'CREATE POLICY "service_role_all_%s" ON %I FOR ALL TO service_role USING (true) WITH CHECK (true)',
      tbl, tbl
    );
  END LOOP;
END
$$;

-- ============================================================================
-- HELPER: updated_at AUTO-TRIGGER
-- Automatically updates `updated_at` on any row modification
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to tables with updated_at columns
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'parents', 'school_accounts', 'leads', 'questions',
      'school_questions', 'quest_configs', 'realm_stats',
      'videos', 'video_series', 'video_categories',
      'shop_items', 'fmcg_campaigns', 'fmcg_partners',
      'marketing_artworks'
    ])
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_updated_at_%s ON %I',
      tbl, tbl
    );
    EXECUTE format(
      'CREATE TRIGGER trg_updated_at_%s BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()',
      tbl, tbl
    );
  END LOOP;
END
$$;

-- ============================================================================
-- VERIFICATION: List all new tables
-- ============================================================================
SELECT table_name, 
       (SELECT count(*) FROM information_schema.columns c WHERE c.table_name = t.table_name AND c.table_schema = 'public') as column_count
FROM information_schema.tables t
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE'
ORDER BY table_name;