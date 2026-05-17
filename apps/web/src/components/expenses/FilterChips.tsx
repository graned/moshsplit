import { Box, Button, alpha } from '@mui/material';
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
}

export function FilterChips({ selectedType, onTypeChange }: FilterChipsProps) {
  return (
    <Box sx={{ display: 'flex', gap: 0.75, overflowX: 'auto', pb: 0.5, scrollbarWidth: 'none', '::-webkit-scrollbar': { display: 'none' } }}>
      {EXPENSE_TYPES.map((type) => {
        const isSelected = selectedType === type.value;
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
              fontWeight: 700,
              letterSpacing: '0.03em',
              textTransform: 'uppercase',
              bgcolor: isSelected ? 'primary.main' : 'transparent',
              color: isSelected ? '#121212' : 'text.secondary',
              borderColor: alpha('#534434', 0.3),
              minHeight: 32,
              '& .MuiButton-startIcon': {
                m: 0,
                mr: 0.75,
              },
              '&:hover': {
                bgcolor: isSelected ? 'primary.dark' : alpha('#534434', 0.1),
                borderColor: isSelected ? 'primary.dark' : 'primary.main',
                color: isSelected ? '#121212' : 'primary.main',
              },
            }}
          >
            {type.label}
          </Button>
        );
      })}
    </Box>
  );
}
