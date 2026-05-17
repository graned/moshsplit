import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Box, Typography, Button, CircularProgress, Alert, alpha, useTheme } from '@mui/material';
import Grid from '@mui/material/Grid2';
import { Add as AddIcon } from '@mui/icons-material';

import { useAuthStore } from '@moshsplit/auth-react';
import { groupsApi } from '../../api/groups.api';
import { balancesApi } from '../../api/balances.api';
import { usersApi } from '../../api/users.api';
import { ExpenseFeed } from '../../components/expenses/ExpenseFeed';
import { AddExpenseDialog } from '../../components/expenses/AddExpenseDialog';
import { FilterChips } from '../../components/expenses/FilterChips';
import { LiveIntelSidebar } from '../../components/expenses/LiveIntelSidebar';

export default function ExpenseReportPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const userId = useAuthStore((state) => state.userId);

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<string>();
  const theme = useTheme();

  const {
    data: event,
    isLoading: eventLoading,
    error: eventError,
  } = useQuery({
    queryKey: ['event', eventId],
    queryFn: async () => {
      if (!eventId) throw new Error('No event ID');
      return groupsApi.get(eventId);
    },
    enabled: !!eventId,
  });

  const { data: members = [], isLoading: membersLoading } = useQuery({
    queryKey: ['event-members', eventId],
    queryFn: () => groupsApi.listMembers(eventId!),
    enabled: !!eventId,
  });

  const { data: explainData, isLoading: explainLoading } = useQuery({
    queryKey: ['expense-report-explain', eventId, userId],
    queryFn: () => balancesApi.explainUserBalance(eventId!, userId!),
    enabled: !!eventId && !!userId,
  });

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['event-stats', eventId, userId],
    queryFn: () => balancesApi.getStats(eventId!, userId!),
    enabled: !!eventId && !!userId,
    staleTime: 1000 * 60 * 5,
  });

  const memberUserIds = useMemo(() => members.map((m) => m.user_id), [members]);

  const { data: userMap = {} } = useQuery({
    queryKey: ['expense-users', ...memberUserIds],
    queryFn: () => usersApi.getMany(memberUserIds),
    enabled: memberUserIds.length > 0,
  });

  const isLoading = eventLoading || membersLoading || explainLoading;
  const currency = event?.currency || 'EUR';

  const handleTypeChange = (type?: string) => {
    setSelectedType(type);
  };

  if (eventError && !event) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">Failed to load event</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh' }}>
      {/* Sticky Header */}
      <Box
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          bgcolor: alpha('#131313', 0.85),
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid',
          borderColor: alpha('#534434', 0.1),
        }}
      >
        <Box sx={{ maxWidth: 1280, mx: 'auto', px: { xs: 2, md: 3 }, py: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Box>
              <Typography
                sx={{
                  fontSize: { xs: '1.5rem', md: '2rem' },
                  fontWeight: 700,
                  color: 'primary.main',
                  letterSpacing: '-0.02em',
                  lineHeight: 1.2,
                }}
              >
                War Chest
              </Typography>
              <Typography
                sx={{
                  fontSize: '0.875rem',
                  color: 'text.secondary',
                  mt: 0.25,
                }}
              >
                Real-time expenditure tracking for {event?.name || 'this event'}
              </Typography>
            </Box>
            {!isLoading && (
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setAddDialogOpen(true)}
                sx={{
                  py: 1.25,
                  px: 2,
                  fontWeight: 700,
                  fontSize: '0.75rem',
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  borderRadius: 3,
                }}
              >
                Deploy Damage
              </Button>
            )}
          </Box>

          {/* Filter Chips */}
          <FilterChips selectedType={selectedType} onTypeChange={handleTypeChange} />
        </Box>
      </Box>

      {/* Summary Bar */}
      {!isLoading && explainData && (
        <Box
          sx={{
            bgcolor: 'background.default',
            borderBottom: '1px solid',
            borderColor: alpha('#534434', 0.1),
          }}
        >
          <Box sx={{ maxWidth: 1280, mx: 'auto', px: { xs: 2, md: 3 }, py: 2 }}>
            <Box sx={{ display: 'flex', gap: 2 }}>
              {[
                { value: explainData.paid_cents, label: 'You Paid', color: 'primary.main' },
                { value: explainData.owes_cents, label: 'My Share', color: 'text.primary' },
                {
                  value: explainData.balance_cents,
                  label: explainData.balance_cents >= 0 ? 'Getting Back' : 'You Owe',
                  color: explainData.balance_cents >= 0 ? 'success.main' : 'error.main',
                },
              ].map((item) => (
                <Box
                  key={item.label}
                  sx={{
                    flex: 1,
                    textAlign: 'center',
                    py: 2,
                    px: 1,
                    borderRadius: 3,
                    bgcolor: 'background.paper',
                    border: 1,
                    borderColor: 'divider',
                  }}
                >
                  <Typography fontWeight={800} color={item.color} sx={{ fontSize: '1.5rem', lineHeight: 1 }}>
                    {formatAmount(item.value, currency)}
                  </Typography>
                  <Typography color="text.secondary" sx={{ fontSize: '0.65rem', mt: 0.5, fontWeight: 600 }}>
                    {item.label}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>
        </Box>
      )}

      {/* Main Content: Feed + Sidebar */}
      <Box sx={{ maxWidth: 1280, mx: 'auto', px: { xs: 2, md: 3 }, py: 3 }}>
        <Grid container spacing={3}>
          {/* Left: Expense Feed */}
          <Grid size={{ xs: 12, lg: 8 }}>
            {isLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                <CircularProgress />
              </Box>
            ) : (
              <ExpenseFeed
                eventId={eventId!}
                userId={userId!}
                currency={currency}
                userMap={userMap}
                expenseType={selectedType}
                emptyState={
                  <Box
                    sx={{
                      textAlign: 'center',
                      py: 8,
                      bgcolor: 'background.paper',
                      borderRadius: 3,
                      border: '1px solid',
                      borderColor: alpha('#534434', 0.1),
                    }}
                  >
                    <Box
                      sx={{
                        width: 80,
                        height: 80,
                        borderRadius: '50%',
                        bgcolor: alpha(theme.palette.primary.main, 0.08),
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mb: 3,
                      }}
                    >
                      <Typography sx={{ fontSize: '2.5rem' }}>🔥</Typography>
                    </Box>
                    <Typography variant="h6" fontWeight={600} gutterBottom>
                      No loot in the chest yet
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 320, mx: 'auto' }}>
                      The mosh pit is empty. Deploy some damage and the war chest will come alive.
                    </Typography>
                    <Button
                      variant="contained"
                      startIcon={<AddIcon />}
                      onClick={() => setAddDialogOpen(true)}
                      sx={{ mt: 3 }}
                    >
                      Add the first expense
                    </Button>
                  </Box>
                }
              />
            )}
          </Grid>

          {/* Right: Live Intel Sidebar */}
          <Grid size={{ xs: 12, lg: 4 }}>
            <Box
              sx={{
                position: { xs: 'static', lg: 'sticky' },
                top: { lg: 24 },
              }}
            >
              <LiveIntelSidebar
                eventId={eventId!}
                userId={userId!}
                stats={stats}
                statsLoading={statsLoading}
                members={members}
                currency={currency}
                onViewAuditLog={() => navigate(`/app/events/${eventId}/feed`)}
              />
            </Box>
          </Grid>
        </Grid>
      </Box>

      {/* Add Expense Dialog */}
      {eventId && (
        <AddExpenseDialog
          open={addDialogOpen}
          onClose={() => setAddDialogOpen(false)}
          eventId={eventId}
          members={members}
          currentUser={userMap[userId || ''] || { id: userId || '', firstName: '', lastName: '', email: '' }}
          groupCurrency={currency}
        />
      )}
    </Box>
  );
}

function formatAmount(cents: number, currency = 'EUR') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(cents / 100);
}
