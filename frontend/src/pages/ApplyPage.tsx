import { motion } from 'framer-motion';
import { usePageTitle } from '../utils/usePageTitle';
import { pageVariants } from '../utils/animations';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { publicApi as axios } from '../utils/api';
import {
  Upload, CheckCircle, AlertCircle, Loader2, FileText, MapPin,
  DollarSign, ArrowDown, Mail, ShieldCheck, User, Phone,
  Briefcase, Code, PenLine, ChevronRight, Clock, GraduationCap,
  Lock, X, Globe, Link as LinkIcon, ArrowLeft,
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

/* ============================================================
   Step indicator — progress bar with labeled steps
   ============================================================ */
function StepIndicator({ current, total, labels }: { current: number; total: number; labels: string[] }) {
  const progress = ((current - 1) / (total - 1)) * 100;

  return (
    <div className="mb-8">
      {/* Progress bar */}
      <div className="relative h-1.5 rounded-full bg-white/[0.06] mb-4 overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all duration-500 ease-out bg-gradient-to-r from-orange-600 to-orange-400"
          style={{ width: `${progress}%` }}
        />
      </div>
      {/* Step labels */}
      <div className="flex items-center justify-between">
        {labels.map((label, i) => {
          const step = i + 1;
          const isActive = step === current;
          const isDone = step < current;
          return (
            <div key={step} className="flex items-center gap-2">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all duration-300 border ${
                  isDone
                    ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                    : isActive
                    ? 'bg-orange-500/20 border-orange-500/50 text-orange-400'
                    : 'bg-neutral-800 border-neutral-700 text-neutral-500'
                }`}
              >
                {isDone ? <CheckCircle size={13} /> : step}
              </div>
              <span
                className={`text-xs font-semibold hidden sm:inline transition-colors ${
                  isActive ? 'text-white' : isDone ? 'text-neutral-400' : 'text-neutral-600'
                }`}
              >
                {label}
              </span>
              {step < total && (
                <ChevronRight size={12} className="text-neutral-700 shrink-0 ml-1 hidden sm:block" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============================================================
   Custom question renderer
   ============================================================ */
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
  const errorBorder = error ? 'border-red-500/50' : 'border-white/[0.07]';

  switch (question.type) {
    case 'text':
      return (
        <input
          type="text"
          className={`input ${error ? 'border-red-500/50' : ''}`}
          placeholder={question.placeholder || 'Ваш ответ...'}
          value={value as string}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case 'textarea':
      return (
        <textarea
          className={`input resize-none ${error ? 'border-red-500/50' : ''}`}
          rows={3}
          placeholder={question.placeholder || 'Ваш ответ...'}
          value={value as string}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case 'radio':
      return (
        <div className="space-y-2">
          {(question.options || []).map((opt) => (
            <label
              key={opt}
              className={`flex items-center gap-3 cursor-pointer p-3.5 rounded-xl transition-all border ${
                value === opt
                  ? 'bg-orange-500/10 border-orange-500/35'
                  : `bg-white/[0.03] ${errorBorder}`
              }`}
            >
              <div
                className={`w-[18px] h-[18px] rounded-full shrink-0 border-2 flex items-center justify-center ${
                  value === opt ? 'border-orange-400 bg-orange-400' : 'border-white/20 bg-transparent'
                }`}
              >
                {value === opt && <div className="w-1.5 h-1.5 rounded-full bg-black" />}
              </div>
              <input type="radio" className="hidden" name={question.id} value={opt} checked={value === opt} onChange={() => onChange(opt)} />
              <span className={`text-sm ${value === opt ? 'text-white' : 'text-white/60'}`}>{opt}</span>
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
                className={`flex items-center gap-3 cursor-pointer p-3.5 rounded-xl transition-all border ${
                  isOn
                    ? 'bg-orange-500/10 border-orange-500/35'
                    : `bg-white/[0.03] ${errorBorder}`
                }`}
              >
                <div
                  className={`w-[18px] h-[18px] rounded shrink-0 border-2 flex items-center justify-center ${
                    isOn ? 'border-orange-400 bg-orange-400' : 'border-white/20 bg-transparent'
                  }`}
                >
                  {isOn && <span className="text-black text-[10px] font-black">&#10003;</span>}
                </div>
                <input type="checkbox" className="hidden" checked={isOn}
                  onChange={() => onChange(isOn ? checked.filter((c) => c !== opt) : [...checked, opt])} />
                <span className={`text-sm ${isOn ? 'text-white' : 'text-white/60'}`}>{opt}</span>
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
              className={`flex-1 py-3.5 rounded-xl font-semibold text-sm transition-all border ${
                value === opt
                  ? opt === 'Да'
                    ? 'bg-emerald-500/[0.18] border-emerald-500/40 text-emerald-500'
                    : 'bg-red-500/[0.12] border-red-500/30 text-red-400'
                  : `bg-white/[0.04] ${errorBorder} text-white/[0.45]`
              }`}
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
            <span className="text-xs text-white/30">1</span>
            <span className="text-lg font-black text-orange-400">{numVal}</span>
            <span className="text-xs text-white/30">10</span>
          </div>
          <input type="range" min="1" max="10" value={numVal} onChange={(e) => onChange(e.target.value)} className="w-full" />
        </div>
      );
    }

    default:
      return null;
  }
}

/* ============================================================
   Email verification step
   ============================================================ */
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
  const [emailTouched, setEmailTouched] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const sendCode = async () => {
    if (!isValidEmail) {
      setError('Введите корректный email');
      return;
    }
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
    <div className="card p-6 sm:p-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="shrink-0 w-11 h-11 rounded-xl flex items-center justify-center bg-orange-500/[0.12] border border-orange-500/25">
          <Mail size={20} className="text-orange-400" />
        </div>
        <div>
          <p className="font-bold text-white text-base">Подтвердите ваш email</p>
          <p className="text-xs mt-0.5 text-white/40">
            Для защиты от спама и идентификации заявки
          </p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2.5 p-3.5 rounded-xl text-sm mb-5 bg-red-500/[0.08] border border-red-500/20 text-red-400">
          <AlertCircle size={15} className="shrink-0" />
          {error}
        </div>
      )}

      {!codeSent ? (
        <div className="space-y-4">
          <div>
            <label className="label">Email <span className="text-red-400">*</span></label>
            <input
              type="email"
              className={`input py-3 px-4 text-[15px] ${emailTouched && !isValidEmail && email ? 'border-red-500/50' : ''}`}
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => setEmailTouched(true)}
              onKeyDown={(e) => e.key === 'Enter' && email && sendCode()}
              autoFocus
            />
            {emailTouched && !isValidEmail && email && (
              <p className="text-xs text-red-400 mt-1.5">Введите корректный email адрес</p>
            )}
          </div>
          <button
            className="btn-primary w-full justify-center py-3 text-sm"
            onClick={sendCode}
            disabled={sending || !email.trim()}
          >
            {sending ? <><Loader2 size={16} className="animate-spin" />Отправляем...</> : <><Mail size={16} />Получить код подтверждения</>}
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          <p className="text-sm text-white/50">
            Код отправлен на <span className="text-orange-400 font-semibold">{email}</span>
          </p>

          {/* 6-digit input */}
          <div className="flex gap-2.5 justify-center" onPaste={handlePaste}>
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
                className={`w-12 h-14 text-center font-black text-xl rounded-xl border-2 outline-none transition-all caret-orange-400 ${
                  digit
                    ? 'bg-orange-500/[0.12] border-orange-500/50 text-orange-400'
                    : 'bg-white/[0.04] border-white/10 text-white/30'
                }`}
              />
            ))}
          </div>

          <button
            className="btn-primary w-full justify-center py-3"
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
              className={`text-sm font-semibold transition-colors ${
                cooldown > 0 ? 'text-white/25 cursor-not-allowed' : 'text-orange-400 cursor-pointer hover:text-orange-300'
              }`}
            >
              {cooldown > 0 ? `Повторить через ${cooldown} сек` : 'Отправить снова'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   File upload component with drag-and-drop
   ============================================================ */
function FileUploadArea({
  file,
  onFile,
  onClear,
  dragOver,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  file: File | null;
  onFile: (f: File) => void;
  onClear: () => void;
  dragOver: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
}) {
  return (
    <div>
      <label className="label flex items-center gap-1.5">
        <Upload size={11} className="text-neutral-500" />
        Резюме <span className="text-white/25">(PDF или DOCX)</span>
      </label>
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => !file && document.getElementById('resume-input')?.click()}
        className={`rounded-2xl p-8 text-center transition-all duration-200 ${
          file ? 'cursor-default' : 'cursor-pointer'
        } ${
          dragOver
            ? 'border-2 border-dashed border-orange-500/60 bg-orange-500/[0.06]'
            : file
            ? 'border-2 border-dashed border-emerald-500/40 bg-emerald-500/[0.05]'
            : 'border-2 border-dashed border-orange-500/15 bg-black/15 hover:border-orange-500/30 hover:bg-orange-500/[0.03]'
        }`}
      >
        <input
          id="resume-input"
          type="file"
          accept=".pdf,.doc,.docx"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
        />
        {file ? (
          <div className="flex items-center justify-center gap-4">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 bg-emerald-500/[0.12] border border-emerald-500/25">
              <FileText size={20} className="text-emerald-500" />
            </div>
            <div className="text-left flex-1 min-w-0">
              <p className="text-white text-sm font-semibold truncate">{file.name}</p>
              <p className="text-xs mt-0.5 text-white/30">
                {(file.size / 1024).toFixed(0)} KB
              </p>
            </div>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onClear(); }}
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-white/[0.06] border border-white/10 text-white/40 hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/20 transition-all"
              title="Удалить файл"
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <>
            <div className="w-12 h-12 rounded-xl mx-auto mb-3 flex items-center justify-center bg-orange-500/[0.08] border border-orange-500/15">
              <Upload size={22} className="text-orange-500/50" />
            </div>
            <p className="text-sm text-white/50">
              Перетащите файл сюда или <span className="text-orange-400 font-semibold">нажмите для выбора</span>
            </p>
            <p className="text-xs mt-1.5 text-white/20">PDF, DOC, DOCX до 5 МБ</p>
          </>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   Success page after submission
   ============================================================ */
function SuccessScreen({ name, email }: { name: string; email: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="card text-center max-w-lg w-full p-8 sm:p-12">
        {/* Animated checkmark */}
        <div className="relative inline-flex items-center justify-center mb-8">
          <div className="absolute w-24 h-24 rounded-3xl border-2 border-emerald-500/30 animate-ping opacity-20" />
          <div className="w-24 h-24 rounded-3xl bg-emerald-500/[0.12] border border-emerald-500/30 flex items-center justify-center animate-[scaleIn_0.6s_cubic-bezier(0.34,1.56,0.64,1)]">
            <CheckCircle size={44} className="text-emerald-500" />
          </div>
        </div>

        <h2 className="text-3xl font-black text-white mb-3">Ваша заявка отправлена!</h2>
        <p className="text-sm leading-relaxed text-white/50 mb-6 max-w-sm mx-auto">
          Спасибо, <span className="text-white font-semibold">{name}</span>!
          Мы рассмотрим вашу заявку и свяжемся с вами на{' '}
          <span className="text-orange-400">{email}</span>.
        </p>

        <div className="flex items-center gap-3 p-4 rounded-xl mx-auto text-left bg-white/[0.03] border border-white/[0.06] max-w-sm mb-8">
          <Clock size={16} className="text-white/30 shrink-0" />
          <p className="text-xs text-white/40">
            Мы рассмотрим вашу заявку в течение 3-5 рабочих дней
          </p>
        </div>

        <button
          onClick={() => window.close()}
          className="btn-secondary justify-center py-3 px-8 mx-auto"
        >
          Закрыть страницу
        </button>

        {/* Footer */}
        <div className="mt-10 pt-6 border-t border-white/[0.06] flex items-center justify-center gap-2 text-white/20">
          <Lock size={11} />
          <span className="text-xs">Powered by Solution AI</span>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   Main ApplyPage component
   ============================================================ */
export default function ApplyPage() {
  usePageTitle('Заявка');
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

  // Multi-step form state
  const [formStep, setFormStep] = useState(1); // 1 = personal, 2 = professional, 3 = custom questions

  const [form, setForm] = useState({
    full_name: '',
    phone: '',
    linkedin_url: '',
    portfolio_url: '',
    experience: '',
    skills: '',
    cover_letter: '',
  });

  // Validation
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

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
  const hasCustomQuestions = customQuestions.length > 0;

  // Steps: email verification is separate, then multi-step form inside
  const formTotalSteps = hasCustomQuestions ? 3 : 2;

  const handleVerified = (email: string, token: string) => {
    setVerifiedEmail(email);
    setCandidateToken(token);
    setFormStep(1);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  const handleFile = useCallback((f: File) => {
    const allowed = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    if (allowed.includes(f.type)) { setFile(f); setFormError(''); }
    else setFormError('Только PDF или DOCX файлы');
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const validateStep1 = (): boolean => {
    const errors: Record<string, string> = {};
    if (!form.full_name.trim()) errors.full_name = 'Введите ваше имя';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateStep2 = (): boolean => {
    // Step 2 has no strictly required fields, but we keep the method for extensibility
    setFieldErrors({});
    return true;
  };

  const validateStep3 = (): boolean => {
    const errors = new Set<string>();
    for (const q of customQuestions) {
      if (!q.required) continue;
      const ans = answers[q.id];
      const empty = ans === undefined || ans === null || ans === '' || (Array.isArray(ans) && ans.length === 0);
      if (empty) errors.add(q.id);
    }
    setQuestionErrors(errors);
    if (errors.size > 0) {
      setFormError('Заполните все обязательные вопросы (отмечены *)');
      const firstErrorId = [...errors][0];
      document.getElementById(`q-${firstErrorId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return false;
    }
    return true;
  };

  const goNext = () => {
    if (formStep === 1 && !validateStep1()) return;
    if (formStep === 2 && !validateStep2()) return;
    setFormError('');
    setFormStep((s) => Math.min(s + 1, formTotalSteps));
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  const goBack = () => {
    setFormError('');
    setFieldErrors({});
    setFormStep((s) => Math.max(s - 1, 1));
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    // If on step with custom questions, validate them
    if (hasCustomQuestions && formStep === formTotalSteps) {
      if (!validateStep3()) return;
    }

    // Validate step 1 fields even on final submit
    if (!form.full_name.trim()) {
      setFormError('Заполните обязательные поля');
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

      if (form.linkedin_url) data.append('linkedin_url', form.linkedin_url);
      if (form.portfolio_url) data.append('portfolio_url', form.portfolio_url);

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

  // -- Loading --
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 size={36} className="animate-spin text-orange-400" />
          <p className="text-sm text-neutral-500">Загружаем вакансию...</p>
        </div>
      </div>
    );
  }

  // -- Not found --
  if (pageError && !vacancy) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="card text-center max-w-md w-full p-8 sm:p-12">
          <div className="inline-flex items-center justify-center mb-5 w-[68px] h-[68px] rounded-2xl bg-red-500/10 border border-red-500/25">
            <AlertCircle size={30} className="text-red-400" />
          </div>
          <p className="text-white text-xl font-bold mb-2">Вакансия недоступна</p>
          <p className="text-sm text-white/40">{pageError}</p>
        </div>
      </div>
    );
  }

  // -- Success --
  if (submitted) {
    return <SuccessScreen name={form.full_name} email={verifiedEmail} />;
  }

  // Truncated description for header
  const shortDescription = vacancy?.description
    ? vacancy.description.length > 200
      ? vacancy.description.slice(0, 200) + '...'
      : vacancy.description
    : '';

  // Step labels for the progress bar inside the form
  const stepLabels = hasCustomQuestions
    ? ['Личные данные', 'Профессиональные', 'Доп. вопросы']
    : ['Личные данные', 'Профессиональные'];

  return (
    <div className="min-h-screen py-8 sm:py-12 px-4 relative">
      {/* Ambient glow */}
      <div
        className="fixed top-0 left-1/2 -translate-x-1/2 w-[900px] h-[450px] pointer-events-none z-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(255,106,0,0.07)_0%,transparent_70%)]"
      />

      <motion.div variants={pageVariants} initial="initial" animate="animate" className="max-w-2xl mx-auto relative z-[1]">
        {/* Logo / Brand */}
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div
            className="w-10 h-10 flex items-center justify-center font-black text-black rounded-xl text-[1.05rem] bg-gradient-to-br from-orange-600 to-orange-400 shadow-[0_4px_16px_rgba(255,106,0,0.35)]"
          >
            R
          </div>
          <span className="text-white font-bold text-xl tracking-tight">
            SOLUTION <span className="text-orange-400">HUB</span>
          </span>
        </div>

        {/* -- Job Details Card (Professional Header) -- */}
        <div className="card mb-6 p-0 overflow-hidden">
          {/* Company logo placeholder + title */}
          <div
            className="px-6 sm:px-8 pt-6 sm:pt-8 pb-5 bg-gradient-to-b from-orange-500/[0.06] to-transparent border-b border-white/[0.04]"
          >
            <div className="flex items-start gap-4 mb-4">
              {/* Company logo placeholder */}
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-white/[0.06] border border-white/10 flex items-center justify-center shrink-0">
                <Briefcase size={24} className="text-orange-400/60" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-xs font-bold uppercase tracking-widest text-orange-400/60">
                    Открытая вакансия
                  </span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-black text-white leading-tight">{vacancy?.title}</h1>
              </div>
            </div>

            {/* Meta badges */}
            <div className="flex items-center flex-wrap gap-2.5">
              {vacancy?.location && (
                <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/[0.05] border border-white/[0.08] text-white/60">
                  <MapPin size={12} />{vacancy.location}
                </span>
              )}
              {vacancy?.remote && (
                <span className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-500/[0.12] text-blue-400 border border-blue-500/25">
                  <Globe size={12} className="inline mr-1 -mt-0.5" />Удалённо
                </span>
              )}
              {vacancy?.salary_range && (
                <span className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <DollarSign size={12} />
                  {vacancy.salary_range.min.toLocaleString()}&ndash;{vacancy.salary_range.max.toLocaleString()} {vacancy.salary_range.currency}
                </span>
              )}
            </div>
          </div>

          {/* Job body */}
          <div className="px-6 sm:px-8 py-6 space-y-5">
            {shortDescription && (
              <div>
                <p className="text-xs font-bold uppercase tracking-widest mb-2.5 text-orange-400/60">О вакансии</p>
                <p className="text-sm leading-relaxed text-white/60 whitespace-pre-line">{shortDescription}</p>
              </div>
            )}

            {(vacancy?.requirements?.hard_skills || []).length > 0 && (
              <div>
                <p className="text-xs font-bold uppercase tracking-widest mb-2.5 text-orange-400/60">Требуемые навыки</p>
                <div className="flex flex-wrap gap-2">
                  {vacancy!.requirements.hard_skills!.map((skill) => (
                    <span key={skill} className="skill-tag">{skill}</span>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3 flex-wrap">
              {(vacancy?.requirements?.experience_years ?? 0) > 0 && (
                <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-sm bg-white/[0.04] border border-white/[0.08] text-white/60">
                  <Briefcase size={13} className="shrink-0 text-white/30" />
                  Опыт: {vacancy!.requirements.experience_years}+ лет
                </div>
              )}
              {vacancy?.requirements?.education?.required && (
                <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-sm bg-white/[0.04] border border-white/[0.08] text-white/60">
                  <GraduationCap size={13} className="shrink-0 text-white/30" />
                  Образование: {vacancy.requirements.education.required}
                </div>
              )}
            </div>

            <button
              className="btn-primary w-full justify-center mt-2 py-3"
              onClick={() => formRef.current?.scrollIntoView({ behavior: 'smooth' })}
            >
              <ArrowDown size={16} />
              Откликнуться на вакансию
            </button>
          </div>
        </div>

        {/* -- Application flow -- */}
        <div ref={formRef}>
          {!verifiedEmail ? (
            <>
              {/* Show email step indicator */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border bg-orange-500/20 border-orange-500/50 text-orange-400">
                    1
                  </div>
                  <span className="text-sm font-semibold text-white">Подтверждение email</span>
                </div>
                <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden">
                  <div className="h-full w-0 rounded-full bg-gradient-to-r from-orange-600 to-orange-400" />
                </div>
              </div>
              <EmailVerifyStep onVerified={handleVerified} />
            </>
          ) : (
            <>
              {/* Verified badge */}
              <div className="flex items-center gap-3 px-4 py-3.5 rounded-2xl mb-5 bg-emerald-500/[0.08] border border-emerald-500/20">
                <ShieldCheck size={17} className="text-emerald-500 shrink-0" />
                <p className="text-sm font-semibold text-emerald-500">
                  Email подтверждён: <span className="text-emerald-300">{verifiedEmail}</span>
                </p>
              </div>

              {/* Multi-step progress */}
              <StepIndicator current={formStep} total={formTotalSteps} labels={stepLabels} />

              {/* -- Application form card -- */}
              <div className="card p-0 overflow-hidden">
                <div className="px-6 sm:px-8 pt-6 sm:pt-8 pb-5 border-b border-white/[0.06]">
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <PenLine size={18} className="text-orange-400" />
                    {formStep === 1 && 'Личные данные'}
                    {formStep === 2 && 'Профессиональная информация'}
                    {formStep === 3 && 'Дополнительные вопросы'}
                  </h2>
                  <p className="text-xs mt-1 text-white/35">
                    {formStep === 1 && 'Расскажите о себе. Поля со * обязательны.'}
                    {formStep === 2 && 'Расскажите о вашем опыте и навыках.'}
                    {formStep === 3 && 'Ответьте на дополнительные вопросы работодателя.'}
                  </p>
                </div>

                <div className="px-6 sm:px-8 py-6 sm:py-8">
                  {formError && (
                    <div className="flex items-center gap-2.5 p-3.5 rounded-xl text-sm mb-6 bg-red-500/10 border border-red-500/25 text-red-400">
                      <AlertCircle size={15} className="shrink-0" />
                      {formError}
                    </div>
                  )}

                  <form onSubmit={handleSubmit}>
                    {/* ===== STEP 1: Personal Info ===== */}
                    {formStep === 1 && (
                      <div className="space-y-5">
                        {/* Name */}
                        <div>
                          <label className="label flex items-center gap-1.5">
                            <User size={11} className="text-neutral-500" />
                            Полное имя <span className="text-red-400">*</span>
                          </label>
                          <input
                            type="text"
                            placeholder="Иван Иванов"
                            value={form.full_name}
                            onChange={(e) => {
                              setForm((f) => ({ ...f, full_name: e.target.value }));
                              if (fieldErrors.full_name) setFieldErrors((p) => { const n = { ...p }; delete n.full_name; return n; });
                            }}
                            className={`input py-3 px-4 ${fieldErrors.full_name ? 'border-red-500/50' : ''}`}
                            autoFocus
                          />
                          {fieldErrors.full_name && <p className="text-xs text-red-400 mt-1.5">{fieldErrors.full_name}</p>}
                        </div>

                        {/* Email (readonly) */}
                        <div>
                          <label className="label flex items-center gap-1.5">
                            <Mail size={11} className="text-neutral-500" />
                            Email
                          </label>
                          <div className="relative">
                            <input
                              type="email"
                              className="input py-3 px-4 pr-10 opacity-60 cursor-not-allowed"
                              value={verifiedEmail}
                              readOnly
                            />
                            <ShieldCheck
                              size={15}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500"
                            />
                          </div>
                        </div>

                        {/* Phone */}
                        <div>
                          <label className="label flex items-center gap-1.5">
                            <Phone size={11} className="text-neutral-500" />
                            Телефон
                          </label>
                          <input
                            type="tel"
                            placeholder="+998 90 123 45 67"
                            value={form.phone}
                            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                            className="input py-3 px-4"
                          />
                          <p className="text-xs text-white/25 mt-1">Формат: +998 XX XXX XX XX</p>
                        </div>

                        {/* LinkedIn + Portfolio row */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                          <div>
                            <label className="label flex items-center gap-1.5">
                              <LinkIcon size={11} className="text-neutral-500" />
                              LinkedIn
                            </label>
                            <input
                              type="url"
                              placeholder="linkedin.com/in/username"
                              value={form.linkedin_url}
                              onChange={(e) => setForm((f) => ({ ...f, linkedin_url: e.target.value }))}
                              className="input py-3 px-4"
                            />
                          </div>
                          <div>
                            <label className="label flex items-center gap-1.5">
                              <Globe size={11} className="text-neutral-500" />
                              Портфолио
                            </label>
                            <input
                              type="url"
                              placeholder="github.com/username"
                              value={form.portfolio_url}
                              onChange={(e) => setForm((f) => ({ ...f, portfolio_url: e.target.value }))}
                              className="input py-3 px-4"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ===== STEP 2: Professional Info ===== */}
                    {formStep === 2 && (
                      <div className="space-y-5">
                        {/* Experience */}
                        <div>
                          <label className="label flex items-center gap-1.5">
                            <Briefcase size={11} className="text-neutral-500" />
                            Опыт работы
                          </label>
                          <textarea
                            placeholder="Где работали, сколько лет, что делали..."
                            value={form.experience}
                            onChange={(e) => setForm((f) => ({ ...f, experience: e.target.value }))}
                            rows={4}
                            className="input resize-none py-3 px-4"
                          />
                        </div>

                        {/* Skills */}
                        <div>
                          <label className="label flex items-center gap-1.5">
                            <Code size={11} className="text-neutral-500" />
                            Навыки и технологии
                          </label>
                          <textarea
                            placeholder="Python, Django, PostgreSQL, Docker..."
                            value={form.skills}
                            onChange={(e) => setForm((f) => ({ ...f, skills: e.target.value }))}
                            rows={2}
                            className="input resize-none py-3 px-4"
                          />
                        </div>

                        {/* Cover letter */}
                        <div>
                          <label className="label flex items-center gap-1.5">
                            <PenLine size={11} className="text-neutral-500" />
                            Сопроводительное письмо
                          </label>
                          <textarea
                            placeholder="Почему вы хотите работать у нас..."
                            value={form.cover_letter}
                            onChange={(e) => setForm((f) => ({ ...f, cover_letter: e.target.value }))}
                            rows={3}
                            className="input resize-none py-3 px-4"
                          />
                        </div>

                        {/* Resume upload */}
                        <FileUploadArea
                          file={file}
                          onFile={handleFile}
                          onClear={() => setFile(null)}
                          dragOver={dragOver}
                          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                          onDragLeave={() => setDragOver(false)}
                          onDrop={handleDrop}
                        />
                      </div>
                    )}

                    {/* ===== STEP 3: Custom Questions ===== */}
                    {formStep === 3 && hasCustomQuestions && (
                      <div className="space-y-6">
                        {customQuestions.map((q) => {
                          const hasError = questionErrors.has(q.id);
                          return (
                            <div key={q.id} id={`q-${q.id}`}>
                              <label className="label flex items-center gap-1">
                                {q.label}
                                {q.required && <span className="text-red-400">*</span>}
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
                                <p className="text-xs mt-1.5 text-red-400">Обязательное поле</p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* ===== Navigation Buttons ===== */}
                    <div className={`flex gap-3 mt-8 ${formStep > 1 ? 'justify-between' : 'justify-end'}`}>
                      {formStep > 1 && (
                        <button
                          type="button"
                          onClick={goBack}
                          className="btn-secondary justify-center py-3 px-6"
                        >
                          <ArrowLeft size={16} />
                          Назад
                        </button>
                      )}

                      {formStep < formTotalSteps ? (
                        <button
                          type="button"
                          onClick={goNext}
                          className="btn-primary justify-center py-3 px-8 flex-1 sm:flex-none sm:min-w-[180px]"
                        >
                          Далее
                          <ChevronRight size={16} />
                        </button>
                      ) : (
                        <button
                          type="submit"
                          disabled={submitting || !form.full_name.trim()}
                          className="btn-primary justify-center py-3.5 px-8 flex-1 sm:flex-none sm:min-w-[220px] text-base font-bold rounded-[14px]"
                        >
                          {submitting ? (
                            <>
                              <Loader2 size={18} className="animate-spin" />
                              <span>Отправляем заявку...</span>
                            </>
                          ) : (
                            <>
                              <CheckCircle size={18} />
                              <span>Отправить заявку</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </form>
                </div>
              </div>

              {/* Trust signals */}
              <div className="flex items-center justify-center gap-2 mt-6 text-white/20">
                <Lock size={12} />
                <span className="text-xs">Ваши данные защищены и используются только для рассмотрения заявки</span>
              </div>
            </>
          )}

          {/* Footer */}
          <div className="flex items-center justify-center gap-1.5 mt-8 pb-4 text-white/15">
            <span className="text-xs">Powered by</span>
            <span className="text-xs font-semibold text-white/25">Solution AI</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
