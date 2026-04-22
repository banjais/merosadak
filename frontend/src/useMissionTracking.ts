import { useState, useEffect, useRef, useCallback } from 'react';
import { haversineDistance } from '../services/geoUtils';
import { reminderService } from '../reminderService';
import { useToast } from '../ToastContext';

interface MissionTrackingProps {
    pilotMode: boolean;
    userLocation: any;
    highwayGeoJSON: any;
    smoothedSpeedLimit: number;
    isMuted: boolean;
    trafficIntensity: number;
    weatherData: any;
    pathAnalytics: any;
    isLeader: boolean;
}

export const useMissionTracking = ({
    pilotMode,
    userLocation,
    highwayGeoJSON,
    smoothedSpeedLimit,
    isMuted,
    trafficIntensity,
    weatherData,
    pathAnalytics,
    isLeader
}: MissionTrackingProps) => {
    const { addToast } = useToast();
    const [safetyScore, setSafetyScore] = useState(100);
    const [terrainGrade, setTerrainGrade] = useState(0);
    const [brakeHeat, setBrakeHeat] = useState(0);
    const [mechanicalStress, setMechanicalStress] = useState(0);
    const [safeTripKm, setSafeTripKm] = useState(0);
    const [tripEvents, setTripEvents] = useState<any[]>([]);
    const [perfectScoreDuration, setPerfectScoreDuration] = useState(0);
    const [milestoneAchieved, setMilestoneAchieved] = useState(false);

    const brakeHeatRef = useRef(0);
    const lastPositionRef = useRef<{ lat: number; lng: number } | null>(null);
    const lastElevationRef = useRef<number | null>(null);
    const lastSpeedKmhRef = useRef(0);
    const lastSafeCheckTimestamp = useRef<number>(Date.now());
    const gradeSamplesRef = useRef<{ grade: number; time: number }[]>([]);
    const lastBrakeHeatAlertRef = useRef<number>(0);
    const safeDrivingAccumulator = useRef<number>(0);
    const safeStreakAccumulator = useRef<number>(0);
    const lastEngineBrakeBonusRef = useRef<number>(0);
    const lastSpokenDangerZone = useRef<string | null>(null);
    const lastSpokenHazardId = useRef<string | null>(null);

    useEffect(() => {
        if (pilotMode) {
            setSafetyScore(100);
            setBrakeHeat(0);
            setMechanicalStress(0);
            setSafeTripKm(0);
            setTripEvents([]);
            brakeHeatRef.current = 0;
            safeDrivingAccumulator.current = 0;
            safeStreakAccumulator.current = 0;
            lastSafeCheckTimestamp.current = Date.now();
        }
    }, [pilotMode]);

    useEffect(() => {
        if (!pilotMode || !userLocation || !highwayGeoJSON?.features) return;

        const currentSpeedKmh = (userLocation.speed || 0) * 3.6;
        const deltaSpeed = Math.abs(currentSpeedKmh - lastSpeedKmhRef.current);
        const isSpeeding = currentSpeedKmh > smoothedSpeedLimit + 5;
        const isMoving = currentSpeedKmh > 5;
        const now = Date.now();

        // 1. Grade & Brake Heat Logic
        const currentElevation = userLocation.elevation || 0;
        if (lastElevationRef.current !== null && isMoving && lastPositionRef.current) {
            const elevationDiff = currentElevation - lastElevationRef.current;
            const horizontalDist = haversineDistance(
                lastPositionRef.current.lat, lastPositionRef.current.lng,
                userLocation.lat, userLocation.lng
            );

            if (horizontalDist > 0.002) {
                const rawGrade = (elevationDiff / (horizontalDist * 1000)) * 100;
                gradeSamplesRef.current.push({ grade: rawGrade, time: now });
                gradeSamplesRef.current = gradeSamplesRef.current.filter(s => now - s.time < 5000);
                const avgGrade = gradeSamplesRef.current.reduce((sum, s) => sum + s.grade, 0) / gradeSamplesRef.current.length;
                setTerrainGrade(avgGrade);

                // 🏗️ Mechanical Stress Logic: Rapid accel/decel on unpaved roads
                const nearestSegment = highwayGeoJSON.features.find((f: any) => {
                    const coords = f.geometry.coordinates;
                    return haversineDistance(userLocation.lat, userLocation.lng, coords[0][1], coords[0][0]) < 0.5;
                });
                const pave = String(nearestSegment?.properties?.pave_type || '').toLowerCase();
                const isUnpaved = pave.includes('earth') || pave.includes('gravel') || pave.includes('unpaved');

                if (isUnpaved && deltaSpeed > 12) {
                    const stressGain = (deltaSpeed - 12) * 0.8;
                    setMechanicalStress(prev => prev + stressGain);
                    setSafetyScore(prev => Math.max(0, prev - 2));
                    setTripEvents(prev => [...prev, {
                        type: 'penalty',
                        title: 'Rough Handling on Unpaved Road',
                        time: new Date().toLocaleTimeString(),
                        score: -2, lat: userLocation.lat, lng: userLocation.lng
                    }]);
                    addToast("warning", "Mechanical Stress: Rough Handling");
                }

                if (avgGrade < -4) {
                    const heatGain = (Math.abs(avgGrade) * (currentSpeedKmh / 50));
                    brakeHeatRef.current += heatGain;
                    if (avgGrade < -7 && currentSpeedKmh <= lastSpeedKmhRef.current + 1) {
                        if (now - lastEngineBrakeBonusRef.current > 60000) {
                            setSafetyScore(prev => Math.min(100, prev + 2));
                            lastEngineBrakeBonusRef.current = now;
                        }
                    }
                } else {
                    brakeHeatRef.current = Math.max(0, brakeHeatRef.current - 0.5);
                }
                setBrakeHeat(brakeHeatRef.current);

                // ⚠️ Brake Temperature Critical Alarm
                if (brakeHeatRef.current > 180 && now - lastBrakeHeatAlertRef.current > 60000) {
                    // 🔊 Distinct Tactical Frequency Alarm
                    try {
                        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
                        const osc = ctx.createOscillator();
                        const gain = ctx.createGain();
                        osc.type = 'sawtooth'; // Harsh warning tone
                        osc.frequency.setValueAtTime(880, ctx.currentTime);
                        osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.5);
                        gain.gain.setValueAtTime(0.2, ctx.currentTime);
                        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5);
                        osc.connect(gain);
                        gain.connect(ctx.destination);
                        osc.start();
                        osc.stop(ctx.currentTime + 0.5);
                    } catch (e) { console.warn("Audio alarm failed", e); }

                    // 📳 Aggressive Vibration Pattern
                    if ('vibrate' in navigator) {
                        navigator.vibrate([500, 200, 500, 200, 500]);
                    }
                    lastBrakeHeatAlertRef.current = now;
                }

                setSafeTripKm(prev => prev + horizontalDist);
            }
        }

        // 2. Proactive Danger Zone detection
        const dangerSegments = highwayGeoJSON.features.filter((f: any) => f.properties?.danger_zone);
        const approachingDanger = dangerSegments.find((f: any) => {
            const coords = f.geometry.coordinates;
            return haversineDistance(userLocation.lat, userLocation.lng, coords[0][1], coords[0][0]) < 0.25;
        });

        if (approachingDanger && currentSpeedKmh > 40) {
            const segmentId = approachingDanger.properties?.id || approachingDanger.id;
            if (lastSpokenDangerZone.current !== segmentId) {
                if (!isMuted && 'speechSynthesis' in window) {
                    window.speechSynthesis.speak(new SpeechSynthesisUtterance("Sharp turn ahead. Reduce speed."));
                }
                setSafetyScore(prev => Math.max(0, prev - 5));
                setTripEvents(prev => [...prev, { type: 'penalty', title: 'Unsafe Sharp Turn Entry', time: new Date().toLocaleTimeString(), score: -5, lat: userLocation.lat, lng: userLocation.lng }]);
                lastSpokenDangerZone.current = segmentId;
            }
        } else if (!approachingDanger) {
            lastSpokenDangerZone.current = null;
        }

        // 3. Hazard Proximity
        if (pathAnalytics?.hazards) {
            const nearbyHazard = pathAnalytics.hazards.find((h: any) => haversineDistance(userLocation.lat, userLocation.lng, h.lat, h.lng) < 0.25);
            if (nearbyHazard) {
                const hazardId = `${nearbyHazard.type}-${nearbyHazard.lat}`;
                if (lastSpokenHazardId.current !== hazardId) {
                    if (!isMuted && 'speechSynthesis' in window) {
                        window.speechSynthesis.speak(new SpeechSynthesisUtterance("Hazard approaching."));
                    }
                    if (isLeader) (reminderService as any).broadcastHapticPulse();
                    lastSpokenHazardId.current = hazardId;
                }
            } else {
                lastSpokenHazardId.current = null;
            }
        }

        // 4. Speeding Penalty
        if (isSpeeding) {
            const riskMultiplier = terrainGrade < -7 ? 3.0 : 1.0;
            setSafetyScore(prev => Math.max(0, prev - (0.05 * riskMultiplier)));
        }

        // 5. Streak & Recovery Logic
        const deltaTime = now - lastSafeCheckTimestamp.current;
        lastSafeCheckTimestamp.current = now;

        if (isMoving && !isSpeeding && !approachingDanger && brakeHeatRef.current < 140 && safetyScore < 100) {
            safeDrivingAccumulator.current += deltaTime;
            safeStreakAccumulator.current += deltaTime;

            const recoveryThreshold = safeStreakAccumulator.current >= 1800000 ? 150000 : 300000;
            if (safeDrivingAccumulator.current >= recoveryThreshold) {
                setSafetyScore(prev => Math.min(100, prev + 1));
                safeDrivingAccumulator.current = 0;
                addToast("success", "Safety Score +1");
            }
        } else if (isSpeeding) {
            safeDrivingAccumulator.current = 0;
            safeStreakAccumulator.current = 0;
        }

        // 6. Milestone Check
        if (safetyScore === 100 && isMoving) {
            setPerfectScoreDuration(prev => prev + (deltaTime / 1000));
        } else {
            setPerfectScoreDuration(0);
        }

        lastElevationRef.current = currentElevation;
        lastSpeedKmhRef.current = currentSpeedKmh;
        lastPositionRef.current = { lat: userLocation.lat, lng: userLocation.lng };

    }, [userLocation, pilotMode, smoothedSpeedLimit, highwayGeoJSON, isMuted, terrainGrade, safetyScore, pathAnalytics, isLeader, addToast]);

    return {
        safetyScore,
        terrainGrade,
        brakeHeat,
        mechanicalStress,
        safeTripKm,
        tripEvents,
        perfectScoreDuration,
        milestoneAchieved,
        setMilestoneAchieved,
        safeStreak: safeStreakAccumulator.current
    };
};