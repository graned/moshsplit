import { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  CircularProgress,
  alpha,
  useTheme,
} from '@mui/material';
import {
  AccountBalanceWallet as CreditIcon,
  Receipt as PaymentIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

import { DeletionRequiresChoiceResponse, expensesApi, ClaimReimbursementRequest } from '../../../api/expenses.api';
import { useExpenseStore } from '../../../stores/expenseStore';

interface ClaimReimbursementModalProps {
  open: boolean;
  deletionResponse: DeletionRequiresChoiceResponse | null;
  eventId: string;
  currency?: string;
  onClose: () => void;
  onComplete: () => void;
  formatAmount: (cents: number) => string;
}

export function ClaimReimbursementModal({
  open,
  deletionResponse,
  eventId,
  onClose,
  onComplete,
  formatAmount,
}: ClaimReimbursementModalProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { isDeleting } = useExpenseStore();
  const [selectedChoice, setSelectedChoice] = useState<ClaimReimbursementRequest['choice'] | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!open || !deletionResponse || !deletionResponse.requires_choice) return null;

  const { expense_id, open_payments, total_cents } = deletionResponse;

  const handleConfirm = async () => {
    if (!selectedChoice || open_payments.length === 0) return;
    setIsSubmitting(true);
    try {
      const payment = open_payments[0];
      await expensesApi.claimReimbursement(eventId, expense_id, {
        payment_id: payment.payment_id,
        choice: selectedChoice,
      });
      onComplete();
    } catch (err) {
      console.error('Failed to claim reimbursement:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBackdropClick = () => {
    if (!isSubmitting) {
      setSelectedChoice(null);
      onClose();
    }
  };

  const isDisabled = isSubmitting || isDeleting;

  return (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: theme.zIndex.modal + 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(4px)',
        p: 2,
      }}
      onClick={handleBackdropClick}
    >
      <Box
        sx={{
          bgcolor: 'background.paper',
          borderRadius: 3,
          maxWidth: 360,
          width: '100%',
          overflow: 'hidden',
          border: 1,
          borderColor: alpha(theme.palette.warning.main, 0.3),
          boxShadow: `0 0 40px ${alpha(theme.palette.warning.main, 0.15)}`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 1.5,
            p: 3,
            pb: 2,
          }}
        >
          <Box
            sx={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              bgcolor: alpha(theme.palette.warning.main, 0.12),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <CreditIcon sx={{ fontSize: 28, color: 'warning.main' }} />
          </Box>
          <Typography
            variant="h6"
            fontWeight={700}
            sx={{
              color: 'warning.main',
              textAlign: 'center',
            }}
          >
            {t('components.claimReimbursement.title')}
          </Typography>
        </Box>

        {/* Content */}
        <Box sx={{ px: 3, pb: 3 }}>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ textAlign: 'center', mb: 2 }}
          >
            {t('components.claimReimbursement.description')}
          </Typography>

          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ textAlign: 'center', mb: 2 }}
          >
            {t('components.claimReimbursement.totalOpen', {
              total: formatAmount(total_cents),
            })}
          </Typography>

          {/* Choice buttons */}
          <Box sx={{ display: 'flex', gap: 1.5, mb: 2 }}>
            <Button
              fullWidth
              variant={selectedChoice === 'credit' ? 'contained' : 'outlined'}
              onClick={() => setSelectedChoice('credit')}
              disabled={isDisabled}
              startIcon={<CreditIcon />}
              sx={{
                py: 1.5,
                borderRadius: 2,
                textTransform: 'none',
                fontWeight: 600,
                ...(selectedChoice === 'credit'
                  ? {
                      bgcolor: theme.palette.primary.main,
                      color: '#fff',
                      '&:hover': { bgcolor: theme.palette.primary.dark },
                    }
                  : {
                      borderColor: alpha('#fff', 0.15),
                      color: 'text.secondary',
                      '&:hover': {
                        borderColor: alpha('#fff', 0.3),
                        bgcolor: alpha('#fff', 0.05),
                      },
                    }),
              }}
            >
              {t('components.claimReimbursement.creditChoice')}
            </Button>
            <Button
              fullWidth
              variant={selectedChoice === 'payment' ? 'contained' : 'outlined'}
              onClick={() => setSelectedChoice('payment')}
              disabled={isDisabled}
              startIcon={<PaymentIcon />}
              sx={{
                py: 1.5,
                borderRadius: 2,
                textTransform: 'none',
                fontWeight: 600,
                ...(selectedChoice === 'payment'
                  ? {
                      bgcolor: theme.palette.success.main,
                      color: '#fff',
                      '&:hover': { bgcolor: theme.palette.success.dark },
                    }
                  : {
                      borderColor: alpha('#fff', 0.15),
                      color: 'text.secondary',
                      '&:hover': {
                        borderColor: alpha('#fff', 0.3),
                        bgcolor: alpha('#fff', 0.05),
                      },
                    }),
              }}
            >
              {t('components.claimReimbursement.paymentChoice')}
            </Button>
          </Box>
        </Box>

        {/* Actions */}
        <Box
          sx={{
            display: 'flex',
            gap: 1,
            p: 2,
            pt: 0,
            bgcolor: alpha('#fff', 0.02),
            borderTop: 1,
            borderColor: 'divider',
          }}
        >
          <Button
            variant="outlined"
            fullWidth
            onClick={handleBackdropClick}
            disabled={isDisabled}
            sx={{
              borderColor: alpha('#fff', 0.15),
              color: 'text.secondary',
              '&:hover': {
                borderColor: alpha('#fff', 0.3),
                bgcolor: alpha('#fff', 0.05),
              },
            }}
          >
            {t('components.expenseDetail.cancel')}
          </Button>
          <Button
            variant="contained"
            fullWidth
            onClick={handleConfirm}
            disabled={!selectedChoice || isDisabled}
            sx={{
              bgcolor: theme.palette.warning.main,
              color: '#121212',
              '&:hover': {
                bgcolor: alpha(theme.palette.warning.main, 0.85),
              },
              '&:disabled': {
                bgcolor: alpha(theme.palette.warning.main, 0.4),
                color: '#fff',
              },
            }}
          >
            {isSubmitting ? (
              <CircularProgress size={20} sx={{ color: '#fff' }} />
            ) : (
              t('components.claimReimbursement.confirm')
            )}
          </Button>
        </Box>
      </Box>
    </Box>
  );
}
