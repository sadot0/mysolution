import { Router, Response, Request } from 'express';
import { supabase } from '../config/supabase';
import { authenticate, AuthRequest } from '../middleware/auth';
import { analyzeCandidate, batchAnalyzeCandidates, generateInterviewQuestions, Candidate, Vacancy } from '../services/ai-analyzer';

const router = Router();
router.use(authenticate);

// Hoist integrity + independent_assessment from ai_insights to top level
// (they are stored inside ai_insights to avoid needing extra DB columns)
function hoistAnalysisFields(analysis: Record<string, unknown> | null) {
  if (!analysis) return null;
  const insights = (analysis.ai_insights as Record<string, unknown> | null) ?? {};
  return {
    ...analysis,
    integrity: analysis.integrity ?? insights.integrity ?? null,
    independent_assessment: analysis.independent_assessment ?? insights.independent_assessment ?? null,
  };
}

// GET /api/candidates — all candidates across all user's vacancies
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status, vacancy_id, sort = 'date' } = req.query;

    let query = supabase
      .from('candidates')
      .select(`
        id, full_name, email, phone, status, submitted_at, resume_text,
        vacancy_id,
        vacancies!inner (id, title, created_by),
        ai_analysis (overall_score, category, summary, analyzed_at)
      `)
      .eq('vacancies.created_by', req.userId!)
      .limit(300);

    if (status) query = query.eq('status', status as string);
    if (vacancy_id) query = query.eq('vacancy_id', vacancy_id as string);

    const { data, error } = await query.order('submitted_at', { ascending: false });

    if (error) {
      res.status(500).json({ error: 'Failed to fetch candidates' });
      return;
    }

    let candidates = (data || []).map((c: Record<string, unknown>) => ({
      ...c,
      vacancies: Array.isArray(c.vacancies) ? c.vacancies[0] : c.vacancies,
      ai_analysis: Array.isArray(c.ai_analysis) ? c.ai_analysis[0] : c.ai_analysis,
    }));

    if (sort === 'score') {
      candidates.sort((a, b) => {
        const aScore = (a.ai_analysis as Record<string, unknown> | null)?.overall_score as number ?? -1;
        const bScore = (b.ai_analysis as Record<string, unknown> | null)?.overall_score as number ?? -1;
        return bScore - aScore;
      });
    }

    res.json({ candidates, total: candidates.length });
  } catch {
    res.status(500).json({ error: 'Failed to fetch candidates' });
  }
});

// GET /api/candidates/vacancy/:vacancyId
router.get('/vacancy/:vacancyId', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { sort = 'score', order = 'desc', min_score, status } = req.query;

    // Verify vacancy belongs to user
    const { data: vacancy } = await supabase
      .from('vacancies')
      .select('id')
      .eq('id', req.params.vacancyId)
      .eq('created_by', req.userId!)
      .single();

    if (!vacancy) {
      res.status(404).json({ error: 'Vacancy not found' });
      return;
    }

    let query = supabase
      .from('candidates')
      .select(`
        *,
        ai_analysis (
          overall_score,
          category,
          scores,
          strengths,
          weaknesses,
          summary,
          analyzed_at
        )
      `)
      .eq('vacancy_id', req.params.vacancyId);

    if (status) {
      query = query.eq('status', status as string);
    }

    const { data, error } = await query.order('submitted_at', { ascending: false });

    if (error) {
      res.status(500).json({ error: 'Failed to fetch candidates' });
      return;
    }

    let candidates = data || [];

    candidates = candidates.map((c: Record<string, unknown>) => {
      const analysis = Array.isArray(c.ai_analysis) ? c.ai_analysis[0] : c.ai_analysis;
      return { ...c, ai_analysis: analysis };
    });

    if (min_score) {
      const minScore = parseInt(min_score as string, 10);
      if (!isNaN(minScore)) {
        candidates = candidates.filter((c: Record<string, unknown>) => {
          const analysis = c.ai_analysis as Record<string, unknown> | null;
          return analysis && typeof analysis.overall_score === 'number' && analysis.overall_score >= minScore;
        });
      }
    }

    if (sort === 'score') {
      candidates.sort((a: Record<string, unknown>, b: Record<string, unknown>) => {
        const aScore = (a.ai_analysis as Record<string, unknown> | null)?.overall_score as number ?? 0;
        const bScore = (b.ai_analysis as Record<string, unknown> | null)?.overall_score as number ?? 0;
        return order === 'asc' ? aScore - bScore : bScore - aScore;
      });
    } else if (sort === 'date') {
      candidates.sort((a: Record<string, unknown>, b: Record<string, unknown>) => {
        const aDate = new Date(a.submitted_at as string).getTime();
        const bDate = new Date(b.submitted_at as string).getTime();
        return order === 'asc' ? aDate - bDate : bDate - aDate;
      });
    }

    res.json({ candidates, total: candidates.length });
  } catch {
    res.status(500).json({ error: 'Failed to fetch candidates' });
  }
});

// GET /api/candidates/:id
router.get('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { data, error } = await supabase
      .from('candidates')
      .select(`
        *,
        vacancies!inner (id, title, requirements, weights, created_by),
        ai_analysis (*)
      `)
      .eq('id', req.params.id)
      .eq('vacancies.created_by', req.userId!)
      .single();

    if (error || !data) {
      res.status(404).json({ error: 'Candidate not found' });
      return;
    }

    const rawAnalysis = Array.isArray(data.ai_analysis) ? (data.ai_analysis[0] ?? null) : data.ai_analysis;
    const analysis = hoistAnalysisFields(rawAnalysis as Record<string, unknown> | null);

    const candidate = {
      ...data,
      vacancies: Array.isArray(data.vacancies) ? data.vacancies[0] : data.vacancies,
      ai_analysis: analysis,
    };

    res.json({ candidate });
  } catch {
    res.status(500).json({ error: 'Failed to fetch candidate' });
  }
});

// GET /api/candidates/vacancy/:vacancyId/export — download candidates as CSV
router.get('/vacancy/:vacancyId/export', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { data: vacancy, error: vacancyError } = await supabase
      .from('vacancies')
      .select('id, title')
      .eq('id', req.params.vacancyId)
      .eq('created_by', req.userId!)
      .single();

    if (vacancyError || !vacancy) {
      res.status(404).json({ error: 'Vacancy not found' });
      return;
    }

    const { data, error } = await supabase
      .from('candidates')
      .select(`
        full_name, email, phone, status, submitted_at, resume_text,
        ai_analysis ( overall_score, category, summary, strengths, weaknesses )
      `)
      .eq('vacancy_id', req.params.vacancyId)
      .order('submitted_at', { ascending: false });

    if (error) {
      res.status(500).json({ error: 'Failed to fetch candidates' });
      return;
    }

    const escape = (val: unknown): string => {
      const s = val == null ? '' : String(val);
      if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };

    const STATUS_LABELS: Record<string, string> = {
      new: 'Новый', analyzing: 'Анализируется', analyzed: 'Проанализирован',
      invited: 'Приглашён', rejected: 'Отклонён', error: 'Ошибка',
    };
    const CATEGORY_LABELS: Record<string, string> = {
      excellent: 'Отлично', good: 'Хорошо', average: 'Средне', below_average: 'Ниже среднего',
    };

    const headers = [
      'ФИО', 'Email', 'Телефон', 'Статус', 'Дата подачи',
      'Скор (%)', 'Категория', 'Резюме', 'Сводка AI', 'Сильные стороны', 'Слабые стороны',
    ];

    const rows = (data || []).map((c: Record<string, unknown>) => {
      const a = (Array.isArray(c.ai_analysis) ? c.ai_analysis[0] : c.ai_analysis) as Record<string, unknown> | null;
      return [
        escape(c.full_name),
        escape(c.email),
        escape(c.phone),
        escape(STATUS_LABELS[c.status as string] ?? c.status),
        escape(c.submitted_at ? new Date(c.submitted_at as string).toLocaleDateString('ru-RU') : ''),
        escape(a?.overall_score ?? ''),
        escape(a?.category ? (CATEGORY_LABELS[a.category as string] ?? a.category) : ''),
        escape(c.resume_text ? 'Да' : 'Нет'),
        escape(a?.summary ?? ''),
        escape(Array.isArray(a?.strengths) ? (a!.strengths as string[]).join('; ') : ''),
        escape(Array.isArray(a?.weaknesses) ? (a!.weaknesses as string[]).join('; ') : ''),
      ].join(',');
    });

    const csv = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
    const safeTitle = String(vacancy.title).replace(/[^\w\sа-яА-Я-]/g, '').trim().replace(/\s+/g, '_');
    const date = new Date().toISOString().slice(0, 10);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="candidates_${safeTitle}_${date}.csv"`);
    res.send(csv);
  } catch {
    res.status(500).json({ error: 'Export failed' });
  }
});

// POST /api/candidates (manual creation)
router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { vacancy_id, full_name, email, phone, form_responses, resume_text, linkedin_url } = req.body;

    if (!vacancy_id || !full_name) {
      res.status(400).json({ error: 'vacancy_id and full_name are required' });
      return;
    }

    // Verify vacancy belongs to user
    const { data: vacancy } = await supabase
      .from('vacancies')
      .select('id')
      .eq('id', vacancy_id)
      .eq('created_by', req.userId!)
      .single();

    if (!vacancy) {
      res.status(404).json({ error: 'Vacancy not found' });
      return;
    }

    const { data, error } = await supabase
      .from('candidates')
      .insert({
        vacancy_id,
        full_name: String(full_name).trim().slice(0, 200),
        email: email ? String(email).trim().toLowerCase().slice(0, 200) : '',
        phone: phone ? String(phone).trim().slice(0, 30) : '',
        form_responses: form_responses || {},
        resume_text: resume_text || null,
        linkedin_url: linkedin_url || null,
        status: 'new',
      })
      .select()
      .single();

    if (error) {
      res.status(500).json({ error: 'Failed to create candidate' });
      return;
    }

    res.status(201).json({ candidate: data });
  } catch {
    res.status(500).json({ error: 'Failed to create candidate' });
  }
});

// POST /api/candidates/:id/analyze
router.post('/:id/analyze', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { data, error } = await supabase
      .from('candidates')
      .select(`
        *,
        vacancies!inner (id, title, requirements, weights, created_by)
      `)
      .eq('id', req.params.id)
      .eq('vacancies.created_by', req.userId!)
      .single();

    if (error || !data) {
      res.status(404).json({ error: 'Candidate not found' });
      return;
    }

    const candidate: Candidate = {
      id: data.id,
      full_name: data.full_name,
      email: data.email,
      form_responses: data.form_responses,
      resume_text: data.resume_text,
    };

    const vacancyData = Array.isArray(data.vacancies) ? data.vacancies[0] : data.vacancies;
    const vacancy: Vacancy = {
      id: vacancyData.id,
      title: vacancyData.title,
      requirements: vacancyData.requirements,
      weights: vacancyData.weights,
    };

    await supabase
      .from('candidates')
      .update({ status: 'analyzing' })
      .eq('id', req.params.id);

    let analysis;
    try {
      analysis = await analyzeCandidate(candidate, vacancy);
    } catch (aiError) {
      await supabase.from('candidates').update({ status: 'error' }).eq('id', req.params.id);
      res.status(500).json({
        error: 'AI analysis failed: ' + (aiError instanceof Error ? aiError.message : 'Unknown error'),
      });
      return;
    }

    await supabase.from('ai_analysis').delete().eq('candidate_id', req.params.id);

    // Store integrity + independent_assessment inside ai_insights (no extra columns needed)
    const { data: savedAnalysis, error: saveError } = await supabase
      .from('ai_analysis')
      .insert({
        candidate_id: req.params.id,
        overall_score: analysis.overall_score,
        category: analysis.category,
        scores: analysis.scores,
        strengths: analysis.strengths,
        weaknesses: analysis.weaknesses,
        summary: analysis.summary,
        recommendations: analysis.recommendations,
        ai_insights: {
          ...analysis.insights,
          integrity: analysis.integrity ?? null,
          independent_assessment: analysis.independent_assessment ?? null,
        },
      })
      .select()
      .single();

    if (saveError) {
      console.error('[Analyze] Save error:', saveError);
      await supabase.from('candidates').update({ status: 'error' }).eq('id', req.params.id);
      res.status(500).json({ error: 'Failed to save analysis' });
      return;
    }

    await supabase.from('candidates').update({ status: 'analyzed' }).eq('id', req.params.id);

    // Hoist integrity + independent_assessment to top level for frontend compatibility
    const analysisOut = savedAnalysis
      ? {
          ...savedAnalysis,
          integrity: (savedAnalysis.ai_insights as Record<string, unknown> | null)?.integrity ?? null,
          independent_assessment: (savedAnalysis.ai_insights as Record<string, unknown> | null)?.independent_assessment ?? null,
        }
      : savedAnalysis;

    res.json({ success: true, analysis: analysisOut });
  } catch {
    res.status(500).json({ error: 'Analysis failed' });
  }
});

// POST /api/candidates/:id/interview-questions
router.post('/:id/interview-questions', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { data, error } = await supabase
      .from('candidates')
      .select('*, vacancies!inner (id, title, requirements, weights, created_by)')
      .eq('id', req.params.id)
      .eq('vacancies.created_by', req.userId!)
      .single();

    if (error || !data) {
      res.status(404).json({ error: 'Candidate not found' });
      return;
    }

    const vacancyData = Array.isArray(data.vacancies) ? data.vacancies[0] : data.vacancies;

    const candidate: Candidate = {
      id: data.id,
      full_name: data.full_name,
      email: data.email,
      form_responses: data.form_responses,
      resume_text: data.resume_text,
    };
    const vacancy: Vacancy = {
      id: vacancyData.id,
      title: vacancyData.title,
      requirements: vacancyData.requirements,
      weights: vacancyData.weights,
    };

    const questions = await generateInterviewQuestions(candidate, vacancy);
    res.json({ questions });
  } catch {
    res.status(500).json({ error: 'Failed to generate interview questions' });
  }
});

// POST /api/candidates/vacancy/:vacancyId/batch-analyze
router.post('/vacancy/:vacancyId/batch-analyze', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Verify vacancy belongs to user
    const { data: vacancy, error: vacancyError } = await supabase
      .from('vacancies')
      .select('*')
      .eq('id', req.params.vacancyId)
      .eq('created_by', req.userId!)
      .single();

    if (vacancyError || !vacancy) {
      res.status(404).json({ error: 'Vacancy not found' });
      return;
    }

    // Fetch candidates that belong to this verified vacancy
    const { data: candidates, error } = await supabase
      .from('candidates')
      .select('*')
      .eq('vacancy_id', req.params.vacancyId) // enforced by vacancy ownership above
      .in('status', ['new', 'error']);

    if (error) {
      res.status(500).json({ error: 'Failed to fetch candidates' });
      return;
    }

    if (!candidates || candidates.length === 0) {
      res.json({ message: 'No candidates to analyze', processed: 0 });
      return;
    }

    await supabase
      .from('candidates')
      .update({ status: 'analyzing' })
      .in('id', candidates.map((c: Record<string, unknown>) => c.id));

    // Respond immediately, run analysis in background
    res.json({ message: 'Batch analysis started', count: candidates.length });

    const vacancyForAI: Vacancy = {
      id: vacancy.id,
      title: vacancy.title,
      requirements: vacancy.requirements,
      weights: vacancy.weights,
    };

    const results = await batchAnalyzeCandidates(
      candidates.map((c: Record<string, unknown>) => ({
        id: c.id as string,
        full_name: c.full_name as string,
        email: c.email as string,
        form_responses: c.form_responses as Record<string, unknown>,
        resume_text: c.resume_text as string | undefined,
      })),
      vacancyForAI
    );

    for (const result of results) {
      if (result.analysis) {
        await supabase.from('ai_analysis').delete().eq('candidate_id', result.candidate_id);
        await supabase.from('ai_analysis').insert({
          candidate_id: result.candidate_id,
          overall_score: result.analysis.overall_score,
          category: result.analysis.category,
          scores: result.analysis.scores,
          strengths: result.analysis.strengths,
          weaknesses: result.analysis.weaknesses,
          summary: result.analysis.summary,
          recommendations: result.analysis.recommendations,
          ai_insights: {
            ...result.analysis.insights,
            integrity: result.analysis.integrity ?? null,
            independent_assessment: result.analysis.independent_assessment ?? null,
          },
        });
        await supabase.from('candidates').update({ status: 'analyzed' }).eq('id', result.candidate_id);
      } else {
        await supabase.from('candidates').update({ status: 'error' }).eq('id', result.candidate_id);
      }
    }
  } catch {
    // Response already sent — errors here are silent background failures
  }
});

// PUT /api/candidates/:id/status — CRITICAL: ownership verified
router.put('/:id/status', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status } = req.body;

    // Only allow statuses that a user may set manually
    // 'analyzing' and 'error' are system-only statuses
    const allowedStatuses = ['new', 'analyzed', 'invited', 'rejected'];
    if (!allowedStatuses.includes(status)) {
      res.status(400).json({ error: 'Invalid status' });
      return;
    }

    // Verify the candidate belongs to the authenticated user's vacancy
    const { data: ownerCheck } = await supabase
      .from('candidates')
      .select('id, vacancies!inner(created_by)')
      .eq('id', req.params.id)
      .eq('vacancies.created_by', req.userId!)
      .single();

    if (!ownerCheck) {
      res.status(404).json({ error: 'Candidate not found' });
      return;
    }

    const { data, error } = await supabase
      .from('candidates')
      .update({ status })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error || !data) {
      res.status(500).json({ error: 'Failed to update status' });
      return;
    }

    res.json({ candidate: data });
  } catch {
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// GET /api/candidates/:id1/compare/:id2
router.get('/:id1/compare/:id2', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const [c1, c2] = await Promise.all([
      supabase
        .from('candidates')
        .select('*, vacancies!inner(created_by), ai_analysis(*)')
        .eq('id', req.params.id1)
        .eq('vacancies.created_by', req.userId!)
        .single(),
      supabase
        .from('candidates')
        .select('*, vacancies!inner(created_by), ai_analysis(*)')
        .eq('id', req.params.id2)
        .eq('vacancies.created_by', req.userId!)
        .single(),
    ]);

    if (!c1.data || !c2.data) {
      res.status(404).json({ error: 'One or both candidates not found' });
      return;
    }

    const a1 = Array.isArray(c1.data.ai_analysis) ? c1.data.ai_analysis[0] : null;
    const a2 = Array.isArray(c2.data.ai_analysis) ? c2.data.ai_analysis[0] : null;

    res.json({
      candidate1: { ...c1.data, analysis: a1 },
      candidate2: { ...c2.data, analysis: a2 },
    });
  } catch {
    res.status(500).json({ error: 'Comparison failed' });
  }
});

// ── Webhook from Google Forms ──────────────────────────────────────────────────
// Protected by WEBHOOK_SECRET. Set the same secret as a query param or
// x-webhook-secret header in your Google Apps Script webhook URL.
export const webhookRouter = Router();

webhookRouter.post('/google-form', async (req: Request, res: Response): Promise<void> => {
  try {
    // Validate webhook secret when configured (always recommended)
    const expectedSecret = process.env.WEBHOOK_SECRET;
    if (expectedSecret) {
      const providedSecret =
        (req.headers['x-webhook-secret'] as string) ||
        (req.query.secret as string);

      if (!providedSecret || providedSecret !== expectedSecret) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }
    }

    const { formId, responses } = req.body;

    if (!formId || typeof formId !== 'string') {
      res.status(400).json({ error: 'formId is required' });
      return;
    }

    const { data: vacancy } = await supabase
      .from('vacancies')
      .select('id')
      .eq('google_form_id', formId)
      .single();

    if (!vacancy) {
      res.status(404).json({ error: 'Vacancy not found for this form' });
      return;
    }

    if (!Array.isArray(responses)) {
      res.json({ success: true, inserted: 0 });
      return;
    }

    const inserted: string[] = [];
    for (const response of responses) {
      if (!response || typeof response !== 'object') continue;

      const { data: existing } = await supabase
        .from('candidates')
        .select('id')
        .eq('google_form_response_id', response.responseId)
        .single();

      if (existing) continue;

      const { data: candidate } = await supabase
        .from('candidates')
        .insert({
          vacancy_id: vacancy.id,
          full_name: String(response.full_name || 'Unknown').slice(0, 200),
          email: String(response.email || '').toLowerCase().slice(0, 200),
          phone: String(response.phone || '').slice(0, 30),
          form_responses: response.answers && typeof response.answers === 'object' ? response.answers : {},
          google_form_response_id: response.responseId || null,
          status: 'new',
        })
        .select()
        .single();

      if (candidate) inserted.push(candidate.id as string);
    }

    res.json({ success: true, inserted: inserted.length });
  } catch {
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

export default router;
