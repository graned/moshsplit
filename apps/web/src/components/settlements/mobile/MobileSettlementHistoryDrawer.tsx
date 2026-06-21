import { useState, useMemo, useRef } from 'react';
import { Box, Typography, Chip, alpha } from '@mui/material';
import { useInfiniteQuery } from '@tanstack/react-query';
import { settlementsApi, type SettlementListItem } from '../../../api/settlements.api';
import { useUsers, useUserCache } from '../../../hooks/useUserCache';
import { MobileDrawer } from '../../shared/MobileDrawer';
import { MobileFeedList, type FeedDisplayItem } from '../../feed/mobile/MobileFeedList';
import { MobileFeedCard } from '../../feed/mobile/MobileFeedCard';
import { MobileSettlementReviewView } from './MobileSettlementReviewView';

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
  const [view, setView] = useState<'list' | 'review'>('list');
  const [reviewSettlement, setReviewSettlement] = useState<SettlementListItem | null>(null);
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
  const approvedRequests = requestsItems.filter((s) => s.status === 'approved');
  const rejectedRequests = requestsItems.filter((s) => s.status === 'rejected');

  const requestUserIds = useMemo(() => {
    const ids = new Set<string>();
    for (const req of [...pendingRequests, ...approvedRequests, ...rejectedRequests]) {
      const other = req.to_user === userId ? req.from_user : req.to_user;
      ids.add(other);
    }
    return Array.from(ids);
  }, [pendingRequests, approvedRequests, rejectedRequests, userId]);

  useUsers(requestUserIds);

  const handleOpenReview = (settlement: SettlementListItem) => {
    setReviewSettlement(settlement);
    setView('review');
  };

  const handleBackToList = () => {
    setView('list');
    setReviewSettlement(null);
  };

  const handleReviewSuccess = () => {
    handleBackToList();
  };

  const handleDrawerClose = () => {
    // Reset to list view when drawer closes
    handleBackToList();
    onClose();
  };

  const emptyState = (message: string) => (
    <Box sx={{ textAlign: 'center', py: 6 }}>
      <Typography variant="body1" color="text.secondary">
        {message}
      </Typography>
    </Box>
  );

  // Slide container ref for height syncing
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <MobileDrawer
      open={open}
      onClose={handleDrawerClose}
      onBack={view === 'review' ? handleBackToList : undefined}
      title={view === 'list' ? 'Settlement Requests' : 'Review Claim'}
      clearAction={view === 'review' && reviewSettlement ? (
        <Chip
          label="PENDING"
          size="small"
          sx={{
            bgcolor: alpha('#F59E0B', 0.15),
            color: 'primary.main',
            fontWeight: 700,
            fontSize: '0.65rem',
            letterSpacing: '0.05em',
            height: 22,
          }}
        />
      ) : undefined}
      fullScreen
    >
      <Box
        ref={containerRef}
        sx={{
          flex: 1,
          overflow: 'hidden',
          position: 'relative',
          mx: -2, // negate MobileDrawer padding
          px: 2,
        }}
      >
        {/* ========== List View ========== */}
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            px: 2,
            transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            transform: view === 'review' ? 'translateX(-100%)' : 'translateX(0)',
            overflow: 'auto',
          }}
        >
          <MobileFeedList
            items={[
              ...pendingRequests.map((req) => {
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

                return {
                  kind: 'custom' as const,
                  id: req.id,
                  node: (
                    <MobileFeedCard
                      key={req.id}
                      accentColor={accentColor}
                      icon={<Box sx={{ width: 18, height: 18 }} />}
                      onClick={isConfirming ? () => handleOpenReview(req) : undefined}
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
                            handleOpenReview(req);
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
                  ),
                } as FeedDisplayItem;
              }),

              ...(approvedRequests.length > 0
                ? [
                    {
                      kind: 'custom' as const,
                      id: '__approved-header',
                      node: (
                        <Box key="approved-header" sx={{ display: 'flex', alignItems: 'center', gap: 1, pt: 3, pb: 1 }}>
                          <Box sx={{ flex: 1, height: 1, bgcolor: alpha('#fff', 0.06) }} />
                          <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: alpha('#fff', 0.35), textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                            Approved
                          </Typography>
                          <Box sx={{ flex: 1, height: 1, bgcolor: alpha('#fff', 0.06) }} />
                        </Box>
                      ),
                    } as FeedDisplayItem,
                    ...approvedRequests.map((req) => {
                      const otherUserId = req.to_user === userId ? req.from_user : req.to_user;
                      const otherUser = getUser(otherUserId);
                      const displayName = otherUser
                        ? `${otherUser.firstName} ${otherUser.lastName}`.trim() || otherUser.email
                        : otherUserId.slice(0, 8);

                      const approvedTime = req.reviewed_at
                        ? new Date(req.reviewed_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          })
                        : null;

                      const accentColor = '#22c55e';

                      return {
                        kind: 'custom' as const,
                        id: req.id,
                        node: (
                          <MobileFeedCard
                            key={req.id}
                            accentColor={accentColor}
                            icon={<Box sx={{ width: 18, height: 18 }} />}
                            rightContent={
                              <Box>
                                <Typography sx={{ fontSize: '0.9rem', fontWeight: 700, color: accentColor, lineHeight: 1.2 }}>
                                  {formatAmount(req.amount_cents, currency)}
                                </Typography>
                                {approvedTime && (
                                  <Typography sx={{ display: 'block', fontSize: '0.6rem', color: 'text.disabled' }}>
                                    {approvedTime}
                                  </Typography>
                                )}
                              </Box>
                            }
                          >
                            <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, lineHeight: 1.3, mb: 0.5 }}>
                              <Box component="span" color={accentColor}>
                                Honor Restored
                              </Box>
                              {' — '}
                              <Box component="span" color="text.primary">
                                {displayName.split('@')[0]}
                              </Box>
                            </Typography>
                          </MobileFeedCard>
                        ),
                      } as FeedDisplayItem;
                    }),
                  ]
                : []),

              ...(rejectedRequests.length > 0
                ? [
                    {
                      kind: 'custom' as const,
                      id: '__rejected-header',
                      node: (
                        <Box key="rejected-header" sx={{ display: 'flex', alignItems: 'center', gap: 1, pt: 3, pb: 1 }}>
                          <Box sx={{ flex: 1, height: 1, bgcolor: alpha('#fff', 0.06) }} />
                          <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: alpha('#fff', 0.35), textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                            Rejected
                          </Typography>
                          <Box sx={{ flex: 1, height: 1, bgcolor: alpha('#fff', 0.06) }} />
                        </Box>
                      ),
                    } as FeedDisplayItem,
                    ...rejectedRequests.map((req) => {
                      const otherUserId = req.to_user === userId ? req.from_user : req.to_user;
                      const otherUser = getUser(otherUserId);
                      const displayName = otherUser
                        ? `${otherUser.firstName} ${otherUser.lastName}`.trim() || otherUser.email
                        : otherUserId.slice(0, 8);

                      const rejectedTime = req.reviewed_at
                        ? new Date(req.reviewed_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          })
                        : null;

                      const accentColor = '#ef4444';

                      return {
                        kind: 'custom' as const,
                        id: req.id,
                        node: (
                          <MobileFeedCard
                            key={req.id}
                            accentColor={accentColor}
                            icon={<Box sx={{ width: 18, height: 18 }} />}
                            rightContent={
                              <Box>
                                <Typography sx={{ fontSize: '0.9rem', fontWeight: 700, color: accentColor, lineHeight: 1.2 }}>
                                  {formatAmount(req.amount_cents, currency)}
                                </Typography>
                                {rejectedTime && (
                                  <Typography sx={{ display: 'block', fontSize: '0.6rem', color: 'text.disabled' }}>
                                    {rejectedTime}
                                  </Typography>
                                )}
                              </Box>
                            }
                          >
                            <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, lineHeight: 1.3, mb: 0.5 }}>
                              <Box component="span" color={accentColor}>
                                Rejected
                              </Box>
                              {' — '}
                              <Box component="span" color="text.primary">
                                {displayName.split('@')[0]}
                              </Box>
                            </Typography>
                            {req.rejection_note && (
                              <Typography
                                sx={{
                                  fontSize: '0.7rem',
                                  color: alpha('#fff', 0.55),
                                  fontStyle: 'italic',
                                  lineHeight: 1.3,
                                }}
                              >
                                &ldquo;{req.rejection_note}&rdquo;
                              </Typography>
                            )}
                          </MobileFeedCard>
                        ),
                      } as FeedDisplayItem;
                    }),
                  ]
                : []),
            ]}
            userMap={{}}
            hasNextPage={hasNextRequests}
            isFetchingNextPage={isFetchingNextRequests}
            fetchNextPage={fetchNextRequests}
            emptyState={emptyState('No settlement requests.')}
          />
        </Box>

        {/* ========== Review View ========== */}
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            px: 2,
            transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            transform: view === 'review' ? 'translateX(0)' : 'translateX(100%)',
            overflow: 'hidden',
          }}
        >
          {reviewSettlement && (
              <MobileSettlementReviewView
                settlement={reviewSettlement}
                fromUserInfo={getUser(reviewSettlement.from_user) ?? undefined}
                toUserInfo={getUser(reviewSettlement.to_user) ?? undefined}
                currency={currency}
                eventId={eventId}
                currentUserId={userId}
                onSuccess={handleReviewSuccess}
              />
          )}
        </Box>
      </Box>
    </MobileDrawer>
  );
}
