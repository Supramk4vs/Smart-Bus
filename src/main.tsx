import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Tier 1: Maps JavaScript API & Map Loading Level Quota Tap
(window as any).gm_authFailure = () => {
  window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
};

const origError = console.error;
console.error = (...args: unknown[]) => {
  const msg = args.map((a) => String(a)).join(' ');
  if (
    msg.includes('OverQuotaMapError') ||
    msg.includes('QuotaExceededError') ||
    msg.includes('OVER_QUERY_LIMIT') ||
    msg.includes('exceeded your daily request quota') ||
    msg.includes('DIRECTIONS_ROUTE') ||
    msg.includes('Directions request failed') ||
    msg.includes('_leaflet_pos')
  ) {
    window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
    return;
  }
  origError.apply(console, args);
};

window.addEventListener('error', (event) => {
  const msg = String(event.message || event.error || '');
  if (
    msg.includes('_leaflet_pos') ||
    msg.includes('OVER_QUERY_LIMIT') ||
    msg.includes('DIRECTIONS_ROUTE') ||
    msg.includes('Directions request failed') ||
    msg.includes('exceeded your daily request quota')
  ) {
    event.preventDefault();
    event.stopImmediatePropagation();
    window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
