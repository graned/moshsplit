import { Typography, Box, alpha } from '@mui/material';
import { TrendingUp as TrendingUpIcon, TrendingDown as TrendingDownIcon } from '@mui/icons-material';
import { useUsers } from '../../../../hooks/useUserCache';
import { MobileFeedCard } from '../MobileFeedCard';

const formatAmount = (cents: number, currency = 'EUR') =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);

interface MobileBalanceCardProps {
  userId: string;
  amountCents: number;
  isIncoming: boolean;
  currency?: string;
  onClick?: () => void;
}

export function MobileBalanceCard({
  userId,
  amountCents,
  isIncoming,
  currency = 'EUR',
  onClick,
}: MobileBalanceCardProps) {
  const userMap = useUsers([userId]);
  const user = userMap[userId];
  const displayName = user
    ? `${user.firstName} ${user.lastName}`.trim() || user.email
    : userId.slice(0, 8);

  const accentColor = isIncoming ? '#10b981' : '#ef4444';
  const Icon = isIncoming ? TrendingUpIcon : TrendingDownIcon;

  return (
    <MobileFeedCard
      accentColor={accentColor}
      icon={
        <Icon
          sx={{
            color: accentColor,
            fontSize: 18,
            transform: isIncoming ? 'rotate(-15deg)' : 'rotate(15deg)',
          }}
        />
      }
      onClick={onClick}
      rightContent={
        <Box>
          <Typography
            sx={{
              fontSize: '0.9rem',
              fontWeight: 700,
              color: accentColor,
              lineHeight: 1.2,
            }}
          >
            {formatAmount(amountCents, currency)}
          </Typography>
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              px: 0.75,
              py: 0.25,
              borderRadius: 1,
              backgroundColor: alpha(accentColor, 0.12),
              border: '1px solid',
              borderColor: alpha(accentColor, 0.25),
              mt: 0.5,
            }}
          >
            <Typography
              sx={{
                fontSize: '0.6rem',
                fontWeight: 700,
                color: accentColor,
                textTransform: 'uppercase',
                letterSpacing: '0.03em',
                lineHeight: 1,
              }}
            >
              {isIncoming ? 'owed' : 'due'}
            </Typography>
          </Box>
        </Box>
      }
    >
      <Typography
        sx={{
          fontSize: '0.85rem',
          fontWeight: 600,
          lineHeight: 1.3,
          mb: 0.25,
        }}
      >
        {displayName.split('@')[0]}
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
        {isIncoming ? 'owes you' : 'you owe'}
      </Typography>
    </MobileFeedCard>
  );
}