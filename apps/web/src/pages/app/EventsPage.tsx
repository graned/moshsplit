import { useState, useMemo } from 'react';
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
  Tabs,
  Tab,
  alpha,
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import {
  Add as AddIcon,
  GroupAdd as JoinIcon,
  Group as GroupsIcon,
  MoreVert as MoreIcon,
  Edit as EditIcon,
  LocationOn as LocationIcon,
  CalendarToday as CalendarIcon,
  Euro as EuroIcon,
  Receipt as ReceiptIcon,

} from '@mui/icons-material';

import { useAuthStore } from '@moshsplit/auth-react';
import { groupsApi, GroupListItem, CreateGroupRequest, UpdateGroupRequest, Group, GroupMember } from '../../api/groups.api';
import { CreateGroupDialog } from '../../components/groups/CreateGroupDialog';
import { JoinGroupDialog } from '../../components/groups/JoinGroupDialog';
import { EditEventDialog } from '../../components/groups/EditEventDialog';

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

interface EventCardProps {
  group: GroupListItem;
  onClick: () => void;
  onDelete?: () => void;
  onEdit?: () => void;
}

function EventCard({ group, onClick, onDelete, onEdit }: EventCardProps) {
  const actions = (
    <>
      {onEdit && (
        <IconButton
          size="small"
          onClick={(e) => { e.stopPropagation(); onEdit(); }}
          sx={{ bgcolor: alpha('#000', 0.4), color: '#fff', '&:hover': { bgcolor: alpha('#000', 0.6) } }}
        >
          <EditIcon fontSize="small" />
        </IconButton>
      )}
      {onDelete && (
        <IconButton
          size="small"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          sx={{ bgcolor: alpha('#000', 0.4), color: '#fff', '&:hover': { bgcolor: alpha('#000', 0.6) } }}
        >
          <MoreIcon fontSize="small" />
        </IconButton>
      )}
    </>
  );

  const details = (
    <>
      <Typography variant="subtitle1" fontWeight={700} sx={{ lineHeight: 1.3, mb: 0.5 }}>
        {group.name}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
        <LocationIcon sx={{ fontSize: 13, color: 'text.secondary', flexShrink: 0 }} />
        <Typography variant="caption" color="text.secondary" noWrap>
          {group.description || 'Location TBD'}
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3, mb: 1 }}>
        <CalendarIcon sx={{ fontSize: 13, color: 'text.secondary', flexShrink: 0 }} />
        <Typography variant="caption" color="text.secondary" noWrap>
          {formatDate(group.created_at)}
        </Typography>
      </Box>
      <Box
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          px: 1,
          py: 0.2,
          borderRadius: 0.5,
          bgcolor: alpha('#10b981', 0.15),
          color: '#34d399',
          fontSize: '0.6rem',
          fontWeight: 700,
          letterSpacing: '0.05em',
        }}
      >
        YOU'RE GOING
      </Box>
    </>
  );

  const expenses = (
    <>
      <Typography variant="body1" fontWeight={700} color="primary.main" sx={{ lineHeight: 1.2 }}>
        —
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.2, display: 'block', whiteSpace: 'nowrap' }}>
        Total Expenses
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3, mt: 0.5 }}>
        <ReceiptIcon sx={{ fontSize: 12, color: 'text.secondary', flexShrink: 0 }} />
        <Typography variant="caption" fontWeight={600} noWrap>
          {group.member_count}
        </Typography>
      </Box>
    </>
  );

  return (
    <Card
      sx={{
        cursor: 'pointer',
        transition: 'transform 0.2s, box-shadow 0.2s',
        borderRadius: 3,
        overflow: 'hidden',
        '&:hover': {
          transform: { md: 'translateY(-4px)' },
          boxShadow: { md: '0 8px 24px rgba(0,0,0,0.3)' },
        },
      }}
      onClick={onClick}
    >
      {/* ===== MOBILE: horizontal layout ===== */}
      <Box sx={{ display: { xs: 'flex', md: 'none' }, minHeight: 110 }}>
        {/* Left: picture with gradient */}
        <Box
          sx={{
            width: 100,
            position: 'relative',
            overflow: 'hidden',
            background: `linear-gradient(135deg, ${alpha('#F59E0B', 0.4)} 0%, ${alpha('#D97706', 0.6)} 100%)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Box sx={{
            position: 'absolute', inset: 0,
            background: `linear-gradient(to right, transparent 40%, ${alpha('#1E1E1E', 0.95)} 100%)`,
          }} />
          <ReceiptIcon sx={{ fontSize: 40, color: alpha('#fff', 0.3), zIndex: 0 }} />
          {/* Actions on mobile */}
          <Box sx={{ position: 'absolute', top: 4, right: 4, display: 'flex', gap: 0.3, zIndex: 1 }}>
            {actions}
          </Box>
        </Box>

        {/* Right: details + expenses */}
        <Box sx={{ display: 'flex', flex: 1, minWidth: 0, p: 1.5 }}>
          {/* Details */}
          <Box sx={{ flex: 1, minWidth: 0, pr: 1 }}>
            {details}
          </Box>

          {/* Expenses summary */}
          <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
            {expenses}
          </Box>
        </Box>
      </Box>

      {/* ===== DESKTOP: vertical layout ===== */}
      <Box sx={{ display: { xs: 'none', md: 'block' } }}>
        {/* Picture / hero */}
        <Box
          sx={{
            height: 280,
            background: `linear-gradient(135deg, ${alpha('#F59E0B', 0.4)} 0%, ${alpha('#D97706', 0.6)} 100%)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
          }}
        >
          {/* Top-to-bottom transparent gradient overlay */}
          <Box sx={{
            position: 'absolute', inset: 0,
            background: `linear-gradient(to bottom, transparent 40%, ${alpha('#1E1E1E', 0.95)} 100%)`,
          }} />
          <ReceiptIcon sx={{ fontSize: 96, color: alpha('#fff', 0.2), zIndex: 0 }} />
          <Box sx={{ position: 'absolute', top: 16, right: 16, display: 'flex', gap: 1, zIndex: 1 }}>
            {actions}
          </Box>
        </Box>

        <CardContent sx={{ p: 4, '&:last-child': { pb: 4 } }}>
          <Typography variant="h4" fontWeight={700} sx={{ mb: 2 }}>
            {group.name}
          </Typography>

          <Stack spacing={1} sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <LocationIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
              <Typography variant="body1" color="text.secondary">
                {group.description || 'Location TBD'}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <CalendarIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
              <Typography variant="body1" color="text.secondary">
                {formatDate(group.created_at)}
              </Typography>
            </Box>
          </Stack>

          <Box sx={{ height: 1, bgcolor: 'divider', mb: 3 }} />

          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <EuroIcon sx={{ fontSize: 22, color: 'primary.main' }} />
                <Typography variant="h3" fontWeight={700} color="primary.main">
                  —
                </Typography>
              </Box>
              <Typography variant="body1" color="text.secondary">
                Total Expenses
              </Typography>
            </Box>
            <Box sx={{ textAlign: 'right' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, justifyContent: 'flex-end' }}>
                <ReceiptIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                <Typography variant="h6" fontWeight={600}>
                  {group.member_count} {group.member_count === 1 ? 'expense' : 'expenses'}
                </Typography>
              </Box>
              <Typography variant="body1" color="text.secondary">
                {group.member_count} {group.member_count === 1 ? 'participant' : 'participants'}
              </Typography>
            </Box>
          </Box>

          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              px: 2.5,
              py: 0.8,
              borderRadius: 1,
              bgcolor: alpha('#10b981', 0.15),
              color: '#34d399',
              fontSize: '0.9rem',
              fontWeight: 700,
              letterSpacing: '0.05em',
            }}
          >
            YOU'RE GOING
          </Box>
        </CardContent>
      </Box>
    </Card>
  );
}

export default function EventsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const userId = useAuthStore((state) => state.userId);

  const [tab, setTab] = useState(0);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [joinDialogOpen, setJoinDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Group | null>(null);
  const [selectedEventMembers, setSelectedEventMembers] = useState<GroupMember[]>([]);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['groups', userId],
    queryFn: async () => {
      if (!userId) throw new Error('User not authenticated');
      const result = await groupsApi.list(userId);
      return result;
    },
    enabled: !!userId,
    staleTime: 0,
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateGroupRequest) => groupsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (groupId: string) => groupsApi.delete(groupId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ groupId, data }: { groupId: string; data: UpdateGroupRequest }) =>
      groupsApi.update(groupId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
    },
  });

  const addMemberMutation = useMutation({
    mutationFn: ({ groupId, userId }: { groupId: string; userId: string }) =>
      groupsApi.addMember(groupId, { user_id: userId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      if (selectedEvent) {
        groupsApi.listMembers(selectedEvent.id).then(setSelectedEventMembers).catch(console.error);
      }
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: ({ groupId, userId }: { groupId: string; userId: string }) =>
      groupsApi.removeMember(groupId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      if (selectedEvent) {
        groupsApi.listMembers(selectedEvent.id).then(setSelectedEventMembers).catch(console.error);
      }
    },
  });

  const groups = data?.data || [];

  const upcoming = useMemo(() => groups.filter((g) => g.status === 'active'), [groups]);
  const past = useMemo(() => groups.filter((g) => g.status === 'archived' || g.status === 'deleted'), [groups]);
  const visible = tab === 0 ? upcoming : past;

  const handleCreateGroup = async (data: { name: string; description?: string; currency: string; memberIds?: string[] }) => {
    if (!userId) throw new Error('User not authenticated');
    const mutationData = { ...data, user_id: userId };
    const group = await createMutation.mutateAsync(mutationData);
    const memberIds = new Set(data.memberIds || []);
    memberIds.add(userId);
    for (const memberId of memberIds) {
      if (memberId !== userId) {
        try {
          await groupsApi.addMember(group.id, { user_id: memberId });
        } catch (err) {
          console.error('[EventsPage] Failed to add member:', memberId, err);
        }
      }
    }
  };

  const handleJoinGroup = async (_inviteCode: string) => {
    throw new Error('Invite functionality not yet implemented');
  };

  const handleEditGroup = async (group: GroupListItem) => {
    const eventDetails = await groupsApi.get(group.id);
    const members = await groupsApi.listMembers(group.id);
    setSelectedEvent(eventDetails);
    setSelectedEventMembers(members);
    setEditDialogOpen(true);
  };

  const handleGroupClick = (group: GroupListItem) => {
    navigate(`/app/events/${group.id}`);
  };

  const handleDeleteGroup = async (groupId: string) => {
    if (window.confirm('Are you sure you want to archive this event?')) {
      await deleteMutation.mutateAsync(groupId);
    }
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight={700}>
            Events
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Browse and manage your events
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
            New Event
          </Button>
        </Box>
      </Box>

      {/* Demo event link */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
        <Button
          variant="text"
          size="small"
          onClick={() => navigate('/app/events/mock-event-1')}
          sx={{ color: 'text.disabled', fontSize: '0.75rem' }}
        >
          View demo event
        </Button>
      </Box>

      {/* Error state */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} action={
          <Button color="inherit" size="small" onClick={() => refetch()}>
            Retry
          </Button>
        }>
          Failed to load events
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
              No events yet
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Create a new event to start tracking shared expenses with friends.
            </Typography>
            <Stack direction="row" spacing={2} justifyContent="center">
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setCreateDialogOpen(true)}
              >
                Create Event
              </Button>
              <Button
                variant="outlined"
                startIcon={<JoinIcon />}
                onClick={() => setJoinDialogOpen(true)}
              >
                Join Event
              </Button>
            </Stack>
          </CardContent>
        </Card>
      )}

      {/* Tabs + groups grid */}
      {!isLoading && !error && groups.length > 0 && (
        <>
          <Tabs
            value={tab}
            onChange={(_, v) => setTab(v)}
            sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}
          >
            <Tab
              label={`UPCOMING (${upcoming.length})`}
              sx={{ fontWeight: 700, letterSpacing: '0.05em', fontSize: '0.85rem' }}
            />
            <Tab
              label={`PAST (${past.length})`}
              sx={{ fontWeight: 700, letterSpacing: '0.05em', fontSize: '0.85rem' }}
            />
          </Tabs>

          {visible.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 6 }}>
              <Typography variant="body1" color="text.secondary">
                {tab === 0 ? 'No upcoming events' : 'No past events'}
              </Typography>
            </Box>
          ) : (
            <Grid container spacing={3}>
              {visible.map((group) => (
                <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={group.id}>
                  <EventCard
                    group={group}
                    onClick={() => handleGroupClick(group)}
                    onDelete={group.status === 'active' ? () => handleDeleteGroup(group.id) : undefined}
                    onEdit={() => handleEditGroup(group)}
                  />
                </Grid>
              ))}
            </Grid>
          )}
        </>
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
          await updateMutation.mutateAsync({ groupId: eventId, data });
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