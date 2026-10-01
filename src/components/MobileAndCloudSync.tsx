/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Language, StoreConfig } from '../types';
import {
  CloudSyncConfig,
  getCloudSyncConfig,
  saveCloudSyncConfig,
  pushDataToCloud,
  pullDataFromCloud,
  mergeStoreDatasets,
  encodePairingCode,
  decodePairingCode,
} from '../utils/cloudSync';
import CameraBarcodeModal from './CameraBarcodeModal';
import {
  Smartphone,
  Cloud,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Copy,
  Download,
  Wifi,
  QrCode,
  UploadCloud,
  DownloadCloud,
  ExternalLink,
  ScanBarcode,
  Server,
  Camera,
  Sparkles,
  Share2,
  Layers,
} from 'lucide-react';

interface MobileAndCloudSyncProps {
  allData: any;
  onUpdateAllData: (mergedData: any) => void;
  config: StoreConfig;
  lang: Language;
  deferredInstallPrompt?: any;
  onTriggerInstall?: () => void;
}

export default function MobileAndCloudSync({
  allData,
  onUpdateAllData,
  config,
  lang,
  deferredInstallPrompt,
  onTriggerInstall,
}: MobileAndCloudSyncProps) {
  const isRTL = lang === 'ar';

  const [syncCfg, setSyncCfg] = useState<CloudSyncConfig>(() => getCloudSyncConfig());
  const [localIps, setLocalIps] = useState<string[]>([]);
  const [port, setPort] = useState<number>(3000);
  const [isSyncing, setIsSyncing] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  const [pastePairingInput, setPastePairingInput] = useState('');
  const [showQrScanner, setShowQrScanner] = useState(false);
  const [showIosInstallGuide, setShowIosInstallGuide] = useState(false);
  const [qrTargetMode, setQrTargetMode] = useState<'full' | 'lite'>('full');

  useEffect(() => {
    fetch('/api/network-info')
      .then((res) => (res.ok ? res.json() : null))
      .then((info) => {
        if (info && Array.isArray(info.ips)) {
          setLocalIps(info.ips);
          if (info.port) setPort(info.port);
        }
      })
      .catch(() => {});
  }, []);

  const showNotice = (text: string, type: 'success' | 'error' = 'success') => {
    setStatusMsg({ text, type });
    setTimeout(() => {
      setStatusMsg((prev) => (prev?.text === text ? null : prev));
    }, 5000);
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    saveCloudSyncConfig(syncCfg);
    showNotice(
      lang === 'ar'
        ? '✓ تم حفظ إعدادات المزامنة وتطبيق الهاتف الذكي بنجاح!'
        : '✓ Cloud sync and mobile settings saved!'
    );
  };

  const handlePushNow = async () => {
    setIsSyncing(true);
    const nextCfg = { ...syncCfg, enabled: true };
    setSyncCfg(nextCfg);
    saveCloudSyncConfig(nextCfg);
    const res = await pushDataToCloud(allData, nextCfg);
    setIsSyncing(false);
    if (res.ok) {
      setSyncCfg(getCloudSyncConfig());
      showNotice(
        lang === 'ar'
          ? '☁️ تم رفع ومزامنة كافة بيانات البرنامج (المنتجات، الفواتير، الزبائن، الصيانة، الوثائق) بنجاح!'
          : '☁️ All store data pushed and synchronized successfully!'
      );
    } else {
      showNotice(res.error || 'فشل الاتصال بالسحابة أو السيرفر', 'error');
    }
  };

  const handlePullAndMergeNow = async (customCfg?: CloudSyncConfig) => {
    const activeCfg = customCfg || { ...syncCfg, enabled: true };
    setIsSyncing(true);
    saveCloudSyncConfig(activeCfg);
    const res = await pullDataFromCloud(activeCfg);
    if (!res.ok) {
      setIsSyncing(false);
      showNotice(res.error || 'فشل سحب البيانات', 'error');
      return;
    }
    if (!res.payload || !res.payload.data) {
      setIsSyncing(false);
      showNotice(
        lang === 'ar'
          ? 'لا توجد بيانات مرفوعة بعد؛ اضغط "رفع البيانات الآن" من الحاسوب أولاً.'
          : 'No remote data found yet; push data first.',
        'error'
      );
      return;
    }

    const { merged, hasNewFromCloud } = mergeStoreDatasets(allData, res.payload.data, true);
    onUpdateAllData(merged);
    await pushDataToCloud(merged, activeCfg);
    setIsSyncing(false);
    setSyncCfg(getCloudSyncConfig());

    showNotice(
      lang === 'ar'
        ? hasNewFromCloud
          ? '✅ تم سحب ودمج كافة البيانات والتحديثات بين الهاتف والحاسوب بنجاح!'
          : '✓ البيانات متطابقة ومحدثة بالكامل على جميع الأجهزة!'
        : '✓ Data synchronized across all devices!'
    );
  };

  const handleApplyPastedPairingCode = async (rawCode: string) => {
    let codeToDecode = rawCode.trim();
    // If user scanned a full URL containing ?pair=...
    if (codeToDecode.includes('pair=')) {
      try {
        const u = new URL(codeToDecode);
        codeToDecode = u.searchParams.get('pair') || codeToDecode;
      } catch {
        const match = codeToDecode.match(/pair=([^&]+)/);
        if (match && match[1]) codeToDecode = decodeURIComponent(match[1]);
      }
    }

    const decoded = decodePairingCode(codeToDecode);
    if (!decoded) {
      showNotice(
        lang === 'ar' ? '❌ كود الربط غير صالح، تأكد من نسخه بشكل صحيح' : 'Invalid pairing code',
        'error'
      );
      return;
    }

    setSyncCfg(decoded);
    saveCloudSyncConfig(decoded);
    setPastePairingInput('');
    showNotice(
      lang === 'ar'
        ? '🔗 تم ربط الهاتف بنجاح! جاري سحب ومزامنة بيانات المتجر الآن...'
        : '🔗 Phone paired! Pulling store data now...'
    );
    await handlePullAndMergeNow(decoded);
  };

  const primaryIp = localIps[0] || window.location.hostname || 'localhost';
  const defaultServerOrigin =
    window.location.hostname === 'localhost' && localIps[0]
      ? `http://${localIps[0]}:${port}`
      : window.location.origin;

  const pairingCode = encodePairingCode(syncCfg, defaultServerOrigin);
  const fullAppUrlWithPair = `${defaultServerOrigin}/?pair=${encodeURIComponent(pairingCode)}`;
  const liteMobileUrlWithPair = `${defaultServerOrigin}/mobile.html?pair=${encodeURIComponent(pairingCode)}`;
  const activeQrUrl = qrTargetMode === 'full' ? fullAppUrlWithPair : liteMobileUrlWithPair;

  const handleCopyPairingCode = () => {
    navigator.clipboard.writeText(pairingCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const handleInstallOnPhoneClick = () => {
    if (deferredInstallPrompt && onTriggerInstall) {
      onTriggerInstall();
      return;
    }
    setShowIosInstallGuide(true);
  };

  const handleDownloadMobileAppHtml = async () => {
    try {
      const res = await fetch('/mobile.html');
      let html = await res.text();
      const preloadScript = `<script>try{localStorage.setItem('smartpos_cloud_sync_config_v1', ${JSON.stringify(
        JSON.stringify({ ...syncCfg, serverUrl: syncCfg.serverUrl || defaultServerOrigin, enabled: true })
      )});}catch(e){}</script>`;
      html = html.replace('</head>', `${preloadScript}</head>`);

      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'SmartPOS-Mobile-App.html';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showNotice(
        lang === 'ar'
          ? '📱 تم تحميل ملف تطبيق الهاتف الجاهز! يمكنك إرساله لهاتفك عبر واتساب أو تيليجرام وفتحه مباشرة.'
          : '📱 Mobile App downloaded!'
      );
    } catch {
      showNotice('تعذر تحميل ملف تطبيق الهاتف', 'error');
    }
  };

  const supabaseSql = `CREATE TABLE IF NOT EXISTS public.smartpos_sync (
  store_id text PRIMARY KEY,
  updated_at text,
  payload jsonb
);
ALTER TABLE public.smartpos_sync ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public sync" ON public.smartpos_sync FOR ALL USING (true) WITH CHECK (true);`;

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="space-y-6 max-w-6xl mx-auto text-start animate-fade-in pb-12">
      {statusMsg && (
        <div
          className={`fixed top-5 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl shadow-2xl border flex items-center gap-2.5 text-xs font-black ${
            statusMsg.type === 'success'
              ? 'bg-slate-900 text-emerald-400 border-emerald-500/40'
              : 'bg-slate-950 text-rose-400 border-rose-500/40'
          }`}
        >
          {statusMsg.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{statusMsg.text}</span>
        </div>
      )}

      {/* Hero Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-5 sm:p-6 rounded-3xl shadow-lg flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center shrink-0">
            <Smartphone className="w-7 h-7 text-indigo-300" />
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-[10px] font-black mb-1">
              <Sparkles className="w-3 h-3" />
              <span>ANDROID & iOS FULL NATIVE / PWA APP + REAL-TIME CLOUD SYNC</span>
            </div>
            <h1 className="text-lg sm:text-xl font-black tracking-tight">
              {lang === 'ar'
                ? 'تشغيل البرنامج الكامل على الهواتف الذكية (أندرويد وآيفون) والمزامنة الفورية'
                : 'Full Android & iPhone App + Real-Time Synchronization'}
            </h1>
            <p className="text-xs text-indigo-200 mt-1 font-medium leading-relaxed">
              {lang === 'ar'
                ? 'ثبّت البرنامج الكامل كتطبيق رسمي مستقل على هاتفك الأندرويد أو الآيفون بجميع الأقسام (نقطة البيع، المخزون، الفواتير، الصيانة، الوثائق، التقارير) مع مزامنة فورية!'
                : 'Install the full Smart POS app on Android & iPhone with real-time bi-directional sync'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0 w-full lg:w-auto">
          <button
            type="button"
            onClick={handleInstallOnPhoneClick}
            className="flex-1 sm:flex-initial px-4 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-black rounded-xl transition cursor-pointer flex items-center justify-center gap-2 shadow-sm"
          >
            <Smartphone className="w-4 h-4" />
            <span>{lang === 'ar' ? 'تثبيت التطبيق على الهاتف (Android / iPhone)' : 'Install App on Phone'}</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadMobileAppHtml}
            className="flex-1 sm:flex-initial px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black rounded-xl transition cursor-pointer flex items-center justify-center gap-2 shadow-sm"
          >
            <Download className="w-4 h-4" />
            <span>{lang === 'ar' ? 'تحميل ملف التطبيق المحمول' : 'Download Portable App'}</span>
          </button>
        </div>
      </div>

      {/* Quick Pairing Receiver Bar (For phones joining an existing store) */}
      <div className="bg-indigo-950 text-white p-4 sm:p-5 rounded-3xl border border-indigo-800/60 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div className="space-y-0.5">
          <div className="text-xs font-black text-indigo-200 flex items-center gap-2">
            <QrCode className="w-4 h-4 text-emerald-400" />
            <span>
              {lang === 'ar'
                ? 'هل فتحت البرنامج من هاتفك وتريد ربطه بالحاسوب أو بهاتف آخر فوراً؟'
                : 'Opened on your phone? Pair with your store in 1 click:'}
            </span>
          </div>
          <p className="text-[11px] text-slate-300 font-semibold">
            {lang === 'ar'
              ? 'الصق "كود الربط السريع" هنا أو امسح رمز QR من شاشة الحاسوب بالكاميرا ليتم ضبط المزامنة وسحب جميع السلع والفواتير تلقائياً!'
              : 'Paste the Pairing Code or scan the QR code from your PC screen to sync automatically!'}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <input
            type="text"
            dir="ltr"
            value={pastePairingInput}
            onChange={(e) => setPastePairingInput(e.target.value)}
            placeholder={lang === 'ar' ? 'الصق كود الربط Pairing Code هنا...' : 'Paste Pairing Code...'}
            className="w-full md:w-56 px-3.5 py-2.5 bg-slate-900/90 border border-indigo-700 rounded-xl text-xs font-mono text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400"
          />
          <button
            type="button"
            onClick={() => handleApplyPastedPairingCode(pastePairingInput)}
            className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-black cursor-pointer shrink-0 transition"
          >
            {lang === 'ar' ? 'ربط ومزامنة' : 'Pair Now'}
          </button>
          <button
            type="button"
            onClick={() => setShowQrScanner(true)}
            className="p-2.5 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-xl cursor-pointer shrink-0 transition"
            title={lang === 'ar' ? 'مسح رمز QR للربط بالكاميرا' : 'Scan Pairing QR'}
          >
            <Camera className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Column 1: Cloud & Server Sync Configuration (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <form onSubmit={handleSaveSettings} className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-100 shadow-xs space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <Cloud className="w-5 h-5 text-indigo-600" />
                <h2 className="text-base font-black text-slate-800">
                  {lang === 'ar' ? '1. إعدادات المزامنة التلقائية بين الهواتف والحاسوب' : '1. Auto Synchronization Settings'}
                </h2>
              </div>

              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={syncCfg.enabled}
                  onChange={(e) => {
                    const next = { ...syncCfg, enabled: e.target.checked };
                    setSyncCfg(next);
                    saveCloudSyncConfig(next);
                  }}
                  className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                />
                <span className="text-xs font-black text-indigo-700">
                  {lang === 'ar' ? 'تفعيل المزامنة التلقائية' : 'Enable Auto Sync'}
                </span>
              </label>
            </div>

            {/* 3 Provider Switcher */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => setSyncCfg({ ...syncCfg, provider: 'firebase', enabled: true })}
                className={`p-3 rounded-2xl border text-start transition cursor-pointer ${
                  syncCfg.provider === 'firebase'
                    ? 'border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-500/20'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="font-black text-xs text-slate-900">🔥 Firebase Cloud</div>
                <div className="text-[10.5px] text-slate-500 mt-0.5 font-semibold">
                  {lang === 'ar' ? 'مزامنة عبر الإنترنت من أي مكان (موصى به)' : 'Cloud Sync from anywhere'}
                </div>
              </button>

              <button
                type="button"
                onClick={() => setSyncCfg({ ...syncCfg, provider: 'supabase', enabled: true })}
                className={`p-3 rounded-2xl border text-start transition cursor-pointer ${
                  syncCfg.provider === 'supabase'
                    ? 'border-emerald-600 bg-emerald-50/60 ring-2 ring-emerald-500/20'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="font-black text-xs text-slate-900">⚡ Supabase Cloud</div>
                <div className="text-[10.5px] text-slate-500 mt-0.5 font-semibold">
                  {lang === 'ar' ? 'مزامنة سحابية عبر PostgreSQL' : 'Supabase PostgreSQL'}
                </div>
              </button>

              <button
                type="button"
                onClick={() =>
                  setSyncCfg({
                    ...syncCfg,
                    provider: 'server',
                    enabled: true,
                    serverUrl: syncCfg.serverUrl || defaultServerOrigin,
                  })
                }
                className={`p-3 rounded-2xl border text-start transition cursor-pointer ${
                  syncCfg.provider === 'server'
                    ? 'border-amber-600 bg-amber-50/60 ring-2 ring-amber-500/20'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="font-black text-xs text-slate-900 flex items-center gap-1">
                  <Server className="w-3.5 h-3.5 text-amber-600" />
                  <span>{lang === 'ar' ? 'مزامنة مباشرة (سيرفر/Wi-Fi)' : 'Direct Server / LAN'}</span>
                </div>
                <div className="text-[10.5px] text-slate-500 mt-0.5 font-semibold">
                  {lang === 'ar' ? 'بدون حساب خارجي — اتصال مباشر' : 'Zero-account direct sync'}
                </div>
              </button>
            </div>

            {syncCfg.provider === 'firebase' && (
              <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1">
                    {lang === 'ar' ? 'رابط Firebase Realtime Database URL:' : 'Firebase Database URL:'}
                  </label>
                  <input
                    type="url"
                    dir="ltr"
                    placeholder="https://your-project-default-rtdb.firebaseio.com"
                    value={syncCfg.firebaseUrl}
                    onChange={(e) => setSyncCfg({ ...syncCfg, firebaseUrl: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    {lang === 'ar' ? 'مفتاح الحماية السري Database Secret (اختياري):' : 'Database Secret (Optional):'}
                  </label>
                  <input
                    type="password"
                    dir="ltr"
                    placeholder="Optional Firebase Database Secret / Auth Token"
                    value={syncCfg.firebaseSecret || ''}
                    onChange={(e) => setSyncCfg({ ...syncCfg, firebaseSecret: e.target.value })}
                    className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="text-[11px] text-slate-600 bg-white p-3 rounded-xl border border-slate-200 leading-relaxed">
                  <b>💡 كيف تحصل على الرابط مجاناً في دقيقة؟</b> افتح موقع{' '}
                  <a href="https://console.firebase.google.com" target="_blank" rel="noreferrer" className="text-indigo-600 underline font-bold">
                    console.firebase.google.com
                  </a>{' '}
                  ← أنشئ مشروعاً مجانياً ← اختر <b>Realtime Database</b> ← اضغط <b>Create Database (Start in Test Mode)</b> ثم انسخ الرابط والصقه هنا!
                </div>
              </div>
            )}

            {syncCfg.provider === 'supabase' && (
              <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1">Supabase Project URL:</label>
                  <input
                    type="url"
                    dir="ltr"
                    placeholder="https://xyzcompany.supabase.co"
                    value={syncCfg.supabaseUrl || ''}
                    onChange={(e) => setSyncCfg({ ...syncCfg, supabaseUrl: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1">Supabase Anon Public Key:</label>
                  <input
                    type="password"
                    dir="ltr"
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6..."
                    value={syncCfg.supabaseKey || ''}
                    onChange={(e) => setSyncCfg({ ...syncCfg, supabaseKey: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div className="bg-white p-3 rounded-xl border border-slate-200 text-[11px] space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-700">كود إنشاء جدول المزامنة في Supabase SQL Editor:</span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(supabaseSql);
                        setCopiedSql(true);
                        setTimeout(() => setCopiedSql(false), 2000);
                      }}
                      className="text-indigo-600 font-bold hover:underline cursor-pointer"
                    >
                      {copiedSql ? '✓ تم النسخ' : 'نسخ SQL'}
                    </button>
                  </div>
                  <pre dir="ltr" className="bg-slate-900 text-emerald-300 p-2 rounded-lg text-[10px] overflow-x-auto font-mono">
                    {supabaseSql}
                  </pre>
                </div>
              </div>
            )}

            {syncCfg.provider === 'server' && (
              <div className="space-y-3 bg-amber-50/50 p-4 rounded-2xl border border-amber-200/80">
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1">
                    {lang === 'ar' ? 'رابط السيرفر الرئيسي أو الحاسوب (Server URL):' : 'Primary Server URL:'}
                  </label>
                  <input
                    type="url"
                    dir="ltr"
                    placeholder={`http://${primaryIp}:${port}`}
                    value={syncCfg.serverUrl || defaultServerOrigin}
                    onChange={(e) => setSyncCfg({ ...syncCfg, serverUrl: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-white border border-amber-300 rounded-xl text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <p className="text-[11px] text-amber-900 font-semibold leading-relaxed">
                  {lang === 'ar'
                    ? '✓ في هذا الوضع تتصل الهواتف الذكية (أندرويد وآيفون) مباشرة بقاعدة بيانات الحاسوب أو السيرفر بدون الحاجة لأي حساب سحابي خارجي!'
                    : '✓ Phones sync directly with the main server database.'}
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-black text-slate-700 mb-1">
                  {lang === 'ar' ? 'معرّف المتجر الموحد (Store Sync ID):' : 'Store Sync ID:'}
                </label>
                <input
                  type="text"
                  dir="ltr"
                  value={syncCfg.storeId}
                  onChange={(e) => setSyncCfg({ ...syncCfg, storeId: e.target.value })}
                  placeholder="store_01"
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800"
                />
              </div>

              <div className="flex items-end">
                <label className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 w-full cursor-pointer">
                  <input
                    type="checkbox"
                    checked={syncCfg.autoSync}
                    onChange={(e) => setSyncCfg({ ...syncCfg, autoSync: e.target.checked })}
                    className="w-4 h-4 accent-indigo-600 rounded"
                  />
                  <span className="text-xs font-bold text-slate-700">
                    {lang === 'ar' ? 'مزامنة فورية تلقائية بالخلفية (كل 8 ثوانٍ وعند كل عملية)' : 'Real-time Auto Sync'}
                  </span>
                </label>
              </div>
            </div>

            {syncCfg.lastSyncedAt && (
              <div className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-xl font-bold flex items-center justify-between">
                <span>✓ آخر مزامنة ناجحة بين الأجهزة:</span>
                <span className="font-mono">{new Date(syncCfg.lastSyncedAt).toLocaleString('ar-MA')}</span>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2.5 pt-2">
              <button
                type="submit"
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-black rounded-xl transition cursor-pointer"
              >
                {lang === 'ar' ? 'حفظ الإعدادات' : 'Save Settings'}
              </button>

              <button
                type="button"
                disabled={isSyncing}
                onClick={handlePushNow}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                <UploadCloud className={`w-4 h-4 ${isSyncing ? 'animate-bounce' : ''}`} />
                <span>{lang === 'ar' ? 'رفع ومزامنة البيانات الآن' : 'Push Data Now'}</span>
              </button>

              <button
                type="button"
                disabled={isSyncing}
                onClick={() => handlePullAndMergeNow()}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                <DownloadCloud className={`w-4 h-4 ${isSyncing ? 'animate-bounce' : ''}`} />
                <span>{lang === 'ar' ? 'سحب ودمج التحديثات من الهواتف' : 'Pull & Merge Updates'}</span>
              </button>
            </div>
          </form>

          {/* Native Android APK & iOS IPA Builder Card */}
          <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-100 shadow-xs space-y-3">
            <div className="flex items-center gap-2.5">
              <Layers className="w-5 h-5 text-indigo-600" />
              <h3 className="text-sm font-black text-slate-800">
                {lang === 'ar'
                  ? 'تشغيل البرنامج كتطبيق أصلي كامل على Android و iPhone (بدون متصفح)'
                  : 'Full Standalone Android & iOS Execution'}
              </h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
                <div className="font-black text-indigo-700">📲 1. التثبيت المباشر الفوري (PWA Standalone)</div>
                <p className="text-[11px] text-slate-600 leading-relaxed font-semibold">
                  عند فتح الرابط على هاتف <b>الأندرويد</b> أو <b>الآيفون</b>، اضغط زر <b>"تثبيت التطبيق على الهاتف"</b> لينزل البرنامج بأيقونته الرسمية على شاشة هاتفك ويشتغل بشاشة كاملة (Full Screen) وبدون إنترنت (Offline)!
                </p>
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
                <div className="font-black text-emerald-700">📦 2. بناء حزمة APK / iOS عبر Capacitor</div>
                <p className="text-[11px] text-slate-600 leading-relaxed font-semibold">
                  المشروع مهيأ بالكامل بملف <code className="font-mono bg-white px-1 rounded">capacitor.config.json</code>. لبناء ملف APK للأندرويد أو تطبيق iOS في أي وقت شغّل:
                  <code dir="ltr" className="block mt-1 font-mono text-[10px] bg-slate-900 text-emerald-300 p-1.5 rounded-lg">
                    npm run cap:add:android && npm run cap:sync
                  </code>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Column 2: Smartphone Pairing & QR Code (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-100 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <QrCode className="w-5 h-5 text-indigo-600" />
                <h2 className="text-base font-black text-slate-800">
                  {lang === 'ar' ? '2. فتح وتثبيت التطبيق على الهاتف' : '2. Pair & Install on Smartphone'}
                </h2>
              </div>
            </div>

            {/* Switch between Full Smart POS App vs Lightweight Mobile Companion */}
            <div className="grid grid-cols-2 gap-1.5 bg-slate-100 p-1 rounded-2xl">
              <button
                type="button"
                onClick={() => setQrTargetMode('full')}
                className={`py-2 px-2 rounded-xl text-[11px] font-black transition cursor-pointer ${
                  qrTargetMode === 'full' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600'
                }`}
              >
                {lang === 'ar' ? 'النسخة الكاملة للهاتف (جميع الأقسام)' : 'Full App (All Modules)'}
              </button>
              <button
                type="button"
                onClick={() => setQrTargetMode('lite')}
                className={`py-2 px-2 rounded-xl text-[11px] font-black transition cursor-pointer ${
                  qrTargetMode === 'lite' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600'
                }`}
              >
                {lang === 'ar' ? 'النسخة السريعة المحمولة' : 'Lite Companion App'}
              </button>
            </div>

            {/* QR Code for instant opening & pairing */}
            <div className="text-center bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-3">
              <div className="text-xs font-black text-slate-700 flex items-center justify-center gap-1.5">
                <Wifi className="w-4 h-4 text-emerald-600" />
                <span>
                  {lang === 'ar'
                    ? 'امسح رمز QR بكاميرا الأندرويد أو الآيفون لفتح وتثبيت التطبيق مربوطاً تلقائياً:'
                    : 'Scan QR with Android or iPhone camera:'}
                </span>
              </div>

              <div className="bg-white p-3 rounded-2xl border border-slate-200 inline-block shadow-2xs">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(activeQrUrl)}`}
                  alt="Mobile App QR"
                  className="w-44 h-44 mx-auto"
                />
              </div>

              <div className="space-y-1">
                <p className="text-[11px] text-slate-500 font-bold">
                  {lang === 'ar' ? 'رابط فتح التطبيق على الهاتف:' : 'Smartphone App URL:'}
                </p>
                <div
                  dir="ltr"
                  className="text-xs font-mono font-black text-indigo-600 bg-white px-3 py-2 rounded-xl border border-slate-200 break-all select-all"
                >
                  {qrTargetMode === 'full' ? `${defaultServerOrigin}/` : `${defaultServerOrigin}/mobile.html`}
                </div>
              </div>
            </div>

            {/* Instant Pairing Code for Cloud Anywhere */}
            <div className="bg-indigo-50/70 border border-indigo-200 p-4 rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-indigo-900">
                  {lang === 'ar' ? '🔑 كود الربط السريع (Pairing Code):' : '🔑 Instant Pairing Code:'}
                </span>
                <button
                  type="button"
                  onClick={handleCopyPairingCode}
                  className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-black rounded-lg flex items-center gap-1 cursor-pointer transition"
                >
                  <Copy className="w-3 h-3" />
                  <span>{copiedCode ? '✓ تم النسخ!' : 'نسخ الكود'}</span>
                </button>
              </div>
              <input
                type="text"
                readOnly
                dir="ltr"
                value={pairingCode}
                className="w-full px-3 py-2 bg-white border border-indigo-200 rounded-xl text-[11px] font-mono text-slate-700 select-all"
              />
              <p className="text-[11px] text-indigo-800 leading-relaxed font-semibold">
                {lang === 'ar'
                  ? 'إذا فتحت البرنامج على هاتفك من خارج المحل (عبر 4G/5G)، انسخ هذا الكود والصقه في خانة الربط بأعلى الصفحة ليتم ربط الهاتف بالسحابة فوراً!'
                  : 'Copy this code into the phone app to pair from anywhere over 4G/5G.'}
              </p>
            </div>

            {/* Wireless Barcode Feature Info */}
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-2.5 text-xs text-emerald-900">
              <ScanBarcode className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div className="leading-relaxed font-semibold">
                <b>ميزة الكاميرا كقارئ باركود:</b> يمكنك الآن من داخل <b>نقطة البيع (POS)</b> أو <b>المخزون</b> على هاتفك الضغط على زر <b>"مسح بالكاميرا"</b> لقراءة باركود أي سلعة للبيع في الهاتف أو إرساله لاسلكياً للحاسوب!
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Guide for Installing on Android & iPhone (iOS) */}
      {showIosInstallGuide && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <Smartphone className="w-5 h-5 text-indigo-600" />
                <h3 className="text-sm font-black text-slate-900">
                  {lang === 'ar'
                    ? 'طريقة تثبيت التطبيق على الأندرويد والآيفون'
                    : 'How to Install on Android & iPhone'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowIosInstallGuide(false)}
                className="text-slate-400 hover:text-slate-700 font-black text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs leading-relaxed">
              <div className="p-3.5 rounded-2xl bg-indigo-50 border border-indigo-200 space-y-1">
                <div className="font-black text-indigo-900">🤖 أولاً: على هواتف الأندرويد (Android):</div>
                <p className="text-indigo-800 font-semibold">
                  1. افتح رابط البرنامج في متصفح <b>Chrome</b> على هاتفك.<br />
                  2. اضغط على القائمة <b>(⋮)</b> أعلى المتصفح ثم اختر <b>"تثبيت التطبيق" (Install App / Add to Home screen)</b>.<br />
                  3. ستظهر أيقونة <b>Smart POS</b> مع تطبيقات هاتفك ويفتح بشاشة كاملة بدون شريط متصفح!
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-900 text-white space-y-1">
                <div className="font-black text-emerald-400 flex items-center gap-1.5">
                  <Share2 className="w-4 h-4" />
                  <span>🍏 ثانياً: على هواتف الآيفون والأيباد (iPhone / iOS):</span>
                </div>
                <p className="text-slate-200 font-semibold">
                  1. افتح رابط البرنامج في متصفح <b>Safari</b> على الآيفون.<br />
                  2. اضغط على زر <b>المشاركة (Share ⬆️)</b> في أسفل الشاشة.<br />
                  3. اختر <b>"إضافة إلى الشاشة الرئيسية" (Add to Home Screen ➕)</b> ثم اضغط <b>إضافة (Add)</b>.<br />
                  4. سيشتغل البرنامج كتطبيق آيفون أصلي مستقل بكامل الشاشة ويدعم العمل بدون إنترنت!
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowIosInstallGuide(false)}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black cursor-pointer"
            >
              {lang === 'ar' ? 'فهمت، شكراً!' : 'Got it!'}
            </button>
          </div>
        </div>
      )}

      {/* Camera QR Scanner for Pairing */}
      <CameraBarcodeModal
        isOpen={showQrScanner}
        onClose={() => setShowQrScanner(false)}
        onScanCode={(code) => {
          setShowQrScanner(false);
          handleApplyPastedPairingCode(code);
        }}
        lang={lang}
        title={lang === 'ar' ? 'امسح رمز QR للربط مع الحاسوب' : 'Scan Pairing QR Code'}
        allowWirelessPcSend={false}
      />
    </div>
  );
}
