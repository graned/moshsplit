import { useMemo, useState, useCallback } from 'react';
import { Box, Typography, Button, Dialog, DialogTitle, DialogContent, DialogActions, alpha } from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { paymentsApi, type TransactionWithPaymentContext } from '../../../api/payments.api';
import { useUsers, useUserCache } from '../../../hooks/useUserCache';
import { MobileDrawer } from '../../shared/MobileDrawer';
import { MobileFeedList } from '../../feed/mobile/MobileFeedList';
import { MobileFeedCard } from '../../feed/mobile/MobileFeedCard';

function formatAmount(cents: number, currency = 'EUR') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

interface MobileSettlementHistoryDrawerProps {
  open: boolean;
  onClose: () => void;
  eventId: string;
  userId: string;
  currency: string;
}

export function MobileSettlementHistoryDrawer({
  open,
  onClose,
  eventId,
  userId,
  currency,
}: MobileSettlementHistoryDrawerProps) {
  const { getUser } = useUserCache();
  const queryClient = useQueryClient();

  const [selectedTx, setSelectedTx] = useState<TransactionWithPaymentContext | null>(null);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);

  const { data: transactions = [] } = useQuery({
    queryKey: ['payments-transactions', eventId],
    queryFn: () => paymentsApi.getAllTransactions(eventId!),
    enabled: !!eventId && open,
  });

  const pendingTransactions = useMemo(
    () => transactions.filter((t) => t.status === 'pending'),
    [transactions],
  );
  const confirmedTransactions = useMemo(
    () => transactions.filter((t) => t.status === 'confirmed'),
    [transactions],
  );
  const rejectedTransactions = useMemo(
    () => transactions.filter((t) => t.status === 'rejected'),
    [transactions],
  );

  const allUserIds = useMemo(() => {
    const ids = new Set<string>();
    for (const t of transactions) {
      ids.add(t.creditor_id);
      ids.add(t.debtor_id);
      ids.add(t.proposed_by);
      if (t.confirmed_by) ids.add(t.confirmed_by);
    }
    return Array.from(ids);
  }, [transactions]);

  useUsers(allUserIds);

  const invalidateAllPaymentQueries = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['payments-incoming', eventId] });
    queryClient.invalidateQueries({ queryKey: ['payments-outgoing', eventId] });
    queryClient.invalidateQueries({ queryKey: ['payments-balance', eventId] });
    queryClient.invalidateQueries({ queryKey: ['payments-breakdown', eventId] });
    queryClient.invalidateQueries({ queryKey: ['payments-transactions', eventId] });
    queryClient.invalidateQueries({ queryKey: ['explain-balance', eventId] });
    queryClient.invalidateQueries({ queryKey: ['user-balance', eventId] });
    queryClient.invalidateQueries({ queryKey: ['activity-feed', eventId] });
  }, [queryClient, eventId]);

  const confirmMutation = useMutation({
    mutationFn: (txId: string) => paymentsApi.confirmTransaction(eventId, txId),
    onSuccess: () => {
      invalidateAllPaymentQueries();
      setActionDialogOpen(false);
      setSelectedTx(null);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (txId: string) => paymentsApi.rejectTransaction(eventId, txId),
    onSuccess: () => {
      invalidateAllPaymentQueries();
      setActionDialogOpen(false);
      setSelectedTx(null);
    },
  });

  const getDisplayName = (id: string) => {
    const user = getUser(id);
    return user
      ? `${user.firstName} ${user.lastName}`.trim() || user.email
      : id.slice(0, 8);
  };

  const handleDrawerClose = () => {
    onClose();
  };

  const handleTxClick = useCallback((tx: TransactionWithPaymentContext) => {
    const canAct = tx.status === 'pending' && tx.proposed_by !== userId;
    if (canAct) {
      setSelectedTx(tx);
      setActionDialogOpen(true);
    }
  }, [userId]);

  const emptyState = (message: string) => (
    <Box sx={{ textAlign: 'center', py: 6 }}>
      <Typography variant="body1" color="text.secondary">
        {message}
      </Typography>
    </Box>
  );

  const renderTransaction = (
    tx: TransactionWithPaymentContext,
    accentColor: string,
    statusLabel: string,
  ) => {
    const isDebtor = tx.debtor_id === userId;
    const counterpartyId = isDebtor ? tx.creditor_id : tx.debtor_id;
    const displayName = getDisplayName(counterpartyId);
    const proposerName = getDisplayName(tx.proposed_by);
    const canAct = tx.status === 'pending' && tx.proposed_by !== userId;

    const time = new Date(tx.created_at).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });

    return {
      kind: 'custom' as const,
      id: tx.id,
      node: (
        <Box
          key={tx.id}
          onClick={() => handleTxClick(tx)}
          sx={canAct ? { cursor: 'pointer', '&:active': { opacity: 0.7 } } : {}}
        >
          <MobileFeedCard
            accentColor={accentColor}
            icon={<Box sx={{ width: 18, height: 18 }} />}
            rightContent={
              <Box>
                <Typography sx={{ fontSize: '0.9rem', fontWeight: 700, color: accentColor, lineHeight: 1.2 }}>
                  {formatAmount(tx.amount_cents, currency)}
                </Typography>
                <Typography sx={{ display: 'block', fontSize: '0.6rem', color: 'text.disabled' }}>
                  {time}
                </Typography>
              </Box>
            }
          >
            <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, lineHeight: 1.3, mb: 0.5 }}>
              <Box component="span" color={accentColor}>
                {statusLabel}
              </Box>
              {' — '}
              <Box component="span" color="text.primary">
                {displayName.split('@')[0]}
              </Box>
            </Typography>
            <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', textTransform: 'capitalize' }}>
              {tx.payment_reason} · proposed by {proposerName.split('@')[0]}
            </Typography>
            {canAct && (
              <Typography sx={{ fontSize: '0.65rem', fontWeight: 600, color: accentColor, mt: 0.5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Tap to review
              </Typography>
            )}
          </MobileFeedCard>
        </Box>
      ),
    };
  };

  const items = [
    ...pendingTransactions.map((tx) => renderTransaction(tx, '#F59E0B', 'Pending')),
    ...rejectedTransactions.map((tx) => renderTransaction(tx, '#ef4444', 'Rejected')),
    ...confirmedTransactions.map((tx) => renderTransaction(tx, '#10b981', 'Confirmed')),
  ];

  const counterpartyName = selectedTx
    ? getDisplayName(selectedTx.proposed_by)
    : '';

  return (
    <>
      <MobileDrawer
        open={open}
        onClose={handleDrawerClose}
        title="Transaction History"
        fullScreen
      >
        <Box sx={{ flex: 1, overflow: 'auto', px: 2 }}>
          <MobileFeedList
            items={items}
            emptyState={emptyState('No transactions yet.')}
            currency={currency}
            userMap={{}}
          />
        </Box>
      </MobileDrawer>

      <Dialog
        open={actionDialogOpen}
        onClose={() => { if (!confirmMutation.isPending && !rejectMutation.isPending) { setActionDialogOpen(false); setSelectedTx(null); } }}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            border: `1px solid ${alpha('#F59E0B', 0.2)}`,
            bgcolor: '#121212',
            backgroundImage: 'none',
          },
        }}
      >
        <DialogTitle component="div" sx={{ textAlign: 'center', pb: 0 }}>
          <Typography variant="caption" color="primary.main" fontWeight={700} sx={{ letterSpacing: '0.1em' }}>
            REVIEW TRANSACTION
          </Typography>
          <Typography variant="h6" fontWeight={600} sx={{ mt: 0.5 }}>
            {counterpartyName.split('@')[0]}
          </Typography>
        </DialogTitle>

        <DialogContent sx={{ textAlign: 'center', pt: 2 }}>
          <Typography sx={{ fontSize: '2rem', fontWeight: 800, color: '#F59E0B', mb: 1 }}>
            {selectedTx && formatAmount(selectedTx.amount_cents, currency)}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1, textTransform: 'capitalize' }}>
            {selectedTx?.payment_reason}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Proposed by {counterpartyName.split('@')[0]}
          </Typography>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 3, gap: 1.5, flexDirection: 'column' }}>
          <Button
            fullWidth
            variant="contained"
            disabled={confirmMutation.isPending || rejectMutation.isPending}
            onClick={() => selectedTx && confirmMutation.mutate(selectedTx.id)}
            sx={{
              height: 48, borderRadius: 2,
              bgcolor: '#10b981', color: '#fff',
              fontWeight: 700, letterSpacing: '0.05em',
              '&:hover': { bgcolor: '#059669' },
            }}
          >
            {confirmMutation.isPending ? 'Confirming...' : 'Confirm'}
          </Button>
          <Button
            fullWidth
            variant="outlined"
            disabled={confirmMutation.isPending || rejectMutation.isPending}
            onClick={() => selectedTx && rejectMutation.mutate(selectedTx.id)}
            sx={{
              height: 48, borderRadius: 2,
              borderColor: alpha('#ef4444', 0.5), color: '#ef4444',
              fontWeight: 700, letterSpacing: '0.05em',
              '&:hover': { borderColor: '#ef4444', bgcolor: alpha('#ef4444', 0.08) },
            }}
          >
            {rejectMutation.isPending ? 'Rejecting...' : 'Reject'}
          </Button>
          <Button
            fullWidth
            variant="text"
            disabled={confirmMutation.isPending || rejectMutation.isPending}
            onClick={() => { setActionDialogOpen(false); setSelectedTx(null); }}
            sx={{ color: 'text.secondary' }}
          >
            Cancel
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
