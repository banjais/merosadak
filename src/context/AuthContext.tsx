import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
} from 'firebase/auth';
import { auth, googleProvider } from '../firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  redirectError: string | null;
  loginWithGoogle: (rememberMe?: boolean) => Promise<void>;
  logout: () => Promise<void>;
}

const defaultAuthContext: AuthContextType = {
  user: null,
  loading: false,
  redirectError: null,
  loginWithGoogle: async () => {},
  logout: async () => {},
};

const AuthContext = createContext<AuthContextType>(defaultAuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [redirectError, setRedirectError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    let cancelled = false;

    const handleRedirectResult = async () => {
      try {
        await getRedirectResult(auth);
      } catch (error) {
        const code = error instanceof Error ? error.message : String(error);
        const friendly = code.includes('unauthorized-domain')
          ? 'This domain is not authorized for Google sign-in. Add it in Firebase Authentication settings.'
          : 'Sign-in did not complete after returning from Google. Please try again.';
        setRedirectError(friendly);
      } finally {
        if (!cancelled && typeof window !== 'undefined') {
          sessionStorage.removeItem('merosadak_redirecting');
        }
      }
    };

    handleRedirectResult();

    return () => {
      cancelled = true;
    };
  }, []);

  const loginWithGoogle = useCallback(async (rememberMe = false) => {
    try {
      await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('merosadak_redirecting', '1');
      }
      await signInWithRedirect(auth, googleProvider);
    } catch (error) {
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('merosadak_redirecting');
      }
      const message = error instanceof Error ? error.message : String(error);
      const friendly = message.includes('redirect')
        ? 'Sign-in redirect failed.'
        : 'Google sign-in failed.';
      throw new Error(friendly, { cause: error });
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('[Mero Sadak] Logout failed:', error);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, redirectError, loginWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
