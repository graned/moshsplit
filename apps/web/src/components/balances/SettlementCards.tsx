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
  Card,
  CardContent,
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
} from '@mui/icons-material';
import { useUserCache, useUser } from '../../hooks/useUserCache';
import { UserInfo } from '../../api/users.api';
import { ExpenseBreakdown } from '../../api/balances.api';
import { SettlementListItem } from '../../api/settlements.api';
import { GroupMember } from '../../api/groups.api';
import { RestoreHonorModal } from '../settlements/RestoreHonorModal';
import { SettlementReviewPanel } from '../settlements/SettlementReviewPanel';

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

interface SettlementCardsProps {
  activeTab?: 'incoming' | 'outgoing' | 'requests';
  onTabChange?: (tab: 'incoming' | 'outgoing' | 'requests') => void;
  relationships: RelationshipSummary[];
  currentUserId: string;
  currency: string;
  members: GroupMember[];
  settlementRequests: SettlementListItem[];
  onSettlementSuccess?: () => void;
  eventId: string;
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
  const internalActiveTab = useState<'incoming' | 'outgoing' | 'requests'>('incoming');
  const [internalTab, setInternalTab] = internalActiveTab;

  const activeTab = controlledActiveTab !== undefined ? controlledActiveTab : internalTab;
  const setActiveTab = (tab: 'incoming' | 'outgoing' | 'requests') => {
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

      {/* Incoming/Outgoing tab content */}
      {activeTab !== 'requests' && (
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
                  <Card
                    key={rel.userId}
                    onClick={() => setExpandedUserId(isExpanded ? null : rel.userId)}
                    sx={{
                      cursor: 'pointer',
                      transition: 'border-color 0.2s ease, box-shadow 0.2s ease, transform 0.15s ease',
                      backgroundColor: 'background.paper',
                      borderColor: 'divider',
                      borderRadius: 2,
                      overflow: 'hidden',
                      '&:hover': {
                        borderColor: alpha(rel.isIncoming ? theme.palette.primary.main : theme.palette.error.main, 0.3),
                        boxShadow: `0 4px 16px ${alpha(rel.isIncoming ? theme.palette.primary.main : theme.palette.error.main, 0.12)}`,
                        transform: 'translateY(-1px)',
                      },
                      '&:active': isMobile ? { transform: 'scale(0.98)' } : {},
                    }}
                  >
                    <CardContent sx={{ py: 2, px: 2, '&:last-child': { pb: 2 } }}>
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
                    </CardContent>

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
                  </Card>
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
