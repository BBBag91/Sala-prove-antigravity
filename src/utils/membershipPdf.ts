import { jsPDF } from 'jspdf';
import { Client, StudioInfo } from '../types';
import { formatDateItalian } from './dateUtils';

/**
 * Generates and downloads a clean, professional Italian Membership Document or Card as PDF.
 */
export function generateClientMembershipPDF(
  client: Client,
  format: 'form' | 'card' = 'form',
  studioInfo?: StudioInfo
): void {
  if (format === 'card') {
    generateMembershipCardBadgePDF(client, studioInfo);
  } else {
    generateMembershipFormA4PDF(client, studioInfo);
  }
}

/**
 * Generates an official A4 Italian Membership Application & Fee Receipt
 */
function generateMembershipFormA4PDF(client: Client, studioInfo?: StudioInfo): void {
  const studioName = studioInfo?.nome || 'Sound Studio';
  const studioSub = studioInfo?.sottotitolo || 'Associazione Culturale e Centro Musicale Polivalente';
  const studioContacts = [
    studioInfo?.indirizzo ? `Sede: ${studioInfo.indirizzo}` : 'Via delle Note Musicali, 12',
    studioInfo?.telefono ? `Tel: ${studioInfo.telefono}` : '',
    studioInfo?.email ? `Email: ${studioInfo.email}` : '',
  ].filter(Boolean).join(' • ');

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;
  let y = 18;

  // Header Studio / Associazione
  doc.setFillColor(248, 250, 252);
  doc.rect(margin, y, contentWidth, 24, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.rect(margin, y, contentWidth, 24, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(79, 70, 229); // Indigo 600
  doc.text(`SALA PROVE • ${studioName.toUpperCase()}`, margin + 4, y + 8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text(studioSub, margin + 4, y + 13);
  doc.text(studioContacts, margin + 4, y + 18);

  // Right side box with Card Number & Validity
  doc.setFillColor(238, 242, 255);
  doc.rect(pageWidth - margin - 48, y + 3, 44, 18, 'F');
  doc.setDrawColor(199, 210, 254);
  doc.rect(pageWidth - margin - 48, y + 3, 44, 18, 'S');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(67, 56, 202);
  doc.text('TESSERA SOCIO N.', pageWidth - margin - 45, y + 8);
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(client.numeroTessera, pageWidth - margin - 45, y + 15);

  y += 30;

  // Document Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text('SCHEDA DI TESSERAMENTO & RICEVUTA QUOTA SOCIALE', margin, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Documento ufficiale di iscrizione al libro soci e autorizzazione accesso alle sale musicali', margin, y + 5);

  y += 12;

  // Section 1: Dati Anagrafici
  drawSectionHeader(doc, margin, y, contentWidth, '1. DATI ANAGRAFICI DEL SOCIO');
  y += 7;

  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.2);
  doc.rect(margin, y, contentWidth, 42, 'S');

  doc.setFontSize(8.5);
  const leftCol = margin + 4;
  const midCol = margin + 92;

  drawField(doc, leftCol, y + 6, 'Cognome e Nome:', `${client.cognome} ${client.nome}`, true);
  drawField(doc, midCol, y + 6, 'Codice Fiscale:', client.codiceFiscale, true);

  drawField(doc, leftCol, y + 14, 'Nato/a il:', `${formatDateItalian(client.dataNascita, false)} a ${client.luogoNascita} (${client.sesso})`);
  drawField(doc, midCol, y + 14, 'Gruppo / Band:', client.gruppoBand || 'Solista / Indipendente');

  drawField(doc, leftCol, y + 22, 'Residenza:', client.residenza);
  drawField(doc, midCol, y + 22, 'Telefono:', client.telefono || 'Non specificato');

  drawField(doc, leftCol, y + 30, 'Indirizzo Email:', client.email || 'Non specificato');
  drawField(doc, midCol, y + 30, 'Stato Tesseramento:', client.statoTesseramento.toUpperCase(), true);

  y += 48;

  // Section 2: Dettaglio Tesseramento & Quota
  drawSectionHeader(doc, margin, y, contentWidth, '2. DETTAGLIO VALIDITÀ & RICEVUTA QUOTA ANNUALE');
  y += 7;

  doc.setFillColor(255, 255, 255);
  doc.rect(margin, y, contentWidth, 24, 'S');

  drawField(doc, leftCol, y + 6, 'Data Emissione Tessera:', formatDateItalian(client.dataTesseramento, false));
  drawField(doc, midCol, y + 6, 'Data Scadenza Validità:', formatDateItalian(client.dataScadenzaTesseramento, false), true);

  drawField(doc, leftCol, y + 15, 'Ricevuta Quota Sociale:', `€ ${Number(client.quotaTesseramento || 0).toFixed(2)} (pagamento regolarmente registrato)`, true);
  drawField(doc, midCol, y + 15, 'Validità Servizio:', 'Accesso alle Sale Prove 24h e dotazioni studio');

  y += 30;

  // Section 3: Strumentazione Richiesta / Note Tecniche
  drawSectionHeader(doc, margin, y, contentWidth, '3. SPECIFICA STRUMENTAZIONE E RICHIESTE TECNICHE');
  y += 7;

  doc.setFillColor(250, 250, 252);
  doc.rect(margin, y, contentWidth, 22, 'F');
  doc.rect(margin, y, contentWidth, 22, 'S');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  const noteText = client.descrizioneStrumentazione || 'Nessuna dotazione particolare richiesta. Utilizzo configurazione standard di sala.';
  const splitNotes = doc.splitTextToSize(noteText, contentWidth - 8);
  doc.text(splitNotes, leftCol, y + 6);

  y += 28;

  // Section 4: Dichiarazione e Informativa
  drawSectionHeader(doc, margin, y, contentWidth, '4. DICHIARAZIONE DI PRESA VISIONE E CONSENSO PRIVACY');
  y += 7;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  const disclaimer = 
    'Il sottoscritto richiede l\'ammissione a socio e dichiara di aver preso visione dello Statuto associativo e del Regolamento interno ' +
    'di gestione delle Sale Prove musicali, impegnandosi a rispettare le attrezzature audio, i volumi sonori, i divieti di fumo e gli orari ' +
    'concordati nei turni. Ai sensi del Regolamento UE 2016/679 (GDPR), autorizza il trattamento dei dati personali forniti esclusivamente ' +
    'per le finalità associative e gestionali della struttura.';
  const splitDisclaimer = doc.splitTextToSize(disclaimer, contentWidth);
  doc.text(splitDisclaimer, margin, y + 4);

  y += 24;

  // Section 5: Firme
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);

  const todayStr = formatDateItalian(new Date().toISOString().split('T')[0], false);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);

  doc.text(`Luogo e Data: ${studioName}, ${todayStr}`, margin, y + 10);

  // Firma Socio
  doc.text('Firma del Tesserato / Socio:', margin + 60, y + 10);
  doc.line(margin + 60, y + 25, margin + 110, y + 25);

  // Timbro e Firma Associazione
  doc.text('Firma Presidente / Timbro:', margin + 120, y + 10);
  doc.line(margin + 120, y + 25, margin + 170, y + 25);

  // Footer bar
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text(`${studioName} • Copia per archivio soci e tesseramento • Pagina 1 di 1`, margin, 285);

  // Save the document
  const safeName = `${client.cognome}_${client.nome}`.replace(/[^a-zA-Z0-9]/g, '_');
  doc.save(`Modulo_Tesseramento_${client.numeroTessera}_${safeName}.pdf`);
}

/**
 * Generates a compact Pocket Badge Card PDF (Credit Card / Badge format 85.6mm x 54mm)
 */
function generateMembershipCardBadgePDF(client: Client, studioInfo?: StudioInfo): void {
  const studioName = studioInfo?.nome || 'Sound Studio';
  // ISO/IEC 7810 ID-1 card dimensions: 85.6mm x 53.98mm
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: [85.6, 54],
  });

  const cardW = 85.6;
  const cardH = 54;

  // Card Background with slight gradient effect / clean borders
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, cardW, cardH, 'F');

  // Top header band (Indigo)
  doc.setFillColor(67, 56, 202); // indigo-700
  doc.rect(0, 0, cardW, 14, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text(`${studioName.toUpperCase()} • SALA PROVE`, 4, 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(224, 231, 255);
  doc.text('TESSERA SOCIO / MEMBERSHIP PASS', 4, 10.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text('2026', cardW - 12, 8);

  // Left Avatar / Symbol Box
  doc.setFillColor(238, 242, 255);
  doc.setDrawColor(199, 210, 254);
  doc.setLineWidth(0.3);
  doc.roundedRect(4, 17, 18, 22, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(79, 70, 229);
  const initials = `${client.nome.charAt(0)}${client.cognome.charAt(0)}`.toUpperCase();
  doc.text(initials, 9.5, 29);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(4.5);
  doc.setTextColor(100, 116, 139);
  doc.text('SOCIO ATTIVO', 5.5, 35);

  // Member Information
  const infoX = 25;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text(`${client.cognome} ${client.nome}`.toUpperCase(), infoX, 21);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(100, 116, 139);
  doc.text('Codice Fiscale:', infoX, 26);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text(client.codiceFiscale, infoX + 16, 26);

  if (client.gruppoBand) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(100, 116, 139);
    doc.text('Band / Gruppo:', infoX, 31);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(79, 70, 229);
    doc.text(client.gruppoBand, infoX + 16, 31);
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(100, 116, 139);
  doc.text('Scadenza:', infoX, 36);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(formatDateItalian(client.dataScadenzaTesseramento, false), infoX + 16, 36);

  // Bottom card footer with barcode imitation and card number
  doc.setFillColor(248, 250, 252);
  doc.rect(0, 42, cardW, 12, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.line(0, 42, cardW, 42);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(30, 41, 59);
  doc.text(`N. ${client.numeroTessera}`, 4, 49.5);

  // Stylized Barcode lines
  doc.setDrawColor(51, 65, 85);
  doc.setLineWidth(0.4);
  let barX = cardW - 38;
  const barcodePattern = [1, 2, 1, 3, 1, 2, 2, 1, 3, 1, 2, 1, 2, 1, 3, 1, 2, 1];
  barcodePattern.forEach((w) => {
    doc.setLineWidth(w * 0.25);
    doc.line(barX, 44.5, barX, 50.5);
    barX += w * 0.25 + 0.8;
  });

  const safeName = `${client.cognome}_${client.nome}`.replace(/[^a-zA-Z0-9]/g, '_');
  doc.save(`Badge_Tessera_${client.numeroTessera}_${safeName}.pdf`);
}

/**
 * Generates an official Registry of all members as an A4 table PDF.
 */
export function generateMembersRegistryPDF(clients: Client[]): void {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 297;
  const margin = 14;
  let y = 16;

  // Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(67, 56, 202);
  doc.text('REGISTRO GENERALE TESSERATI • SOUND STUDIO', margin, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  const todayStr = formatDateItalian(new Date().toISOString().split('T')[0], true);
  doc.text(`Elenco soci tesserati e stato rinnovi • Generato il ${todayStr}`, margin, y + 5);

  // Summary counts
  const total = clients.length;
  const active = clients.filter((c) => c.statoTesseramento === 'attivo').length;
  const expired = clients.filter((c) => c.statoTesseramento === 'scaduto').length;
  const totalFees = clients.reduce((sum, c) => sum + (c.quotaTesseramento || 0), 0);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`Totale Soci: ${total}   |   Attivi: ${active}   |   Scaduti: ${expired}   |   Quote Incassate: € ${totalFees.toFixed(2)}`, margin + 140, y + 5);

  y += 14;

  // Table Headers
  doc.setFillColor(241, 245, 249);
  doc.rect(margin, y, pageWidth - margin * 2, 8, 'F');
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.2);
  doc.rect(margin, y, pageWidth - margin * 2, 8, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);

  const cols = [
    { label: 'N. Tessera', x: margin + 2, w: 25 },
    { label: 'Socio (Cognome e Nome)', x: margin + 28, w: 55 },
    { label: 'Codice Fiscale', x: margin + 85, w: 38 },
    { label: 'Gruppo / Band', x: margin + 125, w: 42 },
    { label: 'Telefono', x: margin + 169, w: 30 },
    { label: 'Scadenza', x: margin + 201, w: 25 },
    { label: 'Quota', x: margin + 228, w: 18 },
    { label: 'Stato', x: margin + 248, w: 20 },
  ];

  cols.forEach((col) => {
    doc.text(col.label, col.x, y + 5.5);
  });

  y += 8;

  // Rows
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);

  clients.forEach((c, idx) => {
    if (y > 185) {
      doc.addPage();
      y = 16;
      // Re-print header on new page
      doc.setFillColor(241, 245, 249);
      doc.rect(margin, y, pageWidth - margin * 2, 8, 'F');
      cols.forEach((col) => {
        doc.text(col.label, col.x, y + 5.5);
      });
      y += 8;
    }

    // Row alternating background
    if (idx % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, y, pageWidth - margin * 2, 7, 'F');
    }

    doc.setTextColor(15, 23, 42);
    doc.text(c.numeroTessera, cols[0].x, y + 4.8);
    doc.text(`${c.cognome} ${c.nome}`, cols[1].x, y + 4.8);
    doc.text(c.codiceFiscale, cols[2].x, y + 4.8);
    doc.text(c.gruppoBand || '-', cols[3].x, y + 4.8);
    doc.text(c.telefono || '-', cols[4].x, y + 4.8);
    doc.text(formatDateItalian(c.dataScadenzaTesseramento, false), cols[5].x, y + 4.8);
    doc.text(`€ ${Number(c.quotaTesseramento || 0).toFixed(2)}`, cols[6].x, y + 4.8);

    if (c.statoTesseramento === 'attivo') {
      doc.setTextColor(22, 101, 52); // green
      doc.text('ATTIVO', cols[7].x, y + 4.8);
    } else if (c.statoTesseramento === 'scaduto') {
      doc.setTextColor(153, 27, 27); // red
      doc.text('SCADUTO', cols[7].x, y + 4.8);
    } else {
      doc.setTextColor(100, 116, 139);
      doc.text('IN ATTESA', cols[7].x, y + 4.8);
    }

    y += 7;
  });

  doc.save(`Registro_Tesserati_SoundStudio_${new Date().getFullYear()}.pdf`);
}

function drawSectionHeader(doc: jsPDF, x: number, y: number, width: number, title: string): void {
  doc.setFillColor(241, 245, 249);
  doc.rect(x, y, width, 6, 'F');
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.2);
  doc.rect(x, y, width, 6, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);
  doc.text(title, x + 3, y + 4.2);
}

function drawField(doc: jsPDF, x: number, y: number, label: string, value: string, boldValue: boolean = false): void {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(label, x, y);

  if (boldValue) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
  } else {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 41, 59);
  }
  doc.setFontSize(8.5);
  doc.text(value, x, y + 4.5);
}
