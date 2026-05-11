import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Typography,
  FormControlLabel,
  Checkbox,
} from '@mui/material';
import { GroupMember } from '../../../api/groups.api';
import { CreateExpenseRequest } from '../../../api/expenses.api';

interface AddExpenseDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: CreateExpenseRequest) => Promise<void>;
  members: GroupMember[];
  currentUserId: string;
  groupCurrency?: string;
}

const SPLIT_TYPES = [
  { value: 'equal', label: 'Split equally' },
  { value: 'custom', label: 'Custom amounts' },
  { value: 'percentage', label: 'By percentage' },
  { value: 'shares', label: 'By shares' },
];

export function AddExpenseDialog({
  open,
  onClose,
  onSubmit,
  members,
  currentUserId,
  groupCurrency = 'USD',
}: AddExpenseDialogProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [paidBy, setPaidBy] = useState(currentUserId);
  const [splitType, setSplitType] = useState('equal');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // For "equal" split - include all members by default
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(
    new Set(members.map((m) => m.user_id))
  );

  // For custom/percentage/shares splits
  const [splitValues, setSplitValues] = useState<Record<string, string>>({});

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: groupCurrency,
    }).format(value);
  };

  const handleAmountChange = (value: string) => {
    // Allow only valid decimal input
    const cleaned = value.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    if (parts.length > 2) return;
    if (parts[1] && parts[1].length > 2) return;
    setAmount(cleaned);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      setError('Title is required');
      return;
    }

    const amountCents = Math.round(parseFloat(amount || '0') * 100);
    if (amountCents <= 0) {
      setError('Amount must be greater than 0');
      return;
    }

    if (!paidBy) {
      setError('Please select who paid');
      return;
    }

    if (selectedMembers.size === 0) {
      setError('Please select at least one member to split with');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Build split_data based on split type
      let splitData: Record<string, unknown> = {};

      switch (splitType) {
        case 'equal':
          splitData = {
            shares: Array.from(selectedMembers),
          };
          break;
        case 'custom':
          splitData = {
            shares: splitValues,
          };
          // Validate custom amounts sum to total
          const customTotal = Object.values(splitValues).reduce(
            (sum, val) => sum + (parseFloat(val) || 0),
            0
          );
          if (Math.abs(customTotal - parseFloat(amount)) > 0.01) {
            throw new Error('Custom amounts must sum to total');
          }
          break;
        case 'percentage':
          splitData = {
            percentages: splitValues,
          };
          break;
        case 'shares':
          splitData = {
            shares: splitValues,
          };
          break;
      }

      await onSubmit({
        user_id: currentUserId,
        title: title.trim(),
        description: description.trim() || undefined,
        amount_cents: amountCents,
        paid_by: paidBy,
        split_type: splitType,
        split_data: splitData,
        notes: notes.trim() || undefined,
      });

      // Reset form
      resetForm();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add expense');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setAmount('');
    setPaidBy(currentUserId);
    setSplitType('equal');
    setNotes('');
    setSelectedMembers(new Set(members.map((m) => m.user_id)));
    setSplitValues({});
    setError('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const toggleMember = (userId: string) => {
    const newSelected = new Set(selectedMembers);
    if (newSelected.has(userId)) {
      newSelected.delete(userId);
    } else {
      newSelected.add(userId);
    }
    setSelectedMembers(newSelected);
  };

  // Calculate equal share for display
  const amountCents = Math.round(parseFloat(amount || '0') * 100);
  const equalShare = selectedMembers.size > 0 ? amountCents / selectedMembers.size : 0;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <form onSubmit={handleSubmit}>
        <DialogTitle>Add Expense</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              label="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              fullWidth
              required
              autoFocus
            />

            <TextField
              label="Description (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              fullWidth
              multiline
              rows={2}
            />

            <TextField
              label="Amount"
              value={amount}
              onChange={(e) => handleAmountChange(e.target.value)}
              fullWidth
              required
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              helperText={amount ? formatCurrency(parseFloat(amount)) : ''}
            />

            <FormControl fullWidth>
              <InputLabel>Paid by</InputLabel>
              <Select
                value={paidBy}
                label="Paid by"
                onChange={(e) => setPaidBy(e.target.value)}
              >
                {members.map((member) => (
                  <MenuItem key={member.user_id} value={member.user_id}>
                    {member.user_name || member.user_email || member.user_id}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>Split type</InputLabel>
              <Select
                value={splitType}
                label="Split type"
                onChange={(e) => setSplitType(e.target.value)}
              >
                {SPLIT_TYPES.map((type) => (
                  <MenuItem key={type.value} value={type.value}>
                    {type.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Member selection */}
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Split with
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {members.map((member) => (
                  <FormControlLabel
                    key={member.user_id}
                    control={
                      <Checkbox
                        checked={selectedMembers.has(member.user_id)}
                        onChange={() => toggleMember(member.user_id)}
                        size="small"
                      />
                    }
                    label={member.user_name || member.user_email || member.user_id}
                  />
                ))}
              </Box>
              {splitType === 'equal' && amount && selectedMembers.size > 0 && (
                <Typography variant="caption" color="text.secondary">
                  Each owes: {formatCurrency(equalShare / 100)}
                </Typography>
              )}
            </Box>

            <TextField
              label="Notes (optional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              fullWidth
              multiline
              rows={2}
            />

            {error && (
              <Typography variant="body2" color="error">
                {error}
              </Typography>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={loading}>
            {loading ? 'Adding...' : 'Add Expense'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}