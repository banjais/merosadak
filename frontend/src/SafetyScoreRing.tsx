import React from 'react';

interface SafetyScoreRingProps {
    score: number;
    size?: number;
    strokeWidth?: number;
}

export const SafetyScoreRing: React.FC<SafetyScoreRingProps> = ({
    score,
    size = 80,
    strokeWidth = 6
}) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - (score / 100) * circumference;

    // Dynamic Color Logic: Transitions based on safety thresholds
    const getColor = (s: number) => {
        if (s >= 80) return '#10b981'; // Emerald (Safe)
        if (s >= 50) return '#f59e0b'; // Amber (Warning)
        return '#ef4444'; // Red (Critical)
    };

    const color = getColor(score);

    return (
        <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
            <svg width={size} height={size} className="transform -rotate-90 drop-shadow-sm">
                {/* Background Track */}
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke="currentColor"
                    strokeWidth={strokeWidth}
                    fill="transparent"
                    className="text-slate-200/50 dark:text-slate-800/50"
                />
                {/* Animated Progress Ring */}
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke={color}
                    strokeWidth={strokeWidth}
                    fill="transparent"
                    strokeDasharray={circumference}
                    style={{
                        strokeDashoffset: offset,
                        transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1), stroke 0.5s ease',
                        strokeLinecap: 'round'
                    }}
                />
            </svg>
            {/* Inner Label */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-black font-headline leading-none" style={{ color }}>
                    {Math.round(score)}
                </span>
                <span className="text-[7px] font-black text-on-surface-variant/40 uppercase tracking-widest mt-0.5">Score</span>
            </div>
        </div>
    );
};