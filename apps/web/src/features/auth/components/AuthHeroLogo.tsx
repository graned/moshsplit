import { Box, Typography } from '@mui/material';

interface AuthHeroLogoProps {
  title: string;
  subtitle: string;
}

export function AuthHeroLogo({ title, subtitle }: AuthHeroLogoProps) {
  return (
    <Box sx={{ textAlign: 'center', mb: 4 }}>
      {/* Logo Icon - Metal horn hand gesture stylized */}
      <Box
        sx={{
          width: 80,
          height: 80,
          margin: '0 auto 20px',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Box
          sx={{
            width: '100%',
            height: '100%',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 50%, #F59E0B 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 32px rgba(245, 158, 11, 0.4)',
            position: 'relative',
            overflow: 'hidden',
            '&::before': {
              content: '""',
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'linear-gradient(45deg, transparent 40%, rgba(255,255,255,0.2) 50%, transparent 60%)',
              backgroundSize: '200% 200%',
              animation: 'shimmer 3s infinite',
            },
            '@keyframes shimmer': {
              '0%': { backgroundPosition: '200% 0' },
              '100%': { backgroundPosition: '-200% 0' },
            },
          }}
        >
          <Typography
            sx={{
              fontSize: '2.5rem',
              fontWeight: 900,
              color: '#121212',
              fontFamily: '"Oswald", "Bebas Neue", sans-serif',
              letterSpacing: '0.05em',
              lineHeight: 1,
            }}
          >
            M
          </Typography>
        </Box>
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