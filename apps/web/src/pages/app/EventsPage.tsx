import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  Stack,
  IconButton,
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import {
  Add as AddIcon,
  GroupAdd as JoinIcon,
  Group as GroupsIcon,
  MoreVert as MoreIcon,
} from '@mui/icons-material';

import { useAuthStore } from '@moshsplit/auth-react';
import { groupsApi, GroupListItem, CreateGroupRequest } from '../../api/groups.api';
import { CreateGroupDialog } from '../../features/groups/components/CreateGroupDialog';
import { JoinGroupDialog } from '../../features/groups/components/JoinGroupDialog';

function GroupCard({ group, onClick, onDelete }: { 
  group: GroupListItem; 
  onClick: () => void;
  onDelete?: () => void;
}) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <Card
      sx={{
        cursor: 'pointer',
        transition: 'transform 0.2s, box-shadow 0.2s',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: 4,
        },
      }}
      onClick={onClick}
    >
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" fontWeight={600} gutterBottom>
              {group.name}
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
              <Typography variant="body2" color="text.secondary">
                {group.member_count} member{group.member_count !== 1 ? 's' : ''}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {group.currency}
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'capitalize' }}>
              {group.status}
            </Typography>
            {onDelete && (
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
              >
                <MoreIcon fontSize="small" />
              </IconButton>
            )}
          </Box>
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
          Created {formatDate(group.created_at)}
        </Typography>
      </CardContent>
    </Card>
  );
}

export default function EventsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Get current user ID from auth
  const userId = useAuthStore((state) => state.userId);

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [joinDialogOpen, setJoinDialogOpen] = useState(false);

  // Fetch groups
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['groups', userId],
    queryFn: async () => {
      if (!userId) throw new Error('User not authenticated');
      console.log('[EventsPage] Fetching groups for userId:', userId);
      const result = await groupsApi.list(userId);
      console.log('[EventsPage] Groups fetch result:', JSON.stringify(result));
      return result;
    },
    enabled: !!userId,
    staleTime: 0, // Ensure fresh data
  });

  // Create group mutation
  const createMutation = useMutation({
    mutationFn: (data: CreateGroupRequest) => groupsApi.create(data),
    onSuccess: () => {
      console.log('[EventsPage] createMutation onSuccess - invalidating groups query');
      queryClient.invalidateQueries({ queryKey: ['groups'] });
    },
    onError: (error) => {
      console.error('[EventsPage] createMutation onError:', error);
    },
  });

  // Delete group mutation
  const deleteMutation = useMutation({
    mutationFn: (groupId: string) => groupsApi.delete(groupId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
    },
  });

  const handleCreateGroup = async (data: { name: string; description?: string; currency: string; memberIds?: string[] }) => {
    console.log('[EventsPage] handleCreateGroup called with:', JSON.stringify(data));
    if (!userId) {
      throw new Error('User not authenticated');
    }
    const mutationData = { ...data, user_id: userId };
    console.log('[EventsPage] Sending to API:', JSON.stringify(mutationData));
    await createMutation.mutateAsync(mutationData);
    console.log('[EventsPage] createMutation completed successfully');
  };

  const handleJoinGroup = async (_inviteCode: string) => {
    throw new Error('Invite functionality not yet implemented');
  };

  const handleGroupClick = (group: GroupListItem) => {
    // Navigate to group detail - show expenses for this group
    navigate(`/app/expenses?groupId=${group.id}`);
  };

  const handleDeleteGroup = async (groupId: string) => {
    if (window.confirm('Are you sure you want to archive this group?')) {
      await deleteMutation.mutateAsync(groupId);
    }
  };

  const groups = data?.data || [];

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight={700}>
            Groups
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage your shared expense groups
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<JoinIcon />}
            onClick={() => setJoinDialogOpen(true)}
          >
            Join
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setCreateDialogOpen(true)}
          >
            New Group
          </Button>
        </Box>
      </Box>

      {/* Error state */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} action={
          <Button color="inherit" size="small" onClick={() => refetch()}>
            Retry
          </Button>
        }>
          Failed to load groups
        </Alert>
      )}

      {/* Loading state */}
      {isLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      )}

      {/* Empty state */}
      {!isLoading && !error && groups.length === 0 && (
        <Card>
          <CardContent sx={{ py: 8, textAlign: 'center' }}>
            <Box
              sx={{
                width: 80,
                height: 80,
                borderRadius: '50%',
                backgroundColor: 'primary.main',
                opacity: 0.1,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                mb: 3,
              }}
            >
              <GroupsIcon sx={{ fontSize: 40, color: 'primary.main' }} />
            </Box>
            <Typography variant="h6" fontWeight={600} gutterBottom>
              No groups yet
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Create a new group to start tracking shared expenses with friends.
            </Typography>
            <Stack direction="row" spacing={2} justifyContent="center">
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setCreateDialogOpen(true)}
              >
                Create Group
              </Button>
              <Button
                variant="outlined"
                startIcon={<JoinIcon />}
                onClick={() => setJoinDialogOpen(true)}
              >
                Join Group
              </Button>
            </Stack>
          </CardContent>
        </Card>
      )}

      {/* Groups list */}
      {!isLoading && !error && groups.length > 0 && (
        <Grid container spacing={2}>
          {groups.map((group) => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={group.id}>
              <GroupCard
                group={group}
                onClick={() => handleGroupClick(group)}
                onDelete={() => handleDeleteGroup(group.id)}
              />
            </Grid>
          ))}
        </Grid>
      )}

      {/* Dialogs */}
      <CreateGroupDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        onSubmit={handleCreateGroup}
      />

      <JoinGroupDialog
        open={joinDialogOpen}
        onClose={() => setJoinDialogOpen(false)}
        onSubmit={handleJoinGroup}
      />
    </Box>
  );
}