import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { BriefcaseIcon, BarChart3, LogOutIcon, Users, Settings, Menu, X, HelpCircle, ShieldAlert, Building2, GraduationCap, Coins, Calendar, Database, ClipboardCheck, FileText, UsersRound } from 'lucide-react';
import { useAuthStore } from '../utils/auth-store';
import clsx from 'clsx';
import NotificationBell from './NotificationBell';
import { useKeyboardShortcuts } from '../utils/useKeyboardShortcuts';
import ScrollToTop from './ScrollToTop';
import { useSessionTimeout } from '../utils/useSessionTimeout';

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  badge?: string;
}

interface NavGroup {
  label: string | null;
  items: NavItem[];
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLElement>(null);

  useKeyboardShortcuts();
  useSessionTimeout();

  // Focus trap for mobile menu
  const handleMobileMenuKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key !== 'Tab' || !mobileMenuRef.current) return;

    const focusableElements = mobileMenuRef.current.querySelectorAll<HTMLElement>(
      'a[href], button, input, textarea, select, [tabindex]:not([tabindex="-1"])'
    );
    if (focusableElements.length === 0) return;

    const firstEl = focusableElements[0];
    const lastEl = focusableElements[focusableElements.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      }
    } else {
      if (document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    }
  }, []);

  useEffect(() => {
    if (mobileMenuOpen) {
      document.addEventListener('keydown', handleMobileMenuKeyDown);
      // Focus the close button when menu opens
      const closeBtn = mobileMenuRef.current?.querySelector<HTMLElement>('button');
      if (closeBtn) closeBtn.focus();
    } else {
      document.removeEventListener('keydown', handleMobileMenuKeyDown);
    }
    return () => document.removeEventListener('keydown', handleMobileMenuKeyDown);
  }, [mobileMenuOpen, handleMobileMenuKeyDown]);

  // Close mobile menu on Escape
  useEffect(() => {
    const handleEscape = () => {
      if (mobileMenuOpen) setMobileMenuOpen(false);
    };
    document.addEventListener('shortcut:escape', handleEscape);
    return () => document.removeEventListener('shortcut:escape', handleEscape);
  }, [mobileMenuOpen]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navGroups: NavGroup[] = [
    {
      label: null, // Core recruitment
      items: [
        { href: '/vacancies', label: 'Вакансии', icon: BriefcaseIcon },
        { href: '/candidates', label: 'Кандидаты', icon: Users },
        { href: '/interviews', label: 'Интервью', icon: Calendar },
        { href: '/talent-pool', label: 'База талантов', icon: Database },
      ],
    },
    {
      label: 'ИНСТРУМЕНТЫ',
      items: [
        { href: '/assessments', label: 'Тестирование', icon: ClipboardCheck },
        { href: '/analytics', label: 'Аналитика', icon: BarChart3 },
        { href: '/reports', label: 'Отчёты', icon: FileText },
        { href: '/team', label: 'Команда', icon: UsersRound },
      ],
    },
    {
      label: 'МОДУЛИ',
      items: [
        { href: '/crm', label: 'CRM', icon: Building2, badge: 'скоро' },
        { href: '/lms', label: 'Обучение', icon: GraduationCap, badge: 'скоро' },
      ],
    },
    {
      label: null, // Bottom settings
      items: [
        { href: '/settings', label: 'Настройки', icon: Settings },
        { href: '/support', label: 'Поддержка', icon: HelpCircle },
        ...(user?.role === 'superadmin' ? [{ href: '/admin', label: 'Админ', icon: ShieldAlert }] : []),
      ],
    },
  ];

  const mobileBottomNav: NavItem[] = [
    { href: '/vacancies', label: 'Вакансии', icon: BriefcaseIcon },
    { href: '/candidates', label: 'Кандидаты', icon: Users },
    { href: '/analytics', label: 'Аналитика', icon: BarChart3 },
    { href: '/settings', label: 'Ещё', icon: Settings },
  ];

  const sidebarContent = (onNavClick?: () => void) => (
    <>
      {/* Logo + Token balance */}
      <div className="px-5 pt-5 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/logo-full.svg" alt="Solution" className="h-6" />
            <span className="text-[9px] font-bold tracking-[0.2em] text-orange-400/60 bg-orange-500/10 px-1.5 py-0.5 rounded">HUB</span>
          </div>
          <div className="flex items-center gap-1.5">
            <NotificationBell />
          <Link to="/settings" className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-neutral-800 border border-neutral-700/50 hover:border-orange-500/30 transition-colors">
            <Coins size={11} className="text-orange-400" />
            <span className="text-[11px] font-bold font-mono text-orange-400">
              {user?.token_balance?.toLocaleString() ?? '\u2014'}
            </span>
          </Link>
          </div>
        </div>
      </div>

      {/* Grouped Nav */}
      <nav className="flex-1 px-3 py-2 overflow-y-auto" aria-label="Основная навигация">
        {navGroups.map((group, gi) => (
          <div key={gi} className={gi > 0 ? 'mt-4 pt-4 border-t border-neutral-800' : ''}>
            {group.label && (
              <p className="px-3 mb-2 text-[10px] font-semibold text-neutral-600 tracking-[0.15em] uppercase">
                {group.label}
              </p>
            )}
            <div className="space-y-0.5" role="list">
              {group.items.map(({ href, label, icon: Icon, badge }) => {
                const isActive = location.pathname.startsWith(href);
                return (
                  <Link
                    key={href}
                    to={href}
                    onClick={onNavClick}
                    aria-label={label}
                    aria-current={isActive ? 'page' : undefined}
                    className={clsx(
                      'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200',
                      isActive
                        ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20'
                        : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
                    )}
                  >
                    <Icon size={16} className="shrink-0" aria-hidden="true" />
                    <span className="text-[13px] font-medium">{label}</span>
                    {badge && (
                      <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded bg-orange-500/15 text-orange-400 font-medium tracking-wider">
                        {badge.toUpperCase()}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User */}
      <div className="px-3 py-3 border-t border-neutral-800">
        <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-neutral-800/50 transition-colors">
          <div className="shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 text-white font-bold text-xs" aria-hidden="true">
            {user?.name?.charAt(0)?.toUpperCase() || '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-white truncate">{user?.name}</p>
            <p className="text-[10px] text-neutral-500 truncate">{user?.email}</p>
          </div>
          <button
            onClick={handleLogout}
            className="shrink-0 p-1.5 rounded-md text-neutral-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            title="Выйти"
            aria-label="Выйти из аккаунта"
          >
            <LogOutIcon size={14} aria-hidden="true" />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className="min-h-screen flex">
      {/* Skip to content */}
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[200] focus:bg-orange-500 focus:text-white focus:px-4 focus:py-2 focus:rounded-lg">
        Перейти к содержимому
      </a>

      {/* Mobile top bar */}
      <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between h-14 px-4 bg-neutral-900 border-b border-neutral-700 md:hidden">
        <img src="/logo-full.svg" alt="Solution" className="h-5" />
        <div className="flex items-center gap-2">
          <NotificationBell />
          {/* Token badge (mobile) */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-neutral-800/80 border border-neutral-700/50 rounded-full">
            <Coins size={12} className="text-orange-400" aria-hidden="true" />
            <span className="text-xs font-bold font-mono text-orange-400">
              {user?.token_balance?.toLocaleString() ?? '\u2014'}
            </span>
          </div>
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="flex items-center justify-center w-10 h-10 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
            aria-label="Открыть меню"
            aria-expanded={mobileMenuOpen}
          >
            <Menu size={22} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Mobile sidebar overlay */}
      {/* Backdrop */}
      <div
        className={clsx(
          'fixed inset-0 z-[60] bg-black/60 transition-opacity duration-300 md:hidden',
          mobileMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
        onClick={() => setMobileMenuOpen(false)}
        aria-hidden="true"
      />
      {/* Slide-in sidebar */}
      <aside
        ref={mobileMenuRef}
        role="dialog"
        aria-modal="true"
        aria-label="Навигационное меню"
        className={clsx(
          'fixed top-0 left-0 z-[70] flex flex-col w-[272px] h-screen bg-neutral-900 border-r border-neutral-700 overflow-y-auto transition-transform duration-300 ease-in-out md:hidden',
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Close button */}
        <div className="absolute top-4 right-3">
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center justify-center w-9 h-9 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
            aria-label="Закрыть меню"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        {sidebarContent(() => setMobileMenuOpen(false))}
      </aside>

      {/* Desktop / tablet sidebar */}
      <aside className="hidden md:flex flex-col shrink-0 w-[220px] lg:w-[272px] bg-neutral-900 border-r border-neutral-700 fixed h-screen overflow-y-auto transition-all duration-300 ease-in-out" aria-label="Боковая панель">
        {sidebarContent()}
      </aside>

      {/* Spacer for fixed sidebar */}
      <div className="hidden md:block w-[220px] lg:w-[272px] shrink-0 transition-all duration-300 ease-in-out" />

      {/* Main content */}
      <main id="main-content" className="flex-1 overflow-auto min-w-0 bg-black mobile-main pt-14 md:pt-0 pb-20 md:pb-0">
        {children}
      </main>

      {/* Mobile bottom navigation bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex items-stretch bg-neutral-900/80 backdrop-blur-xl border-t border-white/[0.06] md:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }} aria-label="Мобильная навигация">
        {mobileBottomNav.map(({ href, label, icon: Icon }) => {
          const active = location.pathname.startsWith(href);
          return (
            <Link key={href} to={href} className="flex-1 flex flex-col items-center justify-center gap-1 py-2.5" aria-label={label} aria-current={active ? 'page' : undefined}>
              <Icon size={18} className={active ? 'text-orange-500' : 'text-neutral-500'} aria-hidden="true" />
              <span className={clsx('text-[9px] font-medium tracking-wider', active ? 'text-orange-500' : 'text-neutral-600')}>
                {label}
              </span>
            </Link>
          );
        })}
      </nav>
      <ScrollToTop />
    </div>
  );
}
