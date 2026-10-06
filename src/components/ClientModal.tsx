import React, { useEffect, useState } from 'react';
import { X, UserCheck, ShieldCheck, Music, CheckCircle2, Clock } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Client, MembershipStatus } from '../types';
import { formatDateToISO } from '../utils/dateUtils';
import { handleNumericFocus, handleNumericClick, handleNumericBlur } from '../utils/inputUtils';
import type { ExtractedMemberData } from '../services/geminiOcrService';

const DocumentCameraScanner = React.lazy(() =>
  import('./DocumentCameraScanner').then((m) => ({ default: m.DocumentCameraScanner }))
);

interface ClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientToEdit?: Client | null;
}

export const ClientModal: React.FC<ClientModalProps> = ({ isOpen, onClose, clientToEdit }) => {
  const { clients, addClient, updateClient } = useApp();

  const [nome, setNome] = useState('');
  const [cognome, setCognome] = useState('');
  const [codiceFiscale, setCodiceFiscale] = useState('');
  const [residenza, setResidenza] = useState('');
  const [sesso, setSesso] = useState<'M' | 'F' | 'Altro'>('M');
  const [dataNascita, setDataNascita] = useState('1995-05-15');
  const [luogoNascita, setLuogoNascita] = useState('');
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');
  const [statoTesseramento, setStatoTesseramento] = useState<MembershipStatus>('attivo');
  const [numeroTessera, setNumeroTessera] = useState('');
  const [dataTesseramento, setDataTesseramento] = useState(formatDateToISO(new Date()));
  const [dataScadenzaTesseramento, setDataScadenzaTesseramento] = useState('');
  const [quotaTesseramento, setQuotaTesseramento] = useState<string | number>(15);
  const [statoQuota, setStatoQuota] = useState<'pagato' | 'da_saldare'>('pagato');
  const [descrizioneStrumentazione, setDescrizioneStrumentazione] = useState('');
  const [gruppoBand, setGruppoBand] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (clientToEdit) {
      setNome(clientToEdit.nome);
      setCognome(clientToEdit.cognome);
      setCodiceFiscale(clientToEdit.codiceFiscale);
      setResidenza(clientToEdit.residenza);
      setSesso(clientToEdit.sesso);
      setDataNascita(clientToEdit.dataNascita);
      setLuogoNascita(clientToEdit.luogoNascita);
      setTelefono(clientToEdit.telefono);
      setEmail(clientToEdit.email);
      setStatoTesseramento(clientToEdit.statoTesseramento);
      setNumeroTessera(clientToEdit.numeroTessera);
      setDataTesseramento(clientToEdit.dataTesseramento);
      setDataScadenzaTesseramento(clientToEdit.dataScadenzaTesseramento);
      setQuotaTesseramento(clientToEdit.quotaTesseramento);
      setStatoQuota(clientToEdit.statoQuota || (clientToEdit.quotaPagata === false ? 'da_saldare' : 'pagato'));
      setDescrizioneStrumentazione(clientToEdit.descrizioneStrumentazione);
      setGruppoBand(clientToEdit.gruppoBand || '');
      setNote(clientToEdit.note || '');
    } else {
      setNome('');
      setCognome('');
      setCodiceFiscale('');
      setResidenza('');
      setSesso('M');
      setDataNascita('1995-01-01');
      setLuogoNascita('');
      setTelefono('+39 ');
      setEmail('');
      setStatoTesseramento('attivo');
      const nextProgressive = String(clients.length + 1).padStart(3, '0');
      setNumeroTessera(`TS-${new Date().getFullYear()}-${nextProgressive}`);
      const today = new Date();
      setDataTesseramento(formatDateToISO(today));
      const nextYear = new Date(today);
      nextYear.setFullYear(today.getFullYear() + 1);
      setDataScadenzaTesseramento(formatDateToISO(nextYear));
      setQuotaTesseramento(15);
      setStatoQuota('pagato');
      setDescrizioneStrumentazione('');
      setGruppoBand('');
      setNote('');
    }
  }, [clientToEdit, isOpen]);

  if (!isOpen) return null;

  const handleApplyPresetGear = (presetText: string) => {
    setDescrizioneStrumentazione((prev) => (prev ? `${prev}; ${presetText}` : presetText));
  };

  const handleDataExtracted = (data: ExtractedMemberData) => {
    if (data.nome) setNome(data.nome);
    if (data.cognome) setCognome(data.cognome);
    if (data.codiceFiscale) setCodiceFiscale(data.codiceFiscale.toUpperCase().trim());
    if (data.sesso) setSesso(data.sesso);
    if (data.dataNascita) setDataNascita(data.dataNascita);
    if (data.luogoNascita || data.comuneNascita) {
      setLuogoNascita(data.comuneNascita || data.luogoNascita || '');
    }
    if (data.residenzaCompleta || data.indirizzo) {
      setResidenza(data.residenzaCompleta || data.indirizzo || '');
    }
    if (data.telefono) setTelefono(data.telefono);
    if (data.email) setEmail(data.email);
    if (data.gruppoBand) setGruppoBand(data.gruppoBand);
    if (data.strumentiOAttrezzatura) {
      setDescrizioneStrumentazione((prev) =>
        prev ? `${prev}; ${data.strumentiOAttrezzatura}` : data.strumentiOAttrezzatura || ''
      );
    }
    if (data.note) {
      setNote((prev) => (prev ? `${prev} - ${data.note}` : data.note || ''));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome || !cognome) return;

    if (clientToEdit) {
      updateClient({
        ...clientToEdit,
        nome,
        cognome,
        codiceFiscale: codiceFiscale.toUpperCase().trim(),
        residenza,
        sesso,
        dataNascita,
        luogoNascita,
        telefono,
        email,
        statoTesseramento,
        numeroTessera,
        dataTesseramento,
        dataScadenzaTesseramento,
        quotaTesseramento: quotaTesseramento === '' ? 0 : Number(quotaTesseramento),
        statoQuota,
        quotaPagata: statoQuota === 'pagato',
        descrizioneStrumentazione,
        gruppoBand: gruppoBand.trim() || undefined,
        note: note.trim() || undefined,
      });
    } else {
      addClient({
        nome,
        cognome,
        codiceFiscale: codiceFiscale.toUpperCase().trim(),
        residenza,
        sesso,
        dataNascita,
        luogoNascita,
        telefono,
        email,
        statoTesseramento,
        numeroTessera,
        dataTesseramento,
        dataScadenzaTesseramento,
        quotaTesseramento: quotaTesseramento === '' ? 0 : Number(quotaTesseramento),
        statoQuota,
        quotaPagata: statoQuota === 'pagato',
        descrizioneStrumentazione,
        gruppoBand: gruppoBand.trim() || undefined,
        note: note.trim() || undefined,
      });
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden my-8">
        {/* Header */}
        <div className="px-5 sm:px-6 py-3.5 sm:py-4 border-b border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-900/90 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 sm:gap-3.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-yellow-400/10 border border-blue-200/80 dark:border-yellow-500/30 flex items-center justify-center text-blue-600 dark:text-yellow-400 shrink-0 shadow-2xs">
              <UserCheck className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight leading-snug truncate">
                {clientToEdit ? 'Modifica Scheda Tesserato' : 'Registrazione Nuovo Tesserato / Cliente'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-neutral-400 font-normal truncate mt-0.5">
                Anagrafica tesseramento sala prove e strumentazione necessaria
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="modal-header-btn-blue modal-close-btn-blue shrink-0 flex items-center justify-center w-9 h-9 rounded-xl bg-blue-600 hover:bg-red-600 active:scale-95 text-white transition-all cursor-pointer border border-blue-500 hover:border-red-500 shadow-md shadow-blue-500/25"
            style={{ backgroundColor: '#2563eb', color: '#ffffff', borderColor: '#1d4ed8' }}
            title="Chiudi"
            aria-label="Chiudi finestra"
          >
            <X className="w-5 h-5 text-white stroke-[2.5]" style={{ color: '#ffffff', stroke: '#ffffff' }} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* Modulo Tesseramento Online via WhatsApp & Scansione Cartacea */}
          <React.Suspense fallback={<div className="h-16 rounded-xl bg-indigo-50/50 animate-pulse border border-indigo-100 flex items-center justify-center text-xs text-indigo-500">Caricamento scanner modulo...</div>}>
            <DocumentCameraScanner
              onDataExtracted={handleDataExtracted}
              clientPhone={telefono}
              clientName={nome ? `${nome} ${cognome}`.trim() : undefined}
            />
          </React.Suspense>

          {/* Dati Anagrafici Base */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-indigo-600" /> Dati Anagrafici & Tesseramento
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Nome *</label>
                <input
                  type="text"
                  required
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Es. Luca"
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Cognome *</label>
                <input
                  type="text"
                  required
                  value={cognome}
                  onChange={(e) => setCognome(e.target.value)}
                  placeholder="Es. Moretti"
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Codice Fiscale *
                </label>
                <input
                  type="text"
                  required
                  maxLength={16}
                  value={codiceFiscale}
                  onChange={(e) => setCodiceFiscale(e.target.value.toUpperCase())}
                  placeholder="MRTLCA92M15H501U"
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 text-sm font-mono uppercase focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Sesso *</label>
                <select
                  value={sesso}
                  onChange={(e) => setSesso(e.target.value as 'M' | 'F' | 'Altro')}
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                >
                  <option value="M">Maschio (M)</option>
                  <option value="F">Femmina (F)</option>
                  <option value="Altro">Altro</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Data di Nascita *
                </label>
                <input
                  type="date"
                  required
                  value={dataNascita}
                  onChange={(e) => setDataNascita(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Luogo di Nascita *
                </label>
                <input
                  type="text"
                  required
                  value={luogoNascita}
                  onChange={(e) => setLuogoNascita(e.target.value)}
                  placeholder="Es. Roma"
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Residenza Completa (Indirizzo, CAP, Città, Prov.) *
              </label>
              <input
                type="text"
                required
                value={residenza}
                onChange={(e) => setResidenza(e.target.value)}
                placeholder="Es. Via dei Mille 45, 00185 Roma (RM)"
                className="w-full px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Telefono *</label>
                <input
                  type="tel"
                  required
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  placeholder="+39 333 1234567"
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="mario.rossi@email.it"
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Nome Gruppo / Band / Progetto Musicale (Opzionale)
              </label>
              <input
                type="text"
                value={gruppoBand}
                onChange={(e) => setGruppoBand(e.target.value)}
                placeholder="Es. The Velvet Echoes, Tributo De André, Solista..."
                className="w-full px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Dettagli Tesseramento */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
              Stato Quota & Scadenza Tessera
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Stato Tessera</label>
                <select
                  value={statoTesseramento}
                  onChange={(e) => setStatoTesseramento(e.target.value as MembershipStatus)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                >
                  <option value="attivo">✅ Attivo (In regola)</option>
                  <option value="scaduto">⚠️ Scaduto (Da rinnovare)</option>
                  <option value="in_attesa">⏳ In Attesa (Nuovo)</option>
                </select>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-600">
                    N. Tessera (Personalizzabile)
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const next = String(clients.length + 1).padStart(3, '0');
                      setNumeroTessera(`TS-${new Date().getFullYear()}-${next}`);
                    }}
                    className="text-[10px] text-indigo-600 hover:text-indigo-800 font-semibold"
                    title="Genera codice automatico progressivo"
                  >
                    Genera
                  </button>
                </div>
                <input
                  type="text"
                  value={numeroTessera}
                  onChange={(e) => setNumeroTessera(e.target.value)}
                  placeholder="Es. 001, TS-2026-05, A-10..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-mono font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-600">Quota Tessera (€)</label>
                  <span className="text-[10px] text-slate-400 font-medium">Stato quota</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="relative w-20 sm:w-24 shrink-0">
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={quotaTesseramento}
                      onFocus={handleNumericFocus}
                      onClick={handleNumericClick}
                      onBlur={handleNumericBlur}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '' || /^\d*$/.test(val)) {
                          setQuotaTesseramento(val);
                        }
                      }}
                      placeholder="0"
                      className="w-full px-2.5 py-2 rounded-lg border border-slate-300 bg-white text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setStatoQuota((prev) => (prev === 'pagato' ? 'da_saldare' : 'pagato'))}
                    className={`flex-1 py-2 px-2 rounded-lg text-xs font-bold border transition-all flex items-center justify-center gap-1 cursor-pointer touch-manipulation shadow-2xs select-none ${
                      statoQuota === 'pagato'
                        ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300'
                        : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-300'
                    }`}
                    title={
                      statoQuota === 'pagato'
                        ? 'Quota saldata. Clicca per impostare "Da saldare"'
                        : 'Quota da saldare. Clicca per impostare "Saldato"'
                    }
                  >
                    {statoQuota === 'pagato' ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span className="truncate">Saldato</span>
                      </>
                    ) : (
                      <>
                        <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span className="truncate">Da saldare</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Data Rilascio</label>
                <input
                  type="date"
                  value={dataTesseramento}
                  onChange={(e) => setDataTesseramento(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Data Scadenza</label>
                <input
                  type="date"
                  value={dataScadenzaTesseramento}
                  onChange={(e) => setDataScadenzaTesseramento(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>
            </div>
          </div>

          {/* Descrizione Strumentazione Necessaria */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <Music className="w-4 h-4 text-indigo-600" /> Descrizione Strumentazione Necessaria *
              </label>
              <span className="text-[11px] text-slate-500">Richiesta dal tesserato per le prove</span>
            </div>
            <p className="text-xs text-slate-600">
              Specifica gli strumenti e il setup necessario (es. tipo di batteria, amplificatori, microfoni, tastiere, DI box):
            </p>
            <textarea
              required
              rows={3}
              value={descrizioneStrumentazione}
              onChange={(e) => setDescrizioneStrumentazione(e.target.value)}
              placeholder="Es. Batteria 5 pezzi con piatti completi, 2 ampli chitarra valvolari (Marshall e Fender), 1 testata con cassa per basso, 3 microfoni voce con aste, 1 tastiera/piano..."
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-800 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
            />
            {/* Quick Presets */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              <span className="text-[11px] font-medium text-slate-500 self-center">Aggiungi preset rapido:</span>
              <button
                type="button"
                onClick={() => handleApplyPresetGear('Batteria 5 pezzi con piatti completi')}
                className="text-xs px-2.5 py-1 bg-white border border-slate-300 hover:border-indigo-500 hover:text-indigo-600 rounded-md text-slate-700 transition-colors"
              >
                + Batteria & Piatti
              </button>
              <button
                type="button"
                onClick={() => handleApplyPresetGear('2 Amplificatori Chitarra valvolari')}
                className="text-xs px-2.5 py-1 bg-white border border-slate-300 hover:border-indigo-500 hover:text-indigo-600 rounded-md text-slate-700 transition-colors"
              >
                + 2 Ampli Chitarra
              </button>
              <button
                type="button"
                onClick={() => handleApplyPresetGear('Testata e Cassa Basso')}
                className="text-xs px-2.5 py-1 bg-white border border-slate-300 hover:border-indigo-500 hover:text-indigo-600 rounded-md text-slate-700 transition-colors"
              >
                + Cassa Basso
              </button>
              <button
                type="button"
                onClick={() => handleApplyPresetGear('3 Microfoni Shure SM58 con aste')}
                className="text-xs px-2.5 py-1 bg-white border border-slate-300 hover:border-indigo-500 hover:text-indigo-600 rounded-md text-slate-700 transition-colors"
              >
                + 3 Microfoni Voce
              </button>
              <button
                type="button"
                onClick={() => handleApplyPresetGear('Pianoforte digitale 88 tasti pesati')}
                className="text-xs px-2.5 py-1 bg-white border border-slate-300 hover:border-indigo-500 hover:text-indigo-600 rounded-md text-slate-700 transition-colors"
              >
                + Piano Digitale
              </button>
            </div>
          </div>

          {/* Note generali */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Note Tesseramento</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Eventuali annotazioni su preferenze orari, cauzioni o contatti..."
              className="w-full px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
            />
          </div>

          {/* Footer actions */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 text-sm font-semibold transition-colors"
            >
              Annulla
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm shadow-xs transition-colors flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              {clientToEdit ? 'Salva Modifiche' : 'Registra Tesserato'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
