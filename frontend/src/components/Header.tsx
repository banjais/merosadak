import React from 'react';
import { Bell, MoreVertical, Navigation, Sparkles } from 'lucide-react';

interface HeaderProps {
  isDarkMode: boolean;
  onTogglePilot: () => void;
  onToggleMenu: () => void;
  onToggleSystemMenu: () => void;
  onToggleSOS: () => void;
  noticeCount?: number;
}

const Header: React.FC<HeaderProps> = ({ onTogglePilot, onToggleMenu, onToggleSystemMenu, onToggleSOS, noticeCount = 3 }) => {
  return (
    <header className="h-20 bg-indigo-600 relative flex items-center justify-between px-6 shadow-2xl z-[1001] border-b border-indigo-500/30">
      
      {/* Left: Branding & Menu */}
      <div className="flex items-center gap-3">
        <button 
          onClick={onToggleMenu}
          className="p-2 bg-white/10 hover:bg-white/20 rounded-xl text-white sm:hidden"
        >
          <Navigation className="w-5 h-5 rotate-90" />
        </button>
        <div className="bg-white p-2 rounded-2xl shadow-lg ring-4 ring-white/10 hidden xxxs:block shrink-0">
          <Navigation className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-600 fill-current" />
        </div>
        <div className="min-w-0">
          <h1 className="font-black tracking-tighter text-lg sm:text-2xl text-white leading-none truncate">SADAKSATHI</h1>
          <span className="text-[9px] sm:text-[10px] font-bold text-indigo-100 uppercase tracking-widest opacity-80 hidden xs:block">Travel Safety Engine</span>
        </div>
      </div>

      {/* Center: The "Notch" Navigation (Hidden on tiny screens) */}
      <div className="absolute left-1/2 -translate-x-1/2 top-0 h-8 sm:h-10 w-32 sm:w-44 bg-slate-950 rounded-b-[20px] sm:rounded-b-[24px] flex items-center justify-center border-x border-b border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.4)] transition-all hover:h-12 group cursor-pointer z-10 hidden xxs:flex"
           onClick={onTogglePilot}>
        <div className="flex items-center gap-1 sm:gap-2">
            <Sparkles className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-red-500 animate-pulse" />
            <span className="text-[7px] sm:text-[9px] font-black text-white uppercase tracking-[0.1em] sm:tracking-[0.2em] group-hover:text-indigo-400">Pilot</span>
            <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-indigo-500" />
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-3">
        {/* SOS Button */}
        <button 
           onClick={onToggleSOS}
           className="relative group p-2 bg-red-600 hover:bg-red-700 rounded-xl text-white transition-all shadow-[0_5px_15px_rgba(220,38,38,0.4)] active:scale-90"
           title="Emergency SOS"
        >
           <ShieldAlert size={20} className="sm:w-[22px] sm:h-[22px] group-hover:animate-pulse" />
           <div className="absolute -top-1 -right-1 w-3 h-3 bg-white rounded-full animate-ping opacity-75" />
        </button>

        <div className="relative group cursor-pointer">
          <div className="p-2.5 bg-white/10 hover:bg-white/20 rounded-xl text-white transition-all">
            <Bell size={22} />
          </div>
          {noticeCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 border-2 border-indigo-600 text-white text-[10px] font-black flex items-center justify-center rounded-full shadow-lg">
              {noticeCount}
            </span>
          )}
        </div>
        
        <button 
          onClick={onToggleSystemMenu}
          className="p-2.5 bg-white/10 hover:bg-white/20 rounded-xl text-white transition-all"
        >
          <MoreVertical size={22} />
        </button>
      </div>

    </header>
  );
};

export default Header;
