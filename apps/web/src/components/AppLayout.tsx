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
  ArrowBack as ArrowBackIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@moshsplit/auth-react';
import LogoSvgUrl from '../../assets/logo.svg';
import EventsIconUrl from '../../assets/events-icon.png';
import ExpensesIconUrl from '../../assets/expenses-icon.png';
import BalanceIconUrl from '../../assets/balance-icon.png';
import SettlementsIconUrl from '../../assets/settlements-icon.png';
import BgTextureUrl from '../../assets/bg-texture-1.svg';

const DRAWER_WIDTH = 280;
const DRAWER_COLLAPSED = 72;

const navItems = [
  { path: '/app/events', label: 'nav.events', icon: EventsIconUrl },
  { path: '/app/expenses', label: 'nav.expenses', icon: ExpensesIconUrl },
  { path: '/app/balances', label: 'nav.balances', icon: BalanceIconUrl },
  { path: '/app/settlements', label: 'nav.settlements', icon: SettlementsIconUrl },
];

function AppLayout() {
  const { t } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const navigate = useNavigate();
  const location = useLocation();
  const { firstName, lastName, userEmail, clearTokens } = useAuthStore();

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

  const handleGoBack = () => {
    handleMenuClose();
    clearTokens();
    const externalUrl = import.meta.env.VITE_EXTERNAL_APP_URL;
    if (externalUrl) {
      window.location.href = externalUrl;
    } else {
      navigate('/login');
    }
  };

  // Custom icon component wrapper for SVG icons
  const IconWrapper = ({ icon, ...props }: { icon: string | React.ComponentType<any>; sx?: object }) => {
    // Handle string URLs (SVG files)
    if (typeof icon === 'string') {
      return (
        <Box sx={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', ...props.sx }}>
          <img src={icon} alt="" style={{ width: '100%', height: '100%' }} />
        </Box>
      );
    }
    // Handle React components (MUI icons)
    const IconComponent = icon;
    return (
      <Box sx={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', ...props.sx }}>
        <IconComponent style={{ width: '100%', height: '100%' }} />
      </Box>
    );
  };

  const drawerContent = (collapsed: boolean) => (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Background image */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 0,
          backgroundImage: `url(${BgTextureUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />

      {/* Content overlay */}
      <Box sx={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Logo header */}
        <Box sx={{ p: collapsed ? 1 : 2.5, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <img src={LogoSvgUrl} alt="logo" style={{ width: collapsed ? 40 : 140, height: collapsed ? 40 : 140 }} />
        </Box>

        <Divider sx={{ opacity: 0.1, mx: collapsed ? 1 : 2 }} />

        {/* Main menu items */}
        <List sx={{ flex: 0, py: collapsed ? 1 : 2, px: 0.5 }}>
          {navItems.map((item) => {
            const isSelected = location.pathname === item.path;
            return (
              <ListItem key={item.path} disablePadding sx={{ mb: collapsed ? 0.5 : 1 }}>
                <ListItemButton
                  selected={isSelected}
                  onClick={() => handleNavigation(item.path)}
                  sx={{
                    mx: 1,
                    borderRadius: 2,
                    py: collapsed ? 1 : 2,
                    justifyContent: collapsed ? 'center' : 'flex-start',
                    transition: 'all 0.2s ease',
                    backgroundColor: isSelected ? 'rgba(245, 158, 11, 0.15)' : 'transparent',
                    borderLeft: isSelected ? '3px solid' : '3px solid transparent',
                    borderColor: isSelected ? 'primary.main' : 'transparent',
                    '&:hover': {
                      backgroundColor: isSelected ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                    },
                  }}
                >
                  <ListItemIcon sx={{ minWidth: collapsed ? 0 : 68, color: isSelected ? 'primary.main' : 'text.secondary' }}>
                    <IconWrapper icon={item.icon} sx={{ width: collapsed ? 28 : 48, height: collapsed ? 28 : 48, color: isSelected ? 'primary.main' : 'text.secondary' }} />
                  </ListItemIcon>
                  {!collapsed && (
                    <ListItemText
                      primary={t(item.label)}
                      primaryTypographyProps={{
                        fontSize: '1.1rem',
                        fontWeight: isSelected ? 600 : 400,
                        color: isSelected ? 'text.primary' : 'text.secondary',
                      }}
                    />
                  )}
                </ListItemButton>
              </ListItem>
            );
          })}
        </List>

        {/* Spacer to push user to bottom */}
        <Box sx={{ flex: 1 }} />

        {/* User section */}
        <Box sx={{ p: collapsed ? 1 : 2, borderTop: '1px solid', borderColor: 'divider', bgcolor: 'rgba(0, 0, 0, 0.2)' }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: collapsed ? 'center' : 'flex-start',
              gap: collapsed ? 0 : 1.5,
              cursor: 'pointer',
              p: collapsed ? 0.5 : 1,
              borderRadius: 2,
              transition: 'background-color 0.2s',
              '&:hover': {
                bgcolor: 'rgba(255, 255, 255, 0.05)',
              },
            }}
            onClick={handleMenuOpen}
          >
            <Avatar
              sx={{
                width: collapsed ? 32 : 40,
                height: collapsed ? 32 : 40,
                bgcolor: 'primary.main',
                fontSize: collapsed ? '0.75rem' : '1rem',
                fontWeight: 600,
              }}
            >
              {firstName?.charAt(0)?.toUpperCase() || userEmail?.charAt(0)?.toUpperCase() || '?'}
            </Avatar>
            {!collapsed && (
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: 600,
                    color: 'text.primary',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {firstName && lastName ? `${firstName} ${lastName}` : userEmail || 'User'}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{
                    color: 'text.secondary',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: 'block',
                  }}
                >
                  {userEmail}
                </Typography>
              </Box>
            )}
          </Box>
        </Box>
      </Box>
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
              backgroundColor: 'transparent',
              borderRight: 'none',
            },
          }}
        >
          {drawerContent(false)}
        </Drawer>
      )}

      {/* Desktop: Persistent drawer (collapsible) */}
      {isDesktop && (
        <Drawer
          variant="persistent"
          open={desktopOpen}
          sx={{
            display: { xs: 'none', md: 'block' },
            width: desktopOpen ? DRAWER_WIDTH : DRAWER_COLLAPSED,
            flexShrink: 0,
            '& .MuiDrawer-paper': {
              width: desktopOpen ? DRAWER_WIDTH : DRAWER_COLLAPSED,
              boxSizing: 'border-box',
              overflowX: 'hidden',
              backgroundColor: 'transparent',
              borderRight: desktopOpen ? 'none' : 'none',
              transition: theme.transitions.create('width', {
                easing: theme.transitions.easing.sharp,
                duration: theme.transitions.duration.enteringScreen,
              }),
            },
          }}
        >
          {drawerContent(!desktopOpen)}
        </Drawer>
      )}

      {/* Desktop toggle arrow — positioned on the edge of the drawer */}
      {isDesktop && (
        <IconButton
          onClick={handleDesktopDrawerToggle}
          size="small"
          sx={{
            position: 'fixed',
            left: desktopOpen ? DRAWER_WIDTH - 16 : DRAWER_COLLAPSED - 16,
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: theme.zIndex.drawer + 1,
            width: 32,
            height: 32,
            backgroundColor: 'background.paper',
            border: '1px solid',
            borderColor: 'divider',
            boxShadow: 1,
            transition: theme.transitions.create('left', {
              easing: theme.transitions.easing.sharp,
              duration: theme.transitions.duration.enteringScreen,
            }),
            '&:hover': {
              backgroundColor: 'action.hover',
            },
          }}
          aria-label={desktopOpen ? 'close sidebar' : 'open sidebar'}
        >
          {desktopOpen ? <ChevronLeftIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />}
        </IconButton>
      )}

      {/* Mobile toggle button — floating */}
      {isMobile && (
        <IconButton
          onClick={handleMobileDrawerToggle}
          size="small"
          sx={{
            position: 'fixed',
            left: 8,
            top: 8,
            zIndex: theme.zIndex.drawer + 1,
            width: 36,
            height: 36,
            backgroundColor: 'background.paper',
            border: '1px solid',
            borderColor: 'divider',
            boxShadow: 1,
            '&:hover': {
              backgroundColor: 'action.hover',
            },
          }}
          aria-label="open menu"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
            <rect y="3" width="20" height="2" rx="1" />
            <rect y="9" width="20" height="2" rx="1" />
            <rect y="15" width="20" height="2" rx="1" />
          </svg>
        </IconButton>
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
            md: desktopOpen ? `calc(100% - ${DRAWER_WIDTH}px)` : `calc(100% - ${DRAWER_COLLAPSED}px)`,
          },
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
        <MenuItem onClick={handleGoBack}>
          <ListItemIcon>
            <ArrowBackIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t('app.goBack', { appName: import.meta.env.VITE_EXTERNAL_APP_NAME || 'App' })}</ListItemText>
        </MenuItem>
      </Menu>
    </Box>
  );
}

export default AppLayout;