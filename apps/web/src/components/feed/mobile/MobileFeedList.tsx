import { useCallback, useMemo } from 'react';
import { Box, Typography, alpha } from '@mui/material';
import { SearchOff as SearchOffIcon } from '@mui/icons-material';
import {
  ActivityItem,
  isExpenseActivity,
  isSettlementActivity,
  isHonorRestoredActivity,
  isMemberJoinActivity,
} from '../../../api/activity.api';
import { UserInfo } from '../../../api/users.api';
import { MobileExpenseCard } from './cards/MobileExpenseCard';
import { MobileSettlementCard } from './cards/MobileSettlementCard';
import { MobileHonorCard } from './cards/MobileHonorCard';
import { MobileMemberJoinCard } from './cards/MobileMemberJoinCard';
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

interface MobileFeedListProps {
  items: ActivityItem[];
  userMap: Record<string, UserInfo>;
  currency?: string;
  isLoading?: boolean;
  isError?: boolean;
  error?: string | null;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  fetchNextPage?: () => void;
  onExpenseClick?: (expenseId: string) => void;
  onSettlementClick?: (settlementId: string) => void;
  className?: string;
  scrollContainerRef?: React.RefObject<HTMLElement | null>;
  activityType?: string;
}

/**
 * Mobile-only feed list with infinite scroll and day grouping.
 *
 * Mirrors the logic from the shared `FeedList` but renders mobile card
 * components instead of the shared/desktop ones. No `useMediaQuery`,
 * no responsive breakpoints — always uses mobile-sized layouts.
 */
export function MobileFeedList({
  items,
  userMap,
  currency = 'EUR',
  isLoading = false,
  isError = false,
  error,
  hasNextPage = false,
  isFetchingNextPage = false,
  fetchNextPage,
  onExpenseClick,
  onSettlementClick,
  className,
  scrollContainerRef,
  activityType,
}: MobileFeedListProps) {
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
          <MobileExpenseCard
            key={item.id}
            activity={item}
            paidBy={paidBy}
            currency={currency}
            onClick={() => onExpenseClick?.(item.id)}
          />
        );
      }

      if (isSettlementActivity(item)) {
        const fromUser = getUser(item.from_user);
        const toUser = getUser(item.to_user);

        return (
          <MobileSettlementCard
            key={item.id}
            activity={item}
            fromUser={fromUser}
            toUser={toUser}
            currency={currency}
            onClick={() => onSettlementClick?.(item.id)}
          />
        );
      }

      if (isHonorRestoredActivity(item)) {
        const fromUser = getUser(item.from_user);
        const toUser = getUser(item.to_user);

        return (
          <MobileHonorCard
            key={item.id}
            activity={item}
            fromUser={fromUser}
            toUser={toUser}
            currency={currency}
          />
        );
      }

      if (isMemberJoinActivity(item)) {
        const joinedUser = getUser(item.user_id);

        return (
          <MobileMemberJoinCard
            key={item.id}
            activity={item}
            joinedUser={joinedUser}
          />
        );
      }

      return (
        <Box key={(item as ActivityItem).id} sx={{ p: 2, color: 'text.secondary' }}>
          <Typography variant="body2">Unknown activity type: {(item as ActivityItem).type}</Typography>
        </Box>
      );
    },
    [getUser, currency, onExpenseClick, onSettlementClick]
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
      error={error ?? 'Failed to load activity feed'}
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
