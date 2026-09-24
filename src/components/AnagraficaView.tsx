import React, { useState, useEffect } from 'react';
import {
  Building2,
  Music2,
  MapPin,
  Phone,
  Mail,
  Globe,
  FileText,
  CheckCircle2,
  RotateCcw,
  Sparkles,
  ExternalLink,
  Users,
  DoorOpen,
  CreditCard,
  Calendar,
  Save,
  Info,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { DEFAULT_STUDIO_INFO } from '../data/initialData';

interface AnagraficaViewProps {
  onNavigateTab?: (tab: 'rooms' | 'clients' | 'staff' | 'calendar') => void;
}

export const AnagraficaView: React.FC<AnagraficaViewProps> = ({ onNavigateTab }) => {
  const { studioInfo, updateStudioInfo, rooms, staff, clients } = useApp();

  const [nome, setNome] = useState('');
  const [sottotitolo, setSottotitolo] = useState('');
  const [indirizzo, setIndirizzo] = useState('');
  const [citta, setCitta] = useState('');
  const [cap, setCap] = useState('');
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');
  const [codiceFiscalePiva, setCodiceFiscalePiva] = useState('');
  const [sitoWeb, setSitoWeb] = useState('');
  const [note, setNote] = useState('');

  const [isSaved, setIsSaved] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (studioInfo) {
      setNome(studioInfo.nome || '');
      setSottotitolo(studioInfo.sottotitolo || '');
      setIndirizzo(studioInfo.indirizzo || '');
      setCitta(studioInfo.citta || '');
      setCap(studioInfo.cap || '');
      setTelefono(studioInfo.telefono || '');
      setEmail(studioInfo.email || '');
      setCodiceFiscalePiva(studioInfo.codiceFiscalePiva || '');
      setSitoWeb(studioInfo.sitoWeb || '');
      setNote(studioInfo.note || '');
      setHasChanges(false);
    }
  }, [studioInfo]);

  const handleFieldChange = (setter: React.Dispatch<React.SetStateAction<string>>, value: string) => {
    setter(value);
    setHasChanges(true);
    setIsSaved(false);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNome = nome.trim() || 'Sala Prove';

    updateStudioInfo({
      nome: cleanNome,
      sottotitolo: sottotitolo.trim(),
      indirizzo: indirizzo.trim(),
      citta: citta.trim(),
      cap: cap.trim(),
      telefono: telefono.trim(),
      email: email.trim(),
      codiceFiscalePiva: codiceFiscalePiva.trim(),
      sitoWeb: sitoWeb.trim(),
      note: note.trim(),
    });

    setHasChanges(false);
    setIsSaved(true);
    setTimeout(() => {
      setIsSaved(false);
    }, 2500);
  };

  const handleReset = () => {
    if (window.confirm('Vuoi ripristinare i dati anagrafici predefiniti di Sound Studio?')) {
      updateStudioInfo(DEFAULT_STUDIO_INFO);
      setNome(DEFAULT_STUDIO_INFO.nome);
      setSottotitolo(DEFAULT_STUDIO_INFO.sottotitolo || '');
      setIndirizzo(DEFAULT_STUDIO_INFO.indirizzo || '');
      setCitta(DEFAULT_STUDIO_INFO.citta || '');
      setCap(DEFAULT_STUDIO_INFO.cap || '');
      setTelefono(DEFAULT_STUDIO_INFO.telefono || '');
      setEmail(DEFAULT_STUDIO_INFO.email || '');
      setCodiceFiscalePiva(DEFAULT_STUDIO_INFO.codiceFiscalePiva || '');
      setSitoWeb(DEFAULT_STUDIO_INFO.sitoWeb || '');
      setNote(DEFAULT_STUDIO_INFO.note || '');
      setHasChanges(false);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                Anagrafica Sala Prove & Struttura
              </h2>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200/80">
                Ufficiale
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Configura il nome personalizzato, la ragione sociale, la sede e i recapiti utilizzati in tutta l'applicazione, sul calendario e sui documenti di tesseramento.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-stretch md:self-auto justify-end">
          <button
            type="button"
            onClick={handleReset}
            className="px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 text-xs font-semibold flex items-center gap-1.5 transition-colors"
            title="Ripristina valori di default"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden sm:inline">Ripristina Default</span>
          </button>

          <button
            type="button"
            onClick={handleSave}
            className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-all ${
              isSaved
                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                : hasChanges
                ? 'bg-indigo-600 text-white hover:bg-indigo-700 animate-pulse'
                : 'bg-indigo-600 text-white hover:bg-indigo-700'
            }`}
          >
            {isSaved ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                <span>Modifiche Salvate!</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Salva Modifiche</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Grid: Form + Live Preview & Related Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left / Center: The Editing Form */}
        <div className="lg:col-span-8 space-y-6">
          <form onSubmit={handleSave} className="bg-white rounded-xl border border-slate-200 shadow-xs divide-y divide-slate-100 overflow-hidden">
            {/* 1. Dati Generali Sala Prove */}
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                <Music2 className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                  1. Nome & Identità della Struttura
                </h3>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-800">
                    Nome della Sala Prove / Studio <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[11px] text-indigo-600 font-medium">
                    Visibile nella barra superiore, calendario e PDF
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={nome}
                    onChange={(e) => handleFieldChange(setNome, e.target.value)}
                    placeholder="Es. Sound Studio, Garage 44, Il Cubo Sonoro..."
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-lg border border-slate-300 bg-white text-sm font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  />
                  <Music2 className="w-4 h-4 text-indigo-500 absolute left-3 top-3" />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Questo nome identifica il tuo centro prove e comparirà come intestazione su ogni modulo e ricevuta.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Sottotitolo / Ragione Sociale Ufficiale
                </label>
                <input
                  type="text"
                  value={sottotitolo}
                  onChange={(e) => handleFieldChange(setSottotitolo, e.target.value)}
                  placeholder="Es. Associazione Culturale Musicale • Centro Prove & Registrazione"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-slate-400" />
                  <span>Codice Fiscale / Partita IVA</span>
                </label>
                <input
                  type="text"
                  value={codiceFiscalePiva}
                  onChange={(e) => handleFieldChange(setCodiceFiscalePiva, e.target.value)}
                  placeholder="Es. CF: 97845610152 oppure P.IVA: 01234567890"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden font-mono"
                />
              </div>
            </div>

            {/* 2. Sede Operativa & Indirizzo */}
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                <MapPin className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                  2. Sede & Posizione Geografica
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5">
                <div className="sm:col-span-7">
                  <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span>Indirizzo della Sede</span>
                  </label>
                  <input
                    type="text"
                    value={indirizzo}
                    onChange={(e) => handleFieldChange(setIndirizzo, e.target.value)}
                    placeholder="Es. Via delle Note Musicali, 12"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  />
                </div>

                <div className="sm:col-span-3">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Città
                  </label>
                  <input
                    type="text"
                    value={citta}
                    onChange={(e) => handleFieldChange(setCitta, e.target.value)}
                    placeholder="Es. Milano"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    CAP
                  </label>
                  <input
                    type="text"
                    value={cap}
                    onChange={(e) => handleFieldChange(setCap, e.target.value)}
                    placeholder="Es. 20100"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden font-mono"
                  />
                </div>
              </div>
            </div>

            {/* 3. Recapiti di Contatto */}
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                <Phone className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                  3. Recapiti & Contatti Pubblici
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span>Telefono / WhatsApp</span>
                  </label>
                  <input
                    type="text"
                    value={telefono}
                    onChange={(e) => handleFieldChange(setTelefono, e.target.value)}
                    placeholder="Es. 02 9876543 / 340 1234567"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    <span>Email di Contatto / Prenotazioni</span>
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => handleFieldChange(setEmail, e.target.value)}
                    placeholder="Es. info@soundstudio.it"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                    <Globe className="w-3.5 h-3.5 text-slate-400" />
                    <span>Sito Web / Pagina Social (Opzionale)</span>
                  </label>
                  <input
                    type="text"
                    value={sitoWeb}
                    onChange={(e) => handleFieldChange(setSitoWeb, e.target.value)}
                    placeholder="Es. www.soundstudio.it"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  />
                </div>
              </div>
            </div>

            {/* 4. Note & Informazioni Operative */}
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                <Info className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                  4. Informazioni Operative
                </h3>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Note di Servizio / Orari di Apertura (24/7 o orari personalizzati)
                </label>
                <textarea
                  rows={2}
                  value={note}
                  onChange={(e) => handleFieldChange(setNote, e.target.value)}
                  placeholder="Es. Orario continuato 24 ore su 24 con turnazione automatica degli operatori, climatizzazione e service audio in dotazione."
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>
            </div>

            {/* Submit Bar at Bottom of Form */}
            <div className="p-4 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {hasChanges ? (
                  <span className="text-xs text-amber-700 font-medium flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                    Modifiche non salvate
                  </span>
                ) : (
                  <span className="text-xs text-slate-500 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    Tutti i dati sono salvati
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-100 transition-colors"
                >
                  Annulla / Default
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs flex items-center gap-1.5 transition-colors"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Salva Anagrafica</span>
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Right: Live Preview Box & Quick Links to Related Registries */}
        <div className="lg:col-span-4 space-y-6">
          {/* Live Preview Card */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Anteprima Intestazione Ufficiale
                </h3>
              </div>
              <span className="text-[10px] text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded-md">
                Live
              </span>
            </div>

            {/* Header Mockup */}
            <div className="p-4 rounded-xl bg-slate-900 text-white space-y-2 shadow-inner">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center font-bold text-sm">
                  {nome ? nome.substring(0, 2).toUpperCase() : 'SP'}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold tracking-tight truncate flex items-center gap-1.5">
                    <span className="text-slate-300">SALA PROVE</span>
                    <span className="text-indigo-400">• {nome || 'Nome Sala Prove'}</span>
                  </div>
                  <p className="text-[10px] text-slate-400 truncate">
                    {sottotitolo || 'Centro Prove & Registrazione'}
                  </p>
                </div>
              </div>
              <div className="pt-2 border-t border-slate-800 text-[10px] text-slate-400 space-y-0.5">
                <p className="truncate">
                  {[indirizzo, citta].filter(Boolean).join(', ') || 'Via Roma, 1 - Milano'}
                </p>
                <p className="truncate text-slate-500">
                  {[telefono ? `Tel: ${telefono}` : '', email].filter(Boolean).join(' • ') || 'Tel. 02 9876543'}
                </p>
              </div>
            </div>

            {/* Print Document Preview snippet */}
            <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 space-y-2 text-xs">
              <p className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-indigo-600" />
                <span>Uso nei Documenti & PDF</span>
              </p>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Questa intestazione compare automaticamente su tutte le <strong>Schede di Tesseramento A4</strong>, sui <strong>Badge Socio</strong> e sulle ricevute delle quote sociali emesse.
              </p>
            </div>
          </div>

          {/* Quick Anagrafiche Overview */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider pb-2 border-b border-slate-100">
              Altre Anagrafiche della Struttura
            </h3>
            <p className="text-[11px] text-slate-500">
              Accedi rapidamente alla gestione delle altre sezioni anagrafiche del centro prove:
            </p>

            <div className="space-y-2 pt-1">
              {/* Sale Prove */}
              <button
                type="button"
                onClick={() => onNavigateTab?.('rooms')}
                className="w-full p-2.5 rounded-lg border border-slate-200 hover:border-amber-300 hover:bg-amber-50/50 flex items-center justify-between text-left transition-colors group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-md bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                    <DoorOpen className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-800 group-hover:text-amber-900 block">
                      Anagrafica Sale Prove
                    </span>
                    <span className="text-[10px] text-slate-500">
                      Tariffe orarie, backline e capienza
                    </span>
                  </div>
                </div>
                <span className="text-xs font-bold text-amber-700 bg-amber-100/70 px-2 py-0.5 rounded-full">
                  {rooms.length} sale
                </span>
              </button>

              {/* Clienti & Tesserati */}
              <button
                type="button"
                onClick={() => onNavigateTab?.('clients')}
                className="w-full p-2.5 rounded-lg border border-slate-200 hover:border-sky-300 hover:bg-sky-50/50 flex items-center justify-between text-left transition-colors group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-md bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
                    <CreditCard className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-800 group-hover:text-sky-900 block">
                      Anagrafica Soci & Band
                    </span>
                    <span className="text-[10px] text-slate-500">
                      Tessere annuali, quote e scadenze
                    </span>
                  </div>
                </div>
                <span className="text-xs font-bold text-sky-700 bg-sky-100/70 px-2 py-0.5 rounded-full">
                  {clients.length} soci
                </span>
              </button>

              {/* Operatori & Staff */}
              <button
                type="button"
                onClick={() => onNavigateTab?.('staff')}
                className="w-full p-2.5 rounded-lg border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/50 flex items-center justify-between text-left transition-colors group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-md bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-800 group-hover:text-emerald-900 block">
                      Anagrafica Operatori & Staff
                    </span>
                    <span className="text-[10px] text-slate-500">
                      Fasce orarie 24h e turni primari
                    </span>
                  </div>
                </div>
                <span className="text-xs font-bold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-full">
                  {staff.length} staff
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
