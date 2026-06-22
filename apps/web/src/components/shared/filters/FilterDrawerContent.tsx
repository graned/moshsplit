import { Box, Typography, alpha } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { Check as CheckIcon } from '@mui/icons-material';
import { MobileDrawer } from '../MobileDrawer';

interface FilterOption {
  value: string;
  label: string;
  count?: number;
}

interface FilterDrawerContentProps {
  title: string;
  options: FilterOption[];
  selectedValues: string[];
  onToggle: (value: string) => void;
  onClear: () => void;
  open: boolean;
  onClose: () => void;
  fullScreen?: boolean;
}

/**
 * Reusable filter list content for the drawer.
 * Renders a vertical list of filter options inside a MobileDrawer.
 */
export function FilterDrawerContent({
  title,
  options,
  selectedValues,
  onToggle,
  onClear,
  open,
  onClose,
  fullScreen,
}: FilterDrawerContentProps) {
  const { t } = useTranslation();
  const hasSelection = selectedValues.length > 0;

  return (
    <MobileDrawer
      open={open}
      onClose={onClose}
      title={title}
      fullScreen={fullScreen}
      clearAction={
        hasSelection ? (
          <Box onClick={onClear} sx={{ cursor: 'pointer', py: 0.25, px: 1 }}>
            <Typography
              sx={{
                fontSize: '0.7rem',
                fontWeight: 600,
                color: alpha('#fff', 0.4),
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                '&:hover': { color: alpha('#fff', 0.6) },
              }}
            >
              {t('components.filterDrawer.clearAll')}
            </Typography>
          </Box>
        ) : undefined
      }
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
        {/* Options list */}
        <Box
          sx={{
            flex: 1,
            overflowY: 'auto',
            pt: 1,
            pb: 2,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {options.map((option, index) => {
            const isSelected = option.value === 'all' ? selectedValues.length === 0 : selectedValues.includes(option.value);

            return (
              <Box
                key={option.value}
                onClick={() => onToggle(option.value)}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  py: 1.25,
                  px: 0.5,
                  cursor: 'pointer',
                  borderBottom:
                    index < options.length - 1
                      ? '1px solid'
                      : 'none',
                  borderColor: alpha('#fff', 0.06),
                  transition: 'all 0.15s ease',
                  '&:active': {
                    bgcolor: alpha('#fff', 0.04),
                  },
                  minHeight: 52,
                }}
              >
                <Box
                  sx={{
                    width: 22,
                    height: 22,
                    borderRadius: 1,
                    border: '1.5px solid',
                    borderColor: isSelected ? '#F59E0B' : alpha('#fff', 0.2),
                    bgcolor: isSelected ? '#F59E0B' : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    mr: 1.5,
                    transition: 'all 0.15s ease',
                  }}
                >
                  {isSelected && (
                    <CheckIcon sx={{ fontSize: 14, color: '#121212', fontWeight: 800 }} />
                  )}
                </Box>

                <Typography
                  sx={{
                    flex: 1,
                    fontSize: '0.9rem',
                    fontWeight: isSelected ? 700 : 500,
                    color: isSelected ? '#fff' : alpha('#fff', 0.7),
                    transition: 'color 0.15s ease',
                  }}
                >
                  {option.label}
                </Typography>

                {option.count !== undefined && (
                  <Typography
                    sx={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: isSelected ? '#F59E0B' : alpha('#fff', 0.35),
                      ml: 1,
                    }}
                  >
                    {option.count}
                  </Typography>
                )}
              </Box>
            );
          })}
        </Box>
      </Box>
    </MobileDrawer>
  );
}
