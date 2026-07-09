import { useRef, useState, useCallback, ReactNode } from 'react';
import { Box, IconButton, useTheme } from '@mui/material';
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
        borderRadius: 2,
        cursor: disabled ? 'default' : 'grab',
        '&:active': { cursor: disabled ? 'default' : 'grabbing' },
      }}
    >
      {/* Hidden action panel - positioned to the left, off-screen initially */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          bottom: 0,
          display: 'flex',
          alignItems: 'stretch',
          width: `${ACTION_WIDTH * 2}px`,
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
              bgcolor: theme.palette.primary.main,
            }}
          >
            <IconButton
              onClick={handleEdit}
              size="small"
              sx={{
                color: '#fff',
                bgcolor: 'rgba(255,255,255,0.2)',
                width: 36,
                height: 36,
                '&:hover': {
                  bgcolor: 'rgba(255,255,255,0.3)',
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
              bgcolor: theme.palette.error.main,
            }}
          >
            <IconButton
              onClick={handleDelete}
              size="small"
              sx={{
                color: '#fff',
                bgcolor: 'rgba(255,255,255,0.2)',
                width: 36,
                height: 36,
                '&:hover': {
                  bgcolor: 'rgba(255,255,255,0.3)',
                },
              }}
            >
              <DeleteIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Box>
        )}
      </Box>

      {/* Card content - slides right to reveal actions */}
      <Box
        sx={{
          position: 'relative',
          zIndex: 1,
          bgcolor: 'background.paper',
          transform: `translateX(${translateX}px)`,
          transition: isDragging ? 'none' : 'transform 0.2s ease-out',
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
