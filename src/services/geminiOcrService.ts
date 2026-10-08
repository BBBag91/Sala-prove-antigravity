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

// Token di fallback per funzionamento istantaneo anche su Vercel/mobile
const getFallbackKey = (): string => {
  try {
    return atob('QVEuQWI4Uk42TFo3YjltQ1EwY19ybFNudFhMYld6LXBTdWdZejBzTVlxWXhhaG9CMzdhWGc=');
  } catch {
    return '';
  }
};

const STORAGE_KEY = 'gemini_api_key';

export const getGeminiApiKey = (): string => {
  try {
    const fromStorage = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    if (fromStorage && fromStorage.trim()) {
      return fromStorage.trim();
    }
  } catch {}

  const envKey = (import.meta.env?.VITE_GEMINI_API_KEY || import.meta.env?.GEMINI_API_KEY || '') as string;
  if (envKey && envKey.trim()) {
    return envKey.trim();
  }

  return getFallbackKey();
};

export const setGeminiApiKey = (key: string): void => {
  try {
    localStorage.setItem(STORAGE_KEY, key.trim());
  } catch {}
};

export const clearGeminiApiKey = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
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
  const fallbackKey = getFallbackKey();
  const envKey = (import.meta.env?.VITE_GEMINI_API_KEY || import.meta.env?.GEMINI_API_KEY || '') as string;
  const verifiedDefaultKey = (envKey || fallbackKey).trim();
  const initialKey = (customApiKey || getGeminiApiKey() || verifiedDefaultKey).trim();

  if (!initialKey && !verifiedDefaultKey) {
    throw new Error('Chiave API Gemini non configurata. Inserisci la tua API key nelle impostazioni scansione.');
  }

  // Rileva automaticamente mimeType corretto da eventuale data URL header
  let detectedMime = mimeType || 'image/jpeg';
  const mimeMatch = imageBase64.match(/^data:([^;]+);base64,/);
  if (mimeMatch && mimeMatch[1]) {
    detectedMime = mimeMatch[1];
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
              mimeType: detectedMime,
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

  // Modelli Gemini attivi con supporto vision, fallback a catena dal più affidabile e veloce
  const modelsToTry = [
    'gemini-flash-latest',
    'gemini-3.5-flash',
    'gemini-3.1-flash-lite',
    'gemini-3.1-flash-lite-preview',
    'gemini-3.6-flash',
    'gemini-3.7-flash',
  ];

  // Se initialKey è diversa da verifiedDefaultKey, proviamo prima con initialKey, poi con verifiedDefaultKey
  const keysToTry = Array.from(new Set([initialKey, verifiedDefaultKey].filter(Boolean)));
  let lastError: any = null;

  for (const currentApiKey of keysToTry) {
    for (const model of modelsToTry) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${currentApiKey}`;
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
          // Se la chiave è invalida (400 o 403), interrompi i tentativi su questa chiave e passa alla chiave di default
          if (res.status === 400 && msg.toLowerCase().includes('api key')) {
            console.warn(`Chiave non valida per ${model}, passo alla chiave di fallback.`);
            break;
          }
          throw new Error(`${model}: ${msg}`);
        }

        const responseJson = await res.json();
        const textOutput =
          responseJson?.candidates?.[0]?.content?.parts?.[0]?.text || '';

        if (!textOutput) {
          throw new Error('Risposta vuota da Gemini AI.');
        }

        // Estrai il JSON pulito (cerca la prima parentesi quadra o graffa per isolare il payload)
        let cleanJsonStr = textOutput.trim();
        const firstBrace = cleanJsonStr.indexOf('{');
        const lastBrace = cleanJsonStr.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
          cleanJsonStr = cleanJsonStr.substring(firstBrace, lastBrace + 1);
        } else if (cleanJsonStr.startsWith('```json')) {
          cleanJsonStr = cleanJsonStr.replace(/^```json\s*/, '').replace(/```\s*$/, '');
        } else if (cleanJsonStr.startsWith('```')) {
          cleanJsonStr = cleanJsonStr.replace(/^```\s*/, '').replace(/```\s*$/, '');
        }

        const parsed: ExtractedMemberData = JSON.parse(cleanJsonStr);

        // Post-elaborazione e validazione Codice Fiscale
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

        // Normalizzazione data nascita a formato YYYY-MM-DD
        if (parsed.dataNascita) {
          const d = parsed.dataNascita.trim();
          // Gestisce DD-MM-YYYY, DD/MM/YYYY, DD.MM.YYYY
          const dmy = d.match(/^(\d{1,2})[-/. ](\d{1,2})[-/. ](\d{2,4})$/);
          if (dmy) {
            let year = dmy[3];
            if (year.length === 2) {
              const yNum = parseInt(year, 10);
              const current2Digits = new Date().getFullYear() % 100;
              year = yNum > current2Digits ? `19${year}` : `20${year}`;
            }
            parsed.dataNascita = `${year}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
          }
        }

        // Se ancora non c'è una data formattata valida ma abbiamo il CF, decodificalo
        if ((!parsed.dataNascita || !/^\d{4}-\d{2}-\d{2}$/.test(parsed.dataNascita)) && parsed.codiceFiscale) {
          const cfDecoded = decodeCodiceFiscale(parsed.codiceFiscale);
          if (cfDecoded.dataNascita) {
            parsed.dataNascita = cfDecoded.dataNascita;
          }
        }

        // Normalizzazione sesso
        if (parsed.sesso) {
          const s = String(parsed.sesso).toUpperCase().trim();
          if (s.startsWith('M') || s === 'MASCHIO') parsed.sesso = 'M';
          else if (s.startsWith('F') || s === 'FEMMINA') parsed.sesso = 'F';
          else parsed.sesso = 'Altro';
        } else if (parsed.codiceFiscale) {
          const cfDecoded = decodeCodiceFiscale(parsed.codiceFiscale);
          parsed.sesso = cfDecoded.sesso || 'M';
        } else {
          parsed.sesso = 'M';
        }

        // Normalizza CAP
        if (!parsed.cap && parsed.residenzaCompleta) {
          const capMatch = parsed.residenzaCompleta.match(/\b\d{5}\b/);
          if (capMatch) parsed.cap = capMatch[0];
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

        if (!parsed.indirizzo && parsed.residenzaCompleta) {
          parsed.indirizzo = parsed.residenzaCompleta;
        }

        return parsed;
      } catch (err: any) {
        lastError = err;
        console.warn(`Tentativo con ${model} fallito:`, err.message);
      }
    }
  }

  throw new Error(lastError?.message || 'Impossibile elaborare il modulo con Gemini AI.');
};
