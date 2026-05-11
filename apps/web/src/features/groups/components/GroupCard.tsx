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
  Group as MembersIcon,
  AttachMoney as CurrencyIcon,
} from '@mui/icons-material';
import { GroupListItem } from '../../../api/groups.api';

interface GroupCardProps {
  group: GroupListItem;
  onClick: () => void;
  onDelete?: () => void;
}

export function GroupCard({ group, onClick, onDelete }: GroupCardProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return 'success';
      case 'archived':
        return 'default';
      case 'deleted':
        return 'error';
      default:
        return 'default';
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
      }}
      onClick={onClick}
    >
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" fontWeight={600} gutterBottom>
              {group.name}
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <MembersIcon fontSize="small" color="action" />
                <Typography variant="body2" color="text.secondary">
                  {group.member_count} member{group.member_count !== 1 ? 's' : ''}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <CurrencyIcon fontSize="small" color="action" />
                <Typography variant="body2" color="text.secondary">
                  {group.currency}
                </Typography>
              </Box>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Chip
              label={group.status}
              size="small"
              color={getStatusColor(group.status)}
              variant="outlined"
            />
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