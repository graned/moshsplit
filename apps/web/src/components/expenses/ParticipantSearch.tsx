import { useState, useMemo, useRef, useEffect } from 'react';
import {
  Box,
  Typography,
  TextField,
  Avatar,
  alpha,
  useTheme,
  InputAdornment,
  CircularProgress,
} from '@mui/material';
import {
  Search as SearchIcon,
  Check as CheckIcon,
  PersonAdd as PersonAddIcon,
} from '@mui/icons-material';
import { useUserCache } from '../../hooks/useUserCache';

interface ParticipantSearchProps {
  value: string[];
  onChange: (userIds: string[]) => void;
  currentUserId?: string;
  placeholder?: string;
}

export function ParticipantSearch({
  value,
  onChange,
  currentUserId,
  placeholder = 'Search survivors by name...',
}: ParticipantSearchProps) {
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const { getAllUsers, isLoading, isReady } = useUserCache();
  const allUsers = useMemo(() => getAllUsers(), [getAllUsers]);

  const filteredUsers = useMemo(() => {
    if (!query.trim()) return allUsers;
    const q = query.toLowerCase();
    return allUsers.filter((u) => {
      const name = `${u.firstName} ${u.lastName}`.toLowerCase();
      return name.includes(q) || u.email.toLowerCase().includes(q);
    });
  }, [allUsers, query]);

  const selectedUsers = useMemo(() => {
    return allUsers.filter((u) => value.includes(u.id));
  }, [allUsers, value]);

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
        py: 2,
        display: 'flex',
        flexDirection: 'column',
        maxHeight: 320,
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
            mb: 2,
            '& .MuiOutlinedInput-root': {
              borderRadius: 2,
              bgcolor: alpha('#fff', 0.03),
            },
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
              </InputAdornment>
            ),
          }}
        />
      </Box>

      {/* Selected users as chips */}
      {selectedUsers.length > 0 && (
        <Box
          sx={{
            flexShrink: 0,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 1,
            mb: 2,
            maxHeight: 64,
            overflowY: 'auto',
          }}
        >
          {selectedUsers.map((user) => (
            <Box
              key={user.id}
              onClick={() => toggleUser(user.id)}
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.75,
                px: 1.5,
                py: 0.5,
                borderRadius: 100,
                bgcolor: alpha(theme.palette.primary.main, 0.15),
                border: `1px solid ${alpha(theme.palette.primary.main, 0.3)}`,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                '&:hover': {
                  bgcolor: alpha(theme.palette.primary.main, 0.25),
                },
              }}
            >
              <Avatar
                sx={{
                  width: 24,
                  height: 24,
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  bgcolor: 'primary.main',
                  color: '#121212',
                }}
              >
                {user.firstName.charAt(0)}
              </Avatar>
              <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: 'text.primary' }}>
                {user.id === currentUserId ? 'You' : `${user.firstName} ${user.lastName}`.trim()}
              </Typography>
              <CheckIcon sx={{ fontSize: 14, color: 'primary.main' }} />
            </Box>
          ))}
        </Box>
      )}

      {/* Select all / none */}
      <Box sx={{ display: 'flex', gap: 1, mb: 1.5, flexShrink: 0 }}>
        <Box
          onClick={selectAll}
          sx={{
            px: 1.5,
            py: 0.5,
            borderRadius: 1,
            cursor: 'pointer',
            bgcolor: alpha('#fff', 0.05),
            border: `1px solid ${alpha('#fff', 0.1)}`,
            transition: 'all 0.15s ease',
            '&:hover': { bgcolor: alpha('#fff', 0.08) },
          }}
        >
          <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: 'text.secondary' }}>
            Select All
          </Typography>
        </Box>
        <Box
          onClick={deselectAll}
          sx={{
            px: 1.5,
            py: 0.5,
            borderRadius: 1,
            cursor: 'pointer',
            bgcolor: alpha('#fff', 0.05),
            border: `1px solid ${alpha('#fff', 0.1)}`,
            transition: 'all 0.15s ease',
            '&:hover': { bgcolor: alpha('#fff', 0.08) },
          }}
        >
          <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: 'text.secondary' }}>
            Clear All
          </Typography>
        </Box>
      </Box>

      {/* User list */}
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 0.5,
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
                  gap: 1.5,
                  p: 1.5,
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
                    width: 40,
                    height: 40,
                    bgcolor: isSelected ? 'primary.main' : 'action.disabledBackground',
                    color: isSelected ? '#121212' : 'text.secondary',
                    fontWeight: 700,
                    fontSize: '1rem',
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
                  <Typography variant="caption" color="text.muted" noWrap>
                    {user.email}
                  </Typography>
                </Box>
                {isSelected && <CheckIcon sx={{ color: 'primary.main', fontSize: 20 }} />}
              </Box>
            );
          })
        )}
      </Box>
    </Box>
  );
}
