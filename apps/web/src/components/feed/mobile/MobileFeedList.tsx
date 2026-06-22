import { useCallback, useMemo } from 'react';
import { Box, Typography, alpha } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { SearchOff as SearchOffIcon } from '@mui/icons-material';
import {
  ActivityItem,
  isExpenseActivity,
  isSettlementActivity,
  isHonorRestoredActivity,
  isMemberJoinActivity,
  isExpenseUpdatedActivity,
  isSettlementRejectedActivity,
} from '../../../api/activity.api';
import { UserInfo } from '../../../api/users.api';
import { MobileExpenseCard } from './cards/MobileExpenseCard';
import { MobileSettlementCard } from './cards/MobileSettlementCard';
import { MobileHonorCard } from './cards/MobileHonorCard';
import { MobileMemberJoinCard } from './cards/MobileMemberJoinCard';
import { MobileExpenseUpdatedCard } from './cards/MobileExpenseUpdatedCard';
import { MobileSettlementRejectedCard } from './cards/MobileSettlementRejectedCard';
import { MobileCardList } from '../../shared/lists/MobileCardList';

type FeedDisplayItem =
  | { kind: 'day-header'; date: string }
  | { kind: 'activity'; item: ActivityItem }
  | { kind: 'custom'; id: string; node: React.ReactNode };

type FeedListInput = ActivityItem[] | FeedDisplayItem[];

export type { FeedDisplayItem, FeedListInput };

 

interface MobileFeedListProps {
  items: FeedListInput;
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
  emptyState?: React.ReactNode;
  activityType?: string;
  customDateKey?: (item: unknown) => string;
  userId?: string;
}

function normalizeItems(items: FeedListInput, customDateKey?: (item: unknown) => string): FeedDisplayItem[] {
  if (!items || items.length === 0) return [];
  if (items.length > 0 && 'kind' in items[0]) {
    const displayItems = items as FeedDisplayItem[];
    if (!customDateKey) return displayItems;
    const result: FeedDisplayItem[] = [];
    let lastDate = '';
    for (const item of displayItems) {
      if (item.kind === 'custom') {
        const date = customDateKey(item) || '';
        const day = date.slice(0, 10) || date;
        if (day && day !== lastDate) {
          lastDate = day;
          result.push({ kind: 'day-header', date: day });
        }
        result.push(item);
      } else if (item.kind === 'day-header') {
        lastDate = item.date;
        result.push(item);
      } else if (item.kind === 'activity') {
        const day = item.item.created_at.slice(0, 10);
        if (day && day !== lastDate) {
          lastDate = day;
          result.push({ kind: 'day-header', date: day });
        }
        result.push(item);
      }
    }
    return result;
  }
  const activityItems = items as ActivityItem[];
  const result: FeedDisplayItem[] = [];
  let lastDate = '';
  for (const item of activityItems) {
    const date = item.created_at.slice(0, 10);
    if (date && date !== lastDate) {
      lastDate = date;
      result.push({ kind: 'day-header', date });
    }
    result.push({ kind: 'activity', item });
  }
  return result;
}

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
  emptyState,
  activityType,
  customDateKey,
  userId,
}: MobileFeedListProps) {
  const { t } = useTranslation();
  const getDateLabelLocalized = (dateStr: string): string => {
    if (dateStr === 'today') return t('components.feedList.today');
    if (dateStr === 'yesterday') return t('components.feedList.yesterday');
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const diff = today.getTime() - target.getTime();
    if (diff === 0) return t('components.feedList.today');
    if (diff === 86400000) return t('components.feedList.yesterday');
    return new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).format(d);
  };

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
          {getDateLabelLocalized(dateStr)}
        </Typography>
        <Box sx={{ flex: 1, height: 1, bgcolor: alpha('#fff', 0.06) }} />
      </Box>
    );
  }
  const normalizedItems = useMemo(() => {
    const displayItems = normalizeItems(items, customDateKey);
    if (!activityType) return displayItems;
    const result: FeedDisplayItem[] = [];
    let lastDate = '';
    for (const item of displayItems) {
      if (item.kind === 'day-header') {
        lastDate = item.date;
        result.push(item);
      } else if (item.kind !== 'custom' && item.item.type === activityType) {
        const day = item.item.created_at.slice(0, 10);
        if (day !== lastDate) {
          lastDate = day;
          result.push({ kind: 'day-header', date: day });
        }
        result.push(item);
      }
    }
    return result;
  }, [items, activityType, customDateKey]);
  const getUser = useCallback((id: string) => userMap[id], [userMap]);

  const renderDisplayItem = useCallback(
    (displayItem: FeedDisplayItem) => {
      if (displayItem.kind === 'day-header') {
        return <DayHeader key={displayItem.date} dateStr={displayItem.date} />;
      }

      if (displayItem.kind === 'custom') {
        return <Box key={displayItem.id}>{displayItem.node}</Box>;
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

      if (isExpenseUpdatedActivity(item)) {
        const paidBy = getUser(item.paid_by);

        return (
          <MobileExpenseUpdatedCard
            key={item.id}
            activity={item}
            paidBy={paidBy}
            currentUserId={userId}
            currency={currency}
          />
        );
      }

      if (isSettlementRejectedActivity(item)) {
        const fromUser = getUser(item.from_user);
        const toUser = getUser(item.to_user);

        return (
          <MobileSettlementRejectedCard
            key={item.id}
            activity={item}
            fromUser={fromUser}
            toUser={toUser}
            currentUserId={userId}
            currency={currency}
          />
        );
      }

      return (
        <Box key={(item as ActivityItem).id} sx={{ p: 2, color: 'text.secondary' }}>
          <Typography variant="body2">{t('components.feedList.unknownActivity', { type: (item as ActivityItem).type })}</Typography>
        </Box>
      );
    },
    [getUser, currency, onExpenseClick, onSettlementClick]
  );

  const defaultEmptyState = (
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
        {t('components.feedList.emptyTitle')}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 320, mx: 'auto' }}>
        {t('components.feedList.emptySubtitle')}
      </Typography>
    </Box>
  );

  return (
    <MobileCardList
      items={normalizedItems}
      renderItem={renderDisplayItem}
      isLoading={isLoading}
      isError={isError}
      error={error ?? t('components.feedList.loadError')}
      emptyState={emptyState ?? defaultEmptyState}
      hasNextPage={hasNextPage}
      isFetchingNextPage={isFetchingNextPage}
      fetchNextPage={fetchNextPage}
      scrollContainerRef={scrollContainerRef}
      gap={3}
      className={className}
    />
  );
}
