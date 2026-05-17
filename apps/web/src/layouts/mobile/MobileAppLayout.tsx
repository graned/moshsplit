import { useState, useMemo } from 'react';
import { Outlet, useParams } from 'react-router';
import { Box, Fab, alpha, useTheme } from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@moshsplit/auth-react';

import MobileBottomNav from './MobileBottomNav';
import { AddExpenseDialog } from '../../components/expenses/AddExpenseDialog';
import { groupsApi } from '../../api/groups.api';

function MobileAppLayout() {
  const theme = useTheme();
  const params = useParams();

  const userId = useAuthStore((state) => state.userId);
  const firstName = useAuthStore((state) => state.firstName);
  const lastName = useAuthStore((state) => state.lastName);
  const userEmail = useAuthStore((state) => state.userEmail);

  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);

  const eventId = params.eventId;

  const { data: event } = useQuery({
    queryKey: ['event', eventId],
    queryFn: () => {
      if (!eventId) throw new Error('No event ID');
      return groupsApi.get(eventId);
    },
    enabled: !!eventId && expenseDialogOpen,
  });

  const { data: members = [] } = useQuery({
    queryKey: ['event-members', eventId],
    queryFn: () => groupsApi.listMembers(eventId!),
    enabled: !!eventId && expenseDialogOpen,
  });

  const currentUser = useMemo(
    () => ({
      id: userId || '',
      firstName: firstName || '',
      lastName: lastName || '',
      email: userEmail || '',
    }),
    [userId, firstName, lastName, userEmail]
  );

  const handleAddExpense = () => {
    setExpenseDialogOpen(true);
  };

  const handleExpenseSuccess = () => {
    setExpenseDialogOpen(false);
  };

  const hasEvent = !!eventId;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100dvh', overflow: 'hidden' }}>
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          overflow: 'auto',
          pb: hasEvent ? '64px' : 0,
          background: `
            linear-gradient(180deg, rgba(18, 18, 18, 0.75) 0%, rgba(26, 26, 26, 0.75) 50%, rgba(18, 18, 18, 0.75) 100%),
            url('/assets/background-moshsplit.webp')
          `,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      >
        <Outlet />
      </Box>

      {hasEvent && (
        <>
          <Fab
            color="primary"
            onClick={handleAddExpense}
            sx={{
              position: 'fixed',
              bottom: 80,
              right: 16,
              zIndex: (t) => t.zIndex.appBar + 1,
              bgcolor: 'primary.main',
              color: '#121212',
              boxShadow: `0 4px 16px ${alpha(theme.palette.primary.main, 0.4)}`,
              '&:hover': {
                bgcolor: 'primary.dark',
                boxShadow: `0 6px 24px ${alpha(theme.palette.primary.main, 0.5)}`,
              },
            }}
          >
            <AddIcon />
          </Fab>
          <MobileBottomNav />
        </>
      )}

      {eventId && (
        <AddExpenseDialog
          open={expenseDialogOpen}
          onClose={() => setExpenseDialogOpen(false)}
          eventId={eventId}
          members={members}
          currentUser={currentUser}
          groupCurrency={event?.currency}
          onSuccess={handleExpenseSuccess}
        />
      )}
    </Box>
  );
}

export default MobileAppLayout;
