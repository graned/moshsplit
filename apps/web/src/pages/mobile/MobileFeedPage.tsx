import { useMemo, useRef } from 'react';
import { useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Box, Typography, CircularProgress, alpha, IconButton, Badge } from '@mui/material';
import { People as PeopleIcon, ArrowDownward as OwedIcon, ArrowUpward as OwesIcon, AccountBalanceWallet as BalanceIcon } from '@mui/icons-material';
import { useAuthStore } from '@moshsplit/auth-react';

import { groupsApi, GroupMember } from '../../api/groups.api';
import { balancesApi } from '../../api/balances.api';
import { useUsers } from '../../hooks/useUserCache';
import { FeedList } from '../../components/feed/FeedList';

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

  const { data: userBalance, isLoading: balanceLoading } = useQuery({
    queryKey: ['user-balance', eventId, userId],
    queryFn: () => balancesApi.getUserBalance(eventId!, userId!),
    enabled: !!eventId && !!userId,
    staleTime: 1000 * 60 * 5,
  });

  const { data: stats } = useQuery({
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

  const youOwe = userBalance?.owes_cents ?? 0;
  const youAreOwed = userBalance?.paid_cents ?? 0;
  const netBalance = userBalance?.balance_cents ?? 0;
  const crewCount = members.length;
  const totalSpent = stats?.total_spent_cents ?? 0;

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
          <Typography
            sx={{
              fontSize: '1.1rem',
              fontWeight: 800,
              color: 'primary.main',
              letterSpacing: '-0.02em',
              lineHeight: 1.2,
            }}
          >
            Battle Log
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <Typography variant="caption" sx={{ fontSize: '0.7rem', fontWeight: 700, color: alpha('#fff', 0.7) }}>
              {formatAmount(totalSpent, currency)}
            </Typography>
            <Badge badgeContent={crewCount} sx={{ '& .MuiBadge-badge': { fontSize: '0.6rem', height: 16, minWidth: 16, bgcolor: 'primary.main', color: '#121212', fontWeight: 700 } }}>
              <IconButton size="small" sx={{ color: '#fff', width: 28, height: 28, bgcolor: alpha('#fff', 0.1) }}>
                <PeopleIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Badge>
          </Box>
        </Box>

        {/* Glass standing cards */}
        <Box sx={{ display: 'flex', gap: 1 }}>
          {/* You Owe */}
          <Box
            sx={{
              flex: 1,
              p: 1,
              borderRadius: 1.5,
              bgcolor: alpha('#1E1E1E', 0.5),
              border: '1px solid',
              borderColor: alpha('#ef4444', 0.2),
              backdropFilter: 'blur(8px)',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25 }}>
              <OwesIcon sx={{ fontSize: 14, color: '#ef4444' }} />
              <Typography sx={{ fontSize: '0.55rem', fontWeight: 700, color: alpha('#fff', 0.5), textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                You owe
              </Typography>
            </Box>
            {balanceLoading ? (
              <CircularProgress size={14} sx={{ color: '#ef4444' }} />
            ) : (
              <Typography sx={{ fontSize: '0.9rem', fontWeight: 800, color: '#ef4444' }}>
                {formatAmount(youOwe, currency)}
              </Typography>
            )}
          </Box>

          {/* You are owed */}
          <Box
            sx={{
              flex: 1,
              p: 1,
              borderRadius: 1.5,
              bgcolor: alpha('#1E1E1E', 0.5),
              border: '1px solid',
              borderColor: alpha('#10b981', 0.2),
              backdropFilter: 'blur(8px)',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25 }}>
              <OwedIcon sx={{ fontSize: 14, color: '#10b981' }} />
              <Typography sx={{ fontSize: '0.55rem', fontWeight: 700, color: alpha('#fff', 0.5), textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Owed
              </Typography>
            </Box>
            {balanceLoading ? (
              <CircularProgress size={14} sx={{ color: '#10b981' }} />
            ) : (
              <Typography sx={{ fontSize: '0.9rem', fontWeight: 800, color: '#10b981' }}>
                {formatAmount(youAreOwed, currency)}
              </Typography>
            )}
          </Box>

          {/* Net Balance */}
          <Box
            sx={{
              flex: 1,
              p: 1,
              borderRadius: 1.5,
              bgcolor: alpha('#1E1E1E', 0.5),
              border: '1px solid',
              borderColor: alpha('#F59E0B', 0.2),
              backdropFilter: 'blur(8px)',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25 }}>
              <BalanceIcon sx={{ fontSize: 14, color: '#F59E0B' }} />
              <Typography sx={{ fontSize: '0.55rem', fontWeight: 700, color: alpha('#fff', 0.5), textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Net
              </Typography>
            </Box>
            {balanceLoading ? (
              <CircularProgress size={14} sx={{ color: '#F59E0B' }} />
            ) : (
              <Typography sx={{ fontSize: '0.9rem', fontWeight: 800, color: netBalance >= 0 ? '#10b981' : '#ef4444' }}>
                {netBalance >= 0 ? '+' : ''}{formatAmount(netBalance, currency)}
              </Typography>
            )}
          </Box>
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
        />
      </Box>
    </Box>
  );
}
