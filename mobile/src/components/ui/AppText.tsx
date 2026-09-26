import { StyleSheet, Text, TextProps, TextStyle } from 'react-native';

import { useTheme } from '../../context/AccessibilityContext';

export type TextVariant = 'display' | 'title' | 'heading' | 'body' | 'caption' | 'label';
type Tone = 'default' | 'muted' | 'faint' | 'primary' | 'success' | 'warning' | 'danger' | 'onPrimary';

const BASE: Record<TextVariant, { size: number; weight: TextStyle['fontWeight']; lineHeight: number }> = {
  display: { size: 28, weight: '800', lineHeight: 1.2 },
  title: { size: 22, weight: '700', lineHeight: 1.25 },
  heading: { size: 17, weight: '700', lineHeight: 1.3 },
  body: { size: 15, weight: '400', lineHeight: 1.45 },
  caption: { size: 13, weight: '400', lineHeight: 1.4 },
  label: { size: 12, weight: '700', lineHeight: 1.3 },
};

export interface AppTextProps extends TextProps {
  variant?: TextVariant;
  tone?: Tone;
  color?: string;
  weight?: TextStyle['fontWeight'];
  align?: TextStyle['textAlign'];
}

/**
 * All text goes through here so the accessibility "text size" setting and the
 * OS font scale both apply (capped so layouts survive the largest sizes).
 */
export function AppText({ variant = 'body', tone = 'default', color, weight, align, style, ...rest }: AppTextProps) {
  const theme = useTheme();
  const base = BASE[variant];
  const size = theme.fs(base.size);
  const toneColor: Record<Tone, string> = {
    default: theme.colors.text,
    muted: theme.colors.textMuted,
    faint: theme.colors.textFaint,
    primary: theme.highContrast ? theme.colors.teal : theme.colors.primary,
    success: theme.colors.success,
    warning: theme.colors.warning,
    danger: theme.colors.danger,
    onPrimary: theme.colors.onPrimary,
  };
  return (
    <Text
      maxFontSizeMultiplier={1.6}
      style={[
        {
          color: color ?? toneColor[tone],
          fontSize: size,
          lineHeight: Math.round(size * base.lineHeight),
          fontWeight: weight ?? base.weight,
          textAlign: align,
        },
        variant === 'label' && styles.label,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  label: { textTransform: 'uppercase', letterSpacing: 0.8 },
});
