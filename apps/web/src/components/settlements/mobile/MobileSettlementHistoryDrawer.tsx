import { useState, useMemo } from 'react';
import { Box, Typography, alpha } from '@mui/material';
import { useInfiniteQuery } from '@tanstack/react-query';
import { settlementsApi, type SettlementListItem } from '../../../api/settlements.api';
import { useUsers, useUserCache } from '../../../hooks/useUserCache';
import { MobileDrawer } from '../../shared/MobileDrawer';
import { MobileFeedList, type FeedDisplayItem } from '../../feed/mobile/MobileFeedList';
import { MobileFeedCard } from '../../feed/mobile/MobileFeedCard';
import { SettlementReviewPanel } from '../SettlementReviewPanel';

function formatAmount(cents: number, currency = 'EUR') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

interface MobileSettlementHistoryDrawerProps {
  open: boolean;
  onClose: () => void;
  eventId: string;
  userId: string;
  currency: string;
}

export function MobileSettlementHistoryDrawer({
  open,
  onClose,
  eventId,
  userId,
  currency,
}: MobileSettlementHistoryDrawerProps) {
  const [reviewSettlement, setReviewSettlement] = useState<SettlementListItem | null>(null);
  const [reviewPanelOpen, setReviewPanelOpen] = useState(false);
  const { getUser } = useUserCache();

  const {
    data: requestsPages,
    fetchNextPage: fetchNextRequests,
    hasNextPage: hasNextRequests,
    isFetchingNextPage: isFetchingNextRequests,
  } = useInfiniteQuery({
    queryKey: ['settlements-requests-drawer', eventId],
    queryFn: ({ pageParam }) => settlementsApi.listSettlementRequests(eventId!, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: !!eventId && open,
  });

  const requestsItems: SettlementListItem[] = requestsPages?.pages.flatMap((p) => p.data) ?? [];
  const pendingRequests = requestsItems.filter((s) => s.status === 'pending');

  const requestUserIds = useMemo(() => {
    const ids = new Set<string>();
    for (const req of pendingRequests) {
      const other = req.to_user === userId ? req.from_user : req.to_user;
      ids.add(other);
    }
    return Array.from(ids);
  }, [pendingRequests, userId]);

  useUsers(requestUserIds);

  const handleOpenReviewPanel = (settlement: SettlementListItem) => {
    setReviewSettlement(settlement);
    setReviewPanelOpen(true);
  };

  const handleReviewSuccess = () => {
    setReviewPanelOpen(false);
    setReviewSettlement(null);
  };

  const emptyState = (message: string) => (
    <Box sx={{ textAlign: 'center', py: 6 }}>
      <Typography variant="body1" color="text.secondary">
        {message}
      </Typography>
    </Box>
  );

  return (
    <>
      <MobileDrawer open={open} onClose={onClose} title="Settlement Requests" fullScreen>
        <Box sx={{ flex: 1, overflow: 'auto', px: 0.5 }}>
          <MobileFeedList
            items={pendingRequests.map((req) => ({
              kind: 'custom' as const,
              id: req.id,
              node: (() => {
                const isConfirming = req.to_user === userId;
                const otherUserId = isConfirming ? req.from_user : req.to_user;
                const otherUser = getUser(otherUserId);
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
        </Box>
      </MobileDrawer>

      {reviewSettlement && (
        <SettlementReviewPanel
          open={reviewPanelOpen}
          onClose={() => setReviewPanelOpen(false)}
          onSuccess={handleReviewSuccess}
          settlement={reviewSettlement}
          fromUserInfo={undefined}
          toUserInfo={undefined}
          currency={currency}
          eventId={eventId}
          currentUserId={userId}
        />
      )}
    </>
  );
}
