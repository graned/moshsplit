import { useState, useMemo } from 'react';
import { Outlet, useParams } from 'react-router';
import { Box, useTheme, Drawer, IconButton } from '@mui/material';
import {
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@moshsplit/auth-react';

import Sidebar from './Sidebar';
import { AddExpenseDialog } from '../../expenses';
import { groupsApi } from '../../../api/groups.api';

const SIDEBAR_WIDTH = 280;
const SIDEBAR_COLLAPSED = 72;

function AppShell() {
  const theme = useTheme();
  const params = useParams();

  const userId = useAuthStore((state) => state.userId);
  const firstName = useAuthStore((state) => state.firstName);
  const lastName = useAuthStore((state) => state.lastName);
  const userEmail = useAuthStore((state) => state.userEmail);

  const [sidebarOpen, setSidebarOpen] = useState(false);

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

  const sidebarWidth = sidebarOpen ? SIDEBAR_WIDTH : SIDEBAR_COLLAPSED;

  const handleExpenseSuccess = () => {
    setExpenseDialogOpen(false);
  };

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <Drawer
        variant="permanent"
        sx={{
          width: sidebarWidth,
          flexShrink: 0,
          transition: theme.transitions.create('width', {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.standard,
          }),
          '& .MuiDrawer-paper': {
            width: sidebarWidth,
            boxSizing: 'border-box',
            overflowX: 'hidden',
            borderRight: '1px solid',
            borderColor: 'divider',
            backgroundColor: 'background.default',
            transition: theme.transitions.create('width', {
              easing: theme.transitions.easing.sharp,
              duration: theme.transitions.duration.standard,
            }),
          },
        }}
      >
        <Sidebar eventId={eventId} collapsed={!sidebarOpen} />
      </Drawer>

      <IconButton
        onClick={() => setSidebarOpen(!sidebarOpen)}
        size="small"
        sx={{
          position: 'fixed',
          left: sidebarWidth - 16,
          top: 20,
          zIndex: (t) => t.zIndex.drawer + 1,
          width: 32,
          height: 32,
          backgroundColor: 'background.paper',
          border: '1px solid',
          borderColor: 'divider',
          boxShadow: 1,
          transition: theme.transitions.create(['left', 'background-color'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.standard,
          }),
          '&:hover': {
            backgroundColor: 'action.hover',
          },
        }}
        aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
      >
        {sidebarOpen ? <ChevronLeftIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />}
      </IconButton>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          minWidth: 0,
          transition: theme.transitions.create('margin-left', {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.standard,
          }),
          background: `
            linear-gradient(180deg, rgba(18, 18, 18, 0.75) 0%, rgba(26, 26, 26, 0.75) 50%, rgba(18, 18, 18, 0.75) 100%),
            url('/assets/background-moshsplit.webp')
          `,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          backgroundAttachment: 'fixed',
        }}
      >
        <Outlet />
      </Box>

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

export default AppShell;
