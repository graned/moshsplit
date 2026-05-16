import { Component, ErrorInfo, ReactNode } from 'react';
import { Box, Typography, Button, Card, alpha } from '@mui/material';
import { Error as ErrorIcon, Refresh as RefreshIcon } from '@mui/icons-material';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error);
    console.error('[ErrorBoundary] Component stack:', errorInfo.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <Card
          sx={{
            p: 4,
            mx: 'auto',
            maxWidth: 500,
            mt: 4,
            borderColor: (theme) => alpha(theme.palette.error.main, 0.3),
          }}
        >
          <Box sx={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <Box
              sx={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                backgroundColor: (theme) => alpha(theme.palette.error.main, 0.1),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ErrorIcon sx={{ fontSize: 32, color: 'error.main' }} />
            </Box>
            <Typography variant="h6" fontWeight={600}>
              Something went wrong
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 400 }}>
              {this.state.error?.message || 'An unexpected error occurred. Please try again.'}
            </Typography>
            <Button
              variant="contained"
              startIcon={<RefreshIcon />}
              onClick={this.handleRetry}
              sx={{ mt: 1 }}
            >
              Try Again
            </Button>
          </Box>
        </Card>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
