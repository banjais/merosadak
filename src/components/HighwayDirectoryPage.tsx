import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ArrowLeft, Route, Settings, Settings2 } from 'lucide-react';
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
      {/* Page Header */}
      <header className="bg-slate-900/95 backdrop-blur-md border-b border-slate-800 sticky top-0 z-40 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/80 transition"
              title="Back to Main App"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-700/90 flex items-center justify-center shadow-md logo-shadow">
              <Route className="w-5 h-5 logo-icon" />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-slate-400 tracking-wider">
                MERO SADAK
              </h1>
              <p className="text-xl font-black tracking-tight text-white font-display">
                Highway Directory
              </p>
            </div>
          </div>
          {/* Settings Menu */}
          <div className="relative ml-auto">
            <SettingsButton
              isOpen={isSettingsOpen}
              onOpenChange={setIsSettingsOpen}
            />

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

      {/* Main Content */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-6 overflow-y-auto">
        <HighwayDirectory />
      </main>
    </div>
  );
};
