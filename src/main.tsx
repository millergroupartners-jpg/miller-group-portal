import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { ThemeProvider } from './context/ThemeContext';
import { NavigationProvider } from './context/NavigationContext';
import { UserProvider } from './context/UserContext';
import { MondayDataProvider } from './context/MondayDataContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <UserProvider>
        <MondayDataProvider>
          <NavigationProvider>
            <App />
          </NavigationProvider>
        </MondayDataProvider>
      </UserProvider>
    </ThemeProvider>
  </StrictMode>
);
