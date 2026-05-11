import { Routes, Route, Navigate } from 'react-router';
import { AuthClient } from '@moshsplit/sentinel-sdk';
import { SentinelAuthProvider } from '@moshsplit/auth-react';

import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/auth/LoginPage';
import ChangePasswordPage from './pages/auth/ChangePasswordPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import ResetPasswordPage from './pages/auth/ResetPasswordPage';
import VerifyEmailPage from './pages/auth/VerifyEmailPage';
import InvitationAcceptPage from './pages/auth/InvitationAcceptPage';
import AppLayout from './components/AppLayout';
import HomePage from './pages/app/HomePage';
import EventsPage from './pages/app/EventsPage';
import ExpensesPage from './pages/app/ExpensesPage';
import BalancesPage from './pages/app/BalancesPage';
import SettlementsPage from './pages/app/SettlementsPage';
import SettingsProfilePage from './pages/app/settings/SettingsProfilePage';
import SettingsSecurityPage from './pages/app/settings/SettingsSecurityPage';

// Create the Sentinel auth client with the base URL from env
const sentinelUrl = import.meta.env.VITE_SENTINEL_URL || 'http://localhost:9000';
const authClient = new AuthClient(sentinelUrl);

function AppContent() {
  // The store auto-initializes from localStorage via persist middleware
  // No explicit loading state needed - the store handles session restoration

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/change-password" element={<ChangePasswordPage />} />
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

function App() {
  return (
    <SentinelAuthProvider client={authClient}>
      <AppContent />
    </SentinelAuthProvider>
  );
}

export default App;