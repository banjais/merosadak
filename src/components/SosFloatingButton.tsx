import React, { useState, useEffect } from 'react';
import { AlertOctagon, PhoneCall, Radio, ShieldAlert } from 'lucide-react';

interface SosFloatingButtonProps {
  onClick: () => void;
  isOpen?: boolean;
}

export const SosFloatingButton: React.FC<SosFloatingButtonProps> = ({ onClick, isOpen }) => {
  const [hasLocationPermission, setHasLocationPermission] = useState<boolean | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && navigator.permissions) {
      navigator.permissions
        .query({ name: 'geolocation' as PermissionName })
        .then((permission) => {
          setHasLocationPermission(permission.state === 'granted');
          permission.onchange = () => {
            setHasLocationPermission(permission.state === 'granted');
          };
        })
        .catch(() => {});
    }
  }, []);

  if (isOpen) return null;

  return (
    <div
      className="fixed bottom-20 sm:bottom-6 right-4 sm:right-6 z-40 flex flex-col items-end group select-none"
      id="emergency-sos-fab-container"
    >
      {/* Tooltip on hover */}
      <div className="hidden sm:group-hover:flex items-center space-x-1.5 mb-2 px-3 py-1.5 rounded-xl bg-slate-950/95 border border-red-500/60 shadow-2xl text-xs font-semibold text-red-200 pointer-events-none transition-all duration-200 animate-fadeIn backdrop-blur-md">
        <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
        <span>Emergency Highway SOS • Instant GPS Dispatch</span>
      </div>

      {/* Floating Action Button */}
      <button
        onClick={onClick}
        id="emergency-sos-fab"
        aria-label="Emergency SOS Rescue Assistant"
        className="relative flex items-center space-x-2.5 px-4 py-3 sm:px-5 sm:py-3.5 rounded-full bg-gradient-to-r from-red-600 via-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-black text-sm sm:text-base shadow-2xl shadow-red-600/60 hover:shadow-red-600/90 border-2 border-white/30 hover:border-white/60 transition-all duration-300 transform active:scale-95 group-hover:scale-105"
      >
        {/* Pulsing Outer Distress Ring */}
        <span className="absolute -inset-1 rounded-full bg-red-500 opacity-60 animate-ping pointer-events-none" />

        {/* SOS Icon */}
        <div className="relative flex items-center justify-center">
          <AlertOctagon className="w-5 h-5 sm:w-6 sm:h-6 animate-pulse text-white" />
        </div>

        {/* Text & Hotlines Badge */}
        <div className="flex flex-col items-start leading-none">
          <div className="flex items-center space-x-1.5">
            <span className="tracking-wider uppercase text-white font-black text-sm sm:text-base drop-shadow-md">
              SOS
            </span>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-red-950/70 border border-white/20 text-red-200 tracking-tight">
              100 / 103
            </span>
          </div>
          <span className="text-[10px] text-red-100 font-medium opacity-90 hidden sm:block mt-0.5">
            Rescue Dispatch
          </span>
        </div>
      </button>
    </div>
  );
};
