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
  IconButton,
  TextField,
  InputAdornment,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  CircularProgress,
  Alert,
  Button,
  Avatar,
  Stack,
  Menu,
  ListItemIcon,
  ListItemText,
  SelectChangeEvent,
} from '@mui/material';
import {
  Search as SearchIcon,
  MoreVert as MoreIcon,
  Block as BlockIcon,
  CheckCircle as ActivateIcon,
  AdminPanelSettings as AdminIcon,
  Person as UserIcon,
} from '@mui/icons-material';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminUsersApi, AdminUser, UserStatus, UserRole } from '../../api/admin/users.api';

// Status badge colors
const statusColors: Record<UserStatus, 'success' | 'default' | 'error' | 'warning'> = {
  active: 'success',
  inactive: 'default',
  suspended: 'error',
  pending_verification: 'warning',
};

// Role badge colors
const roleColors: Record<UserRole, 'primary' | 'secondary'> = {
  admin: 'primary',
  super_admin: 'primary',
  user: 'secondary',
};

interface UserActionsMenuProps {
  user: AdminUser;
  onUpdateStatus: (userId: string, status: UserStatus) => void;
  onUpdateRole: (userId: string, role: UserRole) => void;
}

function UserActionsMenu({ user, onUpdateStatus, onUpdateRole }: UserActionsMenuProps) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleStatusChange = (status: UserStatus) => {
    onUpdateStatus(user.id, status);
    handleClose();
  };

  const handleRoleChange = (role: UserRole) => {
    onUpdateRole(user.id, role);
    handleClose();
  };

  return (
    <>
      <IconButton
        size="small"
        onClick={handleClick}
        aria-label="user actions"
      >
        <MoreIcon />
      </IconButton>
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        {/* Status actions */}
        {user.status !== 'active' && (
          <MenuItem onClick={() => handleStatusChange('active')}>
            <ListItemIcon>
              <ActivateIcon fontSize="small" color="success" />
            </ListItemIcon>
            <ListItemText>Activate</ListItemText>
          </MenuItem>
        )}
        {user.status !== 'suspended' && (
          <MenuItem onClick={() => handleStatusChange('suspended')}>
            <ListItemIcon>
              <BlockIcon fontSize="small" color="error" />
            </ListItemIcon>
            <ListItemText>Suspend</ListItemText>
          </MenuItem>
        )}
        {user.status !== 'inactive' && (
          <MenuItem onClick={() => handleStatusChange('inactive')}>
            <ListItemIcon>
              <BlockIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Deactivate</ListItemText>
          </MenuItem>
        )}

        {/* Role section divider */}
        <MenuItem disabled>
          <ListItemText inset>- Role -</ListItemText>
        </MenuItem>

        {user.role !== 'admin' && user.role !== 'super_admin' && (
          <MenuItem onClick={() => handleRoleChange('admin')}>
            <ListItemIcon>
              <AdminIcon fontSize="small" color="primary" />
            </ListItemIcon>
            <ListItemText>Make Admin</ListItemText>
          </MenuItem>
        )}
        {user.role !== 'user' && (
          <MenuItem onClick={() => handleRoleChange('user')}>
            <ListItemIcon>
              <UserIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Remove Admin</ListItemText>
          </MenuItem>
        )}
      </Menu>
    </>
  );
}

function UserAvatar({ user }: { user: AdminUser }) {
  if (user.avatarUrl) {
    return <Avatar src={user.avatarUrl} sx={{ width: 36, height: 36 }} />;
  }
  return (
    <Avatar
      sx={{
        width: 36,
        height: 36,
        bgcolor: 'primary.main',
        fontSize: '0.875rem',
      }}
    >
      {user.name?.charAt(0)?.toUpperCase() || user.email?.charAt(0)?.toUpperCase() || '?'}
    </Avatar>
  );
}

function UsersTable({ users }: { users: AdminUser[] }) {
  const queryClient = useQueryClient();

  const statusMutation = useMutation({
    mutationFn: ({ userId, status }: { userId: string; status: UserStatus }) =>
      adminUsersApi.updateStatus(userId, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
  });

  const roleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: UserRole }) =>
      adminUsersApi.updateRole(userId, { role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
  });

  const handleUpdateStatus = (userId: string, status: UserStatus) => {
    statusMutation.mutate({ userId, status });
  };

  const handleUpdateRole = (userId: string, role: UserRole) => {
    roleMutation.mutate({ userId, role });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <TableContainer>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>User</TableCell>
            <TableCell>Email</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Role</TableCell>
            <TableCell>Joined</TableCell>
            <TableCell align="right">Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {users.map((user) => (
            <TableRow
              key={user.id}
              sx={{
                '&:hover': {
                  backgroundColor: 'action.hover',
                },
              }}
            >
              <TableCell>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <UserAvatar user={user} />
                  <Typography variant="body2" fontWeight={500}>
                    {user.name || 'No name'}
                  </Typography>
                </Box>
              </TableCell>
              <TableCell>
                <Typography variant="body2" color="text.secondary">
                  {user.email}
                </Typography>
              </TableCell>
              <TableCell>
                <Chip
                  label={user.status}
                  color={statusColors[user.status]}
                  size="small"
                  sx={{ textTransform: 'capitalize' }}
                />
              </TableCell>
              <TableCell>
                <Chip
                  label={user.role === 'super_admin' ? 'Super Admin' : user.role}
                  color={roleColors[user.role]}
                  size="small"
                  variant={user.role === 'admin' || user.role === 'super_admin' ? 'filled' : 'outlined'}
                  sx={{ textTransform: 'capitalize' }}
                />
              </TableCell>
              <TableCell>
                <Typography variant="body2" color="text.secondary">
                  {formatDate(user.createdAt)}
                </Typography>
              </TableCell>
              <TableCell align="right">
                <UserActionsMenu
                  user={user}
                  onUpdateStatus={handleUpdateStatus}
                  onUpdateRole={handleUpdateRole}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

export default function UsersPage() {
  // Filters state
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<UserStatus | ''>('');
  const [roleFilter, setRoleFilter] = useState<UserRole | ''>('');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);

  // Build query params
  const queryParams = useMemo(() => ({
    page: page + 1, // API uses 1-based indexing
    pageSize,
    ...(search && { search }),
    ...(statusFilter && { status: statusFilter }),
    ...(roleFilter && { role: roleFilter }),
  }), [page, pageSize, search, statusFilter, roleFilter]);

  // Fetch users
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin-users', queryParams],
    queryFn: () => adminUsersApi.list(queryParams),
  });

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(event.target.value);
    setPage(0); // Reset to first page on search
  };

  const handleStatusChange = (event: SelectChangeEvent<UserStatus | ''>) => {
    setStatusFilter(event.target.value as UserStatus | '');
    setPage(0);
  };

  const handleRoleChange = (event: SelectChangeEvent<UserRole | ''>) => {
    setRoleFilter(event.target.value as UserRole | '');
    setPage(0);
  };

  const handlePageChange = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handlePageSizeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setPageSize(parseInt(event.target.value, 10));
    setPage(0);
  };

  const users = data?.data || [];
  const total = data?.total || 0;

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" fontWeight={700}>
          User Management
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Manage user accounts, roles, and access permissions
        </Typography>
      </Box>

      {/* Filters */}
      <Card sx={{ mb: 3, p: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField
            placeholder="Search by name or email..."
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
            <Select
              value={statusFilter}
              onChange={handleStatusChange}
              label="Status"
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="inactive">Inactive</MenuItem>
              <MenuItem value="suspended">Suspended</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>Role</InputLabel>
            <Select
              value={roleFilter}
              onChange={handleRoleChange}
              label="Role"
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="admin">Admin</MenuItem>
              <MenuItem value="super_admin">Super Admin</MenuItem>
              <MenuItem value="user">User</MenuItem>
            </Select>
          </FormControl>
        </Stack>
      </Card>

      {/* Error state */}
      {error && (
        <Alert 
          severity="error" 
          sx={{ mb: 2 }} 
          action={
            <Button color="inherit" size="small" onClick={() => refetch()}>
              Retry
            </Button>
          }
        >
          Failed to load users
        </Alert>
      )}

      {/* Loading state */}
      {isLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      )}

      {/* Empty state */}
      {!isLoading && !error && users.length === 0 && (
        <Card>
          <Box sx={{ py: 8, textAlign: 'center' }}>
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
              <UserIcon sx={{ fontSize: 40, color: 'primary.main' }} />
            </Box>
            <Typography variant="h6" fontWeight={600} gutterBottom>
              No users found
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {search || statusFilter || roleFilter
                ? 'Try adjusting your search or filters'
                : 'No user accounts have been created yet'}
            </Typography>
          </Box>
        </Card>
      )}

      {/* Users table */}
      {!isLoading && !error && users.length > 0 && (
        <Card>
          <TableContainer>
            <UsersTable users={users} />
          </TableContainer>
          <TablePagination
            component="div"
            count={total}
            page={page}
            onPageChange={handlePageChange}
            rowsPerPage={pageSize}
            onRowsPerPageChange={handlePageSizeChange}
            rowsPerPageOptions={[10, 20, 50]}
            sx={{
              borderTop: 1,
              borderColor: 'divider',
            }}
          />
        </Card>
      )}
    </Box>
  );
}