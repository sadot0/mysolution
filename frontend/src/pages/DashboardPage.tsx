import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  BriefcaseIcon, Users, BarChart3, Plus, ArrowRight, Clock,
  TrendingUp, Coins, Calendar, ChevronRight, Sparkles,
  FileText, UserCheck, AlertCircle, Settings, Info, Zap
} from 'lucide-react';
import Layout from '../components/Layout';
import Onboarding from '../components/Onboarding';
import { useAuthStore } from '../utils/auth-store';
import { vacanciesApi, analyticsApi, tokensApi, notificationsApi, interviewsApi, candidatesApi } from '../utils/api';
import { usePageTitle } from '../utils/usePageTitle';
import { pageVariants, staggerContainer, staggerItem } from '../utils/animations';
import { formatDate, getCategoryColor } from '../utils/helpers';
import { Vacancy, Candidate } from '../types';

/* ── Skeleton Components ── */

function StatSkeleton() {
  return (
    <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-2xl p-5 animate-pulse">
      <div className="h-3 w-16 bg-white/[0.06] rounded mb-3" />
      <div className="h-8 w-24 bg-white/[0.06] rounded mb-2" />
      <div className="h-2 w-12 bg-white/[0.04] rounded" />
    </div>
  );
}

function CardSkeleton() {
  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 animate-pulse">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-8 h-8 bg-white/[0.06] rounded-full" />
        <div>
          <div className="h-3 w-32 bg-white/[0.06] rounded mb-1" />
          <div className="h-2 w-20 bg-white/[0.04] rounded" />
        </div>
      </div>
      <div className="h-2 w-full bg-white/[0.04] rounded mb-2" />
      <div className="h-2 w-3/4 bg-white/[0.04] rounded" />
    </div>
  );
}

/* ── Animated Number Component ── */

function AnimatedNumber({ value, className }: { value: number; className?: string }) {
  const [display, setDisplay] = useState(0);
  const prevValue = useRef(0);

  useEffect(() => {
    const from = prevValue.current;
    prevValue.current = value;
    const duration = 1000;
    const start = performance.now();
    const animate = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
      setDisplay(Math.round(from + (value - from) * eased));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [value]);

  return <span className={className}>{display.toLocaleString()}</span>;
}

export default function DashboardPage() {
  usePageTitle('Главная');
  const { user } = useAuthStore();

  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    const seen = localStorage.getItem('onboarding_complete');
    if (!seen) {
      setShowOnboarding(true);
    }
  }, []);

  const firstName = user?.name?.split(' ')[0] || 'Пользователь';

  // Data fetching
  const { data: vacanciesData, isLoading: isLoadingVacancies } = useQuery({
    queryKey: ['dashboard-vacancies'],
    queryFn: () => vacanciesApi.list().then(r => r.data.vacancies || []),
  });

  const { data: analyticsData, isLoading: isLoadingAnalytics } = useQuery({
    queryKey: ['dashboard-analytics'],
    queryFn: () => analyticsApi.overview().then(r => r.data).catch(() => null),
  });

  const { data: balanceData } = useQuery({
    queryKey: ['dashboard-balance'],
    queryFn: () => tokensApi.getBalance().then(r => r.data).catch(() => ({ balance: 0 })),
  });

  const { data: upcomingData } = useQuery({
    queryKey: ['dashboard-upcoming'],
    queryFn: () => interviewsApi.upcoming().then(r => r.data.interviews || []).catch(() => []),
  });

  const { data: notifData } = useQuery({
    queryKey: ['dashboard-notif'],
    queryFn: () => notificationsApi.list().then(r => r.data.notifications || []).catch(() => []),
  });

  const { data: candidatesData, isLoading: isLoadingCandidates } = useQuery({
    queryKey: ['dashboard-candidates'],
    queryFn: () => candidatesApi.listAll({ limit: 5 }).then(r => r.data.candidates || []).catch(() => []),
  });

  const isLoading = isLoadingVacancies || isLoadingAnalytics || isLoadingCandidates;

  const vacancies: Vacancy[] = vacanciesData || [];
  const candidates: Candidate[] = candidatesData || [];
  const activeVacancies = vacancies.filter(v => v.status === 'active');
  const recentVacancies = vacancies.slice(0, 3);
  const recentCandidates = candidates.slice(0, 5);
  const upcoming = (upcomingData || []).slice(0, 3);
  const notifications = (notifData || []).slice(0, 3);

  const totalCandidates = analyticsData?.total_candidates ?? candidates.length;
  const avgScore = analyticsData?.avg_score ?? 0;
  const tokenBalance = balanceData?.balance ?? user?.token_balance ?? 0;

  const hasNoData = vacancies.length === 0;

  // Stats cards data
  const stats = [
    {
      label: 'Активные вакансии',
      value: activeVacancies.length,
      numeric: true,
      icon: BriefcaseIcon,
      href: '/vacancies',
      color: 'text-orange-400',
      bg: 'bg-orange-500/10',
    },
    {
      label: 'Всего кандидатов',
      value: totalCandidates,
      numeric: true,
      icon: Users,
      href: '/candidates',
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
    },
    {
      label: 'Средний балл AI',
      value: avgScore ? avgScore.toFixed(1) : '\u2014',
      numeric: false,
      icon: Sparkles,
      href: '/analytics',
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
    },
    {
      label: 'Токены',
      value: tokenBalance,
      numeric: true,
      icon: Coins,
      href: '/settings',
      color: 'text-yellow-400',
      bg: 'bg-yellow-500/10',
    },
  ];

  const quickActions = [
    { label: 'Создать вакансию', icon: Plus, href: '/vacancies', state: { showCreate: true } },
    { label: 'Загрузить резюме', icon: FileText, href: '/vacancies' },
    { label: 'Аналитика', icon: BarChart3, href: '/analytics' },
    { label: 'Настройки', icon: Settings, href: '/settings' },
  ];

  const getVacancyStatusDot = (status: string) => {
    switch (status) {
      case 'active': return 'bg-emerald-400';
      case 'paused': return 'bg-yellow-400';
      case 'closed': return 'bg-white/[0.15]';
      default: return 'bg-white/[0.15]';
    }
  };

  return (
    <Layout>
      <motion.div
        className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto"
        variants={pageVariants}
        initial="initial"
        animate="animate"
      >
        {/* Section 1: Welcome Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white">
              Добро пожаловать, {firstName}!
            </h1>
            <p className="text-sm text-white/60 mt-1">
              {hasNoData && !isLoading
                ? 'Давайте настроим ваш рекрутинговый хаб.'
                : 'Вот что происходит в вашем хабе.'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/settings"
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:border-orange-500/30 transition-all"
            >
              <Coins size={14} className="text-orange-400" />
              <span className="text-sm font-bold font-mono text-orange-400">
                {tokenBalance.toLocaleString()}
              </span>
            </Link>
            <Link
              to="/vacancies"
              state={{ showCreate: true }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 text-white text-sm font-medium hover:shadow-lg hover:shadow-orange-500/20 transition-all"
            >
              <Plus size={14} />
              Создать вакансию
            </Link>
            <Link
              to="/candidates"
              className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06] text-white/80 text-sm font-medium hover:bg-white/[0.06] hover:border-white/[0.1] transition-all"
            >
              <Users size={14} />
              Все кандидаты
            </Link>
          </div>
        </div>

        {/* Token Balance Card — always visible */}
        <div className="mb-6">
          <div className="bg-gradient-to-br from-[rgba(232,114,28,0.08)] to-transparent border border-[rgba(232,114,28,0.12)] rounded-2xl p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-[rgba(232,114,28,0.15)] flex items-center justify-center">
              <Coins size={22} className="text-orange-400" />
            </div>
            <div>
              <p className="text-xs text-white/40 mb-0.5">Ваш баланс</p>
              <AnimatedNumber value={tokenBalance} className="text-2xl font-bold text-orange-400 font-mono" />
              <p className="text-xs text-white/25">токенов</p>
            </div>
          </div>
        </div>

        {/* Empty State: Getting Started */}
        {!isLoading && hasNoData ? (
          <motion.div
            variants={staggerItem}
            initial="initial"
            animate="animate"
          >
            <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-2xl p-8 md:p-12 text-center">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-[rgba(232,114,28,0.1)] border border-[rgba(232,114,28,0.15)] mb-6">
                <Sparkles size={32} className="text-orange-400" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-3">Начните работу с SOLUTION HUB</h2>
              <p className="text-white/40 max-w-md mx-auto mb-8">
                Создайте первую вакансию и получите AI-анализ кандидатов за 30 секунд
              </p>

              {/* 3 step cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 max-w-2xl mx-auto">
                <div className="bg-white/[0.02] border border-white/[0.04] rounded-xl p-5 text-left">
                  <div className="text-2xl font-bold text-orange-400 mb-2">1</div>
                  <h3 className="text-sm font-semibold text-white mb-1">Создайте вакансию</h3>
                  <p className="text-xs text-white/40">Выберите из 6 шаблонов или создайте свою</p>
                </div>
                <div className="bg-white/[0.02] border border-white/[0.04] rounded-xl p-5 text-left">
                  <div className="text-2xl font-bold text-orange-400 mb-2">2</div>
                  <h3 className="text-sm font-semibold text-white mb-1">Получите кандидатов</h3>
                  <p className="text-xs text-white/40">Поделитесь ссылкой или загрузите резюме</p>
                </div>
                <div className="bg-white/[0.02] border border-white/[0.04] rounded-xl p-5 text-left">
                  <div className="text-2xl font-bold text-orange-400 mb-2">3</div>
                  <h3 className="text-sm font-semibold text-white mb-1">AI найдёт лучших</h3>
                  <p className="text-xs text-white/40">Анализ по 6 параметрам за 30 секунд</p>
                </div>
              </div>

              <Link to="/vacancies" state={{ showCreate: true }} className="btn-primary inline-flex items-center gap-2 px-6 py-3">
                <Plus size={16} />
                Создать первую вакансию
              </Link>

              <div className="mt-6 flex items-center justify-center gap-4 text-xs text-white/25">
                <span className="flex items-center gap-1"><Coins size={12} /> 100 бесплатных токенов</span>
                <span>&bull;</span>
                <span>Без кредитной карты</span>
              </div>
            </div>

            {/* Quick tips for new users */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-6">
              <div className="bg-white/[0.02] border border-white/[0.04] rounded-xl p-4 flex items-start gap-3">
                <Info size={16} className="text-white/30 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-medium text-white/60">Совет</p>
                  <p className="text-xs text-white/30">Используйте шаблоны вакансий — AI подготовит идеальную анкету автоматически</p>
                </div>
              </div>
              <div className="bg-white/[0.02] border border-white/[0.04] rounded-xl p-4 flex items-start gap-3">
                <Zap size={16} className="text-white/30 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-medium text-white/60">Быстрый старт</p>
                  <p className="text-xs text-white/30">Массовая загрузка — отправьте до 100 резюме одним кликом</p>
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          <>
            {/* Section 2: Stats Overview */}
            {isLoading ? (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8">
                <StatSkeleton />
                <StatSkeleton />
                <StatSkeleton />
                <StatSkeleton />
              </div>
            ) : (
              <motion.div
                className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8"
                variants={staggerContainer}
                initial="initial"
                animate="animate"
              >
                {stats.map((stat) => (
                  <motion.div key={stat.label} variants={staggerItem}>
                    <Link
                      to={stat.href}
                      className="block p-4 sm:p-5 rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] hover:border-white/[0.12] hover:bg-white/[0.05] transition-all group interactive-card"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className={`p-2 rounded-xl ${stat.bg}`}>
                          <stat.icon size={16} className={stat.color} />
                        </div>
                        <ArrowRight size={14} className="text-white/25 group-hover:text-white/60 transition-colors" />
                      </div>
                      <div className="text-2xl sm:text-3xl font-bold text-white mb-1">
                        {stat.numeric ? (
                          <AnimatedNumber value={typeof stat.value === 'number' ? stat.value : 0} />
                        ) : (
                          stat.value
                        )}
                      </div>
                      <div className="text-xs text-white/40">{stat.label}</div>
                    </Link>
                  </motion.div>
                ))}
              </motion.div>
            )}

            {/* Section 3: Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 sm:gap-6">
              {/* LEFT COLUMN (3/5 = 60%) */}
              <div className="lg:col-span-3 space-y-4 sm:space-y-6">
                {/* Recent Vacancies */}
                <motion.div
                  className="rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] p-5 sm:p-6 interactive-card"
                  variants={staggerItem}
                  initial="initial"
                  animate="animate"
                >
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-base font-semibold text-white flex items-center gap-2">
                      <BriefcaseIcon size={16} className="text-orange-400" />
                      Последние вакансии
                    </h2>
                    <Link
                      to="/vacancies"
                      className="text-xs text-white/40 hover:text-orange-400 transition-colors flex items-center gap-1"
                    >
                      Все вакансии
                      <ChevronRight size={12} />
                    </Link>
                  </div>

                  {isLoadingVacancies ? (
                    <div className="space-y-2">
                      <CardSkeleton />
                      <CardSkeleton />
                      <CardSkeleton />
                    </div>
                  ) : recentVacancies.length === 0 ? (
                    <div className="text-center py-8">
                      <BriefcaseIcon size={32} className="mx-auto text-white/15 mb-3" />
                      <p className="text-sm text-white/40 mb-4">Пока нет вакансий</p>
                      <Link
                        to="/vacancies"
                        state={{ showCreate: true }}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 text-white text-sm font-medium hover:shadow-lg hover:shadow-orange-500/20 transition-all"
                      >
                        <Plus size={14} />
                        Создайте первую вакансию
                      </Link>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {recentVacancies.map((vacancy) => (
                        <Link
                          key={vacancy.id}
                          to={`/vacancies/${vacancy.id}`}
                          className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:border-white/[0.1] hover:bg-white/[0.04] transition-all group"
                        >
                          <div className={`w-2 h-2 rounded-full shrink-0 ${getVacancyStatusDot(vacancy.status)}`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate group-hover:text-orange-400 transition-colors">
                              {vacancy.title}
                            </p>
                            <p className="text-[11px] text-white/25 mt-0.5">
                              {formatDate(vacancy.created_at)}
                              {vacancy.location && ` \u00b7 ${vacancy.location}`}
                            </p>
                          </div>
                          <ChevronRight size={14} className="text-white/15 group-hover:text-white/60 shrink-0 transition-colors" />
                        </Link>
                      ))}
                    </div>
                  )}
                </motion.div>

                {/* Recent Candidates */}
                <motion.div
                  className="rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] p-5 sm:p-6 interactive-card"
                  variants={staggerItem}
                  initial="initial"
                  animate="animate"
                >
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-base font-semibold text-white flex items-center gap-2">
                      <Users size={16} className="text-blue-400" />
                      Недавние кандидаты
                    </h2>
                    <Link
                      to="/candidates"
                      className="text-xs text-white/40 hover:text-orange-400 transition-colors flex items-center gap-1"
                    >
                      Все кандидаты
                      <ChevronRight size={12} />
                    </Link>
                  </div>

                  {isLoadingCandidates ? (
                    <div className="space-y-2">
                      <CardSkeleton />
                      <CardSkeleton />
                      <CardSkeleton />
                    </div>
                  ) : recentCandidates.length === 0 ? (
                    <div className="text-center py-6">
                      <Users size={28} className="mx-auto text-white/15 mb-2" />
                      <p className="text-sm text-white/40">Кандидатов пока нет</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {recentCandidates.map((candidate) => (
                        <Link
                          key={candidate.id}
                          to={`/candidates/${candidate.id}`}
                          className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:border-white/[0.1] hover:bg-white/[0.04] transition-all group"
                        >
                          <div className="shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-blue-500/20 to-blue-600/20 border border-blue-500/20">
                            <span className="text-xs font-bold text-blue-400">
                              {candidate.full_name?.charAt(0)?.toUpperCase() || '?'}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate group-hover:text-orange-400 transition-colors">
                              {candidate.full_name}
                            </p>
                            <p className="text-[11px] text-white/25 mt-0.5">
                              {formatDate(candidate.submitted_at)}
                            </p>
                          </div>
                          {candidate.ai_analysis && (
                            <div className={`text-xs font-bold ${getCategoryColor(candidate.ai_analysis.category)}`}>
                              {candidate.ai_analysis.overall_score}
                            </div>
                          )}
                          <ChevronRight size={14} className="text-white/15 group-hover:text-white/60 shrink-0 transition-colors" />
                        </Link>
                      ))}
                    </div>
                  )}
                </motion.div>
              </div>

              {/* RIGHT COLUMN (2/5 = 40%) */}
              <div className="lg:col-span-2 space-y-4 sm:space-y-6">
                {/* Quick Actions */}
                <motion.div
                  className="rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] p-5 sm:p-6 interactive-card"
                  variants={staggerItem}
                  initial="initial"
                  animate="animate"
                >
                  <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
                    <TrendingUp size={16} className="text-orange-400" />
                    Быстрые действия
                  </h2>
                  <div className="grid grid-cols-2 gap-2">
                    {quickActions.map((action) => (
                      <Link
                        key={action.label}
                        to={action.href}
                        state={action.state}
                        className="flex flex-col items-center gap-2 p-4 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:border-orange-500/20 hover:bg-white/[0.05] transition-all text-center group"
                      >
                        <div className="p-2 rounded-lg bg-white/[0.04] group-hover:bg-orange-500/10 transition-colors">
                          <action.icon size={16} className="text-white/60 group-hover:text-orange-400 transition-colors" />
                        </div>
                        <span className="text-[11px] font-medium text-white/60 group-hover:text-white transition-colors">
                          {action.label}
                        </span>
                      </Link>
                    ))}
                  </div>
                </motion.div>

                {/* Upcoming Interviews */}
                <motion.div
                  className="rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] p-5 sm:p-6 interactive-card"
                  variants={staggerItem}
                  initial="initial"
                  animate="animate"
                >
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-base font-semibold text-white flex items-center gap-2">
                      <Calendar size={16} className="text-purple-400" />
                      Ближайшие интервью
                    </h2>
                    <Link
                      to="/interviews"
                      className="text-xs text-white/40 hover:text-orange-400 transition-colors flex items-center gap-1"
                    >
                      Все интервью
                      <ChevronRight size={12} />
                    </Link>
                  </div>

                  {upcoming.length === 0 ? (
                    <div className="text-center py-5">
                      <Calendar size={24} className="mx-auto text-white/15 mb-2" />
                      <p className="text-xs text-white/40">Нет запланированных</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {upcoming.map((interview: Record<string, unknown>, idx: number) => (
                        <div
                          key={(interview.id as string) || idx}
                          className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]"
                        >
                          <div className="shrink-0 p-2 rounded-lg bg-purple-500/10">
                            <Clock size={14} className="text-purple-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">
                              {(interview.candidate_name as string) || 'Кандидат'}
                            </p>
                            <p className="text-[11px] text-white/40">
                              {interview.scheduled_at ? formatDate(interview.scheduled_at as string) : '\u2014'}
                            </p>
                          </div>
                          {interview.type ? (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 font-medium">
                              {String(interview.type)}
                            </span>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>

                {/* Notifications */}
                <motion.div
                  className="rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] p-5 sm:p-6 interactive-card"
                  variants={staggerItem}
                  initial="initial"
                  animate="animate"
                >
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-base font-semibold text-white flex items-center gap-2">
                      <AlertCircle size={16} className="text-yellow-400" />
                      Уведомления
                    </h2>
                  </div>

                  {notifications.length === 0 ? (
                    <div className="text-center py-5">
                      <UserCheck size={24} className="mx-auto text-white/15 mb-2" />
                      <p className="text-xs text-white/40">Новых уведомлений нет</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {notifications.map((notif: Record<string, unknown>, idx: number) => (
                        <div
                          key={(notif.id as string) || idx}
                          className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]"
                        >
                          <div className="shrink-0 mt-0.5 w-2 h-2 rounded-full bg-orange-400" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-white/80 line-clamp-2">
                              {(notif.message as string) || (notif.title as string) || 'Уведомление'}
                            </p>
                            <p className="text-[10px] text-white/25 mt-1">
                              {notif.created_at ? formatDate(notif.created_at as string) : ''}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              </div>
            </div>
          </>
        )}
      </motion.div>

      <AnimatePresence>
        {showOnboarding && (
          <Onboarding
            userName={user?.name || 'пользователь'}
            onComplete={() => {
              setShowOnboarding(false);
              localStorage.setItem('onboarding_complete', '1');
            }}
          />
        )}
      </AnimatePresence>
    </Layout>
  );
}
