import { Box, Typography, Button, CircularProgress, alpha, useTheme } from '@mui/material';
import { Warning as WarningIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

interface DeleteExpenseModalProps {
  open: boolean;
  expenseTitle: string;
  isDeleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteExpenseModal({
  open,
  expenseTitle,
  isDeleting,
  onClose,
  onConfirm,
}: DeleteExpenseModalProps) {
  const { t } = useTranslation();
  const theme = useTheme();

  if (!open) return null;

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
      onClick={onClose}
    >
      <Box
        sx={{
          bgcolor: 'background.paper',
          borderRadius: 3,
          maxWidth: 360,
          width: '100%',
          overflow: 'hidden',
          border: 1,
          borderColor: alpha(theme.palette.error.main, 0.3),
          boxShadow: `0 0 40px ${alpha(theme.palette.error.main, 0.15)}`,
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
              bgcolor: alpha(theme.palette.error.main, 0.12),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <WarningIcon sx={{ fontSize: 28, color: 'error.main' }} />
          </Box>
          <Typography
            variant="h6"
            fontWeight={700}
            sx={{
              color: 'error.main',
              textAlign: 'center',
            }}
          >
            {t('components.expenseDetail.deleteTitle')}
          </Typography>
        </Box>

        {/* Content */}
        <Box sx={{ px: 3, pb: 3 }}>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ textAlign: 'center', mb: 1 }}
          >
            {t('components.expenseDetail.deleteWarning')}
          </Typography>
          <Typography
            variant="body2"
            fontWeight={600}
            sx={{
              textAlign: 'center',
              color: 'text.primary',
              mb: 0.5,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            "{expenseTitle}"
          </Typography>
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
            onClick={onClose}
            disabled={isDeleting}
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
            onClick={onConfirm}
            disabled={isDeleting}
            sx={{
              bgcolor: theme.palette.error.main,
              color: '#fff',
              '&:hover': {
                bgcolor: alpha(theme.palette.error.main, 0.85),
              },
              '&:disabled': {
                bgcolor: alpha(theme.palette.error.main, 0.4),
                color: '#fff',
              },
            }}
          >
            {isDeleting ? (
              <CircularProgress size={20} sx={{ color: '#fff' }} />
            ) : (
              t('components.expenseDetail.confirmDelete')
            )}
          </Button>
        </Box>
      </Box>
    </Box>
  );
}
