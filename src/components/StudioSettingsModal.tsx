import React, { useState, useEffect } from 'react';
import { X, Music2, Building2, MapPin, Phone, Mail, CheckCircle2, Sparkles } from 'lucide-react';
import { useApp } from '../context/AppContext';

interface StudioSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const StudioSettingsModal: React.FC<StudioSettingsModalProps> = ({ isOpen, onClose }) => {
  const { studioInfo, updateStudioInfo } = useApp();

  const [nome, setNome] = useState('');
  const [sottotitolo, setSottotitolo] = useState('');
  const [indirizzo, setIndirizzo] = useState('');
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');
  const [citta, setCitta] = useState('');
  const [showSavedToast, setShowSavedToast] = useState(false);

  useEffect(() => {
    if (studioInfo) {
      setNome(studioInfo.nome || '');
      setSottotitolo(studioInfo.sottotitolo || '');
      setIndirizzo(studioInfo.indirizzo || '');
      setTelefono(studioInfo.telefono || '');
      setEmail(studioInfo.email || '');
      setCitta(studioInfo.citta || '');
    }
  }, [studioInfo, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNome = nome.trim() || 'Sala Prove';
    updateStudioInfo({
      ...studioInfo,
      nome: cleanNome,
      sottotitolo: sottotitolo.trim(),
      indirizzo: indirizzo.trim(),
      telefono: telefono.trim(),
      email: email.trim(),
      citta: citta.trim(),
    });

    setShowSavedToast(true);
    setTimeout(() => {
      setShowSavedToast(false);
      onClose();
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="relative w-full max-w-lg bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                Nome & Dati della Sala Prove
              </h2>
              <p className="text-xs text-slate-500">
                Personalizza il nome e l'intestazione ufficiale della struttura
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Nome Sala Prove */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-slate-800">
                Nome della Sala Prove / Studio <span className="text-rose-500">*</span>
              </label>
              <span className="text-[10px] text-indigo-600 font-semibold">Visibile ovunque</span>
            </div>
            <div className="relative">
              <input
                type="text"
                required
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Es. Sound Studio, Garage 44, Il Cubo Sonoro..."
                className="w-full px-3 py-2.5 rounded-lg border border-slate-300 bg-white text-sm font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden pl-9"
              />
              <Music2 className="w-4 h-4 text-indigo-500 absolute left-3 top-3" />
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Questo nome comparirà nella barra di navigazione, nel calendario, nelle schede di tesseramento e sui PDF.
            </p>
          </div>

          {/* Sottotitolo / Dicitura */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Sottotitolo / Ragione Sociale (Opzionale)
            </label>
            <input
              type="text"
              value={sottotitolo}
              onChange={(e) => setSottotitolo(e.target.value)}
              placeholder="Es. Associazione Culturale Musicale • Centro Prove & Registrazione"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
            />
          </div>

          {/* Indirizzo & Città */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                <span>Indirizzo / Sede</span>
              </label>
              <input
                type="text"
                value={indirizzo}
                onChange={(e) => setIndirizzo(e.target.value)}
                placeholder="Es. Via Roma, 42"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Città
              </label>
              <input
                type="text"
                value={citta}
                onChange={(e) => setCitta(e.target.value)}
                placeholder="Es. Milano"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Telefono & Email */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                <span>Telefono</span>
              </label>
              <input
                type="text"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                placeholder="Es. 02 1234567"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                <span>Email di contatto</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Es. info@miasalaprove.it"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Live Preview Box */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Anteprima Intestazione
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-900">SALA PROVE</span>
              <span className="text-xs font-bold text-indigo-600">• {nome || 'Nome Sala Prove'}</span>
            </div>
            <p className="text-[11px] text-slate-500 truncate">
              {sottotitolo || 'Centro Prove & Registrazione'}
            </p>
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                setNome('Sound Studio');
                setSottotitolo('Associazione Culturale Musicale • Centro Prove & Registrazione');
                setIndirizzo('Via delle Note Musicali, 12');
                setTelefono('02 9876543');
                setEmail('info@soundstudio.it');
                setCitta('Milano');
              }}
              className="text-xs text-slate-500 hover:text-slate-800 font-medium"
            >
              Ripristina default
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors"
              >
                Annulla
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors"
              >
                {showSavedToast ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                    <span>Salvato!</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-indigo-200" />
                    <span>Salva Nome</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
