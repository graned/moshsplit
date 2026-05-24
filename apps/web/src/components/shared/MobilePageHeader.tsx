import { Box, Typography, alpha } from '@mui/material';
import type { ReactNode } from 'react';

export interface MobilePageHeaderProps {
  /** Icon rendered inside a 40×40 amber-tinted rounded box */
  icon: ReactNode;
  /** Page title, e.g. "Battle Log" or "Scales of War" */
  title: string;
  /** Subtitle, typically the event name */
  subtitle: string;
  /** Optional element placed on the right side of the title row (e.g. crew badge) */
  rightAction?: ReactNode;
  /** Optional background image URL – applies a dark gradient overlay */
  backgroundImage?: string;
  /** Optional content rendered below the title row (e.g. Total Damage card, filter chips) */
  children?: ReactNode;
}

export function MobilePageHeader({
  icon,
  title,
  subtitle,
  rightAction,
  backgroundImage,
  children,
}: MobilePageHeaderProps) {
  const hasBgImage = !!backgroundImage;

  return (
    <Box
      sx={{
        position: 'sticky',
        top: 0,
        zIndex: 10,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: children ? 1.5 : 0,
        px: 2,
        pt: 1.5,
        pb: 1.5,
        ...(hasBgImage
          ? {
            background: [
              'linear-gradient(to bottom, rgba(18,18,18,0.3) 0%, rgba(18,18,18,0.7) 60%, #121212 100%)',
              `url(${backgroundImage})`,
            ].join(', '),
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
          }
          : {
            background: [
              'linear-gradient(to bottom, rgba(18,18,18,0.6) 0%, rgba(18,18,18,0.85) 60%, #121212 100%)',
              'linear-gradient(135deg, #4A2F0A 0%, #1A1A1A 100%)',
            ].join(', '),
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
          }),
        borderColor: alpha('#534434', 0.1),
      }}
    >
      {/* Title row */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0, flex: 1 }}>
          {/* Icon box */}
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: 2,
              bgcolor: alpha('#F59E0B', 0.12),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {typeof icon === 'string' ? (
              <Box component="img" src={icon} sx={{ width: 22, height: 22 }} />
            ) : (
              icon
            )}
          </Box>
          {/* Title + subtitle */}
          <Box sx={{ minWidth: 0 }}>
            <Typography
              sx={{
                fontSize: '1.25rem',
                fontWeight: 800,
                color: 'primary.main',
                letterSpacing: '-0.02em',
                lineHeight: 1.2,
              }}
            >
              {title}
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                fontSize: '0.75rem',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {subtitle}
            </Typography>
          </Box>
        </Box>
        {rightAction && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexShrink: 0 }}>
            {rightAction}
          </Box>
        )}
      </Box>
      {children}
    </Box>
  );
}
