import { Link } from 'react-router-dom';
import { usePageTitle } from '../utils/usePageTitle';
import { Home, ArrowLeft } from 'lucide-react';

export default function NotFoundPage() {
  usePageTitle('404');
  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="text-8xl font-black text-orange-500/20 mb-4 font-mono">404</div>
        <h1 className="text-2xl font-bold text-white mb-2">Страница не найдена</h1>
        <p className="text-neutral-400 mb-8">
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
