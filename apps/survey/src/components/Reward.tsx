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
  // A carrier pigeon with a note in its beak. The wing flaps as it flies in.
  pigeon: (
    <>
      <circle cx="15.4" cy="6" r="2.1" />
      <circle cx="16" cy="5.7" r=".45" fill="currentColor" stroke="none" />
      <path d="M17.4 5.6 19.3 6.5 17.3 6.9" />
      <path d="M13.6 7.4C10.8 8 8 9.7 6.2 12L2 13.6l2.6 1.5c1.4 2.5 4.8 3.5 7.9 2.5 3.1-1 4.6-3.6 4.2-6.6-.2-1.4.1-2.5.6-3.1" />
      <path className="reward__wing" d="M7.6 12.6c2-1.8 5-1.7 6.5.3-2.5 1.7-5 1.5-6.5-.3z" />
      <path d="M10.6 17.9v2.6M13.2 17.3v2.8" />
      <rect x="18.9" y="7.3" width="4.2" height="3" rx=".5" />
      <path d="m19.1 7.6 2 1.4 1.9-1.4" />
    </>
  ),
  // The hand sweeps once around the clock face.
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path className="reward__hand" d="M12 7v5l3.2 2" />
    </>
  ),
  // A check mark that draws itself inside a circle.
  approved: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path className="reward__draw" pathLength={1} d="m8 12.3 2.8 2.8L16.3 9.5" />
    </>
  ),
  // A document with a magnifier that sweeps across it.
  proof: (
    <>
      <path d="M14 3H6.5A1.5 1.5 0 0 0 5 4.5v15A1.5 1.5 0 0 0 6.5 21H12M14 3l4 4v3M14 3v4h4" />
      <path d="M8 9h3M8 12.5h2.5" />
      <g className="reward__loupe">
        <circle cx="16.5" cy="15.5" r="3" />
        <path d="m18.7 17.7 2.3 2.3" />
      </g>
    </>
  ),
  // A clipboard checklist.
  planner: (
    <>
      <rect x="5" y="4.5" width="14" height="16.5" rx="2" />
      <path d="M9 3h6v3H9z" />
      <path d="m8.5 11 1.3 1.3 2.2-2.3M14 11h2M8.5 16l1.3 1.3 2.2-2.3M14 16h2" />
    </>
  ),
  // A bee that buzzes in place.
  bee: (
    <>
      <ellipse cx="10.5" cy="14.5" rx="6" ry="4.3" />
      <path d="M8.6 10.5v8M12 10.3v8.4" />
      <circle cx="18.3" cy="13.4" r="2" />
      <path d="M19.2 11.6l1.3-2.4M17.6 11.5l-.4-2.5" />
      <path d="M4.5 14.6 2.4 15" />
      <path d="M9.6 10.3C7 9.5 5.8 7 7.2 5.6s4 .3 4.2 3.2" />
      <path d="M11.6 10.2c.4-2.8 2.4-4.5 4.1-3.6s1 3.6-1.6 4.6" />
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
    <div className={`reward reward--${icon}`} aria-hidden="true">
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
