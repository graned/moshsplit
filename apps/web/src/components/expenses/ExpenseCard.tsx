import {
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  IconButton,
  Avatar,
  Tooltip,
} from '@mui/material';
import {
  MoreVert as MoreIcon,
} from '@mui/icons-material';
import { ExpenseListItem } from '../../api/expenses.api';
import { UserInfo } from '../../api/users.api';

interface ExpenseCardProps {
  expense: ExpenseListItem;
  onClick: () => void;
  onDelete?: () => void;
  paidBy?: UserInfo;
  currentUserId?: string;
}

function UserAvatar({ user, currentUserId }: { user?: UserInfo; currentUserId?: string }) {
  const name = user ? `${user.firstName} ${user.lastName}`.trim() || user.email : 'Unknown';
  const initial = name.charAt(0).toUpperCase();
  const isCurrentUser = user?.id === currentUserId;

  return (
    <Tooltip
      title={
        <Box sx={{ py: 0.5 }}>
          <Typography variant="body2" fontWeight={600}>{name}</Typography>
          {user?.email && (
            <Typography variant="caption" color="text.secondary">{user.email}</Typography>
          )}
        </Box>
      }
      arrow
    >
      <Avatar
        sx={{
          width: 24,
          height: 24,
          fontSize: '0.7rem',
          fontWeight: 700,
          bgcolor: isCurrentUser ? 'primary.main' : 'action.disabledBackground',
          cursor: 'default',
        }}
      >
        {initial}
      </Avatar>
    </Tooltip>
  );
}

export function ExpenseCard({ expense, onClick, onDelete, paidBy, currentUserId }: ExpenseCardProps) {
  const formatAmount = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'EUR',
    }).format(cents / 100);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const getSplitTypeLabel = (splitType?: string) => {
    switch (splitType) {
      case 'equal':
        return 'Split equally';
      case 'custom':
        return 'Custom split';
      case 'percentage':
        return 'By percentage';
      case 'shares':
        return 'By shares';
      default:
        return splitType || 'Split';
    }
  };

  const paidByName = paidBy
    ? `${paidBy.firstName} ${paidBy.lastName}`.trim() || paidBy.email
    : expense.paid_by;

  return (
    <Card
      sx={{
        cursor: 'pointer',
        transition: 'transform 0.2s, box-shadow 0.2s',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: 4,
        },
        opacity: expense.deleted_at ? 0.6 : 1,
      }}
      onClick={onClick}
    >
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" fontWeight={600} gutterBottom>
              {expense.title}
            </Typography>
            {expense.description && (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                {expense.description}
              </Typography>
            )}
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <UserAvatar user={paidBy} currentUserId={currentUserId} />
                <Typography variant="body2" color="text.secondary">
                  {paidByName}
                </Typography>
              </Box>
              {expense.split_type && (
                <Chip
                  label={getSplitTypeLabel(expense.split_type)}
                  size="small"
                  variant="outlined"
                />
              )}
            </Box>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="h6" fontWeight={700} color="primary">
              {formatAmount(expense.amount_cents)}
            </Typography>
            {onDelete && !expense.deleted_at && (
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
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
          <Typography variant="caption" color="text.secondary">
            v{expense.version_number} • {formatDate(expense.created_at)}
          </Typography>
          {expense.deleted_at && (
            <Chip label="Deleted" size="small" color="error" variant="outlined" />
          )}
        </Box>
      </CardContent>
    </Card>
  );
}
