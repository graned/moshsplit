import { useState, useMemo, useRef } from 'react';
import { useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Box, Typography, CircularProgress, Alert, alpha } from '@mui/material';
import { ReceiptLong as WarChestIcon } from '@mui/icons-material';
import { useAuthStore } from '@moshsplit/auth-react';

import { groupsApi, GroupMember } from '../../api/groups.api';
import { ExpenseFeed } from '../../components/expenses/ExpenseFeed';
import { FilterChips } from '../../components/expenses/FilterChips';
import { useUsers } from '../../hooks/useUserCache';
import { UserInfo } from '../../api/users.api';

export default function MobileExpensePage() {
  const { eventId } = useParams<{ eventId: string }>();
  const userId = useAuthStore((state) => state.userId);

  const [selectedType, setSelectedType] = useState<string>();
  const feedScrollRef = useRef<HTMLDivElement>(null);

  const { data: event, isLoading: eventLoading, error: eventError } = useQuery({
    queryKey: ['event', eventId],
    queryFn: () => groupsApi.get(eventId!),
    enabled: !!eventId,
  });

  const { data: members = [], isLoading: membersLoading } = useQuery({
    queryKey: ['event-members', eventId],
    queryFn: () => groupsApi.listMembers(eventId!),
    enabled: !!eventId,
  });

  const memberUserIds = useMemo(() => members.map((m) => m.user_id), [members]);
  const sentinelUsers = useUsers(memberUserIds);

  const userMap = useMemo((): Record<string, UserInfo> => {
    const map: Record<string, UserInfo> = {};
    members.forEach((m: GroupMember) => {
      const sentinel = sentinelUsers[m.user_id];
      if (sentinel) {
        map[m.user_id] = sentinel;
      } else {
        const name = m.user_name || m.user_email || '';
        const parts = name.split(' ');
        map[m.user_id] = {
          id: m.user_id,
          firstName: parts[0] || '',
          lastName: parts.slice(1).join(' '),
          email: m.user_email || '',
        };
      }
    });
    return map;
  }, [members, sentinelUsers]);

  if (!eventId) {
    return (
      <Box sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
        <Typography variant="body1">Select an event to view expenses.</Typography>
      </Box>
    );
  }

  const isLoading = eventLoading || membersLoading;

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <CircularProgress sx={{ color: 'primary.main' }} />
      </Box>
    );
  }

  if (eventError) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">Failed to load event</Alert>
      </Box>
    );
  }

  const currency = event?.currency || 'EUR';

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Fixed Header */}
      <Box
        sx={{
          flexShrink: 0,
          px: 2,
          pt: 2,
          pb: 1,
          bgcolor: alpha('#131313', 0.9),
          backdropFilter: 'blur(12px)',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: 2,
              bgcolor: alpha('#F59E0B', 0.12),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <WarChestIcon sx={{ fontSize: 22, color: 'primary.main' }} />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              sx={{
                fontSize: '1.25rem',
                fontWeight: 800,
                color: 'primary.main',
                letterSpacing: '-0.02em',
                lineHeight: 1.2,
              }}
            >
              War Chest
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

        {/* Filter Chips */}
        <FilterChips selectedType={selectedType} onTypeChange={setSelectedType} />
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
        <ExpenseFeed
          eventId={eventId}
          userId={userId || ''}
          currency={currency}
          userMap={userMap}
          members={members}
          expenseType={selectedType}
          scrollContainerRef={feedScrollRef}
        />
      </Box>
    </Box>
  );
}
