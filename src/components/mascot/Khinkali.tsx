import { useId } from 'react';
import type { Mood } from './lines';
import './mascot.css';

/*
 * Хінкалик, drawn as a rig of separate parts (body, knot, pleats, eyes,
 * mouth, arms, legs) so CSS can breathe, blink, walk and swing him without
 * the parts coming apart. The 56×60 frame and the knot tip at (28, 4) are
 * fixed: MascotLayer hangs him from that point when he is dragged.
 *
 * Style: one warm outline (#B08F5A, 1.3), soft volume from radial gradients
 * (no filters), pleats as a dark crease plus a light ridge beside it.
 */

const OUTLINE = '#B08F5A';

/** Pleats run from the knot down to the shoulders; [end x, end y, bulge]. */
const PLEATS: Array<[number, number, number]> = [
  [8.6, 34.5, -3.6],
  [12.2, 31.2, -2.8],
  [17.2, 29.4, -1.8],
  [22.6, 28.6, -0.8],
  [28, 28.4, 0],
  [33.4, 28.6, 0.8],
  [38.8, 29.4, 1.8],
  [43.8, 31.2, 2.8],
  [47.4, 34.5, 3.6],
];
const PLEAT_ROOT = { x: 28, y: 15.6 };

function pleatPath(endX: number, endY: number, bulge: number, shift = 0): string {
  const midX = (PLEAT_ROOT.x + endX) / 2 + bulge + shift;
  const midY = (PLEAT_ROOT.y + endY) / 2 - 1.5;
  return `M${(PLEAT_ROOT.x + shift * 0.3).toFixed(2)} ${PLEAT_ROOT.y} Q${midX.toFixed(2)} ${midY.toFixed(2)} ${(endX + shift).toFixed(2)} ${endY}`;
}

function Mouth({ mood }: { mood: Mood }) {
  if (mood === 'happy') {
    return (
      <g className="mk-mouth is-open">
        <path d="M23.4 46.6 Q28 53 32.6 46.6 Q28 48.2 23.4 46.6 Z" fill="#5B2F24" stroke="#3A2A22" strokeWidth="1.1" strokeLinejoin="round" />
        <ellipse cx="28" cy="49.7" rx="2.1" ry="1.05" fill="#E08A76" />
      </g>
    );
  }
  const d = mood === 'sad'
    ? 'M24.2 50.2 Q28 46.8 31.8 50.2'
    : mood === 'smug'
      ? 'M24 48.6 Q29.6 51.4 33 46.6'
      : 'M25 48.6 Q28 49.4 31 48.6';
  return <path className="mk-mouth" d={d} />;
}

/**
 * Хінкалик: a pleated dumpling with a twisted top knot, sparkling dot eyes, a
 * mouth per mood and stubby mitts and feet.
 */
export function Khinkali({ mood, walking, facing, still }: {
  mood: Mood;
  walking: boolean;
  facing: 'left' | 'right';
  still: boolean;
}) {
  const id = useId().replace(/:/g, '');
  const dough = `mk-dough-${id}`;
  const knot = `mk-knot-${id}`;
  const blush = `mk-blush-${id}`;
  const classes = ['mk', walking ? 'is-walking' : '', still ? 'is-still' : '', `is-${mood}`].filter(Boolean).join(' ');

  return (
    <svg className={classes} viewBox="0 0 56 60" width="56" height="60" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id={dough} cx="0.38" cy="0.34" r="0.78">
          <stop offset="0" stopColor="#FFF9EC" />
          <stop offset="0.55" stopColor="#F3E6C8" />
          <stop offset="1" stopColor="#D9C39A" />
        </radialGradient>
        <linearGradient id={knot} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#F6EBD0" />
          <stop offset="1" stopColor="#D8C092" />
        </linearGradient>
        <radialGradient id={blush} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#E9A07F" stopOpacity="0.75" />
          <stop offset="1" stopColor="#E9A07F" stopOpacity="0" />
        </radialGradient>
      </defs>

      <g className="mk-turn" style={{ transform: facing === 'left' ? 'scaleX(-1)' : undefined }}>
        <g className="mk-leg mk-leg-l">
          <rect x="18.2" y="52.4" width="6.6" height="7" rx="3.3" fill="#EADBB8" stroke={OUTLINE} strokeWidth="1.2" />
          <path d="M19 57.6 H24" stroke="#CDB283" strokeWidth="1.1" strokeLinecap="round" />
        </g>
        <g className="mk-leg mk-leg-r">
          <rect x="31.2" y="52.4" width="6.6" height="7" rx="3.3" fill="#EADBB8" stroke={OUTLINE} strokeWidth="1.2" />
          <path d="M32 57.6 H37" stroke="#CDB283" strokeWidth="1.1" strokeLinecap="round" />
        </g>

        <g className="mk-body">
          <g className="mk-arm mk-arm-l">
            <path d="M9.2 39.6 Q4.4 42.6 4.8 48.4" stroke={OUTLINE} strokeWidth="4.8" fill="none" strokeLinecap="round" />
            <path d="M9.2 39.6 Q4.4 42.6 4.8 48.4" stroke="#EEDFBE" strokeWidth="2.8" fill="none" strokeLinecap="round" />
          </g>
          <g className="mk-arm mk-arm-r">
            <path d="M46.8 39.6 Q51.6 42.6 51.2 48.4" stroke={OUTLINE} strokeWidth="4.8" fill="none" strokeLinecap="round" />
            <path d="M46.8 39.6 Q51.6 42.6 51.2 48.4" stroke="#EEDFBE" strokeWidth="2.8" fill="none" strokeLinecap="round" />
          </g>

          <path
            className="mk-dough"
            d="M28 13.4 C18 15.2 7.4 25.6 6.6 39.6 C6 50.8 15 56.4 28 56.4 C41 56.4 50 50.8 49.4 39.6 C48.6 25.6 38 15.2 28 13.4 Z"
            fill={`url(#${dough})`}
            stroke={OUTLINE}
            strokeWidth="1.3"
          />
          {/* Soft warm shade along the bottom gives him weight. */}
          <path d="M9.6 46 C13 53.6 21 55.4 28 55.4 C35 55.4 43 53.6 46.4 46 C41 50.6 35 52 28 52 C21 52 15 50.6 9.6 46 Z" fill="#C9AE7E" opacity="0.28" />

          <g className="mk-pleats" fill="none" strokeLinecap="round">
            {PLEATS.map(([x, y, bulge]) => (
              <g key={x}>
                <path d={pleatPath(x, y, bulge)} stroke="#C7AB79" strokeWidth="1.25" />
                <path d={pleatPath(x, y, bulge, 0.95)} stroke="#FFF8E8" strokeWidth="0.8" opacity="0.85" />
              </g>
            ))}
          </g>

          <g className="mk-knot">
            <path
              d="M23.6 16 C23.2 11.6 24.8 7.8 26.4 5.2 C27.2 3.8 29.6 3.4 30.5 4.9 C31.3 6.3 30 7.6 29.3 8.8 C31.4 10 32.6 12.8 32.4 16 C30.2 17.2 25.8 17.2 23.6 16 Z"
              fill={`url(#${knot})`}
              stroke={OUTLINE}
              strokeWidth="1.2"
              strokeLinejoin="round"
            />
            <path d="M24.4 13.6 Q28 11.8 31.8 13" stroke="#C7AB79" strokeWidth="1" fill="none" strokeLinecap="round" />
            <path d="M25 10.6 Q27.8 9.2 30.6 10" stroke="#C7AB79" strokeWidth="0.9" fill="none" strokeLinecap="round" />
            <path d="M26.6 6.4 Q27.8 5 29.4 5.6" stroke="#FFF8E8" strokeWidth="0.8" fill="none" strokeLinecap="round" />
          </g>

          {/* A highlight on the dough, upper left. */}
          <ellipse cx="17.4" cy="35" rx="3.2" ry="1.8" fill="#FFFFFF" opacity="0.45" transform="rotate(-28 17.4 35)" />

          <ellipse className="mk-cheek" cx="17.2" cy="46.4" rx="4" ry="2.6" fill={`url(#${blush})`} />
          <ellipse className="mk-cheek" cx="38.8" cy="46.4" rx="4" ry="2.6" fill={`url(#${blush})`} />

          <g className="mk-eyes">
            <ellipse cx="22" cy="41.6" rx="2.4" ry="2.7" fill="#2B2A29" />
            <ellipse cx="34" cy="41.6" rx="2.4" ry="2.7" fill="#2B2A29" />
            <circle cx="22.8" cy="40.6" r="0.85" fill="#FFFFFF" />
            <circle cx="34.8" cy="40.6" r="0.85" fill="#FFFFFF" />
          </g>
          {mood === 'sad' ? (
            <g className="mk-brows"><path d="M18.8 38.6 Q21.6 37.6 24.2 36.4" /><path d="M37.2 38.6 Q34.4 37.6 31.8 36.4" /></g>
          ) : null}
          {mood === 'smug' ? (
            <g className="mk-brows"><path d="M19.2 38 L24.6 37.4" /><path d="M31.4 36.6 L36.8 37.9" /></g>
          ) : null}
          <Mouth mood={mood} />
        </g>

        {mood === 'happy' && !still ? (
          <g className="mk-steam" fill="none" stroke="#F4EEE2" strokeWidth="1.2" strokeLinecap="round">
            <path d="M22 4 Q20 1.6 22 -0.8" />
            <path d="M34.4 5 Q36.4 2.6 34.4 0.2" />
          </g>
        ) : null}
      </g>
    </svg>
  );
}
