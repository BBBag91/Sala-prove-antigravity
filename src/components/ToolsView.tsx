import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Play,
  Square,
  RotateCcw,
  Plus,
  Minus,
  Music,
  Gauge,
  Wrench,
  Calculator as CalcIcon,
  Radio,
  Sparkles,
  Hand,
} from 'lucide-react';
import { StudioCalculator } from './StudioCalculator';

// ─────────────────────────────────────────────────────────────────────────────
// 1. ACCORDATORE 440Hz OTTIMIZZATO PER CHITARRA E BASSO
// ─────────────────────────────────────────────────────────────────────────────

interface StringNote {
  stringNum: number;
  name: string;
  italName: string;
  octave: number;
  baseFreq440: number; // Frequency when A4 = 440Hz
}

interface InstrumentPreset {
  id: 'guitar_std' | 'guitar_drop_d' | 'bass_4' | 'bass_5' | 'chromatic';
  label: string;
  shortLabel: string;
  description: string;
  strings: StringNote[];
}

const INSTRUMENT_PRESETS: InstrumentPreset[] = [
  {
    id: 'guitar_std',
    label: 'Chitarra 6 Corde (Standard E-A-D-G-B-E)',
    shortLabel: '🎸 Chitarra Standard',
    description: 'Accordatura standard chitarra elettrica, acustica e classica',
    strings: [
      { stringNum: 6, name: 'E2', italName: 'MI basso', octave: 2, baseFreq440: 82.41 },
      { stringNum: 5, name: 'A2', italName: 'LA', octave: 2, baseFreq440: 110.0 },
      { stringNum: 4, name: 'D3', italName: 'RE', octave: 3, baseFreq440: 146.83 },
      { stringNum: 3, name: 'G3', italName: 'SOL', octave: 3, baseFreq440: 196.0 },
      { stringNum: 2, name: 'B3', italName: 'SI', octave: 3, baseFreq440: 246.94 },
      { stringNum: 1, name: 'E4', italName: 'MI cantino', octave: 4, baseFreq440: 329.63 },
    ],
  },
  {
    id: 'guitar_drop_d',
    label: 'Chitarra Drop D (D-A-D-G-B-E)',
    shortLabel: '🎸 Chitarra Drop D',
    description: '6ª corda abbassata di un tono (RE basso)',
    strings: [
      { stringNum: 6, name: 'D2', italName: 'RE basso', octave: 2, baseFreq440: 73.42 },
      { stringNum: 5, name: 'A2', italName: 'LA', octave: 2, baseFreq440: 110.0 },
      { stringNum: 4, name: 'D3', italName: 'RE', octave: 3, baseFreq440: 146.83 },
      { stringNum: 3, name: 'G3', italName: 'SOL', octave: 3, baseFreq440: 196.0 },
      { stringNum: 2, name: 'B3', italName: 'SI', octave: 3, baseFreq440: 246.94 },
      { stringNum: 1, name: 'E4', italName: 'MI cantino', octave: 4, baseFreq440: 329.63 },
    ],
  },
  {
    id: 'bass_4',
    label: 'Basso 4 Corde (Standard E-A-D-G)',
    shortLabel: '🎸 Basso 4 Corde',
    description: 'Ottimizzato per basse frequenze fondamentali (41.2 Hz - 98 Hz)',
    strings: [
      { stringNum: 4, name: 'E1', italName: 'MI basso', octave: 1, baseFreq440: 41.2 },
      { stringNum: 3, name: 'A1', italName: 'LA', octave: 1, baseFreq440: 55.0 },
      { stringNum: 2, name: 'D2', italName: 'RE', octave: 2, baseFreq440: 73.42 },
      { stringNum: 1, name: 'G2', italName: 'SOL', octave: 2, baseFreq440: 98.0 },
    ],
  },
  {
    id: 'bass_5',
    label: 'Basso 5 Corde (Standard B-E-A-D-G)',
    shortLabel: '🎸 Basso 5 Corde',
    description: 'Include 5ª corda SI grave (30.87 Hz) a finestra estesa',
    strings: [
      { stringNum: 5, name: 'B0', italName: 'SI grave', octave: 0, baseFreq440: 30.87 },
      { stringNum: 4, name: 'E1', italName: 'MI basso', octave: 1, baseFreq440: 41.2 },
      { stringNum: 3, name: 'A1', italName: 'LA', octave: 1, baseFreq440: 55.0 },
      { stringNum: 2, name: 'D2', italName: 'RE', octave: 2, baseFreq440: 73.42 },
      { stringNum: 1, name: 'G2', italName: 'SOL', octave: 2, baseFreq440: 98.0 },
    ],
  },
  {
    id: 'chromatic',
    label: 'Cromatico Universale (Tutte le 12 Note)',
    shortLabel: '🎼 Cromatico 12 Note',
    description: 'Rileva qualsiasi nota della scala cromatica temperata',
    strings: [],
  },
];

const NOTE_NAMES_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const NOTE_NAMES_ITAL = ['DO', 'DO#', 'RE', 'RE#', 'MI', 'FA', 'FA#', 'SOL', 'SOL#', 'LA', 'LA#', 'SI'];

/**
 * High-precision autocorrelation / NSDF pitch detector optimized for Guitar & Bass (27Hz - 1200Hz)
 */
function detectPitchNSDF(buffer: Float32Array, sampleRate: number): { freq: number; clarity: number; rms: number } {
  const n = buffer.length;
  let sumSq = 0;
  for (let i = 0; i < n; i++) {
    sumSq += buffer[i] * buffer[i];
  }
  const rms = Math.sqrt(sumSq / n);
  if (rms < 0.008) {
    return { freq: -1, clarity: 0, rms };
  }

  // Min frequency ~27Hz (below B0 = 30.87Hz), Max frequency ~1100Hz
  const minLag = Math.max(2, Math.floor(sampleRate / 1100));
  const maxLag = Math.min(Math.floor(n / 2), Math.ceil(sampleRate / 27));

  const nsdf = new Float32Array(maxLag + 1);
  for (let tau = minLag; tau <= maxLag; tau++) {
    let acf = 0;
    let divisor = 0;
    // Step by 2 on very large buffers for ultra-fast CPU performance while keeping precision
    const step = n >= 8192 ? 2 : 1;
    const limit = n - tau;
    for (let i = 0; i < limit; i += step) {
      const a = buffer[i];
      const b = buffer[i + tau];
      acf += a * b;
      divisor += a * a + b * b;
    }
    nsdf[tau] = divisor > 0 ? (2 * acf) / divisor : 0;
  }

  // Find key maxima after the first zero-crossing
  let tau = minLag;
  while (tau <= maxLag && nsdf[tau] > 0) {
    tau++;
  }
  while (tau <= maxLag && nsdf[tau] <= 0) {
    tau++;
  }

  const peaks: { lag: number; val: number }[] = [];
  let curMaxLag = -1;
  let curMaxVal = -1;

  for (; tau <= maxLag; tau++) {
    if (nsdf[tau] > 0) {
      if (nsdf[tau] > curMaxVal) {
        curMaxVal = nsdf[tau];
        curMaxLag = tau;
      }
    } else if (curMaxLag !== -1) {
      peaks.push({ lag: curMaxLag, val: curMaxVal });
      curMaxLag = -1;
      curMaxVal = -1;
    }
  }
  if (curMaxLag !== -1) {
    peaks.push({ lag: curMaxLag, val: curMaxVal });
  }

  if (peaks.length === 0) {
    return { freq: -1, clarity: 0, rms };
  }

  let globalMax = 0;
  for (const p of peaks) {
    if (p.val > globalMax) globalMax = p.val;
  }

  if (globalMax < 0.55) {
    return { freq: -1, clarity: globalMax, rms };
  }

  // Pick the first peak >= 0.85 * globalMax to lock onto the true fundamental (crucial for Bass & Low E!)
  const threshold = globalMax * 0.85;
  const chosenPeak = peaks.find((p) => p.val >= threshold) || peaks[0];
  const bestLag = chosenPeak.lag;

  // Parabolic interpolation for sub-sample accuracy
  let refinedLag = bestLag;
  if (bestLag > minLag && bestLag < maxLag) {
    const y1 = nsdf[bestLag - 1];
    const y2 = nsdf[bestLag];
    const y3 = nsdf[bestLag + 1];
    const denom = y1 - 2 * y2 + y3;
    if (Math.abs(denom) > 1e-6) {
      refinedLag = bestLag + (0.5 * (y1 - y3)) / denom;
    }
  }

  return {
    freq: sampleRate / refinedLag,
    clarity: chosenPeak.val,
    rms,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. METRONOMO STUDIO CON ACCENTI E BATTUTE
// ─────────────────────────────────────────────────────────────────────────────

type BeatAccent = 3 | 2 | 1 | 0; // 3 = Forte (Accento 1), 2 = Medio, 1 = Normale, 0 = Muto
type SubdivisionType = 1 | 2 | 3 | 4;
type MetronomeSound = 'studio_click' | 'woodblock' | 'rimshot' | 'digital';

interface TimeSignaturePreset {
  label: string;
  beats: number;
  noteValue: number;
  defaultAccents: BeatAccent[];
}

const TIME_SIGNATURES: TimeSignaturePreset[] = [
  { label: '4/4', beats: 4, noteValue: 4, defaultAccents: [3, 1, 2, 1] },
  { label: '3/4', beats: 3, noteValue: 4, defaultAccents: [3, 1, 1] },
  { label: '2/4', beats: 2, noteValue: 4, defaultAccents: [3, 1] },
  { label: '5/4', beats: 5, noteValue: 4, defaultAccents: [3, 1, 1, 2, 1] },
  { label: '6/8', beats: 6, noteValue: 8, defaultAccents: [3, 1, 1, 2, 1, 1] },
  { label: '7/8', beats: 7, noteValue: 8, defaultAccents: [3, 1, 2, 1, 2, 1, 1] },
  { label: '9/8', beats: 9, noteValue: 8, defaultAccents: [3, 1, 1, 2, 1, 1, 2, 1, 1] },
  { label: '12/8', beats: 12, noteValue: 8, defaultAccents: [3, 1, 1, 2, 1, 1, 2, 1, 1, 2, 1, 1] },
];

export const ToolsView: React.FC = () => {
  // Vista selettore su mobile o compatta
  const [activeToolSection, setActiveToolSection] = useState<'all' | 'tuner' | 'metronome' | 'calc'>('all');

  // ═══════════════════════════════════════════════════════════════════════════
  // STATO ACCORDATORE 440Hz
  // ═══════════════════════════════════════════════════════════════════════════
  const [isMicListening, setIsMicListening] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [referenceA4, setReferenceA4] = useState<number>(440);
  const [selectedInstrumentId, setSelectedInstrumentId] = useState<InstrumentPreset['id']>('guitar_std');
  const [lockedStringNum, setLockedStringNum] = useState<number | null>(null); // null = Auto-detect
  const [playingToneString, setPlayingToneString] = useState<number | null>(null);

  const [detectedFreq, setDetectedFreq] = useState<number | null>(null);
  const [detectedNoteName, setDetectedNoteName] = useState<string>('—');
  const [detectedItalName, setDetectedItalName] = useState<string>('In attesa del suono');
  const [detectedOctave, setDetectedOctave] = useState<number | null>(null);
  const [detectedCents, setDetectedCents] = useState<number>(0);
  const [matchedStringNum, setMatchedStringNum] = useState<number | null>(null);
  const [signalLevel, setSignalLevel] = useState<number>(0);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const freqHistoryRef = useRef<number[]>([]);
  const toneOscRef = useRef<{ osc1: OscillatorNode; osc2: OscillatorNode; gain: GainNode } | null>(null);

  const selectedPreset =
    INSTRUMENT_PRESETS.find((p) => p.id === selectedInstrumentId) || INSTRUMENT_PRESETS[0];

  const stopReferenceTone = useCallback(() => {
    if (toneOscRef.current) {
      try {
        toneOscRef.current.gain.gain.setTargetAtTime(0, toneOscRef.current.osc1.context.currentTime, 0.03);
        setTimeout(() => {
          try {
            toneOscRef.current?.osc1.stop();
            toneOscRef.current?.osc2.stop();
          } catch {
            // ignore
          }
          toneOscRef.current = null;
        }, 60);
      } catch {
        toneOscRef.current = null;
      }
    }
    setPlayingToneString(null);
  }, []);

  const playReferenceTone = (str: StringNote) => {
    if (playingToneString === str.stringNum) {
      stopReferenceTone();
      return;
    }
    stopReferenceTone();

    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContextClass();
    }
    const ctx = audioCtxRef.current;
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const scaledFreq = str.baseFreq440 * (referenceA4 / 440);
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    // Rich harmonic tone so even low bass notes (E1/B0) are clearly audible on smartphone/laptop speakers
    osc1.type = 'triangle';
    osc1.frequency.value = scaledFreq;
    osc2.type = 'sine';
    osc2.frequency.value = scaledFreq * 2; // 2nd harmonic

    const g1 = ctx.createGain();
    const g2 = ctx.createGain();
    g1.gain.value = 0.65;
    g2.gain.value = 0.35;

    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.05);

    osc1.connect(g1).connect(gain);
    osc2.connect(g2).connect(gain);
    gain.connect(ctx.destination);

    osc1.start();
    osc2.start();

    toneOscRef.current = { osc1, osc2, gain };
    setPlayingToneString(str.stringNum);
  };

  const stopMicrophone = useCallback(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    setIsMicListening(false);
    setSignalLevel(0);
    freqHistoryRef.current = [];
  }, []);

  const startMicrophone = async () => {
    setMicError(null);
    stopReferenceTone();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          autoGainControl: false,
          noiseSuppression: false,
        },
      });
      mediaStreamRef.current = stream;

      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContextClass();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      const source = ctx.createMediaStreamSource(stream);

      // Low-pass filter at 1200Hz to remove fret buzz and high harmonics
      const lowpass = ctx.createBiquadFilter();
      lowpass.type = 'lowpass';
      lowpass.frequency.value = 1200;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 8192; // High resolution for low bass frequencies
      source.connect(lowpass);
      lowpass.connect(analyser);
      analyserRef.current = analyser;

      setIsMicListening(true);
    } catch (err) {
      console.error('Errore accesso microfono:', err);
      setMicError(
        'Impossibile accedere al microfono. Verifica di aver concesso il permesso nel browser.'
      );
      setIsMicListening(false);
    }
  };

  // Pitch detection loop
  useEffect(() => {
    if (!isMicListening || !analyserRef.current || !audioCtxRef.current) return;

    const analyser = analyserRef.current;
    const sampleRate = audioCtxRef.current.sampleRate;
    const buffer = new Float32Array(analyser.fftSize);

    const updatePitch = () => {
      analyser.getFloatTimeDomainData(buffer);
      const { freq, clarity, rms } = detectPitchNSDF(buffer, sampleRate);
      setSignalLevel(Math.min(100, Math.round(rms * 350)));

      if (freq > 27 && freq < 1100 && clarity >= 0.6) {
        // Median smoothing over last 5 valid frames
        const hist = freqHistoryRef.current;
        hist.push(freq);
        if (hist.length > 5) hist.shift();
        const sorted = [...hist].sort((a, b) => a - b);
        const smoothFreq = sorted[Math.floor(sorted.length / 2)];

        setDetectedFreq(smoothFreq);

        // If instrument preset has strings (Guitar / Bass)
        if (selectedPreset.strings.length > 0) {
          let targetStr: StringNote = selectedPreset.strings[0];

          if (lockedStringNum !== null) {
            targetStr =
              selectedPreset.strings.find((s) => s.stringNum === lockedStringNum) ||
              selectedPreset.strings[0];
          } else {
            // Find closest string in cents
            let minAbsCents = Infinity;
            for (const s of selectedPreset.strings) {
              const targetFreq = s.baseFreq440 * (referenceA4 / 440);
              const centsDiff = Math.abs(1200 * Math.log2(smoothFreq / targetFreq));
              if (centsDiff < minAbsCents) {
                minAbsCents = centsDiff;
                targetStr = s;
              }
            }
          }

          const targetFreq = targetStr.baseFreq440 * (referenceA4 / 440);
          const rawCents = 1200 * Math.log2(smoothFreq / targetFreq);
          const clampedCents = Math.max(-50, Math.min(50, Math.round(rawCents * 10) / 10));

          setMatchedStringNum(targetStr.stringNum);
          setDetectedNoteName(targetStr.name.replace(/[0-9]/g, ''));
          setDetectedItalName(`${targetStr.italName} (${targetStr.stringNum}ª corda)`);
          setDetectedOctave(targetStr.octave);
          setDetectedCents(clampedCents);
        } else {
          // Chromatic mode
          const midiFloat = 69 + 12 * Math.log2(smoothFreq / referenceA4);
          const midiNearest = Math.round(midiFloat);
          const cents = Math.max(-50, Math.min(50, Math.round((midiFloat - midiNearest) * 1000) / 10));
          const noteIndex = ((midiNearest % 12) + 12) % 12;
          const octave = Math.floor(midiNearest / 12) - 1;

          setMatchedStringNum(null);
          setDetectedNoteName(NOTE_NAMES_SHARP[noteIndex]);
          setDetectedItalName(NOTE_NAMES_ITAL[noteIndex]);
          setDetectedOctave(octave);
          setDetectedCents(cents);
        }
      }

      rafIdRef.current = requestAnimationFrame(updatePitch);
    };

    rafIdRef.current = requestAnimationFrame(updatePitch);
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, [isMicListening, selectedPreset, lockedStringNum, referenceA4]);

  // ═══════════════════════════════════════════════════════════════════════════
  // STATO METRONOMO CON ACCENTI, BATTUTE E SUDDIVISIONI
  // ═══════════════════════════════════════════════════════════════════════════
  const [isMetronomePlaying, setIsMetronomePlaying] = useState(false);
  const [bpm, setBpm] = useState<number>(120);
  const [selectedTimeSig, setSelectedTimeSig] = useState<string>('4/4');
  const [beatsPerBar, setBeatsPerBar] = useState<number>(4);
  const [noteValue, setNoteValue] = useState<number>(4);
  const [accents, setAccents] = useState<BeatAccent[]>([3, 1, 2, 1]);
  const [subdivision, setSubdivision] = useState<SubdivisionType>(1);
  const [soundType, setSoundType] = useState<MetronomeSound>('studio_click');
  const [volume, setVolume] = useState<number>(0.85);
  const [currentBeatIndex, setCurrentBeatIndex] = useState<number>(-1);
  const [barCount, setBarCount] = useState<number>(0);

  // Refs for Web Audio Lookahead Scheduler
  const metroCtxRef = useRef<AudioContext | null>(null);
  const schedulerTimerRef = useRef<number | null>(null);
  const nextNoteTimeRef = useRef<number>(0);
  const currentSubStepRef = useRef<number>(0);
  const tapTimesRef = useRef<number[]>([]);

  // Live synced refs for audio scheduler
  const bpmRef = useRef(bpm);
  const beatsPerBarRef = useRef(beatsPerBar);
  const accentsRef = useRef(accents);
  const subdivisionRef = useRef(subdivision);
  const soundTypeRef = useRef(soundType);
  const volumeRef = useRef(volume);

  useEffect(() => {
    bpmRef.current = bpm;
  }, [bpm]);
  useEffect(() => {
    beatsPerBarRef.current = beatsPerBar;
  }, [beatsPerBar]);
  useEffect(() => {
    accentsRef.current = accents;
  }, [accents]);
  useEffect(() => {
    subdivisionRef.current = subdivision;
  }, [subdivision]);
  useEffect(() => {
    soundTypeRef.current = soundType;
  }, [soundType]);
  useEffect(() => {
    volumeRef.current = volume;
  }, [volume]);

  const handleSelectTimeSignature = (sig: TimeSignaturePreset) => {
    setSelectedTimeSig(sig.label);
    setBeatsPerBar(sig.beats);
    setNoteValue(sig.noteValue);
    setAccents([...sig.defaultAccents]);
    currentSubStepRef.current = 0;
  };

  const toggleBeatAccent = (idx: number) => {
    setAccents((prev) => {
      const next = [...prev];
      // Cycle: 3 (Forte) -> 2 (Medio) -> 1 (Normale) -> 0 (Muto) -> 3
      const cur = next[idx];
      next[idx] = cur === 3 ? 2 : cur === 2 ? 1 : cur === 1 ? 0 : 3;
      return next;
    });
  };

  const applyAccentPreset = (mode: 'downbeat' | 'backbeat' | 'flat' | 'mute_even') => {
    setAccents((prev) =>
      prev.map((_, i) => {
        if (mode === 'downbeat') return i === 0 ? 3 : 1;
        if (mode === 'backbeat') return i % 2 === 1 ? 3 : 1;
        if (mode === 'flat') return 2;
        if (mode === 'mute_even') return i % 2 === 1 ? 0 : i === 0 ? 3 : 2;
        return 1;
      })
    );
  };

  const scheduleMetronomeClick = useCallback(
    (time: number, beatIdx: number, subIdx: number, accent: BeatAccent) => {
      const ctx = metroCtxRef.current;
      if (!ctx) return;

      // Update visual beat on main beat
      if (subIdx === 0) {
        const delayMs = Math.max(0, (time - ctx.currentTime) * 1000);
        window.setTimeout(() => {
          setCurrentBeatIndex(beatIdx);
          if (beatIdx === 0) {
            setBarCount((c) => c + 1);
          }
        }, delayMs);
      }

      // If muted beat, do not play sound
      if (accent === 0) return;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      const isSub = subIdx > 0;
      const vol = volumeRef.current * (isSub ? 0.35 : accent === 3 ? 1.0 : accent === 2 ? 0.75 : 0.55);

      let freq = 880;
      if (soundTypeRef.current === 'studio_click') {
        osc.type = 'triangle';
        freq = isSub ? 660 : accent === 3 ? 1320 : accent === 2 ? 987.77 : 880;
      } else if (soundTypeRef.current === 'woodblock') {
        osc.type = 'sine';
        freq = isSub ? 580 : accent === 3 ? 1150 : accent === 2 ? 900 : 760;
      } else if (soundTypeRef.current === 'rimshot') {
        osc.type = 'square';
        freq = isSub ? 440 : accent === 3 ? 950 : accent === 2 ? 720 : 600;
      } else {
        osc.type = 'sine';
        freq = isSub ? 1000 : accent === 3 ? 2000 : accent === 2 ? 1500 : 1200;
      }

      osc.frequency.setValueAtTime(freq, time);
      gain.gain.setValueAtTime(0.0001, time);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.01, vol), time + 0.003);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.045);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(time);
      osc.stop(time + 0.05);
    },
    []
  );

  const stopMetronome = useCallback(() => {
    if (schedulerTimerRef.current !== null) {
      window.clearInterval(schedulerTimerRef.current);
      schedulerTimerRef.current = null;
    }
    setIsMetronomePlaying(false);
    setCurrentBeatIndex(-1);
  }, []);

  const startMetronome = useCallback(() => {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!metroCtxRef.current) {
      metroCtxRef.current = new AudioContextClass();
    }
    const ctx = metroCtxRef.current;
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    currentSubStepRef.current = 0;
    nextNoteTimeRef.current = ctx.currentTime + 0.04;
    setBarCount(0);
    setIsMetronomePlaying(true);

    const lookaheadMs = 25;
    const scheduleAheadSec = 0.1;

    schedulerTimerRef.current = window.setInterval(() => {
      while (nextNoteTimeRef.current < ctx.currentTime + scheduleAheadSec) {
        const sub = subdivisionRef.current;
        const totalSubSteps = beatsPerBarRef.current * sub;
        const step = currentSubStepRef.current % totalSubSteps;
        const beatIdx = Math.floor(step / sub);
        const subIdx = step % sub;
        const accent = accentsRef.current[beatIdx] ?? 1;

        scheduleMetronomeClick(nextNoteTimeRef.current, beatIdx, subIdx, accent);

        const secondsPerBeat = 60.0 / bpmRef.current;
        nextNoteTimeRef.current += secondsPerBeat / sub;
        currentSubStepRef.current = (step + 1) % totalSubSteps;
      }
    }, lookaheadMs);
  }, [scheduleMetronomeClick]);

  const handleTapTempo = () => {
    const now = performance.now();
    const taps = tapTimesRef.current.filter((t) => now - t < 2500);
    taps.push(now);
    tapTimesRef.current = taps;

    if (taps.length >= 2) {
      let sumIntervals = 0;
      for (let i = 1; i < taps.length; i++) {
        sumIntervals += taps[i] - taps[i - 1];
      }
      const avgMs = sumIntervals / (taps.length - 1);
      const calculatedBpm = Math.round(60000 / avgMs);
      if (calculatedBpm >= 30 && calculatedBpm <= 260) {
        setBpm(calculatedBpm);
      }
    }
  };

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      stopMicrophone();
      stopReferenceTone();
      stopMetronome();
    };
  }, [stopMicrophone, stopReferenceTone, stopMetronome]);

  const isInTune = detectedFreq !== null && Math.abs(detectedCents) <= 3.5;
  const isSlightlyOff = detectedFreq !== null && Math.abs(detectedCents) > 3.5 && Math.abs(detectedCents) <= 12;

  return (
    <div className="space-y-5">
      {/* ── Top Header & Quick Filter Bar ── */}
      <div className="bg-white dark:bg-[#0e0e0e] p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-yellow-500/25 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-blue-600 dark:bg-yellow-400 text-white dark:text-black flex items-center justify-center shadow-sm shrink-0">
            <Wrench className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-yellow-400 tracking-tight">
                Tool Musicali &amp; Utilità Sala
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-800 dark:bg-yellow-400/20 dark:text-yellow-300 border border-emerald-200 dark:border-yellow-500/30">
                A4 = {referenceA4} Hz
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-yellow-100/70">
              Accordatore Chitarra/Basso ad alta precisione con microfono, Metronomo con accenti e battute, e Calcolatrice Studio
            </p>
          </div>
        </div>

        {/* Selettore Vista Rapida (Tutti affiancati o Singolo Tool) */}
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 dark:bg-[#141414] p-1 rounded-xl border border-slate-200 dark:border-yellow-500/25 self-start lg:self-auto">
          {[
            { id: 'all', label: 'Vista Completa', icon: <Sparkles className="w-3.5 h-3.5" /> },
            { id: 'tuner', label: 'Accordatore 440Hz', icon: <Radio className="w-3.5 h-3.5" /> },
            { id: 'metronome', label: 'Metronomo', icon: <Gauge className="w-3.5 h-3.5" /> },
            { id: 'calc', label: 'Calcolatrice', icon: <CalcIcon className="w-3.5 h-3.5" /> },
          ].map((tab) => {
            const active = activeToolSection === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveToolSection(tab.id as typeof activeToolSection)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  active
                    ? 'bg-blue-600 text-white dark:bg-yellow-400 dark:text-black shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 dark:text-yellow-100/70 dark:hover:text-yellow-300'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Main Grid: Accordatore (6 col) + Metronomo (6 col) ── */}
      {(activeToolSection === 'all' || activeToolSection === 'tuner' || activeToolSection === 'metronome') && (
        <div
          className={`grid grid-cols-1 ${
            activeToolSection === 'all' ? 'xl:grid-cols-12' : 'grid-cols-1'
          } gap-5 items-stretch`}
        >
          {/* ══════════════════════════════════════════════════════════════════
              PANNELLO 1: ACCORDATORE 440Hz CHITARRA & BASSO
             ══════════════════════════════════════════════════════════════════ */}
          {(activeToolSection === 'all' || activeToolSection === 'tuner') && (
            <div
              className={`${
                activeToolSection === 'all' ? 'xl:col-span-6' : ''
              } bg-white dark:bg-[#0e0e0e] rounded-2xl border border-slate-200 dark:border-yellow-500/25 shadow-xs overflow-hidden flex flex-col justify-between`}
            >
              {/* Tuner Header */}
              <div className="px-4 py-3.5 bg-slate-50 dark:bg-[#141414] border-b border-slate-200 dark:border-yellow-500/20 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-emerald-600 dark:bg-yellow-400 text-white dark:text-black flex items-center justify-center shadow-2xs">
                    <Radio className="w-4 h-4 stroke-[2.5]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900 dark:text-yellow-400 leading-tight">
                      Accordatore Chitarra &amp; Basso (440 Hz)
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-yellow-100/60">
                      Algoritmo NSDF ad alta risoluzione per corde basse e cantini
                    </p>
                  </div>
                </div>

                {/* Calibrazione A4 = 440 Hz */}
                <div className="flex items-center gap-1.5 bg-white dark:bg-neutral-900 px-2.5 py-1 rounded-xl border border-slate-200 dark:border-yellow-500/30">
                  <span className="text-[10px] font-bold uppercase text-slate-500 dark:text-yellow-400/80">
                    Diapason:
                  </span>
                  <button
                    type="button"
                    onClick={() => setReferenceA4((v) => Math.max(430, v - 1))}
                    className="w-6 h-6 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-slate-700 dark:text-yellow-300 font-bold text-xs flex items-center justify-center cursor-pointer"
                    title="-1 Hz"
                  >
                    −
                  </button>
                  <button
                    type="button"
                    onClick={() => setReferenceA4(440)}
                    className="px-1.5 text-xs font-extrabold font-mono text-blue-600 dark:text-yellow-400 cursor-pointer"
                    title="Clicca per riportare a 440 Hz standard"
                  >
                    {referenceA4} Hz
                  </button>
                  <button
                    type="button"
                    onClick={() => setReferenceA4((v) => Math.min(448, v + 1))}
                    className="w-6 h-6 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-slate-700 dark:text-yellow-300 font-bold text-xs flex items-center justify-center cursor-pointer"
                    title="+1 Hz"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Body Accordatore */}
              <div className="p-4 space-y-4 flex-1 flex flex-col justify-between">
                {/* Selettore Strumento */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                  {INSTRUMENT_PRESETS.map((preset) => {
                    const active = selectedInstrumentId === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => {
                          setSelectedInstrumentId(preset.id);
                          setLockedStringNum(null);
                          stopReferenceTone();
                        }}
                        className={`px-2.5 py-2 rounded-xl text-[11px] font-bold border text-center transition-all cursor-pointer ${
                          active
                            ? 'bg-blue-600 text-white border-blue-600 dark:bg-yellow-400 dark:text-black dark:border-yellow-400 shadow-xs'
                            : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200 dark:bg-[#141414] dark:hover:bg-neutral-800 dark:text-yellow-100 dark:border-yellow-500/20'
                        }`}
                      >
                        {preset.shortLabel}
                      </button>
                    );
                  })}
                </div>

                {/* Display Visivo Cents + Ago + Nota Rilevata */}
                <div className="bg-slate-950 dark:bg-[#080808] rounded-2xl p-4 sm:p-5 border border-slate-800 dark:border-yellow-500/30 text-center space-y-3 relative overflow-hidden shadow-inner">
                  {/* Top Row inside Tuner Screen: Mic Status + Signal Meter */}
                  <div className="flex items-center justify-between text-[11px]">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-bold ${
                        isMicListening
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-neutral-800 text-neutral-400 border border-neutral-700'
                      }`}
                    >
                      <span
                        className={`w-2 h-2 rounded-full ${
                          isMicListening ? 'bg-emerald-400 animate-ping' : 'bg-neutral-500'
                        }`}
                      />
                      {isMicListening ? 'Microfono Attivo' : 'Microfono in Pausa'}
                    </span>

                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-neutral-400 font-mono">Segnale:</span>
                      <div className="w-20 h-2 rounded-full bg-neutral-800 overflow-hidden border border-neutral-700">
                        <div
                          className="h-full bg-gradient-to-r from-emerald-400 via-yellow-400 to-rose-500 transition-all duration-75"
                          style={{ width: `${signalLevel}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Graduated Cents Scale (-50 ... 0 ... +50) */}
                  <div className="pt-1 pb-2">
                    <div className="flex justify-between text-[10px] font-mono text-neutral-400 px-2 mb-1">
                      <span>-50c (Calante ♭)</span>
                      <span className="text-emerald-400 font-bold">0 (440Hz)</span>
                      <span>+50c (Crescente ♯)</span>
                    </div>

                    {/* Meter Track */}
                    <div className="relative h-7 bg-neutral-900 rounded-xl border border-neutral-800 overflow-hidden flex items-center">
                      {/* Center green target zone */}
                      <div className="absolute left-1/2 -translate-x-1/2 w-8 h-full bg-emerald-500/20 border-x border-emerald-500/40" />
                      {/* Center hairline */}
                      <div className="absolute left-1/2 -translate-x-1/2 w-0.5 h-full bg-emerald-400 z-10" />

                      {/* Tick marks */}
                      {[-40, -30, -20, -10, 10, 20, 30, 40].map((tick) => (
                        <div
                          key={tick}
                          className="absolute h-2.5 w-px bg-neutral-700"
                          style={{ left: `${50 + tick}%` }}
                        />
                      ))}

                      {/* Moving Needle / Indicator */}
                      {detectedFreq !== null && (
                        <div
                          className={`absolute top-0.5 bottom-0.5 w-2.5 rounded-full -translate-x-1/2 transition-all duration-100 z-20 shadow-lg ${
                            isInTune
                              ? 'bg-emerald-400 shadow-emerald-400/60 scale-110'
                              : isSlightlyOff
                              ? 'bg-yellow-400 shadow-yellow-400/50'
                              : 'bg-rose-500 shadow-rose-500/50'
                          }`}
                          style={{
                            left: `${Math.max(3, Math.min(97, 50 + detectedCents))}%`,
                          }}
                        />
                      )}
                    </div>
                  </div>

                  {/* Main Note Display */}
                  <div className="flex items-center justify-center gap-4 py-1">
                    <div className="text-right min-w-[75px]">
                      <span className="text-[10px] uppercase tracking-wider text-neutral-400 block">
                        Frequenza
                      </span>
                      <span className="text-sm sm:text-base font-mono font-bold text-yellow-400">
                        {detectedFreq ? `${detectedFreq.toFixed(1)} Hz` : '— Hz'}
                      </span>
                    </div>

                    <div
                      className={`w-24 h-24 rounded-2xl border-2 flex flex-col items-center justify-center transition-all ${
                        isInTune
                          ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 shadow-lg shadow-emerald-500/20'
                          : detectedFreq
                          ? 'bg-neutral-900 border-yellow-400/60 text-yellow-400'
                          : 'bg-neutral-900/70 border-neutral-800 text-neutral-500'
                      }`}
                    >
                      <div className="text-4xl font-black tracking-tight leading-none">
                        {detectedNoteName}
                        {detectedOctave !== null && (
                          <sub className="text-base font-bold ml-0.5">{detectedOctave}</sub>
                        )}
                      </div>
                      <span className="text-[11px] font-bold mt-1 text-yellow-300/90">
                        {detectedItalName}
                      </span>
                    </div>

                    <div className="text-left min-w-[75px]">
                      <span className="text-[10px] uppercase tracking-wider text-neutral-400 block">
                        Scarto
                      </span>
                      <span
                        className={`text-sm sm:text-base font-mono font-bold ${
                          isInTune
                            ? 'text-emerald-400'
                            : detectedFreq
                            ? 'text-amber-400'
                            : 'text-neutral-500'
                        }`}
                      >
                        {detectedFreq
                          ? `${detectedCents > 0 ? '+' : ''}${detectedCents.toFixed(1)} c`
                          : '0.0 c'}
                      </span>
                    </div>
                  </div>

                  {/* Tuning Guidance Banner */}
                  <div className="text-xs font-bold py-1.5 px-3 rounded-xl bg-neutral-900/90 border border-neutral-800 inline-flex items-center gap-2">
                    {!isMicListening ? (
                      <span className="text-yellow-300/80">
                        Premi &ldquo;Attiva Microfono&rdquo; per accordare o tocca una corda per ascoltare il diapason
                      </span>
                    ) : !detectedFreq ? (
                      <span className="text-neutral-400">Suona una corda vicino al microfono...</span>
                    ) : isInTune ? (
                      <span className="text-emerald-400">✓ CORDA PERFETTAMENTE ACCORDATA (440 Hz)</span>
                    ) : detectedCents < 0 ? (
                      <span className="text-amber-400">↑ NOTA CALANTE: Tendi leggermente la corda</span>
                    ) : (
                      <span className="text-rose-400">↓ NOTA CRESCENTE: Allenta leggermente la corda</span>
                    )}
                  </div>
                </div>

                {/* Corde Interattive (Selezione manuale o Auto + Generatore Tono Diapason) */}
                {selectedPreset.strings.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-700 dark:text-yellow-300">
                        Corde {selectedPreset.shortLabel.replace(/^[^\s]+\s/, '')}:
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setLockedStringNum(null)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${
                            lockedStringNum === null
                              ? 'bg-emerald-600 text-white border-emerald-600 dark:bg-yellow-400 dark:text-black dark:border-yellow-400'
                              : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-neutral-900 dark:text-yellow-200 dark:border-yellow-500/20'
                          }`}
                        >
                          Rilevamento Auto
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {selectedPreset.strings.map((str) => {
                        const isMatched = matchedStringNum === str.stringNum && isMicListening;
                        const isLocked = lockedStringNum === str.stringNum;
                        const isPlaying = playingToneString === str.stringNum;
                        const freqHz = (str.baseFreq440 * (referenceA4 / 440)).toFixed(1);

                        return (
                          <div
                            key={str.stringNum}
                            className={`p-2.5 rounded-xl border transition-all flex items-center justify-between gap-2 ${
                              isMatched
                                ? 'bg-emerald-50 border-emerald-400 dark:bg-emerald-950/30 dark:border-emerald-400'
                                : isLocked
                                ? 'bg-blue-50 border-blue-400 dark:bg-yellow-400/15 dark:border-yellow-400'
                                : 'bg-slate-50 border-slate-200 dark:bg-[#141414] dark:border-yellow-500/20'
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() =>
                                setLockedStringNum(isLocked ? null : str.stringNum)
                              }
                              className="text-left flex items-center gap-2 min-w-0 flex-1 cursor-pointer"
                              title="Clicca per bloccare l'accordatore su questa corda"
                            >
                              <span className="w-7 h-7 rounded-lg bg-slate-900 text-yellow-400 font-extrabold text-xs flex items-center justify-center shrink-0">
                                {str.stringNum}ª
                              </span>
                              <div className="min-w-0">
                                <div className="text-xs font-extrabold text-slate-900 dark:text-yellow-300 truncate">
                                  {str.name} • {str.italName}
                                </div>
                                <div className="text-[10px] font-mono text-slate-500 dark:text-yellow-100/60">
                                  {freqHz} Hz
                                </div>
                              </div>
                            </button>

                            <button
                              type="button"
                              onClick={() => playReferenceTone(str)}
                              className={`w-8 h-8 rounded-lg flex items-center justify-center border transition-all cursor-pointer shrink-0 ${
                                isPlaying
                                  ? 'bg-amber-500 text-black border-amber-400 animate-pulse'
                                  : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200 dark:bg-neutral-900 dark:hover:bg-neutral-800 dark:text-yellow-400 dark:border-yellow-500/30'
                              }`}
                              title="Ascolta nota di riferimento (Diapason)"
                            >
                              {isPlaying ? (
                                <VolumeX className="w-4 h-4" />
                              ) : (
                                <Volume2 className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {micError && (
                  <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-500/40 text-xs text-rose-700 dark:text-rose-300 font-medium">
                    ⚠️ {micError}
                  </div>
                )}

                {/* Pulsante Principale Attiva/Disattiva Microfono */}
                <div className="pt-1 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={isMicListening ? stopMicrophone : startMicrophone}
                    className={`flex-1 min-h-[46px] px-4 py-2.5 rounded-xl font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm ${
                      isMicListening
                        ? 'bg-rose-600 hover:bg-rose-700 text-white'
                        : 'bg-blue-600 hover:bg-blue-700 text-white dark:bg-yellow-400 dark:hover:bg-yellow-300 dark:text-black'
                    }`}
                  >
                    {isMicListening ? (
                      <>
                        <MicOff className="w-4 h-4" />
                        <span>Disattiva Microfono</span>
                      </>
                    ) : (
                      <>
                        <Mic className="w-4 h-4" />
                        <span>Attiva Microfono ed Accorda</span>
                      </>
                    )}
                  </button>

                  {playingToneString !== null && (
                    <button
                      type="button"
                      onClick={stopReferenceTone}
                      className="min-h-[46px] px-3.5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <VolumeX className="w-4 h-4" />
                      <span>Ferma Tono</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              PANNELLO 2: METRONOMO PROFESSIONALE CON ACCENTI E BATTUTE
             ══════════════════════════════════════════════════════════════════ */}
          {(activeToolSection === 'all' || activeToolSection === 'metronome') && (
            <div
              className={`${
                activeToolSection === 'all' ? 'xl:col-span-6' : ''
              } bg-white dark:bg-[#0e0e0e] rounded-2xl border border-slate-200 dark:border-yellow-500/25 shadow-xs overflow-hidden flex flex-col justify-between`}
            >
              {/* Metronome Header */}
              <div className="px-4 py-3.5 bg-slate-50 dark:bg-[#141414] border-b border-slate-200 dark:border-yellow-500/20 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-purple-600 dark:bg-yellow-400 text-white dark:text-black flex items-center justify-center shadow-2xs">
                    <Gauge className="w-4 h-4 stroke-[2.5]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900 dark:text-yellow-400 leading-tight">
                      Metronomo Studio con Accenti &amp; Battute
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-yellow-100/60">
                      Tocca i singoli movimenti della battuta per impostare Accento Forte, Medio, Normale o Pausa
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-lg bg-white dark:bg-neutral-900 border border-slate-200 dark:border-yellow-500/30 text-xs font-mono font-bold text-slate-700 dark:text-yellow-300">
                    Battute: {barCount}
                  </span>
                </div>
              </div>

              {/* Body Metronomo */}
              <div className="p-4 space-y-4 flex-1 flex flex-col justify-between">
                {/* Display BPM + Controlli Rapidi + Tap Tempo */}
                <div className="bg-slate-950 dark:bg-[#080808] rounded-2xl p-4 border border-slate-800 dark:border-yellow-500/30 space-y-3 shadow-inner">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    {/* Pulsanti -5 / -1 */}
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setBpm((b) => Math.max(30, b - 5))}
                        className="px-2.5 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-yellow-400 border border-yellow-500/30 font-mono font-bold text-xs cursor-pointer active:scale-95"
                      >
                        -5
                      </button>
                      <button
                        type="button"
                        onClick={() => setBpm((b) => Math.max(30, b - 1))}
                        className="w-9 h-9 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-yellow-400 border border-yellow-500/30 flex items-center justify-center cursor-pointer active:scale-95"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Numero BPM Centrale */}
                    <div className="text-center">
                      <div className="flex items-baseline justify-center gap-1.5">
                        <span className="text-4xl sm:text-5xl font-black font-mono text-yellow-400 tracking-tight">
                          {bpm}
                        </span>
                        <span className="text-xs font-extrabold uppercase text-yellow-500/80">
                          BPM
                        </span>
                      </div>
                      <span className="text-[10px] font-semibold text-neutral-400 block">
                        {bpm < 60
                          ? 'Largo'
                          : bpm < 76
                          ? 'Adagio'
                          : bpm < 108
                          ? 'Andante'
                          : bpm < 120
                          ? 'Moderato'
                          : bpm < 156
                          ? 'Allegro'
                          : 'Presto / Vivace'}
                        {' • '}
                        {selectedTimeSig}
                      </span>
                    </div>

                    {/* Pulsanti +1 / +5 */}
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setBpm((b) => Math.min(260, b + 1))}
                        className="w-9 h-9 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-yellow-400 border border-yellow-500/30 flex items-center justify-center cursor-pointer active:scale-95"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setBpm((b) => Math.min(260, b + 5))}
                        className="px-2.5 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-yellow-400 border border-yellow-500/30 font-mono font-bold text-xs cursor-pointer active:scale-95"
                      >
                        +5
                      </button>
                    </div>
                  </div>

                  {/* Slider BPM */}
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-mono text-neutral-400">30</span>
                    <input
                      type="range"
                      min={30}
                      max={260}
                      value={bpm}
                      onChange={(e) => setBpm(Number(e.target.value))}
                      className="flex-1 accent-yellow-400 h-2 bg-neutral-800 rounded-lg cursor-pointer"
                    />
                    <span className="text-[10px] font-mono text-neutral-400">260</span>
                  </div>

                  {/* Preset BPM + Tap Tempo */}
                  <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1">
                    <div className="flex flex-wrap items-center gap-1">
                      {[60, 80, 100, 120, 140, 160].map((presetBpm) => (
                        <button
                          key={presetBpm}
                          type="button"
                          onClick={() => setBpm(presetBpm)}
                          className={`px-2 py-1 rounded-lg text-[10px] font-mono font-bold border transition-colors cursor-pointer ${
                            bpm === presetBpm
                              ? 'bg-yellow-400 text-black border-yellow-400'
                              : 'bg-neutral-900 text-neutral-300 border-neutral-800 hover:border-yellow-500/40'
                          }`}
                        >
                          {presetBpm}
                        </button>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={handleTapTempo}
                      className="px-3 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-yellow-300 border border-yellow-500/40 text-xs font-extrabold flex items-center gap-1.5 cursor-pointer active:scale-95"
                      title="Tocca ripetutamente a tempo per rilevare i BPM"
                    >
                      <Hand className="w-3.5 h-3.5" />
                      <span>TAP TEMPO</span>
                    </button>
                  </div>
                </div>

                {/* Visualizzatore & Editor Interattivo Accenti della Battuta */}
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-700 dark:text-yellow-300">
                      Accenti della Battuta (Tocca un movimento per cambiare accento):
                    </span>
                    <div className="flex flex-wrap items-center gap-1">
                      <button
                        type="button"
                        onClick={() => applyAccentPreset('downbeat')}
                        className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-neutral-900 dark:text-yellow-300 border border-slate-200 dark:border-yellow-500/20 cursor-pointer"
                      >
                        1° Forte
                      </button>
                      <button
                        type="button"
                        onClick={() => applyAccentPreset('backbeat')}
                        className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-neutral-900 dark:text-yellow-300 border border-slate-200 dark:border-yellow-500/20 cursor-pointer"
                      >
                        Backbeat (2&amp;4)
                      </button>
                      <button
                        type="button"
                        onClick={() => applyAccentPreset('flat')}
                        className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-neutral-900 dark:text-yellow-300 border border-slate-200 dark:border-yellow-500/20 cursor-pointer"
                      >
                        Uguali
                      </button>
                    </div>
                  </div>

                  {/* Beat Boxes */}
                  <div
                    className="grid gap-2"
                    style={{
                      gridTemplateColumns: `repeat(${Math.min(beatsPerBar, 6)}, minmax(0, 1fr))`,
                    }}
                  >
                    {accents.map((acc, idx) => {
                      const isCurrent = isMetronomePlaying && currentBeatIndex === idx;
                      const accLabel =
                        acc === 3 ? 'FORTE' : acc === 2 ? 'MEDIO' : acc === 1 ? 'NORM' : 'MUTO';

                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => toggleBeatAccent(idx)}
                          className={`p-2 rounded-xl border-2 flex flex-col items-center justify-center gap-1 transition-all cursor-pointer select-none ${
                            isCurrent
                              ? 'scale-105 bg-yellow-400 text-black border-yellow-300 shadow-lg shadow-yellow-400/30'
                              : acc === 3
                              ? 'bg-rose-50 border-rose-400 text-rose-800 dark:bg-rose-950/35 dark:border-rose-500/60 dark:text-rose-300'
                              : acc === 2
                              ? 'bg-amber-50 border-amber-400 text-amber-800 dark:bg-amber-950/35 dark:border-amber-500/60 dark:text-amber-300'
                              : acc === 1
                              ? 'bg-blue-50 border-blue-300 text-blue-800 dark:bg-[#141414] dark:border-yellow-500/30 dark:text-yellow-200'
                              : 'bg-slate-100 border-dashed border-slate-300 text-slate-400 dark:bg-neutral-950 dark:border-neutral-800 dark:text-neutral-600'
                          }`}
                          title="Clicca per cambiare accento: Forte -> Medio -> Normale -> Muto"
                        >
                          {/* Visual Accent Bars */}
                          <div className="flex items-end gap-0.5 h-4">
                            <span
                              className={`w-1.5 rounded-full ${
                                acc >= 1 ? 'h-2 bg-current' : 'h-1 bg-current opacity-30'
                              }`}
                            />
                            <span
                              className={`w-1.5 rounded-full ${
                                acc >= 2 ? 'h-3 bg-current' : 'h-1 bg-current opacity-30'
                              }`}
                            />
                            <span
                              className={`w-1.5 rounded-full ${
                                acc === 3 ? 'h-4 bg-current' : 'h-1 bg-current opacity-30'
                              }`}
                            />
                          </div>
                          <span className="text-sm font-black font-mono leading-none">
                            {idx + 1}
                          </span>
                          <span className="text-[9px] font-extrabold uppercase tracking-tight">
                            {accLabel}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Selezione Battuta (Time Signature) & Suddivisioni & Suono */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Battute / Time Signatures */}
                  <div className="bg-slate-50 dark:bg-[#141414] p-3 rounded-xl border border-slate-200 dark:border-yellow-500/20 space-y-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-yellow-400 block">
                      Indicazione di Tempo (Battuta):
                    </span>
                    <div className="grid grid-cols-4 gap-1.5">
                      {TIME_SIGNATURES.map((sig) => {
                        const active = selectedTimeSig === sig.label;
                        return (
                          <button
                            key={sig.label}
                            type="button"
                            onClick={() => handleSelectTimeSignature(sig)}
                            className={`py-1.5 rounded-lg text-xs font-extrabold font-mono border transition-all cursor-pointer ${
                              active
                                ? 'bg-blue-600 text-white border-blue-600 dark:bg-yellow-400 dark:text-black dark:border-yellow-400'
                                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100 dark:bg-neutral-900 dark:text-yellow-100 dark:border-yellow-500/20'
                            }`}
                          >
                            {sig.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Suddivisioni Ritmiche & Timbro */}
                  <div className="bg-slate-50 dark:bg-[#141414] p-3 rounded-xl border border-slate-200 dark:border-yellow-500/20 space-y-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-yellow-400 block">
                      Suddivisione &amp; Suono Click:
                    </span>
                    <div className="grid grid-cols-4 gap-1.5">
                      {[
                        { sub: 1 as SubdivisionType, label: '♩ 1x', desc: 'Quartine' },
                        { sub: 2 as SubdivisionType, label: '♫ 2x', desc: 'Ottavi' },
                        { sub: 3 as SubdivisionType, label: '3 3x', desc: 'Terzine' },
                        { sub: 4 as SubdivisionType, label: '♬ 4x', desc: 'Sedicesimi' },
                      ].map((item) => (
                        <button
                          key={item.sub}
                          type="button"
                          onClick={() => setSubdivision(item.sub)}
                          className={`py-1.5 rounded-lg text-[11px] font-extrabold border transition-all cursor-pointer ${
                            subdivision === item.sub
                              ? 'bg-blue-600 text-white border-blue-600 dark:bg-yellow-400 dark:text-black dark:border-yellow-400'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100 dark:bg-neutral-900 dark:text-yellow-100 dark:border-yellow-500/20'
                          }`}
                          title={item.desc}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>

                    {/* Timbro Audio */}
                    <div className="grid grid-cols-4 gap-1.5 pt-1">
                      {[
                        { id: 'studio_click', label: 'Studio' },
                        { id: 'woodblock', label: 'Legnetto' },
                        { id: 'rimshot', label: 'Rimshot' },
                        { id: 'digital', label: 'Digitale' },
                      ].map((snd) => (
                        <button
                          key={snd.id}
                          type="button"
                          onClick={() => setSoundType(snd.id as MetronomeSound)}
                          className={`py-1 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                            soundType === snd.id
                              ? 'bg-purple-600 text-white border-purple-600 dark:bg-yellow-400/25 dark:text-yellow-300 dark:border-yellow-400'
                              : 'bg-white text-slate-600 border-slate-200 dark:bg-neutral-900 dark:text-neutral-300 dark:border-neutral-800'
                          }`}
                        >
                          {snd.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Start / Stop Metronome + Volume */}
                <div className="pt-1 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={isMetronomePlaying ? stopMetronome : startMetronome}
                    className={`flex-1 min-h-[46px] px-4 py-2.5 rounded-xl font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm ${
                      isMetronomePlaying
                        ? 'bg-rose-600 hover:bg-rose-700 text-white'
                        : 'bg-blue-600 hover:bg-blue-700 text-white dark:bg-yellow-400 dark:hover:bg-yellow-300 dark:text-black'
                    }`}
                  >
                    {isMetronomePlaying ? (
                      <>
                        <Square className="w-4 h-4 fill-current" />
                        <span>Ferma Metronomo</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 fill-current" />
                        <span>Avvia Metronomo ({bpm} BPM)</span>
                      </>
                    )}
                  </button>

                  <div className="flex items-center gap-2 bg-slate-100 dark:bg-[#141414] px-3 py-2.5 rounded-xl border border-slate-200 dark:border-yellow-500/20">
                    <Music className="w-4 h-4 text-slate-500 dark:text-yellow-400 shrink-0" />
                    <input
                      type="range"
                      min={0.1}
                      max={1}
                      step={0.05}
                      value={volume}
                      onChange={(e) => setVolume(Number(e.target.value))}
                      className="w-20 accent-yellow-400 cursor-pointer"
                      title="Volume Metronomo"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => setBarCount(0)}
                    className="min-h-[46px] px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-neutral-900 dark:hover:bg-neutral-800 text-slate-700 dark:text-yellow-300 border border-slate-200 dark:border-yellow-500/20 text-xs font-bold flex items-center gap-1 cursor-pointer"
                    title="Azzera contatore battute"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Sezione Calcolatrice Studio in Fondo / Nella Vista Tool ── */}
      {(activeToolSection === 'all' || activeToolSection === 'calc') && (
        <StudioCalculator
          title="Calcolatrice Rapida Studio & Insegnanti"
          subtitle="Calcola rapidamente ore di lezione, quote sala (×5€/h), resti e divisioni"
        />
      )}
    </div>
  );
};

