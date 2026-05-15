import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  Tabs,
  Tab,
  alpha,
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import {
  Receipt as ReceiptIcon,
  AccountBalanceWallet as WalletIcon,
  TrendingUp as TrendingUpIcon,
  ListAlt as ListIcon,
} from '@mui/icons-material';

import { useAuthStore } from '@moshsplit/auth-react';
import { groupsApi, GroupListItem } from '../../api/groups.api';
import { balancesApi } from '../../api/balances.api';

const formatAmount = (cents: number, currency = 'EUR') => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(cents / 100);
};

interface ExpenseCardData {
  group: GroupListItem;
  paidCents: number;
  balanceCents: number;
  expenseCount: number;
  currency: string;
}

function ExpenseCard({ data, onClick }: { data: ExpenseCardData; onClick: () => void }) {
  const { group, paidCents, balanceCents, expenseCount, currency } = data;
  const hasData = paidCents > 0 || expenseCount > 0;

  return (
    <Card
      sx={{
        cursor: 'pointer',
        transition: 'transform 0.2s, box-shadow 0.2s',
        borderRadius: 3,
        overflow: 'hidden',
        '&:hover': {
          transform: { md: 'translateY(-4px)' },
          boxShadow: { md: '0 8px 24px rgba(0,0,0,0.3)' },
        },
      }}
      onClick={onClick}
    >
      {/* ===== MOBILE: horizontal layout ===== */}
      <Box sx={{ display: { xs: 'flex', md: 'none' }, minHeight: 110 }}>
        <Box
          sx={{
            width: 100,
            position: 'relative',
            overflow: 'hidden',
            background: `linear-gradient(135deg, ${alpha('#F59E0B', 0.4)} 0%, ${alpha('#D97706', 0.6)} 100%)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Box sx={{
            position: 'absolute', inset: 0,
            background: `linear-gradient(to right, transparent 40%, ${alpha('#1E1E1E', 0.95)} 100%)`,
          }} />
          <ReceiptIcon sx={{ fontSize: 40, color: alpha('#fff', 0.3), zIndex: 0 }} />
        </Box>

        <Box sx={{ display: 'flex', flex: 1, minWidth: 0, p: 1.5 }}>
          <Box sx={{ flex: 1, minWidth: 0, pr: 1 }}>
            <Typography variant="subtitle1" fontWeight={700} sx={{ lineHeight: 1.3 }}>
              {group.name}
            </Typography>
          </Box>

          <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
            <Typography variant="body1" fontWeight={700} color="primary.main" sx={{ lineHeight: 1.2 }}>
              {hasData ? formatAmount(paidCents, currency) : '—'}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.2, display: 'block', whiteSpace: 'nowrap' }}>
              You Paid
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* ===== DESKTOP: vertical layout ===== */}
      <Box sx={{ display: { xs: 'none', md: 'block' } }}>
        <Box
          sx={{
            height: 200,
            background: `linear-gradient(135deg, ${alpha('#F59E0B', 0.4)} 0%, ${alpha('#D97706', 0.6)} 100%)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
          }}
        >
          <Box sx={{
            position: 'absolute', inset: 0,
            background: `linear-gradient(to bottom, transparent 40%, ${alpha('#1E1E1E', 0.95)} 100%)`,
          }} />
          <ReceiptIcon sx={{ fontSize: 80, color: alpha('#fff', 0.2), zIndex: 0 }} />
        </Box>

        <CardContent sx={{ p: 4, '&:last-child': { pb: 4 } }}>
          <Typography variant="h4" fontWeight={700} sx={{ mb: 3 }}>
            {group.name}
          </Typography>

          {/* Three stat columns */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            {/* You Paid */}
            <Box sx={{ textAlign: 'center', flex: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, mb: 0.5 }}>
                <WalletIcon sx={{ fontSize: 18, color: 'primary.main' }} />
                <Typography variant="h4" fontWeight={800} color="primary.main" sx={{ lineHeight: 1 }}>
                  {hasData ? formatAmount(paidCents, currency) : '—'}
                </Typography>
              </Box>
              <Typography variant="caption" color="text.secondary" fontWeight={600}>
                You Paid
              </Typography>
            </Box>

            {/* My Expenses */}
            <Box sx={{ textAlign: 'center', flex: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, mb: 0.5 }}>
                <ListIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                <Typography variant="h4" fontWeight={800} sx={{ lineHeight: 1 }}>
                  {hasData ? expenseCount : '—'}
                </Typography>
              </Box>
              <Typography variant="caption" color="text.secondary" fontWeight={600}>
                My Expenses
              </Typography>
            </Box>

            {/* Balance */}
            <Box sx={{ textAlign: 'center', flex: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, mb: 0.5 }}>
                <TrendingUpIcon sx={{ fontSize: 18, color: balanceCents >= 0 ? 'success.main' : 'error.main' }} />
                <Typography variant="h4" fontWeight={800} color={balanceCents >= 0 ? 'success.main' : 'error.main'} sx={{ lineHeight: 1 }}>
                  {hasData ? formatAmount(balanceCents, currency) : '—'}
                </Typography>
              </Box>
              <Typography variant="caption" color="text.secondary" fontWeight={600}>
                Balance
              </Typography>
            </Box>
          </Box>
        </CardContent>
      </Box>
    </Card>
  );
}

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

  const { data: explainData, isLoading: explainLoading } = useQuery({
    queryKey: ['expenses-page-explain', userId],
    queryFn: async () => {
      if (!userId) return {};
      const results = await Promise.allSettled(
        groups.map((g) => balancesApi.explainUserBalance(g.id, userId))
      );
      const map: Record<string, ExpenseCardData | null> = {};
      groups.forEach((g, i) => {
        const r = results[i];
        if (r.status === 'fulfilled') {
          const myExpenses = r.value.expenses.filter((e) => e.paid_by === userId);
          map[g.id] = {
            group: g,
            paidCents: r.value.paid_cents,
            balanceCents: r.value.balance_cents,
            expenseCount: myExpenses.length,
            currency: g.currency,
          };
        } else {
          map[g.id] = null;
        }
      });
      return map;
    },
    enabled: !!userId && groups.length > 0,
  });

  const cardDataMap = useMemo(() => explainData || {}, [explainData]);

  const [tab, setTab] = useState(0);
  const current = useMemo(() => groups.filter((g) => g.status === 'active'), [groups]);
  const past = useMemo(() => groups.filter((g) => g.status === 'archived' || g.status === 'deleted'), [groups]);
  const visible = tab === 0 ? current : past;

  const isLoading = groupsLoading || explainLoading;

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
        <>
          <Tabs
            value={tab}
            onChange={(_, v) => setTab(v)}
            sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}
          >
            <Tab
              label={`CURRENT (${current.length})`}
              sx={{ fontWeight: 700, letterSpacing: '0.05em', fontSize: '0.85rem' }}
            />
            <Tab
              label={`PAST (${past.length})`}
              sx={{ fontWeight: 700, letterSpacing: '0.05em', fontSize: '0.85rem' }}
            />
          </Tabs>

          {visible.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 6 }}>
              <Typography variant="body1" color="text.secondary">
                {tab === 0 ? 'No current events' : 'No past events'}
              </Typography>
            </Box>
          ) : (
            <Grid container spacing={3}>
              {visible.map((group) => {
                const cardData = cardDataMap[group.id];
                const data: ExpenseCardData = cardData || {
                  group,
                  paidCents: 0,
                  balanceCents: 0,
                  expenseCount: 0,
                  currency: group.currency,
                };
                return (
                  <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={group.id}>
                    <ExpenseCard
                      data={data}
                      onClick={() => navigate(`/app/expenses/${group.id}`)}
                    />
                  </Grid>
                );
              })}
            </Grid>
          )}
        </>
      )}
    </Box>
  );
}
