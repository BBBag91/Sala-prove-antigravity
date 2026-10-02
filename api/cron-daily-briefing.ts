import { createClient } from '@supabase/supabase-js';

interface VercelRequest {
  headers: Record<string, string | string[] | undefined>;
  query?: Record<string, string | string[]>;
  body?: any;
}

interface VercelResponse {
  status: (code: number) => VercelResponse;
  json: (data: any) => void;
}

// Calcolo turni giornalieri lato server
function computeDailyShiftsServer(dateStr: string, bookings: any[], shifts: any[]) {
  const baseStart = '17:00';
  const baseMid = '20:00';
  const baseEnd = '23:00';

  const saved1 = shifts.find((s) => s.data === dateStr && (s.turno_numero === 1 || s.turnoNumero === 1));
  const saved2 = shifts.find((s) => s.data === dateStr && (s.turno_numero === 2 || s.turnoNumero === 2));

  return [
    {
      nomeTurno: '1° Turno',
      oraInizio: saved1?.ora_inizio_effettiva || baseStart,
      oraFine: saved1?.ora_fine_effettiva || baseMid,
      operatoreNome: saved1?.operatore_nome || '',
    },
    {
      nomeTurno: '2° Turno',
      oraInizio: saved2?.ora_inizio_effettiva || baseMid,
      oraFine: saved2?.ora_fine_effettiva || baseEnd,
      operatoreNome: saved2?.operatore_nome || '',
    },
  ];
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

const MESI_ITALIANI = [
  'Gennaio',
  'Febbraio',
  'Marzo',
  'Aprile',
  'Maggio',
  'Giugno',
  'Luglio',
  'Agosto',
  'Settembre',
  'Ottobre',
  'Novembre',
  'Dicembre',
];

// Algoritmo calcolo Pasqua (Meeus/Jones/Butcher)
function getEasterSundayServer(year: number): { month: number; day: number } {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { month, day };
}

function isItalianHolidayServer(date: Date): boolean {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();

  const fixedHolidays = [
    '01-01', // Capodanno
    '01-06', // Epifania
    '04-25', // Liberazione
    '05-01', // Lavoratori
    '06-02', // Repubblica
    '08-15', // Ferragosto
    '11-01', // Ognissanti
    '12-08', // Immacolata
    '12-25', // Natale
    '12-26', // Santo Stefano
  ];

  const monthDayStr = `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  if (fixedHolidays.includes(monthDayStr)) {
    return true;
  }

  // Pasquetta (Pasqua + 1 giorno)
  const easter = getEasterSundayServer(year);
  const pasquettaDate = new Date(year, easter.month - 1, easter.day + 1);

  if (
    date.getFullYear() === pasquettaDate.getFullYear() &&
    date.getMonth() === pasquettaDate.getMonth() &&
    date.getDate() === pasquettaDate.getDate()
  ) {
    return true;
  }

  return false;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Facoltativo: verifica token segreto CRON_SECRET
  const authHeader = req.headers.authorization;
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized: CRON_SECRET mismatch' });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://qapmpppmejfcekqdzrgz.supabase.co';
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || 'sb_publishable_vbdUnCY1YehkXPcdNsLsOw_YHaHCz1K';

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Supabase credentials not configured' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // 1. Data e ora corrente in Europa/Roma
    const nowInRome = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Rome' }));
    const year = nowInRome.getFullYear();
    const month = String(nowInRome.getMonth() + 1).padStart(2, '0');
    const day = String(nowInRome.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;
    const currentHourIT = nowInRome.getHours();
    const dayOfWeek = nowInRome.getDay(); // 0 = Domenica, 1 = Lunedì ... 6 = Sabato

    const isForce = req.query?.force === 'true' || req.query?.force === '1';

    // 2. Controllo festività e domeniche:
    // Nessun invio la domenica e nei giorni festivi
    if (!isForce && dayOfWeek === 0) {
      return res.status(200).json({
        message: `Domenica (${todayStr}): nessun invio messaggio di resoconto programmato. Skip.`,
      });
    }

    if (!isForce && isItalianHolidayServer(nowInRome)) {
      return res.status(200).json({
        message: `Giorno festivo nazionale (${todayStr}): nessun invio messaggio di resoconto programmato. Skip.`,
      });
    }

    // 3. Fetch studio info
    const { data: studioData } = await supabase.from('studio_info').select('*').limit(1).single();
    const studioInfo = studioData || {};
    
    // Recupero configurazione WhatsApp: prima colonna dedicata, poi fallback da note
    let config = studioInfo.whatsapp_config;
    if (!config && studioInfo.note && studioInfo.note.includes('__WA_CFG__:')) {
      try {
        const match = studioInfo.note.match(/__WA_CFG__:([\s\S]*?)__END_WA_CFG__/);
        if (match && match[1]) {
          config = JSON.parse(match[1]);
        }
      } catch (e) {
        console.warn('[cron] Errore parsing fallback config WhatsApp da note:', e);
      }
    }

    if (!config || !config.enabled) {
      return res.status(200).json({ message: 'WhatsApp notifications are disabled in studio_info' });
    }

    // 4. Controlla se il messaggio è già stato inviato oggi (guard idempotente, bypassabile con ?force=true)
    if (!isForce && config.lastAutoSentDate === todayStr) {
      return res.status(200).json({ message: `Messaggio già inviato oggi (${todayStr}), skip.` });
    }

    // 5. Verifica orario target:
    // Il Sabato: ore 09:00
    // Dal Lunedì al Venerdì: config.orarioNotifica || '10:00'
    const targetTimeStr: string = dayOfWeek === 6 ? '09:00' : (config.orarioNotifica || '10:00');
    const [targetHours, targetMinutes] = targetTimeStr.split(':').map((n: string) => parseInt(n, 10));

    if (!isForce && (currentHourIT < targetHours || (currentHourIT === targetHours && nowInRome.getMinutes() < targetMinutes))) {
      return res.status(200).json({
        message: `Troppo presto: ora italiana ${currentHourIT}:${String(nowInRome.getMinutes()).padStart(2,'0')}, target ${targetTimeStr} (${dayOfWeek === 6 ? 'Sabato' : 'Lun-Ven'}). Skip.`
      });
    }

    const { data: bookingsData } = await supabase
      .from('bookings')
      .select('*')
      .eq('data', todayStr)
      .order('ora_inizio', { ascending: true });

    const bookings = bookingsData || [];

    // 6. Fetch turni di oggi
    const { data: shiftsData } = await supabase
      .from('shifts')
      .select('*')
      .eq('data', todayStr);

    const shifts = shiftsData || [];

    // 7. Fetch sale
    const { data: roomsData } = await supabase.from('rooms').select('*');
    const rooms = roomsData || [];

    // 8. Calcolo turni
    const dailyShifts = computeDailyShiftsServer(todayStr, bookings, shifts);

    // 9. Composizione messaggio WhatsApp
    const giornoNome = GIORNI_SETTIMANA[nowInRome.getDay()];
    const meseNome = MESI_ITALIANI[nowInRome.getMonth()];
    const studioNome = studioInfo.nome || 'Sala Prove Musicale';

    const lines: string[] = [];
    lines.push(`☀️ *BUONGIORNO STAFF • ${studioNome.toUpperCase()}* ☀️`);
    lines.push(`📅 *${giornoNome} ${nowInRome.getDate()} ${meseNome} ${year}*`);
    lines.push(`━━━━━━━━━━━━━━━━━━━━━`);

    lines.push(`👥 *PRESIDIO SALA & TURNI OPERATORI:*`);
    lines.push(`• 🕒 *${dailyShifts[0].nomeTurno}* (${dailyShifts[0].oraInizio} - ${dailyShifts[0].oraFine}): 👤 ${dailyShifts[0].operatoreNome ? `*${dailyShifts[0].operatoreNome}*` : '_⚠️ Da assegnare_'}`);
    lines.push(`• 🕒 *${dailyShifts[1].nomeTurno}* (${dailyShifts[1].oraInizio} - ${dailyShifts[1].oraFine}): 👤 ${dailyShifts[1].operatoreNome ? `*${dailyShifts[1].operatoreNome}*` : '_⚠️ Da assegnare_'}`);
    lines.push(`─────────────────────`);

    lines.push(`🎸 *PRENOTAZIONI ED EVENTI DI OGGI (${bookings.length}):*`);
    if (bookings.length === 0) {
      lines.push(`_Nessuna prenotazione al momento in calendario per oggi._`);
    } else {
      bookings.forEach((b: any, idx: number) => {
        const room = rooms.find((r: any) => r.id === b.sala_id);
        const roomNome = room?.nome || b.sala_nome || 'Sala';
        const tipoStr = b.tipo === 'lezione' ? '🎓 Lezione' : '🎸 Prove';
        lines.push(`${idx + 1}️⃣ 🕒 *${b.ora_inizio} - ${b.ora_fine}* | 🚪 *${roomNome}*`);
        lines.push(`   • Band/Cliente: *${b.cliente_nome}* (${tipoStr})`);
        if (config.includiStatoPagamenti !== false) {
          const pagato = b.stato_pagamento === 'pagato';
          lines.push(`   • Pagamento: ${pagato ? `✅ Saldato (€${Number(b.tariffa_totale || 0).toFixed(2)})` : `⏳ Da Saldare (€${Number(b.tariffa_totale || 0).toFixed(2)})`}`);
        }
      });
    }

    lines.push(`━━━━━━━━━━━━━━━━━━━━━`);
    lines.push(`✨ _Buona giornata e buon lavoro a tutto lo staff!_ 🎶`);

    const message = lines.join('\n');

    // 10. Invio tramite Provider
    let sendResult: { success: boolean; provider: string; data?: any; error?: string };

    if (config.provider === 'ultramsg') {
      const endpoint = `https://api.ultramsg.com/${config.instanceId}/messages/chat`;
      const params = new URLSearchParams();
      params.append('token', config.token);
      params.append('to', config.chatId);
      params.append('body', message);

      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });
      const text = await resp.text();
      let data: any = {};
      try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
      sendResult = { success: true, provider: 'ultramsg', data };
    } else if (config.provider === 'greenapi') {
      const endpoint = `https://api.green-api.com/waInstance${config.instanceId}/sendMessage/${config.token}`;
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: config.chatId, message }),
      });
      const text = await resp.text();
      let data: any = {};
      try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
      sendResult = { success: true, provider: 'greenapi', data };
    } else if (config.provider === 'whapi') {
      const endpoint = `https://gate.whapi.cloud/messages/text`;
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.token}`,
        },
        body: JSON.stringify({ to: config.chatId, body: message }),
      });
      const text = await resp.text();
      let data: any = {};
      try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
      sendResult = { success: resp.ok, provider: 'whapi', data };
    } else if (config.provider === 'webhook' && config.webhookUrl) {
      await fetch(config.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, date: todayStr }),
      });
      sendResult = { success: true, provider: 'webhook' };
    } else {
      return res.status(200).json({ success: false, message: 'Provider manual o non configurato per cron' });
    }

    // 11. Se invio riuscito, persisti lastAutoSentDate su Supabase
    if (sendResult.success) {
      const updatedConfig = { ...config, lastAutoSentDate: todayStr };
      
      // Prova prima con la colonna whatsapp_config
      const { error: updateErr } = await supabase
        .from('studio_info')
        .update({ whatsapp_config: updatedConfig })
        .eq('id', studioInfo.id);

      // Se la colonna non esiste, salva nel blocco note come fallback
      if (updateErr && (updateErr.code === 'PGRST204' || updateErr.message?.includes('whatsapp_config'))) {
        const cleanBaseNote = (studioInfo.note || '').replace(/__WA_CFG__:[\s\S]*?__END_WA_CFG__/g, '').trim();
        const encodedWa = `__WA_CFG__:${JSON.stringify(updatedConfig)}__END_WA_CFG__`;
        const noteWithConfig = cleanBaseNote ? `${cleanBaseNote}\n${encodedWa}` : encodedWa;
        await supabase
          .from('studio_info')
          .update({ note: noteWithConfig })
          .eq('id', studioInfo.id);
      }
    }

    return res.status(200).json(sendResult);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Server error' });
  }
}
