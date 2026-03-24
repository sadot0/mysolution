import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { usePageTitle } from '../utils/usePageTitle';
import { Home, ArrowLeft, BriefcaseIcon, BarChart3, HelpCircle } from 'lucide-react';

const suggestedLinks = [
  { icon: BriefcaseIcon, label: 'Вакансии', href: '/vacancies' },
  { icon: BarChart3, label: 'Аналитика', href: '/analytics' },
  { icon: HelpCircle, label: 'Поддержка', href: '/settings' },
];

export default function NotFoundPage() {
  usePageTitle('404');

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4 relative overflow-hidden">
      {/* Gradient orbs */}
      <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] rounded-full bg-orange-500/[0.05] blur-[150px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full bg-purple-500/[0.04] blur-[130px] pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] rounded-full bg-blue-500/[0.03] blur-[100px] pointer-events-none" />

      <div className="relative z-10 text-center max-w-lg w-full">
        {/* 404 number */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="mb-6"
        >
          <div className="inline-block bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-3xl px-12 py-8">
            <span className="text-[120px] sm:text-[160px] font-black leading-none bg-gradient-to-b from-orange-400/30 to-orange-600/10 bg-clip-text text-transparent font-mono select-none">
              404
            </span>
          </div>
        </motion.div>

        {/* Message */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-3">
            Страница не найдена
          </h1>
          <p className="text-white/40 mb-8 max-w-sm mx-auto">
            Запрашиваемая страница не существует или была перемещена. Попробуйте вернуться или выбрать один из разделов ниже.
          </p>
        </motion.div>

        {/* Action buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex gap-3 justify-center mb-10"
        >
          <Link to="/dashboard" className="btn-primary flex items-center gap-2">
            <Home size={16} />
            На главную
          </Link>
          <button onClick={() => window.history.back()} className="btn-secondary flex items-center gap-2">
            <ArrowLeft size={16} />
            Назад
          </button>
        </motion.div>

        {/* Suggested links */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-2xl p-6"
        >
          <p className="text-xs text-white/40 mb-4 uppercase tracking-wider font-medium">
            Может быть полезно
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            {suggestedLinks.map(({ icon: Icon, label, href }) => (
              <Link
                key={href}
                to={href}
                className="flex-1 flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:border-orange-500/20 hover:bg-white/[0.05] transition-all group"
              >
                <div className="p-2 rounded-lg bg-white/[0.04] group-hover:bg-orange-500/10 transition-colors">
                  <Icon size={14} className="text-white/60 group-hover:text-orange-400 transition-colors" />
                </div>
                <span className="text-sm text-white/80 group-hover:text-white transition-colors font-medium">
                  {label}
                </span>
              </Link>
            ))}
          </div>
        </motion.div>

        <div className="text-center mt-8 text-white/20 text-xs">
          Powered by <a href="https://mysolution.uz" className="text-white/30 hover:text-orange-400 transition-colors">SOLUTION</a>
        </div>
      </div>
    </div>
  );
}
