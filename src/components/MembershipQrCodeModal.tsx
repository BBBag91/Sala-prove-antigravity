import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import jsPDF from 'jspdf';
import {
  X,
  QrCode,
  Download,
  Copy,
  Check,
  Printer,
  ExternalLink,
  Sparkles,
  Smartphone,
  ShieldCheck,
  Share2,
} from 'lucide-react';
import { useApp } from '../context/AppContext';

interface MembershipQrCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MembershipQrCodeModal: React.FC<MembershipQrCodeModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { studioInfo } = useApp();
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [customUrl, setCustomUrl] = useState<string>('');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // Calcola il link completo predefinito per il modulo tesseramento
  const defaultUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/?modulo=tesseramento`
    : 'http://localhost:3001/?modulo=tesseramento';

  const activeUrl = customUrl.trim() || defaultUrl;

  useEffect(() => {
    if (!isOpen) return;

    // Genera QR Code ad altissima risoluzione (1024x1024) per stampa e download nitidi
    QRCode.toDataURL(activeUrl, {
      width: 1024,
      margin: 2,
      color: {
        dark: '#0f172a', // slate-900 per massimo contrasto
        light: '#ffffff',
      },
      errorCorrectionLevel: 'H', // High error correction per consentire eventuale logo o pieghe foglio
    })
      .then((url) => {
        setQrDataUrl(url);
      })
      .catch((err) => {
        console.error('Errore generazione QR Code:', err);
      });
  }, [isOpen, activeUrl]);

  if (!isOpen) return null;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(activeUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = activeUrl;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownloadPng = () => {
    if (!qrDataUrl) return;
    const link = document.createElement('a');
    link.href = qrDataUrl;
    link.download = `QRCode_Tesseramento_${(studioInfo.nome || 'SalaProve').replace(/\s+/g, '_')}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Genera locandina A4 elegante da stampare ed esporre alla reception o sulle porte delle sale
  const handleDownloadA4Pdf = () => {
    if (!qrDataUrl) return;
    setIsGeneratingPdf(true);

    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4', // 210 x 297 mm
      });

      const pageWidth = 210;
      const pageHeight = 297;

      // Sfondo con bordo decorativo
      doc.setFillColor(255, 255, 255);
      doc.rect(0, 0, pageWidth, pageHeight, 'F');

      // Cornice esterna elegante
      doc.setDrawColor(203, 213, 225); // slate-300
      doc.setLineWidth(0.6);
      doc.roundedRect(10, 10, pageWidth - 20, pageHeight - 20, 5, 5, 'S');

      doc.setDrawColor(37, 99, 235); // blue-600
      doc.setLineWidth(1.2);
      doc.roundedRect(12, 12, pageWidth - 24, pageHeight - 24, 4, 4, 'S');

      // Fascia Superiore Header
      doc.setFillColor(248, 250, 252); // slate-50
      doc.roundedRect(14, 14, pageWidth - 28, 40, 3, 3, 'F');

      // Nome Studio
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(22);
      doc.setTextColor(15, 23, 42); // slate-900
      doc.text(studioInfo.nome || 'SALA PROVE MUSICALE', pageWidth / 2, 28, { align: 'center' });

      // Indirizzo e recapiti
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(100, 116, 139); // slate-500
      const subHeader = `${studioInfo.indirizzo || ''} • ${studioInfo.citta || ''} • Tel: ${studioInfo.telefono || ''}`;
      doc.text(subHeader, pageWidth / 2, 36, { align: 'center' });

      doc.setFontSize(8.5);
      doc.setTextColor(37, 99, 235);
      doc.text('ASSOCIAZIONE CULTURALE & MUSICALE', pageWidth / 2, 44, { align: 'center' });

      // Titolo Principale della Locandina
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(26);
      doc.setTextColor(15, 23, 42);
      doc.text('TESSERAMENTO ONLINE', pageWidth / 2, 70, { align: 'center' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(12);
      doc.setTextColor(71, 85, 105);
      doc.text('Inquadra il QR Code con il tuo smartphone per compilare il modulo', pageWidth / 2, 78, { align: 'center' });
      doc.text('e completare l\'iscrizione annuale alla nostra associazione', pageWidth / 2, 84, { align: 'center' });

      // Box Bianco Centrale per il QR Code
      const qrBoxSize = 100;
      const qrBoxX = (pageWidth - qrBoxSize) / 2;
      const qrBoxY = 94;

      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.5);
      doc.roundedRect(qrBoxX - 4, qrBoxY - 4, qrBoxSize + 8, qrBoxSize + 8, 4, 4, 'FD');

      // Immagine QR Code ad alta risoluzione
      doc.addImage(qrDataUrl, 'PNG', qrBoxX, qrBoxY, qrBoxSize, qrBoxSize);

      // Box Guida 3 Step Sotto al QR Code
      const stepsY = 210;
      doc.setFillColor(241, 245, 249); // slate-100
      doc.roundedRect(20, stepsY, pageWidth - 40, 48, 4, 4, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text('COME FUNZIONA IN 3 SEMPLICI PASSI:', pageWidth / 2, stepsY + 9, { align: 'center' });

      // Step 1
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(37, 99, 235);
      doc.text('1. APRI LA FOTOCAMERA', 28, stepsY + 20);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105);
      doc.text('Punta la fotocamera del tuo cellulare sul QR Code qui sopra', 28, stepsY + 25);

      // Step 2
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(37, 99, 235);
      doc.text('2. COMPILA I TUOI DATI', 28, stepsY + 33);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105);
      doc.text('Inserisci nome, codice fiscale e recapiti in meno di 2 minuti', 28, stepsY + 38);

      // Step 3
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(37, 99, 235);
      doc.text('3. RITIRA LA TUA TESSERA', 28, stepsY + 46);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105);
      doc.text('La tua richiesta viene registrata immediatamente nel nostro gestionale', 28, stepsY + 51);

      // Footer con URL esplicito
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(`Link diretto modulo: ${activeUrl}`, pageWidth / 2, 275, { align: 'center' });

      doc.save(`Locandina_Tesseramento_QRCode_${(studioInfo.nome || 'Studio').replace(/\s+/g, '_')}.pdf`);
    } catch (err) {
      console.error('Errore generazione PDF Locandina:', err);
      alert('Si è verificato un errore durante la creazione del PDF. Puoi scaricare direttamente l\'immagine PNG del QR Code.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-3xl max-w-xl w-full max-h-[92vh] overflow-y-auto shadow-2xl flex flex-col">
        {/* Header Modal */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-neutral-800 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600/10 dark:bg-yellow-400/10 text-blue-600 dark:text-yellow-400 flex items-center justify-center shrink-0">
              <QrCode className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-tight">
                QR Code Iscrizione &amp; Tesseramento
              </h2>
              <p className="text-xs text-slate-500 dark:text-neutral-400">
                Fai inquadrare o stampa la locandina per registrare nuovi soci
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-neutral-800 flex items-center justify-center transition-colors cursor-pointer"
            title="Chiudi"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 space-y-5">
          {/* Box Centrale con QR Code */}
          <div className="flex flex-col items-center justify-center p-5 sm:p-6 rounded-2xl bg-gradient-to-b from-slate-50 to-slate-100 dark:from-neutral-950 dark:to-neutral-900 border border-slate-200 dark:border-neutral-800 text-center space-y-3 shadow-inner">
            <div className="p-3 bg-white rounded-2xl shadow-md border border-slate-100 dark:border-neutral-700">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt="QR Code per Tesseramento"
                  className="w-52 h-52 sm:w-60 sm:h-60 rounded-lg object-contain"
                />
              ) : (
                <div className="w-52 h-52 sm:w-60 sm:h-60 flex items-center justify-center text-slate-400">
                  <QrCode className="w-12 h-12 animate-pulse" />
                </div>
              )}
            </div>

            <div>
              <p className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">
                {studioInfo.nome || 'Sala Prove Musicale'}
              </p>
              <p className="text-xs text-slate-500 dark:text-neutral-400 mt-0.5">
                Punta la fotocamera dello smartphone per compilare il modulo
              </p>
            </div>
          </div>

          {/* Link Diretto e Copia */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-neutral-300 flex items-center justify-between">
              <span>Link al modulo online</span>
              <span className="text-[11px] font-normal text-slate-400">
                Personalizzabile con dominio pubblico
              </span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={activeUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                placeholder={defaultUrl}
                className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-950 text-xs font-mono text-slate-800 dark:text-neutral-200 focus:outline-hidden focus:border-blue-500"
              />
              <button
                type="button"
                onClick={handleCopyLink}
                className={`px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                  copied
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-100 hover:bg-slate-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-slate-700 dark:text-neutral-200'
                }`}
                title="Copia link negli appunti"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'Copiato!' : 'Copia'}</span>
              </button>
            </div>
          </div>

          {/* Azioni di Download e Stampa */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100 dark:border-neutral-800">
            {/* Download Immagine PNG HD */}
            <button
              type="button"
              onClick={handleDownloadPng}
              className="px-4 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white dark:bg-yellow-400 dark:hover:bg-yellow-300 dark:text-black font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md shadow-blue-500/20 dark:shadow-yellow-500/20 transition-all cursor-pointer active:scale-98"
            >
              <Download className="w-4 h-4" />
              <span>Scarica QR Code (PNG HD)</span>
            </button>

            {/* Scarica Locandina A4 in PDF */}
            <button
              type="button"
              onClick={handleDownloadA4Pdf}
              disabled={isGeneratingPdf}
              className="px-4 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md shadow-emerald-500/20 transition-all cursor-pointer active:scale-98 disabled:opacity-50"
            >
              <Printer className="w-4 h-4" />
              <span>{isGeneratingPdf ? 'Generazione...' : 'Scarica Locandina A4 (PDF)'}</span>
            </button>
          </div>

          {/* Guida Rapida */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-neutral-950/60 border border-slate-200 dark:border-neutral-800 text-xs text-slate-600 dark:text-neutral-400 space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-neutral-200">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Suggerimento pratico per la sala</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              Scarica e stampa la <strong>Locandina A4</strong> da appendere alla reception o fuori dalle porte delle sale: i musicisti potranno inquadrarla autonomamente con il proprio smartphone, compilare i dati e apparire subito nel tuo gestionale in stato <em>&quot;Da tesserare&quot;</em> pronti per l&apos;esportazione dell&apos;Excel.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
