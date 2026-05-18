import { Box, Typography, Button, Skeleton, alpha, useTheme } from '@mui/material';
import { Festival as FestivalIcon } from '@mui/icons-material';
import { EventStats } from '../../api/balances.api';

interface MyStandingCardProps {
  stats: EventStats | undefined;
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

export function MyStandingCard({ stats, isLoading, currency, onSettleUp }: MyStandingCardProps) {
  const theme = useTheme();

  if (isLoading) {
    return <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 3, bgcolor: 'background.paper' }} />;
  }

  const totalSpent = stats?.total_spent_cents ?? 0;
  const totalSettled = stats?.total_settled_cents ?? 0;
  const outstanding = stats?.outstanding_cents ?? 0;

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
      <FestivalIcon
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
        Festival Overview
      </Typography>

      {/* Balance rows */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <Typography sx={{ fontSize: '0.875rem', color: 'text.primary' }}>Total Spent</Typography>
          <Typography
            sx={{
              fontSize: '1.25rem',
              fontWeight: 700,
              color: 'text.primary',
              letterSpacing: '-0.01em',
            }}
          >
            {formatAmount(totalSpent, currency)}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <Typography sx={{ fontSize: '0.875rem', color: 'text.primary' }}>Total Settled</Typography>
          <Typography
            sx={{
              fontSize: '1.25rem',
              fontWeight: 700,
              color: 'success.main',
              letterSpacing: '-0.01em',
            }}
          >
            {formatAmount(totalSettled, currency)}
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
          <Typography sx={{ fontWeight: 700, color: 'text.primary' }}>Outstanding</Typography>
          <Typography
            sx={{
              fontSize: '1.25rem',
              fontWeight: 700,
              color: outstanding > 0 ? '#F59E0B' : 'success.main',
              letterSpacing: '-0.01em',
            }}
          >
            {formatAmount(outstanding, currency)}
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
