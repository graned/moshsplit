import { useEffect, useRef, useCallback } from 'react';
import { Box, CircularProgress, Typography, Card, CardContent } from '@mui/material';
import {
  SearchOff as SearchOffIcon,
} from '@mui/icons-material';
import { useActivityFeed } from '../../hooks/useActivityFeed';
import {
  ActivityItem,
  isExpenseActivity,
  isSettlementActivity,
  isMilestoneActivity,
} from '../../api/activity.api';
import { UserInfo } from '../../api/users.api';
import { ExpenseFeedCard } from './ExpenseFeedCard';
import { SettlementFeedCard } from './SettlementFeedCard';
import { MilestoneCard } from './MilestoneCard';

interface FeedListProps {
  eventId: string;
  userId: string;
  userMap: Record<string, UserInfo>;
  currency?: string;
  pageSize?: number;
  onExpenseClick?: (expenseId: string) => void;
  onSettlementClick?: (settlementId: string) => void;
  className?: string;
}

/**
 * FeedList: Renders a mixed-activity feed with infinite scroll.
 * Handles loading, error, empty, and loading-more states.
 */
export function FeedList({
  eventId,
  userId,
  userMap,
  currency = 'EUR',
  pageSize = 20,
  onExpenseClick,
  onSettlementClick,
  className,
}: FeedListProps) {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
  } = useActivityFeed({ eventId, userId, pageSize });

  const items = data?.pages.flatMap((p) => p.data) ?? [];

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

  const renderActivityItem = useCallback(
    (item: ActivityItem) => {
      if (isExpenseActivity(item)) {
        const paidBy = getUser(item.paid_by);
        const participantUsers = (item.participant_ids ?? [])
          .map(getUser)
          .filter((u): u is UserInfo => u !== undefined);

        return (
          <ExpenseFeedCard
            key={item.id}
            activity={item}
            paidBy={paidBy}
            participants={participantUsers}
            currentUserId={userId}
            currency={currency}
            onClick={() => onExpenseClick?.(item.expense_id)}
          />
        );
      }

      if (isSettlementActivity(item)) {
        const fromUser = getUser(item.from_user);
        const toUser = getUser(item.to_user);

        return (
          <SettlementFeedCard
            key={item.id}
            activity={item}
            fromUser={fromUser}
            toUser={toUser}
            currentUserId={userId}
            currency={currency}
            onClick={() => onSettlementClick?.(item.settlement_id)}
          />
        );
      }

      if (isMilestoneActivity(item)) {
        const targetUser = item.target_user_id ? getUser(item.target_user_id) : undefined;

        return (
          <MilestoneCard
            key={item.id}
            activity={item}
            targetUser={targetUser}
            currentUserId={userId}
          />
        );
      }

      // Fallback for unknown activity types
      return (
        <Box key={(item as ActivityItem).id} sx={{ p: 2, color: 'text.secondary' }}>
          <Typography variant="body2">Unknown activity type: {(item as ActivityItem).type}</Typography>
        </Box>
      );
    },
    [getUser, userId, currency, onExpenseClick, onSettlementClick]
  );

  // Loading state
  if (isLoading) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  // Error state
  if (isError) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography color="error">Failed to load activity feed</Typography>
      </Box>
    );
  }

  // Empty state
  if (items.length === 0) {
    return (
      <Card sx={{ backgroundColor: '#1E1E1E', borderColor: 'divider' }}>
        <CardContent sx={{ py: 8, textAlign: 'center' }}>
          <Box
            sx={{
              width: 80,
              height: 80,
              borderRadius: '50%',
              backgroundColor: 'rgba(245, 158, 11, 0.08)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              mb: 3,
            }}
          >
            <SearchOffIcon sx={{ fontSize: 40, color: 'primary.main', opacity: 0.5 }} />
          </Box>
          <Typography variant="h6" fontWeight={600} gutterBottom>
            No survivors found in this realm
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 320, mx: 'auto' }}>
            The mosh pit is empty. Start adding expenses and the battle log will come alive.
          </Typography>
        </CardContent>
      </Card>
    );
  }

  // Feed content
  return (
    <Box className={className} sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {items.map(renderActivityItem)}

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
