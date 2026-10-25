import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RefreshCw } from 'lucide-react';
import App from './App';
import { toast } from './lib/events';
import './index.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Service worker: production only (avoids stale caches while developing).
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    const hadController = Boolean(navigator.serviceWorker.controller);
    navigator.serviceWorker.register('./sw.js').catch((err) => console.warn('SW registration failed', err));
    // A new deploy took over → offer a one-tap reload
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController) return;
      toast({ message: 'A new version is ready', icon: RefreshCw, action: 'Reload', onAction: () => location.reload(), duration: 15000 });
    });
  });
}
