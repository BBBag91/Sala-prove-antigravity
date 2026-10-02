import { Booking, Client } from '../types';

/**
 * Parses an equipment request string into individual instrument items.
 * Splits by semicolons, newlines, commas, or clear list patterns.
 */
export function parseEquipmentItems(text?: string): string[] {
  if (!text || !text.trim()) return [];
  const clean = text.trim();

  let rawParts: string[] = [];

  // If text contains semicolons, split by semicolon
  if (clean.includes(';')) {
    rawParts = clean.split(';');
  } else if (clean.includes('\n')) {
    rawParts = clean.split('\n');
  } else if (clean.includes('•')) {
    rawParts = clean.split('•');
  } else if (clean.includes(',') && !clean.includes('(')) {
    rawParts = clean.split(',');
  } else if (clean.includes(' e ') && clean.length < 100) {
    // e.g. "Set piatti completo e 3 microfoni SM58 posizionati"
    rawParts = clean.split(' e ');
  } else {
    rawParts = [clean];
  }

  // Clean each item (remove bullet points, trailing periods, semicolons, extra spaces)
  const items = rawParts
    .map((s) => s.trim().replace(/^[-•*–]\s*/, '').replace(/[.;,]+$/, '').trim())
    .filter((s) => s.length > 0);

  // Return deduplicated array
  return Array.from(new Set(items));
}

/**
 * Resolves all required instruments for a booking, combining both the
 * member/band profile registered instrumentation and the specific session request.
 */
export function getAllEquipmentForBooking(
  booking: Booking,
  client?: Client
): {
  items: string[];
  clientEquipment?: string;
  bookingRequest?: string;
  combinedText: string;
} {
  const bText = booking.richiesteStrumentazione?.trim() || '';
  const cText = client?.descrizioneStrumentazione?.trim() || '';

  // Get items from both sources
  const bItems = parseEquipmentItems(bText);
  const cItems = parseEquipmentItems(cText);

  // Merge items into an ordered, deduplicated set
  const allSet = new Set<string>();
  cItems.forEach((it) => allSet.add(it));
  bItems.forEach((it) => allSet.add(it));

  const items = Array.from(allSet);

  let combinedText = '';
  if (cText && bText && cText !== bText) {
    if (!bText.toLowerCase().includes(cText.toLowerCase().slice(0, 25))) {
      combinedText = `${cText} • Setup aggiuntivo: ${bText}`;
    } else {
      combinedText = bText;
    }
  } else {
    combinedText = bText || cText;
  }

  return {
    items,
    clientEquipment: cText || undefined,
    bookingRequest: bText || undefined,
    combinedText,
  };
}
