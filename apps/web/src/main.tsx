import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import { createSentinelQueryClient } from '@moshsplit/auth-react';

import App from './App';
import { theme } from './theme';
import { i18n } from './i18n';

// Import Sentinel auth styles
import '@moshsplit/auth-react/dist/style.css';

// Create QueryClient with automatic 401 handling and token refresh
export const queryClient = createSentinelQueryClient({
  afterLogout: '/moshsplit/login',
  verifyEmail: '/moshsplit/verify-email',
  changePassword: '/moshsplit/change-password',
  unauthorized: '/moshsplit/unauthorized',
  setupMfa: '/moshsplit/setup-mfa',
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <BrowserRouter basename="/moshsplit">
            <App />
          </BrowserRouter>
        </ThemeProvider>
      </I18nextProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
