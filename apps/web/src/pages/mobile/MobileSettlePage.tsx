import React, { useState, useMemo } from 'react';
import { useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Box, Typography, CircularProgress, Button, Badge, alpha } from '@mui/material';
import { Scale as ScalesIcon, CheckCircle as SettledIcon, Handshake as HandshakeIcon } from '@mui/icons-material';
import { useAuthStore } from '@moshsplit/auth-react';

import { groupsApi } from '../../api/groups.api';
import { balancesApi } from '../../api/balances.api';
import { settlementsApi, type IncomingBalanceItem, type OutgoingBalanceItem, type SettlementListItem } from '../../api/settlements.api';
import { useUsers, useUserCache } from '../../hooks/useUserCache';
import { MobilePageHeader } from '../../components/shared/MobilePageHeader';
import { MobileFeedList, type FeedDisplayItem } from '../../components/feed/mobile/MobileFeedList';
import { MobileBalanceCard } from '../../components/feed/mobile/cards/MobileBalanceCard';
import { RestoreHonorModal } from '../../components/settlements/RestoreHonorModal';
import { MobileBalanceDrawer } from '../../components/settlements/mobile/MobileBalanceDrawer';
import { SettlementReviewPanel } from '../../components/settlements/SettlementReviewPanel';
import { MobileSettlementHistoryDrawer } from '../../components/settlements/mobile/MobileSettlementHistoryDrawer';
import { MobileStatsBreakdownDrawer, type BreakdownItem } from '../../components/settlements/mobile/MobileStatsBreakdownDrawer';

function formatAmount(cents: number, currency = 'EUR') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

type FeedFilter = 'all' | 'incoming' | 'outgoing';

export default function MobileSettlePage() {
  const [feedFilter, setFeedFilter] = useState<FeedFilter>('all');
  const [historyDrawerOpen, setHistoryDrawerOpen] = useState(false);

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
  useUserCache();

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

  const { data: stats } = useQuery({
    queryKey: ['event-stats', eventId, userId],
    queryFn: () => balancesApi.getStats(eventId!, userId!),
    enabled: !!eventId && !!userId,
  });

  const { data: explainBalance } = useQuery({
    queryKey: ['explain-balance', eventId, userId],
    queryFn: () => balancesApi.explainUserBalance(eventId!, userId!),
    enabled: !!eventId && !!userId,
  });

  const { data: requestsPage } = useQuery({
    queryKey: ['settlements-requests-count', eventId],
    queryFn: () => settlementsApi.listSettlementRequests(eventId!, undefined),
    enabled: !!eventId,
  });

  const pendingRequestCount = useMemo(
    () => requestsPage?.data.filter((s) => s.status === 'pending').length ?? 0,
    [requestsPage],
  );

  const oweToYouItems: BreakdownItem[] = useMemo(() => {
    if (!explainBalance) return [];
    const items: BreakdownItem[] = [];
    for (const expense of explainBalance.expenses) {
      if (expense.paid_by === userId && (expense.participants?.length ?? 0) > 1) {
        const amount = expense.amount_cents - expense.share_cents;
        if (amount > 0) {
          items.push({ label: expense.title, amount, type: 'expense', created_at: expense.created_at });
        }
      }
    }
    for (const settlement of explainBalance.settlements) {
      if (settlement.to_user === userId && settlement.status === 'confirmed') {
        items.push({ label: '', amount: -settlement.amount_cents, type: 'settlement', counterparty: settlement.from_user, direction: 'incoming', created_at: settlement.created_at });
      }
    }
    return items;
  }, [explainBalance, userId]);

  const youOweItems: BreakdownItem[] = useMemo(() => {
    if (!explainBalance) return [];
    const items: BreakdownItem[] = [];
    for (const expense of explainBalance.expenses) {
      if (expense.paid_by !== userId && expense.share_cents > 0) {
        items.push({ label: expense.title, amount: expense.share_cents, type: 'expense', created_at: expense.created_at });
      }
    }
    for (const settlement of explainBalance.settlements) {
      if (settlement.from_user === userId && settlement.status === 'confirmed') {
        items.push({ label: '', amount: -settlement.amount_cents, type: 'settlement', counterparty: settlement.to_user, direction: 'outgoing', created_at: settlement.created_at });
      }
    }
    return items;
  }, [explainBalance, userId]);

  const settledItems: BreakdownItem[] = useMemo(() => {
    if (!explainBalance) return [];
    const items: BreakdownItem[] = [];
    for (const settlement of explainBalance.settlements) {
      if (settlement.status !== 'confirmed') continue;
      if (settlement.to_user === userId) {
        items.push({ label: '', amount: settlement.amount_cents, type: 'settlement', counterparty: settlement.from_user, direction: 'incoming', created_at: settlement.created_at });
      } else if (settlement.from_user === userId) {
        items.push({ label: '', amount: settlement.amount_cents, type: 'settlement', counterparty: settlement.to_user, direction: 'outgoing', created_at: settlement.created_at });
      }
    }
    return items;
  }, [explainBalance, userId]);

  const [incomingDrawerItem, setIncomingDrawerItem] = useState<IncomingBalanceItem | null>(null);
  const [incomingDrawerOpen, setIncomingDrawerOpen] = useState(false);

  const [outgoingDrawerItem, setOutgoingDrawerItem] = useState<OutgoingBalanceItem | null>(null);
  const [outgoingDrawerOpen, setOutgoingDrawerOpen] = useState(false);

  const [breakdownCard, setBreakdownCard] = useState<'owe-to-you' | 'you-owe' | 'settled' | null>(null);

  const incomingBreakdownItems: BreakdownItem[] = useMemo(() => {
    if (!explainBalance || !incomingDrawerItem) return [];
    const cpId = incomingDrawerItem.user_id;
    const items: BreakdownItem[] = [];
    for (const expense of explainBalance.expenses) {
      if (expense.paid_by === userId && (expense.participants ?? []).includes(cpId)) {
        items.push({ label: expense.title, amount: expense.share_cents, type: 'expense', created_at: expense.created_at });
      }
    }
    for (const settlement of explainBalance.settlements) {
      if (settlement.from_user === cpId && settlement.to_user === userId && settlement.status === 'confirmed') {
        items.push({ label: '', amount: -settlement.amount_cents, type: 'settlement', counterparty: cpId, direction: 'incoming', created_at: settlement.created_at });
      }
    }
    return items;
  }, [explainBalance, incomingDrawerItem, userId]);

  const outgoingBreakdownItems: BreakdownItem[] = useMemo(() => {
    if (!explainBalance || !outgoingDrawerItem) return [];
    const cpId = outgoingDrawerItem.user_id;
    const items: BreakdownItem[] = [];
    for (const expense of explainBalance.expenses) {
      if (expense.paid_by === cpId && expense.share_cents > 0) {
        items.push({ label: expense.title, amount: expense.share_cents, type: 'expense', created_at: expense.created_at });
      }
    }
    for (const settlement of explainBalance.settlements) {
      if (settlement.from_user === userId && settlement.to_user === cpId && settlement.status === 'confirmed') {
        items.push({ label: '', amount: -settlement.amount_cents, type: 'settlement', counterparty: cpId, direction: 'outgoing', created_at: settlement.created_at });
      }
    }
    return items;
  }, [explainBalance, outgoingDrawerItem, userId]);

  const incomingItems: IncomingBalanceItem[] = incomingData?.items ?? [];
  const outgoingItems: OutgoingBalanceItem[] = outgoingData?.items ?? [];

  const allSettled = incomingItems.length === 0 && outgoingItems.length === 0;

  const bannerUrl = event?.images?.banner?.url ?? event?.images?.gallery?.[0]?.url;
  const currency = event?.currency || 'EUR';

  const [restoreHonorOpen, setRestoreHonorOpen] = useState(false);
  const [restoreHonorTarget, setRestoreHonorTarget] = useState<{ userId: string; amountCents: number } | null>(null);
  const [reviewPanelOpen, setReviewPanelOpen] = useState(false);
  const [reviewSettlement, setReviewSettlement] = useState<SettlementListItem | null>(null);

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
        rightAction={
          <Badge
            badgeContent={pendingRequestCount}
            color="error"
            slotProps={{ badge: { sx: { fontSize: '0.6rem', minWidth: 16, height: 16, fontWeight: 700 } } }}
          >
            <Button
              size="small"
              variant="contained"
              onClick={() => setHistoryDrawerOpen(true)}
              sx={{
                minWidth: 36,
                width: 36,
                height: 36,
                borderRadius: 2,
                bgcolor: '#F59E0B',
                color: '#1A1A1A',
                '&:hover': {
                  bgcolor: '#D97706',
                },
              }}
            >
              <HandshakeIcon sx={{ fontSize: 18 }} />
            </Button>
          </Badge>
        }
      >
        <Box sx={{ px: 1, py: 1.5 }}>
          {(() => {
            const balanceColor = !userBalance
              ? '#6b7280'
              : userBalance.balance_cents === 0
                ? '#6b7280'
                : userBalance.balance_cents > 0
                  ? '#22c55e'
                  : '#ef4444';

            const isSettled = userBalance && userBalance.balance_cents === 0;
            const glow = isSettled ? 'none' : `0 0 16px ${alpha(balanceColor, 0.25)}, 0 0 4px ${alpha(balanceColor, 0.4)}`;

            return (
              <Box
                sx={{
                  p: 2,
                  borderRadius: 2,
                  bgcolor: alpha('#1A1A1A', 0.7),
                  border: '1px solid',
                  borderColor: alpha(balanceColor, 0.35),
                  boxShadow: glow,
                  backdropFilter: 'blur(8px)',
                  transition: 'box-shadow 0.3s',
                }}
              >
                <Box sx={{ textAlign: 'center', mb: 2 }}>
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
                  ) : (
                    <>
                      <Typography sx={{ fontSize: '1.75rem', fontWeight: 800, color: balanceColor, lineHeight: 1.1 }}>
                        {formatAmount(Math.abs(userBalance.balance_cents), currency)}
                      </Typography>
                      <Typography
                        sx={{
                          fontSize: '0.7rem',
                          fontWeight: 600,
                          color: alpha(balanceColor, 0.8),
                          mt: 0.25,
                        }}
                      >
                        {userBalance.balance_cents > 0 ? 'People owe you overall' : 'You owe overall'}
                      </Typography>
                    </>
                  )}
                </Box>

                <Box sx={{ height: 1, bgcolor: alpha('#fff', 0.1), mb: 1.5 }} />

                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr 1fr',
                    gap: 1.5,
                    '@keyframes fadeSlideUp': {
                      from: { opacity: 0, transform: 'translateY(8px)' },
                      to: { opacity: 1, transform: 'translateY(0)' },
                    },
                  }}
                >
                  {(() => {
                    const oweToYou = (stats?.your_incoming_cents ?? 0) - (stats?.your_incoming_settled_cents ?? 0);
                    const youOwe = stats?.your_outstanding_cents ?? 0;
                    const settled = (stats?.your_incoming_settled_cents ?? 0) + (stats?.your_outgoing_settled_cents ?? 0);
                    return [
                      {
                        key: 'owe-to-you' as const,
                        label: 'Owe to You',
                        value: oweToYou,
                        valueColor: oweToYou > 0 ? '#22c55e' : '#9ca3af',
                      },
                      {
                        key: 'you-owe' as const,
                        label: 'You Owe',
                        value: youOwe,
                        valueColor: youOwe > 0 ? '#ef4444' : '#9ca3af',
                      },
                      {
                        key: 'settled' as const,
                        label: 'Settled',
                        value: settled,
                        valueColor: '#22c55e',
                      },
                    ].map((stat, idx) => (
                      <Box
                        key={stat.label}
                        onClick={() => setBreakdownCard(stat.key)}
                        sx={{
                          textAlign: 'center',
                          cursor: 'pointer',
                          borderRadius: 1.5,
                          p: 0.75,
                          mx: -0.75,
                          transition: 'background 0.15s',
                          '&:hover': { bgcolor: alpha('#fff', 0.04) },
                          animation: 'fadeSlideUp 0.35s ease-out both',
                          animationDelay: `${idx * 0.08}s`,
                        }}
                      >
                        <Typography
                          sx={{
                            fontSize: '0.6rem',
                            fontWeight: 700,
                            color: alpha('#fff', 0.5),
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                            mb: 0.25,
                          }}
                        >
                          {stat.label}
                        </Typography>
                        <Typography
                          sx={{
                            fontSize: '1rem',
                            fontWeight: 700,
                            color: stat.valueColor,
                            lineHeight: 1.2,
                          }}
                        >
                          {formatAmount(stat.value, currency)}
                        </Typography>
                      </Box>
                    ));
                  })()}
                </Box>
              </Box>
            );
          })()}
        </Box>

      </MobilePageHeader>

      <Box sx={{ flexGrow: 1, overflow: 'auto', WebkitOverflowScrolling: 'touch', px: 2, pt: 2, pb: 4 }}>
        {(feedFilter === 'all' || feedFilter === 'incoming') && incomingItems.length > 0 && (
          <>
            <Typography
              onClick={() => setFeedFilter((prev) => prev === 'incoming' ? 'all' : 'incoming')}
              sx={{
                fontSize: '0.75rem',
                fontWeight: 700,
                color: 'text.secondary',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                mb: 1,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.5,
                borderRadius: 1,
                px: 0.75,
                py: 0.25,
                transition: 'all 0.2s',
                ...(feedFilter === 'incoming'
                  ? { bgcolor: alpha('#10b981', 0.12), color: '#10b981' }
                  : {}),
                '&:hover': { bgcolor: alpha('#10b981', 0.08), color: '#10b981' },
              }}
            >
              Incoming · {incomingItems.length}
              {feedFilter === 'incoming' && (
                <Typography component="span" sx={{ fontSize: '0.55rem', fontWeight: 600, opacity: 0.7 }}>
                  tap to show all
                </Typography>
              )}
            </Typography>
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
          </>
        )}

        {(feedFilter === 'all' || feedFilter === 'outgoing') && outgoingItems.length > 0 && (
          <>
            <Typography
              onClick={() => setFeedFilter((prev) => prev === 'outgoing' ? 'all' : 'outgoing')}
              sx={{
                fontSize: '0.75rem',
                fontWeight: 700,
                color: 'text.secondary',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                mb: 1,
                mt: feedFilter === 'all' && incomingItems.length > 0 ? 3 : 0,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.5,
                borderRadius: 1,
                px: 0.75,
                py: 0.25,
                transition: 'all 0.2s',
                ...(feedFilter === 'outgoing'
                  ? { bgcolor: alpha('#ef4444', 0.12), color: '#ef4444' }
                  : {}),
                '&:hover': { bgcolor: alpha('#ef4444', 0.08), color: '#ef4444' },
              }}
            >
              Outgoing · {outgoingItems.length}
              {feedFilter === 'outgoing' && (
                <Typography component="span" sx={{ fontSize: '0.55rem', fontWeight: 600, opacity: 0.7 }}>
                  tap to show all
                </Typography>
              )}
            </Typography>
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
          </>
        )}

        {incomingItems.length === 0 && outgoingItems.length === 0 && (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <Typography variant="body1" color="text.secondary">
              No balances to settle yet.
            </Typography>
          </Box>
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

      <MobileBalanceDrawer
        open={incomingDrawerOpen}
        onClose={() => setIncomingDrawerOpen(false)}
        balanceItem={incomingDrawerItem}
        direction="incoming"
        currency={currency}
        onSettle={handleOpenRestoreHonor}
        breakdownItems={incomingBreakdownItems}
        breakdownTotal={incomingDrawerItem?.amount_cents ?? 0}
        fullScreen
        eventId={eventId!}
        currentUserId={userId!}
      />

      <MobileBalanceDrawer
        open={outgoingDrawerOpen}
        onClose={() => setOutgoingDrawerOpen(false)}
        balanceItem={outgoingDrawerItem}
        direction="outgoing"
        currency={currency}
        onSettle={handleOpenRestoreHonor}
        breakdownItems={outgoingBreakdownItems}
        breakdownTotal={outgoingDrawerItem?.amount_cents ?? 0}
        fullScreen
        eventId={eventId!}
        currentUserId={userId!}
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

      <MobileSettlementHistoryDrawer
        open={historyDrawerOpen}
        onClose={() => setHistoryDrawerOpen(false)}
        eventId={eventId!}
        userId={userId!}
        currency={currency}
      />

      {(() => {
        const breakdownItems = breakdownCard === 'owe-to-you' ? oweToYouItems : breakdownCard === 'you-owe' ? youOweItems : settledItems;
        const oweToYou = (stats?.your_incoming_cents ?? 0) - (stats?.your_incoming_settled_cents ?? 0);
        const youOwe = stats?.your_outstanding_cents ?? 0;
        const settled = (stats?.your_incoming_settled_cents ?? 0) + (stats?.your_outgoing_settled_cents ?? 0);
        const breakdownTotal = breakdownCard === 'owe-to-you' ? oweToYou : breakdownCard === 'you-owe' ? youOwe : settled;
        const breakdownTitle = breakdownCard === 'owe-to-you' ? 'Owe to You' : breakdownCard === 'you-owe' ? 'You Owe' : 'Settled';
        const breakdownColor = breakdownCard === 'owe-to-you' ? '#22c55e' : breakdownCard === 'you-owe' ? '#ef4444' : '#22c55e';

        return (
          <MobileStatsBreakdownDrawer
            open={breakdownCard !== null}
            onClose={() => setBreakdownCard(null)}
            title={breakdownTitle}
            items={breakdownItems}
            total={breakdownTotal}
            currency={currency}
            totalColor={breakdownColor}
          />
        );
      })()}


    </Box>
  );
}
