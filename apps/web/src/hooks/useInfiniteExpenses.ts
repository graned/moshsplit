import { useInfiniteQuery } from '@tanstack/react-query';
import { expensesApi } from '../api/expenses.api';

interface UseInfiniteExpensesParams {
  eventId: string;
  userId: string;
  enabled?: boolean;
  pageSize?: number;
  includeDeleted?: boolean;
  expenseType?: string;
}

export function useInfiniteExpenses({
  eventId,
  userId,
  enabled = true,
  pageSize = 20,
  includeDeleted = false,
  expenseType,
}: UseInfiniteExpensesParams) {
  return useInfiniteQuery({
    queryKey: ['expenses-infinite', eventId, userId, includeDeleted, expenseType],
    queryFn: ({ pageParam }) => expensesApi.list(eventId, userId, pageParam, pageSize, includeDeleted, expenseType),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.nextCursor : undefined),
    enabled: enabled && !!eventId && !!userId,
    staleTime: 1000 * 60,
  });
}
