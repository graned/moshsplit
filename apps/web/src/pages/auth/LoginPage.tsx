import { useState, useCallback, useEffect } from 'react';
import { Box, Typography, Container } from '@mui/material';
import { useNavigate } from 'react-router';
import { LoginCard } from '../../components/LoginCard';
import { useAuthStore } from '@moshsplit/auth-react';
import { authApi } from '../../api/auth.api';
import type { LoginCredentials } from './types';

// Check for return URL on mount and redirect if present
const RETURN_TO_KEY = 'moshsplit_return_to';

function clearReturnTo() {
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem(RETURN_TO_KEY);
  }
}

function getReturnTo(): string | null {
  if (typeof window !== 'undefined') {
    return sessionStorage.getItem(RETURN_TO_KEY);
  }
  return null;
}

function LoginPage() {
  const setSession = useAuthStore((state) => state.setSession);
  const [isLoading, setIsLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const navigate = useNavigate();

  // On mount, check for return URL and navigate back if present
  useEffect(() => {
    const returnTo = getReturnTo();
    if (returnTo) {
      clearReturnTo();
      navigate(returnTo, { replace: true });
    }
  }, [navigate]);

  const login = useCallback(
    async (credentials: LoginCredentials) => {
      setIsLoading(true);
      setLocalError(null);
      try {
        const result = await authApi.login(credentials);
        setSession(result.user.id, result.token, '', true, false);

        // Check for return URL before default redirect
        const returnTo = getReturnTo();
        if (returnTo) {
          clearReturnTo();
          navigate(returnTo, { replace: true });
          return { success: true };
        }

        return { success: true };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Login failed';
        setLocalError(message);
        return { success: false, error: message };
      } finally {
        setIsLoading(false);
      }
    },
    [setSession, navigate]
  );

  const handleSubmit = useCallback(
    async (credentials: LoginCredentials) => {
      await login(credentials);
    },
    [login]
  );

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        p: 2,
        background: `
          linear-gradient(180deg, rgba(18, 18, 18, 0.7) 0%, rgba(26, 26, 26, 0.7) 50%, rgba(18, 18, 18, 0.7) 100%),
          url('/assets/background-moshsplit.webp')
        `,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        position: 'relative',
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: `
            radial-gradient(circle at 20% 80%, rgba(245, 158, 11, 0.08) 0%, transparent 40%),
            radial-gradient(circle at 80% 20%, rgba(245, 158, 11, 0.05) 0%, transparent 40%),
            radial-gradient(circle at 50% 50%, rgba(30, 30, 30, 0.3) 0%, transparent 70%)
          `,
          pointerEvents: 'none',
        },
      }}
    >
      <Container
        maxWidth="sm"
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <LoginCard onSubmit={handleSubmit} isLoading={isLoading} error={localError} />

        {/* Footer */}
        <Box
          sx={{
            mt: 4,
            textAlign: 'center',
          }}
        >
          <Typography
            variant="body2"
            sx={{
              color: 'text.secondary',
              fontSize: '0.8125rem',
              letterSpacing: '0.05em',
            }}
          >
            {'No signup. No chaos.'}
          </Typography>
          <Typography
            variant="body2"
            sx={{
              color: 'primary.main',
              fontSize: '0.8125rem',
              fontWeight: 500,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              mt: 0.5,
            }}
          >
            {'Only invited metalheads.'}
          </Typography>
        </Box>
      </Container>
    </Box>
  );
}

export default LoginPage;
