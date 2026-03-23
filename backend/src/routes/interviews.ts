import { Router, Response } from 'express';
import { supabase } from '../config/supabase';
import { authenticate, AuthRequest } from '../middleware/auth';
import { isValidUUID, sanitizeString } from '../utils/validate';

const router = Router();
router.use(authenticate);

// GET /api/interviews — list user's interviews with candidate + vacancy info
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { data, error } = await supabase
      .from('interviews')
      .select('*, candidates(id, full_name, email, status), vacancies(id, title)')
      .eq('user_id', req.userId!)
      .order('scheduled_at', { ascending: true });

    if (error) {
      console.error('[Interviews] List error:', error.message);
      res.status(500).json({ error: 'Ошибка загрузки собеседований' });
      return;
    }

    res.json({ interviews: data || [] });
  } catch (err) {
    console.error('[Interviews] Unhandled error:', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// GET /api/interviews/upcoming — next 5 upcoming interviews
router.get('/upcoming', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { data, error } = await supabase
      .from('interviews')
      .select('*, candidates(id, full_name, email), vacancies(id, title)')
      .eq('user_id', req.userId!)
      .gte('scheduled_at', new Date().toISOString())
      .in('status', ['scheduled', 'confirmed'])
      .order('scheduled_at', { ascending: true })
      .limit(5);

    if (error) {
      console.error('[Interviews] Upcoming error:', error.message);
      res.status(500).json({ error: 'Ошибка загрузки предстоящих собеседований' });
      return;
    }

    res.json({ interviews: data || [] });
  } catch (err) {
    console.error('[Interviews] Unhandled error:', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /api/interviews — create interview
router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { candidate_id, vacancy_id, scheduled_at, duration_minutes, type, location, meeting_link, notes } = req.body;

    if (!candidate_id || !vacancy_id || !scheduled_at) {
      res.status(400).json({ error: 'candidate_id, vacancy_id и scheduled_at обязательны' });
      return;
    }

    if (!isValidUUID(candidate_id) || !isValidUUID(vacancy_id)) {
      res.status(400).json({ error: 'Некорректный ID кандидата или вакансии' });
      return;
    }

    const safeNotes = notes ? sanitizeString(notes, 2000) : null;
    const safeLocation = location ? sanitizeString(location, 500) : null;
    const safeMeetingLink = meeting_link ? sanitizeString(meeting_link, 1000) : null;

    // Verify vacancy ownership
    const { data: vacancy } = await supabase
      .from('vacancies')
      .select('id')
      .eq('id', vacancy_id)
      .eq('created_by', req.userId!)
      .single();

    if (!vacancy) {
      res.status(404).json({ error: 'Вакансия не найдена' });
      return;
    }

    const { data, error } = await supabase
      .from('interviews')
      .insert({
        candidate_id,
        vacancy_id,
        user_id: req.userId!,
        scheduled_at,
        duration_minutes: duration_minutes || 30,
        type: type || 'online',
        location: safeLocation,
        meeting_link: safeMeetingLink,
        notes: safeNotes,
        status: 'scheduled',
      })
      .select('*, candidates(id, full_name, email), vacancies(id, title)')
      .single();

    if (error) {
      console.error('[Interviews] Create error:', error.message);
      res.status(500).json({ error: 'Ошибка создания собеседования' });
      return;
    }

    res.status(201).json({ interview: data });
  } catch (err) {
    console.error('[Interviews] Unhandled error:', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// PUT /api/interviews/:id — update interview
router.put('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!isValidUUID(req.params.id)) { res.status(400).json({ error: 'Некорректный ID' }); return; }
    const { scheduled_at, duration_minutes, type, location, meeting_link, notes, status } = req.body;

    // Verify ownership
    const { data: existing } = await supabase
      .from('interviews')
      .select('id')
      .eq('id', req.params.id)
      .eq('user_id', req.userId!)
      .single();

    if (!existing) {
      res.status(404).json({ error: 'Собеседование не найдено' });
      return;
    }

    const updates: Record<string, unknown> = {};
    if (scheduled_at !== undefined) updates.scheduled_at = scheduled_at;
    if (duration_minutes !== undefined) updates.duration_minutes = duration_minutes;
    if (type !== undefined) updates.type = type;
    if (location !== undefined) updates.location = location ? sanitizeString(location, 500) : null;
    if (meeting_link !== undefined) updates.meeting_link = meeting_link ? sanitizeString(meeting_link, 1000) : null;
    if (notes !== undefined) updates.notes = notes ? sanitizeString(notes, 2000) : null;
    if (status !== undefined) updates.status = status;

    const { data, error } = await supabase
      .from('interviews')
      .update(updates)
      .eq('id', req.params.id)
      .eq('user_id', req.userId!)
      .select('*, candidates(id, full_name, email), vacancies(id, title)')
      .single();

    if (error) {
      console.error('[Interviews] Update error:', error.message);
      res.status(500).json({ error: 'Ошибка обновления собеседования' });
      return;
    }

    res.json({ interview: data });
  } catch (err) {
    console.error('[Interviews] Unhandled error:', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// DELETE /api/interviews/:id — cancel interview
router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!isValidUUID(req.params.id)) { res.status(400).json({ error: 'Некорректный ID' }); return; }
    const { error } = await supabase
      .from('interviews')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.userId!);

    if (error) {
      console.error('[Interviews] Delete error:', error.message);
      res.status(500).json({ error: 'Ошибка удаления собеседования' });
      return;
    }

    res.json({ success: true });
  } catch (err) {
    console.error('[Interviews] Unhandled error:', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

export default router;
