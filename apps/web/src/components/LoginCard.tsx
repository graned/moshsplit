import { useState } from 'react';
import { Card, CardContent, Button, Box, CircularProgress } from '@mui/material';
import { AuthHeroLogo } from './AuthHeroLogo';
import { LoginForm } from './LoginForm';
import { InvitationOnlyNotice } from './InvitationOnlyNotice';
import { useTranslation } from 'react-i18next';
import type { LoginCredentials } from '../pages/auth/types';
import { authApi } from '../api/auth.api';
import { useAuthStore } from '@moshsplit/auth-react';

interface LoginCardProps {
	onSubmit: (credentials: LoginCredentials) => Promise<void>;
	isLoading: boolean;
	error: string | null;
}

export function LoginCard({ onSubmit, isLoading, error }: LoginCardProps) {
	const { t } = useTranslation();
	const [externalLoading, setExternalLoading] = useState(false);
	const [externalError, setExternalError] = useState<string | null>(null);
	const setSession = useAuthStore((state) => state.setSession);

	const handleExternalLogin = async () => {
		setExternalLoading(true);
		setExternalError(null);

		try {
			// For testing - in production this would come from the external app
			const apiToken = import.meta.env.VITE_TEST_API_TOKEN || 'sat_test_token';
			const testEmail = import.meta.env.VITE_TEST_USER_EMAIL || 'admin@example.com';

			const response = await authApi.externalLogin({
				apiToken,
				email: testEmail,
			});

			// Store the session
			setSession(
				response.userId,
				response.accessToken,
				response.refreshToken,
				response.emailVerified,
				false
			);

			// Redirect to app
			window.location.href = '/app/home';
		} catch (err) {
			setExternalError(err instanceof Error ? err.message : 'External login failed');
		} finally {
			setExternalLoading(false);
		}
	};

	return (
		<Card
			sx={{
				width: '100%',
				maxWidth: 420,
				background: `
          linear-gradient(180deg, rgba(26, 26, 26, 0.98) 0%, rgba(18, 18, 18, 0.98) 100%),
          url('/assets/bg-texture-1.svg')
        `,
				backgroundSize: 'cover',
				backgroundPosition: 'center',
				border: '1px solid rgba(245, 158, 11, 0.2)',
				borderRadius: '4px',
				boxShadow: '0 24px 80px rgba(0, 0, 0, 0.55)',
				backdropFilter: 'blur(10px)',
				position: 'relative',
				overflow: 'visible',
				'&::before': {
					content: '""',
					position: 'absolute',
					top: 0,
					left: 0,
					right: 0,
					bottom: 0,
					background: 'linear-gradient(145deg, rgba(255,255,255,0.03) 0%, transparent 50%, transparent 100%)',
					pointerEvents: 'none',
					borderRadius: '4px',
				},
			}}
		>
			<CardContent
				sx={{
					p: { xs: 3, sm: 4 },
				}}
			>
				<AuthHeroLogo
					title={t('auth.login.title')}
					subtitle={t('auth.login.tagline')}
				/>

				<LoginForm
					onSubmit={onSubmit}
					isLoading={isLoading}
					error={error}
				/>

				<Box sx={{ mt: 3, mb: 2 }}>
					<Button
						fullWidth
						variant="outlined"
						onClick={handleExternalLogin}
						disabled={externalLoading}
						sx={{
							borderColor: 'rgba(245, 158, 11, 0.5)',
							color: 'text.primary',
							'&:hover': {
								borderColor: 'primary.main',
								backgroundColor: 'rgba(245, 158, 11, 0.1)',
							},
						}}
					>
						{externalLoading ? <CircularProgress size={24} /> : 'Join with Pitboss'}
					</Button>
					{externalError && (
						<Box sx={{ mt: 1, color: 'error.main', fontSize: '0.875rem', textAlign: 'center' }}>
							{externalError}
						</Box>
					)}
				</Box>

				<InvitationOnlyNotice />
			</CardContent>
		</Card>
	);
}
