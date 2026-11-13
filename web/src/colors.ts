// Soft colours for his buttons. Each category has one, carried onto its own
// screens, so he can tell where he is at a glance. Text always stays dark on
// the light tint, so it stays easy to read.

export interface Swatch {
  /** Name shown in the editor. */
  name: string;
  /** Button background. */
  tint: string;
  /** Background while pressed: a little deeper. */
  pressed: string;
  /** Border and accents. */
  deep: string;
}

export const PALETTE = {
  orange: { name: 'Orange', tint: '#fbdcc2', pressed: '#f3bb8b', deep: '#8f4a12' },
  blue: { name: 'Blue', tint: '#d3e3f4', pressed: '#a8c7ea', deep: '#22548a' },
  rose: { name: 'Rose', tint: '#f5d3e1', pressed: '#eaa9c4', deep: '#8c2652' },
  green: { name: 'Green', tint: '#d6ecce', pressed: '#b0d8a2', deep: '#2f6b2a' },
  red: { name: 'Red', tint: '#f7d3cd', pressed: '#eca99e', deep: '#9a2b1f' },
  sun: { name: 'Yellow', tint: '#f8e7a8', pressed: '#efd268', deep: '#735800' },
  purple: { name: 'Purple', tint: '#e2d8f1', pressed: '#c6b4e6', deep: '#573d86' },
  teal: { name: 'Teal', tint: '#cbe8e3', pressed: '#9dd2c9', deep: '#1d625a' },
  sky: { name: 'Sky', tint: '#d4ecf6', pressed: '#a6d6ec', deep: '#1d5f7a' },
  sand: { name: 'Sand', tint: '#ece3d3', pressed: '#d8c8ab', deep: '#6b5a3c' },
} satisfies Record<string, Swatch>;

export type ColorName = keyof typeof PALETTE;

export const COLOR_NAMES = Object.keys(PALETTE) as ColorName[];

export function isColorName(value: unknown): value is ColorName {
  return typeof value === 'string' && value in PALETTE;
}

/** The category's colour, or a steady one picked from its id if it has none. */
export function colorFor(category: { id: string; color?: string }): Swatch {
  if (isColorName(category.color)) return PALETTE[category.color];
  let hash = 0;
  for (const ch of category.id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[COLOR_NAMES[hash % COLOR_NAMES.length]];
}

/** CSS variables that colour a button. */
export function swatchStyle(swatch: Swatch): Record<string, string> {
  return { '--tile': swatch.tint, '--tile-pressed': swatch.pressed, '--tile-deep': swatch.deep };
}
