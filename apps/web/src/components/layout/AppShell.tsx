import { useState, useMemo } from 'react';
import { Outlet, useNavigate, useParams } from 'react-router';
import { Box, useMediaQuery, useTheme, Drawer, IconButton } from '@mui/material';
import {
  Menu as MenuIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@moshsplit/auth-react';

import Sidebar from './Sidebar';
import BottomNav from './BottomNav';
import { AddExpenseDialog } from '../expenses/AddExpenseDialog';
import { groupsApi } from '../../api/groups.api';

const SIDEBAR_WIDTH = 280;
const SIDEBAR_COLLAPSED = 72;

/**
 * AppShell: Responsive layout container.
 * - Desktop (md+): Fixed sidebar + scrollable main content area.
 * - Mobile (<md): Full-width content + fixed bottom navigation.
 */
function AppShell() {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const navigate = useNavigate();
  const params = useParams();

  const userId = useAuthStore((state) => state.userId);
  const firstName = useAuthStore((state) => state.firstName);
  const lastName = useAuthStore((state) => state.lastName);
  const userEmail = useAuthStore((state) => state.userEmail);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  // Expense wizard state
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);

  // Extract eventId from URL (supports /app/events/:eventId and /app/expenses/:eventId)
  const eventId = params.eventId;

  // Fetch event details for currency
  const { data: event } = useQuery({
    queryKey: ['event', eventId],
    queryFn: () => {
      if (!eventId) throw new Error('No event ID');
      return groupsApi.get(eventId);
    },
    enabled: !!eventId && expenseDialogOpen,
  });

  // Fetch members for the current event
  const { data: members = [] } = useQuery({
    queryKey: ['event-members', eventId],
    queryFn: () => groupsApi.listMembers(eventId!),
    enabled: !!eventId && expenseDialogOpen,
  });

  // Build current user info
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

  const handleAddExpense = () => {
    if (eventId) {
      // We're on an event page — open the wizard
      setExpenseDialogOpen(true);
    } else {
      // No event context — navigate to events page
      navigate('/app/events');
    }
  };

  const handleExpenseSuccess = () => {
    // Invalidate relevant queries
    setExpenseDialogOpen(false);
  };

  // Desktop: permanent sidebar
  if (isDesktop) {
    return (
      <Box sx={{ display: 'flex', minHeight: '100vh' }}>
        {/* Permanent Sidebar */}
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
          <Sidebar eventId={eventId} collapsed={!sidebarOpen} onAddExpense={handleAddExpense} />
        </Drawer>

        {/* Toggle Button */}
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

        {/* Main Content */}
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            minWidth: 0,
            transition: theme.transitions.create('margin-left', {
              easing: theme.transitions.easing.sharp,
              duration: theme.transitions.duration.standard,
            }),
          }}
        >
          <Outlet />
        </Box>

        {/* Expense Wizard Dialog */}
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

  // Mobile: full-width content + bottom nav
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* Mobile Top Bar */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2,
          py: 1.5,
          backgroundColor: 'background.default',
          borderBottom: '1px solid',
          borderColor: 'divider',
          position: 'sticky',
          top: 0,
          zIndex: (t) => t.zIndex.appBar - 1,
        }}
      >
        <IconButton
          onClick={() => setMobileDrawerOpen(true)}
          size="small"
          sx={{ color: 'text.primary' }}
          aria-label="Open navigation"
        >
          <MenuIcon />
        </IconButton>
        <Box
          component="img"
          src="/assets/logo.svg"
          alt="MoshSplit"
          sx={{
            height: 36,
            width: 'auto',
            filter: 'drop-shadow(0 0 4px rgba(245, 158, 11, 0.3))',
          }}
        />
        <Box sx={{ width: 40 }} /> {/* Spacer for centering */}
      </Box>

      {/* Mobile Drawer (temporary) */}
      <Drawer
        anchor="left"
        open={mobileDrawerOpen}
        onClose={() => setMobileDrawerOpen(false)}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': {
            width: SIDEBAR_WIDTH,
            backgroundColor: 'background.default',
          },
        }}
      >
        <Sidebar
          eventId={eventId}
          onAddExpense={() => {
            setMobileDrawerOpen(false);
            handleAddExpense();
          }}
        />
      </Drawer>

      {/* Main Content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 2,
          pb: 10, // Space for bottom nav
          overflow: 'auto',
        }}
      >
        <Outlet />
      </Box>

      {/* Bottom Navigation */}
      <BottomNav onAddExpense={handleAddExpense} />

      {/* Expense Wizard Dialog */}
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
