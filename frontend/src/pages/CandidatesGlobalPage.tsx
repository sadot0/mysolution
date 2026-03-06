import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import Layout from '../components/Layout';
import ScoreRing from '../components/ScoreRing';
import { candidatesApi, vacanciesApi } from '../utils/api';
import { Vacancy } from '../types';
import { getCategoryColor, getCategoryLabel, getStatusColor, getStatusLabel, formatDate } from '../utils/helpers';
import {
  Search, Users, Mail, Calendar, FileText, Loader2, BrainCircuit,
  Trophy, Star, TrendingUp, UserCheck, UserX, X,
  CheckCircle2, Clock, Zap, AlertCircle,
} from 'lucide-react';

interface GlobalCandidate {
  id: string;
  full_name: string;
  email: string;
  phone?: string;
  status: string;
  submitted_at: string;
  resume_text?: string;
  vacancies?: { id: string; title: string };
  ai_analysis?: { overall_score: number; category: string; summary: string; strengths?: string[] } | null;
}

// Deterministic avatar gradient from name
function getAvatarGradient(name: string): [string, string] {
  const palettes: [string, string][] = [
    ['#FF6A00', '#FF9A3C'],
    ['#7C3AED', '#A78BFA'],
    ['#0EA5E9', '#38BDF8'],
    ['#10B981', '#34D399'],
    ['#F59E0B', '#FCD34D'],
    ['#EF4444', '#F87171'],
    ['#EC4899', '#F472B6'],
    ['#06B6D4', '#67E8F9'],
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return palettes[Math.abs(hash) % palettes.length];
}

// Deterministic vacancy badge color
function getVacancyColor(id: string): { bg: string; border: string; color: string } {
  const colors = [
    { bg: 'rgba(255,110,0,0.12)', border: 'rgba(255,110,0,0.25)', color: '#FF9A3C' },
    { bg: 'rgba(124,58,237,0.12)', border: 'rgba(124,58,237,0.25)', color: '#A78BFA' },
    { bg: 'rgba(14,165,233,0.12)', border: 'rgba(14,165,233,0.25)', color: '#38BDF8' },
    { bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.25)', color: '#34D399' },
    { bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.25)', color: '#FCD34D' },
  ];
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function getScoreBarColor(score: number): string {
  if (score >= 90) return 'linear-gradient(90deg, #10b981, #34d399)';
  if (score >= 75) return 'linear-gradient(90deg, #3b82f6, #60a5fa)';
  if (score >= 60) return 'linear-gradient(90deg, #FF6A00, #FF9A3C)';
  return 'linear-gradient(90deg, #ef4444, #f87171)';
}

const statusIcons: Record<string, React.ReactNode> = {
  new: <Clock size={10} />,
  analyzing: <Zap size={10} />,
  analyzed: <BrainCircuit size={10} />,
  invited: <CheckCircle2 size={10} />,
  rejected: <AlertCircle size={10} />,
  error: <AlertCircle size={10} />,
};

export default function CandidatesGlobalPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [vacancyFilter, setVacancyFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'date' | 'score'>('date');

  const { data: candidatesData, isLoading } = useQuery({
    queryKey: ['candidates-all', statusFilter, vacancyFilter, sortBy],
    queryFn: () =>
      candidatesApi
        .listAll({
          status: statusFilter !== 'all' ? statusFilter : undefined,
          vacancy_id: vacancyFilter !== 'all' ? vacancyFilter : undefined,
          sort: sortBy,
        })
        .then((r) => r.data),
  });

  const { data: vacanciesData } = useQuery({
    queryKey: ['vacancies'],
    queryFn: () => vacanciesApi.list().then((r) => r.data.vacancies as Vacancy[]),
  });

  const allCandidates: GlobalCandidate[] = candidatesData?.candidates || [];

  const candidates: GlobalCandidate[] = useMemo(() =>
    allCandidates.filter((c) => {
      if (!search) return true;
      const s = search.toLowerCase();
      return c.full_name?.toLowerCase().includes(s) || c.email?.toLowerCase().includes(s);
    }),
    [allCandidates, search]
  );

  const stats = useMemo(() => {
    const analyzed = allCandidates.filter((c) => c.ai_analysis).length;
    const invited = allCandidates.filter((c) => c.status === 'invited').length;
    const rejected = allCandidates.filter((c) => c.status === 'rejected').length;
    const scored = allCandidates.filter((c) => c.ai_analysis?.overall_score);
    const avgScore = scored.length
      ? Math.round(scored.reduce((s, c) => s + (c.ai_analysis?.overall_score ?? 0), 0) / scored.length)
      : 0;
    return { total: candidatesData?.total ?? 0, analyzed, invited, rejected, avgScore };
  }, [allCandidates, candidatesData]);

  // Top 3 candidates by score
  const topCandidates = useMemo(() =>
    [...allCandidates]
      .filter((c) => c.ai_analysis?.overall_score)
      .sort((a, b) => (b.ai_analysis?.overall_score ?? 0) - (a.ai_analysis?.overall_score ?? 0))
      .slice(0, 3),
    [allCandidates]
  );

  const lastUpdated = useMemo(() => {
    if (!allCandidates.length) return null;
    const latest = allCandidates.reduce((a, b) =>
      new Date(a.submitted_at) > new Date(b.submitted_at) ? a : b
    );
    return formatDate(latest.submitted_at);
  }, [allCandidates]);

  // Active filter chips
  const activeFilters: { key: string; label: string; clear: () => void }[] = [];
  if (statusFilter !== 'all') {
    const labels: Record<string, string> = { new: 'Новые', analyzing: 'Анализируются', analyzed: 'Проанализированы', invited: 'Приглашены', rejected: 'Отклонены' };
    activeFilters.push({ key: 'status', label: labels[statusFilter] || statusFilter, clear: () => setStatusFilter('all') });
  }
  if (vacancyFilter !== 'all') {
    const vac = (vacanciesData || []).find((v) => v.id === vacancyFilter);
    activeFilters.push({ key: 'vacancy', label: vac?.title || 'Вакансия', clear: () => setVacancyFilter('all') });
  }
  if (search) {
    activeFilters.push({ key: 'search', label: `«${search}»`, clear: () => setSearch('') });
  }

  const statCards = [
    {
      label: 'Всего', value: stats.total, color: '#fff',
      icon: <Users size={18} />, accent: 'rgba(255,255,255,0.12)',
      bars: [40, 55, 35, 70, 50, 80, 60].map((h) => ({ h, op: 0.4 })),
    },
    {
      label: 'AI оценено', value: stats.analyzed, color: '#FF9A3C',
      icon: <BrainCircuit size={18} />, accent: 'rgba(255,154,60,0.18)',
      bars: [30, 50, 45, 65, 55, 75, 70].map((h) => ({ h, op: 0.7 })),
    },
    {
      label: 'Приглашено', value: stats.invited, color: '#10b981',
      icon: <UserCheck size={18} />, accent: 'rgba(16,185,129,0.18)',
      bars: [20, 35, 28, 42, 38, 55, 48].map((h) => ({ h, op: 0.7 })),
    },
    {
      label: 'Отклонено', value: stats.rejected, color: '#f87171',
      icon: <UserX size={18} />, accent: 'rgba(248,113,113,0.16)',
      bars: [15, 22, 18, 30, 25, 35, 28].map((h) => ({ h, op: 0.6 })),
    },
    {
      label: 'Средний скор', value: stats.avgScore ? `${stats.avgScore}%` : '—', color: '#60a5fa',
      icon: <TrendingUp size={18} />, accent: 'rgba(96,165,250,0.18)',
      bars: [45, 50, 55, 52, 60, 58, 65].map((h) => ({ h, op: 0.7 })),
    },
  ];

  const medalColors = ['#FFD700', '#C0C0C0', '#CD7F32'];
  const medalIcons = [<Trophy size={14} />, <Star size={14} />, <Star size={12} />];

  return (
    <Layout>
      <div className="p-6 md:p-8 max-w-7xl mx-auto page-content">

        {/* Header */}
        <div className="mb-8">
          <h2
            className="text-gradient-animated font-black mb-1"
            style={{ fontSize: 'clamp(1.75rem, 4vw, 2.25rem)' }}
          >
            Все кандидаты
          </h2>
          <div className="flex items-center gap-2 text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>
            <span>База данных кандидатов по всем вакансиям</span>
            {lastUpdated && (
              <>
                <span style={{ color: 'rgba(255,255,255,0.15)' }}>·</span>
                <span>Последнее обновление: {lastUpdated}</span>
              </>
            )}
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-7">
          {statCards.map(({ label, value, color, icon, accent, bars }, i) => (
            <div
              key={label}
              className="stat-card"
              style={{ animationDelay: `${i * 0.07}s` }}
            >
              <div className="flex items-start justify-between mb-2">
                <div
                  className="flex items-center justify-center rounded-xl"
                  style={{ width: 36, height: 36, background: accent, color }}
                >
                  {icon}
                </div>
                {/* Mini sparkline */}
                <div className="sparkline" style={{ color }}>
                  {bars.map((b, bi) => (
                    <div
                      key={bi}
                      className="sparkline-bar"
                      style={{ height: `${b.h}%`, opacity: b.op, animationDelay: `${bi * 0.06}s` }}
                    />
                  ))}
                </div>
              </div>
              <div className="stat-card-value" style={{ color, animationDelay: `${i * 0.09}s` }}>
                {value}
              </div>
              <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>{label}</p>
            </div>
          ))}
        </div>

        {/* Top Candidates */}
        {topCandidates.length > 0 && (
          <div className="mb-7">
            <div className="flex items-center gap-2 mb-3">
              <Trophy size={16} style={{ color: '#FFD700' }} />
              <h3 className="text-sm font-bold text-white">Лучшие кандидаты</h3>
              <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>по AI-оценке</span>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-2" style={{ scrollbarWidth: 'thin' }}>
              {topCandidates.map((c, i) => {
                const [g1, g2] = getAvatarGradient(c.full_name || '?');
                const initials = (c.full_name || '?').split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
                return (
                  <div
                    key={c.id}
                    className="top-candidate-card"
                    style={{ animationDelay: `${i * 0.12}s` }}
                    onClick={() => navigate(`/candidates/${c.id}`)}
                  >
                    {/* Medal */}
                    <div
                      className="absolute top-3 right-3 flex items-center justify-center rounded-full"
                      style={{
                        width: 24, height: 24,
                        background: `${medalColors[i]}22`,
                        border: `1px solid ${medalColors[i]}55`,
                        color: medalColors[i],
                      }}
                    >
                      {medalIcons[i]}
                    </div>

                    {/* Avatar */}
                    <div
                      className="avatar-circle mb-3"
                      style={{
                        width: 52, height: 52,
                        background: `linear-gradient(135deg, ${g1}, ${g2})`,
                        fontSize: '1.125rem',
                        boxShadow: `0 4px 16px ${g1}44`,
                      }}
                    >
                      {initials}
                    </div>

                    {/* Score */}
                    <div
                      className="text-2xl font-black mb-0.5"
                      style={{ color: g1 }}
                    >
                      {c.ai_analysis?.overall_score}%
                    </div>
                    <p className="text-xs font-semibold text-white truncate mb-1">{c.full_name}</p>
                    <p className="text-xs truncate" style={{ color: 'rgba(255,255,255,0.35)' }}>
                      {c.vacancies?.title || '—'}
                    </p>

                    {/* Score bar */}
                    <div className="score-bar-track mt-3">
                      <div
                        className="score-bar-fill"
                        style={{
                          width: `${c.ai_analysis?.overall_score ?? 0}%`,
                          background: getScoreBarColor(c.ai_analysis?.overall_score ?? 0),
                          ['--score-width' as string]: `${c.ai_analysis?.overall_score ?? 0}%`,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'rgba(255,255,255,0.3)' }} />
            <input
              type="text"
              placeholder="Поиск по имени или email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-9 text-sm"
            />
            {search && (
              <button
                className="absolute right-3 top-1/2 -translate-y-1/2"
                onClick={() => setSearch('')}
                style={{ color: 'rgba(255,255,255,0.3)' }}
              >
                <X size={13} />
              </button>
            )}
          </div>

          <select className="select-premium" value={vacancyFilter} onChange={(e) => setVacancyFilter(e.target.value)}>
            <option value="all">Все вакансии</option>
            {(vacanciesData || []).map((v) => (
              <option key={v.id} value={v.id}>{v.title}</option>
            ))}
          </select>

          <select className="select-premium" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">Все статусы</option>
            <option value="new">Новые</option>
            <option value="analyzed">Проанализированы</option>
            <option value="invited">Приглашены</option>
            <option value="rejected">Отклонены</option>
          </select>

          <select className="select-premium" value={sortBy} onChange={(e) => setSortBy(e.target.value as 'date' | 'score')}>
            <option value="date">По дате</option>
            <option value="score">По скору</option>
          </select>
        </div>

        {/* Active filter chips */}
        {activeFilters.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {activeFilters.map(({ key, label, clear }) => (
              <span key={key} className="chip-filter">
                {label}
                <span className="chip-dismiss" onClick={clear}>
                  <X size={9} />
                </span>
              </span>
            ))}
            {activeFilters.length > 1 && (
              <button
                className="text-xs font-semibold transition-colors"
                style={{ color: 'rgba(255,255,255,0.35)' }}
                onClick={() => { setSearch(''); setStatusFilter('all'); setVacancyFilter('all'); }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#f87171')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.35)')}
              >
                Сбросить всё
              </button>
            )}
          </div>
        )}

        {/* Results count */}
        {!isLoading && (
          <p className="text-xs mb-4" style={{ color: 'rgba(255,255,255,0.28)' }}>
            Показано{' '}
            <span className="font-bold" style={{ color: '#FF9A3C' }}>{candidates.length}</span>
            {' '}из{' '}
            <span className="font-bold" style={{ color: 'rgba(255,255,255,0.5)' }}>{stats.total}</span>
            {' '}кандидатов
          </p>
        )}

        {/* Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={32} className="animate-spin" style={{ color: '#FF9A3C' }} />
          </div>
        ) : !candidates.length ? (
          <div className="card text-center py-16">
            <div
              className="inline-flex items-center justify-center mb-4"
              style={{ width: 64, height: 64, background: 'rgba(255,110,0,0.08)', border: '1px solid rgba(255,110,0,0.15)', borderRadius: 18 }}
            >
              <Users size={28} style={{ color: 'rgba(255,110,0,0.4)' }} />
            </div>
            <p className="text-white font-semibold text-lg mb-1">Кандидаты не найдены</p>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>Попробуйте изменить фильтры</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {candidates.map((c, idx) => (
              <CandidateGlobalCard
                key={c.id}
                candidate={c}
                index={idx}
                onClick={() => navigate(`/candidates/${c.id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}

/* ─── CANDIDATE GLOBAL CARD ─── */

function CandidateGlobalCard({
  candidate: c,
  index,
  onClick,
}: {
  candidate: GlobalCandidate;
  index: number;
  onClick: () => void;
}) {
  const analysis = c.ai_analysis;
  const [g1, g2] = getAvatarGradient(c.full_name || '?');
  const initials = (c.full_name || '?').split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
  const vacColor = c.vacancies?.id ? getVacancyColor(c.vacancies.id) : null;

  // Skill preview from analysis strengths
  const skillPreview: string[] = analysis?.strengths?.slice(0, 2) || [];

  return (
    <div
      className="card stagger-item flex flex-col gap-3 cursor-pointer"
      style={{
        animationDelay: `${index * 0.04}s`,
        borderColor: analysis ? 'rgba(255,110,0,0.18)' : 'rgba(255,110,0,0.10)',
        transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)',
      }}
      onClick={onClick}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-6px)';
        e.currentTarget.style.borderColor = 'rgba(255,110,0,0.32)';
        e.currentTarget.style.boxShadow = '0 16px 48px rgba(0,0,0,0.4), 0 0 40px rgba(255,106,0,0.10)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = '';
        e.currentTarget.style.borderColor = analysis ? 'rgba(255,110,0,0.18)' : 'rgba(255,110,0,0.10)';
        e.currentTarget.style.boxShadow = '';
      }}
    >
      {/* Top row: avatar + name + score ring */}
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div
          className="avatar-circle"
          style={{
            width: 44, height: 44,
            background: `linear-gradient(135deg, ${g1}, ${g2})`,
            fontSize: '0.9375rem',
            boxShadow: `0 3px 12px ${g1}44`,
            flexShrink: 0,
          }}
        >
          {initials}
        </div>

        {/* Name + vacancy */}
        <div className="flex-1 min-w-0">
          <p className="font-bold text-white truncate mb-1">{c.full_name}</p>
          {vacColor && c.vacancies && (
            <div
              className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-semibold"
              style={{ background: vacColor.bg, border: `1px solid ${vacColor.border}`, color: vacColor.color }}
            >
              {c.vacancies.title}
            </div>
          )}
        </div>

        {/* Score ring */}
        {analysis ? (
          <ScoreRing score={analysis.overall_score} category={analysis.category} size="sm" />
        ) : null}
      </div>

      {/* Contact */}
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-xs" style={{ color: 'rgba(255,255,255,0.38)' }}>
          <Mail size={11} />
          <span className="truncate">{c.email}</span>
        </div>
        <div className="flex items-center gap-2 text-xs" style={{ color: 'rgba(255,255,255,0.38)' }}>
          <Calendar size={11} />
          <span>{formatDate(c.submitted_at)}</span>
          {c.resume_text && (
            <>
              <span style={{ color: 'rgba(255,255,255,0.15)' }}>·</span>
              <FileText size={10} style={{ color: 'rgba(16,185,129,0.6)' }} />
              <span style={{ color: 'rgba(16,185,129,0.6)' }}>Резюме</span>
            </>
          )}
        </div>
      </div>

      {/* Score bar + summary */}
      {analysis && (
        <>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>AI-оценка</span>
              <span className="text-xs font-bold" style={{ color: '#FF9A3C' }}>{analysis.overall_score}%</span>
            </div>
            <div className="score-bar-track">
              <div
                className="score-bar-fill"
                style={{
                  width: `${analysis.overall_score}%`,
                  background: getScoreBarColor(analysis.overall_score),
                  ['--score-width' as string]: `${analysis.overall_score}%`,
                }}
              />
            </div>
          </div>
          {analysis.summary && (
            <p className="text-xs leading-relaxed line-clamp-2" style={{ color: 'rgba(255,255,255,0.45)' }}>
              {analysis.summary}
            </p>
          )}
          {skillPreview.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {skillPreview.map((s) => (
                <span key={s} className="skill-tag">{s}</span>
              ))}
            </div>
          )}
        </>
      )}

      {!analysis && c.status === 'new' && (
        <div className="flex items-center gap-1.5 text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>
          <BrainCircuit size={11} />
          Ожидает анализа
        </div>
      )}

      {/* Footer */}
      <div
        className="flex items-center justify-between mt-auto pt-2"
        style={{ borderTop: '1px solid rgba(255,110,0,0.07)' }}
      >
        <span
          className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-semibold ${getStatusColor(c.status)}`}
          style={{ background: 'rgba(0,0,0,0.25)' }}
        >
          {statusIcons[c.status]}
          {getStatusLabel(c.status)}
        </span>
        {analysis && (
          <span className={`text-xs font-bold ${getCategoryColor(analysis.category)}`}>
            {getCategoryLabel(analysis.category)}
          </span>
        )}
      </div>
    </div>
  );
}
