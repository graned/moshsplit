import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import {
  Add as AddIcon,
  Receipt as ReceiptIcon,
} from '@mui/icons-material';

import { useAuthStore } from '@moshsplit/auth-react';
import { groupsApi, GroupMember } from '../../api/groups.api';
import { expensesApi, ExpenseListItem, CreateExpenseRequest } from '../../api/expenses.api';
import { ExpenseCard } from '../../components/expenses/ExpenseCard';
import { AddExpenseDialog } from '../../components/expenses/AddExpenseDialog';
import { ExpenseDetailDialog } from '../../components/expenses/ExpenseDetailDialog';

// Helper to get member name
function getMemberName(members: GroupMember[], userId: string): string {
  const member = members.find((m) => m.user_id === userId);
  return member?.user_name || member?.user_email || userId.slice(0, 8);
}

export default function ExpensesPage() {
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();

  const initialGroupId = searchParams.get('groupId') || '';

  const [selectedGroupId, setSelectedGroupId] = useState(initialGroupId);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<ExpenseListItem | null>(null);

  // Get current user ID from auth
  const userId = useAuthStore((state) => state.userId);

  // Fetch groups for the selector
  const { data: groupsData, isLoading: groupsLoading } = useQuery({
    queryKey: ['groups', userId],
    queryFn: () => {
      if (!userId) throw new Error('User not authenticated');
      return groupsApi.list(userId);
    },
    enabled: !!userId,
  });

  // Fetch expenses for selected group
  const { data: expensesData, isLoading: expensesLoading, error, refetch } = useQuery({
    queryKey: ['expenses', selectedGroupId, userId],
    queryFn: () => {
      if (!userId) throw new Error('User not authenticated');
      return expensesApi.list(selectedGroupId, userId);
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

  // Create expense mutation
  const createMutation = useMutation({
    mutationFn: (data: CreateExpenseRequest) => expensesApi.create(selectedGroupId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses', selectedGroupId] });
      queryClient.invalidateQueries({ queryKey: ['balances', selectedGroupId] });
    },
  });

  // Delete expense mutation
  const deleteMutation = useMutation({
    mutationFn: (expenseId: string) => expensesApi.delete(selectedGroupId, expenseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses', selectedGroupId] });
      queryClient.invalidateQueries({ queryKey: ['balances', selectedGroupId] });
    },
  });

  const handleAddExpense = async (data: CreateExpenseRequest) => {
    if (!userId) {
      throw new Error('User not authenticated');
    }
    await createMutation.mutateAsync({ ...data, user_id: userId });
  };

  const handleExpenseClick = (expense: ExpenseListItem) => {
    setSelectedExpense(expense);
    setDetailDialogOpen(true);
  };

  const handleDeleteExpense = async (expenseId: string) => {
    if (window.confirm('Are you sure you want to delete this expense?')) {
      await deleteMutation.mutateAsync(expenseId);
    }
  };

  const groups = groupsData?.data || [];
  const expenses = expensesData?.data || [];

  // Get current user ID for the paid by selector
  const currentUserId = userId || '';

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight={700}>
            Expenses
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Track and manage group expenses
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setAddDialogOpen(true)}
          disabled={!selectedGroupId}
        >
          Add Expense
        </Button>
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
              Choose a group from the dropdown above to view and add expenses.
            </Typography>
          </CardContent>
        </Card>
      )}

      {/* Loading state */}
      {(groupsLoading || expensesLoading) && selectedGroupId && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      )}

      {/* Error state */}
      {error && selectedGroupId && (
        <Alert severity="error" sx={{ mb: 2 }} action={
          <Button color="inherit" size="small" onClick={() => refetch()}>
            Retry
          </Button>
        }>
          Failed to load expenses
        </Alert>
      )}

      {/* Empty state - no expenses */}
      {!expensesLoading && !error && selectedGroupId && expenses.length === 0 && (
        <Card>
          <CardContent sx={{ py: 8, textAlign: 'center' }}>
            <Box
              sx={{
                width: 80,
                height: 80,
                borderRadius: '50%',
                backgroundColor: 'secondary.main',
                opacity: 0.1,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                mb: 3,
              }}
            >
              <ReceiptIcon sx={{ fontSize: 40, color: 'secondary.main' }} />
            </Box>
            <Typography variant="h6" fontWeight={600} gutterBottom>
              No expenses yet
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Add your first expense to start tracking shared costs.
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setAddDialogOpen(true)}
            >
              Add Expense
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Expenses list */}
      {!expensesLoading && !error && selectedGroupId && expenses.length > 0 && (
        <Grid container spacing={2}>
          {expenses.map((expense) => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={expense.id}>
              <ExpenseCard
                expense={expense}
                onClick={() => handleExpenseClick(expense)}
                onDelete={() => handleDeleteExpense(expense.id)}
                paidByName={getMemberName(members, expense.paid_by)}
              />
            </Grid>
          ))}
        </Grid>
      )}

      {/* Add Expense Dialog */}
      {selectedGroupId && (
        <AddExpenseDialog
          open={addDialogOpen}
          onClose={() => setAddDialogOpen(false)}
          onSubmit={handleAddExpense}
          members={members}
          currentUserId={currentUserId}
        />
      )}

      {/* Expense Detail Dialog */}
      <ExpenseDetailDialog
        open={detailDialogOpen}
        onClose={() => {
          setDetailDialogOpen(false);
          setSelectedExpense(null);
        }}
        expense={selectedExpense}
        eventId={selectedGroupId}
        members={members}
      />
    </Box>
  );
}