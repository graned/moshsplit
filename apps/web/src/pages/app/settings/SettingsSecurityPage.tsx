import { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  Alert,
  Switch,
  Chip,
} from '@mui/material';
import {
  Security as SecurityIcon,
  Lock as LockIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { settingsApi } from '../../../api/settings.api';

function SettingsSecurityPage() {
  const { t } = useTranslation();
  // Note: MFA status is not directly available in the auth store
  // For now, we'll show the MFA feature as disabled/not configured
  const mfaEnabled = false;

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(false);

    if (newPassword !== confirmPassword) {
      setPasswordError(t('resetPassword.passwordMismatch'));
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError(t('resetPassword.passwordRequirements'));
      return;
    }

    setPasswordLoading(true);

    try {
      await settingsApi.changePassword({
        currentPassword,
        newPassword,
      });
      setPasswordSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPasswordError((err as Error).message || t('settings.security.passwordError'));
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <Box>
      <Typography variant="h4" fontWeight={700} gutterBottom>
        {t('settings.security.title')}
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        {t('settings.security.subtitle')}
      </Typography>

      <Card sx={{ mb: 4 }}>
        <CardContent sx={{ p: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
            <SecurityIcon color="primary" />
            <Typography variant="h6" fontWeight={600}>
              {t('settings.security.mfa')}
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box>
              <Typography variant="body1" fontWeight={500}>
                {t('settings.security.mfa')}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {t('settings.security.mfaDescription')}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Chip
                label={mfaEnabled ? t('settings.security.mfaEnabled') : t('settings.security.mfaDisabled')}
                color={mfaEnabled ? 'success' : 'default'}
                size="small"
              />
              <Switch
                checked={mfaEnabled}
                // TODO: Implement MFA toggle
                disabled
              />
            </Box>
          </Box>
        </CardContent>
      </Card>

      <Card>
        <CardContent sx={{ p: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
            <LockIcon color="primary" />
            <Typography variant="h6" fontWeight={600}>
              {t('settings.security.changePassword')}
            </Typography>
          </Box>

          {passwordError && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {passwordError}
            </Alert>
          )}

          {passwordSuccess && (
            <Alert severity="success" sx={{ mb: 3 }}>
              {t('settings.security.passwordSuccess')}
            </Alert>
          )}

          <Box
            component="form"
            onSubmit={handlePasswordSubmit}
            sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}
          >
            <TextField
              label={t('settings.security.currentPassword')}
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              fullWidth
              autoComplete="current-password"
            />

            <TextField
              label={t('settings.security.newPassword')}
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              fullWidth
              autoComplete="new-password"
              helperText={t('resetPassword.passwordRequirements')}
            />

            <TextField
              label={t('settings.security.confirmPassword')}
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              fullWidth
              autoComplete="new-password"
            />

            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                type="submit"
                variant="contained"
                disabled={passwordLoading || !currentPassword || !newPassword || !confirmPassword}
              >
                {passwordLoading ? t('common.loading') : t('settings.security.changePassword')}
              </Button>
            </Box>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}

export default SettingsSecurityPage;