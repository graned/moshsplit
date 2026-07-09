import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { Box, Paper, Typography, Button, CircularProgress, List, ListItem, ListItemText, Divider, Container } from '@mui/material';
import { OpenInNew as OpenInNewIcon, ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { externalApi, ExternalSummaryResponse } from '../api/external';

const MOSHSPLIT_URL = import.meta.env.VITE_MOSHSPLIT_URL || 'http://moshsplit.localhost';
const API_TOKEN = import.meta.env.VITE_API_TOKEN || '';

interface LoginSession {
  email: string;
  displayName: string;
  accessToken: string;
  refreshToken: string;
  userId: string;
}

function SummaryPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<LoginSession | null>(null);
  const [summary, setSummary] = useState<ExternalSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    // Restore session from localStorage
    const stored = localStorage.getItem('test-login-session');
    if (!stored) {
      navigate('/login');
      return;
    }

    try {
      const parsed = JSON.parse(stored) as LoginSession;
      setSession(parsed);
    } catch {
      navigate('/login');
    }
  }, [navigate]);

  useEffect(() => {
    if (!session) return;

    const fetchSummary = async () => {
      try {
        const data = await externalApi.getSummary(session.email);
        setSummary(data);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to fetch summary';
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    fetchSummary();
  }, [session]);

  const handleOpenMoshsplit = useCallback(async () => {
    if (!session) return;

    setRedirecting(true);
    try {
      const loginResponse = await externalApi.externalLogin({
        api_token: API_TOKEN,
        email: session.email,
        display_name: session.displayName,
      });

      const params = new URLSearchParams({
        access_token: loginResponse.access_token,
        refresh_token: loginResponse.refresh_token,
        user_id: loginResponse.user_id,
      });

      window.location.href = `${MOSHSPLIT_URL}/?${params.toString()}`;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'External login failed';
      setError(message);
      setRedirecting(false);
    }
  }, [session]);

  const handleLogout = () => {
    localStorage.removeItem('test-login-session');
    navigate('/login');
  };

  const formatCents = (cents: number) => {
    const euros = cents / 100;
    return new Intl.NumberFormat('en-EU', {
      style: 'currency',
      currency: 'EUR',
    }).format(euros);
  };

  if (!session) {
    return null;
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        p: 3,
        background: `
          linear-gradient(180deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.95) 100%)
        `,
      }}
    >
      <Container maxWidth="md">
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 4 }}>
          <Box>
            <Typography variant="h5" sx={{ color: 'primary.main', fontWeight: 700 }}>
              MoshSplit
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              External Login Test - Expense Summary
            </Typography>
          </Box>
          <Button
            variant="outlined"
            startIcon={<ArrowBackIcon />}
            onClick={handleLogout}
            sx={{ borderColor: 'rgba(255,255,255,0.2)', color: 'text.secondary' }}
          >
            Logout
          </Button>
        </Box>

        {/* User Info */}
        <Paper sx={{ p: 3, mb: 3, backgroundColor: 'rgba(30, 41, 59, 0.8)' }}>
          <Typography variant="h6" sx={{ mb: 1 }}>
            Logged in as
          </Typography>
          <Typography variant="body1" sx={{ color: 'text.primary', fontWeight: 500 }}>
            {session.email}
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {session.displayName}
          </Typography>
        </Paper>

        {/* Summary Content */}
        <Paper sx={{ p: 3, mb: 3, backgroundColor: 'rgba(30, 41, 59, 0.8)' }}>
          {loading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress sx={{ color: 'primary.main' }} />
            </Box>
          )}

          {error && !loading && (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="body1" sx={{ color: 'error.main', mb: 2 }}>
                {error}
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Make sure the pitboss-api is running and VITE_API_TOKEN is configured correctly.
              </Typography>
            </Box>
          )}

          {summary && !loading && (
            <>
              {/* Event Info */}
              <Box sx={{ mb: 3 }}>
                <Typography variant="overline" sx={{ color: 'text.secondary' }}>
                  Event
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 600 }}>
                  {summary.event_name}
                </Typography>
              </Box>

              <Divider sx={{ my: 2, borderColor: 'rgba(255,255,255,0.1)' }} />

              {/* Total Balance */}
              <Box sx={{ mb: 3 }}>
                <Typography variant="overline" sx={{ color: 'text.secondary' }}>
                  Total Balance
                </Typography>
                <Typography
                  variant="h3"
                  sx={{
                    fontWeight: 700,
                    color: summary.total_balance_cents >= 0 ? 'success.main' : 'error.main',
                  }}
                >
                  {formatCents(summary.total_balance_cents)}
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  {summary.total_balance_cents >= 0 ? 'You are owed' : 'You owe'}
                </Typography>
              </Box>

              <Divider sx={{ my: 2, borderColor: 'rgba(255,255,255,0.1)' }} />

              {/* Expenses List */}
              <Box>
                <Typography variant="overline" sx={{ color: 'text.secondary', mb: 2, display: 'block' }}>
                  Expenses
                </Typography>
                {summary.items.length === 0 ? (
                  <Typography variant="body2" sx={{ color: 'text.secondary', py: 2 }}>
                    No expenses recorded yet.
                  </Typography>
                ) : (
                  <List disablePadding>
                    {summary.items.map((item, index) => (
                      <ListItem
                        key={index}
                        disablePadding
                        sx={{
                          py: 1.5,
                          borderBottom: '1px solid rgba(255,255,255,0.05)',
                        }}
                      >
                        <ListItemText
                          primary={item.title}
                          primaryTypographyProps={{ fontWeight: 500 }}
                        />
                        <Typography variant="body1" sx={{ fontWeight: 600 }}>
                          {formatCents(item.amount_cents)}
                        </Typography>
                      </ListItem>
                    ))}
                  </List>
                )}
              </Box>
            </>
          )}
        </Paper>

        {/* Open Moshsplit Button */}
        <Box sx={{ textAlign: 'center' }}>
          <Button
            variant="contained"
            size="large"
            startIcon={<OpenInNewIcon />}
            onClick={handleOpenMoshsplit}
            disabled={redirecting || !session}
            sx={{
              minWidth: 250,
              minHeight: 56,
              backgroundColor: 'primary.main',
              color: '#121212',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              '&:hover': {
                backgroundColor: 'primary.dark',
              },
            }}
          >
            {redirecting ? 'Redirecting...' : 'Open Moshsplit'}
          </Button>
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1 }}>
            Calls /v1/auth/external-login and redirects to {MOSHSPLIT_URL}
          </Typography>
        </Box>
      </Container>
    </Box>
  );
}

export default SummaryPage;
