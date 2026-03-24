import { useState, useMemo, useEffect, useCallback, KeyboardEvent as ReactKeyboardEvent } from 'react';
import { usePageTitle } from '../utils/usePageTitle';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  PlusIcon, BriefcaseIcon, Users, Trash2, Link2, Plus, X, Check, Sparkles,
  LayoutGrid, List, Search, MapPin, Wifi, DollarSign, Eye, TrendingUp,
  PenLine, Film, Share2, Palette, Code, ChevronLeft, ChevronRight,
  type LucideIcon,
} from 'lucide-react';
import Layout from '../components/Layout';
import { vacanciesApi, candidatesApi } from '../utils/api';
import { Vacancy } from '../types';
import { formatDate } from '../utils/helpers';
import { pageVariants, staggerContainer, staggerItem, listSlide, fadeOverlay, scaleUp } from '../utils/animations';

type TabKey = 'all' | 'active' | 'paused' | 'closed';
type ViewMode = 'grid' | 'list';

interface CandidateCount {
  total: number;
  byStatus: Record<string, number>;
}

export default function VacanciesPage() {
  usePageTitle('Вакансии');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = (searchParams.get('tab') as TabKey) || 'all';
  const search = searchParams.get('q') || '';

  const setTab = (newTab: TabKey) => {
    setSearchParams(prev => {
      if (newTab === 'all') prev.delete('tab');
      else prev.set('tab', newTab);
      return prev;
    });
  };

  const setSearch = (value: string) => {
    setSearchParams(prev => {
      if (!value) prev.delete('q');
      else prev.set('q', value);
      return prev;
    });
  };
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  const { data, isLoading } = useQuery({
    queryKey: ['vacancies'],
    queryFn: () => vacanciesApi.list().then((r) => r.data.vacancies as Vacancy[]),
  });

  const { data: allCandidatesRaw } = useQuery({
    queryKey: ['candidates-counts'],
    queryFn: () => candidatesApi.listAll({}).then((r) => r.data.candidates),
    staleTime: 60_000,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => vacanciesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vacancies'] });
      toast.success('Вакансия удалена');
    },
  });

  // Keyboard shortcut: Cmd+K to focus search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        const el = document.getElementById('vacancies-search');
        if (el) el.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Build candidate count map per vacancy
  const candidateCounts = useMemo(() => {
    const map: Record<string, CandidateCount> = {};
    (allCandidatesRaw || []).forEach((c: { vacancies?: { id: string }; status: string }) => {
      const vid = c.vacancies?.id;
      if (!vid) return;
      if (!map[vid]) map[vid] = { total: 0, byStatus: {} };
      map[vid].total++;
      map[vid].byStatus[c.status] = (map[vid].byStatus[c.status] || 0) + 1;
    });
    return map;
  }, [allCandidatesRaw]);

  const vacancies = data || [];


  const totalCandidates = useMemo(() => {
    return (allCandidatesRaw || []).length;
  }, [allCandidatesRaw]);

  const tabCounts = useMemo(() => ({
    all: vacancies.length,
    active: vacancies.filter((v) => v.status === 'active').length,
    paused: vacancies.filter((v) => v.status === 'paused').length,
    closed: vacancies.filter((v) => v.status === 'closed').length,
  }), [vacancies]);

  const activeCount = tabCounts.active;

  const filtered = useMemo(() => {
    let list = vacancies;
    if (tab !== 'all') list = list.filter((v) => v.status === tab);
    if (search.trim()) {
      const s = search.toLowerCase();
      list = list.filter((v) => v.title.toLowerCase().includes(s));
    }
    return list;
  }, [vacancies, tab, search]);

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'all', label: 'Все' },
    { key: 'active', label: 'Активные' },
    { key: 'paused', label: 'Пауза' },
    { key: 'closed', label: 'Закрытые' },
  ];

  return (
    <Layout>
      <motion.div
        className="p-4 sm:p-6 md:p-8 page-content"
        variants={pageVariants}
        initial="initial"
        animate="animate"
      >
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-white tracking-wider">ВАКАНСИИ</h1>
            <div className="h-px w-16 mt-2 bg-gradient-to-r from-orange-500 to-transparent rounded-full" />
            {/* Stat badges bar */}
            <div className="flex items-center gap-2.5 mt-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-white/[0.02] border border-white/[0.06] text-neutral-300">
                <BriefcaseIcon size={11} className="text-neutral-500" />
                {vacancies.length} вакансий
              </span>
              {activeCount > 0 && (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  <TrendingUp size={11} />
                  {activeCount} активных
                </span>
              )}
              {totalCandidates > 0 && (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400">
                  <Users size={11} />
                  {totalCandidates} кандидат{totalCandidates === 1 ? '' : totalCandidates < 5 ? 'а' : 'ов'}
                </span>
              )}
            </div>
          </div>
          <button
            className="btn-primary shrink-0"
            onClick={() => setShowCreate(true)}
          >
            <PlusIcon size={16} />
            Новая вакансия
          </button>
        </div>

        {/* Toolbar */}
        {vacancies.length > 0 && (
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            {/* Search */}
            <div className="relative flex-1 max-w-sm">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-500"
              />
              <input
                id="vacancies-search"
                type="text"
                placeholder="Поиск по вакансиям..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input pl-9 pr-16 text-sm"
              />
              <kbd className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-white/[0.02] border border-white/[0.06] text-[10px] font-mono text-white/40">
                ⌘K
              </kbd>
            </div>

            <div className="flex items-center gap-3 ml-auto">
              {/* Tabs */}
              <div className="tab-bar overflow-x-auto">
                {tabs.map(({ key, label }) => (
                  <button
                    key={key}
                    className={`tab-bar-item ${tab === key ? 'active' : ''}`}
                    onClick={() => setTab(key)}
                  >
                    {label}
                    <span className="tab-count">{tabCounts[key]}</span>
                  </button>
                ))}
              </div>

              {/* View toggle */}
              <div className="view-toggle">
                <button
                  className={`view-toggle-btn ${viewMode === 'grid' ? 'active' : ''}`}
                  onClick={() => setViewMode('grid')}
                  title="Сетка"
                >
                  <LayoutGrid size={15} />
                </button>
                <button
                  className={`view-toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
                  onClick={() => setViewMode('list')}
                  title="Список"
                >
                  <List size={15} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton h-56 rounded-2xl" />
            ))}
          </div>
        ) : !vacancies.length ? (
          <EmptyState onCreateClick={() => setShowCreate(true)} />
        ) : !filtered.length ? (
          <div className="card text-center py-16">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-2xl mb-4">
              <Search size={28} className="text-neutral-500" />
            </div>
            <p className="text-white font-semibold mb-1">Ничего не найдено</p>
            <p className="text-sm text-neutral-500 max-w-xs mx-auto">
              Попробуйте изменить фильтры или поисковый запрос
            </p>
          </div>
        ) : viewMode === 'grid' ? (
          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5"
            variants={staggerContainer}
            initial="initial"
            animate="animate"
          >
            {filtered.map((vacancy) => (
              <motion.div
                key={vacancy.id}
                variants={staggerItem}
                whileHover={{ scale: 1.02, y: -4 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              >
                <VacancyCard
                  vacancy={vacancy}
                  counts={candidateCounts[vacancy.id]}
                  onOpen={() => navigate(`/vacancies/${vacancy.id}`)}
                  onDelete={() => {
                    if (confirm('Удалить вакансию?')) deleteMutation.mutate(vacancy.id);
                  }}
                />
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <motion.div
            className="space-y-0 rounded-xl overflow-hidden border border-white/[0.06]"
            variants={staggerContainer}
            initial="initial"
            animate="animate"
          >
            {filtered.map((vacancy, index) => (
              <motion.div key={vacancy.id} variants={listSlide}>
                <VacancyListRow
                  vacancy={vacancy}
                  counts={candidateCounts[vacancy.id]}
                  index={index}
                  onOpen={() => navigate(`/vacancies/${vacancy.id}`)}
                  onDelete={() => {
                    if (confirm('Удалить вакансию?')) deleteMutation.mutate(vacancy.id);
                  }}
                />
              </motion.div>
            ))}
          </motion.div>
        )}
      </motion.div>

      <AnimatePresence>
        {showCreate && <CreateVacancyModal onClose={() => setShowCreate(false)} />}
      </AnimatePresence>
    </Layout>
  );
}

/* ─── EMPTY STATE ─── */

function EmptyState({ onCreateClick }: { onCreateClick: () => void }) {
  return (
    <div className="text-center py-24 sm:py-28 bg-white/[0.03] backdrop-blur-xl border border-dashed border-white/[0.06] rounded-xl">
      <motion.div
        className="inline-flex items-center justify-center w-24 h-24 bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-3xl mb-8"
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      >
        <BriefcaseIcon size={44} className="text-orange-500/60" />
      </motion.div>
      <h3 className="text-xl font-bold text-white mb-3">Начните с первой вакансии</h3>
      <p className="text-sm mb-10 max-w-sm mx-auto text-white/40 leading-relaxed">
        Создайте вакансию — получите уникальную ссылку и начните принимать заявки прямо сейчас
      </p>
      <button className="btn-primary px-8 py-3" onClick={onCreateClick}>
        <Sparkles size={16} />
        Создать вакансию
      </button>
    </div>
  );
}

/* ─── STATUS CONFIG ─── */

const statusConfig = {
  active: { label: 'АКТИВНА', cls: 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/30', dot: 'status-dot status-dot-active', accent: 'border-l-emerald-500/50' },
  paused: { label: 'ПАУЗА', cls: 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/30', dot: 'status-dot status-dot-paused', accent: 'border-l-yellow-500/50' },
  closed: { label: 'ЗАКРЫТА', cls: 'bg-neutral-500/20 text-white/60 border border-neutral-600', dot: 'status-dot status-dot-closed', accent: 'border-l-neutral-600' },
};

const statusColors: Record<string, string> = {
  new: '#6b7280',
  analyzing: '#60a5fa',
  analyzed: '#fb923c',
  invited: '#10b981',
  rejected: '#f87171',
  error: '#f87171',
};

/* ─── VACANCY CARD (grid) ─── */

function VacancyCard({
  vacancy,
  onOpen,
  onDelete,
  counts,
}: {
  vacancy: Vacancy;
  onOpen: () => void;
  onDelete: () => void;
  counts?: CandidateCount;
}) {
  const [copied, setCopied] = useState(false);
  const publicLink = `${window.location.origin}/apply/${vacancy.id}`;
  const st = statusConfig[vacancy.status as keyof typeof statusConfig] || statusConfig.closed;

  const copyLink = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(publicLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const skills: string[] =
    (((vacancy.requirements as unknown) as Record<string, unknown>)?.hard_skills as string[]) || [];
  const questions: string[] =
    (((vacancy.requirements as unknown) as Record<string, unknown>)?.custom_questions as string[]) || [];
  const salary = vacancy.salary_range;

  // Progress bar segments
  const total = counts?.total || 0;
  const segments = total > 0
    ? Object.entries(counts?.byStatus || {}).map(([status, count]) => ({
        status,
        pct: (count / total) * 100,
        color: statusColors[status] || '#6b7280',
      }))
    : [];

  return (
    <div
      className={`bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] border-l-2 ${st.accent} rounded-2xl p-4 sm:p-5 flex flex-col hover:border-[rgba(232,114,28,0.15)] hover:shadow-lg hover:shadow-black/20 hover:bg-white/[0.02] transition-all duration-200 cursor-pointer overflow-hidden min-h-[240px]`}
      onClick={onOpen}
    >
      {/* Top row: status + candidate count */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={st.dot} />
          <span className={`px-2.5 py-1 rounded text-xs font-bold tracking-wider ${st.cls}`}>
            {st.label}
          </span>
          {vacancy.remote && (
            <span className="text-xs px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
              <Wifi size={9} className="inline mr-1" />Remote
            </span>
          )}
        </div>
        {total > 0 && (
          <span className="text-xs font-bold font-mono px-2.5 py-1 rounded bg-orange-500/20 text-orange-400 border border-orange-500/30">
            {total} кандидат{total === 1 ? '' : total < 5 ? 'а' : 'ов'}
          </span>
        )}
      </div>

      {/* Title + date */}
      <div className="mb-3">
        <h3 className="text-base font-semibold text-white tracking-wide leading-tight mb-1 truncate">
          {vacancy.title}
        </h3>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-white/40 font-mono">
            {formatDate(vacancy.created_at)}
          </span>
          {vacancy.location && (
            <span className="flex items-center gap-1 text-xs text-white/40">
              <MapPin size={9} />
              {vacancy.location}
            </span>
          )}
          {salary && (
            <span className="text-xs px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-500 border border-yellow-500/30">
              <DollarSign size={9} className="inline" />
              {salary.min.toLocaleString()}–{salary.max.toLocaleString()}
            </span>
          )}
        </div>
      </div>

      {/* Description */}
      {vacancy.description && (
        <p className="text-xs mb-3 line-clamp-2 leading-relaxed text-white/60 break-words overflow-hidden">
          {vacancy.description}
        </p>
      )}

      {/* Skills */}
      {skills.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {skills.slice(0, 4).map((skill) => (
            <span key={skill} className="skill-tag">{skill}</span>
          ))}
          {skills.length > 4 && (
            <span className="skill-tag opacity-50">+{skills.length - 4}</span>
          )}
        </div>
      )}

      {questions.length > 0 && (
        <p className="text-xs mb-3 text-white/25">
          {questions.length} вопрос{questions.length === 1 ? '' : questions.length < 5 ? 'а' : 'ов'} в анкете
        </p>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Candidate progress bar */}
      {segments.length > 0 && (
        <div className="mb-3">
          <div className="progress-track mb-1.5">
            {segments.map(({ status, pct, color }) => (
              <div
                key={status}
                className="progress-segment"
                style={{ width: `${pct}%`, background: color }}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {segments.map(({ status, pct, color }) => (
              <span key={status} className="flex items-center gap-1 text-xs text-white/40">
                <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: color }} />
                {Math.round(pct)}%
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center gap-2 pt-3 border-t border-white/[0.04]" onClick={(e) => e.stopPropagation()}>
        <button
          className="btn-primary flex-1 justify-center md:hidden text-xs py-2"
          onClick={(e) => { e.stopPropagation(); onOpen(); }}
        >
          <Eye size={13} />
          Открыть
        </button>
        <button
          onClick={copyLink}
          className={`copy-btn ${copied ? 'copy-btn-success' : 'copy-btn-idle'}`}
        >
          {copied ? <><Check size={11} />Скоп.</> : <><Link2 size={11} />Копировать</>}
        </button>
        <button
          className="text-white/25 hover:text-red-400 transition-colors p-1 md:hidden"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}

/* ─── VACANCY LIST ROW ─── */

function VacancyListRow({
  vacancy,
  onOpen,
  onDelete,
  counts,
  index,
}: {
  vacancy: Vacancy;
  onOpen: () => void;
  onDelete: () => void;
  counts?: CandidateCount;
  index: number;
}) {
  const [copied, setCopied] = useState(false);
  const st = statusConfig[vacancy.status as keyof typeof statusConfig] || statusConfig.closed;
  const skills: string[] =
    (((vacancy.requirements as unknown) as Record<string, unknown>)?.hard_skills as string[]) || [];
  const salary = vacancy.salary_range;
  const total = counts?.total || 0;
  const isEven = index % 2 === 0;

  const copyLink = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(`${window.location.origin}/apply/${vacancy.id}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={`flex items-center gap-4 p-4 border-b border-white/[0.04] last:border-b-0 hover:bg-white/[0.04] transition-colors cursor-pointer ${isEven ? 'bg-white/[0.03]' : 'bg-white/[0.02]'}`}
      onClick={onOpen}
    >
      {/* Status dot */}
      <div className={`${st.dot} shrink-0`} />

      {/* Title + meta */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className="text-base font-semibold text-white tracking-wide">{vacancy.title}</span>
          <span className={`px-2 py-0.5 rounded text-xs font-bold tracking-wider ${st.cls}`}>
            {st.label}
          </span>
          {vacancy.remote && <span className="text-xs px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30"><Wifi size={9} className="inline mr-1" />Remote</span>}
          {salary && <span className="text-xs px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-500 border border-yellow-500/30"><DollarSign size={9} className="inline" />{salary.min.toLocaleString()}–{salary.max.toLocaleString()}</span>}
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {skills.slice(0, 3).map((s) => <span key={s} className="skill-tag">{s}</span>)}
          {vacancy.location && (
            <span className="flex items-center gap-1 text-xs text-white/40">
              <MapPin size={9} />{vacancy.location}
            </span>
          )}
        </div>
      </div>

      {/* Candidates count */}
      {total > 0 && (
        <div className="flex items-center gap-1.5 shrink-0">
          <Users size={13} className="text-orange-400" />
          <span className="text-sm font-bold font-mono text-orange-400">{total}</span>
        </div>
      )}

      {/* Date */}
      <span className="text-xs font-mono shrink-0 hidden sm:block text-white/40">
        {formatDate(vacancy.created_at)}
      </span>

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
        <button
          className={`copy-btn ${copied ? 'copy-btn-success' : 'copy-btn-idle'}`}
          onClick={copyLink}
        >
          {copied ? <Check size={11} /> : <Link2 size={11} />}
        </button>
        <button
          className="text-white/25 hover:text-red-400 transition-colors p-1"
          onClick={() => onDelete()}
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

/* ─── TEMPLATES ─── */

interface TemplateData {
  title: string;
  description: string;
  hard_skills: string;
  soft_skills: string;
  experience_years: string;
  location: string;
  remote: boolean;
}

interface Template {
  id: string;
  label: string;
  icon: string;
  desc: string;
  data?: TemplateData;
}

const TEMPLATES: Template[] = [
  { id: 'custom', label: 'Своя вакансия', icon: 'PenLine', desc: 'Заполните всё вручную' },
  { id: 'video', label: 'Видеомонтажёр', icon: 'Film', desc: 'CapCut, Premiere, After Effects',
    data: { title: 'Видеомонтажёр / Рилсмейкер', description: 'Монтаж коротких видео для социальных сетей (Reels, TikTok, YouTube Shorts). Работа с CapCut, Premiere Pro. Креативный подход к визуальному контенту.',
      hard_skills: 'CapCut,Premiere Pro,After Effects,DaVinci Resolve,Цветокоррекция,Motion Graphics',
      soft_skills: 'Креативность,Внимание к деталям,Работа в сроках', experience_years: '1', location: '', remote: true }},
  { id: 'smm', label: 'SMM менеджер', icon: 'Share2', desc: 'Контент, соцсети, аналитика',
    data: { title: 'SMM менеджер', description: 'Ведение социальных сетей компании, создание контент-плана, работа с таргетированной рекламой, аналитика и отчётность.',
      hard_skills: 'Instagram,TikTok,Facebook Ads,Canva,Copywriting,Аналитика',
      soft_skills: 'Коммуникабельность,Креативность,Самоорганизация', experience_years: '1', location: '', remote: true }},
  { id: 'designer', label: 'Дизайнер', icon: 'Palette', desc: 'UI/UX, Figma, графика',
    data: { title: 'UI/UX Дизайнер', description: 'Дизайн интерфейсов веб и мобильных приложений. Создание дизайн-систем, прототипирование, работа с командой разработки.',
      hard_skills: 'Figma,Adobe Photoshop,Adobe Illustrator,UI/UX,Прототипирование,Дизайн-системы',
      soft_skills: 'Визуальное мышление,Внимание к деталям,Командная работа', experience_years: '2', location: '', remote: true }},
  { id: 'developer', label: 'Разработчик', icon: 'Code', desc: 'Frontend, Backend, Fullstack',
    data: { title: 'Fullstack разработчик', description: 'Разработка и поддержка веб-приложений. Работа с современным стеком технологий, участие в code review, написание тестов.',
      hard_skills: 'JavaScript,TypeScript,React,Node.js,PostgreSQL,Git',
      soft_skills: 'Аналитическое мышление,Командная работа,Обучаемость', experience_years: '2', location: '', remote: true }},
  { id: 'manager', label: 'Менеджер', icon: 'Users', desc: 'Продажи, проекты, операции',
    data: { title: 'Менеджер проектов', description: 'Управление проектами от планирования до запуска. Координация команды, контроль сроков и бюджета, коммуникация с заказчиками.',
      hard_skills: 'Jira,Trello,MS Office,Бюджетирование,Agile/Scrum',
      soft_skills: 'Лидерство,Коммуникация,Организованность,Стрессоустойчивость', experience_years: '3', location: '', remote: false }},
];

const TEMPLATE_ICONS: Record<string, LucideIcon> = {
  PenLine, Film, Share2, Palette, Code, Users,
};

const CURRENCIES = ['USD', 'UZS', 'RUB', 'EUR'] as const;
type Currency = typeof CURRENCIES[number];

/* ─── TAG INPUT COMPONENT ─── */

function TagInput({
  tags,
  onChange,
  placeholder,
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
}) {
  const [input, setInput] = useState('');

  const addTag = useCallback((value: string) => {
    const trimmed = value.trim();
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed]);
    }
    setInput('');
  }, [tags, onChange]);

  const handleKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(input);
    }
    if (e.key === 'Backspace' && !input && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  };

  const removeTag = (index: number) => {
    onChange(tags.filter((_, i) => i !== index));
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5 p-2 rounded-lg bg-white/[0.03] border border-white/[0.06] focus-within:border-orange-500/50 transition-colors min-h-[42px]">
      {tags.map((tag, i) => (
        <span
          key={`${tag}-${i}`}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-orange-500/15 text-orange-400 border border-orange-500/30"
        >
          {tag}
          <button
            type="button"
            onClick={() => removeTag(i)}
            className="hover:text-red-400 transition-colors ml-0.5"
          >
            <X size={11} />
          </button>
        </span>
      ))}
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => { if (input.trim()) addTag(input); }}
        placeholder={tags.length === 0 ? placeholder : 'Добавить...'}
        className="flex-1 min-w-[120px] bg-transparent border-none outline-none text-sm text-white placeholder-white/25 py-1 px-1"
      />
    </div>
  );
}

/* ─── CREATE VACANCY MODAL (redesigned with templates + steps) ─── */

function CreateVacancyModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('custom');
  const [questions, setQuestions] = useState<string[]>(['']);
  const [hardSkillTags, setHardSkillTags] = useState<string[]>([]);
  const [softSkillTags, setSoftSkillTags] = useState<string[]>([]);
  const [currency, setCurrency] = useState<Currency>('USD');
  const [negotiable, setNegotiable] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    experience_years: '2',
    location: '',
    remote: false,
    salary_min: '',
    salary_max: '',
  });

  const [salaryRec, setSalaryRec] = useState<{ min: number; max: number; note: string } | null>(null);

  const selectTemplate = (templateId: string) => {
    setSelectedTemplate(templateId);
    const tpl = TEMPLATES.find((t) => t.id === templateId);
    if (tpl?.data) {
      setForm({
        title: tpl.data.title,
        description: tpl.data.description,
        experience_years: tpl.data.experience_years,
        location: tpl.data.location,
        remote: tpl.data.remote,
        salary_min: '',
        salary_max: '',
      });
      setHardSkillTags(tpl.data.hard_skills.split(',').map((s) => s.trim()).filter(Boolean));
      setSoftSkillTags(tpl.data.soft_skills.split(',').map((s) => s.trim()).filter(Boolean));
    } else if (templateId === 'custom') {
      setForm({
        title: '',
        description: '',
        experience_years: '2',
        location: '',
        remote: false,
        salary_min: '',
        salary_max: '',
      });
      setHardSkillTags([]);
      setSoftSkillTags([]);
    }
  };

  const getSalaryRec = () => {
    const skills = hardSkillTags.length;
    const exp = parseInt(form.experience_years) || 0;
    const base = 1500 + exp * 250 + skills * 120;
    const max = Math.round(base * 1.38 / 100) * 100;
    const note =
      exp >= 5 ? 'Senior-уровень, высокая конкуренция за кандидатов' :
      exp >= 3 ? 'Middle-уровень, средний рыночный диапазон' :
      'Junior-уровень, стартовая позиция';
    setSalaryRec({ min: base, max, note });
    if (!form.salary_min) setForm((f) => ({ ...f, salary_min: String(base), salary_max: String(max) }));
  };

  const addQuestion = () => setQuestions([...questions, '']);
  const removeQuestion = (i: number) => setQuestions(questions.filter((_, idx) => idx !== i));
  const updateQuestion = (i: number, val: string) => {
    const q = [...questions];
    q[i] = val;
    setQuestions(q);
  };

  const canProceedToStep2 = form.title.trim().length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title) { toast.error('Введите название вакансии'); return; }
    setLoading(true);
    try {
      const validQuestions = questions.filter((q) => q.trim());
      const salaryRange = (!negotiable && form.salary_min)
        ? { min: parseInt(form.salary_min), max: parseInt(form.salary_max || form.salary_min), currency }
        : undefined;
      const res = await vacanciesApi.create({
        title: form.title,
        description: form.description,
        location: form.location,
        remote: form.remote,
        salary_range: salaryRange,
        requirements: {
          hard_skills: hardSkillTags,
          soft_skills: softSkillTags,
          experience_years: parseInt(form.experience_years),
          custom_questions: validQuestions,
        },
      });
      queryClient.invalidateQueries({ queryKey: ['vacancies'] });
      toast.success('Вакансия создана!');
      onClose();
      navigate(`/vacancies/${res.data.vacancy.id}`);
    } catch {
      toast.error('Ошибка при создании вакансии');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      className="modal-overlay"
      variants={fadeOverlay}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      <motion.div
        className="modal-content max-w-[720px] max-h-[90vh] overflow-y-auto"
        variants={scaleUp}
        initial="initial"
        animate="animate"
        exit="exit"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-7 py-5 border-b border-white/[0.04] bg-white/[0.02]">
          <div>
            <h3 className="text-lg font-bold text-white tracking-wider">НОВАЯ ВАКАНСИЯ</h3>
            <p className="text-xs mt-0.5 text-white/40">
              {step === 1 ? 'Выберите шаблон и заполните основное' : 'Укажите требования и детали'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-lg bg-white/[0.02] border border-white/[0.06] text-white/60 hover:bg-red-500/10 hover:text-red-400 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Progress indicator */}
        <div className="px-5 sm:px-7 pt-5">
          <div className="flex items-center gap-3 mb-5">
            <div className="flex items-center gap-2 flex-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                step >= 1 ? 'bg-orange-500 text-white' : 'bg-white/[0.02] text-white/40 border border-white/[0.06]'
              }`}>
                1
              </div>
              <span className={`text-xs font-medium ${step >= 1 ? 'text-white' : 'text-white/40'}`}>
                Основное
              </span>
            </div>
            <div className={`flex-1 h-px transition-colors ${step >= 2 ? 'bg-orange-500' : 'bg-white/[0.06]'}`} />
            <div className="flex items-center gap-2 flex-1 justify-end">
              <span className={`text-xs font-medium ${step >= 2 ? 'text-white' : 'text-white/40'}`}>
                Требования
              </span>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                step >= 2 ? 'bg-orange-500 text-white' : 'bg-white/[0.02] text-white/40 border border-white/[0.06]'
              }`}>
                2
              </div>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="px-5 sm:px-7 pb-6">
          {/* ─── STEP 1: Template + Basic Info ─── */}
          {step === 1 && (
            <div>
              {/* Template selector */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-bold tracking-wider text-white/60 uppercase">Шаблон</span>
                  <div className="flex-1 h-px bg-white/[0.04]" />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {TEMPLATES.map((tpl) => {
                    const IconComp = TEMPLATE_ICONS[tpl.icon];
                    const isSelected = selectedTemplate === tpl.id;
                    return (
                      <button
                        key={tpl.id}
                        type="button"
                        onClick={() => selectTemplate(tpl.id)}
                        className={`flex flex-col items-center gap-2 p-3.5 rounded-xl border-2 transition-all duration-200 text-center ${
                          isSelected
                            ? 'border-orange-500 bg-orange-500/10'
                            : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.1] hover:bg-white/[0.04]'
                        }`}
                      >
                        {IconComp && (
                          <IconComp
                            size={22}
                            className={isSelected ? 'text-orange-400' : 'text-white/40'}
                          />
                        )}
                        <div>
                          <p className={`text-sm font-semibold ${isSelected ? 'text-orange-400' : 'text-white'}`}>
                            {tpl.label}
                          </p>
                          <p className="text-xs text-neutral-500 mt-0.5 leading-tight">
                            {tpl.desc}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Basic info fields */}
              <div className="space-y-4 mb-6">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold tracking-wider text-white/60 uppercase">Основное</span>
                  <div className="flex-1 h-px bg-white/[0.04]" />
                </div>
                <div>
                  <label className="label">Название позиции *</label>
                  <input
                    className="input"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="Senior Backend Developer"
                    required
                  />
                </div>
                <div>
                  <label className="label">Описание вакансии</label>
                  <textarea
                    className="input h-24 resize-none"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Чем занимается компания, чем будет заниматься сотрудник..."
                  />
                </div>
              </div>

              {/* Step 1 actions */}
              <div className="flex gap-3 pt-4 border-t border-white/[0.04]">
                <button type="button" className="btn-secondary flex-1 justify-center" onClick={onClose}>
                  Отмена
                </button>
                <button
                  type="button"
                  className="btn-primary flex-1 justify-center"
                  disabled={!canProceedToStep2}
                  onClick={() => setStep(2)}
                >
                  Далее
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* ─── STEP 2: Requirements + Details ─── */}
          {step === 2 && (
            <div>
              {/* Skills & Experience */}
              <div className="space-y-4 mb-6">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold tracking-wider text-white/60 uppercase">Навыки и опыт</span>
                  <div className="flex-1 h-px bg-white/[0.04]" />
                </div>
                <div>
                  <label className="label">Технические навыки</label>
                  <TagInput
                    tags={hardSkillTags}
                    onChange={setHardSkillTags}
                    placeholder="Введите навык и нажмите Enter"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="label">Soft Skills</label>
                    <TagInput
                      tags={softSkillTags}
                      onChange={setSoftSkillTags}
                      placeholder="Teamwork, Leadership..."
                    />
                  </div>
                  <div>
                    <label className="label">Опыт (лет)</label>
                    <input
                      type="number"
                      className="input"
                      value={form.experience_years}
                      onChange={(e) => setForm({ ...form, experience_years: e.target.value })}
                      min="0"
                      max="20"
                    />
                  </div>
                </div>
              </div>

              {/* Location & Salary */}
              <div className="space-y-4 mb-6">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold tracking-wider text-white/60 uppercase">Локация и зарплата</span>
                  <div className="flex-1 h-px bg-white/[0.04]" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="label">Город</label>
                    <input
                      className="input"
                      value={form.location}
                      onChange={(e) => setForm({ ...form, location: e.target.value })}
                      placeholder="Ташкент"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="label mb-0">Зарплата</label>
                      <button
                        type="button"
                        onClick={getSalaryRec}
                        className="flex items-center gap-1 text-xs font-semibold text-orange-400"
                      >
                        <Sparkles size={12} />AI рекомендация
                      </button>
                    </div>

                    {/* Negotiable checkbox */}
                    <label className="flex items-center gap-2 cursor-pointer mb-2">
                      <input
                        type="checkbox"
                        checked={negotiable}
                        onChange={(e) => {
                          setNegotiable(e.target.checked);
                          if (e.target.checked) {
                            setForm((f) => ({ ...f, salary_min: '', salary_max: '' }));
                            setSalaryRec(null);
                          }
                        }}
                        className="w-4 h-4 rounded accent-orange-500"
                      />
                      <span className="text-xs text-white/60">Договорная</span>
                    </label>

                    {!negotiable && (
                      <>
                        {salaryRec && (
                          <div className="mb-2 p-3 rounded-lg text-xs space-y-0.5 bg-emerald-500/10 border border-emerald-500/20">
                            <p className="font-bold text-emerald-400 font-mono">
                              AI: ${salaryRec.min.toLocaleString()} – ${salaryRec.max.toLocaleString()} {currency}
                            </p>
                            <p className="text-white/60">{salaryRec.note}</p>
                          </div>
                        )}
                        <div className="flex gap-2">
                          <input
                            type="number"
                            className="input flex-1"
                            placeholder="мин"
                            value={form.salary_min}
                            onChange={(e) => setForm({ ...form, salary_min: e.target.value })}
                          />
                          <input
                            type="number"
                            className="input flex-1"
                            placeholder="макс"
                            value={form.salary_max}
                            onChange={(e) => setForm({ ...form, salary_max: e.target.value })}
                          />
                          <select
                            value={currency}
                            onChange={(e) => setCurrency(e.target.value as Currency)}
                            className="select-premium w-20 text-sm"
                          >
                            {CURRENCIES.map((c) => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </select>
                        </div>
                      </>
                    )}
                  </div>
                </div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.remote}
                    onChange={(e) => setForm({ ...form, remote: e.target.checked })}
                    className="w-5 h-5 rounded accent-orange-500"
                  />
                  <span className="text-sm text-white">Удалённая работа</span>
                </label>
              </div>

              {/* Custom Questions */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-bold tracking-wider text-white/60 uppercase">Анкета</span>
                  <div className="flex-1 h-px bg-white/[0.04]" />
                </div>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <label className="label mb-0">Вопросы в анкете</label>
                    <p className="text-xs mt-0.5 text-white/25">Кандидаты ответят при подаче заявки</p>
                  </div>
                  <button
                    type="button"
                    onClick={addQuestion}
                    className="flex items-center gap-1.5 text-xs font-semibold text-orange-400"
                  >
                    <Plus size={13} />Добавить
                  </button>
                </div>
                <div className="space-y-2">
                  {questions.map((q, i) => (
                    <div key={i} className="flex gap-2">
                      <input
                        className="input flex-1 text-sm"
                        value={q}
                        onChange={(e) => updateQuestion(i, e.target.value)}
                        placeholder={
                          i === 0 ? 'Почему вы хотите работать у нас?' :
                          i === 1 ? 'Опишите ваш самый сложный проект' :
                          'Ваш вопрос...'
                        }
                      />
                      {questions.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeQuestion(i)}
                          className="text-white/25 hover:text-red-400 transition-colors"
                        >
                          <X size={15} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Step 2 actions */}
              <div className="flex gap-3 pt-4 border-t border-white/[0.04]">
                <button
                  type="button"
                  className="btn-secondary flex-1 justify-center"
                  onClick={() => setStep(1)}
                >
                  <ChevronLeft size={16} />
                  Назад
                </button>
                <button
                  type="submit"
                  className="btn-primary flex-1 justify-center"
                  disabled={loading}
                >
                  {loading ? 'Создание...' : 'Создать вакансию'}
                </button>
              </div>
            </div>
          )}
        </form>
      </motion.div>
    </motion.div>
  );
}
