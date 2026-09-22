import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { ErrorBoundary } from './components/ErrorBoundary';
import { TextScaleProvider } from './hooks/useTextScale';
import { setupAutomaticUpdates } from './utils/appUpdate';

if (typeof window !== 'undefined') {
  void setupAutomaticUpdates();
  window.addEventListener('unhandledrejection', (event) => {
    console.error('[Mero Sadak] Unhandled promise rejection:', event.reason);
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <TextScaleProvider>
        <App />
      </TextScaleProvider>
    </ErrorBoundary>
  </StrictMode>,
);
