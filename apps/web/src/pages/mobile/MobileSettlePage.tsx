import { useMemo } from 'react';
import { useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Box, Typography, CircularProgress, Alert, alpha } from '@mui/material';
import { Scale as ScalesIcon, CheckCircle as SettledIcon, TrendingUp as IncomingIcon, TrendingDown as OutgoingIcon, Pending as PendingIcon } from '@mui/icons-material';
import { useAuthStore } from '@moshsplit/auth-react';

import { groupsApi } from '../../api/groups.api';
import { balancesApi } from '../../api/balances.api';
import { settlementsApi } from '../../api/settlements.api';
import { useUsers } from '../../hooks/useUserCache';
import { SettlementCards, RelationshipSummary } from '../../components/balances/SettlementCards';

function formatAmount(cents: number, currency = 'EUR') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export default function MobileSettlePage() {
  const { eventId: routeEventId } = useParams<{ eventId: string }>();

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

  const incomingTotal = relationships.filter((r) => r.isIncoming).reduce((s, r) => s + r.totalCents, 0);
  const outgoingTotal = relationships.filter((r) => !r.isIncoming).reduce((s, r) => s + r.totalCents, 0);
  const pendingRequests = settlementsData?.data?.filter((s) => s.status === 'pending') || [];
  const pendingTotal = pendingRequests.reduce((s, r) => s + r.amount_cents, 0);

  const allSettled = balances.length > 0 && balances.every((b) => b.balance_cents === 0);

  const bannerUrl = event?.images?.banner?.url ?? event?.images?.gallery?.[0]?.url;
  const headerBg = bannerUrl
    ? `linear-gradient(to bottom, rgba(18,18,18,0.3) 0%, rgba(18,18,18,0.7) 60%, #121212 100%), url(${bannerUrl})`
    : `linear-gradient(to bottom, rgba(18,18,18,0.6) 0%, rgba(18,18,18,0.85) 60%, #121212 100%), linear-gradient(135deg, #4A2F0A 0%, #1A1A1A 100%)`;

  if (balancesLoading || eventLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <CircularProgress sx={{ color: 'primary.main' }} />
      </Box>
    );
  }

  if (balancesError) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">Failed to load balances</Alert>
      </Box>
    );
  }

  if (allSettled) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Box
          sx={{
            flexShrink: 0,
            px: 2,
            pt: 1.5,
            pb: 1.5,
            background: headerBg,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: 2,
                bgcolor: alpha('#10b981', 0.12),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <SettledIcon sx={{ fontSize: 22, color: '#10b981' }} />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography
                sx={{
                  fontSize: '1.25rem',
                  fontWeight: 800,
                  color: '#10b981',
                  letterSpacing: '-0.02em',
                  lineHeight: 1.2,
                }}
              >
                Honor Restored
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{
                  fontSize: '0.75rem',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {event?.name || ''}
              </Typography>
            </Box>
          </Box>
        </Box>
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', px: 2 }}>
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="body1" color="text.secondary">
              The pit is balanced once more.
            </Typography>
          </Box>
        </Box>
      </Box>
    );
  }

  if (balances.length === 0) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Box
          sx={{
            flexShrink: 0,
            px: 2,
            pt: 1.5,
            pb: 1.5,
            background: headerBg,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: 2,
                bgcolor: alpha('#F59E0B', 0.12),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <ScalesIcon sx={{ fontSize: 22, color: 'primary.main' }} />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography
                sx={{
                  fontSize: '1.25rem',
                  fontWeight: 800,
                  color: 'primary.main',
                  letterSpacing: '-0.02em',
                  lineHeight: 1.2,
                }}
              >
                The Scales
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{
                  fontSize: '0.75rem',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {event?.name || ''}
              </Typography>
            </Box>
          </Box>
        </Box>
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', px: 2 }}>
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="body1" color="text.secondary">
              Add some expenses to see balance calculations.
            </Typography>
          </Box>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Fixed Header with event image background */}
      <Box
        sx={{
          flexShrink: 0,
          px: 2,
          pt: 1.5,
          pb: 1.5,
          background: headerBg,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      >
        {/* Title row */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0, flex: 1 }}>
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: 2,
                bgcolor: alpha('#F59E0B', 0.12),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <ScalesIcon sx={{ fontSize: 22, color: 'primary.main' }} />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography
                sx={{
                  fontSize: '1.25rem',
                  fontWeight: 800,
                  color: 'primary.main',
                  letterSpacing: '-0.02em',
                  lineHeight: 1.2,
                }}
              >
                The Scales
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{
                  fontSize: '0.75rem',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {event?.name || ''}
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* Glass settlement metric cards */}
        <Box sx={{ display: 'flex', gap: 1, mb: 1.5 }}>
          <Box sx={{ flex: 1, p: 1, borderRadius: 1.5, bgcolor: alpha('#1E1E1E', 0.5), border: '1px solid', borderColor: alpha('#10b981', 0.2), backdropFilter: 'blur(8px)' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25 }}>
              <IncomingIcon sx={{ fontSize: 14, color: '#10b981' }} />
              <Typography sx={{ fontSize: '0.55rem', fontWeight: 700, color: alpha('#fff', 0.5), textTransform: 'uppercase', letterSpacing: '0.05em' }}>Owed to You</Typography>
            </Box>
            <Typography sx={{ fontSize: '0.9rem', fontWeight: 800, color: '#10b981' }}>{formatAmount(incomingTotal, currency)}</Typography>
          </Box>
          <Box sx={{ flex: 1, p: 1, borderRadius: 1.5, bgcolor: alpha('#1E1E1E', 0.5), border: '1px solid', borderColor: alpha('#ef4444', 0.2), backdropFilter: 'blur(8px)' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25 }}>
              <OutgoingIcon sx={{ fontSize: 14, color: '#ef4444' }} />
              <Typography sx={{ fontSize: '0.55rem', fontWeight: 700, color: alpha('#fff', 0.5), textTransform: 'uppercase', letterSpacing: '0.05em' }}>You Owe</Typography>
            </Box>
            <Typography sx={{ fontSize: '0.9rem', fontWeight: 800, color: '#ef4444' }}>{formatAmount(outgoingTotal, currency)}</Typography>
          </Box>
          <Box sx={{ flex: 1, p: 1, borderRadius: 1.5, bgcolor: alpha('#1E1E1E', 0.5), border: '1px solid', borderColor: alpha('#F59E0B', 0.2), backdropFilter: 'blur(8px)' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25 }}>
              <PendingIcon sx={{ fontSize: 14, color: '#F59E0B' }} />
              <Typography sx={{ fontSize: '0.55rem', fontWeight: 700, color: alpha('#fff', 0.5), textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pending</Typography>
            </Box>
            <Typography sx={{ fontSize: '0.9rem', fontWeight: 800, color: '#F59E0B' }}>{formatAmount(pendingTotal, currency)}</Typography>
          </Box>
        </Box>
      </Box>

      {/* Scrollable Settlement Content */}
      <Box
        sx={{
          flexGrow: 1,
          overflow: 'auto',
          WebkitOverflowScrolling: 'touch',
          px: 2,
          pt: 2,
          pb: 4,
        }}
      >
        <SettlementCards
          relationships={relationships}
          currentUserId={userId!}
          currency={currency}
          members={members}
          settlementRequests={settlementsData?.data || []}
          eventId={eventId!}
        />
      </Box>
    </Box>
  );
}
