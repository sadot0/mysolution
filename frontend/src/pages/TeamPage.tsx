import { useState } from 'react';
import { usePageTitle } from '../utils/usePageTitle';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Users, Loader2,
  Send,
  MessageSquare,
  Shield,
  Clock,
  Plus,
  BriefcaseIcon,
  UserCheck,
  Mail,
  Check,
  Eye,
  Edit3,
  Trash2,
  Star,
} from 'lucide-react';
import Layout from '../components/Layout';
import { orgsApi, adminApi } from '../utils/api';
import { useAuthStore } from '../utils/auth-store';
import type { OrganizationMember } from '../types';

/* ─── Types ─── */

interface ActivityItem {
  id: string;
  author: string;
  action: string;
  type: 'create' | 'analyze' | 'invite';
  time: string;
}

interface NoteItem {
  id: string;
  author: string;
  text: string;
  date: string;
}

/* ─── Helper: relative time ─── */

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.max(0, now - then);
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'только что';
  if (minutes < 60) return `${minutes} мин назад`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ч назад`;
  const days = Math.floor(hours / 24);
  return `${days} дн назад`;
}

const ROLE_LABELS: Record<string, string> = {
  owner: 'Владелец',
  admin: 'Админ',
  member: 'Участник',
};

const ROLE_COLORS: Record<string, string> = {
  owner: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
  admin: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  member: 'text-white/60 bg-white/[0.06] border-white/[0.1]',
};

const ACTIVITY_COLORS: Record<string, string> = {
  create: 'from-blue-500 to-blue-600',
  analyze: 'from-green-500 to-green-600',
  invite: 'from-orange-500 to-orange-600',
};

const PERMISSIONS = [
  { action: 'Создание вакансий', owner: true, admin: true, member: false },
  { action: 'Редактирование вакансий', owner: true, admin: true, member: false },
  { action: 'Удаление вакансий', owner: true, admin: false, member: false },
  { action: 'Просмотр кандидатов', owner: true, admin: true, member: true },
  { action: 'AI-анализ кандидатов', owner: true, admin: true, member: false },
  { action: 'Отправка приглашений', owner: true, admin: true, member: false },
  { action: 'Управление командой', owner: true, admin: false, member: false },
  { action: 'Просмотр аналитики', owner: true, admin: true, member: true },
  { action: 'Настройки организации', owner: true, admin: false, member: false },
  { action: 'Комментарии и заметки', owner: true, admin: true, member: true },
];

/* ─── Helpers ─── */

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function memberGradient(index: number): string {
  const gradients = [
    'from-orange-500 to-red-500',
    'from-blue-500 to-purple-500',
    'from-green-500 to-teal-500',
    'from-pink-500 to-rose-500',
    'from-yellow-500 to-orange-500',
  ];
  return gradients[index % gradients.length];
}

/* ─── Animation variants ─── */

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0 },
};

/* ─── Component ─── */

export default function TeamPage() {
  usePageTitle('Команда');
  const user = useAuthStore((s) => s.user);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [inviting, setInviting] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState(false);
  const [inviteError, setInviteError] = useState(false);
  const [newNote, setNewNote] = useState('');

  // Notes — localStorage persistence
  const [notes, setNotes] = useState<NoteItem[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('team_notes') || '[]');
    } catch (e) {
      console.error('Ошибка чтения заметок из localStorage:', e);
      return [];
    }
  });

  // Fetch real team members from API
  const { data: membersData, isLoading: membersLoading } = useQuery({
    queryKey: ['team-members'],
    queryFn: () =>
      orgsApi
        .getMembers()
        .then((r) => {
          const list = r.data?.members || r.data || [];
          if (!Array.isArray(list) || list.length === 0) return [];
          return list.map((m: OrganizationMember, i: number) => ({
            id: m.user_id || m.id,
            name: m.users?.name || `Участник ${i + 1}`,
            role: m.role,
            email: m.users?.email || '',
            vacancies: 0,
            analyzed: 0,
            invited: 0,
          }));
        })
        .catch((e) => { console.error('Ошибка загрузки участников команды:', e); return []; }),
  });

  const members = membersData && membersData.length > 0 ? membersData : [];

  // Fetch activity from admin usage logs (falls back to empty for non-admins)
  const { data: activityData } = useQuery({
    queryKey: ['team-activity'],
    queryFn: async (): Promise<ActivityItem[]> => {
      try {
        const res = await adminApi.getUsage();
        const recent = res.data?.usage?.recent || res.data?.recent || [];
        if (!Array.isArray(recent)) return [];
        return recent.map(
          (
            entry: { id?: string; user_name?: string; action?: string; type?: string; created_at?: string },
            i: number,
          ) => ({
            id: entry.id || String(i),
            author: entry.user_name || 'Система',
            action: entry.action || 'действие',
            type: (entry.type as ActivityItem['type']) || 'create',
            time: entry.created_at ? timeAgo(entry.created_at) : '',
          }),
        );
      } catch (e) {
        console.error('Ошибка загрузки активности команды:', e);
        return [];
      }
    },
  });

  const activity: ActivityItem[] = activityData || [];

  // Invite member via real API
  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setInviteError(false);
    try {
      await orgsApi.invite(inviteEmail.trim());
      setInviteSuccess(true);
      setInviteEmail('');
      setTimeout(() => setInviteSuccess(false), 3000);
    } catch (e) {
      console.error('Ошибка отправки приглашения:', e);
      setInviteError(true);
      setTimeout(() => setInviteError(false), 3000);
    } finally {
      setInviting(false);
    }
  };

  // Notes — add with localStorage persistence
  const handleAddNote = () => {
    if (!newNote.trim()) return;
    const note: NoteItem = {
      id: Date.now().toString(),
      author: user?.name || 'Вы',
      text: newNote.trim(),
      date: new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' }),
    };
    const updated = [note, ...notes];
    setNotes(updated);
    localStorage.setItem('team_notes', JSON.stringify(updated));
    setNewNote('');
  };


  if (membersLoading) return <Layout><div className="flex items-center justify-center py-20"><Loader2 className="animate-spin text-orange-500" size={32} /></div></Layout>;
  return (
    <Layout>
      <div className="p-6 md:p-8 page-content">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-500/20">
              <Users size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">КОМАНДА</h1>
              <p className="text-sm text-white/40">Управление участниками и совместная работа</p>
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Left column — Members + Permissions */}
          <div className="xl:col-span-2 space-y-6">

            {/* Members */}
            <motion.div variants={container} initial="hidden" animate="show">
              <h2 className="text-sm font-semibold text-white/60 tracking-wider uppercase mb-4">
                Участники ({members.length})
              </h2>
              {members.length === 0 ? (
                <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-2xl p-8 text-center">
                  <Users size={32} className="text-white/25 mx-auto mb-3" />
                  <p className="text-sm text-white/40">Пока нет участников. Пригласите коллег в команду.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {members.map((m, idx) => (
                    <motion.div
                      key={m.id}
                      variants={item}
                      className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-2xl p-5 hover:border-[rgba(232,114,28,0.15)] hover:shadow-lg hover:shadow-black/20 transition-all duration-200"
                    >
                      <div className="flex items-start gap-3 mb-4">
                        <div className="relative">
                          <div className={`w-11 h-11 rounded-full bg-gradient-to-br ${memberGradient(idx)} flex items-center justify-center text-white text-sm font-bold`}>
                            {getInitials(m.name)}
                          </div>
                          {/* Online dot */}
                          <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 border-2 border-black rounded-full" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-white truncate">{m.name}</p>
                          <p className="text-xs text-white/40 truncate">{m.email}</p>
                        </div>
                      </div>

                      <div className="mb-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase border rounded-full ${ROLE_COLORS[m.role]}`}>
                          <Shield size={10} />
                          {ROLE_LABELS[m.role] || m.role}
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div className="text-center p-2 rounded-lg bg-white/[0.02]">
                          <BriefcaseIcon size={12} className="text-blue-400 mx-auto mb-1" />
                          <p className="text-sm font-bold text-white">{m.vacancies}</p>
                          <p className="text-[9px] text-white/40">Вакансий</p>
                        </div>
                        <div className="text-center p-2 rounded-lg bg-white/[0.02]">
                          <UserCheck size={12} className="text-green-400 mx-auto mb-1" />
                          <p className="text-sm font-bold text-white">{m.analyzed}</p>
                          <p className="text-[9px] text-white/40">Оценено</p>
                        </div>
                        <div className="text-center p-2 rounded-lg bg-white/[0.02]">
                          <Send size={12} className="text-orange-400 mx-auto mb-1" />
                          <p className="text-sm font-bold text-white">{m.invited}</p>
                          <p className="text-[9px] text-white/40">Приглашений</p>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>

            {/* Invite section */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-2xl p-5"
            >
              <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                <Mail size={16} className="text-orange-400" />
                Пригласить в команду
              </h2>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="email"
                  placeholder="email@example.com"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  className="input flex-1 text-sm"
                  onKeyDown={e => e.key === 'Enter' && handleInvite()}
                />
                <select
                  value={inviteRole}
                  onChange={e => setInviteRole(e.target.value)}
                  className="select-premium text-sm w-full sm:w-40"
                >
                  <option value="admin">Админ</option>
                  <option value="member">Участник</option>
                </select>
                <button
                  onClick={handleInvite}
                  disabled={inviting || !inviteEmail.trim()}
                  className="btn-primary px-5 py-2.5 text-sm flex items-center gap-2 whitespace-nowrap disabled:opacity-50"
                >
                  {inviteSuccess ? (
                    <>
                      <Check size={14} />
                      Отправлено
                    </>
                  ) : inviteError ? (
                    <span className="text-red-300">Ошибка отправки</span>
                  ) : (
                    <>
                      <Plus size={14} />
                      {inviting ? 'Отправка...' : 'Пригласить'}
                    </>
                  )}
                </button>
              </div>
            </motion.div>

            {/* Roles & Permissions */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-2xl p-5"
            >
              <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                <Shield size={16} className="text-orange-400" />
                Роли и разрешения
              </h2>

              {/* Role summary */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
                <div className="p-3 rounded-lg bg-orange-500/5 border border-orange-500/20">
                  <p className="text-xs font-bold text-orange-400 mb-1">
                    <Star size={10} className="inline mr-1" />
                    Владелец
                  </p>
                  <p className="text-[11px] text-white/60">Полный доступ ко всем функциям</p>
                </div>
                <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/20">
                  <p className="text-xs font-bold text-blue-400 mb-1">
                    <Edit3 size={10} className="inline mr-1" />
                    Админ
                  </p>
                  <p className="text-[11px] text-white/60">Управление вакансиями и кандидатами</p>
                </div>
                <div className="p-3 rounded-lg bg-neutral-500/5 border border-neutral-600/20">
                  <p className="text-xs font-bold text-white/60 mb-1">
                    <Eye size={10} className="inline mr-1" />
                    Участник
                  </p>
                  <p className="text-[11px] text-white/60">Просмотр и комментарии</p>
                </div>
              </div>

              {/* Permissions table */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-white/[0.04]">
                      <th className="text-left py-2 pr-4 text-white/40 font-medium">Действие</th>
                      <th className="text-center py-2 px-3 text-orange-400 font-medium">Владелец</th>
                      <th className="text-center py-2 px-3 text-blue-400 font-medium">Админ</th>
                      <th className="text-center py-2 px-3 text-white/60 font-medium">Участник</th>
                    </tr>
                  </thead>
                  <tbody>
                    {PERMISSIONS.map(p => (
                      <tr key={p.action} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                        <td className="py-2 pr-4 text-white/70">{p.action}</td>
                        <td className="py-2 px-3 text-center">
                          {p.owner ? <Check size={14} className="text-green-400 mx-auto" /> : <Trash2 size={12} className="text-white/25 mx-auto" />}
                        </td>
                        <td className="py-2 px-3 text-center">
                          {p.admin ? <Check size={14} className="text-green-400 mx-auto" /> : <Trash2 size={12} className="text-white/25 mx-auto" />}
                        </td>
                        <td className="py-2 px-3 text-center">
                          {p.member ? <Check size={14} className="text-green-400 mx-auto" /> : <Trash2 size={12} className="text-white/25 mx-auto" />}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          </div>

          {/* Right column — Activity Feed + Notes */}
          <div className="space-y-6">
            {/* Activity Feed */}
            <motion.div
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 }}
              className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-2xl p-5"
            >
              <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                <Clock size={16} className="text-orange-400" />
                Активность команды
              </h2>
              <div className="space-y-4">
                {activity.length === 0 ? (
                  <p className="text-xs text-white/25 text-center py-4">Нет данных об активности</p>
                ) : (
                  activity.map(a => (
                    <div key={a.id} className="flex items-start gap-3">
                      <div className={`shrink-0 w-8 h-8 rounded-full bg-gradient-to-br ${ACTIVITY_COLORS[a.type] || ACTIVITY_COLORS.create} flex items-center justify-center text-white text-[10px] font-bold`}>
                        {a.author[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-white/70">
                          <span className="font-semibold text-white">{a.author}</span>{' '}
                          {a.action}
                        </p>
                        <p className="text-[10px] text-white/25 mt-0.5">{a.time}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>

            {/* Notes */}
            <motion.div
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.25 }}
              className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-2xl p-5"
            >
              <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                <MessageSquare size={16} className="text-orange-400" />
                Заметки команды
              </h2>

              {/* Add note */}
              <div className="mb-4">
                <textarea
                  placeholder="Написать заметку для команды..."
                  value={newNote}
                  onChange={e => setNewNote(e.target.value)}
                  rows={3}
                  className="input w-full text-sm resize-none"
                />
                <button
                  onClick={handleAddNote}
                  disabled={!newNote.trim()}
                  className="btn-primary mt-2 px-4 py-2 text-xs flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Plus size={12} />
                  Добавить
                </button>
              </div>

              {/* Notes list */}
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {notes.length === 0 ? (
                  <p className="text-xs text-white/25 text-center py-4">Пока нет заметок</p>
                ) : (
                  notes.map(n => (
                    <div key={n.id} className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                      <div className="flex items-center gap-2 mb-1.5">
                        <div className="w-5 h-5 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center text-white text-[8px] font-bold">
                          {n.author[0]}
                        </div>
                        <span className="text-[11px] font-semibold text-white">{n.author}</span>
                        <span className="text-[10px] text-white/25 ml-auto">{n.date}</span>
                      </div>
                      <p className="text-xs text-white/60 leading-relaxed">{n.text}</p>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
