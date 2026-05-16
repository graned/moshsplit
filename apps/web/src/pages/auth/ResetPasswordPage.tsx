import { useState, useEffect } from 'react';
import { useSearchParams, Link as RouterLink } from 'react-router';
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
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  Lock as LockIcon,
  ArrowBack as ArrowBackIcon,
  CheckCircle,
  Circle,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { authApi } from '../../api/auth.api';

const PASSWORD_RULES = [
  { label: 'At least 12 characters', test: (p: string) => p.length >= 12 },
  { label: 'One uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'One lowercase letter', test: (p: string) => /[a-z]/.test(p) },
  { label: 'One number', test: (p: string) => /[0-9]/.test(p) },
  { label: 'One special character', test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

function PasswordRequirements({ password }: { password: string }) {
  return (
    <List dense sx={{ mt: 1 }}>
      {PASSWORD_RULES.map(({ label, test }) => {
        const met = test(password);
        return (
          <ListItem key={label} disablePadding sx={{ py: 0.25 }}>
            <ListItemIcon sx={{ minWidth: 28 }}>
              {met ? <CheckCircle fontSize="small" color="success" /> : <Circle fontSize="small" color="disabled" />}
            </ListItemIcon>
            <ListItemText
              primary={label}
              primaryTypographyProps={{
                variant: 'caption',
                color: met ? 'success.main' : 'text.secondary',
              }}
            />
          </ListItem>
        );
      })}
    </List>
  );
}

function ResetPasswordPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) {
      setError(t('resetPassword.invalidToken'));
    }
  }, [token, t]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError(t('resetPassword.passwordMismatch'));
      return;
    }

    // Validate password requirements
    const failedRule = PASSWORD_RULES.find(({ test }) => !test(password));
    if (failedRule) {
      setError(t('resetPassword.requirementsNotMet'));
      return;
    }

    if (!token) {
      setError(t('resetPassword.invalidToken'));
      return;
    }

    setLoading(true);

    try {
      await authApi.resetPassword({ token, newPassword: password });
      setSuccess(true);
    } catch (err) {
      setError((err as Error).message || t('resetPassword.errorMessage'));
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
              <Typography variant="h4" component="h1" fontWeight={700}>
                {t('resetPassword.title')}
              </Typography>
            </Box>

            <Alert severity="success">{t('resetPassword.successMessage')}</Alert>

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
            <Typography variant="h4" component="h1" fontWeight={700}>
              {t('resetPassword.title')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {t('resetPassword.subtitle')}
            </Typography>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            <div>
              <TextField
                label={t('resetPassword.newPassword')}
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                fullWidth
                autoComplete="new-password"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <LockIcon color="action" />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={() => setShowPassword(!showPassword)} edge="end" size="small">
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
              {password && <PasswordRequirements password={password} />}
            </div>

            <TextField
              label={t('resetPassword.confirmPassword')}
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              fullWidth
              autoComplete="new-password"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LockIcon color="action" />
                  </InputAdornment>
                ),
              }}
            />

            <Button type="submit" variant="contained" size="large" disabled={loading || !token} sx={{ mt: 1 }}>
              {loading ? t('common.loading') : t('resetPassword.submitButton')}
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

export default ResetPasswordPage;
