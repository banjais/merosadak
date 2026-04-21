import { toast } from '../components/Toast';

export interface Reminder {
    id: string;
    task: string;
    time: string;
    planId?: string | null;
    timestamp: number;
    isCritical?: boolean;
    repeat?: 'none' | 'daily' | 'weekly';
}

const REMINDERS_STORAGE_KEY = 'merosadak_reminders';

export type RescueStatus = 'idle' | 'transmitting' | 'received' | 'dispatched' | 'resolved';
export type Telemetry = { speed: number; heading: number };
export type SyncContext = { highwayCode: string; type: string };
type ReminderCallback = (reminder: Reminder | null, isLeader: boolean, telemetry?: Telemetry, syncContext?: SyncContext) => void;

class ReminderService {
    private static instance: ReminderService;
    private reminders: Reminder[] = [];
    private notifiedIds: Set<string> = new Set();
    private rescueStatus: RescueStatus = 'idle';
    private subscribers: Set<ReminderCallback> = new Set();
    private worker: Worker | null = null;
    private syncChannel: BroadcastChannel;
    private tabId: string = Math.random().toString(36).substring(7);
    private leaderId: string | null = null;
    private electionTimeout: NodeJS.Timeout | null = null;

    private heartbeatInterval: any = null;
    private lastLeaderActivity: number = Date.now();
    private monitorInterval: any = null;

    private constructor() {
        this.syncChannel = new BroadcastChannel('merosadak_reminders_sync');
        this.loadReminders();
        this.setupElection();
        this.startHealthMonitor();
        if (typeof Worker !== 'undefined') {
            // this.initWorker(); // worker not available
        }

        this.syncChannel.onmessage = (event) => {
            if (event.data === 'SYNC_REMINDERS') {
                this.reloadAndNotify();
            } else if (event.data?.type === 'RESCUE_STATUS_UPDATE') {
                this.rescueStatus = event.data.status;
                this.notifySubscribers();
            } else if (event.data?.type === 'TELEMETRY_SYNC') {
                this.notifySubscribers(undefined, { speed: event.data.speed, heading: event.data.heading });
            } else if (event.data?.type === 'GLOBAL_MESSAGE') {
                this.notifySubscribers(undefined, undefined, { globalMessage: event.data.message });
            } else if (event.data?.type === 'CONTEXT_SYNC') {
                this.notifySubscribers(undefined, undefined, { highwayCode: event.data.code, type: event.data.contextType });
            } else if (event.data?.type === 'SOS_SIGNAL') {
                this.notifySOS(event.data.lat, event.data.lng);
            } else if (event.data?.type === 'ELECTION') {
                this.handleElectionMessage(event.data);
            }
        };
    }

    public static getInstance(): ReminderService {
        if (!ReminderService.instance) {
            ReminderService.instance = new ReminderService();
        }
        return ReminderService.instance;
    }

    private setupElection() {
        // Broadcast presence and request leader status
        this.syncChannel.postMessage({ type: 'ELECTION', action: 'HELLO', id: this.tabId });

        // If no leader responds in 500ms, assume leadership
        this.electionTimeout = setTimeout(() => {
            if (!this.leaderId) {
                this.claimLeadership();
            }
        }, 500);
    }

    private handleElectionMessage(data: any) {
        if (data.action === 'HELLO') {
            // New tab joined, if I'm leader, tell them
            if (this.isLeader()) {
                this.syncChannel.postMessage({ type: 'ELECTION', action: 'LEADER_ANNOUNCE', id: this.tabId });
            }
        } else if (data.action === 'LEADER_ANNOUNCE') {
            this.leaderId = data.id;
            if (this.electionTimeout) clearTimeout(this.electionTimeout);
        } else if (data.action === 'HEARTBEAT') {
            this.leaderId = data.id;
            this.lastLeaderActivity = Date.now();
            if (this.electionTimeout) clearTimeout(this.electionTimeout);
        } else if (data.action === 'LEADER_RESIGN') {
            this.leaderId = null;
            this.setupElection();
            this.notifySubscribers();
        }
    }

    private startHealthMonitor() {
        if (this.monitorInterval) clearInterval(this.monitorInterval);
        this.monitorInterval = setInterval(() => {
            // If I'm not the leader and the leader hasn't beat in 5 seconds, re-elect
            if (!this.isLeader() && this.leaderId && Date.now() - this.lastLeaderActivity > 5000) {
                console.log("[Election] Leader heartbeat lost. Triggering re-election.");
                this.leaderId = null;
                this.setupElection();
            }
        }, 2000);
    }

    private startHeartbeat() {
        if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
        this.heartbeatInterval = setInterval(() => {
            if (this.isLeader()) {
                this.syncChannel.postMessage({ type: 'ELECTION', action: 'HEARTBEAT', id: this.tabId });
            }
        }, 2000);
    }

    private claimLeadership() {
        this.leaderId = this.tabId;
        this.syncChannel.postMessage({ type: 'ELECTION', action: 'LEADER_ANNOUNCE', id: this.tabId });
        this.startHeartbeat();
    }

    public relinquishLeadership() {
        if (this.isLeader()) {
            if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
            this.leaderId = null;
            this.syncChannel.postMessage({ type: 'ELECTION', action: 'LEADER_RESIGN', id: this.tabId });
            this.notifySubscribers();
            setTimeout(() => this.setupElection(), 1000); // Re-join election queue after a second
        }
    }

    public isLeader(): boolean {
        return this.leaderId === this.tabId;
    }

    public getRescueStatus(): RescueStatus {
        return this.rescueStatus;
    }

    private notifySubscribers(reminder?: Reminder, telemetry?: Telemetry, syncContext?: SyncContext) {
        this.subscribers.forEach(cb => cb(reminder || null, this.isLeader(), telemetry, syncContext));
    }

    private reloadAndNotify() {
        this.loadReminders();
        this.notifySubscribers();
    }

    private loadReminders() {
        const saved = localStorage.getItem(REMINDERS_STORAGE_KEY);
        this.reminders = saved ? JSON.parse(saved) : [];
    }

    private saveReminders() {
        localStorage.setItem(REMINDERS_STORAGE_KEY, JSON.stringify(this.reminders));
        this.syncChannel.postMessage('SYNC_REMINDERS');
    }

    public getReminders(): Reminder[] {
        return [...this.reminders];
    }

    public addReminder(reminder: Reminder) {
        this.reminders = [reminder, ...this.reminders];
        this.saveReminders();
    }

    public deleteReminder(id: string) {
        this.reminders = this.reminders.filter(r => r.id !== id);
        this.saveReminders();
        this.notifiedIds.delete(id);
    }

    public broadcastSOS(lat?: number, lng?: number) {
        this.updateRescueStatus('transmitting');
        this.syncChannel.postMessage({ type: 'SOS_SIGNAL', lat, lng });
    }

    public broadcastContext(code: string, contextType: string) {
        if (this.isLeader()) {
            this.syncChannel.postMessage({ type: 'CONTEXT_SYNC', code, contextType });
        }
    }

    public broadcastGlobalMessage(message: string) {
        if (this.isLeader()) {
            this.syncChannel.postMessage({ type: 'GLOBAL_MESSAGE', message });
        }
    }

    public broadcastTelemetry(speed: number, heading: number) {
        if (this.isLeader()) {
            this.syncChannel.postMessage({ type: 'TELEMETRY_SYNC', speed, heading });
        }
    }

    public resolveSOS() {
        this.updateRescueStatus('resolved');
        setTimeout(() => this.updateRescueStatus('idle'), 5000);
    }

    public updateRescueStatus(status: RescueStatus) {
        this.rescueStatus = status;
        this.syncChannel.postMessage({ type: 'RESCUE_STATUS_UPDATE', status });
        this.notifySubscribers();
    }

    private notifySOS(lat?: number, lng?: number) {
        // Alert all subscribers about the SOS event across tabs
        this.subscribers.forEach(cb => cb({
            id: 'sos_' + Date.now(),
            task: `EMERGENCY SOS SIGNAL DETECTED${lat ? ` at [${lat.toFixed(4)}, ${lng?.toFixed(4)}]` : ''}`,
            time: '',
            timestamp: Date.now(),
            isCritical: true,
            repeat: 'none'
        }, this.isLeader()));
    }

    public clearAllReminders() {
        this.reminders = [];
        this.saveReminders();
        this.notifiedIds.clear();
    }

    public subscribe(callback: ReminderCallback) {
        this.subscribers.add(callback);
        return () => this.subscribers.delete(callback);
    }

    public snoozeReminder(id: string, minutes: number = 10) {
        this.reminders = this.reminders.map(r => {
            if (r.id !== id) return r;

            const [hours, mins] = r.time.split(':').map(Number);
            const date = new Date();
            date.setHours(hours);
            date.setMinutes(mins + minutes);

            const newTime = date.toLocaleTimeString('en-US', {
                hour12: false,
                hour: '2-digit',
                minute: '2-digit'
            });

            return { ...r, time: newTime };
        });

        this.saveReminders();
        this.notifiedIds.delete(id);
        this.subscribers.forEach(cb => cb(null as any)); // Trigger UI sync
    }

    // private initWorker() {
    //     // Using new URL pattern for Vite/Web-Worker compatibility
    //     this.worker = new Worker(new URL('./services/reminder.worker.ts', import.meta.url));

    //     this.worker.onmessage = (e) => {
    //         const { type, currentTime, currentSeconds, currentDay } = e.data;

    //         if (type === 'TICK') {
    //             this.reminders.forEach(reminder => {
    //                 let shouldTrigger = reminder.time === currentTime && !this.notifiedIds.has(reminder.id);

    //                 if (shouldTrigger && reminder.repeat === 'weekly') {
    //                     const creationDate = new Date(reminder.timestamp);
    //                     if (currentDay !== creationDate.getDay()) shouldTrigger = false;
    //                 }

    //                 if (shouldTrigger) {
    //                     this.notifiedIds.add(reminder.id);
    //                     this.subscribers.forEach(cb => cb(reminder, this.isLeader()));

    //                     if (!reminder.repeat || reminder.repeat === 'none') {
    //                         setTimeout(() => this.deleteReminder(reminder.id), 2000);
    //                     }
    //                 }
    //             });

    //             if (currentSeconds === 0) {
    //                 const currentMinIds = this.reminders.filter(r => r.time === currentTime).map(r => r.id);
    //                 this.notifiedIds = new Set(currentMinIds);
    //             }
    //         }
    //     };

    //     this.worker.postMessage({ type: 'START_CHECKING' });
    // }
}

export const reminderService = ReminderService.getInstance();