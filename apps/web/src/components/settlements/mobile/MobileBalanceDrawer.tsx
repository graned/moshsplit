import React, { useRef, useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Button,
  alpha,
  useTheme,
} from '@mui/material';
import {
  Receipt as ReceiptIcon,
  Handshake as HandshakeIcon,
  Undo as UndoIcon,
} from '@mui/icons-material';

import { MobileDrawer } from '../../shared/MobileDrawer';
import { useUserCache } from '../../../hooks/useUserCache';
import type { BreakdownItem } from './MobileStatsBreakdownDrawer';
import { MobileSettleStepper } from './MobileSettleStepper';

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
    mainColor: '#F59E0B',
    darkColor: '#D97706',
    gradient: 'linear-gradient(135deg, #F59E0B, #D97706)',
    buttonBg: '#F59E0B',
    buttonText: '#121212',
    buttonHover: '#D97706',
    amountColor: '#F59E0B',
    amountBg: '#F59E0B',
  },
};

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

  const [view, setView] = useState<DrawerView>('breakdown');

  const handleClose = () => {
    if (view === 'settle') {
      setView('breakdown');
      return;
    }
    onClose();
  };

  const handleStartSettle = () => setView('settle');

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
                const reimbursements: typeof resolvedBreakdownItems = [];
                for (const item of resolvedBreakdownItems) {
                  if (item.type === 'reimbursement') {
                    reimbursements.push(item);
                  } else if (item.type === 'settlement') {
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
                if (reimbursements.length > 0) groups.push({ title: 'Reimbursements', items: reimbursements });

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
                      const isReimbursement = item.type === 'reimbursement';
                      const isOutgoing = item.direction === 'outgoing';
                      return (
                        <Box
                          key={`${item.label}-${idx}`}
                          sx={{
                            display: 'flex', alignItems: 'center', gap: 1.5, py: 0.75,
                            borderBottom: idx < section.items.length - 1 ? `1px solid ${alpha('#fff', 0.05)}` : 'none',
                          }}
                        >
                          <Box sx={{ width: 28, height: 28, borderRadius: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: isSettlement ? alpha('#F59E0B', 0.12) : isReimbursement ? alpha('#8b5cf6', 0.12) : alpha(amountColor, 0.12), flexShrink: 0 }}>
                            {isSettlement ? (
                              <HandshakeIcon sx={{ fontSize: 14, color: alpha('#F59E0B', 0.7) }} />
                            ) : isReimbursement ? (
                              <UndoIcon sx={{ fontSize: 14, color: alpha('#8b5cf6', 0.7) }} />
                            ) : (
                              <ReceiptIcon sx={{ fontSize: 14, color: amountColor }} />
                            )}
                          </Box>
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography sx={{ fontSize: '0.8rem', fontWeight: 500, color: 'text.primary', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {isReimbursement && isOutgoing ? 'You owe for deleted expense' : item.label}
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
                              {isReimbursement && (
                                <Typography component="span" sx={{ fontSize: '0.55rem', fontWeight: 600, color: alpha('#8b5cf6', 0.6), textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                  · Reimbursement
                                </Typography>
                              )}
                            </Typography>
                          </Box>
                          <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: '#fff', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                            {isReimbursement && isOutgoing ? '−' : (isPositive ? '' : '−')}{formatAmount(item.amount, currency)}
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

  return (
    <MobileDrawer open={open} onClose={handleClose} title={view === 'settle' ? 'Settle Up' : 'Balance'} fullScreen={fullScreen}>
      {displayItem && (
        view === 'settle' ? (
          <MobileSettleStepper
            eventId={eventId}
            currentUserId={currentUserId}
            direction={direction}
            currency={currency}
            breakdownTotal={breakdownTotal}
            displayItem={displayItem}
            amountColor={amountColor}
            darkColor={darkColor}
            displayName={displayName}
            breakdownItems={resolvedBreakdownItems}
            onComplete={() => setView('breakdown')}
            onCancel={() => setView('breakdown')}
          />
        ) : renderBreakdownView()
      )}
    </MobileDrawer>
  );
}
