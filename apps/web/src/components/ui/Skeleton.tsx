import { Box, Card, alpha, SxProps, Theme } from '@mui/material';

interface SkeletonProps {
  variant?: 'card' | 'table' | 'text' | 'avatar' | 'stat';
  count?: number;
  width?: string | number;
  height?: string | number;
}

function PulseBox({
  width,
  height,
  borderRadius = 2,
  sx,
}: {
  width: string | number;
  height: string | number;
  borderRadius?: number | string;
  sx?: SxProps<Theme>;
}) {
  return (
    <Box
      sx={{
        width,
        height,
        borderRadius,
        backgroundColor: (theme) => alpha(theme.palette.text.primary, 0.06),
        animation: 'pulse 1.5s ease-in-out infinite',
        '@keyframes pulse': {
          '0%, 100%': {
            opacity: 1,
          },
          '50%': {
            opacity: 0.4,
          },
        },
        ...sx,
      }}
    />
  );
}

export function CardSkeleton({ count = 3 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} sx={{ p: 3, mb: 2 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <PulseBox width="40%" height={20} borderRadius={1} />
            <PulseBox width="70%" height={16} borderRadius={1} />
            <PulseBox width="100%" height={40} borderRadius={2} />
          </Box>
        </Card>
      ))}
    </>
  );
}

export function TableSkeleton({ count = 5 }: { count?: number }) {
  return (
    <Card sx={{ p: 0, overflow: 'hidden' }}>
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          gap: 2,
          p: 2,
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <PulseBox key={i} width={`${15 + Math.random() * 15}%`} height={14} borderRadius={1} />
        ))}
      </Box>
      {/* Rows */}
      {Array.from({ length: count }).map((_, i) => (
        <Box
          key={i}
          sx={{
            display: 'flex',
            gap: 2,
            p: 2,
            borderBottom: i < count - 1 ? 1 : 0,
            borderColor: 'divider',
          }}
        >
          <PulseBox width={36} height={36} borderRadius="50%" />
          {Array.from({ length: 3 }).map((_, j) => (
            <PulseBox key={j} width={`${15 + Math.random() * 20}%`} height={14} borderRadius={1} />
          ))}
        </Box>
      ))}
    </Card>
  );
}

export function TextSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {Array.from({ length: lines }).map((_, i) => (
        <PulseBox
          key={i}
          width={i === lines - 1 ? '60%' : '100%'}
          height={14}
          borderRadius={1}
        />
      ))}
    </Box>
  );
}

export function StatSkeleton({ count = 4 }: { count?: number }) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2 }}>
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <PulseBox width={32} height={32} borderRadius={2} />
            <PulseBox width="50%" height={28} borderRadius={1} />
            <PulseBox width="80%" height={14} borderRadius={1} />
          </Box>
        </Card>
      ))}
    </Box>
  );
}

export default function Skeleton({ variant = 'text', count = 1, width = '100%', height = 16 }: SkeletonProps) {
  switch (variant) {
    case 'card':
      return <CardSkeleton count={count} />;
    case 'table':
      return <TableSkeleton count={count} />;
    case 'stat':
      return <StatSkeleton count={count} />;
    case 'avatar':
      return <PulseBox width={height as string | number} height={height as string | number} borderRadius="50%" />;
    default:
      return (
        <>
          {Array.from({ length: count }).map((_, i) => (
            <PulseBox key={i} width={width} height={height} borderRadius={1} sx={i < count - 1 ? { mb: 1 } : undefined} />
          ))}
        </>
      );
  }
}
