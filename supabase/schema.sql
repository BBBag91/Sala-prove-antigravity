-- =========================================================================
-- SCHEMA DATABASE SUPABASE PER GESTIONALE SALA PROVE MUSICALE
-- Esegui questo script nel "SQL Editor" della dashboard del tuo progetto Supabase
-- =========================================================================

-- 1. Tabella Informazioni Studio / Sala Prove
CREATE TABLE IF NOT EXISTS public.studio_info (
  id TEXT PRIMARY KEY DEFAULT 'main',
  nome TEXT NOT NULL DEFAULT 'Sala Prove Antigravity',
  sottotitolo TEXT DEFAULT 'Associazione Culturale Musicale • Centro Prove & Registrazione',
  indirizzo TEXT DEFAULT 'Via della Musica 42',
  citta TEXT DEFAULT 'Milano',
  cap TEXT DEFAULT '20100',
  telefono TEXT DEFAULT '+39 02 1234567',
  email TEXT DEFAULT 'info@salaprove.it',
  codice_fiscale_piva TEXT DEFAULT '98765432100',
  sito_web TEXT DEFAULT 'https://salaprove.it',
  note TEXT DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- 2. Tabella Sale Prove
CREATE TABLE IF NOT EXISTS public.rooms (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  descrizione TEXT DEFAULT '',
  colore TEXT DEFAULT '#eab308',
  tariffa_oraria NUMERIC(10, 2) NOT NULL DEFAULT 15.00,
  tariffa_lezione NUMERIC(10, 2) DEFAULT 12.00,
  capienza INTEGER DEFAULT 6,
  dotazione JSONB DEFAULT '[]'::jsonb,
  stato TEXT DEFAULT 'disponibile',
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- 3. Tabella Personale / Operatori & Insegnanti
CREATE TABLE IF NOT EXISTS public.staff (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  cognome TEXT NOT NULL,
  ruolo TEXT NOT NULL DEFAULT 'operatore', -- 'operatore' | 'insegnante' | 'entrambi'
  email TEXT DEFAULT '',
  telefono TEXT DEFAULT '',
  materie_insegnamento TEXT DEFAULT '',
  turni_lavoro_primario JSONB DEFAULT '[]'::jsonb,
  colore_badge TEXT DEFAULT '#eab308',
  attivo BOOLEAN DEFAULT true,
  tariffa_oraria_rimborso NUMERIC(10, 2) DEFAULT 10.00,
  note TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- 4. Tabella Clienti & Tesserati
CREATE TABLE IF NOT EXISTS public.clients (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  cognome TEXT NOT NULL,
  codice_fiscale TEXT DEFAULT '',
  residenza TEXT DEFAULT '',
  sesso TEXT DEFAULT 'M',
  data_nascita TEXT DEFAULT '',
  luogo_nascita TEXT DEFAULT '',
  telefono TEXT DEFAULT '',
  email TEXT DEFAULT '',
  stato_tesseramento TEXT NOT NULL DEFAULT 'attivo', -- 'attivo' | 'scaduto' | 'in_attesa'
  numero_tessera TEXT DEFAULT '',
  data_tesseramento TEXT DEFAULT '',
  data_scadenza_tesseramento TEXT DEFAULT '',
  quota_tesseramento NUMERIC(10, 2) DEFAULT 15.00,
  descrizione_strumentazione TEXT DEFAULT '',
  gruppo_band TEXT DEFAULT '',
  note TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- 5. Tabella Prenotazioni (Prove e Lezioni)
CREATE TABLE IF NOT EXISTS public.bookings (
  id TEXT PRIMARY KEY,
  cliente_id TEXT NOT NULL,
  cliente_nome TEXT NOT NULL,
  sala_id TEXT NOT NULL,
  sala_nome TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'prove', -- 'prove' | 'lezione'
  insegnante_id TEXT DEFAULT '',
  insegnante_nome TEXT DEFAULT '',
  data TEXT NOT NULL, -- YYYY-MM-DD
  ora_inizio TEXT NOT NULL, -- HH:mm
  ora_fine TEXT NOT NULL, -- HH:mm
  durata_ore NUMERIC(5, 2) NOT NULL DEFAULT 2.00,
  ripetizione_settimanale BOOLEAN DEFAULT false,
  gruppo_ricorrenza_id TEXT DEFAULT '',
  settimane_ripetizione INTEGER DEFAULT 4,
  recurrence_config JSONB DEFAULT NULL,
  operatore_assegnato_id TEXT DEFAULT '',
  operatore_assegnato_nome TEXT DEFAULT '',
  tariffa_totale NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  sconto NUMERIC(10, 2) DEFAULT 0.00,
  stato_pagamento TEXT NOT NULL DEFAULT 'da_saldare', -- 'pagato' | 'da_saldare'
  metodo_pagamento TEXT DEFAULT 'pos',
  richieste_strumentazione TEXT DEFAULT '',
  note TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- 6. Tabella Spese & Bollette (Gestione Contabile del Mese)
CREATE TABLE IF NOT EXISTS public.expenses (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL, -- YYYY-MM-DD
  categoria TEXT NOT NULL DEFAULT 'altro',
  descrizione TEXT NOT NULL,
  importo NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  metodo_pagamento TEXT DEFAULT 'bonifico',
  fornitore TEXT DEFAULT '',
  numero_fattura_ricevuta TEXT DEFAULT '',
  stato TEXT NOT NULL DEFAULT 'pagato', -- 'pagato' | 'in_scadenza'
  note TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- 7. Tabella Entrate Manuali / Extra
CREATE TABLE IF NOT EXISTS public.incomes (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL, -- YYYY-MM-DD
  categoria TEXT NOT NULL DEFAULT 'altro',
  descrizione TEXT NOT NULL,
  importo NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  cliente_id TEXT DEFAULT '',
  metodo_pagamento TEXT DEFAULT 'contanti',
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- Indici per ottimizzare le query veloci
CREATE INDEX IF NOT EXISTS idx_bookings_data ON public.bookings(data);
CREATE INDEX IF NOT EXISTS idx_bookings_sala_id ON public.bookings(sala_id);
CREATE INDEX IF NOT EXISTS idx_bookings_cliente_id ON public.bookings(cliente_id);
CREATE INDEX IF NOT EXISTS idx_bookings_operatore ON public.bookings(operatore_assegnato_id);
CREATE INDEX IF NOT EXISTS idx_expenses_data ON public.expenses(data);
CREATE INDEX IF NOT EXISTS idx_clients_cognome ON public.clients(cognome);

-- =========================================================================
-- CONFIGURAZIONE ROW LEVEL SECURITY (RLS)
-- Abilita RLS su tutte le tabelle per sicurezza e accesso client anon/auth
-- =========================================================================
ALTER TABLE public.studio_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incomes ENABLE ROW LEVEL SECURITY;

-- Policy di accesso completo per client web autorizzato (tramite anon key di Supabase)
DROP POLICY IF EXISTS "Public access studio_info" ON public.studio_info;
CREATE POLICY "Public access studio_info" ON public.studio_info FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access rooms" ON public.rooms;
CREATE POLICY "Public access rooms" ON public.rooms FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access staff" ON public.staff;
CREATE POLICY "Public access staff" ON public.staff FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access clients" ON public.clients;
CREATE POLICY "Public access clients" ON public.clients FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access bookings" ON public.bookings;
CREATE POLICY "Public access bookings" ON public.bookings FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access expenses" ON public.expenses;
CREATE POLICY "Public access expenses" ON public.expenses FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access incomes" ON public.incomes;
CREATE POLICY "Public access incomes" ON public.incomes FOR ALL USING (true) WITH CHECK (true);

-- 8. Tabella Profili Utente (collegata a Supabase Auth)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  nome TEXT DEFAULT '',
  ruolo TEXT NOT NULL DEFAULT 'user', -- 'admin' | 'user'
  avatar TEXT DEFAULT '👤',
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public access profiles" ON public.profiles;
CREATE POLICY "Public access profiles" ON public.profiles FOR ALL USING (true) WITH CHECK (true);

-- Funzione trigger per inserire automaticamente il profilo alla creazione dell'utente in auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, nome, ruolo)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'nome', split_part(new.email, '@', 1)),
    COALESCE(new.raw_user_meta_data->>'role', new.raw_user_meta_data->>'ruolo', 'user')
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    nome = COALESCE(EXCLUDED.nome, public.profiles.nome),
    ruolo = COALESCE(EXCLUDED.ruolo, public.profiles.ruolo),
    updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ==============================================================================
-- 9. AUTO-CONFERMA EMAIL PER ACCESSO DIRETTO (NON RICHIEDE VERIFICA VIA MAIL)
-- ==============================================================================

-- Conferma immediatamente tutti gli utenti esistenti in auth.users
UPDATE auth.users
SET email_confirmed_at = now()
WHERE email_confirmed_at IS NULL;

-- Trigger per auto-confermare all'istante ogni futuro utente registrato
CREATE OR REPLACE FUNCTION public.auto_confirm_user_email()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.email_confirmed_at IS NULL THEN
    NEW.email_confirmed_at := now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_auto_confirm ON auth.users;
CREATE TRIGGER on_auth_user_auto_confirm
  BEFORE INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.auto_confirm_user_email();

-- Funzione RPC richiamabile da client per confermare istantaneamente qualsiasi email
CREATE OR REPLACE FUNCTION public.confirm_user_email(user_email text)
RETURNS boolean AS $$
BEGIN
  UPDATE auth.users
  SET email_confirmed_at = now()
  WHERE lower(email) = lower(user_email);
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Abilita Supabase Realtime per sincronizzazione istantanea delle prenotazioni tra tutti gli utenti
ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings;


