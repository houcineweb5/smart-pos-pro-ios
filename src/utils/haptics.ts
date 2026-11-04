/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Cross-platform haptic feedback helper for iOS, Android, and Desktop.
 * Provides subtle tactile confirmation on mobile devices during barcode scans,
 * sales completion, and key button taps.
 */
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

export type HapticFeedbackType = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error';

/**
 * Cross-platform haptic feedback helper for iOS (Taptic Engine), Android, and Browsers.
 * Provides subtle tactile confirmation on mobile devices during barcode scans,
 * sales completion, product selection, and button taps.
 */
export const triggerHaptic = async (type: HapticFeedbackType = 'light') => {
  try {
    // 1. Try Native Capacitor Haptics (iOS Taptic Engine & Android Native Vibrator)
    if (type === 'light') {
      await Haptics.impact({ style: ImpactStyle.Light });
      return;
    } else if (type === 'medium') {
      await Haptics.impact({ style: ImpactStyle.Medium });
      return;
    } else if (type === 'heavy') {
      await Haptics.impact({ style: ImpactStyle.Heavy });
      return;
    } else if (type === 'success') {
      await Haptics.notification({ type: NotificationType.Success });
      return;
    } else if (type === 'warning') {
      await Haptics.notification({ type: NotificationType.Warning });
      return;
    } else if (type === 'error') {
      await Haptics.notification({ type: NotificationType.Error });
      return;
    }
  } catch {
    // 2. Fallback to Web Vibration API for desktop / non-Capacitor webviews
    try {
      if (typeof window !== 'undefined' && 'navigator' in window && typeof navigator.vibrate === 'function') {
        switch (type) {
          case 'light':
            navigator.vibrate(20);
            break;
          case 'medium':
            navigator.vibrate(40);
            break;
          case 'heavy':
            navigator.vibrate(65);
            break;
          case 'success':
            navigator.vibrate([25, 45, 30]);
            break;
          case 'warning':
            navigator.vibrate([40, 50, 40]);
            break;
          case 'error':
            navigator.vibrate([60, 40, 60, 40, 60]);
            break;
        }
      }
    } catch {
      // Fail silently on browsers that block vibration
    }
  }
};
