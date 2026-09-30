/**
 * Servizio OCR & HTR per riconoscimento moduli cartacei di tesseramento compilati a mano
 * con Google Gemini Vision AI.
 */

export interface ExtractedMemberData {
  nome: string;
  cognome: string;
  codiceFiscale: string;
  sesso: 'M' | 'F' | 'Altro';
  dataNascita: string; // YYYY-MM-DD
  luogoNascita: string;
  comuneNascita?: string;
  nazioneNascita?: string;
  indirizzo?: string;
  cap?: string;
  comuneResidenza?: string;
  provinciaResidenza?: string;
  residenzaCompleta: string;
  telefono: string;
  email: string;
  gruppoBand?: string;
  strumentiOAttrezzatura?: string;
  note?: string;

  // 17 campi standard per esportazione Excel tesseramento:
  classeTesseramento?: string;
  tipoTesseramento?: string;
  dataInizio?: string;
  dataFine?: string;
  discipline?: string;
  matricola?: string;
  nazioneCittadinanza?: string;
}

const STORAGE_KEY = 'gemini_api_key';

export const getGeminiApiKey = (): string => {
  const fromStorage = localStorage.getItem(STORAGE_KEY);
  if (fromStorage && fromStorage.trim()) {
    return fromStorage.trim();
  }
  const envKey = (import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.GEMINI_API_KEY || '') as string;
  return envKey.trim();
};

export const setGeminiApiKey = (key: string): void => {
  localStorage.setItem(STORAGE_KEY, key.trim());
};

export const clearGeminiApiKey = (): void => {
  localStorage.removeItem(STORAGE_KEY);
};

export const hasGeminiApiKey = (): boolean => {
  return Boolean(getGeminiApiKey());
};

/**
 * Valida o verifica la chiave API con una chiamata rapida
 */
export const testGeminiApiKey = async (apiKey: string): Promise<{ valid: boolean; error?: string }> => {
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey.trim()}`);
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      return {
        valid: false,
        error: errJson?.error?.message || `Errore HTTP ${res.status}: Chiave non valida`,
      };
    }
    return { valid: true };
  } catch (err: any) {
    return { valid: false, error: err.message || 'Errore di connessione a Google AI Studio' };
  }
};

/**
 * Decodifica ausiliaria del Codice Fiscale italiano per completare o validare
 * data di nascita e sesso se la scrittura a mano era poco chiara.
 */
export const decodeCodiceFiscale = (cf: string): { sesso?: 'M' | 'F'; dataNascita?: string } => {
  const clean = cf.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (clean.length !== 16) return {};

  const monthsMap: Record<string, string> = {
    A: '01', B: '02', C: '03', D: '04', E: '05', H: '06',
    L: '07', M: '08', P: '09', R: '10', S: '11', T: '12',
  };

  try {
    const rawYear = parseInt(clean.substring(6, 8), 10);
    const monthChar = clean.charAt(8);
    const rawDay = parseInt(clean.substring(9, 11), 10);

    const month = monthsMap[monthChar];
    if (!month || isNaN(rawYear) || isNaN(rawDay)) return {};

    const isFemale = rawDay > 40;
    const dayNum = isFemale ? rawDay - 40 : rawDay;
    if (dayNum < 1 || dayNum > 31) return {};

    // Calcolo anno (se > anno corrente % 100, assumiamo 1900, altrimenti 2000)
    const currentYear = new Date().getFullYear();
    const currentYearTwoDigits = currentYear % 100;
    const fullYear = rawYear > currentYearTwoDigits ? 1900 + rawYear : 2000 + rawYear;

    const dayStr = String(dayNum).padStart(2, '0');
    return {
      sesso: isFemale ? 'F' : 'M',
      dataNascita: `${fullYear}-${month}-${dayStr}`,
    };
  } catch {
    return {};
  }
};

/**
 * Genera una riga formattata tab-separated (TSV) per incollarla direttamente
 * in Excel / Google Sheets con i 17 campi orizzontali nell'ordine richiesto.
 */
export const formatMemberForExcel = (data: ExtractedMemberData): string => {
  const formatDateIT = (iso?: string) => {
    if (!iso) return '';
    const parts = iso.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return iso;
  };

  const todayIso = new Date().toISOString().split('T')[0];

  const columns = [
    data.classeTesseramento || 'Ordinario',
    data.tipoTesseramento || 'Socio Ordinario',
    data.dataInizio || formatDateIT(todayIso),
    data.dataFine || '',
    data.discipline || 'Musica / Sala Prove',
    data.matricola || '',
    data.nazioneCittadinanza || 'Italia',
    (data.codiceFiscale || '').toUpperCase().trim(),
    data.cognome || '',
    data.nome || '',
    formatDateIT(data.dataNascita),
    data.sesso || '',
    data.nazioneNascita || 'Italia',
    data.comuneNascita || data.luogoNascita || '',
    data.comuneResidenza || '',
    data.cap || '',
    data.indirizzo || data.residenzaCompleta || '',
  ];

  return columns.join('\t');
};

/**
 * Scarica direttamente un file .csv formattato per Excel con i 17 campi standard
 */
export const downloadMemberExcelFile = (data: ExtractedMemberData): void => {
  const formatDateIT = (iso?: string) => {
    if (!iso) return '';
    const parts = iso.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return iso;
  };

  const escapeCsv = (val?: string) => {
    if (!val) return '""';
    return `"${val.replace(/"/g, '""')}"`;
  };

  const todayIso = new Date().toISOString().split('T')[0];

  const headers = [
    'Classe tesseramento',
    'Tipo tesseramento',
    'Data Inizio',
    'Data Fine',
    'Discipline',
    'Matricola',
    'Nazione cittadinanza',
    'Codice Fiscale',
    'Cognome',
    'Nome',
    'Data di nascita',
    'Sesso',
    'Nazione nascita',
    'Comune di nascita',
    'Comune residenza',
    'CAP residenza',
    'Indirizzo residenza',
  ];

  const row = [
    escapeCsv(data.classeTesseramento || 'Ordinario'),
    escapeCsv(data.tipoTesseramento || 'Socio Ordinario'),
    escapeCsv(data.dataInizio || formatDateIT(todayIso)),
    escapeCsv(data.dataFine || ''),
    escapeCsv(data.discipline || 'Musica / Sala Prove'),
    escapeCsv(data.matricola || ''),
    escapeCsv(data.nazioneCittadinanza || 'Italia'),
    escapeCsv((data.codiceFiscale || '').toUpperCase().trim()),
    escapeCsv(data.cognome || ''),
    escapeCsv(data.nome || ''),
    escapeCsv(formatDateIT(data.dataNascita)),
    escapeCsv(data.sesso || ''),
    escapeCsv(data.nazioneNascita || 'Italia'),
    escapeCsv(data.comuneNascita || data.luogoNascita || ''),
    escapeCsv(data.comuneResidenza || ''),
    escapeCsv(data.cap || ''),
    escapeCsv(data.indirizzo || data.residenzaCompleta || ''),
  ];

  const csvContent = `${headers.join(';')}\n${row.join(';')}`;
  const safeName = `${data.cognome || 'tesserato'}_${data.nome || 'nuovo'}`.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `modulo_tesseramento_${safeName}.csv`;

  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Analizza l'immagine del foglio manoscritto usando Google Gemini Vision
 */
export const extractMemberDataFromImage = async (
  imageBase64: string,
  mimeType: string = 'image/jpeg',
  customApiKey?: string
): Promise<ExtractedMemberData> => {
  const apiKey = (customApiKey || getGeminiApiKey()).trim();
  if (!apiKey) {
    throw new Error('Chiave API Gemini non configurata. Inserisci la tua API key nelle impostazioni scansione.');
  }

  // Rimuovi eventuale data URL header (es. data:image/jpeg;base64,)
  const base64Data = imageBase64.replace(/^data:[^;]+;base64,/, '');

  const prompt = `Sei un assistente IA specializzato nel riconoscimento ottico di moduli cartacei italiani di tesseramento e anagrafica compilati a mano con penna (HTR - Handwritten Text Recognition).
Analizza attentamente l'immagine del modulo compilato a penna e dei suoi campi.

Estrai con la massima accuratezza possibile tutte le informazioni scritte a mano o pre-stampate:
1. Codice Fiscale (16 caratteri alfanumerici, fai molta attenzione a lettere e numeri simili es. 0/O, 1/I, 5/S, 8/B).
2. Nome e Cognome (riconosci bene corsivo e stampatello).
3. Sesso ('M' o 'F').
4. Data di nascita (convertila nel formato standard YYYY-MM-DD, es. '1992-05-15').
5. Luogo/Comune di nascita e nazione di nascita.
6. Indirizzo di residenza (Via/Piazza, CAP di 5 cifre, Comune di residenza, Provincia).
7. Telefono / Cellulare.
8. Email.
9. Eventuale gruppo / band / progetto musicale specificato.
10. Eventuale attrezzatura / strumenti musicali richiesti per la sala prove.
11. Eventuale disciplina o tipo tesseramento / classe tesseramento / matricola.

Se il Codice Fiscale è visibile, usalo per effettuare il cross-check di sesso e data di nascita (nelle donne il giorno nel CF è aumentato di 40).
Se un campo non è presente sul foglio o è totalmente illeggibile, lascia una stringa vuota "".

Rispondi RIGOROSAMENTE con un oggetto JSON valido avente questa struttura:
{
  "nome": "",
  "cognome": "",
  "codiceFiscale": "",
  "sesso": "M",
  "dataNascita": "YYYY-MM-DD",
  "luogoNascita": "",
  "comuneNascita": "",
  "nazioneNascita": "Italia",
  "indirizzo": "",
  "cap": "",
  "comuneResidenza": "",
  "provinciaResidenza": "",
  "residenzaCompleta": "",
  "telefono": "",
  "email": "",
  "gruppoBand": "",
  "strumentiOAttrezzatura": "",
  "classeTesseramento": "Ordinario",
  "tipoTesseramento": "Socio",
  "dataInizio": "",
  "dataFine": "",
  "discipline": "Musica / Sala Prove",
  "matricola": "",
  "nazioneCittadinanza": "Italia",
  "note": ""
}`;

  const payload = {
    contents: [
      {
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: mimeType || 'image/jpeg',
              data: base64Data,
            },
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.1,
      responseMimeType: 'application/json',
    },
  };

  // Proviamo prima con gemini-2.5-flash, altrimenti fallback a gemini-1.5-flash
  const modelsToTry = ['gemini-2.5-flash', 'gemini-1.5-flash'];
  let lastError: any = null;

  for (const model of modelsToTry) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        const msg = errJson?.error?.message || `Errore HTTP ${res.status}`;
        throw new Error(`${model}: ${msg}`);
      }

      const responseJson = await res.json();
      const textOutput =
        responseJson?.candidates?.[0]?.content?.parts?.[0]?.text || '';

      if (!textOutput) {
        throw new Error('Risposta vuota da Gemini AI.');
      }

      // Estrai il JSON pulito
      let cleanJsonStr = textOutput.trim();
      if (cleanJsonStr.startsWith('```json')) {
        cleanJsonStr = cleanJsonStr.replace(/^```json\s*/, '').replace(/```\s*$/, '');
      } else if (cleanJsonStr.startsWith('```')) {
        cleanJsonStr = cleanJsonStr.replace(/^```\s*/, '').replace(/```\s*$/, '');
      }

      const parsed: ExtractedMemberData = JSON.parse(cleanJsonStr);

      // Post-elaborazione e validazione
      if (parsed.codiceFiscale) {
        parsed.codiceFiscale = parsed.codiceFiscale.toUpperCase().replace(/\s+/g, '');
        // Se manca la data di nascita o sesso ma il CF è valido, ricaviamoli
        const cfDecoded = decodeCodiceFiscale(parsed.codiceFiscale);
        if (!parsed.sesso && cfDecoded.sesso) {
          parsed.sesso = cfDecoded.sesso;
        }
        if ((!parsed.dataNascita || !/^\d{4}-\d{2}-\d{2}$/.test(parsed.dataNascita)) && cfDecoded.dataNascita) {
          parsed.dataNascita = cfDecoded.dataNascita;
        }
      }

      // Normalizzazione sesso
      if (parsed.sesso) {
        const s = String(parsed.sesso).toUpperCase().trim();
        if (s.startsWith('M') || s === 'MASCHIO') parsed.sesso = 'M';
        else if (s.startsWith('F') || s === 'FEMMINA') parsed.sesso = 'F';
        else parsed.sesso = 'Altro';
      } else {
        parsed.sesso = 'M';
      }

      // Costruisci residenzaCompleta se non fornita
      if (!parsed.residenzaCompleta) {
        const parts = [
          parsed.indirizzo,
          parsed.cap,
          parsed.comuneResidenza,
          parsed.provinciaResidenza ? `(${parsed.provinciaResidenza})` : '',
        ].filter(Boolean);
        parsed.residenzaCompleta = parts.join(' ').trim();
      }

      return parsed;
    } catch (err: any) {
      lastError = err;
      console.warn(`Tentativo con ${model} fallito:`, err.message);
      // Passa al prossimo modello
    }
  }

  throw new Error(lastError?.message || 'Impossibile elaborare il modulo con Gemini AI.');
};
