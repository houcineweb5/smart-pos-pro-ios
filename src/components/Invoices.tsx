/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ActiveTab, Customer, Invoice, Language, Product, SaleItem, StoreConfig } from '../types';
import { languages } from '../languages';
import { Receipt, Search, Eye, Printer, X, DollarSign, Calendar, CheckSquare, AlertTriangle, Clock, Trash2, RotateCcw, MessageCircle, Share2, CheckCircle2, User, FileSpreadsheet, FileDown, ArrowRight, TrendingUp, Edit, Plus, Save, Camera, ScanBarcode } from 'lucide-react';
import { generateBarcodeSvg } from '../utils/barcode';
import { parseDecimal, sanitizeDecimalInput } from '../utils/numberInput';
import { printHtmlContent, exportStructuredPdf, PdfDocumentMeta, buildUnified80mmReceiptHtml, A4_PRINT_THEMES } from '../utils/printService';
import { amountToWordsAr, amountToWordsFr } from '../utils/numberToWords';
import { pullCloudBarcodeScan } from '../utils/cloudSync';
import CameraBarcodeModal from './CameraBarcodeModal';

interface InvoicesProps {
  invoices: Invoice[];
  products?: Product[];
  customers?: Customer[];
  config: StoreConfig;
  onPayInvoiceBalance: (invoiceId: string, amountPaid: number) => void;
  onEditInvoice?: (invoice: Invoice) => void;
  onDeleteInvoice: (id: string) => void;
  onReturnInvoice?: (invoiceId: string, returnList: { productId: string; quantity: number; unitPrice: number }[], notes?: string) => void;
  onNavigate?: (tab: ActiveTab) => void;
  lang: Language;
}

export default function Invoices({ invoices, products = [], customers = [], config, onPayInvoiceBalance, onEditInvoice, onDeleteInvoice, onReturnInvoice, onNavigate, lang }: InvoicesProps) {
  const t = languages[lang];
  const isRTL = t.direction === 'rtl';

  const [search, setSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [viewInvoice, setViewInvoice] = useState<Invoice | null>(null);
  const [receiptPreviewInvoice, setReceiptPreviewInvoice] = useState<Invoice | null>(null);

  // Sales return states
  const [returningInvoice, setReturningInvoice] = useState<Invoice | null>(null);
  const [returnQuantities, setReturnQuantities] = useState<Record<string, number>>({});
  const [returnNotes, setReturnNotes] = useState('');
  const [returnSuccessMsg, setReturnSuccessMsg] = useState('');

  // Edit invoice states
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [editCustomerId, setEditCustomerId] = useState<string>('');
  const [editCustomerName, setEditCustomerName] = useState<string>('');
  const [editItems, setEditItems] = useState<SaleItem[]>([]);
  const [editDiscount, setEditDiscount] = useState<number>(0);
  const [editPreviousBalance, setEditPreviousBalance] = useState<number>(0);
  const [editAmountPaid, setEditAmountPaid] = useState<number>(0);
  const [editPaymentMethod, setEditPaymentMethod] = useState<'cash' | 'card' | 'transfer' | 'credit'>('cash');
  const [editNotes, setEditNotes] = useState<string>('');

  // Date & Month & Customer filter states
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [selectedCustomerFilter, setSelectedCustomerFilter] = useState('all');

  // Remaining payment input for invoice details modal
  const [balancePayment, setBalancePayment] = useState<number>(0);

  // Custom state for delete confirmation dialog
  const [deletingInvoiceId, setDeletingInvoiceId] = useState<string | null>(null);

  // Barcode search & camera scanner states
  const [showBarcodeScannerModal, setShowBarcodeScannerModal] = useState(false);
  const [barcodeScanToast, setBarcodeScanToast] = useState<string | null>(null);

  const playInvoiceScanBeep = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1046, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1318, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.15);
    } catch {}
  };

  const handleScanInvoiceBarcode = (code: string) => {
    let cleanCode = String(code || '').trim();
    if (!cleanCode) return;

    // Strip Code 39 leading and trailing asterisks (e.g. *INV-1234* -> INV-1234)
    cleanCode = cleanCode.replace(/^\*+|\*+$/g, '').trim();

    // Strip URL wrapper if scanned from QR code
    if (cleanCode.includes('/invoice/') || cleanCode.includes('inv=')) {
      const match = cleanCode.match(/(?:invoice\/|inv=)([A-Za-z0-9\-_]+)/i);
      if (match && match[1]) {
        cleanCode = match[1];
      }
    }

    const cleanLower = cleanCode.toLowerCase();
    const cleanAlpha = cleanLower.replace(/[^0-9a-z]/g, '');

    const found = invoices.find((inv) => {
      const invNum = String(inv.invoiceNumber || '').trim().toLowerCase();
      const invId = String(inv.id || '').trim().toLowerCase();
      const invNumAlpha = invNum.replace(/[^0-9a-z]/g, '');
      const invIdAlpha = invId.replace(/[^0-9a-z]/g, '');

      return (
        invNum === cleanLower ||
        invId === cleanLower ||
        invNumAlpha === cleanAlpha ||
        invIdAlpha === cleanAlpha ||
        invNum.includes(cleanLower) ||
        (cleanAlpha.length >= 3 && invNumAlpha.includes(cleanAlpha)) ||
        (cleanAlpha.length >= 3 && invIdAlpha.includes(cleanAlpha))
      );
    });

    if (found) {
      playInvoiceScanBeep();
      setSearch(found.invoiceNumber);

      // Reset restrictive date/status filters so the scanned invoice is guaranteed visible in the list
      setSelectedMonth('');
      setFromDate('');
      setToDate('');
      setSelectedStatus('all');
      setSelectedCustomerFilter('all');

      // Instantly open the invoice details & print modal!
      setViewInvoice(found);
      setBarcodeScanToast(
        lang === 'ar'
          ? `✓ تم العثور على الفاتورة (${found.invoiceNumber}) للزبون: ${found.customerName}`
          : `✓ Found invoice ${found.invoiceNumber} (${found.customerName})`
      );
      setTimeout(() => setBarcodeScanToast(null), 4500);
    } else {
      setSearch(cleanCode);
      setBarcodeScanToast(
        lang === 'ar'
          ? `⚠️ لا توجد فاتورة تطابق هذا الباركود: ${cleanCode}`
          : `⚠️ No invoice found matching: ${cleanCode}`
      );
      setTimeout(() => setBarcodeScanToast(null), 4500);
    }
  };

  const handleScanInvoiceBarcodeRef = useRef(handleScanInvoiceBarcode);
  handleScanInvoiceBarcodeRef.current = handleScanInvoiceBarcode;

  // Listen for Wireless Smartphone Barcode Scans (Local Wi-Fi & Cloud)
  useEffect(() => {
    let tickCount = 0;
    const interval = setInterval(async () => {
      // 1. Check local PC Wi-Fi endpoint
      try {
        const res = await fetch('/api/remote-barcode');
        if (res.ok) {
          const data = await res.json();
          if (data && data.code) {
            handleScanInvoiceBarcodeRef.current(String(data.code));
          }
        }
      } catch {}

      // 2. Check Firebase cloud barcode node every ~6s (every 4th tick)
      tickCount++;
      if (tickCount % 4 === 0) {
        try {
          const cloudCode = await pullCloudBarcodeScan();
          if (cloudCode) {
            handleScanInvoiceBarcodeRef.current(cloudCode);
          }
        } catch {}
      }
    }, 1500);

    return () => clearInterval(interval);
  }, []);

  // Hardware Barcode Scanner Listener (USB / Bluetooth Barcode Gun)
  useEffect(() => {
    let buffer = '';
    let lastKeyTime = Date.now();

    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement as HTMLElement | null;
      const isSearchInput = activeEl?.id === 'inv-search-id';
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();

      // If user is focused on a text input other than invoice search, don't hijack
      if (tag === 'textarea' || tag === 'select' || (tag === 'input' && !isSearchInput)) return;

      const now = Date.now();
      if (now - lastKeyTime > 160) {
        buffer = '';
      }
      lastKeyTime = now;

      if (e.key === 'Enter') {
        const candidate = isSearchInput ? (search || buffer) : buffer;
        if (candidate.trim().length >= 2) {
          e.preventDefault();
          handleScanInvoiceBarcode(candidate.trim());
          buffer = '';
        }
      } else if (e.key.length === 1 && !isSearchInput) {
        buffer += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [invoices, lang, search]);

  const getSafeItems = (inv: Invoice | null | undefined) => {
    if (!inv) return [];
    if (Array.isArray(inv.items)) return inv.items.filter(Boolean);
    if (typeof inv.items === 'string') {
      try {
        const parsed = JSON.parse(inv.items);
        return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
      } catch {
        return [];
      }
    }
    return [];
  };

  // Calculate net profit for any quick sales invoice or official facture
  const calculateInvoiceProfit = (inv: Invoice): number => {
    if (!inv || inv.status === 'refunded' || (inv as any).isReturn) return 0;
    const safeItems = getSafeItems(inv);
    const returnedList = Array.isArray(inv.returnedItems) ? inv.returnedItems : [];

    let itemsProfit = 0;
    let registeredCount = 0;
    safeItems.forEach((item) => {
      const qty = Number(item.quantity) || 0;
      if (qty <= 0) return;
      const matchedProd = item.productId
        ? products.find((p) => p && p.id === item.productId)
        : undefined;
      // Unregistered product rows (added manually without selecting a registered product) are excluded from profit
      if (!item.productId || (!matchedProd && !(Number(item.purchasePrice) > 0))) {
        return;
      }

      const returnedQty = returnedList
        .filter((r) => r && r.productId === item.productId)
        .reduce((s, r) => s + (Number(r.quantity) || 0), 0);
      const netQty = Math.max(0, qty - returnedQty);
      if (netQty <= 0) return;

      registeredCount++;
      const unitPurchasePrice =
        item.purchasePrice !== undefined && item.purchasePrice !== null && Number(item.purchasePrice) > 0
          ? Number(item.purchasePrice)
          : Number(matchedProd?.purchasePrice) || 0;

      const rawSelling = Number(item.sellingPrice) || 0;
      const discPct = Number(item.discount) || 0;
      const netUnitSelling =
        item.total !== undefined && item.total !== null && qty > 0
          ? Number(item.total) / qty
          : rawSelling * (1 - discPct / 100);

      itemsProfit += (netUnitSelling - unitPurchasePrice) * netQty;
    });

    if (registeredCount === 0) return 0;

    const subtotal = Number(inv.subtotal) || 0;
    const rawDiscount = Number(inv.discount) || 0;
    const tax = Number(inv.tax) || 0;
    const total = Number(inv.total) || 0;

    let generalDiscountVal = rawDiscount;
    if (rawDiscount > 0 && subtotal > 0) {
      const pctDisc = subtotal * (rawDiscount / 100);
      const diffPct = Math.abs(total - (subtotal - pctDisc + tax));
      const diffFlat = Math.abs(total - (subtotal - rawDiscount + tax));
      if (diffPct < diffFlat && rawDiscount <= 100) {
        generalDiscountVal = pctDisc;
      }
    }

    return itemsProfit - generalDiscountVal;
  };

  // Filters
  const filteredInvoices = (invoices || []).filter((inv) => {
    if (!inv) return false;
    const s = search.toLowerCase();
    const invNum = String(inv.invoiceNumber || '').toLowerCase();
    const custName = String(inv.customerName || '').toLowerCase();
    const invNotes = String(inv.notes || '').toLowerCase();
    const matchSearch = invNum.includes(s) || custName.includes(s) || invNotes.includes(s);
    
    const matchStatus =
      selectedStatus === 'all'
        ? true
        : selectedStatus === 'wholesale'
        ? Boolean(inv.isWholesale || inv.pricingMode === 'wholesale')
        : inv.status === selectedStatus;

    const matchCustomer =
      selectedCustomerFilter === 'all' ||
      inv.customerId === selectedCustomerFilter ||
      inv.customerName === selectedCustomerFilter;

    let matchDate = true;
    if (selectedMonth || fromDate || toDate) {
      if (inv.date) {
        const d = new Date(inv.date);
        const invDateTime = d.getTime();
        if (selectedMonth && !isNaN(invDateTime)) {
          const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          if (ym !== selectedMonth) matchDate = false;
        }
        if (fromDate) {
          const start = new Date(`${fromDate}T00:00:00`).getTime();
          if (invDateTime < start) matchDate = false;
        }
        if (toDate) {
          const end = new Date(`${toDate}T23:59:59.999`).getTime();
          if (invDateTime > end) matchDate = false;
        }
      } else {
        matchDate = false;
      }
    }

    return matchSearch && matchStatus && matchCustomer && matchDate;
  });

  const filteredTotalAmount = filteredInvoices.reduce((acc, inv) => acc + (Number(inv.total) || 0), 0);
  const filteredPaidAmount = filteredInvoices.reduce((acc, inv) => acc + (Number(inv.amountPaid) || 0), 0);
  const filteredTotalProfit = filteredInvoices.reduce((acc, inv) => acc + calculateInvoiceProfit(inv), 0);

  const getStatusCapsule = (status: Invoice['status']) => {
    switch (status) {
      case 'paid':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-[11px] font-bold font-sans whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            {t.invoice.paidStatus}
          </span>
        );
      case 'partial':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-[11px] font-bold font-sans whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
            {t.invoice.partialStatus}
          </span>
        );
      case 'unpaid':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-rose-50 text-rose-700 border border-rose-200 rounded-full text-[11px] font-bold font-sans whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
            {t.invoice.unpaidStatus}
          </span>
        );
      case 'refunded':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-purple-50 text-purple-700 border border-purple-200 rounded-full text-[11px] font-bold font-sans whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
            {lang === 'ar' ? 'مسترجعة بالكامل' : 'Refunded'}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 text-slate-700 border border-slate-200 rounded-full text-[11px] font-bold font-sans whitespace-nowrap">
            {status}
          </span>
        );
    }
  };

  const renderProfitBadge = (inv: Invoice) => {
    const profit = calculateInvoiceProfit(inv);
    const isOfficial = String(inv.invoiceNumber || '').toUpperCase().startsWith('FAC-') || String(inv.id || '').startsWith('fac_inv_');
    return (
      <div className="flex flex-wrap items-center justify-center gap-1">
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black font-mono border whitespace-nowrap ${
            profit >= 0
              ? 'bg-emerald-50/90 text-emerald-700 border-emerald-200'
              : 'bg-rose-50/90 text-rose-700 border-rose-200'
          }`}
          title={lang === 'ar' ? 'صافي ربح الفاتورة' : 'Invoice Net Profit'}
        >
          <TrendingUp className="w-3 h-3 shrink-0" />
          <span>{lang === 'ar' ? 'الربح:' : 'Profit:'}</span>
          <span>{profit >= 0 ? `+${profit.toFixed(2)}` : profit.toFixed(2)} {config.currency}</span>
        </span>
        {isOfficial && (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-black bg-indigo-50 text-indigo-700 border border-indigo-200 whitespace-nowrap">
            {lang === 'ar' ? 'فاتورة رسمية' : 'Facture'}
          </span>
        )}
      </div>
    );
  };

  const handleOpenReturn = (inv: Invoice) => {
    setReturningInvoice(inv);
    const initialQty: Record<string, number> = {};
    getSafeItems(inv).forEach((it) => {
      initialQty[it.productId] = 0;
    });
    setReturnQuantities(initialQty);
    setReturnNotes('');
  };

  const handleConfirmReturn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!returningInvoice || !onReturnInvoice) return;
    const safeReturnItems = getSafeItems(returningInvoice);

    const returnList = Object.entries(returnQuantities)
      .filter(([_, qty]) => Number(qty) > 0)
      .map(([productId, quantity]) => {
        const item = safeReturnItems.find((i) => i.productId === productId);
        const itemTotal = Number(item?.total) || 0;
        const itemQty = Number(item?.quantity) || 0;
        const unitPrice = item && itemQty > 0 ? itemTotal / itemQty : Number(item?.sellingPrice) || 0;
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
      const safeViewItems = getSafeItems(viewInvoice);
      const updatedReturned = [
        ...(viewInvoice.returnedItems || []),
        ...returnList.map(it => ({
          productId: it.productId,
          productName: safeViewItems.find(i => i.productId === it.productId)?.productName || it.productId,
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

  const handleOpenEdit = (inv: Invoice) => {
    const safeItems = getSafeItems(inv).map((it) => ({
      productId: it.productId || '',
      productName: it.productName || '',
      quantity: Number(it.quantity) || 1,
      sellingPrice: Number(it.sellingPrice) || 0,
      purchasePrice: it.purchasePrice,
      discount: Number(it.discount) || 0,
      total: Number(it.total) || ((Number(it.sellingPrice) || 0) * (Number(it.quantity) || 1) * (1 - (Number(it.discount) || 0) / 100))
    }));
    setEditingInvoice(inv);
    setEditCustomerId(inv.customerId || '');
    setEditCustomerName(inv.customerName || '');
    setEditItems(safeItems.length > 0 ? safeItems : [{ productId: '', productName: '', quantity: 1, sellingPrice: 0, discount: 0, total: 0 }]);
    setEditDiscount(Number(inv.discount) || 0);
    setEditPreviousBalance(Number(inv.previousBalance) || 0);
    setEditAmountPaid(Number(inv.amountPaid) || 0);
    setEditPaymentMethod(inv.paymentMethod || 'cash');
    setEditNotes(inv.notes || '');
  };

  const handleEditProductSelect = (index: number, productId: string) => {
    const prod = products.find((p) => p.id === productId);
    const updated = [...editItems];
    if (prod) {
      const qty = Number(updated[index].quantity) || 1;
      const disc = Number(updated[index].discount) || 0;
      const price = Number(prod.sellingPrice) || 0;
      updated[index] = {
        ...updated[index],
        productId: prod.id,
        productName: prod.name,
        sellingPrice: price,
        purchasePrice: prod.purchasePrice,
        total: Number((price * qty * (1 - disc / 100)).toFixed(2))
      };
    } else {
      updated[index] = {
        ...updated[index],
        productId: '',
      };
    }
    setEditItems(updated);
  };

  const handleEditItemChange = (index: number, field: keyof SaleItem, value: any) => {
    const updated = [...editItems];
    const current = { ...updated[index], [field]: value };
    const qty = Math.max(0, Number(field === 'quantity' ? value : current.quantity) || 0);
    const price = Math.max(0, Number(field === 'sellingPrice' ? value : current.sellingPrice) || 0);
    const disc = Math.max(0, Math.min(100, Number(field === 'discount' ? value : current.discount) || 0));
    current.total = Number((price * qty * (1 - disc / 100)).toFixed(2));
    updated[index] = current;
    setEditItems(updated);
  };

  const handleAddEditItem = () => {
    setEditItems([...editItems, { productId: '', productName: '', quantity: 1, sellingPrice: 0, discount: 0, total: 0 }]);
  };

  const handleRemoveEditItem = (index: number) => {
    if (editItems.length <= 1) return;
    setEditItems(editItems.filter((_, i) => i !== index));
  };

  const handleSaveEditInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingInvoice || !onEditInvoice) return;

    const validItems = editItems.filter((it) => (it.productName && it.productName.trim() !== '') || it.productId);
    if (validItems.length === 0) {
      alert(lang === 'ar' ? 'يرجى إضافة صنف واحد على الأقل في الفاتورة!' : 'Please include at least one item in the invoice!');
      return;
    }

    const newSubtotal = Number(validItems.reduce((s, it) => s + (Number(it.total) || 0), 0).toFixed(2));
    const discVal = Math.max(0, Number(editDiscount) || 0);
    // Preserve original tax rate behavior if invoice had tax
    const origSubtotal = Number(editingInvoice.subtotal) || 0;
    const origTax = Number(editingInvoice.tax) || 0;
    const hadTax = origTax > 0 && origSubtotal > 0;
    const taxableBase = Math.max(0, newSubtotal - discVal);
    const newTax = hadTax ? Number((taxableBase * ((Number(config.taxRate) || 0) / 100)).toFixed(2)) : 0;
    const newTotal = Number(Math.max(0, taxableBase + newTax).toFixed(2));
    const paid = Math.max(0, Number(editAmountPaid) || 0);
    const prevBal = Math.max(0, Number(editPreviousBalance) || 0);
    const totalPayable = newTotal + prevBal;

    let newStatus: Invoice['status'] = 'unpaid';
    if (editingInvoice.status === 'refunded') {
      newStatus = 'refunded';
    } else if (paid >= totalPayable && totalPayable > 0) {
      newStatus = 'paid';
    } else if (paid > 0) {
      newStatus = 'partial';
    }

    const selectedCustomer = customers.find((c) => c.id === editCustomerId);
    const finalCustomerName = selectedCustomer ? selectedCustomer.name : (editCustomerName.trim() || editingInvoice.customerName);

    const updatedInvoice: Invoice = {
      ...editingInvoice,
      customerId: editCustomerId || undefined,
      customerName: finalCustomerName,
      items: validItems,
      subtotal: newSubtotal,
      discount: discVal,
      tax: newTax,
      total: newTotal,
      previousBalance: prevBal,
      amountPaid: paid,
      paymentMethod: editPaymentMethod,
      status: newStatus,
      notes: editNotes
    };

    onEditInvoice(updatedInvoice);
    if (viewInvoice && viewInvoice.id === updatedInvoice.id) {
      setViewInvoice(updatedInvoice);
    }
    setEditingInvoice(null);
    setReturnSuccessMsg(lang === 'ar' ? 'تم تعديل الفاتورة وتحديث المخزون والحساب بنجاح!' : 'Invoice updated successfully!');
    setTimeout(() => setReturnSuccessMsg(''), 4000);
  };

  const handleOpenDetails = (inv: Invoice) => {
    const safeInv: Invoice = {
      ...inv,
      items: getSafeItems(inv),
      subtotal: Number(inv.subtotal) || 0,
      discount: Number(inv.discount) || 0,
      tax: Number(inv.tax) || 0,
      total: Number(inv.total) || 0,
      amountPaid: Number(inv.amountPaid) || 0,
      previousBalance: inv.previousBalance !== undefined ? Number(inv.previousBalance) || 0 : undefined
    };
    setViewInvoice(safeInv);
    const balance = safeInv.total - safeInv.amountPaid;
    setBalancePayment(balance > 0 ? Number(balance.toFixed(2)) : 0);
  };

  const handleSubmittingPayment = (e: React.FormEvent) => {
    e.preventDefault();
    const paidAmountNum = parseDecimal(balancePayment);
    if (!viewInvoice || paidAmountNum <= 0) return;

    onPayInvoiceBalance(viewInvoice.id, paidAmountNum);
    
    const currentPaid = Number(viewInvoice.amountPaid) || 0;
    const invTotal = Number(viewInvoice.total) || 0;
    const updatedInvoice: Invoice = {
      ...viewInvoice,
      amountPaid: currentPaid + paidAmountNum,
      status: (currentPaid + paidAmountNum >= invTotal) ? 'paid' : 'partial'
    };
    
    setViewInvoice(updatedInvoice);
    setBalancePayment(0);
  };

  // Direct WhatsApp invoice sharing
  const handleWhatsAppShare = (inv: Invoice) => {
    const cust = customers.find(c => c.id === inv.customerId || c.name === inv.customerName);
    const phone = cust?.phone || '';
    let cleanPhone = phone.replace(/[^0-9]/g, '');
    if (cleanPhone.startsWith('06') || cleanPhone.startsWith('07')) {
      cleanPhone = '212' + cleanPhone.slice(1);
    }

    const safeItems = getSafeItems(inv);
    const itemsLines = safeItems.map(it => {
      const qty = Number(it.quantity) || 0;
      const price = Number(it.sellingPrice) || 0;
      return `• ${it.productName || ''} (x${qty}) : ${(price * qty).toFixed(2)} ${config.currency}`;
    }).join('\n');
    const invTotal = Number(inv.total) || 0;
    const invPaid = Number(inv.amountPaid) || 0;
    const prevBal = Number(inv.previousBalance) || 0;
    const remaining = Math.max(0, invTotal - invPaid);

    const message = lang === 'ar'
      ? `*فاتورة مبيعات - ${config.name}*\n` +
        `--------------------------------\n` +
        `رقم الفاتورة: ${inv.invoiceNumber}\n` +
        `الزبون: ${inv.customerName}\n` +
        `التاريخ: ${inv.date ? new Date(inv.date).toLocaleDateString() : ''}\n\n` +
        `*قائمة المواد والمنتجات:*\n${itemsLines}\n\n` +
        `--------------------------------\n` +
        `*مجموع الفاتورة:* ${invTotal.toFixed(2)} ${config.currency}\n` +
        (prevBal > 0 ? `*كريدي قديم / مبلغ سابق:* ${prevBal.toFixed(2)} ${config.currency}\n*المجموع الكلي:* ${(invTotal + prevBal).toFixed(2)} ${config.currency}\n` : '') +
        `*المبلغ المؤدى (المدفوع):* ${invPaid.toFixed(2)} ${config.currency}\n` +
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
        `*Montant Total:* ${invTotal.toFixed(2)} ${config.currency}\n` +
        (prevBal > 0 ? `*Ancien Crédit:* ${prevBal.toFixed(2)} ${config.currency}\n*Total Général:* ${(invTotal + prevBal).toFixed(2)} ${config.currency}\n` : '') +
        `*Montant Payé:* ${invPaid.toFixed(2)} ${config.currency}\n` +
        (remaining > 0 ? `*Reste à payer:* ${remaining.toFixed(2)} ${config.currency}\n` : '') +
        `--------------------------------\n` +
        `Merci de votre confiance!`;

    const waUrl = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(waUrl, '_blank');
  };

  const buildInvoicePdfMeta = (inv: Invoice, mode: 'a4' | '80mm' = 'a4'): PdfDocumentMeta => {
    const cust = customers.find(c => c.id === inv.customerId || c.name === inv.customerName);
    const invTotal = Number(inv.total) || 0;
    const invPaid = Number(inv.amountPaid) || 0;
    const remaining = Math.max(0, invTotal - invPaid);
    const safeItems = getSafeItems(inv);

    return {
      title: mode === '80mm' ? (lang === 'ar' ? 'إيصال مبيعات' : 'Sales Receipt') : (lang === 'ar' ? 'فاتورة مبيعات' : 'Sales Invoice'),
      docNumber: inv.invoiceNumber || '',
      date: inv.date ? new Date(inv.date).toLocaleString('fr-FR') : '',
      storeName: config.name,
      storeAddress: config.address,
      storePhone: config.phone,
      storeEmail: config.email,
      storeRegNumber: config.registrationNumber,
      customerLabel: lang === 'ar' ? 'الزبون:' : 'Customer:',
      customerName: cust?.ice ? `${inv.customerName || ''} (ICE: ${cust.ice})` : (inv.customerName || ''),
      customerPhone: cust?.phone,
      sellerName: inv.sellerName || 'Admin',
      currency: config.currency,
      mode,
      isRTL,
      items: safeItems.map((it) => ({
        name: it.productName || '',
        quantity: Number(it.quantity) || 0,
        unitPrice: Number(it.sellingPrice) || 0,
        discount: Number(it.discount) || 0,
        total: Number(it.total) || 0
      })),
      subtotal: Number(inv.subtotal) || 0,
      discount: Number(inv.discount) || 0,
      tax: Number(inv.tax) || 0,
      total: invTotal,
      previousBalance: Number(inv.previousBalance) || 0,
      amountPaid: invPaid,
      remainingDebt: remaining,
      notes: inv.notes,
      footerText: t.invoice.thankYou || (lang === 'ar' ? 'شكراً لزيارتكم!' : 'Thank you!'),
      a4Theme: config.a4Theme || 'slate',
      receiptTheme: config.receiptTheme || 'classic',
      themeColor: config.printPrimaryColor
    };
  };

  const handleExportInvoicePdf = async (inv: Invoice, mode: 'a4' | '80mm' = 'a4') => {
    const prefix = mode === '80mm' ? 'RECEIPT' : 'INVOICE';
    await exportStructuredPdf(buildInvoicePdfMeta(inv, mode), `${prefix}-${inv.invoiceNumber}.pdf`);
  };

  // Safe In-Page A4 Print layout (Works on iPhone & Desktop without popup blocking)
  const triggerPrintLayout = () => {
    const printContent = document.getElementById('printable-area')?.innerHTML;
    if (!printContent || !viewInvoice) return;

    printHtmlContent(
      {
        html: printContent,
        title: `${viewInvoice.invoiceNumber} - ${config.name}`,
        isRTL,
        mode: 'a4'
      },
      buildInvoicePdfMeta(viewInvoice, 'a4')
    );
  };

  const buildThermalReceiptHtmlString = (inv: Invoice) => {
    return buildUnified80mmReceiptHtml(inv, config, lang, t.invoice.thankYou);
  };

  const triggerPrintThermalReceipt = (invOverride?: Invoice, openPreviewOnly = false) => {
    const rawInv = invOverride || viewInvoice || receiptPreviewInvoice;
    if (!rawInv) return;
    const safeInv: Invoice = {
      ...rawInv,
      items: getSafeItems(rawInv),
      subtotal: Number(rawInv.subtotal) || 0,
      discount: Number(rawInv.discount) || 0,
      tax: Number(rawInv.tax) || 0,
      total: Number(rawInv.total) || 0,
      amountPaid: Number(rawInv.amountPaid) || 0,
      previousBalance: rawInv.previousBalance !== undefined ? Number(rawInv.previousBalance) || 0 : undefined
    };

    if (openPreviewOnly) {
      setReceiptPreviewInvoice(safeInv);
      return;
    }

    const thermalContent = buildThermalReceiptHtmlString(safeInv);
    printHtmlContent(
      {
        html: thermalContent,
        title: `${safeInv.invoiceNumber} - Receipt`,
        isRTL,
        mode: '80mm'
      },
      buildInvoicePdfMeta(safeInv, '80mm')
    );
  };

  return (
    <div className="space-y-4 sm:space-y-6 pb-8" id="invoices-sec">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-100">
        <div>
          <h1 className="text-lg sm:text-2xl font-bold text-slate-800 flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-600 shrink-0" />
            <span>{t.invoice.title}</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            {lang === 'ar'
              ? 'إدارة فواتير المبيعات السريعة والفواتير الرسمية، متابعة الأرباح، والطباعة المباشرة.'
              : 'Search sales receipts, inspect line profits, and manage customer balances.'}
          </p>
        </div>

        {/* Summary KPI Pills + Create New Invoice Button */}
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate('commercial-documents')}
              className="w-full sm:w-auto px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 shrink-0" />
              <span>{lang === 'ar' ? '+ إنشاء فاتورة جديدة' : '+ Nouvelle Facture'}</span>
            </button>
          )}
          <div className="flex-1 sm:flex-initial bg-indigo-50/80 border border-indigo-200 px-3 py-1.5 rounded-xl text-xs font-black text-indigo-800 flex items-center justify-between sm:justify-start gap-1.5">
            <span>{lang === 'ar' ? 'الإجمالي:' : 'Total:'}</span>
            <span className="font-mono">{filteredTotalAmount.toFixed(2)} {config.currency}</span>
          </div>
          <div className="flex-1 sm:flex-initial bg-emerald-50/80 border border-emerald-200 px-3 py-1.5 rounded-xl text-xs font-black text-emerald-800 flex items-center justify-between sm:justify-start gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>{lang === 'ar' ? 'صافي الأرباح:' : 'Net Profit:'}</span>
            <span className="font-mono">{filteredTotalProfit >= 0 ? `+${filteredTotalProfit.toFixed(2)}` : filteredTotalProfit.toFixed(2)} {config.currency}</span>
          </div>
        </div>
      </div>

      {/* Query Filters - Responsive & Wrap-Friendly on iPhone */}
      <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row gap-2.5">
          {/* Search */}
          <div className="relative flex-1 min-w-0">
            <span className={`absolute inset-y-0 ${isRTL ? 'right-3.5' : 'left-3.5'} flex items-center text-slate-400`}>
              <Search className="w-4 h-4 sm:w-5 sm:h-5" />
            </span>
            <input
              id="inv-search-id"
              type="text"
              placeholder={lang === 'ar' ? 'بحث برقم الفاتورة، اسم الزبون، أو مسح الباركود...' : t.invoice.search}
              className={`w-full py-2.5 ${isRTL ? 'pr-10 pl-3' : 'pl-10 pr-3'} bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleScanInvoiceBarcode(search);
                }
              }}
            />
          </div>

          {/* Barcode Camera Scanner Button */}
          <button
            id="btn-scan-inv-barcode"
            type="button"
            onClick={() => setShowBarcodeScannerModal(true)}
            className="px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs shrink-0"
            title={lang === 'ar' ? 'مسح باركود الفاتورة المطبوعة بالكاميرا' : 'Scan printed invoice barcode'}
          >
            <Camera className="w-4 h-4 shrink-0" />
            <ScanBarcode className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">{lang === 'ar' ? 'مسح باركود الفاتورة' : 'Scan Barcode'}</span>
          </button>

          {/* Date Filter Toggle Button */}
          <button
            id="btn-toggle-inv-date"
            type="button"
            onClick={() => setShowDateFilter(!showDateFilter)}
            className={`px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border transition cursor-pointer shrink-0 ${
              showDateFilter || selectedMonth || fromDate || toDate || selectedCustomerFilter !== 'all'
                ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Calendar className="w-4 h-4 shrink-0" />
            <span>{lang === 'ar' ? 'تصفية بالتاريخ / الزبون' : 'Filtrer par Date / Client'}</span>
          </button>
        </div>

        {/* Barcode Scan Result Notification */}
        {barcodeScanToast && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs font-black flex items-center justify-between shadow-2xs animate-fade-in">
            <div className="flex items-center gap-2">
              <ScanBarcode className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{barcodeScanToast}</span>
            </div>
            <button
              type="button"
              onClick={() => setBarcodeScanToast(null)}
              className="text-slate-400 hover:text-slate-600 font-bold px-1.5 py-0.5 rounded cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* Status filters - Wraps cleanly on iPhone so no button is ever cut off */}
        <div className="flex flex-wrap gap-1.5 bg-slate-100 p-1.5 rounded-xl border border-slate-200/60">
          {['all', 'wholesale', 'paid', 'partial', 'unpaid', 'refunded'].map((stat) => (
            <button
              id={`filter-invoice-stat-${stat}`}
              key={stat}
              type="button"
              onClick={() => setSelectedStatus(stat)}
              className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition whitespace-nowrap text-center cursor-pointer ${
                selectedStatus === stat
                  ? 'bg-white text-indigo-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
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

        {showDateFilter && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-2 border-t border-slate-100 text-xs animate-fade-in">
            {/* Customer filter */}
            <div className="flex items-center justify-between gap-2 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200">
              <div className="flex items-center gap-1.5 shrink-0">
                <User className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span className="font-bold text-slate-600">{lang === 'ar' ? 'الزبون:' : 'Client:'}</span>
              </div>
              <select
                value={selectedCustomerFilter}
                onChange={(e) => setSelectedCustomerFilter(e.target.value)}
                className="font-bold text-slate-800 bg-transparent focus:outline-none cursor-pointer truncate max-w-[160px]"
              >
                <option value="all">{lang === 'ar' ? 'جميع الزبائن' : 'Tous les clients'}</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Month picker */}
            <div className="flex items-center justify-between gap-2 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200">
              <div className="flex items-center gap-1.5 shrink-0">
                <Calendar className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span className="font-bold text-slate-600">{lang === 'ar' ? 'الشهر:' : 'Mois:'}</span>
              </div>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => {
                  setSelectedMonth(e.target.value);
                  if (e.target.value) {
                    setFromDate('');
                    setToDate('');
                  }
                }}
                className="font-bold text-slate-800 bg-transparent focus:outline-none cursor-pointer"
              />
            </div>

            {/* From date */}
            <div className="flex items-center justify-between gap-2 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200">
              <span className="font-bold text-slate-600 shrink-0">{lang === 'ar' ? 'من تاريخ:' : 'Du:'}</span>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => {
                  setFromDate(e.target.value);
                  if (e.target.value) setSelectedMonth('');
                }}
                className="font-bold text-slate-800 bg-transparent focus:outline-none cursor-pointer"
              />
            </div>

            {/* To date */}
            <div className="flex items-center justify-between gap-2 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200">
              <span className="font-bold text-slate-600 shrink-0">{lang === 'ar' ? 'إلى تاريخ:' : 'Au:'}</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => {
                  setToDate(e.target.value);
                  if (e.target.value) setSelectedMonth('');
                }}
                className="font-bold text-slate-800 bg-transparent focus:outline-none cursor-pointer"
              />
            </div>

            {(selectedMonth || fromDate || toDate || selectedCustomerFilter !== 'all') && (
              <div className="sm:col-span-2 lg:col-span-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedMonth('');
                    setFromDate('');
                    setToDate('');
                    setSelectedCustomerFilter('all');
                  }}
                  className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl font-bold transition cursor-pointer"
                >
                  {lang === 'ar' ? 'إعادة تعيين الفلاتر' : 'Réinitialiser'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* MOBILE / IPHONE CARDS VIEW (< md) - Clean, full-width cards without horizontal clipping */}
      <div className="md:hidden space-y-3">
        {filteredInvoices.length > 0 ? (
          filteredInvoices.map((inv) => {
            const invTotal = Number(inv.total) || 0;
            const invPaid = Number(inv.amountPaid) || 0;
            const prevBal = Number(inv.previousBalance) || 0;
            const unpaidAmt = Math.max(0, invTotal - invPaid);

            return (
              <div
                key={inv.id}
                className="bg-white rounded-2xl border border-slate-200/90 p-3.5 shadow-2xs space-y-3"
              >
                {/* Row 1: Invoice Number, Customer Name & Date */}
                <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2.5">
                  <div className="space-y-0.5 text-start">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono font-black text-sm text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-100">
                        {inv.invoiceNumber}
                      </span>
                      <span className="font-black text-slate-800 text-xs">{inv.customerName}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 font-mono">
                      {inv.date ? new Date(inv.date).toLocaleString('fr-FR') : ''}
                    </p>
                  </div>

                  {/* Status + Profit near status */}
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {getStatusCapsule(inv.status)}
                    {renderProfitBadge(inv)}
                  </div>
                </div>

                {/* Row 2: Financial Figures */}
                <div className="grid grid-cols-3 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-center text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold block">{t.invoice.total}</span>
                    <span className="font-mono font-black text-slate-900">
                      {invTotal.toFixed(2)} <span className="text-[9px] font-normal">{config.currency}</span>
                    </span>
                    {prevBal > 0 && (
                      <span className="block text-[9px] font-bold text-amber-700 font-mono">
                        +{prevBal.toFixed(2)} {lang === 'ar' ? 'كريدي' : 'Crédit'}
                      </span>
                    )}
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold block">{t.invoice.paid}</span>
                    <span className="font-mono font-bold text-emerald-700">
                      {invPaid.toFixed(2)} <span className="text-[9px] font-normal">{config.currency}</span>
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold block">{t.invoice.remaining}</span>
                    <span className={`font-mono font-bold ${unpaidAmt > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                      {unpaidAmt.toFixed(2)} <span className="text-[9px] font-normal">{config.currency}</span>
                    </span>
                  </div>
                </div>

                {/* Row 3: Action Buttons Grid (Fits cleanly on iPhone) */}
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  <button
                    type="button"
                    onClick={() => handleOpenDetails(inv)}
                    className="flex-1 min-w-[90px] py-2 px-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl border border-indigo-200 text-xs font-black flex items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5 shrink-0" />
                    <span>{lang === 'ar' ? 'التفاصيل' : t.invoice.view}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => triggerPrintThermalReceipt(inv, true)}
                    className="flex-1 min-w-[85px] py-2 px-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>{lang === 'ar' ? 'إيصال' : 'Receipt'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleExportInvoicePdf(inv, 'a4')}
                    className="py-2 px-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl border border-rose-200 text-xs font-black flex items-center justify-center gap-1 transition cursor-pointer"
                  >
                    <FileDown className="w-3.5 h-3.5 shrink-0" />
                    <span>PDF</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleWhatsAppShare(inv)}
                    className="p-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-xl border border-emerald-200 transition cursor-pointer"
                    title="WhatsApp"
                  >
                    <MessageCircle className="w-4 h-4" />
                  </button>

                  {onEditInvoice && (
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(inv)}
                      className="py-2 px-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl border border-blue-200 text-xs font-black flex items-center justify-center gap-1 transition cursor-pointer"
                      title={lang === 'ar' ? 'تعديل الفاتورة' : 'Edit Invoice'}
                    >
                      <Edit className="w-3.5 h-3.5 shrink-0" />
                      <span>{lang === 'ar' ? 'تعديل' : 'Edit'}</span>
                    </button>
                  )}

                  {onReturnInvoice && inv.status !== 'refunded' && (
                    <button
                      type="button"
                      onClick={() => handleOpenReturn(inv)}
                      className="py-2 px-2.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-xl border border-amber-200 text-xs font-bold flex items-center justify-center gap-1 transition cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                      <span>{lang === 'ar' ? 'إرجاع' : 'Return'}</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setDeletingInvoiceId(inv.id)}
                    className="p-2 text-rose-600 bg-rose-50/60 hover:bg-rose-100 rounded-xl border border-rose-200/70 transition cursor-pointer"
                    title={lang === 'ar' ? 'حذف الفاتورة' : 'Delete'}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="bg-white rounded-2xl border border-slate-100 text-center py-12 text-slate-400">
            <Receipt className="w-10 h-10 stroke-[1.2] mx-auto text-slate-300 mb-2" />
            <p className="text-xs font-bold">{lang === 'ar' ? 'لا توجد فواتير مطابقة للبحث' : 'No logged invoices found.'}</p>
          </div>
        )}
      </div>

      {/* DESKTOP TABLE VIEW (md+) */}
      <div className="hidden md:block bg-white border border-slate-100 rounded-2xl shadow-xs overflow-hidden" id="invoices-table-shell">
        <div className="overflow-x-auto">
          <table className="w-full text-right sm:text-inherit">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr className="text-slate-500 text-xs font-bold uppercase text-center">
                <th className="px-3.5 py-2.5 text-start">{t.invoice.number}</th>
                <th className="px-3.5 py-2.5 text-start">{t.invoice.date}</th>
                <th className="px-3.5 py-2.5 text-start">{t.invoice.customer}</th>
                <th className="px-3.5 py-2.5 text-center">{t.invoice.total}</th>
                <th className="px-3.5 py-2.5 text-center">{t.invoice.paid}</th>
                <th className="px-3.5 py-2.5 text-center">{lang === 'ar' ? 'الحالة والربح' : `${t.invoice.status} & Profit`}</th>
                <th className="px-3.5 py-2.5 text-center">{t.invoice.actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs font-semibold">
              {filteredInvoices.length > 0 ? (
                filteredInvoices.map((inv) => {
                  const invTotal = Number(inv.total) || 0;
                  const invPaid = Number(inv.amountPaid) || 0;
                  const prevBal = Number(inv.previousBalance) || 0;

                  return (
                    <tr key={inv.id} className="hover:bg-slate-50/50 transition">
                      <td className="px-3.5 py-2.5 font-mono font-bold text-slate-800 text-start">{inv.invoiceNumber}</td>
                      <td className="px-3.5 py-2.5 text-slate-500 text-start">{inv.date ? new Date(inv.date).toLocaleString('fr-FR') : ''}</td>
                      <td className="px-3.5 py-2.5 text-slate-800 text-start font-bold">{inv.customerName}</td>
                      <td className="px-3.5 py-2.5 text-slate-900 font-black text-center">
                        <div>{invTotal.toFixed(2)} {config.currency}</div>
                        {prevBal > 0 && (
                          <div className="text-[10px] font-bold text-amber-700 font-mono">
                            +{prevBal.toFixed(2)} ({lang === 'ar' ? 'كريدي قديم' : 'Ancien crédit'})
                          </div>
                        )}
                      </td>
                      <td className="px-3.5 py-2.5 text-slate-600 font-bold text-center">{invPaid.toFixed(2)} {config.currency}</td>
                      <td className="px-3.5 py-2.5 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <div className="flex items-center justify-center gap-1.5 flex-wrap">
                            {getStatusCapsule(inv.status)}
                            {renderProfitBadge(inv)}
                          </div>
                          {inv.returnedItems && inv.returnedItems.length > 0 && inv.status !== 'refunded' && (
                            <span className="text-[10px] text-purple-600 font-bold bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-full">
                              {lang === 'ar' ? 'مرتجع جزئي' : 'Partially Returned'}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3.5 py-2.5 text-center">
                        <div className="flex items-center justify-center gap-1.5 flex-wrap">
                          <button
                            id={`view-btn-${inv.id}`}
                            type="button"
                            onClick={() => handleOpenDetails(inv)}
                            className="px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg border border-slate-200 text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                            title={t.invoice.view}
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>{t.invoice.view}</span>
                          </button>
                          {onEditInvoice && (
                            <button
                              id={`edit-btn-${inv.id}`}
                              type="button"
                              onClick={() => handleOpenEdit(inv)}
                              className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg border border-blue-200 text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                              title={lang === 'ar' ? 'تعديل الفاتورة' : 'Edit Invoice'}
                            >
                              <Edit className="w-3.5 h-3.5" />
                              <span>{lang === 'ar' ? 'تعديل' : 'Edit'}</span>
                            </button>
                          )}
                          <button
                            id={`receipt-btn-${inv.id}`}
                            type="button"
                            onClick={() => triggerPrintThermalReceipt(inv, true)}
                            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                            title={lang === 'ar' ? 'معاينة وطباعة إيصال (80mm)' : 'Preview & Print Receipt (80mm)'}
                          >
                            <Printer className="w-3.5 h-3.5 text-emerald-400" />
                            <span>{lang === 'ar' ? 'إيصال' : 'Receipt'}</span>
                          </button>
                          <button
                            id={`pdf-btn-${inv.id}`}
                            type="button"
                            onClick={() => handleExportInvoicePdf(inv, 'a4')}
                            className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg border border-rose-200 text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                            title={lang === 'ar' ? 'تحميل / مشاركة PDF' : 'Save / Share PDF'}
                          >
                            <FileDown className="w-3.5 h-3.5" />
                            <span>PDF</span>
                          </button>
                          <button
                            id={`wa-btn-${inv.id}`}
                            type="button"
                            onClick={() => handleWhatsAppShare(inv)}
                            className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-lg border border-emerald-200 text-xs font-bold flex items-center transition cursor-pointer"
                            title={lang === 'ar' ? 'مشاركة الفاتورة عبر واتساب' : 'Share via WhatsApp'}
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                          </button>
                          {onReturnInvoice && inv.status !== 'refunded' && (
                            <button
                              id={`return-btn-${inv.id}`}
                              type="button"
                              onClick={() => handleOpenReturn(inv)}
                              className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg border border-amber-200 text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                              title={lang === 'ar' ? 'إرجاع مبيعات' : 'Return Items'}
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>{lang === 'ar' ? 'إرجاع' : 'Return'}</span>
                            </button>
                          )}
                          <button
                            id={`delete-btn-${inv.id}`}
                            type="button"
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

      {/* 80mm Thermal Receipt Preview & Print Modal */}
      {receiptPreviewInvoice && createPortal(
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center px-3 z-[110] safe-modal-overlay">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-sm overflow-hidden animate-fade-in flex flex-col max-h-[88vh]">
            <div className="bg-slate-900 text-white p-3.5 flex flex-wrap items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-1.5 font-bold">
                <button
                  type="button"
                  onClick={() => setReceiptPreviewInvoice(null)}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-black rounded-lg border border-slate-700 transition cursor-pointer"
                >
                  <ArrowRight className={`w-3.5 h-3.5 ${isRTL ? '' : 'rotate-180'}`} />
                  <span>{lang === 'ar' ? 'رجوع' : 'Back'}</span>
                </button>
                <span className="text-[11px] font-black truncate">{lang === 'ar' ? 'إيصال المبيعات (80mm)' : 'Receipt (80mm)'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleExportInvoicePdf(receiptPreviewInvoice, '80mm')}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-black rounded-lg transition shrink-0 cursor-pointer shadow-xs"
                >
                  <FileDown className="w-3.5 h-3.5" />
                  <span>PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => triggerPrintThermalReceipt(receiptPreviewInvoice, false)}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-lg transition shrink-0 cursor-pointer shadow-xs"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>{lang === 'ar' ? 'طباعة' : 'Print'}</span>
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 bg-slate-100 flex justify-center">
              <div
                className="w-[72mm] max-w-[72mm] p-3 bg-white shadow-md rounded-md border border-slate-300 text-xs font-bold leading-normal text-black"
                dangerouslySetInnerHTML={{ __html: buildThermalReceiptHtmlString(receiptPreviewInvoice) }}
              />
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-100 shrink-0 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setReceiptPreviewInvoice(null)}
                className="flex-1 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-black rounded-xl text-xs transition cursor-pointer"
              >
                {lang === 'ar' ? 'إغلاق المعاينة' : 'Close Preview'}
              </button>
              <button
                type="button"
                onClick={() => triggerPrintThermalReceipt(receiptPreviewInvoice, false)}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl text-xs transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                <span>{lang === 'ar' ? 'طباعة الإيصال الآن' : 'Print Receipt Now'}</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Details/Print/Payment Modal */}
      {viewInvoice && (() => {
        const custObj = customers.find(c => c.id === viewInvoice.customerId || c.name === viewInvoice.customerName);
        const safeItems = getSafeItems(viewInvoice);
        const invSubtotal = Number(viewInvoice.subtotal) || 0;
        const invDiscount = Number(viewInvoice.discount) || 0;
        const invTax = Number(viewInvoice.tax) || 0;
        const invTotal = Number(viewInvoice.total) || 0;
        const invPaid = Number(viewInvoice.amountPaid) || 0;
        const prevBal = Number(viewInvoice.previousBalance) || 0;
        const billDebt = Math.max(0, invTotal - invPaid);
        const invProfit = calculateInvoiceProfit(viewInvoice);
        const activeA4Theme = A4_PRINT_THEMES[config.a4Theme || 'slate'] || A4_PRINT_THEMES.slate;
        const themePrimary = config.printPrimaryColor || activeA4Theme.primary;

        return createPortal(
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 z-[100] overflow-y-auto safe-modal-overlay" id="invoice-bill-modal">
            <div className="bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden animate-fade-in my-auto text-start">
              
              {/* Modal actions navigation bar */}
              <div className="flex flex-wrap justify-between items-center gap-2 bg-slate-50 px-3 sm:px-6 py-3 border-b border-slate-200 shrink-0">
                <div className="flex items-center gap-2">
                  <button
                    id="back-bill-modal-top"
                    type="button"
                    onClick={() => setViewInvoice(null)}
                    className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer transition shadow-2xs"
                  >
                    <ArrowRight className={`w-4 h-4 ${isRTL ? '' : 'rotate-180'}`} />
                    <span>{lang === 'ar' ? 'رجوع' : lang === 'fr' ? 'Retour' : 'Back'}</span>
                  </button>
                  <span className="font-mono font-bold text-slate-700 text-xs tracking-wider uppercase hidden sm:inline">
                    {lang === 'ar' ? 'معاينة فاتورة مبيعات' : lang === 'fr' ? 'Aperçu Facture de Vente' : 'Sales Invoice Viewer'}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    id="wa-btn-modal"
                    type="button"
                    onClick={() => handleWhatsAppShare(viewInvoice)}
                    className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer transition shadow-xs"
                    title={lang === 'ar' ? 'إرسال الفاتورة عبر واتساب للزبون' : 'Send invoice via WhatsApp'}
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>{lang === 'ar' ? 'واتساب' : 'WhatsApp'}</span>
                  </button>
                  {onEditInvoice && (
                    <button
                      id="edit-btn-modal"
                      type="button"
                      onClick={() => handleOpenEdit(viewInvoice)}
                      className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer transition shadow-xs"
                      title={lang === 'ar' ? 'تعديل هذه الفاتورة' : 'Edit this invoice'}
                    >
                      <Edit className="w-3.5 h-3.5" />
                      <span>{lang === 'ar' ? 'تعديل' : 'Edit'}</span>
                    </button>
                  )}
                  {onReturnInvoice && viewInvoice.status !== 'refunded' && (
                    <button
                      id="return-btn-modal"
                      type="button"
                      onClick={() => handleOpenReturn(viewInvoice)}
                      className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer transition border border-amber-200"
                      title={lang === 'ar' ? 'إرجاع مبيعات من هذه الفاتورة' : 'Return items from this invoice'}
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>{lang === 'ar' ? 'إرجاع' : 'Return'}</span>
                    </button>
                  )}
                  <button
                    id="pdf-invoice-btn"
                    type="button"
                    onClick={() => handleExportInvoicePdf(viewInvoice, 'a4')}
                    className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition shadow-xs"
                    title={lang === 'ar' ? 'حفظ أو مشاركة PDF' : 'Save or Share PDF'}
                  >
                    <FileDown className="w-3.5 h-3.5" />
                    <span>PDF</span>
                  </button>
                  <button
                    id="print-thermal-btn"
                    type="button"
                    onClick={() => triggerPrintThermalReceipt(viewInvoice, false)}
                    className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer transition shadow-xs"
                    title={lang === 'ar' ? 'طباعة إيصال حراري (80mm)' : 'Print Thermal Receipt (80mm)'}
                  >
                    <Printer className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{lang === 'ar' ? 'إيصال (80mm)' : 'Receipt (80mm)'}</span>
                  </button>
                  <button
                    id="print-btn-actual"
                    type="button"
                    onClick={triggerPrintLayout}
                    style={{ backgroundColor: themePrimary }}
                    className="px-2.5 py-1.5 text-white rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer transition shadow-xs"
                    title={lang === 'ar' ? 'طباعة A4' : 'Print A4'}
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>{lang === 'ar' ? 'طباعة A4' : t.invoice.print}</span>
                  </button>
                </div>
              </div>

              {/* Printable Area Body */}
              <div className="p-4 sm:p-8 space-y-6 overflow-y-auto flex-1" id="printable-area">
                {/* Unified Side-by-Side Store & Customer Info Header */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pb-6 border-b" style={{ borderColor: activeA4Theme.border }}>
                  {/* Store Details (Side 1) */}
                  <div className="text-start space-y-1">
                    {config.showLogoOnInvoice !== false && config.logoUrl && (
                      <img
                        src={config.logoUrl}
                        alt="Store Logo"
                        referrerPolicy="no-referrer"
                        className="h-12 object-contain mb-2 bg-slate-50 border border-slate-200 rounded-lg p-1.5"
                      />
                    )}
                    <h2 className="text-xl font-black" style={{ color: themePrimary }}>{config.name}</h2>
                    {config.showAddressOnInvoice !== false && config.address && <p className="text-xs text-slate-600 font-medium">{config.address}</p>}
                    <div className="text-xs text-slate-500 space-y-0.5 pt-1">
                      {config.showPhoneOnInvoice !== false && config.phone && <p>{lang === 'ar' ? 'الهاتف:' : 'Tél:'} {config.phone}</p>}
                      {config.showEmailOnInvoice !== false && config.email && <p>{lang === 'ar' ? 'البريد:' : 'Email:'} {config.email}</p>}
                    </div>
                  </div>

                  {/* Customer & Invoice Meta (Side 2 - symmetrical) */}
                  <div className="text-start sm:text-end space-y-2">
                    <div>
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                        {lang === 'ar' ? 'رقم الفاتورة' : 'Invoice No.'}
                      </span>
                      <h4 className="font-mono text-xl font-black" style={{ color: themePrimary }}>{viewInvoice.invoiceNumber}</h4>
                      <p className="text-xs text-slate-500 mt-1 flex items-center sm:justify-end gap-1 font-semibold">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        {viewInvoice.date ? new Date(viewInvoice.date).toLocaleString('fr-FR') : ''}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-100 sm:border-0 sm:pt-0">
                      <div className="inline-flex items-center gap-1.5 font-black text-slate-900 text-sm flex-wrap sm:justify-end">
                        <User className="w-4 h-4" style={{ color: themePrimary }} />
                        <span>{lang === 'ar' ? 'الزبون :' : 'Client :'}</span>
                        <span style={{ color: themePrimary }}>{viewInvoice.customerName}</span>
                        {custObj?.ice && (
                          <span className="inline-block px-1.5 py-0.5 rounded text-[11px] font-mono font-bold bg-slate-100 text-slate-800 border border-slate-300">
                            ICE: {custObj.ice}
                          </span>
                        )}
                      </div>
                      {config.showPhoneOnInvoice !== false && custObj?.phone && (
                        <p className="text-xs text-slate-600 font-semibold mt-0.5">{custObj.phone}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Items Table */}
                <div className="border rounded-xl overflow-x-auto text-[11px] sm:text-xs" style={{ borderColor: activeA4Theme.border }}>
                  <table className="w-full">
                    <thead style={{ backgroundColor: activeA4Theme.accentBg, borderBottom: `2px solid ${activeA4Theme.border}` }}>
                      <tr style={{ color: themePrimary }} className="font-bold">
                        <th className="px-2 sm:px-4 py-2.5 text-start">{lang === 'ar' ? '#' : 'S.No.'}</th>
                        <th className="px-2 sm:px-4 py-2.5 text-start">{lang === 'ar' ? 'الصنف / المادة' : 'Item Description'}</th>
                        <th className="px-2 sm:px-4 py-2.5 text-center">{lang === 'ar' ? 'الكمية' : 'Qty'}</th>
                        <th className="px-2 sm:px-4 py-2.5 text-center">{lang === 'ar' ? 'السعر' : 'Unit Price'}</th>
                        <th className="px-2 sm:px-4 py-2.5 text-center">{lang === 'ar' ? 'خصم' : 'Disc%'}</th>
                        <th className="px-2 sm:px-4 py-2.5 text-end">{lang === 'ar' ? 'المجموع' : 'Total'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-semibold">
                      {safeItems.map((item, idx) => {
                        const qty = Number(item.quantity) || 0;
                        const sellingPrice = Number(item.sellingPrice) || 0;
                        const disc = Number(item.discount) || 0;
                        const lineTotal = Number(item.total) || sellingPrice * qty;
                        return (
                          <tr key={idx} className="text-slate-700 hover:bg-slate-50/40">
                            <td className="px-2 sm:px-4 py-2.5 text-slate-400 text-start">{idx + 1}</td>
                            <td className="px-2 sm:px-4 py-2.5 text-slate-900 text-start font-bold">{item.productName}</td>
                            <td className="px-2 sm:px-4 py-2.5 text-center font-mono">{qty}</td>
                            <td className="px-2 sm:px-4 py-2.5 text-center font-mono">{sellingPrice.toFixed(2)} {config.currency}</td>
                            <td className="px-2 sm:px-4 py-2.5 text-center text-slate-400 font-mono">{disc > 0 ? `${disc}%` : '-'}</td>
                            <td className="px-2 sm:px-4 py-2.5 text-end font-bold text-slate-900 font-mono whitespace-nowrap">
                              {lineTotal.toFixed(2)} {config.currency}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Summary & Totals */}
                <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pt-4 border-t border-slate-100">
                  <div className="text-xs text-slate-400 max-w-xs space-y-1.5 text-start">
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
                      <span className="text-slate-500 font-bold">{lang === 'ar' ? 'عدد المنتجات' : 'Articles'}</span>
                      <span className="font-mono font-bold">{safeItems.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-bold">{lang === 'ar' ? 'المجموع' : t.pos.subtotal}</span>
                      <span className="font-mono font-bold">{invSubtotal.toFixed(2)} {config.currency}</span>
                    </div>
                    {invDiscount > 0 && (() => {
                      const pctDisc = invSubtotal * (invDiscount / 100);
                      const diffPct = Math.abs(invTotal - (invSubtotal - pctDisc + invTax));
                      const diffFlat = Math.abs(invTotal - (invSubtotal - invDiscount + invTax));
                      const isPercentage = diffPct < diffFlat && invDiscount <= 100;
                      const actualDiscountVal = isPercentage ? pctDisc : invDiscount;
                      return (
                        <div className="flex justify-between text-rose-600 font-bold">
                          <span>{t.pos.discount} {isPercentage ? `(${invDiscount}%)` : ''}</span>
                          <span className="font-mono">-{actualDiscountVal.toFixed(2)} {config.currency}</span>
                        </div>
                      );
                    })()}
                    {invTax > 0 && (
                      <div className="flex justify-between">
                        <span className="text-slate-400">{t.pos.tax} ({config.taxRate}%)</span>
                        <span className="font-mono">{invTax.toFixed(2)} {config.currency}</span>
                      </div>
                    )}
                    <div className="flex justify-between border-t-2 border-slate-200 pt-2 text-base text-slate-900 font-black">
                      <span className="text-base font-black">{prevBal > 0 ? (lang === 'ar' ? 'مجموع الفاتورة' : 'Total Facture') : t.pos.total}</span>
                      <span className="text-xl font-black text-indigo-700 font-mono">{invTotal.toFixed(2)} {config.currency}</span>
                    </div>

                    {prevBal > 0 && (
                      <>
                        <div className="flex justify-between text-amber-800 bg-amber-50/70 px-2.5 py-1.5 rounded-lg border border-amber-200 text-xs font-bold">
                          <span>{lang === 'ar' ? 'كريدي قديم / مبلغ سابق' : 'Ancien Crédit'}</span>
                          <span className="font-mono">+{prevBal.toFixed(2)} {config.currency}</span>
                        </div>
                        <div className="flex justify-between bg-slate-900 text-white px-3 py-2 rounded-xl text-sm font-black">
                          <span>{lang === 'ar' ? 'المجموع الكلي المطلوب' : 'Total Général'}</span>
                          <span className="font-mono text-amber-300 text-base">{(invTotal + prevBal).toFixed(2)} {config.currency}</span>
                        </div>
                      </>
                    )}

                    <div className="flex justify-between text-emerald-700 bg-emerald-50/50 px-2.5 py-1.5 rounded-lg border border-emerald-100 text-xs">
                      <span>{t.invoice.paid}</span>
                      <span className="font-bold font-mono">{invPaid.toFixed(2)} {config.currency}</span>
                    </div>

                    {billDebt > 0 && (
                      <div className="flex justify-between text-rose-700 bg-rose-50/50 px-2.5 py-1.5 rounded-lg border border-rose-100 text-xs">
                        <span>{t.invoice.remaining}</span>
                        <span className="font-bold font-mono">{billDebt.toFixed(2)} {config.currency}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Arrêtée la présente facture clause (Centered) with full written words */}
                {(() => {
                  const totalWithPrev = Number(invTotal || 0) + Number(prevBal || 0);
                  const arWords = amountToWordsAr(totalWithPrev, config.currency);
                  const frWords = amountToWordsFr(totalWithPrev, config.currency);
                  return (
                    <div className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-200 text-xs text-slate-800 font-bold text-center space-y-1.5 shadow-xs">
                      <div className="text-slate-900 font-extrabold text-[12px] leading-relaxed">
                        <span>أوقفت هذه الفاتورة عند مبلغ : </span>
                        <span className="text-indigo-700 font-black">{arWords}</span>
                        <span className="font-mono font-black text-slate-600 text-xs" dir="ltr"> ({totalWithPrev.toFixed(2)} {config.currency})</span>
                      </div>
                      <div className="text-[11px] text-slate-600 font-semibold italic leading-relaxed pt-0.5 border-t border-slate-200/60">
                        <span>Arrêtée la présente facture à la somme de : </span>
                        <span className="text-indigo-700 font-bold not-italic">{frWords}</span>
                        <span className="font-mono font-bold text-slate-500 text-[10.5px]" dir="ltr"> ({totalWithPrev.toFixed(2)} {config.currency})</span>
                      </div>
                    </div>
                  );
                })()}

                {config.showBarcodeOnInvoice !== false && (
                  <div className="flex flex-col items-center justify-center pt-4">
                    <div
                      dangerouslySetInnerHTML={{
                        __html: generateBarcodeSvg(viewInvoice.invoiceNumber, 32)
                      }}
                    />
                  </div>
                )}

                <div className="text-center text-xs text-slate-500 font-bold pt-4 border-t border-slate-100 tracking-wide font-sans">
                  {config.receiptFooterMessage || t.invoice.thankYou}
                </div>
                {config.receiptReturnPolicy && (
                  <div className="text-center text-[10px] text-slate-400 font-medium -mt-3">
                    {config.receiptReturnPolicy}
                  </div>
                )}

                {/* Company Info Footer Strip (Address, Phone, Email, ICE) */}
                <div className="pt-4 border-t border-slate-200 text-center text-[11px] text-slate-600 font-semibold space-y-1">
                  <div className="font-bold text-slate-800 text-xs">{config.name}</div>
                  <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
                    {config.address && <span>{config.address}</span>}
                    {config.phone && <span>{lang === 'ar' ? 'الهاتف:' : 'Tél:'} <b className="font-mono text-slate-800" dir="ltr">{config.phone}</b></span>}
                    {config.email && <span>{lang === 'ar' ? 'البريد:' : 'Email:'} <b className="font-mono text-slate-800">{config.email}</b></span>}
                    {config.registrationNumber && <span>ICE: <b className="font-mono text-slate-800">{config.registrationNumber}</b></span>}
                  </div>
                </div>
              </div>

              {/* Internal Profit Summary Bar (Outside printable-area so it NEVER prints) */}
              <div className="no-print px-4 sm:px-8 py-2.5 bg-emerald-50/60 border-t border-emerald-100 flex items-center justify-between text-xs shrink-0" data-no-print="true">
                <span className="inline-flex items-center gap-1.5 font-bold text-emerald-800">
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                  <span>{lang === 'ar' ? 'صافي ربح الفاتورة (للمعاينة فقط - لا يظهر في الطباعة):' : 'Invoice Net Profit (Internal only - hidden on print):'}</span>
                </span>
                <span className="font-mono font-black text-emerald-700 text-sm">
                  {invProfit >= 0 ? `+${invProfit.toFixed(2)}` : invProfit.toFixed(2)} {config.currency}
                </span>
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

              {/* Bottom Sticky Action Bar with Clean Back Button */}
              <div className="bg-slate-100/90 px-4 py-3 border-t border-slate-200 flex items-center justify-between gap-2 shrink-0">
                <button
                  id="close-bill-modal"
                  type="button"
                  onClick={() => setViewInvoice(null)}
                  className="px-4 py-2 bg-white hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer transition shadow-2xs"
                >
                  <ArrowRight className={`w-4 h-4 ${isRTL ? '' : 'rotate-180'}`} />
                  <span>{lang === 'ar' ? 'رجوع للقائمة' : lang === 'fr' ? 'Retour à la liste' : 'Back to List'}</span>
                </button>
              </div>
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

      {/* EDIT INVOICE MODAL */}
      {editingInvoice && createPortal(
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 z-[110] overflow-y-auto safe-modal-overlay" id="edit-invoice-modal">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden animate-fade-in my-auto text-start">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 bg-blue-600 text-white shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-white/15 rounded-xl">
                  <Edit className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black">
                    {lang === 'ar' ? 'تعديل فاتورة المبيعات' : 'Modifier la Facture de Vente'}
                  </h3>
                  <p className="text-[11px] font-bold text-blue-100 font-mono">
                    {editingInvoice.invoiceNumber} — {editingInvoice.customerName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingInvoice(null)}
                className="p-1.5 hover:bg-white/20 text-white rounded-lg transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveEditInvoice} className="flex-1 overflow-y-auto p-3.5 sm:p-6 space-y-4">
              {/* Customer & Payment Method Row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200/70">
                <div>
                  <label className="block text-[11px] font-black text-slate-700 mb-1">
                    {lang === 'ar' ? 'اختر زبون مسجل' : 'Client enregistré'}
                  </label>
                  <select
                    value={editCustomerId}
                    onChange={(e) => {
                      const cid = e.target.value;
                      setEditCustomerId(cid);
                      const found = customers.find((c) => c.id === cid);
                      if (found) setEditCustomerName(found.name);
                    }}
                    className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">{lang === 'ar' ? '— زبون عابر / كتابة يدوية —' : '— Client passager —'}</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-black text-slate-700 mb-1">
                    {lang === 'ar' ? 'اسم الزبون في الفاتورة' : 'Nom du client'}
                  </label>
                  <input
                    type="text"
                    value={editCustomerName}
                    onChange={(e) => setEditCustomerName(e.target.value)}
                    placeholder={lang === 'ar' ? 'اسم الزبون...' : 'Customer name...'}
                    className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-black text-slate-700 mb-1">
                    {lang === 'ar' ? 'طريقة الدفع' : 'Mode de paiement'}
                  </label>
                  <select
                    value={editPaymentMethod}
                    onChange={(e) => setEditPaymentMethod(e.target.value as any)}
                    className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="cash">{lang === 'ar' ? 'نقداً (Cash)' : 'Espèces (Cash)'}</option>
                    <option value="card">{lang === 'ar' ? 'بطاقة بنكية (Card)' : 'Carte Bancaire'}</option>
                    <option value="transfer">{lang === 'ar' ? 'تحويل بنكي (Transfer)' : 'Virement'}</option>
                    <option value="credit">{lang === 'ar' ? 'آجل / كريدي (Credit)' : 'Crédit'}</option>
                  </select>
                </div>
              </div>

              {/* Items Table (Compact iPhone-friendly layout & Name-only Product Dropdown) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-wide">
                    {lang === 'ar' ? 'قائمة المواد والأسعار' : 'Articles & Prix'}
                  </h4>
                  <button
                    type="button"
                    onClick={handleAddEditItem}
                    className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-black flex items-center gap-1 transition cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{lang === 'ar' ? 'إضافة سطر / مادة' : 'Ajouter ligne'}</span>
                  </button>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-x-auto">
                  <table className="w-full text-xs text-start min-w-[320px] sm:min-w-[580px]">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold text-[10px] sm:text-[11px]">
                      <tr>
                        <th className="py-2 px-1.5 sm:px-2.5 text-start w-[44%] sm:w-[42%]">{lang === 'ar' ? 'الصنف / المادة' : 'Article'}</th>
                        <th className="py-2 px-1 sm:px-2 text-center w-20 sm:w-28">{lang === 'ar' ? 'سعر الوحدة' : 'Prix U.'}</th>
                        <th className="py-2 px-1 sm:px-2 text-center w-14 sm:w-20">{lang === 'ar' ? 'الكمية' : 'Qté'}</th>
                        <th className="py-2 px-1 sm:px-2 text-end w-20 sm:w-28">{lang === 'ar' ? 'المجموع' : 'Total'}</th>
                        <th className="py-2 px-1 text-center w-8"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {editItems.map((it, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/40 align-top">
                          <td className="py-2 px-1.5 sm:px-2.5 space-y-1">
                            <select
                              value={it.productId || ''}
                              onChange={(e) => handleEditProductSelect(idx, e.target.value)}
                              className="w-full px-1.5 sm:px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            >
                              <option value="">{lang === 'ar' ? '— اختر من المخزون أو اكتب بالأسفل —' : '— Choisir produit —'}</option>
                              {products.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name}
                                </option>
                              ))}
                            </select>
                            <input
                              type="text"
                              value={it.productName}
                              onChange={(e) => handleEditItemChange(idx, 'productName', e.target.value)}
                              placeholder={lang === 'ar' ? 'اسم الصنف / البيان...' : 'Désignation...'}
                              className="w-full px-1.5 sm:px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </td>
                          <td className="py-2 px-1 sm:px-2">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={it.sellingPrice}
                              onChange={(e) => handleEditItemChange(idx, 'sellingPrice', sanitizeDecimalInput(e.target.value))}
                              onBlur={(e) => handleEditItemChange(idx, 'sellingPrice', parseDecimal(e.target.value, 0))}
                              className="w-full min-w-[60px] sm:min-w-[85px] px-1 sm:px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-center font-mono font-bold text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </td>
                          <td className="py-2 px-1 sm:px-2">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={it.quantity}
                              onChange={(e) => handleEditItemChange(idx, 'quantity', sanitizeDecimalInput(e.target.value))}
                              onBlur={(e) => handleEditItemChange(idx, 'quantity', Math.max(0.01, parseDecimal(e.target.value, 1)))}
                              className="w-full min-w-[44px] sm:min-w-[64px] px-1 sm:px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-center font-mono font-bold text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </td>
                          <td className="py-2 px-1 sm:px-2 text-end font-mono font-black text-slate-900 pt-3.5 whitespace-nowrap text-[11px] sm:text-xs">
                            {(Number(it.total) || 0).toFixed(2)}
                          </td>
                          <td className="py-2 px-1 text-center pt-3">
                            {editItems.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveEditItem(idx)}
                                className="p-1 text-rose-500 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Financial adjustments: Discount, Previous Balance, Amount Paid, Notes */}
              {(() => {
                const sub = editItems.reduce((s, it) => s + (Number(it.total) || 0), 0);
                const disc = Math.max(0, Number(editDiscount) || 0);
                const origSub = Number(editingInvoice.subtotal) || 0;
                const origTax = Number(editingInvoice.tax) || 0;
                const hadTax = origTax > 0 && origSub > 0;
                const taxBase = Math.max(0, sub - disc);
                const calcTax = hadTax ? taxBase * ((Number(config.taxRate) || 0) / 100) : 0;
                const netTotal = Math.max(0, taxBase + calcTax);
                const prevBal = Math.max(0, Number(editPreviousBalance) || 0);
                const paid = Math.max(0, Number(editAmountPaid) || 0);
                const remaining = Math.max(0, netTotal + prevBal - paid);

                return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200/80">
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-[11px] font-black text-slate-700 mb-1">
                            {lang === 'ar' ? `الخصم (${config.currency})` : `Remise (${config.currency})`}
                          </label>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={editDiscount}
                            onChange={(e) => setEditDiscount(sanitizeDecimalInput(e.target.value) as any)}
                            onBlur={(e) => setEditDiscount(parseDecimal(e.target.value, 0))}
                            className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-black text-amber-800 mb-1">
                            {lang === 'ar' ? 'كريدي قديم / سابق' : 'Ancien crédit'}
                          </label>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={editPreviousBalance}
                            onChange={(e) => setEditPreviousBalance(sanitizeDecimalInput(e.target.value) as any)}
                            onBlur={(e) => setEditPreviousBalance(parseDecimal(e.target.value, 0))}
                            className="w-full px-2.5 py-1.5 bg-amber-50/60 border border-amber-200 rounded-xl text-xs font-mono font-bold text-amber-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-black text-emerald-800 mb-1">
                          {lang === 'ar' ? `المبلغ المدفوع (${config.currency})` : `Montant payé (${config.currency})`}
                        </label>
                        <div className="flex gap-1.5">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={editAmountPaid}
                            onChange={(e) => setEditAmountPaid(sanitizeDecimalInput(e.target.value) as any)}
                            onBlur={(e) => setEditAmountPaid(parseDecimal(e.target.value, 0))}
                            className="flex-1 px-2.5 py-1.5 bg-white border border-emerald-300 rounded-xl text-xs font-mono font-black text-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          />
                          <button
                            type="button"
                            onClick={() => setEditAmountPaid(Number((netTotal + prevBal).toFixed(2)))}
                            className="px-2.5 py-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded-xl text-[11px] font-black transition cursor-pointer shrink-0"
                          >
                            {lang === 'ar' ? 'دفع الكل' : 'Tout payer'}
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-black text-slate-700 mb-1">
                          {lang === 'ar' ? 'ملاحظات الفاتورة' : 'Notes'}
                        </label>
                        <input
                          type="text"
                          value={editNotes}
                          onChange={(e) => setEditNotes(e.target.value)}
                          placeholder={lang === 'ar' ? 'ملاحظات إضافية...' : 'Notes...'}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    {/* Live Summary Box */}
                    <div className="bg-white p-3.5 rounded-xl border border-slate-200 flex flex-col justify-between space-y-2 text-xs font-bold">
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-slate-500">
                          <span>{lang === 'ar' ? 'المجموع:' : 'Sous-total:'}</span>
                          <span className="font-mono">{sub.toFixed(2)} {config.currency}</span>
                        </div>
                        {disc > 0 && (
                          <div className="flex justify-between text-rose-600">
                            <span>{lang === 'ar' ? 'الخصم:' : 'Remise:'}</span>
                            <span className="font-mono">-{disc.toFixed(2)} {config.currency}</span>
                          </div>
                        )}
                        {calcTax > 0 && (
                          <div className="flex justify-between text-slate-500">
                            <span>{lang === 'ar' ? `الضريبة (${config.taxRate}%):` : `TVA (${config.taxRate}%):`}</span>
                            <span className="font-mono">+{calcTax.toFixed(2)} {config.currency}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-slate-900 text-sm font-black border-t border-slate-100 pt-1.5">
                          <span>{lang === 'ar' ? 'صافي الفاتورة:' : 'Total Facture:'}</span>
                          <span className="font-mono text-blue-700">{netTotal.toFixed(2)} {config.currency}</span>
                        </div>
                        {prevBal > 0 && (
                          <div className="flex justify-between text-amber-700">
                            <span>{lang === 'ar' ? 'كريدي قديم:' : 'Ancien crédit:'}</span>
                            <span className="font-mono">+{prevBal.toFixed(2)} {config.currency}</span>
                          </div>
                        )}
                      </div>

                      <div className="border-t border-slate-200 pt-2 space-y-1">
                        <div className="flex justify-between text-emerald-700">
                          <span>{lang === 'ar' ? 'المدفوع:' : 'Payé:'}</span>
                          <span className="font-mono">{paid.toFixed(2)} {config.currency}</span>
                        </div>
                        <div className="flex justify-between text-rose-600 text-sm font-black">
                          <span>{lang === 'ar' ? 'المتبقي (الدين):' : 'Reste à payer:'}</span>
                          <span className="font-mono">{remaining.toFixed(2)} {config.currency}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingInvoice(null)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
                >
                  {t.inventory.cancel}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl text-xs transition cursor-pointer shadow-sm flex items-center gap-1.5"
                >
                  <Save className="w-4 h-4" />
                  <span>{lang === 'ar' ? 'حفظ التعديلات وتحديث الفاتورة' : 'Enregistrer les modifications'}</span>
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

      {/* Barcode Camera Scanner Modal */}
      <CameraBarcodeModal
        isOpen={showBarcodeScannerModal}
        onClose={() => setShowBarcodeScannerModal(false)}
        onScanCode={handleScanInvoiceBarcode}
        lang={lang}
        title={lang === 'ar' ? 'مسح باركود الفاتورة المطبوعة' : 'Scan Printed Invoice Barcode'}
        allowWirelessPcSend={false}
      />
    </div>
  );
}
