import { useState, useEffect } from 'react';
import { ChevronUp } from 'lucide-react';

export default function ScrollToTop() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const handler = () => setShow(window.scrollY > 400);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  if (!show) return null;

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      className="fixed bottom-24 md:bottom-8 right-6 z-40 w-10 h-10 bg-white/[0.04] border border-white/[0.06] rounded-full flex items-center justify-center text-white/60 hover:text-orange-400 hover:border-orange-500/30 transition-all shadow-lg"
      aria-label="Наверх"
    >
      <ChevronUp size={18} />
    </button>
  );
}
