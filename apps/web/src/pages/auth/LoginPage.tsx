import { useState, useCallback } from 'react';
import { Box, Typography, Container } from '@mui/material';
import { LoginCard } from '../../components/LoginCard';
import { useLogin } from './hooks';
import type { LoginCredentials } from './types';

function LoginPage() {
  const { login, isLoading } = useLogin();
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (credentials: LoginCredentials) => {
      setLocalError(null);
      const result = await login(credentials);
      if (!result.success && result.error) {
        setLocalError(result.error);
      }
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
          url('/assets/background.svg')
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
        <LoginCard
          onSubmit={handleSubmit}
          isLoading={isLoading}
          error={localError}
        />

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
