import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { HighwayDirectory } from './HighwayDirectory';

interface HighwayDirectoryPageProps {
  onBack?: () => void;
}

export const HighwayDirectoryPage: React.FC<HighwayDirectoryPageProps> = ({ onBack }) => {
  return (
    <div className="min-h-screen bg-[var(--surface-base)] text-slate-100 flex flex-col">
      {/* Page Header */}
      <header className="bg-[var(--surface-shell)] backdrop-blur-md border-b border-slate-800/70 accent-border sticky top-0 z-40 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2 rounded-xl bg-[var(--surface-overlay)] hover:bg-[var(--surface-elev)] accent-text border border-slate-800/80 transition"
              title="Back to Main App"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-[var(--surface-raised)] border border-emerald-500/30 flex items-center justify-center shadow-md logo-shadow">
              <svg viewBox="0 0 24 24" width="22" height="22">
                <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z" className="logo-svg" />
              </svg>
            </div>
            <div>
              <h1 className="text-sm font-semibold accent-text tracking-wider">
                Mero Sadak
              </h1>
              <p className="text-xl font-black tracking-tight text-white font-display">
                Highway Directory
              </p>
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
