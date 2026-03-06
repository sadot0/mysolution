import { Router, Response } from 'express';
import { supabase } from '../config/supabase';
import { authenticate, AuthRequest } from '../middleware/auth';
import { createFormForVacancy } from '../services/google-forms';

const router = Router();
router.use(authenticate);

const VALID_STATUSES = ['active', 'paused', 'closed'] as const;
const VALID_WEIGHT_KEYS = ['hard_skills', 'experience', 'education', 'soft_skills', 'languages', 'culture_fit'];

function sanitizeWeights(weights: unknown): Record<string, number> | null {
  if (!weights || typeof weights !== 'object' || Array.isArray(weights)) return null;
  const w = weights as Record<string, unknown>;
  const result: Record<string, number> = {};
  for (const key of VALID_WEIGHT_KEYS) {
    if (w[key] !== undefined) {
      const val = Number(w[key]);
      if (isNaN(val) || val < 0 || val > 100) return null;
      result[key] = val;
    }
  }
  return result;
}

function buildOwnershipFilter(
  query: ReturnType<typeof supabase.from>,
  orgId: string | undefined,
  userId: string,
) {
  if (orgId) {
    return (query as unknown as { eq: (col: string, val: string) => typeof query }).eq('organization_id', orgId);
  }
  return (query as unknown as { eq: (col: string, val: string) => typeof query }).eq('created_by', userId);
}

// GET /api/vacancies
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    let query = supabase
      .from('vacancies')
      .select('*, candidates(count)')
      .order('created_at', { ascending: false });

    if (req.orgId) {
      query = query.eq('organization_id', req.orgId);
    } else {
      query = query.eq('created_by', req.userId!);
    }

    const { data, error } = await query;

    if (error) {
      res.status(500).json({ error: 'Failed to fetch vacancies' });
      return;
    }

    res.json({ vacancies: data });
  } catch {
    res.status(500).json({ error: 'Failed to fetch vacancies' });
  }
});

// POST /api/vacancies
router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { title, description, requirements, weights, salary_range, location, remote, custom_questions } = req.body;

    if (!title || !requirements) {
      res.status(400).json({ error: 'title and requirements are required' });
      return;
    }

    const sanitizedTitle = String(title).trim();
    if (!sanitizedTitle || sanitizedTitle.length > 200) {
      res.status(400).json({ error: 'Title must be between 1 and 200 characters' });
      return;
    }

    const sanitizedWeights = weights ? sanitizeWeights(weights) : null;
    if (weights && sanitizedWeights === null) {
      res.status(400).json({ error: 'Invalid weight values — each must be a number between 0 and 100' });
      return;
    }

    const defaultWeights = {
      hard_skills: 40,
      experience: 25,
      education: 15,
      soft_skills: 10,
      languages: 5,
      culture_fit: 5,
      ...(sanitizedWeights || {}),
    };

    const sanitizedQuestions = Array.isArray(custom_questions) ? custom_questions : [];

    const { data, error } = await supabase
      .from('vacancies')
      .insert({
        title: sanitizedTitle,
        description: description ? String(description).slice(0, 5000) : null,
        requirements,
        weights: defaultWeights,
        salary_range: salary_range || null,
        location: location ? String(location).slice(0, 200) : null,
        remote: Boolean(remote),
        status: 'active',
        created_by: req.userId!,
        organization_id: req.orgId || null,
        custom_questions: sanitizedQuestions,
      })
      .select()
      .single();

    if (error) {
      res.status(500).json({ error: 'Failed to create vacancy' });
      return;
    }

    res.status(201).json({ vacancy: data });
  } catch {
    res.status(500).json({ error: 'Failed to create vacancy' });
  }
});

// GET /api/vacancies/:id
router.get('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    let query = supabase.from('vacancies').select('*').eq('id', req.params.id);

    if (req.orgId) {
      query = query.eq('organization_id', req.orgId);
    } else {
      query = query.eq('created_by', req.userId!);
    }

    const { data, error } = await query.single();

    if (error || !data) {
      res.status(404).json({ error: 'Vacancy not found' });
      return;
    }

    res.json({ vacancy: data });
  } catch {
    res.status(500).json({ error: 'Failed to fetch vacancy' });
  }
});

// PUT /api/vacancies/:id
router.put('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { title, description, requirements, weights, status, salary_range, location, remote, custom_questions } = req.body;

    if (status !== undefined && !VALID_STATUSES.includes(status)) {
      res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` });
      return;
    }

    const sanitizedWeights = weights ? sanitizeWeights(weights) : undefined;
    if (weights && sanitizedWeights === null) {
      res.status(400).json({ error: 'Invalid weight values — each must be a number between 0 and 100' });
      return;
    }

    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (title !== undefined) updateData.title = String(title).trim().slice(0, 200);
    if (description !== undefined) updateData.description = description ? String(description).slice(0, 5000) : null;
    if (requirements !== undefined) updateData.requirements = requirements;
    if (sanitizedWeights !== undefined) updateData.weights = sanitizedWeights;
    if (status !== undefined) updateData.status = status;
    if (salary_range !== undefined) updateData.salary_range = salary_range;
    if (location !== undefined) updateData.location = location ? String(location).slice(0, 200) : null;
    if (remote !== undefined) updateData.remote = Boolean(remote);
    if (custom_questions !== undefined) updateData.custom_questions = Array.isArray(custom_questions) ? custom_questions : [];

    let query = supabase.from('vacancies').update(updateData).eq('id', req.params.id);

    if (req.orgId) {
      query = query.eq('organization_id', req.orgId);
    } else {
      query = query.eq('created_by', req.userId!);
    }

    const { data, error } = await query.select().single();

    if (error || !data) {
      res.status(404).json({ error: 'Vacancy not found' });
      return;
    }

    res.json({ vacancy: data });
  } catch {
    res.status(500).json({ error: 'Failed to update vacancy' });
  }
});

// DELETE /api/vacancies/:id
router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    let query = supabase.from('vacancies').delete().eq('id', req.params.id);

    if (req.orgId) {
      query = query.eq('organization_id', req.orgId);
    } else {
      query = query.eq('created_by', req.userId!);
    }

    const { error } = await query;

    if (error) {
      res.status(500).json({ error: 'Failed to delete vacancy' });
      return;
    }

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to delete vacancy' });
  }
});

// POST /api/vacancies/:id/generate-form
router.post('/:id/generate-form', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    let query = supabase.from('vacancies').select('*').eq('id', req.params.id);

    if (req.orgId) {
      query = query.eq('organization_id', req.orgId);
    } else {
      query = query.eq('created_by', req.userId!);
    }

    const { data: vacancy, error } = await query.single();

    if (error || !vacancy) {
      res.status(404).json({ error: 'Vacancy not found' });
      return;
    }

    const { formId, formUrl } = await createFormForVacancy(vacancy.title, vacancy.requirements);

    const { data: updated, error: updateError } = await supabase
      .from('vacancies')
      .update({
        google_form_id: formId,
        google_form_url: formUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (updateError) {
      res.status(500).json({ error: 'Form created but failed to save link' });
      return;
    }

    res.json({ formId, formUrl, vacancy: updated });
  } catch {
    res.status(500).json({ error: 'Failed to generate form' });
  }
});

// POST /api/vacancies/:id/sync-responses
router.post('/:id/sync-responses', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    let query = supabase.from('vacancies').select('*').eq('id', req.params.id);

    if (req.orgId) {
      query = query.eq('organization_id', req.orgId);
    } else {
      query = query.eq('created_by', req.userId!);
    }

    const { data: vacancy, error } = await query.single();

    if (error || !vacancy || !vacancy.google_form_id) {
      res.status(404).json({ error: 'Vacancy or form not found' });
      return;
    }

    const { getFormResponses, getFormWithQuestions, parseFormResponse } = await import(
      '../services/google-forms'
    );

    const [responses, form] = await Promise.all([
      getFormResponses(vacancy.google_form_id),
      getFormWithQuestions(vacancy.google_form_id),
    ]);

    let created = 0;
    let skipped = 0;

    for (const response of responses) {
      if (!response.responseId) continue;

      const { data: existing } = await supabase
        .from('candidates')
        .select('id')
        .eq('google_form_response_id', response.responseId)
        .single();

      if (existing) {
        skipped++;
        continue;
      }

      const parsed = parseFormResponse(response, form);

      const fullName = String(parsed['Полное имя (ФИО)'] || parsed['Полное имя'] || 'Unknown').slice(0, 200);
      const email = String(parsed['Email адрес'] || parsed['Email'] || '').toLowerCase().slice(0, 200);
      const phone = String(parsed['Номер телефона'] || parsed['Телефон'] || '').slice(0, 30);

      await supabase.from('candidates').insert({
        vacancy_id: vacancy.id,
        full_name: fullName,
        email,
        phone,
        form_responses: parsed,
        google_form_response_id: response.responseId,
        submitted_at: response.lastSubmittedTime || new Date().toISOString(),
        status: 'new',
      });

      created++;
    }

    res.json({ synced: created, skipped, total: responses.length });
  } catch {
    res.status(500).json({ error: 'Sync failed' });
  }
});

export default router;
