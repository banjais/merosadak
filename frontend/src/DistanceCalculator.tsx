import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X, Ruler, Trash2, Undo2, Share2, Mountain,
    MapPin, Hospital, Zap, AlertTriangle, Loader2,
    Target, ShieldAlert
} from 'lucide-react';
import { L } from './lib/leaflet';

interface DistanceCalculatorProps {
    isOpen: boolean;
    points: L.LatLng[];
    elevationData: number[];
    nearestIntersectionDist: number | null;
    nearestHospitalDist: number | null;
    roadQuality?: string;
    vehicleType?: string;
    customTankCapacity?: number;
    landslideSeverity: string;
    onSeverityChange: (val: string) => void;
    trafficIntensity: number;
    onTrafficChange: (val: number) => void;
    fuelPrice: number;
    isGreenRoute: boolean;
    onToggleGreenRoute: () => void;
    pathAnalytics: {
        duration: number;
        delay: number;
        landslides: number;
        hazards?: any[];
        provinceStats?: Array<{ name: string; avgQuality: number; distanceKm: number }>;
    } | null;
    comparisonData: any[];
    userElevation?: number;
    batteryLevel: number | null;
    isNightVision: boolean;
    isHighContrast: boolean;
    isLoading: boolean;
    onClose: () => void;
    onClear: () => void;
    onUndo: () => void;
    onShare: () => void;
    isSnapping: boolean;
    onToggleSnap: () => void;
    isSmoothing?: boolean;
    onToggleSmoothing?: () => void;
    isEmergencyMode: boolean;
    onToggleEmergency: () => void;
    onAvoidLandslides: () => void;
    onHoverPointChange?: (point: L.LatLng | null, elevation: number | null, grade: number | null, bearing: number | null, roll: number | null) => void;
}

export const DistanceCalculator: React.FC<DistanceCalculatorProps> = ({
    isOpen,
    points,
    elevationData,
    nearestIntersectionDist,
    nearestHospitalDist,
    landslideSeverity,
    pathAnalytics,
    isLoading,
    onClose,
    onClear,
    onUndo,
    onShare,
    isSnapping,
    onToggleSnap,
    isSmoothing,
    onToggleSmoothing,
    isEmergencyMode,
    onToggleEmergency,
    onAvoidLandslides,
    onHoverPointChange
}) => {
    const totalDistance = points.reduce((acc, point, index) => {
        if (index === 0) return 0;
        return acc + points[index - 1].distanceTo(point) / 1000;
    }, 0);

    const [hoverData, setHoverData] = useState<{ x: number, elev: number, y: number } | null>(null);

    const sparklinePath = useMemo(() => {
        if (!elevationData || elevationData.length < 2) return "";
        const min = Math.min(...elevationData);
        const max = Math.max(...elevationData);
        const range = max - min || 1;
        const width = 100;
        const height = 30;

        return elevationData.map((y, i) => {
            const x = (i / (elevationData.length - 1)) * width;
            const normalizedY = height - ((y - min) / range) * height;
            return `${i === 0 ? 'M' : 'L'} ${x} ${normalizedY}`;
        }).join(" ");
    }, [elevationData]);

    const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
        if (!elevationData || elevationData.length < 2) return;
        const svg = e.currentTarget;
        const rect = svg.getBoundingClientRect();
        const xPercent = (e.clientX - rect.left) / rect.width;
        const index = Math.round(xPercent * (elevationData.length - 1));
        const clampedIndex = Math.max(0, Math.min(index, elevationData.length - 1));

        const min = Math.min(...elevationData);
        const max = Math.max(...elevationData);
        const range = max - min || 1;
        const height = 30;

        setHoverData({
            x: (clampedIndex / (elevationData.length - 1)) * 100,
            elev: elevationData[clampedIndex],
            y: height - ((elevationData[clampedIndex] - min) / range) * height
        });

        let grade: number | null = null;
        let bearing: number | null = null;
        let roll: number | null = null;

        if (clampedIndex < points.length - 1) {
            const p1 = points[clampedIndex];
            const p2 = points[clampedIndex + 1];
            const dist = p1.distanceTo(p2); // Distance in meters

            if (dist > 0) {
                const elevDiff = elevationData[clampedIndex + 1] - elevationData[clampedIndex];
                grade = (elevDiff / dist) * 100;

                // Simple bearing calculation for HUD rotation
                const rad = Math.PI / 180;
                const y = Math.sin((p2.lng - p1.lng) * rad) * Math.cos(p2.lat * rad);
                const x = Math.cos(p1.lat * rad) * Math.sin(p2.lat * rad) -
                    Math.sin(p1.lat * rad) * Math.cos(p2.lat * rad) * Math.cos((p2.lng - p1.lng) * rad);
                bearing = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;

                // Calculate Roll (Centripetal Simulation) based on bearing delta to the next segment
                if (clampedIndex < points.length - 2) {
                    const p3 = points[clampedIndex + 2];
                    const y2 = Math.sin((p3.lng - p2.lng) * rad) * Math.cos(p3.lat * rad);
                    const x2 = Math.cos(p2.lat * rad) * Math.sin(p3.lat * rad) -
                        Math.sin(p2.lat * rad) * Math.cos(p3.lat * rad) * Math.cos((p3.lng - p2.lng) * rad);
                    const nextBearing = (Math.atan2(y2, x2) * 180 / Math.PI + 360) % 360;

                    let diff = nextBearing - bearing;
                    if (diff > 180) diff -= 360;
                    if (diff < -180) diff += 360;

                    // Roll is proportional to turn sharpness per meter
                    roll = (diff / dist) * 100;
                }
            }
        }

        if (onHoverPointChange && points[clampedIndex]) {
            onHoverPointChange(points[clampedIndex], elevationData[clampedIndex], grade, bearing, roll);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ x: '100%', opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: '100%', opacity: 0 }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    className="fixed right-4 top-24 bottom-32 w-80 z-[1500] bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl rounded-[2.5rem] border border-white/20 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden"
                >
                    {/* Header */}
                    <div className="p-6 border-b border-outline/10 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className={`p-2.5 rounded-2xl ${isEmergencyMode ? 'bg-error/10 text-error' : 'bg-primary/10 text-primary'}`}>
                                {isEmergencyMode ? <ShieldAlert size={20} /> : <Ruler size={20} />}
                            </div>
                            <div>
                                <h3 className="text-sm font-black text-on-surface uppercase tracking-[0.1em] font-headline">Path Analyzer</h3>
                                <p className="text-[10px] text-on-surface-variant/60 font-bold uppercase tracking-tighter">{points.length} waypoints selected</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-surface-container-low rounded-full transition-colors text-on-surface-variant">
                            <X size={20} />
                        </button>
                    </div>

                    {/* Body */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-none">
                        {/* Distance & Terrain Grid */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="p-4 rounded-3xl bg-surface-container-low border border-outline/5">
                                <span className="text-[9px] font-black text-on-surface-variant/40 uppercase tracking-widest block mb-1">Total Distance</span>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-2xl font-black text-primary font-headline">{totalDistance.toFixed(2)}</span>
                                    <span className="text-[10px] font-bold text-on-surface-variant">KM</span>
                                </div>
                            </div>
                            <div className="p-4 rounded-3xl bg-surface-container-low border border-outline/5">
                                <span className="text-[9px] font-black text-on-surface-variant/40 uppercase tracking-widest block mb-1">Terrain Profile</span>
                                <div className="flex items-center gap-2">
                                    {isLoading ? <Loader2 size={16} className="text-primary animate-spin" /> : <Mountain size={16} className="text-amber-500" />}
                                    <span className="text-xs font-bold text-on-surface">
                                        {isLoading ? 'Analyzing...' : elevationData.length > 0 ? 'Data Synced' : 'Ready'}
                                    </span>
                                </div>
                                {elevationData.length > 1 && (
                                    <div className="mt-2 h-8 w-full">
                                        <svg
                                            viewBox="0 0 100 30"
                                            preserveAspectRatio="none"
                                            className="w-full h-full overflow-visible cursor-crosshair"
                                            onMouseMove={handleMouseMove}
                                            onMouseLeave={() => {
                                                setHoverData(null);
                                                if (onHoverPointChange) onHoverPointChange(null, null, null, null, null);
                                            }}
                                        >
                                            <path
                                                d={`${sparklinePath} L 100 30 L 0 30 Z`}
                                                className="fill-amber-500/10"
                                            />
                                            <path
                                                d={sparklinePath}
                                                className="stroke-amber-500 fill-none"
                                                strokeWidth="2"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            />
                                            {hoverData && (
                                                <g>
                                                    <line
                                                        x1={hoverData.x} y1="0" x2={hoverData.x} y2="30"
                                                        stroke="currentColor" strokeWidth="0.5" strokeDasharray="1,1"
                                                        className="text-on-surface-variant/30"
                                                    />
                                                    <circle
                                                        cx={hoverData.x} cy={hoverData.y} r="1.5"
                                                        className="fill-amber-500 stroke-white dark:stroke-slate-900"
                                                        strokeWidth="0.5"
                                                    />
                                                    <text
                                                        x={hoverData.x > 80 ? hoverData.x - 2 : hoverData.x + 2}
                                                        y={hoverData.y - 4}
                                                        className="text-[4px] font-black fill-amber-600 dark:fill-amber-400"
                                                        textAnchor={hoverData.x > 80 ? "end" : "start"}
                                                    >
                                                        {Math.round(hoverData.elev)}m
                                                    </text>
                                                </g>
                                            )}
                                        </svg>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Dynamic Context Alerts */}
                        <div className="space-y-2">
                            {nearestIntersectionDist !== null && (
                                <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-primary/5 text-primary border border-primary/10">
                                    <Target size={16} />
                                    <span className="text-[11px] font-bold">Nearest Junction: {nearestIntersectionDist.toFixed(2)} km</span>
                                </div>
                            )}
                            {nearestHospitalDist !== null && (
                                <div className={`flex items-center gap-3 p-3.5 rounded-2xl border transition-all ${nearestHospitalDist < 2 ? 'bg-error/10 text-error border-error/20 animate-pulse' : 'bg-error/5 text-error border-error/10'}`}>
                                    <Hospital size={16} />
                                    <span className="text-[11px] font-bold">Emergency Care: {nearestHospitalDist.toFixed(2)} km</span>
                                </div>
                            )}
                        </div>

                        {/* Manual Overrides */}
                        <div className="space-y-3 pt-2">
                            <div className="flex items-center justify-between p-1">
                                <span className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">Road Snapping</span>
                                <button
                                    onClick={onToggleSnap}
                                    className={`w-10 h-5 rounded-full transition-colors relative ${isSnapping ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-700'}`}
                                >
                                    <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${isSnapping ? 'right-1' : 'left-1'}`} />
                                </button>
                            </div>
                            <div className="flex items-center justify-between p-1">
                                <span className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">Route Smoothing</span>
                                <button
                                    onClick={onToggleSmoothing}
                                    className={`w-10 h-5 rounded-full transition-colors relative ${isSmoothing ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-700'}`}
                                >
                                    <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${isSmoothing ? 'right-1' : 'left-1'}`} />
                                </button>
                            </div>
                        </div>

                        {/* Province-level Summary */}
                        {pathAnalytics?.provinceStats && pathAnalytics.provinceStats.length > 0 && (
                            <div className="space-y-3 pt-2">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">Regional Quality Summary</span>
                                </div>
                                <div className="space-y-2">
                                    {pathAnalytics.provinceStats.map((stat, idx) => (
                                        <div key={idx} className="p-3 rounded-2xl bg-surface-container-low border border-outline/5 flex items-center justify-between group hover:bg-surface-container-low/80 transition-colors">
                                            <div className="flex flex-col text-left">
                                                <span className="text-[11px] font-bold text-on-surface">{stat.name}</span>
                                                <span className="text-[9px] text-on-surface-variant/60">{stat.distanceKm.toFixed(1)} km cross-section</span>
                                            </div>
                                            <div className="flex flex-col items-end">
                                                <span className={`text-[10px] font-black ${stat.avgQuality >= 70 ? 'text-emerald-500' : stat.avgQuality >= 40 ? 'text-amber-500' : 'text-error'}`}>
                                                    Grade {stat.avgQuality >= 80 ? 'A' : stat.avgQuality >= 60 ? 'B' : 'C'}
                                                </span>
                                                <div className="w-12 h-1 bg-outline/10 rounded-full mt-1 overflow-hidden">
                                                    <div
                                                        className={`h-full ${stat.avgQuality >= 70 ? 'bg-emerald-500' : stat.avgQuality >= 40 ? 'bg-amber-500' : 'bg-error'}`}
                                                        style={{ width: `${stat.avgQuality}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Landslide Protection */}
                        {pathAnalytics && pathAnalytics.landslides > 0 && (
                            <button
                                onClick={onAvoidLandslides}
                                className="w-full p-4 rounded-3xl bg-amber-500/10 border border-amber-500/20 text-amber-600 flex items-center justify-between group hover:bg-amber-500/20 transition-all"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-xl bg-amber-500 text-white shadow-lg shadow-amber-500/30">
                                        <AlertTriangle size={18} />
                                    </div>
                                    <div className="text-left">
                                        <p className="text-[10px] font-black uppercase tracking-widest">Terrain Hazard</p>
                                        <p className="text-[11px] font-bold">{pathAnalytics.landslides} Active Landslides</p>
                                    </div>
                                </div>
                                <Zap size={16} className="text-amber-500 animate-pulse" />
                            </button>
                        )}
                    </div>

                    {/* Action Footer */}
                    <div className="p-6 border-t border-outline/10 bg-surface-container-low/50 backdrop-blur-md">
                        <div className="flex gap-2">
                            <button onClick={onUndo} disabled={points.length === 0} title="Undo last point" className="p-4 rounded-2xl border border-outline/10 bg-white dark:bg-slate-800 text-on-surface hover:bg-surface-container-low transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                                <Undo2 size={20} />
                            </button>
                            <button onClick={onClear} disabled={points.length === 0} title="Clear path" className="p-4 rounded-2xl border border-outline/10 bg-white dark:bg-slate-800 text-error hover:bg-error/5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                                <Trash2 size={20} />
                            </button>
                            <button
                                onClick={onShare}
                                disabled={points.length < 2}
                                className="flex-1 py-4 rounded-2xl bg-primary text-white text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                <Share2 size={16} /> Share Path
                            </button>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};