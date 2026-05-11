import { useState } from 'react';
import { useNavigate, useSearchParams, Link as RouterLink } from 'react-router';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Alert,
  InputAdornment,
  IconButton,
  Link,
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  Email as EmailIcon,
  Lock as LockIcon,
  Celebration as CelebrationIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@moshsplit/auth-react';

function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, isLoading, error: authError } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const result = await login({ email, password });

    if (!result.success) {
      setError(authError || t('common.error'));
      return;
    }

    // Handle MFA flow - show MFA input or redirect
    if (result.mfa) {
      // MFA challenge required - for now, show an error
      // In a full implementation, you'd show an MFA input field
      setError('MFA is required but not yet implemented in the UI');
      return;
    }

    // Check for other conditions
    if (result.mustChangePassword) {
      navigate('/change-password');
      return;
    }

    if (result.mfaSetupRequired) {
      navigate('/setup-mfa');
      return;
    }

    if (result.emailUnverified) {
      navigate('/verify-email');
      return;
    }

    // Success - redirect to app
    const redirect = searchParams.get('redirect');
    navigate(redirect || '/app/home');
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 2,
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
      }}
    >
      <Card
        sx={{
          width: '100%',
          maxWidth: 420,
          backgroundColor: 'background.paper',
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        <CardContent sx={{ p: 4 }}>
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            <Box
              sx={{
                width: 64,
                height: 64,
                borderRadius: 3,
                background: 'linear-gradient(135deg, #6366f1 0%, #f472b6 100%)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                mb: 2,
              }}
            >
              <CelebrationIcon sx={{ fontSize: 32, color: '#fff' }} />
            </Box>
            <Typography variant="h4" component="h1" fontWeight={700}>
              {t('auth.loginTitle')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {t('auth.loginSubtitle')}
            </Typography>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          <Box
            component="form"
            onSubmit={handleSubmit}
            sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}
          >
            <TextField
              label={t('auth.email')}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              fullWidth
              autoComplete="email"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <EmailIcon color="action" />
                  </InputAdornment>
                ),
              }}
            />

            <TextField
              label={t('auth.password')}
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              fullWidth
              autoComplete="current-password"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LockIcon color="action" />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPassword(!showPassword)}
                      edge="end"
                      size="small"
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            <Box sx={{ textAlign: 'right' }}>
              <Link component={RouterLink} to="/forgot-password" variant="body2">
                {t('auth.forgotPassword')}
              </Link>
            </Box>

            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={isLoading}
              sx={{ mt: 1 }}
            >
              {isLoading ? t('common.loading') : t('auth.loginButton')}
            </Button>
          </Box>

          <Box
            sx={{
              mt: 4,
              p: 2,
              borderRadius: 2,
              backgroundColor: 'rgba(99, 102, 241, 0.1)',
              border: '1px solid',
              borderColor: 'primary.main',
            }}
          >
            <Typography variant="body2" color="primary" fontWeight={500} textAlign="center">
              {t('auth.invitationOnly')}
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              textAlign="center"
              display="block"
              sx={{ mt: 0.5 }}
            >
              {t('auth.invitationMessage')}
            </Typography>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}

export default LoginPage;