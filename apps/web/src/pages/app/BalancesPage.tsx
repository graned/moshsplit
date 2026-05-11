import { Box, Typography, Card, CardContent } from '@mui/material';
import { AccountBalance as BalanceIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

function BalancesPage() {
  const { t } = useTranslation();

  return (
    <Box>
      <Typography variant="h4" fontWeight={700} sx={{ mb: 3 }}>
        {t('app.balances')}
      </Typography>

      <Card>
        <CardContent sx={{ py: 8, textAlign: 'center' }}>
          <Box
            sx={{
              width: 80,
              height: 80,
              borderRadius: '50%',
              backgroundColor: 'success.main',
              opacity: 0.1,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              mb: 3,
            }}
          >
            <BalanceIcon sx={{ fontSize: 40, color: 'success.main' }} />
          </Box>
          <Typography variant="h6" fontWeight={600} gutterBottom>
            {t('placeholder.balances')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('placeholder.balancesDesc')}
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}

export default BalancesPage;