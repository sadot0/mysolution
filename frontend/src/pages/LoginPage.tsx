import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { authApi } from '../utils/api';
import { useAuthStore } from '../utils/auth-store';
import { Organization } from '../types';

export default function LoginPage() {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ email: '', password: '', name: '', company_name: '' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = mode === 'login'
        ? await authApi.login(form.email, form.password)
        : await authApi.register(form.email, form.password, form.name, form.company_name || undefined);

      const { token, user, organization, needs_verification } = res.data;
      setAuth(token, user, (organization as Organization) || null);

      if (needs_verification) {
        navigate('/verify-email');
      } else {
        navigate('/vacancies');
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg || 'Ошибка авторизации');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ position: 'relative', overflow: 'hidden' }}
    >
      {/* Animated hero background */}
      <div
        style={{
          position: 'absolute',
          inset: '-50%',
          background: 'conic-gradient(from 0deg at 50% 50%, transparent 0deg, rgba(255,106,0,0.18) 90deg, rgba(255,154,60,0.12) 180deg, rgba(255,190,123,0.08) 270deg, transparent 360deg)',
          animation: 'heroRotate 25s linear infinite',
          filter: 'blur(80px)',
          opacity: 0.6,
          zIndex: 0,
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse at 50% 40%, rgba(255,106,0,0.12) 0%, transparent 65%)',
          zIndex: 0,
          pointerEvents: 'none',
        }}
      />

      <div className="w-full max-w-md relative" style={{ zIndex: 1 }}>
        {/* Header */}
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center mb-5 font-black text-black text-3xl"
            style={{
              width: 72,
              height: 72,
              background: 'linear-gradient(135deg, #FF6A00 0%, #FF9A3C 50%, #FFBE7B 100%)',
              borderRadius: 20,
              boxShadow: '0 8px 32px rgba(255,106,0,0.5), 0 0 60px rgba(255,106,0,0.25), inset 0 1px 0 rgba(255,255,255,0.35)',
              animation: 'float 3s ease-in-out infinite',
            }}
          >
            R
          </div>
          <h1 className="text-3xl font-black text-white mb-1">
            Рекрутор{' '}
            <span className="gradient-text">AI</span>
          </h1>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
            HR Intelligence Platform
          </p>
        </div>

        {/* Card */}
        <div className="card-elevated" style={{ padding: '2rem' }}>
          {/* Tab switcher */}
          <div
            className="flex mb-6 p-1"
            style={{
              background: 'rgba(0,0,0,0.4)',
              border: '1px solid rgba(255,110,0,0.10)',
              borderRadius: 14,
            }}
          >
            {(['login', 'register'] as const).map((m) => (
              <button
                key={m}
                className="flex-1 py-2.5 text-sm font-semibold rounded-xl transition-all"
                style={
                  mode === m
                    ? {
                        background: 'linear-gradient(135deg, #FF6A00 0%, #FF9A3C 100%)',
                        color: '#000',
                        boxShadow: '0 4px 12px rgba(255,106,0,0.4)',
                      }
                    : { color: 'rgba(255,255,255,0.4)' }
                }
                onClick={() => setMode(m)}
              >
                {m === 'login' ? 'Войти' : 'Регистрация'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <>
                <div>
                  <label className="label">Имя</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="Иван Иванов"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="label">
                    Название компании{' '}
                    <span style={{ color: 'rgba(255,255,255,0.3)', fontWeight: 'normal' }}>(необязательно)</span>
                  </label>
                  <input
                    type="text"
                    className="input"
                    placeholder="My Company Ltd."
                    value={form.company_name}
                    onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                  />
                </div>
              </>
            )}
            <div>
              <label className="label">Email</label>
              <input
                type="email"
                className="input"
                placeholder="hr@company.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="label">Пароль</label>
              <input
                type="password"
                className="input"
                placeholder="••••••••"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
                minLength={8}
              />
            </div>
            <button type="submit" className="btn-primary w-full justify-center py-3 mt-2" disabled={loading}>
              {loading ? 'Загрузка...' : mode === 'login' ? 'Войти' : 'Зарегистрироваться'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
