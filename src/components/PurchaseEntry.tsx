import React, { useState, useMemo } from 'react';
import { Supplier, Product, Purchase, PurchaseItem, StoreConfig, Language, Employee, ActiveTab } from '../types';
import { languages } from '../languages';
import { ShoppingBag, Search, Plus, Trash2, CheckCircle, AlertTriangle, ArrowRight, Truck, RefreshCw, X, Receipt } from 'lucide-react';
import { parseDecimal, sanitizeDecimalInput } from '../utils/numberInput';

interface PurchaseEntryProps {
  suppliers: Supplier[];
  products: Product[];
  config: StoreConfig;
  purchasesCount: number;
  onSavePurchase: (purchase: Purchase) => void;
  onNavigate: (tab: ActiveTab) => void;
  lang: Language;
  currentUser: Employee;
}

export default function PurchaseEntry({
  suppliers,
  products,
  config,
  purchasesCount,
  onSavePurchase,
  onNavigate,
  lang,
  currentUser,
}: PurchaseEntryProps) {
  const t = languages[lang];
  const isRTL = t.direction === 'rtl';

  const [supplierId, setSupplierId] = useState('');
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [showProductSearchResults, setShowProductSearchResults] = useState(false);
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

  const selectedSupplier = useMemo(() => {
    return suppliers.find(s => s.id === supplierId);
  }, [suppliers, supplierId]);

  // Real-time product search filter
  const searchedProducts = useMemo(() => {
    if (!productSearchQuery.trim()) return [];
    const q = productSearchQuery.toLowerCase().trim();
    return products.filter(
      p => p.name.toLowerCase().includes(q) || (p.sku && p.sku.toLowerCase().includes(q))
    ).slice(0, 10);
  }, [products, productSearchQuery]);

  // Instant Add / Select Product (Inserted at the TOP as requested)
  const handleSelectSearchedProduct = (prod: Product) => {
    const existingIndex = cartItems.findIndex(i => i.productId === prod.id);
    if (existingIndex > -1) {
      const next = [...cartItems];
      const existingItem = next[existingIndex];
      const updatedItem = {
        ...existingItem,
        quantity: parseDecimal(existingItem.quantity, 0) + 1
      };
      next.splice(existingIndex, 1);
      setCartItems([updatedItem, ...next]);
    } else {
      // If the first row is empty, overwrite it
      if (cartItems.length === 1 && !cartItems[0].productId && !cartItems[0].productName && parseDecimal(cartItems[0].purchasePrice, 0) === 0) {
        setCartItems([{
          productId: prod.id,
          productName: prod.name,
          purchasePrice: prod.purchasePrice || 0,
          quantity: 1
        }]);
      } else {
        setCartItems(prev => [
          {
            productId: prod.id,
            productName: prod.name,
            purchasePrice: prod.purchasePrice || 0,
            quantity: 1
          },
          ...prev
        ]);
      }
    }
    setProductSearchQuery('');
    setShowProductSearchResults(false);
  };

  const handleAddCartItemRow = () => {
    setCartItems(prev => [
      { productId: '', productName: '', purchasePrice: 0, quantity: 1 },
      ...prev
    ]);
  };

  const handleRemoveCartItemRow = (index: number) => {
    if (cartItems.length <= 1) return;
    setCartItems(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleCartItemChange = (index: number, field: string, val: any) => {
    setCartItems(prev => {
      const copy = [...prev];
      if (field === 'productId') {
        const prod = products.find(p => p.id === val);
        if (prod) {
          copy[index] = {
            ...copy[index],
            productId: prod.id,
            productName: prod.name,
            purchasePrice: prod.purchasePrice || 0
          };
        } else {
          copy[index] = {
            ...copy[index],
            productId: '',
            productName: '',
            purchasePrice: 0
          };
        }
      } else if (field === 'productName') {
        copy[index].productName = val;
      } else if (field === 'purchasePrice') {
        copy[index].purchasePrice = val;
      } else if (field === 'quantity') {
        copy[index].quantity = val;
      }
      return copy;
    });
  };

  // Total invoice cost
  const formTotal = useMemo(() => {
    return cartItems.reduce((acc, itm) => acc + (parseDecimal(itm.purchasePrice, 0) * parseDecimal(itm.quantity, 0)), 0);
  }, [cartItems]);

  const paidVal = parseDecimal(amountPaidState);
  const debtBalance = Math.max(0, formTotal - paidVal);

  const resetForm = () => {
    setSupplierId('');
    setProductSearchQuery('');
    setShowProductSearchResults(false);
    setNotes('');
    setAmountPaidState('');
    setCartItems([{ productId: '', productName: '', purchasePrice: 0, quantity: 1 }]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!supplierId) {
      alert(lang === 'ar' ? 'يرجى اختيار المورّد أولاً.' : 'Please select a supplier first.');
      return;
    }

    const selectedProp = suppliers.find(s => s.id === supplierId);
    if (!selectedProp) return;

    // Validate items
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

    const paid = Math.max(0, paidVal);
    let status: 'paid' | 'unpaid' | 'partial' = 'paid';
    if (paid === 0) {
      status = 'unpaid';
    } else if (paid < formTotal) {
      status = 'partial';
    }

    const poNumber = 'PO-2026-' + String(purchasesCount + 101);

    const newPO: Purchase = {
      id: 'pur_' + Date.now(),
      purchaseNumber: poNumber,
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
    resetForm();

    if (lang === 'ar') {
      alert(`تم تسجيل فاتورة الشراء (${poNumber}) بنجاح! تم تحديث كميات المخزون وحساب المورّد.`);
    } else {
      alert(`Purchase invoice (${poNumber}) saved successfully! Stock and vendor accounts updated.`);
    }
  };

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="space-y-6 text-start max-w-7xl mx-auto">
      {/* 1. Header Bar with Supplier Selection & Date & PO */}
      <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-100 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-indigo-600/10 text-indigo-600 flex items-center justify-center shrink-0">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg font-black text-slate-800">
                  {lang === 'ar' ? 'فاتورة مشتريات جديدة (توريد بضاعة)' : 'New Purchase Invoice (Stock Procure)'}
                </h1>
                <span className="px-2.5 py-0.5 bg-indigo-50 text-indigo-700 text-xs font-mono font-bold rounded-lg border border-indigo-100">
                  PO-2026-{String(purchasesCount + 101)}
                </span>
                <span className="px-2.5 py-0.5 bg-slate-100 text-slate-600 text-xs font-medium rounded-lg">
                  {new Date().toLocaleDateString('fr-FR')}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium mt-0.5">
                {lang === 'ar'
                  ? 'تسجيل وصول سلع جديدة من الموردين، زيادة المخزن تلقائياً، وتحديث حسابات الديون.'
                  : 'Procure items from suppliers, automatically increase inventory stock, and track balances.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('purchases')}
            className="w-full sm:w-auto justify-center px-3.5 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition cursor-pointer flex items-center gap-2 shrink-0"
          >
            <Receipt className="w-4 h-4 text-indigo-600" />
            <span>{lang === 'ar' ? 'سجل فواتير المشتريات والديون' : 'Purchases & Debts Log'}</span>
            <ArrowRight className={`w-3.5 h-3.5 ${isRTL ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Integrated Supplier Selector */}
        <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="flex items-center gap-2 shrink-0">
            <Truck className="w-4 h-4 text-indigo-600 shrink-0" />
            <span className="text-xs font-black text-slate-700 whitespace-nowrap">
              {lang === 'ar' ? 'اختر المورد للشراء منه:' : 'Select Supplier:'}
            </span>
          </div>
          <div className="flex-1">
            {suppliers.length > 0 ? (
              <select
                id="purchase-entry-supplier-select"
                required
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
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
              <div className="p-2 bg-amber-50 text-amber-800 border border-amber-200 rounded-xl text-xs font-bold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                <span>{lang === 'ar' ? 'يرجى تسجيل مورّدين في سجل الموردين أولاً.' : 'Please register suppliers first.'}</span>
              </div>
            )}
          </div>
          {selectedSupplier && (
            <div className="px-3 py-1.5 bg-slate-100 rounded-xl text-xs font-bold flex items-center gap-2 shrink-0">
              <span className="text-slate-500">{lang === 'ar' ? 'الرصيد المعلق:' : 'Debt:'}</span>
              <span className={`font-mono font-extrabold ${selectedSupplier.debt > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                {selectedSupplier.debt.toFixed(2)} {config.currency}
              </span>
            </div>
          )}
          <button
            type="button"
            onClick={() => onNavigate('suppliers')}
            className="text-xs font-bold text-indigo-600 hover:text-indigo-800 px-2 py-1.5 transition cursor-pointer whitespace-nowrap shrink-0"
          >
            + {lang === 'ar' ? 'مورّد جديد' : 'New Supplier'}
          </button>
        </div>
      </div>

      {/* Main Procurement Form */}
      <form onSubmit={handleSubmit} className="space-y-6">

        {/* 2. Quick Barcode / Product Search Card (Placed ABOVE Items Table as requested) */}
        <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-100 shadow-xs space-y-3 relative">
          <div className="flex flex-wrap justify-between items-center gap-2">
            <label className="text-xs font-black text-slate-700 flex items-center gap-1.5">
              <Search className="w-4 h-4 text-indigo-600 shrink-0" />
              <span>{lang === 'ar' ? '🔍 مسح الباركود أو البحث السريع لإضافة منتج للجدول أدناه (يُضاف في الأعلى)' : '🔍 Scan SKU or Search to Add Product to Table Below'}</span>
            </label>
            <button
              type="button"
              onClick={() => onNavigate('inventory')}
              className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 transition cursor-pointer whitespace-nowrap shrink-0"
            >
              + {lang === 'ar' ? 'تعريف مادة جديدة في المخزن' : 'New Product'}
            </button>
          </div>

          <div className="relative">
            <span className={`absolute inset-y-0 ${isRTL ? 'right-3' : 'left-3'} flex items-center text-slate-400 pointer-events-none`}>
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              placeholder={lang === 'ar' ? 'اكتب اسم المنتج أو امسح الباركود (SKU) للإضافة المباشرة في الأعلى...' : 'Type product name or scan SKU...'}
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

          {/* Instant Search Dropdown */}
          {showProductSearchResults && productSearchQuery.trim().length > 0 && (
            <div className="absolute z-30 top-full left-5 right-5 mt-1 bg-white rounded-2xl shadow-2xl border-2 border-indigo-200 overflow-hidden max-h-64 overflow-y-auto animate-fade-in">
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

        {/* 3. Items Table Card */}
        <div className="bg-white p-4 sm:p-6 rounded-3xl border border-slate-100 shadow-xs space-y-4">
          <div className="flex flex-wrap justify-between items-center gap-2.5">
            <h2 className="text-sm font-black text-slate-800 flex items-center gap-2 flex-wrap">
              <span>{lang === 'ar' ? 'قائمة المواد والكميات المشتراة' : 'Procured Items List'}</span>
              <span className="px-2.5 py-0.5 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-full border border-indigo-100 whitespace-nowrap shrink-0">
                {cartItems.length} {lang === 'ar' ? 'مواد' : 'items'}
              </span>
            </h2>
            <button
              id="btn-add-purchase-entry-row"
              type="button"
              onClick={handleAddCartItemRow}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-xs whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4 shrink-0" />
              <span>{lang === 'ar' ? 'إضافة سطر مادة (في الأعلى)' : 'Add Item Row'}</span>
            </button>
          </div>

          <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[335px] sm:min-w-[580px] text-xs text-start">
                <thead className="bg-slate-50 text-slate-700 font-extrabold uppercase text-[11px] sm:text-xs border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 sm:py-3 px-1.5 sm:px-4 text-start min-w-[160px] sm:min-w-[230px]">{lang === 'ar' ? 'المنتج / الصنف' : 'Product Item'}</th>
                    <th className="py-2.5 sm:py-3 px-1.5 sm:px-4 text-center min-w-[82px] sm:min-w-[120px] w-24 sm:w-36">{lang === 'ar' ? `سعر الشراء (${config.currency})` : `Unit Cost (${config.currency})`}</th>
                    <th className="py-2.5 sm:py-3 px-1.5 sm:px-4 text-center min-w-[68px] sm:min-w-[105px] w-20 sm:w-32">{lang === 'ar' ? 'الكمية' : 'Quantity'}</th>
                    <th className="py-2.5 sm:py-3 px-2 sm:px-4 text-end min-w-[80px] sm:min-w-[100px] w-24 sm:w-36">{lang === 'ar' ? `المجموع (${config.currency})` : `Total (${config.currency})`}</th>
                    <th className="py-2.5 sm:py-3 px-1 sm:px-2 text-center w-9 sm:w-12"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {cartItems.map((item, idx) => {
                    const rowTotal = parseDecimal(item.purchasePrice, 0) * parseDecimal(item.quantity, 0);
                    return (
                      <tr key={idx} className="hover:bg-slate-50/50 transition">
                        <td className="py-2.5 sm:py-3 px-1.5 sm:px-4">
                          <div className="space-y-1.5">
                            <select
                              className="w-full min-w-[152px] sm:min-w-[210px] bg-slate-50 border border-slate-300 rounded-xl px-2 sm:px-3 py-1.5 sm:py-2 text-xs font-extrabold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                              value={item.productId}
                              onChange={(e) => handleCartItemChange(idx, 'productId', e.target.value)}
                            >
                              <option value="" className="font-bold text-slate-900">-- {lang === 'ar' ? 'صنف غير مسجل (إدخال يدوي)' : 'Unregistered (Manual Text)'} --</option>
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
                              className="w-full min-w-[152px] sm:min-w-[210px] bg-white border border-indigo-300 rounded-xl px-2.5 sm:px-3 py-2 text-xs sm:text-sm font-extrabold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              value={item.productName}
                              onChange={(e) => handleCartItemChange(idx, 'productName', e.target.value)}
                            />
                          </div>
                        </td>
                        <td className="py-2.5 sm:py-3 px-1.5 sm:px-4 text-center align-top">
                          <input
                            type="text"
                            inputMode="decimal"
                            placeholder="0.00"
                            required
                            onFocus={(e) => e.target.select()}
                            className="w-full min-w-[76px] sm:min-w-[104px] bg-slate-50 border border-slate-300 rounded-xl px-2 sm:px-3 py-2 sm:py-2.5 text-xs sm:text-sm font-black font-mono text-center text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white placeholder:text-slate-300 placeholder:font-normal"
                            value={item.purchasePrice === 0 || item.purchasePrice === '0' ? '' : item.purchasePrice}
                            onChange={(e) => handleCartItemChange(idx, 'purchasePrice', sanitizeDecimalInput(e.target.value))}
                          />
                        </td>
                        <td className="py-2.5 sm:py-3 px-1.5 sm:px-4 text-center align-top">
                          <input
                            type="text"
                            inputMode="decimal"
                            placeholder="1"
                            required
                            onFocus={(e) => e.target.select()}
                            className="w-full min-w-[62px] sm:min-w-[92px] bg-slate-50 border border-slate-300 rounded-xl px-2 sm:px-3 py-2 sm:py-2.5 text-xs sm:text-sm font-black font-mono text-center text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white placeholder:text-slate-300 placeholder:font-normal"
                            value={item.quantity === 0 || item.quantity === '0' ? '' : item.quantity}
                            onChange={(e) => handleCartItemChange(idx, 'quantity', sanitizeDecimalInput(e.target.value))}
                          />
                        </td>
                        <td className="py-2.5 sm:py-3 px-2 sm:px-4 text-end font-mono font-black text-slate-800 align-top pt-3 sm:pt-3.5 text-xs sm:text-sm">
                          {rowTotal.toFixed(2)} {config.currency}
                        </td>
                        <td className="py-3 px-2 text-center align-top pt-3">
                          {cartItems.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveCartItemRow(idx)}
                              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                              title="Delete row"
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

        {/* 4. Financial Summary Cards & Notes */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Card 1: Total PO Cost */}
          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs space-y-1">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
              {lang === 'ar' ? 'إجمالي المشتريات المستحق' : 'Total Procurement Cost'}
            </span>
            <div className="text-2xl font-black text-slate-900 font-mono">
              {formTotal.toFixed(2)} <span className="text-sm font-bold text-slate-500">{config.currency}</span>
            </div>
          </div>

          {/* Card 2: Cash Paid Input */}
          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs space-y-1">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">
              {lang === 'ar' ? 'المبلغ المؤدى كاش' : 'Cash Paid'} <span className="text-rose-500">*</span>
            </label>
            <input
              id="purchase-entry-paid-input"
              type="text"
              inputMode="decimal"
              required
              placeholder="0.00"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-bold font-mono text-emerald-700"
              value={amountPaidState}
              onChange={(e) => setAmountPaidState(sanitizeDecimalInput(e.target.value))}
            />
          </div>

          {/* Card 3: Balance Debt */}
          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs space-y-1">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
              {lang === 'ar' ? 'المتبقي (دين جديد للمورد)' : 'Balance (Debt to Vendor)'}
            </span>
            <div className={`text-2xl font-black font-mono ${debtBalance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
              {debtBalance.toFixed(2)} <span className="text-sm font-bold text-slate-500">{config.currency}</span>
            </div>
          </div>
        </div>

        {/* 5. Notes & WAC info */}
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs space-y-3">
          <div className="space-y-1">
            <label className="block text-xs font-bold text-slate-700">
              {lang === 'ar' ? 'ملاحظات وبوليصة الشحن (اختياري)' : 'Remarks & PO Notes (Optional)'}
            </label>
            <input
              id="purchase-entry-notes"
              type="text"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-xs font-semibold"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={lang === 'ar' ? 'سجل شروط الدفع، رقم بوليصة الشحن، أو ملاحظات التسليم...' : 'Supplier remarks or delivery note...'}
            />
          </div>

          <div className="text-[11px] text-slate-500 bg-indigo-50/40 p-3 rounded-2xl border border-indigo-100/50 flex items-center gap-2">
            <span className="text-indigo-600 font-bold">💡 {lang === 'ar' ? 'تحديث تلقائي:' : 'Notice:'}</span>
            <span>
              {lang === 'ar'
                ? 'عند حفظ هذه الفاتورة، سيقوم النظام تلقائياً بزيادة كميات المخزن وحساب متوسط سعر الشراء المرجح (WAC) لكل مادة لضمان دقة الأرباح في نقطة البيع والتقارير.'
                : 'Saving this purchase will automatically increment stock inventory and compute Weighted Average Cost (WAC) for precise profit margin analysis.'}
            </span>
          </div>
        </div>

        {/* 6. Sticky Bottom Action Controls */}
        <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-100 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-sm font-bold text-slate-600 text-center sm:text-start">
            <span className="text-slate-400 font-medium">{lang === 'ar' ? 'المجموع المستحق للفاتورة:' : 'Total Payable:'} </span>
            <span className="font-mono font-black text-slate-900 text-lg sm:text-xl">{formTotal.toFixed(2)} {config.currency}</span>
          </div>

          <div className="flex flex-wrap items-center justify-center sm:justify-end gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{lang === 'ar' ? 'تفريغ الحقول' : 'Reset Form'}</span>
            </button>
            <button
              type="submit"
              disabled={suppliers.length === 0}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl transition cursor-pointer shadow-sm disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <CheckCircle className="w-4 h-4" />
              <span>{lang === 'ar' ? 'حفظ وتنزيل الفاتورة في المخزون' : 'Save & Receive Stock'}</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
