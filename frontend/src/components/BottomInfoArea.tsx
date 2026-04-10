import React, { useState, useRef, useCallback, useEffect } from 'react';
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
  Info,
  Lock,
  Unlock,
  ChevronDown,
  ChevronUp,
  GripVertical,
  Share2,
  Phone
} from 'lucide-react';
import { TravelIncident } from '../types';
import { SourceBadge } from './SourceBadge';

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
  const [isLocked, setIsLocked] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeService, setActiveService] = useState<string | null>(null);
  const startYRef = useRef(0);
  const currentYRef = useRef(0);
  const panelRef = useRef<HTMLDivElement>(null);

  // Touch handlers for swipe-to-close
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (isLocked) return;
    startYRef.current = e.touches[0].clientY;
  }, [isLocked]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (isLocked) return;
    currentYRef.current = e.touches[0].clientY;
    const diff = currentYRef.current - startYRef.current;
    if (diff > 0 && panelRef.current) {
      panelRef.current.style.transform = `translateY(${diff}px)`;
      panelRef.current.style.transition = 'none';
    }
  }, [isLocked]);

  const handleTouchEnd = useCallback(() => {
    if (isLocked || !panelRef.current) return;
    const diff = currentYRef.current - startYRef.current;
    panelRef.current.style.transition = 'transform 0.3s ease-out';
    panelRef.current.style.transform = '';

    if (diff > 150) {
      onClose();
    }
  }, [isLocked, onClose]);

  // Keyboard: Escape to close (when not locked)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLocked) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLocked, onClose]);

  // Reset state when selectedItem changes
  useEffect(() => {
    if (selectedItem) {
      setIsExpanded(false);
      setActiveService(null);
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      setIsSpeaking(false);
    }
  }, [selectedItem?.id]);

  // Build full content for TTS
  const buildTTSText = (): string => {
    const parts: string[] = [];
    parts.push(selectedItem.title);

    if (selectedItem.description) {
      parts.push(selectedItem.description);
    }

    if (selectedItem.status) {
      parts.push(`Status: ${selectedItem.status}`);
    }

    if (selectedItem.incidentDistrict) {
      parts.push(`District: ${selectedItem.incidentDistrict}`);
    }

    if (selectedItem.incidentPlace) {
      parts.push(selectedItem.incidentPlace);
    }

    if (selectedItem.chainage) {
      parts.push(`Chainage: ${selectedItem.chainage}`);
    }

    if (selectedItem.incidentStarted) {
      parts.push(`Incident started: ${selectedItem.incidentStarted}`);
    }

    if (selectedItem.estimatedRestoration) {
      parts.push(`Estimated restoration: ${selectedItem.estimatedRestoration}`);
    }

    if (selectedItem.resumedDate) {
      parts.push(`Resumed on: ${selectedItem.resumedDate}`);
    }

    if (selectedItem.blockedHours) {
      parts.push(`Blocked for ${selectedItem.blockedHours} hours`);
    }

    if (selectedItem.contactPerson) {
      parts.push(`Contact: ${selectedItem.contactPerson}`);
    }

    if (selectedItem.remarks) {
      parts.push(`Remarks: ${selectedItem.remarks}`);
    }

    return parts.join('. ');
  };

  const handleSpeak = () => {
    if ('speechSynthesis' in window) {
      if (isSpeaking) {
        window.speechSynthesis.cancel();
        setIsSpeaking(false);
      } else {
        const text = buildTTSText();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.9;
        utterance.lang = 'en-US';
        utterance.onend = () => setIsSpeaking(false);
        utterance.onerror = () => setIsSpeaking(false);
        setIsSpeaking(true);
        window.speechSynthesis.speak(utterance);
      }
    }
  };

  // Share incident
  const handleShare = async () => {
    const shareText = buildTTSText();

    if (navigator.share) {
      try {
        await navigator.share({
          title: selectedItem.title,
          text: shareText,
          url: window.location.href
        });
      } catch {
        // User cancelled share
      }
    } else {
      // Fallback: copy to clipboard
      try {
        await navigator.clipboard.writeText(shareText);
        // Could show a toast here
      } catch {
        // Clipboard failed
      }
    }
  };

  const handleServiceClick = (id: string, label: string) => {
    setActiveService(id);
    onAskAI(`Show me nearest ${label} around ${selectedItem.title}`);
    setTimeout(() => setActiveService(null), 3000);
  };

  const toggleExpand = () => setIsExpanded(prev => !prev);
  const toggleLock = () => setIsLocked(prev => !prev);

  if (!selectedItem) return null;

  // Determine if this is a DOR highway incident (important data)
  const isDORIncident = selectedItem.source === 'DOR' || selectedItem.source === 'Department of Roads' || selectedItem.source === 'sheets' || selectedItem.source === 'highway';

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-[2200] transition-all duration-500 ${isExpanded ? 'p-0' : 'p-3'
        }`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div
        ref={panelRef}
        className={`w-full mx-auto backdrop-blur-2xl border relative transition-all duration-300 ${isExpanded
            ? 'max-w-full h-[90vh] rounded-none'
            : `max-w-4xl max-h-[calc(100vh-3rem)] overflow-y-auto rounded-t-[2rem] shadow-[0_-8px_40px_rgba(0,0,0,0.12)] ${isDarkMode
              ? 'bg-slate-900/90 border-slate-700/50'
              : 'bg-white/90 border-white/50'
            }`
          } ${isLocked ? 'ring-2 ring-primary/50' : ''}`}
      >
        {/* Drag Handle / Expand Toggle */}
        <div className="flex items-center justify-center pt-2 pb-1">
          <button
            onClick={toggleExpand}
            className={`p-1.5 rounded-full transition-all hover:scale-110 active:scale-95 ${isDarkMode ? 'text-slate-500 hover:text-slate-300' : 'text-gray-400 hover:text-gray-600'
              }`}
            title={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </button>
        </div>

        {/* Top Controls Row */}
        <div className="absolute top-2 left-4 flex items-center gap-2">
          {/* Lock Button */}
          <button
            onClick={toggleLock}
            className={`p-2.5 rounded-full border backdrop-blur-md transition-all hover:scale-110 active:scale-95 ${isLocked
                ? 'bg-primary/20 text-primary border-primary/40 shadow-lg shadow-primary/20'
                : isDarkMode
                  ? 'bg-slate-800/60 text-slate-400 border-slate-700/40 hover:bg-slate-700/60'
                  : 'bg-gray-100/80 text-gray-500 border-gray-200/60 hover:bg-gray-200/80'
              }`}
            title={isLocked ? 'Unlock panel' : 'Lock panel'}
          >
            {isLocked ? <Lock size={16} /> : <Unlock size={16} />}
          </button>

          {/* Grip Indicator */}
          {!isLocked && (
            <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest ${isDarkMode ? 'text-slate-600 bg-slate-800/40' : 'text-gray-400 bg-gray-100/60'
              }`}>
              <GripVertical size={10} />
              <span>Swipe ↓</span>
            </div>
          )}
        </div>

        {/* Right Top Controls */}
        <div className="absolute top-2 right-4 flex items-center gap-2">
          {/* TTS Button */}
          <button
            onClick={handleSpeak}
            className={`p-2.5 rounded-full border backdrop-blur-md transition-all hover:scale-110 active:scale-95 ${isSpeaking
                ? 'bg-red-500/20 text-red-500 border-red-500/40 shadow-lg shadow-red-500/20 animate-pulse'
                : isDarkMode
                  ? 'bg-slate-800/60 text-blue-400 border-slate-700/40 hover:bg-slate-700/60'
                  : 'bg-blue-50/80 text-blue-600 border-blue-200/60 hover:bg-blue-100/80'
              }`}
            title={isSpeaking ? 'Stop reading' : 'Read full details aloud'}
          >
            <Volume2 size={16} />
          </button>

          {/* Share Button */}
          <button
            onClick={handleShare}
            className={`p-2.5 rounded-full border backdrop-blur-md transition-all hover:scale-110 active:scale-95 ${isDarkMode
                ? 'bg-slate-800/60 text-emerald-400 border-slate-700/40 hover:bg-slate-700/60'
                : 'bg-emerald-50/80 text-emerald-600 border-emerald-200/60 hover:bg-emerald-100/80'
              }`}
            title="Share incident"
          >
            <Share2 size={16} />
          </button>

          {/* Close Button */}
          {!isLocked && (
            <button
              onClick={onClose}
              className={`p-2.5 rounded-full border backdrop-blur-md transition-all hover:scale-110 active:scale-95 ${isDarkMode
                  ? 'bg-slate-800/60 text-slate-300 border-slate-700/40 hover:bg-red-900/30 hover:text-red-400 hover:border-red-800/40'
                  : 'bg-gray-100/80 text-gray-600 border-gray-200/60 hover:bg-red-50/80 hover:text-red-600 hover:border-red-200/60'
                }`}
              title="Close panel (Esc)"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Main Content */}
        <div className={`px-6 ${isExpanded ? 'py-4' : 'py-3'}`}>
          <div className="flex flex-col md:flex-row gap-6 items-start">
            {/* Content Side */}
            <div className={`flex-1 space-y-3 ${isExpanded ? 'overflow-y-auto max-h-[60vh]' : ''}`}>
              {/* Header */}
              <div className="flex items-start gap-3">
                <div className={`p-2.5 rounded-xl shadow-lg flex-shrink-0 ${selectedItem.severity === 'high'
                    ? 'bg-gradient-to-br from-red-500 to-orange-500 text-white shadow-red-500/30'
                    : selectedItem.severity === 'medium'
                      ? 'bg-gradient-to-br from-amber-500 to-yellow-500 text-white shadow-amber-500/30'
                      : 'bg-gradient-to-br from-primary to-tertiary text-white shadow-primary/30'
                  }`}>
                  {selectedItem.type === 'road' ? <AlertTriangle size={20} /> : selectedItem.type === 'poi' ? <MapIcon size={20} /> : <Info size={20} />}
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className={`font-headline font-extrabold uppercase tracking-tight leading-tight ${isDarkMode ? 'text-white' : 'text-slate-900'
                    } ${isExpanded ? 'text-2xl' : 'text-lg'}`}>
                    {selectedItem.title}
                  </h2>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <SourceBadge source={selectedItem.source} size="sm" />
                    {isDORIncident && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-600 border border-blue-500/20">
                        Official
                      </span>
                    )}
                    <span className={`text-[10px] font-medium ${isDarkMode ? 'text-slate-500' : 'text-gray-500'
                      }`}>
                      {selectedItem.incidentDistrict || 'Nepal'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Description */}
              <p className={`text-sm leading-relaxed font-medium ${isDarkMode ? 'text-slate-400' : 'text-gray-600'
                } ${!isExpanded ? 'line-clamp-2' : ''}`}>
                {selectedItem.description}
              </p>

              {/* IMPORTANT: DOR Highway Data Fields */}
              {isDORIncident && (selectedItem.road_refno || selectedItem.incidentDistrict || selectedItem.chainage) && (
                <div className={`p-3 rounded-xl border ${isDarkMode ? 'bg-blue-900/20 border-blue-800/30' : 'bg-blue-50/80 border-blue-200/60'
                  }`}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[9px] font-bold uppercase tracking-widest text-blue-600">
                      🏛️ Department of Roads — Official Data
                    </span>
                  </div>
                  <div className={`grid gap-2 ${isExpanded ? 'grid-cols-3 md:grid-cols-4' : 'grid-cols-2 md:grid-cols-3'
                    }`}>
                    {selectedItem.road_refno && (
                      <DataField label="Highway" value={selectedItem.road_refno} isDarkMode={isDarkMode} isMono />
                    )}
                    {selectedItem.incidentDistrict && (
                      <DataField
                        label="District"
                        value={`${selectedItem.incidentDistrict}${selectedItem.incidentPlace ? ` — ${selectedItem.incidentPlace}` : ''}`}
                        isDarkMode={isDarkMode}
                      />
                    )}
                    {selectedItem.chainage && (
                      <DataField label="Chainage" value={selectedItem.chainage} isDarkMode={isDarkMode} />
                    )}
                  </div>
                </div>
              )}

              {/* All Data Fields */}
              {(selectedItem.incidentStarted || selectedItem.estimatedRestoration || selectedItem.resumedDate || selectedItem.blockedHours || selectedItem.contactPerson || selectedItem.restorationEfforts || selectedItem.remarks) && (
                <div className={`grid gap-2 ${isExpanded ? 'grid-cols-3 md:grid-cols-4' : 'grid-cols-2 md:grid-cols-3'
                  }`}>
                  {selectedItem.incidentStarted && (
                    <DataField label="Started" value={selectedItem.incidentStarted} isDarkMode={isDarkMode} />
                  )}
                  {selectedItem.estimatedRestoration && (
                    <DataField label="Restoration" value={selectedItem.estimatedRestoration} isDarkMode={isDarkMode} />
                  )}
                  {selectedItem.resumedDate && (
                    <DataField label="Resumed" value={selectedItem.resumedDate} isDarkMode={isDarkMode} highlight="success" />
                  )}
                  {selectedItem.blockedHours && (
                    <DataField label="Blocked" value={`${selectedItem.blockedHours}h`} isDarkMode={isDarkMode} highlight="error" />
                  )}
                  {selectedItem.contactPerson && (
                    <DataField label="Contact" value={selectedItem.contactPerson} isDarkMode={isDarkMode} />
                  )}
                </div>
              )}

              {selectedItem.restorationEfforts && (
                <div className="pt-1">
                  <span className={`text-[9px] uppercase font-bold tracking-widest font-label ${isDarkMode ? 'text-slate-600' : 'text-gray-400'
                    }`}>Restoration Efforts</span>
                  <p className={`text-xs mt-0.5 ${isDarkMode ? 'text-slate-400' : 'text-gray-600'}`}>
                    {selectedItem.restorationEfforts}
                  </p>
                </div>
              )}
              {selectedItem.remarks && (
                <div className="pt-1">
                  <span className={`text-[9px] uppercase font-bold tracking-widest font-label ${isDarkMode ? 'text-slate-600' : 'text-gray-400'
                    }`}>Remarks</span>
                  <p className={`text-xs mt-0.5 italic ${isDarkMode ? 'text-slate-500' : 'text-gray-500'
                    }`}>
                    {selectedItem.remarks}
                  </p>
                </div>
              )}

              {/* Status Bar */}
              <div className="flex items-center gap-4 pt-1">
                <div className="flex flex-col">
                  <span className={`text-[10px] uppercase font-bold tracking-widest font-label ${isDarkMode ? 'text-slate-600' : 'text-gray-400'
                    }`}>Status</span>
                  <span className={`text-sm font-bold font-headline ${selectedItem.severity === 'high' ? 'text-red-500'
                      : selectedItem.severity === 'medium' ? 'text-amber-500'
                        : 'text-emerald-500'
                    }`}>
                    {selectedItem.status || selectedItem.severity || 'Unknown'}
                  </span>
                </div>
                {selectedItem.div_name && (
                  <>
                    <div className={`w-px h-8 ${isDarkMode ? 'bg-slate-700' : 'bg-gray-200'}`} />
                    <div className="flex flex-col">
                      <span className={`text-[10px] uppercase font-bold tracking-widest font-label ${isDarkMode ? 'text-slate-600' : 'text-gray-400'
                        }`}>Division</span>
                      <span className={`text-sm font-bold font-headline ${isDarkMode ? 'text-white' : 'text-slate-900'
                        }`}>{selectedItem.div_name}</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Action Buttons Side */}
            <div className="w-full md:w-auto flex-shrink-0">
              <div className="grid grid-cols-2 md:flex md:flex-col gap-2">
                <ActionButton
                  icon={<Navigation size={16} />}
                  label="Navigate"
                  variant="primary"
                  onClick={() => onSelectLocation(selectedItem)}
                />
                <ActionButton
                  icon={<Sparkles size={16} />}
                  label="Ask AI"
                  variant="secondary"
                  onClick={() => onAskAI(`What is the current safest route avoiding ${selectedItem.title}?`)}
                />
                <ActionButton
                  icon={<MapIcon size={16} />}
                  label="Explore"
                  variant="tertiary"
                  onClick={() => onSelectLocation(selectedItem)}
                />
                {selectedItem.contactPerson && (
                  <ActionButton
                    icon={<Phone size={16} />}
                    label="Contact"
                    variant="tertiary"
                    onClick={() => {
                      // Could open phone dialer or copy number
                      if (selectedItem.phone) {
                        window.open(`tel:${selectedItem.phone}`);
                      }
                    }}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Service Suggestions (Bottom Strip) */}
          <div className={`mt-5 pt-4 border-t flex items-center justify-between gap-4 ${isDarkMode ? 'border-slate-700/50' : 'border-gray-200/80'
            }`}>
            <div className="flex-1 flex items-center gap-3 overflow-x-auto no-scrollbar pb-1">
              {[
                { id: 'fuel', icon: <Fuel size={15} />, label: 'Fuel' },
                { id: 'food', icon: <ChefHat size={15} />, label: 'Food' },
                { id: 'medical', icon: <Stethoscope size={15} />, label: 'Medical' },
                { id: 'weather', icon: <CloudRain size={15} />, label: 'Weather' }
              ].map(s => (
                <button
                  key={s.id}
                  onClick={() => handleServiceClick(s.id, s.label)}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all whitespace-nowrap ${activeService === s.id
                      ? isDarkMode
                        ? 'bg-primary/20 text-primary shadow-lg shadow-primary/10'
                        : 'bg-primary/10 text-primary shadow-md shadow-primary/10'
                      : isDarkMode
                        ? 'bg-slate-800/40 text-slate-500 hover:bg-slate-700/60 hover:text-blue-400'
                        : 'bg-gray-50/80 text-gray-500 hover:bg-gray-100/80 hover:text-blue-600'
                    }`}
                >
                  <div className={`w-7 h-7 rounded-md flex items-center justify-center transition-all ${activeService === s.id
                      ? 'bg-gradient-to-br from-primary to-tertiary text-white shadow-md shadow-primary/30'
                      : isDarkMode
                        ? 'bg-slate-700/60 text-slate-400'
                        : 'bg-gray-200/60 text-gray-500'
                    }`}>
                    {s.icon}
                  </div>
                  <span className={`text-[10px] font-bold uppercase tracking-wider font-label ${activeService === s.id
                      ? 'text-primary'
                      : isDarkMode
                        ? 'text-slate-500'
                        : 'text-gray-500'
                    }`}>{s.label}</span>
                </button>
              ))}
            </div>

            <div className="hidden lg:block">
              <span className={`text-[9px] font-bold uppercase tracking-[0.4em] italic leading-none font-label ${isDarkMode ? 'text-slate-700' : 'text-gray-300'
                }`}>MEROSADAK SERVICES</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Data Field Component ───
const DataField = ({ label, value, isDarkMode, isMono, highlight }: {
  label: string;
  value: string;
  isDarkMode: boolean;
  isMono?: boolean;
  highlight?: 'success' | 'error';
}) => (
  <div className="flex flex-col">
    <span className={`text-[9px] uppercase font-bold tracking-widest font-label ${isDarkMode ? 'text-slate-600' : 'text-gray-400'
      }`}>{label}</span>
    <span className={`text-xs font-bold ${isMono ? 'font-mono' : ''} ${highlight === 'success' ? 'text-emerald-500'
        : highlight === 'error' ? 'text-red-500'
          : isDarkMode ? 'text-slate-300' : 'text-slate-700'
      }`}>{value}</span>
  </div>
);

// ─── Action Button Component ───
const ActionButton = ({ icon, label, variant = 'secondary', onClick }: {
  icon: React.ReactNode;
  label: string;
  variant?: 'primary' | 'secondary' | 'tertiary';
  onClick: () => void;
}) => {
  const variants = {
    primary: {
      bg: 'bg-gradient-to-br from-blue-600 to-blue-700',
      bgHover: 'hover:from-blue-500 hover:to-blue-600',
      text: 'text-white',
      border: 'border-transparent',
      shadow: 'shadow-lg shadow-blue-600/40',
    },
    secondary: {
      bg: 'bg-slate-800/60',
      bgHover: 'hover:bg-blue-600/20',
      text: 'text-blue-400',
      border: 'border-blue-500/20',
      shadow: 'shadow-md shadow-slate-900/20',
    },
    tertiary: {
      bg: 'bg-gray-100/80',
      bgHover: 'hover:bg-blue-50/80',
      text: 'text-gray-600 hover:text-blue-600',
      border: 'border-gray-200/60',
      shadow: 'shadow-sm',
    },
    success: {
      bg: 'bg-gradient-to-br from-emerald-600 to-emerald-700',
      bgHover: 'hover:from-emerald-500 hover:to-emerald-600',
      text: 'text-white',
      border: 'border-transparent',
      shadow: 'shadow-lg shadow-emerald-600/40',
    },
  };

  const style = variants[variant] || variants.secondary;

  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-center md:justify-start gap-2.5 px-5 py-3 rounded-xl transition-all duration-200 hover:scale-[1.03] active:scale-[0.97] font-label border ${style.bg} ${style.bgHover} ${style.text} ${style.border} ${style.shadow}`}
    >
      {icon}
      <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
    </button>
  );
};
