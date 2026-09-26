import React, { useState } from 'react';
import {
  Music2,
  KeyRound,
  Eye,
  EyeOff,
  RefreshCw,
  Lock,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const LoginView: React.FC = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      const res = await login(email, password);
      if (!res.success) {
        setError(res.error || 'Credenziali non valide');
      }
    } catch (err: any) {
      setError(err?.message || 'Errore durante il login.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-yellow-50 flex items-center justify-center p-4 sm:p-6 relative overflow-hidden selection:bg-yellow-400 selection:text-black">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-yellow-500/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-amber-500/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10 space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-yellow-400 text-black shadow-xl shadow-yellow-500/25 mb-1 border-2 border-yellow-300">
            <Music2 className="w-7 h-7 stroke-[2.5]" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            SALA PROVE MUSICALE
          </h1>
          <p className="text-xs sm:text-sm text-yellow-400/80 font-medium">
            Accedi con le tue credenziali
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
                Indirizzo Email
              </label>
              <div className="relative">
                <input
                  type="email"
                  required
                  autoFocus
                  value={email}
                  disabled={isLoading}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nome@salaprove.it"
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
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-yellow-400 transition-colors p-1"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 px-4 rounded-xl bg-yellow-400 hover:bg-yellow-300 active:scale-[0.99] disabled:opacity-50 text-black font-bold text-sm shadow-lg shadow-yellow-500/25 transition-all flex items-center justify-center gap-2 mt-3 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Accesso in corso...</span>
                </>
              ) : (
                <>
                  <KeyRound className="w-4 h-4" />
                  <span>Accedi al Gestionale</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer info */}
        <p className="text-center text-[11px] text-neutral-500">
          Autenticazione basata su sessione sicura Supabase Auth con token JWT.
        </p>
      </div>
    </div>
  );
};
