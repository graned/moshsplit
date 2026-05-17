import { useState, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Avatar,
  Chip,
  alpha,
  InputAdornment,
  CircularProgress,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  ArrowForward as ArrowForwardIcon,
  LocalBar as BeerIcon,
  Restaurant as FoodIcon,
  LocalGasStation as FuelIcon,
  ConfirmationNumber as TicketsIcon,
  Forest as CampingIcon,
  Check as CheckIcon,
} from '@mui/icons-material';

import { Stepper, StepDefinition } from './Stepper';
import { ParticipantSearch } from './ParticipantSearch';
import { CreateExpenseRequest } from '../../api/expenses.api';
import { GroupMember } from '../../api/groups.api';

// ---------------------------------------------------------------------------
// Category definitions
// ---------------------------------------------------------------------------

interface CategoryDef {
  value: string;
  label: string;
  icon: React.ReactNode;
}

const CATEGORIES: CategoryDef[] = [
  { value: 'beer', label: 'Beer', icon: <BeerIcon /> },
  { value: 'food', label: 'Food', icon: <FoodIcon /> },
  { value: 'gas', label: 'Fuel', icon: <FuelIcon /> },
  { value: 'tickets', label: 'Tickets', icon: <TicketsIcon /> },
  { value: 'camping', label: 'Camping', icon: <CampingIcon /> },
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

  const selectedMembers = useMemo(
    () => members.filter((m) => selectedMemberIds.includes(m.user_id)),
    [members, selectedMemberIds]
  );

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
    <Box sx={{ py: 3 }}>
      {/* Title */}
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ mb: 1, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600 }}
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
          mb: 3,
          '& .MuiInputBase-input': {
            fontSize: '1.125rem',
            fontWeight: 600,
          },
        }}
      />

      {/* Amount */}
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ mb: 1, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600 }}
      >
        How badly did the wallet suffer?
      </Typography>
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
            fontSize: { xs: '2.5rem', sm: '3rem' },
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

      {/* Category */}
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ mb: 2, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600 }}
      >
        What kind of damage?
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, justifyContent: 'center' }}>
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
                gap: 0.75,
                p: 1.5,
                minWidth: 80,
                borderRadius: 2,
                cursor: 'pointer',
                border: 2,
                borderColor: isSelected ? 'primary.main' : 'divider',
                bgcolor: isSelected ? alpha('#F59E0B', 0.12) : 'background.paper',
                transition: 'all 0.2s ease',
                '&:hover': {
                  borderColor: 'primary.main',
                  bgcolor: alpha('#F59E0B', 0.06),
                },
              }}
            >
              <Box
                sx={{
                  width: 40,
                  height: 40,
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
                sx={{ fontSize: '0.75rem' }}
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
          mt: 3,
          p: 2,
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
            width: 36,
            height: 36,
            bgcolor: 'primary.main',
            color: '#121212',
            fontWeight: 700,
          }}
        >
          {currentUser.firstName.charAt(0)}
        </Avatar>
        <Box>
          <Typography variant="body2" fontWeight={600} color="text.primary">
            Paid by{' '}
            <Typography component="span" color="primary.main">
              {currentUser.firstName} {currentUser.lastName}
            </Typography>
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {currentUser.email}
          </Typography>
        </Box>
      </Box>
    </Box>
  );

  const renderSurvivorsStep = () => (
    <Box sx={{ py: 2 }}>
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ mb: 1, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600, textAlign: 'center' }}
      >
        Who survived this expense?
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mb: 2 }}>
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
            mt: 2,
            p: 2,
            borderRadius: 2,
            bgcolor: alpha('#F59E0B', 0.08),
            border: 1,
            borderColor: alpha('#F59E0B', 0.2),
            textAlign: 'center',
          }}
        >
          <Typography variant="caption" color="text.secondary">
            Each owes
          </Typography>
          <Typography variant="h6" fontWeight={800} color="primary.main">
            {formatCurrency(equalShare / 100)}
          </Typography>
        </Box>
      )}
    </Box>
  );

  const renderNotesStep = () => (
    <Box sx={{ py: 4, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600, textAlign: 'center' }}
      >
        Notes from the crime scene
      </Typography>

      <Typography variant="caption" color="text.muted" sx={{ textAlign: 'center' }}>
        Optional evidence for the beer tribunal.
      </Typography>

      <TextField
        label="Add context, excuses, or questionable financial decisions"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        fullWidth
        multiline
        rows={5}
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
            p: 2,
            borderRadius: 2,
            bgcolor: alpha('#F59E0B', 0.08),
            border: 1,
            borderColor: alpha('#F59E0B', 0.2),
          }}
        >
          <Typography variant="body2" color="text.secondary">
            Preview:
          </Typography>
          <Typography variant="body1" sx={{ mt: 0.5, fontStyle: 'italic', color: 'text.primary' }}>
            "{notes}"
          </Typography>
        </Box>
      )}
    </Box>
  );

  const renderConfirmStep = () => {
    const categoryName = CATEGORIES.find((c) => c.value === category)?.label;

    return (
      <Box sx={{ py: 3 }}>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mb: 3, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600, textAlign: 'center' }}
        >
          Deploy Financial Damage
        </Typography>

        {/* Summary card */}
        <Box
          sx={{
            p: 3,
            borderRadius: 3,
            bgcolor: 'background.paper',
            border: 1,
            borderColor: 'divider',
          }}
        >
          {/* Amount */}
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <Typography variant="h3" fontWeight={800} color="primary.main" sx={{ fontSize: '2.5rem' }}>
              {formatCurrency(amountCents / 100)}
            </Typography>
          </Box>

          {/* Details */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
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

          {/* Survivors */}
          <Box sx={{ mt: 3 }}>
            <Typography variant="caption" color="text.secondary" fontWeight={600}>
              Survivors:
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
              {selectedMembers.map((m) => {
                const name = m.user_name || m.user_email || '?';
                const isMe = m.user_id === currentUser.id;
                return (
                  <Chip
                    key={m.user_id}
                    avatar={
                      <Avatar sx={{ width: 24, height: 24, fontSize: '0.65rem', fontWeight: 700 }}>
                        {name.charAt(0).toUpperCase()}
                      </Avatar>
                    }
                    label={isMe ? 'You' : name}
                    size="small"
                    variant="outlined"
                    sx={{ fontWeight: 600, fontSize: '0.75rem' }}
                  />
                );
              })}
            </Box>
          </Box>

          {/* Notes */}
          {notes && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="caption" color="text.secondary" fontWeight={600}>
                Notes:
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  mt: 0.5,
                  p: 1.5,
                  borderRadius: 1,
                  bgcolor: alpha('#F59E0B', 0.06),
                  fontStyle: 'italic',
                  color: 'text.secondary',
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
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Stepper */}
      <Stepper steps={STEPS} activeStep={step} />

      {/* Step content */}
      <Box sx={{ flex: 1, overflowY: 'auto', px: 1 }}>{renderStep()}</Box>

      {/* Error */}
      {error && (
        <Typography variant="body2" color="error" sx={{ textAlign: 'center', mt: 1, px: 2 }}>
          {error}
        </Typography>
      )}

      {/* Actions */}
      <Box
        sx={{
          display: 'flex',
          gap: 2,
          p: 2,
          borderTop: 1,
          borderColor: 'divider',
        }}
      >
        {step > 0 ? (
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={back}
            disabled={submitting}
            variant="outlined"
            sx={{ flex: 1 }}
          >
            Back
          </Button>
        ) : (
          <Button onClick={onCancel} variant="outlined" sx={{ flex: 1 }}>
            Cancel
          </Button>
        )}

        {step < STEPS.length - 1 ? (
          <Button
            endIcon={<ArrowForwardIcon />}
            onClick={next}
            disabled={!canProceed()}
            variant="contained"
            sx={{ flex: 1 }}
          >
            Next
          </Button>
        ) : (
          <Button
            onClick={submit}
            disabled={!canProceed() || submitting}
            variant="contained"
            sx={{ flex: 1 }}
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
