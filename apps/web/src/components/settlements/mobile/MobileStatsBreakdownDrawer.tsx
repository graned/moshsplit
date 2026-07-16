import { useMemo } from 'react';
import { Box, Typography, alpha } from '@mui/material';
import { Receipt as ReceiptIcon, Handshake as HandshakeIcon } from '@mui/icons-material';

import { MobileDrawer } from '../../shared/MobileDrawer';
import { useUserCache } from '../../../hooks/useUserCache';

function formatAmount(cents: number, currency = 'EUR') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.abs(cents) / 100);
}

export interface BreakdownItem {
  expense_id?: string;
  label: string;
  amount: number;
  type: 'expense' | 'settlement' | 'reimbursement';
  counterparty?: string;
  direction?: 'incoming' | 'outgoing';
  created_at?: string;
}

interface MobileStatsBreakdownDrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  items: BreakdownItem[];
  total: number;
  currency?: string;
  totalColor?: string;
}

export function MobileStatsBreakdownDrawer({
  open,
  onClose,
  title,
  items,
  total,
  currency = 'EUR',
  totalColor,
}: MobileStatsBreakdownDrawerProps) {
  const { getUser } = useUserCache();

  const resolvedItems = useMemo(() => {
    return items.map((item) => {
      if (item.counterparty) {
        const user = getUser(item.counterparty);
        const name = user
          ? `${user.firstName} ${user.lastName}`.trim() || user.email.split('@')[0]
          : item.counterparty.slice(0, 8);
        if (item.type === 'settlement') {
          const isIncoming = item.direction === 'incoming' || item.amount >= 0;
          return {
            ...item,
            label: isIncoming ? `Paid by ${name}` : `Paid to ${name}`,
          };
        }
      }
      return item;
    });
  }, [items, getUser]);

  const defaultColor = total > 0
    ? '#22c55e'
    : total < 0
      ? '#ef4444'
      : '#9ca3af';

  return (
    <MobileDrawer open={open} onClose={onClose} title={title}>
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 0,
          overflow: 'auto',
          pb: 3,
          pt: 2,
        }}
      >
        {resolvedItems.length === 0 && (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <Typography variant="body2" color="text.secondary">
              No items to show.
            </Typography>
          </Box>
        )}

        {resolvedItems.map((item, idx) => {
          const isPositive = item.amount >= 0;
          const isSettlement = item.type === 'settlement';
          const amountColor = isSettlement
            ? alpha('#F59E0B', 0.9)
            : isPositive
              ? '#22c55e'
              : '#ef4444';

          return (
            <Box
              key={`${item.label}-${idx}`}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                px: 0.5,
                py: 1.25,
                borderBottom: idx < resolvedItems.length - 1 ? `1px solid ${alpha('#fff', 0.06)}` : 'none',
              }}
            >
              <Box
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: 1.5,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: isSettlement
                    ? alpha('#F59E0B', 0.12)
                    : isPositive
                      ? alpha('#22c55e', 0.12)
                      : alpha('#ef4444', 0.12),
                  flexShrink: 0,
                }}
              >
                {isSettlement ? (
                  <HandshakeIcon sx={{ fontSize: 16, color: alpha('#F59E0B', 0.7) }} />
                ) : (
                  <ReceiptIcon sx={{ fontSize: 16, color: amountColor }} />
                )}
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
                {isSettlement && (
                  <Typography
                    sx={{
                      fontSize: '0.65rem',
                      fontWeight: 600,
                      color: alpha('#F59E0B', 0.7),
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      mt: 0.15,
                    }}
                  >
                    Settlement
                  </Typography>
                )}
              </Box>

              <Typography
                sx={{
                  fontSize: '0.9rem',
                  fontWeight: 700,
                  color: amountColor,
                  flexShrink: 0,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {isPositive ? '' : '−'}{formatAmount(item.amount, currency)}
              </Typography>
            </Box>
          );
        })}

        {/* Total row */}
        {resolvedItems.length > 0 && (
          <>
            <Box sx={{ height: 1, bgcolor: alpha('#fff', 0.1), my: 1.5 }} />
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                px: 0.5,
                py: 0.5,
              }}
            >
              <Typography
                sx={{
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  color: alpha('#fff', 0.6),
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                Total
              </Typography>
              <Typography
                sx={{
                  fontSize: '1.1rem',
                  fontWeight: 800,
                  color: totalColor || defaultColor,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {total >= 0 ? '' : '−'}{formatAmount(total, currency)}
              </Typography>
            </Box>
          </>
        )}
      </Box>
    </MobileDrawer>
  );
}
