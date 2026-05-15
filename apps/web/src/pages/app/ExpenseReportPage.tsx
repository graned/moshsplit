import { useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Typography,
  Button,
  IconButton,
  Tabs,
  Tab,
  CircularProgress,
  Alert,
  Card,
  CardContent,
  Chip,
  alpha,
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import {
  ArrowBack as ArrowBackIcon,
  Add as AddIcon,
  TrendingUp as PaidIcon,
  TrendingDown as OweIcon,
  AccountBalance as NetIcon,
  Receipt as ReceiptIcon,
  ShoppingCart as ExpenseIcon,
} from '@mui/icons-material';

import { useAuthStore } from '@moshsplit/auth-react';
import { groupsApi, GroupMember } from '../../api/groups.api';
import { expensesApi, ExpenseListItem, CreateExpenseRequest } from '../../api/expenses.api';
import { balancesApi } from '../../api/balances.api';
import { ExpenseCard } from '../../components/expenses/ExpenseCard';
import { AddExpenseDialog } from '../../components/expenses/AddExpenseDialog';

function getMemberName(members: GroupMember[], userId: string): string {
  const member = members.find((m) => m.user_id === userId);
  return member?.user_name || member?.user_email || userId.slice(0, 8);
}

const formatAmount = (cents: number, currency = 'EUR') => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(cents / 100);
};

export default function ExpenseReportPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.userId);

  const [tab, setTab] = useState(0);
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  const { data: event, isLoading: eventLoading, error: eventError } = useQuery({
    queryKey: ['event', eventId],
    queryFn: async () => {
      if (!eventId) throw new Error('No event ID');
      return groupsApi.get(eventId);
    },
    enabled: !!eventId,
  });

  const { data: members, isLoading: membersLoading } = useQuery({
    queryKey: ['event-members', eventId],
    queryFn: async () => {
      if (!eventId) return [];
      return groupsApi.listMembers(eventId);
    },
    enabled: !!eventId,
  });

  const { data: expensesData, isLoading: expensesLoading } = useQuery({
    queryKey: ['expenses', eventId, userId],
    queryFn: async () => {
      if (!eventId || !userId) return { data: [] as ExpenseListItem[], hasMore: false };
      return expensesApi.list(eventId, userId, undefined, 200);
    },
    enabled: !!eventId && !!userId,
  });

  const { data: explainData, isLoading: explainLoading } = useQuery({
    queryKey: ['expense-report-explain', eventId, userId],
    queryFn: async () => {
      if (!eventId || !userId) throw new Error('Missing params');
      return balancesApi.explainUserBalance(eventId, userId);
    },
    enabled: !!eventId && !!userId,
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateExpenseRequest) => {
      if (!eventId) throw new Error('No event ID');
      return expensesApi.create(eventId, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses', eventId] });
      queryClient.invalidateQueries({ queryKey: ['expense-report-explain', eventId] });
      queryClient.invalidateQueries({ queryKey: ['expenses-page-balances'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (expenseId: string) => {
      if (!eventId) throw new Error('No event ID');
      return expensesApi.delete(eventId, expenseId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses', eventId] });
      queryClient.invalidateQueries({ queryKey: ['expense-report-explain', eventId] });
      queryClient.invalidateQueries({ queryKey: ['expenses-page-balances'] });
    },
  });

  const isLoading = eventLoading || membersLoading || expensesLoading || explainLoading;
  const resolvedMembers = members || [];
  const expenses = expensesData?.data || [];
  const currency = event?.currency || 'EUR';

  const handleAddExpense = async (data: CreateExpenseRequest) => {
    if (!userId) throw new Error('User not authenticated');
    await createMutation.mutateAsync({ ...data, user_id: userId });
    setAddDialogOpen(false);
  };

  const handleDeleteExpense = async (expenseId: string) => {
    if (window.confirm('Are you sure you want to delete this expense?')) {
      await deleteMutation.mutateAsync(expenseId);
    }
  };

  if (eventError && !event) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">Failed to load event</Alert>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <IconButton onClick={() => navigate('/app/expenses')} size="small">
          <ArrowBackIcon />
        </IconButton>
        <Box>
          <Typography variant="h4" fontWeight={700}>
            {event?.name || 'Expense Report'}
          </Typography>
          {event?.description && (
            <Typography variant="body2" color="text.secondary">
              {event.description}
            </Typography>
          )}
        </Box>
      </Box>

      {isLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      )}

      {!isLoading && event && (
        <>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setAddDialogOpen(true)}
            >
              Add Expense
            </Button>
          </Box>

          {/* Summary cards */}
          {explainData && (
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid size={{ xs: 12, sm: 4 }}>
                <Card sx={{ bgcolor: alpha('#10b981', 0.08), border: 1, borderColor: alpha('#10b981', 0.2) }}>
                  <CardContent sx={{ textAlign: 'center', py: 2 }}>
                    <PaidIcon sx={{ fontSize: 28, color: 'success.main', mb: 0.5 }} />
                    <Typography variant="caption" color="text.secondary" display="block">
                      You Paid
                    </Typography>
                    <Typography variant="h5" fontWeight={800} color="success.main">
                      {formatAmount(explainData.paid_cents, currency)}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <Card sx={{ bgcolor: alpha('#ef4444', 0.08), border: 1, borderColor: alpha('#ef4444', 0.2) }}>
                  <CardContent sx={{ textAlign: 'center', py: 2 }}>
                    <OweIcon sx={{ fontSize: 28, color: 'error.main', mb: 0.5 }} />
                    <Typography variant="caption" color="text.secondary" display="block">
                      Your Share
                    </Typography>
                    <Typography variant="h5" fontWeight={800} color="error.main">
                      {formatAmount(explainData.owes_cents, currency)}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <Card sx={{
                  bgcolor: alpha(explainData.balance_cents >= 0 ? '#10b981' : '#ef4444', 0.08),
                  border: 1,
                  borderColor: alpha(explainData.balance_cents >= 0 ? '#10b981' : '#ef4444', 0.2),
                }}>
                  <CardContent sx={{ textAlign: 'center', py: 2 }}>
                    <NetIcon sx={{ fontSize: 28, color: explainData.balance_cents >= 0 ? 'success.main' : 'error.main', mb: 0.5 }} />
                    <Typography variant="caption" color="text.secondary" display="block">
                      Net Balance
                    </Typography>
                    <Typography variant="h5" fontWeight={800} color={explainData.balance_cents >= 0 ? 'success.main' : 'error.main'}>
                      {formatAmount(explainData.balance_cents, currency)}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          )}

          <Tabs
            value={tab}
            onChange={(_, v) => setTab(v)}
            sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}
          >
            <Tab label="OVERVIEW" sx={{ fontWeight: 700, letterSpacing: '0.05em' }} />
            <Tab label={`EXPENSES (${expenses.length})`} sx={{ fontWeight: 700, letterSpacing: '0.05em' }} />
          </Tabs>

          {tab === 0 && explainData && (
            <Box>
              {/* Expense breakdown */}
              {explainData.expenses.length > 0 ? (
                <Box>
                  <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
                    Expense Breakdown
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {explainData.expenses.map((item, i) => (
                      <Card key={i} variant="outlined">
                        <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Box sx={{ minWidth: 0, flex: 1 }}>
                              <Typography variant="body2" fontWeight={600} noWrap>
                                {item.title}
                              </Typography>
                              <Box sx={{ display: 'flex', gap: 2, mt: 0.25 }}>
                                <Typography variant="caption" color="text.secondary">
                                  Paid: {formatAmount(item.paid_cents, currency)}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  Your share: {formatAmount(item.share_cents, currency)}
                                </Typography>
                              </Box>
                            </Box>
                            <Chip
                              label={item.paid_by === userId ? 'You paid' : getMemberName(resolvedMembers, item.paid_by)}
                              size="small"
                              variant="outlined"
                              color={item.paid_by === userId ? 'primary' : 'default'}
                              sx={{ ml: 1, flexShrink: 0 }}
                            />
                          </Box>
                        </CardContent>
                      </Card>
                    ))}
                  </Box>
                </Box>
              ) : (
                <Box sx={{ textAlign: 'center', py: 6 }}>
                  <ExpenseIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
                  <Typography variant="body1" color="text.secondary">
                    No expenses in this event yet
                  </Typography>
                </Box>
              )}

              {/* Payments / settlements */}
              {explainData.payments.length > 0 && (
                <Box sx={{ mt: 4 }}>
                  <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
                    Payments
                  </Typography>
                  {explainData.payments.map((p, i) => (
                    <Card key={i} variant="outlined" sx={{ mb: 1 }}>
                      <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                        <Typography variant="body2">
                          {getMemberName(resolvedMembers, p.from_user)} → {getMemberName(resolvedMembers, p.to_user)}:{' '}
                          <strong>{formatAmount(p.amount_cents, currency)}</strong>
                        </Typography>
                      </CardContent>
                    </Card>
                  ))}
                </Box>
              )}
            </Box>
          )}

          {tab === 1 && (
            <Box>
              {expenses.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 6 }}>
                  <ReceiptIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
                  <Typography variant="body1" color="text.secondary">
                    No expenses yet
                  </Typography>
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => setAddDialogOpen(true)}
                    sx={{ mt: 2 }}
                  >
                    Add the first expense
                  </Button>
                </Box>
              ) : (
                <Grid container spacing={2}>
                  {expenses.map((expense) => (
                    <Grid size={{ xs: 12, sm: 6, md: 4 }} key={expense.id}>
                      <ExpenseCard
                        expense={expense}
                        onClick={() => {}}
                        onDelete={() => handleDeleteExpense(expense.id)}
                        paidByName={getMemberName(resolvedMembers, expense.paid_by)}
                      />
                    </Grid>
                  ))}
                </Grid>
              )}
            </Box>
          )}
        </>
      )}

      {eventId && (
        <AddExpenseDialog
          open={addDialogOpen}
          onClose={() => setAddDialogOpen(false)}
          onSubmit={handleAddExpense}
          members={resolvedMembers}
          currentUserId={userId || ''}
          groupCurrency={currency}
        />
      )}
    </Box>
  );
}
