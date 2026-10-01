import React, { useState } from 'react';
import { RepairOrder, StoreConfig, Language } from '../types';
import { languages } from '../languages';
import { 
  Wrench, Search, Plus, Trash2, Edit3, Clock, CheckCircle2, 
  DollarSign, AlertCircle, Printer, X, Smartphone, Check, 
  RotateCcw, FileText, Phone, Shield, Calendar, Receipt, ChevronRight, User
} from 'lucide-react';

interface RepairsManagementProps {
  repairs: RepairOrder[];
  config: StoreConfig;
  onSaveRepair: (repair: RepairOrder) => void;
  onDeleteRepair: (id: string) => void;
  lang: Language;
}

export default function RepairsManagement({ repairs, config, onSaveRepair, onDeleteRepair, lang }: RepairsManagementProps) {
  const t = languages[lang];
  const isRTL = t.direction === 'rtl';

  // Search & Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Date range filter state
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Modal Control State
  const [showEditModal, setShowEditModal] = useState(false);
  const [currentRepair, setCurrentRepair] = useState<RepairOrder | null>(null);

  // Form State
  const [orderNumber, setOrderNumber] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [itemName, setItemName] = useState('');
  const [itemSerial, setItemSerial] = useState('');
  const [issueDescription, setIssueDescription] = useState('');
  const [status, setStatus] = useState<RepairOrder['status']>('received');
  const [estimatedCost, setEstimatedCost] = useState<number>(0);
  const [amountPaid, setAmountPaid] = useState<number>(0);
  const [estimatedDeliveryDate, setEstimatedDeliveryDate] = useState('');
  const [notes, setNotes] = useState('');

  // Print Receipt Control State
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printTarget, setPrintTarget] = useState<RepairOrder | null>(null);

  // Custom State for Deletion Confirmation Dialog
  const [deletingRepairId, setDeletingRepairId] = useState<string | null>(null);

  // Auto-generate ticket number helper
  const handleOpenAddModal = () => {
    const nextSeq = repairs.length + 1;
    const generatedCode = `REP-${new Date().getFullYear()}-${String(nextSeq).padStart(4, '0')}`;
    setOrderNumber(generatedCode);
    setCustomerName('');
    setCustomerPhone('');
    setItemName('');
    setItemSerial('');
    setIssueDescription('');
    setStatus('received');
    setEstimatedCost(0);
    setAmountPaid(0);
    setEstimatedDeliveryDate(new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]); // 3 days default
    setNotes('');
    setCurrentRepair(null);
    setShowEditModal(true);
  };

  const handleOpenEditModal = (repair: RepairOrder) => {
    setCurrentRepair(repair);
    setOrderNumber(repair.orderNumber);
    setCustomerName(repair.customerName);
    setCustomerPhone(repair.customerPhone);
    setItemName(repair.itemName);
    setItemSerial(repair.itemSerial || '');
    setIssueDescription(repair.issueDescription);
    setStatus(repair.status);
    setEstimatedCost(repair.estimatedCost);
    setAmountPaid(repair.amountPaid || 0);
    setEstimatedDeliveryDate(repair.estimatedDeliveryDate || '');
    setNotes(repair.notes || '');
    setShowEditModal(true);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName || !itemName || !issueDescription) {
      alert(lang === 'ar' ? 'الرجاء ملء كافة الحقول الأساسية' : 'Please fill out all required fields');
      return;
    }

    const savedRecord: RepairOrder = {
      id: currentRepair ? currentRepair.id : `rep_${Date.now()}`,
      orderNumber,
      customerName,
      customerPhone,
      itemName,
      itemSerial,
      issueDescription,
      status,
      estimatedCost: Number(estimatedCost),
      amountPaid: Number(amountPaid),
      estimatedDeliveryDate,
      notes,
      createdAt: currentRepair ? currentRepair.createdAt : new Date().toISOString()
    };

    onSaveRepair(savedRecord);
    setShowEditModal(false);
  };

  // Status badges color-coding
  const getStatusMeta = (itemStatus: RepairOrder['status']) => {
    switch (itemStatus) {
      case 'received':
        return {
          bg: 'bg-indigo-50 border-indigo-100 text-indigo-700',
          dot: 'bg-indigo-500',
          labelAr: 'تم الاستلام',
          labelEn: 'Received'
        };
      case 'in_progress':
        return {
          bg: 'bg-amber-50 border-amber-200 text-amber-700',
          dot: 'bg-amber-500 animate-pulse',
          labelAr: 'قيد التصليح',
          labelEn: 'In Progress'
        };
      case 'ready':
        return {
          bg: 'bg-emerald-50 border-emerald-150 text-emerald-700',
          dot: 'bg-emerald-500',
          labelAr: 'جاهز للاستلام',
          labelEn: 'Ready'
        };
      case 'delivered':
        return {
          bg: 'bg-slate-100 border-slate-200 text-slate-700',
          dot: 'bg-slate-500',
          labelAr: 'تم التسليم والقبض',
          labelEn: 'Delivered'
        };
      case 'cancelled':
        return {
          bg: 'bg-rose-50 border-rose-100 text-rose-700',
          dot: 'bg-rose-500',
          labelAr: 'مُلغى',
          labelEn: 'Cancelled'
        };
    }
  };

  // Filtering list
  const filteredRepairs = repairs.filter(repair => {
    const matchesSearch = 
      repair.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      repair.customerPhone.includes(searchQuery) ||
      repair.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      repair.itemName.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' || repair.status === statusFilter;

    let matchesDate = true;
    if (showDateFilter) {
      if (repair.createdAt) {
        const repairTime = new Date(repair.createdAt).getTime();
        if (fromDate) {
          const start = new Date(fromDate).getTime();
          if (repairTime < start) matchesDate = false;
        }
        if (toDate) {
          const end = new Date(toDate);
          end.setHours(23, 59, 59, 999);
          if (repairTime > end.getTime()) matchesDate = false;
        }
      } else {
        if (fromDate || toDate) matchesDate = false;
      }
    }

    return matchesSearch && matchesStatus && matchesDate;
  });

  // Financial calculations
  const totalRepairsCount = filteredRepairs.length;
  const pendingRepairs = filteredRepairs.filter(r => r.status === 'received' || r.status === 'in_progress');
  const readyRepairs = filteredRepairs.filter(r => r.status === 'ready');
  const deliveredRepairs = filteredRepairs.filter(r => r.status === 'delivered');

  const totalRevenueCollected = deliveredRepairs.reduce((acc, r) => acc + (r.estimatedCost || (r as any).priceCharged || (r as any).repairCost || 0), 0) + 
                                 filteredRepairs.filter(r => r.status !== 'delivered').reduce((acc, r) => acc + (r.amountPaid || 0), 0);

  const outstandingBalanceDue = filteredRepairs.reduce((acc, r) => {
    if (r.status === 'cancelled') return acc;
    const costValue = r.estimatedCost !== undefined ? r.estimatedCost : ((r as any).priceCharged || (r as any).repairCost || 0);
    const remains = costValue - (r.amountPaid || 0);
    return acc + (remains > 0 ? remains : 0);
  }, 0);

  return (
    <div className="space-y-6" id="repairs-workspace">
      {/* Metrics bento-grid layout */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Active pending repairs */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">
              {lang === 'ar' ? 'أجهزة قيد الصيانة' : 'Active Repairs'}
            </span>
            <p className="text-2xl font-black text-indigo-750">{pendingRepairs.length}</p>
            <span className="text-[10px] text-slate-400 font-medium leading-none block">
              {lang === 'ar' ? `${totalRepairsCount} الأجهزة المطابقة للبحث` : `${totalRepairsCount} matching hardware orders`}
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
            <Wrench className="w-6 h-6 animate-pulse" />
          </div>
        </div>

        {/* Ready for collection orders */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">
              {lang === 'ar' ? 'جاهز للاستلام والتسليم' : 'Ready for Pickup'}
            </span>
            <p className="text-2xl font-black text-emerald-700">{readyRepairs.length}</p>
            <span className="text-[10px] text-emerald-600 font-bold block">
              {lang === 'ar' ? 'قم بالاتصال بالعملاء الآن' : 'Call customers for retrieval'}
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        {/* Repairs revenue */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">
              {lang === 'ar' ? 'إيرادات الصيانة المحصلة' : 'Collected Maintenance Rev'}
            </span>
            <p className="text-2xl font-black text-indigo-600">
              {totalRevenueCollected.toLocaleString()} <span className="text-xs font-medium">{config.currency}</span>
            </p>
            <span className="text-[10px] text-slate-400 font-medium block">
              {lang === 'ar' ? 'مجموع العربون والقبض النهائي' : 'Subtotal from receipts & deposits'}
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>

        {/* Outstanding dues from repair balances */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">
              {lang === 'ar' ? 'مستحقات معلقة للصيانة' : 'Unbilled Dues'}
            </span>
            <p className="text-2xl font-black text-rose-600">
              {outstandingBalanceDue.toLocaleString()} <span className="text-xs font-medium">{config.currency}</span>
            </p>
            <span className="text-[10px] text-rose-500 font-bold block animate-pulse">
              {lang === 'ar' ? 'أموال باقية مع الزبائن' : 'Unpaid maintenance balances'}
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600">
            <AlertCircle className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Main filterable list sheet and search components */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {/* Filter bar */}
        <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex-1 max-w-lg relative">
            <Search className="absolute ltr:left-3.5 rtl:right-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
            <input
              id="repair-query-box"
              type="text"
              placeholder={lang === 'ar' ? 'البحث عن أمر صيانة باسم العميل، الهاتف، نوع الجهاز أو رقم التذكرة...' : 'Search customer name, phone, item details or REP receipt...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full ltr:pl-10 rtl:pr-10 ltr:pr-4 rtl:pl-4 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs text-slate-700 font-medium"
            />
          </div>

          <div className="flex items-center gap-3 self-end md:self-auto flex-wrap">
            {/* Status Select Filter Dropdown */}
            <select
              id="repair-status-dropdown"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3.5 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs text-slate-700 font-bold bg-white"
            >
              <option value="all">{lang === 'ar' ? 'جميع الحالات' : 'All Statuses'}</option>
              <option value="received">{lang === 'ar' ? 'تم الاستلام' : 'Received'}</option>
              <option value="in_progress">{lang === 'ar' ? 'قيد التصليح' : 'In Progress'}</option>
              <option value="ready">{lang === 'ar' ? 'جاهز للاستلام' : 'Ready'}</option>
              <option value="delivered">{lang === 'ar' ? 'تم التسليم والقبض' : 'Delivered'}</option>
              <option value="cancelled">{lang === 'ar' ? 'مُلغى' : 'Cancelled'}</option>
            </select>

            {/* Date Filter Toggle Button */}
            <button
              id="btn-toggle-rep-date"
              type="button"
              onClick={() => {
                setShowDateFilter(!showDateFilter);
                if (showDateFilter) {
                  setFromDate('');
                  setToDate('');
                }
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition cursor-pointer ${
                showDateFilter
                  ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span>{lang === 'ar' ? 'تصفية بالتاريخ' : 'Filter by Date'}</span>
            </button>

            {/* Create hardware repair button */}
            <button
              id="btn-add-repair-trigger"
              onClick={handleOpenAddModal}
              className="flex items-center gap-1.5 px-4.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl transition shadow-sm cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              {lang === 'ar' ? 'تسجيل جهاز صيانة جديد' : 'New Repair Order'}
            </button>
          </div>
        </div>

        {showDateFilter && (
          <div className="px-5 py-3 border-b border-slate-100 bg-white flex flex-col sm:flex-row gap-4 items-center text-xs animate-fade-in">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-500">{lang === 'ar' ? 'من تاريخ:' : 'From Date:'}</span>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="px-2.5 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-500">{lang === 'ar' ? 'إلى تاريخ:' : 'To Date:'}</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="px-2.5 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
              />
            </div>
            {(fromDate || toDate) && (
              <button
                type="button"
                onClick={() => {
                  setFromDate('');
                  setToDate('');
                }}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold transition cursor-pointer"
              >
                {lang === 'ar' ? 'إعادة تعيين' : 'Reset'}
              </button>
            )}
          </div>
        )}

        {/* Table/List sheet */}
        <div className="overflow-x-auto">
          {filteredRepairs.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <Wrench className="w-12 h-12 text-slate-350 mx-auto mb-3 opacity-60" />
              <p className="text-sm font-semibold">{lang === 'ar' ? 'لم يتم العثور على أجهزة صيانة مطابقة.' : 'No matching repair orders found.'}</p>
              <p className="text-xs text-slate-400 mt-1">{lang === 'ar' ? 'جرّب تعديل كلمات البحث لتجنب المخرجات الفارغة.' : 'Check your search spelling or filters.'}</p>
            </div>
          ) : (
            <table className="w-full text-start border-collapse">
              <thead>
                <tr className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                  <th className="p-4 text-start">{lang === 'ar' ? 'التذكرة' : 'Ticket #'}</th>
                  <th className="p-4 text-start">{lang === 'ar' ? 'صاحب الجهاز' : 'Client Customer'}</th>
                  <th className="p-4 text-start">{lang === 'ar' ? 'الجهاز المعطل' : 'Device / Hardware'}</th>
                  <th className="p-4 text-start">{lang === 'ar' ? 'المشكلة والخلل' : 'Diagnostic / Issue'}</th>
                  <th className="p-4 text-start">{lang === 'ar' ? 'تاريخ التسليم المتوقع' : 'Delivery Target'}</th>
                  <th className="p-4 text-start">{lang === 'ar' ? 'القبض والمال المالي' : 'Finances'}</th>
                  <th className="p-4 text-start">{lang === 'ar' ? 'الوضعية' : 'Status'}</th>
                  <th className="p-4 text-center">{lang === 'ar' ? 'إجراءات' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {filteredRepairs.map((repair) => {
                  const meta = getStatusMeta(repair.status);
                  const costValue = repair.estimatedCost !== undefined ? repair.estimatedCost : ((repair as any).priceCharged || (repair as any).repairCost || 0);
                  const unpaidAmount = costValue - (repair.amountPaid || 0);

                  return (
                    <tr key={repair.id} className="hover:bg-slate-50/75 transition">
                      {/* Ticket Number */}
                      <td className="p-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                        {repair.orderNumber}
                      </td>

                      {/* Customer Details */}
                      <td className="p-4 whitespace-nowrap">
                        <div className="font-bold text-slate-800">{repair.customerName}</div>
                        {repair.customerPhone && (
                          <div className="text-[10px] text-slate-400 font-mono font-bold flex items-center gap-1 mt-0.5" style={{ direction: 'ltr', justifyContent: isRTL ? 'flex-end' : 'flex-start' }}>
                            <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                            <span>{repair.customerPhone}</span>
                          </div>
                        )}
                      </td>

                      {/* Hardware Item Name */}
                      <td className="p-4 whitespace-nowrap">
                        <div className="font-bold text-slate-800 flex items-center gap-1.5">
                          <Smartphone className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                          <span>{repair.itemName}</span>
                        </div>
                        {repair.itemSerial && (
                          <div className="text-[9.5px] text-slate-450 font-mono mt-0.5">
                            S/N: {repair.itemSerial}
                          </div>
                        )}
                      </td>

                      {/* Issue Diagnostics */}
                      <td className="p-4 max-w-xs">
                        <p className="truncate text-slate-600 font-medium" title={repair.issueDescription}>
                          {repair.issueDescription}
                        </p>
                        {repair.notes && (
                          <p className="text-[10px] text-slate-450 italic truncate">
                            * {repair.notes}
                          </p>
                        )}
                      </td>

                      {/* Estimated Delivery Date */}
                      <td className="p-4 whitespace-nowrap font-semibold">
                        <div className="flex items-center gap-1 text-[11px] text-slate-600">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>{repair.estimatedDeliveryDate || '-- -- --'}</span>
                        </div>
                      </td>

                      {/* Repair Pricing / Deposited Amount */}
                      <td className="p-4 whitespace-nowrap">
                        <div className="font-black text-slate-900">
                          {costValue.toLocaleString()} {config.currency}
                        </div>
                        <div className="text-[10px] mt-0.5 font-bold">
                          {repair.amountPaid && repair.amountPaid > 0 ? (
                            <span className="text-emerald-600">
                              {lang === 'ar' ? `مقدم: ${repair.amountPaid}` : `Deposit: ${repair.amountPaid}`}
                            </span>
                          ) : (
                            <span className="text-slate-400">
                              {lang === 'ar' ? 'بدون عربون' : 'No Deposit'}
                            </span>
                          )}
                          {unpaidAmount > 0 ? (
                            <span className="text-rose-600 font-black ltr:ml-1.5 rtl:mr-1.5 block sm:inline">
                              ({lang === 'ar' ? `متبقي: ${unpaidAmount}` : `Remaining: ${unpaidAmount}`})
                            </span>
                          ) : (
                            repair.status !== 'cancelled' && (
                              <span className="text-emerald-700 bg-emerald-50 px-1 py-0.2 rounded-md ltr:ml-1 py-0.5 text-[9px] border border-emerald-100">
                                {lang === 'ar' ? 'خالص' : 'Fully Paid'}
                              </span>
                            )
                          )}
                        </div>
                      </td>

                      {/* Repair Status Badge */}
                      <td className="p-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[10.5px] font-black rounded-full border ${meta?.bg}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${meta?.dot}`}></span>
                          <span>{lang === 'ar' ? meta?.labelAr : meta?.labelEn}</span>
                        </span>
                      </td>

                      {/* Actions Buttons */}
                      <td className="p-4 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Print ticket */}
                          <button
                            id={`btn-print-rep-${repair.id}`}
                            onClick={() => {
                              setPrintTarget(repair);
                              setShowPrintModal(true);
                            }}
                            title={lang === 'ar' ? 'طباعة وصل الفاتورة' : 'Print ticket'}
                            className="p-1.5 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 text-indigo-600 rounded-lg transition shrink-0 cursor-pointer"
                          >
                            <Printer className="w-4 h-4" />
                          </button>

                          {/* Edit Details */}
                          <button
                            id={`btn-edit-rep-${repair.id}`}
                            onClick={() => handleOpenEditModal(repair)}
                            title={lang === 'ar' ? 'تعديل البيانات والحالة' : 'Edit repair order'}
                            className="p-1.5 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 text-slate-700 hover:text-indigo-600 rounded-lg transition shrink-0 cursor-pointer"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>

                          {/* Delete order */}
                          <button
                            id={`btn-delete-rep-${repair.id}`}
                            onClick={() => setDeletingRepairId(repair.id)}
                            title={lang === 'ar' ? 'حذف أمر الصيانة' : 'Delete order'}
                            className="p-1.5 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 text-rose-500 rounded-lg transition shrink-0 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Hardware Repair Order Creator / Editor Modal Dialog */}
      {showEditModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-2xl overflow-hidden animate-fade-in flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Wrench className="w-5 h-5 text-indigo-400" />
                <h3 className="font-black text-sm tracking-tight">
                  {currentRepair 
                    ? (lang === 'ar' ? `تعديل ملف تذكرة الصيانة: ${orderNumber}` : `Edit SAV Ticket: ${orderNumber}`)
                    : (lang === 'ar' ? 'تسجيل جهاز صيانة وخلل فني جديد' : 'Register New Device Repair')}
                </h3>
              </div>
              <button
                id="btn-edit-modal-close"
                onClick={() => setShowEditModal(false)}
                className="text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form client body */}
            <form onSubmit={handleFormSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Ticket tracking identifier */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">{lang === 'ar' ? 'رقم التتبع المسلسل (تلقائي)' : 'Ticket Sequence (Auto)'}</label>
                  <input
                    id="frm-rep-seq"
                    type="text"
                    disabled
                    value={orderNumber}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-500 font-mono font-bold text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">{lang === 'ar' ? 'وضعية الصيانة الحالية' : 'SAV Current Phase'}</label>
                  <select
                    id="frm-rep-status"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as RepairOrder['status'])}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs font-bold text-slate-800"
                  >
                    <option value="received">{lang === 'ar' ? 'تم الاستلام (Received)' : 'Received'}</option>
                    <option value="in_progress">{lang === 'ar' ? 'تحت الصيانة التقنية (In Progress)' : 'In Progress'}</option>
                    <option value="ready">{lang === 'ar' ? 'جاهز للاستلام (Ready)' : 'Ready'}</option>
                    <option value="delivered">{lang === 'ar' ? 'تم التسليم من المخازن وقبض المستحقات (Delivered)' : 'Delivered'}</option>
                    <option value="cancelled">{lang === 'ar' ? 'إلغاء الأمر وتسليم الجهاز معطل (Cancelled)' : 'Cancelled'}</option>
                  </select>
                </div>
              </div>

              <h4 className="text-xs font-black text-indigo-600 border-b border-indigo-50 pb-2 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" />
                <span>{lang === 'ar' ? 'بيانات العميل (الزبون صاحب الجهاز)' : 'Customer Client Details'}</span>
              </h4>

              {/* Customer Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">{lang === 'ar' ? 'اسم العميل الكامل *' : 'Client Full Name *'}</label>
                  <input
                    id="frm-rep-cust-name"
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder={lang === 'ar' ? 'مثال: محمد البشير' : 'e.g. John Doe'}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs font-semibold text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">{lang === 'ar' ? 'رقم الهاتف للاتصال' : 'Client Phone'}</label>
                  <input
                    id="frm-rep-cust-phone"
                    type="text"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="e.g. 0550123456"
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-xs font-bold text-slate-700"
                  />
                </div>
              </div>

              <h4 className="text-xs font-black text-indigo-600 border-b border-indigo-50 pb-2 flex items-center gap-1.5">
                <Smartphone className="w-3.5 h-3.5" />
                <span>{lang === 'ar' ? 'مواصفات الجهاز ونوع والتشخيص الفني' : 'Device details and diagnostics'}</span>
              </h4>

              {/* Device and diagnosys details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-semibold">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">{lang === 'ar' ? 'الجهاز المعطل (النوع والموديل) *' : 'Hardware Brand & model *'}</label>
                  <input
                    id="frm-rep-item"
                    type="text"
                    required
                    value={itemName}
                    onChange={(e) => setItemName(e.target.value)}
                    placeholder="e.g. iPhone 15 Pro, Samsung S24 Ultra"
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs text-slate-850"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">{lang === 'ar' ? 'الرقم التسلسلي للجهاز / IMEI' : 'Serial / IMEI Number'}</label>
                  <input
                    id="frm-rep-serial"
                    type="text"
                    value={itemSerial}
                    onChange={(e) => setItemSerial(e.target.value)}
                    placeholder="e.g. IMEI 3546738210948372"
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-xs text-slate-600"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">{lang === 'ar' ? 'وصف المشكلة والأعطال ومظاهر الخلل *' : 'Failure symptoms and diagnostics *'}</label>
                  <textarea
                    id="frm-rep-issue"
                    required
                    rows={2}
                    value={issueDescription}
                    onChange={(e) => setIssueDescription(e.target.value)}
                    placeholder={lang === 'ar' ? 'مثال: شاشة مكسورة بالكامل، الجهاز لا يشحن ولا يستجيب للتيار الكهربائي' : 'e.g. Device screen glass broken, does not light up during charging input.'}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs text-slate-800"
                  />
                </div>
              </div>

              <h4 className="text-xs font-black text-indigo-600 border-b border-indigo-50 pb-2 flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5" />
                <span>{lang === 'ar' ? 'المالية، التسعير، العربون والالتزام' : 'Finances, estimated cost and deadline'}</span>
              </h4>

              {/* Maintenance pricing context */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-black">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">{lang === 'ar' ? 'تكلفة التصليح المحددة بنعم' : 'Fix Net Price'}</label>
                  <input
                    id="frm-rep-cost"
                    type="number"
                    min="0"
                    value={estimatedCost}
                    onChange={(e) => setEstimatedCost(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">{lang === 'ar' ? 'المبلغ المدفوع كعربون' : 'Amount Paid (Deposit)'}</label>
                  <input
                    id="frm-rep-dep"
                    type="number"
                    min="0"
                    value={amountPaid}
                    onChange={(e) => setAmountPaid(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">{lang === 'ar' ? 'تاريخ التسليم المقدر' : 'Delivery Target Date'}</label>
                  <input
                    id="frm-rep-date"
                    type="date"
                    value={estimatedDeliveryDate}
                    onChange={(e) => setEstimatedDeliveryDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">{lang === 'ar' ? 'ملاحظات صيانة داخلية' : 'Internal Notes / Admin comment'}</label>
                <input
                  id="frm-rep-notes"
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={lang === 'ar' ? 'مثال: يحتاج تغيير شاشة أصلية مستوردة من المورد الأوراسي' : 'e.g. Needs OEM replacement screen panel, ordered.'}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs text-slate-600 font-medium"
                />
              </div>

              {/* Action buttons */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3 shrink-0">
                <button
                  id="btn-edit-modal-cancel"
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
                >
                  {t.inventory.cancel}
                </button>
                <button
                  id="btn-edit-modal-save"
                  type="submit"
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl text-xs transition cursor-pointer"
                >
                  {t.inventory.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Printable Small A80 Claim ticket format Modal Dialog */}
      {showPrintModal && printTarget && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-sm overflow-hidden animate-fade-in flex flex-col max-h-[90vh]">
            {/* Action Bar */}
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between shrink-0">
              <span className="text-xs font-mono font-bold">{printTarget.orderNumber}</span>
              <div className="flex items-center gap-2">
                <button
                  id="btn-claim-print-trigger"
                  onClick={() => {
                    const printContents = document.getElementById('sav-claim-ticket-thermal-print')?.innerHTML;
                    const originalContents = document.body.innerHTML;
                    if (printContents) {
                      const printWindow = window.open('', '_blank');
                      if (printWindow) {
                        printWindow.document.write(`
                          <html>
                            <head>
                              <title>PRINT CLAIM TICKET ${printTarget.orderNumber}</title>
                              <style>
                                @media print {
                                  body { width: 80mm; margin: 0; padding: 4mm; font-family: 'Inter', sans-serif; font-size: 11px; }
                                }
                                body { width: 80mm; padding: 4px; font-family: sans-serif; font-size: 11px; line-height: 1.4; color: #000; }
                                .dotted-hr { border-top: 1px dashed #000; margin: 8px 0; }
                                .text-center { text-align: center; }
                                .bold { font-weight: bold; }
                                .flex-between { display: flex; justify-content: space-between; }
                              </style>
                            </head>
                            <body onload="window.print(); window.close();">
                              ${printContents}
                            </body>
                          </html>
                        `);
                        printWindow.document.close();
                      } else {
                        // Fallback browser standard direct window print
                        window.print();
                      }
                    }
                  }}
                  className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>{lang === 'ar' ? 'اطبع الآن' : 'Print'}</span>
                </button>
                <button
                  id="btn-claim-print-close"
                  onClick={() => setShowPrintModal(false)}
                  className="text-slate-400 hover:text-white transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Simulated Thermal A80 Print Viewport */}
            <div className="flex-1 overflow-y-auto p-6 bg-slate-100 flex justify-center">
              <div 
                id="sav-claim-ticket-thermal-print" 
                className="w-[80mm] p-5 bg-white shadow-md rounded-md border border-slate-200 text-[11px] text-slate-850 font-medium font-serif leading-relaxed text-slate-900"
                style={{ direction: isRTL ? 'rtl' : 'ltr' }}
              >
                {/* Logo Display if exist */}
                {config.logoUrl ? (
                  <div className="text-center mb-2">
                    <img 
                      src={config.logoUrl} 
                      alt="Logo preview" 
                      className="h-10 object-contain mx-auto" 
                      referrerPolicy="no-referrer"
                    />
                  </div>
                ) : (
                  <div className="text-center font-bold text-sm text-[16px] uppercase tracking-wide">
                    🛠️ SAV REPAIR
                  </div>
                )}

                <h3 className="text-center font-black text-sm text-[14px] mt-1 mb-0.5">{config.name}</h3>
                <p className="text-center text-[10px] text-slate-500 mt-0 mb-2">{config.address}</p>

                <div className="border-t border-dashed border-slate-300 my-2"></div>

                <p className="text-center font-mono font-bold text-[12px] bg-slate-100 py-1 rounded">
                  {lang === 'ar' ? 'وصــل اسـتـلام صـيـانـة' : 'SAV CLAIM TICKET'}
                </p>

                <div className="space-y-1.5 mt-3 text-[10.5px]">
                  <div className="flex justify-between font-bold">
                    <span>{lang === 'ar' ? 'رقم التذكرة:' : 'Ticket #'}</span>
                    <span className="font-mono">{printTarget.orderNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{lang === 'ar' ? 'التاريخ المفتوح:' : 'Date Issued:'}</span>
                    <span className="font-mono">{new Date(printTarget.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{lang === 'ar' ? 'التسليم المتوقع:' : 'Target Pickup:'}</span>
                    <span className="font-medium">{printTarget.estimatedDeliveryDate || '--/--/--'}</span>
                  </div>
                </div>

                <div className="border-t border-dashed border-slate-300 my-2"></div>

                <div className="space-y-1 text-[10px]">
                  <p className="font-bold text-[11px]">{lang === 'ar' ? 'بيانات الزبون:' : 'Customer:'}</p>
                  <p className="ltr:pl-2 rtl:pr-2 font-bold text-slate-800">{printTarget.customerName}</p>
                  {printTarget.customerPhone && <p className="ltr:pl-2 rtl:pr-2 font-mono">{printTarget.customerPhone}</p>}
                </div>

                <div className="border-t border-dashed border-slate-300 my-2"></div>

                <div className="space-y-1 text-[10px]/snug">
                  <p className="font-bold text-[11px]">{lang === 'ar' ? 'مواصفات الجهاز والأعطال:' : 'Device & Diagnose:'}</p>
                  <p className="ltr:pl-2 rtl:pr-2 font-black text-slate-900">📱 {printTarget.itemName}</p>
                  {printTarget.itemSerial && <p className="ltr:pl-3 rtl:pr-3 text-[9.5px] text-slate-500 font-mono">S/N: {printTarget.itemSerial}</p>}
                  <p className="ltr:pl-2 rtl:pr-2 text-slate-700 italic border-l-2 border-indigo-500 ltr:pl-2 rtl:border-r-2 rtl:border-l-0 rtl:pr-2 mt-1">
                    "{printTarget.issueDescription}"
                  </p>
                </div>

                <div className="border-t border-dashed border-slate-300 my-2"></div>

                {/* Financial overview breakdown */}
                {(() => {
                  const estCost = printTarget.estimatedCost !== undefined ? printTarget.estimatedCost : ((printTarget as any).priceCharged || (printTarget as any).repairCost || 0);
                  const remainingBalance = estCost - (printTarget.amountPaid || 0);
                  return (
                    <div className="space-y-1 text-[11px]">
                      <div className="flex justify-between font-bold">
                        <span>{lang === 'ar' ? 'تكلفة الصيانة المقدرة:' : 'Est. Repair Cost:'}</span>
                        <span className="font-black text-slate-950">{estCost} {config.currency}</span>
                      </div>
                      <div className="flex justify-between text-emerald-700">
                        <span>{lang === 'ar' ? 'المبلغ المدفوع (العربون):' : 'Deposit Received:'}</span>
                        <span className="font-black">{printTarget.amountPaid || 0} {config.currency}</span>
                      </div>
                      
                      {remainingBalance > 0 ? (
                        <div className="flex justify-between text-rose-700 font-black text-[12px] bg-rose-50/50 p-1.5 rounded mt-1.5 border border-rose-100">
                          <span>{lang === 'ar' ? 'المتبقي عند الاستلام:' : 'Remaining Balance:'}</span>
                          <span>{remainingBalance} {config.currency}</span>
                        </div>
                      ) : (
                        <div className="text-center text-emerald-800 bg-emerald-50 text-[9.5px] font-bold p-1 rounded border border-emerald-100 mt-1">
                          {lang === 'ar' ? 'هذه الفاتورة خالصة الدفع بالكامل' : 'This ticket is fully paid.'}
                        </div>
                      )}
                    </div>
                  );
                })()}

                <div className="border-t border-dashed border-slate-300 my-3"></div>

                <div className="text-[8.5px] text-center text-slate-500 font-medium space-y-1 leading-normal px-2">
                  <p>{lang === 'ar' ? 'تنبيه: يرجى إحضار هذا الوصل لتسليمك جهازك.' : 'Notice: Please present this claim voucher for recovery.'}</p>
                  <p>{lang === 'ar' ? 'المتجر غير مسؤول عن الأجهزة التي تترك لأكثر من 60 يوماً.' : 'We held no liability for items left over 60 days.'}</p>
                  <p className="font-bold text-indigo-600 mt-2">{lang === 'ar' ? 'شكرًا لـثـقـتـكـم بـنـا!' : 'Thank you for your business!'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM OVERLAY MODAL: Repair ticket Deletion Confirmation */}
      {deletingRepairId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in font-sans">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-md overflow-hidden p-6 space-y-4">
            <div className={`flex items-center gap-3 text-rose-600 pb-2 border-b border-slate-100 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
              <AlertCircle className="w-5 h-5 shrink-0" />
              <h3 className="text-sm font-black tracking-tight text-slate-800">
                {lang === 'ar' ? 'تأكيد حذف أمر الصيانة' : 'Confirm SAV Deletion'}
              </h3>
            </div>
            <p className="text-xs font-bold text-slate-600 leading-relaxed text-start">
              {lang === 'ar' 
                ? `هل أنت متأكد تماماً من رغبتك في حذف أمر الصيانة رقم "${repairs.find(r => r.id === deletingRepairId)?.orderNumber || ''}" للعميل "${repairs.find(r => r.id === deletingRepairId)?.customerName || ''}" نهائياً من قاعدة البيانات؟`
                : `Are you absolutely sure you want to delete repair ticket "${repairs.find(r => r.id === deletingRepairId)?.orderNumber || ''}" belonging to customer "${repairs.find(r => r.id === deletingRepairId)?.customerName || ''}"?`}
            </p>
            <div className="bg-rose-50 text-[10px] text-rose-800 p-2.5 rounded-xl border border-rose-100 font-bold leading-relaxed text-start">
              {lang === 'ar' 
                ? 'تحذير: هذا الإجراء سيؤدي إلى حذف سجل الصيانة بالكامل، ولن تتمكن من تتبع حالة استلام وتكلفة هذا الجهاز مستقبلاً.'
                : 'Attention: This operation will permanently erase the technical ticket history. Recovery and balance ledger entries for this ticket will be unlinked.'}
            </div>
            <div className={`flex items-center justify-end gap-3 pt-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <button
                id="btn-confirm-delete-repair-cancel"
                onClick={() => setDeletingRepairId(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
              >
                {lang === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                id="btn-confirm-delete-repair-action"
                onClick={() => {
                  onDeleteRepair(deletingRepairId);
                  setDeletingRepairId(null);
                }}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-xl text-xs transition cursor-pointer"
              >
                {lang === 'ar' ? 'حذف أمر الصيانة بالتأكيد' : 'Yes, Delete Ticket'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
