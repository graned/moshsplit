import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  Box,
  Typography,
  Avatar,
  IconButton,
  Button,
  alpha,
  useTheme,
  useMediaQuery,
  CircularProgress,
} from '@mui/material';
import {
  Close as CloseIcon,
  SportsBar as SportsBarIcon,
  LocalGasStation as GasIcon,
  Restaurant as FoodIcon,
  DirectionsBus as TransportIcon,
  ShoppingBag as MerchIcon,
  Receipt as DefaultIcon,
  EventAvailable as DateIcon,
  Check as CheckIcon,
  Add as AddIcon,
  Payments as PaymentsIcon,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { ExpenseListItem, expensesApi, ExpenseVersionDetail } from '../../api/expenses.api';
import { activityApi } from '../../api/activity.api';
import { UserInfo } from '../../api/users.api';
import { useUsers } from '../../hooks/useUserCache';
import { GroupMember } from '../../api/groups.api';

const EXPENSE_TYPE_CONFIG: Record<string, { icon: React.ReactElement; label: string }> = {
  beer: { icon: <SportsBarIcon />, label: 'Beer Supply Run' },
  gas: { icon: <GasIcon />, label: 'Fuel Run' },
  food: { icon: <FoodIcon />, label: 'Food Run' },
  transport: { icon: <TransportIcon />, label: 'Transport' },
  merch: { icon: <MerchIcon />, label: 'Merch Haul' },
  camping: { icon: <DefaultIcon />, label: 'Camping Gear' },
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

  useEffect(() => {
    if (expense && open) {
      setLoading(true);
      setVersions([]);
      expensesApi
        .listVersions(eventId, expense.id)
        .then((data) => {
          console.log('[IntelLog] Versions loaded:', data);
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

  console.log('[IntelLog] allUserIds:', allUserIds, 'syntheticVersion:', syntheticVersion, 'members:', members);

  const userMap = useUsers(allUserIds);

  const { data: activityResult } = useQuery({
    queryKey: ['expense-activity', eventId],
    queryFn: () => activityApi.list(eventId, currentUserId, undefined, 50),
    enabled: !!eventId,
    staleTime: 1000 * 60 * 5,
  });

  const activityItems = activityResult?.data ?? [];

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

  useEffect(() => {
    if (open) {
      console.log('[IntelLog Debug]', {
        currentUserId,
        hasLatestVersion: !!syntheticVersion,
        syntheticVersionSharesCount: syntheticVersion?.shares?.length ?? 0,
        survivorsCount: survivors.length,
        myShareCents,
        perPersonCents,
        versionsCount: versions.length,
      });
    }
  }, [open, currentUserId, survivors, myShareCents, syntheticVersion, perPersonCents, versions]);

  const typeConfig = expense?.expense_type ? EXPENSE_TYPE_CONFIG[expense.expense_type] : null;
  const typeIcon = typeConfig?.icon ?? <DefaultIcon />;

  const timelineItems = useMemo(() => {
    const items: { icon: React.ReactElement; iconColor: string; text: string; subtext?: string; time: string }[] = [];

    if (expense) {
      items.push({
        icon: <AddIcon sx={{ fontSize: 14 }} />,
        iconColor: theme.palette.primary.main,
        text: `${payerName} added ${expense.title}`,
        time: formatRelativeTime(expense.created_at),
      });
    }

    activityItems.forEach((a) => {
      if (a.type === 'settlement') {
        const fromName = getMemberName(a.from_user);
        items.push({
          icon: <PaymentsIcon sx={{ fontSize: 14 }} />,
          iconColor: theme.palette.success.main,
          text: `${fromName} settled ${formatAmount(a.amount_cents, currency)}`,
          time: formatRelativeTime(a.created_at),
        });
      }
    });

    return items;
  }, [expense, activityItems, payerName, currency, theme]);

  if (!expense) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen={isMobile}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: '#131313',
          borderRadius: isMobile ? 0 : 3,
          m: isMobile ? 0 : undefined,
          maxHeight: isMobile ? '100%' : '90vh',
          height: isMobile ? '100%' : 'auto',
          overflow: 'hidden',
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
      <Box sx={{ overflow: 'auto', maxHeight: isMobile ? 'calc(100% - 56px)' : '80vh' }}>
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
                <DateIcon sx={{ fontSize: 16, color: 'primary.main' }} />
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
            <Box sx={{ px: { xs: 2, md: 4 }, mt: -2, mb: 3, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
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
                  <Box sx={{ position: 'relative' }}>
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
                    <Box
                      sx={{
                        position: 'absolute',
                        bottom: -4,
                        right: -4,
                        bgcolor: 'primary.main',
                        borderRadius: '50%',
                        p: 0.25,
                      }}
                    >
                      <CheckIcon sx={{ fontSize: 12, color: '#121212' }} />
                    </Box>
                  </Box>
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

            {/* Survivors */}
            <Box sx={{ px: { xs: 2, md: 4 }, mb: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', mb: 2 }}>
                <Typography
                  sx={{
                    fontSize: '0.625rem',
                    fontWeight: 700,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    color: 'text.secondary',
                  }}
                >
                  {survivors.length} Survivors
                </Typography>
                <Typography sx={{ fontSize: '0.875rem', color: 'primary.main', fontWeight: 600 }}>
                  {formatAmount(perPersonCents, currency)} each
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {survivors.slice(0, 5).map((survivor) => {
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
                            Owes {formatAmount(survivor.shareCents - survivor.settledCents, currency)}
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

                {survivors.length > 5 && (
                  <Button
                    fullWidth
                    sx={{
                      py: 1,
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      letterSpacing: '0.05em',
                      textTransform: 'uppercase',
                      color: 'text.secondary',
                      border: '1px dashed',
                      borderColor: alpha('#534434', 0.3),
                      borderRadius: 1.5,
                      '&:hover': {
                        bgcolor: 'background.paper',
                        borderColor: 'primary.main',
                        color: 'primary.main',
                      },
                    }}
                  >
                    + View {survivors.length - 5} Others
                  </Button>
                )}
              </Box>
            </Box>

            {/* Battle Log */}
            <Box sx={{ px: { xs: 2, md: 4 }, mb: 4 }}>
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
                Battle Log
              </Typography>

              <Box sx={{ position: 'relative' }}>
                <Box
                  sx={{
                    position: 'absolute',
                    left: '11px',
                    top: 8,
                    bottom: 8,
                    width: '1px',
                    bgcolor: alpha('#534434', 0.2),
                  }}
                />

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, pl: 4 }}>
                  {timelineItems.length > 0 ? timelineItems.map((item, i) => (
                    <Box key={i} sx={{ position: 'relative', display: 'flex', gap: 2, alignItems: 'start' }}>
                      <Box
                        sx={{
                          position: 'absolute',
                          left: '-4px',
                          top: 2,
                          width: 24,
                          height: 24,
                          borderRadius: '50%',
                          bgcolor: item.iconColor === theme.palette.primary.main ? 'primary.main' : item.iconColor === theme.palette.success.main ? 'success.main' : 'elevated.main',
                          border: '4px solid',
                          borderColor: '#131313',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          zIndex: 1,
                          color: item.iconColor === theme.palette.primary.main || item.iconColor === theme.palette.success.main ? '#121212' : item.iconColor,
                        }}
                      >
                        {item.icon}
                      </Box>

                      <Box sx={{ pl: 1 }}>
                        <Typography sx={{ fontSize: '0.875rem', color: 'text.primary', lineHeight: 1.4 }}>
                          {item.text}
                        </Typography>
                        <Typography
                          sx={{
                            fontSize: '0.75rem',
                            color: 'text.secondary',
                            mt: 0.25,
                          }}
                        >
                          {item.time}
                        </Typography>
                      </Box>
                    </Box>
                  )) : (
                    <Typography sx={{ fontSize: '0.875rem', color: 'text.secondary', pl: 1 }}>
                      No activity recorded yet.
                    </Typography>
                  )}
                </Box>
              </Box>
            </Box>
          </>
        )}
      </Box>
    </Dialog>
  );
}
