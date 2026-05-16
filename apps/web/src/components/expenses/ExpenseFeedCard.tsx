import { Card, CardContent, Typography, Box, Avatar, Tooltip } from '@mui/material';
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
  const iconSrc = expense.expense_type ? EXPENSE_TYPE_ICONS[expense.expense_type] : null;
  const payerName = paidBy ? `${paidBy.firstName} ${paidBy.lastName}`.trim() || paidBy.email : expense.paid_by;
  const isPayerCurrentUser = expense.paid_by === currentUserId;
  const payerInitial = payerName.charAt(0).toUpperCase();

  const createdDate = expense.created_at ? new Date(expense.created_at) : null;
  const isValidDate = createdDate && !isNaN(createdDate.getTime());

  return (
    <Card
      onClick={onClick}
      sx={{
        cursor: onClick ? 'pointer' : 'default',
        transition: 'box-shadow 0.2s',
        '&:hover': onClick ? { boxShadow: 6 } : {},
      }}
    >
      <CardContent sx={{ py: 2, px: 2.5, '&:last-child': { pb: 2 } }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            {/* Row 1: Icon + Title */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              {iconSrc && <img src={iconSrc} alt="" style={{ width: 22, height: 22, flexShrink: 0 }} />}
              <Typography variant="h6" fontWeight={600} noWrap sx={{ fontSize: '1.05rem' }}>
                {expense.title}
              </Typography>
            </Box>

            {/* Row 2: Paid by */}
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
                  <Typography variant="caption" color="text.secondary">
                    Paid by:
                  </Typography>
                  <Avatar
                    sx={{
                      width: 20,
                      height: 20,
                      fontSize: '0.6rem',
                      fontWeight: 700,
                      bgcolor: isPayerCurrentUser ? 'primary.main' : 'action.disabledBackground',
                      cursor: 'default',
                    }}
                  >
                    {payerInitial}
                  </Avatar>
                  <Typography variant="caption" color="text.secondary">
                    {isPayerCurrentUser ? 'You' : payerName}
                  </Typography>
                </Box>
              </Tooltip>
            </Box>

            {/* Row 3: Split participants */}
            {participants.length > 0 && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.75 }}>
                <Typography variant="caption" color="text.secondary">
                  Split:
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  {participants.slice(0, 5).map((u, i) => {
                    const isMe = u.id === currentUserId;
                    return (
                      <Tooltip key={u.id} title={`${u.firstName} ${u.lastName}`.trim() || u.email}>
                        <Avatar
                          sx={{
                            width: 20,
                            height: 20,
                            fontSize: '0.6rem',
                            fontWeight: 700,
                            bgcolor: isMe ? 'primary.main' : 'action.disabledBackground',
                            ml: i > 0 ? -0.5 : 0,
                            border: 1,
                            borderColor: 'background.paper',
                          }}
                        >
                          {u.firstName.charAt(0).toUpperCase()}
                        </Avatar>
                      </Tooltip>
                    );
                  })}
                  {participants.length > 5 && (
                    <Typography variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>
                      +{participants.length - 5}
                    </Typography>
                  )}
                </Box>
              </Box>
            )}
          </Box>

          {/* Right side: Amount + Date */}
          <Box sx={{ textAlign: 'right', ml: 2, flexShrink: 0 }}>
            <Typography variant="h6" fontWeight={700} color="primary.main" sx={{ fontSize: '1.1rem' }}>
              {formatAmount(expense.amount_cents, currency)}
            </Typography>
            {isValidDate && (
              <Typography variant="caption" color="text.disabled" sx={{ display: 'block' }}>
                {createdDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </Typography>
            )}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}
