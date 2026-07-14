import { useMemo } from 'react';
import { Outlet, useParams } from 'react-router';
import { Box } from '@mui/material';
import { useAuthStore } from '@moshsplit/auth-react';

import MobileBottomNav from './MobileBottomNav';

function MobileAppLayout() {
  const params = useParams();

  const userId = useAuthStore((state) => state.userId);
  const firstName = useAuthStore((state) => state.firstName);
  const lastName = useAuthStore((state) => state.lastName);
  const userEmail = useAuthStore((state) => state.userEmail);

  const eventId = params.eventId;

  const currentUser = useMemo(
    () => ({
      id: userId || '',
      firstName: firstName || '',
      lastName: lastName || '',
      email: userEmail || '',
    }),
    [userId, firstName, lastName, userEmail]
  );

  const hasEvent = !!eventId;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          overflow: 'auto',
          WebkitOverflowScrolling: 'touch',
          pb: hasEvent ? 'calc(64px + env(safe-area-inset-bottom, 0px))' : 0,
          background: `
            linear-gradient(180deg, rgba(18, 18, 18, 0.75) 0%, rgba(26, 26, 26, 0.75) 50%, rgba(18, 18, 18, 0.75) 100%),
            url('/moshsplit/assets/background-moshsplit.webp')
          `,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      >
        <Outlet context={{ eventId, currentUser }} />
      </Box>

      {hasEvent && <MobileBottomNav />}
    </Box>
  );
}

export default MobileAppLayout;
