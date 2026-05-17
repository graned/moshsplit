import { Box, Typography, Avatar, alpha, CircularProgress } from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { useUser } from '../../hooks/useUserCache';
import { UserBalanceItem, EventStats } from '../../api/balances.api';
import { activityApi, ActivityItem, isSettlementActivity, isExpenseActivity, isMemberJoinActivity } from '../../api/activity.api';

const formatAmount = (cents: number, currency = 'EUR') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Math.abs(cents) / 100);

interface LiveIntelPanelProps {
  eventId: string;
  currentUserId: string;
  stats: EventStats | undefined;
  balances: UserBalanceItem[];
  currency: string;
}

export function LiveIntelPanel({
  eventId,
  currentUserId,
  stats,
  balances,
  currency,
}: LiveIntelPanelProps) {

  // Fetch recent activity
  const { data: activityResult, isLoading: activityLoading } = useQuery({
    queryKey: ['balances-activity', eventId],
    queryFn: () => activityApi.list(eventId, currentUserId, undefined, 10),
    enabled: !!eventId,
    staleTime: 1000 * 60 * 5,
  });

  const activities = activityResult?.data ?? [];

  // Get the most indebted users (highest absolute balance)
  const mostIndebted = [...balances]
    .filter((b) => b.balance_cents !== 0)
    .sort((a, b) => Math.abs(b.balance_cents) - Math.abs(a.balance_cents))
    .slice(0, 4);

  const outstandingCents = stats?.outstanding_cents ?? 0;
  const totalSpentCents = stats?.total_spent_cents ?? 0;
  const budgetPercentage = totalSpentCents > 0 ? Math.round(((totalSpentCents - outstandingCents) / totalSpentCents) * 100) : 0;

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
      }}
    >
      {/* Outstanding Damage */}
      <Box
        sx={{
          p: 2,
          borderRadius: 2,
          bgcolor: 'elevated.main',
          border: `1px solid ${alpha('#fff', 0.1)}`,
        }}
      >
        <Typography
          variant="caption"
          sx={{
            fontWeight: 700,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'text.secondary',
            display: 'block',
            mb: 1.5,
          }}
        >
          Outstanding Damage
        </Typography>
        <Typography
          variant="h4"
          fontWeight={800}
          sx={{ color: 'primary.main', mb: 0.5 }}
        >
          {formatAmount(outstandingCents, currency)}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <TrendingUpIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
          <Typography variant="caption" color="text.secondary">
            {budgetPercentage}% of budget settled
          </Typography>
        </Box>
        {/* Progress bar */}
        <Box
          sx={{
            mt: 1.5,
            height: 4,
            borderRadius: 100,
            bgcolor: 'elevatedHighest',
            overflow: 'hidden',
          }}
        >
          <Box
            sx={{
              height: '100%',
              width: `${budgetPercentage}%`,
              bgcolor: 'primary.main',
              borderRadius: 100,
              transition: 'width 0.3s ease',
            }}
          />
        </Box>
      </Box>

      {/* Most Indebted Survivors */}
      {mostIndebted.length > 0 && (
        <Box
          sx={{
            p: 2,
            borderRadius: 2,
            bgcolor: 'elevated.main',
            border: `1px solid ${alpha('#fff', 0.1)}`,
          }}
        >
          <Typography
            variant="caption"
            sx={{
              fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'text.secondary',
              display: 'block',
              mb: 1.5,
            }}
          >
            Most Indebted Survivors
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {mostIndebted.map((balance) => (
              <MostIndebtedRow
                key={balance.user_id}
                userId={balance.user_id}
                balanceCents={balance.balance_cents}
                currency={currency}
                isCurrentUser={balance.user_id === currentUserId}
              />
            ))}
          </Box>
        </Box>
      )}

      {/* Recent Diplomacy */}
      <Box
        sx={{
          p: 2,
          borderRadius: 2,
          bgcolor: 'elevated.main',
          border: `1px solid ${alpha('#fff', 0.1)}`,
        }}
      >
        <Typography
          variant="caption"
          sx={{
            fontWeight: 700,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'text.secondary',
            display: 'block',
            mb: 1.5,
          }}
        >
          Recent Diplomacy
        </Typography>

        {activityLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
            <CircularProgress size={20} sx={{ color: 'text.secondary' }} />
          </Box>
        ) : activities.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
            No diplomacy recorded yet.
          </Typography>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {activities.slice(0, 5).map((activity) => (
              <ActivityRow key={activity.id} activity={activity} currency={currency} />
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Most Indebted Row
// ---------------------------------------------------------------------------

function MostIndebtedRow({
  userId,
  balanceCents,
  currency,
  isCurrentUser,
}: {
  userId: string;
  balanceCents: number;
  currency: string;
  isCurrentUser: boolean;
}) {
  const user = useUser(userId);
  const displayName = user
    ? `${user.firstName} ${user.lastName}`.trim() || user.email
    : userId.slice(0, 8);
  const initial = displayName.charAt(0).toUpperCase();
  const isOwed = balanceCents > 0;

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
      <Avatar
        sx={{
          width: 32,
          height: 32,
          bgcolor: isOwed ? 'primary.main' : 'error.main',
          color: '#121212',
          fontWeight: 700,
          fontSize: '0.75rem',
        }}
      >
        {initial}
      </Avatar>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" fontWeight={600} color="text.primary" noWrap>
          {isCurrentUser ? 'You' : displayName}
        </Typography>
      </Box>
      <Typography
        variant="body2"
        fontWeight={700}
        sx={{
          color: isOwed ? 'primary.main' : 'error.main',
          flexShrink: 0,
        }}
      >
        {isOwed ? '+' : '-'}{formatAmount(balanceCents, currency)}
      </Typography>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Activity Row
// ---------------------------------------------------------------------------

function ActivityRow({ activity, currency }: { activity: ActivityItem; currency: string }) {
  const time = new Date(activity.created_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

  let text: string;
  let dotColor: string;

  if (isSettlementActivity(activity)) {
    const fromUser = useUser(activity.from_user);
    const toUser = useUser(activity.to_user);
    const fromName = fromUser
      ? `${fromUser.firstName} ${fromUser.lastName}`.trim() || fromUser.email
      : activity.from_user.slice(0, 8);
    const toName = toUser
      ? `${toUser.firstName} ${toUser.lastName}`.trim() || toUser.email
      : activity.to_user.slice(0, 8);
    text = `${fromName} settled ${formatAmount(activity.amount_cents, currency)} with ${toName}`;
    dotColor = 'success.main';
  } else if (isExpenseActivity(activity)) {
    const payer = useUser(activity.paid_by);
    const payerName = payer
      ? `${payer.firstName} ${payer.lastName}`.trim() || payer.email
      : activity.paid_by.slice(0, 8);
    text = `${payerName} added ${activity.title}`;
    dotColor = 'primary.main';
  } else if (isMemberJoinActivity(activity)) {
    const user = useUser(activity.user_id);
    const userName = user
      ? `${user.firstName} ${user.lastName}`.trim() || user.email
      : activity.user_id.slice(0, 8);
    text = `${userName} joined the pit`;
    dotColor = 'warning.main';
  } else {
    text = 'Activity recorded';
    dotColor = 'text.secondary';
  }

  return (
    <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'start' }}>
      <Box
        sx={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          bgcolor: dotColor,
          mt: 0.5,
          flexShrink: 0,
        }}
      />
      <Box sx={{ flex: 1 }}>
        <Typography variant="body2" color="text.primary" sx={{ lineHeight: 1.4 }}>
          {text}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {time}
        </Typography>
      </Box>
    </Box>
  );
}
