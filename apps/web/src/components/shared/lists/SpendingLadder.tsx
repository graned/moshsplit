import { Typography } from '@mui/material';
import SpendingLadderItem from './SpendingLadderItem';

export interface SpendingLadderEntry {
  rank: number;
  displayName: string;
  amount: number;
}

export interface LogoDef {
  src: string;
  width?: number;
  height?: number;
}

interface SpendingLadderProps {
  entries: SpendingLadderEntry[];
  currency: string;
  formatAmount: (cents: number, currency: string) => string;
  /** Banner images keyed by rank (e.g. { 1: '/path/banner_first.svg', 2: '/path/second_banner.svg' }) */
  banners?: Record<number, string>;
  /** Logo images keyed by rank (e.g. { 1: { src: '/doggo_first.svg', width: 105, height: 105 } }) */
  logos?: Record<number, LogoDef>;
}

export default function SpendingLadder({
  entries,
  currency,
  formatAmount,
  banners,
  logos,
}: SpendingLadderProps) {
  return (
    <>
      {entries.map(({ rank, displayName, amount }) => {
        const top3 = rank <= 3;
        const bannerSrc = banners?.[rank];
        const logoDef = logos?.[rank];

        return (
          <SpendingLadderItem
            key={`rank-${rank}`}
            highlighted={top3}
            bannerSrc={bannerSrc}
            left={
              logoDef ? (
                <img src={logoDef.src} alt={`#${rank}`} style={{ width: logoDef.width, height: logoDef.height, display: 'block' }} />
              ) : (
                <Typography sx={{ fontSize: rank <= 3 ? '1.35rem' : '1rem', fontWeight: 900, textAlign: 'center', fontFamily: '"Metal Mania", serif' }}>
                  {rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`}
                </Typography>
              )
            }
            displayName={displayName}
            amount={formatAmount(amount, currency)}
          />
        );
      })}
    </>
  );
}
