import React, { useState, useEffect } from 'react';
import { ArrowLeft, Info, X } from 'lucide-react';
import { HighwayDirectory } from './HighwayDirectory';
import { describeHighwayCoverage, preloadHighwayCatalogue } from '../utils/highwayCatalogue';

interface HighwayDirectoryPageProps {
  onBack?: () => void;
}

export const HighwayDirectoryPage: React.FC<HighwayDirectoryPageProps> = ({ onBack }) => {
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  // Coverage text depends on the highway catalogue being loaded. Preload it
  // here so the info popover shows the right count even on a direct deep-link
  // to this page (the main RoutePlanner also preloads it, but this page can be
  // reached without ever mounting the planner).
  const [coverage, setCoverage] = useState<string>(() => describeHighwayCoverage().toLowerCase());
  useEffect(() => {
    let mounted = true;
    preloadHighwayCatalogue().then(() => {
      if (mounted) setCoverage(describeHighwayCoverage().toLowerCase());
    }).catch(() => {});
    return () => { mounted = false; };
  }, []);

  // Close the info popover on Escape.
  useEffect(() => {
    if (!isInfoOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsInfoOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isInfoOpen]);

  return (
    <div className="min-h-screen bg-[var(--surface-base)] text-slate-100 flex flex-col">
      {/* Page Header */}
      <header className="bg-slate-900/95 backdrop-blur-md border-b border-slate-700/60 accent-border sticky top-0 z-40 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 accent-text border border-slate-700/80 transition"
              title="Back to Main App"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div className="flex items-center space-x-2.5">
            <div className="flex items-center space-x-1.5">
              <div>
                <h1 className="text-[10px] font-semibold accent-text tracking-[0.2em] uppercase">
                  Highway Service
                </h1>
                <p className="text-xl font-black tracking-tight text-white font-display">
                  Highway Directory
                </p>
              </div>
              {/* Info icon — opens a popover with the directory's provenance +
                  coverage summary. The sentences used to sit as a banner at
                  the top of the page body; collapsing them into an icon keeps
                  the header the single chrome line. */}
              <div className="relative">
                <button
                  onClick={() => setIsInfoOpen((v) => !v)}
                  className={`p-1 rounded-lg transition ${isInfoOpen ? 'bg-accent-bg accent-text' : 'text-slate-400 hover:text-white hover:bg-slate-800/80'}`}
                  title="About this directory"
                  aria-label="About this directory"
                  aria-expanded={isInfoOpen}
                >
                  <Info className="w-4 h-4" />
                </button>
                {isInfoOpen && (
                  <>
                    {/* Backdrop — click anywhere outside to close. */}
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setIsInfoOpen(false)}
                    />
                    <div
                      role="dialog"
                      aria-label="About this directory"
                      className="absolute left-0 top-full mt-2 w-72 sm:w-80 z-50 bg-slate-950/98 border border-slate-800 rounded-2xl shadow-2xl backdrop-blur-md animate-fadeIn overflow-hidden"
                    >
                      <div className="flex items-center justify-between p-3 border-b border-slate-800 bg-slate-900/80">
                        <div className="flex items-center space-x-2">
                          <div className="w-6 h-6 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
                            <Info className="w-3.5 h-3.5" />
                          </div>
                          <h4 className="text-xs font-black text-white uppercase tracking-wider">
                            About this directory
                          </h4>
                        </div>
                        <button
                          onClick={() => setIsInfoOpen(false)}
                          className="p-1 rounded-md text-slate-500 hover:text-slate-200 transition"
                          title="Close"
                          aria-label="Close"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="p-3.5 space-y-2.5">
                        <span className="inline-block px-2.5 py-1 text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg">
                          GOVERNMENT OF NEPAL • DEPARTMENT OF ROADS (DOR)
                        </span>
                        <div className="flex items-center space-x-1.5 text-xs text-tertiary">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
                          <span>Real-Time Segment Telemetry</span>
                        </div>
                        <h5 className="text-sm font-bold text-white tracking-tight font-display">
                          Nepal National Highways Directory
                        </h5>
                        <p className="text-xs text-secondary leading-relaxed">
                          Live segment passability, real-time roadwork notices, active landslide obstructions, and DoR surveyed chainage links across{' '}
                          {coverage} (NH01–NH80).
                        </p>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-6 overflow-y-auto scrollbar-paddle">
        <div className="space-y-6">
          <HighwayDirectory />
        </div>
      </main>
    </div>
  );
};
