import { Dialog, Box, Typography, useMediaQuery, useTheme, IconButton } from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';

import { AddExpenseWizard } from './AddExpenseWizard';
import { expensesApi, CreateExpenseRequest } from '../../api/expenses.api';
import { GroupMember } from '../../api/groups.api';

interface AddExpenseDialogProps {
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

/**
 * AddExpenseDialog: Dialog wrapper for the AddExpenseWizard.
 * - Mobile: full-screen modal
 * - Desktop: centered dialog (max-width 560px)
 * - Dark theme with amber accents
 */
export function AddExpenseDialog({
  open,
  onClose,
  eventId,
  members,
  currentUser,
  groupCurrency,
  onSuccess,
}: AddExpenseDialogProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const handleSubmit = async (data: CreateExpenseRequest) => {
    await expensesApi.create(eventId, data);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen={isMobile}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: 'background.default',
          borderRadius: isMobile ? 0 : 3,
          m: isMobile ? 0 : undefined,
          maxHeight: isMobile ? '100%' : '85vh',
          height: isMobile ? '100%' : 'auto',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          minHeight: 0,
        },
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2,
          py: 1.5,
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

      {/* Wizard */}
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
    </Dialog>
  );
}
