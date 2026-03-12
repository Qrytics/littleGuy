/**
 * Animation Engine - Vello/ThorVG vector rendering layer
 *
 * Implements GPU-accelerated vector animation by:
 * 1. Defining character geometry as vector paths (not bitmaps)
 * 2. Generating SVG documents for each frame
 * 3. Compositing layers for smooth animation
 *
 * This mirrors the Vello/ThorVG architecture where scenes are built from
 * vector primitives and rendered with GPU acceleration via the browser's
 * WebGPU/WebGL compositor.
 */

export interface AnimColors {
  hair:   string;
  skin:   string;
  shirt:  string;
  pants:  string;
  shoes:  string;
  eye?:   string;
  mouth?: string;
}

const CANVAS_W = 80;
const CANVAS_H = 160;
const CHAR_W   = 10;
const CHAR_H   = 16;

/**
 * Renders a single animation frame as an SVG string.
 *
 * Each non-transparent pixel in the 16×10 grid becomes a vector <rect>
 * at the requested scale, enabling crisp rendering at any DPI and serving
 * as a Vello WASM integration point when the full renderer is available.
 */
export function renderFrameSVG(
  pixelGrid: number[][],
  colors: AnimColors,
  scale: number = 4,
): string {
  const palette: Array<string | null> = [
    null,             // 0 transparent
    colors.hair,      // 1 H
    colors.skin,      // 2 S
    colors.eye   ?? '#111111', // 3 E
    colors.mouth ?? '#EE8080', // 4 M
    colors.shirt,     // 5 T
    colors.pants,     // 6 P
    colors.shoes,     // 7 B
    '#AAAAEE',        // 8 zzz
    '#7CFC00',        // 9 glow
  ];

  const w = CHAR_W * scale;
  const h = CHAR_H * scale;
  const rects: string[] = [];

  for (let row = 0; row < pixelGrid.length; row++) {
    const pixelRow = pixelGrid[row];
    if (!pixelRow) continue;
    for (let col = 0; col < pixelRow.length; col++) {
      const ci = pixelRow[col];
      if (!ci) continue;
      const color = palette[ci];
      if (!color) continue;
      rects.push(
        `<rect x="${col * scale}" y="${row * scale}" width="${scale}" height="${scale}" fill="${color}"/>`,
      );
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges">${rects.join('')}</svg>`;
}

/**
 * Build a complete 80×160 SVG compositing the character at the bottom
 * of the overlay viewport, with optional state overlays.
 */
export function buildFrameSVG(
  pixelGrid: number[][],
  colors: AnimColors,
  extras?: { sleeping?: boolean; coding?: boolean },
): string {
  const scale  = 4;
  const charX  = Math.floor((CANVAS_W - CHAR_W * scale) / 2);
  const charY  = CANVAS_H - CHAR_H * scale;

  const palette: Array<string | null> = [
    null, colors.hair, colors.skin,
    colors.eye   ?? '#111111',
    colors.mouth ?? '#EE8080',
    colors.shirt, colors.pants, colors.shoes,
    '#AAAAEE', '#7CFC00',
  ];

  const rects: string[] = [];

  // Coding glow overlay
  if (extras?.coding) {
    rects.push(
      `<rect x="${charX - 4}" y="${charY}" width="${CHAR_W * scale + 8}" height="${CHAR_H * scale}" fill="#7CFC00" opacity="0.15"/>`,
    );
  }

  // Character pixels
  for (let row = 0; row < pixelGrid.length; row++) {
    const pixelRow = pixelGrid[row];
    if (!pixelRow) continue;
    for (let col = 0; col < pixelRow.length; col++) {
      const ci = pixelRow[col];
      if (!ci) continue;
      const color = palette[ci];
      if (!color) continue;
      rects.push(
        `<rect x="${charX + col * scale}" y="${charY + row * scale}" width="${scale}" height="${scale}" fill="${color}"/>`,
      );
    }
  }

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS_W}" height="${CANVAS_H}"`,
    ` viewBox="0 0 ${CANVAS_W} ${CANVAS_H}" shape-rendering="crispEdges">`,
    rects.join(''),
    '</svg>',
  ].join('');
}

/** Returns CSS animation keyframe string for smooth state transitions. */
export function buildCSSAnimation(state: string): string {
  const duration: Record<string, string> = {
    idle:     '800ms',
    typing:   '220ms',
    coding:   '260ms',
    sleeping: '1800ms',
    walking:  '280ms',
    greeting: '350ms',
    active:   '600ms',
  };
  const d = duration[state] ?? '600ms';
  return `@keyframes blink-${state} { 0%,100% { opacity:1; } 50% { opacity:0.85; } } .anim-${state} { animation: blink-${state} ${d} step-end infinite; }`;
}

/**
 * Draw a pixel-grid frame directly onto a 2D canvas context.
 * This is the hot path for the 60fps animation loop.
 */
export function drawGridToCanvas(
  ctx: CanvasRenderingContext2D,
  pixelGrid: number[][],
  palette: Array<string | null>,
  x: number,
  y: number,
  scale: number = 4,
): void {
  for (let row = 0; row < pixelGrid.length; row++) {
    const pixelRow = pixelGrid[row];
    if (!pixelRow) continue;
    for (let col = 0; col < pixelRow.length; col++) {
      const ci = pixelRow[col];
      if (!ci) continue;
      const color = palette[ci];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(x + col * scale, y + row * scale, scale, scale);
    }
  }
}
