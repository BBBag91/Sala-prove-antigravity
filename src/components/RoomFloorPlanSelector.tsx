import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Check,
  MapPin,
  X,
  Layers,
  Lock,
  Calendar,
  Clock,
  Sparkles,
} from 'lucide-react';
import { Room, Booking } from '../types';
import floorPlanImg from '../assets/piantina-sale.jpg';

export interface RoomFloorPlanSelectorProps {
  rooms: Room[];
  selectedRoomId: string;
  onSelectRoom: (roomId: string) => void;
  availableRooms: Room[];
  occupiedRooms: { room: Room; conflicts: Booking[] }[];
  tipo: 'prove' | 'lezione';
  data?: string;
  oraInizio?: string;
  oraFine?: string;
  disabled?: boolean;
}

interface ZoneDefinition {
  key: 'grande' | 'nuova' | 'studiolo' | 'piccola';
  defaultTitle: string;
  left: string;
  top: string;
  width: string;
  height: string;
  badgePosition: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  matchKeywords: string[];
}

const FLOOR_PLAN_ZONES: ZoneDefinition[] = [
  {
    key: 'grande',
    defaultTitle: 'Sala Grande',
    left: '3.5%',
    top: '2.6%',
    width: '33.0%',
    height: '44.1%',
    badgePosition: 'bottom-left',
    matchKeywords: ['grande', 'hendrix', 'rock'],
  },
  {
    key: 'nuova',
    defaultTitle: 'Sala Nuova',
    left: '36.5%',
    top: '2.6%',
    width: '34.6%',
    height: '26.7%',
    badgePosition: 'bottom-right',
    matchKeywords: ['nuova', 'coltrane', 'jazz'],
  },
  {
    key: 'studiolo',
    defaultTitle: 'Studiolo',
    left: '3.5%',
    top: '46.7%',
    width: '27.5%',
    height: '17.2%',
    badgePosition: 'top-left',
    matchKeywords: ['studio', 'studiolo', 'regia', 'turing'],
  },
  {
    key: 'piccola',
    defaultTitle: 'Sala Piccola',
    left: '3.5%',
    top: '63.9%',
    width: '29.0%',
    height: '30.7%',
    badgePosition: 'top-left',
    matchKeywords: ['piccola', 'marley', 'reggae', 'abbey'],
  },
];

export const RoomFloorPlanSelector: React.FC<RoomFloorPlanSelectorProps> = ({
  rooms,
  selectedRoomId,
  onSelectRoom,
  availableRooms,
  occupiedRooms,
  tipo,
  data,
  oraInizio,
  oraFine,
  disabled = false,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [hoveredRoomId, setHoveredRoomId] = useState<string | null>(null);

  // Mappa delle sale occupate con conflitti per accesso rapido O(1)
  const occupiedMap = useMemo(() => {
    const map = new Map<string, Booking[]>();
    occupiedRooms.forEach(({ room, conflicts }) => {
      map.set(room.id, conflicts);
    });
    return map;
  }, [occupiedRooms]);

  // Chiudi modale con tasto ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isModalOpen) {
        setIsModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen]);

  // Sala attualmente selezionata
  const selectedRoom = useMemo(() => {
    return rooms.find((r) => r.id === selectedRoomId);
  }, [rooms, selectedRoomId]);

  const isSelectedRoomOccupied = selectedRoomId ? occupiedMap.has(selectedRoomId) : false;

  // Associazione Zone della Piantina -> Oggetti Room
  const zoneRoomMap = useMemo(() => {
    const map = new Map<string, Room>();
    const usedRoomIds = new Set<string>();

    // 1. Match per parole chiave nel nome
    FLOOR_PLAN_ZONES.forEach((zone) => {
      const match = rooms.find(
        (r) =>
          !usedRoomIds.has(r.id) &&
          zone.matchKeywords.some((kw) => r.nome.toLowerCase().includes(kw))
      );
      if (match) {
        map.set(zone.key, match);
        usedRoomIds.add(match.id);
      }
    });

    // 2. Fallback per indice per eventuali sale non matchate
    const remainingRooms = rooms.filter((r) => !usedRoomIds.has(r.id));
    FLOOR_PLAN_ZONES.forEach((zone, idx) => {
      if (!map.has(zone.key) && remainingRooms[idx]) {
        map.set(zone.key, remainingRooms[idx]);
        usedRoomIds.add(remainingRooms[idx].id);
      }
    });

    return map;
  }, [rooms]);

  // Eventuali sale extra non presenti nelle 4 stanze della piantina
  const extraRooms = useMemo(() => {
    const mappedIds = new Set(Array.from(zoneRoomMap.values()).map((r: Room) => r.id));
    return rooms.filter((r) => !mappedIds.has(r.id));
  }, [rooms, zoneRoomMap]);

  const handleSelect = (roomId: string, isAvailable: boolean) => {
    if (!isAvailable) return;
    onSelectRoom(roomId);
    // Breve ritardo per mostrare l'animazione di selezione prima della chiusura
    setTimeout(() => {
      setIsModalOpen(false);
    }, 240);
  };

  const getTariffa = (r: Room) => {
    if (tipo === 'lezione' && r.tariffaLezione) {
      return `€${r.tariffaLezione}/h`;
    }
    return `€${r.tariffaOraria}/h`;
  };

  return (
    <div className="w-full">
      {/* TRIGGER DELLA SALA NEL FORM: CARD PULITA ED ELEGANTE */}
      {selectedRoom ? (
        <div
          onClick={() => !disabled && setIsModalOpen(true)}
          className={`w-full p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between gap-3 shadow-xs ${
            isSelectedRoomOccupied
              ? 'border-red-500 bg-red-50 dark:bg-red-950/40 text-red-900 ring-2 ring-red-400'
              : 'border-slate-300 dark:border-neutral-700 bg-white hover:bg-slate-50 dark:bg-neutral-900 dark:hover:bg-neutral-850'
          } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
        >
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center text-white shrink-0 shadow-xs border border-black/10"
              style={{ backgroundColor: selectedRoom.colore || '#4f46e5' }}
            >
              <MapPin className="w-5 h-5 stroke-[2.5]" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-extrabold text-sm text-slate-900 dark:text-white truncate">
                  {selectedRoom.nome}
                </span>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                  {getTariffa(selectedRoom)}
                </span>
                <span className="text-xs text-slate-500 dark:text-neutral-400">
                  Capienza: {selectedRoom.capienza}
                </span>
              </div>
              <div className="text-[11px] text-slate-400 dark:text-neutral-500 mt-0.5 flex items-center gap-1">
                <span>Clicca per cambiare sala dalla mappa</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            disabled={disabled}
            onClick={(e) => {
              e.stopPropagation();
              setIsModalOpen(true);
            }}
            className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Mappa</span>
          </button>
        </div>
      ) : (
        /* NESSUNA SALA SELEZIONATA: BOTTONE PROMINENTE PER APRIRE LA MAPPA DEDICATA */
        <button
          type="button"
          disabled={disabled}
          onClick={() => setIsModalOpen(true)}
          className={`w-full p-3.5 rounded-xl border-2 border-dashed border-indigo-400 hover:border-indigo-600 bg-indigo-50/70 hover:bg-indigo-100/60 dark:bg-indigo-950/30 dark:border-indigo-700/70 transition-all flex items-center justify-between gap-3 text-left cursor-pointer group shadow-xs ${
            disabled ? 'opacity-60 cursor-not-allowed' : ''
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform">
              <Layers className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-indigo-500" />
                <span>Seleziona Sala Prove</span>
              </div>
              <div className="text-sm font-extrabold text-slate-800 dark:text-slate-100">
                Apri la Mappa per scegliere la stanza
              </div>
            </div>
          </div>

          <div className="shrink-0 flex items-center gap-2">
            <span
              className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
                availableRooms.length > 0
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                  : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-300 dark:border-rose-800'
              }`}
            >
              {availableRooms.length} su {rooms.length} {availableRooms.length === 1 ? 'libera' : 'libere'}
            </span>
            <span className="hidden sm:inline-block px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold shadow-xs">
              Apri Mappa 🗺️
            </span>
          </div>
        </button>
      )}

      {/* FINESTRA MODALE DEDICATA ALLA MAPPA (AMPIA, SPAZIOSA E NON APPICCICATA) */}
      {isModalOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200"
            onClick={() => setIsModalOpen(false)}
          >
            <div
              className="relative w-full max-w-3xl bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl border border-slate-300 dark:border-neutral-700 overflow-hidden my-auto flex flex-col max-h-[94vh] animate-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header Finestra Mappa */}
              <div className="px-5 py-3.5 bg-slate-100 dark:bg-neutral-800 border-b border-slate-200 dark:border-neutral-700 flex items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shrink-0">
                    <Layers className="w-5 h-5 stroke-[2.5]" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                      <span>Mappa Salette Musicali</span>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hidden sm:inline-block">
                        {tipo === 'prove' ? 'Prove Musicali' : 'Lezione Musica'}
                      </span>
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-neutral-400 flex items-center gap-2 flex-wrap mt-0.5">
                      {data && (
                        <span className="flex items-center gap-1 font-semibold text-slate-700 dark:text-neutral-300">
                          <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                          <span>{data}</span>
                        </span>
                      )}
                      {oraInizio && oraFine && (
                        <span className="flex items-center gap-1 font-semibold text-slate-700 dark:text-neutral-300">
                          <Clock className="w-3.5 h-3.5 text-indigo-600" />
                          <span>{oraInizio} - {oraFine}</span>
                        </span>
                      )}
                      <span>• Clicca direttamente sulla sala per selezionarla</span>
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="w-9 h-9 rounded-xl bg-slate-200/80 hover:bg-rose-600 hover:text-white dark:bg-neutral-700 text-slate-600 dark:text-neutral-300 transition-colors flex items-center justify-center cursor-pointer shrink-0"
                  title="Chiudi mappa"
                >
                  <X className="w-5 h-5 stroke-[2.5]" />
                </button>
              </div>

              {/* Barra Legenda */}
              <div className="px-5 py-2 bg-slate-50 dark:bg-neutral-950/70 border-b border-slate-200 dark:border-neutral-800 text-xs font-semibold flex items-center justify-between flex-wrap gap-2 text-slate-600 dark:text-neutral-300 shrink-0">
                <div className="flex items-center gap-4 flex-wrap">
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-emerald-500 shadow-xs ring-2 ring-emerald-300/60" />
                    <span className="font-bold text-slate-800 dark:text-white">Libera (cliccabile)</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-slate-500 shadow-xs ring-2 ring-slate-400/50" />
                    <span className="font-bold text-slate-500 dark:text-neutral-400">Grigia (Occupata)</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-indigo-600 shadow-xs ring-2 ring-indigo-400/60 animate-pulse" />
                    <span className="font-bold text-indigo-600 dark:text-indigo-400">Selezionata</span>
                  </span>
                </div>

                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  {availableRooms.length} su {rooms.length} sale disponibili
                </span>
              </div>

              {/* Corpo Modale: PIANTINA GRANDE E SPAZIOSA */}
              <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
                {/* Immagine Piantina con overlay proporzionati */}
                <div className="relative w-full aspect-[1024/973] bg-neutral-950 rounded-2xl overflow-hidden shadow-2xl border-2 border-slate-300 dark:border-neutral-800 select-none group/map">
                  {/* Foto reale */}
                  <img
                    src={floorPlanImg}
                    alt="Piantina Sale Prove"
                    className="w-full h-full object-cover block"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/assets/piantina-sale.jpg';
                    }}
                  />

                  {/* Overlays Interattivi per ciascuna delle 4 sale */}
                  {FLOOR_PLAN_ZONES.map((zone) => {
                    const room = zoneRoomMap.get(zone.key);
                    if (!room) return null;

                    const isOccupied = occupiedMap.has(room.id);
                    const isAvailable = !isOccupied && room.stato !== 'manutenzione';
                    const isSelected = selectedRoomId === room.id;
                    const isHovered = hoveredRoomId === room.id;
                    const conflicts = occupiedMap.get(room.id) || [];

                    return (
                      <div
                        key={zone.key}
                        style={{
                          left: zone.left,
                          top: zone.top,
                          width: zone.width,
                          height: zone.height,
                        }}
                        onMouseEnter={() => setHoveredRoomId(room.id)}
                        onMouseLeave={() => setHoveredRoomId(null)}
                        onClick={() => handleSelect(room.id, isAvailable)}
                        className={`absolute rounded-xl transition-all duration-200 overflow-hidden ${
                          isAvailable
                            ? 'cursor-pointer hover:scale-[1.01]'
                            : 'cursor-not-allowed select-none'
                        } ${
                          // SALA NON DISPONIBILE: APPARE GRIGIA
                          !isAvailable
                            ? 'bg-slate-900/80 dark:bg-black/85 backdrop-grayscale backdrop-blur-[2px] border-2 border-slate-500/80 border-dashed text-slate-300 shadow-md'
                            : isSelected
                              ? 'bg-indigo-600/35 border-4 border-indigo-500 ring-4 ring-indigo-400/50 shadow-2xl'
                              : isHovered
                                ? 'bg-emerald-500/25 border-3 border-emerald-400 ring-4 ring-emerald-300/40 shadow-xl'
                                : 'bg-transparent border border-white/20 hover:border-emerald-400/70'
                        }`}
                        title={
                          !isAvailable
                            ? `${room.nome}: OCCUPATA (${conflicts.map((c) => `${c.clienteNome} ${c.oraInizio}-${c.oraFine}`).join(', ')})`
                            : `${room.nome} - Clicca per selezionare (${getTariffa(room)})`
                        }
                      >
                        {/* OVERLAY SALA GRIGIA (OCCUPATA / NON DISPONIBILE) */}
                        {!isAvailable && (
                          <div
                            className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-3 text-center"
                            style={{
                              backgroundImage:
                                'repeating-linear-gradient(45deg, rgba(30, 41, 59, 0.45), rgba(30, 41, 59, 0.45) 12px, rgba(15, 23, 42, 0.65) 12px, rgba(15, 23, 42, 0.65) 24px)',
                            }}
                          >
                            <div className="bg-slate-900/95 border border-slate-600 px-3 py-1.5 rounded-lg shadow-xl flex items-center gap-2 text-xs font-black text-rose-300">
                              <Lock className="w-3.5 h-3.5 text-rose-400" />
                              <span className="uppercase tracking-wider">OCCUPATA</span>
                            </div>

                            {conflicts.length > 0 && (
                              <div className="mt-1.5 text-[10px] sm:text-xs text-slate-200 bg-slate-950/90 px-2 py-1 rounded-md border border-slate-700/70 max-w-[90%] truncate shadow-xs">
                                🕒 {conflicts[0].oraInizio}-{conflicts[0].oraFine} • {conflicts[0].clienteNome}
                              </div>
                            )}
                          </div>
                        )}

                        {/* BADGE SALA SELEZIONATA */}
                        {isSelected && isAvailable && (
                          <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-2 animate-in fade-in zoom-in-95 duration-150">
                            <div className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg shadow-xl border border-indigo-300 flex items-center gap-1.5 text-xs font-black tracking-wider uppercase">
                              <Check className="w-4 h-4 stroke-[3]" />
                              <span>SELEZIONATA</span>
                            </div>
                            <span className="mt-1.5 text-xs font-bold text-white bg-indigo-950/90 px-2.5 py-0.5 rounded-full border border-indigo-500/50 shadow-xs">
                              {getTariffa(room)}
                            </span>
                          </div>
                        )}

                        {/* BADGE SALA DISPONIBILE */}
                        {isAvailable && !isSelected && (
                          <div
                            className={`absolute ${
                              zone.badgePosition === 'top-left'
                                ? 'top-2.5 left-2.5'
                                : zone.badgePosition === 'top-right'
                                  ? 'top-2.5 right-2.5'
                                  : zone.badgePosition === 'bottom-left'
                                    ? 'bottom-2.5 left-2.5'
                                    : 'bottom-2.5 right-2.5'
                            } transition-transform duration-150 ${isHovered ? 'scale-105' : ''}`}
                          >
                            <div
                              className={`px-2 py-1 rounded-md text-xs font-bold flex items-center gap-1.5 shadow-md border ${
                                isHovered
                                  ? 'bg-emerald-600 text-white border-emerald-400'
                                  : 'bg-black/75 text-white/95 border-white/30 backdrop-blur-xs'
                              }`}
                            >
                              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                              <span>{getTariffa(room)}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Schede rapide sotto la piantina per facilitare la selezione */}
                <div>
                  <div className="text-xs font-bold text-slate-500 dark:text-neutral-400 mb-2 uppercase tracking-wider flex items-center justify-between">
                    <span>Oppure seleziona dalle schede:</span>
                    <span className="text-[11px] font-normal lowercase text-slate-400">
                      cliccando su una scheda selezioni la sala
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
                    {rooms.map((r) => {
                      const isOccupied = occupiedMap.has(r.id);
                      const isAvailable = !isOccupied && r.stato !== 'manutenzione';
                      const isSelected = selectedRoomId === r.id;

                      return (
                        <button
                          key={r.id}
                          type="button"
                          disabled={!isAvailable}
                          onClick={() => handleSelect(r.id, isAvailable)}
                          onMouseEnter={() => setHoveredRoomId(r.id)}
                          onMouseLeave={() => setHoveredRoomId(null)}
                          className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-2 shadow-xs ${
                            !isAvailable
                              ? 'bg-slate-100 text-slate-400 border-slate-200 dark:bg-neutral-800/50 dark:text-neutral-500 dark:border-neutral-800 cursor-not-allowed opacity-75'
                              : isSelected
                                ? 'bg-indigo-50 border-indigo-500 text-indigo-900 ring-2 ring-indigo-400 dark:bg-indigo-950/50 dark:text-indigo-200'
                                : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-200 dark:bg-neutral-800 dark:text-neutral-200 dark:border-neutral-700 hover:border-indigo-300'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-extrabold text-sm truncate">{r.nome}</span>
                            <span
                              className="w-3 h-3 rounded-full shrink-0 shadow-xs"
                              style={{ backgroundColor: r.colore }}
                            />
                          </div>

                          <div className="text-xs text-slate-500 dark:text-neutral-400">
                            Capienza: {r.capienza} persone
                          </div>

                          <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-neutral-700/60 text-xs font-bold">
                            <span>{getTariffa(r)}</span>
                            <span
                              className={`px-2 py-0.5 rounded-full ${
                                !isAvailable
                                  ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                                  : isSelected
                                    ? 'bg-indigo-600 text-white'
                                    : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                              }`}
                            >
                              {!isAvailable ? 'Occupata' : isSelected ? 'Selezionata' : 'Libera'}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Eventuali sale extra fuori piantina */}
                {extraRooms.length > 0 && (
                  <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50">
                    <div className="text-xs font-bold text-amber-800 dark:text-amber-300 mb-2">
                      Altre sale dello studio:
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {extraRooms.map((er) => {
                        const isAvailable = !occupiedMap.has(er.id) && er.stato !== 'manutenzione';
                        const isSelected = selectedRoomId === er.id;
                        return (
                          <button
                            key={er.id}
                            type="button"
                            disabled={!isAvailable}
                            onClick={() => handleSelect(er.id, isAvailable)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                              !isAvailable
                                ? 'bg-slate-200 text-slate-400 cursor-not-allowed border-slate-300'
                                : isSelected
                                  ? 'bg-indigo-600 text-white border-indigo-700'
                                  : 'bg-white text-slate-800 border-slate-300 hover:bg-slate-50'
                            }`}
                          >
                            {er.nome} ({getTariffa(er)}) - {isAvailable ? 'Libera' : 'Occupata'}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Footer Modale */}
              <div className="px-5 py-3 bg-slate-100 dark:bg-neutral-800 border-t border-slate-200 dark:border-neutral-700 flex items-center justify-between gap-3 shrink-0">
                <div className="text-xs text-slate-600 dark:text-neutral-300">
                  {selectedRoom ? (
                    <span>
                      Sala scelta:{' '}
                      <strong className="text-slate-900 dark:text-white font-extrabold text-sm">
                        {selectedRoom.nome}
                      </strong>{' '}
                      ({getTariffa(selectedRoom)})
                    </span>
                  ) : (
                    <span className="text-amber-600 dark:text-amber-400 font-semibold">
                      Seleziona una sala cliccandoci sopra
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 rounded-xl border border-slate-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 hover:bg-slate-50 text-slate-700 dark:text-neutral-200 text-xs font-bold transition-all cursor-pointer shadow-xs"
                  >
                    Chiudi
                  </button>
                  {selectedRoom && (
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all cursor-pointer shadow-md"
                    >
                      Conferma Sala
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
