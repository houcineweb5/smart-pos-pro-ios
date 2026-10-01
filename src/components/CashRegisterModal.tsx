/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Invoice, StoreConfig, Language, Expense, Employee } from '../types';
import { 
  Lock, Printer, X, DollarSign, Calculator, AlertTriangle, 
  CheckCircle2, TrendingUp, TrendingDown, ArrowUpRight, 
  Calendar, Clock, User
} from 'lucide-react';
import { parseDecimal, sanitizeDecimalInput } from '../utils/numberInput';

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
  const [openingBalance, setOpeningBalance] = useState<string>('0');
  const [actualCash, setActualCash] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

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

  // Mathematics
  const openingVal = parseDecimal(openingBalance, 0);
  const actualVal = actualCash.trim() !== '' ? parseDecimal(actualCash, 0) : null;
  const expectedCash = openingVal + cashSales - totalCashExpensesToday;
  const difference = actualVal !== null ? actualVal - expectedCash : null;

  // Print Thermal 80mm Z-Report
  const handlePrintZReport = () => {
    const printWindow = window.open('', '_blank', 'width=400,height=700');
    if (!printWindow) return;

    const html = `
      <!DOCTYPE html>
      <html dir="${isRTL ? 'rtl' : 'ltr'}">
      <head>
        <meta charset="utf-8">
        <title>Z-Report - ${now.toLocaleDateString()}</title>
        <style>
          @page { size: 80mm auto; margin: 4mm; }
          body {
            font-family: monospace, sans-serif;
            width: 72mm;
            margin: 0 auto;
            color: #000;
            font-size: 11px;
            line-height: 1.4;
          }
          .text-center { text-align: center; }
          .text-end { text-align: ${isRTL ? 'left' : 'right'}; }
          .text-start { text-align: ${isRTL ? 'right' : 'left'}; }
          .bold { font-weight: bold; }
          .title { font-size: 14px; font-weight: 900; margin-bottom: 2px; }
          .divider { border-top: 1px dashed #000; margin: 6px 0; }
          .double-divider { border-top: 2px solid #000; margin: 8px 0; }
          .row { display: flex; justify-content: space-between; margin: 2px 0; }
          .highlight { font-size: 12px; font-weight: 900; }
          .badge { border: 1px solid #000; padding: 2px 4px; display: inline-block; margin-top: 4px; }
        </style>
      </head>
      <body>
        <div class="text-center">
          <div class="title">${config.name}</div>
          <div>${config.address || ''}</div>
          <div>TEL: ${config.phone || ''}</div>
          <div class="divider"></div>
          <div class="bold" style="font-size: 13px;">=== RAPPORT Z / تقرير إغلاق الصندوق ===</div>
          <div>${now.toLocaleDateString()} - ${now.toLocaleTimeString()}</div>
          <div>المسؤول / Caissier: ${currentUser?.name || 'Administrator'}</div>
        </div>

        <div class="divider"></div>

        <div class="row">
          <span>عدد المبيعات / Nb Ventes:</span>
          <span class="bold">${todayInvoices.length}</span>
        </div>
        <div class="row">
          <span>إجمالي المبيعات / Total Ventes:</span>
          <span class="bold">${totalSalesToday.toFixed(2)} ${config.currency}</span>
        </div>

        <div class="divider"></div>

        <div class="bold" style="margin-bottom: 4px;">تفاصيل المداخيل / Encaissements:</div>
        <div class="row">
          <span>(+) رصيد البداية / Fond de caisse:</span>
          <span>${openingVal.toFixed(2)} ${config.currency}</span>
        </div>
        <div class="row">
          <span>(+) مبيعات نقدية / Ventes Espèces:</span>
          <span class="bold">${cashSales.toFixed(2)} ${config.currency}</span>
        </div>
        <div class="row">
          <span>(•) مبيعات بنكية / Ventes Carte:</span>
          <span>${cardSales.toFixed(2)} ${config.currency}</span>
        </div>
        <div class="row">
          <span>(•) ديون مؤجلة / Ventes Crédit:</span>
          <span>${debtSales.toFixed(2)} ${config.currency}</span>
        </div>
        <div class="row">
          <span>(-) مصاريف الصندوق / Dépenses:</span>
          <span>-${totalCashExpensesToday.toFixed(2)} ${config.currency}</span>
        </div>

        <div class="divider"></div>

        <div class="row highlight">
          <span>المتوقع في الصندوق / Espèces Théorique:</span>
          <span>${expectedCash.toFixed(2)} ${config.currency}</span>
        </div>

        ${actualVal !== null ? `
          <div class="row highlight">
            <span>الفعلي في الدرج / Espèces Réel:</span>
            <span>${actualVal.toFixed(2)} ${config.currency}</span>
          </div>
          <div class="row highlight" style="margin-top: 4px;">
            <span>الفارق / Écart de caisse:</span>
            <span>${(difference || 0) > 0 ? '+' : ''}${(difference || 0).toFixed(2)} ${config.currency}</span>
          </div>
          <div class="text-center">
            <span class="badge">
              ${(difference || 0) === 0 ? 'صندوق مطابق تماماً / Conforme' : (difference || 0) > 0 ? 'فائض نقدي / Excédent' : 'عجز في الصندوق / Déficit'}
            </span>
          </div>
        ` : ''}

        ${notes ? `
          <div class="divider"></div>
          <div><b>ملاحظات:</b> ${notes}</div>
        ` : ''}

        <div class="double-divider"></div>
        <div class="text-center" style="margin-top: 15px;">
          <div>توقيع المسؤول / Signature du caissier</div>
          <div style="height: 35px;"></div>
          <div>_____________________</div>
        </div>
        <div class="text-center" style="margin-top: 10px; font-size: 9px;">
          APEX SALES & INVOICING SYSTEM
        </div>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 400);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
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
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
          >
            {lang === 'ar' ? 'إلغاء' : 'Cancel'}
          </button>

          <button
            type="button"
            onClick={handlePrintZReport}
            className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-black shadow-md transition active:scale-95 cursor-pointer"
          >
            <Printer className="w-4 h-4 text-emerald-400" />
            <span>{lang === 'ar' ? 'طباعة تقرير Z للإغلاق (80mm)' : 'Print Z-Report (80mm)'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
