import { Avatar, Tooltip, Box } from '@mui/material';
import { UserInfo } from '../../api/users.api';

interface AvatarStackProps {
  users: UserInfo[];
  currentUserId?: string;
  maxVisible?: number;
  size?: number;
}

/**
 * Overlapping avatar stack with overflow counter.
 * Highlights the current user with primary color.
 */
export function AvatarStack({ users, currentUserId, maxVisible = 5, size = 24 }: AvatarStackProps) {
  if (users.length === 0) return null;

  const visible = users.slice(0, maxVisible);
  const overflow = users.length - maxVisible;
  const fontSize = size * 0.35;

  return (
    <Box sx={{ display: 'flex', alignItems: 'center' }}>
      {visible.map((u, i) => {
        const isMe = u.id === currentUserId;
        const initial = (u.firstName || u.email || '?').charAt(0).toUpperCase();
        return (
          <Tooltip key={u.id} title={`${u.firstName} ${u.lastName}`.trim() || u.email}>
            <Avatar
              sx={{
                width: size,
                height: size,
                fontSize,
                fontWeight: 700,
                bgcolor: isMe ? 'primary.main' : 'action.disabledBackground',
                color: isMe ? '#121212' : 'text.secondary',
                ml: i > 0 ? -0.75 : 0,
                border: 1.5,
                borderColor: 'background.paper',
                zIndex: maxVisible - i,
              }}
            >
              {initial}
            </Avatar>
          </Tooltip>
        );
      })}
      {overflow > 0 && (
        <Box
          sx={{
            width: size,
            height: size,
            borderRadius: '50%',
            bgcolor: 'action.disabledBackground',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            ml: -0.75,
            border: 1.5,
            borderColor: 'background.paper',
            zIndex: 0,
          }}
        >
          <span style={{ fontSize, fontWeight: 700, color: 'text.secondary' }}>+{overflow}</span>
        </Box>
      )}
    </Box>
  );
}
