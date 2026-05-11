import { useState } from 'react';
import { useNavigate } from 'react-router';
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
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  Lock as LockIcon,
  CheckCircle,
  Circle,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@moshsplit/auth-react';
import { AuthClient } from '@moshsplit/sentinel-sdk';

const sentinelUrl = import.meta.env.VITE_SENTINEL_URL || 'http://localhost:9000';
const authClient = new AuthClient(sentinelUrl);

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
              {met ? (
                <CheckCircle fontSize="small" color="success" />
              ) : (
                <Circle fontSize="small" color="disabled" />
              )}
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

function ChangePasswordPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { accessToken, clearMustChangePassword } = useAuthStore();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate password requirements
    const failedRule = PASSWORD_RULES.find(({ test }) => !test(newPassword));
    if (failedRule) {
      setError(t('changePassword.requirementsNotMet'));
      return;
    }

    if (newPassword !== confirmPassword) {
      setError(t('changePassword.passwordMismatch'));
      return;
    }

    if (!accessToken) {
      setError(t('changePassword.noSession'));
      return;
    }

    setLoading(true);

    try {
      await authClient.user.changePassword(accessToken, {
        current_password: currentPassword,
        new_password: newPassword,
      });
      // Clear the mustChangePassword flag and redirect
      clearMustChangePassword();
      setSuccess(true);
    } catch (err) {
      setError((err as Error).message || t('changePassword.errorMessage'));
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
              <CheckCircle sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
              <Typography variant="h4" component="h1" fontWeight={700}>
                {t('changePassword.successTitle')}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {t('changePassword.successMessage')}
              </Typography>
            </Box>

            <Button
              variant="contained"
              fullWidth
              size="large"
              onClick={() => navigate('/app/home')}
            >
              {t('changePassword.goToApp')}
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
              <LockIcon sx={{ fontSize: 32, color: '#fff' }} />
            </Box>
            <Typography variant="h4" component="h1" fontWeight={700}>
              {t('changePassword.title')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {t('changePassword.subtitle')}
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
              label={t('changePassword.currentPassword')}
              type={showCurrentPassword ? 'text' : 'password'}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
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
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      edge="end"
                      size="small"
                    >
                      {showCurrentPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            <div>
              <TextField
                label={t('changePassword.newPassword')}
                type={showNewPassword ? 'text' : 'password'}
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
                      <IconButton
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        edge="end"
                        size="small"
                      >
                        {showNewPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
              <PasswordRequirements password={newPassword} />
            </div>

            <TextField
              label={t('changePassword.confirmPassword')}
              type={showNewPassword ? 'text' : 'password'}
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
              {loading ? t('common.loading') : t('changePassword.submitButton')}
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}

export default ChangePasswordPage;