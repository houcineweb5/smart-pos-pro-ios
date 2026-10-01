/**
 * Universal decimal & price parser and formatter.
 * Seamlessly handles comma (,) and dot (.) in all keyboards and locales.
 */

// Arabic digits map (Arabic-Indic and Eastern Arabic-Indic)
const arabicDigitsMap: { [key: string]: string } = {
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
  '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
  '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
  '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
};

function normalizeArabicChars(input: string): string {
  return input
    .replace(/[٠-٩۰-۹]/g, (char) => arabicDigitsMap[char] || char)
    .replace(/[،٫٬]/g, '.');
}

export function normalizeDecimal(value: string | number | undefined | null): string {
  if (value === null || value === undefined) return '';
  const converted = normalizeArabicChars(String(value));
  return converted.replace(/,/g, '.').trim();
}

export function parseDecimal(value: string | number | undefined | null, defaultValue = 0): number {
  if (value === null || value === undefined) return defaultValue;
  if (typeof value === 'number') return isNaN(value) ? defaultValue : value;
  const str = normalizeArabicChars(String(value)).replace(/,/g, '.').trim();
  if (str === '' || str === '.' || str === '-') return defaultValue;
  const parsed = parseFloat(str);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Validates and converts comma to dot on typing in text inputs
 */
export function sanitizeDecimalInput(input: string): string {
  // Convert Arabic numerals and Arabic comma/decimal separators
  let val = normalizeArabicChars(input);
  // Replace standard comma with dot
  val = val.replace(/,/g, '.');
  // Allow only digits, one decimal point, and optional leading minus
  const parts = val.split('.');
  if (parts.length > 2) {
    val = parts[0] + '.' + parts.slice(1).join('');
  }
  return val.replace(/[^0-9.-]/g, '');
}
