import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HeroUIProvider, ToastProvider } from '@heroui/react'
import './index.css'
import App from './App.tsx'
import { registerSW } from 'virtual:pwa-register'

// Render React app first so event handlers attach before any SW interaction
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HeroUIProvider>
      <ToastProvider placement="top-right" />
      <App />
    </HeroUIProvider>
  </StrictMode>,
)

// Register service worker AFTER app is mounted to avoid blocking initial hydration.
// Using window load event ensures React has attached event handlers before SW can intercept.
//
// autoUpdate mode: the new SW calls skipWaiting + clientsClaim on its own.
// We listen for controllerchange and reload so the HTML stops running the
// old build's JS before any lazy chunk fetch hits the new SW's precache
// (which only holds new-hashed chunks) and 404s. Refresh is keyed off a
// guard so the very first controller (cold load, no previous SW) doesn't
// trigger a pointless reload.
if ('serviceWorker' in navigator) {
  // Capture before register() so the first-install case (no prior controller)
  // is distinguishable from a real update. Inside the handler, .controller
  // already reflects the new SW, so we can't check it there.
  const hadControllerAtLoad = !!navigator.serviceWorker.controller;

  window.addEventListener('load', () => {
    registerSW({ immediate: true });

    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      // First install on a fresh tab — the new SW is claiming a page that
      // already has its matching chunks. Nothing to reload for.
      if (!hadControllerAtLoad) return;
      refreshing = true;
      window.location.reload();
    });
  });
}
