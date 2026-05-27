import { Box } from '@mui/material';

import { MobileDrawer } from '../../shared/MobileDrawer';
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
  const { createExpense, clearError } = useExpenseStore();

  const handleSubmit = async (data: CreateExpenseRequest) => {
    await createExpense(eventId, data);
  };

  return (
    <MobileDrawer
      open={open}
      onClose={onClose}
      title="Deploy Financial Damage"
      onOpen={clearError}
      fullScreen
    >
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
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
    </MobileDrawer>
  );
}
