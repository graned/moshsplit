import { Card, CardContent } from '@mui/material';
import { AuthHeroLogo } from './AuthHeroLogo';
import { LoginForm } from './LoginForm';
import { InvitationOnlyNotice } from './InvitationOnlyNotice';
import { useTranslation } from 'react-i18next';
import type { LoginCredentials } from '../types';

interface LoginCardProps {
  onSubmit: (credentials: LoginCredentials) => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

export function LoginCard({ onSubmit, isLoading, error }: LoginCardProps) {
  const { t } = useTranslation();

  return (
    <Card
      sx={{
        width: '100%',
        maxWidth: 420,
        backgroundColor: 'rgba(26, 26, 26, 0.95)',
        border: '1px solid rgba(245, 158, 11, 0.2)',
        borderRadius: '4px',
        boxShadow: '0 24px 80px rgba(0, 0, 0, 0.55)',
        backdropFilter: 'blur(10px)',
        position: 'relative',
        overflow: 'visible',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'linear-gradient(145deg, rgba(255,255,255,0.03) 0%, transparent 50%, transparent 100%)',
          pointerEvents: 'none',
          borderRadius: '4px',
        },
      }}
    >
      <CardContent
        sx={{
          p: { xs: 3, sm: 4 },
        }}
      >
        <AuthHeroLogo
          title={t('auth.login.title')}
          subtitle={t('auth.login.tagline')}
        />

        <LoginForm
          onSubmit={onSubmit}
          isLoading={isLoading}
          error={error}
        />

        <InvitationOnlyNotice />
      </CardContent>
    </Card>
  );
}