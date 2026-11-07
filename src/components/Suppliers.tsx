/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Supplier, Purchase, Language, StoreConfig } from '../types';
import { languages } from '../languages';
import { 
  Truck, Search, Phone, Mail, Building2, Edit3, Trash2, X, 
  Printer, FileDown, PlusCircle, CreditCard, FileText, CheckCircle, 
  AlertTriangle, DollarSign, ArrowUpRight
} from 'lucide-react';
import SupplierLedger from './SupplierLedger';
import { printHtmlContent, exportStructuredPdf, PdfDocumentMeta } from '../utils/printService';
import { parseDecimal, sanitizeDecimalInput } from '../utils/numberInput';
import { triggerHaptic } from '../utils/haptics';

interface SuppliersProps {
  suppliers: Supplier[];
  purchases?: Purchase[];
  config?: StoreConfig;
  onSaveSupplier: (supplier: Supplier) => void;
  onDeleteSupplier: (id: string) => void;
  onSettleDebt?: (supplierId: string, amount: number, notes?: string) => void;
  lang: Language;
}

export default function Suppliers({ 
  suppliers, 
  purchases = [], 
  config, 
  onSaveSupplier, 
  onDeleteSupplier, 
  onSettleDebt, 
  lang 
}: SuppliersProps) {
  const t = languages[lang];
  const isRTL = t.direction === 'rtl';
  const currency = config?.currency || 'MAD';

  const [search, setSearch] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Partial<Supplier> | null>(null);
  const [deletingSupplierId, setDeletingSupplierId] = useState<string | null>(null);
  
  // Selected ledger supplier
  const [selectedLedgerSupplierId, setSelectedLedgerSupplierId] = useState<string | null>(null);

  // Quick Settle Debt modal
  const [settlingSupplierId, setSettlingSupplierId] = useState<string | null>(null);
  const [quickSettleAmount, setQuickSettleAmount] = useState('');
  const [quickSettleNotes, setQuickSettleNotes] = useState('');

  // Filter by debt status
  const [debtFilter, setDebtFilter] = useState<'all' | 'with_debt' | 'zero_debt'>('all');

  // Aggregates
  const totalSuppliersCount = suppliers.length;
  const suppliersWithDebt = suppliers.filter(s => (Number(s.debt) || 0) > 0);
  const totalSupplierDebt = suppliers.reduce((sum, s) => sum + Math.max(0, Number(s.debt) || 0), 0);

  // Filtered list
  const filteredSuppliers = suppliers.filter((s) => {
    const q = search.toLowerCase();
    const matchesSearch = (
      s.name.toLowerCase().includes(q) ||
      s.phone.includes(q) ||
      (s.email && s.email.toLowerCase().includes(q)) ||
      (s.company && s.company.toLowerCase().includes(q))
    );
    if (!matchesSearch) return false;

    const sDebt = Number(s.debt) || 0;
    if (debtFilter === 'with_debt' && sDebt <= 0) return false;
    if (debtFilter === 'zero_debt' && sDebt > 0) return false;

    return true;
  });

  // Selected supplier object for ledger view
  const selectedLedgerSupplier = suppliers.find((s) => s.id === selectedLedgerSupplierId);
  if (selectedLedgerSupplier) {
    return (
      <SupplierLedger
        supplier={selectedLedgerSupplier}
        purchases={purchases}
        onSettleDebt={(sId, amt, notes) => {
          if (onSettleDebt) {
            onSettleDebt(sId, amt, notes);
          }
        }}
        onClose={() => setSelectedLedgerSupplierId(null)}
        lang={lang}
        config={config || { name: 'Smart POS', phone: '', email: '', address: '', registrationNumber: '', currency: 'MAD', taxRate: 0 }}
      />
    );
  }

  const handleStartAdd = () => {
    setEditingSupplier({
      id: '',
      name: '',
      phone: '',
      email: '',
      company: '',
      notes: '',
      debt: 0
    });
    setIsEditing(true);
  };

  const handleStartEdit = (s: Supplier) => {
    setEditingSupplier({ ...s });
    setIsEditing(true);
  };

  const handleSaveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSupplier) return;

    if (!editingSupplier.name || !editingSupplier.phone || !editingSupplier.company) {
      alert(t.common.requiredFields);
      return;
    }

    const supplierToSave: Supplier = {
      id: editingSupplier.id || 'supp_' + Date.now(),
      name: editingSupplier.name,
      phone: editingSupplier.phone,
      email: editingSupplier.email || '',
      company: editingSupplier.company,
      debt: editingSupplier.debt !== undefined ? Number(editingSupplier.debt) : 0,
      notes: editingSupplier.notes || '',
      createdAt: editingSupplier.createdAt || new Date().toISOString(),
    };

    onSaveSupplier(supplierToSave);
    setIsEditing(false);
    setEditingSupplier(null);
  };

  // Build Structured Supplier Debts PDF Report
  const buildSupplierDebtsPdfMeta = (): PdfDocumentMeta => {
    return {
      title: isRTL ? 'تقرير ديون الموردين الشامل' : 'Supplier Debts Statement',
      subtitle: isRTL ? `كشف تفصيلي بالديون المستحقة للموردين الواجب أداؤها (${suppliersWithDebt.length} مورد)` : `Detailed supplier liabilities statement (${suppliersWithDebt.length} vendors)`,
      docNumber: `SUPP-DEBTS-${new Date().toISOString().slice(0, 10)}`,
      date: `${new Date().toLocaleDateString('fr-FR')} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      storeName: config?.name || 'Smart POS',
      storePhone: config?.phone,
      storeAddress: config?.address,
      customerName: isRTL ? 'قسم المشتريات والمحاسبة' : 'Procurement & Accounts Payable',
      currency,
      mode: 'a4',
      isRTL,
      lang,
      summaryCards: [
        {
          label: isRTL ? 'إجمالي الموردين المسجلين' : 'Total Registered Vendors',
          value: `${totalSuppliersCount} ${isRTL ? 'مورد' : 'vendors'}`,
          subValue: isRTL ? 'سجل الموردين المعتمدين' : 'Active accounts',
          color: '#1e3a8a'
        },
        {
          label: isRTL ? 'موردين لهم ديون بذمتنا' : 'Vendors With Outstanding Debt',
          value: `${suppliersWithDebt.length} ${isRTL ? 'مورد' : 'vendors'}`,
          subValue: isRTL ? 'يتطلبون تسديد دفعات' : 'Payable liabilities',
          color: '#b91c1c'
        },
        {
          label: isRTL ? 'مجموع الديون الواجب أداؤها' : 'Total Outstanding Debt',
          value: `${totalSupplierDebt.toFixed(2)} ${currency}`,
          subValue: isRTL ? 'المستحقات المالية للموردين' : 'Net liabilities balance',
          color: '#dc2626'
        }
      ],
      customTableHeaders: {
        name: isRTL ? 'المورّد والشركة' : 'Vendor / Company',
        qty: isRTL ? 'الهاتف' : 'Phone',
        price: isRTL ? 'الفواتير' : 'Invoices',
        total: isRTL ? 'الدين المستحق' : 'Debt Owed'
      },
      items: suppliersWithDebt.map((s) => {
        const suppPurchases = purchases.filter(p => p.supplierId === s.id);
        const totalPurch = suppPurchases.reduce((acc, p) => acc + (Number(p.total) || 0), 0);
        return {
          name: `${s.name} (${s.company})`,
          quantity: s.phone,
          unitPrice: totalPurch,
          total: Number(s.debt) || 0
        };
      }),
      subtotal: totalSupplierDebt,
      total: totalSupplierDebt,
      hidePaymentDetails: true,
      footerText: 'Smart POS Pro - Supplier Debts & Liabilities Statement'
    };
  };

  const handlePrintSupplierDebtsReport = () => {
    triggerHaptic('light');
    const meta = buildSupplierDebtsPdfMeta();
    const printHtml = `
      <div style="font-family: Arial, sans-serif; padding: 20px; direction: ${isRTL ? 'rtl' : 'ltr'};">
        <div style="border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 15px;">
          <h2 style="margin: 0 0 5px 0;">${config?.name || 'Smart POS'} - ${isRTL ? 'تقرير ديون الموردين الشامل' : 'Supplier Debts Statement'}</h2>
          <div style="font-size: 12px; color: #555;">
            ${isRTL ? 'تاريخ التقرير:' : 'Date:'} ${new Date().toLocaleDateString('fr-FR')} ${new Date().toLocaleTimeString()} | ${isRTL ? 'عدد الموردين المدينين:' : 'Vendors:'} ${suppliersWithDebt.length}
          </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 20px;">
          <div style="border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px; background: #f8fafc;">
            <div style="font-size: 11px; color: #64748b; font-weight: bold;">${isRTL ? 'إجمالي الموردين' : 'Total Vendors'}</div>
            <div style="font-size: 18px; font-weight: 900; color: #1e3a8a; margin-top: 3px;">${totalSuppliersCount}</div>
          </div>
          <div style="border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px; background: #f8fafc;">
            <div style="font-size: 11px; color: #64748b; font-weight: bold;">${isRTL ? 'موردين لهم ديون' : 'Vendors with Debt'}</div>
            <div style="font-size: 18px; font-weight: 900; color: #b91c1c; margin-top: 3px;">${suppliersWithDebt.length}</div>
          </div>
          <div style="border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px; background: #f8fafc;">
            <div style="font-size: 11px; color: #64748b; font-weight: bold;">${isRTL ? 'مجموع الديون المستحقة' : 'Total Debt Due'}</div>
            <div style="font-size: 18px; font-weight: 900; color: #dc2626; margin-top: 3px;">${totalSupplierDebt.toFixed(2)} ${currency}</div>
          </div>
        </div>

        <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
          <thead>
            <tr style="background: #f1f5f9; border-bottom: 2px solid #cbd5e1;">
              <th style="padding: 8px; text-align: ${isRTL ? 'right' : 'left'};">#</th>
              <th style="padding: 8px; text-align: ${isRTL ? 'right' : 'left'};">${isRTL ? 'المورّد' : 'Supplier'}</th>
              <th style="padding: 8px; text-align: ${isRTL ? 'right' : 'left'};">${isRTL ? 'الشركة' : 'Company'}</th>
              <th style="padding: 8px; text-align: ${isRTL ? 'right' : 'left'};">${isRTL ? 'الهاتف' : 'Phone'}</th>
              <th style="padding: 8px; text-align: ${isRTL ? 'left' : 'right'};">${isRTL ? 'إجمالي المشتريات' : 'Total Purchases'}</th>
              <th style="padding: 8px; text-align: ${isRTL ? 'left' : 'right'}; font-weight: 900;">${isRTL ? 'الدين المتبقي' : 'Debt Owed'}</th>
            </tr>
          </thead>
          <tbody>
            ${suppliersWithDebt.length > 0 ? suppliersWithDebt.map((s, idx) => {
              const sPurch = purchases.filter(p => p.supplierId === s.id);
              const totalPurch = sPurch.reduce((acc, p) => acc + (Number(p.total) || 0), 0);
              return `
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 8px; color: #64748b;">${idx + 1}</td>
                  <td style="padding: 8px; font-weight: bold;">${s.name}</td>
                  <td style="padding: 8px; color: #334155;">${s.company}</td>
                  <td style="padding: 8px; font-family: monospace;">${s.phone}</td>
                  <td style="padding: 8px; text-align: ${isRTL ? 'left' : 'right'}; font-family: monospace;">${totalPurch.toFixed(2)} ${currency}</td>
                  <td style="padding: 8px; text-align: ${isRTL ? 'left' : 'right'}; font-family: monospace; font-weight: 900; color: #b91c1c;">${Number(s.debt).toFixed(2)} ${currency}</td>
                </tr>
              `;
            }).join('') : `
              <tr>
                <td colspan="6" style="padding: 20px; text-align: center; color: #64748b;">${isRTL ? 'الحمد لله، لا توجد أي ديون مستحقة لأي مورّد حالياً!' : 'No outstanding supplier debts.'}</td>
              </tr>
            `}
          </tbody>
          <tfoot>
            <tr style="background: #f8fafc; border-top: 2px solid #000; font-weight: 900;">
              <td colspan="5" style="padding: 10px; text-align: ${isRTL ? 'right' : 'left'}; font-size: 13px;">${isRTL ? 'المجموع الكلي لديون الموردين:' : 'Grand Total:'}</td>
              <td style="padding: 10px; text-align: ${isRTL ? 'left' : 'right'}; font-family: monospace; font-size: 14px; color: #b91c1c;">${totalSupplierDebt.toFixed(2)} ${currency}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    `;

    printHtmlContent({ html: printHtml, title: 'SUPPLIER-DEBTS-REPORT', isRTL, mode: 'a4' }, meta);
  };

  const handleExportSupplierDebtsPdf = async () => {
    triggerHaptic('light');
    await exportStructuredPdf(buildSupplierDebtsPdfMeta(), `Supplier-Debts-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const handleConfirmQuickSettle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!settlingSupplierId || !onSettleDebt) return;
    const amount = parseDecimal(quickSettleAmount, 0);
    if (amount <= 0) {
      alert(isRTL ? 'يرجى إدخال مبلغ صحيح أكبر من صفر.' : 'Veuillez entrer un montant valide.');
      return;
    }
    onSettleDebt(settlingSupplierId, amount, quickSettleNotes || undefined);
    setSettlingSupplierId(null);
    setQuickSettleAmount('');
    setQuickSettleNotes('');
  };

  return (
    <div className="space-y-6" id="suppliers-section">
      {/* Header Panel */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
        <div>
          <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2.5">
            <Truck className="w-7 h-7 text-indigo-600" />
            <span>{t.supplier.title}</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {lang === 'ar'
              ? 'إدارة سجل الموردين، متابعة الديون المستحقة، كشوفات الحساب وتاريخ العمليات.'
              : 'Track corporate vendors, debts, account statements and purchase history.'}
          </p>
        </div>

        {/* Header Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          {/* Print Debts Report Button */}
          <button
            type="button"
            onClick={handlePrintSupplierDebtsReport}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-900 hover:bg-black text-white text-xs font-black rounded-xl transition cursor-pointer shadow-xs"
            title={isRTL ? 'طباعة تقرير ديون الموردين (A4)' : 'Imprimer rapport des dettes'}
          >
            <Printer className="w-4 h-4 text-emerald-400" />
            <span>{isRTL ? 'طباعة تقرير الديون' : 'Rapport Dettes'}</span>
          </button>

          {/* Export Debts PDF */}
          <button
            type="button"
            onClick={handleExportSupplierDebtsPdf}
            className="flex items-center gap-1.5 px-3 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-black rounded-xl transition cursor-pointer shadow-xs"
            title="PDF"
          >
            <FileDown className="w-4 h-4" />
            <span>PDF</span>
          </button>

          {/* Add Supplier Button */}
          <button
            id="btn-add-supplier"
            onClick={handleStartAdd}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl transition duration-200 shadow-sm cursor-pointer text-xs"
          >
            <Truck className="w-4 h-4" />
            <span>{t.supplier.addSupplier}</span>
          </button>
        </div>
      </div>

      {/* KPI Overview Summary Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Total Suppliers */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 block">{isRTL ? 'إجمالي الموردين المسجلين' : 'Total Fournisseurs'}</span>
            <span className="text-2xl font-black font-mono text-slate-900 mt-0.5 block">{totalSuppliersCount}</span>
            <span className="text-[11px] text-slate-400 font-semibold">{isRTL ? 'سجل الشركات والموردين' : 'Comptes actifs'}</span>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 border border-indigo-100">
            <Truck className="w-5 h-5" />
          </div>
        </div>

        {/* Vendors With Debt */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 block">{isRTL ? 'موردين لهم ديون بذمتنا' : 'Fournisseurs avec dette'}</span>
            <span className="text-2xl font-black font-mono text-rose-700 mt-0.5 block">{suppliersWithDebt.length}</span>
            <span className="text-[11px] text-rose-600 font-semibold">{isRTL ? 'يتطلبون تسديد مستحقات' : 'Dettes en cours'}</span>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 border border-rose-100">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        {/* Total Liabilities / Debts */}
        <div className="bg-gradient-to-br from-rose-50 to-rose-100/60 p-4 rounded-2xl border border-rose-200/80 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs font-black text-rose-800 block">{isRTL ? 'إجمالي ديون الموردين الواجب أداؤها' : 'Total Dettes Fournisseurs'}</span>
            <span className="text-2xl font-black font-mono text-rose-950 mt-0.5 block">
              {totalSupplierDebt.toFixed(2)} <span className="text-xs font-bold text-slate-600">{currency}</span>
            </span>
            <span className="text-[11px] text-rose-700 font-bold">{isRTL ? 'واجب سداده من الصندوق للموردين' : 'Engagements à payer'}</span>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-rose-200/60 text-rose-800 flex items-center justify-center shrink-0 border border-rose-300/60">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Search & Debt Status Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 sm:p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="relative w-full sm:flex-1">
          <span className={`absolute inset-y-0 ${isRTL ? 'right-3.5' : 'left-3.5'} flex items-center text-slate-400 pointer-events-none`}>
            <Search className="w-4 h-4" />
          </span>
          <input
            id="supplier-search-field"
            type="text"
            placeholder={t.supplier.search}
            className={`w-full py-2.5 ${isRTL ? 'pr-10 pl-4' : 'pl-10 pr-4'} bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition text-xs font-bold`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 w-full sm:w-auto bg-slate-100 p-1 rounded-xl text-xs font-bold shrink-0">
          <button
            type="button"
            onClick={() => setDebtFilter('all')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex-1 sm:flex-none text-center ${debtFilter === 'all' ? 'bg-white text-indigo-700 shadow-2xs font-black' : 'text-slate-600 hover:text-slate-900'}`}
          >
            {isRTL ? 'الكل' : 'Tous'} ({suppliers.length})
          </button>
          <button
            type="button"
            onClick={() => setDebtFilter('with_debt')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex-1 sm:flex-none text-center ${debtFilter === 'with_debt' ? 'bg-white text-rose-700 shadow-2xs font-black' : 'text-slate-600 hover:text-slate-900'}`}
          >
            {isRTL ? 'عليهم ديون' : 'Avec dette'} ({suppliersWithDebt.length})
          </button>
          <button
            type="button"
            onClick={() => setDebtFilter('zero_debt')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex-1 sm:flex-none text-center ${debtFilter === 'zero_debt' ? 'bg-white text-emerald-700 shadow-2xs font-black' : 'text-slate-600 hover:text-slate-900'}`}
          >
            {isRTL ? 'خالصون' : 'Soldés'} ({suppliers.length - suppliersWithDebt.length})
          </button>
        </div>
      </div>

      {/* Suppliers Bento Feed */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredSuppliers.length > 0 ? (
          filteredSuppliers.map((s) => {
            const sDebt = Number(s.debt) || 0;
            const suppPurchases = purchases.filter(p => p.supplierId === s.id);
            const totalPurch = suppPurchases.reduce((acc, p) => acc + (Number(p.total) || 0), 0);

            return (
              <div
                key={s.id}
                className="bg-white border border-slate-200/80 p-4 rounded-2xl shadow-2xs hover:shadow-md transition duration-150 flex flex-col justify-between space-y-3.5 text-start"
              >
                <div>
                  {/* Top card header */}
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0">
                      <h3 className="text-base font-black text-slate-800 leading-tight truncate">
                        {s.name}
                      </h3>
                      <div className="mt-1 text-[11px] font-black text-indigo-600 bg-indigo-50 border border-indigo-100/60 px-2 py-0.5 rounded-lg inline-flex items-center gap-1">
                        <Building2 className="w-3 h-3 shrink-0" />
                        <span className="truncate">{s.company}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        id={`supplier-edit-btn-${s.id}`}
                        onClick={() => handleStartEdit(s)}
                        className="p-1.5 hover:bg-slate-100 text-indigo-600 rounded-lg transition cursor-pointer"
                        title={t.supplier.editSupplier}
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        id={`supplier-del-btn-${s.id}`}
                        onClick={() => setDeletingSupplierId(s.id)}
                        className="p-1.5 hover:bg-rose-50 text-rose-600 rounded-lg transition cursor-pointer"
                        title={t.supplier.delete}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Contact details */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mt-3 pt-2.5 border-t border-slate-100 text-xs text-slate-600">
                    <div className="flex items-center gap-1.5 font-bold">
                      <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="font-mono">{s.phone}</span>
                    </div>
                    {s.email && (
                      <div className="flex items-center gap-1.5 font-medium truncate">
                        <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate font-mono">{s.email}</span>
                      </div>
                    )}
                  </div>

                  {/* Purchases stats summary */}
                  <div className="grid grid-cols-2 gap-2 mt-2.5 pt-2 border-t border-slate-100 text-[11px]">
                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-2">
                      <span className="text-slate-500 block">{isRTL ? 'إجمالي المشتريات:' : 'Total Achats:'}</span>
                      <span className="font-black font-mono text-slate-900 text-xs block mt-0.5">
                        {totalPurch.toFixed(2)} {currency}
                      </span>
                    </div>
                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-2">
                      <span className="text-slate-500 block">{isRTL ? 'عدد الفواتير:' : 'Nb Factures:'}</span>
                      <span className="font-black font-mono text-slate-900 text-xs block mt-0.5">
                        {suppPurchases.length} {isRTL ? 'فاتورة' : 'bills'}
                      </span>
                    </div>
                  </div>

                  {/* Debt Badge Card */}
                  <div className={`mt-2.5 p-2.5 rounded-xl border flex items-center justify-between gap-2 ${
                    sDebt > 0 
                      ? 'bg-rose-50/80 border-rose-200 text-rose-800' 
                      : 'bg-emerald-50/70 border-emerald-200 text-emerald-800'
                  }`}>
                    <div className="min-w-0">
                      <span className="text-[10px] font-bold block">
                        {sDebt > 0 ? (isRTL ? '⚠️ دين مستحق للمورد:' : 'Dette à payer:') : (isRTL ? '✅ رصيد الحساب:' : 'Statut:')}
                      </span>
                      <span className={`text-sm font-black font-mono ${sDebt > 0 ? 'text-rose-900' : 'text-emerald-900'}`}>
                        {sDebt > 0 ? `${sDebt.toFixed(2)} ${currency}` : (isRTL ? 'خالص (0.00)' : 'Soldé (0.00)')}
                      </span>
                    </div>

                    {sDebt > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setSettlingSupplierId(s.id);
                          setQuickSettleAmount(String(sDebt));
                        }}
                        className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-lg text-[11px] font-black transition cursor-pointer shadow-xs shrink-0 flex items-center gap-1"
                      >
                        <CreditCard className="w-3 h-3" />
                        <span>{isRTL ? 'تسديد' : 'Payer'}</span>
                      </button>
                    )}
                  </div>

                  {s.notes && (
                    <div className="mt-2 p-2 bg-slate-50 border border-slate-100 rounded-lg text-[11px] text-slate-500 font-medium leading-relaxed line-clamp-2">
                      {s.notes}
                    </div>
                  )}
                </div>

                {/* Bottom Actions Bar */}
                <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
                  {/* Account Statement & Activity Ledger */}
                  <button
                    type="button"
                    onClick={() => setSelectedLedgerSupplierId(s.id)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-black transition cursor-pointer shadow-xs"
                  >
                    <FileText className="w-3.5 h-3.5 text-indigo-400" />
                    <span>{isRTL ? 'كشف الحساب والنشاط' : 'Relevé de Compte'}</span>
                    <ArrowUpRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="col-span-full py-16 bg-white rounded-2xl border border-slate-100 flex flex-col items-center justify-center p-6 text-center space-y-3">
            <div className="p-4 bg-slate-50 text-slate-400 rounded-full">
              <Truck className="w-8 h-8" />
            </div>
            <p className="text-slate-500 font-bold text-sm">
              {lang === 'ar' ? 'لم يتم العثور على أي موردين مطابقين.' : 'No suppliers registered or matches found.'}
            </p>
          </div>
        )}
      </div>

      {/* Add / Edit Modal Overlay */}
      {isEditing && editingSupplier && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-lg overflow-hidden animate-fade-in text-start">
            <div className={`p-6 border-b border-slate-100 flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
              <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
                <Truck className="w-5 h-5 text-indigo-600" />
                <span>{editingSupplier.id ? t.supplier.editSupplier : t.supplier.addSupplier}</span>
              </h2>
              <button
                id="btn-close-supplier-modal"
                onClick={() => setIsEditing(false)}
                className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-lg transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSubmit} className="p-6 space-y-4">
              {/* Supplier Rep name */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">
                  {t.supplier.name} <span className="text-rose-500">*</span>
                </label>
                <input
                  id="supplier-form-name"
                  type="text"
                  required
                  placeholder={isRTL ? 'اسم المندوب أو الشخص المسؤول' : 'Nom du représentant'}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-xs font-bold"
                  value={editingSupplier.name || ''}
                  onChange={(e) => setEditingSupplier({ ...editingSupplier, name: e.target.value })}
                />
              </div>

              {/* Company & Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">
                    {t.supplier.company} <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="supplier-form-company"
                    type="text"
                    required
                    placeholder={isRTL ? 'اسم الشركة أو العلامة التجارية' : 'Nom de l\'entreprise'}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-xs font-bold"
                    value={editingSupplier.company || ''}
                    onChange={(e) => setEditingSupplier({ ...editingSupplier, company: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">
                    {t.supplier.phone} <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="supplier-form-phone"
                    type="text"
                    required
                    placeholder="06XXXXXXXX"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-xs font-bold font-mono"
                    value={editingSupplier.phone || ''}
                    onChange={(e) => setEditingSupplier({ ...editingSupplier, phone: e.target.value })}
                  />
                </div>
              </div>

              {/* Email Address & Initial Debt */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">
                    {t.supplier.email}
                  </label>
                  <input
                    id="supplier-form-email"
                    type="email"
                    placeholder="contact@company.com"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-xs font-bold font-mono"
                    value={editingSupplier.email || ''}
                    onChange={(e) => setEditingSupplier({ ...editingSupplier, email: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">
                    {isRTL ? 'الرصيد الافتتاحي للدين (إن وجد)' : 'Dette initiale'}
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-xs font-bold font-mono"
                    value={editingSupplier.debt ?? ''}
                    onChange={(e) => setEditingSupplier({ ...editingSupplier, debt: parseDecimal(e.target.value, 0) })}
                  />
                </div>
              </div>

              {/* Internal notes */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">
                  {t.supplier.notes}
                </label>
                <textarea
                  id="supplier-form-notes"
                  rows={2}
                  placeholder={isRTL ? 'أي ملاحظات إضافية، شروط التوريد، أيام الزيارة...' : 'Conditions, jours de visite...'}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-xs font-bold resize-none"
                  value={editingSupplier.notes || ''}
                  onChange={(e) => setEditingSupplier({ ...editingSupplier, notes: e.target.value })}
                />
              </div>

              {/* Action Buttons */}
              <div className={`flex items-center justify-end gap-3 pt-4 border-t border-slate-50 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <button
                  id="btn-supplier-modal-cancel"
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  {t.supplier.cancel}
                </button>
                <button
                  id="btn-supplier-modal-save"
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl transition cursor-pointer shadow-xs"
                >
                  {t.supplier.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingSupplierId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-sm overflow-hidden p-6 space-y-4 animate-fade-in text-start">
            <div className={`flex items-center gap-3 text-rose-600 pb-2 border-b border-slate-100 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <Trash2 className="w-6 h-6 shrink-0" />
              <h3 className="text-lg font-black tracking-tight text-slate-800">
                {lang === 'ar' ? 'تأكيد حذف المورّد' : 'Confirm Supplier Deletion'}
              </h3>
            </div>
            <p className="text-sm text-slate-600 font-semibold leading-relaxed">
              {lang === 'ar'
                ? `هل أنت متأكد تماماً من رغبتك في حذف المورّد "${suppliers.find(s => s.id === deletingSupplierId)?.name || ''}" ؟`
                : `Are you absolutely sure you want to delete supplier "${suppliers.find(s => s.id === deletingSupplierId)?.name || ''}" ?`}
            </p>
            <div className="bg-rose-50 text-[11px] text-rose-800 p-3 rounded-xl border border-rose-100 font-medium leading-relaxed">
              {lang === 'ar'
                ? 'تنبيه: سيتم مسح بيانات المورد نهائياً من سجلات الإتصال، لكن فواتير المشتريات السابقة ستبقى محفوظة.'
                : 'Warning: This will delete this supplier profile. Previous purchase records will be preserved.'}
            </div>
            <div className={`flex items-center justify-end gap-3 pt-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <button
                id="btn-confirm-supp-cancel"
                onClick={() => setDeletingSupplierId(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
              >
                {t.supplier.cancel}
              </button>
              <button
                id="btn-confirm-supp-delete"
                onClick={() => {
                  onDeleteSupplier(deletingSupplierId);
                  setDeletingSupplierId(null);
                }}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-xl text-xs transition cursor-pointer"
              >
                {t.supplier.delete}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Settle Payment Modal */}
      {settlingSupplierId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[220]">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-md overflow-hidden animate-fade-in p-5 space-y-4 text-start">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-black text-slate-800 text-base flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-rose-600" />
                <span>{isRTL ? 'تسجيل دفعة مسددة للمورّد' : 'Paiement Fournisseur'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setSettlingSupplierId(null)}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {(() => {
              const currentSupp = suppliers.find(s => s.id === settlingSupplierId);
              return (
                <div className="bg-rose-50 border border-rose-100 rounded-xl p-3 text-xs space-y-1">
                  <div className="flex justify-between items-center text-rose-800 font-bold">
                    <span>{isRTL ? 'المورّد:' : 'Fournisseur:'}</span>
                    <span className="font-black">{currentSupp?.name} ({currentSupp?.company})</span>
                  </div>
                  <div className="flex justify-between items-center text-rose-900 font-bold">
                    <span>{isRTL ? 'إجمالي الدين المستحق حالياً:' : 'Dette actuelle:'}</span>
                    <span className="font-mono font-black text-sm">{Number(currentSupp?.debt || 0).toFixed(2)} {currency}</span>
                  </div>
                </div>
              );
            })()}

            <form onSubmit={handleConfirmQuickSettle} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {isRTL ? 'المبلغ المسدد نقداً:' : 'Montant:'} <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="decimal"
                    required
                    value={quickSettleAmount}
                    onChange={(e) => setQuickSettleAmount(sanitizeDecimalInput(e.target.value))}
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
                  {isRTL ? 'ملاحظات / طريقة التسديد:' : 'Notes / Mode:'}
                </label>
                <input
                  type="text"
                  value={quickSettleNotes}
                  onChange={(e) => setQuickSettleNotes(e.target.value)}
                  placeholder={isRTL ? 'تسديد نقدي، شيك بنكي، تحويل...' : 'Espèces, Chèque, Virement...'}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSettlingSupplierId(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  {isRTL ? 'إلغاء' : 'Annuler'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-xl text-xs font-black transition cursor-pointer shadow-xs"
                >
                  {isRTL ? 'تأكيد تسجيل الدفعة' : 'Confirmer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
