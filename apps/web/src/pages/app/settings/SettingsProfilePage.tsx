import { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  Alert,
  Avatar,
  InputAdornment,
} from '@mui/material';
import {
  Person as PersonIcon,
  Email as EmailIcon,
  Edit as EditIcon,
  Save as SaveIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@moshsplit/auth-react';
import { usersApi } from '../../../api/users.api';

function SettingsProfilePage() {
  const { t } = useTranslation();
  const { firstName, lastName, userEmail, setUserProfile } = useAuthStore();

  const [name, setName] = useState(firstName && lastName ? `${firstName} ${lastName}` : '');
  const [email] = useState(userEmail || '');
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setLoading(true);

    try {
      const response = await usersApi.updateProfile({ name: name.trim() });
      // Update the store with the new profile data
      if (response.user) {
        setUserProfile(response.user.email, response.user.name?.split(' ')[0] || null, response.user.name?.split(' ').slice(1).join(' ') || null);
      }
      setSuccess(true);
      setIsEditing(false);
    } catch (err) {
      setError((err as Error).message || t('settings.profile.updateError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <Typography variant="h4" fontWeight={700} gutterBottom>
        {t('settings.profile.title')}
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        {t('settings.profile.subtitle')}
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 3 }}>
          {t('settings.profile.updateSuccess')}
        </Alert>
      )}

      <Card>
        <CardContent sx={{ p: 4 }}>
          <Box
            component="form"
            onSubmit={handleSubmit}
            sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <Avatar
                sx={{
                  width: 80,
                  height: 80,
                  fontSize: '2rem',
                  bgcolor: 'primary.main',
                }}
              >
                {firstName?.charAt(0)?.toUpperCase() || userEmail?.charAt(0)?.toUpperCase() || '?'}
              </Avatar>
              <Box>
                <Typography variant="h6" fontWeight={600}>
                  {t('settings.profile.avatar')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Upload a photo
                </Typography>
              </Box>
            </Box>

            <TextField
              label={t('settings.profile.name')}
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!isEditing}
              fullWidth
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <PersonIcon color="action" />
                  </InputAdornment>
                ),
              }}
            />

            <TextField
              label={t('settings.profile.email')}
              value={email}
              disabled
              fullWidth
              helperText={t('settings.profile.emailReadOnly')}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <EmailIcon color="action" />
                  </InputAdornment>
                ),
              }}
            />

            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
              {isEditing ? (
                <>
                  <Button
                    variant="outlined"
                    onClick={() => {
                      setName(firstName && lastName ? `${firstName} ${lastName}` : '');
                      setIsEditing(false);
                    }}
                  >
                    {t('common.cancel')}
                  </Button>
                  <Button
                    type="submit"
                    variant="contained"
                    disabled={loading}
                    startIcon={<SaveIcon />}
                  >
                    {loading ? t('common.loading') : t('common.save')}
                  </Button>
                </>
              ) : (
                <Button
                  variant="outlined"
                  startIcon={<EditIcon />}
                  onClick={() => setIsEditing(true)}
                >
                  {t('common.edit')}
                </Button>
              )}
            </Box>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}

export default SettingsProfilePage;