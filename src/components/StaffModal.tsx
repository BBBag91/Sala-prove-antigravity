import React, { useEffect, useState } from 'react';
import { X, UserCheck, Plus, Trash2, Clock, Briefcase, CheckCircle2, Shield } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { PrimaryWorkShift, StaffMember, StaffRole } from '../types';
import { GIORNI_CALENDARIO } from '../utils/dateUtils';
import { handleNumericFocus, handleNumericClick, handleNumericBlur } from '../utils/inputUtils';

interface StaffModalProps {
  isOpen: boolean;
  onClose: () => void;
  staffToEdit?: StaffMember | null;
}

const BADGE_COLORS = [
  '#f59e0b', // Amber
  '#3b82f6', // Blue
  '#10b981', // Emerald
  '#ec4899', // Pink
  '#8b5cf6', // Purple
  '#06b6d4', // Cyan
  '#f97316', // Orange
  '#64748b', // Slate
];

export const StaffModal: React.FC<StaffModalProps> = ({ isOpen, onClose, staffToEdit }) => {
  const { addStaff, updateStaff } = useApp();

  const [nome, setNome] = useState('');
  const [cognome, setCognome] = useState('');
  const [ruolo, setRuolo] = useState<StaffRole>('entrambi');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [materieInsegnamento, setMaterieInsegnamento] = useState('');
  const [coloreBadge, setColoreBadge] = useState('#f59e0b');
  const [attivo, setAttivo] = useState(true);
  const [tariffaOrariaRimborso, setTariffaOrariaRimborso] = useState<string | number>(10);
  const [note, setNote] = useState('');

  // Turni lavoro primario
  const [turniLavoroPrimario, setTurniLavoroPrimario] = useState<PrimaryWorkShift[]>([]);

  // New shift draft
  const [draftGiorno, setDraftGiorno] = useState<number>(1); // Lunedì
  const [draftInizio, setDraftInizio] = useState('09:00');
  const [draftFine, setDraftFine] = useState('17:00');
  const [draftDesc, setDraftDesc] = useState('Lavoro primario');

  useEffect(() => {
    if (staffToEdit) {
      setNome(staffToEdit.nome);
      setCognome(staffToEdit.cognome);
      setRuolo(staffToEdit.ruolo);
      setEmail(staffToEdit.email);
      setTelefono(staffToEdit.telefono);
      setMaterieInsegnamento(staffToEdit.materieInsegnamento || '');
      setColoreBadge(staffToEdit.coloreBadge || '#f59e0b');
      setAttivo(staffToEdit.attivo);
      setTariffaOrariaRimborso(staffToEdit.tariffaOrariaRimborso || 10);
      setNote(staffToEdit.note || '');
      setTurniLavoroPrimario(staffToEdit.turniLavoroPrimario || []);
    } else {
      setNome('');
      setCognome('');
      setRuolo('entrambi');
      setEmail('');
      setTelefono('+39 ');
      setMaterieInsegnamento('Chitarra, Basso, Teoria');
      setColoreBadge(BADGE_COLORS[Math.floor(Math.random() * BADGE_COLORS.length)]);
      setAttivo(true);
      setTariffaOrariaRimborso(10);
      setNote('');
      setTurniLavoroPrimario([]);
    }
  }, [staffToEdit, isOpen]);

  if (!isOpen) return null;

  const handleAddShift = () => {
    const newShift: PrimaryWorkShift = {
      id: `shift-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      giornoSettimana: draftGiorno,
      oraInizio: draftInizio,
      oraFine: draftFine,
      descrizione: draftDesc || 'Lavoro primario',
    };
    setTurniLavoroPrimario((prev) => [...prev, newShift]);
  };

  const handleAddStandardWorkWeek = () => {
    // Adds Mon-Fri 09:00-17:00
    const shifts: PrimaryWorkShift[] = [1, 2, 3, 4, 5].map((day) => ({
      id: `shift-${Date.now()}-${day}`,
      giornoSettimana: day,
      oraInizio: '08:30',
      oraFine: '17:00',
      descrizione: 'Lavoro primario standard (Ufficio/Azienda)',
    }));
    setTurniLavoroPrimario((prev) => [...prev, ...shifts]);
  };

  const handleRemoveShift = (id: string) => {
    setTurniLavoroPrimario((prev) => prev.filter((s) => s.id !== id));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome || !cognome) return;

    if (staffToEdit) {
      updateStaff({
        ...staffToEdit,
        nome,
        cognome,
        ruolo,
        email,
        telefono,
        materieInsegnamento: ruolo !== 'operatore' ? materieInsegnamento : undefined,
        coloreBadge,
        attivo,
        tariffaOrariaRimborso: tariffaOrariaRimborso === '' ? 0 : Number(String(tariffaOrariaRimborso).replace(',', '.')),
        note,
        turniLavoroPrimario,
      });
    } else {
      addStaff({
        nome,
        cognome,
        ruolo,
        email,
        telefono,
        materieInsegnamento: ruolo !== 'operatore' ? materieInsegnamento : undefined,
        coloreBadge,
        attivo,
        tariffaOrariaRimborso: tariffaOrariaRimborso === '' ? 0 : Number(String(tariffaOrariaRimborso).replace(',', '.')),
        note,
        turniLavoroPrimario,
      });
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden my-8">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-white shadow-2xs"
              style={{ backgroundColor: coloreBadge }}
            >
              {nome ? nome[0] : <UserCheck className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                {staffToEdit ? 'Modifica Operatore / Insegnante' : 'Nuovo Operatore / Insegnante'}
              </h2>
              <p className="text-xs text-slate-500">
                Gestione anagrafica, ruolo e turni del lavoro primario
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* Ruolo (Operatore, Insegnante, Entrambi) */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Ruolo nella Struttura *
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => setRuolo('operatore')}
                className={`py-2 px-3 rounded-lg border text-xs font-semibold transition-all text-center ${
                  ruolo === 'operatore'
                    ? 'bg-indigo-50 border-indigo-500 text-indigo-900 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                Solo Operatore Sala
              </button>
              <button
                type="button"
                onClick={() => setRuolo('insegnante')}
                className={`py-2 px-3 rounded-lg border text-xs font-semibold transition-all text-center ${
                  ruolo === 'insegnante'
                    ? 'bg-indigo-50 border-indigo-500 text-indigo-900 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                Solo Insegnante / Docente
              </button>
              <button
                type="button"
                onClick={() => setRuolo('entrambi')}
                className={`py-2 px-3 rounded-lg border text-xs font-semibold transition-all text-center ${
                  ruolo === 'entrambi'
                    ? 'bg-indigo-50 border-indigo-500 text-indigo-900 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                Operatore & Insegnante
              </button>
            </div>
            <p className="text-[11px] text-slate-500 mt-1.5">
              * Gli operatori vengono assegnati ai turni di presidio sala quando liberi dal loro lavoro primario.
            </p>
          </div>

          {/* Nome, Cognome, Contatti */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Nome *</label>
              <input
                type="text"
                required
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Es. Marco"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-slate-800 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Cognome *</label>
              <input
                type="text"
                required
                value={cognome}
                onChange={(e) => setCognome(e.target.value)}
                placeholder="Es. Bellini"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-slate-800 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="marco.bellini@email.it"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-slate-800 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Telefono</label>
              <input
                type="tel"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                placeholder="+39 347 1234567"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-slate-800 text-sm"
              />
            </div>
          </div>

          {/* Materie insegnate se docente */}
          {ruolo !== 'operatore' && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Materie / Corsi Insegnati
              </label>
              <input
                type="text"
                value={materieInsegnamento}
                onChange={(e) => setMaterieInsegnamento(e.target.value)}
                placeholder="Es. Chitarra moderna, Canto lirico, Batteria, Basso, Tastiere..."
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-slate-800 text-sm"
              />
            </div>
          )}

          {/* Colore identificativo & Rimborso */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Colore Badge / Calendario
              </label>
              <div className="flex items-center gap-2">
                {BADGE_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColoreBadge(c)}
                    className={`w-7 h-7 rounded-full transition-transform ${
                      coloreBadge === c ? 'scale-125 ring-2 ring-offset-2 ring-slate-800' : 'hover:scale-110'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Rimborso Orario Sala (€/h)
              </label>
              <div className="relative">
                <input
                  type="text"
                  inputMode="decimal"
                  value={tariffaOrariaRimborso}
                  onFocus={handleNumericFocus}
                  onClick={handleNumericClick}
                  onBlur={handleNumericBlur}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '' || /^\d*([.,]\d*)?$/.test(val)) {
                      setTariffaOrariaRimborso(val);
                    }
                  }}
                  placeholder="0"
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-bold text-slate-800"
                />
                <span className="absolute right-3 top-1.5 text-xs text-slate-400">€/h</span>
              </div>
            </div>
          </div>

          {/* TURNI LAVORO PRIMARIO (Core Feature) */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-indigo-600" />
                <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
                  Turni Lavoro Primario
                </h3>
              </div>
              <button
                type="button"
                onClick={handleAddStandardWorkWeek}
                className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2.5 py-1 rounded-md transition-colors"
              >
                + Imposta rapido Lun-Ven 08:30-17:00
              </button>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Inserisci gli orari in cui l'operatore è impegnato nel suo lavoro principale.
              La disponibilità per la sala prove sarà calcolata automaticamente: <strong className="text-slate-800">24 ore del giorno MENO i turni del lavoro primario</strong>.
            </p>

            {/* List of existing primary shifts */}
            {turniLavoroPrimario.length === 0 ? (
              <div className="py-3 px-4 bg-white rounded-lg border border-dashed border-slate-300 text-center text-xs text-slate-600">
                Nessun turno di lavoro primario impostato (l'operatore risulta disponibile 24h su 24).
              </div>
            ) : (
              <div className="space-y-2">
                {turniLavoroPrimario.map((shift) => {
                  const dayObj = GIORNI_CALENDARIO.find((g) => g.index === shift.giornoSettimana);
                  return (
                    <div
                      key={shift.id}
                      className="flex items-center justify-between p-2.5 bg-white rounded-lg border border-slate-200 shadow-2xs text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-16 font-semibold text-slate-900 bg-slate-100 px-2 py-0.5 rounded text-center">
                          {dayObj?.label || 'Giorno'}
                        </span>
                        <span className="font-mono font-medium text-slate-800 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          {shift.oraInizio} - {shift.oraFine}
                        </span>
                        {shift.descrizione && (
                          <span className="text-slate-500 text-[11px] italic">({shift.descrizione})</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-emerald-700 font-medium">
                          Libero per sala prima di {shift.oraInizio} e dopo le {shift.oraFine}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveShift(shift.id)}
                          className="text-rose-500 hover:text-rose-700 p-1 rounded hover:bg-rose-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Add new shift inline form */}
            <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-2.5">
              <span className="text-[11px] font-semibold text-slate-700 uppercase">
                Aggiungi fascia turno lavoro primario:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500">Giorno</label>
                  <select
                    value={draftGiorno}
                    onChange={(e) => setDraftGiorno(Number(e.target.value))}
                    className="w-full px-2 py-1.5 rounded-lg border border-slate-300 text-xs"
                  >
                    {GIORNI_CALENDARIO.map((g) => (
                      <option key={g.index} value={g.index}>
                        {g.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500">Inizio Lavoro</label>
                  <input
                    type="time"
                    value={draftInizio}
                    onChange={(e) => setDraftInizio(e.target.value)}
                    className="w-full px-2 py-1 rounded-lg border border-slate-300 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500">Fine Lavoro</label>
                  <input
                    type="time"
                    value={draftFine}
                    onChange={(e) => setDraftFine(e.target.value)}
                    className="w-full px-2 py-1 rounded-lg border border-slate-300 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500">Descrizione</label>
                  <input
                    type="text"
                    value={draftDesc}
                    onChange={(e) => setDraftDesc(e.target.value)}
                    placeholder="Ufficio / Studio"
                    className="w-full px-2 py-1 rounded-lg border border-slate-300 text-xs"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={handleAddShift}
                className="w-full py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> Inserisci Turno Primario
              </button>
            </div>
          </div>

          {/* Note */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Note / Competenze Tecniche</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Esperto fonico di palco, chitarrista, cablaggi audio..."
              className="w-full px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
            />
          </div>

          {/* Attivo toggle */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="attivo"
              checked={attivo}
              onChange={(e) => setAttivo(e.target.checked)}
              className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
            />
            <label htmlFor="attivo" className="text-xs font-semibold text-slate-700">
              Operatore attivo (disponibile per assegnazione turni)
            </label>
          </div>

          {/* Footer actions */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 text-sm font-semibold transition-colors"
            >
              Annulla
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm shadow-xs transition-colors flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              {staffToEdit ? 'Salva Modifiche' : 'Registra Operatore'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
