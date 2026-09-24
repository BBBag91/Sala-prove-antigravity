import React, { useState, useEffect } from 'react';
import {
  X,
  Printer,
  Download,
  FileText,
  User,
  Music,
  ShieldCheck,
  CheckCircle2,
  Edit3,
} from 'lucide-react';
import { Client } from '../types';
import { useApp } from '../context/AppContext';
import { formatDateItalian } from '../utils/dateUtils';
import { generateClientMembershipPDF } from '../utils/membershipPdf';

interface MembershipCardPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: Client | null;
  allClients?: Client[];
}

export const MembershipCardPrintModal: React.FC<MembershipCardPrintModalProps> = ({
  isOpen,
  onClose,
  client,
  allClients = [],
}) => {
  const { updateClient, studioInfo } = useApp();

  // Selected client to print
  const [selectedClientId, setSelectedClientId] = useState<string>(client?.id || allClients[0]?.id || '');
  const activeClient = (client?.id === selectedClientId ? client : allClients.find((c) => c.id === selectedClientId)) || client || allClients[0];

  // Customizable card number
  const [customNumeroTessera, setCustomNumeroTessera] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSavedNotice, setIsSavedNotice] = useState(false);

  useEffect(() => {
    if (client) {
      setSelectedClientId(client.id);
      setCustomNumeroTessera(client.numeroTessera || '');
    } else if (allClients.length > 0) {
      setSelectedClientId(allClients[0].id);
      setCustomNumeroTessera(allClients[0].numeroTessera || '');
    }
  }, [client, allClients, isOpen]);

  if (!isOpen || !activeClient) return null;

  const handleClientSelect = (clientId: string) => {
    setSelectedClientId(clientId);
    const found = allClients.find((c) => c.id === clientId);
    if (found) {
      setCustomNumeroTessera(found.numeroTessera || '');
    }
  };

  const handleCardNumberChange = (newNumber: string) => {
    setCustomNumeroTessera(newNumber);
    // Persist immediately to the client in app context
    updateClient({
      ...activeClient,
      numeroTessera: newNumber,
    });
    setIsSavedNotice(true);
    setTimeout(() => setIsSavedNotice(false), 2000);
  };

  const handleDownloadPDF = () => {
    setIsGenerating(true);
    try {
      const clientToPrint = {
        ...activeClient,
        numeroTessera: customNumeroTessera.trim() || activeClient.numeroTessera,
      };
      generateClientMembershipPDF(clientToPrint, 'form', studioInfo);
    } catch (err) {
      console.error('Error generating PDF:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDirectPrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto print:p-0 print:bg-white">
      <div className="relative w-full max-w-4xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden my-6 flex flex-col max-h-[92vh] print:max-h-none print:shadow-none print:border-none print:m-0 print:w-full">
        {/* Modal Header - Hidden when printing */}
        <div className="px-6 py-3.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                Stampa Scheda Tesseramento & Ricevuta A4
              </h2>
              <p className="text-xs text-slate-500">
                Documento ufficiale di iscrizione con numero di tessera personalizzabile
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

        {/* Action & Customization Bar - Hidden when printing */}
        <div className="px-6 py-3 border-b border-slate-200 bg-white flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 print:hidden">
          {/* Client Selector & Editable Card Number */}
          <div className="flex items-center gap-3 flex-wrap">
            {allClients.length > 1 && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-slate-500">Socio:</span>
                <select
                  value={selectedClientId}
                  onChange={(e) => handleClientSelect(e.target.value)}
                  className="px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 bg-slate-50 text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 max-w-[200px] truncate"
                >
                  {allClients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.cognome} {c.nome} ({c.numeroTessera})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Editable Card Number Field */}
            <div className="flex items-center gap-1.5 bg-indigo-50/70 border border-indigo-200 px-3 py-1 rounded-lg">
              <Edit3 className="w-3.5 h-3.5 text-indigo-600" />
              <label className="text-xs font-bold text-indigo-900 whitespace-nowrap">
                N. Tessera:
              </label>
              <input
                type="text"
                value={customNumeroTessera}
                onChange={(e) => handleCardNumberChange(e.target.value)}
                placeholder="Es. 001, TS-2026..."
                className="w-32 sm:w-36 px-2 py-0.5 font-mono text-xs font-bold text-indigo-950 bg-white border border-indigo-300 rounded focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                title="Modifica il numero di tessera in tempo reale"
              />
              {isSavedNotice && (
                <span className="text-[10px] text-emerald-700 font-bold animate-pulse whitespace-nowrap">
                  Salvato!
                </span>
              )}
            </div>
          </div>

          {/* Print & Download Actions */}
          <div className="flex items-center gap-2 self-end md:self-auto">
            <button
              onClick={handleDirectPrint}
              className="px-3.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs flex items-center gap-1.5 transition-colors shadow-2xs"
              title="Apre la finestra di stampa del browser"
            >
              <Printer className="w-3.5 h-3.5 text-slate-600" />
              <span>Stampa Diretta</span>
            </button>

            <button
              onClick={handleDownloadPDF}
              disabled={isGenerating}
              className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs flex items-center gap-1.5 transition-colors shadow-xs"
              title="Genera e scarica il file PDF A4 sul dispositivo"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isGenerating ? 'Generazione...' : 'Scarica PDF A4'}</span>
            </button>
          </div>
        </div>

        {/* Printable Modulo A4 Preview Area */}
        <div className="p-4 sm:p-6 overflow-y-auto bg-slate-100 flex-1 flex justify-center print:bg-white print:p-0 print:overflow-visible">
          <div
            id="printable-membership-content"
            className="w-full max-w-[210mm] bg-white border border-slate-200 shadow-md p-8 rounded-lg text-slate-800 space-y-6 print:border-none print:shadow-none print:p-0 print:rounded-none"
          >
            {/* Header Studio */}
            <div className="flex items-start justify-between border-b border-slate-200 pb-5">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-xl shadow-xs">
                  {studioInfo.nome ? studioInfo.nome.substring(0, 2).toUpperCase() : 'SP'}
                </div>
                <div>
                  <h1 className="text-xl font-bold tracking-tight text-slate-900">
                    SALA PROVE • {studioInfo.nome.toUpperCase()}
                  </h1>
                  <p className="text-xs text-slate-500 font-medium">
                    {studioInfo.sottotitolo || 'Associazione Culturale Musicale • Centro Prove & Registrazione'}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {[studioInfo.indirizzo, studioInfo.telefono ? `Tel. ${studioInfo.telefono}` : '', studioInfo.email ? `Email: ${studioInfo.email}` : ''].filter(Boolean).join(' • ')}
                  </p>
                </div>
              </div>

              {/* Box Numero Tessera Personalizzabile */}
              <div className="text-right bg-indigo-50/80 border border-indigo-200 p-3 rounded-lg min-w-[170px]">
                <span className="text-[10px] uppercase font-bold text-indigo-700 block">
                  Tessera Socio N.
                </span>
                <div className="mt-1">
                  <input
                    type="text"
                    value={customNumeroTessera}
                    onChange={(e) => handleCardNumberChange(e.target.value)}
                    className="font-mono text-base font-bold text-slate-900 bg-white border border-indigo-300 rounded px-2 py-0.5 text-right w-full focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                    placeholder="Es. 001"
                    title="Numero di tessera personalizzabile"
                  />
                </div>
                <span className="text-[10px] text-slate-500 block mt-1">
                  Anno Sociale {new Date().getFullYear()}
                </span>
              </div>
            </div>

            {/* Title */}
            <div className="text-center py-1">
              <h2 className="text-base font-bold text-slate-900 uppercase tracking-wide">
                Scheda di Tesseramento & Ricevuta Quota Sociale
              </h2>
              <p className="text-xs text-slate-500">
                Documento di iscrizione al libro soci e rilascio autorizzazione accesso sale
              </p>
            </div>

            {/* 1. Dati Anagrafici */}
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-indigo-600" />
                <span>1. Dati Anagrafici del Tesserato</span>
              </div>
              <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Cognome e Nome</span>
                  <span className="font-bold text-slate-900 text-sm">
                    {activeClient.cognome} {activeClient.nome}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Codice Fiscale</span>
                  <span className="font-mono font-bold text-slate-800">
                    {activeClient.codiceFiscale}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Sesso / Nascita</span>
                  <span className="text-slate-700">
                    {activeClient.sesso} • {activeClient.luogoNascita} ({formatDateItalian(activeClient.dataNascita, false)})
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Residenza</span>
                  <span className="text-slate-700">{activeClient.residenza}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Recapito Telefonico</span>
                  <span className="text-slate-700">{activeClient.telefono || 'Non specificato'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Email</span>
                  <span className="text-slate-700 truncate block">{activeClient.email || 'Non specificata'}</span>
                </div>
                <div className="col-span-2 sm:col-span-3 pt-1 border-t border-slate-100 flex items-center gap-4">
                  <div>
                    <span className="text-slate-400 text-[10px] uppercase font-semibold mr-1.5">Gruppo / Band:</span>
                    <strong className="text-indigo-600">{activeClient.gruppoBand || 'Solista / Indipendente'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] uppercase font-semibold mr-1.5">Stato Tessera:</span>
                    <strong className="text-emerald-700 uppercase">{activeClient.statoTesseramento}</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Dettaglio Quota & Validità */}
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                <span>2. Dettagli Validità & Ricevuta Quota Annuale</span>
              </div>
              <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Data Rilascio</span>
                  <span className="font-semibold text-slate-800">
                    {formatDateItalian(activeClient.dataTesseramento, false)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Scadenza Validità</span>
                  <span className="font-bold text-indigo-700">
                    {formatDateItalian(activeClient.dataScadenzaTesseramento, false)}
                  </span>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 rounded-md p-2">
                  <span className="text-emerald-700 block text-[10px] uppercase font-bold">Quota Sociale Versata</span>
                  <span className="text-lg font-bold font-mono text-emerald-900">
                    € {Number(activeClient.quotaTesseramento || 0).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* 3. Strumentazione Richiesta */}
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Music className="w-3.5 h-3.5 text-indigo-600" />
                <span>3. Scheda Strumentazione & Note Tecniche di Sala</span>
              </div>
              <div className="p-4 text-xs text-slate-700 leading-relaxed bg-slate-50/50">
                {activeClient.descrizioneStrumentazione || (
                  <span className="text-slate-400 italic">
                    Nessuna dotazione particolare specificata. Utilizzo della dotazione standard di sala.
                  </span>
                )}
              </div>
            </div>

            {/* 4. Dichiarazione Accettazione Statuto & Regolamento */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px] text-slate-600 space-y-1.5">
              <p className="font-semibold text-slate-800">
                Dichiarazione del Socio e Consenso al Trattamento Dati:
              </p>
              <p className="leading-relaxed">
                Il sottoscritto richiede l'ammissione a socio e dichiara di aver preso integrale visione dello Statuto associativo e del Regolamento interno delle Sale Prove musicali. Si impegna ad un uso diligente della strumentazione audio, al rispetto dei limiti sonori, al divieto assoluto di fumo e al puntuale rispetto dei turni orari concordati. Autorizza il trattamento dei dati personali ai sensi del Regolamento UE 2016/679 (GDPR) unicamente per i fini associativi e gestionali della sala prove.
              </p>
            </div>

            {/* 5. Firme */}
            <div className="pt-6 grid grid-cols-2 gap-8 text-xs text-slate-700">
              <div className="space-y-8">
                <p>
                  Luogo e Data: <strong className="ml-1">{studioInfo.citta || studioInfo.nome}, {formatDateItalian(new Date().toISOString().split('T')[0], false)}</strong>
                </p>
                <div>
                  <div className="border-b border-slate-400 w-48 mb-1"></div>
                  <span className="text-[11px] text-slate-500">Firma del Socio Richiedente</span>
                </div>
              </div>

              <div className="text-right space-y-8 flex flex-col items-end">
                <div className="text-right">
                  <p className="text-slate-500 text-[11px]">Per l'Associazione Musicale:</p>
                  <p className="font-semibold text-slate-800">{studioInfo.nome} Sala Prove</p>
                </div>
                <div>
                  <div className="border-b border-slate-400 w-48 mb-1"></div>
                  <span className="text-[11px] text-slate-500">Firma Presidente / Timbro Ufficiale</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer - Hidden when printing */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500 print:hidden">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Formato vettoriale A4 pronto per la stampa o l'archiviazione PDF</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-semibold transition-colors"
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
};
