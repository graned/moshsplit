import { useRef, useEffect } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';

interface MobileCardListProps<T> {
  // Data
  items: T[];

  // Rendering
  renderItem: (item: T, index: number) => React.ReactNode;

  // State
  isLoading?: boolean;
  isError?: boolean;
  error?: string | null;
  emptyState?: React.ReactNode;

  // Infinite scroll
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  fetchNextPage?: () => void;

  // Scroll container for IntersectionObserver
  scrollContainerRef?: React.RefObject<HTMLElement | null>;

  // Styling
  gap?: number | string;
  className?: string;

  // Customization
  loadingIndicator?: React.ReactNode;
  sentinelMargin?: string;
}

export function MobileCardList<T>({
  items,
  renderItem,
  isLoading = false,
  isError = false,
  error,
  emptyState,
  hasNextPage = false,
  isFetchingNextPage = false,
  fetchNextPage,
  scrollContainerRef,
  gap = 1.5,
  className,
  loadingIndicator,
  sentinelMargin = '200px',
}: MobileCardListProps<T>) {
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Infinite scroll observer
  useEffect(() => {
    if (!hasNextPage || !fetchNextPage) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { root: scrollContainerRef?.current ?? null, rootMargin: sentinelMargin }
    );

    if (sentinelRef.current) {
      observer.observe(sentinelRef.current);
    }

    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, scrollContainerRef, sentinelMargin]);

  // Loading state
  if (isLoading) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        {loadingIndicator || <CircularProgress />}
      </Box>
    );
  }

  // Error state
  if (isError) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography color="error">{error || 'Failed to load'}</Typography>
      </Box>
    );
  }

  // Empty state
  if (items.length === 0) {
    return emptyState || null;
  }

  return (
    <Box className={className} sx={{ display: 'flex', flexDirection: 'column', gap }}>
      {items.map((item, index) => renderItem(item, index))}

      {/* Sentinel for infinite scroll */}
      {hasNextPage && <div ref={sentinelRef} style={{ height: 1 }} />}

      {/* Loading more indicator */}
      {isFetchingNextPage && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
          <CircularProgress size={24} />
        </Box>
      )}
    </Box>
  );
}
