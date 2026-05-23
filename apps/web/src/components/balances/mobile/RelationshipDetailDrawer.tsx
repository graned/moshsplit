import { Drawer, Box, Typography, IconButton, alpha, useTheme, useMediaQuery, Divider } from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { RelationshipSummary } from '../shared/SettlementCards';
import { ExpenseBreakdown, SettlementBreakdown, PaymentBreakdown } from '../../../api/balances.api';
import {
  LocalBar as BeerIcon,
  LocalGasStation as GasIcon,
  Restaurant as FoodIcon,
  DirectionsBus as TransportIcon,
  ShoppingBag as MerchIcon,
  Receipt as DefaultIcon,
  Forest as CampingIcon,
  SwapHoriz as SettleIcon,
  Payment as PaymentIcon,
} from '@mui/icons-material';

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

// ---------------------------------------------------------------------------
// Row Components
// ---------------------------------------------------------------------------

function ExpenseRow({
  expense,
  currency,
  isIncoming,
}: {
  expense: ExpenseBreakdown;
  currency: string;
  isIncoming: boolean;
}) {
  const icon = expense.expense_type
    ? EXPENSE_ICONS[expense.expense_type] ?? <DefaultIcon sx={{ fontSize: 14 }} />
    : <DefaultIcon sx={{ fontSize: 14 }} />;

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
      }}
    >
      <Box
        sx={{
          width: 32,
          height: 32,
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
        <Typography variant="caption" color="text.secondary">
          {expense.amount_cents > 0
            ? `Total: ${formatAmount(expense.amount_cents, currency)}`
            : 'Expense'}
        </Typography>
      </Box>
      <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
        <Typography
          variant="body2"
          fontWeight={700}
          sx={{ color: isIncoming ? 'primary.main' : 'error.main' }}
        >
          {formatAmount(expense.share_cents, currency)}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          share
        </Typography>
      </Box>
    </Box>
  );
}

function SettlementRow({
  settlement,
  currency,
}: {
  settlement: SettlementBreakdown;
  currency: string;
}) {
  const createdDate = new Date(settlement.created_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
      }}
    >
      <Box
        sx={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          bgcolor: alpha('#10b981', 0.15),
          color: '#10b981',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <SettleIcon sx={{ fontSize: 14 }} />
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Typography variant="body2" fontWeight={600} color="text.primary" noWrap>
            {settlement.note || 'Settlement'}
          </Typography>
        </Box>
        <Typography variant="caption" color="text.secondary">
          {createdDate} • {settlement.status}
        </Typography>
      </Box>
      <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
        <Typography
          variant="body2"
          fontWeight={700}
          sx={{ color: '#10b981' }}
        >
          {formatAmount(settlement.amount_cents, currency)}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          settled
        </Typography>
      </Box>
    </Box>
  );
}

function PaymentRow({
  payment,
  currency,
}: {
  payment: PaymentBreakdown;
  currency: string;
}) {
  const recordedDate = new Date(payment.recorded_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
      }}
    >
      <Box
        sx={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          bgcolor: alpha('#8b5cf6', 0.15),
          color: '#8b5cf6',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <PaymentIcon sx={{ fontSize: 14 }} />
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Typography variant="body2" fontWeight={600} color="text.primary" noWrap>
            {payment.description || 'Payment'}
          </Typography>
        </Box>
        <Typography variant="caption" color="text.secondary">
          {recordedDate}
        </Typography>
      </Box>
      <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
        <Typography
          variant="body2"
          fontWeight={700}
          sx={{ color: '#8b5cf6' }}
        >
          {formatAmount(payment.amount_cents, currency)}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          paid
        </Typography>
      </Box>
    </Box>
  );
}

interface RelationshipDetailDrawerProps {
  open: boolean;
  onClose: () => void;
  relationship: RelationshipSummary | null;
  currency: string;
  counterpartyName: string;
  counterpartyInitial: string;
  onRestoreHonor?: () => void;
}

export function RelationshipDetailDrawer({
  open,
  onClose,
  relationship,
  currency,
  counterpartyName,
  counterpartyInitial,
  onRestoreHonor,
}: RelationshipDetailDrawerProps) {
  const theme = useTheme();
  const isSmall = useMediaQuery(theme.breakpoints.down('sm'));

  if (!relationship) return null;

  const isIncoming = relationship.isIncoming;

  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      slotProps={{
        backdrop: {
          sx: {
            bgcolor: 'rgba(0, 0, 0, 0.6)',
          },
        },
      }}
      sx={{
        '& .MuiDrawer-paper': {
          bgcolor: '#1A1A1A',
          borderTopLeftRadius: isSmall ? 20 : 24,
          borderTopRightRadius: isSmall ? 20 : 24,
          maxHeight: '85dvh',
          height: 'auto',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        },
      }}
    >
      {/* Grab handle */}
      <Box
        sx={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          px: 2,
          pt: 1.5,
          pb: 0.5,
          flexShrink: 0,
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            top: 8,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 36,
            height: 4,
            borderRadius: 2,
            bgcolor: alpha('#fff', 0.15),
          }}
        />
        <IconButton
          onClick={onClose}
          size="small"
          sx={{
            color: 'text.secondary',
            width: 32,
            height: 32,
            '&:hover': { color: 'text.primary', bgcolor: 'action.hover' },
          }}
        >
          <CloseIcon sx={{ fontSize: 20 }} />
        </IconButton>
      </Box>

      {/* Header with counterparty info */}
      <Box
        sx={{
          px: 2,
          pb: 1.5,
          borderBottom: 1,
          borderColor: 'divider',
          flexShrink: 0,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: 2,
              bgcolor: isIncoming ? alpha(theme.palette.primary.main, 0.15) : alpha(theme.palette.error.main, 0.15),
              color: isIncoming ? 'primary.main' : 'error.main',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: '1.1rem',
              border: '1px solid',
              borderColor: alpha(isIncoming ? theme.palette.primary.main : theme.palette.error.main, 0.2),
            }}
          >
            {counterpartyInitial}
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              variant="h6"
              fontWeight={700}
              sx={{
                fontSize: '1.1rem',
                color: 'text.primary',
              }}
            >
              {counterpartyName}
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                fontSize: '0.75rem',
              }}
            >
              {relationship.expenses.length} expense{relationship.expenses.length !== 1 ? 's' : ''}
            </Typography>
          </Box>
          <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
            <Typography
              variant="h6"
              fontWeight={700}
              sx={{
                color: isIncoming ? 'primary.main' : 'error.main',
                fontSize: '1.25rem',
              }}
            >
              {isIncoming ? '+' : '-'}{formatAmount(relationship.totalCents, currency)}
            </Typography>
            <Typography
              variant="caption"
              sx={{
                fontSize: '0.65rem',
                fontWeight: 700,
                letterSpacing: '0.03em',
                textTransform: 'uppercase',
                color: isIncoming ? 'primary.main' : 'error.main',
              }}
            >
              {isIncoming ? 'Owed to you' : 'You owe'}
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Scrollable expense list */}
      <Box
        sx={{
          flex: 1,
          overflowY: 'auto',
          px: 2,
          pb: 2,
          '&::-webkit-scrollbar': {
            width: 4,
          },
          '&::-webkit-scrollbar-track': {
            background: 'transparent',
          },
          '&::-webkit-scrollbar-thumb': {
            background: alpha(theme.palette.primary.main, 0.2),
            borderRadius: 2,
          },
        }}
      >
        {/* Expense transactions */}
        {relationship.expenses.length > 0 && (
          <Box sx={{ mt: 1.5 }}>
            <Typography
              variant="caption"
              fontWeight={700}
              color="text.secondary"
              sx={{ display: 'block', mb: 1, letterSpacing: '0.05em', textTransform: 'uppercase' }}
            >
              Expenses
            </Typography>
            {relationship.expenses.map((exp, i) => (
              <Box
                key={i}
                sx={{
                  py: 1.5,
                  borderBottom: i < relationship.expenses.length - 1 ? `1px solid ${alpha('#fff', 0.05)}` : 'none',
                }}
              >
                <ExpenseRow expense={exp} currency={currency} isIncoming={isIncoming} />
              </Box>
            ))}
          </Box>
        )}

        {/* Settlement transactions */}
        {relationship.settlements.length > 0 && (
          <Box sx={{ mt: 1.5 }}>
            <Typography
              variant="caption"
              fontWeight={700}
              color="text.secondary"
              sx={{ display: 'block', mb: 1, letterSpacing: '0.05em', textTransform: 'uppercase' }}
            >
              Settlements
            </Typography>
            {relationship.settlements.map((stl, i) => (
              <Box
                key={i}
                sx={{
                  py: 1.5,
                  borderBottom: i < relationship.settlements.length - 1 ? `1px solid ${alpha('#fff', 0.05)}` : 'none',
                }}
              >
                <SettlementRow settlement={stl} currency={currency} />
              </Box>
            ))}
          </Box>
        )}

        {/* Payment transactions */}
        {relationship.payments.length > 0 && (
          <Box sx={{ mt: 1.5 }}>
            <Typography
              variant="caption"
              fontWeight={700}
              color="text.secondary"
              sx={{ display: 'block', mb: 1, letterSpacing: '0.05em', textTransform: 'uppercase' }}
            >
              Payments
            </Typography>
            {relationship.payments.map((pmt, i) => (
              <Box
                key={i}
                sx={{
                  py: 1.5,
                  borderBottom: i < relationship.payments.length - 1 ? `1px solid ${alpha('#fff', 0.05)}` : 'none',
                }}
              >
                <PaymentRow payment={pmt} currency={currency} />
              </Box>
            ))}
          </Box>
        )}
      </Box>

      {/* Fixed footer with net calculation and action button */}
      <Box
        sx={{
          flexShrink: 0,
          borderTop: `1px solid ${alpha('#fff', 0.1)}`,
          bgcolor: alpha('#1E1E1E', 0.8),
          backdropFilter: 'blur(8px)',
        }}
      >
        {/* Net Calculation */}
        {(relationship.rawExpenseCents !== 0 || relationship.rawSettlementCents !== 0 || relationship.rawPaymentCents !== 0) && (
          <Box sx={{ px: 2, pt: 1.5, pb: 1 }}>
            <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              Net Calculation
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 0.75 }}>
              <Typography variant="body2" color="text.secondary">
                Expenses
              </Typography>
              <Typography variant="body2" fontWeight={600}>
                {relationship.rawExpenseCents >= 0 ? '+' : ''}{formatAmount(relationship.rawExpenseCents, currency)}
              </Typography>
            </Box>
            {relationship.rawSettlementCents !== 0 && (
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  Settlements
                </Typography>
                <Typography variant="body2" fontWeight={600}>
                  {relationship.rawSettlementCents >= 0 ? '+' : ''}{formatAmount(relationship.rawSettlementCents, currency)}
                </Typography>
              </Box>
            )}
            {relationship.rawPaymentCents !== 0 && (
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  Payments
                </Typography>
                <Typography variant="body2" fontWeight={600}>
                  {relationship.rawPaymentCents >= 0 ? '+' : ''}{formatAmount(relationship.rawPaymentCents, currency)}
                </Typography>
              </Box>
            )}
          </Box>
        )}

        {/* Net Total */}
        <Divider sx={{ borderColor: alpha('#fff', 0.1) }} />
        <Box sx={{ px: 2, py: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="body2" fontWeight={700} color="text.secondary">
            Net Total:
          </Typography>
          <Typography
            variant="body1"
            fontWeight={800}
            sx={{
              color: isIncoming ? 'primary.main' : 'error.main',
              fontSize: '1.25rem',
            }}
          >
            {isIncoming ? '+' : '-'}{formatAmount(relationship.totalCents, currency)}
          </Typography>
        </Box>

        {/* Restore Honor button (only for outgoing) */}
        {!isIncoming && relationship.totalCents > 0 && onRestoreHonor && (
          <Box sx={{ px: 2, pb: 2 }}>
            <Box
              onClick={(e) => {
                e.stopPropagation();
                onRestoreHonor();
              }}
              sx={{
                width: '100%',
                py: 1.75,
                bgcolor: 'primary.main',
                color: '#121212',
                fontWeight: 700,
                borderRadius: 2,
                textAlign: 'center',
                cursor: 'pointer',
                '&:hover': { bgcolor: 'primary.dark' },
                '&:active': { transform: 'scale(0.98)' },
                transition: 'all 0.15s ease',
              }}
            >
              Restore Honor {formatAmount(relationship.totalCents, currency)}
            </Box>
          </Box>
        )}
      </Box>
    </Drawer>
  );
}
