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
                </Box>
        );
}
