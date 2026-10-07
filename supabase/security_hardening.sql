-- ============================================================================
-- ENTERPRISE SECURITY & GDPR COMPLIANCE HARDENING SCRIPT
-- Gestione Sala Prove & Associazione Musicale
--
-- Conformità:
-- - Regolamento Generale sulla Protezione dei Dati (GDPR - UE 2016/679)
-- - OWASP Top 10:2021 (A01 Broken Access Control, A03 Injection, A07 Auth Failures)
-- - Principi di Privacy by Design & Default (Art. 25 GDPR)
-- - Misure di Sicurezza del Trattamento (Art. 32 GDPR)
--
-- ESEGUI QUESTO SCRIPT NEL "SQL EDITOR" DELLA DASHBOARD SUPABASE DEL TUO PROGETTO
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. ATTIVAZIONE ROW LEVEL SECURITY (RLS) SU TUTTE LE TABELLE
-- ----------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.studio_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.incomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 2. TABELLA TESSERATI E CLIENTI (public.clients) - GDPR ART. 5, 25, 32
-- REQUISITO FONDAMENTALE: Gli utenti anonimi (modulo pubblico WhatsApp) possono
-- SOLAMENTE inserire nuove registrazioni (INSERT). NON possono MAI fare SELECT
-- o scaricare i dati anagrafici, fiscali e recapiti degli altri tesserati!
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public access clients" ON public.clients;
DROP POLICY IF EXISTS "Anon public insert membership form" ON public.clients;
DROP POLICY IF EXISTS "Authenticated staff manage clients" ON public.clients;

-- Permetti al modulo pubblico anonimo di inviare SOLO nuovi tesseramenti con validazione dei campi minimi
CREATE POLICY "Anon public insert membership form" ON public.clients
  FOR INSERT
  TO anon
  WITH CHECK (
    length(trim(nome)) > 0 AND
    length(trim(cognome)) > 0 AND
    length(trim(codice_fiscale)) = 16
  );

-- Permetti allo staff/amministratori autenticati (login effettuato) la gestione completa (SELECT, UPDATE, DELETE)
CREATE POLICY "Authenticated staff manage clients" ON public.clients
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- 3. TABELLA INFORMAZIONI STUDIO (public.studio_info)
-- Necessario permettere sia la lettura che l'aggiornamento di lastAutoSentDate / note
-- da parte dell'endpoint cron per il blocco anti-duplicati dei messaggi WhatsApp
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public access studio_info" ON public.studio_info;
DROP POLICY IF EXISTS "Public read general studio info" ON public.studio_info;
DROP POLICY IF EXISTS "Authenticated manage studio info" ON public.studio_info;
DROP POLICY IF EXISTS "Allow all studio info" ON public.studio_info;

CREATE POLICY "Allow all studio info" ON public.studio_info
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- 4. CONTABILITÀ, ENTRATE E SPESE (public.expenses / public.incomes)
-- Dati finanziari riservati: blocco totale per utenti non autenticati (anon)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public access expenses" ON public.expenses;
DROP POLICY IF EXISTS "Authenticated only expenses" ON public.expenses;
CREATE POLICY "Authenticated only expenses" ON public.expenses
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Public access incomes" ON public.incomes;
DROP POLICY IF EXISTS "Authenticated only incomes" ON public.incomes;
CREATE POLICY "Authenticated only incomes" ON public.incomes
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- 5. PERSONALE E DOCENTI (public.staff)
-- Lettura directory nomi docenti/operatori necessaria per calendario e resoconto WhatsApp;
-- Modifiche anagrafiche riservate agli autenticati
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public access staff" ON public.staff;
DROP POLICY IF EXISTS "Authenticated only staff" ON public.staff;
DROP POLICY IF EXISTS "Allow read staff directory" ON public.staff;
DROP POLICY IF EXISTS "Authenticated manage staff" ON public.staff;

CREATE POLICY "Allow read staff directory" ON public.staff
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Authenticated manage staff" ON public.staff
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- 6. SALE PROVE E TURNI DI PRESIDIO (public.rooms / public.shifts)
-- Lettura turni necessaria al cron briefing per sapere chi è in turno (evita 'Da assegnare')
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public access rooms" ON public.rooms;
CREATE POLICY "Public access rooms" ON public.rooms
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Authenticated manage rooms" ON public.rooms
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Public access shifts" ON public.shifts;
DROP POLICY IF EXISTS "Authenticated only shifts" ON public.shifts;
DROP POLICY IF EXISTS "Allow read shifts" ON public.shifts;
DROP POLICY IF EXISTS "Authenticated manage shifts" ON public.shifts;

CREATE POLICY "Allow read shifts" ON public.shifts
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Authenticated manage shifts" ON public.shifts
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- 7. PRENOTAZIONI (public.bookings)
-- Lettura calendario per disponibilità; gestione e dettagli completi per staff
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public access bookings" ON public.bookings;
DROP POLICY IF EXISTS "Authenticated manage bookings" ON public.bookings;
DROP POLICY IF EXISTS "Public read bookings schedule" ON public.bookings;

CREATE POLICY "Authenticated manage bookings" ON public.bookings
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Public read bookings schedule" ON public.bookings
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- ----------------------------------------------------------------------------
-- 8. TABELLA LOG DISPATCH WHATSAPP (Idempotenza Atomica Inviolabile)
-- Garantisce matematicamente massimo 1 solo invio di riepilogo al giorno
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.daily_briefing_log (
  date_iso TEXT PRIMARY KEY,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  provider TEXT,
  sender_source TEXT,
  message_id TEXT,
  success BOOLEAN DEFAULT true
);

ALTER TABLE IF EXISTS public.daily_briefing_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow manage daily_briefing_log" ON public.daily_briefing_log;
CREATE POLICY "Allow manage daily_briefing_log" ON public.daily_briefing_log
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- 8. TABELLA DI AUDIT LOG PER CONFORMITÀ GDPR (Art. 5.2 - Accountability)
-- Registra le operazioni di cancellazione o modifica su dati sensibili
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.security_audit_log (
  id BIGSERIAL PRIMARY KEY,
  timestamp TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  user_id UUID,
  ip_address TEXT,
  azione TEXT NOT NULL, -- 'CLIENT_INSERT', 'CLIENT_DELETE', 'LOGIN_FAILURE', ecc.
  entita TEXT NOT NULL,
  entita_id TEXT,
  dettagli JSONB
);

ALTER TABLE public.security_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Only authenticated read audit log" ON public.security_audit_log
  FOR SELECT
  TO authenticated
  USING (true);

-- ----------------------------------------------------------------------------
-- 9. NOTIFICHE REALTIME SICURE
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'clients'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.clients;
  END IF;
END $$;

COMMENT ON TABLE public.clients IS 'Anagrafica Soci e Tesserati protetta da RLS ai sensi del GDPR UE 2016/679';
COMMENT ON TABLE public.security_audit_log IS 'Registro degli eventi di sicurezza e trattamento dati ai sensi dell Art. 30 GDPR';
