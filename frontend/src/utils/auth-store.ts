import { create } from 'zustand';
import { User, Organization } from '../types';

interface AuthState {
  token: string | null;
  user: User | null;
  organization: Organization | null;
  setAuth: (token: string, user: User, organization?: Organization | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: localStorage.getItem('token'),
  user: (() => {
    try {
      const u = localStorage.getItem('user');
      return u ? JSON.parse(u) : null;
    } catch (e) {
      console.error('Ошибка чтения данных из localStorage:', e);
      return null;
    }
  })(),
  organization: (() => {
    try {
      const o = localStorage.getItem('organization');
      return o ? JSON.parse(o) : null;
    } catch (e) {
      console.error('Ошибка чтения данных из localStorage:', e);
      return null;
    }
  })(),
  setAuth: (token, user, organization = null) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    if (organization) {
      localStorage.setItem('organization', JSON.stringify(organization));
    } else {
      localStorage.removeItem('organization');
    }
    set({ token, user, organization: organization ?? null });
  },
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('organization');
    set({ token: null, user: null, organization: null });
  },
}));
