import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  ArrowLeftIcon, BrainCircuit,
  UserPlus, Link2, Check, Loader2, Sparkles, Mail, Phone, Calendar, FileText, X, Download,
  Send, CheckSquare, Square, UserCheck, UserX, Filter, LayoutGrid, Kanban, ClipboardList
} from 'lucide-react';
import KanbanBoard from '../components/KanbanBoard';
import Layout from '../components/Layout';
import ScoreRing from '../components/ScoreRing';
import QuestionBuilder from '../components/QuestionBuilder';
import { vacanciesApi, candidatesApi } from '../utils/api';
import { Candidate, Vacancy, CustomQuestion } from '../types';
import { getCategoryLabel, getCategoryColor, getStatusLabel, getStatusColor, formatDate } from '../utils/helpers';

export default function VacancyPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [sortBy, setSortBy] = useState<'score' | 'date'>('score');
  const [minScore, setMinScore] = useState(0);
  const [showAddCandidate, setShowAddCandidate] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedTelegram, setCopiedTelegram] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [bulkLoading, setBulkLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'kanban'>('grid');
  const [activeTab, setActiveTab] = useState<'candidates' | 'form'>('candidates');
  const [customQuestions, setCustomQuestions] = useState<CustomQuestion[]>([]);
  const [savingForm, setSavingForm] = useState(false);

  const { data: vacancy } = useQuery({
    queryKey: ['vacancy', id],
    queryFn: () => vacanciesApi.get(id!).then((r) => r.data.vacancy as Vacancy),
  });

  // Sync custom questions from vacancy data
  useEffect(() => {
    if (vacancy?.custom_questions) {
      setCustomQuestions(vacancy.custom_questions);
    }
  }, [vacancy]);

  const saveCustomQuestions = async () => {
    setSavingForm(true);
    try {
      await vacanciesApi.update(id!, { custom_questions: customQuestions });
      toast.success('Форма заявки сохранена!');
    } catch {
      toast.error('Ошибка сохранения формы');
    } finally {
      setSavingForm(false);
    }
  };

  const { data: candidatesData, isLoading: loadingCandidates, refetch } = useQuery({
    queryKey: ['candidates', id, sortBy, minScore],
    queryFn: () =>
      candidatesApi
        .listByVacancy(id!, { sort: sortBy, min_score: minScore || undefined })
        .then((r) => r.data),
    refetchInterval: isPolling ? 3000 : false,
  });

  const candidates: Candidate[] = candidatesData?.candidates || [];

  useEffect(() => {
    if (isPolling) {
      const hasAnalyzing = candidates.some((c) => c.status === 'analyzing');
      if (!hasAnalyzing) setIsPolling(false);
    }
  }, [candidates, isPolling]);

  const batchAnalyzeMutation = useMutation({
    mutationFn: () => candidatesApi.batchAnalyze(id!),
    onSuccess: (res) => {
      toast.success(`Анализ запущен для ${res.data.count} кандидатов`);
      setIsPolling(true);
    },
    onError: () => toast.error('Ошибка запуска анализа'),
  });

  const publicLink = `${window.location.origin}/apply/${id}`;

  const copyLink = () => {
    navigator.clipboard.writeText(publicLink);
    setCopiedLink(true);
    toast.success('Ссылка скопирована!');
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const exportCsv = async () => {
    if (!candidates.length) { toast.error('Нет кандидатов для экспорта'); return; }
    setIsExporting(true);
    try {
      const res = await candidatesApi.exportCsv(id!);
      const url = URL.createObjectURL(new Blob([res.data], { type: 'text/csv;charset=utf-8;' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `candidates_${vacancy?.title?.replace(/[^\w\sа-яА-Я-]/g, '') ?? id}_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('CSV экспортирован!');
    } catch {
      toast.error('Ошибка экспорта');
    } finally {
      setIsExporting(false);
    }
  };

  const telegramLink = `https://t.me/myrecruitor_bot?start=${id}`;
  const copyTelegram = () => {
    navigator.clipboard.writeText(telegramLink);
    setCopiedTelegram(true);
    toast.success('Telegram ссылка скопирована!');
    setTimeout(() => setCopiedTelegram(false), 2000);
  };

  const displayCandidates = candidates.filter(
    (c) => statusFilter === 'all' || c.status === statusFilter,
  );

  const bulkUpdateStatus = async (status: string) => {
    if (!selectedIds.length) return;
    setBulkLoading(true);
    try {
      await Promise.all(selectedIds.map((cid) => candidatesApi.updateStatus(cid, status)));
      toast.success(`Статус обновлён для ${selectedIds.length} кандидатов`);
      setSelectedIds([]);
      refetch();
    } catch {
      toast.error('Ошибка обновления статуса');
    } finally {
      setBulkLoading(false);
    }
  };

  const toggleSelect = (cid: string) =>
    setSelectedIds((prev) => (prev.includes(cid) ? prev.filter((i) => i !== cid) : [...prev, cid]));

  const toggleSelectAll = () =>
    setSelectedIds(selectedIds.length === displayCandidates.length ? [] : displayCandidates.map((c) => c.id));

  const analyzingCount = candidates.filter((c) => c.status === 'analyzing').length;
  const analyzedCount = candidates.filter((c) => c.ai_analysis).length;
  const newCount = candidates.filter((c) => !c.ai_analysis && c.status !== 'analyzing').length;

  return (
    <Layout>
      <div className="p-8 max-w-7xl mx-auto page-content">
        {/* Header */}
        <div className="flex items-center gap-4 mb-7">
          <button
            onClick={() => navigate('/vacancies')}
            className="flex items-center justify-center rounded-xl transition-all"
            style={{
              width: 40, height: 40,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,110,0,0.12)',
              color: 'rgba(255,255,255,0.5)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255,110,0,0.10)';
              e.currentTarget.style.color = '#FF9A3C';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
              e.currentTarget.style.color = 'rgba(255,255,255,0.5)';
            }}
          >
            <ArrowLeftIcon size={18} />
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-black text-white truncate">{vacancy?.title || 'Загрузка...'}</h2>
            <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
              {vacancy?.location && `${vacancy.location} · `}
              {candidates.length} кандидатов
            </p>
          </div>
        </div>

        {/* Tab navigation */}
        <div
          className="flex gap-1 p-1 mb-6 rounded-2xl"
          style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,110,0,0.10)', width: 'fit-content' }}
        >
          {([
            { key: 'candidates', label: 'Кандидаты', icon: UserPlus },
            { key: 'form', label: 'Форма заявки', icon: ClipboardList },
          ] as const).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
              style={
                activeTab === key
                  ? {
                      background: 'linear-gradient(135deg, #FF6A00 0%, #FF9A3C 100%)',
                      color: '#000',
                      boxShadow: '0 4px 12px rgba(255,106,0,0.35)',
                    }
                  : { color: 'rgba(255,255,255,0.4)' }
              }
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>

        {activeTab === 'form' ? (
          <div className="card" style={{ padding: '1.5rem' }}>
            <div className="mb-4">
              <h3 className="text-lg font-bold text-white mb-1">Кастомные вопросы</h3>
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
                Эти вопросы отображаются кандидатам при отклике через публичную форму
              </p>
            </div>
            <QuestionBuilder
              questions={customQuestions}
              onChange={setCustomQuestions}
              onSave={saveCustomQuestions}
              saving={savingForm}
            />
          </div>
        ) : (
          <>

        {/* Top info cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {/* Public link card */}
          <div className="card md:col-span-2" style={{ padding: '1.25rem' }}>
            <p
              className="text-xs font-bold mb-2 uppercase tracking-widest"
              style={{ color: 'rgba(255,154,60,0.7)' }}
            >
              Ссылка для кандидатов
            </p>
            <div className="flex items-center gap-2">
              <div
                className="flex-1 rounded-xl px-3 py-2 text-sm truncate font-mono"
                style={{
                  background: 'rgba(0,0,0,0.35)',
                  color: 'rgba(255,255,255,0.45)',
                  border: '1px solid rgba(255,110,0,0.08)',
                }}
              >
                {publicLink}
              </div>
              <button
                onClick={copyLink}
                className={`copy-btn ${copiedLink ? 'copy-btn-success' : 'copy-btn-idle'}`}
                style={{ padding: '8px 16px' }}
              >
                {copiedLink ? (
                  <><Check size={14} />Скопировано</>
                ) : (
                  <><Link2 size={14} />Копировать</>
                )}
              </button>
            </div>

            {/* Telegram link */}
            <div className="flex items-center gap-2 mt-2">
              <div
                className="flex-1 rounded-xl px-3 py-2 text-xs truncate font-mono"
                style={{
                  background: 'rgba(0,0,0,0.25)',
                  color: 'rgba(255,255,255,0.3)',
                  border: '1px solid rgba(0,136,204,0.15)',
                }}
              >
                t.me/myrecruitor_bot?start={id?.slice(0, 8)}…
              </div>
              <button
                onClick={copyTelegram}
                className={`copy-btn ${copiedTelegram ? 'copy-btn-success' : 'copy-btn-idle'}`}
                style={{ padding: '8px 14px', borderColor: 'rgba(0,136,204,0.3)' }}
              >
                {copiedTelegram ? <><Check size={13} />Скопировано</> : <><Send size={13} />Telegram</>}
              </button>
            </div>
          </div>

          {/* Stats card */}
          <div className="card" style={{ padding: '1.25rem' }}>
            <p
              className="text-xs font-bold mb-3 uppercase tracking-widest"
              style={{ color: 'rgba(255,154,60,0.7)' }}
            >
              Статистика
            </p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Всего', value: candidates.length, color: '#fff' },
                { label: 'Оценено', value: analyzedCount, color: '#10b981' },
                { label: 'Новых', value: newCount, color: '#fbbf24' },
              ].map(({ label, value, color }) => (
                <div key={label} className="text-center">
                  <p className="text-2xl font-black" style={{ color }}>
                    {value}
                  </p>
                  <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
                    {label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bulk action bar */}
        {selectedIds.length > 0 && (
          <div
            className="flex items-center justify-between px-4 py-3 rounded-2xl mb-4"
            style={{
              background: 'rgba(59,130,246,0.08)',
              border: '1px solid rgba(59,130,246,0.22)',
            }}
          >
            <div className="flex items-center gap-3">
              <button onClick={toggleSelectAll} style={{ color: 'rgba(255,255,255,0.4)' }}>
                {selectedIds.length === displayCandidates.length
                  ? <CheckSquare size={16} style={{ color: '#60a5fa' }} />
                  : <Square size={16} />}
              </button>
              <span className="text-sm font-semibold" style={{ color: '#93c5fd' }}>
                Выбрано: {selectedIds.length}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                className="btn-secondary text-sm"
                style={{ padding: '6px 14px', fontSize: '0.8rem' }}
                disabled={bulkLoading}
                onClick={() => bulkUpdateStatus('invited')}
              >
                {bulkLoading ? <Loader2 size={13} className="animate-spin" /> : <UserCheck size={13} />}
                Пригласить
              </button>
              <button
                className="btn-danger text-sm"
                style={{ padding: '6px 14px', fontSize: '0.8rem' }}
                disabled={bulkLoading}
                onClick={() => bulkUpdateStatus('rejected')}
              >
                <UserX size={13} />Отклонить
              </button>
              <button
                className="btn-secondary text-sm"
                style={{ padding: '6px 10px', fontSize: '0.8rem' }}
                onClick={() => setSelectedIds([])}
              >
                <X size={13} />
              </button>
            </div>
          </div>
        )}

        {/* Actions bar */}
        <div className="flex items-center gap-3 mb-5 flex-wrap">
          <select
            className="select-premium"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'score' | 'date')}
          >
            <option value="score">По скору</option>
            <option value="date">По дате</option>
          </select>

          <select
            className="select-premium"
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setSelectedIds([]); }}
          >
            <option value="all">
              <Filter size={12} /> Все статусы
            </option>
            <option value="new">Новые</option>
            <option value="analyzed">Проанализированы</option>
            <option value="invited">Приглашены</option>
            <option value="rejected">Отклонены</option>
          </select>

          <div className="flex items-center gap-3">
            <span className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Мин. скор: <span style={{ color: '#FF9A3C' }}>{minScore}%</span>
            </span>
            <input
              type="range"
              min="0"
              max="100"
              value={minScore}
              onChange={(e) => setMinScore(Number(e.target.value))}
              className="w-28"
            />
          </div>

          {/* View toggle */}
          <div
            className="flex items-center rounded-xl p-1 gap-1"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,110,0,0.10)' }}
          >
            <button
              onClick={() => setViewMode('grid')}
              className="flex items-center justify-center rounded-lg transition-all"
              style={{
                width: 30, height: 30,
                background: viewMode === 'grid' ? 'rgba(255,110,0,0.18)' : 'transparent',
                color: viewMode === 'grid' ? '#FF9A3C' : 'rgba(255,255,255,0.3)',
                border: viewMode === 'grid' ? '1px solid rgba(255,110,0,0.3)' : '1px solid transparent',
              }}
              title="Сетка"
            >
              <LayoutGrid size={14} />
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              className="flex items-center justify-center rounded-lg transition-all"
              style={{
                width: 30, height: 30,
                background: viewMode === 'kanban' ? 'rgba(255,110,0,0.18)' : 'transparent',
                color: viewMode === 'kanban' ? '#FF9A3C' : 'rgba(255,255,255,0.3)',
                border: viewMode === 'kanban' ? '1px solid rgba(255,110,0,0.3)' : '1px solid transparent',
              }}
              title="Канбан"
            >
              <Kanban size={14} />
            </button>
          </div>

          <div className="ml-auto flex gap-3">
            <button
              className="btn-secondary text-sm"
              onClick={exportCsv}
              disabled={isExporting || !candidates.length}
              title="Экспорт в CSV"
            >
              {isExporting ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
              CSV
            </button>
            <button
              className="btn-secondary text-sm"
              onClick={() => setShowAddCandidate(true)}
            >
              <UserPlus size={15} />
              Добавить
            </button>
            <button
              className="btn-primary text-sm"
              onClick={() => batchAnalyzeMutation.mutate()}
              disabled={batchAnalyzeMutation.isPending || newCount === 0}
            >
              {batchAnalyzeMutation.isPending ? (
                <><Loader2 size={15} className="animate-spin" />Запуск...</>
              ) : (
                <><BrainCircuit size={15} />Анализировать всех {newCount > 0 ? `(${newCount})` : ''}</>
              )}
            </button>
          </div>
        </div>

        {/* Analyzing progress */}
        {(analyzingCount > 0 || isPolling) && (
          <div
            className="mb-4 flex items-center gap-3 px-4 py-3 rounded-2xl"
            style={{
              background: 'rgba(59,130,246,0.08)',
              border: '1px solid rgba(59,130,246,0.18)',
            }}
          >
            <Loader2 size={15} className="text-blue-400 animate-spin shrink-0" />
            <p className="text-sm" style={{ color: '#93c5fd' }}>
              {analyzingCount > 0
                ? `Анализирую ${analyzingCount} кандидата${analyzingCount > 1 ? 'ов' : ''}... Обновление каждые 3 сек.`
                : 'Завершение анализа...'}
            </p>
          </div>
        )}

        {/* Candidates */}
        {loadingCandidates ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="skeleton h-48 rounded-2xl" />
            ))}
          </div>
        ) : !displayCandidates.length ? (
          <div className="text-center py-16 card">
            <div
              className="inline-flex items-center justify-center mb-4"
              style={{
                width: 64, height: 64,
                background: 'rgba(255,110,0,0.08)',
                border: '1px solid rgba(255,110,0,0.15)',
                borderRadius: 18,
              }}
            >
              <UserPlus size={26} style={{ color: 'rgba(255,110,0,0.5)' }} />
            </div>
            <p className="text-white font-semibold text-lg mb-1">Нет кандидатов</p>
            <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.35)' }}>
              Поделитесь ссылкой с кандидатами или добавьте вручную
            </p>
            <div className="flex gap-3 justify-center">
              <button onClick={copyLink} className="btn-secondary text-sm">
                <Link2 size={14} />
                Копировать ссылку
              </button>
              <button onClick={() => setShowAddCandidate(true)} className="btn-primary text-sm">
                <UserPlus size={14} />
                Добавить вручную
              </button>
            </div>
          </div>
        ) : viewMode === 'kanban' ? (
          <KanbanBoard candidates={displayCandidates} onRefetch={refetch} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {displayCandidates.map((candidate, idx) => (
              <CandidateCard
                key={candidate.id}
                candidate={candidate}
                index={idx}
                isSelected={selectedIds.includes(candidate.id)}
                onToggleSelect={toggleSelect}
                onAnalyzed={() => {
                  refetch();
                  setIsPolling(true);
                }}
              />
            ))}
          </div>
        )}
          </>
        )}
      </div>

      {showAddCandidate && (
        <AddCandidateModal
          vacancyId={id!}
          onClose={() => setShowAddCandidate(false)}
          onCreated={() => {
            refetch();
            setShowAddCandidate(false);
          }}
        />
      )}
    </Layout>
  );
}

function CandidateCard({
  candidate,
  onAnalyzed,
  index,
  isSelected,
  onToggleSelect,
}: {
  candidate: Candidate;
  onAnalyzed: () => void;
  index: number;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
}) {
  const navigate = useNavigate();
  const analysis = candidate.ai_analysis;

  const analyzeMutation = useMutation({
    mutationFn: () => candidatesApi.analyze(candidate.id),
    onSuccess: () => {
      toast.success(`${candidate.full_name} — анализ завершён!`);
      onAnalyzed();
    },
    onError: () => toast.error('Ошибка анализа'),
  });

  const isAnalyzing = candidate.status === 'analyzing' || analyzeMutation.isPending;

  return (
    <div
      className="card card-hover stagger-item flex flex-col gap-4"
      style={{
        position: 'relative',
        animationDelay: `${index * 0.05}s`,
        borderColor: isSelected
          ? 'rgba(59,130,246,0.5)'
          : isAnalyzing
          ? 'rgba(59,130,246,0.25)'
          : analysis
          ? 'rgba(255,110,0,0.18)'
          : 'rgba(255,110,0,0.12)',
        boxShadow: isSelected ? '0 0 0 1px rgba(59,130,246,0.3)' : undefined,
      }}
      onClick={() => navigate(`/candidates/${candidate.id}`)}
    >
      {/* Selection checkbox */}
      <button
        className="absolute top-3 left-3 z-10 flex items-center justify-center rounded transition-all"
        style={{
          width: 20, height: 20,
          background: isSelected ? '#3b82f6' : 'rgba(0,0,0,0.5)',
          border: `2px solid ${isSelected ? '#3b82f6' : 'rgba(255,255,255,0.15)'}`,
          borderRadius: 5,
        }}
        onClick={(e) => { e.stopPropagation(); onToggleSelect(candidate.id); }}
      >
        {isSelected && <Check size={11} style={{ color: 'white' }} />}
      </button>
      {/* Top: name + score */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-bold text-white truncate mb-1">{candidate.full_name}</p>
          <div className="flex items-center gap-1 mb-0.5">
            <Mail size={11} style={{ color: 'rgba(255,255,255,0.25)' }} />
            <p className="text-xs truncate" style={{ color: 'rgba(255,255,255,0.38)' }}>
              {candidate.email}
            </p>
          </div>
          {candidate.phone && (
            <div className="flex items-center gap-1">
              <Phone size={11} style={{ color: 'rgba(255,255,255,0.25)' }} />
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.38)' }}>
                {candidate.phone}
              </p>
            </div>
          )}
        </div>
        {analysis ? (
          <ScoreRing score={analysis.overall_score} category={analysis.category} size="sm" />
        ) : isAnalyzing ? (
          <div
            className="flex items-center justify-center shrink-0"
            style={{
              width: 48, height: 48,
              borderRadius: '50%',
              border: '2px solid rgba(59,130,246,0.3)',
            }}
          >
            <Loader2 size={16} className="text-blue-400 animate-spin" />
          </div>
        ) : (
          <div
            className="flex items-center justify-center shrink-0"
            style={{
              width: 48, height: 48,
              borderRadius: '50%',
              border: '2px dashed rgba(255,110,0,0.2)',
            }}
          >
            <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.75rem' }}>—</span>
          </div>
        )}
      </div>

      {/* AI analysis summary */}
      {analysis && (
        <div
          className="rounded-xl p-3 space-y-1.5"
          style={{
            background: 'rgba(0,0,0,0.3)',
            border: '1px solid rgba(255,110,0,0.08)',
          }}
        >
          <div className="flex items-center gap-2">
            <Sparkles size={12} style={{ color: '#FF9A3C' }} />
            <span className={`text-xs font-bold ${getCategoryColor(analysis.category)}`}>
              {getCategoryLabel(analysis.category)}
            </span>
            <span className="text-xs ml-auto" style={{ color: 'rgba(255,255,255,0.3)' }}>
              {analysis.overall_score}%
            </span>
          </div>
          {analysis.summary && (
            <p className="text-xs leading-relaxed line-clamp-2" style={{ color: 'rgba(255,255,255,0.45)' }}>
              {analysis.summary}
            </p>
          )}
        </div>
      )}

      {/* Bottom row */}
      <div
        className="flex items-center gap-2 mt-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-1 text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>
          <Calendar size={11} />
          {formatDate(candidate.submitted_at)}
        </div>
        {candidate.resume_text && (
          <div className="flex items-center gap-1 text-xs ml-1" style={{ color: 'rgba(255,255,255,0.25)' }}>
            <FileText size={11} />
            <span>Резюме</span>
          </div>
        )}
        <span
          className={`ml-auto text-xs px-2.5 py-1 rounded-full font-semibold ${getStatusColor(candidate.status)}`}
          style={{ background: 'rgba(0,0,0,0.3)' }}
        >
          {getStatusLabel(candidate.status)}
        </span>

        {!analysis && !isAnalyzing && (
          <button
            className="shrink-0 btn-primary text-xs"
            style={{ padding: '6px 12px' }}
            onClick={(e) => {
              e.stopPropagation();
              analyzeMutation.mutate();
            }}
            disabled={analyzeMutation.isPending}
          >
            <BrainCircuit size={12} />
            Анализ
          </button>
        )}
        {isAnalyzing && (
          <span
            className="shrink-0 flex items-center gap-1.5 text-xs animate-pulse"
            style={{ color: '#60a5fa' }}
          >
            <Loader2 size={12} className="animate-spin" />
            Анализ...
          </span>
        )}
      </div>
    </div>
  );
}

function AddCandidateModal({
  vacancyId,
  onClose,
  onCreated,
}: {
  vacancyId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    full_name: '', email: '', phone: '',
    education: '', experience: '', skills: '', motivation: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await candidatesApi.create({
        vacancy_id: vacancyId,
        full_name: form.full_name,
        email: form.email,
        phone: form.phone,
        form_responses: {
          'Образование': form.education,
          'Опыт работы': form.experience,
          'Технические навыки': form.skills,
          'Мотивация': form.motivation,
        },
      });
      toast.success('Кандидат добавлен');
      onCreated();
    } catch {
      toast.error('Ошибка при добавлении');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: 520, maxHeight: '90vh', overflowY: 'auto' }}>
        <div
          className="flex items-center justify-between px-7 py-5"
          style={{
            borderBottom: '1px solid rgba(255,110,0,0.12)',
            background: 'linear-gradient(135deg, rgba(255,110,0,0.08) 0%, transparent 100%)',
          }}
        >
          <h3 className="text-xl font-bold text-white">Добавить кандидата</h3>
          <button
            onClick={onClose}
            className="flex items-center justify-center rounded-xl transition-all"
            style={{
              width: 36, height: 36,
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: 'rgba(255,255,255,0.4)',
            }}
          >
            <X size={15} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-7 py-6 space-y-4">
          <div>
            <label className="label">ФИО *</label>
            <input className="input" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="Иван Иванов" required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Email *</label>
              <input type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="ivan@example.com" required />
            </div>
            <div>
              <label className="label">Телефон</label>
              <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+998 90 000 00 00" />
            </div>
          </div>
          <div>
            <label className="label">Образование</label>
            <textarea className="input h-20 resize-none" value={form.education} onChange={(e) => setForm({ ...form, education: e.target.value })} placeholder="ТашПИ, Computer Science, 2018" />
          </div>
          <div>
            <label className="label">Опыт работы</label>
            <textarea className="input h-24 resize-none" value={form.experience} onChange={(e) => setForm({ ...form, experience: e.target.value })} placeholder="5 лет в разработке..." />
          </div>
          <div>
            <label className="label">Навыки</label>
            <input className="input" value={form.skills} onChange={(e) => setForm({ ...form, skills: e.target.value })} placeholder="Python, PostgreSQL, Docker" />
          </div>
          <div>
            <label className="label">Мотивация</label>
            <textarea className="input h-20 resize-none" value={form.motivation} onChange={(e) => setForm({ ...form, motivation: e.target.value })} />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" className="btn-secondary flex-1 justify-center" onClick={onClose}>Отмена</button>
            <button type="submit" className="btn-primary flex-1 justify-center" disabled={loading}>
              {loading ? 'Сохранение...' : 'Добавить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
