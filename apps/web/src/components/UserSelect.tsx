import { useMemo } from 'react';
import { Autocomplete, TextField, Avatar, Chip, Box, CircularProgress, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { usersApi, UserListItem } from '../api/users.api';

interface UserSelectProps {
  label?: string;
  placeholder?: string;
  value: string[];
  onChange: (userIds: string[]) => void;
  disabled?: boolean;
  limit?: number;
}

export function UserSelect({
  label = 'Select users',
  placeholder = 'Search users...',
  value,
  onChange,
  disabled = false,
  limit,
}: UserSelectProps) {
  const { data: users = [], isLoading, error } = useQuery({
    queryKey: ['users', 'list'],
    queryFn: usersApi.list,
    staleTime: 5 * 60 * 1000, // 5 minutes - cache user list
  });

  const selectedUsers = useMemo(() => {
    return users.filter((u) => value.includes(u.id));
  }, [users, value]);

  // Limit the displayed users if needed
  const displayUsers = limit ? users.slice(0, limit) : users;

  const handleChange = (_: React.SyntheticEvent, newValue: UserListItem[]) => {
    onChange(newValue.map((u) => u.id));
  };

  if (error) {
    return (
      <Typography variant="body2" color="error">
        Failed to load users
      </Typography>
    );
  }

  return (
    <Autocomplete
      multiple
      options={displayUsers}
      value={selectedUsers}
      onChange={handleChange}
      disabled={disabled || isLoading}
      loading={isLoading}
      getOptionLabel={(option) => option.name || option.email}
      filterOptions={(x) => x} // Don't filter - show all options
      isOptionEqualToValue={(option, val) => option.id === val.id}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          placeholder={placeholder}
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <>
                {isLoading ? <CircularProgress color="inherit" size={20} /> : null}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
        />
      )}
      renderOption={(props, option) => {
        const { key, ...rest } = props;
        return (
          <Box
            key={key}
            component="li"
            {...rest}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              py: 1,
            }}
          >
            <Avatar
              src={option.avatarUrl}
              alt={option.name}
              sx={{ width: 32, height: 32, fontSize: 14 }}
            >
              {option.name?.charAt(0).toUpperCase() || '?'}
            </Avatar>
            <Box>
              <Typography variant="body2">{option.name || option.email}</Typography>
              {option.name && (
                <Typography variant="caption" color="text.secondary">
                  {option.email}
                </Typography>
              )}
            </Box>
          </Box>
        );
      }}
      renderTags={(tagValue, getTagProps) =>
        tagValue.map((option, index) => {
          const { key, ...tagProps } = getTagProps({ index });
          return (
            <Chip
              key={key}
              {...tagProps}
              avatar={
                <Avatar src={option.avatarUrl} sx={{ width: 24, height: 24 }}>
                  {option.name?.charAt(0).toUpperCase() || '?'}
                </Avatar>
              }
              label={option.name || option.email}
              size="small"
            />
          );
        })
      }
    />
  );
}