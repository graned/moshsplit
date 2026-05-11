import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router';
import { AuthClient } from '@moshsplit/sentinel-sdk';
import {
  SentinelAuthProvider,
  VerifyEmailPage,
  ForgotPasswordPage,
  ResetPasswordPage,
  ChangePasswordForcedPage,
  useAuthStore,
} from '@moshsplit/auth-react';

import LoginPage from './features/auth/pages/LoginPage';
import ProtectedRoute from './components/ProtectedRoute';
import InvitationAcceptPage from './pages/auth/InvitationAcceptPage';
import AppLayout from './components/AppLayout';
import HomePage from './pages/app/HomePage';
import EventsPage from './pages/app/EventsPage';
import ExpensesPage from './pages/app/ExpensesPage';
import BalancesPage from './pages/app/BalancesPage';
import SettlementsPage from './pages/app/SettlementsPage';
import SettingsProfilePage from './pages/app/settings/SettingsProfilePage';
import SettingsSecurityPage from './pages/app/settings/SettingsSecurityPage';
import { apiClient } from './api/client';

// Create the Sentinel auth client with the base URL from env
const sentinelUrl = import.meta.env.VITE_SENTINEL_URL || 'http://localhost:9000';
const authClient = new AuthClient(sentinelUrl);

// Sync token from sentinel-auth-react store to apiClient
function TokenSync() {
  const accessToken = useAuthStore((state) => state.accessToken);

  useEffect(() => {
    apiClient.setToken(accessToken);
  }, [accessToken]);

  return null;
}

function AppContent() {
  // The store auto-initializes from localStorage via persist middleware
  // No explicit loading state needed - the store handles session restoration

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/change-password" element={<ChangePasswordForcedPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/invitation/accept" element={<InvitationAcceptPage />} />

      <Route element={<ProtectedRoute />}>
        <Route path="/app" element={<AppLayout />}>
          <Route index element={<Navigate to="/app/home" replace />} />
          <Route path="home" element={<HomePage />} />
          <Route path="events" element={<EventsPage />} />
          <Route path="expenses" element={<ExpensesPage />} />
          <Route path="balances" element={<BalancesPage />} />
          <Route path="settlements" element={<SettlementsPage />} />
          <Route path="settings/profile" element={<SettingsProfilePage />} />
          <Route path="settings/security" element={<SettingsSecurityPage />} />
        </Route>
      </Route>

      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

// MoshSplit branding - metal/rock themed auth pages
const moshSplitTheme = {
  appName: 'MoshSplit',
  copyright: '© 2026 MoshSplit. All rights reserved.',
  primaryColor: '#F59E0B',   // Beer-gold - Vira Latas Metaleiros aesthetic
  secondaryColor: '#1F2937', // Dark charcoal grey
  logo: (
    <img
      src="/viralatas-moshsplit.png"
      alt="MoshSplit Logo"
      style={{
        height: '120px',
        width: 'auto',
        display: 'block',
        margin: '0 auto',
        filter: 'drop-shadow(0 0 10px rgba(245, 158, 11, 0.5))',
      }}
    />
  ),
};

function App() {
  return (
    <SentinelAuthProvider 
      client={authClient}
      redirects={{
        afterLogin: '/app/home',
        afterLogout: '/login',
        verifyEmail: '/verify-email',
        changePassword: '/change-password',
        setupMfa: '/setup-mfa',
      }}
      theme={moshSplitTheme}
    >
      <TokenSync />
      <AppContent />
    </SentinelAuthProvider>
  );
}

export default App;