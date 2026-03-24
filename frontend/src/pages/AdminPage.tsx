import { motion } from 'framer-motion';
import { usePageTitle } from '../utils/usePageTitle';
import { pageVariants } from '../utils/animations';
import { useState } from 'react';
import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import {
  Building2, Users, Briefcase, UserCheck, ShieldAlert, Loader2,
  Crown, ChevronLeft, ChevronRight, ToggleLeft,
  Star, Shield, CheckCircle2, XCircle, BarChart3,
  LayoutDashboard, HeadphonesIcon, Coins, Activity,
  MessageSquare, Send, ChevronDown, ChevronUp,
  Plus, Trash2, Search, Gift,
  TrendingUp, UserPlus, Zap,
} from 'lucide-react';
import Layout from '../components/Layout';
import { useAuthStore } from '../utils/auth-store';
import { adminApi, supportApi, tokensApi } from '../utils/api';

// ─── Types ───────────────────────────────────────────────────────────────────

interface AdminStats {
  organizations: number;
  users: number;
  vacancies: number;
  candidates: number;
}

interface OrgRow {
  id: string;
  name: string;
  slug: string;
  plan: 'free' | 'pro';
  created_at: string;
  users?: { id: string; name: string; email: string };
}

interface UserRow {
  id: string;
  email: string;
  name: string;
  company_name?: string;
  email_verified: boolean;
  role: 'user' | 'superadmin';
  created_at: string;
}

interface SupportTicket {
  id: string;
  user_id: string;
  user_email: string;
  user_name: string;
  category: string;
  subject: string;
  message: string;
  priority: string;
  status: string;
  admin_reply?: string;
  admin_id?: string;
  created_at: string;
  updated_at?: string;
  resolved_at?: string;
}

interface SupportStats {
  total: number;
  open: number;
  in_progress: number;
  resolved: number;
  closed: number;
  by_category: Record<string, number>;
  by_priority: Record<string, number>;
  avg_resolution_hours: number;
}

interface WhitelistEntry {
  id: string;
  email: string;
  note?: string;
  created_at: string;
}

// ─── Tab definitions ─────────────────────────────────────────────────────────

type TabKey = 'dashboard' | 'users' | 'orgs' | 'support' | 'tokens' | 'usage';

const TABS: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: 'dashboard', label: 'ДАШБОРД', icon: LayoutDashboard },
  { key: 'users', label: 'ПОЛЬЗОВАТЕЛИ', icon: Users },
  { key: 'orgs', label: 'ОРГАНИЗАЦИИ', icon: Building2 },
  { key: 'support', label: 'ПОДДЕРЖКА', icon: HeadphonesIcon },
  { key: 'tokens', label: 'ТОКЕНЫ', icon: Coins },
  { key: 'usage', label: 'ИСПОЛЬЗОВАНИЕ', icon: Activity },
];

// ─── Main export ─────────────────────────────────────────────────────────────

export default function AdminPage() {
  usePageTitle('Админ-панель');
  const { user } = useAuthStore();
  const navigate = useNavigate();

  if (user && user.role !== 'superadmin') {
    return (
      <Layout>
        <div className="p-4 md:p-8 max-w-2xl mx-auto page-content flex flex-col items-center justify-center min-h-[60vh]">
          <div className="w-[72px] h-[72px] flex items-center justify-center mb-5 bg-red-500/10 border border-red-500/25 rounded-2xl">
            <ShieldAlert size={32} className="text-red-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Доступ запрещён</h2>
          <p className="text-sm mb-6 text-white/60">
            Эта страница доступна только суперадминистраторам.
          </p>
          <button className="btn-secondary" onClick={() => navigate('/vacancies')}>
            На главную
          </button>
        </div>
      </Layout>
    );
  }

  return <AdminContent />;
}

// ─── AdminContent ────────────────────────────────────────────────────────────

function AdminContent() {
  const [activeTab, setActiveTab] = useState<TabKey>('dashboard');

  return (
    <Layout>
      <motion.div variants={pageVariants} initial="initial" animate="animate" className="p-4 md:p-8 max-w-7xl mx-auto page-content">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 bg-red-500/10 border border-red-500/25 rounded-xl flex items-center justify-center">
              <ShieldAlert size={17} className="text-red-400" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-wider">АДМИН-ПАНЕЛЬ</h1>
          </div>
          <p className="text-sm text-white/60 ml-12">
            Управление SOLUTION HUB
          </p>
        </div>

        {/* Tab bar */}
        <div className="mb-6 -mx-4 px-4 overflow-x-auto scrollbar-hide">
          <div className="flex items-center gap-1 min-w-max bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-xl p-1">
            {TABS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-medium tracking-wider transition-all duration-200 whitespace-nowrap ${
                  activeTab === key
                    ? 'bg-orange-500/15 text-orange-400 border border-orange-500/30'
                    : 'text-white/60 hover:text-white/80 hover:bg-white/[0.04] border border-transparent'
                }`}
              >
                <Icon size={14} />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        {activeTab === 'dashboard' && <DashboardTab />}
        {activeTab === 'users' && <UsersTab />}
        {activeTab === 'orgs' && <OrgsTab />}
        {activeTab === 'support' && <SupportTab />}
        {activeTab === 'tokens' && <TokensTab />}
        {activeTab === 'usage' && <UsageTab />}
      </motion.div>
    </Layout>
  );
}

// ─── Tab 1: ДАШБОРД ─────────────────────────────────────────────────────────

function DashboardTab() {
  const { data: statsData, isLoading, dataUpdatedAt } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => adminApi.getStats().then((r) => r.data.stats as AdminStats),
  });

  const { data: supportStatsData } = useQuery({
    queryKey: ['admin-support-stats'],
    queryFn: () => supportApi.getStats().then((r) => r.data.stats as SupportStats).catch((e) => { console.error('Ошибка загрузки статистики поддержки:', e); return null; }),
  });

  const { data: tokenStatsData } = useQuery({
    queryKey: ['admin-token-stats'],
    queryFn: () => tokensApi.getAdminStats().then((r) => r.data).catch((e) => { console.error('Ошибка загрузки статистики токенов:', e); return null; }),
  });

  const { data: usageData } = useQuery({
    queryKey: ['admin-usage'],
    queryFn: () => adminApi.getUsage().then((r) => r.data).catch((e) => { console.error('Ошибка загрузки данных использования:', e); return null; }),
  });

  const stats: AdminStats = statsData || { organizations: 0, users: 0, vacancies: 0, candidates: 0 };
  const supportStats = supportStatsData as SupportStats | null;
  const tokenStats = tokenStatsData as Record<string, number> | null;
  const usage = usageData as { active_today?: number; new_this_week?: number; recent_logs?: Array<{ action: string; user_email?: string; created_at: string; details?: string }> } | null;

  const statCards = [
    { label: 'ОРГАНИЗАЦИИ', value: stats.organizations, icon: Building2, color: 'text-orange-500', iconBg: 'bg-orange-500/10 border-orange-500/20', glow: 'shadow-orange-500/5' },
    { label: 'ПОЛЬЗОВАТЕЛИ', value: stats.users, icon: Users, color: 'text-blue-400', iconBg: 'bg-blue-500/10 border-blue-500/20', glow: 'shadow-blue-500/5' },
    { label: 'ВАКАНСИИ', value: stats.vacancies, icon: Briefcase, color: 'text-emerald-500', iconBg: 'bg-emerald-500/10 border-emerald-500/20', glow: 'shadow-emerald-500/5' },
    { label: 'КАНДИДАТЫ', value: stats.candidates, icon: UserCheck, color: 'text-purple-400', iconBg: 'bg-purple-500/10 border-purple-500/20', glow: 'shadow-purple-500/5' },
    { label: 'ТИКЕТЫ (ОТКР.)', value: supportStats?.open ?? 0, icon: HeadphonesIcon, color: 'text-yellow-400', iconBg: 'bg-yellow-500/10 border-yellow-500/20', glow: 'shadow-yellow-500/5' },
    { label: 'ТОКЕНЫ (ПРОДАНО)', value: tokenStats?.total_purchased ?? 0, icon: Coins, color: 'text-cyan-400', iconBg: 'bg-cyan-500/10 border-cyan-500/20', glow: 'shadow-cyan-500/5' },
  ];

  const quickMetrics = [
    { label: 'Активных сегодня', value: usage?.active_today ?? 0, icon: Zap, color: 'text-green-400' },
    { label: 'Регистраций за неделю', value: usage?.new_this_week ?? 0, icon: UserPlus, color: 'text-blue-400' },
  ];

  const recentLogs = usage?.recent_logs ?? [];


  if (isLoading) return <div className="flex items-center justify-center py-20"><Loader2 className="animate-spin text-orange-500" size={32} /></div>;
  return (
    <div className="space-y-6">
      {dataUpdatedAt > 0 && (
        <div className="flex justify-end">
          <span className="text-xs text-white/25">
            Обновлено: {new Date(dataUpdatedAt).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      )}
      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {statCards.map(({ label, value, icon: Icon, color, iconBg, glow }) => (
          <div key={label} className={`bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-2xl p-4 shadow-lg ${glow} hover:border-white/[0.1] transition-all duration-300`}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-medium text-white/60 tracking-wider leading-tight">{label}</p>
              <div className={`w-8 h-8 rounded-lg border flex items-center justify-center ${iconBg}`}>
                <Icon size={15} className={color} />
              </div>
            </div>
            <p className={`text-2xl font-bold font-mono ${color}`}>{value.toLocaleString()}</p>
          </div>
        ))}
      </div>

      {/* Quick metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {quickMetrics.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-2xl p-5 flex items-center gap-4 hover:border-white/[0.1] transition-all">
            <div className="w-12 h-12 rounded-xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-center">
              <Icon size={20} className={color} />
            </div>
            <div>
              <p className="text-xs text-white/60 tracking-wider">{label}</p>
              <p className={`text-2xl font-bold font-mono ${color}`}>{value.toLocaleString()}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Economics Block ── */}
      <EconomicsBlock stats={stats} tokenStats={tokenStats} supportStats={supportStats} />

      {/* Recent activity */}
      <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-2xl p-4 md:p-6">
        <h3 className="text-sm font-medium text-white/70 tracking-wider flex items-center gap-2 mb-4">
          <div className="w-7 h-7 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
            <Activity size={14} className="text-orange-500" />
          </div>
          ПОСЛЕДНЯЯ АКТИВНОСТЬ
        </h3>
        {recentLogs.length === 0 ? (
          <p className="text-sm text-white/40 text-center py-8">Нет данных об активности</p>
        ) : (
          <div className="space-y-2">
            {recentLogs.slice(0, 10).map((log, i) => (
              <div key={i} className="flex items-center gap-3 py-2.5 px-3 rounded-lg bg-white/[0.02] border border-white/[0.04] hover:border-white/[0.08] transition-all">
                <div className="w-2 h-2 rounded-full bg-orange-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white/80 truncate">
                    <span className="text-orange-400 font-medium">{log.action}</span>
                    {log.user_email && (
                      <span className="text-white/40 ml-2">{log.user_email}</span>
                    )}
                  </p>
                  {log.details && (
                    <p className="text-xs text-white/40 truncate">{log.details}</p>
                  )}
                </div>
                <span className="text-[10px] text-white/25 font-mono whitespace-nowrap">
                  {new Date(log.created_at).toLocaleString('ru', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Economics Block ─────────────────────────────────────────────────────────

function EconomicsBlock({
  stats,
  tokenStats,
  supportStats,
}: {
  stats: AdminStats;
  tokenStats: Record<string, unknown> | null;
  supportStats: SupportStats | null;
}) {
  // Token pricing (matches backend token_plans)
  const TOKEN_COST_US = 0.01; // our cost per token ~$0.01
  const TOKEN_SELL_AVG = 0.022; // avg sell price per token ~$0.022

  const tStats = (tokenStats?.stats || tokenStats || {}) as Record<string, number>;
  const totalTokensSold = tStats.total_purchased ?? 0;
  const totalTokensUsed = tStats.total_tokens_used ?? 0;
  const totalBalanceInSystem = tStats.total_balance_in_system ?? 0;
  const activeUsers = tStats.active_users ?? 0;

  // Revenue calculations
  const grossRevenue = totalTokensSold * TOKEN_SELL_AVG;
  const cogs = totalTokensUsed * TOKEN_COST_US; // cost of goods sold (AI API calls)
  const grossProfit = grossRevenue - cogs;
  const margin = grossRevenue > 0 ? (grossProfit / grossRevenue) * 100 : 0;

  // Per-user metrics
  const arpu = stats.users > 0 ? grossRevenue / stats.users : 0; // avg revenue per user
  const tokensPerUser = stats.users > 0 ? totalTokensUsed / stats.users : 0;

  // Projections (simple linear, monthly)
  const monthlyRevenueProjection = grossRevenue * 4; // assuming data is ~1 week
  const monthlyUsersProjection = stats.users * 1.2; // 20% growth

  // Conversion
  const conversionRate = stats.users > 0 ? ((activeUsers / stats.users) * 100) : 0;
  const candidatesPerVacancy = stats.vacancies > 0 ? (stats.candidates / stats.vacancies) : 0;

  const econCards = [
    { label: 'ВЫРУЧКА (USD)', value: `$${grossRevenue.toFixed(2)}`, sub: `${totalTokensSold.toLocaleString()} токенов продано`, color: 'text-emerald-400', border: 'border-t-emerald-500' },
    { label: 'РАСХОДЫ (AI)', value: `$${cogs.toFixed(2)}`, sub: `${totalTokensUsed.toLocaleString()} токенов использовано`, color: 'text-red-400', border: 'border-t-red-500' },
    { label: 'ПРИБЫЛЬ', value: `$${grossProfit.toFixed(2)}`, sub: `Маржа: ${margin.toFixed(0)}%`, color: grossProfit >= 0 ? 'text-emerald-400' : 'text-red-400', border: 'border-t-orange-500' },
    { label: 'ARPU', value: `$${arpu.toFixed(2)}`, sub: `${tokensPerUser.toFixed(0)} ток/юзер`, color: 'text-blue-400', border: 'border-t-blue-500' },
    { label: 'КОНВЕРСИЯ', value: `${conversionRate.toFixed(1)}%`, sub: `${activeUsers} из ${stats.users} активны`, color: 'text-purple-400', border: 'border-t-purple-500' },
    { label: 'КАНД/ВАКАНСИЯ', value: candidatesPerVacancy.toFixed(1), sub: `${stats.candidates} кандидатов`, color: 'text-cyan-400', border: 'border-t-cyan-500' },
  ];

  const projections = [
    { label: 'Прогноз выручки/мес', value: `$${monthlyRevenueProjection.toFixed(0)}`, icon: TrendingUp, color: 'text-emerald-400' },
    { label: 'Прогноз юзеров/мес', value: Math.round(monthlyUsersProjection).toLocaleString(), icon: UserPlus, color: 'text-blue-400' },
    { label: 'Токенов в обороте', value: totalBalanceInSystem.toLocaleString(), icon: Coins, color: 'text-orange-400' },
    { label: 'Тикетов открыто', value: String(supportStats?.open ?? 0), icon: HeadphonesIcon, color: 'text-yellow-400' },
  ];

  return (
    <div className="space-y-4">
      {/* Section header */}
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
          <TrendingUp size={14} className="text-emerald-500" />
        </div>
        <h3 className="text-sm font-medium text-white/70 tracking-wider">ЭКОНОМИКА</h3>
      </div>

      {/* Main economics cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {econCards.map(({ label, value, sub, color, border }) => (
          <div key={label} className={`bg-white/[0.03] border border-white/[0.06] ${border} border-t-2 rounded-xl p-4 hover:border-white/[0.1] transition-all`}>
            <p className="text-[10px] font-medium text-white/40 tracking-wider mb-2">{label}</p>
            <p className={`text-xl font-bold font-mono ${color} mb-1`}>{value}</p>
            <p className="text-[10px] text-white/25">{sub}</p>
          </div>
        ))}
      </div>

      {/* Projections row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {projections.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white/[0.02] border border-white/[0.04] rounded-xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-white/[0.02] border border-white/[0.06] flex items-center justify-center shrink-0">
              <Icon size={16} className={color} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] text-white/40 tracking-wider truncate">{label}</p>
              <p className={`text-lg font-bold font-mono ${color}`}>{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Margin indicator bar */}
      <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-2xl p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-white/60 tracking-wider">МАРЖИНАЛЬНОСТЬ</span>
          <span className={`text-sm font-bold font-mono ${margin >= 50 ? 'text-emerald-400' : margin >= 20 ? 'text-orange-400' : 'text-red-400'}`}>
            {margin.toFixed(1)}%
          </span>
        </div>
        <div className="w-full h-3 bg-white/[0.02] rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-1000 ${
              margin >= 50 ? 'bg-gradient-to-r from-emerald-600 to-emerald-400' :
              margin >= 20 ? 'bg-gradient-to-r from-orange-600 to-orange-400' :
              'bg-gradient-to-r from-red-600 to-red-400'
            }`}
            style={{ width: `${Math.min(Math.max(margin, 0), 100)}%` }}
          />
        </div>
        <div className="flex justify-between mt-2 text-[10px] text-white/25">
          <span>Выручка: ${grossRevenue.toFixed(2)}</span>
          <span>Расходы: ${cogs.toFixed(2)}</span>
          <span>Чистая: ${grossProfit.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Tab 2: ПОЛЬЗОВАТЕЛИ ────────────────────────────────────────────────────

function UsersTab() {
  const qc = useQueryClient();
  const [userPage, setUserPage] = useState(1);
  const LIMIT = 20;

  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ['admin-users', userPage],
    queryFn: () => adminApi.getUsers(userPage, LIMIT).then((r) => r.data),
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: 'user' | 'superadmin' }) =>
      adminApi.updateUserRole(id, role),
    onSuccess: () => {
      toast.success('Роль обновлена');
      qc.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: () => toast.error('Ошибка обновления роли'),
  });

  const users: UserRow[] = usersData?.users || [];
  const userTotal: number = usersData?.total || 0;


  if (usersLoading) return <div className="flex items-center justify-center py-20"><Loader2 className="animate-spin text-orange-500" size={32} /></div>;
  return (
    <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-2xl p-4 md:p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-white/70 tracking-wider flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
            <Users size={14} className="text-blue-400" />
          </div>
          ПОЛЬЗОВАТЕЛИ
          <span className="text-white/40 font-mono text-xs ml-1">({userTotal})</span>
        </h3>
        <Pagination
          page={userPage}
          total={userTotal}
          limit={LIMIT}
          onPrev={() => setUserPage((p) => Math.max(1, p - 1))}
          onNext={() => setUserPage((p) => p + 1)}
        />
      </div>

      <div className="relative">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[750px]">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-white/[0.04] bg-white/[0.03]">
                {['Имя / Email', 'Компания', 'Роль', 'Верифицирован', 'Дата', 'Действие'].map((h) => (
                  <th key={h} className="text-left py-3 px-3 text-xs font-semibold text-white/60 tracking-wider uppercase">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u, i) => (
                <tr
                  key={u.id}
                  className={`border-b border-white/[0.04] transition-all duration-200 hover:bg-white/[0.04] hover:border-l-2 hover:border-l-orange-500 ${
                    i % 2 === 1 ? 'bg-white/[0.01]' : ''
                  }`}
                >
                  <td className="py-3.5 px-3">
                    <p className="text-sm font-medium text-white">{u.name}</p>
                    <p className="text-xs text-white/40">{u.email}</p>
                  </td>
                  <td className="py-3.5 px-3">
                    <span className="text-sm text-white/60">{u.company_name || '—'}</span>
                  </td>
                  <td className="py-3.5 px-3">
                    <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium tracking-wider ${
                      u.role === 'superadmin'
                        ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                        : 'bg-white/[0.02] text-white/60 border border-white/[0.06]'
                    }`}>
                      {u.role === 'superadmin' ? <Crown size={11} /> : <UserCheck size={11} />}
                      {u.role === 'superadmin' ? 'ADMIN' : 'USER'}
                    </span>
                  </td>
                  <td className="py-3.5 px-3">
                    <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium tracking-wider ${
                      u.email_verified
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                        : 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/30'
                    }`}>
                      {u.email_verified ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
                      {u.email_verified ? 'ДА' : 'НЕТ'}
                    </span>
                  </td>
                  <td className="py-3.5 px-3">
                    <span className="text-xs text-white/40 font-mono">
                      {new Date(u.created_at).toLocaleDateString('ru')}
                    </span>
                  </td>
                  <td className="py-3.5 px-3">
                    <button
                      className={`btn-secondary text-xs px-3 py-1.5 ${u.role === 'superadmin' ? 'border-red-500/30 text-red-400' : ''}`}
                      disabled={updateRoleMutation.isPending}
                      onClick={() =>
                        updateRoleMutation.mutate({
                          id: u.id,
                          role: u.role === 'superadmin' ? 'user' : 'superadmin',
                        })
                      }
                    >
                      <Shield size={11} />
                      {u.role === 'superadmin' ? 'User' : 'Admin'}
                    </button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-white/40 text-sm">
                    Нет пользователей
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="absolute top-0 right-0 bottom-0 w-8 bg-gradient-to-l from-black to-transparent pointer-events-none md:hidden" />
      </div>
    </div>
  );
}

// ─── Tab 3: ОРГАНИЗАЦИИ ─────────────────────────────────────────────────────

function OrgsTab() {
  const qc = useQueryClient();
  const [orgPage, setOrgPage] = useState(1);
  const LIMIT = 20;

  const { data: orgsData, isLoading: orgsLoading } = useQuery({
    queryKey: ['admin-orgs', orgPage],
    queryFn: () => adminApi.getOrgs(orgPage, LIMIT).then((r) => r.data),
  });

  const updatePlanMutation = useMutation({
    mutationFn: ({ id, plan }: { id: string; plan: 'free' | 'pro' }) =>
      adminApi.updateOrgPlan(id, plan),
    onSuccess: () => {
      toast.success('План обновлён');
      qc.invalidateQueries({ queryKey: ['admin-orgs'] });
    },
    onError: () => toast.error('Ошибка обновления плана'),
  });

  const orgs: OrgRow[] = orgsData?.organizations || [];
  const orgTotal: number = orgsData?.total || 0;


  if (orgsLoading) return <div className="flex items-center justify-center py-20"><Loader2 className="animate-spin text-orange-500" size={32} /></div>;
  return (
    <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-2xl p-4 md:p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-white/70 tracking-wider flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
            <Building2 size={14} className="text-orange-500" />
          </div>
          ОРГАНИЗАЦИИ
          <span className="text-white/40 font-mono text-xs ml-1">({orgTotal})</span>
        </h3>
        <Pagination
          page={orgPage}
          total={orgTotal}
          limit={LIMIT}
          onPrev={() => setOrgPage((p) => Math.max(1, p - 1))}
          onNext={() => setOrgPage((p) => p + 1)}
        />
      </div>

      <div className="relative">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-white/[0.04] bg-white/[0.03]">
                {['Название', 'Slug', 'Владелец', 'План', 'Дата', 'Действие'].map((h) => (
                  <th key={h} className="text-left py-3 px-3 text-xs font-semibold text-white/60 tracking-wider uppercase">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orgs.map((org, i) => (
                <tr
                  key={org.id}
                  className={`border-b border-white/[0.04] transition-all duration-200 hover:bg-white/[0.04] hover:border-l-2 hover:border-l-orange-500 ${
                    i % 2 === 1 ? 'bg-white/[0.01]' : ''
                  }`}
                >
                  <td className="py-3.5 px-3">
                    <p className="text-sm font-medium text-white">{org.name}</p>
                  </td>
                  <td className="py-3.5 px-3">
                    <code className="text-xs text-white/40 font-mono bg-white/[0.04] px-1.5 py-0.5 rounded">{org.slug}</code>
                  </td>
                  <td className="py-3.5 px-3">
                    <p className="text-sm text-white/70">{org.users?.name}</p>
                    <p className="text-xs text-white/40">{org.users?.email}</p>
                  </td>
                  <td className="py-3.5 px-3">
                    <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full tracking-wider font-medium ${
                      org.plan === 'pro'
                        ? 'bg-purple-500/15 text-purple-400 border border-purple-500/30'
                        : 'bg-white/[0.02] text-white/60 border border-white/[0.06]'
                    }`}>
                      {org.plan === 'pro' && <Star size={10} />}
                      {org.plan === 'pro' ? 'PRO' : 'FREE'}
                    </span>
                  </td>
                  <td className="py-3.5 px-3">
                    <span className="text-xs text-white/40 font-mono">
                      {new Date(org.created_at).toLocaleDateString('ru')}
                    </span>
                  </td>
                  <td className="py-3.5 px-3">
                    <button
                      className="btn-secondary text-xs px-3 py-1.5"
                      disabled={updatePlanMutation.isPending}
                      onClick={() =>
                        updatePlanMutation.mutate({
                          id: org.id,
                          plan: org.plan === 'pro' ? 'free' : 'pro',
                        })
                      }
                    >
                      <ToggleLeft size={12} />
                      {org.plan === 'pro' ? 'Free' : 'Pro'}
                    </button>
                  </td>
                </tr>
              ))}
              {orgs.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-white/40 text-sm">
                    Нет организаций
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="absolute top-0 right-0 bottom-0 w-8 bg-gradient-to-l from-black to-transparent pointer-events-none md:hidden" />
      </div>
    </div>
  );
}

// ─── Tab 4: ПОДДЕРЖКА ────────────────────────────────────────────────────────

function SupportTab() {
  const qc = useQueryClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replyStatus, setReplyStatus] = useState('');

  const { data: statsData, isLoading: supportLoading } = useQuery({
    queryKey: ['admin-support-stats'],
    queryFn: () => supportApi.getStats().then((r) => r.data.stats as SupportStats).catch((e) => { console.error('Ошибка загрузки статистики поддержки:', e); return null; }),
  });

  const { data: ticketsData } = useQuery({
    queryKey: ['admin-support-tickets'],
    queryFn: () => supportApi.getAllTickets().then((r) => r.data.tickets as SupportTicket[]).catch((e) => { console.error('Ошибка загрузки тикетов:', e); return []; }),
  });

  const replyMutation = useMutation({
    mutationFn: ({ id, reply, status }: { id: string; reply: string; status?: string }) =>
      supportApi.reply(id, reply, status),
    onSuccess: () => {
      toast.success('Ответ отправлен');
      setReplyText('');
      setReplyStatus('');
      qc.invalidateQueries({ queryKey: ['admin-support-tickets'] });
      qc.invalidateQueries({ queryKey: ['admin-support-stats'] });
    },
    onError: () => toast.error('Ошибка отправки ответа'),
  });

  const stats = statsData as SupportStats | null;
  const tickets = (ticketsData as SupportTicket[] | null) ?? [];

  const statusColors: Record<string, string> = {
    open: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
    in_progress: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    resolved: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    closed: 'bg-white/[0.02] text-white/60 border-white/[0.06]',
  };

  const statusLabels: Record<string, string> = {
    open: 'Открыт',
    in_progress: 'В работе',
    resolved: 'Решён',
    closed: 'Закрыт',
  };

  const priorityColors: Record<string, string> = {
    urgent: 'bg-red-500/15 text-red-400 border-red-500/30',
    high: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
    medium: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
    low: 'bg-white/[0.02] text-white/60 border-white/[0.06]',
  };

  const categoryLabels: Record<string, string> = {
    bug: 'Баг',
    feature: 'Фича',
    question: 'Вопрос',
    billing: 'Оплата',
    other: 'Другое',
  };

  const supportStatCards = [
    { label: 'ВСЕГО', value: stats?.total ?? 0, color: 'text-white/80' },
    { label: 'ОТКРЫТО', value: stats?.open ?? 0, color: 'text-yellow-400' },
    { label: 'В РАБОТЕ', value: stats?.in_progress ?? 0, color: 'text-blue-400' },
    { label: 'РЕШЕНО', value: stats?.resolved ?? 0, color: 'text-emerald-400' },
  ];


  if (supportLoading) return <div className="flex items-center justify-center py-20"><Loader2 className="animate-spin text-orange-500" size={32} /></div>;
  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {supportStatCards.map(({ label, value, color }) => (
          <div key={label} className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-2xl p-4">
            <p className="text-[10px] font-medium text-white/60 tracking-wider mb-2">{label}</p>
            <p className={`text-2xl font-bold font-mono ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Category breakdown */}
      {stats?.by_category && (
        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-2xl p-4 md:p-6">
          <h4 className="text-xs font-medium text-white/60 tracking-wider mb-3">ПО КАТЕГОРИЯМ</h4>
          <div className="flex flex-wrap gap-3">
            {Object.entries(stats.by_category).map(([cat, count]) => (
              <div key={cat} className="flex items-center gap-2 px-3 py-1.5 bg-white/[0.02] rounded-lg border border-white/[0.06]">
                <span className="text-xs text-white/70">{categoryLabels[cat] || cat}</span>
                <span className="text-xs font-mono text-orange-400">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tickets table */}
      <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-2xl p-4 md:p-6">
        <h3 className="text-sm font-medium text-white/70 tracking-wider flex items-center gap-2 mb-4">
          <div className="w-7 h-7 rounded-lg bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center">
            <MessageSquare size={14} className="text-yellow-400" />
          </div>
          ВСЕ ОБРАЩЕНИЯ
          <span className="text-white/40 font-mono text-xs ml-1">({tickets.length})</span>
        </h3>

        <div className="space-y-2">
          {tickets.map((ticket) => {
            const isExpanded = expandedId === ticket.id;
            return (
              <div key={ticket.id} className="border border-white/[0.04] rounded-lg overflow-hidden hover:border-white/[0.08] transition-all">
                {/* Ticket row */}
                <button
                  onClick={() => {
                    setExpandedId(isExpanded ? null : ticket.id);
                    setReplyText(ticket.admin_reply || '');
                    setReplyStatus(ticket.status);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.03] transition-all"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-sm font-medium text-white truncate">{ticket.subject}</span>
                      <span className={`inline-flex text-[10px] px-2 py-0.5 rounded-full border font-medium tracking-wider ${statusColors[ticket.status] || statusColors.open}`}>
                        {statusLabels[ticket.status] || ticket.status}
                      </span>
                      <span className={`inline-flex text-[10px] px-2 py-0.5 rounded-full border font-medium tracking-wider ${priorityColors[ticket.priority] || priorityColors.medium}`}>
                        {ticket.priority?.toUpperCase()}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-white/40">
                      <span>{ticket.user_name || ticket.user_email}</span>
                      <span>{categoryLabels[ticket.category] || ticket.category}</span>
                      <span className="font-mono">{new Date(ticket.created_at).toLocaleDateString('ru')}</span>
                    </div>
                  </div>
                  {isExpanded ? <ChevronUp size={16} className="text-white/60 shrink-0" /> : <ChevronDown size={16} className="text-white/60 shrink-0" />}
                </button>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-white/[0.04] bg-white/[0.01]">
                    <div className="py-3">
                      <p className="text-xs text-white/60 tracking-wider mb-1">СООБЩЕНИЕ</p>
                      <p className="text-sm text-white/80 whitespace-pre-wrap">{ticket.message}</p>
                    </div>

                    {ticket.admin_reply && (
                      <div className="py-3 border-t border-white/[0.04]">
                        <p className="text-xs text-white/60 tracking-wider mb-1">ПРЕДЫДУЩИЙ ОТВЕТ</p>
                        <p className="text-sm text-white/70 whitespace-pre-wrap">{ticket.admin_reply}</p>
                      </div>
                    )}

                    <div className="pt-3 border-t border-white/[0.04] space-y-3">
                      <div>
                        <label className="text-xs text-white/60 tracking-wider block mb-1">ОТВЕТ</label>
                        <textarea
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          rows={3}
                          className="input w-full text-sm"
                          placeholder="Введите ответ..."
                        />
                      </div>
                      <div className="flex items-center gap-3">
                        <div>
                          <label className="text-xs text-white/60 tracking-wider block mb-1">СТАТУС</label>
                          <select
                            value={replyStatus}
                            onChange={(e) => setReplyStatus(e.target.value)}
                            className="select-premium text-xs"
                          >
                            <option value="open">Открыт</option>
                            <option value="in_progress">В работе</option>
                            <option value="resolved">Решён</option>
                            <option value="closed">Закрыт</option>
                          </select>
                        </div>
                        <button
                          className="btn-primary text-xs px-4 py-2 mt-4"
                          disabled={!replyText.trim() || replyMutation.isPending}
                          onClick={() => replyMutation.mutate({ id: ticket.id, reply: replyText, status: replyStatus || undefined })}
                        >
                          <Send size={12} />
                          Отправить
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {tickets.length === 0 && (
            <p className="text-sm text-white/40 text-center py-12">Нет обращений</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Tab 5: ТОКЕНЫ ───────────────────────────────────────────────────────────

function TokensTab() {
  const qc = useQueryClient();
  const [whitelistEmail, setWhitelistEmail] = useState('');
  const [whitelistNote, setWhitelistNote] = useState('');
  const [bonusEmail, setBonusEmail] = useState('');
  const [bonusAmount, setBonusAmount] = useState('');

  const { data: tokenStatsData, isLoading: tokensLoading } = useQuery({
    queryKey: ['admin-token-stats'],
    queryFn: () => tokensApi.getAdminStats().then((r) => r.data).catch((e) => { console.error('Ошибка загрузки статистики токенов:', e); return null; }),
  });

  const { data: whitelistData } = useQuery({
    queryKey: ['admin-whitelist'],
    queryFn: () => tokensApi.getWhitelist().then((r) => r.data.whitelist as WhitelistEntry[]).catch((e) => { console.error('Ошибка загрузки белого списка:', e); return []; }),
  });

  const addWhitelistMutation = useMutation({
    mutationFn: ({ email, note }: { email: string; note?: string }) =>
      tokensApi.addToWhitelist(email, note),
    onSuccess: () => {
      toast.success('Email добавлен в whitelist');
      setWhitelistEmail('');
      setWhitelistNote('');
      qc.invalidateQueries({ queryKey: ['admin-whitelist'] });
    },
    onError: () => toast.error('Ошибка добавления'),
  });

  const removeWhitelistMutation = useMutation({
    mutationFn: (id: string) => tokensApi.removeFromWhitelist(id),
    onSuccess: () => {
      toast.success('Удалено из whitelist');
      qc.invalidateQueries({ queryKey: ['admin-whitelist'] });
    },
    onError: () => toast.error('Ошибка удаления'),
  });

  const giveBonusMutation = useMutation({
    mutationFn: ({ email, amount }: { email: string; amount: number }) =>
      tokensApi.giveBonus(email, amount, 'Admin bonus'),
    onSuccess: () => {
      toast.success('Токены начислены');
      setBonusEmail('');
      setBonusAmount('');
      qc.invalidateQueries({ queryKey: ['admin-token-stats'] });
    },
    onError: () => toast.error('Ошибка начисления'),
  });

  const tokenStats = tokenStatsData as Record<string, number> | null;
  const whitelist = (whitelistData as WhitelistEntry[] | null) ?? [];

  const tokenStatCards = [
    { label: 'ВСЕГО В СИСТЕМЕ', value: tokenStats?.total_in_system ?? 0, color: 'text-cyan-400', icon: Coins },
    { label: 'ИСПОЛЬЗОВАНО', value: tokenStats?.total_used ?? 0, color: 'text-orange-400', icon: Zap },
    { label: 'КУПЛЕНО', value: tokenStats?.total_purchased ?? 0, color: 'text-emerald-400', icon: TrendingUp },
    { label: 'АКТИВНЫЕ ЮЗЕРЫ', value: tokenStats?.active_users ?? 0, color: 'text-blue-400', icon: Users },
  ];


  if (tokensLoading) return <div className="flex items-center justify-center py-20"><Loader2 className="animate-spin text-orange-500" size={32} /></div>;
  return (
    <div className="space-y-6">
      {/* Token stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {tokenStatCards.map(({ label, value, color, icon: Icon }) => (
          <div key={label} className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-2xl p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-medium text-white/60 tracking-wider">{label}</p>
              <Icon size={14} className={color} />
            </div>
            <p className={`text-2xl font-bold font-mono ${color}`}>{(value ?? 0).toLocaleString()}</p>
          </div>
        ))}
      </div>

      {/* Whitelist management */}
      <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-2xl p-4 md:p-6">
        <h3 className="text-sm font-medium text-white/70 tracking-wider flex items-center gap-2 mb-4">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
            <CheckCircle2 size={14} className="text-emerald-400" />
          </div>
          WHITELIST
        </h3>

        {/* Add form */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <input
            type="email"
            value={whitelistEmail}
            onChange={(e) => setWhitelistEmail(e.target.value)}
            placeholder="Email для whitelist"
            className="input flex-1 text-sm"
          />
          <input
            type="text"
            value={whitelistNote}
            onChange={(e) => setWhitelistNote(e.target.value)}
            placeholder="Заметка (необязательно)"
            className="input flex-1 text-sm"
          />
          <button
            className="btn-primary text-xs px-4 py-2 whitespace-nowrap"
            disabled={!whitelistEmail.trim() || addWhitelistMutation.isPending}
            onClick={() => addWhitelistMutation.mutate({ email: whitelistEmail.trim(), note: whitelistNote.trim() || undefined })}
          >
            <Plus size={12} />
            Добавить
          </button>
        </div>

        {/* Whitelist entries */}
        <div className="space-y-2">
          {whitelist.map((entry) => (
            <div key={entry.id} className="flex items-center justify-between gap-3 px-3 py-2.5 bg-white/[0.02] border border-white/[0.04] rounded-lg">
              <div className="min-w-0">
                <p className="text-sm text-white/80 truncate">{entry.email}</p>
                {entry.note && <p className="text-xs text-white/40 truncate">{entry.note}</p>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] text-white/25 font-mono">
                  {new Date(entry.created_at).toLocaleDateString('ru')}
                </span>
                <button
                  className="w-7 h-7 flex items-center justify-center rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all"
                  onClick={() => { if (confirm('Удалить из whitelist?')) removeWhitelistMutation.mutate(entry.id); }}
                  disabled={removeWhitelistMutation.isPending}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
          {whitelist.length === 0 && (
            <p className="text-xs text-white/40 text-center py-4">Whitelist пуст</p>
          )}
        </div>
      </div>

      {/* Bonus tokens */}
      <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-2xl p-4 md:p-6">
        <h3 className="text-sm font-medium text-white/70 tracking-wider flex items-center gap-2 mb-4">
          <div className="w-7 h-7 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
            <Gift size={14} className="text-purple-400" />
          </div>
          БОНУСНЫЕ ТОКЕНЫ
        </h3>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
            <input
              type="email"
              value={bonusEmail}
              onChange={(e) => setBonusEmail(e.target.value)}
              placeholder="Email пользователя"
              className="input w-full text-sm pl-9"
            />
          </div>
          <input
            type="number"
            value={bonusAmount}
            onChange={(e) => setBonusAmount(e.target.value)}
            placeholder="Кол-во токенов"
            className="input w-32 text-sm"
            min="1"
          />
          <button
            className="btn-primary text-xs px-4 py-2 whitespace-nowrap"
            disabled={!bonusEmail.trim() || !bonusAmount || Number(bonusAmount) <= 0 || giveBonusMutation.isPending}
            onClick={() => giveBonusMutation.mutate({ email: bonusEmail.trim(), amount: Number(bonusAmount) })}
          >
            <Gift size={12} />
            Начислить
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Tab 6: ИСПОЛЬЗОВАНИЕ ───────────────────────────────────────────────────

function UsageTab() {
  const { data: usageData, isLoading: usageLoading } = useQuery({
    queryKey: ['admin-usage'],
    queryFn: () => adminApi.getUsage().then((r) => r.data).catch((e) => { console.error('Ошибка загрузки данных использования:', e); return null; }),
  });

  const usage = usageData as {
    total_actions?: number;
    active_today?: number;
    new_this_week?: number;
    action_breakdown?: Record<string, number>;
    daily_usage?: Array<{ date: string; count: number }>;
  } | null;

  const actionBreakdown = usage?.action_breakdown ?? {};
  const dailyUsage = usage?.daily_usage ?? [];
  const maxDailyCount = Math.max(1, ...dailyUsage.map((d) => d.count));

  const actionLabels: Record<string, string> = {
    ai_analysis: 'AI Анализ',
    form_generation: 'Генерация форм',
    candidate_create: 'Новые кандидаты',
    vacancy_create: 'Новые вакансии',
    interview_questions: 'Вопросы интервью',
    batch_analyze: 'Пакетный анализ',
    csv_export: 'CSV Экспорт',
    login: 'Логин',
    register: 'Регистрация',
  };

  const usageStatCards = [
    { label: 'ВСЕГО ДЕЙСТВИЙ', value: usage?.total_actions ?? 0, color: 'text-orange-400', icon: BarChart3 },
    { label: 'АКТИВНЫХ СЕГОДНЯ', value: usage?.active_today ?? 0, color: 'text-green-400', icon: Zap },
    { label: 'НОВЫХ ЗА НЕДЕЛЮ', value: usage?.new_this_week ?? 0, color: 'text-blue-400', icon: UserPlus },
  ];


  if (usageLoading) return <div className="flex items-center justify-center py-20"><Loader2 className="animate-spin text-orange-500" size={32} /></div>;
  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {usageStatCards.map(({ label, value, color, icon: Icon }) => (
          <div key={label} className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-2xl p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-center">
              <Icon size={20} className={color} />
            </div>
            <div>
              <p className="text-[10px] text-white/60 tracking-wider">{label}</p>
              <p className={`text-2xl font-bold font-mono ${color}`}>{(value ?? 0).toLocaleString()}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Action breakdown */}
      <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-2xl p-4 md:p-6">
        <h3 className="text-sm font-medium text-white/70 tracking-wider flex items-center gap-2 mb-4">
          <div className="w-7 h-7 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
            <Activity size={14} className="text-orange-500" />
          </div>
          ДЕЙСТВИЯ ПО ТИПАМ
        </h3>

        {Object.keys(actionBreakdown).length === 0 ? (
          <p className="text-sm text-white/40 text-center py-8">Нет данных</p>
        ) : (
          <div className="space-y-3">
            {Object.entries(actionBreakdown)
              .sort(([, a], [, b]) => b - a)
              .map(([action, count]) => {
                const maxCount = Math.max(1, ...Object.values(actionBreakdown));
                const pct = Math.round((count / maxCount) * 100);
                return (
                  <div key={action}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-white/70">{actionLabels[action] || action}</span>
                      <span className="text-xs font-mono text-orange-400">{count.toLocaleString()}</span>
                    </div>
                    <div className="w-full h-2 bg-white/[0.02] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-orange-500 to-orange-600 rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* Daily usage chart */}
      <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-2xl p-4 md:p-6">
        <h3 className="text-sm font-medium text-white/70 tracking-wider flex items-center gap-2 mb-4">
          <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
            <TrendingUp size={14} className="text-blue-400" />
          </div>
          АКТИВНОСТЬ ПО ДНЯМ
        </h3>

        {dailyUsage.length === 0 ? (
          <p className="text-sm text-white/40 text-center py-8">Нет данных</p>
        ) : (
          <div className="flex items-end gap-1 h-40 overflow-x-auto pb-6 relative">
            {dailyUsage.map((day) => {
              const heightPct = Math.max(4, (day.count / maxDailyCount) * 100);
              return (
                <div key={day.date} className="flex flex-col items-center gap-1 flex-1 min-w-[24px] group relative">
                  {/* Tooltip */}
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-white/[0.02] border border-white/[0.06] rounded-lg px-2 py-1 text-[10px] font-mono text-orange-400 whitespace-nowrap z-10 pointer-events-none">
                    {day.count}
                  </div>
                  <div
                    className="w-full bg-gradient-to-t from-orange-500/80 to-orange-400 rounded-t-sm transition-all duration-300 hover:from-orange-400 hover:to-orange-300 min-h-[2px]"
                    style={{ height: `${heightPct}%` }}
                  />
                  <span className="text-[8px] text-white/25 font-mono absolute -bottom-5 whitespace-nowrap">
                    {new Date(day.date).toLocaleDateString('ru', { day: '2-digit', month: '2-digit' })}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Pagination (shared) ─────────────────────────────────────────────────────

function Pagination({
  page, total, limit, onPrev, onNext,
}: {
  page: number;
  total: number;
  limit: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  const maxPage = Math.ceil(total / limit) || 1;
  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={onPrev}
        disabled={page <= 1}
        className={`w-8 h-8 flex items-center justify-center rounded-lg border transition-all duration-200 ${
          page <= 1
            ? 'bg-white/[0.02] border-white/[0.04] text-white/25 cursor-not-allowed'
            : 'bg-white/[0.02] border-white/[0.06] text-white/60 hover:text-white hover:border-[rgba(232,114,28,0.15)] hover:bg-white/[0.04]'
        }`}
      >
        <ChevronLeft size={14} />
      </button>
      <div className="flex items-center gap-1 px-2">
        <span className="text-xs font-mono font-medium text-orange-400">{page}</span>
        <span className="text-xs text-white/25">/</span>
        <span className="text-xs font-mono text-white/60">{maxPage}</span>
      </div>
      <button
        onClick={onNext}
        disabled={page >= maxPage}
        className={`w-8 h-8 flex items-center justify-center rounded-lg border transition-all duration-200 ${
          page >= maxPage
            ? 'bg-white/[0.02] border-white/[0.04] text-white/25 cursor-not-allowed'
            : 'bg-white/[0.02] border-white/[0.06] text-white/60 hover:text-white hover:border-[rgba(232,114,28,0.15)] hover:bg-white/[0.04]'
        }`}
      >
        <ChevronRight size={14} />
      </button>
    </div>
  );
}
