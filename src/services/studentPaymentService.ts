import { StudentMonthlyPayment, StudentPaymentStatus, PaymentMethod } from '../types';
import { formatDateToISO } from '../utils/dateUtils';

const STORAGE_KEY = 'salaprove_student_payments_v1';

/**
 * Registrazioni iniziali predefinite per garantire dati visibili fin da subito
 */
const getDefaultInitialPayments = (): StudentMonthlyPayment[] => {
  const curDate = new Date();
  const curYear = curDate.getFullYear();
  const curMonth = String(curDate.getMonth() + 1).padStart(2, '0');
  const curMonthStr = `${curYear}-${curMonth}`;

  // Precedente mese
  const prevDate = new Date(curDate.getFullYear(), curDate.getMonth() - 1, 1);
  const prevMonthStr = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

  return [
    {
      id: `cli-2_${curMonthStr}`,
      clienteId: 'cli-2', // Giulia De Angelis (Canto con Silvia Romano)
      mese: curMonthStr,
      stato: 'pagato',
      dataPagamento: `${curMonthStr}-04`,
      importo: 90,
      metodoPagamento: 'bonifico',
      ricevutaNumero: `R-${curYear}-104`,
      note: 'Saldo mensilità corso canto moderno',
      aggiornatoIl: new Date().toISOString(),
    },
    {
      id: `cli-2_${prevMonthStr}`,
      clienteId: 'cli-2',
      mese: prevMonthStr,
      stato: 'pagato',
      dataPagamento: `${prevMonthStr}-05`,
      importo: 90,
      metodoPagamento: 'bonifico',
      ricevutaNumero: `R-${curYear}-088`,
      note: 'Mese precedente saldato',
      aggiornatoIl: new Date().toISOString(),
    },
    {
      id: `cli-5_${curMonthStr}`,
      clienteId: 'cli-5', // Elena Russo
      mese: curMonthStr,
      stato: 'da_saldare',
      importo: 80,
      note: 'In attesa saldo mensilità alla prossima lezione',
      aggiornatoIl: new Date().toISOString(),
    },
    {
      id: `cli-6_${curMonthStr}`,
      clienteId: 'cli-6', // Marco Verdi (Allievo Chitarra con Gabriele Piva)
      mese: curMonthStr,
      stato: 'pagato',
      dataPagamento: `${curMonthStr}-02`,
      importo: 90,
      metodoPagamento: 'bonifico',
      ricevutaNumero: `R-${curYear}-101`,
      note: 'Mensilità 4 lezioni individuali chitarra elettrica con Gabriele Piva',
      aggiornatoIl: new Date().toISOString(),
    },
    {
      id: `cli-7_${curMonthStr}`,
      clienteId: 'cli-7', // Sofia Neri (Allieva Chitarra con Gabriele Piva)
      mese: curMonthStr,
      stato: 'da_saldare',
      importo: 90,
      note: 'Da saldare giovedì a lezione con Gabriele Piva',
      aggiornatoIl: new Date().toISOString(),
    },
    {
      id: `cli-8_${curMonthStr}`,
      clienteId: 'cli-8', // Leonardo Conti (Allievo Batteria con Luca Di Chiara)
      mese: curMonthStr,
      stato: 'pagato',
      dataPagamento: `${curMonthStr}-06`,
      importo: 85,
      metodoPagamento: 'pos',
      ricevutaNumero: `R-${curYear}-112`,
      note: 'Pagamento carta POS al banco studio',
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
    const existingIndex = list.findIndex(
      (p) => p.id === payment.id || (p.clienteId === payment.clienteId && p.mese === payment.mese)
    );

    const updatedPayment: StudentMonthlyPayment = {
      ...payment,
      id: payment.id || `${payment.clienteId}_${payment.mese}`,
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
   * Restituisce la registrazione di un allievo per un mese specifico (YYYY-MM)
   */
  getPayment(clienteId: string, mese: string): StudentMonthlyPayment | null {
    const list = this.getAll();
    return list.find((p) => p.clienteId === clienteId && p.mese === mese) || null;
  },

  /**
   * Restituisce lo storico completo di tutti i mesi per un allievo
   */
  getStudentHistory(clienteId: string): StudentMonthlyPayment[] {
    const list = this.getAll();
    return list
      .filter((p) => p.clienteId === clienteId)
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
