/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { CommercialDocument, CommercialDocType, CommercialDocStatus, Customer, Product, StoreConfig, Language, Invoice, InvoiceItem } from '../types';
import { languages } from '../languages';
import { 
  FileText, Plus, Search, Eye, Printer, Trash2, ArrowRightLeft, CheckCircle2, 
  Calendar, User, AlertCircle, X, Check, RefreshCw, FileCheck, Truck, ClipboardList,
  Edit, ArrowUpRight, Copy, Share2, Receipt, ShoppingCart, FileSpreadsheet, ArrowRight
} from 'lucide-react';
import { parseDecimal, sanitizeDecimalInput } from '../utils/numberInput';

interface CommercialDocumentsProps {
  initialType?: CommercialDocType;
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
  initialType = 'devis',
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
  const [viewingDoc, setViewingDoc] = useState<CommercialDocument | null>(null);
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
    sellingPrice: number;
    purchasePrice: number;
    quantity: number;
    discount: number;
    tax: number;
    total: number;
  }[]>([]);
  const [formDiscount, setFormDiscount] = useState<string>('0');
  const [formNotes, setFormNotes] = useState<string>('');

  // Product quick search in modal
  const [productSearch, setProductSearch] = useState('');
  const [showProductDropdown, setShowProductDropdown] = useState(false);

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

  // Filtered documents
  const filteredDocs = documents.filter(d => {
    const matchesType = d.docType === activeType;
    const s = search.toLowerCase();
    const matchesSearch = 
      d.docNumber.toLowerCase().includes(s) ||
      d.customerName.toLowerCase().includes(s) ||
      (d.customerPhone && d.customerPhone.includes(s)) ||
      (d.notes && d.notes.toLowerCase().includes(s));
    const matchesStatus = statusFilter === 'all' || d.status === statusFilter;
    return matchesType && matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: CommercialDocStatus) => {
    switch (status) {
      case 'draft':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
            {lang === 'ar' ? 'مسودة' : 'Brouillon'}
          </span>
        );
      case 'validated':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
            {lang === 'ar' ? 'مؤكد / ساري' : 'Validé'}
          </span>
        );
      case 'converted':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            {lang === 'ar' ? 'تم التحويل' : 'Converti'}
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
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
    setFormNotes('');
  };

  // Open Edit Form
  const handleOpenEdit = (doc: CommercialDocument) => {
    setEditingDoc(doc);
    setIsCreating(false);
    setFormCustomerId(doc.customerId);
    setFormCustomerName(doc.customerName);
    setFormCustomerPhone(doc.customerPhone || '');
    setFormCustomerAddress(doc.customerAddress || '');
    setFormDocDate(doc.date ? doc.date.split('T')[0] : new Date().toISOString().split('T')[0]);
    setFormValidUntil(doc.validUntil ? doc.validUntil.split('T')[0] : '');
    setFormItems(doc.items && doc.items.length > 0 ? [...doc.items] : [{
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
    setFormNotes(doc.notes || '');
  };

  const handleSelectCustomer = (cId: string) => {
    setFormCustomerId(cId);
    const found = customers.find(c => c.id === cId);
    if (found) {
      setFormCustomerName(found.name);
      setFormCustomerPhone(found.phone || '');
    }
  };

  // Add Item to form
  const handleAddProductToForm = (prod: Product) => {
    // If only one empty row exists, overwrite it
    if (formItems.length === 1 && !formItems[0].productId && !formItems[0].productName && formItems[0].sellingPrice === 0) {
      setFormItems([{
        productId: prod.id,
        productName: prod.name,
        sellingPrice: prod.sellingPrice,
        purchasePrice: prod.purchasePrice || 0,
        quantity: 1,
        discount: 0,
        tax: 0,
        total: prod.sellingPrice
      }]);
      setProductSearch('');
      setShowProductDropdown(false);
      return;
    }

    const existingIndex = formItems.findIndex(i => i.productId === prod.id);
    if (existingIndex >= 0) {
      const updated = [...formItems];
      updated[existingIndex].quantity += 1;
      const unit = updated[existingIndex].sellingPrice;
      const disc = updated[existingIndex].discount;
      updated[existingIndex].total = (unit - (unit * disc / 100)) * updated[existingIndex].quantity;
      setFormItems(updated);
    } else {
      const unit = prod.sellingPrice;
      setFormItems([
        ...formItems,
        {
          productId: prod.id,
          productName: prod.name,
          sellingPrice: unit,
          purchasePrice: prod.purchasePrice || 0,
          quantity: 1,
          discount: 0,
          tax: 0,
          total: unit
        }
      ]);
    }
    setProductSearch('');
    setShowProductDropdown(false);
  };

  const handleAddCustomItem = () => {
    setFormItems(prev => [
      ...prev,
      {
        productId: '',
        productName: '',
        sellingPrice: 0,
        purchasePrice: 0,
        quantity: 1,
        discount: 0,
        tax: 0,
        total: 0
      }
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
        updated[idx] = {
          ...updated[idx],
          productId: prod.id,
          productName: prod.name,
          sellingPrice: prod.sellingPrice,
          purchasePrice: prod.purchasePrice || 0,
          total: (prod.sellingPrice - (prod.sellingPrice * (updated[idx].discount || 0) / 100)) * (updated[idx].quantity || 1)
        };
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
    const price = parseDecimal(item.sellingPrice);
    const qty = Number(item.quantity) || 1;
    const disc = parseDecimal(item.discount);
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
  const subtotal = formItems.reduce((sum, item) => sum + (item.sellingPrice * item.quantity), 0);
  const itemDiscounts = formItems.reduce((sum, item) => sum + (item.sellingPrice * (item.discount / 100) * item.quantity), 0);
  const totalDiscount = itemDiscounts + parseDecimal(formDiscount, 0);
  const taxRate = config.taxRate || 0;
  const taxableTotal = Math.max(0, subtotal - totalDiscount);
  const totalTax = (taxableTotal * taxRate) / 100;
  const netTotal = taxableTotal + totalTax;

  // Submit form (Save / Update)
  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCustomerName.trim()) {
      alert(lang === 'ar' ? 'الرجاء إدخال اسم الزبون' : 'Veuillez saisir le nom du client');
      return;
    }
    if (formItems.length === 0) {
      alert(lang === 'ar' ? 'الرجاء إضافة عنصر واحد على الأقل' : 'Veuillez ajouter au moins un article');
      return;
    }

    const docId = editingDoc ? editingDoc.id : `doc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const docNumber = editingDoc ? editingDoc.docNumber : generateNextDocNumber(activeType);

    const newDoc: CommercialDocument = {
      id: docId,
      docType: activeType,
      docNumber,
      date: new Date(formDocDate).toISOString(),
      validUntil: activeType === 'devis' ? formValidUntil : undefined,
      customerId: formCustomerId || 'walk-in',
      customerName: formCustomerName,
      customerPhone: formCustomerPhone,
      customerAddress: formCustomerAddress,
      items: formItems,
      subtotal,
      discount: totalDiscount,
      tax: totalTax,
      total: netTotal,
      status: editingDoc ? editingDoc.status : 'validated',
      notes: formNotes,
      convertedTo: editingDoc?.convertedTo,
      convertedFrom: editingDoc?.convertedFrom
    };

    onSaveDocument(newDoc);
    setIsCreating(false);
    setEditingDoc(null);
    showToast(lang === 'ar' ? `تم حفظ ${getDocTypeLabel(activeType)} رقم ${docNumber} بنجاح` : `${getDocTypeLabel(activeType)} enregistré avec succès`);
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

  // 3. Convert to Facture (Creates commercial doc + triggers system invoice)
  const handleConvertToFacture = (sourceDoc: CommercialDocument) => {
    const nextNumber = generateNextDocNumber('facture');
    const newDoc: CommercialDocument = {
      ...sourceDoc,
      id: `doc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      docType: 'facture',
      docNumber: nextNumber,
      date: new Date().toISOString(),
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

    // Also trigger system invoice so it enters sales stats, customer ledger, debt
    onConvertToInvoice(newDoc);
    setViewingDoc(newDoc);
    showToast(lang === 'ar' ? `🎉 تم تحويل الوثيقة إلى فاتورة رسمية رقم ${nextNumber} وإضافتها للمبيعات!` : `🎉 Converti avec succès en Facture ${nextNumber}!`);
  };

  const triggerPrint = () => {
    if (!viewingDoc) return;
    const printArea = document.getElementById('printable-commercial-doc');
    if (!printArea) {
      window.print();
      return;
    }
    const printWin = window.open('', '_blank', 'width=900,height=800');
    if (!printWin) {
      window.print();
      return;
    }
    printWin.document.write(`
      <!DOCTYPE html>
      <html dir="${isRTL ? 'rtl' : 'ltr'}">
        <head>
          <meta charset="utf-8">
          <title>${viewingDoc.docNumber} - ${config.name || 'Commercial Document'}</title>
          <style>
            @page { size: A4; margin: 15mm; }
            * { box-sizing: border-box; }
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Cairo', 'Tajawal', sans-serif;
              color: #1e293b;
              margin: 0;
              padding: 20px;
              font-size: 13px;
              direction: ${isRTL ? 'rtl' : 'ltr'};
            }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            th, td { border: 1px solid #cbd5e1; padding: 8px 10px; }
            th { background-color: #f1f5f9; font-weight: 800; }
            .text-center { text-align: center; }
            .text-end { text-align: end; }
            .text-start { text-align: start; }
            .font-bold { font-weight: 700; }
            .font-black { font-weight: 900; }
            .font-mono { font-family: monospace; }
            img { max-height: 50px; }
            @media print {
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          ${printArea.innerHTML}
        </body>
      </html>
    `);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => {
      printWin.print();
      printWin.close();
    }, 450);
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
      <div dir={isRTL ? 'rtl' : 'ltr'} className="space-y-6 text-start max-w-7xl mx-auto animate-fade-in">
        {/* Toast Notification */}
        {toastMessage && (
          <div className={`fixed top-6 start-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 text-xs font-bold animate-fade-in border ${
            toastMessage.includes('⚠️')
              ? 'bg-slate-950 text-amber-300 border-amber-500/50'
              : 'bg-slate-900 text-white border-slate-700'
          }`}>
            {toastMessage.includes('⚠️') ? (
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            )}
            <span>{toastMessage}</span>
          </div>
        )}

        {/* 1. Header Bar with Client Selection & Date & Doc Number */}
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs space-y-4">
          <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
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
              className="px-3.5 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition cursor-pointer flex items-center gap-2 shrink-0 shadow-2xs"
            >
              <ClipboardList className="w-4 h-4 text-indigo-600" />
              <span>{lang === 'ar' ? 'سجل الوثائق التجارية' : 'Registre des documents'}</span>
              <ArrowRight className={`w-3.5 h-3.5 ${isRTL ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {/* Integrated Client Selector & Info */}
          <div className="pt-3 border-t border-slate-100 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
              {/* Client Dropdown */}
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
                        {c.name} {c.phone ? `(${c.phone})` : ''} {c.debt > 0 ? `[${lang === 'ar' ? 'دين' : 'Dette'}: ${c.debt.toFixed(0)} ${config.currency}]` : ''}
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
              <div className="px-3 py-1.5 bg-rose-50 border border-rose-100 rounded-xl text-xs font-bold text-rose-700 flex items-center gap-2">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{lang === 'ar' ? `تنبيه: هذا الزبون لديه ديون سابقة معلقة بقيمة ${selectedCust.debt.toFixed(2)} ${config.currency}` : `Dette en cours: ${selectedCust.debt.toFixed(2)} ${config.currency}`}</span>
              </div>
            )}
          </div>
        </div>

        {/* Main Document Form */}
        <form onSubmit={handleSubmitForm} className="space-y-6">
          {/* 2. Quick Barcode / Product Search Card (Placed ABOVE Items Table as in PurchaseEntry) */}
          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs space-y-3 relative">
            <div className="flex justify-between items-center">
              <label className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                <Search className="w-4 h-4 text-indigo-600" />
                <span>{lang === 'ar' ? '🔍 مسح الباركود أو البحث السريع لإضافة منتج للجدول أدناه' : '🔍 Scan SKU or Search to Add Product to Table Below'}</span>
              </label>
              <button
                type="button"
                onClick={handleAddCustomItem}
                className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 transition cursor-pointer flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{lang === 'ar' ? 'إضافة سطر صنف مخصص' : 'Ajouter ligne personnalisée'}</span>
              </button>
            </div>

            <div className="relative">
              <span className={`absolute inset-y-0 ${isRTL ? 'right-3' : 'left-3'} flex items-center text-slate-400 pointer-events-none`}>
                <Search className="w-4 h-4" />
              </span>
              <input
                type="text"
                placeholder={lang === 'ar' ? 'اكتب اسم المنتج أو امسح الباركود (SKU) للإضافة المباشرة...' : 'Type product name or scan SKU...'}
                value={productSearch}
                onChange={(e) => {
                  setProductSearch(e.target.value);
                  setShowProductDropdown(true);
                }}
                onFocus={() => setShowProductDropdown(true)}
                className={`w-full py-2.5 ${isRTL ? 'pr-9 pl-8' : 'pl-9 pr-8'} bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition`}
              />
              {productSearch && (
                <button
                  type="button"
                  onClick={() => {
                    setProductSearch('');
                    setShowProductDropdown(false);
                  }}
                  className={`absolute inset-y-0 ${isRTL ? 'left-3' : 'right-3'} flex items-center text-slate-400 hover:text-slate-600`}
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Instant Search Dropdown */}
            {showProductDropdown && productSearch.trim().length > 0 && (
              <div className="absolute z-30 top-full left-5 right-5 mt-1 bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden max-h-56 overflow-y-auto animate-fade-in">
                {products
                  .filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase()) || (p.sku && p.sku.toLowerCase().includes(productSearch.toLowerCase())))
                  .slice(0, 10)
                  .map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleAddProductToForm(p)}
                      className="w-full px-4 py-2.5 hover:bg-indigo-50/70 flex items-center justify-between text-start transition cursor-pointer"
                    >
                      <div>
                        <span className="font-bold text-xs text-slate-800 block">{p.name}</span>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono mt-0.5">
                          <span>SKU: {p.sku || 'N/A'}</span>
                          {p.category && <span>• {p.category}</span>}
                          <span className="text-slate-600 font-semibold">• {lang === 'ar' ? `المخزون المتوفر: ${p.stock}` : `Stock: ${p.stock}`}</span>
                        </div>
                      </div>
                      <div className="text-end">
                        <span className="font-mono font-bold text-xs text-indigo-600">{p.sellingPrice.toFixed(2)} {config.currency}</span>
                        <span className="block text-[9px] text-slate-400 font-semibold">{lang === 'ar' ? 'سعر البيع' : 'Prix de vente'}</span>
                      </div>
                    </button>
                  ))}
              </div>
            )}
          </div>

          {/* 3. Items Table Card */}
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xs space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-sm font-black text-slate-800 flex items-center gap-2">
                <span>{lang === 'ar' ? 'قائمة المواد والأسعار' : 'Articles & Prestations'}</span>
                <span className="px-2.5 py-0.5 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-full border border-indigo-100">
                  {formItems.length} {lang === 'ar' ? 'مواد' : 'items'}
                </span>
              </h2>
              <button
                type="button"
                onClick={handleAddCustomItem}
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>{lang === 'ar' ? 'إضافة سطر مادة' : 'Ajouter un article'}</span>
              </button>
            </div>

            <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-start">
                  <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4 text-start">{lang === 'ar' ? 'المادة / الصنف' : 'Désignation'}</th>
                      <th className="py-3 px-4 text-center w-36">{lang === 'ar' ? `سعر الوحدة (${config.currency})` : `Prix Unitaire (${config.currency})`}</th>
                      <th className="py-3 px-4 text-center w-28">{lang === 'ar' ? 'الكمية' : 'Quantité'}</th>
                      <th className="py-3 px-4 text-center w-28">{lang === 'ar' ? 'خصم %' : 'Remise %'}</th>
                      <th className="py-3 px-4 text-end w-36">{lang === 'ar' ? `المجموع (${config.currency})` : `Total (${config.currency})`}</th>
                      <th className="py-3 px-3 text-center w-12"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {formItems.map((item, idx) => {
                      const matchedProd = products.find(p => p.id === item.productId);
                      const itemPurchasePrice = Number(item.purchasePrice || matchedProd?.purchasePrice || 0);
                      const unitPriceVal = parseDecimal(item.sellingPrice, 0);
                      const discVal = parseDecimal(item.discount, 0);
                      const effectiveUnitPrice = unitPriceVal - (unitPriceVal * discVal / 100);
                      const isBelowPurchasePrice =
                        String(item.sellingPrice ?? '').trim() !== '' &&
                        itemPurchasePrice > 0 &&
                        effectiveUnitPrice < itemPurchasePrice;

                      return (
                        <tr key={idx} className={`transition ${isBelowPurchasePrice ? 'bg-amber-50/30 hover:bg-amber-50/50' : 'hover:bg-slate-50/50'}`}>
                          <td className="py-3 px-4">
                            <div className="space-y-1.5">
                              <select
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white"
                                value={item.productId}
                                onChange={(e) => handleItemChange(idx, 'productId', e.target.value)}
                              >
                                <option value="">-- {lang === 'ar' ? 'صنف غير مسجل (إدخال يدوي)' : 'Unregistered (Manual Text)'} --</option>
                                {products.map(p => (
                                  <option key={p.id} value={p.id}>
                                    {p.name} ({p.sellingPrice} {config.currency} / {lang === 'ar' ? `المخزون: ${p.stock}` : `Stock: ${p.stock}`})
                                  </option>
                                ))}
                              </select>
                              {(!item.productId || item.productId.startsWith('custom_')) && (
                                <input
                                  type="text"
                                  required
                                  placeholder={lang === 'ar' ? 'أدخل اسم الصنف أو الخدمة يدوياً...' : 'Type manual product or service name...'}
                                  className="w-full bg-white border border-indigo-200 rounded-xl px-3 py-1.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                  value={item.productName}
                                  onChange={(e) => handleItemChange(idx, 'productName', e.target.value)}
                                />
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
                          <td className="py-3 px-4 text-center align-top">
                            <input
                              type="text"
                              inputMode="decimal"
                              placeholder="0.00"
                              required
                              className={`w-full border rounded-xl px-3 py-2 text-xs font-bold font-mono text-center focus:outline-none focus:ring-1 ${
                                isBelowPurchasePrice
                                  ? 'bg-amber-50 border-amber-400 text-rose-700 focus:ring-rose-500'
                                  : 'bg-slate-50 border-slate-200 text-slate-800 focus:ring-indigo-500 focus:bg-white'
                              }`}
                              value={item.sellingPrice || ''}
                              onChange={(e) => handleItemChange(idx, 'sellingPrice', sanitizeDecimalInput(e.target.value))}
                              onBlur={(e) => handleItemChange(idx, 'sellingPrice', sanitizeDecimalInput(e.target.value), true)}
                            />
                          </td>
                          <td className="py-3 px-4 text-center align-top">
                            <input
                              type="number"
                              min="1"
                              required
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold font-mono text-center text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white"
                              value={item.quantity || ''}
                              onChange={(e) => handleItemChange(idx, 'quantity', Number(e.target.value))}
                            />
                          </td>
                          <td className="py-3 px-4 text-center align-top">
                            <input
                              type="text"
                              inputMode="decimal"
                              placeholder="0"
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold font-mono text-center text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white"
                              value={item.discount || ''}
                              onChange={(e) => handleItemChange(idx, 'discount', sanitizeDecimalInput(e.target.value))}
                              onBlur={(e) => handleItemChange(idx, 'discount', sanitizeDecimalInput(e.target.value), true)}
                            />
                          </td>
                          <td className="py-3 px-4 text-end font-mono font-black text-slate-800 align-top pt-3.5 text-sm">
                            {item.total.toFixed(2)} {config.currency}
                          </td>
                          <td className="py-3 px-3 text-center align-top pt-3">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(idx)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Subtotal */}
            <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs space-y-1">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                {lang === 'ar' ? 'المجموع الفرعي (HT)' : 'Sous-total HT'}
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
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-bold font-mono text-rose-700"
                value={formDiscount}
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

            {/* Card 4: Net Grand Total */}
            <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs space-y-1">
              <span className="text-[10px] font-black text-indigo-600 uppercase tracking-wider block">
                {lang === 'ar' ? 'المجموع الصافي النهائي (TTC)' : 'Total Net TTC'}
              </span>
              <div className="text-2xl font-black text-indigo-700 font-mono">
                {netTotal.toFixed(2)} <span className="text-xs font-bold text-indigo-500">{config.currency}</span>
              </div>
            </div>
          </div>

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
          <div className={`bg-white p-5 rounded-3xl border border-slate-100 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <div className="text-sm font-bold text-slate-600">
              <span className="text-slate-400 font-medium">{lang === 'ar' ? 'المجموع النهائي للوثيقة:' : 'Total net:'} </span>
              <span className="font-mono font-black text-slate-900 text-lg sm:text-xl">{netTotal.toFixed(2)} {config.currency}</span>
            </div>

            <div className="flex items-center gap-3">
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
                  setFormDiscount(0);
                  setFormNotes('');
                  setProductSearch('');
                }}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>{lang === 'ar' ? 'تفريغ الحقول' : 'Vider'}</span>
              </button>

              <button
                type="button"
                onClick={() => { setIsCreating(false); setEditingDoc(null); }}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5"
              >
                <X className="w-3.5 h-3.5" />
                <span>{lang === 'ar' ? 'إلغاء والعودة' : 'Annuler'}</span>
              </button>

              <button
                type="submit"
                disabled={formItems.length === 0}
                className={`px-7 py-2.5 ${visuals.buttonBg} text-white text-xs font-black rounded-xl transition cursor-pointer shadow-sm disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center gap-2`}
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {editingDoc 
                    ? (lang === 'ar' ? 'تحديث وحفظ التعديلات' : 'Enregistrer modifications') 
                    : (lang === 'ar' ? 'حفظ وتأكيد الوثيقة' : 'Enregistrer le document')}
                </span>
              </button>
            </div>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-start max-w-7xl mx-auto animate-fade-in" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 start-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 text-xs font-bold animate-fade-in border border-slate-700">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header Card */}
      {/* Top Header Card */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-2xl">
              <ClipboardList className="w-6 h-6" />
            </div>
            <span>{lang === 'ar' ? 'إدارة الوثائق التجارية (Devis / BC / BL / Facture)' : 'Commercial Documents Management'}</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            {lang === 'ar' 
              ? 'إنشاء عروض الأسعار، وسندات الطلب، وسندات التسليم مع إمكانية تحويل أي وثيقة بضغطة زر إلى فاتورة رسمية' 
              : 'Create Devis, Purchase Orders & Delivery Notes with 1-click conversion to Official Invoice'}
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenCreate}
          className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl transition cursor-pointer flex items-center gap-2 shadow-xs shrink-0 active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>
            {activeType === 'devis' && (lang === 'ar' ? '+ إنشاء عرض سعر جديد (Devis)' : '+ Nouveau Devis')}
            {activeType === 'bon_commande' && (lang === 'ar' ? '+ إنشاء سند طلبية جديد (Bon de commande)' : '+ Nouveau Bon de commande')}
            {activeType === 'bon_livraison' && (lang === 'ar' ? '+ إنشاء سند تسليم جديد (Bon de livraison)' : '+ Nouveau Bon de livraison')}
            {activeType === 'facture' && (lang === 'ar' ? '+ إنشاء فاتورة جديدة (Facture)' : '+ Nouvelle Facture')}
          </span>
        </button>
      </div>

      {/* Document Type Selector Cards Bar - Elegant & Clear Redesign */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[
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

      {/* Search & Status Filters Bar */}
      <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative flex-1 w-full">
          <span className={`absolute inset-y-0 ${isRTL ? 'right-3.5' : 'left-3.5'} flex items-center text-slate-400 pointer-events-none`}>
            <Search className="w-4 h-4" />
          </span>
          <input
            type="text"
            placeholder={lang === 'ar' ? 'بحث برقم الوثيقة، اسم الزبون، رقم الهاتف...' : 'Search by doc number, client name, phone...'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`w-full py-2.5 ${isRTL ? 'pr-10 pl-4' : 'pl-10 pr-4'} bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition`}
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full sm:w-auto bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
          >
            <option value="all">{lang === 'ar' ? 'جميع الحالات' : 'Tous les états'}</option>
            <option value="draft">{lang === 'ar' ? 'مسودة' : 'Brouillon'}</option>
            <option value="validated">{lang === 'ar' ? 'مؤكد / ساري' : 'Validé'}</option>
            <option value="converted">{lang === 'ar' ? 'تم التحويل' : 'Converti'}</option>
            <option value="cancelled">{lang === 'ar' ? 'ملغى' : 'Annulé'}</option>
          </select>
        </div>
      </div>

      {/* Documents Table */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-start">
            <thead className="bg-slate-50 text-slate-500 font-black uppercase text-[10px] border-b border-slate-200">
              <tr>
                <th className="py-3.5 px-4 text-start">{lang === 'ar' ? 'رقم الوثيقة' : 'N° Document'}</th>
                <th className="py-3.5 px-4 text-start">{lang === 'ar' ? 'التاريخ' : 'Date'}</th>
                <th className="py-3.5 px-4 text-start">{lang === 'ar' ? 'الزبون' : 'Client'}</th>
                <th className="py-3.5 px-4 text-center">{lang === 'ar' ? 'المواد' : 'Articles'}</th>
                <th className="py-3.5 px-4 text-end">{lang === 'ar' ? 'المبلغ الإجمالي' : 'Total'}</th>
                <th className="py-3.5 px-4 text-center">{lang === 'ar' ? 'الحالة' : 'État'}</th>
                <th className="py-3.5 px-4 text-center">{lang === 'ar' ? 'التحويل والمتابعة' : 'Conversion'}</th>
                <th className="py-3.5 px-4 text-center">{lang === 'ar' ? 'إجراءات' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white font-semibold">
              {filteredDocs.length > 0 ? (
                filteredDocs.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3.5 px-4 font-mono font-black text-slate-900">
                      {doc.docNumber}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500">
                      {doc.date ? new Date(doc.date).toLocaleDateString() : ''}
                    </td>
                    <td className="py-3.5 px-4 text-slate-900 font-bold">
                      {doc.customerName}
                      {doc.customerPhone && (
                        <span className="block text-[10px] text-slate-400 font-mono">{doc.customerPhone}</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono">
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold">
                        {doc.items.length} {lang === 'ar' ? 'مواد' : 'art.'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-end font-mono font-black text-indigo-700 text-xs">
                      {doc.total.toFixed(2)} {config.currency}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {getStatusBadge(doc.status)}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {doc.convertedTo ? (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg inline-flex items-center gap-1">
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span>{doc.convertedTo.docNumber}</span>
                        </span>
                      ) : (
                        <div className="flex items-center justify-center gap-1">
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
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setViewingDoc(doc)}
                          className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition cursor-pointer"
                          title={lang === 'ar' ? 'معاينة وطباعة' : 'Aperçu & Imprimer'}
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(doc)}
                          className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition cursor-pointer"
                          title={lang === 'ar' ? 'تعديل' : 'Modifier'}
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingId(doc.id)}
                          className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                          title={lang === 'ar' ? 'حذف' : 'Supprimer'}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
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
          className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 z-[100] overflow-y-auto"
          onClick={() => setViewingDoc(null)}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[94vh] flex flex-col overflow-hidden animate-fade-in my-auto text-start"
          >
            {/* Top Bar with Clear Close Button and Conversion Actions */}
            <div className="flex flex-wrap justify-between items-center bg-slate-50 px-6 py-4 border-b border-slate-200 gap-3 shrink-0">
              <div className="flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-indigo-600" />
                <span className="font-mono font-bold text-slate-800 text-xs">
                  {viewingDoc.docNumber} • {getDocTypeLabel(viewingDoc.docType)}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* 1-Click Convert Actions inside modal */}
                {viewingDoc.docType === 'devis' && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleConvertToBC(viewingDoc)}
                      className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-xl text-xs font-black flex items-center gap-1 cursor-pointer transition shadow-2xs"
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5" />
                      <span>{lang === 'ar' ? 'تحويل إلى Bon de commande (-> BC)' : 'Convertir en BC'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleConvertToFacture(viewingDoc)}
                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center gap-1 cursor-pointer transition shadow-xs"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-200" />
                      <span>{lang === 'ar' ? 'تحويل إلى فاتورة (-> Facture)' : 'Convertir en Facture'}</span>
                    </button>
                  </>
                )}

                {viewingDoc.docType === 'bon_commande' && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleConvertToBL(viewingDoc)}
                      className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-black flex items-center gap-1 cursor-pointer transition shadow-2xs"
                    >
                      <Truck className="w-3.5 h-3.5" />
                      <span>{lang === 'ar' ? 'تحويل إلى Bon de livraison (-> BL)' : 'Convertir en BL'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleConvertToFacture(viewingDoc)}
                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center gap-1 cursor-pointer transition shadow-xs"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-200" />
                      <span>{lang === 'ar' ? 'تحويل إلى فاتورة (-> Facture)' : 'Convertir en Facture'}</span>
                    </button>
                  </>
                )}

                {viewingDoc.docType === 'bon_livraison' && (
                  <button
                    type="button"
                    onClick={() => handleConvertToFacture(viewingDoc)}
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center gap-1 cursor-pointer transition shadow-xs"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-200" />
                    <span>{lang === 'ar' ? 'تحويل إلى فاتورة رسمية (-> Facture)' : 'Convertir en Facture'}</span>
                  </button>
                )}

                {/* Print button */}
                <button
                  type="button"
                  onClick={triggerPrint}
                  className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer transition shadow-xs"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>{lang === 'ar' ? 'طباعة' : 'Imprimer'}</span>
                </button>

                {/* Explicit Close Button */}
                <button
                  type="button"
                  onClick={() => setViewingDoc(null)}
                  className="px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-black flex items-center gap-1 cursor-pointer transition"
                >
                  <X className="w-4 h-4" />
                  <span>{lang === 'ar' ? 'إغلاق الصفحة' : 'Fermer'}</span>
                </button>
              </div>
            </div>

            {/* Printable A4 Sheet Body */}
            <div className="p-8 space-y-6 overflow-y-auto flex-1 bg-white" id="printable-commercial-doc">
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
                    <span>{viewingDoc.date ? new Date(viewingDoc.date).toLocaleDateString() : ''}</span>
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
                  {lang === 'ar' ? 'المرسل إليه / بيانات العميل (Client)' : 'Informations Client'}
                </span>
                <p className="font-black text-slate-900 text-sm">{viewingDoc.customerName}</p>
                {viewingDoc.customerPhone && (
                  <p className="text-slate-600 font-medium mt-0.5">{lang === 'ar' ? 'الهاتف:' : 'Tél:'} <span className="font-mono font-bold text-slate-800">{viewingDoc.customerPhone}</span></p>
                )}
                {viewingDoc.customerAddress && (
                  <p className="text-slate-600 mt-0.5">{lang === 'ar' ? 'العنوان:' : 'Adresse:'} {viewingDoc.customerAddress}</p>
                )}
              </div>

              {/* Items Table */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden text-xs shadow-2xs">
                <table className="w-full">
                  <thead className="bg-slate-100 text-slate-700 font-black border-b border-slate-200 text-[11px]">
                    <tr>
                      <th className="px-4 py-3 text-start w-12">#</th>
                      <th className="px-4 py-3 text-start">{lang === 'ar' ? 'البيان / المادة' : 'Désignation'}</th>
                      <th className="px-4 py-3 text-center w-24">{lang === 'ar' ? 'الكمية' : 'Quantité'}</th>
                      <th className="px-4 py-3 text-center w-32">{lang === 'ar' ? 'سعر الوحدة' : 'Prix Unitaire'}</th>
                      <th className="px-4 py-3 text-center w-20">{lang === 'ar' ? 'خصم %' : 'Remise'}</th>
                      <th className="px-4 py-3 text-end w-32">{lang === 'ar' ? 'المجموع' : 'Total'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-semibold bg-white">
                    {(viewingDoc.items || []).map((item, idx) => {
                      const itemPrice = Number(item.sellingPrice ?? 0);
                      const itemDiscount = Number(item.discount ?? 0);
                      const itemTotal = Number(item.total ?? (itemPrice * (item.quantity || 1)));
                      return (
                        <tr key={idx} className="hover:bg-slate-50/60 transition">
                          <td className="px-4 py-3 text-slate-400 text-start">{idx + 1}</td>
                          <td className="px-4 py-3 text-slate-900 font-bold">{item.productName || 'منتج'}</td>
                          <td className="px-4 py-3 text-center font-mono font-bold text-slate-800">{item.quantity || 1}</td>
                          <td className="px-4 py-3 text-center font-mono text-slate-600">{itemPrice.toFixed(2)} {config.currency}</td>
                          <td className="px-4 py-3 text-center font-mono text-slate-600">{itemDiscount > 0 ? `${itemDiscount}%` : '-'}</td>
                          <td className="px-4 py-3 text-end font-black text-slate-900 font-mono">
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
                    <span>{lang === 'ar' ? 'المجموع الفرعي (HT):' : 'Total HT:'}</span>
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
                      <span>{lang === 'ar' ? 'الضريبة TVA:' : 'TVA:'}</span>
                      <span className="font-mono">{Number(viewingDoc.tax || 0).toFixed(2)} {config.currency}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center border-t border-slate-200 pt-2 text-slate-900 font-black text-sm">
                    <span>{lang === 'ar' ? 'الصافي الإجمالي (TTC):' : 'Net TTC:'}</span>
                    <span className="text-xl font-black text-indigo-700 font-mono">{Number(viewingDoc.total || 0).toFixed(2)} {config.currency}</span>
                  </div>
                </div>
              </div>

              {/* Official Signatures & Stamp Blocks */}
              <div className="grid grid-cols-2 gap-8 pt-6 border-t-2 border-slate-200">
                <div className="border border-dashed border-slate-300 rounded-2xl p-4 h-28 flex flex-col justify-between text-center bg-slate-50/40">
                  <span className="text-xs font-bold text-slate-600">
                    {viewingDoc.docType === 'devis' && (lang === 'ar' ? 'موافقة وتوقيع الزبون (Bon pour accord):' : 'Bon pour accord client:')}
                    {viewingDoc.docType === 'bon_commande' && (lang === 'ar' ? 'توقيع الزبون بالموافقة:' : 'Signature du Client:')}
                    {viewingDoc.docType === 'bon_livraison' && (lang === 'ar' ? 'توقيع المستلم وتأكيد الاستلام:' : 'Accusé de réception client:')}
                    {viewingDoc.docType === 'facture' && (lang === 'ar' ? 'توقيع الزبون:' : 'Signature Client:')}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono italic">Date & Signature</span>
                </div>
                <div className="border border-dashed border-slate-300 rounded-2xl p-4 h-28 flex flex-col justify-between text-center bg-slate-50/40">
                  <span className="text-xs font-bold text-slate-600">
                    {lang === 'ar' ? 'خاتم وتوقيع المؤسسة:' : 'Cachet et Signature de l\'Entreprise:'}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono italic">Cachet & Signature</span>
                </div>
              </div>
            </div>

            {/* Bottom Modal Actions */}
            <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setViewingDoc(null)}
                className="px-6 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5"
              >
                <X className="w-4 h-4 text-slate-600" />
                <span>{lang === 'ar' ? 'إغلاق الصفحة' : 'Fermer'}</span>
              </button>

              <button
                type="button"
                onClick={triggerPrint}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black flex items-center gap-2 cursor-pointer transition shadow-xs"
              >
                <Printer className="w-4 h-4" />
                <span>{lang === 'ar' ? 'طباعة الوثيقة' : 'Imprimer'}</span>
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
