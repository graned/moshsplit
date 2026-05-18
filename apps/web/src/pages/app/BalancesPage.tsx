import { useMemo } from 'react';
import { useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import {
  Box,
  Typography,
  CircularProgress,
  Alert,
  alpha,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import {
  Scale as ScalesIcon,
  CheckCircle as SettledIcon,
} from '@mui/icons-material';

import { useAuthStore } from '@moshsplit/auth-react';
import { groupsApi } from '../../api/groups.api';
import { balancesApi } from '../../api/balances.api';
import { settlementsApi } from '../../api/settlements.api';
import { useUsers } from '../../hooks/useUserCache';
import { SettlementCards, RelationshipSummary, LiveIntelPanel } from '../../components/balances';

export default function BalancesPage() {
  const { eventId: routeEventId } = useParams<{ eventId: string }>();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('lg'));

  const userId = useAuthStore((state) => state.userId);
  const eventId = routeEventId;

  // Fetch event details
  const { data: event, isLoading: eventLoading } = useQuery({
    queryKey: ['event', eventId],
    queryFn: () => groupsApi.get(eventId!),
    enabled: !!eventId,
  });

  // Fetch members for name resolution
  const { data: members = [] } = useQuery({
    queryKey: ['event-members', eventId],
    queryFn: () => groupsApi.listMembers(eventId!),
    enabled: !!eventId,
  });

  const memberUserIds = useMemo(() => members.map((m) => m.user_id), [members]);
  useUsers(memberUserIds);

  // Fetch balances
  const {
    data: balancesData,
    isLoading: balancesLoading,
    error: balancesError,
  } = useQuery({
    queryKey: ['balances', eventId, userId],
    queryFn: () => balancesApi.getAllBalances(eventId!, userId!),
    enabled: !!eventId && !!userId,
  });

  // Fetch balance explanation for pairwise breakdown
  const { data: explainData } = useQuery({
    queryKey: ['balance-explain', eventId, userId],
    queryFn: () => balancesApi.explainUserBalance(eventId!, userId!),
    enabled: !!eventId && !!userId,
    staleTime: 1000 * 60 * 5,
  });

  // Fetch settlement requests
  const { data: settlementsData } = useQuery({
    queryKey: ['settlements', eventId, userId],
    queryFn: () => settlementsApi.list(eventId!, userId!, undefined, 50),
    enabled: !!eventId && !!userId,
    staleTime: 1000 * 60 * 2,
  });

  // Fetch stats
  const { data: stats } = useQuery({
    queryKey: ['balances', eventId, 'stats', userId],
    queryFn: () => balancesApi.getStats(eventId!, userId!),
    enabled: !!eventId && !!userId,
    staleTime: 1000 * 60 * 5,
  });

  const balances = balancesData?.balances || [];
  const currency = event?.currency || 'EUR';
  const eventName = event?.name || '';

  // Compute pairwise relationships from explain data
  const relationships = useMemo((): RelationshipSummary[] => {
    if (!explainData) return [];

    const expenseMap = new Map<string, RelationshipSummary>();

    // Process expenses: who owes whom
    for (const exp of explainData.expenses) {
      if (!exp.participants || exp.participants.length === 0) continue;

      if (exp.paid_by === userId) {
        // I paid — others owe me their share
        for (const participantId of exp.participants) {
          if (participantId === userId) continue; // skip myself

          if (!expenseMap.has(participantId)) {
            expenseMap.set(participantId, {
              userId: participantId,
              totalCents: 0,
              expenses: [],
              settlements: [],
              payments: [],
              rawExpenseCents: 0,
              rawSettlementCents: 0,
              rawPaymentCents: 0,
              isIncoming: true,
            });
          }
          const rel = expenseMap.get(participantId)!;
          rel.totalCents += exp.share_cents;
          rel.expenses.push(exp);
        }
      } else {
        // Someone else paid — I owe them my share
        if (!expenseMap.has(exp.paid_by)) {
          expenseMap.set(exp.paid_by, {
            userId: exp.paid_by,
            totalCents: 0,
            expenses: [],
            settlements: [],
            payments: [],
            rawExpenseCents: 0,
            rawSettlementCents: 0,
            rawPaymentCents: 0,
            isIncoming: false,
          });
        }
        const rel = expenseMap.get(exp.paid_by)!;
        rel.totalCents += exp.share_cents;
        rel.expenses.push(exp);
      }
    }

    // Process settlements: reduce amounts
    for (const settlement of explainData.settlements) {
      if (settlement.status !== 'confirmed') continue;

      if (settlement.from_user === userId) {
        // I paid a settlement — reduces what I owe
        const rel = expenseMap.get(settlement.to_user);
        if (rel && !rel.isIncoming) {
          rel.totalCents -= settlement.amount_cents;
        }
      } else if (settlement.to_user === userId) {
        // Someone paid me a settlement — reduces what they owe
        const rel = expenseMap.get(settlement.from_user);
        if (rel && rel.isIncoming) {
          rel.totalCents -= settlement.amount_cents;
        }
      }
    }

    // Process payments: reduce amounts
    for (const payment of explainData.payments) {
      if (payment.from_user === userId) {
        const rel = expenseMap.get(payment.to_user);
        if (rel && !rel.isIncoming) {
          rel.totalCents -= payment.amount_cents;
        }
      } else if (payment.to_user === userId) {
        const rel = expenseMap.get(payment.from_user);
        if (rel && rel.isIncoming) {
          rel.totalCents -= payment.amount_cents;
        }
      }
    }

    // Filter out zero/negative relationships and convert to array
    return Array.from(expenseMap.values())
      .filter((r) => r.totalCents > 0)
      .sort((a, b) => b.totalCents - a.totalCents);
  }, [explainData, userId]);

  // Check if all settled
  const allSettled = balances.length > 0 && balances.every((b) => b.balance_cents === 0);

  // Loading state
  if (balancesLoading || eventLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  // Error state
  if (balancesError) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        Failed to load balances
      </Alert>
    );
  }

  // Honor Restored state
  if (allSettled) {
    return (
      <Box sx={{ maxWidth: 800, mx: 'auto', py: 8 }}>
        <Box sx={{ textAlign: 'center' }}>
          <Box
            sx={{
              width: 80,
              height: 80,
              borderRadius: '50%',
              bgcolor: alpha('#10b981', 0.1),
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              mb: 3,
            }}
          >
            <SettledIcon sx={{ fontSize: 40, color: 'success.main' }} />
          </Box>
          <Typography variant="h4" fontWeight={700} color="success.main" gutterBottom>
            Honor Restored
          </Typography>
          <Typography variant="body1" color="text.secondary">
            The pit is balanced once more. The scales demand no more blood.
          </Typography>
        </Box>
      </Box>
    );
  }

  // Empty state
  if (balances.length === 0) {
    return (
      <Box sx={{ maxWidth: 800, mx: 'auto', py: 8 }}>
        <Box sx={{ textAlign: 'center' }}>
          <Box
            sx={{
              width: 80,
              height: 80,
              borderRadius: '50%',
              bgcolor: alpha('#F59E0B', 0.1),
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              mb: 3,
            }}
          >
            <ScalesIcon sx={{ fontSize: 40, color: 'primary.main' }} />
          </Box>
          <Typography variant="h5" fontWeight={600} gutterBottom>
            The scales are silent
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Add some expenses to see balance calculations.
          </Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh' }}>
      {/* Sticky Header */}
      <Box
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          bgcolor: alpha('#131313', 0.85),
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid',
          borderColor: alpha('#534434', 0.1),
        }}
      >
        <Box sx={{ maxWidth: 1280, mx: 'auto', px: { xs: 2, md: 3 }, py: 2 }}>
          <Typography
            sx={{
              fontSize: { xs: '1.5rem', md: '2rem' },
              fontWeight: 700,
              color: 'primary.main',
              letterSpacing: '-0.02em',
              lineHeight: 1.2,
            }}
          >
            Scales of War
          </Typography>
          <Typography
            sx={{
              fontSize: '0.875rem',
              color: 'text.secondary',
              mt: 0.25,
            }}
          >
            {eventName ? `${eventName} — Balance the scales of justice` : 'The scales demand balance.'}
          </Typography>
        </Box>
      </Box>

      {/* Main Layout: Settlement Cards + Intel Panel */}
      <Box sx={{ maxWidth: 1400, mx: 'auto', px: { xs: 2, md: 3 }, py: 3 }}>
        <Grid container spacing={3}>
          {/* Left: Settlement Cards */}
          <Grid size={{ xs: 12, lg: 8 }}>
            <SettlementCards
              relationships={relationships}
              currentUserId={userId!}
              currency={currency}
              members={members}
              settlementRequests={settlementsData?.data || []}
              eventId={eventId!}
            />
          </Grid>

          {/* Right: Live Intel Panel */}
          {isDesktop && (
            <Grid size={{ xs: 12, lg: 4 }}>
              <Box sx={{ position: 'sticky', top: 24 }}>
                <LiveIntelPanel
                  eventId={eventId!}
                  currentUserId={userId!}
                  stats={stats}
                  currency={currency}
                />
              </Box>
            </Grid>
          )}
        </Grid>
      </Box>
    </Box>
  );
}
