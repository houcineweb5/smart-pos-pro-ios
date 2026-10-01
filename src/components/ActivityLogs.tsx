import React, { useState } from 'react';
import { ActivityLog, Language, StoreConfig } from '../types';
import { languages } from '../languages';
import { ClipboardList, Search, Trash2, Calendar, User, SlidersHorizontal, RefreshCw, MessageSquare, AlertTriangle, X } from 'lucide-react';

interface ActivityLogsProps {
  logs: ActivityLog[];
  config: StoreConfig;
  onClearLogs: () => void;
  onDeleteSingleLog?: (id: string) => void;
  lang: Language;
}

export default function ActivityLogs({ logs, config, onClearLogs, onDeleteSingleLog, lang }: ActivityLogsProps) {
  const t = languages[lang];
  const isRTL = t.direction === 'rtl';

  // Search query & filter type states
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState('all');

  // Custom Confirmation Dialog States (Replacing window.confirm)
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [deletingLogId, setDeletingLogId] = useState<string | null>(null);

  // Filter calculation
  const filteredLogs = logs.filter((log) => {
    const matchesSearch = 
      log.details.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.userId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.action.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesAction = actionFilter === 'all' || log.action.toUpperCase() === actionFilter.toUpperCase();

    return matchesSearch && matchesAction;
  });

  // Unique actions for dropdown filter
  const actionTypes = Array.from(new Set(logs.map((l) => l.action.toUpperCase())));

  return (
    <div className="space-y-6 animate-fade-in" id="activity-logs-view">
      {/* Top Banner section */}
      <div className="bg-slate-900 rounded-2xl text-white p-6 md:p-8 shadow-xs border border-slate-800 relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-1.5 max-w-xl z-10 text-start">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/25 text-indigo-300 text-[10.5px] font-bold border border-indigo-500/20">
            <ClipboardList className="w-3.5 h-3.5" />
            <span>{lang === 'ar' ? 'سجلات المراقبة والأمان' : 'System Activity Audit Trail'}</span>
          </div>
          <h2 className="text-xl font-black md:text-2xl tracking-tight">
            {lang === 'ar' ? 'سجل العمليات والأنشطة بالتفصيل' : 'System Operations Logs'}
          </h2>
          <p className="text-xs text-slate-300 leading-relaxed font-semibold">
            {lang === 'ar' 
              ? 'راجع جميع أحداث ومبيعات الكاشير، إشعارات الصيانة، فواتير الموردين، وإدخال السلع والمستخدمين والعمليات المالية بدقة تامة وبأثر رجعي للحماية والنزاهة.' 
              : 'Review cash registers, terminal checkouts, POS transactions, SAV updates, stock revisions, supplier entries, and administrative alterations.'}
          </p>
        </div>

        {logs.length > 0 && (
          <button
            id="btn-clear-system-logs"
            onClick={() => setShowClearConfirm(true)}
            className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black shadow-sm transition flex items-center gap-1.5 shrink-0 cursor-pointer self-end md:self-auto"
          >
            <Trash2 className="w-4 h-4" />
            <span>{lang === 'ar' ? 'مسح السجلات نهائياً' : 'Reset Audit Trail'}</span>
          </button>
        )}
      </div>

      {/* Main filter, search and workspace panels */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {/* Dynamic Controls Bar */}
        <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Broad search field */}
          <div className="w-full md:max-w-md relative">
            <Search className="absolute ltr:left-3.5 rtl:right-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
            <input
              id="logs-search-query"
              type="text"
              placeholder={lang === 'ar' ? 'ابحث في السلاح، اسم المستخدم، البائع أو تفاصيل العملية الحية...' : 'Search logs by user, detail parameters, action...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full ltr:pl-10 rtl:pr-10 ltr:pr-4 rtl:pl-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs text-slate-700 font-medium bg-white"
            />
          </div>

          <div className="w-full md:w-auto flex flex-col sm:flex-row items-center gap-3 self-end md:self-auto">
            {/* Filter by system action type dropdown */}
            <div className="w-full sm:w-auto flex items-center gap-1.5 bg-white border border-slate-200 px-3 py-1.5 rounded-xl">
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-450 shrink-0" />
              <select
                id="logs-action-type-select"
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                className="bg-transparent focus:outline-none text-xs text-slate-700 font-bold max-w-full cursor-pointer"
              >
                <option value="all">{lang === 'ar' ? 'جميع أنواع العمليات' : 'All Action Types'}</option>
                {actionTypes.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>

            <span className="text-[10px] font-black bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-xl border border-indigo-100/60 font-mono whitespace-nowrap shrink-0">
              {filteredLogs.length} / {logs.length} {lang === 'ar' ? 'حدث عثر عليه' : 'audits found'}
            </span>
          </div>
        </div>

        {/* Scrollable responsive list layout */}
        <div className="overflow-x-auto border-t border-slate-50">
          {filteredLogs.length === 0 ? (
            <div className="p-16 text-center text-slate-400">
              <ClipboardList className="w-14 h-14 text-slate-300 mx-auto mb-3 opacity-60" />
              <p className="text-sm font-bold text-slate-500">{lang === 'ar' ? 'لا يوجد أحداث مطابقة للبحث' : 'No activity records match your criteria.'}</p>
              <p className="text-xs text-slate-400 mt-1">{lang === 'ar' ? 'جرّب تعديل الكلمات أو الفلاتر لتصفية السجل بشكل صحيح.' : 'Try resetting query spelling or selecting All Action Types.'}</p>
            </div>
          ) : (
            <div className="p-5 divide-y divide-slate-100 max-h-[60vh] overflow-y-auto">
              {filteredLogs.map((log) => {
                const logTime = new Date(log.timestamp);
                
                // Color badges depending on CRUD patterns
                let actionBadgeColor = "bg-indigo-50 text-indigo-700 border-indigo-100";
                const actionUpper = log.action.toUpperCase();
                if (actionUpper.includes("DELETE") || actionUpper.includes("REMOVE")) {
                  actionBadgeColor = "bg-rose-50 text-rose-700 border-rose-100";
                } else if (actionUpper.includes("CREATE") || actionUpper.includes("ADD") || actionUpper.includes("INSERT") || actionUpper.includes("SUCCESS")) {
                  actionBadgeColor = "bg-emerald-50 text-emerald-700 border-emerald-100";
                } else if (actionUpper.includes("UPDATE") || actionUpper.includes("EDIT")) {
                  actionBadgeColor = "bg-amber-50 text-amber-700 border-amber-100";
                }

                return (
                  <div key={log.id} className="py-4.5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 text-start font-medium hover:bg-slate-50/50 transition px-3 rounded-xl group relative">
                    <div className="flex items-start gap-3.5 max-w-3xl flex-1">
                      {/* Left icon marker style */}
                      <div className="w-8.5 h-8.5 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 shrink-0 border border-slate-150 relative">
                        <MessageSquare className="w-4 h-4 text-slate-500" />
                        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-indigo-500 border border-white"></span>
                      </div>

                      <div className="space-y-1">
                        {/* Audit Details */}
                        <p className="text-xs font-black text-slate-800 leading-relaxed md:text-[13px]">
                          {log.details}
                        </p>

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-450 font-bold">
                          {/* User tag */}
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3 text-slate-400" />
                            <span>{log.userName}</span>
                            <span className="font-mono text-[9px] bg-slate-100 text-slate-450 px-1 py-0.2 rounded">({log.userId})</span>
                          </span>

                          <span className="opacity-40">|</span>

                          {/* Time label */}
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            <span className="font-mono">
                              {logTime.toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' })} - {logTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
                            </span>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right side controls & badge */}
                    <div className="flex items-center gap-3 justify-end self-end sm:self-auto shrink-0">
                      <span className={`inline-flex px-2.5 py-1 text-[9.5px] font-black font-mono rounded-lg border uppercase tracking-wider ${actionBadgeColor}`}>
                        {log.action}
                      </span>
                      
                      {onDeleteSingleLog && (
                        <button
                          id={`btn-delete-log-row-${log.id}`}
                          onClick={() => setDeletingLogId(log.id)}
                          title={lang === 'ar' ? 'حذف هذا السطر' : 'Unlink record'}
                          className="p-1 px-1.5 bg-slate-100 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition border border-transparent hover:border-rose-100 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* CUSTOM OVERLAY MODAL: Clear All Logs */}
      {showClearConfirm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-md overflow-hidden p-6 space-y-4">
            <div className={`flex items-center gap-3 text-rose-600 pb-2 border-b border-slate-100 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="text-lg font-black tracking-tight text-slate-800">
                {lang === 'ar' ? 'تأكيد تصفية السجل' : 'Reset System Log'}
              </h3>
            </div>
            <p className="text-sm text-slate-600 font-semibold leading-relaxed text-start">
              {lang === 'ar' 
                ? 'هل أنت متأكد تماماً من رغبتك في حذف وإفراغ جميع سجلات العمليات والأمان الفنية نهائياً وإعادتها لصفر؟'
                : 'Are you absolutely sure you want to flush and completely delete all operation audit logs and start over?'}
            </p>
            <div className="bg-rose-50 text-[11px] text-rose-800 p-3 rounded-xl border border-rose-100 font-medium leading-relaxed text-start">
              {lang === 'ar' 
                ? 'تنبيه: هذا الإجراء فني حاسم وغير قابل للتراجع عنه، وسيتم مسح السجل بالكامل من الذاكرة المحلية للجهاز.'
                : 'Attention: This operation strictly removes administrative records. Local database is not reverted, but system audit history is permanently cleared.'}
            </div>
            <div className={`flex items-center justify-end gap-3 pt-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <button
                id="btn-confirm-clearlogs-cancel"
                onClick={() => setShowClearConfirm(false)}
                className="px-4 py-2 bg-slate-105 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
              >
                {lang === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                id="btn-confirm-clearlogs-action"
                onClick={() => {
                  onClearLogs();
                  setShowClearConfirm(false);
                }}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-xl text-xs transition cursor-pointer"
              >
                {lang === 'ar' ? 'مسح الكل بالتأكيد' : 'Yes, Empty Logs'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM OVERLAY MODAL: Delete Single Log */}
      {deletingLogId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-md overflow-hidden p-6 space-y-4">
            <div className={`flex items-center gap-3 text-rose-600 pb-2 border-b border-slate-100 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
              <Trash2 className="w-6 h-6 shrink-0" />
              <h3 className="text-lg font-black tracking-tight text-slate-800">
                {lang === 'ar' ? 'تأكيد حذف حدث من السجل' : 'Unlink Log Entry'}
              </h3>
            </div>
            <p className="text-sm text-slate-600 font-semibold leading-relaxed text-start">
              {lang === 'ar' 
                ? 'هل أنت متأكد من رغبتك في حذف هذا الحدث الفردي بشكل مستقل من السجلات؟'
                : 'Are you sure you want to permanently delete this single record from the operational logs?'}
            </p>
            <div className="bg-slate-50 text-[10.5px] text-slate-500 p-3 rounded-xl border border-slate-200 font-semibold text-start leading-relaxed max-h-32 overflow-y-auto">
              {logs.find(l => l.id === deletingLogId)?.details || ''}
            </div>
            <div className={`flex items-center justify-end gap-3 pt-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <button
                id="btn-confirm-singlelog-cancel"
                onClick={() => setDeletingLogId(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
              >
                {lang === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                id="btn-confirm-singlelog-delete"
                onClick={() => {
                  if (onDeleteSingleLog) {
                    onDeleteSingleLog(deletingLogId);
                  }
                  setDeletingLogId(null);
                }}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-xl text-xs transition cursor-pointer"
              >
                {lang === 'ar' ? 'حذف السطر' : 'Yes, Delete Row'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
