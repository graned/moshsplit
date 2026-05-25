import { Box, Typography, alpha } from '@mui/material';
import type { ReactNode } from 'react';

export interface SpendingLadderItemProps {
  /** Content to render on the left side (logo, rank number, medal, etc.) */
  left: ReactNode;
  /** Display name of the entrant */
  displayName: string;
  /** Formatted amount string (already formatted by the parent) */
  amount: string;
  /** If true, applies gold/highlighted styling */
  highlighted?: boolean;
  /** Optional banner image behind the card */
  bannerSrc?: string;
}

/**
 * Pure presentational row for a spending ladder.
 * Knows nothing about ranks, medals, or logos — it just renders what's passed in.
 */
export default function SpendingLadderItem({
  left,
  displayName,
  amount,
  highlighted = false,
  bannerSrc,
}: SpendingLadderItemProps) {
  return (
    <Box
      sx={{
        position: bannerSrc ? 'relative' as const : undefined,
        overflow: bannerSrc ? 'hidden' as const : undefined,
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        px: 1.5,
        py: highlighted ? 2 : 1,
        borderRadius: 2,
      }}
    >
      {bannerSrc && (
        <Box sx={{ position: 'absolute', inset: 0, zIndex: 0 }}>
          <img
            src={bannerSrc}
            alt=""
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 1 }}
          />
        </Box>
      )}

      {/* Left slot */}
      <Box
        sx={{
          position: 'relative',
          zIndex: 2,
          minWidth: 44,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {left}
      </Box>

      {/* Display name */}
      <Typography
        sx={{
          flex: 1,
          fontSize: highlighted ? '1.25rem' : '1rem',
          fontWeight: 700,
          color: highlighted ? '#F59E0B' : '#fff',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          position: 'relative',
          zIndex: 2,
          fontFamily: '"Metal Mania", serif',
        }}
      >
        {displayName}
      </Typography>

      {/* Amount */}
      <Typography
        sx={{
          fontSize: highlighted ? '1.25rem' : '1rem',
          fontWeight: 800,
          color: highlighted ? '#F59E0B' : alpha('#fff', 0.7),
          flexShrink: 0,
          position: 'relative',
          zIndex: 2,
          fontFamily: '"Metal Mania", serif',
          px: bannerSrc ? 1 : 0,
          py: bannerSrc ? 0.25 : 0,
          borderRadius: 1,
          bgcolor: bannerSrc ? alpha('#000', 0.55) : 'transparent',
        }}
      >
        {amount}
      </Typography>
    </Box>
  );
}
