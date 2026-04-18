// src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { TranslationProvider } from './i18n';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error("Root element not found");

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <TranslationProvider>
      <App />
    </TranslationProvider>
  </React.StrictMode>
);

window.addEventListener('unhandledrejection', (event) => {
  console.warn('Network/Map Data Error:', event.reason);
  event.preventDefault();
});

// Service Worker Management - Production Only
// Check if we should enable service worker
const ENABLE_SW = import.meta.env.PROD && import.meta.env.VITE_ENABLE_SW !== 'false';

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    if (ENABLE_SW) {
      // Register service worker for PWA + offline support (Production only)
      navigator.serviceWorker.register('/sw.js', { scope: '/' })
        .then(reg => {
          console.log('[SW] Registered:', reg.scope);

          // Check for updates automatically every time the page is loaded
          reg.update();

          // Listen for the point at which a new service worker is discovered
          reg.onupdatefound = () => {
            const newWorker = reg.installing;
            if (newWorker) {
              newWorker.onstatechange = () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  // New content is available; force skip waiting and reload
                  newWorker.postMessage({ type: 'SKIP_WAITING' });
                }
              };
            }
          };

          // Handle the case where a new worker is waiting - force it to take over
          if (reg.waiting) {
            reg.waiting.postMessage({ type: 'SKIP_WAITING' });
          }

          // Important: Reload the page when the new Service Worker takes over
          let refreshing = false;
          navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (refreshing) return;
            refreshing = true;
            console.log('[SW] New version detected - Refreshing page...');
            window.location.reload();
          });
        })
        .catch(err => console.warn('[SW] Registration failed:', err));
    } else {
      // Dev mode: Unregister any existing service workers
      navigator.serviceWorker.getRegistrations().then(registrations => {
        for (const registration of registrations) {
          registration.unregister();
          console.log('[SW] Unregistered for dev mode');
        }
      });
    }
  });
}
