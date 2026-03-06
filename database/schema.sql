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
