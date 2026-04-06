import React from 'react';
import { 
  User, 
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
  onOpenSettings?: () => void;
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
    { id: 'profile', icon: <User size={18} />, label: 'Traveler Profile', sub: 'Emergency contacts, preferences' },
    { id: 'offline', icon: <Smartphone size={18} />, label: 'Offline Maps', sub: 'Nepal regions available' },
    { id: 'privacy', icon: <ShieldCheck size={18} />, label: 'Safety & Privacy', sub: 'End-to-end encrypted' },
    { id: 'lang', icon: <Languages size={18} />, label: 'Language Settings', sub: 'English / नेपाली / हिन्दी' },
  ];

  return (
    <>
      <div className="fixed inset-0 z-[1999]" onClick={onClose} />
      <div className="absolute top-20 right-6 z-[2000] w-64 bg-white/85 backdrop-blur-xl rounded-[2rem] border border-white/40 shadow-[0_20px_60px_rgba(27,51,85,0.15)] p-5 animate-in fade-in zoom-in-95 duration-200 origin-top-right">
        
        {/* User Header */}
        <div className="flex items-center gap-3 mb-6 p-1">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-tertiary flex items-center justify-center font-headline font-bold text-white shadow-lg ring-2 ring-white/20">
            SS
          </div>
          <div>
            <div className="text-xs font-headline font-bold text-on-surface leading-none">Guest Traveler</div>
            <div className="text-[9px] font-label font-bold text-on-surface-variant uppercase tracking-widest mt-1">v4.0 Build</div>
          </div>
        </div>

        {/* AI & Voice Personalization */}
        <div className="mb-6 space-y-4">
          <h4 className="text-[9px] font-label font-bold text-on-surface-variant uppercase tracking-[0.2em] px-1">AI & Voice Settings</h4>
          
          <div className="flex flex-col gap-2">
            <div className="flex bg-surface-container-low p-1 rounded-xl border border-outline/10">
              <button 
                onClick={() => setVoiceGender('male')}
                className={`flex-1 py-1.5 rounded-lg text-[9px] font-label font-bold uppercase transition-all ${voiceGender === 'male' ? 'bg-gradient-to-br from-primary to-primary-dim text-white shadow-lg' : 'text-on-surface-variant'}`}
              >
                MALE VOICE
              </button>
              <button 
                onClick={() => setVoiceGender('female')}
                className={`flex-1 py-1.5 rounded-lg text-[9px] font-label font-bold uppercase transition-all ${voiceGender === 'female' ? 'bg-gradient-to-br from-primary to-primary-dim text-white shadow-lg' : 'text-on-surface-variant'}`}
              >
                FEMALE VOICE
              </button>
            </div>

            <div className="flex bg-surface-container-low p-1 rounded-xl border border-outline/10">
              <button 
                onClick={() => setAiMode('safe')}
                className={`flex-1 py-1.5 rounded-lg text-[9px] font-label font-bold uppercase transition-all ${aiMode === 'safe' ? 'bg-gradient-to-br from-primary to-primary-dim text-white shadow-lg' : 'text-on-surface-variant'}`}
              >
                SAFE MODE
              </button>
              <button 
                onClick={() => setAiMode('pro')}
                className={`flex-1 py-1.5 rounded-lg text-[9px] font-label font-bold uppercase transition-all ${aiMode === 'pro' ? 'bg-gradient-to-br from-primary to-primary-dim text-white shadow-lg' : 'text-on-surface-variant'}`}
              >
                PRO NAV
              </button>
            </div>

            <div className="flex bg-surface-container-low p-1 rounded-xl border border-outline/10">
              <button 
                onClick={() => setVerbosity('brief')}
                className={`flex-1 py-1.5 rounded-lg text-[9px] font-label font-bold uppercase transition-all ${verbosity === 'brief' ? 'bg-gradient-to-br from-primary to-primary-dim text-white shadow-lg' : 'text-on-surface-variant'}`}
              >
                BRIEF INFO
              </button>
              <button 
                onClick={() => setVerbosity('detailed')}
                className={`flex-1 py-1.5 rounded-lg text-[9px] font-label font-bold uppercase transition-all ${verbosity === 'detailed' ? 'bg-gradient-to-br from-primary to-primary-dim text-white shadow-lg' : 'text-on-surface-variant'}`}
              >
                IN-DEPTH
              </button>
            </div>

            <button 
              onClick={() => setMoodEQ(!moodEQ)}
              className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${moodEQ ? 'bg-secondary/10 border-secondary/30 font-bold text-secondary' : 'bg-surface-container-low border-outline/10 text-on-surface-variant'}`}
            >
              <div className="flex items-center gap-2 text-[9px] uppercase tracking-widest font-label">
                <ShieldCheck size={14} className={moodEQ ? 'animate-pulse' : ''} />
                Mood Intelligence (EQ)
              </div>
              <div className={`text-[8px] px-2 py-0.5 rounded-full border font-label ${moodEQ ? 'border-secondary/50 bg-secondary text-white' : 'border-outline/20'}`}>
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
              className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-primary/10 transition-all text-left group"
            >
              <div className="text-primary group-hover:text-primary-dim transition-colors">
                {item.icon}
              </div>
              <div>
                <div className="text-[11px] font-headline font-bold text-on-surface tracking-wide">{item.label}</div>
                <div className="text-[9px] font-medium text-on-surface-variant font-body">{item.sub}</div>
              </div>
            </button>
          ))}
        </div>

        {/* Toggles */}
        <div className="pt-5 border-t border-outline/10 space-y-2">
          <button 
            onClick={toggleTheme}
            className="w-full flex items-center justify-between p-3 rounded-2xl bg-surface-container-low hover:bg-primary/10 transition-all"
          >
            <div className="flex items-center gap-3 text-on-surface text-[11px] font-bold font-label">
              {isDarkMode ? <Sun size={18} className="text-amber-500" /> : <Moon size={18} className="text-primary" />}
              {isDarkMode ? 'Light Mode' : 'Dark Mode'}
            </div>
            <div className={`w-8 h-4 rounded-full relative transition-colors ${isDarkMode ? 'bg-primary' : 'bg-surface-container-high'}`}>
               <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${isDarkMode ? 'left-4' : 'left-0.5'}`} />
            </div>
          </button>

          <button className="w-full flex items-center gap-3 p-3 rounded-2xl text-error hover:bg-error/10 transition-all font-label font-bold text-[11px] uppercase tracking-widest">
            <LogOut size={18} />
            Sign Out
          </button>
        </div>

        {/* Footer */}
        <div className="mt-4 text-center">
            <span className="text-[8px] font-label font-bold text-outline/40 uppercase tracking-[0.2em]">Designed for Himalayas</span>
        </div>
      </div>
    </>
  );
};
