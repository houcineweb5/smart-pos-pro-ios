/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Supplier, Language } from '../types';
import { languages } from '../languages';
import { Truck, Search, Phone, Mail, Building2, Edit3, Trash2, X } from 'lucide-react';

interface SuppliersProps {
  suppliers: Supplier[];
  onSaveSupplier: (supplier: Supplier) => void;
  onDeleteSupplier: (id: string) => void;
  lang: Language;
}

export default function Suppliers({ suppliers, onSaveSupplier, onDeleteSupplier, lang }: SuppliersProps) {
  const t = languages[lang];
  const isRTL = t.direction === 'rtl';

  const [search, setSearch] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Partial<Supplier> | null>(null);
  
  // Custom delete state
  const [deletingSupplierId, setDeletingSupplierId] = useState<string | null>(null);

  // Filtered list
  const filteredSuppliers = suppliers.filter((s) => {
    const q = search.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      s.phone.includes(q) ||
      (s.email && s.email.toLowerCase().includes(q)) ||
      (s.company && s.company.toLowerCase().includes(q))
    );
  });

  const handleStartAdd = () => {
    setEditingSupplier({
      id: '',
      name: '',
      phone: '',
      email: '',
      company: '',
      notes: '',
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
      debt: editingSupplier.debt || 0,
      notes: editingSupplier.notes || '',
      createdAt: editingSupplier.createdAt || new Date().toISOString(),
    };

    onSaveSupplier(supplierToSave);
    setIsEditing(false);
    setEditingSupplier(null);
  };

  return (
    <div className="space-y-6" id="suppliers-section">
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
        <div>
          <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2.5">
            <Truck className="w-7 h-7 text-indigo-600" />
            {t.supplier.title}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {lang === 'ar'
              ? 'تتبع وإدارة الموردين الحاليين والشركات لتسهيل المشتريات والتوريد.'
              : 'Track and manage your corporate vendors, supply companies, and agents.'}
          </p>
        </div>
        <button
          id="btn-add-supplier"
          onClick={handleStartAdd}
          className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-slate-800 text-white font-bold rounded-xl transition duration-200 shadow-sm cursor-pointer text-xs"
        >
          <Truck className="w-4 h-4" />
          {t.supplier.addSupplier}
        </button>
      </div>

      {/* Search Input Controls */}
      <div className="relative">
        <span className={`absolute inset-y-0 ${isRTL ? 'right-4' : 'left-4'} flex items-center text-slate-400`}>
          <Search className="w-5 h-5" />
        </span>
        <input
          id="supplier-search-field"
          type="text"
          placeholder={t.supplier.search}
          className={`w-full py-3 ${isRTL ? 'pr-12 pl-4' : 'pl-12 pr-4'} bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition duration-150 shadow-xs text-sm`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Suppliers Bento Feed */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredSuppliers.length > 0 ? (
          filteredSuppliers.map((s) => (
            <div
              key={s.id}
              className="bg-white border border-slate-200/80 p-4 rounded-xl shadow-2xs hover:shadow-sm transition duration-150 flex flex-col justify-between space-y-3 text-start"
            >
              <div>
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <h3 className="text-base font-black text-slate-800 leading-tight flex items-center gap-1.5">
                      <span>{s.name}</span>
                    </h3>
                    <div className="mt-1 text-[11px] font-black text-indigo-600 bg-indigo-50 border border-indigo-100/50 px-2 py-0.5 rounded-lg inline-flex items-center gap-1">
                      <Building2 className="w-3 h-3" />
                      <span>{s.company}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      id={`supplier-edit-btn-${s.id}`}
                      onClick={() => handleStartEdit(s)}
                      className="p-1 hover:bg-slate-100 text-indigo-600 rounded-lg transition cursor-pointer"
                      title={t.supplier.editSupplier}
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      id={`supplier-del-btn-${s.id}`}
                      onClick={() => setDeletingSupplierId(s.id)}
                      className="p-1 hover:bg-rose-50 text-rose-600 rounded-lg transition cursor-pointer"
                      title={t.supplier.delete}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mt-2.5 pt-2 border-t border-slate-100 text-xs text-slate-600">
                  <div className="flex items-center gap-1.5 font-semibold">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span>{s.phone}</span>
                  </div>
                  {s.email && (
                    <div className="flex items-center gap-1.5 font-medium">
                      <Mail className="w-3.5 h-3.5 text-slate-400" />
                      <span className="truncate">{s.email}</span>
                    </div>
                  )}
                </div>

                {s.notes && (
                  <div className="mt-2 p-2 bg-slate-50 border border-slate-100 rounded-lg text-[11px] text-slate-500 font-medium leading-relaxed line-clamp-2">
                    {s.notes}
                  </div>
                )}
              </div>
            </div>
          ))
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
                {editingSupplier.id ? t.supplier.editSupplier : t.supplier.addSupplier}
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
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-xs font-bold"
                    value={editingSupplier.phone || ''}
                    onChange={(e) => setEditingSupplier({ ...editingSupplier, phone: e.target.value })}
                  />
                </div>
              </div>

              {/* Email Address */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">
                  {t.supplier.email}
                </label>
                <input
                  id="supplier-form-email"
                  type="email"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-xs font-bold"
                  value={editingSupplier.email || ''}
                  onChange={(e) => setEditingSupplier({ ...editingSupplier, email: e.target.value })}
                />
              </div>

              {/* Internal notes */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">
                  {t.supplier.notes}
                </label>
                <textarea
                  id="supplier-form-notes"
                  rows={3}
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
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-250 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  {t.supplier.cancel}
                </button>
                <button
                  id="btn-supplier-modal-save"
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition cursor-pointer"
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
                {lang === 'ar' ? 'تاكيد حذف المورّد' : 'Confirm Supplier Deletion'}
              </h3>
            </div>
            <p className="text-sm text-slate-600 font-semibold leading-relaxed">
              {lang === 'ar'
                ? `هل أنت متأكد تماماً من رغبتك في حذف المورّد "${suppliers.find(s => s.id === deletingSupplierId)?.name || ''}" ؟`
                : `Are you absolutely sure you want to delete supplier "${suppliers.find(s => s.id === deletingSupplierId)?.name || ''}" ?`}
            </p>
            <div className="bg-rose-50 text-[11px] text-rose-800 p-3 rounded-xl border border-rose-100 font-medium leading-relaxed">
              {lang === 'ar'
                ? 'تنبيه: سيتم مسح بيانات المورد نهائياً من سجلات الإتصال، لكن بيانات المنتجات السابقة المخزنة لن تتأثر.'
                : 'Warning: This will permanently purge this supplier profile. Products catalog won\'t be affected.'}
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
    </div>
  );
}
