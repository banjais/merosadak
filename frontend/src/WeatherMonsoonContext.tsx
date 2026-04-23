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
    setLocation: (lat: number, lng: number) => void;
}

const WeatherMonsoonContext = createContext<WeatherMonsoonContextType | undefined>(undefined);

export const WeatherMonsoonProvider: React.FC<{ children: React.ReactNode }> = ({
    children
}) => {
    const [contextLocation, setContextLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [weatherData, setWeatherData] = useState<any>(null);
    const [monsoonIncidents, setMonsoonIncidents] = useState<TravelIncident[]>([]);
    const [loadingWeather, setLoadingWeather] = useState(false);
    const [loadingMonsoon, setLoadingMonsoon] = useState(false);
    const [errorWeather, setErrorWeather] = useState<string | null>(null);
    const [errorMonsoon, setErrorMonsoon] = useState<string | null>(null);

    const setLocation = useCallback((lat: number, lng: number) => {
        setContextLocation(prev => {
            if (prev?.lat === lat && prev?.lng === lng) return prev;
            return { lat, lng };
        });
    }, []);

    const fetchWeatherData = useCallback(async () => {
        if (!contextLocation) return;
        setLoadingWeather(true);
        setErrorWeather(null);
        try {
            const res = await apiFetch<any>(`/v1/weather?lat=${contextLocation.lat}&lng=${contextLocation.lng}`);
            if (res?.data) {
                setWeatherData(res.data);
            }
        } catch (err: any) {
            console.error('[WeatherMonsoonContext] Failed to fetch weather:', err);
            setErrorWeather(err.message || 'Failed to fetch weather data');
        } finally {
            setLoadingWeather(false);
        }
    }, [contextLocation]);

    const fetchMonsoonData = useCallback(async () => {
        if (!contextLocation) return;
        setLoadingMonsoon(true);
        setErrorMonsoon(null);
        try {
            const res = await apiFetch<any>(`/v1/monsoon?lat=${contextLocation.lat}&lng=${contextLocation.lng}`);
            if (res?.data?.incidents) {
                setMonsoonIncidents(res.data.incidents);
            }
        } catch (err: any) {
            console.error('[WeatherMonsoonContext] Failed to fetch monsoon:', err);
            setErrorMonsoon(err.message || 'Failed to fetch monsoon data');
        } finally {
            setLoadingMonsoon(false);
        }
    }, [contextLocation]);

    useEffect(() => {
        fetchWeatherData();
        fetchMonsoonData();
        const interval = setInterval(() => {
            fetchWeatherData();
            fetchMonsoonData();
        }, 5 * 60 * 1000); // Refresh every 5 minutes
        return () => clearInterval(interval);
    }, [fetchWeatherData, fetchMonsoonData]);

    const contextValue = { weatherData, monsoonIncidents, loadingWeather, loadingMonsoon, errorWeather, errorMonsoon, refreshWeather: fetchWeatherData, refreshMonsoon: fetchMonsoonData, setLocation };

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
            setLocation: () => {},
        };
    }
    return context;
};