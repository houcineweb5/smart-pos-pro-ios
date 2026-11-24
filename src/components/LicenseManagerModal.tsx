/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Language } from '../types';
import { KeyRound, ShieldCheck, ShieldAlert, Copy, Check, MessageCircle, AlertCircle, X, Sparkles } from 'lucide-react';

interface LicenseManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  onActivated?: () => void;
  isBlocking?: boolean;
}

export interface LicenseStatusData {
  isActivated: boolean;
  machineId: string;
  firstLaunchDate: string;
  daysRemaining: number;
  isTrialExpired: boolean;
  invoiceCount: number;
  maxTrialInvoices: number;
  invoicesRemaining: number;
  customerName?: string;
  activatedAt?: string;
}

export default function LicenseManagerModal({
  isOpen,
  onClose,
  lang,
  onActivated,
  isBlocking = false
}: LicenseManagerModalProps) {
  if (!isOpen) return null;

  const isRTL = lang === 'ar';

  const [licenseData, setLicenseData] = useState<LicenseStatusData | null>(null);
  const [activationKey, setActivationKey] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/license/status');
      if (res.ok) {
        const data = await res.json();
        setLicenseData(data);
      }
    } catch {
      // Local fallback
    }
  };

  useEffect(() => {
    fetchStatus();
  }, [isOpen]);

  const copyMachineId = () => {
    if (licenseData?.machineId) {
      navigator.clipboard.writeText(licenseData.machineId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!activationKey.trim()) {
      setErrorMsg(isRTL ? 'يرجى إدخال مفتاح التفعيل.' : 'Please enter license key.');
      return;
    }

    try {
      setIsLoading(true);
      const token = localStorage.getItem('smartpos_auth_token') || '';
      const res = await fetch('/api/license/activate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          key: activationKey.trim(),
          customerName: customerName.trim()
        })
      });

      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.message || (isRTL ? 'مفتاح التفعيل غير صحيح.' : 'Invalid license key.'));
      }

      setSuccessMsg(result.message || (isRTL ? 'تم تفعيل البرنامج بنجاح!' : 'Activated successfully!'));
      await fetchStatus();
      if (onActivated) onActivated();
      setTimeout(() => {
        if (!isBlocking) onClose();
      }, 1800);
    } catch (err: any) {
      setErrorMsg(err.message || 'Activation failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
      <div 
        className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        {/* Header */}
        <div className={`p-6 text-white flex items-start justify-between ${
          licenseData?.isActivated 
            ? 'bg-gradient-to-r from-emerald-600 to-teal-700' 
            : licenseData?.isTrialExpired 
              ? 'bg-gradient-to-r from-rose-600 to-red-700' 
              : 'bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700'
        }`}>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/20 backdrop-blur-xs rounded-2xl">
              {licenseData?.isActivated ? (
                <ShieldCheck className="w-6 h-6 text-emerald-200" />
              ) : (
                <KeyRound className="w-6 h-6 text-amber-200" />
              )}
            </div>
            <div>
              <h3 className="text-xl font-black">
                {isRTL ? 'ترخيص وتفعيل SmartPOS Pro' : 'SmartPOS Pro Licensing'}
              </h3>
              <p className="text-white/80 text-xs font-medium">
                {licenseData?.isActivated 
                  ? (isRTL ? 'النسخة مرخصة تجارياً مدى الحياة' : 'Lifetime Commercial License')
                  : (isRTL ? 'إدارة ترخيص هذا الجهاز' : 'Manage device license')}
              </p>
            </div>
          </div>

          {!isBlocking && (
            <button
              onClick={onClose}
              className="p-1.5 bg-white/10 hover:bg-white/20 rounded-xl transition cursor-pointer text-white"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="p-6 space-y-5">
          {/* Status Badge */}
          <div className={`p-4 rounded-2xl border flex items-center gap-3.5 ${
            licenseData?.isActivated
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : licenseData?.isTrialExpired
                ? 'bg-rose-50 border-rose-200 text-rose-900'
                : 'bg-amber-50 border-amber-200 text-amber-900'
          }`}>
            {licenseData?.isActivated ? (
              <ShieldCheck className="w-6 h-6 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-6 h-6 text-amber-600 shrink-0" />
            )}
            <div className="text-xs">
              <span className="font-black text-sm block">
                {licenseData?.isActivated
                  ? (isRTL ? '🟢 نسخة مرخصة تجارياً (مفعّلة مدى الحياة)' : '🟢 Licensed (Lifetime Active)')
                  : licenseData?.isTrialExpired
                    ? (isRTL ? '🔴 انتهت الفترة التجريبية' : '🔴 Trial Expired')
                    : (isRTL ? '🟡 نسخة تجريبية نشطة' : '🟡 Active Trial')}
              </span>
              {!licenseData?.isActivated && (
                <span className="font-medium text-slate-600 block mt-0.5">
                  {isRTL
                    ? `متبقي: ${licenseData?.daysRemaining ?? 15} يوماً / ${licenseData?.invoicesRemaining ?? 50} فاتورة تجريبية`
                    : `Remaining: ${licenseData?.daysRemaining ?? 15} days / ${licenseData?.invoicesRemaining ?? 50} invoices`}
                </span>
              )}
              {licenseData?.isActivated && licenseData?.customerName && (
                <span className="text-emerald-700 font-bold block mt-0.5">
                  {isRTL ? `مرخص باسم: ${licenseData.customerName}` : `Licensed to: ${licenseData.customerName}`}
                </span>
              )}
            </div>
          </div>

          {/* Machine ID Box */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-black text-slate-700">
                {isRTL ? 'معرف الجهاز الفريد (Machine ID):' : 'Unique Machine ID:'}
              </label>
              <button
                type="button"
                onClick={copyMachineId}
                className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-lg transition cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? (isRTL ? 'تم النسخ!' : 'Copied!') : (isRTL ? 'نسخ المعرف' : 'Copy')}</span>
              </button>
            </div>
            <div className="p-2.5 bg-white border border-slate-200 rounded-xl font-mono text-center font-black text-base text-slate-800 tracking-wider">
              {licenseData?.machineId || 'SPOS-COMM-2026-UNQ1'}
            </div>
            <p className="text-[11px] text-slate-400 mt-2">
              {isRTL
                ? '💡 أرسل هذا الكود إلى المطور أو فريق المبيعات للحصول على مفتاح التفعيل الرسمي لجهازك.'
                : '💡 Send this code to support or sales to receive your activation key.'}
            </p>
          </div>

          {/* Activation Form (Only if not activated) */}
          {!licenseData?.isActivated && (
            <form onSubmit={handleActivate} className="space-y-3.5 pt-1 border-t border-slate-100">
              <h4 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-indigo-600" />
                <span>{isRTL ? 'إدخال مفتاح التفعيل:' : 'Enter License Key:'}</span>
              </h4>

              {errorMsg && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-bold">
                  {errorMsg}
                </div>
              )}

              {successMsg && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 font-bold flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>{successMsg}</span>
                </div>
              )}

              <input
                type="text"
                value={activationKey}
                onChange={(e) => setActivationKey(e.target.value.toUpperCase())}
                placeholder="ACTV-XXXX-XXXX-XXXX"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono font-black text-center text-slate-800 tracking-widest uppercase focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />

              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder={isRTL ? 'اسم العميل / المتجر (اختياري)' : 'Customer / Store Name (Optional)'}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer active:scale-98 disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>{isLoading ? (isRTL ? 'جاري التحقق والتفعيل...' : 'Activating...') : (isRTL ? '✨ تفعيل البرنامج الآن' : '✨ Activate License Now')}</span>
              </button>
            </form>
          )}

          {/* Support / Purchase Info */}
          <div className="bg-gradient-to-r from-slate-900 to-indigo-950 p-4 rounded-2xl text-white text-xs space-y-2">
            <div className="flex items-center gap-2 text-amber-400 font-black">
              <MessageCircle className="w-4 h-4" />
              <span>{isRTL ? 'الدعم الفني وشراء التراخيص الرسمية:' : 'Support & Official Licenses:'}</span>
            </div>
            <p className="text-slate-300 leading-relaxed text-[11px]">
              {isRTL
                ? 'لطلب رخص إضافية، تحديثات النظام، أو الدعم الفني المباشر، يمكنك التواصل معنا عبر الواتساب أو الهاتف مباشرة.'
                : 'For licenses, updates, or direct technical support, contact us directly via WhatsApp or phone.'}
            </p>
            <div className="pt-1 flex items-center gap-2 font-mono text-emerald-400 font-bold">
              <span>WhatsApp / Support: 0677212982 (+212 677 212 982)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
