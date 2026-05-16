import { useState } from 'react';
import {
  Box,
  BottomNavigation,
  BottomNavigationAction,
  Avatar,
  Menu,
  MenuItem,
  Divider,
  Typography,
  Paper,
  ListItemIcon,
  ListItemText,
  Fab,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Home as HomeIcon,
  Event as EventIcon,
  ReceiptLong as ReceiptIcon,
  AccountBalanceWallet as WalletIcon,
  SwapHoriz as SwapIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation } from 'react-router';
import { useAuthStore } from '@moshsplit/auth-react';

interface BottomNavProps {
  onAddExpense?: () => void;
}

function BottomNav({ onAddExpense }: BottomNavProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { firstName, lastName, userEmail, clearTokens } = useAuthStore();

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const navItems = [
    { path: '/app/home', label: t('app.home', 'Home'), icon: <HomeIcon /> },
    { path: '/app/events', label: t('nav.events', 'Events'), icon: <EventIcon /> },
    { path: '/app/expenses', label: t('nav.expenses', 'Expenses'), icon: <ReceiptIcon /> },
    { path: '/app/balances', label: t('nav.balances', 'Balances'), icon: <WalletIcon /> },
    { path: '/app/settlements', label: t('nav.settlements', 'Settlements'), icon: <SwapIcon /> },
  ];

  const handleNavigation = (path: string) => {
    navigate(path);
  };

  const handleProfileOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleProfileClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    handleProfileClose();
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
    <>
      {/* FAB: Add Expense */}
      {onAddExpense && (
        <Fab
          color="primary"
          onClick={onAddExpense}
          sx={{
            position: 'fixed',
            bottom: 76,
            right: 16,
            zIndex: (theme) => theme.zIndex.appBar,
            boxShadow: '0 4px 16px rgba(245, 158, 11, 0.4)',
            '&:hover': {
              boxShadow: '0 6px 24px rgba(245, 158, 11, 0.5)',
              transform: 'translateY(-2px)',
            },
          }}
        >
          <AddIcon />
        </Fab>
      )}

      <Paper
        elevation={0}
        sx={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: (theme) => theme.zIndex.appBar - 1,
          backgroundColor: 'background.paper',
          borderTop: '1px solid',
          borderColor: 'divider',
        }}
      >
        <BottomNavigation
          value={location.pathname}
          onChange={(_, newValue: string) => {
            if (newValue === 'profile') {
              handleProfileOpen({ currentTarget: document.getElementById('mobile-profile-btn')! } as React.MouseEvent<HTMLElement>);
            } else {
              handleNavigation(newValue);
            }
          }}
          showLabels
          sx={{
            height: 64,
            '& .MuiBottomNavigationAction-root': {
              minWidth: 0,
              padding: '6px 4px',
              fontSize: '0.6875rem',
              color: 'text.secondary',
              transition: 'color 0.2s ease',
              '&.Mui-selected': {
                color: 'primary.main',
              },
            },
            '& .MuiBottomNavigationAction-label': {
              fontSize: '0.6875rem',
              transition: 'font-size 0.2s ease',
              '&.Mui-selected': {
                fontSize: '0.6875rem',
                fontWeight: 600,
              },
            },
          }}
        >
          {navItems.map((item) => (
            <BottomNavigationAction
              key={item.path}
              value={item.path}
              label={item.label}
              icon={
                <Box
                  sx={{
                    width: 22,
                    height: 22,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {item.icon}
                </Box>
              }
            />
          ))}

          {/* Profile Avatar */}
          <BottomNavigationAction
            id="mobile-profile-btn"
            value="profile"
            label="Profile"
            icon={
              <Avatar
                sx={{
                  width: 26,
                  height: 26,
                  bgcolor: 'primary.main',
                  color: '#121212',
                  fontSize: '0.6875rem',
                  fontWeight: 700,
                }}
              >
                {initials}
              </Avatar>
            }
          />
        </BottomNavigation>
      </Paper>

      {/* Profile Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleProfileClose}
        transformOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'top' }}
        PaperProps={{
          sx: {
            mb: 1,
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
            handleProfileClose();
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
    </>
  );
}

export default BottomNav;
