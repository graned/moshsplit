import { useInfiniteQuery } from '@tanstack/react-query';
import { activityApi } from '../api/activity.api';

interface UseActivityFeedParams {
  eventId: string;
  userId: string;
  enabled?: boolean;
  pageSize?: number;
}

/**
 * Infinite-scrolling activity feed hook.
 * Returns paginated mixed activity (expenses, settlements, milestones).
 */
export function useActivityFeed({ eventId, userId, enabled = true, pageSize = 20 }: UseActivityFeedParams) {
  return useInfiniteQuery({
    queryKey: ['activity-feed', eventId, userId],
    queryFn: ({ pageParam }) => activityApi.list(eventId, userId, pageParam, pageSize),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.nextCursor : undefined),
    enabled: enabled && !!eventId && !!userId,
    staleTime: 1000 * 60,
  });
}
