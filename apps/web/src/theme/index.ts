import { createTheme, alpha } from '@mui/material/styles';

declare module '@mui/material/styles' {
  interface Palette {
    accent: Palette['primary'];
    elevated: Palette['primary'];
    surface: {
      low: string;
      lowest: string;
    };
  }
  interface PaletteOptions {
    accent?: PaletteOptions['primary'];
    elevated?: PaletteOptions['primary'];
    surface?: {
      low?: string;
      lowest?: string;
    };
  }
}

// Stitch Design System — "High-End Underground" Matte Minimalism
// Colors from DESIGN.md: surface #131313, primary #ffc174, on-surface #e5e2e1
const colors = {
  background: '#131313',
  surface: '#201f1f',
  surfaceLow: '#1c1b1b',
  surfaceLowest: '#0e0e0e',
  elevated: '#2a2a2a',
  elevatedHighest: '#353534',
  primary: '#ffc174',
  primaryLight: '#ffd79b',
  primaryDark: '#f59e0b',
  primaryContainer: '#f59e0b',
  onPrimaryContainer: '#613b00',
  textPrimary: '#e5e2e1',
  textSecondary: '#d8c3ad',
  textMuted: '#6B7280',
  success: '#10b981',
  successLight: '#34d399',
  successDark: '#059669',
  error: '#ffb4ab',
  errorLight: '#f87171',
  errorDark: '#dc2626',
  warning: '#f59e0b',
  warningLight: '#fbbf24',
  warningDark: '#d97706',
  outlineVariant: '#534434',
  divider: alpha('#534434', 0.2),
};

export const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: colors.primary,
      light: colors.primaryLight,
      dark: colors.primaryDark,
      contrastText: colors.onPrimaryContainer,
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
      contrastText: colors.onPrimaryContainer,
    },
    elevated: {
      main: colors.elevated,
      light: alpha('#f8fafc', 0.12),
      dark: colors.surface,
      contrastText: colors.textPrimary,
    },
    background: {
      default: colors.background,
      paper: colors.surface,
    },
    surface: {
      low: colors.surfaceLow,
      lowest: colors.surfaceLowest,
    },
    action: {
      selected: alpha(colors.primary, 0.08),
      disabledBackground: alpha('#f8fafc', 0.08),
    },
    text: {
      primary: colors.textPrimary,
      secondary: colors.textSecondary,
      disabled: colors.textMuted,
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
    fontFamily: '"Space Grotesk", "Geist", "Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontFamily: '"Space Grotesk", sans-serif',
      fontWeight: 700,
      fontSize: '3rem',
      letterSpacing: '-0.02em',
      lineHeight: 1.1,
    },
    h2: {
      fontFamily: '"Space Grotesk", sans-serif',
      fontWeight: 600,
      fontSize: '2rem',
      letterSpacing: '-0.01em',
      lineHeight: 1.2,
    },
    h3: {
      fontFamily: '"Space Grotesk", sans-serif',
      fontWeight: 600,
      fontSize: '1.5rem',
      letterSpacing: '-0.01em',
      lineHeight: 1.25,
    },
    h4: {
      fontFamily: '"Space Grotesk", sans-serif',
      fontWeight: 600,
      fontSize: '1.25rem',
      lineHeight: 1.3,
    },
    h5: {
      fontFamily: '"Space Grotesk", sans-serif',
      fontWeight: 600,
      fontSize: '1.125rem',
      lineHeight: 1.35,
    },
    h6: {
      fontFamily: '"Space Grotesk", sans-serif',
      fontWeight: 600,
      fontSize: '1rem',
      lineHeight: 1.4,
    },
    body1: {
      fontFamily: '"Inter", sans-serif',
      fontSize: '1rem',
      lineHeight: 1.5,
    },
    body2: {
      fontFamily: '"Inter", sans-serif',
      fontSize: '0.875rem',
      lineHeight: 1.43,
    },
    button: {
      fontFamily: '"Space Grotesk", sans-serif',
      textTransform: 'none',
      fontWeight: 700,
      fontSize: '0.75rem',
      letterSpacing: '0.05em',
    },
    caption: {
      fontFamily: '"JetBrains Mono", monospace',
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
          fontSize: '0.75rem',
          fontWeight: 700,
          letterSpacing: '0.05em',
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
          borderRadius: 12,
          border: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: 'inset 0 1px 1px rgba(255, 255, 255, 0.05)',
          backgroundColor: colors.surface,
          transition: 'border-color 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease',
          '&:hover': {
            borderColor: alpha(colors.primary, 0.3),
            backgroundColor: colors.elevated,
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
        '@font-face': [
          {
            fontFamily: 'Space Grotesk',
            fontStyle: 'normal',
            fontWeight: 400,
            src: 'local("Space Grotesk"), local("SpaceGrotesk-Regular")',
          },
          {
            fontFamily: 'Space Grotesk',
            fontStyle: 'normal',
            fontWeight: 500,
            src: 'local("Space Grotesk Medium"), local("SpaceGrotesk-Medium")',
          },
          {
            fontFamily: 'Space Grotesk',
            fontStyle: 'normal',
            fontWeight: 600,
            src: 'local("Space Grotesk SemiBold"), local("SpaceGrotesk-SemiBold")',
          },
          {
            fontFamily: 'Space Grotesk',
            fontStyle: 'normal',
            fontWeight: 700,
            src: 'local("Space Grotesk Bold"), local("SpaceGrotesk-Bold")',
          },
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
          {
            fontFamily: 'JetBrains Mono',
            fontStyle: 'normal',
            fontWeight: 400,
            src: 'local("JetBrains Mono"), local("JetBrainsMono-Regular")',
          },
          {
            fontFamily: 'JetBrains Mono',
            fontStyle: 'normal',
            fontWeight: 500,
            src: 'local("JetBrains Mono Medium"), local("JetBrainsMono-Medium")',
          },
          {
            fontFamily: 'JetBrains Mono',
            fontStyle: 'normal',
            fontWeight: 600,
            src: 'local("JetBrains Mono SemiBold"), local("JetBrainsMono-SemiBold")',
          },
          {
            fontFamily: 'JetBrains Mono',
            fontStyle: 'normal',
            fontWeight: 700,
            src: 'local("JetBrains Mono Bold"), local("JetBrainsMono-Bold")',
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
