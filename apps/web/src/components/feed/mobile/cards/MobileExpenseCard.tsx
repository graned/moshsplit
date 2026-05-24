import { Typography, Box, useTheme } from '@mui/material';
import { Receipt as ReceiptIcon } from '@mui/icons-material';
import { ExpenseActivity } from '../../../../api/activity.api';
import { UserInfo } from '../../../../api/users.api';
import { MobileFeedCard } from '../MobileFeedCard';

const EXPENSE_TYPE_ICONS: Record<string, string> = {
  food: '/moshsplit/assets/food-icon.png',
  beer: '/moshsplit/assets/beer-icon.png',
  gas: '/moshsplit/assets/tank-icon.png',
  transport: '/moshsplit/assets/transport-icon.png',
  merch: '/moshsplit/assets/merch-icon.png',
  camping: '/moshsplit/assets/camping-icon.png',
};

const formatAmount = (cents: number, currency = 'EUR') => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(cents / 100);
};

interface MobileExpenseCardProps {
  activity: ExpenseActivity;
  paidBy?: UserInfo;
  currentUserId?: string;
  currency?: string;
  onClick?: () => void;
}

/**
 * Mobile-only simplified expense card.
 * No Tooltip, no Avatar, no participant count — just icon, title, payer, amount, date.
 */
export function MobileExpenseCard({
  activity,
  paidBy,
  currentUserId,
  currency = 'EUR',
  onClick,
}: MobileExpenseCardProps) {
  const theme = useTheme();
  const iconSrc = activity.expense_type ? EXPENSE_TYPE_ICONS[activity.expense_type] : null;

  const payerName = paidBy?.email || activity.paid_by;
  const isPayerCurrentUser = activity.paid_by === currentUserId;

  const createdDate = new Date(activity.created_at);
  const isValidDate = !isNaN(createdDate.getTime());

  return (
    <MobileFeedCard
      onClick={onClick}
      accentColor={theme.palette.primary.main}
      icon={
        iconSrc ? (
          <img
            src={iconSrc}
            alt=""
            style={{
              width: activity.expense_type === 'food' ? 24 : 18,
              height: 18,
            }}
          />
        ) : (
          <ReceiptIcon sx={{ color: 'primary.main', fontSize: 18 }} />
        )
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
      {/* Title */}
      <Typography
        sx={{
          fontSize: '0.85rem',
          fontWeight: 600,
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

      {/* Payer name */}
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ fontSize: '0.65rem' }}
      >
        {isPayerCurrentUser ? 'You' : payerName.split('@')[0]}
      </Typography>
    </MobileFeedCard>
  );
}
