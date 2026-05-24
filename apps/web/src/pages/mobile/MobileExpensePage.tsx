import { useState, useMemo, useCallback } from 'react';
import { useParams, useOutletContext } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Box, Typography, CircularProgress, Alert, alpha, Tooltip, IconButton } from '@mui/material';
import {
  ReceiptLong as WarChestIcon,
  AddShoppingCart as AddExpenseIcon,
  AccountBalanceWallet as SpentIcon,
  ArrowDownward as ReturnIcon,
  Paid as RealSpendIcon,
} from '@mui/icons-material';
import { useAuthStore } from '@moshsplit/auth-react';

import { groupsApi, GroupMember } from '../../api/groups.api';
import { balancesApi } from '../../api/balances.api';
import { FilterChips, AddExpenseDrawer, ExpenseDetailDrawer } from '../../components/expenses';
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

  const [selectedType, setSelectedType] = useState<string>();
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
      if (selectedType && item.expense_type && item.expense_type !== selectedType) return false;
      return true;
    });
  }, [allActivityItems, userId, selectedType]);

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
        <Box sx={{ display: 'flex', gap: 1, mb: 1.5 }}>
          <Box sx={{ flex: 1, p: 1, borderRadius: 1.5, bgcolor: alpha('#1E1E1E', 0.5), border: '1px solid', borderColor: alpha('#fff', 0.08), backdropFilter: 'blur(8px)' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25 }}>
              <SpentIcon sx={{ fontSize: 14, color: alpha('#fff', 0.6) }} />
              <Typography sx={{ fontSize: '0.55rem', fontWeight: 700, color: alpha('#fff', 0.5), textTransform: 'uppercase', letterSpacing: '0.05em' }}>You Paid</Typography>
            </Box>
            {statsLoading ? <CircularProgress size={14} sx={{ color: '#fff' }} /> : <Typography sx={{ fontSize: '0.9rem', fontWeight: 800, color: '#fff' }}>{formatAmount(youPaid, currency)}</Typography>}
          </Box>
          <Box sx={{ flex: 1, p: 1, borderRadius: 1.5, bgcolor: alpha('#1E1E1E', 0.5), border: '1px solid', borderColor: alpha('#10b981', 0.2), backdropFilter: 'blur(8px)' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25 }}>
              <ReturnIcon sx={{ fontSize: 14, color: '#10b981' }} />
              <Typography sx={{ fontSize: '0.55rem', fontWeight: 700, color: alpha('#fff', 0.5), textTransform: 'uppercase', letterSpacing: '0.05em' }}>Getting Back</Typography>
            </Box>
            {statsLoading ? <CircularProgress size={14} sx={{ color: '#10b981' }} /> : <Typography sx={{ fontSize: '0.9rem', fontWeight: 800, color: '#10b981' }}>{formatAmount(youGetBack, currency)}</Typography>}
          </Box>
          <Box sx={{ flex: 1, p: 1, borderRadius: 1.5, bgcolor: alpha('#1E1E1E', 0.5), border: '1px solid', borderColor: alpha('#F59E0B', 0.2), backdropFilter: 'blur(8px)' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25 }}>
              <RealSpendIcon sx={{ fontSize: 14, color: '#F59E0B' }} />
              <Typography sx={{ fontSize: '0.55rem', fontWeight: 700, color: alpha('#fff', 0.5), textTransform: 'uppercase', letterSpacing: '0.05em' }}>Real Spend</Typography>
            </Box>
            {statsLoading ? <CircularProgress size={14} sx={{ color: '#F59E0B' }} /> : <Typography sx={{ fontSize: '0.9rem', fontWeight: 800, color: '#F59E0B' }}>{formatAmount(yourRealSpend, currency)}</Typography>}
          </Box>
        </Box>

        {/* Filter Chips */}
        <FilterChips selectedType={selectedType} onTypeChange={setSelectedType} />
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
    </Box>
  );
}
