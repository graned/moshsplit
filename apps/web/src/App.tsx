import { useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router';
import { AuthClient } from '@moshsplit/sentinel-sdk';
import logoWithBackground from './assets/viralatas-moshsplit.png';
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
import { DeviceProvider, useDevice } from './providers/DeviceProvider';
import { AppShell } from './components/desktop';
import MobileAppLayout from './layouts/mobile/MobileAppLayout';
import ExpenseReportPage from './pages/app/ExpenseReportPage';
import BalancesPage from './pages/app/BalancesPage';
import FeedPage from './pages/app/FeedPage';
import MobileEventSelectPage from './pages/mobile/MobileEventSelectPage';
import MobileFeedPage from './pages/mobile/MobileFeedPage';
import MobileExpensePage from './pages/mobile/MobileExpensePage';
import MobileSettlePage from './pages/mobile/MobileSettlePage';
import { apiClient } from './api/client';
import { groupsApi } from './api/groups.api';
import { useQuery } from '@tanstack/react-query';

const sentinelUrl = import.meta.env.VITE_SENTINEL_URL || 'http://localhost:9000';
const authClient = new AuthClient(sentinelUrl);

function TokenSync() {
  const accessToken = useAuthStore((state) => state.accessToken);

  useEffect(() => {
    apiClient.setToken(accessToken);
  }, [accessToken]);

  return null;
}

function DeviceLayout() {
  const { isMobile } = useDevice();
  return isMobile ? <MobileAppLayout /> : <AppShell />;
}

function MobilePostLoginRedirect() {
  const { isMobile } = useDevice();
  const navigate = useNavigate();
  const userId = useAuthStore((state) => state.userId);

  const { data } = useQuery({
    queryKey: ['user-events', userId],
    queryFn: () => groupsApi.list(userId!),
    enabled: !!userId,
  });

  const events = data?.data || [];

  useEffect(() => {
    if (events.length === 1) {
      if (isMobile) {
        navigate(`/app/mobile/events/${events[0].id}`, { replace: true });
      } else {
        navigate(`/app/web/events/${events[0].id}`, { replace: true });
      }
    }
  }, [events, navigate]);

  return <MobileEventSelectPage />;
}

function AppContent() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/change-password" element={<ChangePasswordForcedPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<UserCacheProvider />}>
          {/* Mobile: event selection or auto-redirect */}
          <Route path="app" element={<DeviceProvider><DeviceLayout /></DeviceProvider>}>
            <Route index element={<MobilePostLoginRedirect />} />
          </Route>

          {/* Mobile event routes: /app/:eventId/* */}
          <Route path="app/mobile/events/:eventId" element={<DeviceProvider><DeviceLayout /></DeviceProvider>}>
            <Route index element={<Navigate to="log" replace />} />
            <Route path="log" element={<MobileFeedPage />} />
            <Route path="warchest" element={<MobileExpensePage />} />
            <Route path="settle" element={<MobileSettlePage />} />
          </Route>

          {/* Desktop routes: /app/events/:eventId/* */}
          <Route path="app/web/events/:eventId" element={<DeviceProvider><DeviceLayout /></DeviceProvider>}>
            <Route index element={<Navigate to="feed" replace />} />
            <Route path="feed" element={<FeedPage />} />
            <Route path="balances" element={<BalancesPage />} />
            <Route path="expenses" element={<ExpenseReportPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

const moshSplitTheme = {
  appName: 'MoshSplit',
  copyright: '© 2026 MoshSplit. All rights reserved.',
  primaryColor: '#F59E0B',
  secondaryColor: '#1F2937',
import logoWithBackground from './assets/viralatas-moshsplit.png';

// ... later in the file
  logo: (
    <img
      src={logoWithBackground}
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
        afterLogin: '/app',
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
