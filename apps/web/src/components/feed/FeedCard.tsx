import { Card, CardContent, Box, alpha } from '@mui/material';

interface FeedCardProps {
  children: React.ReactNode;
  onClick?: () => void;
  accentColor?: string;
  className?: string;
}

/**
 * Base card container for activity feed items.
 * Dark surface (#1E1E1E), subtle border, hover effects with amber accent.
 */
export function FeedCard({
  children,
  onClick,
  accentColor,
  className,
}: FeedCardProps) {
  return (
    <Card
      className={className}
      onClick={onClick}
      sx={{
        cursor: onClick ? 'pointer' : 'default',
        transition: 'border-color 0.2s ease, box-shadow 0.2s ease, transform 0.15s ease',
        backgroundColor: '#1E1E1E',
        borderColor: 'divider',
        '&:hover': {
          borderColor: accentColor
            ? alpha(accentColor, 0.3)
            : 'rgba(245, 158, 11, 0.2)',
          boxShadow: onClick
            ? `0 4px 16px ${alpha(accentColor || '#F59E0B', 0.12)}`
            : 'none',
          transform: onClick ? 'translateY(-1px)' : 'none',
        },
      }}
    >
      <CardContent sx={{ py: 2, px: 2.5, '&:last-child': { pb: 2 } }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
          {children}
        </Box>
      </CardContent>
    </Card>
  );
}
