import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
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
