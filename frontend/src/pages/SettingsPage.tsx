import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import Layout from '../components/Layout';
import { useAuthStore } from '../utils/auth-store';
import { authApi, orgsApi } from '../utils/api';
import toast from 'react-hot-toast';
import {
  UserCircle2, Mail, LogOut, Save, Shield, Key,
  Building2, Users, Crown, UserCheck, Send,
} from 'lucide-react';
import { OrganizationMember } from '../types';

const ROLE_LABELS: Record<string, string> = {
  owner: 'Владелец',
  admin: 'Администратор',
  member: 'Участник',
};

export default function SettingsPage() {
  const { user, organization, setAuth, logout } = useAuthStore();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'profile' | 'org'>('profile');

  // Profile
  const [name, setName] = useState(user?.name || '');
  const [companyName, setCompanyName] = useState(user?.company_name || '');
  const [saving, setSaving] = useState(false);

  // Org
  const [orgName, setOrgName] = useState(organization?.name || '');
  const [savingOrg, setSavingOrg] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [sendingInvite, setSendingInvite] = useState(false);

  const { data: orgData, refetch: refetchOrg } = useQuery({
    queryKey: ['org-me'],
    queryFn: () => orgsApi.getMe().then((r) => r.data),
    enabled: activeTab === 'org',
  });

  const { data: membersData } = useQuery({
    queryKey: ['org-members'],
    queryFn: () => orgsApi.getMembers().then((r) => r.data),
    enabled: activeTab === 'org',
  });

  useEffect(() => {
    if (orgData?.organization) {
      setOrgName(orgData.organization.name);
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

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setSendingInvite(true);
    try {
      await orgsApi.invite(inviteEmail.trim());
      toast.success('Приглашение отправлено!');
      setInviteEmail('');
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

  const initial = user?.name?.charAt(0).toUpperCase() || '?';
  const currentOrg = orgData?.organization || organization;
  const members: OrganizationMember[] = membersData?.members || [];

  return (
    <Layout>
      <div className="p-8 max-w-2xl mx-auto page-content">
        {/* Header */}
        <div className="mb-6">
          <h2 className="text-3xl font-black text-white mb-1">Настройки</h2>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Управление профилем и аккаунтом
          </p>
        </div>

        {/* Tabs */}
        <div
          className="flex gap-1 p-1 mb-6 rounded-2xl"
          style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,110,0,0.10)', width: 'fit-content' }}
        >
          {([
            { key: 'profile', label: 'Профиль', icon: UserCircle2 },
            { key: 'org', label: 'Организация', icon: Building2 },
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

        {activeTab === 'profile' ? (
          <>
            {/* Avatar + Name */}
            <div className="card mb-5">
              <div className="flex items-center gap-5 mb-6 pb-6" style={{ borderBottom: '1px solid rgba(255,110,0,0.08)' }}>
                <div
                  className="shrink-0 flex items-center justify-center rounded-2xl font-black text-3xl"
                  style={{
                    width: 72, height: 72,
                    background: 'linear-gradient(135deg, rgba(255,106,0,0.25) 0%, rgba(255,110,0,0.10) 100%)',
                    border: '1px solid rgba(255,110,0,0.3)',
                    color: '#FF9A3C',
                    boxShadow: '0 0 24px rgba(255,106,0,0.15)',
                  }}
                >
                  {initial}
                </div>
                <div>
                  <p className="text-xl font-bold text-white">{user?.name}</p>
                  <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>{user?.email}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <p
                      className="text-xs px-2 py-0.5 rounded-full inline-block"
                      style={{
                        background: 'rgba(16,185,129,0.10)',
                        border: '1px solid rgba(16,185,129,0.2)',
                        color: '#10b981',
                      }}
                    >
                      HR Manager
                    </p>
                    {user?.email_verified ? (
                      <p
                        className="text-xs px-2 py-0.5 rounded-full inline-block"
                        style={{
                          background: 'rgba(16,185,129,0.08)',
                          border: '1px solid rgba(16,185,129,0.15)',
                          color: '#6ee7b7',
                        }}
                      >
                        ✓ Email подтверждён
                      </p>
                    ) : (
                      <p
                        className="text-xs px-2 py-0.5 rounded-full inline-block"
                        style={{
                          background: 'rgba(251,191,36,0.08)',
                          border: '1px solid rgba(251,191,36,0.2)',
                          color: '#fbbf24',
                        }}
                      >
                        Email не подтверждён
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-5">
                <div>
                  <label className="label flex items-center gap-2">
                    <UserCircle2 size={13} style={{ color: '#FF9A3C' }} />
                    Имя
                  </label>
                  <input
                    type="text"
                    className="input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ваше имя"
                    maxLength={100}
                  />
                </div>

                <div>
                  <label className="label flex items-center gap-2">
                    <Building2 size={13} style={{ color: '#FF9A3C' }} />
                    Название компании
                  </label>
                  <input
                    type="text"
                    className="input"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Ваша компания"
                    maxLength={255}
                  />
                </div>

                <div>
                  <label className="label flex items-center gap-2">
                    <Mail size={13} style={{ color: '#FF9A3C' }} />
                    Email
                    <span className="text-xs font-normal" style={{ color: 'rgba(255,255,255,0.2)' }}>
                      (нельзя изменить)
                    </span>
                  </label>
                  <input
                    type="email"
                    className="input"
                    value={user?.email || ''}
                    readOnly
                    style={{ opacity: 0.45, cursor: 'not-allowed' }}
                  />
                </div>

                <button
                  className="btn-primary w-full justify-center"
                  onClick={handleSaveProfile}
                  disabled={saving || !name.trim()}
                >
                  <Save size={16} />
                  {saving ? 'Сохранение...' : 'Сохранить изменения'}
                </button>
              </div>
            </div>

            {/* Security */}
            <div className="card mb-5">
              <div className="flex items-center gap-2.5 mb-4">
                <div
                  style={{
                    width: 32, height: 32,
                    background: 'rgba(59,130,246,0.10)',
                    border: '1px solid rgba(59,130,246,0.2)',
                    borderRadius: 8,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Shield size={15} className="text-blue-400" />
                </div>
                <h3 className="font-bold text-white">Безопасность</h3>
              </div>
              <div className="space-y-3">
                {[
                  { icon: Key, label: 'Аутентификация', value: 'JWT, 7 дней' },
                  { icon: Shield, label: 'Хранение пароля', value: 'bcrypt, 12 rounds' },
                  { icon: Shield, label: 'Rate limiting', value: '10 попыток / 15 мин' },
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2" style={{ color: 'rgba(255,255,255,0.4)' }}>
                      <Icon size={13} />
                      {label}
                    </div>
                    <span className="font-medium text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Danger zone */}
            <div className="card" style={{ borderColor: 'rgba(239,68,68,0.18)' }}>
              <h3 className="font-bold mb-1" style={{ color: '#f87171' }}>Выход из аккаунта</h3>
              <p className="text-sm mb-4" style={{ color: 'rgba(255,255,255,0.35)' }}>
                Вы будете перенаправлены на страницу входа. Текущая сессия завершится.
              </p>
              <button className="btn-danger w-full justify-center" onClick={handleLogout}>
                <LogOut size={16} />
                Выйти из аккаунта
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Org card */}
            <div className="card mb-5">
              <div className="flex items-center gap-3 mb-5">
                <div
                  style={{
                    width: 40, height: 40,
                    background: 'rgba(255,110,0,0.12)',
                    border: '1px solid rgba(255,110,0,0.25)',
                    borderRadius: 10,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Building2 size={18} style={{ color: '#FF9A3C' }} />
                </div>
                <div>
                  <p className="font-bold text-white">{currentOrg?.name || 'Моя организация'}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span
                      className="text-xs px-2 py-0.5 rounded-full"
                      style={{
                        background: currentOrg?.plan === 'pro'
                          ? 'rgba(168,85,247,0.12)'
                          : 'rgba(255,255,255,0.06)',
                        border: `1px solid ${currentOrg?.plan === 'pro' ? 'rgba(168,85,247,0.3)' : 'rgba(255,255,255,0.1)'}`,
                        color: currentOrg?.plan === 'pro' ? '#c084fc' : 'rgba(255,255,255,0.4)',
                      }}
                    >
                      {currentOrg?.plan === 'pro' ? '⭐ Pro' : 'Free'}
                    </span>
                    {orgData?.role && (
                      <span
                        className="text-xs px-2 py-0.5 rounded-full"
                        style={{
                          background: 'rgba(255,110,0,0.10)',
                          border: '1px solid rgba(255,110,0,0.20)',
                          color: '#FF9A3C',
                        }}
                      >
                        {ROLE_LABELS[orgData.role] || orgData.role}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="label flex items-center gap-2">
                    <Building2 size={13} style={{ color: '#FF9A3C' }} />
                    Название организации
                  </label>
                  <input
                    type="text"
                    className="input"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    placeholder="Название компании"
                    maxLength={255}
                  />
                </div>
                <button
                  className="btn-primary w-full justify-center"
                  onClick={handleSaveOrg}
                  disabled={savingOrg || !orgName.trim()}
                >
                  <Save size={16} />
                  {savingOrg ? 'Сохранение...' : 'Сохранить'}
                </button>
              </div>
            </div>

            {/* Members */}
            <div className="card mb-5">
              <div className="flex items-center gap-2.5 mb-4">
                <div
                  style={{
                    width: 32, height: 32,
                    background: 'rgba(59,130,246,0.10)',
                    border: '1px solid rgba(59,130,246,0.2)',
                    borderRadius: 8,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Users size={15} className="text-blue-400" />
                </div>
                <h3 className="font-bold text-white">Участники</h3>
                <span
                  className="ml-auto text-xs px-2 py-0.5 rounded-full"
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    color: 'rgba(255,255,255,0.4)',
                  }}
                >
                  {members.length}
                </span>
              </div>

              {members.length === 0 ? (
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>Загрузка...</p>
              ) : (
                <div className="space-y-2">
                  {members.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center gap-3 p-3 rounded-xl"
                      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                    >
                      <div
                        className="shrink-0 flex items-center justify-center rounded-xl font-bold text-sm"
                        style={{
                          width: 36, height: 36,
                          background: 'rgba(255,110,0,0.12)',
                          border: '1px solid rgba(255,110,0,0.20)',
                          color: '#FF9A3C',
                        }}
                      >
                        {m.users?.name?.charAt(0).toUpperCase() || '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{m.users?.name}</p>
                        <p className="text-xs truncate" style={{ color: 'rgba(255,255,255,0.35)' }}>{m.users?.email}</p>
                      </div>
                      <div className="shrink-0 flex items-center gap-1.5">
                        {m.role === 'owner' && <Crown size={12} style={{ color: '#fbbf24' }} />}
                        {m.role === 'admin' && <UserCheck size={12} style={{ color: '#60a5fa' }} />}
                        <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                          {ROLE_LABELS[m.role] || m.role}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Invite */}
            <div className="card">
              <div className="flex items-center gap-2.5 mb-4">
                <div
                  style={{
                    width: 32, height: 32,
                    background: 'rgba(16,185,129,0.10)',
                    border: '1px solid rgba(16,185,129,0.2)',
                    borderRadius: 8,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Send size={15} style={{ color: '#10b981' }} />
                </div>
                <h3 className="font-bold text-white">Пригласить участника</h3>
              </div>
              <div className="flex gap-3">
                <input
                  type="email"
                  className="input flex-1"
                  placeholder="email@company.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
                />
                <button
                  className="btn-primary shrink-0"
                  onClick={handleInvite}
                  disabled={sendingInvite || !inviteEmail.trim()}
                >
                  {sendingInvite ? 'Отправка...' : 'Пригласить'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
