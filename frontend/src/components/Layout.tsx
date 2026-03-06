import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { BriefcaseIcon, BarChart3, LogOutIcon, UserCircle2, Users, Settings, Menu, X } from 'lucide-react';
import { useAuthStore } from '../utils/auth-store';
import clsx from 'clsx';

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { href: '/vacancies', label: 'Вакансии', icon: BriefcaseIcon },
    { href: '/candidates', label: 'Кандидаты', icon: Users },
    { href: '/analytics', label: 'Аналитика', icon: BarChart3 },
    { href: '/settings', label: 'Настройки', icon: Settings },
  ];

  const sidebarContent = (
    <>
      {/* Logo */}
      <div
        className="m-4 p-4 flex items-center gap-3"
        style={{
          background: 'linear-gradient(135deg, rgba(255,110,0,0.10) 0%, rgba(255,110,0,0.05) 100%)',
          border: '1px solid rgba(255,110,0,0.12)',
          borderRadius: 18,
        }}
      >
        <div
          className="flex items-center justify-center shrink-0 font-black text-black text-lg"
          style={{
            width: 44,
            height: 44,
            background: 'linear-gradient(135deg, #FF6A00 0%, #FF9A3C 50%, #FFBE7B 100%)',
            borderRadius: 12,
            boxShadow: '0 4px 12px rgba(255,106,0,0.45), inset 0 1px 0 rgba(255,255,255,0.3)',
          }}
        >
          R
        </div>
        <div>
          <h1 className="text-base font-bold text-white leading-tight">
            Рекрутор <span style={{ color: '#FF9A3C' }}>AI</span>
          </h1>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
            HR Intelligence
          </p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-2 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            to={href}
            className={clsx('nav-item', location.pathname.startsWith(href) && 'active')}
            onClick={() => setSidebarOpen(false)}
          >
            <Icon size={17} className="shrink-0" />
            {label}
          </Link>
        ))}
      </nav>

      {/* User */}
      <div
        className="m-4 p-3"
        style={{
          borderTop: '1px solid rgba(255,110,0,0.08)',
          background: 'linear-gradient(135deg, rgba(255,110,0,0.05) 0%, transparent 100%)',
          borderRadius: 14,
        }}
      >
        <div className="flex items-center gap-3 mb-3">
          <div
            className="shrink-0 flex items-center justify-center rounded-full"
            style={{
              width: 36,
              height: 36,
              background: 'rgba(255,110,0,0.15)',
              border: '1px solid rgba(255,110,0,0.25)',
            }}
          >
            <UserCircle2 size={20} style={{ color: '#FF9A3C' }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">{user?.name}</p>
            <p className="text-xs truncate" style={{ color: 'rgba(255,255,255,0.35)' }}>
              {user?.email}
            </p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 w-full px-3 py-2 text-xs rounded-xl transition-all"
          style={{ color: 'rgba(255,255,255,0.35)' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(239,68,68,0.10)';
            e.currentTarget.style.color = '#f87171';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = 'rgba(255,255,255,0.35)';
          }}
        >
          <LogOutIcon size={14} />
          Выйти
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="sidebar-mobile-overlay md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className="flex flex-col shrink-0 h-screen z-50"
        style={{
          width: 272,
          background: 'linear-gradient(180deg, rgba(8,5,2,0.98) 0%, rgba(14,10,4,0.96) 100%)',
          backdropFilter: 'blur(40px)',
          WebkitBackdropFilter: 'blur(40px)',
          borderRight: '1px solid rgba(255,110,0,0.10)',
          overflowY: 'auto',
          // Mobile: fixed + slide
          position: 'fixed' as const,
          top: 0,
          left: 0,
          transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.3s cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        {/* Mobile close button */}
        <button
          className="absolute right-4 top-4 md:hidden z-10 flex items-center justify-center rounded-xl transition-all"
          onClick={() => setSidebarOpen(false)}
          style={{
            width: 32,
            height: 32,
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.10)',
            color: 'rgba(255,255,255,0.5)',
          }}
        >
          <X size={15} />
        </button>
        {sidebarContent}
      </aside>

      {/* Desktop sidebar (sticky, always visible) */}
      <aside
        className="hidden md:flex flex-col shrink-0"
        style={{
          width: 272,
          background: 'linear-gradient(180deg, rgba(8,5,2,0.98) 0%, rgba(14,10,4,0.96) 100%)',
          backdropFilter: 'blur(40px)',
          WebkitBackdropFilter: 'blur(40px)',
          borderRight: '1px solid rgba(255,110,0,0.10)',
          position: 'sticky',
          top: 0,
          height: '100vh',
          overflowY: 'auto',
        }}
      >
        {sidebarContent}
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto min-w-0">
        {/* Mobile hamburger button */}
        <button
          className="md:hidden fixed top-4 left-4 z-30 flex items-center justify-center rounded-xl transition-all"
          onClick={() => setSidebarOpen(true)}
          style={{
            width: 40,
            height: 40,
            background: 'linear-gradient(135deg, rgba(255,110,0,0.18) 0%, rgba(255,110,0,0.10) 100%)',
            border: '1px solid rgba(255,110,0,0.28)',
            color: '#FF9A3C',
            backdropFilter: 'blur(12px)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.3), 0 0 20px rgba(255,106,0,0.12)',
          }}
        >
          <Menu size={18} />
        </button>
        {children}
      </main>
    </div>
  );
}
