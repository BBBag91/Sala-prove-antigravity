import React, { useState } from 'react';
import { Plus, DoorOpen, Users, Clock, Check, Edit2, Trash2, Wrench, Edit3, Building2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Room } from '../types';
import { RoomModal } from './RoomModal';
import { StudioSettingsModal } from './StudioSettingsModal';

interface RoomsViewProps {
  onNavigateToAnagrafica?: () => void;
}

export const RoomsView: React.FC<RoomsViewProps> = ({ onNavigateToAnagrafica }) => {
  const { rooms, bookings, deleteRoom, studioInfo } = useApp();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [roomToEdit, setRoomToEdit] = useState<Room | null>(null);
  const [isStudioModalOpen, setIsStudioModalOpen] = useState(false);

  const handleDelete = (room: Room) => {
    if (window.confirm(`Sei sicuro di voler eliminare la sala "${room.nome}"?`)) {
      deleteRoom(room.id);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <span>Sale Prove di</span>
              <span className="text-indigo-600 font-bold">{studioInfo.nome}</span>
            </h2>
            <button
              onClick={() => {
                if (onNavigateToAnagrafica) {
                  onNavigateToAnagrafica();
                } else {
                  setIsStudioModalOpen(true);
                }
              }}
              className="px-2 py-0.5 rounded-md bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold border border-indigo-200/80 flex items-center gap-1 transition-colors"
              title="Apri l'anagrafica della sala prove / struttura"
            >
              <Building2 className="w-3 h-3 text-indigo-600" />
              <span>Anagrafica Struttura</span>
            </button>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
              {rooms.length} {rooms.length === 1 ? 'Sala' : 'Sale'} Attive
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Assegna il nome che desideri a ciascuna sala prove (es. Sala 1, Sala Rock, Box A), imposta tariffe orarie e backline.
          </p>
        </div>

        <button
          onClick={() => {
            setRoomToEdit(null);
            setIsModalOpen(true);
          }}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-lg shadow-xs transition-colors flex items-center gap-2 shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Nuova Sala Prove</span>
        </button>
      </div>

      {/* Rooms Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {rooms.map((room) => {
          const roomBookings = bookings.filter((b) => b.salaId === room.id);
          const totalHours = roomBookings.reduce((sum, b) => sum + (b.durataOre || 0), 0);

          return (
            <div
              key={room.id}
              className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4 flex flex-col justify-between hover:border-slate-300 transition-colors relative overflow-hidden"
            >
              {/* Color accent strip on top */}
              <div
                className="absolute top-0 left-0 right-0 h-1"
                style={{ backgroundColor: room.colore }}
              />

              <div className="space-y-3">
                {/* Header */}
                <div className="flex items-start justify-between gap-2 pt-1">
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0 shadow-2xs"
                        style={{ backgroundColor: room.colore }}
                      />
                      <button
                        onClick={() => {
                          setRoomToEdit(room);
                          setIsModalOpen(true);
                        }}
                        className="font-semibold text-slate-900 text-base leading-tight hover:text-indigo-600 text-left transition-colors flex items-center gap-1.5 group"
                        title="Clicca per modificare il nome o i parametri della sala"
                      >
                        <span>{room.nome}</span>
                        <Edit2 className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                      </button>
                    </div>
                    {room.descrizione && (
                      <p className="text-xs text-slate-500 mt-1">{room.descrizione}</p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => {
                        setRoomToEdit(room);
                        setIsModalOpen(true);
                      }}
                      className="p-1.5 text-slate-400 hover:text-slate-700 rounded-md hover:bg-slate-100 transition-colors"
                      title="Modifica nome e parametri della sala"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(room)}
                      className="p-1.5 text-rose-500 hover:text-rose-700 rounded-md hover:bg-rose-50 transition-colors"
                      title="Elimina"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Rates & Capacity */}
                <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 rounded-lg border border-slate-100 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                      Tariffa Prove
                    </span>
                    <strong className="text-slate-900 text-sm font-bold font-mono">
                      €{room.tariffaOraria}/h
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                      Tariffa Lezione
                    </span>
                    <strong className="text-indigo-700 text-sm font-bold font-mono">
                      €{room.tariffaLezione || room.tariffaOraria}/h
                    </strong>
                  </div>
                  <div className="col-span-2 pt-1 border-t border-slate-200/60 flex items-center justify-between text-slate-600">
                    <span className="flex items-center gap-1 text-[11px]">
                      <Users className="w-3.5 h-3.5 text-slate-400" />
                      Capienza: <strong>{room.capienza} persone</strong>
                    </span>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                        room.stato === 'disponibile'
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                          : 'bg-amber-50 border-amber-200 text-amber-800'
                      }`}
                    >
                      {room.stato === 'disponibile' ? 'Disponibile' : 'Manutenzione'}
                    </span>
                  </div>
                </div>

                {/* Equipment List */}
                <div className="space-y-1.5">
                  <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider block">
                    Dotazione & Backline:
                  </span>
                  <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                    {room.dotazione.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-start gap-1.5 text-xs text-slate-600 bg-white p-1 rounded"
                      >
                        <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                        <span className="leading-snug">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Bottom statistics & quick edit button */}
              <div className="space-y-2 pt-3 border-t border-slate-100">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Prenotazioni registrate:</span>
                  <strong className="text-slate-800">{roomBookings.length} ({totalHours}h)</strong>
                </div>
                <button
                  onClick={() => {
                    setRoomToEdit(room);
                    setIsModalOpen(true);
                  }}
                  className="w-full py-1.5 px-3 rounded-lg border border-slate-200 bg-slate-50 hover:bg-indigo-50 hover:border-indigo-200 text-slate-700 hover:text-indigo-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Modifica Nome & Dati Sala</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <RoomModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        roomToEdit={roomToEdit}
      />

      <StudioSettingsModal
        isOpen={isStudioModalOpen}
        onClose={() => setIsStudioModalOpen(false)}
      />
    </div>
  );
};
