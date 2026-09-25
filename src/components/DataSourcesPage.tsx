import React, { useState, useEffect } from 'react';
import { ArrowLeft, Database, FileText, ExternalLink, Award, Shield, Hash, Calendar, BookOpen, AlertTriangle, Download, Loader } from 'lucide-react';

interface DataSourcesPageProps {
  onBack?: () => void;
}

interface TierData {
  meaning?: string;
  measured_links?: number;
  total_links?: number;
  measured_km?: number;
  total_km?: number;
  coverage_percent?: number;
  note?: string;
}

interface ProvenanceData {
  data_version: string;
  document: string;
  publisher: string;
  publication_date: string;
  tiers: Record<string, TierData>;
  road_network: any;
  corrections: any[];
  file_hashes: Record<string, string>;
  caveats: string[];
  methodology: string;
}

export const DataSourcesPage: React.FC<DataSourcesPageProps> = ({ onBack }) => {
  const [provenance, setProvenance] = useState<ProvenanceData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/data/provenance.json')
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        setProvenance(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
        <header className="bg-slate-900/95 border-b border-slate-700/60 accent-border sticky top-0 z-40 px-4 py-3">
          <div className="max-w-7xl mx-auto flex items-center gap-3">
            {onBack && (
              <button onClick={onBack} className="p-2 rounded-xl bg-slate-800/90 hover:bg-slate-700 accent-text border border-slate-700/80 transition">
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <h1 className="text-xl font-black text-white">Data Sources & Certification</h1>
          </div>
        </header>
        <main className="flex-1 max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center gap-3 text-slate-400">
            <Loader className="w-4 h-4 animate-spin" />
            Loading provenance data...
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <header className="bg-slate-900/95 backdrop-blur-md border-b border-slate-700/60 accent-border sticky top-0 z-40 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                onClick={onBack}
                className="p-2 rounded-xl bg-slate-800/90 hover:bg-slate-700 accent-text border border-slate-700/80 transition"
                title="Back to Main App"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-700/90 flex items-center justify-center shadow-md">
              <FileText className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-slate-400 tracking-wider">MERO SADAK</h1>
              <p className="text-xl font-black text-white font-display">Data Sources & Certification</p>
            </div>
          </div>
          <button
            onClick={async () => {
              const res = await fetch('/data/provenance.json');
              const text = await res.text();
              const blob = new Blob([text], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'provenance.json';
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="px-2.5 py-1.5 rounded-xl bg-slate-800/60 hover:bg-slate-700 text-slate-300 border border-slate-700/80 transition text-xs font-semibold flex items-center space-x-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download JSON</span>
          </button>
        </div>
      </header>

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-6 overflow-y-auto scrollbar-paddle">
        <div className="space-y-8">
          {/* Cover / Title Block */}
          <div className="bg-slate-900/80 border border-slate-800 p-6 rounded-2xl space-y-4">
            <div className="flex items-center gap-3">
              <Shield className="w-6 h-6 text-amber-400" />
              <h2 className="text-2xl font-black text-white font-display">
                Unofficial Statement Based on SNH 2022/23
              </h2>
            </div>
            <p className="text-sm text-slate-400 leading-relaxed">
              This statement documents the data provenance for all distance figures shown in the
              Mero Sadak distance calculator. It identifies which data is copied verbatim from
              the Department of Roads publication, which is derived from it, and which is
              sourced elsewhere.
            </p>
            <div className="text-xs text-slate-500 space-y-1">
              <div>Document: <span className="text-slate-300 font-medium">{provenance?.document || 'Statistics of National Highway (SNH) 2022/23'}</span></div>
              <div>Publisher: <span className="text-slate-300 font-medium">{provenance?.publisher || 'Department of Roads (DoR), Nepal - HMIS-ICT Unit'}</span></div>
              <div>Publication date: <span className="text-slate-300 font-medium">{provenance?.publication_date || 'June 2024'}</span></div>
              <div>Data version: <span className="text-slate-300 font-medium">{provenance?.data_version || 'SNH 2022/23'}</span></div>
            </div>
            <div className="text-xs text-amber-400/80 bg-amber-500/5 border border-amber-500/20 rounded-lg px-3 py-2">
              <AlertTriangle className="w-3.5 h-3.5 inline mr-1" />
              This is a 2022/23 snapshot. It does not reflect live road conditions.
              This statement does not carry an official DoR signature. For a DoR-certified
              certificate, submit this data to the HMIS-ICT Unit, DoR for sign-off.
            </div>
          </div>

          {/* Tier Table */}
          <div className="bg-slate-900/80 border border-slate-800 p-6 rounded-2xl space-y-4">
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-emerald-400" />
              <h3 className="text-lg font-bold text-white">Four-Tier Data Provenance</h3>
            </div>
            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-950 text-slate-400 font-semibold">
                  <tr>
                    <th className="py-2.5 px-3">Tier</th>
                    <th className="py-2.5 px-3">Meaning</th>
                    <th className="py-2.5 px-3">Measured Links</th>
                    <th className="py-2.5 px-3">Measured km</th>
                    <th className="py-2.5 px-3">Coverage</th>
                    <th className="py-2.5 px-3">DoR Certified?</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {provenance && (Object.entries(provenance.tiers) as [string, TierData][]).map(([tierKey, tier]) => {
                    const isCertified = tierKey.startsWith('A');
                    const color = isCertified ? 'text-emerald-400' : tierKey.startsWith('B') ? 'text-blue-400' : tierKey.startsWith('C') ? 'text-amber-400' : 'text-slate-400';
                    const coverage = tier.coverage_percent ? `${tier.coverage_percent}%` : tier.note || '-';
                    return (
                      <tr key={tierKey}>
                        <td className={`py-2.5 px-3 font-bold ${color}`}>{tierKey}</td>
                        <td className="py-2.5 px-3 text-slate-300">{tier.meaning}</td>
                        <td className="py-2.5 px-3">{tier.measured_links || '-'} of {tier.total_links || tier.measured_links || '?'}</td>
                        <td className="py-2.5 px-3">{tier.measured_km || '-'} of {tier.total_km || tier.measured_km || '?'}</td>
                        <td className="py-2.5 px-3">{coverage}</td>
                        <td className="py-2.5 px-3">
                          <span className={`text-xs font-bold px-1.5 py-0.5 rounded border ${
                            isCertified
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : 'bg-slate-800 text-slate-500 border-slate-700'
                          }`}>
                            {isCertified ? 'Yes' : tierKey.startsWith('B') ? 'Reconciled' : 'No'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="text-[10px] text-slate-500 pt-1">
              Note: The 99.2% figure is a share of road-link <em>length</em>, not of the application.
              Never print a single "app is X% certified" number.
            </div>
          </div>

          {/* Corrections List */}
          <div className="bg-slate-900/80 border border-slate-800 p-6 rounded-2xl space-y-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
              <h3 className="text-lg font-bold text-white">Corrections & Reconciliations</h3>
            </div>
            <div className="space-y-3">
              {provenance?.corrections.map((c, i) => (
                <div key={i} className="border border-slate-800 rounded-xl p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-amber-300">{c.item}</span>
                    <span className="text-xs text-slate-500">Corrected: {c.corrected_km ?? 'N/A'} km</span>
                  </div>
                  <div className="text-xs text-slate-400">Issue: {c.issue}</div>
                  <div className="text-xs text-slate-300">Resolution: {c.resolution}</div>
                </div>
              ))}
            </div>
          </div>

          {/* File Hashes */}
          <div className="bg-slate-900/80 border border-slate-800 p-6 rounded-2xl space-y-4">
            <div className="flex items-center gap-2">
              <Hash className="w-5 h-5 text-cyan-400" />
              <h3 className="text-lg font-bold text-white">File Integrity (SHA-256)</h3>
            </div>
            <div className="space-y-2 text-xs">
              {provenance && Object.entries(provenance.file_hashes).map(([file, hash]) => (
                <div key={file} className="flex items-center justify-between font-mono">
                  <span className="text-slate-400">{file}</span>
                  <span className="text-slate-300 bg-slate-950/50 px-2 py-0.5 rounded border border-slate-700">{hash}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Caveats */}
          <div className="bg-slate-900/80 border border-slate-800 p-6 rounded-2xl space-y-4">
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-slate-400" />
              <h3 className="text-lg font-bold text-white">Methodology & Limitations</h3>
            </div>
            <ul className="space-y-2 text-xs text-slate-300 list-disc list-inside">
              {provenance?.caveats.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
            <div className="text-xs text-slate-400 pt-2 border-t border-slate-800">
              <strong>Method:</strong> {provenance?.methodology}
            </div>
          </div>

          {/* Signature Block */}
          <div className="bg-slate-900/80 border border-slate-800 p-6 rounded-2xl">
            <div className="border-t border-slate-700 pt-6 space-y-6">
              <div>
                <div className="text-xs text-slate-500 mb-1">Prepared by:</div>
                <div className="font-bold text-white">Mero Sadak Nepal Development Team</div>
              </div>
              <div className="flex items-end justify-end gap-8">
                <div className="text-center">
                  <div className="border-t-2 border-slate-500 w-48 mb-1"></div>
                  <div className="text-[10px] text-slate-500">Date</div>
                </div>
                <div className="text-center">
                  <div className="border-t-2 border-slate-500 w-56 mb-1"></div>
                  <div className="text-[10px] text-slate-500">DoR Authorised Signatory</div>
                  <div className="text-[9px] text-slate-600 mt-1">[ Seal to be affixed here ]</div>
                </div>
              </div>
              <div className="text-[9px] text-slate-500 pt-4 border-t border-slate-800">
                This statement is valid as of the SNH 2022/23 publication date (June 2024).
                It represents a snapshot and does not imply live status. Distance figures are
                published DoR values or derived from them. Redistributing DoR figures under the
                DoR name requires written approval from the Department of Roads (copyright © 2023).
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
