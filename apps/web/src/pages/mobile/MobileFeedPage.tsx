import { useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Box, Typography, CircularProgress, alpha, IconButton, Badge, Drawer } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { RssFeed as BattleLogIcon, AttachMoney as SpentIcon, Close as CloseIcon, Leaderboard as LeaderboardIcon } from '@mui/icons-material';
import { useAuthStore } from '@moshsplit/auth-react';

import { groupsApi, GroupMember } from '../../api/groups.api';
import { balancesApi } from '../../api/balances.api';
import { useUsers } from '../../hooks/useUserCache';
import { useActivityFeed } from '../../hooks/useActivityFeed';
import { useUIStore } from '../../stores/uiStore';
import { MobileFeedList } from '../../components/feed';
import { getPainLevel } from '../../utils/damage';
import { MobilePageHeader, SpendingLadder } from '../../components/shared';
import { FilterDrawerLauncher, FilterDrawerContent } from '../../components/shared/filters';
import { isExpenseActivity } from '../../api/activity.api';

function formatAmount(cents: number, currency = 'EUR') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function getPainDisplay(label: string) {
  const styleMap: Record<string, { color: string; glow: string; fontWeight: number }> = {
    none: { color: alpha('#6B7280', 0.35), glow: 'none', fontWeight: 400 },
    nuisance: { color: alpha('#A3A3A3', 0.5), glow: 'none', fontWeight: 400 },
    moderate: { color: alpha('#FBBF24', 0.6), glow: '0 0 6px rgba(251,191,36,0.15)', fontWeight: 500 },
    severe: { color: alpha('#F97316', 0.7), glow: '0 0 8px rgba(249,115,22,0.25)', fontWeight: 600 },
    critical: { color: alpha('#EF4444', 0.8), glow: '0 0 10px rgba(239,68,68,0.3)', fontWeight: 700 },
    legendary: { color: '#F59E0B', glow: '0 0 16px rgba(245,158,11,0.55)', fontWeight: 800 },
  };
  return styleMap[label] ?? styleMap.none;
}

function getPainAnimationStyle(label: string): Record<string, any> {
  switch (label) {
    case 'none':
    case 'nuisance':
      return {
        animation: 'painFadeIn 0.6s ease-out',
        '@keyframes painFadeIn': {
          '0%': { opacity: 0, transform: 'translateY(4px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
      };
    case 'moderate':
      return {
        animation: 'painGentlePulse 3s ease-in-out infinite',
        '@keyframes painGentlePulse': {
          '0%, 100%': { opacity: 0.65 },
          '50%': { opacity: 1 },
        },
      };
    case 'severe':
      return {
        animation: 'painStrongPulse 2.5s ease-in-out infinite',
        '@keyframes painStrongPulse': {
          '0%, 100%': { opacity: 0.65, filter: 'brightness(1)' },
          '50%': { opacity: 1, filter: 'brightness(1.3)' },
        },
      };
    case 'critical':
      return {
        animation: 'painCriticalPulse 1.8s ease-in-out infinite',
        '@keyframes painCriticalPulse': {
          '0%, 100%': { opacity: 0.7, filter: 'brightness(1)' },
          '50%': { opacity: 1, filter: 'brightness(1.5)' },
        },
      };
    case 'legendary':
      return {
        background: 'linear-gradient(90deg, #F59E0B 0%, #FBBF24 30%, #FDE68A 50%, #FBBF24 70%, #F59E0B 100%)',
        backgroundSize: '200% 100%',
        WebkitBackgroundClip: 'text',
        backgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        animation: 'painShimmer 4s ease-in-out infinite',
        '@keyframes painShimmer': {
          '0%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
          '100%': { backgroundPosition: '0% 50%' },
        },
      };
    default:
      return {};
  }
}

export default function MobileFeedPage() {
  const { t } = useTranslation();
  const { eventId } = useParams<{ eventId: string }>();
  const userId = useAuthStore((state) => state.userId);
  const feedScrollRef = useRef<HTMLDivElement>(null);

  const [selectedActivityTypes, setSelectedActivityTypes] = useState<string[]>([]);
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);

  const { crewDrawerOpen, setCrewDrawerOpen } = useUIStore();

  const { data: event, isLoading: eventLoading } = useQuery({
    queryKey: ['event', eventId],
    queryFn: () => groupsApi.get(eventId!),
    enabled: !!eventId,
  });

  const { data: members = [], isLoading: membersLoading } = useQuery({
    queryKey: ['event-members', eventId],
    queryFn: () => groupsApi.listMembers(eventId!),
    enabled: !!eventId,
    staleTime: 1000 * 60 * 5,
  });

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['event-stats', eventId, userId],
    queryFn: () => balancesApi.getStats(eventId!, userId!),
    enabled: !!eventId && !!userId,
    staleTime: 1000 * 60 * 5,
  });

  const {
    data: activityPages,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: activityLoading,
    isError: activityError,
  } = useActivityFeed({
    eventId: eventId!,
    userId: userId!,
    enabled: !!eventId && !!userId,
  });

  const activityItems = activityPages?.pages.flatMap((p) => p.data) ?? [];

  const memberUserIds = useMemo(() => members.map((m) => m.user_id), [members]);
  const sentinelUsers = useUsers(memberUserIds);

  const enrichedMembers = useMemo(() => {
    return members.map((m: GroupMember) => {
      const sentinel = sentinelUsers[m.user_id];
      return {
        ...m,
        user_name: m.user_name || (sentinel ? `${sentinel.firstName} ${sentinel.lastName}`.trim() : undefined),
        user_email: m.user_email || sentinel?.email,
      };
    });
  }, [members, sentinelUsers]);

  const userMap: Record<string, { id: string; firstName: string; lastName: string; email: string }> = {};
  enrichedMembers.forEach((m) => {
    const sentinel = sentinelUsers[m.user_id];
    if (sentinel) {
      userMap[m.user_id] = sentinel;
    } else {
      const name = m.user_name || m.user_email || '';
      const parts = name.split(' ');
      userMap[m.user_id] = {
        id: m.user_id,
        firstName: parts[0] || '',
        lastName: parts.slice(1).join(' '),
        email: m.user_email || '',
      };
    }
  });

  // Activity type counts for filter
  const activityTypeCounts = useMemo(() => {
    const counts: Record<string, number> = {
      expense: 0,
      honor_restored: 0,
      member_join: 0,
      expense_updated: 0,
      settlement_rejected: 0,
      reimbursement: 0,
    };
    for (const item of activityItems) {
      if (item.type === 'expense') counts.expense = (counts.expense || 0) + 1;
      else if (item.type === 'honor_restored') counts.honor_restored = (counts.honor_restored || 0) + 1;
      else if (item.type === 'member_join') counts.member_join = (counts.member_join || 0) + 1;
      else if (item.type === 'expense_updated') counts.expense_updated = (counts.expense_updated || 0) + 1;
      else if (item.type === 'settlement_rejected') counts.settlement_rejected = (counts.settlement_rejected || 0) + 1;
      else if (item.type === 'reimbursement') counts.reimbursement = (counts.reimbursement || 0) + 1;
    }
    return counts;
  }, [activityItems]);

  const spendingLadder = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const item of activityItems) {
      if (isExpenseActivity(item)) {
        totals[item.paid_by] = (totals[item.paid_by] || 0) + item.amount_cents;
      }
    }

    const sorted = members
      .map((m) => ({ userId: m.user_id, amount: totals[m.user_id] || 0 }))
      .sort((a, b) => b.amount - a.amount);

    let currentRank = 0;
    let prevAmount = -1;
    return sorted.map((entry, i) => {
      if (entry.amount !== prevAmount) {
        currentRank = i + 1;
        prevAmount = entry.amount;
      }
      return {
        userId: entry.userId,
        amount: entry.amount,
        rank: currentRank,
        user: userMap[entry.userId],
      };
    });
  }, [activityItems, userMap, members]);

  const ACTIVITY_TYPE_OPTIONS = [
    { value: 'all', label: t('mobile.battleLog.filters.all'), count: activityItems.length },
    { value: 'expense', label: t('mobile.battleLog.filters.expenses'), count: activityTypeCounts['expense'] || 0 },
    { value: 'expense_updated', label: t('mobile.battleLog.filters.updates'), count: activityTypeCounts['expense_updated'] || 0 },
    { value: 'honor_restored', label: t('mobile.battleLog.filters.honor'), count: activityTypeCounts['honor_restored'] || 0 },
    { value: 'settlement_rejected', label: t('mobile.battleLog.filters.rejected'), count: activityTypeCounts['settlement_rejected'] || 0 },
    { value: 'member_join', label: t('mobile.battleLog.filters.joins'), count: activityTypeCounts['member_join'] || 0 },
    { value: 'reimbursement', label: t('mobile.battleLog.filters.reimbursements'), count: activityTypeCounts['reimbursement'] || 0 },
  ];

  const handleFilterToggle = (value: string) => {
    if (value === 'all') {
      setSelectedActivityTypes([]);
      setFilterDrawerOpen(false);
      return;
    }
    setSelectedActivityTypes((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    );
  };

  const handleFilterClear = () => {
    setSelectedActivityTypes([]);
  };

  const activeFilters = selectedActivityTypes.map((type) => {
    const option = ACTIVITY_TYPE_OPTIONS.find((o) => o.value === type);
    return { value: type, label: option?.label ?? type };
  });

  // Filter activity items client-side
  const filteredActivityItems = useMemo(() => {
    if (selectedActivityTypes.length === 0) return activityItems;
    return activityItems.filter((item) => selectedActivityTypes.includes(item.type));
  }, [activityItems, selectedActivityTypes]);

  if (!eventId) {
    return (
      <Box sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
        <Typography variant="body1">{t('mobile.battleLog.selectEvent')}</Typography>
      </Box>
    );
  }

  const currency = event?.currency || 'EUR';
  const isLoading = eventLoading || membersLoading;

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <CircularProgress sx={{ color: 'primary.main' }} />
      </Box>
    );
  }

  const crewCount = members.length;

  const bannerUrl = event?.images?.banner?.url ?? event?.images?.gallery?.[0]?.url;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <MobilePageHeader
        icon={<BattleLogIcon sx={{ fontSize: 22, color: 'primary.main' }} />}
        title={t('mobile.battleLog.title')}
        subtitle={event?.name || ''}
        rightAction={
          <Badge
            badgeContent={crewCount}
            sx={{
              '& .MuiBadge-badge': {
                bgcolor: 'primary.main',
                color: '#121212',
                fontWeight: 700,
                fontSize: '0.65rem',
                minWidth: 18,
                height: 18,
              },
            }}
          >
            <IconButton
              size="small"
              onClick={() => setCrewDrawerOpen(true)}
              sx={{ color: '#fff', width: 28, height: 28, bgcolor: alpha('#fff', 0.1) }}
            >
              <LeaderboardIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Badge>
        }
        backgroundImage={bannerUrl}
      >
        <Box sx={{ px: 1, py: 1 }}>
          <Box sx={{ p: 2, borderRadius: 2, bgcolor: alpha('#1A1A1A', 0.7), border: '1px solid', borderColor: alpha('#F59E0B', 0.35), backdropFilter: 'blur(8px)', boxShadow: '0 0 20px rgba(245,158,11,0.12)' }}>
            <Box sx={{ textAlign: 'center', mb: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, mb: 0.5 }}>
                <SpentIcon sx={{ fontSize: 14, color: '#F59E0B' }} />
            <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, color: alpha('#fff', 0.5), textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {t('mobile.battleLog.hero.totalDamage')}
            </Typography>
              </Box>
              {statsLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 0.5 }}>
                  <CircularProgress size={22} sx={{ color: '#F59E0B' }} />
                </Box>
              ) : (
                <Typography sx={{ fontSize: '1.75rem', fontWeight: 800, background: 'linear-gradient(135deg, #F59E0B 0%, #FBBF24 50%, #F59E0B 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', lineHeight: 1.1 }}>
                  {formatAmount(stats?.total_spent_cents ?? 0, currency)}
                </Typography>
              )}
              {(() => {
                const pain = getPainLevel(stats?.total_spent_cents ?? 0);
                const display = getPainDisplay(pain.label);
                return (
                  <Typography sx={{ fontSize: '0.8rem', color: display.color, mt: 0.25, fontStyle: 'italic', fontWeight: display.fontWeight, textShadow: display.glow, ...getPainAnimationStyle(pain.label) }}>
                    {pain.text}
                  </Typography>
                );
              })()}
            </Box>

            <Box sx={{ height: 1, bgcolor: alpha('#fff', 0.1), mb: 1 }} />

            <Box sx={{ display: 'flex' }}>
              <Box sx={{ flex: 1, textAlign: 'center' }}>
              <Typography sx={{ fontSize: '0.55rem', fontWeight: 700, color: alpha('#fff', 0.5), textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.25 }}>
                    {t('mobile.battleLog.hero.yourDamage')}
                </Typography>
                {statsLoading ? (
                  <CircularProgress size={14} sx={{ color: '#fff' }} />
                ) : (
                  <Typography sx={{ fontSize: '0.85rem', fontWeight: 800, color: '#fff' }}>
                    {formatAmount(stats?.your_paid_cents ?? 0, currency)}
                  </Typography>
                )}
              </Box>
              <Box sx={{ flex: 1, textAlign: 'center' }}>
                <Typography sx={{ fontSize: '0.55rem', fontWeight: 700, color: alpha('#fff', 0.5), textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.25 }}>
                  {t('mobile.battleLog.hero.youOwe')}
                </Typography>
                {statsLoading ? (
                  <CircularProgress size={14} sx={{ color: '#fff' }} />
                ) : (
                  <Typography sx={{ fontSize: '0.85rem', fontWeight: 800, color: '#EF4444' }}>
                    {formatAmount(stats?.your_outstanding_cents ?? 0, currency)}
                  </Typography>
                )}
              </Box>
            </Box>
          </Box>
        </Box>

        {/* Filter row */}
        <FilterDrawerLauncher
          activeFilters={activeFilters}
          onClick={() => setFilterDrawerOpen(true)}
        />
      </MobilePageHeader>

      {/* Scrollable Feed */}
      <Box
        ref={feedScrollRef}
        sx={{
          flexGrow: 1,
          overflow: 'auto',
          WebkitOverflowScrolling: 'touch',
          px: 2,
          pt: 1,
          pb: 2,
        }}
      >
        <MobileFeedList
          items={filteredActivityItems}
          userMap={userMap}
          currency={currency}
          isLoading={activityLoading}
          isError={activityError}
          hasNextPage={hasNextPage}
          isFetchingNextPage={isFetchingNextPage}
          fetchNextPage={fetchNextPage}
          scrollContainerRef={feedScrollRef}
          userId={userId ?? undefined}
        />
      </Box>

      {/* Members Drawer */}
      <Drawer
        anchor="bottom"
        open={crewDrawerOpen}
        onClose={() => setCrewDrawerOpen(false)}
        slotProps={{
          backdrop: { sx: { bgcolor: 'rgba(0, 0, 0, 0.7)' } },
        }}
        sx={{
          '& .MuiDrawer-paper': {
            bgcolor: '#121212',
            height: '95dvh',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          },
        }}
      >
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, pt: 2, pb: 1 }}>
          <Typography variant="h6" fontWeight={800} fontSize="1.1rem" sx={{ color: '#fff' }}>{t('mobile.battleLog.slaughterBoard.title')}</Typography>
          <IconButton onClick={() => setCrewDrawerOpen(false)} size="small" sx={{ color: alpha('#fff', 0.4), '&:hover': { color: '#fff' } }}>
            <CloseIcon sx={{ fontSize: 20 }} />
          </IconButton>
        </Box>

        {/* Slaughter Board */}
        <Box
          sx={{
            flex: 1,
            overflowY: 'auto',
            px: 2,
            py: 1.5,
            display: 'flex',
            flexDirection: 'column',
            gap: 0.25,
          }}
        >
          <SpendingLadder
            entries={spendingLadder.map(({ userId, rank, amount, user }) => ({
              rank,
              amount,
              displayName: user ? `${user.firstName} ${user.lastName}`.trim() || user.email.split('@')[0] : userId.slice(0, 8),
            }))}
            currency={currency}
            formatAmount={formatAmount}
            banners={{ 1: '/moshsplit/banner_first.svg', 2: '/moshsplit/second_banner.svg', 3: '/moshsplit/third_banner.svg' }}
            logos={{
              1: { src: '/moshsplit/doggo_first.svg', width: 120, height: 120 },
              2: { src: '/moshsplit/doggo_second.svg', width: 105, height: 75 },
              3: { src: '/moshsplit/doggo_third.svg', width: 105, height: 70 },
            }}
          />
        </Box>
      </Drawer>

      <FilterDrawerContent
        open={filterDrawerOpen}
        onClose={() => setFilterDrawerOpen(false)}
        title={t('mobile.battleLog.filterByType')}
        options={ACTIVITY_TYPE_OPTIONS}
        selectedValues={selectedActivityTypes}
        onToggle={handleFilterToggle}
        onClear={handleFilterClear}
        fullScreen
      />
    </Box >
  );
}
