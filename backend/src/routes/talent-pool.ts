import { Router, Response } from 'express';
import { supabase } from '../config/supabase';
import { authenticate, AuthRequest } from '../middleware/auth';
import { isValidUUID, sanitizeString, sanitizeEmail } from '../utils/validate';

const router = Router();
router.use(authenticate);

// GET /api/talent-pool — list with search/filter
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { search, skills, rating, city, favorite } = req.query;

    let query = supabase
      .from('talent_pool')
      .select('*')
      .eq('user_id', req.userId!)
      .order('created_at', { ascending: false });

    if (search && typeof search === 'string') {
      query = query.or(`candidate_name.ilike.%${search}%,email.ilike.%${search}%,title.ilike.%${search}%`);
    }

    if (skills && typeof skills === 'string') {
      // Filter by skills array overlap
      query = query.overlaps('skills', skills.split(',').map(s => s.trim()));
    }

    if (rating && typeof rating === 'string') {
      const ratingNum = parseInt(rating, 10);
      if (!isNaN(ratingNum)) {
        query = query.gte('rating', ratingNum);
      }
    }

    if (city && typeof city === 'string') {
      query = query.ilike('city', `%${city}%`);
    }

    if (favorite === 'true') {
      query = query.eq('favorite', true);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[TalentPool] List error:', error.message);
      res.status(500).json({ error: 'Ошибка загрузки талант-пула' });
      return;
    }

    res.json({ talents: data || [] });
  } catch (err) {
    console.error('[TalentPool] Unhandled error:', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /api/talent-pool — add to pool manually
router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { candidate_name, email, phone, title, skills, experience, city, notes } = req.body;

    if (!candidate_name) {
      res.status(400).json({ error: 'Имя кандидата обязательно' });
      return;
    }

    const safeCandidateName = sanitizeString(candidate_name, 255);
    const safeEmail = email ? sanitizeEmail(email) : null;
    const safeTitle = title ? sanitizeString(title, 255) : null;
    const safeNotes = notes ? sanitizeString(notes, 2000) : null;

    const { data, error } = await supabase
      .from('talent_pool')
      .insert({
        user_id: req.userId!,
        candidate_name: safeCandidateName,
        email: safeEmail,
        phone: phone || null,
        title: safeTitle,
        skills: Array.isArray(skills) ? skills : (skills ? [skills] : []),
        experience: experience || null,
        city: city || null,
        notes: safeNotes,
        rating: 0,
        favorite: false,
      })
      .select()
      .single();

    if (error) {
      console.error('[TalentPool] Create error:', error.message);
      res.status(500).json({ error: 'Ошибка добавления в талант-пул' });
      return;
    }

    res.status(201).json({ talent: data });
  } catch (err) {
    console.error('[TalentPool] Unhandled error:', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /api/talent-pool/from-candidate/:candidateId — save analyzed candidate to talent pool
router.post('/from-candidate/:candidateId', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!isValidUUID(req.params.candidateId)) { res.status(400).json({ error: 'Некорректный ID кандидата' }); return; }
    const { candidateId } = req.params;

    // Get candidate with vacancy ownership check
    const { data: candidate, error: candidateError } = await supabase
      .from('candidates')
      .select('id, full_name, email, phone, form_responses, vacancy_id, vacancies!inner(created_by, title)')
      .eq('id', candidateId)
      .eq('vacancies.created_by', req.userId!)
      .single();

    if (candidateError && candidateError.code !== 'PGRST116') {
      console.error('[TalentPool] Candidate lookup error:', candidateError.message);
    }

    if (!candidate) {
      res.status(404).json({ error: 'Кандидат не найден' });
      return;
    }

    // Get AI analysis if exists
    const { data: analysis } = await supabase
      .from('ai_analysis')
      .select('overall_score, scores, summary')
      .eq('candidate_id', candidateId)
      .single();

    // Extract skills and experience from form_responses
    const responses = candidate.form_responses as Record<string, unknown> | null;
    const skillsRaw = responses?.['Навыки'] as string | undefined;
    const experienceRaw = responses?.['Опыт работы'] as string | undefined;
    const skills = skillsRaw ? skillsRaw.split(',').map((s: string) => s.trim()).filter(Boolean) : [];

    const { data, error } = await supabase
      .from('talent_pool')
      .insert({
        user_id: req.userId!,
        candidate_name: candidate.full_name,
        email: candidate.email || null,
        phone: candidate.phone || null,
        title: null,
        skills,
        experience: experienceRaw || null,
        city: null,
        rating: analysis?.overall_score ? Math.round(analysis.overall_score / 20) : 0,
        favorite: false,
        source_vacancy_id: candidate.vacancy_id,
        source_candidate_id: candidate.id,
        notes: analysis?.summary || null,
      })
      .select()
      .single();

    if (error) {
      console.error('[TalentPool] From-candidate error:', error.message);
      res.status(500).json({ error: 'Ошибка сохранения в талант-пул' });
      return;
    }

    res.status(201).json({ talent: data });
  } catch (err) {
    console.error('[TalentPool] Unhandled error:', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// PUT /api/talent-pool/:id — update (rating, favorite, notes, etc.)
router.put('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!isValidUUID(req.params.id)) { res.status(400).json({ error: 'Некорректный ID' }); return; }
    const { candidate_name, email, phone, title, skills, experience, city, rating, favorite, notes } = req.body;

    // Verify ownership
    const { data: existing } = await supabase
      .from('talent_pool')
      .select('id')
      .eq('id', req.params.id)
      .eq('user_id', req.userId!)
      .single();

    if (!existing) {
      res.status(404).json({ error: 'Запись не найдена' });
      return;
    }

    const updates: Record<string, unknown> = {};
    if (candidate_name !== undefined) updates.candidate_name = sanitizeString(candidate_name, 255);
    if (email !== undefined) updates.email = email ? sanitizeEmail(email) : null;
    if (phone !== undefined) updates.phone = phone;
    if (title !== undefined) updates.title = title ? sanitizeString(title, 255) : null;
    if (skills !== undefined) updates.skills = Array.isArray(skills) ? skills : [skills];
    if (experience !== undefined) updates.experience = experience;
    if (city !== undefined) updates.city = city;
    if (rating !== undefined) updates.rating = rating;
    if (favorite !== undefined) updates.favorite = favorite;
    if (notes !== undefined) updates.notes = notes ? sanitizeString(notes, 2000) : null;

    const { data, error } = await supabase
      .from('talent_pool')
      .update(updates)
      .eq('id', req.params.id)
      .eq('user_id', req.userId!)
      .select()
      .single();

    if (error) {
      console.error('[TalentPool] Update error:', error.message);
      res.status(500).json({ error: 'Ошибка обновления' });
      return;
    }

    res.json({ talent: data });
  } catch (err) {
    console.error('[TalentPool] Unhandled error:', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// DELETE /api/talent-pool/:id — remove from pool
router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!isValidUUID(req.params.id)) { res.status(400).json({ error: 'Некорректный ID' }); return; }
    const { error } = await supabase
      .from('talent_pool')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.userId!);

    if (error) {
      console.error('[TalentPool] Delete error:', error.message);
      res.status(500).json({ error: 'Ошибка удаления' });
      return;
    }

    res.json({ success: true });
  } catch (err) {
    console.error('[TalentPool] Unhandled error:', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

export default router;
