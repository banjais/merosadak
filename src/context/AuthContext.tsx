import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  signInWithPopup,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  query,
  where,
  collection,
} from 'firebase/firestore';
import { auth, db, googleProvider } from '../firebase';

export type UserRole = 'superadmin' | 'OfficeAdmin' | 'GeneralUser';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  redirectError: string | null;
  /** True only for the designated superadmin (banjais@gmail.com / banjays@gmail.com). */
  isSuperAdmin: boolean;
  /** Resolved role for the signed-in user. */
  userRole: UserRole;
  /** Map of email -> role loaded from Firestore. */
  userRoles: Record<string, UserRole>;
  /** Promote/demote a user's role (persisted to Firestore). */
  setUserRole: (email: string, role: UserRole) => Promise<void>;
  /** Clear a surfaced sign-in failure once the user has seen it. */
  clearRedirectError: () => void;
  loginWithGoogle: (rememberMe?: boolean) => Promise<void>;
  /** Popup-based sign-in (more reliable in PWAs / mobile browsers). */
  loginWithGooglePopup: () => Promise<void>;
  logout: () => Promise<void>;
}

const defaultAuthContext: AuthContextType = {
  user: null,
  loading: false,
  redirectError: null,
  isSuperAdmin: false,
  userRole: 'GeneralUser',
  userRoles: {},
  setUserRole: async () => {},
  clearRedirectError: () => {},
  loginWithGoogle: async () => {},
  loginWithGooglePopup: async () => {},
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

const OFFICE_ADMINS_KEY = 'mero-sadak-office-admins';

/** Resolve the user's role from email. Checks Firestore roles first, then
 * hardcoded superadmin emails, then localStorage OfficeAdmins. Everyone else
 * is GeneralUser. Comparison is case-insensitive to handle any provider
 * casing variation. */
function resolveUserRole(email: string | null, userRoles: Record<string, UserRole>): UserRole {
  if (!email) return 'GeneralUser';
  const normalizedEmail = email.trim().toLowerCase();
  if (normalizedEmail === 'banjais@gmail.com' || normalizedEmail === 'banjays@gmail.com') return 'superadmin';
  const firestoreRole = userRoles[normalizedEmail] ?? userRoles[email];
  if (firestoreRole) return firestoreRole;
  try {
    const raw = localStorage.getItem(OFFICE_ADMINS_KEY);
    if (raw) {
      const list = JSON.parse(raw);
      if (Array.isArray(list) && list.some((e) => String(e).trim().toLowerCase() === normalizedEmail)) return 'OfficeAdmin';
    }
  } catch {
    /* ignore malformed storage */
  }
  return 'GeneralUser';
}

/** Promote/demote a user's role — persisted to Firestore so it applies at
 * sign-in on any device. Falls back to localStorage if Firestore is unavailable. */
export async function setUserRole(email: string, role: UserRole) {
  try {
    await setDoc(doc(db, 'userRoles', email.toLowerCase()), { email, role, updatedAt: new Date().toISOString() });
  } catch {
    /* Firestore unavailable — persist to localStorage so it still works locally */
    try {
      const raw = localStorage.getItem(OFFICE_ADMINS_KEY);
      const list = raw ? JSON.parse(raw) : [];
      const admins = Array.isArray(list) ? list : [];
      if (role === 'OfficeAdmin' || role === 'superadmin') {
        if (!admins.includes(email)) admins.push(email);
      } else {
        const idx = admins.indexOf(email);
        if (idx >= 0) admins.splice(idx, 1);
      }
      localStorage.setItem(OFFICE_ADMINS_KEY, JSON.stringify(admins));
    } catch {
      /* storage unavailable */
    }
  }
}

/** Backward-compatible: promote a user to OfficeAdmin. */
export function setOfficeAdmin(email: string) {
  try {
    const raw = localStorage.getItem(OFFICE_ADMINS_KEY);
    const list = raw ? JSON.parse(raw) : [];
    const admins = Array.isArray(list) ? list : [];
    if (!admins.includes(email)) {
      admins.push(email);
      localStorage.setItem(OFFICE_ADMINS_KEY, JSON.stringify(admins));
    }
  } catch {
    /* storage unavailable — role reverts to GeneralUser on reload */
  }
}

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
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [userRole, setUserRoleState] = useState<UserRole>('GeneralUser');
  const [userRoles, setUserRoles] = useState<Record<string, UserRole>>({});

  // Load all user roles from Firestore so sign-in reflects superadmin/OfficeAdmin
  // assignments made by the superadmin panel.
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'userRoles'), (snap) => {
      const roles: Record<string, UserRole> = {};
      snap.forEach((d) => {
        const data = d.data() as { role?: UserRole };
        if (data.role) roles[d.id] = data.role;
      });
      setUserRoles(roles);
      // Re-resolve the signed-in user's role now that Firestore roles are loaded.
      if (user) {
        const role = resolveUserRole(user.email ?? null, roles);
        setUserRoleState(role);
        setIsSuperAdmin(role === 'superadmin');
      }
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    // The second callback is the error handler. Without it an auth-init or
    // IndexedDB failure leaves `loading` true forever, which keeps the sign-in
    // button permanently disabled with no explanation.
    const unsubscribe = onAuthStateChanged(
      auth,
      (currentUser) => {
        setUser(currentUser);
        setLoading(false);
        const role = resolveUserRole(currentUser?.email ?? null, userRoles);
        setUserRoleState(role);
        setIsSuperAdmin(role === 'superadmin');
      },
      (error) => {
        console.error('[Mero Sadak] Auth state subscription failed:', error);
        setUser(null);
        setLoading(false);
        setRedirectError(friendlyAuthError(authErrorCode(error)));
      }
    );

    return unsubscribe;
  }, [userRoles]);

  const setUserRoleFn = useCallback(async (email: string, role: UserRole) => {
    await setUserRole(email, role);
    // Refresh local state immediately so the panel reflects the change.
    const updated = resolveUserRole(email, { ...userRoles, [email]: role });
    if (email === user?.email) {
      setUserRoleState(updated);
      setIsSuperAdmin(updated === 'superadmin');
    }
  }, [user?.email, userRoles]);

  useEffect(() => {
    let cancelled = false;

    const handleRedirectResult = async () => {
      // Only process a redirect result if we actually redirected to Google.
      // Calling getRedirectResult unconditionally on every mount can spuriously
      // reset auth state on plain page loads.
      try {
        const flag = sessionStorage.getItem(REDIRECT_FLAG);
        if (!flag) return;
      } catch {
        return;
      }

      try {
        await getRedirectResult(auth);
      } catch (error) {
        console.error('[Mero Sadak] Google sign-in redirect failed:', error);
        if (cancelled) return;
        setRedirectError(friendlyAuthError(authErrorCode(error)));
      } finally {
        if (!cancelled) setRedirectFlag(null);
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
      setRedirectFlag('1');
      await signInWithRedirect(auth, googleProvider);
    } catch (error) {
      setRedirectFlag(null);
      console.error('[Mero Sadak] loginWithGoogle failed:', error);
      throw new Error(friendlyAuthError(authErrorCode(error)), { cause: error });
    }
  }, []);

  const loginWithGooglePopup = useCallback(async () => {
    try {
      await setPersistence(auth, browserLocalPersistence);
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error('[Mero Sadak] Google sign-in popup failed:', error);
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
    <AuthContext.Provider value={{ user, loading, redirectError, isSuperAdmin, userRole, userRoles, setUserRole: setUserRoleFn, clearRedirectError, loginWithGoogle, loginWithGooglePopup, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
