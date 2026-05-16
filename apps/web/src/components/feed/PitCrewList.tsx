import { Box, Typography, Avatar, Button, Skeleton, alpha, useTheme } from '@mui/material';
import { ChatBubble as ChatIcon } from '@mui/icons-material';
import { GroupMember } from '../../api/groups.api';

interface PitCrewMember {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: string;
  initials: string;
}

interface PitCrewListProps {
  members: GroupMember[];
  currentUserId: string;
  isLoading: boolean;
  onManageClick?: () => void;
  onMessageClick?: (memberId: string) => void;
}

function getInitials(member: GroupMember): string {
  const name = member.user_name || member.user_email || '?';
  const parts = name.trim().split(' ');
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return name.charAt(0).toUpperCase();
}

function mapMembers(members: GroupMember[]): PitCrewMember[] {
  return members.map((m) => ({
    id: m.id,
    userId: m.user_id,
    name: m.user_name || m.user_email || 'Unknown',
    email: m.user_email || '',
    role: m.role,
    initials: getInitials(m),
  }));
}

export function PitCrewList({ members, isLoading, onManageClick, onMessageClick }: PitCrewListProps) {
  const theme = useTheme();

  if (isLoading) {
    return <Skeleton variant="rectangular" height={280} sx={{ borderRadius: 3, bgcolor: 'background.paper' }} />;
  }

  const mappedMembers = mapMembers(members);

  return (
    <Box
      sx={{
        bgcolor: 'background.paper',
        borderRadius: 3,
        border: '1px solid',
        borderColor: alpha('#534434', 0.1),
        p: 3,
      }}
    >
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography
          sx={{
            fontSize: '0.625rem',
            fontWeight: 700,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            color: 'text.secondary',
          }}
        >
          Pit Crew
        </Typography>
        <Typography
          sx={{
            fontSize: '0.625rem',
            fontWeight: 700,
            color: 'primary.main',
          }}
        >
          {mappedMembers.length} Total
        </Typography>
      </Box>

      {/* Member list */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {mappedMembers.map((member) => (
          <Box
            key={member.id}
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              p: 1.5,
              borderRadius: 2,
              transition: 'background-color 0.15s ease',
              '&:hover': {
                bgcolor: 'elevated.main',
              },
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Avatar
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: 2,
                  bgcolor: 'action.disabledBackground',
                  color: 'text.primary',
                  fontSize: '0.875rem',
                  fontWeight: 700,
                  border: '1px solid',
                  borderColor: alpha('#534434', 0.3),
                }}
              >
                {member.initials}
              </Avatar>
              <Box>
                <Typography
                  sx={{
                    fontSize: '1rem',
                    fontWeight: 400,
                    color: 'text.primary',
                    lineHeight: 1.2,
                  }}
                >
                  {member.name}
                </Typography>
                <Typography
                  sx={{
                    fontSize: '0.625rem',
                    fontWeight: 700,
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                    color: 'text.secondary',
                  }}
                >
                  {member.role}
                </Typography>
              </Box>
            </Box>

            <ChatIcon
              sx={{
                fontSize: 20,
                color: 'text.secondary',
                cursor: 'pointer',
                transition: 'color 0.15s ease',
                '&:hover': {
                  color: 'primary.main',
                },
              }}
              onClick={() => onMessageClick?.(member.id)}
            />
          </Box>
        ))}
      </Box>

      {/* Manage button */}
      {onManageClick && (
        <Button
          fullWidth
          variant="outlined"
          onClick={onManageClick}
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
          Manage Participants
        </Button>
      )}
    </Box>
  );
}
