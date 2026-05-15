import { useState, useRef, useEffect, useMemo } from 'react';
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
  Avatar,
  Tooltip,
  alpha,
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import {
  ArrowBack as ArrowBackIcon,
  Add as AddIcon,
  Receipt as ReceiptIcon,
  ShoppingCart as ExpenseIcon,
} from '@mui/icons-material';

import { useAuthStore } from '@moshsplit/auth-react';
import { groupsApi } from '../../api/groups.api';
import { expensesApi, ExpenseListItem, CreateExpenseRequest } from '../../api/expenses.api';
import { balancesApi } from '../../api/balances.api';
import { usersApi, UserInfo } from '../../api/users.api';
import { ExpenseCard } from '../../components/expenses/ExpenseCard';
import { AddExpenseDialog } from '../../components/expenses/AddExpenseDialog';

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
  const [scrollY, setScrollY] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  const { data: event, isLoading: eventLoading, error: eventError } = useQuery({
    queryKey: ['event', eventId],
    queryFn: async () => {
      if (!eventId) throw new Error('No event ID');
      return groupsApi.get(eventId);
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

  // Collect all unique user IDs
  const allUserIds = useMemo(() => {
    const ids = new Set<string>();
    if (expensesData?.data) {
      expensesData.data.forEach((e) => ids.add(e.paid_by));
    }
    if (explainData?.expenses) {
      explainData.expenses.forEach((e) => ids.add(e.paid_by));
    }
    if (explainData?.payments) {
      explainData.payments.forEach((p) => {
        ids.add(p.from_user);
        ids.add(p.to_user);
      });
    }
    return Array.from(ids);
  }, [expensesData, explainData]);

  // Fetch user info from sentinel
  const { data: userMap } = useQuery({
    queryKey: ['expense-users', allUserIds],
    queryFn: () => usersApi.getMany(allUserIds),
    enabled: allUserIds.length > 0,
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
      usersApi.clearCache();
      queryClient.invalidateQueries({ queryKey: ['expense-users'] });
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
      usersApi.clearCache();
      queryClient.invalidateQueries({ queryKey: ['expense-users'] });
    },
  });

  const isLoading = eventLoading || expensesLoading || explainLoading;
  const expenses = expensesData?.data || [];
  const currency = event?.currency || 'EUR';

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    let parent: HTMLElement | null = el.parentElement;
    while (parent) {
      const style = window.getComputedStyle(parent);
      if (
        style.overflowY === 'auto' || style.overflowY === 'scroll' ||
        style.overflow === 'auto' || style.overflow === 'scroll'
      ) break;
      parent = parent.parentElement;
    }
    const container = parent || document.documentElement;
    const onScroll = () => setScrollY(container.scrollTop);
    container.addEventListener('scroll', onScroll, { passive: true });
    return () => container.removeEventListener('scroll', onScroll);
  }, []);

  const heroMaxHeight = 280;
  const heroMinHeight = 72;
  const scrollRange = 200;
  const progress = Math.min(scrollY / scrollRange, 1);
  const heroHeight = heroMaxHeight - (heroMaxHeight - heroMinHeight) * progress;
  const compact = progress > 0.5;

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

  const getUser = (id: string): UserInfo | undefined => userMap?.[id];

  if (eventError && !event) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">Failed to load event</Alert>
      </Box>
    );
  }

  return (
    <Box ref={rootRef}>
      {/* === Sticky header === */}
      <Box sx={{ position: 'sticky', top: 0, zIndex: 10 }}>
        {/* Hero */}
        <Box
          sx={{
            height: heroHeight,
            position: 'relative',
            overflow: 'hidden',
            background: `linear-gradient(135deg, #4A2F0A 0%, #3D2208 50%, #1A1A1A 100%)`,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            px: compact ? 2 : 4,
            pb: compact ? 1 : 3,
          }}
        >
          <Box sx={{
            position: 'absolute', inset: 0,
            background: `linear-gradient(to bottom, transparent 40%, #121212 100%)`,
          }} />

          {/* Back button */}
          <IconButton
            onClick={() => navigate('/app/expenses')}
            sx={{
              position: 'absolute', top: 12, left: compact ? 8 : 16,
              zIndex: 2, color: '#fff',
              bgcolor: alpha('#000', 0.35),
              '&:hover': { bgcolor: alpha('#000', 0.55) },
              width: 32, height: 32,
            }}
          >
            <ArrowBackIcon sx={{ fontSize: 20 }} />
          </IconButton>

          {/* Add Expense button */}
          {!isLoading && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              size="small"
              onClick={() => setAddDialogOpen(true)}
              sx={{
                position: 'absolute', top: 12, right: compact ? 8 : 16,
                zIndex: 2,
                bgcolor: alpha('#000', 0.35),
                color: '#fff',
                '&:hover': { bgcolor: alpha('#000', 0.55) },
              }}
            >
              Add Expense
            </Button>
          )}

          {isLoading ? (
            <Box sx={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'center', pb: 2 }}>
              <CircularProgress />
            </Box>
          ) : event ? (
            <Box sx={{ position: 'relative', zIndex: 1 }}>
              <Typography
                noWrap={compact}
                sx={{
                  fontSize: compact ? '1.15rem' : '2.5rem',
                  fontWeight: compact ? 700 : 800,
                  lineHeight: 1.15,
                  transition: 'font-size 0.25s, font-weight 0.25s',
                  mb: compact ? 0 : 0.5,
                }}
              >
                {event.name}
              </Typography>
              {event.description && (
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: compact ? '0.75rem' : '0.875rem' }}>
                  {event.description}
                </Typography>
              )}
            </Box>
          ) : null}
        </Box>

        {/* Summary bar */}
        {!isLoading && explainData && (
          <Box sx={{
            display: 'flex',
            gap: compact ? 1 : 2,
            px: compact ? 1.5 : 3,
            py: compact ? 1.5 : 2.5,
            bgcolor: 'background.default',
            transition: 'padding 0.25s, gap 0.25s',
          }}>
            {[
              { value: formatAmount(explainData.paid_cents, currency), label: 'You Paid', color: 'primary.main' },
              { value: formatAmount(explainData.owes_cents, currency), label: 'My Share', color: 'text.primary' },
              {
                value: formatAmount(explainData.balance_cents, currency),
                label: explainData.balance_cents >= 0 ? 'Getting Back' : 'You Owe',
                color: explainData.balance_cents >= 0 ? 'success.main' : 'error.main',
              },
            ].map((item) => (
              <Box
                key={item.label}
                sx={{
                  flex: 1,
                  textAlign: 'center',
                  py: compact ? 1 : 2.5,
                  px: compact ? 0.5 : 1,
                  borderRadius: compact ? 2 : 3,
                  bgcolor: 'background.paper',
                  border: 1,
                  borderColor: 'divider',
                  transition: 'padding 0.25s, border-radius 0.25s',
                }}
              >
                <Typography
                  fontWeight={800}
                  color={item.color}
                  sx={{
                    fontSize: compact ? '0.9rem' : '1.75rem',
                    transition: 'font-size 0.25s',
                  }}
                >
                  {item.value}
                </Typography>
                <Typography
                  color="text.secondary"
                  sx={{
                    fontSize: compact ? '0.65rem' : '0.875rem',
                    mt: compact ? 0 : 0.5,
                    transition: 'font-size 0.25s, margin-top 0.25s',
                  }}
                >
                  {item.label}
                </Typography>
              </Box>
            ))}
          </Box>
        )}
      </Box>

      {/* Tabs + content */}
      <Box sx={{ display: 'flex', flexDirection: 'column' }}>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          variant="fullWidth"
          sx={{ borderBottom: 1, borderColor: 'divider', minHeight: 64, bgcolor: 'background.default' }}
        >
          <Tab label="OVERVIEW" sx={{ fontWeight: 700, letterSpacing: '0.05em', fontSize: '0.95rem', py: 2.5 }} />
          <Tab label={`EXPENSES (${expenses.length})`} sx={{ fontWeight: 700, letterSpacing: '0.05em', fontSize: '0.95rem', py: 2.5 }} />
        </Tabs>

        <Box sx={{ p: 3 }}>
          {tab === 0 && explainData && (
            <Box>
              {explainData.expenses.length > 0 ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {explainData.expenses.map((item, i) => {
                    const user = getUser(item.paid_by);
                    const isCurrentUser = item.paid_by === userId;
                    const name = user ? `${user.firstName} ${user.lastName}`.trim() || user.email : item.paid_by;
                    const initial = name.charAt(0).toUpperCase();

                    return (
                      <Card key={i} variant="outlined">
                        <CardContent sx={{ py: 2, px: 2, '&:last-child': { pb: 2 } }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Box sx={{ minWidth: 0, flex: 1 }}>
                              <Typography variant="body1" fontWeight={600} noWrap>
                                {item.title}
                              </Typography>
                              <Box sx={{ display: 'flex', gap: 2, mt: 0.5, flexWrap: 'wrap', alignItems: 'center' }}>
                                <Tooltip
                                  title={
                                    <Box sx={{ py: 0.5 }}>
                                      <Typography variant="body2" fontWeight={600}>{name}</Typography>
                                      {user?.email && (
                                        <Typography variant="caption" color="text.secondary">{user.email}</Typography>
                                      )}
                                    </Box>
                                  }
                                  arrow
                                >
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    <Avatar
                                      sx={{
                                        width: 22,
                                        height: 22,
                                        fontSize: '0.65rem',
                                        fontWeight: 700,
                                        bgcolor: isCurrentUser ? 'primary.main' : 'action.disabledBackground',
                                        cursor: 'default',
                                      }}
                                    >
                                      {initial}
                                    </Avatar>
                                    <Typography variant="caption" color="text.secondary">
                                      {isCurrentUser ? 'You' : name}
                                    </Typography>
                                  </Box>
                                </Tooltip>
                                <Typography variant="caption" color="text.secondary">
                                  Paid: {formatAmount(item.paid_cents, currency)}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  Your share: {formatAmount(item.share_cents, currency)}
                                </Typography>
                              </Box>
                            </Box>
                          </Box>
                        </CardContent>
                      </Card>
                    );
                  })}
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
                  {explainData.payments.map((p, i) => {
                    const fromUser = getUser(p.from_user);
                    const toUser = getUser(p.to_user);
                    const fromName = fromUser ? `${fromUser.firstName} ${fromUser.lastName}`.trim() || fromUser.email : p.from_user;
                    const toName = toUser ? `${toUser.firstName} ${toUser.lastName}`.trim() || toUser.email : p.to_user;

                    return (
                      <Card key={i} variant="outlined" sx={{ mb: 1 }}>
                        <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                          <Typography variant="body2">
                            {fromName} → {toName}:{' '}
                            <strong>{formatAmount(p.amount_cents, currency)}</strong>
                          </Typography>
                        </CardContent>
                      </Card>
                    );
                  })}
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
                  {expenses.map((expense) => {
                    const paidBy = getUser(expense.paid_by);
                    return (
                      <Grid size={{ xs: 12, sm: 6, md: 4 }} key={expense.id}>
                        <ExpenseCard
                          expense={expense}
                          onClick={() => {}}
                          onDelete={() => handleDeleteExpense(expense.id)}
                          paidBy={paidBy}
                          currentUserId={userId || ''}
                        />
                      </Grid>
                    );
                  })}
                </Grid>
              )}
            </Box>
          )}
        </Box>
      </Box>

      {eventId && (
        <AddExpenseDialog
          open={addDialogOpen}
          onClose={() => setAddDialogOpen(false)}
          onSubmit={handleAddExpense}
          members={[]}
          currentUserId={userId || ''}
          groupCurrency={currency}
        />
      )}
    </Box>
  );
}
