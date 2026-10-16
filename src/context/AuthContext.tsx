import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { UserProfile } from '../types';

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  loading: boolean;
  login: (identifier: string, pass: string) => Promise<{ success: boolean; user?: UserProfile; error?: string }>;
  register: (data: any) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  updateProfile: (data: Partial<UserProfile>) => Promise<boolean>;
  uploadLogo: (logoUrl: string) => Promise<boolean>;
  refreshUser: () => Promise<void>;
  isSuperAdmin: boolean;
  isSubscriptionActive: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('fleetbill_token'));
  const [loading, setLoading] = useState<boolean>(true);

  const parseJsonResponse = async (res: Response): Promise<{ ok: boolean; data: any }> => {
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      try {
        const data = await res.json();
        return { ok: res.ok, data };
      } catch {
        return { ok: false, data: { error: 'Invalid response format received from server.' } };
      }
    }
    return {
      ok: false,
      data: {
        error:
          res.status === 404
            ? 'Endpoint not found on host. The application is running in local offline mode.'
            : `Host responded with status ${res.status}.`,
      },
    };
  };

  const fetchCurrentUser = async (authToken: string) => {
    try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const parsed = await parseJsonResponse(res);
      if (parsed.ok && parsed.data.user) {
        setUser(parsed.data.user);
      } else {
        localStorage.removeItem('fleetbill_token');
        setToken(null);
        setUser(null);
      }
    } catch (err) {
      console.error('Failed to restore auth session:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchCurrentUser(token);
    } else {
      setLoading(false);
    }
  }, [token]);

  const login = async (identifier: string, pass: string) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password: pass }),
      });
      const parsed = await parseJsonResponse(res);
      if (!parsed.ok) {
        return { success: false, error: parsed.data?.error || 'Login failed. Please check your credentials.' };
      }
      localStorage.setItem('fleetbill_token', parsed.data.token);
      setToken(parsed.data.token);
      setUser(parsed.data.user);
      return { success: true, user: parsed.data.user };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error occurred' };
    }
  };

  const register = async (regData: any) => {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(regData),
      });
      const parsed = await parseJsonResponse(res);
      if (!parsed.ok) {
        return { success: false, error: parsed.data?.error || 'Registration failed.' };
      }
      localStorage.setItem('fleetbill_token', parsed.data.token);
      setToken(parsed.data.token);
      setUser(parsed.data.user);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error occurred' };
    }
  };

  const logout = () => {
    localStorage.removeItem('fleetbill_token');
    setToken(null);
    setUser(null);
  };

  const updateProfile = async (data: Partial<UserProfile>) => {
    if (!token) return false;
    try {
      const res = await fetch('/api/auth/update-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        const json = await res.json();
        setUser(json.user);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const uploadLogo = async (logoUrl: string) => {
    if (!token) return false;
    try {
      const res = await fetch('/api/auth/upload-logo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ logoUrl }),
      });
      if (res.ok) {
        const json = await res.json();
        setUser(json.user);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const refreshUser = async () => {
    if (token) {
      await fetchCurrentUser(token);
    }
  };

  const isSuperAdmin = user?.role === 'admin';
  const isSubscriptionActive = user?.subscription?.status === 'active';

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        register,
        logout,
        updateProfile,
        uploadLogo,
        refreshUser,
        isSuperAdmin,
        isSubscriptionActive,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
