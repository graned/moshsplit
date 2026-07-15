import { Typography, Box, useTheme, alpha } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { Receipt as ReceiptIcon, Delete as DeleteIcon } from '@mui/icons-material';
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

const EXPENSE_TYPE_LABELS: Record<string, string> = {
  food: 'Food',
  beer: 'Beer',
  gas: 'Gas',
  transport: 'Travel',
  merch: 'Merch',
  camping: 'Camping',
};

const EXPENSE_TYPE_COLORS: Record<string, string> = {
  food: '#E85D04',
  beer: '#F4A261',
  gas: '#6C757D',
  transport: '#2A9D8F',
  merch: '#9B5DE5',
  camping: '#52B788',
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
  onEdit?: () => void;
  onDelete?: () => void;
}

export function MobileExpenseCard({
  activity,
  paidBy,
  currentUserId,
  currency = 'EUR',
  onClick,
  onEdit,
  onDelete,
}: MobileExpenseCardProps) {
  const { t } = useTranslation();
  const theme = useTheme();

  if (!activity) {
    return null;
  }

  const iconSrc = activity.expense_type ? EXPENSE_TYPE_ICONS[activity.expense_type] : null;

  const payerName = paidBy?.email || activity.paid_by;
  const isPayerCurrentUser = activity.paid_by === currentUserId;

  const createdDate = new Date(activity.created_at);
  const isValidDate = !isNaN(createdDate.getTime());

  const categoryLabel = activity.expense_type
    ? EXPENSE_TYPE_LABELS[activity.expense_type] || activity.expense_type
    : null;
  const categoryColor = activity.expense_type
    ? (EXPENSE_TYPE_COLORS[activity.expense_type] ?? theme.palette.primary.main)
    : theme.palette.primary.main;

  const isDeleted = Boolean(activity.deleted_at);
  const canModify = activity.paid_by === currentUserId;

  return (
    <MobileFeedCard
      onClick={onClick}
      accentColor={theme.palette.primary.main}
      swipeActions={
        onEdit || onDelete
          ? {
              onEdit,
              onDelete,
              canEdit: canModify && !isDeleted,
              canDelete: canModify && !isDeleted,
            }
          : undefined
      }
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
          {activity.participant_count > 0 && (
            <Typography
              sx={{
                display: 'block',
                fontSize: '0.6rem',
                color: alpha(theme.palette.primary.main, 0.6),
                mt: 0.25,
              }}
            >
              {t('components.expenseCard.split', { count: activity.participant_count })}
            </Typography>
          )}
        </Box>
      }
    >
      {categoryLabel && (
        <Box
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.5,
            mb: 0.75,
            px: 0.75,
            py: 0.35,
            borderRadius: 1.5,
            backgroundColor: alpha(categoryColor, 0.1),
            border: `1px solid ${alpha(categoryColor, 0.25)}`,
          }}
        >
          {iconSrc ? (
            <img
              src={iconSrc}
              alt=""
              style={{ width: 12, height: 10, objectFit: 'contain' }}
            />
          ) : (
            <ReceiptIcon sx={{ fontSize: 11, color: categoryColor }} />
          )}
          <Typography
            component="span"
            sx={{
              fontSize: '0.65rem',
              fontWeight: 700,
              color: categoryColor,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              lineHeight: 1,
            }}
          >
            {categoryLabel}
          </Typography>
        </Box>
      )}

      {isDeleted && (
        <Box
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.5,
            mb: 0.75,
            px: 0.75,
            py: 0.35,
            borderRadius: 1.5,
            backgroundColor: alpha(theme.palette.error.main, 0.1),
            border: `1px solid ${alpha(theme.palette.error.main, 0.3)}`,
          }}
        >
          <DeleteIcon sx={{ fontSize: 10, color: theme.palette.error.main }} />
          <Typography
            component="span"
            sx={{
              fontSize: '0.6rem',
              fontWeight: 700,
              color: theme.palette.error.main,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              lineHeight: 1,
            }}
          >
            {t('components.expenseCard.deleted')}
          </Typography>
        </Box>
      )}

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
