import { Box, Typography, alpha } from '@mui/material';

interface StatWidgetProps {
  label: string;
  value: string;
  icon?: React.ReactNode;
  color?: string;
}

/**
 * StatWidget: Small metric card for the Balances page.
 * Displays a label, value, and optional icon with color accent.
 */
export function StatWidget({ label, value, icon, color = 'primary.main' }: StatWidgetProps) {
  return (
    <Box
      sx={{
        flex: 1,
        minWidth: 0,
        textAlign: 'center',
        py: { xs: 1.5, sm: 2.5 },
        px: { xs: 1, sm: 1.5 },
        borderRadius: { xs: 2, sm: 3 },
        bgcolor: 'background.paper',
        border: 1,
        borderColor: 'divider',
        position: 'relative',
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          bgcolor: color,
          opacity: 0.7,
        },
      }}
    >
      {icon && (
        <Box
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 32,
            height: 32,
            borderRadius: '50%',
            bgcolor: alpha(color, 0.12),
            color,
            mb: 1,
          }}
        >
          {icon}
        </Box>
      )}
      <Typography
        fontWeight={800}
        color={color}
        sx={{
          fontSize: { xs: '1rem', sm: '1.5rem' },
          lineHeight: 1.2,
        }}
      >
        {value}
      </Typography>
      <Typography
        color="text.secondary"
        sx={{
          fontSize: { xs: '0.65rem', sm: '0.75rem' },
          mt: 0.5,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        {label}
      </Typography>
    </Box>
  );
}
