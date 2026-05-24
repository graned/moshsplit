import { useRef } from 'react';
import { Box, Typography, Button, Avatar, alpha } from '@mui/material';
import { Person as PersonIcon } from '@mui/icons-material';

import { MobileDrawer } from '../../shared/MobileDrawer';
import { OutgoingBalanceItem } from '../../../api/settlements.api';
import { useUserCache } from '../../../hooks/useUserCache';

function formatAmount(cents: number, currency = 'EUR') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

interface MobileOutgoingBalanceDrawerProps {
  open: boolean;
  onClose: () => void;
  balanceItem: OutgoingBalanceItem | null;
  currency?: string;
  onSettle: (userId: string, amountCents: number) => void;
}

export function MobileOutgoingBalanceDrawer({
  open,
  onClose,
  balanceItem,
  currency = 'EUR',
  onSettle,
}: MobileOutgoingBalanceDrawerProps) {
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
                bgcolor: alpha('#ef4444', 0.15),
                color: '#ef4444',
                fontSize: '1.75rem',
                fontWeight: 700,
                border: `2px solid ${alpha('#ef4444', 0.3)}`,
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
                background: `linear-gradient(135deg, #ef4444, #b91c1c)`,
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
                color: '#ef4444',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                mt: 0.5,
              }}
            >
              you owe
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
              You owe {displayName}{' '}
              <Box component="span" sx={{ fontWeight: 700, color: '#ef4444' }}>
                {formatAmount(displayItem.amount_cents, currency)}
              </Box>
            </Typography>
          </Box>

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