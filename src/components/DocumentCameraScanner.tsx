import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Camera,
  Upload,
  Sparkles,
  RefreshCw,
  X,
  CheckCircle2,
  AlertCircle,
  Key,
  Copy,
  Check,
  SwitchCamera,
  ExternalLink,
  Loader2,
  FileText,
  Download,
} from 'lucide-react';
import {
  ExtractedMemberData,
  extractMemberDataFromImage,
  formatMemberForExcel,
  downloadMemberExcelFile,
  getGeminiApiKey,
  setGeminiApiKey,
  testGeminiApiKey,
  hasGeminiApiKey
} from '../services/geminiOcrService';

interface DocumentCameraScannerProps {
  onDataExtracted: (data: ExtractedMemberData) => void;
  className?: string;
}

export const DocumentCameraScanner: React.FC<DocumentCameraScannerProps> = ({
  onDataExtracted,
  className = '',
}) => {
  const [mode, setMode] = useState<'idle' | 'camera' | 'preview' | 'analyzing' | 'success'>('idle');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<ExtractedMemberData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasCopiedExcel, setHasCopiedExcel] = useState(false);

  // Gestione fotocamera
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraLoading, setCameraLoading] = useState(false);

  // Gestione API Key
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [apiKeyTesting, setApiKeyTesting] = useState(false);
  const [apiKeyStatus, setApiKeyStatus] = useState<{ valid?: boolean; message?: string } | null>(null);
  const [hasConfiguredKey, setHasConfiguredKey] = useState(hasGeminiApiKey());

  // Chiudi lo stream video se il componente si smonta
  const stopCameraStream = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      stopCameraStream();
    };
  }, [stopCameraStream]);

  // Avvio stream fotocamera
  const startCamera = async (targetFacing: 'environment' | 'user' = facingMode, deviceId?: string) => {
    stopCameraStream();
    setErrorMessage(null);
    setCameraLoading(true);
    setMode('camera');

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Il browser non supporta l\'accesso diretto alla fotocamera. Usa "Carica Immagine".');
      }

      // Elenco webcam disponibili
      const devices = await navigator.mediaDevices.enumerateDevices().catch(() => []);
      const videoDevices = devices.filter((d) => d.kind === 'videoinput');
      setAvailableCameras(videoDevices);

      const constraints: MediaStreamConstraints = {
        video: deviceId
          ? { deviceId: { exact: deviceId } }
          : {
              facingMode: { ideal: targetFacing },
              width: { ideal: 1920 },
              height: { ideal: 1080 },
            },
        audio: false,
      };

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (e) {
        // Fallback a vincoli generici se fallisce il vincolo ideal
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }

      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
    } catch (err: any) {
      console.error('Errore accesso fotocamera:', err);
      let msg = 'Impossibile accedere alla fotocamera.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        msg = 'Permesso fotocamera negato dal browser. Consenti l\'accesso o carica una foto salvata.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        msg = 'Nessuna fotocamera trovata su questo dispositivo.';
      }
      setErrorMessage(msg);
      setMode('idle');
    } finally {
      setCameraLoading(false);
    }
  };

  // Alterna tra fotocamera frontale e posteriore
  const toggleFacingMode = () => {
    const nextFacing = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextFacing);
    startCamera(nextFacing);
  };

  // Scatto foto
  const capturePhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, width, height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);

    stopCameraStream();
    setCapturedImage(dataUrl);
    setMode('preview');
  };

  // Caricamento file immagine da disco
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMessage(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        setCapturedImage(result);
        setMode('preview');
      }
    };
    reader.onerror = () => {
      setErrorMessage('Errore durante la lettura del file.');
    };
    reader.readAsDataURL(file);
    // Reset input
    e.target.value = '';
  };

  // Esegui scansione con Gemini AI
  const runAiAnalysis = async (imageDataUrl?: string) => {
    const imageToScan = imageDataUrl || capturedImage;
    if (!imageToScan) return;

    // Se non c'è una chiave API configurata, apri il modal per richiederla
    const currentKey = getGeminiApiKey();
    if (!currentKey) {
      setIsApiKeyModalOpen(true);
      return;
    }

    setMode('analyzing');
    setErrorMessage(null);

    try {
      const data = await extractMemberDataFromImage(imageToScan);
      setExtractedData(data);
      onDataExtracted(data);
      setMode('success');
    } catch (err: any) {
      console.error('Errore estrazione IA:', err);
      const msg = err.message || 'Errore durante l\'analisi IA dell\'immagine.';
      setErrorMessage(msg);
      setMode('preview');

      // Se l'errore indica una chiave non valida o non autorizzata, apri la configurazione
      if (msg.includes('401') || msg.includes('API key') || msg.includes('Chiave')) {
        setIsApiKeyModalOpen(true);
      }
    }
  };

  // Copia riga Excel (17 campi) negli appunti
  const handleCopyExcelRow = () => {
    if (!extractedData) return;
    const tsvRow = formatMemberForExcel(extractedData);
    navigator.clipboard.writeText(tsvRow).then(() => {
      setHasCopiedExcel(true);
      setTimeout(() => setHasCopiedExcel(false), 3000);
    });
  };

  // Salva e valida chiave API
  const handleSaveApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKeyInput.trim()) return;

    setApiKeyTesting(true);
    setApiKeyStatus(null);

    const testRes = await testGeminiApiKey(apiKeyInput.trim());
    setApiKeyTesting(false);

    if (testRes.valid) {
      setGeminiApiKey(apiKeyInput.trim());
      setHasConfiguredKey(true);
      setApiKeyStatus({ valid: true, message: 'Chiave Google Gemini verificata con successo!' });
      setTimeout(() => {
        setIsApiKeyModalOpen(false);
        setApiKeyStatus(null);
        // Se c'era un'immagine in anteprima, avvia subito l'analisi
        if (capturedImage && (mode === 'preview' || mode === 'idle')) {
          runAiAnalysis(capturedImage);
        }
      }, 900);
    } else {
      setApiKeyStatus({
        valid: false,
        message: testRes.error || 'Chiave non valida. Assicurati che sia corretta su Google AI Studio.',
      });
    }
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Scheda Principale Banner Scansione */}
      {mode === 'idle' && (
        <div className="relative overflow-hidden rounded-xl border border-indigo-200 bg-gradient-to-r from-indigo-50/90 via-blue-50/60 to-purple-50/70 p-3.5 sm:p-4 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-200 shrink-0">
                <Sparkles className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-slate-900 tracking-tight">
                    Compila da Modulo Cartaceo con IA
                  </h4>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200">
                    HTR Penna
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-0.5">
                  Scatta una foto al foglio cartaceo compilato a mano: l'IA compilerà automaticamente anagrafica, codice fiscale e dati!
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
              <button
                type="button"
                onClick={() => startCamera()}
                className="px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-semibold text-xs shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
                title="Apri fotocamera per scattare una foto al modulo cartaceo"
              >
                <Camera className="w-4 h-4" />
                <span>Scatta Foto</span>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-2 rounded-lg bg-white border border-slate-300 hover:border-indigo-400 hover:bg-slate-50 active:scale-95 text-slate-700 font-semibold text-xs shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer"
                title="Carica foto dalla galleria o dal computer"
              >
                <Upload className="w-4 h-4 text-slate-500" />
                <span className="hidden xs:inline">Carica</span> Foto
              </button>

              <button
                type="button"
                onClick={() => {
                  setApiKeyInput(getGeminiApiKey());
                  setIsApiKeyModalOpen(true);
                }}
                className={`p-2 rounded-lg border transition-colors cursor-pointer ${
                  hasConfiguredKey
                    ? 'border-slate-200 text-slate-500 hover:text-indigo-600 hover:bg-white'
                    : 'border-amber-300 bg-amber-50 text-amber-700 animate-bounce'
                }`}
                title="Impostazioni Chiave API Gemini"
              >
                <Key className="w-4 h-4" />
              </button>
            </div>
          </div>

          {errorMessage && (
            <div className="mt-3 p-2.5 rounded-lg bg-rose-50 border border-rose-200 flex items-center gap-2 text-xs text-rose-700">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>
      )}

      {/* Input File Nascosto */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,application/pdf"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Modal / Viewfinder Fotocamera in Diretta */}
      {mode === 'camera' && (
        <div className="relative rounded-2xl overflow-hidden bg-slate-950 border-2 border-indigo-500 shadow-xl">
          {/* Header Barra Fotocamera */}
          <div className="absolute top-0 inset-x-0 z-20 flex items-center justify-between p-3 bg-gradient-to-b from-black/80 to-transparent">
            <div className="flex items-center gap-2 text-white text-xs font-semibold">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
              <span>Inquadra il modulo di tesseramento</span>
            </div>

            <div className="flex items-center gap-1.5">
              {availableCameras.length > 1 && (
                <button
                  type="button"
                  onClick={toggleFacingMode}
                  className="p-2 rounded-full bg-white/20 hover:bg-white/30 text-white backdrop-blur-md transition-colors"
                  title="Cambia fotocamera (frontale / posteriore)"
                >
                  <SwitchCamera className="w-4 h-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  stopCameraStream();
                  setMode('idle');
                }}
                className="p-2 rounded-full bg-white/20 hover:bg-white/30 text-white backdrop-blur-md transition-colors"
                title="Chiudi fotocamera"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Area Video Viewfinder */}
          <div className="relative w-full aspect-[4/3] sm:aspect-[16/10] bg-black flex items-center justify-center overflow-hidden">
            {cameraLoading && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-900/90 text-white gap-2">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
                <span className="text-xs">Avvio fotocamera in corso...</span>
              </div>
            )}

            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />

            {/* Cornice di Guida Documento (A4 / Modulo) */}
            <div className="absolute inset-6 sm:inset-10 border-2 border-dashed border-white/60 rounded-xl pointer-events-none flex flex-col justify-between p-3 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]">
              <div className="flex justify-between text-white/70 text-[10px] font-mono">
                <span>┌ ALLINEA MODULO CARTACEO</span>
                <span>┐</span>
              </div>
              <div className="flex justify-between text-white/70 text-[10px] font-mono">
                <span>└</span>
                <span>┘</span>
              </div>
            </div>
          </div>

          {/* Footer Fotocamera con Pulsante di Scatto */}
          <div className="p-4 bg-slate-900 flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                stopCameraStream();
                setMode('idle');
              }}
              className="text-xs text-slate-400 hover:text-white px-3 py-1.5 transition-colors"
            >
              Annulla
            </button>

            {/* Tasto Shutter Rotondo */}
            <button
              type="button"
              onClick={capturePhoto}
              disabled={cameraLoading}
              className="w-16 h-16 rounded-full border-4 border-white bg-indigo-600 hover:bg-indigo-500 active:scale-90 flex items-center justify-center shadow-lg transition-transform cursor-pointer"
              title="Scatta foto al documento"
            >
              <div className="w-11 h-11 rounded-full bg-white flex items-center justify-center text-indigo-600">
                <Camera className="w-6 h-6" />
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                stopCameraStream();
                fileInputRef.current?.click();
              }}
              className="text-xs text-indigo-400 hover:text-indigo-300 px-3 py-1.5 flex items-center gap-1 transition-colors"
            >
              <Upload className="w-3.5 h-3.5" />
              Scegli file
            </button>
          </div>
        </div>
      )}

      {/* Anteprima Foto Scattata / Caricata & Conferma Scansione */}
      {(mode === 'preview' || mode === 'analyzing') && capturedImage && (
        <div className="relative rounded-2xl overflow-hidden bg-slate-900 border border-indigo-300 shadow-lg">
          <div className="p-3 bg-slate-800/90 border-b border-slate-700 flex items-center justify-between text-white">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-400" />
              <span className="text-xs font-semibold">Foto Modulo Pronta per la Lettura IA</span>
            </div>
            {mode !== 'analyzing' && (
              <button
                type="button"
                onClick={() => {
                  setCapturedImage(null);
                  setMode('idle');
                }}
                className="text-slate-400 hover:text-white p-1 rounded-md transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Immagine con Effetto Laser di Scansione durante l'analisi */}
          <div className="relative w-full max-h-72 bg-black flex items-center justify-center overflow-hidden">
            <img
              src={capturedImage}
              alt="Modulo cartaceo scattato"
              className={`max-h-72 w-full object-contain transition-opacity duration-300 ${
                mode === 'analyzing' ? 'opacity-85 filter contrast-105' : 'opacity-100'
              }`}
            />

            {/* Linea Laser Animata durante analisi IA */}
            {mode === 'analyzing' && (
              <>
                <div
                  className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_15px_#22d3ee] animate-pulse"
                  style={{
                    animation: 'scanline 2s ease-in-out infinite alternate',
                  }}
                />
                <style>{`
                  @keyframes scanline {
                    0% { top: 5%; }
                    100% { top: 95%; }
                  }
                `}</style>
                <div className="absolute inset-0 bg-indigo-950/40 backdrop-blur-[1px] flex flex-col items-center justify-center p-4 text-center">
                  <div className="p-3 rounded-2xl bg-slate-900/90 border border-indigo-400 shadow-2xl flex flex-col items-center gap-2 text-white">
                    <Loader2 className="w-7 h-7 animate-spin text-cyan-400" />
                    <div>
                      <p className="text-xs font-bold text-slate-100">
                        Riconoscimento Scrittura a Mano (HTR)...
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Estrazione Codice Fiscale, Nome, Cognome, Sesso e Indirizzo
                      </p>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Azioni Anteprima */}
          {mode === 'preview' && (
            <div className="p-3 bg-slate-950 flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => startCamera()}
                className="px-3 py-1.5 rounded-lg border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Rifai Foto
              </button>

              <button
                type="button"
                onClick={() => runAiAnalysis()}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-semibold text-xs shadow-md shadow-indigo-600/30 flex items-center gap-2 transition-all cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-amber-300 animate-spin" />
                <span>Analizza con IA & Compila Scheda</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Stato di Successo & Riepilogo Dati Estratti */}
      {mode === 'success' && extractedData && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/90 p-4 space-y-3 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-emerald-200/80">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-bold text-emerald-950">
                  Dati compilati automaticamente dal foglio a penna!
                </h4>
                <p className="text-[11px] text-emerald-800">
                  I campi sottostanti sono stati pre-compilati. Verifica e ritocca se necessario prima di salvare.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
              {/* Tasto per copiare la riga formattata per Excel */}
              <button
                type="button"
                onClick={handleCopyExcelRow}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer ${
                  hasCopiedExcel
                    ? 'bg-emerald-700 text-white'
                    : 'bg-white border border-emerald-300 text-emerald-900 hover:bg-emerald-100/60'
                }`}
                title="Copia negli appunti la riga tabellare completa di 17 colonne per incollarla su Excel con Ctrl+V"
              >
                {hasCopiedExcel ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    Copiato!
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-emerald-600" />
                    Copia per Excel
                  </>
                )}
              </button>

              {/* Tasto per SCARICARE direttamente il file Excel (.csv con 17 colonne) */}
              <button
                type="button"
                onClick={() => extractedData && downloadMemberExcelFile(extractedData)}
                className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
                title="Scarica direttamente il file Excel (.csv) con intestazioni e dati del modulo compilato a penna"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Scarica File Excel</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setExtractedData(null);
                  setCapturedImage(null);
                  setMode('idle');
                }}
                className="text-xs text-emerald-800 hover:text-emerald-950 p-1.5 rounded-lg hover:bg-emerald-100 transition-colors"
                title="Chiudi banner riepilogo"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Dati Riconosciuti Sintesi Rapida */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className="bg-white/80 p-2 rounded-lg border border-emerald-100">
              <span className="text-[10px] text-emerald-700 font-semibold block uppercase">Nome & Cognome</span>
              <span className="font-bold text-slate-800 truncate block">
                {extractedData.nome} {extractedData.cognome}
              </span>
            </div>
            <div className="bg-white/80 p-2 rounded-lg border border-emerald-100">
              <span className="text-[10px] text-emerald-700 font-semibold block uppercase">Codice Fiscale</span>
              <span className="font-mono font-bold text-indigo-700 truncate block">
                {extractedData.codiceFiscale || '—'}
              </span>
            </div>
            <div className="bg-white/80 p-2 rounded-lg border border-emerald-100">
              <span className="text-[10px] text-emerald-700 font-semibold block uppercase">Nascita & Sesso</span>
              <span className="font-medium text-slate-800 truncate block">
                {extractedData.dataNascita || '—'} ({extractedData.sesso})
              </span>
            </div>
            <div className="bg-white/80 p-2 rounded-lg border border-emerald-100">
              <span className="text-[10px] text-emerald-700 font-semibold block uppercase">Residenza</span>
              <span className="font-medium text-slate-800 truncate block" title={extractedData.residenzaCompleta}>
                {extractedData.residenzaCompleta || '—'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Modal Configurazione Chiave Google Gemini API */}
      {isApiKeyModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
                  <Key className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Chiave Google Gemini API</h3>
                  <p className="text-[11px] text-slate-500">Necessaria per la scansione ottica della scrittura a penna</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsApiKeyModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-200 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveApiKey} className="p-5 space-y-4">
              <div className="p-3 rounded-xl bg-indigo-50/70 border border-indigo-100 text-xs text-indigo-950 space-y-1.5">
                <p className="font-semibold flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600" /> Come ottenere la chiave gratuita:
                </p>
                <p className="text-[11px] text-indigo-800 leading-relaxed">
                  Puoi generare gratuitamente la tua API Key su Google AI Studio in 30 secondi con un comune account Google.
                </p>
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 underline mt-1"
                >
                  Apri Google AI Studio <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Incolla la tua Gemini API Key (inizia per AIzaSy...)
                </label>
                <input
                  type="text"
                  required
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 text-xs font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>

              {apiKeyStatus && (
                <div
                  className={`p-2.5 rounded-lg text-xs flex items-center gap-2 ${
                    apiKeyStatus.valid
                      ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                      : 'bg-rose-50 border border-rose-200 text-rose-800'
                  }`}
                >
                  {apiKeyStatus.valid ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  )}
                  <span>{apiKeyStatus.message}</span>
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsApiKeyModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-medium transition-colors"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  disabled={apiKeyTesting}
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-xs flex items-center gap-1.5 transition-colors disabled:opacity-60 cursor-pointer"
                >
                  {apiKeyTesting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Verifica in corso...
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      Salva e Attiva
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
