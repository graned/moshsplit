import { useState, useEffect, useMemo } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  IconButton,
  alpha,
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import {
  ArrowBack as ArrowBackIcon,
  AccountBalanceWallet as WalletIcon,
  Payments as PaymentsIcon,
  Groups as GroupsIcon,
  CheckCircle as SettledIcon,
  Scale as ScalesIcon,
} from '@mui/icons-material';

import { useAuthStore } from '@moshsplit/auth-react';
import { groupsApi, GroupMember } from '../../api/groups.api';
import { balancesApi, UserBalanceItem } from '../../api/balances.api';
import { settlementsApi, CreateSettlementRequest } from '../../api/settlements.api';
import { StatWidget } from '../../components/balances/StatWidget';
import { RelationshipCard } from '../../components/balances/RelationshipCard';
import { SettleDialog } from '../../components/balances/SettleDialog';

// Helper to get member name
function getMemberName(members: GroupMember[], userId: string): string {
  const member = members.find((m) => m.user_id === userId);
  return member?.user_name || member?.user_email || userId.slice(0, 8);
}

function getMemberRole(members: GroupMember[], userId: string): string {
  const member = members.find((m) => m.user_id === userId);
  return member?.role || '';
}

function formatAmount(cents: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(Math.abs(cents) / 100);
}

export default function BalancesPage() {
  const { eventId: routeEventId } = useParams<{ eventId: string }>();
  const [searchParams] = useSearchParams();
  const queryParamGroupId = searchParams.get('groupId') || '';
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Determine which event/group to use (route param takes priority)
  const selectedEventId = routeEventId || queryParamGroupId;

  const [selectedGroupId, setSelectedGroupId] = useState(selectedEventId);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [settleDialogOpen, setSettleDialogOpen] = useState(false);
  const [settleFromUser, setSettleFromUser] = useState('');
  const [settleToUser, setSettleToUser] = useState('');
  const [settleAmountCents, setSettleAmountCents] = useState(0);

  // Get current user ID from auth
  const userId = useAuthStore((state) => state.userId);

  // Sync route param to local state
  useEffect(() => {
    if (routeEventId) {
      setSelectedGroupId(routeEventId);
    }
  }, [routeEventId]);

  // Fetch groups (for dropdown)
  const { data: groupsData, isLoading: groupsLoading } = useQuery({
    queryKey: ['groups', userId],
    queryFn: () => {
      if (!userId) throw new Error('User not authenticated');
      return groupsApi.list(userId);
    },
    enabled: !!userId && !routeEventId,
  });

  // Fetch event details (for name/currency)
  const { data: eventData } = useQuery({
    queryKey: ['event', selectedGroupId],
    queryFn: () => groupsApi.get(selectedGroupId),
    enabled: !!selectedGroupId,
  });

  // Fetch balances
  const {
    data: balancesData,
    isLoading: balancesLoading,
    error: balancesError,
    refetch: refetchBalances,
  } = useQuery({
    queryKey: ['balances', selectedGroupId, userId],
    queryFn: () => {
      if (!userId) throw new Error('User not authenticated');
      return balancesApi.getAllBalances(selectedGroupId, userId);
    },
    enabled: !!selectedGroupId && !!userId,
  });

  // Fetch simplified debts
  const { data: simplifiedData } = useQuery({
    queryKey: ['balances', selectedGroupId, 'simplified', userId],
    queryFn: () => {
      if (!userId) throw new Error('User not authenticated');
      return balancesApi.getSimplifiedDebts(selectedGroupId, userId);
    },
    enabled: !!selectedGroupId && !!userId,
  });

  // Fetch event stats
  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['balances', selectedGroupId, 'stats', userId],
    queryFn: () => {
      if (!userId) throw new Error('User not authenticated');
      return balancesApi.getStats(selectedGroupId, userId);
    },
    enabled: !!selectedGroupId && !!userId,
  });

  // Fetch members when group changes
  useEffect(() => {
    if (selectedGroupId) {
      groupsApi.listMembers(selectedGroupId).then(setMembers).catch(console.error);
    } else {
      setMembers([]);
    }
  }, [selectedGroupId]);

  // Create settlement mutation
  const createSettlementMutation = useMutation({
    mutationFn: (data: CreateSettlementRequest) => settlementsApi.create(selectedGroupId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['balances', selectedGroupId] });
      queryClient.invalidateQueries({ queryKey: ['balances', selectedGroupId, 'stats'] });
      setSettleDialogOpen(false);
    },
  });

  const groups = groupsData?.data || [];
  const balances = balancesData?.balances || [];
  const transfers = simplifiedData?.transfers || [];
  const currency = eventData?.currency || 'USD';
  const eventName = eventData?.name || '';

  // Derive current user's paid/balance from the balances array
  const currentUserBalance = useMemo(() => {
    return balances.find((b) => b.user_id === userId);
  }, [balances, userId]);
  const yourPaidCents = currentUserBalance?.paid_cents ?? 0;
  const yourBalanceCents = currentUserBalance?.balance_cents ?? 0;

  // Sort balances: highest debt first (most negative balance_cents first)
  const sortedBalances = useMemo(() => {
    return [...balances].sort((a, b) => a.balance_cents - b.balance_cents);
  }, [balances]);

  // Check if all settled
  const allSettled = balances.length > 0 && balances.every((b) => b.balance_cents === 0);

  // Handle settle button click
  const handleOpenSettleDialog = (balance: UserBalanceItem) => {
    // If balance is negative, this user owes money (they pay)
    // If balance is positive, this user is owed money (they receive)
    if (balance.balance_cents < 0) {
      // This user owes -> they pay to someone who is owed
      setSettleFromUser(balance.user_id);
      // Find a user who is owed money
      const owedUser = balances.find((b) => b.balance_cents > 0);
      setSettleToUser(owedUser?.user_id || '');
      setSettleAmountCents(Math.abs(balance.balance_cents));
    } else {
      // This user is owed -> someone pays them
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

  // ============ RENDER ============

  // No group selected (standalone page without event route)
  if (!selectedGroupId && !groupsLoading) {
    return (
      <Box>
        <Box sx={{ mb: 3 }}>
          <Typography variant="h4" fontWeight={700}>
            Scales of War
          </Typography>
          <Typography variant="body2" color="text.secondary">
            View who owes whom in your groups
          </Typography>
        </Box>

        <Box sx={{ mb: 3 }}>
          <FormControl fullWidth sx={{ maxWidth: 400 }}>
            <InputLabel>Select Group</InputLabel>
            <Select
              value={selectedGroupId}
              label="Select Group"
              onChange={(e) => setSelectedGroupId(e.target.value)}
              disabled={groupsLoading}
            >
              <MenuItem value="">
                <em>Select a group</em>
              </MenuItem>
              {groups.map((group) => (
                <MenuItem key={group.id} value={group.id}>
                  {group.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        <Card>
          <CardContent sx={{ py: 8, textAlign: 'center' }}>
            <Box
              sx={{
                width: 80,
                height: 80,
                borderRadius: '50%',
                bgcolor: alpha('#f59e0b', 0.1),
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                mb: 3,
              }}
            >
              <ScalesIcon sx={{ fontSize: 40, color: 'primary.main' }} />
            </Box>
            <Typography variant="h6" fontWeight={600} gutterBottom>
              Select a group
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Choose a group from the dropdown above to view balances.
            </Typography>
          </CardContent>
        </Card>
      </Box>
    );
  }

  // Loading state
  if (balancesLoading || statsLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  // Error state
  if (balancesError) {
    return (
      <Alert
        severity="error"
        sx={{ mb: 2 }}
        action={
          <Button color="inherit" size="small" onClick={() => refetchBalances()}>
            Retry
          </Button>
        }
      >
        Failed to load balances
      </Alert>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          {routeEventId && (
            <IconButton
              onClick={() => navigate(`/app/events/${routeEventId}`)}
              size="small"
              sx={{ color: 'text.secondary' }}
            >
              <ArrowBackIcon />
            </IconButton>
          )}
          <Typography variant="h4" fontWeight={700}>
            {eventName || 'Scales of War'}
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary">
          {eventName ? 'Balance the scales of justice' : 'View who owes whom'}
        </Typography>
      </Box>

      {/* Group selector (only when not using route event) */}
      {!routeEventId && (
        <Box sx={{ mb: 3 }}>
          <FormControl fullWidth sx={{ maxWidth: 400 }}>
            <InputLabel>Select Group</InputLabel>
            <Select
              value={selectedGroupId}
              label="Select Group"
              onChange={(e) => setSelectedGroupId(e.target.value)}
              disabled={groupsLoading}
            >
              <MenuItem value="">
                <em>Select a group</em>
              </MenuItem>
              {groups.map((group) => (
                <MenuItem key={group.id} value={group.id}>
                  {group.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      )}

      {/* Honor Restored state */}
      {!balancesLoading && allSettled && (
        <Card>
          <CardContent sx={{ py: 8, textAlign: 'center' }}>
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
            <Typography variant="h5" fontWeight={700} color="success.main" gutterBottom>
              Honor Restored
            </Typography>
            <Typography variant="body1" color="text.secondary">
              The pit is balanced once more.
            </Typography>
          </CardContent>
        </Card>
      )}

      {/* Empty state - no balances data */}
      {!balancesLoading && !allSettled && balances.length === 0 && (
        <Card>
          <CardContent sx={{ py: 8, textAlign: 'center' }}>
            <Box
              sx={{
                width: 80,
                height: 80,
                borderRadius: '50%',
                bgcolor: alpha('#f59e0b', 0.1),
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                mb: 3,
              }}
            >
              <WalletIcon sx={{ fontSize: 40, color: 'primary.main' }} />
            </Box>
            <Typography variant="h6" fontWeight={600} gutterBottom>
              The pit is balanced once more
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Add some expenses to see balance calculations.
            </Typography>
          </CardContent>
        </Card>
      )}

      {/* Main content */}
      {!balancesLoading && !allSettled && balances.length > 0 && (
        <>
          {/* Stats Row */}
          <Box sx={{ mb: 3 }}>
            <Grid container spacing={2}>
              <Grid size={{ xs: 4 }}>
                <StatWidget
                  label="Total Damage"
                  value={formatAmount(statsData?.total_spent_cents || 0, currency)}
                  icon={<WalletIcon sx={{ fontSize: 18 }} />}
                  color="primary.main"
                />
              </Grid>
              <Grid size={{ xs: 4 }}>
                <StatWidget
                  label="Your Share"
                  value={formatAmount(statsData?.your_share_cents || 0, currency)}
                  icon={<GroupsIcon sx={{ fontSize: 18 }} />}
                  color="warning.main"
                />
              </Grid>
              <Grid size={{ xs: 4 }}>
                <StatWidget
                  label="You Paid"
                  value={formatAmount(yourPaidCents || 0, currency)}
                  icon={<PaymentsIcon sx={{ fontSize: 18 }} />}
                  color={yourBalanceCents >= 0 ? 'success.main' : 'error.main'}
                />
              </Grid>
            </Grid>
          </Box>

          {/* Relationship Cards - sorted by amount (highest debt first) */}
          <Typography variant="h6" fontWeight={600} sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            <ScalesIcon sx={{ fontSize: 20, color: 'primary.main' }} />
            Debts & Balances
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 4 }}>
            {sortedBalances.map((balance) => (
              <RelationshipCard
                key={balance.user_id}
                balance={balance}
                userName={getMemberName(members, balance.user_id)}
                userRole={getMemberRole(members, balance.user_id)}
                isCurrentUser={balance.user_id === userId}
                currency={currency}
                onSettle={balance.balance_cents !== 0 ? () => handleOpenSettleDialog(balance) : undefined}
              />
            ))}
          </Box>

          {/* Simplified debts (how to settle up) */}
          {transfers.length > 0 && (
            <Box>
              <Typography variant="h6" fontWeight={600} sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <PaymentsIcon sx={{ fontSize: 20, color: 'warning.main' }} />
                How to Settle Up
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Minimal payments needed to settle all debts:
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {transfers.map((transfer, index) => (
                  <Card
                    key={index}
                    variant="outlined"
                    sx={{
                      bgcolor: alpha('#f59e0b', 0.06),
                      borderColor: alpha('#f59e0b', 0.2),
                    }}
                  >
                    <CardContent>
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="body1" fontWeight={600}>
                            {getMemberName(members, transfer.from_user)}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            →
                          </Typography>
                          <Typography variant="body1" fontWeight={600}>
                            {getMemberName(members, transfer.to_user)}
                          </Typography>
                        </Box>
                        <Typography variant="h6" fontWeight={700} color="warning.main">
                          {formatAmount(transfer.amount_cents, currency)}
                        </Typography>
                      </Box>
                    </CardContent>
                  </Card>
                ))}
              </Box>
            </Box>
          )}
        </>
      )}

      {/* Settle Dialog */}
      <SettleDialog
        open={settleDialogOpen}
        onClose={() => setSettleDialogOpen(false)}
        onConfirm={handleConfirmSettlement}
        fromUserId={settleFromUser}
        toUserId={settleToUser}
        fromUserName={getMemberName(members, settleFromUser)}
        toUserName={getMemberName(members, settleToUser)}
        defaultAmountCents={settleAmountCents}
        currency={currency}
        isPending={createSettlementMutation.isPending}
      />
    </Box>
  );
}
