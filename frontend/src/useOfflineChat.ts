import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { ChatMessage } from './types';
import { apiFetch } from './api';
import { useNetworkStatus } from './hooks/useNetworkStatus';
import { haversineDistance } from './services/geoUtils';
import { useToast } from './ToastContext';
import LZString from 'lz-string';

export interface VoiceClip {
    senderId: string;
    data: string; // Base64 audio data
    timestamp: string;
    played: boolean;
}

export interface PeerData {
    lat: number;
    lng: number;
    name: string;
    timestamp: number;
    breadcrumbs: { lat: number; lng: number; timestamp: number }[];
}

export const useOfflineChat = (userId: string, userLocation: { lat: number, lng: number } | null) => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [peersLocation, setPeersLocation] = useState<Record<string, PeerData>>({});
    const [peersRoutes, setPeersRoutes] = useState<Record<string, { points: { lat: number, lng: number }[], color: string }>>({});
    const [fenceThreshold, setFenceThreshold] = useState(5); // km
    const [isPTTRecording, setIsPTTRecording] = useState(false);
    const [lastVoiceClip, setLastVoiceClip] = useState<{ senderId: string, url: string } | null>(null);
    const [activeSOS, setActiveSOS] = useState<{ senderId: string; lat: number; lng: number; name: string } | null>(null);
    const [isQuietMode, setIsQuietMode] = useState(false);
    const [voiceClipHistory, setVoiceClipHistory] = useState<VoiceClip[]>([]);
    const [isP2PConnected, setIsP2PConnected] = useState(false);
    const [pendingSync, setPendingSync] = useState<ChatMessage[]>([]);
    const { isOffline } = useNetworkStatus();

    // WebRTC Refs
    const pc = useRef<RTCPeerConnection | null>(null);
    const dc = useRef<RTCDataChannel | null>(null);
    const mediaRecorder = useRef<MediaRecorder | null>(null);
    const [p2pSignalStrength, setP2pSignalStrength] = useState<number | null>(null); // 0-100 scale
    const { info: showToast, error: toastError, warning } = useToast();

    // BroadcastChannel allows communication between tabs/windows on the same origin 
    // even if the user is completely offline.
    const channel = new BroadcastChannel('merosadak_p2p_chat');
    const STORAGE_KEY = 'offline_chat_history';
    const QUEUE_KEY = 'offline_sync_queue';

    useEffect(() => {
        const saved = localStorage.getItem('offline_chat_history');
        if (saved) {
            const parsed = JSON.parse(saved);
            setMessages(parsed);
        }

        channel.onmessage = (event) => {
            const data = event.data;
            if (data.type === 'location') {
                updatePeerLocation(data);
            } else if (data.type === 'audio') {
                handleIncomingAudio(data);
            } else if (data.type === 'route_sync') {
                handleIncomingRoute(data);
            } else if (data.type === 'sos') {
                handleIncomingSOS(data);
            } else if (data.type === 'history_sync') {
                handleHistorySync(data.messages);
            } else {
                setMessages((prev) => {
                    if (prev.some(m => m.msgId === data.msgId)) return prev;
                    const updated = [...prev, data];
                    localStorage.setItem('offline_chat_history', JSON.stringify(updated));
                    return updated;
                });
            }
        };

        const savedQueue = localStorage.getItem(QUEUE_KEY);
        if (savedQueue) setPendingSync(JSON.parse(savedQueue));

        return () => {
            channel.close();
            pc.current?.close();
        };
    }, []);

    // --- Group Fence Logic ---
    const outOfRangeMembers = useMemo(() => {
        if (!userLocation) return [];
        return Object.entries(peersLocation)
            .map(([id, data]) => ({
                id,
                ...data,
                distance: haversineDistance(userLocation.lat, userLocation.lng, data.lat, data.lng)
            }))
            .filter(m => m.distance > fenceThreshold);
    }, [peersLocation, userLocation, fenceThreshold]);

    const updatePeerLocation = (data: any) => {
        const now = Date.now();
        const thirtyMinsAgo = now - 30 * 60 * 1000;
        setPeersLocation(prev => ({
            ...prev,
            [data.senderId]: {
                lat: data.lat,
                lng: data.lng,
                name: data.name,
                timestamp: now,
                breadcrumbs: [
                    ...(prev[data.senderId]?.breadcrumbs || []),
                    { lat: data.lat, lng: data.lng, timestamp: now }
                ].filter(b => b.timestamp > thirtyMinsAgo)
            }
        }));
    };

    // --- WebRTC Logic for Offline Device-to-Device ---

    const setupDataChannel = (channel: RTCDataChannel) => {
        dc.current = channel;
        dc.current.onopen = () => {
            setIsP2PConnected(true);
            // Request/Send history upon connection
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                dc.current?.send(JSON.stringify({ type: 'history_sync', messages: JSON.parse(saved).slice(-10) }));
            }
        };
        dc.current.onclose = () => setIsP2PConnected(false);
        dc.current.onmessage = (e) => {
            const msg = JSON.parse(e.data);
            if (msg.type === 'history_sync') {
                handleHistorySync(msg.messages);
            } else if (msg.type === 'location') {
                updatePeerLocation(msg);
            } else if (msg.type === 'audio') {
                handleIncomingAudio(msg);
            } else if (msg.type === 'route_sync') {
                handleIncomingRoute(msg);
            } else if (msg.type === 'sos') {
                handleIncomingSOS(msg);
            } else {
                setMessages(prev => {
                    if (prev.some(m => m.msgId === msg.msgId)) return prev;
                    return [...prev, msg];
                });
            }
        };
    };

    const handleHistorySync = (incomingMessages: ChatMessage[]) => {
        setMessages(prev => {
            const existingIds = new Set(prev.map(m => m.msgId));
            const newOnes = incomingMessages.filter(m => !existingIds.has(m.msgId));
            if (newOnes.length === 0) return prev;
            const updated = [...prev, ...newOnes].sort((a, b) =>
                new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
            );
            localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
            return updated;
        });
        showToast("Synced conversation history with group");
    };

    // --- Offline SOS Logic ---
    const sendOfflineSOS = useCallback(() => {
        if (!userLocation) {
            toastError("Cannot send SOS: Location unknown");
            return;
        }
        const payload = {
            type: 'sos',
            senderId: userId,
            lat: userLocation.lat,
            lng: userLocation.lng,
            name: 'Emergency Alert'
        };
        if (dc.current?.readyState === "open") dc.current.send(JSON.stringify(payload));
        channel.postMessage(payload);
    }, [userId, userLocation, toastError]);

    const handleIncomingSOS = (payload: any) => {
        setActiveSOS(payload);
        toastError(`🚨 SOS RECEIVED from ${payload.name || payload.senderId}! Check Map.`);
    };

    // --- Push To Talk (PTT) ---
    const startPTT = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const recorder = new MediaRecorder(stream);
            const chunks: Blob[] = [];
            recorder.ondataavailable = (e) => chunks.push(e.data);
            recorder.onstop = () => {
                const blob = new Blob(chunks, { type: 'audio/webm' });
                const reader = new FileReader();
                reader.readAsDataURL(blob);
                reader.onloadend = () => {
                    const base64 = reader.result as string;
                    // Apply LZString compression to the Base64 string
                    const compressedData = LZString.compressToUTF16(base64);
                    const payload = {
                        type: 'audio',
                        senderId: userId,
                        data: compressedData,
                        compressed: true,
                        timestamp: new Date().toISOString()
                    };
                    if (dc.current?.readyState === "open") dc.current.send(JSON.stringify(payload));
                    channel.postMessage(payload);
                };
                stream.getTracks().forEach(t => t.stop());
            };
            mediaRecorder.current = recorder;
            recorder.start();
            setIsPTTRecording(true);
        } catch (err) {
            warning("Mic access required for Push-to-Talk");
        }
    }, [userId]);

    const stopPTT = useCallback(() => {
        if (mediaRecorder.current?.state === 'recording') {
            mediaRecorder.current.stop();
            setIsPTTRecording(false);
        }
    }, []);

    const createConnection = useCallback(async () => {
        pc.current = new RTCPeerConnection({ iceServers: [] }); // No STUN needed for local LAN
        setupDataChannel(pc.current.createDataChannel("chat"));

        const offer = await pc.current.createOffer();
        await pc.current.setLocalDescription(offer);

        // The app should render this string as a QR Code
        return JSON.stringify(pc.current.localDescription);
    }, []);

    const acceptOffer = useCallback(async (offerSdp: string) => {
        pc.current = new RTCPeerConnection({ iceServers: [] });
        pc.current.ondatachannel = (event) => setupDataChannel(event.channel);

        const offer = new RTCSessionDescription(JSON.parse(offerSdp));
        await pc.current.setRemoteDescription(offer);

        const answer = await pc.current.createAnswer();
        await pc.current.setLocalDescription(answer);

        // The app should render this string as the "Answer" QR Code
        return JSON.stringify(pc.current.localDescription);
    }, []);

    const finalizeConnection = useCallback(async (answerSdp: string) => {
        if (!pc.current) return;
        const answer = new RTCSessionDescription(JSON.parse(answerSdp));
        await pc.current.setRemoteDescription(answer);
    }, []);

    // --- Web Bluetooth Discovery (Experimental) ---
    const discoverNearby = useCallback(async () => {
        try {
            // Browsers require a specific service UUID to find other devices
            // This is a generic "MeroSadak" service UUID
            const device = await navigator.bluetooth.requestDevice({
                filters: [{ namePrefix: 'MeroSadak-' }],
                optionalServices: ['0000180a-0000-1000-8000-00805f9b34fb']
            });
            console.log(`[Bluetooth] Found device: ${device.name}`);
            // Bluetooth only provides discovery in browsers; 
            // You would still use QR codes to exchange SDP over WebRTC.
        } catch (err) {
            console.warn('[Bluetooth] Discovery failed or cancelled', err);
        }
    }, []);

    // --- Route Sharing Logic ---
    const broadcastRoute = useCallback((points: { lat: number, lng: number }[], color: string = "#6366f1") => {
        const payload = { type: 'route_sync', senderId: userId, points, color, timestamp: Date.now() };
        if (dc.current?.readyState === "open") dc.current.send(JSON.stringify(payload));
        channel.postMessage(payload);
    }, [userId, channel]);

    const handleIncomingRoute = (payload: any) => {
        setPeersRoutes(prev => ({
            ...prev,
            [payload.senderId]: { points: payload.points, color: payload.color }
        }));
        showToast(`Route received from ${peersLocation[payload.senderId]?.name || 'peer'}`);
    };

    const handleIncomingAudio = useCallback((payload: VoiceClip | any) => {
        if (isQuietMode) {
            setVoiceClipHistory((prev) => [...prev, { ...payload, played: false }]);
            showToast(`New voice message from ${payload.senderId}`);
            return;
        }
        const audioData = payload.compressed
            ? LZString.decompressFromUTF16(payload.data)
            : payload.data;
        if (!audioData) {
            return;
        }
        const audio = new Audio(audioData);
        audio.play().catch(() => { /* Empty catch */ });
        setLastVoiceClip({ senderId: payload.senderId, url: audioData });
        setTimeout(() => setLastVoiceClip(null), 5000);
    },
    [isQuietMode, showToast]
);

    const playVoiceClip = useCallback((clip: VoiceClip) => {
        const audio = new Audio(clip.data);
        audio.play().catch(e => console.warn('[PTT] Playback failed', e));
        setVoiceClipHistory(prev => prev.map(c => c === clip ? { ...c, played: true } : c));
    }, []);

    // --- Location Broadcasting ---
    const broadcastLocation = useCallback((lat: number, lng: number, name: string) => {
        const payload = { type: 'location', senderId: userId, lat, lng, name, timestamp: Date.now() };
        if (dc.current?.readyState === "open") dc.current.send(JSON.stringify(payload));
        channel.postMessage(payload);
    }, [userId, channel]);

    // --- Offline Queue & Server Sync ---

    const syncQueueWithServer = useCallback(async () => {
        if (isOffline || pendingSync.length === 0) return;

        console.log(`[Sync] Attempting to upload ${pendingSync.length} messages...`);
        try {
            await apiFetch('/chat/sync', {
                method: 'POST',
                body: JSON.stringify({ messages: pendingSync })
            });

            // Clear queue on success
            setPendingSync([]);
            localStorage.removeItem(QUEUE_KEY);
            console.log('[Sync] Offline messages successfully pushed to server.');
        } catch (err) {
            console.error('[Sync] Server sync failed, will retry later.', err);
        }
    }, [isOffline, pendingSync]);

    // Trigger sync when coming back online
    useEffect(() => {
        if (!isOffline) {
            syncQueueWithServer();
        }
    }, [isOffline, syncQueueWithServer]);

    const sendOfflineMessage = useCallback(async (text: string) => {
        const message: ChatMessage = {
            msgId: `${userId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            role: 'user',
            text,
            timestamp: new Date().toISOString(),
            isOffline: true,
            senderId: userId
        };

        // Update local state
        const updatedMessages = [...messages, message];
        setMessages(updatedMessages);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedMessages));

        // Broadcast to other local peers/tabs
        channel.postMessage(message);

        // Send via WebRTC if connected
        if (dc.current?.readyState === "open") {
            dc.current.send(JSON.stringify(message));
        }

        // Add to Offline Queue if no internet
        if (isOffline) {
            const newQueue = [...pendingSync, message];
            setPendingSync(newQueue);
            localStorage.setItem(QUEUE_KEY, JSON.stringify(newQueue));
        } else {
            // Try immediate send if online
            try {
                await apiFetch('/chat/send', { method: 'POST', body: JSON.stringify(message) });
            } catch {
                const newQueue = [...pendingSync, message];
                setPendingSync(newQueue);
                localStorage.setItem(QUEUE_KEY, JSON.stringify(newQueue));
            }
        }
    }, [userId, messages, pendingSync, isOffline]);

    return {
        messages, sendOfflineMessage, isP2PConnected, peersLocation,
        p2pSignalStrength, isQuietMode, setIsQuietMode, peersRoutes,
        voiceClipHistory, playVoiceClip,
        outOfRangeMembers, broadcastRoute,
        sendOfflineSOS, activeSOS, clearSOS: () => setActiveSOS(null),
        createConnection, acceptOffer, finalizeConnection,
        discoverNearby, broadcastLocation, pendingCount: pendingSync.length,
        startPTT, stopPTT, isPTTRecording, lastVoiceClip
    };
};