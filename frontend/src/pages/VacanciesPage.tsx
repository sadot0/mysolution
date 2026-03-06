import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  PlusIcon, BriefcaseIcon, Users, Trash2, Link2, Plus, X, Check, Sparkles,
  LayoutGrid, List, Search, MapPin, Wifi, DollarSign, Eye,
} from 'lucide-react';
import Layout from '../components/Layout';
import { vacanciesApi, candidatesApi } from '../utils/api';
import { Vacancy } from '../types';
import { formatDate } from '../utils/helpers';

type TabKey = 'all' | 'active' | 'paused' | 'closed';
type ViewMode = 'grid' | 'list';

interface CandidateCount {
  total: number;
  byStatus: Record<string, number>;
}

export default function VacanciesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [tab, setTab] = useState<TabKey>('all');
  const [search, setSearch] = useState('');
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
      <div className="p-6 md:p-8 page-content">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h2
              className="text-gradient-animated font-black mb-1"
              style={{ fontSize: 'clamp(1.75rem, 4vw, 2.25rem)' }}
            >
              Вакансии
            </h2>
            <div className="flex items-center gap-2 text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>
              <span>{vacancies.length} вакансий</span>
              {activeCount > 0 && (
                <>
                  <span style={{ color: 'rgba(255,255,255,0.15)' }}>·</span>
                  <span style={{ color: '#10b981' }}>{activeCount} активных</span>
                </>
              )}
            </div>
          </div>
          <button
            className="btn-primary shrink-0"
            onClick={() => setShowCreate(true)}
            style={
              vacancies.length === 0
                ? { animation: 'statusPulse 2s ease-in-out infinite', boxShadow: '0 0 0 0 rgba(255,106,0,0.5)' }
                : undefined
            }
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
                className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                style={{ color: 'rgba(255,255,255,0.3)' }}
              />
              <input
                type="text"
                placeholder="Поиск по вакансиям..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input pl-9 text-sm"
              />
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
          <div className="card text-center py-12">
            <Search size={32} className="mx-auto mb-3" style={{ color: 'rgba(255,110,0,0.3)' }} />
            <p className="text-white font-semibold mb-1">Ничего не найдено</p>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>
              Попробуйте изменить фильтры или поисковый запрос
            </p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((vacancy, idx) => (
              <VacancyCard
                key={vacancy.id}
                vacancy={vacancy}
                index={idx}
                counts={candidateCounts[vacancy.id]}
                onOpen={() => navigate(`/vacancies/${vacancy.id}`)}
                onDelete={() => {
                  if (confirm('Удалить вакансию?')) deleteMutation.mutate(vacancy.id);
                }}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((vacancy, idx) => (
              <VacancyListRow
                key={vacancy.id}
                vacancy={vacancy}
                index={idx}
                counts={candidateCounts[vacancy.id]}
                onOpen={() => navigate(`/vacancies/${vacancy.id}`)}
                onDelete={() => {
                  if (confirm('Удалить вакансию?')) deleteMutation.mutate(vacancy.id);
                }}
              />
            ))}
          </div>
        )}
      </div>

      {showCreate && <CreateVacancyModal onClose={() => setShowCreate(false)} />}
    </Layout>
  );
}

/* ─── EMPTY STATE ─── */

function EmptyState({ onCreateClick }: { onCreateClick: () => void }) {
  return (
    <div
      className="text-center py-20 card"
      style={{ borderStyle: 'dashed', borderColor: 'rgba(255,110,0,0.18)' }}
    >
      {/* Animated icon */}
      <div className="relative inline-block mb-6">
        <div
          style={{
            width: 90,
            height: 90,
            background: 'rgba(255,110,0,0.06)',
            borderRadius: 24,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            animation: 'floatBig 3.5s ease-in-out infinite',
            border: '1px solid rgba(255,110,0,0.14)',
            position: 'relative',
          }}
        >
          <BriefcaseIcon size={38} style={{ color: 'rgba(255,110,0,0.55)' }} />
        </div>
        {/* Glow ring */}
        <div
          style={{
            position: 'absolute',
            inset: -8,
            border: '1px dashed rgba(255,110,0,0.18)',
            borderRadius: 32,
            animation: 'glowPulse 3s ease-in-out infinite',
            pointerEvents: 'none',
          }}
        />
      </div>
      <h3 className="text-xl font-black text-white mb-2">Начните с первой вакансии</h3>
      <p className="text-sm mb-8 max-w-xs mx-auto" style={{ color: 'rgba(255,255,255,0.35)', lineHeight: 1.7 }}>
        Создайте вакансию — получите уникальную ссылку и начните принимать заявки прямо сейчас
      </p>
      <button
        className="btn-primary"
        onClick={onCreateClick}
        style={{
          padding: '12px 28px',
          fontSize: '0.9375rem',
          boxShadow: '0 8px 32px rgba(255,106,0,0.45), 0 0 60px rgba(255,106,0,0.2)',
        }}
      >
        <Sparkles size={16} />
        Создать вакансию
      </button>
    </div>
  );
}

/* ─── STATUS CONFIG ─── */

const statusConfig = {
  active: { label: 'Активна', bg: 'rgba(16,185,129,0.12)', color: '#10b981', border: 'rgba(16,185,129,0.25)', dot: 'status-dot status-dot-active' },
  paused: { label: 'Пауза', bg: 'rgba(245,158,11,0.12)', color: '#fbbf24', border: 'rgba(245,158,11,0.25)', dot: 'status-dot status-dot-paused' },
  closed: { label: 'Закрыта', bg: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)', border: 'rgba(255,255,255,0.10)', dot: 'status-dot status-dot-closed' },
};

const statusColors: Record<string, string> = {
  new: '#6b7280',
  analyzing: '#60a5fa',
  analyzed: '#FF9A3C',
  invited: '#10b981',
  rejected: '#f87171',
  error: '#f87171',
};

/* ─── VACANCY CARD (grid) ─── */

function VacancyCard({
  vacancy,
  onOpen,
  onDelete,
  index,
  counts,
}: {
  vacancy: Vacancy;
  onOpen: () => void;
  onDelete: () => void;
  index: number;
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
      className="card card-hover stagger-item flex flex-col"
      style={{ animationDelay: `${index * 0.06}s`, minHeight: 260 }}
    >
      {/* Decorative corner glow */}
      <div
        style={{
          position: 'absolute', top: 0, right: 0,
          width: 100, height: 100,
          background: 'radial-gradient(circle at top right, rgba(255,106,0,0.12) 0%, transparent 70%)',
          borderRadius: '0 18px 0 0',
          pointerEvents: 'none',
        }}
      />

      {/* Hover reveal overlay */}
      <div className="hover-reveal" style={{ zIndex: 3 }}>
        <div className="flex gap-2">
          <button
            className="btn-primary flex-1 justify-center"
            style={{ padding: '8px 12px', fontSize: '0.8125rem' }}
            onClick={(e) => { e.stopPropagation(); onOpen(); }}
          >
            <Eye size={13} />
            Открыть
          </button>
          <button
            className="btn-secondary"
            style={{ padding: '8px 12px' }}
            onClick={(e) => { e.stopPropagation(); copyLink(e); }}
          >
            {copied ? <Check size={13} /> : <Link2 size={13} />}
          </button>
          <button
            className="btn-danger"
            style={{ padding: '8px 12px' }}
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Top row: status dot + badge + candidate count */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={st.dot} />
          <span
            className="px-2.5 py-1 rounded-full text-xs font-bold"
            style={{ background: st.bg, color: st.color, border: `1px solid ${st.border}` }}
          >
            {st.label}
          </span>
          {vacancy.remote && (
            <span className="glow-badge glow-badge-remote">
              <Wifi size={9} />
              Remote
            </span>
          )}
        </div>
        {total > 0 && (
          <span
            className="text-xs font-bold px-2.5 py-1 rounded-full"
            style={{
              background: 'rgba(255,110,0,0.12)',
              border: '1px solid rgba(255,110,0,0.22)',
              color: '#FF9A3C',
            }}
          >
            {total} кандидат{total === 1 ? '' : total < 5 ? 'а' : 'ов'}
          </span>
        )}
      </div>

      {/* Title + date */}
      <div className="mb-3 cursor-pointer" onClick={onOpen}>
        <h3 className="font-bold text-white text-base leading-tight mb-1 hover:text-orange-400 transition-colors">
          {vacancy.title}
        </h3>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.28)' }}>
            {formatDate(vacancy.created_at)}
          </span>
          {vacancy.location && (
            <span className="flex items-center gap-1 text-xs" style={{ color: 'rgba(255,255,255,0.28)' }}>
              <MapPin size={9} />
              {vacancy.location}
            </span>
          )}
          {salary && (
            <span className="glow-badge glow-badge-salary">
              <DollarSign size={9} />
              {salary.min.toLocaleString()}–{salary.max.toLocaleString()}
            </span>
          )}
        </div>
      </div>

      {/* Description */}
      {vacancy.description && (
        <p
          className="text-xs mb-3 line-clamp-2 leading-relaxed cursor-pointer"
          style={{ color: 'rgba(255,255,255,0.38)' }}
          onClick={onOpen}
        >
          {vacancy.description}
        </p>
      )}

      {/* Skills */}
      {skills.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3 cursor-pointer" onClick={onOpen}>
          {skills.slice(0, 4).map((skill) => (
            <span key={skill} className="skill-tag">{skill}</span>
          ))}
          {skills.length > 4 && (
            <span className="skill-tag" style={{ opacity: 0.5 }}>+{skills.length - 4}</span>
          )}
        </div>
      )}

      {questions.length > 0 && (
        <p className="text-xs mb-3" style={{ color: 'rgba(255,255,255,0.22)' }} onClick={onOpen}>
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
              <span key={status} className="flex items-center gap-1 text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, display: 'inline-block' }} />
                {Math.round(pct)}%
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div
        className="flex items-center gap-2 pt-3"
        style={{ borderTop: '1px solid rgba(255,110,0,0.07)' }}
      >
        <div
          className="flex-1 rounded-xl px-3 py-2 text-xs truncate cursor-pointer font-mono"
          style={{
            background: 'rgba(0,0,0,0.3)',
            color: 'rgba(255,255,255,0.35)',
            border: '1px solid rgba(255,110,0,0.08)',
          }}
          onClick={onOpen}
        >
          /apply/{vacancy.id.slice(0, 8)}…
        </div>
        <button
          onClick={copyLink}
          className={`copy-btn ${copied ? 'copy-btn-success' : 'copy-btn-idle'}`}
        >
          {copied ? <><Check size={11} />Скоп.</> : <><Link2 size={11} />Копировать</>}
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
  index,
  counts,
}: {
  vacancy: Vacancy;
  onOpen: () => void;
  onDelete: () => void;
  index: number;
  counts?: CandidateCount;
}) {
  const [copied, setCopied] = useState(false);
  const st = statusConfig[vacancy.status as keyof typeof statusConfig] || statusConfig.closed;
  const skills: string[] =
    (((vacancy.requirements as unknown) as Record<string, unknown>)?.hard_skills as string[]) || [];
  const salary = vacancy.salary_range;
  const total = counts?.total || 0;

  const copyLink = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(`${window.location.origin}/apply/${vacancy.id}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="vacancy-list-card"
      style={{ animationDelay: `${index * 0.04}s` }}
      onClick={onOpen}
    >
      {/* Status dot */}
      <div className={st.dot} style={{ flexShrink: 0 }} />

      {/* Title + meta */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className="font-bold text-white text-sm">{vacancy.title}</span>
          <span
            className="px-2 py-0.5 rounded-full text-xs font-bold"
            style={{ background: st.bg, color: st.color, border: `1px solid ${st.border}` }}
          >
            {st.label}
          </span>
          {vacancy.remote && <span className="glow-badge glow-badge-remote"><Wifi size={9} />Remote</span>}
          {salary && <span className="glow-badge glow-badge-salary"><DollarSign size={9} />{salary.min.toLocaleString()}–{salary.max.toLocaleString()}</span>}
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {skills.slice(0, 3).map((s) => <span key={s} className="skill-tag">{s}</span>)}
          {vacancy.location && (
            <span className="flex items-center gap-1 text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
              <MapPin size={9} />{vacancy.location}
            </span>
          )}
        </div>
      </div>

      {/* Candidates count */}
      {total > 0 && (
        <div className="flex items-center gap-1.5 shrink-0">
          <Users size={13} style={{ color: '#FF9A3C' }} />
          <span className="text-sm font-bold" style={{ color: '#FF9A3C' }}>{total}</span>
        </div>
      )}

      {/* Date */}
      <span className="text-xs shrink-0 hidden sm:block" style={{ color: 'rgba(255,255,255,0.28)' }}>
        {formatDate(vacancy.created_at)}
      </span>

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
        <button
          className={`copy-btn ${copied ? 'copy-btn-success' : 'copy-btn-idle'}`}
          style={{ padding: '6px 10px' }}
          onClick={copyLink}
        >
          {copied ? <Check size={11} /> : <Link2 size={11} />}
        </button>
        <button
          className="transition-colors"
          style={{ color: 'rgba(255,255,255,0.18)', padding: 4 }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#f87171')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.18)')}
          onClick={() => onDelete()}
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

/* ─── CREATE VACANCY MODAL (unchanged logic, same as before) ─── */

function CreateVacancyModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState<string[]>(['']);
  const [form, setForm] = useState({
    title: '',
    description: '',
    experience_years: '2',
    hard_skills: '',
    soft_skills: '',
    location: 'Ташкент',
    remote: false,
    salary_min: '',
    salary_max: '',
  });

  const [salaryRec, setSalaryRec] = useState<{ min: number; max: number; note: string } | null>(null);

  const getSalaryRec = () => {
    const skills = form.hard_skills.split(',').filter((s) => s.trim()).length;
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title) { toast.error('Введите название вакансии'); return; }
    setLoading(true);
    try {
      const validQuestions = questions.filter((q) => q.trim());
      const res = await vacanciesApi.create({
        title: form.title,
        description: form.description,
        location: form.location,
        remote: form.remote,
        salary_range: form.salary_min
          ? { min: parseInt(form.salary_min), max: parseInt(form.salary_max || form.salary_min), currency: 'USD' }
          : undefined,
        requirements: {
          hard_skills: form.hard_skills.split(',').map((s) => s.trim()).filter(Boolean),
          soft_skills: form.soft_skills.split(',').map((s) => s.trim()).filter(Boolean),
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
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: 640, maxHeight: '90vh', overflowY: 'auto' }}>
        <div
          className="flex items-center justify-between px-7 py-5"
          style={{
            borderBottom: '1px solid rgba(255,110,0,0.12)',
            background: 'linear-gradient(135deg, rgba(255,110,0,0.08) 0%, transparent 100%)',
          }}
        >
          <div>
            <h3 className="text-xl font-bold text-white">Новая вакансия</h3>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
              Заполните информацию о позиции
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center rounded-xl transition-all"
            style={{
              width: 36, height: 36,
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: 'rgba(255,255,255,0.4)',
              transition: 'all 0.25s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(239,68,68,0.12)';
              e.currentTarget.style.color = '#f87171';
              e.currentTarget.style.transform = 'rotate(90deg)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
              e.currentTarget.style.color = 'rgba(255,255,255,0.4)';
              e.currentTarget.style.transform = 'rotate(0deg)';
            }}
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-7 py-6 space-y-5">
          <div>
            <label className="label">Название позиции *</label>
            <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Senior Backend Developer" required />
          </div>
          <div>
            <label className="label">Описание вакансии</label>
            <textarea className="input h-20 resize-none" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Чем занимается компания, чем будет заниматься сотрудник..." />
          </div>
          <div>
            <label className="label">Технические навыки (через запятую)</label>
            <input className="input" value={form.hard_skills} onChange={(e) => setForm({ ...form, hard_skills: e.target.value })} placeholder="Python, PostgreSQL, Docker, REST API" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Soft Skills</label>
              <input className="input" value={form.soft_skills} onChange={(e) => setForm({ ...form, soft_skills: e.target.value })} placeholder="Teamwork, Leadership" />
            </div>
            <div>
              <label className="label">Опыт (лет)</label>
              <input type="number" className="input" value={form.experience_years} onChange={(e) => setForm({ ...form, experience_years: e.target.value })} min="0" max="20" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Город</label>
              <input className="input" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Ташкент" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="label mb-0">Зарплата (USD)</label>
                <button type="button" onClick={getSalaryRec} className="flex items-center gap-1 text-xs font-semibold" style={{ color: '#FF9A3C' }}>
                  <Sparkles size={12} />AI рекомендация
                </button>
              </div>
              {salaryRec && (
                <div className="mb-2 p-3 rounded-xl text-xs space-y-0.5" style={{ background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.2)' }}>
                  <p className="font-bold" style={{ color: '#34d399' }}>AI: ${salaryRec.min.toLocaleString()} – ${salaryRec.max.toLocaleString()} USD</p>
                  <p style={{ color: 'rgba(255,255,255,0.4)' }}>{salaryRec.note}</p>
                </div>
              )}
              <div className="flex gap-2">
                <input type="number" className="input" placeholder="мин" value={form.salary_min} onChange={(e) => setForm({ ...form, salary_min: e.target.value })} />
                <input type="number" className="input" placeholder="макс" value={form.salary_max} onChange={(e) => setForm({ ...form, salary_max: e.target.value })} />
              </div>
            </div>
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={form.remote} onChange={(e) => setForm({ ...form, remote: e.target.checked })} className="w-5 h-5 rounded" style={{ accentColor: '#FF6A00' }} />
            <span className="text-sm text-white">Удалённая работа</span>
          </label>
          <div style={{ borderTop: '1px solid rgba(255,110,0,0.08)', paddingTop: '1.25rem' }}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <label className="label mb-0">Вопросы в анкете</label>
                <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.25)' }}>Кандидаты ответят при подаче заявки</p>
              </div>
              <button type="button" onClick={addQuestion} className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: '#FF9A3C' }}>
                <Plus size={13} />Добавить
              </button>
            </div>
            <div className="space-y-2">
              {questions.map((q, i) => (
                <div key={i} className="flex gap-2">
                  <input className="input flex-1 text-sm" value={q} onChange={(e) => updateQuestion(i, e.target.value)} placeholder={i === 0 ? 'Почему вы хотите работать у нас?' : i === 1 ? 'Опишите ваш самый сложный проект' : 'Ваш вопрос...'} />
                  {questions.length > 1 && (
                    <button type="button" onClick={() => removeQuestion(i)} className="transition-colors" style={{ color: 'rgba(255,255,255,0.2)' }} onMouseEnter={(e) => (e.currentTarget.style.color = '#f87171')} onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.2)')}>
                      <X size={15} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" className="btn-secondary flex-1 justify-center" onClick={onClose}>Отмена</button>
            <button type="submit" className="btn-primary flex-1 justify-center" disabled={loading}>{loading ? 'Создание...' : 'Создать вакансию'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
