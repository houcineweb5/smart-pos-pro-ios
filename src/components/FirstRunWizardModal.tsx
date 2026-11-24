/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { StoreConfig, Language } from '../types';
import { Building2, Coins, Phone, MapPin, FileText, Lock, Sparkles, Check } from 'lucide-react';

interface FirstRunWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: StoreConfig;
  onComplete: (updatedConfig: StoreConfig, newPassword?: string) => Promise<void>;
  lang: Language;
}

export default function FirstRunWizardModal({
  isOpen,
  onClose,
  config,
  onComplete,
  lang
}: FirstRunWizardModalProps) {
  if (!isOpen) return null;

  const isRTL = lang === 'ar';

  const [storeName, setStoreName] = useState(config.name === 'Smart Pos' ? '' : config.name);
  const [currency, setCurrency] = useState(config.currency || 'MAD');
  const [phone, setPhone] = useState(config.phone || '');
  const [address, setAddress] = useState(config.address || '');
  const [taxNumber, setTaxNumber] = useState(config.taxNumber || '');
  const [registrationNumber, setRegistrationNumber] = useState(config.registrationNumber || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const currencies = [
    { code: 'DZD', label: 'د.ج (دينار جزائري)' },
    { code: 'MAD', label: 'د.م (درهم مغربي)' },
    { code: 'SAR', label: 'ر.س (ريال سعودي)' },
    { code: 'AED', label: 'د.إ (درهم إماراتي)' },
    { code: 'TND', label: 'د.ت (دينار تونسي)' },
    { code: 'EGP', label: 'ج.م (جنيه مصري)' },
    { code: 'USD', label: '$ (دولار أمريكي)' },
    { code: 'EUR', label: '€ (يورو)' }
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!storeName.trim()) {
      setErrorMsg(isRTL ? 'يرجى إدخال اسم المتجر أو المؤسسة.' : 'Please enter store name.');
      return;
    }

    if (newPassword && newPassword.length < 4) {
      setErrorMsg(isRTL ? 'كلمة المرور يجب أن لا تقل عن 4 خانات.' : 'Password must be at least 4 characters.');
      return;
    }

    if (newPassword && newPassword !== confirmPassword) {
      setErrorMsg(isRTL ? 'كلمتا المرور غير متطابقتين.' : 'Passwords do not match.');
      return;
    }

    try {
      setIsSubmitting(true);
      const updatedConfig: StoreConfig = {
        ...config,
        name: storeName.trim(),
        currency: currency.trim(),
        phone: phone.trim(),
        address: address.trim(),
        taxNumber: taxNumber.trim(),
        registrationNumber: registrationNumber.trim(),
        isConfigured: true
      };

      await onComplete(updatedConfig, newPassword.trim() || undefined);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error saving setup');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
      <div 
        className="w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        {/* Header Banner */}
        <div className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 p-6 sm:p-7 text-white">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 bg-white/20 backdrop-blur-xs rounded-2xl">
              <Sparkles className="w-6 h-6 text-amber-300" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black">
                {isRTL ? 'مرحباً بك في SmartPOS Pro' : 'Welcome to SmartPOS Pro'}
              </h2>
              <p className="text-indigo-100 text-xs sm:text-sm font-medium">
                {isRTL ? 'معالج الإعداد الأولي للمتجر وضبط بيانات الفواتير الرسمية' : 'Initial setup wizard for store info and official invoices'}
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 sm:p-7 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-bold">
              {errorMsg}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Store Name */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                <span>{isRTL ? 'اسم المتجر أو المؤسسة التجارية *' : 'Store / Business Name *'}</span>
              </label>
              <input
                type="text"
                required
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                placeholder={isRTL ? 'مثال: سوبرماركت الأمل أو مؤسسة النور' : 'e.g. Al-Amal Market'}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Currency */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Coins className="w-3.5 h-3.5 text-indigo-600" />
                <span>{isRTL ? 'عملة التعامل الافتراضية *' : 'Default Currency *'}</span>
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {currencies.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Phone */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-indigo-600" />
                <span>{isRTL ? 'رقم الهاتف للتواصل' : 'Phone Number'}</span>
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0600000000"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
              />
            </div>

            {/* Address */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-indigo-600" />
                <span>{isRTL ? 'عنوان المحل / المقر' : 'Store Address'}</span>
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder={isRTL ? 'المدينة، الشارع، رقم المحل' : 'City, Street'}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Tax and Registration */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-indigo-600" />
                <span>{isRTL ? 'الرقم الضريبي / السجل التجاري' : 'Tax / Registration No'}</span>
              </label>
              <input
                type="text"
                value={taxNumber}
                onChange={(e) => setTaxNumber(e.target.value)}
                placeholder="RC / IF / NIF"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-indigo-600" />
                <span>{isRTL ? 'رقم التعريف الموحد (ICE / NIS)' : 'Unique Company ID'}</span>
              </label>
              <input
                type="text"
                value={registrationNumber}
                onChange={(e) => setRegistrationNumber(e.target.value)}
                placeholder="ICE / NIS"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Admin Password Change (Security Protection) */}
          <div className="pt-2 border-t border-slate-200 mt-4">
            <h4 className="text-xs font-black text-slate-800 mb-2.5 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-amber-600" />
              <span>{isRTL ? 'تأمين حساب المدير العام (موصى به بشدة):' : 'Secure Admin Account:'}</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder={isRTL ? 'كلمة مرور جديدة للمدير' : 'New Admin Password'}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={isRTL ? 'تأكيد كلمة المرور' : 'Confirm Password'}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
            <p className="text-[11px] text-slate-400 mt-1.5">
              {isRTL 
                ? '💡 اتركها فارغة إذا كنت تريد الاحتفاظ بكلمة المرور الحالية.' 
                : '💡 Leave blank if you want to keep the current password.'}
            </p>
          </div>

          {/* Action Button */}
          <div className="pt-4 flex items-center justify-end gap-3">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm rounded-2xl shadow-lg shadow-indigo-600/30 transition flex items-center justify-center gap-2 cursor-pointer active:scale-98 disabled:opacity-50"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>{isSubmitting ? (isRTL ? 'جاري الحفظ...' : 'Saving...') : (isRTL ? '🚀 حفظ وبدء استخدام البرنامج' : '🚀 Save & Start Using')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
