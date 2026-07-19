import { useState, useMemo, useCallback } from 'react';
import {
  Box,
  Typography,
  Avatar,
  Chip,
  alpha,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  TrendingUp as IncomingIcon,
  TrendingDown as OutgoingIcon,
  Pending as PendingIcon,
  SwapHoriz as SettleIcon,
  Payment as PaymentIcon,
  Gavel as GavelIcon,
  HourglassEmpty as HourglassIcon,
} from '@mui/icons-material';
import { MobileFeedCard } from '../../feed/mobile/MobileFeedCard';
import { useUserCache, useUser } from '../../../hooks/useUserCache';
import { UserInfo } from '../../../api/users.api';
import { ExpenseBreakdown, SettlementBreakdown, PaymentBreakdown as BalancePaymentBreakdown } from '../../../api/balances.api';
import { Payment } from '../../../api/payments.api';
import { GroupMember } from '../../../api/groups.api';
import { RestoreHonorModal } from '../../settlements/RestoreHonorModal';
import { MobileRelationshipCard } from '../../feed/mobile/cards/MobileRelationshipCard';
import { MobileCardList } from '../../shared/lists/MobileCardList';
import { RelationshipDetailDrawer } from '../mobile/RelationshipDetailDrawer';
import { MobileStatsBreakdownDrawer, type BreakdownItem } from '../../settlements/mobile/MobileStatsBreakdownDrawer';

const formatAmount = (cents: number, currency = 'EUR') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Math.abs(cents) / 100);

function buildBreakdownItems(rel: RelationshipSummary, currentUserId: string): BreakdownItem[] {
  const items: BreakdownItem[] = [];
  const isIncoming = rel.isIncoming;
  for (const expense of rel.expenses) {
    items.push({
      label: expense.title,
      amount: isIncoming ? expense.share_cents : expense.share_cents,
      type: 'expense',
      direction: isIncoming ? 'incoming' : 'outgoing',
      created_at: expense.created_at,
    });
  }
  for (const settlement of rel.settlements) {
    if (settlement.status !== 'confirmed') continue;
    const isOutgoing = settlement.from_user === currentUserId;
    items.push({
      label: '',
      amount: settlement.amount_cents,
      type: 'settlement',
      counterparty: isOutgoing ? settlement.to_user : settlement.from_user,
      direction: isOutgoing ? 'outgoing' : 'incoming',
      created_at: settlement.created_at,
    });
  }
  return items;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RelationshipSummary {
  userId: string;
  totalCents: number;
  expenses: ExpenseBreakdown[];
  settlements: SettlementBreakdown[];
  payments: BalancePaymentBreakdown[];
  rawExpenseCents: number;
  rawSettlementCents: number;
  rawPaymentCents: number;
  isIncoming: boolean;
}

interface PaymentCardsProps {
  activeTab?: 'incoming' | 'outgoing' | 'requests' | 'history';
  onTabChange?: (tab: 'incoming' | 'outgoing' | 'requests' | 'history') => void;
  relationships: RelationshipSummary[];
  currentUserId: string;
  currency: string;
  members: GroupMember[];
  payments: Payment[];
  onPaymentSuccess?: () => void;
  eventId: string;
}

export function PaymentCards({
  activeTab: controlledActiveTab,
  onTabChange,
  relationships,
  currentUserId,
  currency,
  members,
  payments,
  onPaymentSuccess,
  eventId,
}: PaymentCardsProps) {
  const internalActiveTab = useState<'incoming' | 'outgoing' | 'requests' | 'history'>('incoming');
  const [internalTab, setInternalTab] = internalActiveTab;

  const activeTab = controlledActiveTab !== undefined ? controlledActiveTab : internalTab;
  const setActiveTab = (tab: 'incoming' | 'outgoing' | 'requests' | 'history') => {
    if (controlledActiveTab !== undefined) {
      onTabChange?.(tab);
    } else {
      setInternalTab(tab);
    }
  };
  
  // Drawer state for mobile - replaces inline expansion
  const [drawerRelationship, setDrawerRelationship] = useState<RelationshipSummary | null>(null);

  // Stats-style breakdown drawer
  const [breakdownDrawerOpen, setBreakdownDrawerOpen] = useState(false);
  const [breakdownItems, setBreakdownItems] = useState<BreakdownItem[]>([]);
  const [breakdownTotal, setBreakdownTotal] = useState(0);
  const [breakdownTitle, setBreakdownTitle] = useState('');
  
  const { getAllUsers } = useUserCache();
  const allUsers = getAllUsers();
  const userMap = useMemo(() => {
    const map = new Map<string, UserInfo>();
    for (const u of allUsers) {
      map.set(u.id, u);
    }
    return map;
  }, [allUsers]);

  const incoming = relationships.filter((r) => r.isIncoming);
  const outgoing = relationships.filter((r) => !r.isIncoming);
  const openPayments = payments.filter((p) => p.status === 'open');

  const paymentsToConfirm = openPayments.filter((p) => p.creditor_id === currentUserId);
  const paymentsISent = openPayments.filter((p) => p.debtor_id === currentUserId);

  const [restoreHonorOpen, setRestoreHonorOpen] = useState(false);
  const [restoreHonorTarget, setRestoreHonorTarget] = useState<{ userId: string; amountCents: number } | null>(null);

  const handleOpenRestoreHonor = (userId: string, amountCents: number) => {
    setRestoreHonorTarget({ userId, amountCents });
    setRestoreHonorOpen(true);
  };

  const handleRestoreHonorSuccess = () => {
    setRestoreHonorOpen(false);
    setRestoreHonorTarget(null);
    onPaymentSuccess?.();
  };

  const displayList = activeTab === 'incoming' ? incoming : activeTab === 'outgoing' ? outgoing : [];

  const getMemberName = (userId: string): string => {
    const user = userMap.get(userId);
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

  const targetUser = restoreHonorTarget ? userMap.get(restoreHonorTarget.userId) : undefined;

  const theme = useTheme();
  const isMobile = !useMediaQuery(theme.breakpoints.up('md'));

  return (
    <Box>
      {/* Desktop-only tabs (mobile chips moved to MobileSettlePage header) */}
      {!isMobile && (
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
          <TabButton
            active={activeTab === 'requests'}
            onClick={() => setActiveTab('requests')}
            icon={<PendingIcon sx={{ fontSize: 16 }} />}
            label="Requests"
            count={paymentsToConfirm.length + paymentsISent.length}
            total={paymentsToConfirm.reduce((sum, p) => sum + (p.amount_cents - p.amount_paid_cents), 0)}
            currency={currency}
          />
          <TabButton
            active={activeTab === 'history'}
            onClick={() => setActiveTab('history')}
            icon={<SettleIcon sx={{ fontSize: 16 }} />}
            label="History"
            count={relationships.reduce((sum, r) => sum + r.settlements.length + r.payments.length, 0)}
            total={0}
            currency={currency}
          />
        </Box>
      )}

      {activeTab === 'requests' && (
        <MobileCardList<Payment>
          items={openPayments}
          renderItem={(payment) => (
            <PaymentRequestCard
              key={payment.id}
              payment={payment}
              currency={currency}
              isConfirming={payment.creditor_id === currentUserId}
            />
          )}
          emptyState={
            <Box sx={{ textAlign: 'center', py: 6 }}>
              <Typography variant="body1" color="text.secondary">
                No pending payment requests.
              </Typography>
            </Box>
          }
          gap={2}
        />
      )}

      {/* History tab content */}
      {activeTab === 'history' && (
        <TransactionHistoryList
          relationships={relationships}
          currency={currency}
          userMap={userMap}
          currentUserId={currentUserId}
        />
      )}

      {/* Incoming/Outgoing tab content */}
      {activeTab !== 'requests' && activeTab !== 'history' && (
        <MobileCardList<RelationshipSummary>
          items={displayList}
          renderItem={(rel) => {
            const name = getMemberName(rel.userId);
            const items = buildBreakdownItems(rel, currentUserId);
            return (
              <Box key={rel.userId}>
                <MobileRelationshipCard
                  relationship={rel}
                  displayName={name}
                  currency={currency}
                  currentUserId={currentUserId}
                  onClick={() => {
                    setBreakdownTitle(`${name}: ${rel.isIncoming ? 'Owed to you' : 'You owe'}`);
                    setBreakdownItems(items);
                    setBreakdownTotal(rel.totalCents);
                    setBreakdownDrawerOpen(true);
                  }}
                />
              </Box>
            );
          }}
          emptyState={
            <Box sx={{ textAlign: 'center', py: 6 }}>
              <Typography variant="body1" color="text.secondary">
                {activeTab === 'incoming'
                  ? 'No one owes you. The pit is quiet.'
                  : "You don't owe anyone. Your honor is intact."}
              </Typography>
            </Box>
          }
          gap={2}
        />
      )}

      {/* Relationship Detail Drawer (mobile) */}
      {drawerRelationship && (
        <RelationshipDetailDrawer
          open={!!drawerRelationship}
          onClose={() => setDrawerRelationship(null)}
          relationship={drawerRelationship}
          currency={currency}
          counterpartyName={getMemberName(drawerRelationship.userId)}
          counterpartyInitial={getMemberInitial(drawerRelationship.userId)}
          onRestoreHonor={() => {
            setDrawerRelationship(null);
            handleOpenRestoreHonor(drawerRelationship.userId, drawerRelationship.totalCents);
          }}
        />
      )}

      {/* Restore Honor Modal */}
      {restoreHonorTarget && (
        <RestoreHonorModal
          open={restoreHonorOpen}
          onClose={() => setRestoreHonorOpen(false)}
          onSuccess={handleRestoreHonorSuccess}
          toUser={restoreHonorTarget.userId}
          toUserInfo={targetUser}
          totalOwedCents={restoreHonorTarget.amountCents}
          currency={currency}
          eventId={eventId}
          fromUserId={currentUserId}
        />
      )}

      <MobileStatsBreakdownDrawer
        open={breakdownDrawerOpen}
        onClose={() => setBreakdownDrawerOpen(false)}
        title={breakdownTitle}
        items={breakdownItems}
        total={breakdownTotal}
        currency={currency}
      />
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
// Settlement Request Card
// ---------------------------------------------------------------------------

function PaymentRequestCard({
  payment,
  currency,
  isConfirming,
}: {
  payment: Payment;
  currency: string;
  isConfirming: boolean;
}) {
  const theme = useTheme();
  const otherUserId = isConfirming ? payment.debtor_id : payment.creditor_id;
  const user = useUser(otherUserId);
  const displayName = user
    ? `${user.firstName} ${user.lastName}`.trim() || user.email
    : otherUserId.slice(0, 8);

  const time = new Date(payment.created_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

  const remainingAmount = payment.amount_cents - payment.amount_paid_cents;
  const accentColor = isConfirming ? theme.palette.warning.main : theme.palette.primary.main;
  const icon = isConfirming ? <GavelIcon sx={{ fontSize: 18 }} /> : <HourglassIcon sx={{ fontSize: 18 }} />;

  return (
    <MobileFeedCard
      accentColor={accentColor}
      icon={icon}
      rightContent={
        <Box>
          <Typography
            sx={{
              fontSize: '0.9rem',
              fontWeight: 700,
              color: accentColor,
              lineHeight: 1.2,
            }}
          >
            {formatAmount(remainingAmount, currency)}
          </Typography>
          <Typography
            sx={{
              display: 'block',
              fontSize: '0.6rem',
              color: 'text.disabled',
            }}
          >
            {time}
          </Typography>
        </Box>
      }
    >
      <Typography
        sx={{
          fontSize: '0.85rem',
          fontWeight: 600,
          lineHeight: 1.3,
          mb: 0.5,
        }}
      >
        <Box component="span" color={accentColor}>
          {isConfirming ? 'Confirm payment' : 'Awaiting confirmation'}
        </Box>
        {' — '}
        <Box component="span" color="text.primary">
          {displayName}
        </Box>
      </Typography>
      <Typography
        sx={{
          fontSize: '0.7rem',
          color: 'text.secondary',
          textTransform: 'capitalize',
        }}
      >
        {payment.reason}
      </Typography>
    </MobileFeedCard>
  );
}

// ---------------------------------------------------------------------------

interface TransactionItem {
  id: string;
  type: 'settlement' | 'payment';
  date: Date;
  amountCents: number;
  counterpartyUserId: string;
  counterpartyName: string;
  counterpartyInitial: string;
  note?: string;
  status?: string;
  isOutgoing: boolean;
}

interface TransactionDisplayItem {
  id: string;
  type: 'day-header' | 'transaction';
  dateLabel?: string;
  tx?: TransactionItem;
}

function TransactionHistoryList({
  relationships,
  currency,
  userMap,
  currentUserId,
}: {
  relationships: RelationshipSummary[];
  currency: string;
  userMap: Map<string, UserInfo>;
  currentUserId: string;
}) {
  const getMemberNameFromMap = (userId: string): string => {
    const user = userMap.get(userId);
    if (user) {
      const fullName = `${user.firstName} ${user.lastName}`.trim();
      return fullName || user.email || userId.slice(0, 8);
    }
    return userId.slice(0, 8);
  };

  const displayItems = useMemo((): TransactionDisplayItem[] => {
    const rawItems: { tx: TransactionItem; date: Date }[] = [];
    let idx = 0;

    for (const rel of relationships) {
      const counterpartyName = getMemberNameFromMap(rel.userId);
      const counterpartyInitial = counterpartyName.charAt(0).toUpperCase();

      for (const settlement of rel.settlements) {
        const isOutgoing = settlement.from_user === currentUserId;
        rawItems.push({
          tx: {
            id: settlement.id || `settlement-${idx++}`,
            type: 'settlement',
            date: new Date(settlement.created_at),
            amountCents: settlement.amount_cents,
            counterpartyUserId: rel.userId,
            counterpartyName,
            counterpartyInitial,
            note: settlement.note || undefined,
            status: settlement.status,
            isOutgoing,
          },
          date: new Date(settlement.created_at),
        });
      }

      for (const payment of rel.payments) {
        const isOutgoing = payment.debtor_id === currentUserId;
        rawItems.push({
          tx: {
            id: payment.id || `payment-${idx++}`,
            type: 'payment',
            date: new Date(payment.created_at),
            amountCents: payment.amount_cents,
            counterpartyUserId: rel.userId,
            counterpartyName,
            counterpartyInitial,
            note: payment.reason || undefined,
            isOutgoing,
          },
          date: new Date(payment.created_at),
        });
      }
    }

    rawItems.sort((a, b) => b.date.getTime() - a.date.getTime());

    const result: TransactionDisplayItem[] = [];
    let lastDateKey = '';
    for (const { tx, date } of rawItems) {
      const validDate = date && !isNaN(date.getTime()) ? date : new Date();
      const dateKey = validDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      if (dateKey !== lastDateKey) {
        lastDateKey = dateKey;
        result.push({ id: `header-${dateKey}`, type: 'day-header', dateLabel: dateKey });
      }
      result.push({ id: tx.id, type: 'transaction', tx });
    }

    return result;
  }, [relationships, currentUserId, userMap, getMemberNameFromMap]);

  const renderItem = useCallback(
    (item: TransactionDisplayItem) => {
      if (item.type === 'day-header') {
        return (
          <Box key={item.id}>
            <Typography
              variant="caption"
              fontWeight={700}
              color="text.secondary"
              sx={{ display: 'block', mb: 1, mt: 2, letterSpacing: '0.05em', textTransform: 'uppercase' }}
            >
              {item.dateLabel}
            </Typography>
          </Box>
        );
      }
      const tx = item.tx!;
      const validDate = tx.date && !isNaN(tx.date.getTime()) ? tx.date : new Date();
      const timeStr = validDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      return (
        <Box key={tx.id}>
          <TransactionHistoryRow
            type={tx.type}
            counterpartyName={tx.counterpartyName}
            counterpartyInitial={tx.counterpartyInitial}
            amountCents={tx.amountCents}
            currency={currency}
            timeStr={timeStr}
            note={tx.note}
            status={tx.status}
            isOutgoing={tx.isOutgoing}
          />
        </Box>
      );
    },
    [currency]
  );

  return (
    <MobileCardList<TransactionDisplayItem>
      items={displayItems}
      renderItem={renderItem}
      emptyState={
        <Box sx={{ textAlign: 'center', py: 6 }}>
          <Typography variant="body1" color="text.secondary">
            No transaction history yet.
          </Typography>
        </Box>
      }
      gap={0}
    />
  );
}

// ---------------------------------------------------------------------------
// Transaction History Row
// ---------------------------------------------------------------------------

function TransactionHistoryRow({
  type,
  counterpartyName,
  counterpartyInitial,
  amountCents,
  currency,
  timeStr,
  note,
  status,
  isOutgoing,
}: {
  type: 'settlement' | 'payment';
  counterpartyName: string;
  counterpartyInitial: string;
  amountCents: number;
  currency: string;
  timeStr: string;
  note?: string;
  status?: string;
  isOutgoing: boolean;
}) {
  const isSettlement = type === 'settlement';
  const icon = isSettlement ? <SettleIcon sx={{ fontSize: 14 }} /> : <PaymentIcon sx={{ fontSize: 14 }} />;
  const iconBgColor = isSettlement ? alpha('#10b981', 0.15) : alpha('#8b5cf6', 0.15);
  const iconColor = isSettlement ? '#10b981' : '#8b5cf6';
  const amountColor = isOutgoing ? 'error.main' : 'primary.main';

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        p: 1.5,
        borderRadius: 2,
        border: `1px solid ${alpha('#fff', 0.08)}`,
        bgcolor: 'background.paper',
      }}
    >
      <Box
        sx={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          bgcolor: iconBgColor,
          color: iconColor,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {icon}
      </Box>

      <Avatar
        sx={{
          width: 36,
          height: 36,
          bgcolor: isOutgoing ? alpha('#ef4444', 0.15) : alpha('#F59E0B', 0.15),
          color: isOutgoing ? '#ef4444' : '#F59E0B',
          fontWeight: 600,
          fontSize: '0.85rem',
          flexShrink: 0,
        }}
      >
        {counterpartyInitial}
      </Avatar>

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" fontWeight={600} color="text.primary" noWrap>
          {isSettlement ? (isOutgoing ? `Paid to ${counterpartyName}` : `Received from ${counterpartyName}`) : (isOutgoing ? `Payment to ${counterpartyName}` : `Payment from ${counterpartyName}`)}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="caption" color="text.secondary">
            {timeStr}
          </Typography>
          {status && status !== 'confirmed' && (
            <Chip
              label={status}
              size="small"
              sx={{
                height: 16,
                fontSize: '0.6rem',
                fontWeight: 600,
                bgcolor: status === 'pending' ? alpha('#F59E0B', 0.15) : alpha('#6b7280', 0.15),
                color: status === 'pending' ? '#F59E0B' : '#6b7280',
              }}
            />
          )}
          {note && (
            <Typography variant="caption" color="text.secondary" noWrap sx={{ maxWidth: 150 }}>
              • {note}
            </Typography>
          )}
        </Box>
      </Box>

      <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
        <Typography
          variant="body2"
          fontWeight={700}
          sx={{ color: amountColor }}
        >
          {isOutgoing ? '-' : '+'}{formatAmount(amountCents, currency)}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {isSettlement ? 'settled' : 'paid'}
        </Typography>
      </Box>
    </Box>
  );
}
