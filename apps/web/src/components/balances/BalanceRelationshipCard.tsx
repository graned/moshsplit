import { useState } from 'react';
import {
  Box,
  Typography,
  Avatar,
  Button,
  alpha,
  useTheme,
  Collapse,
  IconButton,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  LocalBar as BeerIcon,
  LocalGasStation as GasIcon,
  Restaurant as FoodIcon,
  DirectionsBus as TransportIcon,
  ShoppingBag as MerchIcon,
  Receipt as DefaultIcon,
  Forest as CampingIcon,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { useUser } from '../../hooks/useUserCache';
import { balancesApi, ExplainBalanceResponse, ExpenseBreakdown } from '../../api/balances.api';

const EXPENSE_ICONS: Record<string, React.ReactNode> = {
  beer: <BeerIcon sx={{ fontSize: 14 }} />,
  gas: <GasIcon sx={{ fontSize: 14 }} />,
  food: <FoodIcon sx={{ fontSize: 14 }} />,
  transport: <TransportIcon sx={{ fontSize: 14 }} />,
  merch: <MerchIcon sx={{ fontSize: 14 }} />,
  camping: <CampingIcon sx={{ fontSize: 14 }} />,
};

const formatAmount = (cents: number, currency = 'EUR') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Math.abs(cents) / 100);

interface BalanceRelationshipCardProps {
  userId: string;
  currentUserId: string;
  balanceCents: number;
  currency: string;
  eventId: string;
  onSettle?: () => void;
}

export function BalanceRelationshipCard({
  userId,
  currentUserId,
  balanceCents,
  currency,
  eventId,
  onSettle,
}: BalanceRelationshipCardProps) {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);

  const user = useUser(userId);
  const isCurrentUser = userId === currentUserId;

  const displayName = user
    ? `${user.firstName} ${user.lastName}`.trim() || user.email
    : userId.slice(0, 8);

  const initial = displayName.charAt(0).toUpperCase();

  // Determine relationship direction and status
  const isOwed = balanceCents > 0;
  const isSettled = balanceCents === 0;

  let statusLabel: string;
  let statusColor: string;
  let description: string;

  if (isSettled) {
    statusLabel = 'Honor Restored';
    statusColor = theme.palette.success.main;
    description = 'The scales are balanced.';
  } else if (isCurrentUser) {
    if (isOwed) {
      statusLabel = 'Incoming';
      statusColor = theme.palette.primary.main;
      description = 'The pit owes you.';
    } else {
      statusLabel = 'Active Debt';
      statusColor = theme.palette.error.main;
      description = 'You owe the pit.';
    }
  } else {
    if (isOwed) {
      statusLabel = 'Incoming';
      statusColor = theme.palette.primary.main;
      description = `${displayName} is owed.`;
    } else {
      statusLabel = 'Active Debt';
      statusColor = theme.palette.error.main;
      description = `${displayName} owes.`;
    }
  }

  // Fetch balance explanation
  const { data: explainData, isLoading: explainLoading } = useQuery({
    queryKey: ['balance-explain', eventId, userId, currentUserId],
    queryFn: () => balancesApi.explainUserBalance(eventId, currentUserId),
    enabled: expanded,
    staleTime: 1000 * 60 * 5,
  });

  const handleSettle = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSettle?.();
  };

  return (
    <Box
      sx={{
        bgcolor: 'elevated.main',
        borderRadius: 2,
        border: `1px solid ${alpha('#fff', isSettled ? 0.05 : 0.1)}`,
        overflow: 'hidden',
        transition: 'all 0.2s ease',
        opacity: isSettled ? 0.7 : 1,
      }}
    >
      {/* Main card row */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          p: 2,
        }}
      >
        {/* Avatar */}
        <Avatar
          sx={{
            width: 48,
            height: 48,
            bgcolor: isSettled ? 'action.disabledBackground' : isOwed ? 'primary.main' : 'error.main',
            color: '#121212',
            fontWeight: 700,
            fontSize: '1.25rem',
            flexShrink: 0,
          }}
        >
          {initial}
        </Avatar>

        {/* Name and description */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            variant="body1"
            fontWeight={600}
            color="text.primary"
            noWrap
          >
            {isCurrentUser ? 'You' : displayName}
            {isCurrentUser && (
              <Typography
                component="span"
                variant="caption"
                color="primary.main"
                sx={{ ml: 1, fontWeight: 600 }}
              >
                (The Treasurer)
              </Typography>
            )}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
            {description}
          </Typography>
        </Box>

        {/* Amount */}
        <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
          <Typography
            variant="h6"
            fontWeight={700}
            sx={{
              color: isSettled
                ? 'text.secondary'
                : isOwed
                  ? 'primary.main'
                  : 'error.main',
              fontSize: '1.25rem',
            }}
          >
            {isSettled ? '€0.00' : `${isOwed ? '+' : '-'}${formatAmount(balanceCents, currency)}`}
          </Typography>
          <Typography
            variant="caption"
            sx={{
              fontWeight: 700,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              color: statusColor,
            }}
          >
            {statusLabel}
          </Typography>
        </Box>

        {/* Actions */}
        <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
          {!isSettled && onSettle && (
            <Button
              size="small"
              variant="contained"
              onClick={handleSettle}
              sx={{
                bgcolor: 'primary.main',
                color: '#121212',
                fontWeight: 700,
                fontSize: '0.75rem',
                px: 2,
                '&:hover': { bgcolor: 'primary.dark' },
              }}
            >
              Settle
            </Button>
          )}
          <IconButton
            size="small"
            onClick={() => setExpanded(!expanded)}
            sx={{ color: 'text.secondary' }}
          >
            {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Box>
      </Box>

      {/* Expandable explanation */}
      <Collapse in={expanded}>
        <Box
          sx={{
            px: 2,
            pb: 2,
            borderTop: `1px solid ${alpha('#fff', 0.05)}`,
          }}
        >
          {explainLoading ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
              Loading the ledger...
            </Typography>
          ) : explainData ? (
            <BalanceExplanation
              explainData={explainData}
              currency={currency}
              userId={userId}
              currentUserId={currentUserId}
            />
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
              No breakdown available.
            </Typography>
          )}
        </Box>
      </Collapse>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Balance Explanation Sub-component
// ---------------------------------------------------------------------------

interface BalanceExplanationProps {
  explainData: ExplainBalanceResponse;
  currency: string;
  userId: string;
  currentUserId: string;
}

function BalanceExplanation({ explainData, currency, userId, currentUserId }: BalanceExplanationProps) {
  const isOwed = explainData.balance_cents > 0;

  return (
    <Box sx={{ py: 1 }}>
      <Typography
        variant="body2"
        fontWeight={600}
        color="text.secondary"
        sx={{ mb: 1.5 }}
      >
        {userId === currentUserId
          ? isOwed
            ? 'Why the pit owes you:'
            : 'Why you owe the pit:'
          : isOwed
            ? `Why the pit owes ${userId.slice(0, 8)}:`
            : `Why ${userId.slice(0, 8)} owes the pit:`}
      </Typography>

      {/* Expenses */}
      {explainData.expenses.length > 0 && (
        <Box sx={{ mb: 2 }}>
          {explainData.expenses.map((exp, i) => (
            <ExpenseBreakdownRow key={i} expense={exp} currency={currency} />
          ))}
        </Box>
      )}

      {/* Settlements */}
      {explainData.settlements.length > 0 && (
        <Box sx={{ mb: 2 }}>
          {explainData.settlements.map((s, i) => (
            <SettlementBreakdownRow key={i} settlement={s} currency={currency} />
          ))}
        </Box>
      )}

      {/* Remaining */}
      <Box
        sx={{
          mt: 2,
          pt: 1.5,
          borderTop: `1px solid ${alpha('#fff', 0.1)}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Typography variant="body2" fontWeight={700} color="text.secondary">
          Remaining:
        </Typography>
        <Typography
          variant="body1"
          fontWeight={800}
          sx={{
            color: explainData.balance_cents === 0 ? 'success.main' : 'primary.main',
          }}
        >
          {formatAmount(explainData.balance_cents, currency)}
        </Typography>
      </Box>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Expense Breakdown Row
// ---------------------------------------------------------------------------

function ExpenseBreakdownRow({ expense, currency }: { expense: ExpenseBreakdown; currency: string }) {
  const icon = expense.expense_type ? EXPENSE_ICONS[expense.expense_type] ?? <DefaultIcon sx={{ fontSize: 14 }} /> : <DefaultIcon sx={{ fontSize: 14 }} />;

  const netImpact = expense.paid_cents - expense.share_cents;
  const isPositive = netImpact >= 0;

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        py: 1,
      }}
    >
      <Box
        sx={{
          width: 28,
          height: 28,
          borderRadius: '50%',
          bgcolor: alpha('#F59E0B', 0.15),
          color: 'primary.main',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {icon}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" fontWeight={600} color="text.primary" noWrap>
          {expense.title}
        </Typography>
      </Box>
      <Typography
        variant="body2"
        fontWeight={700}
        sx={{ color: isPositive ? 'primary.main' : 'error.main', flexShrink: 0 }}
      >
        {isPositive ? '+' : ''}{formatAmount(netImpact, currency)}
      </Typography>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Settlement Breakdown Row
// ---------------------------------------------------------------------------

function SettlementBreakdownRow({ settlement, currency }: { settlement: any; currency: string }) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        py: 1,
      }}
    >
      <Box
        sx={{
          width: 28,
          height: 28,
          borderRadius: '50%',
          bgcolor: alpha('#10b981', 0.15),
          color: 'success.main',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        ✓
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" fontWeight={600} color="text.primary" noWrap>
          Settlement
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {settlement.status}
        </Typography>
      </Box>
      <Typography
        variant="body2"
        fontWeight={700}
        sx={{ color: 'success.main', flexShrink: 0 }}
      >
        -{formatAmount(settlement.amount_cents, currency)}
      </Typography>
    </Box>
  );
}
