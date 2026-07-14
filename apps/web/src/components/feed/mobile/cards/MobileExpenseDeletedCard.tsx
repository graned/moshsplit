import { Typography, Box, useTheme } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { Delete as DeleteIcon } from '@mui/icons-material';
import { ExpenseDeletedActivity } from '../../../../api/activity.api';
import { UserInfo } from '../../../../api/users.api';
import { MobileFeedCard } from '../MobileFeedCard';

const formatAmount = (cents: number, currency = 'EUR') => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(cents / 100);
};

interface MobileExpenseDeletedCardProps {
  activity: ExpenseDeletedActivity;
  paidBy?: UserInfo;
  currentUserId?: string;
  currency?: string;
}

export function MobileExpenseDeletedCard({
  activity,
  paidBy,
  currentUserId,
  currency = 'EUR',
}: MobileExpenseDeletedCardProps) {
  const { t } = useTranslation();
  const theme = useTheme();

  const payerName = paidBy
    ? `${paidBy.firstName} ${paidBy.lastName}`.trim() || paidBy.email
    : activity.paid_by.slice(0, 8);

  const isPayerCurrentUser = activity.paid_by === currentUserId;
  const displayPayer = isPayerCurrentUser ? t('components.common.you') : payerName.split('@')[0];

  const createdDate = new Date(activity.created_at);
  const isValidDate = !isNaN(createdDate.getTime());

  return (
    <MobileFeedCard
      accentColor={theme.palette.warning.main}
      icon={
        <DeleteIcon sx={{ color: 'warning.main', fontSize: 18 }} />
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
      <Typography
        sx={{
          fontSize: '0.85rem',
          fontWeight: 600,
          lineHeight: 1.3,
          mb: 0.25,
        }}
      >
        <Box component="span" color="warning.main">
          {t('components.expenseDeletedCard.deleted')}
        </Box>
      </Typography>

      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ fontSize: '0.65rem' }}
      >
        <Box component="span" color={isPayerCurrentUser ? 'warning.main' : 'text.primary'}>
          {displayPayer}
        </Box>
        <Typography component="span" color="text.disabled" sx={{ mx: 0.25, fontSize: '0.65rem' }}>
          {' '}{t('components.expenseDeletedCard.expense')}{' '}
        </Typography>
        <Box component="span" color="text.primary">
          {activity.title}
        </Box>
      </Typography>
    </MobileFeedCard>
  );
}
