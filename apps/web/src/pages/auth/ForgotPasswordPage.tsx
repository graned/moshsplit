import { useState } from 'react';
import { Link as RouterLink } from 'react-router';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Alert,
  InputAdornment,
  Link,
} from '@mui/material';
import {
  Email as EmailIcon,
  ArrowBack as ArrowBackIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { authApi } from '../../api/auth.api';

function ForgotPasswordPage() {
  const { t } = useTranslation();

  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await authApi.forgotPassword({ email });
      setSuccess(true);
    } catch (err) {
      // For security, always show success even if email doesn't exist
      setSuccess(true);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
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
              radial-gradient(circle at 80% 20%, rgba(245, 158, 11, 0.05) 0%, transparent 40%)
            `,
            pointerEvents: 'none',
          },
        }}
      >
        <Card
          sx={{
            width: '100%',
            maxWidth: 420,
            background: `
              linear-gradient(180deg, rgba(26, 26, 26, 0.98) 0%, rgba(18, 18, 18, 0.98) 100%),
              url('/assets/bg-texture-1.svg')
            `,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            border: '1px solid rgba(245, 158, 11, 0.2)',
            borderRadius: '4px',
            boxShadow: '0 24px 80px rgba(0, 0, 0, 0.55)',
            backdropFilter: 'blur(10px)',
          }}
        >
          <CardContent sx={{ p: 4 }}>
            <Box sx={{ textAlign: 'center', mb: 4 }}>
              <Typography variant="h4" component="h1" fontWeight={700}>
                TEST - {t('forgotPassword.title')}
              </Typography>
            </Box>

            <Alert severity="success">
              {t('forgotPassword.successMessage')}
            </Alert>

            <Button
              component={RouterLink}
              to="/login"
              variant="outlined"
              fullWidth
              sx={{ mt: 3 }}
              startIcon={<ArrowBackIcon />}
            >
              {t('forgotPassword.backToLogin')}
            </Button>
          </CardContent>
        </Card>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
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
            radial-gradient(circle at 80% 20%, rgba(245, 158, 11, 0.05) 0%, transparent 40%)
          `,
          pointerEvents: 'none',
        },
      }}
    >
      <Card
        sx={{
          width: '100%',
          maxWidth: 420,
          background: `
            linear-gradient(180deg, rgba(26, 26, 26, 0.98) 0%, rgba(18, 18, 18, 0.98) 100%),
            url('/assets/bg-texture-1.svg')
          `,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          border: '1px solid rgba(245, 158, 11, 0.2)',
          borderRadius: '4px',
          boxShadow: '0 24px 80px rgba(0, 0, 0, 0.55)',
          backdropFilter: 'blur(10px)',
        }}
      >
        <CardContent sx={{ p: 4 }}>
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            <Typography variant="h4" component="h1" fontWeight={700}>
              {t('forgotPassword.title')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {t('forgotPassword.subtitle')}
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
              label={t('forgotPassword.emailLabel')}
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

            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={loading}
              sx={{ mt: 1 }}
            >
              {loading ? t('common.loading') : t('forgotPassword.submitButton')}
            </Button>
          </Box>

          <Box sx={{ textAlign: 'center', mt: 3 }}>
            <Link component={RouterLink} to="/login" variant="body2">
              {t('forgotPassword.backToLogin')}
            </Link>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}

export default ForgotPasswordPage;