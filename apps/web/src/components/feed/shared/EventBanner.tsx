import { Box, Typography, Skeleton, alpha, useTheme } from '@mui/material';
import { GlassCard } from '../../shared/cards/GlassCard';
import { Group } from '../../../api/groups.api';
import { EventStats } from '../../../api/balances.api';

interface EventBannerProps {
  event: Group | undefined;
  stats: EventStats | undefined;
  isLoading: boolean;
  currency: string;
}

const formatAmount = (cents: number, currency = 'EUR') => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(cents / 100);
};

const DEFAULT_BANNER = 'linear-gradient(135deg, #4A2F0A 0%, #3D2208 50%, #1A1A1A 100%)';

export function EventBanner({ event, stats, isLoading, currency }: EventBannerProps) {
  const theme = useTheme();

  // Use banner image from event.images.banner, or fall back to first gallery image
  const bannerUrl = event?.images?.banner?.url ?? event?.images?.gallery?.[0]?.url;
  const bgStyle = bannerUrl
    ? {
        backgroundImage: `url(${bannerUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }
    : { background: DEFAULT_BANNER };

  if (isLoading) {
    return (
      <Skeleton
        variant="rectangular"
        sx={{
          height: { xs: 180, sm: 200, md: 240 },
          width: '100%',
          borderRadius: 0,
          bgcolor: 'background.default',
        }}
      />
    );
  }

  const eventName = event?.name || 'Unknown Event';
  const eventDescription = event?.description || '';
  const totalDamage = stats?.total_spent_cents ?? 0;
  const yourShare = stats?.your_share_cents ?? 0;

  return (
    <Box
      sx={{
        position: 'relative',
        height: { xs: 180, sm: 200, md: 240 },
        width: '100%',
        overflow: 'hidden',
        ...bgStyle,
      }}
    >
      {/* Gradient overlay — fade from top (opaque) to bottom (transparent) */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          background: bannerUrl
            ? 'linear-gradient(to bottom, rgba(18, 18, 18, 0.8) 0%, rgba(18, 18, 18, 0.4) 50%, rgba(18, 18, 18, 0) 100%)'
            : 'linear-gradient(to bottom, rgba(18, 18, 18, 0.7) 0%, rgba(18, 18, 18, 0.3) 50%, rgba(18, 18, 18, 0) 100%)',
        }}
      />

      {/* Bottom fade-out edge */}
      <Box
        sx={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 100,
          background: 'linear-gradient(to bottom, transparent, rgba(18, 18, 18, 1))',
        }}
      />

      {/* Content */}
      <Box
        sx={{
          position: 'relative',
          width: '100%',
          maxWidth: 1280,
          mx: 'auto',
          px: { xs: 2, md: 3 },
          height: '100%',
          display: 'flex',
          alignItems: 'flex-end',
          pb: 3,
        }}
      >
        {/* Left: Event info */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1, minWidth: 0 }}>
          {/* Event icon */}
          <GlassCard
            sx={{
              width: 64,
              height: 64,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              borderColor: alpha(theme.palette.primary.main, 0.2),
            }}
          >
            <Typography
              sx={{
                fontSize: '2rem',
                lineHeight: 1,
              }}
            >
              🔥
            </Typography>
          </GlassCard>

          <Box sx={{ minWidth: 0 }}>
            <Typography
              variant="h3"
              sx={{
                color: 'text.primary',
                letterSpacing: '-0.02em',
                lineHeight: 1.2,
                fontWeight: 600,
              }}
            >
              {eventName}
            </Typography>
            {eventDescription && (
              <Typography
                sx={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  color: 'primary.main',
                  mt: 0.5,
                }}
              >
                {eventDescription}
              </Typography>
            )}
          </Box>
        </Box>

        {/* Right: Stat cards (hidden below md) */}
        <Box
          sx={{
            display: { xs: 'none', md: 'flex' },
            gap: 3,
            flexShrink: 0,
          }}
        >
          <GlassCard
            sx={{
              px: 3,
              py: 1.5,
              border: `1px solid ${alpha('rgba(255, 255, 255, 0.1)', 0.5)}`,
              boxShadow: 'inset 0 1px 1px rgba(255, 255, 255, 0.05)',
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
              Total Damage
            </Typography>
            <Typography
              variant="h5"
              sx={{
                color: 'primary.main',
                fontWeight: 700,
                letterSpacing: '-0.01em',
                lineHeight: 1.2,
              }}
            >
              {formatAmount(totalDamage, currency)}
            </Typography>
          </GlassCard>

          <GlassCard
            sx={{
              px: 3,
              py: 1.5,
              border: `1px solid ${alpha('rgba(255, 255, 255, 0.1)', 0.5)}`,
              boxShadow: 'inset 0 1px 1px rgba(255, 255, 255, 0.05)',
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
              Your Share
            </Typography>
            <Typography
              variant="h5"
              sx={{
                color: 'text.primary',
                fontWeight: 700,
                letterSpacing: '-0.01em',
                lineHeight: 1.2,
              }}
            >
              {formatAmount(yourShare, currency)}
            </Typography>
          </GlassCard>
        </Box>
      </Box>
    </Box>
  );
}
