import React, { useState, useEffect, useMemo } from 'react';
import {
  User,
  LogOut,
  Languages,
  Moon,
  Sun,
  ShieldCheck,
  Smartphone,
  Download,
  Activity,
  Megaphone,
  Trash2,
  Info,
  Monitor,
  Lock,
  Battery,
  EyeOff,
  Layout,
  AlarmClock,
  Fuel,
  Settings,
  ShieldAlert,
  Eye,
  Zap,
  Ghost,
  BarChart3,
  Network,
  Circle,
  LineChart
} from 'lucide-react';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { useSettings } from '../SettingsContext';
import { useToast } from '../ToastContext';

interface UserProfile {
  email?: string;
  name?: string;
  preferences?: any;
  savedLocations?: Array<{ name: string; lat: number; lng: number }>;
}

interface SystemMenuProps {
  onOpenSettings?: () => void;
  isOpen: boolean;
  onClose: () => void;
  onDownloadOfflineMap?: () => void;
  onToggleLayers?: () => void;
  onToggleDeployDashboard?: () => void;
  onToggleMonitoring?: () => void;
  // New props for user profile and superadmin
  userProfile?: UserProfile | null;
  isSuperadmin?: boolean;
  onLogout?: () => void;
  onBroadcast?: (msg: string) => void;
  onPurgeCache?: () => void;
  superadminBusy?: boolean;
  onToggleInfoBoard?: () => void;
  isInstallable?: boolean;
  onInstallApp?: () => void;
  isLeader?: boolean;
  tabId?: string;
  onRemoteShutdown?: (id: string) => void;
  onBroadcastGlobal?: (msg: string) => void;
  onRelinquishLeadership?: () => void;
  rescueStatus?: string;
  onResolveSOS?: () => void;
  onBroadcastViewLock?: (mode: 'none' | 'telemetry' | 'report') => void;
  onBroadcastGhostMode?: (active: boolean) => void;
  onBroadcastRemotePOV?: (mode: 'compact' | 'standard') => void;
  batteryLevel?: number | null | undefined;
  onRemoteSOSTrigger?: () => void;
  isGhostMode?: boolean;
  viewLock?: 'none' | 'telemetry' | 'report';
  onOpenBatterySaver?: () => void;
  vehicleBatteryHistory?: { t: number; v: number }[];
  fuelHistory?: { t: number; v: number }[];
  fuelLevel?: number;
  onToggleCompactHUD?: () => void;
  onUpdateTankCapacity?: (val: number | null) => void;
  // Props that are still needed from App.tsx as they are not managed by SettingsContext
  isDarkMode: boolean; // Global theme, not just a user preference
  toggleTheme: () => void; // Global theme toggle
  highwayViewMode?: 'pavement' | 'simple';
  onToggleHighwayView?: () => void;
}

export const SystemMenu: React.FC<SystemMenuProps> = ({
  onOpenSettings,
  isOpen,
  onClose,
  onDownloadOfflineMap,
  onToggleLayers,
  onToggleDeployDashboard,
  onToggleMonitoring,
  userProfile,
  onLogout,
  isSuperadmin,
  onBroadcast,
  onPurgeCache,
  superadminBusy,
  onToggleInfoBoard,
  isInstallable,
  onInstallApp,
  isLeader,
  tabId,
  onRemoteShutdown,
  onBroadcastGlobal,
  onRelinquishLeadership,
  rescueStatus,
  onResolveSOS,
  onBroadcastViewLock,
  onBroadcastGhostMode,
  onBroadcastRemotePOV,
  batteryLevel,
  onRemoteSOSTrigger,
  isGhostMode,
  viewLock,
  onOpenBatterySaver,
  vehicleBatteryHistory = [],
  fuelHistory = [],
  fuelLevel = 0,
  onToggleCompactHUD,
  onUpdateTankCapacity,
  isDarkMode,
  toggleTheme,
  highwayViewMode,
  onToggleHighwayView,
}) => {
  const [shouldRender, setShouldRender] = useState(isOpen);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
    } else {
      const timer = setTimeout(() => setShouldRender(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const [networkTabs, setNetworkTabs] = useState<any[]>([]);
  const { success, info } = useToast();
  const {
    isMuted, toggleMute, isNightVision, toggleNightVision, isStealthMode, toggleStealthMode,
    isHighContrast, toggleHighContrast, isCompactHUD, toggleCompactHUD, hapticIntensity, setHapticIntensity,
    voiceGender, setVoiceGender, aiMode, setAiMode, verbosity, setVerbosity, moodEQ, setMoodEQ
  } = useSettings();


  // Functionality for 3-dotted menu actions
  const handlePurge = () => {
    if (onPurgeCache) {
      onPurgeCache();
      alert("System cache cleared and optimized.");
    } // This alert should ideally be replaced by a toast, but the prompt only asked for global toast context, not to replace all alerts.
  };

  // Logic to spawn a follower window for Multi-Screen setup
  const handleOpenMultiScreen = () => {
    window.open(window.location.href, '_blank', 'width=1024,height=600,menubar=no,toolbar=no');
  };

  // Generate simple SVG path for vehicle battery health (Voltage Trend)
  const vehicleChartPath = useMemo(() => {
    if (vehicleBatteryHistory.length < 2) return "";
    const width = 200;
    const height = 40;
    // Map voltage range 11.5V (Empty) to 14.5V (Full Charge)
    return vehicleBatteryHistory.map((point, i) => {
      const x = (i / (vehicleBatteryHistory.length - 1)) * width;
      const y = height - ((point.v - 11.5) / 3) * height;
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');
  }, [vehicleBatteryHistory]);

  // Generate simple SVG path for fuel consumption (Mission Drain)
  const fuelChartPath = useMemo(() => {
    if (fuelHistory.length < 2) return "";
    const width = 200;
    const height = 40;
    // Map fuel range 0% to 100%
    return fuelHistory.map((point, i) => {
      const x = (i / (fuelHistory.length - 1)) * width;
      const y = height - (point.v / 100) * height;
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');
  }, [fuelHistory]);

  // Tab Discovery Polling
  useEffect(() => {
    if (isOpen && isSuperadmin) {
      const i = setInterval(() => {
        setNetworkTabs((window as any).reminderService?.getActiveTabs() || []);
      }, 2000);
      return () => clearInterval(i);
    }
  }, [isOpen, isSuperadmin]);

  if (!shouldRender) return null;

  const userName = userProfile?.name || userProfile?.email || 'Guest Traveler';
  const userInitials = userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'GT';

  const menuItems = [
    { id: 'profile', icon: <User size={18} />, label: 'Traveler Profile', sub: userProfile ? `${userProfile.email || 'No email'} · ${userProfile.savedLocations?.length || 0} saved locations` : 'Emergency contacts, preferences' },
    { id: 'hud', icon: <Monitor size={18} />, label: 'Multi-Screen HUD', sub: 'Open mirrored display', action: handleOpenMultiScreen, badge: 'PRO' },
    { id: 'reminders', icon: <AlarmClock size={18} />, label: 'AI Reminders', sub: 'Safety scheduling', action: () => { onToggleInfoBoard?.(); (window as any).setServiceType?.('reminders'); }, badge: 'Live' },
    { id: 'info', icon: <Info size={18} />, label: 'App Directory', sub: 'Browse all services', action: onToggleInfoBoard, badge: 'New' },
    { id: 'offline', icon: <Smartphone size={18} />, label: 'Offline Maps', sub: 'Download for offline use', action: onDownloadOfflineMap, badge: 'New' },
    { id: 'deploy', icon: <ShieldCheck size={18} />, label: 'System Health', sub: 'Deploy status & CI/CD logs', action: onToggleDeployDashboard },
    { id: 'monitoring', icon: <Activity size={18} />, label: 'Monitoring Status', sub: 'Uptime & performance stats', action: onToggleMonitoring, badge: 'Live' },
    { id: 'layers', icon: <Download size={18} />, label: 'Map Layers', sub: 'Monsoon, road status, distance tool', action: onToggleLayers },
    { id: 'privacy', icon: <ShieldCheck size={18} />, label: 'Safety & Privacy', sub: 'End-to-end encrypted' },
    { id: 'lang', icon: <Languages size={18} />, label: 'Language Settings', sub: 'English / नेपाली / हिन्दी' },
  ];

  // Add Install item if available
  if (isInstallable) {
    menuItems.unshift({
      id: 'install',
      icon: <Download size={18} />,
      label: 'Get MeroSadak App',
      sub: 'Install for easy offline access',
      action: onInstallApp,
      badge: 'PRO'
    } as any);
  }

  // Superadmin items
  const superadminItems = [
    { id: 'broadcast', icon: <Megaphone size={18} />, label: 'Broadcast Update', sub: 'Send system-wide message', action: () => onBroadcast?.('System maintenance scheduled') },
    { id: 'purge', icon: <Trash2 size={18} />, label: 'Purge Cache', sub: 'Clear all CDN/edge caches', action: onPurgeCache },
  ];

  // Close on Escape key
  useEscapeKey(onClose);

  return (
    <>
      {isOpen && <div className="fixed inset-0 z-[1950] animate-in fade-in duration-200" onClick={onClose} />}
      <div className={`absolute top-20 right-6 z-[1900] w-64 backdrop-blur-xl rounded-[2rem] border shadow-[0_20px_60px_rgba(27,51,85,0.15)] p-5 duration-200 origin-top-right transition-colors ${isOpen ? 'animate-in fade-in zoom-in-95' : 'animate-out fade-out zoom-out-95'} ${isDarkMode
        ? 'bg-slate-900/85 border-slate-700/40'
        : 'bg-white/85 border-white/40'
        }`}>

        {/* Remote SOS Capability (Co-Pilot Focus) */}
        {!isLeader && (
          <button
            onClick={onRemoteSOSTrigger}
            className="mb-4 w-full py-4 bg-red-600 hover:bg-red-700 text-white rounded-2xl flex items-center justify-center gap-3 shadow-lg shadow-red-500/20 active:scale-95 transition-all"
          >
            <ShieldAlert size={20} className="animate-pulse" />
            <span className="text-xs font-black uppercase tracking-widest">Trigger System SOS</span>
          </button>
        )}

        {/* Night Vision Toggle */}
        <div className="mb-4">
          <button
            onClick={toggleNightVision}
            className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${isNightVision ? 'bg-red-950/40 border-red-500/50 text-red-500 shadow-[0_0_15px_rgba(239,68,68,0.2)]' : isDarkMode ? 'bg-slate-800/50 border-slate-600/30 text-slate-400' : 'bg-surface-container-low border-outline/10 text-on-surface-variant'}`}
          >
            <div className="flex items-center gap-2 text-[9px] uppercase tracking-widest font-label font-bold">
              <Eye size={14} className={isNightVision ? 'animate-pulse' : ''} />
              Night Vision (Red)
            </div>
            <div className={`w-8 h-4 rounded-full relative transition-colors ${isNightVision ? 'bg-red-600' : 'bg-slate-700'}`}>
              <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${isNightVision ? 'left-4' : 'left-0.5'}`} />
            </div>
          </button>
        </div>

        {/* High Contrast Toggle for Stealth Mode */}
        {isStealthMode && (
          <div className="mb-4">
            <button // onToggleHighContrast is now from context
              onClick={toggleHighContrast}
              className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${isHighContrast ? 'bg-amber-500/20 border-amber-500/50 text-amber-600 shadow-[0_0_15px_rgba(245,158,11,0.2)]' : isDarkMode ? 'bg-slate-800/50 border-slate-600/30 text-slate-400' : 'bg-surface-container-low border-outline/10 text-on-surface-variant'}`}
            >
              <div className="flex items-center gap-2 text-[9px] uppercase tracking-widest font-label font-bold">
                <Sun size={14} className={isHighContrast ? 'animate-pulse' : ''} />
                High Contrast (Sunlight)
              </div>
              <div className={`w-8 h-4 rounded-full relative transition-colors ${isHighContrast ? 'bg-amber-500' : 'bg-slate-700'}`}>
                <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${isHighContrast ? 'left-4' : 'left-0.5'}`} />
              </div>
            </button>
          </div>
        )}

        {/* Battery Health Section */}
        <div className="mb-4">
          <button
            onClick={onOpenBatterySaver}
            className={`w-full p-3 rounded-2xl border flex items-center justify-between transition-all group ${batteryLevel !== undefined && batteryLevel !== null && batteryLevel <= 20 ? 'bg-red-500/10 border-red-500/30' :
              isDarkMode ? 'bg-slate-800/40 border-slate-700/30 hover:bg-slate-800/60' : 'bg-surface-container-low border-outline/10 hover:bg-primary/5'
              }`}
          >
            <div className="flex items-center gap-2">
              <Battery size={14} className={batteryLevel !== undefined && batteryLevel !== null && batteryLevel <= 20 ? 'text-red-500 animate-pulse' : 'text-primary'} />
              <span className="text-[10px] font-black uppercase tracking-widest text-on-surface">Energy Level</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-black font-headline ${batteryLevel !== undefined && batteryLevel !== null && batteryLevel <= 20 ? 'text-red-500' : 'text-primary'}`}>
                {batteryLevel !== null ? `${batteryLevel}%` : '--'}
              </span>
            </div>
          </button>
        </div>

        {/* Leadership Diagnostics */}
        {isLeader && (
          <div className="mb-4 p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_#10b981]" />
                <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Active Leader</span>
              </div>
              <span className="text-[8px] font-mono text-slate-500 uppercase">ID: {tabId}</span>
            </div>
            <button
              onClick={onRelinquishLeadership}
              className="w-full py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-[8px] font-black uppercase tracking-widest rounded-lg transition-colors shadow-sm"
            >
              Relinquish Control
            </button>
          </div>
        )}

        {/* Emergency Resolution */}
        {rescueStatus && rescueStatus !== 'idle' && (
          <button
            onClick={onResolveSOS}
            className="mb-4 w-full py-3 bg-red-500/10 border border-red-500/20 text-red-500 text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-red-500 hover:text-white transition-all flex items-center justify-center gap-2"
          >
            <ShieldCheck size={14} />
            Resolve Global SOS
          </button>
        )}

        {/* User Header */}
        <div className="flex items-center gap-3 mb-6 p-1">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-tertiary flex items-center justify-center font-headline font-bold text-white shadow-lg ring-2 ring-white/20">
            {userInitials}
          </div>
          <div>
            <div className="text-xs font-headline font-bold text-on-surface leading-none">{userName}</div>
            <div className="text-[9px] font-label font-bold text-on-surface-variant uppercase tracking-widest mt-1">v4.0 Build</div>
          </div>
        </div>

        {/* AI & Voice Personalization */}
        <div className="mb-6 space-y-4">
          <h4 className="text-[9px] font-label font-bold text-on-surface-variant uppercase tracking-[0.2em] px-1">AI & Voice Settings</h4>

          <div className="flex flex-col gap-2">
            <div className={`flex bg-surface-container-low p-1 rounded-xl border transition-colors duration-300 ${isDarkMode ? 'border-slate-600/30' : 'border-outline/10'}`}>
              <button
                onClick={() => setVoiceGender('male')}
                className={`flex-1 py-1.5 rounded-lg text-[9px] font-label font-bold uppercase transition-all ${voiceGender === 'male' ? 'bg-gradient-to-br from-primary to-primary-dim text-white shadow-lg' : isDarkMode ? 'text-slate-400' : 'text-on-surface-variant'}`}
              >
                MALE VOICE
              </button>
              <button
                onClick={() => setVoiceGender('female')}
                className={`flex-1 py-1.5 rounded-lg text-[9px] font-label font-bold uppercase transition-all ${voiceGender === 'female' ? 'bg-gradient-to-br from-primary to-primary-dim text-white shadow-lg' : isDarkMode ? 'text-slate-400' : 'text-on-surface-variant'}`}
              >
                FEMALE VOICE
              </button>
            </div>

            <div className={`flex bg-surface-container-low p-1 rounded-xl border transition-colors duration-300 ${isDarkMode ? 'border-slate-600/30' : 'border-outline/10'}`}>
              <button
                onClick={() => setAiMode('safe')}
                className={`flex-1 py-1.5 rounded-lg text-[9px] font-label font-bold uppercase transition-all ${aiMode === 'safe' ? 'bg-gradient-to-br from-primary to-primary-dim text-white shadow-lg' : isDarkMode ? 'text-slate-400' : 'text-on-surface-variant'}`}
              >
                SAFE MODE
              </button>
              <button
                onClick={() => setAiMode('pro')}
                className={`flex-1 py-1.5 rounded-lg text-[9px] font-label font-bold uppercase transition-all ${aiMode === 'pro' ? 'bg-gradient-to-br from-primary to-primary-dim text-white shadow-lg' : isDarkMode ? 'text-slate-400' : 'text-on-surface-variant'}`}
              >
                PRO NAV
              </button>
            </div>

            <div className={`flex bg-surface-container-low p-1 rounded-xl border transition-colors duration-300 ${isDarkMode ? 'border-slate-600/30' : 'border-outline/10'}`}>
              <button
                onClick={() => setVerbosity('brief')}
                className={`flex-1 py-1.5 rounded-lg text-[9px] font-label font-bold uppercase transition-all ${verbosity === 'brief' ? 'bg-gradient-to-br from-primary to-primary-dim text-white shadow-lg' : isDarkMode ? 'text-slate-400' : 'text-on-surface-variant'}`}
              >
                BRIEF INFO
              </button>
              <button
                onClick={() => setVerbosity('detailed')}
                className={`flex-1 py-1.5 rounded-lg text-[9px] font-label font-bold uppercase transition-all ${verbosity === 'detailed' ? 'bg-gradient-to-br from-primary to-primary-dim text-white shadow-lg' : isDarkMode ? 'text-slate-400' : 'text-on-surface-variant'}`}
              >
                IN-DEPTH
              </button>
            </div>

            <button
              onClick={() => setMoodEQ(!moodEQ)}
              className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${moodEQ ? 'bg-secondary/10 border-secondary/30 font-bold text-secondary' : isDarkMode ? 'bg-slate-800/50 border-slate-600/30 text-slate-400' : 'bg-surface-container-low border-outline/10 text-on-surface-variant'}`}
            >
              <div className="flex items-center gap-2 text-[9px] uppercase tracking-widest font-label">
                <ShieldCheck size={14} className={moodEQ ? 'animate-pulse' : ''} />
                Mood Intelligence (EQ)
              </div>
              <div className={`text-[8px] px-2 py-0.5 rounded-full border font-label ${moodEQ ? 'border-secondary/50 bg-secondary text-white' : isDarkMode ? 'border-slate-600/30 text-slate-500' : 'border-outline/20'}`}>
                {moodEQ ? 'ACTIVE' : 'OFF'}
              </div>
            </button>
          </div>
        </div>

        {/* Vehicle & Range Settings */}
        <div className="mb-6 space-y-3">
          <h4 className="text-[9px] font-label font-bold text-on-surface-variant uppercase tracking-[0.2em] px-1 flex items-center gap-2">
            <Settings size={10} /> Vehicle & Range
          </h4>

          <div className={`p-3 rounded-2xl border ${isDarkMode ? 'bg-slate-800/40 border-slate-700/30' : 'bg-surface-container-low border-outline/10'}`}>
            {vehicleBatteryHistory.length >= 2 && (
              <div className="mb-4 p-2 bg-black/5 dark:bg-black/20 rounded-xl">
                <div className="flex items-center gap-1.5 text-[7px] font-black text-on-surface-variant/40 uppercase tracking-[0.2em] mb-2">
                  <LineChart size={10} /> Voltage Trend (OBD-II)
                </div>
                <svg viewBox="0 0 200 40" className="w-full h-8 overflow-visible">
                  <path d={vehicleChartPath} fill="none" stroke={isDarkMode ? '#818cf8' : '#4f46e5'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            )}
            {fuelHistory.length >= 2 && (
              <div className="mb-4 p-2 bg-black/5 dark:bg-black/20 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5 text-[7px] font-black text-on-surface-variant/40 uppercase tracking-[0.2em]">
                    <Fuel size={10} /> Mission Consumption
                  </div>
                  <span className="text-[7px] font-bold text-orange-500 uppercase">{fuelLevel}%</span>
                </div>
                <svg viewBox="0 0 200 40" className="w-full h-8 overflow-visible">
                  <path d={fuelChartPath} fill="none" stroke="#f97316" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            )}
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black text-on-surface uppercase tracking-tight">Tank Capacity</span>
              <span className="text-[9px] font-bold text-primary uppercase">Liters</span>
            </div>
            <input
              type="number"
              defaultValue={userProfile?.preferences?.customTankCapacity || ''}
              onBlur={(e) => {
                const val = e.target.value ? parseFloat(e.target.value) : null;
                onUpdateTankCapacity?.(val);
              }}
              placeholder="Enter capacity..."
              className={`w-full p-2 rounded-xl text-xs font-bold outline-none border-2 border-transparent focus:border-primary transition-all ${isDarkMode ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'
                }`}
            />
          </div>
        </div>

        {/* Action List */}
        <div className="space-y-1 mb-6">
          {menuItems.map(item => (
            <button
              key={item.id}
              onClick={() => {
                if (item.action) item.action();
                if (!item.action && item.id !== 'offline') {
                  // placeholder for future items
                }
              }}
              className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-all text-left group relative ${isDarkMode ? 'hover:bg-slate-700/50' : 'hover:bg-primary/10'
                }`}
            >
              <div className="text-primary group-hover:text-primary-dim transition-colors">
                {item.icon}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-headline font-bold text-on-surface tracking-wide">{item.label}</span>
                  {item.badge && (
                    <span className="text-[7px] font-label font-bold uppercase bg-indigo-600 text-white px-1.5 py-0.5 rounded-full">{item.badge}</span>
                  )}
                </div>
                <div className="text-[9px] font-medium text-on-surface-variant font-body">{item.sub}</div>
              </div>
              {item.action && (
                <Download size={16} className="text-primary opacity-50 group-hover:opacity-100 transition-opacity" />
              )}
            </button>
          ))}
        </div>

        {/* Superadmin Section */}
        {isSuperadmin && (
          <div className="mb-6">
            <h4 className={`text-[9px] font-label font-bold uppercase tracking-[0.2em] px-1 mb-2 ${isDarkMode ? 'text-amber-400' : 'text-amber-600'}`}>
              Advanced System Menu
            </h4>
            <div className="mb-4 p-2 bg-amber-500/5 rounded-xl border border-amber-500/10 space-y-2">
              <input
                type="text"
                placeholder="Remote Shutdown ID..."
                className="w-full bg-white dark:bg-slate-800 border border-amber-500/20 rounded-lg p-2 text-[9px] font-bold outline-none text-on-surface"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onRemoteShutdown?.(e.currentTarget.value);
                }}
              />
              <p className="text-[7px] text-amber-600/60 uppercase font-black px-1">Press Enter to shutdown tab pilot</p>
            </div>
            <div className="mb-4 p-2 bg-indigo-500/5 rounded-xl border border-indigo-500/10 space-y-2">
              <input
                type="text"
                placeholder="Global Network Broadcast..."
                className="w-full bg-white dark:bg-slate-800 border border-indigo-500/20 rounded-lg p-2 text-[9px] font-bold outline-none text-on-surface"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onBroadcastGlobal?.(e.currentTarget.value);
                }}
              />
              <p className="text-[7px] text-indigo-600/60 uppercase font-black px-1">Message all follower screens</p>
            </div>
            <div className="space-y-1">
              {superadminItems.map((item) => (
                <button
                  key={item.id}
                  onClick={item.id === 'purge' ? handlePurge : () => item.action?.()}
                  disabled={superadminBusy}
                  className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-all text-left ${superadminBusy ? 'opacity-50 cursor-not-allowed' : ''} ${isDarkMode ? 'hover:bg-amber-900/20' : 'hover:bg-amber-50'}`}
                >
                  <div className="text-amber-500">{item.icon}</div>
                  <div className="flex-1">
                    <div className="text-[11px] font-headline font-bold text-on-surface tracking-wide">{item.label}</div>
                    <div className="text-[9px] text-on-surface-variant">{item.sub}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Tab Discovery Panel (Superadmin Only) */}
        {isSuperadmin && networkTabs.length > 0 && (
          <div className="mb-6 p-4 rounded-3xl bg-slate-950/40 border border-white/5 space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <Network size={14} className="text-indigo-400" />
              <h4 className="text-[10px] font-black uppercase tracking-widest text-indigo-300">Active Network Nodes</h4>
            </div>
            <div className="space-y-2 max-h-32 overflow-y-auto no-scrollbar">
              {networkTabs.map(tab => (
                <div key={tab.id} className="flex items-center justify-between p-2 rounded-xl bg-white/5 border border-white/5">
                  <div className="flex items-center gap-2">
                    <Circle size={8} className={tab.isLeader ? 'fill-emerald-500 text-emerald-500' : 'fill-slate-600 text-slate-600'} />
                    <span className="text-[9px] font-mono text-slate-300">{tab.id}</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-[7px] font-black uppercase text-indigo-500">{tab.isLeader ? 'Leader' : 'Follower'}</span>
                    <span className="text-[6px] text-slate-500 uppercase">Live Now</span>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[7px] text-slate-500 italic text-center">Auto-Discovery active via BroadcastChannel</p>
          </div>
        )}

        {/* Toggles */}
        <div className={`pt-5 border-t space-y-2 transition-colors duration-300 ${isDarkMode ? 'border-slate-700/30' : 'border-outline/10'}`}>
          <button
            onClick={toggleTheme}
            className={`w-full flex items-center justify-between p-3 rounded-2xl transition-all ${isDarkMode ? 'bg-slate-800/50 hover:bg-slate-700/50' : 'bg-surface-container-low hover:bg-primary/10'}`}
          >
            <div className="flex items-center gap-3 text-on-surface text-[11px] font-bold font-label">
              {isDarkMode ? <Sun size={18} className="text-amber-500" /> : <Moon size={18} className="text-primary" />}
              {isDarkMode ? 'Light Mode' : 'Dark Mode'}
            </div>
            <div className={`w-8 h-4 rounded-full relative transition-colors ${isDarkMode ? 'bg-primary' : 'bg-surface-container-high'}`}>
              <div className={`absolute top-0.5 w-3 h-3 rounded-full transition-all ${isDarkMode ? 'left-4 bg-slate-900' : 'left-0.5 bg-white'}`} />
            </div>
          </button>

          <button onClick={onLogout} className="w-full flex items-center gap-3 p-3 rounded-2xl text-error hover:bg-error/10 transition-all font-label font-bold text-[11px] uppercase tracking-widest">
            <LogOut size={18} />
            Sign Out
          </button>
        </div>

        {/* Footer */}
        <div className="mt-4 text-center">
          <span className={`text-[8px] font-label font-bold uppercase tracking-[0.2em] transition-colors duration-300 ${isDarkMode ? 'text-slate-600' : 'text-outline/40'}`}>Designed for Himalayas</span>
        </div>
      </div >
    </>
  );
};
