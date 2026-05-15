import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import {
  Box,
  Typography,
  IconButton,
  Button,
  Tabs,
  Tab,
  CircularProgress,
  Alert,
  alpha,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  LocationOn as LocationIcon,
  CalendarToday as CalendarIcon,
} from '@mui/icons-material';

import { useAuthStore } from '@moshsplit/auth-react';
import { groupsApi } from '../../api/groups.api';
import { expensesApi, ExpenseListItem } from '../../api/expenses.api';
import { ExpensesTable } from '../../components/groups/ExpensesTable';
import { mockEvent, mockExpenses, mockMembers, mockUserId } from '../../api/mock-data';

function PageNav({ page, totalPages, setPage }: { page: number; totalPages: number; setPage: (fn: (p: number) => number) => void }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 2 }}>
      <Button size="small" variant="outlined" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
        Previous
      </Button>
      <Typography variant="body2" color="text.secondary">
        Page {page + 1} of {totalPages}
      </Typography>
      <Button size="small" variant="outlined" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
        Next
      </Button>
    </Box>
  );
}

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

function EventDetailPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const userId = useAuthStore((state) => state.userId);

  const [tab, setTab] = useState(0);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 20;

  const {
    data: event,
    isLoading: eventLoading,
    error: eventError,
  } = useQuery({
    queryKey: ['event', eventId],
    queryFn: async () => {
      if (!eventId) throw new Error('No event ID');
      return groupsApi.get(eventId);
    },
    enabled: !!eventId,
  });

  const {
    data: expensesData,
    isLoading: expensesLoading,
  } = useQuery({
    queryKey: ['expenses', eventId],
    queryFn: async () => {
      if (!eventId || !userId) return { data: [] as ExpenseListItem[], hasMore: false };
      return expensesApi.list(eventId, userId, undefined, 200);
    },
    enabled: !!eventId && !!userId,
  });

  const {
    data: members,
    isLoading: membersLoading,
  } = useQuery({
    queryKey: ['event-members', eventId],
    queryFn: async () => {
      if (!eventId) return [];
      return groupsApi.listMembers(eventId);
    },
    enabled: !!eventId,
  });

  const isLoading = eventLoading || expensesLoading || membersLoading;

  const expenses = expensesData?.data || [];
  const resolvedEvent = event || (eventId === mockEvent.id ? mockEvent : undefined);
  const resolvedMembers = (!isLoading && (!members || members.length === 0)) ? mockMembers : (members || []);
  const resolvedUserId = userId || mockUserId;
  const resolvedExpenses = (!isLoading && expenses.length === 0 && eventId === mockEvent.id) ? mockExpenses : expenses;
  const totalPages = Math.max(1, Math.ceil(resolvedExpenses.length / PAGE_SIZE));
  const clampedPage = Math.min(page, totalPages - 1);
  const pageExpenses = resolvedExpenses.slice(clampedPage * PAGE_SIZE, (clampedPage + 1) * PAGE_SIZE);

  const totalCents = resolvedExpenses.reduce((sum, e) => sum + e.amount_cents, 0);
  const totalStr = totalCents === 0 ? '—' : `€${(totalCents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const userShareCents = Math.round(totalCents / (resolvedMembers?.length || 1));
  const userOwesStr = userShareCents === 0 ? '€0' : `€${(userShareCents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const settled = resolvedExpenses.filter((e) => e.deleted_at).length;
  const totalExpenses = resolvedExpenses.length;

  const memberMap = new Map((resolvedMembers || []).map((m) => [m.user_id, m.user_name || m.user_email || 'Unknown']));
  const getPayerName = (userId: string) => memberMap.get(userId) || 'Unknown';
  const rootRef = useRef<HTMLDivElement>(null);
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    let parent: HTMLElement | null = el.parentElement;
    while (parent) {
      const style = window.getComputedStyle(parent);
      if (
        style.overflowY === 'auto' || style.overflowY === 'scroll' ||
        style.overflow === 'auto' || style.overflow === 'scroll'
      ) break;
      parent = parent.parentElement;
    }
    const container = parent || document.documentElement;
    const onScroll = () => setScrollY(container.scrollTop);
    container.addEventListener('scroll', onScroll, { passive: true });
    return () => container.removeEventListener('scroll', onScroll);
  }, []);

  if (eventError && !resolvedEvent) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">Failed to load event details</Alert>
      </Box>
    );
  }

  const heroMaxHeight = 320;
  const heroMinHeight = 72;
  const scrollRange = 200;
  const progress = Math.min(scrollY / scrollRange, 1);
  const heroHeight = heroMaxHeight - (heroMaxHeight - heroMinHeight) * progress;
  const compact = progress > 0.5;

  return (
    <Box ref={rootRef}>
      {/* === Sticky header === */}
      <Box sx={{ position: 'sticky', top: 0, zIndex: 10 }}>
        {/* Hero */}
        <Box
          sx={{
            height: heroHeight,
            position: 'relative',
            overflow: 'hidden',
            background: `linear-gradient(135deg, #4A2F0A 0%, #3D2208 50%, #1A1A1A 100%)`,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            px: compact ? 2 : 4,
            pb: compact ? 1 : 3,
          }}
        >
          <Box sx={{
            position: 'absolute', inset: 0,
            background: `linear-gradient(to bottom, transparent 40%, #121212 100%)`,
          }} />

          {/* Back button */}
          <IconButton
            onClick={() => navigate('/app/events')}
            sx={{
              position: 'absolute', top: 12, left: compact ? 8 : 16,
              zIndex: 2, color: '#fff',
              bgcolor: alpha('#000', 0.35),
              '&:hover': { bgcolor: alpha('#000', 0.55) },
              width: 32, height: 32,
            }}
          >
            <ArrowBackIcon sx={{ fontSize: 20 }} />
          </IconButton>

          {isLoading ? (
            <Box sx={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'center', pb: 2 }}>
              <CircularProgress />
            </Box>
          ) : resolvedEvent ? (
            <Box sx={{ position: 'relative', zIndex: 1, ml: compact ? 0 : 0 }}>
              <Typography
                noWrap={compact}
                sx={{
                  fontSize: compact ? '1.15rem' : '2.5rem',
                  fontWeight: compact ? 700 : 800,
                  lineHeight: 1.15,
                  transition: 'font-size 0.25s, font-weight 0.25s',
                  mb: compact ? 0 : 0.5,
                }}
              >
                {resolvedEvent.name}
              </Typography>

              {/* Subtitle: location • date — always visible */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
                <LocationIcon sx={{ fontSize: compact ? 13 : 15, color: 'primary.main' }} />
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: compact ? '0.75rem' : '0.875rem' }}>
                  {resolvedEvent.description || 'Location TBD'}
                </Typography>
                <Typography variant="body2" color="primary.main" sx={{ fontWeight: 700 }}>·</Typography>
                <CalendarIcon sx={{ fontSize: compact ? 13 : 15, color: 'primary.main' }} />
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: compact ? '0.75rem' : '0.875rem' }}>
                  {formatDate(resolvedEvent.created_at)}
                </Typography>
              </Box>
            </Box>
          ) : null}
        </Box>

        {/* Summary bar */}
        {!isLoading && resolvedEvent && (
          <Box sx={{
            display: 'flex',
            gap: compact ? 1 : 2,
            px: compact ? 1.5 : 3,
            py: compact ? 1.5 : 2.5,
            bgcolor: 'background.default',
            transition: 'padding 0.25s, gap 0.25s',
          }}>
            {[
              { value: totalStr, label: 'Total', color: 'primary.main' },
              { value: userOwesStr, label: 'You Owe', color: userShareCents > 0 ? 'error.light' : 'success.light' },
              { value: `${settled}/${totalExpenses}`, label: 'Settled', color: 'text.primary' },
            ].map((item) => (
              <Box
                key={item.label}
                sx={{
                  flex: 1,
                  textAlign: 'center',
                  py: compact ? 1 : 2.5,
                  px: compact ? 0.5 : 1,
                  borderRadius: compact ? 2 : 3,
                  bgcolor: 'background.paper',
                  border: 1,
                  borderColor: 'divider',
                  transition: 'padding 0.25s, border-radius 0.25s',
                }}
              >
                <Typography
                  fontWeight={800}
                  color={item.color}
                  sx={{
                    fontSize: compact ? '0.9rem' : '1.75rem',
                    transition: 'font-size 0.25s',
                  }}
                >
                  {item.value}
                </Typography>
                <Typography
                  color="text.secondary"
                  sx={{
                    fontSize: compact ? '0.65rem' : '0.875rem',
                    mt: compact ? 0 : 0.5,
                    transition: 'font-size 0.25s, margin-top 0.25s',
                  }}
                >
                  {item.label}
                </Typography>
              </Box>
            ))}
          </Box>
        )}
      </Box>

      {/* Tabs + content */}
      <Box sx={{ display: 'flex', flexDirection: 'column' }}>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          variant="fullWidth"
          sx={{ borderBottom: 1, borderColor: 'divider', minHeight: 64, bgcolor: 'background.default' }}
        >
          <Tab label="EXPENSES" sx={{ fontWeight: 700, letterSpacing: '0.05em', fontSize: '0.95rem', py: 2.5 }} />
          <Tab label="PARTICIPANTS" sx={{ fontWeight: 700, letterSpacing: '0.05em', fontSize: '0.95rem', py: 2.5 }} />
          <Tab label="SETTLEMENTS" sx={{ fontWeight: 700, letterSpacing: '0.05em', fontSize: '0.95rem', py: 2.5 }} />
        </Tabs>

        <Box sx={{ p: 3 }}>
          {tab === 0 && (
            <>
              <PageNav page={page} totalPages={totalPages} setPage={setPage} />
              <ExpensesTable expenses={pageExpenses} members={resolvedMembers} getPayerName={getPayerName} />
              <Box sx={{ mt: 1 }}>
                <PageNav page={page} totalPages={totalPages} setPage={setPage} />
              </Box>
            </>
          )}

          {tab === 1 && (
            <Box>
              {resolvedMembers.length === 0 ? (
                <Typography variant="body1" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                  No participants yet
                </Typography>
              ) : (
                resolvedMembers.map((member) => (
                  <Box
                    key={member.id}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 2,
                      py: 1.5,
                      px: 2,
                      borderRadius: 2,
                      mb: 1,
                      bgcolor: 'background.paper',
                      border: 1,
                      borderColor: 'divider',
                    }}
                  >
                    <Box
                      sx={{
                        width: 40,
                        height: 40,
                        borderRadius: '50%',
                        bgcolor: 'primary.main',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: '1rem',
                      }}
                    >
                      {(member.user_name || member.user_email || '?').charAt(0).toUpperCase()}
                    </Box>
                    <Box>
                      <Typography variant="body1" fontWeight={600}>
                        {member.user_name || member.user_email || 'Unknown'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {member.role}
                      </Typography>
                    </Box>
                    {member.user_id === resolvedUserId && (
                      <Typography variant="caption" sx={{ ml: 'auto', color: 'primary.main', fontWeight: 600 }}>
                        You
                      </Typography>
                    )}
                  </Box>
                ))
              )}
            </Box>
          )}

          {tab === 2 && (
            <Box>
              <Typography variant="body1" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                Settlements coming soon
              </Typography>
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
}

export default EventDetailPage;
