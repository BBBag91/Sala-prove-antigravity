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
  ShieldAlert,
  Send,
  Sparkles,
  ArrowRight,
  Clock,
  Building2,
  Check,
  Lock,
  FileText,
  X,
  AlertTriangle,
} from 'lucide-react';
import { Client } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { supabaseService } from '../services/supabaseService';
import {
  sanitizeInput,
  validateCodiceFiscale,
  validateEmail,
  sanitizePhoneNumber,
  isHoneypotTriggered,
  formSubmitRateLimiter,
} from '../utils/security';

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
  const [accettaPrivacyGdpr, setAccettaPrivacyGdpr] = useState(true);

  // Enterprise Security States
  const [honeypot, setHoneypot] = useState(''); // Anti-Bot Honeypot Trap
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submittedClient, setSubmittedClient] = useState<Client | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    // 1. Anti-Bot / Anti-Scraper Honeypot Check
    if (isHoneypotTriggered(honeypot)) {
      console.warn('[SECURITY] Bot o scraper automatizzato intercettato tramite Honeypot. Invio scartato.');
      setIsSuccess(true);
      return;
    }

    // 2. Anti-Flooding Rate Limiting
    const rateCheck = formSubmitRateLimiter.check('public_membership_form');
    if (!rateCheck.isAllowed) {
      setErrorMsg(`Troppe richieste inviate in rapida successione. Attendi ${rateCheck.remainingLockoutSeconds} secondi prima di riprovare.`);
      return;
    }

    // 3. Validazione Formale Codice Fiscale (GDPR Data Accuracy - Art. 5.1d)
    const cfValidation = validateCodiceFiscale(codiceFiscale);
    if (!cfValidation.isValid) {
      setErrorMsg(cfValidation.error || 'Codice Fiscale non valido.');
      return;
    }
    const cleanCf = cfValidation.normalized;

    // 4. Validazione Email (se fornita)
    if (email) {
      const emailValidation = validateEmail(email);
      if (!emailValidation.isValid) {
        setErrorMsg('Indirizzo Email non valido. Inserisci un formato corretto (es. nome@dominio.it).');
        return;
      }
    }

    // 5. Consenso GDPR e Regolamento obbligatori
    if (!accettaRegolamento) {
      setErrorMsg('È necessario accettare lo Statuto e il Regolamento dell\'Associazione per completare il tesseramento.');
      return;
    }

    if (!accettaPrivacyGdpr) {
      setErrorMsg('È obbligatorio confermare il consenso al trattamento dei dati personali ai sensi del GDPR (UE 2016/679).');
      return;
    }

    // 6. Sanitizzazione XSS di tutti i campi testuali
    const safeNome = sanitizeInput(nome).toUpperCase();
    const safeCognome = sanitizeInput(cognome).toUpperCase();
    const safeLuogoNascita = sanitizeInput(luogoNascita).toUpperCase();
    const safeIndirizzo = sanitizeInput(indirizzoResidenza).toUpperCase();
    const safeCap = sanitizeInput(capResidenza);
    const safeComune = sanitizeInput(comuneResidenza).toUpperCase();
    const safeTelefono = sanitizePhoneNumber(telefono);
    const safeEmail = sanitizeInput(email).toLowerCase();
    const safeDiscipline = sanitizeInput(discipline);
    const safeBand = sanitizeInput(gruppoBand);
    const safeNazioneNascita = sanitizeInput(nazioneNascita) || 'Italia';
    const safeNazioneCittadinanza = sanitizeInput(nazioneCittadinanza) || 'Italia';

    if (!safeNome || !safeCognome) {
      setErrorMsg('Nome e Cognome sono campi obbligatori.');
      return;
    }

    setIsSubmitting(true);

    try {
      const todayISO = new Date().toISOString().split('T')[0];
      const todayDate = new Date();
      const currentYear = todayDate.getFullYear();
      const nextYear = new Date(todayDate);
      nextYear.setFullYear(currentYear + 1);
      const scadenzaISO = nextYear.toISOString().split('T')[0];

      // Formatta la residenza completa (es. "VIA COLLE D'ALBA DI PONENTE 852, 04016 SABAUDIA")
      const fullResidenza = `${safeIndirizzo}, ${safeCap} ${safeComune}`.trim();

      // Calcola il numero progressivo tessera interrogando Supabase per evitare duplicati
      let nextProg = 1;
      if (isSupabaseConfigured() && supabase) {
        try {
          const { data: dbClients, error: fetchErr } = await supabase
            .from('clients')
            .select('numero_tessera, created_at');
          if (!fetchErr && dbClients && dbClients.length > 0) {
            let maxProg = 0;
            for (const c of dbClients) {
              const match = c.numero_tessera?.match(new RegExp(`TS-${currentYear}-(\\d+)`));
              if (match) {
                const num = parseInt(match[1], 10);
                if (!isNaN(num) && num > maxProg) maxProg = num;
              }
            }
            nextProg = Math.max(maxProg + 1, dbClients.length + 1);
          }
        } catch (dbErr) {
          console.warn('[PublicForm] Impossibile recuperare progressivo da Supabase, fallback a localStorage:', dbErr);
        }
      }

      if (nextProg === 1) {
        try {
          const stored = localStorage.getItem('salaprove_clients_v1');
          if (stored) {
            const currentClients = JSON.parse(stored);
            if (Array.isArray(currentClients) && currentClients.length > 0) {
              let maxProgLocal = 0;
              for (const c of currentClients) {
                const match = c.numeroTessera?.match(new RegExp(`TS-${currentYear}-(\\d+)`));
                if (match) {
                  const num = parseInt(match[1], 10);
                  if (!isNaN(num) && num > maxProgLocal) maxProgLocal = num;
                }
              }
              nextProg = Math.max(maxProgLocal + 1, currentClients.length + 1);
            }
          }
        } catch {}
      }

      const numeroTessera = `TS-${currentYear}-${String(nextProg).padStart(3, '0')}`;

      // Salva parti di residenza nelle note per l'export a 17 colonne dell'ente
      const residenzaMetadata = JSON.stringify({
        indirizzo: safeIndirizzo,
        cap: safeCap,
        comune: safeComune,
        nazioneNascita: safeNazioneNascita,
        nazioneCittadinanza: safeNazioneCittadinanza,
        discipline: safeDiscipline,
      });

      const newClient: Client = {
        id: `cli-${Date.now()}`,
        nome: safeNome,
        cognome: safeCognome,
        codiceFiscale: cleanCf,
        sesso,
        dataNascita,
        luogoNascita: safeLuogoNascita,
        residenza: fullResidenza,
        telefono: safeTelefono,
        email: safeEmail,
        statoTesseramento: 'attivo',
        numeroTessera,
        dataTesseramento: todayISO,
        dataScadenzaTesseramento: scadenzaISO,
        quotaTesseramento: 10,
        // Quota da saldare come richiesto dall'utente per registrazione online
        statoQuota: 'da_saldare',
        quotaPagata: false,
        descrizioneStrumentazione: safeDiscipline,
        gruppoBand: safeBand || undefined,
        note: `Iscrizione inviata online via modulo il ${new Date().toLocaleDateString('it-IT')} ore ${new Date().toLocaleTimeString('it-IT')}. [QUOTA_PAGAMENTO:da_saldare] [META_RESIDENZA:${residenzaMetadata}]`,
      };

      // 1. Salva direttamente su Supabase Cloud (con gestione fallback e schema cache)
      if (isSupabaseConfigured()) {
        const res = await supabaseService.upsertClient(newClient);
        if (res?.error) {
          console.error('[PublicForm] Errore salvataggio Supabase client:', res.error);
          throw new Error(`Errore durante il salvataggio sul database: ${res.error.message || 'Errore database'}`);
        }
      }

      // 2. Salva in localStorage locale
      try {
        const stored = localStorage.getItem('salaprove_clients_v1');
        const currentClients: Client[] = stored ? JSON.parse(stored) : [];
        const exists = currentClients.some((c) => c.id === newClient.id || c.codiceFiscale === newClient.codiceFiscale);
        const updatedClients = exists
          ? currentClients.map((c) => (c.codiceFiscale === newClient.codiceFiscale ? newClient : c))
          : [...currentClients, newClient];
        localStorage.setItem('salaprove_clients_v1', JSON.stringify(updatedClients));
      } catch (err) {
        console.warn('Errore salvataggio localStorage client:', err);
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
                DA SALDARE (€{submittedClient.quotaTesseramento || 10})
              </span>
            </div>
            <p className="text-xs sm:text-sm text-amber-900 leading-relaxed" style={{ color: '#78350f' }}>
              La quota associativa annuale di <strong>€{submittedClient.quotaTesseramento || 10},00</strong> potrà essere saldata al tuo primo arrivo in sala prove per il ritiro della tessera socio.
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

          {/* Anti-Phishing & Official Security Verification Banner */}
          <div className="bg-emerald-950/20 border-b-2 border-emerald-500/30 p-3.5 px-6 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-emerald-800 font-bold">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Canale Ufficiale Verificato • Crittografia TLS 256-bit • Conforme GDPR (UE 2016/679)</span>
            </div>
            <span className="text-[11px] text-slate-500 font-medium">
              🔒 I tuoi dati personali sono protetti e non saranno mai ceduti a terzi.
            </span>
          </div>

          <div className="mx-6 mt-4 p-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
            <span>
              <strong>Avviso di Sicurezza Anti-Phishing:</strong> Questo è l'unico portale ufficiale di iscrizione. Non ti verrà mai richiesto di inserire password, coordinate bancarie o PIN su questa pagina. La quota di 10€ viene saldata unicamente di persona in sede.
            </span>
          </div>

          {errorMsg && (
            <div className="m-6 p-4 rounded-xl bg-rose-50 border-2 border-rose-300 text-rose-900 text-sm font-bold flex items-start gap-3">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-600 shrink-0 mt-1.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="p-6 sm:p-10 space-y-8 bg-white" style={{ backgroundColor: '#ffffff' }}>
            {/* Anti-Bot Honeypot Trap (Invisibile agli utenti umani) */}
            <input
              type="text"
              name="b_security_honeypot_field"
              value={honeypot}
              onChange={(e) => setHoneypot(e.target.value)}
              tabIndex={-1}
              autoComplete="off"
              style={{ display: 'none', position: 'absolute', opacity: 0, pointerEvents: 'none' }}
              aria-hidden="true"
            />

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

            {/* Consenso & Quota & GDPR Compliance (UE 2016/679) */}
            <div className="p-5 rounded-2xl bg-slate-50 border-2 border-slate-200 space-y-4" style={{ backgroundColor: '#f8fafc', borderColor: '#e2e8f0' }}>
              <div className="flex items-start gap-3.5">
                <input
                  type="checkbox"
                  id="accettaRegolamento"
                  checked={accettaRegolamento}
                  onChange={(e) => setAccettaRegolamento(e.target.checked)}
                  className="mt-1 w-5 h-5 rounded border-2 border-slate-400 text-blue-600 focus:ring-blue-500 cursor-pointer shrink-0"
                />
                <label htmlFor="accettaRegolamento" className="text-sm text-slate-800 cursor-pointer leading-relaxed font-medium" style={{ color: '#1e293b' }}>
                  Dichiaro di aver preso visione dello <strong>Statuto e del Regolamento interno dell'Associazione</strong> e chiedo di essere ammesso in qualità di <strong>Socio Ordinario</strong>. Prendo atto che la quota associativa annuale di <strong>€10,00</strong> sarà registrata con stato <strong>"da saldare"</strong> e versata al primo accesso in sede.
                </label>
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-start gap-3.5">
                <input
                  type="checkbox"
                  id="accettaPrivacyGdpr"
                  checked={accettaPrivacyGdpr}
                  onChange={(e) => setAccettaPrivacyGdpr(e.target.checked)}
                  className="mt-1 w-5 h-5 rounded border-2 border-slate-400 text-blue-600 focus:ring-blue-500 cursor-pointer shrink-0"
                />
                <div className="text-sm text-slate-800 leading-relaxed font-medium" style={{ color: '#1e293b' }}>
                  <label htmlFor="accettaPrivacyGdpr" className="cursor-pointer">
                    <strong>Informativa Privacy e Protezione Dati (GDPR UE 2016/679):</strong>{' '}
                    Dichiaro di aver preso visione dell'informativa ai sensi degli artt. 13 e 14 del Regolamento Europeo 2016/679 e acconsento al trattamento dei dati personali forniti per le finalità connesse al tesseramento, all'inserimento nel Libro Soci e alla copertura assicurativa associativa.
                  </label>{' '}
                  <button
                    type="button"
                    onClick={() => setShowPrivacyModal(true)}
                    className="text-blue-600 hover:text-blue-800 font-bold underline inline-flex items-center gap-1 cursor-pointer ml-1"
                  >
                    <FileText className="w-3.5 h-3.5" /> Leggi Informativa Completa
                  </button>
                </div>
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
                  <span>Invio Registrazione Protetta in corso...</span>
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

      {/* Footer con Note Legali e Crittografia */}
      <footer className="text-center py-5 px-4 text-xs font-semibold text-slate-600 border-t border-slate-200 space-y-1" style={{ color: '#475569', backgroundColor: '#e2e8f0' }}>
        <p>Gestionale Sala Prove • Sistema Ufficiale di Registrazione Tesserati & Prenotazioni</p>
        <p className="text-[11px] text-slate-500">
          Protetto da crittografia end-to-end TLS 256-bit • Conformità Privacy GDPR (UE 2016/679) • Row Level Security Database
        </p>
      </footer>

      {/* Modale Dettagliato Informativa Privacy GDPR (UE 2016/679) */}
      {showPrivacyModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[88vh] overflow-hidden flex flex-col shadow-2xl border-2 border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-900 text-white">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <h3 className="font-extrabold text-base tracking-tight">
                  Informativa Trattamento Dati Personali (GDPR UE 2016/679)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowPrivacyModal(false)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center cursor-pointer transition-colors"
                title="Chiudi informativa"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-700 leading-relaxed custom-scrollbar">
              <div>
                <h4 className="font-bold text-slate-900 text-sm mb-1">1. Titolare del Trattamento</h4>
                <p>
                  Il Titolare del trattamento dei dati è l'Associazione Culturale Musicale "La musica fa...", con sede legale operativa presso lo Studio & Sala Prove.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 text-sm mb-1">2. Finalità del Trattamento & Base Giuridica</h4>
                <p>
                  I dati anagrafici, fiscali e di recapito raccolti tramite il presente modulo sono trattati esclusivamente per:
                </p>
                <ul className="list-disc pl-5 mt-1 space-y-1">
                  <li>Iscrizione e tenuta del Libro Soci dell'Associazione ai sensi del Codice Civile e del Codice del Terzo Settore (D.Lgs. 117/2017).</li>
                  <li>Emissione della tessera socio annuale e attivazione della copertura assicurativa obbligatoria.</li>
                  <li>Gestione delle prenotazioni delle sale prove, accesso ai corsi musicali e comunicazioni istituzionali dell'Associazione.</li>
                </ul>
                <p className="mt-1 text-slate-500 italic">
                  Base giuridica: esecuzione del rapporto associativo statutario e adempimento di obblighi di legge (Art. 6.1 lett. b e c GDPR).
                </p>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 text-sm mb-1">3. Categorie di Dati e Minimizzazione</h4>
                <p>
                  Sono raccolti unicamente i dati necessari e proporzionati alle finalità associative: Nome, Cognome, Codice Fiscale, Sesso, Data e Luogo di Nascita, Indirizzo di Residenza, Telefono, Email e Discipline musicali (principio di minimizzazione dei dati - Art. 5.1 lett. c GDPR). Nessun dato sensibile relativo alla salute o giudiziario viene richiesto.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 text-sm mb-1">4. Modalità di Trattamento e Sicurezza dei Dati</h4>
                <p>
                  Il trattamento viene svolto con strumenti elettronici protetti da crittografia end-to-end TLS/HTTPS, Row Level Security su database isolato e accessi controllati riservati al personale autorizzato. I dati non vengono ceduti a terzi per scopi commerciali o di profilazione.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 text-sm mb-1">5. Periodo di Conservazione</h4>
                <p>
                  I dati saranno conservati per tutta la durata del vincolo associativo e, successivamente al recesso o decadenza, per il periodo prescritto dalle normative contabili, fiscali e di legge (10 anni).
                </p>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 text-sm mb-1">6. Diritti dell'Interessato (Artt. 15-22 GDPR)</h4>
                <p>
                  In qualsiasi momento l'interessato ha il diritto di richiedere l'accesso ai propri dati, la rettifica, la cancellazione (diritto all'oblio), la limitazione del trattamento o la portabilità, inviando una comunicazione all'indirizzo email dell'Associazione o presentandosi di persona presso la segreteria.
                </p>
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setShowPrivacyModal(false)}
                className="py-2.5 px-6 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-colors cursor-pointer"
              >
                Ho Compreso e Accetto
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
