import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardActionArea,
  CircularProgress,
  Alert,
  Avatar,
  alpha,
  useTheme,
} from '@mui/material';
import { Event as EventIcon } from '@mui/icons-material';
import { useAuthStore } from '@moshsplit/auth-react';
import { groupsApi, GroupListItem } from '../../api/groups.api';

export default function MobileEventSelectPage() {
  const navigate = useNavigate();
  const theme = useTheme();
  const userId = useAuthStore((state) => state.userId);

  const { data: eventsResponse, isLoading, error } = useQuery({
    queryKey: ['user-events', userId],
    queryFn: () => groupsApi.list(userId!),
    enabled: !!userId,
  });

  const events = eventsResponse?.data || [];

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">Failed to load events</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      <Typography
        variant="h4"
        fontWeight={800}
        color="primary.main"
        sx={{ mb: 3, letterSpacing: '-0.02em' }}
      >
        Your Events
      </Typography>

      {events.length === 0 ? (
        <Card sx={{ bgcolor: '#1E1E1E', border: '1px solid', borderColor: 'divider' }}>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <Box
              sx={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                bgcolor: alpha(theme.palette.primary.main, 0.1),
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                mb: 2,
              }}
            >
              <EventIcon sx={{ fontSize: 32, color: 'primary.main' }} />
            </Box>
            <Typography variant="h6" fontWeight={600} gutterBottom>
              No events yet
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Create your first event to start splitting expenses.
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {events.map((event: GroupListItem) => (
            <Card
              key={event.id}
              sx={{
                bgcolor: '#1E1E1E',
                border: '1px solid',
                borderColor: 'divider',
              }}
            >
              <CardActionArea onClick={() => navigate(`/app/${event.id}/log`)}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Avatar
                      sx={{
                        bgcolor: 'primary.main',
                        color: '#121212',
                        fontWeight: 700,
                      }}
                    >
                      {event.name.charAt(0).toUpperCase()}
                    </Avatar>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="h6" fontWeight={600}>
                        {event.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {event.description || 'No description'}
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </CardActionArea>
            </Card>
          ))}
        </Box>
      )}
    </Box>
  );
}
