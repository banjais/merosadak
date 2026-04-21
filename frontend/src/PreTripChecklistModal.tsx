import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, Car, MapPin, AlertTriangle, Fuel, BatteryCharging, FirstAid, Wrench } from 'lucide-react';
import { useEscapeKey } from './hooks/useEscapeKey';

interface ChecklistItem {
    id: string;
    label: string;
    icon: React.ElementType;
    required: boolean;
    context?: string;
}

interface PreTripChecklistModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    tripDistance: number;
    checklistItems: ChecklistItem[];
}

export const PreTripChecklistModal: React.FC<PreTripChecklistModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    tripDistance,
    checklistItems,
}) => {
    const [shouldRender, setShouldRender] = useState(isOpen);
    const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});

    useEffect(() => {
        if (isOpen) {
            setShouldRender(true);
            setCheckedItems({}); // Reset checklist when opening
        } else {
            const timer = setTimeout(() => setShouldRender(false), 300);
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    useEscapeKey(onClose);

    if (!shouldRender) return null;

    const handleCheck = (id: string) => {
        setCheckedItems(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const allRequiredChecked = checklistItems
        .filter(item => item.required)
        .every(item => checkedItems[item.id]);

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[4500] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md"
                >
                    <motion.div
                        initial={{ scale: 0.8, opacity: 0, y: 50 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.8, opacity: 0, y: 50 }}
                        transition={{ type: "spring", stiffness: 200, damping: 15 }}
                        className="w-full max-w-md bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl border border-white/20 dark:border-slate-800 flex flex-col max-h-[85vh] overflow-hidden"
                    >
                        {/* Header */}
                        <div className="p-6 border-b border-outline/10 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 rounded-2xl bg-primary/10 text-primary">
                                    <CheckCircle size={24} />
                                </div>
                                <div>
                                    <h2 className="text-xl font-black text-on-surface font-headline leading-tight">Pre-Trip Checklist</h2>
                                    <p className="text-xs text-on-surface-variant/60 font-medium">For your {tripDistance.toFixed(0)} km journey</p>
                                </div>
                            </div>
                            <button onClick={onClose} className="p-2 hover:bg-surface-container-low rounded-full transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        {/* Checklist Items */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-4">
                            {checklistItems.map(item => (
                                <div
                                    key={item.id}
                                    className="flex items-center gap-4 p-4 rounded-2xl bg-surface-container-low border border-outline/10 cursor-pointer"
                                    onClick={() => handleCheck(item.id)}
                                >
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${checkedItems[item.id] ? 'bg-emerald-500 text-white' : 'bg-outline/10 text-on-surface-variant'}`}>
                                        {checkedItems[item.id] ? <CheckCircle size={16} /> : <item.icon size={16} />}
                                    </div>
                                    <span className={`flex-1 text-sm font-bold ${checkedItems[item.id] ? 'text-on-surface line-through opacity-70' : 'text-on-surface'}`}>
                                        {item.label} {item.required && <span className="text-red-500">*</span>}
                                    </span>
                                </div>
                            ))}
                        </div>

                        {/* Footer */}
                        <div className="p-6 border-t border-outline/10">
                            <button
                                onClick={onConfirm}
                                disabled={!allRequiredChecked}
                                className="w-full py-4 rounded-2xl bg-primary text-white text-sm font-black uppercase tracking-[0.2em] shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Confirm & Start Pilot Mode
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};