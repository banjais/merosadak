import { jsPDF } from 'jspdf';
import { DistanceWithSource, getEvidenceLevelLabel, getEvidenceLevelColor, getSourceLabel } from './snhLookup';
import QRCode from 'qrcode';
import { formatReportTimestamp } from './reportBranding';
import {
  ProofClaim,
  buildVerifyUrl,
  claimHash,
  nepalDate,
  proofId,
} from './proofLinks';

export interface ProofSheetData {
  from: string;
  to: string;
  fromDistrict?: string;
  toDistrict?: string;
  lookupResult: DistanceWithSource;
  generatedAt: string;
  /** SHA-256 fingerprint (12 hex) of the reference dataset used for this result. */
  dataHash: string;
  /** Origin the verification QR points at; defaults to the running app. */
  appOrigin?: string;
  /** Retained for compatibility with existing callers; not printed in the compact report. */
  issuedToName?: string;
  issuedToEmail?: string;
}

type RGB = [number, number, number];

const INK: RGB = [20, 32, 43];
const MUTED: RGB = [94, 108, 120];
const GREEN: RGB = [20, 91, 64];
const PALE: RGB = [241, 246, 243];
const RULE: RGB = [218, 226, 221];
const AMBER: RGB = [173, 103, 20];

const ascii = (value: string): string =>
  String(value ?? '')
    .replace(/[\u2192\u2794\u27f6]/g, '->')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\u2248/g, '~')
    .replace(/\u2026/g, '...')
    .replace(/[^\x20-\x7e\u00a9\u00b0]/g, '?');

function drawQr(doc: jsPDF, value: string, x: number, y: number, size: number): void {
  const qr = QRCode.create(value, { errorCorrectionLevel: 'M' });
  const count: number = qr.modules.size;
  const quiet = 4;
  const moduleSize = size / (count + quiet * 2);
  doc.setFillColor(255, 255, 255);
  doc.rect(x, y, size, size, 'F');
  doc.setFillColor(0, 0, 0);

  for (let row = 0; row < count; row++) {
    let col = 0;
    while (col < count) {
      if (!qr.modules.get(row, col)) {
        col++;
        continue;
      }
      let run = 1;
      while (col + run < count && qr.modules.get(row, col + run)) run++;
      doc.rect(
        x + (quiet + col) * moduleSize,
        y + (quiet + row) * moduleSize,
        moduleSize * run + 0.01,
        moduleSize + 0.01,
        'F',
      );
      col += run;
    }
  }
}

/**
 * Compact, single-page A4 distance report.
 * The result is an independent MeroSadak calculation; DoR appears only as a
 * cited data source when the selected evidence actually comes from DoR.
 */
export async function buildProofSheet(
  data: ProofSheetData,
): Promise<{ doc: jsPDF; claim: ProofClaim; verifyUrl: string }> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 14;
  const contentW = W - M * 2;
  const res = data.lookupResult;
  const sourceUrl = res.source === 'dor_geojson'
    ? 'https://ssrn.dor.gov.np/road_network/getNationCategoryAndPavement'
    : res.source === 'dor_snh'
      ? 'https://dor.gov.np/home/page/statistics-of-national-highway--snh--2022-23'
      : '';

  const printedAt = new Date(data.generatedAt);
  const baseClaim = {
    from: data.from,
    to: data.to,
    km: Math.round(res.distanceKm * 100) / 100,
    lv: res.evidenceLevel,
    d: nepalDate(printedAt),
  };
  const claim: ProofClaim = { ...baseClaim, h: await claimHash(baseClaim) };
  const id = proofId(claim);
  const origin = data.appOrigin || (typeof window !== 'undefined' ? window.location.origin : 'https://merosadak.app');
  const verifyUrl = buildVerifyUrl(origin, claim);

  doc.setProperties({
    title: `MeroSadak distance report: ${data.from} to ${data.to}`,
    subject: 'Independent route-distance result with source and verification reference.',
    author: 'MeroSadak',
    keywords: `MeroSadak, distance report, ${id}`,
    creator: 'MeroSadak',
  });

  const setText = (value: string, x: number, y: number, size: number, style: 'normal' | 'bold' | 'italic', color: RGB) => {
    doc.setFont('helvetica', style);
    doc.setFontSize(size);
    doc.setTextColor(...color);
    doc.text(ascii(value), x, y);
  };

  const rule = (y: number) => {
    doc.setDrawColor(...RULE);
    doc.setLineWidth(0.25);
    doc.line(M, y, W - M, y);
  };

  const section = (label: string, y: number) => {
    setText(label.toUpperCase(), M, y, 7.2, 'bold', GREEN);
    rule(y + 2.2);
  };

  // One restrained app header. No DoR letterhead, emblem, or repeated branding.
  doc.setFillColor(...GREEN);
  doc.rect(0, 0, W, 27, 'F');
  setText('MeroSadak', M, 11, 13, 'bold', [255, 255, 255]);
  setText('DISTANCE REPORT', M, 19, 8, 'bold', [226, 240, 232]);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(226, 240, 232);
  doc.text(ascii(formatReportTimestamp(printedAt)), W - M, 11, { align: 'right' });
  doc.text(ascii(`Reference ${id}`), W - M, 19, { align: 'right' });

  // Journey and primary result.
  const routeName = `${data.from}${data.fromDistrict ? `, ${data.fromDistrict}` : ''}  ->  ${data.to}${data.toDistrict ? `, ${data.toDistrict}` : ''}`;
  const routeLines = doc.splitTextToSize(ascii(routeName), contentW) as string[];
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...INK);
  doc.text(routeLines.slice(0, 2), M, 40);

  const resultY = 58 + Math.max(0, routeLines.slice(0, 2).length - 1) * 5;
  setText(`${res.distanceKm.toFixed(2)} km`, M, resultY, 25, 'bold', INK);

  const evidenceLabel = getEvidenceLevelLabel(res.evidenceLevel);
  const evidenceColor = getEvidenceLevelColor(res.evidenceLevel);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  const badgeW = Math.min(62, doc.getTextWidth(ascii(evidenceLabel)) + 8);
  doc.setFillColor(...evidenceColor);
  doc.roundedRect(W - M - badgeW, resultY - 8, badgeW, 8, 1.4, 1.4, 'F');
  doc.setTextColor(255, 255, 255);
  doc.text(ascii(evidenceLabel), W - M - badgeW / 2, resultY - 2.6, { align: 'center' });

  const method = res.isUncertain
    ? 'Method: derived route with an uncertain section'
    : res.evidenceLevel === 'published'
      ? 'Method: distance published in the cited road statistics'
      : res.source === 'dor_geojson'
        ? 'Method: calculated from archived road-network geometry'
        : 'Method: straight-line estimate (not road distance)';
  setText(method, M, resultY + 7, 7.5, 'normal', MUTED);
  rule(resultY + 12);

  // Road breakdown: aggregate link records by highway, avoiding a long repeated link list.
  let y = resultY + 21;
  section('Route breakdown', y);
  y += 9;

  const grouped = new Map<string, { code: string; name: string; km: number; links: number }>();
  for (const link of res.linkChain || []) {
    const code = String(link.code || 'Local road');
    const existing = grouped.get(code) || {
      code,
      name: String(link.name || code),
      km: 0,
      links: 0,
    };
    existing.km += Number(link.lengthKm) || 0;
    existing.links += 1;
    grouped.set(code, existing);
  }

  const routeGroups = [...grouped.values()].sort((a, b) => b.km - a.km);
  if (routeGroups.length) {
    const shown = routeGroups.slice(0, 5);
    setText('HIGHWAY / ROAD', M, y, 6.5, 'bold', MUTED);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(...MUTED);
    doc.text('DISTANCE', W - M, y, { align: 'right' });
    y += 4;
    for (const group of shown) {
      const label = group.name === group.code ? group.code : `${group.code} - ${group.name}`;
      setText(label.length > 68 ? `${label.slice(0, 65)}...` : label, M, y, 7.2, 'normal', INK);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.2);
      doc.setTextColor(...INK);
      doc.text(`${group.km.toFixed(2)} km`, W - M, y, { align: 'right' });
      y += 5;
    }
    if (routeGroups.length > shown.length) {
      setText(`+${routeGroups.length - shown.length} other road groups included`, M, y, 6.5, 'italic', MUTED);
      y += 4;
    }
  } else {
    const highways = (res.highwaysUsed || []).join(' -> ');
    const routeBasis = res.citation?.via || highways || 'No mapped highway route available';
    const lines = doc.splitTextToSize(ascii(routeBasis), contentW) as string[];
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...INK);
    doc.text(lines.slice(0, 2), M, y);
    y += Math.min(2, lines.length) * 4;
  }

  if (res.linkChain?.length) {
    const total = res.linkChain.reduce((sum, link) => sum + (Number(link.lengthKm) || 0), 0);
    setText(`Calculated from ${res.linkChain.length} road links  |  ${total.toFixed(2)} km combined`, M, y + 1, 6.5, 'normal', MUTED);
    y += 5;
  }

  // One concise source citation. The URL is printed as text, not another QR code.
  y += 5;
  section('Data source & accuracy', y);
  y += 9;
  const sourceLabel = getSourceLabel(res.source);
  setText(`Source: ${sourceLabel}`, M, y, 7.5, 'bold', INK);
  y += 5;

  const citation = res.citation;
  const citationParts = [
    citation?.document,
    citation?.table ? `Table ${citation.table}` : '',
    citation?.row ? `row ${citation.row}` : '',
    citation?.printedPage ? `printed p.${citation.printedPage}` : '',
    citation?.pdfPage ? `PDF p.${citation.pdfPage}` : '',
  ].filter(Boolean);
  const citationLine = citationParts.length ? citationParts.join(' | ') : (res.note || 'No published city-pair citation available.');
  const citationLines = doc.splitTextToSize(ascii(citationLine), contentW) as string[];
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...MUTED);
  doc.text(citationLines.slice(0, 2), M, y);
  y += Math.min(2, citationLines.length) * 3.7 + 1;

  if (sourceUrl) {
    const shortUrl = sourceUrl.replace(/^https?:\/\//, '');
    setText(`Reference: ${shortUrl}`, M, y, 6.5, 'normal', MUTED);
    y += 4;
  }

  if (res.note && res.note !== citationLine) {
    const noteLines = doc.splitTextToSize(ascii(res.note), contentW) as string[];
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(6.8);
    doc.setTextColor(...(res.isUncertain ? AMBER : MUTED));
    doc.text(noteLines.slice(0, 2), M, y);
    y += Math.min(2, noteLines.length) * 3.5 + 1;
  }
  if (res.isUncertain) {
    setText('Accuracy note: part of this result cannot be independently reproduced from the published link data.', M, y, 6.8, 'bold', AMBER);
    y += 4;
  }

  // One verification QR, one compact fingerprint, and one clear disclaimer.
  const footerTop = 268;
  const qrSize = 24;
  const qrY = 226;
  doc.setFillColor(...PALE);
  doc.roundedRect(M, qrY - 4, contentW, 34, 2, 2, 'F');
  drawQr(doc, verifyUrl, M + 5, qrY, qrSize);
  setText('VERIFY THIS RESULT', M + 35, qrY + 5, 8, 'bold', GREEN);
  setText('Scan to reopen the calculation in MeroSadak.', M + 35, qrY + 11, 7, 'normal', INK);
  setText(`Verification code: ${claim.h}`, M + 35, qrY + 16, 6.5, 'normal', MUTED);
  if (data.dataHash && data.dataHash !== 'unavailable') {
    setText(`Dataset fingerprint: ${data.dataHash}`, M + 35, qrY + 21, 6.2, 'normal', MUTED);
  }

  rule(footerTop);
  setText('MeroSadak independent report. Not an official Department of Roads document.', M, 275, 6.5, 'normal', MUTED);
  setText('merosadak.web.app', W - M, 275, 6.5, 'normal', MUTED);
  return { doc, claim, verifyUrl };
}

export async function generateProofSheet(data: ProofSheetData): Promise<void> {
  try {
    const { doc, claim } = await buildProofSheet(data);
    const safe = (value: string) => value.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '');
    doc.save(`merosadak-distance-${safe(data.from)}-to-${safe(data.to)}-${proofId(claim)}.pdf`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[DistanceReport] PDF export failed:', message);
    const alert = document.createElement('div');
    alert.className = 'fixed top-4 left-1/2 -translate-x-1/2 z-[9999] bg-red-900/95 text-red-100 px-4 py-2 rounded-lg shadow-2xl text-sm font-bold';
    alert.textContent = 'PDF download failed. Please try again or use Print.';
    document.body.appendChild(alert);
    setTimeout(() => alert.remove(), 5000);
  }
}
