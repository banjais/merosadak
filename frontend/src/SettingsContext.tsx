import React, { createContext, useState, useContext, useCallback, useEffect } from 'react';
import { reminderService } from './reminderService';

type VoiceGender = 'male' | 'female';
type AiMode = 'safe' | 'pro';
type Verbosity = 'brief' | 'detailed';
type HapticIntensity = 'low' | 'medium' | 'high';

interface SettingsContextType {
    isDarkMode: boolean;
    toggleTheme: () => void;
    isMuted: boolean;
    toggleMute: () => void;
    isNightVision: boolean;
    toggleNightVision: () => void;
    isStealthMode: boolean;
    toggleStealthMode: () => void;
    isHighContrast: boolean;
    toggleHighContrast: () => void;
    isCompactHUD: boolean;
    toggleCompactHUD: () => void;
    hapticIntensity: HapticIntensity;
    setHapticIntensity: (intensity: HapticIntensity) => void;
    voiceGender: VoiceGender;
    setVoiceGender: (gender: VoiceGender) => void;
    aiMode: AiMode;
    setAiMode: (mode: AiMode) => void;
    verbosity: Verbosity;
    setVerbosity: (v: Verbosity) => void;
    moodEQ: boolean;
    setMoodEQ: (m: boolean) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('merosadak_theme') === 'dark');
    const [isMuted, setIsMuted] = useState(() => localStorage.getItem('merosadak_voice_muted') === 'true');
    const [isNightVision, setIsNightVision] = useState(() => localStorage.getItem('merosadak_night_vision') === 'true');
    const [isStealthMode, setIsStealthMode] = useState(false); // Stealth mode is often session-based or triggered by battery
    const [isHighContrast, setIsHighContrast] = useState(false);
    const [isCompactHUD, setIsCompactHUD] = useState(false);
    const [hapticIntensity, setHapticIntensity] = useState<HapticIntensity>(() => (localStorage.getItem('merosadak_haptic_intensity') as HapticIntensity) || 'medium');
    const [voiceGender, setVoiceGender] = useState<VoiceGender>(() => (localStorage.getItem('merosadak_voice_gender') as VoiceGender) || 'female');
    const [aiMode, setAiMode] = useState<AiMode>(() => (localStorage.getItem('merosadak_ai_mode') as AiMode) || 'safe');
    const [verbosity, setVerbosity] = useState<Verbosity>(() => (localStorage.getItem('merosadak_verbosity') as Verbosity) || 'detailed');
    const [moodEQ, setMoodEQ] = useState(() => localStorage.getItem('merosadak_mood_eq') === 'true');

    // Apply theme to document body
    useEffect(() => {
        if (isDarkMode) {
            document.documentElement.classList.add('dark');
            localStorage.setItem('merosadak_theme', 'dark');
        } else {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('merosadak_theme', 'light');
        }
    }, [isDarkMode]);

    // Handlers for settings
    const toggleTheme = useCallback(() => setIsDarkMode(prev => !prev), []);
    const toggleMute = useCallback(() => {
        setIsMuted(prev => {
            const newVal = !prev;
            localStorage.setItem('merosadak_voice_muted', String(newVal));
            return newVal;
        });
    }, []);
    const toggleNightVision = useCallback(() => {
        setIsNightVision(prev => {
            const newVal = !prev;
            localStorage.setItem('merosadak_night_vision', String(newVal));
            reminderService.broadcastNightVision(newVal);
            return newVal;
        });
    }, []);
    const toggleStealthMode = useCallback(() => {
        setIsStealthMode(prev => {
            const newVal = !prev;
            reminderService.broadcastStealthMode(newVal);
            return newVal;
        });
    }, []);
    const toggleHighContrast = useCallback(() => setIsHighContrast(prev => !prev), []);
    const toggleCompactHUD = useCallback(() => setIsCompactHUD(prev => !prev), []);
    const handleSetHapticIntensity = useCallback((intensity: HapticIntensity) => {
        setHapticIntensity(intensity);
        localStorage.setItem('merosadak_haptic_intensity', intensity);
    }, []);
    const handleSetVoiceGender = useCallback((gender: VoiceGender) => {
        setVoiceGender(gender);
        localStorage.setItem('merosadak_voice_gender', gender);
    }, []);
    const handleSetAiMode = useCallback((mode: AiMode) => {
        setAiMode(mode);
        localStorage.setItem('merosadak_ai_mode', mode);
    }, []);
    const handleSetVerbosity = useCallback((v: Verbosity) => {
        setVerbosity(v);
        localStorage.setItem('merosadak_verbosity', v);
    }, []);
    const handleSetMoodEQ = useCallback((m: boolean) => {
        setMoodEQ(m);
        localStorage.setItem('merosadak_mood_eq', String(m));
    }, []);

    const contextValue = {
        isDarkMode, toggleTheme, isMuted, toggleMute, isNightVision, toggleNightVision, isStealthMode, toggleStealthMode,
        isHighContrast, toggleHighContrast, isCompactHUD, toggleCompactHUD, hapticIntensity, setHapticIntensity: handleSetHapticIntensity,
        voiceGender, setVoiceGender: handleSetVoiceGender, aiMode, setAiMode: handleSetAiMode, verbosity, setVerbosity: handleSetVerbosity,
        moodEQ, setMoodEQ: handleSetMoodEQ,
    };

    return <SettingsContext.Provider value={contextValue}>{children}</SettingsContext.Provider>;
};

export const useSettings = () => {
    const context = useContext(SettingsContext);
    if (!context) {
        throw new Error('useSettings must be used within a SettingsProvider');
    }
    return context;
};