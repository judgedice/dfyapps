import type { ReactNode } from 'react';
import type { RewardIcon } from '../survey';

// DFY line icons: 24×24, 1.75 stroke, round caps and joins. From preview/iconography.html,
// except thumbsUp, which is a Lucide fallback drawn to the same geometry.
const icons: Record<RewardIcon, ReactNode> = {
  thumbsUp: (
    <>
      <path d="M7 10v12" />
      <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z" />
    </>
  ),
  analytics: (
    <>
      <path d="M3 3v18h18" />
      <path d="M18 17V9" />
      <path d="M13 17V5" />
      <path d="M8 17v-3" />
    </>
  ),
  strategy: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.4" />
    </>
  ),
  workflow: (
    <>
      <line x1="6" y1="3" x2="6" y2="15" />
      <circle cx="18" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <path d="M18 9a9 9 0 0 1-9 9" />
    </>
  ),
  continuous: (
    <>
      <path d="M3 12a9 9 0 0 1 9-9 9.7 9.7 0 0 1 6.7 2.7L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.7 9.7 0 0 1-6.7-2.7L3 16" />
      <path d="M3 21v-5h5" />
    </>
  ),
  layers: (
    <>
      <path d="M12 2 2 7l10 5 10-5-10-5Z" />
      <path d="m2 17 10 5 10-5" />
      <path d="m2 12 10 5 10-5" />
    </>
  ),
  visibility: (
    <>
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8" />
      <path d="M12 17v4" />
    </>
  ),
};

/** How long the reward stays on screen, in ms. Matches the CSS animation. */
export const REWARD_DURATION = 1600;

const SPARKS = 8;

/**
 * Section-complete reward: the icon draws in, a ring and sparks radiate out, then it all fades.
 * Purely visual; App announces the label through its own live region.
 */
export function Reward({ icon, label }: { icon: RewardIcon; label: string }) {
  return (
    <div className="reward" aria-hidden="true">
      <div className="reward__badge">
        <span className="reward__ring" />
        {Array.from({ length: SPARKS }, (_, i) => (
          <span
            key={i}
            className="reward__spark"
            style={{ transform: `rotate(${(360 / SPARKS) * i}deg)` }}
          >
            <span />
          </span>
        ))}
        <svg
          className="reward__icon"
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {icons[icon]}
        </svg>
        <span className="reward__label">{label}</span>
      </div>
    </div>
  );
}
