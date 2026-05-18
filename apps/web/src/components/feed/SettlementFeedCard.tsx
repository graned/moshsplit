import { Typography, Box, Avatar, Tooltip, alpha, useTheme, useMediaQuery } from '@mui/material';
import { Gavel as GavelIcon } from '@mui/icons-material';
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
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const fromName = fromUser
    ? `${fromUser.firstName} ${fromUser.lastName}`.trim() || fromUser.email
    : activity.from_user.slice(0, 8);

  const toName = toUser
    ? `${toUser.firstName} ${toUser.lastName}`.trim() || toUser.email
    : activity.to_user.slice(0, 8);

  const isFromCurrentUser = activity.from_user === currentUserId;
  const isToCurrentUser = activity.to_user === currentUserId;

  const fromInitial = fromName.charAt(0).toUpperCase();
  const toInitial = toName.charAt(0).toUpperCase();

  const createdDate = new Date(activity.created_at);
  const isValidDate = !isNaN(createdDate.getTime());

  return (
    <FeedCard onClick={onClick} accentColor={theme.palette.warning.main}>
      <Box
        sx={{
          width: isMobile ? 36 : 40,
          height: isMobile ? 36 : 40,
          borderRadius: isMobile ? 1.5 : 2,
          backgroundColor: alpha(theme.palette.warning.main, 0.1),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          mt: 0.25,
        }}
      >
        <GavelIcon sx={{ color: 'warning.main', fontSize: isMobile ? 18 : 20 }} />
      </Box>

      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5, flexWrap: 'wrap' }}>
          <Typography variant="body1" fontWeight={500} sx={{ fontSize: isMobile ? '0.8rem' : '0.9rem' }}>
            <Tooltip title="Honor Settlement Requested" arrow>
              <Box component="span" color="warning.main">Honor requested:</Box>
            </Tooltip>{' '}
            <Tooltip title={fromName} arrow>
              <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                <Avatar
                  sx={{
                    width: isMobile ? 16 : 18,
                    height: isMobile ? 16 : 18,
                    fontSize: isMobile ? '0.5rem' : '0.55rem',
                    fontWeight: 700,
                    bgcolor: isFromCurrentUser ? 'primary.main' : 'action.disabledBackground',
                    color: isFromCurrentUser ? '#121212' : 'text.secondary',
                    display: 'inline-flex',
                  }}
                >
                  {fromInitial}
                </Avatar>
                <Box component="span" color={isFromCurrentUser ? 'primary.main' : 'text.primary'}>
                  {isFromCurrentUser ? 'You' : fromName.split('@')[0]}
                </Box>
              </Box>
            </Tooltip>{' '}
            <Typography component="span" color="text.secondary" sx={{ mx: 0.5 }}>
              →
            </Typography>{' '}
            <Tooltip title={toName} arrow>
              <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                <Avatar
                  sx={{
                    width: isMobile ? 16 : 18,
                    height: isMobile ? 16 : 18,
                    fontSize: isMobile ? '0.5rem' : '0.55rem',
                    fontWeight: 700,
                    bgcolor: isToCurrentUser ? 'primary.main' : 'action.disabledBackground',
                    color: isToCurrentUser ? '#121212' : 'text.secondary',
                    display: 'inline-flex',
                  }}
                >
                  {toInitial}
                </Avatar>
                <Box component="span" color={isToCurrentUser ? 'primary.main' : 'text.primary'}>
                  {isToCurrentUser ? 'you' : toName.split('@')[0]}
                </Box>
              </Box>
            </Tooltip>
          </Typography>
        </Box>

        <Typography variant="caption" color="text.secondary" sx={{ fontSize: isMobile ? '0.65rem' : '0.75rem' }}>
          Awaiting the council's verdict.
        </Typography>
      </Box>

      <Box sx={{ textAlign: 'right', ml: isMobile ? 0.75 : 1, flexShrink: 0 }}>
        <Typography
          variant="h6"
          fontWeight={700}
          color="warning.main"
          sx={{ fontSize: isMobile ? '0.9rem' : '1rem', lineHeight: 1.2 }}
        >
          {formatAmount(activity.amount_cents, currency)}
        </Typography>
        {isValidDate && (
          <Typography variant="caption" color="text.disabled" sx={{ display: 'block', fontSize: isMobile ? '0.6rem' : '0.65rem' }}>
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
