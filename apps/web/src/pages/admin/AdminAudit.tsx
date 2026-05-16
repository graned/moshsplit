import { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Card,
  TextField,
  InputAdornment,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  Stack,
  SelectChangeEvent,
  TablePagination,
  alpha,
  Chip,
} from '@mui/material';
import { Search as SearchIcon, FilterList as FilterIcon } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { adminAuditApi, AuditEntry } from '../../api/admin/audit.api';
import { TableSkeleton } from '../../components/ui/Skeleton';
import EmptyState from '../../components/ui/EmptyState';

export default function AdminAudit() {
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [resourceFilter, setResourceFilter] = useState('');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);

  const queryParams = useMemo(
    () => ({
      page: page + 1,
      pageSize,
      ...(search && { actor: search }),
      ...(actionFilter && { action: actionFilter }),
      ...(resourceFilter && { resource_type: resourceFilter }),
    }),
    [page, pageSize, search, actionFilter, resourceFilter]
  );

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin-audit', queryParams],
    queryFn: () => adminAuditApi.list(queryParams),
    staleTime: 30_000,
  });

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(event.target.value);
    setPage(0);
  };

  const handleActionChange = (event: SelectChangeEvent<string>) => {
    setActionFilter(event.target.value);
    setPage(0);
  };

  const handleResourceChange = (event: SelectChangeEvent<string>) => {
    setResourceFilter(event.target.value);
    setPage(0);
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  };

  const entries = data?.data || [];
  const total = data?.total || 0;

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" fontWeight={700} sx={{ color: '#f3f4f6' }}>
          Eternal Ledger
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Every action is recorded. Nothing escapes the pit.
        </Typography>
      </Box>

      {/* Filters */}
      <Card sx={{ mb: 3, p: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField
            placeholder="Search by actor..."
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
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Action</InputLabel>
            <Select value={actionFilter} onChange={handleActionChange} label="Action">
              <MenuItem value="">All Actions</MenuItem>
              <MenuItem value="user_created">User Created</MenuItem>
              <MenuItem value="user_updated">User Updated</MenuItem>
              <MenuItem value="user_suspended">User Suspended</MenuItem>
              <MenuItem value="event_created">Event Created</MenuItem>
              <MenuItem value="event_updated">Event Updated</MenuItem>
              <MenuItem value="expense_created">Expense Created</MenuItem>
              <MenuItem value="import_performed">Import Performed</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Resource</InputLabel>
            <Select value={resourceFilter} onChange={handleResourceChange} label="Resource">
              <MenuItem value="">All Resources</MenuItem>
              <MenuItem value="user">User</MenuItem>
              <MenuItem value="event">Event</MenuItem>
              <MenuItem value="expense">Expense</MenuItem>
              <MenuItem value="settlement">Settlement</MenuItem>
              <MenuItem value="system">System</MenuItem>
            </Select>
          </FormControl>
        </Stack>
      </Card>

      {/* Error */}
      {error && (
        <Box sx={{ mb: 2 }}>
          <Button color="error" size="small" onClick={() => refetch()}>
            Retry
          </Button>
        </Box>
      )}

      {/* Loading */}
      {isLoading && <TableSkeleton count={8} />}

      {/* Empty State */}
      {!isLoading && !error && entries.length === 0 && (
        <Card>
          <EmptyState
            icon={<FilterIcon sx={{ fontSize: 40, color: '#f59e0b' }} />}
            title="The ledger is blank"
            description={
              search || actionFilter || resourceFilter
                ? 'Try adjusting your filters'
                : 'No entries have been recorded yet.'
            }
          />
        </Card>
      )}

      {/* Audit Log */}
      {!isLoading && !error && entries.length > 0 && (
        <>
          <Card sx={{ mb: 2 }}>
            <Box sx={{ p: 0 }}>
              {/* Header Row */}
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: '200px 140px 1fr 100px',
                  gap: 2,
                  p: 2,
                  borderBottom: 1,
                  borderColor: 'divider',
                  backgroundColor: alpha('#f59e0b', 0.03),
                }}
              >
                <Typography variant="caption" fontWeight={600} color="text.secondary">
                  TIMESTAMP
                </Typography>
                <Typography variant="caption" fontWeight={600} color="text.secondary">
                  ACTOR
                </Typography>
                <Typography variant="caption" fontWeight={600} color="text.secondary">
                  ACTION
                </Typography>
                <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ textAlign: 'right' }}>
                  RESOURCE
                </Typography>
              </Box>

              {/* Log Entries */}
              {entries.map((entry: AuditEntry) => (
                <Box
                  key={entry.id}
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: '200px 140px 1fr 100px',
                    gap: 2,
                    p: 2,
                    borderBottom: 1,
                    borderColor: 'divider',
                    fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                    fontSize: '0.8125rem',
                    '&:hover': {
                      backgroundColor: alpha('#f59e0b', 0.03),
                    },
                  }}
                >
                  <Typography
                    sx={{
                      fontFamily: 'inherit',
                      color: '#6b7280',
                      fontSize: 'inherit',
                    }}
                  >
                    {formatTimestamp(entry.timestamp)}
                  </Typography>
                  <Typography
                    sx={{
                      fontFamily: 'inherit',
                      color: '#f59e0b',
                      fontSize: 'inherit',
                      fontWeight: 500,
                    }}
                  >
                    {entry.actor_name || entry.actor_id.slice(0, 8)}
                  </Typography>
                  <Box>
                    <Typography
                      sx={{
                        fontFamily: 'inherit',
                        color: '#f3f4f6',
                        fontSize: 'inherit',
                      }}
                    >
                      {entry.action}
                    </Typography>
                    {entry.ip_address && (
                      <Typography
                        variant="caption"
                        sx={{
                          fontFamily: 'inherit',
                          color: '#4b5563',
                          fontSize: '0.6875rem',
                        }}
                      >
                        {entry.ip_address}
                      </Typography>
                    )}
                  </Box>
                  <Box sx={{ textAlign: 'right' }}>
                    <Chip
                      label={entry.resource_type}
                      size="small"
                      variant="outlined"
                      sx={{
                        fontFamily: 'inherit',
                        fontSize: '0.6875rem',
                        textTransform: 'capitalize',
                        borderColor: alpha('#f59e0b', 0.3),
                        color: '#f59e0b',
                      }}
                    />
                  </Box>
                </Box>
              ))}
            </Box>
          </Card>

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
            rowsPerPageOptions={[25, 50, 100]}
            sx={{
              backgroundColor: '#1a1a1a',
              borderRadius: 2,
              borderTop: 1,
              borderColor: 'divider',
            }}
          />
        </>
      )}
    </Box>
  );
}
