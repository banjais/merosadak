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
        .then(reg => console.log('[SW] Registered:', reg.scope))
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
