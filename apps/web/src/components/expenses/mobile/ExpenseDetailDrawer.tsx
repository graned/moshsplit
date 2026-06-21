import { useRef, useMemo } from 'react';
import { Box, Typography, alpha, useTheme, Divider, Skeleton, Avatar, IconButton, Tooltip } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import {
  Edit as EditIcon,
  Person as PersonIcon,
  CalendarToday as CalendarIcon,
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
  transport: 'Travel',
  merch: 'Merch',
  camping: 'Camping',
};

const EXPENSE_TYPE_COLORS: Record<string, string> = {
  food: '#E85D04',
  beer: '#F4A261',
  gas: '#6C757D',
  transport: '#2A9D8F',
  merch: '#9B5DE5',
  camping: '#52B788',
};

function formatAmount(cents: number, currency = 'EUR') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function formatShortDate(dateStr: string) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-US', {
    month: 'short',
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
  onEdit?: (data: {
    id: string;
    title: string;
    amount_cents: number;
    paid_by: string;
    split_data: Record<string, unknown>;
    notes?: string;
    expense_type?: string;
  }) => void;
}

export function ExpenseDetailDrawer({
  open,
  onClose,
  expense,
  eventId,
  currency = 'EUR',
  userMap,
  onEdit,
}: ExpenseDetailDrawerProps) {
  const theme = useTheme();
  const cachedExpense = useRef(expense);
  if (expense) cachedExpense.current = expense;
  const displayExpense = expense || cachedExpense.current;

  const { data: fullExpense, isLoading } = useQuery({
    queryKey: ['expense', eventId, displayExpense?.id],
    queryFn: () => expensesApi.get(eventId, displayExpense!.id),
    enabled: open && !!displayExpense?.id && !!eventId,
    staleTime: 1000 * 60,
  });

  const categoryLabel = displayExpense?.expense_type
    ? EXPENSE_TYPE_LABELS[displayExpense.expense_type] || displayExpense.expense_type
    : null;
  const categoryColor = displayExpense?.expense_type
    ? EXPENSE_TYPE_COLORS[displayExpense.expense_type]
    : theme.palette.primary.main;

  const notes = fullExpense?.current_version?.notes;

  type Share = { user_id: string; share_cents: number };
  const shares: Share[] = (fullExpense?.current_version as { shares: Share[] } | undefined)?.shares || [];
  const participantIds = shares.map((s) => s.user_id);
  const participants = useMemo((): { user: UserInfo | undefined; share: number }[] => {
    return participantIds.map((id) => ({
      user: userMap[id],
      share: shares.find((s) => s.user_id === id)?.share_cents || 0,
    }));
  }, [participantIds, shares, userMap]);

  const payerInfo = displayExpense?.paid_by ? userMap[displayExpense.paid_by] : undefined;
  const payerName = payerInfo
    ? `${payerInfo.firstName} ${payerInfo.lastName}`.trim() || payerInfo.email
    : displayExpense?.paid_by ?? 'Unknown';

  const perPersonShare: number | null = shares.length > 0 ? shares[0]?.share_cents : null;
  const shareLabel = perPersonShare != null ? formatAmount(perPersonShare, currency) : null;

  const handleEdit = () => {
    if (!fullExpense?.current_version || !displayExpense) return;
    const v = fullExpense.current_version;
    onEdit?.({
      id: displayExpense.id,
      title: v.title,
      amount_cents: v.amount_cents,
      paid_by: v.paid_by,
      split_data: v.split_data,
      notes: v.notes,
      expense_type: displayExpense.expense_type,
    });
  };

  return (
    <MobileDrawer
      open={open}
      onClose={onClose}
      title="Expense Details"
      clearAction={
        <Tooltip title="Edit expense">
          <IconButton
            onClick={handleEdit}
            size="small"
            disabled={isLoading}
            sx={{
              color: theme.palette.primary.main,
              bgcolor: alpha(theme.palette.primary.main, 0.1),
              width: 32,
              height: 32,
              '&:hover': {
                bgcolor: alpha(theme.palette.primary.main, 0.2),
              },
            }}
          >
            <EditIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
      }
    >
      {isLoading ? (
        <LoadingSkeleton />
      ) : (
        displayExpense && (
          <Box
            sx={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'auto',
              pb: 3,
              pt: 1,
            }}
          >
            {/* Category pill + title */}
            <Box sx={{ textAlign: 'center', mb: 2 }}>
              {categoryLabel && (
                <Box
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 0.5,
                    mb: 1,
                    px: 1,
                    py: 0.35,
                    borderRadius: 1.5,
                    backgroundColor: alpha(categoryColor, 0.12),
                    border: `1px solid ${alpha(categoryColor, 0.3)}`,
                  }}
                >
                  <Typography
                    component="span"
                    sx={{
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      color: categoryColor,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      lineHeight: 1,
                    }}
                  >
                    {categoryLabel}
                  </Typography>
                </Box>
              )}
              <Typography
                sx={{
                  fontSize: '1.1rem',
                  fontWeight: 700,
                  color: 'text.primary',
                  lineHeight: 1.3,
                  px: 1,
                }}
              >
                {displayExpense.title}
              </Typography>
            </Box>

            {/* Large amount */}
            <Box sx={{ textAlign: 'center', mb: 2.5 }}>
              <Typography
                sx={{
                  fontSize: '2.5rem',
                  fontWeight: 800,
                  background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  lineHeight: 1.1,
                }}
              >
                {formatAmount(displayExpense.amount_cents, currency)}
              </Typography>
            </Box>

            {/* Meta row: payer + date */}
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'center',
                gap: 2,
                mb: 2,
                flexWrap: 'wrap',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <PersonIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                <Typography variant="body2" color="text.secondary">
                  {payerName}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <CalendarIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                <Typography variant="body2" color="text.secondary">
                  {formatShortDate(displayExpense.created_at)}
                </Typography>
              </Box>
            </Box>

            <Divider sx={{ borderColor: alpha('#fff', 0.07), mb: 2 }} />

            {/* Split section */}
            <Box sx={{ flex: 1, mb: 2 }}>
              <Typography
                variant="body2"
                fontWeight={700}
                color="text.primary"
                sx={{ fontSize: '0.85rem', mb: 1 }}
              >
                {shares.length || displayExpense.participant_count}{' '}
                {(shares.length || displayExpense.participant_count || 0) === 1 ? 'person' : 'people'}
                {' — '}
                {shareLabel && shares.length > 1 ? `${formatAmount(perPersonShare || 0, currency)} each` : 'split'}
              </Typography>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                {participants.length > 0 ? (
                      participants.map(({ user, share }: { user: UserInfo | undefined; share: number }) => {
                    const name = user
                      ? `${user.firstName} ${user.lastName}`.trim() || user.email.split('@')[0]
                      : 'Unknown';
                    const initials = name.charAt(0).toUpperCase();
                    return (
                      <Box
                        key={user?.id || 'unknown'}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1.25,
                          px: 1.5,
                          py: 1,
                          borderRadius: 2,
                          bgcolor: alpha('#fff', 0.03),
                          border: '1px solid',
                          borderColor: alpha('#fff', 0.06),
                        }}
                      >
                        <Avatar
                          sx={{
                            width: 36,
                            height: 36,
                            bgcolor: alpha(categoryColor, 0.15),
                            color: categoryColor,
                            fontSize: '0.9rem',
                            fontWeight: 700,
                            flexShrink: 0,
                          }}
                        >
                          {initials}
                        </Avatar>
                        <Typography
                          variant="body2"
                          sx={{ fontSize: '0.9rem', fontWeight: 600, color: 'text.primary', flex: 1 }}
                        >
                          {name}
                        </Typography>
                        <Typography
                          variant="body2"
                          sx={{
                            fontSize: '0.9rem',
                            fontWeight: 700,
                            color: categoryColor,
                          }}
                        >
                          {formatAmount(share, currency)}
                        </Typography>
                      </Box>
                    );
                  })
                ) : (
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.25,
                      px: 1.5,
                      py: 1,
                      borderRadius: 2,
                      bgcolor: alpha('#fff', 0.03),
                    }}
                  >
                    <Avatar
                      sx={{
                        width: 36,
                        height: 36,
                        bgcolor: alpha(categoryColor, 0.15),
                        color: categoryColor,
                        fontSize: '0.9rem',
                        fontWeight: 700,
                      }}
                    >
                      ?
                    </Avatar>
                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.85rem' }}>
                      {displayExpense.participant_count || 0} participants
                    </Typography>
                  </Box>
                )}
              </Box>
            </Box>

            {/* Notes */}
            <Box>
              <Divider sx={{ borderColor: alpha('#fff', 0.07), mb: 1.5 }} />
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 1 }}>
                <NotesIcon sx={{ fontSize: 16, color: 'text.secondary', flexShrink: 0, mt: 0.4 }} />
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem', mb: 0.5 }}>
                  Notes
                </Typography>
              </Box>
              <Box
                sx={{
                  px: 1.5,
                  py: 1.25,
                  borderRadius: 1.5,
                  bgcolor: alpha('#fff', 0.03),
                  border: '1px solid',
                  borderColor: alpha('#fff', 0.06),
                  minHeight: 52,
                }}
              >
                <Typography
                  variant="body2"
                  color={notes ? 'text.primary' : 'text.disabled'}
                  sx={{
                    fontSize: '0.85rem',
                    whiteSpace: 'pre-wrap',
                    lineHeight: 1.6,
                    fontStyle: notes ? 'normal' : 'italic',
                  }}
                >
                  {notes || 'No notes'}
                </Typography>
              </Box>
            </Box>
          </Box>
        )
      )}
    </MobileDrawer>
  );
}

function LoadingSkeleton() {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
        <Skeleton variant="rounded" width={60} height={22} sx={{ borderRadius: 1.5 }} />
        <Skeleton variant="text" width="60%" height={28} />
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'center' }}>
        <Skeleton variant="text" width={140} height={56} sx={{ fontSize: '2.5rem' }} />
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2 }}>
        <Skeleton variant="text" width={80} height={20} />
        <Skeleton variant="text" width={100} height={20} />
      </Box>
      <Skeleton variant="rectangular" height={1} sx={{ borderRadius: 1, mx: -2 }} />
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
        {[1, 2, 3].map((i) => (
          <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.25 }}>
            <Skeleton variant="circular" width={28} height={28} />
            <Skeleton variant="text" width="50%" height={18} />
            <Box sx={{ flex: 1 }} />
            <Skeleton variant="text" width={50} height={18} />
          </Box>
        ))}
      </Box>
    </Box>
  );
}