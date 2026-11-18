import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { apiClient, registerUnauthorizedHandler, TOKEN_STORAGE_KEY } from '../api/client';
import type { User } from '../types';

interface AccountCounts {
  totalTasks: number;
  completedTasks: number;
  uploads: number;
}

interface AuthContextValue {
  user: User | null;
  counts: AccountCounts;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: { name: string; email: string; password: string; role?: string }) => Promise<void>;
  logout: () => void;
  refreshProfile: () => Promise<void>;
  updateProfile: (payload: { name?: string; role?: string; avatarUrl?: string | null }) => Promise<User>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_STORAGE_KEY));
  const [user, setUser] = useState<User | null>(null);
  const [counts, setCounts] = useState<AccountCounts>({ totalTasks: 0, completedTasks: 0, uploads: 0 });
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(localStorage.getItem(TOKEN_STORAGE_KEY)));

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setToken(null);
    setUser(null);
    setCounts({ totalTasks: 0, completedTasks: 0, uploads: 0 });
    setIsLoading(false);
  }, []);

  useEffect(() => {
    registerUnauthorizedHandler(logout);
  }, [logout]);

  const refreshProfile = useCallback(async () => {
    const activeToken = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!activeToken) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    try {
      const { data } = await apiClient.get<{ user: User; counts: AccountCounts }>('/auth/me');
      setUser(data.user);
      setCounts(data.counts);
    } catch {
      logout();
    } finally {
      setIsLoading(false);
    }
  }, [logout]);

  useEffect(() => {
    if (token) {
      refreshProfile();
    } else {
      setIsLoading(false);
    }
  }, [token, refreshProfile]);

  const login = useCallback(async (email: string, password: string) => {
    const { data } = await apiClient.post<{ token: string; user: User }>('/auth/login', {
      email,
      password,
    });
    localStorage.setItem(TOKEN_STORAGE_KEY, data.token);
    setToken(data.token);
    setUser(data.user);
  }, []);

  const register = useCallback(
    async (payload: { name: string; email: string; password: string; role?: string }) => {
      const { data } = await apiClient.post<{ token: string; user: User }>('/auth/register', payload);
      localStorage.setItem(TOKEN_STORAGE_KEY, data.token);
      setToken(data.token);
      setUser(data.user);
    },
    []
  );

  const updateProfile = useCallback(
    async (payload: { name?: string; role?: string; avatarUrl?: string | null }) => {
      const { data } = await apiClient.patch<{ user: User }>('/auth/profile', payload);
      setUser(data.user);
      return data.user;
    },
    []
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        counts,
        token,
        isAuthenticated: Boolean(user && token),
        isLoading,
        login,
        register,
        logout,
        refreshProfile,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
