import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { apiFetch } from './api';
import type { TravelIncident } from './types';

interface WeatherMonsoonContextType {
    weatherData: any | null;
    monsoonIncidents: TravelIncident[];
    loadingWeather: boolean;
    loadingMonsoon: boolean;
    errorWeather: string | null;
    errorMonsoon: string | null;
    refreshWeather: () => void;
    refreshMonsoon: () => void;
}

const WeatherMonsoonContext = createContext<WeatherMonsoonContextType | undefined>(undefined);

export const WeatherMonsoonProvider: React.FC<{ children: React.ReactNode; userLocation: { lat: number; lng: number } | null }> = ({
    children,
    userLocation,
}) => {
    const [weatherData, setWeatherData] = useState<any>(null);
    const [monsoonIncidents, setMonsoonIncidents] = useState<TravelIncident[]>([]);
    const [loadingWeather, setLoadingWeather] = useState(false);
    const [loadingMonsoon, setLoadingMonsoon] = useState(false);
    const [errorWeather, setErrorWeather] = useState<string | null>(null);
    const [errorMonsoon, setErrorMonsoon] = useState<string | null>(null);

    const fetchWeatherData = useCallback(async () => {
        if (!userLocation) return;
        setLoadingWeather(true);
        setErrorWeather(null);
        try {
            const res = await apiFetch<any>(`/v1/weather?lat=${userLocation.lat}&lng=${userLocation.lng}`);
            if (res?.data) {
                setWeatherData(res.data);
            }
        } catch (err: any) {
            console.error('[WeatherMonsoonContext] Failed to fetch weather:', err);
            setErrorWeather(err.message || 'Failed to fetch weather data');
        } finally {
            setLoadingWeather(false);
        }
    }, [userLocation]);

    const fetchMonsoonData = useCallback(async () => {
        if (!userLocation) return;
        setLoadingMonsoon(true);
        setErrorMonsoon(null);
        try {
            const res = await apiFetch<any>(`/v1/monsoon?lat=${userLocation.lat}&lng=${userLocation.lng}`);
            if (res?.data?.incidents) {
                setMonsoonIncidents(res.data.incidents);
            }
        } catch (err: any) {
            console.error('[WeatherMonsoonContext] Failed to fetch monsoon:', err);
            setErrorMonsoon(err.message || 'Failed to fetch monsoon data');
        } finally {
            setLoadingMonsoon(false);
        }
    }, [userLocation]);

    useEffect(() => {
        fetchWeatherData();
        fetchMonsoonData();
        const interval = setInterval(() => {
            fetchWeatherData();
            fetchMonsoonData();
        }, 5 * 60 * 1000); // Refresh every 5 minutes
        return () => clearInterval(interval);
    }, [fetchWeatherData, fetchMonsoonData]);

    const contextValue = { weatherData, monsoonIncidents, loadingWeather, loadingMonsoon, errorWeather, errorMonsoon, refreshWeather: fetchWeatherData, refreshMonsoon: fetchMonsoonData };

    return <WeatherMonsoonContext.Provider value={contextValue}>{children}</WeatherMonsoonContext.Provider>;
};

export const useWeatherMonsoon = () => {
    const context = useContext(WeatherMonsoonContext);
    if (!context) {
        console.warn('[WeatherMonsoonContext] Hook used outside provider - returning default');
        return {
            weatherData: null,
            monsoonIncidents: [],
            loadingWeather: false,
            loadingMonsoon: false,
            errorWeather: null,
            errorMonsoon: null,
            refreshWeather: () => {},
            refreshMonsoon: () => {},
        };
    }
    return context;
};