import { StudentMonthlyPayment, StudentPaymentStatus, PaymentMethod } from '../types';

const STORAGE_KEY = 'salaprove_student_payments_v1';

/**
 * Registrazioni iniziali per il mese di Ottobre 2026 e mesi correnti
 */
const getDefaultInitialPayments = (): StudentMonthlyPayment[] => {
  return [
    // ── ALLIEVI OTTOBRE 2026 ──
    {
      id: `michele-bellardini_2026-10`,
      clienteId: 'manual-1790981535553',
      clienteNome: 'Michele Bellardini',
      mese: '2026-10',
      stato: 'pagato',
      dataPagamento: '2026-10-05',
      oraPagamento: '17:05',
      importo: 90,
      metodoPagamento: 'bonifico',
      ricevutaNumero: 'R-2026-101',
      note: 'Mensilità lezioni chitarra con Gabriele Piva (4 ore svolte)',
      aggiornatoIl: new Date().toISOString(),
    },
    {
      id: `greta-bortolotto_2026-10`,
      clienteId: 'manual-greta-bortolotto',
      clienteNome: 'Greta Bortolotto',
      mese: '2026-10',
      stato: 'pagato',
      dataPagamento: '2026-10-10',
      oraPagamento: '18:10',
      importo: 90,
      metodoPagamento: 'bonifico',
      ricevutaNumero: 'R-2026-102',
      note: 'Mensilità lezioni con Gabriele Piva',
      aggiornatoIl: new Date().toISOString(),
    },
    {
      id: `mattia-sacco_2026-10`,
      clienteId: 'manual-mattia-sacco',
      clienteNome: 'Mattia Sacco',
      mese: '2026-10',
      stato: 'pagato',
      dataPagamento: '2026-10-12',
      oraPagamento: '16:15',
      importo: 90,
      metodoPagamento: 'pos',
      ricevutaNumero: 'R-2026-103',
      note: 'Pagamento POS banco studio',
      aggiornatoIl: new Date().toISOString(),
    },
    {
      id: `davide_2026-10`,
      clienteId: 'manual-davide',
      clienteNome: 'Davide',
      mese: '2026-10',
      stato: 'pagato',
      dataPagamento: '2026-10-01',
      oraPagamento: '19:00',
      importo: 90,
      metodoPagamento: 'contanti',
      ricevutaNumero: 'R-2026-104',
      note: 'Saldato prima lezione di ottobre con Gabriele Piva',
      aggiornatoIl: new Date().toISOString(),
    },
    {
      id: `samuele_2026-10`,
      clienteId: 'manual-samuele',
      clienteNome: 'Samuele',
      mese: '2026-10',
      stato: 'da_saldare',
      importo: 90,
      note: 'In attesa saldo quota mensilità con Gabriele Piva',
      aggiornatoIl: new Date().toISOString(),
    },
    {
      id: `stefano_2026-10`,
      clienteId: 'manual-stefano',
      clienteNome: 'Stefano',
      mese: '2026-10',
      stato: 'da_saldare',
      importo: 90,
      note: 'In attesa saldo',
      aggiornatoIl: new Date().toISOString(),
    },
    {
      id: `federica_2026-10`,
      clienteId: 'manual-federica',
      clienteNome: 'federica',
      mese: '2026-10',
      stato: 'pagato',
      dataPagamento: '2026-10-04',
      importo: 80,
      metodoPagamento: 'bonifico',
      ricevutaNumero: 'R-2026-105',
      note: 'Corso con Michael Bertin',
      aggiornatoIl: new Date().toISOString(),
    },
    {
      id: `giorgia_2026-10`,
      clienteId: 'manual-giorgia',
      clienteNome: 'Giorgia',
      mese: '2026-10',
      stato: 'pagato',
      dataPagamento: '2026-10-08',
      importo: 80,
      metodoPagamento: 'contanti',
      ricevutaNumero: 'R-2026-106',
      note: 'Corso con Michael Bertin',
      aggiornatoIl: new Date().toISOString(),
    },
    {
      id: `laura-batteria_2026-10`,
      clienteId: 'manual-laura-batteria',
      clienteNome: 'Laura batteria',
      mese: '2026-10',
      stato: 'pagato',
      dataPagamento: '2026-10-06',
      importo: 85,
      metodoPagamento: 'pos',
      ricevutaNumero: 'R-2026-107',
      note: 'Corso batteria con Alessandro Cilea',
      aggiornatoIl: new Date().toISOString(),
    },
    {
      id: `lorenzo_2026-10`,
      clienteId: 'manual-lorenzo',
      clienteNome: 'Lorenzo',
      mese: '2026-10',
      stato: 'pagato',
      dataPagamento: '2026-10-07',
      importo: 85,
      metodoPagamento: 'bonifico',
      ricevutaNumero: 'R-2026-108',
      note: 'Corso con Luca Di Chiara',
      aggiornatoIl: new Date().toISOString(),
    },
    {
      id: `alex_2026-10`,
      clienteId: 'manual-alex',
      clienteNome: 'Alex',
      mese: '2026-10',
      stato: 'da_saldare',
      importo: 85,
      note: 'In attesa saldo con Luca Di Chiara',
      aggiornatoIl: new Date().toISOString(),
    },
    {
      id: `domi_2026-10`,
      clienteId: 'manual-domi',
      clienteNome: 'Domi',
      mese: '2026-10',
      stato: 'da_saldare',
      importo: 80,
      note: 'In attesa saldo',
      aggiornatoIl: new Date().toISOString(),
    },
    {
      id: `giulia_2026-10`,
      clienteId: 'cli-2',
      clienteNome: 'Giulia',
      mese: '2026-10',
      stato: 'pagato',
      dataPagamento: '2026-10-05',
      importo: 90,
      metodoPagamento: 'bonifico',
      ricevutaNumero: 'R-2026-109',
      note: 'Corso canto moderno',
      aggiornatoIl: new Date().toISOString(),
    },
  ];
};

export const studentPaymentService = {
  /**
   * Recupera tutti i pagamenti registrati
   */
  getAll(): StudentMonthlyPayment[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Errore lettura pagamenti studenti da localStorage:', e);
    }

    // Se non presenti o vuoti, inizializza con i default
    const defaults = getDefaultInitialPayments();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(defaults));
    } catch {}
    return defaults;
  },

  /**
   * Salva o aggiorna un record di pagamento mensile
   */
  savePayment(payment: StudentMonthlyPayment): void {
    const list = this.getAll();
    const cleanName = (payment.clienteNome || '').trim().toLowerCase();

    const existingIndex = list.findIndex((p) => {
      if (p.mese !== payment.mese) return false;
      if (payment.id && p.id === payment.id) return true;
      if (payment.clienteId && p.clienteId === payment.clienteId) return true;
      if (cleanName && p.clienteNome && p.clienteNome.toLowerCase() === cleanName) return true;
      return false;
    });

    const updatedPayment: StudentMonthlyPayment = {
      ...payment,
      id: payment.id || `${payment.clienteId || cleanName}_${payment.mese}`,
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
  },

  /**
   * Restituisce la registrazione di un allievo per un mese specifico (YYYY-MM),
   * verificando sia per clienteId che per nome normalizzato dell'allievo.
   */
  getPayment(clienteId: string, mese: string, clienteNome?: string): StudentMonthlyPayment | null {
    const list = this.getAll();
    const cleanName = (clienteNome || '').trim().toLowerCase();
    const cleanId = (clienteId || '').trim();

    // Priorità 1: Corrispondenza per clienteId esatto (garantisce separazione fra corsi diversi con docenti diversi)
    if (cleanId) {
      const matchExact = list.find((p) => p.mese === mese && p.clienteId === cleanId);
      if (matchExact) return matchExact;
    }

    return (
      list.find((p) => {
        if (p.mese !== mese) return false;
        if (cleanName && p.clienteNome && p.clienteNome.toLowerCase() === cleanName) return true;
        if (cleanName && p.clienteId && p.clienteId.toLowerCase().includes(cleanName.replace(/\s+/g, '-'))) return true;
        return false;
      }) || null
    );
  },

  /**
   * Restituisce lo storico completo di tutti i mesi per un allievo
   */
  getStudentHistory(clienteId: string, clienteNome?: string): StudentMonthlyPayment[] {
    const list = this.getAll();
    const cleanName = (clienteNome || '').trim().toLowerCase();
    const cleanId = (clienteId || '').trim();

    return list
      .filter((p) => {
        if (cleanId && p.clienteId === cleanId) return true;
        if (cleanName && p.clienteNome && p.clienteNome.toLowerCase() === cleanName) return true;
        return false;
      })
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
  },
};
