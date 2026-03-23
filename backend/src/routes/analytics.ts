import { Router, Response } from 'express';
import { supabase } from '../config/supabase';
import { authenticate, AuthRequest } from '../middleware/auth';
import { isValidUUID } from '../utils/validate';

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
  } catch (err) {
    console.error('[Analytics/Overview] Error:', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// GET /api/analytics/vacancy/:id
router.get('/vacancy/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!isValidUUID(req.params.id)) { res.status(400).json({ error: 'Некорректный ID' }); return; }
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
  } catch (err) {
    console.error('[Analytics/Vacancy] Error:', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'Failed to fetch vacancy analytics' });
  }
});

// ── Hiring funnel ──
router.get('/funnel', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Get all candidates for user's vacancies — use separate queries to avoid type conflicts
    let candidates: Record<string, unknown>[] | null = null;

    if (req.orgId) {
      const result = await supabase
        .from('candidates')
        .select('id, status, submitted_at, vacancies!inner(organization_id)')
        .eq('vacancies.organization_id', req.orgId);
      candidates = result.data;
    } else {
      const result = await supabase
        .from('candidates')
        .select('id, status, submitted_at, vacancies!inner(created_by)')
        .eq('vacancies.created_by', req.userId!);
      candidates = result.data;
    }

    const all = candidates || [];

    const funnel = {
      total_applications: all.length,
      new: all.filter(c => c.status === 'new').length,
      analyzing: all.filter(c => c.status === 'analyzing').length,
      analyzed: all.filter(c => c.status === 'analyzed').length,
      invited: all.filter(c => c.status === 'invited').length,
      rejected: all.filter(c => c.status === 'rejected').length,
    };

    // Conversion rates
    const conversions = {
      analysis_rate: all.length > 0 ? ((funnel.analyzed + funnel.invited + funnel.rejected) / all.length * 100) : 0,
      invite_rate: all.length > 0 ? (funnel.invited / all.length * 100) : 0,
      rejection_rate: all.length > 0 ? (funnel.rejected / all.length * 100) : 0,
    };

    // Time metrics (approximate from submission dates)
    const now = Date.now();
    const avgAge = all.length > 0
      ? all.reduce((sum, c) => sum + (now - new Date(c.submitted_at as string).getTime()), 0) / all.length / (1000 * 60 * 60 * 24)
      : 0;

    // Weekly trend
    const weeklyData: Record<string, number> = {};
    all.forEach(c => {
      const week = new Date(c.submitted_at as string).toISOString().split('T')[0];
      weeklyData[week] = (weeklyData[week] || 0) + 1;
    });

    res.json({
      funnel,
      conversions: {
        analysis_rate: Math.round(conversions.analysis_rate * 10) / 10,
        invite_rate: Math.round(conversions.invite_rate * 10) / 10,
        rejection_rate: Math.round(conversions.rejection_rate * 10) / 10,
      },
      avg_days_in_pipeline: Math.round(avgAge),
      daily_applications: weeklyData,
    });
  } catch (err) {
    console.error('[Analytics/Funnel] Error:', err);
    res.json({ funnel: {}, conversions: {}, avg_days_in_pipeline: 0, daily_applications: {} });
  }
});

export default router;
