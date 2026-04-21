import React, { useState, useEffect } from 'react';
import { Navigation, CloudRain, MapPin, AlertTriangle, Mountain } from 'lucide-react';

interface LoadingScreenProps {
  onComplete: () => void;
}

// Nepali-themed loading messages
const LOADING_MESSAGES = [
  { text: "Loading road network...", icon: "🛣️" },
  { text: "Mapping highways...", icon: "🛣️" },
  { text: "Syncing weather data...", icon: "🌧️" },
  { text: "Loading district boundaries...", icon: "🗺️" },
  { text: "Preparing monsoon risks...", icon: "⛈️" },
  { text: "Loading traffic alerts...", icon: "🚦" },
  { text: "Almost there...", icon: "🏔️" },
];

export const LoadingScreen: React.FC<LoadingScreenProps> = ({ onComplete }) => {
  const [progress, setProgress] = useState(0);
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(onComplete, 600);
          return 100;
        }
        return prev + 2;
      });
    }, 50);
    
    // Update message based on progress
    const messageInterval = setInterval(() => {
      setMessageIndex(prev => {
        const next = prev + 1;
        return next >= LOADING_MESSAGES.length ? prev : next;
      });
    }, 800);
    
    return () => {
      clearInterval(interval);
      clearInterval(messageInterval);
    };
  }, [onComplete]);

  const currentMessage = LOADING_MESSAGES[Math.min(
    Math.floor(progress / 100 * LOADING_MESSAGES.length),
    LOADING_MESSAGES.length - 1
  )];

  return (
    <div className="fixed inset-0 z-[10000] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col items-center justify-center overflow-hidden">
      {/* Animated Background - Nepal Mountains */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Mountain silhouettes */}
        <div className="absolute bottom-0 left-0 w-full h-64 opacity-20">
          <svg viewBox="0 0 1200 200" className="w-full h-full" preserveAspectRatio="none">
            <path d="M0,200 L200,100 L400,150 L600,50 L800,120 L1000,80 L1200,150 L1200,200 Z" fill="#6366f1" />
            <path d="M0,200 L300,150 L500,180 L700,100 L900,140 L1100,90 L1200,160 L1200,200 Z" fill="#818cf8" opacity="0.5" />
          </svg>
        </div>
        
        {/* Floating particles */}
        {[...Array(8)].map((_, i) => (
          <div 
            key={i}
            className="absolute bg-indigo-400/20 rounded-full animate-pulse"
            style={{
              width: Math.random() * 20 + 10 + 'px',
              height: Math.random() * 20 + 10 + 'px',
              top: Math.random() * 60 + 10 + '%',
              left: Math.random() * 100 + '%',
              animationDelay: i * 0.3 + 's',
            }}
          />
        ))}
      </div>

      {/* Center Content */}
      <div className="relative z-10 flex flex-col items-center">
        {/* Logo Circle */}
        <div className="w-28 h-28 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-[32px] flex items-center justify-center shadow-[0_0_60px_rgba(99,102,241,0.4)] mb-8 animate-bounce">
          <Navigation className="w-14 h-14 text-white" />
        </div>
        
        {/* App Name with gradient */}
        <h1 className="text-4xl font-black tracking-tighter bg-gradient-to-r from-white via-indigo-200 to-white bg-clip-text text-transparent mb-2">
          MEROSADAK
        </h1>
        
        {/* Tagline */}
        <p className="text-sm font-medium text-indigo-300 uppercase tracking-[0.25em] text-center mb-8">
          नेपालको यात्रा साथी • Nepal's Travel Companion
        </p>

        {/* Progress Bar Container */}
        <div className="w-72 flex flex-col items-center">
          <div className="w-full h-2 bg-slate-700/50 rounded-full overflow-hidden mb-4">
            <div 
              className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 transition-all duration-300 ease-out rounded-full shadow-[0_0_20px_rgba(139,92,246,0.6)]"
              style={{ width: `${progress}%` }}
            />
          </div>
          
          {/* Message */}
          <div className="flex items-center gap-2">
            <span className="text-xl">{currentMessage.icon}</span>
            <span className="text-sm font-medium text-slate-300">
              {currentMessage.text}
            </span>
            <span className="text-xs font-mono text-indigo-400 ml-2">
              {progress}%
            </span>
          </div>
        </div>
      </div>

      {/* Version & Credits */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center">
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
          v2.0 • Built in Nepal 🇳🇵
        </p>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes pulse {
          0%, 100% { opacity: 0.2; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(1.1); }
        }
      `}} />
    </div>
  );
};