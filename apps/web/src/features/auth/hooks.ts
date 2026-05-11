import { useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useAuth as useAuthContext } from '@moshsplit/auth-react';
import type { LoginCredentials, LoginResult } from './types';

export function useLogin() {
  const { login, isLoading, error: authError } = useAuthContext();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const handleLogin = useCallback(
    async (credentials: LoginCredentials): Promise<LoginResult> => {
      const result = await login(credentials);

      if (!result.success) {
        return {
          success: false,
          error: authError || 'Login failed',
        };
      }

      if (result.mfa) {
        return {
          success: false,
          error: 'MFA is required but not yet implemented',
          mfa: true,
        };
      }

      if (result.mustChangePassword) {
        navigate('/change-password');
        return { success: true };
      }

      if (result.mfaSetupRequired) {
        navigate('/setup-mfa');
        return { success: true };
      }

      if (result.emailUnverified) {
        navigate('/verify-email');
        return { success: true };
      }

      const redirect = searchParams.get('redirect');
      navigate(redirect || '/app/home');
      return { success: true };
    },
    [login, authError, navigate, searchParams]
  );

  return {
    login: handleLogin,
    isLoading,
    error: authError,
  };
}

export function useLogout() {
  const { logout } = useAuthContext();
  const navigate = useNavigate();

  const handleLogout = useCallback(async () => {
    await logout();
    navigate('/login');
  }, [logout, navigate]);

  return { logout: handleLogout };
}