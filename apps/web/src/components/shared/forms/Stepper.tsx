import { Box, Typography, useTheme, useMediaQuery } from '@mui/material';
import { Check as CheckIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

export interface StepDefinition {
  label: string;
  icon?: React.ReactNode;
}

interface StepperProps {
  steps: StepDefinition[];
  activeStep: number;
}

export function Stepper({ steps, activeStep }: StepperProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { t } = useTranslation('components');

  if (isMobile) {
    return (
      <Box sx={{ width: '100%', py: 1.5, px: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.75 }}>
          <Typography variant="caption" sx={{ fontSize: '0.7rem', fontWeight: 700, color: 'primary.main', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {t('stepper.stepOf', { current: activeStep + 1, total: steps.length })}
          </Typography>
          <Typography variant="caption" sx={{ fontSize: '0.7rem', fontWeight: 600, color: 'text.secondary' }}>
            {steps[activeStep]?.label}
          </Typography>
        </Box>
        <Box sx={{ width: '100%', height: 3, borderRadius: 2, bgcolor: 'action.disabledBackground', overflow: 'hidden' }}>
          <Box
            sx={{
              height: '100%',
              width: `${((activeStep + 1) / steps.length) * 100}%`,
              bgcolor: 'primary.main',
              borderRadius: 2,
              transition: 'width 0.3s ease',
            }}
          />
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%', py: 2 }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}
      >
        {steps.map((step, index) => {
          const isCompleted = index < activeStep;
          const isActive = index === activeStep;

          return (
            <Box
              key={step.label}
              sx={{
                display: 'flex',
                alignItems: 'center',
                flex: index < steps.length - 1 ? 1 : 'none',
              }}
            >
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  position: 'relative',
                  zIndex: 1,
                }}
              >
                <Box
                  sx={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.875rem',
                    fontWeight: 700,
                    transition: 'all 0.3s ease',
                    bgcolor: isCompleted
                      ? 'primary.main'
                      : isActive
                        ? 'primary.main'
                        : theme.palette.action.disabledBackground,
                    color: isCompleted || isActive ? '#121212' : 'text.secondary',
                    boxShadow: isActive ? `0 0 0 4px ${theme.palette.primary.main}33` : 'none',
                  }}
                >
                  {isCompleted ? <CheckIcon sx={{ fontSize: 18 }} /> : index + 1}
                </Box>
                <Typography
                  variant="caption"
                  sx={{
                    mt: 0.75,
                    fontSize: '0.65rem',
                    fontWeight: isActive ? 700 : 500,
                    color: isActive ? 'primary.main' : isCompleted ? 'text.primary' : 'text.muted',
                    textAlign: 'center',
                    maxWidth: 72,
                    lineHeight: 1.2,
                  }}
                >
                  {step.label}
                </Typography>
              </Box>

              {index < steps.length - 1 && (
                <Box
                  sx={{
                    flex: 1,
                    height: 2,
                    mx: 1,
                    mb: 3.5,
                    borderRadius: 1,
                    bgcolor: index < activeStep ? 'primary.main' : theme.palette.action.disabledBackground,
                    transition: 'background-color 0.3s ease',
                  }}
                />
              )}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
