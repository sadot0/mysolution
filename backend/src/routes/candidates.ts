import { Router, Response, Request } from 'express';
import { supabase } from '../config/supabase';
import { authenticate, AuthRequest } from '../middleware/auth';
import { analyzeCandidate, batchAnalyzeCandidates, generateInterviewQuestions, Candidate, Vacancy } from '../services/ai-analyzer';
import { executeAutoRules } from '../services/auto-actions';
import { createNotification } from '../services/notify';
import { isValidUUID, sanitizeString, sanitizeEmail } from '../utils/validate';

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

// ── Compare candidates (multi) ──
router.post('/compare', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { candidate_ids } = req.body;

    if (!Array.isArray(candidate_ids) || candidate_ids.length < 2 || candidate_ids.length > 5) {
      res.status(400).json({ error: 'Выберите от 2 до 5 кандидатов для сравнения' });
      return;
    }

    const { data: candidates, error } = await supabase
      .from('candidates')
      .select('id, full_name, email, status, submitted_at, ai_analysis(*), vacancies!inner(title, created_by)')
      .in('id', candidate_ids)
      .eq('vacancies.created_by', req.userId!);

    if (error || !candidates?.length) {
      res.status(404).json({ error: 'Кандидаты не найдены' });
      return;
    }

    // Normalize nested arrays
    const normalized = candidates.map((c: Record<string, unknown>) => ({
      ...c,
      ai_analysis: Array.isArray(c.ai_analysis) ? c.ai_analysis[0] ?? null : c.ai_analysis,
      vacancies: Array.isArray(c.vacancies) ? c.vacancies[0] : c.vacancies,
    }));

    // Generate AI comparison summary
    const analyzed = normalized.filter((c) => c.ai_analysis) as Record<string, unknown>[];
    let aiComparison = null;

    if (analyzed.length >= 2) {
      const best = analyzed.reduce((a, b) => {
        const aAnalysis = a.ai_analysis as Record<string, unknown> | null;
        const bAnalysis = b.ai_analysis as Record<string, unknown> | null;
        return ((aAnalysis?.overall_score as number) || 0) > ((bAnalysis?.overall_score as number) || 0) ? a : b;
      });
      const bestAnalysis = best.ai_analysis as Record<string, unknown> | null;
      aiComparison = {
        recommended: best.id as string,
        recommended_name: best.full_name as string,
        reason: `${best.full_name} имеет наивысший общий балл (${bestAnalysis?.overall_score}/100) среди выбранных кандидатов.`,
      };
    }

    res.json({ candidates: normalized, comparison: aiComparison });
  } catch (err) {
    console.error('[Candidates/Compare] Error:', err);
    res.status(500).json({ error: 'Ошибка сравнения' });
  }
});

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
      console.error('[Candidates/List] Supabase error:', error.message);
      res.status(500).json({ error: 'Ошибка загрузки кандидатов' });
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
  } catch (err) {
    console.error('[Candidates/List] Unhandled error:', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'Ошибка загрузки кандидатов' });
  }
});

// GET /api/candidates/vacancy/:vacancyId
router.get('/vacancy/:vacancyId', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!isValidUUID(req.params.vacancyId)) { res.status(400).json({ error: 'Некорректный ID вакансии' }); return; }
    const { sort = 'score', order = 'desc', min_score, status } = req.query;

    // Verify vacancy belongs to user
    const { data: vacancy, error: vacancyError } = await supabase
      .from('vacancies')
      .select('id')
      .eq('id', req.params.vacancyId)
      .eq('created_by', req.userId!)
      .single();

    if (vacancyError && vacancyError.code !== 'PGRST116') {
      console.error('[Candidates/VacancyList] Vacancy lookup error:', vacancyError.message);
    }

    if (!vacancy) {
      res.status(404).json({ error: 'Вакансия не найдена' });
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
      console.error('[Candidates/VacancyList] Supabase error:', error.message);
      res.status(500).json({ error: 'Ошибка загрузки кандидатов' });
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
  } catch (err) {
    console.error('[Candidates/VacancyList] Unhandled error:', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'Ошибка загрузки кандидатов' });
  }
});

// GET /api/candidates/:id
router.get('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!isValidUUID(req.params.id)) { res.status(400).json({ error: 'Некорректный ID' }); return; }
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
      if (error && error.code !== 'PGRST116') {
        console.error('[Candidates/Get] Supabase error:', error.message);
      }
      res.status(404).json({ error: 'Кандидат не найден' });
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
  } catch (err) {
    console.error('[Candidates/Get] Unhandled error:', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'Ошибка загрузки кандидата' });
  }
});

// GET /api/candidates/vacancy/:vacancyId/export — download candidates as CSV
router.get('/vacancy/:vacancyId/export', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!isValidUUID(req.params.vacancyId)) { res.status(400).json({ error: 'Некорректный ID вакансии' }); return; }
    const { data: vacancy, error: vacancyError } = await supabase
      .from('vacancies')
      .select('id, title')
      .eq('id', req.params.vacancyId)
      .eq('created_by', req.userId!)
      .single();

    if (vacancyError || !vacancy) {
      if (vacancyError && vacancyError.code !== 'PGRST116') {
        console.error('[Candidates/Export] Vacancy lookup error:', vacancyError.message);
      }
      res.status(404).json({ error: 'Вакансия не найдена' });
      return;
    }

    // Check and deduct tokens before CSV export
    const { data: csvUserData } = await supabase
      .from('users')
      .select('token_balance, is_whitelisted, tokens_used')
      .eq('id', req.userId!)
      .single();

    const csvBalance = csvUserData?.token_balance ?? 100;
    const csvIsWhitelisted = csvUserData?.is_whitelisted ?? false;
    const CSV_EXPORT_COST = 2;

    if (!csvIsWhitelisted && csvBalance < CSV_EXPORT_COST) {
      res.status(402).json({
        error: 'Недостаточно токенов для экспорта. Пополните баланс.',
        balance: csvBalance,
        cost: CSV_EXPORT_COST
      });
      return;
    }

    if (!csvIsWhitelisted) {
      await supabase
        .from('users')
        .update({
          token_balance: csvBalance - CSV_EXPORT_COST,
          tokens_used: (csvUserData?.tokens_used ?? 0) + CSV_EXPORT_COST
        })
        .eq('id', req.userId!);

      await supabase.from('token_transactions').insert({
        user_id: req.userId,
        type: 'usage',
        amount: -CSV_EXPORT_COST,
        balance_after: csvBalance - CSV_EXPORT_COST,
        description: 'CSV экспорт кандидатов',
      }).then(() => {});

      await supabase.from('usage_logs').insert({
        user_id: req.userId,
        action: 'csv_export',
        tokens_cost: CSV_EXPORT_COST,
      }).then(() => {});
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
      console.error('[Candidates/Export] Supabase error:', error.message);
      res.status(500).json({ error: 'Ошибка экспорта кандидатов' });
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
  } catch (err) {
    console.error('[Candidates/Export] Unhandled error:', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'Ошибка экспорта' });
  }
});

// POST /api/candidates (manual creation)
router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { vacancy_id, full_name, email, phone, form_responses, resume_text, linkedin_url } = req.body;

    if (!vacancy_id || !full_name) {
      res.status(400).json({ error: 'vacancy_id и имя кандидата обязательны' });
      return;
    }

    if (!isValidUUID(vacancy_id)) {
      res.status(400).json({ error: 'Некорректный ID вакансии' });
      return;
    }

    const safeName = sanitizeString(full_name, 255);
    const safeEmail = sanitizeEmail(email);

    // Verify vacancy belongs to user
    const { data: vacancy, error: vacancyError } = await supabase
      .from('vacancies')
      .select('id')
      .eq('id', vacancy_id)
      .eq('created_by', req.userId!)
      .single();

    if (vacancyError && vacancyError.code !== 'PGRST116') {
      console.error('[Candidates/Create] Vacancy lookup error:', vacancyError.message);
    }

    if (!vacancy) {
      res.status(404).json({ error: 'Вакансия не найдена' });
      return;
    }

    const { data, error } = await supabase
      .from('candidates')
      .insert({
        vacancy_id,
        full_name: safeName || String(full_name).trim().slice(0, 200),
        email: safeEmail || '',
        phone: phone ? String(phone).trim().slice(0, 30) : '',
        form_responses: form_responses || {},
        resume_text: resume_text || null,
        linkedin_url: linkedin_url || null,
        status: 'new',
      })
      .select()
      .single();

    if (error) {
      console.error('[Candidates/Create] Supabase insert error:', error.message, error.details);
      res.status(500).json({ error: 'Ошибка создания кандидата' });
      return;
    }

    res.status(201).json({ candidate: data });
  } catch (err) {
    console.error('[Candidates/Create] Unhandled error:', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'Ошибка создания кандидата' });
  }
});

// POST /api/candidates/:id/analyze
router.post('/:id/analyze', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!isValidUUID(req.params.id)) { res.status(400).json({ error: 'Некорректный ID' }); return; }
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
      if (error && error.code !== 'PGRST116') {
        console.error('[Candidates/Analyze] Lookup error:', error.message);
      }
      res.status(404).json({ error: 'Кандидат не найден' });
      return;
    }

    // Check and deduct tokens before analysis
    const { data: userData } = await supabase
      .from('users')
      .select('token_balance, is_whitelisted, tokens_used')
      .eq('id', req.userId!)
      .single();

    const balance = userData?.token_balance ?? 100;
    const isWhitelisted = userData?.is_whitelisted ?? false;
    const AI_ANALYSIS_COST = 10;

    if (!isWhitelisted && balance < AI_ANALYSIS_COST) {
      res.status(402).json({
        error: 'Недостаточно токенов для анализа. Пополните баланс.',
        balance,
        cost: AI_ANALYSIS_COST
      });
      return;
    }

    // Deduct tokens
    if (!isWhitelisted) {
      await supabase
        .from('users')
        .update({
          token_balance: balance - AI_ANALYSIS_COST,
          tokens_used: (userData?.tokens_used ?? 0) + AI_ANALYSIS_COST
        })
        .eq('id', req.userId!);

      // Log transaction
      await supabase.from('token_transactions').insert({
        user_id: req.userId,
        type: 'usage',
        amount: -AI_ANALYSIS_COST,
        balance_after: balance - AI_ANALYSIS_COST,
        description: `AI анализ кандидата: ${data.full_name}`,
      }).then(() => {});

      // Log usage
      await supabase.from('usage_logs').insert({
        user_id: req.userId,
        action: 'ai_analysis',
        tokens_cost: AI_ANALYSIS_COST,
      }).then(() => {});
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

    const { error: statusError } = await supabase
      .from('candidates')
      .update({ status: 'analyzing' })
      .eq('id', req.params.id);

    if (statusError) {
      console.error('[Candidates/Analyze] Failed to set analyzing status:', statusError.message);
    }

    let analysis;
    try {
      analysis = await analyzeCandidate(candidate, vacancy);
    } catch (aiError) {
      console.error('[Candidates/Analyze] AI analysis failed:', aiError instanceof Error ? aiError.message : aiError);
      await supabase.from('candidates').update({ status: 'error' }).eq('id', req.params.id);
      res.status(500).json({
        error: 'Ошибка AI анализа: ' + (aiError instanceof Error ? aiError.message : 'Неизвестная ошибка'),
      });
      return;
    }

    const { error: deleteError } = await supabase.from('ai_analysis').delete().eq('candidate_id', req.params.id);
    if (deleteError) {
      console.error('[Candidates/Analyze] Failed to delete old analysis:', deleteError.message);
    }

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
      console.error('[Candidates/Analyze] Save error:', saveError.message, saveError.details);
      await supabase.from('candidates').update({ status: 'error' }).eq('id', req.params.id);
      res.status(500).json({ error: 'Ошибка сохранения анализа' });
      return;
    }

    const { error: analyzedStatusError } = await supabase.from('candidates').update({ status: 'analyzed' }).eq('id', req.params.id);
    if (analyzedStatusError) {
      console.error('[Candidates/Analyze] Failed to set analyzed status:', analyzedStatusError.message);
    }

    // Notify: AI analysis completed
    try {
      await createNotification(
        req.userId!,
        'ai_analysis',
        `AI анализ завершён: ${data.full_name} — ${analysis.overall_score}/100`,
        `Категория: ${analysis.category}. ${analysis.summary?.slice(0, 120) ?? ''}`,
        `/candidates/${req.params.id}`
      );
    } catch (notifyErr) {
      console.error('[Candidates/Analyze] Notification error:', notifyErr);
    }

    // Execute auto rules after analysis
    try {
      const autoActions = await executeAutoRules(String(req.params.id), req.userId!);
      if (autoActions.length > 0) {
        console.log("[AutoActions] Executed:", autoActions);
      }
    } catch (autoErr) {
      console.error("[AutoActions] Error:", autoErr);
    }
    // Hoist integrity + independent_assessment to top level for frontend compatibility
    const analysisOut = savedAnalysis
      ? {
          ...savedAnalysis,
          integrity: (savedAnalysis.ai_insights as Record<string, unknown> | null)?.integrity ?? null,
          independent_assessment: (savedAnalysis.ai_insights as Record<string, unknown> | null)?.independent_assessment ?? null,
        }
      : savedAnalysis;

    res.json({ success: true, analysis: analysisOut });
  } catch (err) {
    console.error('[Candidates/Analyze] Unhandled error:', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'Ошибка анализа кандидата' });
  }
});

// POST /api/candidates/:id/interview-questions
router.post('/:id/interview-questions', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!isValidUUID(req.params.id)) { res.status(400).json({ error: 'Некорректный ID' }); return; }
    const { data, error } = await supabase
      .from('candidates')
      .select('*, vacancies!inner (id, title, requirements, weights, created_by)')
      .eq('id', req.params.id)
      .eq('vacancies.created_by', req.userId!)
      .single();

    if (error || !data) {
      if (error && error.code !== 'PGRST116') {
        console.error('[Candidates/InterviewQuestions] Lookup error:', error.message);
      }
      res.status(404).json({ error: 'Кандидат не найден' });
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

    // Check and deduct tokens before generating interview questions
    const { data: iqUserData } = await supabase
      .from('users')
      .select('token_balance, is_whitelisted, tokens_used')
      .eq('id', req.userId!)
      .single();

    const iqBalance = iqUserData?.token_balance ?? 100;
    const iqIsWhitelisted = iqUserData?.is_whitelisted ?? false;
    const IQ_COST = 5;

    if (!iqIsWhitelisted && iqBalance < IQ_COST) {
      res.status(402).json({
        error: 'Недостаточно токенов для генерации вопросов. Пополните баланс.',
        balance: iqBalance,
        cost: IQ_COST
      });
      return;
    }

    if (!iqIsWhitelisted) {
      await supabase
        .from('users')
        .update({
          token_balance: iqBalance - IQ_COST,
          tokens_used: (iqUserData?.tokens_used ?? 0) + IQ_COST
        })
        .eq('id', req.userId!);

      await supabase.from('token_transactions').insert({
        user_id: req.userId,
        type: 'usage',
        amount: -IQ_COST,
        balance_after: iqBalance - IQ_COST,
        description: `Генерация вопросов для интервью: ${data.full_name}`,
      }).then(() => {});

      await supabase.from('usage_logs').insert({
        user_id: req.userId,
        action: 'interview_questions',
        tokens_cost: IQ_COST,
      }).then(() => {});
    }

    const questions = await generateInterviewQuestions(candidate, vacancy);
    res.json({ questions });
  } catch (err) {
    console.error('[Candidates/InterviewQuestions] Unhandled error:', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'Ошибка генерации вопросов для интервью' });
  }
});

// POST /api/candidates/vacancy/:vacancyId/batch-analyze
router.post('/vacancy/:vacancyId/batch-analyze', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!isValidUUID(req.params.vacancyId)) { res.status(400).json({ error: 'Некорректный ID вакансии' }); return; }
    // Verify vacancy belongs to user
    const { data: vacancy, error: vacancyError } = await supabase
      .from('vacancies')
      .select('*')
      .eq('id', req.params.vacancyId)
      .eq('created_by', req.userId!)
      .single();

    if (vacancyError || !vacancy) {
      if (vacancyError && vacancyError.code !== 'PGRST116') {
        console.error('[Candidates/BatchAnalyze] Vacancy lookup error:', vacancyError.message);
      }
      res.status(404).json({ error: 'Вакансия не найдена' });
      return;
    }

    // Fetch candidates that belong to this verified vacancy
    const { data: candidates, error } = await supabase
      .from('candidates')
      .select('*')
      .eq('vacancy_id', req.params.vacancyId) // enforced by vacancy ownership above
      .in('status', ['new', 'error']);

    if (error) {
      console.error('[Candidates/BatchAnalyze] Fetch error:', error.message);
      res.status(500).json({ error: 'Ошибка загрузки кандидатов' });
      return;
    }

    if (!candidates || candidates.length === 0) {
      res.json({ message: 'Нет кандидатов для анализа', processed: 0 });
      return;
    }

    const { error: batchStatusError } = await supabase
      .from('candidates')
      .update({ status: 'analyzing' })
      .in('id', candidates.map((c: Record<string, unknown>) => c.id));

    if (batchStatusError) {
      console.error('[Candidates/BatchAnalyze] Failed to set analyzing status:', batchStatusError.message);
    }

    // Respond immediately, run analysis in background
    res.json({ message: 'Пакетный анализ запущен', count: candidates.length });

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
        const { error: delErr } = await supabase.from('ai_analysis').delete().eq('candidate_id', result.candidate_id);
        if (delErr) {
          console.error('[Candidates/BatchAnalyze] Delete old analysis error for', result.candidate_id, ':', delErr.message);
        }
        const { error: insertErr } = await supabase.from('ai_analysis').insert({
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
        if (insertErr) {
          console.error('[Candidates/BatchAnalyze] Insert analysis error for', result.candidate_id, ':', insertErr.message);
          await supabase.from('candidates').update({ status: 'error' }).eq('id', result.candidate_id);
        } else {
          await supabase.from('candidates').update({ status: 'analyzed' }).eq('id', result.candidate_id);
        }
      } else {
        console.error('[Candidates/BatchAnalyze] Analysis failed for candidate:', result.candidate_id);
        await supabase.from('candidates').update({ status: 'error' }).eq('id', result.candidate_id);
      }
    }
  } catch (err) {
    // Response already sent — log background failures
    console.error('[Candidates/BatchAnalyze] Background error:', err instanceof Error ? err.message : err);
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
      res.status(400).json({ error: 'Недопустимый статус' });
      return;
    }

    // Verify the candidate belongs to the authenticated user's vacancy
    const { data: ownerCheck, error: ownerError } = await supabase
      .from('candidates')
      .select('id, vacancies!inner(created_by)')
      .eq('id', req.params.id)
      .eq('vacancies.created_by', req.userId!)
      .single();

    if (ownerError && ownerError.code !== 'PGRST116') {
      console.error('[Candidates/UpdateStatus] Ownership check error:', ownerError.message);
    }

    if (!ownerCheck) {
      res.status(404).json({ error: 'Кандидат не найден' });
      return;
    }

    const { data, error } = await supabase
      .from('candidates')
      .update({ status })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error || !data) {
      console.error('[Candidates/UpdateStatus] Update error:', error?.message);
      res.status(500).json({ error: 'Ошибка обновления статуса' });
      return;
    }

    res.json({ candidate: data });
  } catch (err) {
    console.error('[Candidates/UpdateStatus] Unhandled error:', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'Ошибка обновления статуса' });
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

    if (c1.error && c1.error.code !== 'PGRST116') {
      console.error('[Candidates/Compare] Lookup error (c1):', c1.error.message);
    }
    if (c2.error && c2.error.code !== 'PGRST116') {
      console.error('[Candidates/Compare] Lookup error (c2):', c2.error.message);
    }

    if (!c1.data || !c2.data) {
      res.status(404).json({ error: 'Один или оба кандидата не найдены' });
      return;
    }

    const a1 = Array.isArray(c1.data.ai_analysis) ? c1.data.ai_analysis[0] : null;
    const a2 = Array.isArray(c2.data.ai_analysis) ? c2.data.ai_analysis[0] : null;

    res.json({
      candidate1: { ...c1.data, analysis: a1 },
      candidate2: { ...c2.data, analysis: a2 },
    });
  } catch (err) {
    console.error('[Candidates/Compare] Unhandled error:', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'Ошибка сравнения кандидатов' });
  }
});

// ── PDF Report ──
router.get('/:id/report', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { data: candidate, error } = await supabase
      .from('candidates')
      .select('*, ai_analysis(*), vacancies!inner(title, created_by)')
      .eq('id', req.params.id)
      .eq('vacancies.created_by', req.userId!)
      .single();

    if (error || !candidate) {
      res.status(404).json({ error: 'Кандидат не найден' });
      return;
    }

    const { generateCandidateReport } = await import('../services/pdf-report');

    const rawAnalysis = Array.isArray(candidate.ai_analysis) ? candidate.ai_analysis[0] : candidate.ai_analysis;
    const vacancyData = Array.isArray(candidate.vacancies) ? candidate.vacancies[0] : candidate.vacancies;

    const reportData = {
      full_name: candidate.full_name,
      email: candidate.email,
      phone: candidate.phone,
      status: candidate.status,
      submitted_at: candidate.submitted_at,
      vacancy_title: vacancyData?.title,
      ai_analysis: rawAnalysis ? {
        overall_score: rawAnalysis.overall_score,
        category: rawAnalysis.category,
        scores: rawAnalysis.scores,
        strengths: rawAnalysis.strengths,
        weaknesses: rawAnalysis.weaknesses,
        summary: rawAnalysis.summary,
        recommendations: rawAnalysis.recommendations,
      } : undefined,
    };

    const doc = generateCandidateReport(reportData);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="candidate-${candidate.full_name.replace(/\s+/g, '_')}.pdf"`);

    doc.pipe(res);
    doc.end();
  } catch (err) {
    console.error('[Candidates/Report] Error:', err);
    res.status(500).json({ error: 'Ошибка генерации отчёта' });
  }
});


// ── Auto rules CRUD ──────────────────────────────────────────────────────────
router.get("/rules/list", async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { data } = await supabase.from("auto_rules").select("*").eq("user_id", req.userId!);
    res.json({ rules: data || [] });
  } catch (err) {
    console.error('[Candidates/ListRules] Error:', err instanceof Error ? err.message : err);
    res.json({ rules: [] });
  }
});

router.post("/rules", async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { vacancy_id, condition_type, condition_value, action_type } = req.body;
    const { data, error } = await supabase.from("auto_rules").insert({
      user_id: req.userId!,
      vacancy_id: vacancy_id || null,
      condition_type,
      condition_value: condition_value || 0,
      action_type,
      enabled: true,
    }).select().single();
    if (error) { res.status(500).json({ error: error.message }); return; }
    res.json({ rule: data });
  } catch (err) {
    console.error("[Rules] Error:", err);
    res.status(500).json({ error: "Ошибка" });
  }
});

router.delete("/rules/:ruleId", async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await supabase.from("auto_rules").delete().eq("id", req.params.ruleId).eq("user_id", req.userId!);
    res.json({ success: true });
  } catch (err) {
    console.error('[Candidates/DeleteRule] Error:', err instanceof Error ? err.message : err);
    res.status(500).json({ error: "Ошибка" });
  }
});


// ── Send email to candidate ──────────────────────────────────────────────────
router.post('/:id/send-email', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { template, interview_date, interview_link, salary, start_date } = req.body;

    if (!template || !['invite', 'reject', 'offer'].includes(template)) {
      res.status(400).json({ error: 'Укажите шаблон: invite, reject или offer' });
      return;
    }

    const { data: candidate, error } = await supabase
      .from('candidates')
      .select('*, vacancies!inner(title, created_by)')
      .eq('id', req.params.id)
      .eq('vacancies.created_by', req.userId!)
      .single();

    if (error || !candidate) {
      res.status(404).json({ error: 'Кандидат не найден' });
      return;
    }

    if (!candidate.email) {
      res.status(400).json({ error: 'У кандидата нет email' });
      return;
    }

    // Get company name
    const { data: user } = await supabase.from('users').select('company_name, name').eq('id', req.userId!).single();
    const companyName = user?.company_name || user?.name || 'Компания';

    const { inviteEmail, rejectEmail, offerEmail } = await import('../services/email-templates');

    const vacancyData = Array.isArray(candidate.vacancies) ? candidate.vacancies[0] : candidate.vacancies;
    const vacancyTitle = vacancyData.title as string;

    let html: string;
    let subject: string;

    switch (template) {
      case 'invite':
        html = inviteEmail(candidate.full_name as string, vacancyTitle, companyName, interview_date, interview_link);
        subject = `Приглашение на интервью — ${vacancyTitle}`;
        break;
      case 'reject':
        html = rejectEmail(candidate.full_name as string, vacancyTitle, companyName);
        subject = `Ваша заявка — ${vacancyTitle}`;
        break;
      case 'offer':
        html = offerEmail(candidate.full_name as string, vacancyTitle, companyName, salary, start_date);
        subject = `Предложение о работе — ${vacancyTitle}`;
        break;
      default:
        res.status(400).json({ error: 'Неизвестный шаблон' });
        return;
    }

    // Send via nodemailer
    const nodemailer = await import('nodemailer');

    let transporter;
    if (process.env.EMAIL_SMTP_HOST) {
      transporter = nodemailer.createTransport({
        host: process.env.EMAIL_SMTP_HOST,
        port: Number(process.env.EMAIL_SMTP_PORT) || 587,
        secure: process.env.EMAIL_SMTP_SECURE === 'true',
        auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
      });
    } else if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
      });
    } else {
      console.log(`\n[DEV] Would send "${template}" email to ${candidate.email}:\nSubject: ${subject}\n`);
      // Update status even in dev mode
      const newStatus = template === 'invite' ? 'invited' : template === 'reject' ? 'rejected' : 'invited';
      await supabase.from('candidates').update({ status: newStatus }).eq('id', req.params.id);
      res.json({ success: true, message: `Email отправлен на ${candidate.email} (dev mode — logged to console)` });
      return;
    }

    const fromEmail = process.env.FROM_EMAIL || process.env.EMAIL_USER;
    await transporter.sendMail({
      from: fromEmail,
      to: candidate.email as string,
      subject,
      html,
    });

    // Update candidate status
    const newStatus = template === 'invite' ? 'invited' : template === 'reject' ? 'rejected' : 'invited';
    await supabase.from('candidates').update({ status: newStatus }).eq('id', req.params.id);

    res.json({ success: true, message: `Email отправлен на ${candidate.email}` });
  } catch (err) {
    console.error('[Candidates/SendEmail] Error:', err);
    res.status(500).json({ error: 'Ошибка отправки email' });
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
        console.warn('[Webhook] Forbidden: invalid or missing webhook secret');
        res.status(403).json({ error: 'Forbidden' });
        return;
      }
    }

    const { formId, responses } = req.body;

    if (!formId || typeof formId !== 'string') {
      res.status(400).json({ error: 'formId is required' });
      return;
    }

    const { data: vacancy, error: vacancyError } = await supabase
      .from('vacancies')
      .select('id')
      .eq('google_form_id', formId)
      .single();

    if (vacancyError && vacancyError.code !== 'PGRST116') {
      console.error('[Webhook] Vacancy lookup error:', vacancyError.message);
    }

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

      const { data: candidate, error: insertError } = await supabase
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

      if (insertError) {
        console.error('[Webhook] Insert error for response', response.responseId, ':', insertError.message);
        continue;
      }

      if (candidate) inserted.push(candidate.id as string);
    }

    res.json({ success: true, inserted: inserted.length });
  } catch (err) {
    console.error('[Webhook] Unhandled error:', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});


// GET /api/candidates/vacancy/:vacancyId/export-excel — download candidates as Excel
router.get('/vacancy/:vacancyId/export-excel', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { data: vacancy, error: vacancyError } = await supabase
      .from('vacancies')
      .select('id, title')
      .eq('id', req.params.vacancyId)
      .eq('created_by', req.userId!)
      .single();

    if (vacancyError || !vacancy) {
      res.status(404).json({ error: 'Вакансия не найдена' });
      return;
    }

    // Check and deduct tokens
    const { data: xlsxUserData } = await supabase
      .from('users')
      .select('token_balance, is_whitelisted, tokens_used')
      .eq('id', req.userId!)
      .single();

    const xlsxBalance = xlsxUserData?.token_balance ?? 100;
    const xlsxIsWhitelisted = xlsxUserData?.is_whitelisted ?? false;
    const XLSX_EXPORT_COST = 3;

    if (!xlsxIsWhitelisted && xlsxBalance < XLSX_EXPORT_COST) {
      res.status(402).json({
        error: 'Недостаточно токенов для экспорта. Пополните баланс.',
        balance: xlsxBalance,
        cost: XLSX_EXPORT_COST
      });
      return;
    }

    if (!xlsxIsWhitelisted) {
      await supabase
        .from('users')
        .update({
          token_balance: xlsxBalance - XLSX_EXPORT_COST,
          tokens_used: (xlsxUserData?.tokens_used ?? 0) + XLSX_EXPORT_COST
        })
        .eq('id', req.userId!);

      await supabase.from('token_transactions').insert({
        user_id: req.userId,
        type: 'usage',
        amount: -XLSX_EXPORT_COST,
        balance_after: xlsxBalance - XLSX_EXPORT_COST,
        description: 'Excel экспорт кандидатов',
      }).then(() => {});

      await supabase.from('usage_logs').insert({
        user_id: req.userId,
        action: 'excel_export',
        tokens_cost: XLSX_EXPORT_COST,
      }).then(() => {});
    }

    const { data, error } = await supabase
      .from('candidates')
      .select(`
        full_name, email, phone, status, submitted_at,
        ai_analysis ( overall_score, category, strengths, weaknesses )
      `)
      .eq('vacancy_id', req.params.vacancyId)
      .order('submitted_at', { ascending: false });

    if (error) {
      console.error('[Candidates/ExportExcel] Supabase error:', error.message);
      res.status(500).json({ error: 'Ошибка экспорта кандидатов' });
      return;
    }

    const STATUS_LABELS: Record<string, string> = {
      new: 'Новый', analyzing: 'Анализируется', analyzed: 'Проанализирован',
      invited: 'Приглашён', rejected: 'Отклонён', error: 'Ошибка',
    };
    const CATEGORY_LABELS: Record<string, string> = {
      excellent: 'Отлично', good: 'Хорошо', average: 'Средне', below_average: 'Ниже среднего',
    };

    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();
    const sheetData = (data || []).map((c: Record<string, unknown>) => {
      const a = (Array.isArray(c.ai_analysis) ? c.ai_analysis[0] : c.ai_analysis) as Record<string, unknown> | null;
      return {
        'Имя': c.full_name as string,
        'Email': c.email as string,
        'Телефон': (c.phone as string) || '',
        'Балл': a?.overall_score ?? '',
        'Категория': a?.category ? (CATEGORY_LABELS[a.category as string] ?? a.category) : '',
        'Статус': STATUS_LABELS[c.status as string] ?? c.status,
        'Сильные стороны': Array.isArray(a?.strengths) ? (a!.strengths as string[]).join(', ') : '',
        'Слабые стороны': Array.isArray(a?.weaknesses) ? (a!.weaknesses as string[]).join(', ') : '',
        'Дата подачи': c.submitted_at ? new Date(c.submitted_at as string).toLocaleDateString('ru-RU') : '',
      };
    });
    const ws = XLSX.utils.json_to_sheet(sheetData);
    XLSX.utils.book_append_sheet(wb, ws, 'Кандидаты');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=candidates.xlsx');
    res.send(buf);
  } catch (err) {
    console.error('[Candidates/ExportExcel] Unhandled error:', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'Ошибка экспорта в Excel' });
  }
});


// ── Batch PDF Report (all candidates for a vacancy) ──
router.get('/vacancy/:vacancyId/report-pdf', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { data: vacancy } = await supabase
      .from('vacancies')
      .select('id, title, created_by')
      .eq('id', req.params.vacancyId)
      .eq('created_by', req.userId!)
      .single();

    if (!vacancy) { res.status(404).json({ error: 'Вакансия не найдена' }); return; }

    const { data: candidates } = await supabase
      .from('candidates')
      .select('*, ai_analysis(*)')
      .eq('vacancy_id', req.params.vacancyId)
      .order('submitted_at', { ascending: false });

    const PDFDocument = (await import('pdfkit')).default;
    const doc = new PDFDocument({ size: 'A4', margin: 40, bufferPages: true });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="vacancy-${(vacancy.title as string).replace(/\s+/g, '_')}-report.pdf"`);
    doc.pipe(res);

    // Header
    doc.rect(0, 0, 595, 70).fill('#1a1a1a');
    doc.fontSize(18).fillColor('#ffffff').text('SOLUTION HUB', 40, 22);
    doc.fontSize(9).fillColor('#E8721C').text(`Отчёт по вакансии: ${vacancy.title as string}`, 40, 45);
    doc.fontSize(8).fillColor('#888888').text(new Date().toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' }), 400, 45, { align: 'right' });

    doc.moveDown(3);

    // Summary
    const allCandidates = candidates || [];
    const analyzed = allCandidates.filter((c: Record<string, unknown>) => c.ai_analysis);
    doc.fontSize(12).fillColor('#333333').text(`Всего кандидатов: ${allCandidates.length}`);
    doc.text(`Проанализировано AI: ${analyzed.length}`);
    if (analyzed.length > 0) {
      const avgScore = Math.round(analyzed.reduce((s: number, c: Record<string, unknown>) => {
        const analysis = c.ai_analysis as Record<string, unknown> | null;
        return s + ((analysis?.overall_score as number) || 0);
      }, 0) / analyzed.length);
      doc.text(`Средний балл: ${avgScore}/100`);
    }
    doc.moveDown(1);

    // Candidate list
    allCandidates.forEach((c: Record<string, unknown>, i: number) => {
      if (doc.y > 700) doc.addPage();

      const analysis = c.ai_analysis as Record<string, unknown> | null;
      const score = analysis?.overall_score;
      const category = (analysis?.category as string) || 'N/A';

      doc.fontSize(11).fillColor('#1a1a1a').text(`${i + 1}. ${c.full_name as string}`, 40);
      doc.fontSize(9).fillColor('#666666');
      doc.text(`   Email: ${(c.email as string) || '—'}  |  Статус: ${c.status as string}  |  Балл: ${score || '—'}  |  Категория: ${category}`);

      if (analysis?.summary) {
        const summary = analysis.summary as string;
        doc.fontSize(8).fillColor('#888888').text(`   ${summary.slice(0, 200)}${summary.length > 200 ? '...' : ''}`);
      }
      doc.moveDown(0.5);
    });

    // Footer on each page
    const pages = doc.bufferedPageRange();
    for (let i = pages.start; i < pages.start + pages.count; i++) {
      doc.switchToPage(i);
      doc.fontSize(7).fillColor('#aaaaaa').text(
        `SOLUTION HUB | Страница ${i + 1} из ${pages.count} | Конфиденциально`,
        40, 780, { align: 'center', width: 515 }
      );
    }

    doc.end();
  } catch (err) {
    console.error('[Candidates/BatchPDF] Error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Ошибка генерации PDF' });
    }
  }
});

// ── Audit Data Export ──
router.get('/vacancy/:vacancyId/export-audit', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { data: vacancy } = await supabase
      .from('vacancies')
      .select('*')
      .eq('id', req.params.vacancyId)
      .eq('created_by', req.userId!)
      .single();

    if (!vacancy) { res.status(404).json({ error: 'Вакансия не найдена' }); return; }

    const { data: candidates } = await supabase
      .from('candidates')
      .select('*, ai_analysis(*)')
      .eq('vacancy_id', req.params.vacancyId);

    const auditData = {
      export_date: new Date().toISOString(),
      exported_by: req.userId,
      vacancy: {
        id: vacancy.id,
        title: vacancy.title,
        description: vacancy.description,
        requirements: vacancy.requirements,
        status: vacancy.status,
        created_at: vacancy.created_at,
      },
      candidates: (candidates || []).map((c: Record<string, unknown>) => {
        const analysis = c.ai_analysis as Record<string, unknown> | null;
        return {
          id: c.id,
          full_name: c.full_name,
          email: c.email,
          status: c.status,
          submitted_at: c.submitted_at,
          ai_analysis: analysis ? {
            overall_score: analysis.overall_score,
            category: analysis.category,
            scores: analysis.scores,
            strengths: analysis.strengths,
            weaknesses: analysis.weaknesses,
            summary: analysis.summary,
            recommendations: analysis.recommendations,
            analyzed_at: analysis.analyzed_at,
          } : null,
          decision_basis: analysis ?
            `Кандидат оценён AI с баллом ${analysis.overall_score}/100 (${analysis.category}). Решение: ${c.status === 'invited' ? 'приглашён' : c.status === 'rejected' ? 'отклонён' : 'ожидает решения'}.`
            : 'AI анализ не проведён',
        };
      }),
      total_candidates: (candidates || []).length,
      methodology: 'AI анализ на базе Claude (Anthropic) по 6 параметрам: hard_skills (40%), experience (25%), education (15%), soft_skills (10%), languages (5%), culture_fit (5%)',
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="audit-${(vacancy.title as string).replace(/\s+/g, '_')}-${new Date().toISOString().split('T')[0]}.json"`);
    res.json(auditData);
  } catch (err) {
    console.error('[Candidates/AuditExport] Error:', err);
    res.status(500).json({ error: 'Ошибка экспорта аудита' });
  }
});

export default router;
