import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  browserLocalPersistence,
  browserSessionPersistence,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updatePassword,
  updateProfile,
  type User as FirebaseUser,
} from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase';
import { apiFetch } from '../lib/api';
import type { DbUser } from '../types/edna';

export interface RegisterFormPayload {
  fullName: string;
  username: string;
  email: string;
  password: string;
  institution: string;
  department: string;
  researchField: string;
  country: string;
  userCategory: string;
}

interface AuthContextValue {
  firebaseUser: FirebaseUser | null;
  dbUser: DbUser | null;
  loading: boolean;
  authError: string | null;
  adminToken: string | null;
  setAdminToken: (token: string | null) => void;
  loginWithEmail: (email: string, password: string, rememberMe: boolean) => Promise<void>;
  registerWithEmail: (payload: RegisterFormPayload) => Promise<void>;
  loginWithGoogle: (extraProfile?: Partial<RegisterFormPayload>) => Promise<void>;
  sendResetPassword: (email: string) => Promise<void>;
  resendVerification: () => Promise<void>;
  changePassword: (newPassword: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
  logout: () => Promise<void>;
  clearAuthError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [dbUser, setDbUser] = useState<DbUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [adminToken, setAdminToken] = useState<string | null>(null);

  const syncUserProfile = useCallback(
    async (
      fbUser: FirebaseUser,
      extra?: Partial<RegisterFormPayload> & { mode?: 'login' | 'register' }
    ) => {
      const token = await fbUser.getIdToken();
      const res = await fetch('/api/auth/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(extra || {}),
      });
      const json = (await res.json()) as { user?: DbUser; error?: string };
      if (!res.ok || !json.user) {
        throw new Error(json.error || 'Failed to synchronize researcher profile.');
      }
      setDbUser(json.user);
      return json.user;
    },
    []
  );

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (!user) {
        setDbUser(null);
        setAdminToken(null);
        setLoading(false);
        return;
      }
      try {
        await syncUserProfile(user);
        setAuthError(null);
      } catch (err: any) {
        console.error('Auth state sync error:', err);
        setAuthError(err.message || 'Unable to verify researcher session.');
        setDbUser(null);
      } finally {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, [syncUserProfile]);

  const loginWithEmail = async (email: string, password: string, rememberMe: boolean) => {
    setAuthError(null);
    await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
    const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
    await syncUserProfile(cred.user, { mode: 'login' });
  };

  const registerWithEmail = async (payload: RegisterFormPayload) => {
    setAuthError(null);
    const cred = await createUserWithEmailAndPassword(auth, payload.email.trim(), payload.password);
    await updateProfile(cred.user, { displayName: payload.fullName.trim() });
    try {
      await sendEmailVerification(cred.user);
    } catch {
      // Non-blocking if email verification delivery isn't configured in sandbox
    }
    await syncUserProfile(cred.user, { ...payload, mode: 'register' });
  };

  const loginWithGoogle = async (extraProfile?: Partial<RegisterFormPayload>) => {
    setAuthError(null);
    const cred = await signInWithPopup(auth, googleAuthProvider);
    await syncUserProfile(cred.user, extraProfile);
  };

  const sendResetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email.trim());
  };

  const resendVerification = async () => {
    if (!auth.currentUser) throw new Error('Not signed in.');
    await sendEmailVerification(auth.currentUser);
  };

  const changePassword = async (newPassword: string) => {
    if (!auth.currentUser) throw new Error('Not signed in.');
    await updatePassword(auth.currentUser, newPassword);
  };

  const refreshProfile = async () => {
    if (!auth.currentUser) return;
    await auth.currentUser.reload();
    const data = await apiFetch<{ user: DbUser }>('/api/profile');
    setDbUser(data.user);
  };

  const logout = async () => {
    setAdminToken(null);
    setDbUser(null);
    await signOut(auth);
  };

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        dbUser,
        loading,
        authError,
        adminToken,
        setAdminToken,
        loginWithEmail,
        registerWithEmail,
        loginWithGoogle,
        sendResetPassword,
        resendVerification,
        changePassword,
        refreshProfile,
        logout,
        clearAuthError: () => setAuthError(null),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
