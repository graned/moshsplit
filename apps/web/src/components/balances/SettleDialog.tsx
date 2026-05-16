import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  TextField,
  Avatar,
  alpha,
  CircularProgress,
} from '@mui/material';
import { Gavel as GavelIcon } from '@mui/icons-material';

interface SettleDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (amountCents: number) => Promise<void>;
  fromUserId: string;
  toUserId: string;
  fromUserName?: string;
  toUserName?: string;
  defaultAmountCents: number;
  currency?: string;
  isPending: boolean;
}

/**
 * SettleDialog: Modal to record a settlement between two users.
 * Pre-fills the full balance amount and allows adjustment.
 */
export function SettleDialog({
  open,
  onClose,
  onConfirm,
  fromUserId,
  toUserId,
  fromUserName,
  toUserName,
  defaultAmountCents,
  currency = 'USD',
  isPending,
}: SettleDialogProps) {
  const [amount, setAmount] = useState('');

  const formatAmount = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(cents / 100);
  };

  const defaultAmountStr = (defaultAmountCents / 100).toFixed(2);

  // Reset amount when dialog opens
  useEffect(() => {
    if (open) {
      setAmount(defaultAmountStr);
    }
  }, [open, defaultAmountStr]);

  const handleConfirm = async () => {
    const parsed = parseFloat(amount);
    if (isNaN(parsed) || parsed <= 0) return;
    const cents = Math.round(parsed * 100);
    await onConfirm(cents);
  };

  const fromName = fromUserName || fromUserId.slice(0, 8);
  const toName = toUserName || toUserId.slice(0, 8);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          border: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
        },
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          pb: 1,
        }}
      >
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            bgcolor: alpha('#f59e0b', 0.15),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'warning.main',
          }}
        >
          <GavelIcon />
        </Box>
        <Box>
          <Typography variant="h6" fontWeight={700}>
            Record Settlement
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Settle the balance between members
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent>
        {/* Parties */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2,
            mb: 3,
            p: 2,
            borderRadius: 2,
            bgcolor: alpha('#f8fafc', 0.03),
            border: 1,
            borderColor: 'divider',
          }}
        >
          <Box sx={{ textAlign: 'center' }}>
            <Avatar
              sx={{
                width: 40,
                height: 40,
                bgcolor: 'error.main',
                color: '#121212',
                fontWeight: 700,
                mx: 'auto',
                mb: 0.5,
              }}
            >
              {fromName.charAt(0).toUpperCase()}
            </Avatar>
            <Typography variant="body2" fontWeight={600} noWrap>
              {fromName}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              pays
            </Typography>
          </Box>

          <Typography variant="h5" fontWeight={800} color="warning.main" sx={{ px: 1 }}>
            →
          </Typography>

          <Box sx={{ textAlign: 'center' }}>
            <Avatar
              sx={{
                width: 40,
                height: 40,
                bgcolor: 'success.main',
                color: '#121212',
                fontWeight: 700,
                mx: 'auto',
                mb: 0.5,
              }}
            >
              {toName.charAt(0).toUpperCase()}
            </Avatar>
            <Typography variant="body2" fontWeight={600} noWrap>
              {toName}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              receives
            </Typography>
          </Box>
        </Box>

        {/* Amount */}
        <Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1, fontWeight: 600 }}>
            Amount
          </Typography>
          <TextField
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            fullWidth
            inputProps={{
              step: 0.01,
              min: 0,
              style: { fontSize: '1.25rem', fontWeight: 700, textAlign: 'center' },
            }}
            sx={{
              '& .MuiFilledInput-root': {
                bgcolor: alpha('#f8fafc', 0.04),
                borderRadius: 2,
              },
            }}
          />
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1, textAlign: 'center' }}>
            Full balance: {formatAmount(defaultAmountCents)}
          </Typography>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={onClose} variant="outlined" disabled={isPending} sx={{ borderRadius: 2 }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          color="warning"
          onClick={handleConfirm}
          disabled={isPending || !amount || parseFloat(amount) <= 0 || parseFloat(amount) > defaultAmountCents / 100}
          sx={{
            borderRadius: 2,
            fontWeight: 700,
            px: 4,
          }}
        >
          {isPending ? <CircularProgress size={20} color="inherit" /> : 'Confirm Settlement'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
