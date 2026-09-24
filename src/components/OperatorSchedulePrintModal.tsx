import React, { useState, useMemo } from 'react';
import {
  X,
  Printer,
  Download,
  Calendar,
  Users,
  Clock,
  Euro,
  FileSpreadsheet,
  CheckCircle2,
  Building2,
  Music,
  Filter,
  Sparkles,
} from 'lucide-react';
import { StaffMember, Booking } from '../types';
import { useApp } from '../context/AppContext';
import { formatDateItalian, MESI_ITALIANI, formatDateToISO } from '../utils/dateUtils';
import {
  getOperatorAppointmentsData,
  generateSingleOperatorSchedulePDF,
  generateAllOperatorsScheduleCatalogPDF,
  OperatorScheduleReportData,
} from '../utils/operatorSchedulePdf';

interface OperatorSchedulePrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialOperatorId?: string | null;
}

type PeriodFilterType =
  | 'current_month'
  | 'next_month'
  | 'current_week'
  | 'next_30_days'
  | 'all_upcoming'
  | 'all_time'
  | 'custom';

export const OperatorSchedulePrintModal: React.FC<OperatorSchedulePrintModalProps> = ({
  isOpen,
  onClose,
  initialOperatorId,
}) => {
  const { staff, bookings, studioInfo } = useApp();

  const [selectedOperatorId, setSelectedOperatorId] = useState<string>(
    initialOperatorId || 'all'
  );
  const [periodFilter, setPeriodFilter] = useState<PeriodFilterType>('current_month');
  const [activityFilter, setActivityFilter] = useState<'all' | 'prove' | 'lezione'>('all');

  // Custom date range
  const now = new Date();
  const defaultStartDate = formatDateToISO(now);
  const defaultEndDate = formatDateToISO(new Date(now.getFullYear(), now.getMonth() + 1, 0));
  const [customStart, setCustomStart] = useState<string>(defaultStartDate);
  const [customEnd, setCustomEnd] = useState<string>(defaultEndDate);

  const [isExporting, setIsExporting] = useState(false);

  // Compute active date boundaries and label
  const { startDate, endDate, periodLabel } = useMemo(() => {
    const today = new Date();
    const curYear = today.getFullYear();
    const curMonth = today.getMonth();

    if (periodFilter === 'current_month') {
      const start = new Date(curYear, curMonth, 1);
      const end = new Date(curYear, curMonth + 1, 0);
      return {
        startDate: formatDateToISO(start),
        endDate: formatDateToISO(end),
        periodLabel: `${MESI_ITALIANI[curMonth]} ${curYear}`,
      };
    }

    if (periodFilter === 'next_month') {
      const nextMonthDate = new Date(curYear, curMonth + 1, 1);
      const nextYear = nextMonthDate.getFullYear();
      const nMonth = nextMonthDate.getMonth();
      const start = new Date(nextYear, nMonth, 1);
      const end = new Date(nextYear, nMonth + 1, 0);
      return {
        startDate: formatDateToISO(start),
        endDate: formatDateToISO(end),
        periodLabel: `${MESI_ITALIANI[nMonth]} ${nextYear}`,
      };
    }

    if (periodFilter === 'current_week') {
      // Find Monday of current week
      const dayOfWeek = today.getDay(); // 0 is Sun, 1 is Mon...
      const diffToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday = new Date(today);
      monday.setDate(today.getDate() + diffToMon);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      return {
        startDate: formatDateToISO(monday),
        endDate: formatDateToISO(sunday),
        periodLabel: `Settimana dal ${monday.getDate()} al ${sunday.getDate()} ${MESI_ITALIANI[sunday.getMonth()]} ${sunday.getFullYear()}`,
      };
    }

    if (periodFilter === 'next_30_days') {
      const start = new Date(today);
      const end = new Date(today);
      end.setDate(today.getDate() + 30);
      return {
        startDate: formatDateToISO(start),
        endDate: formatDateToISO(end),
        periodLabel: `Prossimi 30 Giorni (${formatDateItalian(formatDateToISO(start), false)} - ${formatDateItalian(formatDateToISO(end), false)})`,
      };
    }

    if (periodFilter === 'all_upcoming') {
      return {
        startDate: formatDateToISO(today),
        endDate: undefined,
        periodLabel: `Tutti i Prossimi Appuntamenti (da oggi in avanti)`,
      };
    }

    if (periodFilter === 'custom') {
      return {
        startDate: customStart,
        endDate: customEnd,
        periodLabel: `Dal ${formatDateItalian(customStart, false)} al ${formatDateItalian(customEnd, false)}`,
      };
    }

    // all_time
    return {
      startDate: undefined,
      endDate: undefined,
      periodLabel: 'Tutto lo Storico',
    };
  }, [periodFilter, customStart, customEnd]);

  // Compute reports for all operators or single
  const allReports = useMemo(() => {
    return staff.map((op) =>
      getOperatorAppointmentsData(op, bookings, periodLabel, startDate, endDate, activityFilter)
    );
  }, [staff, bookings, periodLabel, startDate, endDate, activityFilter]);

  const activeReport = useMemo(() => {
    if (selectedOperatorId === 'all') return null;
    return allReports.find((r) => r.operator.id === selectedOperatorId) || allReports[0] || null;
  }, [selectedOperatorId, allReports]);

  if (!isOpen) return null;

  const handleDownloadPDF = () => {
    setIsExporting(true);
    try {
      if (selectedOperatorId === 'all') {
        generateAllOperatorsScheduleCatalogPDF(allReports, periodLabel, studioInfo);
      } else if (activeReport) {
        generateSingleOperatorSchedulePDF(activeReport, studioInfo);
      }
    } catch (err) {
      console.error('Errore durante la generazione PDF:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto print:p-0 print:bg-white print:static">
      <div className="relative w-full max-w-5xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden my-4 flex flex-col max-h-[92vh] print:max-h-none print:shadow-none print:border-none print:m-0 print:w-full">
        {/* Header - Hidden on print */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <span>Stampa & Esportazione Appuntamenti Operatori</span>
                <span className="text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/80 px-2 py-0.5 rounded-md">
                  PDF / A4
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                Catalogo e lista dettagliata dei giorni, turni di presidio sala e lezioni musicali per ciascun operatore
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

        {/* Filter Controls Bar - Hidden on print */}
        <div className="p-4 sm:px-6 bg-white border-b border-slate-200 space-y-3 print:hidden">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
            {/* Operator Selection */}
            <div className="md:col-span-4">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                Operatore / Insegnante
              </label>
              <select
                value={selectedOperatorId}
                onChange={(e) => setSelectedOperatorId(e.target.value)}
                className="w-full px-3 py-2 text-xs font-semibold rounded-lg border border-slate-300 bg-slate-50 text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              >
                <option value="all">
                  📁 Tutti gli Operatori ({staff.length}) - Catalogo Completo
                </option>
                {staff.map((op) => (
                  <option key={op.id} value={op.id}>
                    👤 {op.cognome} {op.nome} (
                    {op.ruolo === 'entrambi'
                      ? 'Operatore & Docente'
                      : op.ruolo === 'operatore'
                      ? 'Operatore'
                      : 'Insegnante'}
                    )
                  </option>
                ))}
              </select>
            </div>

            {/* Period Selection */}
            <div className="md:col-span-4">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                Periodo di Riferimento
              </label>
              <select
                value={periodFilter}
                onChange={(e) => setPeriodFilter(e.target.value as PeriodFilterType)}
                className="w-full px-3 py-2 text-xs font-semibold rounded-lg border border-slate-300 bg-slate-50 text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              >
                <option value="current_month">Mese Corrente (Settembre 2026)</option>
                <option value="next_month">Mese Prossimo (Ottobre 2026)</option>
                <option value="current_week">Settimana Corrente</option>
                <option value="next_30_days">Prossimi 30 Giorni</option>
                <option value="all_upcoming">Tutti i Prossimi Appuntamenti</option>
                <option value="all_time">Tutto lo Storico</option>
                <option value="custom">Intervallo Personalizzato...</option>
              </select>
            </div>

            {/* Activity Type Filter */}
            <div className="md:col-span-4">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                Tipologia Attività
              </label>
              <select
                value={activityFilter}
                onChange={(e) => setActivityFilter(e.target.value as 'all' | 'prove' | 'lezione')}
                className="w-full px-3 py-2 text-xs font-semibold rounded-lg border border-slate-300 bg-slate-50 text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              >
                <option value="all">Tutte (Presidi Sala & Lezioni)</option>
                <option value="prove">Solo Presidi Sala Prove</option>
                <option value="lezione">Solo Lezioni di Musica</option>
              </select>
            </div>
          </div>

          {/* Custom Date Inputs if selected */}
          {periodFilter === 'custom' && (
            <div className="flex items-center gap-3 pt-1 text-xs">
              <span className="font-semibold text-slate-600">Da:</span>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="px-2.5 py-1.5 rounded-md border border-slate-300 text-xs font-medium"
              />
              <span className="font-semibold text-slate-600">A:</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="px-2.5 py-1.5 rounded-md border border-slate-300 text-xs font-medium"
              />
            </div>
          )}

          {/* Actions & Metrics row */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
            {/* Quick Summary Pill */}
            <div className="flex items-center gap-2 text-xs">
              <span className="font-semibold text-slate-700">Riepilogo selezione:</span>
              {selectedOperatorId === 'all' ? (
                <span className="bg-indigo-50 text-indigo-700 border border-indigo-200/80 px-2.5 py-1 rounded-md font-bold">
                  {staff.length} Operatori •{' '}
                  {allReports.reduce((s, r) => s + r.totalAppointments, 0)} Appuntamenti Totali (
                  {allReports.reduce((s, r) => s + r.totalHours, 0).toFixed(1)} ore)
                </span>
              ) : activeReport ? (
                <span className="bg-indigo-50 text-indigo-700 border border-indigo-200/80 px-2.5 py-1 rounded-md font-bold">
                  {activeReport.operator.nome} {activeReport.operator.cognome}: {activeReport.totalAppointments} Appuntamenti •{' '}
                  {activeReport.totalHours} ore ({activeReport.totalWorkingDays} giorni)
                  {activeReport.totalCompensation > 0 && ` • Compenso: €${activeReport.totalCompensation}`}
                </span>
              ) : null}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 ml-auto">
              <button
                onClick={handlePrint}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-lg transition-colors flex items-center gap-1.5 shadow-2xs"
                title="Stampa documento direttamente con stampante"
              >
                <Printer className="w-4 h-4 text-slate-600" />
                <span>Stampa</span>
              </button>

              <button
                onClick={handleDownloadPDF}
                disabled={isExporting}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold text-xs rounded-lg shadow-xs transition-colors flex items-center gap-2"
                title="Scarica documento in formato PDF A4 vettoriale"
              >
                <Download className="w-4 h-4" />
                <span>{isExporting ? 'Generazione PDF...' : selectedOperatorId === 'all' ? 'Scarica Catalogo PDF' : 'Scarica PDF'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Scrollable Live Printable A4 Preview Container */}
        <div className="p-4 sm:p-8 bg-slate-100 overflow-y-auto flex-1 flex justify-center print:p-0 print:bg-white print:overflow-visible">
          <div className="w-full max-w-[800px] space-y-8 print:space-y-0">
            {selectedOperatorId === 'all' ? (
              // ALL OPERATORS CATALOG PREVIEW
              <div className="space-y-8 print:space-y-0">
                {/* 1. Master Table Page */}
                <div className="bg-white p-6 sm:p-8 rounded-xl shadow-md border border-slate-200 print:shadow-none print:border-none print:p-6 print:break-after-page">
                  {/* Studio Header */}
                  <div className="border border-slate-200 bg-slate-50/80 rounded-lg p-4 mb-6">
                    <h3 className="text-base font-extrabold text-indigo-600 tracking-tight uppercase">
                      SALA PROVE • {studioInfo.nome}
                    </h3>
                    <p className="text-xs text-slate-500 font-normal">
                      {studioInfo.sottotitolo || 'Gestionale Sala Prove Musicale'}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      {[
                        studioInfo.indirizzo ? `Sede: ${studioInfo.indirizzo}` : '',
                        studioInfo.telefono ? `Tel: ${studioInfo.telefono}` : '',
                        studioInfo.email ? `Email: ${studioInfo.email}` : '',
                        studioInfo.codiceFiscalePiva ? `C.F./P.IVA: ${studioInfo.codiceFiscalePiva}` : '',
                      ]
                        .filter(Boolean)
                        .join(' • ')}
                    </p>
                  </div>

                  <div className="mb-6">
                    <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                      CATALOGO GENERALE APPUNTAMENTI OPERATORI
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">
                      Periodo di riferimento: <strong className="text-slate-800">{periodLabel}</strong>
                    </p>
                  </div>

                  {/* Summary Metric Tiles */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6">
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                      <span className="text-[10px] font-bold uppercase text-slate-400 block">Operatori</span>
                      <span className="text-base font-bold text-slate-900">{staff.length}</span>
                    </div>
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                      <span className="text-[10px] font-bold uppercase text-slate-400 block">Appuntamenti</span>
                      <span className="text-base font-bold text-slate-900">
                        {allReports.reduce((s, r) => s + r.totalAppointments, 0)}
                      </span>
                    </div>
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                      <span className="text-[10px] font-bold uppercase text-slate-400 block">Ore Totali</span>
                      <span className="text-base font-bold text-indigo-600">
                        {allReports.reduce((s, r) => s + r.totalHours, 0).toFixed(1)} h
                      </span>
                    </div>
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                      <span className="text-[10px] font-bold uppercase text-emerald-600 block">Monte Compensi</span>
                      <span className="text-base font-bold font-mono text-emerald-800">
                        € {allReports.reduce((s, r) => s + r.totalCompensation, 0).toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Table of all operators */}
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-indigo-600 text-white font-bold text-[11px]">
                          <th className="py-2.5 px-3">Operatore</th>
                          <th className="py-2.5 px-3">Ruolo</th>
                          <th className="py-2.5 px-2 text-center">Giorni</th>
                          <th className="py-2.5 px-2 text-center">Appuntamenti</th>
                          <th className="py-2.5 px-2 text-center">Ore</th>
                          <th className="py-2.5 px-3 text-right">Compenso</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {allReports.map((r, i) => (
                          <tr key={r.operator.id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}>
                            <td className="py-2.5 px-3 font-semibold text-slate-900">
                              {r.operator.cognome} {r.operator.nome}
                            </td>
                            <td className="py-2.5 px-3 text-[11px] text-slate-500">
                              {r.operator.ruolo === 'entrambi'
                                ? 'Operatore & Docente'
                                : r.operator.ruolo === 'operatore'
                                ? 'Operatore'
                                : 'Insegnante'}
                            </td>
                            <td className="py-2.5 px-2 text-center font-mono">{r.totalWorkingDays}</td>
                            <td className="py-2.5 px-2 text-center font-mono font-bold text-slate-800">
                              {r.totalAppointments}
                            </td>
                            <td className="py-2.5 px-2 text-center font-mono font-bold text-indigo-700">
                              {r.totalHours}h
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700">
                              € {r.totalCompensation.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <p className="text-[11px] text-slate-400 italic mt-4 text-center">
                    * Segue il dettaglio analitico giorno per giorno per ciascun operatore.
                  </p>
                </div>

                {/* Individual Pages for each operator in catalog */}
                {allReports.map((report) => (
                  <OperatorScheduleCard
                    key={report.operator.id}
                    report={report}
                    studioInfo={studioInfo}
                    periodLabel={periodLabel}
                  />
                ))}
              </div>
            ) : (
              // SINGLE OPERATOR PREVIEW
              activeReport && (
                <OperatorScheduleCard
                  report={activeReport}
                  studioInfo={studioInfo}
                  periodLabel={periodLabel}
                />
              )
            )}
          </div>
        </div>

        {/* Footer - Hidden on print */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500 print:hidden">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Documento pronto per la stampa ad alta risoluzione o archiviazione PDF</span>
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

/**
 * Reusable A4 Visual Sheet for a single operator's schedule
 */
const OperatorScheduleCard: React.FC<{
  report: OperatorScheduleReportData;
  studioInfo: any;
  periodLabel: string;
}> = ({ report, studioInfo, periodLabel }) => {
  return (
    <div className="bg-white p-6 sm:p-8 rounded-xl shadow-md border border-slate-200 print:shadow-none print:border-none print:p-6 print:break-after-page space-y-5">
      {/* Studio Header */}
      <div className="border border-slate-200 bg-slate-50/80 rounded-lg p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-extrabold text-indigo-600 tracking-tight uppercase flex items-center gap-1.5">
            <Building2 className="w-4 h-4" />
            <span>SALA PROVE • {studioInfo.nome}</span>
          </h3>
          <p className="text-[11px] text-slate-500 font-normal">
            {studioInfo.sottotitolo || 'Gestionale Sala Prove Musicale'}
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">
            {[
              studioInfo.indirizzo ? `Sede: ${studioInfo.indirizzo}` : '',
              studioInfo.telefono ? `Tel: ${studioInfo.telefono}` : '',
              studioInfo.email ? `Email: ${studioInfo.email}` : '',
            ]
              .filter(Boolean)
              .join(' • ')}
          </p>
        </div>

        <div className="text-right sm:text-right w-full sm:w-auto text-[11px] text-slate-500">
          <span className="font-semibold text-slate-700 block">FOGLIO TURNI & APPUNTAMENTI</span>
          <span>Periodo: <strong className="text-indigo-600">{periodLabel}</strong></span>
        </div>
      </div>

      {/* Operator Banner */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs text-white shadow-2xs"
              style={{ backgroundColor: report.operator.coloreBadge }}
            >
              {report.operator.nome[0]}
              {report.operator.cognome[0]}
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {report.operator.cognome} {report.operator.nome}
              </h2>
              <p className="text-xs text-slate-500">
                {report.operator.ruolo === 'entrambi'
                  ? 'Operatore di Sala & Insegnante'
                  : report.operator.ruolo === 'operatore'
                  ? 'Operatore di Sala'
                  : 'Insegnante / Docente'}
                {report.operator.telefono && ` • Tel: ${report.operator.telefono}`}
              </p>
            </div>
          </div>
        </div>

        <div className="text-left sm:text-right">
          {report.operator.tariffaOrariaRimborso ? (
            <div className="text-xs text-slate-600">
              <span>Tariffa concordata: </span>
              <strong className="text-slate-900 font-mono">€{report.operator.tariffaOrariaRimborso}/ora</strong>
            </div>
          ) : null}
          <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded inline-block mt-0.5">
            {report.operator.attivo ? 'Operatore Attivo' : 'Non Attivo'}
          </span>
        </div>
      </div>

      {/* KPI Tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="bg-slate-50/70 border border-slate-200 rounded-lg p-2.5">
          <span className="text-[10px] uppercase font-bold text-slate-400 block">Giorni Impegnati</span>
          <span className="text-base font-bold text-slate-900">{report.totalWorkingDays} gg</span>
        </div>
        <div className="bg-slate-50/70 border border-slate-200 rounded-lg p-2.5">
          <span className="text-[10px] uppercase font-bold text-slate-400 block">Appuntamenti</span>
          <span className="text-base font-bold text-slate-900">{report.totalAppointments}</span>
        </div>
        <div className="bg-indigo-50/60 border border-indigo-100 rounded-lg p-2.5">
          <span className="text-[10px] uppercase font-bold text-indigo-500 block">Ore Totali</span>
          <span className="text-base font-bold font-mono text-indigo-700">{report.totalHours} ore</span>
        </div>
        <div className="bg-emerald-50/60 border border-emerald-100 rounded-lg p-2.5">
          <span className="text-[10px] uppercase font-bold text-emerald-600 block">Compenso Totale</span>
          <span className="text-base font-bold font-mono text-emerald-800">
            € {report.totalCompensation.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Appointments List / Table */}
      <div className="border border-slate-200 rounded-lg overflow-hidden">
        <div className="bg-indigo-600 text-white px-3 py-2 text-xs font-bold flex items-center justify-between">
          <span>Elenco Dettagliato Appuntamenti e Turni</span>
          <span className="text-[10px] font-normal text-indigo-200">
            Ordinati cronologicamente per data e orario
          </span>
        </div>

        {report.appointments.length === 0 ? (
          <div className="p-8 text-center text-slate-400 italic text-xs bg-slate-50">
            Nessun appuntamento o turno registrato per questo operatore nel periodo selezionato.
          </div>
        ) : (
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100/90 text-slate-700 font-bold border-b border-slate-200 text-[10px] uppercase tracking-wider">
                <th className="py-2 px-3">Data & Giorno</th>
                <th className="py-2 px-2">Orario & Durata</th>
                <th className="py-2 px-2">Sala Prove</th>
                <th className="py-2 px-3">Cliente / Gruppo / Note</th>
                <th className="py-2 px-2">Tipo</th>
                <th className="py-2 px-3 text-right">Compenso</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {report.appointments.map((item, idx) => (
                <tr key={item.booking.id + idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                  <td className="py-2 px-3 font-semibold text-slate-900 whitespace-nowrap">
                    {formatDateItalian(item.date, true)}
                  </td>
                  <td className="py-2 px-2 font-mono whitespace-nowrap text-slate-800">
                    {item.time}{' '}
                    <span className="text-slate-400 font-normal">({item.duration}h)</span>
                  </td>
                  <td className="py-2 px-2 font-medium text-indigo-700">
                    {item.roomName}
                  </td>
                  <td className="py-2 px-3">
                    <span className="font-semibold text-slate-800 block">{item.clientName}</span>
                    {(item.equipment || item.notes) && (
                      <span className="text-[10px] text-slate-500 italic block mt-0.5 line-clamp-1">
                        Note: {item.equipment || item.notes}
                      </span>
                    )}
                  </td>
                  <td className="py-2 px-2 whitespace-nowrap">
                    <span
                      className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${
                        item.activityType === 'Lezione Musica'
                          ? 'bg-purple-50 border-purple-200 text-purple-700'
                          : 'bg-slate-100 border-slate-200 text-slate-700'
                      }`}
                    >
                      {item.activityType === 'Lezione Musica' ? 'Lezione' : 'Presidio'}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-right font-mono font-semibold text-emerald-700 whitespace-nowrap">
                    {item.totalCompensation ? `€${item.totalCompensation.toFixed(0)}` : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Official Signatures Box */}
      <div className="pt-4 border-t border-slate-200 text-xs text-slate-600 grid grid-cols-2 gap-8">
        <div className="space-y-6">
          <p className="text-[11px] text-slate-500">
            Luogo e Data: <strong className="text-slate-800">{studioInfo.citta || 'In sede'}, {formatDateItalian(new Date().toISOString().split('T')[0], false)}</strong>
          </p>
          <div>
            <div className="border-b border-slate-300 w-44 mb-1"></div>
            <span className="text-[10px] text-slate-400">Firma Operatore (ricevuta e presa visione)</span>
          </div>
        </div>

        <div className="space-y-6 text-right flex flex-col items-end">
          <p className="text-[11px] text-slate-500">
            Per la Direzione: <strong className="text-slate-800">{studioInfo.nome}</strong>
          </p>
          <div className="w-full flex flex-col items-end">
            <div className="border-b border-slate-300 w-44 mb-1"></div>
            <span className="text-[10px] text-slate-400">Firma Responsabile / Timbro Sala</span>
          </div>
        </div>
      </div>
    </div>
  );
};
