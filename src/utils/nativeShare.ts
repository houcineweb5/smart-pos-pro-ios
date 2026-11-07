/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Universal Native Share Sheet utility.
 * Triggers the native iOS/Android sharing menu (AirDrop, AirPrint, WhatsApp, Mail, Telegram)
 * when available, with automatic fallback to WhatsApp or clipboard.
 */
export interface ShareOptions {
  title: string;
  text: string;
  url?: string;
  phone?: string;
  dialogTitle?: string;
}

export const canUseNativeShare = (): boolean => {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
};

export const shareContent = async (options: ShareOptions): Promise<boolean> => {
  try {
    if (canUseNativeShare()) {
      await navigator.share({
        title: options.title,
        text: options.text,
        url: options.url || undefined,
      });
      return true;
    }
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      return true; // User voluntarily cancelled the sheet
    }
  }

  // Fallback to WhatsApp
  let cleanPhone = options.phone ? options.phone.replace(/[^0-9]/g, '') : '';
  if (cleanPhone.startsWith('06') || cleanPhone.startsWith('07')) {
    cleanPhone = '212' + cleanPhone.slice(1);
  }

  const baseText = `${options.text}${options.url ? `\n${options.url}` : ''}`;
  const waUrl = cleanPhone 
    ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(baseText)}` 
    : `https://wa.me/?text=${encodeURIComponent(baseText)}`;

  window.open(waUrl, '_blank');
  return true;
};
