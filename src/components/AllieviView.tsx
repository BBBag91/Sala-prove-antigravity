import React, { useState, useMemo, useEffect } from 'react';
import {
  GraduationCap,
  Users,
  Search,
  Calendar,
  Clock,
  DollarSign,
  CheckCircle2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Plus,
  Printer,
  Download,
  Filter,
  Eye,
  MessageSquare,
  ArrowRight,
  Music,
  Check,
  Grid,
  List,
  Sparkles,
  UserPlus,
  Phone,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { Client, Booking, StudentPaymentStatus, StudentMonthlyPayment } from '../types';
import { studentPaymentService } from '../services/studentPaymentService';
import {
  MESI_ITALIANI,
  formatCurrency,
  formatDateItalian,
  formatDateToISO,
  timeToMinutes,
} from '../utils/dateUtils';
import { StudentDetailModal } from './StudentDetailModal';

export const AllieviView: React.FC = () => {
  const { clients, bookings, staff, addClient, studioInfo } = useApp();
  const { user, isAdmin, isTeacher } = useAuth();

  // Mese di riferimento selezionato
  const today = useMemo(() => new Date(), []);
  const todayISO = formatDateToISO(today);
  const nowMinutes = today.getHours() * 60 + today.getMinutes();

  const [currentDate, setCurrentDate] = useState<Date>(today);

  const monthStr = useMemo(() => {
    const y = currentDate.getFullYear();
    const m = String(currentDate.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }, [currentDate]);

  const monthName = MESI_ITALIANI[currentDate.getMonth()];
  const currentYear = currentDate.getFullYear();

  // Navigazione mesi
  const handlePrevMonth = () => {
    setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  };
  const handleNextMonth = () => {
    setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  };
  const handleGoCurrentMonth = () => {
    setCurrentDate(today);
  };

  // Filtri e visualizzazione
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('all');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<'all' | 'pagato' | 'da_saldare'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Modal Dettaglio Allievo
  const [selectedStudent, setSelectedStudent] = useState<Client | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Modal Nuovo Allievo Rapido
  const [isNewStudentModalOpen, setIsNewStudentModalOpen] = useState(false);
  const [newNome, setNewNome] = useState('');
  const [newCognome, setNewCognome] = useState('');
  const [newTelefono, setNewTelefono] = useState('+39 ');
  const [newEmail, setNewEmail] = useState('');
  const [newCorso, setNewCorso] = useState('Chitarra Elettrica');
  const [newTeacherId, setNewTeacherId] = useState(user?.staffId || 'staff-1');
  const [newQuota, setNewQuota] = useState<number>(90);

  // Stato sincronizzazione pagamenti
  const [paymentsTimestamp, setPaymentsTimestamp] = useState<number>(Date.now());

  useEffect(() => {
    const handleUpdated = () => setPaymentsTimestamp(Date.now());
    window.addEventListener('student-payments-updated', handleUpdated);
    return () => window.removeEventListener('student-payments-updated', handleUpdated);
  }, []);

  // Lista docenti disponibili per filtro
  const teachersList = useMemo(() => {
    return staff
      .filter((s) => s.attivo && (s.ruolo === 'insegnante' || s.ruolo === 'entrambi'))
      .sort((a, b) => `${a.nome} ${a.cognome}`.localeCompare(`${b.nome} ${b.cognome}`));
  }, [staff]);

  // Se l'utente è Gabriele Piva (staff-1) o altro docente, default iniziale opzionale
  useEffect(() => {
    if (user?.staffId && teachersList.some((t) => t.id === user.staffId)) {
      // Se è un docente standard senza admin, default al suo ID; se admin, resta 'all' o user.staffId
      // Lasciamo 'all' come default per consentire ad Admin/Gabriele di vedere tutti con 1 click
    }
  }, [user, teachersList]);

  // Riconoscimento degli allievi
  const allieviList = useMemo(() => {
    return clients.filter((c) => {
      if (c.isAllievo) return true;
      if (c.corsoDidattico && c.corsoDidattico.trim().length > 0) return true;
      const band = (c.gruppoBand || '').toLowerCase();
      if (
        band.includes('corso') ||
        band.includes('alliev') ||
        band.includes('lezione') ||
        band.includes('canto') ||
        band.includes('chitarra') ||
        band.includes('batteria') ||
        band.includes('pianoforte') ||
        band.includes('basso')
      ) {
        return true;
      }
      // Controlla se ha lezioni a calendario
      const hasLesson = bookings.some(
        (b) =>
          b.tipo === 'lezione' &&
          (b.clienteId === c.id ||
            b.clienteNome.toLowerCase().includes(`${c.nome} ${c.cognome}`.toLowerCase()))
      );
      return hasLesson;
    });
  }, [clients, bookings]);

  // Verifica se una lezione è già stata svolta
  const isLessonCompleted = (b: Booking): boolean => {
    if (b.data < todayISO) return true;
    if (b.data === todayISO) {
      const endMin = timeToMinutes(b.oraFine || b.oraInizio);
      return nowMinutes >= endMin;
    }
    return false;
  };

  // Mappa statistiche per ciascun allievo nel mese selezionato
  const studentsWithStats = useMemo(() => {
    return allieviList.map((student) => {
      const fullName = `${student.nome} ${student.cognome}`.trim().toLowerCase();

      // Tutte le lezioni didattiche dell'allievo nel mese
      const monthlyLessons = bookings
        .filter((b) => {
          if (b.tipo !== 'lezione') return false;
          if (!b.data.startsWith(monthStr)) return false;
          if (b.clienteId === student.id) return true;
          if (b.clienteNome && b.clienteNome.toLowerCase().includes(fullName)) return true;
          return false;
        })
        .sort((a, b) => {
          const d = a.data.localeCompare(b.data);
          if (d !== 0) return d;
          return a.oraInizio.localeCompare(b.oraInizio);
        });

      const completedLessons = monthlyLessons.filter(isLessonCompleted);
      const upcomingLessons = monthlyLessons.filter((b) => !isLessonCompleted(b));

      const totalOre = monthlyLessons.reduce((sum, b) => sum + (b.durataOre || 1), 0);
      const completedOre = completedLessons.reduce((sum, b) => sum + (b.durataOre || 1), 0);

      // Stato pagamento del mese
      const payment = studentPaymentService.getPayment(student.id, monthStr);
      const isPaid = payment?.stato === 'pagato';
      const importo = payment?.importo !== undefined ? payment.importo : (student.quotaMensileCorso || 90);

      // Insegnante di riferimento
      const teacherName =
        student.insegnanteRiferimentoNome ||
        monthlyLessons[0]?.insegnanteNome ||
        'Insegnante Assegnato';
      const teacherId =
        student.insegnanteRiferimentoId ||
        monthlyLessons[0]?.insegnanteId ||
        '';

      return {
        student,
        monthlyLessons,
        completedLessons,
        upcomingLessons,
        totalOre,
        completedOre,
        payment,
        isPaid,
        importo,
        teacherName,
        teacherId,
      };
    });
  }, [allieviList, bookings, monthStr, todayISO, nowMinutes, paymentsTimestamp]);

  // Filtro applicato
  const filteredStudents = useMemo(() => {
    return studentsWithStats.filter((item) => {
      const { student, teacherName, teacherId, isPaid } = item;

      // Ricerca testo
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const fullText = `${student.nome} ${student.cognome} ${student.codiceFiscale || ''} ${student.corsoDidattico || ''} ${student.gruppoBand || ''} ${student.telefono || ''} ${teacherName}`.toLowerCase();
        if (!fullText.includes(query)) return false;
      }

      // Filtro Docente
      if (selectedTeacherId !== 'all') {
        if (teacherId !== selectedTeacherId && !teacherName.toLowerCase().includes(
          (teachersList.find((t) => t.id === selectedTeacherId)?.nome || '').toLowerCase()
        )) {
          return false;
        }
      }

      // Filtro Stato Pagamento
      if (paymentStatusFilter === 'pagato' && !isPaid) return false;
      if (paymentStatusFilter === 'da_saldare' && isPaid) return false;

      return true;
    });
  }, [studentsWithStats, searchTerm, selectedTeacherId, paymentStatusFilter, teachersList]);

  // KPI totali del mese
  const totalStudentsCount = allieviList.length;
  const filteredCount = filteredStudents.length;

  const totalMonthlyCompletedHours = useMemo(() => {
    return studentsWithStats.reduce((sum, item) => sum + item.completedOre, 0);
  }, [studentsWithStats]);

  const totalMonthlyCompletedLessonsCount = useMemo(() => {
    return studentsWithStats.reduce((sum, item) => sum + item.completedLessons.length, 0);
  }, [studentsWithStats]);

  const paidStudentsCount = useMemo(() => {
    return studentsWithStats.filter((item) => item.isPaid).length;
  }, [studentsWithStats]);

  const unpaidStudentsCount = useMemo(() => {
    return studentsWithStats.filter((item) => !item.isPaid).length;
  }, [studentsWithStats]);

  const totalCollectedEuros = useMemo(() => {
    return studentsWithStats
      .filter((item) => item.isPaid)
      .reduce((sum, item) => sum + (item.importo || 0), 0);
  }, [studentsWithStats]);

  const totalPendingEuros = useMemo(() => {
    return studentsWithStats
      .filter((item) => !item.isPaid)
      .reduce((sum, item) => sum + (item.importo || 0), 0);
  }, [studentsWithStats]);

  // Apertura dettaglio
  const handleOpenDetail = (st: Client) => {
    setSelectedStudent(st);
    setIsDetailModalOpen(true);
  };

  // Creazione rapida nuovo allievo
  const handleCreateNewStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNome.trim() || !newCognome.trim()) return;

    const assignedTeacher = staff.find((s) => s.id === newTeacherId);
    const newStudentId = `cli-${Date.now()}`;
    const curYear = new Date().getFullYear();

    const newStudentObj: Client = {
      id: newStudentId,
      nome: newNome.trim(),
      cognome: newCognome.trim(),
      codiceFiscale: '',
      residenza: 'Latina (LT)',
      sesso: 'M',
      dataNascita: '2000-01-01',
      luogoNascita: 'Latina',
      telefono: newTelefono.trim(),
      email: newEmail.trim(),
      statoTesseramento: 'attivo',
      numeroTessera: `TS-${curYear}-${String(clients.length + 1).padStart(3, '0')}`,
      dataTesseramento: todayISO,
      dataScadenzaTesseramento: `${curYear + 1}-12-31`,
      quotaTesseramento: 10,
      statoQuota: 'pagato',
      quotaPagata: true,
      descrizioneStrumentazione: 'Strumentazione allievo corso musicale',
      gruppoBand: `Corso ${newCorso}`,
      isAllievo: true,
      corsoDidattico: newCorso,
      insegnanteRiferimentoId: newTeacherId,
      insegnanteRiferimentoNome: assignedTeacher ? `${assignedTeacher.nome} ${assignedTeacher.cognome}` : 'Insegnante Assegnato',
      quotaMensileCorso: newQuota,
      note: `Allievo iscritto al corso di ${newCorso}.`,
    };

    addClient(newStudentObj);
    setIsNewStudentModalOpen(false);
    setNewNome('');
    setNewCognome('');
    setNewEmail('');
    setNewTelefono('+39 ');
  };

  // Azione rapida: Salda pagamento per l'allievo
  const handleQuickMarkStudentPaid = (student: Client, importo: number) => {
    const newRecord: StudentMonthlyPayment = {
      id: `${student.id}_${monthStr}`,
      clienteId: student.id,
      mese: monthStr,
      stato: 'pagato',
      dataPagamento: todayISO,
      importo: importo || student.quotaMensileCorso || 90,
      metodoPagamento: 'bonifico',
      ricevutaNumero: `R-${currentYear}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`,
      note: 'Saldato rapidamente da elenco allievi',
    };
    studentPaymentService.savePayment(newRecord);
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200">

      {/* ── 1. HEADER: Titolo, Navigazione Mese e Azioni Principali ── */}
      <div className="bg-neutral-900/90 rounded-2xl border border-yellow-500/30 p-4 sm:p-5 shadow-xl shadow-yellow-500/5 backdrop-blur flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-amber-400/20 text-yellow-400 border border-yellow-500/30 flex items-center justify-center shrink-0 shadow-xs">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Stato Allievi &amp; Lezioni
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black tracking-wider uppercase bg-amber-400 text-black shadow-xs">
                {totalStudentsCount} Allievi
              </span>
            </div>
            <p className="text-xs text-neutral-400 mt-0.5">
              Monitoraggio orari delle lezioni svolte, presenze e date di pagamento mensili
            </p>
          </div>
        </div>

        {/* Controlli Mese e Bottoni Azione */}
        <div className="flex items-center gap-2 flex-wrap self-start md:self-auto shrink-0 print:hidden">
          {/* Selettore Mese */}
          <div className="flex items-center bg-neutral-950 rounded-xl p-1 border border-neutral-800 shadow-xs">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
              title="Mese precedente"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 text-xs font-extrabold text-yellow-300 min-w-[125px] text-center">
              {monthName} {currentYear}
            </span>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
              title="Mese successivo"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={handleGoCurrentMonth}
            className="px-3 py-1.5 rounded-xl text-xs font-bold bg-neutral-950 hover:bg-neutral-800 text-neutral-300 border border-neutral-800 transition-colors cursor-pointer"
          >
            Oggi
          </button>

          {/* Stampa / PDF Pagina */}
          <button
            type="button"
            onClick={() => window.print()}
            className="px-3 py-1.5 rounded-xl text-xs font-bold bg-neutral-900 hover:bg-neutral-800 text-neutral-200 border border-neutral-700 flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Stampa riepilogo mensile"
          >
            <Printer className="w-3.5 h-3.5 text-neutral-400" />
            <span className="hidden sm:inline">Stampa</span>
          </button>

          {/* Nuovo Allievo */}
          <button
            type="button"
            onClick={() => setIsNewStudentModalOpen(true)}
            className="px-3.5 py-1.5 rounded-xl text-xs font-black bg-yellow-400 hover:bg-yellow-300 text-black shadow-md shadow-yellow-500/20 flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Nuovo Allievo</span>
          </button>
        </div>
      </div>

      {/* ── 2. KPI SUMMARY CARDS: Contatori & Statistiche Mensili ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* KPI 1: Allievi */}
        <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-4 shadow-sm relative overflow-hidden group hover:border-yellow-500/40 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Allievi Iscritti</span>
            <div className="w-8 h-8 rounded-lg bg-yellow-400/10 text-yellow-400 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-white">{totalStudentsCount}</span>
            <span className="text-xs text-neutral-400">allievi attivi</span>
          </div>
          <p className="text-[11px] text-neutral-500 mt-1">
            Frequenza corsi individuali e d'insieme
          </p>
        </div>

        {/* KPI 2: Lezioni Svolte Mese */}
        <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-4 shadow-sm relative overflow-hidden group hover:border-emerald-500/40 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Lezioni Svolte</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-400">{totalMonthlyCompletedHours} ore</span>
            <span className="text-xs text-neutral-400">({totalMonthlyCompletedLessonsCount} lezioni)</span>
          </div>
          <p className="text-[11px] text-neutral-500 mt-1">
            Effettuate a calendario in {monthName}
          </p>
        </div>

        {/* KPI 3: Stato Pagamenti Mese */}
        <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-4 shadow-sm relative overflow-hidden group hover:border-blue-500/40 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Pagamenti Mensilità</span>
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-blue-400">
              {paidStudentsCount} / {totalStudentsCount}
            </span>
            <span className="text-xs text-neutral-400">
              ({totalStudentsCount > 0 ? Math.round((paidStudentsCount / totalStudentsCount) * 100) : 0}%)
            </span>
          </div>
          <div className="w-full bg-neutral-800 h-1.5 rounded-full mt-2 overflow-hidden">
            <div
              className="bg-blue-500 h-full rounded-full transition-all duration-300"
              style={{
                width: `${totalStudentsCount > 0 ? (paidStudentsCount / totalStudentsCount) * 100 : 0}%`,
              }}
            />
          </div>
        </div>

        {/* KPI 4: Incasso Quote Mensili */}
        <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-4 shadow-sm relative overflow-hidden group hover:border-amber-500/40 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Incasso Mese</span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-yellow-300">{formatCurrency(totalCollectedEuros)}</span>
            <span className="text-xs text-rose-400 font-bold">
              +{formatCurrency(totalPendingEuros)} da saldare
            </span>
          </div>
          <p className="text-[11px] text-neutral-500 mt-1">
            Quote mensili allievi di {monthName} {currentYear}
          </p>
        </div>
      </div>

      {/* ── 3. BARRA FILTRI, RICERCA E SWITCH VISTA ── */}
      <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-3.5 sm:p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        {/* Ricerca per nome/telefono/corso */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cerca allievo per nome, strumento, telefono..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-yellow-100 placeholder:text-neutral-500 text-xs focus:border-yellow-400 focus:outline-none"
          />
        </div>

        {/* Filtri a tendina */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Filtro Docente */}
          <div className="flex items-center gap-1.5 bg-neutral-950 px-2.5 py-1.5 rounded-xl border border-neutral-800">
            <GraduationCap className="w-3.5 h-3.5 text-yellow-400" />
            <select
              value={selectedTeacherId}
              onChange={(e) => setSelectedTeacherId(e.target.value)}
              className="bg-transparent text-neutral-200 text-xs focus:outline-none cursor-pointer"
            >
              <option value="all" className="bg-neutral-900">Tutti i Docenti</option>
              {teachersList.map((t) => (
                <option key={t.id} value={t.id} className="bg-neutral-900">
                  {t.nome} {t.cognome}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro Stato Pagamento */}
          <div className="flex items-center gap-1.5 bg-neutral-950 px-2.5 py-1.5 rounded-xl border border-neutral-800">
            <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
            <select
              value={paymentStatusFilter}
              onChange={(e) => setPaymentStatusFilter(e.target.value as any)}
              className="bg-transparent text-neutral-200 text-xs focus:outline-none cursor-pointer"
            >
              <option value="all" className="bg-neutral-900">Tutti i Pagamenti</option>
              <option value="pagato" className="bg-neutral-900">Saldati ✓</option>
              <option value="da_saldare" className="bg-neutral-900">Da Saldare ⚠️</option>
            </select>
          </div>

          {/* Switch Grid / Table */}
          <div className="flex items-center bg-neutral-950 p-0.5 rounded-xl border border-neutral-800">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                viewMode === 'grid' ? 'bg-yellow-400 text-black' : 'text-neutral-400 hover:text-white'
              }`}
              title="Vista schede dettagliate"
            >
              <Grid className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                viewMode === 'table' ? 'bg-yellow-400 text-black' : 'text-neutral-400 hover:text-white'
              }`}
              title="Vista tabella compatta"
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ── 4. ELENCO ALLIEVI (GRID / TABLE) ── */}
      {filteredStudents.length === 0 ? (
        <div className="p-12 text-center bg-neutral-900/60 border border-dashed border-neutral-800 rounded-2xl space-y-3">
          <GraduationCap className="w-12 h-12 text-neutral-600 mx-auto" />
          <h3 className="text-base font-bold text-white">Nessun allievo trovato</h3>
          <p className="text-xs text-neutral-400 max-w-md mx-auto">
            Nessun allievo corrisponde ai criteri di ricerca o ai filtri selezionati. Prova a modificare i filtri o inserisci un nuovo allievo.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchTerm('');
              setSelectedTeacherId('all');
              setPaymentStatusFilter('all');
            }}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-neutral-800 hover:bg-neutral-700 text-neutral-200 cursor-pointer transition-colors"
          >
            Reimposta Filtri
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        /* ── VISTA A SCHEDE (CARDS) ── */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredStudents.map((item) => {
            const { student, isPaid, payment, importo, completedLessons, upcomingLessons, completedOre, teacherName } = item;
            const cleanPhone = (student.telefono || '').replace(/[^\d+]/g, '');

            return (
              <div
                key={student.id}
                className="bg-neutral-900/80 border border-neutral-800 hover:border-yellow-500/40 rounded-2xl p-4 sm:p-5 shadow-lg flex flex-col justify-between gap-4 transition-all group"
              >
                {/* Header Scheda Allievo */}
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center font-black text-sm shrink-0">
                        {student.nome[0]}{student.cognome[0]}
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm sm:text-base font-extrabold text-white truncate group-hover:text-yellow-300 transition-colors">
                          {student.nome} {student.cognome}
                        </h3>
                        <div className="flex items-center gap-1.5 text-[11px] text-neutral-400 truncate">
                          <span className="font-semibold text-neutral-300">{student.corsoDidattico || student.gruppoBand || 'Corso Musicale'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Badge Docente */}
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30 shrink-0">
                      {teacherName}
                    </span>
                  </div>

                  {/* BOX STATO PAGAMENTO DEL MESE (CON DATA) */}
                  <div className={`p-3 rounded-xl border flex items-center justify-between gap-2 ${
                    isPaid
                      ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
                      : 'bg-rose-950/20 border-rose-500/30 text-rose-300'
                  }`}>
                    <div>
                      <div className="flex items-center gap-1.5 font-bold text-xs">
                        {isPaid ? (
                          <>
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                            <span className="text-emerald-300 uppercase tracking-wide">Mese Saldato</span>
                          </>
                        ) : (
                          <>
                            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                            <span className="text-rose-300 uppercase tracking-wide">Mese Da Saldare</span>
                          </>
                        )}
                        <span className="text-[11px] font-mono font-bold text-white">
                          ({formatCurrency(importo)})
                        </span>
                      </div>

                      {/* DATA DI PAGAMENTO DEL MESE */}
                      <p className="text-[11px] mt-1 text-neutral-300">
                        {isPaid && payment?.dataPagamento ? (
                          <span>
                            Pagato il: <strong className="text-white font-bold">{formatDateItalian(payment.dataPagamento)}</strong>
                            {payment.metodoPagamento && <span className="text-neutral-400 uppercase text-[10px] ml-1">({payment.metodoPagamento})</span>}
                          </span>
                        ) : (
                          <span className="text-rose-400/90 italic">
                            Nessun pagamento registrato per {monthName}
                          </span>
                        )}
                      </p>
                    </div>

                    {!isPaid && (
                      <button
                        type="button"
                        onClick={() => handleQuickMarkStudentPaid(student, importo)}
                        className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-extrabold shadow-sm cursor-pointer transition-colors shrink-0"
                        title="Segna come saldato oggi"
                      >
                        Salda Ora
                      </button>
                    )}
                  </div>

                  {/* RIEPILOGO LEZIONI SVOLTE (DATA & ORA) */}
                  <div className="bg-neutral-950/70 p-3 rounded-xl border border-neutral-800/80 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-neutral-400 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-yellow-400" /> Lezioni del Mese:
                      </span>
                      <span className="font-bold text-white">
                        <strong className="text-emerald-400">{completedLessons.length} svolte</strong> ({completedOre}h)
                        {upcomingLessons.length > 0 && <span className="text-neutral-400 font-normal"> • {upcomingLessons.length} future</span>}
                      </span>
                    </div>

                    {/* Ultima o Prossima Lezione */}
                    {completedLessons.length > 0 ? (
                      <div className="text-[11px] text-neutral-300 pt-1 border-t border-neutral-900 flex items-center justify-between">
                        <span className="text-neutral-400 truncate">Ultima svolta:</span>
                        <span className="font-semibold text-yellow-200">
                          {formatDateItalian(completedLessons[completedLessons.length - 1].data)} ({completedLessons[completedLessons.length - 1].oraInizio}-{completedLessons[completedLessons.length - 1].oraFine})
                        </span>
                      </div>
                    ) : (
                      <div className="text-[11px] text-neutral-500 pt-1 border-t border-neutral-900 italic">
                        Nessuna lezione completata finora nel mese
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer Scheda: Azioni e Dettaglio Singolo Allievo */}
                <div className="pt-2 border-t border-neutral-800/80 flex items-center justify-between gap-2">
                  {cleanPhone ? (
                    <a
                      href={`https://wa.me/${cleanPhone.startsWith('+') ? cleanPhone.replace('+', '') : `39${cleanPhone}`}?text=${encodeURIComponent(
                        `Ciao ${student.nome}, ti scriviamo da ${studioInfo.nome} in merito alle tue lezioni di musica.`
                      )}`}
                      target="_blank"
                      rel="noreferrer"
                      className="p-2 rounded-lg bg-neutral-950 hover:bg-emerald-950/40 text-neutral-400 hover:text-emerald-400 border border-neutral-800 transition-colors"
                      title="Apri WhatsApp"
                    >
                      <MessageSquare className="w-4 h-4" />
                    </a>
                  ) : <div />}

                  <button
                    type="button"
                    onClick={() => handleOpenDetail(student)}
                    className="px-3 py-1.5 rounded-xl bg-yellow-400/15 hover:bg-yellow-400 text-yellow-300 hover:text-black border border-yellow-500/30 hover:border-yellow-400 text-xs font-extrabold flex items-center gap-1.5 cursor-pointer transition-all ml-auto"
                  >
                    <span>Resoconto Dettagliato</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ── VISTA TABELLA COMPATTA ── */
        <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl overflow-hidden shadow-lg">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-950/90 text-neutral-400 font-bold uppercase tracking-wider text-[10px] border-b border-neutral-800">
                <tr>
                  <th className="p-3 px-4">Allievo</th>
                  <th className="p-3">Corso &amp; Docente</th>
                  <th className="p-3">Lezioni Svolte Mese</th>
                  <th className="p-3">Stato Pagamento Mese</th>
                  <th className="p-3">Data Pagamento</th>
                  <th className="p-3">Quota</th>
                  <th className="p-3 text-right">Azioni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800">
                {filteredStudents.map((item) => {
                  const { student, isPaid, payment, importo, completedLessons, completedOre, teacherName } = item;
                  return (
                    <tr key={student.id} className="hover:bg-neutral-800/40 transition-colors">
                      <td className="p-3 px-4 font-bold text-white">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-xs shrink-0">
                            {student.nome[0]}{student.cognome[0]}
                          </div>
                          <div>
                            <span className="block">{student.nome} {student.cognome}</span>
                            <span className="text-[10px] text-neutral-400 font-mono">{student.telefono}</span>
                          </div>
                        </div>
                      </td>

                      <td className="p-3">
                        <span className="text-white block">{student.corsoDidattico || student.gruppoBand || 'Corso'}</span>
                        <span className="text-[10px] text-purple-400 font-medium">{teacherName}</span>
                      </td>

                      <td className="p-3">
                        <span className="font-extrabold text-emerald-400 block">{completedOre} ore</span>
                        <span className="text-[10px] text-neutral-400">{completedLessons.length} lezioni svolte</span>
                      </td>

                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wide border inline-block ${
                          isPaid
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                            : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                        }`}>
                          {isPaid ? 'Saldato ✓' : 'Da Saldare ⚠️'}
                        </span>
                      </td>

                      <td className="p-3">
                        {isPaid && payment?.dataPagamento ? (
                          <span className="font-bold text-yellow-200">
                            {formatDateItalian(payment.dataPagamento)}
                          </span>
                        ) : (
                          <span className="text-neutral-500 italic">Non registrata</span>
                        )}
                      </td>

                      <td className="p-3 font-mono font-bold text-white">
                        {formatCurrency(importo)}
                      </td>

                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {!isPaid && (
                            <button
                              type="button"
                              onClick={() => handleQuickMarkStudentPaid(student, importo)}
                              className="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] cursor-pointer"
                            >
                              Salda
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleOpenDetail(student)}
                            className="p-1.5 rounded-lg bg-neutral-800 hover:bg-yellow-400 hover:text-black text-neutral-300 transition-colors cursor-pointer"
                            title="Apri scheda dettagliata allievo"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── 5. MODAL DETTAGLIO ALLIEVO SINGOLO ── */}
      {isDetailModalOpen && (
        <StudentDetailModal
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          student={selectedStudent}
          initialMonthStr={monthStr}
        />
      )}

      {/* ── 6. MODAL NUOVO ALLIEVO RAPIDO ── */}
      {isNewStudentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="relative w-full max-w-md bg-neutral-950 border border-yellow-500/30 rounded-2xl shadow-2xl p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-yellow-400" />
                <h3 className="text-base font-extrabold text-white">Iscrivi Nuovo Allievo</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsNewStudentModalOpen(false)}
                className="text-neutral-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateNewStudent} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-neutral-300 mb-1">Nome</label>
                  <input
                    type="text"
                    required
                    value={newNome}
                    onChange={(e) => setNewNome(e.target.value)}
                    placeholder="es. Simone"
                    className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-yellow-100 text-xs focus:border-yellow-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-300 mb-1">Cognome</label>
                  <input
                    type="text"
                    required
                    value={newCognome}
                    onChange={(e) => setNewCognome(e.target.value)}
                    placeholder="es. Ferri"
                    className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-yellow-100 text-xs focus:border-yellow-400 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-neutral-300 mb-1">Telefono</label>
                  <input
                    type="tel"
                    value={newTelefono}
                    onChange={(e) => setNewTelefono(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-yellow-100 text-xs focus:border-yellow-400 focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-300 mb-1">Email</label>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="opzionale"
                    className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-yellow-100 text-xs focus:border-yellow-400 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-300 mb-1">Corso / Strumento</label>
                <input
                  type="text"
                  required
                  value={newCorso}
                  onChange={(e) => setNewCorso(e.target.value)}
                  placeholder="es. Chitarra Elettrica, Canto Moderno, Batteria"
                  className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-yellow-100 text-xs focus:border-yellow-400 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-neutral-300 mb-1">Docente Assegnato</label>
                  <select
                    value={newTeacherId}
                    onChange={(e) => setNewTeacherId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-yellow-100 text-xs focus:border-yellow-400 focus:outline-none"
                  >
                    {teachersList.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.nome} {t.cognome}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-300 mb-1">Quota Mensile (€)</label>
                  <input
                    type="number"
                    min="0"
                    step="5"
                    value={newQuota}
                    onChange={(e) => setNewQuota(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-yellow-100 text-xs focus:border-yellow-400 focus:outline-none font-bold"
                  />
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => setIsNewStudentModalOpen(false)}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold bg-neutral-800 hover:bg-neutral-700 text-neutral-200"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-black bg-yellow-400 hover:bg-yellow-300 text-black shadow-md shadow-yellow-500/20"
                >
                  Salva e Crea Allievo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
