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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Facoltativo: verifica token segreto CRON_SECRET
  const authHeader = req.headers.authorization;
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized: CRON_SECRET mismatch' });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Supabase credentials not configured in environment variables' });
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

    // 2. Fetch studio info
    const { data: studioData } = await supabase.from('studio_info').select('*').limit(1).single();
    const studioInfo = studioData || {};
    const config = studioInfo.whatsapp_config;

    if (!config || !config.enabled) {
      return res.status(200).json({ message: 'WhatsApp notifications are disabled in studio_info' });
    }

    // 3. Controlla se il messaggio è già stato inviato oggi (guard idempotente)
    if (config.lastAutoSentDate === todayStr) {
      return res.status(200).json({ message: `Messaggio già inviato oggi (${todayStr}), skip.` });
    }

    // 4. Verifica orario target (default 10:00 ora italiana)
    const targetTimeStr: string = config.orarioNotifica || '10:00';
    const [targetHours, targetMinutes] = targetTimeStr.split(':').map((n: string) => parseInt(n, 10));

    if (currentHourIT < targetHours || (currentHourIT === targetHours && nowInRome.getMinutes() < targetMinutes)) {
      return res.status(200).json({
        message: `Troppo presto: ora italiana ${currentHourIT}:${String(nowInRome.getMinutes()).padStart(2,'0')}, target ${targetTimeStr}. Skip.`
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
      await supabase
        .from('studio_info')
        .update({ whatsapp_config: updatedConfig })
        .eq('id', studioInfo.id);
    }

    return res.status(200).json(sendResult);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Server error' });
  }
}
