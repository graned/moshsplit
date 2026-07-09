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
const ACTION_WIDTH = 56;

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
    const delta = startXRef.current - currentXRef.current;
    // Swipe left: delta = startX - currentX (positive = left swipe)
    const clampedDelta = Math.max(0, delta);
    setTranslateX(clampedDelta);
  }, [isDragging, disabled]);

  const handleTouchEnd = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);
    if (translateX >= SWIPE_THRESHOLD) {
      setTranslateX(ACTION_WIDTH * 2);
    } else {
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
      {/* Action panel on the right */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          alignItems: 'stretch',
          width: `${ACTION_WIDTH * 2}px`,
          transform: translateX > 0 ? 'translateX(0)' : `translateX(${ACTION_WIDTH * 2}px)`,
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
              bgcolor: alpha(theme.palette.primary.main, 0.85),
              borderTopLeftRadius: 0,
              borderBottomLeftRadius: 0,
            }}
          >
            <IconButton
              onClick={handleEdit}
              sx={{
                color: '#fff',
                bgcolor: alpha(theme.palette.primary.main, 0.3),
                width: 44,
                height: 44,
                '&:hover': {
                  bgcolor: alpha(theme.palette.primary.main, 0.5),
                },
              }}
            >
              <EditIcon sx={{ fontSize: 20 }} />
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
              bgcolor: alpha(theme.palette.error.main, 0.85),
              borderTopRightRadius: 2,
              borderBottomRightRadius: 2,
            }}
          >
            <IconButton
              onClick={handleDelete}
              sx={{
                color: '#fff',
                bgcolor: alpha(theme.palette.error.main, 0.3),
                width: 44,
                height: 44,
                '&:hover': {
                  bgcolor: alpha(theme.palette.error.main, 0.5),
                },
              }}
            >
              <DeleteIcon sx={{ fontSize: 20 }} />
            </IconButton>
          </Box>
        )}
      </Box>

      {/* Card content */}
      <Box
        sx={{
          position: 'relative',
          zIndex: 1,
          bgcolor: 'background.paper',
          transform: `translateX(-${translateX}px)`,
          transition: isDragging ? 'none' : 'transform 0.2s ease-out',
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
