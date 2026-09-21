import { jsPDF } from 'jspdf';
import { DistanceWithSource, getEvidenceLevelLabel, getEvidenceLevelColor, getSourceLabel } from './snhLookup';
import QRCode from 'qrcode';
import {
  DOR_DOCUMENT,
  DOR_PUBLISHER,
  DOR_SOURCE_URL,
  ProofClaim,
  buildVerifyUrl,
  claimHash,
  nepalDate,
  nepalDateTime,
  proofId,
} from './proofLinks';

export interface ProofSheetData {
  from: string;
  to: string;
  fromDistrict?: string;
  toDistrict?: string;
  lookupResult: DistanceWithSource;
  generatedAt: string;
  /** SHA-256 fingerprint (12 hex) of the reference dataset the figure was read from */
  dataHash: string;
  /** origin the verification QR points at; defaults to the running app */
  appOrigin?: string;
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

/** Build the proof sheet PDF (does not save). Kept separate so it can be tested. */
export async function buildProofSheet(data: ProofSheetData): Promise<{ doc: jsPDF; claim: ProofClaim; verifyUrl: string }> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  const W = doc.internal.pageSize.getWidth(); // 210
  const H = doc.internal.pageSize.getHeight(); // 297
  const M = 15;
  const FOOTER_TOP = H - 20;

  const res = data.lookupResult;
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
    title: `Distance proof sheet: ${data.from} to ${data.to} (${id})`,
    subject: 'Distance proof sheet prepared from DoR SNH 2022/23. Not issued by the Department of Roads unless countersigned.',
    author: 'Mero Sadak',
    keywords: `${id}, SNH 2022/23, Department of Roads`,
    creator: 'Mero Sadak',
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

  // ---------------- header band (filled, white text)
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, W, 30, 'F');
  y = 13;
  text('DISTANCE PROOF SHEET', M, 15, 'bold', [255, 255, 255]);
  y = 20;
  text('Prepared from Department of Roads, Statistics of National Highway (SNH) 2022/23', M, 7.5, 'normal', [203, 213, 225]);
  y = 24.5;
  text('Not issued by the Department of Roads unless countersigned below', M, 7.5, 'italic', [251, 191, 36]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  doc.text(id, W - M, 13, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(203, 213, 225);
  doc.text(`Printed ${nepalDateTime(printedAt)}`, W - M, 19, { align: 'right' });
  doc.text('Data: SNH 2022/23', W - M, 24.5, { align: 'right' });

  // ---------------- result
  y = 42;
  text('FROM - TO', M, 7, 'bold', MUTED);
  y += 5;
  text(`${data.from}${data.fromDistrict ? ` (${data.fromDistrict})` : ''}  to  ${data.to}${data.toDistrict ? ` (${data.toDistrict})` : ''}`, M, 11, 'bold', INK);
  y += 11;
  text(`${res.distanceKm.toFixed(2)} km`, M, 26, 'bold', INK);

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
  heading('SOURCE CITATION');
  const cit = res.citation;
  const lines: string[] = [
    `Data source: ${getSourceLabel(res.source)}`,
    `Document: ${cit?.document || DOR_DOCUMENT}`,
    `Table: ${cit?.table || 'N/A'}${cit?.row ? `, row ${cit.row}` : ''}`,
  ];
  if (cit?.printedPage || cit?.pdfPage) {
    lines.push(`Page: ${cit?.printedPage ? `printed p.${cit.printedPage}` : ''}${cit?.printedPage && cit?.pdfPage ? ' / ' : ''}${cit?.pdfPage ? `PDF file p.${cit.pdfPage}` : ''}`);
  }
  if (cit?.via) lines.push(`Route basis: ${cit.via}`);
  lines.forEach((l) => {
    ensure(4.6);
    text(l, M, 8.5, 'normal', INK);
    y += 4.6;
  });

  // ---------------- link chain
  if (res.linkChain && res.linkChain.length > 0) {
    heading('LINK-BY-LINK BREAKDOWN');
    const cSeg = M;
    const cCode = M + 12;
    const cName = M + 42;
    const cKm = W - M;
    const header = () => {
      text('#', cSeg, 7, 'bold', MUTED);
      text('Link code', cCode, 7, 'bold', MUTED);
      text('Link / segment', cName, 7, 'bold', MUTED);
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
      text(e.name.length > 62 ? e.name.slice(0, 60) + '...' : e.name, cName, 7.5, 'normal', INK);
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
  drawQr(doc, DOR_SOURCE_URL, W / 2 + 4, qrY, QR);
  y = qrY + QR + 1;
  const captionY = y;
  y = captionY;
  text('1. VERIFY IN THE APP', M + 2, 7.5, 'bold', INK);
  text('2. DATA SOURCE: DEPARTMENT OF ROADS', W / 2 + 6, 7.5, 'bold', INK);
  y += 3.6;
  text(`Scan to re-check this figure at ${shortHost}`, M + 2, 6.8, 'normal', MUTED);
  text(`Scan to open ${DOR_SOURCE_URL.replace('https://', '')}`, W / 2 + 6, 6.8, 'normal', MUTED);
  y += 3.4;
  text(`Reference code ${claim.h}`, M + 2, 6.8, 'normal', MUTED);
  text('Publisher of the SNH data', W / 2 + 6, 6.8, 'normal', MUTED);
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

  // ---------------- data source (last section)
  ensure(52);
  heading('DATA SOURCE');
  const src: Array<[string, string]> = [
    ['Publisher', `${DOR_PUBLISHER}  (${DOR_SOURCE_URL})`],
    ['Document', `${DOR_DOCUMENT}, HMIS-ICT Unit, published June 2024`],
    ['Snapshot', 'Data reflects the 2022/23 publication. It is not a live road-status report.'],
    ['Dataset fingerprint', `SHA-256 (first 12): ${data.dataHash}`],
    ['Prepared by', 'Mero Sadak (unofficial). Distances are read from a transcription of the published tables.'],
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
    doc.text(ascii(`${id}  |  ref ${claim.h}  |  verify at ${shortHost}  |  source ${DOR_SOURCE_URL.replace('https://', '')}`), M, H - 10.5);
    doc.text(ascii('(c) 2023 Department of Roads (source data). Unofficial unless countersigned by DoR.'), M, H - 7);
    doc.text(`Page ${p} of ${pages}`, W - M, H - 10.5, { align: 'right' });
  }

  return { doc, claim, verifyUrl };
}

export async function generateProofSheet(data: ProofSheetData): Promise<void> {
  const { doc, claim } = await buildProofSheet(data);
  const safe = (s: string) => s.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '');
  doc.save(`merosadak-proof-${safe(data.from)}-${safe(data.to)}-${proofId(claim)}.pdf`);
}
