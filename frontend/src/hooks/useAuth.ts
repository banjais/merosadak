
import { useState, useCallback, useEffect } from 'react';
import { authService, User } from '../services/authService';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setUser(authService.getCurrentUser());
    setIsLoading(false);
  }, []);

  const login = useCallback(async (phone: string, name: string) => {
    setIsLoading(true);
    try {
      const newUser = await authService.login(phone, name);
      setUser(newUser);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    authService.logout();
    setUser(null);
  }, []);

  return { user, login, logout, isLoading, isAuthenticated: !!user };
}
