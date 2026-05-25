import { useState } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router';
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
  CheckCircleOutline,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSentinelAuth } from '@moshsplit/auth-react';
import { useAuthStore } from '@moshsplit/auth-react';
import { SentinelError } from '@moshsplit/sentinel-sdk';

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

function ChangePasswordForcedPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { client, redirects } = useSentinelAuth();
  const { accessToken, clearMustChangePassword } = useAuthStore();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const afterLoginPath = redirects?.afterLogin ?? '/app';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    setApiError(null);

    const failedRule = PASSWORD_RULES.find(({ test }) => !test(newPassword));
    if (failedRule) {
      setValidationError(t('changePasswordForced.requirementsNotMet'));
      return;
    }

    if (newPassword !== confirmPassword) {
      setValidationError(t('changePasswordForced.passwordMismatch'));
      return;
    }

    setLoading(true);

    try {
      await client.user.changePassword(accessToken!, {
        current_password: currentPassword,
        new_password: newPassword,
      });
      clearMustChangePassword();
      setSuccess(true);
    } catch (err) {
      const msg = err instanceof SentinelError
        ? err.message
        : t('changePasswordForced.errorMessage');
      setApiError(msg);
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
              <CheckCircleOutline sx={{ fontSize: 56, color: 'success.main', mb: 2 }} />
              <Typography variant="h4" component="h1" fontWeight={700}>
                {t('changePasswordForced.titleSuccess')}
              </Typography>
            </Box>

            <Alert severity="success">{t('changePasswordForced.successMessage')}</Alert>

            <Button
              onClick={() => navigate(afterLoginPath)}
              variant="outlined"
              fullWidth
              sx={{ mt: 3 }}
              startIcon={<ArrowBackIcon />}
            >
              {t('changePasswordForced.continueButton')}
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
              {t('changePasswordForced.title')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {t('changePasswordForced.subtitle')}
            </Typography>
          </Box>

          {validationError && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {validationError}
            </Alert>
          )}

          {apiError && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {apiError}
            </Alert>
          )}

          <Box
            component="form"
            onSubmit={handleSubmit}
            sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}
          >
            <TextField
              label={t('changePasswordForced.currentPassword')}
              type={showPassword ? 'text' : 'password'}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              fullWidth
              autoComplete="current-password"
              autoFocus
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LockIcon color="action" />
                  </InputAdornment>
                ),
              }}
            />

            <div>
              <TextField
                label={t('changePasswordForced.newPassword')}
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
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
              {newPassword && <PasswordRequirements password={newPassword} />}
            </div>

            <TextField
              label={t('changePasswordForced.confirmPassword')}
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

            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={loading}
              sx={{ mt: 1 }}
            >
              {loading ? t('common.loading') : t('changePasswordForced.submitButton')}
            </Button>
          </Box>

          <Box sx={{ textAlign: 'center', mt: 3 }}>
            <Link component={RouterLink} to="/login" variant="body2">
              {t('changePasswordForced.backToLogin')}
            </Link>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}

export default ChangePasswordForcedPage;