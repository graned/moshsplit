import { useEffect } from 'react';
import { Drawer, Box, Typography, IconButton, alpha, useTheme, useMediaQuery } from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';

import { AddExpenseWizard } from '../shared/AddExpenseWizard';
import { useExpenseStore } from '../../../stores/expenseStore';
import { CreateExpenseRequest } from '../../../api/expenses.api';
import { GroupMember } from '../../../api/groups.api';

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
  const isSmall = useMediaQuery(theme.breakpoints.down('sm'));
  const { createExpense, clearError } = useExpenseStore();

  useEffect(() => {
    if (open) clearError();
  }, [open, clearError]);

  const handleSubmit = async (data: CreateExpenseRequest) => {
    await createExpense(eventId, data);
  };

  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      slotProps={{
        backdrop: {
          sx: {
            bgcolor: 'rgba(0, 0, 0, 0.6)',
          },
        },
      }}
      sx={{
        '& .MuiDrawer-paper': {
          bgcolor: '#1A1A1A',
          borderTopLeftRadius: isSmall ? 20 : 24,
          borderTopRightRadius: isSmall ? 20 : 24,
          maxHeight: isSmall ? '92dvh' : '85vh',
          height: isSmall ? 'auto' : 'auto',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        },
      }}
    >
      {/* Grab handle */}
      <Box
        sx={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          px: 2,
          pt: 1.5,
          pb: 0.5,
          flexShrink: 0,
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            top: 8,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 36,
            height: 4,
            borderRadius: 2,
            bgcolor: alpha('#fff', 0.15),
          }}
        />
        <IconButton
          onClick={onClose}
          size="small"
          sx={{
            color: 'text.secondary',
            width: 32,
            height: 32,
            '&:hover': { color: 'text.primary', bgcolor: 'action.hover' },
          }}
        >
          <CloseIcon sx={{ fontSize: 20 }} />
        </IconButton>
      </Box>

      {/* Title */}
      <Box
        sx={{
          px: 2,
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
            fontSize: isSmall ? '1.1rem' : '1.25rem',
            background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          Deploy Financial Damage
        </Typography>
      </Box>

      {/* Wizard content */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          overflow: 'hidden',
          px: 2,
          pb: 0,
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
