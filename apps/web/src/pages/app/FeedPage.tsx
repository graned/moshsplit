import { Box, Typography, alpha } from '@mui/material';
import Grid from '@mui/material/Grid2';
import { useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@moshsplit/auth-react';
import { useMemo } from 'react';

import { EventBanner } from '../../components/feed/EventBanner';
import { FeedSectionHeader } from '../../components/feed/FeedSectionHeader';
import { FeedList } from '../../components/feed/FeedList';
import { MyStandingCard } from '../../components/feed/MyStandingCard';
import { FestivalMetricsCard } from '../../components/feed/FestivalMetricsCard';
import { PitCrewList } from '../../components/feed/PitCrewList';
import { groupsApi, GroupMember } from '../../api/groups.api';
import { balancesApi } from '../../api/balances.api';
import { useUsers } from '../../hooks/useUserCache';

export default function FeedPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const userId = useAuthStore((state) => state.userId);

  // Fetch event details
  const { data: event, isLoading: eventLoading } = useQuery({
    queryKey: ['event', eventId],
    queryFn: () => groupsApi.get(eventId!),
    enabled: !!eventId,
  });

  // Fetch event stats
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['event-stats', eventId, userId],
    queryFn: () => balancesApi.getStats(eventId!, userId!),
    enabled: !!eventId && !!userId,
    staleTime: 1000 * 60 * 5,
  });

  // Fetch user balance
  const { data: userBalance, isLoading: balanceLoading } = useQuery({
    queryKey: ['user-balance', eventId, userId],
    queryFn: () => balancesApi.getUserBalance(eventId!, userId!),
    enabled: !!eventId && !!userId,
    staleTime: 1000 * 60 * 5,
  });

  // Fetch members
  const { data: members = [], isLoading: membersLoading } = useQuery({
    queryKey: ['event-members', eventId],
    queryFn: () => groupsApi.listMembers(eventId!),
    enabled: !!eventId,
    staleTime: 1000 * 60 * 5,
  });

  // Enrich members with sentinel user info
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

  // Build userMap from enriched members for FeedList
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

  // Compute Avg/Day (approximate from first expense date if available)
  const avgPerDay = stats?.total_spent_cents ? Math.round(stats.total_spent_cents / 3) : undefined;

  // Derive top spender name from stats or members
  const topSpenderName = members.length > 0 ? members[0].user_name || members[0].user_email || '' : undefined;

  if (!eventId) {
    return (
      <Box sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
        <Typography variant="body1">Select an event to view its battle log.</Typography>
      </Box>
    );
  }

  const currency = event?.currency || 'EUR';
  const isLoading = eventLoading || statsLoading;

  return (
    <Box sx={{ ml: '0px', minHeight: '100vh' }}>
      {/* Sticky Event Banner */}
      <Box
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          bgcolor: alpha('#131313', 0.85),
          backdropFilter: 'blur(12px)',
        }}
      >
        <EventBanner event={event} stats={stats} isLoading={isLoading} currency={currency} />
      </Box>

      {/* Main Content */}
      <Box
        sx={{
          maxWidth: 1280,
          mx: 'auto',
          px: { xs: 2, md: 3 },
          pt: 3,
          pb: 4,
        }}
      >
        {/* Feed Section Header */}
        <FeedSectionHeader />

        {/* Two-Column Grid */}
        <Grid container spacing={3} columns={12} sx={{ mt: 0 }}>
          {/* LEFT: Feed */}
          <Grid size={{ xs: 12, lg: 8 }}>
            <FeedList eventId={eventId} userId={userId || ''} userMap={userMap} currency={currency} />
          </Grid>

          {/* RIGHT: Sticky Sidebar */}
          <Grid size={{ xs: 12, lg: 4 }}>
            <Box
              sx={{
                position: { xs: 'static', lg: 'sticky' },
                top: { lg: 24 },
                display: 'flex',
                flexDirection: 'column',
                gap: 3,
              }}
            >
              <MyStandingCard balance={userBalance} isLoading={balanceLoading} currency={currency} />

              <FestivalMetricsCard
                stats={stats}
                isLoading={statsLoading}
                currency={currency}
                topSpenderName={topSpenderName}
                avgPerDay={avgPerDay}
              />

              <PitCrewList members={enrichedMembers} currentUserId={userId || ''} isLoading={membersLoading} />
            </Box>
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
}
