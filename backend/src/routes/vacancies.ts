import { Router, Response } from 'express';
import { supabase } from '../config/supabase';
import { authenticate, AuthRequest } from '../middleware/auth';
import { createFormForVacancy } from '../services/google-forms';
import { isValidUUID } from '../utils/validate';

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

function sanitizeHtml(str: string): string {
  return str.replace(/[<>&"']/g, (c) => {
    const map: Record<string, string> = { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' };
    return map[c] || c;
  });
}

function isMissingColumnError(error: { code?: string } | null): boolean {
  return error?.code === '42703' || error?.code === 'PGRST204';
}

// GET /api/vacancies
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Try with organization_id filter first
    if (req.orgId) {
      const { data, error } = await supabase
        .from('vacancies')
        .select('*, candidates(count)')
        .eq('organization_id', req.orgId)
        .order('created_at', { ascending: false });

      if (!isMissingColumnError(error)) {
        if (error) {
          console.error('[Vacancies/List] Supabase error (org filter):', error.message);
          res.status(500).json({ error: 'Ошибка загрузки вакансий' });
          return;
        }
        res.json({ vacancies: data });
        return;
      }
      // Fall through to created_by filter
    }

    const { data, error } = await supabase
      .from('vacancies')
      .select('*, candidates(count)')
      .eq('created_by', req.userId!)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Vacancies/List] Supabase error:', error.message);
      res.status(500).json({ error: 'Ошибка загрузки вакансий' });
      return;
    }
    res.json({ vacancies: data });
  } catch (err) {
    console.error('[Vacancies/List] Unhandled error:', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'Ошибка загрузки вакансий' });
  }
});

// POST /api/vacancies
router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { title, description, requirements, weights, salary_range, location, remote, custom_questions } = req.body;

    if (!title || !requirements) {
      res.status(400).json({ error: 'Название и требования обязательны' });
      return;
    }

    const sanitizedTitle = sanitizeHtml(String(title).trim());
    if (!sanitizedTitle || sanitizedTitle.length > 200) {
      res.status(400).json({ error: 'Название должно быть от 1 до 200 символов' });
      return;
    }

    const sanitizedWeights = weights ? sanitizeWeights(weights) : null;
    if (weights && sanitizedWeights === null) {
      res.status(400).json({ error: 'Неверные значения весов — каждый должен быть числом от 0 до 100' });
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

    const sanitizedDesc = description ? sanitizeHtml(String(description).trim()) : '';

    const sanitizedQuestions = Array.isArray(custom_questions) ? custom_questions : [];

    const baseInsert = {
      title: sanitizedTitle,
      description: sanitizedDesc ? sanitizedDesc.slice(0, 5000) : null,
      requirements,
      weights: defaultWeights,
      salary_range: salary_range || null,
      location: location ? String(location).slice(0, 200) : null,
      remote: Boolean(remote),
      status: 'active',
      created_by: req.userId!,
    };

    // Try with new columns first
    let result = await supabase
      .from('vacancies')
      .insert({ ...baseInsert, organization_id: req.orgId || null, custom_questions: sanitizedQuestions })
      .select()
      .single();

    // Fallback: retry without new columns if they don't exist
    if (isMissingColumnError(result.error)) {
      result = await supabase
        .from('vacancies')
        .insert(baseInsert)
        .select()
        .single();
    }

    if (result.error) {
      console.error('[Vacancies/Create] Supabase error:', result.error.message, result.error.details);
      res.status(500).json({ error: 'Ошибка создания вакансии' });
      return;
    }

    res.status(201).json({ vacancy: result.data });
  } catch (err) {
    console.error('[Vacancies/Create] Unhandled error:', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'Ошибка создания вакансии' });
  }
});

// GET /api/vacancies/:id
router.get('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!isValidUUID(req.params.id)) { res.status(400).json({ error: 'Некорректный ID' }); return; }
    if (req.orgId) {
      const { data, error } = await supabase
        .from('vacancies')
        .select('*')
        .eq('id', req.params.id)
        .eq('organization_id', req.orgId)
        .single();

      if (!isMissingColumnError(error)) {
        if (error || !data) {
          if (error && error.code !== 'PGRST116') {
            console.error('[Vacancies/Get] Supabase error:', error.message);
          }
          res.status(404).json({ error: 'Вакансия не найдена' });
          return;
        }
        res.json({ vacancy: data });
        return;
      }
    }

    const { data, error } = await supabase
      .from('vacancies')
      .select('*')
      .eq('id', req.params.id)
      .eq('created_by', req.userId!)
      .single();

    if (error || !data) {
      if (error && error.code !== 'PGRST116') {
        console.error('[Vacancies/Get] Supabase error:', error.message);
      }
      res.status(404).json({ error: 'Вакансия не найдена' });
      return;
    }
    res.json({ vacancy: data });
  } catch (err) {
    console.error('[Vacancies/Get] Unhandled error:', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'Ошибка загрузки вакансии' });
  }
});

// PUT /api/vacancies/:id — partial update of vacancy fields
router.put('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!isValidUUID(req.params.id)) { res.status(400).json({ error: 'Некорректный ID' }); return; }
    const { title, description, requirements, weights, status, salary_range, location, remote, custom_questions } = req.body;

    // Validate title if provided
    if (title !== undefined) {
      const trimmedTitle = String(title).trim();
      if (!trimmedTitle || trimmedTitle.length > 200) {
        res.status(400).json({ error: 'Название должно быть от 1 до 200 символов' });
        return;
      }
    }

    // Validate status if provided
    if (status !== undefined && !VALID_STATUSES.includes(status)) {
      res.status(400).json({ error: `Статус должен быть одним из: ${VALID_STATUSES.join(', ')}` });
      return;
    }

    // Validate weights if provided
    const sanitizedWeights = weights ? sanitizeWeights(weights) : undefined;
    if (weights && sanitizedWeights === null) {
      res.status(400).json({ error: 'Неверные значения весов — каждый должен быть числом от 0 до 100' });
      return;
    }

    // Build partial update — only include fields that were provided
    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (title !== undefined) updateData.title = sanitizeHtml(String(title).trim().slice(0, 200));
    if (description !== undefined) updateData.description = description ? sanitizeHtml(String(description).trim()).slice(0, 5000) : null;
    if (requirements !== undefined) updateData.requirements = requirements;
    if (sanitizedWeights !== undefined) updateData.weights = sanitizedWeights;
    if (status !== undefined) updateData.status = status;
    if (salary_range !== undefined) updateData.salary_range = salary_range || null;
    if (location !== undefined) updateData.location = location ? String(location).slice(0, 200) : null;
    if (remote !== undefined) updateData.remote = Boolean(remote);

    // Check that at least one field is being updated (besides updated_at)
    if (Object.keys(updateData).length <= 1) {
      res.status(400).json({ error: 'Необходимо указать хотя бы одно поле для обновления' });
      return;
    }

    // Build update payload with optional custom_questions
    const updateWithQuestions = custom_questions !== undefined
      ? { ...updateData, custom_questions: Array.isArray(custom_questions) ? custom_questions : [] }
      : updateData;

    // Helper: run update with a specific ownership column
    const runUpdate = async (ownerCol: string, ownerVal: string, payload: Record<string, unknown>) => {
      return supabase
        .from('vacancies')
        .update(payload)
        .eq('id', req.params.id)
        .eq(ownerCol, ownerVal)
        .select()
        .single();
    };

    // Pick primary ownership column
    const ownerCol = req.orgId ? 'organization_id' : 'created_by';
    const ownerVal = req.orgId ? req.orgId : req.userId!;

    let result = await runUpdate(ownerCol, ownerVal, updateWithQuestions);

    // If organization_id column missing, fall back to created_by
    if (isMissingColumnError(result.error) && req.orgId) {
      result = await runUpdate('created_by', req.userId!, updateWithQuestions);
    }

    // If custom_questions column missing, retry without it
    if (isMissingColumnError(result.error)) {
      result = await runUpdate('created_by', req.userId!, updateData);
    }

    if (result.error || !result.data) {
      if (result.error && result.error.code !== 'PGRST116') {
        console.error('[Vacancies/Update] Supabase error:', result.error.message);
        res.status(500).json({ error: 'Ошибка обновления вакансии' });
        return;
      }
      res.status(404).json({ error: 'Вакансия не найдена или у вас нет прав на её редактирование' });
      return;
    }
    res.json({ vacancy: result.data });
  } catch (err) {
    console.error('[Vacancies/Update] Unhandled error:', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'Ошибка обновления вакансии' });
  }
});

// PATCH /api/vacancies/:id/status — quick status change
router.patch('/:id/status', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!isValidUUID(req.params.id)) { res.status(400).json({ error: 'Некорректный ID' }); return; }
    const { status } = req.body;

    if (!status || !VALID_STATUSES.includes(status)) {
      res.status(400).json({ error: `Статус должен быть одним из: ${VALID_STATUSES.join(', ')}` });
      return;
    }

    const payload = { status, updated_at: new Date().toISOString() };

    const runUpdate = async (ownerCol: string, ownerVal: string) => {
      return supabase
        .from('vacancies')
        .update(payload)
        .eq('id', req.params.id)
        .eq(ownerCol, ownerVal)
        .select()
        .single();
    };

    const ownerCol = req.orgId ? 'organization_id' : 'created_by';
    const ownerVal = req.orgId ? req.orgId : req.userId!;

    let result = await runUpdate(ownerCol, ownerVal);

    // If organization_id column missing, fall back to created_by
    if (isMissingColumnError(result.error) && req.orgId) {
      result = await runUpdate('created_by', req.userId!);
    }

    if (result.error || !result.data) {
      if (result.error && result.error.code !== 'PGRST116') {
        console.error('[Vacancies/UpdateStatus] Supabase error:', result.error.message);
        res.status(500).json({ error: 'Ошибка обновления статуса' });
        return;
      }
      res.status(404).json({ error: 'Вакансия не найдена или у вас нет прав на её редактирование' });
      return;
    }
    res.json({ vacancy: result.data });
  } catch (err) {
    console.error('[Vacancies/UpdateStatus] Unhandled error:', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'Ошибка обновления статуса' });
  }
});

// DELETE /api/vacancies/:id
router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!isValidUUID(req.params.id)) { res.status(400).json({ error: 'Некорректный ID' }); return; }
    // First verify the vacancy exists and belongs to the user
    let vacancyExists = false;

    if (req.orgId) {
      const { data, error } = await supabase
        .from('vacancies')
        .select('id')
        .eq('id', req.params.id)
        .eq('organization_id', req.orgId)
        .single();

      if (!isMissingColumnError(error)) {
        if (error && error.code !== 'PGRST116') {
          console.error('[Vacancies/Delete] Supabase lookup error:', error.message);
          res.status(500).json({ error: 'Ошибка удаления вакансии' });
          return;
        }
        vacancyExists = !!data;
      }
    }

    if (!vacancyExists) {
      const { data, error } = await supabase
        .from('vacancies')
        .select('id')
        .eq('id', req.params.id)
        .eq('created_by', req.userId!)
        .single();

      if (error || !data) {
        if (error && error.code !== 'PGRST116') {
          console.error('[Vacancies/Delete] Supabase lookup error:', error.message);
          res.status(500).json({ error: 'Ошибка удаления вакансии' });
          return;
        }
        res.status(404).json({ error: 'Вакансия не найдена или у вас нет прав на её удаление' });
        return;
      }
    }

    // Delete related candidates first (cascade), then the vacancy
    const { error: candidatesError } = await supabase
      .from('candidates')
      .delete()
      .eq('vacancy_id', req.params.id);

    if (candidatesError) {
      console.error('[Vacancies/Delete] Error deleting related candidates:', candidatesError.message);
      // Continue with vacancy deletion — DB cascade might handle it
    }

    const { error } = await supabase
      .from('vacancies')
      .delete()
      .eq('id', req.params.id);

    if (error) {
      console.error('[Vacancies/Delete] Supabase error:', error.message);
      res.status(500).json({ error: 'Ошибка удаления вакансии' });
      return;
    }
    res.json({ success: true, message: 'Вакансия успешно удалена' });
  } catch (err) {
    console.error('[Vacancies/Delete] Unhandled error:', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'Ошибка удаления вакансии' });
  }
});

// POST /api/vacancies/:id/generate-form
router.post('/:id/generate-form', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!isValidUUID(req.params.id)) { res.status(400).json({ error: 'Некорректный ID' }); return; }
    let vacancy: Record<string, unknown> | null = null;

    if (req.orgId) {
      const { data, error } = await supabase
        .from('vacancies').select('*').eq('id', req.params.id).eq('organization_id', req.orgId).single();
      if (!isMissingColumnError(error)) vacancy = data;
    }

    if (!vacancy) {
      const { data, error } = await supabase
        .from('vacancies').select('*').eq('id', req.params.id).eq('created_by', req.userId!).single();
      if (!error) vacancy = data;
    }

    if (!vacancy) { res.status(404).json({ error: 'Вакансия не найдена' }); return; }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { formId, formUrl } = await createFormForVacancy(vacancy.title as string, vacancy.requirements as any);

    const { data: updated, error: updateError } = await supabase
      .from('vacancies')
      .update({ google_form_id: formId, google_form_url: formUrl, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select()
      .single();

    if (updateError) {
      console.error('[Vacancies/GenerateForm] Failed to save form link:', updateError.message);
      res.status(500).json({ error: 'Форма создана, но не удалось сохранить ссылку' });
      return;
    }
    res.json({ formId, formUrl, vacancy: updated });
  } catch (err) {
    console.error('[Vacancies/GenerateForm] Unhandled error:', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'Ошибка генерации формы' });
  }
});

// POST /api/vacancies/:id/sync-responses
router.post('/:id/sync-responses', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!isValidUUID(req.params.id)) { res.status(400).json({ error: 'Некорректный ID' }); return; }
    let vacancy: Record<string, unknown> | null = null;

    if (req.orgId) {
      const { data, error } = await supabase
        .from('vacancies').select('*').eq('id', req.params.id).eq('organization_id', req.orgId).single();
      if (!isMissingColumnError(error)) vacancy = data;
    }

    if (!vacancy) {
      const { data, error } = await supabase
        .from('vacancies').select('*').eq('id', req.params.id).eq('created_by', req.userId!).single();
      if (!error) vacancy = data;
    }

    if (!vacancy || !vacancy.google_form_id) {
      res.status(404).json({ error: 'Вакансия или форма не найдена' });
      return;
    }

    const { getFormResponses, getFormWithQuestions, parseFormResponse } = await import(
      '../services/google-forms'
    );

    const [responses, form] = await Promise.all([
      getFormResponses(vacancy.google_form_id as string),
      getFormWithQuestions(vacancy.google_form_id as string),
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

      if (existing) { skipped++; continue; }

      const parsed = parseFormResponse(response, form);
      const fullName = String(parsed['Полное имя (ФИО)'] || parsed['Полное имя'] || 'Unknown').slice(0, 200);
      const email = String(parsed['Email адрес'] || parsed['Email'] || '').toLowerCase().slice(0, 200);
      const phone = String(parsed['Номер телефона'] || parsed['Телефон'] || '').slice(0, 30);

      const { error: insertError } = await supabase.from('candidates').insert({
        vacancy_id: vacancy.id,
        full_name: fullName,
        email,
        phone,
        form_responses: parsed,
        google_form_response_id: response.responseId,
        submitted_at: response.lastSubmittedTime || new Date().toISOString(),
        status: 'new',
      });

      if (insertError) {
        console.error('[Vacancies/SyncResponses] Insert error for response', response.responseId, ':', insertError.message);
        continue;
      }

      created++;
    }

    res.json({ synced: created, skipped, total: responses.length });
  } catch (err) {
    console.error('[Vacancies/SyncResponses] Unhandled error:', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'Ошибка синхронизации ответов' });
  }
});

// ── Publish to HH.uz ──
router.post('/:id/publish-hh', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!isValidUUID(req.params.id)) { res.status(400).json({ error: 'Некорректный ID' }); return; }
    const { hh_token } = req.body;
    if (!hh_token) {
      res.status(400).json({ error: 'HH API токен обязателен. Получите на dev.hh.ru' });
      return;
    }

    // Get vacancy
    const { data: vacancy, error } = await supabase
      .from('vacancies')
      .select('*')
      .eq('id', req.params.id)
      .eq('created_by', req.userId!)
      .single();

    if (error || !vacancy) {
      res.status(404).json({ error: 'Вакансия не найдена' });
      return;
    }

    const { publishToHH } = await import('../services/hh-integration');
    const result = await publishToHH(hh_token, {
      title: vacancy.title,
      description: vacancy.description || '',
      location: vacancy.location,
      salary_min: vacancy.salary_range?.min,
      salary_max: vacancy.salary_range?.max,
      experience_years: vacancy.requirements?.experience_years,
      remote: vacancy.remote,
    });

    if (result.success) {
      // Save HH info to vacancy
      await supabase.from('vacancies').update({
        hh_vacancy_id: result.hh_vacancy_id,
        hh_url: result.hh_url,
      }).eq('id', req.params.id);
    }

    res.json(result);
  } catch (err) {
    console.error('[Vacancies/PublishHH] Error:', err);
    res.status(500).json({ error: 'Ошибка публикации на HH' });
  }
});

// ── Post to Telegram channel ──
router.post('/:id/post-telegram', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { channel_id } = req.body;

    if (!channel_id) {
      res.status(400).json({ error: 'Telegram Channel ID обязателен (например @mychannel или -1001234567890)' });
      return;
    }

    const { data: vacancy, error } = await supabase
      .from('vacancies')
      .select('*')
      .eq('id', req.params.id)
      .eq('created_by', req.userId!)
      .single();

    if (error || !vacancy) {
      res.status(404).json({ error: 'Вакансия не найдена' });
      return;
    }

    const applyUrl = `${process.env.FRONTEND_URL || 'https://mysolution.uz'}/apply/${vacancy.id}`;

    const { postVacancyToTelegram } = await import('../services/telegram');
    const success = await postVacancyToTelegram(channel_id, {
      title: vacancy.title,
      description: vacancy.description,
      location: vacancy.location,
      remote: vacancy.remote,
      salary_range: vacancy.salary_range,
      requirements: vacancy.requirements as { hard_skills?: string[]; experience_years?: number },
      apply_url: applyUrl,
    });

    if (success) {
      res.json({ success: true, message: 'Вакансия опубликована в Telegram' });
    } else {
      res.status(500).json({ error: 'Ошибка публикации. Проверьте TELEGRAM_BOT_TOKEN и Channel ID.' });
    }
  } catch (err) {
    console.error('[Vacancies/PostTelegram] Error:', err);
    res.status(500).json({ error: 'Ошибка публикации в Telegram' });
  }
});

export default router;
