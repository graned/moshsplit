import { Box } from '@mui/material';

import { MobileDrawer } from '../../shared/MobileDrawer';
import { AddExpenseWizard, ExpenseEditData } from '../shared/AddExpenseWizard';
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
  expenseToEdit?: (ExpenseEditData & { id: string }) | null;
}

export function AddExpenseDrawer({
  open,
  onClose,
  eventId,
  members,
  currentUser,
  groupCurrency,
  onSuccess,
  expenseToEdit,
}: AddExpenseDrawerProps) {
  const { createExpense, updateExpense, clearError } = useExpenseStore();

  const handleSubmit = async (data: CreateExpenseRequest) => {
    if (expenseToEdit) {
      await updateExpense(eventId, expenseToEdit.id, data);
    } else {
      await createExpense(eventId, data);
    }
  };

  return (
    <MobileDrawer
      open={open}
      onClose={onClose}
      title={expenseToEdit ? 'Edit Financial Damage' : 'Deploy Financial Damage'}
      onOpen={clearError}
      fullScreen
    >
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <AddExpenseWizard
          key={expenseToEdit?.id ?? 'create'}
          members={members}
          currentUser={currentUser}
          groupCurrency={groupCurrency}
          onSubmit={handleSubmit}
          onSuccess={() => {
            onSuccess?.();
            onClose();
          }}
          onCancel={onClose}
          initialData={expenseToEdit ?? undefined}
          mode={expenseToEdit ? 'edit' : 'create'}
        />
      </Box>
    </MobileDrawer>
  );
}
