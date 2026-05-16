import { createTheme, alpha } from '@mui/material/styles';

declare module '@mui/material/styles' {
  interface Palette {
    accent: Palette['primary'];
    elevated: Palette['background'];
  }
  interface PaletteOptions {
    accent?: PaletteOptions['primary'];
    elevated?: PaletteOptions['background'];
  }
}

// Modern Heavy Metal design tokens
const colors = {
  background: '#121212',
  surface: '#1E1E1E',
  elevated: '#2A2A2A',
  primary: '#F59E0B',       // Amber - beer gold
  primaryLight: '#FBBF24',
  primaryDark: '#D97706',
  textPrimary: '#F3F4F6',
  textSecondary: '#9CA3AF',
  textMuted: '#6B7280',
  success: '#10b981',
  successLight: '#34d399',
  successDark: '#059669',
  error: '#ef4444',
  errorLight: '#f87171',
  errorDark: '#dc2626',
  warning: '#f59e0b',
  warningLight: '#fbbf24',
  warningDark: '#d97706',
  divider: alpha('#f8fafc', 0.08),
};

export const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: colors.primary,
      light: colors.primaryLight,
      dark: colors.primaryDark,
      contrastText: '#121212',
    },
    secondary: {
      main: colors.elevated,
      light: alpha('#f8fafc', 0.12),
      dark: colors.surface,
      contrastText: colors.textPrimary,
    },
    accent: {
      main: colors.primary,
      light: colors.primaryLight,
      dark: colors.primaryDark,
      contrastText: '#121212',
    },
    background: {
      default: colors.background,
      paper: colors.surface,
    },
    text: {
      primary: colors.textPrimary,
      secondary: colors.textSecondary,
    },
    success: {
      main: colors.success,
      light: colors.successLight,
      dark: colors.successDark,
    },
    error: {
      main: colors.error,
      light: colors.errorLight,
      dark: colors.errorDark,
    },
    warning: {
      main: colors.warning,
      light: colors.warningLight,
      dark: colors.warningDark,
    },
    divider: colors.divider,
  },
  typography: {
    fontFamily: '"Geist", "Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontWeight: 800,
      fontSize: '2.5rem',
      letterSpacing: '-0.03em',
      lineHeight: 1.1,
    },
    h2: {
      fontWeight: 700,
      fontSize: '2rem',
      letterSpacing: '-0.02em',
      lineHeight: 1.2,
    },
    h3: {
      fontWeight: 700,
      fontSize: '1.75rem',
      letterSpacing: '-0.01em',
      lineHeight: 1.25,
    },
    h4: {
      fontWeight: 600,
      fontSize: '1.5rem',
      letterSpacing: '-0.01em',
      lineHeight: 1.3,
    },
    h5: {
      fontWeight: 600,
      fontSize: '1.25rem',
      lineHeight: 1.35,
    },
    h6: {
      fontWeight: 600,
      fontSize: '1rem',
      lineHeight: 1.4,
    },
    body1: {
      fontSize: '0.9375rem',
      lineHeight: 1.6,
    },
    body2: {
      fontSize: '0.875rem',
      lineHeight: 1.5,
    },
    button: {
      textTransform: 'none',
      fontWeight: 600,
      fontSize: '0.9375rem',
      letterSpacing: '0.01em',
    },
    caption: {
      fontSize: '0.75rem',
      letterSpacing: '0.02em',
    },
  },
  spacing: 8,
  shape: {
    borderRadius: 12,
  },
  breakpoints: {
    values: {
      xs: 0,
      sm: 600,
      md: 960,
      lg: 1280,
      xl: 1920,
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          padding: '10px 24px',
          fontSize: '0.9375rem',
          fontWeight: 600,
          transition: 'all 0.2s ease',
        },
        contained: {
          boxShadow: 'none',
          '&:hover': {
            boxShadow: `0 4px 16px ${alpha(colors.primary, 0.35)}`,
            transform: 'translateY(-1px)',
          },
        },
        outlined: {
          borderWidth: '1.5px',
          '&:hover': {
            borderWidth: '1.5px',
            backgroundColor: alpha(colors.primary, 0.08),
          },
        },
        text: {
          '&:hover': {
            backgroundColor: alpha(colors.primary, 0.08),
          },
        },
      },
    },
    MuiTextField: {
      defaultProps: {
        variant: 'filled',
      },
      styleOverrides: {
        root: {
          '& .MuiFilledInput-root': {
            borderRadius: 10,
            backgroundColor: alpha('#f8fafc', 0.04),
            '&:hover': {
              backgroundColor: alpha('#f8fafc', 0.07),
            },
            '&.Mui-focused': {
              backgroundColor: alpha('#f8fafc', 0.07),
            },
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          borderRadius: 14,
          border: '1px solid',
          borderColor: colors.divider,
          backgroundColor: colors.surface,
          transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
          '&:hover': {
            borderColor: alpha(colors.primary, 0.2),
          },
        },
      },
    },
    MuiCardContent: {
      styleOverrides: {
        root: {
          padding: '20px 24px',
          '&:last-child': {
            paddingBottom: 20,
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 600,
          borderRadius: 8,
        },
      },
    },
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: colors.background,
          scrollbarWidth: 'thin',
          '&::-webkit-scrollbar': { width: 6, height: 6 },
          '&::-webkit-scrollbar-track': { bgcolor: 'transparent' },
          '&::-webkit-scrollbar-thumb': {
            bgcolor: alpha('#f8fafc', 0.15),
            borderRadius: 3,
          },
          '&::-webkit-scrollbar-thumb:hover': {
            bgcolor: alpha('#f8fafc', 0.25),
          },
          '& *::-webkit-scrollbar': { width: 6, height: 6 },
          '& *::-webkit-scrollbar-track': { bgcolor: 'transparent' },
          '& *::-webkit-scrollbar-thumb': {
            bgcolor: alpha('#f8fafc', 0.15),
            borderRadius: 3,
          },
          '& *::-webkit-scrollbar-thumb:hover': {
            bgcolor: alpha('#f8fafc', 0.25),
          },
        },
        // Geist font face fallback if not loaded via link
        '@font-face': [
          {
            fontFamily: 'Geist',
            fontStyle: 'normal',
            fontWeight: 400,
            src: 'local("Geist"), local("Geist-Regular")',
          },
          {
            fontFamily: 'Geist',
            fontStyle: 'normal',
            fontWeight: 500,
            src: 'local("Geist"), local("Geist-Medium")',
          },
          {
            fontFamily: 'Geist',
            fontStyle: 'normal',
            fontWeight: 600,
            src: 'local("Geist"), local("Geist-SemiBold")',
          },
          {
            fontFamily: 'Geist',
            fontStyle: 'normal',
            fontWeight: 700,
            src: 'local("Geist"), local("Geist-Bold")',
          },
          {
            fontFamily: 'Geist',
            fontStyle: 'normal',
            fontWeight: 800,
            src: 'local("Geist"), local("Geist-ExtraBold")',
          },
        ],
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: alpha(colors.background, 0.85),
          backdropFilter: 'blur(12px)',
          borderBottom: `1px solid ${colors.divider}`,
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundImage: 'none',
          backgroundColor: colors.background,
          borderRight: `1px solid ${colors.divider}`,
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          margin: '2px 8px',
          transition: 'all 0.15s ease',
        },
      },
    },
    MuiBottomNavigationAction: {
      styleOverrides: {
        root: {
          transition: 'all 0.2s ease',
          '&.Mui-selected': {
            color: colors.primary,
          },
        },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: {
          borderColor: colors.divider,
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          transition: 'all 0.15s ease',
          '&:hover': {
            backgroundColor: alpha('#f8fafc', 0.08),
          },
        },
      },
    },
    MuiAvatar: {
      styleOverrides: {
        root: {
          fontWeight: 600,
        },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: {
          borderRadius: 12,
          border: `1px solid ${colors.divider}`,
          backgroundColor: colors.elevated,
        },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          margin: '2px 8px',
          transition: 'background-color 0.15s ease',
        },
      },
    },
  },
});
