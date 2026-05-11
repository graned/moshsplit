import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router';

import { useAuthStore } from './stores/authStore';

import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/auth/LoginPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import ResetPasswordPage from './pages/auth/ResetPasswordPage';
import InvitationAcceptPage from './pages/auth/InvitationAcceptPage';
import AppLayout from './components/AppLayout';
import HomePage from './pages/app/HomePage';
import EventsPage from './pages/app/EventsPage';
import ExpensesPage from './pages/app/ExpensesPage';
import BalancesPage from './pages/app/BalancesPage';
import SettlementsPage from './pages/app/SettlementsPage';
import SettingsProfilePage from './pages/app/settings/SettingsProfilePage';
import SettingsSecurityPage from './pages/app/settings/SettingsSecurityPage';

function App() {
  const initialize = useAuthStore((state) => state.initialize);
  const isLoading = useAuthStore((state) => state.isLoading);

  useEffect(() => {
    initialize();
  }, [initialize]);

  if (isLoading) {
    return null;
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
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

export default App;