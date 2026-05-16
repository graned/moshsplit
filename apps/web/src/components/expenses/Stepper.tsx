import { Box, Typography, useTheme } from '@mui/material';
import { Check as CheckIcon } from '@mui/icons-material';

export interface StepDefinition {
  label: string;
  icon?: React.ReactNode;
}

interface StepperProps {
  steps: StepDefinition[];
  activeStep: number;
}

/**
 * Stepper: Progress indicator for multi-step wizards.
 * Shows numbered circles with connecting lines.
 * Completed steps show a checkmark.
 */
export function Stepper({ steps, activeStep }: StepperProps) {
  const theme = useTheme();

  return (
    <Box sx={{ width: '100%', py: 2 }}>
      {/* Steps row */}
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
              {/* Step circle */}
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
                {/* Label */}
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

              {/* Connector line */}
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
