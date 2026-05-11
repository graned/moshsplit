import { Box, Typography, Card, CardContent, Button } from '@mui/material';
import { Event as EventIcon, Add as AddIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

function EventsPage() {
  const { t } = useTranslation();

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" fontWeight={700}>
          {t('app.events')}
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />}>
          New Event
        </Button>
      </Box>

      <Card>
        <CardContent sx={{ py: 8, textAlign: 'center' }}>
          <Box
            sx={{
              width: 80,
              height: 80,
              borderRadius: '50%',
              backgroundColor: 'primary.main',
              opacity: 0.1,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              mb: 3,
            }}
          >
            <EventIcon sx={{ fontSize: 40, color: 'primary.main' }} />
          </Box>
          <Typography variant="h6" fontWeight={600} gutterBottom>
            {t('placeholder.events')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('placeholder.eventsDesc')}
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}

export default EventsPage;