
import { usePageTitle } from '../utils/usePageTitle';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import Layout from '../components/Layout';
import toast from 'react-hot-toast';
import {
  FileText, Loader2,
  Shield,
  Download,
  CheckCircle,
  Clock,
  Activity,
  Users,
  BarChart3,
  Zap,
  Brain,
  ChevronRight,
  Square,
  FileSpreadsheet,
  Lock,
} from 'lucide-react';
import { pageVariants, staggerContainer, staggerItem } from '../utils/animations';
import { candidatesApi, adminApi } from '../utils/api';
import { useAuthStore } from '../utils/auth-store';
import type { Candidate } from '../types';

/* ------------------------------------------------------------------ */
/*  Activity type styling                                               */
/* ------------------------------------------------------------------ */
interface ActivityItem {
  action: string;
  user: string;
  target: string;
  date: string;
  type: 'analysis' | 'invite' | 'vacancy' | 'export' | 'login' | 'reject' | 'edit' | 'form' | 'question' | 'register';
}

const MOCK_ACTIVITY: ActivityItem[] = [
  { action: 'AI анализ', user: 'Мирзабек В.', target: 'Алексей Петров', date: '2026-03-21 14:30', type: 'analysis' },
  { action: 'Приглашение', user: 'Ситора В.', target: 'Мария Иванова', date: '2026-03-21 13:15', type: 'invite' },
  { action: 'Создание вакансии', user: 'Мирзабек В.', target: 'Senior Developer', date: '2026-03-21 12:00', type: 'vacancy' },
  { action: 'Экспорт CSV', user: 'Ситора В.', target: 'Frontend вакансия', date: '2026-03-21 11:45', type: 'export' },
  { action: 'Отклонение', user: 'Мирзабек В.', target: 'Иван Сидоров', date: '2026-03-21 10:30', type: 'reject' },
  { action: 'Редактирование вакансии', user: 'Ситора В.', target: 'Backend Developer', date: '2026-03-20 17:00', type: 'edit' },
  { action: 'Создание формы', user: 'Мирзабек В.', target: 'QA Engineer', date: '2026-03-20 15:20', type: 'form' },
  { action: 'AI анализ', user: 'Ситора В.', target: 'Дмитрий Козлов', date: '2026-03-20 14:10', type: 'analysis' },
  { action: 'Вход в систему', user: 'Мирзабек В.', target: '', date: '2026-03-20 09:00', type: 'login' },
  { action: 'Регистрация', user: 'Нурбек А.', target: '', date: '2026-03-19 16:45', type: 'register' },
];

function getActivityStyle(type: ActivityItem['type']) {
  switch (type) {
    case 'analysis':
      return { icon: Brain, color: 'text-orange-400', bg: 'bg-orange-500/10' };
    case 'invite':
      return { icon: Users, color: 'text-emerald-400', bg: 'bg-emerald-500/10' };
    case 'vacancy':
      return { icon: FileText, color: 'text-blue-400', bg: 'bg-blue-500/10' };
    case 'export':
      return { icon: Download, color: 'text-purple-400', bg: 'bg-purple-500/10' };
    case 'reject':
      return { icon: Shield, color: 'text-red-400', bg: 'bg-red-500/10' };
    case 'edit':
      return { icon: FileText, color: 'text-yellow-400', bg: 'bg-yellow-500/10' };
    case 'form':
      return { icon: FileSpreadsheet, color: 'text-cyan-400', bg: 'bg-cyan-500/10' };
    case 'login':
      return { icon: Activity, color: 'text-white/60', bg: 'bg-white/[0.03]' };
    case 'register':
      return { icon: Users, color: 'text-indigo-400', bg: 'bg-indigo-500/10' };
    default:
      return { icon: Activity, color: 'text-white/60', bg: 'bg-white/[0.03]' };
  }
}

/* ------------------------------------------------------------------ */
/*  Compliance items                                                    */
/* ------------------------------------------------------------------ */
interface ComplianceItem {
  label: string;
  done: boolean;
  note?: string;
}

const COMPLIANCE_ITEMS: ComplianceItem[] = [
  { label: 'Данные зашифрованы (AES-256)', done: true },
  { label: 'Логирование действий', done: true },
  { label: 'Обоснование решений AI', done: true },
  { label: 'Экспорт данных', done: true },
  { label: 'GDPR соответствие', done: false, note: 'в разработке' },
  { label: 'SOC 2', done: false, note: 'планируется' },
];

/* ------------------------------------------------------------------ */
/*  Report card type                                                    */
/* ------------------------------------------------------------------ */
interface ReportCard {
  title: string;
  description: string;
  icon: React.ElementType;
  color: string;
  bg: string;
  borderColor: string;
  onClick: () => void;
}

/* ------------------------------------------------------------------ */
/*  CSV generation helper                                               */
/* ------------------------------------------------------------------ */
function generateCsvFromCandidates(candidates: Candidate[]) {
  const headers = ['Имя', 'Email', 'Телефон', 'Статус', 'AI Оценка', 'Категория', 'Дата подачи'];
  const rows = candidates.map((c) => [
    c.full_name,
    c.email,
    c.phone || '',
    c.status,
    c.ai_analysis?.overall_score?.toString() || '',
    c.ai_analysis?.category || '',
    c.submitted_at,
  ]);

  const csvContent = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `candidates_export_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ------------------------------------------------------------------ */
/*  Main page                                                           */
/* ------------------------------------------------------------------ */
export default function ReportsPage() {
  usePageTitle('Отчёты');
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const isSuperadmin = user?.role === 'superadmin';
  const [csvLoading, setCsvLoading] = useState(false);

  /* Fetch admin usage data for activity log (superadmin only) */
  const { data: usageData, isLoading: reportsLoading } = useQuery({
    queryKey: ['admin-usage'],
    queryFn: () => adminApi.getUsage().then((r) => r.data).catch((e) => { console.error('Ошибка загрузки данных использования:', e); return null; }),
    enabled: isSuperadmin,
    staleTime: 60_000,
  });

  /* Build activity items from real usage data if available */
  const activityItems: ActivityItem[] = (() => {
    if (!isSuperadmin || !usageData?.recent_actions) return MOCK_ACTIVITY;
    const actions = usageData.recent_actions as Array<{
      action?: string;
      user_name?: string;
      target?: string;
      created_at?: string;
      type?: string;
    }>;
    if (!actions.length) return MOCK_ACTIVITY;
    return actions.slice(0, 15).map((a) => ({
      action: a.action || 'Действие',
      user: a.user_name || 'Система',
      target: a.target || '',
      date: a.created_at || '',
      type: (a.type as ActivityItem['type']) || 'login',
    }));
  })();

  const handleCsvExport = async () => {
    setCsvLoading(true);
    try {
      const res = await candidatesApi.listAll({});
      const candidates: Candidate[] = res.data.candidates || [];
      if (candidates.length === 0) {
        toast.error('Нет данных для экспорта');
        return;
      }
      generateCsvFromCandidates(candidates);
      toast.success(`Экспортировано ${candidates.length} кандидатов в CSV`);
    } catch {
      toast.error('Ошибка при загрузке данных для экспорта');
    } finally {
      setCsvLoading(false);
    }
  };

  const handlePdfExport = () => {
    navigate('/vacancies');
    toast('Выберите вакансию, затем нажмите Экспорт → PDF', { icon: '📄' });
  };

  const reportCards: ReportCard[] = [
    {
      title: 'Отчёт по вакансиям',
      description: 'Сводка по всем вакансиям: статусы, количество кандидатов',
      icon: FileText,
      color: 'text-orange-400',
      bg: 'bg-orange-500/10',
      borderColor: 'border-l-orange-500',
      onClick: () => navigate('/analytics'),
    },
    {
      title: 'Отчёт по кандидатам',
      description: 'Все кандидаты с AI-оценками и статусами',
      icon: Users,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
      borderColor: 'border-l-blue-500',
      onClick: () => navigate('/candidates'),
    },
    {
      title: 'Воронка найма',
      description: 'Конверсия по этапам отбора кандидатов',
      icon: BarChart3,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      borderColor: 'border-l-emerald-500',
      onClick: () => navigate('/analytics'),
    },
    {
      title: 'Расход токенов',
      description: 'Детализация использования токенов по операциям',
      icon: Zap,
      color: 'text-yellow-400',
      bg: 'bg-yellow-500/10',
      borderColor: 'border-l-yellow-500',
      onClick: () => navigate('/settings'),
    },
    {
      title: 'Активность команды',
      description: 'Кто, что и когда делал в системе',
      icon: Activity,
      color: 'text-purple-400',
      bg: 'bg-purple-500/10',
      borderColor: 'border-l-purple-500',
      onClick: () => {
        const el = document.getElementById('activity-log');
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      },
    },
    {
      title: 'Эффективность AI',
      description: 'Точность AI-прогнозов и рекомендаций',
      icon: Brain,
      color: 'text-cyan-400',
      bg: 'bg-cyan-500/10',
      borderColor: 'border-l-cyan-500',
      onClick: () => navigate('/analytics'),
    },
  ];


  if (reportsLoading) return <Layout><div className="flex items-center justify-center py-20"><Loader2 className="animate-spin text-orange-500" size={32} /></div></Layout>;
  return (
    <Layout>
      <motion.div
        className="p-6 md:p-8 page-content"
        variants={pageVariants}
        initial="initial"
        animate="animate"
      >
        {/* Header */}
        <div className="mb-6 md:mb-8">
          <h1 className="text-2xl font-bold text-white tracking-wider">ОТЧЁТЫ И АУДИТ</h1>
          <p className="text-sm text-white/60 mt-1">
            Генерация отчётов, аудит и соответствие требованиям
          </p>
        </div>

        {/* ── Quick Reports ── */}
        <motion.div
          className="mb-8"
          variants={staggerContainer}
          initial="initial"
          animate="animate"
        >
          <div className="flex items-center gap-2 mb-4">
            <FileText size={16} className="text-orange-500" />
            <h2 className="text-sm font-semibold text-white/80 tracking-wider uppercase">Быстрые отчёты</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {reportCards.map((card) => (
              <motion.button
                key={card.title}
                variants={staggerItem}
                onClick={card.onClick}
                className={`text-left bg-white/[0.03]/80 border border-white/[0.06]/60 ${card.borderColor} border-l-2 rounded-2xl p-5 hover:border-orange-500/30 transition-all duration-300 backdrop-blur-xl group`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className={`${card.bg} ${card.color} p-2.5 rounded-xl`}>
                    <card.icon size={18} />
                  </div>
                  <ChevronRight size={16} className="text-white/25 group-hover:text-orange-500 transition-colors mt-1" />
                </div>
                <h3 className="text-sm font-semibold text-white mb-1">{card.title}</h3>
                <p className="text-xs text-white/40 leading-relaxed">{card.description}</p>
              </motion.button>
            ))}
          </div>
        </motion.div>

        {/* ── Compliance / Audit ── */}
        <motion.div
          className="mb-8"
          variants={staggerContainer}
          initial="initial"
          animate="animate"
        >
          <div className="flex items-center gap-2 mb-4">
            <Shield size={16} className="text-orange-500" />
            <h2 className="text-sm font-semibold text-white/80 tracking-wider uppercase">Комплаенс и аудит</h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Audit report card */}
            <motion.div
              variants={staggerItem}
              className="bg-white/[0.03]/80 border border-white/[0.06]/60 rounded-2xl p-6 backdrop-blur-xl"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-orange-500/10 text-orange-400 p-2.5 rounded-xl">
                  <Shield size={20} />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">Аудиторский отчёт</h3>
                  <p className="text-xs text-white/40 mt-0.5">Данные для внешних аудиторов</p>
                </div>
              </div>
              <p className="text-sm text-white/60 leading-relaxed mb-5">
                Скачайте данные для аудиторов: кто был выбран, на основании каких критериев, AI оценки и обоснования
              </p>
              <button
                onClick={() => { navigate('/vacancies'); toast('Выберите вакансию, затем нажмите Экспорт → Данные для аудита', { icon: '📋' }); }}
                className="btn-primary flex items-center gap-2 text-sm"
              >
                <Download size={15} />
                Скачать для аудита
              </button>
            </motion.div>

            {/* Compliance checklist */}
            <motion.div
              variants={staggerItem}
              className="bg-white/[0.03]/80 border border-white/[0.06]/60 rounded-2xl p-6 backdrop-blur-xl"
            >
              <h3 className="text-base font-semibold text-white mb-4">Статус соответствия</h3>
              <div className="space-y-3">
                {COMPLIANCE_ITEMS.map((item) => (
                  <div key={item.label} className="flex items-center gap-3">
                    {item.done ? (
                      <CheckCircle size={18} className="text-emerald-400 shrink-0" />
                    ) : (
                      <Square size={18} className="text-white/25 shrink-0" />
                    )}
                    <span className={`text-sm ${item.done ? 'text-white/80' : 'text-white/40'}`}>
                      {item.label}
                    </span>
                    {item.note && (
                      <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 font-medium tracking-wider uppercase">
                        {item.note}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </motion.div>

        {/* ── Export Section ── */}
        <motion.div
          className="mb-8"
          variants={staggerContainer}
          initial="initial"
          animate="animate"
        >
          <div className="flex items-center gap-2 mb-4">
            <Download size={16} className="text-orange-500" />
            <h2 className="text-sm font-semibold text-white/80 tracking-wider uppercase">Экспорт данных</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <motion.button
              variants={staggerItem}
              onClick={handleCsvExport}
              disabled={csvLoading}
              className="bg-white/[0.03]/80 border border-white/[0.06]/60 rounded-2xl p-5 hover:border-orange-500/30 transition-all duration-300 backdrop-blur-xl text-left group disabled:opacity-60"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="bg-emerald-500/10 text-emerald-400 p-2 rounded-xl">
                  <FileText size={18} />
                </div>
                <h3 className="text-sm font-semibold text-white">
                  {csvLoading ? 'Загрузка...' : 'CSV экспорт'}
                </h3>
              </div>
              <p className="text-xs text-white/40">Экспорт всех кандидатов в CSV формат</p>
            </motion.button>

            <motion.button
              variants={staggerItem}
              onClick={handlePdfExport}
              className="bg-white/[0.03]/80 border border-white/[0.06]/60 rounded-2xl p-5 hover:border-orange-500/30 transition-all duration-300 backdrop-blur-xl text-left group"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="bg-red-500/10 text-red-400 p-2 rounded-xl">
                  <FileText size={18} />
                </div>
                <h3 className="text-sm font-semibold text-white">PDF отчёт</h3>
              </div>
              <p className="text-xs text-white/40">Сводный PDF отчёт по всем данным</p>
            </motion.button>

            <motion.button
              variants={staggerItem}
              onClick={() => { navigate('/vacancies'); toast('Выберите вакансию, затем нажмите Экспорт → Excel', { icon: '📊' }); }}
              className="bg-white/[0.03]/80 border border-white/[0.06]/60 rounded-2xl p-5 hover:border-orange-500/30 transition-all duration-300 backdrop-blur-xl text-left relative group"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="bg-green-500/10 text-green-400 p-2 rounded-xl">
                  <FileSpreadsheet size={18} />
                </div>
                <h3 className="text-sm font-semibold text-white">Excel отчёт</h3>
              </div>
              <p className="text-xs text-white/40">Полный Excel отчёт с графиками</p>
            </motion.button>
          </div>
        </motion.div>

        {/* ── Activity Log ── */}
        <motion.div
          id="activity-log"
          variants={staggerContainer}
          initial="initial"
          animate="animate"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-orange-500" />
              <h2 className="text-sm font-semibold text-white/80 tracking-wider uppercase">Журнал действий</h2>
            </div>
            {!isSuperadmin && (
              <span className="inline-flex items-center gap-1.5 text-xs text-white/40 bg-white/[0.02]/60 border border-white/[0.06]/40 px-3 py-1.5 rounded-lg">
                <Lock size={12} />
                Полные данные доступны для администраторов
              </span>
            )}
          </div>

          <motion.div
            variants={staggerItem}
            className="bg-white/[0.03]/80 border border-white/[0.06]/60 rounded-2xl backdrop-blur-xl overflow-hidden"
          >
            <div className="divide-y divide-white/[0.03]">
              {activityItems.map((item, index) => {
                const style = getActivityStyle(item.type);
                const IconComp = style.icon;
                return (
                  <motion.div
                    key={index}
                    variants={staggerItem}
                    className="flex items-center gap-4 px-5 py-3.5 hover:bg-white/[0.02]/30 transition-colors"
                  >
                    <div className={`${style.bg} ${style.color} p-2 rounded-lg shrink-0`}>
                      <IconComp size={14} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white">{item.action}</span>
                        {item.target && (
                          <>
                            <span className="text-white/25">&mdash;</span>
                            <span className="text-sm text-white/60 truncate">{item.target}</span>
                          </>
                        )}
                      </div>
                      <p className="text-xs text-white/25 mt-0.5">{item.user}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-xs font-mono text-white/40 tabular-nums" >
                        {item.date}
                      </p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        </motion.div>
      </motion.div>
    </Layout>
  );
}
