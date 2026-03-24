import { useQuery } from '@tanstack/react-query';
import { usePageTitle } from '../utils/usePageTitle';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { motion } from 'framer-motion';
import Layout from '../components/Layout';
import { analyticsApi } from '../utils/api';
import {
  TrendingUp,
  Users,
  BriefcaseIcon,
  Star,
  ArrowUpRight,
  BarChart3,
  Award,
  ThumbsUp,
  AlertTriangle,
  Filter,
  Clock,
  CheckCircle,
  XCircle,
  UserCheck,
} from 'lucide-react';
import { pageVariants, staggerContainer, staggerItem } from '../utils/animations';

/* ------------------------------------------------------------------ */
/*  Custom gradient definitions for the bar chart                      */
/* ------------------------------------------------------------------ */
function ChartGradients() {
  return (
    <defs>
      <linearGradient id="grad-excellent" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#10b981" stopOpacity={1} />
        <stop offset="100%" stopColor="#10b981" stopOpacity={0.4} />
      </linearGradient>
      <linearGradient id="grad-good" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#3b82f6" stopOpacity={1} />
        <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.4} />
      </linearGradient>
      <linearGradient id="grad-average" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#f59e0b" stopOpacity={1} />
        <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.4} />
      </linearGradient>
      <linearGradient id="grad-below" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#ef4444" stopOpacity={1} />
        <stop offset="100%" stopColor="#ef4444" stopOpacity={0.4} />
      </linearGradient>
    </defs>
  );
}

const gradientIds = [
  'url(#grad-excellent)',
  'url(#grad-good)',
  'url(#grad-average)',
  'url(#grad-below)',
];

/* ------------------------------------------------------------------ */
/*  Custom Tooltip                                                     */
/* ------------------------------------------------------------------ */
interface TooltipPayloadItem {
  value: number;
  payload: { name: string; color: string };
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white/[0.01] border border-white/[0.06] rounded-xl px-4 py-3 shadow-2xl">
      <p className="text-white font-semibold text-sm mb-1">{label}</p>
      <p className="font-mono text-lg" style={{ color: payload[0].payload.color }}>
        {payload[0].value} <span className="text-xs text-white/60">кандидатов</span>
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Funnel data types                                                  */
/* ------------------------------------------------------------------ */
interface FunnelData {
  funnel: {
    total_applications: number;
    new: number;
    analyzing: number;
    analyzed: number;
    invited: number;
    rejected: number;
  };
  conversions: {
    analysis_rate: number;
    invite_rate: number;
    rejection_rate: number;
  };
  avg_days_in_pipeline: number;
  daily_applications: Record<string, number>;
}

/* ------------------------------------------------------------------ */
/*  Main page                                                          */
/* ------------------------------------------------------------------ */
export default function AnalyticsPage() {
  usePageTitle('Аналитика');
  const { data, isLoading, dataUpdatedAt } = useQuery({
    queryKey: ['analytics-overview'],
    queryFn: () => analyticsApi.overview().then((r) => r.data),
  });

  const { data: funnelData, isLoading: funnelLoading } = useQuery<FunnelData>({
    queryKey: ['analytics-funnel'],
    queryFn: () => analyticsApi.funnel().then((r) => r.data),
  });

  const categoryData = data?.by_category
    ? [
        { name: 'Отличный', value: data.by_category.excellent || 0, color: '#10b981' },
        { name: 'Хороший', value: data.by_category.good || 0, color: '#3b82f6' },
        { name: 'Средний', value: data.by_category.average || 0, color: '#f59e0b' },
        { name: 'Ниже ср.', value: data.by_category.below || 0, color: '#ef4444' },
      ]
    : [];

  const totalCategorized = categoryData.reduce((s, d) => s + d.value, 0);

  const pct = (v: number) => (totalCategorized > 0 ? Math.round((v / totalCategorized) * 100) : 0);

  return (
    <Layout>
      <motion.div
        className="p-6 md:p-8 page-content"
        variants={pageVariants}
        initial="initial"
        animate="animate"
      >
        {/* Header */}
        <div className="mb-8 md:mb-10">
          <h1 className="text-3xl font-bold text-white tracking-wider">АНАЛИТИКА</h1>
          <div className="h-px w-16 mt-2 bg-gradient-to-r from-orange-500 to-transparent rounded-full" />
          <div className="flex items-center gap-3 mt-1">
            <p className="text-sm text-white/60">
              Общая статистика по всем вакансиям
            </p>
            {dataUpdatedAt > 0 && (
              <span className="text-xs text-white/25">
                Обновлено: {new Date(dataUpdatedAt).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
        </div>

        {/* Loading skeleton */}
        {isLoading ? (
          <div className="space-y-6">
            {/* Stat card skeletons */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-5">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="bg-white/[0.02] border border-white/[0.04] rounded-2xl p-5 animate-pulse"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="h-3 w-20 bg-white/[0.02] rounded" />
                    <div className="h-8 w-8 bg-white/[0.02] rounded-lg" />
                  </div>
                  <div className="h-8 w-16 bg-white/[0.02] rounded mb-2" />
                  <div className="h-3 w-24 bg-white/[0.02] rounded" />
                </div>
              ))}
            </div>
            {/* Chart skeleton */}
            <div className="bg-white/[0.02] border border-white/[0.04] rounded-2xl p-6 animate-pulse">
              <div className="h-4 w-48 bg-white/[0.02] rounded mb-2" />
              <div className="h-3 w-64 bg-white/[0.02] rounded mb-6" />
              <div className="h-56 bg-white/[0.02] rounded-xl" />
            </div>
            {/* Top performers skeleton */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="bg-white/[0.02] border border-white/[0.04] rounded-2xl p-5 animate-pulse"
                >
                  <div className="h-4 w-24 bg-white/[0.02] rounded mb-3" />
                  <div className="h-6 w-12 bg-white/[0.02] rounded" />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* Stat cards */}
            <motion.div
              className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-5 mb-6 md:mb-8"
              variants={staggerContainer}
              initial="initial"
              animate="animate"
            >
              <motion.div variants={staggerItem}>
                <StatCard
                  icon={<BriefcaseIcon size={20} />}
                  label="Вакансий"
                  value={data?.total_vacancies || 0}
                  borderColor="border-t-orange-500"
                  iconBg="bg-orange-500/10"
                  iconColor="text-orange-500"
                  trend="+12%"
                />
              </motion.div>
              <motion.div variants={staggerItem}>
                <StatCard
                  icon={<Users size={20} />}
                  label="Кандидатов"
                  value={data?.total_candidates || 0}
                  borderColor="border-t-blue-400"
                  iconBg="bg-blue-500/10"
                  iconColor="text-blue-400"
                  trend="+8%"
                />
              </motion.div>
              <motion.div variants={staggerItem}>
                <StatCard
                  icon={<TrendingUp size={20} />}
                  label="Проанализировано"
                  value={data?.analyzed || 0}
                  borderColor="border-t-emerald-500"
                  iconBg="bg-emerald-500/10"
                  iconColor="text-emerald-500"
                  trend="+24%"
                />
              </motion.div>
              <motion.div variants={staggerItem}>
                <StatCard
                  icon={<Star size={20} />}
                  label="Средний скор"
                  value={`${data?.avg_score || 0}%`}
                  borderColor="border-t-yellow-500"
                  iconBg="bg-yellow-500/10"
                  iconColor="text-yellow-500"
                  trend="+3%"
                />
              </motion.div>
            </motion.div>

            {/* Chart section */}
            {categoryData.some((d) => d.value > 0) && (
              <motion.div
                className="bg-white/[0.03] border border-white/[0.04] rounded-2xl p-6 mb-6 backdrop-blur-sm"
                variants={staggerItem}
                initial="initial"
                animate="animate"
              >
                <div className="flex items-center gap-3 mb-1">
                  <div className="flex items-center justify-center w-8 h-8 bg-orange-500/10 rounded-lg">
                    <BarChart3 size={16} className="text-orange-500" />
                  </div>
                  <h3 className="font-bold text-white text-lg">Распределение по категориям</h3>
                </div>
                <p className="text-sm text-white/40 mb-6 ml-11">
                  Результаты AI-анализа всех кандидатов
                </p>

                <ResponsiveContainer width="100%" height={260}>
                  <BarChart
                    data={categoryData}
                    margin={{ top: 0, right: 10, bottom: 0, left: 0 }}
                  >
                    <ChartGradients />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: '#737373', fontSize: 13 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: '#525252', fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip
                      content={<CustomTooltip />}
                      cursor={{ fill: 'rgba(249,115,22,0.04)' }}
                    />
                    <Bar dataKey="value" radius={[10, 10, 0, 0]} maxBarSize={64}>
                      {categoryData.map((_entry, index) => (
                        <Cell key={index} fill={gradientIds[index]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </motion.div>
            )}

            {/* ── Hiring Funnel Section ── */}
            {!funnelLoading && funnelData && funnelData.funnel.total_applications > 0 && (
              <motion.div
                className="bg-white/[0.03] border border-white/[0.04] rounded-2xl p-6 mb-6 backdrop-blur-sm"
                variants={staggerItem}
                initial="initial"
                animate="animate"
              >
                <div className="flex items-center gap-3 mb-1">
                  <div className="flex items-center justify-center w-8 h-8 bg-orange-500/10 rounded-lg">
                    <Filter size={16} className="text-orange-500" />
                  </div>
                  <h3 className="font-bold text-white text-lg">Воронка найма</h3>
                </div>
                <p className="text-sm text-white/40 mb-8 ml-11">
                  Прохождение кандидатов по этапам отбора
                </p>

                {/* Funnel visualization */}
                <div className="flex flex-col items-center gap-3 mb-8">
                  <FunnelBar
                    label="Заявки"
                    count={funnelData.funnel.total_applications}
                    total={funnelData.funnel.total_applications}
                    color="from-orange-500 to-orange-600"
                    bgColor="bg-orange-500/10"
                    delay={0}
                  />
                  <FunnelBar
                    label="Проанализированы"
                    count={funnelData.funnel.analyzed + funnelData.funnel.invited + funnelData.funnel.rejected}
                    total={funnelData.funnel.total_applications}
                    color="from-blue-500 to-blue-600"
                    bgColor="bg-blue-500/10"
                    delay={0.1}
                  />
                  <FunnelBar
                    label="Приглашены"
                    count={funnelData.funnel.invited}
                    total={funnelData.funnel.total_applications}
                    color="from-emerald-500 to-emerald-600"
                    bgColor="bg-emerald-500/10"
                    delay={0.2}
                  />
                  <FunnelBar
                    label="Отклонены"
                    count={funnelData.funnel.rejected}
                    total={funnelData.funnel.total_applications}
                    color="from-red-500 to-red-600"
                    bgColor="bg-red-500/10"
                    delay={0.3}
                    isSeparate
                  />
                </div>

                {/* Conversion rate cards + pipeline metric */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-white/[0.02] border border-white/[0.04] rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle size={14} className="text-blue-400" />
                      <span className="text-xs text-white/60 uppercase tracking-wider">Анализ</span>
                    </div>
                    <p className="font-mono text-xl font-bold text-blue-400 tabular-nums" >
                      {funnelData.conversions.analysis_rate}%
                    </p>
                    <p className="text-xs text-white/40 mt-1">конверсия в анализ</p>
                  </div>

                  <div className="bg-white/[0.02] border border-white/[0.04] rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <UserCheck size={14} className="text-emerald-400" />
                      <span className="text-xs text-white/60 uppercase tracking-wider">Приглашение</span>
                    </div>
                    <p className="font-mono text-xl font-bold text-emerald-400 tabular-nums" >
                      {funnelData.conversions.invite_rate}%
                    </p>
                    <p className="text-xs text-white/40 mt-1">конверсия в приглашение</p>
                  </div>

                  <div className="bg-white/[0.02] border border-white/[0.04] rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <XCircle size={14} className="text-red-400" />
                      <span className="text-xs text-white/60 uppercase tracking-wider">Отказ</span>
                    </div>
                    <p className="font-mono text-xl font-bold text-red-400 tabular-nums" >
                      {funnelData.conversions.rejection_rate}%
                    </p>
                    <p className="text-xs text-white/40 mt-1">процент отказов</p>
                  </div>

                  <div className="bg-white/[0.02] border border-white/[0.04] rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock size={14} className="text-orange-400" />
                      <span className="text-xs text-white/60 uppercase tracking-wider">Пайплайн</span>
                    </div>
                    <p className="font-mono text-xl font-bold text-orange-400 tabular-nums" >
                      {funnelData.avg_days_in_pipeline}
                    </p>
                    <p className="text-xs text-white/40 mt-1">среднее время в пайплайне, дней</p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Top performers section */}
            {categoryData.some((d) => d.value > 0) && (
              <motion.div
                className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6"
                variants={staggerContainer}
                initial="initial"
                animate="animate"
              >
                <motion.div
                  variants={staggerItem}
                  className="bg-white/[0.03] border border-white/[0.04] rounded-2xl p-5 border-l-2 border-l-emerald-500 backdrop-blur-sm"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <Award size={18} className="text-emerald-500" />
                    <span className="text-sm font-medium text-white/60">Лучшая категория</span>
                  </div>
                  <p className="text-white font-semibold">Отличный</p>
                  <p className="font-mono text-2xl font-bold text-emerald-400 mt-1 tabular-nums" >
                    {pct(categoryData[0]?.value || 0)}%
                  </p>
                  <p className="text-xs text-white/40 mt-1">
                    {categoryData[0]?.value || 0} кандидатов
                  </p>
                </motion.div>

                <motion.div
                  variants={staggerItem}
                  className="bg-white/[0.03] border border-white/[0.04] rounded-2xl p-5 border-l-2 border-l-blue-500 backdrop-blur-sm"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <ThumbsUp size={18} className="text-blue-400" />
                    <span className="text-sm font-medium text-white/60">Самая частая</span>
                  </div>
                  <p className="text-white font-semibold">Хороший</p>
                  <p className="font-mono text-2xl font-bold text-blue-400 mt-1 tabular-nums" >
                    {pct(categoryData[1]?.value || 0)}%
                  </p>
                  <p className="text-xs text-white/40 mt-1">
                    {categoryData[1]?.value || 0} кандидатов
                  </p>
                </motion.div>

                <motion.div
                  variants={staggerItem}
                  className="bg-white/[0.03] border border-white/[0.04] rounded-2xl p-5 border-l-2 border-l-red-500 backdrop-blur-sm"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle size={18} className="text-red-400" />
                    <span className="text-sm font-medium text-white/60">Требует внимания</span>
                  </div>
                  <p className="text-white font-semibold">Ниже среднего</p>
                  <p className="font-mono text-2xl font-bold text-red-400 mt-1 tabular-nums" >
                    {pct(categoryData[3]?.value || 0)}%
                  </p>
                  <p className="text-xs text-white/40 mt-1">
                    {categoryData[3]?.value || 0} кандидатов
                  </p>
                </motion.div>
              </motion.div>
            )}

            {/* Empty state */}
            {!data?.total_candidates && (
              <motion.div
                className="bg-white/[0.03] border border-white/[0.04] rounded-2xl text-center py-20 backdrop-blur-sm"
                variants={staggerItem}
                initial="initial"
                animate="animate"
              >
                <div className="flex items-center justify-center gap-3 mb-6">
                  <div className="flex items-center justify-center w-12 h-12 bg-orange-500/10 border border-orange-500/20 rounded-2xl">
                    <BarChart3 size={22} className="text-orange-500/60" />
                  </div>
                  <div className="flex items-center justify-center w-14 h-14 bg-white/[0.02] border border-white/[0.08] rounded-2xl -mx-1">
                    <TrendingUp size={28} className="text-white/40" />
                  </div>
                  <div className="flex items-center justify-center w-12 h-12 bg-blue-500/10 border border-blue-500/20 rounded-2xl">
                    <Users size={22} className="text-blue-500/60" />
                  </div>
                </div>
                <p className="font-semibold text-white/80 mb-1 text-lg">
                  Нет данных для отображения
                </p>
                <p className="text-sm text-white/40 max-w-xs mx-auto">
                  Добавьте кандидатов и запустите AI-анализ, чтобы увидеть статистику и графики
                </p>
              </motion.div>
            )}
          </>
        )}
      </motion.div>
    </Layout>
  );
}

/* ------------------------------------------------------------------ */
/*  Funnel bar component                                               */
/* ------------------------------------------------------------------ */
function FunnelBar({
  label,
  count,
  total,
  color,
  bgColor,
  delay,
  isSeparate,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
  bgColor: string;
  delay: number;
  isSeparate?: boolean;
}) {
  const widthPct = total > 0 ? Math.max((count / total) * 100, 4) : 4;

  return (
    <div className="w-full flex items-center gap-4">
      <div className="w-36 text-right">
        <span className="text-sm text-white/60">{label}</span>
      </div>
      <div className="flex-1 relative">
        <div className={`w-full h-10 rounded-lg ${bgColor} overflow-hidden`}>
          <motion.div
            className={`h-full rounded-lg bg-gradient-to-r ${color} ${isSeparate ? 'opacity-80' : ''}`}
            initial={{ width: 0 }}
            animate={{ width: `${widthPct}%` }}
            transition={{ duration: 0.8, delay, ease: 'easeOut' }}
          />
        </div>
      </div>
      <div className="w-20 text-left">
        <span className="font-mono text-sm font-bold text-white tabular-nums" >
          {count}
        </span>
        <span className="text-xs text-white/40 ml-1">
          ({total > 0 ? Math.round((count / total) * 100) : 0}%)
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Stat card component                                                */
/* ------------------------------------------------------------------ */
function StatCard({
  icon,
  label,
  value,
  borderColor,
  iconBg,
  iconColor,
  trend,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  borderColor: string;
  iconBg: string;
  iconColor: string;
  trend: string;
}) {
  return (
    <div
      className={`bg-white/[0.03] border border-white/[0.04] ${borderColor} border-t-2 rounded-2xl p-4 md:p-5 hover:border-orange-500/30 transition-all duration-300 backdrop-blur-sm`}
    >
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-white/60 tracking-wider uppercase font-medium">{label}</p>
        <div className={`${iconBg} ${iconColor} p-2 rounded-lg`}>{icon}</div>
      </div>
      <p
        className="text-2xl md:text-3xl font-bold text-white font-mono tabular-nums"
        
      >
        {value}
      </p>
      <div className="flex items-center gap-1 mt-2">
        <ArrowUpRight size={14} className="text-emerald-500" />
        <span className="text-xs font-mono text-emerald-500 tabular-nums" >
          {trend}
        </span>
        <span className="text-xs text-white/25 ml-1">vs прошлый месяц</span>
      </div>
    </div>
  );
}
