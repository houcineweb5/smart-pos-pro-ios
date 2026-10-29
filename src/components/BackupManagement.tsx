/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { StoreConfig, Language, ActivityLog } from '../types';
import { languages } from '../languages';
import { 
  Database, Download, Upload, RefreshCw, ShieldAlert, CheckCircle2, 
  Package, FileText, Users, Truck, AlertTriangle, ShieldCheck, HardDrive, Info
} from 'lucide-react';

interface BackupManagementProps {
  onImportBackup: (importedData: any) => void;
  onExportBackup: () => void;
  onResetToDefaults: () => void;
  lang: Language;
  logs?: ActivityLog[];
  productsCount?: number;
  invoicesCount?: number;
  customersCount?: number;
  suppliersCount?: number;
  isAdmin?: boolean;
}

export default function BackupManagement({
  onImportBackup,
  onExportBackup,
  onResetToDefaults,
  lang,
  logs = [],
  productsCount = 0,
  invoicesCount = 0,
  customersCount = 0,
  suppliersCount = 0,
  isAdmin = true,
}: BackupManagementProps) {
  const t = languages[lang];
  const isRTL = t.direction === 'rtl';
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showResetDialog, setShowResetDialog] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 4500);
  };

  const showError = (msg: string) => {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(''), 5000);
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json.products && json.customers && json.invoices) {
          onImportBackup(json);
          showSuccess(lang === 'ar' ? 'تم استرجاع النسخة الاحتياطية بنجاح وتحديث كافة البيانات!' : 'Sauvegarde restaurée avec succès !');
        } else {
          showError(lang === 'ar' ? 'ملف غير صالح! تأكد من اختيار ملف تم تصديره مسبقاً من هذا البرنامج.' : 'Fichier de sauvegarde invalide.');
        }
      } catch (err) {
        showError(lang === 'ar' ? 'خطأ في قراءة الملف: تنسيق JSON غير سليم.' : 'Erreur de lecture du fichier JSON.');
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  const triggerExport = () => {
    onExportBackup();
    showSuccess(lang === 'ar' ? 'تم تصدير ملف النسخة الاحتياطية وحفظه على جهازك بنجاح.' : 'Fichier de sauvegarde exporté avec succès.');
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12 animate-fade-in text-start" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header Notification Toast */}
      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 px-5 py-3.5 rounded-2xl text-sm font-bold flex items-center gap-3 animate-fade-in shadow-xs">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="bg-rose-50 border border-rose-200 text-rose-900 px-5 py-3.5 rounded-2xl text-sm font-bold flex items-center gap-3 animate-fade-in shadow-xs">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main Header Banner */}
      <div className="bg-white p-6 sm:p-7 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div className="flex items-start sm:items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0 shadow-2xs">
            <Database className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              {lang === 'ar' ? 'إدارة البيانات والنسخ الاحتياطي' : 'Backup & Data Management'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 font-medium leading-relaxed max-w-2xl">
              {lang === 'ar' 
                ? 'تصدير واسترجاع قاعدة البيانات الكاملة للمتجر بأمان وحفظ نسخ دورية لحماية معاملاتك من الضياع.' 
                : 'Safely export and restore full database backups, and manage your local data snapshots with confidence.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start md:self-center shrink-0">
          <span className="px-3.5 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>{lang === 'ar' ? 'قاعدة بيانات آمنة' : 'Database Secure'}</span>
          </span>
        </div>
      </div>

      {/* Database Live Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center gap-3.5">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 block uppercase">
              {lang === 'ar' ? 'المنتجات المسجلة' : 'Products'}
            </span>
            <span className="text-lg sm:text-xl font-black text-slate-900 font-mono">
              {productsCount}
            </span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center gap-3.5">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 block uppercase">
              {lang === 'ar' ? 'فواتير المبيعات' : 'Invoices'}
            </span>
            <span className="text-lg sm:text-xl font-black text-slate-900 font-mono">
              {invoicesCount}
            </span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center gap-3.5">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 block uppercase">
              {lang === 'ar' ? 'الزبائن المسجلون' : 'Customers'}
            </span>
            <span className="text-lg sm:text-xl font-black text-slate-900 font-mono">
              {customersCount}
            </span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center gap-3.5">
          <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 block uppercase">
              {lang === 'ar' ? 'سجل الموردين' : 'Suppliers'}
            </span>
            <span className="text-lg sm:text-xl font-black text-slate-900 font-mono">
              {suppliersCount}
            </span>
          </div>
        </div>
      </div>

      {/* Operations Grid: Export vs Import */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Card 1: Export Backup */}
        <div className="bg-white p-6 sm:p-7 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col justify-between gap-6 group hover:border-slate-300 transition">
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Download className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900">
                {lang === 'ar' ? 'تصدير نسخة احتياطية كاملة' : 'Export Full Database Backup'}
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 font-medium leading-relaxed">
                {lang === 'ar' 
                  ? 'يقوم هذا الخيار بإنشاء ملف بصيغة JSON يحوي جميع بيانات المتجر، المبيعات، المخزون، والديون لتخزينه في مكان آمن على حاسوبك أو فلاش ميموري.' 
                  : 'Download a complete JSON snapshot containing all products, sales history, debts, and store configuration to keep offline.'}
              </p>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
            <span className="text-xs font-mono font-bold text-slate-400">
              Format: .JSON
            </span>
            <button
              id="btn-export-backup"
              type="button"
              onClick={triggerExport}
              className="w-full sm:w-auto px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm transition duration-150 shadow-xs cursor-pointer flex items-center justify-center gap-2 active:scale-95"
            >
              <Download className="w-4.5 h-4.5" />
              <span>{lang === 'ar' ? 'تنزيل وحفظ النسخة الاحتياطية' : 'Download Backup File'}</span>
            </button>
          </div>
        </div>

        {/* Card 2: Import Backup */}
        <div className="bg-white p-6 sm:p-7 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col justify-between gap-6 group hover:border-slate-300 transition">
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Upload className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900">
                {lang === 'ar' ? 'استرجاع نسخة احتياطية سابقة' : 'Restore from Backup File'}
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 font-medium leading-relaxed">
                {lang === 'ar' 
                  ? 'حدد ملف نسخة احتياطية (.json) محفوظ مسبقاً لاسترجاع كافة المنتجات والمعاملات إلى النظام فوراً وبشكل متكامل.' 
                  : 'Select an existing JSON backup file generated by this system to restore complete store data and continue working seamlessly.'}
              </p>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
            <span className="text-xs font-mono font-bold text-slate-400">
              Extension: .JSON
            </span>

            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json,text/plain"
              className="hidden"
              onChange={handleFileImport}
              id="backup-file-picker"
            />

            <button
              id="btn-import-backup-wrap"
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full sm:w-auto px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-sm transition duration-150 shadow-xs cursor-pointer flex items-center justify-center gap-2 active:scale-95"
            >
              <Upload className="w-4.5 h-4.5 text-emerald-400" />
              <span>{lang === 'ar' ? 'اختيار ملف الاسترجاع (JSON)' : 'Choose & Restore File'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Safety Instructions & Best Practices */}
      <div className="bg-slate-100/70 p-5 sm:p-6 rounded-3xl border border-slate-200/80 space-y-3">
        <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
          <Info className="w-4.5 h-4.5 text-indigo-600" />
          <span>{lang === 'ar' ? 'إرشادات الأمان والممارسات الموصى بها:' : 'Security Recommendations & Best Practices:'}</span>
        </div>
        <ul className="text-xs sm:text-sm text-slate-600 space-y-1.5 font-medium list-disc list-inside">
          <li>
            {lang === 'ar' 
              ? 'يُوصى بأخذ نسخة احتياطية بشكل دوري (أسبوعياً أو في نهاية كل شهر) لتجنب فقدان أي بيانات عند تغيير الجهاز أو مسح المتصفح.' 
              : 'Take periodic backups (weekly or monthly) to protect your sales records and customer debts.'}
          </li>
          <li>
            {lang === 'ar' 
              ? 'احفظ الملفات المستخرجة على وسيط تخزين خارجي (USB Drive) أو على حساب Google Drive / Dropbox الخاص بك.' 
              : 'Store exported backups on external drives or cloud storage like Google Drive.'}
          </li>
          <li>
            {lang === 'ar' 
              ? 'لا تقم بتعديل كود ملف JSON يدوياً في محرر نصوص لتفادي تلف بنية البيانات عند الاسترجاع.' 
              : 'Do not modify JSON backup files manually to prevent corruption during restore.'}
          </li>
        </ul>
      </div>

      {/* Danger Zone: Factory Reset */}
      <div className="bg-rose-50/50 p-6 sm:p-7 rounded-3xl border border-rose-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-rose-700 font-black text-base">
            <ShieldAlert className="w-5 h-5 text-rose-600" />
            <span>{lang === 'ar' ? 'منطقة العمليات الحساسة (فرمتة وإعادة تعيين النظام)' : 'Danger Zone: Factory System Reset'}</span>
          </div>
          <p className="text-xs sm:text-sm text-rose-600/90 font-medium max-w-2xl leading-relaxed">
            {lang === 'ar' 
              ? 'حذف جميع الفواتير والمبيعات وديون الزبائن والمنتجات وإعادة ضبط المتجر إلى الإعدادات الأولية الفارغة. لا يمكن التراجع عن هذا الإجراء.' 
              : 'Erase all transactions, invoices, customers, and inventory to restore application to initial factory default state.'}
          </p>
        </div>

        {isAdmin ? (
          <button
            id="btn-reset-db-trigger"
            type="button"
            onClick={() => setShowResetDialog(true)}
            className="px-6 py-3 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-sm transition duration-150 shadow-xs cursor-pointer flex items-center justify-center gap-2 shrink-0 active:scale-95"
          >
            <RefreshCw className="w-4.5 h-4.5" />
            <span>{lang === 'ar' ? 'فرمتة وإعادة تعيين البيانات' : 'Reset Database'}</span>
          </button>
        ) : (
          <span className="px-4 py-2 bg-slate-200 text-slate-600 font-bold rounded-xl text-xs">
            {lang === 'ar' ? 'صلاحية محصورة بالمدير فقط' : 'Admin privilege required'}
          </span>
        )}
      </div>

      {/* Reset Confirmation Modal */}
      {showResetDialog && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden p-6 sm:p-7 space-y-5 text-start" dir={isRTL ? 'rtl' : 'ltr'}>
            <div className="flex items-center gap-3 text-rose-600 pb-3 border-b border-slate-100">
              <div className="p-2.5 bg-rose-50 rounded-2xl">
                <ShieldAlert className="w-6 h-6 text-rose-600" />
              </div>
              <div>
                <h3 className="text-base font-black text-rose-950">
                  {lang === 'ar' ? 'تأكيد فرمتة وإعادة تعيين النظام' : 'Confirm Factory Reset'}
                </h3>
                <span className="text-xs text-rose-500 font-bold">
                  {lang === 'ar' ? 'إجراء لا يمكن التراجع عنه' : 'Irreversible Action'}
                </span>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-slate-600 font-medium leading-relaxed">
              {lang === 'ar' 
                ? 'هل أنت متأكد تماماً من رغبتك في حذف كافة المعاملات الحالية وتصفير قاعدة البيانات؟ يُنصح بتصدير نسخة احتياطية أولاً قبل المتابعة.' 
                : 'Are you sure you want to clear all data and reset the database? Make sure you have downloaded a backup copy first.'}
            </p>

            <div className="bg-rose-50 text-xs text-rose-800 p-4 rounded-2xl border border-rose-200 font-bold leading-relaxed">
              ⚠️ {lang === 'ar' 
                ? 'تحذير: سيتم حذف جميع المبيعات والفواتير والمنتجات المضافة والزبائن نهائياً.' 
                : 'Warning: All sales invoices, products, and customer balances will be permanently removed.'}
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                id="btn-confirm-reset-cancel"
                type="button"
                onClick={() => setShowResetDialog(false)}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs sm:text-sm transition cursor-pointer"
              >
                {t.inventory.cancel}
              </button>
              <button
                id="btn-confirm-reset-action"
                type="button"
                onClick={async () => {
                  setShowResetDialog(false);
                  try {
                    await onResetToDefaults();
                    showSuccess(
                      lang === 'ar'
                        ? 'تمت فرمتة قاعدة البيانات وإعادة ضبط النظام من الصفر بنجاح!'
                        : 'La base de données a été formatée et réinitialisée avec succès !'
                    );
                  } catch (err) {
                    showError(
                      lang === 'ar'
                        ? 'حدث خطأ أثناء فرمتة البيانات.'
                        : 'Erreur lors de la réinitialisation.'
                    );
                  }
                }}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs sm:text-sm transition cursor-pointer flex items-center gap-2 shadow-xs active:scale-95"
              >
                <RefreshCw className="w-4 h-4" />
                <span>{lang === 'ar' ? 'نعم، فرمتة النظام الآن' : 'Confirm Reset'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
