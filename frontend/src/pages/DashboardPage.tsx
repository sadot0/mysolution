import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  BriefcaseIcon, Users, BarChart3, Plus, ArrowRight, Clock,
  TrendingUp, Coins, Calendar, ChevronRight, Sparkles,
  FileText, UserCheck, AlertCircle, Settings
} from 'lucide-react';
import Layout from '../components/Layout';
import Onboarding from '../components/Onboarding';
import { useAuthStore } from '../utils/auth-store';
import { vacanciesApi, analyticsApi, tokensApi, notificationsApi, interviewsApi, candidatesApi } from '../utils/api';
import { usePageTitle } from '../utils/usePageTitle';
import { pageVariants, staggerContainer, staggerItem } from '../utils/animations';
import { formatDate, getCategoryColor } from '../utils/helpers';
import { Vacancy, Candidate } from '../types';

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
  const { data: vacanciesData } = useQuery({
    queryKey: ['dashboard-vacancies'],
    queryFn: () => vacanciesApi.list().then(r => r.data.vacancies || []),
  });

  const { data: analyticsData } = useQuery({
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

  const { data: candidatesData } = useQuery({
    queryKey: ['dashboard-candidates'],
    queryFn: () => candidatesApi.listAll({ limit: 5 }).then(r => r.data.candidates || []).catch(() => []),
  });

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

  // Stats cards data
  const stats = [
    {
      label: 'Активные вакансии',
      value: activeVacancies.length,
      icon: BriefcaseIcon,
      href: '/vacancies',
      color: 'text-orange-400',
      bg: 'bg-orange-500/10',
    },
    {
      label: 'Всего кандидатов',
      value: totalCandidates,
      icon: Users,
      href: '/candidates',
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
    },
    {
      label: 'Средний балл AI',
      value: avgScore ? avgScore.toFixed(1) : '—',
      icon: Sparkles,
      href: '/analytics',
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
    },
    {
      label: 'Токены',
      value: tokenBalance.toLocaleString(),
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
      case 'closed': return 'bg-neutral-500';
      default: return 'bg-neutral-500';
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
            <p className="text-sm text-neutral-400 mt-1">
              Вот что происходит в вашем хабе.
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
              className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06] text-neutral-300 text-sm font-medium hover:bg-white/[0.06] hover:border-white/[0.1] transition-all"
            >
              <Users size={14} />
              Все кандидаты
            </Link>
          </div>
        </div>

        {/* Section 2: Stats Overview */}
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
                className="block p-4 sm:p-5 rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] hover:border-white/[0.12] hover:bg-white/[0.05] transition-all group"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className={`p-2 rounded-xl ${stat.bg}`}>
                    <stat.icon size={16} className={stat.color} />
                  </div>
                  <ArrowRight size={14} className="text-neutral-600 group-hover:text-neutral-400 transition-colors" />
                </div>
                <div className="text-2xl sm:text-3xl font-bold text-white mb-1">
                  {stat.value}
                </div>
                <div className="text-xs text-neutral-500">{stat.label}</div>
              </Link>
            </motion.div>
          ))}
        </motion.div>

        {/* Section 3: Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 sm:gap-6">
          {/* LEFT COLUMN (3/5 = 60%) */}
          <div className="lg:col-span-3 space-y-4 sm:space-y-6">
            {/* Recent Vacancies */}
            <motion.div
              className="rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] p-5 sm:p-6"
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
                  className="text-xs text-neutral-500 hover:text-orange-400 transition-colors flex items-center gap-1"
                >
                  Все вакансии
                  <ChevronRight size={12} />
                </Link>
              </div>

              {recentVacancies.length === 0 ? (
                <div className="text-center py-8">
                  <BriefcaseIcon size={32} className="mx-auto text-neutral-700 mb-3" />
                  <p className="text-sm text-neutral-500 mb-4">Пока нет вакансий</p>
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
                        <p className="text-[11px] text-neutral-600 mt-0.5">
                          {formatDate(vacancy.created_at)}
                          {vacancy.location && ` · ${vacancy.location}`}
                        </p>
                      </div>
                      <ChevronRight size={14} className="text-neutral-700 group-hover:text-neutral-400 shrink-0 transition-colors" />
                    </Link>
                  ))}
                </div>
              )}
            </motion.div>

            {/* Recent Candidates */}
            <motion.div
              className="rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] p-5 sm:p-6"
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
                  className="text-xs text-neutral-500 hover:text-orange-400 transition-colors flex items-center gap-1"
                >
                  Все кандидаты
                  <ChevronRight size={12} />
                </Link>
              </div>

              {recentCandidates.length === 0 ? (
                <div className="text-center py-6">
                  <Users size={28} className="mx-auto text-neutral-700 mb-2" />
                  <p className="text-sm text-neutral-500">Кандидатов пока нет</p>
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
                        <p className="text-[11px] text-neutral-600 mt-0.5">
                          {formatDate(candidate.submitted_at)}
                        </p>
                      </div>
                      {candidate.ai_analysis && (
                        <div className={`text-xs font-bold ${getCategoryColor(candidate.ai_analysis.category)}`}>
                          {candidate.ai_analysis.overall_score}
                        </div>
                      )}
                      <ChevronRight size={14} className="text-neutral-700 group-hover:text-neutral-400 shrink-0 transition-colors" />
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
              className="rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] p-5 sm:p-6"
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
                      <action.icon size={16} className="text-neutral-400 group-hover:text-orange-400 transition-colors" />
                    </div>
                    <span className="text-[11px] font-medium text-neutral-400 group-hover:text-white transition-colors">
                      {action.label}
                    </span>
                  </Link>
                ))}
              </div>
            </motion.div>

            {/* Upcoming Interviews */}
            <motion.div
              className="rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] p-5 sm:p-6"
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
                  className="text-xs text-neutral-500 hover:text-orange-400 transition-colors flex items-center gap-1"
                >
                  Все интервью
                  <ChevronRight size={12} />
                </Link>
              </div>

              {upcoming.length === 0 ? (
                <div className="text-center py-5">
                  <Calendar size={24} className="mx-auto text-neutral-700 mb-2" />
                  <p className="text-xs text-neutral-500">Нет запланированных</p>
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
                        <p className="text-[11px] text-neutral-500">
                          {interview.scheduled_at ? formatDate(interview.scheduled_at as string) : '—'}
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
              className="rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] p-5 sm:p-6"
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
                  <UserCheck size={24} className="mx-auto text-neutral-700 mb-2" />
                  <p className="text-xs text-neutral-500">Новых уведомлений нет</p>
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
                        <p className="text-xs text-neutral-300 line-clamp-2">
                          {(notif.message as string) || (notif.title as string) || 'Уведомление'}
                        </p>
                        <p className="text-[10px] text-neutral-600 mt-1">
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
