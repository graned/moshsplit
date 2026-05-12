import { useState, useEffect } from 'react';
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
  Chip,
  IconButton,
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { UserSelect } from '../../../components/UserSelect';
import { Group, GroupMember, UpdateGroupRequest } from '../../../api/groups.api';

interface EditEventDialogProps {
  open: boolean;
  onClose: () => void;
  event: Group | null;
  members: GroupMember[];
  currentUserId: string;
  onUpdate: (eventId: string, data: UpdateGroupRequest) => Promise<void>;
  onAddMember: (eventId: string, userId: string) => Promise<void>;
  onRemoveMember: (eventId: string, userId: string) => Promise<void>;
}

const CURRENCIES = ['EUR', 'USD', 'GBP', 'BRL', 'JPY', 'CAD', 'AUD'];

export function EditEventDialog({
  open,
  onClose,
  event,
  members,
  currentUserId,
  onUpdate,
  onAddMember,
  onRemoveMember,
}: EditEventDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [currency, setCurrency] = useState('EUR');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [newMembers, setNewMembers] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Reset form when event changes
  useEffect(() => {
    if (event) {
      setName(event.name);
      setDescription(event.description || '');
      setCurrency(event.currency);
      setSelectedMembers(members.map((m) => m.user_id));
    }
  }, [event, members]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Group name is required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await onUpdate(event!.id, {
        user_id: currentUserId,
        name: name.trim(),
        description: description.trim() || undefined,
        currency,
      });

      // Add new members
      const existingMemberIds = members.map((m) => m.user_id);
      for (const userId of newMembers) {
        if (!existingMemberIds.includes(userId)) {
          await onAddMember(event!.id, userId);
        }
      }

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update group');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!event) return;
    try {
      await onRemoveMember(event.id, userId);
      setSelectedMembers((prev) => prev.filter((id) => id !== userId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove member');
    }
  };

  const handleClose = () => {
    setName('');
    setDescription('');
    setCurrency('EUR');
    setSelectedMembers([]);
    setNewMembers([]);
    setError('');
    onClose();
  };

  if (!event) return null;

  const isArchived = event.status === 'archived' || event.status === 'deleted';

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <form onSubmit={handleSubmit}>
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {isArchived ? 'Restore Event' : 'Edit Event'}
            <IconButton onClick={handleClose} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              label="Group Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              fullWidth
              required
              disabled={isArchived}
            />
            <TextField
              label="Description (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              fullWidth
              multiline
              rows={2}
              disabled={isArchived}
            />
            <FormControl fullWidth disabled={isArchived}>
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

            {/* Current members */}
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Current Members ({members.length})
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {members.map((member) => (
                  <Chip
                    key={member.user_id}
                    label={member.user_name || member.user_email || member.user_id}
                    onDelete={
                      member.user_id !== currentUserId && !isArchived
                        ? () => handleRemoveMember(member.user_id)
                        : undefined
                    }
                    color={member.user_id === currentUserId ? 'primary' : 'default'}
                  />
                ))}
                {members.length === 0 && (
                  <Typography variant="body2" color="text.secondary">
                    No members
                  </Typography>
                )}
              </Box>
            </Box>

            {/* Add new members - only if not archived */}
            {!isArchived && (
              <UserSelect
                label="Add members"
                placeholder="Search and select members"
                value={newMembers}
                onChange={setNewMembers}
              />
            )}

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
          {isArchived ? (
            <Button
              type="submit"
              variant="contained"
              color="success"
              disabled={loading}
            >
                {loading ? 'Restoring...' : 'Restore Event'}
              </Button>
            ) : (
              <Button type="submit" variant="contained" disabled={loading}>
                {loading ? 'Saving...' : 'Save Changes'}
              </Button>
            )}
          </DialogActions>
      </form>
    </Dialog>
  );
}