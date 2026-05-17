import { Card, CardContent, Typography, Box, Avatar, Tooltip, alpha, useTheme } from '@mui/material';
import { ExpenseListItem } from '../../api/expenses.api';
import { UserInfo } from '../../api/users.api';

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

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffHours < 1) return 'Just now';
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 2) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

interface ExpenseFeedCardProps {
  expense: ExpenseListItem;
  paidBy?: UserInfo;
  participants?: UserInfo[];
  currentUserId?: string;
  currency?: string;
  onClick?: () => void;
}

export function ExpenseFeedCard({
  expense,
  paidBy,
  participants = [],
  currentUserId,
  currency = 'EUR',
  onClick,
}: ExpenseFeedCardProps) {
  const theme = useTheme();
  const iconSrc = expense.expense_type ? EXPENSE_TYPE_ICONS[expense.expense_type] : null;
  const payerEmail = paidBy?.email || expense.paid_by;
  const isPayerCurrentUser = expense.paid_by === currentUserId;
  const payerInitial = payerEmail.charAt(0).toUpperCase();

  const createdDate = expense.created_at ? new Date(expense.created_at) : null;
  const isValidDate = createdDate && !isNaN(createdDate.getTime());
  const relativeTime = isValidDate ? formatRelativeTime(createdDate!) : '';

  return (
    <Card
      onClick={onClick}
      sx={{
        cursor: onClick ? 'pointer' : 'default',
        transition: 'box-shadow 0.2s',
        borderRadius: 3,
        overflow: 'hidden',
        position: 'relative',
        '&:hover': onClick ? { boxShadow: 6 } : {},
      }}
    >
      <CardContent sx={{ py: 2, px: 2.5, '&:last-child': { pb: 2 } }}>
        <Box sx={{ display: 'flex', gap: 2 }}>
          {/* Left: Avatar + Timeline connector */}
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
            <Avatar
              sx={{
                width: 48,
                height: 48,
                borderRadius: 2,
                bgcolor: 'action.disabledBackground',
                border: '1px solid',
                borderColor: alpha('#534434', 0.2),
              }}
            >
              {iconSrc ? (
                <img
                  src={iconSrc}
                  alt=""
                  style={{
                    width: expense.expense_type === 'food' ? 36 : 28,
                    height: 28,
                  }}
                />
              ) : (
                <Typography sx={{ fontSize: '1.25rem', fontWeight: 700 }}>{payerInitial}</Typography>
              )}
            </Avatar>
            <Box sx={{ width: 1, flex: 1, bgcolor: alpha('#534434', 0.2), borderRadius: 1, minHeight: 16 }} />
          </Box>

          {/* Right: Content */}
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography variant="h6" fontWeight={600} sx={{ fontSize: '1.1rem', mb: 0.5 }}>
                  {expense.title}
                </Typography>
                <Typography component="span" variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem' }}>
                  Paid by{' '}
                  <Tooltip
                    title={
                      <Box sx={{ py: 0.5 }}>
                        <Typography variant="body2" fontWeight={600}>
                          {payerEmail}
                        </Typography>
                      </Box>
                    }
                    arrow
                  >
                    <Box component="span" sx={{ color: 'primary.main', fontWeight: 700, cursor: 'default' }}>
                      {isPayerCurrentUser ? 'You' : payerEmail}
                    </Box>
                  </Tooltip>{' '}
                  • {relativeTime}
                </Typography>
              </Box>

              {/* Amount */}
              <Box sx={{ textAlign: 'right', ml: 2, flexShrink: 0 }}>
                <Typography variant="h6" fontWeight={700} color="primary.main" sx={{ fontSize: '1.5rem', lineHeight: 1.2 }}>
                  {formatAmount(expense.amount_cents, currency)}
                </Typography>
              </Box>
            </Box>

            {/* Notes */}
            {expense.notes && (
              <Box
                sx={{
                  fontStyle: 'italic',
                  color: 'text.secondary',
                  fontSize: '0.875rem',
                  borderLeft: '2px solid',
                  borderColor: alpha(theme.palette.primary.main, 0.4),
                  pl: 1.5,
                  py: 0.5,
                  bgcolor: alpha('#131313', 0.3),
                  borderRadius: '0 8px 8px 0',
                  mt: 1,
                }}
              >
                "{expense.notes}"
              </Box>
            )}

            {/* Split participants */}
            {participants.length > 0 && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1.5 }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  Split among {participants.length} {participants.length === 1 ? 'person' : 'people'}
                </Typography>
              </Box>
            )}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}
