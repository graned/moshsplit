import { useMemo } from 'react';
import { useParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Box, Typography, CircularProgress, Alert, alpha } from '@mui/material';
import { Scale as ScalesIcon, CheckCircle as SettledIcon } from '@mui/icons-material';
import { useAuthStore } from '@moshsplit/auth-react';

import { groupsApi } from '../../api/groups.api';
import { balancesApi } from '../../api/balances.api';
import { settlementsApi } from '../../api/settlements.api';
import { useUsers } from '../../hooks/useUserCache';
import { SettlementCards, RelationshipSummary } from '../../components/balances/SettlementCards';

export default function MobileSettlePage() {
  const { eventId: routeEventId } = useParams<{ eventId: string }>();
  const queryClient = useQueryClient();

  const userId = useAuthStore((state) => state.userId);
  const eventId = routeEventId;

  const { data: event, isLoading: eventLoading } = useQuery({
    queryKey: ['event', eventId],
    queryFn: () => groupsApi.get(eventId!),
    enabled: !!eventId,
  });

  const { data: members = [] } = useQuery({
    queryKey: ['event-members', eventId],
    queryFn: () => groupsApi.listMembers(eventId!),
    enabled: !!eventId,
  });

  const memberUserIds = useMemo(() => members.map((m) => m.user_id), [members]);
  useUsers(memberUserIds);

  const {
    data: balancesData,
    isLoading: balancesLoading,
    error: balancesError,
  } = useQuery({
    queryKey: ['balances', eventId, userId],
    queryFn: () => balancesApi.getAllBalances(eventId!, userId!),
    enabled: !!eventId && !!userId,
  });

  const { data: explainData } = useQuery({
    queryKey: ['balance-explain', eventId, userId],
    queryFn: () => balancesApi.explainUserBalance(eventId!, userId!),
    enabled: !!eventId && !!userId,
    staleTime: 1000 * 60 * 5,
  });

  const { data: settlementsData } = useQuery({
    queryKey: ['settlements', eventId, userId],
    queryFn: () => settlementsApi.list(eventId!, userId!, undefined, 50),
    enabled: !!eventId && !!userId,
    staleTime: 1000 * 60 * 2,
  });

  const balances = balancesData?.balances || [];
  const currency = event?.currency || 'EUR';

  const relationships = useMemo((): RelationshipSummary[] => {
    if (!explainData) return [];

    const expenseMap = new Map<string, RelationshipSummary>();

    for (const exp of explainData.expenses) {
      if (!exp.participants || exp.participants.length === 0) continue;

      if (exp.paid_by === userId) {
        for (const participantId of exp.participants) {
          if (participantId === userId) continue;

          if (!expenseMap.has(participantId)) {
            expenseMap.set(participantId, {
              userId: participantId,
              totalCents: 0,
              expenses: [],
              isIncoming: true,
            });
          }
          const rel = expenseMap.get(participantId)!;
          rel.totalCents += exp.share_cents;
          rel.expenses.push(exp);
        }
      } else {
        if (!expenseMap.has(exp.paid_by)) {
          expenseMap.set(exp.paid_by, {
            userId: exp.paid_by,
            totalCents: 0,
            expenses: [],
            isIncoming: false,
          });
        }
        const rel = expenseMap.get(exp.paid_by)!;
        rel.totalCents += exp.share_cents;
        rel.expenses.push(exp);
      }
    }

    for (const settlement of explainData.settlements) {
      if (settlement.status !== 'confirmed') continue;

      if (settlement.from_user === userId) {
        const rel = expenseMap.get(settlement.to_user);
        if (rel && !rel.isIncoming) {
          rel.totalCents -= settlement.amount_cents;
        }
      } else if (settlement.to_user === userId) {
        const rel = expenseMap.get(settlement.from_user);
        if (rel && rel.isIncoming) {
          rel.totalCents -= settlement.amount_cents;
        }
      }
    }

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

    return Array.from(expenseMap.values())
      .filter((r) => r.totalCents > 0)
      .sort((a, b) => b.totalCents - a.totalCents);
  }, [explainData, userId]);

  const allSettled = balances.length > 0 && balances.every((b) => b.balance_cents === 0);

  const handleSettlementSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['balances', eventId] });
    queryClient.invalidateQueries({ queryKey: ['balances', eventId, 'stats'] });
    queryClient.invalidateQueries({ queryKey: ['balance-explain', eventId, userId] });
    queryClient.invalidateQueries({ queryKey: ['settlements', eventId, userId] });
  };

  if (balancesLoading || eventLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (balancesError) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        Failed to load balances
      </Alert>
    );
  }

  if (allSettled) {
    return (
      <Box sx={{ py: 8 }}>
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
            The pit is balanced once more.
          </Typography>
        </Box>
      </Box>
    );
  }

  if (balances.length === 0) {
    return (
      <Box sx={{ py: 8 }}>
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
    <Box sx={{ px: 2, pt: 2, pb: 4 }}>
      <SettlementCards
        relationships={relationships}
        currentUserId={userId!}
        currency={currency}
        members={members}
        settlementRequests={settlementsData?.data || []}
        onSettlementSuccess={handleSettlementSuccess}
        eventId={eventId!}
      />
    </Box>
  );
}
