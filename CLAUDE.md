# Recrutor AI — CLAUDE.md

## Project Overview
AI-powered recruiting platform. HR managers post vacancies, candidates apply via public form, Claude AI analyzes resumes and ranks candidates.

## Structure
```
recrutor ai/
├── backend/      # Node.js + Express + TypeScript (port 3001)
├── frontend/     # React 18 + Vite + Tailwind CSS (port 5173)
└── database/     # schema.sql for Supabase PostgreSQL
```

## Dev Commands
```bash
# Backend
cd backend && npm run dev

# Frontend
cd frontend && npm run dev
```

## Tech Stack

### Backend
- Node.js + Express + TypeScript
- Supabase (PostgreSQL via `@supabase/supabase-js` with service role key — bypasses RLS)
- Claude `claude-opus-4-6` via `@anthropic-ai/sdk` (adaptive thinking, streaming)
- Google Forms API via `googleapis`
- JWT auth (7 days), bcryptjs (12 rounds), multer (file uploads)

### Frontend
- React 18 + TypeScript + Vite
- Tailwind CSS + custom CSS design system (glassmorphism, orange #FF6A00 brand)
- React Query (`@tanstack/react-query`) for data fetching
- Zustand for auth state (`useAuthStore`)
- Axios with auth interceptors (`frontend/src/utils/api.ts`)
- Recharts for analytics

## Key Files
- `backend/src/index.ts` — Express entry, all routes registered
- `backend/src/services/ai-analyzer.ts` — `analyzeCandidate()`, `generateInterviewQuestions()`
- `backend/src/services/google-forms.ts` — Google Forms create/sync
- `backend/src/routes/vacancies.ts` — Vacancy CRUD + form generation
- `backend/src/routes/candidates.ts` — Candidate CRUD + AI analysis + CSV export
- `backend/src/routes/analytics.ts` — Overview and per-vacancy analytics
- `backend/src/routes/auth.ts` — Login, register, profile update
- `backend/src/middleware/auth.ts` — JWT middleware (`AuthRequest`)
- `frontend/src/App.tsx` — React Router routes
- `frontend/src/utils/api.ts` — All API calls (vacanciesApi, candidatesApi, authApi)
- `frontend/src/utils/auth-store.ts` — Zustand auth store
- `frontend/src/utils/helpers.ts` — formatDate, getCategoryColor/Label, getStatusColor/Label
- `frontend/src/types/index.ts` — Shared TypeScript types (Vacancy, Candidate, AIAnalysis)

## Routes (Frontend)
- `/vacancies` — Vacancies list
- `/vacancies/:id` — Vacancy detail + candidates (grid/kanban toggle)
- `/candidates` — Global candidates page
- `/candidates/:id` — Candidate detail + AI analysis + interview questions
- `/analytics` — Charts and stats
- `/settings` — Profile settings
- `/apply/:vacancyId` — Public apply form (no auth)

## AI Scoring Formula
```
overall = hard_skills×40% + experience×25% + education×15%
        + soft_skills×10% + languages×5% + culture_fit×5%
```
Categories: `excellent` (90+), `good` (75–89), `average` (60–74), `below` (<60)

## Environment Variables (backend/.env)
```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
GOOGLE_SERVICE_ACCOUNT_JSON=   # full JSON string
JWT_SECRET=
FRONTEND_URL=http://localhost:5173
PORT=3001
```

## Code Rules

### General
- Always run `npx tsc --noEmit` after changes in both `backend/` and `frontend/`
- No unused imports — TypeScript strict mode is on
- Don't add libraries without asking — prefer solving with existing stack

### Backend
- All routes require `authenticate` middleware except `/auth/login`, `/auth/register`, `/apply/:vacancyId`
- Use `supabase` (service role) for all DB queries — no direct SQL
- AI calls go through `backend/src/services/ai-analyzer.ts` only
- Route files: one router per domain (vacancies, candidates, analytics, auth)

### Frontend
- Design system: use `.card`, `.btn-primary`, `.btn-secondary`, `.btn-danger`, `.input`, `.label`, `.select-premium` CSS classes
- Brand color: `#FF6A00` / `#FF9A3C` (orange gradient)
- Background: near-black `#080502` with glassmorphism cards
- Icons: lucide-react only
- No inline `style` for colors that already have a utility class
- API calls only via `frontend/src/utils/api.ts` — never use fetch/axios directly in components
- All pages wrap content in `<Layout>` component

### Database (Supabase)
- Tables: `users`, `vacancies`, `candidates`, `ai_analysis`
- `candidates` links to `vacancies` via `vacancy_id`
- `ai_analysis` links to `candidates` via `candidate_id` (1:1)
- Filter by ownership: `vacancies.created_by = req.userId` (use `!inner` join for candidates)
