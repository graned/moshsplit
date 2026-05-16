import { Typography, Box, Avatar, Tooltip, alpha, useTheme } from '@mui/material';
import { SwapHoriz as SwapIcon } from '@mui/icons-material';
import { SettlementActivity } from '../../api/activity.api';
import { UserInfo } from '../../api/users.api';
import { FeedCard } from './FeedCard';

const formatAmount = (cents: number, currency = 'EUR') => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(cents / 100);
};

interface SettlementFeedCardProps {
  activity: SettlementActivity;
  fromUser?: UserInfo;
  toUser?: UserInfo;
  currentUserId?: string;
  currency?: string;
  onClick?: () => void;
}

export function SettlementFeedCard({
  activity,
  fromUser,
  toUser,
  currentUserId,
  currency = 'EUR',
  onClick,
}: SettlementFeedCardProps) {
  const theme = useTheme();
  const fromName = fromUser?.email || activity.from_user;

  const toName = toUser?.email || activity.to_user;

  const isFromCurrentUser = activity.from_user === currentUserId;
  const isToCurrentUser = activity.to_user === currentUserId;

  const fromInitial = fromName.charAt(0).toUpperCase();
  const toInitial = toName.charAt(0).toUpperCase();

  const createdDate = new Date(activity.created_at);
  const isValidDate = !isNaN(createdDate.getTime());

  return (
    <FeedCard onClick={onClick} accentColor={theme.palette.success.main}>
      <Box
        sx={{
          width: 40,
          height: 40,
          borderRadius: 2,
          backgroundColor: alpha(theme.palette.success.main, 0.1),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          mt: 0.25,
        }}
      >
        <SwapIcon sx={{ color: 'success.main', fontSize: 20 }} />
      </Box>

      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, flexWrap: 'wrap' }}>
          <Typography variant="body1" fontWeight={500} sx={{ fontSize: '0.9rem' }}>
            <Tooltip title={fromName} arrow>
              <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                <Avatar
                  sx={{
                    width: 18,
                    height: 18,
                    fontSize: '0.55rem',
                    fontWeight: 700,
                    bgcolor: isFromCurrentUser ? 'primary.main' : 'action.disabledBackground',
                    color: isFromCurrentUser ? '#121212' : 'text.secondary',
                    display: 'inline-flex',
                  }}
                >
                  {fromInitial}
                </Avatar>
                <Box component="span" color={isFromCurrentUser ? 'primary.main' : 'text.primary'}>
                  {isFromCurrentUser ? 'You' : fromName}
                </Box>
              </Box>
            </Tooltip>{' '}
            <Typography component="span" color="text.secondary" sx={{ mx: 0.5 }}>
              settled with
            </Typography>{' '}
            <Tooltip title={toName} arrow>
              <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                <Avatar
                  sx={{
                    width: 18,
                    height: 18,
                    fontSize: '0.55rem',
                    fontWeight: 700,
                    bgcolor: isToCurrentUser ? 'primary.main' : 'action.disabledBackground',
                    color: isToCurrentUser ? '#121212' : 'text.secondary',
                    display: 'inline-flex',
                  }}
                >
                  {toInitial}
                </Avatar>
                <Box component="span" color={isToCurrentUser ? 'primary.main' : 'text.primary'}>
                  {isToCurrentUser ? 'you' : toName}
                </Box>
              </Box>
            </Tooltip>
          </Typography>
        </Box>
      </Box>

      <Box sx={{ textAlign: 'right', ml: 1, flexShrink: 0 }}>
        <Typography
          variant="h6"
          fontWeight={700}
          color="success.main"
          sx={{ fontSize: '1rem' }}
        >
          {formatAmount(activity.amount_cents, currency)}
        </Typography>
        {isValidDate && (
          <Typography variant="caption" color="text.disabled" sx={{ display: 'block' }}>
            {createdDate.toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            })}
          </Typography>
        )}
      </Box>
    </FeedCard>
  );
}
