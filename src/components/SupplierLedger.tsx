/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Supplier, Purchase, Language, StoreConfig } from '../types';
import { 
  ArrowLeft, Calendar, FileText, Printer, Search, TrendingUp, DollarSign, 
  CreditCard, ChevronDown, ChevronUp, Clock, CheckCircle, AlertCircle, FileDown,
  Share2, MessageCircle, Building2, Phone, Mail, PlusCircle, X
} from 'lucide-react';
import { printHtmlContent, exportStructuredPdf, PdfDocumentMeta } from '../utils/printService';
import { triggerHaptic } from '../utils/haptics';
import { shareContent } from '../utils/nativeShare';
import { parseDecimal, sanitizeDecimalInput } from '../utils/numberInput';

interface SupplierLedgerProps {
  supplier: Supplier;
  purchases: Purchase[];
  onSettleDebt: (supplierId: string, amount: number, notes?: string) => void;
  onClose: () => void;
  lang: Language;
  config: StoreConfig;
}

type FilterType = 'all' | 'bills' | 'payments';

interface LedgerItem {
  id: string;
  date: string;
  type: 'bill' | 'payment';
  reference: string;
  title: string;
  subtitle?: string;
  total: number;
  amountPaid: number;
  debtChange: number;
  itemsCount?: number;
  itemsList?: string;
  status?: string;
  rawBill?: Purchase;
}

export default function SupplierLedger({
  supplier,
  purchases,
  onSettleDebt,
  onClose,
  lang,
  config
}: SupplierLedgerProps) {
  const isRTL = lang === 'ar';
  const currency = config.currency || 'MAD';

  const [filter, setFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [expandedBillIds, setExpandedBillIds] = useState<Record<string, boolean>>({});

  // Quick Settle modal state
  const [isSettling, setIsSettling] = useState(false);
  const [settleAmount, setSettleAmount] = useState('');
  const [settleNotes, setSettleNotes] = useState('');

  // 1. Get supplier purchases
  const supplierPurchases = purchases.filter((p) => p.supplierId === supplier.id);

  // 2. Build flattened timeline of bills and payments
  const rawItems: LedgerItem[] = [];

  supplierPurchases.forEach((p) => {
    const itemsSummary = (p.items || []).map(i => `${i.productName} (×${i.quantity})`).join(', ');
    rawItems.push({
      id: `bill_${p.id}`,
      date: p.date,
      type: 'bill',
      reference: p.purchaseNumber || p.id.slice(-6).toUpperCase(),
      title: isRTL ? 'فاتورة مشتريات / توريد' : 'Bon / Facture d\'Achat',
      subtitle: itemsSummary,
      total: p.total,
      amountPaid: p.amountPaid,
      debtChange: Math.max(0, p.total - p.amountPaid),
      itemsCount: p.items?.length || 0,
      itemsList: itemsSummary,
      status: p.status,
      rawBill: p
    });

    if (p.payments && p.payments.length > 0) {
      p.payments.forEach((pay) => {
        rawItems.push({
          id: `pay_${pay.id}`,
          date: pay.date,
          type: 'payment',
          reference: p.purchaseNumber || pay.id.slice(-6).toUpperCase(),
          title: isRTL ? 'دفعة مسددة للمورد' : 'Règlement / Paiement Fournisseur',
          subtitle: pay.notes || (isRTL ? `تسوية من فاتورة ${p.purchaseNumber}` : `Règlement facture ${p.purchaseNumber}`),
          total: 0,
          amountPaid: pay.amount,
          debtChange: -pay.amount,
        });
      });
    }
  });

  // Sort items descending by date
  rawItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Date filtering logic
  const hasDateFilter = Boolean(selectedMonth || fromDate || toDate);
  const matchesDateFilter = (dateStr?: string) => {
    if (!hasDateFilter) return true;
    if (!dateStr) return false;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return false;

    if (selectedMonth) {
      const yearMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (yearMonth !== selectedMonth) return false;
    }
    if (fromDate) {
      const start = new Date(`${fromDate}T00:00:00`).getTime();
      if (d.getTime() < start) return false;
    }
    if (toDate) {
      const end = new Date(`${toDate}T23:59:59.999`).getTime();
      if (d.getTime() > end) return false;
    }
    return true;
  };

  // Filter items
  const filteredItems = rawItems.filter((it) => {
    if (!matchesDateFilter(it.date)) return false;
    if (filter === 'bills' && it.type !== 'bill') return false;
    if (filter === 'payments' && it.type !== 'payment') return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchRef = it.reference.toLowerCase().includes(q);
      const matchTitle = it.title.toLowerCase().includes(q);
      const matchSub = (it.subtitle || '').toLowerCase().includes(q);
      if (!matchRef && !matchTitle && !matchSub) return false;
    }
    return true;
  });

  // Financial aggregates
  const totalPurchasesAmount = supplierPurchases.reduce((sum, p) => sum + (Number(p.total) || 0), 0);
  const totalPaidAmount = supplierPurchases.reduce((sum, p) => sum + (Number(p.amountPaid) || 0), 0);
  const currentDebt = Number(supplier.debt) || 0;

  // Build Structured PDF Meta for Supplier Statement
  const buildLedgerPdfMeta = (): PdfDocumentMeta => {
    const periodLabel = selectedMonth 
      ? `شهر: ${selectedMonth}` 
      : fromDate && toDate 
        ? `${fromDate} إلى ${toDate}` 
        : isRTL ? 'كافة العمليات والنشاط' : 'All transactions';

    return {
      title: isRTL ? 'كشف حساب ونشاط المورّد' : 'Relevé de Compte Fournisseur',
      subtitle: `${isRTL ? 'الفترة:' : 'Période:'} ${periodLabel}`,
      docNumber: `STMT-${supplier.name.replace(/\s+/g, '_')}-${new Date().toISOString().slice(0, 10)}`,
      date: `${new Date().toLocaleDateString('fr-FR')} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      storeName: config.name || 'Smart POS',
      storePhone: config.phone,
      storeAddress: config.address,
      customerLabel: isRTL ? 'بيانات المورّد:' : 'Fournisseur:',
      customerName: supplier.name,
      customerPhone: supplier.phone,
      customerAddress: supplier.company ? `${supplier.company}${supplier.email ? ` • ${supplier.email}` : ''}` : supplier.email,
      currency,
      mode: 'a4',
      isRTL,
      lang,
      summaryCards: [
        {
          label: isRTL ? 'إجمالي المشتريات' : 'Total Achats',
          value: `${totalPurchasesAmount.toFixed(2)} ${currency}`,
          subValue: `${supplierPurchases.length} ${isRTL ? 'فاتورة مسجلة' : 'factures'}`,
          color: '#1e3a8a'
        },
        {
          label: isRTL ? 'إجمالي المدفوع للمورد' : 'Total Payé',
          value: `${totalPaidAmount.toFixed(2)} ${currency}`,
          subValue: isRTL ? 'مجموع الدفعات المسددة' : 'Règlements cumulés',
          color: '#065f46'
        },
        {
          label: isRTL ? 'الرصيد المتبقي بذمتنا' : 'Solde Dû (Dette)',
          value: `${currentDebt.toFixed(2)} ${currency}`,
          subValue: currentDebt > 0 ? (isRTL ? 'دين مستحق للمورد' : 'Solde à payer') : (isRTL ? 'الحساب خالص' : 'Compte soldé'),
          color: currentDebt > 0 ? '#b91c1c' : '#047857'
        }
      ],
      customTableHeaders: {
        name: isRTL ? 'البيان / الفاتورة' : 'Opération / Réf',
        qty: isRTL ? 'التاريخ' : 'Date',
        price: isRTL ? 'المبلغ' : 'Montant',
        total: isRTL ? 'المتبقي' : 'Solde'
      },
      items: filteredItems.map((it) => ({
        name: `${it.title} [${it.reference}]${it.subtitle ? ` - ${it.subtitle}` : ''}`,
        quantity: new Date(it.date).toLocaleDateString('fr-FR'),
        unitPrice: it.total > 0 ? it.total : it.amountPaid,
        total: it.debtChange
      })),
      subtotal: totalPurchasesAmount,
      amountPaid: totalPaidAmount,
      remainingDebt: currentDebt,
      total: currentDebt,
      notes: supplier.notes ? `${isRTL ? 'ملاحظات المورد:' : 'Notes:'} ${supplier.notes}` : undefined,
      footerText: 'Smart POS Pro - Supplier Account Statement'
    };
  };

  const handlePrintLedger = () => {
    triggerHaptic('light');
    const meta = buildLedgerPdfMeta();
    const periodLabel = selectedMonth 
      ? `شهر: ${selectedMonth}` 
      : fromDate && toDate 
        ? `${fromDate} إلى ${toDate}` 
        : isRTL ? 'كافة العمليات' : 'All';

    const printHtml = `
      <div style="font-family: Arial, sans-serif; padding: 20px; direction: ${isRTL ? 'rtl' : 'ltr'};">
        <div style="border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 15px;">
          <h2 style="margin: 0 0 5px 0;">${config.name || 'Smart POS'} - ${isRTL ? 'كشف حساب ونشاط المورّد' : 'Supplier Account Statement'}</h2>
          <div style="font-size: 12px; color: #555;">
            <b>${isRTL ? 'المورّد:' : 'Supplier:'}</b> ${supplier.name} (${supplier.company}) | <b>${isRTL ? 'الهاتف:' : 'Tel:'}</b> ${supplier.phone} | <b>${isRTL ? 'الفترة:' : 'Period:'}</b> ${periodLabel}
          </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 20px;">
          <div style="border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px; background: #f8fafc;">
            <div style="font-size: 11px; color: #64748b; font-weight: bold;">${isRTL ? 'إجمالي المشتريات' : 'Total Purchases'}</div>
            <div style="font-size: 18px; font-weight: 900; color: #1e3a8a; margin-top: 3px;">${totalPurchasesAmount.toFixed(2)} ${currency}</div>
          </div>
          <div style="border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px; background: #f8fafc;">
            <div style="font-size: 11px; color: #64748b; font-weight: bold;">${isRTL ? 'إجمالي المدفوع' : 'Total Paid'}</div>
            <div style="font-size: 18px; font-weight: 900; color: #065f46; margin-top: 3px;">${totalPaidAmount.toFixed(2)} ${currency}</div>
          </div>
          <div style="border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px; background: #f8fafc;">
            <div style="font-size: 11px; color: #64748b; font-weight: bold;">${isRTL ? 'الرصيد المتبقي (الدين)' : 'Outstanding Debt'}</div>
            <div style="font-size: 18px; font-weight: 900; color: ${currentDebt > 0 ? '#b91c1c' : '#047857'}; margin-top: 3px;">${currentDebt.toFixed(2)} ${currency}</div>
          </div>
        </div>

        <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
          <thead>
            <tr style="background: #f1f5f9; border-bottom: 2px solid #cbd5e1;">
              <th style="padding: 8px; text-align: ${isRTL ? 'right' : 'left'};">#</th>
              <th style="padding: 8px; text-align: ${isRTL ? 'right' : 'left'};">${isRTL ? 'التاريخ' : 'Date'}</th>
              <th style="padding: 8px; text-align: ${isRTL ? 'right' : 'left'};">${isRTL ? 'العملية / المرجع' : 'Type / Ref'}</th>
              <th style="padding: 8px; text-align: ${isRTL ? 'right' : 'left'};">${isRTL ? 'التفاصيل' : 'Details'}</th>
              <th style="padding: 8px; text-align: ${isRTL ? 'left' : 'right'};">${isRTL ? 'قيمة الفاتورة' : 'Total'}</th>
              <th style="padding: 8px; text-align: ${isRTL ? 'left' : 'right'};">${isRTL ? 'المدفوع' : 'Paid'}</th>
              <th style="padding: 8px; text-align: ${isRTL ? 'left' : 'right'};">${isRTL ? 'الأثر المالي' : 'Balance'}</th>
            </tr>
          </thead>
          <tbody>
            ${filteredItems.map((it, idx) => `
              <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 8px; color: #64748b;">${idx + 1}</td>
                <td style="padding: 8px; font-family: monospace;">${new Date(it.date).toLocaleDateString('fr-FR')}</td>
                <td style="padding: 8px;"><b>${it.title}</b> (${it.reference})</td>
                <td style="padding: 8px; color: #475569; font-size: 11px;">${it.subtitle || '-'}</td>
                <td style="padding: 8px; text-align: ${isRTL ? 'left' : 'right'}; font-family: monospace;">${it.total > 0 ? it.total.toFixed(2) + ' ' + currency : '-'}</td>
                <td style="padding: 8px; text-align: ${isRTL ? 'left' : 'right'}; font-family: monospace; color: #047857; font-weight: bold;">${it.amountPaid > 0 ? it.amountPaid.toFixed(2) + ' ' + currency : '-'}</td>
                <td style="padding: 8px; text-align: ${isRTL ? 'left' : 'right'}; font-family: monospace; font-weight: 900; color: ${it.debtChange > 0 ? '#b91c1c' : '#047857'};">${it.debtChange > 0 ? '+' : ''}${it.debtChange.toFixed(2)} ${currency}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    printHtmlContent({ html: printHtml, title: `STMT-${supplier.name}`, isRTL, mode: 'a4' }, meta);
  };

  const handleExportLedgerPdf = async () => {
    triggerHaptic('light');
    await exportStructuredPdf(buildLedgerPdfMeta(), `Supplier-Statement-${supplier.name.replace(/\s+/g, '_')}-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const handleShareWhatsApp = () => {
    triggerHaptic('light');
    const phone = supplier.phone ? supplier.phone.replace(/[^0-9+]/g, '') : '';
    const storeName = config.name || 'Smart POS';
    const lines = [
      `📊 *${isRTL ? 'كشف حساب ونشاط المورّد' : 'Relevé de Compte Fournisseur'}*`,
      `🏪 *${storeName}*`,
      `👤 *${supplier.name}* (${supplier.company})`,
      `📅 ${new Date().toLocaleDateString('fr-FR')}`,
      '--------------------------------',
      `📦 ${isRTL ? 'إجمالي المشتريات' : 'Total Achats'}: *${totalPurchasesAmount.toFixed(2)} ${currency}*`,
      `💵 ${isRTL ? 'إجمالي المدفوع' : 'Total Payé'}: *${totalPaidAmount.toFixed(2)} ${currency}*`,
      `⚠️ *${isRTL ? 'الرصيد المتبقي بذمتنا' : 'Solde Dû'}: ${currentDebt.toFixed(2)} ${currency}*`,
      '--------------------------------',
      supplier.notes ? `📝 ${supplier.notes}` : null
    ].filter(Boolean).join('\n');

    const text = encodeURIComponent(lines);
    const url = phone ? `https://wa.me/${phone}?text=${text}` : `https://wa.me/?text=${text}`;
    window.open(url, '_blank');
  };

  const handleShareNative = async () => {
    triggerHaptic('light');
    const storeName = config.name || 'Smart POS';
    const lines = [
      `📊 *${isRTL ? 'كشف حساب ونشاط المورّد' : 'Relevé de Compte Fournisseur'}*`,
      `🏪 *${storeName}*`,
      `👤 *${supplier.name}* (${supplier.company})`,
      `📅 ${new Date().toLocaleDateString('fr-FR')}`,
      '--------------------------------',
      `📦 ${isRTL ? 'إجمالي المشتريات' : 'Total Achats'}: ${totalPurchasesAmount.toFixed(2)} ${currency}`,
      `💵 ${isRTL ? 'إجمالي المدفوع' : 'Total Payé'}: ${totalPaidAmount.toFixed(2)} ${currency}`,
      `⚠️ *${isRTL ? 'الرصيد المتبقي بذمتنا' : 'Solde Dû'}: ${currentDebt.toFixed(2)} ${currency}*`
    ].join('\n');

    await shareContent({
      title: `${supplier.name} - Statement`,
      text: lines,
      dialogTitle: isRTL ? 'مشاركة كشف حساب المورد' : 'Partager le relevé fournisseur'
    });
  };

  const handleConfirmSettle = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseDecimal(settleAmount, 0);
    if (amount <= 0) {
      alert(isRTL ? 'يرجى إدخال مبلغ صحيح أكبر من صفر.' : 'Veuillez saisir un montant valide.');
      return;
    }
    onSettleDebt(supplier.id, amount, settleNotes || undefined);
    setIsSettling(false);
    setSettleAmount('');
    setSettleNotes('');
  };

  return createPortal(
    <div 
      className="fixed inset-0 z-[200] bg-slate-900/70 backdrop-blur-xs flex flex-col items-center justify-center p-0 sm:p-4 overflow-hidden safe-modal-overlay"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <div className="bg-white rounded-none sm:rounded-3xl shadow-2xl border-0 sm:border border-slate-100 w-full max-w-5xl h-full sm:h-auto sm:max-h-[92vh] flex flex-col overflow-hidden animate-fade-in text-start">
        
        {/* Header */}
        <div 
          className="bg-slate-900 text-white px-4 sm:px-6 py-3.5 sm:py-4 flex flex-wrap items-center justify-between gap-3 shrink-0 border-b border-slate-800"
          style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top, 0px))' }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={onClose}
              className="p-2 hover:bg-slate-800 active:bg-slate-700 text-slate-300 hover:text-white rounded-xl transition cursor-pointer shrink-0"
              title={isRTL ? 'عودة' : 'Retour'}
            >
              <ArrowLeft className={`w-5 h-5 ${isRTL ? 'rotate-180' : ''}`} />
            </button>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-black truncate flex items-center gap-2">
                <span>{supplier.name}</span>
                {supplier.company && (
                  <span className="text-xs px-2 py-0.5 rounded-lg bg-indigo-500/20 text-indigo-300 font-bold border border-indigo-400/20">
                    {supplier.company}
                  </span>
                )}
              </h2>
              <p className="text-[11px] text-slate-400 flex items-center gap-3 truncate mt-0.5">
                <span className="flex items-center gap-1 font-mono"><Phone className="w-3 h-3 text-emerald-400" /> {supplier.phone}</span>
                {supplier.email && <span className="hidden sm:inline font-mono">• {supplier.email}</span>}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleShareNative}
              className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl text-xs font-black transition cursor-pointer shadow-xs"
              title={isRTL ? 'مشاركة' : 'Partager'}
            >
              <Share2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{isRTL ? 'مشاركة' : 'Partager'}</span>
            </button>

            <button
              type="button"
              onClick={handleShareWhatsApp}
              className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs font-black transition cursor-pointer shadow-xs"
              title="WhatsApp"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">واتساب</span>
            </button>

            <button
              type="button"
              onClick={handleExportLedgerPdf}
              className="flex items-center gap-1.5 px-3 py-2 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-xl text-xs font-black transition cursor-pointer shadow-xs"
              title="PDF"
            >
              <FileDown className="w-3.5 h-3.5" />
              <span>PDF</span>
            </button>

            <button
              type="button"
              onClick={handlePrintLedger}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-xl text-xs font-black transition cursor-pointer shadow-xs"
              title={isRTL ? 'طباعة كشف الحساب' : 'Imprimer'}
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{isRTL ? 'طباعة الكشف (A4)' : 'Imprimer'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body Content */}
        <div 
          className="p-3 sm:p-6 overflow-y-auto space-y-4 sm:space-y-5 flex-1 overscroll-contain touch-pan-y"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {/* Financial KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Total Purchases */}
            <div className="bg-gradient-to-br from-indigo-50 to-indigo-100/50 border border-indigo-200/80 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-indigo-700 block">{isRTL ? 'إجمالي فواتير المشتريات' : 'Total Achats'}</span>
                <span className="text-xl font-black font-mono text-indigo-950 mt-1 block">
                  {totalPurchasesAmount.toFixed(2)} <span className="text-xs font-normal text-slate-600">{currency}</span>
                </span>
                <span className="text-[11px] text-indigo-600 font-semibold mt-0.5 block">
                  {supplierPurchases.length} {isRTL ? 'فاتورة مسجلة' : 'factures'}
                </span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5" />
              </div>
            </div>

            {/* Total Paid */}
            <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 border border-emerald-200/80 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-emerald-700 block">{isRTL ? 'إجمالي المبالغ المسددة' : 'Total Payé'}</span>
                <span className="text-xl font-black font-mono text-emerald-950 mt-1 block">
                  {totalPaidAmount.toFixed(2)} <span className="text-xs font-normal text-slate-600">{currency}</span>
                </span>
                <span className="text-[11px] text-emerald-600 font-semibold mt-0.5 block">
                  {isRTL ? 'دفعات مسددة للمورد' : 'Règlements effectués'}
                </span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <CheckCircle className="w-5 h-5" />
              </div>
            </div>

            {/* Current Debt Balance & Quick Pay Button */}
            <div className={`rounded-2xl p-4 flex items-center justify-between border ${
              currentDebt > 0 
                ? 'bg-gradient-to-br from-rose-50 to-rose-100/60 border-rose-200/80' 
                : 'bg-gradient-to-br from-slate-50 to-slate-100/60 border-slate-200/80'
            }`}>
              <div>
                <span className={`text-xs font-black block ${currentDebt > 0 ? 'text-rose-700' : 'text-slate-600'}`}>
                  {isRTL ? 'الرصيد المتبقي (دين المورّد)' : 'Solde Dû'}
                </span>
                <span className={`text-xl font-black font-mono mt-1 block ${currentDebt > 0 ? 'text-rose-950' : 'text-slate-800'}`}>
                  {currentDebt.toFixed(2)} <span className="text-xs font-normal text-slate-600">{currency}</span>
                </span>
                <span className={`text-[11px] font-bold mt-0.5 block ${currentDebt > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {currentDebt > 0 ? (isRTL ? '⚠️ واجب أداؤه للمورد' : 'Dette en cours') : (isRTL ? '✅ الحساب خالص بالكامل' : 'Compte soldé')}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSettleAmount(currentDebt > 0 ? String(currentDebt) : '');
                  setIsSettling(true);
                }}
                className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-xl text-xs font-black transition cursor-pointer shadow-xs shrink-0 flex items-center gap-1.5"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>{isRTL ? 'تسديد دفعة' : 'Payer'}</span>
              </button>
            </div>
          </div>

          {/* Filters & Search Toolbar */}
          <div className="bg-slate-50 p-3 sm:p-4 rounded-2xl border border-slate-200/80 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[260px]">
              {/* Search */}
              <div className="relative flex-1 min-w-[180px]">
                <Search className="w-4 h-4 text-slate-400 absolute start-3 top-2.5" />
                <input
                  type="text"
                  placeholder={isRTL ? 'بحث برقم الفاتورة أو الصنف...' : 'Recherche réf, produit...'}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full ps-9 pe-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Type Pills */}
              <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setFilter('all')}
                  className={`px-3 py-1 rounded-lg transition cursor-pointer ${filter === 'all' ? 'bg-indigo-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  {isRTL ? 'الكل' : 'Tous'} ({rawItems.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilter('bills')}
                  className={`px-3 py-1 rounded-lg transition cursor-pointer ${filter === 'bills' ? 'bg-indigo-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  {isRTL ? 'فواتير شراء' : 'Factures'} ({supplierPurchases.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilter('payments')}
                  className={`px-3 py-1 rounded-lg transition cursor-pointer ${filter === 'payments' ? 'bg-indigo-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  {isRTL ? 'دفعات مسددة' : 'Paiements'} ({rawItems.filter(i => i.type === 'payment').length})
                </button>
              </div>
            </div>

            {/* Date Filters */}
            <div className="flex items-center gap-2 flex-wrap">
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700"
                title={isRTL ? 'من تاريخ' : 'Du'}
              />
              <span className="text-xs text-slate-400 font-bold">-</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700"
                title={isRTL ? 'إلى تاريخ' : 'Au'}
              />
              {(fromDate || toDate || selectedMonth || searchQuery) && (
                <button
                  type="button"
                  onClick={() => {
                    setFromDate('');
                    setToDate('');
                    setSelectedMonth('');
                    setSearchQuery('');
                  }}
                  className="px-2 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  {isRTL ? 'مسح الفلتر' : 'Effacer'}
                </button>
              )}
            </div>
          </div>

          {/* Activity Timeline / Table */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-start min-w-[620px]">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-black text-[11px]">
                  <tr>
                    <th className="p-3 text-start w-10">#</th>
                    <th className="p-3 text-start w-28">{isRTL ? 'التاريخ' : 'Date'}</th>
                    <th className="p-3 text-start">{isRTL ? 'العملية / المرجع' : 'Opération / Réf'}</th>
                    <th className="p-3 text-start">{isRTL ? 'التفاصيل والسلع' : 'Détails'}</th>
                    <th className="p-3 text-end">{isRTL ? 'قيمة الفاتورة' : 'Montant'}</th>
                    <th className="p-3 text-end">{isRTL ? 'المدفوع' : 'Payé'}</th>
                    <th className="p-3 text-end">{isRTL ? 'أثر الدين' : 'Impact'}</th>
                    <th className="p-3 text-center w-24">{isRTL ? 'الحالة' : 'Statut'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-semibold">
                  {filteredItems.length > 0 ? (
                    filteredItems.map((it, idx) => {
                      const isExpanded = Boolean(expandedBillIds[it.id]);
                      return (
                        <React.Fragment key={it.id}>
                          <tr className="hover:bg-slate-50/70 transition">
                            <td className="p-3 text-slate-400 font-mono text-center">{idx + 1}</td>
                            <td className="p-3 font-mono text-slate-600 whitespace-nowrap">
                              {new Date(it.date).toLocaleDateString('fr-FR')}
                              <span className="block text-[10px] text-slate-400">{new Date(it.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </td>
                            <td className="p-3">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-black ${
                                it.type === 'bill' ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                              }`}>
                                {it.type === 'bill' ? <FileText className="w-3 h-3" /> : <CreditCard className="w-3 h-3" />}
                                <span>{it.title}</span>
                              </span>
                              <span className="block font-mono font-bold text-slate-800 text-[11px] mt-0.5">
                                #{it.reference}
                              </span>
                            </td>
                            <td className="p-3 max-w-[240px]">
                              <p className="text-slate-600 line-clamp-1 text-[11px]">{it.subtitle || '-'}</p>
                              {it.rawBill && (it.rawBill.items?.length || 0) > 0 && (
                                <button
                                  type="button"
                                  onClick={() => setExpandedBillIds({ ...expandedBillIds, [it.id]: !isExpanded })}
                                  className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold mt-0.5 flex items-center gap-0.5 cursor-pointer"
                                >
                                  <span>{isExpanded ? (isRTL ? 'إخفاء السلع' : 'Masquer') : (isRTL ? `عرض السلع (${it.itemsCount})` : `Voir articles (${it.itemsCount})`)}</span>
                                  {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                </button>
                              )}
                            </td>
                            <td className="p-3 text-end font-mono font-bold text-slate-900 whitespace-nowrap">
                              {it.total > 0 ? `${it.total.toFixed(2)} ${currency}` : '-'}
                            </td>
                            <td className="p-3 text-end font-mono font-bold text-emerald-700 whitespace-nowrap">
                              {it.amountPaid > 0 ? `${it.amountPaid.toFixed(2)} ${currency}` : '-'}
                            </td>
                            <td className="p-3 text-end font-mono font-black whitespace-nowrap">
                              <span className={it.debtChange > 0 ? 'text-rose-600' : 'text-emerald-600'}>
                                {it.debtChange > 0 ? `+${it.debtChange.toFixed(2)}` : `${it.debtChange.toFixed(2)}`} {currency}
                              </span>
                            </td>
                            <td className="p-3 text-center">
                              {it.type === 'bill' ? (
                                <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-black ${
                                  it.status === 'paid' 
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                                    : it.status === 'partial' 
                                      ? 'bg-amber-50 text-amber-700 border border-amber-200' 
                                      : 'bg-rose-50 text-rose-700 border border-rose-200'
                                }`}>
                                  {it.status === 'paid' ? (isRTL ? 'خالص' : 'Payé') : it.status === 'partial' ? (isRTL ? 'جزئي' : 'Partiel') : (isRTL ? 'غير مسدد' : 'Impayé')}
                                </span>
                              ) : (
                                <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  {isRTL ? 'دفعة نقدية' : 'Règlement'}
                                </span>
                              )}
                            </td>
                          </tr>

                          {/* Expanded Bill Items Breakdown */}
                          {isExpanded && it.rawBill && (
                            <tr className="bg-slate-50/80">
                              <td colSpan={8} className="p-3 border-t border-slate-100">
                                <div className="space-y-1.5 p-2 bg-white rounded-xl border border-slate-200 text-xs">
                                  <div className="font-bold text-slate-700 text-[11px] mb-1">
                                    {isRTL ? 'تفاصيل السلع المشتراة في هذه الفاتورة:' : 'Articles de cette facture:'}
                                  </div>
                                  <table className="w-full text-[11px]">
                                    <thead className="text-slate-500 border-b border-slate-100">
                                      <tr>
                                        <th className="text-start py-1">{isRTL ? 'المنتج' : 'Article'}</th>
                                        <th className="text-center py-1">{isRTL ? 'الكمية' : 'Quantité'}</th>
                                        <th className="text-end py-1">{isRTL ? 'سعر الشراء' : 'Prix unitaire'}</th>
                                        <th className="text-end py-1">{isRTL ? 'المجموع' : 'Total'}</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 font-mono">
                                      {(it.rawBill.items || []).map((prod, pIdx) => (
                                        <tr key={pIdx}>
                                          <td className="py-1 font-sans font-bold text-slate-800">{prod.productName}</td>
                                          <td className="py-1 text-center font-bold text-slate-700">{prod.quantity}</td>
                                          <td className="py-1 text-end text-slate-600">{prod.purchasePrice.toFixed(2)} {currency}</td>
                                          <td className="py-1 text-end font-bold text-slate-900">{prod.total.toFixed(2)} {currency}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
                        <p className="font-bold">{isRTL ? 'لا توجد حركات أو فواتير مسجلة لهذا المورد مطابقة للبحث.' : 'Aucun mouvement trouvé.'}</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div 
          className="bg-slate-50 px-4 sm:px-6 py-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0"
          style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom, 0px))' }}
        >
          <div className="text-xs font-bold text-slate-600">
            {isRTL ? 'عدد العمليات:' : 'Total opérations:'} <b className="font-mono text-slate-900">{filteredItems.length}</b>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setSettleAmount(currentDebt > 0 ? String(currentDebt) : '');
                setIsSettling(true);
              }}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-xl text-xs font-black transition cursor-pointer shadow-xs"
            >
              <PlusCircle className="w-4 h-4" />
              <span>{isRTL ? 'تسجيل دفعة مسددة للمورد' : 'Enregistrer Paiement'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 active:bg-slate-400 text-slate-800 rounded-xl text-xs font-black transition cursor-pointer"
            >
              {isRTL ? 'إغلاق وعودة' : 'Fermer'}
            </button>
          </div>
        </div>
      </div>

      {/* Settle Debt Modal Overlay */}
      {isSettling && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[220]">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-md overflow-hidden animate-fade-in p-5 space-y-4 text-start">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-black text-slate-800 text-base flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-rose-600" />
                <span>{isRTL ? 'تسديد دفعة للمورّد' : 'Paiement Fournisseur'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsSettling(false)}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-rose-50 border border-rose-100 rounded-xl p-3 text-xs space-y-1">
              <div className="flex justify-between items-center text-rose-800 font-bold">
                <span>{isRTL ? 'المورّد:' : 'Fournisseur:'}</span>
                <span className="font-black">{supplier.name}</span>
              </div>
              <div className="flex justify-between items-center text-rose-900 font-bold">
                <span>{isRTL ? 'إجمالي الدين الحالي المستحق:' : 'Dette actuelle:'}</span>
                <span className="font-mono font-black text-sm">{currentDebt.toFixed(2)} {currency}</span>
              </div>
            </div>

            <form onSubmit={handleConfirmSettle} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {isRTL ? 'المبلغ المسدد نقداً:' : 'Montant à payer:'} <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="decimal"
                    required
                    value={settleAmount}
                    onChange={(e) => setSettleAmount(sanitizeDecimalInput(e.target.value))}
                    placeholder="0.00"
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-black font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                    autoFocus
                  />
                  <span className="absolute end-3 top-2.5 text-xs font-bold text-slate-400">
                    {currency}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {isRTL ? 'ملاحظات / طريقة الدفع:' : 'Notes / Mode de paiement:'}
                </label>
                <input
                  type="text"
                  value={settleNotes}
                  onChange={(e) => setSettleNotes(e.target.value)}
                  placeholder={isRTL ? 'مثال: تسديد نقدي من الصندوق، شيك بنكي، تحويل...' : 'Ex: Espèces, Chèque, Virement...'}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsSettling(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  {isRTL ? 'إلغاء' : 'Annuler'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-xl text-xs font-black transition cursor-pointer shadow-xs"
                >
                  {isRTL ? 'تأكيد تسجيل الدفعة' : 'Confirmer le paiement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}
