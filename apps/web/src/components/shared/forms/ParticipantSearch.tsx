import { useState, useMemo, useRef, useEffect } from 'react';
import {
  Box,
  Typography,
  TextField,
  Avatar,
  alpha,
  useTheme,
  useMediaQuery,
  InputAdornment,
  CircularProgress,
} from '@mui/material';
import {
  Search as SearchIcon,
  Check as CheckIcon,
  PersonAdd as PersonAddIcon,
} from '@mui/icons-material';
import { useUserCache } from '../../../hooks/useUserCache';

interface ParticipantSearchProps {
  value: string[];
  onChange: (userIds: string[]) => void;
  currentUserId?: string;
  users?: UserInfo[];
  placeholder?: string;
}

export function ParticipantSearch({
  value,
  onChange,
  currentUserId,
  users,
  placeholder = 'Search survivors by name...',
}: ParticipantSearchProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const { getAllUsers, isLoading, isReady } = useUserCache();
  const allUsers = useMemo(() => users ?? getAllUsers(), [users, getAllUsers]);

  const filteredUsers = useMemo(() => {
    if (!query.trim()) return allUsers;
    const q = query.toLowerCase();
    return allUsers.filter((u) => {
      const name = `${u.firstName} ${u.lastName}`.toLowerCase();
      return name.includes(q) || u.email.toLowerCase().includes(q);
    });
  }, [allUsers, query]);

  const toggleUser = (userId: string) => {
    onChange(value.includes(userId) ? value.filter((id) => id !== userId) : [...value, userId]);
  };

  const selectAll = () => {
    const allIds = allUsers.map((u) => u.id);
    onChange(allIds);
  };

  const deselectAll = () => {
    onChange([]);
  };

  const handleFocus = () => {
    setIsFocused(true);
  };

  const handleBlur = () => {
    setTimeout(() => setIsFocused(false), 200);
  };

  useEffect(() => {
    if (isFocused && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isFocused]);

  if (!isReady && isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress size={24} sx={{ color: 'primary.main' }} />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        py: isMobile ? 1 : 2,
        display: 'flex',
        flexDirection: 'column',
        maxHeight: isMobile ? 200 : 260,
        overflow: 'hidden',
      }}
    >
      {/* Search Input */}
      <Box sx={{ flexShrink: 0 }}>
        <TextField
          inputRef={inputRef}
          fullWidth
          size="small"
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          sx={{
            mb: isMobile ? 1.5 : 2,
            '& .MuiInputBase-root': {
              borderRadius: 2,
              bgcolor: alpha('#fff', 0.03),
            },
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ fontSize: isMobile ? 18 : 20, color: 'text.secondary' }} />
              </InputAdornment>
            ),
          }}
        />
      </Box>

      {/* Select all / none */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: isMobile ? 1 : 1.5, flexShrink: 0 }}>
        <Box sx={{ display: 'flex', gap: isMobile ? 0.5 : 1 }}>
          <Box
            onClick={selectAll}
            sx={{
              px: isMobile ? 1 : 1.5,
              py: 0.5,
              borderRadius: 1,
              cursor: 'pointer',
              bgcolor: alpha('#fff', 0.05),
              border: `1px solid ${alpha('#fff', 0.1)}`,
              transition: 'all 0.15s ease',
              '&:hover': { bgcolor: alpha('#fff', 0.08) },
            }}
          >
            <Typography sx={{ fontSize: isMobile ? '0.7rem' : '0.75rem', fontWeight: 600, color: 'text.secondary' }}>
              Select All
            </Typography>
          </Box>
          <Box
            onClick={deselectAll}
            sx={{
              px: isMobile ? 1 : 1.5,
              py: 0.5,
              borderRadius: 1,
              cursor: 'pointer',
              bgcolor: alpha('#fff', 0.05),
              border: `1px solid ${alpha('#fff', 0.1)}`,
              transition: 'all 0.15s ease',
              '&:hover': { bgcolor: alpha('#fff', 0.08) },
            }}
          >
            <Typography sx={{ fontSize: isMobile ? '0.7rem' : '0.75rem', fontWeight: 600, color: 'text.secondary' }}>
              Clear All
            </Typography>
          </Box>
        </Box>
        <Typography sx={{ fontSize: isMobile ? '0.7rem' : '0.75rem', fontWeight: 600, color: 'primary.main' }}>
          {value.length} selected
        </Typography>
      </Box>

      {/* User list */}
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: isMobile ? 0.25 : 0.5,
          overflowY: 'auto',
        }}
      >
        {filteredUsers.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <PersonAddIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
            <Typography variant="body2" color="text.secondary">
              No survivors found in this realm.
            </Typography>
          </Box>
        ) : (
          filteredUsers.map((user) => {
            const isSelected = value.includes(user.id);
            const isCurrentUser = user.id === currentUserId;

            return (
              <Box
                key={user.id}
                onClick={() => toggleUser(user.id)}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: isMobile ? 1 : 1.5,
                  p: isMobile ? 1 : 1.5,
                  borderRadius: 2,
                  cursor: 'pointer',
                  border: `1px solid ${isSelected ? alpha(theme.palette.primary.main, 0.4) : 'transparent'}`,
                  bgcolor: isSelected ? alpha(theme.palette.primary.main, 0.08) : 'transparent',
                  transition: 'all 0.15s ease',
                  '&:hover': {
                    bgcolor: isSelected ? alpha(theme.palette.primary.main, 0.12) : alpha('#fff', 0.03),
                  },
                }}
              >
                <Avatar
                  sx={{
                    width: isMobile ? 36 : 40,
                    height: isMobile ? 36 : 40,
                    bgcolor: isSelected ? 'primary.main' : 'action.disabledBackground',
                    color: isSelected ? '#121212' : 'text.secondary',
                    fontWeight: 700,
                    fontSize: isMobile ? '0.875rem' : '1rem',
                  }}
                >
                  {user.firstName.charAt(0)}
                </Avatar>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography
                    variant="body2"
                    fontWeight={600}
                    noWrap
                    color={isSelected ? 'text.primary' : 'text.secondary'}
                    sx={{ fontSize: isMobile ? '0.8rem' : '0.875rem' }}
                  >
                    {user.firstName} {user.lastName}
                    {isCurrentUser && (
                      <Typography
                        component="span"
                        variant="caption"
                        color="primary.main"
                        sx={{ ml: 1, fontWeight: 600 }}
                      >
                        (You)
                      </Typography>
                    )}
                  </Typography>
                  <Typography variant="caption" color="text.muted" noWrap sx={{ fontSize: isMobile ? '0.65rem' : '0.75rem' }}>
                    {user.email}
                  </Typography>
                </Box>
                {isSelected && <CheckIcon sx={{ color: 'primary.main', fontSize: isMobile ? 18 : 20 }} />}
              </Box>
            );
          })
        )}
      </Box>
    </Box>
  );
}
