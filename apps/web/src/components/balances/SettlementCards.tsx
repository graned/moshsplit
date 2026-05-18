import { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Button,
  Avatar,
  alpha,
  Collapse,
  IconButton,
  Divider,
  Chip,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  LocalBar as BeerIcon,
  LocalGasStation as GasIcon,
  Restaurant as FoodIcon,
  DirectionsBus as TransportIcon,
  ShoppingBag as MerchIcon,
  Receipt as DefaultIcon,
  Forest as CampingIcon,
  TrendingUp as IncomingIcon,
  TrendingDown as OutgoingIcon,
  Pending as PendingIcon,
  CheckCircle as ConfirmIcon,
  SwapHoriz as SettleIcon,
  Payment as PaymentIcon,
} from '@mui/icons-material';
import { useUserCache, useUser } from '../../hooks/useUserCache';
import { UserInfo } from '../../api/users.api';
import { ExpenseBreakdown, SettlementBreakdown, PaymentBreakdown } from '../../api/balances.api';
import { SettlementListItem } from '../../api/settlements.api';
import { GroupMember } from '../../api/groups.api';
import { RestoreHonorModal } from '../settlements/RestoreHonorModal';
import { SettlementReviewPanel } from '../settlements/SettlementReviewPanel';
import { MobileCard } from '../shared/cards/MobileCard';

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
  settlements: SettlementBreakdown[];
  payments: PaymentBreakdown[];
  rawExpenseCents: number;
  rawSettlementCents: number;
  rawPaymentCents: number;
  isIncoming: boolean; // true = they owe me, false = I owe them
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SettlementCardsProps {
  activeTab?: 'incoming' | 'outgoing' | 'requests' | 'history';
  onTabChange?: (tab: 'incoming' | 'outgoing' | 'requests' | 'history') => void;
  relationships: RelationshipSummary[];
  currentUserId: string;
  currency: string;
  members: GroupMember[];
  settlementRequests: SettlementListItem[];
  onSettlementSuccess?: () => void;
  eventId: string;
  settlements?: SettlementBreakdown[];
  payments?: PaymentBreakdown[];
}

export function SettlementCards({
  activeTab: controlledActiveTab,
  onTabChange,
  relationships,
  currentUserId,
  currency,
  members,
  settlementRequests,
  onSettlementSuccess,
  eventId,
}: SettlementCardsProps) {
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
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const { getAllUsers } = useUserCache();
  const allUsers = getAllUsers();
  const userMap = useMemo(() => {
    const map = new Map<string, UserInfo>();
    for (const u of allUsers) {
      map.set(u.id, u);
    }
    return map;
  }, [allUsers]);

  // Restore Honor Modal state
  const [restoreHonorOpen, setRestoreHonorOpen] = useState(false);
  const [restoreHonorTarget, setRestoreHonorTarget] = useState<{ userId: string; amountCents: number } | null>(null);

  // Settlement Review Panel state
  const [reviewPanelOpen, setReviewPanelOpen] = useState(false);
  const [reviewSettlement, setReviewSettlement] = useState<SettlementListItem | null>(null);

  const incoming = relationships.filter((r) => r.isIncoming);
  const outgoing = relationships.filter((r) => !r.isIncoming);
  const pendingRequests = settlementRequests.filter((s) => s.status === 'pending');

  // Requests where I need to confirm (someone sent me a settlement)
  const requestsToConfirm = pendingRequests.filter((s) => s.to_user === currentUserId);
  // Requests I sent (waiting for confirmation)
  const requestsISent = pendingRequests.filter((s) => s.from_user === currentUserId);

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

  const handleOpenRestoreHonor = (userId: string, amountCents: number) => {
    setRestoreHonorTarget({ userId, amountCents });
    setRestoreHonorOpen(true);
  };

  const handleOpenReviewPanel = (settlement: SettlementListItem) => {
    setReviewSettlement(settlement);
    setReviewPanelOpen(true);
  };

  const handleRestoreHonorSuccess = () => {
    setRestoreHonorOpen(false);
    setRestoreHonorTarget(null);
    onSettlementSuccess?.();
  };

  const handleReviewSuccess = () => {
    setReviewPanelOpen(false);
    setReviewSettlement(null);
    onSettlementSuccess?.();
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
            count={requestsToConfirm.length + requestsISent.length}
            total={requestsToConfirm.reduce((sum, r) => sum + r.amount_cents, 0)}
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

      {/* Requests tab content */}
      {activeTab === 'requests' && (
        <>
          {requestsToConfirm.length === 0 && requestsISent.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 6 }}>
              <Typography variant="body1" color="text.secondary">
                No pending settlement requests.
              </Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {requestsToConfirm.length > 0 && (
                <Box>
                  <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ display: 'block', mb: 1.5, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                    Awaiting your verdict
                  </Typography>
                  {requestsToConfirm.map((req) => (
                    <SettlementRequestCard
                      key={req.id}
                      settlement={req}
                      currency={currency}
                      isConfirming
                      onReview={() => handleOpenReviewPanel(req)}
                    />
                  ))}
                </Box>
              )}

              {requestsISent.length > 0 && (
                <Box>
                  <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ display: 'block', mb: 1.5, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                    Sent — awaiting their verdict
                  </Typography>
                  {requestsISent.map((req) => (
                    <SettlementRequestCard
                      key={req.id}
                      settlement={req}
                      currency={currency}
                      isConfirming={false}
                    />
                  ))}
                </Box>
              )}
            </Box>
          )}
        </>
      )}

      {/* History tab content */}
      {activeTab === 'history' && (
        <TransactionHistory
          relationships={relationships}
          currency={currency}
          userMap={userMap}
          currentUserId={currentUserId}
        />
      )}

      {/* Incoming/Outgoing tab content */}
      {activeTab !== 'requests' && activeTab !== 'history' && (
        <>
          {displayList.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 6 }}>
              <Typography variant="body1" color="text.secondary">
                {activeTab === 'incoming'
                  ? 'No one owes you. The pit is quiet.'
                  : "You don't owe anyone. Your honor is intact."}
              </Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {displayList.map((rel) => {
                const isExpanded = expandedUserId === rel.userId;
                const name = getMemberName(rel.userId);
                const isCurrentUser = rel.userId === currentUserId;

                return (
                  <MobileCard
                    key={rel.userId}
                    onClick={() => setExpandedUserId(isExpanded ? null : rel.userId)}
                    accentColor={rel.isIncoming ? theme.palette.primary.main : theme.palette.error.main}
                  >
                    {/* Header row */}
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.5,
                      }}
                    >
                      <Avatar
                        sx={{
                          width: 44,
                          height: 44,
                          bgcolor: rel.isIncoming ? alpha(theme.palette.primary.main, 0.15) : alpha(theme.palette.error.main, 0.15),
                          color: rel.isIncoming ? 'primary.main' : 'error.main',
                          fontWeight: 700,
                          fontSize: '1rem',
                          flexShrink: 0,
                          border: '1px solid',
                          borderColor: alpha(rel.isIncoming ? theme.palette.primary.main : theme.palette.error.main, 0.2),
                        }}
                      >
                        {getMemberInitial(rel.userId)}
                      </Avatar>

                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography
                          variant="body1"
                          fontWeight={600}
                          color="text.primary"
                          noWrap
                          sx={{ fontSize: '0.9rem' }}
                        >
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
                            fontSize: '1.1rem',
                          }}
                        >
                          {formatAmount(rel.totalCents, currency)}
                        </Typography>
                        <Chip
                          label={rel.isIncoming ? 'Tribute owed' : 'Your tribute'}
                          size="small"
                          sx={{
                            height: 18,
                            fontSize: '0.6rem',
                            fontWeight: 700,
                            letterSpacing: '0.03em',
                            textTransform: 'uppercase',
                            bgcolor: alpha(rel.isIncoming ? theme.palette.primary.main : theme.palette.error.main, 0.12),
                            color: rel.isIncoming ? 'primary.main' : 'error.main',
                            border: '1px solid',
                            borderColor: alpha(rel.isIncoming ? theme.palette.primary.main : theme.palette.error.main, 0.2),
                          }}
                        />
                      </Box>

                      <IconButton
                        size="small"
                        sx={{
                          color: 'text.secondary',
                          flexShrink: 0,
                          transition: 'transform 0.2s ease',
                          transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                        }}
                      >
                        <ExpandMoreIcon />
                      </IconButton>
                    </Box>

                    {/* Expanded breakdown */}
                    <Collapse in={isExpanded}>
                      <Divider sx={{ borderColor: alpha('#fff', 0.05) }} />
                      <Box
                        sx={{
                          p: 2,
                          pt: 1.5,
                          maxHeight: isMobile ? 280 : 'none',
                          overflowY: isMobile ? 'auto' : 'visible',
                          pb: isMobile ? 'calc(2 + env(safe-area-inset-bottom, 0px))' : 2,
                          '&::-webkit-scrollbar': {
                            width: 4,
                          },
                          '&::-webkit-scrollbar-track': {
                            background: 'transparent',
                          },
                          '&::-webkit-scrollbar-thumb': {
                            background: alpha(theme.palette.primary.main, 0.2),
                            borderRadius: 2,
                          },
                        }}
                      >
                        {/* Expense transactions */}
                        {rel.expenses.length > 0 && (
                          <>
                            <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ display: 'block', mb: 0.5, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                              Expenses
                            </Typography>
                            {rel.expenses.map((exp, i) => (
                              <ExpenseRow
                                key={i}
                                expense={exp}
                                currency={currency}
                                isIncoming={rel.isIncoming}
                              />
                            ))}
                          </>
                        )}

                        {/* Settlement transactions */}
                        {rel.settlements.length > 0 && (
                          <>
                            <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ display: 'block', mt: 1.5, mb: 0.5, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                              Settlements
                            </Typography>
                            {rel.settlements.map((stl, i) => (
                              <SettlementRow
                                key={i}
                                settlement={stl}
                                currency={currency}
                              />
                            ))}
                          </>
                        )}

                        {/* Payment transactions */}
                        {rel.payments.length > 0 && (
                          <>
                            <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ display: 'block', mt: 1.5, mb: 0.5, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                              Payments
                            </Typography>
                            {rel.payments.map((pmt, i) => (
                              <PaymentRow
                                key={i}
                                payment={pmt}
                                currency={currency}
                              />
                            ))}
                          </>
                        )}

                        {/* Net calculation summary */}
                        {(rel.rawExpenseCents !== 0 || rel.rawSettlementCents !== 0 || rel.rawPaymentCents !== 0) && (
                          <Box
                            sx={{
                              mt: 2,
                              pt: 1.5,
                              borderTop: `1px solid ${alpha('#fff', 0.1)}`,
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 0.5,
                            }}
                          >
                            <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                              Net Calculation
                            </Typography>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Typography variant="body2" color="text.secondary">
                                Expenses
                              </Typography>
                              <Typography variant="body2" fontWeight={600}>
                                {rel.rawExpenseCents >= 0 ? '+' : ''}{formatAmount(rel.rawExpenseCents, currency)}
                              </Typography>
                            </Box>
                            {rel.rawSettlementCents !== 0 && (
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Typography variant="body2" color="text.secondary">
                                  Settlements
                                </Typography>
                                <Typography variant="body2" fontWeight={600}>
                                  {rel.rawSettlementCents >= 0 ? '+' : ''}{formatAmount(rel.rawSettlementCents, currency)}
                                </Typography>
                              </Box>
                            )}
                            {rel.rawPaymentCents !== 0 && (
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Typography variant="body2" color="text.secondary">
                                  Payments
                                </Typography>
                                <Typography variant="body2" fontWeight={600}>
                                  {rel.rawPaymentCents >= 0 ? '+' : ''}{formatAmount(rel.rawPaymentCents, currency)}
                                </Typography>
                              </Box>
                            )}
                          </Box>
                        )}

                        {/* Total row */}
                        <Box
                          sx={{
                            mt: 1.5,
                            pt: 1.5,
                            borderTop: `1px solid ${alpha('#fff', 0.1)}`,
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          <Typography variant="body2" fontWeight={700} color="text.secondary">
                            Net Total:
                          </Typography>
                          <Typography
                            variant="body1"
                            fontWeight={800}
                            sx={{
                              color: rel.isIncoming ? 'primary.main' : 'error.main',
                            }}
                          >
                            {rel.isIncoming ? '+' : '-'}{formatAmount(rel.totalCents, currency)}
                          </Typography>
                        </Box>

                        {/* Restore Honor button (only for outgoing) */}
                        {!rel.isIncoming && rel.totalCents > 0 && (
                          <Button
                            fullWidth
                            variant="contained"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenRestoreHonor(rel.userId, rel.totalCents);
                            }}
                            sx={{
                              mt: 2,
                              bgcolor: 'primary.main',
                              color: '#121212',
                              fontWeight: 700,
                              '&:hover': { bgcolor: 'primary.dark' },
                            }}
                          >
                            Restore Honor {formatAmount(rel.totalCents, currency)}
                          </Button>
                        )}
                        </Box>
                      </Collapse>
                    </MobileCard>
                  );
                })}
            </Box>
          )}
        </>
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

      {/* Settlement Review Panel */}
      {reviewSettlement && (
        <SettlementReviewPanel
          open={reviewPanelOpen}
          onClose={() => setReviewPanelOpen(false)}
          onSuccess={handleReviewSuccess}
          settlement={reviewSettlement}
          fromUserInfo={userMap.get(reviewSettlement.from_user)}
          toUserInfo={userMap.get(reviewSettlement.to_user)}
          currency={currency}
          eventId={eventId}
          currentUserId={currentUserId}
        />
      )}
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

// ---------------------------------------------------------------------------
// Settlement Row
// ---------------------------------------------------------------------------

function SettlementRow({
  settlement,
  currency,
}: {
  settlement: SettlementBreakdown;
  currency: string;
}) {
  const createdDate = new Date(settlement.created_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

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
          bgcolor: alpha('#10b981', 0.15),
          color: '#10b981',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <SettleIcon sx={{ fontSize: 14 }} />
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Typography variant="body2" fontWeight={600} color="text.primary" noWrap>
            {settlement.note || 'Settlement'}
          </Typography>
        </Box>
        <Typography variant="caption" color="text.secondary">
          {createdDate} • {settlement.status}
        </Typography>
      </Box>
      <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
        <Typography
          variant="body2"
          fontWeight={700}
          sx={{ color: '#10b981' }}
        >
          {formatAmount(settlement.amount_cents, currency)}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          settled
        </Typography>
      </Box>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Payment Row
// ---------------------------------------------------------------------------

function PaymentRow({
  payment,
  currency,
}: {
  payment: PaymentBreakdown;
  currency: string;
}) {
  const recordedDate = new Date(payment.recorded_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

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
          bgcolor: alpha('#8b5cf6', 0.15),
          color: '#8b5cf6',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <PaymentIcon sx={{ fontSize: 14 }} />
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Typography variant="body2" fontWeight={600} color="text.primary" noWrap>
            {payment.description || 'Payment'}
          </Typography>
        </Box>
        <Typography variant="caption" color="text.secondary">
          {recordedDate}
        </Typography>
      </Box>
      <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
        <Typography
          variant="body2"
          fontWeight={700}
          sx={{ color: '#8b5cf6' }}
        >
          {formatAmount(payment.amount_cents, currency)}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          paid
        </Typography>
      </Box>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Settlement Request Card
// ---------------------------------------------------------------------------

function SettlementRequestCard({
  settlement,
  currency,
  isConfirming,
  onReview,
}: {
  settlement: SettlementListItem;
  currency: string;
  isConfirming: boolean;
  onReview?: () => void;
}) {
  const otherUserId = isConfirming ? settlement.from_user : settlement.to_user;
  const user = useUser(otherUserId);
  const displayName = user
    ? `${user.firstName} ${user.lastName}`.trim() || user.email
    : otherUserId.slice(0, 8);
  const initial = displayName.charAt(0).toUpperCase();

  const time = new Date(settlement.created_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        p: 2,
        borderRadius: 2,
        border: `1px solid ${alpha('#fff', 0.1)}`,
        bgcolor: 'elevated.main',
        mb: 1.5,
        cursor: isConfirming ? 'pointer' : 'default',
        '&:hover': isConfirming ? { bgcolor: alpha('#fff', 0.03) } : {},
      }}
      onClick={isConfirming ? onReview : undefined}
    >
      <Avatar
        sx={{
          width: 40,
          height: 40,
          bgcolor: isConfirming ? 'primary.main' : 'warning.main',
          color: '#121212',
          fontWeight: 700,
          flexShrink: 0,
        }}
      >
        {initial}
      </Avatar>

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" fontWeight={600} color="text.primary" noWrap>
          {isConfirming ? `${displayName} claims to have paid` : `Waiting for ${displayName}`}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {time}
        </Typography>
      </Box>

      <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
        <Typography variant="body1" fontWeight={700} color="text.primary">
          {formatAmount(settlement.amount_cents, currency)}
        </Typography>
        <Chip
          label="Pending"
          size="small"
          sx={{
            height: 20,
            fontSize: '0.65rem',
            fontWeight: 700,
            bgcolor: alpha('#F59E0B', 0.15),
            color: 'warning.main',
          }}
        />
      </Box>

      {isConfirming && onReview && (
        <Button
          size="small"
          variant="contained"
          startIcon={<ConfirmIcon sx={{ fontSize: 16 }} />}
          onClick={(e) => {
            e.stopPropagation();
            onReview();
          }}
          sx={{
            bgcolor: 'primary.main',
            color: '#121212',
            fontWeight: 700,
            '&:hover': { bgcolor: 'primary.dark' },
          }}
        >
          Review
        </Button>
      )}
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Transaction History Component
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

function TransactionHistory({
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

  // Flatten all settlements and payments from all relationships
  const transactions = useMemo(() => {
    const items: TransactionItem[] = [];
    let idx = 0;

    for (const rel of relationships) {
      const counterpartyName = getMemberNameFromMap(rel.userId);
      const counterpartyInitial = counterpartyName.charAt(0).toUpperCase();

      // Add settlements
      for (const settlement of rel.settlements) {
        const isOutgoing = settlement.from_user === currentUserId;
        items.push({
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
        });
      }

      // Add payments
      for (const payment of rel.payments) {
        const isOutgoing = payment.from_user === currentUserId;
        items.push({
          id: payment.id || `payment-${idx++}`,
          type: 'payment',
          date: new Date(payment.recorded_at),
          amountCents: payment.amount_cents,
          counterpartyUserId: rel.userId,
          counterpartyName,
          counterpartyInitial,
          note: payment.description || undefined,
          isOutgoing,
        });
      }
    }

    // Sort by date (newest first)
    return items.sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [relationships, currentUserId, userMap, getMemberNameFromMap]);

  if (transactions.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 6 }}>
        <Typography variant="body1" color="text.secondary">
          No transaction history yet.
        </Typography>
      </Box>
    );
  }

  // Group transactions by date
  const groupedTransactions = new Map<string, TransactionItem[]>();
  for (const tx of transactions) {
    const validDate = tx.date && !isNaN(tx.date.getTime()) ? tx.date : new Date();
    const dateKey = validDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const existing = groupedTransactions.get(dateKey) || [];
    existing.push({ ...tx, date: validDate });
    groupedTransactions.set(dateKey, existing);
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {Array.from(groupedTransactions.entries()).map(([dateKey, dayTransactions]) => (
        <Box key={dateKey}>
          <Typography
            variant="caption"
            fontWeight={700}
            color="text.secondary"
            sx={{ display: 'block', mb: 1, mt: 2, letterSpacing: '0.05em', textTransform: 'uppercase' }}
          >
            {dateKey}
          </Typography>
          {dayTransactions.map((tx) => {
            const validDate = tx.date && !isNaN(tx.date.getTime()) ? tx.date : new Date();
            const timeStr = validDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
            return (
              <TransactionHistoryRow
                key={tx.id}
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
            );
          })}
        </Box>
      ))}
    </Box>
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
