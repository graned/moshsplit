export interface PainThreshold {
  label: string;
  minCents: number;
  prefix?: string;
  suffix?: string;
}

export const PAIN_THRESHOLDS: PainThreshold[] = [
  { label: 'nuisance',  minCents: 1,       prefix: 'Pain level: ' },
  { label: 'moderate',  minCents: 10_000,  prefix: 'Pain level: ' },
  { label: 'severe',    minCents: 50_000,  prefix: 'Pain level: ' },
  { label: 'critical',  minCents: 100_000, prefix: 'Pain level: ' },
  { label: 'legendary', minCents: 500_000, prefix: 'Pain level: ' },
];

export interface PainLevelResult {
  text: string;
  label: string;
}

export function getPainLevel(cents: number): PainLevelResult {
  if (cents <= 0) {
    return { text: 'No pain... yet', label: 'none' };
  }

  for (let i = PAIN_THRESHOLDS.length - 1; i >= 0; i--) {
    const t = PAIN_THRESHOLDS[i];
    if (cents >= t.minCents) {
      return {
        text: `${t.prefix ?? ''}${t.label}${t.suffix ?? ''}`,
        label: t.label,
      };
    }
  }

  return { text: 'No pain... yet', label: 'none' };
}
