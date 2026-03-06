import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import multer from 'multer';
import jwt from 'jsonwebtoken';

dotenv.config();

// ── Startup env validation ────────────────────────────────────────────────────
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is not set');
  process.exit(1);
}
if (JWT_SECRET.length < 32) {
  console.error('FATAL: JWT_SECRET must be at least 32 characters long');
  process.exit(1);
}
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('FATAL: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  process.exit(1);
}
if (!process.env.FRONTEND_URL && process.env.NODE_ENV === 'production') {
  console.error('WARNING: FRONTEND_URL is not set in production — CORS may block requests');
}
if (!process.env.WEBHOOK_SECRET) {
  console.warn('WARNING: WEBHOOK_SECRET is not set — webhook endpoint is unauthenticated');
}
// ─────────────────────────────────────────────────────────────────────────────

import authRouter from './routes/auth';
import vacanciesRouter from './routes/vacancies';
import candidatesRouter, { webhookRouter } from './routes/candidates';
import analyticsRouter from './routes/analytics';
import organizationsRouter from './routes/organizations';
import adminRouter from './routes/admin';
import { extractTextFromBuffer } from './services/document-parser';
import { supabase } from './config/supabase';
import { authenticate, AuthRequest } from './middleware/auth';
import { generateVerificationCode, sendVerificationEmail } from './services/email';
import { canRequestCode, storeCode, consumeCode } from './services/candidate-verification';

const app = express();
const PORT = process.env.PORT || 3000;

// ── Security headers ──────────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
    },
  },
  crossOriginResourcePolicy: { policy: 'same-origin' },
}));

// ── CORS ──────────────────────────────────────────────────────────────────────
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:5173',
  'http://localhost:3000',
].filter(Boolean) as string[];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  })
);

// ── Rate limiters ─────────────────────────────────────────────────────────────
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
});
app.use('/api/', apiLimiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts, please try again later' },
});
app.use('/api/auth/', authLimiter);

const applyLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many submissions from this IP, please try again later' },
});
app.use('/api/public/apply/', applyLimiter);

// Candidate email code request (3 per 10 min per IP)
const candidateCodeLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Слишком много запросов кода. Попробуйте позже.' },
});
app.use('/api/public/request-candidate-code', candidateCodeLimiter);

const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'AI rate limit exceeded' },
});
app.use('/api/candidates/:id/analyze', aiLimiter);

// ── Body parsing ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ── File upload ───────────────────────────────────────────────────────────────
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and DOCX files are allowed'));
    }
  },
});

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth', authRouter);
app.use('/api/vacancies', vacanciesRouter);
app.use('/api/candidates', candidatesRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/webhook', webhookRouter);
app.use('/api/organizations', organizationsRouter);
app.use('/api/admin', adminRouter);

// ── Resume upload (authenticated, ownership-verified) ─────────────────────────
app.post(
  '/api/candidates/:id/upload-resume',
  authenticate,
  upload.single('resume'),
  async (req: AuthRequest, res): Promise<void> => {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
      }

      const { data: candidate } = await supabase
        .from('candidates')
        .select('id, vacancies!inner(created_by)')
        .eq('id', req.params.id)
        .eq('vacancies.created_by', req.userId!)
        .single();

      if (!candidate) {
        res.status(404).json({ error: 'Candidate not found' });
        return;
      }

      let text: string;
      try {
        text = await extractTextFromBuffer(req.file.buffer, req.file.mimetype);
      } catch {
        res.status(422).json({ error: 'Could not parse the uploaded document' });
        return;
      }

      const { error } = await supabase
        .from('candidates')
        .update({ resume_text: text })
        .eq('id', req.params.id);

      if (error) {
        res.status(500).json({ error: 'Failed to save resume' });
        return;
      }

      res.json({ success: true, characters: text.length });
    } catch {
      res.status(500).json({ error: 'Upload failed' });
    }
  }
);

// ── Email validation helper ────────────────────────────────────────────────────
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// ── PUBLIC: Get vacancy info ───────────────────────────────────────────────────
app.get('/api/public/vacancy/:id', async (req, res): Promise<void> => {
  try {
    // Try with custom_questions first; fall back if column doesn't exist yet
    let data: Record<string, unknown> | null = null;

    const withCustom = await supabase
      .from('vacancies')
      .select('id, title, description, requirements, location, salary_range, remote, status, custom_questions')
      .eq('id', req.params.id)
      .eq('status', 'active')
      .single();

    if (withCustom.error && withCustom.error.code === '42703') {
      // Column doesn't exist yet — fetch without it
      const fallback = await supabase
        .from('vacancies')
        .select('id, title, description, requirements, location, salary_range, remote, status')
        .eq('id', req.params.id)
        .eq('status', 'active')
        .single();
      if (fallback.error || !fallback.data) {
        res.status(404).json({ error: 'Vacancy not found or closed' });
        return;
      }
      data = { ...fallback.data, custom_questions: [] };
    } else if (withCustom.error || !withCustom.data) {
      res.status(404).json({ error: 'Vacancy not found or closed' });
      return;
    } else {
      data = withCustom.data as Record<string, unknown>;
    }

    res.json({ vacancy: data });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// ── PUBLIC: Request candidate verification code ───────────────────────────────
app.post('/api/public/request-candidate-code', async (req, res): Promise<void> => {
  try {
    const { email } = req.body;
    const sanitizedEmail = String(email || '').trim().toLowerCase();

    if (!sanitizedEmail || !EMAIL_REGEX.test(sanitizedEmail)) {
      res.status(400).json({ error: 'Введите корректный email' });
      return;
    }

    if (!canRequestCode(sanitizedEmail)) {
      res.status(429).json({ error: 'Подождите минуту перед повторным запросом кода' });
      return;
    }

    const code = generateVerificationCode();
    storeCode(sanitizedEmail, code);

    // Non-blocking: send email (or log in dev)
    sendVerificationEmail(sanitizedEmail, sanitizedEmail.split('@')[0], code).catch(() => {});

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ── PUBLIC: Verify candidate code → returns short-lived token ─────────────────
app.post('/api/public/verify-candidate-code', async (req, res): Promise<void> => {
  try {
    const { email, code } = req.body;
    const sanitizedEmail = String(email || '').trim().toLowerCase();

    if (!sanitizedEmail || !code) {
      res.status(400).json({ error: 'email и код обязательны' });
      return;
    }

    if (!consumeCode(sanitizedEmail, String(code).trim())) {
      res.status(400).json({ error: 'Неверный или истёкший код' });
      return;
    }

    // Issue a short-lived token that proves this email is verified
    const candidateToken = jwt.sign(
      { candidateEmail: sanitizedEmail, verified: true },
      process.env.JWT_SECRET!,
      { expiresIn: '2h' },
    );

    res.json({ success: true, candidate_token: candidateToken });
  } catch {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ── PUBLIC: Submit application ─────────────────────────────────────────────────
app.post(
  '/api/public/apply/:vacancyId',
  upload.single('resume'),
  async (req, res): Promise<void> => {
    try {
      const { vacancyId } = req.params;
      const {
        full_name,
        email,
        phone,
        experience,
        skills,
        cover_letter,
        custom_answers,
        candidate_token,
      } = req.body;

      const sanitizedName = (full_name || '').trim();
      const sanitizedEmail = (email || '').trim().toLowerCase();

      if (!sanitizedName || !sanitizedEmail) {
        res.status(400).json({ error: 'Имя и email обязательны' });
        return;
      }

      if (!EMAIL_REGEX.test(sanitizedEmail)) {
        res.status(400).json({ error: 'Некорректный email адрес' });
        return;
      }

      if (sanitizedName.length > 200) {
        res.status(400).json({ error: 'Имя слишком длинное' });
        return;
      }

      // ── Require verified candidate token ────────────────────────────────────
      if (!candidate_token) {
        res.status(400).json({ error: 'Требуется подтверждение email' });
        return;
      }
      try {
        const decoded = jwt.verify(candidate_token, process.env.JWT_SECRET!) as {
          candidateEmail: string;
          verified: boolean;
        };
        if (!decoded.verified || decoded.candidateEmail !== sanitizedEmail) {
          res.status(400).json({ error: 'Email токен не совпадает с указанным email' });
          return;
        }
      } catch {
        res.status(400).json({ error: 'Токен подтверждения истёк. Верифицируйте email заново.' });
        return;
      }

      // ── Load vacancy + check required custom questions ───────────────────────
      let vacancy: { id: string; title: string; custom_questions?: unknown } | null = null;
      const vacancyWithQ = await supabase
        .from('vacancies')
        .select('id, title, custom_questions')
        .eq('id', vacancyId)
        .eq('status', 'active')
        .single();

      if (vacancyWithQ.error && vacancyWithQ.error.code === '42703') {
        // Column not yet migrated — fetch without custom_questions
        const vacancyFallback = await supabase
          .from('vacancies')
          .select('id, title')
          .eq('id', vacancyId)
          .eq('status', 'active')
          .single();
        vacancy = vacancyFallback.data ? { ...vacancyFallback.data, custom_questions: [] } : null;
      } else {
        vacancy = vacancyWithQ.data as typeof vacancy;
      }

      if (!vacancy) {
        res.status(404).json({ error: 'Вакансия не найдена или закрыта' });
        return;
      }

      // Validate required questions
      const questions: Array<{ id: string; required: boolean }> =
        Array.isArray(vacancy.custom_questions) ? vacancy.custom_questions : [];
      const requiredIds = questions.filter((q) => q.required).map((q) => q.id);

      if (requiredIds.length > 0) {
        let parsedAnswersForCheck: Record<string, unknown> = {};
        if (custom_answers) {
          if (typeof custom_answers === 'string') {
            try { parsedAnswersForCheck = JSON.parse(custom_answers); } catch { /* ignore */ }
          } else if (typeof custom_answers === 'object') {
            parsedAnswersForCheck = custom_answers as Record<string, unknown>;
          }
        }
        for (const qid of requiredIds) {
          const ans = parsedAnswersForCheck[qid];
          const isEmpty =
            ans === undefined ||
            ans === null ||
            ans === '' ||
            (Array.isArray(ans) && ans.length === 0);
          if (isEmpty) {
            res.status(400).json({ error: 'Заполните все обязательные вопросы' });
            return;
          }
        }
      }

      // ── Parse resume ─────────────────────────────────────────────────────────
      let resumeText = '';
      if (req.file) {
        try {
          resumeText = await extractTextFromBuffer(req.file.buffer, req.file.mimetype);
        } catch {
          resumeText = '';
        }
      }

      const MAX_FIELD = 10_000;
      const formResponses: Record<string, unknown> = {};
      if (experience) formResponses['Опыт работы'] = String(experience).slice(0, MAX_FIELD);
      if (skills) formResponses['Навыки'] = String(skills).slice(0, MAX_FIELD);
      if (cover_letter) formResponses['Сопроводительное письмо'] = String(cover_letter).slice(0, MAX_FIELD);

      if (custom_answers) {
        let parsedAnswers: Record<string, unknown> = {};
        if (typeof custom_answers === 'string') {
          try {
            parsedAnswers = JSON.parse(custom_answers);
          } catch {
            parsedAnswers = { 'Ответы на вопросы': String(custom_answers).slice(0, MAX_FIELD) };
          }
        } else if (typeof custom_answers === 'object') {
          parsedAnswers = custom_answers as Record<string, unknown>;
        }
        formResponses['custom_answers'] = parsedAnswers;
      }

      const { data: candidate, error: insertError } = await supabase
        .from('candidates')
        .insert({
          vacancy_id: vacancyId,
          full_name: sanitizedName,
          email: sanitizedEmail,
          phone: (phone || '').trim().slice(0, 30),
          form_responses: formResponses,
          resume_text: resumeText || null,
          status: 'new',
        })
        .select()
        .single();

      if (insertError) {
        res.status(500).json({ error: 'Ошибка при сохранении заявки' });
        return;
      }

      res.status(201).json({
        success: true,
        message: 'Заявка успешно отправлена!',
        candidate_id: candidate.id,
      });
    } catch {
      res.status(500).json({ error: 'Ошибка сервера' });
    }
  }
);

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Recrutor AI Backend running on port ${PORT}`);
});

export default app;
