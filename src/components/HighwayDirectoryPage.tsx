import React, { useState } from 'react';
import { ArrowLeft, Route, Settings2 } from 'lucide-react';
import { HighwayDirectory } from './HighwayDirectory';
import { SettingsMenu, SettingsButton } from './SettingsMenu';
import { TextScale } from '../hooks/useTextScale';

interface HighwayDirectoryPageProps {
  onBack?: () => void;
  textScale?: TextScale;
  onTextScaleChange?: (scale: TextScale) => void;
  accentColor?: string;
  onAccentColorChange?: (color: string) => void;
}

export const HighwayDirectoryPage: React.FC<HighwayDirectoryPageProps> = ({
  onBack,
  textScale,
  onTextScaleChange,
  accentColor,
  onAccentColorChange,
}) => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
          {onBack && (
            <button
              onClick={onBack}
              className="rounded-xl border border-slate-700 bg-slate-900 p-2 text-slate-300 transition hover:bg-slate-800 hover:text-white"
              title="Back to main app"
              aria-label="Back"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}

          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-700 bg-slate-900 shadow-lg shadow-emerald-500/5">
              <Route className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                Mero Sadak
              </div>
              <h1 className="text-lg font-black tracking-tight text-white">Highway Directory</h1>
            </div>
          </div>

          <div className="ml-auto relative">
            <button
              type="button"
              onClick={() => setIsSettingsOpen((open) => !open)}
              className="rounded-xl border border-slate-700 bg-slate-900 p-2 text-slate-300 transition hover:bg-slate-800 hover:text-white"
              title="Adjust view"
              aria-label="Open settings"
            >
              <Settings2 className="h-4 w-4" />
            </button>

            <SettingsMenu
              isOpen={isSettingsOpen}
              onClose={() => setIsSettingsOpen(false)}
              onOpenChange={setIsSettingsOpen}
              showTextSize={true}
              showAccentColor={true}
              textScale={textScale}
              onTextScaleChange={onTextScaleChange}
              accentColor={accentColor}
              onAccentColorChange={onAccentColorChange}
            />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 overflow-y-auto px-4 py-4 scrollbar-paddle">
        <div className="mb-4 rounded-2xl border border-slate-800 bg-slate-900/80 p-3">
          <p className="text-sm text-slate-300">
            Nepal national highway corridors, condition summaries, and route context.
          </p>
        </div>

        <HighwayDirectory />
      </main>
    </div>
  );
};
