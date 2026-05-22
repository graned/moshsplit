import { useState } from 'react';
import { Card, CardContent, Button, Box, CircularProgress, TextField, Typography, alpha } from '@mui/material';
import { AuthHeroLogo } from './AuthHeroLogo';
import { LoginForm } from './LoginForm';
import { InvitationOnlyNotice } from './InvitationOnlyNotice';
import type { LoginCredentials } from '../pages/auth/types';
import { authApi } from '../api/auth.api';
import { useAuthStore } from '@moshsplit/auth-react';
import { AuthClient } from '@moshsplit/sentinel-sdk';
import { useNavigate } from 'react-router';

// Shared key with ProtectedRoute.tsx and LoginPage.tsx — all files must agree on the storage key.
const RETURN_TO_KEY = 'moshsplit_return_to';

function getReturnTo(): string | null {
  if (typeof window !== 'undefined') {
    return sessionStorage.getItem(RETURN_TO_KEY);
  }
  return null;
}

function clearReturnTo() {
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem(RETURN_TO_KEY);
  }
}

interface LoginCardProps {
  onSubmit: (credentials: LoginCredentials) => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

const DEFAULT_EMAIL = 'anayamaster@gmail.com';

export function LoginCard({ onSubmit, isLoading, error }: LoginCardProps) {
  const [externalLoading, setExternalLoading] = useState(false);
  const [externalError, setExternalError] = useState<string | null>(null);
  const [devEmail, setDevEmail] = useState('');
  const setSession = useAuthStore((state) => state.setSession);
  const navigate = useNavigate();

  const handleExternalLogin = async () => {
    setExternalLoading(true);
    setExternalError(null);

    try {
      // Use runtime config if available, fallback to env vars
      const runtimeConfig = (window as any).__MOSHSPLIT_CONFIG__ || {};
      const apiToken = runtimeConfig.VITE_TEST_API_TOKEN || import.meta.env.VITE_TEST_API_TOKEN || 'sat_test_token';
      const testEmail = devEmail.trim() || runtimeConfig.VITE_TEST_USER_EMAIL || import.meta.env.VITE_TEST_USER_EMAIL || DEFAULT_EMAIL;

      const exchangeResult = await authApi.externalLogin({
        api_token: apiToken,
        email: testEmail,
        display_name: runtimeConfig.VITE_TEST_DISPLAY_NAME || 'Eduardo Anaya',
        avatar_url: runtimeConfig.VITE_TEST_AVATAR_URL || 'https://lh3.googleusercontent.com/pw/AP1GczMPVP7BLZ7fKXXLPHayHHvK7FaOd1N_jPqod7q3pCaPoUAPIW37PLFQtYPTHeHmx6dT6S9N0j1QNbGdK70dMK_yYz_9rI5A9IBBt8OkLxkDdVq2wTXEL0z2jgPfbaL1ULukmNnGmzhummJ0tK45L1waNg=w1082-h1441-s-no-gm?authuser=0',
      });

      setSession(
        exchangeResult.user_id,
        exchangeResult.access_token,
        exchangeResult.refresh_token,
        exchangeResult.email_verified,
        false
      );

      try {
        const sentinelUrl = import.meta.env.VITE_SENTINEL_URL || 'http://localhost:9000';
        const authClient = new AuthClient(sentinelUrl);
        const token = exchangeResult.access_token;
        const profile = await authClient.user.getMe(token);
        const { setUserProfile } = useAuthStore.getState();
        const firstName = (profile as any).first_name || (profile as any).firstName || '';
        const lastName = (profile as any).last_name || (profile as any).lastName || '';
        const email = (profile as any).email || '';
        setUserProfile(email, firstName, lastName);
      } catch (profileErr) {
        console.error('[ExternalLogin] Failed to fetch user profile:', profileErr);
      }

      // Check for return URL before default redirect
      const returnTo = getReturnTo();
      if (returnTo) {
        clearReturnTo();
        navigate(returnTo, { replace: true });
        return;
      }

      navigate(`/app`, { replace: true });
    } catch (err) {
      setExternalError(err instanceof Error ? err.message : 'External login failed');
      console.error('[ExternalLogin] Top-level error:', err);
    } finally {
      setExternalLoading(false);
    }
  };

  return (
    <Card
      sx={{
        width: '100%',
        maxWidth: 420,
        background: `
          linear-gradient(180deg, rgba(26, 26, 26, 0.98) 0%, rgba(18, 18, 18, 0.98) 100%),
          url('/moshsplit/assets/background-moshsplit.webp')
        `,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        border: '1px solid rgba(245, 158, 11, 0.2)',
        borderRadius: '4px',
        boxShadow: '0 24px 80px rgba(0, 0, 0, 0.55)',
        backdropFilter: 'blur(10px)',
        position: 'relative',
        overflow: 'visible',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'linear-gradient(145deg, rgba(255,255,255,0.03) 0%, transparent 50%, transparent 100%)',
          pointerEvents: 'none',
          borderRadius: '4px',
        },
      }}
    >
      <CardContent
        sx={{
          p: { xs: 3, sm: 4 },
        }}
      >
        <AuthHeroLogo title="Join the Pit" subtitle="Sign in to split the chaos" />

        <LoginForm onSubmit={onSubmit} isLoading={isLoading} error={error} />

        {/* Dev Section */}
        <Box
          sx={{
            mt: 3,
            p: 2,
            borderRadius: 2,
            border: `1px dashed ${alpha('#F59E0B', 0.3)}`,
            bgcolor: alpha('#F59E0B', 0.04),
          }}
        >
          <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ display: 'block', mb: 1.5, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            Dev Login
          </Typography>

          <TextField
            type="email"
            value={devEmail}
            onChange={(e) => setDevEmail(e.target.value)}
            placeholder={`Default: ${DEFAULT_EMAIL}`}
            fullWidth
            size="small"
            autoComplete="email"
            sx={{
              mb: 1.5,
              '& .MuiOutlinedInput-root': {
                backgroundColor: 'rgba(255, 255, 255, 0.04)',
                borderRadius: '4px',
                '&:hover': {
                  backgroundColor: 'rgba(255, 255, 255, 0.06)',
                },
                '&.Mui-focused': {
                  backgroundColor: 'rgba(255, 255, 255, 0.06)',
                  boxShadow: '0 0 0 2px rgba(245, 158, 11, 0.3)',
                },
              },
              '& .MuiOutlinedInput-input': {
                color: 'text.primary',
                '&::placeholder': {
                  color: 'text.secondary',
                  opacity: 0.7,
                },
              },
            }}
          />

          <Button
            fullWidth
            variant="outlined"
            onClick={handleExternalLogin}
            disabled={externalLoading}
            sx={{
              borderColor: 'rgba(245, 158, 11, 0.5)',
              color: 'text.primary',
              '&:hover': {
                borderColor: 'primary.main',
                backgroundColor: 'rgba(245, 158, 11, 0.1)',
              },
            }}
          >
            {externalLoading ? <CircularProgress size={24} /> : 'Join with Pitboss'}
          </Button>

          {externalError && (
            <Box sx={{ mt: 1, color: 'error.main', fontSize: '0.75rem', textAlign: 'center' }}>{externalError}</Box>
          )}
        </Box>

        <InvitationOnlyNotice />
      </CardContent>
    </Card>
  );
}
