import {
  Card,
  CardContent,
  Typography,
  Box,
  Avatar,
  Button,
  alpha,
  Collapse,
  IconButton,
  Chip,
} from '@mui/material';
import {
  ExpandMore as ExpandIcon,
  Gavel as RoleIcon,
} from '@mui/icons-material';
import { useState } from 'react';
import { UserBalanceItem } from '../../api/balances.api';

interface RelationshipCardProps {
  balance: UserBalanceItem;
  userName?: string;
  userRole?: string;
  isCurrentUser: boolean;
  onSettle?: () => void;
  currency?: string;
}

/**
 * RelationshipCard: Card for a single user balance relationship.
 * Shows avatar, name, role, balance amount with color coding,
 * and a "Settle" button when there's an outstanding balance.
 */
export function RelationshipCard({
  balance,
  userName,
  userRole,
  isCurrentUser,
  onSettle,
  currency = 'USD',
}: RelationshipCardProps) {
  const [expanded, setExpanded] = useState(false);

  const formatAmount = (cents: number) => {
    const absCents = Math.abs(cents);
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(absCents / 100);
  };

  const getDisplayName = () => {
    if (userName) return userName;
    return balance.user_id.slice(0, 8);
  };

  const balanceCents = balance.balance_cents;
  const isSettled = balanceCents === 0;
  // Positive balance: others owe this user (or this user is owed)
  // Negative balance: this user owes others
  const isOwed = balanceCents > 0;

  // Determine status label and color
  let statusLabel: string;
  let statusColor: string;
  let amountColor: string;
  let amountPrefix: string;

  if (isSettled) {
    statusLabel = 'Honor Restored';
    statusColor = 'success.main';
    amountColor = 'success.main';
    amountPrefix = '';
  } else if (isOwed) {
    statusLabel = 'Owes You';
    statusColor = 'warning.main';
    amountColor = 'warning.main';
    amountPrefix = '';
  } else {
    statusLabel = 'Active Debt';
    statusColor = 'error.main';
    amountColor = 'error.main';
    amountPrefix = '';
  }

  const initials = getDisplayName().charAt(0).toUpperCase();

  return (
    <Card
      sx={{
        transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
        borderColor: isSettled
          ? alpha('#10b981', 0.2)
          : isOwed
            ? alpha('#f59e0b', 0.2)
            : alpha('#ef4444', 0.2),
        '&:hover': {
          borderColor: isSettled
            ? alpha('#10b981', 0.4)
            : isOwed
              ? alpha('#f59e0b', 0.4)
              : alpha('#ef4444', 0.4),
        },
      }}
    >
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {/* Avatar */}
          <Avatar
            sx={{
              width: 44,
              height: 44,
              bgcolor: isSettled
                ? 'success.main'
                : isOwed
                  ? 'warning.main'
                  : 'error.main',
              color: '#121212',
              fontSize: '1rem',
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            {initials}
          </Avatar>

          {/* Name & Role */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Typography variant="subtitle1" fontWeight={600} noWrap>
                {getDisplayName()}
                {isCurrentUser && (
                  <Typography
                    component="span"
                    sx={{
                      ml: 1,
                      fontSize: '0.75rem',
                      color: 'primary.main',
                      fontWeight: 600,
                    }}
                  >
                    (You)
                  </Typography>
                )}
              </Typography>
              {userRole && (
                <Chip
                  icon={<RoleIcon sx={{ fontSize: 14 }} />}
                  label={userRole}
                  size="small"
                  sx={{
                    height: 20,
                    fontSize: '0.65rem',
                    bgcolor: alpha('#f8fafc', 0.06),
                    color: 'text.secondary',
                    fontWeight: 600,
                  }}
                />
              )}
            </Box>

            {/* Balance details row */}
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mt: 0.5 }}>
              <Typography variant="body2" color="text.secondary">
                Paid: {formatAmount(balance.paid_cents)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Share: {formatAmount(balance.owes_cents)}
              </Typography>
            </Box>
          </Box>

          {/* Amount & Status */}
          <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
            {isSettled ? (
              <Typography
                variant="body2"
                color={statusColor}
                fontWeight={700}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  justifyContent: 'flex-end',
                }}
              >
                {statusLabel}
              </Typography>
            ) : (
              <>
                <Typography
                  variant="h6"
                  fontWeight={700}
                  color={amountColor}
                  sx={{ lineHeight: 1.2 }}
                >
                  {amountPrefix}{formatAmount(balanceCents)}
                </Typography>
                <Typography
                  variant="caption"
                  fontWeight={600}
                  color={statusColor}
                  sx={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}
                >
                  {statusLabel}
                </Typography>
              </>
            )}
          </Box>
        </Box>

        {/* Action row: Settle button + expand */}
        {!isSettled && onSettle && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              mt: 2,
              pt: 2,
              borderTop: 1,
              borderColor: 'divider',
            }}
          >
            <Button
              variant="contained"
              color="warning"
              size="small"
              onClick={onSettle}
              sx={{
                fontWeight: 700,
                textTransform: 'none',
                borderRadius: 2,
                px: 3,
              }}
            >
              Settle Up
            </Button>

            <IconButton
              size="small"
              onClick={() => setExpanded(!expanded)}
              sx={{
                color: 'text.secondary',
                transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s',
              }}
            >
              <ExpandIcon />
            </IconButton>
          </Box>
        )}

        {/* Expanded breakdown */}
        <Collapse in={expanded}>
          <Box
            sx={{
              mt: 2,
              pt: 2,
              borderTop: 1,
              borderColor: 'divider',
            }}
          >
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: 'block', mb: 1 }}>
              BALANCE BREAKDOWN
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography variant="body2" color="text.secondary">
                Total paid
              </Typography>
              <Typography variant="body2" fontWeight={600}>
                {formatAmount(balance.paid_cents)}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography variant="body2" color="text.secondary">
                Total share
              </Typography>
              <Typography variant="body2" fontWeight={600}>
                {formatAmount(balance.owes_cents)}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', pt: 1, borderTop: 1, borderColor: 'divider' }}>
              <Typography variant="body2" fontWeight={700} color={amountColor}>
                Net balance
              </Typography>
              <Typography variant="body2" fontWeight={700} color={amountColor}>
                {formatAmount(balanceCents)}
              </Typography>
            </Box>
          </Box>
        </Collapse>
      </CardContent>
    </Card>
  );
}
