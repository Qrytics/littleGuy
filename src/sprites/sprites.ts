// Color index constants for sprite pixel grids
const _ = 0; // transparent
const H = 1; // hair
const S = 2; // skin
const E = 3; // eye
const M = 4; // mouth
const T = 5; // shirt
const P = 6; // pants
const B = 7; // shoe

// ─── Body variants (10 cols × 10 rows) ────────────────────────────────────────

const BODY_NORMAL: number[][] = [
  [_,T,T,T,T,T,T,T,T,_],
  [S,T,T,T,T,T,T,T,T,S],
  [S,T,T,T,T,T,T,T,T,S],
  [_,T,T,T,T,T,T,T,T,_],
  [_,_,P,P,_,P,P,_,_,_],
  [_,_,P,P,_,P,P,_,_,_],
  [_,_,P,P,_,P,P,_,_,_],
  [_,_,P,P,_,P,P,_,_,_],
  [_,_,B,B,_,B,B,_,_,_],
  [_,_,B,B,_,B,B,_,_,_],
];

const BODY_TYPING_L: number[][] = [
  [_,T,T,T,T,T,T,T,T,_],
  [_,T,T,T,T,T,T,T,T,S],
  [S,T,T,T,T,T,T,T,T,_],
  [_,T,T,T,T,T,T,T,T,_],
  ...BODY_NORMAL.slice(4),
];

const BODY_TYPING_R: number[][] = [
  [_,T,T,T,T,T,T,T,T,_],
  [S,T,T,T,T,T,T,T,T,_],
  [_,T,T,T,T,T,T,T,T,S],
  [_,T,T,T,T,T,T,T,T,_],
  ...BODY_NORMAL.slice(4),
];

const BODY_RELAXED: number[][] = [
  [_,T,T,T,T,T,T,T,T,_],
  [_,T,T,T,T,T,T,T,T,_],
  [_,T,T,T,T,T,T,T,T,_],
  [_,T,T,T,T,T,T,T,T,_],
  ...BODY_NORMAL.slice(4),
];

const BODY_WAVE_UP: number[][] = [
  [_,T,T,T,T,T,T,T,T,_],
  [S,T,T,T,T,T,T,T,S,_],
  [_,T,T,T,T,T,T,S,_,_],
  [_,T,T,T,T,T,T,T,T,_],
  ...BODY_NORMAL.slice(4),
];

const BODY_WAVE_OPEN: number[][] = [
  [_,T,T,T,T,T,T,T,T,S],
  [S,T,T,T,T,T,T,T,S,_],
  [_,T,T,T,T,T,T,_,_,_],
  [_,T,T,T,T,T,T,T,T,_],
  ...BODY_NORMAL.slice(4),
];

const BODY_STRETCH: number[][] = [
  [_,T,T,T,T,T,T,T,T,_],
  [S,T,T,T,T,T,T,T,T,S],
  [S,T,T,T,T,T,T,T,T,S],
  [S,T,T,T,T,T,T,T,T,S],
  ...BODY_NORMAL.slice(4),
];

const BODY_WALK_L: number[][] = [
  [_,T,T,T,T,T,T,T,T,_],
  [S,T,T,T,T,T,T,T,T,_],
  [_,T,T,T,T,T,T,T,T,S],
  [_,T,T,T,T,T,T,T,T,_],
  [_,_,P,P,_,P,P,_,_,_],
  [_,_,P,P,_,P,P,_,_,_],
  [_,P,P,_,_,P,P,_,_,_],
  [_,P,P,_,_,_,P,P,_,_],
  [_,B,B,_,_,_,B,B,_,_],
  [B,B,_,_,_,_,B,B,_,_],
];

const BODY_WALK_R: number[][] = [
  [_,T,T,T,T,T,T,T,T,_],
  [S,T,T,T,T,T,T,T,T,_],
  [_,T,T,T,T,T,T,T,T,S],
  [_,T,T,T,T,T,T,T,T,_],
  [_,_,P,P,_,P,P,_,_,_],
  [_,_,P,P,_,P,P,_,_,_],
  [_,_,P,P,_,_,P,P,_,_],
  [_,_,P,P,_,P,P,_,_,_],
  [_,_,B,B,_,_,B,B,_,_],
  [_,_,B,B,_,B,B,B,_,_],
];

// ─── Head parts (10 cols wide) ─────────────────────────────────────────────────

const HEAD_TOP: number[][] = [
  [_,_,H,H,H,H,H,_,_,_],
  [_,H,H,H,H,H,H,H,_,_],
  [_,H,S,S,S,S,S,H,_,_],
];

const NOSE_GAP: number[] = [_,H,S,S,S,S,S,H,_,_];

// Eye rows
const EYES_OPEN:   number[] = [_,H,S,E,S,E,S,H,_,_];
const EYES_CLOSED: number[] = [_,H,S,H,S,H,S,H,_,_];
const EYES_WIDE:   number[] = [_,H,E,E,S,E,E,H,_,_];
const EYES_LOOK_L: number[] = [_,H,S,E,E,S,S,H,_,_];
const EYES_LOOK_R: number[] = [_,H,S,S,S,E,E,H,_,_];

// Mouth rows
const MOUTH_SMILE: number[] = [_,H,S,M,M,M,S,H,_,_];
const MOUTH_BIG:   number[] = [_,H,M,M,M,M,M,H,_,_];
const MOUTH_FOCUS: number[] = [_,H,S,S,M,S,S,H,_,_];
const MOUTH_NONE:  number[] = [_,H,S,S,S,S,S,H,_,_];
const MOUTH_OH:    number[] = [_,H,S,M,S,M,S,H,_,_];
const MOUTH_GRIN:  number[] = [_,H,M,S,M,S,M,H,_,_];

// ─── Frame builder ─────────────────────────────────────────────────────────────

/** Compose a full 16-row frame: 3 head rows + eyes + nose + mouth + 10 body rows */
function makeFrame(
  eyes: number[],
  mouth: number[],
  body: number[][],
): number[][] {
  return [...HEAD_TOP, eyes, NOSE_GAP, mouth, ...body];
}

// ─── Sprite animation tables ──────────────────────────────────────────────────

export type SpriteName =
  | 'idle' | 'idle_wave' | 'idle_stretch' | 'idle_look' | 'idle_excited'
  | 'active' | 'typing' | 'coding' | 'sleeping' | 'walking' | 'greeting';

export const SPRITES: Record<SpriteName, number[][][]> = {
  idle: [
    makeFrame(EYES_OPEN,   MOUTH_SMILE, BODY_NORMAL),
    makeFrame(EYES_CLOSED, MOUTH_SMILE, BODY_NORMAL),
  ],
  idle_wave: [
    makeFrame(EYES_OPEN, MOUTH_SMILE, BODY_WAVE_UP),
    makeFrame(EYES_OPEN, MOUTH_SMILE, BODY_WAVE_OPEN),
    makeFrame(EYES_OPEN, MOUTH_SMILE, BODY_WAVE_UP),
    makeFrame(EYES_OPEN, MOUTH_SMILE, BODY_NORMAL),
  ],
  idle_stretch: [
    makeFrame(EYES_CLOSED, MOUTH_OH,    BODY_NORMAL),
    makeFrame(EYES_CLOSED, MOUTH_OH,    BODY_STRETCH),
    makeFrame(EYES_CLOSED, MOUTH_OH,    BODY_STRETCH),
    makeFrame(EYES_OPEN,   MOUTH_SMILE, BODY_NORMAL),
  ],
  idle_look: [
    makeFrame(EYES_LOOK_L, MOUTH_FOCUS, BODY_NORMAL),
    makeFrame(EYES_LOOK_L, MOUTH_FOCUS, BODY_NORMAL),
    makeFrame(EYES_LOOK_R, MOUTH_FOCUS, BODY_NORMAL),
    makeFrame(EYES_LOOK_R, MOUTH_FOCUS, BODY_NORMAL),
    makeFrame(EYES_OPEN,   MOUTH_SMILE, BODY_NORMAL),
  ],
  idle_excited: [
    makeFrame(EYES_WIDE,   MOUTH_GRIN,  BODY_NORMAL),
    makeFrame(EYES_WIDE,   MOUTH_GRIN,  BODY_NORMAL),
    makeFrame(EYES_OPEN,   MOUTH_SMILE, BODY_NORMAL),
    makeFrame(EYES_CLOSED, MOUTH_SMILE, BODY_NORMAL),
  ],
  active: [
    makeFrame(EYES_LOOK_L, MOUTH_FOCUS, BODY_NORMAL),
    makeFrame(EYES_LOOK_R, MOUTH_FOCUS, BODY_NORMAL),
  ],
  typing: [
    makeFrame(EYES_OPEN, MOUTH_FOCUS, BODY_TYPING_L),
    makeFrame(EYES_OPEN, MOUTH_FOCUS, BODY_TYPING_R),
  ],
  coding: [
    makeFrame(EYES_WIDE, MOUTH_BIG, BODY_TYPING_L),
    makeFrame(EYES_WIDE, MOUTH_BIG, BODY_TYPING_R),
  ],
  sleeping: [
    makeFrame(EYES_CLOSED, MOUTH_NONE, BODY_RELAXED),
    makeFrame(EYES_CLOSED, MOUTH_NONE, BODY_RELAXED),
  ],
  walking: [
    makeFrame(EYES_OPEN, MOUTH_SMILE, BODY_WALK_L),
    makeFrame(EYES_OPEN, MOUTH_SMILE, BODY_NORMAL),
    makeFrame(EYES_OPEN, MOUTH_SMILE, BODY_WALK_R),
    makeFrame(EYES_OPEN, MOUTH_SMILE, BODY_NORMAL),
  ],
  greeting: [
    makeFrame(EYES_WIDE, MOUTH_BIG,   BODY_WAVE_UP),
    makeFrame(EYES_WIDE, MOUTH_BIG,   BODY_WAVE_OPEN),
    makeFrame(EYES_WIDE, MOUTH_BIG,   BODY_WAVE_UP),
    makeFrame(EYES_OPEN, MOUTH_SMILE, BODY_NORMAL),
  ],
};

export const IDLE_SUB_ANIMS = [
  'idle_wave',
  'idle_look',
  'idle_stretch',
  'idle_excited',
] as const;

export type IdleSubAnim = typeof IDLE_SUB_ANIMS[number];

export const FRAME_MS: Record<string, number> = {
  idle:         800,
  idle_wave:    300,
  idle_stretch: 500,
  idle_look:    500,
  idle_excited: 350,
  active:       600,
  typing:       220,
  coding:       260,
  sleeping:     1800,
  walking:      280,
  greeting:     350,
};

export const DEFAULT_COLORS = {
  hair:  '#3D2314',
  skin:  '#FFCD94',
  shirt: '#4169E1',
  pants: '#2D5016',
  shoes: '#222222',
} as const;

export interface CompanionPalette {
  hair: string;
  skin: string;
  shirt: string;
  pants: string;
  shoes: string;
}

export const COMPANION_TYPE_COLORS: Record<string, CompanionPalette> = {
  default: { hair: '#3D2314', skin: '#FFCD94', shirt: '#4169E1', pants: '#2D5016', shoes: '#222222' },
  purple:  { hair: '#1A0033', skin: '#FFCD94', shirt: '#7B2FBE', pants: '#3D1A78', shoes: '#111111' },
  orange:  { hair: '#5C1A00', skin: '#FFCD94', shirt: '#E87C00', pants: '#7A3D00', shoes: '#222222' },
  red:     { hair: '#0A0A0A', skin: '#FFCD94', shirt: '#CC0000', pants: '#1A1A5C', shoes: '#111111' },
  green:   { hair: '#2D3A00', skin: '#FFCD94', shirt: '#2E7D32', pants: '#1B5E20', shoes: '#4E342E' },
};

/**
 * Resolve the full 10-element sprite color palette for a companion type.
 * Index 0 = transparent (null), 1-7 = character colors, 8 = zzz blue, 9 = coding glow.
 */
export function buildPalette(companionType: string): Array<string | null> {
  const c = COMPANION_TYPE_COLORS[companionType] ?? DEFAULT_COLORS;
  return [
    null,      // 0  transparent
    c.hair,    // 1  H
    c.skin,    // 2  S
    '#111111', // 3  E  eye
    '#EE8080', // 4  M  mouth
    c.shirt,   // 5  T
    c.pants,   // 6  P
    c.shoes,   // 7  B
    '#AAAAEE', // 8  Z  zzz
    '#7CFC00', // 9  G  glow
  ];
}

/** Happy-face full frame (used in minigame) */
export const FRAME_HAPPY: number[][] = makeFrame(EYES_OPEN, MOUTH_SMILE, BODY_NORMAL);

/** Surprised-face full frame (used in minigame hit animation) */
export const FRAME_SURPRISED: number[][] = makeFrame(EYES_WIDE, MOUTH_BIG, BODY_NORMAL);
