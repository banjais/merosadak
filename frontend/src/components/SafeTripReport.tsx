import React, { useEffect, useRef, useState, useMemo } from 'react';
import { jsPDF } from 'jspdf';
import { motion } from 'framer-motion';
import {
    X, ShieldCheck, AlertTriangle, Zap, Clock, TrendingUp, History, Share2, FileBadge, LineChart, Map as MapIcon, Route, Play, Mountain, Fuel
} from 'lucide-react';
import { MapContainer, TileLayer, Polyline, Marker, Popup } from 'react-leaflet';
import { L } from '../lib/leaflet';
import { SafetyScoreRing } from '../SafetyScoreRing';
import { useToast } from '../ToastContext';
import { apiFetch } from '../api';
import { haversineDistance } from '../services/geoUtils';
import { useEscapeKey } from '../hooks/useEscapeKey';

interface SafeTripReportProps {
    isOpen: boolean;
    onClose: () => void;
    events: any[]; // Assuming events can be any type for now
    scoreHistory?: any[];
    finalScore: number;
    durationMins: number;
    startLoc?: { lat: number; lng: number } | null;
    endLoc?: { lat: number; lng: number } | null;
    actualPath?: [number, number, number, number][];
    isGreenRoute?: boolean;
    safeTripKm?: number;
    vehicleType?: string;
    highwayCode?: string | null;
}

export const SafeTripReport: React.FC<SafeTripReportProps> = ({
    isOpen,
    onClose,
    events,
    scoreHistory = [],
    finalScore,
    durationMins,
    startLoc,
    endLoc,
    actualPath = [],
    isGreenRoute,
    safeTripKm,
    vehicleType,
    highwayCode
}) => {
    const autoProcessed = useRef(false);
    const [replayIndex, setReplayIndex] = useState(0);
    const [isReplaying, setIsReplaying] = useState(true); // For map path replay
    const [replayScoreIndex, setReplayScoreIndex] = useState(0); // New state for score replay
    const [isScoreReplaying, setIsScoreReplaying] = useState(false); // New state for score replay
    const { success, error } = useToast();

    useEscapeKey(onClose);

    // 🏎️ Safety Replay Logic
    useEffect(() => {
        if (isOpen && isReplaying && replayIndex < actualPath.length) {
            const timer = setTimeout(() => {
                setReplayIndex(prev => Math.min(prev + 2, actualPath.length)); // Step by 2 for smoothness
            }, 30);
            return () => clearTimeout(timer);
        } else if (replayIndex >= actualPath.length) {
            setIsReplaying(false);
        }
    }, [isOpen, isReplaying, replayIndex, actualPath]);

    // 📈 Safety Score Replay Logic
    useEffect(() => {
        if (isScoreReplaying && replayScoreIndex < scoreHistory.length) {
            const timer = setTimeout(() => {
                setReplayScoreIndex(prev => prev + 1);
            }, 50); // Adjust speed of score replay
            return () => clearTimeout(timer);
        } else if (replayScoreIndex >= scoreHistory.length) {
            setIsScoreReplaying(false);
        }
    }, [isOpen, isScoreReplaying, replayScoreIndex, scoreHistory]);

    // 🏔️ Terrain Analytics: Calculate Max Grade and Difficulty
    const terrainStats = useMemo(() => {
        if (actualPath.length < 2) return { maxGrade: 0, difficulty: 'Level' };

        let maxGrade = 0;
        for (let i = 1; i < actualPath.length; i++) {
            const p1 = actualPath[i - 1];
            const p2 = actualPath[i];
            const dist = haversineDistance(p1[0], p1[1], p2[0], p2[1]) * 1000; // meters
            const elevDiff = Math.abs(p2[3] - p1[3]);

            if (dist > 15) { // Threshold to filter GPS noise
                const grade = (elevDiff / dist) * 100;
                if (grade > maxGrade) maxGrade = grade;
            }
        }

        const difficulty = maxGrade > 15 ? 'Extreme' : maxGrade > 10 ? 'Challenging' : maxGrade > 5 ? 'Moderate' : 'Easy';
        return {
            maxGrade: Math.round(maxGrade * 10) / 10,
            difficulty
        };
    }, [actualPath]);

    // ⛽ Fuel Efficiency Performance Score
    const efficiencyScore = useMemo(() => {
        if (actualPath.length < 2) return 100;

        let score = 100;
        // Penalty for high terrain difficulty: Higher incline = more effort required
        if (terrainStats.difficulty === 'Extreme') score -= 15;
        else if (terrainStats.difficulty === 'Challenging') score -= 8;

        // Penalty for unsafe behavior (speeding violations)
        const speedingViolations = events.filter(e => e.title?.toLowerCase().includes('speeding')).length;
        score -= (speedingViolations * 5);

        // Bonus for following the Green Route mission
        if (isGreenRoute) score += 10;

        return Math.max(0, Math.min(100, score));
    }, [terrainStats, events, isGreenRoute, actualPath]);

    // 🛡️ Auto-Download and Cloud Sync on Trip End (Moved above conditional return)
    useEffect(() => {
        if (isOpen && !autoProcessed.current) {
            handleDownloadCertificate(true); // Trigger with cloudSave enabled
            autoProcessed.current = true;
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const penalties = events.filter(e => e.type === 'penalty');
    const recoveries = events.filter(e => e.type === 'recovery');

    const renderTrendChart = () => {
        if (scoreHistory.length < 2) return null;

        // Use a slice of the history for replay
        const displayedHistory = isScoreReplaying ? scoreHistory.slice(0, replayScoreIndex) : scoreHistory;

        if (displayedHistory.length < 2) return null;

        const width = 400; // Fixed width for SVG viewBox
        const height = 40; // Fixed height for SVG viewBox
        const points = displayedHistory.map((h, i) => {
            const x = (i / (displayedHistory.length - 1)) * width; // Scale X to SVG width
            const y = height - (h.val / 100) * height; // Scale Y to SVG height, assuming score is 0-100
            return `${x.toFixed(1)},${y.toFixed(1)}`;
        }).join(' L ');

        return (
            <div className="mt-4 p-4 rounded-3xl bg-surface-container-low/50 border border-outline/5">
                <div className="flex items-center justify-between mb-2 px-1">
                    <div className="flex items-center gap-1.5 text-[9px] font-black text-on-surface-variant/40 uppercase tracking-widest">
                        <LineChart size={10} className="text-primary" /> Journey Safety Trend
                    </div>
                    <span className="text-[8px] font-bold text-on-surface-variant/30 uppercase">Start → End</span>
                </div>
                <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-12 overflow-visible">
                    <motion.path
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: isScoreReplaying ? replayScoreIndex / scoreHistory.length : 1 }} // Animate based on replayScoreIndex
                        transition={{ duration: isScoreReplaying ? (scoreHistory.length * 0.05) : 0.5, ease: "linear" }} // Match replay speed
                        d={`M ${points}`}
                        fill="none"
                        stroke="#6366f1"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="drop-shadow-[0_2px_4px_rgba(99,102,241,0.3)]"
                    />
                </svg>
                <button
                    onClick={() => {
                        setReplayScoreIndex(0);
                        setIsScoreReplaying(true);
                    }}
                    disabled={isScoreReplaying || scoreHistory.length < 2}
                    className="mt-2 w-full py-2 rounded-xl bg-indigo-500 text-white text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <Play size={14} /> Replay Safety Trend
                </button>
            </div>
        );
    };

    // Generate Static Map URL (Yandex/OSM Static API style)
    const staticMapUrl = startLoc && endLoc
        ? `https://static-maps.yandex.ru/1.x/?lang=en_US&l=map&pt=${startLoc.lng},${startLoc.lat},pm2rdm~${endLoc.lng},${endLoc.lat},pm2gnm&size=450,200&z=10`
        : null;

    const handleShareReport = () => {
        const rating = finalScore >= 90 ? 'Excellent' : finalScore >= 70 ? 'Good' : 'Needs Work';
        const shareText = `🛣️ *MeroSadak Safe Trip Report*\n\nI just finished a safe trip across Nepal's highways! 🇳🇵\n\n🛡️ *Safety Rating:* ${finalScore}% (${rating})\n⏱️ *Duration:* ${durationMins} mins\n⚠️ *Hazards Encountered:* ${penalties.length}\n\nJoin me in making our roads safer! #MeroSadak #SafeTravelsNepal`;

        if (navigator.share) {
            navigator.share({
                title: 'My Trip Safety Report - MeroSadak',
                text: shareText,
            }).catch(() => { });
        } else {
            const url = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
            window.open(url, '_blank');
        }
    };

    // 🎨 Generate High-Fidelity Mission Summary Image
    const handleShareMission = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 1200;
        canvas.height = 630;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // 1. Background
        const gradient = ctx.createLinearGradient(0, 0, 1200, 630);
        gradient.addColorStop(0, '#0f172a');
        gradient.addColorStop(1, '#1e293b');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 1200, 630);

        // 2. Performance Ring Simulation
        ctx.beginPath();
        ctx.arc(250, 315, 180, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(99, 102, 241, 0.1)';
        ctx.lineWidth = 30;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(250, 315, 180, -Math.PI / 2, (-Math.PI / 2) + (Math.PI * 2 * (finalScore / 100)));
        ctx.strokeStyle = finalScore >= 80 ? '#10b981' : '#6366f1';
        ctx.lineWidth = 30;
        ctx.lineCap = 'round';
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = '900 120px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${finalScore}%`, 250, 315);

        ctx.font = 'bold 30px Inter, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fillText('SAFETY SCORE', 250, 420);

        // 3. Stats Grid
        ctx.textAlign = 'left';
        ctx.fillStyle = '#6366f1';
        ctx.font = 'black 40px Inter, sans-serif';
        ctx.fillText('MISSION SUMMARY', 500, 100);

        const stats = [
            { label: 'SAFE TRIP KM', value: `${safeTripKm?.toFixed(1)} KM` },
            { label: 'DURATION', value: `${durationMins} MINS` },
            { label: 'EFFICIENCY', value: `${efficiencyScore}%` },
            { label: 'DIFFICULTY', value: terrainStats.difficulty.toUpperCase() }
        ];

        stats.forEach((s, i) => {
            const y = 200 + (i * 100);
            ctx.fillStyle = 'rgba(255,255,255,0.4)';
            ctx.font = '900 24px Inter, sans-serif';
            ctx.fillText(s.label, 500, y);
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 50px Inter, sans-serif';
            ctx.fillText(s.value, 500, y + 45);
        });

        const link = document.createElement('a');
        link.download = `MeroSadak_Mission_${Date.now()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    };

    // 🗺️ Generate High-Fidelity Detailed Report Image
    const handleShareReportImage = async () => {
        const canvas = document.createElement('canvas');
        canvas.width = 1200; // Standard width
        canvas.height = 1300; // Increased height to accommodate new elements
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Calculate cumulative elevation stats
        const totalClimb = Math.round(actualPath.reduce((acc, curr, i, arr) => {
            if (i === 0) return 0;
            const diff = curr[3] - arr[i - 1][3];
            return diff > 0 ? acc + diff : acc;
        }, 0));
        const totalDescent = Math.round(actualPath.reduce((acc, curr, i, arr) => {
            if (i === 0) return 0;
            const diff = curr[3] - arr[i - 1][3];
            return diff < 0 ? acc + Math.abs(diff) : acc;
        }, 0));

        // 1. Background
        const gradient = ctx.createLinearGradient(0, 0, 1200, 1200);
        gradient.addColorStop(0, '#f8fafc');
        gradient.addColorStop(1, '#f1f5f9');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 1200, 1200);

        // 2. Header Block
        ctx.fillStyle = '#6366f1';
        ctx.fillRect(0, 0, 1200, 150);
        ctx.fillStyle = '#ffffff';
        ctx.font = '900 60px Inter, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('SAFE TRIP REPORT', 80, 95);

        ctx.font = 'bold 24px Inter, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.fillText(`UNIT: ${(vehicleType || 'LAND').toUpperCase()}`, 80, 120);

        // 2.5 Weather Summary Icon (Default to Clear based on safe mission patterns)
        const sunX = 750;
        const sunY = 75;
        ctx.fillStyle = '#fbbf24'; // Amber-400
        ctx.beginPath(); ctx.arc(sunX, sunY, 30, 0, Math.PI * 2); ctx.fill();
        // Add simple sun rays
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#fbbf24';
        for (let i = 0; i < 8; i++) {
            ctx.beginPath(); ctx.moveTo(sunX + Math.cos(i * Math.PI / 4) * 40, sunY + Math.sin(i * Math.PI / 4) * 40); ctx.lineTo(sunX + Math.cos(i * Math.PI / 4) * 55, sunY + Math.sin(i * Math.PI / 4) * 55); ctx.stroke();
        }
        ctx.font = '900 14px Inter, sans-serif'; ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.fillText('CLEAR WEATHER', sunX, sunY + 65);

        // 3. Mission Patch Watermark
        ctx.strokeStyle = 'rgba(255,255,255,0.4)';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(1050, 75, 50, 0, Math.PI * 2); ctx.stroke();
        ctx.font = '900 20px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${finalScore}%`, 1050, 75);
        ctx.font = 'bold 8px Inter, sans-serif';
        ctx.fillText('SAFETY SCORE', 1050, 90);

        // 4. Map Path Area
        if (actualPath.length > 1) {
            const lats = actualPath.map(p => p[0]);
            const lngs = actualPath.map(p => p[1]);
            const minLat = Math.min(...lats);
            const maxLat = Math.max(...lats);
            const minLng = Math.min(...lngs);
            const maxLng = Math.max(...lngs);

            const mapX = 100;
            const mapY = 200;
            const mapW = 1000;
            const mapH = 450;

            // Background for map
            ctx.fillStyle = '#ffffff';
            ctx.shadowColor = 'rgba(0,0,0,0.05)';
            ctx.shadowBlur = 40;
            ctx.beginPath(); ctx.roundRect(mapX, mapY, mapW, mapH, 40); ctx.fill();
            ctx.shadowBlur = 0;

            // Draw Color-Coded Path by Speed
            ctx.lineWidth = 8;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            const getX = (lng: number) => mapX + 50 + ((lng - minLng) / (maxLng - minLng || 1)) * (mapW - 100);
            const getY = (lat: number) => mapY + mapH - 50 - ((lat - minLat) / (maxLat - minLat || 1)) * (mapH - 100);

            for (let i = 1; i < actualPath.length; i++) {
                const p1 = actualPath[i - 1];
                const p2 = actualPath[i];
                const speed = p2[2]; // Speed in km/h

                // Speed Color Logic: Red (>80), Amber (<30), Indigo (Optimal)
                ctx.strokeStyle = speed > 80 ? '#ef4444' : speed < 30 ? '#f59e0b' : '#6366f1';

                ctx.beginPath();
                ctx.moveTo(getX(p1[1]), getY(p1[0]));
                ctx.lineTo(getX(p2[1]), getY(p2[0]));
                ctx.stroke();
            }
        }

        // 4.5 Speed Legend
        const legendX = 100;
        const legendY = 680;
        const legendItems = [
            { color: '#ef4444', label: 'Speeding (>80 km/h)' },
            { color: '#6366f1', label: 'Optimal (30-80 km/h)' },
            { color: '#f59e0b', label: 'Congested (<30 km/h)' }
        ];

        ctx.textAlign = 'left';
        ctx.font = 'bold 18px Inter, sans-serif';
        legendItems.forEach((item, i) => {
            const x = legendX + (i * 350);
            ctx.fillStyle = item.color;
            ctx.beginPath(); ctx.roundRect(x, legendY, 40, 10, 5); ctx.fill();
            ctx.fillStyle = '#94a3b8';
            ctx.fillText(item.label, x + 55, legendY + 10);
        });

        // 5. Statistics Grid
        const startY = 750;
        const stats = [
            { label: 'DISTANCE', value: `${safeTripKm?.toFixed(1)} KM` },
            { label: 'DURATION', value: `${durationMins} MINS` },
            { label: 'TOTAL CLIMB', value: `${totalClimb} M` },
            { label: 'TOTAL DESCENT', value: `${totalDescent} M` },
            { label: 'EFFICIENCY', value: `${efficiencyScore}%` },
            { label: 'DIFFICULTY', value: terrainStats.difficulty.toUpperCase() },
        ];

        ctx.textAlign = 'left';
        stats.forEach((s, i) => {
            const col = i % 3; // 3 columns
            const row = Math.floor(i / 3); // 2 rows
            const x = 80 + (col * 350); // Adjusted for 3 columns
            const y = startY + (row * 100); // Reduced row spacing

            ctx.fillStyle = '#94a3b8';
            ctx.font = '900 24px Inter, sans-serif';
            ctx.fillText(s.label, x, y);
            ctx.fillStyle = '#1e293b';
            ctx.font = '900 65px Inter, sans-serif';
            ctx.fillText(s.value, x, y + 70);
        });

        // 6. Trip Score Trend Sparkline
        if (scoreHistory && scoreHistory.length > 1) {
            const sparklineX = 100;
            const sparklineY = 970;
            const sparklineW = 1000;
            const sparklineH = 100;

            // Sparkline background
            ctx.fillStyle = '#ffffff';
            ctx.shadowColor = 'rgba(0,0,0,0.05)';
            ctx.shadowBlur = 20;
            ctx.beginPath(); ctx.roundRect(sparklineX, sparklineY, sparklineW, sparklineH, 20); ctx.fill();
            ctx.shadowBlur = 0;

            // Draw sparkline
            ctx.strokeStyle = '#6366f1';
            ctx.lineWidth = 4;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.beginPath();
            scoreHistory.forEach((h, i) => {
                const x = sparklineX + (i / (scoreHistory.length - 1)) * sparklineW;
                const y = sparklineY + sparklineH - (h.val / 100) * sparklineH; // Scale 0-100 to sparklineH
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            });
            ctx.stroke();

            // Sparkline labels
            ctx.fillStyle = '#94a3b8';
            ctx.font = 'bold 16px Inter, sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText('Start', sparklineX + 20, sparklineY + sparklineH + 25);
            ctx.textAlign = 'right';
            ctx.fillText('End', sparklineX + sparklineW - 20, sparklineY + sparklineH + 25);
            ctx.textAlign = 'center';
            ctx.fillText('TRIP SAFETY SCORE TREND', sparklineX + sparklineW / 2, sparklineY + sparklineH + 25);
        }

        // 7. QR Code Verification Section
        const verificationUrl = `https://merosadak.com/trip-verify/${Date.now()}`;
        const qrSize = 160;
        const qrX = 960;
        const qrY = 1100; // Adjusted position

        try {
            const qrImg = new Image();
            qrImg.crossOrigin = "anonymous";
            qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(verificationUrl)}`;

            await new Promise((resolve, reject) => {
                qrImg.onload = resolve;
                qrImg.onerror = reject;
            });

            ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);

            ctx.fillStyle = '#94a3b8';
            ctx.font = 'bold 12px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('VERIFY MISSION RECORD', qrX + qrSize / 2, qrY + qrSize + 25);
        } catch (e) {
            console.error("Failed to load QR code for sharing", e);
        }

        const link = document.createElement('a');
        link.download = `MeroSadak_Report_${Date.now()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    };

    const autoSaveToCloud = async (pdfBlob: Blob) => {
        const formData = new FormData();
        formData.append('certificate', pdfBlob, `MeroSadak_Trip_${Date.now()}.pdf`);

        try {
            await apiFetch('/v1/users/cloud-storage/upload', {
                method: 'POST',
                body: formData,
                isMultipart: true // Ensure your apiFetch handles FormData
            });
            console.log("[Cloud] Trip certificate backed up to Google Drive");
        } catch (err) {
            error("[Cloud] Backup failed: " + (err as Error).message);
        }
    };

    const handleDownloadCertificate = async (cloudSave = false) => {
        const rating = finalScore >= 90 ? 'Excellent' : finalScore >= 70 ? 'Good' : 'Needs Work';
        const date = new Date().toLocaleDateString();
        const time = new Date().toLocaleTimeString();
        const verificationUrl = `https://merosadak.com/trip-verify/${Date.now()}`;

        try {
            // Calculate cumulative elevation gain for the certificate
            const totalGain = actualPath.reduce((acc, curr, i, arr) => {
                if (i === 0) return 0;
                const diff = curr[3] - arr[i - 1][3];
                return diff > 0 ? acc + diff : acc;
            }, 0);
            const totalLoss = actualPath.reduce((acc, curr, i, arr) => {
                if (i === 0) return 0;
                const diff = curr[3] - arr[i - 1][3];
                return diff < 0 ? acc + Math.abs(diff) : acc;
            }, 0);

            const doc = new jsPDF();

            // Header
            doc.setFillColor(99, 102, 241);
            doc.rect(0, 0, 210, 40, 'F');

            doc.setTextColor(255, 255, 255);
            doc.setFontSize(24);
            doc.setFont("helvetica", "bold");
            doc.text("Safe Trip Summary", 20, 25);

            doc.setFontSize(10);
            doc.text(`Generated on ${date} at ${time}`, 20, 32);

            // 🛡️ Mission Patch Watermark
            doc.setDrawColor(255, 255, 255);
            doc.setLineWidth(0.5);
            doc.circle(180, 20, 15, 'S'); // Outer Ring

            doc.setLineDashPattern([1, 1], 0);
            doc.circle(180, 20, 13.5, 'S'); // Decorative Inner Ring
            doc.setLineDashPattern([], 0);

            doc.setFontSize(5);
            doc.text("PILOT MISSION", 180, 16, { align: "center" });
            doc.setFontSize(10);
            doc.text(`${finalScore}%`, 180, 22, { align: "center" });
            doc.setFontSize(4);
            doc.text("CERTIFIED SAFE", 180, 27, { align: "center" });
            doc.setFontSize(3);
            doc.text(`UNIT: ${(vehicleType || 'LAND').toUpperCase()}`, 180, 31, { align: "center" });

            // Body
            doc.setTextColor(30, 41, 59);
            doc.setFontSize(16);
            doc.text("Performance Analytics", 20, 60);

            doc.setDrawColor(226, 232, 240);
            doc.line(20, 65, 190, 65);

            doc.setFontSize(12);
            doc.setFont("helvetica", "normal");
            doc.text(`Overall Safety Score:`, 20, 80);
            doc.setFont("helvetica", "bold");
            doc.text(`${finalScore}%`, 70, 80);

            doc.setFont("helvetica", "normal");
            doc.text(`Safety Rating:`, 20, 90);
            doc.setFont("helvetica", "bold");
            doc.text(rating, 70, 90);

            doc.setFont("helvetica", "normal");
            doc.text(`Trip Duration:`, 20, 100);
            doc.setFont("helvetica", "bold");
            doc.text(`${durationMins} Minutes`, 70, 100);

            doc.setFont("helvetica", "normal");
            doc.text(`Total Elevation Loss:`, 20, 110);
            doc.setFont("helvetica", "bold");
            doc.text(`${Math.round(totalLoss)} Meters`, 70, 110);

            doc.setFont("helvetica", "normal");
            doc.text(`Total Elevation Gain:`, 20, 120);
            doc.setFont("helvetica", "bold");
            doc.text(`${Math.round(totalGain)} Meters`, 70, 120);

            // QR Code for authenticity
            doc.addImage(`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(verificationUrl)}`, "PNG", 160, 85, 30, 30);
            doc.setFontSize(7);
            doc.setTextColor(148, 163, 184);
            doc.text("VERIFY RECORD", 175, 118, { align: "center" });

            // Incident Log
            doc.setFontSize(16);
            doc.setTextColor(30, 41, 59);
            doc.text("Incident Log", 20, 135);
            doc.line(20, 140, 190, 140);

            doc.setFontSize(10);
            doc.setFont("helvetica", "normal");
            let currentY = 150;
            if (events.length === 0) {
                doc.text("No safety violations or recoveries recorded. Perfect mission status achieved.", 20, currentY);
            } else {
                events.forEach((event) => {
                    if (currentY > 270) {
                        doc.addPage();
                        currentY = 20;
                    }
                    const isPenalty = event.type === 'penalty';
                    doc.setTextColor(isPenalty ? 185 : 16, isPenalty ? 28 : 124, isPenalty ? 28 : 64);
                    doc.setFont("helvetica", "bold");
                    doc.text(isPenalty ? "[-]" : "[+]", 20, currentY);
                    doc.setTextColor(30, 41, 59);
                    doc.text(event.title || "Manual Entry", 30, currentY);
                    doc.setFont("helvetica", "normal");
                    doc.setFontSize(8);
                    doc.setTextColor(100, 116, 139);
                    doc.text(`${event.time} • Impact: ${event.score > 0 ? '+' : ''}${event.score} PTS`, 30, currentY + 5);
                    doc.setFontSize(10);
                    currentY += 12;
                });
            }

            // Branding Footer
            doc.setFontSize(8);
            doc.setTextColor(148, 163, 184);
            if (highwayCode) {
                doc.setFont("helvetica", "bold");
                doc.text(`MISSION CORRIDOR: ${highwayCode}`, 105, 275, { align: "center" });
                doc.setFont("helvetica", "normal");
            }
            doc.text("This is an automated safety report generated by the MeroSadak AI Pilot System.", 105, 280, { align: "center" });
            doc.text("Travel safely on Nepal's highways.", 105, 285, { align: "center" });

            if (cloudSave) {
                const pdfBlob = doc.output('blob');
                autoSaveToCloud(pdfBlob);
            }

            doc.save(`MeroSadak_Trip_${date.replace(/\//g, '-')}.pdf`);
        } catch (err) {
            error("[PDF] Trip report generation failed: " + (err as Error).message);
        }
    };

    return (
        <div className="fixed inset-0 z-[5000] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-300">
            <motion.div
                initial={{ scale: 0.8, opacity: 0, y: 50 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 200, damping: 15 }}
                className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl border border-white/20 dark:border-slate-800 flex flex-col max-h-[85vh] overflow-hidden"
            >

                {/* Header */}
                <div className="p-6 border-b border-outline/10 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-2xl bg-primary/10 text-primary">
                            <ShieldCheck size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-on-surface font-headline leading-tight">Safe Trip Report</h2>
                            <p className="text-xs text-on-surface-variant/60 font-medium">Session analysis for your recent drive</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-surface-container-low rounded-full transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Traveled Route Snapshot */}
                {actualPath.length > 0 ? (
                    <div className="px-6 py-2">
                        <div className="relative rounded-[2rem] overflow-hidden border border-outline/10 shadow-inner bg-slate-100 dark:bg-slate-800 h-44">
                            <MapContainer
                                center={actualPath[Math.floor(actualPath.length / 2)]}
                                zoom={13}
                                style={{ height: '100%', width: '100%' }}
                                zoomControl={false}
                                attributionControl={false}
                            >
                                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                                <Polyline positions={actualPath.slice(0, replayIndex).map(p => [p[0], p[1]])} color="#6366f1" weight={4} opacity={0.8} />

                                {/* Dynamic Replay HUD Overlay */}
                                {isReplaying && actualPath[replayIndex] && (
                                    <div className="absolute bottom-4 right-4 z-[1000] bg-slate-950/80 backdrop-blur-md p-3 rounded-2xl border border-white/10 flex gap-4 shadow-2xl">
                                        <div className="text-center">
                                            <span className="text-xl font-black text-indigo-400 tabular-nums">{actualPath[replayIndex][2]}</span>
                                            <p className="text-[7px] font-bold text-slate-500 uppercase">Speed</p>
                                        </div>
                                        <div className="w-px h-8 bg-white/10" />
                                        <div className="text-center">
                                            <span className="text-xl font-black text-emerald-400 tabular-nums">{actualPath[replayIndex][3]}</span>
                                            <p className="text-[7px] font-bold text-slate-500 uppercase">Altitude</p>
                                        </div>
                                    </div>
                                )}

                                {events.filter(e => {
                                    if (!e.lat || !e.lng) return false;
                                    // Only show penalties if the replay has reached their location
                                    const pathIdx = actualPath.findIndex(p => p[0] === e.lat && p[1] === e.lng);
                                    return pathIdx !== -1 && pathIdx <= replayIndex;
                                }).map((event, i) => (
                                    <Marker
                                        key={`event-${i}`}
                                        position={[event.lat, event.lng]}
                                        icon={L.divIcon({
                                            className: 'penalty-marker',
                                            html: `
                                                <div class="w-6 h-6 rounded-full bg-red-600 border-2 border-white flex items-center justify-center shadow-lg text-white">
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01"/></svg>
                                                </div>
                                            `
                                        })}
                                    >
                                        <Popup>
                                            <div className="p-2 font-bold text-xs">
                                                <p className="text-red-600 mb-1">SAFETY PENALTY</p>
                                                <p>{event.title}</p>
                                            </div>
                                        </Popup>
                                    </Marker>
                                ))}
                            </MapContainer>
                            <div className="absolute top-3 left-3 z-[1000] px-3 py-1.5 rounded-xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-md flex items-center gap-2 border border-outline/10 shadow-lg">
                                <Route size={12} className="text-indigo-500" />
                                <span className="text-[9px] font-black uppercase tracking-widest text-on-surface">Actual Trajectory</span>
                            </div>
                        </div>
                    </div>
                ) : staticMapUrl && (
                    <div className="px-6 py-2">
                        {/* Fallback to static map if no path points */}
                        <div className="relative rounded-3xl overflow-hidden border border-outline/10 shadow-inner bg-slate-100 dark:bg-slate-800 h-32">
                            <img src={staticMapUrl} alt="Trip Route" className="w-full h-full object-cover opacity-80" />
                        </div>
                    </div>
                )}

                {/* Safety Trendline Chart */}
                <div className="px-6">{renderTrendChart()}</div>

                {/* Summary Stats */}
                <div className="p-6 bg-surface-container-low/50 grid grid-cols-2 gap-4">
                    <div className="col-span-2 flex items-center justify-between bg-white dark:bg-slate-800 p-4 rounded-3xl shadow-sm border border-outline/5">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600">
                                <Fuel size={20} />
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-on-surface-variant/40 uppercase tracking-widest">Fuel Efficiency</p>
                                <p className="text-sm font-black text-on-surface uppercase">Eco-Drive Rating</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className={`text-lg font-black font-headline ${efficiencyScore >= 80 ? 'text-emerald-500' : 'text-amber-500'}`}>{efficiencyScore}%</p>
                            <p className="text-[8px] font-bold text-on-surface-variant/40 uppercase">Performance</p>
                        </div>
                    </div>
                    <div className="col-span-2 flex items-center justify-between bg-white dark:bg-slate-800 p-4 rounded-3xl shadow-sm border border-outline/5">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600">
                                <Mountain size={20} />
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-on-surface-variant/40 uppercase tracking-widest">Terrain Complexity</p>
                                <p className="text-sm font-black text-on-surface uppercase">{terrainStats.difficulty} Grade</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-lg font-black font-headline text-amber-600">{terrainStats.maxGrade}%</p>
                            <p className="text-[8px] font-bold text-on-surface-variant/40 uppercase">Max Incline</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4 bg-white dark:bg-slate-800 p-4 rounded-3xl shadow-sm border border-outline/5">
                        <SafetyScoreRing score={finalScore} size={60} strokeWidth={4} />
                        <div>
                            <p className="text-[10px] font-black text-on-surface-variant/40 uppercase tracking-widest">Safety Rating</p>
                            <p className={`text-lg font-black font-headline ${finalScore >= 80 ? 'text-emerald-500' : 'text-amber-500'}`}>
                                {finalScore >= 90 ? 'Excellent' : finalScore >= 70 ? 'Good' : 'Needs Work'}
                            </p>
                        </div>
                    </div>
                    <div className="flex flex-col justify-center bg-white dark:bg-slate-800 p-4 rounded-3xl shadow-sm border border-outline/5">
                        <div className="flex items-center gap-2 text-primary mb-1">
                            <Clock size={14} />
                            <span className="text-sm font-black font-headline">{durationMins} Mins</span>
                        </div>
                        <p className="text-[10px] font-black text-on-surface-variant/40 uppercase tracking-widest leading-none">Trip Duration</p>
                    </div>
                </div>

                {/* Event Logs */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                    <div>
                        <div className="flex items-center gap-2 mb-3 text-[10px] font-black text-on-surface-variant/40 uppercase tracking-[0.15em]">
                            <History size={12} /> Trip Events Log
                        </div>
                        {events.length === 0 ? (
                            <div className="py-10 text-center rounded-3xl border-2 border-dashed border-outline/10">
                                <p className="text-xs font-bold text-emerald-500 uppercase tracking-widest">Perfect Trip: No Warnings</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {events.map((event, i) => (
                                    <div key={i} className={`flex items-center justify-between p-3 rounded-2xl ${event.type === 'penalty' ? 'bg-error/5 border border-error/10' : 'bg-emerald-500/10 border border-emerald-500/20 shadow-sm'}`}>
                                        <div className="flex items-center gap-3">
                                            {event.type === 'penalty' ? <AlertTriangle size={14} className="text-error" /> : <ShieldCheck size={14} className="text-emerald-600 animate-pulse" />}
                                            <div>
                                                <p className="text-xs font-bold text-on-surface">{event.title}</p>
                                                <p className="text-[9px] font-medium text-on-surface-variant/60">{event.time}</p>
                                            </div>
                                        </div>
                                        <div className={`text-[10px] font-black ${event.type === 'penalty' ? 'text-error' : 'text-emerald-500'}`}>
                                            {event.score > 0 ? '+' : ''}{event.score} PTS
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer Action */}
                <div className="p-6 border-t border-outline/10 space-y-3">
                    <button
                        onClick={handleShareMission}
                        className="w-full py-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-500 text-sm font-black uppercase tracking-[0.2em] hover:bg-indigo-500 hover:text-white transition-all flex items-center justify-center gap-2"
                    >
                        <Share2 size={18} />
                        Share Mission Card
                    </button>
                    <button
                        onClick={handleShareReportImage}
                        className="w-full py-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 text-sm font-black uppercase tracking-[0.2em] hover:bg-emerald-500 hover:text-white transition-all flex items-center justify-center gap-2"
                    >
                        <Share2 size={18} />
                        Share Detailed Report Image
                    </button>
                    <button
                        onClick={handleShareReport}
                        className="w-full py-4 rounded-2xl bg-tertiary text-white text-sm font-black uppercase tracking-[0.2em] shadow-lg shadow-tertiary/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                        <Share2 size={18} />
                        Share Trip Report
                    </button>
                    <button
                        onClick={handleDownloadCertificate}
                        className="w-full py-4 rounded-2xl bg-indigo-600 text-white text-sm font-black uppercase tracking-[0.2em] shadow-lg shadow-indigo-500/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                        <FileBadge size={18} />
                        Download Certificate
                    </button>
                    <button
                        onClick={onClose}
                        className="w-full py-4 rounded-2xl bg-primary text-white text-sm font-black uppercase tracking-[0.2em] shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
                    >
                        Dismiss Analysis
                    </button>
                </div>
            </motion.div>
        </div>
    );
};