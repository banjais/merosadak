import React, { useState } from 'react';
import { 
  Settings, 
  User, 
  HelpCircle, 
  Info, 
  LogOut, 
  Languages, 
  Moon, 
  Sun,
  ShieldCheck,
  Smartphone
} from 'lucide-react';

interface SystemMenuProps {
  isDarkMode: boolean;
  toggleTheme: () => void;
  onOpenSettings: () => void;
  isOpen: boolean;
  onClose: () => void;
  voiceGender: 'male' | 'female';
  setVoiceGender: (v: 'male' | 'female') => void;
  aiMode: 'safe' | 'pro';
  setAiMode: (m: 'safe' | 'pro') => void;
  verbosity: 'brief' | 'detailed';
  setVerbosity: (v: 'brief' | 'detailed') => void;
  moodEQ: boolean;
  setMoodEQ: (m: boolean) => void;
}

export const SystemMenu: React.FC<SystemMenuProps> = ({ 
  isDarkMode, 
  toggleTheme, 
  onOpenSettings, 
  isOpen, 
  onClose,
  voiceGender,
  setVoiceGender,
  aiMode,
  setAiMode,
  verbosity,
  setVerbosity,
  moodEQ,
  setMoodEQ
}) => {
  if (!isOpen) return null;

  const menuItems = [
    { id: 'profile', icon: <User size={18} />, label: 'Traveler Profile', sub: 'Managed by SadakID' },
    { id: 'offline', icon: <Smartphone size={18} />, label: 'Offline Maps', sub: 'Download regions' },
    { id: 'privacy', icon: <ShieldCheck size={18} />, label: 'Safety & Privacy', sub: 'Encryption active' },
    { id: 'lang', icon: <Languages size={18} />, label: 'Language', sub: 'English / Nepali' },
  ];

  return (
    <>
      <div className="fixed inset-0 z-[1999]" onClick={onClose} />
      <div className="absolute top-20 right-6 z-[2000] w-64 glass-pilot rounded-[32px] border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.5)] p-5 animate-in fade-in zoom-in-95 duration-200 origin-top-right">
        
        {/* User Header */}
        <div className="flex items-center gap-3 mb-6 p-1">
          <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center font-black text-white shadow-lg ring-2 ring-white/10">
            SS
          </div>
          <div>
            <div className="text-xs font-black text-white leading-none">Guest Traveler</div>
            <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-1">v4.0 Pilot Build</div>
          </div>
        </div>

        {/* AI & Voice Personalization (Requested Integration) */}
        <div className="mb-6 space-y-4">
          <h4 className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] px-1">AI & Voice Settings</h4>
          
          <div className="flex flex-col gap-2">
            <div className="flex bg-slate-950/50 p-1 rounded-xl border border-white/5">
              <button 
                onClick={() => setVoiceGender('male')}
                className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${voiceGender === 'male' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500'}`}
              >
                MALE VOICE
              </button>
              <button 
                onClick={() => setVoiceGender('female')}
                className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${voiceGender === 'female' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500'}`}
              >
                FEMALE VOICE
              </button>
            </div>

            <div className="flex bg-slate-950/50 p-1 rounded-xl border border-white/5">
              <button 
                onClick={() => setAiMode('safe')}
                className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${aiMode === 'safe' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500'}`}
              >
                SAFE MODE
              </button>
              <button 
                onClick={() => setAiMode('pro')}
                className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${aiMode === 'pro' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500'}`}
              >
                PRO NAV
              </button>
            </div>

            <div className="flex bg-slate-950/50 p-1 rounded-xl border border-white/5">
              <button 
                onClick={() => setVerbosity('brief')}
                className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${verbosity === 'brief' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500'}`}
              >
                BRIEF INFO
              </button>
              <button 
                onClick={() => setVerbosity('detailed')}
                className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${verbosity === 'detailed' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500'}`}
              >
                IN-DEPTH
              </button>
            </div>

            <button 
              onClick={() => setMoodEQ(!moodEQ)}
              className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${moodEQ ? 'bg-emerald-500/10 border-emerald-500/30 font-black text-emerald-400' : 'bg-slate-950/50 border-white/5 text-slate-500'}`}
            >
              <div className="flex items-center gap-2 text-[9px] uppercase tracking-widest">
                <ShieldCheck size={14} className={moodEQ ? 'animate-pulse' : ''} />
                Mood Intelligence (EQ)
              </div>
              <div className={`text-[8px] px-2 py-0.5 rounded-full border ${moodEQ ? 'border-emerald-500/50 bg-emerald-500 text-white' : 'border-slate-700'}`}>
                {moodEQ ? 'ACTIVE' : 'OFF'}
              </div>
            </button>
          </div>
        </div>

        {/* Action List */}
        <div className="space-y-1 mb-6">
          {menuItems.map(item => (
            <button
              key={item.id}
              className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-white/10 transition-all text-left group"
            >
              <div className="text-indigo-400 group-hover:text-white transition-colors">
                {item.icon}
              </div>
              <div>
                <div className="text-[11px] font-black text-white tracking-wide">{item.label}</div>
                <div className="text-[9px] font-medium text-slate-500">{item.sub}</div>
              </div>
            </button>
          ))}
        </div>

        {/* Toggles */}
        <div className="pt-5 border-t border-white/5 space-y-2">
          <button 
            onClick={toggleTheme}
            className="w-full flex items-center justify-between p-3 rounded-2xl bg-white/5 hover:bg-white/10 transition-all"
          >
            <div className="flex items-center gap-3 text-white text-[11px] font-bold">
              {isDarkMode ? <Sun size={18} className="text-amber-400" /> : <Moon size={18} className="text-indigo-400" />}
              {isDarkMode ? 'Light Mode' : 'Dark Mode'}
            </div>
            <div className={`w-8 h-4 rounded-full relative transition-colors ${isDarkMode ? 'bg-indigo-500' : 'bg-slate-700'}`}>
               <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${isDarkMode ? 'left-4.5' : 'left-0.5'}`} />
            </div>
          </button>

          <button className="w-full flex items-center gap-3 p-3 rounded-2xl text-red-400 hover:bg-red-500/10 transition-all font-black text-[11px] uppercase tracking-widest">
            <LogOut size={18} />
            Sign Out
          </button>
        </div>

        {/* Footer */}
        <div className="mt-4 text-center">
            <span className="text-[8px] font-black text-slate-600 uppercase tracking-[0.2em]">Designed for Himalayas</span>
        </div>
      </div>
    </>
  );
};
