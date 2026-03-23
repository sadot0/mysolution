import { useState, useEffect } from 'react';
import { usePageTitle } from '../utils/usePageTitle';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Loader2, Mail, Lock, User, Building2, Shield } from 'lucide-react';
import { motion, AnimatePresence, type Easing } from 'framer-motion';
import { authApi } from '../utils/api';
import { useAuthStore } from '../utils/auth-store';
import { Organization } from '../types';

/* ── animation variants ── */
const cardEase: Easing = [0.22, 1, 0.36, 1];

const cardVariants = {
  hidden: { opacity: 0, y: 30, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.5, ease: cardEase },
  },
};

const fieldEase: Easing = 'easeOut';

const fieldVariants = {
  hidden: { opacity: 0, y: 14 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: 0.15 + i * 0.07, duration: 0.35, ease: fieldEase },
  }),
};

export default function LoginPage() {
  usePageTitle('Вход');
  const { setAuth, logout } = useAuthStore();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ email: '', password: '', name: '', company_name: '' });

  // Clear stale auth ONCE on mount (before any interaction)
  const [cleared, setCleared] = useState(false);
  useEffect(() => {
    if (!cleared) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('organization');
      logout();
      setCleared(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // LinkedIn OAuth callback handler
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (code) {
      handleLinkedInCallback(code);
      window.history.replaceState({}, '', '/login');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLinkedInCallback = async (code: string) => {
    setLoading(true);
    try {
      const res = await authApi.linkedinLogin(code, window.location.origin + '/login');
      const { token: newToken, user, organization } = res.data;
      localStorage.setItem('token', newToken);
      localStorage.setItem('user', JSON.stringify(user));
      if (organization) localStorage.setItem('organization', JSON.stringify(organization));
      setAuth(newToken, user, (organization as Organization) || null);
      toast.success(`Добро пожаловать, ${user.name}!`);
      window.location.href = '/vacancies';
    } catch {
      toast.error('Ошибка входа через LinkedIn');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Client-side validation
    if (mode === 'register') {
      if (!form.name.trim()) {
        toast.error('Введите ваше имя');
        return;
      }
      if (form.name.trim().length > 100) {
        toast.error('Имя не должно превышать 100 символов');
        return;
      }
    }
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email)) {
      toast.error('Введите корректный email');
      return;
    }
    if (form.password.length < 8) {
      toast.error('Пароль должен быть минимум 8 символов');
      return;
    }

    setLoading(true);
    try {
      const res = mode === 'login'
        ? await authApi.login(form.email.trim(), form.password)
        : await authApi.register(form.email.trim(), form.password, form.name.trim(), form.company_name.trim() || undefined);

      const { token: newToken, user, organization } = res.data;

      // Save to localStorage directly to guarantee persistence
      localStorage.setItem('token', newToken);
      localStorage.setItem('user', JSON.stringify(user));
      if (organization) {
        localStorage.setItem('organization', JSON.stringify(organization));
      }
      setAuth(newToken, user, (organization as Organization) || null);

      toast.success(mode === 'register' ? 'Аккаунт создан!' : `Добро пожаловать, ${user.name}!`);

      // Use window.location for guaranteed navigation
      window.location.href = '/vacancies';
    } catch (err: unknown) {
      console.error('[LoginPage] Auth error:', err);
      const axiosErr = err as { response?: { data?: { error?: string }; status?: number }; code?: string; message?: string };
      const serverMsg = axiosErr?.response?.data?.error;
      const status = axiosErr?.response?.status;

      console.error('[LoginPage] Status:', status, 'Message:', serverMsg, 'Code:', axiosErr?.code);

      if (axiosErr?.code === 'ERR_NETWORK') {
        toast.error('Сервер недоступен. Проверьте подключение.');
      } else if (status === 503) {
        toast.error(serverMsg || 'Сервис временно недоступен');
      } else if (status === 429) {
        toast.error(serverMsg || 'Слишком много попыток. Подождите 15 минут.');
      } else if (status === 409) {
        toast.error('Этот email уже зарегистрирован. Попробуйте войти.');
      } else if (status === 401) {
        toast.error('Неверный email или пароль');
      } else {
        toast.error(serverMsg || 'Ошибка авторизации');
      }
    } finally {
      setLoading(false);
    }
  };

  /* ── field index counter (for stagger) ── */
  let fieldIdx = 0;

  return (
    <div className="login-page-root">
      {/* ── Animated background layers ── */}
      <div className="login-bg-mesh" />
      <div className="login-bg-gradient" />
      <div className="login-bg-dots" />

      <div className="w-full max-w-md relative z-10 px-4 sm:px-0">
        {/* ── Logo section ── */}
        <motion.div
          className="text-center mb-8 sm:mb-10"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: fieldEase }}
        >
          <div className="relative inline-block mb-5">
            {/* Pulsing ring */}
            <div className="login-logo-ring" />
            <img
              src="/logo-icon.svg"
              alt="Solution"
              className="h-14 sm:h-16 relative z-10 drop-shadow-[0_0_40px_rgba(249,115,22,0.3)]"
            />
          </div>
          <img
            src="/logo-full.svg"
            alt="Solution"
            className="h-7 sm:h-8 mx-auto mb-2"
          />
          <p className="text-[11px] text-neutral-500 tracking-[0.2em] font-medium">
            RECRUITER INTELLIGENCE PLATFORM
          </p>
        </motion.div>

        {/* ── Card ── */}
        <motion.div
          className="login-card"
          variants={cardVariants}
          initial="hidden"
          animate="visible"
        >
          {/* Tab switcher with sliding indicator */}
          <div className="relative flex mb-7 p-1 bg-neutral-800/80 border border-neutral-700/60 rounded-xl">
            {/* Sliding indicator */}
            <motion.div
              className="absolute top-1 bottom-1 rounded-lg bg-orange-500 shadow-[0_0_20px_rgba(249,115,22,0.3)]"
              layout
              transition={{ type: 'spring', stiffness: 400, damping: 35 }}
              style={{
                width: 'calc(50% - 4px)',
                left: mode === 'login' ? 4 : 'calc(50% + 0px)',
              }}
            />
            {(['login', 'register'] as const).map((m) => (
              <button
                key={m}
                type="button"
                className={`relative z-10 flex-1 py-2.5 text-sm font-semibold rounded-lg transition-colors tracking-wider ${
                  mode === m
                    ? 'text-white'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
                onClick={() => setMode(m)}
                disabled={loading}
              >
                {m === 'login' ? 'ВОЙТИ' : 'РЕГИСТРАЦИЯ'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <AnimatePresence mode="popLayout">
              {mode === 'register' && (
                <motion.div
                  key="register-fields"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-4 overflow-hidden"
                >
                  <motion.div
                    custom={fieldIdx++}
                    variants={fieldVariants}
                    initial="hidden"
                    animate="visible"
                  >
                    <label className="login-label">Имя</label>
                    <div className="relative">
                      <User size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none" />
                      <input
                        type="text"
                        className="login-input pl-11"
                        placeholder="Иван Иванов"
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        required
                        disabled={loading}
                        maxLength={100}
                      />
                    </div>
                  </motion.div>
                  <motion.div
                    custom={fieldIdx++}
                    variants={fieldVariants}
                    initial="hidden"
                    animate="visible"
                  >
                    <label className="login-label">
                      Название компании{' '}
                      <span className="text-neutral-600 font-normal">(необязательно)</span>
                    </label>
                    <div className="relative">
                      <Building2 size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none" />
                      <input
                        type="text"
                        className="login-input pl-11"
                        placeholder="My Company Ltd."
                        value={form.company_name}
                        onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                        disabled={loading}
                        maxLength={255}
                      />
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            <motion.div
              custom={mode === 'register' ? 2 : 0}
              variants={fieldVariants}
              initial="hidden"
              animate="visible"
              key={`email-${mode}`}
            >
              <label className="login-label">Email</label>
              <div className="relative">
                <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none" />
                <input
                  type="email"
                  className="login-input pl-11"
                  placeholder="hr@company.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                  disabled={loading}
                />
              </div>
            </motion.div>

            <motion.div
              custom={mode === 'register' ? 3 : 1}
              variants={fieldVariants}
              initial="hidden"
              animate="visible"
              key={`password-${mode}`}
            >
              <label className="login-label">Пароль</label>
              <div className="relative">
                <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none" />
                <input
                  type="password"
                  className="login-input pl-11"
                  placeholder="Минимум 8 символов"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                  minLength={8}
                  disabled={loading}
                />
              </div>
              {mode === 'login' && (
                <div className="mt-2 text-right">
                  <Link
                    to="/forgot-password"
                    className="text-xs text-neutral-500 hover:text-orange-400 transition-colors"
                  >
                    Забыли пароль?
                  </Link>
                </div>
              )}
            </motion.div>

            <motion.div
              custom={mode === 'register' ? 4 : 2}
              variants={fieldVariants}
              initial="hidden"
              animate="visible"
              key={`submit-${mode}`}
            >
              <button
                type="submit"
                className="login-submit-btn"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Загрузка...
                  </>
                ) : mode === 'login' ? 'Войти' : 'Зарегистрироваться'}
                {/* Shimmer overlay */}
                <span className="login-shimmer" />
              </button>
            </motion.div>
          </form>

          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-neutral-600 to-transparent" />
            <span className="text-[11px] text-neutral-500 tracking-[0.15em] font-medium">ИЛИ</span>
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-neutral-600 to-transparent" />
          </div>

          <button
            type="button"
            className="login-google-btn"
            onClick={() => {
              if (import.meta.env.VITE_GOOGLE_CLIENT_ID) {
                toast('Перенаправление на Google...', { icon: '🔄' });
              } else {
                toast('Google вход будет доступен после настройки. Используйте email.', {
                  icon: 'ℹ️',
                  duration: 4000,
                });
              }
            }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
              <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.997 8.997 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
            </svg>
            Продолжить через Google
          </button>

          <button
            type="button"
            className="login-google-btn mt-2"
            onClick={() => {
              const clientId = import.meta.env.VITE_LINKEDIN_CLIENT_ID;
              if (!clientId) {
                toast('LinkedIn вход будет доступен после настройки.', { icon: 'ℹ️', duration: 4000 });
                return;
              }
              const redirectUri = encodeURIComponent(window.location.origin + '/login');
              window.location.href = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}&scope=openid%20profile%20email`;
            }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M15.335 0H2.665A2.665 2.665 0 000 2.665v12.67A2.665 2.665 0 002.665 18h12.67A2.665 2.665 0 0018 15.335V2.665A2.665 2.665 0 0015.335 0zM5.339 15.337H2.669V6.748h2.67v8.589zM4.004 5.578a1.548 1.548 0 110-3.096 1.548 1.548 0 010 3.096zM15.339 15.337h-2.668v-4.177c0-.995-.017-2.278-1.387-2.278-1.389 0-1.601 1.086-1.601 2.206v4.249H7.015V6.748h2.561v1.173h.036c.356-.675 1.227-1.387 2.526-1.387 2.703 0 3.201 1.779 3.201 4.092v4.711z" fill="#0A66C2"/>
            </svg>
            Продолжить через LinkedIn
          </button>

        </motion.div>

        {/* ── Footer ── */}
        <motion.div
          className="flex items-center justify-center gap-2 mt-6 text-[11px] text-neutral-600"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.4 }}
        >
          <Shield size={12} className="text-neutral-500" />
          <span>Защищено шифрованием</span>
          <span className="text-neutral-700 mx-1">|</span>
          <span className="text-neutral-500 font-medium">v2.1</span>
        </motion.div>
      </div>

      {/* ── Scoped styles ── */}
      <style>{`
        .login-page-root {
          min-height: 100vh;
          min-height: 100dvh;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          overflow: hidden;
          background: #050505;
        }

        /* ── Background: animated gradient mesh ── */
        .login-bg-gradient {
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 1;
        }
        .login-bg-gradient::before {
          content: '';
          position: absolute;
          top: 20%;
          left: 50%;
          width: 600px;
          height: 600px;
          transform: translate(-50%, -30%);
          background: radial-gradient(circle, rgba(249,115,22,0.15) 0%, transparent 65%);
          animation: loginGradientRotate 12s ease-in-out infinite;
        }
        @keyframes loginGradientRotate {
          0%, 100% { transform: translate(-50%, -30%) rotate(0deg) scale(1); }
          33% { transform: translate(-45%, -25%) rotate(120deg) scale(1.1); }
          66% { transform: translate(-55%, -35%) rotate(240deg) scale(0.95); }
        }

        /* ── Background: mesh overlay ── */
        .login-bg-mesh {
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 0;
          background:
            radial-gradient(ellipse 80% 50% at 50% 0%, rgba(249,115,22,0.08) 0%, transparent 60%),
            radial-gradient(ellipse 60% 40% at 80% 80%, rgba(249,115,22,0.04) 0%, transparent 50%),
            radial-gradient(ellipse 60% 40% at 20% 70%, rgba(249,115,22,0.04) 0%, transparent 50%);
        }

        /* ── Background: dot grid ── */
        .login-bg-dots {
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 1;
          opacity: 0.3;
          background-image:
            radial-gradient(circle 1px, rgba(255,255,255,0.12) 1px, transparent 1px);
          background-size: 32px 32px;
          mask-image: radial-gradient(ellipse 60% 50% at 50% 45%, black 20%, transparent 70%);
          -webkit-mask-image: radial-gradient(ellipse 60% 50% at 50% 45%, black 20%, transparent 70%);
        }

        /* ── Logo pulsing ring ── */
        .login-logo-ring {
          position: absolute;
          inset: -12px;
          border-radius: 50%;
          border: 1.5px solid rgba(249,115,22,0.2);
          animation: loginPulseRing 3s ease-in-out infinite;
        }
        .login-logo-ring::after {
          content: '';
          position: absolute;
          inset: -8px;
          border-radius: 50%;
          border: 1px solid rgba(249,115,22,0.08);
          animation: loginPulseRing 3s ease-in-out infinite 0.5s;
        }
        @keyframes loginPulseRing {
          0%, 100% { transform: scale(1); opacity: 0.6; }
          50% { transform: scale(1.15); opacity: 0; }
        }

        /* ── Card ── */
        .login-card {
          position: relative;
          background: linear-gradient(180deg, rgba(28,28,28,0.95) 0%, rgba(23,23,23,0.98) 100%);
          border: 1px solid rgba(64,64,64,0.5);
          border-top-color: rgba(100,100,100,0.4);
          border-radius: 16px;
          padding: 32px 28px;
          backdrop-filter: blur(20px);
          box-shadow:
            0 0 0 1px rgba(255,255,255,0.03) inset,
            0 20px 60px rgba(0,0,0,0.5),
            0 0 80px rgba(249,115,22,0.03);
        }
        @media (min-width: 640px) {
          .login-card {
            padding: 36px 36px;
          }
        }

        /* ── Input fields ── */
        .login-label {
          display: block;
          font-size: 11px;
          font-weight: 600;
          color: #a3a3a3;
          margin-bottom: 8px;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }
        .login-input {
          width: 100%;
          height: 46px;
          padding: 0 14px 0 44px;
          background: rgba(23,23,23,0.8);
          border: 1px solid rgba(64,64,64,0.6);
          border-radius: 10px;
          color: #fff;
          font-size: 14px;
          transition: border-color 0.25s ease, box-shadow 0.25s ease, background-color 0.25s ease;
        }
        .login-input::placeholder {
          color: #525252;
        }
        .login-input:focus {
          outline: none;
          border-color: rgba(249,115,22,0.6);
          box-shadow: 0 0 0 3px rgba(249,115,22,0.1), 0 0 20px rgba(249,115,22,0.05);
          background: rgba(28,28,28,0.9);
        }
        .login-input:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* ── Submit button with shimmer ── */
        .login-submit-btn {
          position: relative;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          width: 100%;
          padding: 14px 24px;
          margin-top: 8px;
          background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
          color: #fff;
          font-weight: 600;
          font-size: 14px;
          border: none;
          border-radius: 12px;
          cursor: pointer;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
          box-shadow: 0 4px 15px rgba(249,115,22,0.3), 0 0 0 1px rgba(249,115,22,0.1) inset;
        }
        .login-submit-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 6px 25px rgba(249,115,22,0.4), 0 0 0 1px rgba(249,115,22,0.2) inset;
        }
        .login-submit-btn:active:not(:disabled) {
          transform: translateY(0);
        }
        .login-submit-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        /* Shimmer effect */
        .login-shimmer {
          position: absolute;
          top: 0;
          left: -100%;
          width: 60%;
          height: 100%;
          background: linear-gradient(
            90deg,
            transparent 0%,
            rgba(255,255,255,0.15) 50%,
            transparent 100%
          );
          pointer-events: none;
        }
        .login-submit-btn:hover:not(:disabled) .login-shimmer {
          animation: loginShimmer 0.8s ease forwards;
        }
        @keyframes loginShimmer {
          0% { left: -100%; }
          100% { left: 120%; }
        }

        /* ── Google button ── */
        .login-google-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          width: 100%;
          padding: 13px 16px;
          background: rgba(23,23,23,0.6);
          border: 1px solid rgba(64,64,64,0.5);
          border-radius: 12px;
          color: #d4d4d4;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease;
        }
        .login-google-btn:hover {
          background: rgba(38,38,38,0.8);
          border-color: rgba(82,82,82,0.6);
          color: #fff;
        }
      `}</style>
    </div>
  );
}
