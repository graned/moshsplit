import { createTheme } from '@mui/material/styles';

export const moshSplitTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#F59E0B', // amber-500
      light: '#FBBF24', // amber-400
      dark: '#D97706', // amber-600
      contrastText: '#121212',
    },
    secondary: {
      main: '#1F2937', // gray-800
      light: '#374151', // gray-700
      dark: '#111827', // gray-900
    },
    background: {
      default: '#0f172a', // slate-900
      paper: '#1e293b', // slate-800
    },
    text: {
      primary: '#f8fafc', // slate-50
      secondary: '#94a3b8', // slate-400
    },
    error: {
      main: '#ef4444', // red-500
    },
    success: {
      main: '#22c55e', // green-500
    },
    warning: {
      main: '#F59E0B', // amber-500
    },
    info: {
      main: '#3b82f6', // blue-500
    },
  },
  typography: {
    fontFamily: '"Space Grotesk", "Inter", system-ui, sans-serif',
    h1: {
      fontWeight: 700,
    },
    h2: {
      fontWeight: 600,
    },
    h3: {
      fontWeight: 600,
    },
    h4: {
      fontWeight: 600,
    },
    h5: {
      fontWeight: 500,
    },
    h6: {
      fontWeight: 500,
    },
    button: {
      textTransform: 'none',
      fontWeight: 600,
    },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 4,
          padding: '10px 20px',
        },
        contained: {
          boxShadow: 'none',
          '&:hover': {
            boxShadow: '0 0 20px rgba(245, 158, 11, 0.3)',
          },
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiFilledInput-root': {
            backgroundColor: 'rgba(255, 255, 255, 0.04)',
            borderRadius: '4px',
            '&:hover': {
              backgroundColor: 'rgba(255, 255, 255, 0.06)',
            },
            '&.Mui-focused': {
              backgroundColor: 'rgba(255, 255, 255, 0.06)',
              boxShadow: '0 0 0 2px rgba(245, 158, 11, 0.3)',
            },
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(30, 41, 59, 0.8)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.05)',
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
  },
});
