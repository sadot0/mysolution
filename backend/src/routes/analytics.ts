import { Router, Response } from 'express';
import { supabase } from '../config/supabase';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// GET /api/analytics/overview
router.get('/overview', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { data: vacancies } = await supabase
      .from('vacancies')
      .select('id')
      .eq('created_by', req.userId!);

    const vacancyIds = (vacancies || []).map((v: Record<string, unknown>) => v.id);

    if (vacancyIds.length === 0) {
      res.json({ total_vacancies: 0, total_candidates: 0, analyzed: 0, avg_score: 0 });
      return;
    }

    const { data: candidates } = await supabase
      .from('candidates')
      .select('id, status')
      .in('vacancy_id', vacancyIds);

    const { data: analyses } = await supabase
      .from('ai_analysis')
      .select('overall_score, category')
      .in('candidate_id', (candidates || []).map((c: Record<string, unknown>) => c.id));

    const total = candidates?.length || 0;
    const analyzed = analyses?.length || 0;
    const avgScore = analyzed
      ? Math.round((analyses || []).reduce((sum: number, a: Record<string, unknown>) => sum + (a.overall_score as number), 0) / analyzed)
      : 0;

    const byCategory = (analyses || []).reduce<Record<string, number>>((acc, a: Record<string, unknown>) => {
      const cat = a.category as string;
      acc[cat] = (acc[cat] || 0) + 1;
      return acc;
    }, {});

    res.json({
      total_vacancies: vacancies?.length || 0,
      total_candidates: total,
      analyzed,
      avg_score: avgScore,
      by_category: byCategory,
    });
  } catch {
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// GET /api/analytics/vacancy/:id
router.get('/vacancy/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { data: vacancy } = await supabase
      .from('vacancies')
      .select('*')
      .eq('id', req.params.id)
      .eq('created_by', req.userId!)
      .single();

    if (!vacancy) {
      res.status(404).json({ error: 'Vacancy not found' });
      return;
    }

    const { data: candidates } = await supabase
      .from('candidates')
      .select(`id, status, submitted_at, ai_analysis(overall_score, category)`)
      .eq('vacancy_id', req.params.id);

    const analyzed = (candidates || []).filter((c: Record<string, unknown>) => {
      const analysis = c.ai_analysis;
      return Array.isArray(analysis) ? analysis.length > 0 : !!analysis;
    });

    const scores = analyzed.map((c: Record<string, unknown>) => {
      const analysis = Array.isArray(c.ai_analysis) ? c.ai_analysis[0] : c.ai_analysis;
      return (analysis as Record<string, unknown>)?.overall_score as number ?? 0;
    });

    const avgScore = scores.length ? Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length) : 0;

    const byStatus = (candidates || []).reduce<Record<string, number>>((acc, c: Record<string, unknown>) => {
      const st = c.status as string;
      acc[st] = (acc[st] || 0) + 1;
      return acc;
    }, {});

    res.json({
      vacancy,
      stats: {
        total: candidates?.length || 0,
        analyzed: analyzed.length,
        avg_score: avgScore,
        max_score: scores.length ? Math.max(...scores) : 0,
        min_score: scores.length ? Math.min(...scores) : 0,
        by_status: byStatus,
      },
    });
  } catch {
    res.status(500).json({ error: 'Failed to fetch vacancy analytics' });
  }
});

export default router;
