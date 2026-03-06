import { Router, Response } from 'express';
import { supabase } from '../config/supabase';
import { authenticate, requireSuperadmin, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate, requireSuperadmin);

// GET /api/admin/stats
router.get('/stats', async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const [
      { count: orgCount },
      { count: userCount },
      { count: vacancyCount },
      { count: candidateCount },
    ] = await Promise.all([
      supabase.from('organizations').select('*', { count: 'exact', head: true }),
      supabase.from('users').select('*', { count: 'exact', head: true }),
      supabase.from('vacancies').select('*', { count: 'exact', head: true }),
      supabase.from('candidates').select('*', { count: 'exact', head: true }),
    ]);

    res.json({
      stats: {
        organizations: orgCount ?? 0,
        users: userCount ?? 0,
        vacancies: vacancyCount ?? 0,
        candidates: candidateCount ?? 0,
      },
    });
  } catch {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// GET /api/admin/organizations?page=1&limit=20
router.get('/organizations', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const from = (page - 1) * limit;

    const { data, error, count } = await supabase
      .from('organizations')
      .select('*, users!owner_id(id, name, email)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, from + limit - 1);

    if (error) {
      res.status(500).json({ error: 'Failed to fetch organizations' });
      return;
    }

    res.json({ organizations: data, total: count, page, limit });
  } catch {
    res.status(500).json({ error: 'Failed to fetch organizations' });
  }
});

// GET /api/admin/users?page=1&limit=20
router.get('/users', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const from = (page - 1) * limit;

    const { data, error, count } = await supabase
      .from('users')
      .select('id, email, name, company_name, email_verified, role, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, from + limit - 1);

    if (error) {
      res.status(500).json({ error: 'Failed to fetch users' });
      return;
    }

    res.json({ users: data, total: count, page, limit });
  } catch {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// PUT /api/admin/organizations/:id/plan
router.put('/organizations/:id/plan', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { plan } = req.body;
    if (!plan || !['free', 'pro'].includes(plan)) {
      res.status(400).json({ error: 'plan must be "free" or "pro"' });
      return;
    }

    const { data, error } = await supabase
      .from('organizations')
      .update({ plan })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error || !data) {
      res.status(404).json({ error: 'Organization not found' });
      return;
    }

    res.json({ organization: data });
  } catch {
    res.status(500).json({ error: 'Failed to update plan' });
  }
});

// PUT /api/admin/users/:id/role
router.put('/users/:id/role', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role } = req.body;
    if (!role || !['user', 'superadmin'].includes(role)) {
      res.status(400).json({ error: 'role must be "user" or "superadmin"' });
      return;
    }

    const { data, error } = await supabase
      .from('users')
      .update({ role })
      .eq('id', req.params.id)
      .select('id, email, name, role')
      .single();

    if (error || !data) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({ user: data });
  } catch {
    res.status(500).json({ error: 'Failed to update role' });
  }
});

export default router;
