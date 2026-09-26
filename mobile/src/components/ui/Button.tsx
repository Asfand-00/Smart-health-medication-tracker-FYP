import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, PressableProps, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { useTheme } from '../../context/AccessibilityContext';
import { radius, TOUCH_TARGET } from '../../theme';
import { AppText } from './AppText';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'success' | 'warning' | 'ghost';
type IconName = keyof typeof Ionicons.glyphMap;

export interface ButtonProps extends Omit<PressableProps, 'style' | 'children'> {
  title: string;
  variant?: ButtonVariant;
  icon?: IconName;
  loading?: boolean;
  size?: 'md' | 'lg' | 'xl';
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Button({
  title,
  variant = 'primary',
  icon,
  loading = false,
  disabled,
  size = 'md',
  fullWidth,
  style,
  accessibilityLabel,
  ...rest
}: ButtonProps) {
  const theme = useTheme();
  const { colors, highContrast } = theme;
  const isDisabled = disabled || loading;

  const palette: Record<ButtonVariant, { bg: string; fg: string; border: string }> = {
    primary: { bg: colors.primary, fg: colors.onPrimary, border: highContrast ? '#ffff00' : colors.primary },
    secondary: { bg: colors.surfaceAlt, fg: colors.text, border: colors.borderStrong },
    danger: {
      bg: highContrast ? '#000' : 'rgba(239,68,68,0.16)',
      fg: colors.danger,
      border: highContrast ? colors.danger : 'rgba(239,68,68,0.45)',
    },
    success: { bg: highContrast ? '#fff' : '#10b981', fg: highContrast ? '#000' : '#022c22', border: highContrast ? '#ffff00' : '#059669' },
    warning: { bg: highContrast ? '#ffff00' : '#f59e0b', fg: '#1c1917', border: highContrast ? '#fff' : '#d97706' },
    ghost: { bg: 'transparent', fg: highContrast ? colors.teal : colors.primary, border: 'transparent' },
  };
  const p = palette[variant];
  const heights = { md: TOUCH_TARGET, lg: 56, xl: 72 };
  const textVariant = size === 'xl' ? 'title' : size === 'lg' ? 'heading' : 'body';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      hitSlop={4}
      style={({ pressed }) => [
        styles.base,
        {
          minHeight: heights[size],
          backgroundColor: p.bg,
          borderColor: p.border,
          borderWidth: highContrast ? 2 : variant === 'ghost' ? 0 : 1,
          opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1,
          transform: [{ scale: pressed && !isDisabled ? 0.98 : 1 }],
        },
        fullWidth && styles.fullWidth,
        style,
      ]}
      {...rest}
    >
      <View style={styles.row}>
        {loading ? (
          <ActivityIndicator color={p.fg} />
        ) : icon ? (
          <Ionicons name={icon} size={size === 'xl' ? 28 : 20} color={p.fg} />
        ) : null}
        <AppText variant={textVariant} color={p.fg} weight="700" numberOfLines={2} align="center">
          {title}
        </AppText>
      </View>
    </Pressable>
  );
}

export interface IconButtonProps extends Omit<PressableProps, 'style' | 'children'> {
  icon: IconName;
  accessibilityLabel: string;
  color?: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
  badge?: number;
}

/** Icon-only button with a 48x48 touch target and a required label. */
export function IconButton({ icon, color, size = 22, style, badge, ...rest }: IconButtonProps) {
  const { colors, highContrast } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      hitSlop={6}
      style={({ pressed }) => [
        styles.icon,
        { opacity: pressed ? 0.6 : 1, borderColor: highContrast ? '#fff' : 'transparent', borderWidth: highContrast ? 2 : 0 },
        style,
      ]}
      {...rest}
    >
      <Ionicons name={icon} size={size} color={color ?? colors.text} />
      {badge !== undefined && badge > 0 && (
        <View style={[styles.badge, { backgroundColor: highContrast ? '#ffff00' : '#e11d48' }]}>
          <AppText variant="label" color={highContrast ? '#000' : '#fff'} style={styles.badgeText}>
            {badge > 99 ? '99+' : String(badge)}
          </AppText>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.md,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullWidth: { alignSelf: 'stretch' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  icon: {
    width: TOUCH_TARGET,
    height: TOUCH_TARGET,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 2,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { letterSpacing: 0, fontSize: 11, lineHeight: 14 },
});
