import { Navigate, Outlet } from 'react-router';
import { useAuthStore } from '@moshsplit/auth-react';

function ProtectedRoute() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

export default ProtectedRoute;