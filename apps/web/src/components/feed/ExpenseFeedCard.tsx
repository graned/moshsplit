import {
  Typography,
  Box,
  Tooltip,
  Avatar,
  Chip,
} from '@mui/material';
import {
  Receipt as ReceiptIcon,
  Edit as EditIcon,
} from '@mui/icons-material';
import { ExpenseActivity } from '../../api/activity.api';
import { UserInfo } from '../../api/users.api';
import { FeedCard } from './FeedCard';
import { AvatarStack } from './AvatarStack';

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
  participants?: UserInfo[];
  currentUserId?: string;
  currency?: string;
  onClick?: () => void;
}

export function ExpenseFeedCard({
  activity,
  paidBy,
  participants = [],
  currentUserId,
  currency = 'EUR',
  onClick,
}: ExpenseFeedCardProps) {
  const iconSrc = activity.expense_type
    ? EXPENSE_TYPE_ICONS[activity.expense_type]
    : null;

  const payerName = paidBy
    ? `${paidBy.firstName} ${paidBy.lastName}`.trim() || paidBy.email
    : activity.paid_by;

  const isPayerCurrentUser = activity.paid_by === currentUserId;
  const payerInitial = payerName.charAt(0).toUpperCase();

  const createdDate = new Date(activity.created_at);
  const isValidDate = !isNaN(createdDate.getTime());

  const isUpdate = activity.type === 'expense_updated';

  return (
    <FeedCard onClick={onClick} accentColor="#F59E0B">
      {/* Left icon */}
      <Box
        sx={{
          width: 40,
          height: 40,
          borderRadius: 2,
          backgroundColor: 'rgba(245, 158, 11, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          mt: 0.25,
        }}
      >
        {iconSrc ? (
          <img src={iconSrc} alt="" style={{ width: 22, height: 22 }} />
        ) : (
          <ReceiptIcon sx={{ color: 'primary.main', fontSize: 20 }} />
        )}
      </Box>

      {/* Content */}
      <Box sx={{ minWidth: 0, flex: 1 }}>
        {/* Row 1: Type badge + Title */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, flexWrap: 'wrap' }}>
          {isUpdate && (
            <Chip
              icon={<EditIcon sx={{ fontSize: 14 }} />}
              label="Updated"
              size="small"
              sx={{
                height: 20,
                fontSize: '0.65rem',
                fontWeight: 600,
                bgcolor: 'rgba(245, 158, 11, 0.15)',
                color: 'primary.main',
              }}
            />
          )}
          <Typography
            variant="h6"
            fontWeight={600}
            noWrap
            sx={{ fontSize: '0.95rem' }}
          >
            {activity.expense_title}
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
                  width: 18,
                  height: 18,
                  fontSize: '0.55rem',
                  fontWeight: 700,
                  bgcolor: isPayerCurrentUser ? 'primary.main' : 'action.disabledBackground',
                  color: isPayerCurrentUser ? '#121212' : 'text.secondary',
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

        {/* Row 3: Participants */}
        {participants.length > 0 && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.5 }}>
            <Typography variant="caption" color="text.secondary">
              Split:
            </Typography>
            <AvatarStack
              users={participants}
              currentUserId={currentUserId}
              maxVisible={4}
              size={20}
            />
          </Box>
        )}
      </Box>

      {/* Right side: Amount + Date */}
      <Box sx={{ textAlign: 'right', ml: 1, flexShrink: 0 }}>
        <Typography
          variant="h6"
          fontWeight={700}
          color="primary.main"
          sx={{ fontSize: '1rem' }}
        >
          {formatAmount(activity.expense_amount_cents, currency)}
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
