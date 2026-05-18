import { Card, CardContent, Box, alpha, useTheme, useMediaQuery } from '@mui/material';

interface FeedCardProps {
  children: React.ReactNode;
  onClick?: () => void;
  accentColor?: string;
  className?: string;
}

export function FeedCard({ children, onClick, accentColor, className }: FeedCardProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const accent = accentColor || theme.palette.primary.main;

  return (
    <Card
      className={className}
      onClick={onClick}
      sx={{
        cursor: onClick ? 'pointer' : 'default',
        transition: 'border-color 0.2s ease, box-shadow 0.2s ease, transform 0.15s ease',
        backgroundColor: 'background.paper',
        borderColor: 'divider',
        borderRadius: isMobile ? 2 : 3,
        '&:hover': {
          borderColor: alpha(accent, 0.3),
          boxShadow: onClick ? `0 4px 16px ${alpha(accent, 0.12)}` : 'none',
          transform: onClick ? 'translateY(-1px)' : 'none',
        },
        '&:active': onClick && isMobile ? { transform: 'scale(0.98)' } : {},
      }}
    >
      <CardContent sx={{ py: isMobile ? 1.25 : 2, px: isMobile ? 1.75 : 2.5, '&:last-child': { pb: isMobile ? 1.25 : 2 } }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: isMobile ? 1.25 : 1.5 }}>{children}</Box>
      </CardContent>
    </Card>
  );
}
