import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { Box, TextField, Button, Typography, InputAdornment, IconButton, Paper, Container } from '@mui/material';
import { Visibility, VisibilityOff, Email as EmailIcon, Lock as LockIcon } from '@mui/icons-material';
import { AuthClient } from '@moshsplit/sentinel-sdk';

const SENTINEL_URL = import.meta.env.VITE_SENTINEL_URL || 'http://localhost:9000';

interface LoginSession {
  email: string;
  displayName: string;
  accessToken: string;
  refreshToken: string;
  userId: string;
}

interface LoginPageProps {
  onLoginSuccess?: (session: LoginSession) => void;
}

function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const authClient = new AuthClient(SENTINEL_URL);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setIsLoading(true);
      setError(null);

      try {
        const result = await authClient.login({ email, password });

        if (result.type === 'mfa') {
          setError('MFA is not supported in this test app. Please use an account without MFA enabled.');
          return;
        }

        // Get user profile to get display name
        const profile = await authClient.user.getMe(result.session.accessToken) as any;
        const displayName = [
          profile.first_name || profile.firstName,
          profile.last_name || profile.lastName,
        ].filter(Boolean).join(' ') || email.split('@')[0];

        const session: LoginSession = {
          email,
          displayName,
          accessToken: result.session.accessToken,
          refreshToken: result.session.refreshToken,
          userId: result.session.userId,
        };

        // Store session in localStorage for the summary page
        localStorage.setItem('test-login-session', JSON.stringify(session));

        onLoginSuccess?.(session);
        navigate('/summary');
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Login failed';
        setError(message);
      } finally {
        setIsLoading(false);
      }
    },
    [email, password, authClient, navigate, onLoginSuccess],
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
          linear-gradient(180deg, rgba(15, 23, 42, 0.9) 0%, rgba(30, 41, 59, 0.9) 50%, rgba(15, 23, 42, 0.9) 100%),
          radial-gradient(circle at 20% 80%, rgba(245, 158, 11, 0.08) 0%, transparent 40%),
          radial-gradient(circle at 80% 20%, rgba(245, 158, 11, 0.05) 0%, transparent 40%)
        `,
        position: 'relative',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'radial-gradient(circle at 50% 50%, rgba(30, 30, 30, 0.3) 0%, transparent 70%)',
          pointerEvents: 'none',
        },
      }}
    >
      <Container maxWidth="sm" sx={{ position: 'relative', zIndex: 1 }}>
        <Paper
          elevation={0}
          sx={{
            p: 4,
            backgroundColor: 'rgba(30, 41, 59, 0.8)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            borderRadius: 2,
          }}
        >
          {/* Header */}
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            <Typography
              variant="h4"
              sx={{
                color: 'primary.main',
                fontWeight: 700,
                letterSpacing: '0.05em',
                mb: 1,
              }}
            >
              MoshSplit
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              External Login Test
            </Typography>
          </Box>

          {/* Login Form */}
          <Box
            component="form"
            onSubmit={handleSubmit}
            sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: 2.5,
            }}
          >
            {/* Email Field */}
            <TextField
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              required
              fullWidth
              autoComplete="email"
              autoFocus
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <EmailIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                  </InputAdornment>
                ),
              }}
            />

            {/* Password Field */}
            <TextField
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              required
              fullWidth
              autoComplete="current-password"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LockIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPassword(!showPassword)}
                      edge="end"
                      size="small"
                      sx={{ color: 'text.secondary' }}
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            {/* Error Message */}
            {error && (
              <Typography
                variant="body2"
                sx={{
                  color: 'error.main',
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  borderRadius: 1,
                  p: 1.5,
                  textAlign: 'center',
                }}
              >
                {error}
              </Typography>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={isLoading || !email || !password}
              sx={{
                mt: 1,
                minHeight: 56,
                backgroundColor: 'primary.main',
                color: '#121212',
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                borderRadius: '2px',
                fontSize: '0.9375rem',
                '&:hover': {
                  backgroundColor: 'primary.dark',
                },
                '&:disabled': {
                  backgroundColor: 'rgba(245, 158, 11, 0.3)',
                  color: 'rgba(18, 18, 18, 0.5)',
                },
              }}
            >
              {isLoading ? 'Signing in...' : 'Sign In'}
            </Button>
          </Box>

          {/* Footer */}
          <Box sx={{ mt: 4, textAlign: 'center' }}>
            <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.8125rem' }}>
              Test app for Sentinel external login flow
            </Typography>
          </Box>
        </Paper>
      </Container>
    </Box>
  );
}

export default LoginPage;
