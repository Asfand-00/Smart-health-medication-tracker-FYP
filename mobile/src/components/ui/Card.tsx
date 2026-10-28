import { Ionicons } from '@expo/vector-icons';
import { ReactNode } from 'react';
import { Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { useTheme } from '../../context/AccessibilityContext';
import { radius, spacing, TOUCH_TARGET } from '../../theme';
import { AppText } from './AppText';

type IconName = keyof typeof Ionicons.glyphMap;

export function Card({
  children,
  style,
  accent,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Coloured left edge, used for priority / type (web: border-l-*). */
  accent?: string;
}) {
  const { colors, borderWidth } = useTheme();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border, borderWidth },
        accent ? { borderLeftColor: accent, borderLeftWidth: 4 } : null,
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function SectionHeader({ title, icon, action }: { title: string; icon?: IconName; action?: ReactNode }) {
  const { colors, highContrast } = useTheme();
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionTitle}>
        {icon && <Ionicons name={icon} size={18} color={highContrast ? colors.teal : colors.primary} />}
        <AppText variant="heading" accessibilityRole="header">
          {title}
        </AppText>
      </View>
      {action}
    </View>
  );
}

export function Pill({ label, color, filled = false }: { label: string; color: string; filled?: boolean }) {
  const { highContrast } = useTheme();
  return (
    <View
      style={[
        styles.pill,
        {
          borderColor: color,
          backgroundColor: filled ? color : highContrast ? '#000' : `${color}22`,
          borderWidth: highContrast ? 2 : 1,
        },
      ]}
    >
      <AppText variant="label" color={filled ? '#0b1120' : color} style={styles.pillText}>
        {label}
      </AppText>
    </View>
  );
}

export function StatTile({
  label,
  value,
  sub,
  icon,
  color,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon?: IconName;
  color?: string;
}) {
  const { colors } = useTheme();
  const tint = color ?? colors.primary;
  return (
    <Card style={styles.stat}>
      {icon && (
        <View style={[styles.statIcon, { backgroundColor: `${tint}26` }]}>
          <Ionicons name={icon} size={18} color={tint} />
        </View>
      )}
      <AppText variant="title" numberOfLines={1} adjustsFontSizeToFit>
        {String(value)}
      </AppText>
      <AppText variant="caption" tone="muted" numberOfLines={1}>
        {label}
      </AppText>
      {sub ? (
        <AppText variant="caption" tone="faint" numberOfLines={1}>
          {sub}
        </AppText>
      ) : null}
    </Card>
  );
}

export function Avatar({ text, size = 44, color }: { text: string; size?: number; color?: string }) {
  const { colors, highContrast } = useTheme();
  return (
    <View
      accessible={false}
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius: size * 0.3,
          backgroundColor: highContrast ? '#000' : color ?? '#1d4ed8',
          borderColor: colors.border,
          borderWidth: highContrast ? 2 : 0,
        },
      ]}
    >
      <AppText weight="800" color="#fff">
        {text}
      </AppText>
    </View>
  );
}

/** Tappable row for menus and lists. */
export function ListItem({
  title,
  subtitle,
  icon,
  onPress,
  right,
  destructive,
  accessibilityHint,
}: {
  title: string;
  subtitle?: string;
  icon?: IconName;
  onPress?: () => void;
  right?: ReactNode;
  destructive?: boolean;
  accessibilityHint?: string;
}) {
  const { colors, highContrast } = useTheme();
  const tint = destructive ? colors.danger : highContrast ? colors.teal : colors.primary;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [styles.listItem, { opacity: pressed ? 0.7 : 1 }]}
    >
      {icon && (
        <View style={[styles.listIcon, { backgroundColor: highContrast ? '#000' : `${tint}22`, borderColor: colors.border, borderWidth: highContrast ? 1 : 0 }]}>
          <Ionicons name={icon} size={20} color={tint} />
        </View>
      )}
      <View style={styles.flex}>
        <AppText weight="600" color={destructive ? colors.danger : undefined}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="caption" tone="faint">
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {right ?? (onPress ? <Ionicons name="chevron-forward" size={18} color={colors.textFaint} /> : null)}
    </Pressable>
  );
}

export function Divider() {
  const { colors } = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border }} />;
}

export function KeyValue({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.kv}>
      <AppText variant="caption" tone="faint">
        {label}
      </AppText>
      <AppText weight="600" style={styles.kvValue}>
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.sm },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexShrink: 1 },
  pill: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3, alignSelf: 'flex-start' },
  pillText: { letterSpacing: 0.4 },
  stat: { flex: 1, minWidth: 140, gap: 2 },
  statIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  avatar: { alignItems: 'center', justifyContent: 'center' },
  listItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: TOUCH_TARGET + 8, paddingVertical: 6 },
  listIcon: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  kv: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, paddingVertical: 4 },
  kvValue: { flexShrink: 1, textAlign: 'right' },
});
