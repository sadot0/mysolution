import { Link } from 'react-router-dom';
import { usePageTitle } from '../utils/usePageTitle';
import { Home, ArrowLeft } from 'lucide-react';

export default function NotFoundPage() {
  usePageTitle('404');
  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4 relative overflow-hidden">
      {/* Gradient orbs */}
      <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] rounded-full bg-orange-500/[0.04] blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[300px] h-[300px] rounded-full bg-purple-500/[0.03] blur-[100px] pointer-events-none" />

      <div className="text-center max-w-md bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-2xl p-10">
        <div className="text-8xl font-black text-orange-500/20 mb-4 font-mono">404</div>
        <h1 className="text-2xl font-bold text-white mb-2">Страница не найдена</h1>
        <p className="text-white/40 mb-8">
          Запрашиваемая страница не существует или была перемещена.
        </p>
        <div className="flex gap-3 justify-center">
          <Link to="/vacancies" className="btn-primary">
            <Home size={16} />
            На главную
          </Link>
          <button onClick={() => window.history.back()} className="btn-secondary">
            <ArrowLeft size={16} />
            Назад
          </button>
        </div>
      </div>
    </div>
  );
}
