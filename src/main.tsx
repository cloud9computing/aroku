import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './styles/index.css';

// Register Service Worker for PWA
if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('Service Worker registration failed:', err);
    });
  });

  // A stale page's JS keeps running even after a newer Service Worker takes
  // over in the background — reload once so a device stuck on an old cached
  // build (e.g. from before this app had sign-in/sync) recovers on its own.
  let hasReloadedForUpdate = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hasReloadedForUpdate) return;
    hasReloadedForUpdate = true;
    window.location.reload();
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
