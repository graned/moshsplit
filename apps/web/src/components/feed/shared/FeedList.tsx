import { useCallback, useMemo } from 'react';
import { Box, Typography, alpha } from '@mui/material';
import { SearchOff as SearchOffIcon } from '@mui/icons-material';
import { useActivityFeed } from '../../../hooks/useActivityFeed';
import { ActivityItem, isExpenseActivity, isSettlementActivity, isHonorRestoredActivity, isMemberJoinActivity } from '../../../api/activity.api';
import { UserInfo } from '../../../api/users.api';
import { ExpenseFeedCard } from '../cards/ExpenseFeedCard';
import { SettlementFeedCard } from '../cards/SettlementFeedCard';
import { HonorRestoredFeedCard } from '../cards/HonorRestoredFeedCard';
import { MemberJoinCard } from '../cards/MemberJoinCard';
import { MobileCardList } from '../../shared/lists/MobileCardList';

function getDateLabel(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = today.getTime() - target.getTime();
  if (diff === 0) return 'Today';
  if (diff === 86400000) return 'Yesterday';
  return new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).format(d);
}

function DayHeader({ dateStr }: { dateStr: string }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.75 }}>
      <Box sx={{ flex: 1, height: 1, bgcolor: alpha('#fff', 0.06) }} />
      <Typography
        sx={{
          fontSize: '0.65rem',
          fontWeight: 700,
          color: alpha('#fff', 0.35),
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          whiteSpace: 'nowrap',
        }}
      >
        {getDateLabel(dateStr)}
      </Typography>
      <Box sx={{ flex: 1, height: 1, bgcolor: alpha('#fff', 0.06) }} />
    </Box>
  );
}

type FeedDisplayItem =
  | { kind: 'day-header'; date: string }
  | { kind: 'activity'; item: ActivityItem };

function groupByDay(items: ActivityItem[]): FeedDisplayItem[] {
  const result: FeedDisplayItem[] = [];
  let lastDate = '';
  for (const item of items) {
    const date = item.created_at.slice(0, 10);
    if (date !== lastDate) {
      lastDate = date;
      result.push({ kind: 'day-header', date });
    }
    result.push({ kind: 'activity', item });
  }
  return result;
}

interface FeedListProps {
  eventId: string;
  userId: string;
  userMap: Record<string, UserInfo>;
  currency?: string;
  pageSize?: number;
  onExpenseClick?: (expenseId: string) => void;
  onSettlementClick?: (settlementId: string) => void;
  className?: string;
  scrollContainerRef?: React.RefObject<HTMLElement | null>;
  activityType?: string;
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
  scrollContainerRef,
  activityType,
}: FeedListProps) {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isError } = useActivityFeed({
    eventId,
    userId,
    pageSize,
  });

  const items = data?.pages.flatMap((p) => p.data) ?? [];

  const filteredItems = useMemo(() => {
    if (!activityType) return items;
    return items.filter((item) => item.type === activityType);
  }, [items, activityType]);

  const displayItems = useMemo(() => groupByDay(filteredItems), [filteredItems]);

  const getUser = useCallback((id: string) => userMap[id], [userMap]);

  const renderDisplayItem = useCallback(
    (displayItem: FeedDisplayItem) => {
      if (displayItem.kind === 'day-header') {
        return <DayHeader key={displayItem.date} dateStr={displayItem.date} />;
      }

      const item = displayItem.item;

      if (isExpenseActivity(item)) {
        const paidBy = getUser(item.paid_by);

        return (
          <ExpenseFeedCard
            key={item.id}
            activity={item}
            paidBy={paidBy}
            participantCount={item.participant_count}
            currentUserId={userId}
            currency={currency}
            onClick={() => onExpenseClick?.(item.id)}
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
            onClick={() => onSettlementClick?.(item.id)}
          />
        );
      }

      if (isHonorRestoredActivity(item)) {
        const fromUser = getUser(item.from_user);
        const toUser = getUser(item.to_user);
        const approvedByUser = getUser(item.approved_by);

        return (
          <HonorRestoredFeedCard
            key={item.id}
            activity={item}
            fromUser={fromUser}
            toUser={toUser}
            approvedByUser={approvedByUser}
            currentUserId={userId}
            currency={currency}
          />
        );
      }

      if (isMemberJoinActivity(item)) {
        const joinedUser = getUser(item.user_id);

        return <MemberJoinCard key={item.id} activity={item} joinedUser={joinedUser} currentUserId={userId} />;
      }

      return (
        <Box key={(item as ActivityItem).id} sx={{ p: 2, color: 'text.secondary' }}>
          <Typography variant="body2">Unknown activity type: {(item as ActivityItem).type}</Typography>
        </Box>
      );
    },
    [getUser, userId, currency, onExpenseClick, onSettlementClick]
  );

  const emptyState = (
    <Box
      sx={{
        width: '100%',
        py: 8,
        textAlign: 'center',
        backgroundColor: 'background.paper',
        borderRadius: 2,
        border: 1,
        borderColor: 'divider',
      }}
    >
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
    </Box>
  );

  return (
    <MobileCardList
      items={displayItems}
      renderItem={renderDisplayItem}
      isLoading={isLoading}
      isError={isError}
      error="Failed to load activity feed"
      emptyState={emptyState}
      hasNextPage={hasNextPage}
      isFetchingNextPage={isFetchingNextPage}
      fetchNextPage={fetchNextPage}
      scrollContainerRef={scrollContainerRef}
      gap={3}
      className={className}
    />
  );
}
