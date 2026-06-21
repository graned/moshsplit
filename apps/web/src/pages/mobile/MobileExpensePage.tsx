import { useState, useMemo, useCallback } from 'react';
import { useParams, useOutletContext } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Box, Typography, CircularProgress, Alert, alpha, Tooltip, IconButton } from '@mui/material';
import {
  ReceiptLong as WarChestIcon,
  AddShoppingCart as AddExpenseIcon,
} from '@mui/icons-material';
import { useAuthStore } from '@moshsplit/auth-react';

import { groupsApi, GroupMember } from '../../api/groups.api';
import { balancesApi } from '../../api/balances.api';
import { AddExpenseDrawer, ExpenseDetailDrawer } from '../../components/expenses';
import { FilterDrawerLauncher, FilterDrawerContent } from '../../components/shared/filters';
import { MobileFeedList } from '../../components/feed';
import { useUsers } from '../../hooks/useUserCache';
import { useUIStore } from '../../stores/uiStore';
import { UserInfo } from '../../api/users.api';
import { MobilePageHeader } from '../../components/shared';
import { useActivityFeed } from '../../hooks/useActivityFeed';
import { ExpenseActivity } from '../../api/activity.api';

interface MobileOutletContext {
  eventId: string | undefined;
  currentUser: { id: string; firstName: string; lastName: string; email: string };
}

function formatAmount(cents: number, currency = 'EUR') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export default function MobileExpensePage() {
  const { eventId: paramEventId } = useParams<{ eventId: string }>();
  const { eventId, currentUser } = useOutletContext<MobileOutletContext>();
  const userId = useAuthStore((state) => state.userId);

  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<ExpenseActivity | null>(null);
  const { addExpenseOpen, setAddExpenseOpen } = useUIStore();

  const { data: event, isLoading: eventLoading, error: eventError } = useQuery({
    queryKey: ['event', paramEventId],
    queryFn: () => groupsApi.get(paramEventId!),
    enabled: !!paramEventId,
  });

  const { data: members = [], isLoading: membersLoading } = useQuery({
    queryKey: ['event-members', paramEventId],
    queryFn: () => groupsApi.listMembers(paramEventId!),
    enabled: !!paramEventId,
    staleTime: 1000 * 60 * 5,
  });

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['event-stats', paramEventId, userId],
    queryFn: () => balancesApi.getStats(paramEventId!, userId!),
    enabled: !!paramEventId && !!userId,
    staleTime: 1000 * 60 * 5,
  });

  const { data: eventForDialog } = useQuery({
    queryKey: ['event', eventId],
    queryFn: () => groupsApi.get(eventId!),
    enabled: !!eventId && addExpenseOpen,
  });

  const { data: membersForDialog = [] } = useQuery({
    queryKey: ['event-members', eventId],
    queryFn: () => groupsApi.listMembers(eventId!),
    enabled: !!eventId && addExpenseOpen,
  });

  const {
    data: activityPages,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: activityLoading,
    isError: activityError,
  } = useActivityFeed({
    eventId: paramEventId!,
    userId: userId!,
    enabled: !!paramEventId && !!userId,
  });

  const allActivityItems = activityPages?.pages.flatMap((p) => p.data) ?? [];

  const memberUserIds = useMemo(() => members.map((m) => m.user_id), [members]);
  const sentinelUsers = useUsers(memberUserIds);

  const userMap = useMemo((): Record<string, UserInfo> => {
    const map: Record<string, UserInfo> = {};
    members.forEach((m: GroupMember) => {
      const sentinel = sentinelUsers[m.user_id];
      if (sentinel) {
        map[m.user_id] = sentinel;
      } else {
        const name = m.user_name || m.user_email || '';
        const parts = name.split(' ');
        map[m.user_id] = {
          id: m.user_id,
          firstName: parts[0] || '',
          lastName: parts.slice(1).join(' '),
          email: m.user_email || '',
        };
      }
    });
    return map;
  }, [members, sentinelUsers]);

  const expenseItems = useMemo(() => {
    return allActivityItems.filter((item) => {
      if (item.type !== 'expense') return false;
      if (item.paid_by !== userId) return false;
      if (selectedTypes.length > 0 && item.expense_type && !selectedTypes.includes(item.expense_type)) return false;
      return true;
    });
  }, [allActivityItems, userId, selectedTypes]);

  const totalExpenses = useMemo(() => allActivityItems.filter((item) => item.type === 'expense' && item.paid_by === userId).length, [allActivityItems, userId]);

  const expenseTypeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of allActivityItems) {
      if (item.type === 'expense' && item.paid_by === userId && item.expense_type) {
        counts[item.expense_type] = (counts[item.expense_type] || 0) + 1;
      }
    }
    return counts;
  }, [allActivityItems, userId]);

  const EXPENSE_TYPE_OPTIONS = [
    { value: 'all', label: 'All', count: totalExpenses },
    { value: 'food', label: 'Food', count: expenseTypeCounts['food'] || 0 },
    { value: 'transport', label: 'Travel', count: expenseTypeCounts['transport'] || 0 },
    { value: 'merch', label: 'Merch', count: expenseTypeCounts['merch'] || 0 },
    { value: 'beer', label: 'Beer', count: expenseTypeCounts['beer'] || 0 },
    { value: 'gas', label: 'Gas', count: expenseTypeCounts['gas'] || 0 },
    { value: 'camping', label: 'Camping', count: expenseTypeCounts['camping'] || 0 },
  ];

  const handleFilterToggle = (value: string) => {
    if (value === 'all') {
      setSelectedTypes([]);
      setFilterDrawerOpen(false);
      return;
    }
    setSelectedTypes((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    );
  };

  const handleFilterClear = () => {
    setSelectedTypes([]);
  };

  const activeFilters = selectedTypes.map((type) => {
    const option = EXPENSE_TYPE_OPTIONS.find((o) => o.value === type);
    return { value: type, label: option?.label ?? type };
  });

  const handleExpenseClick = useCallback(
    (expenseId: string) => {
      const expense = expenseItems.find((item) => item.id === expenseId);
      if (expense && expense.type === 'expense') {
        setSelectedExpense(expense);
      }
    },
    [expenseItems],
  );

  if (!paramEventId) {
    return (
      <Box sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
        <Typography variant="body1">Select an event to view expenses.</Typography>
      </Box>
    );
  }

  const isLoading = eventLoading || membersLoading;

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <CircularProgress sx={{ color: 'primary.main' }} />
      </Box>
    );
  }

  if (eventError) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">Failed to load event</Alert>
      </Box>
    );
  }

  const currency = event?.currency || 'EUR';

  const youPaid = stats?.your_paid_cents ?? 0;
  const youGetBack = stats?.your_incoming_cents ?? 0;
  const yourRealSpend = youPaid - youGetBack;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <MobilePageHeader
        icon={<WarChestIcon sx={{ fontSize: 22, color: 'primary.main' }} />}
        title="War Chest"
        subtitle={event?.name || ''}
        rightAction={
          <Tooltip title="Add expense" placement="bottom">
            <IconButton
              onClick={() => setAddExpenseOpen(true)}
              sx={{
                width: 44,
                height: 44,
                borderRadius: 2.5,
                bgcolor: alpha('#F59E0B', 0.85),
                color: '#121212',
                border: '1px solid',
                borderColor: alpha('#F59E0B', 0.4),
                boxShadow: '0 0 16px rgba(245, 158, 11, 0.3)',
                '&:hover': {
                  bgcolor: '#F59E0B',
                  borderColor: '#F59E0B',
                  boxShadow: '0 0 24px rgba(245, 158, 11, 0.45)',
                },
                transition: 'all 0.2s',
              }}
            >
              <AddExpenseIcon sx={{ fontSize: 22 }} />
            </IconButton>
          </Tooltip>
        }
        backgroundImage={event?.images?.banner?.url ?? event?.images?.gallery?.[0]?.url}
      >
        <Box sx={{ px: 1, py: 1 }}>
          <Box sx={{ p: 2, borderRadius: 2, bgcolor: alpha('#1A1A1A', 0.7), border: '1px solid', borderColor: alpha('#F59E0B', 0.35), backdropFilter: 'blur(8px)', boxShadow: '0 0 20px rgba(245,158,11,0.12)' }}>
            <Box sx={{ textAlign: 'center', mb: 1 }}>
              <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: alpha('#fff', 0.5), textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.5 }}>
                Real Spend
              </Typography>
              {statsLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 0.5 }}>
                  <CircularProgress size={22} sx={{ color: '#F59E0B' }} />
                </Box>
              ) : (
                <Typography sx={{ fontSize: '1.75rem', fontWeight: 800, background: 'linear-gradient(135deg, #F59E0B 0%, #FBBF24 50%, #F59E0B 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', lineHeight: 1.1 }}>
                  {formatAmount(yourRealSpend, currency)}
                </Typography>
              )}
              <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: alpha('#F59E0B', 0.7), mt: 0.25 }}>
                Your actual cost after getting back
              </Typography>
            </Box>

            <Box sx={{ height: 1, bgcolor: alpha('#fff', 0.1), mb: 1 }} />

            <Box sx={{ display: 'flex' }}>
              <Box sx={{ flex: 1, textAlign: 'center' }}>
                <Typography sx={{ fontSize: '0.55rem', fontWeight: 700, color: alpha('#fff', 0.5), textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.25 }}>You Paid</Typography>
                {statsLoading ? <CircularProgress size={14} sx={{ color: '#fff' }} /> : <Typography sx={{ fontSize: '0.85rem', fontWeight: 800, color: '#fff' }}>{formatAmount(youPaid, currency)}</Typography>}
              </Box>
              <Box sx={{ flex: 1, textAlign: 'center' }}>
                <Typography sx={{ fontSize: '0.55rem', fontWeight: 700, color: alpha('#fff', 0.5), textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.25 }}>Getting Back</Typography>
                {statsLoading ? <CircularProgress size={14} sx={{ color: '#10b981' }} /> : <Typography sx={{ fontSize: '0.85rem', fontWeight: 800, color: '#10b981' }}>{formatAmount(youGetBack, currency)}</Typography>}
              </Box>
            </Box>
          </Box>
        </Box>

        {/* Filter row */}
        <FilterDrawerLauncher
          activeFilters={activeFilters}
          onClick={() => setFilterDrawerOpen(true)}
        />
      </MobilePageHeader>

      {/* Scrollable Feed */}
      <Box
        sx={{
          flexGrow: 1,
          overflow: 'auto',
          WebkitOverflowScrolling: 'touch',
          px: 2,
          pt: 1,
          pb: 2,
        }}
      >
        <MobileFeedList
          items={expenseItems}
          userMap={userMap}
          currency={currency}
          isLoading={activityLoading}
          isError={activityError}
          hasNextPage={hasNextPage}
          isFetchingNextPage={isFetchingNextPage}
          fetchNextPage={fetchNextPage}
          activityType="expense"
          onExpenseClick={handleExpenseClick}
        />
      </Box>

{/* Expense Drawers */}
      {eventId && (
        <>
          <AddExpenseDrawer
            open={addExpenseOpen}
            onClose={() => setAddExpenseOpen(false)}
            eventId={eventId}
            members={membersForDialog}
            currentUser={currentUser}
            groupCurrency={eventForDialog?.currency}
            onSuccess={() => setAddExpenseOpen(false)}
          />
          <ExpenseDetailDrawer
            open={!!selectedExpense}
            onClose={() => setSelectedExpense(null)}
            expense={selectedExpense}
            eventId={eventId}
            currency={currency}
            userMap={userMap}
          />
        </>
      )}

      {/* Filter Drawer */}
      <FilterDrawerContent
        open={filterDrawerOpen}
        onClose={() => setFilterDrawerOpen(false)}
        title="Filter by Type"
        options={EXPENSE_TYPE_OPTIONS}
        selectedValues={selectedTypes}
        onToggle={handleFilterToggle}
        onClear={handleFilterClear}
      />
    </Box>
  );
}
