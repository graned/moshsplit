import { Card, CardContent, Box, alpha, useTheme } from '@mui/material';

interface FeedCardProps {
  children: React.ReactNode;
  onClick?: () => void;
  accentColor?: string;
  className?: string;
}

export function FeedCard({ children, onClick, accentColor, className }: FeedCardProps) {
  const theme = useTheme();
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
        '&:hover': {
          borderColor: alpha(accent, 0.3),
          boxShadow: onClick ? `0 4px 16px ${alpha(accent, 0.12)}` : 'none',
          transform: onClick ? 'translateY(-1px)' : 'none',
        },
      }}
    >
      <CardContent sx={{ py: 2, px: 2.5, '&:last-child': { pb: 2 } }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>{children}</Box>
      </CardContent>
    </Card>
  );
}
