import React, { useState, useMemo } from 'react';
import {
  Plus,
  Search,
  Music,
  MapPin,
  Edit2,
  Trash2,
  RotateCcw,
  Phone,
  Mail,
  Printer,
  Download,
  CheckCircle2,
  Clock,
  MessageSquare,
  QrCode,
  GraduationCap,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Client, MembershipStatus } from '../types';
import { formatDateItalian, formatDateToISO, formatCurrency } from '../utils/dateUtils';

const ClientModal = React.lazy(() => import('./ClientModal').then(m => ({ default: m.ClientModal })));
const MembershipCardPrintModal = React.lazy(() => import('./MembershipCardPrintModal').then(m => ({ default: m.MembershipCardPrintModal })));
const MembershipQrCodeModal = React.lazy(() => import('./MembershipQrCodeModal').then(m => ({ default: m.MembershipQrCodeModal })));

// Ordina i tesserati ESATTAMENTE in ordine di inserimento cronologico (dal primo tesserato al più recente)
export const sortClientsChronologically = (list: Client[]): Client[] => {
  return [...list].sort((a, b) => {
    // 1. Data di tesseramento (es. 2026-10-03 prima di 2026-10-07)
    if (a.dataTesseramento && b.dataTesseramento && a.dataTesseramento !== b.dataTesseramento) {
      return a.dataTesseramento.localeCompare(b.dataTesseramento);
    }
    // 2. Numero progressivo tessera (es. TS-2026-001 -> 1, TS-2026-002 -> 2)
    const getProg = (num?: string) => {
      if (!num) return 0;
      const m = num.match(/-(\d+)$/);
      return m ? parseInt(m[1], 10) : 0;
    };
    const pA = getProg(a.numeroTessera);
    const pB = getProg(b.numeroTessera);
    if (pA && pB && pA !== pB) return pA - pB;

    // 3. Timestamp ID progressivo (es. cli-1791035964119)
    const getTs = (client: Client) => {
      if (client.id?.startsWith('cli-')) {
        const num = Number(client.id.replace('cli-', ''));
        if (!isNaN(num)) return num;
      }
      return 0;
    };
    const tsA = getTs(a);
    const tsB = getTs(b);
    if (tsA && tsB && tsA !== tsB) return tsA - tsB;

    return 0;
  });
};

export const ClientsView: React.FC = () => {
  const { clients, deleteClient, updateClient } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | MembershipStatus>('all');
  const [quotaFilter, setQuotaFilter] = useState<'all' | 'pagato' | 'da_saldare'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'allievi' | 'band'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [clientToEdit, setClientToEdit] = useState<Client | null>(null);

  // Print PDF Modal state
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [clientToPrint, setClientToPrint] = useState<Client | null>(null);

  // QR Code Modal state
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);

  const handleOpenPrint = (client: Client | null) => {
    setClientToPrint(client);
    setIsPrintModalOpen(true);
  };

  const filteredClients = useMemo(() => {
    const list = clients.filter((c) => {
      const fullText = `${c.nome} ${c.cognome} ${c.codiceFiscale} ${c.gruppoBand || ''} ${c.insegnanteRiferimentoNome || ''} ${c.corsoDidattico || ''} ${c.residenza}`.toLowerCase();
      const matchSearch = fullText.includes(searchTerm.toLowerCase());
      const matchStatus = statusFilter === 'all' || c.statoTesseramento === statusFilter;
      const isPaid = c.quotaPagata !== undefined ? c.quotaPagata : (c.statoQuota !== 'da_saldare');
      const matchQuota = quotaFilter === 'all' || (quotaFilter === 'pagato' ? isPaid : !isPaid);
      const isStudent = Boolean(c.isAllievo || c.insegnanteRiferimentoNome);
      const matchType =
        typeFilter === 'all'
          ? true
          : typeFilter === 'allievi'
          ? isStudent
          : !isStudent;
      return matchSearch && matchStatus && matchQuota && matchType;
    });
    return sortClientsChronologically(list);
  }, [clients, searchTerm, statusFilter, quotaFilter, typeFilter]);

  const allieviCount = clients.filter((c) => c.isAllievo || !!c.insegnanteRiferimentoNome).length;
  const bandCount = clients.filter((c) => !c.isAllievo && !c.insegnanteRiferimentoNome && !!c.gruppoBand).length;

  const daTesserareCount = clients.filter((c) => c.statoTesseramento === 'da_tesserare').length;
  const activeCount = clients.filter((c) => c.statoTesseramento === 'attivo').length;
  const expiredCount = clients.filter((c) => c.statoTesseramento === 'scaduto').length;
  const pendingCount = clients.filter((c) => c.statoTesseramento === 'in_attesa').length;

  const quoteSaldateCount = clients.filter((c) => (c.quotaPagata !== false && c.statoQuota !== 'da_saldare')).length;
  const quoteSaldateTotal = clients
    .filter((c) => (c.quotaPagata !== false && c.statoQuota !== 'da_saldare'))
    .reduce((sum, c) => sum + (c.quotaTesseramento || 10), 0);

  const quoteDaSaldareCount = clients.filter((c) => (c.quotaPagata === false || c.statoQuota === 'da_saldare')).length;
  const quoteDaSaldareTotal = clients
    .filter((c) => (c.quotaPagata === false || c.statoQuota === 'da_saldare'))
    .reduce((sum, c) => sum + (c.quotaTesseramento || 10), 0);

  // Tesserati da inserire nel file Excel per l'ente:
  // Esclusivamente quelli in stato "da_tesserare" (in ordine cronologico di inserimento)
  const pendingForEnte = useMemo(() => {
    return sortClientsChronologically(
      clients.filter((c) => c.statoTesseramento === 'da_tesserare')
    );
  }, [clients]);

  const handleToggleQuotaPayment = (client: Client) => {
    const isCurrentlyPaid = client.quotaPagata !== undefined ? client.quotaPagata : (client.statoQuota !== 'da_saldare');
    const nextPaid = !isCurrentlyPaid;
    updateClient({
      ...client,
      quotaPagata: nextPaid,
      statoQuota: nextPaid ? 'pagato' : 'da_saldare',
    });
  };

  const handleUpdateStatus = (client: Client, newStatus: MembershipStatus) => {
    updateClient({
      ...client,
      statoTesseramento: newStatus,
    });
  };

  const handleRenewMembership = (client: Client) => {
    const today = new Date();
    const nextYear = new Date(today);
    nextYear.setFullYear(today.getFullYear() + 1);

    updateClient({
      ...client,
      statoTesseramento: 'attivo',
      dataTesseramento: formatDateToISO(today),
      dataScadenzaTesseramento: formatDateToISO(nextYear),
    });
  };

  const handleDelete = (client: Client) => {
    if (
      window.confirm(
        `Sei sicuro di voler eliminare il tesserato ${client.nome} ${client.cognome}?\n\nQuesta operazione lo cancellerà definitivamente sia dal gestionale che dal file Excel dell'ente.`
      )
    ) {
      deleteClient(client.id);
    }
  };

  const handleExportExcel = (exportType: 'ente' | 'all' = 'ente') => {
    let listToExport: Client[] = [];
    const isEnteExport = exportType === 'ente';

    if (isEnteExport) {
      listToExport = pendingForEnte;
      if (listToExport.length === 0) {
        alert(
          'Nessun tesserato "Da tesserare" presente da inviare all\'ente.\n\nTutti i tesserati risultano già contrassegnati come "Inviato all\'Ente" o hanno la tessera attiva.\n\nI nuovi tesserati inseriti online appariranno qui automaticamente in stato "Da tesserare".'
        );
        return;
      }
    } else {
      listToExport = filteredClients.length > 0 ? filteredClients : clients;
      if (listToExport.length === 0) {
        alert('Nessun tesserato presente da esportare.');
        return;
      }
    }

    const escapeCsv = (val?: string | number) => {
      if (val === undefined || val === null || val === '') return '""';
      return `"${String(val).replace(/"/g, '""')}"`;
    };

    const formatDateIT = (iso?: string) => {
      if (!iso) return '';
      const parts = iso.split('-');
      if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
      return iso;
    };

    // Ordina i tesserati ESATTAMENTE in ordine di inserimento cronologico (dal primo inserito al più recente)
    const sortedForExport = sortClientsChronologically(listToExport);

    const parseResidenzaParts = (c: Client) => {
      let indirizzo = '';
      let cap = '';
      let comune = '';
      let nazioneNascita = 'Italia';
      let nazioneCittadinanza = 'Italia';
      let discipline = c.descrizioneStrumentazione || 'Musica / Sala Prove';

      if (c.note && c.note.includes('[META_RESIDENZA:')) {
        try {
          const match = c.note.match(/\[META_RESIDENZA:(\{.*?\})\]/);
          if (match && match[1]) {
            const parsed = JSON.parse(match[1]);
            if (parsed.indirizzo) indirizzo = parsed.indirizzo;
            if (parsed.cap) cap = parsed.cap;
            if (parsed.comune) comune = parsed.comune;
            if (parsed.nazioneNascita) nazioneNascita = parsed.nazioneNascita;
            if (parsed.nazioneCittadinanza) nazioneCittadinanza = parsed.nazioneCittadinanza;
            if (parsed.discipline) discipline = parsed.discipline;
          }
        } catch {}
      }

      if (!indirizzo && c.residenza) {
        const parts = c.residenza.split(',');
        if (parts.length >= 2) {
          indirizzo = parts[0].trim();
          const after = parts.slice(1).join(',').trim();
          const capMatch = after.match(/\b\d{5}\b/);
          if (capMatch) {
            cap = capMatch[0];
            comune = after.replace(capMatch[0], '').replace(/\(.*?\)/, '').trim();
          } else {
            comune = after;
          }
        } else {
          indirizzo = c.residenza.trim();
        }
      }

      return { indirizzo, cap, comune, nazioneNascita, nazioneCittadinanza, discipline };
    };

    const headers = [
      'Classe tesseramento',
      'Tipo tesseramento',
      'Data Inizio',
      'Data Fine',
      'Discipline',
      'Matricola',
      'Nazione cittadinanza',
      'Codice Fiscale',
      'Cognome',
      'Nome',
      'Data di nascita',
      'Sesso',
      'Nazione nascita',
      'Comune di nascita',
      'Comune residenza',
      'CAP residenza',
      'Indirizzo residenza',
    ];

    const rows = sortedForExport.map((c) => {
      const res = parseResidenzaParts(c);
      return [
        escapeCsv('Ordinario'),
        escapeCsv('Socio Ordinario'),
        escapeCsv(formatDateIT(c.dataTesseramento)),
        escapeCsv(formatDateIT(c.dataScadenzaTesseramento)),
        escapeCsv(res.discipline || 'Musica / Sala Prove'),
        escapeCsv(c.numeroTessera || ''),
        escapeCsv(res.nazioneCittadinanza || 'Italia'),
        escapeCsv((c.codiceFiscale || '').toUpperCase().trim()),
        escapeCsv(c.cognome || ''),
        escapeCsv(c.nome || ''),
        escapeCsv(formatDateIT(c.dataNascita)),
        escapeCsv(c.sesso || 'M'),
        escapeCsv(res.nazioneNascita || 'Italia'),
        escapeCsv(c.luogoNascita || ''),
        escapeCsv(res.comune || ''),
        escapeCsv(res.cap || ''),
        escapeCsv(res.indirizzo || c.residenza || ''),
      ].join(';');
    });

    const csvContent = `${headers.join(';')}\n${rows.join('\n')}`;
    const todayStr = new Date().toISOString().split('T')[0];
    const filename = isEnteExport
      ? `tesserati_ente_${todayStr}_(${sortedForExport.length}_soci).csv`
      : `registro_tesserati_completo_${todayStr}.csv`;

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    // Se esportato per l'ente, tutti quelli che erano all'interno passano in stato "inviato all'ente" ed escono dal file Excel
    if (isEnteExport && sortedForExport.length > 0) {
      sortedForExport.forEach((c) => {
        updateClient({
          ...c,
          statoTesseramento: 'in_attesa',
        });
      });
      setTimeout(() => {
        alert(
          `📄 File Excel scaricato con successo (${sortedForExport.length} tesserati).\n\nTutti i ${sortedForExport.length} tesserati sono passati automaticamente allo stato "Inviato all'Ente" e sono usciti dal file Excel.\n\nQuando riceverai le tessere fisiche dall'ente, potrai impostarle manualmente su "Tessera Attiva".`
        );
      }, 400);
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        <div className="bg-white dark:bg-[#0e0e0e] p-3.5 sm:p-4 rounded-xl border border-slate-200 dark:border-yellow-500/25 shadow-xs">
          <p className="text-[11px] font-semibold text-slate-500 dark:text-neutral-400 uppercase tracking-wider flex items-center justify-between">
            <span>Totale Tesserati</span>
            <span className="text-[10px] font-bold text-purple-700 dark:text-purple-400">({allieviCount} allievi)</span>
          </p>
          <p className="text-xl sm:text-2xl font-bold font-mono text-slate-900 dark:text-yellow-100 mt-1">{clients.length}</p>
          <span className="text-[10px] text-slate-500 dark:text-neutral-400 font-medium block">
            {allieviCount} allievi • {bandCount} band
          </span>
        </div>

        <div className={`p-3.5 sm:p-4 rounded-xl border shadow-xs ${
          daTesserareCount > 0
            ? 'bg-amber-50/80 dark:bg-amber-950/25 border-amber-300 dark:border-amber-700/60 text-amber-900 dark:text-amber-200'
            : 'bg-white dark:bg-[#0e0e0e] border-slate-200 dark:border-yellow-500/25 text-slate-700 dark:text-yellow-100'
        }`}>
          <p className="text-[11px] font-semibold text-amber-800 dark:text-amber-300 uppercase tracking-wider flex items-center justify-between">
            <span>Da Tesserare</span>
            <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 font-mono">({daTesserareCount})</span>
          </p>
          <p className="text-xl sm:text-2xl font-bold font-mono text-amber-700 dark:text-amber-300 mt-1">
            {daTesserareCount} <span className="text-xs font-normal">nel file Excel</span>
          </p>
          <span className="text-[10px] text-amber-700/80 font-medium block">Da inviare all&apos;ente</span>
        </div>

        <div className="bg-white dark:bg-[#0e0e0e] p-3.5 sm:p-4 rounded-xl border border-blue-200 dark:border-blue-700/60 bg-blue-50/40 dark:bg-blue-950/20 shadow-xs">
          <p className="text-[11px] font-semibold text-blue-800 dark:text-blue-300 uppercase tracking-wider">
            Inviati all&apos;Ente
          </p>
          <p className="text-xl sm:text-2xl font-bold font-mono text-blue-600 dark:text-blue-400 mt-1">{pendingCount}</p>
          <span className="text-[10px] text-blue-700/80 font-medium block">In attesa tessere</span>
        </div>

        <div className="bg-white dark:bg-[#0e0e0e] p-3.5 sm:p-4 rounded-xl border border-emerald-200 dark:border-emerald-700/60 bg-emerald-50/40 dark:bg-emerald-950/20 shadow-xs">
          <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
            Tessere Attive
          </p>
          <p className="text-xl sm:text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">{activeCount}</p>
          <span className="text-[10px] text-emerald-700/80 font-medium block">Consegnate</span>
        </div>

        <div className="bg-white dark:bg-[#0e0e0e] p-3.5 sm:p-4 rounded-xl border border-slate-200 dark:border-yellow-500/25 shadow-xs">
          <p className="text-[11px] font-semibold text-rose-700 dark:text-rose-400 uppercase tracking-wider">
            Tessere Scadute
          </p>
          <p className="text-xl sm:text-2xl font-bold font-mono text-rose-600 dark:text-rose-400 mt-1">{expiredCount}</p>
          <span className="text-[10px] text-rose-700/80 font-medium block">Da rinnovare</span>
        </div>

        <div className="bg-white dark:bg-[#0e0e0e] p-3.5 sm:p-4 rounded-xl border border-slate-200 dark:border-yellow-500/25 shadow-xs">
          <p className="text-[11px] font-semibold text-slate-700 dark:text-yellow-300 uppercase tracking-wider flex items-center justify-between">
            <span>Quote Saldate</span>
            <span className="text-[10px] font-bold text-slate-500 dark:text-yellow-400 font-mono">({quoteSaldateCount}/{clients.length})</span>
          </p>
          <p className="text-xl sm:text-2xl font-bold font-mono text-emerald-700 dark:text-emerald-400 mt-1">{formatCurrency(quoteSaldateTotal)}</p>
          <span className="text-[10px] text-rose-600 dark:text-rose-400 font-bold block">{quoteDaSaldareCount} da saldare</span>
        </div>
      </div>

      {/* Action Bar */}
      <div className="bg-white dark:bg-[#0e0e0e] p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-yellow-500/25 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400 dark:text-yellow-500/60" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cerca per nome, codice fiscale, band, residenza..."
            className="w-full pl-10 pr-4 py-2.5 min-h-[44px] text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-yellow-500/30 bg-white dark:bg-neutral-950 text-slate-900 dark:text-yellow-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500 dark:focus:ring-yellow-400 touch-manipulation"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3.5 py-2.5 min-h-[44px] text-xs font-semibold rounded-xl border border-slate-200 dark:border-yellow-500/30 bg-slate-50 dark:bg-neutral-900 text-slate-700 dark:text-yellow-200 focus:outline-hidden touch-manipulation cursor-pointer"
          >
            <option value="all">Tutti gli stati ({clients.length})</option>
            <option value="da_tesserare">⏳ Da Tesserare - nel file Excel ({daTesserareCount})</option>
            <option value="in_attesa">📤 Inviati all&apos;Ente ({pendingCount})</option>
            <option value="attivo">✅ Tessere Attive ({activeCount})</option>
            <option value="scaduto">⚠️ Tessere Scadute ({expiredCount})</option>
          </select>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as any)}
            className="px-3.5 py-2.5 min-h-[44px] text-xs font-semibold rounded-xl border border-slate-200 dark:border-yellow-500/30 bg-slate-50 dark:bg-neutral-900 text-slate-700 dark:text-yellow-200 focus:outline-hidden touch-manipulation cursor-pointer"
          >
            <option value="all">Tutte le tipologie ({clients.length})</option>
            <option value="allievi">🎓 Solo Allievi Scuola ({allieviCount})</option>
            <option value="band">🎸 Solo Membri Band / Musicisti ({clients.length - allieviCount})</option>
          </select>

          <select
            value={quotaFilter}
            onChange={(e) => setQuotaFilter(e.target.value as any)}
            className="px-3.5 py-2.5 min-h-[44px] text-xs font-semibold rounded-xl border border-slate-200 dark:border-yellow-500/30 bg-slate-50 dark:bg-neutral-900 text-slate-700 dark:text-yellow-200 focus:outline-hidden touch-manipulation cursor-pointer"
          >
            <option value="all">Tutte le quote</option>
            <option value="pagato">✅ Solo Saldate</option>
            <option value="da_saldare">⏳ Solo Da Saldare</option>
          </select>

          <button
            onClick={() => handleOpenPrint(null)}
            className="px-3.5 py-2.5 min-h-[44px] bg-white dark:bg-neutral-900 hover:bg-slate-50 dark:hover:bg-neutral-800 text-slate-700 dark:text-yellow-300 border border-slate-200 dark:border-yellow-500/30 font-semibold text-xs rounded-xl shadow-2xs transition-all flex items-center justify-center gap-2 touch-manipulation touch-active shrink-0 cursor-pointer"
            title="Stampa Registro Soci o Schede Tessere PDF"
          >
            <Printer className="w-4 h-4 text-blue-600 dark:text-yellow-400" />
            <span className="hidden sm:inline">Stampa / PDF Tessere</span>
          </button>

          {/* Download Excel Buttons: Ente (solo da saldare non in attesa) + Registro Completo */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => handleExportExcel('ente')}
              className="px-3.5 py-2.5 min-h-[44px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 touch-manipulation touch-active shrink-0 cursor-pointer"
              title="Scarica file Excel per l'ente: include solo i tesserati da saldare in ordine di inserimento. Quelli 'In Attesa' sono esclusi."
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Scarica Excel Ente ({pendingForEnte.length})</span>
              <span className="sm:hidden">Excel Ente ({pendingForEnte.length})</span>
            </button>
            <button
              onClick={() => handleExportExcel('all')}
              className="px-2.5 py-2.5 min-h-[44px] bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-neutral-800 dark:hover:bg-neutral-700 dark:text-yellow-200 font-semibold text-xs rounded-xl transition-all flex items-center justify-center gap-1 touch-manipulation touch-active shrink-0 cursor-pointer border border-slate-200 dark:border-yellow-500/30"
              title="Scarica registro completo con tutti i tesserati"
            >
              <span className="hidden md:inline">Tutti ({clients.length})</span>
              <span className="md:hidden">Tutti</span>
            </button>
          </div>

          <button
            onClick={() => {
              const url = `${window.location.origin}/?modulo=tesseramento`;
              const msg = encodeURIComponent(`Ciao! 🎶 Ecco il modulo online per il tesseramento alla nostra Associazione / Sala Prove:\n🔗 ${url}\n\nBastano 2 minuti: compilalo per registrarti automaticamente nei nostri sistemi.`);
              window.open(`https://wa.me/?text=${msg}`, '_blank', 'noopener,noreferrer');
            }}
            className="px-3.5 py-2.5 min-h-[44px] bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-600/50 font-semibold text-xs rounded-xl shadow-2xs transition-all flex items-center justify-center gap-2 touch-manipulation touch-active shrink-0 cursor-pointer"
            title="Invia ai tuoi contatti WhatsApp il link del modulo di tesseramento"
          >
            <MessageSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span className="hidden sm:inline">WhatsApp</span>
            <span className="sm:hidden">WA</span>
          </button>

          <button
            onClick={() => setIsQrModalOpen(true)}
            className="px-3.5 py-2.5 min-h-[44px] bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 text-indigo-800 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-600/50 font-bold text-xs rounded-xl shadow-2xs transition-all flex items-center justify-center gap-2 touch-manipulation touch-active shrink-0 cursor-pointer"
            title="Mostra e scarica il QR Code per il tesseramento da esporre in sala o stampare come locandina"
          >
            <QrCode className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span className="hidden sm:inline">QR Code Iscrizione</span>
            <span className="sm:hidden">QR Code</span>
          </button>

          <button
            onClick={() => {
              setClientToEdit(null);
              setIsModalOpen(true);
            }}
            className="px-4 py-2.5 min-h-[44px] bg-blue-600 hover:bg-blue-700 text-white dark:bg-yellow-400 dark:hover:bg-yellow-300 dark:text-black font-extrabold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 shrink-0 touch-manipulation touch-active cursor-pointer ml-auto sm:ml-0"
          >
            <Plus className="w-4 h-4" />
            <span>Nuovo Tesserato</span>
          </button>
        </div>
      </div>

      {/* Clients Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {filteredClients.map((client) => {
          const isExpired = client.statoTesseramento === 'scaduto';
          const isPendingEnte = client.statoTesseramento === 'in_attesa';

          return (
            <div
              key={client.id}
              className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4 hover:border-slate-300 transition-colors"
            >
              {/* Header Card */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold text-slate-900 text-base sm:text-lg">
                      {client.nome} {client.cognome}
                    </h3>

                    {/* Selettore interattivo dello stato tessera direttamente sulla card */}
                    <select
                      value={client.statoTesseramento}
                      onChange={(e) => handleUpdateStatus(client, e.target.value as MembershipStatus)}
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider border cursor-pointer focus:outline-hidden transition-colors shadow-2xs ${
                        client.statoTesseramento === 'attivo'
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                          : client.statoTesseramento === 'in_attesa'
                          ? 'bg-blue-50 border-blue-300 text-blue-800'
                          : client.statoTesseramento === 'da_tesserare'
                          ? 'bg-amber-50 border-amber-300 text-amber-800'
                          : 'bg-rose-50 border-rose-300 text-rose-800'
                      }`}
                      title="Cambia stato tessera"
                    >
                      <option value="da_tesserare">⏳ Da Tesserare (nel file Excel)</option>
                      <option value="in_attesa">📤 Inviato all&apos;Ente</option>
                      <option value="attivo">✅ Tessera Attiva</option>
                      <option value="scaduto">⚠️ Tessera Scaduta</option>
                    </select>

                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider border flex items-center gap-1 ${
                        client.quotaPagata === false || client.statoQuota === 'da_saldare'
                          ? 'bg-amber-50 border-amber-300 text-amber-800'
                          : 'bg-emerald-50 border-emerald-300 text-emerald-800'
                      }`}
                    >
                      {client.quotaPagata === false || client.statoQuota === 'da_saldare' ? '⏳ Quota Da Saldare' : '✅ Quota Saldata'}
                    </span>
                  </div>

                  {/* Specificazione Tipologia nel resoconto: Allievo (con Docente) vs Band vs Musicista */}
                  {client.isAllievo || client.insegnanteRiferimentoNome ? (
                    <div className="flex items-center gap-1.5 flex-wrap mt-2">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-extrabold bg-purple-100 text-purple-900 border border-purple-300 shadow-2xs">
                        <GraduationCap className="w-3.5 h-3.5 text-purple-700 shrink-0" />
                        <span>Allievo Scuola di Musica</span>
                      </span>
                      {client.insegnanteRiferimentoNome && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-black bg-blue-100 text-blue-900 border border-blue-300 shadow-2xs">
                          <span>Docente: {client.insegnanteRiferimentoNome}</span>
                        </span>
                      )}
                      {client.corsoDidattico && (
                        <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                          {client.corsoDidattico}
                        </span>
                      )}
                    </div>
                  ) : client.gruppoBand ? (
                    <div className="flex items-center gap-1.5 flex-wrap mt-2">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-900 border border-indigo-200">
                        <Music className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                        <span>Membro Band: <strong>{client.gruppoBand}</strong></span>
                      </span>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 mt-1 italic">
                      Musicista Ordinario / Sala Prove
                    </p>
                  )}
                </div>

                {/* Actions (44px touch targets on mobile) */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => handleOpenPrint(client)}
                    className="w-11 h-11 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-500 hover:text-indigo-600 flex items-center justify-center transition-all touch-manipulation touch-active"
                    title="Stampa / Esporta PDF Tessera"
                    aria-label="Stampa tessera"
                  >
                    <Printer className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      setClientToEdit(client);
                      setIsModalOpen(true);
                    }}
                    className="w-11 h-11 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-all touch-manipulation touch-active"
                    title="Modifica scheda"
                    aria-label="Modifica scheda"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(client)}
                    className="w-11 h-11 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 flex items-center justify-center transition-all touch-manipulation touch-active"
                    title="Elimina definitivamente dal gestionale e dal file Excel"
                    aria-label="Elimina scheda"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Anagrafica Details */}
              <div className="bg-slate-50 rounded-xl p-3.5 space-y-2 text-xs text-slate-600 border border-slate-100">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Codice Fiscale</span>
                    <span className="font-mono font-bold text-slate-800">{client.codiceFiscale}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Sesso / Nascita</span>
                    <span className="font-medium text-slate-800">
                      {client.sesso} • {client.luogoNascita} ({client.dataNascita})
                    </span>
                  </div>
                </div>

                <div className="pt-1">
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Residenza</span>
                  <div className="flex items-center gap-1.5 font-medium text-slate-800">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{client.residenza}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  {client.telefono && (
                    <a
                      href={`tel:${client.telefono}`}
                      className="flex items-center gap-1.5 text-slate-700 hover:text-indigo-600 transition-colors py-1 touch-manipulation"
                      title="Chiama da smartphone"
                    >
                      <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="font-semibold underline decoration-slate-300">{client.telefono}</span>
                    </a>
                  )}
                  {client.email && (
                    <a
                      href={`mailto:${client.email}`}
                      className="flex items-center gap-1.5 text-slate-700 hover:text-indigo-600 transition-colors py-1 truncate touch-manipulation"
                      title="Invia email"
                    >
                      <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate underline decoration-slate-300">{client.email}</span>
                    </a>
                  )}
                </div>
              </div>

              {/* Tesseramento info bar & Quick Ente workflow */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <div>
                    <span className="text-slate-500">Tessera N: </span>
                    <strong className="text-slate-800 font-mono text-sm">{client.numeroTessera}</strong>
                    <span className="text-slate-400 ml-2">
                      (Scadenza: <strong>{formatDateItalian(client.dataScadenzaTesseramento, false)}</strong>)
                    </span>
                  </div>

                  {/* Pulsante interattivo Saldato / Da Saldare */}
                  <button
                    type="button"
                    onClick={() => handleToggleQuotaPayment(client)}
                    className={`px-2.5 py-1.5 min-h-[36px] rounded-lg text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer touch-manipulation shadow-2xs select-none ${
                      client.quotaPagata === false || client.statoQuota === 'da_saldare'
                        ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-300'
                        : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300'
                    }`}
                    title={
                      client.quotaPagata === false || client.statoQuota === 'da_saldare'
                        ? 'Quota non saldata. Clicca per impostare come SALDATO'
                        : 'Quota saldata. Clicca per impostare come DA SALDARE'
                    }
                  >
                    {client.quotaPagata === false || client.statoQuota === 'da_saldare' ? (
                      <>
                        <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span>Da saldare ({formatCurrency(client.quotaTesseramento || 10)})</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>Saldato ({formatCurrency(client.quotaTesseramento || 10)})</span>
                      </>
                    )}
                  </button>

                  {/* Se è da tesserare -> pulsante rapido per segnarlo come inviato all'ente manualmente */}
                  {client.statoTesseramento === 'da_tesserare' && (
                    <button
                      type="button"
                      onClick={() => handleUpdateStatus(client, 'in_attesa')}
                      className="px-2.5 py-1.5 min-h-[36px] rounded-lg text-xs font-bold border border-blue-300 bg-blue-50 hover:bg-blue-100 text-blue-900 flex items-center gap-1.5 cursor-pointer shadow-2xs transition-all touch-manipulation"
                      title="Segna come inviato all'ente (toglie il tesserato dal file Excel)"
                    >
                      <Clock className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                      <span>Segna Inviato all&apos;Ente</span>
                    </button>
                  )}

                  {/* Se è in attesa (inviato all'ente) -> pulsante per attivare quando l'ente consegna la tessera */}
                  {client.statoTesseramento === 'in_attesa' && (
                    <button
                      type="button"
                      onClick={() => {
                        updateClient({
                          ...client,
                          statoTesseramento: 'attivo',
                        });
                      }}
                      className="px-2.5 py-1.5 min-h-[36px] rounded-lg text-xs font-bold border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 flex items-center gap-1.5 cursor-pointer shadow-2xs transition-all touch-manipulation"
                      title="Tessera ricevuta dall'ente: imposta come Tessera Attiva"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>Attiva Tessera (Ricevuta)</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleOpenPrint(client)}
                    className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-2 min-h-[44px] bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-semibold text-xs rounded-xl transition-all shadow-2xs touch-manipulation touch-active"
                    title="Stampa Modulo A4 o Badge Tessera PDF"
                  >
                    <Printer className="w-4 h-4 text-indigo-600" />
                    <span>Stampa PDF</span>
                  </button>
                  {isExpired && (
                    <button
                      onClick={() => handleRenewMembership(client)}
                      className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-2 min-h-[44px] bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-all shadow-xs touch-manipulation touch-active"
                    >
                      <RotateCcw className="w-4 h-4" /> Rinnova
                    </button>
                  )}
                </div>
              </div>

              {/* Strumentazione Necessaria (User Requirement 2) */}
              <div className="p-3.5 rounded-lg bg-indigo-50/50 border border-indigo-100 space-y-1">
                <span className="text-xs font-semibold text-indigo-900 flex items-center gap-1.5 uppercase tracking-wider">
                  <Music className="w-3.5 h-3.5 text-indigo-600" /> Strumentazione Necessaria
                </span>
                <p className="text-xs text-slate-700 leading-relaxed">
                  {client.descrizioneStrumentazione || 'Nessuna specifica registrata.'}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {isModalOpen && (
        <React.Suspense fallback={null}>
          <ClientModal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            clientToEdit={clientToEdit}
          />
        </React.Suspense>
      )}

      {isPrintModalOpen && (
        <React.Suspense fallback={null}>
          <MembershipCardPrintModal
            isOpen={isPrintModalOpen}
            onClose={() => setIsPrintModalOpen(false)}
            client={clientToPrint}
            allClients={filteredClients}
          />
        </React.Suspense>
      )}

      {isQrModalOpen && (
        <React.Suspense fallback={null}>
          <MembershipQrCodeModal
            isOpen={isQrModalOpen}
            onClose={() => setIsQrModalOpen(false)}
          />
        </React.Suspense>
      )}
    </div>
  );
};
