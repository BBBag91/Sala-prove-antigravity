/**
 * Utility di calcolo per la sezione "Compensi Fine Mese" (Logica Excel).
 *
 * Mappatura celle Excel & Nomenclatura Reale Studio:
 * - Totale Entrate Mese: B2 (somma o totale incassi del mese)
 * - Totale Spese Mese: Spese (somma o totale uscite del mese)
 * - E2 = B2 - Totale Spese
 *
 * Variabili G (Quote & Anticipi Soci):
 * - G1: "Netto Sala" (divisore quote, default: 3)
 * - G2: "Gab" (anticipo / detrazione Gab)
 * - G3: "Ale" (anticipo / detrazione Ale)
 * - G4: "Paolo" (anticipo / detrazione Paolo)
 *
 * Formule matematiche richieste:
 * - B2  = Totale Entrate Mese
 * - E2  = B2 - Totale Spese Mese
 * - B13 = Math.ceil(E2 / G1)         [Arrotonda per eccesso (E2 / Netto Sala) all'intero più vicino]
 * - D13 = B2 - G2 - G3 - G4          [B2 - Gab - Ale - Paolo]
 * - B14 = Math.floor((E2 / G1) - G3) [Compenso Ale: Arrotonda per difetto ((E2 / Netto Sala) - Ale) all'intero]
 * - B15 = Math.floor((E2 / G1) - G2) [Compenso Gab: Arrotonda per difetto ((E2 / Netto Sala) - Gab) all'intero]
 * - B16 = Math.floor((E2 / G1) - G4) [Compenso Paolo: Arrotonda per difetto ((E2 / Netto Sala) - Paolo) all'intero]
 */

export interface VariabiliG {
  G1: number; // Netto Sala (divisore)
  G2: number; // Gab
  G3: number; // Ale
  G4: number; // Paolo
}

export interface CompensiFineMeseInput {
  totaleEntrateMese: number; // B2
  totaleSpeseMese: number;   // Somma Spese
  G: VariabiliG;
}

export interface CompensiFineMeseOutput {
  B2: number;  // Totale Entrate Mese
  E2: number;  // B2 - Totale Spese Mese
  B13: number; // Arrotonda per eccesso (E2 / Netto Sala) all'intero più vicino
  D13: number; // B2 - Gab - Ale - Paolo
  B14: number; // Compenso Ale: Math.floor((E2 / Netto Sala) - Ale)
  B15: number; // Compenso Gab: Math.floor((E2 / Netto Sala) - Gab)
  B16: number; // Compenso Paolo: Math.floor((E2 / Netto Sala) - Paolo)
  dettagli: {
    nettoSalaDivisore: number; // G1
    anticipoGab: number;       // G2
    anticipoAle: number;       // G3
    anticipoPaolo: number;     // G4
    totaleAnticipiSoci: number; // G2 + G3 + G4
    quotaBaseNonArrotondata: number; // E2 / G1
  };
}

/**
 * Normalizza il valore per evitare NaN o stringhe non valide
 */
const safeNum = (val: unknown, fallback = 0): number => {
  const n = typeof val === 'number' ? val : Number(val);
  return Number.isFinite(n) ? n : fallback;
};

/**
 * Funzione pura: calcola i compensi fine mese con l'esatta logica matematica.
 */
export function calcolaCompensiFineMese(input: CompensiFineMeseInput): CompensiFineMeseOutput {
  const B2 = safeNum(input.totaleEntrateMese, 0);
  const totaleSpese = safeNum(input.totaleSpeseMese, 0);

  const G1 = safeNum(input.G?.G1, 3); // Netto Sala (default: 3)
  const G2 = safeNum(input.G?.G2, 0); // Gab
  const G3 = safeNum(input.G?.G3, 0); // Ale
  const G4 = safeNum(input.G?.G4, 0); // Paolo

  // E2 = B2 - Totale Spese Mese
  const E2 = B2 - totaleSpese;

  // Quota Base: E2 / G1 (Netto Sala)
  const quotaBase = G1 !== 0 ? E2 / G1 : 0;

  // B13 = Arrotonda per eccesso (E2 / G1) all'intero più vicino
  const B13 = Math.ceil(quotaBase);

  // D13 = B2 - G2 - G3 - G4 (Totale Entrate - Gab - Ale - Paolo)
  const D13 = B2 - G2 - G3 - G4;

  // B14 = Arrotonda per difetto ((E2 / G1) - G3) all'intero [Ale]
  const B14 = Math.floor(quotaBase - G3);

  // B15 = Arrotonda per difetto ((E2 / G1) - G2) all'intero [Gab]
  const B15 = Math.floor(quotaBase - G2);

  // B16 = Arrotonda per difetto ((E2 / G1) - G4) all'intero [Paolo]
  const B16 = Math.floor(quotaBase - G4);

  return {
    B2,
    E2,
    B13,
    D13,
    B14,
    B15,
    B16,
    dettagli: {
      nettoSalaDivisore: G1,
      anticipoGab: G2,
      anticipoAle: G3,
      anticipoPaolo: G4,
      totaleAnticipiSoci: G2 + G3 + G4,
      quotaBaseNonArrotondata: quotaBase,
    },
  };
}

/**
 * Classe calcolatrice per gestione stato e getters
 */
export class CompensiFineMeseCalculator {
  public totaleEntrateMese: number;
  public totaleSpeseMese: number;
  public G: VariabiliG;

  constructor(initial?: Partial<CompensiFineMeseInput>) {
    this.totaleEntrateMese = safeNum(initial?.totaleEntrateMese, 0);
    this.totaleSpeseMese = safeNum(initial?.totaleSpeseMese, 0);
    this.G = {
      G1: safeNum(initial?.G?.G1, 3), // Netto Sala
      G2: safeNum(initial?.G?.G2, 0), // Gab
      G3: safeNum(initial?.G?.G3, 0), // Ale
      G4: safeNum(initial?.G?.G4, 0), // Paolo
    };
  }

  public get B2(): number {
    return this.totaleEntrateMese;
  }

  public get E2(): number {
    return this.totaleEntrateMese - this.totaleSpeseMese;
  }

  public get quotaBase(): number {
    return this.G.G1 !== 0 ? this.E2 / this.G.G1 : 0;
  }

  public get B13(): number {
    return Math.ceil(this.quotaBase);
  }

  public get D13(): number {
    return this.B2 - this.G.G2 - this.G.G3 - this.G.G4;
  }

  public get B14(): number {
    return Math.floor(this.quotaBase - this.G.G3); // Ale
  }

  public get B15(): number {
    return Math.floor(this.quotaBase - this.G.G2); // Gab
  }

  public get B16(): number {
    return Math.floor(this.quotaBase - this.G.G4); // Paolo
  }

  public calcola(): CompensiFineMeseOutput {
    return calcolaCompensiFineMese({
      totaleEntrateMese: this.totaleEntrateMese,
      totaleSpeseMese: this.totaleSpeseMese,
      G: this.G,
    });
  }
}
