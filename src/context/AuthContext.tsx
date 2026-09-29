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
  /** Clear a surfaced sign-in failure once the user has seen it. */
  clearRedirectError: () => void;
  loginWithGoogle: (rememberMe?: boolean) => Promise<void>;
  logout: () => Promise<void>;
}

const defaultAuthContext: AuthContextType = {
  user: null,
  loading: false,
  redirectError: null,
  clearRedirectError: () => {},
  loginWithGoogle: async () => {},
  logout: async () => {},
};

/** Pull Firebase's `auth/...` code off an unknown rejection. */
function authErrorCode(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error) {
    return String((error as { code?: unknown }).code ?? '');
  }
  return error instanceof Error ? error.message : String(error);
}

/** Turn a Firebase auth code into something a user can act on. */
function friendlyAuthError(code: string): string {
  switch (code) {
    case 'auth/unauthorized-domain':
      return 'This domain is not authorized for Google sign-in. Add it under Firebase Console → Authentication → Settings → Authorized domains.';
    case 'auth/operation-not-allowed':
      return 'Google sign-in is disabled. Enable the Google provider in Firebase Console → Authentication → Sign-in method.';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
    case 'auth/user-cancelled':
      return 'Sign-in was cancelled.';
    case 'auth/network-request-failed':
      return 'Network error while contacting Google. Check your connection and try again.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a moment and try again.';
    case 'auth/account-exists-with-different-credential':
      return 'An account already exists with this email using a different sign-in method.';
    case 'auth/invalid-credential':
    case 'auth/wrong-user-password':
      return 'Google rejected those credentials. Please try again.';
    default:
      return code ? `Google sign-in failed (${code.replace(/^auth\//, '')}).` : 'Google sign-in failed.';
  }
}

const AuthContext = createContext<AuthContextType>(defaultAuthContext);

const REDIRECT_FLAG = 'merosadak_redirecting';

/**
 * sessionStorage can throw on access, not just be undefined — blocked
 * third-party cookies, `dom.security.https_first`, sandboxed frames. A
 * `typeof window` check does not protect against that, and the call site in the
 * `finally` below would turn into an unhandled rejection.
 */
function setRedirectFlag(value: string | null) {
  try {
    if (value === null) sessionStorage.removeItem(REDIRECT_FLAG);
    else sessionStorage.setItem(REDIRECT_FLAG, value);
  } catch {
    /* storage unavailable — the flag is only a breadcrumb, never load-bearing */
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [redirectError, setRedirectError] = useState<string | null>(null);

  useEffect(() => {
    // The second callback is the error handler. Without it an auth-init or
    // IndexedDB failure leaves `loading` true forever, which keeps the sign-in
    // button permanently disabled with no explanation.
    const unsubscribe = onAuthStateChanged(
      auth,
      (currentUser) => {
        setUser(currentUser);
        setLoading(false);
      },
      (error) => {
        console.error('[Mero Sadak] Auth state subscription failed:', error);
        setUser(null);
        setLoading(false);
        setRedirectError(friendlyAuthError(authErrorCode(error)));
      }
    );

    return unsubscribe;
  }, []);

  useEffect(() => {
    let cancelled = false;

    const handleRedirectResult = async () => {
      try {
        await getRedirectResult(auth);
      } catch (error) {
        console.error('[Mero Sadak] Google sign-in redirect failed:', error);
        if (cancelled) return;
        setRedirectError(friendlyAuthError(authErrorCode(error)));
      } finally {
        if (!cancelled) setRedirectFlag(null)
      }
    };

    handleRedirectResult();

    return () => {
      cancelled = true;
    };
  }, []);

  const clearRedirectError = useCallback(() => setRedirectError(null), []);

  const loginWithGoogle = useCallback(async (rememberMe = false) => {
    try {
      await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
      setRedirectFlag('1')
      await signInWithRedirect(auth, googleProvider);
    } catch (error) {
      setRedirectFlag(null)
      console.error('[Mero Sadak] loginWithGoogle failed:', error);
      throw new Error(friendlyAuthError(authErrorCode(error)), { cause: error });
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
    <AuthContext.Provider value={{ user, loading, redirectError, clearRedirectError, loginWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
