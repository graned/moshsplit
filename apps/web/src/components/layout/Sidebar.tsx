import { useState } from 'react';
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Avatar,
  Menu,
  MenuItem,
  Divider,
  Button,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Add as AddIcon,
  Home as HomeIcon,
  Event as EventIcon,
  ReceiptLong as ReceiptIcon,
  AccountBalanceWallet as WalletIcon,
  SwapHoriz as SwapIcon,
  AutoStories as FeedIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation } from 'react-router';
import { useAuthStore } from '@moshsplit/auth-react';
import LogoSvgUrl from '../../../assets/logo.svg';

const DRAWER_WIDTH = 280;

interface NavItem {
  path: string;
  label: string;
  icon: React.ReactNode;
}

interface SidebarProps {
  onAddExpense?: () => void;
}

function Sidebar({ onAddExpense }: SidebarProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { firstName, lastName, userEmail, clearTokens } = useAuthStore();

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const navItems: NavItem[] = [
    { path: '/app/home', label: t('app.home'), icon: <HomeIcon /> },
    { path: '/app/events', label: t('nav.events', 'Events'), icon: <EventIcon /> },
    { path: '/app/expenses', label: t('nav.expenses', 'Expenses'), icon: <ReceiptIcon /> },
    { path: '/app/balances', label: t('nav.balances', 'Balances'), icon: <WalletIcon /> },
    { path: '/app/settlements', label: t('nav.settlements', 'Settlements'), icon: <SwapIcon /> },
    { path: '/app/feed', label: t('nav.feed', 'Battle Log'), icon: <FeedIcon /> },
  ];

  const handleNavigation = (path: string) => {
    navigate(path);
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    handleMenuClose();
    clearTokens();
    const externalUrl = import.meta.env.VITE_EXTERNAL_APP_URL;
    if (externalUrl) {
      window.location.href = externalUrl;
    } else {
      navigate('/login');
    }
  };

  const initials =
    firstName?.charAt(0)?.toUpperCase() ||
    userEmail?.charAt(0)?.toUpperCase() ||
    '?';

  const displayName =
    firstName && lastName
      ? `${firstName} ${lastName}`
      : userEmail || 'User';

  return (
    <Box
      sx={{
        width: DRAWER_WIDTH,
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'background.default',
        borderRight: '1px solid',
        borderColor: 'divider',
        position: 'fixed',
        left: 0,
        top: 0,
        zIndex: (theme) => theme.zIndex.drawer,
        overflow: 'hidden',
      }}
    >
      {/* Logo */}
      <Box
        sx={{
          p: 2.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <img
          src={LogoSvgUrl}
          alt="MoshSplit"
          style={{
            width: 120,
            height: 120,
            filter: 'drop-shadow(0 0 8px rgba(245, 158, 11, 0.3))',
          }}
        />
      </Box>

      <Divider sx={{ opacity: 0.5, mx: 2 }} />

      {/* Navigation */}
      <List sx={{ py: 1, px: 1, flex: '1 0 auto' }}>
        {navItems.map((item) => {
          const isSelected = location.pathname === item.path;
          return (
            <ListItem key={item.path} disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                selected={isSelected}
                onClick={() => handleNavigation(item.path)}
                sx={{
                  borderRadius: 2,
                  py: 1.5,
                  px: 2,
                  backgroundColor: isSelected
                    ? 'rgba(245, 158, 11, 0.12)'
                    : 'transparent',
                  '&.Mui-selected': {
                    backgroundColor: 'rgba(245, 158, 11, 0.12)',
                    '&:hover': {
                      backgroundColor: 'rgba(245, 158, 11, 0.18)',
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
                    color: isSelected ? 'primary.main' : 'text.secondary',
                  }}
                >
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={item.label}
                  primaryTypographyProps={{
                    fontSize: '0.9375rem',
                    fontWeight: isSelected ? 600 : 400,
                    color: isSelected ? 'text.primary' : 'text.secondary',
                  }}
                />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>

      {/* Add Expense Button */}
      <Box sx={{ px: 2, pb: 2, flexShrink: 0 }}>
        <Button
          variant="contained"
          color="primary"
          fullWidth
          startIcon={<AddIcon />}
          onClick={onAddExpense}
          sx={{
            py: 1.5,
            fontWeight: 700,
            fontSize: '0.9375rem',
            textTransform: 'none',
            borderRadius: 2,
          }}
        >
          {t('expense.addExpense', 'Add Expense')}
        </Button>
      </Box>

      {/* User Section */}
      <Box
        sx={{
          p: 2,
          borderTop: '1px solid',
          borderColor: 'divider',
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
          onClick={handleMenuOpen}
        >
          <Avatar
            sx={{
              width: 36,
              height: 36,
              bgcolor: 'primary.main',
              color: '#121212',
              fontSize: '0.875rem',
              fontWeight: 700,
            }}
          >
            {initials}
          </Avatar>
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
              {displayName}
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
        </Box>
      </Box>

      {/* User Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        transformOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'top' }}
        PaperProps={{
          sx: {
            minWidth: 180,
          },
        }}
      >
        <Box sx={{ px: 2, py: 1 }}>
          <Typography variant="subtitle2" fontWeight={600}>
            {displayName}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {userEmail}
          </Typography>
        </Box>
        <Divider sx={{ my: 1 }} />
        <MenuItem
          onClick={() => {
            handleMenuClose();
            navigate('/app/settings/profile');
          }}
        >
          {t('settings.profile', 'Profile Settings')}
        </MenuItem>
        <MenuItem onClick={handleLogout}>
          <ListItemIcon>
            <ArrowBackIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>
            {t('app.goBack', { appName: import.meta.env.VITE_EXTERNAL_APP_NAME || 'App' })}
          </ListItemText>
        </MenuItem>
      </Menu>
    </Box>
  );
}

export default Sidebar;
