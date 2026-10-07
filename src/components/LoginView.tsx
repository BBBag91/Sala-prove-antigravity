import React, { useState, useEffect } from 'react';
import {
  Music2,
  KeyRound,
  Eye,
  EyeOff,
  RefreshCw,
  Lock,
  GraduationCap,
  Shield,
  ShieldAlert,
  ShieldCheck,
  User,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { ThemeToggle } from './ThemeToggle';
import { sanitizeInput, loginRateLimiter } from '../utils/security';

export const LoginView: React.FC = () => {
  const { login, loginAsRole, loginAsTeacher } = useAuth();
  const { staff } = useApp();
  const teachers = staff.filter((s) => s.ruolo === 'insegnante' || s.ruolo === 'entrambi');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lockoutRemaining, setLockoutRemaining] = useState<number>(0);

  // Aggiorna timer di blocco se l'IP/account ha subito troppi tentativi falliti consecutivi
  useEffect(() => {
    const rateCheck = loginRateLimiter.check('login_global');
    if (!rateCheck.isAllowed) {
      setLockoutRemaining(rateCheck.remainingLockoutSeconds);
    }
  }, []);

  useEffect(() => {
    if (lockoutRemaining <= 0) return;
    const timer = setInterval(() => {
      setLockoutRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [lockoutRemaining]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // 1. Controllo Anti-Brute Force Lockout
    const rateCheck = loginRateLimiter.check('login_global');
    if (!rateCheck.isAllowed) {
      setLockoutRemaining(rateCheck.remainingLockoutSeconds);
      setError(`Accesso temporaneamente bloccato per sicurezza. Riprova tra ${rateCheck.remainingLockoutSeconds} secondi.`);
      return;
    }

    // 2. Sanitizzazione input per prevenire injection
    const cleanEmail = sanitizeInput(email);
    if (!cleanEmail || !password) {
      setError('Inserisci sia email/username che password.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await login(cleanEmail, password);
      if (!res.success) {
        // Registra tentativo fallito
        const failRecord = loginRateLimiter.recordFailure('login_global');
        if (failRecord.isLocked) {
          setLockoutRemaining(failRecord.remainingLockoutSeconds);
          setError(`Troppi tentativi errati consecutivi (${failRecord.attempts}). Accesso bloccato per ${failRecord.remainingLockoutSeconds} secondi.`);
        } else {
          setError(res.error || `Credenziali non valide. (${failRecord.attempts}/5 tentativi)`);
        }
      } else {
        // Reset in caso di login riuscito
        loginRateLimiter.reset('login_global');
      }
    } catch (err: any) {
      setError(err?.message || 'Errore durante il login.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-yellow-50 flex items-center justify-center p-4 sm:p-6 relative overflow-hidden selection:bg-yellow-400 selection:text-black">
      {/* Theme Switcher Button top right */}
      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle compact={false} />
      </div>
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-yellow-500/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-amber-500/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10 space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-36 h-20 rounded-2xl bg-white shadow-xl shadow-yellow-500/20 mb-2 border-2 border-yellow-400/40 p-2 overflow-hidden">
            <img src="/logo-header.png" alt="La musica fa... Logo" className="w-full h-full object-contain rounded-xl" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            La musica fa...
          </h1>
          <p className="text-xs sm:text-sm text-yellow-400/80 font-medium">
            Scuola di Musica • Sale Prova • Studio di Registrazione
          </p>
        </div>

        {/* ── Manual Login Form ── */}
        <div className="bg-neutral-950/90 border border-yellow-500/30 rounded-2xl p-6 sm:p-7 backdrop-blur shadow-2xl shadow-yellow-500/5 space-y-5">
          <div className="flex items-center gap-2.5 pb-3 border-b border-neutral-800">
            <div className="w-8 h-8 rounded-lg bg-yellow-400/15 text-yellow-400 flex items-center justify-center border border-yellow-500/20">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide">
                Autenticazione
              </h2>
              <p className="text-[11px] text-neutral-400">
                Inserisci email e password del tuo account
              </p>
            </div>
          </div>

          {error && (
            <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-medium flex items-start gap-2.5">
              <span className="w-2 h-2 rounded-full bg-rose-400 shrink-0 mt-1" />
              <div className="flex-1 leading-relaxed">{error}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                Email o Nome Utente Docente
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  autoFocus
                  value={email}
                  disabled={isLoading}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="es. luca.dichiara@salaprove.it o luca.dichiara"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-800 bg-[#0a0a0a] text-yellow-100 text-sm focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 focus:outline-none disabled:opacity-50 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  disabled={isLoading}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Inserisci la password"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-800 bg-[#0a0a0a] text-yellow-100 text-sm focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 focus:outline-none pr-10 disabled:opacity-50 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-yellow-400 transition-colors p-1 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || lockoutRemaining > 0}
              className={`w-full py-2.5 px-4 rounded-xl font-bold text-sm shadow-lg transition-all flex items-center justify-center gap-2 mt-3 cursor-pointer ${
                lockoutRemaining > 0
                  ? 'bg-neutral-800 text-rose-400 border border-rose-500/30 cursor-not-allowed opacity-90'
                  : 'bg-yellow-400 hover:bg-yellow-300 active:scale-[0.99] disabled:opacity-50 text-black shadow-yellow-500/25'
              }`}
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Accesso in corso...</span>
                </>
              ) : lockoutRemaining > 0 ? (
                <>
                  <ShieldAlert className="w-4 h-4 text-rose-400" />
                  <span>Blocco di Sicurezza: {lockoutRemaining}s</span>
                </>
              ) : (
                <>
                  <KeyRound className="w-4 h-4" />
                  <span>Accedi al Gestionale</span>
                </>
              )}
            </button>
          </form>

          {/* Enterprise Security Footer Badge */}
          <div className="pt-2 border-t border-neutral-900 flex items-center justify-between text-[10px] text-neutral-500 font-medium">
            <span className="flex items-center gap-1 text-emerald-400">
              <ShieldCheck className="w-3.5 h-3.5" /> Canale Protetto TLS 256-bit
            </span>
            <span>GDPR Ready • Anti-Brute Force</span>
          </div>
        </div>

        {/* ── Selezione Rapida Account Docente (Compila Email) ── */}
        {teachers.length > 0 && (
          <div className="bg-neutral-950/90 border border-yellow-500/20 rounded-2xl p-4 sm:p-5 backdrop-blur shadow-xl space-y-3">
            <div className="flex items-center justify-between text-xs text-neutral-400 font-medium pb-2 border-b border-neutral-800">
              <span className="flex items-center gap-1.5 text-purple-400 font-bold">
                <GraduationCap className="w-3.5 h-3.5" /> Profili Insegnanti Verificati
              </span>
              <span className="text-[10px] text-neutral-500">Seleziona per inserire l'email</span>
            </div>

            <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
              {teachers.map((teacher) => {
                const teacherEmail =
                  teacher.id === 'staff-1' || teacher.nome.toLowerCase().includes('gabriele')
                    ? 'gabriele.piva@salaprove.it'
                    : teacher.email && !teacher.email.includes('marco.bellini')
                    ? teacher.email
                    : `${teacher.nome.toLowerCase().replace(/\s+/g, '')}.${teacher.cognome.toLowerCase().replace(/\s+/g, '')}@salaprove.it`;
                const isSelected = email.toLowerCase() === teacherEmail.toLowerCase();
                return (
                  <button
                    key={teacher.id}
                    type="button"
                    onClick={() => {
                      setEmail(teacherEmail);
                      setError(null);
                    }}
                    className={`w-full p-2.5 rounded-xl border text-left transition-all flex items-center justify-between cursor-pointer group ${
                      isSelected
                        ? 'bg-purple-900/30 border-purple-500 text-white shadow-2xs'
                        : 'bg-neutral-900/80 hover:bg-purple-950/30 border-purple-500/25 hover:border-purple-400 text-neutral-300'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-white text-[11px] shrink-0 shadow-2xs"
                        style={{ backgroundColor: teacher.coloreBadge || '#8b5cf6' }}
                      >
                        {teacher.nome[0]}{teacher.cognome[0]}
                      </div>
                      <div className="min-w-0">
                        <span className="font-bold text-xs text-white group-hover:text-purple-300 block truncate">
                          {teacher.nome} {teacher.cognome}
                        </span>
                        <span className="text-[10px] text-neutral-400 block truncate font-mono">
                          {teacherEmail}
                        </span>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-purple-300 bg-purple-500/20 px-2 py-0.5 rounded border border-purple-500/30 shrink-0 ml-1">
                      {isSelected ? 'Selezionato ✓' : 'Compila ➔'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Footer info */}
        <p className="text-center text-[11px] text-neutral-500">
          Autenticazione basata su sessione sicura Supabase Auth con token JWT.
        </p>
      </div>
    </div>
  );
};
