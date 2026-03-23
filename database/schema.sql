-- ============================================================
-- Recrutor AI — Supabase Schema
-- Run this in your Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- Users table
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Vacancies table
-- ============================================================
CREATE TABLE IF NOT EXISTS vacancies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    requirements JSONB NOT NULL DEFAULT '{}',
    weights JSONB NOT NULL DEFAULT '{
        "hard_skills": 40,
        "experience": 25,
        "education": 15,
        "soft_skills": 10,
        "languages": 5,
        "culture_fit": 5
    }',
    salary_range JSONB,
    location VARCHAR(255),
    remote BOOLEAN DEFAULT FALSE,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'paused', 'closed')),
    google_form_id VARCHAR(255),
    google_form_url TEXT,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Candidates table
-- ============================================================
CREATE TABLE IF NOT EXISTS candidates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vacancy_id UUID NOT NULL REFERENCES vacancies(id) ON DELETE CASCADE,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    form_responses JSONB NOT NULL DEFAULT '{}',
    resume_text TEXT,
    resume_url TEXT,
    linkedin_url TEXT,
    portfolio_url TEXT,
    google_form_response_id VARCHAR(255) UNIQUE,
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    status VARCHAR(50) DEFAULT 'new'
        CHECK (status IN ('new', 'analyzing', 'analyzed', 'invited', 'rejected', 'error'))
);

-- ============================================================
-- AI Analysis table
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_analysis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
    overall_score INTEGER NOT NULL CHECK (overall_score >= 0 AND overall_score <= 100),
    category VARCHAR(20) NOT NULL CHECK (category IN ('excellent', 'good', 'average', 'below')),
    scores JSONB NOT NULL DEFAULT '{}',
    strengths TEXT[] DEFAULT '{}',
    weaknesses TEXT[] DEFAULT '{}',
    summary TEXT,
    recommendations TEXT[] DEFAULT '{}',
    ai_insights JSONB DEFAULT '{}',
    integrity JSONB DEFAULT NULL,
    independent_assessment JSONB DEFAULT NULL,
    analyzed_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_vacancies_created_by ON vacancies(created_by);
CREATE INDEX IF NOT EXISTS idx_vacancies_status ON vacancies(status);
CREATE INDEX IF NOT EXISTS idx_vacancies_form_id ON vacancies(google_form_id);

CREATE INDEX IF NOT EXISTS idx_candidates_vacancy ON candidates(vacancy_id);
CREATE INDEX IF NOT EXISTS idx_candidates_status ON candidates(status);
CREATE INDEX IF NOT EXISTS idx_candidates_form_response ON candidates(google_form_response_id);

CREATE INDEX IF NOT EXISTS idx_analysis_candidate ON ai_analysis(candidate_id);
CREATE INDEX IF NOT EXISTS idx_analysis_score ON ai_analysis(overall_score DESC);

-- ============================================================
-- Row Level Security (RLS) — optional but recommended
-- Disable if using service role key only
-- ============================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE vacancies ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_analysis ENABLE ROW LEVEL SECURITY;

-- For service role access (backend uses service role key, bypasses RLS)
-- No policies needed if you only access from backend with service key

-- ============================================================
-- Sample data (optional)
-- ============================================================
-- INSERT INTO users (email, password_hash, name)
-- VALUES ('demo@recrutor.ai', '$2b$12$...', 'Demo HR Manager');

-- ============================================================
-- Migration v2: Organizations, email verification, custom questions
-- Run this in Supabase SQL Editor on existing databases
-- ============================================================

-- 1. Extend users
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS verification_code VARCHAR(6),
  ADD COLUMN IF NOT EXISTS verification_code_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user','superadmin')),
  ADD COLUMN IF NOT EXISTS company_name VARCHAR(255);

-- 2. Organizations
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  plan VARCHAR(20) DEFAULT 'free' CHECK (plan IN ('free','pro')),
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Organization members
CREATE TABLE IF NOT EXISTS organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20) DEFAULT 'member' CHECK (role IN ('owner','admin','member')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, user_id)
);

-- 4. Vacancies — add org_id + custom_questions
ALTER TABLE vacancies
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS custom_questions JSONB DEFAULT '[]';

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_vacancies_org ON vacancies(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user ON organization_members(user_id);

-- 6. RLS on new tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;

-- 7. Migrate existing users -> create org for each + mark as verified
DO $$
DECLARE u RECORD; new_org_id UUID; slug_val TEXT;
BEGIN
  FOR u IN SELECT id, name, email, company_name FROM users LOOP
    slug_val := lower(regexp_replace(
      COALESCE(NULLIF(u.company_name,''), split_part(u.email,'@',1)),
      '[^a-z0-9]', '-', 'g'
    )) || '-' || substr(u.id::text, 1, 6);

    -- Skip if org already exists for this user
    IF NOT EXISTS (SELECT 1 FROM organization_members WHERE user_id = u.id) THEN
      INSERT INTO organizations (name, slug, plan, owner_id)
        VALUES (COALESCE(NULLIF(u.company_name,''), u.name || '''s Org'), slug_val, 'free', u.id)
        RETURNING id INTO new_org_id;
      INSERT INTO organization_members (org_id, user_id, role) VALUES (new_org_id, u.id, 'owner');
      UPDATE vacancies SET organization_id = new_org_id WHERE created_by = u.id;
    END IF;
  END LOOP;
END $$;

-- Mark all existing users as verified (they registered before verification was introduced)
UPDATE users SET email_verified = TRUE WHERE email_verified = FALSE;

-- ═══════════════════════════════════════════════════════════════════
-- v3: Token system, Support tickets, Usage logs, Admin whitelist
-- ═══════════════════════════════════════════════════════════════════

-- Token balance for users
ALTER TABLE users ADD COLUMN IF NOT EXISTS token_balance INTEGER DEFAULT 100;
ALTER TABLE users ADD COLUMN IF NOT EXISTS tokens_used INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_whitelisted BOOLEAN DEFAULT FALSE;

-- Token transactions (purchases, usage, bonuses)
CREATE TABLE IF NOT EXISTS token_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL CHECK (type IN ('purchase', 'usage', 'bonus', 'refund')),
  amount INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  description TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_token_transactions_user ON token_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_token_transactions_type ON token_transactions(type);

-- Token pricing plans
CREATE TABLE IF NOT EXISTS token_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  tokens INTEGER NOT NULL,
  price_usd DECIMAL(10,2) NOT NULL,
  price_uzs DECIMAL(12,0),
  popular BOOLEAN DEFAULT FALSE,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default plans (cost ~$0.01/token, sell at $0.02-0.03 = 100-200% margin)
INSERT INTO token_plans (name, tokens, price_usd, price_uzs, popular) VALUES
  ('Стартер', 100, 2.99, 38000, false),
  ('Базовый', 500, 9.99, 128000, true),
  ('Про', 1500, 24.99, 320000, false),
  ('Бизнес', 5000, 69.99, 900000, false)
ON CONFLICT DO NOTHING;

-- Support tickets
CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  user_email VARCHAR(255) NOT NULL,
  user_name VARCHAR(255),
  category VARCHAR(50) NOT NULL CHECK (category IN ('bug', 'feature', 'question', 'billing', 'other')),
  priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  subject VARCHAR(500) NOT NULL,
  message TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  admin_reply TEXT,
  admin_id UUID REFERENCES users(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_support_tickets_user ON support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_category ON support_tickets(category);

-- Usage logs (track every AI analysis, form creation, etc.)
CREATE TABLE IF NOT EXISTS usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  org_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  action VARCHAR(50) NOT NULL,
  tokens_cost INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_usage_logs_user ON usage_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_logs_action ON usage_logs(action);
CREATE INDEX IF NOT EXISTS idx_usage_logs_created ON usage_logs(created_at DESC);

-- Admin whitelist emails
CREATE TABLE IF NOT EXISTS admin_whitelist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  added_by UUID REFERENCES users(id),
  note VARCHAR(500),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE token_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE token_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_whitelist ENABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════════════════════════════════
-- v4: Auto rules for candidate processing automation
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS auto_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  vacancy_id UUID REFERENCES vacancies(id) ON DELETE CASCADE,
  condition_type VARCHAR(30) NOT NULL,
  condition_value INTEGER DEFAULT 0,
  action_type VARCHAR(30) NOT NULL,
  enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auto_rules_user ON auto_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_auto_rules_vacancy ON auto_rules(vacancy_id);

ALTER TABLE auto_rules ENABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════════════════════════════════
-- v5: In-app notifications
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(30) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT,
  link VARCHAR(500),
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════════════════════════════════
-- v6: Interviews and Talent Pool
-- ═══════════════════════════════════════════════════════════════════

-- Interviews
CREATE TABLE IF NOT EXISTS interviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID REFERENCES candidates(id) ON DELETE CASCADE,
  vacancy_id UUID REFERENCES vacancies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER DEFAULT 30,
  type VARCHAR(20) DEFAULT 'online',
  location TEXT,
  meeting_link TEXT,
  notes TEXT,
  status VARCHAR(20) DEFAULT 'scheduled',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_interviews_user ON interviews(user_id);

ALTER TABLE interviews ENABLE ROW LEVEL SECURITY;

-- Talent Pool
CREATE TABLE IF NOT EXISTS talent_pool (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  candidate_name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  title VARCHAR(255),
  skills TEXT[],
  experience VARCHAR(50),
  city VARCHAR(100),
  rating INTEGER DEFAULT 0,
  favorite BOOLEAN DEFAULT FALSE,
  source_vacancy_id UUID REFERENCES vacancies(id),
  source_candidate_id UUID REFERENCES candidates(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_talent_pool_user ON talent_pool(user_id);

ALTER TABLE talent_pool ENABLE ROW LEVEL SECURITY;
