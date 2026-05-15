import { useState } from 'react';
import { Link as RouterLink } from 'react-router';
import {
  Box,
  TextField,
  Button,
  Typography,
  InputAdornment,
  IconButton,
  Link,
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  Email as EmailIcon,
  Lock as LockIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import type { LoginCredentials } from '../pages/auth/types';

interface LoginFormProps {
  onSubmit: (credentials: LoginCredentials) => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

export function LoginForm({ onSubmit, isLoading, error }: LoginFormProps) {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit({ email, password });
  };

  return (
    <Box
      component="form"
      onSubmit={handleSubmit}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2.5,
        width: '100%',
      }}
    >
      {/* Email Field */}
      <TextField
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder={t('auth.login.emailPlaceholder')}
        required
        fullWidth
        autoComplete="email"
        autoFocus
        sx={{
          '& .MuiFilledInput-root': {
            backgroundColor: 'rgba(255, 255, 255, 0.04)',
            borderRadius: '4px',
            minHeight: 56,
            '&:hover': {
              backgroundColor: 'rgba(255, 255, 255, 0.06)',
            },
            '&.Mui-focused': {
              backgroundColor: 'rgba(255, 255, 255, 0.06)',
              boxShadow: '0 0 0 2px rgba(245, 158, 11, 0.3)',
            },
          },
          '& .MuiFilledInput-input': {
            color: 'text.primary',
            '&::placeholder': {
              color: 'text.secondary',
              opacity: 0.7,
            },
          },
        }}
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
        placeholder={t('auth.login.password') || 'Password'}
        required
        fullWidth
        autoComplete="current-password"
        sx={{
          '& .MuiFilledInput-root': {
            backgroundColor: 'rgba(255, 255, 255, 0.04)',
            borderRadius: '4px',
            minHeight: 56,
            '&:hover': {
              backgroundColor: 'rgba(255, 255, 255, 0.06)',
            },
            '&.Mui-focused': {
              backgroundColor: 'rgba(255, 255, 255, 0.06)',
              boxShadow: '0 0 0 2px rgba(245, 158, 11, 0.3)',
            },
          },
          '& .MuiFilledInput-input': {
            color: 'text.primary',
            '&::placeholder': {
              color: 'text.secondary',
              opacity: 0.7,
            },
          },
        }}
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

      {/* Forgot Password Link */}
      <Box sx={{ textAlign: 'right', mt: -1 }}>
        <Link
          component={RouterLink}
          to="/forgot-password"
          variant="body2"
          sx={{
            color: 'text.secondary',
            textDecoration: 'none',
            fontSize: '0.8125rem',
            '&:hover': {
              color: 'primary.main',
              textDecoration: 'underline',
            },
          }}
        >
          {t('auth.login.forgotPassword')}
        </Link>
      </Box>

      {/* Error Message */}
      {error && (
        <Typography
          variant="body2"
          sx={{
            color: 'error.main',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            borderRadius: '4px',
            p: 1.5,
            textAlign: 'center',
            fontSize: '0.875rem',
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
        {isLoading ? t('common.loading') : t('auth.login.button')}
      </Button>
    </Box>
  );
}
