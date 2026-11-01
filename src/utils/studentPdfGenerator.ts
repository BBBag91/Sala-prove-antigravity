import jsPDF from 'jspdf';
import { Client, Booking, StudentMonthlyPayment, StudioInfo } from '../types';
import { formatDateItalian, MESI_ITALIANI, formatCurrency } from './dateUtils';

interface GenerateStudentPdfParams {
  student: Client;
  monthStr: string; // YYYY-MM
  lessons: Booking[];
  payment: StudentMonthlyPayment | null;
  studioInfo: StudioInfo;
}

export function generateStudentDossierPdf({
  student,
  monthStr,
  lessons,
  payment,
  studioInfo,
}: GenerateStudentPdfParams): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const [yearStr, monthNumStr] = monthStr.split('-');
  const monthIdx = parseInt(monthNumStr, 10) - 1;
  const monthName = MESI_ITALIANI[monthIdx] || '';

  // Palette colori istituzionale
  const primaryColor = [30, 41, 59]; // slate-800
  const accentColor = [217, 119, 6]; // amber-600
  const secondaryColor = [71, 85, 105]; // slate-600
  const lightBg = [248, 250, 252]; // slate-50
  const borderColor = [226, 232, 240]; // slate-200

  // ── HEADER STUDIO ──
  doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
  doc.roundedRect(14, 12, 182, 28, 3, 3, 'F');
  doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
  doc.roundedRect(14, 12, 182, 28, 3, 3, 'D');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text(studioInfo.nome || 'La musica fa...', 20, 22);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  doc.text(studioInfo.sottotitolo || 'Scuola di Musica • Sale Prova • Studio di Registrazione', 20, 28);
  doc.text(`${studioInfo.indirizzo || ''} - ${studioInfo.cap || ''} ${studioInfo.citta || ''} | Tel: ${studioInfo.telefono || ''}`, 20, 34);

  // ── TITOLO DOCUMENTO ──
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
  doc.text(`SCHEDA MONITORAGGIO ALLIEVO • ${monthName.toUpperCase()} ${yearStr}`, 14, 48);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  doc.text(`Documento generato il ${formatDateItalian(new Date().toISOString().split('T')[0])}`, 140, 48);

  // ── BOX DATI ALLIEVO ──
  let y = 54;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
  doc.roundedRect(14, y, 182, 34, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('Dati Anagrafici & Corso Didattico', 18, y + 7);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text(`Allievo: ${student.nome} ${student.cognome}`, 18, y + 14);
  doc.text(`Codice Fiscale: ${student.codiceFiscale || 'Non specificato'}`, 18, y + 20);
  doc.text(`Telefono: ${student.telefono || 'N/D'}`, 18, y + 26);

  doc.text(`Corso / Strumento: ${student.corsoDidattico || student.gruppoBand || 'Lezioni Musicali'}`, 105, y + 14);
  doc.text(`Docente di Riferimento: ${student.insegnanteRiferimentoNome || 'Insegnante Assegnato'}`, 105, y + 20);
  doc.text(`Email: ${student.email || 'N/D'}`, 105, y + 26);

  // ── BOX STATO PAGAMENTO DEL MESE ──
  y = 94;
  const isPaid = payment?.stato === 'pagato';
  if (isPaid) {
    doc.setFillColor(240, 253, 244); // light green
    doc.setDrawColor(187, 247, 208);
  } else {
    doc.setFillColor(254, 242, 242); // light red
    doc.setDrawColor(254, 202, 202);
  }
  doc.roundedRect(14, y, 182, 24, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  if (isPaid) {
    doc.setTextColor(22, 101, 52); // green-800
    doc.text(`STATO PAGAMENTO MESE: SALDATO ✓`, 18, y + 7);
  } else {
    doc.setTextColor(153, 27, 27); // red-800
    doc.text(`STATO PAGAMENTO MESE: DA SALDARE ⚠️`, 18, y + 7);
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);

  const dataPagamentoTxt = payment?.dataPagamento
    ? formatDateItalian(payment.dataPagamento)
    : 'Non ancora registrata';
  const importoTxt = payment?.importo
    ? formatCurrency(payment.importo)
    : student.quotaMensileCorso
    ? formatCurrency(student.quotaMensileCorso)
    : 'Da definire';
  const metodoTxt = payment?.metodoPagamento
    ? payment.metodoPagamento.toUpperCase()
    : 'N/D';

  doc.text(`Data Pagamento: ${dataPagamentoTxt}`, 18, y + 14);
  doc.text(`Metodo di Pagamento: ${metodoTxt}`, 18, y + 20);

  doc.text(`Importo Mensilità: ${importoTxt}`, 105, y + 14);
  if (payment?.ricevutaNumero) {
    doc.text(`Ricevuta / Rif: ${payment.ricevutaNumero}`, 105, y + 20);
  } else if (payment?.note) {
    doc.text(`Note: ${payment.note}`, 105, y + 20);
  }

  // ── SEZIONE LEZIONI SVOLTE ──
  y = 126;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text(`Riepilogo Dettagliato Lezioni del Mese (${lessons.length})`, 14, y);

  y += 5;
  // Intestazione tabella lezioni
  doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
  doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
  doc.rect(14, y, 182, 8, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  doc.text('DATA LEZIONE', 18, y + 5.5);
  doc.text('ORARIO', 60, y + 5.5);
  doc.text('DURATA', 90, y + 5.5);
  doc.text('SALA PROVE', 112, y + 5.5);
  doc.text('DOCENTE', 142, y + 5.5);
  doc.text('STATO', 174, y + 5.5);

  y += 8;

  let totalOre = 0;
  if (lessons.length === 0) {
    doc.rect(14, y, 182, 12, 'D');
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.text('Nessuna lezione registrata a calendario per questo mese.', 65, y + 7.5);
    y += 12;
  } else {
    lessons.forEach((l, idx) => {
      const isEven = idx % 2 === 0;
      if (isEven) {
        doc.setFillColor(255, 255, 255);
      } else {
        doc.setFillColor(250, 250, 250);
      }
      doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
      doc.rect(14, y, 182, 9, 'FD');

      const dOre = l.durataOre || 1;
      totalOre += dOre;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);

      doc.text(formatDateItalian(l.data), 18, y + 6);
      doc.text(`${l.oraInizio} - ${l.oraFine}`, 60, y + 6);
      doc.text(`${dOre}h`, 90, y + 6);
      doc.text(l.salaNome || 'Sala', 112, y + 6);
      doc.text(l.insegnanteNome || student.insegnanteRiferimentoNome || 'Docente', 142, y + 6);

      // Stato svolta vs futura
      const todayISO = new Date().toISOString().split('T')[0];
      const isPast = l.data <= todayISO;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      if (isPast) {
        doc.setTextColor(22, 101, 52);
        doc.text('SVOLTA ✓', 174, y + 6);
      } else {
        doc.setTextColor(180, 83, 9);
        doc.text('PROGRAM.', 174, y + 6);
      }

      y += 9;
    });
  }

  // Box Totale Ore
  y += 4;
  doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
  doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
  doc.roundedRect(110, y, 86, 12, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text(`Totale Ore Lezioni Mese:`, 114, y + 7.5);
  doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
  doc.text(`${totalOre} Ore`, 172, y + 7.5);

  // ── SEZIONE FIRME & NOTE IN BASSO ──
  const bottomY = 250;
  doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
  doc.line(14, bottomY, 196, bottomY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  doc.text('La presente scheda costituisce resoconto interno didattico ed amministrativo della scuola di musica.', 14, bottomY + 5);

  // Linea Firma Docente
  doc.line(20, bottomY + 22, 75, bottomY + 22);
  doc.text('Firma Docente Incaricato', 25, bottomY + 26);

  // Linea Firma Direzione
  doc.line(135, bottomY + 22, 190, bottomY + 22);
  doc.text('Firma Direzione Studio', 145, bottomY + 26);

  // Scarica PDF
  const filename = `Resoconto_Allievo_${student.cognome}_${student.nome}_${monthStr}.pdf`;
  doc.save(filename);
}
