// src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { TranslationProvider } from './i18n';
import './index.css';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Make Leaflet available globally for plugins
window.L = L;

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
