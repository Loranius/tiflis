import { useId } from 'react';
import type { Mood } from './lines';
import './mascot.css';

/*
 * Хінкалик, drawn after the owner's reference sheet (front / side / top /
 * bottom, November 2026): a pear-shaped dumpling with a wide soft belly, a
 * narrow neck and a pouch knot with a wavy rim, big wide-set oval eyes, a cat
 * mouth «ω», droplet arms, stubby legs, a thick dark-brown outline and flat
 * cel shading on the right and bottom.
 *
 * It is a rig of separate parts (body, knot, pleats, eyes, mouth, arms, legs)
 * so CSS can breathe, blink, walk and swing him. The 56×60 frame and the knot
 * tip at (28, 4) are fixed: MascotLayer hangs him from that point when he is
 * dragged. `view="side"` is the profile from the sheet, used while he walks or
 * looks around.
 */

const INK = '#3B2B22';
const DOUGH = '#F4E7CF';
const DOUGH_SHADE = '#E3CFAA';
const DOUGH_LIGHT = '#FCF6EA';
const CREASE = '#D6BF97';
const LIMB = '#F1E2C6';

const BODY = 'M23.4 16 C20.4 20.6 7.6 23.2 5.4 36.4 C3.8 45.4 9.4 53.2 18.4 53.6 L37.6 53.6 C46.6 53.2 52.2 45.4 50.6 36.4 C48.4 23.2 35.6 20.6 32.6 16 Z';
const KNOT = 'M23.4 16.4 C24.4 13.8 23.6 12 21 10.4 C18.6 8.8 19.8 5.4 22.8 6 C23.4 3.4 26.4 2.6 28 4.2 C29.6 2.6 32.6 3.4 33.2 6 C36.2 5.4 37.4 8.8 35 10.4 C32.4 12 31.6 13.8 32.6 16.4 Z';

function FrontFace({ mood }: { mood: Mood }) {
  return (
    <>
      <g className="mk-eyes">
        <ellipse cx="19.2" cy="38.6" rx="2.7" ry="3.5" fill={INK} />
        <ellipse cx="36.8" cy="38.6" rx="2.7" ry="3.5" fill={INK} />
        <circle cx="20.1" cy="37.3" r="0.95" fill="#FFFFFF" />
        <circle cx="37.7" cy="37.3" r="0.95" fill="#FFFFFF" />
      </g>
      {mood === 'sad' ? (
        <g className="mk-brows"><path d="M15.6 34.6 Q18.4 33.8 20.8 32.4" /><path d="M40.4 34.6 Q37.6 33.8 35.2 32.4" /></g>
      ) : null}
      {mood === 'smug' ? (
        <g className="mk-brows"><path d="M16 33.6 L21.2 33.2" /><path d="M34.8 32.4 L40 33.8" /></g>
      ) : null}
      {mood === 'happy' ? (
        <g className="mk-mouth is-open">
          <path d="M24.6 40.4 Q26.3 41.6 28 40.6 Q29.7 41.6 31.4 40.4 Q30.8 45.6 28 45.6 Q25.2 45.6 24.6 40.4 Z" fill="#6A3428" stroke={INK} strokeWidth="1.1" strokeLinejoin="round" />
          <ellipse cx="28" cy="44.2" rx="1.7" ry="0.9" fill="#E58C78" />
        </g>
      ) : (
        <path
          className="mk-mouth"
          d={mood === 'sad'
            ? 'M25 43.2 Q28 40.6 31 43.2'
            : mood === 'smug'
              ? 'M24.8 41.2 Q26.6 43.4 28.2 41.6 Q30.2 43 32.2 40.2'
              : 'M24.9 40.6 Q26.4 43 28 41.2 Q29.6 43 31.1 40.6'}
        />
      )}
    </>
  );
}

function SideFace({ mood }: { mood: Mood }) {
  return (
    <>
      <g className="mk-eyes">
        <ellipse cx="41.4" cy="38.4" rx="2.4" ry="3.4" fill={INK} />
        <circle cx="42.2" cy="37.1" r="0.85" fill="#FFFFFF" />
      </g>
      {mood === 'sad' ? <g className="mk-brows"><path d="M39.6 33.4 Q41.8 33 43.6 31.8" /></g> : null}
      {mood === 'smug' ? <g className="mk-brows"><path d="M39.4 32.6 L44.2 33.6" /></g> : null}
      <path className="mk-mouth" d={mood === 'sad' ? 'M46.2 42.6 Q47.4 41.2 48.6 42.2' : 'M46 40.6 Q47.2 42.6 48.6 40.8'} />
    </>
  );
}

export type MascotAct = 'hop' | 'hop2' | 'sway' | 'shuffle' | 'clap';

export function Khinkali({ mood, walking, facing, still, act = null, view = 'front' }: {
  mood: Mood;
  walking: boolean;
  facing: 'left' | 'right';
  still: boolean;
  /** A one-off acting beat played by CSS (mascot.css, `.act-*`). */
  act?: MascotAct | null;
  /** Front view, or the profile from the reference sheet (walking, looking around). */
  view?: 'front' | 'side';
}) {
  const id = useId().replace(/:/g, '');
  const clip = `mk-clip-${id}`;
  const blush = `mk-blush-${id}`;
  const side = view === 'side';
  const classes = ['mk', walking ? 'is-walking' : '', still ? 'is-still' : '', `is-${mood}`, side ? 'is-side' : '', act && !still ? `act-${act}` : ''].filter(Boolean).join(' ');

  return (
    <svg className={classes} viewBox="0 0 56 60" width="56" height="60" aria-hidden="true" focusable="false">
      <defs>
        <clipPath id={clip}><path d={BODY} /></clipPath>
        <radialGradient id={blush} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#F0A28A" stopOpacity="0.8" />
          <stop offset="1" stopColor="#F0A28A" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Mirrored for «left»: the profile faces right, the front view is symmetric. */}
      <g className="mk-turn" style={{ transform: facing === 'left' ? 'scaleX(-1)' : undefined }}>
        <ellipse className="mk-ground" cx="28" cy="59" rx="16" ry="1.9" fill="#000000" opacity="0.32" />

        <g className="mk-actor">
          {side ? (
            <>
              <g className="mk-leg mk-leg-l">
                <path d="M21.4 51 L21.4 56.4 Q21.4 58.8 24.4 58.8 Q27.6 58.8 27.6 56.4 L27.6 51 Z" fill={DOUGH_SHADE} stroke={INK} strokeWidth="1.3" strokeLinejoin="round" />
              </g>
              <g className="mk-leg mk-leg-r">
                <path d="M29.8 51 L29.8 56.4 Q29.8 58.8 33 58.8 Q36.4 58.8 36.4 56.4 L36.4 51 Z" fill={LIMB} stroke={INK} strokeWidth="1.3" strokeLinejoin="round" />
              </g>
            </>
          ) : (
            <>
              <g className="mk-leg mk-leg-l">
                <path d="M15.8 50.6 L15.8 56.2 Q15.8 58.8 19 58.8 Q22.4 58.8 22.4 56.2 L22.4 50.6 Z" fill={LIMB} stroke={INK} strokeWidth="1.3" strokeLinejoin="round" />
              </g>
              <g className="mk-leg mk-leg-r">
                <path d="M33.6 50.6 L33.6 56.2 Q33.6 58.8 37 58.8 Q40.2 58.8 40.2 56.2 L40.2 50.6 Z" fill={LIMB} stroke={INK} strokeWidth="1.3" strokeLinejoin="round" />
              </g>
            </>
          )}

          <g className="mk-body">
            {side ? null : (
              <>
                <g className="mk-arm mk-arm-l">
                  <path d="M8.4 36.4 C4.2 36.2 1.6 40 2.4 43.6 C3.2 46.6 6.6 46.4 8.2 44.2" fill={LIMB} stroke={INK} strokeWidth="1.3" strokeLinejoin="round" />
                </g>
                <g className="mk-arm mk-arm-r">
                  <path d="M47.6 36.4 C51.8 36.2 54.4 40 53.6 43.6 C52.8 46.6 49.4 46.4 47.8 44.2" fill={LIMB} stroke={INK} strokeWidth="1.3" strokeLinejoin="round" />
                </g>
              </>
            )}

            <path className="mk-dough" d={BODY} fill={DOUGH} />
            <g clipPath={`url(#${clip})`}>
              {/* Cel shading: shade on the right and along the bottom, a soft light upper left. */}
              <path d={side
                ? 'M4 30 C8 44 16 50 30 52 C20 54 10 52 6 48 Z M0 20 C6 28 9 40 18 54 L0 56 Z'
                : 'M56 24 C48 34 46 46 36 52 C44 52 52 50 56 46 Z M0 46 C10 52 22 54 34 53.6 L56 56 L0 56 Z'} fill={DOUGH_SHADE} />
              <ellipse cx={side ? 36 : 17} cy="30" rx="7" ry="5" fill={DOUGH_LIGHT} opacity="0.85" transform={`rotate(${side ? 24 : -24} ${side ? 36 : 17} 30)`} />
              <g className="mk-pleats" fill="none" stroke={CREASE} strokeWidth="1.15" strokeLinecap="round">
                {side ? (
                  <>
                    <path d="M25.6 17.4 Q19 22.4 14.6 30.6" />
                    <path d="M27.4 17.8 Q24.6 23.6 23.4 30.8" />
                    <path d="M29.6 17.8 Q32.6 22.8 35 28.6" />
                    <path d="M31 17.2 Q38 21.2 42.6 26.8" />
                  </>
                ) : (
                  <>
                    <path d="M25 17.6 Q16.6 21.4 11.4 29.4" />
                    <path d="M26.4 17.8 Q22.4 23 20.6 30.6" />
                    <path d="M28 18 Q28.6 23.6 27.4 29.8" />
                    <path d="M29.6 17.8 Q33.8 22.8 35.6 30.2" />
                    <path d="M31 17.6 Q39.4 21.4 44.6 29.4" />
                  </>
                )}
              </g>
            </g>
            <path d={BODY} fill="none" stroke={INK} strokeWidth="1.5" strokeLinejoin="round" />

            {side ? (
              <g className="mk-arm mk-arm-r">
                <path d="M28.6 38.4 C26.2 41.4 26.4 47.2 29.6 47.4 C32.8 47.6 33.2 41.8 30.8 38.4" fill={LIMB} stroke={INK} strokeWidth="1.3" strokeLinejoin="round" />
              </g>
            ) : null}

            <g className="mk-knot">
              <path d={KNOT} fill={DOUGH} stroke={INK} strokeWidth="1.4" strokeLinejoin="round" />
              {/* Shade on the right lobe, creases between the lobes, the tie around the neck. */}
              <path d="M33.2 6.2 C35.6 6.4 36 9 34.2 10.4 C32.4 11.8 31.6 13.8 32.4 16 C31.2 13.6 31.4 11.6 32.6 10 C33.8 8.6 33.8 7.2 33.2 6.2 Z" fill={DOUGH_SHADE} />
              <path d="M23.6 7 Q25.6 10.2 25.6 14" stroke={CREASE} strokeWidth="1" fill="none" strokeLinecap="round" />
              <path d="M32.4 7 Q30.4 10.2 30.4 14" stroke={CREASE} strokeWidth="1" fill="none" strokeLinecap="round" />
              <path d="M28 5.6 Q28.4 9.6 28 13.6" stroke={CREASE} strokeWidth="0.9" fill="none" strokeLinecap="round" />
              <path d="M24 14 Q28 15.4 32 14" stroke={INK} strokeWidth="1.1" fill="none" strokeLinecap="round" opacity="0.55" />
            </g>

            {side ? (
              <ellipse className="mk-cheek" cx="43.4" cy="42.6" rx="3" ry="1.9" fill={`url(#${blush})`} />
            ) : (
              <>
                <ellipse className="mk-cheek" cx="14.6" cy="42.4" rx="3.6" ry="2.2" fill={`url(#${blush})`} />
                <ellipse className="mk-cheek" cx="41.4" cy="42.4" rx="3.6" ry="2.2" fill={`url(#${blush})`} />
              </>
            )}

            {side ? <SideFace mood={mood} /> : <FrontFace mood={mood} />}

            {/* Mitts in front of the belly, shown only while clapping. */}
            {side ? null : (
              <g className="mk-clap">
                <g className="mk-mitt mk-mitt-l">
                  <ellipse cx="21" cy="48.4" rx="3" ry="2.6" fill={LIMB} stroke={INK} strokeWidth="1.2" />
                </g>
                <g className="mk-mitt mk-mitt-r">
                  <ellipse cx="35" cy="48.4" rx="3" ry="2.6" fill={LIMB} stroke={INK} strokeWidth="1.2" />
                </g>
              </g>
            )}
          </g>
        </g>

        {mood === 'happy' && !still ? (
          <g className="mk-steam" fill="none" stroke="#F4EEE2" strokeWidth="1.2" strokeLinecap="round">
            <path d="M21.4 3.6 Q19.4 1.2 21.4 -1.2" />
            <path d="M35 4.6 Q37 2.2 35 -0.2" />
          </g>
        ) : null}
      </g>
    </svg>
  );
}
