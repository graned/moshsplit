import {
  Card,
  CardContent,
  Typography,
  Box,
  Avatar,
} from '@mui/material';
import {
  TrendingUp as OwesIcon,
  TrendingDown as OwedIcon,
} from '@mui/icons-material';
import { UserBalanceItem } from '../../api/balances.api';

interface BalanceCardProps {
  balance: UserBalanceItem;
  userName?: string;
  onClick?: () => void;
}

export function BalanceCard({ balance, userName, onClick }: BalanceCardProps) {
  const formatAmount = (cents: number) => {
    const absCents = Math.abs(cents);
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD', // Should be dynamic based on group currency
    }).format(absCents / 100);
  };

  const isOwed = balance.balance_cents > 0; // positive = others owe you
  const isSettled = balance.balance_cents === 0;

  const getDisplayName = () => {
    if (userName) return userName;
    return balance.user_id.slice(0, 8);
  };

  return (
    <Card
      sx={{
        cursor: onClick ? 'pointer' : 'default',
        transition: 'transform 0.2s, box-shadow 0.2s',
        ...(onClick && {
          '&:hover': {
            transform: 'translateY(-2px)',
            boxShadow: 4,
          },
        }),
      }}
      onClick={onClick}
    >
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Avatar sx={{ bgcolor: 'primary.main' }}>
            {getDisplayName().charAt(0).toUpperCase()}
          </Avatar>
          <Box sx={{ flex: 1 }}>
            <Typography variant="subtitle1" fontWeight={600}>
              {getDisplayName()}
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                Paid: {formatAmount(balance.paid_cents)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Owes: {formatAmount(balance.owes_cents)}
              </Typography>
            </Box>
          </Box>
          <Box sx={{ textAlign: 'right' }}>
            {isSettled ? (
              <Typography variant="body2" color="success.main" fontWeight={600}>
                Settled
              </Typography>
            ) : isOwed ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <OwedIcon fontSize="small" color="success" />
                <Typography variant="h6" fontWeight={700} color="success.main">
                  {formatAmount(balance.balance_cents)}
                </Typography>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <OwesIcon fontSize="small" color="error" />
                <Typography variant="h6" fontWeight={700} color="error.main">
                  {formatAmount(balance.balance_cents)}
                </Typography>
              </Box>
            )}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}