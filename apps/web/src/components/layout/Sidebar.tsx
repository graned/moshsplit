import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Avatar,
  Divider,
  Button,
  Tooltip,
  alpha,
  useTheme,
} from '@mui/material';
import {
  RssFeed as FeedIcon,
  ReceiptLong as ExpensesIcon,
  AccountBalanceWallet as BalancesIcon,
  People as ParticipantsIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router';
import { useAuthStore } from '@moshsplit/auth-react';

interface NavItem {
  path: string;
  fallbackPath: string;
  label: string;
  icon: React.ReactNode;
}

interface SidebarProps {
  eventId?: string;
  collapsed?: boolean;
  onAddExpense?: () => void;
}

function Sidebar({ eventId, collapsed = false, onAddExpense }: SidebarProps) {
  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const { firstName, lastName, userEmail } = useAuthStore();

  const navItems: NavItem[] = [
    { path: `/app/events/${eventId}/feed`, fallbackPath: '/app/feed', label: 'Battle Log', icon: <FeedIcon /> },
    { path: `/app/expenses/${eventId}`, fallbackPath: '/app/expenses', label: 'War Chest', icon: <ExpensesIcon /> },
    {
      path: `/app/events/${eventId}/balances`,
      fallbackPath: '/app/balances',
      label: 'Scales of War',
      icon: <BalancesIcon />,
    },
    { path: `/app/events/${eventId}/crew`, fallbackPath: '/app/crew', label: 'The Crew', icon: <ParticipantsIcon /> },
  ];

  const handleNavigation = (item: NavItem) => {
    navigate(eventId ? item.path : item.fallbackPath);
  };

  const initials = firstName?.charAt(0)?.toUpperCase() || userEmail?.charAt(0)?.toUpperCase() || '?';

  const displayName = firstName && lastName ? `${firstName} ${lastName}` : userEmail || 'User';

  return (
    <Box
      sx={{
        width: '100%',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'background.default',
        overflow: 'hidden',
        transition: theme.transitions.create('width', {
          easing: theme.transitions.easing.sharp,
          duration: theme.transitions.duration.standard,
        }),
      }}
    >
      {/* Logo */}
      <Box
        sx={{
          p: collapsed ? 2 : 3,
          pb: 2,
          flexShrink: 0,
          display: 'flex',
          justifyContent: collapsed ? 'center' : 'flex-start',
        }}
      >
        {collapsed ? (
          <Tooltip title="MoshSplit" placement="right">
            <Box
              component="img"
              src="/assets/logo.svg"
              alt="MoshSplit"
              sx={{
                height: 32,
                width: 32,
                filter: `drop-shadow(0 0 8px ${alpha(theme.palette.primary.main, 0.3)})`,
              }}
            />
          </Tooltip>
        ) : (
          <Box
            component="img"
            src="/assets/logo.svg"
            alt="MoshSplit"
            sx={{
              height: 40,
              width: 'auto',
              filter: `drop-shadow(0 0 8px ${alpha(theme.palette.primary.main, 0.3)})`,
            }}
          />
        )}
      </Box>

      <Divider sx={{ borderColor: 'divider', mx: 2 }} />

      {/* Navigation */}
      <List sx={{ py: 2, px: collapsed ? 1 : 2, flex: '1 0 auto' }}>
        {navItems.map((item) => {
          const activePath = eventId ? item.path : item.fallbackPath;
          const isSelected = location.pathname === activePath || location.pathname.startsWith(activePath + '/');
          return (
            <ListItem key={item.fallbackPath} disablePadding sx={{ mb: 0.5 }}>
              {collapsed ? (
                <Tooltip title={item.label} placement="right">
                  <ListItemButton
                    selected={isSelected}
                    onClick={() => handleNavigation(item)}
                    sx={{
                      borderRadius: 3,
                      py: 1.5,
                      px: 1,
                      justifyContent: 'center',
                      bgcolor: isSelected ? alpha(theme.palette.primary.main, 0.08) : 'transparent',
                      border: isSelected ? '1px solid' : '1px solid transparent',
                      borderColor: isSelected ? 'divider' : 'transparent',
                      '&:hover': {
                        bgcolor: alpha(theme.palette.primary.main, 0.05),
                      },
                    }}
                  >
                    <ListItemIcon
                      sx={{
                        minWidth: 'auto',
                        color: isSelected ? 'primary.main' : 'text.secondary',
                      }}
                    >
                      {item.icon}
                    </ListItemIcon>
                  </ListItemButton>
                </Tooltip>
              ) : (
                <ListItemButton
                  selected={isSelected}
                  onClick={() => handleNavigation(item)}
                  sx={{
                    borderRadius: 3,
                    py: 1.5,
                    px: 2,
                    bgcolor: isSelected ? alpha(theme.palette.primary.main, 0.08) : 'transparent',
                    border: isSelected ? '1px solid' : '1px solid transparent',
                    borderColor: isSelected ? 'divider' : 'transparent',
                    '&:hover': {
                      bgcolor: alpha(theme.palette.primary.main, 0.05),
                    },
                  }}
                >
                  <ListItemIcon
                    sx={{
                      minWidth: 36,
                      color: isSelected ? 'primary.main' : 'text.secondary',
                    }}
                  >
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText
                    primary={item.label}
                    primaryTypographyProps={{
                      fontSize: '0.9375rem',
                      fontWeight: isSelected ? 700 : 500,
                      color: isSelected ? 'text.primary' : 'text.secondary',
                    }}
                  />
                </ListItemButton>
              )}
            </ListItem>
          );
        })}
      </List>

      {/* Add Expense Button */}
      <Box sx={{ px: collapsed ? 2 : 3, pb: 3, flexShrink: 0 }}>
        {collapsed ? (
          <Tooltip title="Deploy Damage" placement="right">
            <Button
              variant="contained"
              onClick={onAddExpense}
              sx={{
                minWidth: 40,
                width: 40,
                height: 40,
                p: 0,
                borderRadius: 3,
                bgcolor: 'primary.main',
                color: '#121212',
                '&:hover': {
                  bgcolor: 'primary.dark',
                },
                mx: 'auto',
                display: 'flex',
              }}
            >
              <AddIcon />
            </Button>
          </Tooltip>
        ) : (
          <Button
            variant="contained"
            fullWidth
            startIcon={<AddIcon />}
            onClick={onAddExpense}
            sx={{
              py: 1.75,
              fontWeight: 700,
              fontSize: '0.9375rem',
              textTransform: 'none',
              borderRadius: 3,
              bgcolor: 'primary.main',
              color: '#121212',
              '&:hover': {
                bgcolor: 'primary.dark',
              },
            }}
          >
            Deploy Damage
          </Button>
        )}
      </Box>

      {/* User Section */}
      <Box
        sx={{
          p: collapsed ? 2 : 3,
          borderTop: '1px solid',
          borderColor: 'divider',
          flexShrink: 0,
          bgcolor: 'background.default',
        }}
      >
        {collapsed ? (
          <Tooltip title={displayName} placement="right">
            <Box sx={{ display: 'flex', justifyContent: 'center' }}>
              <Avatar
                sx={{
                  width: 36,
                  height: 36,
                  bgcolor: 'action.disabledBackground',
                  color: 'text.primary',
                  fontSize: '0.875rem',
                  fontWeight: 700,
                  border: '2px solid',
                  borderColor: 'divider',
                }}
              >
                {initials}
              </Avatar>
            </Box>
          </Tooltip>
        ) : (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Avatar
              sx={{
                width: 40,
                height: 40,
                bgcolor: 'action.disabledBackground',
                color: 'text.primary',
                fontSize: '1rem',
                fontWeight: 700,
                border: '2px solid',
                borderColor: 'divider',
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
              <Typography variant="caption" color="text.disabled" sx={{ fontWeight: 500 }}>
                {userEmail}
              </Typography>
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
}

export default Sidebar;
