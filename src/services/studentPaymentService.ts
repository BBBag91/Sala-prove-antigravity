import { StudentMonthlyPayment, StudentPaymentStatus } from '../types';
import { supabaseService } from './supabaseService';
import { isSupabaseConfigured } from '../lib/supabase';

const STORAGE_KEY = 'salaprove_student_payments_v1';
const SEED_NOV2026_REF_KEY = 'salaprove_student_payments_nov2026_foto2_v1';

export interface StudentPaymentLookupAliases {
  rawName?: string;
  teacherId?: string;
  clientIds?: string[];
}

/**
 * Pagamenti di riferimento consolidati per Novembre 2026 (da Foto 2 smartphone):
 * 1. DAVIDE BALDASSERONI -> Saldato Giovedì 5 Novembre 2026 ore 18:06
 * 2. MATTIA SACCO        -> Saldato Lunedì 2 Novembre 2026 ore 17:05
 * 3. MICHELE BELLARDI    -> Saldato Mercoledì 11 Novembre 2026 ore 16:56
 * 4. STEFANO MANZO       -> Saldato Martedì 10 Novembre 2026 ore 17:22
 */
export const REFERENCE_NOV_2026_PAYMENTS: StudentMonthlyPayment[] = [
  {
    id: 'student-davide_staff-1_2026-11',
    clienteId: 'student-davide_staff-1',
    clienteNome: 'DAVIDE BALDASSERONI',
    rawCalendarName: 'Davide',
    insegnanteId: 'staff-1',
    mese: '2026-11',
    stato: 'pagato',
    dataPagamento: '2026-11-05',
    oraPagamento: '18:06',
    dataOraRegistrazione: '2026-11-05T18:06:00.000Z',
    importo: 90,
    note: 'Pagamento registrato il 2026-11-05 alle ore 18:06',
    aggiornatoIl: '2026-11-05T18:06:00.000Z',
  },
  {
    id: 'student-mattia-sacco_staff-1_2026-11',
    clienteId: 'student-mattia-sacco_staff-1',
    clienteNome: 'MATTIA SACCO',
    rawCalendarName: 'Mattia Sacco',
    insegnanteId: 'staff-1',
    mese: '2026-11',
    stato: 'pagato',
    dataPagamento: '2026-11-02',
    oraPagamento: '17:05',
    dataOraRegistrazione: '2026-11-02T17:05:00.000Z',
    importo: 90,
    note: 'Pagamento registrato il 2026-11-02 alle ore 17:05',
    aggiornatoIl: '2026-11-02T17:05:00.000Z',
  },
  {
    id: 'student-michele_staff-1_2026-11',
    clienteId: 'student-michele_staff-1',
    clienteNome: 'MICHELE BELLARDI',
    rawCalendarName: 'Michele',
    insegnanteId: 'staff-1',
    mese: '2026-11',
    stato: 'pagato',
    dataPagamento: '2026-11-11',
    oraPagamento: '16:56',
    dataOraRegistrazione: '2026-11-11T16:56:00.000Z',
    importo: 90,
    note: 'Pagamento registrato il 2026-11-11 alle ore 16:56',
    aggiornatoIl: '2026-11-11T16:56:00.000Z',
  },
  {
    id: 'student-stefano_staff-1_2026-11',
    clienteId: 'student-stefano_staff-1',
    clienteNome: 'STEFANO MANZO',
    rawCalendarName: 'Stefano',
    insegnanteId: 'staff-1',
    mese: '2026-11',
    stato: 'pagato',
    dataPagamento: '2026-11-10',
    oraPagamento: '17:22',
    dataOraRegistrazione: '2026-11-10T17:22:00.000Z',
    importo: 90,
    note: 'Pagamento registrato il 2026-11-10 alle ore 17:22',
    aggiornatoIl: '2026-11-10T17:22:00.000Z',
  },
];

/**
 * Registrazioni iniziali per il mese di Ottobre 2026 e Novembre 2026
 */
const getDefaultInitialPayments = (): StudentMonthlyPayment[] => {
  return [
    ...REFERENCE_NOV_2026_PAYMENTS,
    // ── ALLIEVI OTTOBRE 2026 ──
    {
      id: `michele-bellardini_2026-10`,
      clienteId: 'manual-1790981535553_staff-1',
      clienteNome: 'MICHELE BELLARDI',
      rawCalendarName: 'Michele',
      insegnanteId: 'staff-1',
      mese: '2026-10',
      stato: 'pagato',
      dataPagamento: '2026-10-05',
      oraPagamento: '17:05',
      importo: 90,
      metodoPagamento: 'bonifico',
      ricevutaNumero: 'R-2026-101',
      note: 'Mensilità lezioni chitarra con Gabriele Piva (4 ore svolte)',
      aggiornatoIl: '2026-10-05T17:05:00.000Z',
    },
    {
      id: `greta-bortolotto_2026-10`,
      clienteId: 'manual-greta-bortolotto_staff-1',
      clienteNome: 'Greta Bortolotto',
      rawCalendarName: 'Greta Bortolotto',
      insegnanteId: 'staff-1',
      mese: '2026-10',
      stato: 'pagato',
      dataPagamento: '2026-10-10',
      oraPagamento: '18:10',
      importo: 90,
      metodoPagamento: 'bonifico',
      ricevutaNumero: 'R-2026-102',
      note: 'Mensilità lezioni con Gabriele Piva',
      aggiornatoIl: '2026-10-10T18:10:00.000Z',
    },
    {
      id: `mattia-sacco_2026-10`,
      clienteId: 'manual-mattia-sacco_staff-1',
      clienteNome: 'Mattia Sacco',
      rawCalendarName: 'Mattia Sacco',
      insegnanteId: 'staff-1',
      mese: '2026-10',
      stato: 'pagato',
      dataPagamento: '2026-10-12',
      oraPagamento: '16:15',
      importo: 90,
      metodoPagamento: 'pos',
      ricevutaNumero: 'R-2026-103',
      note: 'Pagamento POS banco studio',
      aggiornatoIl: '2026-10-12T16:15:00.000Z',
    },
    {
      id: `davide_2026-10`,
      clienteId: 'manual-davide_staff-1',
      clienteNome: 'DAVIDE BALDASSERONI',
      rawCalendarName: 'Davide',
      insegnanteId: 'staff-1',
      mese: '2026-10',
      stato: 'pagato',
      dataPagamento: '2026-10-01',
      oraPagamento: '19:00',
      importo: 90,
      metodoPagamento: 'contanti',
      ricevutaNumero: 'R-2026-104',
      note: 'Saldato prima lezione di ottobre con Gabriele Piva',
      aggiornatoIl: '2026-10-01T19:00:00.000Z',
    },
    {
      id: `samuele_2026-10`,
      clienteId: 'manual-samuele_staff-1',
      clienteNome: 'Samuele',
      rawCalendarName: 'Samuele',
      insegnanteId: 'staff-1',
      mese: '2026-10',
      stato: 'da_saldare',
      importo: 90,
      note: 'In attesa saldo quota mensilità con Gabriele Piva',
      aggiornatoIl: '2026-10-01T10:00:00.000Z',
    },
    {
      id: `stefano_2026-10`,
      clienteId: 'manual-stefano_staff-1',
      clienteNome: 'STEFANO MANZO',
      rawCalendarName: 'Stefano',
      insegnanteId: 'staff-1',
      mese: '2026-10',
      stato: 'da_saldare',
      importo: 90,
      note: 'In attesa saldo',
      aggiornatoIl: '2026-10-01T10:00:00.000Z',
    },
    {
      id: `federica_2026-10`,
      clienteId: 'manual-federica_staff-1790952691190',
      clienteNome: 'federica',
      rawCalendarName: 'federica',
      insegnanteId: 'staff-1790952691190',
      mese: '2026-10',
      stato: 'pagato',
      dataPagamento: '2026-10-04',
      importo: 80,
      metodoPagamento: 'bonifico',
      ricevutaNumero: 'R-2026-105',
      note: 'Corso con Michael Bertin',
      aggiornatoIl: '2026-10-04T10:00:00.000Z',
    },
    {
      id: `giorgia_2026-10`,
      clienteId: 'manual-giorgia_staff-1790952691190',
      clienteNome: 'Giorgia',
      rawCalendarName: 'Giorgia',
      insegnanteId: 'staff-1790952691190',
      mese: '2026-10',
      stato: 'pagato',
      dataPagamento: '2026-10-08',
      importo: 80,
      metodoPagamento: 'contanti',
      ricevutaNumero: 'R-2026-106',
      note: 'Corso con Michael Bertin',
      aggiornatoIl: '2026-10-08T10:00:00.000Z',
    },
    {
      id: `laura-batteria_2026-10`,
      clienteId: 'manual-laura-batteria_staff-1790952634062',
      clienteNome: 'Laura batteria',
      rawCalendarName: 'Laura',
      insegnanteId: 'staff-1790952634062',
      mese: '2026-10',
      stato: 'pagato',
      dataPagamento: '2026-10-06',
      importo: 85,
      metodoPagamento: 'pos',
      ricevutaNumero: 'R-2026-107',
      note: 'Corso batteria con Alessandro Cilea',
      aggiornatoIl: '2026-10-06T10:00:00.000Z',
    },
    {
      id: `lorenzo_2026-10`,
      clienteId: 'manual-lorenzo_staff-1790952724237',
      clienteNome: 'Lorenzo',
      rawCalendarName: 'Lorenzo',
      insegnanteId: 'staff-1790952724237',
      mese: '2026-10',
      stato: 'pagato',
      dataPagamento: '2026-10-07',
      importo: 85,
      metodoPagamento: 'bonifico',
      ricevutaNumero: 'R-2026-108',
      note: 'Corso con Luca Di Chiara',
      aggiornatoIl: '2026-10-07T10:00:00.000Z',
    },
    {
      id: `alex_2026-10`,
      clienteId: 'manual-alex_staff-1790952724237',
      clienteNome: 'Alex',
      rawCalendarName: 'Alex',
      insegnanteId: 'staff-1790952724237',
      mese: '2026-10',
      stato: 'da_saldare',
      importo: 85,
      note: 'In attesa saldo con Luca Di Chiara',
      aggiornatoIl: '2026-10-01T10:00:00.000Z',
    },
    {
      id: `domi_2026-10`,
      clienteId: 'manual-domi',
      clienteNome: 'Domi',
      rawCalendarName: 'Domi',
      mese: '2026-10',
      stato: 'da_saldare',
      importo: 80,
      note: 'In attesa saldo',
      aggiornatoIl: '2026-10-01T10:00:00.000Z',
    },
    {
      id: `giulia_2026-10`,
      clienteId: 'cli-2',
      clienteNome: 'Giulia',
      rawCalendarName: 'Giulia',
      mese: '2026-10',
      stato: 'pagato',
      dataPagamento: '2026-10-05',
      importo: 90,
      metodoPagamento: 'bonifico',
      ricevutaNumero: 'R-2026-109',
      note: 'Corso canto moderno',
      aggiornatoIl: '2026-10-05T10:00:00.000Z',
    },
  ];
};

const extractTeacherFromRecord = (p: { clienteId?: string; insegnanteId?: string }): string => {
  if (p.insegnanteId) return p.insegnanteId.trim();
  const cId = (p.clienteId || '').trim();
  const match = cId.match(/_(staff-[a-zA-Z0-9-]+)$/);
  return match ? match[1] : '';
};

const isSameStudentPaymentRecord = (
  p: StudentMonthlyPayment,
  targetMese: string,
  cleanId: string,
  cleanName: string,
  aliases?: StudentPaymentLookupAliases
): boolean => {
  if (p.mese !== targetMese) return false;

  const queryTeacher =
    aliases?.teacherId ||
    (cleanId.match(/_(staff-[a-zA-Z0-9-]+)$/)?.[1] ?? '');
  const pTeacher = extractTeacherFromRecord(p);

  // Separazione rigorosa fra docenti diversi
  if (queryTeacher && pTeacher && queryTeacher !== pTeacher) {
    return false;
  }

  // 1. Corrispondenza per clienteId esatto o lista alias ID
  if (cleanId && p.clienteId === cleanId) return true;
  if (aliases?.clientIds && aliases.clientIds.length > 0 && p.clienteId) {
    if (aliases.clientIds.includes(p.clienteId)) return true;
  }

  const pName = (p.clienteNome || '').trim().toLowerCase();
  const pRaw = (p.rawCalendarName || '').trim().toLowerCase();
  const qRaw = (aliases?.rawName || '').trim().toLowerCase();

  // 2. Corrispondenza per nome completo o rawCalendarName esatto
  if (cleanName && (pName === cleanName || pRaw === cleanName)) return true;
  if (qRaw && (pName === qRaw || pRaw === qRaw)) return true;

  // 3. Continuità pre/post tesseramento per lo stesso docente:
  // Se l'allievo aveva un pagamento registrato con il solo nome di battesimo (es. "Michele")
  // e dopo il tesseramento ha Nome + Cognome (es. "MICHELE BELLARDI"), o viceversa,
  // e il nome grezzo sul calendario coincide con il primo nome.
  if (queryTeacher && (!pTeacher || pTeacher === queryTeacher)) {
    if (cleanName.includes(' ') && pName && !pName.includes(' ')) {
      const firstWord = cleanName.split(/\s+/)[0];
      if (firstWord === pName && (!qRaw || qRaw === pName || qRaw === cleanName)) {
        return true;
      }
    }
    if (pName.includes(' ') && cleanName && !cleanName.includes(' ')) {
      const pFirstWord = pName.split(/\s+/)[0];
      if (pFirstWord === cleanName) {
        return true;
      }
    }
  }

  return false;
};

const sanitizeAndEnsureReferencePayments = (rawList: StudentMonthlyPayment[]): { list: StudentMonthlyPayment[]; changed: boolean } => {
  let changed = false;
  // Rimuove eventuali record contaminati dal vecchio bug di omonimia tra docenti diversi
  const sanitized = rawList.filter((p: StudentMonthlyPayment) => {
    const cName = (p.clienteNome || '').trim().toLowerCase();
    const cId = (p.clienteId || '').trim();
    if (cName === 'mattia sacco' && cId.includes('staff-1790952691190')) {
      changed = true;
      return false;
    }
    if (cName === 'diego bolognesi' && cId.includes('staff-1790952724237')) {
      changed = true;
      return false;
    }
    if (cName === 'alessandro furlan' && cId.includes('staff-1790952691190')) {
      changed = true;
      return false;
    }
    return true;
  });

  // Assicura una tantum che i 4 pagamenti di Novembre 2026 della Foto 2 siano presenti con data e ora esatte
  let alreadySeeded = false;
  try {
    alreadySeeded = localStorage.getItem(SEED_NOV2026_REF_KEY) === 'true';
  } catch {}

  if (!alreadySeeded) {
    for (const refPay of REFERENCE_NOV_2026_PAYMENTS) {
      const idx = sanitized.findIndex((p) =>
        isSameStudentPaymentRecord(p, refPay.mese, refPay.clienteId, (refPay.clienteNome || '').toLowerCase(), {
          rawName: refPay.rawCalendarName,
          teacherId: refPay.insegnanteId,
        })
      );
      if (idx === -1) {
        sanitized.unshift(refPay);
        changed = true;
      } else {
        const existing = sanitized[idx];
        if (
          existing.stato !== 'pagato' ||
          existing.dataPagamento !== refPay.dataPagamento ||
          existing.oraPagamento !== refPay.oraPagamento
        ) {
          sanitized[idx] = {
            ...existing,
            ...refPay,
          };
          changed = true;
        }
      }
    }
    try {
      localStorage.setItem(SEED_NOV2026_REF_KEY, 'true');
    } catch {}
  }

  return { list: sanitized, changed };
};

export const studentPaymentService = {
  /**
   * Recupera tutti i pagamenti registrati (localStorage + riallineamento automatico)
   */
  getAll(): StudentMonthlyPayment[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const { list, changed } = sanitizeAndEnsureReferencePayments(parsed);
          if (changed) {
            try {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
            } catch {}
            this.pushToCloud(list);
          }
          return list;
        }
      }
    } catch (e) {
      console.warn('Errore lettura pagamenti studenti da localStorage:', e);
    }

    // Se non presenti o vuoti, inizializza con i default (inclusi i 4 pagamenti di Novembre 2026)
    const defaults = getDefaultInitialPayments();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(defaults));
      localStorage.setItem(SEED_NOV2026_REF_KEY, 'true');
    } catch {}
    return defaults;
  },

  /**
   * Salva l'intera lista su Supabase Cloud (student_payments_store)
   */
  pushToCloud(list?: StudentMonthlyPayment[]): void {
    if (!isSupabaseConfigured()) return;
    const dataToSave = list || this.getAll();
    supabaseService.saveStudentPaymentsToStore(dataToSave).catch((err) => {
      console.warn('[studentPaymentService] Errore salvataggio cloud:', err);
    });
  },

  /**
   * Sincronizza i pagamenti ricevuti da Supabase Cloud con quelli locali,
   * garantendo che una volta registrato 'pagato' con data e ora, quella data e ora
   * rimangano scolpite in memoria e non vengano mai perse o sovrascritte.
   */
  syncFromCloud(remotePayments: StudentMonthlyPayment[]): void {
    if (!Array.isArray(remotePayments)) return;

    const localList = this.getAll();

    // Se lo store sul database è ancora vuoto, carica subito la lista locale (con i 4 saldati di Novembre 2026)
    if (remotePayments.length === 0) {
      this.pushToCloud(localList);
      return;
    }

    const merged: StudentMonthlyPayment[] = [...remotePayments];
    let needsCloudUpdate = false;

    for (const localRec of localList) {
      const cleanId = (localRec.clienteId || '').trim();
      const cleanName = (localRec.clienteNome || '').trim().toLowerCase();
      const teacherId = extractTeacherFromRecord(localRec);

      const idx = merged.findIndex((rem) =>
        isSameStudentPaymentRecord(rem, localRec.mese, cleanId, cleanName, {
          rawName: localRec.rawCalendarName,
          teacherId,
        })
      );

      if (idx === -1) {
        merged.push(localRec);
        needsCloudUpdate = true;
      } else {
        const remRec = merged[idx];
        const remTime = remRec.aggiornatoIl ? new Date(remRec.aggiornatoIl).getTime() : 0;
        const locTime = localRec.aggiornatoIl ? new Date(localRec.aggiornatoIl).getTime() : 0;

        // Se entrambi sono pagati, preserva SEMPRE la prima data e ora di registrazione disponibile
        if (remRec.stato === 'pagato' && localRec.stato === 'pagato') {
          const lockedData = remRec.dataPagamento || localRec.dataPagamento;
          const lockedOra = remRec.oraPagamento || localRec.oraPagamento;
          const lockedIso = remRec.dataOraRegistrazione || localRec.dataOraRegistrazione;
          const preferredName =
            (remRec.clienteNome && remRec.clienteNome.includes(' ') ? remRec.clienteNome : localRec.clienteNome) ||
            remRec.clienteNome;

          if (
            remRec.dataPagamento !== lockedData ||
            remRec.oraPagamento !== lockedOra ||
            remRec.clienteNome !== preferredName
          ) {
            merged[idx] = {
              ...remRec,
              clienteNome: preferredName,
              rawCalendarName: remRec.rawCalendarName || localRec.rawCalendarName,
              insegnanteId: remRec.insegnanteId || localRec.insegnanteId,
              dataPagamento: lockedData,
              oraPagamento: lockedOra,
              dataOraRegistrazione: lockedIso,
            };
            needsCloudUpdate = true;
          }
        } else if (locTime > remTime) {
          merged[idx] = localRec;
          needsCloudUpdate = true;
        }
      }
    }

    const { list: finalMerged, changed: refChanged } = sanitizeAndEnsureReferencePayments(merged);
    if (refChanged) {
      needsCloudUpdate = true;
    }

    try {
      const currentRaw = localStorage.getItem(STORAGE_KEY);
      const nextRaw = JSON.stringify(finalMerged);
      if (currentRaw !== nextRaw) {
        localStorage.setItem(STORAGE_KEY, nextRaw);
        window.dispatchEvent(new CustomEvent('student-payments-updated', { detail: { synced: true } }));
      }
    } catch (e) {
      console.warn('[studentPaymentService] Errore aggiornamento localStorage da cloud:', e);
    }

    if (needsCloudUpdate) {
      this.pushToCloud(finalMerged);
    }
  },

  /**
   * Salva o aggiorna un record di pagamento mensile (sia in locale che su Supabase).
   * REGOLA: Quando un pagamento è 'pagato', la data e l'ora registrate la prima volta
   * rimangono immutabili in memoria finché non viene esplicitamente rimesso 'da_saldare'.
   */
  savePayment(payment: StudentMonthlyPayment, aliases?: StudentPaymentLookupAliases): void {
    const list = this.getAll();
    const cleanName = (payment.clienteNome || '').trim().toLowerCase();
    const cleanId = (payment.clienteId || '').trim();
    const teacherId = aliases?.teacherId || extractTeacherFromRecord(payment);

    const existingIndex = list.findIndex((p) => {
      if (payment.id && p.id === payment.id && p.mese === payment.mese) return true;
      return isSameStudentPaymentRecord(p, payment.mese, cleanId, cleanName, {
        rawName: aliases?.rawName || payment.rawCalendarName,
        teacherId,
        clientIds: aliases?.clientIds,
      });
    });

    const existing = existingIndex >= 0 ? list[existingIndex] : null;

    // Se era già pagato e resta pagato, NON sovrascrivere mai dataPagamento e oraPagamento originali!
    const isStayingPaid = existing?.stato === 'pagato' && payment.stato === 'pagato';
    const finalDataPagamento =
      payment.stato === 'pagato'
        ? (isStayingPaid && existing?.dataPagamento ? existing.dataPagamento : payment.dataPagamento)
        : undefined;
    const finalOraPagamento =
      payment.stato === 'pagato'
        ? (isStayingPaid && existing?.oraPagamento ? existing.oraPagamento : payment.oraPagamento)
        : undefined;
    const finalDataOraRegistrazione =
      payment.stato === 'pagato'
        ? (isStayingPaid && existing?.dataOraRegistrazione ? existing.dataOraRegistrazione : payment.dataOraRegistrazione)
        : undefined;

    const updatedPayment: StudentMonthlyPayment = {
      ...existing,
      ...payment,
      id: existing?.id || payment.id || `${payment.clienteId || cleanName}_${payment.mese}`,
      rawCalendarName: payment.rawCalendarName || aliases?.rawName || existing?.rawCalendarName,
      insegnanteId: teacherId || existing?.insegnanteId,
      dataPagamento: finalDataPagamento,
      oraPagamento: finalOraPagamento,
      dataOraRegistrazione: finalDataOraRegistrazione,
      aggiornatoIl: new Date().toISOString(),
    };

    let updatedList: StudentMonthlyPayment[];
    if (existingIndex >= 0) {
      updatedList = [...list];
      updatedList[existingIndex] = updatedPayment;
    } else {
      updatedList = [updatedPayment, ...list];
    }

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedList));
      window.dispatchEvent(new CustomEvent('student-payments-updated', { detail: updatedPayment }));
    } catch (e) {
      console.error('Errore salvataggio pagamento studente:', e);
    }

    // Salva immediatamente anche sul database Supabase
    this.pushToCloud(updatedList);
  },

  /**
   * Restituisce la registrazione di un allievo per un mese specifico (YYYY-MM),
   * verificando per clienteId, rawCalendarName e nome completo dell'allievo,
   * garantendo separazione rigorosa tra docenti diversi e continuità dopo il tesseramento.
   */
  getPayment(
    clienteId: string,
    mese: string,
    clienteNome?: string,
    aliases?: StudentPaymentLookupAliases
  ): StudentMonthlyPayment | null {
    const list = this.getAll();
    const cleanName = (clienteNome || '').trim().toLowerCase();
    const cleanId = (clienteId || '').trim();

    // Priorità 1: Corrispondenza per clienteId esatto
    if (cleanId) {
      const matchExact = list.find((p) => p.mese === mese && p.clienteId === cleanId);
      if (matchExact) return matchExact;
    }

    // Priorità 2: Matching completo (inclusi alias pre/post tesseramento per lo stesso docente)
    return (
      list.find((p) =>
        isSameStudentPaymentRecord(p, mese, cleanId, cleanName, aliases)
      ) || null
    );
  },

  /**
   * Restituisce lo storico completo di tutti i mesi per un allievo
   */
  getStudentHistory(
    clienteId: string,
    clienteNome?: string,
    aliases?: StudentPaymentLookupAliases
  ): StudentMonthlyPayment[] {
    const list = this.getAll();
    const cleanName = (clienteNome || '').trim().toLowerCase();
    const cleanId = (clienteId || '').trim();

    return list
      .filter((p) =>
        isSameStudentPaymentRecord(p, p.mese, cleanId, cleanName, aliases)
      )
      .sort((a, b) => b.mese.localeCompare(a.mese));
  },

  /**
   * Elimina un pagamento
   */
  deletePayment(id: string): void {
    const list = this.getAll();
    const updated = list.filter((p) => p.id !== id);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent('student-payments-updated', { detail: { id } }));
    } catch (e) {
      console.error('Errore eliminazione pagamento studente:', e);
    }
    this.pushToCloud(updated);
  },
};
