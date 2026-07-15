import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
// Side-effect import: registers the beforeinstallprompt capture before React mounts
import './hooks/useInstallPrompt';

// PWA: no-op service worker satisfies install criteria (PROD only — dev must
// never run under a controller).
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
import App from './App';
import { ThemeProvider } from './context/ThemeContext';
import { NavigationProvider } from './context/NavigationContext';
import { UserProvider } from './context/UserContext';
import { MondayDataProvider } from './context/MondayDataContext';
import { ToastProvider } from './components/common/ToastProvider';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <ToastProvider>
        <UserProvider>
          <MondayDataProvider>
            <NavigationProvider>
              <App />
            </NavigationProvider>
          </MondayDataProvider>
        </UserProvider>
      </ToastProvider>
    </ThemeProvider>
  </StrictMode>
);
