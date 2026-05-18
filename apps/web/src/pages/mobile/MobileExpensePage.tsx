import { useState, useMemo } from 'react';
import { useParams, useOutletContext } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Box, Typography, CircularProgress, Alert, alpha, IconButton } from '@mui/material';
import { ReceiptLong as WarChestIcon, Add as AddIcon } from '@mui/icons-material';
import { useAuthStore } from '@moshsplit/auth-react';

import { groupsApi, GroupMember } from '../../api/groups.api';
import { ExpenseFeed } from '../../components/expenses/ExpenseFeed';
import { FilterChips } from '../../components/expenses/FilterChips';
import { AddExpenseDrawer } from '../../components/expenses/AddExpenseDrawer';
import { useUsers } from '../../hooks/useUserCache';
import { useUIStore } from '../../stores/uiStore';
import { UserInfo } from '../../api/users.api';

interface MobileOutletContext {
  eventId: string | undefined;
  currentUser: { id: string; firstName: string; lastName: string; email: string };
}

export default function MobileExpensePage() {
  const { eventId: paramEventId } = useParams<{ eventId: string }>();
  const { eventId, currentUser } = useOutletContext<MobileOutletContext>();
  const userId = useAuthStore((state) => state.userId);

  const [selectedType, setSelectedType] = useState<string>();
  const { addExpenseOpen, setAddExpenseOpen } = useUIStore();

  const { data: event, isLoading: eventLoading, error: eventError } = useQuery({
    queryKey: ['event', paramEventId],
    queryFn: () => groupsApi.get(paramEventId!),
    enabled: !!paramEventId,
  });

  const { data: members = [], isLoading: membersLoading } = useQuery({
    queryKey: ['event-members', paramEventId],
    queryFn: () => groupsApi.listMembers(paramEventId!),
    enabled: !!paramEventId,
  });

  const { data: eventForDialog } = useQuery({
    queryKey: ['event', eventId],
    queryFn: () => groupsApi.get(eventId!),
    enabled: !!eventId && addExpenseOpen,
  });

  const { data: membersForDialog = [] } = useQuery({
    queryKey: ['event-members', eventId],
    queryFn: () => groupsApi.listMembers(eventId!),
    enabled: !!eventId && addExpenseOpen,
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

  if (!paramEventId) {
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
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
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
              <WarChestIcon sx={{ fontSize: 22, color: 'primary.main' }} />
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

          {/* Add Expense Button */}
          <IconButton
            onClick={() => setAddExpenseOpen(true)}
            sx={{
              ml: 1,
              flexShrink: 0,
              width: 40,
              height: 40,
              borderRadius: 2,
              bgcolor: alpha('#F59E0B', 0.12),
              color: 'primary.main',
              '&:hover': {
                bgcolor: alpha('#F59E0B', 0.2),
              },
            }}
          >
            <AddIcon sx={{ fontSize: 22 }} />
          </IconButton>
        </Box>

        {/* Filter Chips */}
        <FilterChips selectedType={selectedType} onTypeChange={setSelectedType} />
      </Box>

      {/* Scrollable Feed */}
      <Box
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
          eventId={paramEventId}
          userId={userId || ''}
          currency={currency}
          userMap={userMap}
          members={members}
          expenseType={selectedType}
        />
      </Box>

      {/* Expense Drawer */}
      {eventId && (
        <AddExpenseDrawer
          open={addExpenseOpen}
          onClose={() => setAddExpenseOpen(false)}
          eventId={eventId}
          members={membersForDialog}
          currentUser={currentUser}
          groupCurrency={eventForDialog?.currency}
          onSuccess={() => setAddExpenseOpen(false)}
        />
      )}
    </Box>
  );
}
