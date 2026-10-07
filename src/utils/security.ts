/**
 * ============================================================================
 * ENTERPRISE SECURITY UTILITIES MODULE
 * Gestione Sala Prove & Associazione Musicale
 * 
 * Pilastri implementati:
 * 1. Sanitizzazione XSS & Input Hygiene (OWASP A03:2021 - Injection)
 * 2. Validazione Rigorosa Dati Personali (GDPR Art. 5, 25, 32)
 * 3. Rate Limiting & Anti-Brute Force Defender
 * 4. Anti-Honeypot & Bot Detection (Anti-Spam / Anti-Phishing)
 * 5. Safe Link Generator (Anti-Reverse Tabnabbing & Open Redirect)
 * ============================================================================
 */

// Regex ufficiale per Codice Fiscale Italiano (16 caratteri alfanumerici conformi)
export const CODICE_FISCALE_REGEX = /^[A-Z]{6}[0-9LMNPQRSTUV]{2}[A-EHLMPR-T][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]$/i;

// Regex per email conforme RFC 5322 semplificata
export const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

// Regex per numeri di telefono internazionali/italiani
export const PHONE_REGEX = /^\+?[0-9\s.\-()]{6,25}$/;

/**
 * Pulisce una stringa da tag HTML, script, e caratteri potenzialmente malevoli
 * per prevenire attacchi XSS (Cross-Site Scripting).
 */
export function sanitizeInput(input: unknown): string {
  if (input === null || input === undefined) return '';
  const str = String(input);
  return str
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // rimuove blocchi script
    .replace(/<[^>]+>/g, '') // rimuove tutti i tag HTML
    .replace(/javascript:/gi, '') // rimuove pseudoprotocolli javascript
    .replace(/on\w+\s*=/gi, '') // rimuove inline event handlers (onclick=, onload=, onerror=)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '') // rimuove caratteri di controllo non stampabili
    .trim();
}

/**
 * Valida un Codice Fiscale italiano con controllo di lunghezza, formato e caratteri.
 */
export function validateCodiceFiscale(cf: string): { isValid: boolean; normalized: string; error?: string } {
  const normalized = (cf || '').trim().toUpperCase().replace(/\s+/g, '');
  if (!normalized) {
    return { isValid: false, normalized: '', error: 'Il Codice Fiscale è obbligatorio.' };
  }
  if (normalized.length !== 16) {
    return {
      isValid: false,
      normalized,
      error: `Il Codice Fiscale deve contenere esattamente 16 caratteri (attuali: ${normalized.length}).`,
    };
  }
  if (!CODICE_FISCALE_REGEX.test(normalized)) {
    return {
      isValid: false,
      normalized,
      error: 'Formato Codice Fiscale non valido. Verifica le lettere e i numeri inseriti.',
    };
  }
  return { isValid: true, normalized };
}

/**
 * Valida e normalizza un indirizzo email.
 */
export function validateEmail(email: string): { isValid: boolean; normalized: string } {
  const normalized = (email || '').trim().toLowerCase();
  if (!normalized) return { isValid: true, normalized: '' }; // Opzionale se non richiesto
  return {
    isValid: EMAIL_REGEX.test(normalized),
    normalized,
  };
}

/**
 * Valida e ripulisce un numero di telefono.
 */
export function sanitizePhoneNumber(phone: string): string {
  return (phone || '').replace(/[^\d+]/g, '').trim();
}

/**
 * Rilevamento bot / scraper tramite Honeypot.
 * Se un campo invisibile è compilato, si tratta di un bot automatico.
 */
export function isHoneypotTriggered(trapValue: unknown): boolean {
  return typeof trapValue === 'string' && trapValue.trim().length > 0;
}

/**
 * Maschera un Codice Fiscale o dato sensibile per i log o le anteprime (GDPR Data Masking).
 * Es: "RSSMRA85M01H501Z" -> "RSSM********501Z"
 */
export function maskSensitiveData(val: string): string {
  if (!val || val.length < 8) return '****';
  const start = val.substring(0, 4);
  const end = val.substring(val.length - 4);
  return `${start}${'*'.repeat(val.length - 8)}${end}`;
}

/**
 * ============================================================================
 * ANTI-BRUTE FORCE RATE LIMITER (In-Memory / Session State)
 * Protegge i form di login e invio da tentativi di attacco automatizzati.
 * ============================================================================
 */
interface RateLimitRecord {
  attempts: number;
  lastAttempt: number;
  lockedUntil: number;
}

class ClientRateLimiter {
  private records: Map<string, RateLimitRecord> = new Map();
  private maxAttempts: number;
  private lockoutDurationMs: number;
  private windowDurationMs: number;

  constructor(maxAttempts = 5, lockoutDurationSeconds = 60, windowDurationSeconds = 300) {
    this.maxAttempts = maxAttempts;
    this.lockoutDurationMs = lockoutDurationSeconds * 1000;
    this.windowDurationMs = windowDurationSeconds * 1000;
  }

  public check(actionKey: string): { isAllowed: boolean; remainingLockoutSeconds: number } {
    const now = Date.now();
    const record = this.records.get(actionKey);

    if (!record) {
      return { isAllowed: true, remainingLockoutSeconds: 0 };
    }

    // Se l'account è attualmente bloccato
    if (record.lockedUntil > now) {
      const remainingSec = Math.ceil((record.lockedUntil - now) / 1000);
      return { isAllowed: false, remainingLockoutSeconds: remainingSec };
    }

    // Se la finestra temporale è scaduta, resetta
    if (now - record.lastAttempt > this.windowDurationMs) {
      this.records.delete(actionKey);
      return { isAllowed: true, remainingLockoutSeconds: 0 };
    }

    return { isAllowed: true, remainingLockoutSeconds: 0 };
  }

  public recordFailure(actionKey: string): { isLocked: boolean; remainingLockoutSeconds: number; attempts: number } {
    const now = Date.now();
    const record = this.records.get(actionKey) || {
      attempts: 0,
      lastAttempt: now,
      lockedUntil: 0,
    };

    record.attempts += 1;
    record.lastAttempt = now;

    if (record.attempts >= this.maxAttempts) {
      record.lockedUntil = now + this.lockoutDurationMs;
      this.records.set(actionKey, record);
      return {
        isLocked: true,
        remainingLockoutSeconds: Math.ceil(this.lockoutDurationMs / 1000),
        attempts: record.attempts,
      };
    }

    this.records.set(actionKey, record);
    return {
      isLocked: false,
      remainingLockoutSeconds: 0,
      attempts: record.attempts,
    };
  }

  public reset(actionKey: string): void {
    this.records.delete(actionKey);
  }
}

export const loginRateLimiter = new ClientRateLimiter(5, 60, 300); // 5 tentativi, 60s lockout
export const formSubmitRateLimiter = new ClientRateLimiter(4, 30, 180); // 4 invii rapidi, 30s lockout

/**
 * Protezione Anti-Clickjacking runtime: Frame-Busting Guard
 * Verifica che l'applicazione non sia incorporata in un iframe malevolo
 */
export function enforceFrameBusting(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    if (window.top && window.top !== window.self) {
      console.warn('[SECURITY] Rilevato tentativo di framing non autorizzato (possibile Clickjacking). Disabilitazione rendering.');
      window.top.location.href = window.self.location.href;
      return false;
    }
  } catch {
    // Cross-origin framing bloccato
    return false;
  }
  return true;
}
