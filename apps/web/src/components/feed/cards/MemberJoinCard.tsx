import { Typography, Box, alpha, useTheme, useMediaQuery } from '@mui/material';
import { PersonAdd as PersonAddIcon } from '@mui/icons-material';
import { MemberJoinActivity } from '../../../api/activity.api';
import { UserInfo } from '../../../api/users.api';
import { FeedCard } from './FeedCard';

interface MemberJoinCardProps {
  activity: MemberJoinActivity;
  joinedUser?: UserInfo;
  currentUserId?: string;
  onClick?: () => void;
}

export function MemberJoinCard({ activity, joinedUser, currentUserId, onClick }: MemberJoinCardProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const accent = '#6366f1';
  const isTargetCurrentUser = activity.user_id === currentUserId;

  const displayName = activity.user_name || (joinedUser ? `${joinedUser.firstName} ${joinedUser.lastName}`.trim() || joinedUser.email : null);

  const createdDate = new Date(activity.created_at);
  const isValidDate = !isNaN(createdDate.getTime());

  return (
    <FeedCard onClick={onClick} accentColor={accent}>
      <Box
        sx={{
          width: isMobile ? 36 : 40,
          height: isMobile ? 36 : 40,
          borderRadius: isMobile ? 1.5 : 2,
          backgroundColor: alpha(accent, 0.1),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          mt: 0.25,
          color: accent,
        }}
      >
        <PersonAddIcon sx={{ fontSize: isMobile ? 18 : 20 }} />
      </Box>

      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography variant="h6" fontWeight={600} sx={{ fontSize: isMobile ? '0.85rem' : '0.95rem', mb: 0.25 }}>
          {isTargetCurrentUser ? 'You joined the pit' : `${displayName || 'Someone'} joined the pit`}
        </Typography>

        <Typography
          sx={{
            fontSize: isMobile ? '0.6rem' : '0.7rem',
            color: alpha('#fff', 0.4),
            fontStyle: 'italic',
          }}
        >
          {isTargetCurrentUser ? '🤘 Time to headbang!' : '🤘 The pit grows stronger!'}
        </Typography>
      </Box>

      <Box sx={{ textAlign: 'right', ml: isMobile ? 0.75 : 1, flexShrink: 0 }}>
        {isValidDate && (
          <Typography variant="caption" color="text.disabled" sx={{ display: 'block', fontSize: isMobile ? '0.6rem' : '0.65rem' }}>
            {createdDate.toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            })}
          </Typography>
        )}
      </Box>
    </FeedCard>
  );
}
