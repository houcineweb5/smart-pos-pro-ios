/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { CommercialDocument, CommercialDocType, CommercialDocStatus, Customer, Product, StoreConfig, Language, Invoice, InvoiceItem } from '../types';
import { languages } from '../languages';
import { 
  FileText, Plus, Search, Eye, EyeOff, Printer, Trash2, ArrowRightLeft, CheckCircle2, 
  Calendar, User, AlertCircle, X, Check, RefreshCw, FileCheck, Truck, ClipboardList,
  Edit, ArrowUpRight, Copy, Share2, Receipt, ShoppingCart, FileSpreadsheet, ArrowRight, FileDown, TrendingUp
} from 'lucide-react';
import { parseDecimal, sanitizeDecimalInput } from '../utils/numberInput';
import { printHtmlContent, exportStructuredPdf, buildUnified80mmReceiptHtml, buildStructuredA4Html } from '../utils/printService';
import { amountToWordsAr, amountToWordsFr } from '../utils/numberToWords';
import { generateBarcodeSvg } from '../utils/barcode';

interface CommercialDocumentsProps {
  initialType?: CommercialDocType;
  autoOpenCreateTrigger?: number;
  documents: CommercialDocument[];
  products: Product[];
  customers: Customer[];
  config: StoreConfig;
  onSaveDocument: (doc: CommercialDocument) => void;
  onDeleteDocument: (id: string) => void;
  onConvertToInvoice: (doc: CommercialDocument) => void;
  lang: Language;
}

export default function CommercialDocuments({
  initialType = 'facture',
  autoOpenCreateTrigger = 0,
  documents,
  products,
  customers,
  config,
  onSaveDocument,
  onDeleteDocument,
  onConvertToInvoice,
  lang
}: CommercialDocumentsProps) {
  const t = languages[lang];
  const isRTL = t.direction === 'rtl';

  const [activeType, setActiveType] = useState<CommercialDocType>(initialType);

  useEffect(() => {
    if (initialType) {
      setActiveType(initialType);
    }
  }, [initialType]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedCustomerFilter, setSelectedCustomerFilter] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [viewingDoc, setViewingDoc] = useState<CommercialDocument | null>(null);
  const [receiptPreviewDoc, setReceiptPreviewDoc] = useState<CommercialDocument | null>(null);
  const [showPaymentInOfficialInvoice, setShowPaymentInOfficialInvoice] = useState(false);
  const [editingDoc, setEditingDoc] = useState<CommercialDocument | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Form State for Create / Edit
  const [formCustomerId, setFormCustomerId] = useState<string>('');
  const [formCustomerName, setFormCustomerName] = useState<string>('');
  const [formCustomerPhone, setFormCustomerPhone] = useState<string>('');
  const [formCustomerAddress, setFormCustomerAddress] = useState<string>('');
  const [formDocDate, setFormDocDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [formValidUntil, setFormValidUntil] = useState<string>(
    new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0]
  );
  const [formItems, setFormItems] = useState<{
    productId: string;
    productName: string;
    sellingPrice: number | string;
    purchasePrice: number;
    quantity: number | string;
    discount: number | string;
    tax: number;
    total: number;
  }[]>([]);
  const [formDiscount, setFormDiscount] = useState<string>('0');
  const [formPreviousBalance, setFormPreviousBalance] = useState<string>('');
  const [formNotes, setFormNotes] = useState<string>('');
  const [formPaymentMethod, setFormPaymentMethod] = useState<'cash' | 'card' | 'debt'>('cash');
  const [formAmountPaid, setFormAmountPaid] = useState<string>('');
  const [formPricingMode, setFormPricingMode] = useState<'wholesale' | 'retail'>('wholesale');

  // Product quick search in modal
  const [productSearch, setProductSearch] = useState('');
  const [showProductDropdown, setShowProductDropdown] = useState(false);

  const getProductPriceByMode = (prod: Product, mode: 'wholesale' | 'retail' = formPricingMode): number => {
    if (mode === 'wholesale' && prod.wholesalePrice !== undefined && Number(prod.wholesalePrice) > 0) {
      return Number(prod.wholesalePrice);
    }
    return Number(prod.sellingPrice) || 0;
  };

  const handleSwitchPricingMode = (nextMode: 'wholesale' | 'retail') => {
    setFormPricingMode(nextMode);
    setFormItems((prev) =>
      prev.map((item) => {
        if (!item.productId) return item;
        const prod = products.find((p) => p.id === item.productId);
        if (!prod) return item;
        const nextUnitPrice = getProductPriceByMode(prod, nextMode);
        const qty = parseDecimal(item.quantity, 1);
        const disc = parseDecimal(item.discount, 0);
        return {
          ...item,
          sellingPrice: nextUnitPrice,
          total: (nextUnitPrice - (nextUnitPrice * disc) / 100) * qty,
        };
      })
    );
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const getDocTypeLabel = (type: CommercialDocType) => {
    switch (type) {
      case 'devis':
        return lang === 'ar' ? 'عرض أسعار (Devis)' : 'Devis';
      case 'bon_commande':
        return 'Bon de commande';
      case 'bon_livraison':
        return 'Bon de livraison';
      case 'facture':
        return lang === 'ar' ? 'فاتورة (Facture)' : 'Facture';
    }
  };

  const getDocTypePrefix = (type: CommercialDocType) => {
    switch (type) {
      case 'devis': return 'DEV';
      case 'bon_commande': return 'BC';
      case 'bon_livraison': return 'BL';
      case 'facture': return 'FAC';
    }
  };

  const generateNextDocNumber = (type: CommercialDocType) => {
    const prefix = getDocTypePrefix(type);
    const year = new Date().getFullYear();
    const count = documents.filter(d => d.docType === type).length + 1;
    return `${prefix}-${year}-${String(count).padStart(3, '0')}`;
  };

  const getSafeDocItems = (doc?: CommercialDocument | null) => {
    if (!doc || !Array.isArray(doc.items)) return [];
    return doc.items.filter(Boolean).map((it) => ({
      ...it,
      productId: it.productId || '',
      productName: it.productName || '',
      sellingPrice: Number(it.sellingPrice || 0),
      purchasePrice: Number(it.purchasePrice || 0),
      quantity: Number(it.quantity || 1),
      discount: Number(it.discount || 0),
      tax: Number(it.tax || 0),
      total: Number(it.total !== undefined ? it.total : (Number(it.sellingPrice || 0) * Number(it.quantity || 1))),
    }));
  };

  const calculateDocProfit = (doc: CommercialDocument): number => {
    const safeItems = getSafeDocItems(doc);
    if (safeItems.length === 0) return 0;
    let itemsProfit = 0;
    let registeredCount = 0;
    safeItems.forEach((it) => {
      const qty = Number(it.quantity) || 0;
      if (qty <= 0) return;
      const matchedProd = it.productId
        ? products.find((p) => p && p.id === it.productId)
        : undefined;
      // Unregistered product rows (added manually without selecting a registered product) are excluded from profit
      if (!it.productId || (!matchedProd && !(Number(it.purchasePrice) > 0))) {
        return;
      }
      registeredCount++;
      const unitCost =
        it.purchasePrice !== undefined && it.purchasePrice !== null && Number(it.purchasePrice) > 0
          ? Number(it.purchasePrice)
          : Number(matchedProd?.purchasePrice) || 0;
      const rawSelling = Number(it.sellingPrice) || 0;
      const discPct = Number(it.discount) || 0;
      const netUnitSelling =
        it.total !== undefined && it.total !== null && qty > 0
          ? Number(it.total) / qty
          : rawSelling * (1 - discPct / 100);
      itemsProfit += (netUnitSelling - unitCost) * qty;
    });
    if (registeredCount === 0) return 0;
    const subtotalVal = Number(doc?.subtotal) || 0;
    const rawDiscount = Number(doc?.discount) || 0;
    const itemDiscountsSum = safeItems.reduce(
      (s, it) => s + (Number(it.sellingPrice) || 0) * ((Number(it.discount) || 0) / 100) * (Number(it.quantity) || 0),
      0
    );
    const extraFlatDiscount = Math.max(0, rawDiscount - itemDiscountsSum);
    return itemsProfit - (subtotalVal > 0 ? extraFlatDiscount : 0);
  };

  // Filtered documents
  const filteredDocs = (documents || []).filter(d => {
    if (!d) return false;
    const matchesType = d.docType === activeType;
    const s = search.toLowerCase();
    const matchesSearch = 
      String(d.docNumber || '').toLowerCase().includes(s) ||
      String(d.customerName || '').toLowerCase().includes(s) ||
      (d.customerPhone && String(d.customerPhone).includes(s)) ||
      (d.notes && String(d.notes).toLowerCase().includes(s));
    const matchesStatus = statusFilter === 'all' || d.status === statusFilter;
    const matchesCustomer =
      selectedCustomerFilter === 'all' ||
      d.customerId === selectedCustomerFilter ||
      d.customerName === selectedCustomerFilter;

    let matchesDate = true;
    if (selectedMonth || fromDate || toDate) {
      if (d.date) {
        const docDate = new Date(d.date);
        const ts = docDate.getTime();
        if (selectedMonth && !isNaN(ts)) {
          const ym = `${docDate.getFullYear()}-${String(docDate.getMonth() + 1).padStart(2, '0')}`;
          if (ym !== selectedMonth) matchesDate = false;
        }
        if (fromDate) {
          const start = new Date(`${fromDate}T00:00:00`).getTime();
          if (ts < start) matchesDate = false;
        }
        if (toDate) {
          const end = new Date(`${toDate}T23:59:59.999`).getTime();
          if (ts > end) matchesDate = false;
        }
      } else {
        matchesDate = false;
      }
    }

    return matchesType && matchesSearch && matchesStatus && matchesCustomer && matchesDate;
  });

  const filteredTotalAmount = filteredDocs.reduce((acc, d) => acc + (Number(d.total) || 0), 0);
  const filteredTotalProfit = filteredDocs.reduce((acc, d) => acc + (d.docType === 'facture' ? calculateDocProfit(d) : 0), 0);

  const getStatusBadge = (status: CommercialDocStatus) => {
    switch (status) {
      case 'draft':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200 whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
            {lang === 'ar' ? 'مسودة' : 'Brouillon'}
          </span>
        );
      case 'validated':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
            {lang === 'ar' ? 'مؤكد / ساري' : 'Validé'}
          </span>
        );
      case 'converted':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            {lang === 'ar' ? 'تم التحويل' : 'Converti'}
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
            {lang === 'ar' ? 'ملغى' : 'Annulé'}
          </span>
        );
    }
  };

  // Open Create Form
  const handleOpenCreate = () => {
    setIsCreating(true);
    setEditingDoc(null);
    setFormPricingMode('wholesale');
    setFormCustomerId('');
    setFormCustomerName('');
    setFormCustomerPhone('');
    setFormCustomerAddress('');
    setFormDocDate(new Date().toISOString().split('T')[0]);
    setFormValidUntil(new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0]);
    setFormItems([{
      productId: '',
      productName: '',
      sellingPrice: 0,
      purchasePrice: 0,
      quantity: 1,
      discount: 0,
      tax: 0,
      total: 0
    }]);
    setFormDiscount('0');
    setFormPreviousBalance('');
    setFormNotes('');
    setFormPaymentMethod('cash');
    setFormAmountPaid('');
  };

  useEffect(() => {
    if (autoOpenCreateTrigger > 0) {
      setActiveType('facture');
      handleOpenCreate();
    } else {
      setIsCreating(false);
      setEditingDoc(null);
    }
  }, [autoOpenCreateTrigger]);

  // Open Edit Form
  const handleOpenEdit = (doc: CommercialDocument) => {
    setEditingDoc(doc);
    setIsCreating(false);
    setFormPricingMode(doc.pricingMode === 'retail' || doc.isWholesale === false ? 'retail' : 'wholesale');
    setFormCustomerId(doc.customerId);
    setFormCustomerName(doc.customerName);
    setFormCustomerPhone(doc.customerPhone || '');
    setFormCustomerAddress(doc.customerAddress || '');
    setFormDocDate(doc.date ? doc.date.split('T')[0] : new Date().toISOString().split('T')[0]);
    setFormValidUntil(doc.validUntil ? doc.validUntil.split('T')[0] : '');
    setFormItems(doc.items && doc.items.length > 0 ? [...doc.items].reverse() : [{
      productId: '',
      productName: '',
      sellingPrice: 0,
      purchasePrice: 0,
      quantity: 1,
      discount: 0,
      tax: 0,
      total: 0
    }]);
    setFormDiscount(doc.discount ? String(doc.discount) : '0');
    setFormPreviousBalance(doc.previousBalance ? String(doc.previousBalance) : '');
    setFormNotes(doc.notes || '');
    setFormPaymentMethod(doc.paymentMethod || (doc.amountPaid !== undefined && doc.amountPaid < doc.total ? 'debt' : 'cash'));
    setFormAmountPaid(doc.amountPaid !== undefined ? String(doc.amountPaid) : '');
  };

  const handleSelectCustomer = (cId: string) => {
    setFormCustomerId(cId);
    const found = customers.find(c => c.id === cId);
    if (found) {
      setFormCustomerName(found.name);
      setFormCustomerPhone(found.phone || '');
      if (found.address) {
        setFormCustomerAddress(found.address);
      }
    }
  };

  // Add Item to form (Always placed at the TOP of the list so the latest added item is first)
  const handleAddProductToForm = (prod: Product) => {
    const modePrice = getProductPriceByMode(prod, formPricingMode);
    const existingIndex = formItems.findIndex(i => i.productId === prod.id);
    if (existingIndex >= 0) {
      const existing = formItems[existingIndex];
      const nextQty = parseDecimal(existing.quantity, 1) + 1;
      const unit = parseDecimal(existing.sellingPrice, modePrice);
      const disc = parseDecimal(existing.discount, 0);
      const updatedItem = {
        ...existing,
        quantity: Number.isInteger(nextQty) ? nextQty : Number(nextQty.toFixed(3)),
        total: (unit - (unit * disc / 100)) * nextQty
      };
      // Move to top as the last interacted product
      const copy = formItems.filter((_, idx) => idx !== existingIndex);
      setFormItems([updatedItem, ...copy]);
      setProductSearch('');
      setShowProductDropdown(false);
      return;
    }

    const newItemRow = {
      productId: prod.id,
      productName: prod.name,
      sellingPrice: modePrice,
      purchasePrice: prod.purchasePrice || 0,
      quantity: 1,
      discount: 0,
      tax: 0,
      total: modePrice
    };

    // Remove any completely blank placeholder row when adding a real product, and place latest product at TOP
    const nonEmptyRows = formItems.filter(
      i => Boolean(i.productId || i.productName.trim() || parseDecimal(i.sellingPrice, 0) > 0)
    );
    setFormItems([newItemRow, ...nonEmptyRows]);
    setProductSearch('');
    setShowProductDropdown(false);
  };

  const handleAddCustomItem = () => {
    setFormItems(prev => [
      {
        productId: '',
        productName: '',
        sellingPrice: 0,
        purchasePrice: 0,
        quantity: 1,
        discount: 0,
        tax: 0,
        total: 0
      },
      ...prev
    ]);
  };

  const priceWarnTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const checkItemBelowCostWarning = (itemObj: typeof formItems[number], immediate = false) => {
    if (priceWarnTimeoutRef.current) {
      clearTimeout(priceWarnTimeoutRef.current);
    }
    if (String(itemObj.sellingPrice ?? '').trim() === '') return;

    const triggerCheck = () => {
      const matchedProd = products.find(p => p.id === itemObj.productId);
      const costPrice = Number(itemObj.purchasePrice || matchedProd?.purchasePrice || 0);
      const unitPrice = parseDecimal(itemObj.sellingPrice, 0);
      const disc = parseDecimal(itemObj.discount, 0);
      const effectivePrice = unitPrice - (unitPrice * disc / 100);

      if (costPrice > 0 && effectivePrice < costPrice) {
        const prodTitle = itemObj.productName || matchedProd?.name || (lang === 'ar' ? 'المنتج' : 'Article');
        showToast(
          lang === 'ar'
            ? `⚠️ تنبيه: السعر المدخل للمنتج "${prodTitle}" (${effectivePrice.toFixed(2)} ${config.currency}) أقل من سعر الشراء (${costPrice.toFixed(2)} ${config.currency})!`
            : `⚠️ Attention: Le prix de "${prodTitle}" (${effectivePrice.toFixed(2)} ${config.currency}) est inférieur au prix d'achat (${costPrice.toFixed(2)} ${config.currency})!`
        );
      }
    };

    if (immediate) {
      triggerCheck();
    } else {
      priceWarnTimeoutRef.current = setTimeout(triggerCheck, 650);
    }
  };

  const handleItemChange = (idx: number, field: string, val: any, immediateWarn = false) => {
    const updated = [...formItems];
    if (field === 'productId') {
      const prod = products.find(p => p.id === val);
      if (prod) {
        const modePrice = getProductPriceByMode(prod, formPricingMode);
        const curQty = parseDecimal(updated[idx].quantity, 1);
        const curDisc = parseDecimal(updated[idx].discount, 0);
        const updatedRow = {
          ...updated[idx],
          productId: prod.id,
          productName: prod.name,
          sellingPrice: modePrice,
          purchasePrice: prod.purchasePrice || 0,
          total: (modePrice - (modePrice * curDisc / 100)) * curQty
        };
        updated[idx] = updatedRow;
        // Move selected product row to the top so it stays at the top
        if (idx > 0) {
          setFormItems([updatedRow, ...updated.filter((_, i) => i !== idx)]);
          return;
        }
      } else {
        updated[idx] = {
          ...updated[idx],
          productId: '',
          productName: '',
          sellingPrice: 0,
          purchasePrice: 0,
          total: 0
        };
      }
      setFormItems(updated);
      return;
    }

    const item = { ...updated[idx], [field]: val };
    const price = parseDecimal(item.sellingPrice, 0);
    const qty = parseDecimal(item.quantity, 0);
    const disc = parseDecimal(item.discount, 0);
    item.total = (price - (price * disc / 100)) * qty;
    updated[idx] = item;
    setFormItems(updated);

    if (field === 'sellingPrice' || field === 'discount') {
      checkItemBelowCostWarning(item, immediateWarn);
    }
  };

  const handleRemoveItem = (idx: number) => {
    if (formItems.length <= 1) {
      setFormItems([{
        productId: '',
        productName: '',
        sellingPrice: 0,
        purchasePrice: 0,
        quantity: 1,
        discount: 0,
        tax: 0,
        total: 0
      }]);
      return;
    }
    setFormItems(formItems.filter((_, i) => i !== idx));
  };

  // Calculation totals
  const subtotal = formItems.reduce((sum, item) => sum + (parseDecimal(item.sellingPrice, 0) * parseDecimal(item.quantity, 0)), 0);
  const itemDiscounts = formItems.reduce((sum, item) => sum + (parseDecimal(item.sellingPrice, 0) * (parseDecimal(item.discount, 0) / 100) * parseDecimal(item.quantity, 0)), 0);
  const totalDiscount = itemDiscounts + parseDecimal(formDiscount, 0);
  const taxRate = config.taxRate || 0;
  const taxableTotal = Math.max(0, subtotal - totalDiscount);
  const totalTax = (taxableTotal * taxRate) / 100;
  const netTotal = taxableTotal + totalTax;
  const previousBalanceAmount = activeType === 'facture' ? Math.max(0, parseDecimal(formPreviousBalance, 0)) : 0;
  const grandTotalWithPrevious = netTotal + previousBalanceAmount;

  // Submit form (Save / Update)
  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCustomerName.trim()) {
      alert(lang === 'ar' ? 'الرجاء إدخال اسم الزبون' : 'Veuillez saisir le nom du client');
      return;
    }

    const validItems = formItems
      .map((it) => {
        const matchedProd = it.productId
          ? products.find((p) => p.id === it.productId)
          : undefined;
        const defaultProdPrice = matchedProd ? getProductPriceByMode(matchedProd, formPricingMode) : 0;
        const numPrice = parseDecimal(it.sellingPrice, defaultProdPrice);
        const numQty = parseDecimal(it.quantity, 1);
        const numDisc = parseDecimal(it.discount, 0);
        return {
          ...it,
          productId: matchedProd ? matchedProd.id : '',
          productName: it.productName.trim() || matchedProd?.name || '',
          sellingPrice: numPrice,
          purchasePrice: matchedProd ? Number(it.purchasePrice || matchedProd.purchasePrice || 0) : 0,
          quantity: numQty > 0 ? numQty : 1,
          discount: numDisc,
          total: (numPrice - (numPrice * numDisc / 100)) * (numQty > 0 ? numQty : 1)
        };
      })
      .filter((it) => it.productId || it.productName.trim());

    if (validItems.length === 0) {
      alert(lang === 'ar' ? 'الرجاء إضافة عنصر واحد على الأقل' : 'Veuillez ajouter au moins un article');
      return;
    }

    const docId = editingDoc ? editingDoc.id : `doc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const docNumber = editingDoc ? editingDoc.docNumber : generateNextDocNumber(activeType);

    const resolvedAmountPaid =
      activeType === 'facture'
        ? formPaymentMethod === 'debt'
          ? Math.min(netTotal, Math.max(0, parseDecimal(formAmountPaid, 0)))
          : formAmountPaid.trim() !== ''
          ? Math.min(netTotal, Math.max(0, parseDecimal(formAmountPaid, netTotal)))
          : netTotal
        : netTotal;

    const todayStr = new Date().toISOString().split('T')[0];
    const resolvedDocDate =
      editingDoc && editingDoc.date && editingDoc.date.startsWith(formDocDate)
        ? editingDoc.date
        : formDocDate === todayStr
        ? new Date().toISOString()
        : new Date(formDocDate).toISOString();

    const newDoc: CommercialDocument = {
      id: docId,
      docType: activeType,
      docNumber,
      date: resolvedDocDate,
      validUntil: activeType === 'devis' ? formValidUntil : undefined,
      customerId: formCustomerId || 'walk-in',
      customerName: formCustomerName,
      customerPhone: formCustomerPhone,
      customerAddress: formCustomerAddress,
      items: [...validItems].reverse(),
      subtotal,
      discount: totalDiscount,
      tax: totalTax,
      total: netTotal,
      previousBalance: previousBalanceAmount > 0 ? previousBalanceAmount : undefined,
      amountPaid: resolvedAmountPaid,
      paymentMethod: activeType === 'facture' ? formPaymentMethod : 'cash',
      status: editingDoc ? editingDoc.status : 'validated',
      notes: formNotes,
      convertedTo: editingDoc?.convertedTo,
      convertedFrom: editingDoc?.convertedFrom,
      isWholesale: formPricingMode === 'wholesale',
      pricingMode: formPricingMode
    };

    onSaveDocument(newDoc);
    setIsCreating(false);
    setEditingDoc(null);
    if (activeType === 'facture') {
      showToast(
        lang === 'ar'
          ? `🎉 تم حفظ الفاتورة الرسمية رقم ${docNumber}، وخصم المخزون، وإدراجها في الإحصائيات وسجل الفواتير!`
          : `🎉 Facture officielle ${docNumber} enregistrée, stock déduit et statistiques mises à jour!`
      );
    } else {
      showToast(lang === 'ar' ? `تم حفظ ${getDocTypeLabel(activeType)} رقم ${docNumber} بنجاح` : `${getDocTypeLabel(activeType)} enregistré avec succès`);
    }
  };

  // Conversions Logic:
  // 1. Convert to Bon de Commande
  const handleConvertToBC = (sourceDoc: CommercialDocument) => {
    const nextNumber = generateNextDocNumber('bon_commande');
    const newDoc: CommercialDocument = {
      ...sourceDoc,
      id: `doc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      docType: 'bon_commande',
      docNumber: nextNumber,
      date: new Date().toISOString(),
      status: 'validated',
      notes: `${sourceDoc.notes || ''} (محول من ${getDocTypeLabel(sourceDoc.docType)}: ${sourceDoc.docNumber})`,
      convertedFrom: {
        docType: sourceDoc.docType,
        docId: sourceDoc.id,
        docNumber: sourceDoc.docNumber
      },
      convertedTo: undefined
    };

    // Update source doc
    const updatedSource: CommercialDocument = {
      ...sourceDoc,
      status: 'converted',
      convertedTo: {
        docType: 'bon_commande',
        docId: newDoc.id,
        docNumber: nextNumber
      }
    };

    onSaveDocument(newDoc);
    onSaveDocument(updatedSource);
    setActiveType('bon_commande');
    setViewingDoc(newDoc);
    showToast(lang === 'ar' ? `تم تحويل الوثيقة بنجاح إلى Bon de commande رقم ${nextNumber}` : `Converti avec succès en Bon de Commande ${nextNumber}`);
  };

  // 2. Convert to Bon de Livraison
  const handleConvertToBL = (sourceDoc: CommercialDocument) => {
    const nextNumber = generateNextDocNumber('bon_livraison');
    const newDoc: CommercialDocument = {
      ...sourceDoc,
      id: `doc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      docType: 'bon_livraison',
      docNumber: nextNumber,
      date: new Date().toISOString(),
      status: 'validated',
      notes: `${sourceDoc.notes || ''} (محول من ${getDocTypeLabel(sourceDoc.docType)}: ${sourceDoc.docNumber})`,
      convertedFrom: {
        docType: sourceDoc.docType,
        docId: sourceDoc.id,
        docNumber: sourceDoc.docNumber
      },
      convertedTo: undefined
    };

    const updatedSource: CommercialDocument = {
      ...sourceDoc,
      status: 'converted',
      convertedTo: {
        docType: 'bon_livraison',
        docId: newDoc.id,
        docNumber: nextNumber
      }
    };

    onSaveDocument(newDoc);
    onSaveDocument(updatedSource);
    setActiveType('bon_livraison');
    setViewingDoc(newDoc);
    showToast(lang === 'ar' ? `تم تحويل الوثيقة بنجاح إلى Bon de livraison رقم ${nextNumber}` : `Converti avec succès en Bon de Livraison ${nextNumber}`);
  };

  // 3. Convert to Facture (Creates commercial doc + automatically syncs system invoice, stock, and stats)
  const handleConvertToFacture = (sourceDoc: CommercialDocument) => {
    const nextNumber = generateNextDocNumber('facture');
    const newDoc: CommercialDocument = {
      ...sourceDoc,
      id: `doc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      docType: 'facture',
      docNumber: nextNumber,
      date: new Date().toISOString(),
      amountPaid: sourceDoc.total,
      paymentMethod: 'cash',
      status: 'validated',
      notes: `${sourceDoc.notes || ''} (محول من ${getDocTypeLabel(sourceDoc.docType)}: ${sourceDoc.docNumber})`,
      convertedFrom: {
        docType: sourceDoc.docType,
        docId: sourceDoc.id,
        docNumber: sourceDoc.docNumber
      }
    };

    const updatedSource: CommercialDocument = {
      ...sourceDoc,
      status: 'converted',
      convertedTo: {
        docType: 'facture',
        docId: newDoc.id,
        docNumber: nextNumber
      }
    };

    onSaveDocument(newDoc);
    onSaveDocument(updatedSource);
    onConvertToInvoice(newDoc);
    setActiveType('facture');
    setViewingDoc(newDoc);
    showToast(
      lang === 'ar'
        ? `🎉 تم تحويل الوثيقة إلى فاتورة رسمية رقم ${nextNumber}، وخصم المخزون، وإضافتها للإحصائيات!`
        : `🎉 Converti avec succès en Facture ${nextNumber}, stock déduit et ajouté aux statistiques!`
    );
  };

  const buildDocPdfMeta = (doc: CommercialDocument, mode: 'a4' | '80mm' = 'a4', hidePaymentDetails?: boolean) => {
    const safeItems = getSafeDocItems(doc);
    const subtotalVal = Number(doc?.subtotal || 0);
    const discVal = Number(doc?.discount || 0);
    const taxVal = Number(doc?.tax || 0);
    const totalVal = Number(doc?.total || 0);
    const prevBalVal = Number(doc?.previousBalance || 0);
    const paidVal = doc?.amountPaid !== undefined ? Number(doc.amountPaid) : totalVal;
    const remDebt = doc?.docType === 'facture' ? Math.max(0, totalVal - paidVal) : 0;
    const isFacture = doc?.docType === 'facture';
    const effectiveHidePayment = hidePaymentDetails !== undefined
      ? hidePaymentDetails
      : (isFacture && !showPaymentInOfficialInvoice);

    return {
      title: getDocTypeLabel(doc?.docType || 'facture'),
      docNumberLabel: lang === 'ar' ? 'رقم الوثيقة:' : 'N°:',
      partyLabel: lang === 'ar' ? 'الزبون :' : 'Client :',
      docNumber: doc?.docNumber || '',
      date: doc?.date ? new Date(doc.date).toLocaleString('fr-FR') : '',
      storeName: config.name || 'المتجر',
      storePhone: config.showPhoneOnInvoice !== false ? config.phone : undefined,
      storeEmail: config.showEmailOnInvoice !== false ? config.email : undefined,
      storeAddress: config.showAddressOnInvoice !== false ? config.address : undefined,
      storeRegNumber: config.showTaxNumberOnInvoice !== false ? config.registrationNumber : undefined,
      storeTaxNumber: config.showTaxNumberOnInvoice !== false ? config.taxNumber : undefined,
      storeLogoUrl: config.showLogoOnInvoice !== false ? config.logoUrl : undefined,
      showLogo: config.showLogoOnInvoice !== false,
      showPhone: config.showPhoneOnInvoice !== false,
      showAddress: config.showAddressOnInvoice !== false,
      showEmail: config.showEmailOnInvoice !== false,
      showTaxNumber: config.showTaxNumberOnInvoice !== false,
      showCashier: config.showCashierOnInvoice !== false,
      showBarcode: config.showBarcodeOnInvoice !== false,
      showDebt: config.showDebtOnInvoice !== false,
      customerLabel: lang === 'ar' ? 'الزبون' : 'Client',
      customerName: (() => {
        const matchedCust = customers.find(c => c.id === doc?.customerId || c.name === doc?.customerName);
        return matchedCust?.ice ? `${doc?.customerName || ''} - ICE: ${matchedCust.ice}` : (doc?.customerName || '');
      })(),
      customerPhone: config.showPhoneOnInvoice !== false ? doc?.customerPhone : undefined,
      sellerName: config.showCashierOnInvoice !== false ? (doc?.sellerName || 'admin') : undefined,
      currency: config.currency,
      mode,
      isRTL,
      lang,
      taxRate: config.taxRate,
      items: safeItems.map(it => ({
        name: it.productName,
        quantity: it.quantity,
        unitPrice: Number(it.sellingPrice || 0),
        discount: it.discount,
        total: Number(it.total || 0)
      })),
      subtotal: subtotalVal,
      discount: discVal,
      tax: taxVal,
      total: totalVal,
      previousBalance: prevBalVal,
      amountPaid: paidVal,
      remainingDebt: remDebt,
      hidePaymentDetails: effectiveHidePayment,
      notes: doc?.notes,
      footerText: t.invoice?.thankYou || (lang === 'ar' ? 'شكراً لتعاملكم معنا ومرحباً بكم في أي وقت!' : 'Merci pour votre confiance!'),
      a4Theme: config.a4Theme || 'slate',
      receiptTheme: config.receiptTheme || 'classic',
      themeColor: config.printPrimaryColor
    };
  };

  const handleExportDocPdf = async (doc: CommercialDocument, mode: 'a4' | '80mm' = 'a4', withPayment?: boolean) => {
    try {
      const isFacture = doc.docType === 'facture';
      const hidePay = isFacture ? (withPayment !== undefined ? !withPayment : !showPaymentInOfficialInvoice) : false;
      const meta = buildDocPdfMeta(doc, mode, hidePay);
      const prefix = mode === '80mm' ? 'RECEIPT' : getDocTypePrefix(doc.docType);
      await exportStructuredPdf(meta, `${prefix}-${doc.docNumber}.pdf`);
    } catch (err) {
      console.error('PDF export error:', err);
      showToast(lang === 'ar' ? 'تعذر تصدير ملف PDF، يرجى المحاولة مجدداً' : 'Erreur lors de l\'export PDF');
    }
  };

  const triggerReceipt80mmPrint = (doc: CommercialDocument) => {
    try {
      const safeItems = getSafeDocItems(doc);
      const receiptHtml = buildUnified80mmReceiptHtml(
        {
          invoiceNumber: doc.docNumber,
          date: doc.date,
          customerName: doc.customerName,
          sellerName: doc.sellerName || 'admin',
          docTitle: getDocTypeLabel(doc.docType),
          docNumberLabel: lang === 'ar' ? 'رقم الوثيقة:' : 'N°:',
          partyLabel: lang === 'ar' ? 'الزبون :' : 'Client :',
          items: safeItems.map((it) => ({
            productName: it.productName,
            quantity: it.quantity,
            sellingPrice: it.sellingPrice,
            discount: it.discount,
            total: it.total,
          })),
          subtotal: Number(doc.subtotal || 0),
          discount: Number(doc.discount || 0),
          tax: Number(doc.tax || 0),
          taxRate: config.taxRate,
          total: Number(doc.total || 0),
          amountPaid: doc.amountPaid !== undefined ? Number(doc.amountPaid) : Number(doc.total || 0),
          previousBalance: Number(doc.previousBalance || 0),
        },
        config,
        lang,
        t.invoice?.thankYou || (lang === 'ar' ? 'شكراً لتعاملكم معنا ومرحباً بكم في أي وقت!' : 'Merci pour votre confiance!')
      );
      printHtmlContent(
        {
          title: `Receipt ${doc.docNumber}`,
          html: receiptHtml,
          isRTL,
          mode: '80mm',
        },
        buildDocPdfMeta(doc, '80mm')
      );
    } catch (e) {
      console.error('Receipt print error:', e);
      showToast(lang === 'ar' ? 'تعذر طباعة الإيصال، يرجى المحاولة مجدداً' : 'Erreur lors de l\'impression du ticket');
    }
  };

  const triggerPrint = (targetDoc?: CommercialDocument, withPayment?: boolean) => {
    try {
      const doc = targetDoc || viewingDoc;
      if (!doc) return;
      const isFacture = doc.docType === 'facture';
      const hidePay = isFacture ? (withPayment !== undefined ? !withPayment : !showPaymentInOfficialInvoice) : false;
      const meta = buildDocPdfMeta(doc, 'a4', hidePay);
      // Guarantee identical design between A4 print and PDF by strictly using buildStructuredA4Html
      const a4Html = buildStructuredA4Html(meta);
      printHtmlContent(
        {
          title: `${doc.docNumber} - ${config.name || 'Commercial Document'}`,
          html: a4Html,
          isRTL,
          mode: 'a4'
        },
        meta
      );
    } catch (e) {
      console.error('Print error:', e);
      showToast(lang === 'ar' ? 'تعذر الطباعة، يرجى المحاولة مجدداً' : 'Erreur lors de l\'impression');
    }
  };

  const handleOpenDocDetails = (doc: CommercialDocument) => {
    const safeDoc: CommercialDocument = {
      ...doc,
      items: getSafeDocItems(doc),
      subtotal: Number(doc.subtotal || 0),
      discount: Number(doc.discount || 0),
      tax: Number(doc.tax || 0),
      total: Number(doc.total || 0),
      amountPaid: doc.amountPaid !== undefined ? Number(doc.amountPaid) : Number(doc.total || 0),
      previousBalance: Number(doc.previousBalance || 0),
    };
    setViewingDoc(safeDoc);
  };

  // Full-page Creation & Editing View (Identical to PurchaseEntry / Purchase Invoice)
  if (isCreating || editingDoc) {
    const docNumber = editingDoc ? editingDoc.docNumber : generateNextDocNumber(activeType);

    const getDocVisuals = () => {
      switch (activeType) {
        case 'devis':
          return {
            title: editingDoc 
              ? (lang === 'ar' ? 'تعديل عرض الأسعار' : 'Modifier le Devis')
              : (lang === 'ar' ? 'عرض أسعار جديد (Devis & Proforma)' : 'Nouveau Devis & Proforma'),
            sub: lang === 'ar' 
              ? 'إعداد تقدير مالي وأسعار للزبون مع إمكانية التحويل المباشر لسند طلبية أو فاتورة' 
              : 'Quote estimation with 1-click conversion to purchase order or official invoice',
            icon: FileSpreadsheet,
            iconBg: 'bg-amber-500/10 text-amber-600',
            badgeBg: 'bg-amber-50 text-amber-700 border-amber-200',
            buttonBg: 'bg-amber-600 hover:bg-amber-700'
          };
        case 'bon_commande':
          return {
            title: editingDoc 
              ? (lang === 'ar' ? 'تعديل سند الطلبية' : 'Modifier Bon de commande')
              : (lang === 'ar' ? 'سند طلبية جديد (Bon de commande)' : 'Nouveau Bon de commande'),
            sub: lang === 'ar' 
              ? 'تسجيل وتأكيد طلبية الزبون وحجز المواد وتثبيت الأسعار والكميات المطلوبة' 
              : 'Customer order confirmation, reservation of items and agreed prices',
            icon: ShoppingCart,
            iconBg: 'bg-blue-600/10 text-blue-600',
            badgeBg: 'bg-blue-50 text-blue-700 border-blue-200',
            buttonBg: 'bg-blue-600 hover:bg-blue-700'
          };
        case 'bon_livraison':
          return {
            title: editingDoc 
              ? (lang === 'ar' ? 'تعديل سند التسليم' : 'Modifier Bon de livraison')
              : (lang === 'ar' ? 'سند تسليم جديد (Bon de livraison)' : 'Nouveau Bon de livraison'),
            sub: lang === 'ar' 
              ? 'إثبات خروج وتسليم السلع والبضائع إلى الزبون مع توقيع وملاحظات الاستلام' 
              : 'Delivery voucher, shipment proof and customer delivery discharge',
            icon: Truck,
            iconBg: 'bg-indigo-600/10 text-indigo-600',
            badgeBg: 'bg-indigo-50 text-indigo-700 border-indigo-200',
            buttonBg: 'bg-indigo-600 hover:bg-indigo-700'
          };
        case 'facture':
        default:
          return {
            title: editingDoc 
              ? (lang === 'ar' ? 'تعديل الفاتورة الرسمية' : 'Modifier Facture')
              : (lang === 'ar' ? 'فاتورة بيع رسمية جديدة (Facture officielle)' : 'Nouvelle Facture Officielle'),
            sub: lang === 'ar' 
              ? 'إصدار فاتورة بيع تجارية قانونية مع تفاصيل الضرائب والخصومات والبيانات الجبائية' 
              : 'Official commercial sale invoice with detailed taxes, discounts and fiscal data',
            icon: Receipt,
            iconBg: 'bg-emerald-600/10 text-emerald-600',
            badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
            buttonBg: 'bg-emerald-600 hover:bg-emerald-700'
          };
      }
    };

    const visuals = getDocVisuals();
    const IconComponent = visuals.icon;
    const selectedCust = customers.find(c => c.id === formCustomerId);

    return (
      <div dir={isRTL ? 'rtl' : 'ltr'} className="space-y-4 sm:space-y-6 text-start w-full animate-fade-in">
        {/* Toast Notification via Portal so it is never shifted or clipped */}
        {toastMessage && createPortal(
          <div dir={isRTL ? 'rtl' : 'ltr'} className="fixed inset-x-0 top-16 z-[250] flex justify-center px-4 pointer-events-none">
            <div className={`px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 text-xs sm:text-sm font-black border pointer-events-auto max-w-lg text-center ${
              toastMessage.includes('⚠️')
                ? 'bg-amber-600 text-white border-amber-400'
                : 'bg-emerald-600 text-white border-emerald-400'
            }`}>
              {toastMessage.includes('⚠️') ? (
                <AlertCircle className="w-5 h-5 text-amber-100 shrink-0" />
              ) : (
                <CheckCircle2 className="w-5 h-5 text-white shrink-0" />
              )}
              <span>{toastMessage}</span>
            </div>
          </div>,
          document.body
        )}

        {/* 1. Header Bar with Client Selection & Date & Doc Number */}
        <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-100 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-3.5">
              <div className={`w-11 h-11 rounded-2xl ${visuals.iconBg} flex items-center justify-center shrink-0 shadow-2xs`}>
                <IconComponent className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-lg font-black text-slate-800">
                    {visuals.title}
                  </h1>
                  <span className={`px-2.5 py-0.5 ${visuals.badgeBg} text-xs font-mono font-bold rounded-lg border`}>
                    {docNumber}
                  </span>
                  <span className="px-2.5 py-0.5 bg-slate-100 text-slate-600 text-xs font-medium rounded-lg">
                    {formDocDate}
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  {visuals.sub}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => { setIsCreating(false); setEditingDoc(null); }}
              className="w-full sm:w-auto justify-center px-3.5 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition cursor-pointer flex items-center gap-2 shrink-0 shadow-2xs"
            >
              <ClipboardList className="w-4 h-4 text-indigo-600" />
              <span>{lang === 'ar' ? 'سجل الوثائق التجارية' : 'Registre des documents'}</span>
              <ArrowRight className={`w-3.5 h-3.5 ${isRTL ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {/* Integrated Client Selector & Info */}
          <div className="pt-3 border-t border-slate-100 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
              {/* Client Dropdown - Name ONLY as requested */}
              <div className="sm:col-span-5 flex items-center gap-2">
                <User className="w-4 h-4 text-indigo-600 shrink-0" />
                <div className="flex-1">
                  <select
                    id="doc-customer-select"
                    value={formCustomerId}
                    onChange={(e) => handleSelectCustomer(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                  >
                    <option value="">-- {lang === 'ar' ? 'اختر زبون من القائمة (أو زبون عابر)' : 'Client libre / Saisie manuelle'} --</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Client Name Input */}
              <div className="sm:col-span-4">
                <input
                  type="text"
                  required
                  placeholder={lang === 'ar' ? 'اسم الزبون / المؤسسة...' : 'Nom du client / Entreprise...'}
                  value={formCustomerName}
                  onChange={(e) => setFormCustomerName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                />
              </div>

              {/* Client Phone Input */}
              <div className="sm:col-span-3">
                <input
                  type="text"
                  placeholder={lang === 'ar' ? 'رقم الهاتف (اختياري)...' : 'Téléphone...'}
                  value={formCustomerPhone}
                  onChange={(e) => setFormCustomerPhone(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white font-mono"
                />
              </div>
            </div>

            {/* Address and Dates */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
              {/* Address */}
              <div className="sm:col-span-6">
                <input
                  type="text"
                  placeholder={lang === 'ar' ? 'عنوان الزبون أو المدينة (اختياري)...' : 'Adresse / Ville du client...'}
                  value={formCustomerAddress}
                  onChange={(e) => setFormCustomerAddress(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                />
              </div>

              {/* Doc Date */}
              <div className="sm:col-span-3 flex items-center gap-2">
                <span className="text-[11px] font-bold text-slate-500 shrink-0">{lang === 'ar' ? 'التاريخ:' : 'Date:'}</span>
                <input
                  type="date"
                  required
                  value={formDocDate}
                  onChange={(e) => setFormDocDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white font-mono"
                />
              </div>

              {/* Validity Date for Devis */}
              {activeType === 'devis' && (
                <div className="sm:col-span-3 flex items-center gap-2">
                  <span className="text-[11px] font-bold text-slate-500 shrink-0">{lang === 'ar' ? 'صالح حتى:' : 'Validité:'}</span>
                  <input
                    type="date"
                    value={formValidUntil}
                    onChange={(e) => setFormValidUntil(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white font-mono"
                  />
                </div>
              )}
            </div>

            {selectedCust && selectedCust.debt > 0 && (
              <div className="px-3 py-2 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-700 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{lang === 'ar' ? `تنبيه: هذا الزبون لديه ديون سابقة معلقة بقيمة ${selectedCust.debt.toFixed(2)} ${config.currency}` : `Dette en cours: ${selectedCust.debt.toFixed(2)} ${config.currency}`}</span>
                </div>
                {activeType === 'facture' && (
                  <button
                    type="button"
                    onClick={() => setFormPreviousBalance(selectedCust.debt.toFixed(2))}
                    className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-[11px] font-black transition cursor-pointer shadow-2xs"
                  >
                    {lang === 'ar' ? '+ إضافة للفاتورة ككريدي قديم' : '+ Ajouter comme ancien crédit'}
                  </button>
                )}
              </div>
            )}

            {/* Wholesale vs Retail/Installment Pricing Mode Toggle (Wholesale is Default) */}
            <div className="pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-indigo-50/40 px-3 py-2 rounded-2xl border border-indigo-100/80">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-indigo-600 shrink-0" />
                <span className="text-xs font-black text-slate-800">
                  {lang === 'ar' ? 'خيار البيع (بالجملة / بالتقسيط):' : 'Mode de vente (Gros / Détail):'}
                </span>
              </div>
              <div className="inline-flex items-center bg-white p-1 rounded-xl border border-slate-200 shadow-2xs gap-1.5">
                <button
                  type="button"
                  onClick={() => handleSwitchPricingMode('wholesale')}
                  className={`px-4 py-1.5 rounded-lg text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${
                    formPricingMode === 'wholesale'
                      ? 'bg-amber-500 text-white shadow-xs'
                      : 'text-slate-600 hover:text-amber-700 hover:bg-amber-50'
                  }`}
                >
                  <span>{lang === 'ar' ? 'البيع بالجملة (الافتراضي)' : 'Vente en Gros (Par défaut)'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSwitchPricingMode('retail')}
                  className={`px-4 py-1.5 rounded-lg text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${
                    formPricingMode === 'retail'
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-purple-700 hover:bg-purple-50'
                  }`}
                >
                  <span>{lang === 'ar' ? 'البيع بالتقسيط' : 'Vente au Détail / Facilité'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Main Document Form */}
        <form onSubmit={handleSubmitForm} className="space-y-6">
          {/* 2. Quick Barcode / Product Search Card (Placed ABOVE Items Table as in PurchaseEntry) */}
          <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-100 shadow-xs space-y-3 relative">
            <div className="flex flex-wrap justify-between items-center gap-2">
              <label className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                <Search className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>{lang === 'ar' ? '🔍 مسح الباركود أو البحث السريع لإضافة منتج للجدول أدناه (يُضاف في الأعلى)' : '🔍 Scan SKU or Search to Add Product to Table Below'}</span>
              </label>
              <button
                type="button"
                onClick={handleAddCustomItem}
                className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 transition cursor-pointer flex items-center gap-1 whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5 shrink-0" />
                <span>{lang === 'ar' ? 'إضافة سطر مادة (منتج غير مسجل - لا يدخل في الأرباح)' : 'Ajouter ligne non enregistrée (hors bénéfice)'}</span>
              </button>
            </div>

            <div className="relative">
              <span className={`absolute inset-y-0 ${isRTL ? 'right-3' : 'left-3'} flex items-center text-slate-400 pointer-events-none`}>
                <Search className="w-4 h-4" />
              </span>
              <input
                type="text"
                placeholder={lang === 'ar' ? 'اكتب اسم المنتج أو امسح الباركود (SKU) للإضافة المباشرة في الأعلى...' : 'Type product name or scan SKU...'}
                value={productSearch}
                onChange={(e) => {
                  setProductSearch(e.target.value);
                  setShowProductDropdown(true);
                }}
                onFocus={() => setShowProductDropdown(true)}
                className={`w-full py-3 ${isRTL ? 'pr-10 pl-9' : 'pl-10 pr-9'} bg-slate-50 border border-slate-300 rounded-xl text-sm font-extrabold text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition`}
              />
              {productSearch && (
                <button
                  type="button"
                  onClick={() => {
                    setProductSearch('');
                    setShowProductDropdown(false);
                  }}
                  className={`absolute inset-y-0 ${isRTL ? 'left-3' : 'right-3'} flex items-center text-slate-500 hover:text-slate-800`}
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Instant Search Dropdown */}
            {showProductDropdown && productSearch.trim().length > 0 && (
              <div className="absolute z-30 top-full left-5 right-5 mt-1 bg-white rounded-2xl shadow-2xl border-2 border-indigo-200 overflow-hidden max-h-64 overflow-y-auto animate-fade-in divide-y divide-slate-100">
                {products
                  .filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase()) || (p.sku && p.sku.toLowerCase().includes(productSearch.toLowerCase())))
                  .slice(0, 10)
                  .map((p) => {
                    const activeProdPrice = getProductPriceByMode(p, formPricingMode);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleAddProductToForm(p)}
                        className="w-full px-4 py-3 hover:bg-indigo-50 flex items-center justify-between text-start transition cursor-pointer"
                      >
                        <div className="space-y-1">
                          <span className="font-black text-sm text-slate-900 block">{p.name}</span>
                          <div className="flex flex-wrap items-center gap-2 text-xs font-extrabold text-slate-700 mt-0.5">
                            <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded-md font-mono font-bold">SKU: {p.sku || 'N/A'}</span>
                            {p.category && <span className="text-slate-700 font-bold">• {p.category}</span>}
                            <span className={`px-2 py-0.5 rounded-md font-extrabold ${p.stock <= 0 ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>
                              {lang === 'ar' ? `المخزون المتوفر: ${p.stock}` : `Stock: ${p.stock}`}
                            </span>
                          </div>
                        </div>
                        <div className="text-end shrink-0 ms-3">
                          <span className="font-mono font-black text-sm text-indigo-700 block">{activeProdPrice.toFixed(2)} {config.currency}</span>
                          <span className="block text-[11px] text-slate-600 font-extrabold">
                            {formPricingMode === 'wholesale'
                              ? (lang === 'ar' ? 'سعر الجملة' : 'Prix de gros')
                              : (lang === 'ar' ? 'سعر التقسيط' : 'Prix détail')}
                          </span>
                        </div>
                      </button>
                    );
                  })}
              </div>
            )}
          </div>

          {/* 3. Items Table Card */}
          <div className="bg-white p-4 sm:p-6 rounded-3xl border border-slate-100 shadow-xs space-y-4">
            <div className="flex flex-wrap justify-between items-center gap-2.5">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm font-black text-slate-800 flex items-center gap-2">
                  <span>{lang === 'ar' ? 'قائمة المواد والأسعار' : 'Articles & Prestations'}</span>
                  <span className="px-2.5 py-0.5 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-full border border-indigo-100 whitespace-nowrap shrink-0">
                    {formItems.length} {lang === 'ar' ? 'مواد' : 'items'}
                  </span>
                </h2>
                <div className="inline-flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 gap-1">
                  <button
                    type="button"
                    onClick={() => handleSwitchPricingMode('wholesale')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-black transition cursor-pointer ${
                      formPricingMode === 'wholesale'
                        ? 'bg-amber-500 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-amber-700'
                    }`}
                  >
                    {lang === 'ar' ? 'بيع بالجملة' : 'Gros'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSwitchPricingMode('retail')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-black transition cursor-pointer ${
                      formPricingMode === 'retail'
                        ? 'bg-purple-600 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-purple-700'
                    }`}
                  >
                    {lang === 'ar' ? 'بيع بالتقسيط' : 'Détail'}
                  </button>
                </div>
              </div>
              <button
                type="button"
                onClick={handleAddCustomItem}
                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-xs whitespace-nowrap shrink-0"
              >
                <Plus className="w-4 h-4 shrink-0" />
                <span>{lang === 'ar' ? 'إضافة سطر مادة (غير مسجل - بدون ربح)' : 'Ajouter ligne non enregistrée'}</span>
              </button>
            </div>

            {/* MOBILE / IPHONE ITEMS CARDS (< md) */}
            <div className="md:hidden space-y-3">
              {formItems.map((item, idx) => {
                const matchedProd = products.find(p => p.id === item.productId);
                const isUnregisteredItem = !item.productId;
                const itemPurchasePrice = Number(item.purchasePrice || matchedProd?.purchasePrice || 0);
                const unitPriceVal = parseDecimal(item.sellingPrice, 0);
                const discVal = parseDecimal(item.discount, 0);
                const effectiveUnitPrice = unitPriceVal - (unitPriceVal * discVal / 100);
                const isBelowPurchasePrice =
                  !isUnregisteredItem &&
                  String(item.sellingPrice ?? '').trim() !== '' &&
                  itemPurchasePrice > 0 &&
                  effectiveUnitPrice < itemPurchasePrice;

                return (
                  <div
                    key={idx}
                    className={`p-3.5 rounded-2xl border space-y-2.5 shadow-2xs ${
                      isBelowPurchasePrice
                        ? 'bg-amber-50/40 border-amber-300'
                        : 'bg-slate-50/70 border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded-md text-[10px] font-black">
                        #{idx + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        className="p-1.5 text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg border border-rose-200 transition cursor-pointer"
                        title="Delete row"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <select
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-extrabold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      value={item.productId}
                      onChange={(e) => handleItemChange(idx, 'productId', e.target.value)}
                    >
                      <option value="">-- {lang === 'ar' ? 'منتج غير مسجل (إدخال يدوي - بدون ربح)' : 'Produit non enregistré (hors bénéfices)'} --</option>
                      {products.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({getProductPriceByMode(p, formPricingMode).toFixed(2)} {config.currency})
                        </option>
                      ))}
                    </select>

                    <input
                      type="text"
                      required
                      placeholder={lang === 'ar' ? 'اسم المنتج أو الصنف...' : 'Product / item name...'}
                      className="w-full bg-white border border-indigo-300 rounded-xl px-3 py-2 text-xs font-extrabold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      value={item.productName}
                      onChange={(e) => handleItemChange(idx, 'productName', e.target.value)}
                    />

                    {isUnregisteredItem && (
                      <div className="px-2.5 py-1 bg-slate-100 border border-slate-200 rounded-lg text-[10px] font-bold text-slate-600">
                        {lang === 'ar' ? 'ℹ️ مادة غير مسجلة في المخزون (لا تدخل في حساب الأرباح)' : 'ℹ️ Article non enregistré (exclu des bénéfices)'}
                      </div>
                    )}

                    {isBelowPurchasePrice && (
                      <div className="px-2.5 py-1 bg-amber-50 border border-amber-200 rounded-lg text-[10px] font-bold text-amber-800 flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span>
                          {lang === 'ar'
                            ? `تنبيه: السعر (${effectiveUnitPrice.toFixed(2)} ${config.currency}) أقل من سعر الشراء (${itemPurchasePrice.toFixed(2)} ${config.currency})`
                            : `Attention: Prix inférieur au prix d'achat (${itemPurchasePrice.toFixed(2)} ${config.currency})`}
                        </span>
                      </div>
                    )}

                    <div className="grid grid-cols-3 gap-2 pt-1">
                      <div>
                        <label className="block text-[10px] font-black text-slate-600 mb-1 text-center">
                          {lang === 'ar' ? `السعر (${config.currency})` : 'Prix'}
                        </label>
                        <input
                          type="text"
                          inputMode="decimal"
                          placeholder="0.00"
                          required
                          onFocus={(e) => e.target.select()}
                          className={`w-full border rounded-xl px-2 py-2 text-xs font-black font-mono text-center focus:outline-none focus:ring-2 ${
                            isBelowPurchasePrice
                              ? 'bg-amber-50 border-amber-400 text-rose-700 focus:ring-rose-500'
                              : 'bg-white border-slate-300 text-slate-900 focus:ring-indigo-500'
                          }`}
                          value={item.sellingPrice === undefined || item.sellingPrice === null ? '' : item.sellingPrice}
                          onChange={(e) => handleItemChange(idx, 'sellingPrice', sanitizeDecimalInput(e.target.value))}
                          onBlur={(e) => handleItemChange(idx, 'sellingPrice', sanitizeDecimalInput(e.target.value), true)}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-slate-600 mb-1 text-center">
                          {lang === 'ar' ? 'الكمية' : 'Qté'}
                        </label>
                        <input
                          type="text"
                          inputMode="decimal"
                          placeholder="1"
                          required
                          onFocus={(e) => e.target.select()}
                          className="w-full bg-white border border-slate-300 rounded-xl px-2 py-2 text-xs font-black font-mono text-center text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          value={item.quantity === undefined || item.quantity === null ? '' : item.quantity}
                          onChange={(e) => handleItemChange(idx, 'quantity', sanitizeDecimalInput(e.target.value))}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-slate-600 mb-1 text-center">
                          {lang === 'ar' ? 'خصم %' : 'Remise %'}
                        </label>
                        <input
                          type="text"
                          inputMode="decimal"
                          placeholder="0"
                          onFocus={(e) => e.target.select()}
                          className="w-full bg-white border border-slate-300 rounded-xl px-2 py-2 text-xs font-black font-mono text-center text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          value={item.discount === undefined || item.discount === null ? '' : item.discount}
                          onChange={(e) => handleItemChange(idx, 'discount', sanitizeDecimalInput(e.target.value))}
                          onBlur={(e) => handleItemChange(idx, 'discount', sanitizeDecimalInput(e.target.value), true)}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-200/80 text-xs">
                      <span className="font-bold text-slate-600">{lang === 'ar' ? 'مجموع السطر:' : 'Total ligne:'}</span>
                      <span className="font-mono font-black text-indigo-700 text-sm">
                        {item.total.toFixed(2)} {config.currency}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* DESKTOP ITEMS TABLE (md+) */}
            <div className="hidden md:block border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[340px] sm:min-w-[640px] text-xs text-start">
                  <thead className="bg-slate-50 text-slate-700 font-extrabold uppercase text-[11px] sm:text-xs border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 sm:py-3 px-1.5 sm:px-4 text-start min-w-[160px] sm:min-w-[230px]">{lang === 'ar' ? 'المادة / الصنف' : 'Désignation'}</th>
                      <th className="py-2.5 sm:py-3 px-1 sm:px-4 text-center min-w-[82px] sm:min-w-[120px] w-24 sm:w-36">{lang === 'ar' ? `سعر الوحدة (${config.currency})` : `Prix Unitaire (${config.currency})`}</th>
                      <th className="py-2.5 sm:py-3 px-1 sm:px-4 text-center min-w-[68px] sm:min-w-[105px] w-20 sm:w-32">{lang === 'ar' ? 'الكمية' : 'Quantité'}</th>
                      <th className="py-2.5 sm:py-3 px-1 sm:px-4 text-center min-w-[50px] sm:min-w-[80px] w-14 sm:w-24">{lang === 'ar' ? 'خصم %' : 'Remise %'}</th>
                      <th className="py-2.5 sm:py-3 px-1.5 sm:px-4 text-end min-w-[76px] sm:min-w-[105px] w-22 sm:w-36">{lang === 'ar' ? `المجموع (${config.currency})` : `Total (${config.currency})`}</th>
                      <th className="py-2.5 sm:py-3 px-1 sm:px-2 text-center w-8 sm:w-12"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {formItems.map((item, idx) => {
                      const matchedProd = products.find(p => p.id === item.productId);
                      const isUnregisteredItem = !item.productId;
                      const itemPurchasePrice = Number(item.purchasePrice || matchedProd?.purchasePrice || 0);
                      const unitPriceVal = parseDecimal(item.sellingPrice, 0);
                      const discVal = parseDecimal(item.discount, 0);
                      const effectiveUnitPrice = unitPriceVal - (unitPriceVal * discVal / 100);
                      const isBelowPurchasePrice =
                        !isUnregisteredItem &&
                        String(item.sellingPrice ?? '').trim() !== '' &&
                        itemPurchasePrice > 0 &&
                        effectiveUnitPrice < itemPurchasePrice;

                      return (
                        <tr key={idx} className={`transition ${isBelowPurchasePrice ? 'bg-amber-50/30 hover:bg-amber-50/50' : 'hover:bg-slate-50/50'}`}>
                          <td className="py-2.5 sm:py-3 px-1.5 sm:px-4">
                            <div className="space-y-1.5">
                              <select
                                className="w-full min-w-[152px] sm:min-w-[210px] bg-slate-50 border border-slate-300 rounded-xl px-2 sm:px-3 py-1.5 sm:py-2 text-xs font-extrabold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                                value={item.productId}
                                onChange={(e) => handleItemChange(idx, 'productId', e.target.value)}
                              >
                                <option value="" className="font-bold text-slate-900">-- {lang === 'ar' ? 'منتج غير مسجل (إدخال يدوي - لا يدخل في الأرباح)' : 'Produit non enregistré (hors bénéfices)'} --</option>
                                {products.map(p => (
                                  <option key={p.id} value={p.id} className="font-bold text-slate-900">
                                    {p.name} ({getProductPriceByMode(p, formPricingMode).toFixed(2)} {config.currency})
                                  </option>
                                ))}
                              </select>
                              <input
                                type="text"
                                required
                                placeholder={lang === 'ar' ? 'اسم المنتج أو الصنف (قابل للتعديل)...' : 'Product / item name (editable)...'}
                                className="w-full min-w-[152px] sm:min-w-[210px] bg-white border border-indigo-300 rounded-xl px-2.5 sm:px-3 py-2 text-xs sm:text-sm font-extrabold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                value={item.productName}
                                onChange={(e) => handleItemChange(idx, 'productName', e.target.value)}
                              />
                              {isUnregisteredItem && (
                                <div className="px-2.5 py-1 bg-slate-100 border border-slate-200 rounded-lg text-[10px] font-bold text-slate-600 flex items-center gap-1.5 text-start">
                                  <span>{lang === 'ar' ? 'ℹ️ مادة غير مسجلة في المخزون (لا تدخل في حساب الأرباح)' : 'ℹ️ Article non enregistré (exclu du calcul des bénéfices)'}</span>
                                </div>
                              )}
                              {isBelowPurchasePrice && (
                                <div className="px-2.5 py-1 bg-amber-50 border border-amber-200 rounded-lg text-[10px] font-bold text-amber-800 flex items-center gap-1.5 text-start">
                                  <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                  <span>
                                    {lang === 'ar'
                                      ? `تنبيه: السعر (${effectiveUnitPrice.toFixed(2)} ${config.currency}) أقل من سعر الشراء (${itemPurchasePrice.toFixed(2)} ${config.currency})`
                                      : `Attention: Prix (${effectiveUnitPrice.toFixed(2)} ${config.currency}) inférieur au prix d'achat (${itemPurchasePrice.toFixed(2)} ${config.currency})`}
                                  </span>
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 sm:py-3 px-1 sm:px-4 text-center align-top">
                            <input
                              type="text"
                              inputMode="decimal"
                              placeholder="0.00"
                              required
                              onFocus={(e) => e.target.select()}
                              className={`w-full min-w-[76px] sm:min-w-[104px] border rounded-xl px-1.5 sm:px-3 py-2 sm:py-2.5 text-xs sm:text-sm font-black font-mono text-center focus:outline-none focus:ring-2 placeholder:text-slate-300 placeholder:font-normal ${
                                isBelowPurchasePrice
                                  ? 'bg-amber-50 border-amber-400 text-rose-700 focus:ring-rose-500'
                                  : 'bg-slate-50 border-slate-300 text-slate-900 focus:ring-indigo-500 focus:bg-white'
                              }`}
                              value={item.sellingPrice === undefined || item.sellingPrice === null ? '' : item.sellingPrice}
                              onChange={(e) => handleItemChange(idx, 'sellingPrice', sanitizeDecimalInput(e.target.value))}
                              onBlur={(e) => handleItemChange(idx, 'sellingPrice', sanitizeDecimalInput(e.target.value), true)}
                            />
                          </td>
                          <td className="py-2.5 sm:py-3 px-1 sm:px-4 text-center align-top">
                            <input
                              type="text"
                              inputMode="decimal"
                              placeholder="1"
                              required
                              onFocus={(e) => e.target.select()}
                              className="w-full min-w-[62px] sm:min-w-[92px] bg-slate-50 border border-slate-300 rounded-xl px-1.5 sm:px-3 py-2 sm:py-2.5 text-xs sm:text-sm font-black font-mono text-center text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white placeholder:text-slate-300 placeholder:font-normal"
                              value={item.quantity === undefined || item.quantity === null ? '' : item.quantity}
                              onChange={(e) => handleItemChange(idx, 'quantity', sanitizeDecimalInput(e.target.value))}
                            />
                          </td>
                          <td className="py-2.5 sm:py-3 px-1 sm:px-4 text-center align-top">
                            <input
                              type="text"
                              inputMode="decimal"
                              placeholder="0"
                              onFocus={(e) => e.target.select()}
                              className="w-full min-w-[46px] sm:min-w-[68px] bg-slate-50 border border-slate-300 rounded-xl px-1 sm:px-2.5 py-2 sm:py-2.5 text-xs sm:text-sm font-black font-mono text-center text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white placeholder:text-slate-300 placeholder:font-normal"
                              value={item.discount === undefined || item.discount === null ? '' : item.discount}
                              onChange={(e) => handleItemChange(idx, 'discount', sanitizeDecimalInput(e.target.value))}
                              onBlur={(e) => handleItemChange(idx, 'discount', sanitizeDecimalInput(e.target.value), true)}
                            />
                          </td>
                          <td className="py-2.5 sm:py-3 px-1.5 sm:px-4 text-end font-mono font-black text-slate-800 align-top pt-3 sm:pt-3.5 text-xs sm:text-sm">
                            {item.total.toFixed(2)} {config.currency}
                          </td>
                          <td className="py-2.5 sm:py-3 px-1 sm:px-2 text-center align-top pt-2.5 sm:pt-3">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(idx)}
                              className="p-1.5 sm:p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                              title="Delete row"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {formItems.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400 font-bold text-xs">
                          {lang === 'ar' ? 'لا توجد بنود حالياً. يرجى البحث وإضافة منتجات من المخزون أو إضافة سطر يدوي أعلاه.' : 'Aucun article ajouté. Utilisez la recherche ci-dessus.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* 4. Financial Summary Cards */}
          <div className={`grid grid-cols-1 sm:grid-cols-2 ${activeType === 'facture' ? 'lg:grid-cols-5' : 'lg:grid-cols-4'} gap-4`}>
            {/* Card 1: Subtotal */}
            <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs space-y-1">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                {lang === 'ar' ? 'المجموع' : 'Sous-total HT'}
              </span>
              <div className="text-2xl font-black text-slate-900 font-mono">
                {subtotal.toFixed(2)} <span className="text-xs font-bold text-slate-400">{config.currency}</span>
              </div>
            </div>

            {/* Card 2: General Discount Input */}
            <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs space-y-1">
              <label className="text-[10px] font-black text-rose-500 uppercase tracking-wider block">
                {lang === 'ar' ? 'الخصم العام الإضافي' : 'Remise globale'}
              </label>
              <input
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-bold font-mono text-rose-700 placeholder:text-slate-300 placeholder:font-normal"
                value={formDiscount ?? ''}
                onChange={(e) => setFormDiscount(sanitizeDecimalInput(e.target.value))}
              />
            </div>

            {/* Card 3: Tax */}
            <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs space-y-1">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                {lang === 'ar' ? `الضريبة TVA (${taxRate}%)` : `TVA (${taxRate}%)`}
              </span>
              <div className="text-2xl font-black text-slate-700 font-mono">
                {totalTax.toFixed(2)} <span className="text-xs font-bold text-slate-400">{config.currency}</span>
              </div>
            </div>

            {/* Card 3b: Previous Balance / Old Credit (Only for Facture, excluded from stats) */}
            {activeType === 'facture' && (
              <div className="bg-amber-50/80 p-5 rounded-3xl border border-amber-300 shadow-xs space-y-1.5">
                <div className="flex items-center justify-between gap-1">
                  <label className="text-[10px] font-black text-amber-900 uppercase tracking-wider block">
                    {lang === 'ar' ? 'كريدي قديم / مبلغ' : 'Ancien crédit / Montant'}
                  </label>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 bg-amber-200/70 text-amber-900 rounded-md">
                    {lang === 'ar' ? 'لا يدخل في الأرباح' : 'Hors stats'}
                  </span>
                </div>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  className="w-full px-3 py-1.5 bg-white border border-amber-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm font-black font-mono text-amber-900 placeholder:text-amber-300 placeholder:font-normal"
                  value={formPreviousBalance ?? ''}
                  onChange={(e) => setFormPreviousBalance(sanitizeDecimalInput(e.target.value))}
                />
              </div>
            )}

            {/* Card 4: Net Grand Total */}
            <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs space-y-1">
              <span className="text-[10px] font-black text-indigo-600 uppercase tracking-wider block">
                {lang === 'ar' ? 'المجموع الكلي النهائي (TTC)' : 'Total Net TTC'}
              </span>
              <div className="text-2xl font-black text-indigo-700 font-mono">
                {(activeType === 'facture' ? grandTotalWithPrevious : netTotal).toFixed(2)} <span className="text-xs font-bold text-indigo-500">{config.currency}</span>
              </div>
              {activeType === 'facture' && previousBalanceAmount > 0 && (
                <span className="block text-[10px] font-bold text-amber-700">
                  {lang === 'ar' ? `صافي الفاتورة: ${netTotal.toFixed(2)} + قديم: ${previousBalanceAmount.toFixed(2)}` : `Facture: ${netTotal.toFixed(2)} + Ancien: ${previousBalanceAmount.toFixed(2)}`}
                </span>
              )}
            </div>
          </div>

          {/* 4a. POS-Style Grand Total & Old Credit Breakdown Banner for Facture */}
          {activeType === 'facture' && (
            <div className="bg-slate-900 text-white p-4 sm:p-5 rounded-3xl shadow-md flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-4 sm:gap-6">
                <div>
                  <span className="text-[11px] text-slate-400 font-bold block">
                    {lang === 'ar' ? 'مجموع الفاتورة (المنتجات):' : 'Total Facture (Articles):'}
                  </span>
                  <span className="font-mono font-black text-base text-white">
                    {netTotal.toFixed(2)} {config.currency}
                  </span>
                </div>
                <div className="text-slate-600 font-black text-lg hidden sm:block">+</div>
                <div>
                  <span className="text-[11px] text-amber-400 font-bold block">
                    {lang === 'ar' ? 'كريدي قديم / مبلغ مضاف:' : 'Ancien crédit / Montant ajouté:'}
                  </span>
                  <span className="font-mono font-black text-base text-amber-400">
                    +{previousBalanceAmount.toFixed(2)} {config.currency}
                  </span>
                </div>
              </div>
              <div className="border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-800 flex items-center justify-between sm:justify-end gap-3">
                <span className="text-xs font-black text-indigo-300">
                  {lang === 'ar' ? 'المجموع الكلي المطلوب:' : 'Total Général à Payer:'}
                </span>
                <span className="text-xl sm:text-2xl font-black font-mono text-emerald-400">
                  {grandTotalWithPrevious.toFixed(2)} <span className="text-xs">{config.currency}</span>
                </span>
              </div>
            </div>
          )}

          {/* 4b. Payment & Stock Integration Card (When creating/editing an Official Facture) */}
          {activeType === 'facture' && (
            <div className="bg-emerald-50/50 p-4 sm:p-5 rounded-3xl border border-emerald-200/80 shadow-xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-emerald-800 text-xs font-black">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    {lang === 'ar'
                      ? 'تسديد الفاتورة الرسمية والربط التلقائي بالمخزون والإحصائيات'
                      : 'Règlement de la Facture & Synchronisation Stock / Statistiques'}
                  </span>
                </div>
                <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-xl text-[10px] font-bold">
                  {lang === 'ar'
                    ? '✓ يخصم المخزون ويدخل في الأرباح تلقائياً'
                    : '✓ Déduit du stock & inclus aux ventes'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    {lang === 'ar' ? 'طريقة الدفع:' : 'Mode de paiement:'}
                  </label>
                  <select
                    value={formPaymentMethod}
                    onChange={(e) => {
                      const nextMode = e.target.value as 'cash' | 'card' | 'debt';
                      setFormPaymentMethod(nextMode);
                      if (nextMode !== 'debt') {
                        setFormAmountPaid('');
                      } else if (!formAmountPaid) {
                        setFormAmountPaid('0');
                      }
                    }}
                    className="w-full bg-white border border-emerald-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="cash">{lang === 'ar' ? 'نقداً (مدفوعة بالكامل)' : 'Espèces (Payée)'}</option>
                    <option value="card">{lang === 'ar' ? 'بطاقة / تحويل بنكي' : 'Carte / Virement'}</option>
                    <option value="debt">{lang === 'ar' ? 'دفع جزئي أو آجل (دين على الزبون)' : 'Crédit / Paiement partiel'}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    {lang === 'ar' ? `المبلغ المدفوع حالياً (${config.currency}):` : `Montant payé (${config.currency}):`}
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder={netTotal.toFixed(2)}
                    value={formPaymentMethod === 'debt' ? formAmountPaid : (formAmountPaid || netTotal.toFixed(2))}
                    onChange={(e) => {
                      const val = sanitizeDecimalInput(e.target.value);
                      setFormAmountPaid(val);
                      if (parseDecimal(val, 0) < netTotal) {
                        setFormPaymentMethod('debt');
                      }
                    }}
                    className="w-full bg-white border border-emerald-200 rounded-xl px-3 py-2 text-xs font-bold font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="bg-white p-2.5 rounded-xl border border-emerald-200/70 flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-500">
                    {lang === 'ar' ? 'الباقي (كريدي):' : 'Reste (Crédit):'}
                  </span>
                  <span className="font-mono font-black text-sm text-rose-600">
                    {Math.max(
                      0,
                      netTotal -
                        (formPaymentMethod === 'debt'
                          ? parseDecimal(formAmountPaid, 0)
                          : formAmountPaid.trim() !== ''
                          ? parseDecimal(formAmountPaid, netTotal)
                          : netTotal)
                    ).toFixed(2)}{' '}
                    {config.currency}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* 5. Notes & Terms Card */}
          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs space-y-3">
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700">
                {lang === 'ar' ? 'ملاحظات وشروط الدفع أو التسليم (اختياري)' : 'Conditions de règlement ou remarques (Optionnel)'}
              </label>
              <textarea
                rows={2}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-xs font-semibold resize-none"
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder={lang === 'ar' ? 'أدخل شروط الدفع، موعد التسليم، أو أي ملاحظات للزبون...' : 'Conditions de paiement, délai de livraison, coordonnées bancaires...'}
              />
            </div>

            <div className="text-[11px] text-slate-500 bg-indigo-50/40 p-3 rounded-2xl border border-indigo-100/50 flex items-center gap-2">
              <span className="text-indigo-600 font-bold">💡 {lang === 'ar' ? 'ملاحظة:' : 'Note:'}</span>
              <span>
                {lang === 'ar'
                  ? 'يمكنك حفظ الوثيقة مباشرة، كما يمكنك لاحقاً تحويل أي عرض أسعار بضغطة زر إلى سند طلبية، سند تسليم، أو فاتورة رسمية للمبيعات.'
                  : 'Vous pouvez valider ce document ou le convertir ultérieurement en un seul clic en facture officielle.'}
              </span>
            </div>
          </div>

          {/* 6. Sticky Bottom Action Controls */}
          <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-100 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-sm font-bold text-slate-600 text-center sm:text-start">
              <span className="text-slate-400 font-medium">{lang === 'ar' ? 'المجموع النهائي للوثيقة:' : 'Total net:'} </span>
              <span className="font-mono font-black text-slate-900 text-lg sm:text-xl">
                {(activeType === 'facture' ? grandTotalWithPrevious : netTotal).toFixed(2)} {config.currency}
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-center sm:justify-end gap-2 sm:gap-3 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => {
                  setFormItems([{
                    productId: '',
                    productName: '',
                    sellingPrice: 0,
                    purchasePrice: 0,
                    quantity: 1,
                    discount: 0,
                    tax: 0,
                    total: 0
                  }]);
                  setFormDiscount('0');
                  setFormPreviousBalance('');
                  setFormNotes('');
                  setProductSearch('');
                }}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>{lang === 'ar' ? 'تفريغ الحقول' : 'Vider'}</span>
              </button>

              <button
                type="button"
                onClick={() => { setIsCreating(false); setEditingDoc(null); }}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5"
              >
                <X className="w-3.5 h-3.5" />
                <span>{lang === 'ar' ? 'إلغاء والعودة' : 'Annuler'}</span>
              </button>

              <button
                type="submit"
                disabled={formItems.length === 0}
                className={`px-5 py-2.5 ${visuals.buttonBg} text-white text-xs font-black rounded-xl transition cursor-pointer shadow-sm disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center gap-2`}
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {editingDoc 
                    ? (lang === 'ar' ? 'تحديث وحفظ التعديلات' : 'Enregistrer modifications') 
                    : (lang === 'ar' ? 'حفظ وتأكيد الوثيقة' : 'حفظ وتأكيد الوثيقة')}
                </span>
              </button>
            </div>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 text-start w-full animate-fade-in" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Toast Notification via Portal */}
      {toastMessage && createPortal(
        <div dir={isRTL ? 'rtl' : 'ltr'} className="fixed inset-x-0 top-16 z-[250] flex justify-center px-4 pointer-events-none">
          <div className={`px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 text-xs sm:text-sm font-black border pointer-events-auto max-w-lg text-center ${
            toastMessage.includes('⚠️')
              ? 'bg-amber-600 text-white border-amber-400'
              : 'bg-emerald-600 text-white border-emerald-400'
          }`}>
            {toastMessage.includes('⚠️') ? (
              <AlertCircle className="w-5 h-5 text-amber-100 shrink-0" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-white shrink-0" />
            )}
            <span>{toastMessage}</span>
          </div>
        </div>,
        document.body
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-100">
        <div>
          <h1 className="text-lg sm:text-2xl font-bold text-slate-800 flex items-center gap-2">
            <ClipboardList className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-600 shrink-0" />
            <span>{lang === 'ar' ? 'إدارة الوثائق التجارية (Facture / Devis / BC / BL)' : 'Commercial Documents Management'}</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            {lang === 'ar' 
              ? 'إصدار الفواتير الرسمية، عروض الأسعار، سندات الطلب، وسندات التسليم مع المتابعة والطباعة المباشرة.' 
              : 'Official Invoices, Devis, Purchase Orders & Delivery Notes with direct conversion & printing.'}
          </p>
        </div>

        {/* Summary KPI Pills + Create Button */}
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={handleOpenCreate}
            className="w-full sm:w-auto px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs active:scale-95"
          >
            <Plus className="w-3.5 h-3.5 shrink-0" />
            <span>
              {activeType === 'facture' && (lang === 'ar' ? '+ إنشاء فاتورة جديدة' : '+ Nouvelle Facture')}
              {activeType === 'devis' && (lang === 'ar' ? '+ إنشاء عرض أسعار' : '+ Nouveau Devis')}
              {activeType === 'bon_commande' && (lang === 'ar' ? '+ إنشاء سند طلبية' : '+ Nouveau BC')}
              {activeType === 'bon_livraison' && (lang === 'ar' ? '+ إنشاء سند تسليم' : '+ Nouveau BL')}
            </span>
          </button>
          <div className="flex-1 sm:flex-initial bg-indigo-50/80 border border-indigo-200 px-3 py-1.5 rounded-xl text-xs font-black text-indigo-800 flex items-center justify-between sm:justify-start gap-1.5">
            <span>{lang === 'ar' ? 'الإجمالي:' : 'Total:'}</span>
            <span className="font-mono">{filteredTotalAmount.toFixed(2)} {config.currency}</span>
          </div>
          {activeType === 'facture' && (
            <div className="flex-1 sm:flex-initial bg-emerald-50/80 border border-emerald-200 px-3 py-1.5 rounded-xl text-xs font-black text-emerald-800 flex items-center justify-between sm:justify-start gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>{lang === 'ar' ? 'صافي الأرباح:' : 'Net Profit:'}</span>
              <span className="font-mono">{filteredTotalProfit >= 0 ? `+${filteredTotalProfit.toFixed(2)}` : filteredTotalProfit.toFixed(2)} {config.currency}</span>
            </div>
          )}
        </div>
      </div>

      {/* Document Type Selector Cards Bar - Official Invoice (facture) FIRST as requested */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[
          {
            id: 'facture' as CommercialDocType,
            titleAr: 'الفواتير الرسمية',
            subAr: 'Factures • الفواتير النهائية',
            titleFr: 'Factures de Vente',
            subFr: 'Factures officielles',
            icon: Receipt,
            activeBorder: 'border-emerald-500 ring-2 ring-emerald-500/20 shadow-sm',
            activeIndicator: 'bg-emerald-500',
            activeBadge: 'bg-emerald-500 text-white',
            iconActive: 'bg-emerald-500 text-white shadow-xs',
            iconInactive: 'bg-emerald-50 text-emerald-600',
            count: documents.filter(d => d.docType === 'facture').length
          },
          {
            id: 'devis' as CommercialDocType,
            titleAr: 'عروض الأسعار',
            subAr: 'Devis • تقدير الأسعار',
            titleFr: 'Devis & Proforma',
            subFr: 'Estimation de prix',
            icon: FileSpreadsheet,
            activeBorder: 'border-amber-500 ring-2 ring-amber-500/20 shadow-sm',
            activeIndicator: 'bg-amber-500',
            activeBadge: 'bg-amber-500 text-white',
            iconActive: 'bg-amber-500 text-white shadow-xs',
            iconInactive: 'bg-amber-50 text-amber-600',
            count: documents.filter(d => d.docType === 'devis').length
          },
          {
            id: 'bon_commande' as CommercialDocType,
            titleAr: 'سندات الطلبية',
            subAr: 'Bon de commande • تأكيد الطلب',
            titleFr: 'Bons de Commande',
            subFr: 'Commandes clients',
            icon: ShoppingCart,
            activeBorder: 'border-blue-500 ring-2 ring-blue-500/20 shadow-sm',
            activeIndicator: 'bg-blue-500',
            activeBadge: 'bg-blue-500 text-white',
            iconActive: 'bg-blue-500 text-white shadow-xs',
            iconInactive: 'bg-blue-50 text-blue-600',
            count: documents.filter(d => d.docType === 'bon_commande').length
          },
          {
            id: 'bon_livraison' as CommercialDocType,
            titleAr: 'سندات التسليم',
            subAr: 'Bon de livraison • إرسال السلع',
            titleFr: 'Bons de Livraison',
            subFr: 'Bons de décharge',
            icon: Truck,
            activeBorder: 'border-indigo-500 ring-2 ring-indigo-500/20 shadow-sm',
            activeIndicator: 'bg-indigo-500',
            activeBadge: 'bg-indigo-500 text-white',
            iconActive: 'bg-indigo-500 text-white shadow-xs',
            iconInactive: 'bg-indigo-50 text-indigo-600',
            count: documents.filter(d => d.docType === 'bon_livraison').length
          },
        ].map((tab) => {
          const isActive = activeType === tab.id;
          const IconComponent = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveType(tab.id)}
              className={`relative text-start p-4 rounded-2xl border transition-all duration-200 cursor-pointer overflow-hidden flex flex-col justify-between gap-3 group ${
                isActive
                  ? `bg-white ${tab.activeBorder}`
                  : 'bg-white/80 hover:bg-white border-slate-200 hover:border-slate-300 shadow-2xs hover:shadow-xs'
              }`}
            >
              {/* Active Top Bar Indicator */}
              {isActive && (
                <span className={`absolute top-0 inset-x-0 h-1 ${tab.activeIndicator}`} />
              )}

              <div className="flex items-center justify-between gap-2">
                <div className={`p-2.5 rounded-xl transition duration-200 ${
                  isActive ? tab.iconActive : `${tab.iconInactive} group-hover:scale-105`
                }`}>
                  <IconComponent className="w-5 h-5 shrink-0" />
                </div>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-bold transition ${
                  isActive ? tab.activeBadge : 'bg-slate-100 text-slate-600'
                }`}>
                  {tab.count} {lang === 'ar' ? 'وثيقة' : 'doc'}
                </span>
              </div>

              <div>
                <h3 className={`text-sm font-black tracking-tight transition ${
                  isActive ? 'text-slate-900' : 'text-slate-700 group-hover:text-slate-900'
                }`}>
                  {lang === 'ar' ? tab.titleAr : tab.titleFr}
                </h3>
                <p className="text-[11px] font-medium text-slate-400 mt-0.5 truncate">
                  {lang === 'ar' ? tab.subAr : tab.subFr}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Query Filters - Responsive & Wrap-Friendly */}
      <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row gap-2.5">
          {/* Search */}
          <div className="relative flex-1 min-w-0">
            <span className={`absolute inset-y-0 ${isRTL ? 'right-3.5' : 'left-3.5'} flex items-center text-slate-400 pointer-events-none`}>
              <Search className="w-4 h-4 sm:w-5 sm:h-5" />
            </span>
            <input
              type="text"
              placeholder={lang === 'ar' ? 'بحث برقم الوثيقة، اسم الزبون، رقم الهاتف...' : 'Search by doc number, client, phone...'}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`w-full py-2 sm:py-2.5 ${isRTL ? 'pr-10 pl-4' : 'pl-10 pr-4'} bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition`}
            />
          </div>

          {/* Status Filter */}
          <div className="w-full sm:w-48 shrink-0">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 sm:py-2.5 text-xs sm:text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="all">{lang === 'ar' ? 'جميع الحالات' : 'Tous les états'}</option>
              <option value="draft">{lang === 'ar' ? 'مسودة' : 'Brouillon'}</option>
              <option value="validated">{lang === 'ar' ? 'مؤكد / ساري' : 'Validé'}</option>
              <option value="converted">{lang === 'ar' ? 'تم التحويل' : 'Converti'}</option>
              <option value="cancelled">{lang === 'ar' ? 'ملغى' : 'Annulé'}</option>
            </select>
          </div>

          {/* Customer Filter */}
          <div className="w-full sm:w-52 shrink-0">
            <select
              value={selectedCustomerFilter}
              onChange={(e) => setSelectedCustomerFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 sm:py-2.5 text-xs sm:text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="all">{lang === 'ar' ? 'جميع الزبائن' : 'Tous les clients'}</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Date Filter Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 pt-2 border-t border-slate-100 text-xs">
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
            <div className="flex justify-end items-center">
              <button
                type="button"
                onClick={() => {
                  setSelectedMonth('');
                  setFromDate('');
                  setToDate('');
                  setSelectedCustomerFilter('all');
                }}
                className="w-full py-2 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl font-bold transition cursor-pointer text-center"
              >
                {lang === 'ar' ? 'إعادة تعيين الفلاتر' : 'Réinitialiser'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* MOBILE / IPHONE DOCUMENTS CARDS VIEW (< md) */}
      <div className="md:hidden space-y-3">
        {filteredDocs.length > 0 ? (
          filteredDocs.map((doc) => {
            const docProfit = doc.docType === 'facture' ? calculateDocProfit(doc) : null;
            const prevBal = Number(doc.previousBalance || 0);
            const docTotal = Number(doc.total || 0);
            const safeItems = getSafeDocItems(doc);

            return (
              <div
                key={doc.id}
                className="bg-white rounded-2xl border border-slate-200/90 p-3.5 shadow-2xs space-y-3"
              >
                {/* Row 1: Document Number, Customer Name & Date */}
                <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2.5">
                  <div className="space-y-0.5 text-start">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono font-black text-sm text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-100">
                        {doc.docNumber}
                      </span>
                      <span className="font-black text-slate-800 text-xs">{doc.customerName}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 font-mono">
                      {doc.date ? new Date(doc.date).toLocaleString('fr-FR') : ''}
                    </p>
                  </div>

                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {getStatusBadge(doc.status)}
                    {docProfit !== null && (
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black font-mono border whitespace-nowrap ${
                          docProfit >= 0
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border-rose-200'
                        }`}
                      >
                        <span>{lang === 'ar' ? 'الربح:' : 'Profit:'}</span>
                        <span>{docProfit >= 0 ? '+' : ''}{docProfit.toFixed(2)} {config.currency}</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Row 2: Financial Figures Grid */}
                <div className="grid grid-cols-3 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-center text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold block">{t.invoice.total}</span>
                    <span className="font-mono font-black text-slate-900">
                      {docTotal.toFixed(2)} <span className="text-[9px] font-normal">{config.currency}</span>
                    </span>
                    {prevBal > 0 && (
                      <span className="block text-[9px] font-bold text-amber-700 font-mono">
                        +{prevBal.toFixed(2)} {lang === 'ar' ? 'كريدي' : 'Crédit'}
                      </span>
                    )}
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold block">{lang === 'ar' ? 'المواد' : 'Articles'}</span>
                    <span className="font-mono font-bold text-slate-700">
                      {safeItems.length}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold block">{lang === 'ar' ? 'النوع' : 'Type'}</span>
                    <span className="font-bold text-indigo-700 text-[11px]">
                      {getDocTypePrefix(doc.docType)}
                    </span>
                  </div>
                </div>

                {/* Quick Convert Row if not converted */}
                {!doc.convertedTo && doc.docType !== 'facture' && (
                  <div className="flex items-center justify-between gap-1.5 p-2 bg-indigo-50/50 rounded-xl border border-indigo-100/70 text-xs">
                    <span className="font-bold text-slate-600 text-[11px]">{lang === 'ar' ? 'التحويل المباشر:' : 'Conversion:'}</span>
                    <div className="flex items-center gap-1">
                      {doc.docType === 'devis' && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleConvertToBC(doc)}
                            className="px-2 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-[10px] font-black cursor-pointer hover:bg-blue-100 transition"
                          >
                            → BC
                          </button>
                          <button
                            type="button"
                            onClick={() => handleConvertToBL(doc)}
                            className="px-2 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-[10px] font-black cursor-pointer hover:bg-indigo-100 transition"
                          >
                            → BL
                          </button>
                          <button
                            type="button"
                            onClick={() => handleConvertToFacture(doc)}
                            className="px-2 py-1 bg-emerald-600 text-white rounded-lg text-[10px] font-black cursor-pointer hover:bg-emerald-700 transition"
                          >
                            {lang === 'ar' ? '→ فاتورة' : '→ Facture'}
                          </button>
                        </>
                      )}
                      {doc.docType === 'bon_commande' && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleConvertToBL(doc)}
                            className="px-2 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-[10px] font-black cursor-pointer hover:bg-indigo-100 transition"
                          >
                            → BL
                          </button>
                          <button
                            type="button"
                            onClick={() => handleConvertToFacture(doc)}
                            className="px-2 py-1 bg-emerald-600 text-white rounded-lg text-[10px] font-black cursor-pointer hover:bg-emerald-700 transition"
                          >
                            {lang === 'ar' ? '→ فاتورة' : '→ Facture'}
                          </button>
                        </>
                      )}
                      {doc.docType === 'bon_livraison' && (
                        <button
                          type="button"
                          onClick={() => handleConvertToFacture(doc)}
                          className="px-2.5 py-1 bg-emerald-600 text-white rounded-lg text-[10px] font-black cursor-pointer hover:bg-emerald-700 transition"
                        >
                          {lang === 'ar' ? '→ تحويل لفاتورة' : '→ Facture'}
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Row 3: Action Buttons Grid */}
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  <button
                    type="button"
                    onClick={() => handleOpenDocDetails(doc)}
                    className="flex-1 min-w-[90px] py-2 px-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl border border-indigo-200 text-xs font-black flex items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5 shrink-0" />
                    <span>{lang === 'ar' ? 'التفاصيل' : t.invoice.view}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setReceiptPreviewDoc(doc)}
                    className="py-2 px-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition cursor-pointer"
                    title={lang === 'ar' ? 'إيصال 80mm' : 'Ticket 80mm'}
                  >
                    <Printer className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>{lang === 'ar' ? 'إيصال' : 'Ticket'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleExportDocPdf(doc)}
                    className="py-2 px-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl border border-rose-200 text-xs font-bold flex items-center justify-center gap-1 transition cursor-pointer"
                  >
                    <FileDown className="w-3.5 h-3.5 shrink-0" />
                    <span>PDF</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenEdit(doc)}
                    className="py-2 px-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl border border-blue-200 text-xs font-bold flex items-center justify-center gap-1 transition cursor-pointer"
                  >
                    <Edit className="w-3.5 h-3.5 shrink-0" />
                    <span>{lang === 'ar' ? 'تعديل' : 'Edit'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDeletingId(doc.id)}
                    className="p-2 text-rose-600 bg-rose-50/60 hover:bg-rose-100 rounded-xl border border-rose-200/70 transition cursor-pointer"
                    title={lang === 'ar' ? 'حذف' : 'Delete'}
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
            <p className="text-xs font-bold">{lang === 'ar' ? `لا توجد وثائق مطابقة في قسم ${getDocTypeLabel(activeType)}` : 'Aucun document trouvé.'}</p>
          </div>
        )}
      </div>

      {/* DESKTOP DOCUMENTS TABLE (md+) */}
      <div className="hidden md:block bg-white border border-slate-100 rounded-2xl shadow-xs overflow-hidden" id="commercial-docs-table-shell">
        <div className="overflow-x-auto">
          <table className="w-full text-right sm:text-inherit">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr className="text-slate-500 text-xs font-bold uppercase text-center">
                <th className="px-3.5 py-2.5 text-start">{lang === 'ar' ? 'رقم الوثيقة' : 'N° Document'}</th>
                <th className="px-3.5 py-2.5 text-start">{lang === 'ar' ? 'التاريخ' : 'Date'}</th>
                <th className="px-3.5 py-2.5 text-start">{lang === 'ar' ? 'الزبون' : 'Client'}</th>
                <th className="px-3.5 py-2.5 text-center">{lang === 'ar' ? 'المواد' : 'Articles'}</th>
                <th className="px-3.5 py-2.5 text-center">{lang === 'ar' ? 'المبلغ الإجمالي' : 'Total'}</th>
                <th className="px-3.5 py-2.5 text-center">{lang === 'ar' ? 'الحالة والربح' : 'État & Profit'}</th>
                <th className="px-3.5 py-2.5 text-center">{lang === 'ar' ? 'التحويل والمتابعة' : 'Conversion'}</th>
                <th className="px-3.5 py-2.5 text-center">{lang === 'ar' ? 'إجراءات' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs font-semibold">
              {filteredDocs.length > 0 ? (
                filteredDocs.map((doc) => {
                  const docProfit = doc.docType === 'facture' ? calculateDocProfit(doc) : null;
                  const prevBal = Number(doc.previousBalance || 0);
                  const safeItems = getSafeDocItems(doc);
                  return (
                    <tr key={doc.id} className="hover:bg-slate-50/50 transition">
                      <td className="px-3.5 py-2.5 font-mono font-bold text-slate-800 text-start">
                        {doc.docNumber}
                      </td>
                      <td className="px-3.5 py-2.5 text-slate-500 text-start">
                        {doc.date ? new Date(doc.date).toLocaleString('fr-FR') : ''}
                      </td>
                      <td className="px-3.5 py-2.5 text-slate-800 text-start font-bold">
                        <div>{doc.customerName}</div>
                        {doc.customerPhone && (
                          <div className="text-[10px] text-slate-400 font-mono font-normal">{doc.customerPhone}</div>
                        )}
                      </td>
                      <td className="px-3.5 py-2.5 text-center font-mono">
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold">
                          {safeItems.length} {lang === 'ar' ? 'مواد' : 'art.'}
                        </span>
                      </td>
                      <td className="px-3.5 py-2.5 text-slate-900 font-black text-center font-mono">
                        <div>{Number(doc.total || 0).toFixed(2)} {config.currency}</div>
                        {prevBal > 0 && (
                          <div className="text-[10px] font-bold text-amber-700 font-mono">
                            +{prevBal.toFixed(2)} ({lang === 'ar' ? 'كريدي قديم' : 'Ancien crédit'})
                          </div>
                        )}
                      </td>
                      <td className="px-3.5 py-2.5 text-center">
                        <div className="flex flex-col items-center justify-center gap-1">
                          {getStatusBadge(doc.status)}
                          {docProfit !== null && (
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black font-mono border whitespace-nowrap ${
                                docProfit >= 0
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : 'bg-rose-50 text-rose-700 border-rose-200'
                              }`}
                            >
                              <span>{lang === 'ar' ? 'الربح:' : 'Profit:'}</span>
                              <span>{docProfit >= 0 ? '+' : ''}{docProfit.toFixed(2)} {config.currency}</span>
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3.5 py-2.5 text-center">
                        {doc.convertedTo ? (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg inline-flex items-center gap-1">
                            <Check className="w-3 h-3 text-emerald-600" />
                            <span>{doc.convertedTo.docNumber}</span>
                          </span>
                        ) : (
                          <div className="flex items-center justify-center gap-1 flex-wrap">
                            {/* Quick Convert Buttons */}
                            {doc.docType === 'devis' && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleConvertToBC(doc)}
                                  className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-[10px] font-black cursor-pointer transition shadow-2xs hover:scale-105 active:scale-95"
                                  title={lang === 'ar' ? 'تحويل إلى سند طلبية (Bon de commande)' : 'Convertir en Bon de Commande'}
                                >
                                  → BC
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleConvertToBL(doc)}
                                  className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-[10px] font-black cursor-pointer transition shadow-2xs hover:scale-105 active:scale-95"
                                  title={lang === 'ar' ? 'تحويل إلى سند تسليم (Bon de livraison)' : 'Convertir en Bon de Livraison'}
                                >
                                  → BL
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleConvertToFacture(doc)}
                                  className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-black cursor-pointer transition shadow-2xs hover:scale-105 active:scale-95"
                                  title={lang === 'ar' ? 'تحويل إلى فاتورة رسمية' : 'Convertir en Facture'}
                                >
                                  {lang === 'ar' ? '→ فاتورة' : '→ Facture'}
                                </button>
                              </>
                            )}
                            {doc.docType === 'bon_commande' && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleConvertToBL(doc)}
                                  className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-[10px] font-black cursor-pointer transition shadow-2xs hover:scale-105 active:scale-95"
                                  title={lang === 'ar' ? 'تحويل إلى سند تسليم (Bon de livraison)' : 'Convertir en Bon de Livraison'}
                                >
                                  → BL
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleConvertToFacture(doc)}
                                  className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-black cursor-pointer transition shadow-2xs hover:scale-105 active:scale-95"
                                  title={lang === 'ar' ? 'تحويل إلى فاتورة رسمية' : 'Convertir en Facture'}
                                >
                                  {lang === 'ar' ? '→ فاتورة' : '→ Facture'}
                                </button>
                              </>
                            )}
                            {doc.docType === 'bon_livraison' && (
                              <button
                                type="button"
                                onClick={() => handleConvertToFacture(doc)}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-black cursor-pointer transition shadow-2xs hover:scale-105 active:scale-95"
                                title={lang === 'ar' ? 'تحويل إلى فاتورة رسمية' : 'Convertir en Facture'}
                              >
                                {lang === 'ar' ? '→ تحويل لفاتورة' : '→ Facture'}
                              </button>
                            )}
                            {doc.docType === 'facture' && (
                              <span className="text-[10px] text-slate-400 font-bold bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-200">
                                {lang === 'ar' ? 'فاتورة نهائية' : 'Facture Finale'}
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-3.5 py-2.5 text-center">
                        <div className="flex items-center justify-center gap-1.5 flex-wrap">
                          <button
                            id={`view-doc-btn-${doc.id}`}
                            type="button"
                            onClick={() => handleOpenDocDetails(doc)}
                            className="px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg border border-slate-200 text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                            title={lang === 'ar' ? 'معاينة وطباعة A4' : 'Aperçu & Imprimer A4'}
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>{lang === 'ar' ? 'معاينة' : 'Aperçu'}</span>
                          </button>
                          <button
                            id={`edit-doc-btn-${doc.id}`}
                            type="button"
                            onClick={() => handleOpenEdit(doc)}
                            className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg border border-blue-200 text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                            title={lang === 'ar' ? 'تعديل' : 'Modifier'}
                          >
                            <Edit className="w-3.5 h-3.5" />
                            <span>{lang === 'ar' ? 'تعديل' : 'Modifier'}</span>
                          </button>
                          <button
                            id={`receipt-doc-btn-${doc.id}`}
                            type="button"
                            onClick={() => setReceiptPreviewDoc(doc)}
                            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                            title={lang === 'ar' ? 'معاينة وطباعة إيصال (80mm)' : 'Ticket (80mm)'}
                          >
                            <Printer className="w-3.5 h-3.5 text-emerald-400" />
                            <span>{lang === 'ar' ? 'إيصال' : 'Ticket'}</span>
                          </button>
                          <button
                            id={`pdf-doc-btn-${doc.id}`}
                            type="button"
                            onClick={() => handleExportDocPdf(doc)}
                            className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg border border-rose-200 text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                            title={lang === 'ar' ? 'حفظ / مشاركة PDF' : 'Save / Share PDF'}
                          >
                            <FileDown className="w-3.5 h-3.5" />
                            <span>PDF</span>
                          </button>
                          <button
                            id={`delete-doc-btn-${doc.id}`}
                            type="button"
                            onClick={() => setDeletingId(doc.id)}
                            className="p-1.5 text-rose-600 bg-rose-50/60 hover:bg-rose-100 rounded-lg border border-rose-200/70 transition cursor-pointer"
                            title={lang === 'ar' ? 'حذف' : 'Supprimer'}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 font-bold">
                    <FileText className="w-10 h-10 mx-auto text-slate-300 mb-2 stroke-[1.2]" />
                    <p>{lang === 'ar' ? `لا توجد وثائق مسجلة في قسم ${getDocTypeLabel(activeType)}` : `Aucun document trouvé dans ${getDocTypeLabel(activeType)}`}</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Old modal 1 replaced by dedicated full-page PurchaseEntry style creation view */}

      {/* MODAL 2: VIEW & PRINT A4 DOCUMENT WITH DIRECT CONVERSION */}
      {viewingDoc && createPortal(
        <div 
          className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-6 z-[100] overflow-y-auto safe-modal-overlay"
          onClick={() => setViewingDoc(null)}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-fade-in my-auto text-start"
          >
            {/* Top Bar with Clear Back Button and Conversion Actions */}
            <div className="flex flex-wrap justify-between items-center bg-slate-50 px-4 sm:px-6 py-3.5 border-b border-slate-200 gap-2.5 shrink-0">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setViewingDoc(null)}
                  className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer transition shadow-2xs"
                >
                  <ArrowRight className={`w-4 h-4 ${isRTL ? '' : 'rotate-180'}`} />
                  <span>{lang === 'ar' ? 'رجوع' : 'Retour'}</span>
                </button>
                <span className="font-mono font-bold text-slate-800 text-xs">
                  {viewingDoc.docNumber} • {getDocTypeLabel(viewingDoc.docType)}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {/* 1-Click Convert Actions inside modal */}
                {viewingDoc.docType === 'devis' && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleConvertToBC(viewingDoc)}
                      className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-xl text-xs font-black flex items-center gap-1 cursor-pointer transition shadow-2xs"
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5" />
                      <span>{lang === 'ar' ? 'تحويل إلى BC' : 'Convertir en BC'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleConvertToFacture(viewingDoc)}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center gap-1 cursor-pointer transition shadow-xs"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-200" />
                      <span>{lang === 'ar' ? 'تحويل لفاتورة' : 'Convertir en Facture'}</span>
                    </button>
                  </>
                )}

                {viewingDoc.docType === 'bon_commande' && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleConvertToBL(viewingDoc)}
                      className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-black flex items-center gap-1 cursor-pointer transition shadow-2xs"
                    >
                      <Truck className="w-3.5 h-3.5" />
                      <span>{lang === 'ar' ? 'تحويل إلى BL' : 'Convertir en BL'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleConvertToFacture(viewingDoc)}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center gap-1 cursor-pointer transition shadow-xs"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-200" />
                      <span>{lang === 'ar' ? 'تحويل لفاتورة' : 'Convertir en Facture'}</span>
                    </button>
                  </>
                )}

                {viewingDoc.docType === 'bon_livraison' && (
                  <button
                    type="button"
                    onClick={() => handleConvertToFacture(viewingDoc)}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center gap-1 cursor-pointer transition shadow-xs"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-200" />
                    <span>{lang === 'ar' ? 'تحويل لفاتورة' : 'Convertir en Facture'}</span>
                  </button>
                )}

                {/* 80mm Receipt button */}
                <button
                  type="button"
                  onClick={() => {
                    const doc = viewingDoc;
                    setViewingDoc(null);
                    setReceiptPreviewDoc(doc);
                  }}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer transition shadow-xs"
                >
                  <Receipt className="w-3.5 h-3.5" />
                  <span>{lang === 'ar' ? 'إيصال (80mm)' : 'Ticket (80mm)'}</span>
                </button>

                {/* PDF button */}
                <button
                  type="button"
                  onClick={() => handleExportDocPdf(viewingDoc, 'a4', false)}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer transition shadow-xs"
                  title={viewingDoc.docType === 'facture' ? (lang === 'ar' ? 'تصدير PDF رسمي' : 'PDF Officiel') : 'PDF'}
                >
                  <FileDown className="w-3.5 h-3.5" />
                  <span>{viewingDoc.docType === 'facture' ? (lang === 'ar' ? 'PDF رسمي' : 'PDF Officiel') : 'PDF'}</span>
                </button>

                {/* Print button */}
                <button
                  type="button"
                  onClick={() => triggerPrint(viewingDoc, false)}
                  className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer transition shadow-xs"
                  title={viewingDoc.docType === 'facture' ? (lang === 'ar' ? 'طباعة فاتورة رسمية بدون دفع وباقي' : 'Imprimer Facture Officielle') : (lang === 'ar' ? 'طباعة A4' : 'Imprimer A4')}
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>{viewingDoc.docType === 'facture' ? (lang === 'ar' ? 'طباعة رسمية A4' : 'Facture A4') : (lang === 'ar' ? 'طباعة A4' : 'Imprimer A4')}</span>
                </button>

                {viewingDoc.docType === 'facture' && (
                  <button
                    type="button"
                    onClick={() => triggerPrint(viewingDoc, true)}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer transition shadow-xs"
                    title={lang === 'ar' ? 'طباعة نفس الفاتورة مع معطيات المبلغ المدفوع والباقي' : 'Imprimer avec détails paiement & reste'}
                  >
                    <Printer className="w-3.5 h-3.5 text-amber-300" />
                    <span>{lang === 'ar' ? 'طباعة مع السداد' : 'Avec Paiement'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Printable A4 Sheet Body */}
            <div className="p-4 sm:p-8 space-y-6 overflow-y-auto flex-1 bg-white" id="printable-commercial-doc">
              {/* Header: Store Info + Document Metadata */}
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pb-6 border-b-2 border-slate-200">
                <div>
                  {config.logoUrl && (
                    <img
                      src={config.logoUrl}
                      alt="Logo"
                      referrerPolicy="no-referrer"
                      className="h-12 object-contain mb-2 bg-slate-50 border border-slate-200 rounded-lg p-1"
                    />
                  )}
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight">{config.name}</h2>
                  {config.address && <p className="text-xs text-slate-500 font-semibold">{config.address}</p>}
                  <div className="text-xs text-slate-500 space-y-0.5 pt-1">
                    {config.phone && <p>{lang === 'ar' ? 'الهاتف:' : 'Tél:'} <span className="font-mono text-slate-700 font-bold">{config.phone}</span></p>}
                    {config.email && <p>{lang === 'ar' ? 'البريد:' : 'Email:'} <span className="font-mono text-slate-700 font-bold">{config.email}</span></p>}
                    {config.registrationNumber && <p>{lang === 'ar' ? 'السجل الضريبي / ICE:' : 'ICE / IF:'} <span className="font-mono font-bold text-slate-700">{config.registrationNumber}</span></p>}
                  </div>
                </div>

                <div className="text-start sm:text-end space-y-2">
                  <div className={`inline-block px-4 py-1.5 rounded-xl text-xs font-black uppercase font-mono tracking-wider border ${
                    viewingDoc.docType === 'devis' ? 'bg-amber-50 text-amber-800 border-amber-200' :
                    viewingDoc.docType === 'bon_commande' ? 'bg-indigo-50 text-indigo-800 border-indigo-200' :
                    viewingDoc.docType === 'bon_livraison' ? 'bg-blue-50 text-blue-800 border-blue-200' :
                    'bg-emerald-50 text-emerald-800 border-emerald-200'
                  }`}>
                    {viewingDoc.docType === 'devis' && (lang === 'ar' ? 'عرض أسعار - DEVIS' : 'DEVIS / QUOTATION')}
                    {viewingDoc.docType === 'bon_commande' && 'BON DE COMMANDE'}
                    {viewingDoc.docType === 'bon_livraison' && 'BON DE LIVRAISON'}
                    {viewingDoc.docType === 'facture' && (lang === 'ar' ? 'فاتورة رسمية - FACTURE' : 'FACTURE DE VENTE')}
                  </div>
                  <h4 className="font-mono text-2xl font-black text-slate-900">{viewingDoc.docNumber}</h4>
                  <p className="text-xs text-slate-500 flex items-center sm:justify-end gap-1.5 font-bold">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>{viewingDoc.date ? new Date(viewingDoc.date).toLocaleString('fr-FR') : ''}</span>
                  </p>
                  {viewingDoc.validUntil && (
                    <p className="text-[11px] text-amber-700 font-bold">
                      {lang === 'ar' ? 'صالح إلى غاية:' : 'Valide jusqu\'au:'} {new Date(viewingDoc.validUntil).toLocaleDateString()}
                    </p>
                  )}
                  {viewingDoc.convertedFrom && (
                    <span className="text-[10px] font-bold text-slate-500 block">
                      {lang === 'ar' ? `محول من: ${viewingDoc.convertedFrom.docNumber}` : `Converti depuis: ${viewingDoc.convertedFrom.docNumber}`}
                    </span>
                  )}
                </div>
              </div>

              {/* Client Information Card */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs">
                <span className="text-slate-400 font-black uppercase tracking-wider block mb-1 text-[10px]">
                  {lang === 'ar' ? 'المرسل إليه / بيانات الزبون (Client)' : 'Informations Client'}
                </span>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-black text-slate-900 text-sm">{viewingDoc.customerName}</p>
                  {(() => {
                    const matchedCust = customers.find(c => c.id === viewingDoc.customerId || c.name === viewingDoc.customerName);
                    return matchedCust?.ice ? (
                      <span className="inline-block px-1.5 py-0.5 rounded text-[11px] font-mono font-bold bg-white text-slate-800 border border-slate-300">
                        ICE: {matchedCust.ice}
                      </span>
                    ) : null;
                  })()}
                </div>
                {viewingDoc.customerPhone && (
                  <p className="text-slate-600 font-medium mt-0.5">{lang === 'ar' ? 'الهاتف:' : 'Tél:'} <span className="font-mono font-bold text-slate-800">{viewingDoc.customerPhone}</span></p>
                )}
                {viewingDoc.customerAddress && (
                  <p className="text-slate-600 mt-0.5">{lang === 'ar' ? 'العنوان:' : 'Adresse:'} {viewingDoc.customerAddress}</p>
                )}
              </div>

              {/* Items Table */}
              <div className="border border-slate-200 rounded-2xl overflow-x-auto text-[11px] sm:text-xs shadow-2xs">
                <table className="w-full">
                  <thead className="bg-slate-100 text-slate-700 font-black border-b border-slate-200 text-[10px] sm:text-[11px]">
                    <tr>
                      <th className="px-2 sm:px-4 py-2.5 sm:py-3 text-start w-8 sm:w-12">#</th>
                      <th className="px-2 sm:px-4 py-2.5 sm:py-3 text-start">{lang === 'ar' ? 'البيان / المادة' : 'Désignation'}</th>
                      <th className="px-2 sm:px-4 py-2.5 sm:py-3 text-center w-14 sm:w-24">{lang === 'ar' ? 'الكمية' : 'Quantité'}</th>
                      <th className="px-2 sm:px-4 py-2.5 sm:py-3 text-center w-20 sm:w-32">{lang === 'ar' ? 'سعر الوحدة' : 'Prix Unitaire'}</th>
                      <th className="px-2 sm:px-4 py-2.5 sm:py-3 text-center w-14 sm:w-20">{lang === 'ar' ? 'خصم%' : 'Remise'}</th>
                      <th className="px-2 sm:px-4 py-2.5 sm:py-3 text-end w-24 sm:w-32">{lang === 'ar' ? 'المجموع' : 'Total'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-semibold bg-white">
                    {(viewingDoc.items || []).map((item, idx) => {
                      const itemPrice = Number(item.sellingPrice ?? 0);
                      const itemDiscount = Number(item.discount ?? 0);
                      const itemTotal = Number(item.total ?? (itemPrice * (item.quantity || 1)));
                      return (
                        <tr key={idx} className="hover:bg-slate-50/60 transition">
                          <td className="px-2 sm:px-4 py-2.5 sm:py-3 text-slate-400 text-start">{idx + 1}</td>
                          <td className="px-2 sm:px-4 py-2.5 sm:py-3 text-slate-900 font-bold">{item.productName || 'منتج'}</td>
                          <td className="px-2 sm:px-4 py-2.5 sm:py-3 text-center font-mono font-bold text-slate-800">{item.quantity || 1}</td>
                          <td className="px-2 sm:px-4 py-2.5 sm:py-3 text-center font-mono text-slate-600">{itemPrice.toFixed(2)} {config.currency}</td>
                          <td className="px-2 sm:px-4 py-2.5 sm:py-3 text-center font-mono text-slate-600">{itemDiscount > 0 ? `${itemDiscount}%` : '-'}</td>
                          <td className="px-2 sm:px-4 py-2.5 sm:py-3 text-end font-black text-slate-900 font-mono whitespace-nowrap">
                            {itemTotal.toFixed(2)} {config.currency}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Totals Summary */}
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pt-4 border-t border-slate-200">
                <div className="text-xs text-slate-500 max-w-sm space-y-2 text-start">
                  {viewingDoc.notes && (
                    <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
                      <p className="font-black uppercase text-slate-600 text-[10px] mb-1">{lang === 'ar' ? 'ملاحظات وشروط:' : 'Conditions:'}</p>
                      <p className="text-slate-700 leading-relaxed font-medium">{viewingDoc.notes}</p>
                    </div>
                  )}
                  <p className="text-[10px] text-slate-400 font-mono">Ref ID: {viewingDoc.id}</p>
                </div>

                <div className="w-full sm:w-80 space-y-2 text-xs font-bold text-slate-700 bg-slate-50/80 p-4 rounded-2xl border border-slate-200">
                  <div className="flex justify-between items-center text-slate-600">
                    <span>{lang === 'ar' ? 'المجموع:' : 'Total HT:'}</span>
                    <span className="font-mono text-slate-900">{Number(viewingDoc.subtotal || 0).toFixed(2)} {config.currency}</span>
                  </div>
                  {Number(viewingDoc.discount || 0) > 0 && (
                    <div className="flex justify-between items-center text-rose-600">
                      <span>{lang === 'ar' ? 'قيمة الخصم:' : 'Remise:'}</span>
                      <span className="font-mono">-{Number(viewingDoc.discount || 0).toFixed(2)} {config.currency}</span>
                    </div>
                  )}
                  {Number(viewingDoc.tax || 0) > 0 && (
                    <div className="flex justify-between items-center text-slate-500">
                      <span>{(() => {
                        const tr = config.taxRate > 0
                          ? config.taxRate
                          : (viewingDoc.subtotal ? Math.round((Number(viewingDoc.tax || 0) / (Number(viewingDoc.subtotal || 0) - Number(viewingDoc.discount || 0))) * 100) : 0);
                        return tr > 0 ? (lang === 'ar' ? `الضريبة (${tr}%):` : `TVA (${tr}%):`) : (lang === 'ar' ? 'الضريبة (%):' : 'TVA (%):');
                      })()}</span>
                      <span className="font-mono">{Number(viewingDoc.tax || 0).toFixed(2)} {config.currency}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center border-t border-slate-200 pt-2 text-slate-900 font-black text-sm">
                    <span>{lang === 'ar' ? 'الصافي الإجمالي (TTC):' : 'Net TTC:'}</span>
                    <span className="text-xl font-black text-indigo-700 font-mono">{Number(viewingDoc.total || 0).toFixed(2)} {config.currency}</span>
                  </div>
                  {Number(viewingDoc.previousBalance || 0) > 0 && (
                    <>
                      <div className="flex justify-between items-center text-amber-800 pt-1">
                        <span>{lang === 'ar' ? 'كريدي قديم / مبلغ سابق:' : 'Ancien crédit / Solde:'}</span>
                        <span className="font-mono font-bold">+{Number(viewingDoc.previousBalance || 0).toFixed(2)} {config.currency}</span>
                      </div>
                      <div className="flex justify-between items-center border-t border-amber-200 pt-2 text-slate-950 font-black text-sm">
                        <span>{lang === 'ar' ? 'المجموع الكلي مع السابق:' : 'Total général avec solde:'}</span>
                        <span className="text-xl font-black text-emerald-700 font-mono">
                          {(Number(viewingDoc.total || 0) + Number(viewingDoc.previousBalance || 0)).toFixed(2)} {config.currency}
                        </span>
                      </div>
                    </>
                  )}
                  {viewingDoc.docType === 'facture' && (
                    <div className="pt-2 border-t border-slate-200 flex justify-between items-center">
                      <button
                        type="button"
                        onClick={() => setShowPaymentInOfficialInvoice(!showPaymentInOfficialInvoice)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer border ${
                          showPaymentInOfficialInvoice
                            ? 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                            : 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'
                        }`}
                      >
                        {showPaymentInOfficialInvoice ? (
                          <>
                            <EyeOff className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            <span>{lang === 'ar' ? 'إخفاء معطيات الدفع والباقي (رسمي)' : 'Masquer paiement & reste (officiel)'}</span>
                          </>
                        ) : (
                          <>
                            <Eye className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                            <span>{lang === 'ar' ? 'إظهار معطيات الدفع والباقي' : 'Afficher paiement & reste'}</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                  {viewingDoc.docType === 'facture' && showPaymentInOfficialInvoice && viewingDoc.amountPaid !== undefined && (
                    <div className="flex justify-between items-center text-emerald-700 pt-1 border-t border-slate-200">
                      <span>{lang === 'ar' ? 'المبلغ المؤدى:' : 'Montant payé:'}</span>
                      <span className="font-mono font-bold">{Number(viewingDoc.amountPaid).toFixed(2)} {config.currency}</span>
                    </div>
                  )}
                  {viewingDoc.docType === 'facture' && showPaymentInOfficialInvoice && viewingDoc.amountPaid !== undefined && (Number(viewingDoc.total || 0) - Number(viewingDoc.amountPaid)) > 0 && (
                    <div className="flex justify-between items-center text-rose-600 font-bold pt-1">
                      <span>{lang === 'ar' ? 'الباقي (كريدي):' : 'Reste (Crédit):'}</span>
                      <span className="font-mono font-black text-sm">{(Number(viewingDoc.total || 0) - Number(viewingDoc.amountPaid)).toFixed(2)} {config.currency}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Arrêtée la présente facture clause (Centered) with full written words */}
              {(() => {
                const totalWithPrev = Number(viewingDoc.total || 0) + Number(viewingDoc.previousBalance || 0);
                const isArabic = lang === 'ar';
                const words = isArabic
                  ? amountToWordsAr(totalWithPrev, config.currency)
                  : amountToWordsFr(totalWithPrev, config.currency);
                const prefixLabel = isArabic
                  ? (viewingDoc.docType === 'devis' ? 'أوقف هذا العرض عند مبلغ : ' : viewingDoc.docType === 'bon_commande' ? 'أوقف سند الطلب عند مبلغ : ' : viewingDoc.docType === 'bon_livraison' ? 'أوقف سند التسليم عند مبلغ : ' : 'أوقفت هذه الفاتورة عند مبلغ : ')
                  : (viewingDoc.docType === 'devis' ? 'Arrêté le présent devis à la somme de : ' : viewingDoc.docType === 'bon_commande' ? 'Arrêté le présent bon de commande à la somme de : ' : viewingDoc.docType === 'bon_livraison' ? 'Arrêté le présent bon de livraison à la somme de : ' : 'Arrêtée la présente facture à la somme de : ');
                return (
                  <div className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-200 text-xs text-slate-800 font-bold text-center shadow-xs">
                    <div className="text-slate-900 font-extrabold text-[12px] leading-relaxed">
                      <span>{prefixLabel}</span>
                      <span className="text-indigo-700 font-black">{words}</span>
                    </div>
                  </div>
                );
              })()}

              {/* Official Signatures & Stamp Blocks */}
              <div className="grid grid-cols-2 gap-8 pt-4 border-t border-slate-200">
                <div className="border border-solid border-slate-300 rounded-2xl p-4 h-28 flex flex-col justify-between text-center bg-slate-50/40">
                  <span className="text-xs font-bold text-slate-600">
                    {viewingDoc.docType === 'devis' && (lang === 'ar' ? 'موافقة وتوقيع الزبون (Bon pour accord):' : 'Bon pour accord client:')}
                    {viewingDoc.docType === 'bon_commande' && (lang === 'ar' ? 'توقيع الزبون بالموافقة:' : 'Signature du Client:')}
                    {viewingDoc.docType === 'bon_livraison' && (lang === 'ar' ? 'توقيع المستلم وتأكيد الاستلام:' : 'Accusé de réception client:')}
                    {viewingDoc.docType === 'facture' && (lang === 'ar' ? 'توقيع الزبون:' : 'Signature Client:')}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono italic">Date & Signature</span>
                </div>
                <div className="border border-solid border-slate-300 rounded-2xl p-4 h-28 flex flex-col justify-between text-center bg-slate-50/40">
                  <span className="text-xs font-bold text-slate-600">
                    {lang === 'ar' ? 'خاتم وتوقيع المؤسسة:' : 'Cachet et Signature de l\'Entreprise:'}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono italic">Cachet & Signature</span>
                </div>
              </div>

              {/* Barcode (Code-39) when enabled in settings */}
              {config.showBarcodeOnInvoice !== false && viewingDoc?.docNumber && (
                <div className="flex flex-col items-center justify-center pt-4">
                  <div
                    dangerouslySetInnerHTML={{
                      __html: generateBarcodeSvg(viewingDoc.docNumber, 32)
                    }}
                  />
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

            {/* Bottom Modal Actions with Clean Back Button */}
            <div className="bg-slate-50 px-4 sm:px-6 py-3.5 border-t border-slate-200 flex items-center justify-between gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => setViewingDoc(null)}
                className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
              >
                <ArrowRight className={`w-4 h-4 ${isRTL ? '' : 'rotate-180'}`} />
                <span>{lang === 'ar' ? 'رجوع للقائمة' : 'Retour'}</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL 2B: 80MM THERMAL RECEIPT PREVIEW & PRINT */}
      {receiptPreviewDoc && createPortal(
        <div
          className="fixed inset-0 bg-slate-900/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 z-[120] overflow-y-auto safe-modal-overlay"
          onClick={() => setReceiptPreviewDoc(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-[360px] max-h-[92vh] overflow-hidden animate-fade-in flex flex-col my-auto"
          >
            <div className="flex justify-between items-center bg-slate-900 text-white px-4 py-3 border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-emerald-400" />
                <span className="font-bold text-xs">
                  {lang === 'ar' ? 'معاينة فاتورة صغيرة (80mm)' : 'Ticket de Caisse (80mm)'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setReceiptPreviewDoc(null)}
                className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1 bg-slate-100 flex justify-center">
              <div
                className="bg-white shadow-md border border-slate-200 p-3 w-full max-w-[302px] text-black"
                dangerouslySetInnerHTML={{
                  __html: buildUnified80mmReceiptHtml(
                    {
                      invoiceNumber: receiptPreviewDoc.docNumber,
                      date: receiptPreviewDoc.date,
                      customerName: receiptPreviewDoc.customerName,
                      sellerName: receiptPreviewDoc.sellerName || 'admin',
                      docTitle: getDocTypeLabel(receiptPreviewDoc.docType),
                      docNumberLabel: lang === 'ar' ? 'رقم الوثيقة:' : 'N°:',
                      partyLabel: lang === 'ar' ? 'الزبون :' : 'Client :',
                      items: getSafeDocItems(receiptPreviewDoc).map((it) => ({
                        productName: it.productName,
                        quantity: it.quantity,
                        sellingPrice: it.sellingPrice,
                        discount: it.discount,
                        total: it.total,
                      })),
                      subtotal: receiptPreviewDoc.subtotal,
                      discount: receiptPreviewDoc.discount,
                      tax: receiptPreviewDoc.tax,
                      total: receiptPreviewDoc.total,
                      amountPaid:
                        receiptPreviewDoc.amountPaid !== undefined
                          ? receiptPreviewDoc.amountPaid
                          : receiptPreviewDoc.total,
                      previousBalance: receiptPreviewDoc.previousBalance,
                    },
                    config,
                    lang,
                    t.invoice.thankYou
                  ),
                }}
              />
            </div>

            <div className="bg-white p-3 border-t border-slate-200 flex gap-2 shrink-0">
              <button
                type="button"
                onClick={() => triggerReceipt80mmPrint(receiptPreviewDoc)}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>{lang === 'ar' ? 'طباعة 80mm' : 'Imprimer 80mm'}</span>
              </button>
              <button
                type="button"
                onClick={() => handleExportDocPdf(receiptPreviewDoc, '80mm')}
                className="py-2.5 px-3 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs transition flex items-center justify-center gap-1 shadow-sm cursor-pointer"
              >
                <FileDown className="w-4 h-4" />
                <span>PDF</span>
              </button>
              <button
                type="button"
                onClick={() => setReceiptPreviewDoc(null)}
                className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
              >
                {lang === 'ar' ? 'إغلاق' : 'Fermer'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL 3: DELETE CONFIRMATION */}
      {deletingId && createPortal(
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[100] animate-fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-200 space-y-4 text-center">
            <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="font-black text-slate-900 text-base">
              {lang === 'ar' ? 'تأكيد حذف الوثيقة' : 'Confirmer la suppression'}
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              {lang === 'ar' ? 'هل أنت متأكد من رغبتك في حذف هذه الوثيقة؟ لا يمكن التراجع عن هذا الإجراء.' : 'Êtes-vous sûr de vouloir supprimer ce document ?'}
            </p>
            <div className="flex justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingId(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                {lang === 'ar' ? 'إلغاء' : 'Annuler'}
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteDocument(deletingId);
                  setDeletingId(null);
                  showToast(lang === 'ar' ? 'تم حذف الوثيقة بنجاح' : 'Document supprimé avec succès');
                }}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black transition cursor-pointer shadow-xs"
              >
                {lang === 'ar' ? 'حذف نهائي' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
