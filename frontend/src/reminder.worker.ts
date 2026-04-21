/* eslint-disable no-restricted-globals */

/**
 * Reminder Web Worker
 * Handles background timing for reminders to prevent throttle-induced delays
 * in background tabs.
 */

let checkInterval: any = null;

self.onmessage = (e: MessageEvent) => {
    const { type, payload } = e.data;

    if (type === 'START_CHECKING') {
        if (checkInterval) clearInterval(checkInterval);

        checkInterval = setInterval(() => {
            const now = new Date();
            const currentTime = now.toLocaleTimeString('en-US', {
                hour12: false,
                hour: '2-digit',
                minute: '2-digit'
            });
            const currentSeconds = now.getSeconds();
            const currentDay = now.getDay();

            self.postMessage({
                type: 'TICK',
                currentTime,
                currentSeconds,
                currentDay
            });
        }, 15000); // Check every 15 seconds
    }
};