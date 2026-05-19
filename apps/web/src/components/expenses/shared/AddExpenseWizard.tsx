import { useState, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Avatar,
  alpha,
  InputAdornment,
  CircularProgress,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  ArrowForward as ArrowForwardIcon,
  Check as CheckIcon,
  MoreHoriz as OtherIcon,
} from '@mui/icons-material';

import { Stepper, StepDefinition } from '../../shared/forms/Stepper';
import { ParticipantSearch } from '../../shared/forms/ParticipantSearch';
import { CreateExpenseRequest } from '../../../api/expenses.api';
import { GroupMember } from '../../../api/groups.api';

// ---------------------------------------------------------------------------
// Category definitions
// ---------------------------------------------------------------------------

interface CategoryDef {
  value: string;
  label: string;
  icon: React.ReactNode;
}

const CATEGORIES: CategoryDef[] = [
  { value: 'beer', label: 'Beer', icon: <img src="/moshsplit/assets/beer-icon.png" alt="" style={{ width: 32, height: 32 }} /> },
  { value: 'food', label: 'Food', icon: <img src="/moshsplit/assets/food-icon.png" alt="" style={{ width: 36, height: 32 }} /> },
  { value: 'gas', label: 'Fuel', icon: <img src="/moshsplit/assets/tank-icon.png" alt="" style={{ width: 32, height: 32 }} /> },
  { value: 'transport', label: 'Transport', icon: <img src="/moshsplit/assets/transport-icon.png" alt="" style={{ width: 36, height: 32 }} /> },
  { value: 'camping', label: 'Camping', icon: <img src="/moshsplit/assets/camping-icon.png" alt="" style={{ width: 32, height: 32 }} /> },
  { value: 'merch', label: 'Merch', icon: <img src="/moshsplit/assets/merch-icon.png" alt="" style={{ width: 32, height: 32 }} /> },
  { value: 'other', label: 'Other', icon: <OtherIcon sx={{ fontSize: 32 }} /> },
];

// ---------------------------------------------------------------------------
// Wizard steps
// ---------------------------------------------------------------------------

const STEPS: StepDefinition[] = [
  { label: 'Basic Info' },
  { label: 'Survivors' },
  { label: 'Notes' },
  { label: 'Confirm' },
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AddExpenseWizardProps {
  members: GroupMember[];
  currentUser: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  groupCurrency?: string;
  onSubmit: (data: CreateExpenseRequest) => Promise<void>;
  onSuccess?: () => void;
  onCancel?: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AddExpenseWizard({
  members,
  currentUser,
  groupCurrency = 'USD',
  onSubmit,
  onSuccess,
  onCancel,
}: AddExpenseWizardProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>(members.map((m) => m.user_id));
  const [notes, setNotes] = useState('');

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  const formatCurrency = useCallback(
    (value: number) =>
      new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: groupCurrency,
      }).format(value),
    [groupCurrency]
  );

  const handleAmountChange = (value: string) => {
    const cleaned = value.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    if (parts.length > 2) return;
    if (parts[1] && parts[1].length > 2) return;
    setAmount(cleaned);
  };

  const amountCents = useMemo(() => Math.round(parseFloat(amount || '0') * 100), [amount]);

  const equalShare = selectedMemberIds.length > 0 ? amountCents / selectedMemberIds.length : 0;

  // -----------------------------------------------------------------------
  // Validation per step
  // -----------------------------------------------------------------------

  const canProceed = (): boolean => {
    switch (step) {
      case 0:
        return title.trim().length > 0 && amountCents > 0;
      case 1:
        return selectedMemberIds.length > 0;
      case 2:
        return true; // notes are optional
      case 3:
        return true;
      default:
        return false;
    }
  };

  // -----------------------------------------------------------------------
  // Navigation
  // -----------------------------------------------------------------------

  const next = () => {
    setError(null);
    if (step < STEPS.length - 1) setStep((s) => s + 1);
  };

  const back = () => {
    setError(null);
    if (step > 0) setStep((s) => s - 1);
  };

  const submit = async () => {
    if (amountCents <= 0) {
      setError('Amount must be greater than 0');
      return;
    }
    if (!title.trim()) {
      setError('Title is required');
      return;
    }
    if (selectedMemberIds.length === 0) {
      setError('Select at least one survivor');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await onSubmit({
        user_id: currentUser.id,
        title: title.trim(),
        description: title.trim(),
        amount_cents: amountCents,
        paid_by: currentUser.id,
        split_type: 'equal',
        split_data: { shares: selectedMemberIds },
        expense_type: category || undefined,
        notes: notes.trim() || undefined,
      });
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to deploy damage');
    } finally {
      setSubmitting(false);
    }
  };

  // -----------------------------------------------------------------------
  // Step renderers
  // -----------------------------------------------------------------------

  const renderBasicInfoStep = () => (
    <Box sx={{ py: isMobile ? 2 : 3 }}>
      {/* Title */}
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ mb: 1, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600, fontSize: isMobile ? '0.7rem' : '0.75rem' }}
      >
        Name the Damage
      </Typography>
      <TextField
        label="What was it?"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        fullWidth
        autoFocus
        placeholder="e.g. Round of beers, Dinner at the pub..."
        sx={{
          mb: isMobile ? 2 : 3,
          '& .MuiInputBase-input': {
            fontSize: isMobile ? '1rem' : '1.125rem',
            fontWeight: 600,
          },
        }}
      />

      {/* Amount */}
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ mb: 1, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600, fontSize: isMobile ? '0.7rem' : '0.75rem' }}
      >
        How badly did the wallet suffer?
      </Typography>

      {isMobile ? (
        <Box sx={{ mb: 2 }}>
          {/* Amount input */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: alpha('#fff', 0.03),
              borderRadius: 2,
              border: 1,
              borderColor: 'divider',
              px: 2,
              py: 1.5,
              mb: 1.5,
            }}
          >
            <Typography variant="h4" fontWeight={800} color="primary.main" sx={{ fontSize: '1.75rem', lineHeight: 1 }}>
              {groupCurrency === 'USD' ? '$' : groupCurrency === 'EUR' ? '€' : groupCurrency}
            </Typography>
            <input
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(e) => handleAmountChange(e.target.value)}
              placeholder="0.00"
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                fontSize: '1.75rem',
                fontWeight: 800,
                color: amount ? theme.palette.primary.main : theme.palette.text.disabled,
                textAlign: 'center',
                letterSpacing: '-0.02em',
                fontFamily: 'inherit',
                width: '100%',
              }}
            />
          </Box>

          {/* Quick amount buttons */}
          <Box sx={{ display: 'flex', gap: 0.75 }}>
            {[5, 10, 20, 50].map((val) => (
              <Box
                key={val}
                onClick={() => handleAmountChange(String(val))}
                sx={{
                  flex: 1,
                  py: 0.75,
                  borderRadius: 1.5,
                  bgcolor: amount === String(val) ? alpha('#F59E0B', 0.15) : alpha('#fff', 0.04),
                  border: 1,
                  borderColor: amount === String(val) ? 'primary.main' : 'divider',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <Typography
                  sx={{
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    color: amount === String(val) ? 'primary.main' : 'text.secondary',
                  }}
                >
                  {groupCurrency === 'USD' ? '$' : groupCurrency === 'EUR' ? '€' : groupCurrency}
                  {val}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>
      ) : (
        <Box
          sx={{
            position: 'relative',
            mb: 3,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <Typography
            variant="h2"
            sx={{
              fontSize: '2.5rem',
              fontWeight: 800,
              color: amount ? 'primary.main' : 'text.muted',
              letterSpacing: '-0.03em',
              lineHeight: 1,
              mb: 2,
            }}
          >
            {amount ? formatCurrency(parseFloat(amount)) : `0${groupCurrency === 'USD' ? '.00' : ''}`}
          </Typography>
          <TextField
            label="Amount"
            value={amount}
            onChange={(e) => handleAmountChange(e.target.value)}
            fullWidth
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            sx={{
              maxWidth: 280,
              '& .MuiInputBase-input': {
                fontSize: '1.25rem',
                fontWeight: 700,
                textAlign: 'center',
                py: 1.5,
              },
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Typography variant="h6" fontWeight={700} color="primary.main">
                    {groupCurrency === 'USD' ? '$' : groupCurrency === 'EUR' ? '€' : groupCurrency}
                  </Typography>
                </InputAdornment>
              ),
            }}
          />
        </Box>
      )}

      {/* Category */}
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ mb: isMobile ? 1.5 : 2, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600, fontSize: isMobile ? '0.7rem' : '0.75rem' }}
      >
        What kind of damage?
      </Typography>
      <Box
        sx={{
          display: 'flex',
          gap: isMobile ? 1 : 1.5,
          overflowX: 'auto',
          pb: 1,
          px: 0.5,
          '&::-webkit-scrollbar': { height: 4 },
          '&::-webkit-scrollbar-track': { bgcolor: 'transparent' },
          '&::-webkit-scrollbar-thumb': { bgcolor: alpha('#fff', 0.1), borderRadius: 100 },
        }}
      >
        {CATEGORIES.map((cat) => {
          const isSelected = category === cat.value;
          return (
            <Box
              key={cat.value}
              onClick={() => setCategory(isSelected ? '' : cat.value)}
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: isMobile ? 0.5 : 0.75,
                p: isMobile ? 1 : 1.5,
                minWidth: isMobile ? 80 : 96,
                borderRadius: 2,
                cursor: 'pointer',
                border: 2,
                borderColor: isSelected ? 'primary.main' : 'divider',
                bgcolor: isSelected ? alpha('#F59E0B', 0.12) : 'background.paper',
                transition: 'all 0.2s ease',
                flexShrink: 0,
                '&:hover': {
                  borderColor: 'primary.main',
                  bgcolor: alpha('#F59E0B', 0.06),
                },
              }}
            >
              <Box
                sx={{
                  width: isMobile ? 40 : 48,
                  height: isMobile ? 40 : 48,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: isSelected ? 'primary.main' : alpha('#F59E0B', 0.15),
                  color: isSelected ? '#121212' : 'primary.main',
                  transition: 'all 0.2s ease',
                }}
              >
                {cat.icon}
              </Box>
              <Typography
                variant="body2"
                fontWeight={isSelected ? 700 : 500}
                color={isSelected ? 'primary.main' : 'text.primary'}
                sx={{ fontSize: isMobile ? '0.7rem' : '0.75rem' }}
              >
                {cat.label}
              </Typography>
              {isSelected && <CheckIcon sx={{ fontSize: 14, color: 'primary.main' }} />}
            </Box>
          );
        })}
      </Box>

      {/* Paid by */}
      <Box
        sx={{
          mt: isMobile ? 2 : 3,
          p: isMobile ? 1.5 : 2,
          borderRadius: 2,
          bgcolor: alpha('#F59E0B', 0.08),
          border: 1,
          borderColor: alpha('#F59E0B', 0.2),
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
        }}
      >
        <Avatar
          sx={{
            width: isMobile ? 32 : 36,
            height: isMobile ? 32 : 36,
            bgcolor: 'primary.main',
            color: '#121212',
            fontWeight: 700,
            fontSize: isMobile ? '0.875rem' : '1rem',
          }}
        >
          {currentUser.firstName.charAt(0)}
        </Avatar>
        <Box>
          <Typography variant="body2" fontWeight={600} color="text.primary" sx={{ fontSize: isMobile ? '0.8rem' : '0.875rem' }}>
            Paid by{' '}
            <Typography component="span" color="primary.main">
              {currentUser.firstName} {currentUser.lastName}
            </Typography>
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: isMobile ? '0.65rem' : '0.75rem' }}>
            {currentUser.email}
          </Typography>
        </Box>
      </Box>
    </Box>
  );

  const renderSurvivorsStep = () => (
    <Box sx={{ py: isMobile ? 1 : 2 }}>
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ mb: 0.5, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600, textAlign: 'center', fontSize: isMobile ? '0.7rem' : '0.75rem' }}
      >
        Who survived this expense?
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mb: isMobile ? 1.5 : 2, fontSize: isMobile ? '0.65rem' : '0.75rem' }}>
        Add the financially responsible victims. ({selectedMemberIds.length} selected)
      </Typography>

      <ParticipantSearch
        value={selectedMemberIds}
        onChange={setSelectedMemberIds}
        currentUserId={currentUser.id}
        placeholder="Search survivors by name..."
      />

      {amount && selectedMemberIds.length > 0 && (
        <Box
          sx={{
            mt: isMobile ? 1.5 : 2,
            p: isMobile ? 1.5 : 2,
            borderRadius: 2,
            bgcolor: alpha('#F59E0B', 0.08),
            border: 1,
            borderColor: alpha('#F59E0B', 0.2),
            textAlign: 'center',
          }}
        >
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: isMobile ? '0.65rem' : '0.75rem' }}>
            Each owes
          </Typography>
          <Typography variant="h6" fontWeight={800} color="primary.main" sx={{ fontSize: isMobile ? '1.1rem' : '1.25rem' }}>
            {formatCurrency(equalShare / 100)}
          </Typography>
        </Box>
      )}
    </Box>
  );

  const renderNotesStep = () => (
    <Box sx={{ py: isMobile ? 2 : 4, display: 'flex', flexDirection: 'column', gap: isMobile ? 1.5 : 2 }}>
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600, textAlign: 'center', fontSize: isMobile ? '0.7rem' : '0.75rem' }}
      >
        Notes from the crime scene
      </Typography>

      <Typography variant="caption" color="text.muted" sx={{ textAlign: 'center', fontSize: isMobile ? '0.65rem' : '0.75rem' }}>
        Optional evidence for the beer tribunal.
      </Typography>

      <TextField
        label="Add context, excuses, or questionable financial decisions"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        fullWidth
        multiline
        rows={isMobile ? 3 : 5}
        placeholder="e.g. 'Dave spilled half his beer on the floor' or 'Emergency tacos after the show'..."
        sx={{
          '& .MuiInputBase-root': {
            borderRadius: 2,
          },
        }}
      />

      {notes && (
        <Box
          sx={{
            p: isMobile ? 1.5 : 2,
            borderRadius: 2,
            bgcolor: alpha('#F59E0B', 0.08),
            border: 1,
            borderColor: alpha('#F59E0B', 0.2),
          }}
        >
          <Typography variant="body2" color="text.secondary" sx={{ fontSize: isMobile ? '0.75rem' : '0.875rem' }}>
            Preview:
          </Typography>
          <Typography variant="body1" sx={{ mt: 0.5, fontStyle: 'italic', color: 'text.primary', fontSize: isMobile ? '0.8rem' : '1rem' }}>
            "{notes}"
          </Typography>
        </Box>
      )}
    </Box>
  );

  const renderConfirmStep = () => {
    const categoryName = CATEGORIES.find((c) => c.value === category)?.label;

    return (
      <Box sx={{ py: isMobile ? 2 : 3 }}>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mb: isMobile ? 2 : 3, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600, textAlign: 'center', fontSize: isMobile ? '0.7rem' : '0.75rem' }}
        >
          Deploy Financial Damage
        </Typography>

        {/* Summary card */}
        <Box
          sx={{
            p: isMobile ? 2 : 3,
            borderRadius: isMobile ? 2 : 3,
            bgcolor: 'background.paper',
            border: 1,
            borderColor: 'divider',
          }}
        >
          {/* Amount */}
          <Box sx={{ textAlign: 'center', mb: isMobile ? 2 : 3 }}>
            <Typography variant="h3" fontWeight={800} color="primary.main" sx={{ fontSize: isMobile ? '2rem' : '2.5rem' }}>
              {formatCurrency(amountCents / 100)}
            </Typography>
          </Box>

          {/* Details */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 1 : 1.5 }}>
            <SummaryRow label="Title" value={title} />
            {categoryName && <SummaryRow label="Category" value={categoryName} />}
            <SummaryRow
              label="Paid by"
              value={`${currentUser.firstName} ${currentUser.lastName}`.trim() || currentUser.email}
            />
            <SummaryRow
              label="Split"
              value={`Equal among ${selectedMemberIds.length} survivor${selectedMemberIds.length > 1 ? 's' : ''}`}
            />
            <SummaryRow label="Each owes" value={formatCurrency(equalShare / 100)} highlight />
          </Box>

          {/* Notes */}
          {notes && (
            <Box sx={{ mt: isMobile ? 1.5 : 2 }}>
              <Typography variant="caption" color="text.secondary" fontWeight={600}>
                Notes:
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  mt: 0.5,
                  p: isMobile ? 1 : 1.5,
                  borderRadius: 1,
                  bgcolor: alpha('#F59E0B', 0.06),
                  fontStyle: 'italic',
                  color: 'text.secondary',
                  fontSize: isMobile ? '0.75rem' : '0.875rem',
                }}
              >
                "{notes}"
              </Typography>
            </Box>
          )}
        </Box>
      </Box>
    );
  };

  // -----------------------------------------------------------------------
  // Main render
  // -----------------------------------------------------------------------

  const renderStep = () => {
    switch (step) {
      case 0:
        return renderBasicInfoStep();
      case 1:
        return renderSurvivorsStep();
      case 2:
        return renderNotesStep();
      case 3:
        return renderConfirmStep();
      default:
        return null;
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {/* Stepper */}
      <Stepper steps={STEPS} activeStep={step} />

      {/* Step content */}
      <Box sx={{ flex: 1, overflowY: 'auto' }}>{renderStep()}</Box>

      {/* Error */}
      {error && (
        <Typography variant="body2" color="error" sx={{ textAlign: 'center', mt: 1, px: 2, fontSize: isMobile ? '0.75rem' : '0.875rem' }}>
          {error}
        </Typography>
      )}

      {/* Actions */}
      <Box
        sx={{
          display: 'flex',
          gap: isMobile ? 1.5 : 2,
          p: isMobile ? 1.5 : 2,
          borderTop: 1,
          borderColor: 'divider',
          flexShrink: 0,
        }}
      >
        {step > 0 ? (
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={back}
            disabled={submitting}
            variant="outlined"
            sx={{ flex: 1, fontSize: isMobile ? '0.8rem' : '0.875rem' }}
          >
            Back
          </Button>
        ) : (
          <Button onClick={onCancel} variant="outlined" sx={{ flex: 1, fontSize: isMobile ? '0.8rem' : '0.875rem' }}>
            Cancel
          </Button>
        )}

        {step < STEPS.length - 1 ? (
          <Button
            endIcon={<ArrowForwardIcon />}
            onClick={next}
            disabled={!canProceed()}
            variant="contained"
            sx={{ flex: 1, fontSize: isMobile ? '0.8rem' : '0.875rem' }}
          >
            Next
          </Button>
        ) : (
          <Button
            onClick={submit}
            disabled={!canProceed() || submitting}
            variant="contained"
            sx={{ flex: 1, fontSize: isMobile ? '0.8rem' : '0.875rem' }}
            startIcon={submitting ? <CircularProgress size={20} color="inherit" /> : undefined}
          >
            {submitting ? 'Deploying...' : 'Deploy Damage'}
          </Button>
        )}
      </Box>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Summary row helper
// ---------------------------------------------------------------------------

function SummaryRow({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        py: 0.5,
      }}
    >
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography
        variant="body2"
        fontWeight={highlight ? 700 : 600}
        color={highlight ? 'primary.main' : 'text.primary'}
        sx={{ textAlign: 'right', maxWidth: '60%' }}
        noWrap
      >
        {value}
      </Typography>
    </Box>
  );
}
