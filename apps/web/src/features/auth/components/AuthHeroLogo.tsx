import { Box, Typography } from '@mui/material';

interface AuthHeroLogoProps {
  title: string;
  subtitle: string;
}

export function AuthHeroLogo({ title, subtitle }: AuthHeroLogoProps) {
  return (
    <Box sx={{ textAlign: 'center', mb: 3 }}>
      {/* Logo - extending outside the card */}
      <Box
        sx={{
          width: 180,
          height: 180,
          margin: '0 auto -40px',
          position: 'relative',
          zIndex: 2,
          filter: 'drop-shadow(0 8px 24px rgba(245, 158, 11, 0.5))',
        }}
      >
        <img
          src="/assets/logo.svg"
          alt="MoshSplit Logo"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
          }}
        />
      </Box>

      {/* Title */}
      <Typography
        variant="h3"
        component="h1"
        sx={{
          fontFamily: '"Oswald", "Bebas Neue", sans-serif',
          fontWeight: 700,
          fontSize: { xs: '2rem', sm: '2.5rem' },
          letterSpacing: '0.12em',
          color: 'text.primary',
          textTransform: 'uppercase',
          mb: 1,
          textShadow: '0 2px 8px rgba(245, 158, 11, 0.3)',
        }}
      >
        {title}
      </Typography>

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