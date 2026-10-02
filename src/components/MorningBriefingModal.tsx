import React, { useState, useMemo } from 'react';
import {
  X,
  MessageSquare,
  Send,
  Copy,
  Check,
  Calendar,
  Clock,
  Users,
  Music2,
  GraduationCap,
  ExternalLink,
  Settings2,
  ChevronRight,
  Sparkles,
  DollarSign,
  AlertCircle,
  Eye,
  CheckCircle2,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { DailyShiftComputed, Booking } from '../types';
import { formatDateToISO, parseISODate, MESI_ITALIANI } from '../utils/dateUtils';
import { computeDailyShifts } from '../utils/shiftUtils';
import {
  formatMorningBriefingMessage,
  sendWhatsAppViaApi,
  getWhatsAppShareLinks,
} from '../services/whatsappService';
import { WhatsAppSettingsModal } from './WhatsAppSettingsModal';

interface MorningBriefingModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialDate?: string;
}

const GIORNI_SETTIMANA = [
  'Domenica',
  'Lunedì',
  'Martedì',
  'Mercoledì',
  'Giovedì',
  'Venerdì',
  'Sabato',
];

export const MorningBriefingModal: React.FC<MorningBriefingModalProps> = ({
  isOpen,
  onClose,
  initialDate,
}) => {
  const { studioInfo, rooms, staff, bookings, shifts, updateStudioInfo } = useApp();

  const todayIso = useMemo(() => formatDateToISO(new Date()), []);
  const [selectedDate, setSelectedDate] = useState<string>(initialDate || todayIso);
  const [isCopied, setIsCopied] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showPreviewText, setShowPreviewText] = useState(false);

  // Prenotazioni per la data selezionata
  const dayBookings = useMemo(() => {
    return bookings
      .filter((b) => b.data === selectedDate)
      .sort((a, b) => a.oraInizio.localeCompare(b.oraInizio));
  }, [bookings, selectedDate]);

  // Turni calcolati per la data selezionata
  const dailyShifts: [DailyShiftComputed, DailyShiftComputed] = useMemo(() => {
    return computeDailyShifts(selectedDate, dayBookings, shifts, staff);
  }, [selectedDate, dayBookings, shifts, staff]);

  // Messaggio formattato per WhatsApp
  const whatsappMessage = useMemo(() => {
    return formatMorningBriefingMessage({
      dateStr: selectedDate,
      studioInfo,
      dailyShifts,
      bookings: dayBookings,
      rooms,
      staff,
      config: studioInfo.whatsappConfig,
    });
  }, [selectedDate, studioInfo, dailyShifts, dayBookings, rooms, staff]);

  // Info sulla data
  const dateObj = useMemo(() => parseISODate(selectedDate), [selectedDate]);
  const giornoNome = GIORNI_SETTIMANA[dateObj.getDay()];
  const dataLabel = `${giornoNome} ${dateObj.getDate()} ${MESI_ITALIANI[dateObj.getMonth()]} ${dateObj.getFullYear()}`;

  const config = studioInfo.whatsappConfig;
  const isApiConfigured =
    config?.enabled &&
    config?.provider !== 'manual' &&
    ((config.provider === 'ultramsg' && config.instanceId && config.token && config.chatId) ||
      (config.provider === 'greenapi' && config.instanceId && config.token && config.chatId) ||
      (config.provider === 'whapi' && config.token && config.chatId) ||
      (config.provider === 'webhook' && config.webhookUrl));

  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(whatsappMessage);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2500);
    } catch {
      // Fallback
      alert('Impossibile copiare automaticamente. Puoi selezionare il testo dalla finestra di anteprima.');
    }
  };

  const handleSendToWhatsApp = async () => {
    if (isApiConfigured && config) {
      setIsSending(true);
      setSendResult(null);

      const res = await sendWhatsAppViaApi(config, whatsappMessage);
      setIsSending(false);

      if (res.success) {
        setSendResult({
          success: true,
          message: 'Messaggio inviato con successo al gruppo WhatsApp dello staff!',
        });
        // Salva data ultimo invio
        updateStudioInfo({
          ...studioInfo,
          whatsappConfig: {
            ...config,
            lastAutoSentDate: selectedDate,
          },
        });
      } else {
        setSendResult({
          success: false,
          message: `Errore nell'invio automatico: ${res.error}. Puoi inviare aprendo WhatsApp manualmente.`,
        });
      }
    } else {
      // Modalità manuale / fallback: apri WhatsApp con il testo
      const links = getWhatsAppShareLinks(whatsappMessage, config?.chatId);
      window.open(links.universalUrl, '_blank');
    }
  };

  const totalOre = dayBookings.reduce((sum, b) => sum + (b.durataOre || 0), 0);
  const totalIncasso = dayBookings.reduce((sum, b) => sum + (b.tariffaTotale || 0), 0);
  const isToday = selectedDate === todayIso;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150">
        <div className="relative w-full max-w-3xl bg-neutral-900 border border-yellow-500/30 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[94vh]">
          {/* Header */}
          <div className="px-5 py-3.5 border-b border-yellow-500/20 bg-neutral-950 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-yellow-400 text-black flex items-center justify-center font-bold shadow-md shadow-yellow-500/20 shrink-0">
                ☕
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                    Riepilogo del Mattino (Ore {config?.orarioNotifica || '10:00'})
                  </h2>
                  {isToday && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-yellow-400 text-black">
                      Oggi
                    </span>
                  )}
                </div>
                <p className="text-xs text-neutral-400 capitalize">
                  {dataLabel} • {studioInfo.nome}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setIsSettingsOpen(true)}
                className="modal-header-btn-blue shrink-0 flex items-center justify-center w-9 h-9 rounded-xl !bg-blue-600 !text-white hover:!bg-blue-700 transition-all cursor-pointer border border-blue-500 shadow-md shadow-blue-500/25"
                style={{ backgroundColor: '#2563eb', color: '#ffffff' }}
                title="Configura Notifiche & WhatsApp"
              >
                <Settings2 className="w-5 h-5 !text-white stroke-[2.2]" style={{ color: '#ffffff', stroke: '#ffffff' }} />
              </button>
              <button
                type="button"
                onClick={onClose}
                className="modal-header-btn-blue modal-close-btn-blue shrink-0 flex items-center justify-center w-9 h-9 rounded-xl !bg-blue-600 !text-white hover:!bg-red-600 transition-all cursor-pointer border border-blue-500 hover:border-red-500 shadow-md shadow-blue-500/25"
                style={{ backgroundColor: '#2563eb', color: '#ffffff' }}
                title="Chiudi"
              >
                <X className="w-5 h-5 !text-white stroke-[2.5]" style={{ color: '#ffffff', stroke: '#ffffff' }} />
              </button>
            </div>
          </div>

          {/* Quick Date Switcher Bar */}
          <div className="px-5 py-2.5 bg-neutral-950/70 border-b border-neutral-800 flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-xs text-neutral-400 font-medium">Giorno:</span>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-2.5 py-1 rounded-lg bg-neutral-900 border border-neutral-700 text-xs font-bold text-yellow-300 focus:border-yellow-400 focus:outline-hidden"
              />
              {!isToday && (
                <button
                  type="button"
                  onClick={() => setSelectedDate(todayIso)}
                  className="text-xs text-yellow-400 hover:underline font-semibold"
                >
                  Torna ad Oggi
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowPreviewText(!showPreviewText)}
              className="text-xs text-neutral-400 hover:text-white flex items-center gap-1 cursor-pointer font-medium"
            >
              <Eye className="w-3.5 h-3.5 text-yellow-400" />
              <span>{showPreviewText ? 'Vista Schede' : 'Anteprima WhatsApp'}</span>
            </button>
          </div>

          {/* Scrollable Body */}
          <div className="overflow-y-auto p-5 space-y-4 flex-1">
            {showPreviewText ? (
              /* WhatsApp Raw Text Preview */
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-yellow-400 uppercase tracking-wider">
                    Messaggio WhatsApp Formattato
                  </span>
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="text-xs text-yellow-400 hover:text-yellow-300 flex items-center gap-1 font-semibold"
                  >
                    {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{isCopied ? 'Copiato!' : 'Copia Testo'}</span>
                  </button>
                </div>
                <pre className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 text-xs text-emerald-400 font-mono whitespace-pre-wrap leading-relaxed max-h-[50vh] overflow-y-auto selection:bg-emerald-500/30">
                  {whatsappMessage}
                </pre>
              </div>
            ) : (
              /* Rich Visual View */
              <>
                {/* 1. SEZIONE TURNI OPERATORI */}
                <div className="p-4 rounded-xl bg-neutral-950 border border-yellow-500/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-yellow-400/10 text-yellow-400">
                        <Users className="w-4 h-4" />
                      </div>
                      <h3 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider">
                        Presidio Sala & Turni Operatori di Oggi
                      </h3>
                    </div>
                    <span className="text-[11px] text-yellow-400 font-semibold">2 Turni Previsti</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {dailyShifts.map((shift, idx) => {
                      const opMember = staff.find((s) => s.id === shift.operatoreId);
                      const badgeColor = opMember?.coloreBadge || shift.operatoreBadgeColor || '#eab308';
                      const hasOp = Boolean(shift.operatoreNome);

                      return (
                        <div
                          key={idx}
                          className="p-3 rounded-lg bg-neutral-900 border border-neutral-800 flex items-start justify-between gap-2"
                        >
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
                              <span className="text-xs font-bold text-white">
                                {shift.nomeTurno || `Turno ${idx + 1}`}
                              </span>
                              <span className="text-xs font-mono font-bold text-yellow-400">
                                {shift.oraInizio} - {shift.oraFine}
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5 pt-0.5">
                              <span
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: hasOp ? badgeColor : '#71717a' }}
                              />
                              <span
                                className={`text-xs font-semibold truncate ${
                                  hasOp ? 'text-white' : 'text-neutral-500 italic'
                                }`}
                              >
                                {shift.operatoreNome || '⚠️ Operatore da assegnare'}
                              </span>
                            </div>

                            {shift.isAdapted && shift.adaptationReason && (
                              <p className="text-[10px] text-yellow-400/80 line-clamp-1 pt-0.5">
                                ⏱️ {shift.adaptationReason}
                              </p>
                            )}
                          </div>

                          <span className="text-[10px] font-bold text-neutral-400 bg-neutral-800 px-2 py-0.5 rounded-md shrink-0">
                            {shift.durataOre.toFixed(1)}h
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 2. SEZIONE PRENOTAZIONI DEL GIORNO */}
                <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-yellow-400/10 text-yellow-400">
                        <Music2 className="w-4 h-4" />
                      </div>
                      <h3 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider">
                        Prenotazioni ed Eventi del Giorno ({dayBookings.length})
                      </h3>
                    </div>
                    {dayBookings.length > 0 && (
                      <span className="text-[11px] text-neutral-400 font-medium">
                        Totale: <strong className="text-white">{totalOre.toFixed(1)}h</strong> • Previsti:{' '}
                        <strong className="text-emerald-400">€{totalIncasso.toFixed(2)}</strong>
                      </span>
                    )}
                  </div>

                  {dayBookings.length === 0 ? (
                    <div className="py-6 text-center text-xs text-neutral-400 bg-neutral-900/50 rounded-lg border border-neutral-800/80">
                      Nessuna prenotazione o prova registrata per questa data.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {dayBookings.map((b) => {
                        const room = rooms.find((r) => r.id === b.salaId);
                        const roomColor = room?.colore || '#eab308';
                        const isLezione = b.tipo === 'lezione';
                        const isPaid = b.statoPagamento === 'pagato';

                        return (
                          <div
                            key={b.id}
                            className="p-3 rounded-lg bg-neutral-900 border border-neutral-800 hover:border-yellow-500/30 transition-colors flex items-center justify-between gap-3"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              {/* Sala Color Bar */}
                              <div
                                className="w-1.5 self-stretch rounded-full shrink-0"
                                style={{ backgroundColor: roomColor }}
                              />

                              <div className="space-y-0.5 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-xs font-mono font-bold text-yellow-400">
                                    {b.oraInizio} - {b.oraFine}
                                  </span>
                                  <span className="text-xs text-neutral-400">•</span>
                                  <span className="text-xs font-semibold text-neutral-300">
                                    {room?.nome || b.salaNome}
                                  </span>
                                  <span
                                    className={`text-[10px] font-bold px-1.5 py-0.2 rounded-md ${
                                      isLezione
                                        ? 'bg-blue-500/10 text-blue-300 border border-blue-500/30'
                                        : 'bg-yellow-400/10 text-yellow-400 border border-yellow-500/30'
                                    }`}
                                  >
                                    {isLezione ? 'Lezione' : 'Prove'}
                                  </span>
                                </div>

                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-white truncate">
                                    {b.clienteNome}
                                  </span>
                                  {isLezione && b.insegnanteNome && (
                                    <span className="text-[11px] text-neutral-400 italic truncate">
                                      (Docente: {b.insegnanteNome})
                                    </span>
                                  )}
                                </div>

                                {b.richiesteStrumentazione && (
                                  <p className="text-[10px] text-neutral-400 truncate">
                                    📦 {b.richiesteStrumentazione}
                                  </p>
                                )}
                              </div>
                            </div>

                            {/* Prezzo e stato pagamento */}
                            <div className="text-right shrink-0">
                              <span className="text-xs font-bold text-white block">
                                €{b.tariffaTotale.toFixed(2)}
                              </span>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-block mt-0.5 ${
                                  isPaid
                                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                    : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                                }`}
                              >
                                {isPaid ? 'Saldato' : 'Da Saldare'}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Risultato invio API */}
            {sendResult && (
              <div
                className={`p-3.5 rounded-xl text-xs border flex items-center justify-between gap-2 ${
                  sendResult.success
                    ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                    : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
                }`}
              >
                <span>{sendResult.message}</span>
                <button
                  type="button"
                  onClick={() => setSendResult(null)}
                  className="text-neutral-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="px-5 py-3.5 border-t border-neutral-800 bg-neutral-950 flex flex-wrap items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopy}
                className="px-3 py-2 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-xs font-semibold text-neutral-200 flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Copia testo negli appunti per incollarlo su WhatsApp"
              >
                {isCopied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400 font-bold">Copiato!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-yellow-400" />
                    <span>Copia Testo</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  const links = getWhatsAppShareLinks(whatsappMessage, config?.chatId);
                  window.open(links.webUrl, '_blank');
                }}
                className="px-3 py-2 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-xs font-semibold text-neutral-200 flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Apri WhatsApp Web con messaggio precaricato"
              >
                <ExternalLink className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline">WhatsApp Web</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 rounded-lg text-xs font-medium text-neutral-400 hover:text-white transition-colors"
              >
                Chiudi
              </button>

              <button
                type="button"
                onClick={handleSendToWhatsApp}
                disabled={isSending}
                className="px-5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs shadow-md shadow-emerald-500/20 transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>
                  {isSending
                    ? 'Invio in corso...'
                    : isApiConfigured
                    ? 'Invia al Gruppo WhatsApp'
                    : 'Invia su WhatsApp (1-Click)'}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Impostazioni WhatsApp */}
      <WhatsAppSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </>
  );
};
