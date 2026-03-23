import { useEffect } from 'react';
import toast from 'react-hot-toast';

export function useSessionTimeout() {
  useEffect(() => {
    let warningShown = false;

    const checkToken = () => {
      const token = localStorage.getItem('token');
      if (!token) return;

      try {
        // Decode JWT payload (base64)
        const payload = JSON.parse(atob(token.split('.')[1]));
        const expiresAt = payload.exp * 1000;
        const now = Date.now();
        const remaining = expiresAt - now;

        // Warn 1 hour before expiry
        if (remaining < 60 * 60 * 1000 && remaining > 0 && !warningShown) {
          warningShown = true;
          toast('Ваша сессия скоро истечёт. Перелогиньтесь для продления.', {
            icon: '⏰',
            duration: 10000,
          });
        }

        // Auto-logout if expired
        if (remaining <= 0) {
          localStorage.clear();
          window.location.href = '/login';
        }
      } catch {
        // Invalid token format
      }
    };

    checkToken();
    const interval = setInterval(checkToken, 5 * 60 * 1000); // Check every 5 min
    return () => clearInterval(interval);
  }, []);
}
