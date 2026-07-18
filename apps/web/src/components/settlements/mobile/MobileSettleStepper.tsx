import { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  TextField,
  CircularProgress,
  alpha,
} from '@mui/material';
import {
  DoneAll as DoneAllIcon,
  ArrowBack as ArrowBackIcon,
  ArrowForward as ArrowForwardIcon,
  Receipt as ReceiptIcon,
} from '@mui/icons-material';

import { Stepper, type StepDefinition } from '../../shared/forms/Stepper';
import { usePaymentStore } from '../../../stores/paymentStore';
import { MobileExpensePicker, type SelectedExpense } from './MobileExpensePicker';
import type { BreakdownItem } from './MobileStatsBreakdownDrawer';
import type { Payment } from '../../../api/payments.api';

function formatAmount(cents: number, currency = 'EUR') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.abs(cents) / 100);
}

const SETTLE_STEPS: StepDefinition[] = [
  { label: 'Expenses' },
  { label: 'Confirm' },
];

interface MobileSettleStepperProps {
  eventId: string;
  currentUserId: string;
  direction: 'incoming' | 'outgoing';
  currency?: string;
  breakdownTotal: number;
  displayItem: { user_id: string; amount_cents: number };
  amountColor: string;
  darkColor: string;
  displayName: string;
  breakdownItems?: BreakdownItem[];
  payment?: Payment | null;
  /** Called when settlement completes and user taps Done */
  onComplete: () => void;
  /** Called when user cancels the settle flow */
  onCancel: () => void;
}

export function MobileSettleStepper({
  eventId,
  direction,
  currency = 'EUR',
  breakdownTotal,
  amountColor,
  darkColor,
  displayName,
  breakdownItems = [],
  payment,
  onComplete,
  onCancel,
}: MobileSettleStepperProps) {
  const { proposeTransaction, error, clearError } = usePaymentStore();

  const absTotal = Math.abs(breakdownTotal);

  const [step, setStep] = useState(0);
  const [selectedExpenses, setSelectedExpenses] = useState<SelectedExpense[]>([]);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [settledCount, setSettledCount] = useState(0);

  const totalSelected = selectedExpenses.reduce((sum, exp) => sum + exp.settle_amount_cents, 0);

  const resetSettleState = () => {
    setStep(0);
    setSelectedExpenses([]);
    setNote('');
    setSubmitting(false);
    setShowSuccess(false);
    setSettledCount(0);
    clearError();
  };

  const canProceed = (): boolean => {
    switch (step) {
      case 0:
        return selectedExpenses.length > 0 && totalSelected > 0 && totalSelected <= absTotal;
      case 1:
        return true;
      default:
        return false;
    }
  };

  const next = () => {
    if (step < SETTLE_STEPS.length - 1) setStep((s) => s + 1);
  };

  const back = () => {
    if (step > 0) setStep((s) => s - 1);
  };

  const handleSubmit = async () => {
    if (selectedExpenses.length === 0 || !payment) return;
    setSubmitting(true);
    try {
      let settled = 0;
      for (const selectedExpense of selectedExpenses) {
        await proposeTransaction(eventId, payment.id, selectedExpense.settle_amount_cents);
        settled++;
        setSettledCount(settled);
      }
      setShowSuccess(true);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSuccessDone = () => {
    setShowSuccess(false);
    resetSettleState();
    onComplete();
  };

  // Step 1 - Expense Selection
  const renderExpenseSelection = () => {
    const expenseItems = breakdownItems
      .filter((item) => item.type === 'expense' && item.expense_id)
      .map((item) => ({
        expense_id: item.expense_id!,
        label: item.label,
        amount_cents: Math.abs(item.amount),
      }));

    return (
      <MobileExpensePicker
        items={expenseItems}
        currency={currency}
        amountColor={amountColor}
        onSelectionChange={setSelectedExpenses}
      />
    );
  };

  // ------------------------------------------------------------------
  // Step 2 - Confirm
  // ------------------------------------------------------------------
  const renderConfirmStep = () => (
    <Box sx={{ py: 2 }}>
      <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: alpha('#fff', 0.5), textTransform: 'uppercase', letterSpacing: '0.06em', mb: 2, textAlign: 'center' }}>
        Confirm Settlement
      </Typography>

      <Box sx={{ p: 2, borderRadius: 2, bgcolor: alpha(amountColor, 0.06), border: `1px solid ${alpha(amountColor, 0.15)}`, mb: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="caption" color="text.secondary">{direction === 'outgoing' ? 'To' : 'From'}</Typography>
          <Typography variant="body2" fontWeight={600} color="text.primary">{displayName}</Typography>
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="caption" color="text.secondary">Direction</Typography>
          <Typography variant="body2" fontWeight={600} color={direction === 'outgoing' ? amountColor : 'text.primary'}>
            {direction === 'outgoing' ? 'You pay' : 'They pay'}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="caption" color="text.secondary">Expenses</Typography>
          <Typography variant="body2" fontWeight={600} color="text.primary">
            {selectedExpenses.length} selected
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', pt: 1, borderTop: `1px solid ${alpha('#fff', 0.1)}` }}>
          <Typography variant="body2" fontWeight={700} color="text.primary">Total</Typography>
          <Typography sx={{ fontSize: '1.1rem', fontWeight: 800, color: amountColor }}>
            {formatAmount(totalSelected, currency)}
          </Typography>
        </Box>
        {totalSelected < absTotal && (
          <Box sx={{ display: 'flex', justifyContent: 'space-between', pt: 0.5 }}>
            <Typography variant="caption" color="text.secondary">Remaining balance</Typography>
            <Typography variant="caption" fontWeight={600} color="text.secondary">
              {formatAmount(absTotal - totalSelected, currency)}
            </Typography>
          </Box>
        )}
      </Box>

      {/* Per-expense breakdown */}
      <Box sx={{ mb: 2 }}>
        <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: alpha('#fff', 0.4), textTransform: 'uppercase', letterSpacing: '0.04em', mb: 1 }}>
          Settlement Breakdown
        </Typography>
        {selectedExpenses.map((exp) => (
          <Box
            key={exp.expense_id}
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              py: 0.75,
              borderBottom: `1px solid ${alpha('#fff', 0.05)}`,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <ReceiptIcon sx={{ fontSize: 14, color: alpha('#fff', 0.4) }} />
              <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>
                {exp.label}
              </Typography>
            </Box>
            <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: amountColor }}>
              {formatAmount(exp.settle_amount_cents, currency)}
              {exp.settle_amount_cents < exp.original_amount_cents && (
                <Typography component="span" sx={{ fontSize: '0.65rem', color: alpha('#fff', 0.4), ml: 0.5 }}>
                  (partial)
                </Typography>
              )}
            </Typography>
          </Box>
        ))}
      </Box>

      <TextField
        multiline
        rows={2}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Add a note (optional)..."
        fullWidth
        sx={{
          '& .MuiFilledInput-root': {
            bgcolor: alpha('#fff', 0.03), borderRadius: 2,
            border: `1px solid ${alpha('#fff', 0.08)}`,
            '&:hover': { bgcolor: alpha('#fff', 0.05) },
            '&.Mui-focused': { borderColor: 'primary.main' },
          },
          '& .MuiFilledInput-input': { color: 'text.primary', '&::placeholder': { color: 'text.secondary', opacity: 0.5 } },
        }}
      />

      {error && (
        <Typography variant="body2" color="error.main" sx={{ mt: 2, textAlign: 'center' }}>
          {error}
        </Typography>
      )}
    </Box>
  );

  // ------------------------------------------------------------------
  // Success State
  // ------------------------------------------------------------------
  const renderSuccess = () => (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 6 }}>
      <Box sx={{ width: 80, height: 80, borderRadius: '50%', bgcolor: alpha(amountColor, 0.12), border: `2px solid ${alpha(amountColor, 0.3)}`, display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 3 }}>
        <DoneAllIcon sx={{ fontSize: 40, color: amountColor }} />
      </Box>
      <Typography variant="h5" fontWeight={700} color={amountColor} sx={{ mb: 1 }}>
        {direction === 'outgoing' ? 'Settlement Sent' : 'Settlement Requested'}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1, textAlign: 'center', maxWidth: 280 }}>
        {selectedExpenses.length} expense{selectedExpenses.length !== 1 ? 's' : ''} settled with {displayName}
      </Typography>
      <Typography sx={{ fontSize: '1.1rem', fontWeight: 800, color: amountColor, mb: 3 }}>
        {formatAmount(totalSelected, currency)}
      </Typography>
      <Button
        variant="outlined"
        onClick={handleSuccessDone}
        sx={{ borderColor: alpha('#fff', 0.15), color: 'text.primary', px: 4, py: 1.5, '&:hover': { borderColor: 'primary.main', bgcolor: alpha(amountColor, 0.08) } }}
      >
        Done
      </Button>
    </Box>
  );

  if (showSuccess) return renderSuccess();

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <Stepper steps={SETTLE_STEPS} activeStep={step} />

      <Box sx={{ flex: 1, overflowY: 'auto', px: 0.5 }}>
        {step === 0 && renderExpenseSelection()}
        {step === 1 && renderConfirmStep()}
      </Box>

      <Box sx={{ display: 'flex', gap: 1.5, p: 1.5, borderTop: `1px solid ${alpha('#fff', 0.08)}`, flexShrink: 0 }}>
        {step > 0 ? (
          <Button startIcon={<ArrowBackIcon />} onClick={back} disabled={submitting} variant="outlined" sx={{ flex: 1, fontSize: '0.85rem' }}>
            Back
          </Button>
        ) : (
          <Button onClick={onCancel} variant="outlined" sx={{ flex: 1, fontSize: '0.85rem' }}>
            Cancel
          </Button>
        )}

        {step < SETTLE_STEPS.length - 1 ? (
          <Button endIcon={<ArrowForwardIcon />} onClick={next} disabled={!canProceed()} variant="contained" sx={{ flex: 1, fontSize: '0.85rem' }}>
            Next
          </Button>
        ) : (
          <Button
            onClick={handleSubmit}
            disabled={!canProceed() || submitting || totalSelected > absTotal}
            variant="contained"
            sx={{ flex: 1, fontSize: '0.85rem', bgcolor: amountColor, color: '#fff', '&:hover': { bgcolor: darkColor }, '&:disabled': { bgcolor: alpha(amountColor, 0.4), color: alpha('#fff', 0.5) } }}
            startIcon={submitting ? <CircularProgress size={20} color="inherit" /> : undefined}
          >
            {submitting ? `Settling ${settledCount}/${selectedExpenses.length}...` : 'Confirm Settlement'}
          </Button>
        )}
      </Box>
    </Box>
  );
}
