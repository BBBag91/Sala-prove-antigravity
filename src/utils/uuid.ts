/**
 * Utility standard RFC 4122 v4 per generazione e validazione di UUID / GUID.
 * Garantisce identificatori univoci a livello globale per tutte le entità del database:
 * - Clienti / Tesserati
 * - Prenotazioni Calendario
 * - Operatori / Docenti Staff
 * - Turni di Lavoro
 * - Sale Prove
 * - Spese e Incassi
 */

export function generateUUID(): string {
  if (typeof crypto !== 'undefined') {
    if (typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    if (typeof crypto.getRandomValues === 'function') {
      const buffer = new Uint8Array(16);
      crypto.getRandomValues(buffer);
      buffer[6] = (buffer[6] & 0x0f) | 0x40; // Version 4
      buffer[8] = (buffer[8] & 0x3f) | 0x80; // Variant RFC 4122
      const hex = Array.from(buffer, (b) => b.toString(16).padStart(2, '0')).join('');
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    }
  }

  // Fallback universale conforme RFC 4122 v4
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Verifica se una stringa è un UUID v4 o GUID conforme.
 */
export function isValidUUID(id: string): boolean {
  if (!id || typeof id !== 'string') return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

