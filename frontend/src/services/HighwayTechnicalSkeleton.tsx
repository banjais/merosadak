import React from 'react';

/**
 * Skeleton loader for the Highway Technical Dashboard.
 * Mimics the layout of InfoBoard's highway context view.
 */
export const HighwayTechnicalSkeleton: React.FC = () => {
    return (
        <div className="p-6 space-y-8 animate-pulse bg-slate-50 dark:bg-slate-950 h-full">
            {/* Header Skeleton: Title and Icon */}
            <div className="flex items-center justify-between">
                <div className="space-y-2">
                    <div className="h-8 w-48 bg-slate-200 dark:bg-slate-800/80 rounded-2xl" />
                    <div className="h-4 w-32 bg-slate-100 dark:bg-slate-900/50 rounded-md" />
                </div>
                <div className="h-12 w-12 bg-slate-200 dark:bg-slate-800/80 rounded-2xl" />
            </div>

            {/* Primary Stats Grid: Length, Segments, Year, Quality */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="p-5 rounded-[2rem] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3 shadow-sm">
                        <div className="h-3 w-16 bg-slate-200 dark:bg-slate-800 rounded-full" />
                        <div className="h-6 w-20 bg-slate-300 dark:bg-slate-700/50 rounded-xl" />
                    </div>
                ))}
            </div>

            {/* Technical Charts/Progress Bars Section: Pavement & Condition */}
            <div className="space-y-6">
                <div className="space-y-3">
                    <div className="flex justify-between items-center">
                        <div className="h-4 w-32 bg-slate-200 dark:bg-slate-800 rounded-full" />
                        <div className="h-3 w-12 bg-slate-100 dark:bg-slate-900/50 rounded-full" />
                    </div>
                    <div className="h-3 w-full bg-slate-100 dark:bg-slate-900 rounded-full overflow-hidden border border-slate-200/50 dark:border-slate-800/50">
                        <div className="h-full w-2/3 bg-primary/10 dark:bg-primary/20" />
                    </div>
                </div>

                <div className="space-y-3">
                    <div className="flex justify-between items-center">
                        <div className="h-4 w-40 bg-slate-200 dark:bg-slate-800 rounded-full" />
                        <div className="h-3 w-12 bg-slate-100 dark:bg-slate-900/50 rounded-full" />
                    </div>
                    <div className="h-3 w-full bg-slate-100 dark:bg-slate-900 rounded-full overflow-hidden border border-slate-200/50 dark:border-slate-800/50">
                        <div className="h-full w-1/2 bg-slate-200 dark:bg-slate-800/60" />
                    </div>
                </div>
            </div>

            {/* Incident Status Section */}
            <div className="p-6 rounded-[2rem] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm">
                <div className="h-4 w-24 bg-slate-200 dark:bg-slate-800 rounded-full" />
                <div className="flex gap-2">
                    <div className="h-8 w-20 bg-slate-200 dark:bg-slate-800 rounded-full" />
                    <div className="h-8 w-20 bg-slate-200 dark:bg-slate-800 rounded-full" />
                </div>
            </div>

            {/* Details List Fallback */}
            <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="flex justify-between items-center">
                        <div className="h-3 w-24 bg-slate-100 dark:bg-slate-900/50 rounded-full" />
                        <div className="h-3 w-32 bg-slate-200 dark:bg-slate-800/60 rounded-full" />
                    </div>
                ))}
            </div>
        </div>
    );
};