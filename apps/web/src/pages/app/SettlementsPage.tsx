import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router';
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
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import { SwapHoriz as SettlementIcon, CheckCircle as ConfirmIcon, Add as AddIcon } from '@mui/icons-material';

import { useAuthStore } from '@moshsplit/auth-react';
import { groupsApi, GroupMember } from '../../api/groups.api';
import { settlementsApi, CreateSettlementRequest } from '../../api/settlements.api';

function getMemberName(members: GroupMember[], userId: string): string {
  const member = members.find((m) => m.user_id === userId);
  return member?.user_name || member?.user_email || userId.slice(0, 8);
}

function formatAmount(cents: number, currency: string = 'EUR'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(cents / 100);
}

function getStatusColor(status: string): 'success' | 'warning' | 'error' | 'default' {
  switch (status.toLowerCase()) {
    case 'settled':
    case 'confirmed':
      return 'success';
    case 'pending':
      return 'warning';
    case 'rejected':
    case 'disputed':
      return 'error';
    default:
      return 'default';
  }
}

export default function SettlementsPage() {
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();

  const initialGroupId = searchParams.get('groupId') || '';
  const [selectedGroupId, setSelectedGroupId] = useState(initialGroupId);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newSettlement, setNewSettlement] = useState({ from_user: '', to_user: '', amount: '' });

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

  // Fetch settlements
  const {
    data: settlementsData,
    isLoading: settlementsLoading,
    error,
  } = useQuery({
    queryKey: ['settlements', selectedGroupId, userId],
    queryFn: () => {
      if (!userId) throw new Error('User not authenticated');
      return settlementsApi.list(selectedGroupId, userId);
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
  const createMutation = useMutation({
    mutationFn: (data: CreateSettlementRequest) => settlementsApi.create(selectedGroupId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settlements', selectedGroupId] });
      setCreateDialogOpen(false);
      setNewSettlement({ from_user: '', to_user: '', amount: '' });
    },
  });

  // Update settlement status mutation
  const updateMutation = useMutation({
    mutationFn: ({ settlementId, status }: { settlementId: string; status: string }) =>
      settlementsApi.updateStatus(selectedGroupId, settlementId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settlements', selectedGroupId] });
    },
  });

  const groups = groupsData?.data || [];
  const settlements = settlementsData?.data || [];

  const handleCreateSettlement = async () => {
    const amountCents = Math.round(parseFloat(newSettlement.amount) * 100);
    if (!newSettlement.from_user || !newSettlement.to_user || amountCents <= 0) {
      return;
    }
    await createMutation.mutateAsync({
      from_user: newSettlement.from_user,
      to_user: newSettlement.to_user,
      amount_cents: amountCents,
    });
  };

  const handleConfirmSettlement = async (settlementId: string) => {
    await updateMutation.mutateAsync({ settlementId, status: 'confirmed' });
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" fontWeight={700}>
            Settlements
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Track and settle debts between group members
          </Typography>
        </Box>
        {selectedGroupId && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateDialogOpen(true)}>
            Propose Settlement
          </Button>
        )}
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
              Choose a group from the dropdown above to view settlements.
            </Typography>
          </CardContent>
        </Card>
      )}

      {/* Loading */}
      {groupsLoading || (settlementsLoading && selectedGroupId) ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : null}

      {/* Error */}
      {error && selectedGroupId && <Alert severity="error">Failed to load settlements</Alert>}

      {/* Empty state */}
      {!settlementsLoading && !error && selectedGroupId && settlements.length === 0 && (
        <Card>
          <CardContent sx={{ py: 8, textAlign: 'center' }}>
            <Box
              sx={{
                width: 80,
                height: 80,
                borderRadius: '50%',
                backgroundColor: 'info.main',
                opacity: 0.1,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                mb: 3,
              }}
            >
              <SettlementIcon sx={{ fontSize: 40, color: 'info.main' }} />
            </Box>
            <Typography variant="h6" fontWeight={600} gutterBottom>
              No settlements yet
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Propose a settlement to resolve outstanding balances.
            </Typography>
          </CardContent>
        </Card>
      )}

      {/* Settlements list */}
      {!settlementsLoading && !error && selectedGroupId && settlements.length > 0 && (
        <Grid container spacing={2}>
          {settlements.map((settlement) => (
            <Grid size={{ xs: 12, sm: 6 }} key={settlement.id}>
              <Card variant="outlined">
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body1" fontWeight={600}>
                        {getMemberName(members, settlement.from_user)}
                      </Typography>
                      <SettlementIcon fontSize="small" color="action" />
                      <Typography variant="body1" fontWeight={600}>
                        {getMemberName(members, settlement.to_user)}
                      </Typography>
                    </Box>
                    <Chip label={settlement.status} color={getStatusColor(settlement.status)} size="small" />
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="h6" fontWeight={700}>
                      {formatAmount(settlement.amount_cents)}
                    </Typography>
                    {settlement.status === 'pending' && userId === settlement.from_user && (
                      <Box>
                        <IconButton
                          size="small"
                          color="success"
                          onClick={() => handleConfirmSettlement(settlement.id)}
                          title="Confirm settlement"
                        >
                          <ConfirmIcon />
                        </IconButton>
                      </Box>
                    )}
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    {new Date(settlement.created_at).toLocaleDateString()}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Create Settlement Dialog */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Propose Settlement</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <FormControl fullWidth>
              <InputLabel>From</InputLabel>
              <Select
                value={newSettlement.from_user}
                label="From"
                onChange={(e) => setNewSettlement({ ...newSettlement, from_user: e.target.value })}
              >
                {members.map((member) => (
                  <MenuItem key={member.user_id} value={member.user_id}>
                    {member.user_name || member.user_email || member.user_id}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>To</InputLabel>
              <Select
                value={newSettlement.to_user}
                label="To"
                onChange={(e) => setNewSettlement({ ...newSettlement, to_user: e.target.value })}
              >
                {members.map((member) => (
                  <MenuItem key={member.user_id} value={member.user_id}>
                    {member.user_name || member.user_email || member.user_id}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Amount"
              type="number"
              value={newSettlement.amount}
              onChange={(e) => setNewSettlement({ ...newSettlement, amount: e.target.value })}
              fullWidth
              inputProps={{ step: 0.01, min: 0 }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleCreateSettlement}
            disabled={
              createMutation.isPending || !newSettlement.from_user || !newSettlement.to_user || !newSettlement.amount
            }
          >
            {createMutation.isPending ? 'Creating...' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
