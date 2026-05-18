import { useMemo, useRef } from 'react';
import { useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Box, Typography, CircularProgress, alpha, IconButton, Badge, Drawer } from '@mui/material';
import { People as PeopleIcon, RssFeed as BattleLogIcon, AttachMoney as SpentIcon, CheckCircle as SettledIcon, Pending as OutstandingIcon } from '@mui/icons-material';
import { useAuthStore } from '@moshsplit/auth-react';

import { groupsApi, GroupMember } from '../../api/groups.api';
import { balancesApi } from '../../api/balances.api';
import { useUsers } from '../../hooks/useUserCache';
import { useUIStore } from '../../stores/uiStore';
import { FeedList } from '../../components/feed/FeedList';

const ACTIVITY_FILTERS = [
  { value: undefined, label: 'All' },
  { value: 'expense', label: 'Expenses' },
  { value: 'honor_restored', label: 'Honor' },
  { value: 'member_join', label: 'Joins' },
] as const;

function formatAmount(cents: number, currency = 'EUR') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export default function MobileFeedPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const userId = useAuthStore((state) => state.userId);
  const feedScrollRef = useRef<HTMLDivElement>(null);

  const { selectedActivityFilter, setSelectedActivityFilter, crewDrawerOpen, setCrewDrawerOpen } = useUIStore();

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

  if (!eventId) {
    return (
      <Box sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
        <Typography variant="body1">Select an event to view its battle log.</Typography>
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
  const headerBg = bannerUrl
    ? `linear-gradient(to bottom, rgba(18,18,18,0.3) 0%, rgba(18,18,18,0.7) 60%, #121212 100%), url(${bannerUrl})`
    : `linear-gradient(to bottom, rgba(18,18,18,0.6) 0%, rgba(18,18,18,0.85) 60%, #121212 100%), linear-gradient(135deg, #4A2F0A 0%, #1A1A1A 100%)`;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Fixed Header with event image background */}
      <Box
        sx={{
          flexShrink: 0,
          px: 2,
          pt: 1.5,
          pb: 1.5,
          background: headerBg,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      >
        {/* Title row */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0, flex: 1 }}>
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: 2,
                bgcolor: alpha('#F59E0B', 0.12),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <BattleLogIcon sx={{ fontSize: 22, color: 'primary.main' }} />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography
                sx={{
                  fontSize: '1.25rem',
                  fontWeight: 800,
                  color: 'primary.main',
                  letterSpacing: '-0.02em',
                  lineHeight: 1.2,
                }}
              >
                Battle Log
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{
                  fontSize: '0.75rem',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {event?.name || ''}
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexShrink: 0 }}>
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
                <PeopleIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Badge>
          </Box>
        </Box>

        {/* Glass festival overview cards */}
        <Box sx={{ display: 'flex', gap: 1, mb: 1.5 }}>
          <Box sx={{ flex: 1, p: 1, borderRadius: 1.5, bgcolor: alpha('#1E1E1E', 0.5), border: '1px solid', borderColor: alpha('#fff', 0.08), backdropFilter: 'blur(8px)' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25 }}>
              <SpentIcon sx={{ fontSize: 14, color: alpha('#fff', 0.6) }} />
              <Typography sx={{ fontSize: '0.55rem', fontWeight: 700, color: alpha('#fff', 0.5), textTransform: 'uppercase', letterSpacing: '0.05em' }}>Spent</Typography>
            </Box>
            {statsLoading ? <CircularProgress size={14} sx={{ color: 'text.primary' }} /> : <Typography sx={{ fontSize: '0.9rem', fontWeight: 800, color: '#fff' }}>{formatAmount(stats?.total_spent_cents ?? 0, currency)}</Typography>}
          </Box>
          <Box sx={{ flex: 1, p: 1, borderRadius: 1.5, bgcolor: alpha('#1E1E1E', 0.5), border: '1px solid', borderColor: alpha('#10b981', 0.2), backdropFilter: 'blur(8px)' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25 }}>
              <SettledIcon sx={{ fontSize: 14, color: '#10b981' }} />
              <Typography sx={{ fontSize: '0.55rem', fontWeight: 700, color: alpha('#fff', 0.5), textTransform: 'uppercase', letterSpacing: '0.05em' }}>Settled</Typography>
            </Box>
            {statsLoading ? <CircularProgress size={14} sx={{ color: '#10b981' }} /> : <Typography sx={{ fontSize: '0.9rem', fontWeight: 800, color: '#10b981' }}>{formatAmount(stats?.total_settled_cents ?? 0, currency)}</Typography>}
          </Box>
          <Box sx={{ flex: 1, p: 1, borderRadius: 1.5, bgcolor: alpha('#1E1E1E', 0.5), border: '1px solid', borderColor: alpha('#F59E0B', 0.2), backdropFilter: 'blur(8px)' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25 }}>
              <OutstandingIcon sx={{ fontSize: 14, color: '#F59E0B' }} />
              <Typography sx={{ fontSize: '0.55rem', fontWeight: 700, color: alpha('#fff', 0.5), textTransform: 'uppercase', letterSpacing: '0.05em' }}>Outstanding</Typography>
            </Box>
            {statsLoading ? <CircularProgress size={14} sx={{ color: '#F59E0B' }} /> : <Typography sx={{ fontSize: '0.9rem', fontWeight: 800, color: '#F59E0B' }}>{formatAmount(stats?.outstanding_cents ?? 0, currency)}</Typography>}
          </Box>
        </Box>

        {/* Filter chips */}
        <Box sx={{ display: 'flex', gap: 0.75, overflowX: 'auto', pb: 0.5, scrollbarWidth: 'none', '::-webkit-scrollbar': { display: 'none' } }}>
          {ACTIVITY_FILTERS.map((filter) => {
            const isSelected = selectedActivityFilter === filter.value;
            return (
              <Box
                key={filter.value ?? 'all'}
                onClick={() => setSelectedActivityFilter(filter.value ?? null)}
                sx={{
                  px: 1.5,
                  py: 0.5,
                  borderRadius: 100,
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  letterSpacing: '0.03em',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  bgcolor: isSelected ? 'primary.main' : alpha('#1E1E1E', 0.5),
                  color: isSelected ? '#121212' : alpha('#fff', 0.6),
                  border: '1px solid',
                  borderColor: isSelected ? 'primary.main' : alpha('#fff', 0.1),
                  transition: 'all 0.15s ease',
                  minHeight: 32,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {filter.label}
              </Box>
            );
          })}
        </Box>
      </Box>

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
        <FeedList
          eventId={eventId}
          userId={userId || ''}
          userMap={userMap}
          currency={currency}
          scrollContainerRef={feedScrollRef}
          activityType={selectedActivityFilter ?? undefined}
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
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            maxHeight: '85dvh',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          },
        }}
      >
        {/* Grab handle with amber glow */}
        <Box sx={{ position: 'relative', display: 'flex', justifyContent: 'center', pt: 1.5, pb: 1 }}>
          <Box
            sx={{
              width: 48,
              height: 4,
              borderRadius: 2,
              bgcolor: '#F59E0B',
              boxShadow: '0 0 12px rgba(245, 158, 11, 0.4)',
            }}
          />
        </Box>

        {/* Title section */}
        <Box sx={{ px: 2, pb: 1.5, borderBottom: '1px solid', borderColor: alpha('#fff', 0.06) }}>
          <Typography
            sx={{
              fontSize: '1.3rem',
              fontWeight: 900,
              textAlign: 'center',
              background: 'linear-gradient(135deg, #F59E0B 0%, #FBBF24 50%, #D97706 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              letterSpacing: '-0.02em',
            }}
          >
            Meet the babacas! 🔥
          </Typography>
          <Typography
            sx={{
              fontSize: '0.7rem',
              textAlign: 'center',
              color: alpha('#fff', 0.4),
              mt: 0.25,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
            }}
          >
            {crewCount} {crewCount === 1 ? 'survivor' : 'survivors'} in the pit
          </Typography>
        </Box>

        {/* Members list */}
        <Box
          sx={{
            flex: 1,
            overflowY: 'auto',
            px: 2,
            py: 1.5,
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
          }}
        >
          {enrichedMembers.map((member, index) => {
            const sentinel = sentinelUsers[member.user_id];
            const firstName = sentinel?.firstName ?? member.user_name?.split(' ')[0] ?? '';
            const lastName = sentinel?.lastName ?? member.user_name?.split(' ').slice(1).join(' ') ?? '';
            const email = sentinel?.email ?? member.user_email ?? '';
            const initials = `${(firstName?.[0] ?? '').toUpperCase()}${(lastName?.[0] ?? '').toUpperCase()}`;
            const isCurrentUser = member.user_id === userId;
            const role = member.role;

            const avatarColors = [
              { bg: '#F59E0B', color: '#121212' },
              { bg: '#ef4444', color: '#fff' },
              { bg: '#10b981', color: '#fff' },
              { bg: '#6366f1', color: '#fff' },
              { bg: '#f472b6', color: '#fff' },
              { bg: '#14b8a6', color: '#fff' },
              { bg: '#f97316', color: '#fff' },
              { bg: '#8b5cf6', color: '#fff' },
            ];
            const colorScheme = isCurrentUser
              ? { bg: 'primary.main', color: '#121212' }
              : avatarColors[index % avatarColors.length];

            return (
              <Box
                key={member.user_id}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  p: 1.5,
                  borderRadius: 2,
                  bgcolor: isCurrentUser ? alpha('#F59E0B', 0.08) : alpha('#1E1E1E', 0.5),
                  border: '1px solid',
                  borderColor: isCurrentUser ? alpha('#F59E0B', 0.25) : alpha('#fff', 0.06),
                  transition: 'all 0.15s ease',
                }}
              >
                {/* Avatar */}
                <Box
                  sx={{
                    width: 44,
                    height: 44,
                    borderRadius: '50%',
                    bgcolor: colorScheme.bg,
                    color: colorScheme.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.9rem',
                    fontWeight: 800,
                    flexShrink: 0,
                    boxShadow: isCurrentUser ? '0 0 16px rgba(245, 158, 11, 0.3)' : 'none',
                  }}
                >
                  {initials || '?'}
                </Box>

                {/* Info */}
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.25 }}>
                    <Typography
                      sx={{
                        fontSize: '0.9rem',
                        fontWeight: 700,
                        color: isCurrentUser ? '#F59E0B' : '#fff',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {firstName} {lastName}
                    </Typography>
                    {isCurrentUser && (
                      <Box
                        sx={{
                          px: 0.75,
                          py: 0.15,
                          borderRadius: 100,
                          bgcolor: alpha('#F59E0B', 0.15),
                          border: '1px solid',
                          borderColor: alpha('#F59E0B', 0.3),
                          flexShrink: 0,
                        }}
                      >
                        <Typography
                          sx={{
                            fontSize: '0.55rem',
                            fontWeight: 800,
                            color: '#F59E0B',
                            textTransform: 'uppercase',
                            letterSpacing: '0.08em',
                          }}
                        >
                          You
                        </Typography>
                      </Box>
                    )}
                    {role === 'admin' && (
                      <Box
                        sx={{
                          px: 0.75,
                          py: 0.15,
                          borderRadius: 100,
                          bgcolor: alpha('#ef4444', 0.15),
                          border: '1px solid',
                          borderColor: alpha('#ef4444', 0.3),
                          flexShrink: 0,
                        }}
                      >
                        <Typography
                          sx={{
                            fontSize: '0.55rem',
                            fontWeight: 800,
                            color: '#ef4444',
                            textTransform: 'uppercase',
                            letterSpacing: '0.08em',
                          }}
                        >
                          Admin
                        </Typography>
                      </Box>
                    )}
                  </Box>
                  <Typography
                    sx={{
                      fontSize: '0.7rem',
                      color: alpha('#fff', 0.35),
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {email}
                  </Typography>
                </Box>
              </Box>
            );
          })}
        </Box>
      </Drawer>
    </Box >
  );
}
