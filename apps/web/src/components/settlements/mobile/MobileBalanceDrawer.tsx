import React, { useRef, useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Button,
  Checkbox,
  TextField,
  CircularProgress,
  alpha,
  useTheme,
} from '@mui/material';
import {
  Receipt as ReceiptIcon,
  Handshake as HandshakeIcon,
  DoneAll as DoneAllIcon,
  ArrowBack as ArrowBackIcon,
  ArrowForward as ArrowForwardIcon,
} from '@mui/icons-material';

import { MobileDrawer } from '../../shared/MobileDrawer';
import { Stepper, type StepDefinition } from '../../shared/forms/Stepper';
import { useUserCache } from '../../../hooks/useUserCache';
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

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

type DrawerDirection = 'incoming' | 'outgoing';
type DrawerView = 'breakdown' | 'settle';

interface MobileBalanceDrawerProps {
  open: boolean;
  onClose: () => void;
  balanceItem: { user_id: string; amount_cents: number } | null;
  direction: DrawerDirection;
  currency?: string;
  onSettle: (userId: string, amountCents: number) => void;
  breakdownItems?: BreakdownItem[];
  breakdownTotal?: number;
  fullScreen?: boolean;
  eventId: string;
  currentUserId: string;
}

const directionConfig: Record<DrawerDirection, {
  headerText: (name: string) => string;
  mainColor: string;
  darkColor: string;
  gradient: string;
  buttonBg: string;
  buttonText: string;
  buttonHover: string;
  amountColor: string;
  amountBg: string;
}> = {
  incoming: {
    headerText: (name) => `${name} owes you`,
    mainColor: '#22c55e',
    darkColor: '#16a34a',
    gradient: '',
    buttonBg: '',
    buttonText: '#121212',
    buttonHover: '',
    amountColor: '#22c55e',
    amountBg: '#22c55e',
  },
  outgoing: {
    headerText: (name) => `You owe ${name}`,
    mainColor: '#ef4444',
    darkColor: '#b91c1c',
    gradient: 'linear-gradient(135deg, #ef4444, #b91c1c)',
    buttonBg: '#ef4444',
    buttonText: '#fff',
    buttonHover: '#b91c1c',
    amountColor: '#ef4444',
    amountBg: '#ef4444',
  },
};

const SETTLE_STEPS: StepDefinition[] = [
  { label: 'Expenses' },
  { label: 'Amount' },
  { label: 'Confirm' },
];

export function MobileBalanceDrawer({
  open,
  onClose,
  balanceItem,
  direction,
  currency = 'EUR',
  onSettle: _onSettle,
  breakdownItems = [],
  breakdownTotal = 0,
  fullScreen,
  eventId,
  currentUserId,
}: MobileBalanceDrawerProps) {
  const theme = useTheme();
  const { getUser } = useUserCache();
  const { createSettlement, isCreating, error, clearError } = useSettlementStore();

  const cachedItem = useRef(balanceItem);
  if (balanceItem) cachedItem.current = balanceItem;
  const displayItem = balanceItem || cachedItem.current;

  const user = displayItem ? getUser(displayItem.user_id) : null;
  const displayName = user
    ? `${user.firstName} ${user.lastName}`.trim() || user.email.split('@')[0]
    : displayItem?.user_id.slice(0, 8) ?? '';

  const cfg = directionConfig[direction];

  const amountColor = cfg.amountColor;
  const darkColor = direction === 'incoming' ? theme.palette.primary.dark : cfg.darkColor;
  const gradient = direction === 'incoming'
    ? `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`
    : cfg.gradient;
  const buttonBg = direction === 'incoming' ? theme.palette.primary.main : cfg.buttonBg;
  const buttonText = cfg.buttonText;
  const buttonHover = direction === 'incoming' ? theme.palette.primary.dark : cfg.buttonHover;

  // Stepper state
  const [view, setView] = useState<DrawerView>('breakdown');
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

  const handleClose = () => {
    if (isCreating) return;
    if (view === 'settle') {
      setView('breakdown');
      resetSettleState();
      return;
    }
    onClose();
  };

  const handleStartSettle = () => {
    setView('settle');
    setStep(0);
    setSelectedExpenseIds([]);
    setSettleAmount(0);
    setNote('');
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
    if (settleAmount <= 0 || !displayItem) return;
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
    setView('breakdown');
    resetSettleState();
  };

  const resolvedBreakdownItems = useMemo(() => {
    return breakdownItems.map((item) => {
      if (item.counterparty && item.type === 'settlement') {
        const user = getUser(item.counterparty);
        const name = user
          ? `${user.firstName} ${user.lastName}`.trim() || user.email.split('@')[0]
          : item.counterparty.slice(0, 8);
        const isIncoming = item.direction === 'incoming';
        return { ...item, label: isIncoming ? `Paid by ${name}` : `Paid to ${name}` };
      }
      return item;
    });
  }, [breakdownItems, getUser]);

  // ------------------------------------------------------------------
  // Render: breakdown view (existing layout)
  // ------------------------------------------------------------------
  const renderBreakdownView = () => {
    return (
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', height: 0 }}>
        <Typography
          sx={{
            fontSize: '1rem', fontWeight: 600, color: 'text.secondary',
            textAlign: 'center', pt: 2, pb: 0.5,
          }}
        >
          {cfg.headerText(displayName)}
        </Typography>

        <Typography
          sx={{
            fontSize: '2.5rem', fontWeight: 800, background: gradient,
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            lineHeight: 1.1, textAlign: 'center', pb: 1.5,
          }}
        >
          {formatAmount(Math.abs(breakdownTotal), currency)}
        </Typography>

        <Box sx={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          {resolvedBreakdownItems.length > 0 && (
            <>
              {(() => {
                const groups: { title: string; items: typeof resolvedBreakdownItems }[] = [];
                const youPaid: typeof resolvedBreakdownItems = [];
                const theyPaid: typeof resolvedBreakdownItems = [];
                const settlements: typeof resolvedBreakdownItems = [];

                for (const item of resolvedBreakdownItems) {
                  if (item.type === 'settlement') {
                    settlements.push(item);
                  } else if (direction === 'incoming') {
                    if (item.amount >= 0) {
                      youPaid.push(item);
                    } else {
                      theyPaid.push(item);
                    }
                  } else {
                    if (item.amount >= 0) {
                      theyPaid.push(item);
                    } else {
                      youPaid.push(item);
                    }
                  }
                }
                if (direction === 'incoming') {
                  if (youPaid.length > 0) groups.push({ title: 'You Paid', items: youPaid });
                  if (theyPaid.length > 0) groups.push({ title: 'Paid by Them', items: theyPaid });
                } else {
                  if (theyPaid.length > 0) groups.push({ title: 'Paid by Them', items: theyPaid });
                  if (youPaid.length > 0) groups.push({ title: 'You Paid', items: youPaid });
                }
                if (settlements.length > 0) groups.push({ title: 'Settlements', items: settlements });

                return groups.map((section, si) => (
                  <React.Fragment key={section.title}>
                    {si > 0 && <Box sx={{ height: 0, bgcolor: alpha('#fff', 0.08), my: 1.5 }} />}
                    <Box sx={{ textAlign: 'center', mb: 0.75 }}>
                      <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: alpha('#fff', 0.45), textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        {section.title}
                      </Typography>
                      <Typography sx={{ fontSize: '0.65rem', fontWeight: 600, color: alpha('#fff', 0.35), fontVariantNumeric: 'tabular-nums', mt: 0.15 }}>
                        {formatAmount(section.items.reduce((sum, i) => sum + i.amount, 0), currency)}
                      </Typography>
                    </Box>
                    {section.items.map((item, idx) => {
                      const isPositive = item.amount >= 0;
                      const isSettlement = item.type === 'settlement';
                      return (
                        <Box
                          key={`${item.label}-${idx}`}
                          sx={{
                            display: 'flex', alignItems: 'center', gap: 1.5, py: 0.75,
                            borderBottom: idx < section.items.length - 1 ? `1px solid ${alpha('#fff', 0.05)}` : 'none',
                          }}
                        >
                          <Box sx={{ width: 28, height: 28, borderRadius: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: isSettlement ? alpha('#F59E0B', 0.12) : alpha(amountColor, 0.12), flexShrink: 0 }}>
                            {isSettlement ? (
                              <HandshakeIcon sx={{ fontSize: 14, color: alpha('#F59E0B', 0.7) }} />
                            ) : (
                              <ReceiptIcon sx={{ fontSize: 14, color: amountColor }} />
                            )}
                          </Box>
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography sx={{ fontSize: '0.8rem', fontWeight: 500, color: 'text.primary', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {item.label}
                            </Typography>
                            <Typography sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.1 }}>
                              {item.created_at && (
                                <Typography component="span" sx={{ fontSize: '0.6rem', fontWeight: 500, color: alpha('#fff', 0.3) }}>
                                  {formatDate(item.created_at)}
                                </Typography>
                              )}
                              {isSettlement && (
                                <Typography component="span" sx={{ fontSize: '0.55rem', fontWeight: 600, color: alpha('#F59E0B', 0.6), textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                  · Settlement
                                </Typography>
                              )}
                            </Typography>
                          </Box>
                          <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: '#fff', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                            {isPositive ? '' : '−'}{formatAmount(item.amount, currency)}
                          </Typography>
                        </Box>
                      );
                    })}
                  </React.Fragment>
                ));
              })()}
            </>
          )}
        </Box>

        {direction === 'outgoing' && (
          <Box sx={{ flexShrink: 0, pt: 1, pb: 3 }}>
            <Button
              fullWidth
              variant="contained"
              onClick={handleStartSettle}
              sx={{
                height: 56, borderRadius: 2, bgcolor: buttonBg, color: buttonText,
                fontWeight: 800, letterSpacing: '0.05em', fontSize: '1rem',
                boxShadow: `0 0 20px ${alpha(buttonBg, 0.25)}`,
                '&:hover': { bgcolor: buttonHover, boxShadow: `0 0 30px ${alpha(buttonBg, 0.35)}` },
              }}
            >
              Settle Up
            </Button>
          </Box>
        )}
      </Box>
    );
  };

  // ------------------------------------------------------------------
  // Render: Step 1 - Select Expenses
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
  // Render: Step 2 - Amount (Full / Partial)
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
  // Render: Step 3 - Confirm
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
  // Render: Success State
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

  // ------------------------------------------------------------------
  // Render: Settle stepper
  // ------------------------------------------------------------------
  const renderSettleView = () => {
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
            <Button onClick={() => { setView('breakdown'); resetSettleState(); }} variant="outlined" sx={{ flex: 1, fontSize: '0.85rem' }}>
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
  };

  return (
    <MobileDrawer open={open} onClose={handleClose} title={view === 'settle' ? 'Settle Up' : 'Balance'} fullScreen={fullScreen}>
      {displayItem && (
        view === 'settle' ? renderSettleView() : renderBreakdownView()
      )}
    </MobileDrawer>
  );
}
