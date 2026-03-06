import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { supabase } from '../config/supabase';
import { authenticate, AuthRequest } from '../middleware/auth';
import { generateVerificationCode, sendVerificationEmail } from '../services/email';

const router = Router();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MIN_PASSWORD_LENGTH = 8;
const MAX_NAME_LENGTH = 100;

function makeSlug(base: string, suffix: string): string {
  return (
    base
      .toLowerCase()
      .replace(/[^a-z0-9а-яё]/gi, '-')
      .replace(/-+/g, '-')
      .slice(0, 40) +
    '-' +
    suffix
  );
}

// ── Register ─────────────────────────────────────────────────────────────────
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, name, company_name } = req.body;

    if (!email || !password || !name) {
      res.status(400).json({ error: 'email, password, and name are required' });
      return;
    }

    const sanitizedEmail = String(email).trim().toLowerCase();
    const sanitizedName = String(name).trim();
    const sanitizedCompany = company_name ? String(company_name).trim().slice(0, 255) : '';

    if (!EMAIL_REGEX.test(sanitizedEmail)) {
      res.status(400).json({ error: 'Invalid email format' });
      return;
    }

    if (!sanitizedName || sanitizedName.length > MAX_NAME_LENGTH) {
      res.status(400).json({ error: 'Name must be between 1 and 100 characters' });
      return;
    }

    if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
      res.status(400).json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const code = generateVerificationCode();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    const { data: user, error } = await supabase
      .from('users')
      .insert({
        email: sanitizedEmail,
        password_hash: passwordHash,
        name: sanitizedName,
        company_name: sanitizedCompany || null,
        email_verified: false,
        verification_code: code,
        verification_code_expires_at: expiresAt,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        res.status(409).json({ error: 'Email already registered' });
      } else {
        res.status(500).json({ error: 'Registration failed' });
      }
      return;
    }

    // Create organization for the new user
    const orgBase = sanitizedCompany || sanitizedName;
    const slug = makeSlug(orgBase, user.id.slice(0, 6));
    const orgName = sanitizedCompany || `${sanitizedName}'s Org`;

    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .insert({ name: orgName, slug, plan: 'free', owner_id: user.id })
      .select()
      .single();

    let orgId: string | undefined;

    if (!orgError && org) {
      orgId = org.id;
      await supabase
        .from('organization_members')
        .insert({ org_id: org.id, user_id: user.id, role: 'owner' });
    }

    // Send verification email (non-blocking)
    sendVerificationEmail(sanitizedEmail, sanitizedName, code).catch(() => {});

    const token = jwt.sign(
      { userId: user.id, email: user.email, orgId, role: user.role || 'user' },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' },
    );

    res.status(201).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        company_name: user.company_name,
        email_verified: false,
        role: user.role || 'user',
        org_id: orgId,
      },
      needs_verification: true,
    });
  } catch {
    res.status(500).json({ error: 'Registration failed' });
  }
});

// ── Login ─────────────────────────────────────────────────────────────────────
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'email and password are required' });
      return;
    }

    const sanitizedEmail = String(email).trim().toLowerCase();

    if (!EMAIL_REGEX.test(sanitizedEmail)) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, name, password_hash, email_verified, company_name, role')
      .eq('email', sanitizedEmail)
      .single();

    if (error || !user) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const valid = await bcrypt.compare(String(password), user.password_hash);
    if (!valid) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    // Get user's org
    const { data: membership } = await supabase
      .from('organization_members')
      .select('org_id, role, organizations(id, name, slug, plan)')
      .eq('user_id', user.id)
      .order('joined_at', { ascending: true })
      .limit(1)
      .single();

    const orgId = membership?.org_id;
    const orgsRaw = membership?.organizations;
    const orgData = (Array.isArray(orgsRaw) ? orgsRaw[0] : orgsRaw) as { id: string; name: string; slug: string; plan: string } | null | undefined;

    const token = jwt.sign(
      { userId: user.id, email: user.email, orgId, role: user.role || 'user' },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' },
    );

    const responseUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      company_name: user.company_name,
      email_verified: user.email_verified,
      role: user.role || 'user',
      org_id: orgId,
    };

    if (!user.email_verified) {
      res.json({
        token,
        user: responseUser,
        organization: orgData,
        needs_verification: true,
      });
      return;
    }

    res.json({ token, user: responseUser, organization: orgData });
  } catch {
    res.status(500).json({ error: 'Login failed' });
  }
});

// ── Verify email ──────────────────────────────────────────────────────────────
router.post('/verify', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { code } = req.body;

    if (!code || typeof code !== 'string') {
      res.status(400).json({ error: 'Verification code is required' });
      return;
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('id, verification_code, verification_code_expires_at, email_verified')
      .eq('id', req.userId!)
      .single();

    if (error || !user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    if (user.email_verified) {
      res.json({ success: true, already_verified: true });
      return;
    }

    if (!user.verification_code || user.verification_code !== code.trim()) {
      res.status(400).json({ error: 'Неверный код подтверждения' });
      return;
    }

    if (new Date(user.verification_code_expires_at) < new Date()) {
      res.status(400).json({ error: 'Код истёк. Запросите новый.' });
      return;
    }

    await supabase
      .from('users')
      .update({
        email_verified: true,
        verification_code: null,
        verification_code_expires_at: null,
      })
      .eq('id', req.userId!);

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Verification failed' });
  }
});

// ── Resend code ───────────────────────────────────────────────────────────────
router.post('/resend-code', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, name, email_verified, verification_code_expires_at')
      .eq('id', req.userId!)
      .single();

    if (error || !user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    if (user.email_verified) {
      res.json({ success: true, already_verified: true });
      return;
    }

    // Rate limit: 1 per minute
    if (user.verification_code_expires_at) {
      const expiresAt = new Date(user.verification_code_expires_at);
      const oldCodeAge = 15 * 60 * 1000 - (expiresAt.getTime() - Date.now());
      if (oldCodeAge < 60 * 1000) {
        res.status(429).json({ error: 'Подождите минуту перед повторной отправкой' });
        return;
      }
    }

    const code = generateVerificationCode();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    await supabase
      .from('users')
      .update({ verification_code: code, verification_code_expires_at: expiresAt })
      .eq('id', req.userId!);

    sendVerificationEmail(user.email, user.name, code).catch(() => {});

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to resend code' });
  }
});

// ── Update profile ────────────────────────────────────────────────────────────
router.put('/profile', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, company_name } = req.body;
    const sanitizedName = String(name || '').trim();

    if (!sanitizedName || sanitizedName.length > 100) {
      res.status(400).json({ error: 'Name must be between 1 and 100 characters' });
      return;
    }

    const updateData: Record<string, unknown> = { name: sanitizedName };
    if (company_name !== undefined) {
      updateData.company_name = company_name ? String(company_name).trim().slice(0, 255) : null;
    }

    const { data, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', req.userId!)
      .select('id, email, name, company_name, email_verified, role')
      .single();

    if (error || !data) {
      res.status(500).json({ error: 'Failed to update profile' });
      return;
    }

    res.json({ user: data });
  } catch {
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

export default router;
