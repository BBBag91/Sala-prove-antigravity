import React, { useEffect, useState } from 'react';
import { X, DoorOpen, Plus, Trash2, CheckCircle2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Room } from '../types';

import { handleNumericFocus, handleNumericClick, handleNumericBlur } from '../utils/inputUtils';

interface RoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomToEdit?: Room | null;
}

const ROOM_COLORS = [
  '#ef4444', // Red
  '#3b82f6', // Blue
  '#10b981', // Emerald
  '#8b5cf6', // Purple
  '#f59e0b', // Amber
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#14b8a6', // Teal
];

export const RoomModal: React.FC<RoomModalProps> = ({ isOpen, onClose, roomToEdit }) => {
  const { addRoom, updateRoom } = useApp();

  const [nome, setNome] = useState('');
  const [descrizione, setDescrizione] = useState('');
  const [colore, setColore] = useState('#ef4444');
  const [tariffaOraria, setTariffaOraria] = useState<string | number>(18);
  const [tariffaLezione, setTariffaLezione] = useState<string | number>(25);
  const [capienza, setCapienza] = useState<string | number>(7);
  const [dotazione, setDotazione] = useState<string[]>([]);
  const [newGearItem, setNewGearItem] = useState('');
  const [stato, setStato] = useState<'disponibile' | 'manutenzione'>('disponibile');

  useEffect(() => {
    if (roomToEdit) {
      setNome(roomToEdit.nome);
      setDescrizione(roomToEdit.descrizione);
      setColore(roomToEdit.colore || '#ef4444');
      setTariffaOraria(roomToEdit.tariffaOraria);
      setTariffaLezione(roomToEdit.tariffaLezione || 25);
      setCapienza(roomToEdit.capienza);
      setDotazione(roomToEdit.dotazione || []);
      setStato(roomToEdit.stato);
    } else {
      setNome('');
      setDescrizione('');
      setColore(ROOM_COLORS[Math.floor(Math.random() * ROOM_COLORS.length)]);
      setTariffaOraria(18);
      setTariffaLezione(25);
      setCapienza(6);
      setDotazione([
        'Batteria acustica completa con piatti',
        '2 Amplificatori chitarra valvolari',
        'Testata e cassa basso',
        'Mixer 12 canali con impianto PA',
        '3 Microfoni con aste e cavi XLR',
        'Aria condizionata',
      ]);
      setStato('disponibile');
    }
  }, [roomToEdit, isOpen]);

  if (!isOpen) return null;

  const handleAddGear = () => {
    if (!newGearItem.trim()) return;
    setDotazione((prev) => [...prev, newGearItem.trim()]);
    setNewGearItem('');
  };

  const handleRemoveGear = (idx: number) => {
    setDotazione((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) return;

    if (roomToEdit) {
      updateRoom({
        ...roomToEdit,
        nome: nome.trim(),
        descrizione,
        colore,
        tariffaOraria: tariffaOraria === '' ? 0 : Number(tariffaOraria),
        tariffaLezione: tariffaLezione === '' ? 0 : Number(tariffaLezione),
        capienza: capienza === '' ? 1 : Number(capienza),
        dotazione,
        stato,
      });
    } else {
      addRoom({
        nome: nome.trim(),
        descrizione,
        colore,
        tariffaOraria: tariffaOraria === '' ? 0 : Number(tariffaOraria),
        tariffaLezione: tariffaLezione === '' ? 0 : Number(tariffaLezione),
        capienza: capienza === '' ? 1 : Number(capienza),
        dotazione,
        stato,
      });
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-xl bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden my-8">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-white shadow-2xs"
              style={{ backgroundColor: colore }}
            >
              <DoorOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                {roomToEdit ? 'Modifica Sala Prove' : 'Registrazione Nuova Sala Prove'}
              </h2>
              <p className="text-xs text-slate-500">
                Nome sala, tariffe orarie, capienza e strumentazione in dotazione
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
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Nome Sala */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-slate-800">
                Nome della Sala Prove <span className="text-rose-500">*</span>
              </label>
              <span className="text-[11px] text-slate-400">Libero e personalizzabile</span>
            </div>
            <input
              type="text"
              required
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Es. Sala 1, Sala Rossa, Box A, Studio Live, Hendrix..."
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-900 text-sm font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
            />
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              <span className="text-[10px] text-slate-400 font-medium">Suggerimenti rapidi:</span>
              {['Sala 1', 'Sala 2', 'Sala Rossa', 'Sala Blu', 'Box A', 'Studio Live'].map((sugg) => (
                <button
                  key={sugg}
                  type="button"
                  onClick={() => setNome(sugg)}
                  className="text-[10px] px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors font-medium"
                >
                  {sugg}
                </button>
              ))}
            </div>
          </div>

          {/* Descrizione */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Descrizione Sala</label>
            <textarea
              rows={2}
              value={descrizione}
              onChange={(e) => setDescrizione(e.target.value)}
              placeholder="Trattamento acustico, tipologia di genere consigliato, spaziosità..."
              className="w-full px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
            />
          </div>

          {/* Colore identificativo */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Colore Badge nel Calendario
            </label>
            <div className="flex items-center gap-2">
              {ROOM_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColore(c)}
                  className={`w-7 h-7 rounded-full transition-transform ${
                    colore === c ? 'scale-125 ring-2 ring-offset-2 ring-slate-800' : 'hover:scale-110'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {/* Tariffe & Capienza */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Tariffa Prove (€/h) *
              </label>
              <div className="relative">
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  required
                  value={tariffaOraria}
                  onFocus={handleNumericFocus}
                  onClick={handleNumericClick}
                  onBlur={handleNumericBlur}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '' || /^\d*$/.test(val)) {
                      setTariffaOraria(val);
                    }
                  }}
                  placeholder=""
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-bold text-sm text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
                <span className="absolute right-3 top-2 text-xs text-slate-400">€/h</span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Tariffa Lezioni (€/h)
              </label>
              <div className="relative">
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={tariffaLezione}
                  onFocus={handleNumericFocus}
                  onClick={handleNumericClick}
                  onBlur={handleNumericBlur}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '' || /^\d*$/.test(val)) {
                      setTariffaLezione(val);
                    }
                  }}
                  placeholder=""
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-bold text-sm text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
                <span className="absolute right-3 top-2 text-xs text-slate-400">€/h</span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Capienza Max (persone)
              </label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={capienza}
                onFocus={handleNumericFocus}
                onClick={handleNumericClick}
                onBlur={handleNumericBlur}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '' || /^\d*$/.test(val)) {
                    setCapienza(val);
                  }
                }}
                placeholder=""
                className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-bold text-sm text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Dotazione & Strumentazione presente nella sala */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-600">
              Dotazione & Backline Presente nella Sala
            </label>
            <div className="space-y-1.5 max-h-40 overflow-y-auto p-2 bg-slate-50 border border-slate-200 rounded-lg">
              {dotazione.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between px-3 py-1.5 bg-white rounded-lg border border-slate-200 text-xs text-slate-800"
                >
                  <span>{item}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveGear(idx)}
                    className="text-rose-500 hover:text-rose-700 p-1 rounded hover:bg-rose-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newGearItem}
                onChange={(e) => setNewGearItem(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddGear();
                  }
                }}
                placeholder="Aggiungi amplificatore, mixer, microfono, pianoforte..."
                className="flex-1 px-3.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              />
              <button
                type="button"
                onClick={handleAddGear}
                className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 transition-colors flex items-center gap-1 shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5" /> Aggiungi
              </button>
            </div>
          </div>

          {/* Stato sala */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Stato della Sala</label>
            <select
              value={stato}
              onChange={(e) => setStato(e.target.value as 'disponibile' | 'manutenzione')}
              className="w-full px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
            >
              <option value="disponibile">🟢 Disponibile per prenotazioni</option>
              <option value="manutenzione">🔴 In Manutenzione / Non prenotabile</option>
            </select>
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
              {roomToEdit ? 'Salva Sala' : 'Crea Sala Prove'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
