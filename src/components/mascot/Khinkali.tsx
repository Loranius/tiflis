import type { Mood } from './lines';
import './mascot.css';

const MOUTHS: Record<Mood, string> = {
  happy: 'M23.5 47 Q28 52 32.5 47',
  neutral: 'M25 48.6 L31 48.6',
  sad: 'M24 50.4 Q28 46.6 32 50.4',
  smug: 'M24 48.8 Q29.5 51.2 33 46.8',
};

/**
 * Хінкалик: a pleated dumpling with a twisted top knot, dot eyes, a mouth per
 * mood and stubby arms and legs as separate parts, so CSS can breathe, blink
 * and walk it (all of it switched off under «reduce motion» or `still`).
 */
export function Khinkali({ mood, walking, facing, still }: {
  mood: Mood;
  walking: boolean;
  facing: 'left' | 'right';
  still: boolean;
}) {
  const classes = ['mk', walking ? 'is-walking' : '', still ? 'is-still' : '', `is-${mood}`].filter(Boolean).join(' ');
  return (
    <svg className={classes} viewBox="0 0 56 60" width="56" height="60" aria-hidden="true" focusable="false">
      <g className="mk-turn" style={{ transform: facing === 'left' ? 'scaleX(-1)' : undefined }}>
        <g className="mk-leg mk-leg-l"><rect x="18.5" y="53" width="6" height="7" rx="3" /></g>
        <g className="mk-leg mk-leg-r"><rect x="31.5" y="53" width="6" height="7" rx="3" /></g>
        <g className="mk-body">
          <g className="mk-arm mk-arm-l"><path d="M8.5 40 Q3.5 43 4 48.5" /></g>
          <g className="mk-arm mk-arm-r"><path d="M47.5 40 Q52.5 43 52 48.5" /></g>
          <path className="mk-dough" d="M28 15.5 C14 17.5 4.5 29.5 6 43.5 C7 52.5 16 56.5 28 56.5 C40 56.5 49 52.5 50 43.5 C51.5 29.5 42 17.5 28 15.5 Z" />
          <g className="mk-pleats">
            <path d="M28 17 Q19.5 22 13 33.5" />
            <path d="M28 17 Q23 24 20.5 36" />
            <path d="M28 17 Q28 25 28 36.5" />
            <path d="M28 17 Q33 24 35.5 36" />
            <path d="M28 17 Q36.5 22 43 33.5" />
          </g>
          <path className="mk-knot" d="M24.5 17.5 C24 12 25.5 8.5 27 6 C28 4.4 30.6 4.6 31 6.6 C31.4 8.6 29.4 9.4 28.6 11 C30.6 12 31.8 14.6 31.5 17.5 Z" />
          <ellipse className="mk-cheek" cx="17.5" cy="46.5" rx="3.2" ry="2" />
          <ellipse className="mk-cheek" cx="38.5" cy="46.5" rx="3.2" ry="2" />
          <g className="mk-eyes">
            <circle cx="22" cy="41.5" r="2.3" />
            <circle cx="34" cy="41.5" r="2.3" />
          </g>
          {mood === 'sad' ? (
            <g className="mk-brows"><path d="M19 37 L24 38.4" /><path d="M37 37 L32 38.4" /></g>
          ) : null}
          {mood === 'smug' ? (
            <g className="mk-brows"><path d="M19.5 38.2 L24.5 37.6" /><path d="M31.5 36.8 L36.5 38" /></g>
          ) : null}
          <path className="mk-mouth" d={MOUTHS[mood]} />
        </g>
      </g>
    </svg>
  );
}
