/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Customer, Invoice, Language, StoreConfig, ActivityLog } from '../types';
import { languages } from '../languages';
import { UserPlus, Search, Phone, Mail, DollarSign, Edit3, Trash2, X, Receipt, CheckCircle, MessageCircle } from 'lucide-react';
import CustomerLedger from './CustomerLedger';
import { parseDecimal, sanitizeDecimalInput } from '../utils/numberInput';

interface CustomersProps {
  customers: Customer[];
  invoices: Invoice[];
  onSaveCustomer: (customer: Customer) => void;
  onDeleteCustomer: (id: string) => void;
  onSettleDebt: (customerId: string, amount: number) => void;
  lang: Language;
  config: StoreConfig;
  logs: ActivityLog[];
}

export default function Customers({ customers, invoices, onSaveCustomer, onDeleteCustomer, onSettleDebt, lang, config, logs }: CustomersProps) {
  const t = languages[lang];
  const isRTL = t.direction === 'rtl';

  const [search, setSearch] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Partial<Customer> | null>(null);

  // Debt settlement states
  const [settlingCustId, setSettlingCustId] = useState<string | null>(null);
  const [settlingAmount, setSettlingAmount] = useState<number>(0);
  
  // Custom delete state
  const [deletingCustomerId, setDeletingCustomerId] = useState<string | null>(null);

  // Selected ledger state
  const [selectedLedgerCustomerId, setSelectedLedgerCustomerId] = useState<string | null>(null);

  // Filtered list
  const filteredCustomers = customers.filter((c) => {
    const s = search.toLowerCase();
    return c.name.toLowerCase().includes(s) || c.phone.includes(s) || (c.email && c.email.toLowerCase().includes(s));
  });

  const handleStartAdd = () => {
    setEditingCustomer({
      id: '',
      name: '',
      phone: '',
      email: '',
      debt: 0,
      notes: '',
    });
    setIsEditing(true);
  };

  const handleStartEdit = (c: Customer) => {
    setEditingCustomer({ ...c });
    setIsEditing(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCustomer) return;

    if (!editingCustomer.name || (!editingCustomer.phone && editingCustomer.id !== 'walk-in')) {
      alert(t.common.requiredFields);
      return;
    }

    const customerToSave: Customer = {
      id: editingCustomer.id || 'cust_' + Date.now(),
      name: editingCustomer.name,
      phone: editingCustomer.phone,
      email: editingCustomer.email || '',
      debt: parseDecimal(editingCustomer.debt),
      notes: editingCustomer.notes || '',
      createdAt: editingCustomer.createdAt || new Date().toISOString(),
    };

    onSaveCustomer(customerToSave);
    setIsEditing(false);
    setEditingCustomer(null);
  };

  const handleDebtSettleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedSettling = parseDecimal(settlingAmount);
    if (!settlingCustId || parsedSettling <= 0) return;

    onSettleDebt(settlingCustId, parsedSettling);
    setSettlingCustId(null);
    setSettlingAmount(0);
  };

  // Get matching invoices
  const getCustomerInvoices = (customerId: string) => {
    return invoices.filter((inv) => inv.customerId === customerId);
  };

  const selectedLedgerCustomer = customers.find((c) => c.id === selectedLedgerCustomerId);

  if (selectedLedgerCustomer) {
    return (
      <CustomerLedger
        customer={selectedLedgerCustomer}
        invoices={invoices}
        logs={logs}
        config={config}
        lang={lang}
        onClose={() => setSelectedLedgerCustomerId(null)}
      />
    );
  }

  return (
    <div className="space-y-6" id="customers-sec">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <UserPlus className="w-6 h-6 text-indigo-600" />
            {t.customer.title}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage your client directory, debts, and ledger balances in one screen.
          </p>
        </div>
        <button
          id="btn-add-cust"
          onClick={handleStartAdd}
          className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl transition duration-200 shadow-sm"
        >
          <UserPlus className="w-5 h-5" />
          {t.customer.addCustomer}
        </button>
      </div>

      {/* Controls */}
      <div className="relative">
        <span className={`absolute inset-y-0 ${isRTL ? 'right-4' : 'left-4'} flex items-center text-slate-400`}>
          <Search className="w-5 h-5" />
        </span>
        <input
          id="cust-search-input"
          type="text"
          placeholder={t.customer.search}
          className={`w-full py-3 ${isRTL ? 'pr-12 pl-4' : 'pl-12 pr-4'} bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition duration-150 shadow-xs`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Customers List Board */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredCustomers.length > 0 ? (
          filteredCustomers.map((c) => {
            const clientInvoices = getCustomerInvoices(c.id);
            const unpaidCount = clientInvoices.filter((inv) => inv.status !== 'paid').length;

            return (
              <div
                key={c.id}
                className="bg-white border border-slate-200/80 p-4 rounded-xl shadow-2xs hover:shadow-sm transition duration-150 flex flex-col justify-between space-y-3"
              >
                <div>
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-black text-slate-800">{c.name}</h3>
                        {(c.id === 'walk-in' || c.name === 'زبون عابر') && (
                          <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[10px] font-bold rounded-md border border-indigo-100">
                            {lang === 'ar' ? 'الزبون الافتراضي' : 'Default'}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2 sm:gap-3 mt-1 mb-2 text-xs text-slate-500 font-medium">
                        {c.phone && (
                          <span className="flex items-center gap-1 font-semibold">
                            <Phone className="w-3.5 h-3.5 text-slate-400" />
                            {c.phone}
                          </span>
                        )}
                        {c.email && (
                          <span className="flex items-center gap-1">
                            <Mail className="w-3.5 h-3.5 text-slate-400" />
                            {c.email}
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Action buttons */}
                    <div className="flex items-center gap-1">
                      <button
                        id={`cust-edit-${c.id}`}
                        onClick={() => handleStartEdit(c)}
                        className="p-1 hover:bg-slate-100 text-indigo-600 rounded-lg transition cursor-pointer"
                        title={t.customer.editCustomer}
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      {c.id !== 'walk-in' && c.name !== 'زبون عابر' && (
                        <button
                          id={`cust-del-${c.id}`}
                          onClick={() => {
                            setDeletingCustomerId(c.id);
                          }}
                          className="p-1 hover:bg-rose-50 text-rose-600 rounded-lg transition cursor-pointer"
                          title={t.customer.delete}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {c.notes && (
                    <div className="bg-slate-50 p-2 rounded-lg text-[11px] text-slate-500 border border-slate-100 line-clamp-2">
                      {c.notes}
                    </div>
                  )}
                </div>

                {/* Financial Ledger Section */}
                <div className="border-t border-slate-100 pt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex items-center gap-3">
                    <div className="text-start">
                      <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">
                        {t.customer.debt}
                      </span>
                      <span className={`text-base font-black ${c.debt > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {c.debt.toFixed(2)} {config.currency}
                      </span>
                    </div>

                    <div className="h-6 w-px bg-slate-200"></div>

                    <div className="text-start">
                      <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">
                        Transactions
                      </span>
                      <span className="text-xs font-bold text-slate-700">
                        {clientInvoices.length} bill ({unpaidCount} due)
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* Settle Debt Button */}
                    {c.debt > 0 && (
                      <>
                        <button
                          id={`settle-btn-${c.id}`}
                          onClick={() => {
                            setSettlingCustId(c.id);
                            setSettlingAmount(c.debt);
                          }}
                          className="px-3 py-1.5 text-xs font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg transition duration-150 flex items-center gap-1 shadow-2xs border border-emerald-200 cursor-pointer"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          {t.customer.payDebt}
                        </button>
                        <button
                          id={`wa-debt-btn-${c.id}`}
                          onClick={() => {
                            let cleanPhone = c.phone.replace(/[^0-9]/g, '');
                            if (cleanPhone.startsWith('06') || cleanPhone.startsWith('07')) {
                              cleanPhone = '212' + cleanPhone.slice(1);
                            }
                            const msg = lang === 'ar'
                              ? `السلام عليكم ${c.name}،\nنود تذكيركم بمجموع الحساب المعلق بذمتكم لدى ${config.name}:\nالمبلغ المستحق: ${c.debt.toFixed(2)} ${config.currency}\nشكراً لتفهمكم وتعاملكم معنا.`
                              : `Bonjour ${c.name},\nNous vous rappelons le solde restant dû auprès de ${config.name}:\nMontant dû: ${c.debt.toFixed(2)} ${config.currency}\nMerci de votre confiance.`;
                            const url = cleanPhone ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}` : `https://wa.me/?text=${encodeURIComponent(msg)}`;
                            window.open(url, '_blank');
                          }}
                          className="px-3.5 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition duration-150 flex items-center gap-1.5 shadow-xs cursor-pointer"
                          title={lang === 'ar' ? 'إرسال تذكير بالدين عبر الواتساب' : 'Send WhatsApp Debt Reminder'}
                        >
                          <MessageCircle className="w-4 h-4" />
                          <span>{lang === 'ar' ? 'تذكير واتساب' : 'WhatsApp'}</span>
                        </button>
                      </>
                    )}

                    {/* View Ledger Button */}
                    <button
                      id={`ledger-btn-${c.id}`}
                      onClick={() => setSelectedLedgerCustomerId(c.id)}
                      className="px-4 py-2 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition duration-150 flex items-center gap-1.5 shadow-sm border border-slate-200 self-start cursor-pointer"
                    >
                      <Receipt className="w-4 h-4 text-slate-500" />
                      {isRTL ? 'كشف الحساب والنشاط' : 'Account Ledger'}
                    </button>
                  </div>
                </div>

                {/* Mini Invoice History list */}
                {clientInvoices.length > 0 && (
                  <div className="bg-slate-50/55 rounded-xl p-3 border border-slate-50">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-2">
                      {t.customer.recentInvoices}
                    </span>
                    <div className="space-y-1.5 max-h-[110px] overflow-y-auto no-scrollbar">
                      {clientInvoices.slice(0, 3).map((inv) => (
                        <div key={inv.id} className="flex justify-between items-center text-xs">
                          <span className="font-mono text-slate-600 font-semibold">{inv.invoiceNumber}</span>
                          <span className="text-slate-500">{new Date(inv.date).toLocaleDateString()}</span>
                          <span
                            className={`font-semibold ${
                              inv.status === 'paid'
                                ? 'text-emerald-600'
                                : inv.status === 'partial'
                                ? 'text-amber-500'
                                : 'text-red-500'
                            }`}
                          >
                            ${inv.total.toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="col-span-full text-center py-16 bg-white border border-slate-100 rounded-2xl">
            <Search className="w-12 h-12 stroke-[1.2] mx-auto text-slate-300 mb-3" />
            <p className="text-slate-500 font-medium">No clients found matching query.</p>
          </div>
        )}
      </div>

      {/* Editor Modal */}
      {isEditing && editingCustomer && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto" id="edit-customer-modal">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-md overflow-hidden animate-fade-in my-8">
            <div className="flex justify-between items-center bg-slate-50 px-6 py-4 border-b border-slate-100">
              <h2 className="font-bold text-slate-800 text-lg">
                {editingCustomer.id ? t.customer.editCustomer : t.customer.addCustomer}
              </h2>
              <button
                id="close-cust-modal"
                onClick={() => setIsEditing(false)}
                className="p-1 hover:bg-slate-200 text-slate-400 hover:text-slate-600 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">{t.customer.name} *</label>
                <input
                  id="form-c-name"
                  required
                  type="text"
                  value={editingCustomer.name || ''}
                  onChange={(e) => setEditingCustomer({ ...editingCustomer, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">{t.customer.phone} *</label>
                <input
                  id="form-c-phone"
                  required
                  type="text"
                  value={editingCustomer.phone || ''}
                  onChange={(e) => setEditingCustomer({ ...editingCustomer, phone: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700 font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">{t.customer.email}</label>
                <input
                  id="form-c-email"
                  type="email"
                  value={editingCustomer.email || ''}
                  onChange={(e) => setEditingCustomer({ ...editingCustomer, email: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">{t.customer.debt} ({config.currency})</label>
                <input
                  id="form-c-debt"
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={editingCustomer.debt ?? ''}
                  onChange={(e) => setEditingCustomer({ ...editingCustomer, debt: sanitizeDecimalInput(e.target.value) as any })}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700 font-bold"
                  disabled={!!editingCustomer.id} // prevent direct debt hacks unless new customer
                />
                {editingCustomer.id && (
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Use debt reimbursement module below to settle accounts.
                  </span>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">{t.customer.notes}</label>
                <textarea
                  id="form-c-notes"
                  rows={3}
                  value={editingCustomer.notes || ''}
                  onChange={(e) => setEditingCustomer({ ...editingCustomer, notes: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-600"
                ></textarea>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  id="btn-edit-c-cancel"
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 hover:bg-slate-100 text-slate-600 font-medium rounded-lg transition"
                >
                  {t.customer.cancel}
                </button>
                <button
                  id="btn-edit-c-save"
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition"
                >
                  {t.customer.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Debt Settle Modal */}
      {settlingCustId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto" id="settle-debt-modal">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-sm overflow-hidden animate-fade-in">
            <div className="bg-emerald-50 px-6 py-4 border-b border-emerald-100 flex justify-between items-center">
              <h3 className="font-bold text-emerald-950 flex items-center gap-1.5">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
                {t.customer.payDebt}
              </h3>
              <button
                id="close-settle-modal"
                onClick={() => setSettlingCustId(null)}
                className="p-1 hover:bg-emerald-100 rounded-lg text-emerald-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleDebtSettleSubmit} className="p-6 space-y-4">
              <div>
                <p className="text-sm text-slate-600 mb-4">
                  Register a customer payment towards their unpaid bills and balances.
                </p>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">{t.customer.payAmount} *</label>
                <div className="relative">
                  <span className="absolute inset-y-0 start-3 flex items-center text-slate-400 font-bold text-xs">{config.currency}</span>
                  <input
                    id="form-settle-amount"
                    required
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={settlingAmount || ''}
                    onChange={(e) => setSettlingAmount(sanitizeDecimalInput(e.target.value) as any)}
                    className="w-full ps-14 pe-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-800"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  id="btn-settle-cancel"
                  type="button"
                  onClick={() => setSettlingCustId(null)}
                  className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-50 rounded-lg transition text-sm"
                >
                  {t.customer.cancel}
                </button>
                <button
                  id="btn-settle-save"
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg transition text-sm shadow-xs"
                >
                  Confirm Settle
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom Customer Delete Dialog Overlay */}
      {deletingCustomerId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-md overflow-hidden p-6 space-y-4 animate-fade-in">
            <div className={`flex items-center gap-3 text-rose-600 pb-2 border-b border-slate-100 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
              <Trash2 className="w-6 h-6 shrink-0" />
              <h3 className="text-lg font-black tracking-tight text-slate-800">
                {lang === 'ar' ? 'تاكيد حذف العميل' : 'Confirm Customer Deletion'}
              </h3>
            </div>
            <p className="text-sm text-slate-600 font-semibold leading-relaxed text-start">
              {lang === 'ar' 
                ? `هل أنت متأكد تماماً من رغبتك في حذف العميل "${customers.find(customer => customer.id === deletingCustomerId)?.name || ''}" ؟`
                : `Are you absolutely sure you want to delete "${customers.find(customer => customer.id === deletingCustomerId)?.name || ''}" from the customer directory?`}
            </p>
            <div className="bg-rose-50 text-[11px] text-rose-800 p-3 rounded-xl border border-rose-100 font-medium leading-relaxed text-start">
              {lang === 'ar' 
                ? 'تنبيه: لن يحذف هذا المعاملات المتعلقة بالعميل، ولكنه سيزيل العميل من السجلات الحالية.'
                : 'Warning: This will permanent remove this profile, but past historical invoices remain unaffected.'}
            </div>
            <div className={`flex items-center justify-end gap-3 pt-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <button
                id="btn-confirm-cust-cancel"
                onClick={() => setDeletingCustomerId(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
              >
                {t.customer.cancel}
              </button>
              <button
                id="btn-confirm-cust-delete"
                onClick={() => {
                  onDeleteCustomer(deletingCustomerId);
                  setDeletingCustomerId(null);
                }}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-xl text-xs transition cursor-pointer"
              >
                {t.customer.delete}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
