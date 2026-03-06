import { Link, useLocation } from 'react-router-dom';
import { BriefcaseIcon, BarChart3, Zap } from 'lucide-react';
import clsx from 'clsx';

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  return (
    <div className="min-h-screen flex">
      <aside className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col">
        <div className="p-6 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <Zap size={16} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white leading-none">Рекрутор <span className="text-indigo-400">AI</span></h1>
              <p className="text-xs text-gray-500 mt-0.5">Demo версия</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {[
            { href: '/', label: 'Дашборд', icon: BarChart3 },
            { href: '/vacancy/1', label: 'Senior Backend Dev', icon: BriefcaseIcon },
            { href: '/vacancy/2', label: 'Frontend Developer', icon: BriefcaseIcon },
            { href: '/vacancy/3', label: 'DevOps Engineer', icon: BriefcaseIcon },
          ].map(({ href, label, icon: Icon }) => (
            <Link key={href} to={href} className={clsx(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
              location.pathname === href ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
            )}>
              <Icon size={16} />{label}
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t border-gray-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center text-xs font-bold text-gray-300">HR</div>
            <div>
              <p className="text-sm font-medium text-gray-200">Мария Иванова</p>
              <p className="text-xs text-gray-500">HR Manager</p>
            </div>
          </div>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
