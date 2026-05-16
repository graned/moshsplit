import {
  Typography,
  Box,
  Avatar,
} from '@mui/material';
import {
  PersonAdd as PersonAddIcon,
  EmojiEvents as TrophyIcon,
  Celebration as CelebrationIcon,
} from '@mui/icons-material';
import { MilestoneActivity } from '../../api/activity.api';
import { UserInfo } from '../../api/users.api';
import { FeedCard } from './FeedCard';

function getMilestoneIcon(type: MilestoneActivity['type']) {
  switch (type) {
    case 'member_joined':
      return <PersonAddIcon sx={{ fontSize: 20 }} />;
    case 'event_milestone':
      return <TrophyIcon sx={{ fontSize: 20 }} />;
    default:
      return <CelebrationIcon sx={{ fontSize: 20 }} />;
  }
}

function getMilestoneAccent(type: MilestoneActivity['type']) {
  switch (type) {
    case 'member_joined':
      return '#6366f1';
    case 'event_milestone':
      return '#F59E0B';
    default:
      return '#F59E0B';
  }
}

interface MilestoneCardProps {
  activity: MilestoneActivity;
  targetUser?: UserInfo;
  currentUserId?: string;
  onClick?: () => void;
}

export function MilestoneCard({
  activity,
  targetUser,
  currentUserId,
  onClick,
}: MilestoneCardProps) {
  const accent = getMilestoneAccent(activity.type);
  const isTargetCurrentUser = activity.target_user_id === currentUserId;

  const targetName = targetUser
    ? `${targetUser.firstName} ${targetUser.lastName}`.trim() || targetUser.email
    : null;

  const createdDate = new Date(activity.created_at);
  const isValidDate = !isNaN(createdDate.getTime());

  return (
    <FeedCard onClick={onClick} accentColor={accent}>
      {/* Left icon */}
      <Box
        sx={{
          width: 40,
          height: 40,
          borderRadius: 2,
          backgroundColor: `${accent}18`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          mt: 0.25,
          color: accent,
        }}
      >
        {getMilestoneIcon(activity.type)}
      </Box>

      {/* Content */}
      <Box sx={{ minWidth: 0, flex: 1 }}>
        {/* Title */}
        <Typography
          variant="h6"
          fontWeight={600}
          sx={{ fontSize: '0.95rem', mb: 0.25 }}
        >
          {activity.title}
        </Typography>

        {/* Description with optional target user */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
          <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.825rem' }}>
            {activity.description}
          </Typography>
          {targetName && (
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
                {targetName.charAt(0).toUpperCase()}
              </Avatar>
              <Typography
                variant="caption"
                color={isTargetCurrentUser ? 'primary.main' : 'text.secondary'}
                fontWeight={isTargetCurrentUser ? 600 : 400}
              >
                {isTargetCurrentUser ? 'you' : targetName}
              </Typography>
            </Box>
          )}
        </Box>
      </Box>

      {/* Right side: Date */}
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
