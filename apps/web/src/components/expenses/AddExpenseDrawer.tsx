import { Drawer, Box, Typography, IconButton, alpha, useTheme } from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';

import { AddExpenseWizard } from './AddExpenseWizard';
import { expensesApi, CreateExpenseRequest } from '../../api/expenses.api';
import { GroupMember } from '../../api/groups.api';

interface AddExpenseDrawerProps {
  open: boolean;
  onClose: () => void;
  eventId: string;
  members: GroupMember[];
  currentUser: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  groupCurrency?: string;
  onSuccess?: () => void;
}

export function AddExpenseDrawer({
  open,
  onClose,
  eventId,
  members,
  currentUser,
  groupCurrency,
  onSuccess,
}: AddExpenseDrawerProps) {
  const theme = useTheme();

  const handleSubmit = async (data: CreateExpenseRequest) => {
    await expensesApi.create(eventId, data);
  };

  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      sx={{
        '& .MuiDrawer-paper': {
          bgcolor: '#1A1A1A',
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          maxHeight: '90dvh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 10,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 40,
            height: 4,
            borderRadius: 2,
            bgcolor: alpha('#534434', 0.4),
          },
        },
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2,
          pt: 3,
          pb: 1.5,
          borderBottom: 1,
          borderColor: 'divider',
          flexShrink: 0,
        }}
      >
        <Typography
          variant="h6"
          fontWeight={700}
          sx={{
            background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          Deploy Financial Damage
        </Typography>
        <IconButton
          onClick={onClose}
          size="small"
          sx={{
            color: 'text.secondary',
            '&:hover': { color: 'text.primary', bgcolor: 'action.hover' },
          }}
        >
          <CloseIcon />
        </IconButton>
      </Box>

      <Box
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          overflow: 'hidden',
          p: 2,
        }}
      >
        <AddExpenseWizard
          members={members}
          currentUser={currentUser}
          groupCurrency={groupCurrency}
          onSubmit={handleSubmit}
          onSuccess={() => {
            onSuccess?.();
            onClose();
          }}
          onCancel={onClose}
        />
      </Box>
    </Drawer>
  );
}
