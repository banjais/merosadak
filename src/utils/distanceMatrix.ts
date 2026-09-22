import { jsPDF } from 'jspdf';
import { DistanceMatrixCity, DistanceMatrixData } from '../types';
import { formatDistanceKm } from './formatDistance';

export function isDistanceMatrixData(value: unknown): value is DistanceMatrixData {
  if (!value || typeof value !== 'object') return false;

  const candidate = value as Partial<DistanceMatrixData>;
  if (!Array.isArray(candidate.cities) || candidate.cities.length === 0) return false;
  if (!Array.isArray(candidate.matrix) || candidate.matrix.length !== candidate.cities.length) return false;

  const cityIds = new Set<string>();
  for (const city of candidate.cities) {
    if (
      !city ||
      typeof city.id !== 'string' ||
      city.id.length === 0 ||
      typeof city.name !== 'string' ||
      typeof city.district !== 'string' ||
      !Number.isFinite(city.lat) ||
      !Number.isFinite(city.lng) ||
      cityIds.has(city.id)
    ) {
      return false;
    }
    cityIds.add(city.id);
  }

  for (let rowIndex = 0; rowIndex < candidate.matrix.length; rowIndex += 1) {
    const row = candidate.matrix[rowIndex];
    if (!Array.isArray(row) || row.length !== candidate.cities.length) return false;
    for (let columnIndex = 0; columnIndex < row.length; columnIndex += 1) {
      const value = row[columnIndex];
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return false;
      if (rowIndex === columnIndex && value !== 0) return false;
    }
  }

  for (let rowIndex = 0; rowIndex < candidate.matrix.length; rowIndex += 1) {
    for (let columnIndex = rowIndex + 1; columnIndex < candidate.matrix[rowIndex].length; columnIndex += 1) {
      if (candidate.matrix[rowIndex][columnIndex] !== candidate.matrix[columnIndex][rowIndex]) return false;
    }
  }

  return true;
}

export function getMatrixDistance(
  data: DistanceMatrixData,
  rowIndex: number,
  columnIndex: number
): number | null {
  const value = data.matrix[rowIndex]?.[columnIndex];
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

export function getShortMatrixName(name: string): string {
  const withoutDetails = name.replace(/\s*\([^)]*\)/g, '').trim();
  return withoutDetails.split(/\s*[/|]\s*/)[0]?.trim() || withoutDetails;
}

export function getPdfMatrixName(name: string): string {
  return getShortMatrixName(name).replace(/\s+/g, ' ').slice(0, 7);
}

export function exportDistanceMatrixPdf(data: DistanceMatrixData): void {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 6;
  const tableTop = 20;
  const tableTopSticky = 16;
  const tableBottom = pageHeight - 12;
  const tableWidth = pageWidth - margin * 2;
  const cityCount = data.cities.length;
  const labelWidth = Math.min(27, tableWidth * 0.1);
  const availableRowsPerPage = Math.floor((tableBottom - tableTop - tableTopSticky) / 4.5);

  doc.setProperties({
    title: 'Mero Sadak Nepal Distance Matrix',
    subject: 'A4 landscape inter-city distance matrix',
    creator: 'Mero Sadak',
  });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(15, 23, 42);
  doc.text('Nepal Distance Matrix (km)', margin, 8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(3.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Static bundled matrix | A4 landscape | values shown to two decimals', margin, 12);

  doc.setFontSize(2.15);
  doc.setTextColor(15, 23, 42);
  doc.setLineWidth(0.04);
  doc.setDrawColor(203, 213, 225);

  const cellWidth = (tableWidth - labelWidth) / Math.max(1, cityCount);
  const rowHeight = 4.5;

  let currentRow = 0;

  while (currentRow < cityCount) {
    const rowsThisPage = Math.min(availableRowsPerPage, cityCount - currentRow);
    const pageBottom = tableTop + tableTopSticky + rowsThisPage * rowHeight + rowHeight;

    const headerY = tableTop + tableTopSticky;
    doc.setFillColor(248, 250, 252);
    doc.rect(margin, headerY, tableWidth, rowHeight, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(3.5);
    doc.setTextColor(71, 85, 105);
    doc.text('City', margin + 0.6, headerY + rowHeight * 0.68, { align: 'left' });
    for (let columnIndex = 0; columnIndex < rowsThisPage; columnIndex += 1) {
      const actualCol = currentRow + columnIndex;
      const x = margin + labelWidth + columnIndex * cellWidth;
      doc.text(getPdfMatrixName(data.cities[actualCol].name), x + cellWidth / 2, headerY + rowHeight * 0.68, {
        align: 'center',
      });
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(2.15);
    for (let rowIndex = 0; rowIndex < rowsThisPage; rowIndex += 1) {
      const actualRow = currentRow + rowIndex;
      const y = headerY + (rowIndex + 1) * rowHeight;
      const x = margin;
      doc.text(getPdfMatrixName(data.cities[actualRow].name), x + 0.6, y + rowHeight * 0.68, {
        align: 'left',
      });

      for (let columnIndex = 0; columnIndex < rowsThisPage; columnIndex += 1) {
        const actualCol = currentRow + columnIndex;
        const distance = getMatrixDistance(data, actualRow, actualCol);
        const cellX = margin + labelWidth + columnIndex * cellWidth;
        const label = distance === null ? '—' : formatDistanceKm(distance);
        doc.text(label, cellX + cellWidth / 2, y + rowHeight * 0.68, { align: 'center' });
      }
    }

    for (let columnIndex = 0; columnIndex <= rowsThisPage; columnIndex += 1) {
      const x = margin + (columnIndex === 0 ? 0 : columnIndex === 1 ? labelWidth : labelWidth + (columnIndex - 1) * cellWidth);
      doc.line(x, headerY, x, pageBottom);
    }
    for (let rowIndex = 0; rowIndex <= rowsThisPage; rowIndex += 1) {
      const y = headerY + rowIndex * rowHeight;
      doc.line(margin, y, pageWidth - margin, y);
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(3);
    doc.setTextColor(100, 116, 139);
    doc.text('Source: public/data/distance-matrix.json', margin, pageHeight - 3);
    doc.text('Reference values only; no aerial or fallback distances are included.', margin + 40, pageHeight - 3);

    currentRow += rowsThisPage;
    if (currentRow < cityCount) {
      doc.addPage();
    }
  }

  try {
    doc.save('merosadak-distance-matrix-a4.pdf');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[Mero Sadak] Matrix PDF export failed:', message);
  }
}
