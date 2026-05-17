import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Typography,
  CircularProgress,
  Alert,
  Button,
  alpha,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import {
  ArrowBack as ArrowBackIcon,
  Scale as ScalesIcon,
  CheckCircle as SettledIcon,
} from '@mui/icons-material';

import { useAuthStore } from '@moshsplit/auth-react';
import { groupsApi } from '../../api/groups.api';
import { balancesApi, UserBalanceItem } from '../../api/balances.api';
import { settlementsApi, CreateSettlementRequest } from '../../api/settlements.api';
import { useUsers } from '../../hooks/useUserCache';
import { BalanceRelationshipCard } from '../../components/balances/BalanceRelationshipCard';
import { LiveIntelPanel } from '../../components/balances/LiveIntelPanel';
import { SettleDialog } from '../../components/balances/SettleDialog';

export default function BalancesPage() {
  const { eventId: routeEventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('lg'));

  const userId = useAuthStore((state) => state.userId);
  const eventId = routeEventId;

  // Settle dialog state
  const [settleDialogOpen, setSettleDialogOpen] = useState(false);
  const [settleFromUser, setSettleFromUser] = useState('');
  const [settleToUser, setSettleToUser] = useState('');
  const [settleAmountCents, setSettleAmountCents] = useState(0);

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
  const userMap = useUsers(memberUserIds);

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

  // Fetch stats
  const { data: stats } = useQuery({
    queryKey: ['balances', eventId, 'stats', userId],
    queryFn: () => balancesApi.getStats(eventId!, userId!),
    enabled: !!eventId && !!userId,
    staleTime: 1000 * 60 * 5,
  });

  // Create settlement mutation
  const createSettlementMutation = useMutation({
    mutationFn: (data: CreateSettlementRequest) => settlementsApi.create(eventId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['balances', eventId] });
      queryClient.invalidateQueries({ queryKey: ['balances', eventId, 'stats'] });
      setSettleDialogOpen(false);
    },
  });

  const balances = balancesData?.balances || [];
  const currency = event?.currency || 'EUR';
  const eventName = event?.name || '';

  // Sort balances: highest debt first (most negative balance_cents first)
  const sortedBalances = useMemo(() => {
    return [...balances].sort((a, b) => a.balance_cents - b.balance_cents);
  }, [balances]);

  // Check if all settled
  const allSettled = balances.length > 0 && balances.every((b) => b.balance_cents === 0);

  // Handle settle button click
  const handleOpenSettleDialog = (balance: UserBalanceItem) => {
    if (balance.balance_cents < 0) {
      setSettleFromUser(balance.user_id);
      const owedUser = balances.find((b) => b.balance_cents > 0);
      setSettleToUser(owedUser?.user_id || '');
      setSettleAmountCents(Math.abs(balance.balance_cents));
    } else {
      setSettleToUser(balance.user_id);
      const owingUser = balances.find((b) => b.balance_cents < 0);
      setSettleFromUser(owingUser?.user_id || '');
      setSettleAmountCents(balance.balance_cents);
    }
    setSettleDialogOpen(true);
  };

  const handleConfirmSettlement = async (amountCents: number) => {
    await createSettlementMutation.mutateAsync({
      from_user: settleFromUser,
      to_user: settleToUser,
      amount_cents: amountCents,
    });
  };

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
    <Box sx={{ maxWidth: 1400, mx: 'auto', px: { xs: 2, md: 3 }, py: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          {routeEventId && (
            <Button
              startIcon={<ArrowBackIcon />}
              onClick={() => navigate(`/app/events/${routeEventId}`)}
              size="small"
              sx={{ color: 'text.secondary' }}
            >
              Back
            </Button>
          )}
          <Typography
            variant="h4"
            fontWeight={800}
            sx={{
              background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Scales of War
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary">
          {eventName ? `${eventName} — Balance the scales of justice` : 'The scales demand balance.'}
        </Typography>
      </Box>

      {/* Main Layout: Ledger + Intel Panel */}
      <Grid container spacing={3}>
        {/* Left: Settlement Ledger */}
        <Grid size={{ xs: 12, lg: 8 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {sortedBalances.map((balance) => (
              <BalanceRelationshipCard
                key={balance.user_id}
                userId={balance.user_id}
                currentUserId={userId!}
                balanceCents={balance.balance_cents}
                currency={currency}
                eventId={eventId!}
                onSettle={balance.balance_cents !== 0 ? () => handleOpenSettleDialog(balance) : undefined}
              />
            ))}
          </Box>
        </Grid>

        {/* Right: Live Intel Panel */}
        {isDesktop && (
          <Grid size={{ xs: 12, lg: 4 }}>
            <Box sx={{ position: 'sticky', top: 24 }}>
              <LiveIntelPanel
                eventId={eventId!}
                currentUserId={userId!}
                stats={stats}
                balances={balances}
                currency={currency}
              />
            </Box>
          </Grid>
        )}
      </Grid>

      {/* Settle Dialog */}
      <SettleDialog
        open={settleDialogOpen}
        onClose={() => setSettleDialogOpen(false)}
        onConfirm={handleConfirmSettlement}
        fromUserId={settleFromUser}
        toUserId={settleToUser}
        fromUserName={
          userMap[settleFromUser]
            ? `${userMap[settleFromUser].firstName} ${userMap[settleFromUser].lastName}`.trim() || userMap[settleFromUser].email
            : settleFromUser.slice(0, 8)
        }
        toUserName={
          userMap[settleToUser]
            ? `${userMap[settleToUser].firstName} ${userMap[settleToUser].lastName}`.trim() || userMap[settleToUser].email
            : settleToUser.slice(0, 8)
        }
        defaultAmountCents={settleAmountCents}
        currency={currency}
        isPending={createSettlementMutation.isPending}
      />
    </Box>
  );
}
