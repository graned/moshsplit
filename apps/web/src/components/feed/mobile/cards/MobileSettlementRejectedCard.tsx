import { Typography, Box, useTheme } from '@mui/material';
import { Cancel as CancelIcon } from '@mui/icons-material';
import { SettlementRejectedActivity } from '../../../../api/activity.api';
import { UserInfo } from '../../../../api/users.api';
import { MobileFeedCard } from '../MobileFeedCard';

const formatAmount = (cents: number, currency = 'EUR') => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(cents / 100);
};

interface MobileSettlementRejectedCardProps {
  activity: SettlementRejectedActivity;
  fromUser?: UserInfo;
  toUser?: UserInfo;
  currentUserId?: string;
  currency?: string;
}

export function MobileSettlementRejectedCard({
  activity,
  fromUser,
  toUser,
  currentUserId,
  currency = 'EUR',
}: MobileSettlementRejectedCardProps) {
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
      accentColor={theme.palette.error.main}
      icon={
        <CancelIcon sx={{ color: 'error.main', fontSize: 18 }} />
      }
      rightContent={
        <Box>
          <Typography
            sx={{
              fontSize: '0.9rem',
              fontWeight: 700,
              color: 'error.main',
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
      <Typography
        sx={{
          fontSize: '0.85rem',
          fontWeight: 600,
          lineHeight: 1.3,
          mb: 0.25,
        }}
      >
        <Box component="span" color="error.main">
          Settlement rejected
        </Box>
      </Typography>

      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ fontSize: '0.65rem' }}
      >
        <Box component="span" color={isFromCurrentUser ? 'error.main' : 'text.primary'}>
          {displayFrom}
        </Box>{' '}
        <Typography component="span" color="text.disabled" sx={{ mx: 0.25, fontSize: '0.65rem' }}>
          →
        </Typography>{' '}
        <Box component="span" color={isToCurrentUser ? 'error.main' : 'text.primary'}>
          {displayTo}
        </Box>
      </Typography>
    </MobileFeedCard>
  );
}
