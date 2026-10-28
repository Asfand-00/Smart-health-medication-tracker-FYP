/**
 * Theme tokens.
 *
 * The web app is dark-only (Tailwind slate-950 base) with an optional
 * "high contrast" accessibility mode (pure black, white borders, cyan/yellow
 * accents). Both palettes are reproduced here; there is no light theme because
 * the web app has none.
 */

export type TextSize = 'normal' | 'large' | 'extra-large';

export interface Palette {
  bg: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  borderStrong: string;
  text: string;
  textMuted: string;
  textFaint: string;
  primary: string;
  onPrimary: string;
  teal: string;
  success: string;
  warning: string;
  danger: string;
  orange: string;
  purple: string;
  pink: string;
  overlay: string;
}

export const darkPalette: Palette = {
  bg: '#020617',
  surface: '#0f172a',
  surfaceAlt: '#1e293b',
  border: 'rgba(255,255,255,0.10)',
  borderStrong: 'rgba(255,255,255,0.22)',
  text: '#f8fafc',
  textMuted: '#cbd5e1',
  textFaint: '#94a3b8',
  primary: '#3b82f6',
  onPrimary: '#ffffff',
  teal: '#2dd4bf',
  success: '#34d399',
  warning: '#fbbf24',
  danger: '#f87171',
  orange: '#fb923c',
  purple: '#c084fc',
  pink: '#f472b6',
  overlay: 'rgba(0,0,0,0.65)',
};

// Mirrors `.accessibility-contrast` in frontend/src/styles/index.css
export const highContrastPalette: Palette = {
  bg: '#000000',
  surface: '#0d0d0d',
  surfaceAlt: '#0d0d0d',
  border: '#ffffff',
  borderStrong: '#ffffff',
  text: '#ffffff',
  textMuted: '#ffffff',
  textFaint: '#e5e5e5',
  primary: '#ffffff',
  onPrimary: '#000000',
  teal: '#00ffff',
  success: '#00ffff',
  warning: '#ffff00',
  danger: '#ffff00',
  orange: '#ffff00',
  purple: '#00ffff',
  pink: '#00ffff',
  overlay: 'rgba(0,0,0,0.85)',
};

export const FONT_SCALE: Record<TextSize, number> = {
  normal: 1,
  large: 1.18,
  'extra-large': 1.36,
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 16, xl: 24, pill: 999 } as const;

/** Minimum touch target (Apple HIG 44pt, Material 48dp). */
export const TOUCH_TARGET = 48;

export interface Theme {
  colors: Palette;
  highContrast: boolean;
  fontScale: number;
  borderWidth: number;
  /** Scale a base font size by the user's accessibility text size. */
  fs: (size: number) => number;
}

export function buildTheme(highContrast: boolean, textSize: TextSize): Theme {
  const fontScale = FONT_SCALE[textSize] ?? 1;
  return {
    colors: highContrast ? highContrastPalette : darkPalette,
    highContrast,
    fontScale,
    borderWidth: highContrast ? 2 : 1,
    fs: (size: number) => Math.round(size * fontScale),
  };
}

/** Semantic colour for a dose / adherence status. */
export function statusColor(colors: Palette, status: string | null | undefined): string {
  switch ((status ?? '').toLowerCase()) {
    case 'taken':
    case 'success':
    case 'low':
    case 'mild':
    case 'normal':
      return colors.success;
    case 'delayed':
    case 'pending':
    case 'medium':
    case 'moderate':
    case 'warning':
      return colors.warning;
    case 'high':
    case 'overdue':
      return colors.orange;
    default:
      return colors.danger;
  }
}
