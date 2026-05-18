import { Card, CardProps } from '@mui/material';

interface GlassCardProps extends CardProps {
  borderColor?: string;
}

/**
 * GlassCard: Semi-transparent card with backdrop blur.
 * Used for header stat cards, shrinking header, and sticky elements.
 * NOT applied globally — only where the glass effect is needed.
 */
export function GlassCard({
  children,
  sx: extraSx,
  borderColor = 'rgba(255, 255, 255, 0.1)',
  ...props
}: GlassCardProps) {
  return (
    <Card
      {...props}
      sx={{
        background: 'rgba(30, 30, 30, 0.6)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: `1px solid ${borderColor}`,
        borderRadius: 3,
        ...extraSx,
      }}
    >
      {children}
    </Card>
  );
}
