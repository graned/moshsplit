import { Box, Typography, Card, CardContent, Grid2 as Grid } from '@mui/material';
import {
  Event as EventIcon,
  Receipt as ReceiptIcon,
  AccountBalance as BalanceIcon,
  SwapHoriz as SettlementIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

function HomePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const quickActions = [
    {
      title: t('app.events'),
      icon: <EventIcon sx={{ fontSize: 32 }} />,
      path: '/app/events',
      color: '#6366f1',
    },
    {
      title: t('app.expenses'),
      icon: <ReceiptIcon sx={{ fontSize: 32 }} />,
      path: '/app/expenses',
      color: '#f472b6',
    },
    {
      title: t('app.balances'),
      icon: <BalanceIcon sx={{ fontSize: 32 }} />,
      path: '/app/balances',
      color: '#22d3ee',
    },
    {
      title: t('app.settlements'),
      icon: <SettlementIcon sx={{ fontSize: 32 }} />,
      path: '/app/settlements',
      color: '#10b981',
    },
  ];

  return (
    <Box>
      <Typography variant="h4" fontWeight={700} gutterBottom>
        {t('app.home')}
      </Typography>

      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        Welcome back! Here's an overview of your shared expenses.
      </Typography>

      <Grid container spacing={3}>
        {quickActions.map((action) => (
          <Grid size={{ xs: 6, sm: 3 }} key={action.path}>
            <Card
              onClick={() => navigate(action.path)}
              sx={{
                cursor: 'pointer',
                transition: 'transform 0.2s, box-shadow 0.2s',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: `0 8px 24px ${action.color}40`,
                },
              }}
            >
              <CardContent sx={{ textAlign: 'center', py: 4 }}>
                <Box
                  sx={{
                    width: 64,
                    height: 64,
                    borderRadius: 3,
                    backgroundColor: `${action.color}20`,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mb: 2,
                    color: action.color,
                  }}
                >
                  {action.icon}
                </Box>
                <Typography variant="h6" fontWeight={600}>
                  {action.title}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}

export default HomePage;
