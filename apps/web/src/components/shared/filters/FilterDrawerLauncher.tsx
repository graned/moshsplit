import { Box, IconButton, Typography, alpha } from '@mui/material';
import { FilterList as FilterListIcon } from '@mui/icons-material';

interface ActiveFilter {
  value: string;
  label: string;
}

interface FilterDrawerLauncherProps {
  activeFilters: ActiveFilter[];
  onClick: () => void;
}

const AMBER = '#F59E0B';

export function FilterDrawerLauncher({
  activeFilters,
  onClick,
}: FilterDrawerLauncherProps) {
  const hasActiveFilters = activeFilters.length > 0;
  const displayLabel = hasActiveFilters ? activeFilters[0]?.label : 'All';
  const extraCount = hasActiveFilters ? activeFilters.length - 1 : 0;

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
      <IconButton
        onClick={onClick}
        size="small"
        sx={{
          width: 32,
          height: 32,
          borderRadius: 1.5,
          bgcolor: alpha('#1E1E1E', 0.5),
          border: '1px solid',
          borderColor: alpha('#fff', 0.1),
          color: AMBER,
          position: 'relative',
          '&:hover': {
            bgcolor: alpha(AMBER, 0.1),
            borderColor: AMBER,
          },
          transition: 'all 0.15s ease',
        }}
      >
        <FilterListIcon sx={{ fontSize: 16 }} />
        <Box
          sx={{
            position: 'absolute',
            top: 4,
            right: 4,
            width: 6,
            height: 6,
            borderRadius: '50%',
            bgcolor: AMBER,
            border: '1px solid',
            borderColor: '#121212',
          }}
        />
      </IconButton>

      {displayLabel && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            px: 1,
            py: 0.25,
            borderRadius: 100,
            border: '1px solid',
            borderColor: alpha(AMBER, 0.3),
            bgcolor: alpha(AMBER, 0.12),
            cursor: 'default',
          }}
        >
          <Typography
            sx={{
              fontSize: '0.65rem',
              fontWeight: 700,
              color: AMBER,
              textTransform: 'uppercase',
              letterSpacing: '0.03em',
              maxWidth: 100,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {displayLabel}
          </Typography>
          {extraCount > 0 && (
            <Typography
              sx={{
                fontSize: '0.6rem',
                fontWeight: 600,
                color: alpha('#fff', 0.5),
              }}
            >
              +{extraCount}
            </Typography>
          )}
        </Box>
      )}
    </Box>
  );
}