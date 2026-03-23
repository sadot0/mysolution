import { Router, Response } from 'express';
import { supabase } from '../config/supabase';
import { authenticate, AuthRequest } from '../middleware/auth';
import { isValidUUID } from '../utils/validate';

const router = Router();

// GET /methods — available payment methods
router.get('/methods', (_req, res: Response): void => {
  res.json({
    methods: [
      { id: 'click', name: 'Click', icon: '💳', available: false, coming: 'Q2 2026' },
      { id: 'payme', name: 'Payme', icon: '💳', available: false, coming: 'Q2 2026' },
      { id: 'uzcard', name: 'Uzcard', icon: '💳', available: false, coming: 'Q2 2026' },
      { id: 'stripe', name: 'Stripe (Visa/MC)', icon: '💳', available: false, coming: 'Q2 2026' },
    ],
  });
});

// POST /create-order — create payment order (placeholder)
router.post('/create-order', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { plan_id, method } = req.body;

    // Get plan
    const { data: plan } = await supabase
      .from('token_plans')
      .select('*')
      .eq('id', plan_id)
      .single();

    if (!plan) {
      res.status(404).json({ error: 'Тариф не найден' });
      return;
    }

    // For now, return a placeholder response
    res.json({
      order_id: `ORD-${Date.now()}`,
      plan: plan.name,
      tokens: plan.tokens,
      amount_usd: plan.price_usd,
      amount_uzs: plan.price_uzs,
      method,
      status: 'pending',
      message: 'Оплата будет доступна в Q2 2026. Свяжитесь с нами для ручного пополнения.',
      contact: 'info@mysolution.uz',
    });
  } catch (err) {
    console.error('[Payments/CreateOrder] Error:', err);
    res.status(500).json({ error: 'Ошибка создания заказа' });
  }
});

// POST /manual-topup — admin manually adds tokens (for now)
router.post('/manual-topup', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { user_id, amount, payment_ref } = req.body;

    // Only superadmin can do manual topups
    const { data: admin } = await supabase
      .from('users')
      .select('role')
      .eq('id', req.userId!)
      .single();

    if (admin?.role !== 'superadmin') {
      res.status(403).json({ error: 'Только администратор может пополнять баланс' });
      return;
    }

    if (!user_id || !isValidUUID(user_id)) {
      res.status(400).json({ error: 'Некорректный user_id' });
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

    await supabase.from('users').update({ token_balance: newBalance }).eq('id', user_id);

    await supabase.from('token_transactions').insert({
      user_id,
      type: 'purchase',
      amount,
      balance_after: newBalance,
      description: `Ручное пополнение${payment_ref ? ': ' + payment_ref : ''}`,
    });

    res.json({ success: true, new_balance: newBalance });
  } catch (err) {
    console.error('[Payments/ManualTopup] Error:', err);
    res.status(500).json({ error: 'Ошибка пополнения' });
  }
});

export default router;
