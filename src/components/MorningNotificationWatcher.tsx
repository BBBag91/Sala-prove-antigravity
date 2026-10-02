import React, { useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { formatDateToISO } from '../utils/dateUtils';
import { computeDailyShifts } from '../utils/shiftUtils';
import {
  formatMorningBriefingMessage,
  sendWhatsAppViaApi,
  showBrowserNotification,
} from '../services/whatsappService';

interface MorningNotificationWatcherProps {
  onOpenBriefingModal: (date?: string) => void;
}

export const MorningNotificationWatcher: React.FC<MorningNotificationWatcherProps> = ({
  onOpenBriefingModal,
}) => {
  const { studioInfo, updateStudioInfo, bookings, shifts, staff, rooms } = useApp();
  // Guard in-memory: evita invii concorrenti mentre una chiamata API è ancora in volo
  const isSendingRef = useRef<boolean>(false);

  useEffect(() => {
    const checkSchedule = async () => {
      const config = studioInfo.whatsappConfig;
      if (!config || !config.enabled) return;

      // Evita invii concorrenti (due tick ravvicinati con API in volo)
      if (isSendingRef.current) return;

      const now = new Date();
      const todayStr = formatDateToISO(now);

      // Orario di notifica impostato (default: "10:00")
      const targetTimeStr = config.orarioNotifica || '10:00';
      const [targetHours, targetMinutes] = targetTimeStr.split(':').map((n) => parseInt(n, 10));

      const currentHours = now.getHours();
      const currentMinutes = now.getMinutes();

      // Verifica se siamo nell'orario previsto o successivo (include apertura tardiva)
      const isPastTargetTime =
        currentHours > targetHours ||
        (currentHours === targetHours && currentMinutes >= targetMinutes);

      if (!isPastTargetTime) return;

      // Guard principale: usa solo lastAutoSentDate persistito su cloud.
      // Garantisce che, anche aprendo l'app ore dopo le 10:00, il messaggio
      // venga comunque inviato se non è ancora stato inviato oggi.
      if (config.lastAutoSentDate === todayStr) return;

      isSendingRef.current = true;

      try {
        // Calcola dati del giorno
        const todayBookings = bookings.filter((b) => b.data === todayStr);
        const dailyShifts = computeDailyShifts(todayStr, todayBookings, shifts, staff);

        // 1. Notifica Desktop Browser (se abilitata)
        if (config.browserNotificationEnabled) {
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

        // 2. Invio Automatico WhatsApp via Gateway (se configurato e abilitato)
        if (config.autoSendMorning && config.provider !== 'manual') {
          console.log('[MorningNotificationWatcher] Invio automatico notifica mattutina WhatsApp in corso...');
          const message = formatMorningBriefingMessage({
            dateStr: todayStr,
            studioInfo,
            dailyShifts,
            bookings: todayBookings,
            rooms,
            staff,
            config,
          });

          const result = await sendWhatsAppViaApi(config, message);
          if (result.success) {
            console.log('[MorningNotificationWatcher] Notifica WhatsApp inviata con successo al gruppo!');
            // Persiste la data su cloud: guard definitivo per oggi
            updateStudioInfo({
              ...studioInfo,
              whatsappConfig: {
                ...config,
                lastAutoSentDate: todayStr,
              },
            });
          } else {
            console.warn('[MorningNotificationWatcher] Errore invio automatico WhatsApp:', result.error);
            // Non persistiamo lastAutoSentDate → al prossimo tick (60s) riproverà
          }
        } else {
          // Solo notifica browser: segna come completato per non ri-mostrare ogni minuto
          if (config.browserNotificationEnabled) {
            updateStudioInfo({
              ...studioInfo,
              whatsappConfig: {
                ...config,
                lastAutoSentDate: todayStr,
              },
            });
          }
        }
      } finally {
        isSendingRef.current = false;
      }
    };

    // Controlla subito all'avvio (gestisce apertura tardiva dopo le 10:00)
    checkSchedule();

    // Controlla ogni 60 secondi
    const interval = setInterval(checkSchedule, 60 * 1000);
    return () => clearInterval(interval);
  }, [studioInfo, bookings, shifts, staff, rooms, updateStudioInfo, onOpenBriefingModal]);

  return null;
};
