import { Alert, Platform } from 'react-native';

/**
 * Promise-based confirmation — replaces window.confirm().
 * Alert.alert with buttons is a no-op on react-native-web, so web falls back
 * to window.confirm.
 */
export function confirmAction(
  title: string,
  message: string,
  confirmLabel = 'Delete',
  destructive = true,
): Promise<boolean> {
  if (Platform.OS === 'web') {
    return Promise.resolve(typeof window !== 'undefined' ? window.confirm(`${title}\n\n${message}`) : false);
  }
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: confirmLabel, style: destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}
