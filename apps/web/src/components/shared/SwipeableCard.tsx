import { useRef, useState, useCallback, ReactNode } from 'react';
import { Box, IconButton, alpha, useTheme } from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';

interface SwipeableCardActions {
  onEdit?: () => void;
  onDelete?: () => void;
  canEdit?: boolean;
  canDelete?: boolean;
}

interface SwipeableCardProps {
  children: ReactNode;
  actions?: SwipeableCardActions;
  disabled?: boolean;
}

const SWIPE_THRESHOLD = 60;
const ACTION_WIDTH = 44;

/**
 * Horizontal swipe-right reveal card.
 * On desktop/touch, dragging right uncovers Edit/Delete action buttons.
 */
export function SwipeableCard({ children, actions, disabled = false }: SwipeableCardProps) {
  const theme = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const [translateX, setTranslateX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef(0);
  const currentXRef = useRef(0);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (disabled) return;
    startXRef.current = e.touches[0].clientX;
    currentXRef.current = startXRef.current;
    setIsDragging(true);
  }, [disabled]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging || disabled) return;
    currentXRef.current = e.touches[0].clientX;
    const delta = currentXRef.current - startXRef.current;
    // Only allow swiping right (positive delta), with resistance after threshold
    const clampedDelta = Math.max(0, delta);
    setTranslateX(clampedDelta);
  }, [isDragging, disabled]);

  const handleTouchEnd = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);
    if (translateX >= SWIPE_THRESHOLD) {
      // Snap open
      setTranslateX(ACTION_WIDTH * 2);
    } else {
      // Snap closed
      setTranslateX(0);
    }
  }, [isDragging, translateX]);

  const handleClose = useCallback(() => {
    setTranslateX(0);
  }, []);

  const handleEdit = useCallback(() => {
    actions?.onEdit?.();
    handleClose();
  }, [actions, handleClose]);

  const handleDelete = useCallback(() => {
    actions?.onDelete?.();
    handleClose();
  }, [actions, handleClose]);

  const hasActions = actions && (actions.canEdit || actions.canDelete);

  if (!hasActions) {
    return <>{children}</>;
  }

  return (
    <Box
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onClick={() => translateX > 0 && handleClose()}
      sx={{
        position: 'relative',
        overflow: 'hidden',
        cursor: disabled ? 'default' : 'grab',
        '&:active': { cursor: disabled ? 'default' : 'grabbing' },
      }}
    >
      {/* Hidden action panel - positioned to the right, slides in when card swiped */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          alignItems: 'stretch',
          width: `${ACTION_WIDTH * 2}px`,
          transform: (isDragging ? `translateX(${ACTION_WIDTH * 2 - translateX}px)` : translateX > 0 ? 'translateX(0)' : `translateX(${ACTION_WIDTH * 2}px)`),
          transition: isDragging ? 'none' : 'transform 0.2s ease-out',
          zIndex: 0,
        }}
      >
        {actions.canEdit && (
          <Box
            sx={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: alpha(theme.palette.primary.main, 0.2),
            }}
          >
            <IconButton
              onClick={handleEdit}
              size="small"
              sx={{
                color: theme.palette.primary.main,
                bgcolor: alpha(theme.palette.primary.main, 0.15),
                width: 36,
                height: 36,
                '&:hover': {
                  bgcolor: alpha(theme.palette.primary.main, 0.25),
                },
              }}
            >
              <EditIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Box>
        )}
        {actions.canDelete && (
          <Box
            sx={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: alpha(theme.palette.error.main, 0.2),
            }}
          >
            <IconButton
              onClick={handleDelete}
              size="small"
              sx={{
                color: theme.palette.error.main,
                bgcolor: alpha(theme.palette.error.main, 0.15),
                width: 36,
                height: 36,
                '&:hover': {
                  bgcolor: alpha(theme.palette.error.main, 0.25),
                },
              }}
            >
              <DeleteIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Box>
        )}
      </Box>

      {/* Card content - slides left to reveal actions on the right */}
      <Box
        sx={{
          position: 'relative',
          zIndex: 1,
          bgcolor: 'background.paper',
          transform: `translateX(-${translateX}px)`,
          transition: isDragging ? 'none' : 'transform 0.2s ease-out',
          borderRadius: translateX > 0 ? 0 : 2,
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
