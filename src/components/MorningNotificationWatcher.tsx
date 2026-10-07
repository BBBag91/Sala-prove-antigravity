import React, { useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { formatDateToISO, shouldSendDailyBriefing } from '../utils/dateUtils';
import { computeDailyShifts } from '../utils/shiftUtils';
import { showBrowserNotification } from '../services/whatsappService';

interface MorningNotificationWatcherProps {
  onOpenBriefingModal: (date?: string) => void;
}

export const MorningNotificationWatcher: React.FC<MorningNotificationWatcherProps> = ({
  onOpenBriefingModal,
}) => {
  const { studioInfo, bookings, shifts, staff, isLoadingCloud } = useApp();
  // Evita notifiche desktop multiple nella stessa giornata per questa finestra
  const hasNotifiedDesktopRef = useRef<string | null>(null);

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

      // 1. Notifica Desktop Browser per l'operatore alla postazione PC (una sola volta al giorno)
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
            body: `Turni: ${shift1Op} (17-20), ${shift2Op} (20-23) • ${bookingCount} eventi in programma. Clicca per visualizzare o condividere su WhatsApp.`,
            requireInteraction: false,
          },
          () => {
            onOpenBriefingModal(todayStr);
          }
        );
      }

      // NOTA DI SICUREZZA: L'invio automatico massivo al gruppo WhatsApp è delegato ESCLUSIVAMENTE
      // al servizio serverless schedulato (/api/cron-daily-briefing), garantendo l'invio singolo giornaliero atomico
      // e impedendo duplicati generati dalle finestre browser aperte su più dispositivi.
    };

    checkSchedule();

    // Controlla ogni 60 secondi
    const interval = setInterval(checkSchedule, 60 * 1000);
    return () => clearInterval(interval);
  }, [studioInfo, bookings, shifts, staff, isLoadingCloud, onOpenBriefingModal]);

  return null;
};
