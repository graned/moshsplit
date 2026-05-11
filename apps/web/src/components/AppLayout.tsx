import { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router';
import {
  AppBar,
  Box,
  Toolbar,
  Typography,
  IconButton,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Avatar,
  Menu,
  MenuItem,
  useMediaQuery,
  useTheme,
  Divider,
} from '@mui/material';
import {
  Menu as MenuIcon,
  MenuOpen as MenuOpenIcon,
  Home as HomeIcon,
  Event as EventIcon,
  Receipt as ReceiptIcon,
  AccountBalance as BalanceIcon,
  SwapHoriz as SettlementIcon,
  Person as PersonIcon,
  Security as SecurityIcon,
  Logout as LogoutIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useAuthStore, useAuth } from '@moshsplit/auth-react';

const DRAWER_WIDTH = 280;

const navItems = [
  { path: '/app/home', label: 'nav.home', icon: <HomeIcon /> },
  { path: '/app/events', label: 'nav.groups', icon: <EventIcon /> },
  { path: '/app/expenses', label: 'nav.expenses', icon: <ReceiptIcon /> },
  { path: '/app/balances', label: 'nav.balances', icon: <BalanceIcon /> },
  { path: '/app/settlements', label: 'nav.settlements', icon: <SettlementIcon /> },
];

const settingsItems = [
  { path: '/app/settings/profile', label: 'app.profile', icon: <PersonIcon /> },
  { path: '/app/settings/security', label: 'app.security', icon: <SecurityIcon /> },
];

function AppLayout() {
  const { t } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const navigate = useNavigate();
  const location = useLocation();
  const { firstName, lastName, userEmail } = useAuthStore();
  const { logout } = useAuth();

  // Mobile: drawer is temporary (overlay)
  // Desktop: drawer is persistent (can be toggled)
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopOpen, setDesktopOpen] = useState(true);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const handleMobileDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleDesktopDrawerToggle = () => {
    setDesktopOpen(!desktopOpen);
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleNavigation = (path: string) => {
    navigate(path);
    // Close mobile drawer on navigation
    setMobileOpen(false);
  };

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // Keyboard accessibility: close drawer on Escape
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && mobileOpen) {
        setMobileOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileOpen]);

  const handleLogout = async () => {
    handleMenuClose();
    await logout();
    navigate('/login');
  };

  const handleSettings = (path: string) => {
    handleMenuClose();
    handleNavigation(path);
  };

  const drawerContent = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: 2,
            background: 'linear-gradient(135deg, #6366f1 0%, #f472b6 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700 }}>
            M
          </Typography>
        </Box>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          {t('common.appName')}
        </Typography>
      </Box>

      <Divider sx={{ opacity: 0.1 }} />

      <List sx={{ flex: 1, py: 1 }}>
        {navItems.map((item) => (
          <ListItem key={item.path} disablePadding>
            <ListItemButton
              selected={location.pathname === item.path}
              onClick={() => handleNavigation(item.path)}
              sx={{
                mx: 1,
                borderRadius: 2,
                '&.Mui-selected': {
                  backgroundColor: 'primary.main',
                  '&:hover': {
                    backgroundColor: 'primary.dark',
                  },
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 40, color: 'inherit' }}>
                {item.icon}
              </ListItemIcon>
              <ListItemText primary={t(item.label)} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>

      <Divider sx={{ opacity: 0.1 }} />

      <List sx={{ py: 1 }}>
        {settingsItems.map((item) => (
          <ListItem key={item.path} disablePadding>
            <ListItemButton
              selected={location.pathname === item.path}
              onClick={() => handleNavigation(item.path)}
              sx={{
                mx: 1,
                borderRadius: 2,
                '&.Mui-selected': {
                  backgroundColor: 'primary.main',
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 40, color: 'inherit' }}>
                {item.icon}
              </ListItemIcon>
              <ListItemText primary={t(item.label)} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {/* Mobile: Temporary drawer (overlay) */}
      {isMobile && (
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleMobileDrawerToggle}
          ModalProps={{
            keepMounted: true, // Better mobile performance
          }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: DRAWER_WIDTH,
              backgroundColor: 'background.paper',
            },
          }}
        >
          {drawerContent}
        </Drawer>
      )}

      {/* Desktop: Persistent drawer (collapsible) */}
      {isDesktop && (
        <Drawer
          variant="persistent"
          open={desktopOpen}
          sx={{
            display: { xs: 'none', md: 'block' },
            width: desktopOpen ? DRAWER_WIDTH : 0,
            flexShrink: 0,
            '& .MuiDrawer-paper': {
              width: desktopOpen ? DRAWER_WIDTH : 0,
              boxSizing: 'border-box',
              overflowX: 'hidden',
              backgroundColor: 'background.paper',
              borderRight: desktopOpen ? '1px solid' : 'none',
              borderColor: 'divider',
              transition: theme.transitions.create('width', {
                easing: theme.transitions.easing.sharp,
                duration: theme.transitions.duration.enteringScreen,
              }),
            },
          }}
        >
          {drawerContent}
        </Drawer>
      )}

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100vh',
          width: {
            xs: '100%',
            md: desktopOpen ? `calc(100% - ${DRAWER_WIDTH}px)` : '100%',
          },
          // Keep drawer attached to left edge - no negative margin
          // When collapsed, drawer width becomes 0 but stays in place
          ml: {
            xs: 0,
            md: 0,
          },
          transition: theme.transitions.create('width', {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.enteringScreen,
          }),
        }}
      >
        <AppBar
          position="sticky"
          elevation={0}
          sx={{
            borderBottom: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Toolbar>
            {/* Mobile menu button */}
            {isMobile && (
              <IconButton
                color="inherit"
                edge="start"
                onClick={handleMobileDrawerToggle}
                sx={{ mr: 2 }}
              >
                <MenuIcon />
              </IconButton>
            )}

            {/* Desktop toggle button (only show when drawer is open) */}
            {isDesktop && desktopOpen && (
              <IconButton
                color="inherit"
                edge="start"
                onClick={handleDesktopDrawerToggle}
                sx={{ mr: 2 }}
                aria-label="close sidebar"
              >
                <MenuOpenIcon />
              </IconButton>
            )}

            {/* Desktop: Show toggle to open sidebar when closed */}
            {isDesktop && !desktopOpen && (
              <IconButton
                color="inherit"
                edge="start"
                onClick={handleDesktopDrawerToggle}
                sx={{ mr: 2 }}
                aria-label="open sidebar"
              >
                <MenuIcon />
              </IconButton>
            )}

            <Box sx={{ flexGrow: 1 }} />

            <IconButton onClick={handleMenuOpen} size="small">
              <Avatar
                sx={{
                  width: 36,
                  height: 36,
                  bgcolor: 'primary.main',
                  fontSize: '0.875rem',
                }}
              >
                {firstName?.charAt(0)?.toUpperCase() || userEmail?.charAt(0)?.toUpperCase() || '?'}
              </Avatar>
            </IconButton>
          </Toolbar>
        </AppBar>

        <Box
          sx={{
            flex: 1,
            p: { xs: 2, sm: 3 },
            overflow: 'auto',
          }}
        >
          <Outlet />
        </Box>
      </Box>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        PaperProps={{
          sx: { mt: 1, minWidth: 180 },
        }}
      >
        <Box sx={{ px: 2, py: 1 }}>
          <Typography variant="subtitle2" fontWeight={600}>
            {firstName && lastName ? `${firstName} ${lastName}` : userEmail || 'User'}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {userEmail}
          </Typography>
        </Box>
        <Divider sx={{ my: 1 }} />
        <MenuItem onClick={() => handleSettings('/app/settings/profile')}>
          <ListItemIcon>
            <PersonIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t('app.profile')}</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => handleSettings('/app/settings/security')}>
          <ListItemIcon>
            <SecurityIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t('app.security')}</ListItemText>
        </MenuItem>
        <Divider sx={{ my: 1 }} />
        <MenuItem onClick={handleLogout}>
          <ListItemIcon>
            <LogoutIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t('app.logout')}</ListItemText>
        </MenuItem>
      </Menu>
    </Box>
  );
}

export default AppLayout;