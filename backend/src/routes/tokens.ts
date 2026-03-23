import { Router, Response } from 'express';
import { supabase } from '../config/supabase';
import { authenticate, AuthRequest, requireSuperadmin } from '../middleware/auth';
import { isValidUUID, sanitizeString, sanitizeEmail } from '../utils/validate';

const router = Router();

// Token costs
const TOKEN_COSTS = {
  ai_analysis: 10,
  interview_questions: 5,
  form_generation: 3,
  csv_export: 2,
};

// ── Get user balance ──
router.get('/balance', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('token_balance, tokens_used')
      .eq('id', req.userId!)
      .single();

    if (error || !user) {
      // Fallback if columns don't exist yet
      res.json({ balance: 100, used: 0 });
      return;
    }

    res.json({ balance: user.token_balance ?? 100, used: user.tokens_used ?? 0 });
  } catch (err) {
    console.error('[Tokens/Balance] Error:', err);
    res.json({ balance: 100, used: 0 });
  }
});

// ── Get token plans ──
router.get('/plans', async (_req, res: Response): Promise<void> => {
  try {
    const { data: plans, error } = await supabase
      .from('token_plans')
      .select('*')
      .eq('active', true)
      .order('tokens', { ascending: true });

    if (error) {
      // Fallback with default plans if table doesn't exist
      res.json({ plans: [
        { id: '1', name: 'Стартер', tokens: 100, price_usd: 2.99, price_uzs: 38000, popular: false },
        { id: '2', name: 'Базовый', tokens: 500, price_usd: 9.99, price_uzs: 128000, popular: true },
        { id: '3', name: 'Про', tokens: 1500, price_usd: 24.99, price_uzs: 320000, popular: false },
        { id: '4', name: 'Бизнес', tokens: 5000, price_usd: 69.99, price_uzs: 900000, popular: false },
      ]});
      return;
    }

    res.json({ plans: plans || [] });
  } catch (err) {
    console.error('[Tokens/Plans] Error:', err);
    res.status(500).json({ error: 'Ошибка загрузки тарифов' });
  }
});

// ── Get transaction history ──
router.get('/history', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { data: transactions, error } = await supabase
      .from('token_transactions')
      .select('*')
      .eq('user_id', req.userId!)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('[Tokens/History] Error:', error.message);
      res.json({ transactions: [] });
      return;
    }

    res.json({ transactions: transactions || [] });
  } catch (err) {
    console.error('[Tokens/History] Error:', err);
    res.json({ transactions: [] });
  }
});

// ── Use tokens (called internally by other routes) ──
router.post('/use', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { action, description } = req.body;
    const cost = TOKEN_COSTS[action as keyof typeof TOKEN_COSTS];

    if (!cost) {
      res.status(400).json({ error: 'Неизвестное действие' });
      return;
    }

    // Get current balance
    const { data: user } = await supabase
      .from('users')
      .select('token_balance, tokens_used, is_whitelisted')
      .eq('id', req.userId!)
      .single();

    const balance = user?.token_balance ?? 100;
    const isWhitelisted = user?.is_whitelisted ?? false;

    // Whitelisted users don't pay
    if (!isWhitelisted && balance < cost) {
      res.status(402).json({ error: 'Недостаточно токенов', balance, cost });
      return;
    }

    const newBalance = isWhitelisted ? balance : balance - cost;
    const newUsed = (user?.tokens_used ?? 0) + cost;

    // Update balance
    await supabase
      .from('users')
      .update({ token_balance: newBalance, tokens_used: newUsed })
      .eq('id', req.userId!);

    // Log transaction
    await supabase.from('token_transactions').insert({
      user_id: req.userId,
      type: 'usage',
      amount: -cost,
      balance_after: newBalance,
      description: description || action,
    }).then(() => {});

    // Log usage
    await supabase.from('usage_logs').insert({
      user_id: req.userId,
      action,
      tokens_cost: isWhitelisted ? 0 : cost,
    }).then(() => {});

    res.json({ success: true, balance: newBalance, cost: isWhitelisted ? 0 : cost });
  } catch (err) {
    console.error('[Tokens/Use] Error:', err);
    res.status(500).json({ error: 'Ошибка списания токенов' });
  }
});

// ── Admin: Get token stats ──
router.get('/admin/stats', authenticate, requireSuperadmin, async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { data: users } = await supabase
      .from('users')
      .select('token_balance, tokens_used');

    const allUsers = users || [];
    const totalBalance = allUsers.reduce((s, u) => s + (u.token_balance ?? 0), 0);
    const totalUsed = allUsers.reduce((s, u) => s + (u.tokens_used ?? 0), 0);

    const { data: transactions } = await supabase
      .from('token_transactions')
      .select('type, amount')
      .eq('type', 'purchase');

    const totalRevenue = (transactions || []).reduce((s, t) => s + Math.abs(t.amount), 0);

    const { data: usage } = await supabase
      .from('usage_logs')
      .select('action, tokens_cost');

    const usageLogs = usage || [];
    const byAction: Record<string, number> = {};
    usageLogs.forEach(l => {
      byAction[l.action] = (byAction[l.action] || 0) + 1;
    });

    res.json({
      stats: {
        total_balance_in_system: totalBalance,
        total_tokens_used: totalUsed,
        total_purchased: totalRevenue,
        active_users: allUsers.filter(u => (u.tokens_used ?? 0) > 0).length,
        usage_by_action: byAction,
      }
    });
  } catch (err) {
    console.error('[Tokens/AdminStats] Error:', err);
    res.json({ stats: { total_balance_in_system: 0, total_tokens_used: 0, total_purchased: 0, active_users: 0, usage_by_action: {} } });
  }
});

// ── Admin: Give bonus tokens ──
router.post('/admin/bonus', authenticate, requireSuperadmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { user_id, amount, reason } = req.body;

    if (!user_id || !amount || amount < 1) {
      res.status(400).json({ error: 'user_id и amount обязательны' });
      return;
    }

    if (!isValidUUID(user_id)) {
      res.status(400).json({ error: 'Некорректный user_id' });
      return;
    }

    if (amount > 10000) {
      res.status(400).json({ error: 'Максимум 10,000 токенов за раз' });
      return;
    }

    const { data: user } = await supabase
      .from('users')
      .select('token_balance')
      .eq('id', user_id)
      .single();

    if (!user) {
      res.status(404).json({ error: 'Пользователь не найден' });
      return;
    }

    const newBalance = (user.token_balance ?? 0) + amount;

    await supabase
      .from('users')
      .update({ token_balance: newBalance })
      .eq('id', user_id);

    await supabase.from('token_transactions').insert({
      user_id,
      type: 'bonus',
      amount,
      balance_after: newBalance,
      description: reason || 'Бонус от администратора',
    });

    console.log(`[Tokens/Bonus] Admin ${req.userId} gave ${amount} tokens to ${user_id}. Reason: ${reason || 'none'}. New balance: ${newBalance}`);

    res.json({ success: true, new_balance: newBalance });
  } catch (err) {
    console.error('[Tokens/Bonus] Error:', err);
    res.status(500).json({ error: 'Ошибка начисления' });
  }
});

// ── Admin: Whitelist management ──
router.get('/admin/whitelist', authenticate, requireSuperadmin, async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { data, error } = await supabase
      .from('admin_whitelist')
      .select('*')
      .order('created_at', { ascending: false });

    res.json({ whitelist: error ? [] : (data || []) });
  } catch (err) {
    console.error('[Whitelist/List] Error:', err);
    res.json({ whitelist: [] });
  }
});

router.post('/admin/whitelist', authenticate, requireSuperadmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { email, note } = req.body;
    if (!email) {
      res.status(400).json({ error: 'Email обязателен' });
      return;
    }

    // Add to whitelist table
    await supabase.from('admin_whitelist').insert({
      email: String(email).trim().toLowerCase(),
      added_by: req.userId,
      note: note || null,
    });

    // Also set user as whitelisted if they exist
    await supabase
      .from('users')
      .update({ is_whitelisted: true })
      .eq('email', String(email).trim().toLowerCase());

    res.json({ success: true });
  } catch (err) {
    console.error('[Whitelist/Add] Error:', err);
    res.status(500).json({ error: 'Ошибка добавления' });
  }
});

router.delete('/admin/whitelist/:id', authenticate, requireSuperadmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!isValidUUID(req.params.id)) { res.status(400).json({ error: 'Некорректный ID' }); return; }
    // Get email before deleting
    const { data: entry } = await supabase
      .from('admin_whitelist')
      .select('email')
      .eq('id', req.params.id)
      .single();

    await supabase.from('admin_whitelist').delete().eq('id', req.params.id);

    // Remove whitelisted flag
    if (entry?.email) {
      await supabase.from('users').update({ is_whitelisted: false }).eq('email', entry.email);
    }

    res.json({ success: true });
  } catch (err) {
    console.error('[Whitelist/Remove] Error:', err);
    res.status(500).json({ error: 'Ошибка удаления' });
  }
});

export default router;
