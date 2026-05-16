import {
  Typography,
  Box,
  Avatar,
  Chip,
  Tooltip,
} from '@mui/material';
import {
  SwapHoriz as SwapIcon,
  CheckCircle as CheckIcon,
  Pending as PendingIcon,
} from '@mui/icons-material';
import { SettlementActivity } from '../../api/activity.api';
import { UserInfo } from '../../api/users.api';
import { FeedCard } from './FeedCard';

const formatAmount = (cents: number, currency = 'EUR') => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(cents / 100);
};

function getStatusColor(status: string): 'success' | 'warning' | 'default' {
  switch (status.toLowerCase()) {
    case 'settled':
    case 'confirmed':
      return 'success';
    case 'pending':
      return 'warning';
    default:
      return 'default';
  }
}

function getStatusIcon(status: string) {
  switch (status.toLowerCase()) {
    case 'settled':
    case 'confirmed':
      return <CheckIcon sx={{ fontSize: 14 }} />;
    case 'pending':
      return <PendingIcon sx={{ fontSize: 14 }} />;
    default:
      return <SwapIcon sx={{ fontSize: 14 }} />;
  }
}

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
  const fromName = fromUser
    ? `${fromUser.firstName} ${fromUser.lastName}`.trim() || fromUser.email
    : activity.from_user;

  const toName = toUser
    ? `${toUser.firstName} ${toUser.lastName}`.trim() || toUser.email
    : activity.to_user;

  const isFromCurrentUser = activity.from_user === currentUserId;
  const isToCurrentUser = activity.to_user === currentUserId;

  const fromInitial = fromName.charAt(0).toUpperCase();
  const toInitial = toName.charAt(0).toUpperCase();

  const createdDate = new Date(activity.created_at);
  const isValidDate = !isNaN(createdDate.getTime());

  const isConfirmed = activity.type === 'settlement_confirmed';

  return (
    <FeedCard onClick={onClick} accentColor="#10b981">
      {/* Left icon */}
      <Box
        sx={{
          width: 40,
          height: 40,
          borderRadius: 2,
          backgroundColor: isConfirmed
            ? 'rgba(16, 185, 129, 0.1)'
            : 'rgba(245, 158, 11, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          mt: 0.25,
        }}
      >
        <SwapIcon
          sx={{
            color: isConfirmed ? 'success.main' : 'primary.main',
            fontSize: 20,
          }}
        />
      </Box>

      {/* Content */}
      <Box sx={{ minWidth: 0, flex: 1 }}>
        {/* Row 1: Action label */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, flexWrap: 'wrap' }}>
          {isConfirmed && (
            <Chip
              icon={<CheckIcon sx={{ fontSize: 14 }} />}
              label="Settled"
              size="small"
              sx={{
                height: 20,
                fontSize: '0.65rem',
                fontWeight: 600,
                bgcolor: 'rgba(16, 185, 129, 0.15)',
                color: 'success.main',
              }}
            />
          )}
          <Typography
            variant="body1"
            fontWeight={500}
            sx={{ fontSize: '0.9rem' }}
          >
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
            </Tooltip>
            {' '}
            <Typography
              component="span"
              color="text.secondary"
              sx={{ mx: 0.5 }}
            >
              settled with
            </Typography>
            {' '}
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

        {/* Row 2: Status badge */}
        <Chip
          icon={getStatusIcon(activity.status)}
          label={activity.status}
          size="small"
          color={getStatusColor(activity.status)}
          sx={{ height: 20, fontSize: '0.65rem', fontWeight: 600 }}
        />
      </Box>

      {/* Right side: Amount + Date */}
      <Box sx={{ textAlign: 'right', ml: 1, flexShrink: 0 }}>
        <Typography
          variant="h6"
          fontWeight={700}
          color={isConfirmed ? 'success.main' : 'primary.main'}
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
