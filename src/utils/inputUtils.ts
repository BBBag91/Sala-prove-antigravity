import React from 'react';

/**
 * Sposta il cursore alla fine del valore dell'input (a destra).
 */
export const setCursorToEnd = (el: HTMLInputElement | null) => {
  if (!el) return;
  try {
    const len = el.value.length;
    el.setSelectionRange(len, len);
  } catch {
    // Silenzioso se l'elemento non supporta setSelectionRange
  }
};

/**
 * Handler per onFocus su input numerici (Desktop e Mobile iOS Safari/Android).
 * Posiziona il cursore all'estremità destra per consentire cancellazione immediata (backspace)
 * e modifica rapida dei valori senza dover spostare manualmente il cursore.
 */
export const handleNumericFocus = (e: React.FocusEvent<HTMLInputElement>) => {
  const el = e.currentTarget;
  el.dataset.freshFocus = '1';

  setCursorToEnd(el);
  requestAnimationFrame(() => setCursorToEnd(el));
  setTimeout(() => setCursorToEnd(el), 20);
  setTimeout(() => setCursorToEnd(el), 60);
  setTimeout(() => setCursorToEnd(el), 150);
  setTimeout(() => setCursorToEnd(el), 250);

  setTimeout(() => {
    el.dataset.freshFocus = '0';
  }, 400);
};

/**
 * Handler per onClick:
 * Neutralizza il riposizionamento ritardato del cursore effettuato da WebKit/iOS Safari al tocco.
 */
export const handleNumericClick = (e: React.MouseEvent<HTMLInputElement>) => {
  const el = e.currentTarget;
  if (el.dataset.freshFocus === '1' || (el.selectionStart === 0 && el.value.length > 0)) {
    setCursorToEnd(el);
    setTimeout(() => setCursorToEnd(el), 20);
    setTimeout(() => setCursorToEnd(el), 60);
  }
};

/**
 * Handler per onBlur per resettare lo stato di focus
 */
export const handleNumericBlur = (e: React.FocusEvent<HTMLInputElement>) => {
  e.currentTarget.dataset.freshFocus = '0';
};
