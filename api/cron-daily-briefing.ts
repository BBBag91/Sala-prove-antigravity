import { createClient } from '@supabase/supabase-js';
import {
  formatMorningBriefingMessage,
  sendWhatsAppViaApi,
} from '../src/services/whatsappService';
import { computeDailyShifts } from '../src/utils/shiftUtils';
import { isItalianHoliday } from '../src/utils/dateUtils';
import {
  mapBookingFromDb,
  mapRoomFromDb,
  mapStaffFromDb,
  mapShiftFromDb,
} from '../src/services/supabaseService';
import { Booking, Room, StaffMember, WorkShift } from '../src/types';

interface VercelRequest {
  headers: Record<string, string | string[] | undefined>;
  query?: Record<string, string | string[]>;
  body?: any;
}

interface VercelResponse {
  status: (code: number) => VercelResponse;
  json: (data: any) => void;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 1. Facoltativo: verifica token segreto CRON_SECRET se configurato
  const authHeader = req.headers.authorization;
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized: CRON_SECRET mismatch' });
  }

  const supabaseUrl =
    process.env.VITE_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    'https://qapmpppmejfcekqdzrgz.supabase.co';
  const supabaseKey =
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    'sb_publishable_vbdUnCY1YehkXPcdNsLsOw_YHaHCz1K';

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Supabase credentials not configured' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // 2. Data e ora corrente calcolate rigorosamente sul fuso orario Europe/Rome
    const nowInRome = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Rome' }));
    const year = nowInRome.getFullYear();
    const month = String(nowInRome.getMonth() + 1).padStart(2, '0');
    const day = String(nowInRome.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;
    const currentHourIT = nowInRome.getHours();
    const currentMinuteIT = nowInRome.getMinutes();
    const dayOfWeek = nowInRome.getDay(); // 0 = Domenica, 1 = Lunedì ... 6 = Sabato

    const isForce = req.query?.force === 'true' || req.query?.force === '1';

    // 3. Controllo festività e domeniche:
    // Nessun invio la domenica e nei giorni festivi
    if (!isForce && dayOfWeek === 0) {
      return res.status(200).json({
        message: `Domenica (${todayStr}): nessun invio messaggio di resoconto programmato. Skip.`,
      });
    }

    if (!isForce && isItalianHoliday(nowInRome)) {
      return res.status(200).json({
        message: `Giorno festivo nazionale (${todayStr}): nessun invio messaggio di resoconto programmato. Skip.`,
      });
    }

    // 4. Fetch studio_info per verificare configurazione WhatsApp
    const { data: studioData, error: studioErr } = await supabase
      .from('studio_info')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (studioErr) {
      console.warn('[cron] Errore lettura studio_info:', studioErr);
    }

    const studioInfo = studioData || {};

    // Recupero configurazione WhatsApp: colonna dedicata oppure blocco __WA_CFG__: dentro note
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

    if (!config || !config.enabled || config.autoSendMorning === false) {
      return res.status(200).json({
        message: 'Notifiche automatiche mattutine WhatsApp disabilitate nelle impostazioni dello studio. Skip.',
      });
    }

    // 5. GUARD IDEMPOTENZA PRINCIPALE:
    // Se il messaggio è già stato inviato per la data di oggi, FERMATI IMMEDIATAMENTE (a meno di ?force=true)
    if (!isForce && config.lastAutoSentDate === todayStr) {
      return res.status(200).json({
        message: `Messaggio già inviato oggi (${todayStr}), invio singolo garantito. Skip.`,
        lastAutoSentDate: config.lastAutoSentDate,
      });
    }

    // 6. Verifica orario target:
    // Invio alle ore 10:00 (o da config.orarioNotifica se specificato)
    const targetTimeStr: string = config.orarioNotifica || '10:00';
    const [targetHours, targetMinutes] = targetTimeStr.split(':').map((n: string) => parseInt(n, 10));

    if (!isForce) {
      const isTooEarly =
        currentHourIT < targetHours ||
        (currentHourIT === targetHours && currentMinuteIT < targetMinutes);

      if (isTooEarly) {
        return res.status(200).json({
          message: `Troppo presto: ora italiana ${currentHourIT}:${String(currentMinuteIT).padStart(2, '0')}, target ${targetTimeStr}. Skip.`,
        });
      }
    }

    // 7. Fetch completo dei dati aggiornati da Supabase per comporre il messaggio perfetto
    const [bookingsRes, staffRes, roomsRes, shiftsRes] = await Promise.all([
      supabase
        .from('bookings')
        .select('*')
        .eq('data', todayStr)
        .order('ora_inizio', { ascending: true }),
      supabase.from('staff').select('*').order('cognome', { ascending: true }),
      supabase.from('rooms').select('*').order('nome', { ascending: true }),
      supabase.from('shifts').select('*').eq('data', todayStr),
    ]);

    const bookings: Booking[] = (bookingsRes.data || []).map(mapBookingFromDb);
    const staff: StaffMember[] = (staffRes.data || []).map(mapStaffFromDb);
    const rooms: Room[] = (roomsRes.data || []).map(mapRoomFromDb);

    // Turni: se la tabella shifts non esiste o è vuota, controlla il blocco __SHIFTS__: in studioInfo.note
    let shifts: WorkShift[] = (shiftsRes.data || []).map(mapShiftFromDb);
    if (shifts.length === 0 && studioInfo.note && studioInfo.note.includes('__SHIFTS__:')) {
      try {
        const match = studioInfo.note.match(/__SHIFTS__:([\s\S]*?)__END_SHIFTS__/);
        if (match && match[1]) {
          const parsed = JSON.parse(match[1]);
          if (Array.isArray(parsed)) {
            shifts = parsed.filter((s: any) => s.data === todayStr);
          }
        }
      } catch (e) {
        console.warn('[cron] Errore parsing fallback shifts da note:', e);
      }
    }

    // 8. Calcolo turni di presidio giornalieri con la logica esatta dell'applicazione
    const dailyShifts = computeDailyShifts(todayStr, bookings, shifts, staff);

    // 9. Formattazione identica a quella certificata corretta dell'app (con raggruppamento docenti e riepilogo)
    const studioInfoClean = {
      nome: studioInfo.nome || 'La Musica Fa..',
      sottotitolo: studioInfo.sottotitolo || '',
      indirizzo: studioInfo.indirizzo || '',
      telefono: studioInfo.telefono || '',
      email: studioInfo.email || '',
      citta: studioInfo.citta || '',
      cap: studioInfo.cap || '',
      codiceFiscalePiva: studioInfo.codice_fiscale_piva || '',
      sitoWeb: studioInfo.sito_web || '',
      note: studioInfo.note || '',
      whatsappConfig: config,
    };

    const message = formatMorningBriefingMessage({
      dateStr: todayStr,
      studioInfo: studioInfoClean,
      dailyShifts,
      bookings,
      rooms,
      staff,
      config,
    });

    // 10. Invio effettivo tramite Gateway configurato (Green API, UltraMsg, Whapi, Webhook)
    const sendResult = await sendWhatsAppViaApi(config, message);

    if (!sendResult.success) {
      return res.status(500).json({
        error: `Invio WhatsApp fallito: ${sendResult.error}`,
      });
    }

    // 11. PERSISTENZA IMMEDIATA DI lastAutoSentDate:
    // Aggiorna lo stato su Supabase per impedire qualsiasi invio duplicato successivo
    const updatedConfig = { ...config, lastAutoSentDate: todayStr };

    // Tenta prima l'aggiornamento della colonna dedicata
    const { error: updateErr } = await supabase
      .from('studio_info')
      .update({ whatsapp_config: updatedConfig })
      .eq('id', studioInfo.id || 'main');

    // Se la colonna non esiste (PGRST204), aggiorna nel blocco note come fallback
    if (updateErr && (updateErr.code === 'PGRST204' || updateErr.message?.includes('whatsapp_config'))) {
      const cleanBaseNote = (studioInfo.note || '').replace(/__WA_CFG__:[\s\S]*?__END_WA_CFG__/g, '').trim();
      const encodedWa = `__WA_CFG__:${JSON.stringify(updatedConfig)}__END_WA_CFG__`;
      const noteWithConfig = cleanBaseNote ? `${cleanBaseNote}\n${encodedWa}` : encodedWa;
      await supabase
        .from('studio_info')
        .update({ note: noteWithConfig })
        .eq('id', studioInfo.id || 'main');
    }

    return res.status(200).json({
      success: true,
      message: `Resoconto del mattino (${targetTimeStr}) inviato con successo al gruppo WhatsApp per il ${todayStr}!`,
      date: todayStr,
      provider: config.provider,
    });
  } catch (err: any) {
    console.error('[cron-daily-briefing] Errore generale:', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
}
