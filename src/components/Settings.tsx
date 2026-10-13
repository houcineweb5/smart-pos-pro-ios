/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { StoreConfig, Language, ActivityLog, Employee } from '../types';
import { languages } from '../languages';
import { compressImageFile } from '../utils/cloudSync';
import { 
  Settings as SettingsIcon, Save, Upload, 
  Palette, Building2, Coins, Keyboard, Check,
  Printer, FileText, Eye, CheckSquare, Square,
  Sparkles, Sliders, LayoutTemplate, MessageSquare
} from 'lucide-react';
import { A4_PRINT_THEMES } from '../utils/printService';

interface SettingsProps {
  config: StoreConfig;
  onSaveConfig: (config: StoreConfig) => void;
  onImportBackup?: (importedData: any) => void;
  onExportBackup?: () => void;
  onResetToDefaults?: () => void;
  lang: Language;
  logs?: ActivityLog[];
  currentUser?: Employee | null;
}

export default function Settings({ 
  config, 
  onSaveConfig, 
  lang, 
  currentUser 
}: SettingsProps) {
  const t = languages[lang];
  const isRTL = t.direction === 'rtl';

  // Keep logo always empty by default as requested
  const [formConfig, setFormConfig] = useState<StoreConfig>(() => ({
    ...config,
    logoUrl: (config.logoUrl && !config.logoUrl.includes('images.unsplash.com')) ? config.logoUrl : ''
  }));

  useEffect(() => {
    setFormConfig({
      ...config,
      logoUrl: (config.logoUrl && !config.logoUrl.includes('images.unsplash.com')) ? config.logoUrl : ''
    });
  }, [config]);

  const [successMsg, setSuccessMsg] = useState('');
  const [previewDocType, setPreviewDocType] = useState<'a4' | 'receipt'>('a4');

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageFile(file, 260, 0.78);
      setFormConfig((prev) => ({ ...prev, logoUrl: compressed }));
    } catch {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        setFormConfig((prev) => ({ ...prev, logoUrl: base64 }));
      };
      reader.readAsDataURL(file);
    }
  };

  const removeLogo = () => {
    setFormConfig((prev) => ({ ...prev, logoUrl: '' }));
  };

  // User hotkeys setup states
  const [sellAndPrintKey, setSellAndPrintKey] = useState(() => {
    const userId = currentUser?.id || 'general';
    const saved = localStorage.getItem(`pos_hotkeys_${userId}`);
    if (saved) {
      try { return JSON.parse(saved).sellAndPrint || 'F1'; } catch(e) {}
    }
    return 'F1';
  });

  const [showReceiptKey, setShowReceiptKey] = useState(() => {
    const userId = currentUser?.id || 'general';
    const saved = localStorage.getItem(`pos_hotkeys_${userId}`);
    if (saved) {
      try { return JSON.parse(saved).showReceipt || 'F2'; } catch(e) {}
    }
    return 'F2';
  });

  const [sellDirectKey, setSellDirectKey] = useState(() => {
    const userId = currentUser?.id || 'general';
    const saved = localStorage.getItem(`pos_hotkeys_${userId}`);
    if (saved) {
      try { return JSON.parse(saved).sellDirect || 'Enter'; } catch(e) {}
    }
    return 'Enter';
  });

  // Sync hotkeys with selected user if currentUser changes
  useEffect(() => {
    const userId = currentUser?.id || 'general';
    const saved = localStorage.getItem(`pos_hotkeys_${userId}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSellAndPrintKey(parsed.sellAndPrint || 'F1');
        setShowReceiptKey(parsed.showReceipt || 'F2');
        setSellDirectKey(parsed.sellDirect || 'Enter');
      } catch (e) {}
    } else {
      setSellAndPrintKey('F1');
      setShowReceiptKey('F2');
      setSellDirectKey('Enter');
    }
  }, [currentUser]);

  const saveHotkeySettings = () => {
    const userId = currentUser?.id || 'general';
    const keysObj = {
      sellAndPrint: sellAndPrintKey,
      showReceipt: showReceiptKey,
      sellDirect: sellDirectKey
    };
    localStorage.setItem(`pos_hotkeys_${userId}`, JSON.stringify(keysObj));
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    onSaveConfig(formConfig);
    saveHotkeySettings();
    setSuccessMsg(t.settings.updateSuccess);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12 animate-fade-in text-start" id="settings-sec" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* 1. Modern Header (Without duplicate top save button as requested) */}
      <div className="bg-white p-6 sm:p-7 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0 shadow-2xs">
            <SettingsIcon className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 leading-tight tracking-tight">
              {t.settings.title}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 font-medium">
              {lang === 'ar' ? 'إدارة هوية المتجر، العملة، نسبة الضرائب، المظهر العام واختصارات لوحة المفاتيح' : 'Manage store profile, currency, tax rates, theme, and shortcuts'}
            </p>
          </div>
        </div>
      </div>

      {successMsg && (
        <div id="settings-success" className="bg-emerald-50 border border-emerald-200 text-emerald-900 px-5 py-3.5 rounded-2xl text-sm font-bold flex items-center gap-3 animate-fade-in shadow-xs">
          <Check className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Floating Save Toast - Always visible regardless of page scroll position */}
      {successMsg && (
        <div className="fixed bottom-6 start-6 z-50 bg-slate-900 text-white border border-emerald-500/40 px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 animate-fade-in text-sm font-black">
          <div className="w-7 h-7 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center shrink-0 shadow-xs">
            <Check className="w-4 h-4 stroke-[3]" />
          </div>
          <span>{successMsg}</span>
          <button
            type="button"
            onClick={() => setSuccessMsg('')}
            className="ms-3 text-slate-400 hover:text-white text-base font-bold transition cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Settings Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Store Profile & Identity */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="px-6 py-4.5 border-b border-slate-100 flex items-center gap-3 bg-slate-50/50">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900">
                {lang === 'ar' ? 'معلومات وهُوِيّة المنشأة' : 'Store Information & Profile'}
              </h2>
              <p className="text-xs text-slate-400 font-medium">
                {lang === 'ar' ? 'البيانات الرسمية التي تظهر على الفواتير والمطبوعات' : 'Official details printed on receipts & invoices'}
              </p>
            </div>
          </div>

          <div className="p-6 sm:p-7 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
              <div>
                <label className="block text-xs sm:text-sm font-bold text-slate-700 mb-1.5">{t.settings.storeName}</label>
                <input
                  id="set-s-name"
                  required
                  type="text"
                  value={formConfig.name}
                  onChange={(e) => setFormConfig({ ...formConfig, name: e.target.value })}
                  className="w-full px-4 py-2.5 sm:py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 font-semibold text-sm bg-slate-50/40 focus:bg-white transition"
                />
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-bold text-slate-700 mb-1.5">{t.settings.storePhone}</label>
                <input
                  id="set-s-phone"
                  required
                  type="text"
                  value={formConfig.phone}
                  onChange={(e) => setFormConfig({ ...formConfig, phone: e.target.value })}
                  className="w-full px-4 py-2.5 sm:py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 text-sm font-mono bg-slate-50/40 focus:bg-white transition"
                />
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-bold text-slate-700 mb-1.5">{t.settings.storeEmail}</label>
                <input
                  id="set-s-email"
                  required
                  type="email"
                  value={formConfig.email}
                  onChange={(e) => setFormConfig({ ...formConfig, email: e.target.value })}
                  className="w-full px-4 py-2.5 sm:py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 text-sm bg-slate-50/40 focus:bg-white transition"
                />
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-bold text-slate-700 mb-1.5">{t.settings.registrationNumber}</label>
                <input
                  id="set-s-reg"
                  type="text"
                  placeholder={lang === 'ar' ? 'رقم السجل التجاري / ICE (اختياري)' : 'Registration / Tax ID (Optional)'}
                  value={formConfig.registrationNumber || ''}
                  onChange={(e) => setFormConfig({ ...formConfig, registrationNumber: e.target.value })}
                  className="w-full px-4 py-2.5 sm:py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-slate-800 text-sm bg-slate-50/40 focus:bg-white transition"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs sm:text-sm font-bold text-slate-700 mb-1.5">{t.settings.storeAddress}</label>
                <input
                  id="set-s-address"
                  type="text"
                  value={formConfig.address}
                  onChange={(e) => setFormConfig({ ...formConfig, address: e.target.value })}
                  className="w-full px-4 py-2.5 sm:py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 text-sm bg-slate-50/40 focus:bg-white transition"
                />
              </div>
            </div>

            {/* Store Logo - Simplified, clean & empty by default */}
            <div className="pt-4 border-t border-slate-100">
              <label className="block text-xs sm:text-sm font-bold text-slate-700 mb-2">
                {lang === 'ar' ? 'شعار المتجر (اختياري - يترك فارغاً افتراضياً)' : 'Store Logo (Optional - left empty by default)'}
              </label>

              <div className="flex flex-wrap items-center gap-3.5">
                <input
                  type="file"
                  id="store-logo-file-input"
                  accept="image/*"
                  className="hidden"
                  onChange={handleLogoUpload}
                />

                {formConfig.logoUrl ? (
                  <div className="flex items-center gap-3.5 bg-slate-50 p-2.5 rounded-2xl border border-slate-200">
                    <img
                      src={formConfig.logoUrl}
                      alt="Logo preview"
                      referrerPolicy="no-referrer"
                      className="w-12 h-12 object-contain bg-white rounded-xl border border-slate-200 p-1 shrink-0"
                    />
                    <div className="space-y-1">
                      <span className="text-xs font-bold text-slate-800 block truncate max-w-[200px]">
                        {lang === 'ar' ? 'تم تعيين الشعار بنجاح' : 'Logo is active'}
                      </span>
                      <div className="flex gap-2.5">
                        <button
                          type="button"
                          onClick={() => document.getElementById('store-logo-file-input')?.click()}
                          className="text-xs text-indigo-600 hover:text-indigo-800 font-bold cursor-pointer"
                        >
                          {lang === 'ar' ? 'تغيير' : 'Change'}
                        </button>
                        <span className="text-slate-300">•</span>
                        <button
                          type="button"
                          onClick={removeLogo}
                          className="text-xs text-rose-600 hover:text-rose-800 font-bold cursor-pointer"
                        >
                          {lang === 'ar' ? 'إزالة (فارغ)' : 'Remove (Clear)'}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => document.getElementById('store-logo-file-input')?.click()}
                      className="px-4 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold rounded-xl text-xs sm:text-sm transition flex items-center gap-2 cursor-pointer shadow-2xs"
                    >
                      <Upload className="w-4 h-4 text-indigo-600" />
                      <span>{lang === 'ar' ? 'رفع شعار' : 'Upload Logo'}</span>
                    </button>
                    <span className="text-xs text-slate-400 italic font-medium">
                      {lang === 'ar' ? '(لا يوجد شعار حالياً - فارغ)' : '(No logo configured - empty)'}
                    </span>
                  </div>
                )}

                {/* Optional URL field toggle or subtle input */}
                <div className="flex-1 min-w-[260px]">
                  <input
                    id="set-s-logo"
                    type="text"
                    placeholder={lang === 'ar' ? 'أو أدخل رابط الشعار مباشرة هنا (URL)' : 'Or enter logo direct image URL'}
                    value={formConfig.logoUrl || ''}
                    onChange={(e) => setFormConfig({ ...formConfig, logoUrl: e.target.value })}
                    className="w-full px-4 py-2 sm:py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-600 text-xs font-mono bg-slate-50/40"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Currency & Tax Settings */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="px-6 py-4.5 border-b border-slate-100 flex items-center gap-3 bg-slate-50/50">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900">
                {lang === 'ar' ? 'إعدادات العملة والضرائب' : 'Currency & Tax Configuration'}
              </h2>
              <p className="text-xs text-slate-400 font-medium">
                {lang === 'ar' ? 'تحديد العملة الافتراضية والنسبة المئوية لضريبة القيمة المضافة' : 'Set your default currency and VAT tax percentage'}
              </p>
            </div>
          </div>

          <div className="p-6 sm:p-7">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs sm:text-sm font-bold text-slate-700 mb-1.5">{t.settings.currency}</label>
                <select
                  id="get-s-curr"
                  value={formConfig.currency}
                  onChange={(e) => setFormConfig({ ...formConfig, currency: e.target.value })}
                  className="w-full px-4 py-2.5 sm:py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 font-bold text-sm bg-slate-50/40 cursor-pointer"
                >
                  <option value="MAD">MAD (درهم مغربي)</option>
                  <option value="DZD">DZD (دينار جزائري)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="USD">USD ($)</option>
                  <option value="SAR">SAR (ريال سعودي)</option>
                  <option value="AED">AED (درهم إماراتي)</option>
                  <option value="EGP">EGP (جنيه مصري)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-bold text-slate-700 mb-1.5">{t.settings.defaultTaxRate} (%)</label>
                <div className="relative">
                  <input
                    id="set-s-tax"
                    required
                    type="number"
                    min="0"
                    max="100"
                    value={formConfig.taxRate}
                    onChange={(e) => setFormConfig({ ...formConfig, taxRate: Number(e.target.value) })}
                    className="w-full px-4 py-2.5 sm:py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 font-bold text-sm bg-slate-50/40 font-mono"
                  />
                  <span className="absolute inset-y-0 ltr:right-4 rtl:left-4 flex items-center text-sm font-bold text-slate-400 pointer-events-none">
                    %
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Themes & Colors */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="px-6 py-4.5 border-b border-slate-100 flex items-center gap-3 bg-slate-50/50">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <Palette className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900">
                {lang === 'ar' ? 'سمة ولون واجهة البرنامج' : 'App Theme Color & Accent'}
              </h2>
              <p className="text-xs text-slate-400 font-medium">
                {lang === 'ar' ? 'تخصيص لون الأزرار والمؤشرات والبطاقات' : 'Customize buttons and highlight color accents'}
              </p>
            </div>
          </div>

          <div className="p-6 sm:p-7 space-y-3.5">
            <p className="text-xs sm:text-sm text-slate-500 font-medium">
              {lang === 'ar' ? 'اختر اللون الرئيسي للبرنامج لتخصيص الأزرار والمؤشرات والبطاقات:' : 'Select your primary application accent color:'}
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
              {[
                { id: 'indigo', nameAr: 'كلاسيكي (نيلي)', nameEn: 'Classic (Indigo)', bg: 'bg-indigo-600' },
                { id: 'sky', nameAr: 'أزرق سماوي', nameEn: 'Sky Blue', bg: 'bg-sky-500' },
                { id: 'emerald', nameAr: 'أخضر زمردي', nameEn: 'Emerald Green', bg: 'bg-emerald-600' },
                { id: 'rose', nameAr: 'وردي / أحمر', nameEn: 'Rose Red', bg: 'bg-rose-600' },
                { id: 'amber', nameAr: 'كهرماني دافئ', nameEn: 'Warm Amber', bg: 'bg-amber-500' },
              ].map((theme) => {
                const currentTheme = formConfig.themeColor || 'indigo';
                const isSelected = currentTheme === theme.id || (theme.id === 'indigo' && (currentTheme === 'slate' || currentTheme === 'navy'));
                return (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => {
                      const updated = { ...formConfig, themeColor: theme.id };
                      setFormConfig(updated);
                      onSaveConfig(updated);
                    }}
                    className={`flex items-center gap-3 p-3.5 rounded-2xl border text-sm font-bold transition cursor-pointer text-start ${
                      isSelected
                        ? 'bg-slate-50 border-indigo-600 text-slate-900 shadow-sm ring-2 ring-indigo-500/20'
                        : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <span className={`w-5 h-5 rounded-full ${theme.bg} shrink-0 ring-2 ring-white shadow-2xs`} />
                    <span className="truncate flex-1">{lang === 'ar' ? theme.nameAr : theme.nameEn}</span>
                    {isSelected && <Check className="w-4.5 h-4.5 text-indigo-600 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Section 4: Dedicated Print Customization & Invoice Design Menu */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden" id="section-print-customization">
          <div className="px-6 py-4.5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-slate-50 to-indigo-50/30">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-xs">
                <Printer className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
                  <span>{lang === 'ar' ? 'تخصيص وتصميم فواتير الطباعة (A4 والإيصالات)' : 'Invoice & Receipt Print Design & Layout'}</span>
                  <span className="text-[10px] bg-indigo-100 text-indigo-700 font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                    {lang === 'ar' ? 'قائمة متقدمة' : 'Pro Layout'}
                  </span>
                </h2>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  {lang === 'ar' ? 'تحكم كامل بألوان الطباعة، العناصر المعروضة، التذييل، والمعاينة الحية' : 'Full control over print palettes, visible fields, footers, and live layout preview'}
                </p>
              </div>
            </div>

            {/* Live Preview Toggle Pill */}
            <div className="flex items-center gap-1.5 bg-white p-1 rounded-2xl border border-slate-200 shadow-2xs">
              <button
                type="button"
                onClick={() => setPreviewDocType('a4')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  previewDocType === 'a4'
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>{lang === 'ar' ? 'معاينة A4' : 'A4 Preview'}</span>
              </button>
              <button
                type="button"
                onClick={() => setPreviewDocType('receipt')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  previewDocType === 'receipt'
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <Printer className="w-3.5 h-3.5" />
                <span>{lang === 'ar' ? 'معاينة 80mm' : '80mm Preview'}</span>
              </button>
            </div>
          </div>

          <div className="p-6 sm:p-7 space-y-7">
            {/* 1. Large Invoice A4 Themes & Custom Color Picker */}
            <div className="space-y-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-indigo-600" />
                  <h3 className="text-sm font-black text-slate-800">
                    {lang === 'ar' ? 'ألوان وسمات الفواتير الكبيرة (A4 الرسمية والتجارية):' : 'Large Invoice Palettes (A4 Official Documents):'}
                  </h3>
                </div>
                <span className="text-[11px] text-slate-400 font-semibold">
                  {lang === 'ar' ? 'تنطبق على طباعة الكمبيوتر وتقارير المبيعات والأرباح وتطبيق iPhone' : 'Applies to desktop print, reports, and iPhone export'}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {[
                  { id: 'slate', nameAr: 'رمادي تنفيذي', nameEn: 'Executive Slate', dotBg: 'bg-slate-900', hex: '#0f172a' },
                  { id: 'indigo', nameAr: 'أزرق ملكي (نيلي)', nameEn: 'Royal Indigo', dotBg: 'bg-indigo-700', hex: '#4338ca' },
                  { id: 'emerald', nameAr: 'أخضر زمردي', nameEn: 'Emerald Green', dotBg: 'bg-emerald-700', hex: '#065f46' },
                  { id: 'burgundy', nameAr: 'عنابي / خمري', nameEn: 'Burgundy Wine', dotBg: 'bg-rose-900', hex: '#9f1239' },
                  { id: 'amber', nameAr: 'كهرماني دافئ', nameEn: 'Warm Amber', dotBg: 'bg-amber-600', hex: '#b45309' },
                ].map((th) => {
                  const isCurrent = (formConfig.a4Theme || 'slate') === th.id;
                  return (
                    <button
                      key={th.id}
                      type="button"
                      onClick={() => {
                        const updated: StoreConfig = { ...formConfig, a4Theme: th.id as any, printPrimaryColor: th.hex };
                        setFormConfig(updated);
                        onSaveConfig(updated);
                      }}
                      className={`flex flex-col gap-2 p-3.5 rounded-2xl border text-start transition cursor-pointer ${
                        isCurrent
                          ? 'bg-slate-50 border-indigo-600 text-slate-900 shadow-sm ring-2 ring-indigo-500/20'
                          : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`w-4 h-4 rounded-full ${th.dotBg} ring-2 ring-white shadow-2xs`} />
                        {isCurrent && <Check className="w-4 h-4 text-indigo-600" />}
                      </div>
                      <span className="text-xs font-bold truncate">
                        {lang === 'ar' ? th.nameAr : th.nameEn}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Custom hex color input */}
              <div className="flex flex-wrap items-center gap-3 p-3 bg-slate-50/70 border border-slate-200/80 rounded-2xl">
                <span className="text-xs font-bold text-slate-700">
                  {lang === 'ar' ? 'أو اختر درجة لون مخصصة (Custom Hex):' : 'Or choose custom accent color (Hex):'}
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={formConfig.printPrimaryColor || (A4_PRINT_THEMES[formConfig.a4Theme || 'slate']?.primary || '#0f172a')}
                    onChange={(e) => {
                      const updated = { ...formConfig, printPrimaryColor: e.target.value };
                      setFormConfig(updated);
                      onSaveConfig(updated);
                    }}
                    className="w-8 h-8 rounded-lg cursor-pointer border border-slate-300 bg-transparent p-0.5"
                    title={lang === 'ar' ? 'انقر لاختيار لون مخصص' : 'Click to pick custom color'}
                  />
                  <input
                    type="text"
                    value={formConfig.printPrimaryColor || ''}
                    placeholder="#4338ca"
                    onChange={(e) => {
                      const updated = { ...formConfig, printPrimaryColor: e.target.value };
                      setFormConfig(updated);
                      onSaveConfig(updated);
                    }}
                    className="w-28 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold uppercase focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>

            {/* 2. 80mm Thermal Receipt Themes */}
            <div className="pt-5 border-t border-slate-100 space-y-3.5">
              <div className="flex items-center gap-2">
                <Printer className="w-4 h-4 text-slate-600" />
                <h3 className="text-sm font-black text-slate-800">
                  {lang === 'ar' ? 'نمط وألوان الفواتير الصغيرة (الإيصال الحراري 80mm):' : 'Small Thermal Receipt Styles (80mm):'}
                </h3>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {[
                  { id: 'classic', nameAr: 'كلاسيكي (أبيض وأسود)', nameEn: 'Classic (B&W)', dotBg: 'bg-slate-900' },
                  { id: 'navy', nameAr: 'كحلي أنيق', nameEn: 'Navy Blue', dotBg: 'bg-blue-900' },
                  { id: 'emerald', nameAr: 'أخضر زمردي', nameEn: 'Emerald Green', dotBg: 'bg-emerald-700' },
                  { id: 'modern', nameAr: 'بنفسجي عصري', nameEn: 'Indigo Modern', dotBg: 'bg-indigo-600' },
                  { id: 'minimal', nameAr: 'بسيط رمادي', nameEn: 'Minimal Slate', dotBg: 'bg-slate-500' },
                ].map((th) => {
                  const isCurrent = (formConfig.receiptTheme || 'classic') === th.id;
                  return (
                    <button
                      key={th.id}
                      type="button"
                      onClick={() => {
                        const updated = { ...formConfig, receiptTheme: th.id as any };
                        setFormConfig(updated);
                        onSaveConfig(updated);
                      }}
                      className={`flex flex-col gap-2 p-3.5 rounded-2xl border text-start transition cursor-pointer ${
                        isCurrent
                          ? 'bg-slate-50 border-indigo-600 text-slate-900 shadow-sm ring-2 ring-indigo-500/20'
                          : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`w-4 h-4 rounded-full ${th.dotBg} ring-2 ring-white shadow-2xs`} />
                        {isCurrent && <Check className="w-4 h-4 text-indigo-600" />}
                      </div>
                      <span className="text-xs font-bold truncate">
                        {lang === 'ar' ? th.nameAr : th.nameEn}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. Invoice Elements Visibility (Show / Hide toggles) */}
            <div className="pt-5 border-t border-slate-100 space-y-3.5">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm font-black text-slate-800">
                  {lang === 'ar' ? 'عناصر ومعلومات الفاتورة المطبوعة (إظهار / إخفاء):' : 'Printed Invoice Elements (Show / Hide):'}
                </h3>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                {lang === 'ar' ? 'حدد الحقول والمعلومات التي ترغب في ظهورها أو إخفائها عند طباعة الفواتير:' : 'Select which fields should appear on printed receipts and invoices:'}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  {
                    key: 'showLogoOnInvoice' as const,
                    labelAr: 'شعار المحل (Logo)',
                    labelEn: 'Store Logo',
                    defaultVal: true
                  },
                  {
                    key: 'showPhoneOnInvoice' as const,
                    labelAr: 'رقم هاتف المحل والزبون',
                    labelEn: 'Store & Customer Phone',
                    defaultVal: true
                  },
                  {
                    key: 'showAddressOnInvoice' as const,
                    labelAr: 'عنوان المحل والفرع',
                    labelEn: 'Store Address',
                    defaultVal: true
                  },
                  {
                    key: 'showEmailOnInvoice' as const,
                    labelAr: 'البريد الإلكتروني',
                    labelEn: 'Email Address',
                    defaultVal: true
                  },
                  {
                    key: 'showTaxNumberOnInvoice' as const,
                    labelAr: 'السجل التجاري / ICE',
                    labelEn: 'Commercial Reg / ICE',
                    defaultVal: true
                  },
                  {
                    key: 'showCashierOnInvoice' as const,
                    labelAr: 'اسم الكاشير / البائع',
                    labelEn: 'Cashier / Seller Name',
                    defaultVal: true
                  },
                  {
                    key: 'showBarcodeOnInvoice' as const,
                    labelAr: 'باركود الفاتورة (Code-39)',
                    labelEn: 'Invoice Barcode (Code-39)',
                    defaultVal: true
                  },
                  {
                    key: 'showDebtOnInvoice' as const,
                    labelAr: 'تفاصيل الكريدي والديون',
                    labelEn: 'Debts & Remaining Balance',
                    defaultVal: true
                  },
                ].map((item) => {
                  const isChecked = formConfig[item.key] !== false;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => {
                        const updated = { ...formConfig, [item.key]: !isChecked };
                        setFormConfig(updated);
                        onSaveConfig(updated);
                      }}
                      className={`flex items-center justify-between p-3 rounded-2xl border text-start transition cursor-pointer ${
                        isChecked
                          ? 'bg-indigo-50/60 border-indigo-300 text-indigo-950 font-black shadow-2xs'
                          : 'bg-slate-50/50 border-slate-200 text-slate-500 font-semibold'
                      }`}
                    >
                      <span className="text-xs">{lang === 'ar' ? item.labelAr : item.labelEn}</span>
                      {isChecked ? (
                        <CheckSquare className="w-4.5 h-4.5 text-indigo-600 shrink-0" />
                      ) : (
                        <Square className="w-4.5 h-4.5 text-slate-400 shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 4. Custom Footer Texts & Return Policy */}
            <div className="pt-5 border-t border-slate-100 space-y-4">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm font-black text-slate-800">
                  {lang === 'ar' ? 'تذييل ورسائل الفاتورة المخصصة (Footer Messages):' : 'Custom Invoice Footers & Policies:'}
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    {lang === 'ar' ? 'رسالة الشكر والترحيب أسفل الفاتورة:' : 'Footer Thank You Message:'}
                  </label>
                  <input
                    type="text"
                    value={formConfig.receiptFooterMessage || ''}
                    placeholder={lang === 'ar' ? 'شكراً لزيارتكم ومرحباً بكم دائماً!' : 'Thank you for your business!'}
                    onChange={(e) => {
                      const updated = { ...formConfig, receiptFooterMessage: e.target.value };
                      setFormConfig(updated);
                    }}
                    className="w-full px-3.5 py-2.5 bg-slate-50/60 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    {lang === 'ar' ? 'سياسة الإرجاع والاستبدال أو الضمان:' : 'Return & Warranty Policy Note:'}
                  </label>
                  <input
                    type="text"
                    value={formConfig.receiptReturnPolicy || ''}
                    placeholder={lang === 'ar' ? 'البضاعة المباعة ترد وتستبدل خلال 3 أيام مع إحضار الفاتورة' : 'Items can be exchanged within 3 days with receipt'}
                    onChange={(e) => {
                      const updated = { ...formConfig, receiptReturnPolicy: e.target.value };
                      setFormConfig(updated);
                    }}
                    className="w-full px-3.5 py-2.5 bg-slate-50/60 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition"
                  />
                </div>
              </div>
            </div>

            {/* 5. Live Interactive Preview Card */}
            <div className="pt-5 border-t border-slate-100 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-emerald-600" />
                  <h3 className="text-sm font-black text-slate-800">
                    {lang === 'ar' ? 'معاينة حية ومباشرة لشكل الفاتورة:' : 'Live Interactive Print Preview:'}
                  </h3>
                </div>
                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                  {lang === 'ar' ? 'تحديث فوري مع التعديلات' : 'Real-time Preview'}
                </span>
              </div>

              {/* Mini Preview Box */}
              <div className="bg-slate-100 p-4 sm:p-6 rounded-2xl flex justify-center items-center">
                {previewDocType === 'a4' ? (
                  // Mini A4 Preview
                  <div
                    className="bg-white rounded-xl shadow-md border p-5 w-full max-w-lg text-start space-y-3 font-sans transition-all"
                    style={{ borderColor: (A4_PRINT_THEMES[formConfig.a4Theme || 'slate'] || A4_PRINT_THEMES.slate).border }}
                  >
                    {/* Top row */}
                    <div className="flex justify-between items-start pb-3 border-b" style={{ borderColor: (A4_PRINT_THEMES[formConfig.a4Theme || 'slate'] || A4_PRINT_THEMES.slate).border }}>
                      <div className="space-y-1">
                        {formConfig.showLogoOnInvoice !== false && formConfig.logoUrl && (
                          <img src={formConfig.logoUrl} alt="Logo" className="h-7 object-contain mb-1" />
                        )}
                        <h4 className="font-black text-sm" style={{ color: formConfig.printPrimaryColor || (A4_PRINT_THEMES[formConfig.a4Theme || 'slate'] || A4_PRINT_THEMES.slate).primary }}>
                          {formConfig.name || 'اسم المحل التجاري'}
                        </h4>
                        {formConfig.showAddressOnInvoice !== false && formConfig.address && (
                          <p className="text-[10px] text-slate-500">{formConfig.address}</p>
                        )}
                        {formConfig.showPhoneOnInvoice !== false && formConfig.phone && (
                          <p className="text-[10px] text-slate-500">Tél: {formConfig.phone}</p>
                        )}
                      </div>
                      <div className="text-end space-y-1">
                        <span className="text-[10px] font-mono font-black px-2 py-0.5 rounded text-white" style={{ backgroundColor: formConfig.printPrimaryColor || (A4_PRINT_THEMES[formConfig.a4Theme || 'slate'] || A4_PRINT_THEMES.slate).primary }}>
                          FAC-2026-001
                        </span>
                        <p className="text-[10px] text-slate-400 font-mono">10/10/2026</p>
                        <p className="text-[10px] font-bold text-slate-800">الزبون: زبون تجريبي</p>
                      </div>
                    </div>

                    {/* Table mini */}
                    <div className="rounded-lg overflow-hidden border" style={{ borderColor: (A4_PRINT_THEMES[formConfig.a4Theme || 'slate'] || A4_PRINT_THEMES.slate).border }}>
                      <table className="w-full text-[10px]">
                        <thead style={{ backgroundColor: (A4_PRINT_THEMES[formConfig.a4Theme || 'slate'] || A4_PRINT_THEMES.slate).accentBg }}>
                          <tr className="font-bold" style={{ color: formConfig.printPrimaryColor || (A4_PRINT_THEMES[formConfig.a4Theme || 'slate'] || A4_PRINT_THEMES.slate).primary }}>
                            <th className="p-1.5 text-start">الصنف</th>
                            <th className="p-1.5 text-center">الكمية</th>
                            <th className="p-1.5 text-center">السعر</th>
                            <th className="p-1.5 text-end">المجموع</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          <tr>
                            <td className="p-1.5">منتج تجريبي رقم 1</td>
                            <td className="p-1.5 text-center font-mono">2</td>
                            <td className="p-1.5 text-center font-mono">150.00</td>
                            <td className="p-1.5 text-end font-mono font-bold">300.00 {formConfig.currency}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Totals */}
                    <div className="flex justify-between items-center pt-2 text-xs font-black">
                      <span className="text-slate-600">المجموع الصافي:</span>
                      <span className="font-mono text-sm" style={{ color: formConfig.printPrimaryColor || (A4_PRINT_THEMES[formConfig.a4Theme || 'slate'] || A4_PRINT_THEMES.slate).primary }}>
                        300.00 {formConfig.currency}
                      </span>
                    </div>

                    {/* Barcode */}
                    {formConfig.showBarcodeOnInvoice !== false && (
                      <div className="text-center pt-2">
                        <div className="inline-block px-3 py-1 bg-slate-50 border border-slate-200 rounded font-mono text-[9px] font-black tracking-widest">
                          ||||| | |||| ||| | ||||| FAC-2026-001
                        </div>
                      </div>
                    )}

                    {/* Footer note */}
                    <div className="text-center text-[10px] text-slate-500 font-bold pt-2 border-t border-slate-100">
                      {formConfig.receiptFooterMessage || 'شكراً لتعاملكم معنا ومرحباً بكم في أي وقت!'}
                    </div>
                  </div>
                ) : (
                  // Mini 80mm Receipt Preview
                  <div className="bg-white rounded-lg shadow-md border border-slate-300 p-4 w-64 text-center space-y-2 font-mono text-[10px] transition-all">
                    {formConfig.showLogoOnInvoice !== false && formConfig.logoUrl && (
                      <img src={formConfig.logoUrl} alt="Logo" className="h-6 object-contain mx-auto mb-1" />
                    )}
                    <h4 className="font-black text-xs text-slate-900">{formConfig.name || 'اسم المحل'}</h4>
                    {formConfig.showPhoneOnInvoice !== false && formConfig.phone && <p className="text-[9px] text-slate-500">Tél: {formConfig.phone}</p>}
                    <div className="border-t border-dashed border-slate-300 pt-1 text-[9px] flex justify-between">
                      <span>FAC-2026-001</span>
                      <span>10/10/2026</span>
                    </div>
                    <div className="border-t border-dashed border-slate-300 py-1 text-[9px] text-start">
                      <div className="flex justify-between font-bold">
                        <span>منتج تجريبي x2</span>
                        <span>300.00 {formConfig.currency}</span>
                      </div>
                    </div>
                    <div className="border-t border-dashed border-slate-300 pt-1 flex justify-between font-black text-[11px] text-slate-900">
                      <span>TOTAL:</span>
                      <span>300.00 {formConfig.currency}</span>
                    </div>
                    {formConfig.showBarcodeOnInvoice !== false && (
                      <div className="py-1 tracking-widest text-[9px] font-bold">
                        ||||| | |||| ||| | |||||
                      </div>
                    )}
                    <div className="border-t border-dashed border-slate-300 pt-1 text-[9px] text-slate-500">
                      {formConfig.receiptFooterMessage || 'شكراً لزيارتكم!'}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Section 5: Keyboard Shortcuts & Cashier Hotkeys */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="px-6 py-4.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                <Keyboard className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-black text-slate-900">
                  {lang === 'ar' ? 'اختصارات لوحة المفاتيح لنقطة البيع (الكاشير)' : 'POS Checkout Keyboard Shortcuts'}
                </h2>
                <p className="text-xs text-slate-400 font-medium">
                  {lang === 'ar' ? 'أزرار سريعة لتسهيل وتسريع عمليات البيع' : 'Quick hotkeys to speed up sales checkout operations'}
                </p>
              </div>
            </div>
            <span className="text-xs px-3 py-1 rounded-xl bg-slate-100 text-slate-700 font-bold border border-slate-200">
              {currentUser ? currentUser.name : (lang === 'ar' ? 'المستخدم العام' : 'General User')}
            </span>
          </div>

          <div className="p-6 sm:p-7 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5">
              <div>
                <label className="block text-xs sm:text-sm font-bold text-slate-700 mb-1.5">
                  {lang === 'ar' ? 'البيع مع الطباعة المباشرة' : 'Sell & Print Receipt'}
                </label>
                <select
                  id="shortcut-sell-print-select"
                  value={formConfig.shortcutSellPrint || 'F1'}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFormConfig({ ...formConfig, shortcutSellPrint: val });
                    setSellAndPrintKey(val);
                  }}
                  className="w-full px-4 py-2.5 sm:py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 font-bold text-sm bg-slate-50/40 cursor-pointer"
                >
                  {['F1', 'F2', 'F3', 'F4', 'F6', 'F7', 'F8', 'F9', 'F10', 'Enter', 'Space'].map(k => (
                    <option key={k} value={k}>{k}</option>
                  ))}
                </select>
                <p className="text-xs text-slate-400 mt-1.5 font-medium">
                  {lang === 'ar' ? 'إتمام البيع وتشغيل الطابعة فوراً' : 'Instantly complete sale & print receipt'}
                </p>
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-bold text-slate-700 mb-1.5">
                  {lang === 'ar' ? 'عرض ومعاينة الفاتورة' : 'Show Invoice Preview'}
                </label>
                <select
                  id="shortcut-show-receipt-select"
                  value={formConfig.shortcutShowReceipt || 'F2'}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFormConfig({ ...formConfig, shortcutShowReceipt: val });
                    setShowReceiptKey(val);
                  }}
                  className="w-full px-4 py-2.5 sm:py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 font-bold text-sm bg-slate-50/40 cursor-pointer"
                >
                  {['F1', 'F2', 'F3', 'F4', 'F6', 'F7', 'F8', 'F9', 'F10', 'Enter', 'Space'].map(k => (
                    <option key={k} value={k}>{k}</option>
                  ))}
                </select>
                <p className="text-xs text-slate-400 mt-1.5 font-medium">
                  {lang === 'ar' ? 'فتح شاشة المعاينة قبل الطباعة' : 'Preview receipt before printing'}
                </p>
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-bold text-slate-700 mb-1.5">
                  {lang === 'ar' ? 'البيع السريع المباشر (صامت)' : 'Direct Silent Checkout'}
                </label>
                <select
                  id="shortcut-sell-noreceipt-select"
                  value={formConfig.shortcutSellNoReceipt || 'Enter'}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFormConfig({ ...formConfig, shortcutSellNoReceipt: val });
                    setSellDirectKey(val);
                  }}
                  className="w-full px-4 py-2.5 sm:py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 font-bold text-sm bg-slate-50/40 cursor-pointer"
                >
                  {['F1', 'F2', 'F3', 'F4', 'F6', 'F7', 'F8', 'F9', 'F10', 'Enter', 'Space'].map(k => (
                    <option key={k} value={k}>{k}</option>
                  ))}
                </select>
                <p className="text-xs text-slate-400 mt-1.5 font-medium">
                  {lang === 'ar' ? 'إفراغ السلة وتسجيل البيع بدون نوافذ' : 'Fast checkout without opening modals'}
                </p>
              </div>
            </div>

            {/* Hidden inputs to preserve existing automated test IDs */}
            <input type="hidden" id="hotkey-sell-print-input" value={sellAndPrintKey} />
            <input type="hidden" id="hotkey-show-receipt-input" value={showReceiptKey} />
            <input type="hidden" id="hotkey-sell-direct-input" value={sellDirectKey} />
            <button type="button" id="btn-save-hotkeys" className="hidden" onClick={saveHotkeySettings} />
          </div>
        </div>

        {/* Bottom Save Bar (The sole, prominent save button with inline feedback) */}
        <div className="pt-3 flex flex-wrap items-center justify-between gap-3">
          {successMsg ? (
            <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-black flex items-center gap-2 animate-fade-in shadow-xs">
              <Check className="w-4.5 h-4.5 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          ) : <div />}
          <button
            id="sumbit-set-btn"
            type="submit"
            className="flex items-center gap-2.5 px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl text-sm transition duration-150 shadow-md hover:shadow-lg cursor-pointer active:scale-95 ms-auto"
          >
            <Save className="w-4.5 h-4.5" />
            <span>{t.settings.save}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
