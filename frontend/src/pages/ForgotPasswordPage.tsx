import { useState } from 'react';
import { usePageTitle } from '../utils/usePageTitle';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Loader2, Mail, Lock, KeyRound, ArrowLeft, CheckCircle2, Shield } from 'lucide-react';
import { motion, type Easing } from 'framer-motion';
import { authApi } from '../utils/api';

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

type Step = 'email' | 'code' | 'success';

export default function ForgotPasswordPage() {
  usePageTitle('Сброс пароля');
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('email');
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      toast.error('Введите корректный email');
      return;
    }

    setLoading(true);
    try {
      await authApi.forgotPassword(email.trim());
      toast.success('Код отправлен на вашу почту');
      setStep('code');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string }; status?: number } };
      const serverMsg = axiosErr?.response?.data?.error;
      if (axiosErr?.response?.status === 429) {
        toast.error(serverMsg || 'Слишком много запросов. Подождите 10 минут.');
      } else {
        toast.error(serverMsg || 'Ошибка отправки кода');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!code.trim() || code.trim().length !== 6) {
      toast.error('Введите 6-значный код');
      return;
    }

    if (password.length < 8) {
      toast.error('Пароль должен быть минимум 8 символов');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('Пароли не совпадают');
      return;
    }

    setLoading(true);
    try {
      await authApi.resetPassword(email.trim(), code.trim(), password);
      toast.success('Пароль успешно изменён!');
      setStep('success');
      setTimeout(() => navigate('/login'), 3000);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      toast.error(axiosErr?.response?.data?.error || 'Ошибка сброса пароля');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page-root">
      <div className="login-bg-mesh" />
      <div className="login-bg-gradient" />
      <div className="login-bg-dots" />

      <div className="w-full max-w-md relative z-10 px-4 sm:px-0">
        {/* Logo */}
        <motion.div
          className="text-center mb-8 sm:mb-10"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: fieldEase }}
        >
          <div className="relative inline-block mb-5">
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
            СБРОС ПАРОЛЯ
          </p>
        </motion.div>

        {/* Card */}
        <motion.div
          className="login-card"
          variants={cardVariants}
          initial="hidden"
          animate="visible"
        >
          {step === 'email' && (
            <form onSubmit={handleSendCode} className="space-y-4">
              <motion.div
                custom={0}
                variants={fieldVariants}
                initial="hidden"
                animate="visible"
              >
                <p className="text-neutral-400 text-sm mb-5">
                  Введите email, привязанный к вашему аккаунту. Мы отправим 6-значный код для сброса пароля.
                </p>
              </motion.div>

              <motion.div
                custom={1}
                variants={fieldVariants}
                initial="hidden"
                animate="visible"
              >
                <label className="login-label">Email</label>
                <div className="relative">
                  <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none" />
                  <input
                    type="email"
                    className="login-input pl-11"
                    placeholder="hr@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
              </motion.div>

              <motion.div
                custom={2}
                variants={fieldVariants}
                initial="hidden"
                animate="visible"
              >
                <button
                  type="submit"
                  className="login-submit-btn"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Отправка...
                    </>
                  ) : (
                    'Отправить код'
                  )}
                  <span className="login-shimmer" />
                </button>
              </motion.div>
            </form>
          )}

          {step === 'code' && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <motion.div
                custom={0}
                variants={fieldVariants}
                initial="hidden"
                animate="visible"
              >
                <p className="text-neutral-400 text-sm mb-5">
                  Код отправлен на <span className="text-orange-400 font-medium">{email}</span>. Введите его ниже вместе с новым паролем.
                </p>
              </motion.div>

              <motion.div
                custom={1}
                variants={fieldVariants}
                initial="hidden"
                animate="visible"
              >
                <label className="login-label">Код сброса</label>
                <div className="relative">
                  <KeyRound size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none" />
                  <input
                    type="text"
                    className="login-input pl-11 tracking-[0.3em] text-center font-mono text-lg"
                    placeholder="000000"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    required
                    maxLength={6}
                    disabled={loading}
                    autoComplete="one-time-code"
                  />
                </div>
              </motion.div>

              <motion.div
                custom={2}
                variants={fieldVariants}
                initial="hidden"
                animate="visible"
              >
                <label className="login-label">Новый пароль</label>
                <div className="relative">
                  <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none" />
                  <input
                    type="password"
                    className="login-input pl-11"
                    placeholder="Минимум 8 символов"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    disabled={loading}
                  />
                </div>
              </motion.div>

              <motion.div
                custom={3}
                variants={fieldVariants}
                initial="hidden"
                animate="visible"
              >
                <label className="login-label">Подтвердите пароль</label>
                <div className="relative">
                  <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none" />
                  <input
                    type="password"
                    className="login-input pl-11"
                    placeholder="Повторите пароль"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={8}
                    disabled={loading}
                  />
                </div>
              </motion.div>

              <motion.div
                custom={4}
                variants={fieldVariants}
                initial="hidden"
                animate="visible"
              >
                <button
                  type="submit"
                  className="login-submit-btn"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Сброс...
                    </>
                  ) : (
                    'Сбросить пароль'
                  )}
                  <span className="login-shimmer" />
                </button>
              </motion.div>

              <motion.div
                custom={5}
                variants={fieldVariants}
                initial="hidden"
                animate="visible"
              >
                <button
                  type="button"
                  className="w-full text-center text-sm text-neutral-500 hover:text-neutral-300 transition-colors mt-2"
                  onClick={() => {
                    setStep('email');
                    setCode('');
                    setPassword('');
                    setConfirmPassword('');
                  }}
                >
                  Отправить код повторно
                </button>
              </motion.div>
            </form>
          )}

          {step === 'success' && (
            <motion.div
              className="text-center py-6"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
            >
              <CheckCircle2 size={48} className="mx-auto mb-4 text-green-500" />
              <h3 className="text-lg font-semibold text-white mb-2">Пароль изменён!</h3>
              <p className="text-neutral-400 text-sm mb-6">
                Вы будете перенаправлены на страницу входа через несколько секунд.
              </p>
              <Link
                to="/login"
                className="login-submit-btn inline-flex"
              >
                Перейти к входу
                <span className="login-shimmer" />
              </Link>
            </motion.div>
          )}

          {step !== 'success' && (
            <div className="mt-5 pt-4 border-t border-neutral-800">
              <Link
                to="/login"
                className="flex items-center justify-center gap-2 text-sm text-neutral-500 hover:text-neutral-300 transition-colors"
              >
                <ArrowLeft size={14} />
                Вернуться к входу
              </Link>
            </div>
          )}
        </motion.div>

        {/* Footer */}
        <motion.div
          className="flex flex-col items-center gap-2 mt-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.4 }}
        >
          <div className="flex items-center gap-2 text-[11px] text-neutral-600">
            <Shield size={12} className="text-neutral-500" />
            <span>Защищено шифрованием</span>
          </div>
          <div className="text-center text-white/20 text-xs">
            Powered by <a href="https://mysolution.uz" target="_blank" rel="noopener noreferrer" className="text-white/30 hover:text-orange-400 transition-colors">SOLUTION</a>
          </div>
        </motion.div>
      </div>

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
          text-decoration: none;
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
      `}</style>
    </div>
  );
}
