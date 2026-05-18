import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuthStore } from '@moshsplit/auth-react';

const RETURN_TO_KEY = 'moshsplit_return_to';

function ProtectedRoute() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const location = useLocation();

  if (!isAuthenticated) {
    const currentStored = sessionStorage.getItem(RETURN_TO_KEY);
    if (currentStored !== location.pathname) {
      sessionStorage.setItem(RETURN_TO_KEY, location.pathname);
    }
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

export default ProtectedRoute;
