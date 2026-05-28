import React, { useState, useMemo } from 'react';
import { useParams } from 'react-router';
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { Box, Typography, CircularProgress, alpha } from '@mui/material';
import { Scale as ScalesIcon, CheckCircle as SettledIcon } from '@mui/icons-material';
import { useAuthStore } from '@moshsplit/auth-react';

import { groupsApi } from '../../api/groups.api';
import { balancesApi } from '../../api/balances.api';
import { settlementsApi, type IncomingBalanceItem, type OutgoingBalanceItem, type SettlementListItem } from '../../api/settlements.api';
import { useUsers, useUserCache } from '../../hooks/useUserCache';
import { MobilePageHeader } from '../../components/shared/MobilePageHeader';
import { MobileTabBar } from '../../components/shared/MobileTabBar';
import { MobileFeedList, type FeedDisplayItem } from '../../components/feed/mobile/MobileFeedList';
import { MobileFeedCard } from '../../components/feed/mobile/MobileFeedCard';
import { MobileBalanceCard } from '../../components/feed/mobile/cards/MobileBalanceCard';
import { MobileTransactionCard } from '../../components/feed/mobile/cards/MobileTransactionCard';
import { RestoreHonorModal } from '../../components/settlements/RestoreHonorModal';
import { MobileIncomingBalanceDrawer } from '../../components/settlements/mobile/MobileIncomingBalanceDrawer';
import { MobileOutgoingBalanceDrawer } from '../../components/settlements/mobile/MobileOutgoingBalanceDrawer';
import { SettlementReviewPanel } from '../../components/settlements/SettlementReviewPanel';

function formatAmount(cents: number, currency = 'EUR') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

type TabFilter = 'incoming' | 'outgoing' | 'requests' | 'history';

export default function MobileSettlePage() {
  const [activeTabFilter, setActiveTabFilter] = useState<TabFilter>('incoming');

  const { eventId: routeEventId } = useParams<{ eventId: string }>();

  const userId = useAuthStore((state) => state.userId);
  const eventId = routeEventId;

  const { data: event, isLoading: eventLoading } = useQuery({
    queryKey: ['event', eventId],
    queryFn: () => groupsApi.get(eventId!),
    enabled: !!eventId,
  });

  const { data: members = [] } = useQuery({
    queryKey: ['event-members', eventId],
    queryFn: () => groupsApi.listMembers(eventId!),
    enabled: !!eventId,
  });

  const memberUserIds = useMemo(() => members.map((m) => m.user_id), [members]);
  useUsers(memberUserIds);

  const { data: incomingData } = useQuery({
    queryKey: ['settlements-incoming', eventId],
    queryFn: () => settlementsApi.getIncomingBalances(eventId!),
    enabled: !!eventId,
  });

  const { data: outgoingData } = useQuery({
    queryKey: ['settlements-outgoing', eventId],
    queryFn: () => settlementsApi.getOutgoingBalances(eventId!),
    enabled: !!eventId,
  });

  const { data: userBalance } = useQuery({
    queryKey: ['user-balance', eventId, userId],
    queryFn: () => balancesApi.getUserBalance(eventId!, userId!),
    enabled: !!eventId && !!userId,
  });

  const {
    data: requestsPages,
    fetchNextPage: fetchNextRequests,
    hasNextPage: hasNextRequests,
    isFetchingNextPage: isFetchingNextRequests,
  } = useInfiniteQuery({
    queryKey: ['settlements-requests', eventId],
    queryFn: ({ pageParam }) => settlementsApi.listSettlementRequests(eventId!, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: !!eventId,
  });

  const {
    data: historyPages,
    fetchNextPage: fetchNextHistory,
    hasNextPage: hasNextHistory,
    isFetchingNextPage: isFetchingNextHistory,
  } = useInfiniteQuery({
    queryKey: ['settlements-history', eventId],
    queryFn: ({ pageParam }) => settlementsApi.getSettlementsHistory(eventId!, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: !!eventId,
  });

  const incomingItems: IncomingBalanceItem[] = incomingData?.items ?? [];
  const outgoingItems: OutgoingBalanceItem[] = outgoingData?.items ?? [];
  const requestsItems: SettlementListItem[] = requestsPages?.pages.flatMap((p) => p.data) ?? [];
  const historyItems = historyPages?.pages.flatMap((p) => p.data) ?? [];

  const requestCounterpartyIds = useMemo(() => {
    const ids = new Set<string>();
    for (const req of requestsItems) {
      const other = req.to_user === userId ? req.from_user : req.to_user;
      ids.add(other);
    }
    return Array.from(ids);
  }, [requestsItems, userId]);

  const historyCounterpartyIds = useMemo(() => {
    return Array.from(new Set(historyItems.map((h) => h.counterparty_id)));
  }, [historyItems]);

  const allCounterpartyIds = useMemo(() => {
    const ids = new Set<string>();
    for (const id of [...requestCounterpartyIds, ...historyCounterpartyIds]) {
      ids.add(id);
    }
    return Array.from(ids);
  }, [requestCounterpartyIds, historyCounterpartyIds]);

  useUsers(allCounterpartyIds);

  const pendingRequests = requestsItems.filter((s) => s.status === 'pending');

  const allSettled = incomingItems.length === 0 && outgoingItems.length === 0;

  const bannerUrl = event?.images?.banner?.url ?? event?.images?.gallery?.[0]?.url;
  const currency = event?.currency || 'EUR';

  const { getUser: getUserById } = useUserCache();
  const [restoreHonorOpen, setRestoreHonorOpen] = useState(false);
  const [restoreHonorTarget, setRestoreHonorTarget] = useState<{ userId: string; amountCents: number } | null>(null);
  const [reviewPanelOpen, setReviewPanelOpen] = useState(false);
  const [reviewSettlement, setReviewSettlement] = useState<SettlementListItem | null>(null);

  // Incoming balance drawer state
  const [incomingDrawerItem, setIncomingDrawerItem] = useState<IncomingBalanceItem | null>(null);
  const [incomingDrawerOpen, setIncomingDrawerOpen] = useState(false);

  // Outgoing balance drawer state
  const [outgoingDrawerItem, setOutgoingDrawerItem] = useState<OutgoingBalanceItem | null>(null);
  const [outgoingDrawerOpen, setOutgoingDrawerOpen] = useState(false);

  const handleOpenRestoreHonor = (userId: string, amountCents: number) => {
    setRestoreHonorTarget({ userId, amountCents });
    setRestoreHonorOpen(true);
  };

  const handleOpenIncomingDrawer = (item: IncomingBalanceItem) => {
    setIncomingDrawerItem(item);
    setIncomingDrawerOpen(true);
  };

  const handleOpenOutgoingDrawer = (item: OutgoingBalanceItem) => {
    setOutgoingDrawerItem(item);
    setOutgoingDrawerOpen(true);
  };

  const handleOpenReviewPanel = (settlement: SettlementListItem) => {
    setReviewSettlement(settlement);
    setReviewPanelOpen(true);
  };

  const handleRestoreHonorSuccess = () => {
    setRestoreHonorOpen(false);
    setRestoreHonorTarget(null);
  };

  const handleReviewSuccess = () => {
    setReviewPanelOpen(false);
    setReviewSettlement(null);
  };

  if (eventLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <CircularProgress sx={{ color: 'primary.main' }} />
      </Box>
    );
  }

  if (allSettled) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <MobilePageHeader
          icon={<SettledIcon sx={{ fontSize: 22, color: '#10b981' }} />}
          title="Honor Restored"
          subtitle={event?.name || ''}
        />
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', px: 2 }}>
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="body1" color="text.secondary">
              The pit is balanced once more.
            </Typography>
          </Box>
        </Box>
      </Box>
    );
  }

  const emptyState = (message: string) => (
    <Box sx={{ textAlign: 'center', py: 6 }}>
      <Typography variant="body1" color="text.secondary">
        {message}
      </Typography>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <MobilePageHeader
        icon={<ScalesIcon sx={{ fontSize: 22, color: 'primary.main' }} />}
        title="The Scales"
        subtitle={event?.name || ''}
        backgroundImage={bannerUrl}
      >
        <Box sx={{ px: 1, py: 1.5 }}>
          <Box
            sx={{
              p: 2,
              borderRadius: 2,
              bgcolor: alpha('#1E1E1E', 0.5),
              border: '1px solid',
              borderColor: alpha(
                !userBalance
                  ? '#6b7280'
                  : userBalance.balance_cents === 0
                    ? '#6b7280'
                    : userBalance.balance_cents > 0
                      ? '#10b981'
                      : '#ef4444',
                0.3
              ),
              backdropFilter: 'blur(8px)',
              textAlign: 'center',
            }}
          >
            <Typography
              sx={{
                fontSize: '0.65rem',
                fontWeight: 700,
                color: alpha('#fff', 0.5),
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                mb: 0.5,
              }}
            >
              Net Balance
            </Typography>

            {userBalance === undefined ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 1 }}>
                <CircularProgress size={24} sx={{ color: alpha('#fff', 0.4) }} />
              </Box>
            ) : userBalance.balance_cents === 0 ? (
              <Typography sx={{ fontSize: '1.25rem', fontWeight: 800, color: '#9ca3af' }}>
                All settled up
              </Typography>
            ) : userBalance.balance_cents > 0 ? (
              <>
                <Typography sx={{ fontSize: '1.75rem', fontWeight: 800, color: '#10b981', lineHeight: 1.1 }}>
                  {formatAmount(userBalance.balance_cents, currency)}
                </Typography>
                <Typography
                  sx={{
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    color: alpha('#10b981', 0.7),
                    mt: 0.25,
                  }}
                >
                  People owe you overall
                </Typography>
              </>
            ) : (
              <>
                <Typography sx={{ fontSize: '1.75rem', fontWeight: 800, color: '#ef4444', lineHeight: 1.1 }}>
                  {formatAmount(Math.abs(userBalance.balance_cents), currency)}
                </Typography>
                <Typography
                  sx={{
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    color: alpha('#ef4444', 0.7),
                    mt: 0.25,
                  }}
                >
                  You owe overall
                </Typography>
              </>
            )}
          </Box>
        </Box>

        <MobileTabBar
          tabs={[
            { value: 'incoming', label: 'Incoming', count: incomingItems.length },
            { value: 'outgoing', label: 'Outgoing', count: outgoingItems.length },
            { value: 'requests', label: 'Requests', count: pendingRequests.length },
            { value: 'history', label: 'History', count: historyItems.length },
          ]}
          activeTab={activeTabFilter}
          onChange={(val) => setActiveTabFilter(val as TabFilter)}
        />
      </MobilePageHeader>

      <Box sx={{ flexGrow: 1, overflow: 'auto', WebkitOverflowScrolling: 'touch', px: 2, pt: 2, pb: 4 }}>
        {activeTabFilter === 'incoming' && (
          <MobileFeedList
            items={incomingItems.map((item) => ({
              kind: 'custom' as const, id: `incoming-${item.user_id}`, node: (
                <MobileBalanceCard
                  balanceItem={item}
                  userId={item.user_id}
                  amountCents={item.amount_cents}
                  isIncoming={true}
                  currency={currency}
                  onClick={() => handleOpenIncomingDrawer(item)}
                />
              )
            })) as FeedDisplayItem[]}
            customDateKey={(item: any) => {
              const displayItem = item as FeedDisplayItem;
              const el = displayItem.kind === 'custom' ? displayItem.node as React.ReactElement<{ balanceItem?: { created_at?: string } }> : null;
              return el?.props?.balanceItem?.created_at ?? 'today';
            }}
            userMap={{}}
            emptyState={emptyState('No one owes you. The pit is quiet.')}
          />
        )}

        {activeTabFilter === 'outgoing' && (
          <MobileFeedList
            items={outgoingItems.map((item) => ({
              kind: 'custom' as const, id: `outgoing-${item.user_id}`, node: (
                <MobileBalanceCard
                  balanceItem={item}
                  userId={item.user_id}
                  amountCents={item.amount_cents}
                  isIncoming={false}
                  currency={currency}
                  onClick={() => handleOpenOutgoingDrawer(item)}
                />
              )
            })) as FeedDisplayItem[]}
            customDateKey={(item: any) => {
              const displayItem = item as FeedDisplayItem;
              const el = displayItem.kind === 'custom' ? displayItem.node as React.ReactElement<{ balanceItem?: { created_at?: string } }> : null;
              return el?.props?.balanceItem?.created_at ?? 'today';
            }}
            userMap={{}}
            emptyState={emptyState("You don't owe anyone. Your honor is intact.")}
          />
        )}

        {activeTabFilter === 'requests' && (
          <MobileFeedList
            items={pendingRequests.map((req) => ({
              kind: 'custom' as const,
              id: req.id,
              node: (() => {
                const isConfirming = req.to_user === userId;
                const otherUserId = isConfirming ? req.from_user : req.to_user;
                const otherUser = getUserById(otherUserId);
                const displayName = otherUser
                  ? `${otherUser.firstName} ${otherUser.lastName}`.trim() || otherUser.email
                  : otherUserId.slice(0, 8);

                const time = new Date(req.created_at).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                });

                const accentColor = isConfirming ? '#F59E0B' : '#8b5cf6';

                return (
                  <MobileFeedCard
                    key={req.id}
                    accentColor={accentColor}
                    icon={<Box sx={{ width: 18, height: 18 }} />}
                    onClick={isConfirming ? () => handleOpenReviewPanel(req) : undefined}
                    rightContent={
                      <Box>
                        <Typography sx={{ fontSize: '0.9rem', fontWeight: 700, color: accentColor, lineHeight: 1.2 }}>
                          {formatAmount(req.amount_cents, currency)}
                        </Typography>
                        <Typography sx={{ display: 'block', fontSize: '0.6rem', color: 'text.disabled' }}>
                          {time}
                        </Typography>
                      </Box>
                    }
                  >
                    <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, lineHeight: 1.3, mb: 0.5 }}>
                      <Box component="span" color={accentColor}>
                        {isConfirming ? 'Review settlement' : 'Awaiting verdict'}
                      </Box>
                      {' — '}
                      <Box component="span" color="text.primary">
                        {displayName.split('@')[0]}
                      </Box>
                    </Typography>
                    {isConfirming && (
                      <Box
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenReviewPanel(req);
                        }}
                        sx={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 0.5,
                          px: 1,
                          py: 0.5,
                          borderRadius: 1,
                          bgcolor: alpha(accentColor, 0.15),
                          border: '1px solid',
                          borderColor: alpha(accentColor, 0.3),
                          cursor: 'pointer',
                          mt: 0.25,
                        }}
                      >
                        <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: accentColor, textTransform: 'uppercase', letterSpacing: '0.03em', lineHeight: 1 }}>
                          Review
                        </Typography>
                      </Box>
                    )}
                  </MobileFeedCard>
                );
              })(),
            })) as FeedDisplayItem[]}
            userMap={{}}
            hasNextPage={hasNextRequests}
            isFetchingNextPage={isFetchingNextRequests}
            fetchNextPage={fetchNextRequests}
            emptyState={emptyState('No pending settlement requests.')}
          />
        )}

        {activeTabFilter === 'history' && (
          <MobileFeedList
            items={historyItems.map((item) => ({
              kind: 'custom' as const, id: item.id, node: (
                <MobileTransactionCard
                  item={item}
                  currency={currency}
                />
              )
            })) as FeedDisplayItem[]}
            customDateKey={(item) => {
              const displayItem = item as FeedDisplayItem;
              const el = displayItem.kind === 'custom' ? displayItem.node as React.ReactElement<{ item?: { created_at?: string } }> : null;
              return el?.props?.item?.created_at ?? new Date().toISOString();
            }}
            userMap={{}}
            hasNextPage={hasNextHistory}
            isFetchingNextPage={isFetchingNextHistory}
            fetchNextPage={fetchNextHistory}
            emptyState={emptyState('No transaction history yet.')}
          />
        )}
      </Box>

      {restoreHonorTarget && (
        <RestoreHonorModal
          open={restoreHonorOpen}
          onClose={() => setRestoreHonorOpen(false)}
          onSuccess={handleRestoreHonorSuccess}
          toUser={restoreHonorTarget.userId}
          toUserInfo={undefined}
          totalOwedCents={restoreHonorTarget.amountCents}
          currency={currency}
          eventId={eventId!}
          fromUserId={userId!}
        />
      )}

      <MobileIncomingBalanceDrawer
        open={incomingDrawerOpen}
        onClose={() => setIncomingDrawerOpen(false)}
        balanceItem={incomingDrawerItem}
        currency={currency}
        onSettle={handleOpenRestoreHonor}
      />

      <MobileOutgoingBalanceDrawer
        open={outgoingDrawerOpen}
        onClose={() => setOutgoingDrawerOpen(false)}
        balanceItem={outgoingDrawerItem}
        currency={currency}
        onSettle={handleOpenRestoreHonor}
      />

      {reviewSettlement && (
        <SettlementReviewPanel
          open={reviewPanelOpen}
          onClose={() => setReviewPanelOpen(false)}
          onSuccess={handleReviewSuccess}
          settlement={reviewSettlement}
          fromUserInfo={undefined}
          toUserInfo={undefined}
          currency={currency}
          eventId={eventId!}
          currentUserId={userId!}
        />
      )}
    </Box>
  );
}
