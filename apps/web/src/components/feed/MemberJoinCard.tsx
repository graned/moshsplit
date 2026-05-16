import { Typography, Box, Avatar, alpha } from '@mui/material';
import { PersonAdd as PersonAddIcon } from '@mui/icons-material';
import { MemberJoinActivity } from '../../api/activity.api';
import { UserInfo } from '../../api/users.api';
import { FeedCard } from './FeedCard';

interface MemberJoinCardProps {
  activity: MemberJoinActivity;
  joinedUser?: UserInfo;
  currentUserId?: string;
  onClick?: () => void;
}

export function MemberJoinCard({ activity, joinedUser, currentUserId, onClick }: MemberJoinCardProps) {
  const accent = '#6366f1';
  const isTargetCurrentUser = activity.user_id === currentUserId;

  const userName = joinedUser
    ? `${joinedUser.firstName} ${joinedUser.lastName}`.trim() || joinedUser.email
    : null;

  const createdDate = new Date(activity.created_at);
  const isValidDate = !isNaN(createdDate.getTime());

  return (
    <FeedCard onClick={onClick} accentColor={accent}>
      <Box
        sx={{
          width: 40,
          height: 40,
          borderRadius: 2,
          backgroundColor: alpha(accent, 0.1),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          mt: 0.25,
          color: accent,
        }}
      >
        <PersonAddIcon sx={{ fontSize: 20 }} />
      </Box>

      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography variant="h6" fontWeight={600} sx={{ fontSize: '0.95rem', mb: 0.25 }}>
          {isTargetCurrentUser ? 'You joined the pit' : `${userName || 'Someone'} joined the pit`}
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
          {userName && (
            <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
              <Avatar
                sx={{
                  width: 18,
                  height: 18,
                  fontSize: '0.55rem',
                  fontWeight: 700,
                  bgcolor: isTargetCurrentUser ? 'primary.main' : 'action.disabledBackground',
                  color: isTargetCurrentUser ? '#121212' : 'text.secondary',
                }}
              >
                {userName.charAt(0).toUpperCase()}
              </Avatar>
              <Typography
                variant="caption"
                color={isTargetCurrentUser ? 'primary.main' : 'text.secondary'}
                fontWeight={isTargetCurrentUser ? 600 : 400}
              >
                {isTargetCurrentUser ? 'you' : userName}
              </Typography>
            </Box>
          )}
        </Box>
      </Box>

      <Box sx={{ textAlign: 'right', ml: 1, flexShrink: 0 }}>
        {isValidDate && (
          <Typography variant="caption" color="text.disabled" sx={{ display: 'block' }}>
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
