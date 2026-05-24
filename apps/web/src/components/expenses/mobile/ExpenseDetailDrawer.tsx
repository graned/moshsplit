import { useMemo, useRef } from 'react';
import { Box, Typography, alpha, useTheme, Divider } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import {
  Person as PersonIcon,
  CalendarToday as CalendarIcon,
  Category as CategoryIcon,
  Notes as NotesIcon,
} from '@mui/icons-material';

import { MobileDrawer } from '../../shared/MobileDrawer';
import { expensesApi } from '../../../api/expenses.api';
import { ExpenseActivity } from '../../../api/activity.api';
import { UserInfo } from '../../../api/users.api';

const EXPENSE_TYPE_LABELS: Record<string, string> = {
  food: 'Food',
  beer: 'Beer',
  gas: 'Gas',
  transport: 'Transport',
  merch: 'Merch',
  camping: 'Camping',
};

function formatAmount(cents: number, currency = 'EUR') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(cents / 100);
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

interface ExpenseDetailDrawerProps {
  open: boolean;
  onClose: () => void;
  expense: ExpenseActivity | null;
  eventId: string;
  currency?: string;
  userMap: Record<string, UserInfo>;
}

export function ExpenseDetailDrawer({
  open,
  onClose,
  expense,
  eventId,
  currency = 'EUR',
  userMap,
}: ExpenseDetailDrawerProps) {
  const theme = useTheme();
  const cachedExpense = useRef(expense);
  if (expense) cachedExpense.current = expense;
  const displayExpense = expense || cachedExpense.current;

  const { data: fullExpense } = useQuery({
    queryKey: ['expense', expense?.id],
    queryFn: () => expensesApi.get(eventId, expense!.id),
    enabled: open && !!expense?.id && !!eventId,
    staleTime: 1000 * 60,
  });

  const categoryLabel = displayExpense?.expense_type
    ? EXPENSE_TYPE_LABELS[displayExpense.expense_type] || displayExpense.expense_type
    : null;

  const notes = fullExpense?.current_version?.notes;

  // Try to extract participant_ids from response (may be present even if not typed)
  const participantIds = useMemo(() => {
    const raw = (fullExpense as unknown as Record<string, unknown>)?.participant_ids;
    if (Array.isArray(raw)) return raw as string[];
    return undefined;
  }, [fullExpense]);

  const participants = useMemo(() => {
    if (!participantIds) return undefined;
    return participantIds
      .map((id) => userMap[id])
      .filter((u): u is UserInfo => !!u);
  }, [participantIds, userMap]);

  const payerInfo = displayExpense?.paid_by ? userMap[displayExpense.paid_by] : undefined;
  const payerName = payerInfo
    ? `${payerInfo.firstName} ${payerInfo.lastName}`.trim() || payerInfo.email
    : displayExpense?.paid_by ?? 'Unknown';

  return (
    <MobileDrawer open={open} onClose={onClose} title="Expense Details">
      {displayExpense && (
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            overflow: 'auto',
            pb: 3,
            pt: 2,
          }}
        >
          {/* Large amount */}
          <Typography
            sx={{
              fontSize: '2rem',
              fontWeight: 800,
              background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              textAlign: 'center',
              mb: 1,
            }}
          >
            {formatAmount(displayExpense.amount_cents, currency)}
          </Typography>

          {/* Title */}
          <Typography
            sx={{
              fontSize: '1.1rem',
              fontWeight: 700,
              textAlign: 'center',
              color: 'text.primary',
              mb: 1,
            }}
          >
            {displayExpense.title}
          </Typography>

          <Divider sx={{ borderColor: alpha('#fff', 0.08) }} />

          {/* Detail rows */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {/* Payer */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <PersonIcon sx={{ fontSize: 18, color: 'text.secondary', flexShrink: 0 }} />
              <Typography variant="body2" color="text.secondary" sx={{ flexShrink: 0 }}>
                Paid by:
              </Typography>
              <Typography variant="body2" fontWeight={600} color="text.primary">
                {payerName}
              </Typography>
            </Box>

            {/* Category */}
            {categoryLabel && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CategoryIcon sx={{ fontSize: 18, color: 'text.secondary', flexShrink: 0 }} />
                <Typography variant="body2" color="text.secondary" sx={{ flexShrink: 0 }}>
                  Category:
                </Typography>
                <Typography
                  sx={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    color: theme.palette.primary.main,
                    bgcolor: alpha(theme.palette.primary.main, 0.1),
                    px: 0.75,
                    py: 0.2,
                    borderRadius: 0.75,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}
                >
                  {categoryLabel}
                </Typography>
              </Box>
            )}

            {/* Date */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CalendarIcon sx={{ fontSize: 18, color: 'text.secondary', flexShrink: 0 }} />
              <Typography variant="body2" color="text.secondary" sx={{ flexShrink: 0 }}>
                Date:
              </Typography>
              <Typography variant="body2" fontWeight={500} color="text.primary">
                {formatDate(displayExpense.created_at)}
              </Typography>
            </Box>

            {/* Participants */}
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
              <PersonIcon sx={{ fontSize: 18, color: 'text.secondary', flexShrink: 0, mt: 0.3 }} />
              <Box sx={{ flex: 1 }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                  Split between {displayExpense.participant_count}{' '}
                  {displayExpense.participant_count === 1 ? 'person' : 'people'}:
                </Typography>
                {participants && participants.length > 0 ? (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                    {participants.map((p) => (
                      <Typography
                        key={p.id}
                        variant="body2"
                        fontWeight={500}
                        color="text.primary"
                        sx={{ pl: 1 }}
                      >
                        •{' '}
                        {`${p.firstName} ${p.lastName}`.trim() ||
                          p.email.split('@')[0]}
                      </Typography>
                    ))}
                  </Box>
                ) : (
                  <Typography variant="body2" color="text.secondary" sx={{ pl: 1 }}>
                    • {displayExpense.participant_count} participant{(displayExpense.participant_count ?? 0) > 1 ? 's' : ''}
                  </Typography>
                )}
              </Box>
            </Box>
          </Box>

          {/* Notes */}
          {notes && (
            <>
              <Divider sx={{ borderColor: alpha('#fff', 0.08) }} />
              <Box sx={{ display: 'flex', gap: 1 }}>
                <NotesIcon sx={{ fontSize: 18, color: 'text.secondary', flexShrink: 0, mt: 0.3 }} />
                <Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                    Notes:
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.primary"
                    sx={{
                      whiteSpace: 'pre-wrap',
                      lineHeight: 1.6,
                      bgcolor: alpha('#fff', 0.03),
                      p: 1.5,
                      borderRadius: 1.5,
                    }}
                  >
                    {notes}
                  </Typography>
                </Box>
              </Box>
            </>
          )}
        </Box>
      )}
    </MobileDrawer>
  );
}
