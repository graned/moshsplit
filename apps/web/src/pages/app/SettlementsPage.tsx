import { Box, Typography, Card, CardContent } from '@mui/material';
import { SwapHoriz as SettlementIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

function SettlementsPage() {
  const { t } = useTranslation();

  return (
    <Box>
      <Typography variant="h4" fontWeight={700} sx={{ mb: 3 }}>
        {t('app.settlements')}
      </Typography>

      <Card>
        <CardContent sx={{ py: 8, textAlign: 'center' }}>
          <Box
            sx={{
              width: 80,
              height: 80,
              borderRadius: '50%',
              backgroundColor: 'info.main',
              opacity: 0.1,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              mb: 3,
            }}
          >
            <SettlementIcon sx={{ fontSize: 40, color: 'info.main' }} />
          </Box>
          <Typography variant="h6" fontWeight={600} gutterBottom>
            {t('placeholder.settlements')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('placeholder.settlementsDesc')}
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}

export default SettlementsPage;