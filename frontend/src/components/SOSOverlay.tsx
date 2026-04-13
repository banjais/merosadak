import React, { useState, useEffect } from 'react';
import { ShieldAlert, Phone, MapPin, Share2, X, AlertTriangle, Radio } from 'lucide-react';

interface SOSOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  userLocation: { lat: number; lng: number } | null;
}

export const SOSOverlay: React.FC<SOSOverlayProps> = ({ isOpen, onClose, userLocation }) => {
  const [isSending, setIsSending] = useState(false);
  const [complete, setComplete] = useState(false);

  function handleClose() {
    setIsSending(false);
    setComplete(false);
    onClose();
  }

  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTriggerSOS = () => {
    setIsSending(true);
    // Simulate sending SOS to backend/emergency services
    setTimeout(() => {
      setIsSending(false);
      setComplete(true);
    }, 3000);
  };

  const emergencyNumbers = [
    { label: 'Police (National)', number: '100' },
    { label: 'Ambulance (Red Cross)', number: '102' },
    { label: 'Fire Brigade', number: '101' },
    { label: 'Traffic Police', number: '103' },
  ];

  return (
    <div className="fixed inset-0 z-[3500] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-red-950/80 backdrop-blur-xl animate-in fade-in duration-500" />

      <button
        onClick={handleClose}
        className="absolute top-6 right-6 z-[10] p-2 text-slate-500 hover:text-white transition-colors"
      >
        <X size={24} />
      </button>

      <div className="relative z-[5001] w-full max-w-md glass-pilot border-2 border-red-500/30 rounded-[40px] shadow-[0_0_100px_rgba(239,68,68,0.4)] overflow-hidden animate-in zoom-in-95 duration-300">

        {/* Animated Background Pulse */}
        <div className="absolute inset-0 bg-red-500/5 animate-pulse" />

        <div className="p-8 flex flex-col items-center text-center relative z-10">
          <div className="w-20 h-20 bg-red-500 rounded-full flex items-center justify-center shadow-[0_0_40px_rgba(239,68,68,0.6)] mb-6 animate-bounce">
            <ShieldAlert size={40} className="text-white" />
          </div>

          <h2 className="text-3xl font-black text-white uppercase tracking-tighter mb-2 italic">Emergency SOS</h2>
          <p className="text-red-200/60 text-xs font-bold uppercase tracking-widest mb-8">Nepal National Response System</p>

          {!complete ? (
            <>
              <div className="bg-slate-950/50 rounded-3xl p-6 w-full border border-white/5 mb-8">
                <div className="flex items-center gap-3 text-slate-400 text-[10px] font-black uppercase tracking-widest mb-4">
                  <MapPin size={14} className="text-red-500" />
                  Broadcast Location
                </div>
                <div className="text-white font-mono text-sm bg-black/40 p-3 rounded-xl border border-white/5">
                  {userLocation ? `${userLocation.lat.toFixed(6)}, ${userLocation.lng.toFixed(6)}` : "Acquiring GPS Lock..."}
                </div>
              </div>

              <button
                onClick={handleTriggerSOS}
                disabled={isSending}
                className={`w-full py-6 rounded-3xl font-black text-xl uppercase tracking-[0.2em] transition-all relative overflow-hidden ${isSending ? 'bg-slate-800 text-slate-500' : 'bg-red-600 text-white hover:bg-red-700 active:scale-95 shadow-xl shadow-red-600/20'}`}
              >
                {isSending && <div className="absolute inset-0 bg-red-500/20 animate-ping" />}
                {isSending ? "Transmitting..." : "Send SOS Signal"}
              </button>

              <div className="grid grid-cols-2 gap-3 mt-8 w-full">
                {emergencyNumbers.map(n => (
                  <a
                    key={n.number}
                    href={`tel:${n.number}`}
                    className="flex flex-col items-center p-4 bg-white/5 rounded-2xl border border-white/5 hover:bg-white/10 transition-colors"
                  >
                    <Phone size={16} className="text-red-500 mb-1" />
                    <span className="text-[10px] text-white font-black">{n.number}</span>
                    <span className="text-[8px] text-slate-500 font-bold uppercase tracking-tighter">{n.label}</span>
                  </a>
                ))}
              </div>
            </>
          ) : (
            <div className="animate-in slide-in-from-bottom-5 duration-500">
              <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Radio size={32} className="text-emerald-500 animate-pulse" />
              </div>
              <h3 className="text-xl font-black text-white uppercase mb-2">Signal Received</h3>
              <p className="text-slate-400 text-sm leading-relaxed mb-8">
                Emergency services in your district have been notified of your coordinates. Stay at your location if safe.
              </p>
              <button
                onClick={handleClose}
                className="px-8 py-3 bg-white/10 hover:bg-white/20 rounded-full text-white text-xs font-black uppercase tracking-widest transition-all"
              >
                Dismiss HUD
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
