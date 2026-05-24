import { Box, alpha } from '@mui/material';

interface Tab {
  value: string;
  label: string;
  count: number;
}

interface MobileTabBarProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (value: string) => void;
}

/**
 * Mobile-friendly horizontal scrollable tabs.
 * Styled to match existing tab row in Settle page.
 */
export function MobileTabBar({ tabs, activeTab, onChange }: MobileTabBarProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        gap: 0.75,
        overflowX: 'auto',
        scrollbarWidth: 'none',
        '::-webkit-scrollbar': { display: 'none' },
        WebkitOverflowScrolling: 'touch',
      }}
    >
      {tabs.map((tab) => {
        const isSelected = activeTab === tab.value;

        return (
          <Box
            key={tab.value}
            onClick={() => onChange(tab.value)}
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
              cursor: 'pointer',
              bgcolor: isSelected ? 'primary.main' : alpha('#1E1E1E', 0.5),
              color: isSelected ? '#121212' : alpha('#fff', 0.6),
              border: '1px solid',
              borderColor: isSelected ? 'primary.main' : alpha('#fff', 0.1),
              transition: 'all 0.15s ease',
              minHeight: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {tab.label} ({tab.count})
          </Box>
        );
      })}
    </Box>
  );
}