import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router';
import { AuthClient } from '@moshsplit/sentinel-sdk';
import {
  SentinelAuthProvider,
  VerifyEmailPage,
  ResetPasswordPage,
  ChangePasswordForcedPage,
  useAuthStore,
} from '@moshsplit/auth-react';

import LoginPage from './pages/auth/LoginPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import ProtectedRoute from './components/ProtectedRoute';
import { UserCacheProvider } from './providers/UserCacheProvider';
import InvitationAcceptPage from './pages/auth/InvitationAcceptPage';
import AppShell from './components/layout/AppShell';
import EventDetailPage from './pages/app/EventDetailPage';
import ExpenseReportPage from './pages/app/ExpenseReportPage';
import BalancesPage from './pages/app/BalancesPage';
import FeedPage from './pages/app/FeedPage';
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
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/change-password" element={<ChangePasswordForcedPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/invitation/accept" element={<InvitationAcceptPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<UserCacheProvider />}>
          <Route path="/app" element={<AppShell />}>
            <Route index element={<Navigate to="/app/events" replace />} />
            <Route path="events/:eventId" element={<EventDetailPage />} />
            <Route path="expenses/:eventId" element={<ExpenseReportPage />} />
            <Route path="events/:eventId/balances" element={<BalancesPage />} />
            <Route path="events/:eventId/feed" element={<FeedPage />} />
          </Route>
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
  primaryColor: '#F59E0B', // Beer-gold - Vira Latas Metaleiros aesthetic
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
        afterLogin: '/app/events',
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
