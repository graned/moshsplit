import { Box, Typography, IconButton, useTheme, alpha } from '@mui/material';
import { FilterList as FilterIcon, Search as SearchIcon } from '@mui/icons-material';

interface FeedSectionHeaderProps {
  title?: string;
  onFilterClick?: () => void;
  onSearchClick?: () => void;
}

export function FeedSectionHeader({ title = 'The Battle Log', onFilterClick, onSearchClick }: FeedSectionHeaderProps) {
  const theme = useTheme();

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        mb: 2,
      }}
    >
      <Typography
        variant="h4"
        sx={{
          fontWeight: 600,
          letterSpacing: '-0.01em',
        }}
      >
        {title}
      </Typography>

      <Box sx={{ display: 'flex', gap: 1 }}>
        <IconButton
          onClick={onFilterClick}
          size="small"
          sx={{
            bgcolor: 'elevated.main',
            color: 'text.secondary',
            '&:hover': {
              bgcolor: alpha(theme.palette.primary.main, 0.1),
              color: 'primary.main',
            },
          }}
        >
          <FilterIcon fontSize="small" />
        </IconButton>
        <IconButton
          onClick={onSearchClick}
          size="small"
          sx={{
            bgcolor: 'elevated.main',
            color: 'text.secondary',
            '&:hover': {
              bgcolor: alpha(theme.palette.primary.main, 0.1),
              color: 'primary.main',
            },
          }}
        >
          <SearchIcon fontSize="small" />
        </IconButton>
      </Box>
    </Box>
  );
}
