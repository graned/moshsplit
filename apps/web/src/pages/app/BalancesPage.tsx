import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
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
  Divider,
  Button,
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import {
  AccountBalance as BalanceIcon,
  CheckCircle as SettledIcon,
} from '@mui/icons-material';

import { useAuthStore } from '@moshsplit/auth-react';
import { groupsApi, GroupMember } from '../../api/groups.api';
import { balancesApi, DebtTransfer } from '../../api/balances.api';
import { BalanceCard } from '../../components/balances/BalanceCard';

// Helper to get member name
function getMemberName(members: GroupMember[], userId: string): string {
  const member = members.find((m) => m.user_id === userId);
  return member?.user_name || member?.user_email || userId.slice(0, 8);
}

function SimplifiedDebtCard({ transfer, fromName, toName }: {
  transfer: DebtTransfer;
  fromName: string;
  toName: string;
}) {
  const formatAmount = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  };

  return (
    <Card variant="outlined" sx={{ bgcolor: 'warning.main', opacity: 0.9 }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body1">
              <strong>{fromName}</strong>
            </Typography>
            <Typography variant="body2">→</Typography>
            <Typography variant="body1">
              <strong>{toName}</strong>
            </Typography>
          </Box>
          <Typography variant="h6" fontWeight={700}>
            {formatAmount(transfer.amount_cents)}
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
}

export default function BalancesPage() {
  const [searchParams] = useSearchParams();
  const initialGroupId = searchParams.get('groupId') || '';

  const [selectedGroupId, setSelectedGroupId] = useState(initialGroupId);
  const [members, setMembers] = useState<GroupMember[]>([]);

  // Get current user ID from auth
  const userId = useAuthStore((state) => state.userId);

  // Fetch groups
  const { data: groupsData, isLoading: groupsLoading } = useQuery({
    queryKey: ['groups', userId],
    queryFn: () => {
      if (!userId) throw new Error('User not authenticated');
      return groupsApi.list(userId);
    },
    enabled: !!userId,
  });

  // Fetch balances
  const { data: balancesData, isLoading: balancesLoading, error, refetch } = useQuery({
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

  // Fetch members when group changes
  useEffect(() => {
    if (selectedGroupId) {
      groupsApi.listMembers(selectedGroupId).then(setMembers).catch(console.error);
    } else {
      setMembers([]);
    }
  }, [selectedGroupId]);

  const groups = groupsData?.data || [];
  const balances = balancesData?.balances || [];
  const transfers = simplifiedData?.transfers || [];

  // Calculate totals
  const totalOwed = balances.reduce((sum, b) => sum + (b.balance_cents > 0 ? b.balance_cents : 0), 0);
  const totalOwing = balances.reduce((sum, b) => sum + (b.balance_cents < 0 ? Math.abs(b.balance_cents) : 0), 0);

  const formatAmount = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  };

  // Check if all settled
  const allSettled = balances.length > 0 && balances.every((b) => b.balance_cents === 0);

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" fontWeight={700}>
          Balances
        </Typography>
        <Typography variant="body2" color="text.secondary">
          View who owes whom in your groups
        </Typography>
      </Box>

      {/* Group selector */}
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

      {/* No group selected */}
      {!selectedGroupId && !groupsLoading && (
        <Card>
          <CardContent sx={{ py: 8, textAlign: 'center' }}>
            <Typography variant="h6" fontWeight={600} gutterBottom>
              Select a group
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Choose a group from the dropdown above to view balances.
            </Typography>
          </CardContent>
        </Card>
      )}

      {/* Loading state */}
      {(groupsLoading || balancesLoading) && selectedGroupId && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      )}

      {/* Error state */}
      {error && selectedGroupId && (
        <Alert severity="error" sx={{ mb: 2 }} action={
          <Button
            color="inherit"
            size="small"
            onClick={() => refetch()}
          >
            Retry
          </Button>
        }>
          Failed to load balances
        </Alert>
      )}

      {/* All settled state */}
      {!balancesLoading && !error && selectedGroupId && allSettled && (
        <Card>
          <CardContent sx={{ py: 8, textAlign: 'center' }}>
            <Box
              sx={{
                width: 80,
                height: 80,
                borderRadius: '50%',
                backgroundColor: 'success.main',
                opacity: 0.1,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                mb: 3,
              }}
            >
              <SettledIcon sx={{ fontSize: 40, color: 'success.main' }} />
            </Box>
            <Typography variant="h6" fontWeight={600} gutterBottom>
              All settled up!
            </Typography>
            <Typography variant="body2" color="text.secondary">
              No outstanding balances in this group.
            </Typography>
          </CardContent>
        </Card>
      )}

      {/* Balances list */}
      {!balancesLoading && !error && selectedGroupId && !allSettled && balances.length > 0 && (
        <Box>
          {/* Summary */}
          <Card sx={{ mb: 3, bgcolor: 'background.default' }}>
            <CardContent>
              <Grid container spacing={2}>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="body2" color="text.secondary">
                    Total owed to you
                  </Typography>
                  <Typography variant="h5" fontWeight={700} color="success.main">
                    {formatAmount(totalOwed)}
                  </Typography>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="body2" color="text.secondary">
                    Total you owe
                  </Typography>
                  <Typography variant="h5" fontWeight={700} color="error.main">
                    {formatAmount(totalOwing)}
                  </Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {/* Individual balances */}
          <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
            Individual Balances
          </Typography>
          <Grid container spacing={2} sx={{ mb: 4 }}>
            {balances.map((balance) => (
              <Grid size={{ xs: 12, sm: 6 }} key={balance.user_id}>
                <BalanceCard
                  balance={balance}
                  userName={getMemberName(members, balance.user_id)}
                />
              </Grid>
            ))}
          </Grid>

          {/* Simplified debts (how to settle up) */}
          {transfers.length > 0 && (
            <>
              <Divider sx={{ my: 3 }} />
              <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
                How to Settle Up
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Minimal payments needed to settle all debts:
              </Typography>
              <Grid container spacing={2}>
                {transfers.map((transfer, index) => (
                  <Grid size={{ xs: 12, sm: 6 }} key={index}>
                    <SimplifiedDebtCard
                      transfer={transfer}
                      fromName={getMemberName(members, transfer.from_user)}
                      toName={getMemberName(members, transfer.to_user)}
                    />
                  </Grid>
                ))}
              </Grid>
            </>
          )}
        </Box>
      )}

      {/* Empty state - no balances data */}
      {!balancesLoading && !error && selectedGroupId && balances.length === 0 && (
        <Card>
          <CardContent sx={{ py: 8, textAlign: 'center' }}>
            <Box
              sx={{
                width: 80,
                height: 80,
                borderRadius: '50%',
                backgroundColor: 'success.main',
                opacity: 0.1,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                mb: 3,
              }}
            >
              <BalanceIcon sx={{ fontSize: 40, color: 'success.main' }} />
            </Box>
            <Typography variant="h6" fontWeight={600} gutterBottom>
              No balance data
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Add some expenses to see balance calculations.
            </Typography>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}