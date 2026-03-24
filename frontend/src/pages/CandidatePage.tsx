import { motion } from 'framer-motion';
import { usePageTitle } from '../utils/usePageTitle';
import { slideInLeft } from '../utils/animations';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  ArrowLeftIcon, BrainCircuit, CheckCircle, XCircle, Mail,
  Phone, Linkedin, Globe, Upload, FileText, RefreshCw,
  MessageSquare, Loader2, Copy, Sparkles,
  Clock, Zap, UserCheck, UserX, Send, X, AlertTriangle,
  CheckCircle2, ShieldCheck, ShieldAlert, ShieldX, Eye, TrendingUp, Database, Calendar,
} from 'lucide-react';
import Layout from '../components/Layout';
import ScoreRing from '../components/ScoreRing';
import SkillsRadar from '../components/SkillsRadar';
import { candidatesApi, talentPoolApi } from '../utils/api';
import { Candidate } from '../types';
import { getCategoryColor, getCategoryLabel, getStatusLabel, formatDate } from '../utils/helpers';
import { useRef, useState, useEffect } from 'react';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getAvatarGradient(name: string): [string, string] {
  const palettes: [string, string][] = [
    ['#f97316', '#fb923c'], ['#7C3AED', '#A78BFA'], ['#0EA5E9', '#38BDF8'],
    ['#10B981', '#34D399'], ['#F59E0B', '#FCD34D'], ['#EF4444', '#F87171'],
    ['#EC4899', '#F472B6'], ['#06B6D4', '#67E8F9'],
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return palettes[Math.abs(hash) % palettes.length];
}

function getScoreColor(score: number) {
  if (score >= 90) return 'text-emerald-400';
  if (score >= 75) return 'text-blue-400';
  if (score >= 60) return 'text-orange-400';
  return 'text-red-400';
}

function getScoreBarClass(score: number) {
  if (score >= 90) return 'bg-gradient-to-r from-emerald-500 to-emerald-400';
  if (score >= 75) return 'bg-gradient-to-r from-blue-500 to-blue-400';
  if (score >= 60) return 'bg-gradient-to-r from-orange-500 to-orange-400';
  return 'bg-gradient-to-r from-red-500 to-red-400';
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
    <div className="card mb-6 px-6 py-4 backdrop-blur-xl rounded-2xl bg-gradient-to-br from-orange-500/[0.06] to-orange-500/[0.02]">
      <div className="flex items-center gap-0">
        {STAGES.map((stage, i) => {
          const isActive = i === stepIndex;
          const isDone = i < stepIndex;
          const isLast = i === STAGES.length - 1;
          const Icon = stage.icon;

          let dotBg = 'bg-white/[0.12]';
          let dotBorder = 'border-white/[0.08]';
          let iconClass = 'text-white/20';
          let labelClass = 'text-white/25';
          let labelContent: string = stage.label;
          let glowShadow = '';

          if (isDone) {
            dotBg = 'bg-emerald-500/30';
            dotBorder = 'border-emerald-500';
            iconClass = 'text-emerald-500';
            labelClass = 'text-emerald-500';
          }
          if (isActive) {
            dotBg = status === 'analyzing' ? 'bg-blue-400/30' : 'bg-orange-500/30';
            dotBorder = status === 'analyzing' ? 'border-blue-400' : 'border-orange-400';
            iconClass = status === 'analyzing' ? 'text-blue-400' : 'text-orange-400';
            labelClass = 'text-white';
            glowShadow = status === 'analyzing'
              ? 'shadow-[0_0_16px_rgba(96,165,250,0.33)]'
              : 'shadow-[0_0_16px_rgba(255,154,60,0.33)]';
          }
          if (isLast) {
            if (isInvited) {
              dotBg = 'bg-emerald-500/30'; dotBorder = 'border-emerald-500';
              iconClass = 'text-emerald-500'; labelClass = 'text-emerald-500';
              labelContent = 'Приглашён';
            }
            if (isRejected) {
              dotBg = 'bg-red-400/30'; dotBorder = 'border-red-400';
              iconClass = 'text-red-400'; labelClass = 'text-red-400';
              labelContent = 'Отклонён';
            }
          }

          return (
            <div key={stage.key} className="flex items-center flex-1 min-w-0">
              <div className="flex flex-col items-center shrink-0">
                <div
                  className={`flex items-center justify-center rounded-full w-9 h-9 border-2 transition-all ${dotBg} ${dotBorder} ${glowShadow}`}
                >
                  {isDone ? (
                    <CheckCircle2 size={16} className="text-emerald-500" />
                  ) : (
                    <Icon
                      size={15}
                      className={`${iconClass} ${isActive && status === 'analyzing' ? 'animate-spin' : ''}`}
                    />
                  )}
                </div>
                <span className={`text-[0.6875rem] font-semibold mt-1.5 whitespace-nowrap ${labelClass}`}>
                  {labelContent}
                </span>
              </div>
              {!isLast && (
                <div
                  className={`flex-1 mx-2 h-0.5 rounded-full transition-all duration-400 ${
                    isDone
                      ? 'bg-gradient-to-r from-emerald-500/50 to-emerald-500/30'
                      : 'bg-white/[0.06]'
                  }`}
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
      <div className="modal-content max-w-[540px]">
        {/* Header */}
        <div className="flex items-center justify-between px-7 py-5 border-b border-emerald-500/15 bg-gradient-to-br from-emerald-500/[0.08] to-transparent">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center rounded-xl w-[38px] h-[38px] bg-emerald-500/[0.12] border border-emerald-500/25">
              <UserCheck size={18} className="text-emerald-500" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Пригласить на интервью</h3>
              <p className="text-xs mt-0.5 text-white/40">
                {candidateName} · {candidateEmail}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center rounded-xl w-[34px] h-[34px] bg-white/[0.04] border border-white/[0.08] text-white/40 hover:bg-white/[0.08] hover:text-white/60 transition-all"
          >
            <X size={15} />
          </button>
        </div>

        <div className="px-7 py-6 space-y-5">
          {/* Email preview */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold uppercase tracking-wider text-white/35">
                Шаблон письма
              </p>
              <button
                onClick={copyEmail}
                className={`flex items-center gap-1.5 text-xs font-semibold transition-colors ${copied ? 'text-emerald-500' : 'text-orange-400'}`}
              >
                {copied ? <><CheckCircle2 size={11} />Скопировано</> : <><Copy size={11} />Копировать</>}
              </button>
            </div>
            <div className="rounded-xl p-4 text-[0.8125rem] leading-relaxed whitespace-pre-line bg-black/30 border border-emerald-500/15 text-white/65">
              {emailTemplate}
            </div>
          </div>

          {/* Send to */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-500/[0.07] border border-emerald-500/[0.18]">
            <Mail size={15} className="text-emerald-500" />
            <div>
              <p className="text-xs font-semibold text-emerald-400">Отправить на: {candidateEmail}</p>
              <p className="text-xs mt-0.5 text-white/30">
                Статус кандидата изменится на «Приглашён»
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <button className="btn-secondary flex-1 justify-center" onClick={onClose}>Отмена</button>
            <button
              className="btn-primary flex-1 justify-center bg-gradient-to-br from-emerald-700 to-emerald-500 shadow-[0_4px_16px_rgba(16,185,129,0.35)]"
              onClick={onConfirm}
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
      <div className="modal-content max-w-[480px]">
        <div className="flex items-center justify-between px-7 py-5 border-b border-red-500/15 bg-gradient-to-br from-red-500/[0.07] to-transparent">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center rounded-xl w-[38px] h-[38px] bg-red-500/10 border border-red-500/[0.22]">
              <UserX size={18} className="text-red-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Отклонить кандидата</h3>
              <p className="text-xs mt-0.5 text-white/40">{candidateName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center rounded-xl w-[34px] h-[34px] bg-white/[0.04] border border-white/[0.08] text-white/40 hover:bg-white/[0.08] hover:text-white/60 transition-all"
          >
            <X size={15} />
          </button>
        </div>

        <div className="px-7 py-6 space-y-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider mb-3 text-white/35">
              Причина отказа
            </p>
            <div className="space-y-2">
              {REJECT_REASONS.map((r) => (
                <button
                  key={r}
                  className={`w-full text-left text-sm px-3 py-2.5 rounded-xl transition-all border ${
                    reason === r
                      ? 'bg-red-500/[0.12] border-red-500/30 text-red-400'
                      : 'bg-white/[0.03] border-white/[0.06] text-white/60'
                  }`}
                  onClick={() => { setReason(r); setCustom(''); }}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-3.5 h-3.5 rounded-full border-2 shrink-0 ${
                        reason === r
                          ? 'border-red-400 bg-red-400'
                          : 'border-white/20 bg-transparent'
                      }`}
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

          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-500/[0.07] border border-amber-500/[0.18]">
            <AlertTriangle size={14} className="text-amber-400 shrink-0 mt-0.5" />
            <p className="text-xs text-white/45">
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

  const sections: { label: string; key: keyof InterviewQs; colorClass: string; bgClass: string; borderClass: string }[] = [
    { label: 'Технические', key: 'technical', colorClass: 'text-orange-400', bgClass: 'bg-orange-500/[0.06]', borderClass: 'border-l-orange-500/40' },
    { label: 'Поведенческие', key: 'behavioral', colorClass: 'text-blue-400', bgClass: 'bg-blue-500/[0.06]', borderClass: 'border-l-blue-500/40' },
    { label: 'Ситуационные', key: 'situational', colorClass: 'text-emerald-400', bgClass: 'bg-emerald-500/[0.06]', borderClass: 'border-l-emerald-500/40' },
  ];

  return (
    <div className="card backdrop-blur-xl rounded-2xl">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-orange-500/10 border border-orange-500/20 rounded-lg flex items-center justify-center">
            <MessageSquare size={16} className="text-orange-400" />
          </div>
          <h3 className="font-bold text-white">AI-вопросы для интервью</h3>
        </div>
        {generating ? (
          <span className="flex items-center gap-2 text-sm text-white/40">
            <Loader2 size={14} className="animate-spin" />Claude думает...
          </span>
        ) : (
          <button
            className={`${questions ? 'btn-secondary' : 'btn-primary'} text-[0.8rem] px-3.5 py-1.5`}
            onClick={generate}
          >
            {questions ? <><RefreshCw size={13} />Заново</> : <><MessageSquare size={13} />Сгенерировать</>}
          </button>
        )}
      </div>

      {!questions && !generating && (
        <p className="text-sm text-center py-6 text-white/30">
          Claude сгенерирует персонализированные вопросы на основе профиля кандидата
        </p>
      )}

      {generating && (
        <div className="py-8 text-center">
          <Loader2 size={28} className="animate-spin mx-auto mb-3 text-orange-400" />
          <p className="text-sm text-white/40">Claude анализирует кандидата...</p>
        </div>
      )}

      {questions && (
        <>
          <div className="space-y-5">
            {sections.map(({ label, key, colorClass, bgClass, borderClass }) => (
              <div key={key}>
                <p className={`text-xs font-bold mb-2.5 uppercase tracking-widest ${colorClass}`}>{label}</p>
                <div className="space-y-2">
                  {questions[key].map((q, i) => (
                    <div key={i} className={`flex gap-3 text-sm rounded-xl p-3 border-l-[3px] ${bgClass} ${borderClass}`}>
                      <span className={`shrink-0 font-black text-xs mt-0.5 ${colorClass}`}>{i + 1}.</span>
                      <span className="text-white/[0.78]">{q}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-3 mt-5 pt-4 border-t border-orange-500/[0.08]">
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
  const cfgMap = {
    trusted:      { icon: ShieldCheck,  colorClass: 'text-emerald-500', bgClass: 'bg-emerald-500/[0.08]', borderClass: 'border-emerald-500/[0.22]', badgeBg: 'bg-emerald-500/[0.09]', badgeBorder: 'border-emerald-500/[0.19]', label: 'Достоверно', barClass: 'bg-gradient-to-r from-emerald-600 to-emerald-400' },
    questionable: { icon: ShieldAlert,  colorClass: 'text-amber-400', bgClass: 'bg-amber-500/[0.08]', borderClass: 'border-amber-500/[0.22]', badgeBg: 'bg-amber-500/[0.09]', badgeBorder: 'border-amber-500/[0.19]', label: 'Под вопросом', barClass: 'bg-gradient-to-r from-amber-600 to-amber-400' },
    suspicious:   { icon: ShieldX,      colorClass: 'text-red-400', bgClass: 'bg-red-500/[0.08]', borderClass: 'border-red-500/[0.22]', badgeBg: 'bg-red-500/[0.09]', badgeBorder: 'border-red-500/[0.19]', label: 'Подозрительно', barClass: 'bg-gradient-to-r from-red-600 to-red-400' },
  };
  const cfg = cfgMap[integrity.level];
  const Icon = cfg.icon;

  return (
    <div className={`card ${cfg.bgClass} ${cfg.borderClass}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className={`w-8 h-8 ${cfg.badgeBg} border ${cfg.badgeBorder} rounded-lg flex items-center justify-center`}>
            <Icon size={16} className={cfg.colorClass} />
          </div>
          <h3 className="font-bold text-white">Достоверность анкеты</h3>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-2xl font-black ${cfg.colorClass}`}>{integrity.score}</span>
          <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${cfg.badgeBg} ${cfg.colorClass} border ${cfg.badgeBorder}`}>
            {cfg.label}
          </span>
        </div>
      </div>

      <div className="score-bar-track mb-4">
        <div
          className={`score-bar-fill ${cfg.barClass}`}
          style={{ width: `${integrity.score}%` }}
        />
      </div>

      <p className="text-sm leading-relaxed mb-4 text-white/65">
        {integrity.verdict}
      </p>

      {integrity.flags.length > 0 && (
        <div>
          <p className={`text-xs font-bold mb-2 uppercase tracking-wider ${cfg.colorClass}`}>
            Замечания AI
          </p>
          <div className="space-y-1.5">
            {integrity.flags.map((flag, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                <AlertTriangle size={13} className={`shrink-0 mt-0.5 ${cfg.colorClass}`} />
                <span className="text-white/60">{flag}</span>
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
  const recMap = {
    strong_yes: { label: 'Однозначно нанять',  colorClass: 'text-emerald-500', bgClass: 'bg-emerald-500/[0.12]',  borderClass: 'border-emerald-500/30' },
    yes:        { label: 'Рекомендую',          colorClass: 'text-emerald-400', bgClass: 'bg-emerald-500/[0.08]',  borderClass: 'border-emerald-500/20' },
    neutral:    { label: 'Нужно уточнить',      colorClass: 'text-amber-400', bgClass: 'bg-amber-500/[0.08]', borderClass: 'border-amber-500/20' },
    no:         { label: 'Не рекомендую',       colorClass: 'text-red-400', bgClass: 'bg-red-500/[0.08]',  borderClass: 'border-red-500/20' },
    strong_no:  { label: 'Однозначно нет',      colorClass: 'text-red-600', bgClass: 'bg-red-500/[0.12]',  borderClass: 'border-red-500/30' },
  };
  const recCfg = recMap[assessment.hire_recommendation];

  return (
    <div className="card backdrop-blur-xl rounded-2xl">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-violet-500/[0.12] border border-violet-500/25 rounded-lg flex items-center justify-center">
            <Eye size={16} className="text-violet-400" />
          </div>
          <h3 className="font-bold text-white">Независимая оценка AI</h3>
        </div>
        <span className={`text-xs font-bold px-3 py-1.5 rounded-lg border ${recCfg.bgClass} ${recCfg.colorClass} ${recCfg.borderClass}`}>
          {recCfg.label}
        </span>
      </div>

      <p className="text-sm leading-relaxed mb-5 text-white/65 border-l-2 border-violet-500/40 pl-3">
        {assessment.beyond_criteria_notes}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {assessment.hidden_strengths.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <TrendingUp size={12} className="text-emerald-500" />
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-500">AI заметил плюсы</p>
            </div>
            <div className="space-y-1.5">
              {assessment.hidden_strengths.map((s, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <CheckCircle2 size={12} className="shrink-0 mt-0.5 text-emerald-500" />
                  <span className="text-white/60">{s}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {assessment.hidden_concerns.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <AlertTriangle size={12} className="text-amber-400" />
              <p className="text-xs font-bold uppercase tracking-wider text-amber-400">AI заметил риски</p>
            </div>
            <div className="space-y-1.5">
              {assessment.hidden_concerns.map((c, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <XCircle size={12} className="shrink-0 mt-0.5 text-amber-400" />
                  <span className="text-white/60">{c}</span>
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
  const [showEmailModal, setShowEmailModal] = useState<string | null>(null);

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
  usePageTitle(data?.full_name || 'Кандидат');

  const analyzeMutation = useMutation({
    mutationFn: () => candidatesApi.analyze(id!),
    onSuccess: () => { toast.success('Анализ завершён!'); refetch(); },
    onError: (err: unknown) => {
      const axiosErr = err as { response?: { status?: number; data?: { error?: string } } };
      if (axiosErr?.response?.status === 402) {
        toast.error('Недостаточно токенов! Перейдите в Настройки → Токены');
      } else {
        toast.error(axiosErr?.response?.data?.error || 'Ошибка анализа');
      }
    },
  });

  const statusMutation = useMutation({
    mutationFn: (status: string) => candidatesApi.updateStatus(id!, status),
    onSuccess: (_, status) => {
      toast.success(status === 'invited' ? 'Кандидат приглашён!' : 'Статус обновлён');
      refetch();
    },
    onError: () => toast.error('Ошибка обновления статуса'),
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
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="skeleton h-80 rounded-2xl" />
            <div className="col-span-1 lg:col-span-2 skeleton h-80 rounded-2xl" />
          </div>
        </div>
      </Layout>
    );
  }

  if (isError || !data) {
    return (
      <Layout>
        <div className="p-8 flex flex-col items-center justify-center min-h-[60vh]">
          <div className="flex items-center justify-center rounded-2xl mb-4 w-16 h-16 bg-red-500/10 border border-red-500/[0.22]">
            <XCircle size={28} className="text-red-400" />
          </div>
          <h2 className="text-xl font-black text-white mb-2">Кандидат не найден</h2>
          <p className="text-sm mb-5 text-white/40">
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

  const statusBadgeClass =
    candidate?.status === 'invited' ? 'bg-emerald-500/[0.12] text-emerald-500' :
    candidate?.status === 'rejected' ? 'bg-red-500/[0.12] text-red-400' :
    'bg-white/[0.08] text-white/50';

  return (
    <Layout>
      <motion.div variants={slideInLeft} initial="initial" animate="animate" className="p-6 md:p-8 max-w-6xl page-content">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-white/40 mb-4">
          <Link to="/vacancies" className="hover:text-orange-400 transition-colors">Вакансии</Link>
          <span>/</span>
          <Link to={`/vacancies/${candidate?.vacancy_id}`} className="hover:text-orange-400 transition-colors">Вакансия</Link>
          <span>/</span>
          <span className="text-neutral-300">{candidate?.full_name || '...'}</span>
        </div>

        {/* Pipeline stages */}
        <PipelineBar status={candidate?.status || 'new'} />

        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start gap-4 mb-6">
          {/* Back */}
          <button
            onClick={() => navigate(vacancy ? `/vacancies/${vacancy.id}` : '/vacancies')}
            className="flex items-center justify-center rounded-xl shrink-0 mt-1 w-10 h-10 bg-white/[0.04] border border-orange-500/[0.12] text-white/50 hover:bg-orange-500/10 hover:text-orange-400 transition-all"
          >
            <ArrowLeftIcon size={18} />
          </button>

          {/* Avatar + name */}
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <div
              className="avatar-circle shrink-0 w-[72px] h-[72px] text-2xl border-[3px] shadow-lg"
              style={{
                background: `linear-gradient(135deg,${g1},${g2})`,
                boxShadow: `0 8px 24px ${g1}55`,
              }}
            >
              {initials}
            </div>
            <div className="min-w-0">
              <h2 className="text-2xl md:text-3xl font-black text-white truncate">{candidate?.full_name}</h2>
              <div className="flex items-center gap-3 mt-1.5 text-sm text-white/45">
                {candidate?.email && (
                  <span className="flex items-center gap-1.5 truncate">
                    <Mail size={13} className="text-white/30 shrink-0" />
                    {candidate.email}
                  </span>
                )}
                {candidate?.phone && (
                  <span className="flex items-center gap-1.5">
                    <Phone size={13} className="text-white/30 shrink-0" />
                    {candidate.phone}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap mt-2">
                {vacancy && (
                  <span className="text-xs px-2.5 py-1 rounded-lg font-semibold bg-orange-500/[0.12] border border-orange-500/[0.22] text-orange-400">
                    {vacancy.title}
                  </span>
                )}
                <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${statusBadgeClass}`}>
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
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm bg-blue-500/10 border border-blue-500/[0.22] text-blue-400">
                <Loader2 size={14} className="animate-spin" />
                Анализирую...
              </div>
            )}
            {canDecide && (
              <>
                <button
                  className="btn-primary bg-gradient-to-br from-emerald-700 to-emerald-500 shadow-[0_4px_16px_rgba(16,185,129,0.35)]"
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
            {analysis && (
              <button
                className="btn-secondary"
                onClick={async () => {
                  try {
                    const res = await candidatesApi.downloadReport(candidate.id);
                    const blob = new Blob([res.data], { type: 'application/pdf' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${candidate.full_name.replace(/\s+/g, '_')}_report.pdf`;
                    a.click();
                    URL.revokeObjectURL(url);
                    toast.success('PDF отчёт скачан');
                  } catch {
                    toast.error('Ошибка скачивания отчёта');
                  }
                }}
              >
                <FileText size={14} />
                Скачать PDF
              </button>
            )}
            {analysis && (
              <>
                <button
                  className="btn-primary bg-gradient-to-br from-emerald-700 to-emerald-500 shadow-[0_4px_12px_rgba(16,185,129,0.25)]"
                  onClick={() => setShowEmailModal('invite')}
                >
                  <Mail size={14} />
                  Пригласить
                </button>
                <button
                  className="btn-danger"
                  onClick={() => setShowEmailModal('reject')}
                >
                  <UserX size={14} />
                  Отклонить
                </button>
                <button
                  className="btn-primary"
                  onClick={() => setShowEmailModal('offer')}
                >
                  <Send size={14} />
                  Оффер
                </button>
              </>
            )}
            <button
              className="btn-secondary"
              onClick={async () => {
                try {
                  await talentPoolApi.fromCandidate(candidate.id);
                  toast.success('Кандидат добавлен в базу талантов!');
                } catch (err: any) {
                  if (err?.response?.status === 409) {
                    toast.error('Кандидат уже в базе талантов');
                  } else {
                    toast.error('Ошибка добавления');
                  }
                }
              }}
            >
              <Database size={14} />
              В базу талантов
            </button>
            <button
              className="btn-secondary"
              onClick={() => {
                toast.success('Перейдите в раздел Интервью для планирования');
                navigate('/interviews');
              }}
            >
              <Calendar size={14} />
              Интервью
            </button>
          </div>
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left column */}
          <div className="space-y-5">

            {/* Score card (if analyzed) */}
            {analysis && (
              <div className="card text-center p-6 backdrop-blur-xl rounded-2xl">
                <div className="flex justify-center mb-3">
                  <ScoreRing score={analysis.overall_score} category={analysis.category} size="lg" />
                </div>
                <p className={`text-lg font-black ${getCategoryColor(analysis.category)}`}>
                  {getCategoryLabel(analysis.category)}
                </p>
                <p className="text-xs mt-1 text-white/30">
                  Проанализирован {formatDate(analysis.analyzed_at)}
                </p>
              </div>
            )}

            {/* Contacts */}
            <div className="card backdrop-blur-xl rounded-2xl">
              <h3 className="font-bold text-white mb-4">Контакты</h3>
              <div className="space-y-3">
                {[
                  { icon: Mail, value: candidate?.email, href: candidate?.email ? `mailto:${candidate.email}` : undefined, iconClass: 'text-orange-400', bgClass: 'bg-orange-500/[0.08]', borderClass: 'border-orange-500/15' },
                  { icon: Phone, value: candidate?.phone, iconClass: 'text-orange-400', bgClass: 'bg-orange-500/[0.08]', borderClass: 'border-orange-500/15' },
                  { icon: Linkedin, value: candidate?.linkedin_url ? 'LinkedIn профиль' : null, href: candidate?.linkedin_url, iconClass: 'text-blue-400', bgClass: 'bg-blue-500/[0.08]', borderClass: 'border-blue-500/15' },
                  { icon: Globe, value: candidate?.portfolio_url ? 'Portfolio' : null, href: candidate?.portfolio_url, iconClass: 'text-blue-400', bgClass: 'bg-blue-500/[0.08]', borderClass: 'border-blue-500/15' },
                ].filter((c) => c.value).map(({ icon: Icon, value, href, iconClass, bgClass, borderClass }) => (
                  <div key={value} className="flex items-center gap-3 text-sm">
                    <div className={`shrink-0 flex items-center justify-center rounded-lg w-[30px] h-[30px] ${bgClass} border ${borderClass}`}>
                      <Icon size={14} className={iconClass} />
                    </div>
                    {href ? (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="truncate text-white/65 hover:text-orange-400 transition-colors"
                      >
                        {value}
                      </a>
                    ) : (
                      <span className="truncate text-white/65">{value}</span>
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-4 pt-4 space-y-1.5 border-t border-orange-500/[0.08]">
                <p className="text-xs text-white/30">
                  Подан: <span className="text-white font-medium">{formatDate(candidate?.submitted_at || '')}</span>
                </p>
              </div>
            </div>

            {/* Resume */}
            <div className="card backdrop-blur-xl rounded-2xl">
              <h3 className="font-bold text-white mb-3">Резюме</h3>
              {candidate?.resume_text ? (
                <div className="mb-3">
                  <p className="text-xs mb-2 flex items-center gap-1 text-emerald-500">
                    <FileText size={12} />
                    Загружено ({candidate.resume_text.length} симв.)
                  </p>
                  <p className="text-xs leading-relaxed line-clamp-4 text-white/40">
                    {candidate.resume_text.slice(0, 280)}...
                  </p>
                </div>
              ) : (
                <p className="text-sm mb-3 text-white/30">Резюме не загружено</p>
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
              <div className="card p-5 backdrop-blur-xl rounded-2xl bg-gradient-to-br from-orange-500/[0.08] to-orange-500/[0.03]">
                <p className="text-xs font-bold uppercase tracking-wider mb-3 text-white/35">
                  Принять решение
                </p>
                <div className="space-y-2">
                  <button
                    className="btn-primary w-full justify-center bg-gradient-to-br from-emerald-700 to-emerald-500 shadow-[0_4px_12px_rgba(16,185,129,0.3)]"
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
                className={`card text-center p-5 ${
                  candidate?.status === 'invited'
                    ? 'bg-emerald-500/[0.08] border-emerald-500/25'
                    : 'bg-red-500/[0.08] border-red-500/[0.22]'
                }`}
              >
                <div
                  className={`inline-flex items-center justify-center rounded-full mb-2 w-11 h-11 ${
                    candidate?.status === 'invited' ? 'bg-emerald-500/15' : 'bg-red-500/[0.12]'
                  }`}
                >
                  {candidate?.status === 'invited'
                    ? <CheckCircle size={22} className="text-emerald-500" />
                    : <XCircle size={22} className="text-red-400" />}
                </div>
                <p className={`font-bold text-sm ${candidate?.status === 'invited' ? 'text-emerald-500' : 'text-red-400'}`}>
                  {candidate?.status === 'invited' ? 'Приглашён на интервью' : 'Кандидат отклонён'}
                </p>
                <button
                  className="mt-3 text-xs font-semibold text-white/30 hover:text-orange-400 transition-colors"
                  onClick={() => statusMutation.mutate('analyzed')}
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
              <div className="card text-center py-16 backdrop-blur-xl rounded-2xl">
                <div className="relative inline-block mb-5">
                  <div className="w-20 h-20 rounded-full border-[3px] border-blue-400/20 flex items-center justify-center">
                    <BrainCircuit size={34} className="text-blue-400 animate-bounce" />
                  </div>
                  <div className="absolute -inset-1 border-2 border-dashed border-blue-400/30 rounded-full animate-[spin_4s_linear_infinite]" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Claude анализирует кандидата</h3>
                <p className="text-sm max-w-sm mx-auto text-white/40 leading-relaxed">
                  AI изучает резюме, опыт и соответствие требованиям вакансии. Обычно занимает 30-60 секунд.
                </p>
                <div className="flex items-center justify-center gap-2 mt-4 text-sm text-blue-400">
                  <Loader2 size={14} className="animate-spin" />
                  Обновление автоматически...
                </div>
              </div>
            ) : analysis ? (
              <>
                {/* Scores breakdown */}
                <div className="card backdrop-blur-xl rounded-2xl">
                  <h3 className="font-bold text-white mb-5">Оценки по критериям</h3>

                  {/* Score bars */}
                  <div className="space-y-4 mb-6">
                    {Object.entries(analysis.scores ?? {}).map(([key, value]) => (
                      <div key={key}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-semibold text-white/55">
                            {SCORE_LABELS[key] || key}
                          </span>
                          <span className={`text-sm font-black ${getScoreColor(value)}`}>
                            {value}%
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-white/[0.02] overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-1000 ease-out ${getScoreBarClass(value)}`}
                            style={{ width: `${value}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Radar */}
                  <SkillsRadar scores={analysis.scores} />
                </div>

                {/* Summary */}
                <div className="card backdrop-blur-xl rounded-2xl">
                  <div className="flex items-center gap-2.5 mb-3">
                    <Sparkles size={16} className="text-orange-400" />
                    <h3 className="font-bold text-white">Резюме AI</h3>
                  </div>
                  <p className="text-sm leading-relaxed text-white/70">
                    {analysis.summary}
                  </p>
                </div>

                {/* Strengths / Weaknesses */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="card backdrop-blur-xl rounded-2xl">
                    <h3 className="font-bold mb-3 text-emerald-500">Сильные стороны</h3>
                    <ul className="space-y-2.5">
                      {analysis.strengths.map((s, i) => (
                        <li key={i} className="flex items-start gap-2.5 text-sm">
                          <div className="w-5 h-5 rounded-full bg-emerald-500/15 flex items-center justify-center shrink-0 mt-0.5">
                            <CheckCircle size={12} className="text-emerald-500" />
                          </div>
                          <span className="text-white/70">{s}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="card backdrop-blur-xl rounded-2xl">
                    <h3 className="font-bold mb-3 text-red-400">Слабые стороны</h3>
                    <ul className="space-y-2.5">
                      {analysis.weaknesses.map((w, i) => (
                        <li key={i} className="flex items-start gap-2.5 text-sm">
                          <div className="w-5 h-5 rounded-full bg-red-500/15 flex items-center justify-center shrink-0 mt-0.5">
                            <XCircle size={12} className="text-red-400" />
                          </div>
                          <span className="text-white/70">{w}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Recommendations */}
                <div className="card backdrop-blur-xl rounded-2xl">
                  <h3 className="font-bold text-white mb-4">Рекомендации для интервью</h3>
                  <ul className="space-y-3">
                    {analysis.recommendations.map((r, i) => (
                      <li key={i} className="flex items-start gap-3 text-sm">
                        <span className="shrink-0 flex items-center justify-center text-xs font-black mt-0.5 w-6 h-6 bg-orange-500/15 border border-orange-500/25 rounded-lg text-orange-400">
                          {i + 1}
                        </span>
                        <span className="text-white/70">{r}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* AI Insights */}
                {analysis.ai_insights && (
                  <div className="card backdrop-blur-xl rounded-2xl">
                    <h3 className="font-bold text-white mb-4">AI Инсайты</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                      {analysis.ai_insights.green_flags?.length > 0 && (
                        <div>
                          <p className="text-xs font-bold mb-2 uppercase tracking-wider text-emerald-500">Green Flags</p>
                          <div className="flex flex-wrap gap-1.5">
                            {analysis.ai_insights.green_flags.map((f, i) => (
                              <span key={i} className="text-xs px-2.5 py-1 rounded-lg font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                                {f}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {analysis.ai_insights.potential_concerns?.length > 0 && (
                        <div>
                          <p className="text-xs font-bold mb-2 uppercase tracking-wider text-amber-400">Риски</p>
                          <div className="flex flex-wrap gap-1.5">
                            {analysis.ai_insights.potential_concerns.map((c, i) => (
                              <span key={i} className="text-xs px-2.5 py-1 rounded-lg font-medium bg-amber-500/10 text-amber-300 border border-amber-500/20">
                                {c}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    {analysis.ai_insights.growth_potential && (
                      <div className="flex items-center gap-3 p-3 rounded-xl bg-black/30 border border-orange-500/[0.08]">
                        <span className="text-sm text-white/50">Потенциал роста:</span>
                        <span className={`font-bold text-sm ${
                          analysis.ai_insights.growth_potential === 'high' ? 'text-emerald-500' :
                          analysis.ai_insights.growth_potential === 'medium' ? 'text-amber-400' : 'text-red-400'
                        }`}>
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
                  <div className="card backdrop-blur-xl rounded-2xl">
                    <h3 className="font-bold text-white mb-4">Ответы из формы</h3>
                    <div className="space-y-4">
                      {Object.entries(candidate.form_responses).map(([key, value]) => (
                        <div key={key}>
                          <p className="text-xs font-bold mb-1.5 uppercase tracking-wider text-orange-500/60">{key}</p>
                          <p className="text-sm text-white/70">
                            {Array.isArray(value) ? value.join(', ') : String(value)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Run analysis CTA */}
                <div className="card text-center py-14 backdrop-blur-xl rounded-2xl bg-gradient-to-br from-orange-500/[0.07] to-orange-500/[0.03] border-dashed border-orange-500/20">
                  <div className="relative inline-block mb-5">
                    <div className="flex items-center justify-center w-20 h-20 rounded-full bg-orange-500/[0.08] border-2 border-orange-500/[0.18] animate-[pulse_3s_ease-in-out_infinite]">
                      <BrainCircuit size={34} className="text-orange-400" />
                    </div>
                    <div className="absolute -inset-1.5 border border-dashed border-orange-500/20 rounded-full animate-[spin_8s_linear_infinite]" />
                  </div>

                  <h3 className="text-xl font-black text-white mb-2">Запустить AI-анализ</h3>
                  <p className="text-sm mb-2 max-w-sm mx-auto text-white/40 leading-relaxed">
                    Claude проанализирует профиль кандидата, оценит его по 6 критериям и даст рекомендации для интервью
                  </p>

                  {/* What you get */}
                  <div className="flex flex-wrap justify-center gap-2 mb-6">
                    {['Оценка 0-100%', 'Hard/Soft Skills', 'Сильные стороны', 'Риски', 'Вопросы для интервью'].map((item) => (
                      <span
                        key={item}
                        className="text-xs px-2.5 py-1 rounded-lg bg-orange-500/10 border border-orange-500/[0.18] text-orange-400/80"
                      >
                        {item}
                      </span>
                    ))}
                  </div>

                  <button
                    className="btn-primary px-7 py-3 text-[0.9375rem] shadow-[0_8px_32px_rgba(255,106,0,0.45)]"
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
      </motion.div>

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
      {showEmailModal && (
        <EmailModal
          candidateId={candidate?.id || ''}
          candidateName={candidate?.full_name || ''}
          template={showEmailModal}
          onClose={() => setShowEmailModal(null)}
        />
      )}
    </Layout>
  );
}

function EmailModal({ candidateId, candidateName, template, onClose }: {
  candidateId: string; candidateName: string; template: string; onClose: () => void;
}) {
  const [sending, setSending] = useState(false);
  const [interviewDate, setInterviewDate] = useState('');
  const [salary, setSalary] = useState('');
  
  const titles: Record<string, string> = {
    invite: 'Пригласить на интервью',
    reject: 'Отправить отказ', 
    offer: 'Отправить оффер',
  };

  const handleSend = async () => {
    setSending(true);
    try {
      await candidatesApi.sendEmail(candidateId, {
        template,
        interview_date: interviewDate || undefined,
        salary: salary || undefined,
      });
      toast.success(`Email отправлен ${candidateName}`);
      onClose();
    } catch {
      toast.error('Ошибка отправки');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content max-w-md" onClick={e => e.stopPropagation()}>
        <div className="p-6">
          <h3 className="text-lg font-bold text-white mb-4">{titles[template]}</h3>
          <p className="text-sm text-white/60 mb-4">
            Отправить {template === 'invite' ? 'приглашение' : template === 'reject' ? 'вежливый отказ' : 'предложение о работе'} для <strong className="text-white">{candidateName}</strong>
          </p>
          
          {template === 'invite' && (
            <div className="mb-4">
              <label className="label">Дата интервью</label>
              <input type="datetime-local" className="input" value={interviewDate} onChange={e => setInterviewDate(e.target.value)} />
            </div>
          )}
          
          {template === 'offer' && (
            <div className="mb-4">
              <label className="label">Зарплата</label>
              <input type="text" className="input" placeholder="$2,000/мес" value={salary} onChange={e => setSalary(e.target.value)} />
            </div>
          )}
          
          <div className="flex gap-3">
            <button className="btn-secondary flex-1" onClick={onClose}>Отмена</button>
            <button className={`flex-1 ${template === 'reject' ? 'btn-danger' : 'btn-primary'}`} onClick={handleSend} disabled={sending}>
              {sending ? 'Отправка...' : 'Отправить'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
