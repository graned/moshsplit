import { useEffect } from 'react';
import { Outlet } from 'react-router';
import { useUserCacheStore } from '../stores/userCacheStore';

interface UserCacheProviderProps {
  children?: React.ReactNode;
}

export function UserCacheProvider({ children }: UserCacheProviderProps) {
  const fetchAll = useUserCacheStore((state) => state.fetchAll);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return children ? <>{children}</> : <Outlet />;
}
