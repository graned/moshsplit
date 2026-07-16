import { useState, useMemo } from 'react';
import { Box, Typography, Button, TextField, Checkbox, alpha } from '@mui/material';
import { Receipt as ReceiptIcon, DoneAll as DoneAllIcon, Clear as ClearIcon } from '@mui/icons-material';

function formatAmount(cents: number, currency = 'EUR') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.abs(cents) / 100);
}

export interface ExpensePickerItem {
  expense_id: string;
  label: string;
  amount_cents: number;
}

export interface SelectedExpense {
  expense_id: string;
  label: string;
  original_amount_cents: number;
  settle_amount_cents: number;
}

interface MobileExpensePickerProps {
  items: ExpensePickerItem[];
  currency?: string;
  amountColor: string;
  onSelectionChange: (selected: SelectedExpense[]) => void;
}

export function MobileExpensePicker({
  items,
  currency = 'EUR',
  amountColor,
  onSelectionChange,
}: MobileExpensePickerProps) {
  // Track which expenses are selected for full settlement
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // Track partial amounts (only for expenses not fully selected)
  const [partialAmounts, setPartialAmounts] = useState<Record<string, number>>({});

  const totalAvailable = useMemo(
    () => items.reduce((sum, item) => sum + item.amount_cents, 0),
    [items],
  );

  const selectedTotal = useMemo(() => {
    let total = 0;
    for (const item of items) {
      if (selectedIds.has(item.expense_id)) {
        total += item.amount_cents;
      } else if (partialAmounts[item.expense_id]) {
        total += partialAmounts[item.expense_id];
      }
    }
    return total;
  }, [items, selectedIds, partialAmounts]);

  const handleSelectAll = () => {
    const allIds = new Set(items.map((item) => item.expense_id));
    setPartialAmounts({});
    setSelectedIds(allIds);
    const newSelection: SelectedExpense[] = items.map((item) => ({
      expense_id: item.expense_id,
      label: item.label,
      original_amount_cents: item.amount_cents,
      settle_amount_cents: item.amount_cents,
    }));
    onSelectionChange(newSelection);
  };

  const handleClearAll = () => {
    setSelectedIds(new Set());
    setPartialAmounts({});
    onSelectionChange([]);
  };

  const handleToggleFull = (expenseId: string, isSelected: boolean) => {
    const newSelected = new Set(selectedIds);
    if (isSelected) {
      newSelected.add(expenseId);
      // Remove partial amount if switching to full
      const newPartial = { ...partialAmounts };
      delete newPartial[expenseId];
      setPartialAmounts(newPartial);
    } else {
      newSelected.delete(expenseId);
    }
    setSelectedIds(newSelected);
    updateSelection(newSelected, partialAmounts);
  };

  const handlePartialChange = (expenseId: string, value: number) => {
    const item = items.find((i) => i.expense_id === expenseId);
    if (!item) return;

    // Clamp value between 0 and the expense amount
    const clampedValue = Math.max(0, Math.min(item.amount_cents, value));

    const newPartial = { ...partialAmounts, [expenseId]: clampedValue };
    // If partial equals full amount, treat as full selection
    if (clampedValue === item.amount_cents) {
      const newSelected = new Set(selectedIds);
      newSelected.add(expenseId);
      setSelectedIds(newSelected);
      const newPartialClean = { ...partialAmounts };
      delete newPartialClean[expenseId];
      setPartialAmounts(newPartialClean);
      updateSelection(newSelected, newPartialClean);
    } else {
      // Remove from full selection if partial is different
      const newSelected = new Set(selectedIds);
      newSelected.delete(expenseId);
      setSelectedIds(newSelected);
      setPartialAmounts(newPartial);
      updateSelection(newSelected, newPartial);
    }
  };

  const updateSelection = (
    selected: Set<string>,
    partial: Record<string, number>,
  ) => {
    const result: SelectedExpense[] = [];
    for (const item of items) {
      if (selected.has(item.expense_id)) {
        result.push({
          expense_id: item.expense_id,
          label: item.label,
          original_amount_cents: item.amount_cents,
          settle_amount_cents: item.amount_cents,
        });
      } else if (partial[item.expense_id] && partial[item.expense_id] > 0) {
        result.push({
          expense_id: item.expense_id,
          label: item.label,
          original_amount_cents: item.amount_cents,
          settle_amount_cents: partial[item.expense_id],
        });
      }
    }
    onSelectionChange(result);
  };

  const allSelected = items.length > 0 && selectedIds.size === items.length;
  const someSelected = selectedIds.size > 0 || Object.keys(partialAmounts).length > 0;

  return (
    <Box sx={{ py: 2 }}>
      {/* Header with total */}
      <Box sx={{ textAlign: 'center', mb: 3 }}>
        <Typography
          sx={{
            fontSize: '0.65rem',
            fontWeight: 700,
            color: alpha('#fff', 0.4),
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            mb: 0.5,
          }}
        >
          Select expenses to settle
        </Typography>
        <Typography
          sx={{
            fontSize: '1.75rem',
            fontWeight: 800,
            color: amountColor,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {formatAmount(selectedTotal, currency)}
        </Typography>
        <Typography sx={{ fontSize: '0.7rem', color: alpha('#fff', 0.4), mt: 0.25 }}>
          of {formatAmount(totalAvailable, currency)} available
        </Typography>
      </Box>

      {/* Select All / Clear buttons */}
      <Box sx={{ display: 'flex', gap: 1, mb: 2, px: 0.5 }}>
        <Button
          onClick={handleSelectAll}
          disabled={allSelected}
          startIcon={<DoneAllIcon sx={{ fontSize: 18 }} />}
          sx={{
            flex: 1,
            fontSize: '0.75rem',
            fontWeight: 700,
            color: allSelected ? alpha('#fff', 0.3) : amountColor,
            borderColor: allSelected ? alpha('#fff', 0.1) : alpha(amountColor, 0.3),
            py: 1,
            '&:hover': {
              bgcolor: alpha(amountColor, 0.08),
              borderColor: amountColor,
            },
          }}
          variant="outlined"
        >
          Select All
        </Button>
        <Button
          onClick={handleClearAll}
          disabled={!someSelected}
          startIcon={<ClearIcon sx={{ fontSize: 18 }} />}
          sx={{
            flex: 1,
            fontSize: '0.75rem',
            fontWeight: 700,
            color: someSelected ? alpha('#fff', 0.6) : alpha('#fff', 0.3),
            borderColor: alpha('#fff', 0.1),
            py: 1,
            '&:hover': {
              bgcolor: alpha('#fff', 0.04),
              borderColor: alpha('#fff', 0.2),
            },
          }}
          variant="outlined"
        >
          Clear
        </Button>
      </Box>

      {/* Expense list */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {items.map((item) => {
          const isFullSelected = selectedIds.has(item.expense_id);
          const partialAmount = partialAmounts[item.expense_id] ?? 0;
          const hasPartial = !isFullSelected && partialAmount > 0;
          const isActive = isFullSelected || hasPartial;

          return (
            <Box
              key={item.expense_id}
              sx={{
                p: 1.5,
                borderRadius: 2,
                bgcolor: isActive ? alpha(amountColor, 0.08) : alpha('#fff', 0.02),
                border: `1px solid ${isActive ? alpha(amountColor, 0.25) : alpha('#fff', 0.06)}`,
                transition: 'all 0.15s ease',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Checkbox
                  checked={isFullSelected}
                  onChange={(e) => handleToggleFull(item.expense_id, e.target.checked)}
                  sx={{
                    p: 0.5,
                    color: alpha('#fff', 0.3),
                    '&.Mui-checked': { color: amountColor },
                  }}
                />
                <Box
                  sx={{
                    width: 32,
                    height: 32,
                    borderRadius: 1.5,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: alpha(amountColor, 0.12),
                    flexShrink: 0,
                  }}
                >
                  <ReceiptIcon sx={{ fontSize: 16, color: amountColor }} />
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography
                    sx={{
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      color: 'text.primary',
                      lineHeight: 1.3,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {item.label}
                  </Typography>
                  <Typography
                    sx={{
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      color: alpha('#fff', 0.4),
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {formatAmount(item.amount_cents, currency)}
                  </Typography>
                </Box>
              </Box>

              {!isFullSelected && (
                <Box sx={{ mt: 1.5, pl: 5.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: amountColor, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Enter amount
                    </Typography>
                    <TextField
                      type="text"
                      inputMode="decimal"
                      size="small"
                      placeholder="0"
                      value={partialAmount > 0 ? (partialAmount / 100).toFixed(2) : ''}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/[^0-9.]/g, '');
                        if (raw === '') {
                          handlePartialChange(item.expense_id, 0);
                          return;
                        }
                        const val = parseFloat(raw);
                        if (!isNaN(val)) {
                          handlePartialChange(item.expense_id, Math.round(val * 100));
                        }
                      }}
                      sx={{
                        width: 80,
                        '& .MuiInputBase-root': {
                          bgcolor: alpha('#fff', 0.04),
                          borderRadius: 1,
                          '&::before, &::after': { display: 'none' },
                        },
                        '& .MuiInputBase-input': {
                          fontSize: '0.85rem',
                          fontWeight: 700,
                          color: amountColor,
                          textAlign: 'center',
                          padding: '6px 8px',
                        },
                      }}
                    />
                    <Typography sx={{ fontSize: '0.65rem', color: alpha('#fff', 0.3) }}>
                      of {formatAmount(item.amount_cents, currency)}
                    </Typography>
                  </Box>
                  {partialAmount > item.amount_cents && (
                    <Typography sx={{ fontSize: '0.65rem', color: 'error.main', mt: 0.5 }}>
                      Cannot exceed expense amount
                    </Typography>
                  )}
                </Box>
              )}
            </Box>
          );
        })}
      </Box>

      {items.length === 0 && (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Typography variant="body2" color="text.secondary">
            No expenses to settle.
          </Typography>
        </Box>
      )}
    </Box>
  );
}
