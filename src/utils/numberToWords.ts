/**
 * Utility for converting numerical monetary amounts into written words
 * in French and Arabic (Tafqeet / التفقيط المالي الرسمي للفواتير).
 */

interface CurrencyConfig {
  arMain: { singular: string; dual: string; plural: string; accusative: string };
  arSub: { singular: string; dual: string; plural: string; accusative: string };
  frMain: { singular: string; plural: string };
  frSub: { singular: string; plural: string };
}

function resolveCurrency(code?: string): CurrencyConfig {
  const c = String(code || '').trim().toUpperCase();
  if (c === 'MAD' || c.includes('درهم') || c === 'DH') {
    return {
      arMain: { singular: 'درهم', dual: 'درهمان', plural: 'دراهم', accusative: 'درهماً' },
      arSub: { singular: 'سنتيم', dual: 'سنتيمان', plural: 'سنتيمات', accusative: 'سنتيماً' },
      frMain: { singular: 'dirham', plural: 'dirhams' },
      frSub: { singular: 'centime', plural: 'centimes' }
    };
  }
  if (c === 'DZD' || c === 'DA' || c.includes('دينار')) {
    return {
      arMain: { singular: 'دينار', dual: 'ديناران', plural: 'دنانير', accusative: 'ديناراً' },
      arSub: { singular: 'سنتيم', dual: 'سنتيمان', plural: 'سنتيمات', accusative: 'سنتيماً' },
      frMain: { singular: 'dinar', plural: 'dinars' },
      frSub: { singular: 'centime', plural: 'centimes' }
    };
  }
  if (c === 'EUR' || c === '€') {
    return {
      arMain: { singular: 'يورو', dual: 'يورو', plural: 'يورو', accusative: 'يورو' },
      arSub: { singular: 'سنت', dual: 'سنتان', plural: 'سنتات', accusative: 'سنتاً' },
      frMain: { singular: 'euro', plural: 'euros' },
      frSub: { singular: 'cent', plural: 'cents' }
    };
  }
  if (c === 'USD' || c === '$') {
    return {
      arMain: { singular: 'دولار', dual: 'دولاران', plural: 'دولارات', accusative: 'دولاراً' },
      arSub: { singular: 'سنت', dual: 'سنتان', plural: 'سنتات', accusative: 'سنتاً' },
      frMain: { singular: 'dollar', plural: 'dollars' },
      frSub: { singular: 'cent', plural: 'cents' }
    };
  }
  // Generic currency fallback
  const curName = code || 'درهم';
  return {
    arMain: { singular: curName, dual: curName, plural: curName, accusative: curName },
    arSub: { singular: 'سنتيم', dual: 'سنتيمان', plural: 'سنتيمات', accusative: 'سنتيماً' },
    frMain: { singular: curName, plural: curName },
    frSub: { singular: 'centime', plural: 'centimes' }
  };
}

// ======================== FRENCH NUMBER TO WORDS ========================

const FR_UNITS = [
  '', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf',
  'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize',
  'dix-sept', 'dix-huit', 'dix-neuf'
];

const FR_TENS = [
  '', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante',
  'soixante-dix', 'quatre-vingt', 'quatre-vingt-dix'
];

function frConvertUnder100(n: number): string {
  if (n < 20) return FR_UNITS[n];
  const ten = Math.floor(n / 10);
  const unit = n % 10;

  if (ten === 7) {
    if (unit === 1) return 'soixante et onze';
    return `soixante-${FR_UNITS[10 + unit]}`;
  }
  if (ten === 8) {
    if (unit === 0) return 'quatre-vingts';
    return `quatre-vingt-${FR_UNITS[unit]}`;
  }
  if (ten === 9) {
    return `quatre-vingt-${FR_UNITS[10 + unit]}`;
  }

  if (unit === 1) {
    return `${FR_TENS[ten]} et un`;
  }
  if (unit > 1) {
    return `${FR_TENS[ten]}-${FR_UNITS[unit]}`;
  }
  return FR_TENS[ten];
}

function frConvertUnder1000(n: number): string {
  if (n === 0) return '';
  const hundreds = Math.floor(n / 100);
  const remainder = n % 100;
  let res = '';

  if (hundreds === 1) {
    res = 'cent';
  } else if (hundreds > 1) {
    res = `${FR_UNITS[hundreds]} cent`;
    if (remainder === 0) res += 's';
  }

  if (remainder > 0) {
    const remStr = frConvertUnder100(remainder);
    res = res ? `${res} ${remStr}` : remStr;
  }
  return res;
}

export function numberToWordsFr(num: number): string {
  if (num === 0) return 'zéro';
  if (num < 0) return `moins ${numberToWordsFr(-num)}`;

  const billions = Math.floor(num / 1000000000);
  let rem = num % 1000000000;
  const millions = Math.floor(rem / 1000000);
  rem = rem % 1000000;
  const thousands = Math.floor(rem / 1000);
  const remainder = rem % 1000;

  const parts: string[] = [];

  if (billions > 0) {
    parts.push(billions === 1 ? 'un milliard' : `${frConvertUnder1000(billions)} milliards`);
  }
  if (millions > 0) {
    parts.push(millions === 1 ? 'un million' : `${frConvertUnder1000(millions)} millions`);
  }
  if (thousands > 0) {
    if (thousands === 1) {
      parts.push('mille');
    } else {
      parts.push(`${frConvertUnder1000(thousands)} mille`);
    }
  }
  if (remainder > 0) {
    parts.push(frConvertUnder1000(remainder));
  }

  return parts.join(' ').trim();
}

export function amountToWordsFr(amount: number, currencyCode?: string): string {
  const safeAmount = Math.abs(Number(amount) || 0);
  const integerPart = Math.floor(safeAmount);
  const decimalPart = Math.round((safeAmount - integerPart) * 100);
  const cur = resolveCurrency(currencyCode);

  let words = numberToWordsFr(integerPart);
  // Capitalize first letter
  words = words.charAt(0).toUpperCase() + words.slice(1);

  const mainLabel = integerPart <= 1 ? cur.frMain.singular : cur.frMain.plural;
  let result = `${words} ${mainLabel}`;

  if (decimalPart > 0) {
    const decWords = numberToWordsFr(decimalPart);
    const subLabel = decimalPart <= 1 ? cur.frSub.singular : cur.frSub.plural;
    result += ` et ${decWords} ${subLabel}`;
  }

  return result.trim();
}

// ======================== ARABIC TAFQEET ========================

const AR_ONES = [
  '', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة',
  'عشرة', 'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر',
  'سبعة عشر', 'ثمانية عشر', 'تسعة عشر'
];

const AR_TENS = [
  '', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'
];

const AR_HUNDREDS = [
  '', 'مائة', 'مائتان', 'ثلاثمائة', 'أربعمائة', 'خمسمائة', 'ستمائة', 'سبعمائة', 'ثمانمائة', 'تسعمائة'
];

function arConvertUnder100(n: number): string {
  if (n < 20) return AR_ONES[n];
  const ones = n % 10;
  const tens = Math.floor(n / 10);
  if (ones === 0) return AR_TENS[tens];
  return `${AR_ONES[ones]} و${AR_TENS[tens]}`;
}

function arConvertUnder1000(n: number): string {
  if (n === 0) return '';
  const hundreds = Math.floor(n / 100);
  const rem = n % 100;
  const parts: string[] = [];

  if (hundreds > 0) {
    parts.push(AR_HUNDREDS[hundreds]);
  }
  if (rem > 0) {
    parts.push(arConvertUnder100(rem));
  }

  return parts.join(' و');
}

export function numberToWordsAr(num: number): string {
  if (num === 0) return 'صفر';
  if (num < 0) return `سالب ${numberToWordsAr(-num)}`;

  const billions = Math.floor(num / 1000000000);
  let rem = num % 1000000000;
  const millions = Math.floor(rem / 1000000);
  rem = rem % 1000000;
  const thousands = Math.floor(rem / 1000);
  const remainder = rem % 1000;

  const parts: string[] = [];

  if (billions > 0) {
    if (billions === 1) parts.push('مليار');
    else if (billions === 2) parts.push('ملياران');
    else if (billions >= 3 && billions <= 10) parts.push(`${arConvertUnder1000(billions)} مليارات`);
    else parts.push(`${arConvertUnder1000(billions)} مليار`);
  }

  if (millions > 0) {
    if (millions === 1) parts.push('مليون');
    else if (millions === 2) parts.push('مليونان');
    else if (millions >= 3 && millions <= 10) parts.push(`${arConvertUnder1000(millions)} ملايين`);
    else parts.push(`${arConvertUnder1000(millions)} مليون`);
  }

  if (thousands > 0) {
    if (thousands === 1) parts.push('ألف');
    else if (thousands === 2) parts.push('ألفان');
    else if (thousands >= 3 && thousands <= 10) parts.push(`${arConvertUnder1000(thousands)} آلاف`);
    else parts.push(`${arConvertUnder1000(thousands)} ألف`);
  }

  if (remainder > 0) {
    parts.push(arConvertUnder1000(remainder));
  }

  return parts.join(' و');
}

export function amountToWordsAr(amount: number, currencyCode?: string): string {
  const safeAmount = Math.abs(Number(amount) || 0);
  const integerPart = Math.floor(safeAmount);
  const decimalPart = Math.round((safeAmount - integerPart) * 100);
  const cur = resolveCurrency(currencyCode);

  let result = '';

  if (integerPart === 0) {
    result = `صفر ${cur.arMain.singular}`;
  } else if (integerPart === 1) {
    result = cur.arMain.singular;
  } else if (integerPart === 2) {
    result = cur.arMain.dual;
  } else if (integerPart >= 3 && integerPart <= 10) {
    result = `${numberToWordsAr(integerPart)} ${cur.arMain.plural}`;
  } else if (integerPart % 100 >= 11 && integerPart % 100 <= 99) {
    result = `${numberToWordsAr(integerPart)} ${cur.arMain.accusative}`;
  } else {
    result = `${numberToWordsAr(integerPart)} ${cur.arMain.singular}`;
  }

  if (decimalPart > 0) {
    let subStr = '';
    if (decimalPart === 1) {
      subStr = cur.arSub.singular;
    } else if (decimalPart === 2) {
      subStr = cur.arSub.dual;
    } else if (decimalPart >= 3 && decimalPart <= 10) {
      subStr = `${numberToWordsAr(decimalPart)} ${cur.arSub.plural}`;
    } else {
      subStr = `${numberToWordsAr(decimalPart)} ${cur.arSub.accusative}`;
    }
    result += ` و${subStr}`;
  }

  return result.trim();
}
