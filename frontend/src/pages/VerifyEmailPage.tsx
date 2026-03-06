import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Mail, RefreshCw, CheckCircle } from 'lucide-react';
import { authApi } from '../utils/api';
import { useAuthStore } from '../utils/auth-store';

export default function VerifyEmailPage() {
  const navigate = useNavigate();
  const { user, token } = useAuthStore();
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
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

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newCode = [...code];
    newCode[index] = value.slice(-1);
    setCode(newCode);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 digits entered
    if (value && index === 5) {
      const full = [...newCode.slice(0, 5), value.slice(-1)].join('');
      if (full.length === 6) {
        handleVerify(full);
      }
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    const newCode = [...code];
    for (let i = 0; i < 6; i++) {
      newCode[i] = pasted[i] || '';
    }
    setCode(newCode);
    const lastIdx = Math.min(pasted.length, 5);
    inputRefs.current[lastIdx]?.focus();

    if (pasted.length === 6) {
      handleVerify(pasted);
    }
  };

  const handleVerify = async (codeStr?: string) => {
    const fullCode = codeStr || code.join('');
    if (fullCode.length !== 6) {
      toast.error('Введите все 6 цифр');
      return;
    }
    setLoading(true);
    try {
      await authApi.verify(fullCode);
      toast.success('Email подтверждён!');
      navigate('/vacancies');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg || 'Неверный код');
      setCode(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

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
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ position: 'relative', overflow: 'hidden' }}
    >
      <div
        style={{
          position: 'absolute',
          inset: '-50%',
          background: 'conic-gradient(from 0deg at 50% 50%, transparent 0deg, rgba(255,106,0,0.15) 90deg, rgba(255,154,60,0.10) 180deg, transparent 360deg)',
          animation: 'heroRotate 25s linear infinite',
          filter: 'blur(80px)',
          opacity: 0.5,
          zIndex: 0,
          pointerEvents: 'none',
        }}
      />

      <div className="w-full max-w-md relative" style={{ zIndex: 1 }}>
        {/* Header */}
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center mb-5"
            style={{
              width: 72,
              height: 72,
              background: 'linear-gradient(135deg, rgba(255,106,0,0.2) 0%, rgba(255,154,60,0.1) 100%)',
              border: '1px solid rgba(255,106,0,0.3)',
              borderRadius: 20,
              boxShadow: '0 0 40px rgba(255,106,0,0.2)',
            }}
          >
            <Mail size={32} style={{ color: '#FF9A3C' }} />
          </div>
          <h1 className="text-3xl font-black text-white mb-2">Подтвердите email</h1>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
            Мы отправили 6-значный код на{' '}
            <span style={{ color: '#FF9A3C' }}>{user?.email || 'ваш email'}</span>
          </p>
        </div>

        <div className="card-elevated" style={{ padding: '2rem' }}>
          {/* Code inputs */}
          <div className="flex gap-3 justify-center mb-6" onPaste={handlePaste}>
            {code.map((digit, i) => (
              <input
                key={i}
                ref={(el) => { inputRefs.current[i] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                className="text-center font-black text-2xl transition-all"
                style={{
                  width: 52,
                  height: 60,
                  background: digit
                    ? 'rgba(255,106,0,0.12)'
                    : 'rgba(255,255,255,0.04)',
                  border: `2px solid ${digit ? 'rgba(255,106,0,0.5)' : 'rgba(255,255,255,0.1)'}`,
                  borderRadius: 12,
                  color: digit ? '#FF9A3C' : 'rgba(255,255,255,0.3)',
                  outline: 'none',
                  caretColor: '#FF9A3C',
                  fontSize: '1.5rem',
                }}
              />
            ))}
          </div>

          <button
            className="btn-primary w-full justify-center py-3 mb-4"
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
          </button>

          <div className="text-center">
            <p className="text-sm mb-2" style={{ color: 'rgba(255,255,255,0.35)' }}>
              Не получили письмо?
            </p>
            <button
              onClick={handleResend}
              disabled={resending || cooldown > 0}
              className="text-sm font-semibold transition-all"
              style={{
                color: cooldown > 0 ? 'rgba(255,255,255,0.25)' : '#FF9A3C',
                cursor: cooldown > 0 ? 'not-allowed' : 'pointer',
              }}
            >
              {resending
                ? 'Отправляем...'
                : cooldown > 0
                ? `Повторить через ${cooldown} сек`
                : 'Отправить снова'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
