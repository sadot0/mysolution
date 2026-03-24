import { motion } from 'framer-motion';
import { usePageTitle } from '../utils/usePageTitle';
import { pageVariants } from '../utils/animations';
import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  ArrowLeftIcon, BrainCircuit,
  UserPlus, Link2, Check, Loader2, Sparkles, Mail, Phone, Calendar, FileText, X, Download,
  Send, CheckSquare, Square, UserCheck, UserX, LayoutGrid, Kanban, ClipboardList,
  MapPin, DollarSign, Wifi, Pencil, Trash2, Pause, Play, XCircle, RotateCcw,
  Share2, QrCode, Globe, ExternalLink, Upload, BarChart3
} from 'lucide-react';
import KanbanBoard from '../components/KanbanBoard';
import Layout from '../components/Layout';
import ScoreRing from '../components/ScoreRing';
import QuestionBuilder from '../components/QuestionBuilder';
import CompareModal from '../components/CompareModal';
import { vacanciesApi, candidatesApi } from '../utils/api';
import { Candidate, Vacancy, CustomQuestion } from '../types';
import { getCategoryLabel, getCategoryColor, getStatusLabel, getStatusColor, formatDate } from '../utils/helpers';

function getVacancyStatusClass(status: string): string {
  switch (status) {
    case 'active': return 'vacancy-status-active';
    case 'paused': return 'vacancy-status-paused';
    case 'closed': return 'vacancy-status-closed';
    default: return 'vacancy-status-active';
  }
}

function getVacancyStatusLabel(status: string): string {
  switch (status) {
    case 'active': return 'Активна';
    case 'paused': return 'На паузе';
    case 'closed': return 'Закрыта';
    default: return status;
  }
}

function getVacancyStatusDotClass(status: string): string {
  switch (status) {
    case 'active': return 'status-dot status-dot-active';
    case 'paused': return 'status-dot status-dot-paused';
    case 'closed': return 'status-dot status-dot-closed';
    default: return 'status-dot status-dot-active';
  }
}

function getCandidateCardClass(candidate: Candidate, isSelected: boolean): string {
  const analysis = candidate.ai_analysis;
  const isAnalyzing = candidate.status === 'analyzing';
  const classes = ['card', 'card-hover', 'stagger-item', 'flex', 'flex-col', 'gap-4', 'relative'];

  if (isSelected) {
    classes.push('candidate-card-selected');
  } else if (isAnalyzing) {
    classes.push('candidate-card-analyzing');
  } else if (analysis) {
    classes.push(`candidate-card-${analysis.category}`);
  }

  return classes.join(' ');
}

function formatSalary(vacancy: Vacancy): string | null {
  if (!vacancy.salary_range) return null;
  const { min, max, currency } = vacancy.salary_range;
  const fmt = (n: number) => n >= 1000 ? `${Math.round(n / 1000)}k` : String(n);
  return `${fmt(min)} - ${fmt(max)} ${currency}`;
}

export default function VacancyPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [sortBy, setSortBy] = useState<'score' | 'date'>('score');
  const [minScore, setMinScore] = useState(0);
  const [showAddCandidate, setShowAddCandidate] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
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
  const [showPublishDropdown, setShowPublishDropdown] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [showCompare, setShowCompare] = useState(false);
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const [showHHModal, setShowHHModal] = useState(false);
  const [hhToken, setHhToken] = useState('');
  const [hhPublishing, setHhPublishing] = useState(false);
  const [showTelegramModal, setShowTelegramModal] = useState(false);
  const [telegramChannelId, setTelegramChannelId] = useState('');
  const [telegramPublishing, setTelegramPublishing] = useState(false);
  const publishRef = useRef<HTMLDivElement>(null);

  const handlePublishHH = async () => {
    if (!hhToken.trim() || !id) return;
    setHhPublishing(true);
    try {
      const { data } = await vacanciesApi.publishToHH(id, hhToken.trim());
      if (data.success) {
        toast.success('Вакансия опубликована на hh.uz!');
        setShowHHModal(false);
        setHhToken('');
        queryClient.invalidateQueries({ queryKey: ['vacancy', id] });
      } else {
        toast.error(data.error || 'Ошибка публикации');
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Ошибка публикации на HH';
      toast.error(msg);
    } finally {
      setHhPublishing(false);
    }
  };
  const handlePostTelegram = async () => {
    if (!telegramChannelId.trim() || !id) return;
    setTelegramPublishing(true);
    try {
      const { data } = await vacanciesApi.postToTelegram(id, telegramChannelId.trim());
      if (data.success) {
        toast.success('Опубликовано в Telegram!');
        setShowTelegramModal(false);
        setTelegramChannelId('');
      } else {
        toast.error(data.error || 'Ошибка публикации');
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Ошибка публикации в Telegram';
      toast.error(msg);
    } finally {
      setTelegramPublishing(false);
    }
  };
  const exportRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (publishRef.current && !publishRef.current.contains(e.target as Node)) {
        setShowPublishDropdown(false);
      }
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setShowExportDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const { data: vacancy } = useQuery({
    queryKey: ['vacancy', id],
    queryFn: () => vacanciesApi.get(id!).then((r) => r.data.vacancy as Vacancy),
  });
  usePageTitle(vacancy?.title || 'Вакансия');

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
    onError: (err: unknown) => {
      const axiosErr = err as { response?: { status?: number } };
      if (axiosErr?.response?.status === 402) {
        toast.error('Недостаточно токенов! Перейдите в Настройки → Токены');
      } else {
        toast.error('Ошибка запуска анализа');
      }
    },
  });

  // Quick status change mutation
  const statusMutation = useMutation({
    mutationFn: (newStatus: string) => vacanciesApi.update(id!, { status: newStatus }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vacancy', id] });
      toast.success('Статус вакансии обновлён');
    },
    onError: () => toast.error('Ошибка обновления статуса'),
  });

  // Delete vacancy mutation
  const deleteMutation = useMutation({
    mutationFn: () => vacanciesApi.delete(id!),
    onSuccess: () => {
      toast.success('Вакансия удалена');
      navigate('/vacancies');
    },
    onError: () => toast.error('Ошибка удаления вакансии'),
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
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number } };
      if (axiosErr?.response?.status === 402) {
        toast.error('Недостаточно токенов! Перейдите в Настройки → Токены');
      } else {
        toast.error('Ошибка экспорта');
      }
    } finally {
      setIsExporting(false);
    }
  };

  const exportExcel = async () => {
    if (!candidates.length) { toast.error('Нет кандидатов для экспорта'); return; }
    setIsExporting(true);
    try {
      const res = await candidatesApi.exportExcel(id!);
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `candidates_${vacancy?.title?.replace(/[^\w\sа-яА-Я-]/g, '') ?? id}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Excel экспортирован!');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number } };
      if (axiosErr?.response?.status === 402) {
        toast.error('Недостаточно токенов! Перейдите в Настройки → Токены');
      } else {
        toast.error('Ошибка экспорта');
      }
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

  const openQrCode = () => {
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(publicLink)}`;
    window.open(qrUrl, '_blank');
    setShowPublishDropdown(false);
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

  const salaryText = vacancy ? formatSalary(vacancy) : null;

  return (
    <Layout>
      <motion.div variants={pageVariants} initial="initial" animate="animate" className="p-4 md:p-8 max-w-7xl mx-auto page-content">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-white/40 mb-4">
          <Link to="/vacancies" className="hover:text-orange-400 transition-colors">Вакансии</Link>
          <span>/</span>
          <span className="text-neutral-300">{vacancy?.title || '...'}</span>
        </div>

        {/* Header */}
        <div className="flex flex-col gap-4 mb-7">
          <div className="flex items-start gap-4">
            <button onClick={() => navigate('/vacancies')} className="back-btn mt-1">
              <ArrowLeftIcon size={18} />
            </button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap mb-1">
                <h2 className="text-3xl md:text-4xl font-black text-white truncate">
                  {vacancy?.title || 'Загрузка...'}
                </h2>
                {vacancy && (
                  <span className={`glow-badge ${getVacancyStatusClass(vacancy.status)} flex items-center gap-1.5`}>
                    <span className={getVacancyStatusDotClass(vacancy.status)} />
                    {getVacancyStatusLabel(vacancy.status)}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap mt-2">
                {vacancy?.location && (
                  <span className="vacancy-meta-tag">
                    <MapPin size={11} />
                    {vacancy.location}
                  </span>
                )}
                {salaryText && (
                  <span className="vacancy-meta-tag">
                    <DollarSign size={11} />
                    {salaryText}
                  </span>
                )}
                {vacancy?.remote && (
                  <span className="vacancy-meta-tag">
                    <Wifi size={11} />
                    Удалённо
                  </span>
                )}
                <span className="text-xs text-white/40 ml-1">
                  {candidates.length} кандидатов
                </span>
              </div>
            </div>

            {/* Action buttons toolbar */}
            <div className="hidden md:flex items-center gap-2 shrink-0">
              {/* Quick status buttons */}
              {vacancy && vacancy.status === 'active' && (
                <>
                  <button
                    onClick={() => statusMutation.mutate('paused')}
                    disabled={statusMutation.isPending}
                    className="btn-secondary text-sm py-2 px-4"
                    title="Поставить на паузу"
                  >
                    <Pause size={14} />
                    Пауза
                  </button>
                  <button
                    onClick={() => statusMutation.mutate('closed')}
                    disabled={statusMutation.isPending}
                    className="btn-secondary text-sm py-2 px-4"
                    title="Закрыть вакансию"
                  >
                    <XCircle size={14} />
                    Закрыть
                  </button>
                </>
              )}
              {vacancy && vacancy.status === 'paused' && (
                <>
                  <button
                    onClick={() => statusMutation.mutate('active')}
                    disabled={statusMutation.isPending}
                    className="btn-secondary text-sm py-2 px-4"
                    title="Активировать вакансию"
                  >
                    <Play size={14} />
                    Активировать
                  </button>
                  <button
                    onClick={() => statusMutation.mutate('closed')}
                    disabled={statusMutation.isPending}
                    className="btn-secondary text-sm py-2 px-4"
                    title="Закрыть вакансию"
                  >
                    <XCircle size={14} />
                    Закрыть
                  </button>
                </>
              )}
              {vacancy && vacancy.status === 'closed' && (
                <button
                  onClick={() => statusMutation.mutate('active')}
                  disabled={statusMutation.isPending}
                  className="btn-secondary text-sm py-2 px-4"
                  title="Открыть заново"
                >
                  <RotateCcw size={14} />
                  Открыть заново
                </button>
              )}

              {/* Publish dropdown */}
              <div className="relative" ref={publishRef}>
                <button
                  onClick={() => { setShowPublishDropdown(!showPublishDropdown); setShowExportDropdown(false); }}
                  className="btn-secondary text-sm py-2 px-4"
                >
                  <Globe size={14} />
                  Опубликовать
                </button>
                {showPublishDropdown && (
                  <div className="absolute right-0 top-full mt-2 w-64 bg-white/[0.03] border border-white/[0.06] rounded-xl shadow-xl z-50 backdrop-blur-xl py-1 overflow-hidden">
                    <button
                      className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-white/[0.02] text-sm text-neutral-300 cursor-default"
                      onClick={(e) => e.preventDefault()}
                    >
                      <span className="flex items-center gap-2">
                        <ExternalLink size={14} className="text-white/40" />
                        OLX Uzbekistan
                      </span>
                      <span className="text-xs bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded">Скоро</span>
                    </button>
                    {vacancy?.hh_url ? (
                      <a
                        href={vacancy.hh_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-white/[0.02] text-sm text-green-400"
                      >
                        <span className="flex items-center gap-2">
                          <ExternalLink size={14} />
                          hh.uz
                        </span>
                        <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded">Опубликовано</span>
                      </a>
                    ) : (
                      <button
                        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-white/[0.02] text-sm text-neutral-200"
                        onClick={() => { setShowHHModal(true); setShowPublishDropdown(false); }}
                      >
                        <span className="flex items-center gap-2">
                          <ExternalLink size={14} className="text-orange-400" />
                          hh.uz
                        </span>
                        <span className="text-xs bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded">Опубликовать</span>
                      </button>
                    )}
                    <button
                      className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-white/[0.02] text-sm text-neutral-300 cursor-default"
                      onClick={(e) => e.preventDefault()}
                    >
                      <span className="flex items-center gap-2">
                        <ExternalLink size={14} className="text-white/40" />
                        LinkedIn
                      </span>
                      <span className="text-xs bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded">Скоро</span>
                    </button>
                    <button
                      className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-white/[0.02] text-sm text-neutral-200"
                      onClick={() => { setShowTelegramModal(true); setShowPublishDropdown(false); }}
                    >
                      <span className="flex items-center gap-2">
                        <Send size={14} className="text-orange-400" />
                        Telegram канал
                      </span>
                      <span className="text-xs bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded">Опубликовать</span>
                    </button>
                    <div className="border-t border-white/[0.06] my-1" />
                    <button
                      className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-white/[0.02] text-sm text-white"
                      onClick={() => { copyLink(); setShowPublishDropdown(false); }}
                    >
                      <Link2 size={14} className="text-white/60" />
                      Скопировать ссылку
                    </button>
                    <button
                      className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-white/[0.02] text-sm text-white"
                      onClick={openQrCode}
                    >
                      <QrCode size={14} className="text-white/60" />
                      Скачать QR-код
                    </button>
                  </div>
                )}
              </div>

              {/* Export dropdown */}
              <div className="relative" ref={exportRef}>
                <button
                  onClick={() => { setShowExportDropdown(!showExportDropdown); setShowPublishDropdown(false); }}
                  className="btn-secondary text-sm py-2 px-4"
                >
                  <Share2 size={14} />
                  Экспорт данных
                </button>
                {showExportDropdown && (
                  <div className="absolute right-0 top-full mt-2 w-72 bg-white/[0.03] border border-white/[0.06] rounded-xl shadow-xl z-50 backdrop-blur-xl py-1 overflow-hidden">
                    <button
                      className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-white/[0.02] text-sm text-white"
                      onClick={() => { exportCsv(); setShowExportDropdown(false); }}
                    >
                      <Download size={14} className="text-white/60" />
                      CSV (все кандидаты)
                    </button>
                    <button
                      className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-white/[0.02] text-sm text-white"
                      onClick={() => { exportExcel(); setShowExportDropdown(false); }}
                    >
                      <Download size={14} className="text-white/60" />
                      Excel (все кандидаты)
                    </button>
                    <button
                      className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-white/[0.02] text-sm text-neutral-300"
                      onClick={async () => {
                        setShowExportDropdown(false);
                        toast.loading('Генерация PDF...', { id: 'pdf' });
                        try {
                          const res = await candidatesApi.exportBatchPdf(id!);
                          const blob = new Blob([res.data], { type: 'application/pdf' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `vacancy-report.pdf`;
                          a.click();
                          URL.revokeObjectURL(url);
                          toast.success('PDF скачан!', { id: 'pdf' });
                        } catch { toast.error('Ошибка генерации PDF', { id: 'pdf' }); }
                      }}
                    >
                      <FileText size={14} className="text-white/40" />
                      PDF отчёт (все кандидаты)
                    </button>
                    <button
                      className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-white/[0.02] text-sm text-neutral-300"
                      onClick={async () => {
                        setShowExportDropdown(false);
                        try {
                          const res = await candidatesApi.exportAudit(id!);
                          const blob = new Blob([res.data], { type: 'application/json' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `audit-data.json`;
                          a.click();
                          URL.revokeObjectURL(url);
                          toast.success('Аудиторские данные скачаны!');
                        } catch { toast.error('Ошибка экспорта'); }
                      }}
                    >
                      <ExternalLink size={14} className="text-white/40" />
                      Данные для аудита
                    </button>
                  </div>
                )}
              </div>

              <button onClick={copyLink} className={`copy-btn ${copiedLink ? 'copy-btn-success' : 'copy-btn-idle'}`}>
                {copiedLink ? <><Check size={14} />Скопировано</> : <><Link2 size={14} />Ссылка</>}
              </button>
              <button className="btn-secondary text-sm py-2 px-4" onClick={() => setShowBulkUpload(true)}>
                <Upload size={14} />
                <span className="hidden sm:inline">Массовая загрузка</span>
              </button>
              <button onClick={() => setShowAddCandidate(true)} className="btn-secondary text-sm py-2 px-4">
                <UserPlus size={15} />
                Добавить
              </button>
              {vacancy && (
                <button onClick={() => setShowEditModal(true)} className="btn-secondary text-sm py-2 px-4">
                  <Pencil size={14} />
                  Редактировать
                </button>
              )}
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="btn-danger text-sm py-2 px-4"
                title="Удалить вакансию"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* Tab navigation */}
        <div className="tab-bar mb-6">
          {([
            { key: 'candidates', label: 'Кандидаты', icon: UserPlus },
            { key: 'form', label: 'Форма заявки', icon: ClipboardList },
          ] as const).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`tab-bar-item ${activeTab === key ? 'active' : ''}`}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>

        {activeTab === 'form' ? (
          <div className="card p-6 backdrop-blur-xl rounded-2xl">
            <div className="mb-4">
              <h3 className="text-lg font-bold text-white mb-1">Кастомные вопросы</h3>
              <p className="text-sm text-white/40">
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
          <div className="card md:col-span-2 p-5 backdrop-blur-xl rounded-2xl">
            <p className="section-label">
              Ссылка для кандидатов
            </p>
            <div className="flex items-center gap-2">
              <div className="link-display">
                {publicLink}
              </div>
              <button
                onClick={copyLink}
                className={`copy-btn ${copiedLink ? 'copy-btn-success' : 'copy-btn-idle'} py-2 px-4`}
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
              <div className="link-display-telegram">
                t.me/myrecruitor_bot?start={id?.slice(0, 8)}...
              </div>
              <button
                onClick={copyTelegram}
                className={`copy-btn ${copiedTelegram ? 'copy-btn-success' : 'copy-btn-idle'} py-2 px-3.5`}
              >
                {copiedTelegram ? <><Check size={13} />Скопировано</> : <><Send size={13} />Telegram</>}
              </button>
            </div>
          </div>

          {/* Stats card */}
          <div className="card p-5 backdrop-blur-xl rounded-2xl">
            <p className="section-label">
              Статистика
            </p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Всего', value: candidates.length, color: 'text-white' },
                { label: 'Оценено', value: analyzedCount, color: 'text-emerald-400' },
                { label: 'Новых', value: newCount, color: 'text-yellow-400' },
              ].map(({ label, value, color }) => (
                <div key={label} className="text-center">
                  <p className={`text-2xl font-black ${color}`}>
                    {value}
                  </p>
                  <p className="text-xs text-white/25">
                    {label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bulk action bar */}
        {selectedIds.length > 0 && (
          <div className="bulk-bar">
            <div className="flex items-center gap-3">
              <button onClick={toggleSelectAll} className="text-white/40">
                {selectedIds.length === displayCandidates.length
                  ? <CheckSquare size={16} className="text-blue-400" />
                  : <Square size={16} />}
              </button>
              <span className="text-sm font-semibold text-blue-300">
                Выбрано: {selectedIds.length}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                className="btn-secondary text-xs py-1.5 px-3.5"
                disabled={bulkLoading}
                onClick={() => bulkUpdateStatus('invited')}
              >
                {bulkLoading ? <Loader2 size={13} className="animate-spin" /> : <UserCheck size={13} />}
                Пригласить
              </button>
              <button
                className="btn-danger text-xs py-1.5 px-3.5"
                disabled={bulkLoading}
                onClick={() => bulkUpdateStatus('rejected')}
              >
                <UserX size={13} />Отклонить
              </button>
              {selectedIds.length >= 2 && selectedIds.length <= 5 && (
                <button className="btn-secondary text-xs py-1.5 px-3.5" onClick={() => setShowCompare(true)}>
                  <BarChart3 size={13} />
                  Сравнить ({selectedIds.length})
                </button>
              )}
              <button
                className="btn-secondary text-xs py-1.5 px-2.5"
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
            <option value="all">Все статусы</option>
            <option value="new">Новые</option>
            <option value="analyzed">Проанализированы</option>
            <option value="invited">Приглашены</option>
            <option value="rejected">Отклонены</option>
          </select>

          <div className="flex items-center gap-3">
            <span className="text-sm text-white/40">
              Мин. скор: <span className="text-orange-400 font-semibold">{minScore}%</span>
            </span>
            <input
              type="range"
              min="0"
              max="100"
              value={minScore}
              onChange={(e) => setMinScore(Number(e.target.value))}
              className="w-28 md:w-36"
            />
          </div>

          {/* View toggle */}
          <div className="view-toggle">
            <button
              onClick={() => setViewMode('grid')}
              className={`view-toggle-btn ${viewMode === 'grid' ? 'active' : ''}`}
              title="Сетка"
            >
              <LayoutGrid size={14} />
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              className={`view-toggle-btn ${viewMode === 'kanban' ? 'active' : ''}`}
              title="Канбан"
            >
              <Kanban size={14} />
            </button>
          </div>

          <div className="ml-auto flex gap-2 md:gap-3 flex-wrap">
            <button
              className="btn-secondary text-sm"
              onClick={exportCsv}
              disabled={isExporting || !candidates.length}
              title="Экспорт в CSV"
            >
              {isExporting ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
              <span className="hidden sm:inline">CSV</span>
            </button>
            {/* Mobile-only add button */}
            <button
              className="btn-secondary text-sm md:hidden"
              onClick={() => setShowAddCandidate(true)}
            >
              <UserPlus size={15} />
            </button>
            <button
              className="btn-primary text-sm"
              onClick={() => batchAnalyzeMutation.mutate()}
              disabled={batchAnalyzeMutation.isPending || newCount === 0}
            >
              {batchAnalyzeMutation.isPending ? (
                <><Loader2 size={15} className="animate-spin" />Запуск...</>
              ) : (
                <><BrainCircuit size={15} /><span className="hidden sm:inline">Анализировать всех</span><span className="sm:hidden">Анализ</span> {newCount > 0 ? `(${newCount})` : ''}</>
              )}
            </button>
          </div>
        </div>

        {/* Analyzing progress */}
        {(analyzingCount > 0 || isPolling) && (
          <div className="progress-bar-bg">
            <Loader2 size={15} className="text-blue-400 animate-spin shrink-0" />
            <p className="text-sm text-blue-300">
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
            <div className="empty-icon mx-auto mb-4">
              <UserPlus size={26} className="text-orange-500/50" />
            </div>
            <p className="text-white font-semibold text-lg mb-1">Нет кандидатов</p>
            <p className="text-sm text-white/25 mb-6">
              Поделитесь ссылкой с кандидатами или добавьте вручную
            </p>
            <div className="flex gap-3 justify-center flex-wrap">
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
            {displayCandidates.map((candidate) => (
              <CandidateCard
                key={candidate.id}
                candidate={candidate}
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
      </motion.div>

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

      {showEditModal && vacancy && (
        <EditVacancyModal
          vacancy={vacancy}
          onClose={() => setShowEditModal(false)}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ['vacancy', id] });
            setShowEditModal(false);
          }}
        />
      )}

      {showDeleteConfirm && (
        <div className="modal-overlay">
          <div className="modal-content max-w-md">
            <div className="modal-header">
              <h3 className="text-xl font-bold text-white">Удалить вакансию?</h3>
              <button onClick={() => setShowDeleteConfirm(false)} className="modal-close-btn">
                <X size={15} />
              </button>
            </div>
            <div className="px-7 py-6">
              <p className="text-sm text-white/60 mb-6">
                Вакансия <span className="text-white font-semibold">{vacancy?.title}</span> и все связанные кандидаты будут удалены безвозвратно.
              </p>
              <div className="flex gap-3">
                <button
                  className="btn-secondary flex-1 justify-center"
                  onClick={() => setShowDeleteConfirm(false)}
                >
                  Отмена
                </button>
                <button
                  className="btn-danger flex-1 justify-center"
                  onClick={() => deleteMutation.mutate()}
                  disabled={deleteMutation.isPending}
                >
                  {deleteMutation.isPending ? (
                    <><Loader2 size={14} className="animate-spin" />Удаление...</>
                  ) : (
                    <><Trash2 size={14} />Удалить</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showCompare && (
        <CompareModal candidateIds={selectedIds} onClose={() => setShowCompare(false)} />
      )}

      {showBulkUpload && (
        <BulkUploadModal vacancyId={id!} onClose={() => setShowBulkUpload(false)} onSuccess={() => refetch()} />
      )}
    
      {/* HH.uz Publish Modal */}
      {showHHModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowHHModal(false)}>
          <div className="card w-full max-w-md mx-4 backdrop-blur-xl rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Публикация на hh.uz</h3>
              <button onClick={() => setShowHHModal(false)} className="text-white/60 hover:text-white">
                <X size={20} />
              </button>
            </div>
            <p className="text-sm text-white/60 mb-4">
              Введите ваш HH API токен для публикации вакансии. Получить токен можно на{' '}
              <a href="https://dev.hh.ru" target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:underline">dev.hh.ru</a>
            </p>
            <label className="label">HH API Token</label>
            <input
              type="password"
              className="input w-full mb-4"
              placeholder="Bearer токен от hh.ru/hh.uz"
              value={hhToken}
              onChange={(e) => setHhToken(e.target.value)}
            />
            <div className="flex gap-3 justify-end">
              <button className="btn-secondary text-sm py-2 px-4" onClick={() => setShowHHModal(false)}>
                Отмена
              </button>
              <button
                className="btn-primary text-sm py-2 px-4"
                onClick={handlePublishHH}
                disabled={!hhToken.trim() || hhPublishing}
              >
                {hhPublishing ? <><Loader2 size={14} className="animate-spin" /> Публикация...</> : 'Опубликовать'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showTelegramModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowTelegramModal(false)}>
          <div className="card w-full max-w-md mx-4 backdrop-blur-xl rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Публикация в Telegram канал</h3>
              <button onClick={() => setShowTelegramModal(false)} className="text-white/60 hover:text-white">
                <X size={20} />
              </button>
            </div>
            <p className="text-sm text-white/60 mb-4">
              Введите ID вашего Telegram канала. Бот должен быть добавлен как администратор канала с правами на публикацию.
            </p>
            <label className="label">Channel ID</label>
            <input
              type="text"
              className="input w-full mb-4"
              placeholder="@mychannel или -1001234567890"
              value={telegramChannelId}
              onChange={(e) => setTelegramChannelId(e.target.value)}
            />
            <div className="flex gap-3 justify-end">
              <button className="btn-secondary text-sm py-2 px-4" onClick={() => setShowTelegramModal(false)}>
                Отмена
              </button>
              <button
                className="btn-primary text-sm py-2 px-4"
                onClick={handlePostTelegram}
                disabled={!telegramChannelId.trim() || telegramPublishing}
              >
                {telegramPublishing ? <><Loader2 size={14} className="animate-spin" /> Публикация...</> : <><Send size={14} /> Опубликовать</>}
              </button>
            </div>
          </div>
        </div>
      )}

</Layout>
  );
}

function CandidateCard({
  candidate,
  onAnalyzed,
  isSelected,
  onToggleSelect,
}: {
  candidate: Candidate;
  onAnalyzed: () => void;
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
    onError: (err: unknown) => {
      const axiosErr = err as { response?: { status?: number } };
      if (axiosErr?.response?.status === 402) {
        toast.error('Недостаточно токенов! Перейдите в Настройки → Токены');
      } else {
        toast.error('Ошибка анализа');
      }
    },
  });

  const isAnalyzing = candidate.status === 'analyzing' || analyzeMutation.isPending;

  return (
    <div
      className={getCandidateCardClass(candidate, isSelected)}
      onClick={() => navigate(`/candidates/${candidate.id}`)}
    >
      {/* Selection checkbox */}
      <button
        className={`checkbox-custom absolute top-3 left-3 z-10 ${isSelected ? 'checkbox-custom-checked' : ''}`}
        onClick={(e) => { e.stopPropagation(); onToggleSelect(candidate.id); }}
      >
        {isSelected && <Check size={11} className="text-white" />}
      </button>

      {/* Top: name + score */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0 pl-7">
          <p className="font-bold text-white truncate mb-1">{candidate.full_name}</p>
          <div className="flex items-center gap-1 mb-0.5">
            <Mail size={11} className="text-neutral-700 shrink-0" />
            <p className="text-xs truncate text-white/40">
              {candidate.email}
            </p>
          </div>
          {candidate.phone && (
            <div className="flex items-center gap-1">
              <Phone size={11} className="text-neutral-700 shrink-0" />
              <p className="text-xs text-white/40">
                {candidate.phone}
              </p>
            </div>
          )}
        </div>
        {analysis ? (
          <ScoreRing score={analysis.overall_score} category={analysis.category} size="sm" />
        ) : isAnalyzing ? (
          <div className="score-analyzing">
            <Loader2 size={16} className="text-blue-400 animate-spin" />
          </div>
        ) : (
          <div className="score-placeholder">
            <span className="text-neutral-700 text-xs">&mdash;</span>
          </div>
        )}
      </div>

      {/* AI analysis summary */}
      {analysis && (
        <div className="analysis-box space-y-1.5">
          <div className="flex items-center gap-2">
            <Sparkles size={12} className="text-orange-400" />
            <span className={`text-xs font-bold ${getCategoryColor(analysis.category)}`}>
              {getCategoryLabel(analysis.category)}
            </span>
            <span className="text-xs ml-auto text-white/25">
              {analysis.overall_score}%
            </span>
          </div>
          {analysis.summary && (
            <p className="text-xs leading-relaxed line-clamp-2 text-white/40">
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
        <div className="flex items-center gap-1 text-xs text-neutral-700">
          <Calendar size={11} />
          {formatDate(candidate.submitted_at)}
        </div>
        {candidate.resume_text && (
          <div className="flex items-center gap-1 text-xs ml-1 text-neutral-700">
            <FileText size={11} />
            <span>Резюме</span>
          </div>
        )}
        <span
          className={`ml-auto text-xs px-2.5 py-1 rounded-full font-semibold bg-black/30 ${getStatusColor(candidate.status)}`}
        >
          {getStatusLabel(candidate.status)}
        </span>

        {!analysis && !isAnalyzing && (
          <button
            className="shrink-0 btn-primary text-xs py-1.5 px-3"
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
          <span className="shrink-0 flex items-center gap-1.5 text-xs animate-pulse text-blue-400">
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
      <div className="modal-content max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="modal-header">
          <h3 className="text-xl font-bold text-white">Добавить кандидата</h3>
          <button onClick={onClose} className="modal-close-btn">
            <X size={15} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-7 py-6 space-y-5">
          <div>
            <label className="label">ФИО *</label>
            <input className="input" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="Иван Иванов" required />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

function EditVacancyModal({
  vacancy,
  onClose,
  onSaved,
}: {
  vacancy: Vacancy;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    title: vacancy.title,
    description: vacancy.description || '',
    location: vacancy.location || '',
    remote: vacancy.remote,
    salary_min: vacancy.salary_range?.min ?? '',
    salary_max: vacancy.salary_range?.max ?? '',
    salary_currency: vacancy.salary_range?.currency || 'USD',
    status: vacancy.status,
    hard_skills: vacancy.requirements?.hard_skills?.join(', ') || '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const updateData: Record<string, unknown> = {
        title: form.title,
        description: form.description || undefined,
        location: form.location || undefined,
        remote: form.remote,
        status: form.status,
      };

      if (form.salary_min && form.salary_max) {
        updateData.salary_range = {
          min: Number(form.salary_min),
          max: Number(form.salary_max),
          currency: form.salary_currency,
        };
      }

      if (form.hard_skills.trim()) {
        updateData.requirements = {
          ...vacancy.requirements,
          hard_skills: form.hard_skills.split(',').map((s) => s.trim()).filter(Boolean),
        };
      }

      await vacanciesApi.update(vacancy.id, updateData);
      toast.success('Вакансия обновлена');
      onSaved();
    } catch {
      toast.error('Ошибка обновления вакансии');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="modal-header">
          <h3 className="text-xl font-bold text-white">Редактировать вакансию</h3>
          <button onClick={onClose} className="modal-close-btn">
            <X size={15} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-7 py-6 space-y-5">
          <div>
            <label className="label">Название *</label>
            <input
              className="input"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Senior Frontend Developer"
              required
            />
          </div>
          <div>
            <label className="label">Описание</label>
            <textarea
              className="input h-28 resize-none"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Описание вакансии..."
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Локация</label>
              <input
                className="input"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="Москва"
              />
            </div>
            <div>
              <label className="label">Статус</label>
              <select
                className="select-premium w-full"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as 'active' | 'paused' | 'closed' })}
              >
                <option value="active">Активна</option>
                <option value="paused">На паузе</option>
                <option value="closed">Закрыта</option>
              </select>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="edit-remote"
              checked={form.remote}
              onChange={(e) => setForm({ ...form, remote: e.target.checked })}
              className="w-4 h-4 rounded border-white/[0.06] bg-white/[0.03] text-orange-500 focus:ring-orange-500"
            />
            <label htmlFor="edit-remote" className="text-sm text-neutral-300 cursor-pointer">
              Удалённая работа
            </label>
          </div>
          <div>
            <label className="label">Зарплата</label>
            <div className="grid grid-cols-3 gap-3">
              <input
                type="number"
                className="input"
                value={form.salary_min}
                onChange={(e) => setForm({ ...form, salary_min: e.target.value })}
                placeholder="От"
              />
              <input
                type="number"
                className="input"
                value={form.salary_max}
                onChange={(e) => setForm({ ...form, salary_max: e.target.value })}
                placeholder="До"
              />
              <select
                className="select-premium w-full"
                value={form.salary_currency}
                onChange={(e) => setForm({ ...form, salary_currency: e.target.value })}
              >
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="RUB">RUB</option>
                <option value="UZS">UZS</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label">Ключевые навыки</label>
            <input
              className="input"
              value={form.hard_skills}
              onChange={(e) => setForm({ ...form, hard_skills: e.target.value })}
              placeholder="React, TypeScript, Node.js"
            />
            <p className="text-xs text-white/25 mt-1">Через запятую</p>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" className="btn-secondary flex-1 justify-center" onClick={onClose}>
              Отмена
            </button>
            <button type="submit" className="btn-primary flex-1 justify-center" disabled={loading}>
              {loading ? (
                <><Loader2 size={14} className="animate-spin" />Сохранение...</>
              ) : (
                'Сохранить'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function BulkUploadModal({ vacancyId, onClose, onSuccess }: { vacancyId: string; onClose: () => void; onSuccess: () => void }) {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ uploaded: number; errors: number; total: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFiles = Array.from(e.dataTransfer.files).filter(f => 
      f.type === 'application/pdf' || f.name.endsWith('.doc') || f.name.endsWith('.docx')
    );
    setFiles(prev => [...prev, ...droppedFiles]);
  };

  const handleUpload = async () => {
    if (!files.length) return;
    setUploading(true);
    try {
      const res = await vacanciesApi.bulkUpload(vacancyId, files);
      setResult(res.data);
      toast.success(`Загружено ${res.data.uploaded} из ${res.data.total} резюме`);
      onSuccess();
    } catch {
      toast.error('Ошибка загрузки');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="p-6">
          <h3 className="text-lg font-bold text-white mb-1 tracking-wider">МАССОВАЯ ЗАГРУЗКА</h3>
          <p className="text-sm text-white/60 mb-6">Загрузите до 100 резюме (PDF, DOC, DOCX)</p>
          
          {!result ? (
            <>
              <div
                className="border-2 border-dashed border-white/[0.06] rounded-xl p-8 text-center hover:border-orange-500/50 transition-colors cursor-pointer mb-4"
                onDragOver={e => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={32} className="mx-auto mb-3 text-white/40" />
                <p className="text-sm text-white/60">Перетащите файлы сюда или нажмите для выбора</p>
                <p className="text-xs text-white/25 mt-1">PDF, DOC, DOCX — до 5MB каждый</p>
              </div>
              
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.doc,.docx"
                className="hidden"
                onChange={e => setFiles(prev => [...prev, ...Array.from(e.target.files || [])])}
              />
              
              {files.length > 0 && (
                <div className="mb-4">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-white/60">{files.length} файлов выбрано</span>
                    <button className="text-red-400 text-xs" onClick={() => setFiles([])}>Очистить</button>
                  </div>
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {files.map((f, i) => (
                      <div key={i} className="flex items-center justify-between text-xs p-2 bg-white/[0.02] rounded">
                        <span className="text-neutral-300 truncate">{f.name}</span>
                        <span className="text-white/40 shrink-0 ml-2">{(f.size / 1024).toFixed(0)}KB</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="flex gap-3">
                <button className="btn-secondary flex-1" onClick={onClose}>Отмена</button>
                <button className="btn-primary flex-1" onClick={handleUpload} disabled={!files.length || uploading}>
                  {uploading ? 'Загрузка...' : `Загрузить ${files.length} файлов`}
                </button>
              </div>
            </>
          ) : (
            <div className="text-center py-4">
              <p className="text-4xl mb-3">&#10004;</p>
              <p className="text-lg font-bold text-white mb-2">Загрузка завершена</p>
              <p className="text-sm text-white/60">
                Успешно: <span className="text-emerald-400 font-bold">{result.uploaded}</span> | 
                Ошибок: <span className="text-red-400 font-bold">{result.errors}</span>
              </p>
              <button className="btn-primary mt-4" onClick={onClose}>Закрыть</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
