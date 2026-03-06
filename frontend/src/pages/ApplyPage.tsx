import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { publicApi as axios } from '../utils/api';
import {
  Upload, CheckCircle, AlertCircle, Loader2, FileText, MapPin,
  DollarSign, ArrowDown, Mail, ShieldCheck,
} from 'lucide-react';
import { CustomQuestion } from '../types';

interface VacancyInfo {
  id: string;
  title: string;
  description: string;
  location: string;
  remote: boolean;
  salary_range?: { min: number; max: number; currency: string };
  requirements: {
    hard_skills?: string[];
    experience_years?: number;
    education?: { required?: string };
    soft_skills?: string[];
  };
  custom_questions?: CustomQuestion[];
}

// ── Custom question renderer ──────────────────────────────────────────────────
function CustomQuestionField({
  question,
  value,
  onChange,
  error,
}: {
  question: CustomQuestion;
  value: string | string[];
  onChange: (val: string | string[]) => void;
  error?: boolean;
}) {
  const borderStyle = error
    ? '1px solid rgba(239,68,68,0.5)'
    : '1px solid rgba(255,255,255,0.07)';

  switch (question.type) {
    case 'text':
      return (
        <input
          type="text"
          className="input"
          placeholder={question.placeholder || 'Ваш ответ...'}
          value={value as string}
          onChange={(e) => onChange(e.target.value)}
          style={error ? { border: '1px solid rgba(239,68,68,0.5)' } : {}}
        />
      );

    case 'textarea':
      return (
        <textarea
          className="input resize-none"
          rows={3}
          placeholder={question.placeholder || 'Ваш ответ...'}
          value={value as string}
          onChange={(e) => onChange(e.target.value)}
          style={error ? { border: '1px solid rgba(239,68,68,0.5)' } : {}}
        />
      );

    case 'radio':
      return (
        <div className="space-y-2">
          {(question.options || []).map((opt) => (
            <label
              key={opt}
              className="flex items-center gap-3 cursor-pointer p-3 rounded-xl transition-all"
              style={{
                background: value === opt ? 'rgba(255,110,0,0.10)' : 'rgba(255,255,255,0.03)',
                border: value === opt ? '1px solid rgba(255,110,0,0.35)' : borderStyle,
              }}
            >
              <div
                style={{
                  width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                  border: `2px solid ${value === opt ? '#FF9A3C' : 'rgba(255,255,255,0.2)'}`,
                  background: value === opt ? '#FF9A3C' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                {value === opt && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#000' }} />}
              </div>
              <input type="radio" className="hidden" name={question.id} value={opt} checked={value === opt} onChange={() => onChange(opt)} />
              <span className="text-sm" style={{ color: value === opt ? '#fff' : 'rgba(255,255,255,0.6)' }}>{opt}</span>
            </label>
          ))}
        </div>
      );

    case 'checkbox': {
      const checked = Array.isArray(value) ? value : [];
      return (
        <div className="space-y-2">
          {(question.options || []).map((opt) => {
            const isOn = checked.includes(opt);
            return (
              <label
                key={opt}
                className="flex items-center gap-3 cursor-pointer p-3 rounded-xl transition-all"
                style={{
                  background: isOn ? 'rgba(255,110,0,0.10)' : 'rgba(255,255,255,0.03)',
                  border: isOn ? '1px solid rgba(255,110,0,0.35)' : borderStyle,
                }}
              >
                <div
                  style={{
                    width: 18, height: 18, borderRadius: 4, flexShrink: 0,
                    border: `2px solid ${isOn ? '#FF9A3C' : 'rgba(255,255,255,0.2)'}`,
                    background: isOn ? '#FF9A3C' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  {isOn && <span style={{ color: '#000', fontSize: 10, fontWeight: 900 }}>✓</span>}
                </div>
                <input type="checkbox" className="hidden" checked={isOn}
                  onChange={() => onChange(isOn ? checked.filter((c) => c !== opt) : [...checked, opt])} />
                <span className="text-sm" style={{ color: isOn ? '#fff' : 'rgba(255,255,255,0.6)' }}>{opt}</span>
              </label>
            );
          })}
        </div>
      );
    }

    case 'yesno':
      return (
        <div className="flex gap-3">
          {['Да', 'Нет'].map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(opt)}
              className="flex-1 py-3 rounded-xl font-semibold text-sm transition-all"
              style={{
                background: value === opt
                  ? opt === 'Да' ? 'rgba(16,185,129,0.18)' : 'rgba(239,68,68,0.12)'
                  : 'rgba(255,255,255,0.04)',
                border: value === opt
                  ? opt === 'Да' ? '1px solid rgba(16,185,129,0.4)' : '1px solid rgba(239,68,68,0.3)'
                  : borderStyle,
                color: value === opt
                  ? opt === 'Да' ? '#10b981' : '#f87171'
                  : 'rgba(255,255,255,0.45)',
              }}
            >
              {opt}
            </button>
          ))}
        </div>
      );

    case 'scale': {
      const numVal = Number(value) || 5;
      return (
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>1</span>
            <span className="text-lg font-black" style={{ color: '#FF9A3C' }}>{numVal}</span>
            <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>10</span>
          </div>
          <input type="range" min="1" max="10" value={numVal} onChange={(e) => onChange(e.target.value)} className="w-full" />
        </div>
      );
    }

    default:
      return null;
  }
}

// ── Email verification step ───────────────────────────────────────────────────
function EmailVerifyStep({
  onVerified,
}: {
  onVerified: (email: string, token: string) => void;
}) {
  const [email, setEmail] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const sendCode = async () => {
    setError('');
    setSending(true);
    try {
      await axios.post('/api/public/request-candidate-code', { email: email.trim() });
      setCodeSent(true);
      setCooldown(60);
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Не удалось отправить код');
    } finally {
      setSending(false);
    }
  };

  const handleCodeChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newCode = [...code];
    newCode[index] = value.slice(-1);
    setCode(newCode);
    if (value && index < 5) inputRefs.current[index + 1]?.focus();
    if (value && index === 5) {
      const full = [...newCode.slice(0, 5), value.slice(-1)].join('');
      if (full.length === 6) verifyCode(full);
    }
  };

  const handleCodeKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) inputRefs.current[index - 1]?.focus();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    const newCode = Array(6).fill('').map((_, i) => pasted[i] || '');
    setCode(newCode);
    inputRefs.current[Math.min(pasted.length, 5)]?.focus();
    if (pasted.length === 6) verifyCode(pasted);
  };

  const verifyCode = async (codeStr?: string) => {
    const full = codeStr || code.join('');
    if (full.length !== 6) { setError('Введите все 6 цифр'); return; }
    setError('');
    setVerifying(true);
    try {
      const res = await axios.post('/api/public/verify-candidate-code', {
        email: email.trim(),
        code: full,
      });
      onVerified(email.trim().toLowerCase(), res.data.candidate_token as string);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Неверный код');
      setCode(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="card" style={{ padding: '2rem' }}>
      <div className="flex items-center gap-3 mb-5">
        <div
          style={{
            width: 40, height: 40, borderRadius: 10, flexShrink: 0,
            background: 'rgba(255,110,0,0.12)',
            border: '1px solid rgba(255,110,0,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Mail size={18} style={{ color: '#FF9A3C' }} />
        </div>
        <div>
          <p className="font-bold text-white">Подтвердите ваш email</p>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Нужен для защиты от спама и идентификации вашей заявки
          </p>
        </div>
      </div>

      {error && (
        <div
          className="flex items-center gap-2 p-3 rounded-xl text-sm mb-4"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}
        >
          <AlertCircle size={14} className="shrink-0" />
          {error}
        </div>
      )}

      {!codeSent ? (
        <div className="space-y-3">
          <div>
            <label className="label">Email <span style={{ color: '#f87171' }}>*</span></label>
            <input
              type="email"
              className="input"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && email && sendCode()}
              autoFocus
            />
          </div>
          <button
            className="btn-primary w-full justify-center"
            onClick={sendCode}
            disabled={sending || !email.trim()}
          >
            {sending ? <><Loader2 size={16} className="animate-spin" />Отправляем...</> : 'Получить код подтверждения'}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
            Код отправлен на <span style={{ color: '#FF9A3C' }}>{email}</span>
          </p>

          {/* 6-digit input */}
          <div className="flex gap-2 justify-center" onPaste={handlePaste}>
            {code.map((digit, i) => (
              <input
                key={i}
                ref={(el) => { inputRefs.current[i] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleCodeChange(i, e.target.value)}
                onKeyDown={(e) => handleCodeKeyDown(i, e)}
                className="text-center font-black text-xl transition-all"
                style={{
                  width: 46, height: 54, borderRadius: 10,
                  background: digit ? 'rgba(255,106,0,0.12)' : 'rgba(255,255,255,0.04)',
                  border: `2px solid ${digit ? 'rgba(255,106,0,0.5)' : 'rgba(255,255,255,0.1)'}`,
                  color: digit ? '#FF9A3C' : 'rgba(255,255,255,0.3)',
                  outline: 'none', caretColor: '#FF9A3C',
                }}
              />
            ))}
          </div>

          <button
            className="btn-primary w-full justify-center"
            onClick={() => verifyCode()}
            disabled={verifying || code.join('').length < 6}
          >
            {verifying
              ? <><Loader2 size={16} className="animate-spin" />Проверяем...</>
              : <><ShieldCheck size={16} />Подтвердить</>}
          </button>

          <div className="text-center">
            <button
              onClick={sendCode}
              disabled={sending || cooldown > 0}
              className="text-sm font-semibold"
              style={{ color: cooldown > 0 ? 'rgba(255,255,255,0.25)' : '#FF9A3C', cursor: cooldown > 0 ? 'not-allowed' : 'pointer' }}
            >
              {cooldown > 0 ? `Повторить через ${cooldown} сек` : 'Отправить снова'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ApplyPage() {
  const { vacancyId } = useParams<{ vacancyId: string }>();
  const [vacancy, setVacancy] = useState<VacancyInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [pageError, setPageError] = useState('');
  const [formError, setFormError] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);

  // Verified email state
  const [verifiedEmail, setVerifiedEmail] = useState('');
  const [candidateToken, setCandidateToken] = useState('');

  const [form, setForm] = useState({
    full_name: '',
    phone: '',
    experience: '',
    skills: '',
    cover_letter: '',
  });

  // Track which required question IDs have errors
  const [questionErrors, setQuestionErrors] = useState<Set<string>>(new Set());
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});

  useEffect(() => {
    axios
      .get(`/api/public/vacancy/${vacancyId}`)
      .then((r) => setVacancy(r.data.vacancy))
      .catch(() => setPageError('Вакансия не найдена или уже закрыта'))
      .finally(() => setLoading(false));
  }, [vacancyId]);

  const customQuestions: CustomQuestion[] = vacancy?.custom_questions || [];

  const handleVerified = (email: string, token: string) => {
    setVerifiedEmail(email);
    setCandidateToken(token);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  const handleFile = (f: File) => {
    const allowed = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    if (allowed.includes(f.type)) { setFile(f); setFormError(''); }
    else setFormError('Только PDF или DOCX файлы');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const validateAndSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    // Validate required custom questions
    const errors = new Set<string>();
    for (const q of customQuestions) {
      if (!q.required) continue;
      const ans = answers[q.id];
      const empty = ans === undefined || ans === null || ans === '' || (Array.isArray(ans) && ans.length === 0);
      if (empty) errors.add(q.id);
    }

    if (errors.size > 0) {
      setQuestionErrors(errors);
      setFormError('Заполните все обязательные вопросы (отмечены *)');
      // Scroll to first error
      const firstErrorId = [...errors][0];
      document.getElementById(`q-${firstErrorId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setQuestionErrors(new Set());

    setSubmitting(true);
    try {
      const data = new FormData();
      data.append('full_name', form.full_name);
      data.append('email', verifiedEmail);
      data.append('phone', form.phone);
      data.append('experience', form.experience);
      data.append('skills', form.skills);
      data.append('cover_letter', form.cover_letter);
      data.append('candidate_token', candidateToken);

      if (customQuestions.length > 0) {
        const answersMap: Record<string, string | string[]> = {};
        customQuestions.forEach((q) => {
          if (answers[q.id] !== undefined) answersMap[q.id] = answers[q.id];
        });
        data.append('custom_answers', JSON.stringify(answersMap));
      }

      if (file) data.append('resume', file);

      await axios.post(`/api/public/apply/${vacancyId}`, data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setSubmitted(true);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setFormError(msg || 'Ошибка при отправке. Попробуйте ещё раз.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Loading ──
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={32} className="animate-spin" style={{ color: '#FF9A3C' }} />
      </div>
    );
  }

  // ── Not found ──
  if (pageError && !vacancy) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="card text-center" style={{ maxWidth: 420, width: '100%', padding: '3rem' }}>
          <div className="inline-flex items-center justify-center mb-4"
            style={{ width: 64, height: 64, background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 18 }}>
            <AlertCircle size={28} className="text-red-400" />
          </div>
          <p className="text-white text-xl font-bold mb-2">Вакансия недоступна</p>
          <p style={{ color: 'rgba(255,255,255,0.4)' }}>{pageError}</p>
        </div>
      </div>
    );
  }

  // ── Submitted ──
  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="card text-center" style={{ maxWidth: 440, width: '100%', padding: '3rem' }}>
          <div className="inline-flex items-center justify-center mb-5"
            style={{ width: 72, height: 72, background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 20, animation: 'scaleIn 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
            <CheckCircle size={36} style={{ color: '#10b981' }} />
          </div>
          <h2 className="text-2xl font-black text-white mb-3">Заявка отправлена!</h2>
          <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>
            Спасибо, <span className="text-white font-semibold">{form.full_name}</span>!<br />
            Мы рассмотрим заявку и свяжемся на{' '}
            <span style={{ color: '#FF9A3C' }}>{verifiedEmail}</span>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-10 px-4" style={{ position: 'relative' }}>
      <div style={{
        position: 'fixed', top: 0, left: '50%', transform: 'translateX(-50%)',
        width: 800, height: 400,
        background: 'radial-gradient(ellipse at 50% 0%, rgba(255,106,0,0.08) 0%, transparent 70%)',
        pointerEvents: 'none', zIndex: 0,
      }} />

      <div className="max-w-2xl mx-auto relative" style={{ zIndex: 1 }}>
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="flex items-center justify-center font-black text-black"
            style={{ width: 38, height: 38, background: 'linear-gradient(135deg, #FF6A00 0%, #FF9A3C 100%)', borderRadius: 10, boxShadow: '0 4px 12px rgba(255,106,0,0.4)', fontSize: '1rem' }}>
            R
          </div>
          <span className="text-white font-bold text-xl">Рекрутор <span style={{ color: '#FF9A3C' }}>AI</span></span>
        </div>

        {/* ── Job Details ── */}
        <div className="card mb-6" style={{ padding: '2rem' }}>
          <h1 className="text-3xl font-black text-white mb-3">{vacancy?.title}</h1>

          {/* Meta */}
          <div className="flex items-center flex-wrap gap-3 mb-5 text-sm">
            {vacancy?.location && (
              <span className="flex items-center gap-1.5" style={{ color: 'rgba(255,255,255,0.5)' }}>
                <MapPin size={13} />{vacancy.location}
              </span>
            )}
            {vacancy?.remote && (
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold"
                style={{ background: 'rgba(59,130,246,0.12)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.25)' }}>
                Удалённо
              </span>
            )}
            {vacancy?.salary_range && (
              <span className="flex items-center gap-1 font-semibold" style={{ color: '#10b981' }}>
                <DollarSign size={13} />
                {vacancy.salary_range.min.toLocaleString()}–{vacancy.salary_range.max.toLocaleString()} {vacancy.salary_range.currency}
              </span>
            )}
          </div>

          {vacancy?.description && (
            <div className="mb-5">
              <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: 'rgba(255,154,60,0.7)' }}>О вакансии</p>
              <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.6)' }}>{vacancy.description}</p>
            </div>
          )}

          {(vacancy?.requirements?.hard_skills || []).length > 0 && (
            <div className="mb-5">
              <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: 'rgba(255,154,60,0.7)' }}>Требуемые навыки</p>
              <div className="flex flex-wrap gap-1.5">
                {vacancy!.requirements.hard_skills!.map((skill) => (
                  <span key={skill} className="skill-tag">{skill}</span>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3 flex-wrap">
            {(vacancy?.requirements?.experience_years ?? 0) > 0 && (
              <div className="px-3 py-2 rounded-xl text-sm"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' }}>
                Опыт: {vacancy!.requirements.experience_years}+ лет
              </div>
            )}
            {vacancy?.requirements?.education?.required && (
              <div className="px-3 py-2 rounded-xl text-sm"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' }}>
                Образование: {vacancy.requirements.education.required}
              </div>
            )}
          </div>

          <button
            className="btn-primary w-full justify-center mt-6"
            onClick={() => formRef.current?.scrollIntoView({ behavior: 'smooth' })}
          >
            <ArrowDown size={16} />
            Откликнуться на вакансию
          </button>
        </div>

        {/* ── Email verification OR badge ── */}
        <div ref={formRef}>
          {!verifiedEmail ? (
            <EmailVerifyStep onVerified={handleVerified} />
          ) : (
            <>
              {/* Verified badge */}
              <div
                className="flex items-center gap-3 px-4 py-3 rounded-2xl mb-5"
                style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}
              >
                <ShieldCheck size={16} style={{ color: '#10b981', flexShrink: 0 }} />
                <p className="text-sm font-semibold" style={{ color: '#10b981' }}>
                  Email подтверждён: <span style={{ color: '#6ee7b7' }}>{verifiedEmail}</span>
                </p>
              </div>

              {/* ── Application form ── */}
              <div className="card" style={{ padding: '2rem' }}>
                <h2 className="text-lg font-bold text-white mb-6">Подать заявку</h2>

                {formError && (
                  <div className="flex items-center gap-2.5 p-3 rounded-xl text-sm mb-4"
                    style={{ background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171' }}>
                    <AlertCircle size={15} className="shrink-0" />
                    {formError}
                  </div>
                )}

                <form onSubmit={validateAndSubmit} className="space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label">Полное имя <span style={{ color: '#f87171' }}>*</span></label>
                      <input type="text" placeholder="Иван Иванов"
                        value={form.full_name}
                        onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                        className="input" required />
                    </div>
                    <div>
                      <label className="label">Телефон</label>
                      <input type="tel" placeholder="+998 90 123 45 67"
                        value={form.phone}
                        onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                        className="input" />
                    </div>
                  </div>

                  <div>
                    <label className="label">Email</label>
                    <input type="email" className="input" value={verifiedEmail} readOnly
                      style={{ opacity: 0.6, cursor: 'not-allowed' }} />
                  </div>

                  <div>
                    <label className="label">Опыт работы</label>
                    <textarea placeholder="Где работали, сколько лет, что делали..."
                      value={form.experience} onChange={(e) => setForm((f) => ({ ...f, experience: e.target.value }))}
                      rows={3} className="input resize-none" />
                  </div>

                  <div>
                    <label className="label">Навыки и технологии</label>
                    <textarea placeholder="Python, Django, PostgreSQL, Docker..."
                      value={form.skills} onChange={(e) => setForm((f) => ({ ...f, skills: e.target.value }))}
                      rows={2} className="input resize-none" />
                  </div>

                  {/* Custom questions */}
                  {customQuestions.length > 0 && (
                    <div className="space-y-5 pt-5" style={{ borderTop: '1px solid rgba(255,110,0,0.08)' }}>
                      <p className="text-sm font-bold text-white">Дополнительные вопросы</p>
                      {customQuestions.map((q) => {
                        const hasError = questionErrors.has(q.id);
                        return (
                          <div key={q.id} id={`q-${q.id}`}>
                            <label className="label flex items-center gap-1">
                              {q.label}
                              {q.required && <span style={{ color: '#f87171' }}>*</span>}
                            </label>
                            <CustomQuestionField
                              question={q}
                              value={answers[q.id] ?? (q.type === 'scale' ? '5' : q.type === 'checkbox' ? [] : '')}
                              onChange={(val) => {
                                setAnswers((prev) => ({ ...prev, [q.id]: val }));
                                if (questionErrors.has(q.id)) {
                                  setQuestionErrors((prev) => {
                                    const next = new Set(prev);
                                    next.delete(q.id);
                                    return next;
                                  });
                                }
                              }}
                              error={hasError}
                            />
                            {hasError && (
                              <p className="text-xs mt-1" style={{ color: '#f87171' }}>Обязательное поле</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div>
                    <label className="label">Сопроводительное письмо</label>
                    <textarea placeholder="Почему вы хотите работать у нас..."
                      value={form.cover_letter} onChange={(e) => setForm((f) => ({ ...f, cover_letter: e.target.value }))}
                      rows={3} className="input resize-none" />
                  </div>

                  {/* Resume upload */}
                  <div>
                    <label className="label">Резюме <span style={{ color: 'rgba(255,255,255,0.25)' }}>(PDF или DOCX)</span></label>
                    <div
                      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                      onDragLeave={() => setDragOver(false)}
                      onDrop={handleDrop}
                      onClick={() => document.getElementById('resume-input')?.click()}
                      className="rounded-2xl p-6 text-center cursor-pointer transition-all"
                      style={{
                        border: `2px dashed ${dragOver ? 'rgba(255,110,0,0.5)' : file ? 'rgba(16,185,129,0.4)' : 'rgba(255,110,0,0.15)'}`,
                        background: dragOver ? 'rgba(255,110,0,0.06)' : file ? 'rgba(16,185,129,0.05)' : 'rgba(0,0,0,0.2)',
                      }}
                    >
                      <input id="resume-input" type="file" accept=".pdf,.doc,.docx" className="hidden"
                        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
                      {file ? (
                        <div className="flex items-center justify-center gap-3">
                          <FileText size={22} style={{ color: '#10b981' }} />
                          <div className="text-left">
                            <p className="text-white text-sm font-semibold">{file.name}</p>
                            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
                              {(file.size / 1024).toFixed(0)} KB · Нажмите чтобы заменить
                            </p>
                          </div>
                        </div>
                      ) : (
                        <>
                          <Upload size={22} className="mx-auto mb-2" style={{ color: 'rgba(255,110,0,0.4)' }} />
                          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
                            Перетащите файл или <span style={{ color: '#FF9A3C' }}>нажмите для выбора</span>
                          </p>
                          <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.2)' }}>PDF, DOC, DOCX до 5 МБ</p>
                        </>
                      )}
                    </div>
                  </div>

                  <button type="submit" disabled={submitting || !form.full_name.trim()} className="btn-primary w-full justify-center py-3">
                    {submitting
                      ? <><Loader2 size={17} className="animate-spin" />Отправляем...</>
                      : 'Отправить заявку'}
                  </button>
                </form>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
