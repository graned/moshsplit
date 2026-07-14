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
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  RssFeed as FeedIcon,
  ReceiptLong as ExpensesIcon,
  SwapHoriz as SettleIcon,
  Language as LanguageIcon,
  Check as CheckIcon,
} from '@mui/icons-material';
import { useNavigate, useLocation, useParams } from 'react-router';
import { useAuthStore } from '@moshsplit/auth-react';
import { useTranslation } from 'react-i18next';

declare const __APP_VERSION__: string;

const LANGUAGES = [
  { code: 'en', label: 'English', nativeName: 'English' },
  { code: 'pt', label: 'Portuguese', nativeName: 'Português' },
  { code: 'es', label: 'Spanish', nativeName: 'Español' },
];

function MobileBottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { eventId } = useParams<{ eventId: string }>();
  const { firstName, lastName, userEmail, avatarUrl, clearTokens } = useAuthStore();
  const { t, i18n } = useTranslation();

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [languageAnchorEl, setLanguageAnchorEl] = useState<null | HTMLElement>(null);

  const navItems = eventId
    ? [
      { path: `/app/mobile/events/${eventId}/log`, label: t('components.bottomNav.feed'), icon: <FeedIcon /> },
      { path: `/app/mobile/events/${eventId}/warchest`, label: t('components.bottomNav.warchest'), icon: <ExpensesIcon /> },
      { path: `/app/mobile/events/${eventId}/settle`, label: t('components.bottomNav.settle'), icon: <SettleIcon /> },
    ]
    : [];

  const handleNavigation = (path: string) => {
    navigate(path);
  };

  const handleProfileOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleProfileClose = () => {
    setAnchorEl(null);
    setLanguageAnchorEl(null);
  };

  const handleLanguageOpen = (event: React.MouseEvent<HTMLElement>) => {
    setLanguageAnchorEl(event.currentTarget);
  };

  const handleLanguageClose = () => {
    setLanguageAnchorEl(null);
  };

  const handleLanguageSelect = (langCode: string) => {
    i18n.changeLanguage(langCode);
    localStorage.setItem('moshsplit_language', langCode);
    handleLanguageClose();
  };

  const handleLogout = () => {
    handleProfileClose();
    clearTokens();
    const externalUrl = import.meta.env.VITE_EXTERNAL_APP_URL;
    if (externalUrl) {
      window.location.href = externalUrl;
    } else {
      // Save current URL to return to after login
      sessionStorage.setItem('moshsplit_return_to', location.pathname);
      navigate('/login');
    }
  };

  const initials = firstName?.charAt(0)?.toUpperCase() || userEmail?.charAt(0)?.toUpperCase() || '?';
  const displayName = firstName && lastName ? `${firstName} ${lastName}` : userEmail || 'User';

  return (
    <>
      <Paper
        elevation={0}
        sx={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: (t) => t.zIndex.appBar,
          backgroundColor: '#1A1A1A',
          borderTop: '1px solid',
          borderColor: 'divider',
          height: 'calc(64px + env(safe-area-inset-bottom, 0px))',
          boxSizing: 'border-box',
        }}
      >
        <BottomNavigation
          value={location.pathname}
          onChange={(_, newValue: string) => {
            if (newValue === 'profile') {
              handleProfileOpen({
                currentTarget: document.getElementById('mobile-profile-btn')!,
              } as React.MouseEvent<HTMLElement>);
            } else {
              handleNavigation(newValue);
            }
          }}
          showLabels
          sx={{
            height: 64,
            '& .MuiBottomNavigationAction-root': {
              minWidth: 0,
              padding: '8px 4px',
              color: 'text.secondary',
              transition: 'color 0.2s ease',
              '&.Mui-selected': {
                color: 'primary.main',
              },
            },
            '& .MuiBottomNavigationAction-label': {
              fontSize: '0.7rem',
              transition: 'font-size 0.2s ease',
              '&.Mui-selected': {
                fontSize: '0.7rem',
                fontWeight: 700,
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
                    width: 24,
                    height: 24,
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

          <BottomNavigationAction
            id="mobile-profile-btn"
            value="profile"
            label={t('components.bottomNav.profile')}
            icon={
              <Avatar
                src={avatarUrl || undefined}
                sx={{
                  width: 26,
                  height: 26,
                  bgcolor: avatarUrl ? 'transparent' : 'primary.main',
                  color: '#121212',
                  fontSize: '0.6875rem',
                  fontWeight: 700,
                }}
              >
                {!avatarUrl && initials}
              </Avatar>
            }
          />
        </BottomNavigation>
      </Paper>

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
            bgcolor: '#1E1E1E',
            border: '1px solid',
            borderColor: 'divider',
          },
        }}
      >
        <Box sx={{ px: 2, py: 1 }}>
          <Typography variant="subtitle2" fontWeight={600} color="text.primary">
            {displayName}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {userEmail}
          </Typography>
          <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 0.25, fontSize: '0.6rem' }}>
            v{__APP_VERSION__}
          </Typography>
        </Box>
        <Divider sx={{ my: 1, borderColor: 'divider' }} />
        <MenuItem onClick={handleLanguageOpen} sx={{ color: 'text.secondary' }}>
          <ListItemIcon>
            <LanguageIcon fontSize="small" sx={{ color: 'text.secondary' }} />
          </ListItemIcon>
          <ListItemText>{t('components.profileMenu.language', 'Language')}</ListItemText>
        </MenuItem>
        <Divider sx={{ my: 0.5, borderColor: 'divider' }} />
        <MenuItem onClick={handleLogout} sx={{ color: 'text.primary' }}>
          <ListItemIcon>
            <ArrowBackIcon fontSize="small" sx={{ color: 'text.secondary' }} />
          </ListItemIcon>
          <ListItemText>{import.meta.env.VITE_EXTERNAL_APP_NAME || 'Back to App'}</ListItemText>
        </MenuItem>
      </Menu>

      <Menu
        anchorEl={languageAnchorEl}
        open={Boolean(languageAnchorEl)}
        onClose={handleLanguageClose}
        transformOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'top' }}
        PaperProps={{
          sx: {
            mb: 1,
            minWidth: 160,
            bgcolor: '#1E1E1E',
            border: '1px solid',
            borderColor: 'divider',
          },
        }}
      >
        {LANGUAGES.map((lang) => (
          <MenuItem
            key={lang.code}
            onClick={() => handleLanguageSelect(lang.code)}
            sx={{
              color: i18n.language === lang.code ? 'primary.main' : 'text.secondary',
              fontWeight: i18n.language === lang.code ? 600 : 400,
            }}
          >
            <ListItemText>{lang.nativeName}</ListItemText>
            {i18n.language === lang.code && (
              <CheckIcon fontSize="small" sx={{ color: 'primary.main', ml: 1 }} />
            )}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}

export default MobileBottomNav;
