import { Router, Response } from 'express';
import { supabase } from '../config/supabase';
import { authenticate, AuthRequest } from '../middleware/auth';
import { isValidUUID } from '../utils/validate';

const router = Router();
router.use(authenticate);

// GET / — list user's notifications (last 50)
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', req.userId!)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('[Notifications] List error:', error.message);
      res.status(500).json({ error: 'Ошибка загрузки уведомлений' });
      return;
    }

    res.json({ notifications: data ?? [] });
  } catch (err) {
    console.error('[Notifications] Unhandled error:', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// GET /unread-count — return count of unread
router.get('/unread-count', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { count, error } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', req.userId!)
      .eq('read', false);

    if (error) {
      console.error('[Notifications] Unread count error:', error.message);
      res.status(500).json({ error: 'Ошибка получения количества' });
      return;
    }

    res.json({ count: count ?? 0 });
  } catch (err) {
    console.error('[Notifications] Unhandled error:', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// PATCH /:id/read — mark single notification as read
router.patch('/:id/read', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!isValidUUID(req.params.id)) { res.status(400).json({ error: 'Некорректный ID' }); return; }
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', req.params.id)
      .eq('user_id', req.userId!);

    if (error) {
      console.error('[Notifications] Mark read error:', error.message);
      res.status(500).json({ error: 'Ошибка обновления' });
      return;
    }

    res.json({ success: true });
  } catch (err) {
    console.error('[Notifications] Unhandled error:', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// PATCH /read-all — mark all as read
router.patch('/read-all', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', req.userId!)
      .eq('read', false);

    if (error) {
      console.error('[Notifications] Mark all read error:', error.message);
      res.status(500).json({ error: 'Ошибка обновления' });
      return;
    }

    res.json({ success: true });
  } catch (err) {
    console.error('[Notifications] Unhandled error:', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

export default router;
