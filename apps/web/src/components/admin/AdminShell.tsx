import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router';
import {
  Box,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Divider,
  IconButton,
  Avatar,
  Menu,
  MenuItem,
  useMediaQuery,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Event as EventIcon,
  People as PeopleIcon,
  UploadFile as ImportIcon,
  ReceiptLong as AuditIcon,
  Menu as MenuIcon,
  ChevronLeft as ChevronLeftIcon,
  ArrowBack as BackIcon,
} from '@mui/icons-material';
import { useAuthStore } from '@moshsplit/auth-react';

const SIDEBAR_WIDTH = 260;
const SIDEBAR_COLLAPSED = 68;

interface AdminNavItem {
  path: string;
  label: string;
  icon: React.ReactNode;
}

const navItems: AdminNavItem[] = [
  { path: '/admin', label: 'Dashboard', icon: <DashboardIcon /> },
  { path: '/admin/events', label: 'Events', icon: <EventIcon /> },
  { path: '/admin/users', label: 'Users', icon: <PeopleIcon /> },
  { path: '/admin/import', label: 'Summon Survivors', icon: <ImportIcon /> },
  { path: '/admin/audit', label: 'Eternal Ledger', icon: <AuditIcon /> },
];

export default function AdminShell() {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const navigate = useNavigate();
  const location = useLocation();

  const { firstName, lastName, userEmail, clearTokens } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [userMenuAnchor, setUserMenuAnchor] = useState<null | HTMLElement>(null);

  const initials = firstName?.charAt(0)?.toUpperCase() || userEmail?.charAt(0)?.toUpperCase() || '?';

  const displayName = firstName && lastName ? `${firstName} ${lastName}` : userEmail || 'Admin';

  const sidebarWidth = sidebarOpen ? SIDEBAR_WIDTH : SIDEBAR_COLLAPSED;

  const handleNavigation = (path: string) => {
    navigate(path);
    setMobileDrawerOpen(false);
  };

  const handleLogout = () => {
    setUserMenuAnchor(null);
    clearTokens();
    navigate('/login');
  };

  const sidebarContent = (
    <Box
      sx={{
        width: isDesktop ? (sidebarOpen ? SIDEBAR_WIDTH : SIDEBAR_COLLAPSED) : SIDEBAR_WIDTH,
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#0a0a0a',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <Box
        sx={{
          p: 2,
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          borderBottom: '1px solid',
          borderColor: alpha('#ef4444', 0.15),
        }}
      >
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: 2,
            backgroundColor: alpha('#ef4444', 0.15),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Typography
            sx={{
              color: '#ef4444',
              fontWeight: 800,
              fontSize: '1rem',
            }}
          >
            M
          </Typography>
        </Box>
        {sidebarOpen && (
          <Box sx={{ minWidth: 0 }}>
            <Typography
              variant="body2"
              fontWeight={700}
              sx={{
                color: '#f3f4f6',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              MoshSplit Admin
            </Typography>
            <Typography variant="caption" sx={{ color: '#6b7280' }}>
              Control Panel
            </Typography>
          </Box>
        )}
      </Box>

      {/* Navigation */}
      <List sx={{ py: 1, px: 1, flex: '1 0 auto' }}>
        {navItems.map((item) => {
          // Match exact path or sub-paths
          const isSelected =
            location.pathname === item.path || (item.path !== '/admin' && location.pathname.startsWith(item.path));
          return (
            <ListItem key={item.path} disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                selected={isSelected}
                onClick={() => handleNavigation(item.path)}
                sx={{
                  borderRadius: 2,
                  py: 1.25,
                  px: 2,
                  backgroundColor: isSelected ? 'rgba(239, 68, 68, 0.12)' : 'transparent',
                  '&.Mui-selected': {
                    backgroundColor: 'rgba(239, 68, 68, 0.12)',
                    '&:hover': {
                      backgroundColor: 'rgba(239, 68, 68, 0.18)',
                    },
                  },
                  '&:hover': {
                    backgroundColor: 'rgba(255, 255, 255, 0.04)',
                  },
                }}
              >
                <ListItemIcon
                  sx={{
                    minWidth: 40,
                    color: isSelected ? '#ef4444' : '#6b7280',
                  }}
                >
                  {item.icon}
                </ListItemIcon>
                {sidebarOpen && (
                  <ListItemText
                    primary={item.label}
                    primaryTypographyProps={{
                      fontSize: '0.875rem',
                      fontWeight: isSelected ? 600 : 400,
                      color: isSelected ? '#f3f4f6' : '#9ca3af',
                    }}
                  />
                )}
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>

      <Divider sx={{ borderColor: alpha('#ef4444', 0.1), mx: 2 }} />

      {/* Back to App */}
      <Box sx={{ px: 2, py: 1 }}>
        <ListItemButton
          onClick={() => navigate('/app/events')}
          sx={{
            borderRadius: 2,
            py: 1,
            px: 2,
            '&:hover': {
              backgroundColor: 'rgba(255, 255, 255, 0.04)',
            },
          }}
        >
          <ListItemIcon sx={{ minWidth: 40, color: '#6b7280' }}>
            <BackIcon />
          </ListItemIcon>
          {sidebarOpen && (
            <ListItemText
              primary="Back to App"
              primaryTypographyProps={{
                fontSize: '0.875rem',
                color: '#9ca3af',
              }}
            />
          )}
        </ListItemButton>
      </Box>

      {/* User Section */}
      <Box
        sx={{
          p: 2,
          borderTop: '1px solid',
          borderColor: alpha('#ef4444', 0.1),
          flexShrink: 0,
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            cursor: 'pointer',
            p: 1,
            borderRadius: 2,
            transition: 'background-color 0.2s',
            '&:hover': {
              bgcolor: 'rgba(255, 255, 255, 0.05)',
            },
          }}
          onClick={(e) => setUserMenuAnchor(e.currentTarget)}
        >
          <Avatar
            sx={{
              width: 32,
              height: 32,
              bgcolor: alpha('#ef4444', 0.2),
              color: '#ef4444',
              fontSize: '0.75rem',
              fontWeight: 700,
            }}
          >
            {initials}
          </Avatar>
          {sidebarOpen && (
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography
                variant="body2"
                sx={{
                  fontWeight: 600,
                  color: '#f3f4f6',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {displayName}
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  color: '#6b7280',
                  display: 'block',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {userEmail}
              </Typography>
            </Box>
          )}
        </Box>
      </Box>

      {/* User Menu */}
      <Menu
        anchorEl={userMenuAnchor}
        open={Boolean(userMenuAnchor)}
        onClose={() => setUserMenuAnchor(null)}
        transformOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'top' }}
      >
        <MenuItem onClick={handleLogout}>Sign out</MenuItem>
      </Menu>
    </Box>
  );

  // Desktop layout
  if (isDesktop) {
    return (
      <Box sx={{ display: 'flex', minHeight: '100vh', backgroundColor: '#0d0d0d' }}>
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
              borderColor: alpha('#ef4444', 0.1),
              backgroundColor: '#0a0a0a',
              transition: theme.transitions.create('width', {
                easing: theme.transitions.easing.sharp,
                duration: theme.transitions.duration.standard,
              }),
            },
          }}
        >
          {sidebarContent}
        </Drawer>

        {/* Toggle Button */}
        <IconButton
          onClick={() => setSidebarOpen(!sidebarOpen)}
          size="small"
          sx={{
            position: 'fixed',
            left: sidebarWidth - 16,
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: (t) => t.zIndex.drawer + 1,
            width: 32,
            height: 32,
            backgroundColor: '#1a1a1a',
            border: '1px solid',
            borderColor: alpha('#ef4444', 0.15),
            boxShadow: 1,
            transition: theme.transitions.create('left', {
              easing: theme.transitions.easing.sharp,
              duration: theme.transitions.duration.standard,
            }),
            color: '#ef4444',
            '&:hover': {
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
            },
          }}
          aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          {sidebarOpen ? <ChevronLeftIcon fontSize="small" /> : <MenuIcon fontSize="small" />}
        </IconButton>

        {/* Main Content */}
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            minWidth: 0,
            ml: `${sidebarWidth}px`,
            transition: theme.transitions.create('margin-left', {
              easing: theme.transitions.easing.sharp,
              duration: theme.transitions.duration.standard,
            }),
          }}
        >
          <Box sx={{ p: { sm: 3, lg: 4 }, pb: 4, minHeight: '100vh' }}>
            <Outlet />
          </Box>
        </Box>
      </Box>
    );
  }

  // Mobile layout
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: '#0d0d0d' }}>
      {/* Mobile Top Bar */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2,
          py: 1.5,
          backgroundColor: '#0a0a0a',
          borderBottom: '1px solid',
          borderColor: alpha('#ef4444', 0.15),
          position: 'sticky',
          top: 0,
          zIndex: (t) => t.zIndex.appBar - 1,
        }}
      >
        <IconButton
          onClick={() => setMobileDrawerOpen(true)}
          size="small"
          sx={{ color: '#ef4444' }}
          aria-label="Open admin navigation"
        >
          <MenuIcon />
        </IconButton>
        <Typography variant="body2" fontWeight={700} sx={{ color: '#f3f4f6' }}>
          Admin Panel
        </Typography>
        <Avatar
          sx={{
            width: 32,
            height: 32,
            bgcolor: alpha('#ef4444', 0.2),
            color: '#ef4444',
            fontSize: '0.75rem',
            fontWeight: 700,
          }}
        >
          {initials}
        </Avatar>
      </Box>

      {/* Mobile Drawer */}
      <Drawer
        anchor="left"
        open={mobileDrawerOpen}
        onClose={() => setMobileDrawerOpen(false)}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': {
            width: SIDEBAR_WIDTH,
            backgroundColor: '#0a0a0a',
          },
        }}
      >
        {sidebarContent}
      </Drawer>

      {/* Main Content */}
      <Box component="main" sx={{ flexGrow: 1, p: 2, pb: 4, overflow: 'auto' }}>
        <Outlet />
      </Box>
    </Box>
  );
}
