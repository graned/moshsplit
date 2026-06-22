import { Typography, alpha } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { PersonAdd as PersonAddIcon } from '@mui/icons-material';
import { MemberJoinActivity } from '../../../../api/activity.api';
import { UserInfo } from '../../../../api/users.api';
import { MobileFeedCard } from '../MobileFeedCard';

const INDIGO_ACCENT = '#6366f1';

interface MobileMemberJoinCardProps {
  activity: MemberJoinActivity;
  joinedUser?: UserInfo;
  currentUserId?: string;
}

/**
 * Mobile-only simplified member join card.
 * No Tooltip, no Avatar — just PersonAdd icon (indigo/violet), name, tagline, date.
 */
export function MobileMemberJoinCard({
  activity,
  joinedUser,
  currentUserId,
}: MobileMemberJoinCardProps) {
  const { t } = useTranslation();
  const isTargetCurrentUser = activity.user_id === currentUserId;

  const displayName =
    activity.user_name ||
    (joinedUser
      ? `${joinedUser.firstName} ${joinedUser.lastName}`.trim() || joinedUser.email
      : null);

  const createdDate = new Date(activity.created_at);
  const isValidDate = !isNaN(createdDate.getTime());

  return (
    <MobileFeedCard
      accentColor={INDIGO_ACCENT}
      icon={
        <PersonAddIcon
          sx={{
            color: INDIGO_ACCENT,
            fontSize: 18,
          }}
        />
      }
      rightContent={
        isValidDate ? (
          <Typography
            sx={{
              display: 'block',
              fontSize: '0.6rem',
              color: 'text.disabled',
              mt: 1.5,
            }}
          >
            {createdDate.toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            })}
          </Typography>
        ) : undefined
      }
    >
      {/* Join message */}
        <Typography
          sx={{
            fontSize: '0.85rem',
            fontWeight: 600,
            lineHeight: 1.3,
            mb: 0.25,
          }}
        >
        {isTargetCurrentUser
          ? t('components.memberJoinCard.youJoined')
          : `${displayName || 'Someone'} ${t('components.memberJoinCard.joined')}`}
      </Typography>

      {/* Metal tagline */}
        <Typography
          sx={{
            fontSize: '0.6rem',
            color: alpha('#fff', 0.4),
            fontStyle: 'italic',
          }}
        >
        {isTargetCurrentUser
          ? t('components.memberJoinCard.taglineYou')
          : t('components.memberJoinCard.taglineOther')}
      </Typography>
    </MobileFeedCard>
  );
}
