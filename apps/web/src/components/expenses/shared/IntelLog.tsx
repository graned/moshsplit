import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  Drawer,
  Box,
  Typography,
  Avatar,
  IconButton,
  alpha,
  useTheme,
  useMediaQuery,
  CircularProgress,
} from '@mui/material';
import {
  Close as CloseIcon,
  SportsBar as SportsBarIcon,
  LocalGasStation as LocalGasStationIcon,
  Restaurant as RestaurantIcon,
  DirectionsBus as DirectionsBusIcon,
  ShoppingBag as ShoppingBagIcon,
  Receipt as ReceiptIcon,
  EventAvailable as EventAvailableIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';
import { ExpenseListItem, expensesApi, ExpenseVersionDetail } from '../../../api/expenses.api';
import { UserInfo } from '../../../api/users.api';
import { useUsers } from '../../../hooks/useUserCache';
import { GroupMember } from '../../../api/groups.api';

const EXPENSE_TYPE_CONFIG: Record<string, { icon: React.ReactElement; label: string }> = {
  beer: { icon: <SportsBarIcon />, label: 'Beer Supply Run' },
  gas: { icon: <LocalGasStationIcon />, label: 'Fuel Run' },
  food: { icon: <RestaurantIcon />, label: 'Food Run' },
  transport: { icon: <DirectionsBusIcon />, label: 'Transport' },
  merch: { icon: <ShoppingBagIcon />, label: 'Merch Haul' },
  camping: { icon: <ReceiptIcon />, label: 'Camping Gear' },
};

const formatAmount = (cents: number, currency = 'EUR') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100);

function formatRelativeTime(date: string): string {
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffHours < 1) return 'Just now';
  if (diffHours < 24) return `Today, ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
  if (diffDays < 2) return `Yesterday, ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

interface IntelLogProps {
  open: boolean;
  onClose: () => void;
  expense: ExpenseListItem | null;
  eventId: string;
  members: GroupMember[];
  currency: string;
  currentUserId: string;
}

interface SurvivorStatus {
  userId: string;
  name: string;
  email: string;
  shareCents: number;
  settledCents: number;
  isSettled: boolean;
  isDisputed: boolean;
}

export function IntelLog({ open, onClose, expense, eventId, members, currency, currentUserId }: IntelLogProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [versions, setVersions] = useState<ExpenseVersionDetail[]>([]);
  const [loading, setLoading] = useState(false);
  const [pitExpanded, setPitExpanded] = useState(false);

  useEffect(() => {
    if (expense && open) {
      setLoading(true);
      setVersions([]);
      expensesApi
        .listVersions(eventId, expense.id)
        .then((data) => {
          setVersions(data);
        })
        .catch((err) => console.error('[IntelLog] Failed to load versions:', err))
        .finally(() => setLoading(false));
    }
  }, [expense, eventId, open]);

  const latestVersion = versions.length > 0 ? versions[versions.length - 1] : null;

  // Build synthetic version from expense data when versions API returns empty
  const syntheticVersion = useMemo((): ExpenseVersionDetail | null => {
    if (latestVersion) return latestVersion;
    if (!expense?.participant_ids || expense.participant_ids.length === 0) return null;

    const perPerson = Math.round(expense.amount_cents / expense.participant_ids.length);
    return {
      id: expense.current_version_id || expense.id,
      expense_id: expense.id,
      version_number: expense.version_number || 1,
      title: expense.title,
      description: expense.description,
      amount_cents: expense.amount_cents,
      paid_by: expense.paid_by,
      split_type: expense.split_type || 'equal',
      split_data: {},
      notes: expense.notes,
      created_by: expense.created_by,
      created_at: expense.created_at,
      shares: expense.participant_ids.map((userId) => ({
        user_id: userId,
        share_cents: perPerson,
      })),
    };
  }, [latestVersion, expense]);

  const memberUserIds = useMemo(() => members.map((m) => m.user_id), [members]);
  const shareUserIds = useMemo(() => {
    if (!syntheticVersion?.shares) return [];
    return syntheticVersion.shares.map((s) => s.user_id);
  }, [syntheticVersion]);

  const payerId = syntheticVersion?.paid_by ?? expense?.paid_by;

  const allUserIds = useMemo(() => {
    const ids = new Set<string>([...memberUserIds, ...shareUserIds]);
    if (payerId) ids.add(payerId);
    return Array.from(ids);
  }, [memberUserIds, shareUserIds, payerId]);

  const userMap = useUsers(allUserIds);

  const getUser = (id: string): UserInfo | undefined => userMap[id];

  const getMemberName = (userId: string): string => {
    const user = getUser(userId);
    if (user) {
      const fullName = `${user.firstName} ${user.lastName}`.trim();
      return fullName || user.email || userId.slice(0, 8);
    }
    const member = members.find((m) => m.user_id === userId);
    return member?.user_name || member?.user_email || userId.slice(0, 8);
  };

  const payerName = useMemo(() => {
    const payerUserId = syntheticVersion?.paid_by ?? expense?.paid_by;
    if (!payerUserId) return '';
    const user = userMap[payerUserId];
    if (user) {
      const fullName = `${user.firstName} ${user.lastName}`.trim();
      return fullName || user.email || payerUserId.slice(0, 8);
    }
    const member = members.find((m) => m.user_id === payerUserId);
    return member?.user_name || member?.user_email || payerUserId.slice(0, 8);
  }, [syntheticVersion, expense?.paid_by, userMap, members]);

  const payerInitial = payerName.charAt(0).toUpperCase();

  const survivors: SurvivorStatus[] = useMemo(() => {
    if (!syntheticVersion?.shares) return [];
    const settledMap: Record<string, number> = {};
    return syntheticVersion.shares.map((share) => {
      const name = getMemberName(share.user_id);
      const user = getUser(share.user_id);
      const settled = settledMap[share.user_id] || 0;
      return {
        userId: share.user_id,
        name,
        email: user?.email || '',
        shareCents: share.share_cents,
        settledCents: settled,
        isSettled: settled >= share.share_cents,
        isDisputed: false,
      };
    });
  }, [syntheticVersion, userMap, members]);

  const perPersonCents = syntheticVersion && survivors.length > 0
    ? Math.round(syntheticVersion.amount_cents / survivors.length)
    : 0;

  const myShareCents = useMemo(() => {
    // Try from survivors (latest version shares)
    const myShare = survivors.find((s) => s.userId === currentUserId);
    if (myShare) return myShare.shareCents;

    // Fallback: compute from expense participant_ids
    if (expense?.participant_ids && expense.participant_ids.length > 0) {
      const perPerson = Math.round(expense.amount_cents / expense.participant_ids.length);
      if (expense.participant_ids.includes(currentUserId)) {
        return perPerson;
      }
    }

    // Fallback: compute from survivors count if syntheticVersion exists
    if (syntheticVersion && survivors.length > 0) return perPersonCents;

    return null;
  }, [survivors, currentUserId, syntheticVersion, perPersonCents, expense]);

  const settledCount = survivors.filter((s) => s.isSettled).length;

  const typeConfig = expense?.expense_type ? EXPENSE_TYPE_CONFIG[expense.expense_type] : null;
  const typeIcon = typeConfig?.icon ?? <ReceiptIcon />;

  if (!expense) return null;

  const content = (
    <>
      {/* Title */}
      <Box
        sx={{
          px: 2,
          pb: 1.5,
          borderBottom: 1,
          borderColor: 'divider',
          flexShrink: 0,
        }}
      >
        <Typography
          variant="h6"
          fontWeight={700}
          sx={{
            fontSize: '1.1rem',
            color: 'primary.main',
            letterSpacing: '-0.02em',
          }}
        >
          Intel Log
        </Typography>
      </Box>

      {/* Scrollable Content */}
      <Box sx={{ overflow: 'auto', flex: 1 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            {/* Hero Section */}
            <Box
              sx={{
                px: { xs: 2, md: 4 },
                pt: 4,
                pb: 4,
                textAlign: 'center',
                background: 'linear-gradient(to bottom, #1c1b1b, #131313)',
                position: 'relative',
              }}
            >
              <Box
                sx={{
                  width: 64,
                  height: 64,
                  borderRadius: '50%',
                  bgcolor: 'primary.main',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mb: 2,
                  boxShadow: `0px 8px 24px ${alpha(theme.palette.primary.main, 0.2)}`,
                  color: '#121212',
                }}
              >
                {typeIcon}
              </Box>

              <Typography
                sx={{
                  fontSize: { xs: '1.5rem', md: '2rem' },
                  fontWeight: 600,
                  color: 'text.primary',
                  mb: 1,
                  letterSpacing: '-0.01em',
                }}
              >
                {expense.title}
              </Typography>

              <Typography
                sx={{
                  fontSize: { xs: '2.5rem', md: '3rem' },
                  fontWeight: 700,
                  color: 'primary.main',
                  letterSpacing: '-0.02em',
                  lineHeight: 1.2,
                }}
              >
                {formatAmount(expense.amount_cents, currency)}
              </Typography>

              <Box
                sx={{
                  mt: 1.5,
                  px: 2,
                  py: 0.5,
                  bgcolor: 'elevated.main',
                  borderRadius: 100,
                  border: '1px solid',
                  borderColor: alpha('#fff', 0.05),
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 0.5,
                }}
              >
                <EventAvailableIcon sx={{ fontSize: 16, color: 'primary.main' }} />
                <Typography
                  sx={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                    color: 'text.secondary',
                  }}
                >
                  {formatRelativeTime(expense.created_at)}
                </Typography>
              </Box>
            </Box>

            {/* Stats Grid */}
            <Box sx={{ px: { xs: 2, md: 4 }, mb: 3, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
              <Box
                sx={{
                  bgcolor: 'background.paper',
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: alpha('#fff', 0.1),
                  p: 2,
                }}
              >
                <Typography
                  sx={{
                    fontSize: '0.625rem',
                    fontWeight: 700,
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                    color: 'text.secondary',
                    mb: 0.5,
                  }}
                >
                  Your Share
                </Typography>
                <Typography sx={{ fontSize: '1.25rem', fontWeight: 600, color: 'text.primary' }}>
                  {myShareCents !== null ? formatAmount(myShareCents, currency) : '—'}
                </Typography>
              </Box>
              <Box
                sx={{
                  bgcolor: 'background.paper',
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: alpha('#fff', 0.1),
                  p: 2,
                }}
              >
                <Typography
                  sx={{
                    fontSize: '0.625rem',
                    fontWeight: 700,
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                    color: 'text.secondary',
                    mb: 0.5,
                  }}
                >
                  Settled
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
                  <Typography sx={{ fontSize: '1.25rem', fontWeight: 600, color: 'primary.main' }}>
                    {settledCount}
                  </Typography>
                  <Typography sx={{ fontSize: '0.875rem', color: 'text.secondary' }}>
                    / {survivors.length} people
                  </Typography>
                </Box>
              </Box>
            </Box>

            {/* The Benefactor */}
            <Box sx={{ px: { xs: 2, md: 4 }, mb: 3 }}>
              <Typography
                sx={{
                  fontSize: '0.625rem',
                  fontWeight: 700,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: 'text.secondary',
                  mb: 2,
                }}
              >
                The Benefactor
              </Typography>
              <Box
                sx={{
                  bgcolor: 'elevated.main',
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: alpha('#fff', 0.1),
                  p: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Avatar
                    sx={{
                      width: 48,
                      height: 48,
                      borderRadius: '50%',
                      bgcolor: 'action.disabledBackground',
                      border: '2px solid',
                      borderColor: 'primary.main',
                    }}
                  >
                    {payerInitial}
                  </Avatar>
                  <Box>
                    <Typography sx={{ fontSize: '1.125rem', fontWeight: 600, color: 'text.primary' }}>
                      {payerName}
                    </Typography>
                    <Typography sx={{ fontSize: '0.875rem', color: 'text.secondary' }}>
                      Covered the full bill
                    </Typography>
                  </Box>
                </Box>
                <Box sx={{ textAlign: 'right' }}>
                  <Typography sx={{ fontSize: '1.125rem', fontWeight: 600, color: 'text.primary' }}>
                    {formatAmount(expense.amount_cents, currency)}
                  </Typography>
                  <Typography
                    sx={{
                      fontSize: '0.625rem',
                      fontWeight: 700,
                      letterSpacing: '0.05em',
                      textTransform: 'uppercase',
                      color: 'primary.main',
                      bgcolor: alpha(theme.palette.primary.main, 0.1),
                      px: 0.5,
                      py: 0.25,
                      borderRadius: 0.5,
                      display: 'inline-block',
                    }}
                  >
                    Paid
                  </Typography>
                </Box>
              </Box>
            </Box>

            {/* Notes from the Scene */}
            {expense.notes && (
              <Box sx={{ px: { xs: 2, md: 4 }, mb: 3 }}>
                <Typography
                  sx={{
                    fontSize: '0.625rem',
                    fontWeight: 700,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    color: 'text.secondary',
                    mb: 1.5,
                  }}
                >
                  Notes from the Scene
                </Typography>
                <Box
                  sx={{
                    p: 2,
                    borderRadius: 2,
                    bgcolor: 'elevated.main',
                    border: '1px solid',
                    borderColor: alpha('#fff', 0.05),
                    borderLeft: '3px solid',
                    borderLeftColor: alpha(theme.palette.primary.main, 0.4),
                  }}
                >
                  <Typography
                    component="span"
                    sx={{
                      fontSize: '0.875rem',
                      fontStyle: 'italic',
                      color: 'text.secondary',
                      lineHeight: 1.6,
                    }}
                  >
                    "{expense.notes}"
                  </Typography>
                </Box>
              </Box>
            )}

            {/* The Mosh Pit */}
            <Box sx={{ px: { xs: 2, md: 4 }, mb: 3 }}>
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  mb: 2,
                  cursor: 'pointer',
                }}
                onClick={() => setPitExpanded(!pitExpanded)}
              >
                <Typography
                  sx={{
                    fontSize: '0.625rem',
                    fontWeight: 700,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    color: 'text.secondary',
                  }}
                >
                  {survivors.length} in the Pit
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography sx={{ fontSize: '0.875rem', color: 'primary.main', fontWeight: 600 }}>
                    {formatAmount(perPersonCents, currency)} each
                  </Typography>
                  {pitExpanded ? <ExpandLessIcon sx={{ fontSize: 20, color: 'text.secondary' }} /> : <ExpandMoreIcon sx={{ fontSize: 20, color: 'text.secondary' }} />}
                </Box>
              </Box>

              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1,
                  maxHeight: pitExpanded ? 'none' : `${32 * 2 + 8 * 1}px`,
                  overflow: 'hidden',
                  transition: 'max-height 0.3s ease',
                }}
              >
                {survivors.map((survivor) => {
                  const progress = survivor.shareCents > 0 ? (survivor.settledCents / survivor.shareCents) * 100 : 0;
                  const isCurrentUser = survivor.userId === currentUserId;

                  return (
                    <Box
                      key={survivor.userId}
                      sx={{
                        bgcolor: '#1c1b1b',
                        borderRadius: 1.5,
                        border: '1px solid',
                        borderColor: alpha('#fff', 0.05),
                        p: 1.5,
                        flexShrink: 0,
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Avatar
                            sx={{
                              width: 32,
                              height: 32,
                              borderRadius: '50%',
                              bgcolor: isCurrentUser ? 'primary.main' : 'action.disabledBackground',
                              color: isCurrentUser ? '#121212' : 'text.primary',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                            }}
                          >
                            {survivor.name.charAt(0).toUpperCase()}
                          </Avatar>
                          <Typography component="span" sx={{ fontSize: '0.875rem', color: 'text.primary', fontWeight: isCurrentUser ? 600 : 400 }}>
                            {isCurrentUser ? 'You' : survivor.name}
                          </Typography>
                        </Box>
                        {survivor.isSettled ? (
                          <Typography
                            sx={{
                              fontSize: '0.625rem',
                              fontWeight: 700,
                              letterSpacing: '0.05em',
                              color: 'primary.main',
                            }}
                          >
                            Settled
                          </Typography>
                        ) : survivor.isDisputed ? (
                          <Typography
                            sx={{
                              fontSize: '0.625rem',
                              fontWeight: 700,
                              letterSpacing: '0.05em',
                              color: 'error.main',
                              textTransform: 'uppercase',
                            }}
                          >
                            Disputed
                          </Typography>
                        ) : (
                          <Typography
                            sx={{
                              fontSize: '0.625rem',
                              fontWeight: 700,
                              letterSpacing: '0.05em',
                              color: 'text.secondary',
                            }}
                          >
                            Split Share {formatAmount(survivor.shareCents - survivor.settledCents, currency)}
                          </Typography>
                        )}
                      </Box>
                      <Box sx={{ width: '100%', bgcolor: 'elevatedHighest', height: 4, borderRadius: 100, overflow: 'hidden' }}>
                        <Box
                          sx={{
                            height: '100%',
                            width: `${progress}%`,
                            bgcolor: survivor.isSettled ? theme.palette.primary.main : survivor.isDisputed ? theme.palette.error.main : alpha(theme.palette.primary.main, 0.2),
                            borderRadius: 100,
                            transition: 'width 0.3s ease',
                          }}
                        />
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            </Box>
          </>
        )}
      </Box>
    </>
  );

  if (isMobile) {
    return (
      <Drawer
        anchor="bottom"
        open={open}
        onClose={onClose}
        slotProps={{
          backdrop: {
            sx: {
              bgcolor: 'rgba(0, 0, 0, 0.6)',
            },
          },
        }}
        sx={{
          '& .MuiDrawer-paper': {
            bgcolor: '#1A1A1A',
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            maxHeight: '92dvh',
            height: 'auto',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          },
        }}
      >
        {/* Grab handle */}
        <Box
          sx={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            px: 2,
            pt: 1.5,
            pb: 0.5,
            flexShrink: 0,
          }}
        >
          <Box
            sx={{
              position: 'absolute',
              top: 8,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 36,
              height: 4,
              borderRadius: 2,
              bgcolor: alpha('#fff', 0.15),
            }}
          />
          <IconButton
            onClick={onClose}
            size="small"
            sx={{
              color: 'text.secondary',
              width: 32,
              height: 32,
              '&:hover': { color: 'text.primary', bgcolor: 'action.hover' },
            }}
          >
            <CloseIcon sx={{ fontSize: 20 }} />
          </IconButton>
        </Box>

        {/* Title */}
        <Box
          sx={{
            px: 2,
            pb: 1.5,
            borderBottom: 1,
            borderColor: 'divider',
            flexShrink: 0,
          }}
        >
          <Typography
            variant="h6"
            fontWeight={700}
            sx={{
              fontSize: '1.1rem',
              color: 'primary.main',
              letterSpacing: '-0.02em',
            }}
          >
            Intel Log
          </Typography>
        </Box>

        {/* Scrollable content wrapper */}
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            overflow: 'hidden',
            px: 2,
            pb: 'max(16px, env(safe-area-inset-bottom))',
          }}
        >
          <Box sx={{ overflow: 'auto', flex: 1 }}>
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                <CircularProgress />
              </Box>
            ) : (
              <>
                {/* Hero Section */}
                <Box
                  sx={{
                    pt: 3,
                    pb: 3,
                    textAlign: 'center',
                    background: 'linear-gradient(to bottom, #1c1b1b, #131313)',
                    position: 'relative',
                    mx: -2,
                    px: 2,
                  }}
                >
                  <Box
                    sx={{
                      width: 52,
                      height: 52,
                      borderRadius: '50%',
                      bgcolor: 'primary.main',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mb: 1.5,
                      boxShadow: `0px 6px 20px ${alpha(theme.palette.primary.main, 0.2)}`,
                      color: '#121212',
                      '& svg': { fontSize: 26 },
                    }}
                  >
                    {typeIcon}
                  </Box>

                  <Typography
                    sx={{
                      fontSize: '1.25rem',
                      fontWeight: 600,
                      color: 'text.primary',
                      mb: 0.75,
                      letterSpacing: '-0.01em',
                    }}
                  >
                    {expense.title}
                  </Typography>

                  <Typography
                    sx={{
                      fontSize: '2rem',
                      fontWeight: 700,
                      color: 'primary.main',
                      letterSpacing: '-0.02em',
                      lineHeight: 1.2,
                    }}
                  >
                    {formatAmount(expense.amount_cents, currency)}
                  </Typography>

                  <Box
                    sx={{
                      mt: 1,
                      px: 1.5,
                      py: 0.5,
                      bgcolor: 'elevated.main',
                      borderRadius: 100,
                      border: '1px solid',
                      borderColor: alpha('#fff', 0.05),
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 0.5,
                    }}
                  >
                    <EventAvailableIcon sx={{ fontSize: 14, color: 'primary.main' }} />
                    <Typography
                      sx={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        letterSpacing: '0.05em',
                        textTransform: 'uppercase',
                        color: 'text.secondary',
                      }}
                    >
                      {formatRelativeTime(expense.created_at)}
                    </Typography>
                  </Box>
                </Box>

                {/* Stats Grid */}
                <Box sx={{ mb: 2, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
                  <Box
                    sx={{
                      bgcolor: 'background.paper',
                      borderRadius: 2,
                      border: '1px solid',
                      borderColor: alpha('#fff', 0.1),
                      p: 2.5,
                    }}
                  >
                    <Typography
                      sx={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        letterSpacing: '0.05em',
                        textTransform: 'uppercase',
                        color: 'text.secondary',
                        mb: 0.5,
                      }}
                    >
                      Your Share
                    </Typography>
                    <Typography sx={{ fontSize: '1.25rem', fontWeight: 600, color: 'text.primary' }}>
                      {myShareCents !== null ? formatAmount(myShareCents, currency) : '—'}
                    </Typography>
                  </Box>
                  <Box
                    sx={{
                      bgcolor: 'background.paper',
                      borderRadius: 2,
                      border: '1px solid',
                      borderColor: alpha('#fff', 0.1),
                      p: 2.5,
                    }}
                  >
                    <Typography
                      sx={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        letterSpacing: '0.05em',
                        textTransform: 'uppercase',
                        color: 'text.secondary',
                        mb: 0.5,
                      }}
                    >
                      Settled
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
                      <Typography sx={{ fontSize: '1.25rem', fontWeight: 600, color: 'primary.main' }}>
                        {settledCount}
                      </Typography>
                      <Typography sx={{ fontSize: '0.875rem', color: 'text.secondary' }}>
                        / {survivors.length} people
                      </Typography>
                    </Box>
                  </Box>
                </Box>

                {/* The Benefactor */}
                <Box sx={{ mb: 2.5 }}>
                  <Typography
                    sx={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                      color: 'text.secondary',
                      mb: 1.5,
                    }}
                  >
                    The Benefactor
                  </Typography>
                  <Box
                    sx={{
                      bgcolor: 'elevated.main',
                      borderRadius: 2,
                      border: '1px solid',
                      borderColor: alpha('#fff', 0.1),
                      p: 2,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      minHeight: 48,
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0, flex: 1 }}>
                      <Avatar
                        sx={{
                          width: 40,
                          height: 40,
                          borderRadius: '50%',
                          bgcolor: 'action.disabledBackground',
                          border: '2px solid',
                          borderColor: 'primary.main',
                          fontSize: '0.875rem',
                        }}
                      >
                        {payerInitial}
                      </Avatar>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography
                          sx={{
                            fontSize: '1rem',
                            fontWeight: 600,
                            color: 'text.primary',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            maxWidth: { xs: '140px', sm: 'none' },
                          }}
                        >
                          {payerName}
                        </Typography>
                        <Typography sx={{ fontSize: '0.8125rem', color: 'text.secondary' }}>
                          Covered the full bill
                        </Typography>
                      </Box>
                    </Box>
                    <Box sx={{ textAlign: 'right', flexShrink: 0, ml: 1 }}>
                      <Typography sx={{ fontSize: '1rem', fontWeight: 600, color: 'text.primary' }}>
                        {formatAmount(expense.amount_cents, currency)}
                      </Typography>
                      <Typography
                        sx={{
                          fontSize: '0.625rem',
                          fontWeight: 700,
                          letterSpacing: '0.05em',
                          textTransform: 'uppercase',
                          color: 'primary.main',
                          bgcolor: alpha(theme.palette.primary.main, 0.1),
                          px: 0.5,
                          py: 0.25,
                          borderRadius: 0.5,
                          display: 'inline-block',
                        }}
                      >
                        Paid
                      </Typography>
                    </Box>
                  </Box>
                </Box>

                {/* Notes from the Scene */}
                {expense.notes && (
                  <Box sx={{ mb: 2.5 }}>
                    <Typography
                      sx={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        letterSpacing: '0.1em',
                        textTransform: 'uppercase',
                        color: 'text.secondary',
                        mb: 1.5,
                      }}
                    >
                      Notes from the Scene
                    </Typography>
                    <Box
                      sx={{
                        p: 2,
                        borderRadius: 2,
                        bgcolor: 'elevated.main',
                        border: '1px solid',
                        borderColor: alpha('#fff', 0.05),
                        borderLeft: '3px solid',
                        borderLeftColor: alpha(theme.palette.primary.main, 0.4),
                      }}
                    >
                      <Typography
                        component="span"
                        sx={{
                          fontSize: '0.875rem',
                          fontStyle: 'italic',
                          color: 'text.secondary',
                          lineHeight: 1.6,
                        }}
                      >
                        "{expense.notes}"
                      </Typography>
                    </Box>
                  </Box>
                )}

                {/* The Mosh Pit */}
                <Box sx={{ mb: 2 }}>
                  {/* Expand/collapse header - full-width touch target */}
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      px: 2,
                      py: 1.5,
                      mb: 1,
                      borderRadius: 2,
                      bgcolor: 'elevated.main',
                      border: '1px solid',
                      borderColor: pitExpanded ? alpha(theme.palette.primary.main, 0.2) : alpha('#fff', 0.06),
                      cursor: 'pointer',
                      minHeight: 48,
                      transition: 'border-color 0.2s ease, background-color 0.15s ease',
                      '&:active': {
                        bgcolor: alpha('#fff', 0.04),
                      },
                    }}
                    onClick={() => setPitExpanded(!pitExpanded)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setPitExpanded(!pitExpanded); } }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography
                        sx={{
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          letterSpacing: '0.1em',
                          textTransform: 'uppercase',
                          color: 'text.secondary',
                        }}
                      >
                        {survivors.length} in the Pit
                      </Typography>
                      {settledCount > 0 && (
                        <Typography
                          sx={{
                            fontSize: '0.6875rem',
                            fontWeight: 600,
                            color: 'primary.main',
                            bgcolor: alpha(theme.palette.primary.main, 0.1),
                            px: 0.75,
                            py: 0.25,
                            borderRadius: 1,
                          }}
                        >
                          {settledCount} settled
                        </Typography>
                      )}
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography
                        sx={{
                          fontSize: '0.8125rem',
                          color: 'primary.main',
                          fontWeight: 600,
                        }}
                      >
                        {formatAmount(perPersonCents, currency)} each
                      </Typography>
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: 28,
                          height: 28,
                          borderRadius: '50%',
                          bgcolor: alpha('#fff', 0.06),
                          transition: 'transform 0.2s ease',
                          transform: pitExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                        }}
                      >
                        {pitExpanded ? <ExpandLessIcon sx={{ fontSize: 18, color: 'text.secondary' }} /> : <ExpandMoreIcon sx={{ fontSize: 18, color: 'text.secondary' }} />}
                      </Box>
                    </Box>
                  </Box>

                  <Box
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 1.5,
                      maxHeight: pitExpanded ? 'none' : '196px',
                      overflow: 'hidden',
                      transition: 'max-height 0.3s ease',
                    }}
                  >
                    {survivors.map((survivor) => {
                      const progress = survivor.shareCents > 0 ? (survivor.settledCents / survivor.shareCents) * 100 : 0;
                      const isCurrentUser = survivor.userId === currentUserId;

                      return (
                        <Box
                          key={survivor.userId}
                          sx={{
                            bgcolor: '#1c1b1b',
                            borderRadius: 2,
                            border: '1px solid',
                            borderColor: isCurrentUser
                              ? alpha(theme.palette.primary.main, 0.2)
                              : alpha('#fff', 0.05),
                            p: 1.75,
                            flexShrink: 0,
                          }}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0, flex: 1 }}>
                              <Avatar
                                sx={{
                                  width: 36,
                                  height: 36,
                                  borderRadius: '50%',
                                  bgcolor: isCurrentUser ? 'primary.main' : 'action.disabledBackground',
                                  color: isCurrentUser ? '#121212' : 'text.primary',
                                  fontSize: '0.8125rem',
                                  fontWeight: 700,
                                  flexShrink: 0,
                                }}
                              >
                                {survivor.name.charAt(0).toUpperCase()}
                              </Avatar>
                              <Typography
                                component="span"
                                sx={{
                                  fontSize: '0.875rem',
                                  color: 'text.primary',
                                  fontWeight: isCurrentUser ? 600 : 400,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {isCurrentUser ? 'You' : survivor.name}
                              </Typography>
                            </Box>
                            {survivor.isSettled ? (
                              <Typography
                                sx={{
                                  fontSize: '0.6875rem',
                                  fontWeight: 700,
                                  letterSpacing: '0.05em',
                                  color: 'primary.main',
                                  bgcolor: alpha(theme.palette.primary.main, 0.1),
                                  px: 1,
                                  py: 0.25,
                                  borderRadius: 1,
                                  flexShrink: 0,
                                  ml: 1,
                                }}
                              >
                                Settled
                              </Typography>
                            ) : survivor.isDisputed ? (
                              <Typography
                                sx={{
                                  fontSize: '0.6875rem',
                                  fontWeight: 700,
                                  letterSpacing: '0.05em',
                                  color: 'error.main',
                                  textTransform: 'uppercase',
                                  flexShrink: 0,
                                  ml: 1,
                                }}
                              >
                                Disputed
                              </Typography>
                            ) : (
                              <Typography
                                sx={{
                                  fontSize: '0.6875rem',
                                  fontWeight: 700,
                                  letterSpacing: '0.03em',
                                  color: 'text.secondary',
                                  flexShrink: 0,
                                  ml: 1,
                                }}
                              >
                                Owes {formatAmount(survivor.shareCents - survivor.settledCents, currency)}
                              </Typography>
                            )}
                          </Box>
                          <Box
                            sx={{
                              width: '100%',
                              bgcolor: 'elevatedHighest',
                              height: 6,
                              borderRadius: 100,
                              overflow: 'hidden',
                            }}
                          >
                            <Box
                              sx={{
                                height: '100%',
                                width: `${progress}%`,
                                bgcolor: survivor.isSettled
                                  ? theme.palette.primary.main
                                  : survivor.isDisputed
                                    ? theme.palette.error.main
                                    : alpha(theme.palette.primary.main, 0.25),
                                borderRadius: 100,
                                transition: 'width 0.3s ease',
                              }}
                            />
                          </Box>
                        </Box>
                      );
                    })}
                  </Box>
                </Box>
              </>
            )}
          </Box>
        </Box>
      </Drawer>
    );
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: '#131313',
          borderRadius: 3,
          maxHeight: '90vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        },
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2,
          py: 1.5,
          borderBottom: '1px solid',
          borderColor: alpha('#534434', 0.1),
          bgcolor: alpha('#131313', 0.85),
          backdropFilter: 'blur(12px)',
          position: 'sticky',
          top: 0,
          zIndex: 10,
          flexShrink: 0,
        }}
      >
        <Typography
          sx={{
            fontSize: '1.25rem',
            fontWeight: 700,
            color: 'primary.main',
            letterSpacing: '-0.02em',
          }}
        >
          Intel Log
        </Typography>
        <IconButton onClick={onClose} size="small" sx={{ color: 'text.secondary' }}>
          <CloseIcon />
        </IconButton>
      </Box>

      {/* Scrollable Content */}
      <Box sx={{ overflow: 'auto', flex: 1 }}>
        {content}
      </Box>
    </Dialog>
  );
}
