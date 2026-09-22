import React, { useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, XCircle, AlertTriangle, ExternalLink, Loader2 } from 'lucide-react';
import { DOR_DOCUMENT, DOR_PUBLISHER, DOR_SOURCE_URL, ProofClaim, claimHash, proofId } from '../utils/proofLinks';
import { DistanceWithSource, getEvidenceLevelLabel, loadSNHReference, lookupDistanceWithFallback } from '../utils/snhLookup';

/**
 * Landing page for the QR code printed on a proof sheet.
 * It re-computes the figure from the DoR reference data bundled with the app and compares it
 * with what was printed. It confirms the figure matches the reference data; it can NOT confirm
 * who issued the paper, and says so.
 */
type Verdict = 'checking' | 'match' | 'mismatch' | 'altered' | 'unverifiable' | 'no-data';

interface Props {
  claim: ProofClaim;
  onClose: () => void;
}

export const ProofVerifyPage: React.FC<Props> = ({ claim, onClose }) => {
  const [verdict, setVerdict] = useState<Verdict>('checking');
  const [app, setApp] = useState<DistanceWithSource | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const expected = await claimHash({ from: claim.from, to: claim.to, km: claim.km, lv: claim.lv, d: claim.d });
      if (expected !== claim.h) {
        if (alive) setVerdict('altered');
        return;
      }
      if (claim.lv === 'estimate') {
        if (alive) setVerdict('unverifiable');
        return;
      }
      const ref = await loadSNHReference();
      if (!ref) {
        if (alive) setVerdict('no-data');
        return;
      }
      const found = lookupDistanceWithFallback(claim.from, claim.to, undefined, undefined, undefined, undefined, ref);
      if (!alive) return;
      setApp(found);
      setVerdict(found && Math.abs(found.distanceKm - claim.km) < 0.006 ? 'match' : 'mismatch');
    })();
    return () => {
      alive = false;
    };
  }, [claim]);

  const cit = app?.citation;
  const head = {
    checking: { Icon: Loader2, tone: 'text-slate-300 border-slate-700 bg-slate-900', title: 'Checking…', spin: true },
    match: { Icon: CheckCircle2, tone: 'text-emerald-300 border-emerald-500/50 bg-emerald-500/10', title: 'Matches the DoR reference data', spin: false },
    mismatch: { Icon: XCircle, tone: 'text-rose-300 border-rose-500/50 bg-rose-500/10', title: 'Does not match the DoR reference data', spin: false },
    altered: { Icon: XCircle, tone: 'text-rose-300 border-rose-500/50 bg-rose-500/10', title: 'Reference code does not match this link', spin: false },
    unverifiable: { Icon: AlertTriangle, tone: 'text-amber-300 border-amber-500/50 bg-amber-500/10', title: 'Estimate: not a published DoR figure', spin: false },
    'no-data': { Icon: AlertTriangle, tone: 'text-amber-300 border-amber-500/50 bg-amber-500/10', title: 'Could not load the DoR reference data', spin: false },
  }[verdict];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col" id="proof-verify-page">
      <header className="bg-slate-900/95 border-b border-slate-800 px-4 py-3 sticky top-0 z-40">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button onClick={onClose} className="p-2 rounded-xl bg-slate-800/90 hover:bg-slate-700 accent-text border border-slate-700/80" title="Back to app">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="text-xs font-semibold text-slate-400 tracking-wider">MERO SADAK</div>
            <div className="text-lg font-black text-white">Check a printed proof sheet</div>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-2xl mx-auto p-4 space-y-4">
        <div className={`rounded-2xl border p-4 flex items-start gap-3 ${head.tone}`} role="status">
          <head.Icon className={`w-6 h-6 shrink-0 ${head.spin ? 'animate-spin' : ''}`} />
          <div>
            <div className="text-base font-black">{head.title}</div>
            {verdict === 'match' && <div className="text-xs mt-1 opacity-90">The printed figure equals the figure this app reads from the published tables.</div>}
            {verdict === 'mismatch' && <div className="text-xs mt-1 opacity-90">The printed figure differs from what the reference data gives for this pair. Do not rely on the sheet.</div>}
            {verdict === 'altered' && <div className="text-xs mt-1 opacity-90">The link or the printed details were changed after printing, or the QR code was misread.</div>}
            {verdict === 'unverifiable' && <div className="text-xs mt-1 opacity-90">Estimates are not published by the Department of Roads, so there is nothing official to check against.</div>}
            {verdict === 'no-data' && <div className="text-xs mt-1 opacity-90">Connect to the internet and open this link again.</div>}
          </div>
        </div>

        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">Printed on the sheet</div>
          <div className="text-sm font-bold text-white">
            {claim.from} to {claim.to}
          </div>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-3">
            <span className="text-3xl font-black text-white">{claim.km.toFixed(2)} km</span>
            <span className="text-xs font-bold text-slate-300">{getEvidenceLevelLabel(claim.lv)}</span>
          </div>
          <div className="mt-1 text-xs text-slate-400">
            Printed {claim.d} (Nepal time) · Sheet {proofId(claim)} · reference code {claim.h}
          </div>
        </section>

        {app && (
          <section className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">In this app now</div>
            <div className="text-2xl font-black text-white">{app.distanceKm.toFixed(2)} km</div>
            <div className="text-xs text-slate-300 mt-1">{getEvidenceLevelLabel(app.evidenceLevel)}</div>
            {cit && (
              <div className="text-xs text-slate-400 mt-2 leading-relaxed">
                {cit.document}, {cit.table}
                {cit.row ? `, row ${cit.row}` : ''}
                {cit.printedPage ? `, printed page ${cit.printedPage}` : ''}
                {cit.pdfPage ? ` (PDF page ${cit.pdfPage})` : ''}
                {cit.via ? `. ${cit.via}.` : ''}
              </div>
            )}
          </section>
        )}

        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2 text-xs text-slate-300 leading-relaxed">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">What this check means</div>
          <p>
            This page confirms that the printed figure matches the reference data bundled with this app, which is transcribed from{' '}
            <strong>{DOR_DOCUMENT}</strong>. It cannot confirm who printed or issued the paper. Only a signature and seal from an authorised officer of the Department of Roads does that.
          </p>
          <p>
            Data source: <strong>{DOR_PUBLISHER}</strong>.{' '}
            <a href={DOR_SOURCE_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-emerald-400 underline">
              dor.gov.np <ExternalLink className="w-3 h-3" />
            </a>
          </p>
        </section>

        <button onClick={onClose} className="w-full py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm transition">
          Open Mero Sadak
        </button>
      </main>
    </div>
  );
};
