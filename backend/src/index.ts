import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import multer from 'multer';
import jwt from 'jsonwebtoken';
import hpp from 'hpp';

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
if (!process.env.GOOGLE_CLIENT_ID) {
  console.warn('WARNING: GOOGLE_CLIENT_ID is not set — Google OAuth will not verify audience');
}
// ─────────────────────────────────────────────────────────────────────────────

import authRouter from './routes/auth';
import vacanciesRouter from './routes/vacancies';
import candidatesRouter, { webhookRouter } from './routes/candidates';
import analyticsRouter from './routes/analytics';
import organizationsRouter from './routes/organizations';
import adminRouter from './routes/admin';
import supportRouter from './routes/support';
import tokensRouter from './routes/tokens';
import notificationsRouter from './routes/notifications';
import interviewsRouter from './routes/interviews';
import talentPoolRouter from './routes/talent-pool';
import paymentsRouter from './routes/payments';
import { extractTextFromBuffer } from './services/document-parser';
import { supabase } from './config/supabase';
import { authenticate, AuthRequest } from './middleware/auth';
import { requestLogger } from './middleware/logger';
import { generateVerificationCode, sendVerificationEmail } from './services/email';
import { isValidUUID } from './utils/validate';
import { canRequestCode, storeCode, consumeCode } from './services/candidate-verification';
import { createNotification } from './services/notify';

const app = express();
const PORT = process.env.PORT || 3000;

// ── Security headers ──────────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: false,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  noSniff: true,
  xssFilter: true,
}));

// ── Compression ──────────────────────────────────────────────────────────────
app.use(compression());

// ── Additional security headers ──────────────────────────────────────────────
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});

// ── CORS ──────────────────────────────────────────────────────────────────────
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:5173',
  'http://localhost:3000',
].filter(Boolean) as string[];

const isProduction = process.env.NODE_ENV === 'production';

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) { callback(null, true); return; }
      if (allowedOrigins.includes(origin)) { callback(null, true); return; }
      // Allow tunnel domains for testing (non-production only)
      if (!isProduction) {
        if (origin.endsWith('.trycloudflare.com') || origin.endsWith('.ngrok.io') || origin.endsWith('.ngrok-free.app')) {
          callback(null, true); return;
        }
      }
      callback(null, false);
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
  max: 50,
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

// ── HPP (HTTP Parameter Pollution protection) ─────────────────────────────────
app.use(hpp());

// ── Request logging ──────────────────────────────────────────────────────────
app.use(requestLogger);

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

// Rate limit for support tickets (prevent spam)
const supportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: { error: 'Слишком много обращений. Попробуйте через час.' },
});
app.use('/api/support', supportLimiter);

// Rate limit for token operations
const tokenLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: 'Слишком много операций с токенами.' },
});
app.use('/api/tokens', tokenLimiter);

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth', authRouter);
app.use('/api/vacancies', vacanciesRouter);
app.use('/api/candidates', candidatesRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/webhook', webhookRouter);
app.use('/api/organizations', organizationsRouter);
app.use('/api/admin', adminRouter);
app.use('/api/support', supportRouter);
app.use('/api/tokens', tokensRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/interviews', interviewsRouter);
app.use('/api/talent-pool', talentPoolRouter);
app.use('/api/payments', paymentsRouter);

// ── Resume upload (authenticated, ownership-verified) ─────────────────────────
app.post(
  '/api/candidates/:id/upload-resume',
  authenticate,
  upload.single('resume'),
  async (req: AuthRequest, res): Promise<void> => {
    try {
      if (!isValidUUID(req.params.id)) {
        res.status(400).json({ error: 'Некорректный ID' });
        return;
      }

      if (!req.file) {
        res.status(400).json({ error: 'Файл не загружен' });
        return;
      }

      const { data: candidate, error: candidateError } = await supabase
        .from('candidates')
        .select('id, vacancies!inner(created_by)')
        .eq('id', req.params.id)
        .eq('vacancies.created_by', req.userId!)
        .single();

      if (candidateError && candidateError.code !== 'PGRST116') {
        console.error('[Upload] Candidate lookup error:', candidateError.message);
      }

      if (!candidate) {
        res.status(404).json({ error: 'Кандидат не найден' });
        return;
      }

      let text: string;
      try {
        text = await extractTextFromBuffer(req.file.buffer, req.file.mimetype);
      } catch (parseErr) {
        console.error('[Upload] Document parse error:', parseErr instanceof Error ? parseErr.message : parseErr);
        res.status(422).json({ error: 'Не удалось разобрать загруженный документ' });
        return;
      }

      const { error } = await supabase
        .from('candidates')
        .update({ resume_text: text })
        .eq('id', req.params.id);

      if (error) {
        console.error('[Upload] Save error:', error.message);
        res.status(500).json({ error: 'Ошибка сохранения резюме' });
        return;
      }

      res.json({ success: true, characters: text.length });
    } catch (err) {
      console.error('[Upload] Unhandled error:', err instanceof Error ? err.message : err);
      res.status(500).json({ error: 'Ошибка загрузки файла' });
    }
  }
);

// ── Email validation helper ────────────────────────────────────────────────────
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// ── PUBLIC: Get vacancy info ───────────────────────────────────────────────────
app.get('/api/public/vacancy/:id', async (req, res): Promise<void> => {
  try {
    if (!isValidUUID(req.params.id)) {
      res.status(400).json({ error: 'Некорректный ID' });
      return;
    }

    // Try with custom_questions first; fall back if column doesn't exist yet
    let data: Record<string, unknown> | null = null;

    const withCustom = await supabase
      .from('vacancies')
      .select('id, title, description, requirements, location, salary_range, remote, status, custom_questions')
      .eq('id', req.params.id)
      .eq('status', 'active')
      .single();

    if (withCustom.error && (withCustom.error.code === '42703' || withCustom.error.code === 'PGRST204')) {
      // Column doesn't exist yet — fetch without it
      const fallback = await supabase
        .from('vacancies')
        .select('id, title, description, requirements, location, salary_range, remote, status')
        .eq('id', req.params.id)
        .eq('status', 'active')
        .single();
      if (fallback.error || !fallback.data) {
        res.status(404).json({ error: 'Вакансия не найдена или закрыта' });
        return;
      }
      data = { ...fallback.data, custom_questions: [] };
    } else if (withCustom.error || !withCustom.data) {
      if (withCustom.error && withCustom.error.code !== 'PGRST116') {
        console.error('[Public/Vacancy] Supabase error:', withCustom.error.message);
      }
      res.status(404).json({ error: 'Вакансия не найдена или закрыта' });
      return;
    } else {
      data = withCustom.data as Record<string, unknown>;
    }

    res.json({ vacancy: data });
  } catch (err) {
    console.error('[Public/Vacancy] Unhandled error:', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'Ошибка сервера' });
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
    sendVerificationEmail(sanitizedEmail, sanitizedEmail.split('@')[0], code).catch((err) => {
      console.error('[Public/CandidateCode] Email send failed:', err instanceof Error ? err.message : err);
      console.log(`[Public/CandidateCode] Verification code for ${sanitizedEmail}: ${code}`);
    });

    res.json({ success: true });
  } catch (err) {
    console.error('[Public/CandidateCode] Unhandled error:', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ── PUBLIC: Verify candidate code -> returns short-lived token ─────────────────
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
  } catch (err) {
    console.error('[Public/VerifyCandidateCode] Unhandled error:', err instanceof Error ? err.message : err);
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
      } catch (err) {
        console.error('[Apply/VerifyToken] Error:', err instanceof Error ? err.message : err);
        res.status(400).json({ error: 'Токен подтверждения истёк. Верифицируйте email заново.' });
        return;
      }

      // ── Load vacancy + check required custom questions ───────────────────────
      let vacancy: { id: string; title: string; created_by: string; custom_questions?: unknown } | null = null;
      const vacancyWithQ = await supabase
        .from('vacancies')
        .select('id, title, created_by, custom_questions')
        .eq('id', vacancyId)
        .eq('status', 'active')
        .single();

      if (vacancyWithQ.error && (vacancyWithQ.error.code === '42703' || vacancyWithQ.error.code === 'PGRST204')) {
        // Column not yet migrated — fetch without custom_questions
        const vacancyFallback = await supabase
          .from('vacancies')
          .select('id, title, created_by')
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
            try { parsedAnswersForCheck = JSON.parse(custom_answers); } catch (err) { console.error('[Apply/ParseCustomAnswers] Error:', err instanceof Error ? err.message : err); }
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
        } catch (parseErr) {
          console.error('[Public/Apply] Resume parse error:', parseErr instanceof Error ? parseErr.message : parseErr);
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
          } catch (err) {
            console.error('[Apply/ParseAnswers] Error:', err instanceof Error ? err.message : err);
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
        console.error('[Public/Apply] Insert error:', insertError.message, insertError.details);
        res.status(500).json({ error: 'Ошибка при сохранении заявки' });
        return;
      }

      // Notify vacancy owner about new candidate
      try {
        await createNotification(
          vacancy.created_by,
          'new_candidate',
          `Новый кандидат: ${sanitizedName} на ${vacancy.title}`,
          `Email: ${sanitizedEmail}`,
          `/vacancies/${vacancyId}`
        );
      } catch (notifyErr) {
        console.error('[Public/Apply] Notification error:', notifyErr);
      }

      res.status(201).json({
        success: true,
        message: 'Заявка успешно отправлена!',
        candidate_id: candidate.id,
      });
    } catch (err) {
      console.error('[Public/Apply] Unhandled error:', err instanceof Error ? err.message : err);
      res.status(500).json({ error: 'Ошибка сервера' });
    }
  }
);

// ── Bulk resume upload (up to 100 files at once) ──────────────────────────────
const bulkUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 100 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    cb(null, allowed.includes(file.mimetype));
  },
}).array('resumes', 100);

app.post('/api/vacancies/:vacancyId/bulk-upload', authenticate, (req: AuthRequest, res, next) => {
  bulkUpload(req, res, (err) => {
    if (err) {
      console.error('[BulkUpload] Multer error:', err.message);
      return res.status(400).json({ error: err.message || 'Ошибка загрузки файлов' });
    }
    next();
  });
}, async (req: AuthRequest, res): Promise<void> => {
  try {
    const vacancyId = req.params.vacancyId;

    if (!isValidUUID(vacancyId)) {
      res.status(400).json({ error: 'Некорректный ID вакансии' });
      return;
    }

    // Verify vacancy ownership
    const { data: vacancy, error: vacancyError } = await supabase
      .from('vacancies')
      .select('id, title, created_by')
      .eq('id', vacancyId)
      .eq('created_by', req.userId!)
      .single();

    if (vacancyError || !vacancy) {
      res.status(404).json({ error: 'Вакансия не найдена' });
      return;
    }

    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      res.status(400).json({ error: 'Загрузите хотя бы один файл' });
      return;
    }

    const results: { file: string; status: string; candidate_id?: string; error?: string }[] = [];

    for (const file of files) {
      try {
        // Extract text from resume
        let resumeText = '';
        try {
          resumeText = await extractTextFromBuffer(file.buffer, file.mimetype);
        } catch (err) {
          console.error('[BulkUpload/ParseFile] Error:', err instanceof Error ? err.message : err);
          results.push({ file: file.originalname, status: 'error', error: 'Не удалось разобрать файл' });
          continue;
        }

        if (!resumeText || resumeText.trim().length < 50) {
          results.push({ file: file.originalname, status: 'error', error: 'Файл пуст или слишком мал' });
          continue;
        }

        // Extract name from filename or first line of resume
        const nameFromFile = file.originalname
          .replace(/\.(pdf|doc|docx)$/i, '')
          .replace(/[_-]/g, ' ')
          .replace(/resume|cv|резюме/gi, '')
          .trim();

        const fullName = nameFromFile || resumeText.split('\n')[0]?.trim().slice(0, 100) || 'Кандидат';

        // Create candidate
        const { data: candidate, error: insertError } = await supabase
          .from('candidates')
          .insert({
            vacancy_id: vacancyId,
            full_name: fullName,
            resume_text: resumeText,
            status: 'new',
            form_responses: { source: 'bulk_upload', original_filename: file.originalname },
          })
          .select('id')
          .single();

        if (insertError) {
          results.push({ file: file.originalname, status: 'error', error: insertError.message });
        } else {
          results.push({ file: file.originalname, status: 'ok', candidate_id: candidate.id });
        }
      } catch (err) {
        console.error('[BulkUpload/ProcessFile] Error:', err instanceof Error ? err.message : err);
        results.push({ file: file.originalname, status: 'error', error: 'Неожиданная ошибка' });
      }
    }

    const success = results.filter(r => r.status === 'ok').length;
    const failed = results.filter(r => r.status === 'error').length;

    res.json({
      success: true,
      message: 'Загружено: ' + success + ' из ' + files.length + '. Ошибок: ' + failed,
      total: files.length,
      uploaded: success,
      errors: failed,
      results,
    });
  } catch (err) {
    console.error('[BulkUpload] Error:', err);
    res.status(500).json({ error: 'Ошибка массовой загрузки' });
  }
});

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', async (_req, res) => {
  const checks: Record<string, string> = { server: 'ok' };

  // Check Supabase
  try {
    const { error } = await supabase.from('users').select('id').limit(1);
    checks.database = error ? 'error' : 'ok';
  } catch {
    checks.database = 'error';
  }

  // Check AI API key
  checks.ai = process.env.ANTHROPIC_API_KEY ? 'configured' : 'missing';

  // Check email
  checks.email = process.env.EMAIL_USER ? 'configured' : 'missing';

  const allOk = Object.values(checks).every(v => v === 'ok' || v === 'configured');

  const memUsed = process.memoryUsage();
  const system = {
    memory_mb: Math.round(memUsed.heapUsed / 1024 / 1024),
    cpu_count: os.cpus().length,
    load_avg: os.loadavg()[0].toFixed(2),
    free_mem_mb: Math.round(os.freemem() / 1024 / 1024),
    total_mem_mb: Math.round(os.totalmem() / 1024 / 1024),
  };

  res.status(allOk ? 200 : 503).json({
    status: allOk ? 'healthy' : 'degraded',
    checks,
    system,
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
    version: '2.1.0',
  });
});

// ── API 404 handler — return JSON for unmatched /api/* routes ─────────────────
app.all('/api/*', (_req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

// ── Serve frontend static files (production) ──────────────────────────────────
import path from 'path';
import fs from 'fs';
import os from 'os';

const frontendDist = path.join(__dirname, '../../frontend/dist');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  // SPA fallback — all non-API routes serve index.html
  app.get('*', (_req, res) => {
    const indexPath = path.join(frontendDist, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      console.error('[Static] index.html not found at', indexPath);
      res.status(500).json({ error: 'Frontend not built' });
    }
  });
} else {
  console.warn('[Static] Frontend dist not found at', frontendDist, '— static serving disabled');
}

app.listen(PORT, () => {
  console.log('');
  console.log('  ╔══════════════════════════════════════╗');
  console.log('  ║     SOLUTION HUB v2.1       ║');
  console.log('  ║     ───────────────────────        ║');
  console.log(`  ║     Port: ${String(PORT).padEnd(27)}║`);
  console.log(`  ║     Env:  ${(process.env.NODE_ENV || 'development').padEnd(27)}║`);
  console.log('  ╚══════════════════════════════════════╝');
  console.log('');
});

export default app;
