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
  const [swipeRight, setSwipeRight] = useState(0);
  const [swipeLeft, setSwipeLeft] = useState(0);
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
    if (delta > 0) {
      setSwipeRight(delta);
      setSwipeLeft(0);
    } else {
      setSwipeLeft(-delta);
      setSwipeRight(0);
    }
  }, [isDragging, disabled]);

  const handleTouchEnd = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);
    if (swipeRight >= SWIPE_THRESHOLD) {
      setSwipeRight(ACTION_WIDTH);
    } else {
      setSwipeRight(0);
    }
    if (swipeLeft >= SWIPE_THRESHOLD) {
      setSwipeLeft(ACTION_WIDTH);
    } else {
      setSwipeLeft(0);
    }
  }, [isDragging, swipeRight, swipeLeft]);

  const handleClose = useCallback(() => {
    setSwipeRight(0);
    setSwipeLeft(0);
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

  const totalTranslate = swipeRight + swipeLeft;

  return (
    <Box
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onClick={() => totalTranslate > 0 && handleClose()}
      sx={{
        position: 'relative',
        overflow: 'hidden',
        cursor: disabled ? 'default' : 'grab',
        '&:active': { cursor: disabled ? 'default' : 'grabbing' },
      }}
    >
      {/* Delete panel on LEFT - revealed by swiping RIGHT */}
      {actions.canDelete && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: `${ACTION_WIDTH}px`,
            bgcolor: alpha(theme.palette.error.main, 0.85),
            transform: swipeRight > 0 ? 'translateX(0)' : `translateX(-${ACTION_WIDTH}px)`,
            transition: isDragging ? 'none' : 'transform 0.2s ease-out',
            zIndex: 0,
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

      {/* Edit panel on RIGHT - revealed by swiping LEFT */}
      {actions.canEdit && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: `${ACTION_WIDTH}px`,
            bgcolor: alpha(theme.palette.primary.main, 0.85),
            transform: swipeLeft > 0 ? 'translateX(0)' : `translateX(${ACTION_WIDTH}px)`,
            transition: isDragging ? 'none' : 'transform 0.2s ease-out',
            zIndex: 0,
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

      {/* Card content */}
      <Box
        sx={{
          position: 'relative',
          zIndex: 1,
          bgcolor: 'background.paper',
          transform: `translateX(${swipeRight - swipeLeft}px)`,
          transition: isDragging ? 'none' : 'transform 0.2s ease-out',
          borderRadius: swipeRight > 0 ? '2px 2px 2px 0' : swipeLeft > 0 ? '2px 0 0 2px' : '2px',
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
