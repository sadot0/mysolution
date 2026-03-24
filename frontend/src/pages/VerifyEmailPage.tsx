import { useState, useRef, useEffect, useCallback } from 'react';
import { usePageTitle } from '../utils/usePageTitle';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Mail, RefreshCw, CheckCircle, Shield, ArrowRight } from 'lucide-react';
import { motion, type Easing } from 'framer-motion';
import { authApi } from '../utils/api';
import { useAuthStore } from '../utils/auth-store';

/* ── animation config ── */
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

export default function VerifyEmailPage() {
  usePageTitle('Подтверждение email');
  const navigate = useNavigate();
  const { user, token } = useAuthStore();
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [verified, setVerified] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (!token) {
      navigate('/login');
    }
    inputRefs.current[0]?.focus();
  }, [token, navigate]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const handleVerify = useCallback(async (codeStr?: string) => {
    const fullCode = codeStr || code.join('');
    if (fullCode.length !== 6) {
      toast.error('Введите все 6 цифр');
      return;
    }
    setLoading(true);
    try {
      await authApi.verify(fullCode);
      setVerified(true);
      toast.success('Email подтверждён!');
      setTimeout(() => {
        navigate('/vacancies');
      }, 2000);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg || 'Неверный код');
      setCode(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  }, [code, navigate]);

  const handleChange = useCallback((index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newCode = [...code];
    newCode[index] = value.slice(-1);
    setCode(newCode);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    if (value && index === 5) {
      const full = [...newCode.slice(0, 5), value.slice(-1)].join('');
      if (full.length === 6) {
        handleVerify(full);
      }
    }
  }, [code, handleVerify]);

  const handleKeyDown = useCallback((index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }, [code]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    const newCode = ['', '', '', '', '', ''];
    for (let i = 0; i < 6; i++) {
      newCode[i] = pasted[i] || '';
    }
    setCode(newCode);
    const lastIdx = Math.min(pasted.length, 5);
    inputRefs.current[lastIdx]?.focus();

    if (pasted.length === 6) {
      handleVerify(pasted);
    }
  }, [handleVerify]);

  const handleResend = async () => {
    if (cooldown > 0) return;
    setResending(true);
    try {
      await authApi.resendCode();
      toast.success('Код отправлен повторно!');
      setCooldown(60);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg || 'Ошибка повторной отправки');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="verify-page-root">
      {/* ── Background layers (matching LoginPage) ── */}
      <div className="verify-bg-mesh" />
      <div className="verify-bg-gradient" />
      <div className="verify-bg-dots" />

      <div className="w-full max-w-md relative z-10 px-4 sm:px-0">
        {/* ── Logo section ── */}
        <motion.div
          className="text-center mb-8 sm:mb-10"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        >
          <div className="relative inline-block mb-5">
            <div className="verify-logo-ring" />
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
          <p className="text-[11px] text-white/40 tracking-[0.2em] font-medium">
            SOLUTION HUB
          </p>
        </motion.div>

        {/* ── Card ── */}
        <motion.div
          className="verify-card"
          variants={cardVariants}
          initial="hidden"
          animate="visible"
        >
          {verified ? (
            /* ── Success state ── */
            <motion.div
              className="flex flex-col items-center py-6"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, ease: cardEase }}
            >
              <motion.div
                className="flex items-center justify-center w-20 h-20 rounded-full bg-green-500/10 border border-green-500/30 mb-5"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.1 }}
              >
                <motion.div
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ delay: 0.3, duration: 0.4 }}
                >
                  <CheckCircle size={40} className="text-green-400" />
                </motion.div>
              </motion.div>
              <motion.h2
                className="text-xl font-bold text-white mb-2"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                Email подтверждён!
              </motion.h2>
              <motion.p
                className="text-sm text-white/40"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                Перенаправляем вас...
              </motion.p>
            </motion.div>
          ) : (
            /* ── Verification form ── */
            <>
              {/* Header inside card */}
              <div className="text-center mb-7">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-orange-500/10 border border-orange-500/20 mb-4">
                  <Mail size={24} className="text-orange-400" />
                </div>
                <h1 className="text-2xl font-black text-white mb-2">
                  Подтвердите ваш email
                </h1>
                <p className="text-sm text-white/40">
                  Мы отправили 6-значный код на{' '}
                  <span className="text-orange-400 font-medium">
                    {user?.email || 'ваш email'}
                  </span>
                </p>
              </div>

              {/* Code inputs */}
              <div className="flex gap-2.5 sm:gap-3 justify-center mb-6" onPaste={handlePaste}>
                {code.map((digit, i) => (
                  <motion.input
                    key={i}
                    ref={(el) => { inputRefs.current[i] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleChange(i, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(i, e)}
                    disabled={loading}
                    className="verify-digit-input"
                    data-filled={digit ? 'true' : 'false'}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 + i * 0.05, duration: 0.3, ease: 'easeOut' }}
                  />
                ))}
              </div>

              {/* Verify button */}
              <button
                className="verify-submit-btn"
                onClick={() => handleVerify()}
                disabled={loading || code.join('').length < 6}
              >
                {loading ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    Проверяем...
                  </>
                ) : (
                  <>
                    <CheckCircle size={16} />
                    Подтвердить
                  </>
                )}
                <span className="verify-shimmer" />
              </button>

              {/* Resend section */}
              <div className="text-center mt-5">
                <p className="text-xs text-white/25 mb-2">
                  Не получили письмо?
                </p>
                <button
                  onClick={handleResend}
                  disabled={resending || cooldown > 0}
                  className="verify-resend-btn"
                  data-disabled={cooldown > 0 ? 'true' : 'false'}
                >
                  {resending
                    ? 'Отправляем...'
                    : cooldown > 0
                    ? `Отправить код повторно (${cooldown}с)`
                    : 'Отправить код повторно'}
                </button>
              </div>

              {/* Divider */}
              <div className="flex items-center gap-3 mt-6 mb-4">
                <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
              </div>

              {/* Skip button */}
              <button
                onClick={() => navigate('/vacancies')}
                className="flex items-center justify-center gap-2 w-full py-2.5 text-sm text-white/40 hover:text-white/80 transition-colors font-medium"
              >
                Пропустить
                <ArrowRight size={14} />
              </button>
            </>
          )}
        </motion.div>

        {/* ── Footer ── */}
        <motion.div
          className="flex flex-col items-center gap-2 mt-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.4 }}
        >
          <div className="flex items-center gap-2 text-[11px] text-white/25">
            <Shield size={12} className="text-white/40" />
            <span>Защищено шифрованием</span>
          </div>
          <div className="text-center text-white/20 text-xs">
            Powered by <a href="https://mysolution.uz" target="_blank" rel="noopener noreferrer" className="text-white/30 hover:text-orange-400 transition-colors">SOLUTION</a>
          </div>
        </motion.div>
      </div>

      {/* ── Scoped styles (matching LoginPage design) ── */}
      <style>{`
        .verify-page-root {
          min-height: 100vh;
          min-height: 100dvh;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          overflow: hidden;
          background: #050505;
        }

        /* ── Background layers ── */
        .verify-bg-gradient {
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 1;
        }
        .verify-bg-gradient::before {
          content: '';
          position: absolute;
          top: 20%;
          left: 50%;
          width: 600px;
          height: 600px;
          transform: translate(-50%, -30%);
          background: radial-gradient(circle, rgba(249,115,22,0.15) 0%, transparent 65%);
          animation: verifyGradientRotate 12s ease-in-out infinite;
        }
        @keyframes verifyGradientRotate {
          0%, 100% { transform: translate(-50%, -30%) rotate(0deg) scale(1); }
          33% { transform: translate(-45%, -25%) rotate(120deg) scale(1.1); }
          66% { transform: translate(-55%, -35%) rotate(240deg) scale(0.95); }
        }

        .verify-bg-mesh {
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 0;
          background:
            radial-gradient(ellipse 80% 50% at 50% 0%, rgba(249,115,22,0.08) 0%, transparent 60%),
            radial-gradient(ellipse 60% 40% at 80% 80%, rgba(249,115,22,0.04) 0%, transparent 50%),
            radial-gradient(ellipse 60% 40% at 20% 70%, rgba(249,115,22,0.04) 0%, transparent 50%);
        }

        .verify-bg-dots {
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
        .verify-logo-ring {
          position: absolute;
          inset: -12px;
          border-radius: 50%;
          border: 1.5px solid rgba(249,115,22,0.2);
          animation: verifyPulseRing 3s ease-in-out infinite;
        }
        .verify-logo-ring::after {
          content: '';
          position: absolute;
          inset: -8px;
          border-radius: 50%;
          border: 1px solid rgba(249,115,22,0.08);
          animation: verifyPulseRing 3s ease-in-out infinite 0.5s;
        }
        @keyframes verifyPulseRing {
          0%, 100% { transform: scale(1); opacity: 0.6; }
          50% { transform: scale(1.15); opacity: 0; }
        }

        /* ── Card ── */
        .verify-card {
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
          .verify-card {
            padding: 36px 36px;
          }
        }

        /* ── Digit input boxes ── */
        .verify-digit-input {
          width: 48px;
          height: 56px;
          text-align: center;
          font-weight: 900;
          font-size: 1.5rem;
          background: rgba(23,23,23,0.8);
          border: 2px solid rgba(64,64,64,0.6);
          border-radius: 12px;
          color: rgba(255,255,255,0.3);
          caret-color: #f97316;
          outline: none;
          transition: border-color 0.25s ease, box-shadow 0.25s ease, background-color 0.25s ease, color 0.25s ease;
        }
        @media (min-width: 640px) {
          .verify-digit-input {
            width: 52px;
            height: 60px;
          }
        }
        .verify-digit-input:focus {
          border-color: rgba(249,115,22,0.6);
          box-shadow: 0 0 0 3px rgba(249,115,22,0.1), 0 0 20px rgba(249,115,22,0.05);
          background: rgba(28,28,28,0.9);
          color: #fff;
        }
        .verify-digit-input[data-filled="true"] {
          background: rgba(249,115,22,0.08);
          border-color: rgba(249,115,22,0.4);
          color: #fb923c;
        }
        .verify-digit-input:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* ── Submit button ── */
        .verify-submit-btn {
          position: relative;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          width: 100%;
          padding: 14px 24px;
          background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
          color: #fff;
          font-weight: 600;
          font-size: 14px;
          border: none;
          border-radius: 12px;
          cursor: pointer;
          transition: transform 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease;
          box-shadow: 0 4px 15px rgba(249,115,22,0.3), 0 0 0 1px rgba(249,115,22,0.1) inset;
        }
        .verify-submit-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 6px 25px rgba(249,115,22,0.4), 0 0 0 1px rgba(249,115,22,0.2) inset;
        }
        .verify-submit-btn:active:not(:disabled) {
          transform: translateY(0);
        }
        .verify-submit-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* Shimmer effect */
        .verify-shimmer {
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
        .verify-submit-btn:hover:not(:disabled) .verify-shimmer {
          animation: verifyShimmer 0.8s ease forwards;
        }
        @keyframes verifyShimmer {
          0% { left: -100%; }
          100% { left: 120%; }
        }

        /* ── Resend button ── */
        .verify-resend-btn {
          font-size: 13px;
          font-weight: 600;
          color: #f97316;
          background: none;
          border: none;
          cursor: pointer;
          transition: color 0.2s ease, opacity 0.2s ease;
          padding: 4px 8px;
          border-radius: 6px;
        }
        .verify-resend-btn:hover:not(:disabled) {
          color: #fb923c;
        }
        .verify-resend-btn[data-disabled="true"] {
          color: rgba(255,255,255,0.25);
          cursor: not-allowed;
        }
        .verify-resend-btn:disabled {
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}
