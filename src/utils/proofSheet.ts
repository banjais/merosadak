import { jsPDF } from 'jspdf';
import { DistanceWithSource, getEvidenceLevelLabel, getEvidenceLevelColor, getSourceLabel } from './snhLookup';
import { RouteHighwaySummary } from './routeHighwaySummary';
import QRCode from 'qrcode';
import { DOR_BRANDING, DOR_REPORT_NOTE, DOR_REPORT_TITLE, formatReportTimestampParts } from './reportBranding';
import { getRoadSurfaceLabel, ROAD_SURFACE_CONDITION_NOTE } from './roadSurfaceLabels';
import {
  DOR_DOCUMENT,
  DOR_PUBLISHER,
  DOR_SOURCE_URL,
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
  fromCoordinates?: { lat: number; lng: number };
  toCoordinates?: { lat: number; lng: number };
  lookupResult: DistanceWithSource;
  routeHighways?: RouteHighwaySummary[];
  generatedAt: string;
  /** SHA-256 fingerprint (12 hex) of the reference dataset the figure was read from */
  dataHash: string;
  /** origin the verification QR points at; defaults to the running app */
  appOrigin?: string;
  /** Signed-in user's name, printed on the letterhead when present. */
  issuedToName?: string;
  /** Signed-in user's email, printed on the letterhead when present. */
  issuedToEmail?: string;
}

// standard PDF fonts only cover Latin-1: keep text printable everywhere
const ascii = (s: string): string =>
  String(s ?? '')
    .replace(/[\u2192\u2794\u27f6]/g, '->')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\u2248/g, '~')
    .replace(/\u2026/g, '...')
    .replace(/[^\x20-\x7e\u00a9\u00b0]/g, '?');

const INK: [number, number, number] = [15, 23, 42];
const MUTED: [number, number, number] = [71, 85, 105];
const RULE: [number, number, number] = [148, 163, 184];
const WARN: [number, number, number] = [180, 83, 9];

/** Draw a QR code as vector squares (merged runs, so no hairline seams and crisp at any print size). */
function drawQr(doc: jsPDF, text: string, x: number, y: number, size: number): void {
  const qr = QRCode.create(text, { errorCorrectionLevel: 'M' });
  const n: number = qr.modules.size;
  const on = (row: number, col: number): boolean => !!qr.modules.get(row, col);
  const quiet = 4; // required quiet zone, in modules
  const mod = size / (n + quiet * 2);
  doc.setFillColor(255, 255, 255);
  doc.rect(x, y, size, size, 'F');
  doc.setFillColor(0, 0, 0);
  for (let r = 0; r < n; r++) {
    let c = 0;
    while (c < n) {
      if (!on(r, c)) {
        c++;
        continue;
      }
      let run = 1;
      while (c + run < n && on(r, c + run)) run++;
      doc.rect(x + (quiet + c) * mod, y + (quiet + r) * mod, mod * run + 0.01, mod + 0.01, 'F');
      c += run;
    }
  }
}

/** Draw the national emblem of Nepal as vector strokes on a `size` box. */
function drawEmblem(doc: jsPDF, x: number, y: number, size: number, color: [number, number, number]): void {
  const s = size / 64;
  const px = (v: number) => x + v * s;
  const py = (v: number) => y + v * s;
  doc.setDrawColor(color[0], color[1], color[2]);
  doc.setLineWidth(0.35);
  doc.setLineJoin('round');
  doc.lines(
    [[0, -11.5], [21, 0], [0, 11.5], [-21, 0], [0, -11.5]], // outer pennon
    px(32), py(17.5), [1, 1], 'S', true
  );
  doc.line(px(32), py(6), px(32), py(47));
  doc.setLineWidth(0.22);
  // Himalayan range
  doc.lines(
    [[-16, 0], [-11, 5], [-7.5, 1.5], [-4, 6], [-1, 2.5], [2, 6], [5.5, 1.5], [9, 5], [14, 0]],
    px(32), py(21), [1, 1], 'S', false
  );
  // Plough and crossed books
  doc.lines([[-8, 14], [0, 10], [6, 14]], px(31), py(35), [1, 1], 'S', false);
  doc.line(px(26), py(39), px(33), py(43));
  doc.line(px(38), py(39), px(31), py(43));
  // Lotus base
  doc.setLineWidth(0.28);
  doc.lines(
    [[-12, 0], [-8, -3], [-6, 0], [-4, -3.5], [-2, 0], [0, -3.5], [2, 0], [4, -3.5], [6, 0], [8, -3], [12, 0]],
    px(32), py(50), [1, 1], 'S', false
  );
  doc.setLineWidth(0.35);
  doc.line(px(17), py(53.5), px(47), py(53.5));
  doc.setLineJoin('miter');
}

function drawLocationPin(doc: jsPDF, x: number, y: number, color: [number, number, number]): void {
  doc.setDrawColor(...color);
  doc.setFillColor(255, 255, 255);
  doc.setLineWidth(0.55);
  doc.circle(x, y, 1.8, 'FD');
  doc.line(x - 1.3, y + 1.2, x, y + 3.5);
  doc.line(x + 1.3, y + 1.2, x, y + 3.5);
  doc.setFillColor(...color);
  doc.circle(x, y, 0.45, 'F');
}

function drawDistanceRuler(doc: jsPDF, x: number, y: number, color: [number, number, number]): void {
  doc.setDrawColor(...color);
  doc.setLineWidth(0.45);
  doc.roundedRect(x, y, 7, 4, 0.5, 0.5, 'S');
  doc.line(x + 1.5, y, x + 1.5, y + 1.5);
  doc.line(x + 3.5, y, x + 3.5, y + 2);
  doc.line(x + 5.5, y, x + 5.5, y + 1.5);
}

async function loadReportEmblem(): Promise<string | null> {
  let objectUrl: string | null = null;
  try {
    const response = await fetch('/logo.jpeg');
    if (!response.ok) return null;
    objectUrl = URL.createObjectURL(await response.blob());
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('Logo image could not be loaded'));
      image.src = objectUrl!;
    });
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const context = canvas.getContext('2d');
    if (!context) return null;
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  } finally {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}

/** Build the proof sheet PDF (does not save). Kept separate so it can be tested. */
export async function buildProofSheet(data: ProofSheetData): Promise<{ doc: jsPDF; claim: ProofClaim; verifyUrl: string }> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  const governmentEmblem = await loadReportEmblem();
  const W = doc.internal.pageSize.getWidth(); // 210
  const H = doc.internal.pageSize.getHeight(); // 297
  const M = 15;
  const FOOTER_TOP = H - 20;

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
  const shortHost = origin.replace(/^https?:\/\//, '').replace(/\/+$/, '');

  doc.setProperties({
    title: `MEROSADAK distance report: ${data.from} to ${data.to} (${id})`,
    subject: 'Unofficial MEROSADAK report identifying its source and evidence level.',
    author: 'MEROSADAK',
    keywords: `${id}, SNH 2022/23, Department of Roads, Government of Nepal`,
    creator: 'MEROSADAK',
  });

  let y = 0;
  const ensure = (need: number) => {
    if (y + need > FOOTER_TOP) {
      doc.addPage();
      y = M;
    }
  };
  const text = (s: string, x: number, size: number, style: 'normal' | 'bold' | 'italic', color: [number, number, number]) => {
    doc.setFont('helvetica', style);
    doc.setFontSize(size);
    doc.setTextColor(color[0], color[1], color[2]);
    doc.text(ascii(s), x, y);
  };
  const wrapped = (s: string, size: number, style: 'normal' | 'bold' | 'italic', color: [number, number, number], lh: number, width = W - M * 2) => {
    doc.setFont('helvetica', style);
    doc.setFontSize(size);
    doc.setTextColor(color[0], color[1], color[2]);
    const lines = doc.splitTextToSize(ascii(s), width) as string[];
    ensure(lines.length * lh);
    doc.text(lines, M, y);
    y += lines.length * lh;
  };
  const heading = (s: string) => {
    ensure(9);
    y += 2;
    text(s, M, 8, 'bold', MUTED);
    y += 1.5;
    doc.setDrawColor(RULE[0], RULE[1], RULE[2]);
    doc.setLineWidth(0.2);
    doc.line(M, y, W - M, y);
    y += 4.5;
  };

  // ---------------- header band (filled, white text) with report identity
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, W, 38, 'F');

  // The emblem identifies the cited public agency, not the report issuer.
  if (governmentEmblem) {
    doc.addImage(governmentEmblem, 'PNG', M, 5, 15, 15);
  } else {
    doc.setFillColor(16, 185, 129);
    doc.roundedRect(M, 5, 15, 15, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('MS', M + 7.5, 14.5, { align: 'center' });
  }
  const LX = M + 19;
  const LY = 8.4;
  const line = (s: string, dy: number, size: number, style: 'normal' | 'bold' | 'italic', c: [number, number, number]) => {
    doc.setFont('helvetica', style);
    doc.setFontSize(size);
    doc.setTextColor(c[0], c[1], c[2]);
    doc.text(ascii(s), LX, LY + dy);
  };
  line(DOR_BRANDING.line1, 0, 8.5, 'bold', [255, 255, 255]);
  line(DOR_BRANDING.line2, 4.4, 7.5, 'normal', [203, 213, 225]);
  line(DOR_BRANDING.line3, 8.5, 7.5, 'normal', [203, 213, 225]);

  // Right side: reference code, print stamp, and the signed-in user.
  const stamp = formatReportTimestampParts(printedAt);
  const rightLine = (s: string, dy: number, size: number, style: 'normal' | 'bold', c: [number, number, number]) => {
    doc.setFont('helvetica', style);
    doc.setFontSize(size);
    doc.setTextColor(c[0], c[1], c[2]);
    doc.text(ascii(s), W - M, 7 + dy, { align: 'right' });
  };
  rightLine(id, 0, 8.5, 'bold', [255, 255, 255]);
  rightLine('Printed', 5, 7.5, 'normal', [203, 213, 225]);
  rightLine(stamp.date, 9, 7.5, 'normal', [203, 213, 225]);
  rightLine(stamp.time, 13, 7.5, 'normal', [203, 213, 225]);
  if (data.issuedToName) rightLine(data.issuedToName, 19, 7.5, 'bold', [255, 255, 255]);
  if (data.issuedToEmail) rightLine(data.issuedToEmail, 23.5, 7, 'normal', [148, 163, 184]);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.2);
  doc.setTextColor(203, 213, 225);
  const headerNote = doc.splitTextToSize(ascii(`${DOR_REPORT_TITLE} - ${DOR_REPORT_NOTE}`), W - M * 2) as string[];
  doc.text(headerNote, M, 32);

  // Document title follows the agency attribution and independence note.
  y = 45;
  text('DISTANCE SUMMARY', M, 12, 'bold', INK);
  y = 51;
  doc.setDrawColor(RULE[0], RULE[1], RULE[2]);
  doc.setLineWidth(0.3);
  doc.line(M, y + 1.5, W - M, y + 1.5);
  y += 8;

  // ---------------- route summary
  const fromLabel = `${data.from}${data.fromDistrict ? ` (${data.fromDistrict})` : ''}`;
  const toLabel = `${data.to}${data.toDistrict ? ` (${data.toDistrict})` : ''}`;
  const fromX = M + 7;
  const toX = M + 99;
  drawLocationPin(doc, M + 2, y + 3.5, INK);
  drawLocationPin(doc, M + 94, y + 3.5, INK);
  text('FROM', fromX, 7, 'bold', MUTED);
  text('TO', toX, 7, 'bold', MUTED);
  y += 4.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...INK);
  const fromLines = doc.splitTextToSize(ascii(fromLabel), 78) as string[];
  const toLines = doc.splitTextToSize(ascii(toLabel), 78) as string[];
  doc.text(fromLines, fromX, y);
  doc.text(toLines, toX, y);
  y += Math.max(fromLines.length, toLines.length) * 4.5 + 2;
  const coordinateText = (point?: { lat: number; lng: number }) => point
    ? `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`
    : 'Unavailable';
  text(`Origin: ${coordinateText(data.fromCoordinates)}`, M, 7, 'normal', MUTED);
  text(`Destination: ${coordinateText(data.toCoordinates)}`, M + 92, 7, 'normal', MUTED);
  y += 6;
  drawDistanceRuler(doc, M + 1, y - 5, INK);
  text(`${res.distanceKm.toFixed(2)} km`, M + 11, 26, 'bold', INK);

  const col = getEvidenceLevelColor(res.evidenceLevel);
  const badge = getEvidenceLevelLabel(res.evidenceLevel);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  const bw = doc.getTextWidth(ascii(badge)) + 8;
  doc.setFillColor(col[0], col[1], col[2]);
  doc.roundedRect(W - M - bw, y - 7.5, bw, 8, 1.2, 1.2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.text(ascii(badge), W - M - bw / 2, y - 2.2, { align: 'center' });
  y += 6;

  // ---------------- source citation
  heading('DISTANCE BASIS AND SOURCE');
  const cit = res.citation;
  const lines: string[] = [
    `Evidence type: ${getEvidenceLevelLabel(res.evidenceLevel)}`,
    `Data source: ${getSourceLabel(res.source)}`,
    `Document: ${cit?.document || getSourceLabel(res.source)}`,
    `Table: ${cit?.table || (res.evidenceLevel === 'published' ? DOR_DOCUMENT : 'No published city-pair table')}${cit?.row ? `, row ${cit.row}` : ''}`,
  ];
  if (sourceUrl) lines.push(`Source URL: ${sourceUrl}`);
  if (cit?.printedPage || cit?.pdfPage) {
    lines.push(`Page: ${cit?.printedPage ? `printed p.${cit.printedPage}` : ''}${cit?.printedPage && cit?.pdfPage ? ' / ' : ''}${cit?.pdfPage ? `PDF file p.${cit.pdfPage}` : ''}`);
  }
  if (cit?.via) lines.push(`Route basis: ${cit.via}`);
  if (res.highwaysUsed?.length) lines.push(`Highways in computed route: ${res.highwaysUsed.join(' -> ')}`);
  lines.forEach((l) => {
    ensure(4.6);
    text(l, M, 8.5, 'normal', INK);
    y += 4.6;
  });

  if (data.routeHighways?.length) {
    heading('ROUTE PLANNER GIS PATH - CONTEXT ONLY');
    wrapped(`This separate GIS route is shown for context. It is not a segment-by-segment verification or breakdown of the selected distance. ${ROAD_SURFACE_CONDITION_NOTE}`, 7.5, 'italic', MUTED, 3.5);
    data.routeHighways.forEach((segment, index) => {
      const roadClass = segment.roadClass.toLowerCase() === 'national highway' ? '' : ` - ${segment.roadClass}`;
      const description = `${index + 1}. ${segment.highwayName} (${segment.highwayCode})${roadClass} - ${getRoadSurfaceLabel(segment.surface)} - ${segment.distanceKm.toFixed(1)} km`;
      const wrapped = doc.splitTextToSize(ascii(description), W - M * 2);
      ensure(wrapped.length * 4.2);
      wrapped.forEach((line: string) => {
        text(line, M, 8, 'normal', INK);
        y += 4.2;
      });
    });
  }

  // ---------------- link chain
  if (res.linkChain && res.linkChain.length > 0) {
    heading('LINK-BY-LINK BREAKDOWN');
    heading('PUBLISHED LINK BREAKDOWN');
    const cSeg = M;
    const cCode = M + 9;
    const cName = M + 37;
    const cPavement = W - M - 39;
    const cKm = W - M;
    const header = () => {
      text('#', cSeg, 7, 'bold', MUTED);
      text('Link code', cCode, 7, 'bold', MUTED);
      text('Link / segment', cName, 7, 'bold', MUTED);
      text('Pavement', cPavement, 7, 'bold', MUTED);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
      doc.text('km', cKm, y, { align: 'right' });
      y += 2;
      doc.setDrawColor(RULE[0], RULE[1], RULE[2]);
      doc.line(M, y, W - M, y);
      y += 3.6;
    };
    ensure(14);
    header();
    res.linkChain.forEach((e, i) => {
      if (y + 4.2 > FOOTER_TOP) {
        doc.addPage();
        y = M + 4;
        header();
      }
      text(String(i + 1), cSeg, 7.5, 'normal', INK);
      text(e.code, cCode, 7.5, 'normal', INK);
      text(e.name.length > 44 ? e.name.slice(0, 42) + '...' : e.name, cName, 7.5, 'normal', INK);
      text(e.pavementType.length > 18 ? `${e.pavementType.slice(0, 16)}...` : e.pavementType, cPavement, 7, 'normal', INK);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(INK[0], INK[1], INK[2]);
      doc.text(e.lengthKm.toFixed(2), cKm, y, { align: 'right' });
      y += 4.2;
    });
    const total = res.linkChain.reduce((s, e) => s + e.lengthKm, 0);
    ensure(8);
    doc.setDrawColor(RULE[0], RULE[1], RULE[2]);
    doc.line(M, y - 1.5, W - M, y - 1.5);
    y += 2;
    text('TOTAL OF LISTED LINKS', cName, 7.5, 'bold', INK);
    doc.setFont('helvetica', 'bold');
    doc.text(total.toFixed(2), cKm, y, { align: 'right' });
    y += 5;
  }

  // ---------------- notes and cautions
  if (res.note) {
    heading('NOTES');
    wrapped(res.note, 8, 'italic', WARN, 3.7);
    y += 1;
  }
  if (res.isUncertain) {
    ensure(6);
    text('CAUTION: this figure has a part that cannot be reproduced link by link from the published tables.', M, 8, 'bold', WARN);
    y += 5;
  }
  if (cit?.table === 'Table 6') {
    wrapped(
      'DoR publishes this distance from Kathmandu via the NH17 Prithivi Highway. Where that route differs from the shortest official route, the published figure is the one certified in the document.',
      7.5,
      'normal',
      MUTED,
      3.4
    );
    y += 2;
  }

  // ---------------- QR codes: verify in app + data source
  const QR = 38;
  ensure(QR + 44);
  heading('VERIFY THIS SHEET AND DATA SOURCE');
  const qrY = y;
  drawQr(doc, verifyUrl, M, qrY, QR);
  if (sourceUrl) drawQr(doc, sourceUrl, W / 2 + 4, qrY, QR);
  y = qrY + QR + 1;
  const captionY = y;
  y = captionY;
  text('1. VERIFY IN THE APP', M + 2, 7.5, 'bold', INK);
  text(sourceUrl ? '2. DEPARTMENT OF ROADS SOURCE' : '2. SOURCE BASIS', W / 2 + 6, 7.5, 'bold', INK);
  y += 3.6;
  text(`Scan to re-check this figure at ${shortHost}`, M + 2, 6.8, 'normal', MUTED);
  text(sourceUrl ? `Scan to open ${sourceUrl.replace('https://', '')}` : 'Aerial great-circle calculation; no DoR route found', W / 2 + 6, 6.8, 'normal', MUTED);
  y += 3.4;
  text(`Reference code ${claim.h}`, M + 2, 6.8, 'normal', MUTED);
  text(sourceUrl ? 'Publisher/source reference' : 'Not a road-distance measurement', W / 2 + 6, 6.8, 'normal', MUTED);
  y += 5;
  wrapped(
    'A QR code confirms what this sheet says and where the data comes from. It does not by itself prove that the Department of Roads issued this sheet: only an authorised DoR signature and seal below does.',
    7,
    'italic',
    MUTED,
    3.3
  );
  y += 2;

  // ---------------- countersignature
  ensure(52);
  heading('DEPARTMENT OF ROADS COUNTERSIGNATURE');
  if (res.evidenceLevel === 'published') {
    wrapped(
      'This sheet reproduces a figure published by the Department of Roads (SNH 2022/23). For an official DoR document it must be countersigned by an authorised DoR officer; submit this sheet with the SNH 2022/23 reference to the HMIS-ICT Unit, Department of Roads.',
      7.5,
      'normal',
      MUTED,
      3.4
    );
  } else {
    wrapped(
      `This distance is not a figure published by the Department of Roads (${getSourceLabel(res.source)}). It is not suitable as official evidence.`,
      7.5,
      'bold',
      WARN,
      3.4
    );
  }
  y += 15;
  doc.setDrawColor(INK[0], INK[1], INK[2]);
  doc.setLineWidth(0.3);
  doc.line(M, y, M + 70, y);
  doc.line(M + 80, y, M + 130, y);
  y += 3.5;
  text('Authorised signatory (name, title)', M, 6.8, 'normal', MUTED);
  text('Date', M + 80, 6.8, 'normal', MUTED);
  doc.setDrawColor(RULE[0], RULE[1], RULE[2]);
  doc.setLineDashPattern([1, 1], 0);
  doc.circle(W - M - 11, y - 4, 9.5, 'S');
  doc.setLineDashPattern([], 0);
  text('Seal', W - M - 13.5, 6.8, 'normal', MUTED);
  y += 8;

  // ---------------- reproducibility metadata (last section)
  ensure(52);
  heading('REPRODUCIBILITY AND DATA NOTES');
  const src: Array<[string, string]> = [
    ...(res.source === 'dor_snh' ? [['Publisher', DOR_PUBLISHER] as [string, string]] : []),
    ['DoR publication', res.evidenceLevel === 'published' ? `${DOR_DOCUMENT}, HMIS-ICT Unit, published June 2024` : 'No DoR-published distance for this city pair'],
    ['Snapshot', res.source === 'dor_snh' ? 'Data reflects the 2022/23 publication, not live road conditions.' : 'Computed route from archived road geometry; not a live road-status report.'],
    ['Dataset fingerprint', `SHA-256 (first 12): ${data.dataHash}`],
    ['Prepared by', 'MEROSADAK (independent report; not issued by the Department of Roads).'],
    ['Copyright', '(c) 2023 Department of Roads (source data). Reproduced for reference.'],
  ];
  src.forEach(([k, v]) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    const vl = doc.splitTextToSize(ascii(v), W - M * 2 - 34) as string[];
    ensure(vl.length * 3.6 + 1);
    text(k, M, 7.5, 'bold', INK);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text(vl, M + 34, y);
    y += vl.length * 3.6 + 1;
  });

  // ---------------- footer on every page
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setDrawColor(RULE[0], RULE[1], RULE[2]);
    doc.setLineWidth(0.2);
    doc.line(M, H - 15, W - M, H - 15);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text(ascii(`${id}  |  ref ${claim.h}  |  https://dor.gov.np  |  source ${sourceUrl ? sourceUrl.replace('https://', '') : 'aerial estimate'}`), M, H - 10.5);
    doc.text(ascii('MEROSADAK report. DoR is cited as a data source, not as the report issuer.'), M, H - 7);
    doc.text(`Page ${p} of ${pages}`, W - M, H - 10.5, { align: 'right' });
  }

  return { doc, claim, verifyUrl };
}

export async function generateProofSheet(data: ProofSheetData): Promise<void> {
  try {
    const { doc, claim } = await buildProofSheet(data);
    const safe = (s: string) => s.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '');
    doc.save(`merosadak-proof-${safe(data.from)}-${safe(data.to)}-${proofId(claim)}.pdf`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[MEROSADAK] Proof sheet PDF export failed:', message);
    const alert = document.createElement('div');
    alert.className = 'fixed top-4 left-1/2 -translate-x-1/2 z-[9999] bg-red-900/95 text-red-100 px-4 py-2 rounded-lg shadow-2xl text-sm font-bold';
    alert.textContent = 'PDF export failed. Try Print instead, or check your browser download settings.';
    document.body.appendChild(alert);
    setTimeout(() => alert.remove(), 5000);
  }
}
