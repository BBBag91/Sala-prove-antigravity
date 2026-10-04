import { Booking, DailyShiftComputed, Room, StaffMember, StudioInfo, WhatsAppNotificationConfig, WhatsAppProvider } from '../types';
import { MESI_ITALIANI, parseISODate } from '../utils/dateUtils';

const GIORNI_SETTIMANA = [
  'Domenica',
  'Lunedì',
  'Martedì',
  'Mercoledì',
  'Giovedì',
  'Venerdì',
  'Sabato',
];

/**
 * Genera il testo completo del riepilogo giornaliero formattato per WhatsApp
 * con grassetto (*), corsivo (_), emoji e impaginazione pulita.
 */
export function formatMorningBriefingMessage({
  dateStr,
  studioInfo,
  dailyShifts,
  bookings,
  rooms,
  staff = [],
  config,
}: {
  dateStr: string;
  studioInfo: StudioInfo;
  dailyShifts: [DailyShiftComputed, DailyShiftComputed];
  bookings: Booking[];
  rooms: Room[];
  staff: StaffMember[];
  config?: WhatsAppNotificationConfig;
}): string {
  const d = parseISODate(dateStr);
  const giornoSettimana = GIORNI_SETTIMANA[d.getDay()];
  const giornoNumero = d.getDate();
  const meseNome = MESI_ITALIANI[d.getMonth()];
  const anno = d.getFullYear();

  const studioNome = studioInfo.nome || 'Sala Prove Musicale';

  // Ordina prenotazioni per orario di inizio
  const sortedBookings = [...bookings].sort((a, b) => a.oraInizio.localeCompare(b.oraInizio));

  const totalOre = sortedBookings.reduce((sum, b) => sum + (b.durataOre || 0), 0);

  const lines: string[] = [];

  // Intestazione
  lines.push(`☀️ *BUONGIORNO STAFF • ${studioNome.toUpperCase()}* ☀️`);
  lines.push(`📅 *${giornoSettimana} ${giornoNumero} ${meseNome} ${anno}*`);
  lines.push(`━━━━━━━━━━━━━━━━━━━━━`);

  // Sezione Turni Operatori di Presidio
  lines.push(`👥 *PRESIDIO SALA & TURNI OPERATORI:*`);
  const [shift1, shift2] = dailyShifts;

  const formatShiftLine = (shift: DailyShiftComputed, num: number) => {
    const nomeTurno = shift.nomeTurno || `Turno ${num}`;
    const orario = `${shift.oraInizio} - ${shift.oraFine}`;
    const opNome = shift.operatoreNome ? `*${shift.operatoreNome}*` : '_⚠️ Da assegnare_';
    const noteBadge = shift.isAdapted && shift.adaptationReason ? ` (${shift.adaptationReason})` : '';
    return `• 🕒 *${nomeTurno}* (${orario}): 👤 ${opNome}${noteBadge}`;
  };

  lines.push(formatShiftLine(shift1, 1));
  lines.push(formatShiftLine(shift2, 2));

  lines.push(`─────────────────────`);

  // Sezione Eventi & Prenotazioni
  const countBookings = sortedBookings.length;
  lines.push(`🎸 *PRENOTAZIONI ED EVENTI DI OGGI (${countBookings}):*`);

  if (countBookings === 0) {
    lines.push(`_Nessuna prenotazione registrata in calendario per oggi._`);
  } else {
    const getTeacherName = (b: Booking): string => {
      const teacherMember = staff.find((s) => s.id === b.insegnanteId);
      return (
        b.insegnanteNome?.trim() ||
        (teacherMember ? `${teacherMember.nome} ${teacherMember.cognome}`.trim() : '') ||
        b.clienteNome?.trim() ||
        'Insegnante'
      );
    };

    // Raggruppiamo le lezioni per (Docente + Sala)
    interface LessonGroup {
      docenteNome: string;
      roomNome: string;
      bookings: Booking[];
    }

    const lessonGroupsMap = new Map<string, LessonGroup>();
    const standardBookings: Booking[] = [];

    sortedBookings.forEach((b) => {
      if (b.tipo === 'lezione') {
        const docenteNome = getTeacherName(b);
        const room = rooms.find((r) => r.id === b.salaId);
        const roomNome = room?.nome || b.salaNome || 'Sala';
        const key = `${docenteNome.toLowerCase()}:::${b.salaId || roomNome.toLowerCase()}`;

        const existing = lessonGroupsMap.get(key);
        if (existing) {
          existing.bookings.push(b);
        } else {
          lessonGroupsMap.set(key, {
            docenteNome,
            roomNome,
            bookings: [b],
          });
        }
      } else {
        standardBookings.push(b);
      }
    });

    // Elementi da visualizzare ordinati per orario di inizio
    interface DisplayItem {
      earliestStart: string;
      renderLines: () => string[];
    }

    const displayItems: DisplayItem[] = [];

    // 1. Processa i gruppi di lezioni
    lessonGroupsMap.forEach((group) => {
      const intervals = group.bookings
        .map((b) => ({ start: b.oraInizio, end: b.oraFine }))
        .sort((a, b) => a.start.localeCompare(b.start));

      // Unisci intervalli contigui o sovrapposti (es. 16:00-17:00, 17:00-18:00 -> 16:00-18:00)
      const merged: { start: string; end: string }[] = [];
      for (const curr of intervals) {
        if (merged.length === 0) {
          merged.push({ ...curr });
        } else {
          const prev = merged[merged.length - 1];
          if (curr.start <= prev.end) {
            if (curr.end > prev.end) {
              prev.end = curr.end;
            }
          } else {
            merged.push({ ...curr });
          }
        }
      }

      const timeStrings = merged.map((m) => `${m.start} - ${m.end}`);
      const orarioFormatted =
        timeStrings.length === 1
          ? timeStrings[0]
          : timeStrings.slice(0, -1).join(', ') + ' e ' + timeStrings[timeStrings.length - 1];

      // Raccoglie la dotazione/strumentazione prima, seguita dalle note/descrizione
      const allDescLines = group.bookings
        .flatMap((b) => [
          b.richiesteStrumentazione?.trim(),
          b.note?.trim(),
          b.descrizione?.trim(),
        ])
        .filter(Boolean)
        .flatMap((text) => (text as string).split('\n'))
        .map((l) => l.trim())
        .filter(Boolean);

      const uniqueDescLines = Array.from(new Set(allDescLines));

      displayItems.push({
        earliestStart: intervals[0].start,
        renderLines: () => {
          const itemLines: string[] = [];
          itemLines.push(
            `🕒 *${orarioFormatted}* | 🎓 Lezione "${group.docenteNome}" in "${group.roomNome}"`
          );
          if (uniqueDescLines.length > 0) {
            itemLines.push(`   • 📝 NOTA BENE: _${uniqueDescLines.join(' - ')}_`);
          }
          return itemLines;
        },
      });
    });

    // 2. Processa le prenotazioni standard
    standardBookings.forEach((b) => {
      const room = rooms.find((r) => r.id === b.salaId);
      const roomNome = room?.nome || b.salaNome || 'Sala';

      const descLines = [
        b.richiesteStrumentazione?.trim(),
        b.note?.trim(),
        b.descrizione?.trim(),
      ]
        .filter(Boolean)
        .flatMap((text) => (text as string).split('\n'))
        .map((l) => l.trim())
        .filter(Boolean);

      const uniqueDescLines = Array.from(new Set(descLines));

      displayItems.push({
        earliestStart: b.oraInizio,
        renderLines: () => {
          const itemLines: string[] = [];
          itemLines.push(`🕒 *${b.oraInizio} - ${b.oraFine}* | 🚪 *${roomNome}*`);
          itemLines.push(`   • Band/Cliente: *${b.clienteNome}*`);
          if (uniqueDescLines.length > 0) {
            itemLines.push(`   • 📝 NOTA BENE: _${uniqueDescLines.join(' - ')}_`);
          }
          return itemLines;
        },
      });
    });

    // Ordina tutti gli elementi per orario d'inizio cronologico
    displayItems.sort((a, b) => a.earliestStart.localeCompare(b.earliestStart));

    // Renderizza numerando ogni elemento
    displayItems.forEach((item, idx) => {
      const rendered = item.renderLines();
      if (rendered.length > 0) {
        rendered[0] = `${idx + 1}️⃣ ${rendered[0]}`;
        lines.push(...rendered);
      }
    });
  }

  // Riepilogo finale
  lines.push(`━━━━━━━━━━━━━━━━━━━━━`);
  if (countBookings > 0) {
    lines.push(`📊 *Riepilogo:* ${countBookings} prenotazioni | ${totalOre.toFixed(1)}h totali`);
  }
  lines.push(`✨ _Buona giornata e buon lavoro a tutto lo staff!_ 🎶`);

  return lines.join('\n');
}

/**
 * Invio effettivo del messaggio tramite Gateway WhatsApp (UltraMsg, Green API, Whapi o Webhook)
 */
export async function sendWhatsAppViaApi(
  config: WhatsAppNotificationConfig,
  message: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!config.enabled) {
    return { success: false, error: 'Notifiche WhatsApp disabilitate nelle impostazioni.' };
  }

  try {
    switch (config.provider) {
      case 'ultramsg': {
        if (!config.instanceId || !config.token || !config.chatId) {
          return {
            success: false,
            error: 'Credenziali UltraMsg incomplete (Instance ID, Token o Chat/Group ID mancanti).',
          };
        }

        const endpoint = `https://api.ultramsg.com/${config.instanceId}/messages/chat`;
        const params = new URLSearchParams();
        params.append('token', config.token);
        params.append('to', config.chatId);
        params.append('body', message);

        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: params.toString(),
        });

        const data = await res.json();
        if (!res.ok || data.error) {
          return { success: false, error: data.error || `Errore HTTP ${res.status}` };
        }
        return { success: true, messageId: String(data.id || data.messageId || 'sent') };
      }

      case 'greenapi': {
        if (!config.instanceId || !config.token || !config.chatId) {
          return {
            success: false,
            error: 'Credenziali Green API incomplete (idInstance, apiTokenInstance o ChatId mancanti).',
          };
        }

        const endpoint = `https://api.green-api.com/waInstance${config.instanceId}/sendMessage/${config.token}`;
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chatId: config.chatId,
            message: message,
          }),
        });

        const data = await res.json();
        if (!res.ok || data.error) {
          return { success: false, error: data.message || data.error || `Errore HTTP ${res.status}` };
        }
        return { success: true, messageId: String(data.idMessage || 'sent') };
      }

      case 'whapi': {
        if (!config.token || !config.chatId) {
          return { success: false, error: 'Credenziali Whapi incomplete (Token o ChatId mancanti).' };
        }

        const endpoint = `https://gate.whapi.cloud/messages/text`;
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.token}`,
          },
          body: JSON.stringify({
            to: config.chatId,
            body: message,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          return { success: false, error: data.message || `Errore HTTP ${res.status}` };
        }
        return { success: true, messageId: String(data.sent || data.id || 'sent') };
      }

      case 'webhook': {
        if (!config.webhookUrl) {
          return { success: false, error: 'URL Webhook non configurato.' };
        }

        const res = await fetch(config.webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: message,
            chatId: config.chatId,
            timestamp: new Date().toISOString(),
          }),
        });

        if (!res.ok) {
          return { success: false, error: `Webhook ha risposto con codice ${res.status}` };
        }
        return { success: true };
      }

      case 'manual':
      default: {
        return {
          success: false,
          error: 'Modalità manuale selezionata. Usa il pulsante "Apri su WhatsApp" per inviare direttamente.',
        };
      }
    }
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Errore di connessione durante l\'invio a WhatsApp.',
    };
  }
}

/**
 * Link diretti per aprire WhatsApp con testo precompilato (Mobile, Web o Universal)
 */
export function getWhatsAppShareLinks(message: string, chatId?: string) {
  const encodedText = encodeURIComponent(message);

  // Se chatId è un numero di telefono (solo cifre senza @g.us), possiamo passarlo in wa.me/
  const isPhone = chatId && /^[0-9+]+$/.test(chatId.replace(/[\s-]/g, ''));
  const cleanPhone = isPhone ? chatId.replace(/[^0-9]/g, '') : '';

  const universalUrl = cleanPhone
    ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedText}`
    : `https://api.whatsapp.com/send?text=${encodedText}`;

  const webUrl = cleanPhone
    ? `https://web.whatsapp.com/send?phone=${cleanPhone}&text=${encodedText}`
    : `https://web.whatsapp.com/send?text=${encodedText}`;

  const appSchemeUrl = cleanPhone
    ? `whatsapp://send?phone=${cleanPhone}&text=${encodedText}`
    : `whatsapp://send?text=${encodedText}`;

  return { universalUrl, webUrl, appSchemeUrl };
}

/**
 * Richiede il permesso per le notifiche desktop del browser
 */
export async function requestBrowserNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }
  if (Notification.permission === 'granted') {
    return true;
  }
  if (Notification.permission !== 'denied') {
    const perm = await Notification.requestPermission();
    return perm === 'granted';
  }
  return false;
}

/**
 * Mostra una notifica nativa del browser
 */
export function showBrowserNotification(
  title: string,
  options?: NotificationOptions,
  onClick?: () => void
): boolean {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }
  if (Notification.permission !== 'granted') {
    return false;
  }

  try {
    const notif = new Notification(title, {
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      ...options,
    });

    if (onClick) {
      notif.onclick = () => {
        window.focus();
        onClick();
        notif.close();
      };
    }
    return true;
  } catch (e) {
    console.warn('[Notification] Impossibile mostrare notifica browser:', e);
    return false;
  }
}

export interface WhatsAppGroupItem {
  id: string; // Es. "120363024829182391@g.us"
  name: string; // Es. "Staff Sala Prove"
}

/**
 * Recupera in automatico la lista dei gruppi WhatsApp dal numero collegato
 */
export async function fetchWhatsAppGroups(config: {
  provider: WhatsAppProvider;
  instanceId?: string;
  token?: string;
}): Promise<{ success: boolean; groups?: WhatsAppGroupItem[]; notAuthorized?: boolean; error?: string }> {
  const cleanId = String(config.instanceId || '').replace(/^waInstance/i, '').trim();
  const cleanToken = String(config.token || '').trim();

  if (!cleanId || !cleanToken) {
    return { success: false, error: 'Instance ID e Token mancanti. Inserisci prima le credenziali.' };
  }

  // 1. Prova prima l'endpoint serverless (evita CORS e controlla lo stato autorizzazione)
  try {
    const proxyRes = await fetch('/api/whatsapp-groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: config.provider,
        instanceId: cleanId,
        token: cleanToken,
      }),
    });

    if (proxyRes.ok) {
      const text = await proxyRes.text();
      const data = text ? JSON.parse(text) : {};
      if (data.success && Array.isArray(data.groups)) {
        return { success: true, groups: data.groups };
      }
      if (data.error) {
        return { success: false, notAuthorized: data.notAuthorized, error: data.error };
      }
    }
  } catch (e) {
    console.warn('[fetchWhatsAppGroups] Proxy non disponibile, fallback su chiamata diretta:', e);
  }

  // 2. Fallback su chiamata diretta client-side
  try {
    if (config.provider === 'greenapi') {
      const url = `https://api.green-api.com/waInstance${cleanId}/getChats/${cleanToken}`;
      const res = await fetch(url, { method: 'GET' });
      const text = await res.text();
      let list: any[] = [];
      try {
        list = text ? JSON.parse(text) : [];
      } catch {
        return { success: false, error: 'Risposta non valida da Green API. Verifica che il QR Code sia stato scansionato.' };
      }

      if (!res.ok || !Array.isArray(list)) {
        return { success: false, error: (list as any)?.message || 'Errore Green API. Verifica le credenziali o se WhatsApp è collegato.' };
      }

      const groups = list
        .filter((c: any) => c.isGroup === true || (typeof c.id === 'string' && c.id.endsWith('@g.us')) || c.type === 'group')
        .map((c: any) => ({
          id: c.id,
          name: c.name || c.contactName || c.nameGroup || c.id,
        }));

      return { success: true, groups };
    }

    if (config.provider === 'ultramsg') {
      const url = `https://api.ultramsg.com/${cleanId}/groups?token=${cleanToken}`;
      const res = await fetch(url);
      const text = await res.text();
      let list: any[] = [];
      try {
        list = text ? JSON.parse(text) : [];
      } catch {
        return { success: false, error: 'Risposta non valida da UltraMsg.' };
      }

      if (!res.ok || !Array.isArray(list)) {
        return { success: false, error: (list as any)?.error || 'Errore UltraMsg.' };
      }

      const groups = list.map((g: any) => ({
        id: g.id || g.chatId,
        name: g.name || g.subject || g.id,
      }));

      return { success: true, groups };
    }

    return { success: false, error: 'Provider non supportato per il recupero automatico dei gruppi.' };
  } catch (err: any) {
    return { success: false, error: err.message || 'Errore durante il recupero dei gruppi WhatsApp.' };
  }
}

/**
 * Risolve un link d'invito WhatsApp (https://chat.whatsapp.com/...) ottenendo direttamente il Group ID
 */
export async function resolveGroupInviteLink(
  config: {
    provider: WhatsAppProvider;
    instanceId?: string;
    token?: string;
  },
  inviteUrl: string
): Promise<{ success: boolean; chatId?: string; groupName?: string; groups?: WhatsAppGroupItem[]; error?: string }> {
  try {
    const cleanUrl = inviteUrl.trim();
    if (!cleanUrl.includes('chat.whatsapp.com/')) {
      return {
        success: false,
        error: 'Il link deve essere un link di invito WhatsApp valido (es. https://chat.whatsapp.com/ABC...).',
      };
    }

    const cleanId = String(config.instanceId || '').replace(/^waInstance/i, '').trim();
    const cleanToken = String(config.token || '').trim();

    if (!cleanId || !cleanToken) {
      return {
        success: false,
        error: 'Inserisci prima idInstance e apiTokenInstance nei campi in alto per collegare il gruppo.',
      };
    }

    // Per UltraMsg prova groups/join se supportato
    if (config.provider === 'ultramsg') {
      try {
        const params = new URLSearchParams();
        params.append('token', cleanToken);
        params.append('invite_link', cleanUrl);

        const res = await fetch(`https://api.ultramsg.com/${cleanId}/groups/join`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: params.toString(),
        });
        const text = await res.text();
        const data = text ? JSON.parse(text) : {};
        if (res.ok && data.id) {
          return { success: true, chatId: data.id, groupName: data.name || 'Gruppo Staff WhatsApp' };
        }
      } catch {
        // Fallback
      }
    }

    // Per Green API o fallback:
    // Poiché il numero WhatsApp è già presente nel gruppo da cui ha estratto il link,
    // carichiamo le chat dell'account e recuperiamo i gruppi!
    const groupsRes = await fetchWhatsAppGroups(config);
    if (!groupsRes.success) {
      return {
        success: false,
        error: groupsRes.error || 'Impossibile accedere al tuo WhatsApp. Verifica che il QR Code sia inquadrato su Green API.',
      };
    }

    const groups = groupsRes.groups || [];
    if (groups.length === 0) {
      return {
        success: false,
        error: 'Nessun gruppo trovato sul tuo account WhatsApp. Assicurati che il numero sia membro del gruppo.',
      };
    }

    // Se c'è solo un gruppo, collegalo direttamente!
    return {
      success: true,
      chatId: groups[0].id,
      groupName: groups[0].name,
      groups,
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'Errore durante la connessione al gruppo WhatsApp.' };
  }
}
