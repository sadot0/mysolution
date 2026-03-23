export interface CustomQuestion {
  id: string;
  type: 'text' | 'textarea' | 'radio' | 'checkbox' | 'yesno' | 'scale';
  label: string;
  required: boolean;
  options?: string[];
  placeholder?: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  plan: 'free' | 'pro';
  owner_id: string;
  created_at: string;
}

export interface OrganizationMember {
  id: string;
  org_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member';
  joined_at: string;
  users?: { id: string; name: string; email: string };
}

export interface User {
  id: string;
  email: string;
  name: string;
  email_verified?: boolean;
  company_name?: string;
  role?: 'user' | 'superadmin';
  org_id?: string;
  token_balance?: number;
  tokens_used?: number;
  is_whitelisted?: boolean;
}

export interface VacancyRequirements {
  hard_skills: string[];
  preferred_skills?: string[];
  experience_years: number;
  education?: { required?: string; preferred?: string };
  languages?: Record<string, string>;
  industry_experience?: string[];
  soft_skills?: string[];
  special_requirements?: string[];
}

export interface VacancyWeights {
  hard_skills: number;
  experience: number;
  education: number;
  soft_skills: number;
  languages: number;
  culture_fit: number;
}

export interface Vacancy {
  id: string;
  title: string;
  description?: string;
  requirements: VacancyRequirements;
  weights: VacancyWeights;
  salary_range?: { min: number; max: number; currency: string };
  location?: string;
  remote: boolean;
  status: 'active' | 'paused' | 'closed';
  google_form_id?: string;
  google_form_url?: string;
  custom_questions: CustomQuestion[];
  organization_id?: string;
  hh_vacancy_id?: string;
  hh_url?: string;
  created_at: string;
  updated_at: string;
}

export interface AIScores {
  hard_skills: number;
  experience: number;
  education: number;
  soft_skills: number;
  languages: number;
  culture_fit: number;
}

export interface AIAnalysis {
  id: string;
  candidate_id: string;
  overall_score: number;
  category: 'excellent' | 'good' | 'average' | 'below';
  scores: AIScores;
  strengths: string[];
  weaknesses: string[];
  summary: string;
  recommendations: string[];
  ai_insights: {
    red_flags: string[];
    green_flags: string[];
    potential_concerns: string[];
    growth_potential: 'low' | 'medium' | 'high';
    cultural_fit_notes?: string;
  };
  integrity?: {
    score: number;
    level: 'trusted' | 'questionable' | 'suspicious';
    flags: string[];
    verdict: string;
  };
  independent_assessment?: {
    hidden_strengths: string[];
    hidden_concerns: string[];
    beyond_criteria_notes: string;
    hire_recommendation: 'strong_yes' | 'yes' | 'neutral' | 'no' | 'strong_no';
  };
  analyzed_at: string;
}

export interface Candidate {
  id: string;
  vacancy_id: string;
  full_name: string;
  email: string;
  phone?: string;
  form_responses: Record<string, unknown>;
  resume_text?: string;
  linkedin_url?: string;
  portfolio_url?: string;
  submitted_at: string;
  status: 'new' | 'analyzing' | 'analyzed' | 'invited' | 'rejected' | 'error';
  ai_analysis?: AIAnalysis | null;
}

export interface SupportTicket {
  id: string;
  user_id: string;
  category: 'bug' | 'feature' | 'question' | 'billing' | 'other';
  subject: string;
  message: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  admin_reply?: string;
  created_at: string;
  updated_at: string;
}
