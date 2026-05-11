import { Box, Typography, Card, CardContent, Button } from '@mui/material';
import { Receipt as ReceiptIcon, Add as AddIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

function ExpensesPage() {
  const { t } = useTranslation();

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" fontWeight={700}>
          {t('app.expenses')}
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />}>
          Add Expense
        </Button>
      </Box>

      <Card>
        <CardContent sx={{ py: 8, textAlign: 'center' }}>
          <Box
            sx={{
              width: 80,
              height: 80,
              borderRadius: '50%',
              backgroundColor: 'secondary.main',
              opacity: 0.1,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              mb: 3,
            }}
          >
            <ReceiptIcon sx={{ fontSize: 40, color: 'secondary.main' }} />
          </Box>
          <Typography variant="h6" fontWeight={600} gutterBottom>
            {t('placeholder.expenses')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('placeholder.expensesDesc')}
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}

export default ExpensesPage;