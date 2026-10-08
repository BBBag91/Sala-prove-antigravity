import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  Copy,
  Check,
  ExternalLink,
  MessageSquare,
  User,
  GraduationCap,
  Music2,
  Phone,
  Sparkles,
  Calendar,
  Clock,
  DoorOpen,
  FileEdit,
  RotateCcw,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Booking, isLessonBooking } from '../types';
import {
  formatBookingReminderMessage,
  getWhatsAppShareLinks,
} from '../services/whatsappService';
import { formatDateItalian } from '../utils/dateUtils';

interface BookingWhatsAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: Booking | null;
}

export const BookingWhatsAppModal: React.FC<BookingWhatsAppModalProps> = ({
  isOpen,
  onClose,
  booking,
}) => {
  const { clients, rooms, staff, studioInfo } = useApp();

  // Seleziona il destinatario (allievo o insegnante per le lezioni)
  const isLesson = useMemo(() => isLessonBooking(booking), [booking]);
  const [recipientType, setRecipientType] = useState<'client' | 'teacher'>('client');

  // Ricerca cliente associato
  const client = useMemo(() => {
    if (!booking) return null;
    return (
      clients.find((c) => c.id === booking.clienteId) ||
      clients.find(
        (c) =>
          `${c.nome} ${c.cognome}`.trim().toLowerCase() ===
          (booking.clienteNome || '').trim().toLowerCase()
      ) ||
      null
    );
  }, [clients, booking]);

  // Ricerca sala associata
  const room = useMemo(() => {
    if (!booking) return null;
    return rooms.find((r) => r.id === booking.salaId) || null;
  }, [rooms, booking]);

  // Ricerca insegnante associato
  const teacher = useMemo(() => {
    if (!booking) return null;
    return (
      staff.find((s) => s.id === booking.insegnanteId) ||
      staff.find(
        (s) =>
          `${s.nome} ${s.cognome}`.trim().toLowerCase() ===
          (booking.insegnanteNome || '').trim().toLowerCase()
      ) ||
      null
    );
  }, [staff, booking]);

  // Telefono predefinito
  const defaultPhone = useMemo(() => {
    if (recipientType === 'teacher') {
      return teacher?.telefono || '';
    }
    return client?.telefono || '';
  }, [recipientType, teacher, client]);

  const [phoneInput, setPhoneInput] = useState('');
  const [customNote, setCustomNote] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const [isCustomMessageEdited, setIsCustomMessageEdited] = useState(false);
  const [editableMessage, setEditableMessage] = useState('');

  // Sincronizza stato al cambio di prenotazione o tipo di destinatario
  useEffect(() => {
    if (booking) {
      setPhoneInput(defaultPhone);
      setCustomNote('');
      setIsCopied(false);
      setIsCustomMessageEdited(false);
    }
  }, [booking, defaultPhone, recipientType]);

  // Genera il testo base del messaggio
  const generatedMessage = useMemo(() => {
    if (!booking) return '';
    return formatBookingReminderMessage({
      booking,
      client,
      room,
      teacher,
      studioInfo,
      customNote,
      recipientType,
    });
  }, [booking, client, room, teacher, studioInfo, customNote, recipientType]);

  // Se l'utente non ha modificato a mano il testo completo, usa quello generato
  useEffect(() => {
    if (!isCustomMessageEdited) {
      setEditableMessage(generatedMessage);
    }
  }, [generatedMessage, isCustomMessageEdited]);

  const activeMessage = isCustomMessageEdited ? editableMessage : generatedMessage;

  // Calcolo link di condivisione
  const { universalUrl, cleanPhone } = useMemo(() => {
    return getWhatsAppShareLinks(activeMessage, phoneInput);
  }, [activeMessage, phoneInput]);

  if (!isOpen || !booking) return null;

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(activeMessage);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2500);
    } catch {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = activeMessage;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2500);
    }
  };

  const handleOpenWhatsApp = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const resetToGeneratedText = () => {
    setIsCustomMessageEdited(false);
    setEditableMessage(generatedMessage);
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto">
      <div
        className="relative w-full max-w-2xl bg-white dark:bg-[#121212] border border-slate-200 dark:border-emerald-500/30 rounded-2xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[94vh]"
      >
        {/* Header Modale */}
        <div className="px-5 sm:px-6 py-4 border-b border-slate-200 dark:border-neutral-800 bg-gradient-to-r from-emerald-50 via-teal-50/50 to-white dark:from-emerald-950/40 dark:via-neutral-900 dark:to-neutral-900 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-emerald-500/30">
              <MessageSquare className="w-5 h-5 fill-white stroke-none" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight leading-snug truncate">
                  Condividi su WhatsApp
                </h2>
                <span className="text-[10px] uppercase font-black tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/40 shrink-0">
                  Promemoria
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-neutral-400 font-normal truncate mt-0.5">
                Invia riepilogo e promemoria con orari, sala e dettagli
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="modal-header-btn-blue modal-close-btn-blue shrink-0 flex items-center justify-center w-9 h-9 rounded-xl bg-blue-600 hover:bg-red-600 active:scale-95 text-white transition-all cursor-pointer border border-blue-500 hover:border-red-500 shadow-md shadow-blue-500/25"
            style={{ backgroundColor: '#2563eb', color: '#ffffff', borderColor: '#1d4ed8' }}
            title="Chiudi"
            aria-label="Chiudi finestra"
          >
            <X className="w-5 h-5 text-white stroke-[2.5]" style={{ color: '#ffffff', stroke: '#ffffff' }} />
          </button>
        </div>

        {/* Corpo scrollabile */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 text-xs text-slate-700 dark:text-neutral-300">
          {/* Card riassunto rapido prenotazione */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-neutral-900/80 border border-slate-200 dark:border-neutral-800 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2.5">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center text-white shrink-0 font-bold"
                style={{ backgroundColor: room?.colore || '#059669' }}
              >
                {isLesson ? <GraduationCap className="w-5 h-5" /> : <Music2 className="w-5 h-5" />}
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900 dark:text-white">
                  {booking.clienteNome}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-neutral-400 flex items-center gap-1.5 mt-0.5">
                  <DoorOpen className="w-3 h-3 text-slate-400" />
                  <span>{booking.salaNome || room?.nome || 'Sala'}</span>
                  <span>&bull;</span>
                  <Calendar className="w-3 h-3 text-slate-400" />
                  <span>{formatDateItalian(booking.data, false)}</span>
                  <span>&bull;</span>
                  <Clock className="w-3 h-3 text-slate-400" />
                  <span>{booking.oraInizio} - {booking.oraFine}</span>
                </p>
              </div>
            </div>

            <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-slate-700 dark:text-neutral-200">
              {isLesson ? '🎓 Lezione' : '🎸 Prove Band'} ({booking.durataOre}h)
            </span>
          </div>

          {/* Selezione destinatario se è una lezione con docente */}
          {isLesson && teacher && (
            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-neutral-400 uppercase tracking-wider mb-1.5">
                A chi vuoi inviare il promemoria?
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRecipientType('client')}
                  className={`p-2.5 rounded-xl border text-left flex items-center gap-2.5 transition-all cursor-pointer ${
                    recipientType === 'client'
                      ? 'bg-emerald-50/70 dark:bg-emerald-500/15 border-emerald-500 text-emerald-900 dark:text-emerald-200 font-bold shadow-xs'
                      : 'bg-white dark:bg-neutral-900 border-slate-200 dark:border-neutral-800 text-slate-600 dark:text-neutral-400 hover:bg-slate-50'
                  }`}
                >
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                      recipientType === 'client'
                        ? 'bg-emerald-500 text-white'
                        : 'bg-slate-100 dark:bg-neutral-800 text-slate-500'
                    }`}
                  >
                    <User className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xs">Allievo / Cliente</p>
                    <p className="text-[10px] opacity-75 truncate">{booking.clienteNome}</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setRecipientType('teacher')}
                  className={`p-2.5 rounded-xl border text-left flex items-center gap-2.5 transition-all cursor-pointer ${
                    recipientType === 'teacher'
                      ? 'bg-emerald-50/70 dark:bg-emerald-500/15 border-emerald-500 text-emerald-900 dark:text-emerald-200 font-bold shadow-xs'
                      : 'bg-white dark:bg-neutral-900 border-slate-200 dark:border-neutral-800 text-slate-600 dark:text-neutral-400 hover:bg-slate-50'
                  }`}
                >
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                      recipientType === 'teacher'
                        ? 'bg-emerald-500 text-white'
                        : 'bg-slate-100 dark:bg-neutral-800 text-slate-500'
                    }`}
                  >
                    <GraduationCap className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xs">Insegnante / Docente</p>
                    <p className="text-[10px] opacity-75 truncate">
                      {teacher.nome} {teacher.cognome}
                    </p>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Input Numero di Telefono */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-bold text-slate-600 dark:text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
                <Phone className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                <span>Numero WhatsApp Destinatario</span>
              </label>
              {defaultPhone && phoneInput !== defaultPhone && (
                <button
                  type="button"
                  onClick={() => setPhoneInput(defaultPhone)}
                  className="text-[10px] text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                >
                  <RotateCcw className="w-2.5 h-2.5" /> Ripristina ({defaultPhone})
                </button>
              )}
            </div>

            <div className="relative">
              <input
                type="tel"
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value)}
                placeholder="es. 340 1234567 oppure +39 340 1234567"
                className="w-full px-3.5 py-2.5 pl-9 rounded-xl border border-slate-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-slate-800 dark:text-white font-mono text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
              />
              <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              {cleanPhone && (
                <span className="absolute right-3 top-2.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                  +{cleanPhone}
                </span>
              )}
            </div>
            <p className="text-[10px] text-slate-500 dark:text-neutral-500 mt-1">
              {cleanPhone
                ? `WhatsApp aprirà direttamente la conversazione con +${cleanPhone}.`
                : 'Se lasci vuoto, potrai scegliere il contatto dalla rubrica di WhatsApp.'}
            </p>
          </div>

          {/* Campo Nota o Avviso Personalizzato */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-neutral-400 uppercase tracking-wider mb-1">
              Aggiungi Nota o Avviso (opzionale)
            </label>
            <input
              type="text"
              value={customNote}
              onChange={(e) => {
                setCustomNote(e.target.value);
                setIsCustomMessageEdited(false);
              }}
              placeholder="es. Ricordate di portare i piatti della batteria, arrivo 10 min prima..."
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-slate-800 dark:text-white text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
            />
          </div>

          {/* Anteprima Fumetto Stile WhatsApp */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-bold text-slate-600 dark:text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-emerald-500" />
                <span>Anteprima Messaggio WhatsApp</span>
              </label>

              {isCustomMessageEdited ? (
                <button
                  type="button"
                  onClick={resetToGeneratedText}
                  className="text-[10px] text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-0.5 cursor-pointer font-semibold"
                >
                  <RotateCcw className="w-2.5 h-2.5" /> Ripristina testo automatico
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsCustomMessageEdited(true)}
                  className="text-[10px] text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                >
                  <FileEdit className="w-2.5 h-2.5" /> Modifica testo manuale
                </button>
              )}
            </div>

            {/* Simil-chat WhatsApp wallpaper */}
            <div className="rounded-xl border border-slate-300 dark:border-neutral-800 bg-[#e5ddd5] dark:bg-[#0b141a] p-3 sm:p-4 shadow-inner relative overflow-hidden">
              {/* WhatsApp chat bubble */}
              <div className="relative max-w-lg bg-white dark:bg-[#1f2c34] text-slate-800 dark:text-[#e9edef] rounded-lg rounded-tl-none p-3.5 shadow-sm space-y-2 border border-black/5">
                {isCustomMessageEdited ? (
                  <textarea
                    rows={8}
                    value={editableMessage}
                    onChange={(e) => setEditableMessage(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-neutral-700 rounded-lg p-2 text-xs font-sans text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden leading-relaxed"
                  />
                ) : (
                  <div className="whitespace-pre-wrap font-sans text-xs leading-relaxed select-text">
                    {activeMessage}
                  </div>
                )}

                {/* Footer del fumetto */}
                <div className="flex items-center justify-end gap-1 pt-1 text-[10px] text-slate-400 dark:text-neutral-400 font-sans">
                  <span>Adesso</span>
                  <span className="text-emerald-500 font-bold">✓✓</span>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Footer con pulsanti d'azione */}
        <div className="p-4 sm:p-5 border-t border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-900 flex items-center justify-between gap-2.5 flex-wrap shrink-0">
          {/* Pulsante Copia Testo */}
          <button
            type="button"
            onClick={handleCopyText}
            className={`px-3.5 py-2.5 rounded-xl border font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-xs ${
              isCopied
                ? 'bg-emerald-50 border-emerald-300 text-emerald-700 dark:bg-emerald-950/50 dark:border-emerald-700 dark:text-emerald-300'
                : 'bg-white dark:bg-neutral-800 border-slate-300 dark:border-neutral-700 text-slate-700 dark:text-neutral-200 hover:bg-slate-100 dark:hover:bg-neutral-700'
            }`}
          >
            {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{isCopied ? 'Copiato!' : 'Copia Testo'}</span>
          </button>

          {/* Pulsante Unico: Apri WhatsApp */}
          <button
            type="button"
            onClick={() => handleOpenWhatsApp(universalUrl)}
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black text-xs sm:text-sm shadow-md shadow-emerald-600/30 transition-all flex items-center gap-2 cursor-pointer ml-auto"
            title="Apre WhatsApp con il messaggio precompilato pronto all'invio"
          >
            <MessageSquare className="w-4 h-4 fill-white stroke-none" />
            <span>Apri su WhatsApp</span>
            <ExternalLink className="w-3.5 h-3.5 opacity-80" />
          </button>
        </div>
      </div>
    </div>
  );
};
