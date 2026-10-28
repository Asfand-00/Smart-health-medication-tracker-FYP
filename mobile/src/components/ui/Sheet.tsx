import { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../../context/AccessibilityContext';
import { radius, spacing } from '../../theme';
import { AppText } from './AppText';
import { IconButton } from './Button';

/**
 * Bottom sheet built on RN Modal — mobile replacement for the web's centred
 * modal dialogs (medication form, vitals form, edit user, ...).
 */
export function Sheet({
  visible,
  onClose,
  title,
  subtitle,
  children,
  footer,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const { colors, borderWidth } = useTheme();
  const insets = useSafeAreaInsets();
  // A pixel cap (not a percentage) so the scroll area can shrink and the footer
  // buttons always stay on screen.
  const { height } = useWindowDimensions();
  const maxHeight = Math.round((height - insets.top) * 0.92);
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.backdrop, { backgroundColor: colors.overlay }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" accessibilityRole="button" />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View
            accessibilityViewIsModal
            style={[
              styles.sheet,
              { backgroundColor: colors.surface, borderColor: colors.borderStrong, borderWidth, paddingBottom: insets.bottom + spacing.md, maxHeight },
            ]}
          >
            <View style={[styles.handle, { backgroundColor: colors.borderStrong }]} />
            <View style={styles.header}>
              <View style={styles.flex}>
                <AppText variant="title" accessibilityRole="header">
                  {title}
                </AppText>
                {subtitle ? (
                  <AppText variant="caption" tone="faint">
                    {subtitle}
                  </AppText>
                ) : null}
              </View>
              <IconButton icon="close" accessibilityLabel="Close" onPress={onClose} />
            </View>
            <ScrollView
              style={styles.scroll}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.content}
              showsVerticalScrollIndicator={false}
            >
              {children}
            </ScrollView>
            {footer ? <View style={styles.footer}>{footer}</View> : null}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg,
  },
  scroll: { flexGrow: 0, flexShrink: 1 },
  handle: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, marginTop: 8, marginBottom: 4 },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  flex: { flex: 1 },
  content: { gap: spacing.md, paddingBottom: spacing.lg },
  footer: { flexDirection: 'row', gap: spacing.md, paddingTop: spacing.sm },
});
