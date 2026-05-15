import { useMemo } from 'react';
import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  Chip,
  alpha,
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import {
  Receipt as ReceiptIcon,
  TrendingUp as SpentIcon,
  CurrencyExchange as TotalIcon,
  Group as GroupIcon,
} from '@mui/icons-material';

import { useAuthStore } from '@moshsplit/auth-react';
import { groupsApi } from '../../api/groups.api';
import { balancesApi } from '../../api/balances.api';

export default function ExpensesPage() {
  const navigate = useNavigate();
  const userId = useAuthStore((state) => state.userId);

  const { data: groupsData, isLoading: groupsLoading, error: groupsError } = useQuery({
    queryKey: ['groups', userId],
    queryFn: () => {
      if (!userId) throw new Error('User not authenticated');
      return groupsApi.list(userId);
    },
    enabled: !!userId,
  });

  const groups = groupsData?.data || [];

  const { data: balancesData, isLoading: balancesLoading } = useQuery({
    queryKey: ['expenses-page-balances', userId],
    queryFn: async () => {
      if (!userId) return {};
      const results = await Promise.allSettled(
        groups.map((g) => balancesApi.getUserBalance(g.id, userId))
      );
      const map: Record<string, { paid_cents: number; owes_cents: number; balance_cents: number }> = {};
      groups.forEach((g, i) => {
        const r = results[i];
        if (r.status === 'fulfilled') {
          map[g.id] = r.value;
        }
      });
      return map;
    },
    enabled: !!userId && groups.length > 0,
  });

  const groupBalances = useMemo(() => balancesData || {}, [balancesData]);

  const formatAmount = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'EUR',
    }).format(cents / 100);
  };

  const isLoading = groupsLoading || balancesLoading;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight={700}>
            My Expenses
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Track what you've spent across your events
          </Typography>
        </Box>
      </Box>

      {groupsError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Failed to load events
        </Alert>
      )}

      {isLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      )}

      {!isLoading && !groupsError && groups.length === 0 && (
        <Card>
          <CardContent sx={{ py: 8, textAlign: 'center' }}>
            <Box
              sx={{
                width: 80,
                height: 80,
                borderRadius: '50%',
                backgroundColor: 'primary.main',
                opacity: 0.1,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                mb: 3,
              }}
            >
              <ReceiptIcon sx={{ fontSize: 40, color: 'primary.main' }} />
            </Box>
            <Typography variant="h6" fontWeight={600} gutterBottom>
              No expenses yet
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Join an event to start tracking shared expenses.
            </Typography>
          </CardContent>
        </Card>
      )}

      {!isLoading && !groupsError && groups.length > 0 && (
        <Grid container spacing={2}>
          {groups.map((group) => {
            const bal = groupBalances[group.id];
            const userPaid = bal?.paid_cents || 0;
            const netBalance = bal?.balance_cents || 0;
            const isSettled = netBalance === 0;

            return (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={group.id}>
                <Card
                  sx={{
                    cursor: 'pointer',
                    transition: 'transform 0.2s, box-shadow 0.2s',
                    '&:hover': {
                      transform: 'translateY(-3px)',
                      boxShadow: 4,
                    },
                  }}
                  onClick={() => navigate(`/app/expenses/${group.id}`)}
                >
                  <CardContent sx={{ p: 3 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                      <Typography variant="h6" fontWeight={700} sx={{ lineHeight: 1.3 }}>
                        {group.name}
                      </Typography>
                      <Chip
                        label={group.status}
                        size="small"
                        color={group.status === 'active' ? 'success' : 'default'}
                        variant="outlined"
                      />
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                      <GroupIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                      <Typography variant="body2" color="text.secondary">
                        {group.member_count} {group.member_count === 1 ? 'participant' : 'participants'}
                      </Typography>
                    </Box>

                    {bal ? (
                      <Box
                        sx={{
                          mt: 2,
                          p: 1.5,
                          borderRadius: 2,
                          bgcolor: alpha(netBalance > 0 ? '#10b981' : netBalance < 0 ? '#ef4444' : '#6b7280', 0.1),
                          border: 1,
                          borderColor: alpha(netBalance > 0 ? '#10b981' : netBalance < 0 ? '#ef4444' : '#6b7280', 0.2),
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                          <SpentIcon sx={{ fontSize: 14, color: netBalance > 0 ? 'success.main' : netBalance < 0 ? 'error.main' : 'text.secondary' }} />
                          <Typography variant="caption" color="text.secondary">
                            You paid
                          </Typography>
                        </Box>
                        <Typography variant="h6" fontWeight={800} color={netBalance > 0 ? 'success.main' : netBalance < 0 ? 'error.main' : 'text.secondary'}>
                          {formatAmount(userPaid)}
                        </Typography>
                        {!isSettled && (
                          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                            {netBalance > 0
                              ? `Others owe you ${formatAmount(netBalance)}`
                              : `You owe ${formatAmount(Math.abs(netBalance))}`}
                          </Typography>
                        )}
                        {isSettled && (
                          <Typography variant="caption" color="success.main" sx={{ mt: 0.5, display: 'block', fontWeight: 600 }}>
                            All settled
                          </Typography>
                        )}
                      </Box>
                    ) : (
                      <Box sx={{ mt: 2, p: 1.5, borderRadius: 2, bgcolor: alpha('#6b7280', 0.05) }}>
                        <Typography variant="caption" color="text.secondary">
                          No expense data yet
                        </Typography>
                      </Box>
                    )}

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1.5 }}>
                      <TotalIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                      <Typography variant="caption" color="text.secondary">
                        {group.currency}
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}
    </Box>
  );
}
