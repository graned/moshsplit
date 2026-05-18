import { Box, Typography, Skeleton, LinearProgress, alpha } from '@mui/material';
import { EventStats } from '../../../api/balances.api';

interface FestivalMetricsCardProps {
  stats: EventStats | undefined;
  isLoading: boolean;
  currency: string;
  topSpenderName?: string;
  avgPerDay?: number;
}

const formatAmount = (cents: number, currency = 'EUR') => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(cents / 100);
};

export function FestivalMetricsCard({
  stats,
  isLoading,
  currency,
  topSpenderName,
  avgPerDay,
}: FestivalMetricsCardProps) {
  if (isLoading) {
    return <Skeleton variant="rectangular" height={160} sx={{ borderRadius: 3, bgcolor: 'background.paper' }} />;
  }

  const totalPaid = stats?.total_settled_cents ?? 0;
  const totalOwed = stats?.outstanding_cents ?? 0;
  const progress = totalPaid + totalOwed > 0 ? totalPaid / (totalPaid + totalOwed) : 0;
  const progressPercent = Math.round(progress * 100);

  return (
    <Box
      sx={{
        bgcolor: 'background.paper',
        borderRadius: 3,
        border: '1px solid',
        borderColor: alpha('#534434', 0.1),
        p: 3,
      }}
    >
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
        Festival Metrics
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {/* Settlement Progress */}
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography
              sx={{
                fontSize: '0.625rem',
                fontWeight: 700,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                color: 'text.secondary',
              }}
            >
              Settlement Progress
            </Typography>
            <Typography
              sx={{
                fontSize: '0.625rem',
                fontWeight: 700,
                color: 'text.primary',
              }}
            >
              {progressPercent}%
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={progressPercent}
            sx={{
              height: 6,
              borderRadius: 3,
              bgcolor: 'elevatedHighest',
              '& .MuiLinearProgress-bar': {
                bgcolor: 'primary.main',
                borderRadius: 3,
              },
            }}
          />
        </Box>

        {/* Sub-cards grid */}
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
          {/* Avg/Day */}
          <Box
            sx={{
              bgcolor: 'surface.low',
              borderRadius: 2,
              border: '1px solid',
              borderColor: alpha('rgba(255, 255, 255, 0.08)', 0.5),
              boxShadow: 'inset 0 1px 1px rgba(255, 255, 255, 0.05)',
              p: 1.5,
            }}
          >
            <Typography
              sx={{
                fontSize: '0.625rem',
                fontWeight: 700,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                color: 'text.secondary',
                mb: 0.5,
              }}
            >
              Avg/Day
            </Typography>
            <Typography
              sx={{
                fontSize: '1.125rem',
                fontWeight: 700,
                color: 'text.primary',
              }}
            >
              {avgPerDay ? formatAmount(avgPerDay, currency) : '—'}
            </Typography>
          </Box>

          {/* Top Spender */}
          <Box
            sx={{
              bgcolor: 'surface.low',
              borderRadius: 2,
              border: '1px solid',
              borderColor: alpha('rgba(255, 255, 255, 0.08)', 0.5),
              boxShadow: 'inset 0 1px 1px rgba(255, 255, 255, 0.05)',
              p: 1.5,
            }}
          >
            <Typography
              sx={{
                fontSize: '0.625rem',
                fontWeight: 700,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                color: 'text.secondary',
                mb: 0.5,
              }}
            >
              Top Spender
            </Typography>
            <Typography
              sx={{
                fontSize: '1.125rem',
                fontWeight: 700,
                color: 'text.primary',
              }}
            >
              {topSpenderName || '—'}
            </Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
