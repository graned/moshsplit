import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Divider,
  CircularProgress,
} from '@mui/material';
import { Expense, ExpenseListItem, expensesApi } from '../../../api/expenses.api';
import { GroupMember } from '../../../api/groups.api';

interface ExpenseDetailDialogProps {
  open: boolean;
  onClose: () => void;
  expense: ExpenseListItem | null;
  eventId: string;
  members: GroupMember[];
}

function getMemberName(members: GroupMember[], userId: string): string {
  const member = members.find((m) => m.user_id === userId);
  return member?.user_name || member?.user_email || userId;
}

function formatCurrency(amountCents: number, currency: string = 'EUR'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amountCents / 100);
}

export function ExpenseDetailDialog({
  open,
  onClose,
  expense,
  eventId,
  members,
}: ExpenseDetailDialogProps) {
  const [loading, setLoading] = useState(false);
  const [fullExpense, setFullExpense] = useState<Expense | null>(null);

  useEffect(() => {
    if (expense && open) {
      setLoading(true);
      expensesApi.get(eventId, expense.id)
        .then(setFullExpense)
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [expense, eventId, open]);

  if (!expense) return null;

  const splitTypeLabel = {
    equal: 'Split equally',
    custom: 'Custom amounts',
    percentage: 'By percentage',
    shares: 'By shares',
  }[expense.split_type || 'equal'] || 'Split equally';

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">{expense.title}</Typography>
          <Typography variant="h5" color="primary.main" fontWeight={700}>
            {formatCurrency(expense.amount_cents)}
          </Typography>
        </Box>
      </DialogTitle>
      <DialogContent>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {expense.description && (
              <Box>
                <Typography variant="subtitle2" color="text.secondary">
                  Description
                </Typography>
                <Typography>{expense.description}</Typography>
              </Box>
            )}

            <Divider />

            <Box>
              <Typography variant="subtitle2" color="text.secondary">
                Paid by
              </Typography>
              <Typography>{getMemberName(members, expense.paid_by)}</Typography>
            </Box>

            <Box>
              <Typography variant="subtitle2" color="text.secondary">
                Split type
              </Typography>
              <Typography>{splitTypeLabel}</Typography>
            </Box>

            <Box>
              <Typography variant="subtitle2" color="text.secondary">
                Created by
              </Typography>
              <Typography>{getMemberName(members, expense.created_by)}</Typography>
            </Box>

            <Box>
              <Typography variant="subtitle2" color="text.secondary">
                Created at
              </Typography>
              <Typography>
                {new Date(expense.created_at).toLocaleString()}
              </Typography>
            </Box>

            {fullExpense?.deleted_at && (
              <>
                <Divider />
                <Box>
                  <Typography variant="subtitle2" color="error">
                    Deleted at
                  </Typography>
                  <Typography color="error">
                    {new Date(fullExpense.deleted_at).toLocaleString()}
                  </Typography>
                </Box>
              </>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}