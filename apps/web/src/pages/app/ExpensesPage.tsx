import { useMemo } from 'react';
import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  Stack,
  alpha,
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import {
  Receipt as ReceiptIcon,
  CalendarToday as CalendarIcon,
  Euro as EuroIcon,
  LocationOn as LocationIcon,
} from '@mui/icons-material';

import { useAuthStore } from '@moshsplit/auth-react';
import { groupsApi, GroupListItem } from '../../api/groups.api';
import { balancesApi } from '../../api/balances.api';

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const formatAmount = (cents: number, currency = 'EUR') => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(cents / 100);
};

interface ExpenseCardProps {
  group: GroupListItem;
  balance: { paid_cents: number; owes_cents: number; balance_cents: number } | null;
  onClick: () => void;
}

function ExpenseCard({ group, balance, onClick }: ExpenseCardProps) {
  const userPaid = balance?.paid_cents || 0;
  const userOwes = balance?.owes_cents || 0;
  const netBalance = balance?.balance_cents || 0;
  const isSettled = netBalance === 0;
  const hasData = balance !== null;

  const summary = (
    <>
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <EuroIcon sx={{ fontSize: 22, color: 'primary.main' }} />
          <Typography variant="h3" fontWeight={700} color="primary.main">
            {hasData ? formatAmount(userPaid, group.currency) : '—'}
          </Typography>
        </Box>
        <Typography variant="body1" color="text.secondary">
          You Paid
        </Typography>
      </Box>
      <Box sx={{ textAlign: 'right' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, justifyContent: 'flex-end' }}>
          <Typography variant="h6" fontWeight={600}>
            {hasData ? formatAmount(userOwes, group.currency) : '—'}
          </Typography>
        </Box>
        <Typography variant="body1" color="text.secondary">
          Your Share
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {group.member_count} {group.member_count === 1 ? 'participant' : 'participants'}
        </Typography>
      </Box>
    </>
  );

  return (
    <Card
      sx={{
        cursor: 'pointer',
        transition: 'transform 0.2s, box-shadow 0.2s',
        borderRadius: 3,
        overflow: 'hidden',
        '&:hover': {
          transform: { md: 'translateY(-4px)' },
          boxShadow: { md: '0 8px 24px rgba(0,0,0,0.3)' },
        },
      }}
      onClick={onClick}
    >
      {/* ===== MOBILE: horizontal layout ===== */}
      <Box sx={{ display: { xs: 'flex', md: 'none' }, minHeight: 110 }}>
        {/* Left: hero with gradient */}
        <Box
          sx={{
            width: 100,
            position: 'relative',
            overflow: 'hidden',
            background: `linear-gradient(135deg, ${alpha('#F59E0B', 0.4)} 0%, ${alpha('#D97706', 0.6)} 100%)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Box sx={{
            position: 'absolute', inset: 0,
            background: `linear-gradient(to right, transparent 40%, ${alpha('#1E1E1E', 0.95)} 100%)`,
          }} />
          <ReceiptIcon sx={{ fontSize: 40, color: alpha('#fff', 0.3), zIndex: 0 }} />
        </Box>

        {/* Right: details + summary */}
        <Box sx={{ display: 'flex', flex: 1, minWidth: 0, p: 1.5 }}>
          {/* Details */}
          <Box sx={{ flex: 1, minWidth: 0, pr: 1 }}>
            <Typography variant="subtitle1" fontWeight={700} sx={{ lineHeight: 1.3, mb: 0.5 }}>
              {group.name}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3, mb: 0.5 }}>
              <LocationIcon sx={{ fontSize: 13, color: 'text.secondary', flexShrink: 0 }} />
              <Typography variant="caption" color="text.secondary" noWrap>
                {group.description || 'No description'}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3, mb: 0.5 }}>
              <CalendarIcon sx={{ fontSize: 13, color: 'text.secondary', flexShrink: 0 }} />
              <Typography variant="caption" color="text.secondary" noWrap>
                {formatDate(group.created_at)}
              </Typography>
            </Box>
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                px: 1,
                py: 0.2,
                borderRadius: 0.5,
                bgcolor: isSettled ? alpha('#10b981', 0.15) : netBalance > 0 ? alpha('#10b981', 0.15) : alpha('#ef4444', 0.15),
                color: isSettled ? '#34d399' : netBalance > 0 ? '#34d399' : '#f87171',
                fontSize: '0.6rem',
                fontWeight: 700,
                letterSpacing: '0.05em',
              }}
            >
              {isSettled ? 'SETTLED' : netBalance > 0 ? 'THEY OWE YOU' : 'YOU OWE'}
            </Box>
          </Box>

          {/* Paid amount */}
          <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
            <Typography variant="body1" fontWeight={700} color="primary.main" sx={{ lineHeight: 1.2 }}>
              {hasData ? formatAmount(userPaid, group.currency) : '—'}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.2, display: 'block', whiteSpace: 'nowrap' }}>
              You Paid
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* ===== DESKTOP: vertical layout ===== */}
      <Box sx={{ display: { xs: 'none', md: 'block' } }}>
        {/* Hero */}
        <Box
          sx={{
            height: 200,
            background: `linear-gradient(135deg, ${alpha('#F59E0B', 0.4)} 0%, ${alpha('#D97706', 0.6)} 100%)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
          }}
        >
          <Box sx={{
            position: 'absolute', inset: 0,
            background: `linear-gradient(to bottom, transparent 40%, ${alpha('#1E1E1E', 0.95)} 100%)`,
          }} />
          <ReceiptIcon sx={{ fontSize: 80, color: alpha('#fff', 0.2), zIndex: 0 }} />
        </Box>

        <CardContent sx={{ p: 4, '&:last-child': { pb: 4 } }}>
          <Typography variant="h4" fontWeight={700} sx={{ mb: 2 }}>
            {group.name}
          </Typography>

          <Stack spacing={1} sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <LocationIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
              <Typography variant="body1" color="text.secondary">
                {group.description || 'No description'}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <CalendarIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
              <Typography variant="body1" color="text.secondary">
                {formatDate(group.created_at)}
              </Typography>
            </Box>
          </Stack>

          <Box sx={{ height: 1, bgcolor: 'divider', mb: 3 }} />

          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            {summary}
          </Box>

          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              px: 2.5,
              py: 0.8,
              borderRadius: 1,
              bgcolor: isSettled ? alpha('#10b981', 0.15) : netBalance > 0 ? alpha('#10b981', 0.15) : alpha('#ef4444', 0.15),
              color: isSettled ? '#34d399' : netBalance > 0 ? '#34d399' : '#f87171',
              fontSize: '0.9rem',
              fontWeight: 700,
              letterSpacing: '0.05em',
            }}
          >
            {isSettled ? 'SETTLED' : netBalance > 0 ? 'THEY OWE YOU' : 'YOU OWE'}
          </Box>
        </CardContent>
      </Box>
    </Card>
  );
}

export default function ExpensesPage() {
  const navigate = useNavigate();
  const userId = useAuthStore((state) => state.userId);

  const { data: groupsData, isLoading: groupsLoading, error: groupsError } = useQuery({
    queryKey: ['groups', userId],
    queryFn: () => {
      if (!userId) throw new Error('User not authenticated');
      return groupsApi.list(userId);
    },
    enabled: !!userId,
  });

  const groups = groupsData?.data || [];

  const { data: balancesData, isLoading: balancesLoading } = useQuery({
    queryKey: ['expenses-page-balances', userId],
    queryFn: async () => {
      if (!userId) return {};
      const results = await Promise.allSettled(
        groups.map((g) => balancesApi.getUserBalance(g.id, userId))
      );
      const map: Record<string, { paid_cents: number; owes_cents: number; balance_cents: number } | null> = {};
      groups.forEach((g, i) => {
        const r = results[i];
        if (r.status === 'fulfilled') {
          map[g.id] = r.value;
        } else {
          map[g.id] = null;
        }
      });
      return map;
    },
    enabled: !!userId && groups.length > 0,
  });

  const groupBalances = useMemo(() => balancesData || {}, [balancesData]);

  const isLoading = groupsLoading || balancesLoading;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight={700}>
            My Expenses
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Track what you've spent across your events
          </Typography>
        </Box>
      </Box>

      {groupsError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Failed to load events
        </Alert>
      )}

      {isLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      )}

      {!isLoading && !groupsError && groups.length === 0 && (
        <Card>
          <CardContent sx={{ py: 8, textAlign: 'center' }}>
            <Box
              sx={{
                width: 80,
                height: 80,
                borderRadius: '50%',
                backgroundColor: 'primary.main',
                opacity: 0.1,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                mb: 3,
              }}
            >
              <ReceiptIcon sx={{ fontSize: 40, color: 'primary.main' }} />
            </Box>
            <Typography variant="h6" fontWeight={600} gutterBottom>
              No expenses yet
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Join an event to start tracking shared expenses.
            </Typography>
          </CardContent>
        </Card>
      )}

      {!isLoading && !groupsError && groups.length > 0 && (
        <Grid container spacing={3}>
          {groups.map((group) => (
            <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={group.id}>
              <ExpenseCard
                group={group}
                balance={groupBalances[group.id] || null}
                onClick={() => navigate(`/app/expenses/${group.id}`)}
              />
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
}
