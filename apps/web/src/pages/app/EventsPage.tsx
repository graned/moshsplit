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
import { groupsApi, GroupListItem, CreateGroupRequest, UpdateGroupRequest, Group, GroupMember } from '../../api/groups.api';
import { CreateGroupDialog } from '../../features/groups/components/CreateGroupDialog';
import { JoinGroupDialog } from '../../features/groups/components/JoinGroupDialog';
import { EditEventDialog } from '../../features/groups/components/EditEventDialog';

function GroupCard({ group, onClick, onDelete, onEdit }: {
  group: GroupListItem;
  onClick: () => void;
  onDelete?: () => void;
  onEdit?: () => void;
}) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const isArchived = group.status === 'archived' || group.status === 'deleted';

  const handleClick = () => {
    if (isArchived && onEdit) {
      onEdit();
    } else {
      onClick();
    }
  };

  return (
    <Card
      sx={{
        cursor: 'pointer',
        transition: 'transform 0.2s, box-shadow 0.2s',
        border: isArchived ? '1px solid' : undefined,
        borderColor: isArchived ? 'warning.main' : 'transparent',
        opacity: isArchived ? 0.8 : 1,
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: 4,
        },
      }}
      onClick={handleClick}
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
            <Typography
              variant="caption"
              sx={{
                textTransform: 'capitalize',
                color: isArchived ? 'warning.main' : 'text.secondary',
                fontWeight: isArchived ? 600 : undefined,
              }}
            >
              {group.status}
              {isArchived && ' - Click to restore'}
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
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Group | null>(null);
  const [selectedEventMembers, setSelectedEventMembers] = useState<GroupMember[]>([]);

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

  // Update group mutation (for restoring archived events)
  const updateMutation = useMutation({
    mutationFn: ({ groupId, data }: { groupId: string; data: UpdateGroupRequest }) =>
      groupsApi.update(groupId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
    },
  });

  // Add member mutation
  const addMemberMutation = useMutation({
    mutationFn: ({ groupId, userId }: { groupId: string; userId: string }) =>
      groupsApi.addMember(groupId, { user_id: userId }),
    onSuccess: () => {
      if (selectedEvent) {
        groupsApi.listMembers(selectedEvent.id).then(setSelectedEventMembers).catch(console.error);
      }
    },
  });

  // Remove member mutation
  const removeMemberMutation = useMutation({
    mutationFn: ({ groupId, userId }: { groupId: string; userId: string }) =>
      groupsApi.removeMember(groupId, userId),
    onSuccess: () => {
      if (selectedEvent) {
        groupsApi.listMembers(selectedEvent.id).then(setSelectedEventMembers).catch(console.error);
      }
    },
  });

  const handleCreateGroup = async (data: { name: string; description?: string; currency: string; memberIds?: string[] }) => {
    console.log('[EventsPage] handleCreateGroup called with:', JSON.stringify(data));
    if (!userId) {
      throw new Error('User not authenticated');
    }

    // Create the group first
    const mutationData = { ...data, user_id: userId };
    console.log('[EventsPage] Creating group with:', JSON.stringify(mutationData));
    const group = await createMutation.mutateAsync(mutationData);
    console.log('[EventsPage] Group created:', group);

    // Add selected members (if any) - but always ensure creator is a member
    const memberIds = new Set(data.memberIds || []);
    memberIds.add(userId); // Add creator as member

    console.log('[EventsPage] Adding members:', Array.from(memberIds));
    for (const memberId of memberIds) {
      if (memberId !== userId) {
        // Skip adding yourself - you're already added as creator
        try {
          await groupsApi.addMember(group.id, { user_id: memberId });
          console.log('[EventsPage] Added member:', memberId);
        } catch (err) {
          console.error('[EventsPage] Failed to add member:', memberId, err);
        }
      }
    }
    console.log('[EventsPage] createMutation completed successfully');
  };

  const handleJoinGroup = async (_inviteCode: string) => {
    throw new Error('Invite functionality not yet implemented');
  };

  const handleEditGroup = async (group: GroupListItem) => {
    // Fetch full event details and members
    const eventDetails = await groupsApi.get(group.id);
    const members = await groupsApi.listMembers(group.id);
    setSelectedEvent(eventDetails);
    setSelectedEventMembers(members);
    setEditDialogOpen(true);
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
                onEdit={() => handleEditGroup(group)}
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

      <EditEventDialog
        open={editDialogOpen}
        onClose={() => {
          setEditDialogOpen(false);
          setSelectedEvent(null);
          setSelectedEventMembers([]);
        }}
        event={selectedEvent}
        members={selectedEventMembers}
        currentUserId={userId || ''}
        onUpdate={async (eventId, data) => {
          // If status is being set to active, it's a restore
          if (data.status === 'active') {
            await updateMutation.mutateAsync({ groupId: eventId, data });
          } else {
            await updateMutation.mutateAsync({ groupId: eventId, data });
          }
        }}
        onAddMember={async (eventId, userId) => {
          await addMemberMutation.mutateAsync({ groupId: eventId, userId });
        }}
        onRemoveMember={async (eventId, userId) => {
          await removeMemberMutation.mutateAsync({ groupId: eventId, userId });
        }}
      />
    </Box>
  );
}