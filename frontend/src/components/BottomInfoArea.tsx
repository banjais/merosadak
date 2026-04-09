import React, { useState } from 'react';
import {
  X,
  Navigation,
  Map as MapIcon,
  Sparkles,
  Fuel,
  ChefHat,
  Stethoscope,
  CloudRain,
  AlertTriangle,
  Volume2,
  Info
} from 'lucide-react';
import { TravelIncident } from '../types';

interface BottomInfoAreaProps {
  selectedItem: TravelIncident | null;
  onClose: () => void;
  onSelectLocation: (incident: TravelIncident) => void;
  onAskAI: (query: string) => void;
  isDarkMode: boolean;
}

export const BottomInfoArea: React.FC<BottomInfoAreaProps> = ({
  selectedItem,
  onClose,
  onSelectLocation,
  onAskAI,
  isDarkMode
}) => {
  const [isSpeaking, setIsSpeaking] = useState(false);

  if (!selectedItem) return null;

  const handleSpeak = () => {
    if ('speechSynthesis' in window) {
      if (isSpeaking) {
        window.speechSynthesis.cancel();
        setIsSpeaking(false);
      } else {
        const text = `${selectedItem.title}. ${selectedItem.description}`;
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.onend = () => setIsSpeaking(false);
        setIsSpeaking(true);
        window.speechSynthesis.speak(utterance);
      }
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[2200] p-4 flex justify-center pointer-events-none animate-in slide-in-from-bottom-20 duration-500">
      <div className={`w-full max-w-4xl max-h-[calc(100vh-2rem)] overflow-y-auto backdrop-blur-xl border shadow-[0_-20px_50px_rgba(27,51,85,0.08)] rounded-t-[2.5rem] p-6 pointer-events-auto relative transition-colors duration-300 ${isDarkMode
        ? 'bg-slate-900/80 border-slate-700/40'
        : 'bg-white/80 border-white/40'
        }`}>

        {/* Close Button & TTS Toggle */}
        <div className="absolute -top-12 left-1/2 transform -translate-x-1/2 flex items-center gap-2">
          <button
            onClick={handleSpeak}
            className={`p-3 rounded-full border backdrop-blur-md hover:scale-110 active:scale-95 transition-all shadow-xl ${isSpeaking
              ? 'bg-error text-white animate-pulse border-error/40'
              : isDarkMode
                ? 'bg-slate-800/80 text-primary border-slate-700/40'
                : 'bg-white/80 text-primary border-white/40'
              }`}
          >
            <Volume2 size={20} />
          </button>
          <button
            onClick={onClose}
            className={`p-3 rounded-full border backdrop-blur-md hover:scale-110 active:scale-95 transition-all shadow-xl ${isDarkMode
              ? 'bg-slate-800/80 text-on-surface border-slate-700/40'
              : 'bg-white/80 text-on-surface border-white/40'
              }`}
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-col md:flex-row gap-8 items-start">

          {/* Main Content Side */}
          <div className="flex-1 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-gradient-to-br from-primary to-tertiary text-white shadow-lg shadow-primary/20">
                {selectedItem.type === 'road' ? <AlertTriangle size={24} /> : selectedItem.type === 'poi' ? <MapIcon size={24} /> : <Info size={24} />}
              </div>
              <div>
                <h2 className="text-xl font-headline font-extrabold uppercase tracking-tight text-primary">
                  {selectedItem.title}
                </h2>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest font-label ${selectedItem.severity === 'high' ? 'bg-error text-white' : 'bg-primary/10 text-primary'}`}>
                    {selectedItem.source || 'Verified'}
                  </span>
                  <span className="text-[10px] text-on-surface-variant font-medium">Region: Kathmandu Valley / Ring Road</span>
                </div>
              </div>
            </div>

            <p className="text-sm leading-relaxed text-on-surface-variant font-medium line-clamp-2 md:line-clamp-none max-w-w-2xl font-body">
              {selectedItem.description}
            </p>

            {/* Sheet data fields */}
            {(selectedItem.road_refno || selectedItem.incidentDistrict || selectedItem.chainage || selectedItem.incidentStarted || selectedItem.resumedDate || selectedItem.blockedHours || selectedItem.contactPerson || selectedItem.restorationEfforts || selectedItem.remarks) && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 pt-2">
                {selectedItem.road_refno && (
                  <div className="flex flex-col">
                    <span className="text-[9px] uppercase font-bold text-on-surface-variant/40 tracking-widest font-label">Road Ref</span>
                    <span className="text-xs font-bold text-on-surface font-mono">{selectedItem.road_refno}</span>
                  </div>
                )}
                {selectedItem.incidentDistrict && (
                  <div className="flex flex-col">
                    <span className="text-[9px] uppercase font-bold text-on-surface-variant/40 tracking-widest font-label">District</span>
                    <span className="text-xs font-bold text-on-surface">{selectedItem.incidentDistrict}{selectedItem.incidentPlace ? ` — ${selectedItem.incidentPlace}` : ''}</span>
                  </div>
                )}
                {selectedItem.chainage && (
                  <div className="flex flex-col">
                    <span className="text-[9px] uppercase font-bold text-on-surface-variant/40 tracking-widest font-label">Chainage</span>
                    <span className="text-xs font-bold text-on-surface">{selectedItem.chainage}</span>
                  </div>
                )}
                {selectedItem.incidentStarted && (
                  <div className="flex flex-col">
                    <span className="text-[9px] uppercase font-bold text-on-surface-variant/40 tracking-widest font-label">Started</span>
                    <span className="text-xs font-bold text-on-surface">{selectedItem.incidentStarted}</span>
                  </div>
                )}
                {selectedItem.estimatedRestoration && (
                  <div className="flex flex-col">
                    <span className="text-[9px] uppercase font-bold text-on-surface-variant/40 tracking-widest font-label">Est. Restoration</span>
                    <span className="text-xs font-bold text-on-surface">{selectedItem.estimatedRestoration}</span>
                  </div>
                )}
                {selectedItem.resumedDate && (
                  <div className="flex flex-col">
                    <span className="text-[9px] uppercase font-bold text-on-surface-variant/40 tracking-widest font-label">Resumed</span>
                    <span className="text-xs font-bold text-secondary">{selectedItem.resumedDate}</span>
                  </div>
                )}
                {selectedItem.blockedHours && (
                  <div className="flex flex-col">
                    <span className="text-[9px] uppercase font-bold text-on-surface-variant/40 tracking-widest font-label">Blocked Hours</span>
                    <span className="text-xs font-bold text-error">{selectedItem.blockedHours}h</span>
                  </div>
                )}
                {selectedItem.contactPerson && (
                  <div className="flex flex-col">
                    <span className="text-[9px] uppercase font-bold text-on-surface-variant/40 tracking-widest font-label">Contact</span>
                    <span className="text-xs font-bold text-on-surface">{selectedItem.contactPerson}</span>
                  </div>
                )}
              </div>
            )}

            {selectedItem.restorationEfforts && (
              <div className="pt-2">
                <span className="text-[9px] uppercase font-bold text-on-surface-variant/40 tracking-widest font-label">Restoration Efforts</span>
                <p className="text-xs text-on-surface-variant mt-0.5">{selectedItem.restorationEfforts}</p>
              </div>
            )}
            {selectedItem.remarks && (
              <div className="pt-1">
                <span className="text-[9px] uppercase font-bold text-on-surface-variant/40 tracking-widest font-label">Remarks</span>
                <p className="text-xs text-on-surface-variant/70 mt-0.5 italic">{selectedItem.remarks}</p>
              </div>
            )}

            <div className="flex gap-6 pt-2">
              <div className="flex flex-col">
                <span className="text-[10px] uppercase font-bold text-on-surface-variant/50 tracking-widest font-label">Status</span>
                <span className={`text-sm font-bold font-headline ${selectedItem.severity === 'high' ? 'text-error' : selectedItem.severity === 'medium' ? 'text-amber-500' : 'text-secondary'}`}>
                  {selectedItem.status || selectedItem.severity || 'Unknown'}
                </span>
              </div>
              {selectedItem.div_name && (
                <>
                  <div className="w-px h-8 bg-outline/10" />
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase font-bold text-on-surface-variant/50 tracking-widest font-label">Division</span>
                    <span className="text-sm font-bold text-on-surface font-headline">{selectedItem.div_name}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Action Hub Side */}
          <div className="w-full md:w-auto flex flex-col gap-4">
            <div className="grid grid-cols-3 md:flex md:flex-col gap-3">
              <ActionButton
                icon={<Navigation size={18} />}
                label="NAVIGATE"
                isPrimary
                onClick={() => onSelectLocation(selectedItem)}
              />
              <ActionButton
                icon={<Sparkles size={18} />}
                label="ASK AI"
                onClick={() => onAskAI(`What is the current safest route avoiding ${selectedItem.title}?`)}
              />
              <ActionButton
                icon={<MapIcon size={18} />}
                label="EXPLORE"
                onClick={() => onSelectLocation(selectedItem)}
              />
            </div>
          </div>
        </div>

        {/* Unified Service Suggestions (Bottom Strip) */}
        <div className={`mt-8 pt-6 border-t flex items-center justify-between gap-4 transition-colors duration-300 ${isDarkMode ? 'border-slate-700/30' : 'border-outline/10'
          }`}>
          <div className="flex-1 flex items-center gap-6 overflow-x-auto no-scrollbar pb-1">
            {[
              { id: 'fuel', icon: <Fuel size={16} />, label: 'Fuel' },
              { id: 'food', icon: <ChefHat size={16} />, label: 'Food' },
              { id: 'medical', icon: <Stethoscope size={16} />, label: 'Medical' },
              { id: 'weather', icon: <CloudRain size={16} />, label: 'Weather' }
            ].map(s => (
              <button
                key={s.id}
                onClick={() => onAskAI(`Show me nearest ${s.label} around ${selectedItem.title}`)}
                className="flex items-center gap-2 group whitespace-nowrap"
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${isDarkMode
                  ? 'bg-slate-700/50 text-primary group-hover:bg-gradient-to-br group-hover:from-primary group-hover:to-tertiary group-hover:text-white'
                  : 'bg-primary/10 text-primary group-hover:bg-gradient-to-br group-hover:from-primary group-hover:to-tertiary group-hover:text-white'
                  }`}>
                  {s.icon}
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-widest transition-all font-label ${isDarkMode
                  ? 'text-slate-400 group-hover:text-primary'
                  : 'text-on-surface-variant group-hover:text-primary'
                  }`}>{s.label}</span>
              </button>
            ))}
          </div>

          <div className="hidden lg:block">
            <span className={`text-[9px] font-bold uppercase tracking-[0.4em] italic leading-none font-label transition-colors duration-300 ${isDarkMode ? 'text-slate-600' : 'text-outline/30'
              }`}>MEROSADAK SERVICES</span>
          </div>
        </div>

      </div>
    </div>
  );
};

const ActionButton = ({ icon, label, isPrimary, onClick }: { icon: any, label: string, isPrimary?: boolean, onClick: () => void }) => (
  <button
    onClick={onClick}
    className={`flex items-center justify-center md:justify-start gap-3 px-6 py-3.5 rounded-[1.5rem] transition-all hover:scale-[1.05] active:scale-95 shadow-lg font-label ${isPrimary ? 'bg-gradient-to-br from-primary to-tertiary text-white shadow-primary/30' : 'bg-surface-container-low border border-outline/10 text-on-surface hover:bg-primary/10 hover:text-primary'}`}
  >
    {icon}
    <span className="text-[11px] font-bold uppercase tracking-widest">{label}</span>
  </button>
);
