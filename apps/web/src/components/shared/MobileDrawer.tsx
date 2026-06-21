import { useEffect } from 'react';
import { Drawer, Box, Typography, IconButton, alpha, useTheme } from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';

interface MobileDrawerProps {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  children: React.ReactNode;
  onOpen?: () => void;
  clearAction?: React.ReactNode;
  fullScreen?: boolean;
}

/**
 * Reusable bottom drawer shell for mobile.
 *
 * Provides:
 *  - anchor="bottom" Drawer with dark backdrop (rgba(0,0,0,0.6))
 *  - Dark paper with rounded top corners, 92dvh max height
 *  - Centered grab handle pill
 *  - Close button (top right)
 *  - Gradient title area
 *  - Scrollable content area
 *  - Optional onOpen callback (fires when drawer opens — useful for clearError etc.)
 */
export function MobileDrawer({ open, onClose, title, children, onOpen, clearAction, fullScreen }: MobileDrawerProps) {
  const theme = useTheme();

  useEffect(() => {
    if (open) onOpen?.();
  }, [open, onOpen]);

  const handleClose = () => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    onClose();
  };

  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={handleClose}
      slotProps={{
        backdrop: {
          sx: {
            bgcolor: 'rgba(0, 0, 0, 0.6)',
          },
        },
      }}
      sx={{
        '& .MuiDrawer-paper': {
          bgcolor: '#1A1A1A',
          borderTopLeftRadius: fullScreen ? 0 : 20,
          borderTopRightRadius: fullScreen ? 0 : 20,
          height: fullScreen ? '100dvh' : undefined,
          maxHeight: fullScreen ? undefined : '92dvh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        },
      }}
    >
      {/* Grab handle */}
      <Box
        sx={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          px: 2,
          pt: 1.5,
          pb: 0.5,
          flexShrink: 0,
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            top: 8,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 36,
            height: 4,
            borderRadius: 2,
            bgcolor: alpha('#fff', 0.15),
          }}
        />
        <IconButton
          onClick={onClose}
          size="small"
          sx={{
            color: 'text.secondary',
            width: 32,
            height: 32,
            '&:hover': { color: 'text.primary', bgcolor: 'action.hover' },
          }}
        >
          <CloseIcon sx={{ fontSize: 20 }} />
        </IconButton>
      </Box>

      {/* Title row */}
      <Box
        sx={{
          px: 2,
          pb: 1.5,
          borderBottom: 1,
          borderColor: 'divider',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Typography
          variant="h6"
          fontWeight={700}
          sx={{
            fontSize: '1.1rem',
            background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          {title}
        </Typography>
        {clearAction}
      </Box>

      {/* Content */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          overflow: 'hidden',
          px: 2,
          pb: 0,
        }}
      >
        {children}
      </Box>
    </Drawer>
  );
}
