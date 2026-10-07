import React, { useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { formatDateToISO, shouldSendDailyBriefing } from '../utils/dateUtils';
import { computeDailyShifts } from '../utils/shiftUtils';
import { formatMorningBriefingMessage, sendWhatsAppViaApi, showBrowserNotification } from '../services/whatsappService';

interface MorningNotificationWatcherProps {
  onOpenBriefingModal: (date?: string) => void;
}

export const MorningNotificationWatcher: React.FC<MorningNotificationWatcherProps> = ({
  onOpenBriefingModal,
}) => {
  const { studioInfo, rooms, bookings, shifts, staff, isLoadingCloud, updateStudioInfo } = useApp();
  // Evita notifiche desktop multiple nella stessa giornata per questa finestra
  const hasNotifiedDesktopRef = useRef<string | null>(null);
  // Evita chiamate ripetute dell'invio WhatsApp automatico
  const hasAutoSentWhatsAppRef = useRef<string | null>(null);

  useEffect(() => {
    // Non eseguire nulla prima del termine del caricamento dei dati da Supabase
    if (isLoadingCloud) return;

    const checkSchedule = () => {
      const config = studioInfo.whatsappConfig;
      if (!config || !config.enabled) return;

      const now = new Date();
      const todayStr = formatDateToISO(now);

      // Notifica desktop solo una volta al giorno
      if (hasNotifiedDesktopRef.current === todayStr) return;

      // Regola: invio dal Lunedì al Sabato. NON inviare la Domenica e NON inviare nei giorni festivi.
      // Orario di riferimento: config.orarioNotifica || '10:00'
      const briefingRule = shouldSendDailyBriefing(now, config.orarioNotifica || '10:00');
      if (!briefingRule.shouldSend) {
        return;
      }

      const targetTimeStr = briefingRule.targetHour;
      const [targetHours, targetMinutes] = targetTimeStr.split(':').map((n) => parseInt(n, 10));

      const currentHours = now.getHours();
      const currentMinutes = now.getMinutes();

      // Verifica se siamo nell'orario previsto o successivo
      const isPastTargetTime =
        currentHours > targetHours ||
        (currentHours === targetHours && currentMinutes >= targetMinutes);

      if (!isPastTargetTime) return;

      // 1. Notifica Desktop Browser per l'operatore alla postazione PC
      if (config.browserNotificationEnabled && hasNotifiedDesktopRef.current !== todayStr) {
        hasNotifiedDesktopRef.current = todayStr;

        const todayBookings = bookings.filter((b) => b.data === todayStr);
        const dailyShifts = computeDailyShifts(todayStr, todayBookings, shifts, staff);

        const shift1Op = dailyShifts[0].operatoreNome || 'Da assegnare';
        const shift2Op = dailyShifts[1].operatoreNome || 'Da assegnare';
        const bookingCount = todayBookings.length;

        showBrowserNotification(
          `☀️ Sala Prove: Riepilogo di Oggi (${targetTimeStr})`,
          {
            body: `Turni: ${shift1Op} (17-20), ${shift2Op} (20-23) • ${bookingCount} eventi in programma. Clicca per vedere o inviare su WhatsApp.`,
            requireInteraction: false,
          },
          () => {
            onOpenBriefingModal(todayStr);
          }
        );
      }

      // 2. FALLBACK AUTOMATICO DI SICUREZZA PER WHATSAPP:
      // Se sono passate le 10:00 e il messaggio WhatsApp non risulta ancora inviato per oggi
      // (es. perché il runner cron del server o GitHub Actions ha avuto un ritardo/downtime),
      // invia in background tramite API gateway WhatsApp e aggiorna lastAutoSentDate su Supabase.
      if (
        config.autoSendMorning !== false &&
        config.lastAutoSentDate !== todayStr &&
        hasAutoSentWhatsAppRef.current !== todayStr
      ) {
        hasAutoSentWhatsAppRef.current = todayStr;
        const isApiConfigured =
          config.enabled &&
          config.provider !== 'manual' &&
          ((config.provider === 'ultramsg' && config.instanceId && config.token && config.chatId) ||
            (config.provider === 'greenapi' && config.instanceId && config.token && config.chatId) ||
            (config.provider === 'whapi' && config.token && config.chatId) ||
            (config.provider === 'webhook' && config.webhookUrl));

        if (isApiConfigured) {
          const todayBookings = bookings.filter((b) => b.data === todayStr);
          const dailyShifts = computeDailyShifts(todayStr, todayBookings, shifts, staff);
          const whatsappMessage = formatMorningBriefingMessage({
            dateStr: todayStr,
            studioInfo,
            dailyShifts,
            bookings: todayBookings,
            rooms,
            staff,
            config,
          });

          sendWhatsAppViaApi(config, whatsappMessage)
            .then((res) => {
              if (res.success) {
                console.log('[MorningWatcher] Fallback invio WhatsApp del mattino completato con successo per:', todayStr);
                updateStudioInfo({
                  ...studioInfo,
                  whatsappConfig: {
                    ...config,
                    lastAutoSentDate: todayStr,
                  },
                });
              } else {
                console.warn('[MorningWatcher] Fallback invio automatico WhatsApp fallito:', res.error);
              }
            })
            .catch((err) => {
              console.error('[MorningWatcher] Errore imprevisto invio automatico WhatsApp:', err);
            });
        }
      }
    };

    checkSchedule();

    // Controlla ogni 60 secondi
    const interval = setInterval(checkSchedule, 60 * 1000);
    return () => clearInterval(interval);
  }, [studioInfo, rooms, bookings, shifts, staff, isLoadingCloud, updateStudioInfo, onOpenBriefingModal]);

  return null;
};
