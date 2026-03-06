import { useState } from 'react';
import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import {
  Building2, Users, Briefcase, UserCheck, ShieldAlert,
  Crown, ChevronLeft, ChevronRight, ToggleLeft,
} from 'lucide-react';
import Layout from '../components/Layout';
import { useAuthStore } from '../utils/auth-store';
import { adminApi } from '../utils/api';

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

export default function AdminPage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [orgPage, setOrgPage] = useState(1);
  const [userPage, setUserPage] = useState(1);
  const LIMIT = 20;

  // Guard: redirect non-superadmin
  if (user && user.role !== 'superadmin') {
    return (
      <Layout>
        <div className="p-8 max-w-2xl mx-auto page-content flex flex-col items-center justify-center min-h-[60vh]">
          <div
            className="flex items-center justify-center mb-5"
            style={{
              width: 72, height: 72,
              background: 'rgba(239,68,68,0.10)',
              border: '1px solid rgba(239,68,68,0.25)',
              borderRadius: 20,
            }}
          >
            <ShieldAlert size={32} className="text-red-400" />
          </div>
          <h2 className="text-2xl font-black text-white mb-2">Доступ запрещён</h2>
          <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Эта страница доступна только суперадминистраторам.
          </p>
          <button className="btn-secondary" onClick={() => navigate('/vacancies')}>
            На главную
          </button>
        </div>
      </Layout>
    );
  }

  return <AdminContent orgPage={orgPage} setOrgPage={setOrgPage} userPage={userPage} setUserPage={setUserPage} LIMIT={LIMIT} qc={qc} />;
}

function AdminContent({
  orgPage, setOrgPage, userPage, setUserPage, LIMIT, qc,
}: {
  orgPage: number;
  setOrgPage: React.Dispatch<React.SetStateAction<number>>;
  userPage: number;
  setUserPage: React.Dispatch<React.SetStateAction<number>>;
  LIMIT: number;
  qc: ReturnType<typeof useQueryClient>;
}) {
  const { data: statsData } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => adminApi.getStats().then((r) => r.data.stats as AdminStats),
  });

  const { data: orgsData } = useQuery({
    queryKey: ['admin-orgs', orgPage],
    queryFn: () => adminApi.getOrgs(orgPage, LIMIT).then((r) => r.data),
  });

  const { data: usersData } = useQuery({
    queryKey: ['admin-users', userPage],
    queryFn: () => adminApi.getUsers(userPage, LIMIT).then((r) => r.data),
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

  const updateRoleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: 'user' | 'superadmin' }) =>
      adminApi.updateUserRole(id, role),
    onSuccess: () => {
      toast.success('Роль обновлена');
      qc.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: () => toast.error('Ошибка обновления роли'),
  });

  const stats: AdminStats = statsData || { organizations: 0, users: 0, vacancies: 0, candidates: 0 };
  const orgs: OrgRow[] = orgsData?.organizations || [];
  const orgTotal: number = orgsData?.total || 0;
  const users: UserRow[] = usersData?.users || [];
  const userTotal: number = usersData?.total || 0;

  return (
    <Layout>
      <div className="p-8 max-w-7xl mx-auto page-content">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <div
              style={{
                width: 32, height: 32,
                background: 'rgba(239,68,68,0.12)',
                border: '1px solid rgba(239,68,68,0.25)',
                borderRadius: 8,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <ShieldAlert size={16} className="text-red-400" />
            </div>
            <h2 className="text-3xl font-black text-white">Админ-панель</h2>
          </div>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Управление организациями и пользователями
          </p>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Организации', value: stats.organizations, icon: Building2, color: '#FF9A3C' },
            { label: 'Пользователи', value: stats.users, icon: Users, color: '#60a5fa' },
            { label: 'Вакансии', value: stats.vacancies, icon: Briefcase, color: '#10b981' },
            { label: 'Кандидаты', value: stats.candidates, icon: UserCheck, color: '#c084fc' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="card" style={{ padding: '1.25rem' }}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  {label}
                </p>
                <div
                  style={{
                    width: 32, height: 32,
                    background: `${color}18`,
                    border: `1px solid ${color}30`,
                    borderRadius: 8,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Icon size={15} style={{ color }} />
                </div>
              </div>
              <p className="text-3xl font-black" style={{ color }}>{value.toLocaleString()}</p>
            </div>
          ))}
        </div>

        {/* Organizations table */}
        <div className="card mb-6" style={{ padding: '1.5rem' }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-white flex items-center gap-2">
              <Building2 size={16} style={{ color: '#FF9A3C' }} />
              Организации
              <span className="text-sm font-normal" style={{ color: 'rgba(255,255,255,0.35)' }}>
                ({orgTotal})
              </span>
            </h3>
            <Pagination
              page={orgPage}
              total={orgTotal}
              limit={LIMIT}
              onPrev={() => setOrgPage((p) => Math.max(1, p - 1))}
              onNext={() => setOrgPage((p) => p + 1)}
            />
          </div>

          <div className="overflow-x-auto">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  {['Название', 'Slug', 'Владелец', 'План', 'Дата', 'Действие'].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: '8px 12px',
                        textAlign: 'left',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                        color: 'rgba(255,154,60,0.6)',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orgs.map((org) => (
                  <tr
                    key={org.id}
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                  >
                    <td style={{ padding: '10px 12px' }}>
                      <p className="text-sm font-semibold text-white">{org.name}</p>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <code className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>{org.slug}</code>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <div>
                        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>{org.users?.name}</p>
                        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>{org.users?.email}</p>
                      </div>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span
                        className="text-xs px-2 py-0.5 rounded-full"
                        style={{
                          background: org.plan === 'pro' ? 'rgba(168,85,247,0.12)' : 'rgba(255,255,255,0.06)',
                          border: `1px solid ${org.plan === 'pro' ? 'rgba(168,85,247,0.3)' : 'rgba(255,255,255,0.1)'}`,
                          color: org.plan === 'pro' ? '#c084fc' : 'rgba(255,255,255,0.4)',
                        }}
                      >
                        {org.plan === 'pro' ? '⭐ Pro' : 'Free'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
                        {new Date(org.created_at).toLocaleDateString('ru')}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <button
                        className="btn-secondary text-xs"
                        style={{ padding: '5px 12px' }}
                        disabled={updatePlanMutation.isPending}
                        onClick={() =>
                          updatePlanMutation.mutate({
                            id: org.id,
                            plan: org.plan === 'pro' ? 'free' : 'pro',
                          })
                        }
                      >
                        <ToggleLeft size={12} />
                        {org.plan === 'pro' ? '→ Free' : '→ Pro'}
                      </button>
                    </td>
                  </tr>
                ))}
                {orgs.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: 'rgba(255,255,255,0.25)', fontSize: '0.85rem' }}>
                      Нет организаций
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Users table */}
        <div className="card" style={{ padding: '1.5rem' }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-white flex items-center gap-2">
              <Users size={16} style={{ color: '#60a5fa' }} />
              Пользователи
              <span className="text-sm font-normal" style={{ color: 'rgba(255,255,255,0.35)' }}>
                ({userTotal})
              </span>
            </h3>
            <Pagination
              page={userPage}
              total={userTotal}
              limit={LIMIT}
              onPrev={() => setUserPage((p) => Math.max(1, p - 1))}
              onNext={() => setUserPage((p) => p + 1)}
            />
          </div>

          <div className="overflow-x-auto">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  {['Имя / Email', 'Компания', 'Роль', 'Верифицирован', 'Дата', 'Действие'].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: '8px 12px',
                        textAlign: 'left',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                        color: 'rgba(96,165,250,0.6)',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '10px 12px' }}>
                      <p className="text-sm font-semibold text-white">{u.name}</p>
                      <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>{u.email}</p>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
                        {u.company_name || '—'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span
                        className="text-xs px-2 py-0.5 rounded-full flex items-center gap-1 w-fit"
                        style={{
                          background: u.role === 'superadmin' ? 'rgba(239,68,68,0.10)' : 'rgba(255,255,255,0.05)',
                          border: `1px solid ${u.role === 'superadmin' ? 'rgba(239,68,68,0.25)' : 'rgba(255,255,255,0.08)'}`,
                          color: u.role === 'superadmin' ? '#f87171' : 'rgba(255,255,255,0.4)',
                        }}
                      >
                        {u.role === 'superadmin' && <Crown size={10} />}
                        {u.role === 'superadmin' ? 'Superadmin' : 'User'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span
                        className="text-xs px-2 py-0.5 rounded-full"
                        style={{
                          background: u.email_verified ? 'rgba(16,185,129,0.10)' : 'rgba(251,191,36,0.08)',
                          border: `1px solid ${u.email_verified ? 'rgba(16,185,129,0.2)' : 'rgba(251,191,36,0.2)'}`,
                          color: u.email_verified ? '#10b981' : '#fbbf24',
                        }}
                      >
                        {u.email_verified ? '✓ Да' : '✗ Нет'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
                        {new Date(u.created_at).toLocaleDateString('ru')}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <button
                        className="btn-secondary text-xs"
                        style={{
                          padding: '5px 12px',
                          borderColor: u.role === 'superadmin' ? 'rgba(239,68,68,0.3)' : undefined,
                          color: u.role === 'superadmin' ? '#f87171' : undefined,
                        }}
                        disabled={updateRoleMutation.isPending}
                        onClick={() =>
                          updateRoleMutation.mutate({
                            id: u.id,
                            role: u.role === 'superadmin' ? 'user' : 'superadmin',
                          })
                        }
                      >
                        {u.role === 'superadmin' ? '→ User' : '→ Admin'}
                      </button>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: 'rgba(255,255,255,0.25)', fontSize: '0.85rem' }}>
                      Нет пользователей
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Layout>
  );
}

function Pagination({
  page, total, limit, onPrev, onNext,
}: {
  page: number;
  total: number;
  limit: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  const maxPage = Math.ceil(total / limit);
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
        {page} / {maxPage || 1}
      </span>
      <button
        onClick={onPrev}
        disabled={page <= 1}
        className="flex items-center justify-center rounded-lg transition-all"
        style={{
          width: 28, height: 28,
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          color: page <= 1 ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.5)',
        }}
      >
        <ChevronLeft size={14} />
      </button>
      <button
        onClick={onNext}
        disabled={page >= maxPage}
        className="flex items-center justify-center rounded-lg transition-all"
        style={{
          width: 28, height: 28,
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          color: page >= maxPage ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.5)',
        }}
      >
        <ChevronRight size={14} />
      </button>
    </div>
  );
}
