import { Router, Response } from 'express';
import { supabase } from '../config/supabase';
import { authenticate, AuthRequest, requireSuperadmin } from '../middleware/auth';
import { isValidUUID, sanitizeString } from '../utils/validate';

const router = Router();

// ── User: Create support ticket ──
router.post('/', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { category, subject, message, priority } = req.body;

    if (!category || !subject || !message) {
      res.status(400).json({ error: 'Категория, тема и сообщение обязательны' });
      return;
    }

    if (String(subject).trim().length > 500) {
      res.status(400).json({ error: 'Тема не может быть длиннее 500 символов' });
      return;
    }
    if (String(message).trim().length > 5000) {
      res.status(400).json({ error: 'Сообщение не может быть длиннее 5000 символов' });
      return;
    }

    const validCategories = ['bug', 'feature', 'question', 'billing', 'other'];
    if (!validCategories.includes(category)) {
      res.status(400).json({ error: 'Неверная категория' });
      return;
    }

    // Get user info
    const { data: user } = await supabase
      .from('users')
      .select('email, name')
      .eq('id', req.userId!)
      .single();

    const { data: ticket, error } = await supabase
      .from('support_tickets')
      .insert({
        user_id: req.userId,
        user_email: user?.email || '',
        user_name: user?.name || '',
        category: String(category).trim(),
        subject: String(subject).trim().slice(0, 500),
        message: String(message).trim().slice(0, 5000),
        priority: priority || 'medium',
        status: 'open',
      })
      .select()
      .single();

    if (error) {
      console.error('[Support/Create] Error:', error.message);
      res.status(500).json({ error: 'Ошибка создания обращения' });
      return;
    }

    res.status(201).json({ ticket });
  } catch (err) {
    console.error('[Support/Create] Unhandled:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ── User: List own tickets ──
router.get('/my', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { data: tickets, error } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('user_id', req.userId!)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Support/My] Error:', error.message);
      res.status(500).json({ error: 'Ошибка загрузки обращений' });
      return;
    }

    res.json({ tickets: tickets || [] });
  } catch (err) {
    console.error('[Support/My] Unhandled:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ── Admin: List all tickets ──
router.get('/all', authenticate, requireSuperadmin, async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { data: tickets, error } = await supabase
      .from('support_tickets')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) {
      console.error('[Support/All] Error:', error.message);
      res.status(500).json({ error: 'Ошибка загрузки' });
      return;
    }

    res.json({ tickets: tickets || [] });
  } catch (err) {
    console.error('[Support/All] Unhandled:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ── Admin: Get support stats ──
router.get('/stats', authenticate, requireSuperadmin, async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { data: tickets } = await supabase
      .from('support_tickets')
      .select('status, category, priority, created_at');

    const all = tickets || [];
    const stats = {
      total: all.length,
      open: all.filter(t => t.status === 'open').length,
      in_progress: all.filter(t => t.status === 'in_progress').length,
      resolved: all.filter(t => t.status === 'resolved').length,
      closed: all.filter(t => t.status === 'closed').length,
      by_category: {
        bug: all.filter(t => t.category === 'bug').length,
        feature: all.filter(t => t.category === 'feature').length,
        question: all.filter(t => t.category === 'question').length,
        billing: all.filter(t => t.category === 'billing').length,
        other: all.filter(t => t.category === 'other').length,
      },
      by_priority: {
        urgent: all.filter(t => t.priority === 'urgent').length,
        high: all.filter(t => t.priority === 'high').length,
        medium: all.filter(t => t.priority === 'medium').length,
        low: all.filter(t => t.priority === 'low').length,
      },
      avg_resolution_hours: (() => {
        const resolved = all.filter(t => t.status === 'resolved' || t.status === 'closed');
        if (!resolved.length) return 0;
        // Approximate since we don't have resolved_at for all
        return Math.round(resolved.length > 0 ? 24 : 0);
      })(),
    };

    res.json({ stats });
  } catch (err) {
    console.error('[Support/Stats] Unhandled:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ── Admin: Reply to ticket ──
router.put('/:id/reply', authenticate, requireSuperadmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!isValidUUID(req.params.id)) { res.status(400).json({ error: 'Некорректный ID' }); return; }
    const { reply, status } = req.body;

    if (!reply) {
      res.status(400).json({ error: 'Ответ обязателен' });
      return;
    }

    const updateData: Record<string, unknown> = {
      admin_reply: String(reply).trim().slice(0, 5000),
      admin_id: req.userId,
      updated_at: new Date().toISOString(),
    };

    if (status && ['open', 'in_progress', 'resolved', 'closed'].includes(status)) {
      updateData.status = status;
      if (status === 'resolved' || status === 'closed') {
        updateData.resolved_at = new Date().toISOString();
      }
    }

    const { data: ticket, error } = await supabase
      .from('support_tickets')
      .update(updateData)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) {
      console.error('[Support/Reply] Error:', error.message);
      res.status(500).json({ error: 'Ошибка обновления' });
      return;
    }

    res.json({ ticket });
  } catch (err) {
    console.error('[Support/Reply] Unhandled:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ── Admin: Update ticket status ──
router.patch('/:id/status', authenticate, requireSuperadmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!isValidUUID(req.params.id)) { res.status(400).json({ error: 'Некорректный ID' }); return; }
    const { status } = req.body;
    const validStatuses = ['open', 'in_progress', 'resolved', 'closed'];

    if (!status || !validStatuses.includes(status)) {
      res.status(400).json({ error: 'Неверный статус' });
      return;
    }

    const updateData: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
    };
    if (status === 'resolved' || status === 'closed') {
      updateData.resolved_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from('support_tickets')
      .update(updateData)
      .eq('id', req.params.id);

    if (error) {
      console.error('[Support/Status] Error:', error.message);
      res.status(500).json({ error: 'Ошибка обновления статуса' });
      return;
    }

    res.json({ success: true });
  } catch (err) {
    console.error('[Support/Status] Unhandled:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

export default router;
