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
  deleteDoc,
  onSnapshot,
  query,
  where,
  collection,
} from 'firebase/firestore';
import { auth, db, googleProvider } from '../firebase';

export type UserRole = 'superadmin' | 'OfficeAdmin' | 'GeneralUser';

/** The identity the app renders. A real Firebase `User` satisfies this shape
 * structurally; mock demo sessions create a lightweight object with the same
 * fields so every panel can treat both identically. */
export interface AppUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  /** True when the session is a local demo/mock sign-in (no Firebase auth). */
  isDemo?: boolean;
}

export interface DemoAccount {
  email: string;
  password: string;
  role: UserRole;
  name: string;
}

/**
 * Mock (demo) accounts for trying Mero Sadak's role surfaces without a Google
 * account. Firebase Email/Password sign-in is NOT enabled on this project
 * (Google-only), so these credentials are validated locally on the device.
 *
 * A demo session is a client-side convenience only: it holds no Firebase auth,
 * so Firestore writes (roles, reports) still follow the security rules for an
 * unauthenticated visitor. If the SuperAdmin assigns one of these emails a
 * role in User Control, that Firestore record wins wherever Firestore is
 * readable; otherwise the built-in role below applies on every device.
 */
export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    email: 'office.admin@merosadak.com.np',
    password: 'sadak-office-2026',
    role: 'OfficeAdmin',
    name: 'Office Admin (Demo)',
  },
  {
    email: 'general.user@merosadak.com.np',
    password: 'sadak-user-2026',
    role: 'GeneralUser',
    name: 'General User (Demo)',
  },
];

/** Guaranteed fallback roles for the mock accounts (used when Firestore roles
 * cannot be read, e.g. unauthenticated demo sessions). */
const DEMO_ROLE_MAP: Record<string, UserRole> = Object.fromEntries(
  DEMO_ACCOUNTS.map((a) => [a.email.toLowerCase(), a.role]),
);

const DEMO_SESSION_KEY = 'mero-sadak-demo-session';

/** Restore a demo session from localStorage. Returns null when absent,
 * malformed, or storage is unavailable (private mode, sandboxed frames). */
function loadDemoSession(): AppUser | null {
  try {
    const raw = localStorage.getItem(DEMO_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AppUser | null;
    if (parsed && parsed.isDemo && parsed.email) return parsed;
    return null;
  } catch {
    return null;
  }
}

function saveDemoSession(sessionUser: AppUser | null) {
  try {
    if (sessionUser) localStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(sessionUser));
    else localStorage.removeItem(DEMO_SESSION_KEY);
  } catch {
    /* storage unavailable — demo session just won't persist */
  }
}

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  redirectError: string | null;
  /** True only for the designated superadmin (banjais@gmail.com / banjays@gmail.com). */
  isSuperAdmin: boolean;
  /** Resolved role for the signed-in user. */
  userRole: UserRole;
  /** Map of email -> role loaded from Firestore. */
  userRoles: Record<string, UserRole>;
  /** True when the current session is a local mock/demo sign-in. */
  isDemoSession: boolean;
  /** Promote/demote a user's role (persisted to Firestore). */
  setUserRole: (email: string, role: UserRole) => Promise<void>;
  /** Remove a user's stored role entirely — they fall back to GeneralUser. */
  deleteUserRole: (email: string) => Promise<void>;
  /** Clear a surfaced sign-in failure once the user has seen it. */
  clearRedirectError: () => void;
  loginWithGoogle: (rememberMe?: boolean) => Promise<void>;
  /** Popup-based sign-in (more reliable in PWAs / mobile browsers). */
  loginWithGooglePopup: () => Promise<void>;
  /** Mock/demo sign-in with fixed credentials (no Firebase auth involved). */
  loginWithDemo: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const defaultAuthContext: AuthContextType = {
  user: null,
  loading: false,
  redirectError: null,
  isSuperAdmin: false,
  userRole: 'GeneralUser',
  userRoles: {},
  isDemoSession: false,
  loginWithDemo: async () => {},
  setUserRole: async () => {},
  deleteUserRole: async () => {},
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

// Exported so test harnesses can supply a mocked auth value without Firebase.
export const AuthContext = createContext<AuthContextType>(defaultAuthContext);

const REDIRECT_FLAG = 'merosadak_redirecting';

const OFFICE_ADMINS_KEY = 'mero-sadak-office-admins';

/** Built-in superadmin accounts. These are hardcoded on purpose: the owner
 * accounts must always resolve to SuperAdmin on every device, even before any
 * Firestore record exists, and can never be demoted or deleted from the
 * User Control panel. */
export const SUPERADMIN_EMAILS = ['banjais@gmail.com', 'banjays@gmail.com'];

export function isBuiltInSuperadmin(email: string): boolean {
  return SUPERADMIN_EMAILS.includes(email.trim().toLowerCase());
}

/** Resolve the user's role from email. Checks built-in superadmin list first,
 * then Firestore roles, then the demo-account map, then localStorage
 * OfficeAdmins. Everyone else is GeneralUser. Comparison is case-insensitive
 * to handle any provider casing variation. */
function resolveUserRole(email: string | null, userRoles: Record<string, UserRole>): UserRole {
  if (!email) return 'GeneralUser';
  const normalizedEmail = email.trim().toLowerCase();
  if (isBuiltInSuperadmin(normalizedEmail)) return 'superadmin';
  const firestoreRole = userRoles[normalizedEmail] ?? userRoles[email];
  if (firestoreRole) return firestoreRole;
  const demoRole = DEMO_ROLE_MAP[normalizedEmail];
  if (demoRole) return demoRole;
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

/** Remove a user's stored role — used by the SuperAdmin User Control panel.
 * The user falls back to GeneralUser at their next sign-in. Built-in
 * superadmin emails are protected and refuse deletion. Falls back to
 * localStorage when Firestore is unavailable. */
export async function deleteUserRole(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  if (isBuiltInSuperadmin(normalizedEmail)) {
    throw new Error('Built-in superadmin accounts cannot be deleted.');
  }
  try {
    await deleteDoc(doc(db, 'userRoles', normalizedEmail));
  } catch {
    /* Firestore unavailable — remove from localStorage so it still works locally */
    try {
      const raw = localStorage.getItem(OFFICE_ADMINS_KEY);
      const list = raw ? JSON.parse(raw) : [];
      const admins = Array.isArray(list) ? list : [];
      const idx = admins.findIndex((e: string) => String(e).trim().toLowerCase() === normalizedEmail);
      if (idx >= 0) {
        admins.splice(idx, 1);
        localStorage.setItem(OFFICE_ADMINS_KEY, JSON.stringify(admins));
      }
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
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [demoUser, setDemoUser] = useState<AppUser | null>(loadDemoSession);
  const [loading, setLoading] = useState(true);
  const [redirectError, setRedirectError] = useState<string | null>(null);
  const [userRoles, setUserRoles] = useState<Record<string, UserRole>>({});

  // The identity every panel renders: a real Firebase account wins over a
  // local demo session (signing in with Google discards the demo session).
  const user: AppUser | null = firebaseUser ?? demoUser;
  const isDemoSession = !firebaseUser && !!demoUser;
  // Derive permissions synchronously from the current identity and role map.
  // Built-in owner accounts therefore render as Super Admin on the first
  // authenticated render, without a transient General User state.
  const userRole = resolveUserRole(user?.email ?? null, userRoles);
  const isSuperAdmin = userRole === 'superadmin';

  // Discard any demo session the moment a real Firebase account signs in.
  useEffect(() => {
    if (firebaseUser && demoUser) {
      setDemoUser(null);
      saveDemoSession(null);
    }
  }, [firebaseUser, demoUser]);

  // Load role assignments from Firestore for cross-device role synchronization.
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'userRoles'),
      (snap) => {
        const roles: Record<string, UserRole> = {};
        snap.forEach((d) => {
          const data = d.data() as { role?: UserRole };
          if (data.role) roles[d.id] = data.role;
        });
        setUserRoles(roles);
        // The current user's role is derived directly from this updated map.
      },
      // Security rules commonly deny reads on `userRoles` for anonymous
      // visitors. Treat a denied snapshot the same as "no roles" instead of
      // letting Firebase flood the console with permission errors.
      (error) => {
        if (typeof console !== 'undefined') {
          console.debug('[Mero Sadak] userRoles unavailable (falling back to email heuristics):', error.code);
        }
        setUserRoles({});
      }
    );
    return () => unsub();
  }, [firebaseUser]);

  useEffect(() => {
    // The second callback is the error handler. Without it an auth-init or
    // IndexedDB failure leaves `loading` true forever, which keeps the sign-in
    // button permanently disabled with no explanation.
    const unsubscribe = onAuthStateChanged(
      auth,
      (currentUser) => {
        setFirebaseUser(currentUser);
        setLoading(false);
        // The role is derived from the updated Firebase identity on render.
      },
      (error) => {
        console.error('[Mero Sadak] Auth state subscription failed:', error);
        setFirebaseUser(null);
        setLoading(false);
        setRedirectError(friendlyAuthError(authErrorCode(error)));
      }
    );

    return unsubscribe;
  }, []);

  const setUserRoleFn = useCallback(async (email: string, role: UserRole) => {
    await setUserRole(email, role);
    const normalizedEmail = email.trim().toLowerCase();
    setUserRoles((current) => ({ ...current, [normalizedEmail]: role }));
  }, []);

  const deleteUserRoleFn = useCallback(async (email: string) => {
    await deleteUserRole(email);
    const normalizedEmail = email.trim().toLowerCase();
    setUserRoles((current) => {
      const next = { ...current };
      delete next[normalizedEmail];
      return next;
    });
  }, []);

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

  /** Mock/demo sign-in: validates against the fixed DEMO_ACCOUNTS list and
   * stores a local session (localStorage) that survives page reloads. No
   * Firebase auth is involved, so nothing is written to Firestore. */
  const loginWithDemo = useCallback(async (email: string, password: string) => {
    const normalized = email.trim().toLowerCase();
    const account = DEMO_ACCOUNTS.find((a) => a.email.toLowerCase() === normalized);
    if (!account) {
      throw new Error('No demo account with that email. Use one of the demo accounts listed on the sign-in screen.');
    }
    if (account.password !== password) {
      throw new Error('Incorrect demo password. Check the credentials shown on the sign-in screen.');
    }
    const session: AppUser = {
      uid: `demo:${account.role}`,
      email: account.email,
      displayName: account.name,
      photoURL: null,
      isDemo: true,
    };
    saveDemoSession(session);
    setDemoUser(session);
  }, []);

  const logout = useCallback(async () => {
    // Clear a demo session first, then a real Firebase session if present.
    setDemoUser(null);
    saveDemoSession(null);
    try {
      await signOut(auth);
    } catch (error) {
      console.error('[Mero Sadak] Logout failed:', error);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, redirectError, isSuperAdmin, userRole, userRoles, isDemoSession, setUserRole: setUserRoleFn, deleteUserRole: deleteUserRoleFn, clearRedirectError, loginWithGoogle, loginWithGooglePopup, loginWithDemo, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
