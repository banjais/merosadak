
import { apiFetch } from './apiService';

export interface User {
  id: string;
  phone: string;
  name: string;
  role: 'user' | 'admin' | 'superadmin';
}

const USER_KEY = 'nepal_traveler_session';

export const authService = {
  getCurrentUser: (): User | null => {
    const saved = localStorage.getItem(USER_KEY);
    return saved ? JSON.parse(saved) : null;
  },
  
  login: async (phone: string, name: string): Promise<User> => {
    try {
      const user = await apiFetch<User>("/auth", {
        method: 'POST',
        body: JSON.stringify({ phone, name }),
        headers: { 'Content-Type': 'application/json' }
      });
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      return user;
    } catch (error) {
      console.warn("[AuthService] API failed, using mock login logic");
      // Fallback for demo
      await new Promise(r => setTimeout(r, 800));
      let role: User['role'] = 'user';
      if (phone === '9800000000') role = 'superadmin';
      if (phone === '9811111111') role = 'admin';

      const user: User = { id: Math.random().toString(36).substr(2, 9), phone, name, role };
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      return user;
    }
  },

  logout: () => {
    localStorage.removeItem(USER_KEY);
  }
};
