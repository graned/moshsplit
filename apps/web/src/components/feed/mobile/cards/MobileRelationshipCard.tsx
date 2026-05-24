import { Typography, Box, useTheme, alpha } from '@mui/material';
import { Person as PersonIcon, ChevronRight as ChevronRightIcon } from '@mui/icons-material';
import { RelationshipSummary } from '../../../balances/shared/SettlementCards';

const formatAmount = (cents: number, currency = 'EUR') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Math.abs(cents) / 100);

interface MobileRelationshipCardProps {
  relationship: RelationshipSummary;
  displayName: string;
  currency: string;
  currentUserId: string;
  onClick?: () => void;
}

/**
 * Mobile-only relationship card for the settle page.
 *
 * Renders a horizontal flex row with:
 *  - Left: 36×36 person icon box (amber tint for incoming, red tint for outgoing)
 *  - Center: name + expense count
 *  - Right: amount + status chip
 *  - Far right: chevron
 *
 * Clicking opens the RelationshipDetailDrawer.
 */
export function MobileRelationshipCard({
  relationship,
  displayName,
  currency,
  currentUserId,
  onClick,
}: MobileRelationshipCardProps) {
  const theme = useTheme();
  const isIncoming = relationship.isIncoming;
  const isCurrentUser = relationship.userId === currentUserId;
  const accentColor = isIncoming ? theme.palette.primary.main : theme.palette.error.main;
  const name = isCurrentUser ? 'You' : displayName;

  return (
    <Box
      onClick={onClick}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.25,
        p: 1.75,
        py: 1.25,
        backgroundColor: 'background.paper',
        border: 1,
        borderColor: 'divider',
        borderRadius: 2,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
        '&:hover': {
          borderColor: alpha(accentColor, 0.3),
          boxShadow: onClick ? `0 4px 16px ${alpha(accentColor, 0.12)}` : 'none',
        },
        '&:active': onClick ? { transform: 'scale(0.98)' } : {},
      }}
    >
      {/* Left: 36×36 icon box */}
      <Box
        sx={{
          width: 36,
          height: 36,
          borderRadius: 1.5,
          backgroundColor: alpha(accentColor, 0.1),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          border: '1px solid',
          borderColor: alpha(accentColor, 0.2),
        }}
      >
        <PersonIcon sx={{ color: accentColor, fontSize: 18 }} />
      </Box>

      {/* Center: name + expense count */}
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography
          variant="body2"
          fontWeight={600}
          color="text.primary"
          noWrap
          sx={{ fontSize: '0.85rem', lineHeight: 1.3 }}
        >
          {name}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
          {relationship.expenses.length} expense{relationship.expenses.length !== 1 ? 's' : ''}
        </Typography>
      </Box>

      {/* Right: amount + status chip */}
      <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
        <Typography
          sx={{
            fontSize: '0.9rem',
            fontWeight: 700,
            color: accentColor,
            lineHeight: 1.2,
            mb: 0.5,
          }}
        >
          {isIncoming ? '+' : '-'}{formatAmount(relationship.totalCents, currency)}
        </Typography>
        <Box
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            px: 0.75,
            py: 0.25,
            borderRadius: 1,
            backgroundColor: alpha(accentColor, 0.12),
            border: '1px solid',
            borderColor: alpha(accentColor, 0.2),
          }}
        >
          <Typography
            sx={{
              fontSize: '0.6rem',
              fontWeight: 700,
              color: accentColor,
              textTransform: 'uppercase',
              letterSpacing: '0.03em',
              lineHeight: 1,
            }}
          >
            {isIncoming ? 'owed' : 'due'}
          </Typography>
        </Box>
      </Box>

      {/* Far right: chevron */}
      <Box sx={{ color: 'text.secondary', flexShrink: 0 }}>
        <ChevronRightIcon sx={{ fontSize: 18 }} />
      </Box>
    </Box>
  );
}