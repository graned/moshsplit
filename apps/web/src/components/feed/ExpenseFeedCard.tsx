import { Typography, Box, Tooltip, Avatar, alpha, useTheme, useMediaQuery } from '@mui/material';
import { Receipt as ReceiptIcon } from '@mui/icons-material';
import { ExpenseActivity } from '../../api/activity.api';
import { UserInfo } from '../../api/users.api';
import { FeedCard } from './FeedCard';

import foodIcon from '../../../assets/food-icon.png';
import beerIcon from '../../../assets/beer-icon.png';
import tankIcon from '../../../assets/tank-icon.png';
import transportIcon from '../../../assets/transport-icon.png';
import merchIcon from '../../../assets/merch-icon.png';
import campingIcon from '../../../assets/camping-icon.png';

const EXPENSE_TYPE_ICONS: Record<string, string> = {
  food: foodIcon,
  beer: beerIcon,
  gas: tankIcon,
  transport: transportIcon,
  merch: merchIcon,
  camping: campingIcon,
};

const formatAmount = (cents: number, currency = 'EUR') => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(cents / 100);
};

interface ExpenseFeedCardProps {
  activity: ExpenseActivity;
  paidBy?: UserInfo;
  participantCount?: number;
  currentUserId?: string;
  currency?: string;
  onClick?: () => void;
}

export function ExpenseFeedCard({
  activity,
  paidBy,
  participantCount,
  currentUserId,
  currency = 'EUR',
  onClick,
}: ExpenseFeedCardProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const iconSrc = activity.expense_type ? EXPENSE_TYPE_ICONS[activity.expense_type] : null;

  const payerName = paidBy?.email || activity.paid_by;

  const isPayerCurrentUser = activity.paid_by === currentUserId;
  const payerInitial = payerName.charAt(0).toUpperCase();

  const createdDate = new Date(activity.created_at);
  const isValidDate = !isNaN(createdDate.getTime());

  return (
    <FeedCard onClick={onClick} accentColor={theme.palette.primary.main}>
      <Box
        sx={{
          width: isMobile ? 36 : 40,
          height: isMobile ? 36 : 40,
          borderRadius: isMobile ? 1.5 : 2,
          backgroundColor: alpha(theme.palette.primary.main, 0.1),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          mt: 0.25,
        }}
      >
        {iconSrc ? (
          <img
            src={iconSrc}
            alt=""
            style={{
              width: activity.expense_type === 'food' ? (isMobile ? 24 : 30) : (isMobile ? 18 : 22),
              height: isMobile ? 18 : 22,
            }}
          />
        ) : (
          <ReceiptIcon sx={{ color: 'primary.main', fontSize: isMobile ? 18 : 20 }} />
        )}
      </Box>

      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography
          variant="h6"
          fontWeight={600}
          sx={{
            fontSize: isMobile ? '0.85rem' : '0.95rem',
            lineHeight: 1.3,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            mb: 0.25,
          }}
        >
          {activity.title}
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Tooltip
            title={
              <Box sx={{ py: 0.5 }}>
                <Typography variant="body2" fontWeight={600}>
                  {payerName}
                </Typography>
                {paidBy?.email && (
                  <Typography variant="caption" color="text.secondary">
                    {paidBy.email}
                  </Typography>
                )}
              </Box>
            }
            arrow
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Avatar
                sx={{
                  width: isMobile ? 16 : 18,
                  height: isMobile ? 16 : 18,
                  fontSize: isMobile ? '0.5rem' : '0.55rem',
                  fontWeight: 700,
                  bgcolor: isPayerCurrentUser ? 'primary.main' : 'action.disabledBackground',
                  color: isPayerCurrentUser ? '#121212' : 'text.secondary',
                }}
              >
                {payerInitial}
              </Avatar>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: isMobile ? '0.65rem' : '0.75rem' }}>
                {isPayerCurrentUser ? 'You' : payerName.split('@')[0]}
              </Typography>
            </Box>
          </Tooltip>
        </Box>

        {participantCount !== undefined && participantCount > 0 && (
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: isMobile ? '0.65rem' : '0.75rem', mt: 0.25 }}>
            Split: {participantCount} {participantCount === 1 ? 'person' : 'people'}
          </Typography>
        )}
      </Box>

      <Box sx={{ textAlign: 'right', ml: isMobile ? 0.75 : 1, flexShrink: 0 }}>
        <Typography
          variant="h6"
          fontWeight={700}
          color="primary.main"
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
