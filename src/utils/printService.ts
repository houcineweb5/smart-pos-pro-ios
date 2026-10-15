/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { amountToWordsAr, amountToWordsFr } from './numberToWords';

export interface PrintOptions {
  html: string;
  title?: string;
  isRTL?: boolean;
  mode?: '80mm' | 'a4';
}

export interface PdfDocumentMeta {
  title: string;
  subtitle?: string;
  docNumber: string;
  date: string;
  storeName: string;
  storePhone?: string;
  storeEmail?: string;
  storeAddress?: string;
  storeRegNumber?: string;
  customerLabel?: string;
  customerName: string;
  customerPhone?: string;
  sellerName?: string;
  currency: string;
  mode?: '80mm' | 'a4';
  isRTL?: boolean;
  lang?: 'ar' | 'fr' | 'en';
  customTableHeaders?: {
    name?: string;
    qty?: string;
    price?: string;
    total?: string;
  };
  isPriceCount?: boolean;
  docNumberLabel?: string;
  partyLabel?: string;
  summaryCards?: {
    label: string;
    value: string;
    subValue?: string;
    color?: string;
  }[];
  items: {
    name: string;
    quantity: number | string;
    unitPrice: number;
    discount?: number;
    total: number;
  }[];
  extraSections?: {
    title: string;
    headers: string[];
    rows: string[][];
  }[];
  subtotal: number;
  discount?: number;
  tax?: number;
  total: number;
  previousBalance?: number;
  amountPaid?: number;
  paymentMethodLabel?: string;
  remainingDebt?: number;
  notes?: string;
  footerText?: string;
  themeColor?: string;
  receiptTheme?: 'classic' | 'navy' | 'emerald' | 'minimal' | 'modern';
  a4Theme?: 'slate' | 'indigo' | 'emerald' | 'burgundy' | 'amber';
  isReport?: boolean;
  showBarcode?: boolean;
  hideQuantityAndUnitPrice?: boolean;
}

const CODE39_MAP: Record<string, string> = {
  '0': 'NNNWWNWNN', '1': 'WNNWNNNNW', '2': 'NNWWNNNNW', '3': 'WNWWNNNNN',
  '4': 'NNNWWNNNW', '5': 'WNNWWNNNN', '6': 'NNWWWNNNN', '7': 'NNNWNNWNW',
  '8': 'WNNWNNWNN', '9': 'NNWWNNWNN', 'A': 'WNNNNWNNW', 'B': 'NNWNNWNNW',
  'C': 'WNWNNWNNN', 'D': 'NNNNWWNNW', 'E': 'WNNNWWNNN', 'F': 'NNWNWWNNN',
  'G': 'NNNNNWWNW', 'H': 'WNNNNWWNN', 'I': 'NNWNNWWNN', 'J': 'NNNNWWWNN',
  'K': 'WNNNNNNWW', 'L': 'NNWNNNNWW', 'M': 'WNWNNNNWN', 'N': 'NNNNWNNWW',
  'O': 'WNNNWNNWN', 'P': 'NNWNWNNWN', 'Q': 'NNNNNNWWW', 'R': 'WNNNNNWWN',
  'S': 'NNWNNNWWN', 'T': 'NNNNWNWWN', 'U': 'WWNNNNNNW', 'V': 'NWWNNNNNW',
  'W': 'WWWNNNNNN', 'X': 'NWNNWNNNW', 'Y': 'WWNNWNNNN', 'Z': 'NWWNWNNNN',
  '-': 'NWNNNNWNW', '.': 'WWNNNNWNN', ' ': 'NWWNNNWNN', '$': 'NWNWNWNNN',
  '/': 'NWNWNNNWN', '+': 'NWNNNWNWN', '%': 'NNNWNWNWN', '*': 'NWNNWNWNN'
};

/**
 * Generates an inline Code-39 SVG Barcode that prints 100% reliably on 80mm thermal printers.
 * Includes standard optical quiet zones and crisp contrast for barcode scanner guns.
 */
export function generateCode39BarcodeSvg(value: string, height = 38): string {
  const cleanInput =
    (value || 'INV')
      .toUpperCase()
      .replace(/[^0-9A-Z\-. $/+%]/g, '') || 'INV001';
  const fullText = `*${cleanInput}*`;

  const narrow = 1.4;
  const wide = 3.2;
  const gap = 1.5;
  const quietZone = 16;

  let x = quietZone;
  let rects = '';

  for (let i = 0; i < fullText.length; i++) {
    const ch = fullText[i];
    const pattern = CODE39_MAP[ch] || CODE39_MAP['-'];
    for (let j = 0; j < 9; j++) {
      const isBar = j % 2 === 0;
      const isWide = pattern[j] === 'W';
      const w = isWide ? wide : narrow;
      if (isBar) {
        rects += `<rect x="${x.toFixed(1)}" y="2" width="${w.toFixed(1)}" height="${height}" fill="#000000" />`;
      }
      x += w;
    }
    x += gap;
  }

  const totalW = Math.ceil(x + quietZone - gap);
  const totalH = height + 18;

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalW} ${totalH}" width="100%" height="${totalH}" style="max-width: 250px; display: block; margin: 0 auto; background: #ffffff;">
      <rect width="${totalW}" height="${totalH}" fill="#ffffff" />
      ${rects}
      <text x="${(totalW / 2).toFixed(1)}" y="${totalH - 3}" text-anchor="middle" font-family="'Tahoma', Arial, monospace" font-size="10.5" font-weight="bold" fill="#000000" letter-spacing="1.5">${fullText}</text>
    </svg>
  `;
}

/**
 * Draws a Code-39 barcode directly onto an HTML5 Canvas context for 80mm PDF exports.
 */
function drawCode39BarcodeOnCanvas(
  ctx: CanvasRenderingContext2D,
  value: string,
  centerX: number,
  topY: number,
  barHeight = 36
): number {
  const cleanInput =
    (value || 'INV')
      .toUpperCase()
      .replace(/[^0-9A-Z\-. $/+%]/g, '') || 'INV001';
  const fullText = `*${cleanInput}*`;

  const narrow = 1.35;
  const wide = 3.1;
  const gap = 1.35;

  let totalW = 0;
  for (let i = 0; i < fullText.length; i++) {
    const pattern = CODE39_MAP[fullText[i]] || CODE39_MAP['0'];
    for (let j = 0; j < 9; j++) {
      totalW += pattern[j] === 'w' ? wide : narrow;
    }
    totalW += gap;
  }

  let curX = centerX - totalW / 2;
  ctx.save();
  ctx.fillStyle = '#000000';
  for (let i = 0; i < fullText.length; i++) {
    const pattern = CODE39_MAP[fullText[i]] || CODE39_MAP['0'];
    for (let j = 0; j < 9; j++) {
      const isBar = j % 2 === 0;
      const w = pattern[j] === 'w' ? wide : narrow;
      if (isBar) {
        ctx.fillRect(curX, topY, w, barHeight);
      }
      curX += w;
    }
    curX += gap;
  }

  ctx.font = `700 10px 'Tahoma', 'Arial', monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(fullText, centerX, topY + barHeight + 3);
  ctx.restore();

  return barHeight + 16;
}

/**
 * Single Unified 80mm Thermal Receipt HTML Builder used across POS and Invoices.
 * Matches the unified receipt photo model while using a crisp, legible font family ('Tajawal', 'Tahoma', 'Arial')
 * and keeping the exact same dimensions and font sizes.
 */
export function buildUnified80mmReceiptHtml(
  inv: {
    invoiceNumber?: string;
    date?: string;
    customerName?: string;
    sellerName?: string;
    docTitle?: string;
    docNumberLabel?: string;
    partyLabel?: string;
    items?: {
      productName?: string;
      quantity?: number | string;
      sellingPrice?: number | string;
      discount?: number | string;
      total?: number | string;
    }[];
    subtotal?: number | string;
    discount?: number | string;
    tax?: number | string;
    total?: number | string;
    amountPaid?: number | string;
    previousBalance?: number | string;
  },
  config: {
    name?: string;
    address?: string;
    phone?: string;
    currency?: string;
    receiptTheme?: 'classic' | 'navy' | 'emerald' | 'minimal' | 'modern';
    printPrimaryColor?: string;
  },
  lang: 'ar' | 'fr' | 'en' = 'ar',
  thankYouText?: string
): string {
  const isRTL = lang === 'ar';
  const safeItems = Array.isArray(inv.items) ? inv.items : [];
  const invSubtotal = Number(inv.subtotal) || 0;
  const invDiscount = Number(inv.discount) || 0;
  const invTax = Number(inv.tax) || 0;
  const invTotal = Number(inv.total) || 0;
  const invPaid = inv.amountPaid !== undefined ? Number(inv.amountPaid) || 0 : invTotal;
  const prevBal = Number(inv.previousBalance) || 0;
  const grandTotal = invTotal + prevBal;
  const remaining = Math.max(0, invTotal - invPaid);
  const dateStr = inv.date
    ? isNaN(new Date(inv.date).getTime())
      ? inv.date
      : new Date(inv.date).toLocaleString('fr-FR')
    : '';
  const totalItemsCount = safeItems.length;
  const currency = config.currency || 'MAD';
  const receiptTheme = config.receiptTheme || 'classic';
  const themeColors: Record<string, { border: string; headerBg: string; headerColor: string; accent: string }> = {
    classic: { border: '#000000', headerBg: '#000000', headerColor: '#ffffff', accent: '#000000' },
    navy: { border: '#1e3a8a', headerBg: '#1e3a8a', headerColor: '#ffffff', accent: '#1d4ed8' },
    emerald: { border: '#065f46', headerBg: '#065f46', headerColor: '#ffffff', accent: '#059669' },
    modern: { border: '#4338ca', headerBg: '#4338ca', headerColor: '#ffffff', accent: '#4f46e5' },
    minimal: { border: '#64748b', headerBg: '#f8fafc', headerColor: '#0f172a', accent: '#334155' }
  };
  const activeReceiptStyle = themeColors[receiptTheme] || themeColors.classic;
  const receiptFont = `'Tajawal', 'Segoe UI', Tahoma, Arial, sans-serif`;
  const productFont = `'Cairo', 'Almarai', 'Arial', sans-serif`;
  const numFont = `'Tahoma', 'Arial', sans-serif`;

  const itemsHtml = safeItems
    .map((item) => {
      const qty = Number(item.quantity) || 0;
      const sellingPrice = Number(item.sellingPrice) || 0;
      const lineTotal = Number(item.total) || sellingPrice * qty;
      const disc = Number(item.discount) || 0;
      return `
      <tr>
        <td style="text-align: ${isRTL ? 'right' : 'left'}; padding: 2.5px 2px; vertical-align: middle; font-size: 11.5px; font-weight: 800; color: #000; font-family: ${productFont};">
          ${item.productName || ''} ${disc > 0 ? `<span style="font-size: 9px; font-weight: 700;">(-${disc}%)</span>` : ''}
        </td>
        <td style="text-align: center; padding: 2.5px 2px; vertical-align: middle; font-size: 11.5px; font-weight: 800; color: #000; font-family: ${productFont}; white-space: nowrap;">
          ${qty}
        </td>
        <td style="text-align: ${isRTL ? 'left' : 'right'}; padding: 2.5px 2px; vertical-align: middle; font-size: 11.5px; font-weight: 800; color: #000; font-family: ${productFont}; white-space: nowrap;">
          ${sellingPrice.toFixed(2)}
        </td>
        <td style="text-align: ${isRTL ? 'left' : 'right'}; padding: 2.5px 2px; vertical-align: middle; font-size: 11.5px; font-weight: 900; color: #000; font-family: ${productFont}; white-space: nowrap;">
          ${lineTotal.toFixed(2)}
        </td>
      </tr>
    `;
    })
    .join('');

  return `
    <div style="font-family: ${receiptFont}; font-size: 11px; font-weight: 700; color: #000000; background: #ffffff; direction: ${isRTL ? 'rtl' : 'ltr'}; line-height: 1.45;">
      <div style="text-align: center; margin-bottom: 8px;">
        <h2 style="margin: 0; font-size: 15px; font-weight: 900; color: ${activeReceiptStyle.accent}; font-family: ${receiptFont};">${config.name || 'Smart POS'}</h2>
        ${config.address ? `<div style="font-size: 10px; font-weight: 700; margin-top: 2px; color: #334155;">${config.address}</div>` : ''}
        ${config.phone ? `<div style="font-size: 10px; font-weight: 700; color: #334155;">${lang === 'ar' ? 'الهاتف:' : 'Tél:'} ${config.phone}</div>` : ''}
        ${inv.docTitle ? `<div style="font-size: 12px; font-weight: 900; margin-top: 5px; color: #000000 !important; background: #ffffff !important; border: 1.5px solid #000000 !important; display: inline-block; padding: 2.5px 12px; border-radius: 4px; text-transform: uppercase; font-family: ${receiptFont};">${inv.docTitle}</div>` : ''}
      </div>

      <div style="border-top: 1.5px solid ${activeReceiptStyle.border}; border-bottom: 1.5px solid ${activeReceiptStyle.border}; padding: 6px 0; margin-bottom: 8px; font-size: 10px; font-weight: 700; color: #000000;">
        <div style="display: flex; justify-content: space-between; align-items: center; gap: 4px;">
          <span>${inv.docNumberLabel || (lang === 'ar' ? 'رقم الفاتورة:' : 'N°:')} <b style="font-family: ${numFont}; color: ${activeReceiptStyle.accent};">${inv.invoiceNumber || ''}</b></span>
          <span style="font-family: ${numFont};" dir="ltr">${dateStr}</span>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; gap: 4px; margin-top: 3px;">
          <span>${inv.partyLabel || (lang === 'ar' ? 'الزبون :' : 'Client :')} <b>${inv.customerName || (lang === 'ar' ? 'زبون عابر' : 'Walk-in')}</b></span>
          <span>${lang === 'ar' ? 'البائع:' : 'Vendeur:'} <b>${inv.sellerName || 'admin'}</b></span>
        </div>
      </div>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 8px; font-size: 11px;">
        <thead>
          <tr style="border-bottom: 2px solid ${activeReceiptStyle.border}; font-size: 10.5px;">
            <th style="text-align: ${isRTL ? 'right' : 'left'}; padding: 4px 2px; font-weight: 800; color: ${activeReceiptStyle.accent}; width: 42%; font-family: ${receiptFont};">${lang === 'ar' ? 'المنتج' : 'Article'}</th>
            <th style="text-align: center; padding: 4px 2px; font-weight: 800; color: ${activeReceiptStyle.accent}; width: 16%; font-family: ${receiptFont};">${lang === 'ar' ? 'العدد' : 'Qté'}</th>
            <th style="text-align: ${isRTL ? 'left' : 'right'}; padding: 4px 2px; font-weight: 800; color: ${activeReceiptStyle.accent}; width: 21%; font-family: ${receiptFont};">${lang === 'ar' ? 'السعر' : 'Prix'}</th>
            <th style="text-align: ${isRTL ? 'left' : 'right'}; padding: 4px 2px; font-weight: 800; color: ${activeReceiptStyle.accent}; width: 21%; font-family: ${receiptFont};">${lang === 'ar' ? 'المجموع' : 'Total'}</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>

      <div style="border-top: 1.5px solid ${activeReceiptStyle.border}; padding-top: 6px; font-size: 11px; font-weight: 700; color: #000000;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
          <span>${lang === 'ar' ? 'المجموع:' : 'Sous-total:'}</span>
          <span style="font-family: ${numFont}; font-weight: 700;" dir="ltr">${invSubtotal.toFixed(2)} ${currency}</span>
        </div>
        ${
          invDiscount > 0
            ? `
        <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
          <span>${lang === 'ar' ? 'الالخصم:' : 'Remise:'}</span>
          <span style="font-family: ${numFont}; font-weight: 700; color: #dc2626;" dir="ltr">-${invDiscount.toFixed(2)} ${currency}</span>
        </div>
        `
            : ''
        }
        ${
          invTax > 0
            ? `
        <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
          <span>${lang === 'ar' ? 'الضريبة:' : 'TVA:'}</span>
          <span style="font-family: ${numFont}; font-weight: 700;" dir="ltr">+${invTax.toFixed(2)} ${currency}</span>
        </div>
        `
            : ''
        }
        ${
          prevBal > 0
            ? `
        <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
          <span>${lang === 'ar' ? 'مجموع الفاتورة الحالي:' : 'Total Facture:'}</span>
          <span style="font-family: ${numFont}; font-weight: 700;" dir="ltr">${invTotal.toFixed(2)} ${currency}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
          <span>${lang === 'ar' ? 'كريدي قديم / مبلغ سابق:' : 'Ancien Crédit:'}</span>
          <span style="font-family: ${numFont}; font-weight: 700; color: #b45309;" dir="ltr">+${prevBal.toFixed(2)} ${currency}</span>
        </div>
        `
            : ''
        }
        <div style="border: 2px solid ${activeReceiptStyle.border}; padding: 5px 8px; border-radius: 6px; margin: 6px 0; display: flex; justify-content: space-between; align-items: center; background: ${receiptTheme === 'classic' ? '#ffffff' : '#f8fafc'}; white-space: nowrap;">
          <span style="font-weight: 800; font-size: 12px; color: ${activeReceiptStyle.accent}; font-family: ${receiptFont};">${
            prevBal > 0
              ? lang === 'ar'
                ? 'المجموع الكلي:'
                : 'TOTAL GÉNÉRAL:'
              : lang === 'ar'
              ? 'المجموع الإجمالي:'
              : 'TOTAL:'
          }</span>
          <span style="font-weight: 900; font-size: 16px; font-family: ${numFont}; color: ${activeReceiptStyle.accent};" dir="ltr">${grandTotal.toFixed(2)} ${currency}</span>
        </div>
        <div style="display: flex; justify-content: center; align-items: center; gap: 6px; text-align: center; margin-bottom: 3px; font-weight: 800;">
          <span>${lang === 'ar' ? 'عدد المنتجات:' : 'Articles:'}</span>
          <span style="font-family: ${numFont}; font-weight: 800;">${totalItemsCount}</span>
        </div>
        ${
          remaining > 0
            ? `
        <div style="display: flex; justify-content: space-between; font-weight: 800; margin-bottom: 2px;">
          <span>${lang === 'ar' ? 'الباقي (كريدي):' : 'Reste (Crédit):'}</span>
          <span style="font-family: ${numFont};" dir="ltr">${remaining.toFixed(2)} ${currency}</span>
        </div>
        `
            : ''
        }
      </div>

      <div style="margin: 8px 0; display: flex; justify-content: center; align-items: center;">
        ${generateCode39BarcodeSvg(inv.invoiceNumber || 'INV', 36)}
      </div>

      <div style="text-align: center; margin-top: 8px; padding-top: 6px; border-top: 1px dashed #000000; font-size: 10.5px; font-weight: 700; color: #000000; font-family: ${receiptFont}; line-height: 1.5;">
        ${thankYouText || (lang === 'ar' ? 'شكراً لتعاملكم معنا ومرحباً بكم في أي وقت!' : 'Thank you for your business!')}
      </div>
    </div>
  `;
}

/**
 * A4 Business Palettes for structured invoices, reports, and prints
 */
export const A4_PRINT_THEMES: Record<
  string,
  {
    nameAr: string;
    nameEn: string;
    primary: string;
    headerBg: string;
    border: string;
    accentBg: string;
    badgeBg: string;
    badgeText: string;
  }
> = {
  slate: {
    nameAr: 'رمادي تنفيذي',
    nameEn: 'Executive Slate',
    primary: '#0f172a',
    headerBg: '#1e293b',
    border: '#cbd5e1',
    accentBg: '#f8fafc',
    badgeBg: '#f1f5f9',
    badgeText: '#0f172a',
  },
  indigo: {
    nameAr: 'أزرق ملكي (نيلي)',
    nameEn: 'Royal Indigo',
    primary: '#4338ca',
    headerBg: '#3730a3',
    border: '#c7d2fe',
    accentBg: '#eef2ff',
    badgeBg: '#e0e7ff',
    badgeText: '#3730a3',
  },
  emerald: {
    nameAr: 'أخضر زمردي',
    nameEn: 'Emerald Green',
    primary: '#065f46',
    headerBg: '#047857',
    border: '#a7f3d0',
    accentBg: '#ecfdf5',
    badgeBg: '#d1fae5',
    badgeText: '#065f46',
  },
  burgundy: {
    nameAr: 'عنابي / خمري',
    nameEn: 'Burgundy Wine',
    primary: '#9f1239',
    headerBg: '#881337',
    border: '#fecdd3',
    accentBg: '#fff1f2',
    badgeBg: '#ffe4e6',
    badgeText: '#9f1239',
  },
  amber: {
    nameAr: 'كهرماني دافئ',
    nameEn: 'Warm Amber',
    primary: '#b45309',
    headerBg: '#92400e',
    border: '#fde68a',
    accentBg: '#fffbeb',
    badgeBg: '#fef3c7',
    badgeText: '#92400e',
  },
};

/**
 * Self-contained A4 HTML generator from PdfDocumentMeta.
 * Guarantees that A4 printing never suffers from dark mode, mobile responsive breakpoints,
 * overflow scroll containers, or missing modal DOM, and never shows internal profit!
 */
export function buildStructuredA4Html(meta: PdfDocumentMeta): string {
  const isRTL = meta.isRTL !== false;
  const isArabic = meta.lang === 'ar' || (meta.lang === undefined && isRTL);
  const titleLower = (meta.title || '').toLowerCase();
  const isDevis = titleLower.includes('devis') || titleLower.includes('عرض');
  const isBonCommande = titleLower.includes('commande') || titleLower.includes('طلب');
  const isBonLivraison = titleLower.includes('livraison') || titleLower.includes('تسليم');

  const clausePrefix = isArabic
    ? (isDevis ? 'أوقف هذا العرض عند مبلغ : ' : isBonCommande ? 'أوقف سند الطلب عند مبلغ : ' : isBonLivraison ? 'أوقف سند التسليم عند مبلغ : ' : 'أوقفت هذه الفاتورة عند مبلغ : ')
    : (isDevis ? 'Arrêté le présent devis à la somme de : ' : isBonCommande ? 'Arrêté le présent bon de commande à la somme de : ' : isBonLivraison ? 'Arrêté le présent bon de livraison à la somme de : ' : 'Arrêtée la présente facture à la somme de : ');

  const alignStart = isRTL ? 'right' : 'left';
  const alignEnd = isRTL ? 'left' : 'right';
  const fontStack = `'Tajawal', 'Cairo', -apple-system, BlinkMacSystemFont, 'Segoe UI', Tahoma, Arial, sans-serif`;
  const prevBal = Number(meta.previousBalance || 0);

  const activeA4 = A4_PRINT_THEMES[meta.a4Theme || 'slate'] || A4_PRINT_THEMES.slate;
  const primaryBrandColor = meta.themeColor ? meta.themeColor : activeA4.primary;
  const headerBgColor = meta.themeColor ? meta.themeColor : activeA4.headerBg;

  const summaryCardsHtml =
    meta.summaryCards && meta.summaryCards.length > 0
      ? `
      <div style="display: grid; grid-template-columns: repeat(${Math.min(3, meta.summaryCards.length)}, 1fr); gap: 10px; margin-bottom: 16px;">
        ${meta.summaryCards
          .map(
            (c) => {
              const [valMain, valSub] = (c.value || '').split('\n');
              const displayMain = c.subValue ? c.value : valMain;
              const displaySub = c.subValue || valSub;
              return `
          <div style="border: 1px solid ${activeA4.border}; border-radius: 8px; padding: 10px 12px; background: #f8fafc;">
            <div style="font-size: 11px; font-weight: 700; color: #64748b;">${c.label}</div>
            <div style="font-size: 16px; font-weight: 900; color: ${c.color || primaryBrandColor}; margin-top: 4px; font-family: Tahoma, Arial, monospace;" dir="ltr">${displayMain}</div>
            ${displaySub ? `<div style="font-size: 11px; font-weight: 700; color: #4338ca; margin-top: 4px;" dir="${isRTL ? 'rtl' : 'ltr'}">${displaySub}</div>` : ''}
          </div>
        `;
            }
          )
          .join('')}
      </div>
    `
      : '';

  // Specialized Financial / Statistical Report Layout (Matching Photo 2 exactly)
  if (meta.isReport) {
    return `
    <div style="font-family: ${fontStack}; color: #0f172a; background: #ffffff; direction: ${isRTL ? 'rtl' : 'ltr'}; padding: 5mm; width: 100%; box-sizing: border-box;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2.5px solid ${primaryBrandColor}; padding-bottom: 12px; margin-bottom: 14px;">
        <div style="text-align: ${alignStart};">
          <h1 style="margin: 0; font-size: 20px; font-weight: 900; color: #0f172a;">${meta.storeName || 'Smart POS'} - ${meta.title}</h1>
          <div style="font-size: 11.5px; color: #475569; font-weight: 700; margin-top: 4px;">
            ${meta.customerLabel || (isRTL ? 'الفترة المحددة:' : 'Period:')} <b>${meta.customerName || ''}</b>  |  ${isRTL ? 'تاريخ الطباعة:' : 'Printed:'} <span dir="ltr">${meta.date || ''}</span>
          </div>
        </div>
        <div style="text-align: ${alignEnd}; font-size: 12px; font-weight: 800; color: #0f172a;">
          ${meta.storePhone ? `<div>${meta.storePhone}</div>` : ''}
          ${meta.storeAddress ? `<div style="font-size: 11px; color: #475569; font-weight: 700; margin-top: 2px;">${meta.storeAddress}</div>` : ''}
        </div>
      </div>

      ${summaryCardsHtml}

      ${meta.extraSections && meta.extraSections.length > 0 ? meta.extraSections.map((sec) => `
        <div style="margin-bottom: 16px;">
          <div style="font-size: 13px; font-weight: 800; margin-bottom: 6px; padding: 6px 10px; background: ${activeA4.accentBg || '#f1f5f9'}; border-${isRTL ? 'right' : 'left'}: 4px solid ${primaryBrandColor}; border-radius: 4px; color: #0f172a;">
            ${sec.title}
          </div>
          <table style="width: 100%; border-collapse: collapse; font-size: 11.5px;">
            <thead>
              <tr style="background: ${headerBgColor}; color: #ffffff;">
                ${sec.headers.map(h => `<th style="padding: 7px 9px; text-align: ${alignStart}; font-weight: 800; border: 1px solid ${headerBgColor};">${h}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${sec.rows.map((row, rIdx) => `
                <tr style="background: ${rIdx % 2 === 1 ? '#f8fafc' : '#ffffff'};">
                  ${row.map(cell => `<td style="padding: 7px 9px; text-align: ${alignStart}; color: #0f172a; font-weight: 700; border: 1px solid #cbd5e1;">${cell ?? ''}</td>`).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `).join('') : ''}
    </div>
    `;
  }

  const hideQtyPrice = Boolean(meta.hideQuantityAndUnitPrice);
  const itemsTableHtml =
    meta.items && meta.items.length > 0
      ? `
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 18px; font-size: 12px;">
        <thead>
          <tr style="background: ${headerBgColor}; color: #ffffff;">
            <th style="padding: 9px 10px; text-align: ${alignStart}; font-weight: 800; width: 8%; border: 1px solid ${activeA4.border};">#</th>
            <th style="padding: 9px 10px; text-align: ${alignStart}; font-weight: 800; width: ${hideQtyPrice ? '67%' : '43%'}; border: 1px solid ${activeA4.border};">${meta.customTableHeaders?.name || (isRTL ? 'البيان / المنتج' : 'Désignation')}</th>
            ${!hideQtyPrice ? `<th style="padding: 9px 10px; text-align: center; font-weight: 800; width: 14%; border: 1px solid ${activeA4.border};">${meta.customTableHeaders?.qty || (isRTL ? 'الكمية' : 'Qté')}</th>` : ''}
            ${!hideQtyPrice ? `<th style="padding: 9px 10px; text-align: center; font-weight: 800; width: 18%; border: 1px solid ${activeA4.border};">${meta.customTableHeaders?.price || (isRTL ? 'سعر الوحدة' : 'Prix Unitaire')}</th>` : ''}
            <th style="padding: 9px 10px; text-align: ${alignEnd}; font-weight: 800; width: ${hideQtyPrice ? '25%' : '18%'}; border: 1px solid ${activeA4.border};">${meta.customTableHeaders?.total || (isRTL ? 'الإجمالي' : 'Total')}</th>
          </tr>
        </thead>
        <tbody>
          ${meta.items
            .map((it, idx) => {
              const label = it.discount && it.discount > 0 ? `${it.name} (-${it.discount}%)` : it.name;
              const bg = idx % 2 === 1 ? '#f8fafc' : '#ffffff';
              const priceCellText = meta.isPriceCount
                ? String(Math.round(Number(it.unitPrice || 0)))
                : `${Number(it.unitPrice || 0).toFixed(2)} ${meta.currency}`;
              return `
              <tr style="background: ${bg}; border-bottom: 1px solid #cbd5e1;">
                <td style="padding: 8px 10px; text-align: ${alignStart}; color: #475569; font-weight: 700; border: 1px solid #e2e8f0; font-family: Tahoma, Arial, sans-serif;">${idx + 1}</td>
                <td style="padding: 8px 10px; text-align: ${alignStart}; color: #0f172a; font-weight: 800; border: 1px solid #e2e8f0;">${label || ''}</td>
                ${!hideQtyPrice ? `<td style="padding: 8px 10px; text-align: center; color: #0f172a; font-weight: 800; border: 1px solid #e2e8f0; font-family: Tahoma, Arial, sans-serif;">${it.quantity}</td>` : ''}
                ${!hideQtyPrice ? `<td style="padding: 8px 10px; text-align: center; color: #1e293b; font-weight: 700; border: 1px solid #e2e8f0; font-family: Tahoma, Arial, sans-serif;" dir="ltr">${priceCellText}</td>` : ''}
                <td style="padding: 8px 10px; text-align: ${alignEnd}; color: #0f172a; font-weight: 800; border: 1px solid #e2e8f0; font-family: Tahoma, Arial, sans-serif;" dir="ltr">${Number(it.total || 0).toFixed(2)} ${meta.currency}</td>
              </tr>
            `;
            })
            .join('')}
        </tbody>
      </table>
    `
      : '';

  const extraSectionsHtml =
    meta.extraSections && meta.extraSections.length > 0
      ? meta.extraSections
          .map(
            (sec) => `
          <div style="margin-bottom: 16px;">
            <div style="font-size: 13px; font-weight: 800; margin-bottom: 6px; padding: 6px 10px; background: ${activeA4.accentBg || '#f1f5f9'}; border-${isRTL ? 'right' : 'left'}: 4px solid ${primaryBrandColor}; border-radius: 4px; color: #0f172a;">
              ${sec.title}
            </div>
            <table style="width: 100%; border-collapse: collapse; font-size: 11.5px;">
              <thead>
                <tr style="background: ${headerBgColor}; color: #ffffff;">
                  ${sec.headers
                    .map(
                      (h) =>
                        `<th style="padding: 7px 9px; text-align: ${alignStart}; font-weight: 800; border: 1px solid ${headerBgColor};">${h}</th>`
                    )
                    .join('')}
                </tr>
              </thead>
              <tbody>
                ${sec.rows
                  .map(
                    (row, rIdx) => `
                  <tr style="background: ${rIdx % 2 === 1 ? '#f8fafc' : '#ffffff'};">
                    ${row
                      .map(
                        (cell) =>
                          `<td style="padding: 7px 9px; text-align: ${alignStart}; color: #0f172a; font-weight: 700; border: 1px solid #cbd5e1;">${cell ?? ''}</td>`
                      )
                      .join('')}
                  </tr>
                `
                  )
                  .join('')}
              </tbody>
            </table>
          </div>
        `
          )
          .join('')
      : '';

  return `
    <div style="font-family: ${fontStack}; color: #0f172a; background: #ffffff; direction: ${isRTL ? 'rtl' : 'ltr'}; padding: 4mm; width: 100%; box-sizing: border-box;">
      <!-- Top Header -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2.5px solid ${primaryBrandColor}; padding-bottom: 14px; margin-bottom: 16px;">
        <div style="text-align: ${alignStart};">
          <h1 style="margin: 0; font-size: 22px; font-weight: 900; color: #0f172a;">${meta.storeName || 'Smart POS'}</h1>
          ${meta.storeAddress ? `<div style="font-size: 12px; color: #334155; font-weight: 700; margin-top: 4px;">${meta.storeAddress}</div>` : ''}
          <div style="font-size: 11.5px; color: #475569; font-weight: 700; margin-top: 3px;">
            ${[
              meta.storePhone ? `${isRTL ? 'الهاتف:' : 'Tél:'} ${meta.storePhone}` : '',
              meta.storeEmail ? meta.storeEmail : '',
              meta.storeRegNumber ? `ICE/RC: ${meta.storeRegNumber}` : '',
            ]
              .filter(Boolean)
              .join('  |  ')}
          </div>
        </div>
        <div style="text-align: ${alignEnd};">
          <div style="font-size: 18px; font-weight: 900; color: ${primaryBrandColor};">${meta.title || ''}</div>
          <div style="font-size: 16px; font-weight: 900; color: #0f172a; font-family: Tahoma, Arial, sans-serif; margin-top: 3px;">${meta.docNumber || ''}</div>
          <div style="font-size: 12px; font-weight: 700; color: #475569; margin-top: 3px;">${isRTL ? 'التاريخ:' : 'Date:'} <span style="font-family: Tahoma, Arial, sans-serif;" dir="ltr">${meta.date || ''}</span></div>
        </div>
      </div>

      <!-- Customer / Supplier Info Box -->
      <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 10px; padding: 12px 16px; margin-bottom: 18px; display: flex; justify-content: space-between; align-items: center;">
        <div style="text-align: ${alignStart};">
          <div style="font-size: 11px; font-weight: 800; color: #64748b;">${meta.customerLabel || (isRTL ? 'بيانات العميل / الزبون:' : 'Client:')}</div>
          <div style="font-size: 15px; font-weight: 900; color: #0f172a; margin-top: 2px;">${meta.customerName || ''}</div>
        </div>
        <div style="text-align: ${alignEnd}; font-size: 12px; font-weight: 700; color: #334155;">
          ${meta.customerPhone ? `<div>${isRTL ? 'الهاتف:' : 'Tél:'} <span style="font-family: Tahoma, Arial, sans-serif;" dir="ltr">${meta.customerPhone}</span></div>` : ''}
          ${meta.sellerName ? `<div style="margin-top: 2px;">${isRTL ? 'البائع:' : 'Vendeur:'} <b>${meta.sellerName}</b></div>` : ''}
        </div>
      </div>

      ${summaryCardsHtml}
      ${itemsTableHtml}
      ${extraSectionsHtml}

      <!-- Financial Totals & Notes -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; margin-top: 10px; page-break-inside: avoid;">
        <div style="flex: 1; text-align: ${alignStart};">
          ${
            meta.notes
              ? `
            <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px 12px; font-size: 11.5px; color: #334155; font-weight: 700; line-height: 1.5;">
              <div style="font-weight: 900; color: #0f172a; margin-bottom: 3px;">${isRTL ? 'ملاحظات:' : 'Notes:'}</div>
              <div>${meta.notes}</div>
            </div>
          `
              : ''
          }
        </div>

        <div style="width: 290px; border: 2px solid ${activeA4.border}; border-radius: 10px; padding: 12px 14px; background: #ffffff; font-size: 12.5px;">
          ${
            !meta.summaryCards && meta.items && meta.items.length > 0
              ? `
            <div style="display: flex; justify-content: space-between; margin-bottom: 6px; font-weight: 700; color: #334155;">
              <span>${isRTL ? 'عدد المنتجات:' : 'Articles:'}</span>
              <span style="font-family: Tahoma, Arial, sans-serif; font-weight: 800;" dir="ltr">${meta.items.length}</span>
            </div>
          `
              : ''
          }
          <div style="display: flex; justify-content: space-between; margin-bottom: 6px; font-weight: 700; color: #334155;">
            <span>${isRTL ? 'المجموع:' : 'Sous-total:'}</span>
            <span style="font-family: Tahoma, Arial, sans-serif; font-weight: 800;" dir="ltr">${Number(meta.subtotal || 0).toFixed(2)} ${meta.currency}</span>
          </div>
          ${
            meta.discount && meta.discount > 0
              ? `
            <div style="display: flex; justify-content: space-between; margin-bottom: 6px; font-weight: 700; color: #e11d48;">
              <span>${isRTL ? 'الخصم:' : 'Remise:'}</span>
              <span style="font-family: Tahoma, Arial, sans-serif; font-weight: 800;" dir="ltr">-${Number(meta.discount).toFixed(2)} ${meta.currency}</span>
            </div>
          `
              : ''
          }
          ${
            meta.tax && meta.tax > 0
              ? `
            <div style="display: flex; justify-content: space-between; margin-bottom: 6px; font-weight: 700; color: #334155;">
              <span>${isRTL ? 'الضريبة:' : 'TVA:'}</span>
              <span style="font-family: Tahoma, Arial, sans-serif; font-weight: 800;" dir="ltr">+${Number(meta.tax).toFixed(2)} ${meta.currency}</span>
            </div>
          `
              : ''
          }
          <div style="border-top: 2px solid ${primaryBrandColor}; padding-top: 8px; margin-top: 6px; display: flex; justify-content: space-between; align-items: center; font-size: 15px; font-weight: 900; color: #0f172a;">
            <span>${prevBal > 0 ? (isRTL ? 'مجموع الفاتورة:' : 'Total Facture:') : isRTL ? 'المجموع الإجمالي:' : 'TOTAL:'}</span>
            <span style="font-family: Tahoma, Arial, sans-serif; color: ${primaryBrandColor}; font-size: 16px;" dir="ltr">${Number(meta.total || 0).toFixed(2)} ${meta.currency}</span>
          </div>
          ${
            prevBal > 0
              ? `
            <div style="display: flex; justify-content: space-between; margin-top: 6px; font-weight: 800; color: #b45309; font-size: 12px;">
              <span>${isRTL ? 'كريدي قديم / سابق:' : 'Ancien Crédit:'}</span>
              <span style="font-family: Tahoma, Arial, sans-serif;" dir="ltr">+${prevBal.toFixed(2)} ${meta.currency}</span>
            </div>
            <div style="border-top: 1px solid #cbd5e1; padding-top: 6px; margin-top: 6px; display: flex; justify-content: space-between; font-size: 14px; font-weight: 900; color: #0f172a;">
              <span>${isRTL ? 'المجموع الكلي:' : 'Total Général:'}</span>
              <span style="font-family: Tahoma, Arial, sans-serif;" dir="ltr">${(Number(meta.total || 0) + prevBal).toFixed(2)} ${meta.currency}</span>
            </div>
          `
              : ''
          }
          ${
            meta.amountPaid !== undefined
              ? `
            <div style="display: flex; justify-content: space-between; margin-top: 6px; padding-top: 6px; border-top: 1px dashed #cbd5e1; font-weight: 800; color: #047857; font-size: 12px;">
              <span>${isRTL ? 'المبلغ المدفوع:' : 'Montant Payé:'}</span>
              <span style="font-family: Tahoma, Arial, sans-serif;" dir="ltr">${Number(meta.amountPaid).toFixed(2)} ${meta.currency}</span>
            </div>
          `
              : ''
          }
          ${
            meta.remainingDebt && meta.remainingDebt > 0
              ? `
            <div style="display: flex; justify-content: space-between; margin-top: 4px; font-weight: 900; color: #e11d48; font-size: 12.5px;">
              <span>${isRTL ? 'الباقي (كريدي):' : 'Reste (Crédit):'}</span>
              <span style="font-family: Tahoma, Arial, sans-serif;" dir="ltr">${Number(meta.remainingDebt).toFixed(2)} ${meta.currency}</span>
            </div>
          `
              : ''
          }
        </div>
      </div>

      <!-- Arrêtée la présente facture clause (Centered) with full written words -->
      <div style="margin-top: 14px; padding: 10px 14px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; text-align: center; font-size: 11.5px; font-weight: 800; color: #0f172a; page-break-inside: avoid; line-height: 1.6;">
        <span>${clausePrefix}</span>
        <span style="color: #1e3a8a; font-weight: 900;">${isArabic ? amountToWordsAr(Number(meta.total || 0) + prevBal, meta.currency) : amountToWordsFr(Number(meta.total || 0) + prevBal, meta.currency)}</span>
      </div>

      <!-- Thank You Message -->
      <div style="margin-top: 20px; padding-top: 10px; border-top: 1px solid #cbd5e1; text-align: center; font-size: 11.5px; font-weight: 800; color: #475569;">
        ${meta.footerText || (isRTL ? 'شكراً لتعاملكم معنا ومرحباً بكم في أي وقت!' : 'Thank you for your business!')}
      </div>

      <!-- Footer: Company Info (Address, Phone, Email, ICE) -->
      <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11px; font-weight: 600; color: #475569; page-break-inside: avoid;">
        <div style="font-weight: 800; color: #0f172a; margin-bottom: 2px;">${meta.storeName || 'Smart POS'}</div>
        <div style="display: flex; flex-wrap: wrap; justify-content: center; gap: 4px 14px; color: #475569;">
          ${meta.storeAddress ? `<span>${meta.storeAddress}</span>` : ''}
          ${meta.storePhone ? `<span>${isRTL ? 'الهاتف:' : 'Tél:'} <b style="font-family: Tahoma, Arial, sans-serif; color: #0f172a;" dir="ltr">${meta.storePhone}</b></span>` : ''}
          ${meta.storeEmail ? `<span>${isRTL ? 'البريد:' : 'Email:'} <b style="font-family: Tahoma, Arial, sans-serif; color: #0f172a;">${meta.storeEmail}</b></span>` : ''}
          ${meta.storeRegNumber ? `<span>ICE: <b style="font-family: Tahoma, Arial, sans-serif; color: #0f172a;">${meta.storeRegNumber}</b></span>` : ''}
        </div>
      </div>
    </div>
  `;
}

/**
 * Converts one or more base64 JPEG data URLs into a valid PDF 1.4 binary Uint8Array.
 * For A4 mode, every page is strictly standard A4 (595.28 x 841.89 pt = 210mm x 297mm).
 */
function createPdfFromJpegPages(
  pages: { jpegDataUrl: string; widthPx: number; heightPx: number }[],
  mode: '80mm' | 'a4' = 'a4'
): Uint8Array {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let currentOffset = 0;

  const pushText = (str: string) => {
    const bytes = encoder.encode(str);
    chunks.push(bytes);
    currentOffset += bytes.length;
  };

  const pushBytes = (bytes: Uint8Array) => {
    chunks.push(bytes);
    currentOffset += bytes.length;
  };

  const startObj = (id: number) => {
    offsets[id] = currentOffset;
    pushText(`${id} 0 obj\n`);
  };

  const endObj = () => {
    pushText(`\nendobj\n`);
  };

  pushText(`%PDF-1.4\n%\xFF\xFF\xFF\xFF\n`);

  startObj(1);
  pushText(`<< /Type /Catalog /Pages 2 0 R >>`);
  endObj();

  const pageCount = Math.max(1, pages.length);
  const pageObjIds: number[] = [];
  for (let i = 0; i < pageCount; i++) {
    pageObjIds.push(3 + i * 3);
  }

  startObj(2);
  pushText(`<< /Type /Pages /Kids [${pageObjIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageCount} >>`);
  endObj();

  for (let i = 0; i < pageCount; i++) {
    const pg = pages[i];
    const pageObjId = 3 + i * 3;
    const imgObjId = pageObjId + 1;
    const contentObjId = pageObjId + 2;

    const base64 = pg.jpegDataUrl.split(',')[1] || '';
    const binaryStr = atob(base64);
    const jpegBytes = new Uint8Array(binaryStr.length);
    for (let k = 0; k < binaryStr.length; k++) {
      jpegBytes[k] = binaryStr.charCodeAt(k);
    }

    const aspect = pg.heightPx / Math.max(1, pg.widthPx);
    const pageWidthPt = mode === '80mm' ? 226.77 : 595.28;
    const pageHeightPt =
      mode === '80mm'
        ? Math.max(300, Number((pageWidthPt * aspect).toFixed(2)))
        : 841.89;

    const drawWidthPt = pageWidthPt;
    const drawHeightPt = mode === '80mm' ? pageHeightPt : 841.89;

    startObj(pageObjId);
    pushText(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidthPt.toFixed(2)} ${pageHeightPt.toFixed(2)}] /Resources << /XObject << /Im${i} ${imgObjId} 0 R >> >> /Contents ${contentObjId} 0 R >>`
    );
    endObj();

    startObj(imgObjId);
    pushText(
      `<< /Type /XObject /Subtype /Image /Width ${pg.widthPx} /Height ${pg.heightPx} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`
    );
    pushBytes(jpegBytes);
    pushText(`\nendstream`);
    endObj();

    const contentStream = `q\n${drawWidthPt.toFixed(2)} 0 0 ${drawHeightPt.toFixed(2)} 0 0 cm\n/Im${i} Do\nQ\n`;
    const contentBytes = encoder.encode(contentStream);
    startObj(contentObjId);
    pushText(`<< /Length ${contentBytes.length} >>\nstream\n`);
    pushBytes(contentBytes);
    pushText(`endstream`);
    endObj();
  }

  const totalObjects = 2 + pageCount * 3;
  const xrefOffset = currentOffset;
  pushText(`xref\n0 ${totalObjects + 1}\n0000000000 65535 f \n`);
  for (let i = 1; i <= totalObjects; i++) {
    const padded = String(offsets[i] || 0).padStart(10, '0');
    pushText(`${padded} 00000 n \n`);
  }

  pushText(`trailer\n<< /Size ${totalObjects + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);

  const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
  const result = new Uint8Array(totalLength);
  let pos = 0;
  for (const chunk of chunks) {
    result.set(chunk, pos);
    pos += chunk.length;
  }
  return result;
}

/**
 * Draws the structured document onto a target 2D context and returns the total logical height used.
 * Safe for multi-page A4 slicing without ever exceeding iOS WebKit's canvas memory limit!
 */
function paintDocumentContentOnContext(
  ctx: CanvasRenderingContext2D,
  meta: PdfDocumentMeta,
  logicalWidth: number,
  pad: number
): number {
  const is80mm = meta.mode === '80mm';
  const isRTL = meta.isRTL !== false;
  const isArabic = meta.lang === 'ar' || (meta.lang === undefined && isRTL);
  const titleLower = (meta.title || '').toLowerCase();
  const isDevis = titleLower.includes('devis') || titleLower.includes('عرض');
  const isBonCommande = titleLower.includes('commande') || titleLower.includes('طلب');
  const isBonLivraison = titleLower.includes('livraison') || titleLower.includes('تسليم');

  const clausePrefix = isArabic
    ? (isDevis ? 'أوقف هذا العرض عند مبلغ : ' : isBonCommande ? 'أوقف سند الطلب عند مبلغ : ' : isBonLivraison ? 'أوقف سند التسليم عند مبلغ : ' : 'أوقفت هذه الفاتورة عند مبلغ : ')
    : (isDevis ? 'Arrêté le présent devis à la somme de : ' : isBonCommande ? 'Arrêté le présent bon de commande à la somme de : ' : isBonLivraison ? 'Arrêté le présent bon de livraison à la somme de : ' : 'Arrêtée la présente facture à la somme de : ');

  const contentWidth = logicalWidth - pad * 2;
  ctx.direction = isRTL ? 'rtl' : 'ltr';

  // Use crisp 'Tajawal', 'Segoe UI', Tahoma, Arial for 80mm receipt & A4
  const fontStack = `'Tajawal', 'Segoe UI', Tahoma, Arial, sans-serif`;
  const productFontStack = `'Cairo', 'Almarai', 'Arial', sans-serif`;
  const numFontStack = `'Tahoma', 'Arial', sans-serif`;

  let y = pad;

  const drawText = (
    text: string,
    x: number,
    yPos: number,
    options: {
      size?: number;
      weight?: string;
      color?: string;
      align?: CanvasTextAlign;
      maxWidth?: number;
      isNumeric?: boolean;
      fontFamily?: string;
    } = {}
  ) => {
    ctx.save();
    const activeFont = options.fontFamily || (options.isNumeric ? numFontStack : fontStack);
    ctx.font = `${options.weight || '700'} ${options.size || 13}px ${activeFont}`;
    ctx.fillStyle = options.color || '#0f172a';
    ctx.textAlign = options.align || (isRTL ? 'right' : 'left');
    ctx.textBaseline = 'top';
    if (options.maxWidth) {
      ctx.fillText(String(text ?? ''), x, yPos, options.maxWidth);
    } else {
      ctx.fillText(String(text ?? ''), x, yPos);
    }
    ctx.restore();
  };

  const drawLine = (yPos: number, thick = false, color = '#000000', dashed = false) => {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = thick ? 1.8 : 1;
    if (dashed) {
      ctx.setLineDash([4, 3]);
    }
    ctx.beginPath();
    ctx.moveTo(pad, yPos);
    ctx.lineTo(logicalWidth - pad, yPos);
    ctx.stroke();
    ctx.restore();
  };

  const startX = isRTL ? logicalWidth - pad : pad;
  const endX = isRTL ? pad : logicalWidth - pad;
  const startAlign: CanvasTextAlign = isRTL ? 'right' : 'left';
  const endAlign: CanvasTextAlign = isRTL ? 'left' : 'right';

  if (is80mm) {
    // --- UNIFIED 80MM THERMAL RECEIPT LAYOUT (Matches attached photo model) ---
    drawText(meta.storeName || 'Smart POS', logicalWidth / 2, y, {
      size: 18,
      weight: '800',
      color: '#000000',
      align: 'center',
    });
    y += 24;

    if (meta.storeAddress) {
      drawText(meta.storeAddress, logicalWidth / 2, y, {
        size: 11,
        weight: '700',
        color: '#000000',
        align: 'center',
        maxWidth: contentWidth,
      });
      y += 16;
    }

    if (meta.storePhone) {
      drawText(`${isRTL ? 'الهاتف:' : 'Tél:'} ${meta.storePhone}`, logicalWidth / 2, y, {
        size: 11,
        weight: '700',
        color: '#000000',
        align: 'center',
        maxWidth: contentWidth,
      });
      y += 16;
    }

    y += 4;
    drawLine(y, false, '#000000');
    y += 7;

    // 2-Row Bordered Meta Box (Row 1: Invoice # + Date, Row 2: Customer + Seller)
    drawText(
      `${meta.docNumberLabel || (isRTL ? 'رقم الفاتورة:' : 'N°:')} ${meta.docNumber || ''}`,
      startX,
      y,
      { size: 11, weight: '800', color: '#000000', align: startAlign }
    );
    drawText(meta.date || '', endX, y, {
      size: 10.5,
      weight: '700',
      color: '#000000',
      align: endAlign,
      isNumeric: true,
    });
    y += 18;

    drawText(
      `${meta.partyLabel || (isRTL ? 'الزبون :' : 'Client :')} ${meta.customerName || (isRTL ? 'زبون عابر' : 'Walk-in')}`,
      startX,
      y,
      { size: 11, weight: '800', color: '#000000', align: startAlign }
    );
    drawText(
      `${isRTL ? 'البائع:' : 'Vendeur:'} ${meta.sellerName || 'admin'}`,
      endX,
      y,
      { size: 11, weight: '800', color: '#000000', align: endAlign }
    );
    y += 18;

    drawLine(y, false, '#000000');
    y += 8;

    // 4-Column Table Header: المنتج | العدد | السعر | المجموع
    const colItemX = startX;
    const colQtyX = isRTL ? logicalWidth - pad - contentWidth * 0.48 : pad + contentWidth * 0.48;
    const colPriceX = isRTL ? logicalWidth - pad - contentWidth * 0.72 : pad + contentWidth * 0.72;
    const colTotalX = endX;

    drawText(isRTL ? 'المنتج' : 'Article', colItemX, y, {
      size: 11.5,
      weight: '800',
      color: '#000000',
      align: startAlign,
    });
    drawText(isRTL ? 'العدد' : 'Qté', colQtyX, y, {
      size: 11.5,
      weight: '800',
      color: '#000000',
      align: 'center',
    });
    drawText(isRTL ? 'السعر' : 'Prix', colPriceX, y, {
      size: 11.5,
      weight: '800',
      color: '#000000',
      align: 'center',
    });
    drawText(isRTL ? 'المجموع' : 'Total', colTotalX, y, {
      size: 11.5,
      weight: '800',
      color: '#000000',
      align: endAlign,
    });
    y += 19;
    drawLine(y, true, '#000000');
    y += 7;

    const totalItemsCount = meta.items.length;
    for (const item of meta.items) {
      const itemLabel =
        item.discount && item.discount > 0 ? `${item.name} (-${item.discount}%)` : item.name;
      drawText(itemLabel, colItemX, y, {
        size: 11.5,
        weight: '800',
        color: '#000000',
        align: startAlign,
        maxWidth: contentWidth * 0.42,
        fontFamily: productFontStack,
      });
      drawText(String(item.quantity), colQtyX, y, {
        size: 11.5,
        weight: '800',
        color: '#000000',
        align: 'center',
        fontFamily: productFontStack,
      });
      drawText(Number(item.unitPrice || 0).toFixed(2), colPriceX, y, {
        size: 11.5,
        weight: '800',
        color: '#000000',
        align: 'center',
        fontFamily: productFontStack,
      });
      drawText(Number(item.total || 0).toFixed(2), colTotalX, y, {
        size: 11.5,
        weight: '900',
        color: '#000000',
        align: endAlign,
        fontFamily: productFontStack,
      });
      y += 22;
    }

    y += 4;
    drawLine(y, false, '#000000');
    y += 8;

    const drawMetaRow = (label: string, val: string) => {
      drawText(label, startX, y, { size: 11.5, weight: '700', color: '#000000', align: startAlign });
      drawText(val, endX, y, {
        size: 11.5,
        weight: '800',
        color: '#000000',
        align: endAlign,
        isNumeric: true,
      });
      y += 19;
    };

    drawMetaRow(
      isRTL ? 'المجموع:' : 'Sous-total:',
      `${Number(meta.subtotal || 0).toFixed(2)} ${meta.currency}`
    );
    if (meta.discount && meta.discount > 0) {
      drawMetaRow(
        isRTL ? 'الخصم:' : 'Remise:',
        `-${Number(meta.discount).toFixed(2)} ${meta.currency}`
      );
    }
    if (meta.tax && meta.tax > 0) {
      drawMetaRow(
        isRTL ? 'الضريبة:' : 'TVA:',
        `+${Number(meta.tax).toFixed(2)} ${meta.currency}`
      );
    }

    const prevBal = Number(meta.previousBalance || 0);
    if (prevBal > 0) {
      drawMetaRow(
        isRTL ? 'مجموع الفاتورة الحالي:' : 'Total Facture:',
        `${Number(meta.total || 0).toFixed(2)} ${meta.currency}`
      );
      drawMetaRow(
        isRTL ? 'كريدي قديم / مبلغ سابق:' : 'Ancien Crédit:',
        `+${prevBal.toFixed(2)} ${meta.currency}`
      );
    }

    const displayedGrandTotal = Number(meta.total || 0) + (prevBal > 0 ? prevBal : 0);

    // Prominent 2px Bordered Grand Total Box
    y += 3;
    ctx.save();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeRect(pad, y, contentWidth, 32);
    ctx.restore();

    drawText(
      prevBal > 0
        ? isRTL
          ? 'المجموع الكلي:'
          : 'TOTAL GÉNÉRAL:'
        : isRTL
        ? 'المجموع الإجمالي:'
        : 'TOTAL:',
      isRTL ? startX - 8 : startX + 8,
      y + 8,
      {
        size: 12.5,
        weight: '800',
        color: '#000000',
        align: startAlign,
      }
    );
    drawText(
      `${displayedGrandTotal.toFixed(2)} ${meta.currency}`,
      isRTL ? endX + 8 : endX - 8,
      y + 7,
      {
        size: 15,
        weight: '800',
        color: '#000000',
        align: endAlign,
        isNumeric: true,
      }
    );
    y += 39;

    // Items Count Row (Centered in the middle of the line)
    drawText(
      `${isRTL ? 'عدد المنتجات:' : 'Articles:'} ${totalItemsCount}`,
      logicalWidth / 2,
      y,
      { size: 11.5, weight: '800', color: '#000000', align: 'center' }
    );
    y += 19;

    if (meta.remainingDebt && meta.remainingDebt > 0) {
      drawMetaRow(
        isRTL ? 'المتبقي:' : 'Reste:',
        `${Number(meta.remainingDebt).toFixed(2)} ${meta.currency}`
      );
    }

    // Barcode
    y += 6;
    y += drawCode39BarcodeOnCanvas(ctx, meta.docNumber || 'INV', logicalWidth / 2, y, 36);

    y += 6;
    drawLine(y, false, '#000000', true);
    y += 10;
    drawText(
      meta.footerText || (isRTL ? 'شكراً لتعاملكم معنا ومرحباً بكم في أي وقت!' : 'Thank you for your business!'),
      logicalWidth / 2,
      y,
      { size: 11, weight: '800', color: '#000000', align: 'center', maxWidth: contentWidth }
    );
    y += 22;
  } else {
    // --- A4 OFFICIAL DOCUMENT LAYOUT ---
    const activeA4 = A4_PRINT_THEMES[meta.a4Theme || 'slate'] || A4_PRINT_THEMES.slate;
    const primaryColor = meta.themeColor || activeA4.primary;
    const headerBgColor = meta.themeColor || activeA4.headerBg;

    if (meta.isReport) {
      // Clean Report Header matching Photo 2
      drawText(`${meta.storeName || 'Smart POS'} - ${meta.title}`, startX, y, {
        size: 19,
        weight: '900',
        color: '#0f172a',
        align: startAlign,
      });
      if (meta.storePhone) {
        drawText(meta.storePhone, endX, y, {
          size: 13,
          weight: '900',
          color: '#0f172a',
          align: endAlign,
        });
      }
      y += 25;

      const reportSubtitle = `${meta.customerLabel || (isRTL ? 'الفترة المحددة:' : 'Period:')} ${meta.customerName || ''} | ${isRTL ? 'تاريخ الطباعة:' : 'Printed:'} ${meta.date}`;
      drawText(reportSubtitle, startX, y, {
        size: 11,
        weight: '700',
        color: '#475569',
        align: startAlign,
        maxWidth: contentWidth * 0.7,
      });
      if (meta.storeAddress) {
        drawText(meta.storeAddress, endX, y, {
          size: 10.5,
          weight: '700',
          color: '#64748b',
          align: endAlign,
          maxWidth: contentWidth * 0.3,
        });
      }
      y += 24;

      drawLine(y, true, primaryColor);
      y += 16;
    } else {
      // Standard Invoice / Document Header
      drawText(meta.storeName || 'Smart POS', startX, y, {
        size: 24,
        weight: '900',
        color: '#0f172a',
        align: startAlign,
      });
      drawText(meta.title, endX, y, {
        size: 19,
        weight: '900',
        color: primaryColor,
        align: endAlign,
      });
      y += 32;

      if (meta.storeAddress || meta.storePhone || meta.storeEmail) {
        const storeDetails = [meta.storeAddress, meta.storePhone, meta.storeEmail]
          .filter(Boolean)
          .join('  |  ');
        drawText(storeDetails, startX, y, {
          size: 12,
          weight: '700',
          color: '#475569',
          align: startAlign,
          maxWidth: contentWidth * 0.6,
        });
      }
      drawText(meta.docNumber, endX, y, {
        size: 17,
        weight: '900',
        color: '#0f172a',
        align: endAlign,
        isNumeric: true,
      });
      y += 24;

      if (meta.storeRegNumber) {
        drawText(`ICE / RC: ${meta.storeRegNumber}`, startX, y, {
          size: 11,
          weight: '700',
          color: '#64748b',
          align: startAlign,
        });
      }
      drawText(`${isRTL ? 'التاريخ:' : 'Date:'} ${meta.date}`, endX, y, {
        size: 12,
        weight: '700',
        color: '#475569',
        align: endAlign,
      });
      y += 26;

      drawLine(y, true, primaryColor);
      y += 16;

      // Customer Card
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(pad, y, contentWidth, 62);
      ctx.strokeStyle = activeA4.border;
      ctx.lineWidth = 1;
      ctx.strokeRect(pad, y, contentWidth, 62);

      const cardStartX = isRTL ? startX - 16 : startX + 16;
      const cardEndX = isRTL ? endX + 16 : endX - 16;
      drawText(
        meta.customerLabel || (isRTL ? 'بيانات العميل / المورد:' : 'Client / Supplier:'),
        cardStartX,
        y + 11,
        { size: 11, weight: '800', color: '#64748b', align: startAlign }
      );
      drawText(meta.customerName, cardStartX, y + 31, {
        size: 15,
        weight: '900',
        color: '#0f172a',
        align: startAlign,
      });
      if (meta.customerPhone) {
        drawText(`${isRTL ? 'الهاتف:' : 'Tel:'} ${meta.customerPhone}`, cardEndX, y + 31, {
          size: 13,
          weight: '700',
          color: '#334155',
          align: endAlign,
        });
      }
      y += 80;
    }

    // Optional Summary KPI Cards
    if (meta.summaryCards && meta.summaryCards.length > 0) {
      const cols = Math.min(3, meta.summaryCards.length);
      const gap = 12;
      const cardW = (contentWidth - gap * (cols - 1)) / cols;
      const cardH = 74;

      meta.summaryCards.forEach((card, idx) => {
        const rowIdx = Math.floor(idx / cols);
        const colIdx = idx % cols;
        const cardX = isRTL
          ? logicalWidth - pad - (colIdx + 1) * cardW - colIdx * gap
          : pad + colIdx * (cardW + gap);
        const cardY = y + rowIdx * (cardH + gap);

        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(cardX, cardY, cardW, cardH);
        ctx.strokeStyle = activeA4.border;
        ctx.lineWidth = 1;
        ctx.strokeRect(cardX, cardY, cardW, cardH);

        const textX = isRTL ? cardX + cardW - 12 : cardX + 12;
        drawText(card.label, textX, cardY + 9, {
          size: 11,
          weight: '800',
          color: '#64748b',
          align: startAlign,
          maxWidth: cardW - 24,
        });

        const [valMain, valSub] = (card.value || '').split('\n');
        const displayMain = card.subValue ? card.value : valMain;
        const displaySub = card.subValue || valSub;

        drawText(displayMain, textX, cardY + 28, {
          size: 15,
          weight: '900',
          color: card.color || primaryColor,
          align: startAlign,
          maxWidth: cardW - 24,
          isNumeric: true,
        });

        if (displaySub) {
          drawText(displaySub, textX, cardY + 49, {
            size: 11,
            weight: '800',
            color: '#4338ca',
            align: startAlign,
            maxWidth: cardW - 24,
          });
        }
      });

      const totalRows = Math.ceil(meta.summaryCards.length / cols);
      y += totalRows * (cardH + gap) + 12;
    }

    // Items Table (for standard invoices)
    if (meta.items && meta.items.length > 0) {
      ctx.fillStyle = headerBgColor;
      ctx.fillRect(pad, y, contentWidth, 34);

      const hideQtyPrice = Boolean(meta.hideQuantityAndUnitPrice);
      const cIdx = isRTL ? startX - 14 : startX + 14;
      const cName = isRTL ? startX - 50 : startX + 50;
      const cQty = isRTL ? logicalWidth - pad - contentWidth * 0.54 : pad + contentWidth * 0.54;
      const cPrice = isRTL ? logicalWidth - pad - contentWidth * 0.72 : pad + contentWidth * 0.72;
      const cTotal = isRTL ? endX + 14 : endX - 14;

      drawText('#', cIdx, y + 9, { size: 12, weight: '900', color: '#ffffff', align: startAlign });
      drawText(
        meta.customTableHeaders?.name || (isRTL ? 'البيان / المنتج' : 'Description'),
        cName,
        y + 9,
        { size: 12, weight: '900', color: '#ffffff', align: startAlign }
      );
      if (!hideQtyPrice) {
        drawText(meta.customTableHeaders?.qty || (isRTL ? 'الكمية' : 'Qty'), cQty, y + 9, {
          size: 12,
          weight: '900',
          color: '#ffffff',
          align: 'center',
        });
        drawText(
          meta.customTableHeaders?.price || (isRTL ? 'سعر الوحدة' : 'Unit Price'),
          cPrice,
          y + 9,
          { size: 12, weight: '900', color: '#ffffff', align: 'center' }
        );
      }
      drawText(meta.customTableHeaders?.total || (isRTL ? 'الإجمالي' : 'Total'), cTotal, y + 9, {
        size: 12,
        weight: '900',
        color: '#ffffff',
        align: endAlign,
      });
      y += 34;

      meta.items.forEach((item, index) => {
        if (index % 2 === 1) {
          ctx.fillStyle = '#f8fafc';
          ctx.fillRect(pad, y, contentWidth, 32);
        }
        const label =
          item.discount && item.discount > 0 ? `${item.name} (-${item.discount}%)` : item.name;
        drawText(String(index + 1), cIdx, y + 8, {
          size: 12,
          weight: '700',
          color: '#64748b',
          align: startAlign,
          isNumeric: true,
        });
        drawText(label, cName, y + 8, {
          size: 12.5,
          weight: '800',
          color: '#0f172a',
          align: startAlign,
          maxWidth: hideQtyPrice ? contentWidth * 0.68 : contentWidth * 0.42,
        });
        if (!hideQtyPrice) {
          drawText(String(item.quantity), cQty, y + 8, {
            size: 12.5,
            weight: '800',
            color: '#1e293b',
            align: 'center',
            isNumeric: true,
          });
          const priceCanvasText = meta.isPriceCount
            ? String(Math.round(Number(item.unitPrice || 0)))
            : `${Number(item.unitPrice || 0).toFixed(2)} ${meta.currency}`;
          drawText(priceCanvasText, cPrice, y + 8, {
            size: 12,
            weight: '700',
            color: '#334155',
            align: 'center',
            isNumeric: true,
          });
        }
        drawText(`${Number(item.total || 0).toFixed(2)} ${meta.currency}`, cTotal, y + 8, {
          size: 12.5,
          weight: '900',
          color: '#0f172a',
          align: endAlign,
          isNumeric: true,
        });
        y += 32;
        drawLine(y, false, '#e2e8f0');
      });

      y += 18;
    }

    // Optional Extra Sections (Used by Reports & Structured Documents)
    if (meta.extraSections && meta.extraSections.length > 0) {
      meta.extraSections.forEach((sec) => {
        // Section Header bar with title
        ctx.fillStyle = activeA4.accentBg || '#f1f5f9';
        ctx.fillRect(pad, y, contentWidth, 28);
        ctx.fillStyle = primaryColor;
        if (isRTL) {
          ctx.fillRect(logicalWidth - pad - 4, y, 4, 28);
        } else {
          ctx.fillRect(pad, y, 4, 28);
        }

        const secTitleX = isRTL ? startX - 14 : startX + 14;
        drawText(sec.title, secTitleX, y + 6, {
          size: 12.5,
          weight: '900',
          color: '#0f172a',
          align: startAlign,
        });
        y += 34;

        const colCount = Math.max(1, sec.headers.length);
        const colW = contentWidth / colCount;

        ctx.fillStyle = headerBgColor;
        ctx.fillRect(pad, y, contentWidth, 30);

        sec.headers.forEach((h, hIdx) => {
          const hx = isRTL
            ? logicalWidth - pad - hIdx * colW - 10
            : pad + hIdx * colW + 10;
          drawText(h, hx, y + 7, {
            size: 11,
            weight: '800',
            color: '#ffffff',
            align: startAlign,
            maxWidth: colW - 16,
          });
        });
        y += 30;

        sec.rows.forEach((row, rIdx) => {
          if (rIdx % 2 === 1) {
            ctx.fillStyle = '#f8fafc';
            ctx.fillRect(pad, y, contentWidth, 28);
          }
          row.forEach((cell, cIdxCell) => {
            const cx = isRTL
              ? logicalWidth - pad - cIdxCell * colW - 10
              : pad + cIdxCell * colW + 10;
            const cellStr = String(cell ?? '');
            const isProfitCell = cellStr.startsWith('+');
            const cellColor = isProfitCell ? '#047857' : '#0f172a';
            drawText(cellStr, cx, y + 6, {
              size: 11,
              weight: cIdxCell === row.length - 1 ? '800' : '700',
              color: cellColor,
              align: startAlign,
              maxWidth: colW - 16,
            });
          });
          y += 28;
          drawLine(y, false, '#e2e8f0');
        });
        y += 14;
      });
    }

    // Only paint payment totals, notes, and thank you footer for regular invoices (NOT financial reports)
    if (!meta.isReport) {
      const sumRow = (label: string, val: string, bold = false, color = '#1e293b') => {
        drawText(label, startX, y, {
          size: bold ? 15 : 13,
          weight: bold ? '900' : '700',
          color,
          align: startAlign,
        });
        drawText(val, endX, y, {
          size: bold ? 17 : 14,
          weight: '800',
          color,
          align: endAlign,
          isNumeric: true,
        });
        y += bold ? 28 : 23;
      };

      if (!meta.summaryCards && meta.items && meta.items.length > 0) {
        sumRow(isRTL ? 'عدد المنتجات:' : 'Articles:', String(meta.items.length));
      }
      sumRow(
        isRTL ? 'المجموع:' : 'Subtotal:',
        `${Number(meta.subtotal || 0).toFixed(2)} ${meta.currency}`
      );
      if (meta.discount && meta.discount > 0) {
        sumRow(
          isRTL ? 'الخصم:' : 'Discount:',
          `-${Number(meta.discount).toFixed(2)} ${meta.currency}`,
          false,
          '#e11d48'
        );
      }
      if (meta.tax && meta.tax > 0) {
        sumRow(
          isRTL ? 'الضريبة:' : 'Tax:',
          `+${Number(meta.tax).toFixed(2)} ${meta.currency}`,
          false,
          '#475569'
        );
      }

      const prevBalA4 = Number(meta.previousBalance || 0);
      drawLine(y, true, primaryColor);
      y += 10;
      sumRow(
        isRTL ? 'المجموع الإجمالي الصافي:' : 'Grand Total:',
        `${Number(meta.total || 0).toFixed(2)} ${meta.currency}`,
        prevBalA4 <= 0,
        primaryColor
      );

      if (prevBalA4 > 0) {
        sumRow(
          isRTL ? 'كريدي قديم / مبلغ سابق مضاف:' : 'Previous Balance Added:',
          `+${prevBalA4.toFixed(2)} ${meta.currency}`,
          false,
          '#d97706'
        );
        sumRow(
          isRTL ? 'المجموع النهائي (مع الكريدي القديم):' : 'Total Including Previous Balance:',
          `${(Number(meta.total || 0) + prevBalA4).toFixed(2)} ${meta.currency}`,
          true,
          primaryColor
        );
      }

      if (meta.amountPaid !== undefined) {
        sumRow(
          isRTL ? 'المبلغ المؤدى:' : 'Amount Paid:',
          `${Number(meta.amountPaid).toFixed(2)} ${meta.currency}`,
          false,
          '#059669'
        );
      }
      if (meta.remainingDebt && meta.remainingDebt > 0) {
        sumRow(
          isRTL ? 'الباقي (كريدي):' : 'Reste (Crédit):',
          `${Number(meta.remainingDebt).toFixed(2)} ${meta.currency}`,
          false,
          '#e11d48'
        );
      }

      if (meta.notes) {
        y += 10;
        drawText(`${isRTL ? 'ملاحظات:' : 'Notes:'} ${meta.notes}`, startX, y, {
          size: 12,
          weight: '700',
          color: '#475569',
          align: startAlign,
          maxWidth: contentWidth,
        });
        y += 26;
      }

      // Arrêtée la présente facture clause (Centered) with full written words
      y += 10;
      const totalAmountWithPrev = Number(meta.total || 0) + prevBalA4;
      const boxHeight = 32;
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(pad, y, contentWidth, boxHeight);
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1;
      ctx.strokeRect(pad, y, contentWidth, boxHeight);

      const words = isArabic
        ? amountToWordsAr(totalAmountWithPrev, meta.currency)
        : amountToWordsFr(totalAmountWithPrev, meta.currency);
      const clauseLine = `${clausePrefix}${words}`;

      drawText(clauseLine, logicalWidth / 2, y + 9, {
        size: isArabic ? 11 : 10,
        weight: '800',
        color: '#0f172a',
        align: 'center',
        maxWidth: contentWidth - 16,
      });
      y += boxHeight + 10;

      // Thank you message
      drawLine(y, false, '#cbd5e1');
      y += 10;
      drawText(
        meta.footerText || (isRTL ? 'شكراً لتعاملكم معنا ومرحباً بكم في أي وقت!' : 'Thank you for your business!'),
        logicalWidth / 2,
        y,
        { size: 11.5, weight: '800', color: '#475569', align: 'center' }
      );
      y += 24;

      // Footer: Company Info (Address, Phone, Email, ICE)
      drawLine(y, false, '#e2e8f0');
      y += 8;
      drawText(meta.storeName || 'Smart POS', logicalWidth / 2, y, {
        size: 12,
        weight: '900',
        color: '#0f172a',
        align: 'center',
      });
      y += 18;
      const storeFooterParts = [
        meta.storeAddress,
        meta.storePhone ? `${isRTL ? 'الهاتف:' : 'Tél:'} ${meta.storePhone}` : '',
        meta.storeEmail ? `${isRTL ? 'البريد:' : 'Email:'} ${meta.storeEmail}` : '',
        meta.storeRegNumber ? `ICE: ${meta.storeRegNumber}` : '',
      ].filter(Boolean).join('   |   ');
      if (storeFooterParts) {
        drawText(storeFooterParts, logicalWidth / 2, y, {
          size: 10.5,
          weight: '700',
          color: '#475569',
          align: 'center',
          maxWidth: contentWidth,
        });
        y += 20;
      }
    }
  }

  return y + pad;
}

/**
 * Renders structured document metadata into one or more JPEG pages without exceeding iOS WebKit canvas memory limits.
 */
function renderDocumentToJpegPages(
  meta: PdfDocumentMeta
): { jpegDataUrl: string; widthPx: number; heightPx: number }[] {
  const is80mm = meta.mode === '80mm';
  const scale = 2; // High-DPI (2x) while staying 100% safe within iOS WebKit 16MP canvas limit
  const logicalWidth = is80mm ? 380 : 794;
  const pad = is80mm ? 16 : 26;

  // Pass 1: Measure exact logical height on a tiny 1x1 scratch canvas
  const measureCanvas = document.createElement('canvas');
  measureCanvas.width = 1;
  measureCanvas.height = 1;
  const measureCtx = measureCanvas.getContext('2d')!;
  const usedLogicalHeight = Math.max(
    is80mm ? 360 : 1123,
    Math.ceil(paintDocumentContentOnContext(measureCtx, meta, logicalWidth, pad))
  );

  if (is80mm) {
    const safeHeight = Math.min(4000, usedLogicalHeight);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(logicalWidth * scale);
    canvas.height = Math.round(safeHeight * scale);
    const ctx = canvas.getContext('2d')!;
    ctx.scale(scale, scale);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, logicalWidth, safeHeight);
    paintDocumentContentOnContext(ctx, meta, logicalWidth, pad);
    return [
      {
        jpegDataUrl: canvas.toDataURL('image/jpeg', 0.94),
        widthPx: canvas.width,
        heightPx: canvas.height,
      },
    ];
  }

  // Pass 2 for A4: Render page-by-page onto individual 794x1123 canvases
  const a4LogicalHeight = 1123;
  const totalPages = Math.max(1, Math.ceil((usedLogicalHeight - 20) / a4LogicalHeight));
  const pages: { jpegDataUrl: string; widthPx: number; heightPx: number }[] = [];

  for (let p = 0; p < totalPages; p++) {
    const pageCanvas = document.createElement('canvas');
    pageCanvas.width = Math.round(logicalWidth * scale);
    pageCanvas.height = Math.round(a4LogicalHeight * scale);
    const pCtx = pageCanvas.getContext('2d')!;
    pCtx.scale(scale, scale);
    pCtx.fillStyle = '#ffffff';
    pCtx.fillRect(0, 0, logicalWidth, a4LogicalHeight);

    pCtx.save();
    pCtx.translate(0, -p * a4LogicalHeight);
    paintDocumentContentOnContext(pCtx, meta, logicalWidth, pad);
    pCtx.restore();

    pages.push({
      jpegDataUrl: pageCanvas.toDataURL('image/jpeg', 0.94),
      widthPx: pageCanvas.width,
      heightPx: pageCanvas.height,
    });
  }

  return pages;
}

/**
 * Efficiently converts a Uint8Array into a Base64 string in chunks
 * without hitting JavaScript call-stack size limits.
 */
export function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  const chunkSize = 8192;
  for (let i = 0; i < len; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, len));
    binary += String.fromCharCode.apply(null, chunk as any);
  }
  return btoa(binary);
}

/**
 * Generates a real PDF file from structured invoice/receipt metadata and triggers:
 * - On Mobile / Android: Native Android Print & Share Sheet via AndroidNative bridge
 * - On Mobile / iPhone (iOS): Native Share Sheet (Save to Files / AirPrint / WhatsApp)
 * - On Desktop (Windows / Mac): Instant direct file download (never blocked by Windows Share popup!)
 */
export async function exportStructuredPdf(
  meta: PdfDocumentMeta,
  filename?: string
): Promise<boolean> {
  try {
    const mode = meta.mode || 'a4';
    const pages = renderDocumentToJpegPages(meta);
    const pdfBytes = createPdfFromJpegPages(pages, mode);

    const safeName =
      (filename || `${meta.docNumber || 'Document'}.pdf`).replace(/[^a-zA-Z0-9._-]/g, '_') ||
      'Document.pdf';
    const finalFilename = safeName.endsWith('.pdf') ? safeName : `${safeName}.pdf`;

    // 1. Android Native Bridge Support (Instant native share sheet / save to device)
    if (typeof window !== 'undefined' && (window as any).AndroidNative?.shareOrSavePdf) {
      try {
        const base64 = uint8ArrayToBase64(pdfBytes);
        (window as any).AndroidNative.shareOrSavePdf(
          base64,
          finalFilename,
          meta.title || meta.docNumber || 'SmartPOS Document'
        );
        return true;
      } catch (nativeErr) {
        console.error('AndroidNative shareOrSavePdf error:', nativeErr);
      }
    }

    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const file = new File([blob], finalFilename, { type: 'application/pdf' });

    const isMobileDevice =
      typeof navigator !== 'undefined' &&
      (/iPad|iPhone|iPod|Android/i.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

    // Only use navigator.share on actual mobile devices (iPhone / iPad / Android)
    if (
      isMobileDevice &&
      typeof navigator.share === 'function' &&
      (typeof navigator.canShare !== 'function' || navigator.canShare({ files: [file] }))
    ) {
      try {
        await navigator.share({
          files: [file],
          title: meta.docNumber || meta.title,
          text: `${meta.title} - ${meta.docNumber}`,
        });
        return true;
      } catch (shareErr: any) {
        if (shareErr?.name === 'AbortError') {
          return true;
        }
      }
    }

    // Direct Blob download (Default on Desktop Windows/Mac and fallback on Android)
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = finalFilename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      try {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch {}
    }, 3000);
    return true;
  } catch (err) {
    console.error('Failed to export PDF:', err);
    return false;
  }
}

/**
 * Strips full-document <html>/<head>/<body> wrappers and removes any .no-print elements
 * so internal info (like invoice profit) never appears on paper.
 */
function normalizePrintFragment(rawHtml: string): string {
  if (!rawHtml) return '';
  let cleaned = String(rawHtml).trim();
  if (/<html[\s>]/i.test(cleaned) || /<body[\s>]/i.test(cleaned)) {
    const styles: string[] = [];
    const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
    let match: RegExpExecArray | null;
    while ((match = styleRegex.exec(cleaned)) !== null) {
      const safeCss = match[1].replace(/body\s*>\s*\*:not\([^)]+\)\s*\{[^}]*\}/gi, '');
      styles.push(`<style>${safeCss}</style>`);
    }
    const bodyMatch = cleaned.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    const bodyContent = bodyMatch ? bodyMatch[1] : cleaned;
    cleaned = `${styles.join('\n')}\n<div class="smartpos-print-report-wrapper">${bodyContent}</div>`;
  }

  // Remove any .no-print elements from the print fragment via DOM detach
  if (typeof document !== 'undefined') {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = cleaned;
    tempDiv.querySelectorAll('.no-print, [data-no-print="true"]').forEach((el) => el.remove());
    return tempDiv.innerHTML;
  }
  return cleaned;
}

/**
 * Unified, iOS-safe & Desktop-safe In-Page Print Function.
 * - For A4 invoices/documents with fallbackPdfMeta (and no custom <style> block), uses buildStructuredA4Html
 *   so A4 printing is 100% immune to dark mode, responsive mobile breakpoints, or missing modal DOM!
 * - Keeps #smartpos-print-mount populated during the entire print dialog lifecycle (never wipes after 2.5s!).
 * - On native iOS Capacitor WebView where window.print() is not wired to AirPrint, immediately opens the
 *   iOS Share/Print sheet with the generated PDF without losing user gesture activation.
 */
export function printHtmlContent(
  optionsOrHtml: PrintOptions | string,
  fallbackPdfMetaOrMode?: PdfDocumentMeta | 'a4' | 'A4' | '80mm'
): void {
  const normalizedOptions: PrintOptions =
    typeof optionsOrHtml === 'string'
      ? {
          html: optionsOrHtml,
          isRTL: document.documentElement.dir !== 'ltr',
          mode:
            typeof fallbackPdfMetaOrMode === 'string' &&
            fallbackPdfMetaOrMode.toLowerCase() === '80mm'
              ? '80mm'
              : 'a4',
        }
      : optionsOrHtml;

  const fallbackPdfMeta: PdfDocumentMeta | undefined =
    fallbackPdfMetaOrMode && typeof fallbackPdfMetaOrMode === 'object'
      ? fallbackPdfMetaOrMode
      : undefined;

  const { html, isRTL = true, mode = 'a4' } = normalizedOptions;

  // Use clean self-contained A4 HTML when printing structured A4 invoices/documents/purchases
  const hasCustomStyles = /<style[\s>]/i.test(html || '');
  const finalHtml =
    mode === 'a4' && fallbackPdfMeta && !hasCustomStyles
      ? buildStructuredA4Html(fallbackPdfMeta)
      : normalizePrintFragment(html);

  // Inject dynamic @page size rule
  let pageStyleEl = document.getElementById('smartpos-dynamic-page-style') as HTMLStyleElement | null;
  if (!pageStyleEl) {
    pageStyleEl = document.createElement('style');
    pageStyleEl.id = 'smartpos-dynamic-page-style';
    document.head.appendChild(pageStyleEl);
  }
  pageStyleEl.textContent =
    mode === '80mm'
      ? `@media print { @page { size: 80mm auto; margin: 0mm; } }`
      : `@media print { @page { size: A4 portrait; margin: 6mm; } }`;

  let mount = document.getElementById('smartpos-print-mount');
  if (!mount) {
    mount = document.createElement('div');
    mount.id = 'smartpos-print-mount';
    document.body.appendChild(mount);
  }

  document.body.classList.remove('smartpos-print-80mm', 'smartpos-print-a4');
  document.body.classList.add(mode === '80mm' ? 'smartpos-print-80mm' : 'smartpos-print-a4');
  document.body.classList.add('smartpos-printing-now');

  mount.setAttribute('dir', isRTL ? 'rtl' : 'ltr');
  mount.innerHTML = `
    <div class="smartpos-print-sheet ${mode === '80mm' ? 'sheet-80mm' : 'sheet-a4'}" dir="${isRTL ? 'rtl' : 'ltr'}">
      ${finalHtml}
    </div>
  `;

  // Force synchronous layout reflow so WebKit / Safari / Chrome computes styles & SVGs before snapshot
  void mount.offsetHeight;

  const isIOS =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/i.test(navigator.userAgent);
  const isCapacitorNative =
    typeof (window as any).Capacitor !== 'undefined' &&
    Boolean((window as any).Capacitor?.isNativePlatform?.() ?? (window as any).Capacitor?.isNative);

  // 1. In Android Native app with AndroidNative bridge:
  if (typeof window !== 'undefined' && (window as any).AndroidNative) {
    const docTitle =
      fallbackPdfMeta?.docNumber ||
      fallbackPdfMeta?.title ||
      normalizedOptions.title ||
      'SmartPOS Document';

    if (fallbackPdfMeta && (window as any).AndroidNative.printPdf) {
      try {
        const targetMode = fallbackPdfMeta.mode || mode;
        const pages = renderDocumentToJpegPages({ ...fallbackPdfMeta, mode: targetMode });
        const pdfBytes = createPdfFromJpegPages(pages, targetMode);
        const base64 = uint8ArrayToBase64(pdfBytes);
        (window as any).AndroidNative.printPdf(base64, docTitle);
        return;
      } catch (err) {
        console.warn('AndroidNative.printPdf failed, fallback to printCurrentPage:', err);
      }
    }

    if ((window as any).AndroidNative.printCurrentPage) {
      setTimeout(() => {
        try {
          (window as any).AndroidNative.printCurrentPage(docTitle);
        } catch (e) {
          console.warn('AndroidNative.printCurrentPage error:', e);
        }
      }, 100);
      return;
    }
  }

  // 2. In Capacitor iOS native app, window.print() is not hooked to AirPrint by default;
  // immediately invoke exportStructuredPdf synchronously within the user's tap gesture!
  if (isIOS && isCapacitorNative && fallbackPdfMeta) {
    exportStructuredPdf(fallbackPdfMeta);
    return;
  }

  // 3. Fallback on Android Capacitor if bridge is not available:
  if (isAndroid && isCapacitorNative && fallbackPdfMeta) {
    exportStructuredPdf(fallbackPdfMeta);
    return;
  }

  try {
    window.print();
  } catch (e) {
    console.warn('window.print() threw an error:', e);
    if (fallbackPdfMeta) {
      exportStructuredPdf(fallbackPdfMeta);
    }
  }
}

/**
 * Exports / Shares JSON database backup reliably on iPhone (iOS Share Sheet -> Save to Files)
 * as well as Android and Desktop browsers.
 */
export async function exportDatabaseBackupFile(
  jsonString: string,
  filename = `SmartPos-Backup-${new Date().toISOString().slice(0, 10)}.json`
): Promise<'shared' | 'downloaded' | 'error'> {
  try {
    const safeFilename = filename.endsWith('.json') ? filename : `${filename}.json`;
    const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
    const file = new File([blob], safeFilename, { type: 'application/json' });

    // 1. Android Native Bridge Support
    if (typeof window !== 'undefined' && (window as any).AndroidNative?.shareOrSaveFile) {
      try {
        const encoder = new TextEncoder();
        const bytes = encoder.encode(jsonString);
        const base64 = uint8ArrayToBase64(bytes);
        (window as any).AndroidNative.shareOrSaveFile(
          base64,
          safeFilename,
          'application/json',
          'Smart POS Database Backup'
        );
        return 'shared';
      } catch (nativeErr) {
        console.error('AndroidNative shareOrSaveFile backup error:', nativeErr);
      }
    }

    const isMobileDevice =
      typeof navigator !== 'undefined' &&
      (/iPad|iPhone|iPod|Android/i.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

    if (
      isMobileDevice &&
      typeof navigator.share === 'function' &&
      (typeof navigator.canShare !== 'function' || navigator.canShare({ files: [file] }))
    ) {
      try {
        await navigator.share({
          files: [file],
          title: 'Smart POS Database Backup',
          text: safeFilename,
        });
        return 'shared';
      } catch (err: any) {
        if (err?.name === 'AbortError') {
          return 'shared';
        }
      }
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = safeFilename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      try {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch {}
    }, 2000);
    return 'downloaded';
  } catch (err) {
    console.error('Backup export error:', err);
    return 'error';
  }
}

/**
 * Exports / Shares CSV file reliably on iPhone (iOS Share Sheet -> Save to Files / Excel / WhatsApp)
 * as well as Android and Desktop browsers.
 */
export async function exportCsvFile(
  csvContent: string,
  filename = `inventory_export_${new Date().toISOString().slice(0, 10)}.csv`
): Promise<'shared' | 'downloaded' | 'error'> {
  try {
    const safeFilename = filename.endsWith('.csv') ? filename : `${filename}.csv`;
    const bom = '\uFEFF';
    const fullText = csvContent.startsWith(bom) ? csvContent : bom + csvContent;
    const blob = new Blob([fullText], { type: 'text/csv;charset=utf-8;' });
    const file = new File([blob], safeFilename, { type: 'text/csv' });

    // 1. Android Native Bridge Support
    if (typeof window !== 'undefined' && (window as any).AndroidNative?.shareOrSaveFile) {
      try {
        const encoder = new TextEncoder();
        const bytes = encoder.encode(fullText);
        const base64 = uint8ArrayToBase64(bytes);
        (window as any).AndroidNative.shareOrSaveFile(
          base64,
          safeFilename,
          'text/csv',
          safeFilename
        );
        return 'shared';
      } catch (nativeErr) {
        console.error('AndroidNative shareOrSaveFile csv error:', nativeErr);
      }
    }

    const isMobileDevice =
      typeof navigator !== 'undefined' &&
      (/iPad|iPhone|iPod|Android/i.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

    if (
      isMobileDevice &&
      typeof navigator.share === 'function' &&
      (typeof navigator.canShare !== 'function' || navigator.canShare({ files: [file] }))
    ) {
      try {
        await navigator.share({
          files: [file],
          title: safeFilename,
          text: safeFilename,
        });
        return 'shared';
      } catch (err: any) {
        if (err?.name === 'AbortError') {
          return 'shared';
        }
      }
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = safeFilename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      try {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch {}
    }, 2000);
    return 'downloaded';
  } catch (err) {
    console.error('CSV export error:', err);
    return 'error';
  }
}
