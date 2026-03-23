import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, UserPlus, BrainCircuit, Info, X } from 'lucide-react';
import { notificationsApi } from '../utils/api';
import clsx from 'clsx';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string | null;
  link: string | null;
  read: boolean;
  created_at: string;
}

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
  if (days < 7) return `${days} д назад`;
  return new Date(dateStr).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

function typeIcon(type: string) {
  switch (type) {
    case 'new_candidate':
      return <UserPlus size={14} className="text-green-400" />;
    case 'ai_analysis':
      return <BrainCircuit size={14} className="text-orange-400" />;
    default:
      return <Info size={14} className="text-blue-400" />;
  }
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Poll unread count every 30 seconds
  const { data: countData } = useQuery({
    queryKey: ['notifications-unread-count'],
    queryFn: () => notificationsApi.unreadCount().then((r) => r.data),
    refetchInterval: 30000,
    staleTime: 10000,
  });

  const unreadCount = countData?.count ?? 0;

  // Fetch full list only when dropdown is open
  const { data: listData } = useQuery({
    queryKey: ['notifications-list'],
    queryFn: () => notificationsApi.list().then((r) => r.data),
    enabled: open,
    staleTime: 5000,
  });

  const notifications: Notification[] = listData?.notifications ?? [];

  const markReadMutation = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-list'] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-list'] });
    },
  });

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClick);
      return () => document.removeEventListener('mousedown', handleClick);
    }
  }, [open]);

  const handleNotificationClick = (n: Notification) => {
    if (!n.read) {
      markReadMutation.mutate(n.id);
    }
    if (n.link) {
      navigate(n.link);
    }
    setOpen(false);
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative flex items-center justify-center w-8 h-8 rounded-md bg-neutral-800 border border-neutral-700/50 hover:border-orange-500/30 transition-colors"
        title="Уведомления"
      >
        <Bell size={14} className="text-neutral-400" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-[9px] font-bold text-white leading-none">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute top-full mt-2 right-0 w-80 max-h-[420px] bg-neutral-900 border border-neutral-700 rounded-xl shadow-2xl shadow-black/60 z-[100] flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
            <span className="text-sm font-semibold text-white">Уведомления</span>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={() => markAllReadMutation.mutate()}
                  className="flex items-center gap-1 text-[11px] text-orange-400 hover:text-orange-300 transition-colors"
                  title="Отметить все прочитанными"
                >
                  <CheckCheck size={12} />
                  <span>Прочитать все</span>
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="p-1 rounded text-neutral-500 hover:text-white transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-neutral-500">
                <Bell size={28} className="mb-2 opacity-30" />
                <p className="text-xs">Нет уведомлений</p>
              </div>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  className={clsx(
                    'w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-neutral-800/60',
                    !n.read && 'bg-orange-500/5'
                  )}
                >
                  <div className="shrink-0 mt-0.5 flex items-center justify-center w-7 h-7 rounded-full bg-neutral-800">
                    {typeIcon(n.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={clsx('text-xs leading-snug', n.read ? 'text-neutral-400' : 'text-white font-medium')}>
                      {n.title}
                    </p>
                    {n.message && (
                      <p className="text-[11px] text-neutral-500 mt-0.5 line-clamp-2">{n.message}</p>
                    )}
                    <p className="text-[10px] text-neutral-600 mt-1">{timeAgo(n.created_at)}</p>
                  </div>
                  {!n.read && (
                    <span className="shrink-0 mt-2 w-2 h-2 rounded-full bg-orange-500" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
