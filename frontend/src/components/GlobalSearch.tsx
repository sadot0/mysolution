import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, BriefcaseIcon, Users, FileText, Settings, BarChart3, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface SearchItem {
  label: string;
  href: string;
  icon: React.ElementType;
  category: string;
}

const SEARCH_ITEMS: SearchItem[] = [
  { label: 'Главная', href: '/dashboard', icon: BarChart3, category: 'Навигация' },
  { label: 'Вакансии', href: '/vacancies', icon: BriefcaseIcon, category: 'Навигация' },
  { label: 'Кандидаты', href: '/candidates', icon: Users, category: 'Навигация' },
  { label: 'Интервью', href: '/interviews', icon: Calendar, category: 'Навигация' },
  { label: 'Аналитика', href: '/analytics', icon: BarChart3, category: 'Навигация' },
  { label: 'Настройки', href: '/settings', icon: Settings, category: 'Навигация' },
  { label: 'Поддержка', href: '/support', icon: FileText, category: 'Навигация' },
  { label: 'Создать вакансию', href: '/vacancies', icon: BriefcaseIcon, category: 'Действия' },
  { label: 'Загрузить резюме', href: '/vacancies', icon: FileText, category: 'Действия' },
  { label: 'Купить токены', href: '/settings', icon: Settings, category: 'Действия' },
  { label: 'Изменить профиль', href: '/settings', icon: Settings, category: 'Действия' },
  { label: 'Отчёты и аудит', href: '/reports', icon: FileText, category: 'Навигация' },
  { label: 'База талантов', href: '/talent-pool', icon: Users, category: 'Навигация' },
  { label: 'Тестирование', href: '/assessments', icon: FileText, category: 'Навигация' },
  { label: 'Команда', href: '/team', icon: Users, category: 'Навигация' },
];

export default function GlobalSearch({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
      setQuery('');
    }
  }, [isOpen]);

  const filtered = query.trim()
    ? SEARCH_ITEMS.filter(item =>
        item.label.toLowerCase().includes(query.toLowerCase()) ||
        item.category.toLowerCase().includes(query.toLowerCase())
      )
    : SEARCH_ITEMS.slice(0, 8);

  const handleSelect = (item: SearchItem) => {
    navigate(item.href);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[200] flex items-start justify-center pt-[15vh]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

          {/* Search panel */}
          <motion.div
            className="relative w-full max-w-lg mx-4 bg-[rgba(15,15,15,0.95)] backdrop-blur-2xl border border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden"
            initial={{ y: -20, scale: 0.97, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: -10, scale: 0.98, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {/* Input */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-white/[0.06]">
              <Search size={18} className="text-white/30 shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Поиск по SOLUTION HUB..."
                className="flex-1 bg-transparent text-white text-sm outline-none placeholder:text-white/25"
                onKeyDown={e => {
                  if (e.key === 'Escape') onClose();
                  if (e.key === 'Enter' && filtered.length > 0) handleSelect(filtered[0]);
                }}
              />
              <kbd className="hidden sm:flex items-center gap-0.5 px-1.5 py-0.5 bg-white/[0.06] rounded text-[10px] text-white/30 font-mono">
                ESC
              </kbd>
            </div>

            {/* Results */}
            <div className="max-h-[300px] overflow-y-auto py-2">
              {filtered.length === 0 ? (
                <p className="text-center py-8 text-white/25 text-sm">Ничего не найдено</p>
              ) : (
                filtered.map((item, i) => (
                  <button
                    key={i}
                    onClick={() => handleSelect(item)}
                    className="w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-white/[0.04] transition-colors"
                  >
                    <item.icon size={16} className="text-white/30 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white/80 truncate">{item.label}</p>
                    </div>
                    <span className="text-[10px] text-white/20">{item.category}</span>
                  </button>
                ))
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
