import { useState, useEffect } from 'react';

export interface LocationData {
    lat: number;
    lng: number;
    speed: number | null;
    heading: number | null;
    accuracy: number;
}

export const useLocation = () => {
    const [location, setLocation] = useState<LocationData | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!navigator.geolocation) {
            setError('Geolocation is not supported by your browser');
            setLoading(false);
            return;
        }

        const handleSuccess = (position: GeolocationPosition) => {
            setLocation({
                lat: position.coords.latitude,
                lng: position.coords.longitude,
                speed: position.coords.speed,
                heading: position.coords.heading,
                accuracy: position.coords.accuracy,
            });
            setLoading(false);
        };

        const handleError = (error: GeolocationPositionError) => {
            setError(error.message);
        };

        const watchId = navigator.geolocation.watchPosition(handleSuccess, handleError, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0,
        });

        return () => navigator.geolocation.clearWatch(watchId);
    }, []);

    return { location, error, loading };
};