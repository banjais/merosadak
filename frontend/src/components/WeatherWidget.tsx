import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CloudRain, Sun, Wind, MapPin, Droplets, ThermometerSun } from 'lucide-react';
import { apiFetch } from '../api';

interface WeatherWidgetProps {
  userLocation: { lat: number; lng: number } | null;
  isVisible: boolean;
  isDarkMode: boolean;
}

export const WeatherWidget: React.FC<WeatherWidgetProps> = ({ userLocation, isVisible, isDarkMode }) => {
  const [weatherData, setWeatherData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isVisible || !userLocation) return;

    setLoading(true);

    apiFetch<any>(`/v1/weather?lat=${userLocation.lat}&lng=${userLocation.lng}`)
      .then(res => {
        if (res?.data) {
          setWeatherData(res.data);
        }
      })
      .finally(() => {
        setLoading(false);
      });
  }, [isVisible, userLocation]);

  return (
    <AnimatePresence>
      {isVisible && userLocation && (
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          className={`absolute top-24 right-4 sm:top-28 sm:right-6 z-[1200] w-64 p-4 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] backdrop-blur-2xl border ${isDarkMode ? 'bg-slate-900/60 border-slate-700/50 text-white' : 'bg-white/70 border-white/40 text-gray-800'
            }`}
        >
          {loading ? (
            <div className="flex flex-col items-center justify-center h-24">
              <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-[10px] mt-2 font-bold uppercase tracking-widest opacity-60">Syncing Local Radar...</span>
            </div>
          ) : weatherData ? (
            <div>
              <div className="flex items-start justify-between mb-2">
                <div className="flex flex-col">
                  <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest opacity-60">
                    <MapPin size={10} /> {weatherData.locationName}
                  </span>
                  <span className="text-3xl font-black">{weatherData.temp}°<span className="text-sm opacity-60">C</span></span>
                </div>
                <div className={`p-3 rounded-2xl ${weatherData.condition === 'Rain' ? 'bg-cyan-500/20 text-cyan-500' : 'bg-orange-500/20 text-orange-500'}`}>
                  {weatherData.condition === 'Rain' ? <CloudRain size={28} /> : <Sun size={28} />}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-gray-500/20">
                <div className="flex items-center gap-2">
                  <Wind size={14} className="opacity-60" />
                  <span className="text-xs font-bold">{weatherData.wind} km/h</span>
                </div>
                <div className="flex items-center gap-2">
                  <Droplets size={14} className="opacity-60" />
                  <span className="text-xs font-bold">{weatherData.humidity}%</span>
                </div>
              </div>
            </div>
          ) : null}
        </motion.div>
      )}
    </AnimatePresence>
  );
};
