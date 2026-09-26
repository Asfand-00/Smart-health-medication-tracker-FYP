import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { forwardRef, useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  TextInput,
  TextInputProps,
  View,
} from 'react-native';

import { useTheme } from '../../context/AccessibilityContext';
import { radius, spacing, TOUCH_TARGET } from '../../theme';
import { formatDate, fromDateKey, toDateKey } from '../../utils/format';
import { AppText } from './AppText';
import { Button } from './Button';
import { Sheet } from './Sheet';

type IconName = keyof typeof Ionicons.glyphMap;

function FieldLabel({ label, required }: { label: string; required?: boolean }) {
  return (
    <AppText variant="caption" tone="muted" weight="600">
      {label}
      {required ? ' *' : ''}
    </AppText>
  );
}

function FieldError({ error }: { error?: string }) {
  if (!error) return null;
  return (
    <AppText variant="caption" tone="danger" accessibilityLiveRegion="polite">
      ⚠ {error}
    </AppText>
  );
}

export interface TextFieldProps extends TextInputProps {
  label?: string;
  error?: string;
  icon?: IconName;
  required?: boolean;
  hint?: string;
}

export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { label, error, icon, required, hint, secureTextEntry, multiline, editable = true, style, ...rest },
  ref,
) {
  const theme = useTheme();
  const { colors } = theme;
  const [hidden, setHidden] = useState(true);
  const [focused, setFocused] = useState(false);
  const isPassword = Boolean(secureTextEntry);
  const borderColor = error ? colors.danger : focused ? (theme.highContrast ? '#ffff00' : colors.primary) : colors.borderStrong;

  return (
    <View style={styles.field}>
      {label ? <FieldLabel label={label} required={required} /> : null}
      <View
        style={[
          styles.inputWrap,
          {
            backgroundColor: editable ? colors.surfaceAlt : colors.surface,
            borderColor,
            borderWidth: theme.highContrast || focused || error ? 2 : 1,
            minHeight: multiline ? 96 : TOUCH_TARGET + 4,
            alignItems: multiline ? 'flex-start' : 'center',
          },
        ]}
      >
        {icon ? <Ionicons name={icon} size={18} color={colors.textFaint} style={multiline ? styles.iconTop : undefined} /> : null}
        <TextInput
          ref={ref}
          accessibilityLabel={label ?? rest.placeholder}
          accessibilityHint={hint}
          placeholderTextColor={colors.textFaint}
          secureTextEntry={isPassword && hidden}
          multiline={multiline}
          editable={editable}
          onFocus={(e) => {
            setFocused(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            rest.onBlur?.(e);
          }}
          maxFontSizeMultiplier={1.6}
          style={[
            styles.input,
            { color: editable ? colors.text : colors.textFaint, fontSize: theme.fs(16) },
            multiline && styles.multiline,
            style,
          ]}
          {...rest}
        />
        {isPassword ? (
          <Pressable
            onPress={() => setHidden((h) => !h)}
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Show password' : 'Hide password'}
            hitSlop={10}
            style={styles.eye}
          >
            <Ionicons name={hidden ? 'eye-outline' : 'eye-off-outline'} size={20} color={colors.textFaint} />
          </Pressable>
        ) : null}
      </View>
      {hint && !error ? (
        <AppText variant="caption" tone="faint">
          {hint}
        </AppText>
      ) : null}
      <FieldError error={error} />
    </View>
  );
});

export interface Option<T extends string> {
  value: T;
  label: string;
  description?: string;
}

/** Replacement for <select>: a field that opens a bottom-sheet option list. */
export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
  placeholder = 'Select…',
  disabled,
  required,
  error,
}: {
  label: string;
  value: T | '';
  options: Option<T>[];
  onChange: (value: T) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  error?: string;
}) {
  const theme = useTheme();
  const { colors } = theme;
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <View style={styles.field}>
      <FieldLabel label={label} required={required} />
      <Pressable
        disabled={disabled}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${selected?.label ?? 'not selected'}`}
        accessibilityHint="Opens a list of options"
        style={[
          styles.inputWrap,
          {
            backgroundColor: disabled ? colors.surface : colors.surfaceAlt,
            borderColor: error ? colors.danger : colors.borderStrong,
            borderWidth: theme.borderWidth,
            minHeight: TOUCH_TARGET + 4,
          },
        ]}
      >
        <AppText style={styles.flex} tone={selected ? 'default' : 'faint'} numberOfLines={1}>
          {selected?.label ?? placeholder}
        </AppText>
        {!disabled && <Ionicons name="chevron-down" size={18} color={colors.textFaint} />}
      </Pressable>
      <FieldError error={error} />
      <Sheet visible={open} onClose={() => setOpen(false)} title={label}>
        {options.map((o) => {
          const isSel = o.value === value;
          return (
            <Pressable
              key={o.value}
              onPress={() => {
                onChange(o.value);
                setOpen(false);
              }}
              accessibilityRole="radio"
              accessibilityState={{ checked: isSel }}
              style={[
                styles.option,
                {
                  borderColor: isSel ? (theme.highContrast ? '#ffff00' : colors.primary) : colors.border,
                  backgroundColor: isSel ? (theme.highContrast ? '#000' : 'rgba(59,130,246,0.15)') : colors.surfaceAlt,
                  borderWidth: isSel || theme.highContrast ? 2 : 1,
                },
              ]}
            >
              <View style={styles.flex}>
                <AppText weight={isSel ? '700' : '500'}>{o.label}</AppText>
                {o.description ? (
                  <AppText variant="caption" tone="faint">
                    {o.description}
                  </AppText>
                ) : null}
              </View>
              {isSel && <Ionicons name="checkmark-circle" size={22} color={theme.highContrast ? '#ffff00' : colors.primary} />}
            </Pressable>
          );
        })}
      </Sheet>
    </View>
  );
}

/**
 * Date picker field. Value is a local YYYY-MM-DD string (what the web's
 * <input type="date"> produces and what the backend accepts).
 * Uses the native picker on iOS/Android and a text input on web.
 */
export function DateField({
  label,
  value,
  onChange,
  required,
  optional,
  disabled,
  minimumDate,
  maximumDate,
  error,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  optional?: boolean;
  disabled?: boolean;
  minimumDate?: Date;
  maximumDate?: Date;
  error?: string;
}) {
  const theme = useTheme();
  const { colors } = theme;
  const [open, setOpen] = useState(false);
  const [iosDraft, setIosDraft] = useState<Date>(value ? fromDateKey(value) : new Date());

  if (Platform.OS === 'web') {
    return (
      <TextField
        label={label}
        required={required}
        value={value}
        onChangeText={onChange}
        placeholder="YYYY-MM-DD"
        editable={!disabled}
        error={error}
      />
    );
  }

  const current = value ? fromDateKey(value) : new Date();

  const onAndroidChange = (event: DateTimePickerEvent, date?: Date) => {
    setOpen(false);
    if (event.type === 'set' && date) onChange(toDateKey(date));
  };

  return (
    <View style={styles.field}>
      <FieldLabel label={label} required={required} />
      <View style={styles.dateRow}>
        <Pressable
          disabled={disabled}
          onPress={() => {
            setIosDraft(current);
            setOpen(true);
          }}
          accessibilityRole="button"
          accessibilityLabel={`${label}: ${value ? formatDate(fromDateKey(value), { dateStyle: 'full' }) : 'not set'}`}
          accessibilityHint="Opens a date picker"
          style={[
            styles.inputWrap,
            styles.flex,
            {
              backgroundColor: disabled ? colors.surface : colors.surfaceAlt,
              borderColor: error ? colors.danger : colors.borderStrong,
              borderWidth: theme.borderWidth,
              minHeight: TOUCH_TARGET + 4,
            },
          ]}
        >
          <Ionicons name="calendar-outline" size={18} color={colors.textFaint} />
          <AppText style={styles.flex} tone={value ? 'default' : 'faint'}>
            {value ? formatDate(fromDateKey(value), { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : 'Not set'}
          </AppText>
        </Pressable>
        {optional && value && !disabled ? (
          <Button title="Clear" variant="ghost" onPress={() => onChange('')} accessibilityLabel={`Clear ${label}`} />
        ) : null}
      </View>
      <FieldError error={error} />

      {open && Platform.OS === 'android' && (
        <DateTimePicker
          value={current}
          mode="date"
          onChange={onAndroidChange}
          minimumDate={minimumDate}
          maximumDate={maximumDate}
        />
      )}

      {Platform.OS === 'ios' && (
        <Sheet
          visible={open}
          onClose={() => setOpen(false)}
          title={label}
          footer={
            <>
              <Button title="Cancel" variant="secondary" onPress={() => setOpen(false)} style={styles.flex} />
              <Button
                title="Done"
                onPress={() => {
                  onChange(toDateKey(iosDraft));
                  setOpen(false);
                }}
                style={styles.flex}
              />
            </>
          }
        >
          <DateTimePicker
            value={iosDraft}
            mode="date"
            display="inline"
            themeVariant="dark"
            onChange={(_, d) => d && setIosDraft(d)}
            minimumDate={minimumDate}
            maximumDate={maximumDate}
          />
        </Sheet>
      )}
    </View>
  );
}

/** Chip group: single or multiple selection (time-of-day, filters, roles). */
export function ChipGroup<T extends string>({
  label,
  options,
  selected,
  onToggle,
  multiple = false,
  required,
  error,
}: {
  label?: string;
  options: Option<T>[];
  selected: T[];
  onToggle: (value: T) => void;
  multiple?: boolean;
  required?: boolean;
  error?: string;
}) {
  const theme = useTheme();
  const { colors } = theme;
  return (
    <View style={styles.field}>
      {label ? <FieldLabel label={label} required={required} /> : null}
      <View style={styles.chips} accessibilityRole={multiple ? undefined : 'radiogroup'}>
        {options.map((o) => {
          const isSel = selected.includes(o.value);
          return (
            <Pressable
              key={o.value}
              onPress={() => onToggle(o.value)}
              accessibilityRole={multiple ? 'checkbox' : 'radio'}
              accessibilityState={{ checked: isSel }}
              accessibilityLabel={o.label}
              style={[
                styles.chip,
                {
                  backgroundColor: isSel ? colors.primary : colors.surfaceAlt,
                  borderColor: isSel ? (theme.highContrast ? '#ffff00' : colors.primary) : colors.borderStrong,
                  borderWidth: theme.highContrast || isSel ? 2 : 1,
                },
              ]}
            >
              {isSel && <Ionicons name="checkmark" size={16} color={colors.onPrimary} />}
              <AppText weight="600" color={isSel ? colors.onPrimary : colors.text}>
                {o.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
      <FieldError error={error} />
    </View>
  );
}

/** Integer stepper — replaces range sliders (easier to hit, screen-reader adjustable). */
export function Stepper({
  label,
  value,
  min,
  max,
  onChange,
  description,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  description?: string;
}) {
  const theme = useTheme();
  const { colors } = theme;
  const dec = () => onChange(Math.max(min, value - 1));
  const inc = () => onChange(Math.min(max, value + 1));
  return (
    <View
      style={styles.field}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ min, max, now: value, text: `${value} of ${max}` }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => (e.nativeEvent.actionName === 'increment' ? inc() : dec())}
    >
      <View style={styles.stepperHead}>
        <AppText weight="600" style={styles.flex}>
          {label}
        </AppText>
        <AppText variant="heading" tone="primary">
          {value}/{max}
        </AppText>
      </View>
      <View style={styles.stepperRow}>
        <Button title="−" variant="secondary" onPress={dec} disabled={value <= min} accessibilityLabel={`Decrease ${label}`} style={styles.stepBtn} />
        <View style={[styles.track, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
          <View style={[styles.trackFill, { width: `${((value - min) / (max - min)) * 100}%`, backgroundColor: colors.primary }]} />
        </View>
        <Button title="+" variant="secondary" onPress={inc} disabled={value >= max} accessibilityLabel={`Increase ${label}`} style={styles.stepBtn} />
      </View>
      {description ? (
        <AppText variant="caption" tone="faint">
          {description}
        </AppText>
      ) : null}
    </View>
  );
}

export function ToggleRow({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  const { colors, highContrast } = useTheme();
  return (
    <Pressable
      onPress={() => onChange(!value)}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={label}
      accessibilityHint={description}
      style={styles.toggle}
    >
      <View style={styles.flex}>
        <AppText weight="600">{label}</AppText>
        {description ? (
          <AppText variant="caption" tone="faint">
            {description}
          </AppText>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: highContrast ? '#ffff00' : colors.primary, false: colors.surfaceAlt }}
        thumbColor="#ffffff"
        importantForAccessibility="no-hide-descendants"
      />
    </Pressable>
  );
}

/** Tabs within a screen (web: tab buttons at the top of a card). */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Option<T>[];
  value: T;
  onChange: (v: T) => void;
}) {
  const theme = useTheme();
  const { colors } = theme;
  return (
    <View
      accessibilityRole="tablist"
      style={[styles.segment, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: theme.borderWidth }]}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="tab"
            accessibilityLabel={o.label}
            accessibilityState={{ selected: active }}
            style={[
              styles.segmentItem,
              active && { backgroundColor: theme.highContrast ? '#fff' : colors.primary },
            ]}
          >
            <AppText variant="caption" weight="700" align="center" color={active ? colors.onPrimary : colors.textMuted} numberOfLines={1}>
              {o.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  flex: { flex: 1 },
  inputWrap: {
    flexDirection: 'row',
    gap: spacing.sm,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  },
  // minWidth 0: a browser <input> has an intrinsic width that would otherwise overflow side-by-side fields
  input: { flex: 1, minWidth: 0, paddingVertical: 10, minHeight: TOUCH_TARGET },
  multiline: { textAlignVertical: 'top', minHeight: 88 },
  iconTop: { marginTop: 14 },
  eye: { padding: 6 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.md,
    padding: spacing.md,
    minHeight: TOUCH_TARGET + 8,
  },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
  },
  stepperHead: { flexDirection: 'row', alignItems: 'center' },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  stepBtn: { width: 56 },
  track: { flex: 1, height: 10, borderRadius: 5, overflow: 'hidden', borderWidth: 1 },
  trackFill: { height: '100%' },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: TOUCH_TARGET + 8 },
  segment: { flexDirection: 'row', borderRadius: radius.md, padding: 4, gap: 4 },
  segmentItem: { flex: 1, minHeight: 40, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
});
