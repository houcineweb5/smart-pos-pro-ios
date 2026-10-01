/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Customer, Invoice, Language, StoreConfig } from '../types';
import { languages } from '../languages';
import { Receipt, Search, Eye, Printer, X, DollarSign, Calendar, CheckSquare, AlertTriangle, Clock, Trash2, RotateCcw, MessageCircle, Share2, CheckCircle2, User, FileSpreadsheet } from 'lucide-react';
import { generateBarcodeSvg } from '../utils/barcode';
import { parseDecimal, sanitizeDecimalInput } from '../utils/numberInput';

interface InvoicesProps {
  invoices: Invoice[];
  customers?: Customer[];
  config: StoreConfig;
  onPayInvoiceBalance: (invoiceId: string, amountPaid: number) => void;
  onDeleteInvoice: (id: string) => void;
  onReturnInvoice?: (invoiceId: string, returnList: { productId: string; quantity: number; unitPrice: number }[], notes?: string) => void;
  lang: Language;
}

export default function Invoices({ invoices, customers = [], config, onPayInvoiceBalance, onDeleteInvoice, onReturnInvoice, lang }: InvoicesProps) {
  const t = languages[lang];
  const isRTL = t.direction === 'rtl';

  const [search, setSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [viewInvoice, setViewInvoice] = useState<Invoice | null>(null);

  // Sales return states
  const [returningInvoice, setReturningInvoice] = useState<Invoice | null>(null);
  const [returnQuantities, setReturnQuantities] = useState<Record<string, number>>({});
  const [returnNotes, setReturnNotes] = useState('');
  const [returnSuccessMsg, setReturnSuccessMsg] = useState('');

  // Date filter states
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Remaining payment input for invoice details modal
  const [balancePayment, setBalancePayment] = useState<number>(0);

  // Custom state for delete confirmation dialog
  const [deletingInvoiceId, setDeletingInvoiceId] = useState<string | null>(null);

  // Filters
  const filteredInvoices = invoices.filter((inv) => {
    const s = search.toLowerCase();
    const matchSearch =
      inv.invoiceNumber.toLowerCase().includes(s) ||
      inv.customerName.toLowerCase().includes(s) ||
      (inv.notes && inv.notes.toLowerCase().includes(s));
    
    const matchStatus =
      selectedStatus === 'all'
        ? true
        : selectedStatus === 'wholesale'
        ? Boolean(inv.isWholesale || inv.pricingMode === 'wholesale')
        : inv.status === selectedStatus;

    let matchDate = true;
    if (showDateFilter) {
      if (inv.date) {
        const invDateTime = new Date(inv.date).getTime();
        if (fromDate) {
          const start = new Date(fromDate).getTime();
          if (invDateTime < start) matchDate = false;
        }
        if (toDate) {
          const end = new Date(toDate);
          end.setHours(23, 59, 59, 999);
          if (invDateTime > end.getTime()) matchDate = false;
        }
      } else {
        if (fromDate || toDate) matchDate = false;
      }
    }

    return matchSearch && matchStatus && matchDate;
  });

  const getStatusCapsule = (status: Invoice['status']) => {
    switch (status) {
      case 'paid':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-bold font-sans">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            {t.invoice.paidStatus}
          </span>
        );
      case 'partial':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-xs font-bold font-sans">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
            {t.invoice.partialStatus}
          </span>
        );
      case 'unpaid':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-50 text-rose-700 border border-rose-200 rounded-full text-xs font-bold font-sans">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
            {t.invoice.unpaidStatus}
          </span>
        );
      case 'refunded':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-purple-50 text-purple-700 border border-purple-200 rounded-full text-xs font-bold font-sans">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
            {lang === 'ar' ? 'مسترجعة بالكامل' : 'Refunded'}
          </span>
        );
    }
  };

  const handleOpenReturn = (inv: Invoice) => {
    setReturningInvoice(inv);
    const initialQty: Record<string, number> = {};
    inv.items.forEach((it) => {
      initialQty[it.productId] = 0;
    });
    setReturnQuantities(initialQty);
    setReturnNotes('');
  };

  const handleConfirmReturn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!returningInvoice || !onReturnInvoice) return;

    const returnList = Object.entries(returnQuantities)
      .filter(([_, qty]) => Number(qty) > 0)
      .map(([productId, quantity]) => {
        const item = returningInvoice.items.find((i) => i.productId === productId);
        const unitPrice = item && item.quantity > 0 ? item.total / item.quantity : 0;
        return {
          productId,
          quantity: Number(quantity),
          unitPrice
        };
      });

    if (returnList.length === 0) {
      alert(lang === 'ar' ? 'يرجى تحديد كمية صنف واحد على الأقل للإرجاع!' : 'Please specify a return quantity for at least one item!');
      return;
    }

    onReturnInvoice(returningInvoice.id, returnList, returnNotes);
    
    // If we are currently viewing this invoice in modal, update its state
    if (viewInvoice && viewInvoice.id === returningInvoice.id) {
      const updatedReturned = [
        ...(viewInvoice.returnedItems || []),
        ...returnList.map(it => ({
          productId: it.productId,
          productName: viewInvoice.items.find(i => i.productId === it.productId)?.productName || it.productId,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          refundAmount: it.unitPrice * it.quantity,
          date: new Date().toISOString()
        }))
      ];
      setViewInvoice({
        ...viewInvoice,
        returnedItems: updatedReturned
      });
    }

    setReturningInvoice(null);
    setReturnSuccessMsg(lang === 'ar' ? 'تمت عملية إرجاع المبيعات وإعادة الأصناف للمخزن بنجاح!' : 'Sales return processed and stock restored successfully!');
    setTimeout(() => setReturnSuccessMsg(''), 4000);
  };

  const handleOpenDetails = (inv: Invoice) => {
    setViewInvoice(inv);
    const balance = inv.total - inv.amountPaid;
    setBalancePayment(balance > 0 ? balance : 0);
  };

  const handleSubmittingPayment = (e: React.FormEvent) => {
    e.preventDefault();
    const paidAmountNum = parseDecimal(balancePayment);
    if (!viewInvoice || paidAmountNum <= 0) return;

    onPayInvoiceBalance(viewInvoice.id, paidAmountNum);
    
    // Update local modal state after transaction updates
    const updatedInvoice = {
      ...viewInvoice,
      amountPaid: viewInvoice.amountPaid + paidAmountNum,
      status: (viewInvoice.amountPaid + paidAmountNum >= viewInvoice.total) ? 'paid' : 'partial' as Invoice['status']
    };
    
    setViewInvoice(updatedInvoice);
    setBalancePayment(0);
  };

  // Direct WhatsApp invoice sharing
  const handleWhatsAppShare = (inv: Invoice) => {
    const cust = customers.find(c => c.id === inv.customerId || c.name === inv.customerName);
    let phone = cust?.phone || '';
    let cleanPhone = phone.replace(/[^0-9]/g, '');
    if (cleanPhone.startsWith('06') || cleanPhone.startsWith('07')) {
      cleanPhone = '212' + cleanPhone.slice(1);
    }

    const itemsLines = inv.items.map(it => `• ${it.productName} (x${it.quantity}) : ${(it.sellingPrice * it.quantity).toFixed(2)} ${config.currency}`).join('\n');
    const remaining = Math.max(0, inv.total - inv.amountPaid);

    const message = lang === 'ar'
      ? `*فاتورة مبيعات - ${config.name}*\n` +
        `--------------------------------\n` +
        `رقم الفاتورة: ${inv.invoiceNumber}\n` +
        `الزبون: ${inv.customerName}\n` +
        `التاريخ: ${inv.date ? new Date(inv.date).toLocaleDateString() : ''}\n\n` +
        `*قائمة المواد والمنتجات:*\n${itemsLines}\n\n` +
        `--------------------------------\n` +
        `*المجموع الإجمالي:* ${inv.total.toFixed(2)} ${config.currency}\n` +
        `*المبلغ المؤدى (المدفوع):* ${inv.amountPaid.toFixed(2)} ${config.currency}\n` +
        (remaining > 0 ? `*المبلغ المتبقي بذمتكم:* ${remaining.toFixed(2)} ${config.currency}\n` : '') +
        `--------------------------------\n` +
        `شكراً لتسوقكم وثقتكم بنا!`
      : `*Facture de Vente - ${config.name}*\n` +
        `--------------------------------\n` +
        `N° Facture: ${inv.invoiceNumber}\n` +
        `Client: ${inv.customerName}\n` +
        `Date: ${inv.date ? new Date(inv.date).toLocaleDateString() : ''}\n\n` +
        `*Détails des articles:*\n${itemsLines}\n\n` +
        `--------------------------------\n` +
        `*Montant Total:* ${inv.total.toFixed(2)} ${config.currency}\n` +
        `*Montant Payé:* ${inv.amountPaid.toFixed(2)} ${config.currency}\n` +
        (remaining > 0 ? `*Reste à payer:* ${remaining.toFixed(2)} ${config.currency}\n` : '') +
        `--------------------------------\n` +
        `Merci de votre confiance!`;

    const waUrl = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(waUrl, '_blank');
  };

  // Safe Print layout opener
  const triggerPrintLayout = () => {
    const printContent = document.getElementById('printable-area')?.innerHTML;
    if (!printContent) return;

    const printWindow = window.open('', '', 'width=850,height=950');
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8" />
            <title>${viewInvoice?.invoiceNumber || 'Invoice'} - ${config.name}</title>
            <style>
              @page { size: auto; margin: 15mm; }
              body {
                font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                padding: 0;
                margin: 0;
                color: #0f172a;
                direction: ${isRTL ? 'rtl' : 'ltr'};
                background: #ffffff;
                font-size: 12px;
              }
              * { box-sizing: border-box; }
              table { width: 100%; border-collapse: collapse; margin: 16px 0; }
              th, td { padding: 8px 12px; border-bottom: 1px solid #e2e8f0; }
              th { background-color: #f8fafc; font-weight: 700; font-size: 11px; text-transform: uppercase; color: #475569; }
              .text-start { text-align: ${isRTL ? 'right' : 'left'}; }
              .text-end { text-align: ${isRTL ? 'left' : 'right'}; }
              .text-center { text-align: center; }
              .font-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
              .font-bold { font-weight: 700; }
              .font-black { font-weight: 900; }
              @media print {
                body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              }
            </style>
          </head>
          <body>
            ${printContent}
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 500);
    } else {
      window.print();
    }
  };

  const triggerPrintThermalReceipt = () => {
    if (!viewInvoice) return;
    const inv = viewInvoice;
    const remaining = Math.max(0, inv.total - inv.amountPaid);
    const dateStr = inv.date ? new Date(inv.date).toLocaleString('fr-FR') : '';
    const totalItemsCount = inv.items.reduce((sum, item) => sum + item.quantity, 0);

    const itemsHtml = inv.items.map((item) => `
      <tr class="border-b-row">
        <td class="text-start" style="padding: 3px 2px; vertical-align: middle; font-size: 11px; font-weight: 800; color: #000;">
          ${item.productName} ${item.discount > 0 ? `<span style="font-size: 9px; font-weight: 700;">(-${item.discount}%)</span>` : ''}
        </td>
        <td class="text-center font-mono font-bold" style="padding: 3px 2px; vertical-align: middle; font-size: 11px; color: #000; white-space: nowrap;">
          ${item.quantity}
        </td>
        <td class="text-end font-mono font-bold" style="padding: 3px 2px; vertical-align: middle; font-size: 11px; color: #000; white-space: nowrap;">
          ${item.sellingPrice.toFixed(2)}
        </td>
        <td class="text-end font-mono font-black" style="padding: 3px 2px; vertical-align: middle; font-size: 11px; color: #000; white-space: nowrap;">
          ${item.total.toFixed(2)}
        </td>
      </tr>
    `).join('');

    const thermalContent = `
      <div style="font-family: 'Cairo', 'Tajawal', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; font-size: 11px; font-weight: 700; color: #000; direction: ${isRTL ? 'rtl' : 'ltr'};">
        <div style="text-align: center; margin-bottom: 8px;">
          <h2 style="margin: 0; font-size: 15px; font-weight: 900; color: #000;">${config.name}</h2>
          ${config.address ? `<div style="font-size: 10px; font-weight: 600; margin-top: 2px; color: #000;">${config.address}</div>` : ''}
          ${config.phone ? `<div style="font-size: 10px; font-weight: 600; color: #000;">${lang === 'ar' ? 'الهاتف:' : 'Tél:'} ${config.phone}</div>` : ''}
        </div>

        <div style="border-top: 1px solid #000; border-bottom: 1px solid #000; padding: 6px 0; margin-bottom: 8px; font-size: 10px; font-weight: 700; color: #000;">
          <div style="display: flex; justify-content: space-between;">
            <span>${lang === 'ar' ? 'رقم الفاتورة:' : 'N°:'} <b>${inv.invoiceNumber}</b></span>
            <span>${dateStr}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-top: 3px;">
            <span>${lang === 'ar' ? 'الزبون :' : 'Client :'} <b>${inv.customerName}</b></span>
            <span>${lang === 'ar' ? 'البائع:' : 'Vendeur:'} <b>${inv.sellerName || 'Admin'}</b></span>
          </div>
        </div>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 8px; font-size: 11px;">
          <thead>
            <tr style="border-bottom: 1.5px solid #000; font-size: 10.5px;">
              <th style="text-align: ${isRTL ? 'right' : 'left'}; padding: 4px 2px; font-weight: 900; color: #000; width: 42%;">${lang === 'ar' ? 'المنتج' : 'Article'}</th>
              <th style="text-align: center; padding: 4px 2px; font-weight: 900; color: #000; width: 16%;">${lang === 'ar' ? 'العدد' : 'Qté'}</th>
              <th style="text-align: ${isRTL ? 'left' : 'right'}; padding: 4px 2px; font-weight: 900; color: #000; width: 21%;">${lang === 'ar' ? 'السعر' : 'Prix'}</th>
              <th style="text-align: ${isRTL ? 'left' : 'right'}; padding: 4px 2px; font-weight: 900; color: #000; width: 21%;">${lang === 'ar' ? 'المجموع' : 'Total'}</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <div style="border-top: 1px solid #000; padding-top: 6px; font-size: 11px; font-weight: 700; color: #000;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
            <span>${lang === 'ar' ? 'المجموع' : 'Sous-total'}:</span>
            <span class="font-mono">${inv.subtotal.toFixed(2)} ${config.currency}</span>
          </div>
          ${inv.discount > 0 ? `
          <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
            <span>${lang === 'ar' ? 'الخصم' : 'Remise'}:</span>
            <span class="font-mono">-${inv.discount.toFixed(2)} ${config.currency}</span>
          </div>
          ` : ''}
          <div style="border: 2px solid #000; padding: 5px 8px; border-radius: 4px; margin: 6px 0; display: flex; justify-content: space-between; align-items: center; background: transparent; white-space: nowrap;">
            <span style="font-weight: 900; font-size: 12px; color: #000; white-space: nowrap;">${lang === 'ar' ? 'المجموع الإجمالي:' : 'TOTAL:'}</span>
            <span style="font-weight: 900; font-size: 15px; font-family: Arial, 'Trebuchet MS', Tahoma, sans-serif; font-variant-numeric: tabular-nums; color: #000; white-space: nowrap;">${inv.total.toFixed(2)} ${config.currency}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
            <span>${lang === 'ar' ? 'عدد المنتجات' : 'Articles'}:</span>
            <span class="font-mono">${totalItemsCount}</span>
          </div>
          ${remaining > 0 ? `
          <div style="display: flex; justify-content: space-between; font-weight: 900; margin-bottom: 2px;">
            <span>${lang === 'ar' ? 'المتبقي' : 'Reste'}:</span>
            <span class="font-mono">${remaining.toFixed(2)} ${config.currency}</span>
          </div>
          ` : ''}
        </div>

        <div style="margin: 8px 0; display: flex; justify-content: center; align-items: center;">
          ${generateBarcodeSvg(inv.invoiceNumber, 36)}
        </div>

        <div style="text-align: center; margin-top: 10px; padding-top: 6px; border-top: 1px solid #000; font-size: 10px; font-weight: 800; color: #000;">
          ${t.invoice.thankYou || 'شكراً لزيارتكم!'}
        </div>
      </div>
    `;

    const printWindow = window.open('', '', 'width=400,height=600');
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8" />
            <title>${inv.invoiceNumber} - Receipt</title>
            <link rel="preconnect" href="https://fonts.googleapis.com">
            <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
            <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@600;700;800;900&family=Tajawal:wght@700;800;900&display=swap" rel="stylesheet">
            <style>
              @page { size: 80mm auto; margin: 0; }
              * {
                box-sizing: border-box;
                margin: 0;
                padding: 0;
                color: #000 !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              body {
                width: 70mm;
                max-width: 70mm;
                margin: 0 auto;
                font-family: 'Cairo', 'Tajawal', Tahoma, 'Simplified Arabic', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                font-size: 12px;
                font-weight: 700;
                line-height: 1.4;
                padding: 2mm 3mm;
                color: #000 !important;
                background: #fff;
                direction: ${isRTL ? 'rtl' : 'ltr'};
                -webkit-font-smoothing: antialiased;
                text-rendering: optimizeLegibility;
              }
              .border-b-row td { border-bottom: 1px solid #000 !important; }
              .font-mono, .num, [class*="font-mono"] {
                font-family: Arial, 'Trebuchet MS', 'Segoe UI', Tahoma, sans-serif !important;
                font-variant-numeric: tabular-nums !important;
                font-feature-settings: "tnum" 1 !important;
                font-weight: 800 !important;
                letter-spacing: 0.3px !important;
              }
              .font-bold { font-weight: 700; }
              @media print {
                body { width: 70mm; max-width: 70mm; margin: 0 auto; padding: 1mm 2mm; }
              }
            </style>
          </head>
          <body onload="window.print(); window.close();">
            ${thermalContent}
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  return (
    <div className="space-y-6" id="invoices-sec">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6 text-indigo-600" />
            {t.invoice.title}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Search sales receipts, inspect line calculations, and manage deferred corporate balances.
          </p>
        </div>
      </div>

      {/* Query Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        {/* Search */}
        <div className="relative flex-1">
          <span className={`absolute inset-y-0 ${isRTL ? 'right-4' : 'left-4'} flex items-center text-slate-400`}>
            <Search className="w-5 h-5" />
          </span>
          <input
            id="inv-search-id"
            type="text"
            placeholder={t.invoice.search}
            className={`w-full py-3 ${isRTL ? 'pr-12 pl-4' : 'pl-12 pr-4'} bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition duration-150 shadow-xs`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Status filters */}
        <div className="flex gap-1.5 bg-slate-100 p-1.5 rounded-xl border border-slate-200/60 self-start md:self-auto overflow-x-auto no-scrollbar max-w-full">
          {['all', 'wholesale', 'paid', 'partial', 'unpaid', 'refunded'].map((stat) => (
            <button
              id={`filter-invoice-stat-${stat}`}
              key={stat}
              onClick={() => setSelectedStatus(stat)}
              className={`px-4 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition whitespace-nowrap ${
                selectedStatus === stat
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {stat === 'all'
                ? t.invoice.allStatus
                : stat === 'wholesale'
                ? (lang === 'ar' ? 'فواتير الجملة' : 'Wholesale')
                : stat === 'paid'
                ? t.pos.cash
                : stat === 'partial'
                ? t.invoice.partialStatus
                : stat === 'unpaid'
                ? t.invoice.unpaidStatus
                : (lang === 'ar' ? 'مسترجعة' : 'Refunded')}
            </button>
          ))}
        </div>

        {/* Date Filter Toggle Button */}
        <button
          id="btn-toggle-inv-date"
          type="button"
          onClick={() => {
            setShowDateFilter(!showDateFilter);
            if (showDateFilter) {
              setFromDate('');
              setToDate('');
            }
          }}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 border transition cursor-pointer shrink-0 self-start md:self-auto ${
            showDateFilter
              ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>{lang === 'ar' ? 'تصفية بالتاريخ' : 'Filter by Date'}</span>
        </button>
      </div>

      {showDateFilter && (
        <div className="flex flex-col sm:flex-row gap-4 items-center bg-white p-4 rounded-xl border border-slate-100 shadow-xs text-xs animate-fade-in">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-500">{lang === 'ar' ? 'من تاريخ:' : 'From Date:'}</span>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="px-2.5 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-500">{lang === 'ar' ? 'إلى تاريخ:' : 'To Date:'}</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="px-2.5 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
            />
          </div>
          {(fromDate || toDate) && (
            <button
              type="button"
              onClick={() => {
                setFromDate('');
                setToDate('');
              }}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold transition cursor-pointer"
            >
              {lang === 'ar' ? 'إعادة تعيين' : 'Reset'}
            </button>
          )}
        </div>
      )}

      {/* Invoices Logs Table */}
      <div className="bg-white border border-slate-100 rounded-2xl shadow-xs overflow-hidden" id="invoices-table-shell">
        <div className="overflow-x-auto">
          <table className="w-full text-right sm:text-inherit">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr className="text-slate-500 text-xs font-bold uppercase text-center">
                <th className="px-3.5 py-2.5 text-start">{t.invoice.number}</th>
                <th className="px-3.5 py-2.5 text-start">{t.invoice.date}</th>
                <th className="px-3.5 py-2.5 text-start">{t.invoice.customer}</th>
                <th className="px-3.5 py-2.5 text-center">{t.invoice.total}</th>
                <th className="px-3.5 py-2.5 text-center">{t.invoice.paid}</th>
                <th className="px-3.5 py-2.5 text-center">{t.invoice.status}</th>
                <th className="px-3.5 py-2.5 text-center">{t.invoice.actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs font-semibold">
              {filteredInvoices.length > 0 ? (
                filteredInvoices.map((inv) => {
                  const unpaidAmt = inv.total - inv.amountPaid;

                  return (
                    <tr key={inv.id} className="hover:bg-slate-50/50 transition">
                      <td className="px-3.5 py-2.5 font-mono font-bold text-slate-800 text-start">{inv.invoiceNumber}</td>
                      <td className="px-3.5 py-2.5 text-slate-500 text-start">{inv.date ? new Date(inv.date).toLocaleString('fr-FR') : ''}</td>
                      <td className="px-3.5 py-2.5 text-slate-800 text-start font-bold">{inv.customerName}</td>
                      <td className="px-3.5 py-2.5 text-slate-900 font-black text-center">{inv.total.toFixed(2)} {config.currency}</td>
                      <td className="px-3.5 py-2.5 text-slate-600 font-bold text-center">{inv.amountPaid.toFixed(2)} {config.currency}</td>
                      <td className="px-3.5 py-2.5 text-center">
                        <div className="flex flex-col items-center gap-1">
                          {getStatusCapsule(inv.status)}
                          {inv.returnedItems && inv.returnedItems.length > 0 && inv.status !== 'refunded' && (
                            <span className="text-[10px] text-purple-600 font-bold bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-full">
                              {lang === 'ar' ? 'مرتجع جزئي' : 'Partially Returned'}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3.5 py-2.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            id={`view-btn-${inv.id}`}
                            onClick={() => handleOpenDetails(inv)}
                            className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg border border-slate-200 text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                            title={t.invoice.view}
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>{t.invoice.view}</span>
                          </button>
                          <button
                            id={`wa-btn-${inv.id}`}
                            onClick={() => handleWhatsAppShare(inv)}
                            className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-lg border border-emerald-200 text-xs font-bold flex items-center transition cursor-pointer"
                            title={lang === 'ar' ? 'مشاركة الفاتورة عبر واتساب' : 'Share via WhatsApp'}
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                          </button>
                          {onReturnInvoice && inv.status !== 'refunded' && (
                            <button
                              id={`return-btn-${inv.id}`}
                              onClick={() => handleOpenReturn(inv)}
                              className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg border border-amber-200 text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                              title={lang === 'ar' ? 'إرجاع مبيعات' : 'Return Items'}
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>{lang === 'ar' ? 'إرجاع' : 'Return'}</span>
                            </button>
                          )}
                          <button
                            id={`delete-btn-${inv.id}`}
                            onClick={() => setDeletingInvoiceId(inv.id)}
                            className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg border border-transparent hover:border-rose-100 transition cursor-pointer"
                            title={lang === 'ar' ? 'حذف الفاتورة' : 'Delete Invoice'}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="text-center py-16 text-slate-400">
                    <Receipt className="w-12 h-12 stroke-[1.2] mx-auto text-slate-300 mb-3" />
                    No logged invoices found under selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Details/Print/Payment Modal */}
      {viewInvoice && (() => {
        const custObj = customers.find(c => c.id === viewInvoice.customerId || c.name === viewInvoice.customerName);
        const billDebt = Math.max(0, viewInvoice.total - viewInvoice.amountPaid);
        return createPortal(
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[100] overflow-y-auto" id="invoice-bill-modal">
            <div className="bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-2xl overflow-hidden animate-fade-in my-8 text-start">
              
              {/* Modal actions navigation bar */}
              <div className="flex justify-between items-center bg-slate-50 px-6 py-4 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-indigo-600" />
                  <span className="font-mono font-bold text-slate-700 text-xs tracking-wider uppercase">
                    {lang === 'ar' ? 'معاينة فاتورة مبيعات' : lang === 'fr' ? 'Aperçu Facture de Vente' : 'Sales Invoice Viewer'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    id="wa-btn-modal"
                    onClick={() => handleWhatsAppShare(viewInvoice)}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition shadow-xs"
                    title={lang === 'ar' ? 'إرسال الفاتورة عبر واتساب للزبون' : 'Send invoice via WhatsApp'}
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>{lang === 'ar' ? 'واتساب' : 'WhatsApp'}</span>
                  </button>
                  {onReturnInvoice && viewInvoice.status !== 'refunded' && (
                    <button
                      id="return-btn-modal"
                      onClick={() => handleOpenReturn(viewInvoice)}
                      className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition border border-amber-200"
                      title={lang === 'ar' ? 'إرجاع مبيعات من هذه الفاتورة' : 'Return items from this invoice'}
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>{lang === 'ar' ? 'إرجاع مبيعات' : 'Return Items'}</span>
                    </button>
                  )}
                  <button
                    id="print-thermal-btn"
                    onClick={triggerPrintThermalReceipt}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition shadow-xs"
                    title={lang === 'ar' ? 'طباعة إيصال حراري (80mm)' : 'Print Thermal Receipt (80mm)'}
                  >
                    <Printer className="w-4 h-4 text-emerald-400" />
                    <span>{lang === 'ar' ? 'إيصال (80mm)' : 'Receipt (80mm)'}</span>
                  </button>
                  <button
                    id="print-btn-actual"
                    onClick={triggerPrintLayout}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition shadow-xs"
                    title={lang === 'ar' ? 'طباعة A4' : 'Print A4'}
                  >
                    <Printer className="w-4 h-4" />
                    <span>{lang === 'ar' ? 'طباعة A4' : t.invoice.print}</span>
                  </button>
                  <button
                    id="close-bill-modal"
                    onClick={() => setViewInvoice(null)}
                    className="p-1.5 hover:bg-slate-200 text-slate-400 rounded-lg transition cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Printable Area Body */}
              <div className="p-6 md:p-8 space-y-6 overflow-y-auto max-h-[calc(90vh-140px)]" id="printable-area">
                {/* Unified Side-by-Side Store & Customer Info Header */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pb-6 border-b border-slate-200">
                  {/* Store Details (Side 1) */}
                  <div className="text-start space-y-1">
                    {config.logoUrl && (
                      <img
                        src={config.logoUrl}
                        alt="Store Logo"
                        referrerPolicy="no-referrer"
                        className="h-12 object-contain mb-2 bg-slate-50 border border-slate-200 rounded-lg p-1.5"
                      />
                    )}
                    <h2 className="text-xl font-black text-slate-900">{config.name}</h2>
                    {config.address && <p className="text-xs text-slate-600 font-medium">{config.address}</p>}
                    <div className="text-xs text-slate-500 space-y-0.5 pt-1">
                      {config.phone && <p>{lang === 'ar' ? 'الهاتف:' : 'Tél:'} {config.phone}</p>}
                      {config.email && <p>{lang === 'ar' ? 'البريد:' : 'Email:'} {config.email}</p>}
                    </div>
                  </div>

                  {/* Customer & Invoice Meta (Side 2 - symmetrical) */}
                  <div className="text-start sm:text-end space-y-2">
                    <div>
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                        {lang === 'ar' ? 'رقم الفاتورة' : 'Invoice No.'}
                      </span>
                      <h4 className="font-mono text-xl font-black text-slate-900">{viewInvoice.invoiceNumber}</h4>
                      <p className="text-xs text-slate-500 mt-1 flex items-center sm:justify-end gap-1 font-semibold">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        {viewInvoice.date ? new Date(viewInvoice.date).toLocaleString('fr-FR') : ''}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-100 sm:border-0 sm:pt-0">
                      <div className="inline-flex items-center gap-1.5 font-black text-slate-900 text-sm">
                        <User className="w-4 h-4 text-indigo-600" />
                        <span>{lang === 'ar' ? 'الزبون :' : 'Client :'}</span>
                        <span className="text-indigo-700">{viewInvoice.customerName}</span>
                      </div>
                      {custObj?.phone && (
                        <p className="text-xs text-slate-600 font-semibold mt-0.5">{custObj.phone}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Items Table */}
                <div className="border border-slate-100 rounded-xl overflow-hidden text-xs">
                  <table className="w-full">
                    <thead className="bg-slate-50/80">
                      <tr className="text-slate-500 font-bold border-b border-slate-100">
                        <th className="px-4 py-2.5 text-start">{lang === 'ar' ? 'رقم' : 'S.No.'}</th>
                        <th className="px-4 py-2.5 text-start">{lang === 'ar' ? 'الصنف / المادة' : 'Item Description'}</th>
                        <th className="px-4 py-2.5 text-center">{lang === 'ar' ? 'الكمية' : 'Qty'}</th>
                        <th className="px-4 py-2.5 text-center">{lang === 'ar' ? 'السعر' : 'Unit Price'}</th>
                        <th className="px-4 py-2.5 text-center">{lang === 'ar' ? 'الخصم' : 'Disc%'}</th>
                        <th className="px-4 py-2.5 text-end">{lang === 'ar' ? 'المجموع' : 'Total'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-semibold">
                      {viewInvoice.items.map((item, idx) => (
                        <tr key={idx} className="text-slate-700 hover:bg-slate-50/40">
                          <td className="px-4 py-2.5 text-slate-400 text-start">{idx + 1}</td>
                          <td className="px-4 py-2.5 text-slate-900 text-start font-bold">{item.productName}</td>
                          <td className="px-4 py-2.5 text-center font-mono">{item.quantity}</td>
                          <td className="px-4 py-2.5 text-center font-mono">{item.sellingPrice.toFixed(2)} {config.currency}</td>
                          <td className="px-4 py-2.5 text-center text-slate-400 font-mono">{item.discount > 0 ? `${item.discount}%` : '-'}</td>
                          <td className="px-4 py-2.5 text-end font-bold text-slate-900 font-mono">
                            {item.total.toFixed(2)} {config.currency}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Summary & Totals */}
                <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pt-4 border-t border-slate-100">
                  <div className="text-xs text-slate-400 max-w-xs space-y-1 text-start">
                    {viewInvoice.notes && (
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <p className="font-bold uppercase text-slate-500 tracking-wider text-[10px] mb-1">
                          {lang === 'ar' ? 'ملاحظة:' : 'Note:'}
                        </p>
                        <p className="text-slate-600 leading-relaxed font-medium">{viewInvoice.notes}</p>
                      </div>
                    )}
                    <p className="text-xs text-slate-600 font-bold pt-2 flex items-center gap-1">
                      <span>{lang === 'ar' ? 'البائع:' : 'Seller:'}</span>
                      <span className="text-slate-800 bg-slate-100 px-2.5 py-0.5 rounded font-black">
                        {viewInvoice.sellerName || 'Admin'}
                      </span>
                    </p>
                  </div>

                  <div className="w-full sm:w-72 space-y-2 text-xs font-semibold text-slate-700">
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-bold">{lang === 'ar' ? 'المجموع' : t.pos.subtotal}</span>
                      <span className="font-mono font-bold">{viewInvoice.subtotal.toFixed(2)} {config.currency}</span>
                    </div>
                    {viewInvoice.discount > 0 && (() => {
                      const pctDisc = viewInvoice.subtotal * (viewInvoice.discount / 100);
                      const diffPct = Math.abs(viewInvoice.total - (viewInvoice.subtotal - pctDisc + viewInvoice.tax));
                      const diffFlat = Math.abs(viewInvoice.total - (viewInvoice.subtotal - viewInvoice.discount + viewInvoice.tax));
                      const isPercentage = diffPct < diffFlat && viewInvoice.discount <= 100;
                      const actualDiscountVal = isPercentage ? pctDisc : viewInvoice.discount;
                      return (
                        <div className="flex justify-between text-rose-600 font-bold">
                          <span>{t.pos.discount} {isPercentage ? `(${viewInvoice.discount}%)` : ''}</span>
                          <span className="font-mono">-{actualDiscountVal.toFixed(2)} {config.currency}</span>
                        </div>
                      );
                    })()}
                    {viewInvoice.tax > 0 && (
                      <div className="flex justify-between">
                        <span className="text-slate-400">{t.pos.tax} ({config.taxRate}%)</span>
                        <span className="font-mono">{viewInvoice.tax.toFixed(2)} {config.currency}</span>
                      </div>
                    )}
                    <div className="flex justify-between border-t-2 border-slate-200 pt-2 text-base text-slate-900 font-black">
                      <span className="text-lg font-black">{t.pos.total}</span>
                      <span className="text-2xl font-black text-indigo-700 font-mono">{viewInvoice.total.toFixed(2)} {config.currency}</span>
                    </div>

                    <div className="flex justify-between text-emerald-700 bg-emerald-50/50 px-2.5 py-1.5 rounded-lg border border-emerald-100 text-xs">
                      <span>{t.invoice.paid}</span>
                      <span className="font-bold font-mono">{viewInvoice.amountPaid.toFixed(2)} {config.currency}</span>
                    </div>

                    {billDebt > 0 && (
                      <div className="flex justify-between text-rose-700 bg-rose-50/50 px-2.5 py-1.5 rounded-lg border border-rose-100 text-xs">
                        <span>{t.invoice.remaining}</span>
                        <span className="font-bold font-mono">{billDebt.toFixed(2)} {config.currency}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="text-center text-xs text-slate-400 font-bold pt-6 border-t border-slate-100 uppercase tracking-widest font-sans">
                  {t.invoice.thankYou}
                </div>
              </div>

              {/* Interactive outstanding debt collector */}
              {billDebt > 0 && (
                <div className="bg-slate-50 p-6 border-t border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h4 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-amber-500" />
                      {lang === 'ar' ? 'تسديد الرصيد المعلق' : 'Settle outstanding balance'}
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {lang === 'ar'
                        ? 'المبلغ المتبقي بذمة الزبون في هذه الفاتورة: '
                        : 'Remaining balance owed on this invoice: '}
                      <b className="font-mono text-rose-600 font-bold">{billDebt.toFixed(2)} {config.currency}</b>.
                    </p>
                  </div>

                  <form onSubmit={handleSubmittingPayment} className="flex gap-2 items-center">
                    <div className="relative">
                      <span className="absolute inset-y-0 start-2.5 flex items-center text-slate-400 text-xs font-bold">{config.currency}</span>
                      <input
                        id="balance-payment-input"
                        required
                        type="text"
                        inputMode="decimal"
                        placeholder="0.00"
                        value={balancePayment}
                        onChange={(e) => setBalancePayment(sanitizeDecimalInput(e.target.value) as any)}
                        className="ps-10 pe-2 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold w-32 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                      />
                    </div>
                    <button
                      id="settle-invoice-btn"
                      type="submit"
                      className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition cursor-pointer shadow-xs"
                    >
                      {lang === 'ar' ? 'تسجيل القبض' : 'Post Settle'}
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>,
          document.body
        );
      })()}

      {/* Return Success Toast */}
      {returnSuccessMsg && (
        <div className="fixed bottom-6 right-6 bg-emerald-900 text-white px-5 py-3.5 rounded-2xl border border-emerald-500/30 shadow-2xl flex items-center gap-3 z-50 animate-bounce">
          <RotateCcw className="w-5 h-5 text-emerald-400" />
          <span className="text-xs font-bold">{returnSuccessMsg}</span>
        </div>
      )}

      {/* SALES RETURN MODAL */}
      {returningInvoice && createPortal(
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[100] overflow-y-auto" id="sales-return-modal">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden animate-fade-in text-start">
            {/* Modal Header */}
            <div className={`flex items-center justify-between px-6 py-4 bg-amber-500/10 border-b border-amber-200/50 shrink-0 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-500 text-white rounded-xl shadow-xs">
                  <RotateCcw className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-850">
                    {lang === 'ar' ? 'إرجاع مبيعات (استرجاع منتجات)' : 'Sales Return & Stock Restoral'}
                  </h3>
                  <p className="text-xs font-bold text-amber-800/80 font-mono mt-0.5">
                    {returningInvoice.invoiceNumber} - {returningInvoice.customerName}
                  </p>
                </div>
              </div>
              <button
                id="btn-close-return-modal"
                onClick={() => setReturningInvoice(null)}
                className="p-1 hover:bg-slate-200/60 text-slate-400 hover:text-slate-700 rounded-lg transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleConfirmReturn} className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Info banner */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/60 flex flex-wrap justify-between items-center text-xs font-semibold gap-2">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">{lang === 'ar' ? 'الزبون' : 'Customer'}</span>
                  <span className="font-bold text-slate-850">{returningInvoice.customerName}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">{lang === 'ar' ? 'إجمالي الفاتورة' : 'Total'}</span>
                  <span className="font-bold font-mono text-slate-850">{returningInvoice.total.toFixed(2)} {config.currency}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">{lang === 'ar' ? 'طريقة الدفع' : 'Payment'}</span>
                  <span className="font-bold uppercase text-indigo-600 font-mono">{returningInvoice.paymentMethod}</span>
                </div>
              </div>

              {/* Items return selector table */}
              <div className="space-y-2">
                <label className="block text-xs font-black text-slate-700 uppercase tracking-wide">
                  {lang === 'ar' ? 'حدد الكميات المراد إرجاعها للمخزن:' : 'Specify items and quantities to return:'}
                </label>

                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-xs text-start">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold text-[10px] uppercase">
                      <tr>
                        <th className="p-3 text-start">{lang === 'ar' ? 'المنتج' : 'Item'}</th>
                        <th className="p-3 text-center">{lang === 'ar' ? 'المباع' : 'Sold'}</th>
                        <th className="p-3 text-center">{lang === 'ar' ? 'كمية الإرجاع' : 'Return Qty'}</th>
                        <th className="p-3 text-end">{lang === 'ar' ? 'سعر الوحدة' : 'Unit Price'}</th>
                        <th className="p-3 text-end">{lang === 'ar' ? 'المسترد' : 'Refund'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-semibold">
                      {returningInvoice.items.map((it) => {
                        const previouslyReturned = (returningInvoice.returnedItems || [])
                          .filter(r => r.productId === it.productId)
                          .reduce((sum, r) => sum + r.quantity, 0);
                        const maxAvailable = Math.max(0, it.quantity - previouslyReturned);
                        const unitPrice = it.quantity > 0 ? it.total / it.quantity : it.sellingPrice;
                        const currQty = returnQuantities[it.productId] || 0;
                        const lineRefund = currQty * unitPrice;

                        return (
                          <tr key={it.productId} className={maxAvailable === 0 ? 'opacity-40 bg-slate-50' : 'hover:bg-slate-50/50'}>
                            <td className="p-3">
                              <p className="font-bold text-slate-850 line-clamp-1">{it.productName}</p>
                              {previouslyReturned > 0 && (
                                <span className="text-[10px] text-purple-600 font-bold">
                                  {lang === 'ar' ? `(أُرجع مسبقاً: ${previouslyReturned})` : `(Returned: ${previouslyReturned})`}
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-center font-mono">{it.quantity}</td>
                            <td className="p-3 text-center">
                              {maxAvailable > 0 ? (
                                <div className="flex items-center justify-center gap-1">
                                  <input
                                    type="number"
                                    min="0"
                                    max={maxAvailable}
                                    value={currQty}
                                    onChange={(e) => {
                                       const val = Math.max(0, Math.min(maxAvailable, parseInt(e.target.value) || 0));
                                       setReturnQuantities({ ...returnQuantities, [it.productId]: val });
                                    }}
                                    className="w-16 px-2 py-1 text-center font-bold border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none"
                                  />
                                  <span className="text-[10px] text-slate-400 font-mono">/ {maxAvailable}</span>
                                </div>
                              ) : (
                                <span className="text-[10px] text-rose-500 font-bold">{lang === 'ar' ? 'أُرجع بالكامل' : 'Fully returned'}</span>
                              )}
                            </td>
                            <td className="p-3 text-end font-mono text-slate-600">{unitPrice.toFixed(2)} {config.currency}</td>
                            <td className="p-3 text-end font-mono font-bold text-amber-700">
                              {lineRefund.toFixed(2)} {config.currency}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Total return calculation */}
              {(() => {
                const totalRefund = Object.entries(returnQuantities).reduce((sum, [pId, q]) => {
                  const it = returningInvoice.items.find(i => i.productId === pId);
                  const price = it && it.quantity > 0 ? it.total / it.quantity : 0;
                  return sum + (Number(q) * price);
                }, 0);

                return (
                  <div className="bg-amber-50 p-4 rounded-xl border border-amber-200/60 flex justify-between items-center text-sm font-bold text-amber-900">
                    <span>{lang === 'ar' ? 'إجمالي المبلغ المسترد للزبون:' : 'Total Refund Amount:'}</span>
                    <span className="text-xl font-black font-mono text-amber-800">{totalRefund.toFixed(2)} {config.currency}</span>
                  </div>
                );
              })()}

              {/* Notice */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-slate-600 text-xs font-semibold leading-relaxed">
                <span className="font-bold text-slate-800 block mb-0.5">ℹ️ {lang === 'ar' ? 'تأثير الإرجاع:' : 'Impact:'}</span>
                {lang === 'ar' 
                  ? 'سيتم زيادة كمية المنتجات في المخزن تلقائياً فور التأكيد. وإذا كانت الفاتورة بالدين، فسيتم خصم قيمة المرتجع من حساب ديون الزبون.' 
                  : 'Product quantities will be immediately restored to warehouse inventory. Customer debt balance will be credited if applicable.'}
              </div>

              {/* Reason / Notes */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">
                  {lang === 'ar' ? 'سبب الإرجاع / ملاحظات:' : 'Return Reason / Remarks:'}
                </label>
                <input
                  type="text"
                  value={returnNotes}
                  onChange={(e) => setReturnNotes(e.target.value)}
                  placeholder={lang === 'ar' ? 'مثال: منتج تالف، تبديل مقاس، رغبة الزبون...' : 'e.g. Damaged item, customer exchange...'}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-amber-500 focus:bg-white"
                />
              </div>

              {/* Footer controls */}
              <div className={`flex items-center justify-end gap-3 pt-3 border-t border-slate-100 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <button
                  type="button"
                  onClick={() => setReturningInvoice(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
                >
                  {t.inventory.cancel}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-black rounded-xl text-xs transition cursor-pointer shadow-sm flex items-center gap-1.5"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>{lang === 'ar' ? 'تأكيد إرجاع المبيعات واستعادة المخزون' : 'Confirm Return & Restore Stock'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Custom Invoice Delete Dialog Overlay modal */}
      {deletingInvoiceId && createPortal(
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[100]">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-sm overflow-hidden p-6 space-y-4 animate-fade-in text-start">
            <div className={`flex items-center gap-3 text-rose-600 pb-2 border-b border-slate-100 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <Trash2 className="w-6 h-6 shrink-0" />
              <h3 className="text-lg font-black tracking-tight text-slate-800">
                {lang === 'ar' ? 'تاكيد حذف الفاتورة' : 'Confirm Invoice Deletion'}
              </h3>
            </div>
            <p className="text-sm text-slate-600 font-semibold leading-relaxed">
              {lang === 'ar'
                ? `هل أنت متأكد تماماً من رغبتك في حذف الفاتورة رقم "${invoices.find(invoice => invoice.id === deletingInvoiceId)?.invoiceNumber || ''}" ؟`
                : `Are you absolutely sure you want to delete invoice "${invoices.find(invoice => invoice.id === deletingInvoiceId)?.invoiceNumber || ''}" ?`}
            </p>
            <div className="bg-rose-50 text-[11px] text-rose-800 p-3 rounded-xl border border-rose-100 font-medium leading-relaxed">
              {lang === 'ar'
                ? 'تحذير: سيتم حذف سجل هذه الفاتورة نهائياً من كشوفات الحسابات المعتمدة، ولا يمكن التراجع عنها.'
                : 'Warning: This will permanent delete this transaction record from books. This action is irreversible.'}
            </div>
            <div className={`flex items-center justify-end gap-3 pt-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <button
                id="btn-confirm-inv-cancel"
                onClick={() => setDeletingInvoiceId(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
              >
                {t.inventory.cancel}
              </button>
              <button
                id="btn-confirm-inv-delete"
                onClick={() => {
                  onDeleteInvoice(deletingInvoiceId);
                  setDeletingInvoiceId(null);
                }}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-xl text-xs transition cursor-pointer"
              >
                {t.inventory.delete}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
