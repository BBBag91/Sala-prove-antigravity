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
  FileSpreadsheet,
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
  CreditCard,
  Building2,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { Client, Booking, isLessonBooking, StudentPaymentStatus, StudentMonthlyPayment, StaffMember } from '../types';
import { studentPaymentService } from '../services/studentPaymentService';
import {
  MESI_ITALIANI,
  formatCurrency,
  formatDateItalian,
  formatDateToISO,
  timeToMinutes,
} from '../utils/dateUtils';
import { StudentDetailModal } from './StudentDetailModal';
import { generateStudentRegistryPdf } from '../utils/studentRegistryPdf';
import { generateUUID } from '../utils/uuid';

export const AllieviView: React.FC = () => {
  const { clients, bookings, staff, addClient, studioInfo } = useApp();
  const { user, isAdmin, isTeacher } = useAuth();

  // Mese di riferimento
  const today = useMemo(() => new Date(), []);
  const todayISO = formatDateToISO(today);
  const nowMinutes = today.getHours() * 60 + today.getMinutes();

  // Inizializza direttamente su Ottobre 2026 come richiesto
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date(2026, 9, 1));

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
  const handleGoOctober = () => {
    setCurrentDate(new Date(2026, 9, 1));
  };

  // Profilo docente loggato (se l'utente corrente è un singolo insegnante)
  const currentLoggedInTeacher = useMemo(() => {
    if (isTeacher && !isAdmin && user?.staffId) {
      return staff.find((s) => s.id === user.staffId) || null;
    }
    return null;
  }, [isTeacher, isAdmin, user, staff]);

  // Filtri e visualizzazione (default 'table' per layout Excel-like richiesto)
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>(() => {
    if (isTeacher && !isAdmin && user?.staffId) {
      return user.staffId;
    }
    return 'all';
  });
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<'all' | 'pagato' | 'da_saldare'>('all');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');

  useEffect(() => {
    if (isTeacher && !isAdmin && user?.staffId) {
      setSelectedTeacherId(user.staffId);
    }
  }, [isTeacher, isAdmin, user]);

  const activeTeacherFilter = (isTeacher && !isAdmin && user?.staffId) ? user.staffId : selectedTeacherId;

  // Modal Dettaglio Allievo
  const [selectedStudent, setSelectedStudent] = useState<Client | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Modal Nuovo Allievo Rapido
  const [isNewStudentModalOpen, setIsNewStudentModalOpen] = useState(false);
  const [newNome, setNewNome] = useState('');
  const [newCognome, setNewCognome] = useState('');
  const [newTelefono, setNewTelefono] = useState('+39 ');
  const [newEmail, setNewEmail] = useState('');
  const [newCorso, setNewCorso] = useState('Chitarra & Teoria');
  const [newTeacherId, setNewTeacherId] = useState(user?.staffId || 'staff-1');
  const [newQuota, setNewQuota] = useState<number>(90);

  // Sincronizzazione pagamenti da eventi locali
  const [paymentsTimestamp, setPaymentsTimestamp] = useState<number>(Date.now());

  useEffect(() => {
    const handleUpdated = () => setPaymentsTimestamp(Date.now());
    window.addEventListener('student-payments-updated', handleUpdated);
    return () => window.removeEventListener('student-payments-updated', handleUpdated);
  }, []);

  // Lista docenti per filtro (deduplicata rigorosamente per ID e nome)
  const teachersList = useMemo(() => {
    const seenNames = new Set<string>();
    const seenIds = new Set<string>();
    const unique: typeof staff = [];

    const activeTeachers = staff
      .filter((s) => s.attivo && (s.ruolo === 'insegnante' || s.ruolo === 'entrambi'))
      .sort((a, b) => `${a.nome} ${a.cognome}`.localeCompare(`${b.nome} ${b.cognome}`));

    for (const t of activeTeachers) {
      const normName = `${(t.nome || '').trim().toLowerCase()} ${(t.cognome || '').trim().toLowerCase()}`;
      if (!seenNames.has(normName) && !seenIds.has(t.id)) {
        seenNames.add(normName);
        seenIds.add(t.id);
        unique.push(t);
      }
    }
    return unique;
  }, [staff]);

  // Helper per verificare se una prenotazione è una lezione didattica
  const isLesson = (b: Booking): boolean => {
    return isLessonBooking(b) || b.tipo === 'lezione' || Boolean(b.insegnanteId) || Boolean(b.insegnanteNome);
  };

  // Helper per verificare se una lezione è già stata svolta fino a quel giorno / orario
  const isLessonCompleted = (b: Booking): boolean => {
    if (b.data < todayISO) return true;
    if (b.data === todayISO) {
      const endMin = timeToMinutes(b.oraFine || b.oraInizio);
      return nowMinutes >= endMin;
    }
    return false;
  };

  /**
   * ── ESTRAZIONE DEGLI ALLIEVI DALLE PRENOTAZIONI DELLE LEZIONI ──
   * REGOLA CRUCIALE: Ogni allievo è censito per singolo docente (chiave: studente + insegnante).
   * In questo modo, ogni insegnante nel riepilogo ha ESCLUSIVAMENTE le proprie lezioni e non quelle degli altri.
   */
  const studentsWithStats = useMemo(() => {
    const allLessonBookings = bookings.filter(isLesson);

    // Helper per risolvere l'ID canonico di un docente da ID o da nome
    const canonicalizeTeacherId = (rawId?: string, rawName?: string): string => {
      const id = (rawId || '').trim();
      const name = (rawName || '').trim().toLowerCase();
      if (id === 'staff-1' || name.includes('gabriele') || name.includes('piva')) return 'staff-1';
      if (id === 'staff-1790952691190' || id === 'staff-1790952680654' || name.includes('michael') || name.includes('bertin') || name.includes('maicol')) return 'staff-1790952691190';
      if (id === 'staff-1790952724237' || id === 'staff-1790952646698' || name.includes('luca') || name.includes('di chiara')) return 'staff-1790952724237';
      if (id === 'staff-1790952634062' || name.includes('alessandro') || name.includes('cilea')) return 'staff-1790952634062';
      return id;
    };

    // Helper per estrarre il docente di riferimento di un cliente (anche se salvato in note ALLIEVO_DATA)
    const getClientTeacherId = (c: Client): string => {
      let refId = c.insegnanteRiferimentoId || '';
      let refName = c.insegnanteRiferimentoNome || '';
      if ((!refId || !refName) && c.note && c.note.includes('[ALLIEVO_DATA:')) {
        const match = c.note.match(/\[ALLIEVO_DATA:(\{.*?\})\]/);
        if (match && match[1]) {
          try {
            const parsed = JSON.parse(match[1]);
            if (!refId && parsed.insegnanteId) refId = parsed.insegnanteId;
            if (!refName && parsed.insegnanteNome) refName = parsed.insegnanteNome;
          } catch {}
        }
      }
      return canonicalizeTeacherId(refId, refName);
    };

    // Verifica se una scheda Client in anagrafica è in realtà il profilo personale di un docente/staff
    const isStaffPersonalClientRecord = (c: Client): boolean => {
      const full = `${c.nome || ''} ${c.cognome || ''}`.trim().toLowerCase();
      return (
        full === 'gabriele piva' ||
        full === 'luca di chiara' ||
        full === 'michael bertin' ||
        full === 'maicol bertin' ||
        full === 'alessandro cilea' ||
        full === 'alessandro francesco cilea' ||
        full === 'paolo bianchini'
      );
    };

    // Helper per formattare i nomi con iniziale maiuscola (es. "federico alessandro" -> "Federico Alessandro")
    const toTitleCase = (str: string): string => {
      return str
        .trim()
        .split(/\s+/)
        .map((w) => (w.length > 0 ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : ''))
        .join(' ');
    };

    // Helper per determinare con precisione il docente assegnato alla prenotazione
    const resolveTeacherForBooking = (b: Booking): { id: string; nomeCompleto: string; staffMember?: StaffMember } => {
      const canonId = canonicalizeTeacherId(b.insegnanteId, b.insegnanteNome);
      if (canonId) {
        const byCanon = staff.find((s) => s.id === canonId);
        if (byCanon) return { id: byCanon.id, nomeCompleto: `${byCanon.nome} ${byCanon.cognome}`.trim(), staffMember: byCanon };
      }
      // 1. Match per ID esatto nello staff
      if (b.insegnanteId) {
        const byId = staff.find((s) => s.id === b.insegnanteId);
        if (byId) return { id: byId.id, nomeCompleto: `${byId.nome} ${byId.cognome}`.trim(), staffMember: byId };
      }
      // 2. Match per nome dell'insegnante
      if (b.insegnanteNome) {
        const norm = b.insegnanteNome.trim().toLowerCase();
        const byFull = staff.find((s) => `${s.nome} ${s.cognome}`.trim().toLowerCase() === norm);
        if (byFull) return { id: byFull.id, nomeCompleto: `${byFull.nome} ${byFull.cognome}`.trim(), staffMember: byFull };
        const byFirst = staff.find((s) => s.nome.trim().toLowerCase() === norm);
        if (byFirst) return { id: byFirst.id, nomeCompleto: `${byFirst.nome} ${byFirst.cognome}`.trim(), staffMember: byFirst };
      }
      // 3. Fallback: allievo con docente di riferimento registrato
      if (b.clienteId) {
        const matched = clients.find((c) => c.id === b.clienteId);
        const refTeacherId = matched ? getClientTeacherId(matched) : '';
        if (refTeacherId) {
          const byRef = staff.find((s) => s.id === refTeacherId);
          if (byRef) return { id: byRef.id, nomeCompleto: `${byRef.nome} ${byRef.cognome}`.trim(), staffMember: byRef };
        }
      }
      // 4. Prenotazione in Studiolo (Gabriele Piva)
      if (b.salaNome?.toLowerCase().includes('studiolo') || b.salaId?.includes('1790981409646')) {
        const piva = staff.find((s) => s.id === 'staff-1' || s.nome.toLowerCase() === 'gabriele');
        if (piva) return { id: piva.id, nomeCompleto: `${piva.nome} ${piva.cognome}`.trim(), staffMember: piva };
      }

      const fallbackId = b.insegnanteId || 'docente-sconosciuto';
      const fallbackName = b.insegnanteNome || 'Docente da Assegnare';
      const fallbackStaff = staff.find(
        (s) => s.id === fallbackId || `${s.nome} ${s.cognome}`.trim().toLowerCase() === fallbackName.toLowerCase()
      );
      return { id: fallbackId, nomeCompleto: fallbackName, staffMember: fallbackStaff };
    };

    const allieviMap = new Map<
      string,
      {
        student: Client;
        allLessons: Booking[];
        monthlyLessons: Booking[];
        primaryTeacherName: string;
        primaryTeacherId: string;
        teacherIds: Set<string>;
        teacherNames: Set<string>;
        corsoStrumento: string;
      }
    >();

    // Voci segnaposto/blocchi generici nel calendario che NON sono allievi
    const NON_STUDENT_LABELS = new Set([
      'lezioni',
      'lezione',
      'di chiara',
      'luca di chiara',
      'mike riunione',
      'riunione',
      'prova batteria',
      'prova',
    ]);
    const MOCK_BOOKING_IDS = new Set(['book-1', 'book-2', 'book-3', 'book-4', 'book-5', 'book-6', 'book-7', 'book-8']);

    const getOrCreateStudent = (b: Booking) => {
      if (MOCK_BOOKING_IDS.has(b.id)) return null;
      const rawName = (b.clienteNome || '').trim();
      if (!rawName) return null;
      if (NON_STUDENT_LABELS.has(rawName.toLowerCase())) return null;

      // Normalizzazione chiave studente (rimuove suffissi tecnici tipo "chita" o "batteria")
      let cleanRawName = rawName;
      let detectedCorso = '';
      if (rawName.toLowerCase().endsWith(' chita')) {
        cleanRawName = rawName.slice(0, -6).trim();
        detectedCorso = 'Chitarra & Teoria';
      } else if (rawName.toLowerCase().endsWith(' chitarra')) {
        cleanRawName = rawName.slice(0, -9).trim();
        detectedCorso = 'Chitarra & Teoria';
      } else if (rawName.toLowerCase().endsWith(' batteria')) {
        cleanRawName = rawName.slice(0, -9).trim();
        detectedCorso = 'Batteria & Percussioni';
      }

      if (!cleanRawName || NON_STUDENT_LABELS.has(cleanRawName.toLowerCase())) return null;

      const teacher = resolveTeacherForBooking(b);
      // Esclude prenotazioni prive di un insegnante reale (es. affitti sala non associati a nessun docente)
      if (!teacher.id || teacher.id === 'docente-sconosciuto') return null;

      // Chiave composita: studente + docente (garantisce assoluta separazione delle lezioni fra docenti diversi)
      const compositeKey = `${cleanRawName.toLowerCase()}###${teacher.id}`;

      if (!allieviMap.has(compositeKey)) {
        const matchedClient = clients.find((c) => {
          // Non associare mai le schede personali dei docenti stessi come allievi
          if (isStaffPersonalClientRecord(c)) return false;

          const clientTeacherId = getClientTeacherId(c);

          // 1. REGOLA FERREA ANTI-CONTAMINAZIONE DOCENTI:
          // Se il cliente censito in anagrafica ha già un insegnante di riferimento specificato
          // e questo è DIVERSO dall'insegnante di questa lezione, NON DEVE MAI essere associato a un altro docente!
          if (clientTeacherId && teacher.id && clientTeacherId !== teacher.id) {
            return false;
          }

          // 2. Se la prenotazione ha un ID cliente univoco e coincide (solo se non viola il docente di riferimento)
          if (b.clienteId && c.id === b.clienteId) return true;

          const cFullName = `${c.nome} ${c.cognome}`.trim().toLowerCase();
          const cleanNorm = cleanRawName.toLowerCase();

          // 3. Match esatto nome + cognome completo (es. "Mattia Sacco" === "mattia sacco")
          if (cFullName === cleanNorm) return true;

          // 4. Se la prenotazione specifica SOLO il nome di battesimo (es. "Mattia" o "Diego" o "Alessandro" senza cognome):
          // può matchare SOLO se l'allievo in anagrafica è esplicitamente registrato sotto QUESTO STESSO docente!
          if (!cleanRawName.includes(' ') && c.nome.trim().toLowerCase() === cleanNorm) {
            if (clientTeacherId && clientTeacherId === teacher.id) {
              return true;
            }
            if (!c.cognome || !c.cognome.trim()) {
              return true;
            }
          }

          return false;
        });

        let nome = toTitleCase(cleanRawName);
        let cognome = '';
        if (matchedClient) {
          nome = matchedClient.nome;
          cognome = matchedClient.cognome;
        } else {
          const parts = toTitleCase(cleanRawName).split(' ');
          nome = parts[0] || toTitleCase(cleanRawName);
          cognome = parts.slice(1).join(' ');
        }

        // REGOLA: Il corso & strumento deve essere lo stesso inserito nel docente di riferimento (materieInsegnamento)
        const teacherStaff =
          teacher.staffMember ||
          staff.find(
            (s) =>
              s.id === teacher.id ||
              `${s.nome} ${s.cognome}`.trim().toLowerCase() === teacher.nomeCompleto.toLowerCase() ||
              s.nome.trim().toLowerCase() === teacher.nomeCompleto.trim().toLowerCase()
          );

        let corso = teacherStaff?.materieInsegnamento?.trim() || '';

        // Se il docente non ha ancora materie specificate, fallback basato sul docente noto
        if (!corso) {
          const tNome = (teacher.nomeCompleto || '').toLowerCase();
          if (tNome.includes('gabriele')) corso = 'Chitarra & Teoria';
          else if (tNome.includes('michael')) corso = 'Batteria';
          else if (tNome.includes('luca')) corso = 'Batteria & Percussioni';
          else if (tNome.includes('alessandro')) corso = 'Basso & Batteria';
          else if (tNome.includes('silvia')) corso = 'Canto Moderno';
          else if (matchedClient?.corsoDidattico) corso = matchedClient.corsoDidattico;
          else if (detectedCorso) corso = detectedCorso;
          else corso = 'Corso Musicale';
        }

        const baseId = b.clienteId && !b.clienteId.startsWith('manual-')
          ? b.clienteId
          : `student-${cleanRawName.replace(/\s+/g, '-').toLowerCase()}`;
        const studentUniqueId = `${baseId}_${teacher.id}`;

        const studentObj: Client = matchedClient
          ? {
              ...matchedClient,
              id: studentUniqueId,
              isAllievo: true,
              corsoDidattico: corso,
              insegnanteRiferimentoNome: teacher.nomeCompleto,
              insegnanteRiferimentoId: teacher.id,
            }
          : {
              id: studentUniqueId,
              nome,
              cognome,
              codiceFiscale: '',
              residenza: 'Latina (LT)',
              sesso: 'M',
              dataNascita: '2000-01-01',
              luogoNascita: 'Latina',
              telefono: '+39 ',
              email: '',
              statoTesseramento: 'attivo',
              numeroTessera: `TS-2026-ALL`,
              dataTesseramento: b.data || '2026-10-01',
              dataScadenzaTesseramento: '2027-10-01',
              quotaTesseramento: 10,
              statoQuota: 'pagato',
              quotaPagata: true,
              descrizioneStrumentazione: 'Strumentazione allievo didattico',
              gruppoBand: `Corso ${corso}`,
              isAllievo: true,
              corsoDidattico: corso,
              insegnanteRiferimentoId: teacher.id,
              insegnanteRiferimentoNome: teacher.nomeCompleto,
              quotaMensileCorso: 90,
              note: b.note || '',
            };

        allieviMap.set(compositeKey, {
          student: studentObj,
          allLessons: [],
          monthlyLessons: [],
          primaryTeacherName: teacher.nomeCompleto,
          primaryTeacherId: teacher.id,
          teacherIds: new Set([teacher.id]),
          teacherNames: new Set([teacher.nomeCompleto]),
          corsoStrumento: corso,
        });
      }

      return allieviMap.get(compositeKey)!;
    };

    allLessonBookings.forEach((b) => {
      const entry = getOrCreateStudent(b);
      if (!entry) return;

      entry.allLessons.push(b);

      if (b.data && b.data.startsWith(monthStr)) {
        entry.monthlyLessons.push(b);
      }
    });

    const result: Array<{
      student: Client;
      monthlyLessons: Booking[];
      allLessons: Booking[];
      completedLessons: Booking[];
      upcomingLessons: Booking[];
      totalOre: number;
      completedOre: number;
      payment: StudentMonthlyPayment | null;
      isPaid: boolean;
      dataPagamento?: string;
      oraPagamento?: string;
      dataOraRegistrazione?: string;
      importo: number;
      teacherName: string;
      teacherId: string;
      teacherIds: Set<string>;
      teacherNames: Set<string>;
      corsoDidattico: string;
    }> = [];

    allieviMap.forEach((entry) => {
      entry.monthlyLessons.sort((a, b) => {
        const d = a.data.localeCompare(b.data);
        if (d !== 0) return d;
        return a.oraInizio.localeCompare(b.oraInizio);
      });

      // Solo le lezioni svolte fino a quel giorno / orario
      const completedLessons = entry.monthlyLessons.filter(isLessonCompleted);
      const upcomingLessons = entry.monthlyLessons.filter((b) => !isLessonCompleted(b));

      const totalOre = entry.monthlyLessons.reduce((sum, b) => sum + (b.durataOre || 1), 0);
      const completedOre = completedLessons.reduce((sum, b) => sum + (b.durataOre || 1), 0);

      const studentFullName = `${entry.student.nome} ${entry.student.cognome}`.trim();
      const paymentRec = studentPaymentService.getPayment(entry.student.id, monthStr, studentFullName);

      // REGOLA UTENTE: Lo stato delle quote deve essere 'da_saldare' di default
      // È pagato SOLO se esiste una registrazione esplicita di pagamento
      const isPaid = paymentRec ? paymentRec.stato === 'pagato' : false;
      const dataPagamento = isPaid ? paymentRec?.dataPagamento : undefined;
      const oraPagamento = isPaid ? paymentRec?.oraPagamento : undefined;
      const dataOraRegistrazione = isPaid ? paymentRec?.dataOraRegistrazione : undefined;
      const importo = paymentRec?.importo !== undefined ? paymentRec.importo : (entry.student.quotaMensileCorso || 90);

      const lessonWithTeacher =
        entry.monthlyLessons.find((l) => l.insegnanteNome || l.insegnanteId) ||
        entry.allLessons.find((l) => l.insegnanteNome || l.insegnanteId);
      const activeTeacherName = lessonWithTeacher?.insegnanteNome || entry.primaryTeacherName || 'Insegnante';
      const activeTeacherId = lessonWithTeacher?.insegnanteId || entry.primaryTeacherId || '';

      result.push({
        student: entry.student,
        monthlyLessons: entry.monthlyLessons,
        allLessons: entry.allLessons,
        completedLessons,
        upcomingLessons,
        totalOre,
        completedOre,
        payment: paymentRec,
        isPaid,
        dataPagamento,
        oraPagamento,
        dataOraRegistrazione,
        importo,
        teacherName: activeTeacherName,
        teacherId: activeTeacherId,
        teacherIds: entry.teacherIds,
        teacherNames: entry.teacherNames,
        corsoDidattico: entry.corsoStrumento,
      });
    });

    return result.sort((a, b) =>
      `${a.student.nome} ${a.student.cognome}`.localeCompare(`${b.student.nome} ${b.student.cognome}`)
    );
  }, [bookings, clients, monthStr, todayISO, nowMinutes, paymentsTimestamp]);

  // Allievi da visualizzare per il mese selezionato
  const activeStudentsForMonth = useMemo(() => {
    const hasLessonsInMonth = studentsWithStats.some((item) => item.monthlyLessons.length > 0);
    if (hasLessonsInMonth) {
      return studentsWithStats.filter((item) => item.monthlyLessons.length > 0);
    }
    return studentsWithStats;
  }, [studentsWithStats]);

  // Filtro applicato (ricerca, docente, stato pagamento)
  const filteredStudents = useMemo(() => {
    return activeStudentsForMonth.filter((item) => {
      const { student, teacherName, teacherId, isPaid, teacherIds, monthlyLessons, allLessons } = item;

      // 1. Ricerca testo
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const fullText = `${student.nome} ${student.cognome} ${student.codiceFiscale || ''} ${student.corsoDidattico || ''} ${student.telefono || ''} ${teacherName}`.toLowerCase();
        if (!fullText.includes(query)) return false;
      }

      // 2. Filtro Docente: ogni docente vede ESCLUSIVAMENTE i propri allievi e le proprie lezioni
      if (activeTeacherFilter !== 'all') {
        const selectedTeacher = teachersList.find((t) => t.id === activeTeacherFilter) || staff.find((s) => s.id === activeTeacherFilter);
        const tFullName = selectedTeacher ? `${selectedTeacher.nome} ${selectedTeacher.cognome}`.toLowerCase().trim() : '';

        const matchId = teacherId === activeTeacherFilter;
        const matchName = Boolean(tFullName && teacherName.toLowerCase().trim() === tFullName);

        if (!matchId && !matchName) return false;
      }

      // 3. Filtro Stato Pagamento
      if (paymentStatusFilter === 'pagato' && !isPaid) return false;
      if (paymentStatusFilter === 'da_saldare' && isPaid) return false;

      return true;
    });
  }, [activeStudentsForMonth, searchTerm, selectedTeacherId, paymentStatusFilter, teachersList]);

  // KPI totali del mese
  const totalStudentsInMonth = activeStudentsForMonth.length;
  const filteredCount = filteredStudents.length;

  const totalMonthlyCompletedHours = useMemo(() => {
    return activeStudentsForMonth.reduce((sum, item) => sum + item.completedOre, 0);
  }, [activeStudentsForMonth]);

  const totalMonthlyCompletedLessonsCount = useMemo(() => {
    return activeStudentsForMonth.reduce((sum, item) => sum + item.completedLessons.length, 0);
  }, [activeStudentsForMonth]);

  const paidStudentsCount = useMemo(() => {
    return activeStudentsForMonth.filter((item) => item.isPaid).length;
  }, [activeStudentsForMonth]);

  const unpaidStudentsCount = useMemo(() => {
    return activeStudentsForMonth.filter((item) => !item.isPaid).length;
  }, [activeStudentsForMonth]);

  const totalCollectedEuros = useMemo(() => {
    return activeStudentsForMonth
      .filter((item) => item.isPaid)
      .reduce((sum, item) => sum + (item.importo || 0), 0);
  }, [activeStudentsForMonth]);

  const totalPendingEuros = useMemo(() => {
    return activeStudentsForMonth
      .filter((item) => !item.isPaid)
      .reduce((sum, item) => sum + (item.importo || 0), 0);
  }, [activeStudentsForMonth]);

  // Apertura modal dettaglio allievo
  const handleOpenDetail = (st: Client) => {
    setSelectedStudent(st);
    setIsDetailModalOpen(true);
  };

  // Creazione nuovo allievo rapido
  const handleCreateNewStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNome.trim() || !newCognome.trim()) return;

    const assignedTeacher = staff.find((s) => s.id === newTeacherId);
    const newStudentId = generateUUID();
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
      descrizioneStrumentazione: 'Strumentazione allievo didattico',
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

  /**
   * REGISTRAZIONE PAGAMENTO:
   * Quando premi il tasto "Saldato", registra la data e l'ora esatta di registrazione.
   * Se viene riaperto ("Da Saldare"), rimuove data e ora.
   */
  const handleQuickTogglePayment = (item: typeof filteredStudents[0]) => {
    const fullName = `${item.student.nome} ${item.student.cognome}`.trim();
    const now = new Date();
    const currentStatus = item.isPaid;
    const newStatus: StudentPaymentStatus = currentStatus ? 'da_saldare' : 'pagato';

    const nowISO = formatDateToISO(now);
    const nowTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const newRecord: StudentMonthlyPayment = {
      id: `${item.student.id}_${monthStr}`,
      clienteId: item.student.id,
      clienteNome: fullName,
      mese: monthStr,
      stato: newStatus,
      dataPagamento: newStatus === 'pagato' ? nowISO : undefined,
      oraPagamento: newStatus === 'pagato' ? nowTime : undefined,
      dataOraRegistrazione: newStatus === 'pagato' ? now.toISOString() : undefined,
      importo: item.importo || item.student.quotaMensileCorso || 90,
      note: newStatus === 'pagato' ? `Pagamento registrato il ${nowISO} alle ore ${nowTime}` : undefined,
    };
    studentPaymentService.savePayment(newRecord);
  };

  // Esportazione Excel compatibile (.CSV con separatore punto e virgola e UTF-8 BOM, senza metodo)
  const exportToExcelCsv = () => {
    const headers = [
      '#',
      'Cognome',
      'Nome',
      'Telefono',
      'Corso / Strumento',
      'Docente',
      'Ore Svolte Fino ad Oggi',
      'N. Lezioni Svolte',
      'Date Lezioni Svolte',
      'Stato Quota',
      'Data & Ora Pagamento',
    ];

    const rows = filteredStudents.map((item, idx) => {
      const datesStr = item.completedLessons.map((l) => {
        const parts = l.data.split('-');
        const dateFmt = `${parts[2]}/${parts[1]}`;
        return `${dateFmt} (${l.oraInizio}-${l.oraFine})`;
      }).join('; ');

      const paymentTimestampStr = item.isPaid && item.dataPagamento
        ? `${formatDateItalian(item.dataPagamento)}${item.oraPagamento ? ` ore ${item.oraPagamento}` : ''}`
        : 'In attesa saldo';

      return [
        idx + 1,
        `"${item.student.cognome || ''}"`,
        `"${item.student.nome}"`,
        `"${item.student.telefono || ''}"`,
        `"${item.corsoDidattico}"`,
        `"${item.teacherName}"`,
        item.completedOre,
        item.completedLessons.length,
        `"${datesStr || 'Nessuna lezione svolta finora'}"`,
        item.isPaid ? 'SALDATO' : 'DA SALDARE',
        `"${paymentTimestampStr}"`,
      ].join(';');
    });

    const summaryRow = [
      'TOTALI',
      '',
      '',
      '',
      '',
      '',
      totalMonthlyCompletedHours,
      totalMonthlyCompletedLessonsCount,
      '',
      `Saldati: ${paidStudentsCount} / ${filteredCount}`,
      '',
    ].join(';');

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows, summaryRow].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Registro_Allievi_${monthName}_${currentYear}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Esportazione PDF Vettoriale A4 con jsPDF
  const exportToPdf = () => {
    generateStudentRegistryPdf({
      monthName,
      currentYear,
      studioInfo,
      selectedTeacherName: selectedTeacherObj ? `${selectedTeacherObj.nome} ${selectedTeacherObj.cognome}` : 'Tutti i Docenti',
      items: filteredStudents,
      totalStudents: filteredCount,
      totalCompletedHours: totalMonthlyCompletedHours,
      totalCompletedLessons: totalMonthlyCompletedLessonsCount,
      totalCollected: totalCollectedEuros,
      totalPending: totalPendingEuros,
    });
  };

  const selectedTeacherObj = teachersList.find((t) => t.id === activeTeacherFilter) || staff.find((s) => s.id === activeTeacherFilter);

  return (
    <div className="space-y-4 animate-in fade-in duration-200">

      {/* ── STAMPA: INTESTAZIONE UFFICIALE (VISIBILE SOLO IN STAMPA) ── */}
      <div className="hidden print:block mb-4 border-b-2 border-slate-900 pb-3">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-xl font-black text-slate-900 uppercase tracking-tight">
              {studioInfo.nome} • REGISTRO ALLIEVI &amp; LEZIONI
            </h1>
            <p className="text-xs text-slate-600 mt-0.5">
              Prospetto Ufficiale delle Presenze Svolte e Quote Mensili
            </p>
          </div>
          <div className="text-right">
            <span className="text-sm font-black text-slate-900 uppercase block">
              MESE: {monthName} {currentYear}
            </span>
            <span className="text-xs text-slate-600 block">
              Docente: {selectedTeacherObj ? `${selectedTeacherObj.nome} ${selectedTeacherObj.cognome}` : 'Tutti i Docenti'}
            </span>
          </div>
        </div>
      </div>

      {/* ── 1. HEADER PRINCIPALE: Titolo, Navigazione e Azioni Rapide ── */}
      <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-slate-200 dark:border-neutral-800 p-4 sm:p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-amber-500/15 text-amber-600 dark:text-yellow-400 border border-amber-500/30 flex items-center justify-center shrink-0 shadow-xs">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                Stato Allievi &amp; Lezioni
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black tracking-wider uppercase bg-amber-400 text-slate-950 shadow-xs">
                {totalStudentsInMonth} Allievi in {monthName}
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-neutral-400 mt-0.5">
              Visualizzazione delle lezioni svolte fino ad oggi e gestione quote (default: da saldare)
            </p>
          </div>
        </div>

        {/* Controlli Mese e Pulsanti Azione */}
        <div className="flex items-center gap-2 flex-wrap self-start md:self-auto shrink-0">
          {/* Pulsante rapido Ottobre 2026 */}
          <button
            type="button"
            onClick={handleGoOctober}
            className={`px-3 py-1.5 rounded-xl text-xs font-black border transition-all cursor-pointer ${
              monthStr === '2026-10'
                ? 'bg-amber-400 text-slate-950 border-amber-400 shadow-xs'
                : 'bg-slate-50 dark:bg-neutral-950 text-slate-700 dark:text-amber-300 border-slate-200 dark:border-neutral-800 hover:bg-slate-100 dark:hover:bg-neutral-800'
            }`}
            title="Apri mese completo Ottobre 2026"
          >
            Ottobre 2026 ★
          </button>

          {/* Navigatore Mese */}
          <div className="flex items-center bg-slate-100 dark:bg-neutral-950 rounded-xl p-1 border border-slate-200 dark:border-neutral-800 shadow-xs">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1.5 rounded-lg text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-neutral-800 transition-colors cursor-pointer"
              title="Mese precedente"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 text-xs font-black text-slate-900 dark:text-yellow-300 min-w-[130px] text-center">
              {monthName} {currentYear}
            </span>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1.5 rounded-lg text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-neutral-800 transition-colors cursor-pointer"
              title="Mese successivo"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={handleGoCurrentMonth}
            className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 dark:bg-neutral-950 hover:bg-slate-200 dark:hover:bg-neutral-800 text-slate-700 dark:text-neutral-300 border border-slate-200 dark:border-neutral-800 transition-colors cursor-pointer"
          >
            Oggi
          </button>

          {/* Esporta Excel (.CSV) */}
          <button
            type="button"
            onClick={exportToExcelCsv}
            className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            title="Scarica foglio Excel compatibile .CSV con le lezioni svolte e quote"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span className="font-bold">Esporta Excel</span>
          </button>

          {/* Esporta PDF (Download Diretto Vettoriale) */}
          <button
            type="button"
            onClick={exportToPdf}
            className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            title="Scarica direttamente il documento PDF formattato del registro allievi"
          >
            <Download className="w-4 h-4" />
            <span className="font-bold">Esporta PDF</span>
          </button>

          {/* Stampa Registro A4 / Salva in PDF */}
          <button
            type="button"
            onClick={() => window.print()}
            className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-slate-900 dark:bg-neutral-800 hover:bg-slate-800 dark:hover:bg-neutral-700 text-white border border-slate-800 dark:border-neutral-700 flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            title="Stampa foglio presenze e quote o Salva come PDF"
          >
            <Printer className="w-4 h-4 text-slate-300" />
            <span>Stampa A4</span>
          </button>

          {/* Nuovo Allievo */}
          <button
            type="button"
            onClick={() => setIsNewStudentModalOpen(true)}
            className="px-3.5 py-1.5 rounded-xl text-xs font-black bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Nuovo Allievo</span>
          </button>
        </div>
      </div>

      {/* ── 2. KPI SUMMARY CARDS (Compatibili Light & Dark) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 print:hidden">
        {/* KPI 1: Allievi */}
        <div className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-neutral-400 uppercase tracking-wider">Allievi Iscritti</span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 dark:text-white">{totalStudentsInMonth}</span>
            <span className="text-xs text-slate-500 dark:text-neutral-400">allievi a calendario</span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-neutral-400 mt-1">
            Frequenza corsi didattici in {monthName}
          </p>
        </div>

        {/* KPI 2: Lezioni Svolte Mese Fino ad Oggi */}
        <div className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-neutral-400 uppercase tracking-wider">Lezioni Svolte Finora</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{totalMonthlyCompletedHours} ore</span>
            <span className="text-xs text-slate-500 dark:text-neutral-400">({totalMonthlyCompletedLessonsCount} lezioni completate)</span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-neutral-400 mt-1">
            Lezioni svolte fino al {new Date().toLocaleDateString('it-IT')}
          </p>
        </div>

        {/* KPI 3: Pagamenti Mensilità */}
        <div className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-neutral-400 uppercase tracking-wider">Pagamenti Quote</span>
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-blue-600 dark:text-blue-400">
              {paidStudentsCount} / {totalStudentsInMonth}
            </span>
            <span className="text-xs text-slate-500 dark:text-neutral-400 font-bold">
              ({totalStudentsInMonth > 0 ? Math.round((paidStudentsCount / totalStudentsInMonth) * 100) : 0}%)
            </span>
          </div>
          <div className="w-full bg-slate-100 dark:bg-neutral-800 h-2 rounded-full mt-2 overflow-hidden">
            <div
              className="bg-blue-600 dark:bg-blue-500 h-full rounded-full transition-all duration-300"
              style={{
                width: `${totalStudentsInMonth > 0 ? (paidStudentsCount / totalStudentsInMonth) * 100 : 0}%`,
              }}
            />
          </div>
        </div>
      </div>

      {/* ── 3. BARRA STRUMENTI: RICERCA, FILTRO DOCENTI E VISTA ── */}
      <div className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-2xl p-3.5 sm:p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs print:hidden shadow-xs">
        {/* Ricerca per nome/telefono/corso */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cerca allievo per nome, strumento, telefono..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-neutral-950 border border-slate-200 dark:border-neutral-800 text-slate-900 dark:text-white placeholder:text-slate-400 text-xs focus:border-amber-500 focus:outline-none"
          />
        </div>

        {/* Filtri */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Filtro Docente: se profilo insegnante singolo, bloccato sul proprio profilo; se admin, scelta libera */}
          {isTeacher && !isAdmin && user?.staffId ? (
            <div className="flex items-center gap-1.5 bg-amber-500/10 dark:bg-amber-500/20 px-3 py-1.5 rounded-xl border border-amber-500/30">
              <GraduationCap className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-slate-900 dark:text-neutral-200 text-xs font-bold">
                {selectedTeacherObj ? `${selectedTeacherObj.nome} ${selectedTeacherObj.cognome}` : user.nome}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-neutral-950 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-neutral-800">
              <GraduationCap className="w-3.5 h-3.5 text-amber-500" />
              <select
                value={selectedTeacherId}
                onChange={(e) => setSelectedTeacherId(e.target.value)}
                className="bg-transparent text-slate-900 dark:text-neutral-200 text-xs font-semibold focus:outline-none cursor-pointer"
              >
                <option value="all">Tutti i Docenti</option>
                {teachersList.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nome} {t.cognome}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Filtro Stato Pagamento */}
          <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-neutral-950 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-neutral-800">
            <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
            <select
              value={paymentStatusFilter}
              onChange={(e) => setPaymentStatusFilter(e.target.value as any)}
              className="bg-transparent text-slate-900 dark:text-neutral-200 text-xs font-semibold focus:outline-none cursor-pointer"
            >
              <option value="all">Tutti i Pagamenti</option>
              <option value="pagato">Saldati ✓</option>
              <option value="da_saldare">Da Saldare ⚠️</option>
            </select>
          </div>

          {/* Switch Grid / Table */}
          <div className="flex items-center bg-slate-100 dark:bg-neutral-950 p-1 rounded-xl border border-slate-200 dark:border-neutral-800">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`p-1.5 px-2.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-amber-400 text-slate-950 shadow-xs'
                  : 'text-slate-600 dark:text-neutral-400 hover:text-slate-950 dark:hover:text-white'
              }`}
              title="Visualizzazione Registro Excel"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Tabella Excel</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`p-1.5 px-2.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-amber-400 text-slate-950 shadow-xs'
                  : 'text-slate-600 dark:text-neutral-400 hover:text-slate-950 dark:hover:text-white'
              }`}
              title="Visualizzazione a Schede"
            >
              <Grid className="w-3.5 h-3.5" />
              <span>Schede</span>
            </button>
          </div>
        </div>
      </div>

      {/* Info Ciclo Posticipato se filtrato Michael Bertin */}
      {selectedTeacherObj && (selectedTeacherObj.cicloFatturazioneLezioni === 'mese_precedente_posticipato' || selectedTeacherObj.nome.toLowerCase().includes('michael')) && (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-300 dark:border-amber-700/60 text-xs flex items-center justify-between gap-3 text-amber-950 dark:text-amber-200 animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <span className="text-base">⏳</span>
            <div>
              <strong className="font-extrabold uppercase tracking-wide">
                Nota Contabile Docente ({selectedTeacherObj.nome} {selectedTeacherObj.cognome}):
              </strong>
              <span className="ml-1.5 opacity-90">
                Questo insegnante adotta la liquidazione posticipata (il mese precedente viene saldato a inizio mese successivo). Per visualizzare le quote sala prova (5€/h) e lo stato del saldo, apri la scheda <strong>"Ore Insegnanti"</strong> o <strong>"Finanze"</strong>.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── 4. CONTENUTO PRINCIPALE: TABELLA EXCEL o SCHEDE ── */}
      {filteredStudents.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-neutral-900 border border-dashed border-slate-200 dark:border-neutral-800 rounded-2xl space-y-3">
          <GraduationCap className="w-12 h-12 text-slate-400 dark:text-neutral-600 mx-auto" />
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            Nessun allievo trovato per i filtri selezionati in {monthName} {currentYear}
          </h3>
          <p className="text-xs text-slate-500 dark:text-neutral-400 max-w-md mx-auto">
            Verifica il mese selezionato o reimposta il filtro docenti. Prova a cliccare su &quot;Ottobre 2026 ★&quot;.
          </p>
          <div className="flex items-center justify-center gap-2 pt-2">
            <button
              type="button"
              onClick={handleGoOctober}
              className="px-4 py-2 rounded-xl text-xs font-black bg-amber-400 hover:bg-amber-300 text-slate-950 cursor-pointer shadow-xs"
            >
              Vai a Ottobre 2026 ★
            </button>
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setSelectedTeacherId('all');
                setPaymentStatusFilter('all');
              }}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-neutral-800 hover:bg-slate-200 dark:hover:bg-neutral-700 text-slate-700 dark:text-neutral-200 cursor-pointer"
            >
              Reimposta Filtri
            </button>
          </div>
        </div>
      ) : viewMode === 'table' ? (
        /* ═════════════════════════════════════════════════════════════════
           ── TABELLA MASTER STILE EXCEL (FOGLIO PRESENZE & QUOTE) ──
           ═════════════════════════════════════════════════════════════════ */
        <div className="bg-white dark:bg-neutral-900 border border-slate-300 dark:border-neutral-700 rounded-xl overflow-hidden shadow-xs print:overflow-visible print:border-none print:shadow-none print:m-0 print:p-0">
          <div className="overflow-x-auto print:overflow-visible">
            <table className="w-full text-left text-xs border-collapse print:text-[9.5px] print:w-full">
              {/* Header Tabella Excel (senza metodo) */}
              <thead className="bg-slate-100 dark:bg-neutral-950 text-slate-700 dark:text-neutral-300 font-extrabold uppercase tracking-wider text-[11px] border-b-2 border-slate-300 dark:border-neutral-700">
                <tr>
                  <th className="p-2.5 px-3 border-r border-slate-200 dark:border-neutral-800 w-10 text-center">#</th>
                  <th className="p-2.5 px-3 border-r border-slate-200 dark:border-neutral-800 min-w-[200px]">Allievo</th>
                  <th className="p-2.5 px-3 border-r border-slate-200 dark:border-neutral-800 min-w-[150px]">Corso &amp; Strumento</th>
                  <th className="p-2.5 px-3 border-r border-slate-200 dark:border-neutral-800 min-w-[130px]">Docente</th>
                  <th className="p-2.5 px-3 border-r border-slate-200 dark:border-neutral-800 min-w-[260px]">
                    Lezioni Svolte Fino ad Oggi ({monthName})
                  </th>
                  <th className="p-2.5 px-3 border-r border-slate-200 dark:border-neutral-800 text-center w-24">Tot. Ore</th>
                  <th className="p-2.5 px-3 border-r border-slate-200 dark:border-neutral-800 text-center min-w-[140px]">
                    Stato Quota
                  </th>
                  <th className="p-2.5 px-3 border-r border-slate-200 dark:border-neutral-800 min-w-[160px]">
                    Data &amp; Ora Registrazione Saldo
                  </th>
                  <th className="p-2.5 px-3 text-center w-20 print:hidden">Dossier</th>
                </tr>
              </thead>

              {/* Righe Tabella Excel */}
              <tbody className="divide-y divide-slate-200 dark:divide-neutral-800">
                {filteredStudents.map((item, idx) => {
                  const {
                    student,
                    isPaid,
                    payment,
                    dataPagamento,
                    oraPagamento,
                    importo,
                    completedLessons,
                    completedOre,
                    teacherName,
                    corsoDidattico,
                  } = item;

                  const cleanPhone = (student.telefono || '').replace(/[^\d+]/g, '');

                  return (
                    <tr
                      key={student.id}
                      className="even:bg-slate-50/70 dark:even:bg-neutral-850/40 hover:bg-amber-50/60 dark:hover:bg-neutral-800/60 transition-colors"
                    >
                      {/* 1. Indice Progressivo */}
                      <td className="p-2.5 px-3 border-r border-slate-200 dark:border-neutral-800 text-center font-mono font-bold text-slate-500 dark:text-neutral-400">
                        {idx + 1}
                      </td>

                      {/* 2. Allievo (Nome in chiaro, nitido e ben visibile) */}
                      <td className="p-2.5 px-3 border-r border-slate-200 dark:border-neutral-800">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 flex items-center justify-center font-black text-xs shrink-0 shadow-2xs">
                            {student.nome[0]}{(student.cognome && student.cognome[0]) || ''}
                          </div>
                          <div className="min-w-0">
                            <span className="block font-black text-slate-900 dark:text-white text-sm leading-tight truncate">
                              {student.nome} {student.cognome}
                            </span>
                            <div className="flex items-center gap-2 mt-0.5">
                              {student.telefono && student.telefono !== '+39 ' && (
                                <span className="text-[11px] text-slate-600 dark:text-neutral-400 font-mono">
                                  {student.telefono}
                                </span>
                              )}
                              {cleanPhone && cleanPhone.length > 5 && (
                                <a
                                  href={`https://wa.me/${cleanPhone.startsWith('+') ? cleanPhone.replace('+', '') : `39${cleanPhone}`}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-emerald-600 dark:text-emerald-400 hover:underline inline-flex items-center gap-0.5 text-[10px] font-bold print:hidden"
                                  title="Scrivi su WhatsApp"
                                >
                                  <MessageSquare className="w-3 h-3" />
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* 3. Corso / Strumento */}
                      <td className="p-2.5 px-3 border-r border-slate-200 dark:border-neutral-800">
                        <span className="font-bold text-slate-800 dark:text-neutral-200 block text-xs">
                          {corsoDidattico}
                        </span>
                        <span className="text-[10px] text-slate-500 dark:text-neutral-400 italic">
                          Frequenza mensile
                        </span>
                      </td>

                      {/* 4. Docente */}
                      <td className="p-2.5 px-3 border-r border-slate-200 dark:border-neutral-800">
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-purple-100 text-purple-900 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800 inline-block">
                          {teacherName}
                        </span>
                      </td>

                      {/* 5. Lezioni Svolte Fino ad Oggi (SOLO quelle già completate!) */}
                      <td className="p-2.5 px-3 border-r border-slate-200 dark:border-neutral-800">
                        {completedLessons.length === 0 ? (
                          <span className="text-slate-400 dark:text-neutral-500 italic text-[11px] flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-400 dark:text-neutral-500 shrink-0" />
                            Nessuna lezione svolta finora
                          </span>
                        ) : (
                          <div className="flex flex-wrap gap-1 max-w-[340px]">
                            {completedLessons.map((l) => {
                              const dayNum = l.data.split('-')[2];
                              return (
                                <span
                                  key={l.id}
                                  className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border flex items-center gap-1 bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                                  title={`${formatDateItalian(l.data)} (${l.oraInizio}-${l.oraFine}) - Svolta`}
                                >
                                  <Check className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400 stroke-[3]" />
                                  <span>{dayNum}/{l.data.split('-')[1]}</span>
                                  <span className="text-[9px] opacity-80">({l.oraInizio})</span>
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </td>

                      {/* 6. Totale Ore Svolte Fino ad Oggi */}
                      <td className="p-2.5 px-3 border-r border-slate-200 dark:border-neutral-800 text-center">
                        <span className="font-black text-emerald-700 dark:text-emerald-400 text-sm block">
                          {completedOre} h
                        </span>
                        <span className="text-[10px] text-slate-500 dark:text-neutral-400 font-medium">
                          {completedLessons.length} lez. svolte
                        </span>
                      </td>

                      {/* 7. Stato Quota con toggle rapido (DEFAULT: DA SALDARE) */}
                      <td className="p-2.5 px-3 border-r border-slate-200 dark:border-neutral-800 text-center">
                        <button
                          type="button"
                          onClick={() => handleQuickTogglePayment(item)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-black uppercase tracking-wider border cursor-pointer transition-all shadow-2xs hover:scale-105 active:scale-95 ${
                            isPaid
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/40'
                              : 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-500/20 dark:text-rose-300 dark:border-rose-500/40 hover:bg-rose-200'
                          }`}
                          title="Clicca per registrare o annullare il pagamento con data e ora"
                        >
                          {isPaid ? 'SALDATO ✓' : 'DA SALDARE ⚠️'}
                        </button>
                      </td>

                      {/* 8. Data & Ora Registrazione Saldo */}
                      <td className="p-2.5 px-3 border-r border-slate-200 dark:border-neutral-800">
                        {isPaid && (dataPagamento || payment?.dataPagamento) ? (
                          <div className="text-xs">
                            <span className="font-bold text-slate-900 dark:text-yellow-200 block">
                              {formatDateItalian(dataPagamento || payment!.dataPagamento!)}
                            </span>
                            {(oraPagamento || payment?.oraPagamento) ? (
                              <span className="text-[11px] font-mono text-emerald-700 dark:text-emerald-400 font-bold flex items-center gap-1 mt-0.5">
                                <Clock className="w-3 h-3 inline shrink-0" />
                                ore {oraPagamento || payment!.oraPagamento}
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-500 dark:text-neutral-400">
                                Registrato
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 dark:text-neutral-500 italic text-xs">
                            Da saldare (default)
                          </span>
                        )}
                      </td>

                      {/* 9. Azioni: Dettaglio / Dossier PDF */}
                      <td className="p-2.5 px-3 text-center print:hidden">
                        <button
                          type="button"
                          onClick={() => handleOpenDetail(student)}
                          className="p-1.5 px-2 rounded-xl bg-slate-100 hover:bg-amber-400 hover:text-slate-950 text-slate-700 border border-slate-300 dark:bg-neutral-800 dark:hover:bg-amber-400 dark:hover:text-slate-950 dark:text-neutral-200 dark:border-neutral-700 transition-colors cursor-pointer inline-flex items-center justify-center gap-1 text-xs font-bold shadow-2xs"
                          title="Apri Dossier Completo dell'Allievo"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              {/* Riga Totali Excel (SOMMA) */}
              <tfoot className="bg-slate-100 dark:bg-neutral-950 font-black border-t-2 border-slate-300 dark:border-neutral-700 text-slate-900 dark:text-white">
                <tr>
                  <td className="p-3 px-4 border-r border-slate-200 dark:border-neutral-800 text-center text-xs" colSpan={2}>
                    TOTALE ({filteredCount} Allievi)
                  </td>
                  <td className="p-3 px-3 border-r border-slate-200 dark:border-neutral-800 text-xs text-slate-500 dark:text-neutral-400 italic" colSpan={2}>
                    Riepilogo ore svolte fino ad oggi
                  </td>
                  <td className="p-3 px-3 border-r border-slate-200 dark:border-neutral-800 text-xs text-slate-700 dark:text-neutral-300">
                    <strong className="text-emerald-700 dark:text-emerald-400">{totalMonthlyCompletedLessonsCount} lezioni</strong> svolte finora
                  </td>
                  <td className="p-3 px-3 border-r border-slate-200 dark:border-neutral-800 text-center font-black text-emerald-700 dark:text-emerald-400 text-sm">
                    {totalMonthlyCompletedHours} h
                  </td>
                  <td className="p-3 px-3 border-r border-slate-200 dark:border-neutral-800 text-center text-xs">
                    <span className="text-emerald-700 dark:text-emerald-400 font-bold">{paidStudentsCount} saldati</span>
                    {unpaidStudentsCount > 0 && (
                      <span className="text-rose-600 dark:text-rose-400 font-bold ml-1">({unpaidStudentsCount} da saldare)</span>
                    )}
                  </td>
                  <td className="p-3 px-3 border-r border-slate-200 dark:border-neutral-800 text-xs text-slate-500 dark:text-neutral-400">
                    -
                  </td>
                  <td className="p-3 px-3 text-center print:hidden" />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      ) : (
        /* ═════════════════════════════════════════════════════════════════
           ── VISTA A SCHEDE (CARDS) COMPATIBILE LIGHT & DARK ──
           ═════════════════════════════════════════════════════════════════ */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredStudents.map((item) => {
            const {
              student,
              isPaid,
              payment,
              dataPagamento,
              oraPagamento,
              importo,
              completedLessons,
              upcomingLessons,
              completedOre,
              teacherName,
              corsoDidattico,
            } = item;

            const cleanPhone = (student.telefono || '').replace(/[^\d+]/g, '');

            return (
              <div
                key={student.id}
                className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 hover:border-amber-500/50 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col justify-between gap-4 transition-all group"
              >
                {/* Header Scheda Allievo */}
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 flex items-center justify-center font-black text-sm shrink-0">
                        {student.nome[0]}{(student.cognome && student.cognome[0]) || ''}
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white truncate group-hover:text-amber-600 dark:group-hover:text-yellow-300 transition-colors">
                          {student.nome} {student.cognome}
                        </h3>
                        <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-neutral-400 truncate">
                          <span className="font-semibold text-slate-700 dark:text-neutral-300">{corsoDidattico}</span>
                        </div>
                      </div>
                    </div>

                    <span className="px-2.5 py-1 rounded-lg text-[10px] font-black bg-purple-100 text-purple-900 dark:bg-purple-500/15 dark:text-purple-300 border border-purple-200 dark:border-purple-500/30 shrink-0">
                      {teacherName}
                    </span>
                  </div>

                  {/* BOX STATO PAGAMENTO (DATA E ORA) */}
                  <div className={`p-3 rounded-xl border flex items-center justify-between gap-2 ${
                    isPaid
                      ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-500/30 text-emerald-900 dark:text-emerald-300'
                      : 'bg-rose-50 dark:bg-rose-950/20 border-rose-300 dark:border-rose-500/30 text-rose-900 dark:text-rose-300'
                  }`}>
                    <div>
                      <div className="flex items-center gap-1.5 font-bold text-xs">
                        {isPaid ? (
                          <>
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                            <span className="uppercase tracking-wide font-black">Quota Saldata</span>
                          </>
                        ) : (
                          <>
                            <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                            <span className="uppercase tracking-wide font-black">Quota Da Saldare</span>
                          </>
                        )}
                      </div>

                      <p className="text-[11px] mt-1 text-slate-600 dark:text-neutral-300">
                        {isPaid && (dataPagamento || payment?.dataPagamento) ? (
                          <span>
                            Saldato il: <strong className="text-slate-900 dark:text-white font-bold">{formatDateItalian(dataPagamento || payment!.dataPagamento!)}</strong>
                            {(oraPagamento || payment?.oraPagamento) && (
                              <span className="text-emerald-700 dark:text-emerald-400 font-bold ml-1">
                                alle {oraPagamento || payment!.oraPagamento}
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="italic">
                            Stato quota: Da saldare (default)
                          </span>
                        )}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleQuickTogglePayment(item)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold shadow-2xs cursor-pointer transition-all shrink-0 ${
                        isPaid
                          ? 'bg-slate-200 dark:bg-neutral-800 text-slate-700 dark:text-neutral-300 hover:bg-slate-300 border border-slate-300 dark:border-neutral-700'
                          : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs'
                      }`}
                    >
                      {isPaid ? 'Riapri' : 'Salda Ora'}
                    </button>
                  </div>

                  {/* RIEPILOGO LEZIONI SVOLTE FINO AD OGGI */}
                  <div className="bg-slate-50 dark:bg-neutral-950/70 p-3 rounded-xl border border-slate-200 dark:border-neutral-800 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-600 dark:text-neutral-400 flex items-center gap-1 font-semibold">
                        <Clock className="w-3.5 h-3.5 text-amber-500" /> Svolte fino ad oggi:
                      </span>
                      <span className="font-bold text-slate-900 dark:text-white">
                        <strong className="text-emerald-600 dark:text-emerald-400">{completedLessons.length} lezioni</strong> ({completedOre}h)
                      </span>
                    </div>

                    <div className="space-y-1 pt-1.5 border-t border-slate-200 dark:border-neutral-900 max-h-24 overflow-y-auto">
                      {completedLessons.length === 0 ? (
                        <p className="text-[11px] text-slate-400 dark:text-neutral-500 italic">
                          Nessuna lezione svolta finora nel mese
                        </p>
                      ) : (
                        completedLessons.map((l) => (
                          <div key={l.id} className="text-[11px] text-slate-700 dark:text-neutral-300 flex items-center justify-between">
                            <span className="font-semibold text-slate-900 dark:text-white flex items-center gap-1">
                              <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400 stroke-[3]" />
                              {formatDateItalian(l.data)}
                            </span>
                            <span className="font-mono text-slate-800 dark:text-yellow-300 font-bold text-[10px] bg-slate-200 dark:bg-neutral-900 px-1.5 py-0.5 rounded">
                              {l.oraInizio} - {l.oraFine}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                {/* Footer Scheda */}
                <div className="pt-2 border-t border-slate-200 dark:border-neutral-800 flex items-center justify-between gap-2">
                  {cleanPhone && cleanPhone.length > 5 ? (
                    <a
                      href={`https://wa.me/${cleanPhone.startsWith('+') ? cleanPhone.replace('+', '') : `39${cleanPhone}`}?text=${encodeURIComponent(
                        `Ciao ${student.nome}, ti scriviamo da ${studioInfo.nome} in merito alle tue lezioni di musica.`
                      )}`}
                      target="_blank"
                      rel="noreferrer"
                      className="p-2 rounded-lg bg-slate-100 dark:bg-neutral-950 hover:bg-emerald-100 dark:hover:bg-emerald-950/40 text-slate-600 dark:text-neutral-400 hover:text-emerald-700 dark:hover:text-emerald-400 border border-slate-200 dark:border-neutral-800 transition-colors"
                      title="Apri WhatsApp"
                    >
                      <MessageSquare className="w-4 h-4" />
                    </a>
                  ) : <div />}

                  <button
                    type="button"
                    onClick={() => handleOpenDetail(student)}
                    className="px-3.5 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-xs transition-all ml-auto"
                  >
                    <span>Resoconto Dettagliato</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── STAMPA: SPAZIO FIRME (VISIBILE SOLO IN STAMPA) ── */}
      <div className="hidden print:flex justify-between items-end pt-8 mt-6 border-t border-slate-400 text-xs text-slate-900">
        <div>
          <span className="block font-bold">Firma del Docente:</span>
          <span className="block mt-6 border-b border-black w-48" />
        </div>
        <div>
          <span className="block font-bold">Firma della Direzione:</span>
          <span className="block mt-6 border-b border-black w-48" />
        </div>
        <div className="text-right font-mono text-[10px] text-slate-500">
          Generato il {new Date().toLocaleDateString('it-IT')} alle {new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })} con {studioInfo.nome}
        </div>
      </div>

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
          <div className="relative w-full max-w-md bg-white dark:bg-neutral-950 border border-slate-200 dark:border-neutral-800 rounded-2xl shadow-2xl p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-neutral-800">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-amber-500" />
                <h3 className="text-base font-black text-slate-900 dark:text-white">Iscrivi Nuovo Allievo</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsNewStudentModalOpen(false)}
                className="modal-header-btn-blue modal-close-btn-blue shrink-0 flex items-center justify-center w-8 h-8 rounded-lg bg-blue-600 hover:bg-red-600 active:scale-95 text-white transition-all cursor-pointer border border-blue-500 hover:border-red-500 shadow-md shadow-blue-500/25"
                style={{ backgroundColor: '#2563eb', color: '#ffffff', borderColor: '#1d4ed8' }}
                title="Chiudi"
                aria-label="Chiudi finestra"
              >
                <X className="w-4 h-4 text-white stroke-[2.5]" style={{ color: '#ffffff', stroke: '#ffffff' }} />
              </button>
            </div>

            <form onSubmit={handleCreateNewStudent} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-neutral-300 mb-1">Nome</label>
                  <input
                    type="text"
                    required
                    value={newNome}
                    onChange={(e) => setNewNome(e.target.value)}
                    placeholder="es. Simone"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 text-slate-900 dark:text-white text-xs focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-neutral-300 mb-1">Cognome</label>
                  <input
                    type="text"
                    required
                    value={newCognome}
                    onChange={(e) => setNewCognome(e.target.value)}
                    placeholder="es. Ferri"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 text-slate-900 dark:text-white text-xs focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-neutral-300 mb-1">Telefono</label>
                  <input
                    type="tel"
                    value={newTelefono}
                    onChange={(e) => setNewTelefono(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 text-slate-900 dark:text-white text-xs focus:border-amber-500 focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-neutral-300 mb-1">Email</label>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="opzionale"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 text-slate-900 dark:text-white text-xs focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-neutral-300 mb-1">Corso / Strumento</label>
                <input
                  type="text"
                  required
                  value={newCorso}
                  onChange={(e) => setNewCorso(e.target.value)}
                  placeholder="es. Chitarra Elettrica, Canto Moderno, Batteria"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 text-slate-900 dark:text-white text-xs focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-neutral-300 mb-1">Docente Assegnato</label>
                  <select
                    value={newTeacherId}
                    onChange={(e) => {
                      const tId = e.target.value;
                      setNewTeacherId(tId);
                      const chosen = staff.find((s) => s.id === tId);
                      if (chosen?.materieInsegnamento) {
                        setNewCorso(chosen.materieInsegnamento);
                      }
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 text-slate-900 dark:text-white text-xs focus:border-amber-500 focus:outline-none font-medium"
                  >
                    {teachersList.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.nome} {t.cognome}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-neutral-300 mb-1">Quota Mensile (€)</label>
                  <input
                    type="number"
                    min="0"
                    step="5"
                    value={newQuota}
                    onChange={(e) => setNewQuota(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 text-slate-900 dark:text-white text-xs focus:border-amber-500 focus:outline-none font-bold font-mono"
                  />
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-200 dark:border-neutral-800">
                <button
                  type="button"
                  onClick={() => setIsNewStudentModalOpen(false)}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-neutral-800 hover:bg-slate-200 dark:hover:bg-neutral-700 text-slate-700 dark:text-neutral-200"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-black bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-xs"
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
