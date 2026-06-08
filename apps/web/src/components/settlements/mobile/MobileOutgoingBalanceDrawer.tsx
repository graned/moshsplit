import { useRef } from 'react';
import { Box, Typography, Button, alpha } from '@mui/material';
import { Receipt as ReceiptIcon, Handshake as HandshakeIcon } from '@mui/icons-material';

import { MobileDrawer } from '../../shared/MobileDrawer';
import { OutgoingBalanceItem } from '../../../api/settlements.api';
import { useUserCache } from '../../../hooks/useUserCache';
import type { BreakdownItem } from './MobileStatsBreakdownDrawer';

function formatAmount(cents: number, currency = 'EUR') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.abs(cents) / 100);
}

interface MobileOutgoingBalanceDrawerProps {
  open: boolean;
  onClose: () => void;
  balanceItem: OutgoingBalanceItem | null;
  currency?: string;
  onSettle: (userId: string, amountCents: number) => void;
  breakdownItems?: BreakdownItem[];
  breakdownTotal?: number;
  fullScreen?: boolean;
}

export function MobileOutgoingBalanceDrawer({
  open,
  onClose,
  balanceItem,
  currency = 'EUR',
  onSettle,
  breakdownItems = [],
  breakdownTotal = 0,
  fullScreen,
}: MobileOutgoingBalanceDrawerProps) {
  const { getUser } = useUserCache();

  const cachedItem = useRef(balanceItem);
  if (balanceItem) cachedItem.current = balanceItem;
  const displayItem = balanceItem || cachedItem.current;

  const user = displayItem ? getUser(displayItem.user_id) : null;
  const displayName = user
    ? `${user.firstName} ${user.lastName}`.trim() || user.email.split('@')[0]
    : displayItem?.user_id.slice(0, 8) ?? '';

  return (
    <MobileDrawer open={open} onClose={onClose} title="Balance" fullScreen={fullScreen}>
      {displayItem && (
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            height: 0,
          }}
        >
          {/* Fixed header */}
          <Typography
            sx={{
              fontSize: '1rem',
              fontWeight: 600,
              color: 'text.secondary',
              textAlign: 'center',
              pt: 2,
              pb: 0.5,
            }}
          >
            You owe {displayName}
          </Typography>

          <Typography
            sx={{
              fontSize: '2.5rem',
              fontWeight: 800,
              background: `linear-gradient(135deg, #ef4444, #b91c1c)`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              lineHeight: 1.1,
              textAlign: 'center',
              pb: 1.5,
            }}
          >
            {formatAmount(displayItem.amount_cents, currency)}
          </Typography>

          {/* Scrollable breakdown */}
          <Box sx={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
            {breakdownItems.length > 0 && (
              <>
                <Typography
                  sx={{
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    color: alpha('#fff', 0.4),
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    mt: 1,
                    mb: 0.5,
                  }}
                >
                  Breakdown
                </Typography>
                {breakdownItems.map((item, idx) => {
                  const isPositive = item.amount >= 0;
                  const isSettlement = item.type === 'settlement';
                  const amountColor = isSettlement
                    ? alpha('#F59E0B', 0.9)
                    : '#ef4444';
                  return (
                    <Box
                      key={`${item.label}-${idx}`}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.5,
                        py: 0.75,
                        borderBottom: idx < breakdownItems.length - 1 ? `1px solid ${alpha('#fff', 0.05)}` : 'none',
                      }}
                    >
                      <Box
                        sx={{
                          width: 28,
                          height: 28,
                          borderRadius: 1.5,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          bgcolor: isSettlement ? alpha('#F59E0B', 0.12) : alpha('#ef4444', 0.12),
                          flexShrink: 0,
                        }}
                      >
                        {isSettlement ? (
                          <HandshakeIcon sx={{ fontSize: 14, color: alpha('#F59E0B', 0.7) }} />
                        ) : (
                          <ReceiptIcon sx={{ fontSize: 14, color: amountColor }} />
                        )}
                      </Box>
                      <Typography
                        sx={{
                          flex: 1,
                          fontSize: '0.8rem',
                          fontWeight: 500,
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
                          fontSize: '0.8rem',
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
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 0.75, mt: 0.25 }}>
                  <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: alpha('#fff', 0.5), textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Total
                  </Typography>
                  <Typography sx={{ fontSize: '0.85rem', fontWeight: 800, color: '#ef4444', fontVariantNumeric: 'tabular-nums' }}>
                    {formatAmount(breakdownTotal, currency)}
                  </Typography>
                </Box>
              </>
            )}
          </Box>

          {/* Settle CTA */}
          <Box sx={{ flexShrink: 0, pt: 1, pb: 3 }}>
            <Button
              fullWidth
              variant="contained"
              onClick={() => {
                onSettle(displayItem.user_id, displayItem.amount_cents);
                onClose();
              }}
              sx={{
                height: 56,
                borderRadius: 2,
                bgcolor: '#ef4444',
                color: '#fff',
                fontWeight: 800,
                letterSpacing: '0.05em',
                fontSize: '1rem',
                boxShadow: `0 0 20px ${alpha('#ef4444', 0.25)}`,
                '&:hover': {
                  bgcolor: '#b91c1c',
                  boxShadow: `0 0 30px ${alpha('#ef4444', 0.35)}`,
                },
              }}
            >
              Settle Up
            </Button>
          </Box>
        </Box>
      )}
    </MobileDrawer>
  );
}
