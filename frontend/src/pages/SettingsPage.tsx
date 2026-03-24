import { useState, useEffect } from 'react';
import { usePageTitle } from '../utils/usePageTitle';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import Layout from '../components/Layout';
import { useAuthStore } from '../utils/auth-store';
import { authApi, orgsApi, tokensApi } from '../utils/api';
import toast from 'react-hot-toast';
import {
  UserCircle2, Mail, LogOut, Save, Shield, Key, Lock, Loader2,
  Building2, Users, Crown, UserCheck, Send, CheckCircle2,
  Fingerprint, Coins, ArrowUpRight, ArrowDownRight, Gift, Zap, Info, Palette, Globe, FileText, Eye,
} from 'lucide-react';
import { OrganizationMember } from '../types';
import { pageVariants, staggerContainer, staggerItem } from '../utils/animations';

const ROLE_LABELS: Record<string, string> = {
  owner: 'Владелец',
  admin: 'Администратор',
  member: 'Участник',
};

const tabContentVariants = {
  initial: { opacity: 0, x: 20, scale: 0.98 },
  animate: { opacity: 1, x: 0, scale: 1, transition: { duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] as const } },
  exit: { opacity: 0, x: -20, scale: 0.98, transition: { duration: 0.2 } },
};

interface TokenPlan {
  id: string;
  name: string;
  tokens: number;
  price_usd: number;
  price_uzs: number;
  popular?: boolean;
}

interface TokenTransaction {
  id: string;
  type: 'purchase' | 'usage' | 'bonus';
  amount: number;
  description: string;
  created_at: string;
  balance_after: number;
}

const FALLBACK_PLANS: TokenPlan[] = [
  { id: 'starter', name: 'Стартер', tokens: 500, price_usd: 3.99, price_uzs: 50000, popular: false },
  { id: 'business', name: 'Бизнес', tokens: 2000, price_usd: 11.99, price_uzs: 150000, popular: true },
  { id: 'corporate', name: 'Корпоративный', tokens: 10000, price_usd: 39.99, price_uzs: 500000, popular: false },
];

const TOKEN_COSTS = [
  { label: 'AI анализ кандидата', cost: 10, icon: Zap, color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20' },
  { label: 'Вопросы для интервью', cost: 5, icon: Zap, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
  { label: 'Создание формы', cost: 3, icon: Zap, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  { label: 'Экспорт CSV', cost: 2, icon: Zap, color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20' },
];

function formatNumber(n: number): string {
  return n.toLocaleString('ru-RU');
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function SettingsPage() {
  usePageTitle('Настройки');
  const { user, organization, setAuth, logout } = useAuthStore();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'profile' | 'org' | 'tokens'>('profile');

  // Profile
  const [name, setName] = useState(user?.name || '');
  const [companyName, setCompanyName] = useState(user?.company_name || '');
  const [saving, setSaving] = useState(false);

  // Org
  const [orgName, setOrgName] = useState(organization?.name || '');
  const [savingOrg, setSavingOrg] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [sendingInvite, setSendingInvite] = useState(false);
  const [inviteSent, setInviteSent] = useState(false);

  // 2FA
  const [twoFAEnabled, setTwoFAEnabled] = useState(false);
  const [show2FASetup, setShow2FASetup] = useState(false);
  const [twoFASecret, setTwoFASecret] = useState('');
  const [twoFACode, setTwoFACode] = useState('');

  // Telegram
  const [telegramChatId, setTelegramChatId] = useState('');
  const [telegramConnected, setTelegramConnected] = useState(false);

  // Branding
  const [brandColor, setBrandColor] = useState('#f97316');
  const [logoUrl, setLogoUrl] = useState('');
  const [companyDomain, setCompanyDomain] = useState('');
  const [emailFooter, setEmailFooter] = useState('');
  const [savingBranding, setSavingBranding] = useState(false);

  const { data: orgData, refetch: refetchOrg, isLoading: orgLoading } = useQuery({
    queryKey: ['org-me'],
    queryFn: () => orgsApi.getMe().then((r) => r.data),
    enabled: activeTab === 'org',
  });

  const { data: membersData } = useQuery({
    queryKey: ['org-members'],
    queryFn: () => orgsApi.getMembers().then((r) => r.data),
    enabled: activeTab === 'org',
  });

  // Tokens queries
  const { data: balanceData, isLoading: tokensLoading } = useQuery({
    queryKey: ['tokens-balance'],
    queryFn: () => tokensApi.getBalance().then((r) => r.data).catch((e) => { console.error('Ошибка загрузки баланса токенов:', e); return { balance: 0, used: 0 }; }),
    enabled: activeTab === 'tokens',
  });

  const { data: plansData } = useQuery({
    queryKey: ['tokens-plans'],
    queryFn: () => tokensApi.getPlans().then((r) => r.data).catch((e) => { console.error('Ошибка загрузки тарифов:', e); return { plans: FALLBACK_PLANS }; }),
    enabled: activeTab === 'tokens',
  });

  const { data: historyData } = useQuery({
    queryKey: ['tokens-history'],
    queryFn: () => tokensApi.getHistory().then((r) => r.data).catch((e) => { console.error('Ошибка загрузки истории транзакций:', e); return { transactions: [] }; }),
    enabled: activeTab === 'tokens',
  });

  useEffect(() => {
    if (orgData?.organization) {
      setOrgName(orgData.organization.name);
    }
  }, [orgData]);

  useEffect(() => {
    if (orgData?.organization) {
      if (orgData.organization.primary_color) setBrandColor(orgData.organization.primary_color);
      if (orgData.organization.logo_url) setLogoUrl(orgData.organization.logo_url);
      if (orgData.organization.company_domain) setCompanyDomain(orgData.organization.company_domain);
      if (orgData.organization.custom_email_footer) setEmailFooter(orgData.organization.custom_email_footer);
    }
  }, [orgData]);

  const handleSaveProfile = async () => {
    if (!name.trim() || name.trim().length > 100) {
      toast.error('Имя должно быть от 1 до 100 символов');
      return;
    }
    setSaving(true);
    try {
      const res = await authApi.updateProfile(name.trim(), companyName.trim() || undefined);
      const updatedUser = res.data.user;
      const token = localStorage.getItem('token') || '';
      setAuth(token, { ...user!, name: updatedUser.name, company_name: updatedUser.company_name });
      toast.success('Профиль обновлён!');
    } catch {
      toast.error('Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveOrg = async () => {
    if (!orgName.trim()) { toast.error('Введите название организации'); return; }
    setSavingOrg(true);
    try {
      await orgsApi.updateMe(orgName.trim());
      refetchOrg();
      toast.success('Организация обновлена!');
    } catch {
      toast.error('Ошибка обновления');
    } finally {
      setSavingOrg(false);
    }
  };

  const handleSaveBranding = async () => {
    setSavingBranding(true);
    try {
      await orgsApi.updateBranding({
        primary_color: brandColor,
        logo_url: logoUrl || undefined,
        company_domain: companyDomain || undefined,
        custom_email_footer: emailFooter || undefined,
      });
      toast.success('Брендинг обновлён!');
    } catch {
      toast.error('Ошибка сохранения брендинга');
    } finally {
      setSavingBranding(false);
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setSendingInvite(true);
    try {
      await orgsApi.invite(inviteEmail.trim());
      toast.success('Приглашение отправлено!');
      setInviteEmail('');
      setInviteSent(true);
      setTimeout(() => setInviteSent(false), 3000);
    } catch {
      toast.error('Ошибка отправки приглашения');
    } finally {
      setSendingInvite(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const [purchasePlan, setPurchasePlan] = useState<TokenPlan | null>(null);
  const [customAmount, setCustomAmount] = useState(1000);

  const initials = user?.name
    ? user.name.split(' ').map((w) => w.charAt(0).toUpperCase()).slice(0, 2).join('')
    : '?';
  const currentOrg = orgData?.organization || organization;
  const members: OrganizationMember[] = membersData?.members || [];

  const tokenBalance = balanceData?.balance ?? 0;
  const tokenUsed = balanceData?.used ?? 0;
  const plans: TokenPlan[] = plansData?.plans ?? FALLBACK_PLANS;
  const transactions: TokenTransaction[] = historyData?.transactions ?? [];

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'purchase': return { Icon: ArrowUpRight, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' };
      case 'usage': return { Icon: ArrowDownRight, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' };
      case 'bonus': return { Icon: Gift, color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20' };
      default: return { Icon: Coins, color: 'text-white/60', bg: 'bg-neutral-500/10 border-neutral-500/20' };
    }
  };

  return (
    <Layout>
      <motion.div
        className="p-4 md:p-8 max-w-2xl mx-auto page-content"
        variants={pageVariants}
        initial="initial"
        animate="animate"
      >
        {/* Header */}
        <div className="mb-5 md:mb-6">
          <h1 className="text-3xl font-bold text-white tracking-wider">НАСТРОЙКИ</h1>
          <div className="h-px w-16 mt-2 mb-1 bg-gradient-to-r from-orange-500 to-transparent rounded-full" />
          <p className="text-sm text-white/60">Управление профилем и аккаунтом</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 mb-6 bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-xl w-full md:w-fit">
          {([
            { key: 'profile', label: 'Профиль', icon: UserCircle2 },
            { key: 'org', label: 'Организация', icon: Building2 },
            { key: 'tokens', label: 'Токены', icon: Coins },
          ] as const).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`relative flex items-center justify-center gap-2 flex-1 md:flex-none px-5 py-2.5 rounded-lg text-sm font-medium tracking-wider transition-all duration-300 ${
                activeTab === key
                  ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg shadow-orange-500/20'
                  : 'text-white/60 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {activeTab === 'profile' ? (
            <motion.div
              key="profile"
              variants={tabContentVariants}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              <motion.div
                variants={staggerContainer}
                initial="initial"
                animate="animate"
              >
                {/* Avatar + Name */}
                <motion.div variants={staggerItem}>
                  <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-2xl p-5 md:p-6 mb-5">
                    <div className="flex items-center gap-4 md:gap-5 mb-6 pb-6 border-b border-white/[0.04]">
                      <div className="shrink-0 flex items-center justify-center rounded-full font-black text-2xl md:text-3xl w-16 h-16 md:w-[72px] md:h-[72px] bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-lg shadow-orange-500/30 ring-4 ring-orange-500/10">
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <p className="text-lg md:text-xl font-bold text-white truncate">{user?.name}</p>
                        <p className="text-sm mt-0.5 text-white/60 truncate">{user?.email}</p>
                        <div className="flex flex-wrap items-center gap-2 mt-1.5">
                          <p className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500">
                            HR Manager
                          </p>
                          {user?.email_verified ? (
                            <p className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center gap-1">
                              <CheckCircle2 size={10} />
                              Email подтверждён
                            </p>
                          ) : (
                            <p className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-400">
                              Email не подтверждён
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-5">
                      <div>
                        <label className="label flex items-center gap-2">
                          <UserCircle2 size={13} className="text-orange-400" />
                          Имя
                        </label>
                        <input
                          type="text"
                          className="input transition-all duration-300 focus:border-orange-500/50 focus:shadow-[0_0_0_3px_rgba(249,115,22,0.1)]"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Ваше имя"
                          maxLength={100}
                        />
                      </div>

                      <div>
                        <label className="label flex items-center gap-2">
                          <Building2 size={13} className="text-orange-400" />
                          Название компании
                        </label>
                        <input
                          type="text"
                          className="input transition-all duration-300 focus:border-orange-500/50 focus:shadow-[0_0_0_3px_rgba(249,115,22,0.1)]"
                          value={companyName}
                          onChange={(e) => setCompanyName(e.target.value)}
                          placeholder="Ваша компания"
                          maxLength={255}
                        />
                      </div>

                      <div>
                        <label className="label flex items-center gap-2">
                          <Mail size={13} className="text-orange-400" />
                          Email
                          <span className="text-xs font-normal text-white/25">
                            (нельзя изменить)
                          </span>
                        </label>
                        <input
                          type="email"
                          className="input opacity-45 cursor-not-allowed"
                          value={user?.email || ''}
                          readOnly
                        />
                      </div>

                      <button
                        className="btn-primary w-full justify-center py-3"
                        onClick={handleSaveProfile}
                        disabled={saving || !name.trim()}
                      >
                        <Save size={16} />
                        {saving ? 'Сохранение...' : 'Сохранить изменения'}
                      </button>
                    </div>
                  </div>
                </motion.div>

                {/* Security */}
                <motion.div variants={staggerItem}>
                  <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-2xl p-5 md:p-6 mb-5">
                    <div className="flex items-center gap-2.5 mb-5">
                      <div className="w-9 h-9 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center justify-center">
                        <Shield size={16} className="text-blue-400" />
                      </div>
                      <div>
                        <h3 className="font-bold text-white">Безопасность</h3>
                        <p className="text-xs text-white/40">Параметры защиты аккаунта</p>
                      </div>
                    </div>
                    <div className="space-y-1">
                      {[
                        { icon: Key, label: 'Аутентификация', value: 'JWT, 7 дней', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
                        { icon: Lock, label: 'Хранение пароля', value: 'bcrypt, 12 rounds', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
                        { icon: Shield, label: 'Rate limiting', value: '10 попыток / 15 мин', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
                        { icon: Fingerprint, label: 'Шифрование', value: 'TLS / HTTPS', color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20' },
                      ].map(({ icon: Icon, label, value, color, bg }) => (
                        <div key={label} className="flex items-center justify-between p-3 rounded-lg hover:bg-white/[0.04] transition-colors">
                          <div className="flex items-center gap-3 text-neutral-300">
                            <div className={`w-7 h-7 rounded-lg border flex items-center justify-center ${bg}`}>
                              <Icon size={13} className={color} />
                            </div>
                            <span className="text-sm">{label}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Lock size={10} className="text-white/25" />
                            <span className="font-medium text-xs text-white/60 font-mono">
                              {value}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>

                {/* 2FA */}
                <motion.div variants={staggerItem}>
                  <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-2xl p-5 md:p-6 mb-5">
                    <div className="flex items-center gap-2.5 mb-5">
                      <div className="w-9 h-9 bg-purple-500/10 border border-purple-500/20 rounded-xl flex items-center justify-center">
                        <Fingerprint size={16} className="text-purple-400" />
                      </div>
                      <div>
                        <h3 className="font-bold text-white">Двухфакторная аутентификация</h3>
                        <p className="text-xs text-white/40">Дополнительная защита аккаунта</p>
                      </div>
                    </div>

                    {!twoFAEnabled ? (
                      <>
                        {!show2FASetup ? (
                          <div>
                            <p className="text-sm text-white/60 mb-4">
                              Добавьте дополнительный уровень защиты. После включения потребуется код из приложения-аутентификатора при каждом входе.
                            </p>
                            <button className="btn-primary text-sm" onClick={async () => {
                              try {
                                const res = await authApi.setup2FA();
                                setTwoFASecret(res.data.secret);
                                setShow2FASetup(true);
                              } catch (e) { console.error('Ошибка настройки 2FA:', e); toast.error('Ошибка настройки 2FA'); }
                            }}>
                              <Shield size={14} />
                              Включить 2FA
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <p className="text-sm text-neutral-300">
                              Откройте Google Authenticator и введите этот секретный ключ:
                            </p>
                            <code className="block p-3 bg-white/[0.02] border border-white/[0.06] rounded-lg text-xs text-orange-400 font-mono break-all select-all">
                              {twoFASecret}
                            </code>
                            <div className="flex gap-2">
                              <input
                                className="input flex-1"
                                placeholder="6-значный код"
                                value={twoFACode}
                                onChange={e => setTwoFACode(e.target.value)}
                                maxLength={6}
                              />
                              <button className="btn-primary" onClick={async () => {
                                try {
                                  await authApi.verify2FA(twoFACode);
                                  setTwoFAEnabled(true);
                                  setShow2FASetup(false);
                                  setTwoFACode('');
                                  toast.success('2FA успешно включена!');
                                } catch (e) { console.error('Ошибка подтверждения 2FA:', e); toast.error('Неверный код'); }
                              }}>
                                Подтвердить
                              </button>
                            </div>
                            <button className="text-xs text-white/40 hover:text-neutral-300" onClick={() => setShow2FASetup(false)}>
                              Отмена
                            </button>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 size={16} className="text-emerald-400" />
                          <span className="text-sm text-emerald-400 font-medium">2FA включена</span>
                        </div>
                        <button className="btn-danger text-xs px-3 py-1.5" onClick={async () => {
                          try {
                            await authApi.disable2FA();
                            setTwoFAEnabled(false);
                            toast.success('2FA отключена');
                          } catch (e) { console.error('Ошибка отключения 2FA:', e); toast.error('Ошибка'); }
                        }}>
                          Отключить
                        </button>
                      </div>
                    )}
                  </div>
                </motion.div>

                {/* Telegram */}
                <motion.div variants={staggerItem}>
                  <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-2xl p-5 md:p-6 mb-5">
                    <div className="flex items-center gap-2.5 mb-5">
                      <div className="w-9 h-9 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center justify-center">
                        <Send size={16} className="text-blue-400" />
                      </div>
                      <div>
                        <h3 className="font-bold text-white">Telegram уведомления</h3>
                        <p className="text-xs text-white/40">Получайте уведомления в Telegram</p>
                      </div>
                    </div>
                    <p className="text-sm text-white/60 mb-4">
                      Новые кандидаты, результаты AI анализа и другие события — прямо в ваш Telegram.
                    </p>
                    <div className="flex gap-2 mb-3">
                      <input
                        className="input flex-1"
                        placeholder="Ваш Telegram Chat ID"
                        value={telegramChatId}
                        onChange={e => setTelegramChatId(e.target.value)}
                      />
                      <button className="btn-primary" onClick={async () => {
                        if (!telegramChatId.trim()) { toast.error('Введите Chat ID'); return; }
                        try {
                          await authApi.updateProfile(user?.name || '', undefined);
                          toast.success('Telegram подключён!');
                          setTelegramConnected(true);
                        } catch (e) { console.error('Ошибка подключения Telegram:', e); toast.error('Ошибка подключения'); }
                      }}>
                        {telegramConnected ? 'Обновить' : 'Подключить'}
                      </button>
                    </div>
                    <p className="text-xs text-white/25">
                      1. Найдите бота <span className="text-orange-400">@mysolution_bot</span> в Telegram{' '}
                      2. Отправьте /start{' '}
                      3. Скопируйте Chat ID сюда
                    </p>
                    {telegramConnected && (
                      <div className="flex items-center gap-2 mt-3 p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                        <CheckCircle2 size={14} className="text-emerald-400" />
                        <span className="text-xs text-emerald-400">Telegram подключён</span>
                      </div>
                    )}
                  </div>
                </motion.div>

                {/* Danger zone */}
                <motion.div variants={staggerItem}>
                  <div className="bg-white/[0.03] backdrop-blur-xl border border-red-500/20 rounded-2xl p-5 md:p-6">
                    <h3 className="font-bold mb-1 text-red-400">Выход из аккаунта</h3>
                    <p className="text-sm mb-4 text-white/40">
                      Вы будете перенаправлены на страницу входа. Текущая сессия завершится.
                    </p>
                    <button className="btn-danger w-full justify-center py-3" onClick={handleLogout}>
                      <LogOut size={16} />
                      Выйти из аккаунта
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            </motion.div>
          ) : activeTab === 'org' ? (
            <motion.div
              key="org"
              variants={tabContentVariants}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              {orgLoading ? (
                <div className="flex items-center justify-center py-20"><Loader2 className="animate-spin text-orange-500" size={32} /></div>
              ) : (
              <>

              <motion.div
                variants={staggerContainer}
                initial="initial"
                animate="animate"
              >
                {/* Org card */}
                <motion.div variants={staggerItem}>
                  <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-2xl p-5 md:p-6 mb-5">
                    <div className="flex items-center gap-3 mb-5">
                      <div className="w-11 h-11 bg-gradient-to-br from-orange-500/20 to-orange-600/10 border border-orange-500/20 rounded-xl flex items-center justify-center">
                        <Building2 size={20} className="text-orange-400" />
                      </div>
                      <div>
                        <p className="font-bold text-white">{currentOrg?.name || 'Моя организация'}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full ${
                              currentOrg?.plan === 'pro'
                                ? 'bg-purple-500/10 border border-purple-500/30 text-purple-400'
                                : 'bg-white/[0.02] border border-white/[0.06] text-white/60'
                            }`}
                          >
                            {currentOrg?.plan === 'pro' ? 'Pro' : 'Free'}
                          </span>
                          {orgData?.role && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400">
                              {ROLE_LABELS[orgData.role] || orgData.role}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="label flex items-center gap-2">
                          <Building2 size={13} className="text-orange-400" />
                          Название организации
                        </label>
                        <input
                          type="text"
                          className="input transition-all duration-300 focus:border-orange-500/50 focus:shadow-[0_0_0_3px_rgba(249,115,22,0.1)]"
                          value={orgName}
                          onChange={(e) => setOrgName(e.target.value)}
                          placeholder="Название компании"
                          maxLength={255}
                        />
                      </div>
                      <button
                        className="btn-primary w-full justify-center py-3"
                        onClick={handleSaveOrg}
                        disabled={savingOrg || !orgName.trim()}
                      >
                        <Save size={16} />
                        {savingOrg ? 'Сохранение...' : 'Сохранить'}
                      </button>
                    </div>
                  </div>
                </motion.div>

                {/* Members */}
                <motion.div variants={staggerItem}>
                  <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-2xl p-5 md:p-6 mb-5">
                    <div className="flex items-center gap-2.5 mb-4">
                      <div className="w-9 h-9 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center justify-center">
                        <Users size={16} className="text-blue-400" />
                      </div>
                      <h3 className="font-bold text-white">Участники</h3>
                      <span className="ml-auto text-xs px-2.5 py-1 rounded-full bg-white/[0.02] border border-white/[0.06] text-white/60 font-mono">
                        {members.length}
                      </span>
                    </div>

                    {members.length === 0 ? (
                      <p className="text-sm text-white/40">Загрузка...</p>
                    ) : (
                      <div className="space-y-2">
                        {members.map((m) => (
                          <div
                            key={m.id}
                            className="flex items-center gap-3 p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:border-neutral-600/50 transition-all duration-200"
                          >
                            <div className="relative shrink-0">
                              <div className="flex items-center justify-center rounded-full font-bold text-sm w-10 h-10 bg-gradient-to-br from-orange-500/20 to-orange-600/10 border border-orange-500/20 text-orange-400">
                                {m.users?.name?.charAt(0).toUpperCase() || '?'}
                              </div>
                              {/* Online status dot */}
                              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-black" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-white truncate">{m.users?.name}</p>
                              <p className="text-xs truncate text-white/40">{m.users?.email}</p>
                            </div>
                            <div className="shrink-0 flex items-center gap-1.5">
                              {m.role === 'owner' && <Crown size={12} className="text-yellow-400" />}
                              {m.role === 'admin' && <UserCheck size={12} className="text-blue-400" />}
                              <span className="text-xs text-white/60">
                                {ROLE_LABELS[m.role] || m.role}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>

                {/* Invite */}
                <motion.div variants={staggerItem}>
                  <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-2xl p-5 md:p-6">
                    <div className="flex items-center gap-2.5 mb-4">
                      <div className="w-9 h-9 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-center">
                        <Send size={16} className="text-emerald-500" />
                      </div>
                      <h3 className="font-bold text-white">Пригласить участника</h3>
                    </div>
                    <div className="flex flex-col md:flex-row gap-3">
                      <input
                        type="email"
                        className="input flex-1 transition-all duration-300 focus:border-emerald-500/50 focus:shadow-[0_0_0_3px_rgba(16,185,129,0.1)]"
                        placeholder="email@company.com"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
                      />
                      <button
                        className="btn-primary shrink-0 justify-center py-3 md:py-2"
                        onClick={handleInvite}
                        disabled={sendingInvite || !inviteEmail.trim()}
                      >
                        {sendingInvite ? 'Отправка...' : 'Пригласить'}
                      </button>
                    </div>

                    {/* Success animation */}
                    <AnimatePresence>
                      {inviteSent && (
                        <motion.div
                          initial={{ opacity: 0, y: 10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -5, scale: 0.95 }}
                          className="mt-3 flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20"
                        >
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: [0, 1.2, 1] }}
                            transition={{ duration: 0.4 }}
                          >
                            <CheckCircle2 size={18} className="text-emerald-500" />
                          </motion.div>
                          <span className="text-sm text-emerald-400">Приглашение успешно отправлено!</span>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              </motion.div>
                {/* Branding */}
                <motion.div variants={staggerItem}>
                  <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-2xl p-5 md:p-6 mb-5">
                    <div className="flex items-center gap-2.5 mb-5">
                      <div className="w-9 h-9 bg-purple-500/10 border border-purple-500/20 rounded-xl flex items-center justify-center">
                        <Palette size={16} className="text-purple-400" />
                      </div>
                      <div>
                        <h3 className="font-bold text-white">Брендинг</h3>
                        <p className="text-xs text-white/40">Настройте внешний вид под ваш бренд</p>
                      </div>
                    </div>

                    <div className="space-y-5">
                      {/* Primary color */}
                      <div>
                        <label className="label flex items-center gap-2">
                          <Palette size={13} className="text-purple-400" />
                          Основной цвет бренда
                        </label>
                        <div className="flex items-center gap-3">
                          <input
                            type="color"
                            value={brandColor}
                            onChange={(e) => setBrandColor(e.target.value)}
                            className="w-12 h-10 rounded-lg border border-white/[0.06] bg-transparent cursor-pointer"
                          />
                          <input
                            type="text"
                            className="input flex-1 font-mono text-sm"
                            value={brandColor}
                            onChange={(e) => setBrandColor(e.target.value)}
                            placeholder="#f97316"
                            maxLength={7}
                          />
                        </div>
                      </div>

                      {/* Logo URL */}
                      <div>
                        <label className="label flex items-center gap-2">
                          <Eye size={13} className="text-purple-400" />
                          URL логотипа
                        </label>
                        <input
                          type="url"
                          className="input transition-all duration-300 focus:border-purple-500/50 focus:shadow-[0_0_0_3px_rgba(168,85,247,0.1)]"
                          value={logoUrl}
                          onChange={(e) => setLogoUrl(e.target.value)}
                          placeholder="https://example.com/logo.png"
                        />
                      </div>

                      {/* Custom domain */}
                      <div>
                        <label className="label flex items-center gap-2">
                          <Globe size={13} className="text-white/40" />
                          Свой домен
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.02] border border-white/[0.06] text-white/40 font-medium">
                            Coming soon
                          </span>
                        </label>
                        <input
                          type="text"
                          className="input opacity-45 cursor-not-allowed"
                          value={companyDomain}
                          onChange={(e) => setCompanyDomain(e.target.value)}
                          placeholder="careers.yourcompany.com"
                          disabled
                        />
                      </div>

                      {/* Custom email footer */}
                      <div>
                        <label className="label flex items-center gap-2">
                          <FileText size={13} className="text-purple-400" />
                          Подпись в email-уведомлениях
                        </label>
                        <textarea
                          className="input min-h-[80px] resize-y transition-all duration-300 focus:border-purple-500/50 focus:shadow-[0_0_0_3px_rgba(168,85,247,0.1)]"
                          value={emailFooter}
                          onChange={(e) => setEmailFooter(e.target.value)}
                          placeholder="С уважением, команда HR вашей компании"
                          maxLength={500}
                          rows={3}
                        />
                      </div>

                      {/* Preview card */}
                      <div>
                        <p className="text-xs font-bold text-white/60 tracking-wider uppercase mb-3">Предпросмотр</p>
                        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 space-y-3">
                          <div className="flex items-center gap-3">
                            {logoUrl ? (
                              <img
                                src={logoUrl}
                                alt="Logo"
                                className="w-10 h-10 rounded-lg object-cover border border-neutral-600"
                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                              />
                            ) : (
                              <div
                                className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-lg"
                                style={{ backgroundColor: brandColor }}
                              >
                                {(currentOrg?.name || 'B').charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div>
                              <p className="text-sm font-bold text-white">Ваш бренд</p>
                              <p className="text-xs text-white/40">{currentOrg?.name || 'Организация'}</p>
                            </div>
                          </div>
                          <div
                            className="h-1 rounded-full"
                            style={{ backgroundColor: brandColor }}
                          />
                          <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                            <p className="text-xs text-white/60 mb-1">Пример email:</p>
                            <p className="text-xs text-neutral-300">Здравствуйте! Спасибо за ваш отклик на вакансию...</p>
                            {emailFooter && (
                              <p className="text-xs text-white/40 mt-2 pt-2 border-t border-white/[0.04] italic">
                                {emailFooter}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      <button
                        className="btn-primary w-full justify-center py-3"
                        onClick={handleSaveBranding}
                        disabled={savingBranding}
                      >
                        <Save size={16} />
                        {savingBranding ? 'Сохранение...' : 'Сохранить брендинг'}
                      </button>
                    </div>
                  </div>
                </motion.div>

              </>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="tokens"
              variants={tabContentVariants}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              {tokensLoading ? (
                <div className="flex items-center justify-center py-20"><Loader2 className="animate-spin text-orange-500" size={32} /></div>
              ) : (
              <>

              <motion.div
                variants={staggerContainer}
                initial="initial"
                animate="animate"
              >
                {/* Balance card */}
                <motion.div variants={staggerItem}>
                  <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-2xl p-5 md:p-6 mb-5">
                    <div className="flex items-center gap-4">
                      <motion.div
                        className="w-14 h-14 bg-gradient-to-br from-orange-500/20 to-yellow-500/10 border border-orange-500/20 rounded-2xl flex items-center justify-center"
                        animate={{ rotateY: [0, 360] }}
                        transition={{ duration: 2, repeat: Infinity, repeatDelay: 4, ease: 'easeInOut' }}
                      >
                        <Coins size={28} className="text-orange-400" />
                      </motion.div>
                      <div>
                        <motion.p
                          className="text-3xl md:text-4xl font-black text-white tracking-tight"
                          initial={{ opacity: 0, scale: 0.5 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
                        >
                          {formatNumber(tokenBalance)}
                        </motion.p>
                        <p className="text-sm text-white/60 mt-0.5">
                          Использовано: {formatNumber(tokenUsed)} токенов
                        </p>
                      </div>
                    </div>
                  </div>
                </motion.div>

                {/* Plans grid */}
                <motion.div variants={staggerItem}>
                  <div className="mb-5">
                    <h3 className="text-sm font-bold text-neutral-300 tracking-wider uppercase mb-3">Пополнить баланс</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {plans.map((plan) => (
                        <div
                          key={plan.id}
                          className={`relative bg-white/[0.03] backdrop-blur-xl border rounded-2xl p-5 transition-all duration-200 hover:border-orange-500/40 ${
                            plan.popular
                              ? 'border-orange-500/30 shadow-lg shadow-orange-500/5'
                              : 'border-white/[0.06]'
                          }`}
                        >
                          {plan.popular && (
                            <span className="absolute -top-2.5 right-4 text-[10px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg shadow-orange-500/30">
                              Популярный
                            </span>
                          )}
                          <p className="text-lg font-bold text-white">{plan.name}</p>
                          <p className="text-2xl font-black text-orange-400 mt-1">
                            {formatNumber(plan.tokens)}
                            <span className="text-xs font-normal text-white/40 ml-1">токенов</span>
                          </p>
                          <div className="flex items-baseline gap-2 mt-2">
                            <span className="text-sm font-semibold text-neutral-300">${plan.price_usd}</span>
                            <span className="text-xs text-white/40">/</span>
                            <span className="text-xs text-white/40">{formatNumber(plan.price_uzs)} сум</span>
                          </div>
                          <button
                            className="btn-primary w-full justify-center py-2.5 mt-4 text-sm"
                            onClick={() => setPurchasePlan(plan)}
                          >
                            <Coins size={14} />
                            Купить
                          </button>
                        </div>
                      ))}

                      {/* Custom package */}
                      <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6">
                        <h4 className="text-sm font-semibold text-white mb-4">Свой пакет</h4>
                        <input
                          type="range"
                          min={50}
                          max={50000}
                          step={50}
                          value={customAmount}
                          onChange={e => setCustomAmount(Number(e.target.value))}
                          className="w-full accent-orange-500"
                        />
                        <div className="flex justify-between mt-2">
                          <span className="text-xs text-white/40">{customAmount.toLocaleString()} токенов</span>
                          <span className="text-sm font-bold text-orange-400">
                            {(customAmount * (customAmount >= 10000 ? 400 : customAmount >= 5000 ? 425 : customAmount >= 2000 ? 450 : customAmount >= 500 ? 475 : 500)).toLocaleString()} сум
                          </span>
                        </div>
                        {customAmount >= 500 && (
                          <p className="text-xs text-emerald-400 mt-1">
                            Скидка {customAmount >= 10000 ? '20' : customAmount >= 5000 ? '15' : customAmount >= 2000 ? '10' : '5'}%
                          </p>
                        )}
                        <button
                          className="btn-primary w-full justify-center py-2.5 mt-4 text-sm"
                          onClick={() => {
                            const discount = customAmount >= 10000 ? 0.20 : customAmount >= 5000 ? 0.15 : customAmount >= 2000 ? 0.10 : customAmount >= 500 ? 0.05 : 0;
                            const priceUzs = Math.round(customAmount * 500 * (1 - discount));
                            const priceUsd = Math.round(customAmount * 0.04 * (1 - discount) * 100) / 100;
                            setPurchasePlan({ id: 'custom', name: 'Свой пакет', tokens: customAmount, price_usd: priceUsd, price_uzs: priceUzs });
                          }}
                        >
                          <Coins size={14} />
                          Купить
                        </button>
                      </div>
                    </div>

                    {/* Token cost reference */}
                    <div className="text-xs text-white/40 space-y-1 mt-4">
                      <p>AI анализ резюме — 10 токенов</p>
                      <p>Вопросы для интервью — 5 токенов</p>
                      <p>Экспорт данных — 2 токена</p>
                      <p className="text-orange-400 mt-2">Цена: 500 сум за токен ($0.04)</p>
                    </div>
                  </div>
                </motion.div>

                {/* Transaction history */}
                <motion.div variants={staggerItem}>
                  <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-2xl p-5 md:p-6 mb-5">
                    <div className="flex items-center gap-2.5 mb-4">
                      <div className="w-9 h-9 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center justify-center">
                        <ArrowUpRight size={16} className="text-blue-400" />
                      </div>
                      <h3 className="font-bold text-white">История транзакций</h3>
                      <span className="ml-auto text-xs px-2.5 py-1 rounded-full bg-white/[0.02] border border-white/[0.06] text-white/60 font-mono">
                        {transactions.length}
                      </span>
                    </div>

                    {transactions.length === 0 ? (
                      <div className="text-center py-8">
                        <Coins size={32} className="text-white/25 mx-auto mb-2" />
                        <p className="text-sm text-white/40">Транзакций пока нет</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {transactions.map((tx) => {
                          const { Icon, color, bg } = getTransactionIcon(tx.type);
                          return (
                            <div
                              key={tx.id}
                              className="flex items-center gap-3 p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:border-neutral-600/50 transition-all duration-200"
                            >
                              <div className={`shrink-0 w-9 h-9 rounded-xl border flex items-center justify-center ${bg}`}>
                                <Icon size={16} className={color} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-white truncate">{tx.description}</p>
                                <p className="text-xs text-white/40">{formatDate(tx.created_at)}</p>
                              </div>
                              <div className="shrink-0 text-right">
                                <p className={`text-sm font-bold ${tx.amount > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                  {tx.amount > 0 ? '+' : ''}{formatNumber(tx.amount)}
                                </p>
                                <p className="text-[10px] text-white/40">
                                  Баланс: {formatNumber(tx.balance_after)}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </motion.div>

                {/* Token costs info */}
                <motion.div variants={staggerItem}>
                  <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-2xl p-5 md:p-6">
                    <div className="flex items-center gap-2.5 mb-4">
                      <div className="w-9 h-9 bg-orange-500/10 border border-orange-500/20 rounded-xl flex items-center justify-center">
                        <Info size={16} className="text-orange-400" />
                      </div>
                      <div>
                        <h3 className="font-bold text-white">Стоимость операций</h3>
                        <p className="text-xs text-white/40">Сколько токенов расходуется</p>
                      </div>
                    </div>
                    <div className="space-y-1">
                      {TOKEN_COSTS.map(({ label, cost, icon: CostIcon, color, bg }) => (
                        <div key={label} className="flex items-center justify-between p-3 rounded-lg hover:bg-white/[0.04] transition-colors">
                          <div className="flex items-center gap-3 text-neutral-300">
                            <div className={`w-7 h-7 rounded-lg border flex items-center justify-center ${bg}`}>
                              <CostIcon size={13} className={color} />
                            </div>
                            <span className="text-sm">{label}</span>
                          </div>
                          <span className="text-sm font-bold text-orange-400 font-mono">
                            {cost} токенов
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              </motion.div>
              </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {purchasePlan && <PurchaseModal plan={purchasePlan} onClose={() => setPurchasePlan(null)} />}
    </Layout>
  );
}

function PurchaseModal({ plan, onClose }: { plan: { name: string; tokens: number; price_usd: number; price_uzs: number }; onClose: () => void }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content max-w-md" onClick={e => e.stopPropagation()}>
        <div className="p-6">
          <h3 className="text-lg font-bold text-white mb-1">Пополнить баланс</h3>
          <p className="text-sm text-white/60 mb-6">Тариф «{plan.name}» — {plan.tokens.toLocaleString()} токенов</p>

          <div className="bg-white/[0.02] border border-white/[0.06] rounded-lg p-4 mb-4">
            <div className="flex justify-between mb-1">
              <span className="text-sm text-white/60">Сумма</span>
              <span className="text-lg font-bold text-orange-400 font-mono">${plan.price_usd}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-white/60">В сумах</span>
              <span className="text-sm font-mono text-neutral-300">{plan.price_uzs?.toLocaleString()} сум</span>
            </div>
          </div>

          <div className="space-y-2 mb-6">
            {['Click', 'Payme', 'Uzcard', 'Stripe'].map(method => (
              <div key={method} className="flex items-center justify-between p-3 bg-white/[0.02] border border-white/[0.04] rounded-lg opacity-50">
                <span className="text-sm text-white/60">{method}</span>
                <span className="text-xs bg-orange-500/15 text-orange-400 px-2 py-0.5 rounded">Q2 2026</span>
              </div>
            ))}
          </div>

          <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-4 mb-4 text-center">
            <p className="text-sm font-medium text-orange-400 mb-1">Хотите пополнить сейчас?</p>
            <p className="text-xs text-white/60">Свяжитесь с нами для ручного пополнения:</p>
            <p className="text-xs text-neutral-300 mt-1">info@mysolution.uz</p>
            <p className="text-xs text-neutral-300">@mysolution.hub</p>
          </div>

          <button className="btn-secondary w-full justify-center" onClick={onClose}>Закрыть</button>
        </div>
      </div>
    </div>
  );
}
