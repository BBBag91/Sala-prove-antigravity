import React, { useState } from 'react';
import {
  FileSpreadsheet,
  CheckCircle2,
  Music2,
  User,
  MapPin,
  Calendar,
  Phone,
  Mail,
  ShieldCheck,
  Send,
  Sparkles,
  ArrowRight,
  Clock,
  Building2,
  Check,
} from 'lucide-react';
import { Client } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { mapClientToDb } from '../services/supabaseService';

export const PublicMembershipFormView: React.FC = () => {
  // Form State
  const [nome, setNome] = useState('');
  const [cognome, setCognome] = useState('');
  const [codiceFiscale, setCodiceFiscale] = useState('');
  const [sesso, setSesso] = useState<'M' | 'F'>('M');
  const [dataNascita, setDataNascita] = useState('');
  const [luogoNascita, setLuogoNascita] = useState('');
  const [nazioneNascita, setNazioneNascita] = useState('Italia');
  const [nazioneCittadinanza, setNazioneCittadinanza] = useState('Italia');
  const [indirizzoResidenza, setIndirizzoResidenza] = useState('');
  const [capResidenza, setCapResidenza] = useState('');
  const [comuneResidenza, setComuneResidenza] = useState('');
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');
  const [discipline, setDiscipline] = useState('Musica / Sala Prove');
  const [gruppoBand, setGruppoBand] = useState('');
  const [accettaRegolamento, setAccettaRegolamento] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submittedClient, setSubmittedClient] = useState<Client | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanCf = codiceFiscale.trim().toUpperCase();
    if (cleanCf.length !== 16) {
      setErrorMsg('Il Codice Fiscale deve essere di esattamente 16 caratteri alfanumerici.');
      return;
    }

    if (!accettaRegolamento) {
      setErrorMsg('È necessario accettare lo Statuto e il Regolamento dell\'Associazione per completare il tesseramento.');
      return;
    }

    setIsSubmitting(true);

    try {
      const todayISO = new Date().toISOString().split('T')[0];
      const todayDate = new Date();
      const nextYear = new Date(todayDate);
      nextYear.setFullYear(todayDate.getFullYear() + 1);
      const scadenzaISO = nextYear.toISOString().split('T')[0];

      // Formatta la residenza completa
      const fullResidenza = `${indirizzoResidenza.trim()}, ${capResidenza.trim()} ${comuneResidenza.trim()}`.trim();

      // Leggi clienti esistenti per calcolare il numero progressivo tessera
      let currentClients: Client[] = [];
      try {
        const stored = localStorage.getItem('salaprove_clients_v1');
        if (stored) currentClients = JSON.parse(stored);
      } catch {}

      const nextProg = currentClients.length + 1;
      const numeroTessera = `TS-${todayDate.getFullYear()}-${String(nextProg).padStart(3, '0')}`;

      // Salva parti di residenza nelle note per l'export a 17 colonne dell'ente
      const residenzaMetadata = JSON.stringify({
        indirizzo: indirizzoResidenza.trim(),
        cap: capResidenza.trim(),
        comune: comuneResidenza.trim(),
        nazioneNascita: nazioneNascita.trim(),
        nazioneCittadinanza: nazioneCittadinanza.trim(),
        discipline: discipline.trim(),
      });

      const newClient: Client = {
        id: `cli-${Date.now()}`,
        nome: nome.trim(),
        cognome: cognome.trim(),
        codiceFiscale: cleanCf,
        sesso,
        dataNascita,
        luogoNascita: luogoNascita.trim(),
        residenza: fullResidenza,
        telefono: telefono.trim(),
        email: email.trim(),
        statoTesseramento: 'attivo',
        numeroTessera,
        dataTesseramento: todayISO,
        dataScadenzaTesseramento: scadenzaISO,
        quotaTesseramento: 15,
        // ESPLICITAMENTE DA SALDARE come richiesto dall'utente
        statoQuota: 'da_saldare',
        quotaPagata: false,
        descrizioneStrumentazione: discipline.trim(),
        gruppoBand: gruppoBand.trim() || undefined,
        note: `Iscrizione inviata online via WhatsApp il ${new Date().toLocaleDateString('it-IT')} ore ${new Date().toLocaleTimeString('it-IT')}. [QUOTA_PAGAMENTO:da_saldare] [META_RESIDENZA:${residenzaMetadata}]`,
      };

      // 1. Salva in localStorage locale
      const updatedClients = [...currentClients, newClient];
      try {
        localStorage.setItem('salaprove_clients_v1', JSON.stringify(updatedClients));
      } catch (err) {
        console.warn('Errore salvataggio localStorage client:', err);
      }

      // 2. Salva direttamente su Supabase Cloud (se configurato)
      if (isSupabaseConfigured()) {
        try {
          const dbRow = mapClientToDb(newClient);
          const { error } = await supabase.from('clients').upsert(dbRow);
          if (error) {
            console.warn('Avviso inserimento Supabase (fallback locale attivo):', error);
          }
        } catch (dbErr) {
          console.warn('Errore di rete Supabase:', dbErr);
        }
      }

      setSubmittedClient(newClient);
      setIsSuccess(true);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Si è verificato un errore durante l\'invio del modulo. Riprova.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetForm = () => {
    setNome('');
    setCognome('');
    setCodiceFiscale('');
    setDataNascita('');
    setLuogoNascita('');
    setIndirizzoResidenza('');
    setCapResidenza('');
    setComuneResidenza('');
    setTelefono('');
    setEmail('');
    setGruppoBand('');
    setIsSuccess(false);
    setSubmittedClient(null);
  };

  // Stili di sicurezza per garantire massimo contrasto indipendentemente dai temi esterni
  const labelStyle: React.CSSProperties = {
    color: '#0f172a',
    fontWeight: 700,
    fontSize: '0.925rem',
  };

  const inputStyle: React.CSSProperties = {
    color: '#0f172a',
    backgroundColor: '#ffffff',
    borderColor: '#cbd5e1',
    borderWidth: '2px',
    fontSize: '1rem',
    fontWeight: 500,
  };

  const sectionHeaderStyle: React.CSSProperties = {
    color: '#0f172a',
    fontWeight: 800,
    fontSize: '1.05rem',
  };

  if (isSuccess && submittedClient) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="max-w-lg w-full bg-white rounded-3xl shadow-2xl border-2 border-slate-200 p-6 sm:p-9 space-y-6 text-center">
          <div className="w-18 h-18 rounded-full bg-emerald-100 text-emerald-600 border-2 border-emerald-500 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
            <CheckCircle2 className="w-10 h-10 stroke-[2.5]" />
          </div>

          <div className="space-y-2">
            <span className="inline-block text-xs font-extrabold uppercase tracking-widest text-emerald-800 bg-emerald-100 px-3.5 py-1 rounded-full border border-emerald-300">
              Registrazione Ricevuta
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900" style={{ color: '#0f172a' }}>
              Benvenuto, {submittedClient.nome}!
            </h1>
            <p className="text-sm sm:text-base text-slate-700 leading-relaxed font-medium" style={{ color: '#334155' }}>
              La tua richiesta di tesseramento è stata registrata con successo nel libro soci dell'associazione.
            </p>
          </div>

          {/* Badge Stato da Saldare */}
          <div className="p-5 rounded-2xl bg-amber-50 border-2 border-amber-300 text-left space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-amber-950 flex items-center gap-1.5" style={{ color: '#78350f' }}>
                <Clock className="w-4 h-4 text-amber-700" /> Stato Tesseramento:
              </span>
              <span className="text-xs font-black px-3 py-1 rounded-full bg-amber-200 text-amber-950 border border-amber-400">
                DA SALDARE (€{submittedClient.quotaTesseramento})
              </span>
            </div>
            <p className="text-xs sm:text-sm text-amber-900 leading-relaxed" style={{ color: '#78350f' }}>
              La quota associativa annuale di <strong>€{submittedClient.quotaTesseramento},00</strong> potrà essere saldata al tuo primo arrivo in sala prove per il ritiro della tessera socio.
            </p>
          </div>

          {/* Riepilogo Dati Registrati */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-left space-y-2 text-sm">
            <p className="text-slate-500 font-bold uppercase text-xs tracking-wider mb-2">
              Riepilogo Dati Trasmessi:
            </p>
            <p><strong className="text-slate-900" style={{ color: '#0f172a' }}>Nominativo:</strong> <span className="text-slate-800 font-medium" style={{ color: '#1e293b' }}>{submittedClient.nome} {submittedClient.cognome}</span></p>
            <p><strong className="text-slate-900" style={{ color: '#0f172a' }}>Codice Fiscale:</strong> <span className="font-mono text-slate-800 font-bold" style={{ color: '#1e293b' }}>{submittedClient.codiceFiscale}</span></p>
            <p><strong className="text-slate-900" style={{ color: '#0f172a' }}>Residenza:</strong> <span className="text-slate-800 font-medium" style={{ color: '#1e293b' }}>{submittedClient.residenza}</span></p>
            {submittedClient.telefono && <p><strong className="text-slate-900" style={{ color: '#0f172a' }}>Telefono:</strong> <span className="text-slate-800 font-medium" style={{ color: '#1e293b' }}>{submittedClient.telefono}</span></p>}
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={handleResetForm}
              className="w-full py-3.5 px-5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm transition-all shadow-md cursor-pointer"
            >
              Invia un'altra Registrazione
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-between" style={{ backgroundColor: '#f1f5f9' }}>
      {/* Top Banner Header: Dark Navy per il massimo contrasto con il brand */}
      <header className="bg-slate-950 border-b border-slate-800 py-3.5 px-4 sticky top-0 z-30 shadow-md" style={{ backgroundColor: '#020617' }}>
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-white overflow-hidden shadow-xs border border-white flex items-center justify-center p-1 shrink-0">
              <img src="/logo-header.png" alt="Logo" className="w-full h-full object-contain rounded-lg" />
            </div>
            <div>
              <h1 className="text-sm sm:text-base font-black text-white uppercase tracking-tight" style={{ color: '#ffffff' }}>
                Modulo Iscrizione & Tesseramento
              </h1>
              <p className="text-xs text-amber-400 font-bold" style={{ color: '#fbbf24' }}>
                Associazione Musicale • Scuola di Musica & Sala Prove
              </p>
            </div>
          </div>
          <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-slate-800 text-slate-200 border border-slate-700 flex items-center gap-1.5 shrink-0" style={{ color: '#e2e8f0', backgroundColor: '#1e293b' }}>
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span className="hidden sm:inline">Registro Ufficiale</span>
          </span>
        </div>
      </header>

      {/* Main Form Container */}
      <main className="max-w-3xl w-full mx-auto p-4 sm:p-6 my-4 flex-1">
        <div className="bg-white rounded-3xl shadow-2xl border-2 border-slate-200 overflow-hidden" style={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0' }}>
          {/* Card Title Box (Google Forms Style Top Header con gradiente vivido) */}
          <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-800 p-7 sm:p-9 text-white space-y-3" style={{ background: 'linear-gradient(135deg, #1d4ed8 0%, #4338ca 50%, #6b21a8 100%)' }}>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 text-white text-xs font-black uppercase tracking-wider">
              <Sparkles className="w-4 h-4 text-yellow-300" />
              <span>Iscrizione Socio / Musicista</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight leading-tight" style={{ color: '#ffffff' }}>
              Domanda di Tesseramento e Ammissione a Socio
            </h2>
            <p className="text-sm sm:text-base text-blue-100 leading-relaxed max-w-2xl font-normal" style={{ color: '#dbeafe' }}>
              Compila il modulo sottostante con i tuoi dati anagrafici esatti (corrispondenti ai 17 campi del registro tesserati dell'ente). Una volta inviato sarai registrato automaticamente nel nostro gestionale con stato <strong>"da saldare"</strong>.
            </p>
          </div>

          {errorMsg && (
            <div className="m-6 p-4 rounded-xl bg-rose-50 border-2 border-rose-300 text-rose-900 text-sm font-bold flex items-start gap-3">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-600 shrink-0 mt-1.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="p-6 sm:p-10 space-y-8 bg-white" style={{ backgroundColor: '#ffffff' }}>
            {/* Sezione 1: Dati Personali */}
            <div className="space-y-5">
              <div className="flex items-center gap-2 pb-2.5 border-b-2 border-slate-200">
                <User className="w-5 h-5 text-blue-600" />
                <h3 style={sectionHeaderStyle}>
                  1. Dati Anagrafici del Tesserato
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block mb-2" style={labelStyle}>
                    Nome *
                  </label>
                  <input
                    type="text"
                    required
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Es. Mario"
                    style={inputStyle}
                    className="w-full px-4 py-3 rounded-xl focus:border-blue-600 focus:ring-4 focus:ring-blue-100 focus:outline-none transition-all placeholder:text-slate-400"
                  />
                </div>

                <div>
                  <label className="block mb-2" style={labelStyle}>
                    Cognome *
                  </label>
                  <input
                    type="text"
                    required
                    value={cognome}
                    onChange={(e) => setCognome(e.target.value)}
                    placeholder="Es. Rossi"
                    style={inputStyle}
                    className="w-full px-4 py-3 rounded-xl focus:border-blue-600 focus:ring-4 focus:ring-blue-100 focus:outline-none transition-all placeholder:text-slate-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                <div className="sm:col-span-2">
                  <label className="block mb-2" style={labelStyle}>
                    Codice Fiscale (16 caratteri) *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={16}
                    value={codiceFiscale}
                    onChange={(e) => setCodiceFiscale(e.target.value.toUpperCase())}
                    placeholder="RSSMRA85M01H501Z"
                    style={inputStyle}
                    className="w-full px-4 py-3 rounded-xl font-mono uppercase tracking-wider focus:border-blue-600 focus:ring-4 focus:ring-blue-100 focus:outline-none transition-all placeholder:text-slate-400"
                  />
                </div>

                <div>
                  <label className="block mb-2" style={labelStyle}>
                    Sesso *
                  </label>
                  <select
                    value={sesso}
                    onChange={(e) => setSesso(e.target.value as 'M' | 'F')}
                    style={inputStyle}
                    className="w-full px-4 py-3 rounded-xl focus:border-blue-600 focus:ring-4 focus:ring-blue-100 focus:outline-none transition-all cursor-pointer"
                  >
                    <option value="M" style={{ color: '#0f172a', backgroundColor: '#ffffff' }}>Maschio (M)</option>
                    <option value="F" style={{ color: '#0f172a', backgroundColor: '#ffffff' }}>Femmina (F)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block mb-2 flex items-center gap-1.5" style={labelStyle}>
                    <Calendar className="w-4 h-4 text-blue-600" />
                    Data di Nascita *
                  </label>
                  <input
                    type="date"
                    required
                    value={dataNascita}
                    onChange={(e) => setDataNascita(e.target.value)}
                    style={inputStyle}
                    className="w-full px-4 py-3 rounded-xl focus:border-blue-600 focus:ring-4 focus:ring-blue-100 focus:outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block mb-2" style={labelStyle}>
                    Comune o Luogo di Nascita *
                  </label>
                  <input
                    type="text"
                    required
                    value={luogoNascita}
                    onChange={(e) => setLuogoNascita(e.target.value)}
                    placeholder="Es. Roma"
                    style={inputStyle}
                    className="w-full px-4 py-3 rounded-xl focus:border-blue-600 focus:ring-4 focus:ring-blue-100 focus:outline-none transition-all placeholder:text-slate-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block mb-2" style={labelStyle}>
                    Nazione di Nascita
                  </label>
                  <input
                    type="text"
                    value={nazioneNascita}
                    onChange={(e) => setNazioneNascita(e.target.value)}
                    style={inputStyle}
                    className="w-full px-4 py-3 rounded-xl focus:border-blue-600 focus:ring-4 focus:ring-blue-100 focus:outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block mb-2" style={labelStyle}>
                    Nazione di Cittadinanza
                  </label>
                  <input
                    type="text"
                    value={nazioneCittadinanza}
                    onChange={(e) => setNazioneCittadinanza(e.target.value)}
                    style={inputStyle}
                    className="w-full px-4 py-3 rounded-xl focus:border-blue-600 focus:ring-4 focus:ring-blue-100 focus:outline-none transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Sezione 2: Residenza e Contatti */}
            <div className="space-y-5 pt-4">
              <div className="flex items-center gap-2 pb-2.5 border-b-2 border-slate-200">
                <MapPin className="w-5 h-5 text-blue-600" />
                <h3 style={sectionHeaderStyle}>
                  2. Residenza e Recapiti
                </h3>
              </div>

              <div>
                <label className="block mb-2" style={labelStyle}>
                  Indirizzo di Residenza (Via/Piazza e Civico) *
                </label>
                <input
                  type="text"
                  required
                  value={indirizzoResidenza}
                  onChange={(e) => setIndirizzoResidenza(e.target.value)}
                  placeholder="Es. Via dei Musicisti 12"
                  style={inputStyle}
                  className="w-full px-4 py-3 rounded-xl focus:border-blue-600 focus:ring-4 focus:ring-blue-100 focus:outline-none transition-all placeholder:text-slate-400"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block mb-2" style={labelStyle}>
                    Comune di Residenza *
                  </label>
                  <input
                    type="text"
                    required
                    value={comuneResidenza}
                    onChange={(e) => setComuneResidenza(e.target.value)}
                    placeholder="Es. Milano"
                    style={inputStyle}
                    className="w-full px-4 py-3 rounded-xl focus:border-blue-600 focus:ring-4 focus:ring-blue-100 focus:outline-none transition-all placeholder:text-slate-400"
                  />
                </div>

                <div>
                  <label className="block mb-2" style={labelStyle}>
                    CAP *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={5}
                    value={capResidenza}
                    onChange={(e) => setCapResidenza(e.target.value)}
                    placeholder="Es. 20100"
                    style={inputStyle}
                    className="w-full px-4 py-3 rounded-xl focus:border-blue-600 focus:ring-4 focus:ring-blue-100 focus:outline-none transition-all placeholder:text-slate-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block mb-2 flex items-center gap-1.5" style={labelStyle}>
                    <Phone className="w-4 h-4 text-blue-600" />
                    Telefono / Cellulare *
                  </label>
                  <input
                    type="tel"
                    required
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    placeholder="Es. +39 347 1234567"
                    style={inputStyle}
                    className="w-full px-4 py-3 rounded-xl focus:border-blue-600 focus:ring-4 focus:ring-blue-100 focus:outline-none transition-all placeholder:text-slate-400"
                  />
                </div>

                <div>
                  <label className="block mb-2 flex items-center gap-1.5" style={labelStyle}>
                    <Mail className="w-4 h-4 text-blue-600" />
                    Indirizzo Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nome@email.it"
                    style={inputStyle}
                    className="w-full px-4 py-3 rounded-xl focus:border-blue-600 focus:ring-4 focus:ring-blue-100 focus:outline-none transition-all placeholder:text-slate-400"
                  />
                </div>
              </div>
            </div>

            {/* Sezione 3: Attività Musicale */}
            <div className="space-y-5 pt-4">
              <div className="flex items-center gap-2 pb-2.5 border-b-2 border-slate-200">
                <Music2 className="w-5 h-5 text-blue-600" />
                <h3 style={sectionHeaderStyle}>
                  3. Attività Musicale & Band
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block mb-2" style={labelStyle}>
                    Discipline / Strumenti Praticati *
                  </label>
                  <input
                    type="text"
                    required
                    value={discipline}
                    onChange={(e) => setDiscipline(e.target.value)}
                    placeholder="Es. Batteria, Chitarra, Canto, Basso, ecc."
                    style={inputStyle}
                    className="w-full px-4 py-3 rounded-xl focus:border-blue-600 focus:ring-4 focus:ring-blue-100 focus:outline-none transition-all placeholder:text-slate-400"
                  />
                </div>

                <div>
                  <label className="block mb-2" style={labelStyle}>
                    Nome Band o Gruppo Musicale (se presente)
                  </label>
                  <input
                    type="text"
                    value={gruppoBand}
                    onChange={(e) => setGruppoBand(e.target.value)}
                    placeholder="Es. The Velvet Echoes"
                    style={inputStyle}
                    className="w-full px-4 py-3 rounded-xl focus:border-blue-600 focus:ring-4 focus:ring-blue-100 focus:outline-none transition-all placeholder:text-slate-400"
                  />
                </div>
              </div>
            </div>

            {/* Consenso & Quota */}
            <div className="p-5 rounded-2xl bg-slate-50 border-2 border-slate-200 space-y-3" style={{ backgroundColor: '#f8fafc', borderColor: '#e2e8f0' }}>
              <div className="flex items-start gap-3.5">
                <input
                  type="checkbox"
                  id="accettaRegolamento"
                  checked={accettaRegolamento}
                  onChange={(e) => setAccettaRegolamento(e.target.checked)}
                  className="mt-1 w-5 h-5 rounded border-2 border-slate-400 text-blue-600 focus:ring-blue-500 cursor-pointer shrink-0"
                />
                <label htmlFor="accettaRegolamento" className="text-sm text-slate-800 cursor-pointer leading-relaxed font-medium" style={{ color: '#1e293b' }}>
                  Dichiaro di aver preso visione dello <strong>Statuto e del Regolamento interno dell'Associazione</strong> e chiedo di essere ammesso in qualità di <strong>Socio Ordinario</strong>. Prendo atto che la quota associativa annuale di <strong>€15,00</strong> sarà registrata con stato <strong>"da saldare"</strong> e versata al primo accesso in sede.
                </label>
              </div>
            </div>

            {/* Pulsante Invio */}
            <button
              type="submit"
              disabled={isSubmitting}
              style={{ backgroundColor: '#2563eb', color: '#ffffff' }}
              className="w-full py-4 px-6 rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-[0.99] disabled:opacity-50 text-white font-black text-base sm:text-lg shadow-xl shadow-blue-500/30 transition-all flex items-center justify-center gap-3 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <span className="w-5 h-5 border-3 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Invio Registrazione in corso...</span>
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  <span>Invia Domanda di Tesseramento</span>
                </>
              )}
            </button>
          </form>
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center py-5 px-4 text-xs font-semibold text-slate-600 border-t border-slate-200" style={{ color: '#475569', backgroundColor: '#e2e8f0' }}>
        Gestionale Sala Prove • Sistema Ufficiale di Registrazione Tesserati & Prenotazioni
      </footer>
    </div>
  );
};
