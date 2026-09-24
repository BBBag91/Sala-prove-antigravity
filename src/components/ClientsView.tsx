import React, { useState } from 'react';
import {
  Plus,
  Search,
  UserCheck,
  ShieldCheck,
  Music,
  MapPin,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Edit2,
  Trash2,
  RotateCcw,
  Phone,
  Mail,
  Printer,
  FileText,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Client, MembershipStatus } from '../types';
import { formatDateItalian, formatDateToISO, parseISODate } from '../utils/dateUtils';
import { ClientModal } from './ClientModal';
import { MembershipCardPrintModal } from './MembershipCardPrintModal';

export const ClientsView: React.FC = () => {
  const { clients, deleteClient, updateClient } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | MembershipStatus>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [clientToEdit, setClientToEdit] = useState<Client | null>(null);

  // Print PDF Modal state
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [clientToPrint, setClientToPrint] = useState<Client | null>(null);

  const handleOpenPrint = (client: Client | null) => {
    setClientToPrint(client);
    setIsPrintModalOpen(true);
  };

  const filteredClients = clients.filter((c) => {
    const fullText = `${c.nome} ${c.cognome} ${c.codiceFiscale} ${c.gruppoBand || ''} ${c.residenza}`.toLowerCase();
    const matchSearch = fullText.includes(searchTerm.toLowerCase());
    const matchStatus = statusFilter === 'all' || c.statoTesseramento === statusFilter;
    return matchSearch && matchStatus;
  });

  const activeCount = clients.filter((c) => c.statoTesseramento === 'attivo').length;
  const expiredCount = clients.filter((c) => c.statoTesseramento === 'scaduto').length;
  const pendingCount = clients.filter((c) => c.statoTesseramento === 'in_attesa').length;

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
    if (window.confirm(`Sei sicuro di voler eliminare il tesserato ${client.nome} ${client.cognome}?`)) {
      deleteClient(client.id);
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Totale Clienti
          </p>
          <p className="text-2xl font-bold font-mono text-slate-900 mt-1">{clients.length}</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">
            Tessere Attive
          </p>
          <p className="text-2xl font-bold font-mono text-emerald-600 mt-1">{activeCount}</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider">
            Tessere Scadute
          </p>
          <p className="text-2xl font-bold font-mono text-amber-600 mt-1">{expiredCount}</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
            In Attesa / Nuovi
          </p>
          <p className="text-2xl font-bold font-mono text-slate-700 mt-1">{pendingCount}</p>
        </div>
      </div>

      {/* Action Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cerca per nome, codice fiscale, band, residenza..."
            className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm rounded-lg border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-2 text-xs font-semibold rounded-lg border border-slate-200 bg-slate-50 text-slate-700 focus:outline-hidden"
          >
            <option value="all">Tutti gli stati tessera</option>
            <option value="attivo">Solo Attivi</option>
            <option value="scaduto">Solo Scaduti</option>
            <option value="in_attesa">Solo In Attesa</option>
          </select>

          <button
            onClick={() => handleOpenPrint(null)}
            className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-semibold text-xs rounded-lg shadow-2xs transition-colors flex items-center gap-1.5 shrink-0"
            title="Stampa Registro Soci o Schede Tessere PDF"
          >
            <Printer className="w-4 h-4 text-indigo-600" />
            <span className="hidden sm:inline">Stampa / PDF Tessere</span>
          </button>

          <button
            onClick={() => {
              setClientToEdit(null);
              setIsModalOpen(true);
            }}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-lg shadow-xs transition-colors flex items-center gap-1.5 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Registra Nuovo Tesserato</span>
          </button>
        </div>
      </div>

      {/* Clients Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {filteredClients.map((client) => {
          const isExpired = client.statoTesseramento === 'scaduto';
          const isPending = client.statoTesseramento === 'in_attesa';

          return (
            <div
              key={client.id}
              className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4 hover:border-slate-300 transition-colors"
            >
              {/* Header Card */}
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-slate-900 text-lg">
                      {client.nome} {client.cognome}
                    </h3>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider border ${
                        client.statoTesseramento === 'attivo'
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                          : isExpired
                          ? 'bg-rose-50 border-rose-200 text-rose-800'
                          : 'bg-slate-100 border-slate-200 text-slate-700'
                      }`}
                    >
                      {client.statoTesseramento === 'attivo'
                        ? 'Tessera Attiva'
                        : isExpired
                        ? 'Tessera Scaduta'
                        : 'In Attesa'}
                    </span>
                  </div>

                  {client.gruppoBand && (
                    <p className="text-xs font-medium text-indigo-600 mt-0.5">
                      Band: {client.gruppoBand}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleOpenPrint(client)}
                    className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-md hover:bg-slate-100 transition-colors"
                    title="Stampa / Esporta PDF Tessera"
                  >
                    <Printer className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      setClientToEdit(client);
                      setIsModalOpen(true);
                    }}
                    className="p-1.5 text-slate-400 hover:text-slate-700 rounded-md hover:bg-slate-100 transition-colors"
                    title="Modifica scheda"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(client)}
                    className="p-1.5 text-rose-500 hover:text-rose-700 rounded-md hover:bg-rose-50 transition-colors"
                    title="Elimina"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Anagrafica Details */}
              <div className="bg-slate-50 rounded-lg p-3.5 space-y-1.5 text-xs text-slate-600 border border-slate-100">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase">Codice Fiscale</span>
                    <span className="font-mono font-bold text-slate-800">{client.codiceFiscale}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase">Sesso / Nascita</span>
                    <span className="font-medium text-slate-800">
                      {client.sesso} • {client.luogoNascita} ({client.dataNascita})
                    </span>
                  </div>
                </div>

                <div className="pt-1">
                  <span className="text-slate-400 block text-[10px] uppercase">Residenza</span>
                  <div className="flex items-center gap-1 font-medium text-slate-800">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{client.residenza}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  {client.telefono && (
                    <div className="flex items-center gap-1 text-slate-700">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      <span>{client.telefono}</span>
                    </div>
                  )}
                  {client.email && (
                    <div className="flex items-center gap-1 text-slate-700 truncate">
                      <Mail className="w-3.5 h-3.5 text-slate-400" />
                      <span className="truncate">{client.email}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Tesseramento info bar */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs">
                <div>
                  <span className="text-slate-500">Tessera N: </span>
                  <strong className="text-slate-800 font-mono">{client.numeroTessera}</strong>
                  <span className="text-slate-400 ml-2">
                    (Scadenza: <strong>{formatDateItalian(client.dataScadenzaTesseramento, false)}</strong>)
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleOpenPrint(client)}
                    className="flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-semibold text-[11px] rounded-md transition-colors shadow-2xs"
                    title="Stampa Modulo A4 o Badge Tessera PDF"
                  >
                    <Printer className="w-3 h-3 text-indigo-600" />
                    <span>Stampa PDF</span>
                  </button>
                  {isExpired && (
                    <button
                      onClick={() => handleRenewMembership(client)}
                      className="flex items-center gap-1 px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-[11px] rounded-md transition-colors shadow-xs"
                    >
                      <RotateCcw className="w-3 h-3" /> Rinnova
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

      <ClientModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        clientToEdit={clientToEdit}
      />

      <MembershipCardPrintModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        client={clientToPrint}
        allClients={filteredClients}
      />
    </div>
  );
};
