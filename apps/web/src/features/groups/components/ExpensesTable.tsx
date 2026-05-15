import {
  Box,
  Typography,
  Tooltip,
  Chip,
  alpha,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import { ExpenseListItem } from '../../../api/expenses.api';
import { GroupMember } from '../../../api/groups.api';

const formatType = (type: string | undefined): string => {
  switch (type) {
    case 'equal': return 'Equal';
    case 'custom': return 'Custom';
    case 'percentage': return 'Percent';
    case 'shares': return 'Shares';
    default: return type || 'Equal';
  }
};

interface ExpensesTableProps {
  expenses: ExpenseListItem[];
  members: GroupMember[];
  getPayerName: (userId: string) => string;
}

export function ExpensesTable({ expenses, members, getPayerName }: ExpensesTableProps) {
  if (expenses.length === 0) {
    return (
      <Typography variant="body1" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
        No expenses yet
      </Typography>
    );
  }

  return (
    <Box sx={{ maxHeight: 520, overflowY: 'auto' }}>
      {/* Table header */}
      <Box sx={{
        display: 'grid',
        gridTemplateColumns: 'repeat(6, 1fr)',
        gap: 1,
        px: 2,
        py: 1.5,
        borderRadius: 1,
        bgcolor: 'background.default',
        position: 'sticky',
        top: 0,
        zIndex: 2,
        mb: 1,
      }}>
        <Typography variant="caption" fontWeight={700} color="text.secondary">TITLE</Typography>
        <Typography variant="caption" fontWeight={700} color="text.secondary">PAID BY</Typography>
        <Typography variant="caption" fontWeight={700} color="text.secondary">TYPE</Typography>
        <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textAlign: 'right' }}>AMOUNT</Typography>
        <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textAlign: 'center' }}>SPLIT</Typography>
        <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textAlign: 'center' }}>STATUS</Typography>
      </Box>

      {/* Rows */}
      {expenses.map((expense) => {
        const paid = Boolean(expense.deleted_at);
        return (
          <Box
            key={expense.id}
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(6, 1fr)',
              gap: 1,
              alignItems: 'center',
              py: 2,
              px: 2,
              borderRadius: 2,
              mb: 0.5,
              bgcolor: 'background.paper',
              border: 1,
              borderColor: 'divider',
              transition: 'background-color 0.15s',
              '&:hover': { bgcolor: alpha('#fff', 0.03) },
            }}
          >
            {/* Title */}
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2" fontWeight={600} noWrap>
                {expense.title}
              </Typography>
            </Box>

            {/* Paid by */}
            <Typography variant="body2" color="text.secondary" noWrap>
              {getPayerName(expense.paid_by)}
            </Typography>

            {/* Type */}
            <Typography variant="body2" color="text.secondary" noWrap>
              {formatType(expense.split_type)}
            </Typography>

            {/* Amount */}
            <Typography variant="body2" fontWeight={700} color="primary.main" sx={{ textAlign: 'right' }}>
              €{(expense.amount_cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </Typography>

            {/* Split avatars */}
            <Box sx={{ display: 'flex', justifyContent: 'center' }}>
              <Box sx={{ display: 'flex' }}>
                {members.slice(0, 4).map((member, mi) => (
                  <Tooltip key={member.id} title={member.user_name || member.user_email || 'Unknown'} arrow>
                    <Box
                      sx={{
                        width: 24,
                        height: 24,
                        borderRadius: '50%',
                        bgcolor: 'primary.main',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.6rem',
                        fontWeight: 700,
                        ml: mi === 0 ? 0 : -0.75,
                        border: '2px solid',
                        borderColor: 'background.paper',
                        cursor: 'default',
                      }}
                    >
                      {(member.user_name || member.user_email || '?').charAt(0).toUpperCase()}
                    </Box>
                  </Tooltip>
                ))}
                {members.length > 4 && (
                  <Box
                    sx={{
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      bgcolor: 'text.secondary',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.55rem',
                      fontWeight: 700,
                      ml: -0.75,
                      border: '2px solid',
                      borderColor: 'background.paper',
                    }}
                  >
                    +{members.length - 4}
                  </Box>
                )}
              </Box>
            </Box>

            {/* Status */}
            <Box sx={{ display: 'flex', justifyContent: 'center' }}>
              <Chip
                icon={paid ? <CheckCircleIcon sx={{ fontSize: 16 }} /> : <WarningIcon sx={{ fontSize: 16 }} />}
                label={paid ? 'Paid' : 'Pending'}
                size="small"
                color={paid ? 'success' : 'warning'}
                variant="outlined"
                sx={{
                  fontWeight: 600,
                  fontSize: '0.7rem',
                  '& .MuiChip-icon': { ml: 0.5 },
                }}
              />
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}
