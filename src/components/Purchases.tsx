/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Purchase, PurchaseItem, Supplier, Product, Language } from '../types';
import { languages } from '../languages';
import { 
  ShoppingBag, 
  Search, 
  Plus, 
  Trash2, 
  Eye, 
  DollarSign, 
  CheckCircle, 
  Calendar, 
  TrendingDown, 
  TrendingUp,
  UserCheck, 
  X, 
  Layers, 
  Truck,
  AlertTriangle,
  Receipt,
  Printer,
  Building2,
  Phone,
  Mail,
  FileDown,
  ArrowRight
} from 'lucide-react';
import { StoreConfig } from '../types';
import { printHtmlContent, exportStructuredPdf, buildUnified80mmReceiptHtml } from '../utils/printService';
import { parseDecimal, sanitizeDecimalInput } from '../utils/numberInput';

interface PurchasesProps {
  purchases: Purchase[];
  suppliers: Supplier[];
  products: Product[];
  config: StoreConfig;
  onSavePurchase: (purchase: Purchase) => void;
  onDeletePurchase: (id: string) => void;
  onSettleSupplierDebt: (supplierId: string, amount: number, notes?: string) => void;
  lang: Language;
}

export default function Purchases({
  purchases,
  suppliers,
  products,
  config,
  onSavePurchase,
  onDeletePurchase,
  onSettleSupplierDebt,
  lang,
}: PurchasesProps) {
  const t = languages[lang];
  const isRTL = t.direction === 'rtl';

  const [search, setSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  
  // Modals / forms state
  const [isAddingPurchase, setIsAddingPurchase] = useState(false);
  const [isSettlingDebt, setIsSettlingDebt] = useState(false);
  const [viewingPurchase, setViewingPurchase] = useState<Purchase | null>(null);
  const [receiptPreviewPurchase, setReceiptPreviewPurchase] = useState<Purchase | null>(null);
  const [deletingPurchaseId, setDeletingPurchaseId] = useState<string | null>(null);
  const [overpayTarget, setOverpayTarget] = useState<{ supplierId: string; amount: number; notes?: string } | null>(null);

  // Settle Debt Form state
  const [settleSupplierId, setSettleSupplierId] = useState('');
  const [settleAmount, setSettleAmount] = useState('');
  const [settleNotes, setSettleNotes] = useState('');

  // Specific bill repayment states
  const [billPaymentAmount, setBillPaymentAmount] = useState('');
  const [billPaymentNotes, setBillPaymentNotes] = useState('');

  // Register Purchase Form state
  const [supplierId, setSupplierId] = useState('');
  const [notes, setNotes] = useState('');
  const [amountPaidState, setAmountPaidState] = useState('');
  const [cartItems, setCartItems] = useState<Array<{
    productId: string;
    productName: string;
    purchasePrice: number | string;
    quantity: number | string;
  }>>([
    { productId: '', productName: '', purchasePrice: 0, quantity: 1 }
  ]);

  // Product Search state in Add Purchase modal
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [showProductSearchResults, setShowProductSearchResults] = useState(false);

  // Search filtered products for the purchase catalog search
  const searchedProducts = productSearchQuery.trim()
    ? products.filter(p =>
        p.name.toLowerCase().includes(productSearchQuery.toLowerCase()) ||
        p.sku.toLowerCase().includes(productSearchQuery.toLowerCase()) ||
        (p.category && p.category.toLowerCase().includes(productSearchQuery.toLowerCase()))
      ).slice(0, 8)
    : [];

  const handleSelectSearchedProduct = (product: Product) => {
    // If the first cart item is empty and no others exist, replace it
    if (cartItems.length === 1 && !cartItems[0].productId && !cartItems[0].productName) {
      setCartItems([{
        productId: product.id,
        productName: product.name,
        purchasePrice: product.purchasePrice,
        quantity: 1
      }]);
    } else {
      const existingIdx = cartItems.findIndex(item => item.productId === product.id);
      if (existingIdx >= 0) {
        const updated = [...cartItems];
        const existingItem = updated[existingIdx];
        const nextItem = {
          ...existingItem,
          quantity: parseDecimal(existingItem.quantity, 0) + 1
        };
        updated.splice(existingIdx, 1);
        setCartItems([nextItem, ...updated]);
      } else {
        setCartItems([
          {
            productId: product.id,
            productName: product.name,
            purchasePrice: product.purchasePrice,
            quantity: 1
          },
          ...cartItems
        ]);
      }
    }
    setProductSearchQuery('');
    setShowProductSearchResults(false);
  };

  // Total calculated debts we owe to all suppliers
  const totalOurDebtsToSuppliers = suppliers.reduce((sum, s) => sum + (s.debt || 0), 0);

  // Filtered purchases
  const filteredPurchases = purchases.filter((p) => {
    const q = search.toLowerCase();
    const matchesSearch =
      p.purchaseNumber.toLowerCase().includes(q) ||
      p.supplierName.toLowerCase().includes(q) ||
      (p.notes && p.notes.toLowerCase().includes(q));
    const matchesStatus = selectedStatus === 'all' || p.status === selectedStatus;
    return matchesSearch && matchesStatus;
  });

  // Handle adding an item to the purchase cart form (Inserted at TOP)
  const handleAddCartItemRow = () => {
    setCartItems([{ productId: '', productName: '', purchasePrice: 0, quantity: 1 }, ...cartItems]);
  };

  // Handle removing an item from the purchase cart form
  const handleRemoveCartItemRow = (idx: number) => {
    if (cartItems.length === 1) return;
    setCartItems(cartItems.filter((_, i) => i !== idx));
  };

  // Handle changing input on items in purchase cart form
  const handleCartItemChange = (idx: number, field: keyof Omit<PurchaseItem, 'total'>, value: any) => {
    const updated = [...cartItems];
    if (field === 'productId') {
      const selectedProd = products.find(p => p.id === value);
      if (selectedProd) {
        updated[idx] = {
          productId: selectedProd.id,
          productName: selectedProd.name,
          purchasePrice: selectedProd.purchasePrice,
          quantity: updated[idx].quantity || 1
        };
      } else {
        updated[idx] = {
          ...updated[idx],
          productId: '',
          productName: '',
          purchasePrice: 0
        };
      }
    } else if (field === 'purchasePrice') {
      updated[idx].purchasePrice = value;
    } else if (field === 'quantity') {
      updated[idx].quantity = value;
    } else {
      updated[idx] = { ...updated[idx], [field]: value };
    }
    setCartItems(updated);
  };

  // Calculate current purchase form totals
  const getFormTotals = () => {
    const total = cartItems.reduce((sum, item) => {
      return sum + (parseDecimal(item.purchasePrice, 0) * parseDecimal(item.quantity, 0));
    }, 0);
    return total;
  };

  const formTotal = getFormTotals();

  // Submit new purchase bill
  const handlePurchaseSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!supplierId) {
      alert(lang === 'ar' ? 'يرجى اختيار المورّد أولاً.' : 'Please select a supplier.');
      return;
    }

    const selectedProp = suppliers.find(s => s.id === supplierId);
    if (!selectedProp) return;

    // Check items Validity
    const validItems: PurchaseItem[] = [];
    for (const item of cartItems) {
      const name = item.productName || (item.productId ? products.find(p => p.id === item.productId)?.name : '');
      if (!name) {
        alert(lang === 'ar' ? 'يرجى إدخال اسم أو اختيار صنف لكل سطر.' : 'Please enter or select a product for all rows.');
        return;
      }
      const pPrice = Math.max(0, parseDecimal(item.purchasePrice, 0));
      const qty = Math.max(0.01, parseDecimal(item.quantity, 1));
      validItems.push({
        productId: item.productId,
        productName: name,
        purchasePrice: pPrice,
        quantity: qty,
        total: pPrice * qty
      });
    }

    if (validItems.length === 0) {
      alert(lang === 'ar' ? 'يجب إضافة صنف واحد على الأقل.' : 'At least one item is required.');
      return;
    }

    const paid = Math.max(0, parseFloat(amountPaidState) || 0);
    
    let status: 'paid' | 'unpaid' | 'partial' = 'paid';
    if (paid === 0) {
      status = 'unpaid';
    } else if (paid < formTotal) {
      status = 'partial';
    }

    const newPO: Purchase = {
      id: 'pur_' + Date.now(),
      purchaseNumber: 'PO-2026-' + String(purchases.length + 101),
      date: new Date().toISOString(),
      supplierId: selectedProp.id,
      supplierName: selectedProp.name,
      items: validItems,
      total: formTotal,
      amountPaid: paid,
      status,
      notes: notes || undefined
    };

    onSavePurchase(newPO);
    
    // Reset Form
    setIsAddingPurchase(false);
    setSupplierId('');
    setNotes('');
    setAmountPaidState('');
    setCartItems([{ productId: '', productName: '', purchasePrice: 0, quantity: 1 }]);
    
    if (lang === 'ar') {
      alert('تم تسجيل فاتورة الشراء بنجاح وزيادة كميات المخزن وتحديث الديون.');
    } else {
      alert('Purchase invoice registered! Stock updated & supplier balance modified.');
    }
  };

  // Submit settle supplier debt
  const handleSettleDebtSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!settleSupplierId) {
      alert(lang === 'ar' ? 'يرجى اختيار المورّد لتسديد الدين له.' : 'Please select a supplier to pay.');
      return;
    }

    const value = Math.max(0, parseFloat(settleAmount) || 0);
    if (value <= 0) {
      alert(lang === 'ar' ? 'يرجى إدخال مبلغ صحيح أكبر من الصفر.' : 'Please enter a valid amount greater than zero.');
      return;
    }

    const selectedProp = suppliers.find(s => s.id === settleSupplierId);
    if (!selectedProp) return;

    if (value > (selectedProp.debt || 0)) {
      setOverpayTarget({ supplierId: settleSupplierId, amount: value, notes: settleNotes || undefined });
      return;
    }

    onSettleSupplierDebt(settleSupplierId, value, settleNotes || undefined);
    
    // Reset
    setIsSettlingDebt(false);
    setSettleSupplierId('');
    setSettleAmount('');
    setSettleNotes('');

    if (lang === 'ar') {
      alert('تم تسجيل الدفعة المسددة وتحديث حساب المورد بنجاح.');
    } else {
      alert('Debt repayment recorded! Supplier balance updated successfully.');
    }
  };

  // Submit payment for a specific bill inside detailed modal
  const handleSpecificBillPaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!viewingPurchase) return;

    const amount = parseFloat(billPaymentAmount);
    if (!amount || amount <= 0) {
      alert(lang === 'ar' ? 'يرجى إدخال مبلغ دفع صحيح.' : 'Please enter a valid payment amount.');
      return;
    }

    const remainingForThisBill = viewingPurchase.total - viewingPurchase.amountPaid;
    if (amount > remainingForThisBill) {
      alert(lang === 'ar' 
        ? `المبلغ المدخل (${amount} ${config.currency}) أكبر من المبلغ المتبقي للفاتورة (${remainingForThisBill.toFixed(2)} ${config.currency}).` 
        : `Entered amount (${amount} ${config.currency}) exceeds the remaining balance for this bill (${remainingForThisBill.toFixed(2)} ${config.currency}).`);
      return;
    }

    // Pass notes referencing specific bill
    const customNotes = billPaymentNotes || (lang === 'ar' ? `دفعة مسددة للفاتورة ${viewingPurchase.purchaseNumber}` : `Installment for ${viewingPurchase.purchaseNumber}`);
    
    onSettleSupplierDebt(viewingPurchase.supplierId, amount, customNotes);

    // Update viewing purchase locally so that the modal stays in sync instantly for the user
    const updatedAmountPaid = viewingPurchase.amountPaid + amount;
    const isPaidNow = updatedAmountPaid >= viewingPurchase.total;
    const updatedPayments = [
      ...(viewingPurchase.payments || []),
      {
        id: 'pay_' + Date.now(),
        date: new Date().toISOString(),
        amount,
        notes: pmtNotesFromPrompt(billPaymentNotes)
      }
    ];

    setViewingPurchase({
      ...viewingPurchase,
      amountPaid: updatedAmountPaid,
      status: isPaidNow ? 'paid' : 'partial',
      payments: updatedPayments
    });

    setBillPaymentAmount('');
    setBillPaymentNotes('');

    if (lang === 'ar') {
      alert('تم تسجيل دفعة القسط وتحديث حالة الفاتورة بنجاح!');
    } else {
      alert('Payment installment registered and invoice status updated!');
    }
  };

  const buildPurchasePdfMeta = (p: Purchase, mode: 'a4' | '80mm' = 'a4') => {
    const supplierObj = suppliers.find(s => s.id === p.supplierId);
    const billDebt = Math.max(0, p.total - p.amountPaid);
    return {
      title: lang === 'ar' ? 'فاتورة مشتريات رسمية' : 'Bon de Réception - Achat',
      docNumberLabel: lang === 'ar' ? 'رقم الفاتورة:' : 'N°:',
      partyLabel: lang === 'ar' ? 'المورد :' : 'Fournisseur :',
      docNumber: p.purchaseNumber,
      date: p.date ? new Date(p.date).toLocaleString('fr-FR') : '',
      storeName: config.name || 'المتجر',
      storePhone: config.phone,
      storeEmail: config.email,
      storeAddress: config.address,
      storeRegNumber: config.registrationNumber,
      customerLabel: lang === 'ar' ? 'المورد' : 'Fournisseur',
      customerName: p.supplierName,
      customerPhone: supplierObj?.phone,
      sellerName: 'admin',
      currency: config.currency,
      mode,
      isRTL,
      items: (p.items || []).map(it => ({
        name: it.productName,
        quantity: it.quantity,
        unitPrice: Number(it.purchasePrice || 0),
        total: Number((it.purchasePrice || 0) * (it.quantity || 1))
      })),
      subtotal: p.total,
      total: p.total,
      amountPaid: p.amountPaid,
      remainingDebt: billDebt,
      notes: p.notes,
      footerText: lang === 'ar' ? 'تمت مراجعة وقبول السلع المستلمة بالمخزن' : 'Procured and verified in good condition'
    };
  };

  const handleExportPurchasePdf = async (p: Purchase, mode: 'a4' | '80mm' = 'a4') => {
    await exportStructuredPdf(buildPurchasePdfMeta(p, mode));
  };

  const triggerPurchase80mmPrint = (p: Purchase) => {
    const receiptHtml = buildUnified80mmReceiptHtml(
      {
        invoiceNumber: p.purchaseNumber,
        date: p.date,
        customerName: p.supplierName,
        sellerName: 'admin',
        docTitle: lang === 'ar' ? 'فاتورة مشتريات' : "Bon d'Achat",
        docNumberLabel: lang === 'ar' ? 'رقم الفاتورة:' : 'N°:',
        partyLabel: lang === 'ar' ? 'المورد :' : 'Fournisseur :',
        items: (p.items || []).map((it) => ({
          productName: it.productName,
          quantity: it.quantity,
          sellingPrice: it.purchasePrice,
          total: Number(it.purchasePrice || 0) * Number(it.quantity || 1),
        })),
        subtotal: p.total,
        total: p.total,
        amountPaid: p.amountPaid,
      },
      config,
      lang,
      lang === 'ar' ? 'تمت مراجعة وقبول السلع المستلمة بالمخزن' : 'Procured and verified in good condition'
    );
    printHtmlContent(
      {
        title: `Purchase Receipt ${p.purchaseNumber}`,
        html: receiptHtml,
        isRTL,
        mode: '80mm',
      },
      buildPurchasePdfMeta(p, '80mm')
    );
  };

  const triggerPrintLayout = (targetPo?: Purchase) => {
    const po = targetPo || viewingPurchase;
    if (!po) return;
    const printArea = document.getElementById('printable-purchase-area');
    const bodyHtml = printArea
      ? `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Cairo', 'Tajawal', sans-serif; color: #0f172a; font-size: 12px; direction: ${isRTL ? 'rtl' : 'ltr'};">${printArea.innerHTML}</div>`
      : '';
    printHtmlContent(
      {
        title: `${po.purchaseNumber} - ${config.name || 'Smart POS'}`,
        html: bodyHtml || `<h2>${po.purchaseNumber}</h2>`,
        isRTL,
        mode: 'a4'
      },
      buildPurchasePdfMeta(po)
    );
  };

  const pmtNotesFromPrompt = (inputNotes: string) => {
    if (inputNotes) return inputNotes;
    if (lang === 'ar') return `تسجيل سداد قسط مباشر للفاتورة ${viewingPurchase?.purchaseNumber}`;
    return `Specific bill installment allocation for ${viewingPurchase?.purchaseNumber}`;
  };

  return (
    <div className="space-y-6 animate-fade-in" id="purchases-tab-view">
      
      {/* Top Banner & Overview Accounts Stats */}
      <div className={`grid grid-cols-1 lg:grid-cols-3 gap-6 ${isRTL ? 'text-right' : 'text-left'}`}>
        
        {/* Total Payables Card */}
        <div className="lg:col-span-2 bg-slate-900 text-white rounded-3xl p-6 shadow-md border border-slate-800 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute right-0 top-0 translate-x-12 -translate-y-10 w-44 h-44 rounded-full bg-indigo-500/10 blur-3xl"></div>
          <div>
            <span className="text-slate-400 text-xs font-black uppercase tracking-wider block">
              {t.purchase.ourOutstandingDebt}
            </span>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-4xl font-extrabold tracking-tight font-mono text-indigo-400">
                {totalOurDebtsToSuppliers.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {config.currency}
              </span>
            </div>
            <p className="text-slate-400 text-xs font-medium mt-1.5 max-w-md leading-relaxed">
              {lang === 'ar'
                ? 'إجمالي الديون والالتزامات المستحقة لشركات ومندوبي التوريد لتكاليف السلع المستوردة.'
                : 'Current aggregate liabilities owed in credit to corporate supply groups & manufacturers.'}
            </p>
          </div>

          <div className={`flex flex-wrap items-center gap-3 mt-6 pt-6 border-t border-slate-800/60 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <button
              id="open-settle-debt-modal"
              onClick={() => {
                setIsSettlingDebt(true);
                // Pre-fill first supplier with debt
                const firstWithDebt = suppliers.find(s => s.debt > 0);
                if (firstWithDebt) setSettleSupplierId(firstWithDebt.id);
              }}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl border border-indigo-500/20 transition cursor-pointer flex items-center gap-2 shadow-sm"
            >
              <CheckCircle className="w-4 h-4 text-emerald-300" />
              {t.purchase.settleDebt}
            </button>
          </div>
        </div>

        {/* Small Active Suppliers Mini-Counter Cards */}
        <div className="bg-white rounded-3xl p-6 shadow-xs border border-slate-100 flex flex-col justify-between text-start">
          <div>
            <span className="text-slate-400 text-[10px] font-black uppercase tracking-widest block">
              {lang === 'ar' ? 'إحصاءات المنبع' : 'Vendor Stats'}
            </span>
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <span className="text-xs font-black text-slate-400 block">{lang === 'ar' ? 'الموردين المسجلين' : 'Active Vendors'}</span>
                <span className="text-2xl font-extrabold text-slate-800 block mt-1 font-mono">{suppliers.length}</span>
              </div>
              <div className="bg-rose-50/50 p-4 rounded-2xl border border-rose-100/30">
                <span className="text-xs font-black text-rose-500 block">{lang === 'ar' ? 'حسابات الديون' : 'A/P Accounts'}</span>
                <span className="text-2xl font-extrabold text-rose-700 block mt-1 font-mono">
                  {suppliers.filter(s => s.debt > 0).length}
                </span>
              </div>
            </div>
          </div>
          <p className="text-[11px] text-slate-500 font-medium leading-relaxed mt-4 pt-4 border-t border-slate-100">
            {lang === 'ar' 
              ? '● تسجيل فاتورة مشراء جديدة يزيد مخزون منتجاتك بالكامل بشكل فوري وتلقائي.' 
              : '● Recording a purchase automatically increments physical item inventory in real-time.'}
          </p>
        </div>
      </div>

      {/* Main filter & Bills card */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-xs p-4 sm:p-6 space-y-4 text-start">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-lg font-black text-slate-800">{t.purchase.title}</h2>
            <p className="text-xs text-slate-400 font-medium mt-0.5">
              {lang === 'ar' ? 'استعراض فواتير التوريد السابقة والمبالغ المعلقة.' : 'Browse supply invoices and connected vendor payables.'}
            </p>
          </div>

          <div className="relative w-full sm:w-80">
            <span className={`absolute inset-y-0 ${isRTL ? 'right-3' : 'left-3'} flex items-center text-slate-400`}>
              <Search className="w-4 h-4" />
            </span>
            <input
              id="purchases-table-search"
              type="text"
              placeholder={t.purchase.search}
              className={`w-full py-2.5 ${isRTL ? 'pr-9 pl-3' : 'pl-9 pr-3'} bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-xs font-semibold`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Status filters - Identical to Sales Invoices */}
        <div className="flex flex-wrap gap-1.5 bg-slate-100 p-1.5 rounded-xl border border-slate-200/60">
          {['all', 'paid', 'partial', 'unpaid'].map((stat) => (
            <button
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
                : stat === 'paid'
                ? (lang === 'ar' ? 'مدفوع بالكامل' : 'Payé')
                : stat === 'partial'
                ? (lang === 'ar' ? 'مدفوع جزئياً' : 'Partiel')
                : (lang === 'ar' ? 'آجل (دين)' : 'Non payé')}
            </button>
          ))}
        </div>

        {/* MOBILE / IPHONE CARDS VIEW (< md) - Matches Sales Invoices Mobile Cards Layout */}
        <div className="md:hidden space-y-3">
          {filteredPurchases.length > 0 ? (
            filteredPurchases.map((p) => {
              const pTotal = Number(p.total) || 0;
              const pPaid = Number(p.amountPaid) || 0;
              const billDebt = Math.max(0, pTotal - pPaid);

              return (
                <div
                  key={p.id}
                  className="bg-white rounded-2xl border border-slate-200/90 p-3.5 shadow-2xs space-y-3"
                >
                  {/* Row 1: Purchase Number, Supplier Name & Date + Status Badge */}
                  <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2.5">
                    <div className="space-y-0.5 text-start">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono font-black text-sm text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-100">
                          {p.purchaseNumber}
                        </span>
                        <span className="font-black text-slate-800 text-xs">{p.supplierName}</span>
                      </div>
                      <p className="text-[11px] text-slate-400 font-mono">
                        {p.date ? new Date(p.date).toLocaleString('fr-FR') : ''}
                      </p>
                    </div>

                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {p.status === 'paid' && (
                        <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-black rounded-full inline-block border border-emerald-200">
                          {lang === 'ar' ? 'مدفوع بالكامل' : lang === 'fr' ? 'Payé' : 'Paid'}
                        </span>
                      )}
                      {p.status === 'partial' && (
                        <span className="px-2.5 py-0.5 bg-amber-50 text-amber-700 text-[10px] font-black rounded-full inline-block border border-amber-200">
                          {lang === 'ar' ? 'مدفوع جزئياً' : lang === 'fr' ? 'Partiel' : 'Partial'}
                        </span>
                      )}
                      {p.status === 'unpaid' && (
                        <span className="px-2.5 py-0.5 bg-rose-50 text-rose-700 text-[10px] font-black rounded-full inline-block border border-rose-200">
                          {lang === 'ar' ? 'آجل (دين)' : lang === 'fr' ? 'À crédit' : 'Unpaid'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Row 2: Financial Figures (3-column grid identical to Sales Invoices) */}
                  <div className="grid grid-cols-3 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-center text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold block">{t.purchase.total}</span>
                      <span className="font-mono font-black text-slate-900">
                        {pTotal.toFixed(2)} <span className="text-[9px] font-normal">{config.currency}</span>
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold block">{t.purchase.amountPaid}</span>
                      <span className="font-mono font-bold text-emerald-700">
                        {pPaid.toFixed(2)} <span className="text-[9px] font-normal">{config.currency}</span>
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold block">{t.purchase.debtToSupplier}</span>
                      <span className={`font-mono font-bold ${billDebt > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                        {billDebt.toFixed(2)} <span className="text-[9px] font-normal">{config.currency}</span>
                      </span>
                    </div>
                  </div>

                  {/* Row 3: Action Buttons Grid (Fits cleanly on iPhone like Sales Invoices) */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                    <button
                      type="button"
                      onClick={() => setViewingPurchase(p)}
                      className="flex-1 min-w-[90px] py-2 px-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl border border-indigo-200 text-xs font-black flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5 shrink-0" />
                      <span>{lang === 'ar' ? 'التفاصيل' : t.invoice.view}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setReceiptPreviewPurchase(p)}
                      className="flex-1 min-w-[85px] py-2 px-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>{lang === 'ar' ? 'إيصال' : 'Receipt'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleExportPurchasePdf(p, 'a4')}
                      className="py-2 px-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl border border-rose-200 text-xs font-black flex items-center justify-center gap-1 transition cursor-pointer"
                    >
                      <FileDown className="w-3.5 h-3.5 shrink-0" />
                      <span>PDF</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setDeletingPurchaseId(p.id)}
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
              <p className="text-xs font-bold">{lang === 'ar' ? 'لا يوجد فواتير تتبع مطابقة.' : 'No purchase records found.'}</p>
            </div>
          )}
        </div>

        {/* Historic Purchases Desktop Table (md+) */}
        <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-100">
          <table className="w-full text-xs text-left" id="purchases-table-control">
            <thead className="bg-slate-50 text-slate-400 font-black uppercase text-[10px] tracking-wider border-b border-slate-100 text-center">
              <tr>
                <th className="px-4 py-3">{t.purchase.purchaseNumber}</th>
                <th className="px-4 py-3">{t.purchase.date}</th>
                <th className="px-4 py-3">{t.purchase.supplier}</th>
                <th className="px-4 py-3 text-right">{t.purchase.total}</th>
                <th className="px-4 py-3 text-right">{t.purchase.amountPaid}</th>
                <th className="px-4 py-3 text-right">{t.purchase.debtToSupplier}</th>
                <th className="px-4 py-3">{t.purchase.status}</th>
                <th className="px-4 py-3">{lang === 'ar' ? 'الخيارات' : 'Options'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-semibold text-slate-600 text-center">
              {filteredPurchases.length > 0 ? (
                filteredPurchases.map((p) => {
                  const billDebt = Math.max(0, p.total - p.amountPaid);
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/50 transition">
                      <td className="px-4 py-3.5 font-bold font-mono text-slate-900">{p.purchaseNumber}</td>
                      <td className="px-4 py-3.5 text-slate-400">
                        {p.date ? new Date(p.date).toLocaleString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        }) : ''}
                      </td>
                      <td className="px-4 py-3.5 font-bold text-slate-800">{p.supplierName}</td>
                      <td className="px-4 py-3.5 text-right font-bold text-slate-800 font-mono">{p.total.toFixed(2)} {config.currency}</td>
                      <td className="px-4 py-3.5 text-right font-semibold text-emerald-600 font-mono">{p.amountPaid.toFixed(2)} {config.currency}</td>
                      <td className="px-4 py-3.5 text-right font-mono text-rose-600 font-bold">
                        {billDebt > 0 ? `${billDebt.toFixed(2)} ${config.currency}` : '-'}
                      </td>
                      <td className="px-4 py-3.5">
                        {p.status === 'paid' && (
                          <span className="px-2 py-1 bg-emerald-50 text-emerald-700 text-[10px] font-black rounded-lg inline-block border border-emerald-100">
                            {lang === 'ar' ? 'مدفوع بالكامل' : lang === 'fr' ? 'Payé entièrement' : 'Paid'}
                          </span>
                        )}
                        {p.status === 'partial' && (
                          <span className="px-2 py-1 bg-amber-50 text-amber-700 text-[10px] font-black rounded-lg inline-block border border-amber-100">
                            {lang === 'ar' ? 'مدفوع جزئياً' : lang === 'fr' ? 'Payé partiellement' : 'Partial'}
                          </span>
                        )}
                        {p.status === 'unpaid' && (
                          <span className="px-2 py-1 bg-rose-50 text-rose-700 text-[10px] font-black rounded-lg inline-block border border-rose-100">
                            {lang === 'ar' ? 'أجل (دين غائب)' : lang === 'fr' ? 'Non payé (À crédit)' : 'Unpaid (Credit)'}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            id={`view-po-${p.id}`}
                            onClick={() => setViewingPurchase(p)}
                            className="p-1.5 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition text-[11px] font-bold cursor-pointer"
                            title={lang === 'ar' ? 'معاينة' : 'Preview'}
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            id={`receipt-po-${p.id}`}
                            onClick={() => setReceiptPreviewPurchase(p)}
                            className="p-1 px-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg transition text-[10px] font-black flex items-center gap-1 cursor-pointer"
                            title={lang === 'ar' ? 'فاتورة صغيرة 80mm' : 'Receipt 80mm'}
                          >
                            <Receipt className="w-3 h-3" />
                            <span>{lang === 'ar' ? 'إيصال' : 'Receipt'}</span>
                          </button>
                          <button
                            id={`pdf-po-${p.id}`}
                            onClick={() => handleExportPurchasePdf(p)}
                            className="p-1 px-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg transition text-[10px] font-black flex items-center gap-1 cursor-pointer"
                            title={lang === 'ar' ? 'حفظ PDF' : 'Save PDF'}
                          >
                            <FileDown className="w-3 h-3" />
                            <span>PDF</span>
                          </button>
                          <button
                            id={`delete-po-${p.id}`}
                            onClick={() => setDeletingPurchaseId(p.id)}
                            className="p-1 px-2 text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
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
                  <td colSpan={8} className="py-12 text-slate-400 font-bold text-center">
                    <div className="flex flex-col items-center gap-1.5 grayscale opacity-60">
                      <Trash2 className="w-8 h-8" />
                      <span>{lang === 'ar' ? 'لا يوجد فواتير تتبع مطابقة.' : 'No purchase records found.'}</span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: ADD PROCUREMENT PURCHASE INVOICE */}
      {isAddingPurchase && createPortal(
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 z-[100] safe-modal-overlay">
          <div
            dir={isRTL ? 'rtl' : 'ltr'}
            className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl h-[90vh] max-h-[860px] flex flex-col overflow-hidden animate-fade-in text-start"
          >
            {/* Modal Header */}
            <div className="p-4 sm:px-6 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/60">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-600/10 text-indigo-600 flex items-center justify-center">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-black text-slate-800">
                    {t.purchase.addPurchase}
                  </h2>
                  <p className="text-xs text-slate-400 font-medium">
                    {lang === 'ar' ? 'سند استلام وتوريد بضائع جديد للمخزن وتحديث حسابات المورد' : 'Record incoming merchandise & update vendor balance'}
                  </p>
                </div>
              </div>
              <button
                id="btn-close-purchase-modal"
                type="button"
                onClick={() => setIsAddingPurchase(false)}
                className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handlePurchaseSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
              {/* Scrollable Form Body */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-5">
                
                {/* Supplier selection & PO reference */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2 space-y-1">
                    <label className="block text-xs font-black text-slate-700">
                      {lang === 'ar' ? 'اختر المورّد للشراء منه' : 'Select Supplier'} <span className="text-rose-500">*</span>
                    </label>
                    {suppliers.length > 0 ? (
                      <select
                        id="purchase-form-supplier-select"
                        required
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                        value={supplierId}
                        onChange={(e) => setSupplierId(e.target.value)}
                      >
                        <option value="">-- {lang === 'ar' ? 'اختر مورداً من القائمة' : 'Select Vendor'} --</option>
                        {suppliers.map(s => (
                          <option key={s.id} value={s.id}>
                            {s.name} ({s.company || s.name}) {s.debt > 0 ? `[${lang === 'ar' ? 'مستحق له:' : 'We owe:'} ${s.debt.toFixed(2)} ${config.currency}]` : ''}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="p-3 bg-amber-50 text-amber-800 border border-amber-200 rounded-xl text-xs font-bold flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                        <span>
                          {lang === 'ar' 
                            ? 'يرجى تسجيل مورّدين في صفحة سجل الموردين أولاً حتى تتمكن من الشراء منهم.' 
                            : 'Please add supplier profiles first inside the Suppliers page.'}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-black text-slate-700">
                      {lang === 'ar' ? 'رقم السند التقديري' : 'Reference PO'}
                    </label>
                    <div className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-600">
                      PO-2026-{String(purchases.length + 101)}
                    </div>
                  </div>
                </div>

                {/* Quick Product Search Bar */}
                <div className="space-y-1.5 relative">
                  <label className="block text-xs font-black text-slate-700">
                    {lang === 'ar' ? '🔍 البحث السريع عن منتج لإضافته للفاتورة' : '🔍 Quick Search Product to Add'}
                  </label>
                  <div className="relative">
                    <span className={`absolute inset-y-0 ${isRTL ? 'right-3' : 'left-3'} flex items-center text-slate-400 pointer-events-none`}>
                      <Search className="w-4 h-4" />
                    </span>
                    <input
                      type="text"
                      placeholder={lang === 'ar' ? 'اكتب اسم المنتج أو الباركود (SKU) للبحث والإضافة التلقائية...' : 'Type product name or SKU to search & add instantly...'}
                      value={productSearchQuery}
                      onChange={(e) => {
                        setProductSearchQuery(e.target.value);
                        setShowProductSearchResults(true);
                      }}
                      onFocus={() => setShowProductSearchResults(true)}
                      className={`w-full py-3 ${isRTL ? 'pr-10 pl-9' : 'pl-10 pr-9'} bg-slate-50 border border-slate-300 rounded-xl text-sm font-extrabold text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition`}
                    />
                    {productSearchQuery && (
                      <button
                        type="button"
                        onClick={() => {
                          setProductSearchQuery('');
                          setShowProductSearchResults(false);
                        }}
                        className={`absolute inset-y-0 ${isRTL ? 'left-3' : 'right-3'} flex items-center text-slate-500 hover:text-slate-800`}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Instant Search Results Dropdown */}
                  {showProductSearchResults && productSearchQuery.trim().length > 0 && (
                    <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-white rounded-2xl shadow-2xl border-2 border-indigo-200 overflow-hidden max-h-64 overflow-y-auto animate-fade-in">
                      {searchedProducts.length > 0 ? (
                        <div className="divide-y divide-slate-100">
                          {searchedProducts.map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => handleSelectSearchedProduct(p)}
                              className="w-full px-4 py-3 hover:bg-indigo-50 flex items-center justify-between text-start transition cursor-pointer"
                            >
                              <div className="space-y-1">
                                <span className="font-black text-sm text-slate-900 block">{p.name}</span>
                                <div className="flex flex-wrap items-center gap-2 text-xs font-extrabold text-slate-700 mt-0.5">
                                  <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded-md font-mono font-bold">SKU: {p.sku || 'N/A'}</span>
                                  {p.category && <span className="text-slate-700 font-bold">• {p.category}</span>}
                                  <span className={`px-2 py-0.5 rounded-md font-extrabold ${p.stock <= 0 ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>
                                    {lang === 'ar' ? `المخزون الحالي: ${p.stock}` : `Current Stock: ${p.stock}`}
                                  </span>
                                </div>
                              </div>
                              <div className="text-end shrink-0 ms-3">
                                <span className="font-mono font-black text-sm text-indigo-700 block">{p.purchasePrice.toFixed(2)} {config.currency}</span>
                                <span className="block text-[11px] text-slate-600 font-extrabold">{lang === 'ar' ? 'سعر الشراء' : 'Cost'}</span>
                              </div>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="p-3 text-center text-xs text-slate-500 font-bold">
                          {lang === 'ar' ? 'لا توجد منتجات مطابقة في المخزون' : 'No matching products found'}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Items Table Section */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-2">
                      <span>{lang === 'ar' ? 'المنتجات والكميات المشتراة' : 'Purchase Products & Quantities'}</span>
                      <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[10px] font-bold rounded-full border border-indigo-100">
                        {cartItems.length} {lang === 'ar' ? 'مواد' : 'items'}
                      </span>
                    </h3>
                    <button
                      id="btn-add-purchase-row"
                      type="button"
                      onClick={handleAddCartItemRow}
                      className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 text-xs font-black rounded-lg transition cursor-pointer flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      {lang === 'ar' ? 'إضافة سطر مادة' : 'Add Item Row'}
                    </button>
                  </div>

                  <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[320px] sm:min-w-[540px] text-xs text-start">
                        <thead className="bg-slate-50 text-slate-700 font-extrabold uppercase text-[11px] sm:text-xs border-b border-slate-200">
                          <tr>
                            <th className="py-2.5 px-2 sm:px-3 text-start min-w-[125px] sm:min-w-[180px]">{lang === 'ar' ? 'المنتج / الصنف' : 'Product Item'}</th>
                            <th className="py-2.5 px-1.5 sm:px-3 text-center min-w-[78px] sm:min-w-[110px] w-24 sm:w-36">{lang === 'ar' ? `سعر الشراء (${config.currency})` : `Cost (${config.currency})`}</th>
                            <th className="py-2.5 px-1.5 sm:px-3 text-center min-w-[64px] sm:min-w-[100px] w-20 sm:w-32">{lang === 'ar' ? 'الكمية' : 'Qty'}</th>
                            <th className="py-2.5 px-2 sm:px-3 text-end min-w-[80px] sm:min-w-[100px] w-24 sm:w-36">{lang === 'ar' ? `المجموع (${config.currency})` : `Total (${config.currency})`}</th>
                            <th className="py-2.5 px-1 sm:px-2 text-center w-9 sm:w-12"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {cartItems.map((item, idx) => {
                            const rowTotal = parseDecimal(item.purchasePrice, 0) * parseDecimal(item.quantity, 0);
                            return (
                              <tr key={idx} className="hover:bg-slate-50/50 transition">
                                <td className="py-2.5 px-2 sm:px-3">
                                  <div className="space-y-1.5">
                                    <select
                                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2 sm:px-2.5 py-1.5 text-xs font-extrabold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                                      value={item.productId}
                                      onChange={(e) => handleCartItemChange(idx, 'productId', e.target.value)}
                                    >
                                      <option value="" className="font-bold text-slate-900">-- {lang === 'ar' ? 'منتج غير مسجل (يدوي / حر)' : 'Unregistered (Manual / Free-text)'} --</option>
                                      {products.map(p => (
                                        <option key={p.id} value={p.id} className="font-bold text-slate-900">
                                          {p.name}
                                        </option>
                                      ))}
                                    </select>
                                    <input
                                      type="text"
                                      required
                                      placeholder={lang === 'ar' ? 'اسم المنتج أو الصنف (قابل للتعديل)...' : 'Product / item name (editable)...'}
                                      className="w-full bg-white border border-indigo-300 rounded-lg px-2.5 py-2 text-xs sm:text-sm font-extrabold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                      value={item.productName}
                                      onChange={(e) => handleCartItemChange(idx, 'productName', e.target.value)}
                                    />
                                  </div>
                                </td>
                                <td className="py-2.5 px-1.5 sm:px-3 text-center align-top">
                                  <input
                                    type="text"
                                    inputMode="decimal"
                                    placeholder="0.00"
                                    required
                                    onFocus={(e) => e.target.select()}
                                    className="w-full min-w-[70px] sm:min-w-[96px] bg-slate-50 border border-slate-300 rounded-xl px-2 sm:px-3 py-2 sm:py-2.5 text-xs sm:text-sm font-black font-mono text-center text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white placeholder:text-slate-300 placeholder:font-normal"
                                    value={item.purchasePrice === 0 || item.purchasePrice === '0' ? '' : item.purchasePrice}
                                    onChange={(e) => handleCartItemChange(idx, 'purchasePrice', sanitizeDecimalInput(e.target.value))}
                                  />
                                </td>
                                <td className="py-2.5 px-1.5 sm:px-3 text-center align-top">
                                  <input
                                    type="text"
                                    inputMode="decimal"
                                    placeholder="1"
                                    required
                                    onFocus={(e) => e.target.select()}
                                    className="w-full min-w-[56px] sm:min-w-[88px] bg-slate-50 border border-slate-300 rounded-xl px-2 sm:px-3 py-2 sm:py-2.5 text-xs sm:text-sm font-black font-mono text-center text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white placeholder:text-slate-300 placeholder:font-normal"
                                    value={item.quantity === 0 || item.quantity === '0' ? '' : item.quantity}
                                    onChange={(e) => handleCartItemChange(idx, 'quantity', sanitizeDecimalInput(e.target.value))}
                                  />
                                </td>
                                <td className="py-2.5 px-2 sm:px-3 text-end font-mono font-bold text-slate-800 align-top pt-3 text-xs sm:text-sm">
                                  {rowTotal.toFixed(2)} {config.currency}
                                </td>
                                <td className="py-2.5 px-2 text-center align-top pt-2.5">
                                  {cartItems.length > 1 && (
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveCartItemRow(idx)}
                                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                                      title="Remove"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Financial Summary Calculation Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                  {/* Card 1: Total Cost */}
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 space-y-1">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                      {lang === 'ar' ? 'المجموع المستحق للمورد' : 'Total Procurement Cost'}
                    </span>
                    <div className="text-xl font-extrabold text-slate-900 font-mono">
                      {formTotal.toFixed(2)} <span className="text-xs font-bold text-slate-500">{config.currency}</span>
                    </div>
                  </div>

                  {/* Card 2: Amount Paid Input */}
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">
                      {lang === 'ar' ? 'المبلغ المدفوع كاش' : 'Cash Paid'} <span className="text-rose-500">*</span>
                    </label>
                    <input
                      id="purchase-form-paid-input"
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      placeholder="0.00"
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm font-bold font-mono text-emerald-700"
                      value={amountPaidState}
                      onChange={(e) => setAmountPaidState(e.target.value)}
                    />
                  </div>

                  {/* Card 3: Balance / Debt */}
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 space-y-1">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                      {lang === 'ar' ? 'المتبقي (دين للمورد)' : 'Balance (Vendor Debt)'}
                    </span>
                    <div className={`text-xl font-extrabold font-mono ${formTotal - (parseFloat(amountPaidState) || 0) > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {Math.max(0, formTotal - (parseFloat(amountPaidState) || 0)).toFixed(2)} <span className="text-xs font-bold text-slate-500">{config.currency}</span>
                    </div>
                  </div>
                </div>

                {/* Notes Input */}
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">{t.purchase.notes}</label>
                  <input
                    id="purchase-form-notes"
                    type="text"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-xs font-semibold"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={lang === 'ar' ? 'سجل شروط الدفع، رقم بوليصة الشحن، أو ملاحظات التسليم...' : 'Supplier remarks or delivery note...'}
                  />
                </div>

                {/* WAC subtle notification */}
                <div className="text-[11px] text-slate-500 bg-indigo-50/40 p-2.5 rounded-xl border border-indigo-100/50 flex items-center gap-2">
                  <span className="text-indigo-600 font-bold">💡 {lang === 'ar' ? 'تحديث تلقائي:' : 'Notice:'}</span>
                  <span>
                    {lang === 'ar'
                      ? 'سيقوم النظام تلقائياً بتحديث كميات المخزن وحساب متوسط سعر الشراء المرجح (WAC) لكل مادة لضمان دقة الأرباح.'
                      : 'Stock will increment automatically and Weighted Average Cost (WAC) will recalculate for exact margin accuracy.'}
                  </span>
                </div>
              </div>

              {/* Fixed Sticky Footer with Action Controls */}
              <div className="shrink-0 bg-slate-50 border-t border-slate-200 px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs font-bold text-slate-600">
                  <span className="text-slate-400 font-medium">{lang === 'ar' ? 'المجموع النهائي:' : 'Final Total:'} </span>
                  <span className="font-mono font-black text-slate-900 text-sm sm:text-base">{formTotal.toFixed(2)} {config.currency}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    id="btn-add-po-cancel"
                    onClick={() => setIsAddingPurchase(false)}
                    className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition cursor-pointer shadow-xs"
                  >
                    {t.purchase.cancel}
                  </button>
                  <button
                    type="submit"
                    id="btn-add-po-save"
                    disabled={suppliers.length === 0}
                    className="px-5 sm:px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-sm disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <CheckCircle className="w-4 h-4" />
                    {lang === 'ar' ? 'حفظ وتنزيل الفاتورة في المخزون' : 'Post & Receive Stock'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL 2: SETTLE SUPPLIER DEBT REPAYS */}
      {isSettlingDebt && createPortal(
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[100]">
          <div className="bg-white rounded-3xl shadow-xl border border-slate-100 w-full max-w-md overflow-hidden p-6 space-y-4 animate-fade-in text-start">
            
            <div className={`flex items-center justify-between pb-3 border-b border-slate-100 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <h3 className="text-lg font-black tracking-tight text-slate-800 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
                {t.purchase.settleDebt}
              </h3>
              <button
                id="btn-close-settle-modal"
                onClick={() => setIsSettlingDebt(false)}
                className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-750 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSettleDebtSubmit} className="space-y-4">
              
              {/* Select Vendor with Outstanding Balance */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">
                  {lang === 'ar' ? 'اختر المورّد الدائن' : 'Select Creditor Vendor'} <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  id="settle-supplier-select"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-slate-800"
                  value={settleSupplierId}
                  onChange={(e) => setSettleSupplierId(e.target.value)}
                >
                  <option value="">-- {lang === 'ar' ? 'اختر المورد دافع الديون' : 'Select Vendor'} --</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.company}) {s.debt > 0 ? `[${lang === 'ar' ? 'مستحق له:' : 'We owe:'} ${s.debt.toFixed(2)} ${config.currency}]` : `[${lang === 'ar' ? 'لا يملك دين مستحق' : '0 debt'}]`}
                    </option>
                  ))}
                </select>
              </div>

              {/* Outstanding displaying parameter info */}
              {settleSupplierId && (
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 text-xs font-bold flex justify-between">
                  <span className="text-slate-500">{lang === 'ar' ? 'الرصيد المعلق المسجل:' : 'Current Outstanding Balance:'}</span>
                  <span className="font-mono text-rose-600 font-extrabold">
                    {(suppliers.find(s => s.id === settleSupplierId)?.debt || 0).toFixed(2)} {config.currency}
                  </span>
                </div>
              )}

              {/* Settle repays input amount */}
              <div className="space-y-2">
                <label className="block text-sm md:text-base font-black text-slate-800">
                  {lang === 'ar' ? 'المبلغ الذي تود تسديده نقداً' : 'Amount Settling Cash'} <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 start-4 flex items-center text-slate-400 font-extrabold text-sm">{config.currency}</span>
                  <input
                    id="settle-amount-input"
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder="0.00"
                    className="w-full ps-16 pe-4 py-3 bg-white border-2 border-slate-300 focus:border-indigo-500 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-lg font-black font-mono text-emerald-700 shadow-xs"
                    value={settleAmount}
                    onChange={(e) => setSettleAmount(e.target.value)}
                  />
                </div>
              </div>

              {/* Footer controls */}
              <div className={`flex items-center justify-end gap-3 pt-4 border-t border-slate-100 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <button
                  type="button"
                  onClick={() => setIsSettlingDebt(false)}
                  className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-black rounded-xl transition cursor-pointer"
                >
                  {t.purchase.cancel}
                </button>
                <button
                  type="submit"
                  id="btn-settle-supplier-submit"
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-black rounded-xl transition cursor-pointer shadow-sm"
                >
                  {lang === 'ar' ? 'تأكيد عملية السداد والخروج' : 'Record payment'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL 3: VIEW DETAILED PO BILL */}
      {viewingPurchase && (() => {
        const supplierObj = suppliers.find(s => s.id === viewingPurchase.supplierId);
        const billDebt = Math.max(0, viewingPurchase.total - viewingPurchase.amountPaid);
        let purchaseItems: any[] = [];
        try {
          purchaseItems = Array.isArray(viewingPurchase.items)
            ? viewingPurchase.items
            : JSON.parse(viewingPurchase.items || '[]');
        } catch (e) {
          purchaseItems = [];
        }

        let purchasePayments: any[] = [];
        try {
          purchasePayments = Array.isArray(viewingPurchase.payments)
            ? viewingPurchase.payments
            : (viewingPurchase.payments ? JSON.parse(viewingPurchase.payments) : []);
        } catch (e) {
          purchasePayments = [];
        }

        return createPortal(
          <div
            className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-6 z-[100] overflow-y-auto safe-modal-overlay"
            id="purchase-bill-modal"
            onClick={() => setViewingPurchase(null)}
          >
            <div
              dir={isRTL ? 'rtl' : 'ltr'}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-fade-in my-auto text-start"
            >
              {/* Top Navigation Bar with Clear Back Button */}
              <div className="flex flex-wrap justify-between items-center gap-2 bg-slate-50 px-4 sm:px-6 py-3.5 border-b border-slate-200 shrink-0">
                <div className="flex items-center gap-2">
                  <button
                    id="btn-back-view-po-modal"
                    type="button"
                    onClick={() => setViewingPurchase(null)}
                    className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-xl text-xs font-black flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                  >
                    <ArrowRight className={`w-4 h-4 ${isRTL ? '' : 'rotate-180'}`} />
                    <span>{lang === 'ar' ? 'رجوع' : 'Back'}</span>
                  </button>
                  <div>
                    <h3 className="font-black text-slate-800 text-xs sm:text-sm">
                      {lang === 'ar' ? 'معاينة فاتورة المشتريات' : 'Purchase Invoice Preview'}
                    </h3>
                    <span className="text-[11px] font-mono text-slate-500 font-bold">
                      {viewingPurchase.purchaseNumber}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const po = viewingPurchase;
                      setViewingPurchase(null);
                      setReceiptPreviewPurchase(po);
                    }}
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer transition shadow-xs"
                  >
                    <Receipt className="w-4 h-4" />
                    <span>{lang === 'ar' ? 'إيصال (80mm)' : 'Receipt (80mm)'}</span>
                  </button>

                  <button
                    id="pdf-btn-purchase"
                    type="button"
                    onClick={() => handleExportPurchasePdf(viewingPurchase)}
                    className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer transition shadow-xs"
                    title={lang === 'ar' ? 'حفظ PDF' : 'Save PDF'}
                  >
                    <FileDown className="w-4 h-4" />
                    <span>PDF</span>
                  </button>

                  <button
                    id="print-btn-purchase"
                    type="button"
                    onClick={() => triggerPrintLayout(viewingPurchase)}
                    className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer transition shadow-xs"
                    title={lang === 'ar' ? 'طباعة الفاتورة' : 'Print Invoice'}
                  >
                    <Printer className="w-4 h-4" />
                    <span>{lang === 'ar' ? 'طباعة A4' : 'Print A4'}</span>
                  </button>
                </div>
              </div>

              {/* Printable Body - Full clean A4 sheet structure */}
              <div className="p-4 sm:p-8 space-y-6 overflow-y-auto flex-1 bg-white" id="printable-purchase-area">
                {/* Header: Store Info + Document Info */}
                <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pb-6 border-b-2 border-slate-200">
                  <div className="space-y-1">
                    {config.logoUrl && (
                      <img
                        src={config.logoUrl}
                        alt="Store Logo"
                        referrerPolicy="no-referrer"
                        className="h-12 object-contain mb-2 bg-slate-50 border border-slate-200 rounded-lg p-1"
                      />
                    )}
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">{config.name}</h2>
                    {config.address && <p className="text-xs text-slate-500 font-semibold">{config.address}</p>}
                    <div className="text-xs text-slate-500 space-y-0.5 pt-1">
                      {config.phone && (
                        <p>{lang === 'ar' ? 'الهاتف:' : 'Phone:'} <span className="font-mono text-slate-700 font-bold">{config.phone}</span></p>
                      )}
                      {config.email && (
                        <p>{lang === 'ar' ? 'البريد:' : 'Email:'} <span className="font-mono text-slate-700 font-bold">{config.email}</span></p>
                      )}
                      {config.registrationNumber && (
                        <p>{lang === 'ar' ? 'السجل الضريبي / ICE:' : 'Tax Registration / ICE:'} <span className="font-mono font-bold text-slate-700">{config.registrationNumber}</span></p>
                      )}
                    </div>
                  </div>

                  <div className="text-start sm:text-end space-y-2">
                    <div className="inline-block px-3.5 py-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-black uppercase font-mono tracking-wider">
                      {lang === 'ar' ? 'فاتورة مشتريات رسمية' : 'Facture d\'Achat - Bon de Réception'}
                    </div>
                    <h4 className="font-mono text-2xl font-black text-slate-900">{viewingPurchase.purchaseNumber}</h4>
                    <p className="text-xs text-slate-500 flex items-center sm:justify-end gap-1.5 font-bold">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>{viewingPurchase.date ? new Date(viewingPurchase.date).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}</span>
                    </p>
                    <div className="pt-1">
                      {viewingPurchase.status === 'paid' && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-black">
                          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                          {lang === 'ar' ? 'مدفوعة بالكامل' : lang === 'fr' ? 'Payé entièrement' : 'Paid'}
                        </span>
                      )}
                      {viewingPurchase.status === 'partial' && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-xs font-black">
                          <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                          {lang === 'ar' ? 'مدفوعة جزئياً' : lang === 'fr' ? 'Payé partiellement' : 'Partial'}
                        </span>
                      )}
                      {viewingPurchase.status === 'unpaid' && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-50 text-rose-700 border border-rose-200 rounded-full text-xs font-black">
                          <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                          {lang === 'ar' ? 'أجل (دين معلق)' : lang === 'fr' ? 'Non payé (À crédit)' : 'Unpaid (Credit)'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Supplier & Store Metadata Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  {/* Supplier Card */}
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-1">
                    <span className="text-slate-400 font-black uppercase tracking-wider block text-[10px]">
                      {lang === 'ar' ? 'بيانات المورد (المزوّد)' : 'Supplier Details'}
                    </span>
                    <p className="font-black text-slate-900 text-sm">{viewingPurchase.supplierName}</p>
                    {supplierObj?.company && (
                      <p className="text-slate-700 font-semibold">{lang === 'ar' ? 'الشركة:' : 'Company:'} {supplierObj.company}</p>
                    )}
                    {supplierObj?.phone && (
                      <p className="text-slate-600 font-medium">{lang === 'ar' ? 'الهاتف:' : 'Phone:'} <span className="font-mono font-bold text-slate-800">{supplierObj.phone}</span></p>
                    )}
                    {supplierObj?.email && (
                      <p className="text-slate-500">{supplierObj.email}</p>
                    )}
                  </div>

                  {/* Buyer / Store Details */}
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-1">
                    <span className="text-slate-400 font-black uppercase tracking-wider block text-[10px]">
                      {lang === 'ar' ? 'جهة الاستلام (المشتري)' : 'Buyer Details'}
                    </span>
                    <p className="font-black text-slate-900 text-sm">{config.name}</p>
                    {config.address && <p className="text-slate-600">{config.address}</p>}
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-200/60 text-[10px] font-bold text-slate-700">
                      <span className="bg-white px-2 py-0.5 rounded border border-slate-200">
                        {lang === 'ar' ? 'طريقة الدفع:' : 'Payment:'} {viewingPurchase.status === 'unpaid' ? (lang === 'ar' ? 'على الحساب (كريدي)' : 'Credit') : (lang === 'ar' ? 'نقدي / تحويل' : 'Cash/Transfer')}
                      </span>
                      {config.registrationNumber && (
                        <span className="bg-white px-2 py-0.5 rounded border border-slate-200">
                          ICE: {config.registrationNumber}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Items Purchased Table */}
                <div className="border border-slate-200 rounded-2xl overflow-x-auto text-[11px] sm:text-xs shadow-2xs">
                  <table className="w-full">
                    <thead className="bg-slate-100 text-slate-700 font-black border-b border-slate-200 text-[10px] sm:text-[11px]">
                      <tr>
                        <th className="px-2 sm:px-4 py-2.5 sm:py-3 text-start w-8 sm:w-12">#</th>
                        <th className="px-2 sm:px-4 py-2.5 sm:py-3 text-start">{lang === 'ar' ? 'الصنف / المادة المشتراة' : 'Item Description'}</th>
                        <th className="px-2 sm:px-4 py-2.5 sm:py-3 text-center w-16 sm:w-24">{lang === 'ar' ? 'الكمية' : 'Qty'}</th>
                        <th className="px-2 sm:px-4 py-2.5 sm:py-3 text-center w-24 sm:w-36">{lang === 'ar' ? 'سعر الشراء' : 'Unit Cost'}</th>
                        <th className="px-2 sm:px-4 py-2.5 sm:py-3 text-end w-24 sm:w-36">{lang === 'ar' ? 'المجموع' : 'Total'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-semibold bg-white">
                      {purchaseItems.length > 0 ? (
                        purchaseItems.map((item, idx) => {
                          const unitPrice = Number(item.purchasePrice || item.sellingPrice || 0);
                          const qty = Number(item.quantity || 1);
                          const lineTotal = Number(item.total || (unitPrice * qty));
                          return (
                            <tr key={idx} className="hover:bg-slate-50/60 transition">
                              <td className="px-2 sm:px-4 py-2.5 sm:py-3 text-slate-400 text-start">{idx + 1}</td>
                              <td className="px-2 sm:px-4 py-2.5 sm:py-3 text-slate-900 text-start font-bold">{item.productName || item.name}</td>
                              <td className="px-2 sm:px-4 py-2.5 sm:py-3 text-center font-mono font-bold text-slate-800">{qty}</td>
                              <td className="px-2 sm:px-4 py-2.5 sm:py-3 text-center font-mono text-slate-600">{unitPrice.toFixed(2)} {config.currency}</td>
                              <td className="px-2 sm:px-4 py-2.5 sm:py-3 text-end font-black text-slate-900 font-mono whitespace-nowrap">
                                {lineTotal.toFixed(2)} {config.currency}
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={5} className="py-6 text-center text-slate-400 font-bold">
                            {lang === 'ar' ? 'لا توجد عناصر مسجلة في هذه الفاتورة' : 'No items recorded'}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Financial Summary */}
                <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pt-4 border-t border-slate-200">
                  <div className="text-xs text-slate-500 max-w-sm space-y-2 text-start">
                    {viewingPurchase.notes && (
                      <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
                        <p className="font-black uppercase text-slate-600 text-[10px] mb-1">{t.purchase.notes}:</p>
                        <p className="text-slate-700 leading-relaxed font-medium">{viewingPurchase.notes}</p>
                      </div>
                    )}
                    <p className="text-[10px] text-slate-400 font-mono">Ref ID: {viewingPurchase.id}</p>
                  </div>

                  <div className="w-full sm:w-80 space-y-2 text-xs font-bold text-slate-700 bg-slate-50/80 p-4 rounded-2xl border border-slate-200">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">{lang === 'ar' ? 'إجمالي قيمة المشتريات:' : 'Total Procurement:'}</span>
                      <span className="font-mono text-lg font-black text-slate-900">{viewingPurchase.total.toFixed(2)} {config.currency}</span>
                    </div>

                    <div className="flex justify-between items-center text-emerald-800 bg-emerald-50 px-3 py-2 rounded-xl border border-emerald-200 text-xs">
                      <span className="font-bold">{lang === 'ar' ? 'المبلغ المؤدى (المدفوع):' : 'Amount Paid:'}</span>
                      <span className="font-black font-mono">{viewingPurchase.amountPaid.toFixed(2)} {config.currency}</span>
                    </div>

                    {billDebt > 0 && (
                      <div className="flex justify-between items-center text-rose-800 bg-rose-50 px-3 py-2 rounded-xl border border-rose-200 text-xs">
                        <span className="font-bold">{lang === 'ar' ? 'الدين المتبقي للمورد:' : 'Remaining Debt:'}</span>
                        <span className="font-black font-mono">{billDebt.toFixed(2)} {config.currency}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Repayments History */}
                {purchasePayments.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-slate-200">
                    <h5 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <CheckCircle className="w-4 h-4 text-emerald-600" />
                      <span>{lang === 'ar' ? 'سجل تسديد الدفعات والأقساط السابقة' : 'Installment Repayments Log'}</span>
                    </h5>
                    <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden text-xs">
                      {purchasePayments.map((pmt, idx) => (
                        <div key={pmt.id || idx} className="p-3 flex justify-between items-center bg-slate-50/50">
                          <div className="space-y-0.5">
                            <span className="text-[10px] text-slate-400 font-mono block">
                              {pmt.date ? new Date(pmt.date).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                            </span>
                            <span className="text-slate-800 font-semibold">{pmt.notes || (lang === 'ar' ? 'دفعة مسجلة' : 'Payment')}</span>
                          </div>
                          <span className="font-mono text-emerald-700 font-extrabold text-sm">
                            {Number(pmt.amount || 0).toFixed(2)} {config.currency}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Official Signatures & Stamp Area */}
                <div className="grid grid-cols-2 gap-8 pt-6 border-t-2 border-slate-200">
                  <div className="border border-dashed border-slate-300 rounded-2xl p-4 h-28 flex flex-col justify-between text-center bg-slate-50/40">
                    <span className="text-xs font-bold text-slate-600">
                      {lang === 'ar' ? 'توقيع وخاتم المورّد (المسلّم):' : 'Supplier Signature & Stamp:'}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono italic">Signature & Cachet</span>
                  </div>
                  <div className="border border-dashed border-slate-300 rounded-2xl p-4 h-28 flex flex-col justify-between text-center bg-slate-50/40">
                    <span className="text-xs font-bold text-slate-600">
                      {lang === 'ar' ? 'توقيع وخاتم أمين المخزن (المستلم):' : 'Receiving Warehouse Clerk Stamp:'}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono italic">Signature & Cachet</span>
                  </div>
                </div>

                <div className="text-center text-xs text-slate-400 font-bold pt-2 uppercase tracking-widest font-sans">
                  {lang === 'ar' ? 'تمت مراجعة وقبول السلع المستلمة بالمخزن ومطابقتها للمواصفات' : 'Goods Received in Warehouse Verified and Inspected in Good Condition'}
                </div>
              </div>

              {/* In-Modal Specific Installment Repayment Form */}
              {billDebt > 0 && (
                <div className="bg-slate-50 p-4 border-t border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
                  <div>
                    <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                      <CheckCircle className="w-4 h-4 text-emerald-600" />
                      {lang === 'ar' ? 'تسجيل سداد دفعة لهذه الفاتورة' : 'Pay bill installment balance'}
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {lang === 'ar' ? 'المتبقي للمورد في هذه الفاتورة:' : 'Remaining for vendor:'}{' '}
                      <b className="font-mono text-rose-600">{billDebt.toFixed(2)} {config.currency}</b>
                    </p>
                  </div>

                  <form onSubmit={handleSpecificBillPaymentSubmit} className="flex flex-wrap sm:flex-nowrap gap-2 items-center">
                    <div className="relative">
                      <span className="absolute inset-y-0 start-2.5 flex items-center text-slate-400 text-xs font-bold">{config.currency}</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        max={billDebt.toFixed(2)}
                        required
                        placeholder={billDebt.toFixed(2)}
                        className="ps-10 pe-2 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold w-28 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                        value={billPaymentAmount}
                        onChange={(e) => setBillPaymentAmount(e.target.value)}
                      />
                    </div>
                    <input
                      type="text"
                      placeholder={lang === 'ar' ? 'ملاحظة (كاش، شيك...)' : 'Notes...'}
                      className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-medium w-36 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                      value={billPaymentNotes}
                      onChange={(e) => setBillPaymentNotes(e.target.value)}
                    />
                    <button
                      type="submit"
                      className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition cursor-pointer shrink-0 shadow-xs"
                    >
                      {lang === 'ar' ? 'تسجيل الدفعة' : 'Record'}
                    </button>
                  </form>
                </div>
              )}

              {/* Modal Action Footer with Explicit Back, PDF & Print Buttons */}
              <div className="bg-slate-50 px-4 sm:px-6 py-3.5 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setViewingPurchase(null)}
                  className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
                >
                  <ArrowRight className={`w-4 h-4 ${isRTL ? '' : 'rotate-180'}`} />
                  <span>{lang === 'ar' ? 'رجوع للقائمة' : 'Back'}</span>
                </button>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const po = viewingPurchase;
                      setViewingPurchase(null);
                      setReceiptPreviewPurchase(po);
                    }}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer transition shadow-xs"
                  >
                    <Receipt className="w-4 h-4" />
                    <span>{lang === 'ar' ? 'فاتورة صغيرة (80mm)' : 'Receipt (80mm)'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExportPurchasePdf(viewingPurchase)}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer transition shadow-xs"
                  >
                    <FileDown className="w-4 h-4" />
                    <span>{lang === 'ar' ? 'حفظ PDF' : 'Save PDF'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => triggerPrintLayout(viewingPurchase)}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer transition shadow-sm"
                  >
                    <Printer className="w-4 h-4" />
                    <span>{lang === 'ar' ? 'طباعة الفاتورة' : 'Print Invoice'}</span>
                  </button>
                </div>
              </div>

            </div>
          </div>,
          document.body
        );
      })()}

      {/* MODAL: 80MM THERMAL RECEIPT PREVIEW & PRINT FOR PURCHASES */}
      {receiptPreviewPurchase && createPortal(
        <div
          className="fixed inset-0 bg-slate-900/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 z-[120] overflow-y-auto safe-modal-overlay"
          onClick={() => setReceiptPreviewPurchase(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-[360px] max-h-[92vh] overflow-hidden animate-fade-in flex flex-col my-auto"
          >
            <div className="flex justify-between items-center bg-slate-900 text-white px-4 py-3 border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-emerald-400" />
                <span className="font-bold text-xs">
                  {lang === 'ar' ? 'معاينة فاتورة شراء صغيرة (80mm)' : 'Ticket Achat (80mm)'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setReceiptPreviewPurchase(null)}
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
                      invoiceNumber: receiptPreviewPurchase.purchaseNumber,
                      date: receiptPreviewPurchase.date,
                      customerName: receiptPreviewPurchase.supplierName,
                      sellerName: 'admin',
                      docTitle: lang === 'ar' ? 'فاتورة مشتريات' : "Bon d'Achat",
                      docNumberLabel: lang === 'ar' ? 'رقم الفاتورة:' : 'N°:',
                      partyLabel: lang === 'ar' ? 'المورد :' : 'Fournisseur :',
                      items: (receiptPreviewPurchase.items || []).map((it) => ({
                        productName: it.productName,
                        quantity: it.quantity,
                        sellingPrice: it.purchasePrice,
                        total: Number(it.purchasePrice || 0) * Number(it.quantity || 1),
                      })),
                      subtotal: receiptPreviewPurchase.total,
                      total: receiptPreviewPurchase.total,
                      amountPaid: receiptPreviewPurchase.amountPaid,
                    },
                    config,
                    lang,
                    lang === 'ar' ? 'تمت مراجعة وقبول السلع المستلمة بالمخزن' : 'Procured and verified in good condition'
                  ),
                }}
              />
            </div>

            <div className="bg-white p-3 border-t border-slate-200 flex gap-2 shrink-0">
              <button
                type="button"
                onClick={() => triggerPurchase80mmPrint(receiptPreviewPurchase)}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>{lang === 'ar' ? 'طباعة 80mm' : 'Imprimer 80mm'}</span>
              </button>
              <button
                type="button"
                onClick={() => handleExportPurchasePdf(receiptPreviewPurchase, '80mm')}
                className="py-2.5 px-3 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs transition flex items-center justify-center gap-1 shadow-sm cursor-pointer"
              >
                <FileDown className="w-4 h-4" />
                <span>PDF</span>
              </button>
              <button
                type="button"
                onClick={() => setReceiptPreviewPurchase(null)}
                className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
              >
                {lang === 'ar' ? 'إغلاق' : 'Fermer'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* CUSTOM OVERLAY MODAL: Purchase Invoice Deletion Confirmation */}
      {deletingPurchaseId && createPortal(
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[100] animate-fade-in font-sans">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-md overflow-hidden p-6 space-y-4">
            <div className={`flex items-center gap-3 text-rose-600 pb-2 border-b border-slate-100 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h3 className="text-sm font-black tracking-tight text-slate-800">
                {lang === 'ar' ? 'تأكيد إلغاء وحذف فاتورة الشراء' : 'Revoke Purchase Invoice'}
              </h3>
            </div>
            <p className="text-xs font-bold text-slate-600 leading-relaxed text-start">
              {lang === 'ar' 
                ? `هل أنت متأكد تماماً من رغبتك في إلغاء وحذف فاتورة المشتريات رقم "${purchases.find(p => p.id === deletingPurchaseId)?.purchaseNumber || ''}" نهائياً ؟`
                : `Are you absolutely sure you want to revoke and delete purchase invoice "${purchases.find(p => p.id === deletingPurchaseId)?.purchaseNumber || ''}"?`}
            </p>
            <div className="bg-rose-50 text-[10px] text-rose-800 p-2.5 rounded-xl border border-rose-100 font-bold leading-relaxed text-start">
              {lang === 'ar' 
                ? 'تحذير: سيتم إلغاء فاتورة الشراء بالكامل! هذا سيقوم بخصم كميات المنتجات المستخرجة وخصم الديون المترتبة لصالح المورد تلقائياً.'
                : 'Warning: This will completely reverse this purchase! Stock quantities and vendor credit balances will be automatically adjusted.'}
            </div>
            <div className={`flex items-center justify-end gap-3 pt-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <button
                id="btn-confirm-delete-purchase-cancel"
                onClick={() => setDeletingPurchaseId(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
              >
                {lang === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                id="btn-confirm-delete-purchase-action"
                onClick={() => {
                  onDeletePurchase(deletingPurchaseId);
                  setDeletingPurchaseId(null);
                }}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-xl text-xs transition cursor-pointer"
              >
                {lang === 'ar' ? 'إلغاء الفاتورة بالتأكيد' : 'Yes, Revoke Purchase'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* CUSTOM OVERLAY MODAL: Overpayment Confirmation */}
      {overpayTarget && createPortal(
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[100] animate-fade-in font-sans">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-md overflow-hidden p-6 space-y-4">
            <div className={`flex items-center gap-3 text-amber-600 pb-2 border-b border-indigo-50 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h3 className="text-sm font-black tracking-tight text-slate-800">
                {lang === 'ar' ? 'تأكيد تجاوز قيمة الدين (مسبقة الدفع)' : 'Confirm Pre-payment Settle'}
              </h3>
            </div>
            <p className="text-xs font-bold text-slate-600 leading-relaxed text-start">
              {lang === 'ar'
                ? `تنبيه: القيمة المدخلة لتسديد المورد (${overpayTarget.amount}) أكبر من إجمالي الدين المسجل له حالياً (${suppliers.find(s => s.id === overpayTarget.supplierId)?.debt || 0})! هل تريد المتابعة لتسجيل المبلغ بالكامل؟`
                : `Notice: Settle amount (${overpayTarget.amount}) is greater than current vendor debt of ${suppliers.find(s => s.id === overpayTarget.supplierId)?.debt || 0}. Would you like to proceed and submit this as pre-payment credit?`}
            </p>
            <div className={`flex items-center justify-end gap-3 pt-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <button
                id="btn-confirm-overpay-cancel"
                onClick={() => setOverpayTarget(null)}
                className="px-4 py-2 bg-slate-105 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
              >
                {lang === 'ar' ? 'تراجع' : 'Back'}
              </button>
              <button
                id="btn-confirm-overpay-action"
                onClick={() => {
                  onSettleSupplierDebt(overpayTarget.supplierId, overpayTarget.amount, overpayTarget.notes);
                  setOverpayTarget(null);
                  setIsSettlingDebt(false);
                  setSettleSupplierId('');
                  setSettleAmount('');
                  setSettleNotes('');
                }}
                className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-black rounded-xl text-xs transition cursor-pointer"
              >
                {lang === 'ar' ? 'تسجيل الدفعة بالتأكيد' : 'Confirm Overpayment'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}
