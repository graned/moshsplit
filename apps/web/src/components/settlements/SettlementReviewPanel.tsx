import { useState, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  Avatar,
  TextField,
  Chip,
  Divider,
  alpha,
  Dialog,
  DialogContent,
  IconButton,
  CircularProgress,
} from '@mui/material';
import {
  Close as CloseIcon,
  CheckCircle as ApproveIcon,
  Cancel as RejectIcon,
  Receipt as ProofIcon,
  ArrowForward as ArrowIcon,
} from '@mui/icons-material';
import { settlementsApi, SettlementListItem } from '../../api/settlements.api';
import { UserInfo } from '../../api/users.api';

const formatAmount = (cents: number, currency = 'EUR') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Math.abs(cents) / 100);

interface SettlementReviewPanelProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  settlement: SettlementListItem;
  fromUserInfo?: UserInfo;
  toUserInfo?: UserInfo;
  currency: string;
  eventId: string;
  currentUserId: string;
}

export function SettlementReviewPanel({
  open,
  onClose,
  onSuccess,
  settlement,
  fromUserInfo,
  toUserInfo,
  currency,
  eventId,
  currentUserId,
}: SettlementReviewPanelProps) {
  const [rejectionNote, setRejectionNote] = useState('');
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fromName = fromUserInfo
    ? `${fromUserInfo.firstName} ${fromUserInfo.lastName}`.trim() || fromUserInfo.email
    : settlement.from_user.slice(0, 8);

  const toName = toUserInfo
    ? `${toUserInfo.firstName} ${toUserInfo.lastName}`.trim() || toUserInfo.email
    : settlement.to_user.slice(0, 8);

  const isRecipient = settlement.to_user === currentUserId;

  const handleApprove = useCallback(async () => {
    if (!isRecipient) return;

    setIsApproving(true);
    setError(null);

    try {
      await settlementsApi.approve(eventId, settlement.id);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve settlement');
    } finally {
      setIsApproving(false);
    }
  }, [isRecipient, eventId, settlement.id, onSuccess]);

  const handleReject = useCallback(async () => {
    if (!isRecipient) return;

    setIsRejecting(true);
    setError(null);

    try {
      await settlementsApi.reject(eventId, settlement.id, rejectionNote.trim() || undefined);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject settlement');
    } finally {
      setIsRejecting(false);
    }
  }, [isRecipient, eventId, settlement.id, rejectionNote, onSuccess]);

  const time = new Date(settlement.created_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
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
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          px: 3,
          pt: 3,
          pb: 2,
        }}
      >
        <Box>
          <Typography variant="caption" color="primary.main" fontWeight={700} sx={{ display: 'block', letterSpacing: '0.1em' }}>
            SETTLEMENT REQUEST
          </Typography>
          <Typography variant="h6" fontWeight={600}>Review Claim</Typography>
        </Box>
        <IconButton onClick={onClose} sx={{ color: 'text.secondary' }}>
          <CloseIcon />
        </IconButton>
      </Box>

      <DialogContent sx={{ px: 3, pb: 3 }}>
        {/* Amount Display */}
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <Typography variant="h3" fontWeight={800} color="primary.main">
            {formatAmount(settlement.amount_cents, currency)}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Claimed amount
          </Typography>
        </Box>

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
            bgcolor: 'elevated.main',
            border: `1px solid ${alpha('#fff', 0.05)}`,
          }}
        >
          <Box sx={{ textAlign: 'center' }}>
            <Avatar
              sx={{
                width: 48,
                height: 48,
                bgcolor: 'primary.main',
                color: '#121212',
                fontWeight: 700,
                mx: 'auto',
                mb: 1,
              }}
            >
              {fromName.charAt(0).toUpperCase()}
            </Avatar>
            <Typography variant="body2" fontWeight={600}>{fromName}</Typography>
            <Typography variant="caption" color="text.secondary">Claims to have paid</Typography>
          </Box>

          <ArrowIcon sx={{ color: 'text.secondary', fontSize: 24 }} />

          <Box sx={{ textAlign: 'center' }}>
            <Avatar
              sx={{
                width: 48,
                height: 48,
                bgcolor: 'success.main',
                color: '#121212',
                fontWeight: 700,
                mx: 'auto',
                mb: 1,
              }}
            >
              {toName.charAt(0).toUpperCase()}
            </Avatar>
            <Typography variant="body2" fontWeight={600}>{toName}</Typography>
            <Typography variant="caption" color="text.secondary">Will receive</Typography>
          </Box>
        </Box>

        {/* Settlement Details */}
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="caption" color="text.secondary">Status</Typography>
            <Chip
              label="PENDING REVIEW"
              size="small"
              sx={{
                bgcolor: alpha('#F59E0B', 0.15),
                color: 'primary.main',
                fontWeight: 700,
                fontSize: '0.65rem',
                letterSpacing: '0.05em',
              }}
            />
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="caption" color="text.secondary">Requested</Typography>
            <Typography variant="caption">{time}</Typography>
          </Box>
          {settlement.note && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                Message from {fromName}
              </Typography>
              <Box
                sx={{
                  p: 1.5,
                  borderRadius: 1.5,
                  bgcolor: 'elevated.main',
                  border: `1px solid ${alpha('#fff', 0.05)}`,
                }}
              >
                <Typography variant="body2" sx={{ fontStyle: 'italic' }}>
                  "{settlement.note}"
                </Typography>
              </Box>
            </Box>
          )}
          {settlement.proof_url && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                Proof of payment
              </Typography>
              <Button
                startIcon={<ProofIcon />}
                href={settlement.proof_url}
                target="_blank"
                rel="noopener noreferrer"
                variant="outlined"
                size="small"
                sx={{
                  borderColor: alpha('#F59E0B', 0.3),
                  color: 'primary.main',
                  '&:hover': { borderColor: 'primary.main', bgcolor: alpha('#F59E0B', 0.05) },
                }}
              >
                View proof
              </Button>
            </Box>
          )}
        </Box>

        <Divider sx={{ borderColor: alpha('#fff', 0.05), mb: 3 }} />

        {/* Actions */}
        {isRecipient ? (
          <>
            {showRejectForm ? (
              <Box>
                <Typography variant="body2" fontWeight={600} sx={{ mb: 1.5 }}>
                  Reason for rejection (optional)
                </Typography>
                <TextField
                  multiline
                  rows={2}
                  value={rejectionNote}
                  onChange={(e) => setRejectionNote(e.target.value)}
                  placeholder="Explain why this claim is rejected..."
                  fullWidth
                  sx={{ mb: 2 }}
                />
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    variant="outlined"
                    onClick={() => setShowRejectForm(false)}
                    sx={{ flex: 1 }}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="contained"
                    onClick={handleReject}
                    disabled={isRejecting}
                    startIcon={isRejecting ? <CircularProgress size={20} /> : <RejectIcon />}
                    sx={{
                      flex: 1,
                      bgcolor: 'error.main',
                      '&:hover': { bgcolor: 'error.dark' },
                    }}
                  >
                    Confirm Reject
                  </Button>
                </Box>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Button
                  variant="outlined"
                  onClick={() => setShowRejectForm(true)}
                  disabled={isApproving}
                  startIcon={<RejectIcon />}
                  sx={{
                    flex: 1,
                    borderColor: alpha('#ef4444', 0.3),
                    color: 'error.main',
                    '&:hover': { borderColor: 'error.main', bgcolor: alpha('#ef4444', 0.05) },
                  }}
                >
                  Reject Claim
                </Button>
                <Button
                  variant="contained"
                  onClick={handleApprove}
                  disabled={isApproving}
                  startIcon={isApproving ? <CircularProgress size={20} color="inherit" /> : <ApproveIcon />}
                  sx={{
                    flex: 1,
                    bgcolor: 'primary.main',
                    color: '#121212',
                    fontWeight: 700,
                    '&:hover': { bgcolor: 'primary.dark' },
                  }}
                >
                  Honor Restored
                </Button>
              </Box>
            )}
          </>
        ) : (
          <Box sx={{ textAlign: 'center', py: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Only {toName} can approve or reject this claim.
            </Typography>
          </Box>
        )}

        {error && (
          <Typography variant="body2" color="error.main" sx={{ mt: 2, textAlign: 'center' }}>
            {error}
          </Typography>
        )}
      </DialogContent>
    </Dialog>
  );
}
