import { Typography, Box } from '@mui/material';
import { Gavel as GavelIcon } from '@mui/icons-material';
import { useUsers } from '../../../../hooks/useUserCache';
import { MobileFeedCard } from '../MobileFeedCard';
import { SettlementHistoryItem } from '../../../../api/settlements.api';

const formatSignedAmount = (cents: number, currency = 'EUR') => {
  const abs = Math.abs(cents);
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(abs / 100);
  return cents >= 0 ? `+${formatted}` : `-${formatted}`;
};

interface MobileTransactionCardProps {
  item: SettlementHistoryItem;
  currency?: string;
  onClick?: () => void;
}

export function MobileTransactionCard({
  item,
  currency = 'EUR',
  onClick,
}: MobileTransactionCardProps) {
  const userMap = useUsers([item.counterparty_id]);
  const counterparty = userMap[item.counterparty_id];
  const displayName = counterparty
    ? `${counterparty.firstName} ${counterparty.lastName}`.trim() || counterparty.email
    : item.counterparty_id.slice(0, 8);

  const isIncoming = !item.is_outgoing;
  const accentColor = isIncoming ? '#10b981' : '#ef4444';

  const actionText = isIncoming ? `Received from ${displayName.split('@')[0]}` : `Paid to ${displayName.split('@')[0]}`;
  const time = new Date(item.created_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

  return (
    <MobileFeedCard
      accentColor={accentColor}
      icon={
        <GavelIcon sx={{ color: accentColor, fontSize: 18 }} />
      }
      onClick={onClick}
      rightContent={
        <Box>
          <Typography
            sx={{
              fontSize: '0.9rem',
              fontWeight: 700,
              color: accentColor,
              lineHeight: 1.2,
            }}
          >
            {formatSignedAmount(item.amount_cents, currency)}
          </Typography>
          <Typography
            sx={{
              display: 'block',
              fontSize: '0.6rem',
              color: 'text.disabled',
            }}
          >
            {time}
          </Typography>
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
        {actionText}
      </Typography>
      {item.note && (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ fontSize: '0.65rem', fontStyle: 'italic' }}
        >
          {item.note}
        </Typography>
      )}
    </MobileFeedCard>
  );
}