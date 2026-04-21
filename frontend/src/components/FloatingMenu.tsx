import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, X, CloudRain, AlertTriangle, Fuel, ChefHat,
  Stethoscope, Ruler, TrafficCone as TrafficIcon,
  ShieldBan, Megaphone, Navigation, Mic, AlertCircle,
} from 'lucide-react';
import { useSettings } from '../SettingsContext';
import { TravelIncident, IncidentType } from '../types';
import { useIncidentReporter, QUICK_REPORT_BUTTONS } from '../hooks/useIncidentReporter';

interface FloatingMenuProps {
  onServiceSelect: (service: string) => void;
  onOpenCalculator: () => void;
  onOpenReport?: () => void;
  onTogglePilot: () => void; // Made mandatory as it's a core action
  activeService: string | null;
  incidents?: TravelIncident[];
}

export const FloatingMenu: React.FC<FloatingMenuProps> = ({
  onServiceSelect, onOpenCalculator, onOpenReport, onTogglePilot, activeService, incidents = []
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showQuickReport, setShowQuickReport] = useState(false);
  const { isDarkMode } = useSettings();
  
  const {
    isRecording,
    transcript,
    result,
    isProcessing,
    startRecording,
    stopRecording,
    submitQuickReport,
    clearResult
  } = useIncidentReporter();
  const serviceStats = useMemo(() => {
    const roadIncidents = (incidents || []).filter(i => (i.status || i.type || '').toLowerCase().includes('block'));
    return {
      roads: roadIncidents.length,
      fuel: (incidents || []).filter(i => i.type === IncidentType.POI && i.title?.toLowerCase().includes('fuel')).length,
      medical: (incidents || []).filter(i => i.type === IncidentType.POI && i.title?.toLowerCase().includes('hospital')).length,
      traffic: (incidents || []).filter(i => i.type === IncidentType.TRAFFIC).length,
      weather: (incidents || []).filter(i => i.type === IncidentType.MONSOON || i.type === IncidentType.WEATHER).length,
    };
  }, [incidents]);

  const services = [
    { id: 'fuel', icon: <Fuel size={20} />, label: 'Fuel', color: 'bg-blue-500', count: serviceStats.fuel },
    { id: 'hospital', icon: <Stethoscope size={20} />, label: 'Medical', color: 'bg-red-500', count: serviceStats.medical },
    { id: 'traffic', icon: <TrafficIcon size={20} />, label: 'Traffic', color: 'bg-orange-500', count: serviceStats.traffic },
    { id: 'monsoon', icon: <CloudRain size={20} />, label: 'Weather', color: 'bg-cyan-500', count: serviceStats.weather },
    { id: 'roads', icon: <AlertTriangle size={20} />, label: 'Roads', color: 'bg-amber-500', count: serviceStats.roads },
  ];

  const handleToggle = () => {
    if ('vibrate' in navigator) navigator.vibrate(10);
    setIsOpen(!isOpen);
  };

  const handleAction = (callback?: () => void) => {
    callback?.();
    setIsOpen(false);
  };

  return (
    <div className="fixed bottom-20 right-4 md:bottom-24 md:right-6 lg:bottom-10 lg:right-40 z-[1200] flex flex-col-reverse items-end gap-3 pointer-events-none">
      {/* Main Action Pill */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.9 }}
        onClick={handleToggle}
        className={`pointer-events-auto w-14 h-14 md:w-16 md:h-16 rounded-full flex items-center justify-center shadow-[0_8px_30px_rgb(0,0,0,0.2)] backdrop-blur-xl transition-colors duration-300 ${isOpen ? 'bg-red-500 text-white' : 'bg-indigo-600 text-white'}`}
      >
        <motion.div animate={{ rotate: isOpen ? 135 : 0 }} transition={{ type: "spring", stiffness: 200, damping: 12 }}>
          <Plus size={28} />
        </motion.div>
      </motion.button>

      {/* Expanded Services Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 250, damping: 20 }}
            className={`pointer-events-auto flex flex-col items-end gap-3 p-4 rounded-3xl backdrop-blur-2xl shadow-[0_8px_30px_rgb(0,0,0,0.15)] ${isDarkMode ? 'bg-slate-900/60 border border-slate-700/50' : 'bg-white/70 border border-white/40'}`}
          >
            <div className="flex justify-between w-full pb-2 mb-2 border-b border-gray-500/20">
              <span className={`text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-gray-500'}`}>Map Services</span>
            </div>

            <div className="grid grid-cols-3 gap-3 md:gap-4">
              {services.map((s) => {
                const isActive = activeService === s.id;
                return (
                  <motion.button
                    key={s.id}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => handleAction(() => onServiceSelect(isActive ? null : s.id))}
                    className={`relative flex flex-col items-center justify-center p-3 rounded-2xl transition-all ${isActive ? `${s.color} text-white shadow-lg` : isDarkMode ? 'bg-slate-800/80 text-slate-300 hover:bg-slate-700' : 'bg-white/80 text-gray-700 hover:bg-indigo-50'}`}
                  >
                    {s.icon}
                    <span className="text-[10px] mt-1 font-bold">{s.label}</span>
                    {s.count > 0 && (
                      <span className={`absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center rounded-full text-[9px] font-black shadow-md text-white ${s.id === 'roads' ? 'bg-red-500 animate-pulse' : 'bg-indigo-500'}`}>
                        {s.count}
                      </span>
                    )}
                  </motion.button>
                );
              })}
            </div>

            <div className="w-full flex gap-2 mt-2">
              {/* Quick Report Button */}
              <motion.button 
                whileTap={{ scale: 0.95 }} 
                onClick={() => { setShowQuickReport(!showQuickReport); }}
                className="flex-1 flex items-center justify-center gap-1 p-3 rounded-xl bg-gradient-to-br from-red-500 to-orange-500 text-white font-bold text-xs shadow-lg"
              >
                <AlertCircle size={14} /> Report
              </motion.button>
              
              {/* Voice Report */}
              <motion.button 
                whileTap={{ scale: 0.95 }} 
                onClick={startRecording}
                disabled={isRecording}
                className={`p-2.5 rounded-xl ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-red-500/80'} text-white`}
                title="Voice Report"
              >
                <Mic size={14} />
              </motion.button>
              
              <motion.button whileTap={{ scale: 0.95 }} onClick={() => handleAction(onOpenCalculator)} className={`p-2.5 rounded-xl backdrop-blur-md border ${isDarkMode ? 'bg-slate-800/80 border-slate-600 text-white' : 'bg-white/80 border-gray-200 text-gray-800'}`}>
                <Ruler size={14} />
              </motion.button>
              {onTogglePilot && (
                <motion.button whileTap={{ scale: 0.95 }} onClick={() => handleAction(onTogglePilot)} className="p-2.5 rounded-xl bg-indigo-600 text-white shadow-lg animate-pulse">
                  <Navigation size={14} />
                </motion.button>
              )}
            </div>
            
            {/* Quick Report Options */}
            {showQuickReport && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`mt-2 p-3 rounded-xl border ${isDarkMode ? 'bg-slate-800/90 border-slate-700' : 'bg-white/90 border-gray-200'}`}
              >
                <p className={`text-[10px] font-bold mb-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  🚨 QUICK REPORT
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {QUICK_REPORT_BUTTONS.map(btn => (
                    <button
                      key={btn.id}
                      onClick={() => submitQuickReport(btn.id, btn.label)}
                      disabled={isProcessing}
                      className={`${btn.color} text-white p-2 rounded-lg text-[10px] font-bold`}
                    >
                      {btn.emoji} {btn.label}
                    </button>
                  ))}
                </div>
                {transcript && (
                  <div className={`mt-2 text-[10px] p-2 rounded ${isDarkMode ? 'bg-slate-700' : 'bg-gray-100'}`}>
                    "{transcript}"
                  </div>
                )}
                {result?.message && (
                  <div className={`mt-2 text-[10px] p-2 rounded ${result.success ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                    {result.message}
                    {result.division && <span className="ml-1">📞 {result.divisionContact}</span>}
                  </div>
                )}
              </motion.div>
            )}
            
            {isRecording && (
              <div className="mt-2 text-center text-xs text-red-400 animate-pulse">
                🎤 Listening... tap to stop
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
