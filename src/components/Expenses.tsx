/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Expense, StoreConfig, Language } from '../types';
import { parseDecimal, sanitizeDecimalInput } from '../utils/numberInput';
import { languages } from '../languages';
import { exportCsvFile } from '../utils/printService';
import { 
  ReceiptText, Plus, Search, Calendar, Trash2, Edit3, X, 
  DollarSign, Filter, Download, Printer, TrendingDown,
  Building, Zap, Users, Truck, Wrench, MoreHorizontal, Check,
  LayoutGrid, List
} from 'lucide-react';

interface ExpensesProps {
  expenses: Expense[];
  config: StoreConfig;
  onSaveExpense: (expense: Expense) => void;
  onDeleteExpense: (id: string) => void;
  lang: Language;
  currentUserName?: string;
}

const CATEGORIES = [
  { id: 'rent', labelAr: 'إيجار المحل (كراء)', labelFr: 'Loyer', labelEn: 'Rent', icon: Building, color: 'text-indigo-600 bg-indigo-50 border-indigo-200' },
  { id: 'utilities', labelAr: 'كهرباء وماء وإنترنت', labelFr: 'Électricité / Eau / Net', labelEn: 'Utilities', icon: Zap, color: 'text-amber-600 bg-amber-50 border-amber-200' },
  { id: 'salaries', labelAr: 'رواتب وأجور العمال', labelFr: 'Salaires & Primes', labelEn: 'Salaries', icon: Users, color: 'text-blue-600 bg-blue-50 border-blue-200' },
  { id: 'transport', labelAr: 'نقل وشحن وبنزين', labelFr: 'Transport & Carburant', labelEn: 'Transport', icon: Truck, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  { id: 'supplies', labelAr: 'مستلزمات وصيانة ونظافة', labelFr: 'Fournitures & Entretien', labelEn: 'Supplies & Maintenance', icon: Wrench, color: 'text-purple-600 bg-purple-50 border-purple-200' },
  { id: 'other', labelAr: 'مصاريف أخرى متنوعة', labelFr: 'Autres Dépenses', labelEn: 'Other Expenses', icon: MoreHorizontal, color: 'text-slate-600 bg-slate-100 border-slate-200' }
];

export default function Expenses({
  expenses = [],
  config,
  onSaveExpense,
  onDeleteExpense,
  lang,
  currentUserName = 'System'
}: ExpensesProps) {
  const t = languages[lang];
  const isRTL = t.direction === 'rtl';

  // Filters state
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [timeFilter, setTimeFilter] = useState<'all' | 'today' | 'week' | 'month' | 'custom'>('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Modals state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Form inputs
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('other');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');

  // Open modal for add
  const handleOpenAdd = () => {
    setEditingExpense(null);
    setTitle('');
    setAmount('');
    setCategory('other');
    setDate(new Date().toISOString().split('T')[0]);
    setNotes('');
    setIsFormOpen(true);
  };

  // Open modal for edit
  const handleOpenEdit = (exp: Expense) => {
    setEditingExpense(exp);
    setTitle(exp.title);
    setAmount(exp.amount.toString());
    setCategory(exp.category || 'other');
    setDate(exp.date ? exp.date.split('T')[0] : new Date().toISOString().split('T')[0]);
    setNotes(exp.notes || '');
    setIsFormOpen(true);
  };

  // Submit expense form
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseDecimal(amount);
    if (!title.trim() || isNaN(parsedAmount) || parsedAmount <= 0) {
      alert(lang === 'ar' ? 'يرجى إدخال اسم المصروف والمبلغ بشكل صحيح' : 'Please provide a valid title and amount');
      return;
    }

    const payload: Expense = {
      id: editingExpense ? editingExpense.id : 'exp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      title: title.trim(),
      amount: parsedAmount,
      category,
      date: date ? new Date(date).toISOString() : new Date().toISOString(),
      notes: notes.trim(),
      createdByName: editingExpense ? editingExpense.createdByName : currentUserName
    };

    onSaveExpense(payload);
    setIsFormOpen(false);
  };

  // Filter logic
  const now = new Date();
  const filteredExpenses = expenses.filter((exp) => {
    // Search
    const s = search.toLowerCase();
    const matchSearch = exp.title.toLowerCase().includes(s) || (exp.notes && exp.notes.toLowerCase().includes(s));

    // Category
    const matchCat = selectedCategory === 'all' || exp.category === selectedCategory;

    // Time
    const expDate = new Date(exp.date);
    let matchTime = true;
    if (timeFilter === 'today') {
      matchTime = expDate.toDateString() === now.toDateString();
    } else if (timeFilter === 'week') {
      const oneWeekAgo = new Date(now);
      oneWeekAgo.setDate(now.getDate() - 7);
      matchTime = expDate >= oneWeekAgo;
    } else if (timeFilter === 'month') {
      matchTime = expDate.getMonth() === now.getMonth() && expDate.getFullYear() === now.getFullYear();
    } else if (timeFilter === 'custom') {
      if (fromDate) {
        const start = new Date(fromDate).getTime();
        if (expDate.getTime() < start) matchTime = false;
      }
      if (toDate) {
        const end = new Date(toDate);
        end.setHours(23, 59, 59, 999);
        if (expDate.getTime() > end.getTime()) matchTime = false;
      }
    }

    return matchSearch && matchCat && matchTime;
  });

  // Calculate metrics
  const totalFilteredAmount = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);

  const todayAmount = expenses
    .filter((e) => new Date(e.date).toDateString() === now.toDateString())
    .reduce((sum, e) => sum + e.amount, 0);

  const thisMonthAmount = expenses
    .filter((e) => {
      const d = new Date(e.date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    })
    .reduce((sum, e) => sum + e.amount, 0);

  const allTimeAmount = expenses.reduce((sum, e) => sum + e.amount, 0);

  // Category label helper
  const getCategoryInfo = (catId: string) => {
    const found = CATEGORIES.find((c) => c.id === catId);
    if (!found) {
      return {
        label: catId,
        icon: MoreHorizontal,
        color: 'text-slate-600 bg-slate-100 border-slate-200'
      };
    }
    return {
      label: lang === 'ar' ? found.labelAr : lang === 'fr' ? found.labelFr : found.labelEn,
      icon: found.icon,
      color: found.color
    };
  };

  // Export to CSV / Excel
  const handleExportCSV = async () => {
    const headers = lang === 'ar' 
      ? ['المعرف', 'اسم المصروف', 'المبلغ', 'العملة', 'الفئة', 'التاريخ', 'المسؤول', 'ملاحظات']
      : ['ID', 'Title', 'Amount', 'Currency', 'Category', 'Date', 'Created By', 'Notes'];

    const rows = filteredExpenses.map((e) => [
      e.id,
      `"${(e.title || '').replace(/"/g, '""')}"`,
      e.amount.toFixed(2),
      config.currency,
      `"${getCategoryInfo(e.category).label.replace(/"/g, '""')}"`,
      e.date ? new Date(e.date).toLocaleDateString() : '',
      `"${(e.createdByName || '').replace(/"/g, '""')}"`,
      `"${(e.notes || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'sep=;\r\n' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\r\n');
    const filename = `SmartPOS_Expenses_${new Date().toISOString().split('T')[0]}.csv`;
    await exportCsvFile(csvContent, filename);
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Metrics Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-rose-50 text-rose-600 rounded-xl border border-rose-100">
              <ReceiptText className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900">
                {lang === 'ar' ? 'إدارة المصاريف اليومية والنفقات' : lang === 'fr' ? 'Gestion des Dépenses' : 'Daily Expenses & Operating Costs'}
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                {lang === 'ar' ? 'تتبع مصاريف المحل، الإيجار، الفواتير لحساب صافي الأرباح الحقيقي' : 'Track rent, bills, salaries and daily operating costs'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
            title={lang === 'ar' ? 'تصدير كشف المصاريف إلى ملف Excel' : 'Export to Excel CSV'}
          >
            <Download className="w-4 h-4" />
            <span>Excel</span>
          </button>

          <button
            id="btn-add-expense"
            onClick={handleOpenAdd}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black shadow-sm transition active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{lang === 'ar' ? 'تسجيل مصروف جديد' : lang === 'fr' ? 'Nouvelle Dépense' : 'Add Expense'}</span>
          </button>
        </div>
      </div>

      {/* Quick Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Today */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                {lang === 'ar' ? 'مصاريف اليوم' : lang === 'fr' ? "Dépenses d'aujourd'hui" : "Today's Expenses"}
              </span>
              <h3 className="text-2xl font-black text-rose-600 font-mono">
                {todayAmount.toFixed(2)} <span className="text-xs font-bold text-slate-400">{config.currency}</span>
              </h3>
            </div>
            <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl">
              <TrendingDown className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 text-[10px] text-slate-400 font-semibold">
            {lang === 'ar' ? 'النفقات المسجلة اليوم' : 'Total recorded today'}
          </div>
        </div>

        {/* This Month */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                {lang === 'ar' ? 'مصاريف هذا الشهر' : lang === 'fr' ? 'Dépenses du mois' : 'This Month'}
              </span>
              <h3 className="text-2xl font-black text-slate-800 font-mono">
                {thisMonthAmount.toFixed(2)} <span className="text-xs font-bold text-slate-400">{config.currency}</span>
              </h3>
            </div>
            <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl">
              <Calendar className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 text-[10px] text-slate-400 font-semibold">
            {lang === 'ar' ? 'المجموع الشهري الحالي' : 'Current month total'}
          </div>
        </div>

        {/* Total Expenses */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                {lang === 'ar' ? 'إجمالي كل المصاريف' : lang === 'fr' ? 'Total des Dépenses' : 'Total Expenses'}
              </span>
              <h3 className="text-2xl font-black text-indigo-700 font-mono">
                {allTimeAmount.toFixed(2)} <span className="text-xs font-bold text-slate-400">{config.currency}</span>
              </h3>
            </div>
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 text-[10px] text-slate-400 font-semibold">
            {expenses.length} {lang === 'ar' ? 'عملية مسجلة بالنظام' : 'total logged transactions'}
          </div>
        </div>
      </div>

      {/* Filters & Search Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
          {/* Search */}
          <div className="relative w-full md:w-80">
            <Search className={`w-4 h-4 absolute ${isRTL ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-slate-400`} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={lang === 'ar' ? 'ابحث في المصاريف والملاحظات...' : 'Search expenses by name or notes...'}
              className={`w-full ${isRTL ? 'pr-9 pl-3' : 'pl-9 pr-3'} py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-rose-500`}
            />
          </div>

          {/* Time presets */}
          <div className="flex items-center gap-1 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
            {[
              { id: 'all', ar: 'الكل', fr: 'Tous', en: 'All' },
              { id: 'today', ar: 'اليوم', fr: "Aujourd'hui", en: 'Today' },
              { id: 'week', ar: 'هذا الأسبوع', fr: 'Cette Semaine', en: 'Week' },
              { id: 'month', ar: 'هذا الشهر', fr: 'Ce Mois', en: 'Month' },
              { id: 'custom', ar: 'مخصص', fr: 'Personnalisé', en: 'Custom' }
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => setTimeFilter(p.id as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                  timeFilter === p.id
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {lang === 'ar' ? p.ar : lang === 'fr' ? p.fr : p.en}
              </button>
            ))}
          </div>
        </div>

        {/* Custom Date Range if selected */}
        {timeFilter === 'custom' && (
          <div className="flex items-center gap-2 pt-2 border-t border-slate-100 animate-fade-in flex-wrap text-xs">
            <span className="text-slate-400 font-bold">{lang === 'ar' ? 'من:' : 'From:'}</span>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50"
            />
            <span className="text-slate-400 font-bold">{lang === 'ar' ? 'إلى:' : 'To:'}</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50"
            />
          </div>
        )}

        {/* Category Filter Pills & View Mode Toggle */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1 rounded-full text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                selectedCategory === 'all'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {lang === 'ar' ? 'جميع الفئات' : 'All Categories'}
            </button>
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedCategory(c.id)}
                className={`px-3 py-1 rounded-full text-xs font-bold transition cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                  selectedCategory === c.id
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <c.icon className="w-3 h-3" />
                <span>{lang === 'ar' ? c.labelAr : lang === 'fr' ? c.labelFr : c.labelEn}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 shrink-0">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-white text-rose-600 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title={lang === 'ar' ? 'عرض البطاقات الحديث' : 'Cards View'}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>{lang === 'ar' ? 'بطاقات' : 'Cards'}</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-white text-rose-600 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title={lang === 'ar' ? 'عرض الجدول' : 'Table View'}
            >
              <List className="w-3.5 h-3.5" />
              <span>{lang === 'ar' ? 'جدول' : 'Table'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Modern Card / Grid View */}
      {viewMode === 'grid' ? (
        filteredExpenses.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredExpenses.map((exp) => {
              const catInfo = getCategoryInfo(exp.category);
              const Icon = catInfo.icon;
              return (
                <div
                  key={exp.id}
                  className="bg-white rounded-2xl border border-slate-200/90 hover:border-rose-300 p-4.5 shadow-xs hover:shadow-md transition-all duration-200 space-y-3 relative group"
                >
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className={`p-2.5 rounded-xl border ${catInfo.color} shrink-0`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-black text-slate-900 text-sm leading-snug line-clamp-1">{exp.title}</h4>
                        <span className="text-[10px] font-bold text-slate-400">{catInfo.label}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEdit(exp)}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition cursor-pointer"
                        title={lang === 'ar' ? 'تعديل' : 'Edit'}
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setDeletingId(exp.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                        title={lang === 'ar' ? 'حذف' : 'Delete'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="p-3 bg-rose-50/40 rounded-xl border border-rose-100 flex items-baseline justify-between">
                    <span className="text-[11px] font-bold text-rose-800">{lang === 'ar' ? 'المبلغ المصروف:' : 'Amount:'}</span>
                    <div className="font-mono font-black text-lg text-rose-600">
                      {exp.amount.toFixed(2)} <span className="text-xs font-bold text-rose-400">{config.currency}</span>
                    </div>
                  </div>

                  {exp.notes && (
                    <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100 line-clamp-2">
                      {exp.notes}
                    </p>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px] text-slate-400 font-medium">
                    <span className="flex items-center gap-1 font-mono">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      {exp.date ? new Date(exp.date).toLocaleString('fr-FR') : ''}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 font-bold text-slate-600 text-[10px]">
                      {exp.createdByName || 'System'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400 shadow-xs">
            <ReceiptText className="w-12 h-12 stroke-[1.2] mx-auto text-slate-300 mb-3" />
            <p className="font-bold text-sm text-slate-600">{lang === 'ar' ? 'لا توجد مصاريف مسجلة مطابقة للبحث' : 'No expenses found under current filters'}</p>
            <p className="text-xs text-slate-400 mt-1">
              {lang === 'ar' ? 'انقر على "تسجيل مصروف جديد" لإضافة أول مصروف' : 'Click "Add Expense" to record a new expense'}
            </p>
          </div>
        )
      ) : (
        /* Expenses Table View */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-start">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                <tr>
                  <th className="p-4 text-start">#</th>
                  <th className="p-4 text-start">{lang === 'ar' ? 'اسم المصروف / البيان' : 'Expense / Title'}</th>
                  <th className="p-4 text-start">{lang === 'ar' ? 'الفئة' : 'Category'}</th>
                  <th className="p-4 text-start">{lang === 'ar' ? 'المبلغ' : 'Amount'}</th>
                  <th className="p-4 text-start">{lang === 'ar' ? 'التاريخ' : 'Date'}</th>
                  <th className="p-4 text-start">{lang === 'ar' ? 'المسجل' : 'Registered By'}</th>
                  <th className="p-4 text-start">{lang === 'ar' ? 'ملاحظات' : 'Notes'}</th>
                  <th className="p-4 text-center">{lang === 'ar' ? 'إجراءات' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredExpenses.length > 0 ? (
                  filteredExpenses.map((exp, idx) => {
                    const catInfo = getCategoryInfo(exp.category);
                    const Icon = catInfo.icon;
                    return (
                      <tr key={exp.id} className="hover:bg-slate-50/60 transition">
                        <td className="p-4 text-slate-400 font-mono text-start">{idx + 1}</td>
                        <td className="p-4 text-start font-bold text-slate-850">
                          {exp.title}
                        </td>
                        <td className="p-4 text-start">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${catInfo.color}`}>
                            <Icon className="w-3 h-3" />
                            <span>{catInfo.label}</span>
                          </span>
                        </td>
                        <td className="p-4 text-start font-mono font-black text-sm text-rose-600">
                          {exp.amount.toFixed(2)} <span className="text-[10px] text-slate-400 font-bold">{config.currency}</span>
                        </td>
                        <td className="p-4 text-start font-medium text-slate-600 font-mono text-[11px]">
                          {exp.date ? new Date(exp.date).toLocaleString('fr-FR') : ''}
                        </td>
                        <td className="p-4 text-start font-medium text-slate-500">
                          <span className="bg-slate-100 px-2 py-0.5 rounded text-[10px] font-bold text-slate-700">
                            {exp.createdByName || 'System'}
                          </span>
                        </td>
                        <td className="p-4 text-start font-medium text-slate-500 max-w-xs truncate">
                          {exp.notes || '—'}
                        </td>
                        <td className="p-4 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => handleOpenEdit(exp)}
                              className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition cursor-pointer"
                              title={lang === 'ar' ? 'تعديل' : 'Edit'}
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setDeletingId(exp.id)}
                              className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                              title={lang === 'ar' ? 'حذف' : 'Delete'}
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
                    <td colSpan={8} className="p-12 text-center text-slate-400">
                      <ReceiptText className="w-12 h-12 stroke-[1.2] mx-auto text-slate-300 mb-3" />
                      <p className="font-bold">{lang === 'ar' ? 'لا توجد مصاريف مسجلة مطابقة للبحث' : 'No expenses found under current filters'}</p>
                      <p className="text-[11px] text-slate-400 mt-1">
                        {lang === 'ar' ? 'انقر على "تسجيل مصروف جديد" لإضافة أول مصروف' : 'Click "Add Expense" to record a new expense'}
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Footer Subtotal */}
          {filteredExpenses.length > 0 && (
            <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex justify-between items-center text-xs font-bold text-slate-700">
              <span>{lang === 'ar' ? 'مجموع النتائج المعروضة:' : 'Total displayed expenses:'}</span>
              <span className="font-mono text-base font-black text-rose-600">
                {totalFilteredAmount.toFixed(2)} {config.currency}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Add / Edit Expense Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-md overflow-hidden">
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ReceiptText className="w-5 h-5 text-rose-400" />
                <h3 className="font-bold text-sm">
                  {editingExpense 
                    ? (lang === 'ar' ? 'تعديل المصروف' : 'Edit Expense') 
                    : (lang === 'ar' ? 'تسجيل مصروف جديد' : 'Record New Expense')}
                </h3>
              </div>
              <button
                onClick={() => setIsFormOpen(false)}
                className="text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 text-start">
              {/* Title */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                  {lang === 'ar' ? 'اسم أو بيان المصروف *' : 'Expense Title / Description *'}
                </label>
                <input
                  required
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={lang === 'ar' ? 'مثال: إيجار المحل، فاتورة كهرباء، نقل بضائع...' : 'e.g. Monthly rent, electricity bill...'}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-rose-500 bg-white"
                />
              </div>

              {/* Amount */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                  {lang === 'ar' ? `المبلغ المسدد (${config.currency}) *` : `Amount Paid (${config.currency}) *`}
                </label>
                <input
                  required
                  type="text"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(sanitizeDecimalInput(e.target.value))}
                  placeholder="0.00"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-black font-mono focus:outline-none focus:ring-2 focus:ring-rose-500 bg-white"
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                  {lang === 'ar' ? 'فئة وتصنيف المصروف *' : 'Category *'}
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-rose-500 bg-white"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {lang === 'ar' ? c.labelAr : lang === 'fr' ? c.labelFr : c.labelEn}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                  {lang === 'ar' ? 'تاريخ الصرف' : 'Date'}
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-rose-500 bg-white"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                  {lang === 'ar' ? 'ملاحظات إضافية (اختياري)' : 'Additional Notes (Optional)'}
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={lang === 'ar' ? 'رقم الوصل، اسم المستلم، أو أي تفاصيل...' : 'Receipt number, receiver name...'}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-rose-500 bg-white"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black shadow-sm transition cursor-pointer"
                >
                  {lang === 'ar' ? 'حفظ المصروف' : 'Save Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-sm p-6 text-center space-y-4">
            <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-base">
                {lang === 'ar' ? 'تأكيد حذف المصروف' : 'Confirm Delete'}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                {lang === 'ar' ? 'هل أنت متأكد من رغبتك في حذف هذا المصروف؟ لن يمكنك استرجاعه.' : 'Are you sure you want to delete this expense record?'}
              </p>
            </div>
            <div className="flex gap-2 justify-center pt-2">
              <button
                onClick={() => setDeletingId(null)}
                className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                {lang === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                onClick={() => {
                  onDeleteExpense(deletingId);
                  setDeletingId(null);
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-sm transition cursor-pointer"
              >
                {lang === 'ar' ? 'نعم، حذف' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
