import { ReactNode } from 'react';
import { Card, CardContent, alpha, useTheme } from '@mui/material';

interface MobileCardProps {
  children: ReactNode;
  onClick?: () => void;
  accentColor?: string;
  className?: string;
  sx?: any;
}

export function MobileCard({ children, onClick, accentColor, className, sx }: MobileCardProps) {
  const theme = useTheme();
  const effectiveAccent = accentColor || theme.palette.primary.main;

  return (
    <Card
      onClick={onClick}
      className={className}
      sx={{
        cursor: onClick ? 'pointer' : 'default',
        transition: 'border-color 0.2s ease, box-shadow 0.2s ease, transform 0.15s ease',
        backgroundColor: 'background.paper',
        borderColor: 'divider',
        borderRadius: 2,
        overflow: 'hidden',
        '&:hover': {
          borderColor: alpha(effectiveAccent, 0.3),
          boxShadow: onClick ? `0 4px 16px ${alpha(effectiveAccent, 0.12)}` : 'none',
          transform: onClick ? 'translateY(-1px)' : 'none',
        },
        '&:active': onClick ? { transform: 'scale(0.98)' } : {},
        ...sx,
      }}
    >
      <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
        {children}
      </CardContent>
    </Card>
  );
}
