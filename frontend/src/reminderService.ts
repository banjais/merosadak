import type { TravelIncident } from './types';

export interface Reminder {
    task: string;
    isCritical?: boolean;
}

export type RescueStatus = 'idle' | 'dispatched' | 'resolved' | 'transmitting';

export interface SyncContext {
    globalMessage?: string;
    highwayCode?: string;
    viewMode?: 'none' | 'telemetry' | 'report';
    ghostMode?: boolean;
    nightVision?: boolean;
    stealthMode?: boolean;
    remoteShutdown?: string;
    rescuers?: any[];
    sosActive?: boolean; // Added for critical alert sync
    measurePoints?: Array<{ lat: number; lng: number }>; // Added for Route Sync
    leaderPath?: Array<[number, number, number]>; // Added for Ghost Path [lat, lng, speed]
    remoteHUDMode?: 'standard' | 'compact';
    hapticPulse?: boolean;
    aiSubtitle?: string;
}

export interface TelemetryData {
    speed: number;
    heading: number;
    lat?: number;
    lng?: number;
}

export interface ReminderService {
    subscribe: (callback: (reminder: Reminder | null, isLeader: boolean, telemetry: TelemetryData | null, context: SyncContext) => void) => () => void;
    isLeader: () => boolean;
    getTabId: () => string;
    getRescueStatus: () => RescueStatus;
    relinquishLeadership: () => void;
    resolveSOS: () => void;

    // Broadcast Methods
    broadcastTelemetry: (speed: number, heading: number, lat?: number, lng?: number) => void;
    broadcastHapticPulse: () => void;
    broadcastStealthMode: (active: boolean) => void;
    broadcastNightVision: (active: boolean) => void;
    broadcastAISubtitle: (text: string) => void;
    broadcastRemoteShutdown: (tabId: string) => void;
    broadcastGlobalMessage: (msg: string) => void;
    broadcastViewLock: (mode: 'none' | 'telemetry' | 'report') => void;
    broadcastGhostMode: (active: boolean) => void;
    broadcastRemotePOV: (mode: 'standard' | 'compact') => void;
    broadcastSOS: (lat?: number, lng?: number) => void;
    broadcastContext: (context: Partial<SyncContext>) => void;
}

declare const reminderService: ReminderService;

const reminderService: ReminderService = {
    subscribe: () => () => {},
    isLeader: () => false,
    getTabId: () => 'default',
    getRescueStatus: () => 'idle',
    relinquishLeadership: () => {},
    resolveSOS: () => {},
    broadcastTelemetry: () => {},
    broadcastHapticPulse: () => {},
    broadcastStealthMode: () => {},
    broadcastNightVision: () => {},
    broadcastAISubtitle: () => {},
    broadcastRemoteShutdown: () => {},
    broadcastGlobalMessage: () => {},
    broadcastViewLock: () => {},
    broadcastGhostMode: () => {},
    broadcastRemotePOV: () => {},
    broadcastSOS: () => {},
    broadcastContext: () => {},
};

export { reminderService };