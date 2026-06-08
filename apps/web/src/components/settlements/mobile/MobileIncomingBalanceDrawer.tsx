import { useRef } from 'react';
import { Box, Typography, Button, Avatar, alpha, useTheme } from '@mui/material';
import { Person as PersonIcon, Receipt as ReceiptIcon, Handshake as HandshakeIcon } from '@mui/icons-material';

import { MobileDrawer } from '../../shared/MobileDrawer';
import { IncomingBalanceItem } from '../../../api/settlements.api';
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

interface MobileIncomingBalanceDrawerProps {
  open: boolean;
  onClose: () => void;
  balanceItem: IncomingBalanceItem | null;
  currency?: string;
  onSettle: (userId: string, amountCents: number) => void;
  breakdownItems?: BreakdownItem[];
  breakdownTotal?: number;
}

export function MobileIncomingBalanceDrawer({
  open,
  onClose,
  balanceItem,
  currency = 'EUR',
  onSettle,
  breakdownItems = [],
  breakdownTotal = 0,
}: MobileIncomingBalanceDrawerProps) {
  const theme = useTheme();
  const { getUser } = useUserCache();

  // Cache last non-null item for smooth animation when item becomes null
  const cachedItem = useRef(balanceItem);
  if (balanceItem) cachedItem.current = balanceItem;
  const displayItem = balanceItem || cachedItem.current;

  const user = displayItem ? getUser(displayItem.user_id) : null;
  const displayName = user
    ? `${user.firstName} ${user.lastName}`.trim() || user.email.split('@')[0]
    : displayItem?.user_id.slice(0, 8) ?? '';

  return (
    <MobileDrawer open={open} onClose={onClose} title="Balance">
      {displayItem && (
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: 2.5,
            overflow: 'auto',
            pb: 3,
            pt: 2,
          }}
        >
          {/* Avatar + name */}
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <Avatar
              sx={{
                width: 72,
                height: 72,
                bgcolor: alpha(theme.palette.primary.main, 0.15),
                color: theme.palette.primary.main,
                fontSize: '1.75rem',
                fontWeight: 700,
                border: `2px solid ${alpha(theme.palette.primary.main, 0.3)}`,
              }}
            >
              {displayName.charAt(0).toUpperCase()}
            </Avatar>
            <Typography
              sx={{
                fontSize: '1.25rem',
                fontWeight: 700,
                color: 'text.primary',
                textAlign: 'center',
              }}
            >
              {displayName}
            </Typography>
          </Box>

          {/* Large amount */}
          <Box sx={{ textAlign: 'center' }}>
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
              {formatAmount(displayItem.amount_cents, currency)}
            </Typography>
            <Typography
              sx={{
                fontSize: '0.8rem',
                fontWeight: 600,
                color: '#10b981',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                mt: 0.5,
              }}
            >
              owes you
            </Typography>
          </Box>

          {/* Divider */}
          <Box
            sx={{
              height: 1,
              bgcolor: alpha('#fff', 0.08),
              mx: -2,
            }}
          />

          {/* Detail row */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 0.5 }}>
            <PersonIcon sx={{ fontSize: 18, color: 'text.secondary', flexShrink: 0 }} />
            <Typography variant="body2" color="text.secondary">
              {displayName} owes you{' '}
              <Box component="span" sx={{ fontWeight: 700, color: 'primary.main' }}>
                {formatAmount(displayItem.amount_cents, currency)}
              </Box>
            </Typography>
          </Box>

          {breakdownItems.length > 0 && (
            <>
              <Box sx={{ height: 1, bgcolor: alpha('#fff', 0.08), mx: -2 }} />
              <Typography
                sx={{
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  color: alpha('#fff', 0.4),
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  mb: 0.5,
                  mt: 1,
                }}
              >
                Breakdown
              </Typography>
              <Box sx={{ flex: 1, overflow: 'auto', minHeight: 0, mx: -0.5, px: 0.5 }}>
                {breakdownItems.map((item, idx) => {
                  const isPositive = item.amount >= 0;
                  const isSettlement = item.type === 'settlement';
                  const amountColor = isSettlement
                    ? alpha('#F59E0B', 0.9)
                    : '#22c55e';
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
                          bgcolor: isSettlement ? alpha('#F59E0B', 0.12) : alpha('#22c55e', 0.12),
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
                  <Typography sx={{ fontSize: '0.85rem', fontWeight: 800, color: '#22c55e', fontVariantNumeric: 'tabular-nums' }}>
                    {formatAmount(breakdownTotal, currency)}
                  </Typography>
                </Box>
              </Box>
            </>
          )}

          {/* Settle CTA */}
          <Box sx={{ mt: 'auto', pt: 1 }}>
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
                bgcolor: theme.palette.primary.main,
                color: '#121212',
                fontWeight: 800,
                letterSpacing: '0.05em',
                fontSize: '1rem',
                boxShadow: `0 0 20px ${alpha(theme.palette.primary.main, 0.25)}`,
                '&:hover': {
                  bgcolor: theme.palette.primary.dark,
                  boxShadow: `0 0 30px ${alpha(theme.palette.primary.main, 0.35)}`,
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