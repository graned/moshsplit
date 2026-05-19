import { Card, CardContent, Typography, Box, Avatar, Tooltip, alpha, useTheme, useMediaQuery } from '@mui/material';
import { ExpenseListItem } from '../../../api/expenses.api';
import { UserInfo } from '../../../api/users.api';

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

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffHours < 1) return 'Just now';
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 2) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
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
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const iconSrc = expense.expense_type ? EXPENSE_TYPE_ICONS[expense.expense_type] : null;
  const payerEmail = paidBy?.email || expense.paid_by;
  const isPayerCurrentUser = expense.paid_by === currentUserId;
  const payerInitial = payerEmail.charAt(0).toUpperCase();

  const createdDate = expense.created_at ? new Date(expense.created_at) : null;
  const isValidDate = createdDate && !isNaN(createdDate.getTime());
  const relativeTime = isValidDate ? formatRelativeTime(createdDate!) : '';

  if (isMobile) {
    return (
      <Card
        onClick={onClick}
        sx={{
          cursor: onClick ? 'pointer' : 'default',
          transition: 'transform 0.15s, box-shadow 0.2s',
          borderRadius: 2,
          overflow: 'hidden',
          '&:active': onClick ? { transform: 'scale(0.98)' } : {},
        }}
      >
        <CardContent sx={{ py: 1.25, px: 2, '&:last-child': { pb: 1.25 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Avatar
              sx={{
                width: 36,
                height: 36,
                borderRadius: 1.5,
                bgcolor: 'action.disabledBackground',
                border: '1px solid',
                borderColor: alpha('#534434', 0.2),
                flexShrink: 0,
              }}
            >
              {iconSrc ? (
                <img
                  src={iconSrc}
                  alt=""
                  style={{
                    width: expense.expense_type === 'food' ? 26 : 20,
                    height: 20,
                  }}
                />
              ) : (
                <Typography sx={{ fontSize: '0.875rem', fontWeight: 700 }}>{payerInitial}</Typography>
              )}
            </Avatar>

            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography
                fontWeight={600}
                sx={{
                  fontSize: '0.9rem',
                  lineHeight: 1.3,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {expense.title}
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ fontSize: '0.75rem', lineHeight: 1.3, mt: 0.25 }}
              >
                {isPayerCurrentUser ? 'You' : payerEmail.split('@')[0]} · {relativeTime}
              </Typography>
            </Box>

            <Typography
              fontWeight={700}
              color="primary.main"
              sx={{ fontSize: '1rem', lineHeight: 1.2, flexShrink: 0 }}
            >
              {formatAmount(expense.amount_cents, currency)}
            </Typography>
          </Box>

          {expense.notes && (
            <Box
              sx={{
                fontStyle: 'italic',
                color: 'text.secondary',
                fontSize: '0.75rem',
                borderLeft: '2px solid',
                borderColor: alpha(theme.palette.primary.main, 0.4),
                pl: 1,
                mt: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              "{expense.notes}"
            </Box>
          )}
        </CardContent>
      </Card>
    );
  }

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

              <Box sx={{ textAlign: 'right', ml: 2, flexShrink: 0 }}>
                <Typography variant="h6" fontWeight={700} color="primary.main" sx={{ fontSize: '1.5rem', lineHeight: 1.2 }}>
                  {formatAmount(expense.amount_cents, currency)}
                </Typography>
              </Box>
            </Box>

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
