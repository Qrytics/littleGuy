'use strict';

/**
 * sprites.js
 *
 * Pixel-art character sprite data.
 *
 * Grid size : 10 columns × 16 rows (each pixel rendered at SCALE px on canvas)
 * Colors    : numeric indices mapped via SPRITE_COLORS.
 *             Index 0 is always transparent (alpha = 0).
 *
 * To swap in real art assets, replace the frame arrays below with pixel data
 * extracted from your sprite sheets, or override the draw logic in renderer.js
 * to use Image objects instead.
 *
 * See CUSTOMIZATION.md for a full guide on creating your own companions.
 */

/* eslint-disable no-multi-spaces */

// ─── Color palette ────────────────────────────────────────────────────────────
// Index : hex      : meaning
const _ = 0;  //  transparent
const H = 1;  // '#3D2314'  hair (dark brown)
const S = 2;  // '#FFCD94'  skin (warm peach)
const E = 3;  // '#111111'  eye / outline
const M = 4;  // '#EE8080'  mouth (pink-red)
const T = 5;  // '#4169E1'  shirt (royal blue)
const P = 6;  // '#2D5016'  pants (forest green)
const B = 7;  // '#222222'  shoe (near black)
const Z = 8;  // '#AAAAEE'  zzz glyph (lavender)
const G = 9;  // '#7CFC00'  coding glow (lawn green)

const SPRITE_COLORS = [
  null,       // 0 transparent
  '#3D2314',  // 1 H hair
  '#FFCD94',  // 2 S skin
  '#111111',  // 3 E eye
  '#EE8080',  // 4 M mouth
  '#4169E1',  // 5 T shirt
  '#2D5016',  // 6 P pants
  '#222222',  // 7 B shoe
  '#AAAAEE',  // 8 Z zzz
  '#7CFC00',  // 9 G glow
];

// ─── Body variants ────────────────────────────────────────────────────────────

const BODY_NORMAL = [
  [_, T, T, T, T, T, T, T, T, _],   //  6
  [S, T, T, T, T, T, T, T, T, S],   //  7 arms out
  [S, T, T, T, T, T, T, T, T, S],   //  8
  [_, T, T, T, T, T, T, T, T, _],   //  9
  [_, _, P, P, _, P, P, _, _, _],   // 10
  [_, _, P, P, _, P, P, _, _, _],   // 11
  [_, _, P, P, _, P, P, _, _, _],   // 12
  [_, _, P, P, _, P, P, _, _, _],   // 13
  [_, _, B, B, _, B, B, _, _, _],   // 14
  [_, _, B, B, _, B, B, _, _, _],   // 15
];

const BODY_TYPING_L = [              // left hand lower (typing frame A)
  [_, T, T, T, T, T, T, T, T, _],
  [_, T, T, T, T, T, T, T, T, S],  // right hand up
  [S, T, T, T, T, T, T, T, T, _],  // left hand down
  [_, T, T, T, T, T, T, T, T, _],
  ...BODY_NORMAL.slice(4),
];

const BODY_TYPING_R = [              // right hand lower (typing frame B)
  [_, T, T, T, T, T, T, T, T, _],
  [S, T, T, T, T, T, T, T, T, _],  // left hand up
  [_, T, T, T, T, T, T, T, T, S],  // right hand down
  [_, T, T, T, T, T, T, T, T, _],
  ...BODY_NORMAL.slice(4),
];

const BODY_RELAXED = [               // arms resting (sleeping)
  [_, T, T, T, T, T, T, T, T, _],
  [_, T, T, T, T, T, T, T, T, _],
  [_, T, T, T, T, T, T, T, T, _],
  [_, T, T, T, T, T, T, T, T, _],
  ...BODY_NORMAL.slice(4),
];

const BODY_WAVE_UP = [               // right arm raised — waving
  [_, T, T, T, T, T, T, T, T, _],
  [S, T, T, T, T, T, T, T, S, _],  // left arm out, right arm high
  [_, T, T, T, T, T, T, S, _, _],  // right arm extension
  [_, T, T, T, T, T, T, T, T, _],
  ...BODY_NORMAL.slice(4),
];

const BODY_WAVE_OPEN = [             // right arm raised + hand out
  [_, T, T, T, T, T, T, T, T, S],  // hand pixel at top right
  [S, T, T, T, T, T, T, T, S, _],
  [_, T, T, T, T, T, T, _, _, _],
  [_, T, T, T, T, T, T, T, T, _],
  ...BODY_NORMAL.slice(4),
];

const BODY_STRETCH = [               // arms stretched wide (stretch)
  [_, T, T, T, T, T, T, T, T, _],
  [S, T, T, T, T, T, T, T, T, S],
  [S, T, T, T, T, T, T, T, T, S],  // same as normal but both hands far out
  [S, T, T, T, T, T, T, T, T, S],
  ...BODY_NORMAL.slice(4),
];

// Walking sprites — lean forward slightly by offsetting the leg pixels
const BODY_WALK_L = [                // step with left foot
  [_, T, T, T, T, T, T, T, T, _],
  [S, T, T, T, T, T, T, T, T, _],
  [_, T, T, T, T, T, T, T, T, S],
  [_, T, T, T, T, T, T, T, T, _],
  [_, _, P, P, _, P, P, _, _, _],
  [_, _, P, P, _, P, P, _, _, _],
  [_, P, P, _, _, P, P, _, _, _],   // left knee forward
  [_, P, P, _, _, _, P, P, _, _],
  [_, B, B, _, _, _, B, B, _, _],
  [B, B, _, _, _, _, B, B, _, _],   // left foot forward
];

const BODY_WALK_R = [                // step with right foot
  [_, T, T, T, T, T, T, T, T, _],
  [S, T, T, T, T, T, T, T, T, _],
  [_, T, T, T, T, T, T, T, T, S],
  [_, T, T, T, T, T, T, T, T, _],
  [_, _, P, P, _, P, P, _, _, _],
  [_, _, P, P, _, P, P, _, _, _],
  [_, _, P, P, _, _, P, P, _, _],   // right knee forward
  [_, _, P, P, _, P, P, _, _, _],
  [_, _, B, B, _, _, B, B, _, _],
  [_, _, B, B, _, B, B, B, _, _],   // right foot forward
];

// ── Head templates ────────────────────────────────────────────────────────────
function head(row3) {
  return [
    [_, _, H, H, H, H, H, _, _, _],  // 0 hair top
    [_, H, H, H, H, H, H, H, _, _],  // 1 hair wide
    [_, H, S, S, S, S, S, H, _, _],  // 2 face top
    row3,                             // 3 eyes
    [_, H, S, S, S, S, S, H, _, _],  // 4 nose gap
  ];
}

const EYES_OPEN    = [_, H, S, E, S, E, S, H, _, _];
const EYES_CLOSED  = [_, H, S, H, S, H, S, H, _, _]; // hair color = squint
const EYES_WIDE    = [_, H, E, E, S, E, E, H, _, _]; // excited
const EYES_LOOK_L  = [_, H, S, E, E, S, S, H, _, _]; // eyes shifted left
const EYES_LOOK_R  = [_, H, S, S, S, E, E, H, _, _]; // eyes shifted right
const EYES_SQUINT  = [_, H, S, E, S, E, S, H, _, _]; // same as open (slight squint shown via mouth)

const MOUTH_SMILE  = [_, H, S, M, M, M, S, H, _, _]; // happy
const MOUTH_BIG    = [_, H, M, M, M, M, M, H, _, _]; // excited
const MOUTH_FOCUS  = [_, H, S, S, M, S, S, H, _, _]; // small neutral
const MOUTH_NONE   = [_, H, S, S, S, S, S, H, _, _]; // neutral (sleeping)
const MOUTH_OH     = [_, H, S, M, S, M, S, H, _, _]; // surprise / yawn (O shape)
const MOUTH_GRIN   = [_, H, M, S, M, S, M, H, _, _]; // wide grin

// ─── State frames ────────────────────────────────────────────────────────────

const SPRITES = {

  // ── Idle sub-animations ──────────────────────────────────────────────────
  // Each sub-animation plays as a stand-alone sequence within the idle state.
  // renderer.js cycles through them automatically.

  idle: [
    // frame 0 – eyes open, smile
    [
      ...head(EYES_OPEN),
      MOUTH_SMILE,
      ...BODY_NORMAL,
    ],
    // frame 1 – blink
    [
      ...head(EYES_CLOSED),
      MOUTH_SMILE,
      ...BODY_NORMAL,
    ],
  ],

  // Waving: 4-frame sequence (wave hand up and down)
  idle_wave: [
    [
      ...head(EYES_OPEN),
      MOUTH_SMILE,
      ...BODY_WAVE_UP,
    ],
    [
      ...head(EYES_OPEN),
      MOUTH_SMILE,
      ...BODY_WAVE_OPEN,
    ],
    [
      ...head(EYES_OPEN),
      MOUTH_SMILE,
      ...BODY_WAVE_UP,
    ],
    [
      ...head(EYES_OPEN),
      MOUTH_SMILE,
      ...BODY_NORMAL,
    ],
  ],

  // Stretching: arms go wide then relax
  idle_stretch: [
    [
      ...head(EYES_CLOSED),
      MOUTH_OH,
      ...BODY_NORMAL,
    ],
    [
      ...head(EYES_CLOSED),
      MOUTH_OH,
      ...BODY_STRETCH,
    ],
    [
      ...head(EYES_CLOSED),
      MOUTH_OH,
      ...BODY_STRETCH,
    ],
    [
      ...head(EYES_OPEN),
      MOUTH_SMILE,
      ...BODY_NORMAL,
    ],
  ],

  // Looking around: eyes sweep left → right → center
  idle_look: [
    [
      ...head(EYES_LOOK_L),
      MOUTH_FOCUS,
      ...BODY_NORMAL,
    ],
    [
      ...head(EYES_LOOK_L),
      MOUTH_FOCUS,
      ...BODY_NORMAL,
    ],
    [
      ...head(EYES_LOOK_R),
      MOUTH_FOCUS,
      ...BODY_NORMAL,
    ],
    [
      ...head(EYES_LOOK_R),
      MOUTH_FOCUS,
      ...BODY_NORMAL,
    ],
    [
      ...head(EYES_OPEN),
      MOUTH_SMILE,
      ...BODY_NORMAL,
    ],
  ],

  // Excited blink: surprised + big smile
  idle_excited: [
    [
      ...head(EYES_WIDE),
      MOUTH_GRIN,
      ...BODY_NORMAL,
    ],
    [
      ...head(EYES_WIDE),
      MOUTH_GRIN,
      ...BODY_NORMAL,
    ],
    [
      ...head(EYES_OPEN),
      MOUTH_SMILE,
      ...BODY_NORMAL,
    ],
    [
      ...head(EYES_CLOSED),
      MOUTH_SMILE,
      ...BODY_NORMAL,
    ],
  ],

  active: [
    // frame 0 – looking left
    [
      ...head(EYES_LOOK_L),
      MOUTH_FOCUS,
      ...BODY_NORMAL,
    ],
    // frame 1 – looking right
    [
      ...head(EYES_LOOK_R),
      MOUTH_FOCUS,
      ...BODY_NORMAL,
    ],
  ],

  typing: [
    // frame 0 – left hand strikes
    [
      ...head(EYES_OPEN),
      MOUTH_FOCUS,
      ...BODY_TYPING_L,
    ],
    // frame 1 – right hand strikes
    [
      ...head(EYES_OPEN),
      MOUTH_FOCUS,
      ...BODY_TYPING_R,
    ],
  ],

  coding: [
    // frame 0 – excited wide eyes, big smile
    [
      ...head(EYES_WIDE),
      MOUTH_BIG,
      ...BODY_TYPING_L,
    ],
    // frame 1 – still excited, right hand
    [
      ...head(EYES_WIDE),
      MOUTH_BIG,
      ...BODY_TYPING_R,
    ],
  ],

  sleeping: [
    // frame 0 – eyes closed, neutral mouth
    [
      ...head(EYES_CLOSED),
      MOUTH_NONE,
      ...BODY_RELAXED,
    ],
    // frame 1 – slight variation (head tilt via hair row tweak)
    [
      [_, _, H, H, H, H, H, _, _, _],
      [_, H, H, H, H, H, H, H, _, _],
      [_, H, S, S, S, S, S, H, _, _],
      EYES_CLOSED,
      [_, H, S, S, S, S, S, H, _, _],
      MOUTH_NONE,
      ...BODY_RELAXED,
    ],
  ],

  // Walking animation — used when walking mode is enabled
  walking: [
    [
      ...head(EYES_OPEN),
      MOUTH_SMILE,
      ...BODY_WALK_L,
    ],
    [
      ...head(EYES_OPEN),
      MOUTH_SMILE,
      ...BODY_NORMAL,
    ],
    [
      ...head(EYES_OPEN),
      MOUTH_SMILE,
      ...BODY_WALK_R,
    ],
    [
      ...head(EYES_OPEN),
      MOUTH_SMILE,
      ...BODY_NORMAL,
    ],
  ],

  // Greeting — triggered when another companion is nearby
  greeting: [
    [
      ...head(EYES_WIDE),
      MOUTH_BIG,
      ...BODY_WAVE_UP,
    ],
    [
      ...head(EYES_WIDE),
      MOUTH_BIG,
      ...BODY_WAVE_OPEN,
    ],
    [
      ...head(EYES_WIDE),
      MOUTH_BIG,
      ...BODY_WAVE_UP,
    ],
    [
      ...head(EYES_OPEN),
      MOUTH_SMILE,
      ...BODY_NORMAL,
    ],
  ],
};

module.exports = { SPRITE_COLORS, SPRITES };

