import { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Card,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Chip,
  TextField,
  InputAdornment,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  Stack,
  SelectChangeEvent,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
} from '@mui/material';
import {
  Search as SearchIcon,
  Add as AddIcon,
  Restore as RestoreIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminEventsApi, AdminEvent } from '../../api/admin/events.api';
import { TableSkeleton } from '../../components/ui/Skeleton';
import EmptyState from '../../components/ui/EmptyState';

const statusColors: Record<string, 'success' | 'default' | 'error' | 'warning'> = {
  active: 'success',
  archived: 'default',
  deleted: 'error',
};

function EventsTable({
  events,
  onSummon,
  onRestore,
}: {
  events: AdminEvent[];
  onSummon: () => void;
  onRestore: (eventId: string) => void;
}) {
  const formatAmount = (cents: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <>
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={onSummon}
          sx={{
            backgroundColor: '#f59e0b',
            color: '#121212',
            fontWeight: 700,
            '&:hover': { backgroundColor: '#d97706' },
          }}
        >
          Summon Event
        </Button>
      </Box>
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Members</TableCell>
              <TableCell>Expenses</TableCell>
              <TableCell>Total</TableCell>
              <TableCell>Created</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {events.map((event) => (
              <TableRow key={event.id} sx={{ '&:hover': { backgroundColor: 'action.hover' } }}>
                <TableCell>
                  <Typography variant="body2" fontWeight={500}>
                    {event.name}
                  </Typography>
                  {event.description && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                      {event.description}
                    </Typography>
                  )}
                </TableCell>
                <TableCell>
                  <Chip
                    label={event.status}
                    color={statusColors[event.status]}
                    size="small"
                    sx={{ textTransform: 'capitalize' }}
                  />
                </TableCell>
                <TableCell>
                  <Typography variant="body2">{event.member_count}</Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2">{event.expense_count}</Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2">{formatAmount(event.total_amount_cents)}</Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" color="text.secondary">
                    {formatDate(event.created_at)}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  {event.status !== 'active' && (
                    <Button
                      size="small"
                      startIcon={<RestoreIcon />}
                      onClick={() => onRestore(event.id)}
                      sx={{ color: '#f59e0b' }}
                    >
                      Restore
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </>
  );
}

export default function AdminEvents() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [summonDialogOpen, setSummonDialogOpen] = useState(false);
  const [newEventName, setNewEventName] = useState('');
  const [newEventDesc, setNewEventDesc] = useState('');

  const queryParams = useMemo(
    () => ({
      page: page + 1,
      pageSize,
      ...(search && { search }),
      ...(statusFilter && { status: statusFilter }),
    }),
    [page, pageSize, search, statusFilter]
  );

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin-events', queryParams],
    queryFn: () => adminEventsApi.list(queryParams),
  });

  const summonMutation = useMutation({
    mutationFn: (data: { name: string; description?: string }) => adminEventsApi.summonEvent(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-events'] });
      setSummonDialogOpen(false);
      setNewEventName('');
      setNewEventDesc('');
    },
  });

  const restoreMutation = useMutation({
    mutationFn: (eventId: string) => adminEventsApi.restoreEvent(eventId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-events'] });
    },
  });

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(event.target.value);
    setPage(0);
  };

  const handleStatusChange = (event: SelectChangeEvent<string>) => {
    setStatusFilter(event.target.value);
    setPage(0);
  };

  const handleSummon = () => {
    if (!newEventName.trim()) return;
    summonMutation.mutate({
      name: newEventName.trim(),
      description: newEventDesc.trim() || undefined,
    });
  };

  const events = data?.data || [];
  const total = data?.total || 0;

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" fontWeight={700} sx={{ color: '#f3f4f6' }}>
          Events
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Manage all events across the pit
        </Typography>
      </Box>

      {/* Summon Dialog */}
      <Dialog open={summonDialogOpen} onClose={() => setSummonDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Summon New Event</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              label="Event Name"
              value={newEventName}
              onChange={(e) => setNewEventName(e.target.value)}
              fullWidth
              autoFocus
              placeholder="e.g., Summer Festival 2026"
            />
            <TextField
              label="Description (optional)"
              value={newEventDesc}
              onChange={(e) => setNewEventDesc(e.target.value)}
              fullWidth
              multiline
              rows={3}
              placeholder="What's this event about?"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSummonDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSummon}
            disabled={!newEventName.trim() || summonMutation.isPending}
            sx={{
              backgroundColor: '#f59e0b',
              color: '#121212',
              fontWeight: 700,
            }}
          >
            Summon
          </Button>
        </DialogActions>
      </Dialog>

      {/* Filters */}
      <Card sx={{ mb: 3, p: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField
            placeholder="Search events..."
            value={search}
            onChange={handleSearchChange}
            size="small"
            sx={{ flex: 1, minWidth: 200 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon color="action" />
                </InputAdornment>
              ),
            }}
          />
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>Status</InputLabel>
            <Select value={statusFilter} onChange={handleStatusChange} label="Status">
              <MenuItem value="">All</MenuItem>
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="archived">Archived</MenuItem>
              <MenuItem value="deleted">Deleted</MenuItem>
            </Select>
          </FormControl>
        </Stack>
      </Card>

      {/* Error */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} action={
          <Button color="inherit" size="small" onClick={() => refetch()}>Retry</Button>
        }>
          Failed to load events
        </Alert>
      )}

      {/* Loading */}
      {isLoading && <TableSkeleton count={5} />}

      {/* Empty State */}
      {!isLoading && !error && events.length === 0 && (
        <Card>
          <EmptyState
            icon={<RestoreIcon />}
            title="No survivors found"
            description={search || statusFilter ? 'Try adjusting your search or filters' : 'The pit is empty. Summon your first event.'}
            actionLabel="Summon Event"
            onAction={() => setSummonDialogOpen(true)}
          />
        </Card>
      )}

      {/* Events Table */}
      {!isLoading && !error && events.length > 0 && (
        <Card>
          <EventsTable
            events={events}
            onSummon={() => setSummonDialogOpen(true)}
            onRestore={(id) => restoreMutation.mutate(id)}
          />
          <TablePagination
            component="div"
            count={total}
            page={page}
            onPageChange={(_, p) => setPage(p)}
            rowsPerPage={pageSize}
            onRowsPerPageChange={(e) => {
              setPageSize(parseInt(e.target.value, 10));
              setPage(0);
            }}
            rowsPerPageOptions={[10, 20, 50]}
            sx={{ borderTop: 1, borderColor: 'divider' }}
          />
        </Card>
      )}
    </Box>
  );
}
