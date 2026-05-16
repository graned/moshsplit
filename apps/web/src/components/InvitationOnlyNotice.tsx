import { Box, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';

export function InvitationOnlyNotice() {
  const { t } = useTranslation();

  return (
    <Box
      sx={{
        mt: 3,
        p: 2,
        borderRadius: '2px',
        backgroundColor: 'rgba(245, 158, 11, 0.08)',
        border: '1px solid rgba(245, 158, 11, 0.25)',
      }}
    >
      <Typography
        variant="body2"
        sx={{
          color: 'primary.main',
          fontWeight: 500,
          textAlign: 'center',
          fontSize: '0.8125rem',
          letterSpacing: '0.03em',
        }}
      >
        {t('auth.login.invitationNotice')}
      </Typography>
    </Box>
  );
}
