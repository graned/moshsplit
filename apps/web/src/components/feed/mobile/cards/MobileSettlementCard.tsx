import { Typography, Box, useTheme } from '@mui/material';
import { Gavel as GavelIcon } from '@mui/icons-material';
import { SettlementActivity } from '../../../../api/activity.api';
import { UserInfo } from '../../../../api/users.api';
import { MobileFeedCard } from '../MobileFeedCard';

const formatAmount = (cents: number, currency = 'EUR') => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(cents / 100);
};

interface MobileSettlementCardProps {
  activity: SettlementActivity;
  fromUser?: UserInfo;
  toUser?: UserInfo;
  currentUserId?: string;
  currency?: string;
  onClick?: () => void;
}

/**
 * Mobile-only simplified settlement card.
 * No Tooltip, no Avatar — just icon, from→to text, settlement label, amount, date.
 */
export function MobileSettlementCard({
  activity,
  fromUser,
  toUser,
  currentUserId,
  currency = 'EUR',
  onClick,
}: MobileSettlementCardProps) {
  const theme = useTheme();

  const fromName = fromUser
    ? `${fromUser.firstName} ${fromUser.lastName}`.trim() || fromUser.email
    : activity.from_user.slice(0, 8);

  const toName = toUser
    ? `${toUser.firstName} ${toUser.lastName}`.trim() || toUser.email
    : activity.to_user.slice(0, 8);

  const isFromCurrentUser = activity.from_user === currentUserId;
  const isToCurrentUser = activity.to_user === currentUserId;

  const displayFrom = isFromCurrentUser ? 'You' : fromName.split('@')[0];
  const displayTo = isToCurrentUser ? 'you' : toName.split('@')[0];

  const createdDate = new Date(activity.created_at);
  const isValidDate = !isNaN(createdDate.getTime());

  return (
    <MobileFeedCard
      onClick={onClick}
      accentColor={theme.palette.warning.main}
      icon={
        <GavelIcon sx={{ color: 'warning.main', fontSize: 18 }} />
      }
      rightContent={
        <Box>
          <Typography
            sx={{
              fontSize: '0.9rem',
              fontWeight: 700,
              color: 'warning.main',
              lineHeight: 1.2,
            }}
          >
            {formatAmount(activity.amount_cents, currency)}
          </Typography>
          {isValidDate && (
            <Typography
              sx={{
                display: 'block',
                fontSize: '0.6rem',
                color: 'text.disabled',
              }}
            >
              {createdDate.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              })}
            </Typography>
          )}
        </Box>
      }
    >
      {/* From → To */}
      <Typography
        sx={{
          fontSize: '0.85rem',
          fontWeight: 500,
          lineHeight: 1.3,
          mb: 0.25,
        }}
      >
        <Box component="span" color="warning.main">
          Honor requested:
        </Box>{' '}
        <Box component="span" color={isFromCurrentUser ? 'primary.main' : 'text.primary'}>
          {displayFrom}
        </Box>{' '}
        <Typography component="span" color="text.secondary" sx={{ mx: 0.25 }}>
          →
        </Typography>{' '}
        <Box component="span" color={isToCurrentUser ? 'primary.main' : 'text.primary'}>
          {displayTo}
        </Box>
      </Typography>

      {/* Settlement label */}
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ fontSize: '0.65rem' }}
      >
        Settlement
      </Typography>
    </MobileFeedCard>
  );
}
