import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export function useKeyboardShortcuts() {
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't trigger in inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;

      const isMod = e.metaKey || e.ctrlKey;

      if (isMod && e.key === 'k') {
        e.preventDefault();
        // Focus search on vacancies page
        const searchInput = document.getElementById('vacancies-search') as HTMLInputElement;
        if (searchInput) searchInput.focus();
        else navigate('/vacancies');
      }

      if (isMod && e.key === 'n') {
        e.preventDefault();
        // Navigate to create vacancy (handled by page)
        document.dispatchEvent(new CustomEvent('shortcut:new-vacancy'));
      }

      // Navigation shortcuts (Alt + number)
      if (e.altKey && !isMod) {
        switch (e.key) {
          case '1': e.preventDefault(); navigate('/vacancies'); break;
          case '2': e.preventDefault(); navigate('/candidates'); break;
          case '3': e.preventDefault(); navigate('/interviews'); break;
          case '4': e.preventDefault(); navigate('/analytics'); break;
          case '5': e.preventDefault(); navigate('/settings'); break;
        }
      }

      // Escape to close modals
      if (e.key === 'Escape') {
        document.dispatchEvent(new CustomEvent('shortcut:escape'));
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigate]);
}
