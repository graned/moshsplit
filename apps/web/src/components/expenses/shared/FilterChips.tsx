import { Box, Button, alpha, useTheme } from '@mui/material';
import {
  List as AllIcon,
  Restaurant as FoodIcon,
  DirectionsCar as TransportIcon,
  ShoppingBag as MerchIcon,
  LocalBar as BeerIcon,
  LocalGasStation as GasIcon,
  Park as CampingIcon,
} from '@mui/icons-material';

const EXPENSE_TYPES = [
  { value: undefined, label: 'All', icon: <AllIcon sx={{ fontSize: 16 }} /> },
  { value: 'food', label: 'Food', icon: <FoodIcon sx={{ fontSize: 16 }} /> },
  { value: 'transport', label: 'Travel', icon: <TransportIcon sx={{ fontSize: 16 }} /> },
  { value: 'merch', label: 'Merch', icon: <MerchIcon sx={{ fontSize: 16 }} /> },
  { value: 'beer', label: 'Beer', icon: <BeerIcon sx={{ fontSize: 16 }} /> },
  { value: 'gas', label: 'Gas', icon: <GasIcon sx={{ fontSize: 16 }} /> },
  { value: 'camping', label: 'Camping', icon: <CampingIcon sx={{ fontSize: 16 }} /> },
] as const;

interface FilterChipsProps {
  selectedType?: string;
  onTypeChange: (type?: string) => void;
  variant?: 'war-chest' | 'default';
}

export function FilterChips({ selectedType, onTypeChange, variant = 'default' }: FilterChipsProps) {
  const theme = useTheme();
  const isWarChest = variant === 'war-chest';

  return (
    <Box sx={{ position: 'relative' }}>
      <Box
        sx={{
          position: 'relative',
          display: 'flex',
          gap: 0.75,
          overflowX: 'auto',
          pb: 0.5,
          scrollbarWidth: 'none',
          '& ::-webkit-scrollbar': { display: 'none' },
          WebkitOverflowScrolling: 'touch',
          maskImage:
            'linear-gradient(to right, transparent 0px, transparent 4px, black 8px, black calc(100% - 12px), transparent calc(100% - 4px))',
          '&::after': isWarChest
            ? {
                content: '""',
                position: 'absolute',
                top: 0,
                right: 0,
                bottom: 0,
                width: 24,
                background:
                  'linear-gradient(to right, transparent, rgba(18, 18, 18, 0.15))',
                pointerEvents: 'none',
                borderRadius: '0 100px 100px 0',
                zIndex: 1,
              }
            : {},
          '&::before': isWarChest
            ? {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                bottom: 0,
                width: 8,
                background:
                  'linear-gradient(to right, rgba(18, 18, 18, 0.08), transparent)',
                pointerEvents: 'none',
                borderRadius: '100px 0 0 100px',
                zIndex: 1,
              }
            : {},
        }}
      >
        {EXPENSE_TYPES.map((type) => {
          const isSelected = selectedType === type.value;
          const isAll = type.value === undefined;

          return (
            <Button
              key={type.value ?? 'all'}
              onClick={() => onTypeChange(type.value)}
              variant={isSelected ? 'contained' : 'outlined'}
              size="small"
              startIcon={type.icon}
              sx={{
                px: 1.5,
                py: 0.5,
                borderRadius: 100,
                whiteSpace: 'nowrap',
                flexShrink: 0,
                fontSize: '0.7rem',
                fontWeight: isSelected || isAll ? 800 : 700,
                letterSpacing: '0.03em',
                textTransform: 'uppercase',
                minHeight: 32,
                bgcolor:
                  isSelected
                    ? 'primary.main'
                    : isAll && !selectedType
                      ? alpha('#534434', 0.12)
                      : 'transparent',
                color:
                  isSelected
                    ? '#121212'
                    : isAll && !selectedType
                      ? 'primary.main'
                      : 'text.secondary',
                borderColor: alpha('#534434', isSelected ? 0 : 0.3),
                boxShadow:
                  !isSelected
                    ? `0 1px 4px ${alpha('#000', 0.12)}, 0 0 0 1px ${alpha('#534434', 0.15)}`
                    : 'none',
                '& .MuiButton-startIcon': {
                  m: 0,
                  mr: 0.75,
                },
                '&:hover': {
                  bgcolor:
                    isSelected
                      ? 'primary.dark'
                      : alpha('#534434', isWarChest ? 0.2 : 0.1),
                  borderColor: isSelected ? 'primary.dark' : 'primary.main',
                  color: isSelected ? '#121212' : 'primary.main',
                  boxShadow:
                    !isSelected
                      ? `0 2px 8px ${alpha('#000', 0.18)}, 0 0 0 1px ${alpha(theme.palette.primary.main, 0.3)}`
                      : undefined,
                },
              }}
            >
              {type.label}
            </Button>
          );
        })}
      </Box>
    </Box>
  );
}
