import React, { createContext, useState, useContext, useCallback } from 'react';
import { ToastContainer, Toast as ToastType } from './components/Toast'; // Import ToastType from the component file

interface ToastContextType {
    addToast: (type: ToastType['type'], message: string, duration?: number) => string;
    removeToast: (id: string) => void;
    success: (message: string, duration?: number) => string;
    error: (message: string, duration?: number) => string;
    info: (message: string, duration?: number) => string;
    warning: (message: string, duration?: number) => string;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<ToastType[]>([]);

    const addToast = useCallback((type: ToastType['type'], message: string, duration = 4000) => {
        const id = Math.random().toString(36).substr(2, 9);
        const newToast: ToastType = { id, type, message, duration };
        setToasts((prev) => [...prev, newToast]);

        // Add haptic feedback for alerts
        if ('vibrate' in navigator) {
            if (type === 'error') navigator.vibrate([50, 100, 50]);
            else if (type === 'warning') navigator.vibrate(50);
        }

        if (duration > 0) {
            setTimeout(() => removeToast(id), duration);
        }
        return id;
    }, []);

    const removeToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    const success = useCallback((message: string, duration?: number) => addToast('success', message, duration), [addToast]);
    const error = useCallback((message: string, duration?: number) => addToast('error', message, duration), [addToast]);
    const info = useCallback((message: string, duration?: number) => addToast('info', message, duration), [addToast]);
    const warning = useCallback((message: string, duration?: number) => addToast('warning', message, duration), [addToast]);

    return (
        <ToastContext.Provider value={{ addToast, removeToast, success, error, info, warning }}>
            {children}
            <ToastContainer toasts={toasts} onRemove={removeToast} />
        </ToastContext.Provider>
    );
};

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
};

export default useToast;