import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HeroUIProvider, ToastProvider } from '@heroui/react'
import './index.css'
import App from './App.tsx'
import { registerSW } from 'virtual:pwa-register'

// Prompt user before reloading on service worker update
const updateSW = registerSW({
  onNeedRefresh() {
    // New version available - show confirmation
    if (confirm('New version available! Reload to update?')) {
      updateSW(true); // Reload the page
    }
    // If user clicks "Cancel", do nothing - they can reload manually later
  },
  onOfflineReady() {
    console.log('App ready to work offline');
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HeroUIProvider>
      <ToastProvider placement="top-right" />
      <App />
    </HeroUIProvider>
  </StrictMode>,
)
