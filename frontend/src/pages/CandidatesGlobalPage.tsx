import { motion } from 'framer-motion';
import { usePageTitle } from '../utils/usePageTitle';
import { pageVariants } from '../utils/animations';
import { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import Layout from '../components/Layout';
import ScoreRing from '../components/ScoreRing';
import { candidatesApi, vacanciesApi } from '../utils/api';
import { Vacancy } from '../types';
import { getCategoryColor, getCategoryLabel, getStatusColor, getStatusLabel, formatDate } from '../utils/helpers';
import {
  Search, Users, Mail, Calendar, FileText, Loader2, BrainCircuit,
  Trophy, Star, TrendingUp, UserCheck, UserX, X,
  CheckCircle2, Clock, Zap, AlertCircle, ArrowUpDown, SlidersHorizontal,
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
    ['#f97316', '#fb923c'],
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
function getVacancyBadgeClass(id: string): string {
  const classes = [
    'bg-orange-500/[0.12] border-orange-500/25 text-orange-400',
    'bg-violet-500/[0.12] border-violet-500/25 text-violet-400',
    'bg-sky-500/[0.12] border-sky-500/25 text-sky-400',
    'bg-emerald-500/[0.12] border-emerald-500/25 text-emerald-400',
    'bg-amber-500/[0.12] border-amber-500/25 text-amber-400',
  ];
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return classes[Math.abs(hash) % classes.length];
}

function getScoreBarClass(score: number): string {
  if (score >= 90) return 'bg-gradient-to-r from-emerald-500 to-emerald-400';
  if (score >= 75) return 'bg-gradient-to-r from-blue-500 to-blue-400';
  if (score >= 60) return 'bg-gradient-to-r from-orange-500 to-orange-400';
  return 'bg-gradient-to-r from-red-500 to-red-400';
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
  usePageTitle('Кандидаты');
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.get('q') || '';
  const statusFilter = searchParams.get('status') || 'all';
  const vacancyFilter = searchParams.get('vacancy') || 'all';
  const sortBy = (searchParams.get('sort') as 'date' | 'score' | 'name') || 'date';

  const setSearch = (value: string) => {
    setSearchParams(prev => {
      if (!value) prev.delete('q');
      else prev.set('q', value);
      return prev;
    });
  };

  const setStatusFilter = (value: string) => {
    setSearchParams(prev => {
      if (value === 'all') prev.delete('status');
      else prev.set('status', value);
      return prev;
    });
  };

  const setVacancyFilter = (value: string) => {
    setSearchParams(prev => {
      if (value === 'all') prev.delete('vacancy');
      else prev.set('vacancy', value);
      return prev;
    });
  };

  const setSortBy = (value: 'date' | 'score' | 'name') => {
    setSearchParams(prev => {
      if (value === 'date') prev.delete('sort');
      else prev.set('sort', value);
      return prev;
    });
  };
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const { data: candidatesData, isLoading } = useQuery({
    queryKey: ['candidates-all', statusFilter, vacancyFilter, sortBy],
    queryFn: () =>
      candidatesApi
        .listAll({
          status: statusFilter !== 'all' ? statusFilter : undefined,
          vacancy_id: vacancyFilter !== 'all' ? vacancyFilter : undefined,
          sort: sortBy === 'name' ? 'date' : sortBy,
        })
        .then((r) => r.data),
  });

  const { data: vacanciesData } = useQuery({
    queryKey: ['vacancies'],
    queryFn: () => vacanciesApi.list().then((r) => r.data.vacancies as Vacancy[]),
  });

  const allCandidates: GlobalCandidate[] = candidatesData?.candidates || [];

  const candidates: GlobalCandidate[] = useMemo(() => {
    let filtered = allCandidates.filter((c) => {
      if (!search) return true;
      const s = search.toLowerCase();
      return c.full_name?.toLowerCase().includes(s) || c.email?.toLowerCase().includes(s);
    });
    if (sortBy === 'name') {
      filtered = [...filtered].sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));
    }
    return filtered;
  }, [allCandidates, search, sortBy]);

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
    activeFilters.push({ key: 'search', label: `"${search}"`, clear: () => setSearch('') });
  }

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const statCards = [
    { label: 'Всего', value: stats.total, colorClass: 'text-white', iconBg: 'bg-white/[0.12]', icon: <Users size={18} /> },
    { label: 'AI оценено', value: stats.analyzed, colorClass: 'text-orange-400', iconBg: 'bg-orange-500/[0.18]', icon: <BrainCircuit size={18} /> },
    { label: 'Приглашено', value: stats.invited, colorClass: 'text-emerald-500', iconBg: 'bg-emerald-500/[0.18]', icon: <UserCheck size={18} /> },
    { label: 'Отклонено', value: stats.rejected, colorClass: 'text-red-400', iconBg: 'bg-red-400/[0.16]', icon: <UserX size={18} /> },
    { label: 'Средний скор', value: stats.avgScore ? `${stats.avgScore}%` : '--', colorClass: 'text-blue-400', iconBg: 'bg-blue-400/[0.18]', icon: <TrendingUp size={18} /> },
  ];

  const medalColors = ['text-yellow-400', 'text-gray-400', 'text-amber-600'];
  const medalBg = ['bg-yellow-400/[0.13] border-yellow-400/[0.33]', 'bg-gray-400/[0.13] border-gray-400/[0.33]', 'bg-amber-700/[0.13] border-amber-700/[0.33]'];
  const medalIcons = [<Trophy size={14} />, <Star size={14} />, <Star size={12} />];

  return (
    <Layout>
      <motion.div variants={pageVariants} initial="initial" animate="animate" className="p-6 md:p-8 max-w-7xl mx-auto page-content">

        {/* Header */}
        <div className="mb-8">
          <h2 className="text-gradient-animated font-black mb-1 text-[clamp(1.75rem,4vw,2.25rem)]">
            Все кандидаты
          </h2>
          <div className="flex items-center gap-2 text-sm text-white/35">
            <span>База данных кандидатов по всем вакансиям</span>
            {lastUpdated && (
              <>
                <span className="text-white/15">·</span>
                <span>Последнее обновление: {lastUpdated}</span>
              </>
            )}
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-7">
          {statCards.map(({ label, value, colorClass, iconBg, icon }, i) => (
            <div
              key={label}
              className="stat-card"
              style={{ animationDelay: `${i * 0.07}s` }}
            >
              <div className="flex items-start justify-between mb-3">
                <div className={`flex items-center justify-center rounded-xl w-9 h-9 ${iconBg} ${colorClass}`}>
                  {icon}
                </div>
              </div>
              <div className={`stat-card-value ${colorClass}`} style={{ animationDelay: `${i * 0.09}s` }}>
                {value}
              </div>
              <p className="text-xs mt-1 text-white/35">{label}</p>
            </div>
          ))}
        </div>

        {/* Top Candidates */}
        {topCandidates.length > 0 && (
          <div className="mb-7">
            <div className="flex items-center gap-2 mb-3">
              <Trophy size={16} className="text-yellow-400" />
              <h3 className="text-sm font-bold text-white">Лучшие кандидаты</h3>
              <span className="text-xs text-white/30">по AI-оценке</span>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin">
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
                    <div className={`absolute top-3 right-3 flex items-center justify-center rounded-full w-6 h-6 border ${medalBg[i]} ${medalColors[i]}`}>
                      {medalIcons[i]}
                    </div>

                    {/* Avatar */}
                    <div
                      className="avatar-circle mb-3 w-[52px] h-[52px] text-lg"
                      style={{
                        background: `linear-gradient(135deg, ${g1}, ${g2})`,
                        boxShadow: `0 4px 16px ${g1}44`,
                      }}
                    >
                      {initials}
                    </div>

                    {/* Score */}
                    <div className="text-2xl font-black mb-0.5" style={{ color: g1 }}>
                      {c.ai_analysis?.overall_score}%
                    </div>
                    <p className="text-xs font-semibold text-white truncate mb-1">{c.full_name}</p>
                    <p className="text-xs truncate text-white/35">
                      {c.vacancies?.title || '--'}
                    </p>

                    {/* Score bar */}
                    <div className="h-1.5 rounded-full bg-neutral-800 overflow-hidden mt-3">
                      <div
                        className={`h-full rounded-full transition-all duration-1000 ${getScoreBarClass(c.ai_analysis?.overall_score ?? 0)}`}
                        style={{ width: `${c.ai_analysis?.overall_score ?? 0}%` }}
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
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-white/30" />
            <input
              type="text"
              placeholder="Поиск по имени или email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-9 text-sm"
            />
            {search && (
              <button
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                onClick={() => setSearch('')}
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

          <select className="select-premium" value={sortBy} onChange={(e) => setSortBy(e.target.value as 'date' | 'score' | 'name')}>
            <option value="date">По дате</option>
            <option value="score">По скору</option>
            <option value="name">По имени</option>
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
                className="text-xs font-semibold text-white/35 hover:text-red-400 transition-colors"
                onClick={() => { setSearch(''); setStatusFilter('all'); setVacancyFilter('all'); }}
              >
                Сбросить всё
              </button>
            )}
          </div>
        )}

        {/* Bulk actions bar */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-3 mb-4 px-4 py-3 rounded-xl bg-orange-500/10 border border-orange-500/20">
            <SlidersHorizontal size={14} className="text-orange-400" />
            <span className="text-sm font-semibold text-orange-400">
              Выбрано: {selectedIds.size}
            </span>
            <div className="flex-1" />
            <button
              className="text-xs font-semibold text-white/40 hover:text-white/70 transition-colors"
              onClick={clearSelection}
            >
              Снять выбор
            </button>
          </div>
        )}

        {/* Results count */}
        {!isLoading && (
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs text-white/28">
              Показано{' '}
              <span className="font-bold text-orange-400">{candidates.length}</span>
              {' '}из{' '}
              <span className="font-bold text-white/50">{stats.total}</span>
              {' '}кандидатов
            </p>
            <div className="flex items-center gap-1.5 text-xs text-white/30">
              <ArrowUpDown size={11} />
              <span>{sortBy === 'date' ? 'По дате' : sortBy === 'score' ? 'По скору' : 'По имени'}</span>
            </div>
          </div>
        )}

        {/* Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={32} className="animate-spin text-orange-400" />
          </div>
        ) : !candidates.length ? (
          <div className="card text-center py-16">
            <div className="inline-flex items-center justify-center mb-4 w-16 h-16 bg-orange-500/[0.08] border border-orange-500/15 rounded-[18px]">
              <Users size={28} className="text-orange-500/40" />
            </div>
            <p className="text-white font-semibold text-lg mb-1">Кандидаты не найдены</p>
            <p className="text-sm text-white/30 mb-4">Попробуйте изменить фильтры или добавить кандидатов через форму</p>
            {activeFilters.length > 0 && (
              <button
                className="btn-secondary text-sm"
                onClick={() => { setSearch(''); setStatusFilter('all'); setVacancyFilter('all'); }}
              >
                <X size={13} />
                Сбросить фильтры
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {candidates.map((c, idx) => (
              <CandidateGlobalCard
                key={c.id}
                candidate={c}
                index={idx}
                selected={selectedIds.has(c.id)}
                onToggleSelect={() => toggleSelect(c.id)}
                onClick={() => navigate(`/candidates/${c.id}`)}
              />
            ))}
          </div>
        )}
      </motion.div>
    </Layout>
  );
}

/* ─── CANDIDATE GLOBAL CARD ─── */

function CandidateGlobalCard({
  candidate: c,
  index,
  selected,
  onToggleSelect,
  onClick,
}: {
  candidate: GlobalCandidate;
  index: number;
  selected: boolean;
  onToggleSelect: () => void;
  onClick: () => void;
}) {
  const analysis = c.ai_analysis;
  const [g1, g2] = getAvatarGradient(c.full_name || '?');
  const initials = (c.full_name || '?').split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
  const vacBadgeClass = c.vacancies?.id ? getVacancyBadgeClass(c.vacancies.id) : '';

  // Skill preview from analysis strengths
  const skillPreview: string[] = analysis?.strengths?.slice(0, 2) || [];

  return (
    <div
      className={`card stagger-item flex flex-col gap-3 cursor-pointer candidate-global-card ${
        selected ? 'border-orange-500/40 ring-1 ring-orange-500/20' : analysis ? 'border-orange-500/[0.18]' : 'border-orange-500/10'
      }`}
      style={{ animationDelay: `${index * 0.04}s` }}
      onClick={onClick}
    >
      {/* Top row: avatar + name + score ring */}
      <div className="flex items-start gap-3">
        {/* Select checkbox area */}
        <button
          className={`shrink-0 w-5 h-5 rounded border-2 mt-3 flex items-center justify-center transition-all ${
            selected
              ? 'bg-orange-500 border-orange-500 text-white'
              : 'border-white/20 bg-transparent hover:border-orange-400/50'
          }`}
          onClick={(e) => { e.stopPropagation(); onToggleSelect(); }}
        >
          {selected && <CheckCircle2 size={12} />}
        </button>

        {/* Avatar */}
        <div
          className="avatar-circle w-11 h-11 text-[0.9375rem] shrink-0"
          style={{
            background: `linear-gradient(135deg, ${g1}, ${g2})`,
            boxShadow: `0 3px 12px ${g1}44`,
          }}
        >
          {initials}
        </div>

        {/* Name + vacancy */}
        <div className="flex-1 min-w-0">
          <p className="font-bold text-white truncate mb-1">{c.full_name}</p>
          {c.vacancies && (
            <div className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-semibold border ${vacBadgeClass}`}>
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
        <div className="flex items-center gap-2 text-xs text-white/38">
          <Mail size={11} />
          <span className="truncate">{c.email}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-white/38">
          <Calendar size={11} />
          <span>{formatDate(c.submitted_at)}</span>
          {c.resume_text && (
            <>
              <span className="text-white/15">·</span>
              <FileText size={10} className="text-emerald-500/60" />
              <span className="text-emerald-500/60">Резюме</span>
            </>
          )}
        </div>
      </div>

      {/* Score bar + summary */}
      {analysis && (
        <>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-white/35">AI-оценка</span>
              <span className="text-xs font-bold text-orange-400">{analysis.overall_score}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-neutral-800 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-1000 ${getScoreBarClass(analysis.overall_score)}`}
                style={{ width: `${analysis.overall_score}%` }}
              />
            </div>
          </div>
          {analysis.summary && (
            <p className="text-xs leading-relaxed line-clamp-2 text-white/45">
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
        <div className="flex items-center gap-1.5 text-xs text-white/20">
          <BrainCircuit size={11} />
          Ожидает анализа
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-auto pt-2 border-t border-orange-500/[0.07]">
        <span className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-semibold bg-black/25 ${getStatusColor(c.status)}`}>
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
