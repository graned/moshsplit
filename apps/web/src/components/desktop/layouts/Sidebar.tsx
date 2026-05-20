import logo from '../../../assets/logo.svg';
import longLogo from '../../../assets/long-logo.svg';
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
  Tooltip,
  alpha,
  useTheme,
} from '@mui/material';
import {
  RssFeed as FeedIcon,
  ReceiptLong as ExpensesIcon,
  AccountBalanceWallet as BalancesIcon,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router';
import { useAuthStore } from '@moshsplit/auth-react';

interface NavItem {
  path: string;
  label: string;
  icon: React.ReactNode;
}

interface SidebarProps {
  eventId?: string;
  collapsed?: boolean;
}

function Sidebar({ eventId, collapsed = false }: SidebarProps) {
  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const { firstName, lastName, userEmail } = useAuthStore();

  const navItems: NavItem[] = [
    { path: `/app/web/events/${eventId}/feed`, label: 'Battle Log', icon: <FeedIcon /> },
    { path: `/app/web/events/${eventId}/expenses`, label: 'War Chest', icon: <ExpensesIcon /> },
    {
      path: `/app/web/events/${eventId}/balances`,
      label: 'Scales of War',
      icon: <BalancesIcon />,
    },
  ];

  const handleNavigation = (item: NavItem) => {
    if (eventId) {
      navigate(item.path);
    } else {
      navigate('/login');
    }
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
          alignItems: 'center',
          minHeight: 60,
          transition: theme.transitions.create(['padding', 'min-height'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.standard,
          }),
        }}
      >
        <Tooltip title="MoshSplit" placement="right">
          <Box
            component="img"
            src={logo}
            alt="MoshSplit"
            sx={{
              height: 32,
              width: 32,
              position: 'absolute',
              opacity: collapsed ? 1 : 0,
              transform: collapsed ? 'scale(1)' : 'scale(0.8)',
              transition: theme.transitions.create(['opacity', 'transform'], {
                easing: theme.transitions.easing.easeInOut,
                duration: theme.transitions.duration.standard,
              }),
              filter: `drop-shadow(0 0 8px ${alpha(theme.palette.primary.main, 0.3)})`,
            }}
          />
        </Tooltip>
        <Box
          component="img"
          src={longLogo}
          alt="MoshSplit"
          sx={{
            height: 110,
            width: 'auto',
            opacity: collapsed ? 0 : 1,
            transform: collapsed ? 'scale(0.8)' : 'scale(1)',
            transition: theme.transitions.create(['opacity', 'transform'], {
              easing: theme.transitions.easing.easeInOut,
              duration: theme.transitions.duration.standard,
            }),
            filter: `drop-shadow(0 0 8px ${alpha(theme.palette.primary.main, 0.3)})`,
          }}
        />
      </Box>

      <Divider sx={{ borderColor: 'divider', mx: 2 }} />

      {/* Navigation */}
      <List sx={{ py: 2, px: collapsed ? 1 : 2, flex: '1 0 auto' }}>
        {navItems.map((item) => {
          const activePath = item.path;
          const isSelected = location.pathname === activePath || location.pathname.startsWith(activePath + '/');
          return (
            <ListItem key={item.path} disablePadding sx={{ mb: 0.5 }}>
              <Tooltip title={collapsed ? item.label : undefined} placement="right" disableHoverListener={!collapsed}>
                <ListItemButton
                  selected={isSelected}
                  onClick={() => handleNavigation(item)}
                  sx={{
                    borderRadius: 3,
                    py: 1.5,
                    px: collapsed ? 1 : 2,
                    justifyContent: collapsed ? 'center' : 'flex-start',
                    bgcolor: isSelected ? alpha(theme.palette.primary.main, 0.08) : 'transparent',
                    border: isSelected ? '1px solid' : '1px solid transparent',
                    borderColor: isSelected ? 'divider' : 'transparent',
                    transition: theme.transitions.create(['padding', 'background-color', 'border-color', 'justify-content'], {
                      easing: theme.transitions.easing.sharp,
                      duration: theme.transitions.duration.standard,
                    }),
                    '&:hover': {
                      bgcolor: alpha(theme.palette.primary.main, 0.05),
                    },
                  }}
                >
                  <ListItemIcon
                    sx={{
                      minWidth: collapsed ? 'auto' : 36,
                      color: isSelected ? 'primary.main' : 'text.secondary',
                      transition: theme.transitions.create('min-width', {
                        easing: theme.transitions.easing.sharp,
                        duration: theme.transitions.duration.standard,
                      }),
                    }}
                  >
                    {item.icon}
                  </ListItemIcon>
                  <Box
                    sx={{
                      opacity: collapsed ? 0 : 1,
                      width: collapsed ? 0 : 'auto',
                      overflow: 'hidden',
                      whiteSpace: 'nowrap',
                      transform: collapsed ? 'translateX(-8px)' : 'translateX(0)',
                      transition: theme.transitions.create(['opacity', 'transform', 'width'], {
                        easing: theme.transitions.easing.easeInOut,
                        duration: 400,
                      }),
                    }}
                  >
                    <ListItemText
                      primary={item.label}
                      primaryTypographyProps={{
                        fontSize: '0.9375rem',
                        fontWeight: isSelected ? 700 : 500,
                        color: isSelected ? 'text.primary' : 'text.secondary',
                      }}
                    />
                  </Box>
                </ListItemButton>
              </Tooltip>
            </ListItem>
          );
        })}
      </List>

      {/* User Section */}
      <Box
        sx={{
          p: collapsed ? 2 : 3,
          borderTop: '1px solid',
          borderColor: 'divider',
          flexShrink: 0,
          bgcolor: 'background.default',
          display: 'flex',
          justifyContent: collapsed ? 'center' : 'flex-start',
          transition: theme.transitions.create(['padding', 'justify-content'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.standard,
          }),
        }}
      >
        <Tooltip title={collapsed ? displayName : undefined} placement="right" disableHoverListener={!collapsed}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, justifyContent: collapsed ? 'center' : 'flex-start' }}>
            <Avatar
              sx={{
                width: collapsed ? 36 : 40,
                height: collapsed ? 36 : 40,
                bgcolor: 'action.disabledBackground',
                color: 'text.primary',
                fontSize: collapsed ? '0.875rem' : '1rem',
                fontWeight: 700,
                border: '2px solid',
                borderColor: 'divider',
                transition: theme.transitions.create(['width', 'height', 'fontSize'], {
                  easing: theme.transitions.easing.sharp,
                  duration: theme.transitions.duration.standard,
                }),
              }}
            >
              {initials}
            </Avatar>
            <Box
              sx={{
                flex: 1,
                minWidth: 0,
                opacity: collapsed ? 0 : 1,
                width: collapsed ? 0 : 'auto',
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                transform: collapsed ? 'translateX(-8px)' : 'translateX(0)',
                transition: theme.transitions.create(['opacity', 'transform', 'width'], {
                  easing: theme.transitions.easing.easeInOut,
                  duration: 400,
                }),
                pointerEvents: collapsed ? 'none' : 'auto',
                position: collapsed ? 'absolute' : 'relative',
              }}
            >
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
        </Tooltip>
      </Box>
    </Box>
  );
}

export default Sidebar;
