import crypto from 'crypto';
import nodemailer from 'nodemailer';

export function generateVerificationCode(): string {
  return String(Math.floor(100000 + crypto.randomInt(900000))).padStart(6, '0');
}

// ── Transport factory ──────────────────────────────────────────────────────────

function createTransport() {
  // Priority 1: Gmail (EMAIL_USER + EMAIL_PASS)
  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS, // Gmail App Password (16 chars, no spaces)
      },
    });
  }

  // Priority 2: Custom SMTP (EMAIL_SMTP_HOST + EMAIL_SMTP_PORT + EMAIL_USER + EMAIL_PASS)
  if (process.env.EMAIL_SMTP_HOST) {
    return nodemailer.createTransport({
      host: process.env.EMAIL_SMTP_HOST,
      port: Number(process.env.EMAIL_SMTP_PORT) || 587,
      secure: process.env.EMAIL_SMTP_SECURE === 'true',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  }

  return null;
}

// ── Verification email ─────────────────────────────────────────────────────────

export async function sendVerificationEmail(
  email: string,
  name: string,
  code: string,
): Promise<void> {
  const fromEmail = process.env.EMAIL_USER || process.env.FROM_EMAIL || 'noreply@recrutor.ai';
  const fromName = 'Рекрутор AI';

  // Try Nodemailer (Gmail / SMTP)
  const transport = createTransport();
  if (transport) {
    try {
      await transport.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to: email,
        subject: 'Ваш код подтверждения — Рекрутор AI',
        html: buildVerificationHtml(name, code),
      });
      return;
    } catch (err) {
      console.error('[Email] Nodemailer error:', err);
      // fall through to Resend or console
    }
  }

  // Try Resend (RESEND_API_KEY)
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: `${fromName} <${fromEmail}>`,
          to: [email],
          subject: 'Ваш код подтверждения — Рекрутор AI',
          html: buildVerificationHtml(name, code),
        }),
      });
      if (res.ok) return;
      console.error('[Email] Resend error:', res.status, await res.text());
    } catch (err) {
      console.error('[Email] Resend fetch error:', err);
    }
  }

  // Dev fallback: print to console
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📧  Verification code for ${email}`);
  console.log(`🔑  CODE: ${code}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

// ── Invite email ───────────────────────────────────────────────────────────────

export async function sendInviteEmail(
  email: string,
  inviterName: string,
  orgName: string,
): Promise<void> {
  const fromEmail = process.env.EMAIL_USER || process.env.FROM_EMAIL || 'noreply@recrutor.ai';
  const fromName = 'Рекрутор AI';
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#0d0d0d;color:#fff;border-radius:16px;">
      <div style="text-align:center;margin-bottom:32px;">
        <div style="display:inline-block;width:56px;height:56px;background:linear-gradient(135deg,#FF6A00,#FF9A3C);border-radius:14px;font-weight:900;font-size:24px;color:#000;line-height:56px;text-align:center;">R</div>
        <h1 style="margin:12px 0 0;font-size:22px;">Рекрутор <span style="color:#FF9A3C;">AI</span></h1>
      </div>
      <h2 style="font-size:18px;margin-bottom:8px;">${inviterName} приглашает вас!</h2>
      <p style="color:rgba(255,255,255,0.6);margin-bottom:28px;">Вы приглашены в организацию <strong style="color:#FF9A3C;">${orgName}</strong>.</p>
      <div style="text-align:center;">
        <a href="${frontendUrl}/register" style="display:inline-block;background:linear-gradient(135deg,#FF6A00,#FF9A3C);color:#000;font-weight:700;padding:14px 32px;border-radius:10px;text-decoration:none;">Принять приглашение</a>
      </div>
    </div>
  `;

  const transport = createTransport();
  if (transport) {
    try {
      await transport.sendMail({ from: `"${fromName}" <${fromEmail}>`, to: email, subject: `Приглашение в ${orgName} — Рекрутор AI`, html });
      return;
    } catch (err) {
      console.error('[Email] Invite nodemailer error:', err);
    }
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: `${fromName} <${fromEmail}>`, to: [email], subject: `Приглашение в ${orgName}`, html }),
      });
      if (res.ok) return;
      console.error('[Email] Invite Resend error:', res.status, await res.text());
    } catch (err) {
      console.error('[Email] Invite Resend fetch error:', err);
    }
  }

  // Dev fallback: print to console
  console.log(`[DEV] Invite email to ${email} from ${inviterName} (${orgName}): ${frontendUrl}/register`);
}

// ── HTML template ──────────────────────────────────────────────────────────────

function buildVerificationHtml(name: string, code: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <body style="margin:0;padding:0;background:#080502;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
      <div style="max-width:480px;margin:40px auto;padding:40px 32px;background:#111;border-radius:20px;border:1px solid rgba(255,106,0,0.15);">
        <!-- Logo -->
        <div style="text-align:center;margin-bottom:32px;">
          <div style="display:inline-block;width:60px;height:60px;background:linear-gradient(135deg,#FF6A00,#FF9A3C);border-radius:16px;font-weight:900;font-size:28px;color:#000;line-height:60px;text-align:center;box-shadow:0 8px 24px rgba(255,106,0,0.4);">R</div>
          <h1 style="margin:12px 0 0;font-size:22px;font-weight:900;color:#fff;">Рекрутор <span style="color:#FF9A3C;">AI</span></h1>
        </div>

        <!-- Greeting -->
        <h2 style="color:#fff;font-size:18px;margin:0 0 8px;">Привет, ${name}!</h2>
        <p style="color:rgba(255,255,255,0.55);margin:0 0 28px;line-height:1.6;">
          Введите этот код для подтверждения вашего email. Код действителен <strong style="color:#fff;">15 минут</strong>.
        </p>

        <!-- Code block -->
        <div style="text-align:center;background:rgba(255,106,0,0.08);border:1px solid rgba(255,106,0,0.25);border-radius:14px;padding:28px;margin-bottom:28px;">
          <div style="font-size:44px;font-weight:900;letter-spacing:14px;color:#FF9A3C;font-family:monospace;">${code}</div>
        </div>

        <!-- Footer -->
        <p style="color:rgba(255,255,255,0.3);font-size:12px;text-align:center;margin:0;">
          Если вы не регистрировались — просто проигнорируйте это письмо.
        </p>
      </div>
    </body>
    </html>
  `;
}
