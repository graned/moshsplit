import { useState, useCallback } from 'react';
import { Typography } from '@mui/material';
import { useInfiniteExpenses } from '../../hooks/useInfiniteExpenses';
import { ExpenseFeedCard } from './ExpenseFeedCard';
import { IntelLog } from './IntelLog';
import { UserInfo } from '../../api/users.api';
import { ExpenseListItem } from '../../api/expenses.api';
import { GroupMember } from '../../api/groups.api';
import { MobileCardList } from '../mobile';

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
  scrollContainerRef?: React.RefObject<HTMLElement | null>;
  /** When true, filters to show only expenses where user is the payer or a participant */
  filterForCurrentUser?: boolean;
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
  scrollContainerRef,
  filterForCurrentUser = false,
}: ExpenseFeedProps) {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isError } = useInfiniteExpenses({
    eventId,
    userId,
    pageSize,
    expenseType,
  });

  const expenses = data?.pages.flatMap((p) => p.data) ?? [];

  const filteredExpenses = filterForCurrentUser
    ? expenses.filter((expense) => {
        const isPayer = expense.paid_by === userId;
        const isParticipant = expense.participant_ids?.includes(userId);
        return isPayer || isParticipant;
      })
    : expenses;

  const [selectedExpense, setSelectedExpense] = useState<ExpenseListItem | null>(null);

  const getUser = useCallback((id: string) => userMap[id], [userMap]);

  const handleExpenseClick = (expense: ExpenseListItem) => {
    setSelectedExpense(expense);
  };

  const defaultEmptyState = (
    <Typography sx={{ p: 3, textAlign: 'center' }} color="text.secondary">
      {filterForCurrentUser ? 'No expenses involving you yet' : 'No expenses yet'}
    </Typography>
  );

  return (
    <>
      <MobileCardList
        items={filteredExpenses}
        renderItem={(expense) => {
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
        }}
        isLoading={isLoading}
        isError={isError}
        error="Failed to load expenses"
        emptyState={emptyState ?? defaultEmptyState}
        hasNextPage={hasNextPage}
        isFetchingNextPage={isFetchingNextPage}
        fetchNextPage={fetchNextPage}
        scrollContainerRef={scrollContainerRef}
        gap={1.5}
        className={className}
      />

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
    </>
  );
}
