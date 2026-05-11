import {
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  IconButton,
} from '@mui/material';
import {
  MoreVert as MoreIcon,
  Person as PersonIcon,
} from '@mui/icons-material';
import { ExpenseListItem } from '../../../api/expenses.api';

interface ExpenseCardProps {
  expense: ExpenseListItem;
  onClick: () => void;
  onDelete?: () => void;
  paidByName?: string;
}

export function ExpenseCard({ expense, onClick, onDelete, paidByName }: ExpenseCardProps) {
  const formatAmount = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD', // This should be dynamic based on group currency
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
                <PersonIcon fontSize="small" color="action" />
                <Typography variant="body2" color="text.secondary">
                  {paidByName || expense.paid_by}
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