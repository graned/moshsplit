import { useEffect, useRef, useCallback } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import { useInfiniteExpenses } from '../../hooks/useInfiniteExpenses';
import { ExpenseFeedCard } from './ExpenseFeedCard';
import { UserInfo } from '../../api/users.api';

interface ExpenseFeedProps {
  eventId: string;
  userId: string;
  currency?: string;
  userMap: Record<string, UserInfo>;
  pageSize?: number;
  onExpenseClick?: (expenseId: string) => void;
  emptyState?: React.ReactNode;
  className?: string;
}

export function ExpenseFeed({
  eventId,
  userId,
  currency = 'EUR',
  userMap,
  pageSize = 20,
  onExpenseClick,
  emptyState,
  className,
}: ExpenseFeedProps) {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
  } = useInfiniteExpenses({ eventId, userId, pageSize });

  const expenses = data?.pages.flatMap((p) => p.data) ?? [];

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

  const getUser = useCallback(
    (id: string) => userMap[id],
    [userMap]
  );

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
            onClick={() => onExpenseClick?.(expense.id)}
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
    </Box>
  );
}
