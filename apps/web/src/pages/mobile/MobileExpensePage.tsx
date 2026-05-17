import { useState, useMemo } from 'react';
import { useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Box, Typography, CircularProgress, Alert } from '@mui/material';
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
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
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
    <Box sx={{ px: 2, pt: 2, pb: 4 }}>
      <FilterChips selectedType={selectedType} onTypeChange={setSelectedType} />
      <Box sx={{ mt: 2 }}>
        <ExpenseFeed eventId={eventId} userId={userId || ''} currency={currency} userMap={userMap} members={members} />
      </Box>
    </Box>
  );
}
