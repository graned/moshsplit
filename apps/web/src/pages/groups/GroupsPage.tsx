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
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import {
  Add as AddIcon,
  GroupAdd as JoinIcon,
  Group as GroupsIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';

import { useAuthStore } from '@moshsplit/auth-react';
import { groupsApi, GroupListItem, CreateGroupRequest } from '../../api/groups.api';
import { GroupCard } from '../../components/groups/GroupCard';
import { CreateGroupDialog } from '../../components/groups/CreateGroupDialog';
import { JoinGroupDialog } from '../../components/groups/JoinGroupDialog';

export function GroupsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Get current user ID from auth
  const userId = useAuthStore((state) => state.userId);

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [joinDialogOpen, setJoinDialogOpen] = useState(false);

  // Fetch groups
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['groups', userId],
    queryFn: () => {
      if (!userId) throw new Error('User not authenticated');
      return groupsApi.list(userId);
    },
    enabled: !!userId,
  });

  // Create group mutation
  const createMutation = useMutation({
    mutationFn: async (data: CreateGroupRequest & { memberIds: string[] }) => {
      const { memberIds, ...groupData } = data;
      const group = await groupsApi.create(groupData);
      // Add selected members to the group
      for (const memberId of memberIds) {
        await groupsApi.addMember(group.id, { user_id: memberId });
      }
      return group;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
    },
  });

  // Delete group mutation
  const deleteMutation = useMutation({
    mutationFn: groupsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
    },
  });

  const handleCreateGroup = async (data: {
    name: string;
    description?: string;
    currency: string;
    memberIds: string[];
  }) => {
    if (!userId) {
      throw new Error('User not authenticated');
    }
    await createMutation.mutateAsync({ ...data, user_id: userId });
  };

  const handleJoinGroup = async (_inviteCode: string) => {
    // TODO: Implement when backend supports invite codes
    // For now, this would need to call an API to accept an invite
    throw new Error('Invite functionality not yet implemented');
  };

  const handleGroupClick = (group: GroupListItem) => {
    navigate(`/app/groups/${group.id}`);
  };

  const handleDeleteGroup = async (groupId: string) => {
    if (window.confirm('Are you sure you want to archive this group?')) {
      await deleteMutation.mutateAsync(groupId);
    }
  };

  const groups = data?.data || [];
  const hasMore = data?.hasMore || false;

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
        <Box>
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

          {/* Load more indicator */}
          {hasMore && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={() => refetch()}
              >
                Load More
              </Button>
            </Box>
          )}
        </Box>
      )}

      {/* Create Group Dialog */}
      <CreateGroupDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        onSubmit={handleCreateGroup}
      />

      {/* Join Group Dialog */}
      <JoinGroupDialog
        open={joinDialogOpen}
        onClose={() => setJoinDialogOpen(false)}
        onSubmit={handleJoinGroup}
      />
    </Box>
  );
}