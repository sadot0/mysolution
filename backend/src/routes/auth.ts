import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { supabase } from '../config/supabase';
import { authenticate, AuthRequest } from '../middleware/auth';
import { generateVerificationCode, sendVerificationEmail } from '../services/email';

const router = Router();

// ── Account lockout tracking ─────────────────────────────────────────────────
interface LoginAttemptEntry {
  count: number;
  lockedUntil?: Date;
}

const loginAttempts = new Map<string, LoginAttemptEntry>();

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

// Clean up old lockout entries every 30 minutes
setInterval(() => {
  const now = new Date();
  for (const [ip, entry] of loginAttempts.entries()) {
    if (entry.lockedUntil && entry.lockedUntil < now) {
      loginAttempts.delete(ip);
    }
  }
}, 30 * 60 * 1000);

function checkLockout(ip: string): boolean {
  const entry = loginAttempts.get(ip);
  if (!entry) return false;
  if (entry.lockedUntil && entry.lockedUntil > new Date()) return true;
  if (entry.lockedUntil && entry.lockedUntil <= new Date()) {
    loginAttempts.delete(ip);
    return false;
  }
  return false;
}

function recordFailedLogin(ip: string): void {
  const entry = loginAttempts.get(ip) || { count: 0 };
  entry.count += 1;
  if (entry.count >= MAX_LOGIN_ATTEMPTS) {
    entry.lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
  }
  loginAttempts.set(ip, entry);
}

function resetLoginAttempts(ip: string): void {
  loginAttempts.delete(ip);
}

// In-memory fallback code store (used when DB verification_code column doesn't exist)
const memCodes = new Map<string, { code: string; expires: number; name: string }>();

function storeMemCode(userId: string, code: string, name: string) {
  memCodes.set(userId, { code, expires: Date.now() + 15 * 60 * 1000, name });
}

function checkMemCode(userId: string, code: string): boolean {
  const entry = memCodes.get(userId);
  if (!entry) return false;
  if (Date.now() > entry.expires) { memCodes.delete(userId); return false; }
  if (entry.code !== code) return false;
  memCodes.delete(userId);
  return true;
}

function sanitizeHtml(str: string): string {
  return str.replace(/[<>&"']/g, (c) => {
    const map: Record<string, string> = { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' };
    return map[c] || c;
  });
}

// ── Forgot-password reset codes ──────────────────────────────────────────────
interface ResetCodeEntry {
  code: string;
  expires: number;
}

const resetCodes = new Map<string, ResetCodeEntry>();

// Rate-limit tracking for forgot-password requests (max 3 per email per 10 min)
const forgotPasswordAttempts = new Map<string, number[]>();

function canRequestReset(email: string): boolean {
  const now = Date.now();
  const windowMs = 10 * 60 * 1000; // 10 minutes
  const attempts = forgotPasswordAttempts.get(email) || [];
  const recent = attempts.filter((t) => now - t < windowMs);
  forgotPasswordAttempts.set(email, recent);
  return recent.length < 3;
}

function recordResetAttempt(email: string): void {
  const attempts = forgotPasswordAttempts.get(email) || [];
  attempts.push(Date.now());
  forgotPasswordAttempts.set(email, attempts);
}

// Clean up expired reset codes and rate-limit entries every 30 minutes
setInterval(() => {
  const now = Date.now();
  for (const [email, entry] of resetCodes.entries()) {
    if (now > entry.expires) resetCodes.delete(email);
  }
  const windowMs = 10 * 60 * 1000;
  for (const [email, attempts] of forgotPasswordAttempts.entries()) {
    const recent = attempts.filter((t) => now - t < windowMs);
    if (recent.length === 0) forgotPasswordAttempts.delete(email);
    else forgotPasswordAttempts.set(email, recent);
  }
}, 30 * 60 * 1000);

// ── TOTP helpers ─────────────────────────────────────────────────────────────
function generateBase32Secret(length = 32): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const bytes = crypto.randomBytes(length);
  return Array.from(bytes)
    .map((b) => alphabet[b % 32])
    .join('');
}

function base32Decode(encoded: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const c of encoded.toUpperCase()) {
    const val = alphabet.indexOf(c);
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, '0');
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

function verifyTOTP(secret: string, code: string): boolean {
  // Check current window and +/- 1 for clock drift
  for (const offset of [-1, 0, 1]) {
    const time = Math.floor(Date.now() / 1000 / 30) + offset;
    const buffer = Buffer.alloc(8);
    buffer.writeBigUInt64BE(BigInt(time));
    const key = base32Decode(secret);
    const hmac = crypto.createHmac('sha1', key).update(buffer).digest();
    const off = hmac[hmac.length - 1] & 0x0f;
    const c =
      ((hmac[off] & 0x7f) << 24) |
      ((hmac[off + 1] & 0xff) << 16) |
      ((hmac[off + 2] & 0xff) << 8) |
      (hmac[off + 3] & 0xff);
    if (String(c % 1000000).padStart(6, '0') === code) return true;
  }
  return false;
}

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

// ── Health check ─────────────────────────────────────────────────────────────
router.get('/health', (_req: Request, res: Response): void => {
  res.json({ status: 'ok', service: 'auth', timestamp: new Date().toISOString() });
});

// ── Register ─────────────────────────────────────────────────────────────────
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, name, company_name } = req.body;

    if (!email || !password || !name) {
      res.status(400).json({ error: 'email, password, and name are required' });
      return;
    }

    const sanitizedEmail = String(email).trim().toLowerCase();
    const sanitizedName = sanitizeHtml(String(name).trim());
    const sanitizedCompany = company_name ? sanitizeHtml(String(company_name).trim().slice(0, 255)) : '';

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

    // Try inserting with new columns; fall back to basic insert if migration not run
    let userResult = await supabase
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

    // If column doesn't exist yet (PGRST204 = schema cache miss), retry without new columns
    let usingMemoryCode = false;
    if (userResult.error?.code === '42703' || userResult.error?.code === 'PGRST204') {
      userResult = await supabase
        .from('users')
        .insert({
          email: sanitizedEmail,
          password_hash: passwordHash,
          name: sanitizedName,
        })
        .select()
        .single();
      usingMemoryCode = true;
    }

    const { data: user, error } = userResult;

    if (error) {
      console.error('[Auth/Register] Supabase error:', error.code, error.message, error.details);
      if (error.code === '23505') {
        res.status(409).json({ error: 'Этот email уже зарегистрирован' });
      } else if (error.message?.includes('fetch failed') || error.message?.includes('ENOTFOUND')) {
        res.status(503).json({ error: 'Сервер базы данных недоступен. Попробуйте позже.' });
      } else {
        res.status(500).json({ error: 'Ошибка регистрации. Попробуйте позже.' });
      }
      return;
    }

    // Store code in memory when DB columns don't exist
    if (usingMemoryCode) {
      storeMemCode(user.id, code, sanitizedName);
    }

    // Try to create organization (only works if migration was run)
    let orgId: string | undefined;
    const orgBase = sanitizedCompany || sanitizedName;
    const slug = makeSlug(orgBase, user.id.slice(0, 6));
    const orgName = sanitizedCompany || `${sanitizedName}'s Org`;

    try {
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .insert({ name: orgName, slug, plan: 'free', owner_id: user.id })
        .select()
        .single();

      if (orgError) {
        console.warn('[Auth/Register] Organization creation skipped (table may not exist):', orgError.message);
      } else if (org) {
        orgId = org.id;
        const { error: memberError } = await supabase
          .from('organization_members')
          .insert({ org_id: org.id, user_id: user.id, role: 'owner' });
        if (memberError) {
          console.error('[Auth/Register] Failed to add org member:', memberError.message);
        }
      }
    } catch (orgErr) {
      console.warn('[Auth/Register] Organization creation failed (non-critical):', orgErr instanceof Error ? orgErr.message : orgErr);
    }

    // Send verification email (non-blocking; logs code to console if email fails)
    sendVerificationEmail(sanitizedEmail, sanitizedName, code).catch((err) => {
      console.error('[Auth] Email send failed:', err?.message);
      console.log(`[Auth] Verification code for ${sanitizedEmail}: ${code}`);
    });

    const token = jwt.sign(
      { userId: user.id, email: user.email, orgId, role: (user as Record<string, unknown>).role || 'user' },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' },
    );

    res.status(201).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        company_name: (user as Record<string, unknown>).company_name ?? null,
        email_verified: (user as Record<string, unknown>).email_verified ?? false,
        role: (user as Record<string, unknown>).role || 'user',
        org_id: orgId,
      },
      needs_verification: true,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[Auth/Register] Unhandled error:', msg);
    if (msg.includes('fetch failed') || msg.includes('ENOTFOUND') || msg.includes('ETIMEDOUT')) {
      res.status(503).json({ error: 'Сервер базы данных недоступен. Проверьте подключение.' });
    } else {
      res.status(500).json({ error: 'Ошибка регистрации. Попробуйте позже.' });
    }
  }
});

// ── Login ─────────────────────────────────────────────────────────────────────
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';

    // Check account lockout
    if (checkLockout(clientIp)) {
      res.status(429).json({ error: 'Слишком много попыток входа. Попробуйте через 15 минут.' });
      return;
    }

    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'email и пароль обязательны' });
      return;
    }

    const sanitizedEmail = String(email).trim().toLowerCase();

    if (!EMAIL_REGEX.test(sanitizedEmail)) {
      recordFailedLogin(clientIp);
      res.status(401).json({ error: 'Неверные учётные данные' });
      return;
    }

    let userQuery = await supabase
      .from('users')
      .select('id, email, name, password_hash, email_verified, company_name, role, token_balance, tokens_used, is_whitelisted')
      .eq('email', sanitizedEmail)
      .single();

    // Fallback if new columns don't exist yet
    let columnsExist = true;
    if (userQuery.error?.code === '42703' || userQuery.error?.code === 'PGRST204') {
      columnsExist = false;
      userQuery = await supabase
        .from('users')
        .select('id, email, name, password_hash')
        .eq('email', sanitizedEmail)
        .single();
    }

    const { data: user, error } = userQuery;

    if (error || !user) {
      if (error && error.code !== 'PGRST116') {
        console.error('[Auth/Login] Supabase query error:', error.code, error.message);
      }
      recordFailedLogin(clientIp);
      res.status(401).json({ error: 'Неверные учётные данные' });
      return;
    }

    const valid = await bcrypt.compare(String(password), user.password_hash);
    if (!valid) {
      recordFailedLogin(clientIp);
      res.status(401).json({ error: 'Неверные учётные данные' });
      return;
    }

    // Successful login — reset lockout counter
    resetLoginAttempts(clientIp);

    // Get user's org — wrapped in try/catch so login works even without organization tables
    let orgId: string | undefined;
    let orgData: { id: string; name: string; slug: string; plan: string } | null | undefined;

    try {
      const { data: membership, error: membershipError } = await supabase
        .from('organization_members')
        .select('org_id, role, organizations(id, name, slug, plan)')
        .eq('user_id', user.id)
        .order('joined_at', { ascending: true })
        .limit(1)
        .single();

      if (membershipError && membershipError.code !== 'PGRST116') {
        console.warn('[Auth/Login] Org membership query issue:', membershipError.message);
      }

      orgId = membership?.org_id;
      const orgsRaw = membership?.organizations;
      orgData = (Array.isArray(orgsRaw) ? orgsRaw[0] : orgsRaw) as typeof orgData;
    } catch (orgErr) {
      console.warn('[Auth/Login] Organization lookup failed (non-critical):', orgErr instanceof Error ? orgErr.message : orgErr);
    }

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
      token_balance: user.token_balance ?? 100,
      tokens_used: user.tokens_used ?? 0,
      is_whitelisted: user.is_whitelisted ?? false,
    };

    // Only require verification if column exists and email is not verified
    if (columnsExist && !user.email_verified) {
      res.json({
        token,
        user: { ...responseUser, email_verified: false },
        organization: orgData,
        needs_verification: true,
      });
      return;
    }

    res.json({ token, user: { ...responseUser, email_verified: columnsExist ? user.email_verified : true }, organization: orgData });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[Auth/Login] Error:', msg);
    if (msg.includes('fetch failed') || msg.includes('ENOTFOUND') || msg.includes('ETIMEDOUT')) {
      res.status(503).json({ error: 'Сервер базы данных недоступен. Проверьте подключение.' });
    } else {
      res.status(500).json({ error: 'Ошибка входа. Попробуйте позже.' });
    }
  }
});

// ── Google OAuth ──────────────────────────────────────────────────────────────
router.post('/google', async (req: Request, res: Response): Promise<void> => {
  try {
    const { credential } = req.body;

    if (!credential || typeof credential !== 'string') {
      res.status(400).json({ error: 'Google credential token is required' });
      return;
    }

    // Verify the Google token (supports both ID token and authorization code)
    let googleUser: { email: string; name: string; picture?: string };
    try {
      let tokenInfo: Record<string, string>;

      // Check if it's an authorization code (starts with "4/") or an ID token (starts with "eyJ")
      if (credential.startsWith('4/') || credential.length < 200) {
        // It's an authorization code — exchange for tokens
        const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            code: credential,
            client_id: process.env.GOOGLE_CLIENT_ID || '',
            client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
            redirect_uri: `${process.env.FRONTEND_URL || 'https://mysolution.uz'}/login`,
            grant_type: 'authorization_code',
          }),
        });

        if (!tokenRes.ok) {
          const errText = await tokenRes.text();
          console.error('[Auth/Google] Code exchange failed:', errText);
          res.status(401).json({ error: 'Не удалось обменять код Google' });
          return;
        }

        const tokens = await tokenRes.json() as { id_token?: string; access_token?: string };

        if (tokens.id_token) {
          // Decode ID token
          const idTokenRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${tokens.id_token}`);
          tokenInfo = await idTokenRes.json() as Record<string, string>;
        } else if (tokens.access_token) {
          // Use access token to get user info
          const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { Authorization: `Bearer ${tokens.access_token}` },
          });
          tokenInfo = await userInfoRes.json() as Record<string, string>;
        } else {
          res.status(401).json({ error: 'Google не вернул токен' });
          return;
        }
      } else {
        // It's an ID token — verify directly
        const tokenInfoRes = await fetch(
          `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`,
        );

        if (!tokenInfoRes.ok) {
          res.status(401).json({ error: 'Недействительный Google токен' });
          return;
        }

        tokenInfo = await tokenInfoRes.json() as Record<string, string>;
      }

      if (!tokenInfo.email) {
        res.status(401).json({ error: 'Google токен не содержит email' });
        return;
      }

      // Optionally verify audience (client ID) if configured
      const googleClientId = process.env.GOOGLE_CLIENT_ID;
      if (googleClientId && tokenInfo.aud !== googleClientId) {
        console.error('[Auth/Google] Audience mismatch: expected', googleClientId, 'got', tokenInfo.aud);
        res.status(401).json({ error: 'Несоответствие аудитории Google токена' });
        return;
      }

      googleUser = {
        email: tokenInfo.email.toLowerCase(),
        name: tokenInfo.name || tokenInfo.email.split('@')[0],
        picture: tokenInfo.picture || undefined,
      };
    } catch (tokenErr) {
      console.error('[Auth/Google] Token verification error:', tokenErr instanceof Error ? tokenErr.message : tokenErr);
      res.status(401).json({ error: 'Не удалось проверить Google токен' });
      return;
    }

    // Check if user already exists
    const { data: existingUser, error: existingUserError } = await supabase
      .from('users')
      .select('id, email, name, company_name, email_verified, role')
      .eq('email', googleUser.email)
      .single();

    if (existingUserError && existingUserError.code !== 'PGRST116') {
      console.error('[Auth/Google] User lookup error:', existingUserError.message);
    }

    let userId: string;
    let userName: string;
    let userEmail: string;
    let userRole: string;
    let userCompanyName: string | null = null;
    let orgId: string | undefined;
    let orgData: { id: string; name: string; slug: string; plan: string } | null = null;

    if (existingUser) {
      userId = existingUser.id;
      userName = existingUser.name;
      userEmail = existingUser.email;
      userRole = existingUser.role || 'user';
      userCompanyName = existingUser.company_name || null;

      try {
        const { data: membership } = await supabase
          .from('organization_members')
          .select('org_id, role, organizations(id, name, slug, plan)')
          .eq('user_id', userId)
          .order('joined_at', { ascending: true })
          .limit(1)
          .single();

        if (membership) {
          orgId = membership.org_id;
          const orgsRaw = membership.organizations;
          orgData = (Array.isArray(orgsRaw) ? orgsRaw[0] : orgsRaw) as { id: string; name: string; slug: string; plan: string } | null;
        }
      } catch (orgErr) {
        console.warn('[Auth/Google] Org lookup failed (non-critical):', orgErr instanceof Error ? orgErr.message : orgErr);
      }
    } else {
      const randomPassword = crypto.randomBytes(32).toString('hex');
      const passwordHash = await bcrypt.hash(randomPassword, 12);

      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert({
          email: googleUser.email,
          password_hash: passwordHash,
          name: googleUser.name,
          email_verified: true,
        })
        .select()
        .single();

      if (createError || !newUser) {
        console.error('[Auth/Google] Failed to create user:', createError?.message, createError?.details);
        res.status(500).json({ error: 'Не удалось создать аккаунт' });
        return;
      }

      userId = newUser.id;
      userName = newUser.name;
      userEmail = newUser.email;
      userRole = (newUser as Record<string, unknown>).role as string || 'user';

      try {
        const slug = makeSlug(googleUser.name, newUser.id.slice(0, 6));
        const orgName = `${googleUser.name}'s Org`;

        const { data: org, error: orgError } = await supabase
          .from('organizations')
          .insert({ name: orgName, slug, plan: 'free', owner_id: newUser.id })
          .select()
          .single();

        if (orgError) {
          console.warn('[Auth/Google] Org creation skipped:', orgError.message);
        } else if (org) {
          orgId = org.id;
          orgData = org as typeof orgData;
          const { error: memberError } = await supabase
            .from('organization_members')
            .insert({ org_id: org.id, user_id: newUser.id, role: 'owner' });
          if (memberError) {
            console.error('[Auth/Google] Failed to add org member:', memberError.message);
          }
        }
      } catch (orgErr) {
        console.warn('[Auth/Google] Org creation failed (non-critical):', orgErr instanceof Error ? orgErr.message : orgErr);
      }
    }

    const token = jwt.sign(
      { userId, email: userEmail, orgId, role: userRole },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' },
    );

    res.json({
      token,
      user: {
        id: userId,
        email: userEmail,
        name: userName,
        company_name: userCompanyName,
        email_verified: true,
        role: userRole,
        org_id: orgId,
      },
      organization: orgData,
    });
  } catch (err) {
    console.error('[Auth/Google] Unhandled error:', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'Ошибка аутентификации через Google. Попробуйте позже.' });
  }
});

// ── LinkedIn OAuth ────────────────────────────────────────────────────────────
router.post('/linkedin', async (req: Request, res: Response): Promise<void> => {
  try {
    const { code, redirect_uri } = req.body;

    if (!code) {
      res.status(400).json({ error: 'LinkedIn authorization code обязателен' });
      return;
    }

    const clientId = process.env.LINKEDIN_CLIENT_ID;
    const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      res.status(503).json({ error: 'LinkedIn OAuth не настроен' });
      return;
    }

    // Exchange code for access token
    const tokenRes = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirect_uri || `${process.env.FRONTEND_URL}/login`,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    if (!tokenRes.ok) {
      console.error('[Auth/LinkedIn] Token exchange failed:', await tokenRes.text());
      res.status(401).json({ error: 'Не удалось авторизоваться через LinkedIn' });
      return;
    }

    const { access_token } = await tokenRes.json() as { access_token: string };

    // Get user profile
    const profileRes = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: { 'Authorization': `Bearer ${access_token}` },
    });

    if (!profileRes.ok) {
      res.status(401).json({ error: 'Не удалось получить данные LinkedIn' });
      return;
    }

    const profile = await profileRes.json() as { email: string; name: string; given_name: string; family_name: string; picture?: string; sub: string };

    const email = profile.email?.toLowerCase();
    const name = profile.name || `${profile.given_name} ${profile.family_name}`;

    if (!email) {
      res.status(401).json({ error: 'LinkedIn не предоставил email' });
      return;
    }

    // Check if user exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id, email, name, company_name, email_verified, role')
      .eq('email', email)
      .single();

    let userId: string;
    let userName: string;
    let userRole: string;
    let orgId: string | undefined;
    let orgData: Record<string, unknown> | null = null;

    if (existingUser) {
      userId = existingUser.id;
      userName = existingUser.name;
      userRole = existingUser.role || 'user';

      // Get org
      try {
        const { data: membership } = await supabase
          .from('organization_members')
          .select('org_id, organizations(id, name, slug, plan)')
          .eq('user_id', userId)
          .limit(1)
          .single();
        if (membership) {
          orgId = membership.org_id;
          const orgs = membership.organizations;
          orgData = (Array.isArray(orgs) ? orgs[0] : orgs) as Record<string, unknown> | null;
        }
      } catch { /* non-critical */ }
    } else {
      // Create new user
      const randomPass = crypto.randomBytes(32).toString('hex');
      const hash = await bcrypt.hash(randomPass, 12);

      const { data: newUser, error: createErr } = await supabase
        .from('users')
        .insert({ email, password_hash: hash, name, email_verified: true })
        .select()
        .single();

      if (createErr || !newUser) {
        res.status(500).json({ error: 'Не удалось создать аккаунт' });
        return;
      }

      userId = newUser.id;
      userName = name;
      userRole = 'user';

      // Create org
      try {
        const slug = makeSlug(name, newUser.id.slice(0, 6));
        const { data: org } = await supabase
          .from('organizations')
          .insert({ name: `${name}'s Org`, slug, plan: 'free', owner_id: newUser.id })
          .select()
          .single();
        if (org) {
          orgId = org.id;
          orgData = org;
          await supabase.from('organization_members').insert({ org_id: org.id, user_id: newUser.id, role: 'owner' });
        }
      } catch { /* non-critical */ }
    }

    const token = jwt.sign(
      { userId, email, orgId, role: userRole },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' },
    );

    res.json({
      token,
      user: { id: userId, email, name: userName, role: userRole, email_verified: true, org_id: orgId },
      organization: orgData,
    });
  } catch (err) {
    console.error('[Auth/LinkedIn] Error:', err);
    res.status(500).json({ error: 'Ошибка авторизации через LinkedIn' });
  }
});

// ── Verify email ──────────────────────────────────────────────────────────────
router.post('/verify', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { code } = req.body;

    if (!code || typeof code !== 'string') {
      res.status(400).json({ error: 'Код подтверждения обязателен' });
      return;
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('id, verification_code, verification_code_expires_at, email_verified')
      .eq('id', req.userId!)
      .single();

    if (error || !user) {
      console.error('[Auth/Verify] User lookup failed:', error?.message);
      res.status(404).json({ error: 'Пользователь не найден' });
      return;
    }

    const trimmedCode = code.trim();

    if (user.email_verified) {
      res.json({ success: true, already_verified: true });
      return;
    }

    const hasDbCode = user.verification_code !== undefined && user.verification_code !== null;
    if (hasDbCode) {
      if (user.verification_code !== trimmedCode) {
        res.status(400).json({ error: 'Неверный код подтверждения' });
        return;
      }
      if (new Date(user.verification_code_expires_at) < new Date()) {
        res.status(400).json({ error: 'Код истёк. Запросите новый.' });
        return;
      }
      const { error: updateError } = await supabase
        .from('users')
        .update({ email_verified: true, verification_code: null, verification_code_expires_at: null })
        .eq('id', req.userId!);
      if (updateError) {
        console.error('[Auth/Verify] Failed to update verification status:', updateError.message);
        res.status(500).json({ error: 'Ошибка подтверждения. Попробуйте позже.' });
        return;
      }
      res.json({ success: true });
      return;
    }

    if (!checkMemCode(req.userId!, trimmedCode)) {
      res.status(400).json({ error: 'Неверный код подтверждения' });
      return;
    }

    await supabase
      .from('users')
      .update({ email_verified: true })
      .eq('id', req.userId!)
      .then(() => { /* ignore error — column may not exist */ });

    res.json({ success: true });
  } catch (err) {
    console.error('[Auth/Verify] Unhandled error:', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'Ошибка подтверждения. Попробуйте позже.' });
  }
});

// ── Resend code ───────────────────────────────────────────────────────────────
router.post('/resend-code', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    let userQuery = await supabase
      .from('users')
      .select('id, email, name, email_verified, verification_code_expires_at')
      .eq('id', req.userId!)
      .single();

    if (userQuery.error?.code === '42703' || userQuery.error?.code === 'PGRST204') {
      userQuery = await supabase
        .from('users')
        .select('id, email, name')
        .eq('id', req.userId!)
        .single();
    }

    const { data: user, error } = userQuery;

    if (error || !user) {
      console.error('[Auth/ResendCode] User lookup failed:', error?.message);
      res.status(404).json({ error: 'Пользователь не найден' });
      return;
    }

    if (user.email_verified) {
      res.json({ success: true, already_verified: true });
      return;
    }

    const existing = memCodes.get(req.userId!);
    if (existing && Date.now() < existing.expires - 14 * 60 * 1000) {
      res.status(429).json({ error: 'Подождите минуту перед повторной отправкой' });
      return;
    }

    const code = generateVerificationCode();

    const updateResult = await supabase
      .from('users')
      .update({ verification_code: code, verification_code_expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString() })
      .eq('id', req.userId!);

    if (updateResult.error?.code === '42703' || updateResult.error?.code === 'PGRST204') {
      storeMemCode(req.userId!, code, user.name);
    } else if (updateResult.error) {
      console.error('[Auth/ResendCode] DB update failed:', updateResult.error.message);
    }

    sendVerificationEmail(user.email, user.name, code).catch((err) => {
      console.error('[Auth] Resend email failed:', err?.message);
      console.log(`[Auth] Resend code for ${user.email}: ${code}`);
    });

    res.json({ success: true });
  } catch (err) {
    console.error('[Auth/ResendCode] Unhandled error:', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'Ошибка отправки кода. Попробуйте позже.' });
  }
});

// ── Forgot password ──────────────────────────────────────────────────────────
router.post('/forgot-password', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;

    if (!email || typeof email !== 'string') {
      res.status(400).json({ error: 'Email обязателен' });
      return;
    }

    const sanitizedEmail = String(email).trim().toLowerCase();

    if (!EMAIL_REGEX.test(sanitizedEmail)) {
      res.status(400).json({ error: 'Неверный формат email' });
      return;
    }

    // Rate limit: max 3 requests per email per 10 minutes
    if (!canRequestReset(sanitizedEmail)) {
      res.status(429).json({ error: 'Слишком много запросов. Попробуйте через 10 минут.' });
      return;
    }

    recordResetAttempt(sanitizedEmail);

    // Look up user (always return success to prevent email enumeration)
    const { data: user } = await supabase
      .from('users')
      .select('id, email, name')
      .eq('email', sanitizedEmail)
      .single();

    if (user) {
      const code = generateVerificationCode();
      resetCodes.set(sanitizedEmail, { code, expires: Date.now() + 15 * 60 * 1000 });

      // Reuse sendVerificationEmail with password reset context
      sendVerificationEmail(sanitizedEmail, user.name, code).catch((err) => {
        console.error('[Auth/ForgotPassword] Email send failed:', err?.message);
        console.log(`[Auth/ForgotPassword] Reset code for ${sanitizedEmail}: ${code}`);
      });
    }

    // Always return success to prevent email enumeration
    res.json({ success: true });
  } catch (err) {
    console.error('[Auth/ForgotPassword] Unhandled error:', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'Ошибка отправки кода. Попробуйте позже.' });
  }
});

// ── Reset password ───────────────────────────────────────────────────────────
router.post('/reset-password', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, code, new_password } = req.body;

    if (!email || !code || !new_password) {
      res.status(400).json({ error: 'Email, код и новый пароль обязательны' });
      return;
    }

    const sanitizedEmail = String(email).trim().toLowerCase();
    const trimmedCode = String(code).trim();

    if (!EMAIL_REGEX.test(sanitizedEmail)) {
      res.status(400).json({ error: 'Неверный формат email' });
      return;
    }

    if (typeof new_password !== 'string' || new_password.length < MIN_PASSWORD_LENGTH) {
      res.status(400).json({ error: `Пароль должен быть минимум ${MIN_PASSWORD_LENGTH} символов` });
      return;
    }

    // Validate reset code
    const entry = resetCodes.get(sanitizedEmail);
    if (!entry) {
      res.status(400).json({ error: 'Код сброса не найден. Запросите новый.' });
      return;
    }

    if (Date.now() > entry.expires) {
      resetCodes.delete(sanitizedEmail);
      res.status(400).json({ error: 'Код истёк. Запросите новый.' });
      return;
    }

    if (entry.code !== trimmedCode) {
      res.status(400).json({ error: 'Неверный код сброса' });
      return;
    }

    // Hash new password and update in DB
    const passwordHash = await bcrypt.hash(new_password, 12);
    const { error: updateError } = await supabase
      .from('users')
      .update({ password_hash: passwordHash })
      .eq('email', sanitizedEmail);

    if (updateError) {
      console.error('[Auth/ResetPassword] DB update failed:', updateError.message);
      res.status(500).json({ error: 'Ошибка сброса пароля. Попробуйте позже.' });
      return;
    }

    // Clear the reset code
    resetCodes.delete(sanitizedEmail);

    res.json({ success: true });
  } catch (err) {
    console.error('[Auth/ResetPassword] Unhandled error:', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'Ошибка сброса пароля. Попробуйте позже.' });
  }
});

// ── 2FA Setup ────────────────────────────────────────────────────────────────
router.post('/2fa/setup', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email')
      .eq('id', req.userId!)
      .single();

    if (error || !user) {
      res.status(404).json({ error: 'Пользователь не найден' });
      return;
    }

    const secret = generateBase32Secret();
    const otpauth_url = `otpauth://totp/SolutionHUB:${encodeURIComponent(user.email)}?secret=${secret}&issuer=SolutionHUB&digits=6&period=30`;

    // Try to store secret in DB (graceful if column doesn't exist)
    const { error: updateError } = await supabase
      .from('users')
      .update({ totp_secret: secret })
      .eq('id', req.userId!);

    if (updateError) {
      console.warn('[Auth/2FA] Failed to store totp_secret in DB (column may not exist):', updateError.message);
    }

    res.json({ secret, otpauth_url });
  } catch (err) {
    console.error('[Auth/2FA/Setup] Unhandled error:', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'Ошибка настройки 2FA. Попробуйте позже.' });
  }
});

// ── 2FA Verify (enable 2FA after setup) ──────────────────────────────────────
router.post('/2fa/verify', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { code } = req.body;

    if (!code || typeof code !== 'string' || code.trim().length !== 6) {
      res.status(400).json({ error: 'Введите 6-значный код' });
      return;
    }

    const userQuery = await supabase
      .from('users')
      .select('id, totp_secret, totp_enabled')
      .eq('id', req.userId!)
      .single();

    // If columns don't exist, return graceful error
    if (userQuery.error?.code === '42703' || userQuery.error?.code === 'PGRST204') {
      res.status(400).json({ error: '2FA не настроена. Сначала выполните /auth/2fa/setup.' });
      return;
    }

    const { data: user, error } = userQuery;

    if (error || !user) {
      res.status(404).json({ error: 'Пользователь не найден' });
      return;
    }

    if (!user.totp_secret) {
      res.status(400).json({ error: '2FA не настроена. Сначала выполните /auth/2fa/setup.' });
      return;
    }

    const trimmedCode = code.trim();
    if (!verifyTOTP(user.totp_secret, trimmedCode)) {
      res.status(400).json({ error: 'Неверный код. Попробуйте ещё раз.' });
      return;
    }

    // Enable 2FA
    const { error: updateError } = await supabase
      .from('users')
      .update({ totp_enabled: true })
      .eq('id', req.userId!);

    if (updateError) {
      console.warn('[Auth/2FA] Failed to set totp_enabled (column may not exist):', updateError.message);
    }

    res.json({ success: true });
  } catch (err) {
    console.error('[Auth/2FA/Verify] Unhandled error:', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'Ошибка проверки 2FA. Попробуйте позже.' });
  }
});

// ── 2FA Disable ──────────────────────────────────────────────────────────────
router.post('/2fa/disable', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { error: updateError } = await supabase
      .from('users')
      .update({ totp_enabled: false, totp_secret: null })
      .eq('id', req.userId!);

    if (updateError) {
      console.warn('[Auth/2FA] Failed to disable 2FA (columns may not exist):', updateError.message);
    }

    res.json({ success: true });
  } catch (err) {
    console.error('[Auth/2FA/Disable] Unhandled error:', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'Ошибка отключения 2FA. Попробуйте позже.' });
  }
});

// ── Update profile ────────────────────────────────────────────────────────────
router.put('/profile', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, company_name } = req.body;
    const sanitizedName = sanitizeHtml(String(name || '').trim());

    if (!sanitizedName || sanitizedName.length > 100) {
      res.status(400).json({ error: 'Имя должно быть от 1 до 100 символов' });
      return;
    }

    const updateData: Record<string, unknown> = { name: sanitizedName };
    if (company_name !== undefined) {
      updateData.company_name = company_name ? sanitizeHtml(String(company_name).trim().slice(0, 255)) : null;
    }

    let result = await supabase
      .from('users')
      .update(updateData)
      .eq('id', req.userId!)
      .select('id, email, name, company_name, email_verified, role')
      .single();

    if (result.error?.code === '42703' || result.error?.code === 'PGRST204') {
      const basicUpdate = { name: sanitizedName };
      result = await supabase
        .from('users')
        .update(basicUpdate)
        .eq('id', req.userId!)
        .select('id, email, name')
        .single();
    }

    if (result.error || !result.data) {
      console.error('[Auth/Profile] Update failed:', result.error?.message);
      res.status(500).json({ error: 'Ошибка обновления профиля. Попробуйте позже.' });
      return;
    }

    res.json({ user: result.data });
  } catch (err) {
    console.error('[Auth/Profile] Unhandled error:', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'Ошибка обновления профиля. Попробуйте позже.' });
  }
});

// ── Update Telegram chat_id ──────────────────────────────────────────────────
router.put('/telegram', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { chat_id } = req.body;

    if (!chat_id || typeof chat_id !== 'string') {
      res.status(400).json({ error: 'chat_id обязателен' });
      return;
    }

    const { error } = await supabase
      .from('users')
      .update({ telegram_chat_id: chat_id })
      .eq('id', req.userId!);

    if (error) {
      if (error.code === '42703' || error.code === 'PGRST204') {
        console.warn('[Auth/Telegram] telegram_chat_id column does not exist yet');
        res.json({ success: true, warning: 'Колонка telegram_chat_id ещё не создана в БД' });
        return;
      }
      console.error('[Auth/Telegram] Update error:', error.message);
      res.status(500).json({ error: 'Ошибка сохранения Telegram ID' });
      return;
    }

    res.json({ success: true });
  } catch (err) {
    console.error('[Auth/Telegram] Unhandled error:', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

export default router;
