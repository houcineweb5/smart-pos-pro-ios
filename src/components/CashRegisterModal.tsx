/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Invoice, StoreConfig, Language, Expense, Employee, CashMovement } from '../types';
import { 
  Lock, Printer, X, DollarSign, Calculator, AlertTriangle, 
  CheckCircle2, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight,
  Calendar, Clock, User, FileDown, ArrowRight, PlusCircle
} from 'lucide-react';
import { parseDecimal, sanitizeDecimalInput } from '../utils/numberInput';
import { printHtmlContent, exportStructuredPdf } from '../utils/printService';

interface CashRegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoices: Invoice[];
  expenses?: Expense[];
  config: StoreConfig;
  currentUser?: Employee | null;
  lang: Language;
}

export default function CashRegisterModal({
  isOpen,
  onClose,
  invoices,
  expenses = [],
  config,
  currentUser,
  lang
}: CashRegisterModalProps) {
  if (!isOpen) return null;

  const isRTL = lang === 'ar';
  const now = new Date();

  // State
  const todayKey = now.toISOString().slice(0, 10);
  const [openingBalance, setOpeningBalance] = useState<string>('0');
  const [actualCash, setActualCash] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // Cash In / Cash Out Movements
  const [cashMovements, setCashMovements] = useState<CashMovement[]>(() => {
    try {
      const saved = localStorage.getItem(`pos_cash_movements_${todayKey}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [movementType, setMovementType] = useState<'in' | 'out'>('in');
  const [movementAmount, setMovementAmount] = useState<string>('');
  const [movementReason, setMovementReason] = useState<string>('');
  const [showMovementForm, setShowMovementForm] = useState(false);

  const handleAddMovement = () => {
    const amt = parseDecimal(movementAmount);
    if (amt <= 0 || !movementReason.trim()) {
      alert(lang === 'ar' ? 'يرجى إدخال المبلغ وسبب الحركة النقدية!' : 'Please enter amount and reason!');
      return;
    }
    const newMv: CashMovement = {
      id: 'cm_' + Date.now(),
      type: movementType,
      amount: amt,
      reason: movementReason.trim(),
      date: new Date().toISOString(),
      performedBy: currentUser?.name || 'Cashier'
    };
    const updated = [...cashMovements, newMv];
    setCashMovements(updated);
    localStorage.setItem(`pos_cash_movements_${todayKey}`, JSON.stringify(updated));
    setMovementAmount('');
    setMovementReason('');
    setShowMovementForm(false);
  };

  const handleDeleteMovement = (id: string) => {
    const updated = cashMovements.filter((m) => m.id !== id);
    setCashMovements(updated);
    localStorage.setItem(`pos_cash_movements_${todayKey}`, JSON.stringify(updated));
  };

  // Filter today's transactions
  const todayInvoices = invoices.filter((inv) => {
    const invDate = new Date(inv.date);
    return invDate.toDateString() === now.toDateString();
  });

  // Today's cash receipts
  const cashSales = todayInvoices
    .filter((inv) => inv.paymentMethod === 'cash')
    .reduce((sum, inv) => sum + inv.amountPaid, 0);

  const cardSales = todayInvoices
    .filter((inv) => inv.paymentMethod === 'card')
    .reduce((sum, inv) => sum + inv.amountPaid, 0);

  const debtSales = todayInvoices
    .filter((inv) => inv.paymentMethod === 'debt' || inv.total > inv.amountPaid)
    .reduce((sum, inv) => sum + (inv.total - inv.amountPaid), 0);

  const totalSalesToday = todayInvoices.reduce((sum, inv) => sum + inv.total, 0);

  // Today's expenses
  const todayExpenses = expenses.filter((e) => {
    const expDate = new Date(e.date);
    return expDate.toDateString() === now.toDateString();
  });
  const totalCashExpensesToday = todayExpenses.reduce((sum, e) => sum + e.amount, 0);

  // Cash In / Out totals
  const totalCashIn = cashMovements.filter((m) => m.type === 'in').reduce((s, m) => s + m.amount, 0);
  const totalCashOut = cashMovements.filter((m) => m.type === 'out').reduce((s, m) => s + m.amount, 0);

  // Mathematics
  const openingVal = parseDecimal(openingBalance, 0);
  const actualVal = actualCash.trim() !== '' ? parseDecimal(actualCash, 0) : null;
  const expectedCash = openingVal + cashSales + totalCashIn - totalCashExpensesToday - totalCashOut;
  const difference = actualVal !== null ? actualVal - expectedCash : null;

  const buildZReportPdfMeta = () => ({
    title: lang === 'ar' ? 'تقرير إغلاق الصندوق (Z-Report)' : 'Rapport Z de Caisse',
    docNumber: `Z-${now.toISOString().slice(0, 10)}`,
    date: `${now.toLocaleDateString('fr-FR')} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
    storeName: config.name || 'المتجر',
    storePhone: config.phone,
    storeAddress: config.address,
    customerLabel: lang === 'ar' ? 'المسؤول' : 'Caissier',
    customerName: currentUser?.name || 'Administrator',
    currency: config.currency,
    mode: '80mm' as const,
    isRTL,
    items: [
      { name: lang === 'ar' ? 'رصيد بداية اليوم (+)' : 'Fond de caisse (+)', quantity: 1, unitPrice: openingVal, total: openingVal },
      { name: lang === 'ar' ? 'مبيعات نقدية (+)' : 'Ventes Espèces (+)', quantity: todayInvoices.filter(i => i.paymentMethod === 'cash').length, unitPrice: cashSales, total: cashSales },
      ...(totalCashIn > 0 ? [{ name: lang === 'ar' ? 'إيداع سيولة إضافية (+)' : 'Cash In (+)', quantity: cashMovements.filter(m => m.type === 'in').length, unitPrice: totalCashIn, total: totalCashIn }] : []),
      { name: lang === 'ar' ? 'مبيعات بطاقة (•)' : 'Ventes Carte (•)', quantity: todayInvoices.filter(i => i.paymentMethod === 'card').length, unitPrice: cardSales, total: cardSales },
      { name: lang === 'ar' ? 'ديون مؤجلة (•)' : 'Ventes Crédit (•)', quantity: todayInvoices.filter(i => i.paymentMethod === 'debt' || i.total > i.amountPaid).length, unitPrice: debtSales, total: debtSales },
      { name: lang === 'ar' ? 'مصاريف الصندوق (-)' : 'Dépenses (-)', quantity: todayExpenses.length, unitPrice: totalCashExpensesToday, total: -totalCashExpensesToday },
      ...(totalCashOut > 0 ? [{ name: lang === 'ar' ? 'سحب سيولة من الدرج (-)' : 'Cash Out (-)', quantity: cashMovements.filter(m => m.type === 'out').length, unitPrice: totalCashOut, total: -totalCashOut }] : []),
    ],
    subtotal: expectedCash,
    total: expectedCash,
    amountPaid: actualVal !== null ? actualVal : expectedCash,
    notes: notes || undefined,
    footerText: 'APEX SALES & INVOICING SYSTEM'
  });

  const handleExportZReportPdf = async () => {
    await exportStructuredPdf(buildZReportPdfMeta());
  };

  // Print Thermal 80mm Z-Report
  const handlePrintZReport = () => {
    const html = `
      <div style="font-family: monospace, sans-serif; width: 72mm; margin: 0 auto; color: #000; font-size: 11px; line-height: 1.4; direction: ${isRTL ? 'rtl' : 'ltr'};">
        <div style="text-align: center;">
          <div style="font-size: 14px; font-weight: 900; margin-bottom: 2px;">${config.name}</div>
          <div>${config.address || ''}</div>
          <div>TEL: ${config.phone || ''}</div>
          <div style="border-top: 1.5px solid #000; margin: 6px 0;"></div>
          <div style="font-weight: bold; font-size: 13px;">=== RAPPORT Z / تقرير إغلاق الصندوق ===</div>
          <div>${now.toLocaleDateString()} - ${now.toLocaleTimeString()}</div>
          <div>المسؤول / Caissier: ${currentUser?.name || 'Administrator'}</div>
        </div>
        <div style="border-top: 1.5px solid #000; margin: 6px 0;"></div>
        <div style="display: flex; justify-content: space-between; margin: 2px 0;">
          <span>عدد المبيعات / Nb Ventes:</span>
          <b>${todayInvoices.length}</b>
        </div>
        <div style="display: flex; justify-content: space-between; margin: 2px 0;">
          <span>إجمالي المبيعات / Total Ventes:</span>
          <b>${totalSalesToday.toFixed(2)} ${config.currency}</b>
        </div>
        <div style="border-top: 1.5px solid #000; margin: 6px 0;"></div>
        <div style="display: flex; justify-content: space-between; margin: 2px 0;">
          <span>(+) رصيد البداية:</span>
          <span>${openingVal.toFixed(2)} ${config.currency}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin: 2px 0;">
          <span>(+) مبيعات نقدية:</span>
          <b>${cashSales.toFixed(2)} ${config.currency}</b>
        </div>
        <div style="display: flex; justify-content: space-between; margin: 2px 0;">
          <span>(-) مصاريف الصندوق:</span>
          <span>-${totalCashExpensesToday.toFixed(2)} ${config.currency}</span>
        </div>
        <div style="border-top: 1.5px solid #000; margin: 6px 0;"></div>
        <div style="display: flex; justify-content: space-between; font-size: 12px; font-weight: 900;">
          <span>المتوقع في الصندوق:</span>
          <span>${expectedCash.toFixed(2)} ${config.currency}</span>
        </div>
        ${actualVal !== null ? `
          <div style="display: flex; justify-content: space-between; font-size: 12px; font-weight: 900;">
            <span>الفعلي في الدرج:</span>
            <span>${actualVal.toFixed(2)} ${config.currency}</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 12px; font-weight: 900; margin-top: 4px;">
            <span>الفارق:</span>
            <span>${(difference || 0) > 0 ? '+' : ''}${(difference || 0).toFixed(2)} ${config.currency}</span>
          </div>
        ` : ''}
        ${notes ? `<div style="border-top: 1.5px solid #000; margin: 6px 0;"></div><div><b>ملاحظات:</b> ${notes}</div>` : ''}
      </div>
    `;
    printHtmlContent({
      title: `Z-Report - ${now.toLocaleDateString()}`,
      html,
      isRTL,
      mode: '80mm'
    });
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 z-50 animate-fade-in safe-modal-overlay">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-lg overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black">
                {lang === 'ar' ? 'إغلاق وتصفية الصندوق اليومي (Clôture de Caisse)' : 'Daily Cash Register Closing (Z-Report)'}
              </h2>
              <p className="text-[11px] text-slate-400 font-medium">
                {now.toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-start">
          {/* Cashier Info Strip */}
          <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200/60 text-xs">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-indigo-600" />
              <span className="text-slate-500 font-bold">{lang === 'ar' ? 'المسؤول الحالي:' : 'Cashier:'}</span>
              <span className="font-black text-slate-900">{currentUser?.name || 'Administrator'}</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-500 font-mono font-bold">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>{now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          </div>

          {/* Cash breakdown grid */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            {/* Cash Sales */}
            <div className="bg-emerald-50/60 border border-emerald-200/70 p-3.5 rounded-xl">
              <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block mb-1">
                {lang === 'ar' ? '(+) مبيعات الكاش اليوم' : 'Cash Sales Today'}
              </span>
              <span className="text-lg font-black text-emerald-800 font-mono block">
                {cashSales.toFixed(2)} <span className="text-xs font-bold text-emerald-600">{config.currency}</span>
              </span>
              <span className="text-[10px] text-emerald-600 font-medium mt-1 block">
                {todayInvoices.filter(i => i.paymentMethod === 'cash').length} {lang === 'ar' ? 'عملية كاش' : 'cash sales'}
              </span>
            </div>

            {/* Cash Expenses */}
            <div className="bg-rose-50/60 border border-rose-200/70 p-3.5 rounded-xl">
              <span className="text-[10px] font-bold text-rose-700 uppercase tracking-wider block mb-1">
                {lang === 'ar' ? '(-) مصاريف الصندوق اليوم' : 'Cash Expenses Today'}
              </span>
              <span className="text-lg font-black text-rose-800 font-mono block">
                -{totalCashExpensesToday.toFixed(2)} <span className="text-xs font-bold text-rose-600">{config.currency}</span>
              </span>
              <span className="text-[10px] text-rose-600 font-medium mt-1 block">
                {todayExpenses.length} {lang === 'ar' ? 'مصاريف مسجلة' : 'expenses'}
              </span>
            </div>
          </div>

          {/* Opening balance & Actual cash Inputs */}
          <div className="space-y-4 pt-1">
            {/* Quick Cash In / Cash Out Section */}
            <div className="bg-slate-50 border border-slate-200/80 p-3.5 rounded-xl space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black text-slate-700 flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-indigo-600" />
                  <span>{lang === 'ar' ? 'حركات الصندوق السريعة (إيداع / سحب سيولة)' : 'Quick Cash In / Cash Out'}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setShowMovementForm((prev) => !prev)}
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>{showMovementForm ? (lang === 'ar' ? 'إغلاق' : 'Close') : (lang === 'ar' ? 'تسجيل حركة' : 'Add')}</span>
                </button>
              </div>

              {showMovementForm && (
                <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-2 animate-fade-in">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setMovementType('in')}
                      className={`flex-1 py-1.5 text-xs font-bold rounded-md transition ${movementType === 'in' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700'}`}
                    >
                      {lang === 'ar' ? '+ إيداع سيولة (Cash In)' : '+ Cash In'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setMovementType('out')}
                      className={`flex-1 py-1.5 text-xs font-bold rounded-md transition ${movementType === 'out' ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-700'}`}
                    >
                      {lang === 'ar' ? '- سحب سيولة (Cash Out)' : '- Cash Out'}
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder={lang === 'ar' ? 'المبلغ' : 'Amount'}
                      value={movementAmount}
                      onChange={(e) => setMovementAmount(sanitizeDecimalInput(e.target.value))}
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-md text-xs font-bold font-mono"
                    />
                    <input
                      type="text"
                      placeholder={lang === 'ar' ? 'السبب (مثال: صرف صباحي، نقل...)' : 'Reason'}
                      value={movementReason}
                      onChange={(e) => setMovementReason(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-md text-xs font-medium"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAddMovement}
                    className="w-full py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-md transition cursor-pointer"
                  >
                    {lang === 'ar' ? 'تأكيد وحفظ الحركة' : 'Save Movement'}
                  </button>
                </div>
              )}

              {cashMovements.length > 0 && (
                <div className="space-y-1.5 max-h-28 overflow-y-auto">
                  {cashMovements.map((m) => (
                    <div key={m.id} className="flex items-center justify-between text-xs p-1.5 bg-white border border-slate-200/60 rounded-md">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[10px] font-black px-1 rounded ${m.type === 'in' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                          {m.type === 'in' ? '+' : '-'}
                        </span>
                        <span className="font-bold text-slate-800">{m.reason}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`font-mono font-black ${m.type === 'in' ? 'text-emerald-700' : 'text-rose-700'}`}>
                          {m.type === 'in' ? '+' : '-'}{m.amount.toFixed(2)} {config.currency}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteMovement(m.id)}
                          className="text-slate-400 hover:text-rose-600 font-black cursor-pointer text-xs"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Opening Cash Input */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                {lang === 'ar' ? `رصيد بداية اليوم في الدرج (Fond de caisse) - ${config.currency}` : `Opening Cash (Fond de caisse) - ${config.currency}`}
              </label>
              <div className="relative">
                <span className={`absolute inset-y-0 ${isRTL ? 'right-3' : 'left-3'} flex items-center text-slate-400 font-bold`}>
                  {config.currency}
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={openingBalance}
                  onChange={(e) => setOpeningBalance(sanitizeDecimalInput(e.target.value))}
                  placeholder="0.00"
                  className={`w-full ${isRTL ? 'pr-12 pl-3' : 'pl-12 pr-3'} py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-black font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                />
              </div>
            </div>

            {/* Expected Cash in Register (Calculated) */}
            <div className="bg-slate-900 text-white p-4 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  {lang === 'ar' ? 'المبلغ المتوقع نظرياً في الدرج' : 'Theoretical Expected Cash'}
                </span>
                <span className="text-xs text-slate-400 font-medium">
                  {lang === 'ar' ? 'رصيد الافتتاح + مبيعات الكاش - المصاريف' : 'Opening + Cash Sales - Expenses'}
                </span>
              </div>
              <div className="text-end">
                <span className="text-xl font-black font-mono text-emerald-400">
                  {expectedCash.toFixed(2)}
                </span>
                <span className="text-xs text-slate-400 font-bold ml-1 rtl:ml-0 rtl:mr-1 uppercase">
                  {config.currency}
                </span>
              </div>
            </div>

            {/* Actual Cash Counted */}
            <div>
              <label className="block text-[11px] font-bold text-slate-800 uppercase tracking-wider mb-1">
                {lang === 'ar' ? `المبلغ الفعلي المحسوب في الدرج * (${config.currency})` : `Actual Cash Counted in Drawer * (${config.currency})`}
              </label>
              <div className="relative">
                <span className={`absolute inset-y-0 ${isRTL ? 'right-3' : 'left-3'} flex items-center text-indigo-600 font-black`}>
                  {config.currency}
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={actualCash}
                  onChange={(e) => setActualCash(sanitizeDecimalInput(e.target.value))}
                  placeholder={expectedCash.toFixed(2)}
                  className={`w-full ${isRTL ? 'pr-12 pl-3' : 'pl-12 pr-3'} py-3 border-2 border-indigo-500/40 rounded-xl text-base font-black font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white shadow-xs`}
                />
              </div>
            </div>

            {/* Difference / Ecart Result Banner */}
            {difference !== null && (
              <div className={`p-4 rounded-xl border flex items-center justify-between text-xs animate-fade-in ${
                Math.abs(difference) < 0.01
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : difference > 0
                  ? 'bg-blue-50 border-blue-200 text-blue-800'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}>
                <div className="flex items-center gap-2">
                  {Math.abs(difference) < 0.01 ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
                  )}
                  <div>
                    <span className="font-black block">
                      {Math.abs(difference) < 0.01
                        ? (lang === 'ar' ? 'الصندوق متطابق تماماً بدون أي فارق! 🎉' : 'Register is perfectly balanced! 🎉')
                        : difference > 0
                        ? (lang === 'ar' ? 'فائض وزيادة في الصندوق (Excédent)' : 'Cash Surplus (Excédent)')
                        : (lang === 'ar' ? 'عجز ونقص في الصندوق (Déficit)' : 'Cash Shortage (Déficit)')}
                    </span>
                    <span className="text-[10px] opacity-80 font-medium">
                      {lang === 'ar' ? 'الفارق = الفعلي - المتوقع' : 'Difference = Actual - Expected'}
                    </span>
                  </div>
                </div>

                <div className="text-end">
                  <span className="text-lg font-black font-mono">
                    {difference > 0 ? '+' : ''}{difference.toFixed(2)} {config.currency}
                  </span>
                </div>
              </div>
            )}

            {/* Notes */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                {lang === 'ar' ? 'ملاحظات الإغلاق (اختياري)' : 'Closing Notes (Optional)'}
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={lang === 'ar' ? 'توضيح سبب الفارق أو تسليم الكاش للمسؤول...' : 'Notes or remarks on cash balance...'}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap justify-between items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-black text-slate-800 hover:bg-slate-100 transition cursor-pointer flex items-center gap-1.5"
          >
            <ArrowRight className={`w-4 h-4 ${isRTL ? '' : 'rotate-180'}`} />
            <span>{lang === 'ar' ? 'رجوع' : 'Back'}</span>
          </button>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleExportZReportPdf}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black shadow-xs transition active:scale-95 cursor-pointer"
            >
              <FileDown className="w-4 h-4" />
              <span>PDF</span>
            </button>
            <button
              type="button"
              onClick={handlePrintZReport}
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-black shadow-md transition active:scale-95 cursor-pointer"
            >
              <Printer className="w-4 h-4 text-emerald-400" />
              <span>{lang === 'ar' ? 'طباعة تقرير Z (80mm)' : 'Print Z-Report (80mm)'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
