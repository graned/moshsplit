import { Box, Typography } from '@mui/material';

interface AuthHeroLogoProps {
  title: string;
  subtitle: string;
}

export function AuthHeroLogo({ title: _title, subtitle }: AuthHeroLogoProps) {
  return (
    <Box sx={{ textAlign: 'center', mb: 2 }}>
      {/* Big Logo - no overflow */}
      <Box
        sx={{
          width: 220,
          height: 220,
          margin: '0 auto 16px',
          position: 'relative',
          filter: 'drop-shadow(0 8px 32px rgba(245, 158, 11, 0.6))',
        }}
      >
        <img
          src="/moshsplit/assets/logo.svg"
          alt="MoshSplit Logo"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
          }}
        />
      </Box>

      {/* Subtitle */}
      <Typography
        variant="body1"
        sx={{
          color: 'text.secondary',
          fontWeight: 400,
          fontSize: { xs: '0.95rem', sm: '1rem' },
          letterSpacing: '0.02em',
        }}
      >
        {subtitle}
      </Typography>
    </Box>
  );
}
