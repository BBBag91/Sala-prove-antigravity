interface VercelRequest {
  headers: Record<string, string | string[] | undefined>;
  query?: Record<string, string | string[]>;
  body?: any;
  method?: string;
}

interface VercelResponse {
  status: (code: number) => VercelResponse;
  json: (data: any) => void;
  setHeader: (name: string, value: string) => void;
  end: () => void;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const payload = req.method === 'POST' ? req.body || {} : req.query || {};
  const provider = payload.provider || 'greenapi';
  const rawId = payload.instanceId || '';
  const rawToken = payload.token || '';

  const cleanId = String(rawId).replace(/^waInstance/i, '').trim();
  const cleanToken = String(rawToken).trim();

  if (!cleanId || !cleanToken) {
    return res.status(400).json({
      success: false,
      error: 'Inserisci le credenziali (Instance ID e Token) prima di cercare i gruppi.',
    });
  }

  try {
    if (provider === 'greenapi') {
      // 1. Controlla prima lo stato dell'istanza Green API
      try {
        const stateUrl = `https://api.green-api.com/waInstance${cleanId}/getStateInstance/${cleanToken}`;
        const stateRes = await fetch(stateUrl);
        const stateText = await stateRes.text();
        const stateData = stateText ? JSON.parse(stateText) : {};

        if (stateData.stateInstance === 'notAuthorized') {
          return res.status(200).json({
            success: false,
            notAuthorized: true,
            error: 'Il tuo WhatsApp non è ancora collegato su Green API. Apri WhatsApp sul telefono > Dispositivi collegati > inquadra il QR Code su green-api.com!',
          });
        }
      } catch {
        // Se il controllo stato non risponde, procedi con getChats
      }

      // 2. Recupera le chat e gruppi da Green API tramite getChats
      const url = `https://api.green-api.com/waInstance${cleanId}/getChats/${cleanToken}`;
      const response = await fetch(url, { method: 'GET' });
      const text = await response.text();

      let list: any[] = [];
      try {
        list = text ? JSON.parse(text) : [];
      } catch {
        return res.status(200).json({
          success: false,
          error: `Risposta non valida da Green API (${response.status}): ${text.substring(0, 120)}`,
        });
      }

      if (!response.ok || !Array.isArray(list)) {
        return res.status(200).json({
          success: false,
          error: (list as any)?.message || `Errore Green API (${response.status}). Verifica idInstance e apiTokenInstance.`,
        });
      }

      // Filtra solo i gruppi (@g.us o isGroup: true)
      const groups = list
        .filter(
          (c: any) =>
            c.isGroup === true ||
            (typeof c.id === 'string' && c.id.endsWith('@g.us')) ||
            c.type === 'group'
        )
        .map((c: any) => ({
          id: c.id,
          name: c.name || c.contactName || c.nameGroup || c.id,
        }));

      return res.status(200).json({ success: true, groups });
    }

    if (provider === 'ultramsg') {
      const url = `https://api.ultramsg.com/${cleanId}/groups?token=${cleanToken}`;
      const response = await fetch(url);
      const text = await response.text();

      let list: any[] = [];
      try {
        list = text ? JSON.parse(text) : [];
      } catch {
        return res.status(200).json({
          success: false,
          error: `Risposta non valida da UltraMsg (${response.status}): ${text.substring(0, 120)}`,
        });
      }

      if (!response.ok || !Array.isArray(list)) {
        return res.status(200).json({
          success: false,
          error: (list as any)?.error || `Errore UltraMsg (${response.status}).`,
        });
      }

      const groups = list.map((g: any) => ({
        id: g.id || g.chatId,
        name: g.name || g.subject || g.id,
      }));

      return res.status(200).json({ success: true, groups });
    }

    return res.status(400).json({ success: false, error: 'Provider non supportato.' });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err.message || 'Errore di connessione con il servizio WhatsApp.',
    });
  }
}
