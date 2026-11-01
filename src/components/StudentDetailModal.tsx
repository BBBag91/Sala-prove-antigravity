import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  User,
  GraduationCap,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Phone,
  Mail,
  MessageSquare,
  Printer,
  Download,
  DollarSign,
  ChevronLeft,
  ChevronRight,
  Plus,
  BookOpen,
  Music,
  MapPin,
  Check,
  Save,
  CreditCard,
  FileText,
} from 'lucide-react';
import { Client, Booking, isLessonBooking, StudentMonthlyPayment, StudentPaymentStatus, PaymentMethod } from '../types';
import { useApp } from '../context/AppContext';
import { studentPaymentService } from '../services/studentPaymentService';
import {
  MESI_ITALIANI,
  formatDateItalian,
  formatDateToISO,
  formatCurrency,
  timeToMinutes,
} from '../utils/dateUtils';
import { generateStudentDossierPdf } from '../utils/studentPdfGenerator';

interface StudentDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: Client | null;
  initialMonthStr?: string;
  onOpenBookingModalForStudent?: (student: Client) => void;
}

export const StudentDetailModal: React.FC<StudentDetailModalProps> = ({
  isOpen,
  onClose,
  student,
  initialMonthStr,
  onOpenBookingModalForStudent,
}) => {
  const { studioInfo, bookings, staff, rooms, updateClient } = useApp();

  // Mese selezionato per il resoconto
  const today = useMemo(() => new Date(), []);
  const todayISO = formatDateToISO(today);
  const nowMinutes = today.getHours() * 60 + today.getMinutes();

  const [currentDate, setCurrentDate] = useState<Date>(() => {
    if (initialMonthStr) {
      const [y, m] = initialMonthStr.split('-');
      return new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1);
    }
    return new Date(2026, 9, 1); // Ottobre 2026
  });

  const monthStr = useMemo(() => {
    const y = currentDate.getFullYear();
    const m = String(currentDate.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }, [currentDate]);

  const monthName = MESI_ITALIANI[currentDate.getMonth()];
  const currentYear = currentDate.getFullYear();

  // Tab attivo nel modal
  const [activeTab, setActiveTab] = useState<'lezioni' | 'pagamento' | 'anagrafica'>('lezioni');

  // Stato pagamento corrente per il mese selezionato
  const [paymentRecord, setPaymentRecord] = useState<StudentMonthlyPayment | null>(null);

  // Form stato pagamento
  const [formStato, setFormStato] = useState<StudentPaymentStatus>('da_saldare');
  const [formDataPagamento, setFormDataPagamento] = useState<string>(todayISO);
  const [formImporto, setFormImporto] = useState<number>(student?.quotaMensileCorso || 90);
  const [formMetodo, setFormMetodo] = useState<PaymentMethod>('bonifico');
  const [formRicevuta, setFormRicevuta] = useState<string>('');
  const [formNote, setFormNote] = useState<string>('');
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  // Caricamento del pagamento per l'allievo nel mese
  const loadPayment = () => {
    if (!student) return;
    const fullName = `${student.nome} ${student.cognome}`.trim();
    const p = studentPaymentService.getPayment(student.id, monthStr, fullName);
    setPaymentRecord(p);
    if (p) {
      setFormStato(p.stato);
      setFormDataPagamento(p.dataPagamento || `${monthStr}-05`);
      setFormImporto(p.importo !== undefined ? p.importo : (student.quotaMensileCorso || 90));
      setFormMetodo(p.metodoPagamento || 'bonifico');
      setFormRicevuta(p.ricevutaNumero || '');
      setFormNote(p.note || '');
    } else {
      setFormStato('da_saldare');
      setFormDataPagamento(`${monthStr}-05`);
      setFormImporto(student.quotaMensileCorso || 90);
      setFormMetodo('bonifico');
      setFormRicevuta('');
      setFormNote('');
    }
  };

  useEffect(() => {
    loadPayment();
  }, [student, monthStr]);

  // Listener per aggiornamenti esterni dei pagamenti
  useEffect(() => {
    const handleUpdated = () => {
      loadPayment();
    };
    window.addEventListener('student-payments-updated', handleUpdated);
    return () => window.removeEventListener('student-payments-updated', handleUpdated);
  }, [student, monthStr]);

  // Navigazione Mese
  const handlePrevMonth = () => {
    setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  };
  const handleNextMonth = () => {
    setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  };
  const handleGoCurrentMonth = () => {
    setCurrentDate(today);
  };

  // Lezioni dell'allievo estratte direttamente da tutte le lezioni a calendario
  const allStudentLessons = useMemo(() => {
    if (!student) return [];
    const fullName = `${student.nome} ${student.cognome}`.trim().toLowerCase();
    const sNameOnly = student.nome.toLowerCase().trim();

    return bookings
      .filter((b) => {
        const isLes = isLessonBooking(b) || b.tipo === 'lezione' || Boolean(b.insegnanteId) || Boolean(b.insegnanteNome);
        if (!isLes) return false;
        let matchStudent = false;
        if (b.clienteId && student.id && (b.clienteId === student.id || student.id.startsWith(b.clienteId))) {
          matchStudent = true;
        } else {
          let bName = (b.clienteNome || '').toLowerCase().trim();
          if (bName.endsWith(' chita')) bName = bName.slice(0, -6).trim();
          if (bName.endsWith(' chitarra')) bName = bName.slice(0, -9).trim();
          if (bName.endsWith(' batteria')) bName = bName.slice(0, -9).trim();
          if (bName && (bName === fullName || fullName.includes(bName) || bName.includes(fullName) || bName.includes(sNameOnly) || sNameOnly === bName)) {
            matchStudent = true;
          }
        }
        if (!matchStudent) return false;

        // Se lo studente nel resoconto appartiene a un docente specifico, mostra ESCLUSIVAMENTE le lezioni di quel docente
        if (student.insegnanteRiferimentoId) {
          const matchTId = b.insegnanteId === student.insegnanteRiferimentoId;
          const matchTName = Boolean(
            student.insegnanteRiferimentoNome &&
            (b.insegnanteNome || '').toLowerCase().trim() === student.insegnanteRiferimentoNome.toLowerCase().trim()
          );
          if (!matchTId && !matchTName) return false;
        }

        return true;
      })
      .sort((a, b) => {
        const d = a.data.localeCompare(b.data);
        if (d !== 0) return d;
        return a.oraInizio.localeCompare(b.oraInizio);
      });
  }, [bookings, student]);

  // Lezioni del mese selezionato
  const monthlyLessons = useMemo(() => {
    return allStudentLessons.filter((b) => b.data.startsWith(monthStr));
  }, [allStudentLessons, monthStr]);

  // Verifica se una lezione è già stata svolta
  const isLessonCompleted = (b: Booking): boolean => {
    if (b.data < todayISO) return true;
    if (b.data === todayISO) {
      const endMin = timeToMinutes(b.oraFine || b.oraInizio);
      return nowMinutes >= endMin;
    }
    return false;
  };

  const completedLessons = useMemo(() => {
    return monthlyLessons.filter(isLessonCompleted);
  }, [monthlyLessons, todayISO, nowMinutes]);

  const upcomingLessons = useMemo(() => {
    return monthlyLessons.filter((b) => !isLessonCompleted(b));
  }, [monthlyLessons, todayISO, nowMinutes]);

  const totalMonthlyHours = useMemo(() => {
    return monthlyLessons.reduce((sum, b) => sum + (b.durataOre || 1), 0);
  }, [monthlyLessons]);

  const completedMonthlyHours = useMemo(() => {
    return completedLessons.reduce((sum, b) => sum + (b.durataOre || 1), 0);
  }, [completedLessons]);

  // Salvataggio del pagamento del mese
  const handleSavePayment = (e: React.FormEvent) => {
    e.preventDefault();
    const fullName = `${student.nome} ${student.cognome}`.trim();
    const now = new Date();
    const nowTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const newRecord: StudentMonthlyPayment = {
      id: `${student.id}_${monthStr}`,
      clienteId: student.id,
      clienteNome: fullName,
      mese: monthStr,
      stato: formStato,
      dataPagamento: formStato === 'pagato' ? formDataPagamento : undefined,
      oraPagamento: formStato === 'pagato' ? (paymentRecord?.oraPagamento || nowTime) : undefined,
      dataOraRegistrazione: formStato === 'pagato' ? (paymentRecord?.dataOraRegistrazione || now.toISOString()) : undefined,
      importo: Number(formImporto) || 0,
      ricevutaNumero: formRicevuta.trim() || undefined,
      note: formNote.trim() || undefined,
    };

    studentPaymentService.savePayment(newRecord);
    setPaymentRecord(newRecord);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  // Azione rapida: Segna come saldato oggi con data e ora esatta
  const handleQuickMarkPaid = () => {
    if (!student) return;
    const fullName = `${student.nome} ${student.cognome}`.trim();
    const now = new Date();
    const nowTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const newRecord: StudentMonthlyPayment = {
      id: `${student.id}_${monthStr}`,
      clienteId: student.id,
      clienteNome: fullName,
      mese: monthStr,
      stato: 'pagato',
      dataPagamento: todayISO,
      oraPagamento: nowTime,
      dataOraRegistrazione: now.toISOString(),
      importo: formImporto || student.quotaMensileCorso || 90,
      ricevutaNumero: formRicevuta || `R-${currentYear}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`,
      note: formNote || `Saldato il ${todayISO} alle ore ${nowTime}`,
    };
    studentPaymentService.savePayment(newRecord);
    setPaymentRecord(newRecord);
    setFormStato('pagato');
    setFormDataPagamento(todayISO);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  // Storico dei 12 mesi per l'allievo
  const yearlyHistory = useMemo(() => {
    if (!student) return [];
    const fullName = `${student.nome} ${student.cognome}`.trim();
    return MESI_ITALIANI.map((nomeMese, idx) => {
      const mNum = String(idx + 1).padStart(2, '0');
      const mStr = `${currentYear}-${mNum}`;
      const rec = studentPaymentService.getPayment(student.id, mStr, fullName);
      const mLessons = allStudentLessons.filter((b) => b.data.startsWith(mStr));
      const mHours = mLessons.reduce((sum, b) => sum + (b.durataOre || 1), 0);
      return {
        monthStr: mStr,
        monthName: nomeMese,
        record: rec,
        lessonsCount: mLessons.length,
        hours: mHours,
        isCurrentMonth: mStr === monthStr,
      };
    });
  }, [student, currentYear, allStudentLessons, monthStr, paymentRecord]);

  // Export PDF
  const handleExportPdf = () => {
    if (!student) return;
    generateStudentDossierPdf({
      student,
      monthStr,
      lessons: monthlyLessons,
      payment: paymentRecord,
      studioInfo,
    });
  };

  // WhatsApp Link
  const cleanPhone = (student?.telefono || '').replace(/\s+/g, '').replace(/[^\d+]/g, '');
  const waUrl = cleanPhone
    ? `https://wa.me/${cleanPhone.startsWith('+') ? cleanPhone.replace('+', '') : `39${cleanPhone}`}?text=${encodeURIComponent(
        `Ciao ${student?.nome}, ti scriviamo da ${studioInfo.nome} per un aggiornamento sul tuo corso di musica e il riepilogo lezioni.`
      )}`
    : null;

  if (!isOpen || !student) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150">
      <div className="relative w-full max-w-4xl bg-white dark:bg-neutral-950 border border-slate-200 dark:border-neutral-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92vh]">

        {/* ── 1. MODAL HEADER: Info Allievo e Chiusura ── */}
        <div className="bg-slate-50 dark:bg-neutral-900 border-b border-slate-200 dark:border-neutral-800 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-12 h-12 rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 flex items-center justify-center font-black text-lg shrink-0 shadow-xs">
              {student.nome[0]}{(student.cognome && student.cognome[0]) || ''}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white truncate">
                  {student.nome} {student.cognome}
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-amber-100 text-amber-800 dark:bg-amber-400/20 dark:text-amber-300 border border-amber-300 dark:border-amber-500/30">
                  Allievo
                </span>
                {student.corsoDidattico && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold text-slate-700 dark:text-slate-300 bg-slate-200 dark:bg-neutral-800 border border-slate-300 dark:border-neutral-700">
                    {student.corsoDidattico}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-600 dark:text-neutral-400 flex items-center gap-2 mt-0.5 flex-wrap">
                <span>Docente: <strong className="text-purple-700 dark:text-yellow-400 font-bold">{student.insegnanteRiferimentoNome || 'Insegnante Assegnato'}</strong></span>
                {student.telefono && (
                  <>
                    <span>•</span>
                    <span className="font-mono">{student.telefono}</span>
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Quick contact buttons & Close (tutti uniformi con stessa altezza, raggio e bordi) */}
          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
            {waUrl && (
              <a
                href={waUrl}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 dark:text-emerald-300 dark:border-emerald-800 flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                title="Apri chat WhatsApp con l'allievo"
              >
                <MessageSquare className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>WhatsApp</span>
              </a>
            )}

            <button
              type="button"
              onClick={handleExportPdf}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-300 dark:bg-blue-950/40 dark:hover:bg-blue-900/50 dark:text-blue-300 dark:border-blue-800 flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
              title="Scarica scheda e resoconto in PDF"
            >
              <Download className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>PDF</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700 border border-slate-300 hover:border-rose-300 dark:bg-neutral-800 dark:hover:bg-rose-950/40 dark:text-neutral-200 dark:hover:text-rose-300 dark:border-neutral-700 dark:hover:border-rose-800 flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
              title="Chiudi dettaglio (Esc)"
            >
              <X className="w-3.5 h-3.5 text-slate-600 dark:text-neutral-300" />
              <span>Chiudi</span>
            </button>
          </div>
        </div>

        {/* ── 2. SELETTORE MESE & NAVIGAZIONE TABS ── */}
        <div className="bg-slate-100 dark:bg-neutral-900/50 border-b border-slate-200 dark:border-neutral-800 px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Tabs */}
          <div className="flex items-center gap-1 bg-white dark:bg-neutral-950 p-1 rounded-xl border border-slate-200 dark:border-neutral-800 shrink-0 shadow-2xs">
            <button
              type="button"
              onClick={() => setActiveTab('lezioni')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'lezioni'
                  ? 'bg-amber-400 text-slate-950 shadow-xs'
                  : 'text-slate-600 dark:text-neutral-400 hover:text-slate-950 dark:hover:text-white'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Lezioni &amp; Orari</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                activeTab === 'lezioni' ? 'bg-black text-amber-300' : 'bg-slate-200 dark:bg-neutral-800 text-slate-700 dark:text-neutral-300'
              }`}>
                {monthlyLessons.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('pagamento')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'pagamento'
                  ? 'bg-amber-400 text-slate-950 shadow-xs'
                  : 'text-slate-600 dark:text-neutral-400 hover:text-slate-950 dark:hover:text-white'
              }`}
            >
              <DollarSign className="w-3.5 h-3.5" />
              <span>Stato Pagamento</span>
              <span className={`w-2 h-2 rounded-full ${
                paymentRecord?.stato === 'pagato' ? 'bg-emerald-500' : 'bg-rose-500 animate-pulse'
              }`} />
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('anagrafica')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'anagrafica'
                  ? 'bg-amber-400 text-slate-950 shadow-xs'
                  : 'text-slate-600 dark:text-neutral-400 hover:text-slate-950 dark:hover:text-white'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>Anagrafica</span>
            </button>
          </div>

          {/* Month Navigator */}
          <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
            <div className="flex items-center bg-white dark:bg-neutral-950 rounded-xl p-0.5 border border-slate-200 dark:border-neutral-800 shadow-2xs">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-1 rounded-lg text-slate-600 dark:text-neutral-400 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                title="Mese precedente"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-3 text-xs font-bold text-slate-900 dark:text-yellow-100 min-w-[110px] text-center">
                {monthName} {currentYear}
              </span>
              <button
                type="button"
                onClick={handleNextMonth}
                className="p-1 rounded-lg text-slate-600 dark:text-neutral-400 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                title="Mese successivo"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={handleGoCurrentMonth}
              className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-white dark:bg-neutral-950 hover:bg-slate-100 dark:hover:bg-neutral-800 text-slate-700 dark:text-neutral-300 border border-slate-200 dark:border-neutral-800 transition-colors cursor-pointer shadow-2xs"
            >
              Oggi
            </button>
          </div>
        </div>

        {/* ── 3. CONTENUTO TAB ── */}
        <div className="p-4 sm:p-6 overflow-y-auto custom-scrollbar flex-1 space-y-5">

          {/* ════════ TAB 1: LEZIONI SVOLTE & ORARI ════════ */}
          {activeTab === 'lezioni' && (
            <div className="space-y-4">
              {/* Stat Card Lezioni Mese */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-neutral-900/80 border border-neutral-800">
                  <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">Lezioni Svolte</span>
                  <div className="flex items-baseline gap-1.5 mt-1">
                    <span className="text-xl font-extrabold text-emerald-400">{completedLessons.length}</span>
                    <span className="text-xs text-neutral-500 font-medium">({completedMonthlyHours}h)</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-neutral-900/80 border border-neutral-800">
                  <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">Programmate</span>
                  <div className="flex items-baseline gap-1.5 mt-1">
                    <span className="text-xl font-extrabold text-amber-400">{upcomingLessons.length}</span>
                    <span className="text-xs text-neutral-500 font-medium">future</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-neutral-900/80 border border-neutral-800">
                  <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">Totale Ore Mese</span>
                  <div className="flex items-baseline gap-1.5 mt-1">
                    <span className="text-xl font-extrabold text-yellow-400">{totalMonthlyHours}</span>
                    <span className="text-xs text-neutral-500 font-medium">ore tot.</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-neutral-900/80 border border-neutral-800 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">Stato Mese</span>
                    <span className={`text-xs font-black uppercase mt-1 inline-block ${
                      paymentRecord?.stato === 'pagato' ? 'text-emerald-400' : 'text-rose-400'
                    }`}>
                      {paymentRecord?.stato === 'pagato' ? 'Saldato ✓' : 'Da Saldare ⚠️'}
                    </span>
                  </div>
                  {paymentRecord?.stato !== 'pagato' && (
                    <button
                      type="button"
                      onClick={handleQuickMarkPaid}
                      className="px-3 py-1.5 rounded-xl bg-emerald-100 hover:bg-emerald-200 text-emerald-800 border border-emerald-300 dark:bg-emerald-500/20 dark:hover:bg-emerald-500/30 dark:text-emerald-300 dark:border-emerald-500/40 text-xs font-bold cursor-pointer transition-colors shadow-2xs"
                      title="Registra saldo rapido per oggi"
                    >
                      Salda
                    </button>
                  )}
                </div>
              </div>

              {/* Elenco dettagliato delle lezioni del mese */}
              <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl overflow-hidden">
                <div className="p-3 px-4 bg-neutral-900/80 border-b border-neutral-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-yellow-400" />
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                      Elenco Cronologico Lezioni Svolte e Programmate ({monthName} {currentYear})
                    </h3>
                  </div>

                  {onOpenBookingModalForStudent && (
                    <button
                      type="button"
                      onClick={() => onOpenBookingModalForStudent(student)}
                      className="px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Nuova Lezione</span>
                    </button>
                  )}
                </div>

                {monthlyLessons.length === 0 ? (
                  <div className="p-8 text-center space-y-2">
                    <p className="text-sm font-semibold text-neutral-300">
                      Nessuna lezione registrata a calendario nel mese di {monthName} {currentYear}
                    </p>
                    <p className="text-xs text-neutral-500">
                      Usa il pulsante "+ Nuova Lezione" per pianificare le lezioni didattiche a calendario.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-neutral-800/80">
                    {monthlyLessons.map((lesson) => {
                      const completed = isLessonCompleted(lesson);
                      return (
                        <div
                          key={lesson.id}
                          className="p-3.5 px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-neutral-900/70 transition-colors"
                        >
                          <div className="flex items-start gap-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 font-bold text-xs mt-0.5 ${
                              completed
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            }`}>
                              {completed ? <Check className="w-4 h-4 stroke-[3]" /> : <Clock className="w-4 h-4" />}
                            </div>

                            <div className="space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-extrabold text-sm text-white">
                                  {formatDateItalian(lesson.data)}
                                </span>
                                <span className="text-xs font-mono font-bold text-yellow-300 bg-yellow-400/10 px-2 py-0.5 rounded border border-yellow-500/20">
                                  {lesson.oraInizio} - {lesson.oraFine}
                                </span>
                                <span className="text-[11px] text-neutral-400">
                                  ({lesson.durataOre || 1} ore)
                                </span>
                              </div>

                              <div className="flex items-center gap-3 text-xs text-neutral-400 flex-wrap">
                                <span className="flex items-center gap-1 text-neutral-300">
                                  <MapPin className="w-3 h-3 text-amber-400" />
                                  {lesson.salaNome || 'Sala'}
                                </span>
                                <span>•</span>
                                <span className="flex items-center gap-1 text-neutral-300">
                                  <GraduationCap className="w-3.5 h-3.5 text-purple-400" />
                                  {lesson.insegnanteNome || student.insegnanteRiferimentoNome || 'Insegnante'}
                                </span>
                              </div>

                              {lesson.note && (
                                <p className="text-[11px] text-neutral-400 italic bg-neutral-950/60 p-1.5 rounded border border-neutral-800">
                                  Note: {lesson.note}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                            <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider border ${
                              completed
                                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                            }`}>
                              {completed ? 'Svolta ✓' : 'Programmata ⏳'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ════════ TAB 2: PAGAMENTO MESE & STORICO ════════ */}
          {activeTab === 'pagamento' && (
            <div className="space-y-5">
              {/* Box Registrazione Pagamento Mese Selezionato */}
              <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-4 sm:p-5 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-yellow-400/20 text-yellow-400 border border-yellow-500/30 flex items-center justify-center">
                      <DollarSign className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">
                        Registrazione Pagamento Mensilità • {monthName} {currentYear}
                      </h3>
                      <p className="text-[11px] text-neutral-400">
                        Aggiorna lo stato, data effettiva di pagamento e metodo per l'allievo
                      </p>
                    </div>
                  </div>

                  {saveSuccess && (
                    <span className="px-3 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold flex items-center gap-1.5 animate-in fade-in">
                      <Check className="w-3.5 h-3.5 stroke-[3]" /> Salvato!
                    </span>
                  )}
                </div>

                <form onSubmit={handleSavePayment} className="space-y-4">
                  {/* Stato Pagamento */}
                  <div>
                    <label className="block text-xs font-bold text-neutral-300 mb-1.5">
                      Stato del Pagamento
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setFormStato('pagato')}
                        className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all shadow-2xs ${
                          formStato === 'pagato'
                            ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm shadow-emerald-500/20'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300 dark:bg-neutral-950 dark:hover:bg-neutral-900 dark:text-neutral-300 dark:border-neutral-800'
                        }`}
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Saldato</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setFormStato('da_saldare')}
                        className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all shadow-2xs ${
                          formStato === 'da_saldare'
                            ? 'bg-rose-600 text-white border-rose-500 shadow-sm shadow-rose-500/20'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300 dark:bg-neutral-950 dark:hover:bg-neutral-900 dark:text-neutral-300 dark:border-neutral-800'
                        }`}
                      >
                        <AlertCircle className="w-4 h-4" />
                        <span>Da Saldare</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setFormStato('parziale')}
                        className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all shadow-2xs ${
                          formStato === 'parziale'
                            ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-sm shadow-amber-500/20 font-black'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300 dark:bg-neutral-950 dark:hover:bg-neutral-900 dark:text-neutral-300 dark:border-neutral-800'
                        }`}
                      >
                        <Clock className="w-4 h-4" />
                        <span>Parziale</span>
                      </button>
                    </div>
                  </div>

                  {/* Dettagli: Data, Importo, Metodo */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-bold text-neutral-300">
                          Data di Pagamento del Mese
                        </label>
                        <button
                          type="button"
                          onClick={() => setFormDataPagamento(todayISO)}
                          className="text-[10px] text-yellow-400 hover:underline cursor-pointer"
                        >
                          Imposta Oggi
                        </button>
                      </div>
                      <input
                        type="date"
                        value={formDataPagamento}
                        onChange={(e) => setFormDataPagamento(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-neutral-800 bg-neutral-950 text-yellow-100 text-xs focus:border-yellow-400 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-neutral-300 mb-1.5">
                        Importo Mensilità (€)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={formImporto}
                        onChange={(e) => setFormImporto(Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-xl border border-neutral-800 bg-neutral-950 text-yellow-100 text-xs focus:border-yellow-400 focus:outline-none font-bold"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-neutral-300 mb-1.5">
                        Metodo di Pagamento
                      </label>
                      <select
                        value={formMetodo}
                        onChange={(e) => setFormMetodo(e.target.value as PaymentMethod)}
                        className="w-full px-3 py-2 rounded-xl border border-neutral-800 bg-neutral-950 text-yellow-100 text-xs focus:border-yellow-400 focus:outline-none"
                      >
                        <option value="bonifico">Bonifico Bancario</option>
                        <option value="contanti">Contanti</option>
                        <option value="pos">POS / Carta di Credito</option>
                      </select>
                    </div>
                  </div>

                  {/* Ricevuta e Note */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-neutral-300 mb-1.5">
                        Numero Ricevuta / Riferimento
                      </label>
                      <input
                        type="text"
                        placeholder="es. R-2026-104 o CRO bonifico"
                        value={formRicevuta}
                        onChange={(e) => setFormRicevuta(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-neutral-800 bg-neutral-950 text-yellow-100 text-xs focus:border-yellow-400 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-neutral-300 mb-1.5">
                        Note sul Pagamento
                      </label>
                      <input
                        type="text"
                        placeholder="es. Pagate 4 lezioni individuali"
                        value={formNote}
                        onChange={(e) => setFormNote(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-neutral-800 bg-neutral-950 text-yellow-100 text-xs focus:border-yellow-400 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button
                      type="submit"
                      className="px-5 py-2.5 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-black font-extrabold text-xs shadow-md shadow-yellow-500/20 flex items-center gap-2 cursor-pointer transition-all"
                    >
                      <Save className="w-4 h-4" />
                      <span>Salva Pagamento Mese</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* Storico Completo 12 Mesi dell'Anno */}
              <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-4 sm:p-5 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-yellow-400" />
                    Storico Mensilità Anno {currentYear}
                  </h4>
                  <span className="text-[10px] text-neutral-400">Clicca su un mese per visualizzarlo</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
                  {yearlyHistory.map((m) => {
                    const isPaid = m.record?.stato === 'pagato';
                    const hasRecord = !!m.record;
                    return (
                      <button
                        key={m.monthStr}
                        type="button"
                        onClick={() => {
                          const [y, mNum] = m.monthStr.split('-');
                          setCurrentDate(new Date(parseInt(y, 10), parseInt(mNum, 10) - 1, 1));
                        }}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                          m.isCurrentMonth
                            ? 'bg-amber-400/20 border-yellow-400 shadow-xs ring-1 ring-yellow-400/30'
                            : 'bg-neutral-950 border-neutral-800 hover:border-neutral-700'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-white capitalize">{m.monthName}</span>
                          <span className={`w-2 h-2 rounded-full ${isPaid ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                        </div>

                        <div className="mt-2 pt-1.5 border-t border-neutral-900 space-y-0.5 text-[10px]">
                          <div className="flex items-center justify-between text-neutral-400">
                            <span>Lezioni:</span>
                            <span className="font-bold text-white">{m.hours}h</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-neutral-400">Stato:</span>
                            <span className={`font-bold ${isPaid ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {isPaid ? 'Saldato' : 'Da Saldare'}
                            </span>
                          </div>
                          {isPaid && m.record?.dataPagamento && (
                            <span className="text-[9px] text-neutral-500 block truncate">
                              Pagato: {formatDateItalian(m.record.dataPagamento)}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ════════ TAB 3: ANAGRAFICA & SCHEDA CORSO ════════ */}
          {activeTab === 'anagrafica' && (
            <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-4 sm:p-5 space-y-4">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <FileText className="w-4 h-4 text-yellow-400" />
                Scheda Anagrafica &amp; Profilo Allievo
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-800 space-y-2">
                  <p className="text-[11px] font-bold text-yellow-400 uppercase tracking-wide">Dati Personali</p>
                  <div>
                    <span className="text-neutral-500">Nome Completo:</span>
                    <span className="text-white font-bold ml-1.5">{student.nome} {student.cognome}</span>
                  </div>
                  <div>
                    <span className="text-neutral-500">Codice Fiscale:</span>
                    <span className="text-white font-mono ml-1.5">{student.codiceFiscale || 'Non presente'}</span>
                  </div>
                  <div>
                    <span className="text-neutral-500">Data e Luogo di Nascita:</span>
                    <span className="text-white ml-1.5">{student.dataNascita ? formatDateItalian(student.dataNascita) : 'N/D'} {student.luogoNascita ? `(${student.luogoNascita})` : ''}</span>
                  </div>
                  <div>
                    <span className="text-neutral-500">Residenza:</span>
                    <span className="text-white ml-1.5">{student.residenza || 'Non specificata'}</span>
                  </div>
                </div>

                <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-800 space-y-2">
                  <p className="text-[11px] font-bold text-yellow-400 uppercase tracking-wide">Recapiti &amp; Contatti</p>
                  <div>
                    <span className="text-neutral-500">Telefono:</span>
                    <span className="text-white font-mono font-bold ml-1.5">{student.telefono || 'Non presente'}</span>
                  </div>
                  <div>
                    <span className="text-neutral-500">Email:</span>
                    <span className="text-white ml-1.5">{student.email || 'Non presente'}</span>
                  </div>
                  <div>
                    <span className="text-neutral-500">Numero Tessera Annuale:</span>
                    <span className="text-amber-400 font-mono font-bold ml-1.5">{student.numeroTessera || 'Nessuna'}</span>
                  </div>
                  <div>
                    <span className="text-neutral-500">Stato Tesseramento:</span>
                    <span className="text-white font-bold uppercase ml-1.5">{student.statoTesseramento || 'Attivo'}</span>
                  </div>
                </div>

                <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-800 space-y-2 sm:col-span-2">
                  <p className="text-[11px] font-bold text-yellow-400 uppercase tracking-wide">Dettagli Corso Didattico &amp; Strumentazione</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <span className="text-neutral-500 block">Corso Frequentato:</span>
                      <span className="text-white font-bold">{student.corsoDidattico || student.gruppoBand || 'Corso Musicale'}</span>
                    </div>
                    <div>
                      <span className="text-neutral-500 block">Insegnante Incaricato:</span>
                      <span className="text-white font-bold">{student.insegnanteRiferimentoNome || 'Insegnante Assegnato'}</span>
                    </div>
                    <div>
                      <span className="text-neutral-500 block">Quota Mensile Corso Pattuita:</span>
                      <span className="text-emerald-400 font-bold">{student.quotaMensileCorso ? formatCurrency(student.quotaMensileCorso) : '90,00 €'} / mese</span>
                    </div>
                  </div>

                  {student.note && (
                    <div className="mt-2 pt-2 border-t border-neutral-800">
                      <span className="text-neutral-500 block">Note Didattiche / Interne:</span>
                      <p className="text-neutral-300 mt-0.5">{student.note}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

        </div>

        {/* ── 4. FOOTER AZIONI RAPIDE ── */}
        <div className="p-3.5 px-5 bg-neutral-900 border-t border-neutral-800 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 text-xs text-neutral-400">
            <span>Stato mese corrente:</span>
            <span className={`font-black uppercase px-2 py-0.5 rounded text-[11px] ${
              paymentRecord?.stato === 'pagato'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
            }`}>
              {paymentRecord?.stato === 'pagato'
                ? `Saldato il ${paymentRecord.dataPagamento ? formatDateItalian(paymentRecord.dataPagamento) : ''}`
                : 'Da Saldare'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportPdf}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-neutral-800 hover:bg-neutral-700 text-white flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <Printer className="w-3.5 h-3.5 text-neutral-400" />
              <span>Stampa / PDF</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg text-xs font-bold bg-neutral-800 hover:bg-neutral-700 text-neutral-200 cursor-pointer transition-colors"
            >
              Chiudi
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
