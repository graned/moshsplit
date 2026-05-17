import { useMemo } from 'react';
import { Box, Typography, Avatar, Skeleton, alpha, useTheme, Button } from '@mui/material';
import {
  Assessment as MonitoringIcon,
  Payments as PaymentsIcon,
  Warning as WarningIcon,
  GroupAdd as GroupAddIcon,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { EventStats } from '../../api/balances.api';
import { activityApi } from '../../api/activity.api';
import { GroupMember } from '../../api/groups.api';
import { useUsers } from '../../hooks/useUserCache';

const formatAmount = (cents: number, currency = 'EUR') => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(cents / 100);
};

interface LiveIntelSidebarProps {
  eventId: string;
  userId: string;
  stats: EventStats | undefined;
  statsLoading: boolean;
  members: GroupMember[];
  currency: string;
  onViewAuditLog?: () => void;
}

interface ActivityEntry {
  icon: React.ReactNode;
  iconColor: string;
  text: string;
  time: string;
}

function useActivityEntries(eventId: string, members: GroupMember[], userId: string, topSpenderId?: string | null) {
  const { data: activityResult } = useQuery({
    queryKey: ['sidebar-activity', eventId],
    queryFn: () => activityApi.list(eventId, userId, undefined, 5),
    enabled: !!eventId,
    staleTime: 1000 * 60 * 5,
  });

  const activities = activityResult?.data ?? [];

  const allUserIds = useMemo(() => {
    const ids = members.map((m) => m.user_id);
    if (topSpenderId && !ids.includes(topSpenderId)) ids.push(topSpenderId);
    return ids;
  }, [members, topSpenderId]);

  const userMap = useUsers(allUserIds);

  const entries: ActivityEntry[] = activities.slice(0, 5).map((item) => {
    const time = new Date(item.created_at).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });

    if (item.type === 'expense') {
      const payer = userMap[item.paid_by];
      const payerName = payer ? `${payer.firstName} ${payer.lastName}`.trim() || payer.email : item.paid_by.slice(0, 8);
      return {
        icon: <PaymentsIcon sx={{ fontSize: 12 }} />,
        iconColor: 'primary.main',
        text: `${payerName} added ${item.title}`,
        time,
      };
    }

    if (item.type === 'settlement') {
      const from = userMap[item.from_user];
      const to = userMap[item.to_user];
      const fromName = from ? `${from.firstName} ${from.lastName}`.trim() || from.email : item.from_user.slice(0, 8);
      const toName = to ? `${to.firstName} ${to.lastName}`.trim() || to.email : item.to_user.slice(0, 8);
      return {
        icon: <PaymentsIcon sx={{ fontSize: 12 }} />,
        iconColor: 'success.main',
        text: `${fromName} paid ${toName}`,
        time,
      };
    }

    if (item.type === 'member_join') {
      const joined = userMap[item.user_id];
      const joinedName = joined ? `${joined.firstName} ${joined.lastName}`.trim() || joined.email : item.user_id.slice(0, 8);
      return {
        icon: <GroupAddIcon sx={{ fontSize: 12 }} />,
        iconColor: 'text.secondary',
        text: `${joinedName} joined the pit`,
        time,
      };
    }

    return {
      icon: <WarningIcon sx={{ fontSize: 12 }} />,
      iconColor: 'error.main',
      text: 'Unknown activity',
      time,
    };
  });

  return { entries, userMap };
}

export function LiveIntelSidebar({
  eventId,
  userId,
  stats,
  statsLoading,
  members,
  currency,
  onViewAuditLog,
}: LiveIntelSidebarProps) {
  const theme = useTheme();
  const { entries, userMap } = useActivityEntries(eventId, members, userId, stats?.top_spender_id);

  if (statsLoading) {
    return <Skeleton variant="rectangular" height={300} sx={{ borderRadius: 3, bgcolor: 'background.paper' }} />;
  }

  const totalDamage = stats?.total_spent_cents ?? 0;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Stats Module */}
      <Box
        sx={{
          bgcolor: 'background.paper',
          borderRadius: 3,
          border: '1px solid',
          borderColor: alpha('#534434', 0.1),
          p: 3,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <Typography
          sx={{
            fontSize: '0.625rem',
            fontWeight: 700,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            color: 'primary.main',
            mb: 3,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
          }}
        >
          <MonitoringIcon sx={{ fontSize: 16 }} />
          Live Intel
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {/* Total Damage */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', pb: 2, borderBottom: '1px solid', borderColor: alpha('#534434', 0.1) }}>
            <Box>
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
                Total Damage
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
                {formatAmount(totalDamage, currency)}
              </Typography>
            </Box>
          </Box>

          {/* Top Spender */}
          {stats?.top_spender_id && (() => {
            const spender = userMap[stats.top_spender_id];
            const spenderName = spender
              ? `${spender.firstName} ${spender.lastName}`.trim() || spender.email
              : stats.top_spender_id.slice(0, 8);
            const spenderInitial = spenderName.charAt(0).toUpperCase();

            return (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', bgcolor: alpha('#131313', 0.5), p: 1.5, borderRadius: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Avatar
                    sx={{
                      width: 40,
                      height: 40,
                      borderRadius: 2,
                      bgcolor: 'action.disabledBackground',
                      border: '1px solid',
                      borderColor: alpha(theme.palette.primary.main, 0.3),
                    }}
                  >
                    {spenderInitial}
                  </Avatar>
                  <Box>
                    <Typography
                      sx={{
                        fontSize: '0.625rem',
                        fontWeight: 700,
                        letterSpacing: '0.05em',
                        textTransform: 'uppercase',
                        color: 'text.secondary',
                      }}
                    >
                      Top Spender
                    </Typography>
                    <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: 'text.primary' }}>
                      {spenderName}
                    </Typography>
                  </Box>
                </Box>
                <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: 'primary.main' }}>
                  {stats.top_spender_amount_cents ? formatAmount(stats.top_spender_amount_cents, currency) : '—'}
                </Typography>
              </Box>
            );
          })()}
        </Box>
      </Box>

      {/* Recent Activity */}
      <Box
        sx={{
          bgcolor: 'background.paper',
          borderRadius: 3,
          border: '1px solid',
          borderColor: alpha('#534434', 0.1),
          p: 3,
        }}
      >
        <Typography
          sx={{
            fontSize: '0.625rem',
            fontWeight: 700,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            color: 'text.secondary',
            mb: 3,
          }}
        >
          Recent Activity
        </Typography>

        <Box sx={{ position: 'relative' }}>
          {/* Timeline line */}
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

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, pl: 3 }}>
            {entries.map((entry, i) => (
              <Box key={i} sx={{ position: 'relative', display: 'flex', gap: 2, alignItems: 'start' }}>
                {/* Timeline dot */}
                <Box
                  sx={{
                    position: 'absolute',
                    left: '-3px',
                    top: 2,
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    bgcolor: 'elevated.main',
                    border: '1px solid',
                    borderColor: alpha('#534434', 0.2),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1,
                    color: entry.iconColor,
                  }}
                >
                  {entry.icon}
                </Box>

                <Box sx={{ pl: 3.5 }}>
                  <Typography sx={{ fontSize: '0.875rem', color: 'text.primary', lineHeight: 1.4 }}>
                    {entry.text}
                  </Typography>
                  <Typography
                    sx={{
                      fontSize: '0.625rem',
                      fontWeight: 700,
                      letterSpacing: '0.05em',
                      color: 'text.secondary',
                      mt: 0.25,
                    }}
                  >
                    {entry.time}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Box>
        </Box>

        {onViewAuditLog && (
          <Button
            fullWidth
            variant="outlined"
            onClick={onViewAuditLog}
            sx={{
              mt: 3,
              py: 1,
              fontWeight: 700,
              fontSize: '0.625rem',
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              borderColor: alpha('#534434', 0.3),
              color: 'text.secondary',
              '&:hover': {
                borderColor: 'primary.main',
                color: 'primary.main',
                bgcolor: alpha(theme.palette.primary.main, 0.05),
              },
            }}
          >
            View Full Audit Log
          </Button>
        )}
      </Box>
    </Box>
  );
}
