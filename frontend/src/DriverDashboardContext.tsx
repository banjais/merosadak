import React, { createContext, useContext, useCallback } from 'react';
import type { TravelIncident, ChatMessage } from './types';
import type { RouteInfo } from './services/enhancedSearchService';

interface DriverDashboardContextType {
    vehicleHealth: {
        fuelLevel: number;
        engineTemp: number;
        tirePressure: string;
        batteryVoltage: number;
        oilLife: number;
    };
    safetyScore: number;
    currentSpeed: number;
    isSpeeding: boolean;
    nextIntersection: { distance: number; name: string } | null;
    userLocation: { lat: number; lng: number; speed?: number | null; heading?: number | null } | null;
    isMuted: boolean;
    onToggleMute: () => void;
    aiSubtitle: string | null;
    isCompactHUD: boolean;
    onToggleCompactHUD: () => void;
    batteryLevel: number | null;
    brakeHeat: number;
    terrainGrade: number;
    safeTripKm: number;
    tripStartTime: number | null;
    descentBriefing: string | null;
    isHighContrast: boolean;
    pathAnalytics: { duration: number; delay: number; landslides: number } | null;
    activeCriticalReminder: string | null;
    onClearCriticalReminder: () => void;
    isNightVision: boolean;
    onToggleNightVision: () => void;
    isStealthMode: boolean;
    onToggleStealthMode: () => void;
    incidents: TravelIncident[];
    leaderboard: any[];
    chatMessages: ChatMessage[];
    onSendMessage: (text: string) => void;
    isGhostMode: boolean;
    elevation: number | undefined;
}

const DriverDashboardContext = createContext<DriverDashboardContextType | undefined>(undefined);

export const DriverDashboardProvider: React.FC<{ children: React.ReactNode } & DriverDashboardContextType> = ({
    children,
    ...props
}) => {
    return (
        <DriverDashboardContext.Provider value={props}>
            {children}
        </DriverDashboardContext.Provider>
    );
};

export const useDriverDashboard = () => {
    const context = useContext(DriverDashboardContext);
    if (!context) {
        throw new Error('useDriverDashboard must be used within a DriverDashboardProvider');
    }
    return context;
};

export default useDriverDashboard;