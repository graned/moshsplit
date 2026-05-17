import { useState } from 'react';
import {
  Box,
  Typography,
  Avatar,
  Button,
  alpha,
  Collapse,
  IconButton,
  Divider,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  LocalBar as BeerIcon,
  LocalGasStation as GasIcon,
  Restaurant as FoodIcon,
  DirectionsBus as TransportIcon,
  ShoppingBag as MerchIcon,
  Receipt as DefaultIcon,
  Forest as CampingIcon,
  TrendingUp as IncomingIcon,
  TrendingDown as OutgoingIcon,
} from '@mui/icons-material';
import { useUser } from '../../hooks/useUserCache';
import { ExpenseBreakdown } from '../../api/balances.api';
import { GroupMember } from '../../api/groups.api';

const EXPENSE_ICONS: Record<string, React.ReactNode> = {
  beer: <BeerIcon sx={{ fontSize: 14 }} />,
  gas: <GasIcon sx={{ fontSize: 14 }} />,
  food: <FoodIcon sx={{ fontSize: 14 }} />,
  transport: <TransportIcon sx={{ fontSize: 14 }} />,
  merch: <MerchIcon sx={{ fontSize: 14 }} />,
  camping: <CampingIcon sx={{ fontSize: 14 }} />,
};

const formatAmount = (cents: number, currency = 'EUR') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Math.abs(cents) / 100);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RelationshipSummary {
  userId: string;
  totalCents: number;
  expenses: ExpenseBreakdown[];
  isIncoming: boolean; // true = they owe me, false = I owe them
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SettlementCardProps {
  relationships: RelationshipSummary[];
  currentUserId: string;
  currency: string;
  members: GroupMember[];
  onSettle?: (userId: string, amountCents: number) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SettlementCards({
  relationships,
  currentUserId,
  currency,
  members,
  onSettle,
}: SettlementCardProps) {
  const [activeTab, setActiveTab] = useState<'incoming' | 'outgoing'>('incoming');
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);

  const incoming = relationships.filter((r) => r.isIncoming);
  const outgoing = relationships.filter((r) => !r.isIncoming);

  const displayList = activeTab === 'incoming' ? incoming : outgoing;

  const getMemberName = (userId: string): string => {
    const user = useUser(userId);
    if (user) {
      const fullName = `${user.firstName} ${user.lastName}`.trim();
      return fullName || user.email || userId.slice(0, 8);
    }
    const member = members.find((m) => m.user_id === userId);
    return member?.user_name || member?.user_email || userId.slice(0, 8);
  };

  const getMemberInitial = (userId: string): string => {
    const name = getMemberName(userId);
    return name.charAt(0).toUpperCase();
  };

  const handleSettle = (userId: string, amountCents: number) => {
    onSettle?.(userId, amountCents);
  };

  if (displayList.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 6 }}>
        <Typography variant="body1" color="text.secondary">
          {activeTab === 'incoming'
            ? 'No one owes you. The pit is quiet.'
            : "You don't owe anyone. Your honor is intact."}
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      {/* Tabs */}
      <Box
        sx={{
          display: 'flex',
          gap: 1,
          mb: 3,
          p: 0.5,
          borderRadius: 2,
          bgcolor: 'elevated.main',
          border: `1px solid ${alpha('#fff', 0.05)}`,
        }}
      >
        <TabButton
          active={activeTab === 'incoming'}
          onClick={() => setActiveTab('incoming')}
          icon={<IncomingIcon sx={{ fontSize: 16 }} />}
          label="Incoming"
          count={incoming.length}
          total={incoming.reduce((sum, r) => sum + r.totalCents, 0)}
          currency={currency}
        />
        <TabButton
          active={activeTab === 'outgoing'}
          onClick={() => setActiveTab('outgoing')}
          icon={<OutgoingIcon sx={{ fontSize: 16 }} />}
          label="Outgoing"
          count={outgoing.length}
          total={outgoing.reduce((sum, r) => sum + r.totalCents, 0)}
          currency={currency}
        />
      </Box>

      {/* Relationship Cards */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {displayList.map((rel) => {
          const isExpanded = expandedUserId === rel.userId;
          const name = getMemberName(rel.userId);
          const isCurrentUser = rel.userId === currentUserId;

          return (
            <Box
              key={rel.userId}
              sx={{
                borderRadius: 2,
                border: `1px solid ${alpha('#fff', 0.1)}`,
                bgcolor: 'elevated.main',
                overflow: 'hidden',
              }}
            >
              {/* Header row */}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                  p: 2,
                  cursor: 'pointer',
                }}
                onClick={() => setExpandedUserId(isExpanded ? null : rel.userId)}
              >
                <Avatar
                  sx={{
                    width: 48,
                    height: 48,
                    bgcolor: rel.isIncoming ? 'primary.main' : 'error.main',
                    color: '#121212',
                    fontWeight: 700,
                    fontSize: '1.25rem',
                    flexShrink: 0,
                  }}
                >
                  {getMemberInitial(rel.userId)}
                </Avatar>

                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body1" fontWeight={600} color="text.primary" noWrap>
                    {isCurrentUser ? 'You' : name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {rel.expenses.length} expense{rel.expenses.length !== 1 ? 's' : ''}
                  </Typography>
                </Box>

                <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                  <Typography
                    variant="h6"
                    fontWeight={700}
                    sx={{
                      color: rel.isIncoming ? 'primary.main' : 'error.main',
                      fontSize: '1.25rem',
                    }}
                  >
                    {formatAmount(rel.totalCents, currency)}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{
                      fontWeight: 700,
                      letterSpacing: '0.05em',
                      textTransform: 'uppercase',
                      color: rel.isIncoming ? 'primary.main' : 'error.main',
                    }}
                  >
                    {rel.isIncoming ? 'They owe' : 'You owe'}
                  </Typography>
                </Box>

                <IconButton size="small" sx={{ color: 'text.secondary', flexShrink: 0 }}>
                  {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                </IconButton>
              </Box>

              {/* Expanded breakdown */}
              <Collapse in={isExpanded}>
                <Divider sx={{ borderColor: alpha('#fff', 0.05) }} />
                <Box sx={{ p: 2 }}>
                  {rel.expenses.map((exp, i) => (
                    <ExpenseRow
                      key={i}
                      expense={exp}
                      currency={currency}
                      isIncoming={rel.isIncoming}
                    />
                  ))}

                  {/* Total row */}
                  <Box
                    sx={{
                      mt: 2,
                      pt: 1.5,
                      borderTop: `1px solid ${alpha('#fff', 0.1)}`,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <Typography variant="body2" fontWeight={700} color="text.secondary">
                      Total:
                    </Typography>
                    <Typography
                      variant="body1"
                      fontWeight={800}
                      sx={{
                        color: rel.isIncoming ? 'primary.main' : 'error.main',
                      }}
                    >
                      {formatAmount(rel.totalCents, currency)}
                    </Typography>
                  </Box>

                  {/* Settle button */}
                  {rel.totalCents > 0 && (
                    <Button
                      fullWidth
                      variant="contained"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSettle(rel.userId, rel.totalCents);
                      }}
                      sx={{
                        mt: 2,
                        bgcolor: 'primary.main',
                        color: '#121212',
                        fontWeight: 700,
                        '&:hover': { bgcolor: 'primary.dark' },
                      }}
                    >
                      Settle {formatAmount(rel.totalCents, currency)}
                    </Button>
                  )}
                </Box>
              </Collapse>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Tab Button
// ---------------------------------------------------------------------------

function TabButton({
  active,
  onClick,
  icon,
  label,
  count,
  total,
  currency,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count: number;
  total: number;
  currency: string;
}) {
  return (
    <Box
      onClick={onClick}
      sx={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 0.5,
        p: 1.5,
        borderRadius: 1.5,
        cursor: 'pointer',
        bgcolor: active ? alpha('#F59E0B', 0.12) : 'transparent',
        border: active ? `1px solid ${alpha('#F59E0B', 0.3)}` : '1px solid transparent',
        transition: 'all 0.2s ease',
        '&:hover': {
          bgcolor: active ? alpha('#F59E0B', 0.12) : alpha('#fff', 0.03),
        },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        {icon}
        <Typography
          variant="body2"
          fontWeight={700}
          color={active ? 'primary.main' : 'text.secondary'}
        >
          {label}
        </Typography>
        <Typography
          variant="caption"
          sx={{
            color: active ? 'primary.main' : 'text.muted',
            fontWeight: 600,
          }}
        >
          ({count})
        </Typography>
      </Box>
      <Typography
        variant="caption"
        fontWeight={600}
        color={active ? 'text.primary' : 'text.secondary'}
      >
        {formatAmount(total, currency)}
      </Typography>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Expense Row
// ---------------------------------------------------------------------------

function ExpenseRow({
  expense,
  currency,
  isIncoming,
}: {
  expense: ExpenseBreakdown;
  currency: string;
  isIncoming: boolean;
}) {
  const icon = expense.expense_type
    ? EXPENSE_ICONS[expense.expense_type] ?? <DefaultIcon sx={{ fontSize: 14 }} />
    : <DefaultIcon sx={{ fontSize: 14 }} />;

  // For incoming: they owe me their share
  // For outgoing: I owe my share
  const amountCents = isIncoming ? expense.share_cents : expense.share_cents;

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        py: 1.5,
      }}
    >
      <Box
        sx={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          bgcolor: alpha('#F59E0B', 0.15),
          color: 'primary.main',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {icon}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" fontWeight={600} color="text.primary" noWrap>
          {expense.title}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {expense.amount_cents > 0
            ? `Total: ${formatAmount(expense.amount_cents, currency)}`
            : 'Expense'}
        </Typography>
      </Box>
      <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
        <Typography
          variant="body2"
          fontWeight={700}
          sx={{ color: isIncoming ? 'primary.main' : 'error.main' }}
        >
          {formatAmount(amountCents, currency)}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          share
        </Typography>
      </Box>
    </Box>
  );
}
