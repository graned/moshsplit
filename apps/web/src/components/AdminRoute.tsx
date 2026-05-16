import { Navigate, Outlet } from 'react-router';
import { useAuthStore } from '@moshsplit/auth-react';

/**
 * AdminRoute: Protects admin routes by checking if the user has admin role.
 * Falls back to /app/home if the user is not an admin.
 */
function AdminRoute() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isAdmin = useAuthStore((state) => state.isAdmin);

  if (!isAuthenticated || !isAdmin) {
    return <Navigate to="/app/home" replace />;
  }

  return <Outlet />;
}

export default AdminRoute;
