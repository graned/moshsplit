import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link as RouterLink } from 'react-router';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Alert,
  Button,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Email as EmailIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { authApi } from '../../api/auth.api';
import { useAuthStore } from '@moshsplit/auth-react';

type VerifyMode = 'verifying' | 'success' | 'error' | 'needsPasswordReset';

function VerifyEmailPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');
  const { userId, accessToken, refreshToken, mustChangePassword, setSession } = useAuthStore();

  const [mode, setMode] = useState<VerifyMode>('verifying');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError(t('verifyEmail.invalidToken'));
      setMode('error');
      return;
    }

    const verifyEmail = async () => {
      try {
        await authApi.verifyEmail(token);

        // Email verified successfully - update the Sentinel auth store
        // This updates the emailVerified flag so the user doesn't need to re-login
        if (userId && accessToken && refreshToken) {
          setSession(userId, accessToken, refreshToken, true, mustChangePassword);
        }

        // Check if password reset is needed by examining the response
        // The token might indicate if password reset is required
        // For now, we check if the token looks like it needs password reset
        // In a real implementation, the API would return this information

        // For now, we'll assume successful verification leads to success
        // The backend should indicate if password change is required
        setMode('success');
      } catch (err) {
        const errorMessage = (err as Error).message || t('verifyEmail.errorMessage');
        
        // Check if this error indicates password reset is required
        // This is a workaround - in production, the API should return
        // a specific indicator for mustChangePassword
        if (errorMessage.toLowerCase().includes('password') || 
            errorMessage.toLowerCase().includes('change')) {
          setMode('needsPasswordReset');
        } else {
          setError(errorMessage);
          setMode('error');
        }
      }
    };

    verifyEmail();
  }, [token, t, userId, accessToken, refreshToken, mustChangePassword, setSession]);

  const handleRedirectToResetPassword = () => {
    if (token) {
      navigate(`/reset-password?token=${encodeURIComponent(token)}`);
    }
  };

  // Verifying state
  if (mode === 'verifying') {
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
            <Box sx={{ textAlign: 'center' }}>
              <Box
                sx={{
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  border: '3px solid',
                  borderColor: 'primary.main',
                  borderTopColor: 'transparent',
                  animation: 'spin 1s linear infinite',
                  '@keyframes spin': {
                    '0%': { transform: 'rotate(0deg)' },
                    '100%': { transform: 'rotate(360deg)' },
                  },
                  mx: 'auto',
                  mb: 3,
                }}
              />
              <Typography variant="h5" component="h1" fontWeight={600}>
                {t('verifyEmail.verifying')}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {t('verifyEmail.pleaseWait')}
              </Typography>
            </Box>
          </CardContent>
        </Card>
      </Box>
    );
  }

  // Success state - email verified
  if (mode === 'success') {
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
            <Box sx={{ textAlign: 'center', mb: 3 }}>
              <CheckCircleIcon sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
              <Typography variant="h5" component="h1" fontWeight={600}>
                {t('verifyEmail.successTitle')}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {t('verifyEmail.successMessage')}
              </Typography>
            </Box>

            <Alert severity="success" sx={{ mb: 3 }}>
              {t('verifyEmail.successAlert')}
            </Alert>

            <Button
              component={RouterLink}
              to="/login"
              variant="contained"
              fullWidth
              size="large"
            >
              {t('verifyEmail.signIn')}
            </Button>
          </CardContent>
        </Card>
      </Box>
    );
  }

  // Needs password reset state
  if (mode === 'needsPasswordReset') {
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
            <Box sx={{ textAlign: 'center', mb: 3 }}>
              <EmailIcon sx={{ fontSize: 64, color: 'warning.main', mb: 2 }} />
              <Typography variant="h5" component="h1" fontWeight={600}>
                {t('verifyEmail.passwordChangeRequired')}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {t('verifyEmail.passwordChangeMessage')}
              </Typography>
            </Box>

            <Alert severity="warning" sx={{ mb: 3 }}>
              {t('verifyEmail.passwordChangeAlert')}
            </Alert>

            <Button
              onClick={handleRedirectToResetPassword}
              variant="contained"
              fullWidth
              size="large"
            >
              {t('verifyEmail.setNewPassword')}
            </Button>

            <Box sx={{ textAlign: 'center', mt: 3 }}>
              <Button
                component={RouterLink}
                to="/login"
                variant="text"
                size="small"
              >
                {t('verifyEmail.backToLogin')}
              </Button>
            </Box>
          </CardContent>
        </Card>
      </Box>
    );
  }

  // Error state
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
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <ErrorIcon sx={{ fontSize: 64, color: 'error.main', mb: 2 }} />
            <Typography variant="h5" component="h1" fontWeight={600}>
              {t('verifyEmail.errorTitle')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {error || t('verifyEmail.errorMessage')}
            </Typography>
          </Box>

          <Alert severity="error" sx={{ mb: 3 }}>
            {error || t('verifyEmail.errorMessage')}
          </Alert>

          <Button
            component={RouterLink}
            to="/forgot-password"
            variant="outlined"
            fullWidth
          >
            {t('verifyEmail.requestNewLink')}
          </Button>

          <Box sx={{ textAlign: 'center', mt: 3 }}>
            <Button
              component={RouterLink}
              to="/login"
              variant="text"
              size="small"
            >
              {t('verifyEmail.backToLogin')}
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}

export default VerifyEmailPage;