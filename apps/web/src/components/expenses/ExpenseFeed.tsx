import { useState, useEffect, useRef, useCallback } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import { useInfiniteExpenses } from '../../hooks/useInfiniteExpenses';
import { ExpenseFeedCard } from './ExpenseFeedCard';
import { IntelLog } from './IntelLog';
import { UserInfo } from '../../api/users.api';
import { ExpenseListItem } from '../../api/expenses.api';
import { GroupMember } from '../../api/groups.api';

interface ExpenseFeedProps {
  eventId: string;
  userId: string;
  currency?: string;
  userMap: Record<string, UserInfo>;
  members?: GroupMember[];
  pageSize?: number;
  expenseType?: string;
  emptyState?: React.ReactNode;
  className?: string;
}

export function ExpenseFeed({
  eventId,
  userId,
  currency = 'EUR',
  userMap,
  members = [],
  pageSize = 20,
  expenseType,
  emptyState,
  className,
}: ExpenseFeedProps) {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isError } = useInfiniteExpenses({
    eventId,
    userId,
    pageSize,
    expenseType,
  });

  const expenses = data?.pages.flatMap((p) => p.data) ?? [];

  const [selectedExpense, setSelectedExpense] = useState<ExpenseListItem | null>(null);

  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { rootMargin: '200px' }
    );

    if (sentinelRef.current) {
      observer.observe(sentinelRef.current);
    }

    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const getUser = useCallback((id: string) => userMap[id], [userMap]);

  const handleExpenseClick = (expense: ExpenseListItem) => {
    setSelectedExpense(expense);
  };

  if (isLoading) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (isError) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography color="error">Failed to load expenses</Typography>
      </Box>
    );
  }

  if (expenses.length === 0) {
    return (
      emptyState ?? (
        <Typography sx={{ p: 3, textAlign: 'center' }} color="text.secondary">
          No expenses yet
        </Typography>
      )
    );
  }

  return (
    <Box className={className} sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {expenses.map((expense) => {
        const paidBy = getUser(expense.paid_by);
        const participantUsers = (expense.participant_ids ?? [])
          .map(getUser)
          .filter((u): u is UserInfo => u !== undefined);

        return (
          <ExpenseFeedCard
            key={expense.id}
            expense={expense}
            paidBy={paidBy}
            participants={participantUsers}
            currentUserId={userId}
            currency={currency}
            onClick={() => handleExpenseClick(expense)}
          />
        );
      })}

      {/* Sentinel for infinite scroll */}
      <div ref={sentinelRef} style={{ height: 1 }} />
      {isFetchingNextPage && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
          <CircularProgress size={24} />
        </Box>
      )}

      {/* Intel Log Modal */}
      <IntelLog
        open={!!selectedExpense}
        onClose={() => setSelectedExpense(null)}
        expense={selectedExpense}
        eventId={eventId}
        members={members}
        currency={currency}
        currentUserId={userId}
      />
    </Box>
  );
}
