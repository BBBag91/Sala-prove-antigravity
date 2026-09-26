import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Clock, ChevronDown, ChevronUp, Check, Sparkles, ArrowRight } from 'lucide-react';
import { minutesToTime, timeToMinutes } from '../utils/dateUtils';

interface SmartTimePickerProps {
  startTime: string; // 'HH:MM'
  endTime: string;   // 'HH:MM'
  onStartTimeChange: (time: string) => void;
  onEndTimeChange: (time: string) => void;
  durationHours: number;
  bookingType?: 'prove' | 'lezione';
}

const ITEM_HEIGHT = 44; // pixel height for each wheel slot
const BASE_HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const BASE_MINUTES = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'];

interface WheelColumnProps {
  items: string[];
  selectedItem: string;
  onSelect: (item: string) => void;
}

const WheelColumn: React.FC<WheelColumnProps> = ({ items, selectedItem, onSelect }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const isScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef<any>(null);

  // Sync scroll position when selectedItem changes from outside
  useEffect(() => {
    if (isScrollingRef.current) return;
    const index = items.indexOf(selectedItem);
    if (index !== -1 && containerRef.current) {
      containerRef.current.scrollTo({
        top: index * ITEM_HEIGHT,
        behavior: 'smooth',
      });
    }
  }, [selectedItem, items]);

  // Initial scroll on mount without animation
  useEffect(() => {
    const index = items.indexOf(selectedItem);
    if (index !== -1 && containerRef.current) {
      containerRef.current.scrollTop = index * ITEM_HEIGHT;
    }
  }, []);

  const handleScroll = () => {
    isScrollingRef.current = true;
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    scrollTimeoutRef.current = setTimeout(() => {
      if (!containerRef.current) return;
      const scrollTop = containerRef.current.scrollTop;
      const index = Math.round(scrollTop / ITEM_HEIGHT);
      const clampedIndex = Math.max(0, Math.min(items.length - 1, index));
      const newItem = items[clampedIndex];
      if (newItem && newItem !== selectedItem) {
        onSelect(newItem);
      }
      isScrollingRef.current = false;
    }, 100);
  };

  const handleItemClick = (index: number) => {
    if (containerRef.current) {
      containerRef.current.scrollTo({
        top: index * ITEM_HEIGHT,
        behavior: 'smooth',
      });
    }
    onSelect(items[index]);
  };

  return (
    <div className="relative flex-1 h-[220px] select-none">
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="w-full h-full overflow-y-auto overflow-x-hidden no-scrollbar cursor-grab active:cursor-grabbing"
        style={{
          scrollSnapType: 'y mandatory',
          paddingTop: `${ITEM_HEIGHT * 2}px`,
          paddingBottom: `${ITEM_HEIGHT * 2}px`,
        }}
      >
        {items.map((item, idx) => {
          const isSelected = item === selectedItem;
          return (
            <div
              key={item}
              onClick={() => handleItemClick(idx)}
              style={{
                height: `${ITEM_HEIGHT}px`,
                scrollSnapAlign: 'center',
              }}
              className={`flex items-center justify-center font-mono font-bold transition-all duration-150 ${
                isSelected
                  ? 'text-yellow-300 text-2xl font-black scale-110 drop-shadow-[0_0_10px_rgba(250,204,21,0.6)]'
                  : 'text-neutral-400 text-lg opacity-40 hover:opacity-80 hover:text-neutral-200 cursor-pointer'
              }`}
            >
              {item}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const SmartTimePicker: React.FC<SmartTimePickerProps> = ({
  startTime,
  endTime,
  onStartTimeChange,
  onEndTimeChange,
  durationHours,
  bookingType = 'prove',
}) => {
  const [activeTarget, setActiveTarget] = useState<'start' | 'end' | null>('start');

  const activeTime = activeTarget === 'start' ? startTime : endTime;
  const [activeHour, activeMinute] = useMemo(() => {
    const parts = (activeTime || '18:00').split(':');
    return [parts[0] || '18', parts[1] || '00'];
  }, [activeTime]);

  // Minutes list including any custom minutes if present
  const minutesList = useMemo(() => {
    if (!BASE_MINUTES.includes(activeMinute)) {
      return [...BASE_MINUTES, activeMinute].sort((a, b) => Number(a) - Number(b));
    }
    return BASE_MINUTES;
  }, [activeMinute]);

  const updateActiveTime = (newHour: string, newMinute: string) => {
    const formatted = `${newHour.padStart(2, '0')}:${newMinute.padStart(2, '0')}`;
    if (activeTarget === 'start') {
      onStartTimeChange(formatted);
    } else if (activeTarget === 'end') {
      onEndTimeChange(formatted);
    }
  };

  const handleSelectHour = (hour: string) => {
    updateActiveTime(hour, activeMinute);
  };

  const handleSelectMinute = (minute: string) => {
    updateActiveTime(activeHour, minute);
  };

  // Quick preset shortcuts
  const startPresets = ['17:00', '18:00', '19:00', '20:00', '21:00', '22:00'];

  const applyDurationPreset = (hours: number) => {
    const startMin = timeToMinutes(startTime);
    const newEnd = minutesToTime(startMin + Math.round(hours * 60));
    onEndTimeChange(newEnd);
  };

  return (
    <div className="space-y-2.5">
      {/* ── Trigger Buttons Row (Ora Inizio e Ora Fine) ── */}
      <div className="grid grid-cols-2 gap-3">
        {/* Ora Inizio Trigger */}
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
            <Clock className="w-3.5 h-3.5 inline mr-1 text-yellow-500" /> Ora Inizio *
          </label>
          <button
            type="button"
            onClick={() => setActiveTarget(activeTarget === 'start' ? null : 'start')}
            className={`w-full px-3.5 py-2.5 rounded-lg border text-left flex items-center justify-between transition-all duration-150 cursor-pointer ${
              activeTarget === 'start'
                ? 'bg-neutral-900 border-yellow-400 text-yellow-300 ring-2 ring-yellow-400/40 shadow-[0_0_12px_rgba(250,204,21,0.25)]'
                : 'bg-neutral-950 border-yellow-500/30 text-yellow-100 hover:border-yellow-500/60 hover:bg-neutral-900'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="font-mono text-base font-bold tracking-wider">{startTime}</span>
              <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-yellow-500/15 text-yellow-400">
                Inizio
              </span>
            </div>
            {activeTarget === 'start' ? (
              <ChevronUp className="w-4 h-4 text-yellow-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-neutral-400" />
            )}
          </button>
        </div>

        {/* Ora Fine Trigger */}
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
            <Clock className="w-3.5 h-3.5 inline mr-1 text-yellow-500" /> Ora Fine *
          </label>
          <button
            type="button"
            onClick={() => setActiveTarget(activeTarget === 'end' ? null : 'end')}
            className={`w-full px-3.5 py-2.5 rounded-lg border text-left flex items-center justify-between transition-all duration-150 cursor-pointer ${
              activeTarget === 'end'
                ? 'bg-neutral-900 border-yellow-400 text-yellow-300 ring-2 ring-yellow-400/40 shadow-[0_0_12px_rgba(250,204,21,0.25)]'
                : 'bg-neutral-950 border-yellow-500/30 text-yellow-100 hover:border-yellow-500/60 hover:bg-neutral-900'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="font-mono text-base font-bold tracking-wider">{endTime}</span>
              <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-yellow-500/15 text-yellow-400">
                Fine
              </span>
            </div>
            {activeTarget === 'end' ? (
              <ChevronUp className="w-4 h-4 text-yellow-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-neutral-400" />
            )}
          </button>
        </div>
      </div>

      {/* ── Smart Wheel Picker Panel (Animated Rollers) ── */}
      {activeTarget !== null && (
        <div className="p-3.5 bg-neutral-950 border-2 border-yellow-500/40 rounded-xl space-y-3 shadow-xl">
          {/* Header Switcher & Close button */}
          <div className="flex items-center justify-between border-b border-neutral-800 pb-2.5">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTarget('start')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTarget === 'start'
                    ? 'bg-yellow-400 text-neutral-950 shadow-sm'
                    : 'bg-neutral-900 text-neutral-400 hover:text-yellow-300 border border-neutral-800'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Modifica Ora Inizio: {startTime}</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTarget('end')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTarget === 'end'
                    ? 'bg-yellow-400 text-neutral-950 shadow-sm'
                    : 'bg-neutral-900 text-neutral-400 hover:text-yellow-300 border border-neutral-800'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Modifica Ora Fine: {endTime}</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setActiveTarget(null)}
              className="px-2.5 py-1 rounded-md bg-neutral-900 hover:bg-neutral-800 text-yellow-400 border border-yellow-500/30 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Fatto</span>
            </button>
          </div>

          {/* Quick Shortcuts Bar */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 text-xs">
            <span className="text-[11px] font-semibold text-neutral-400 shrink-0 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-yellow-400" />
              {activeTarget === 'start' ? 'Inizi frequenti:' : 'Durata rapida:'}
            </span>

            {activeTarget === 'start' ? (
              startPresets.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => onStartTimeChange(t)}
                  className={`px-2.5 py-1 rounded-md font-mono text-[11px] font-bold shrink-0 transition-colors border cursor-pointer ${
                    startTime === t
                      ? 'bg-yellow-400 text-neutral-950 border-yellow-400'
                      : 'bg-neutral-900 text-yellow-300 border-neutral-800 hover:border-yellow-500/40'
                  }`}
                >
                  {t}
                </button>
              ))
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => applyDurationPreset(1)}
                  className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-neutral-900 text-yellow-300 border border-neutral-800 hover:border-yellow-500/40 shrink-0 cursor-pointer"
                >
                  +1h (1 ora)
                </button>
                <button
                  type="button"
                  onClick={() => applyDurationPreset(1.5)}
                  className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-neutral-900 text-yellow-300 border border-neutral-800 hover:border-yellow-500/40 shrink-0 cursor-pointer"
                >
                  +1h 30m
                </button>
                <button
                  type="button"
                  onClick={() => applyDurationPreset(2)}
                  className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-neutral-900 text-yellow-300 border border-neutral-800 hover:border-yellow-500/40 shrink-0 cursor-pointer"
                >
                  +2h (2 ore)
                </button>
                <button
                  type="button"
                  onClick={() => applyDurationPreset(3)}
                  className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-neutral-900 text-yellow-300 border border-neutral-800 hover:border-yellow-500/40 shrink-0 cursor-pointer"
                >
                  +3h (3 ore)
                </button>
                <button
                  type="button"
                  onClick={() => applyDurationPreset(4)}
                  className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-neutral-900 text-yellow-300 border border-neutral-800 hover:border-yellow-500/40 shrink-0 cursor-pointer"
                >
                  +4h (4 ore)
                </button>
              </>
            )}
          </div>

          {/* ── Wheel Cylinders Container (iOS Style Roller) ── */}
          <div className="relative bg-[#0d0d0d] rounded-xl border border-yellow-500/25 p-3 overflow-hidden shadow-inner">
            {/* Column Headers */}
            <div className="flex items-center justify-around pb-2 border-b border-neutral-900 text-[11px] font-bold uppercase tracking-wider text-yellow-500/80 select-none">
              <span className="w-1/2 text-center">Ore</span>
              <span className="w-6"></span>
              <span className="w-1/2 text-center">Minuti</span>
            </div>

            {/* Roller Area */}
            <div className="relative h-[220px]">
              {/* Center Pill Highlight (iOS Wheel Capsule) */}
              <div
                className="pointer-events-none absolute left-2 right-2 rounded-xl bg-yellow-400/15 border-2 border-yellow-400/50 shadow-[0_0_15px_rgba(250,204,21,0.2)] z-0"
                style={{
                  top: `${ITEM_HEIGHT * 2}px`,
                  height: `${ITEM_HEIGHT}px`,
                }}
              />

              {/* Top Fade Gradient */}
              <div className="pointer-events-none absolute inset-x-0 top-0 h-[75px] bg-gradient-to-b from-[#0d0d0d] via-[#0d0d0d]/85 to-transparent z-10" />

              {/* Bottom Fade Gradient */}
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[75px] bg-gradient-to-t from-[#0d0d0d] via-[#0d0d0d]/85 to-transparent z-10" />

              {/* Columns */}
              <div className="flex items-center justify-center h-full relative z-0">
                <WheelColumn
                  items={BASE_HOURS}
                  selectedItem={activeHour}
                  onSelect={handleSelectHour}
                />

                <div className="text-yellow-400 font-mono text-2xl font-black px-3 z-20 select-none opacity-80">
                  :
                </div>

                <WheelColumn
                  items={minutesList}
                  selectedItem={activeMinute}
                  onSelect={handleSelectMinute}
                />
              </div>
            </div>
          </div>

          {/* Footer Status & Duration */}
          <div className="flex items-center justify-between text-xs pt-1 border-t border-neutral-800 text-neutral-300">
            <div className="flex items-center gap-1.5">
              <span>Durata sessione:</span>
              <strong className="text-yellow-300 font-bold">
                {durationHours > 0
                  ? `${durationHours} ${durationHours === 1 ? 'ora' : 'ore'} (${Math.round(durationHours * 60)} min)`
                  : 'Orario non valido'}
              </strong>
            </div>

            {durationHours <= 0 ? (
              <button
                type="button"
                onClick={() => applyDurationPreset(bookingType === 'lezione' ? 1 : 2)}
                className="text-xs text-rose-400 hover:text-rose-300 underline font-semibold cursor-pointer"
              >
                Correggi a +{bookingType === 'lezione' ? '1h' : '2h'}
              </button>
            ) : (
              <span className="text-[11px] text-neutral-400 flex items-center gap-1">
                <span className="font-mono text-yellow-400">{startTime}</span>
                <ArrowRight className="w-3 h-3 text-neutral-500" />
                <span className="font-mono text-yellow-400">{endTime}</span>
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
