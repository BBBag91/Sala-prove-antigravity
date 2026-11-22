import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Download,
  Plus,
  Copy,
  Trash2,
  Play,
  Square,
  RotateCcw,
  FileText,
  Music,
  Sparkles,
  Save,
  FolderOpen,
  Check,
  Repeat,
  ChevronRight,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import {
  TabInstrumentType,
  TabMeasure,
  TabSheetDocument,
  generateTabSheetPDF,
  getDrumStaffNotePosition,
  computeDrumBeamGroups,
} from '../utils/tabPdfGenerator';
import { tabLibraryService } from '../services/tabLibraryService';

interface InstrumentConfig {
  id: TabInstrumentType;
  label: string;
  shortLabel: string;
  badge: string;
  tunings: { label: string; lines: string[]; midiNotes?: number[] }[];
}

const INSTRUMENT_CONFIGS: InstrumentConfig[] = [
  {
    id: 'guitar',
    label: 'Chitarra (6 Corde)',
    shortLabel: '🎸 Chitarra',
    badge: '6 Corde',
    tunings: [
      {
        label: 'Standard (E A D G B e)',
        lines: ['e', 'B', 'G', 'D', 'A', 'E'],
        midiNotes: [64, 59, 55, 50, 45, 40],
      },
      {
        label: 'Drop D (D A D G B e)',
        lines: ['e', 'B', 'G', 'D', 'A', 'D'],
        midiNotes: [64, 59, 55, 50, 45, 38],
      },
      {
        label: 'Eb / Mezzo Tono Sotto',
        lines: ['eb', 'Bb', 'Gb', 'Db', 'Ab', 'Eb'],
        midiNotes: [63, 58, 54, 49, 44, 39],
      },
      {
        label: 'DADGAD Acustica',
        lines: ['d', 'A', 'G', 'D', 'A', 'D'],
        midiNotes: [62, 57, 55, 50, 45, 38],
      },
    ],
  },
  {
    id: 'bass4',
    label: 'Basso (4 Corde)',
    shortLabel: '🎸 Basso 4 Corde',
    badge: '4 Corde',
    tunings: [
      {
        label: 'Standard (E A D G)',
        lines: ['G', 'D', 'A', 'E'],
        midiNotes: [43, 38, 33, 28],
      },
      {
        label: 'Drop D (D A D G)',
        lines: ['G', 'D', 'A', 'D'],
        midiNotes: [43, 38, 33, 26],
      },
    ],
  },
  {
    id: 'bass5',
    label: 'Basso (5 Corde)',
    shortLabel: '🎸 Basso 5 Corde',
    badge: '5 Corde',
    tunings: [
      {
        label: 'Standard 5 Corde (B E A D G)',
        lines: ['G', 'D', 'A', 'E', 'B'],
        midiNotes: [43, 38, 33, 28, 23],
      },
    ],
  },
  {
    id: 'drums',
    label: 'Batteria (Drum Tab)',
    shortLabel: '🥁 Batteria',
    badge: 'Drum Kit',
    tunings: [
      {
        label: 'Drum Kit Completo (8 Pezzi)',
        lines: ['CC', 'HH', 'RD', 'SD', 'HT', 'MT', 'FT', 'BD'],
      },
      {
        label: 'Groove Essenziale (HH / SD / BD / CC)',
        lines: ['CC', 'HH', 'SD', 'FT', 'BD'],
      },
    ],
  },
];

const DRUM_LINE_DESCRIPTIONS: Record<string, string> = {
  CC: 'Crash Cymbal',
  HH: 'Charleston (Hi-Hat)',
  RD: 'Ride Cymbal',
  SD: 'Rullante (Snare)',
  HT: 'High Tom (Tom 1)',
  MT: 'Mid Tom (Tom 2)',
  FT: 'Floor Tom (Timpano)',
  BD: 'Cassa (Bass Drum)',
};

const DRUM_SYMBOLS = [
  { symbol: 'auto', label: '⚡ Auto (x/o)', desc: 'Inserisce automaticamente x sui piatti e o sui tamburi' },
  { symbol: 'o', label: 'o • Colpo', desc: 'Colpo standard su tamburo o cassa' },
  { symbol: 'x', label: 'x • Piatto/HH', desc: 'Colpo su Charleston chiuso, Ride o Crash' },
  { symbol: 'O', label: 'O • Accento / HH Aperto', desc: 'Colpo accentato o Charleston aperto' },
  { symbol: 'g', label: 'g • Ghost Note', desc: 'Nota fantasma leggera sul rullante' },
  { symbol: 'f', label: 'f • Flam', desc: 'Flam (doppio colpo ravvicinato)' },
  { symbol: 'd', label: 'd • Drag / Doppio', desc: 'Rullo doppio / Drag' },
  { symbol: '', label: '⌫ Cancella', desc: 'Svuota la cella cliccata' },
];

// Accordi rapidi 1-Click per Chitarra (dalla 1a corda 'e' alla 6a corda 'E')
const GUITAR_QUICK_CHORDS: { name: string; frets: (number | null)[] }[] = [
  { name: 'E5', frets: [null, null, null, 2, 2, 0] },
  { name: 'A5', frets: [null, null, 2, 2, 0, null] },
  { name: 'D5', frets: [null, 3, 2, 0, null, null] },
  { name: 'G5', frets: [null, null, null, 5, 5, 3] },
  { name: 'C5', frets: [null, null, 5, 5, 3, null] },
  { name: 'Em', frets: [0, 0, 0, 2, 2, 0] },
  { name: 'Am', frets: [0, 1, 2, 2, 0, null] },
  { name: 'C', frets: [0, 1, 0, 2, 3, null] },
  { name: 'G', frets: [3, 0, 0, 0, 2, 3] },
  { name: 'D', frets: [2, 3, 2, 0, null, null] },
  { name: 'A', frets: [0, 2, 2, 2, 0, null] },
  { name: 'E', frets: [0, 0, 1, 2, 2, 0] },
  { name: 'F', frets: [1, 1, 2, 3, 3, 1] },
  { name: 'Dm', frets: [1, 3, 2, 0, null, null] },
];

const SECTION_PRESETS = ['Intro', 'Strofa', 'Pre-Chorus', 'Ritornello', 'Riff', 'Bridge', 'Solo', 'Fill', 'Outro'];

const SAVED_TABS_STORAGE_KEY = 'salaprove_saved_tabs_v1';

function createEmptyMeasure(stepsCount = 16, index = 0): TabMeasure {
  return {
    id: `m-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 6)}`,
    sectionLabel: index === 0 ? 'Intro' : undefined,
    repeatStart: false,
    repeatEnd: false,
    repeatCount: 2,
    stepsCount,
    chords: {},
    cells: {},
  };
}

export const TabStudioCreator: React.FC = () => {
  const { studioInfo, staff } = useApp();
  const { user } = useAuth();

  // Docente precompilato dal profilo loggato (es. Gabriele Piva)
  const defaultTeacherName = React.useMemo(() => {
    if (user?.staffId) {
      const member = staff.find((s) => s.id === user.staffId);
      if (member) return `${member.nome} ${member.cognome}`;
    }
    return user?.nome || 'Gabriele Piva';
  }, [user, staff]);

  // Stato principale documento Tab
  const [instrument, setInstrument] = useState<TabInstrumentType>('guitar');
  const [tuningIdx, setTuningIdx] = useState<number>(0);
  const [title, setTitle] = useState<string>('');
  const [artistOrStudent, setArtistOrStudent] = useState<string>('');
  const [teacherName, setTeacherName] = useState<string>(defaultTeacherName);
  const [bpm, setBpm] = useState<number>(120);
  const [bpmInput, setBpmInput] = useState<string>('120');
  const [timeSignature, setTimeSignature] = useState<string>('4/4');
  const [capo, setCapo] = useState<number>(0);
  const [capoInput, setCapoInput] = useState<string>('0');
  const [notes, setNotes] = useState<string>('');
  const [defaultStepsPerMeasure, setDefaultStepsPerMeasure] = useState<number>(16);
  const [measures, setMeasures] = useState<TabMeasure[]>(() => [
    createEmptyMeasure(16, 0),
    createEmptyMeasure(16, 1),
  ]);

  // Cella selezionata: { mIdx, lIdx, sIdx }
  const [selectedCell, setSelectedCell] = useState<{
    mIdx: number;
    lIdx: number;
    sIdx: number;
  }>({ mIdx: 0, lIdx: 0, sIdx: 0 });

  // Finestrella popup inserimento rapido numeri tasto (0-24) per Smartphone e PC
  const [isFretPopupOpen, setIsFretPopupOpen] = useState<boolean>(false);
  const [closePopupOnSelect, setClosePopupOnSelect] = useState<boolean>(true);

  // Avanzamento automatico cursore dopo inserimento tasto
  const [autoAdvance, setAutoAdvance] = useState<boolean>(false);

  // Strumento simbolo attivo per Batteria
  const [activeDrumSymbol, setActiveDrumSymbol] = useState<string>('auto');

  // ID documento corrente (per aggiornare la stessa partitura in libreria se già salvata)
  const [currentDocId, setCurrentDocId] = useState<string>(() => `tab-${Date.now()}`);

  // Libreria Tab Salvate (sincronizzata sul database Supabase tramite tabLibraryService)
  const [savedTabs, setSavedTabs] = useState<TabSheetDocument[]>(() =>
    tabLibraryService.getAllTabs()
  );
  const [librarySearch, setLibrarySearch] = useState<string>('');
  const [libraryInstrumentFilter, setLibraryInstrumentFilter] = useState<'all' | TabInstrumentType>('all');
  const [isSavedBanner, setIsSavedBanner] = useState(false);
  const [isLibraryOpen, setIsLibraryOpen] = useState(true);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [exportingLibraryId, setExportingLibraryId] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = tabLibraryService.subscribe(() => {
      setSavedTabs(tabLibraryService.getAllTabs());
    });
    return unsubscribe;
  }, []);

  // Audio Playback della Tab
  const [isPlayingTab, setIsPlayingTab] = useState(false);
  const [playingStepKey, setPlayingStepKey] = useState<string | null>(null);
  const [isLegendOpen, setIsLegendOpen] = useState<boolean>(true);
  const playTimerRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const noiseBufferRef = useRef<AudioBuffer | null>(null);

  // Timer per digitazione a 2 cifre sui tasti (es. '1' poi '2' => '12')
  const lastDigitRef = useRef<{ key: string; time: number; cellKey: string }>({
    key: '',
    time: 0,
    cellKey: '',
  });

  const currentInstrumentConfig =
    INSTRUMENT_CONFIGS.find((c) => c.id === instrument) || INSTRUMENT_CONFIGS[0];
  const currentTuning =
    currentInstrumentConfig.tunings[tuningIdx] || currentInstrumentConfig.tunings[0];
  const lines = currentTuning.lines;

  // Cambio strumento
  const handleSelectInstrument = (newInst: TabInstrumentType) => {
    stopTabPlayback();
    setInstrument(newInst);
    setTuningIdx(0);
    setSelectedCell({ mIdx: 0, lIdx: 0, sIdx: 0 });
    setIsFretPopupOpen(false);
  };

  // Imposta valore in una cella
  const setCellValue = useCallback(
    (mIdx: number, lIdx: number, sIdx: number, value: string) => {
      setMeasures((prev) =>
        prev.map((m, idx) => {
          if (idx !== mIdx) return m;
          const nextCells = { ...m.cells };
          const key = `${lIdx}_${sIdx}`;
          if (!value) {
            delete nextCells[key];
          } else {
            nextCells[key] = value;
          }
          return { ...m, cells: nextCells };
        })
      );
    },
    []
  );

  // Applica una tecnica al tasto nella cella selezionata (es. "7" + "h" -> "7h")
  const applyTechniqueToSelected = (tech: string) => {
    const { mIdx, lIdx, sIdx } = selectedCell;
    const curVal = measures[mIdx]?.cells?.[`${lIdx}_${sIdx}`] || '';
    if (tech === 'x') {
      setCellValue(mIdx, lIdx, sIdx, curVal === 'x' ? '' : 'x');
      return;
    }
    if (!curVal) {
      setCellValue(mIdx, lIdx, sIdx, tech);
    } else if (curVal.endsWith(tech)) {
      setCellValue(mIdx, lIdx, sIdx, curVal.slice(0, -tech.length));
    } else {
      setCellValue(mIdx, lIdx, sIdx, `${curVal}${tech}`);
    }
  };

  // Inserisce un numero di tasto dalla palette rapida 0..24
  const insertFretNumber = (fretNum: number) => {
    const { mIdx, lIdx, sIdx } = selectedCell;
    const curVal = measures[mIdx]?.cells?.[`${lIdx}_${sIdx}`] || '';
    // Se la cella termina con h, p, /, \ o b, concatena il secondo tasto (es. "5h" + "7" -> "5h7")
    if (/[hp/\\b]$/.test(curVal)) {
      setCellValue(mIdx, lIdx, sIdx, `${curVal}${fretNum}`);
    } else {
      setCellValue(mIdx, lIdx, sIdx, String(fretNum));
    }
    playPreviewNote(lIdx, String(fretNum));

    if (autoAdvance) {
      const maxSteps = measures[mIdx]?.stepsCount || 16;
      if (sIdx + 1 < maxSteps) {
        setSelectedCell({ mIdx, lIdx, sIdx: sIdx + 1 });
      } else if (mIdx + 1 < measures.length) {
        setSelectedCell({ mIdx: mIdx + 1, lIdx, sIdx: 0 });
      }
    }
  };

  // Inserisce un accordo completo sulla colonna selezionata (Chitarra)
  const insertQuickChord = (chord: { name: string; frets: (number | null)[] }) => {
    const { mIdx, sIdx } = selectedCell;
    setMeasures((prev) =>
      prev.map((m, idx) => {
        if (idx !== mIdx) return m;
        const nextCells = { ...m.cells };
        const nextChords = { ...m.chords, [sIdx]: chord.name };
        chord.frets.forEach((f, lineIndex) => {
          if (lineIndex < lines.length) {
            const key = `${lineIndex}_${sIdx}`;
            if (f === null) delete nextCells[key];
            else nextCells[key] = String(f);
          }
        });
        return { ...m, cells: nextCells, chords: nextChords };
      })
    );
  };

  // Click su una cella nella griglia
  const handleCellClick = (mIdx: number, lIdx: number, sIdx: number) => {
    setSelectedCell({ mIdx, lIdx, sIdx });

    // In modalità Batteria, un singolo click inserisce o cicla direttamente il simbolo!
    if (instrument === 'drums') {
      const curVal = measures[mIdx]?.cells?.[`${lIdx}_${sIdx}`] || '';
      const lineCode = lines[lIdx] || '';
      const isCymbal = ['CC', 'HH', 'RD'].includes(lineCode);
      const defaultHit = isCymbal ? 'x' : 'o';

      let nextVal = '';
      if (activeDrumSymbol === 'auto') {
        // Click 1: colpo standard (x o o), Click 2: Accento (O), Click 3: svuota
        if (!curVal) nextVal = defaultHit;
        else if (curVal === defaultHit) nextVal = 'O';
        else nextVal = '';
      } else {
        nextVal = curVal === activeDrumSymbol ? '' : activeDrumSymbol;
      }

      setCellValue(mIdx, lIdx, sIdx, nextVal);
      if (nextVal) {
        playPreviewNote(lIdx, nextVal);
      }
      return;
    }

    // In modalità Chitarra o Basso, apre subito la finestrella coi numeri dei tasti (0-24)
    setIsFretPopupOpen(true);
  };

  // Gestione tastiera fisica sulla griglia (0-9 per tasti a 1 o 2 cifre, frecce, h/p/b/x, Canc)
  const handleGridKeyDown = (e: React.KeyboardEvent) => {
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    const { mIdx, lIdx, sIdx } = selectedCell;
    const currentMeasure = measures[mIdx];
    if (!currentMeasure) return;
    const stepsCount = currentMeasure.stepsCount || 16;

    if (e.key === 'ArrowRight') {
      e.preventDefault();
      if (sIdx + 1 < stepsCount) {
        setSelectedCell({ mIdx, lIdx, sIdx: sIdx + 1 });
      } else if (mIdx + 1 < measures.length) {
        setSelectedCell({ mIdx: mIdx + 1, lIdx, sIdx: 0 });
      }
      return;
    }
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      if (sIdx > 0) {
        setSelectedCell({ mIdx, lIdx, sIdx: sIdx - 1 });
      } else if (mIdx > 0) {
        const prevSteps = measures[mIdx - 1]?.stepsCount || 16;
        setSelectedCell({ mIdx: mIdx - 1, lIdx, sIdx: prevSteps - 1 });
      }
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedCell({ mIdx, lIdx: Math.max(0, lIdx - 1), sIdx });
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedCell({ mIdx, lIdx: Math.min(lines.length - 1, lIdx + 1), sIdx });
      return;
    }
    if (e.key === 'Backspace' || e.key === 'Delete' || e.key === ' ') {
      e.preventDefault();
      setCellValue(mIdx, lIdx, sIdx, '');
      return;
    }

    if (instrument === 'drums') {
      const allowedDrumKeys = ['o', 'O', 'x', 'X', 'g', 'f', 'd', 'r'];
      if (allowedDrumKeys.includes(e.key)) {
        e.preventDefault();
        const sym = e.key === 'X' ? 'O' : e.key;
        setCellValue(mIdx, lIdx, sIdx, sym);
        playPreviewNote(lIdx, sym);
      }
      return;
    }

    // Chitarra & Basso: numeri 0-9 (con supporto rapido 10..24)
    if (/^[0-9]$/.test(e.key)) {
      e.preventDefault();
      const now = performance.now();
      const cellKey = `${mIdx}_${lIdx}_${sIdx}`;
      const curVal = currentMeasure.cells?.[`${lIdx}_${sIdx}`] || '';

      if (/[hp/\\b]$/.test(curVal)) {
        const combined = `${curVal}${e.key}`;
        setCellValue(mIdx, lIdx, sIdx, combined);
        playPreviewNote(lIdx, e.key);
        return;
      }

      let nextVal = e.key;
      if (
        lastDigitRef.current.cellKey === cellKey &&
        now - lastDigitRef.current.time < 650 &&
        (lastDigitRef.current.key === '1' || lastDigitRef.current.key === '2')
      ) {
        const candidate = Number(`${lastDigitRef.current.key}${e.key}`);
        if (candidate <= 24) {
          nextVal = String(candidate);
        }
      }

      lastDigitRef.current = { key: e.key, time: now, cellKey };
      setCellValue(mIdx, lIdx, sIdx, nextVal);
      playPreviewNote(lIdx, nextVal);

      if (autoAdvance && Number(nextVal) > 2) {
        if (sIdx + 1 < stepsCount) {
          setSelectedCell({ mIdx, lIdx, sIdx: sIdx + 1 });
        }
      }
      return;
    }

    // Tecniche da tastiera: h, p, /, \, b, ~, x
    if (['h', 'p', '/', '\\', 'b', '~', 'x'].includes(e.key.toLowerCase())) {
      e.preventDefault();
      applyTechniqueToSelected(e.key.toLowerCase());
    }
  };

  // Sintetizzatore Audio WebAudio Realistico (Multi-Layer Acoustic Drum Kit & Plucked Strings)
  const getAudioContext = () => {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContextClass();
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  };

  // Genera e memorizza un buffer di rumore bianco puro per cordiera rullante, piatti e punta bacchetta
  const getNoiseBuffer = (ctx: AudioContext): AudioBuffer => {
    if (noiseBufferRef.current && noiseBufferRef.current.sampleRate === ctx.sampleRate) {
      return noiseBufferRef.current;
    }
    const bufferSize = ctx.sampleRate * 1.5; // 1.5 secondi di rumore
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    noiseBufferRef.current = buffer;
    return buffer;
  };

  const triggerSingleDrumHit = useCallback(
    (ctx: AudioContext, startTime: number, lineCode: string, sym: string, velocity = 1.0) => {
      const noiseBuf = getNoiseBuffer(ctx);
      const isAccent = sym === 'O' || sym === 'X';
      const isGhost = sym === 'g';
      const vel = Math.min(1.3, velocity * (isAccent ? 1.25 : isGhost ? 0.35 : 0.95));

      if (lineCode === 'BD') {
        // ── KICK DRUM (CASSA ACUSTICA REALISTICA: Sub Body + Beater Click + Punch) ──
        // 1. Corpo Sub-Bass della cassa
        const bodyOsc = ctx.createOscillator();
        const bodyGain = ctx.createGain();
        bodyOsc.type = 'sine';
        bodyOsc.frequency.setValueAtTime(155, startTime);
        bodyOsc.frequency.exponentialRampToValueAtTime(52, startTime + 0.038);
        bodyOsc.frequency.exponentialRampToValueAtTime(34, startTime + 0.22);

        bodyGain.gain.setValueAtTime(0.001, startTime);
        bodyGain.gain.linearRampToValueAtTime(0.95 * vel, startTime + 0.004);
        bodyGain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.26);

        // 2. Punta del battente (Beater Click transient)
        const clickOsc = ctx.createOscillator();
        const clickGain = ctx.createGain();
        clickOsc.type = 'triangle';
        clickOsc.frequency.setValueAtTime(920, startTime);
        clickOsc.frequency.exponentialRampToValueAtTime(110, startTime + 0.018);

        clickGain.gain.setValueAtTime(0.38 * vel, startTime);
        clickGain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.02);

        // 3. Air Impact Noise
        const punchNoise = ctx.createBufferSource();
        punchNoise.buffer = noiseBuf;
        const punchFilter = ctx.createBiquadFilter();
        punchFilter.type = 'lowpass';
        punchFilter.frequency.setValueAtTime(240, startTime);
        const punchGain = ctx.createGain();
        punchGain.gain.setValueAtTime(0.35 * vel, startTime);
        punchGain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.025);

        bodyOsc.connect(bodyGain).connect(ctx.destination);
        clickOsc.connect(clickGain).connect(ctx.destination);
        punchNoise.connect(punchFilter).connect(punchGain).connect(ctx.destination);

        bodyOsc.start(startTime);
        bodyOsc.stop(startTime + 0.27);
        clickOsc.start(startTime);
        clickOsc.stop(startTime + 0.022);
        punchNoise.start(startTime);
        punchNoise.stop(startTime + 0.028);
        return;
      }

      if (lineCode === 'SD') {
        // ── SNARE DRUM (RULLANTE ACUSTICO: Doppia risonanza fusto + Cordiera Metallica) ──
        // 1. Fondamentale e armonica del fusto (Shell Tone)
        const shellOsc1 = ctx.createOscillator();
        const shellOsc2 = ctx.createOscillator();
        const shellGain = ctx.createGain();

        shellOsc1.type = 'triangle';
        shellOsc1.frequency.setValueAtTime(isAccent ? 215 : 192, startTime);
        shellOsc1.frequency.exponentialRampToValueAtTime(115, startTime + 0.09);

        shellOsc2.type = 'sine';
        shellOsc2.frequency.setValueAtTime(345, startTime);
        shellOsc2.frequency.exponentialRampToValueAtTime(175, startTime + 0.065);

        shellGain.gain.setValueAtTime(0.55 * vel, startTime);
        shellGain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.11);

        // 2. Cordiera metallica (Snare Wires Noise)
        const wireNoise = ctx.createBufferSource();
        wireNoise.buffer = noiseBuf;
        const hpFilter = ctx.createBiquadFilter();
        hpFilter.type = 'highpass';
        hpFilter.frequency.setValueAtTime(850, startTime);

        const bpFilter = ctx.createBiquadFilter();
        bpFilter.type = 'peaking';
        bpFilter.frequency.setValueAtTime(2900, startTime);
        bpFilter.Q.setValueAtTime(1.0, startTime);
        bpFilter.gain.setValueAtTime(6, startTime);

        const wireGain = ctx.createGain();
        const wireDecay = isGhost ? 0.085 : isAccent ? 0.24 : 0.175;
        wireGain.gain.setValueAtTime(0.001, startTime);
        wireGain.gain.linearRampToValueAtTime(0.65 * vel, startTime + 0.003);
        wireGain.gain.exponentialRampToValueAtTime(0.001, startTime + wireDecay);

        shellOsc1.connect(shellGain);
        shellOsc2.connect(shellGain);
        shellGain.connect(ctx.destination);

        wireNoise.connect(hpFilter).connect(bpFilter).connect(wireGain).connect(ctx.destination);

        shellOsc1.start(startTime);
        shellOsc1.stop(startTime + 0.12);
        shellOsc2.start(startTime);
        shellOsc2.stop(startTime + 0.12);
        wireNoise.start(startTime);
        wireNoise.stop(startTime + wireDecay + 0.01);
        return;
      }

      if (lineCode === 'HH') {
        // ── HI-HAT (CHARLESTON CHIUSO 'x' / APERTO 'O': Cluster Metallico 6-Parziali + Sizzle) ──
        const isOpen = sym === 'O';
        const decay = isOpen ? 0.38 : 0.055;
        const metallicFreqs = [205.3, 304.4, 369.6, 522.7, 680.5, 812.0];

        const metalHp = ctx.createBiquadFilter();
        metalHp.type = 'highpass';
        metalHp.frequency.setValueAtTime(6800, startTime);

        const metalGain = ctx.createGain();
        metalGain.gain.setValueAtTime(0.001, startTime);
        metalGain.gain.linearRampToValueAtTime(0.18 * vel, startTime + 0.002);
        metalGain.gain.exponentialRampToValueAtTime(0.0008, startTime + decay);

        metallicFreqs.forEach((f) => {
          const osc = ctx.createOscillator();
          osc.type = 'square';
          osc.frequency.setValueAtTime(f, startTime);
          osc.connect(metalHp);
          osc.start(startTime);
          osc.stop(startTime + decay + 0.01);
        });

        // Sizzle Noise ad altissima frequenza per realismo acustico
        const hhNoise = ctx.createBufferSource();
        hhNoise.buffer = noiseBuf;
        const noiseBand = ctx.createBiquadFilter();
        noiseBand.type = 'bandpass';
        noiseBand.frequency.setValueAtTime(9200, startTime);
        noiseBand.Q.setValueAtTime(1.2, startTime);

        const noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(0.32 * vel, startTime);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, startTime + decay);

        metalHp.connect(metalGain).connect(ctx.destination);
        hhNoise.connect(noiseBand).connect(noiseGain).connect(ctx.destination);

        hhNoise.start(startTime);
        hhNoise.stop(startTime + decay + 0.01);
        return;
      }

      if (lineCode === 'CC') {
        // ── CRASH CYMBAL (PIATTO CRASH CON SHIMMER LUNGO) ──
        const decay = 0.92;
        const crashFreqs = [285, 412, 588, 795, 1140, 1680];

        const crashHp = ctx.createBiquadFilter();
        crashHp.type = 'highpass';
        crashHp.frequency.setValueAtTime(3400, startTime);

        const crashMetalGain = ctx.createGain();
        crashMetalGain.gain.setValueAtTime(0.16 * vel, startTime);
        crashMetalGain.gain.exponentialRampToValueAtTime(0.0005, startTime + decay);

        crashFreqs.forEach((f) => {
          const osc = ctx.createOscillator();
          osc.type = 'square';
          osc.frequency.setValueAtTime(f, startTime);
          osc.connect(crashHp);
          osc.start(startTime);
          osc.stop(startTime + decay);
        });

        const crashNoise = ctx.createBufferSource();
        crashNoise.buffer = noiseBuf;
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.setValueAtTime(5400, startTime);
        bp.Q.setValueAtTime(0.65, startTime);

        const noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(0.001, startTime);
        noiseGain.gain.linearRampToValueAtTime(0.52 * vel, startTime + 0.006);
        noiseGain.gain.exponentialRampToValueAtTime(0.0008, startTime + decay);

        crashHp.connect(crashMetalGain).connect(ctx.destination);
        crashNoise.connect(bp).connect(noiseGain).connect(ctx.destination);

        crashNoise.start(startTime);
        crashNoise.stop(startTime + decay + 0.02);
        return;
      }

      if (lineCode === 'RD') {
        // ── RIDE CYMBAL (CAMPANA + PING CRISTALLINO) ──
        const decay = 0.48;
        const bellFreqs = [845, 1340, 2180];
        const bellGain = ctx.createGain();
        bellGain.gain.setValueAtTime(0.22 * vel, startTime);
        bellGain.gain.exponentialRampToValueAtTime(0.0008, startTime + decay);

        bellFreqs.forEach((f) => {
          const osc = ctx.createOscillator();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(f, startTime);
          osc.connect(bellGain);
          osc.start(startTime);
          osc.stop(startTime + decay);
        });
        bellGain.connect(ctx.destination);

        const rideNoise = ctx.createBufferSource();
        rideNoise.buffer = noiseBuf;
        const hp = ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.setValueAtTime(5800, startTime);
        const nGain = ctx.createGain();
        nGain.gain.setValueAtTime(0.24 * vel, startTime);
        nGain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.35);

        rideNoise.connect(hp).connect(nGain).connect(ctx.destination);
        rideNoise.start(startTime);
        rideNoise.stop(startTime + 0.36);
        return;
      }

      // ── HT / MT / FT (HIGH TOM, MID TOM, FLOOR TOM / TIMPANO ACUSTICO) ──
      const tomParams =
        lineCode === 'HT'
          ? { startF: 215, endF: 122, decay: 0.22 }
          : lineCode === 'MT'
          ? { startF: 162, endF: 90, decay: 0.26 }
          : { startF: 112, endF: 58, decay: 0.32 }; // FT Timpano

      const tomOsc = ctx.createOscillator();
      const tomGain = ctx.createGain();
      tomOsc.type = 'sine';
      tomOsc.frequency.setValueAtTime(tomParams.startF, startTime);
      tomOsc.frequency.exponentialRampToValueAtTime(tomParams.endF, startTime + tomParams.decay);

      tomGain.gain.setValueAtTime(0.001, startTime);
      tomGain.gain.linearRampToValueAtTime(0.75 * vel, startTime + 0.004);
      tomGain.gain.exponentialRampToValueAtTime(0.001, startTime + tomParams.decay);

      // Attacco bacchetta sulla pelle del Tom
      const stickNoise = ctx.createBufferSource();
      stickNoise.buffer = noiseBuf;
      const stickFilter = ctx.createBiquadFilter();
      stickFilter.type = 'bandpass';
      stickFilter.frequency.setValueAtTime(1350, startTime);
      const stickGain = ctx.createGain();
      stickGain.gain.setValueAtTime(0.28 * vel, startTime);
      stickGain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.02);

      tomOsc.connect(tomGain).connect(ctx.destination);
      stickNoise.connect(stickFilter).connect(stickGain).connect(ctx.destination);

      tomOsc.start(startTime);
      tomOsc.stop(startTime + tomParams.decay + 0.01);
      stickNoise.start(startTime);
      stickNoise.stop(startTime + 0.022);
    },
    []
  );

  const playPreviewNote = useCallback(
    (lineIdx: number, val: string) => {
      try {
        const ctx = getAudioContext();
        const now = ctx.currentTime;

        if (instrument === 'drums') {
          const lineCode = lines[lineIdx] || 'SD';
          if (val === 'f') {
            // Flam: grace note leggera + colpo principale dopo 28ms
            triggerSingleDrumHit(ctx, now, lineCode, 'o', 0.45);
            triggerSingleDrumHit(ctx, now + 0.028, lineCode, 'O', 1.05);
          } else if (val === 'd') {
            // Drag / Rullo doppio: due colpi rapidi + accento
            triggerSingleDrumHit(ctx, now, lineCode, 'o', 0.55);
            triggerSingleDrumHit(ctx, now + 0.032, lineCode, 'o', 0.85);
          } else {
            triggerSingleDrumHit(ctx, now, lineCode, val || 'o', 1.0);
          }
          return;
        }

        // Chitarra o Basso: sintesi corda pizzicata con attacco di plettro e armoniche
        const fretMatch = val.match(/\d+/);
        if (!fretMatch) return;
        const fret = Math.min(24, parseInt(fretMatch[0], 10));
        const baseMidi = currentTuning.midiNotes?.[lineIdx] ?? 40;
        const midi = baseMidi + fret + capo;
        const freq = 440 * Math.pow(2, (midi - 69) / 12);

        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();

        osc1.type = instrument === 'guitar' ? 'sawtooth' : 'triangle';
        osc1.frequency.setValueAtTime(freq, now);
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(freq * 2, now); // 2ª armonica naturale

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(instrument === 'guitar' ? 3200 : 1400, now);
        filter.frequency.exponentialRampToValueAtTime(instrument === 'guitar' ? 1100 : 520, now + 0.25);

        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.32, now + 0.006);
        gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.42);

        const g2 = ctx.createGain();
        g2.gain.value = 0.25;

        osc1.connect(filter);
        osc2.connect(g2).connect(filter);
        filter.connect(gain).connect(ctx.destination);

        osc1.start(now);
        osc1.stop(now + 0.44);
        osc2.start(now);
        osc2.stop(now + 0.44);
      } catch {
        // ignore audio errors
      }
    },
    [instrument, lines, currentTuning, capo, triggerSingleDrumHit]
  );

  const stopTabPlayback = useCallback(() => {
    if (playTimerRef.current !== null) {
      window.clearInterval(playTimerRef.current);
      playTimerRef.current = null;
    }
    setIsPlayingTab(false);
    setPlayingStepKey(null);
  }, []);

  const startTabPlayback = () => {
    if (isPlayingTab) {
      stopTabPlayback();
      return;
    }

    // Costruisce la sequenza lineare di tutti gli step
    const timeline: { mIdx: number; sIdx: number; stepsCount: number }[] = [];
    measures.forEach((m, mIdx) => {
      const count = m.stepsCount || 16;
      for (let sIdx = 0; sIdx < count; sIdx++) {
        timeline.push({ mIdx, sIdx, stepsCount: count });
      }
    });
    if (timeline.length === 0) return;

    setIsPlayingTab(true);
    let cursor = 0;

    // Durata di un sedicesimo a questo BPM (4 step per quarto)
    const stepMs = Math.max(55, Math.round((60000 / bpm) / 4));

    const playStep = () => {
      const item = timeline[cursor];
      if (!item) {
        stopTabPlayback();
        return;
      }
      setPlayingStepKey(`${item.mIdx}_${item.sIdx}`);
      const m = measures[item.mIdx];
      if (m) {
        for (let lIdx = 0; lIdx < lines.length; lIdx++) {
          const val = m.cells?.[`${lIdx}_${item.sIdx}`];
          if (val) {
            playPreviewNote(lIdx, val);
          }
        }
      }
      cursor = (cursor + 1) % timeline.length;
    };

    playStep();
    playTimerRef.current = window.setInterval(playStep, stepMs);
  };

  useEffect(() => {
    return () => {
      stopTabPlayback();
    };
  }, [stopTabPlayback]);

  // Pattern Preimpostati 1-Click per iniziare subito sulla battuta attiva
  const applyQuickPatternToCurrentMeasure = (patternId: string) => {
    const mIdx = selectedCell.mIdx;
    setMeasures((prev) =>
      prev.map((m, idx) => {
        if (idx !== mIdx) return m;
        const nextCells: Record<string, string> = {};
        const steps = m.stepsCount || 16;

        if (instrument === 'drums') {
          const hhIdx = lines.indexOf('HH');
          const sdIdx = lines.indexOf('SD');
          const bdIdx = lines.indexOf('BD');
          const ccIdx = lines.indexOf('CC');
          const htIdx = lines.indexOf('HT');
          const mtIdx = lines.indexOf('MT');
          const ftIdx = lines.indexOf('FT');

          if (patternId === 'rock_8th') {
            // Groove Rock Ottavi: HH ogni 2 step, Cassa su 1 e 3 (0, 8), Rullante su 2 e 4 (4, 12)
            for (let s = 0; s < steps; s += 2) {
              if (hhIdx >= 0) nextCells[`${hhIdx}_${s}`] = 'x';
            }
            if (ccIdx >= 0) nextCells[`${ccIdx}_0`] = 'x';
            if (bdIdx >= 0) {
              nextCells[`${bdIdx}_0`] = 'o';
              nextCells[`${bdIdx}_8`] = 'o';
              nextCells[`${bdIdx}_10`] = 'o';
            }
            if (sdIdx >= 0) {
              nextCells[`${sdIdx}_4`] = 'o';
              nextCells[`${sdIdx}_12`] = 'o';
            }
          } else if (patternId === 'disco_funk') {
            // Groove Funk 16esimi con ghost notes
            for (let s = 0; s < steps; s += 2) {
              if (hhIdx >= 0) nextCells[`${hhIdx}_${s}`] = s === 14 ? 'O' : 'x';
            }
            if (bdIdx >= 0) {
              nextCells[`${bdIdx}_0`] = 'o';
              nextCells[`${bdIdx}_6`] = 'o';
              nextCells[`${bdIdx}_8`] = 'o';
            }
            if (sdIdx >= 0) {
              nextCells[`${sdIdx}_4`] = 'O';
              nextCells[`${sdIdx}_7`] = 'g';
              nextCells[`${sdIdx}_9`] = 'g';
              nextCells[`${sdIdx}_12`] = 'O';
            }
          } else if (patternId === 'tom_fill') {
            // Fill di batteria sui Tom in sedicesimi
            for (let s = 0; s < 4 && sdIdx >= 0; s++) nextCells[`${sdIdx}_${s}`] = 'o';
            for (let s = 4; s < 8 && htIdx >= 0; s++) nextCells[`${htIdx}_${s}`] = 'o';
            for (let s = 8; s < 12 && mtIdx >= 0; s++) nextCells[`${mtIdx}_${s}`] = 'o';
            for (let s = 12; s < 16 && ftIdx >= 0; s++) nextCells[`${ftIdx}_${s}`] = 'o';
            if (bdIdx >= 0) {
              nextCells[`${bdIdx}_0`] = 'o';
              nextCells[`${bdIdx}_8`] = 'o';
            }
          }
        } else if (instrument === 'guitar') {
          if (patternId === 'pentatonic_am') {
            // Scala Pentatonica La Minore (box 5° tasto)
            const seq: [number, number, string][] = [
              [5, 0, '5'],
              [5, 1, '8'],
              [4, 2, '5'],
              [4, 3, '7'],
              [3, 4, '5'],
              [3, 5, '7'],
              [2, 6, '5'],
              [2, 7, '7'],
              [1, 8, '5'],
              [1, 9, '8'],
              [0, 10, '5'],
              [0, 11, '8'],
            ];
            seq.forEach(([l, s, v]) => {
              if (s < steps) nextCells[`${l}_${s}`] = v;
            });
          } else if (patternId === 'power_riff') {
            // Riff Rock Power Chords E5 - G5 - A5
            const eLow = lines.length - 1;
            const aStr = lines.length - 2;
            const dStr = lines.length - 3;
            [0, 2, 4].forEach((s) => {
              nextCells[`${eLow}_${s}`] = '0';
              nextCells[`${aStr}_${s}`] = '2';
            });
            [6, 8].forEach((s) => {
              nextCells[`${eLow}_${s}`] = '3';
              nextCells[`${aStr}_${s}`] = '5';
            });
            [10, 12, 14].forEach((s) => {
              nextCells[`${aStr}_${s}`] = '0';
              nextCells[`${dStr}_${s}`] = '2';
            });
          }
        } else {
          // Basso 4 / 5 corde
          const eStr = instrument === 'bass5' ? 3 : 3;
          const aStr = 2;
          const dStr = 1;
          if (patternId === 'bass_groove') {
            [0, 2, 4, 6].forEach((s) => (nextCells[`${eStr}_${s}`] = '0'));
            nextCells[`${eStr}_8`] = '3';
            nextCells[`${eStr}_10`] = '3';
            nextCells[`${aStr}_12`] = '0';
            nextCells[`${dStr}_14`] = '2';
          }
        }

        return { ...m, cells: nextCells };
      })
    );
  };

  // Gestione Battute (Aggiungi, Duplica, Svuota, Elimina)
  const handleAddMeasure = () => {
    setMeasures((prev) => [
      ...prev,
      createEmptyMeasure(defaultStepsPerMeasure, prev.length),
    ]);
  };

  const handleDuplicateMeasure = (mIdx: number) => {
    setMeasures((prev) => {
      const target = prev[mIdx];
      if (!target) return prev;
      const copy: TabMeasure = {
        ...target,
        id: `m-${Date.now()}-copy-${Math.random().toString(36).slice(2, 6)}`,
        chords: { ...target.chords },
        cells: { ...target.cells },
      };
      const next = [...prev];
      next.splice(mIdx + 1, 0, copy);
      return next;
    });
  };

  const handleClearMeasure = (mIdx: number) => {
    setMeasures((prev) =>
      prev.map((m, idx) => (idx === mIdx ? { ...m, cells: {}, chords: {} } : m))
    );
  };

  const handleDeleteMeasure = (mIdx: number) => {
    if (measures.length <= 1) {
      handleClearMeasure(0);
      return;
    }
    setMeasures((prev) => prev.filter((_, idx) => idx !== mIdx));
    setSelectedCell((prev) => ({
      ...prev,
      mIdx: Math.max(0, Math.min(measures.length - 2, prev.mIdx)),
    }));
  };

  const handleSetMeasureSection = (mIdx: number, sectionLabel: string) => {
    setMeasures((prev) =>
      prev.map((m, idx) =>
        idx === mIdx
          ? { ...m, sectionLabel: m.sectionLabel === sectionLabel ? undefined : sectionLabel }
          : m
      )
    );
  };

  const handleToggleMeasureRepeat = (mIdx: number, field: 'repeatStart' | 'repeatEnd') => {
    setMeasures((prev) =>
      prev.map((m, idx) => (idx === mIdx ? { ...m, [field]: !m[field] } : m))
    );
  };

  const handleChangeMeasureSteps = (mIdx: number, newSteps: number) => {
    setMeasures((prev) =>
      prev.map((m, idx) => (idx === mIdx ? { ...m, stepsCount: newSteps } : m))
    );
  };

  const handleSetStepChord = (mIdx: number, sIdx: number, chordName: string) => {
    setMeasures((prev) =>
      prev.map((m, idx) => {
        if (idx !== mIdx) return m;
        const nextChords = { ...m.chords };
        if (!chordName.trim()) delete nextChords[sIdx];
        else nextChords[sIdx] = chordName.trim();
        return { ...m, chords: nextChords };
      })
    );
  };

  // Costruisce il documento completo per salvataggio o esportazione PDF
  const buildCurrentDocument = (forceNewId = false): TabSheetDocument => ({
    id: forceNewId ? `tab-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` : currentDocId,
    title: title.trim() || `Esercizio ${currentInstrumentConfig.shortLabel.replace(/^[^\s]+\s/, '')}`,
    artistOrStudent: artistOrStudent.trim(),
    teacherName: teacherName.trim(),
    instrument,
    tuningLabel: currentTuning.label,
    lines,
    bpm,
    timeSignature,
    capo,
    notes,
    measures,
    updatedAt: new Date().toISOString(),
  });

  // Salva nella libreria (locale + database Supabase)
  const handleSaveToLibrary = () => {
    const doc = buildCurrentDocument(false);
    const saved = tabLibraryService.saveTab(doc);
    setCurrentDocId(saved.id);
    setIsSavedBanner(true);
    setIsLibraryOpen(true);
    setTimeout(() => setIsSavedBanner(false), 2500);
  };

  // Crea una nuova partitura pulita
  const handleNewBlankScore = () => {
    stopTabPlayback();
    setCurrentDocId(`tab-${Date.now()}`);
    setTitle('');
    setArtistOrStudent('');
    setNotes('');
    setMeasures([createEmptyMeasure(defaultStepsPerMeasure, 0), createEmptyMeasure(defaultStepsPerMeasure, 1)]);
    setSelectedCell({ mIdx: 0, lIdx: 0, sIdx: 0 });
  };

  const handleLoadFromLibrary = (doc: TabSheetDocument) => {
    stopTabPlayback();
    setCurrentDocId(doc.id);
    setInstrument(doc.instrument);
    const instCfg = INSTRUMENT_CONFIGS.find((c) => c.id === doc.instrument);
    const tIdx = instCfg?.tunings.findIndex((t) => t.label === doc.tuningLabel) ?? 0;
    setTuningIdx(Math.max(0, tIdx));
    setTitle(doc.title);
    setArtistOrStudent(doc.artistOrStudent);
    setTeacherName(doc.teacherName);
    setBpm(doc.bpm);
    setBpmInput(String(doc.bpm));
    setTimeSignature(doc.timeSignature);
    setCapo(doc.capo || 0);
    setCapoInput(String(doc.capo || 0));
    setNotes(doc.notes || '');
    setMeasures(doc.measures);
    setSelectedCell({ mIdx: 0, lIdx: 0, sIdx: 0 });
  };

  const handleDuplicateSavedTab = (doc: TabSheetDocument) => {
    tabLibraryService.duplicateTab(doc);
  };

  const handleDeleteSavedTab = (doc: TabSheetDocument) => {
    if (window.confirm(`Vuoi eliminare la partitura "${doc.title}" dalla libreria?`)) {
      tabLibraryService.deleteTab(doc.id);
    }
  };

  // Scarica direttamente il PDF di una partitura salvata nella libreria con 1 click
  const handleDirectDownloadSavedTabPDF = async (doc: TabSheetDocument) => {
    setExportingLibraryId(doc.id);
    try {
      await generateTabSheetPDF(doc, studioInfo, { blankTemplate: false });
    } catch (err) {
      console.error('Errore download PDF da libreria:', err);
    } finally {
      setExportingLibraryId(null);
    }
  };

  // Esporta PDF con Logo "La musica fa..." (e salva automaticamente la partitura scritta in libreria!)
  const handleExportPDF = async (blankTemplate = false) => {
    setIsExportingPdf(true);
    try {
      const doc = buildCurrentDocument(false);
      // Se non è un foglio vuoto e contiene note scritte o un titolo, salvala automaticamente in libreria!
      if (!blankTemplate) {
        const hasWrittenNotes = doc.measures.some((m) => Object.keys(m.cells || {}).length > 0);
        if (hasWrittenNotes || title.trim().length > 0) {
          const saved = tabLibraryService.saveTab(doc);
          setCurrentDocId(saved.id);
          setIsSavedBanner(true);
          setTimeout(() => setIsSavedBanner(false), 2500);
        }
      }
      await generateTabSheetPDF(doc, studioInfo, { blankTemplate });
    } catch (err) {
      console.error('Errore generazione PDF Tab:', err);
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Lista filtrata della libreria partiture
  const filteredLibraryTabs = React.useMemo(() => {
    return savedTabs.filter((item) => {
      if (libraryInstrumentFilter !== 'all' && item.instrument !== libraryInstrumentFilter) {
        return false;
      }
      if (librarySearch.trim()) {
        const q = librarySearch.toLowerCase();
        const hay = `${item.title} ${item.artistOrStudent || ''} ${item.teacherName || ''} ${item.instrument}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [savedTabs, libraryInstrumentFilter, librarySearch]);

  const activeMeasure = measures[selectedCell.mIdx] || measures[0];
  const activeChordValue = activeMeasure?.chords?.[selectedCell.sIdx] || '';

  return (
    <div
      className="bg-white dark:bg-[#0e0e0e] rounded-2xl border border-slate-200 dark:border-yellow-500/25 shadow-xs overflow-hidden space-y-5"
      onKeyDown={handleGridKeyDown}
      tabIndex={0}
    >
      {/* ── 1. HEADER CON LOGO DELLA SALA "LA MUSICA FA..." GRANDE IN SEMI-TRASPARENZA E PULSANTI PDF ── */}
      <div className="relative px-4 sm:px-6 py-5 bg-gradient-to-b from-slate-50 to-white dark:from-[#161616] dark:to-[#0e0e0e] border-b-2 border-slate-300 dark:border-yellow-500/30 overflow-hidden">
        {/* Intestazione Centrale Grande in Semi-Trasparenza (Logo intero 100% leggibile, senza tagli laterali) */}
        <div className="flex flex-col items-center text-center mb-4">
          <div className="relative flex items-center justify-center mb-1.5 px-3 py-1 rounded-2xl bg-white/95 shadow-2xs">
            <img
              src="/logo-header.png"
              alt="La musica fa..."
              className="h-24 sm:h-28 w-auto object-contain opacity-90"
            />
          </div>
          <p
            className="text-xs italic text-slate-500 dark:text-yellow-200/70 tracking-wide"
            style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
          >
            Scuola di Musica • Sale Prova • Studio di Registrazione
          </p>
          <h3
            className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-yellow-400 tracking-tight mt-1"
            style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
          >
            {title.trim() || `Partitura & Tablatura per ${currentInstrumentConfig.label}`}
          </h3>
        </div>

        {/* Barra Azioni PDF / Audio / Salva */}
        <div className="flex flex-wrap items-center justify-center gap-2 pt-2 border-t border-slate-200/80 dark:border-neutral-800">
          <button
            type="button"
            onClick={startTabPlayback}
            className={`px-3.5 py-2 min-h-[40px] rounded-xl font-extrabold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs ${
              isPlayingTab
                ? 'bg-rose-600 hover:bg-rose-700 text-white'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
            }`}
            title="Ascolta in anteprima audio la tab o il groove di batteria"
          >
            {isPlayingTab ? (
              <>
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>Ferma Audio</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Ascolta Tab ({bpm} BPM)</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleNewBlankScore}
            className="px-3 py-2 min-h-[40px] rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-neutral-900 dark:hover:bg-neutral-800 text-slate-800 dark:text-yellow-300 border border-slate-200 dark:border-yellow-500/30 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
            title="Inizia una nuova partitura vuota"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nuova Partitura</span>
          </button>

          <button
            type="button"
            onClick={handleSaveToLibrary}
            className="px-3.5 py-2 min-h-[40px] rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-2xs cursor-pointer active:scale-95 transition-all"
            title="Salva questa partitura in memoria nella Libreria Cloud & Locale"
          >
            {isSavedBanner ? <Check className="w-3.5 h-3.5 text-emerald-800 stroke-[3]" /> : <Save className="w-3.5 h-3.5" />}
            <span>{isSavedBanner ? 'Salvata in Libreria!' : 'Salva in Libreria'}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsLibraryOpen((v) => !v)}
            className={`px-3.5 py-2 min-h-[40px] rounded-xl border font-extrabold text-xs flex items-center gap-1.5 cursor-pointer transition-all ${
              isLibraryOpen
                ? 'bg-slate-900 text-yellow-400 border-yellow-500/50'
                : 'bg-slate-100 hover:bg-slate-200 dark:bg-neutral-900 dark:hover:bg-neutral-800 text-slate-800 dark:text-yellow-300 border-slate-200 dark:border-yellow-500/30'
            }`}
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span>Libreria Partiture ({savedTabs.length})</span>
          </button>

          <button
            type="button"
            disabled={isExportingPdf}
            onClick={() => handleExportPDF(true)}
            className="px-3 py-2 min-h-[40px] rounded-xl bg-white hover:bg-slate-100 dark:bg-neutral-900 dark:hover:bg-neutral-800 text-slate-700 dark:text-yellow-200 border border-slate-300 dark:border-yellow-500/30 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
            title="Scarica un foglio A4 con righi di Tab vuoti e il logo La musica fa... per scrivere a mano"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>PDF Tab Vuota</span>
          </button>

          <button
            type="button"
            disabled={isExportingPdf}
            onClick={() => handleExportPDF(false)}
            className="px-4 py-2 min-h-[40px] rounded-xl bg-blue-600 hover:bg-blue-700 text-white dark:bg-yellow-400 dark:hover:bg-yellow-300 dark:text-black font-black text-xs flex items-center gap-1.5 shadow-sm cursor-pointer active:scale-95 transition-all"
            title="Scarica il PDF A4 della Tab con il logo ufficiale La musica fa... in alto"
          >
            <Download className="w-4 h-4 stroke-[2.5]" />
            <span>{isExportingPdf ? 'Generazione PDF...' : 'Stampa / Scarica PDF con Logo'}</span>
          </button>
        </div>
      </div>

      <div className="p-4 sm:p-6 space-y-5">
        {/* ── LIBRERIA DELLE PARTITURE SCRITTE (IN MEMORIA SUL DATABASE PRONTE DA SCARICARE E STAMPARE) ── */}
        {isLibraryOpen && (
          <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-[#141414] border-2 border-blue-200 dark:border-yellow-500/35 space-y-3.5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-neutral-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-600 dark:bg-yellow-400 text-white dark:text-black flex items-center justify-center shrink-0 shadow-2xs">
                  <FolderOpen className="w-4 h-4 stroke-[2.5]" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-900 dark:text-yellow-400">
                      Libreria Partiture &amp; Tab Salvate ({savedTabs.length})
                    </h4>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                      ☁️ Sincronizzate su Database (PC &amp; Smartphone)
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-neutral-400">
                    Ogni partitura salvata o scaricata rimane in memoria pronta per essere riaperta, ristampata o scaricata in PDF con 1 click.
                  </p>
                </div>
              </div>

              {/* Filtri Libreria: Ricerca + Filtro Strumento */}
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={librarySearch}
                  onChange={(e) => setLibrarySearch(e.target.value)}
                  placeholder="Cerca titolo, allievo, docente..."
                  className="px-3 py-1.5 rounded-xl bg-white dark:bg-neutral-950 border border-slate-300 dark:border-neutral-800 text-xs text-slate-900 dark:text-yellow-100 min-w-[180px]"
                />
                <select
                  value={libraryInstrumentFilter}
                  onChange={(e) => setLibraryInstrumentFilter(e.target.value as any)}
                  className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-neutral-950 border border-slate-300 dark:border-neutral-800 text-xs font-bold text-slate-800 dark:text-yellow-300 cursor-pointer"
                >
                  <option value="all">Tutti gli Strumenti</option>
                  <option value="guitar">🎸 Chitarra (6 Corde)</option>
                  <option value="bass4">🎸 Basso (4 Corde)</option>
                  <option value="bass5">🎸 Basso (5 Corde)</option>
                  <option value="drums">🥁 Batteria</option>
                </select>
                <button
                  type="button"
                  onClick={() => setIsLibraryOpen(false)}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-200/70 hover:bg-slate-300 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-xs font-bold text-slate-700 dark:text-neutral-300 cursor-pointer"
                >
                  Nascondi ▲
                </button>
              </div>
            </div>

            {filteredLibraryTabs.length === 0 ? (
              <div className="p-6 text-center rounded-xl bg-white dark:bg-neutral-900/60 border border-dashed border-slate-300 dark:border-neutral-800 space-y-1.5">
                <p className="text-xs font-bold text-slate-700 dark:text-yellow-300">
                  {savedTabs.length === 0
                    ? 'Nessuna partitura salvata nella libreria.'
                    : 'Nessuna partitura corrisponde alla ricerca.'}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-neutral-400">
                  Scrivi una tab o un groove qui sotto e premi &ldquo;Salva in Libreria&rdquo; o &ldquo;Stampa / Scarica PDF con Logo&rdquo;: verrà memorizzata automaticamente qui!
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {filteredLibraryTabs.map((item) => {
                  const isCurrentlyLoaded = item.id === currentDocId;
                  const instBadge =
                    item.instrument === 'drums'
                      ? '🥁 Batteria'
                      : item.instrument === 'guitar'
                      ? '🎸 Chitarra 6 Corde'
                      : item.instrument === 'bass5'
                      ? '🎸 Basso 5 Corde'
                      : '🎸 Basso 4 Corde';
                  const formattedDate = item.updatedAt
                    ? new Date(item.updatedAt).toLocaleDateString('it-IT', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : '';

                  return (
                    <div
                      key={item.id}
                      className={`p-3.5 rounded-xl border-2 transition-all flex flex-col justify-between gap-3 ${
                        isCurrentlyLoaded
                          ? 'bg-blue-50/70 dark:bg-yellow-400/10 border-blue-500 dark:border-yellow-400 shadow-xs'
                          : 'bg-white dark:bg-neutral-900 border-slate-200 dark:border-neutral-800 hover:border-blue-400 dark:hover:border-yellow-500/50'
                      }`}
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-slate-900 text-yellow-400">
                            {instBadge}
                          </span>
                          {formattedDate && (
                            <span className="text-[10px] font-mono text-slate-400 dark:text-neutral-500">
                              {formattedDate}
                            </span>
                          )}
                        </div>

                        <div
                          className="text-sm font-black text-slate-900 dark:text-white leading-snug truncate"
                          title={item.title}
                        >
                          {item.title}
                        </div>

                        <div className="text-[11px] text-slate-600 dark:text-neutral-300 space-y-0.5">
                          {item.artistOrStudent && (
                            <div className="truncate">
                              <strong>Allievo / Artista:</strong> {item.artistOrStudent}
                            </div>
                          )}
                          {item.teacherName && (
                            <div className="truncate">
                              <strong>Docente:</strong> {item.teacherName}
                            </div>
                          )}
                          <div className="text-[10px] font-semibold text-slate-500 dark:text-neutral-400 pt-0.5">
                            {item.measures?.length || 1} battute • {item.timeSignature} • {item.bpm} BPM
                          </div>
                        </div>
                      </div>

                      {/* Pulsanti Azione Diretta sulla Partitura in Libreria */}
                      <div className="flex items-center gap-1.5 pt-2 border-t border-slate-100 dark:border-neutral-800">
                        <button
                          type="button"
                          disabled={exportingLibraryId === item.id}
                          onClick={() => handleDirectDownloadSavedTabPDF(item)}
                          className="flex-1 py-2 px-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white dark:bg-yellow-400 dark:hover:bg-yellow-300 dark:text-black font-black text-[11px] flex items-center justify-center gap-1 cursor-pointer active:scale-95 transition-all shadow-2xs"
                          title="Scarica subito il PDF A4 pronto da stampare senza dover riaprire l'editor"
                        >
                          <Download className="w-3.5 h-3.5 stroke-[2.5]" />
                          <span>
                            {exportingLibraryId === item.id ? 'PDF...' : 'Scarica PDF'}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleLoadFromLibrary(item)}
                          className="py-2 px-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-slate-800 dark:text-yellow-300 border border-slate-300 dark:border-neutral-700 font-extrabold text-[11px] cursor-pointer active:scale-95"
                          title="Carica questa partitura nell'editor per modificarla o ascoltarla"
                        >
                          {isCurrentlyLoaded ? '✓ Aperta' : 'Apri / Modifica'}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDuplicateSavedTab(item)}
                          className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-slate-700 dark:text-neutral-300 border border-slate-200 dark:border-neutral-700 cursor-pointer"
                          title="Duplica partitura"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteSavedTab(item)}
                          className="p-2 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/30 dark:hover:bg-rose-950/50 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/40 cursor-pointer"
                          title="Elimina dalla libreria"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── 2. SCELTA SEPARATA DELLO STRUMENTO (CHITARRA / BASSO 4 / BASSO 5 / BATTERIA) ── */}
        <div className="space-y-2">
          <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-600 dark:text-yellow-400">
            1. Scegli lo Strumento per la Tablatura:
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {INSTRUMENT_CONFIGS.map((cfg) => {
              const active = instrument === cfg.id;
              return (
                <button
                  key={cfg.id}
                  type="button"
                  onClick={() => handleSelectInstrument(cfg.id)}
                  className={`p-3 rounded-xl border-2 text-left transition-all cursor-pointer flex items-center justify-between gap-2 ${
                    active
                      ? 'bg-blue-600 text-white border-blue-700 dark:bg-yellow-400 dark:text-black dark:border-yellow-300 shadow-md scale-[1.01]'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200 dark:bg-[#141414] dark:hover:bg-neutral-800 dark:text-yellow-100 dark:border-yellow-500/20'
                  }`}
                >
                  <div>
                    <div className="text-sm font-black leading-tight">{cfg.shortLabel}</div>
                    <div
                      className={`text-[11px] mt-0.5 font-semibold ${
                        active ? 'text-blue-100 dark:text-neutral-800' : 'text-slate-500 dark:text-neutral-400'
                      }`}
                    >
                      {cfg.tunings[0].lines.join(' - ')}
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase shrink-0 ${
                      active
                        ? 'bg-white text-blue-700 dark:bg-black dark:text-yellow-400'
                        : 'bg-slate-200 text-slate-700 dark:bg-neutral-800 dark:text-yellow-300'
                    }`}
                  >
                    {cfg.badge}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── 3. DATI INTESTAZIONE BRANO / ESERCIZIO (STAMPATI NEL PDF SOTTO IL LOGO) ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 bg-slate-50 dark:bg-[#141414] p-3.5 rounded-2xl border border-slate-200 dark:border-yellow-500/20">
          <div className="lg:col-span-2">
            <label className="block text-[11px] font-bold uppercase text-slate-500 dark:text-yellow-400/80 mb-1">
              Titolo Brano / Esercizio *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Es. Riff Smoke on the Water / Groove Lezione 1..."
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-yellow-500/30 bg-white dark:bg-neutral-950 text-xs font-bold text-slate-900 dark:text-yellow-100"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase text-slate-500 dark:text-yellow-400/80 mb-1">
              Allievo / Artista
            </label>
            <input
              type="text"
              value={artistOrStudent}
              onChange={(e) => setArtistOrStudent(e.target.value)}
              placeholder="Nome allievo o band..."
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-yellow-500/30 bg-white dark:bg-neutral-950 text-xs font-semibold text-slate-900 dark:text-yellow-100"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase text-slate-500 dark:text-yellow-400/80 mb-1">
              Docente
            </label>
            <input
              type="text"
              value={teacherName}
              onChange={(e) => setTeacherName(e.target.value)}
              placeholder="Nome insegnante..."
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-yellow-500/30 bg-white dark:bg-neutral-950 text-xs font-semibold text-slate-900 dark:text-yellow-100"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase text-slate-500 dark:text-yellow-400/80 mb-1">
              {instrument === 'drums' ? 'Configurazione Kit' : 'Accordatura'}
            </label>
            <select
              value={tuningIdx}
              onChange={(e) => setTuningIdx(Number(e.target.value))}
              className="w-full px-2.5 py-2 rounded-xl border border-slate-300 dark:border-yellow-500/30 bg-white dark:bg-neutral-950 text-xs font-bold text-slate-900 dark:text-yellow-100 cursor-pointer"
            >
              {currentInstrumentConfig.tunings.map((t, idx) => (
                <option key={t.label} value={idx}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-3 gap-1.5">
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-500 dark:text-yellow-400/80 mb-1">
                BPM
              </label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={bpmInput}
                onChange={(e) => {
                  const raw = e.target.value.replace(/[^0-9]/g, '');
                  setBpmInput(raw);
                  const num = parseInt(raw, 10);
                  if (!Number.isNaN(num) && num >= 20 && num <= 300) {
                    setBpm(num);
                  }
                }}
                onBlur={() => {
                  const num = parseInt(bpmInput, 10);
                  const validBpm = Number.isNaN(num) ? 120 : Math.max(30, Math.min(260, num));
                  setBpm(validBpm);
                  setBpmInput(String(validBpm));
                }}
                placeholder="120"
                className="w-full px-2 py-2 rounded-xl border border-slate-300 dark:border-yellow-500/30 bg-white dark:bg-neutral-950 text-xs font-mono font-bold text-center text-slate-900 dark:text-yellow-100"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-500 dark:text-yellow-400/80 mb-1">
                Tempo
              </label>
              <select
                value={timeSignature}
                onChange={(e) => setTimeSignature(e.target.value)}
                className="w-full px-1.5 py-2 rounded-xl border border-slate-300 dark:border-yellow-500/30 bg-white dark:bg-neutral-950 text-xs font-mono font-bold text-slate-900 dark:text-yellow-100 cursor-pointer"
              >
                {['4/4', '3/4', '2/4', '6/8', '12/8', '5/4', '7/8'].map((ts) => (
                  <option key={ts} value={ts}>
                    {ts}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-500 dark:text-yellow-400/80 mb-1">
                {instrument === 'drums' ? 'Steps' : 'Capo'}
              </label>
              {instrument === 'drums' ? (
                <select
                  value={defaultStepsPerMeasure}
                  onChange={(e) => setDefaultStepsPerMeasure(Number(e.target.value))}
                  className="w-full px-1 py-2 rounded-xl border border-slate-300 dark:border-yellow-500/30 bg-white dark:bg-neutral-950 text-xs font-mono font-bold text-slate-900 dark:text-yellow-100"
                >
                  <option value={8}>8 (1/8)</option>
                  <option value={12}>12 (3x)</option>
                  <option value={16}>16 (1/16)</option>
                </select>
              ) : (
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={capoInput}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/[^0-9]/g, '');
                    setCapoInput(raw);
                    const num = parseInt(raw, 10);
                    if (!Number.isNaN(num) && num >= 0 && num <= 12) {
                      setCapo(num);
                    }
                  }}
                  onBlur={() => {
                    const num = parseInt(capoInput, 10);
                    const validCapo = Number.isNaN(num) ? 0 : Math.max(0, Math.min(12, num));
                    setCapo(validCapo);
                    setCapoInput(String(validCapo));
                  }}
                  placeholder="0"
                  className="w-full px-2 py-2 rounded-xl border border-slate-300 dark:border-yellow-500/30 bg-white dark:bg-neutral-950 text-xs font-mono font-bold text-center text-slate-900 dark:text-yellow-100"
                />
              )}
            </div>
          </div>
        </div>

        {/* ── 4. PALETTE DI INSERIMENTO ULTRA-VELOCE (TASTI 0-24 / ACCORDI / SIMBOLI BATTERIA) ── */}
        <div className="bg-slate-950 dark:bg-[#080808] p-3.5 sm:p-4 rounded-2xl border border-slate-800 dark:border-yellow-500/30 space-y-3">
          {instrument !== 'drums' ? (
            <>
              {/* Barra Tasti 0..24 per Chitarra e Basso */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-extrabold text-yellow-400 uppercase tracking-wider">
                    Tastiera Rapida (Tasto 0–24):
                  </span>
                  <span className="text-[11px] text-neutral-400">
                    Cella attiva: <strong>Battuta #{selectedCell.mIdx + 1}</strong> • Corda{' '}
                    <strong className="text-yellow-300">{lines[selectedCell.lIdx]}</strong> • Step{' '}
                    <strong>{selectedCell.sIdx + 1}</strong>
                  </span>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setAutoAdvance((v) => !v)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer flex items-center gap-1 ${
                      autoAdvance
                        ? 'bg-emerald-500 text-black border-emerald-400'
                        : 'bg-neutral-900 text-neutral-300 border-neutral-700'
                    }`}
                    title="Se attivo, dopo aver cliccato un tasto il cursore avanza automaticamente allo step successivo"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                    <span>Avanzamento Auto: {autoAdvance ? 'ON' : 'OFF'}</span>
                  </button>

                  {instrument === 'guitar' && (
                    <>
                      <button
                        type="button"
                        onClick={() => applyQuickPatternToCurrentMeasure('pentatonic_am')}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-500/20 hover:bg-amber-500/30 text-yellow-300 border border-yellow-500/30 cursor-pointer"
                      >
                        ⚡ Scala Pentatonica Am
                      </button>
                      <button
                        type="button"
                        onClick={() => applyQuickPatternToCurrentMeasure('power_riff')}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-500/20 hover:bg-amber-500/30 text-yellow-300 border border-yellow-500/30 cursor-pointer"
                      >
                        ⚡ Riff Power Chords
                      </button>
                    </>
                  )}
                  {(instrument === 'bass4' || instrument === 'bass5') && (
                    <button
                      type="button"
                      onClick={() => applyQuickPatternToCurrentMeasure('bass_groove')}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-500/20 hover:bg-amber-500/30 text-yellow-300 border border-yellow-500/30 cursor-pointer"
                    >
                      ⚡ Groove Basso Rock
                    </button>
                  )}
                </div>
              </div>

              {/* Griglia bottoni tasti 0..24 */}
              <div className="flex flex-wrap gap-1">
                {Array.from({ length: 25 }, (_, fret) => {
                  const isMarker = [0, 3, 5, 7, 9, 12, 15, 17, 19, 21, 24].includes(fret);
                  return (
                    <button
                      key={fret}
                      type="button"
                      onClick={() => insertFretNumber(fret)}
                      className={`h-8 min-w-[32px] px-1.5 rounded-lg font-mono text-xs font-black border transition-all cursor-pointer active:scale-95 ${
                        fret === 0 || fret === 12 || fret === 24
                          ? 'bg-yellow-400 text-black border-yellow-300'
                          : isMarker
                          ? 'bg-neutral-800 hover:bg-neutral-700 text-yellow-300 border-yellow-500/40'
                          : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-200 border-neutral-800'
                      }`}
                    >
                      {fret}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() =>
                    setCellValue(selectedCell.mIdx, selectedCell.lIdx, selectedCell.sIdx, '')
                  }
                  className="h-8 px-2.5 rounded-lg bg-rose-600/25 hover:bg-rose-600/40 text-rose-300 border border-rose-500/40 text-xs font-bold cursor-pointer ml-auto"
                >
                  ⌫ Cancella Cella
                </button>
              </div>

              {/* Tecniche Esplicite + Accordi Rapidi 1-Click */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-neutral-800">
                <div className="flex flex-wrap items-center gap-1">
                  <span className="text-[10px] font-bold uppercase text-neutral-400 mr-1">
                    Tecniche:
                  </span>
                  {[
                    { t: 'h', label: 'h (Hammer-on)' },
                    { t: 'p', label: 'p (Pull-off)' },
                    { t: '/', label: '/ (Slide ↑)' },
                    { t: '\\', label: '\\ (Slide ↓)' },
                    { t: 'b', label: 'b (Bend)' },
                    { t: '~', label: '~ (Vibrato)' },
                    { t: 'x', label: 'x (Mute)' },
                  ].map((item) => (
                    <button
                      key={item.t}
                      type="button"
                      onClick={() => applyTechniqueToSelected(item.t)}
                      className="px-2 py-1 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-yellow-300 border border-neutral-700 text-[11px] font-mono font-bold cursor-pointer"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                {/* Sigla Accordo sopra lo step corrente */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold uppercase text-neutral-400">
                    Sigla Accordo Step #{selectedCell.sIdx + 1}:
                  </span>
                  <input
                    type="text"
                    value={activeChordValue}
                    onChange={(e) =>
                      handleSetStepChord(selectedCell.mIdx, selectedCell.sIdx, e.target.value)
                    }
                    placeholder="Es. Am, G5..."
                    className="w-24 px-2 py-1 rounded-lg bg-neutral-900 border border-yellow-500/40 text-yellow-300 text-xs font-bold"
                  />
                </div>
              </div>

              {/* Accordi Completi 1-Click per Chitarra */}
              {instrument === 'guitar' && (
                <div className="flex flex-wrap items-center gap-1 pt-1">
                  <span className="text-[10px] font-bold uppercase text-neutral-400 mr-1">
                    Inserisci Accordo 1-Click:
                  </span>
                  {GUITAR_QUICK_CHORDS.map((ch) => (
                    <button
                      key={ch.name}
                      type="button"
                      onClick={() => insertQuickChord(ch)}
                      className="px-2 py-1 rounded-lg bg-blue-600/20 hover:bg-blue-600/35 text-blue-300 dark:bg-yellow-400/15 dark:hover:bg-yellow-400/25 dark:text-yellow-300 border border-blue-500/30 dark:border-yellow-500/30 text-[11px] font-extrabold cursor-pointer"
                      title={`Inserisce tutte le note dell'accordo ${ch.name} sullo step selezionato`}
                    >
                      {ch.name}
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            /* Palette Batteria (Simboli + Groove Presets 1-Click) */
            <div className="space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-extrabold text-yellow-400 uppercase tracking-wider">
                  Simbolo Colpo Batteria (Clicca sulla griglia per inserire):
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] font-bold uppercase text-neutral-400">
                    Groove Rapidi 1-Click:
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      // Carica l'esatta sequenza di Foto 2 (Battute 1-2 Groove Ottavi, Battuta 3 Fill Timpano+Rullante, Battuta 4 [Verse 1] Groove)
                      const hhIdx = lines.indexOf('HH');
                      const sdIdx = lines.indexOf('SD');
                      const bdIdx = lines.indexOf('BD');
                      const ftIdx = lines.indexOf('FT');

                      const makeGrooveCells = () => {
                        const c: Record<string, string> = {};
                        [0, 2, 4, 6, 8, 10, 12, 14].forEach((s) => {
                          if (hhIdx >= 0) c[`${hhIdx}_${s}`] = 'x';
                        });
                        if (bdIdx >= 0) {
                          c[`${bdIdx}_0`] = 'o';
                          c[`${bdIdx}_8`] = 'o';
                          c[`${bdIdx}_10`] = 'o';
                        }
                        if (sdIdx >= 0) {
                          c[`${sdIdx}_4`] = 'o';
                          c[`${sdIdx}_12`] = 'o';
                        }
                        return c;
                      };

                      const makeBar3FillCells = () => {
                        const c: Record<string, string> = {};
                        // Primi 2 quarti: 4 ottavi HH + Cassa su 1 + Rullante su 2
                        [0, 2, 4, 6].forEach((s) => {
                          if (hhIdx >= 0) c[`${hhIdx}_${s}`] = 'x';
                        });
                        if (bdIdx >= 0) c[`${bdIdx}_0`] = 'o';
                        if (sdIdx >= 0) c[`${sdIdx}_4`] = 'o';
                        // 3° quarto: 2 ottavi su Timpano (FT)
                        if (ftIdx >= 0) {
                          c[`${ftIdx}_8`] = 'o';
                          c[`${ftIdx}_10`] = 'o';
                        }
                        // 4° quarto: semiminima su Rullante (SD)
                        if (sdIdx >= 0) c[`${sdIdx}_12`] = 'o';
                        return c;
                      };

                      setMeasures([
                        { ...createEmptyMeasure(16, 0), sectionLabel: undefined, cells: makeGrooveCells() },
                        { ...createEmptyMeasure(16, 1), sectionLabel: undefined, cells: makeGrooveCells() },
                        { ...createEmptyMeasure(16, 2), sectionLabel: undefined, cells: makeBar3FillCells() },
                        { ...createEmptyMeasure(16, 3), sectionLabel: 'Verse 1', cells: makeGrooveCells() },
                      ]);
                      setSelectedCell({ mIdx: 0, lIdx: 0, sIdx: 0 });
                    }}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-extrabold bg-emerald-500/20 hover:bg-emerald-500/35 text-emerald-300 border border-emerald-500/40 cursor-pointer"
                  >
                    ✨ Carica Partitura Foto 2 (Verse 1)
                  </button>
                  <button
                    type="button"
                    onClick={() => applyQuickPatternToCurrentMeasure('rock_8th')}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-500/20 hover:bg-amber-500/30 text-yellow-300 border border-yellow-500/30 cursor-pointer"
                  >
                    🥁 Groove Rock 8th
                  </button>
                  <button
                    type="button"
                    onClick={() => applyQuickPatternToCurrentMeasure('disco_funk')}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-500/20 hover:bg-amber-500/30 text-yellow-300 border border-yellow-500/30 cursor-pointer"
                  >
                    🥁 Funk Ghost Notes
                  </button>
                  <button
                    type="button"
                    onClick={() => applyQuickPatternToCurrentMeasure('tom_fill')}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-500/20 hover:bg-amber-500/30 text-yellow-300 border border-yellow-500/30 cursor-pointer"
                  >
                    🥁 Fill 16esimi sui Tom
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {DRUM_SYMBOLS.map((item) => {
                  const active = activeDrumSymbol === item.symbol;
                  return (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => setActiveDrumSymbol(item.symbol)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-extrabold border transition-all cursor-pointer ${
                        active
                          ? 'bg-yellow-400 text-black border-yellow-300 shadow-xs'
                          : 'bg-neutral-900 text-neutral-200 border-neutral-800 hover:border-yellow-500/40'
                      }`}
                      title={item.desc}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── 4.5 ANTEPRIMA LIVE PENTAGRAMMA DI BATTERIA A 5 LINEE (IDENTICA A FOTO 2 E AL PDF) ── */}
        {instrument === 'drums' && (
          <div className="rounded-2xl border-2 border-slate-300 dark:border-yellow-500/40 bg-white text-slate-900 p-4 sm:p-5 shadow-sm space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-md bg-slate-900 text-yellow-400 font-bold text-[11px] uppercase tracking-wider">
                  Spartito Batteria Live
                </span>
                <span
                  className="text-xs sm:text-sm font-bold text-slate-800"
                  style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
                >
                  Anteprima Notazione su Pentagramma a 5 Linee (Stile Foto 2 — Esportata nel PDF)
                </span>
              </div>
              <span className="text-[11px] text-slate-500 italic">
                Clicca sulle caselle della griglia qui sotto per aggiungere o togliere i colpi sullo spartito
              </span>
            </div>

            <div className="overflow-x-auto py-1">
              <svg
                viewBox={`0 0 ${Math.max(760, measures.length * 235 + 40)} 135`}
                className="w-full min-w-[720px] h-auto select-none"
              >
                {(() => {
                  const staffTopY = 54;
                  const space = 11; // 5 linee = 44px di altezza rigo
                  const staffHeight = 4 * space;
                  const clefW = 28;
                  const measureW = 225;
                  const totalW = clefW + measures.length * measureW;

                  return (
                    <g>
                      {/* 5 Linee Orizzontali del Pentagramma */}
                      {[0, 1, 2, 3, 4].map((l) => (
                        <line
                          key={l}
                          x1={10}
                          y1={staffTopY + l * space}
                          x2={10 + totalW}
                          y2={staffTopY + l * space}
                          stroke="#334155"
                          strokeWidth={1.1}
                        />
                      ))}

                      {/* Stanghetta iniziale + Chiave di Percussione || */}
                      <line
                        x1={10}
                        y1={staffTopY}
                        x2={10}
                        y2={staffTopY + staffHeight}
                        stroke="#0f172a"
                        strokeWidth={2}
                      />
                      <line
                        x1={19}
                        y1={staffTopY + space}
                        x2={19}
                        y2={staffTopY + 3 * space}
                        stroke="#0f172a"
                        strokeWidth={2.8}
                      />
                      <line
                        x1={25}
                        y1={staffTopY + space}
                        x2={25}
                        y2={staffTopY + 3 * space}
                        stroke="#0f172a"
                        strokeWidth={2.8}
                      />

                      {/* Disegno Battute sul Pentagramma */}
                      {measures.map((measure, mIdx) => {
                        const mStartX = 10 + clefW + mIdx * measureW;
                        const mEndX = mStartX + measureW;
                        const steps = measure.stepsCount || 16;
                        const padX = 16;
                        const stepW = (measureW - padX * 2) / steps;

                        // Raccogli i colpi attivi per ogni step
                        const stepHits = new Map<
                          number,
                          {
                            cx: number;
                            stemX: number;
                            maxY: number;
                            hits: {
                              lineCode: string;
                              val: string;
                              y: number;
                              isCross: boolean;
                              hasLedger?: boolean;
                            }[];
                          }
                        >();

                        for (let sIdx = 0; sIdx < steps; sIdx++) {
                          const cx = mStartX + padX + sIdx * stepW + stepW / 2;
                          const hits: {
                            lineCode: string;
                            val: string;
                            y: number;
                            isCross: boolean;
                            hasLedger?: boolean;
                          }[] = [];

                          for (let lIdx = 0; lIdx < lines.length; lIdx++) {
                            const val = (measure.cells?.[`${lIdx}_${sIdx}`] || '').trim();
                            if (!val) continue;
                            const lineCode = lines[lIdx];
                            const pos = getDrumStaffNotePosition(lineCode, staffTopY, space);
                            hits.push({ lineCode, val, ...pos });
                          }

                          if (hits.length > 0) {
                            const maxY = Math.max(...hits.map((h) => h.y));
                            stepHits.set(sIdx, {
                              cx,
                              stemX: cx + 4.2,
                              maxY,
                              hits,
                            });
                          }
                        }

                        const activeSteps = Array.from(stepHits.keys()).sort((a, b) => a - b);
                        const beamGroups = computeDrumBeamGroups(activeSteps, steps);
                        const beamY = staffTopY - 23;

                        return (
                          <g key={measure.id}>
                            {/* Doppia stanghetta prima di una nuova sezione (es. [Verse 1] in Foto 2) */}
                            {measure.sectionLabel && mIdx > 0 && (
                              <line
                                x1={mStartX - 4}
                                y1={staffTopY}
                                x2={mStartX - 4}
                                y2={staffTopY + staffHeight}
                                stroke="#0f172a"
                                strokeWidth={1.4}
                              />
                            )}

                            {/* Stanghetta fine battuta */}
                            <line
                              x1={mEndX}
                              y1={staffTopY}
                              x2={mEndX}
                              y2={staffTopY + staffHeight}
                              stroke="#0f172a"
                              strokeWidth={mIdx === measures.length - 1 ? 2.6 : 1.5}
                            />

                            {/* Box Etichetta Sezione [Verse 1] sopra la trave */}
                            {measure.sectionLabel && (
                              <g>
                                <rect
                                  x={mStartX + 4}
                                  y={4}
                                  width={Math.max(46, measure.sectionLabel.length * 7.5 + 12)}
                                  height={18}
                                  fill="#ffffff"
                                  stroke="#475569"
                                  strokeWidth={1.2}
                                />
                                <text
                                  x={
                                    mStartX +
                                    4 +
                                    Math.max(46, measure.sectionLabel.length * 7.5 + 12) / 2
                                  }
                                  y={16.5}
                                  textAnchor="middle"
                                  fill="#0f172a"
                                  fontSize={11.5}
                                  fontFamily='Georgia, "Times New Roman", serif'
                                >
                                  {measure.sectionLabel}
                                </text>
                              </g>
                            )}

                            {/* Teste delle Note (× per Charleston/Piatti, Ovale pieno inclinato per Cassa/Rullante/Tom) */}
                            {Array.from(stepHits.entries()).map(([sIdx, info]) => {
                              const isPlayingCol = playingStepKey === `${mIdx}_${sIdx}`;
                              return (
                                <g key={sIdx}>
                                  {isPlayingCol && (
                                    <rect
                                      x={info.cx - 8}
                                      y={beamY - 4}
                                      width={16}
                                      height={staffHeight + 34}
                                      rx={4}
                                      fill="rgba(16, 185, 129, 0.22)"
                                    />
                                  )}
                                  {info.hits.map((h, hIdx) =>
                                    h.isCross ? (
                                      <g key={hIdx}>
                                        {h.hasLedger && (
                                          <line
                                            x1={info.cx - 6}
                                            y1={h.y}
                                            x2={info.cx + 6}
                                            y2={h.y}
                                            stroke="#0f172a"
                                            strokeWidth={1.3}
                                          />
                                        )}
                                        <line
                                          x1={info.cx - 4.2}
                                          y1={h.y - 4.2}
                                          x2={info.cx + 4.2}
                                          y2={h.y + 4.2}
                                          stroke="#0f172a"
                                          strokeWidth={1.7}
                                        />
                                        <line
                                          x1={info.cx - 4.2}
                                          y1={h.y + 4.2}
                                          x2={info.cx + 4.2}
                                          y2={h.y - 4.2}
                                          stroke="#0f172a"
                                          strokeWidth={1.7}
                                        />
                                        {h.val === 'O' && (
                                          <circle
                                            cx={info.cx}
                                            cy={h.y - 8}
                                            r={2.8}
                                            fill="none"
                                            stroke="#0f172a"
                                            strokeWidth={1.2}
                                          />
                                        )}
                                      </g>
                                    ) : (
                                      <g key={hIdx}>
                                        <ellipse
                                          cx={info.cx}
                                          cy={h.y}
                                          rx={5.1}
                                          ry={3.6}
                                          transform={`rotate(-18 ${info.cx} ${h.y})`}
                                          fill="#0f172a"
                                        />
                                        {h.val === 'g' && (
                                          <text
                                            x={info.cx}
                                            y={h.y + 3.5}
                                            textAnchor="middle"
                                            fontSize={11}
                                            fill="#475569"
                                          >
                                            ( &nbsp;&nbsp; )
                                          </text>
                                        )}
                                      </g>
                                    )
                                  )}
                                </g>
                              );
                            })}

                            {/* Gambette Verticali (Stems) e Travi Orizzontali Spesse (Beams) */}
                            {beamGroups.map((group, gIdx) => {
                              const firstInfo = stepHits.get(group[0])!;
                              const lastInfo = stepHits.get(group[group.length - 1])!;
                              return (
                                <g key={gIdx}>
                                  {group.map((sIdx) => {
                                    const info = stepHits.get(sIdx);
                                    if (!info) return null;
                                    return (
                                      <line
                                        key={sIdx}
                                        x1={info.stemX}
                                        y1={info.maxY}
                                        x2={info.stemX}
                                        y2={beamY}
                                        stroke="#0f172a"
                                        strokeWidth={1.35}
                                      />
                                    );
                                  })}

                                  {/* Trave Orizzontale Primaria (Ottavi) */}
                                  {group.length >= 2 && (
                                    <>
                                      <rect
                                        x={firstInfo.stemX - 0.6}
                                        y={beamY}
                                        width={lastInfo.stemX - firstInfo.stemX + 1.2}
                                        height={4.6}
                                        fill="#0f172a"
                                      />
                                      {/* Trave Secondaria (Sedicesimi) */}
                                      {steps === 16 &&
                                        group.map((curStep, i) => {
                                          const nextStep = group[i + 1];
                                          const prevStep = group[i - 1];
                                          const curInfo = stepHits.get(curStep)!;
                                          const isCloseNext =
                                            nextStep !== undefined && nextStep - curStep === 1;
                                          const isClosePrev =
                                            prevStep !== undefined && curStep - prevStep === 1;
                                          if (isCloseNext) {
                                            const nextInfo = stepHits.get(nextStep)!;
                                            return (
                                              <rect
                                                key={curStep}
                                                x={curInfo.stemX - 0.4}
                                                y={beamY + 6.8}
                                                width={nextInfo.stemX - curInfo.stemX + 0.8}
                                                height={3.8}
                                                fill="#0f172a"
                                              />
                                            );
                                          }
                                          if (curStep % 2 === 1 && !isClosePrev) {
                                            return (
                                              <rect
                                                key={curStep}
                                                x={curInfo.stemX - 9}
                                                y={beamY + 6.8}
                                                width={9.5}
                                                height={3.8}
                                                fill="#0f172a"
                                              />
                                            );
                                          }
                                          return null;
                                        })}
                                    </>
                                  )}
                                </g>
                              );
                            })}
                          </g>
                        );
                      })}
                    </g>
                  );
                })()}
              </svg>
            </div>
          </div>
        )}

        {/* ── 5. GRIGLIA INTERATTIVA DELLE BATTUTE (TAB EDITOR) ── */}
        <div className="space-y-4">
          {measures.map((measure, mIdx) => {
            const steps = measure.stepsCount || 16;
            const isCurrentMeasure = selectedCell.mIdx === mIdx;

            return (
              <div
                key={measure.id}
                className={`rounded-2xl border-2 transition-all overflow-hidden ${
                  isCurrentMeasure
                    ? 'border-blue-500 dark:border-yellow-400 bg-white dark:bg-[#111111] shadow-sm'
                    : 'border-slate-200 dark:border-neutral-800 bg-slate-50/40 dark:bg-[#0c0c0c]'
                }`}
              >
                {/* Barra di Controllo della Singola Battuta */}
                <div className="px-3.5 py-2 bg-slate-100 dark:bg-[#161616] border-b border-slate-200 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2.5 py-0.5 rounded-lg bg-slate-900 text-yellow-400 font-mono font-black text-xs">
                      Battuta #{mIdx + 1}
                    </span>

                    {/* Selettore Sezione Rapida (Intro, Strofa, Ritornello, Solo...) */}
                    <div className="flex items-center gap-1 flex-wrap">
                      {SECTION_PRESETS.map((sec) => {
                        const active = measure.sectionLabel === sec;
                        return (
                          <button
                            key={sec}
                            type="button"
                            onClick={() => handleSetMeasureSection(mIdx, sec)}
                            className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase transition-all cursor-pointer ${
                              active
                                ? 'bg-amber-400 text-slate-950 shadow-2xs'
                                : 'bg-white dark:bg-neutral-900 text-slate-600 dark:text-neutral-400 border border-slate-200 dark:border-neutral-800 hover:border-amber-400'
                            }`}
                          >
                            {sec}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Azioni Battuta: Ritornello, Suddivisione Steps, Duplica, Svuota, Elimina */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => handleToggleMeasureRepeat(mIdx, 'repeatStart')}
                      className={`px-2 py-1 rounded-lg text-[11px] font-mono font-black border cursor-pointer ${
                        measure.repeatStart
                          ? 'bg-blue-600 text-white border-blue-600 dark:bg-yellow-400 dark:text-black'
                          : 'bg-white dark:bg-neutral-900 text-slate-600 dark:text-neutral-400 border-slate-200 dark:border-neutral-800'
                      }`}
                      title="Inizio Ritornello ||:"
                    >
                      ||:
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleMeasureRepeat(mIdx, 'repeatEnd')}
                      className={`px-2 py-1 rounded-lg text-[11px] font-mono font-black border cursor-pointer ${
                        measure.repeatEnd
                          ? 'bg-blue-600 text-white border-blue-600 dark:bg-yellow-400 dark:text-black'
                          : 'bg-white dark:bg-neutral-900 text-slate-600 dark:text-neutral-400 border-slate-200 dark:border-neutral-800'
                      }`}
                      title="Fine Ritornello :||"
                    >
                      :||
                    </button>

                    <select
                      value={steps}
                      onChange={(e) => handleChangeMeasureSteps(mIdx, Number(e.target.value))}
                      className="px-2 py-1 rounded-lg bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 text-[11px] font-bold text-slate-700 dark:text-yellow-300 cursor-pointer"
                      title="Suddivisione colonne della battuta"
                    >
                      <option value={8}>8 Colonne (Ottavi)</option>
                      <option value={12}>12 Colonne (Terzine)</option>
                      <option value={16}>16 Colonne (Sedicesimi)</option>
                    </select>

                    <button
                      type="button"
                      onClick={() => handleDuplicateMeasure(mIdx)}
                      className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-200 dark:bg-neutral-900 dark:hover:bg-neutral-800 text-slate-700 dark:text-yellow-300 border border-slate-200 dark:border-neutral-800 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                      title="Duplica questa battuta subito dopo"
                    >
                      <Copy className="w-3 h-3" />
                      <span>Duplica</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleClearMeasure(mIdx)}
                      className="px-2 py-1 rounded-lg bg-white hover:bg-slate-200 dark:bg-neutral-900 dark:hover:bg-neutral-800 text-slate-600 dark:text-neutral-400 border border-slate-200 dark:border-neutral-800 text-[11px] font-bold cursor-pointer"
                      title="Svuota tutte le note di questa battuta"
                    >
                      <RotateCcw className="w-3 h-3" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteMeasure(mIdx)}
                      className="px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/30 dark:hover:bg-rose-950/50 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/50 text-[11px] font-bold cursor-pointer"
                      title="Elimina battuta"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Tabella Corde / Linee x Steps */}
                <div className="p-3 overflow-x-auto">
                  <div className="min-w-[640px]">
                    {/* Riga Numerazione Steps & Accordi */}
                    <div
                      className="grid items-center gap-1 mb-1"
                      style={{
                        gridTemplateColumns: `56px repeat(${steps}, minmax(32px, 1fr))`,
                      }}
                    >
                      <div className="text-[10px] font-extrabold uppercase text-slate-400 dark:text-neutral-500 text-center">
                        Beat
                      </div>
                      {Array.from({ length: steps }, (_, sIdx) => {
                        const isBeatStart = sIdx % 4 === 0;
                        const beatNumber = Math.floor(sIdx / 4) + 1;
                        const chord = measure.chords?.[sIdx];
                        const isPlayingCol = playingStepKey === `${mIdx}_${sIdx}`;

                        return (
                          <div key={sIdx} className="text-center">
                            {chord ? (
                              <span className="inline-block px-1.5 py-0.2 rounded bg-blue-100 text-blue-800 dark:bg-yellow-400/20 dark:text-yellow-300 font-extrabold text-[10px]">
                                {chord}
                              </span>
                            ) : (
                              <span
                                className={`text-[10px] font-mono font-bold ${
                                  isPlayingCol
                                    ? 'text-emerald-500 font-black'
                                    : isBeatStart
                                    ? 'text-slate-800 dark:text-yellow-400 font-black'
                                    : 'text-slate-400 dark:text-neutral-600'
                                }`}
                              >
                                {isBeatStart ? `${beatNumber}•` : '·'}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Righe delle Corde o Pezzi della Batteria */}
                    <div className="space-y-1">
                      {lines.map((lineName, lIdx) => (
                        <div
                          key={`${lineName}-${lIdx}`}
                          className="grid items-center gap-1 relative"
                          style={{
                            gridTemplateColumns: `56px repeat(${steps}, minmax(32px, 1fr))`,
                          }}
                        >
                          {/* Etichetta Corda / Pezzo Batteria a sinistra (cliccabile per ascoltare il suono!) */}
                          <button
                            type="button"
                            onClick={() =>
                              playPreviewNote(
                                lIdx,
                                instrument === 'drums'
                                  ? ['CC', 'HH', 'RD'].includes(lineName)
                                    ? 'x'
                                    : 'o'
                                  : '0'
                              )
                            }
                            className="h-8 rounded-lg bg-slate-900 hover:bg-slate-800 text-yellow-400 font-mono font-black text-xs flex items-center justify-center border border-yellow-500/30 shadow-2xs select-none cursor-pointer active:scale-95 transition-all"
                            title={
                              instrument === 'drums'
                                ? `🔊 Clicca per ascoltare: ${DRUM_LINE_DESCRIPTIONS[lineName] || lineName}`
                                : `🔊 Clicca per ascoltare la ${lIdx + 1}ª Corda a vuoto (${lineName})`
                            }
                          >
                            {lineName}
                          </button>

                          {/* Celle degli step */}
                          {Array.from({ length: steps }, (_, sIdx) => {
                            const val = measure.cells?.[`${lIdx}_${sIdx}`] || '';
                            const isSelected =
                              selectedCell.mIdx === mIdx &&
                              selectedCell.lIdx === lIdx &&
                              selectedCell.sIdx === sIdx;
                            const isBeatStart = sIdx % 4 === 0;
                            const isPlayingCol = playingStepKey === `${mIdx}_${sIdx}`;

                            return (
                              <button
                                key={sIdx}
                                type="button"
                                onClick={() => handleCellClick(mIdx, lIdx, sIdx)}
                                className={`relative h-8 rounded-lg font-mono text-xs font-black flex items-center justify-center transition-all cursor-pointer select-none ${
                                  isPlayingCol
                                    ? 'ring-2 ring-emerald-400 bg-emerald-500/20 text-emerald-300'
                                    : isSelected
                                    ? 'bg-blue-600 text-white dark:bg-yellow-400 dark:text-black ring-2 ring-blue-400 dark:ring-yellow-300 z-10 scale-105 shadow-xs'
                                    : val
                                    ? 'bg-amber-100 text-slate-950 border-2 border-amber-400 dark:bg-yellow-400/25 dark:text-yellow-200 dark:border-yellow-400/70'
                                    : isBeatStart
                                    ? 'bg-slate-100 hover:bg-slate-200/80 dark:bg-neutral-900 dark:hover:bg-neutral-800 border border-slate-300 dark:border-neutral-700 text-slate-400'
                                    : 'bg-white hover:bg-slate-100 dark:bg-[#151515] dark:hover:bg-neutral-800 border border-slate-200 dark:border-neutral-800/80 text-slate-300'
                                }`}
                              >
                                {/* Linea orizzontale della corda sullo sfondo */}
                                {!val && !isSelected && (
                                  <span className="w-full h-px bg-slate-300 dark:bg-neutral-700 pointer-events-none" />
                                )}
                                {(val || isSelected) && (
                                  <span className="relative z-10">{val || '•'}</span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Barra Azioni Aggiungi Battuta + Note Didattiche */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start pt-1">
          <div className="lg:col-span-4 flex flex-col sm:flex-row lg:flex-col gap-2">
            <button
              type="button"
              onClick={handleAddMeasure}
              className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white dark:bg-yellow-400 dark:hover:bg-yellow-300 dark:text-black font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm cursor-pointer active:scale-95 transition-all"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Aggiungi Nuova Battuta (#{measures.length + 1})</span>
            </button>

            <button
              type="button"
              onClick={() => handleDuplicateMeasure(measures.length - 1)}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-neutral-900 dark:hover:bg-neutral-800 text-slate-800 dark:text-yellow-300 border border-slate-300 dark:border-yellow-500/30 font-extrabold text-xs flex items-center justify-center gap-2 cursor-pointer"
            >
              <Repeat className="w-3.5 h-3.5" />
              <span>Duplica Ultima Battuta</span>
            </button>
          </div>

          <div className="lg:col-span-8">
            <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-600 dark:text-yellow-400 mb-1">
              Note Didattiche, Consigli d&apos;Esecuzione &amp; Struttura Brano (Stampate nel PDF):
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Es. Pennata alternata costante in sedicesimi, attenzione al palm muting sulla 6ª corda..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-yellow-500/30 bg-slate-50 dark:bg-neutral-950 text-xs text-slate-900 dark:text-yellow-100"
            />
          </div>
        </div>

        {/* ── 6. LEGENDA COMPLETA & GUIDA RAPIDA ALLA CREAZIONE DELLA TAB ── */}
        <div className="rounded-2xl border border-slate-200 dark:border-yellow-500/30 bg-slate-50 dark:bg-[#121212] overflow-hidden">
          <button
            type="button"
            onClick={() => setIsLegendOpen((v) => !v)}
            className="w-full px-4 py-3 bg-slate-100 dark:bg-[#181818] border-b border-slate-200 dark:border-yellow-500/20 flex items-center justify-between text-left cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-600 dark:text-yellow-400 shrink-0" />
              <span className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-800 dark:text-yellow-400">
                Guida Rapida &amp; Legenda Simboli (Come creare la Tab e ascoltare i suoni)
              </span>
            </div>
            <span className="text-xs font-bold text-blue-600 dark:text-yellow-300">
              {isLegendOpen ? 'Nascondi ▲' : 'Mostra Guida & Legenda ▼'}
            </span>
          </button>

          {isLegendOpen && (
            <div className="p-4 space-y-4 text-xs">
              {/* 3 Passi Rapidi per usare il Creatore Tab */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 space-y-1">
                  <div className="font-black text-blue-700 dark:text-yellow-400 uppercase">
                    1. Inserimento Note &amp; Tasti
                  </div>
                  <p className="text-slate-600 dark:text-neutral-300 leading-relaxed">
                    <strong>Chitarra/Basso:</strong> clicca una casella e digita il numero del tasto da tastiera (da <strong>0</strong> a <strong>24</strong>; se premi <code>1</code> e subito <code>2</code> scrive <code>12</code>) oppure clicca i bottoni <strong>0–24</strong> in alto. Usa le frecce <code>← → ↑ ↓</code> per spostarti e <code>Spazio</code> o <code>Canc</code> per cancellare.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 space-y-1">
                  <div className="font-black text-blue-700 dark:text-yellow-400 uppercase">
                    2. Inserimento Batteria 1-Click
                  </div>
                  <p className="text-slate-600 dark:text-neutral-300 leading-relaxed">
                    <strong>Batteria:</strong> con <strong>⚡ Auto (x/o)</strong> attivo, basta un singolo click sulla griglia: inserisce <code>x</code> sui piatti (Charleston/Crash/Ride) e <code>o</code> sui tamburi (Cassa/Rullante/Tom). Clicca una seconda volta per l&apos;accento <code>O</code> (o Charleston aperto) e una terza volta per cancellare.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 space-y-1">
                  <div className="font-black text-blue-700 dark:text-yellow-400 uppercase">
                    3. Ascolto Suoni &amp; Stampa PDF
                  </div>
                  <p className="text-slate-600 dark:text-neutral-300 leading-relaxed">
                    Clicca sulle sigle a sinistra del rigo (es. <code>BD</code>, <code>SD</code>, <code>HH</code> o <code>e, B, G...</code>) per provare il suono di ogni pezzo/corda. Premi <strong>Ascolta Tab</strong> per riprodurre tutto a tempo, oppure <strong>Stampa / Scarica PDF con Logo</strong> per ottenere lo spartito A4.
                  </p>
                </div>
              </div>

              {/* Legenda Dettagliata Batteria (Pezzi Cliccabili + Simboli) & Chitarra/Basso */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {/* Colonna 1: Legenda Batteria con Test Suono 1-Click */}
                <div className="p-3.5 rounded-xl bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-slate-900 dark:text-yellow-400 uppercase">
                      🥁 Legenda Batteria (Clicca un pezzo per sentirne il suono)
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                    {[
                      { code: 'BD', name: 'Kick / Cassa', sym: 'o' },
                      { code: 'SD', name: 'Snare / Rullante', sym: 'o' },
                      { code: 'HH', name: 'Hi-Hat Chiuso', sym: 'x' },
                      { code: 'HH', name: 'Hi-Hat Aperto', sym: 'O' },
                      { code: 'CC', name: 'Crash Cymbal', sym: 'x' },
                      { code: 'RD', name: 'Ride Cymbal', sym: 'x' },
                      { code: 'HT', name: 'High Tom (1)', sym: 'o' },
                      { code: 'FT', name: 'Floor Tom (Timp.)', sym: 'o' },
                    ].map((d, i) => (
                      <button
                        key={`${d.code}-${d.name}-${i}`}
                        type="button"
                        onClick={() => {
                          const ctx = getAudioContext();
                          triggerSingleDrumHit(ctx, ctx.currentTime, d.code, d.sym, 1.0);
                        }}
                        className="p-2 rounded-lg bg-slate-50 hover:bg-blue-50 dark:bg-neutral-950 dark:hover:bg-neutral-800 border border-slate-200 dark:border-neutral-800 text-left transition-all cursor-pointer active:scale-95"
                        title={`Clicca per ascoltare il suono di ${d.name}`}
                      >
                        <div className="font-mono font-black text-blue-600 dark:text-yellow-400">
                          🔊 {d.code} ({d.sym})
                        </div>
                        <div className="text-[11px] font-semibold text-slate-700 dark:text-neutral-300 truncate">
                          {d.name}
                        </div>
                      </button>
                    ))}
                  </div>

                  <div className="pt-1 border-t border-slate-100 dark:border-neutral-800 grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-[11px] text-slate-600 dark:text-neutral-300">
                    <div><strong className="font-mono text-slate-900 dark:text-yellow-300">o</strong> = Colpo tamburo / cassa</div>
                    <div><strong className="font-mono text-slate-900 dark:text-yellow-300">x</strong> = Piatto / HH chiuso</div>
                    <div><strong className="font-mono text-slate-900 dark:text-yellow-300">O</strong> = Accento / HH aperto</div>
                    <div><strong className="font-mono text-slate-900 dark:text-yellow-300">g</strong> = Ghost note (colpo piano)</div>
                    <div><strong className="font-mono text-slate-900 dark:text-yellow-300">f</strong> = Flam (doppio colpo)</div>
                    <div><strong className="font-mono text-slate-900 dark:text-yellow-300">d</strong> = Drag / Rullo doppio</div>
                  </div>
                </div>

                {/* Colonna 2: Legenda Chitarra & Basso */}
                <div className="p-3.5 rounded-xl bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 space-y-2.5">
                  <span className="font-black text-slate-900 dark:text-yellow-400 uppercase block">
                    🎸 Legenda Chitarra &amp; Basso (Corde &amp; Tecniche)
                  </span>

                  <p className="text-[11px] text-slate-600 dark:text-neutral-300 leading-relaxed">
                    <strong>Ordine delle corde nel rigo:</strong> come in tutte le tablature ufficiali, la riga più in alto è la <strong>1ª corda più acuta</strong> (<code>e</code> cantino su Chitarra, <code>G</code> su Basso), mentre la riga più in basso è la <strong>corda più grave/grossa</strong> (<code>E</code> basso su Chitarra/Basso 4, <code>B</code> su Basso 5).
                  </p>

                  <div className="pt-1 border-t border-slate-100 dark:border-neutral-800 grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-[11px] text-slate-600 dark:text-neutral-300">
                    <div><strong className="font-mono text-slate-900 dark:text-yellow-300">0</strong> = Corda suonata a vuoto</div>
                    <div><strong className="font-mono text-slate-900 dark:text-yellow-300">1–24</strong> = Tasto da premere</div>
                    <div><strong className="font-mono text-slate-900 dark:text-yellow-300">5h7</strong> = Hammer-on (legato ↑)</div>
                    <div><strong className="font-mono text-slate-900 dark:text-yellow-300">7p5</strong> = Pull-off (strappato ↓)</div>
                    <div><strong className="font-mono text-slate-900 dark:text-yellow-300">5/7</strong> = Slide ascendente</div>
                    <div><strong className="font-mono text-slate-900 dark:text-yellow-300">7\5</strong> = Slide discendente</div>
                    <div><strong className="font-mono text-slate-900 dark:text-yellow-300">7b9</strong> = Bending (tira la corda)</div>
                    <div><strong className="font-mono text-slate-900 dark:text-yellow-300">~</strong> = Vibrato</div>
                    <div><strong className="font-mono text-slate-900 dark:text-yellow-300">x</strong> = Dead note (stoppata)</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── 7. FINESTRELLA POPUP INSERIMENTO RAPIDO NUMERO TASTO (0–24) PER SMARTPHONE E PC ── */}
      {isFretPopupOpen && instrument !== 'drums' && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-2 sm:p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setIsFretPopupOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white dark:bg-[#111111] border-2 border-blue-500 dark:border-yellow-400 shadow-2xl overflow-hidden space-y-3 p-3.5 sm:p-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Finestrella: Battuta, Corda, Step, Valore Corrente e Chiudi */}
            <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-200 dark:border-neutral-800">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-9 h-9 rounded-xl bg-slate-900 text-yellow-400 font-mono font-black text-base flex items-center justify-center border border-yellow-500/40 shrink-0">
                  {lines[selectedCell.lIdx]}
                </span>
                <div className="min-w-0">
                  <div className="text-xs sm:text-sm font-black text-slate-900 dark:text-yellow-400 truncate">
                    Battuta #{selectedCell.mIdx + 1} • {selectedCell.lIdx + 1}ª Corda ({lines[selectedCell.lIdx]}) • Step #{selectedCell.sIdx + 1}
                  </div>
                  <div className="text-[11px] font-semibold text-slate-500 dark:text-neutral-400 flex items-center gap-1.5">
                    <span>Valore attuale:</span>
                    <strong className="px-2 py-0.2 rounded bg-blue-100 text-blue-800 dark:bg-yellow-400/20 dark:text-yellow-300 font-mono text-xs">
                      {measures[selectedCell.mIdx]?.cells?.[`${selectedCell.lIdx}_${selectedCell.sIdx}`] || 'Vuota'}
                    </strong>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsFretPopupOpen(false)}
                className="w-9 h-9 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-sm flex items-center justify-center shrink-0 cursor-pointer active:scale-95"
                title="Chiudi finestrella"
              >
                ✕
              </button>
            </div>

            {/* Frecce Rapide per spostarsi tra Corde e Step + Switch "Chiudi al tocco / Continua" */}
            <div className="flex items-center justify-between gap-1.5 bg-slate-100 dark:bg-neutral-900 p-1.5 rounded-xl border border-slate-200 dark:border-neutral-800">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    const { mIdx, lIdx, sIdx } = selectedCell;
                    if (sIdx > 0) setSelectedCell({ mIdx, lIdx, sIdx: sIdx - 1 });
                    else if (mIdx > 0) {
                      const prevSteps = measures[mIdx - 1]?.stepsCount || 16;
                      setSelectedCell({ mIdx: mIdx - 1, lIdx, sIdx: prevSteps - 1 });
                    }
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-neutral-800 text-slate-800 dark:text-yellow-300 border border-slate-300 dark:border-neutral-700 text-xs font-extrabold cursor-pointer active:scale-95"
                  title="Step precedente"
                >
                  ◀ Step
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const { mIdx, lIdx, sIdx } = selectedCell;
                    const maxSteps = measures[mIdx]?.stepsCount || 16;
                    if (sIdx + 1 < maxSteps) setSelectedCell({ mIdx, lIdx, sIdx: sIdx + 1 });
                    else if (mIdx + 1 < measures.length) setSelectedCell({ mIdx: mIdx + 1, lIdx, sIdx: 0 });
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-neutral-800 text-slate-800 dark:text-yellow-300 border border-slate-300 dark:border-neutral-700 text-xs font-extrabold cursor-pointer active:scale-95"
                  title="Step successivo"
                >
                  Step ▶
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setSelectedCell((prev) => ({ ...prev, lIdx: Math.max(0, prev.lIdx - 1) }))
                  }
                  className="px-2 py-1.5 rounded-lg bg-white dark:bg-neutral-800 text-slate-800 dark:text-yellow-300 border border-slate-300 dark:border-neutral-700 text-xs font-extrabold cursor-pointer active:scale-95"
                  title="Corda superiore"
                >
                  ▲
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setSelectedCell((prev) => ({
                      ...prev,
                      lIdx: Math.min(lines.length - 1, prev.lIdx + 1),
                    }))
                  }
                  className="px-2 py-1.5 rounded-lg bg-white dark:bg-neutral-800 text-slate-800 dark:text-yellow-300 border border-slate-300 dark:border-neutral-700 text-xs font-extrabold cursor-pointer active:scale-95"
                  title="Corda inferiore"
                >
                  ▼
                </button>
              </div>

              <button
                type="button"
                onClick={() => setClosePopupOnSelect((v) => !v)}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-extrabold border transition-all cursor-pointer ${
                  closePopupOnSelect
                    ? 'bg-blue-600 text-white border-blue-600 dark:bg-yellow-400 dark:text-black dark:border-yellow-400'
                    : 'bg-emerald-600 text-white border-emerald-500'
                }`}
              >
                {closePopupOnSelect ? '✓ Chiudi al tocco' : '⏩ Resta aperta'}
              </button>
            </div>

            {/* Griglia Numeri Tasti 0..24 (Grandi e ottimizzati per Touch Smartphone) */}
            <div className="space-y-1.5">
              <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-yellow-400/90">
                Tocca il Numero del Tasto (0 = Corda a vuoto, 1–24 = Tasto):
              </div>
              <div className="grid grid-cols-5 gap-1.5">
                {Array.from({ length: 25 }, (_, fret) => {
                  const isSpecial = fret === 0 || fret === 12 || fret === 24;
                  const isDotMarker = [3, 5, 7, 9, 15, 17, 19, 21].includes(fret);
                  const curVal =
                    measures[selectedCell.mIdx]?.cells?.[
                      `${selectedCell.lIdx}_${selectedCell.sIdx}`
                    ] || '';
                  const isCurrentFret = curVal === String(fret);

                  return (
                    <button
                      key={fret}
                      type="button"
                      onClick={() => {
                        insertFretNumber(fret);
                        // Se la cella aveva una tecnica pendente (es. "5h"), ora è completa ("5h7") e può chiudersi
                        if (closePopupOnSelect) {
                          setIsFretPopupOpen(false);
                        }
                      }}
                      className={`h-11 rounded-xl font-mono text-sm sm:text-base font-black border-2 transition-all cursor-pointer active:scale-95 flex items-center justify-center ${
                        isCurrentFret
                          ? 'bg-emerald-500 text-black border-emerald-400 ring-2 ring-emerald-400/40'
                          : isSpecial
                          ? 'bg-blue-600 text-white border-blue-700 dark:bg-yellow-400 dark:text-black dark:border-yellow-300 shadow-2xs'
                          : isDotMarker
                          ? 'bg-amber-50 hover:bg-amber-100 text-slate-900 border-amber-300 dark:bg-neutral-800 dark:hover:bg-neutral-700 dark:text-yellow-300 dark:border-yellow-500/40'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200 dark:bg-neutral-900 dark:hover:bg-neutral-800 dark:text-neutral-100 dark:border-neutral-800'
                      }`}
                    >
                      {fret === 0 ? '0 (Vuota)' : fret}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Tecniche Rapide (Hammer-on, Pull-off, Slide, Bend, Vibrato, Mute) */}
            <div className="space-y-1.5 pt-1 border-t border-slate-200 dark:border-neutral-800">
              <div className="text-[10px] font-bold uppercase text-slate-500 dark:text-neutral-400">
                Tecniche (tocca prima il 1° tasto, poi la tecnica es. h/p/b, poi il 2° tasto):
              </div>
              <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
                {[
                  { t: 'h', label: 'h (Hammer)' },
                  { t: 'p', label: 'p (Pull)' },
                  { t: '/', label: '/ (Slide ↑)' },
                  { t: '\\', label: '\\ (Slide ↓)' },
                  { t: 'b', label: 'b (Bend)' },
                  { t: '~', label: '~ (Vibr.)' },
                  { t: 'x', label: 'x (Stop)' },
                ].map((item) => (
                  <button
                    key={item.t}
                    type="button"
                    onClick={() => {
                      applyTechniqueToSelected(item.t);
                      if (item.t === 'x' || item.t === '~') {
                        if (closePopupOnSelect) setIsFretPopupOpen(false);
                      }
                    }}
                    className="py-2 px-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-neutral-900 dark:hover:bg-neutral-800 text-slate-800 dark:text-yellow-300 border border-slate-300 dark:border-neutral-700 text-[11px] font-mono font-extrabold cursor-pointer active:scale-95 text-center"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Footer Finestrella: Cancella Cella & Chiudi */}
            <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-slate-200 dark:border-neutral-800">
              <button
                type="button"
                onClick={() => {
                  setCellValue(selectedCell.mIdx, selectedCell.lIdx, selectedCell.sIdx, '');
                  if (closePopupOnSelect) setIsFretPopupOpen(false);
                }}
                className="flex-1 py-2.5 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-300 border border-rose-200 dark:border-rose-700/50 text-xs font-extrabold cursor-pointer active:scale-95"
              >
                ⌫ Svuota Casella
              </button>

              <button
                type="button"
                onClick={() => setIsFretPopupOpen(false)}
                className="flex-1 py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-yellow-400 dark:hover:bg-yellow-300 dark:text-black text-xs font-black cursor-pointer active:scale-95"
              >
                Conferma &amp; Chiudi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
