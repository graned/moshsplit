import { useState, useCallback, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  IconButton,
  TextField,
  Avatar,
  CircularProgress,
  alpha,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  Close as CloseIcon,
  AccountBalanceWallet as WalletIcon,
  KeyboardTab as PartialIcon,
  DoneAll as DoneAllIcon,
} from '@mui/icons-material';
import { usePaymentStore } from '../../stores/paymentStore';
import { CreatePaymentRequest } from '../../api/payments.api';
import { UserInfo } from '../../api/users.api';

const formatAmount = (cents: number, currency = 'EUR') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Math.abs(cents) / 100);

interface RestoreHonorModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  toUser: string;
  toUserInfo?: UserInfo;
  totalOwedCents: number;
  currency: string;
  eventId: string;
  fromUserId: string;
  expense_id?: string;
}

type SettleMode = 'full' | 'partial';

export function RestoreHonorModal({
  open,
  onClose,
  onSuccess,
  toUser,
  toUserInfo,
  totalOwedCents,
  currency,
  eventId,
  fromUserId,
  expense_id,
}: RestoreHonorModalProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [mode, setMode] = useState<SettleMode>('full');
  const [amount, setAmount] = useState(totalOwedCents / 100);
  const [note, setNote] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const { createPayment, isCreating, error, clearError } = usePaymentStore();

  useEffect(() => {
    if (open) {
      clearError();
      setAmount(totalOwedCents / 100);
      setMode('full');
      setNote('');
    }
  }, [open, clearError, totalOwedCents]);

  const recipientName = toUserInfo
    ? `${toUserInfo.firstName} ${toUserInfo.lastName}`.trim() || toUserInfo.email
    : toUser.slice(0, 8);

  const handleAmountChange = (value: string) => {
    const num = parseFloat(value);
    if (!isNaN(num) && num >= 0) {
      setAmount(num);
      setMode('partial');
    }
  };

  const handleSettleAll = () => {
    setAmount(totalOwedCents / 100);
    setMode('full');
  };

  const handleSubmit = useCallback(async () => {
    if (amount <= 0) return;

    try {
      const req: CreatePaymentRequest = {
        creditor_id: toUser,
        debtor_id: fromUserId,
        amount_cents: Math.round(amount * 100),
        reason: 'settlement',
        expense_id: expense_id ?? undefined,
      };

      await createPayment(eventId, req);
      setShowSuccess(true);
    } catch (err) {
      // Error is stored in the store's error state
    }
  }, [amount, note, fromUserId, toUser, eventId, createPayment, expense_id]);

  const handleSuccessClose = () => {
    setShowSuccess(false);
    onSuccess();
    setNote('');
    setAmount(totalOwedCents / 100);
    setMode('full');
  };

  const handleClose = () => {
    if (!isCreating) {
      setShowSuccess(false);
      onClose();
    }
  };

  // Success state
  if (showSuccess) {
    return (
      <Dialog
        open={open}
        onClose={handleClose}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            border: `1px solid ${alpha('#F59E0B', 0.2)}`,
            bgcolor: '#121212',
            backgroundImage: 'none',
          },
        }}
      >
        <DialogContent sx={{ p: 0 }}>
          <Box sx={{ textAlign: 'center', py: 6, px: 3 }}>
            <Box
              sx={{
                width: 96,
                height: 96,
                borderRadius: '50%',
                bgcolor: alpha('#F59E0B', 0.1),
                border: `2px solid ${alpha('#F59E0B', 0.3)}`,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                mb: 3,
                boxShadow: `0 0 15px ${alpha('#F59E0B', 0.15)}`,
              }}
            >
              <DoneAllIcon sx={{ fontSize: 48, color: 'primary.main' }} />
            </Box>

            <Typography variant="h4" fontWeight={700} color="primary.main" sx={{ mb: 1 }}>
              Honor Restored
            </Typography>

            <Typography variant="body1" color="text.secondary" sx={{ mb: 4, maxWidth: 280, mx: 'auto' }}>
              The pit is balanced once more. {recipientName} has been paid in full.
            </Typography>

            <Box
              sx={{
                bgcolor: 'elevated.main',
                border: `1px solid ${alpha('#fff', 0.1)}`,
                borderRadius: 2,
                p: 2,
                mb: 4,
                maxWidth: 320,
                mx: 'auto',
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1, pb: 1, borderBottom: `1px solid ${alpha('#fff', 0.05)}` }}>
                <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ letterSpacing: '0.05em' }}>
                  SETTLEMENT REQUEST SENT
                </Typography>
                <Typography variant="caption" color="primary.main" fontWeight={700}>
                  PENDING
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary">
                  {recipientName} will receive
                </Typography>
                <Typography variant="body2" color="primary.main" fontWeight={700}>
                  {formatAmount(Math.round(amount * 100), currency)}
                </Typography>
              </Box>
            </Box>

            <Button
              variant="outlined"
              onClick={handleSuccessClose}
              sx={{
                borderColor: alpha('#fff', 0.1),
                color: 'text.primary',
                px: 4,
                py: 1.5,
                '&:hover': {
                  borderColor: 'primary.main',
                  bgcolor: alpha('#F59E0B', 0.1),
                },
              }}
            >
              BACK TO FEED
            </Button>
          </Box>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      fullScreen={isMobile}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: { xs: 0, sm: 3 },
          border: `1px solid ${alpha('#F59E0B', 0.2)}`,
          bgcolor: '#121212',
          backgroundImage: 'none',
        },
      }}
    >
      {/* Header */}
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
        <IconButton onClick={handleClose} size="small" sx={{ color: 'text.secondary' }}>
          <CloseIcon />
        </IconButton>

        <Box sx={{ textAlign: 'center', flex: 1 }}>
          <Typography variant="caption" color="primary.main" fontWeight={700} sx={{ display: 'block', letterSpacing: '0.1em' }}>
            SETTLEMENT
          </Typography>
          <Typography variant="h6" fontWeight={600}>{recipientName}</Typography>
        </Box>

        <Box sx={{ width: 40 }} />
      </DialogTitle>

      {/* Content */}
      <DialogContent sx={{ px: 3, pt: 2 }}>
        {/* Amount Section */}
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ display: 'block', mb: 1, letterSpacing: '0.05em' }}>
            AMOUNT TO SETTLE
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 0.5 }}>
            <Typography variant="h4" color="text.secondary" fontWeight={700}>
              {currency}
            </Typography>
            <TextField
              type="number"
              value={amount}
              onChange={(e) => handleAmountChange(e.target.value)}
              inputProps={{
                step: '0.01',
                min: '0',
                sx: {
                  textAlign: 'center',
                  MozAppearance: 'textfield',
                  '&::-webkit-outer-spin-button, &::-webkit-inner-spin-button': {
                    WebkitAppearance: 'none',
                    margin: 0,
                  },
                },
              }}
              sx={{
                width: 160,
                '& .MuiInputBase-root': {
                  bgcolor: 'transparent',
                  border: 'none',
                  '&::before, &::after, &::notched-outline': { display: 'none' },
                },
                '& .MuiInputBase-input': {
                  color: 'primary.main',
                  fontSize: '2rem',
                  fontWeight: 700,
                  p: 0,
                },
              }}
            />
          </Box>
        </Box>

        {/* Options Grid */}
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mb: 4 }}>
          <Button
            onClick={handleSettleAll}
            sx={{
              p: 2,
              flexDirection: 'column',
              gap: 1,
              borderRadius: 2,
              border: mode === 'full' ? `1px solid ${alpha('#F59E0B', 0.5)}` : `1px solid ${alpha('#fff', 0.1)}`,
              bgcolor: mode === 'full' ? alpha('#F59E0B', 0.1) : 'transparent',
              '&:hover': { bgcolor: mode === 'full' ? alpha('#F59E0B', 0.15) : alpha('#fff', 0.05) },
            }}
          >
            <WalletIcon sx={{ fontSize: 24, color: mode === 'full' ? 'primary.main' : 'text.secondary' }} />
            <Typography variant="caption" fontWeight={700} color={mode === 'full' ? 'primary.main' : 'text.secondary'}>
              Settle All
            </Typography>
          </Button>

          <Button
            onClick={() => setMode('partial')}
            sx={{
              p: 2,
              flexDirection: 'column',
              gap: 1,
              borderRadius: 2,
              border: mode === 'partial' ? `1px solid ${alpha('#F59E0B', 0.5)}` : `1px solid ${alpha('#fff', 0.1)}`,
              bgcolor: mode === 'partial' ? alpha('#F59E0B', 0.1) : 'transparent',
              '&:hover': { bgcolor: mode === 'partial' ? alpha('#F59E0B', 0.15) : alpha('#fff', 0.05) },
            }}
          >
            <PartialIcon sx={{ fontSize: 24, color: mode === 'partial' ? 'primary.main' : 'text.secondary' }} />
            <Typography variant="caption" fontWeight={700} color={mode === 'partial' ? 'primary.main' : 'text.secondary'}>
              Partial
            </Typography>
          </Button>
        </Box>

        {/* Notes Field */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ display: 'block', mb: 1, ml: 1, letterSpacing: '0.05em' }}>
            THE PARTING WORD
          </Typography>
          <TextField
            multiline
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add a message to the council..."
            fullWidth
            sx={{
              '& .MuiFilledInput-root': {
                bgcolor: 'elevated.main',
                borderRadius: 2,
                border: `1px solid ${alpha('#fff', 0.05)}`,
                '&:hover': { bgcolor: 'elevated.main' },
                '&.Mui-focused': {
                  borderColor: 'primary.main',
                  boxShadow: `0 0 0 2px ${alpha('#F59E0B', 0.2)}`,
                },
              },
              '& .MuiFilledInput-input': {
                color: 'text.primary',
                '&::placeholder': { color: 'text.secondary', opacity: 0.5 },
              },
            }}
          />
        </Box>

        {/* Context Card */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            p: 2,
            borderRadius: 2,
            border: `1px solid ${alpha('#fff', 0.1)}`,
            bgcolor: 'surface.main',
          }}
        >
          <Avatar
            sx={{
              width: 48,
              height: 48,
              bgcolor: 'primary.main',
              color: '#121212',
              fontWeight: 700,
              border: `1px solid ${alpha('#fff', 0.1)}`,
            }}
          >
            {recipientName.charAt(0).toUpperCase()}
          </Avatar>
          <Box>
            <Typography variant="body2" fontWeight={600}>
              Restoring honor to {recipientName}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Awaiting their verdict
            </Typography>
          </Box>
        </Box>

        {error && (
          <Typography variant="body2" color="error.main" sx={{ mt: 2, textAlign: 'center' }}>
            {error}
          </Typography>
        )}
      </DialogContent>

      {/* CTA */}
      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button
          fullWidth
          variant="contained"
          onClick={handleSubmit}
          disabled={isCreating || amount <= 0}
          sx={{
            height: 56,
            borderRadius: 2,
            bgcolor: 'primary.main',
            color: '#121212',
            fontWeight: 800,
            letterSpacing: '0.05em',
            fontSize: '1rem',
            boxShadow: `0 0 15px ${alpha('#F59E0B', 0.15)}`,
            '&:hover': { bgcolor: 'primary.dark' },
            '&:disabled': { bgcolor: alpha('#F59E0B', 0.3), color: alpha('#121212', 0.5) },
          }}
        >
          {isCreating ? <CircularProgress size={24} color="inherit" /> : 'REQUEST HONOR RESTORATION'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
