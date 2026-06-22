import { Typography, Box, useTheme } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { Shield as ShieldIcon } from '@mui/icons-material';
import { HonorRestoredActivity } from '../../../../api/activity.api';
import { UserInfo } from '../../../../api/users.api';
import { MobileFeedCard } from '../MobileFeedCard';

const formatAmount = (cents: number, currency = 'EUR') => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(cents / 100);
};

interface MobileHonorCardProps {
  activity: HonorRestoredActivity;
  fromUser?: UserInfo;
  toUser?: UserInfo;
  approvedByUser?: UserInfo;
  currentUserId?: string;
  currency?: string;
}

/**
 * Mobile-only simplified honor restored card.
 * No Tooltip, no Avatar — just icon, "Honor restored!" heading, from→to, amount, date.
 */
export function MobileHonorCard({
  activity,
  fromUser,
  toUser,
  currentUserId,
  currency = 'EUR',
}: MobileHonorCardProps) {
  const { t } = useTranslation();
  const theme = useTheme();

  const fromName = fromUser
    ? `${fromUser.firstName} ${fromUser.lastName}`.trim() || fromUser.email
    : activity.from_user.slice(0, 8);

  const toName = toUser
    ? `${toUser.firstName} ${toUser.lastName}`.trim() || toUser.email
    : activity.to_user.slice(0, 8);

  const isFromCurrentUser = activity.from_user === currentUserId;
  const isToCurrentUser = activity.to_user === currentUserId;

  const displayFrom = isFromCurrentUser ? t('components.common.you') : fromName.split('@')[0];
  const displayTo = isToCurrentUser ? t('components.common.youLower') : toName.split('@')[0];

  const createdDate = new Date(activity.created_at);
  const isValidDate = !isNaN(createdDate.getTime());

  return (
    <MobileFeedCard
      accentColor={theme.palette.primary.main}
      icon={
        <ShieldIcon sx={{ color: 'primary.main', fontSize: 18 }} />
      }
      rightContent={
        <Box>
          <Typography
            sx={{
              fontSize: '0.9rem',
              fontWeight: 700,
              color: 'primary.main',
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
      {/* Honor restored heading */}
      <Typography
        sx={{
          fontSize: '0.85rem',
          fontWeight: 600,
          lineHeight: 1.3,
          mb: 0.25,
        }}
      >
        <Box component="span" color="primary.main">
          {t('components.honorCard.honorRestored')}
        </Box>
      </Typography>

      {/* From → To */}
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ fontSize: '0.65rem' }}
      >
        <Box component="span" color={isFromCurrentUser ? 'primary.main' : 'text.primary'}>
          {displayFrom}
        </Box>{' '}
        <Typography component="span" color="text.disabled" sx={{ mx: 0.25, fontSize: '0.65rem' }}>
          →
        </Typography>{' '}
        <Box component="span" color={isToCurrentUser ? 'primary.main' : 'text.primary'}>
          {displayTo}
        </Box>
      </Typography>
    </MobileFeedCard>
  );
}
