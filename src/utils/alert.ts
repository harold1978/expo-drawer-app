import { Alert, Platform } from 'react-native';

/**
 * Wrapper cross-platform de Alert.
 * En web usa window.alert / window.confirm, en nativo usa Alert.alert.
 */
export const showAlert = (
  title: string,
  message?: string,
  buttons?: Array<{
    text: string;
    onPress?: () => void;
    style?: 'default' | 'cancel' | 'destructive';
  }>
): void => {
  if (Platform.OS === 'web') {
    if (!buttons || buttons.length <= 1) {
      window.alert(`${title}${message ? `\n\n${message}` : ''}`);
      const defaultButton = buttons?.find((b) => b.style !== 'cancel');
      defaultButton?.onPress?.();
    } else {
      const confirmed = window.confirm(`${title}${message ? `\n\n${message}` : ''}`);
      if (confirmed) {
        const destructive = buttons.find(
          (b) => b.style === 'destructive' || b.style === 'default' || !b.style
        );
        destructive?.onPress?.();
      }
    }
  } else {
    Alert.alert(title, message, buttons);
  }
};
