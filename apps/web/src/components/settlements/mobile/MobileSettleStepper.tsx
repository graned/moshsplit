import { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Button,
  Checkbox,
  TextField,
  CircularProgress,
  alpha,
} from '@mui/material';
import {
  Receipt as ReceiptIcon,
  DoneAll as DoneAllIcon,
  ArrowBack as ArrowBackIcon,
  ArrowForward as ArrowForwardIcon,
} from '@mui/icons-material';

import { Stepper, type StepDefinition } from '../../shared/forms/Stepper';
import { useSettlementStore } from '../../../stores/settlementStore';
import type { BreakdownItem } from './MobileStatsBreakdownDrawer';

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
  { label: 'Amount' },
  { label: 'Confirm' },
];

interface MobileSettleStepperProps {
  eventId: string;
  currentUserId: string;
  direction: 'incoming' | 'outgoing';
  currency?: string;
  breakdownItems: BreakdownItem[];
  displayItem: { user_id: string; amount_cents: number };
  amountColor: string;
  darkColor: string;
  displayName: string;
  /** Called when settlement completes and user taps Done */
  onComplete: () => void;
  /** Called when user cancels the settle flow */
  onCancel: () => void;
}

export function MobileSettleStepper({
  eventId,
  currentUserId,
  direction,
  currency = 'EUR',
  breakdownItems,
  displayItem,
  amountColor,
  darkColor,
  displayName,
  onComplete,
  onCancel,
}: MobileSettleStepperProps) {
  const { createSettlement, error, clearError } = useSettlementStore();

  const [step, setStep] = useState(0);
  const [selectedExpenseIds, setSelectedExpenseIds] = useState<number[]>([]);
  const [settleAmount, setSettleAmount] = useState(0);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const remainingExpenseItems = useMemo(() => {
    const settlementTotal = breakdownItems
      .filter((i) => i.type === 'settlement')
      .reduce((sum, i) => sum + Math.abs(i.amount), 0);

    const sorted = [...breakdownItems]
      .filter((i) => i.type === 'expense')
      .sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));

    let remaining = settlementTotal;
    const result: typeof breakdownItems = [];

    for (const exp of sorted) {
      if (remaining >= exp.amount) {
        remaining -= exp.amount;
      } else if (remaining > 0) {
        result.push({ ...exp, amount: exp.amount - remaining });
        remaining = 0;
      } else {
        result.push({ ...exp });
      }
    }

    return result;
  }, [breakdownItems]);

  const expenseItems = useMemo(
    () => remainingExpenseItems,
    [remainingExpenseItems],
  );

  const totalSelectedCents = useMemo(
    () => expenseItems
      .filter((_, i) => selectedExpenseIds.includes(i))
      .reduce((sum, item) => sum + Math.abs(item.amount), 0),
    [expenseItems, selectedExpenseIds],
  );

  const resetSettleState = () => {
    setStep(0);
    setSelectedExpenseIds([]);
    setSettleAmount(0);
    setNote('');
    setSubmitting(false);
    setShowSuccess(false);
    clearError();
  };

  const handleToggleExpense = (idx: number) => {
    setSelectedExpenseIds((prev) =>
      prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx],
    );
  };

  const handleSelectAll = () => {
    if (selectedExpenseIds.length === expenseItems.length) {
      setSelectedExpenseIds([]);
    } else {
      setSelectedExpenseIds(expenseItems.map((_, i) => i));
    }
  };

  const canProceed = (): boolean => {
    switch (step) {
      case 0:
        return selectedExpenseIds.length > 0;
      case 1:
        return settleAmount > 0;
      case 2:
        return true;
      default:
        return false;
    }
  };

  const next = () => {
    if (step === 0 && selectedExpenseIds.length > 0) {
      setSettleAmount(totalSelectedCents);
    }
    if (step < SETTLE_STEPS.length - 1) setStep((s) => s + 1);
  };

  const back = () => {
    if (step > 0) setStep((s) => s - 1);
  };

  const handleSubmit = async () => {
    if (settleAmount <= 0) return;
    setSubmitting(true);
    try {
      await createSettlement(eventId, {
        from_user: currentUserId,
        to_user: displayItem.user_id,
        amount_cents: settleAmount,
        note: note.trim() || undefined,
      });
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

  // ------------------------------------------------------------------
  // Step 1 - Select Expenses
  // ------------------------------------------------------------------
  const renderSelectExpenses = () => (
    <Box sx={{ py: 2 }}>
      <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: alpha('#fff', 0.5), textTransform: 'uppercase', letterSpacing: '0.06em', mb: 1.5, textAlign: 'center' }}>
        Select expenses to settle
      </Typography>

      {expenseItems.length === 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
          No expense items available.
        </Typography>
      )}

      {expenseItems.length > 0 && (
        <>
          <Box
            onClick={handleSelectAll}
            sx={{
              display: 'flex', alignItems: 'center', gap: 1, py: 0.75, px: 0.5,
              borderBottom: `1px solid ${alpha('#fff', 0.08)}`, cursor: 'pointer',
              borderRadius: 1, '&:hover': { bgcolor: alpha('#fff', 0.03) },
            }}
          >
            <Checkbox
              checked={selectedExpenseIds.length === expenseItems.length}
              indeterminate={selectedExpenseIds.length > 0 && selectedExpenseIds.length < expenseItems.length}
              sx={{ color: alpha('#fff', 0.3), '&.Mui-checked': { color: 'primary.main' } }}
            />
            <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: 'text.primary', flex: 1 }}>
              {selectedExpenseIds.length === expenseItems.length ? 'Deselect All' : 'Select All'}
            </Typography>
            <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: alpha('#fff', 0.5) }}>
              {expenseItems.length} items
            </Typography>
          </Box>

          {expenseItems.map((item, idx) => {
            const isSelected = selectedExpenseIds.includes(idx);
            return (
              <Box
                key={`exp-${idx}`}
                onClick={() => handleToggleExpense(idx)}
                sx={{
                  display: 'flex', alignItems: 'center', gap: 1.5, py: 1, px: 0.5,
                  cursor: 'pointer', borderRadius: 1,
                  bgcolor: isSelected ? alpha(amountColor, 0.06) : 'transparent',
                  '&:hover': { bgcolor: alpha('#fff', 0.03) },
                }}
              >
                <Checkbox
                  checked={isSelected}
                  sx={{ color: alpha('#fff', 0.3), '&.Mui-checked': { color: amountColor } }}
                />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontSize: '0.8rem', fontWeight: 500, color: 'text.primary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.label}
                  </Typography>
                </Box>
                <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: amountColor, flexShrink: 0 }}>
                  {formatAmount(Math.abs(item.amount), currency)}
                </Typography>
              </Box>
            );
          })}

          <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 1, px: 0.5, mt: 1, borderTop: `1px solid ${alpha('#fff', 0.08)}` }}>
            <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: alpha('#fff', 0.5) }}>
              Selected
            </Typography>
            <Typography sx={{ fontSize: '0.85rem', fontWeight: 800, color: amountColor }}>
              {formatAmount(totalSelectedCents, currency)}
            </Typography>
          </Box>
        </>
      )}
    </Box>
  );

  // ------------------------------------------------------------------
  // Step 2 - Amount (Full / Partial)
  // ------------------------------------------------------------------
  const renderAmountStep = () => {
    const isFullAmount = settleAmount === totalSelectedCents;
    return (
      <Box sx={{ py: 2 }}>
        <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: alpha('#fff', 0.5), textTransform: 'uppercase', letterSpacing: '0.06em', mb: 2, textAlign: 'center' }}>
          Choose amount to settle
        </Typography>

        <Typography sx={{ fontSize: '0.8rem', fontWeight: 500, color: 'text.secondary', textAlign: 'center', mb: 2 }}>
          Selected total: {formatAmount(totalSelectedCents, currency)}
        </Typography>

        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5, mb: 3 }}>
          <Button
            onClick={() => setSettleAmount(totalSelectedCents)}
            sx={{
              p: 2, flexDirection: 'column', gap: 0.5, borderRadius: 2,
              border: isFullAmount ? `1px solid ${alpha(amountColor, 0.5)}` : `1px solid ${alpha('#fff', 0.1)}`,
              bgcolor: isFullAmount ? alpha(amountColor, 0.12) : 'transparent',
              '&:hover': { bgcolor: isFullAmount ? alpha(amountColor, 0.18) : alpha('#fff', 0.04) },
            }}
          >
            <DoneAllIcon sx={{ fontSize: 22, color: isFullAmount ? amountColor : 'text.secondary' }} />
            <Typography variant="caption" fontWeight={700} color={isFullAmount ? amountColor : 'text.secondary'}>
              Settle All
            </Typography>
          </Button>

          <Button
            onClick={() => !isFullAmount && setSettleAmount(0)}
            sx={{
              p: 2, flexDirection: 'column', gap: 0.5, borderRadius: 2,
              border: !isFullAmount ? `1px solid ${alpha(amountColor, 0.5)}` : `1px solid ${alpha('#fff', 0.1)}`,
              bgcolor: !isFullAmount ? alpha(amountColor, 0.12) : 'transparent',
              '&:hover': { bgcolor: !isFullAmount ? alpha(amountColor, 0.18) : alpha('#fff', 0.04) },
            }}
          >
            <ReceiptIcon sx={{ fontSize: 22, color: !isFullAmount ? amountColor : 'text.secondary' }} />
            <Typography variant="caption" fontWeight={700} color={!isFullAmount ? amountColor : 'text.secondary'}>
              Partial
            </Typography>
          </Button>
        </Box>

        {!isFullAmount && (
          <Box sx={{ textAlign: 'center' }}>
            <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: alpha('#fff', 0.4), textTransform: 'uppercase', letterSpacing: '0.05em', mb: 1 }}>
              Enter amount
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 0.5 }}>
              <Typography variant="h5" color="text.secondary" fontWeight={700}>
                {currency}
              </Typography>
              <TextField
                type="number"
                value={settleAmount > 0 ? settleAmount / 100 : ''}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setSettleAmount(!isNaN(val) && val >= 0 ? Math.round(val * 100) : 0);
                }}
                inputProps={{
                  step: '0.01', min: '0',
                  sx: {
                    textAlign: 'center', MozAppearance: 'textfield',
                    '&::-webkit-outer-spin-button, &::-webkit-inner-spin-button': { WebkitAppearance: 'none', margin: 0 },
                  },
                }}
                sx={{
                  width: 140,
                  '& .MuiInputBase-root': {
                    bgcolor: 'transparent', border: 'none',
                    '&::before, &::after, &::notched-outline': { display: 'none' },
                  },
                  '& .MuiInputBase-input': {
                    color: amountColor, fontSize: '1.75rem', fontWeight: 700, p: 0,
                  },
                }}
              />
            </Box>
            {settleAmount > totalSelectedCents && (
              <Typography variant="caption" color="error.main" sx={{ display: 'block', mt: 1 }}>
                Amount exceeds selected total
              </Typography>
            )}
          </Box>
        )}
      </Box>
    );
  };

  // ------------------------------------------------------------------
  // Step 3 - Confirm
  // ------------------------------------------------------------------
  const renderConfirmStep = () => {
    const selectedExpenseCount = selectedExpenseIds.length;
    return (
      <Box sx={{ py: 2 }}>
        <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: alpha('#fff', 0.5), textTransform: 'uppercase', letterSpacing: '0.06em', mb: 2, textAlign: 'center' }}>
          Confirm Settlement
        </Typography>

        <Box sx={{ p: 2, borderRadius: 2, bgcolor: alpha(amountColor, 0.06), border: `1px solid ${alpha(amountColor, 0.15)}`, mb: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="caption" color="text.secondary">To</Typography>
            <Typography variant="body2" fontWeight={600} color="text.primary">{displayName}</Typography>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="caption" color="text.secondary">Expenses</Typography>
            <Typography variant="body2" fontWeight={600} color="text.primary">{selectedExpenseCount} of {expenseItems.length}</Typography>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', pt: 1, borderTop: `1px solid ${alpha('#fff', 0.1)}` }}>
            <Typography variant="body2" fontWeight={700} color="text.primary">Amount</Typography>
            <Typography sx={{ fontSize: '1.1rem', fontWeight: 800, color: amountColor }}>
              {formatAmount(settleAmount, currency)}
            </Typography>
          </Box>
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
  };

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
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3, textAlign: 'center', maxWidth: 240 }}>
        {formatAmount(settleAmount, currency)} to {displayName}
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
        {step === 0 && renderSelectExpenses()}
        {step === 1 && renderAmountStep()}
        {step === 2 && renderConfirmStep()}
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
            disabled={!canProceed() || submitting || settleAmount > totalSelectedCents}
            variant="contained"
            sx={{ flex: 1, fontSize: '0.85rem', bgcolor: amountColor, color: '#fff', '&:hover': { bgcolor: darkColor }, '&:disabled': { bgcolor: alpha(amountColor, 0.4), color: alpha('#fff', 0.5) } }}
            startIcon={submitting ? <CircularProgress size={20} color="inherit" /> : undefined}
          >
            {submitting ? 'Settling...' : 'Confirm Settlement'}
          </Button>
        )}
      </Box>
    </Box>
  );
}
