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

// ─── Sprite frames ────────────────────────────────────────────────────────────
// Each state is an array of frames; each frame is a 16-row × 10-col 2-D array.
// Row 0 = top of character.

// Shared body / legs (re-used across states to reduce duplication)
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

// ── Head templates ────────────────────────────────────────────────────────────
function head(row3) {
  // row3 controls the eyes row; everything else is fixed
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

const MOUTH_SMILE  = [_, H, S, M, M, M, S, H, _, _]; // 5
const MOUTH_BIG    = [_, H, M, M, M, M, M, H, _, _]; // 5 excited
const MOUTH_FOCUS  = [_, H, S, S, M, S, S, H, _, _]; // 5 small
const MOUTH_NONE   = [_, H, S, S, S, S, S, H, _, _]; // 5 neutral

// ─── State frames ────────────────────────────────────────────────────────────

const SPRITES = {

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
};

module.exports = { SPRITE_COLORS, SPRITES };
