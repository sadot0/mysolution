import { useState, useMemo } from 'react';
import { usePageTitle } from '../utils/usePageTitle';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Calendar,
  Clock,
  Video,
  MapPin,
  Plus,
  ChevronLeft,
  ChevronRight,
  Phone,
  Mail,
  List,
  CheckCircle,
  CalendarDays,
  X,
  Trash2,
  Loader2,
} from 'lucide-react';
import Layout from '../components/Layout';
import { pageVariants, staggerContainer, staggerItem } from '../utils/animations';
import { interviewsApi, candidatesApi, vacanciesApi } from '../utils/api';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface Interview {
  id: string;
  candidate_id?: string;
  candidateName: string;
  candidate_name?: string;
  vacancyTitle: string;
  vacancy_title?: string;
  date: string;
  type: 'online' | 'offline';
  status: 'scheduled' | 'completed' | 'cancelled';
  email: string;
  phone?: string;
  location?: string;
  meeting_link?: string;
  notes?: string;
}

type ViewMode = 'calendar' | 'list';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
const DAYS_RU = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const HOURS = Array.from({ length: 10 }, (_, i) => i + 8); // 08:00–17:00

/** Normalize backend interview shape to our local interface */
function normalizeInterview(raw: Record<string, unknown>): Interview {
  return {
    id: String(raw.id ?? ''),
    candidate_id: raw.candidate_id ? String(raw.candidate_id) : undefined,
    candidateName: String(raw.candidate_name ?? raw.candidateName ?? ''),
    vacancyTitle: String(raw.vacancy_title ?? raw.vacancyTitle ?? ''),
    date: String(raw.date ?? raw.scheduled_at ?? ''),
    type: (raw.type as Interview['type']) ?? 'online',
    status: (raw.status as Interview['status']) ?? 'scheduled',
    email: String(raw.email ?? raw.candidate_email ?? ''),
    phone: raw.phone ? String(raw.phone) : undefined,
    location: raw.location ? String(raw.location) : undefined,
    meeting_link: raw.meeting_link ? String(raw.meeting_link) : undefined,
    notes: raw.notes ? String(raw.notes) : undefined,
  };
}

function getStatusLabel(s: Interview['status']) {
  if (s === 'scheduled') return 'Запланировано';
  if (s === 'completed') return 'Завершено';
  return 'Отменено';
}

function getStatusClasses(s: Interview['status']) {
  if (s === 'scheduled')
    return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
  if (s === 'completed')
    return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
  return 'bg-red-500/10 text-red-400 border-red-500/30';
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

function formatDateShort(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
  });
}

/** Get Monday of the week that contains `date`. */
function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/* ------------------------------------------------------------------ */
/*  Stat card                                                          */
/* ------------------------------------------------------------------ */
function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: typeof Calendar;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <motion.div variants={staggerItem} className="card p-4">
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center border"
          style={{
            background: `${color}15`,
            borderColor: `${color}30`,
          }}
        >
          <Icon size={18} style={{ color }} />
        </div>
        <div>
          <p className="text-2xl font-black text-white">{value}</p>
          <p className="text-xs text-white/40">{label}</p>
        </div>
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Interview card (list view)                                         */
/* ------------------------------------------------------------------ */
function InterviewCard({
  interview,
  onDelete,
  isDeleting,
}: {
  interview: Interview;
  onDelete: (id: string) => void;
  isDeleting: boolean;
}) {
  const initial = interview.candidateName.charAt(0).toUpperCase();

  return (
    <motion.div variants={staggerItem} className="card p-4 hover:border-orange-500/20 transition-colors">
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
          {initial}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <div>
              <h3 className="text-sm font-bold text-white truncate">
                {interview.candidateName}
              </h3>
              <p className="text-xs text-white/40">{interview.vacancyTitle}</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${getStatusClasses(
                  interview.status
                )}`}
              >
                {getStatusLabel(interview.status)}
              </span>
              {interview.status === 'scheduled' && (
                <button
                  onClick={() => onDelete(interview.id)}
                  disabled={isDeleting}
                  className="w-7 h-7 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-colors disabled:opacity-50"
                  title="Отменить интервью"
                >
                  {isDeleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-white/60">
            <span className="flex items-center gap-1">
              <Calendar size={12} />
              {formatDateShort(interview.date)}
            </span>
            <span className="flex items-center gap-1">
              <Clock size={12} />
              {formatTime(interview.date)}
            </span>

            {interview.type === 'online' ? (
              <span className="flex items-center gap-1 text-blue-400">
                <Video size={12} />
                Онлайн
              </span>
            ) : (
              <span className="flex items-center gap-1 text-amber-400">
                <MapPin size={12} />
                {interview.location || 'Офлайн'}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-white/40">
            <span className="flex items-center gap-1">
              <Mail size={11} />
              {interview.email}
            </span>
            {interview.phone && (
              <span className="flex items-center gap-1">
                <Phone size={11} />
                {interview.phone}
              </span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Calendar week view                                                 */
/* ------------------------------------------------------------------ */
function CalendarView({
  interviews,
  weekStart,
}: {
  interviews: Interview[];
  weekStart: Date;
}) {
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  const today = new Date();

  return (
    <div className="card overflow-hidden backdrop-blur-xl rounded-2xl">
      {/* Day headers */}
      <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-white/[0.04]">
        <div className="p-2" />
        {days.map((d, i) => {
          const isToday = isSameDay(d, today);
          return (
            <div
              key={i}
              className={`p-3 text-center border-l border-white/[0.04] ${
                isToday ? 'bg-orange-500/5' : ''
              }`}
            >
              <p className="text-[10px] text-white/40 uppercase tracking-wider">
                {DAYS_RU[i]}
              </p>
              <p
                className={`text-sm font-bold mt-0.5 ${
                  isToday ? 'text-orange-400' : 'text-white'
                }`}
              >
                {d.getDate()}
              </p>
            </div>
          );
        })}
      </div>

      {/* Time grid */}
      <div className="grid grid-cols-[60px_repeat(7,1fr)]">
        {HOURS.map((hour) => (
          <div key={hour} className="contents">
            {/* Time label */}
            <div className="p-2 text-[10px] text-white/25 text-right pr-3 border-b border-white/[0.04]/50 h-14 flex items-start justify-end">
              {String(hour).padStart(2, '0')}:00
            </div>
            {/* Day cells */}
            {days.map((d, di) => {
              const isToday = isSameDay(d, today);
              const cellInterviews = interviews.filter((iv) => {
                const ivDate = new Date(iv.date);
                return isSameDay(ivDate, d) && ivDate.getHours() === hour;
              });

              return (
                <div
                  key={di}
                  className={`border-l border-b border-white/[0.04]/50 h-14 p-0.5 relative ${
                    isToday ? 'bg-orange-500/[0.02]' : ''
                  }`}
                >
                  {cellInterviews.map((iv) => {
                    const statusColor =
                      iv.status === 'scheduled'
                        ? 'bg-blue-500/20 border-blue-500/40 text-blue-300'
                        : iv.status === 'completed'
                        ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                        : 'bg-red-500/20 border-red-500/40 text-red-300';

                    return (
                      <div
                        key={iv.id}
                        className={`rounded px-1.5 py-0.5 text-[10px] font-medium truncate border ${statusColor} cursor-default`}
                        title={`${iv.candidateName} — ${iv.vacancyTitle}`}
                      >
                        <span className="font-bold">{formatTime(iv.date)}</span>{' '}
                        {iv.candidateName.split(' ')[0]}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Create Interview Modal                                             */
/* ------------------------------------------------------------------ */
interface CandidateOption {
  id: string;
  full_name: string;
  email: string;
  vacancy_title?: string;
  vacancy_id: string;
}

function CreateInterviewModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [candidateId, setCandidateId] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('10:00');
  const [type, setType] = useState<'online' | 'offline'>('online');
  const [location, setLocation] = useState('');
  const [meetingLink, setMeetingLink] = useState('');
  const [notes, setNotes] = useState('');
  const [candidateSearch, setCandidateSearch] = useState('');

  // Fetch vacancies to get candidates
  const { data: vacanciesData } = useQuery({
    queryKey: ['vacancies'],
    queryFn: () => vacanciesApi.list().then((r) => r.data.vacancies || r.data || []),
  });

  // Fetch candidates for all vacancies
  const { data: allCandidates } = useQuery({
    queryKey: ['all-candidates-for-interviews'],
    queryFn: async () => {
      const vacancies = vacanciesData || [];
      if (vacancies.length === 0) return [];
      const results: CandidateOption[] = [];
      for (const v of vacancies) {
        try {
          const res = await candidatesApi.listByVacancy(v.id);
          const candidates = res.data.candidates || res.data || [];
          for (const c of candidates) {
            results.push({
              id: c.id,
              full_name: c.full_name,
              email: c.email,
              vacancy_title: v.title,
              vacancy_id: v.id,
            });
          }
        } catch (e) {
          console.error('Ошибка загрузки кандидатов для вакансии:', e);
        }
      }
      return results;
    },
    enabled: !!vacanciesData && vacanciesData.length > 0,
  });

  const candidates = allCandidates || [];
  const filteredCandidates = candidateSearch
    ? candidates.filter(
        (c) =>
          c.full_name.toLowerCase().includes(candidateSearch.toLowerCase()) ||
          c.email.toLowerCase().includes(candidateSearch.toLowerCase())
      )
    : candidates;

  const selectedCandidate = candidates.find((c) => c.id === candidateId);

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => interviewsApi.create(data),
    onSuccess: () => {
      onCreated();
      onClose();
    },
    onError: () => toast.error('Ошибка создания интервью'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!candidateId || !date || !time) return;

    const scheduledAt = `${date}T${time}`;
    createMutation.mutate({
      candidate_id: candidateId,
      date: scheduledAt,
      scheduled_at: scheduledAt,
      type,
      location: type === 'offline' ? location : undefined,
      meeting_link: type === 'online' ? meetingLink : undefined,
      notes: notes || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-lg card p-6 backdrop-blur-xl rounded-2xl max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-black text-white">Запланировать интервью</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/[0.03] border border-white/[0.06] flex items-center justify-center text-white/60 hover:text-white transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Candidate selector */}
          <div>
            <label className="label">Кандидат</label>
            {selectedCandidate ? (
              <div className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02]/50 border border-white/[0.06]">
                <div>
                  <p className="text-sm text-white font-medium">{selectedCandidate.full_name}</p>
                  <p className="text-xs text-white/40">{selectedCandidate.email} &mdash; {selectedCandidate.vacancy_title}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setCandidateId('')}
                  className="text-white/40 hover:text-red-400 transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <div>
                <input
                  type="text"
                  className="input w-full"
                  placeholder="Поиск кандидата по имени или email..."
                  value={candidateSearch}
                  onChange={(e) => setCandidateSearch(e.target.value)}
                />
                {filteredCandidates.length > 0 && (
                  <div className="mt-1 max-h-40 overflow-y-auto rounded-lg bg-white/[0.03] border border-white/[0.06]">
                    {filteredCandidates.slice(0, 20).map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setCandidateId(c.id);
                          setCandidateSearch('');
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-white/[0.02] transition-colors border-b border-white/[0.04] last:border-0"
                      >
                        <p className="text-sm text-white">{c.full_name}</p>
                        <p className="text-[10px] text-white/40">{c.email} &mdash; {c.vacancy_title}</p>
                      </button>
                    ))}
                  </div>
                )}
                {candidates.length === 0 && (
                  <p className="text-xs text-white/40 mt-1">Нет доступных кандидатов</p>
                )}
              </div>
            )}
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Дата</label>
              <input
                type="date"
                className="input w-full"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="label">Время</label>
              <input
                type="time"
                className="input w-full"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Type: online/offline */}
          <div>
            <label className="label">Тип</label>
            <div className="flex gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="interview-type"
                  checked={type === 'online'}
                  onChange={() => setType('online')}
                  className="accent-orange-500"
                />
                <span className="text-sm text-neutral-300 flex items-center gap-1">
                  <Video size={14} className="text-blue-400" />
                  Онлайн
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="interview-type"
                  checked={type === 'offline'}
                  onChange={() => setType('offline')}
                  className="accent-orange-500"
                />
                <span className="text-sm text-neutral-300 flex items-center gap-1">
                  <MapPin size={14} className="text-amber-400" />
                  Офлайн
                </span>
              </label>
            </div>
          </div>

          {/* Location / Meeting link */}
          {type === 'online' ? (
            <div>
              <label className="label">Ссылка на встречу</label>
              <input
                type="url"
                className="input w-full"
                placeholder="https://zoom.us/j/..."
                value={meetingLink}
                onChange={(e) => setMeetingLink(e.target.value)}
              />
            </div>
          ) : (
            <div>
              <label className="label">Место проведения</label>
              <input
                type="text"
                className="input w-full"
                placeholder="Офис, Ташкент, ул. ..."
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="label">Заметки</label>
            <textarea
              className="input w-full min-h-[80px] resize-y"
              placeholder="Дополнительная информация..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* Error */}
          {createMutation.isError && (
            <p className="text-xs text-red-400">
              Ошибка при создании интервью. Попробуйте снова.
            </p>
          )}

          {/* Submit */}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary text-sm">
              Отмена
            </button>
            <button
              type="submit"
              disabled={!candidateId || !date || !time || createMutation.isPending}
              className="btn-primary text-sm flex items-center gap-2 disabled:opacity-50"
            >
              {createMutation.isPending ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Plus size={14} />
              )}
              Запланировать
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main page                                                          */
/* ------------------------------------------------------------------ */
export default function InterviewsPage() {
  usePageTitle('Интервью');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [weekOffset, setWeekOffset] = useState(0);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const queryClient = useQueryClient();

  /* Fetch interviews from API */
  const { data: interviewsData, isLoading } = useQuery({
    queryKey: ['interviews'],
    queryFn: () =>
      interviewsApi.list().then((r) => {
        const raw = r.data.interviews || r.data || [];
        return (raw as Record<string, unknown>[]).map(normalizeInterview);
      }),
  });
  const interviews = interviewsData || [];

  /* Delete / cancel mutation */
  const deleteMutation = useMutation({
    mutationFn: (id: string) => interviewsApi.delete(id),
    onMutate: (id) => setDeletingId(id),
    onSettled: () => setDeletingId(null),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['interviews'] });
    },
    onError: () => toast.error('Ошибка удаления интервью'),
  });

  const now = new Date();
  const weekStart = useMemo(() => {
    const m = getMonday(now);
    m.setDate(m.getDate() + weekOffset * 7);
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekOffset]);

  const weekEnd = useMemo(() => {
    const e = new Date(weekStart);
    e.setDate(e.getDate() + 6);
    e.setHours(23, 59, 59, 999);
    return e;
  }, [weekStart]);

  /* Stats — calculated from real data */
  const totalCount = interviews.length;
  const thisWeekCount = interviews.filter((iv) => {
    const d = new Date(iv.date);
    const mon = getMonday(new Date());
    const sun = new Date(mon);
    sun.setDate(sun.getDate() + 6);
    sun.setHours(23, 59, 59, 999);
    return d >= mon && d <= sun;
  }).length;
  const todayCount = interviews.filter((iv) =>
    isSameDay(new Date(iv.date), now)
  ).length;
  const completedCount = interviews.filter(
    (iv) => iv.status === 'completed'
  ).length;

  /* Sorted list for list view */
  const sortedInterviews = useMemo(
    () => [...interviews].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [interviews]
  );

  /* Week label */
  const weekLabel = `${weekStart.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
  })} — ${weekEnd.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })}`;

  return (
    <Layout>
      <motion.div
        className="p-6 md:p-8 page-content"
        variants={pageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
      >
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-orange-500/10 border border-orange-500/30 rounded text-[10px] font-semibold text-orange-400 tracking-widest uppercase">
                <CalendarDays size={11} />
                Расписание
              </div>
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
              ИНТЕРВЬЮ
            </h1>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-primary flex items-center gap-2 text-sm"
          >
            <Plus size={16} />
            Запланировать
          </button>
        </div>

        {/* Loading state */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 size={32} className="animate-spin text-orange-500 mb-4" />
            <p className="text-sm text-white/40">Загрузка интервью...</p>
          </div>
        ) : (
          <>
            {/* Stats */}
            <motion.div
              className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6"
              variants={staggerContainer}
              initial="initial"
              animate="animate"
            >
              <StatCard icon={Calendar} label="Всего интервью" value={totalCount} color="#f97316" />
              <StatCard icon={CalendarDays} label="На этой неделе" value={thisWeekCount} color="#3b82f6" />
              <StatCard icon={Clock} label="Сегодня" value={todayCount} color="#a855f7" />
              <StatCard icon={CheckCircle} label="Завершено" value={completedCount} color="#10b981" />
            </motion.div>

            {/* View toggle + week nav */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
              {/* View toggle */}
              <div className="flex items-center gap-1 bg-white/[0.03] border border-white/[0.04] rounded-xl p-1 backdrop-blur-xl">
                <button
                  onClick={() => setViewMode('calendar')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    viewMode === 'calendar'
                      ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                      : 'text-white/40 hover:text-neutral-300 border border-transparent'
                  }`}
                >
                  <Calendar size={13} />
                  Календарь
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    viewMode === 'list'
                      ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                      : 'text-white/40 hover:text-neutral-300 border border-transparent'
                  }`}
                >
                  <List size={13} />
                  Список
                </button>
              </div>

              {/* Week navigator (calendar mode) */}
              {viewMode === 'calendar' && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setWeekOffset((p) => p - 1)}
                    className="w-8 h-8 rounded-lg bg-white/[0.03] border border-white/[0.04] flex items-center justify-center text-white/60 hover:text-white hover:border-white/[0.08] transition-colors"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <span className="text-xs text-white/60 font-medium min-w-[160px] text-center">
                    {weekLabel}
                  </span>
                  <button
                    onClick={() => setWeekOffset((p) => p + 1)}
                    className="w-8 h-8 rounded-lg bg-white/[0.03] border border-white/[0.04] flex items-center justify-center text-white/60 hover:text-white hover:border-white/[0.08] transition-colors"
                  >
                    <ChevronRight size={14} />
                  </button>
                  {weekOffset !== 0 && (
                    <button
                      onClick={() => setWeekOffset(0)}
                      className="text-[10px] text-orange-400 hover:text-orange-300 font-medium ml-1"
                    >
                      Сегодня
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Content */}
            <AnimatePresence mode="wait">
              {viewMode === 'calendar' ? (
                <motion.div
                  key="calendar"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <CalendarView interviews={interviews} weekStart={weekStart} />
                </motion.div>
              ) : (
                <motion.div
                  key="list"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  {sortedInterviews.length === 0 ? (
                    <div className="card p-12 text-center backdrop-blur-xl rounded-2xl">
                      <Calendar
                        size={48}
                        className="mx-auto mb-4 text-neutral-700"
                      />
                      <p className="text-white/40 text-sm mb-4">
                        Нет запланированных интервью
                      </p>
                      <button
                        onClick={() => setShowCreateModal(true)}
                        className="btn-primary text-sm inline-flex items-center gap-2"
                      >
                        <Plus size={14} />
                        Запланировать первое интервью
                      </button>
                    </div>
                  ) : (
                    <motion.div
                      className="grid gap-3"
                      variants={staggerContainer}
                      initial="initial"
                      animate="animate"
                    >
                      {sortedInterviews.map((iv) => (
                        <InterviewCard
                          key={iv.id}
                          interview={iv}
                          onDelete={(id) => deleteMutation.mutate(id)}
                          isDeleting={deletingId === iv.id}
                        />
                      ))}
                    </motion.div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}

        {/* Create interview modal */}
        <AnimatePresence>
          {showCreateModal && (
            <CreateInterviewModal
              onClose={() => setShowCreateModal(false)}
              onCreated={() => {
                queryClient.invalidateQueries({ queryKey: ['interviews'] });
              }}
            />
          )}
        </AnimatePresence>
      </motion.div>
    </Layout>
  );
}
