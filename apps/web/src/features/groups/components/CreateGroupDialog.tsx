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
} from '@mui/material';

interface CreateGroupDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string; description?: string; currency: string }) => Promise<void>;
}

const CURRENCIES = ['EUR', 'USD', 'GBP', 'BRL', 'JPY', 'CAD', 'AUD'];

export function CreateGroupDialog({ open, onClose, onSubmit }: CreateGroupDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [currency, setCurrency] = useState('EUR');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Group name is required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await onSubmit({
        name: name.trim(),
        description: description.trim() || undefined,
        currency,
      });
      // Reset form on success
      setName('');
      setDescription('');
      setCurrency('EUR');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create group');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setName('');
    setDescription('');
    setCurrency('EUR');
    setError('');
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <form onSubmit={handleSubmit}>
        <DialogTitle>Create New Group</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              label="Group Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              fullWidth
              required
              autoFocus
              error={!!error && !name.trim()}
              helperText={error && !name.trim() ? 'Name is required' : ''}
            />
            <TextField
              label="Description (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              fullWidth
              multiline
              rows={2}
            />
            <FormControl fullWidth>
              <InputLabel>Currency</InputLabel>
              <Select
                value={currency}
                label="Currency"
                onChange={(e) => setCurrency(e.target.value)}
              >
                {CURRENCIES.map((curr) => (
                  <MenuItem key={curr} value={curr}>
                    {curr}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
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
            {loading ? 'Creating...' : 'Create Group'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}