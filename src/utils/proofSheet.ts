import { jsPDF } from 'jspdf';
import { DistanceLookupResult, getEvidenceLevelLabel, getEvidenceLevelColor } from './snhLookup';

export interface ProofSheetData {
  from: string;
  to: string;
  fromDistrict?: string;
  toDistrict?: string;
  lookupResult: DistanceLookupResult;
  generatedAt: string;
  dataHash: string;
}

const DOCUMENT_CITATION =
  'Statistics of National Highway (SNH) 2022/23 | Department of Roads, Nepal (HMIS-ICT Unit) | Published June 2024 | 322 pages';

export function generateProofSheet(data: ProofSheetData): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 18;
  const colGap = 8;

  doc.setProperties({
    title: `Distance Verification: ${data.from} → ${data.to}`,
    subject: 'DoR SNH 2022/23 Verified Distance Certificate',
    creator: 'Mero Sadak Nepal',
  });

  let y = margin;

  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 28, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text('DISTANCE VERIFICATION CERTIFICATE', margin, 14);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(153, 161, 179);
  doc.text(
    'Based on Statistics of National Highway (SNH) 2022/23 | Department of Roads, Nepal',
    margin,
    21
  );

  y = 38;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  const distanceStr = `${data.lookupResult.distanceKm.toFixed(2)} km`;
  doc.text(distanceStr, margin, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(153, 161, 179);
  doc.text(
    `${data.from} (${data.fromDistrict || 'N/A'}) → ${data.to} (${data.toDistrict || 'N/A'})`,
    margin,
    y + 5
  );

  const evidenceColor = getEvidenceLevelColor(data.lookupResult.evidenceLevel);
  doc.setFillColor(evidenceColor[0], evidenceColor[1], evidenceColor[2]);
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  const badgeText = getEvidenceLevelLabel(data.lookupResult.evidenceLevel);
  const badgeWidth = doc.getTextWidth(badgeText) + 6;
  doc.rect(pageWidth - margin - badgeWidth, y - 4, badgeWidth, 6, 'F');
  doc.text(badgeText, pageWidth - margin - badgeWidth / 2, y, { align: 'center' });

  y += 14;

  doc.setDrawColor(71, 85, 105);
  doc.setLineWidth(0.4);
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(203, 213, 225);
  doc.text('SOURCE CITATION', margin, y);
  y += 4;

  doc.setFontSize(7.5);
  doc.setTextColor(153, 161, 179);
  const lines: string[] = [
    `Document: ${data.lookupResult.citation?.document || 'SNH 2022/23'}`,
    `Table: ${data.lookupResult.citation?.table || 'N/A'}`,
  ];
  if (data.lookupResult.citation?.row) lines.push(`Row: ${data.lookupResult.citation.row}`);
  if (data.lookupResult.citation?.printedPage)
    lines.push(`Printed page: ${data.lookupResult.citation.printedPage}`);
  if (data.lookupResult.citation?.pdfPage) lines.push(`PDF page: ${data.lookupResult.citation.pdfPage}`);
  if (data.lookupResult.citation?.via) lines.push(`Route: ${data.lookupResult.citation.via}`);

  lines.forEach((line) => {
    doc.text(line, margin, y);
    y += 3.5;
  });

  y += 2;

  if (data.lookupResult.linkChain && data.lookupResult.linkChain.length > 0) {
    doc.setFontSize(8.5);
    doc.setTextColor(203, 213, 225);
    doc.text('LINK-BY-LINK BREAKDOWN', margin, y);
    y += 4;

    const col1X = margin;
    const col2X = margin + 20;
    const col3X = margin + 20 + 45;
    const col4X = pageWidth - margin - 12;

    doc.setFontSize(6.5);
    doc.setTextColor(153, 161, 179);
    doc.text('Seg #', col1X, y);
    doc.text('Link Code', col2X, y);
    doc.text('Link / Segment', col3X, y);
    doc.text('km', col4X, y);
    y += 2.5;

    doc.setDrawColor(71, 85, 105);
    doc.setLineWidth(0.25);
    doc.line(margin, y, pageWidth - margin, y);
    y += 2;

    doc.setFontSize(7);
    doc.setTextColor(203, 213, 225);

    data.lookupResult.linkChain.forEach((entry, idx) => {
      if (y > pageHeight - 30) {
        doc.addPage();
        y = margin;
      }
      const segNum = (idx + 1).toString();
      doc.text(segNum, col1X, y);
      doc.text(entry.code, col2X, y);
      doc.text(entry.name.length > 40 ? entry.name.slice(0, 38) + '…' : entry.name, col3X, y);
      doc.text(entry.lengthKm.toFixed(2), col4X, y);
      y += 4;
    });

    const total = data.lookupResult.linkChain.reduce((sum, e) => sum + e.lengthKm, 0);
    y += 1;
    doc.setDrawColor(71, 85, 105);
    doc.setLineWidth(0.3);
    doc.line(margin, y, pageWidth - margin, y);
    y += 3;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);
    doc.text('TOTAL', col3X, y);
    doc.text(total.toFixed(2), col4X, y);
    y += 6;
  }

  if (data.lookupResult.note) {
    doc.setFontSize(7);
    doc.setTextColor(245, 152, 61);
    doc.setFont('helvetica', 'italic');
    const noteLines = doc.splitTextToSize(data.lookupResult.note, pageWidth - margin * 2);
    doc.text(noteLines, margin, y);
    y += noteLines.length * 3.2 + 4;
  }

  if (data.lookupResult.isUncertain) {
    doc.setFontSize(7);
    doc.setTextColor(245, 152, 61);
    doc.setFont('helvetica', 'bold');
    doc.text('⚠ CAUTION: This figure has an unreconciled component.', margin, y);
    y += 5;
  }

  if (data.lookupResult.citation && data.lookupResult.citation.table === 'Table 6') {
    doc.setFontSize(7);
    doc.setTextColor(153, 161, 179);
    doc.setFont('helvetica', 'normal');
    doc.text(
      'Note: DoR publishes this distance from Kathmandu via NH17 Prithvi Highway. Where the published',
      margin,
      y
    );
    y += 3;
    doc.text('route differs from the shortest official route, both are shown.', margin, y);
    y += 6;
  }

  doc.setFontSize(7);
  doc.setTextColor(153, 161, 179);
  doc.setFont('helvetica', 'normal');
  doc.text('DATA INTEGRITY', margin, y);
  y += 3.5;
  doc.setFontSize(6.5);
  doc.text(`Document: ${DOCUMENT_CITATION}`, margin, y);
  y += 3;
  doc.text(`Data hash: ${data.dataHash}`, margin, y);
  y += 3;
  doc.text(`Generated: ${data.generatedAt}`, margin, y);
  y += 5;

  doc.setDrawColor(71, 85, 105);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;

  doc.setFontSize(7);
  doc.setTextColor(153, 161, 179);
  doc.setFont('helvetica', 'normal');
  doc.text('OFFICIAL CERTIFICATION', margin, y);
  y += 3.5;
  doc.setFontSize(6);
  doc.setTextColor(153, 161, 179);
  doc.text(
    'This sheet is generated from published DoR data (SNH 2022/23). For a DoR-certified',
    margin,
    y
  );
  y += 3;
  doc.text('certificate, the figure must be countersigned by an authorised DoR officer.',
    margin, y);
  y += 3;
  doc.text('Submit this sheet + the SNH 2022/23 reference to HMIS-ICT Unit, DoR for sign-off.',
    margin, y);
  y += 10;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(203, 213, 225);
  doc.text('Department of Roads Authorised Signatory', margin, y);
  y += 1.5;
  doc.setDrawColor(153, 161, 179);
  doc.setLineWidth(0.3);
  doc.line(margin, y, margin + 60, y);
  y += 2.5;
  doc.setFontSize(6.5);
  doc.setTextColor(153, 161, 179);
  doc.text('Name: _____________________  Title: _____________________', margin, y);
  y += 3;
  doc.text('Date: _____________________  Seal: [ ]', margin, y);
  y += 2.5;
  doc.text('This document is valid as of the SNH 2022/23 publication date (June 2024).', margin, y + 2);
  y += 3;
  doc.text('It represents a 2022/23 snapshot and does not reflect live road conditions.', margin, y + 2);
  y += 3;
  doc.text('It represents a 2022/23 snapshot and does not reflect live road conditions.', margin, y + 2);

  doc.save(`merosadak-proof-${data.from.replace(/\s+/g, '-')}-${data.to.replace(/\s+/g, '-')}.pdf`);
}
