import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  ArrowLeftIcon, BrainCircuit, CheckCircle, XCircle, Mail,
  Phone, Linkedin, Globe, Upload, FileText, RefreshCw,
  MessageSquare, Loader2, Copy, ChevronRight, Sparkles,
  Clock, Zap, UserCheck, UserX, Send, X, AlertTriangle,
  CheckCircle2, ShieldCheck, ShieldAlert, ShieldX, Eye, TrendingUp,
} from 'lucide-react';
import Layout from '../components/Layout';
import ScoreRing from '../components/ScoreRing';
import SkillsRadar from '../components/SkillsRadar';
import { candidatesApi } from '../utils/api';
import { Candidate } from '../types';
import { getCategoryColor, getCategoryLabel, getStatusLabel, formatDate } from '../utils/helpers';
import { useRef, useState, useEffect } from 'react';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getAvatarGradient(name: string): [string, string] {
  const palettes: [string, string][] = [
    ['#FF6A00', '#FF9A3C'], ['#7C3AED', '#A78BFA'], ['#0EA5E9', '#38BDF8'],
    ['#10B981', '#34D399'], ['#F59E0B', '#FCD34D'], ['#EF4444', '#F87171'],
    ['#EC4899', '#F472B6'], ['#06B6D4', '#67E8F9'],
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return palettes[Math.abs(hash) % palettes.length];
}

function getScoreColor(score: number) {
  if (score >= 90) return '#10b981';
  if (score >= 75) return '#60a5fa';
  if (score >= 60) return '#FF9A3C';
  return '#f87171';
}

function getScoreBarGradient(score: number) {
  if (score >= 90) return 'linear-gradient(90deg,#10b981,#34d399)';
  if (score >= 75) return 'linear-gradient(90deg,#3b82f6,#60a5fa)';
  if (score >= 60) return 'linear-gradient(90deg,#FF6A00,#FF9A3C)';
  return 'linear-gradient(90deg,#ef4444,#f87171)';
}

// ─── Pipeline stages ──────────────────────────────────────────────────────────

const STAGES: { key: string; label: string; icon: React.ElementType }[] = [
  { key: 'new',       label: 'Получена',        icon: Clock },
  { key: 'analyzing', label: 'AI Анализ',       icon: BrainCircuit },
  { key: 'analyzed',  label: 'Проанализирован', icon: Sparkles },
  { key: 'decision',  label: 'Решение',         icon: UserCheck },
];

function PipelineBar({ status }: { status: string }) {
  const stepIndex =
    status === 'invited' || status === 'rejected' ? 3 :
    status === 'analyzed' ? 2 :
    status === 'analyzing' ? 1 : 0;

  const isInvited = status === 'invited';
  const isRejected = status === 'rejected';

  return (
    <div
      className="card mb-6"
      style={{ padding: '1rem 1.5rem', background: 'linear-gradient(135deg,rgba(255,110,0,0.06) 0%,rgba(255,110,0,0.02) 100%)' }}
    >
      <div className="flex items-center gap-0">
        {STAGES.map((stage, i) => {
          const isActive = i === stepIndex;
          const isDone = i < stepIndex;
          const isLast = i === STAGES.length - 1;
          const Icon = stage.icon;

          let dotColor = 'rgba(255,255,255,0.12)';
          let iconColor = 'rgba(255,255,255,0.2)';
          let labelColor = 'rgba(255,255,255,0.25)';
          let labelContent: string = stage.label;

          if (isDone) {
            dotColor = 'rgba(16,185,129,0.3)';
            iconColor = '#10b981';
            labelColor = '#10b981';
          }
          if (isActive) {
            dotColor = status === 'analyzing'
              ? 'rgba(96,165,250,0.3)' : 'rgba(255,110,0,0.3)';
            iconColor = status === 'analyzing' ? '#60a5fa' : '#FF9A3C';
            labelColor = '#fff';
          }
          if (isLast) {
            if (isInvited) { dotColor='rgba(16,185,129,0.3)'; iconColor='#10b981'; labelColor='#10b981'; labelContent='Приглашён' as string; }
            if (isRejected) { dotColor='rgba(248,113,113,0.3)'; iconColor='#f87171'; labelColor='#f87171'; labelContent='Отклонён' as string; }
          }

          return (
            <div key={stage.key} className="flex items-center flex-1 min-w-0">
              {/* Step */}
              <div className="flex flex-col items-center shrink-0">
                <div
                  className="flex items-center justify-center rounded-full"
                  style={{
                    width: 36, height: 36,
                    background: dotColor,
                    border: `2px solid ${isDone || isActive ? iconColor : 'rgba(255,255,255,0.08)'}`,
                    transition: 'all 0.3s',
                    boxShadow: isActive ? `0 0 16px ${iconColor}55` : undefined,
                  }}
                >
                  {isDone ? (
                    <CheckCircle2 size={16} style={{ color: '#10b981' }} />
                  ) : (
                    <Icon
                      size={15}
                      style={{
                        color: iconColor,
                        animation: isActive && status === 'analyzing' ? 'spin 1.5s linear infinite' : undefined,
                      }}
                    />
                  )}
                </div>
                <span
                  className="text-xs font-semibold mt-1.5 whitespace-nowrap"
                  style={{ color: labelColor, fontSize: '0.6875rem' }}
                >
                  {labelContent}
                </span>
              </div>
              {/* Connector */}
              {!isLast && (
                <div
                  className="flex-1 mx-2 h-0.5 rounded-full"
                  style={{
                    background: isDone
                      ? 'linear-gradient(90deg,rgba(16,185,129,0.5),rgba(16,185,129,0.3))'
                      : 'rgba(255,255,255,0.06)',
                    transition: 'background 0.4s',
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Invite modal ─────────────────────────────────────────────────────────────

function InviteModal({
  candidateName,
  candidateEmail,
  vacancyTitle,
  onConfirm,
  onClose,
}: {
  candidateName: string;
  candidateEmail: string;
  vacancyTitle: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const emailTemplate = `Здравствуйте, ${candidateName}!

Мы рассмотрели вашу заявку на позицию «${vacancyTitle}» и рады сообщить, что вы прошли первичный отбор.

Хотели бы пригласить вас на собеседование. Пожалуйста, ответьте на это письмо, чтобы согласовать удобное время.

С уважением,
Команда найма`;

  const copyEmail = () => {
    navigator.clipboard.writeText(emailTemplate);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: 540 }}>
        {/* Header */}
        <div
          className="flex items-center justify-between px-7 py-5"
          style={{
            borderBottom: '1px solid rgba(16,185,129,0.15)',
            background: 'linear-gradient(135deg,rgba(16,185,129,0.08) 0%,transparent 100%)',
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center rounded-xl"
              style={{ width: 38, height: 38, background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)' }}
            >
              <UserCheck size={18} style={{ color: '#10b981' }} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Пригласить на интервью</h3>
              <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
                {candidateName} · {candidateEmail}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center rounded-xl"
            style={{ width: 34, height: 34, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)' }}
          >
            <X size={15} />
          </button>
        </div>

        <div className="px-7 py-6 space-y-5">
          {/* Email preview */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.35)' }}>
                Шаблон письма
              </p>
              <button
                onClick={copyEmail}
                className="flex items-center gap-1.5 text-xs font-semibold transition-colors"
                style={{ color: copied ? '#10b981' : '#FF9A3C' }}
              >
                {copied ? <><CheckCircle2 size={11} />Скопировано</> : <><Copy size={11} />Копировать</>}
              </button>
            </div>
            <div
              className="rounded-xl p-4 text-sm leading-relaxed whitespace-pre-line"
              style={{
                background: 'rgba(0,0,0,0.3)',
                border: '1px solid rgba(16,185,129,0.15)',
                color: 'rgba(255,255,255,0.65)',
                fontSize: '0.8125rem',
              }}
            >
              {emailTemplate}
            </div>
          </div>

          {/* Send to */}
          <div
            className="flex items-center gap-3 p-3 rounded-xl"
            style={{ background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.18)' }}
          >
            <Mail size={15} style={{ color: '#10b981' }} />
            <div>
              <p className="text-xs font-semibold" style={{ color: '#34d399' }}>Отправить на: {candidateEmail}</p>
              <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
                Статус кандидата изменится на «Приглашён»
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <button className="btn-secondary flex-1 justify-center" onClick={onClose}>Отмена</button>
            <button
              className="btn-primary flex-1 justify-center"
              onClick={onConfirm}
              style={{ background: 'linear-gradient(135deg,#059669 0%,#10b981 100%)', boxShadow: '0 4px 16px rgba(16,185,129,0.35)' }}
            >
              <Send size={14} />
              Пригласить
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Reject modal ─────────────────────────────────────────────────────────────

const REJECT_REASONS = [
  'Недостаточный опыт',
  'Навыки не соответствуют требованиям',
  'Зарплатные ожидания не совпадают',
  'Позиция уже закрыта',
  'Выбран другой кандидат',
  'Не прошёл техническое интервью',
];

function RejectModal({
  candidateName,
  onConfirm,
  onClose,
}: {
  candidateName: string;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState('');
  const [custom, setCustom] = useState('');

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: 480 }}>
        <div
          className="flex items-center justify-between px-7 py-5"
          style={{
            borderBottom: '1px solid rgba(239,68,68,0.15)',
            background: 'linear-gradient(135deg,rgba(239,68,68,0.07) 0%,transparent 100%)',
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center rounded-xl"
              style={{ width: 38, height: 38, background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.22)' }}
            >
              <UserX size={18} style={{ color: '#f87171' }} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Отклонить кандидата</h3>
              <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>{candidateName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center rounded-xl"
            style={{ width: 34, height: 34, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)' }}
          >
            <X size={15} />
          </button>
        </div>

        <div className="px-7 py-6 space-y-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'rgba(255,255,255,0.35)' }}>
              Причина отказа
            </p>
            <div className="space-y-2">
              {REJECT_REASONS.map((r) => (
                <button
                  key={r}
                  className="w-full text-left text-sm px-3 py-2.5 rounded-xl transition-all"
                  style={{
                    background: reason === r ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${reason === r ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.06)'}`,
                    color: reason === r ? '#f87171' : 'rgba(255,255,255,0.6)',
                  }}
                  onClick={() => { setReason(r); setCustom(''); }}
                >
                  <div className="flex items-center gap-2">
                    <div
                      style={{
                        width: 14, height: 14, borderRadius: '50%',
                        border: `2px solid ${reason === r ? '#f87171' : 'rgba(255,255,255,0.2)'}`,
                        background: reason === r ? '#f87171' : 'transparent',
                        flexShrink: 0,
                      }}
                    />
                    {r}
                  </div>
                </button>
              ))}
            </div>
            <input
              className="input mt-2 text-sm"
              placeholder="Или введите свою причину..."
              value={custom}
              onChange={(e) => { setCustom(e.target.value); setReason(''); }}
            />
          </div>

          <div
            className="flex items-start gap-2.5 p-3 rounded-xl"
            style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.18)' }}
          >
            <AlertTriangle size={14} style={{ color: '#fbbf24', flexShrink: 0, marginTop: 1 }} />
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>
              Статус изменится на «Отклонён». Это можно будет изменить позже из карточки кандидата.
            </p>
          </div>

          <div className="flex gap-3">
            <button className="btn-secondary flex-1 justify-center" onClick={onClose}>Отмена</button>
            <button
              className="btn-danger flex-1 justify-center"
              onClick={() => onConfirm(custom || reason)}
            >
              <XCircle size={14} />
              Отклонить
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Interview questions ──────────────────────────────────────────────────────

interface InterviewQs { technical: string[]; behavioral: string[]; situational: string[] }

function InterviewQuestionsSection({ candidateId }: { candidateId: string }) {
  const [questions, setQuestions] = useState<InterviewQs | null>(null);
  const [generating, setGenerating] = useState(false);

  const generate = async () => {
    setGenerating(true);
    try {
      const res = await candidatesApi.generateInterviewQuestions(candidateId);
      setQuestions(res.data.questions as InterviewQs);
    } catch {
      toast.error('Ошибка генерации вопросов');
    } finally {
      setGenerating(false);
    }
  };

  const copyAll = () => {
    if (!questions) return;
    const text = [
      'ТЕХНИЧЕСКИЕ ВОПРОСЫ:', ...questions.technical.map((q, i) => `${i + 1}. ${q}`), '',
      'ПОВЕДЕНЧЕСКИЕ ВОПРОСЫ:', ...questions.behavioral.map((q, i) => `${i + 1}. ${q}`), '',
      'СИТУАЦИОННЫЕ ВОПРОСЫ:', ...questions.situational.map((q, i) => `${i + 1}. ${q}`),
    ].join('\n');
    navigator.clipboard.writeText(text);
    toast.success('Вопросы скопированы!');
  };

  const sections: { label: string; key: keyof InterviewQs; color: string; bg: string; border: string }[] = [
    { label: 'Технические', key: 'technical', color: '#FF9A3C', bg: 'rgba(255,110,0,0.06)', border: 'rgba(255,110,0,0.4)' },
    { label: 'Поведенческие', key: 'behavioral', color: '#60a5fa', bg: 'rgba(59,130,246,0.06)', border: 'rgba(59,130,246,0.4)' },
    { label: 'Ситуационные', key: 'situational', color: '#34d399', bg: 'rgba(16,185,129,0.06)', border: 'rgba(16,185,129,0.4)' },
  ];

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div
            style={{ width: 32, height: 32, background: 'rgba(255,110,0,0.10)', border: '1px solid rgba(255,110,0,0.20)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <MessageSquare size={16} style={{ color: '#FF9A3C' }} />
          </div>
          <h3 className="font-bold text-white">AI-вопросы для интервью</h3>
        </div>
        {generating ? (
          <span className="flex items-center gap-2 text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
            <Loader2 size={14} className="animate-spin" />Claude думает...
          </span>
        ) : (
          <button
            className={questions ? 'btn-secondary' : 'btn-primary'}
            style={{ fontSize: '0.8rem', padding: '6px 14px' }}
            onClick={generate}
          >
            {questions ? <><RefreshCw size={13} />Заново</> : <><MessageSquare size={13} />Сгенерировать</>}
          </button>
        )}
      </div>

      {!questions && !generating && (
        <p className="text-sm text-center py-6" style={{ color: 'rgba(255,255,255,0.3)' }}>
          Claude сгенерирует персонализированные вопросы на основе профиля кандидата
        </p>
      )}

      {generating && (
        <div className="py-8 text-center">
          <Loader2 size={28} className="animate-spin mx-auto mb-3" style={{ color: '#FF9A3C' }} />
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>Claude анализирует кандидата...</p>
        </div>
      )}

      {questions && (
        <>
          <div className="space-y-5">
            {sections.map(({ label, key, color, bg, border }) => (
              <div key={key}>
                <p className="text-xs font-bold mb-2.5 uppercase tracking-widest" style={{ color }}>{label}</p>
                <div className="space-y-2">
                  {questions[key].map((q, i) => (
                    <div key={i} className="flex gap-3 text-sm rounded-xl p-3" style={{ background: bg, borderLeft: `3px solid ${border}` }}>
                      <span className="shrink-0 font-black text-xs mt-0.5" style={{ color }}>{i + 1}.</span>
                      <span style={{ color: 'rgba(255,255,255,0.78)' }}>{q}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-3 mt-5 pt-4" style={{ borderTop: '1px solid rgba(255,110,0,0.08)' }}>
            <button className="btn-secondary text-sm" onClick={copyAll}>
              <Copy size={13} />Копировать всё
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Integrity Card ───────────────────────────────────────────────────────────

interface IntegrityProps {
  integrity: {
    score: number;
    level: 'trusted' | 'questionable' | 'suspicious';
    flags: string[];
    verdict: string;
  };
}

function IntegrityCard({ integrity }: IntegrityProps) {
  const cfg = {
    trusted:      { icon: ShieldCheck,  color: '#10b981', bg: 'rgba(16,185,129,0.08)',  border: 'rgba(16,185,129,0.22)',  label: 'Достоверно' },
    questionable: { icon: ShieldAlert,  color: '#fbbf24', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.22)', label: 'Под вопросом' },
    suspicious:   { icon: ShieldX,      color: '#f87171', bg: 'rgba(239,68,68,0.08)',  border: 'rgba(239,68,68,0.22)',  label: 'Подозрительно' },
  }[integrity.level];
  const Icon = cfg.icon;

  return (
    <div className="card" style={{ background: cfg.bg, borderColor: cfg.border }}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div
            style={{ width: 32, height: 32, background: `${cfg.color}22`, border: `1px solid ${cfg.color}44`, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <Icon size={16} style={{ color: cfg.color }} />
          </div>
          <h3 className="font-bold text-white">Достоверность анкеты</h3>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-2xl font-black" style={{ color: cfg.color }}>{integrity.score}</span>
          <span
            className="text-xs font-bold px-2.5 py-1 rounded-lg"
            style={{ background: `${cfg.color}18`, color: cfg.color, border: `1px solid ${cfg.color}30` }}
          >
            {cfg.label}
          </span>
        </div>
      </div>

      {/* Score bar */}
      <div className="score-bar-track mb-4">
        <div
          className="score-bar-fill"
          style={{
            width: `${integrity.score}%`,
            background: integrity.level === 'trusted'
              ? 'linear-gradient(90deg,#10b981,#34d399)'
              : integrity.level === 'questionable'
              ? 'linear-gradient(90deg,#d97706,#fbbf24)'
              : 'linear-gradient(90deg,#dc2626,#f87171)',
          }}
        />
      </div>

      <p className="text-sm leading-relaxed mb-4" style={{ color: 'rgba(255,255,255,0.65)' }}>
        {integrity.verdict}
      </p>

      {integrity.flags.length > 0 && (
        <div>
          <p className="text-xs font-bold mb-2 uppercase tracking-wider" style={{ color: cfg.color }}>
            Замечания AI
          </p>
          <div className="space-y-1.5">
            {integrity.flags.map((flag, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                <AlertTriangle size={13} className="shrink-0 mt-0.5" style={{ color: cfg.color }} />
                <span style={{ color: 'rgba(255,255,255,0.6)' }}>{flag}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Independent Assessment Card ──────────────────────────────────────────────

interface IndependentAssessmentProps {
  assessment: {
    hidden_strengths: string[];
    hidden_concerns: string[];
    beyond_criteria_notes: string;
    hire_recommendation: 'strong_yes' | 'yes' | 'neutral' | 'no' | 'strong_no';
  };
}

function IndependentAssessmentCard({ assessment }: IndependentAssessmentProps) {
  const recCfg = {
    strong_yes: { label: 'Однозначно нанять',  color: '#10b981', bg: 'rgba(16,185,129,0.12)',  border: 'rgba(16,185,129,0.3)' },
    yes:        { label: 'Рекомендую',          color: '#34d399', bg: 'rgba(16,185,129,0.08)',  border: 'rgba(16,185,129,0.2)' },
    neutral:    { label: 'Нужно уточнить',      color: '#fbbf24', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)' },
    no:         { label: 'Не рекомендую',       color: '#f87171', bg: 'rgba(239,68,68,0.08)',  border: 'rgba(239,68,68,0.2)' },
    strong_no:  { label: 'Однозначно нет',      color: '#dc2626', bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.3)' },
  }[assessment.hire_recommendation];

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div
            style={{ width: 32, height: 32, background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.25)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <Eye size={16} style={{ color: '#a78bfa' }} />
          </div>
          <h3 className="font-bold text-white">Независимая оценка AI</h3>
        </div>
        <span
          className="text-xs font-bold px-3 py-1.5 rounded-lg"
          style={{ background: recCfg.bg, color: recCfg.color, border: `1px solid ${recCfg.border}` }}
        >
          {recCfg.label}
        </span>
      </div>

      <p className="text-sm leading-relaxed mb-5" style={{ color: 'rgba(255,255,255,0.65)', borderLeft: '2px solid rgba(139,92,246,0.4)', paddingLeft: '0.75rem' }}>
        {assessment.beyond_criteria_notes}
      </p>

      <div className="grid grid-cols-2 gap-4">
        {assessment.hidden_strengths.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <TrendingUp size={12} style={{ color: '#10b981' }} />
              <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#10b981' }}>AI заметил плюсы</p>
            </div>
            <div className="space-y-1.5">
              {assessment.hidden_strengths.map((s, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <CheckCircle2 size={12} className="shrink-0 mt-0.5" style={{ color: '#10b981' }} />
                  <span style={{ color: 'rgba(255,255,255,0.6)' }}>{s}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {assessment.hidden_concerns.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <AlertTriangle size={12} style={{ color: '#fbbf24' }} />
              <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#fbbf24' }}>AI заметил риски</p>
            </div>
            <div className="space-y-1.5">
              {assessment.hidden_concerns.map((c, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <XCircle size={12} className="shrink-0 mt-0.5" style={{ color: '#fbbf24' }} />
                  <span style={{ color: 'rgba(255,255,255,0.6)' }}>{c}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Score labels ─────────────────────────────────────────────────────────────

const SCORE_LABELS: Record<string, string> = {
  hard_skills: 'Hard Skills',
  experience: 'Опыт',
  education: 'Образование',
  soft_skills: 'Soft Skills',
  languages: 'Языки',
  culture_fit: 'Культура',
};

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CandidatePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [showReject, setShowReject] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['candidate', id],
    queryFn: () =>
      candidatesApi.get(id!).then((r) => {
        const c = r.data.candidate;
        // Safety normalize in case backend returns array (Supabase join)
        return {
          ...c,
          vacancies: Array.isArray(c.vacancies) ? c.vacancies[0] : c.vacancies,
          ai_analysis: Array.isArray(c.ai_analysis) ? (c.ai_analysis[0] ?? null) : c.ai_analysis,
        } as Candidate & { vacancies?: { title: string; id: string } };
      }),
  });

  const analyzeMutation = useMutation({
    mutationFn: () => candidatesApi.analyze(id!),
    onSuccess: () => { toast.success('Анализ завершён!'); refetch(); },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg || 'Ошибка анализа');
    },
  });

  const statusMutation = useMutation({
    mutationFn: (status: string) => candidatesApi.updateStatus(id!, status),
    onSuccess: (_, status) => {
      toast.success(status === 'invited' ? '🎉 Кандидат приглашён!' : 'Статус обновлён');
      refetch();
    },
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => candidatesApi.uploadResume(id!, file),
    onSuccess: () => { toast.success('Резюме загружено'); refetch(); },
    onError: () => toast.error('Ошибка загрузки'),
  });

  // Auto-poll while analyzing
  useEffect(() => {
    if (data?.status === 'analyzing') {
      const timer = setInterval(refetch, 3000);
      return () => clearInterval(timer);
    }
  }, [data?.status, refetch]);

  if (isLoading) {
    return (
      <Layout>
        <div className="p-8 space-y-5">
          <div className="skeleton h-12 rounded-2xl w-1/2" />
          <div className="skeleton h-20 rounded-2xl" />
          <div className="grid grid-cols-3 gap-6">
            <div className="skeleton h-80 rounded-2xl" />
            <div className="col-span-2 skeleton h-80 rounded-2xl" />
          </div>
        </div>
      </Layout>
    );
  }

  if (isError || !data) {
    return (
      <Layout>
        <div className="p-8 flex flex-col items-center justify-center" style={{ minHeight: '60vh' }}>
          <div
            className="flex items-center justify-center rounded-2xl mb-4"
            style={{ width: 64, height: 64, background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.22)' }}
          >
            <XCircle size={28} style={{ color: '#f87171' }} />
          </div>
          <h2 className="text-xl font-black text-white mb-2">Кандидат не найден</h2>
          <p className="text-sm mb-5" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Возможно, вакансия была удалена или у вас нет доступа
          </p>
          <button className="btn-secondary" onClick={() => navigate('/vacancies')}>
            <ArrowLeftIcon size={15} />
            Вернуться к вакансиям
          </button>
        </div>
      </Layout>
    );
  }

  const candidate = data;
  const analysis = candidate?.ai_analysis;
  const vacancy = Array.isArray(candidate?.vacancies) ? candidate.vacancies[0] : candidate?.vacancies;
  const [g1, g2] = getAvatarGradient(candidate?.full_name || '?');
  const initials = (candidate?.full_name || '?').split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
  const isAnalyzing = candidate?.status === 'analyzing' || analyzeMutation.isPending;
  const canDecide = analysis && candidate?.status !== 'invited' && candidate?.status !== 'rejected';

  const handleInviteConfirm = () => {
    statusMutation.mutate('invited');
    setShowInvite(false);
  };

  const handleRejectConfirm = () => {
    statusMutation.mutate('rejected');
    setShowReject(false);
  };

  return (
    <Layout>
      <div className="p-6 md:p-8 max-w-6xl page-content">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mb-6 text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>
          <button
            onClick={() => navigate('/vacancies')}
            className="transition-colors hover:text-white"
          >
            Вакансии
          </button>
          {vacancy && (
            <>
              <ChevronRight size={13} style={{ color: 'rgba(255,255,255,0.2)' }} />
              <button
                onClick={() => navigate(`/vacancies/${vacancy.id}`)}
                className="transition-colors hover:text-white"
              >
                {vacancy.title}
              </button>
            </>
          )}
          <ChevronRight size={13} style={{ color: 'rgba(255,255,255,0.2)' }} />
          <span className="text-white font-semibold">{candidate?.full_name}</span>
        </div>

        {/* Pipeline stages */}
        <PipelineBar status={candidate?.status || 'new'} />

        {/* Header */}
        <div className="flex items-start gap-4 mb-6">
          {/* Back */}
          <button
            onClick={() => navigate(vacancy ? `/vacancies/${vacancy.id}` : '/vacancies')}
            className="flex items-center justify-center rounded-xl transition-all shrink-0 mt-1"
            style={{ width: 40, height: 40, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,110,0,0.12)', color: 'rgba(255,255,255,0.5)' }}
            onMouseEnter={(e) => { e.currentTarget.style.background='rgba(255,110,0,0.10)'; e.currentTarget.style.color='#FF9A3C'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background='rgba(255,255,255,0.04)'; e.currentTarget.style.color='rgba(255,255,255,0.5)'; }}
          >
            <ArrowLeftIcon size={18} />
          </button>

          {/* Avatar + name */}
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <div
              className="avatar-circle shrink-0"
              style={{
                width: 56, height: 56,
                background: `linear-gradient(135deg,${g1},${g2})`,
                fontSize: '1.25rem',
                boxShadow: `0 6px 20px ${g1}55`,
              }}
            >
              {initials}
            </div>
            <div className="min-w-0">
              <h2 className="text-2xl font-black text-white truncate">{candidate?.full_name}</h2>
              <div className="flex items-center gap-2 flex-wrap mt-1">
                {vacancy && (
                  <span
                    className="text-xs px-2.5 py-1 rounded-lg font-semibold"
                    style={{ background: 'rgba(255,110,0,0.12)', border: '1px solid rgba(255,110,0,0.22)', color: '#FF9A3C' }}
                  >
                    {vacancy.title}
                  </span>
                )}
                <span
                  className="text-xs px-2.5 py-1 rounded-full font-bold"
                  style={{
                    background:
                      candidate?.status === 'invited' ? 'rgba(16,185,129,0.12)' :
                      candidate?.status === 'rejected' ? 'rgba(239,68,68,0.12)' :
                      'rgba(255,255,255,0.08)',
                    color:
                      candidate?.status === 'invited' ? '#10b981' :
                      candidate?.status === 'rejected' ? '#f87171' :
                      'rgba(255,255,255,0.5)',
                  }}
                >
                  {getStatusLabel(candidate?.status || '')}
                </span>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            {!analysis && !isAnalyzing && (
              <button
                className="btn-primary"
                onClick={() => analyzeMutation.mutate()}
                disabled={analyzeMutation.isPending}
              >
                <BrainCircuit size={16} />
                Запустить анализ
              </button>
            )}
            {isAnalyzing && (
              <div
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm"
                style={{ background: 'rgba(59,130,246,0.10)', border: '1px solid rgba(59,130,246,0.22)', color: '#60a5fa' }}
              >
                <Loader2 size={14} className="animate-spin" />
                Анализирую...
              </div>
            )}
            {canDecide && (
              <>
                <button
                  className="btn-primary"
                  style={{ background: 'linear-gradient(135deg,#059669 0%,#10b981 100%)', boxShadow: '0 4px 16px rgba(16,185,129,0.35)' }}
                  onClick={() => setShowInvite(true)}
                  disabled={statusMutation.isPending}
                >
                  <UserCheck size={16} />
                  Пригласить
                </button>
                <button
                  className="btn-danger"
                  onClick={() => setShowReject(true)}
                  disabled={statusMutation.isPending}
                >
                  <UserX size={16} />
                  Отклонить
                </button>
              </>
            )}
            {analysis && (
              <button
                className="btn-secondary"
                onClick={() => analyzeMutation.mutate()}
                disabled={analyzeMutation.isPending}
              >
                <RefreshCw size={15} />
              </button>
            )}
          </div>
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left column */}
          <div className="space-y-5">

            {/* Score card (if analyzed) */}
            {analysis && (
              <div className="card text-center" style={{ padding: '1.5rem' }}>
                <div className="flex justify-center mb-3">
                  <ScoreRing score={analysis.overall_score} category={analysis.category} size="lg" />
                </div>
                <p className={`text-lg font-black ${getCategoryColor(analysis.category)}`}>
                  {getCategoryLabel(analysis.category)}
                </p>
                <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  Проанализирован {formatDate(analysis.analyzed_at)}
                </p>
              </div>
            )}

            {/* Contacts */}
            <div className="card">
              <h3 className="font-bold text-white mb-4">Контакты</h3>
              <div className="space-y-3">
                {[
                  { icon: Mail, value: candidate?.email, href: candidate?.email ? `mailto:${candidate.email}` : undefined, color: '#FF9A3C', bg: 'rgba(255,110,0,0.08)', border: 'rgba(255,110,0,0.15)' },
                  { icon: Phone, value: candidate?.phone, color: '#FF9A3C', bg: 'rgba(255,110,0,0.08)', border: 'rgba(255,110,0,0.15)' },
                  { icon: Linkedin, value: candidate?.linkedin_url ? 'LinkedIn профиль' : null, href: candidate?.linkedin_url, color: '#60a5fa', bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.15)' },
                  { icon: Globe, value: candidate?.portfolio_url ? 'Portfolio' : null, href: candidate?.portfolio_url, color: '#60a5fa', bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.15)' },
                ].filter((c) => c.value).map(({ icon: Icon, value, href, color, bg, border }) => (
                  <div key={value} className="flex items-center gap-3 text-sm">
                    <div
                      className="shrink-0 flex items-center justify-center rounded-lg"
                      style={{ width: 30, height: 30, background: bg, border: `1px solid ${border}` }}
                    >
                      <Icon size={14} style={{ color }} />
                    </div>
                    {href ? (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="truncate transition-colors"
                        style={{ color: 'rgba(255,255,255,0.65)' }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = color)}
                        onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.65)')}
                      >
                        {value}
                      </a>
                    ) : (
                      <span className="truncate" style={{ color: 'rgba(255,255,255,0.65)' }}>{value}</span>
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-4 pt-4 space-y-1.5" style={{ borderTop: '1px solid rgba(255,110,0,0.08)' }}>
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  Подан: <span className="text-white font-medium">{formatDate(candidate?.submitted_at || '')}</span>
                </p>
              </div>
            </div>

            {/* Resume */}
            <div className="card">
              <h3 className="font-bold text-white mb-3">Резюме</h3>
              {candidate?.resume_text ? (
                <div className="mb-3">
                  <p className="text-xs mb-2 flex items-center gap-1" style={{ color: '#10b981' }}>
                    <FileText size={12} />
                    Загружено ({candidate.resume_text.length} симв.)
                  </p>
                  <p className="text-xs leading-relaxed line-clamp-4" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    {candidate.resume_text.slice(0, 280)}…
                  </p>
                </div>
              ) : (
                <p className="text-sm mb-3" style={{ color: 'rgba(255,255,255,0.3)' }}>Резюме не загружено</p>
              )}
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.docx,.doc"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadMutation.mutate(f); }}
              />
              <button
                className="btn-secondary w-full justify-center text-sm"
                onClick={() => fileRef.current?.click()}
                disabled={uploadMutation.isPending}
              >
                <Upload size={14} />
                {uploadMutation.isPending ? 'Загрузка...' : 'Загрузить PDF/DOCX'}
              </button>
            </div>

            {/* Quick decision (if analyzed + undecided) */}
            {canDecide && (
              <div
                className="card"
                style={{ padding: '1.25rem', background: 'linear-gradient(135deg,rgba(255,110,0,0.08) 0%,rgba(255,110,0,0.03) 100%)' }}
              >
                <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  Принять решение
                </p>
                <div className="space-y-2">
                  <button
                    className="btn-primary w-full justify-center"
                    style={{ background: 'linear-gradient(135deg,#059669 0%,#10b981 100%)', boxShadow: '0 4px 12px rgba(16,185,129,0.3)' }}
                    onClick={() => setShowInvite(true)}
                  >
                    <UserCheck size={15} />
                    Пригласить на интервью
                  </button>
                  <button
                    className="btn-danger w-full justify-center"
                    onClick={() => setShowReject(true)}
                  >
                    <UserX size={15} />
                    Отклонить
                  </button>
                </div>
              </div>
            )}

            {/* Final decision badge */}
            {(candidate?.status === 'invited' || candidate?.status === 'rejected') && (
              <div
                className="card text-center"
                style={{
                  padding: '1.25rem',
                  background: candidate?.status === 'invited'
                    ? 'rgba(16,185,129,0.08)'
                    : 'rgba(239,68,68,0.08)',
                  border: `1px solid ${candidate?.status === 'invited' ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.22)'}`,
                }}
              >
                <div
                  className="inline-flex items-center justify-center rounded-full mb-2"
                  style={{
                    width: 44, height: 44,
                    background: candidate?.status === 'invited' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.12)',
                  }}
                >
                  {candidate?.status === 'invited'
                    ? <CheckCircle size={22} style={{ color: '#10b981' }} />
                    : <XCircle size={22} style={{ color: '#f87171' }} />}
                </div>
                <p className="font-bold text-sm" style={{ color: candidate?.status === 'invited' ? '#10b981' : '#f87171' }}>
                  {candidate?.status === 'invited' ? 'Приглашён на интервью' : 'Кандидат отклонён'}
                </p>
                <button
                  className="mt-3 text-xs font-semibold transition-colors"
                  style={{ color: 'rgba(255,255,255,0.3)' }}
                  onClick={() => statusMutation.mutate(candidate?.status === 'invited' ? 'analyzed' : 'analyzed')}
                  onMouseEnter={(e) => (e.currentTarget.style.color = '#FF9A3C')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.3)')}
                >
                  Отменить решение
                </button>
              </div>
            )}
          </div>

          {/* Right column */}
          <div className="lg:col-span-2 space-y-5">
            {isAnalyzing ? (
              /* Analyzing state */
              <div className="card text-center py-16">
                <div className="relative inline-block mb-5">
                  <div
                    style={{
                      width: 80, height: 80, borderRadius: '50%',
                      border: '3px solid rgba(96,165,250,0.2)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <BrainCircuit size={34} style={{ color: '#60a5fa', animation: 'float 2s ease-in-out infinite' }} />
                  </div>
                  <div
                    style={{
                      position: 'absolute', inset: -4,
                      border: '2px dashed rgba(96,165,250,0.3)',
                      borderRadius: '50%',
                      animation: 'heroRotate 4s linear infinite',
                    }}
                  />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Claude анализирует кандидата</h3>
                <p className="text-sm max-w-sm mx-auto" style={{ color: 'rgba(255,255,255,0.4)', lineHeight: 1.7 }}>
                  AI изучает резюме, опыт и соответствие требованиям вакансии. Обычно занимает 30–60 секунд.
                </p>
                <div
                  className="flex items-center justify-center gap-2 mt-4 text-sm"
                  style={{ color: '#60a5fa' }}
                >
                  <Loader2 size={14} className="animate-spin" />
                  Обновление автоматически...
                </div>
              </div>
            ) : analysis ? (
              <>
                {/* Scores breakdown */}
                <div className="card">
                  <h3 className="font-bold text-white mb-5">Оценки по критериям</h3>

                  {/* Score bars */}
                  <div className="space-y-3 mb-6">
                    {Object.entries(analysis.scores ?? {}).map(([key, value]) => (
                      <div key={key}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.55)' }}>
                            {SCORE_LABELS[key] || key}
                          </span>
                          <span className="text-sm font-black" style={{ color: getScoreColor(value) }}>
                            {value}%
                          </span>
                        </div>
                        <div className="score-bar-track">
                          <div
                            className="score-bar-fill"
                            style={{
                              width: `${value}%`,
                              background: getScoreBarGradient(value),
                              ['--score-width' as string]: `${value}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Radar */}
                  <SkillsRadar scores={analysis.scores} />
                </div>

                {/* Summary */}
                <div className="card">
                  <div className="flex items-center gap-2.5 mb-3">
                    <Sparkles size={16} style={{ color: '#FF9A3C' }} />
                    <h3 className="font-bold text-white">Резюме AI</h3>
                  </div>
                  <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.7)' }}>
                    {analysis.summary}
                  </p>
                </div>

                {/* Strengths / Weaknesses */}
                <div className="grid grid-cols-2 gap-5">
                  <div className="card">
                    <h3 className="font-bold mb-3" style={{ color: '#10b981' }}>Сильные стороны</h3>
                    <ul className="space-y-2.5">
                      {analysis.strengths.map((s, i) => (
                        <li key={i} className="flex items-start gap-2.5 text-sm">
                          <CheckCircle size={14} className="shrink-0 mt-0.5" style={{ color: '#10b981' }} />
                          <span style={{ color: 'rgba(255,255,255,0.7)' }}>{s}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="card">
                    <h3 className="font-bold mb-3" style={{ color: '#f87171' }}>Слабые стороны</h3>
                    <ul className="space-y-2.5">
                      {analysis.weaknesses.map((w, i) => (
                        <li key={i} className="flex items-start gap-2.5 text-sm">
                          <XCircle size={14} className="shrink-0 mt-0.5" style={{ color: '#f87171' }} />
                          <span style={{ color: 'rgba(255,255,255,0.7)' }}>{w}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Recommendations */}
                <div className="card">
                  <h3 className="font-bold text-white mb-4">Рекомендации для интервью</h3>
                  <ul className="space-y-3">
                    {analysis.recommendations.map((r, i) => (
                      <li key={i} className="flex items-start gap-3 text-sm">
                        <span
                          className="shrink-0 flex items-center justify-center text-xs font-black mt-0.5"
                          style={{ width: 24, height: 24, background: 'rgba(255,110,0,0.15)', border: '1px solid rgba(255,110,0,0.25)', borderRadius: 8, color: '#FF9A3C' }}
                        >
                          {i + 1}
                        </span>
                        <span style={{ color: 'rgba(255,255,255,0.7)' }}>{r}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* AI Insights */}
                {analysis.ai_insights && (
                  <div className="card">
                    <h3 className="font-bold text-white mb-4">AI Инсайты</h3>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      {analysis.ai_insights.green_flags?.length > 0 && (
                        <div>
                          <p className="text-xs font-bold mb-2 uppercase tracking-wider" style={{ color: '#10b981' }}>Green Flags</p>
                          <div className="flex flex-wrap gap-1.5">
                            {analysis.ai_insights.green_flags.map((f, i) => (
                              <span key={i} className="text-xs px-2.5 py-1 rounded-lg font-medium" style={{ background: 'rgba(16,185,129,0.10)', color: '#6ee7b7', border: '1px solid rgba(16,185,129,0.20)' }}>
                                {f}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {analysis.ai_insights.potential_concerns?.length > 0 && (
                        <div>
                          <p className="text-xs font-bold mb-2 uppercase tracking-wider" style={{ color: '#fbbf24' }}>Риски</p>
                          <div className="flex flex-wrap gap-1.5">
                            {analysis.ai_insights.potential_concerns.map((c, i) => (
                              <span key={i} className="text-xs px-2.5 py-1 rounded-lg font-medium" style={{ background: 'rgba(245,158,11,0.10)', color: '#fcd34d', border: '1px solid rgba(245,158,11,0.20)' }}>
                                {c}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    {analysis.ai_insights.growth_potential && (
                      <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,110,0,0.08)' }}>
                        <span className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>Потенциал роста:</span>
                        <span className="font-bold text-sm" style={{ color: analysis.ai_insights.growth_potential === 'high' ? '#10b981' : analysis.ai_insights.growth_potential === 'medium' ? '#fbbf24' : '#f87171' }}>
                          {analysis.ai_insights.growth_potential === 'high' ? 'Высокий' : analysis.ai_insights.growth_potential === 'medium' ? 'Средний' : 'Низкий'}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Integrity Card */}
                {analysis.integrity && (
                  <IntegrityCard integrity={analysis.integrity} />
                )}

                {/* Independent Assessment Card */}
                {analysis.independent_assessment && (
                  <IndependentAssessmentCard assessment={analysis.independent_assessment} />
                )}

                {/* Interview questions */}
                <InterviewQuestionsSection candidateId={id!} />
              </>
            ) : (
              <>
                {/* Form responses */}
                {candidate?.form_responses && Object.keys(candidate.form_responses).length > 0 && (
                  <div className="card">
                    <h3 className="font-bold text-white mb-4">Ответы из формы</h3>
                    <div className="space-y-4">
                      {Object.entries(candidate.form_responses).map(([key, value]) => (
                        <div key={key}>
                          <p className="text-xs font-bold mb-1.5 uppercase tracking-wider" style={{ color: 'rgba(255,110,0,0.6)' }}>{key}</p>
                          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>
                            {Array.isArray(value) ? value.join(', ') : String(value)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Run analysis CTA */}
                <div
                  className="card text-center py-14"
                  style={{
                    background: 'linear-gradient(135deg,rgba(255,110,0,0.07) 0%,rgba(255,110,0,0.03) 100%)',
                    borderStyle: 'dashed',
                    borderColor: 'rgba(255,110,0,0.2)',
                  }}
                >
                  <div
                    className="relative inline-block mb-5"
                  >
                    <div
                      className="flex items-center justify-center"
                      style={{
                        width: 80, height: 80, borderRadius: '50%',
                        background: 'rgba(255,110,0,0.08)',
                        border: '2px solid rgba(255,110,0,0.18)',
                        animation: 'float 3s ease-in-out infinite',
                      }}
                    >
                      <BrainCircuit size={34} style={{ color: '#FF9A3C' }} />
                    </div>
                    <div
                      style={{
                        position: 'absolute', inset: -6,
                        border: '1px dashed rgba(255,110,0,0.2)',
                        borderRadius: '50%',
                        animation: 'heroRotate 8s linear infinite',
                      }}
                    />
                  </div>

                  <h3 className="text-xl font-black text-white mb-2">Запустить AI-анализ</h3>
                  <p className="text-sm mb-2 max-w-sm mx-auto" style={{ color: 'rgba(255,255,255,0.4)', lineHeight: 1.7 }}>
                    Claude проанализирует профиль кандидата, оценит его по 6 критериям и даст рекомендации для интервью
                  </p>

                  {/* What you get */}
                  <div className="flex flex-wrap justify-center gap-2 mb-6">
                    {['Оценка 0–100%', 'Hard/Soft Skills', 'Сильные стороны', 'Риски', 'Вопросы для интервью'].map((item) => (
                      <span
                        key={item}
                        className="text-xs px-2.5 py-1 rounded-lg"
                        style={{ background: 'rgba(255,110,0,0.10)', border: '1px solid rgba(255,110,0,0.18)', color: 'rgba(255,154,60,0.8)' }}
                      >
                        {item}
                      </span>
                    ))}
                  </div>

                  <button
                    className="btn-primary"
                    style={{ padding: '12px 28px', fontSize: '0.9375rem', boxShadow: '0 8px 32px rgba(255,106,0,0.45)' }}
                    onClick={() => analyzeMutation.mutate()}
                    disabled={analyzeMutation.isPending}
                  >
                    <Zap size={16} />
                    {analyzeMutation.isPending ? 'Запуск...' : 'Анализировать с AI'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      {showInvite && (
        <InviteModal
          candidateName={candidate?.full_name || ''}
          candidateEmail={candidate?.email || ''}
          vacancyTitle={vacancy?.title || ''}
          onConfirm={handleInviteConfirm}
          onClose={() => setShowInvite(false)}
        />
      )}
      {showReject && (
        <RejectModal
          candidateName={candidate?.full_name || ''}
          onConfirm={handleRejectConfirm}
          onClose={() => setShowReject(false)}
        />
      )}
    </Layout>
  );
}
