import { Box, Button, alpha } from '@mui/material';

const EXPENSE_TYPES = [
  { value: undefined, label: 'All Items' },
  { value: 'food', label: 'Food & Drink' },
  { value: 'transport', label: 'Travel' },
  { value: 'merch', label: 'Merch' },
  { value: 'beer', label: 'Beer' },
  { value: 'gas', label: 'Gas' },
  { value: 'camping', label: 'Camping' },
] as const;

interface FilterChipsProps {
  selectedType?: string;
  onTypeChange: (type?: string) => void;
}

export function FilterChips({ selectedType, onTypeChange }: FilterChipsProps) {
  return (
    <Box sx={{ display: 'flex', gap: 1, overflowX: 'auto', pb: 1, scrollbarWidth: 'none' }}>
      {EXPENSE_TYPES.map((type) => {
        const isSelected = selectedType === type.value;
        return (
          <Button
            key={type.value ?? 'all'}
            onClick={() => onTypeChange(type.value)}
            variant={isSelected ? 'contained' : 'outlined'}
            size="small"
            sx={{
              px: 2,
              py: 0.75,
              borderRadius: 100,
              whiteSpace: 'nowrap',
              flexShrink: 0,
              fontSize: '0.75rem',
              fontWeight: 700,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              bgcolor: isSelected ? 'primary.main' : 'transparent',
              color: isSelected ? '#121212' : 'text.secondary',
              borderColor: alpha('#534434', 0.3),
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
