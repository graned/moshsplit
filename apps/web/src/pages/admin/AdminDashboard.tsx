import {
  Box,
  Typography,
  Card,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  alpha,
} from '@mui/material';
import {
  Event as EventIcon,
  People as PeopleIcon,
  ReceiptLong as ExpenseIcon,
  ReceiptLong,
  HealthAndSafety as HealthIcon,
  CheckCircle as HealthyIcon,
  Warning as DegradedIcon,
  Error as CriticalIcon,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { adminDashboardApi, RecentActivity } from '../../api/admin/dashboard.api';
import { StatSkeleton, TableSkeleton } from '../../components/ui/Skeleton';
import EmptyState from '../../components/ui/EmptyState';

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <Card sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Box
          sx={{
            width: 48,
            height: 48,
            borderRadius: 3,
            backgroundColor: alpha(color, 0.12),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color,
          }}
        >
          {icon}
        </Box>
        <Box>
          <Typography variant="h4" fontWeight={700}>
            {value}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {label}
          </Typography>
        </Box>
      </Box>
    </Card>
  );
}

function HealthBadge({ status }: { status: string }) {
  const config: Record<string, { color: string; icon: React.ReactElement; label: string }> = {
    healthy: { color: '#10b981', icon: <HealthyIcon />, label: 'Healthy' },
    degraded: { color: '#f59e0b', icon: <DegradedIcon />, label: 'Degraded' },
    critical: { color: '#ef4444', icon: <CriticalIcon />, label: 'Critical' },
  };

  const { color, icon, label } = config[status] || config.degraded;

  return (
    <Chip
      icon={icon}
      label={label}
      sx={{
        backgroundColor: alpha(color, 0.12),
        color,
        fontWeight: 600,
        '& .MuiChip-icon': { color },
      }}
    />
  );
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  if (days > 0) return `${days}d ${hours}h`;
  return `${hours}h`;
}

export default function AdminDashboard() {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => adminDashboardApi.getStats(),
  });

  const { data: activity, isLoading: activityLoading } = useQuery({
    queryKey: ['admin-recent-activity'],
    queryFn: () => adminDashboardApi.getRecentActivity(10),
  });

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight={700} sx={{ color: '#f3f4f6' }}>
          Command Center
        </Typography>
        <Typography variant="body2" color="text.secondary">
          System overview and recent activity
        </Typography>
      </Box>

      {/* Stats Grid */}
      {statsLoading ? (
        <StatSkeleton count={4} />
      ) : stats ? (
        <Grid container spacing={2} sx={{ mb: 4 }}>
          <Grid item xs={6} md={3}>
            <StatCard icon={<EventIcon />} label="Total Events" value={stats.total_events} color="#f59e0b" />
          </Grid>
          <Grid item xs={6} md={3}>
            <StatCard icon={<PeopleIcon />} label="Active Users" value={stats.active_users} color="#3b82f6" />
          </Grid>
          <Grid item xs={6} md={3}>
            <StatCard icon={<ExpenseIcon />} label="Total Expenses" value={stats.total_expenses} color="#8b5cf6" />
          </Grid>
          <Grid item xs={6} md={3}>
            <Card sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box
                  sx={{
                    width: 48,
                    height: 48,
                    borderRadius: 3,
                    backgroundColor: alpha('#10b981', 0.12),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#10b981',
                  }}
                >
                  <HealthIcon />
                </Box>
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <HealthBadge status={stats.system_health} />
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    Uptime: {formatUptime(stats.uptime_seconds)}
                  </Typography>
                </Box>
              </Box>
            </Card>
          </Grid>
        </Grid>
      ) : null}

      {/* Recent Activity */}
      <Typography variant="h6" fontWeight={600} sx={{ mb: 2, color: '#f3f4f6' }}>
        Recent Activity
      </Typography>

      {activityLoading ? (
        <TableSkeleton count={5} />
      ) : !activity || activity.length === 0 ? (
        <Card>
          <EmptyState
            icon={<ReceiptLong />}
            title="The pit is silent"
            description="No recent activity to report. The survivors are resting."
          />
        </Card>
      ) : (
        <Card>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Time</TableCell>
                  <TableCell>Actor</TableCell>
                  <TableCell>Action</TableCell>
                  <TableCell>Resource</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {activity.map((item: RecentActivity) => (
                  <TableRow key={item.id} sx={{ '&:hover': { backgroundColor: 'action.hover' } }}>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {formatTime(item.timestamp)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={500}>
                        {item.actor_name || 'System'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{item.action}</Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={item.resource_type}
                        size="small"
                        variant="outlined"
                        sx={{ textTransform: 'capitalize' }}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      )}
    </Box>
  );
}
