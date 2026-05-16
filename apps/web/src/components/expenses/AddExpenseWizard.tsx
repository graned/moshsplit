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
  { label: 'Amount' },
  { label: 'Category' },
  { label: 'What For' },
  { label: 'Survivors' },
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
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>(members.map((m) => m.user_id));

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

  const toggleMember = (userId: string) => {
    setSelectedMemberIds((prev) => (prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]));
  };

  const selectAll = () => {
    setSelectedMemberIds(members.map((m) => m.user_id));
  };

  const deselectAll = () => {
    setSelectedMemberIds([]);
  };

  // -----------------------------------------------------------------------
  // Validation per step
  // -----------------------------------------------------------------------

  const canProceed = (): boolean => {
    switch (step) {
      case 0:
        return amountCents > 0;
      case 1:
        return true; // category is optional
      case 2:
        return title.trim().length > 0;
      case 3:
        return selectedMemberIds.length > 0;
      case 4:
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
        description: description.trim() || undefined,
        amount_cents: amountCents,
        paid_by: currentUser.id,
        split_type: 'equal',
        split_data: { shares: selectedMemberIds },
        expense_type: category || undefined,
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

  const renderAmountStep = () => (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 4 }}>
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ mb: 2, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600 }}
      >
        How Much Damage?
      </Typography>

      {/* Large amount display */}
      <Box
        sx={{
          position: 'relative',
          mb: 3,
        }}
      >
        <Typography
          variant="h2"
          sx={{
            fontSize: { xs: '3rem', sm: '4rem' },
            fontWeight: 800,
            color: amount ? 'primary.main' : 'text.muted',
            letterSpacing: '-0.03em',
            lineHeight: 1,
          }}
        >
          {amount ? formatCurrency(parseFloat(amount)) : `0${groupCurrency === 'USD' ? '.00' : ''}`}
        </Typography>
      </Box>

      <TextField
        label="Amount"
        value={amount}
        onChange={(e) => handleAmountChange(e.target.value)}
        fullWidth
        type="text"
        inputMode="decimal"
        placeholder="0.00"
        autoFocus
        sx={{
          maxWidth: 320,
          '& .MuiInputBase-input': {
            fontSize: '1.5rem',
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

      {amount && selectedMemberIds.length > 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2, textAlign: 'center' }}>
          Each survivor owes{' '}
          <Typography component="span" fontWeight={700} color="primary.main">
            {formatCurrency(equalShare / 100)}
          </Typography>
        </Typography>
      )}
    </Box>
  );

  const renderCategoryStep = () => (
    <Box sx={{ py: 4 }}>
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ mb: 3, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600, textAlign: 'center' }}
      >
        What Kind of Damage?
      </Typography>

      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 2,
          justifyContent: 'center',
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
                gap: 1,
                p: 2,
                minWidth: 96,
                borderRadius: 3,
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
                  width: 48,
                  height: 48,
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
              >
                {cat.label}
              </Typography>
              {isSelected && <CheckIcon sx={{ fontSize: 16, color: 'primary.main' }} />}
            </Box>
          );
        })}
      </Box>

      {category && (
        <Box sx={{ mt: 3, textAlign: 'center' }}>
          <Chip
            label={`${CATEGORIES.find((c) => c.value === category)?.label} selected`}
            color="primary"
            variant="outlined"
            onDelete={() => setCategory('')}
          />
        </Box>
      )}
    </Box>
  );

  const renderTitleStep = () => (
    <Box sx={{ py: 4, display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600, textAlign: 'center' }}
      >
        What For?
      </Typography>

      <TextField
        label="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        fullWidth
        autoFocus
        placeholder="e.g. Round of beers, Dinner at the pub..."
        sx={{
          '& .MuiInputBase-input': {
            fontSize: '1.25rem',
            fontWeight: 600,
          },
        }}
      />

      <TextField
        label="Description (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        fullWidth
        multiline
        rows={3}
        placeholder="Any extra details..."
      />

      {title && (
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
          <Typography variant="body1" fontWeight={600} sx={{ mt: 0.5 }}>
            {title}
          </Typography>
          {description && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {description}
            </Typography>
          )}
        </Box>
      )}
    </Box>
  );

  const renderSurvivorsStep = () => (
    <Box sx={{ py: 4 }}>
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ mb: 1, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600, textAlign: 'center' }}
      >
        Select Survivors
      </Typography>

      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mb: 2 }}>
        Who shares this expense? ({selectedMemberIds.length} of {members.length})
      </Typography>

      {/* Select all / none */}
      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', mb: 3 }}>
        <Button size="small" variant="outlined" onClick={selectAll} sx={{ fontSize: '0.75rem' }}>
          All
        </Button>
        <Button size="small" variant="outlined" onClick={deselectAll} sx={{ fontSize: '0.75rem' }}>
          None
        </Button>
      </Box>

      {/* Member list */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
          maxHeight: 320,
          overflowY: 'auto',
        }}
      >
        {members.map((member) => {
          const isSelected = selectedMemberIds.includes(member.user_id);
          const isCurrentUser = member.user_id === currentUser.id;
          const displayName = member.user_name || member.user_email || 'Unknown';
          const initials = displayName.charAt(0).toUpperCase();

          return (
            <Box
              key={member.user_id}
              onClick={() => toggleMember(member.user_id)}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                p: 1.5,
                borderRadius: 2,
                cursor: 'pointer',
                border: 1,
                borderColor: isSelected ? 'primary.main' : 'divider',
                bgcolor: isSelected ? alpha('#F59E0B', 0.08) : 'transparent',
                transition: 'all 0.15s ease',
                '&:hover': {
                  bgcolor: isSelected ? alpha('#F59E0B', 0.12) : alpha('#fff', 0.03),
                },
              }}
            >
              <Avatar
                sx={{
                  width: 40,
                  height: 40,
                  bgcolor: isSelected ? 'primary.main' : 'action.disabledBackground',
                  color: isSelected ? '#121212' : 'text.secondary',
                  fontWeight: 700,
                  fontSize: '1rem',
                }}
              >
                {initials}
              </Avatar>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography
                  variant="body2"
                  fontWeight={600}
                  noWrap
                  color={isSelected ? 'text.primary' : 'text.secondary'}
                >
                  {displayName}
                  {isCurrentUser && (
                    <Typography component="span" variant="caption" color="primary.main" sx={{ ml: 1, fontWeight: 600 }}>
                      (You)
                    </Typography>
                  )}
                </Typography>
                {!member.user_name && member.user_email && (
                  <Typography variant="caption" color="text.muted" noWrap>
                    {member.user_email}
                  </Typography>
                )}
              </Box>
              {isSelected && <CheckIcon sx={{ color: 'primary.main', fontSize: 20 }} />}
            </Box>
          );
        })}
      </Box>

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

  const renderConfirmStep = () => {
    const categoryName = CATEGORIES.find((c) => c.value === category)?.label;

    return (
      <Box sx={{ py: 4 }}>
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
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <SummaryRow label="Title" value={title} />
            {description && <SummaryRow label="Description" value={description} />}
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
        return renderAmountStep();
      case 1:
        return renderCategoryStep();
      case 2:
        return renderTitleStep();
      case 3:
        return renderSurvivorsStep();
      case 4:
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
