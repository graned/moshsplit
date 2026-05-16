import { Box, Typography, Button, Skeleton, alpha, useTheme } from '@mui/material';
import { AccountBalanceWallet as WalletIcon } from '@mui/icons-material';
import { UserBalanceResponse } from '../../api/balances.api';

interface MyStandingCardProps {
  balance: UserBalanceResponse | undefined;
  isLoading: boolean;
  currency: string;
  onSettleUp?: () => void;
}

const formatAmount = (cents: number, currency = 'EUR') => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(cents / 100);
};

export function MyStandingCard({ balance, isLoading, currency, onSettleUp }: MyStandingCardProps) {
  const theme = useTheme();

  if (isLoading) {
    return <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 3, bgcolor: 'background.paper' }} />;
  }

  const youOwe = balance?.owes_cents ?? 0;
  const youAreOwed = balance?.paid_cents ?? 0;
  const netBalance = balance?.balance_cents ?? 0;

  return (
    <Box
      sx={{
        bgcolor: 'elevated.main',
        borderRadius: 3,
        border: '1px solid',
        borderColor: alpha('#534434', 0.1),
        p: 3,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Watermark icon */}
      <WalletIcon
        sx={{
          position: 'absolute',
          top: 16,
          right: 16,
          fontSize: 64,
          opacity: 0.1,
          color: 'text.primary',
        }}
      />

      {/* Header */}
      <Typography
        sx={{
          fontSize: '0.625rem',
          fontWeight: 700,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          color: 'text.secondary',
          mb: 3,
        }}
      >
        My Standing
      </Typography>

      {/* Balance rows */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <Typography sx={{ fontSize: '0.875rem', color: 'text.primary' }}>You owe</Typography>
          <Typography
            sx={{
              fontSize: '1.25rem',
              fontWeight: 700,
              color: 'error.main',
              letterSpacing: '-0.01em',
            }}
          >
            {formatAmount(youOwe, currency)}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <Typography sx={{ fontSize: '0.875rem', color: 'text.primary' }}>You are owed</Typography>
          <Typography
            sx={{
              fontSize: '1.25rem',
              fontWeight: 700,
              color: 'success.main',
              letterSpacing: '-0.01em',
            }}
          >
            {formatAmount(youAreOwed, currency)}
          </Typography>
        </Box>

        {/* Divider */}
        <Box
          sx={{
            mt: 2,
            pt: 2,
            borderTop: '1px solid',
            borderColor: alpha('#534434', 0.2),
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Typography sx={{ fontWeight: 700, color: 'text.primary' }}>Net Balance</Typography>
          <Typography
            sx={{
              fontSize: '1.25rem',
              fontWeight: 700,
              color: netBalance >= 0 ? 'success.main' : 'primary.main',
              letterSpacing: '-0.01em',
            }}
          >
            {netBalance >= 0 ? '+' : ''}
            {formatAmount(netBalance, currency)}
          </Typography>
        </Box>
      </Box>

      {/* Settle Up button */}
      {onSettleUp && (
        <Button
          fullWidth
          variant="outlined"
          onClick={onSettleUp}
          sx={{
            mt: 3,
            py: 1,
            fontWeight: 700,
            fontSize: '0.75rem',
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            borderColor: 'text.primary',
            color: 'text.primary',
            '&:hover': {
              borderColor: 'primary.main',
              bgcolor: alpha(theme.palette.primary.main, 0.08),
              color: 'primary.main',
            },
          }}
        >
          Settle Up Now
        </Button>
      )}
    </Box>
  );
}
