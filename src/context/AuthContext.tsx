import React, { createContext, useContext, useState, useEffect } from 'react';
import { AuthUser, UserRole } from '../types';

interface AuthContextType {
  user: AuthUser | null;
  role: UserRole | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isUser: boolean;
  login: (email: string, password: string) => { success: boolean; error?: string };
  loginAsRole: (role: UserRole) => void;
  switchRole: () => void;
  logout: () => void;
}

const STORAGE_KEY = 'sala_prove_auth_user';

export const PRESET_ACCOUNTS: Record<UserRole, { email: string; password: string; user: AuthUser }> = {
  admin: {
    email: 'admin@app.com',
    password: 'admin',
    user: {
      id: 'usr-admin-1',
      email: 'admin@app.com',
      nome: 'Amministratore Studio',
      ruolo: 'admin',
      avatar: '👑',
    },
  },
  user: {
    email: 'utente@app.com',
    password: 'user',
    user: {
      id: 'usr-user-1',
      email: 'utente@app.com',
      nome: 'Operatore / Utente',
      ruolo: 'user',
      avatar: '👤',
    },
  },
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored) as AuthUser;
      }
    } catch (e) {
      console.error('Error reading auth from localStorage:', e);
    }
    // Default to admin initially or null? Default to null so user sees the login screen!
    return null;
  });

  const saveUser = (u: AuthUser | null) => {
    setUser(u);
    try {
      if (u) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch (e) {
      console.error('Error saving auth to localStorage:', e);
    }
  };

  const login = (email: string, pass: string): { success: boolean; error?: string } => {
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPass = pass.trim();

    // Check admin
    if (
      (trimmedEmail === PRESET_ACCOUNTS.admin.email || trimmedEmail === 'admin') &&
      (trimmedPass === PRESET_ACCOUNTS.admin.password || trimmedPass === 'admin123')
    ) {
      saveUser(PRESET_ACCOUNTS.admin.user);
      return { success: true };
    }

    // Check user
    if (
      (trimmedEmail === PRESET_ACCOUNTS.user.email || trimmedEmail === 'utente' || trimmedEmail === 'user') &&
      (trimmedPass === PRESET_ACCOUNTS.user.password || trimmedPass === 'user123' || trimmedPass === 'utente123')
    ) {
      saveUser(PRESET_ACCOUNTS.user.user);
      return { success: true };
    }

    return {
      success: false,
      error: 'Credenziali non valide. Usa admin@app.com / admin oppure utente@app.com / user',
    };
  };

  const loginAsRole = (role: UserRole) => {
    const preset = PRESET_ACCOUNTS[role];
    if (preset) {
      saveUser(preset.user);
    }
  };

  const switchRole = () => {
    if (!user) return;
    const nextRole: UserRole = user.ruolo === 'admin' ? 'user' : 'admin';
    loginAsRole(nextRole);
  };

  const logout = () => {
    saveUser(null);
  };

  const role = user?.ruolo || null;
  const isAuthenticated = !!user;
  const isAdmin = role === 'admin';
  const isUser = role === 'user';

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        isAuthenticated,
        isAdmin,
        isUser,
        login,
        loginAsRole,
        switchRole,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
};
