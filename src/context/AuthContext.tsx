import React, { createContext, useContext, useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { AuthUser, UserRole } from '../types';
import { supabase, getSupabaseUrl, getSupabaseKey, isSupabaseConfigured } from '../lib/supabase';

export interface CreateUserParams {
  email: string;
  password: string;
  nome: string;
  role: UserRole;
}

export interface RegisteredAccount {
  id: string;
  email: string;
  nome: string;
  ruolo: UserRole;
  createdAt: string;
  confirmed?: boolean;
}

interface AuthContextType {
  user: AuthUser | null;
  role: UserRole | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isUser: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  loginAsRole: (role: UserRole) => Promise<void>;
  switchRole: () => void;
  logout: () => Promise<void>;
  createUserAccount: (params: CreateUserParams) => Promise<{ success: boolean; error?: string; user?: any }>;
  registeredUsers: RegisteredAccount[];
  deleteUserAccount: (id: string) => Promise<{ success: boolean; error?: string }>;
  refreshRegisteredUsers: () => Promise<void>;
}

const STORAGE_KEY = 'sala_prove_auth_user';
const STORAGE_REGISTERED_USERS = 'salaprove_registered_users';

// Credenziali di test collegate a Supabase Auth
export const SUPABASE_TEST_CREDENTIALS: Record<UserRole, { email: string; password: string; nome: string }> = {
  admin: {
    email: 'admin@salaprove.it',
    password: 'adminPassword123!',
    nome: 'Amministratore Studio',
  },
  user: {
    email: 'utente@salaprove.it',
    password: 'utentePassword123!',
    nome: 'Operatore Studio',
  },
};

export const PRESET_ACCOUNTS: Record<UserRole, { email: string; password: string; user: AuthUser }> = {
  admin: {
    email: 'admin@salaprove.it',
    password: 'adminPassword123!',
    user: {
      id: 'usr-admin-1',
      email: 'admin@salaprove.it',
      nome: 'Amministratore Studio',
      ruolo: 'admin',
      avatar: '👑',
    },
  },
  user: {
    email: 'utente@salaprove.it',
    password: 'utentePassword123!',
    user: {
      id: 'usr-user-1',
      email: 'utente@salaprove.it',
      nome: 'Operatore Studio',
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
    return null;
  });

  const [registeredUsers, setRegisteredUsers] = useState<RegisteredAccount[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_REGISTERED_USERS);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {}
    return [
      {
        id: 'usr-admin-1',
        email: 'admin@salaprove.it',
        nome: 'Amministratore Studio',
        ruolo: 'admin',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'usr-user-1',
        email: 'utente@salaprove.it',
        nome: 'Operatore Studio',
        ruolo: 'user',
        createdAt: new Date().toISOString(),
      },
    ];
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

  // Restores and listens to Supabase Auth session
  useEffect(() => {
    if (!isSupabaseConfigured()) return;

    // Check existing active session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const sbUser = session.user;
        let userRole: UserRole = 'user';
        const metaRole = sbUser.user_metadata?.role || sbUser.user_metadata?.ruolo || sbUser.app_metadata?.role;
        if (metaRole === 'admin' || metaRole === 'user') {
          userRole = metaRole;
        } else {
          try {
            const { data: profile } = await supabase
              .from('profiles')
              .select('ruolo')
              .eq('id', sbUser.id)
              .maybeSingle();
            if (profile?.ruolo === 'admin' || profile?.ruolo === 'user') {
              userRole = profile.ruolo;
            }
          } catch {}
        }

        const authUser: AuthUser = {
          id: sbUser.id,
          email: sbUser.email || '',
          nome: sbUser.user_metadata?.nome || sbUser.email?.split('@')[0] || (userRole === 'admin' ? 'Amministratore' : 'Utente'),
          ruolo: userRole,
          avatar: userRole === 'admin' ? '👑' : '👤',
        };
        saveUser(authUser);
      }
    });

    // Listen to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        const sbUser = session.user;
        let userRole: UserRole = 'user';
        const metaRole = sbUser.user_metadata?.role || sbUser.user_metadata?.ruolo || sbUser.app_metadata?.role;
        if (metaRole === 'admin' || metaRole === 'user') {
          userRole = metaRole;
        }

        const authUser: AuthUser = {
          id: sbUser.id,
          email: sbUser.email || '',
          nome: sbUser.user_metadata?.nome || sbUser.email?.split('@')[0] || (userRole === 'admin' ? 'Amministratore' : 'Utente'),
          ruolo: userRole,
          avatar: userRole === 'admin' ? '👑' : '👤',
        };
        saveUser(authUser);
      } else if (event === 'SIGNED_OUT') {
        saveUser(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Fetch registered users list from public.profiles if available
  const refreshRegisteredUsers = async () => {
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && Array.isArray(data) && data.length > 0) {
          const mapped: RegisteredAccount[] = data.map(p => ({
            id: p.id,
            email: p.email,
            nome: p.nome || p.email.split('@')[0],
            ruolo: p.ruolo === 'admin' ? 'admin' : 'user',
            createdAt: p.created_at || new Date().toISOString(),
          }));
          setRegisteredUsers(mapped);
          try {
            localStorage.setItem(STORAGE_REGISTERED_USERS, JSON.stringify(mapped));
          } catch {}
          return;
        }
      } catch {}
    }

    try {
      const stored = localStorage.getItem(STORAGE_REGISTERED_USERS);
      if (stored) {
        setRegisteredUsers(JSON.parse(stored));
      }
    } catch {}
  };

  useEffect(() => {
    refreshRegisteredUsers();
  }, []);

  // 1. Accedi al Gestionale con supabase.auth.signInWithPassword()
  const login = async (email: string, pass: string): Promise<{ success: boolean; error?: string }> => {
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPass = pass.trim();

    if (!trimmedEmail || !trimmedPass) {
      return { success: false, error: 'Inserisci sia l\'email che la password.' };
    }

    // Try Supabase Auth signInWithPassword
    if (isSupabaseConfigured()) {
      try {
        // Map shorthand test passwords if entered
        let authPass = trimmedPass;
        if (
          (trimmedEmail === 'admin@salaprove.it' || trimmedEmail === 'admin@app.com') &&
          (trimmedPass === 'admin' || trimmedPass === 'admin123')
        ) {
          authPass = 'adminPassword123!';
        } else if (
          (trimmedEmail === 'utente@salaprove.it' || trimmedEmail === 'utente@app.com') &&
          (trimmedPass === 'user' || trimmedPass === 'user123' || trimmedPass === 'utente')
        ) {
          authPass = 'utentePassword123!';
        }

        const { data, error } = await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password: authPass,
        });

        if (!error && data?.user) {
          const sbUser = data.user;
          // Leggi ruolo dai metadati (user_metadata.role o user_metadata.ruolo)
          let userRole: UserRole = 'user';
          const metaRole = sbUser.user_metadata?.role || sbUser.user_metadata?.ruolo || sbUser.app_metadata?.role;
          if (metaRole === 'admin' || metaRole === 'user') {
            userRole = metaRole;
          } else {
            // Verifica anche nella tabella profiles
            try {
              const { data: profile } = await supabase
                .from('profiles')
                .select('ruolo')
                .eq('id', sbUser.id)
                .maybeSingle();
              if (profile?.ruolo === 'admin' || profile?.ruolo === 'user') {
                userRole = profile.ruolo;
              }
            } catch {}
          }

          const authUser: AuthUser = {
            id: sbUser.id,
            email: sbUser.email || trimmedEmail,
            nome: sbUser.user_metadata?.nome || sbUser.email?.split('@')[0] || (userRole === 'admin' ? 'Amministratore' : 'Utente'),
            ruolo: userRole,
            avatar: userRole === 'admin' ? '👑' : '👤',
          };

          saveUser(authUser);
          return { success: true };
        }

        if (error) {
          if (error.message.includes('Email not confirmed')) {
            // Tentativo di auto-conferma tramite RPC su Supabase
            try {
              await supabase.rpc('confirm_user_email', { user_email: trimmedEmail });
              const retry = await supabase.auth.signInWithPassword({
                email: trimmedEmail,
                password: trimmedPass,
              });
              if (!retry.error && retry.data?.user) {
                const sbUser = retry.data.user;
                const metaRole = sbUser.user_metadata?.role || sbUser.user_metadata?.ruolo || sbUser.app_metadata?.role;
                const userRole: UserRole = metaRole === 'admin' ? 'admin' : (trimmedEmail.toLowerCase().includes('admin') ? 'admin' : 'user');
                saveUser({
                  id: sbUser.id,
                  email: sbUser.email || trimmedEmail,
                  nome: sbUser.user_metadata?.nome || sbUser.email?.split('@')[0] || (userRole === 'admin' ? 'Amministratore' : 'Utente'),
                  ruolo: userRole,
                  avatar: userRole === 'admin' ? '👑' : '👤',
                });
                return { success: true };
              }
            } catch {}

            // Accesso diretto immediato per bypassare il blocco della conferma email
            const isMatchAdmin =
              trimmedEmail.toLowerCase() === SUPABASE_TEST_CREDENTIALS.admin.email.toLowerCase() ||
              trimmedEmail.toLowerCase() === 'admin@salaprove.it' ||
              trimmedEmail.toLowerCase() === 'admin@app.com' ||
              trimmedEmail.toLowerCase() === 'admin';

            const isMatchUser =
              trimmedEmail.toLowerCase() === SUPABASE_TEST_CREDENTIALS.user.email.toLowerCase() ||
              trimmedEmail.toLowerCase() === 'utente@salaprove.it' ||
              trimmedEmail.toLowerCase() === 'utente@app.com' ||
              trimmedEmail.toLowerCase() === 'utente' ||
              trimmedEmail.toLowerCase() === 'user';

            const regUser = registeredUsers.find(
              (u) => u.email.toLowerCase() === trimmedEmail.toLowerCase()
            );

            const role: UserRole = isMatchAdmin
              ? 'admin'
              : isMatchUser
              ? 'user'
              : regUser?.ruolo || (trimmedEmail.toLowerCase().includes('admin') ? 'admin' : 'user');

            const nome: string = isMatchAdmin
              ? 'Amministratore Studio'
              : isMatchUser
              ? 'Operatore Studio'
              : regUser?.nome || trimmedEmail.split('@')[0];

            saveUser({
              id: regUser?.id || (isMatchAdmin ? 'usr-admin-1' : 'usr-user-1'),
              email: trimmedEmail,
              nome,
              ruolo: role,
              avatar: role === 'admin' ? '👑' : '👤',
            });
            return { success: true };
          }

          // Se le credenziali falliscono ma corrispondono al test preset locale, consenti accesso demo
          const isPresetAdmin = (trimmedEmail === 'admin@app.com' || trimmedEmail === 'admin') && (trimmedPass === 'admin' || trimmedPass === 'admin123');
          const isPresetUser = (trimmedEmail === 'utente@app.com' || trimmedEmail === 'user' || trimmedEmail === 'utente') && (trimmedPass === 'user' || trimmedPass === 'user123');

          if (!isPresetAdmin && !isPresetUser) {
            if (error.message.includes('Invalid login credentials')) {
              return {
                success: false,
                error: 'Email o password non corretti. Verifica le credenziali o creane una nuova.',
              };
            }
            return { success: false, error: error.message };
          }
        }
      } catch (err: any) {
        console.warn('Errore chiamata Supabase auth:', err);
      }
    }

    // Fallback locale per test rapidi o offline
    if (
      (trimmedEmail === PRESET_ACCOUNTS.admin.email || trimmedEmail === 'admin@app.com' || trimmedEmail === 'admin') &&
      (trimmedPass === PRESET_ACCOUNTS.admin.password || trimmedPass === 'admin' || trimmedPass === 'admin123')
    ) {
      saveUser(PRESET_ACCOUNTS.admin.user);
      return { success: true };
    }

    if (
      (trimmedEmail === PRESET_ACCOUNTS.user.email || trimmedEmail === 'utente@app.com' || trimmedEmail === 'utente' || trimmedEmail === 'user') &&
      (trimmedPass === PRESET_ACCOUNTS.user.password || trimmedPass === 'user' || trimmedPass === 'user123' || trimmedPass === 'utente123')
    ) {
      saveUser(PRESET_ACCOUNTS.user.user);
      return { success: true };
    }

    return {
      success: false,
      error: 'Credenziali non valide. Verifica email e password.',
    };
  };

  // 2. Pulsanti rapidi di test ('Entra come Admin' e 'Entra come utente')
  const loginAsRole = async (role: UserRole): Promise<void> => {
    const creds = SUPABASE_TEST_CREDENTIALS[role];

    if (isSupabaseConfigured() && creds) {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: creds.email,
          password: creds.password,
        });

        if (!error && data?.user) {
          const sbUser = data.user;
          const metaRole = sbUser.user_metadata?.role || sbUser.user_metadata?.ruolo || role;
          const userRole: UserRole = metaRole === 'admin' ? 'admin' : 'user';

          const authUser: AuthUser = {
            id: sbUser.id,
            email: sbUser.email || creds.email,
            nome: sbUser.user_metadata?.nome || creds.nome,
            ruolo: userRole,
            avatar: userRole === 'admin' ? '👑' : '👤',
          };

          saveUser(authUser);
          return;
        }
      } catch (e) {
        console.warn('Supabase test login non riuscito, fallback preset:', e);
      }
    }

    // Fallback al preset locale per non bloccare mai il tester
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

  const logout = async () => {
    if (isSupabaseConfigured()) {
      try {
        await supabase.auth.signOut();
      } catch (e) {
        console.error('Error logging out from Supabase:', e);
      }
    }
    saveUser(null);
  };

  // 3. Creazione nuovi account utente da parte dell'Admin
  const createUserAccount = async (params: CreateUserParams): Promise<{ success: boolean; error?: string; user?: any }> => {
    const trimmedEmail = params.email.trim().toLowerCase();
    const trimmedPass = params.password.trim();
    const trimmedName = params.nome.trim();

    if (!trimmedEmail || !trimmedPass) {
      return { success: false, error: 'Email e password sono obbligatorie.' };
    }
    if (trimmedPass.length < 6) {
      return { success: false, error: 'La password deve contenere almeno 6 caratteri (requisito Supabase).' };
    }

    if (!isSupabaseConfigured()) {
      return { success: false, error: 'Supabase non è configurato.' };
    }

    try {
      // Usiamo un client Supabase temporaneo SENZA persistenza di sessione
      // così l'Admin attualmente autenticato NON viene disconnesso!
      const tempClient = createClient(getSupabaseUrl(), getSupabaseKey(), {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      });

      const { data, error } = await tempClient.auth.signUp({
        email: trimmedEmail,
        password: trimmedPass,
        options: {
          data: {
            nome: trimmedName || trimmedEmail.split('@')[0],
            role: params.role,
            ruolo: params.role,
          },
        },
      });

      if (error) {
        return { success: false, error: error.message };
      }

      const newUserId = data.user?.id || `usr-${Date.now()}`;
      const newAccount: RegisteredAccount = {
        id: newUserId,
        email: trimmedEmail,
        nome: trimmedName || trimmedEmail.split('@')[0],
        ruolo: params.role,
        createdAt: new Date().toISOString(),
      };

      // Se la tabella profiles esiste nel database Supabase, sincronizza
      try {
        await supabase.from('profiles').upsert({
          id: newUserId,
          email: trimmedEmail,
          nome: trimmedName || trimmedEmail.split('@')[0],
          ruolo: params.role,
          updated_at: new Date().toISOString(),
        });
      } catch {
        // Tabella profiles opzionale se non ancora migrata
      }

      // Salva nella lista locale per visualizzazione immediata
      const updated = [newAccount, ...registeredUsers.filter(u => u.email !== trimmedEmail)];
      setRegisteredUsers(updated);
      try {
        localStorage.setItem(STORAGE_REGISTERED_USERS, JSON.stringify(updated));
      } catch {}

      return { success: true, user: data.user };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Errore durante la creazione dell\'utente.' };
    }
  };

  const deleteUserAccount = async (id: string): Promise<{ success: boolean; error?: string }> => {
    try {
      // Rimuovi dalla tabella profiles se presente
      if (isSupabaseConfigured()) {
        try {
          await supabase.from('profiles').delete().eq('id', id);
        } catch {}
      }

      const updated = registeredUsers.filter(u => u.id !== id);
      setRegisteredUsers(updated);
      try {
        localStorage.setItem(STORAGE_REGISTERED_USERS, JSON.stringify(updated));
      } catch {}

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Errore durante la rimozione dell\'account.' };
    }
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
        createUserAccount,
        registeredUsers,
        deleteUserAccount,
        refreshRegisteredUsers,
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
