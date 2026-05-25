import { Box, alpha, useTheme } from '@mui/material';

interface MobileFeedCardProps {
  /** Rendered in a 36×36 rounded box on the left */
  icon: React.ReactNode;
  /** Accent color for the icon box tint (default: primary.main) */
  accentColor?: string;
  /** Main content in the center */
  children: React.ReactNode;
  /** Optional right-side content (amount + date column) */
  rightContent?: React.ReactNode;
  onClick?: () => void;
}

/**
 * Mobile-only master card shell.
 *
 * Renders a horizontal flex row with:
 *  - Left:   36×36 icon box (accent tint, centered)
 *  - Center: children (flex 1, overflow hidden)
 *  - Right:  rightContent (text-align right, shrink 0)
 *
 * No responsive breakpoints, no `useMediaQuery`, no Tooltip — mobile-only sizes always.
 */
export function MobileFeedCard({
  icon,
  accentColor,
  children,
  rightContent,
  onClick,
}: MobileFeedCardProps) {
  const theme = useTheme();
  const accent = accentColor || theme.palette.primary.main;

  return (
    <Box
      onClick={onClick}
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 1.25,
        p: 1.75,
        py: 1.25,
        backgroundColor: 'background.paper',
        border: 1,
        borderColor: 'divider',
        borderRadius: 2,
        cursor: onClick ? 'pointer' : 'default',
        WebkitTapHighlightColor: 'transparent',
        transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
        '&:hover': {
          borderColor: alpha(accent, 0.3),
          boxShadow: onClick ? `0 4px 16px ${alpha(accent, 0.12)}` : 'none',
        },
        '&:active': onClick ? { transform: 'scale(0.98)' } : {},
        '&:focus-visible': { outline: 'none' },
      }}
    >
      {/* Left: 36×36 icon box */}
      <Box
        sx={{
          width: 36,
          height: 36,
          borderRadius: 1.5,
          backgroundColor: alpha(accent, 0.1),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          mt: 0.25,
        }}
      >
        {icon}
      </Box>

      {/* Center: main content */}
      <Box sx={{ minWidth: 0, flex: 1 }}>{children}</Box>

      {/* Right: optional amount + date column */}
      {rightContent && (
        <Box sx={{ textAlign: 'right', ml: 0.75, flexShrink: 0 }}>{rightContent}</Box>
      )}
    </Box>
  );
}
