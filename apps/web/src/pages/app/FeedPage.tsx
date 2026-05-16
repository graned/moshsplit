import { Box, Typography } from '@mui/material';
import { AutoStories as FeedIcon } from '@mui/icons-material';
import { useAuthStore } from '@moshsplit/auth-react';
import { FeedList } from '../../components/feed/FeedList';
import { usersApi, UserInfo } from '../../api/users.api';
import { useQuery } from '@tanstack/react-query';
import { useState, useEffect } from 'react';

/**
 * FeedPage: The Battle Log — a mixed activity feed showing
 * expenses, settlements, and milestones for all events.
 */
export default function FeedPage() {
  const userId = useAuthStore((state) => state.userId);
  const [userMap, setUserMap] = useState<Record<string, UserInfo>>({});

  // Pre-fetch all users for avatar/name resolution
  const { data: userList } = useQuery({
    queryKey: ['users-list'],
    queryFn: () => usersApi.list(),
    staleTime: 1000 * 60 * 5,
    enabled: !!userId,
  });

  useEffect(() => {
    if (userList) {
      const map: Record<string, UserInfo> = {};
      userList.forEach((u) => {
        // Reconstruct UserInfo from UserListItem
        const parts = u.name.split(' ');
        map[u.id] = {
          id: u.id,
          firstName: parts[0] || '',
          lastName: parts.slice(1).join(' '),
          email: u.email,
        };
      });
      setUserMap(map);
    }
  }, [userList]);

  // For now, use a default event ID. In a real app this would come from
  // context, URL params, or a selected event.
  // TODO: Wire up event selection or use current event context.
  const eventId = ''; // Placeholder — will be populated from event context

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Box
          sx={{
            width: 44,
            height: 44,
            borderRadius: 2,
            backgroundColor: 'rgba(245, 158, 11, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <FeedIcon sx={{ color: 'primary.main', fontSize: 24 }} />
        </Box>
        <Box>
          <Typography variant="h4" fontWeight={700}>
            Battle Log
          </Typography>
          <Typography variant="body2" color="text.secondary">
            All expenses, settlements, and milestones in one place
          </Typography>
        </Box>
      </Box>

      {/* Feed */}
      {eventId ? (
        <FeedList
          eventId={eventId}
          userId={userId || ''}
          userMap={userMap}
        />
      ) : (
        <Box
          sx={{
            p: 4,
            textAlign: 'center',
            color: 'text.secondary',
          }}
        >
          <Typography variant="body1">
            Select an event to view its battle log.
          </Typography>
        </Box>
      )}
    </Box>
  );
}
