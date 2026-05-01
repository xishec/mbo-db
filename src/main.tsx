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

// Register service worker AFTER app is mounted to avoid blocking initial hydration
// Using window load event ensures React has attached event handlers before SW can intercept
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const updateSW = registerSW({
      onNeedRefresh() {
        if (confirm('New version available! Reload to update?')) {
          updateSW(true).then(() => {
            window.location.reload();
          });
        }
      },
      onOfflineReady() {
        console.log('App ready to work offline');
      },
    });
  });
}
