import React, { useState, useEffect } from 'react';
import { Bell, Globe, Settings, Navigation, Sparkles, Zap, ClipboardList, User } from 'lucide-react';
import { useTranslation } from '../i18n';

interface HeaderProps {
  isDarkMode: boolean;
  accentColor: string;
  onTogglePilot: () => void;
  onToggleMenu: () => void;
  onToggleSystemMenu: () => void;
  onOpenNotifications: () => void;
  onToggleMyPlans?: () => void;
  onLogoClick?: () => void;
  plansCount?: number;
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

const Header: React.FC<HeaderProps> = ({ isDarkMode, accentColor, onTogglePilot, onToggleMenu, onToggleSystemMenu, onOpenNotifications, onToggleMyPlans, onLogoClick, plansCount = 0, noticeCount = 3 }) => {
  const { language, setLanguage } = useTranslation();
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [geoActive, setGeoActive] = useState(false);

  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(() => setGeoActive(true), () => setGeoActive(false));
    }
  }, []);

  return (
    <header className={`h-16 sm:h-20 absolute top-0 left-0 w-full flex items-center justify-between px-4 sm:px-6 shadow-[0_8px_30px_rgb(0,0,0,0.12)] backdrop-blur-xl z-[1000] border-b transition-all duration-500 ${isDarkMode
      ? 'bg-slate-900/50 border-slate-700/30 text-white'
      : 'bg-indigo-600/60 border-white/20 text-white'
      }`}>

      {/* Left: Branding & Menu */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleMenu}
          className={`p-2 rounded-xl transition-all ${isDarkMode
            ? 'bg-white/10 hover:bg-white/20 text-white'
            : 'bg-white/10 hover:bg-white/20 text-white'
            }`}
        >
          <Navigation className="w-5 h-5 rotate-90" />
        </button>
        <div
          onClick={onLogoClick}
          className={`p-2 rounded-2xl shadow-lg ring-4 shrink-0 transition-all cursor-pointer hover:scale-110 active:scale-90 ${isDarkMode ? 'bg-slate-800 ring-white/5' : 'bg-white ring-black/5'
            }`}
          style={{ color: `var(--brand-primary, #4f46e5)` }}
        >
          <Navigation className="w-5 h-5 sm:w-6 sm:h-6 fill-current" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className={`font-black tracking-tighter text-lg sm:text-2xl leading-none truncate transition-colors ${isDarkMode ? 'text-white' : 'text-white'
              }`}>MEROSADAK</h1>
            {geoActive ? (
              <span className="w-2.5 h-2.5 bg-emerald-400 rounded-full animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.6)]" title="Location Active" />
            ) : (
              <Zap className="w-3 h-3 text-amber-400" title="Ready" />
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-[9px] sm:text-[10px] font-bold uppercase tracking-widest opacity-80 hidden sm:block transition-colors ${isDarkMode ? 'text-slate-300' : 'text-indigo-100'
              }`}>Travel Safety Engine</span>
            <span className={`text-[10px] font-bold flex items-center gap-1 px-2 py-0.5 rounded-full transition-colors ${isDarkMode
              ? 'bg-white/10 text-white/80'
              : 'bg-white/10 text-white/80'
              }`}>
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
            className={`flex items-center gap-1 p-1.5 sm:p-2 rounded-xl text-white transition-all ${isDarkMode ? 'bg-white/10 hover:bg-white/20' : 'bg-white/10 hover:bg-white/20'
              }`}
          >
            <Globe size={18} className="sm:w-[20px] sm:h-[20px]" />
            <span className="text-[10px] sm:text-xs font-bold uppercase hidden sm:block">
              {LANGUAGES.find(l => l.code === language)?.native || 'EN'}
            </span>
          </button>

          {showLangMenu && (
            <div className={`absolute right-0 top-full mt-2 rounded-xl shadow-2xl border py-1 min-w-[180px] z-[900] transition-colors ${isDarkMode
              ? 'bg-slate-800 border-slate-700'
              : 'bg-white border-gray-100'
              }`}>
              {LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => { setLanguage(lang.code as any); setShowLangMenu(false); }}
                  className={`w-full px-4 py-2 text-left text-sm transition-colors flex items-center gap-2 ${language === lang.code
                    ? isDarkMode
                      ? 'bg-indigo-900/50 text-indigo-300 font-semibold'
                      : 'bg-indigo-100 text-indigo-700 font-semibold'
                    : isDarkMode
                      ? 'text-slate-200 hover:bg-slate-700'
                      : 'text-gray-700 hover:bg-indigo-50'
                    }`}
                >
                  <span className="text-lg">{lang.flag}</span>
                  <span className="font-medium">{lang.native}</span>
                  <span className={`text-xs ml-auto ${isDarkMode ? 'text-slate-400' : 'text-gray-400'
                    }`}>{lang.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* My Plans Badge */}
        {onToggleMyPlans && plansCount > 0 && (
          <button
            onClick={onToggleMyPlans}
            className="relative p-2 sm:p-2.5 rounded-xl text-white transition-all bg-white/10 hover:bg-white/20"
            title="My Travel Plans"
          >
            <ClipboardList size={20} className="sm:w-[22px] sm:h-[22px]" />
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-blue-500 border-2 border-indigo-600 text-white text-[10px] font-black flex items-center justify-center rounded-full shadow-lg">
              {plansCount}
            </span>
          </button>
        )}

        <div className="relative group cursor-pointer" onClick={onOpenNotifications}>
          <div className={`p-2 sm:p-2.5 rounded-xl text-white transition-all ${isDarkMode ? 'bg-white/10 hover:bg-white/20' : 'bg-white/10 hover:bg-white/20'
            }`}>
            <Bell size={20} className="sm:w-[22px] sm:h-[22px]" />
          </div>
          {noticeCount > 0 && (
            <span className={`absolute -top-1 -right-1 w-5 h-5 text-white text-[10px] font-black flex items-center justify-center rounded-full shadow-lg ${isDarkMode ? 'bg-red-500 border-2 border-slate-800' : 'bg-red-500 border-2 border-indigo-600'
              }`}>
              {noticeCount}
            </span>
          )}
        </div>

        <button
          onClick={onToggleSystemMenu}
          className={`p-2 sm:p-2.5 rounded-xl text-white transition-all ${isDarkMode ? 'bg-white/10 hover:bg-white/20' : 'bg-white/10 hover:bg-white/20'
            }`}
        >
          <User size={20} className="sm:w-[22px] sm:h-[22px]" />
        </button>
      </div>

    </header>
  );
};

export default Header;
