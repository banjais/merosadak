import React, { useState, useEffect } from 'react';
import { Bell, Globe, MoreVertical, Navigation, Sparkles, Zap } from 'lucide-react';
import { useTranslation } from '../i18n';

interface HeaderProps {
  isDarkMode: boolean;
  onTogglePilot: () => void;
  onToggleMenu: () => void;
  onToggleSystemMenu: () => void;
  onOpenNotifications: () => void;
  noticeCount?: number;
}

const LANGUAGES = [
  { code: 'en', name: 'English', native: 'English', flag: '🇬🇧' },
  { code: 'ne', name: 'Nepali', native: 'नेपाली', flag: '🇳🇵' },
  { code: 'hi', name: 'Hindi', native: 'हिंदी', flag: '🇮🇳' },
  { code: 'bho', name: 'Bhojpuri', native: 'भोजपुरी', flag: '🇳🇵' },
  { code: 'mai', name: 'Maithili', native: 'मैथिली', flag: '🇳🇵' },
  { code: 'new', name: 'Newari', native: 'नेपाल भाषा', flag: '🇳🇵' },
];

const Header: React.FC<HeaderProps> = ({ onTogglePilot, onToggleMenu, onToggleSystemMenu, onOpenNotifications, noticeCount = 3 }) => {
  const { language, setLanguage } = useTranslation();
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [geoActive, setGeoActive] = useState(false);

  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(() => setGeoActive(true), () => setGeoActive(false));
    }
  }, []);

  return (
    <header className="h-16 sm:h-20 bg-indigo-600 relative flex items-center justify-between px-4 sm:px-6 shadow-2xl z-[1001] border-b border-indigo-500/30">

      {/* Left: Branding & Menu */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleMenu}
          className="p-2 bg-white/10 hover:bg-white/20 rounded-xl text-white"
        >
          <Navigation className="w-5 h-5 rotate-90" />
        </button>
        <div className="bg-white p-2 rounded-2xl shadow-lg ring-4 ring-white/10 shrink-0">
          <Navigation className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-600 fill-current" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="font-black tracking-tighter text-lg sm:text-2xl text-white leading-none truncate">MEROSADAK</h1>
            {geoActive ? (
              <span className="w-2.5 h-2.5 bg-emerald-400 rounded-full animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.6)]" title="Location Active" />
            ) : (
              <Zap className="w-3 h-3 text-amber-400" title="Ready" />
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] sm:text-[10px] font-bold text-indigo-100 uppercase tracking-widest opacity-80 hidden sm:block">Travel Safety Engine</span>
            <span className="text-[10px] font-bold text-white/80 flex items-center gap-1 bg-white/10 px-2 py-0.5 rounded-full">
              {LANGUAGES.find(l => l.code === language)?.flag} {LANGUAGES.find(l => l.code === language)?.native}
            </span>
          </div>
        </div>
      </div>

      {/* Center: The "Notch" Pilot */}
      <div className="absolute left-1/2 -translate-x-1/2 top-0 h-8 sm:h-10 w-32 sm:w-44 bg-slate-950 rounded-b-[20px] sm:rounded-b-[24px] flex items-center justify-center border-x border-b border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.4)] transition-all hover:h-12 group cursor-pointer z-10"
        onClick={onTogglePilot}>
        <div className="flex items-center gap-1 sm:gap-2">
          <Sparkles className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-red-500 animate-pulse" />
          <span className="text-[7px] sm:text-[9px] font-black text-white uppercase tracking-[0.1em] sm:tracking-[0.2em] group-hover:text-indigo-400">Pilot</span>
          <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-indigo-500" />
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Language Selector Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowLangMenu(!showLangMenu)}
            className="flex items-center gap-1 p-1.5 sm:p-2 bg-white/10 hover:bg-white/20 rounded-xl text-white transition-all"
          >
            <Globe size={18} className="sm:w-[20px] sm:h-[20px]" />
            <span className="text-[10px] sm:text-xs font-bold uppercase hidden sm:block">
              {LANGUAGES.find(l => l.code === language)?.native || 'EN'}
            </span>
          </button>

          {showLangMenu && (
            <div className="absolute right-0 top-full mt-2 bg-white rounded-xl shadow-2xl border border-gray-100 py-1 min-w-[180px] z-[1100]">
              {LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => { setLanguage(lang.code as any); setShowLangMenu(false); }}
                  className={`w-full px-4 py-2 text-left text-sm hover:bg-indigo-50 transition-colors flex items-center gap-2 ${language === lang.code ? 'bg-indigo-100 text-indigo-700 font-semibold' : 'text-gray-700'
                    }`}
                >
                  <span className="text-lg">{lang.flag}</span>
                  <span className="font-medium">{lang.native}</span>
                  <span className="text-xs text-gray-400 ml-auto">{lang.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="relative group cursor-pointer" onClick={onOpenNotifications}>
          <div className="p-2 sm:p-2.5 bg-white/10 hover:bg-white/20 rounded-xl text-white transition-all">
            <Bell size={20} className="sm:w-[22px] sm:h-[22px]" />
          </div>
          {noticeCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 border-2 border-indigo-600 text-white text-[10px] font-black flex items-center justify-center rounded-full shadow-lg">
              {noticeCount}
            </span>
          )}
        </div>

        <button
          onClick={onToggleSystemMenu}
          className="p-2 sm:p-2.5 bg-white/10 hover:bg-white/20 rounded-xl text-white transition-all"
        >
          <MoreVertical size={20} className="sm:w-[22px] sm:h-[22px]" />
        </button>
      </div>

    </header>
  );
};

export default Header;
