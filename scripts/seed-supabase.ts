import { createClient } from '@supabase/supabase-js';
import {
  DEFAULT_STUDIO_INFO,
  INITIAL_ROOMS,
  INITIAL_STAFF,
  INITIAL_CLIENTS,
  INITIAL_BOOKINGS,
  INITIAL_EXPENSES,
} from '../src/data/initialData';
import {
  mapStudioInfoToDb,
  mapRoomToDb,
  mapStaffToDb,
  mapClientToDb,
  mapBookingToDb,
  mapExpenseToDb,
} from '../src/services/supabaseService';

const url = 'https://qapmpppmejfcekqdzrgz.supabase.co';
const key = 'sb_publishable_vbdUnCY1YehkXPcdNsLsOw_YHaHCz1K';
const client = createClient(url, key);

async function seed() {
  console.log('--- Inizio Sincronizzazione Dati Iniziali su Supabase ---');

  // 1. Studio Info
  console.log('Caricamento studio_info...');
  const { error: errStudio } = await client.from('studio_info').upsert(mapStudioInfoToDb(DEFAULT_STUDIO_INFO));
  if (errStudio) console.error('Errore studio_info:', errStudio);
  else console.log('✓ studio_info caricato!');

  // 2. Sale Prove
  console.log('Caricamento sale prove...');
  const { error: errRooms } = await client.from('rooms').upsert(INITIAL_ROOMS.map(mapRoomToDb));
  if (errRooms) console.error('Errore rooms:', errRooms);
  else console.log(`✓ ${INITIAL_ROOMS.length} sale caricate!`);

  // 3. Staff
  console.log('Caricamento operatori / staff...');
  const { error: errStaff } = await client.from('staff').upsert(INITIAL_STAFF.map(mapStaffToDb));
  if (errStaff) console.error('Errore staff:', errStaff);
  else console.log(`✓ ${INITIAL_STAFF.length} membri staff caricati!`);

  // 4. Clienti
  console.log('Caricamento clienti...');
  const { error: errClients } = await client.from('clients').upsert(INITIAL_CLIENTS.map(mapClientToDb));
  if (errClients) console.error('Errore clients:', errClients);
  else console.log(`✓ ${INITIAL_CLIENTS.length} clienti caricati!`);

  // 5. Prenotazioni
  console.log('Caricamento prenotazioni...');
  const { error: errBookings } = await client.from('bookings').upsert(INITIAL_BOOKINGS.map(mapBookingToDb));
  if (errBookings) console.error('Errore bookings:', errBookings);
  else console.log(`✓ ${INITIAL_BOOKINGS.length} prenotazioni caricate!`);

  // 6. Spese
  console.log('Caricamento spese...');
  const { error: errExpenses } = await client.from('expenses').upsert(INITIAL_EXPENSES.map(mapExpenseToDb));
  if (errExpenses) console.error('Errore expenses:', errExpenses);
  else console.log(`✓ ${INITIAL_EXPENSES.length} spese caricate!`);

  console.log('--- Sincronizzazione Completata con Successo! ---');
}

seed().catch(console.error);
