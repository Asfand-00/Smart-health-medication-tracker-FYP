/**
 * In-app toasts — replaces react-hot-toast. Rendered above the navigator,
 * announced to screen readers via accessibilityLiveRegion / announceForAccessibility.
 */
import { Ionicons } from '@expo/vector-icons';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '../components/ui/AppText';
import { useTheme } from './AccessibilityContext';

export type ToastVariant = 'success' | 'error' | 'info' | 'warning' | 'critical';

interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
  duration: number;
}

interface ToastApi {
  show: (message: string, variant?: ToastVariant, duration?: number) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string, duration?: number) => void;
  warning: (message: string, duration?: number) => void;
  critical: (message: string, duration?: number) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const MAX_VISIBLE = 3;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (message: string, variant: ToastVariant = 'info', duration = 4000) => {
      const id = nextId.current++;
      setToasts((prev) => [...prev.slice(-(MAX_VISIBLE - 1)), { id, message, variant, duration }]);
      AccessibilityInfo.announceForAccessibility(message);
      setTimeout(() => dismiss(id), duration);
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({
      show,
      success: (m) => show(m, 'success'),
      error: (m) => show(m, 'error', 5000),
      info: (m, d) => show(m, 'info', d),
      warning: (m, d) => show(m, 'warning', d ?? 6000),
      critical: (m, d) => show(m, 'critical', d ?? 10000),
    }),
    [show],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastHost toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

function ToastHost({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  const insets = useSafeAreaInsets();
  if (toasts.length === 0) return null;
  return (
    <View pointerEvents="box-none" style={[styles.host, { top: insets.top + 8 }]}>
      {toasts.map((t) => (
        <ToastRow key={t.id} toast={t} onDismiss={() => onDismiss(t.id)} />
      ))}
    </View>
  );
}

const ICONS: Record<ToastVariant, keyof typeof Ionicons.glyphMap> = {
  success: 'checkmark-circle',
  error: 'alert-circle',
  info: 'notifications',
  warning: 'warning',
  critical: 'alert',
};

function ToastRow({ toast, onDismiss }: { toast: ToastItem; onDismiss: () => void }) {
  const theme = useTheme();
  const { colors } = theme;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: Platform.OS !== 'web' }).start();
  }, [opacity]);

  const accent =
    toast.variant === 'success'
      ? colors.success
      : toast.variant === 'error' || toast.variant === 'critical'
        ? colors.danger
        : toast.variant === 'warning'
          ? colors.warning
          : colors.primary;

  return (
    <Animated.View style={{ opacity }}>
      <Pressable
        onPress={onDismiss}
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        accessibilityHint="Tap to dismiss"
        style={[
          styles.toast,
          {
            backgroundColor: theme.highContrast ? '#000' : '#1e293b',
            borderColor: accent,
            borderWidth: theme.highContrast ? 2 : 1,
          },
        ]}
      >
        <Ionicons name={ICONS[toast.variant]} size={22} color={accent} />
        <AppText style={styles.message} weight="600">
          {toast.message}
        </AppText>
      </Pressable>
    </Animated.View>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

const styles = StyleSheet.create({
  host: { position: 'absolute', left: 12, right: 12, gap: 8, zIndex: 1000, elevation: 1000 },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  message: { flex: 1 },
});
