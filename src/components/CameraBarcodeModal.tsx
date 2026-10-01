/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { Language } from '../types';
import { pushCloudBarcodeScan } from '../utils/cloudSync';
import { Camera, X, ScanBarcode, Send, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';

interface CameraBarcodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanCode: (code: string) => void;
  lang: Language;
  title?: string;
  allowWirelessPcSend?: boolean;
}

const playScannerBeep = () => {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(980, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1420, ctx.currentTime + 0.09);
    gain.gain.setValueAtTime(0.22, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.14);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.14);
  } catch {
    // ignore audio policy block
  }
};

export default function CameraBarcodeModal({
  isOpen,
  onClose,
  onScanCode,
  lang,
  title,
  allowWirelessPcSend = true,
}: CameraBarcodeModalProps) {
  const isRTL = lang === 'ar';
  const [scanMode, setScanMode] = useState<'local' | 'pc_wireless'>('local');
  const [manualCode, setManualCode] = useState('');
  const [continuousScan, setContinuousScan] = useState(false);
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');

  const scannerRef = useRef<any>(null);
  const lastScanTimeRef = useRef<number>(0);
  const containerId = 'smartpos-camera-reader-box';

  const handleDetectedCode = async (rawCode: string) => {
    const code = String(rawCode || '').trim();
    if (!code) return;

    const now = Date.now();
    if (now - lastScanTimeRef.current < 1600) return;
    lastScanTimeRef.current = now;

    playScannerBeep();
    setLastScanned(code);

    if (scanMode === 'pc_wireless') {
      await pushCloudBarcodeScan(code);
    } else {
      onScanCode(code);
    }

    if (!continuousScan && scanMode === 'local') {
      stopScanner().then(() => onClose());
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        await scannerRef.current.clear();
      } catch {
        // ignore stop errors
      }
      scannerRef.current = null;
    }
  };

  const startScanner = async () => {
    setCameraError(null);
    await stopScanner();

    const Html5QrcodeClass = (window as any).Html5Qrcode;
    if (!Html5QrcodeClass) {
      setCameraError(
        lang === 'ar'
          ? 'جاري تحميل مكتبة الكاميرا... يمكنك أيضاً كتابة الباركود يدوياً بالأسفل.'
          : 'Camera library loading... You can also type barcode below.'
      );
      return;
    }

    try {
      const html5QrCode = new Html5QrcodeClass(containerId);
      scannerRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode },
        {
          fps: 12,
          qrbox: { width: 250, height: 150 },
          aspectRatio: 1.333,
        },
        (decodedText: string) => {
          handleDetectedCode(decodedText);
        },
        () => {}
      );
    } catch (err: any) {
      setCameraError(
        lang === 'ar'
          ? 'تعذر فتح الكاميرا تلقائياً. تأكد من السماح بصلاحية الكاميرا في المتصفح/الهاتف أو أدخل الباركود بالأسفل.'
          : 'Could not access camera. Please grant camera permissions or enter code manually.'
      );
    }
  };

  useEffect(() => {
    if (isOpen) {
      const t = setTimeout(() => {
        startScanner();
      }, 180);
      return () => {
        clearTimeout(t);
        stopScanner();
      };
    } else {
      stopScanner();
    }
  }, [isOpen, facingMode, scanMode, continuousScan]);

  if (!isOpen) return null;

  return (
    <div
      dir={isRTL ? 'rtl' : 'ltr'}
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-fade-in"
    >
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-slate-900 text-white px-4 py-3.5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center">
              <Camera className="w-4 h-4 text-indigo-300" />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-black">
                {title || (lang === 'ar' ? 'قارئ الباركود بكاميرا الهاتف' : 'Smartphone Camera Barcode Scanner')}
              </h3>
              <p className="text-[10px] text-slate-400 font-semibold">
                {lang === 'ar' ? 'وجّه الكاميرا نحو باركود السلعة أو QR Code' : 'Point camera at product barcode'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'))}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
              title={lang === 'ar' ? 'تبديل الكاميرا (أمامية / خلفية)' : 'Switch Camera'}
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                stopScanner().then(() => onClose());
              }}
              className="p-2 rounded-xl bg-white/10 hover:bg-rose-500/30 text-white transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-4 space-y-3.5 overflow-y-auto">
          {/* Mode selector: Local phone cart vs Wireless to PC */}
          {allowWirelessPcSend && (
            <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-2xl">
              <button
                type="button"
                onClick={() => setScanMode('local')}
                className={`py-2 px-2.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center justify-center gap-1.5 ${
                  scanMode === 'local'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ScanBarcode className="w-3.5 h-3.5" />
                <span>{lang === 'ar' ? 'البيع / البحث بالهاتف' : 'Scan in Phone'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setScanMode('pc_wireless');
                  setContinuousScan(true);
                }}
                className={`py-2 px-2.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center justify-center gap-1.5 ${
                  scanMode === 'pc_wireless'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Send className="w-3.5 h-3.5" />
                <span>{lang === 'ar' ? 'إرسال لاسلكي للحاسوب' : 'Send to PC POS'}</span>
              </button>
            </div>
          )}

          {/* Camera Viewport */}
          <div className="relative rounded-2xl overflow-hidden bg-slate-950 border-2 border-indigo-500/40 min-h-[210px] flex items-center justify-center">
            <div id={containerId} className="w-full" />
            {cameraError && (
              <div className="p-5 text-center space-y-2">
                <AlertCircle className="w-8 h-8 text-amber-400 mx-auto" />
                <p className="text-xs font-bold text-slate-200 leading-relaxed">{cameraError}</p>
                <button
                  type="button"
                  onClick={startScanner}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-black cursor-pointer"
                >
                  {lang === 'ar' ? 'إعادة تشغيل الكاميرا' : 'Retry Camera'}
                </button>
              </div>
            )}
          </div>

          {/* Continuous Scan Toggle */}
          <label className="flex items-center justify-between bg-slate-50 border border-slate-200 px-3.5 py-2.5 rounded-2xl cursor-pointer">
            <span className="text-xs font-bold text-slate-700">
              {lang === 'ar'
                ? 'مسح متواصل لعدة سلع متتالية (بدون إغلاق الكاميرا)'
                : 'Continuous Multi-Item Scan'}
            </span>
            <input
              type="checkbox"
              checked={continuousScan}
              onChange={(e) => setContinuousScan(e.target.checked)}
              className="w-4 h-4 accent-indigo-600 rounded"
            />
          </label>

          {/* Last Scanned Banner */}
          {lastScanned && (
            <div className="bg-emerald-50 border border-emerald-200 px-3.5 py-2.5 rounded-2xl flex items-center justify-between text-xs font-black text-emerald-800">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{lang === 'ar' ? 'تم مسح الكود:' : 'Scanned:'}</span>
              </div>
              <span className="font-mono bg-white px-2.5 py-0.5 rounded-lg border border-emerald-200">
                {lastScanned}
              </span>
            </div>
          )}

          {/* Manual Barcode Input Fallback */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (manualCode.trim()) {
                handleDetectedCode(manualCode.trim());
                setManualCode('');
              }
            }}
            className="flex gap-2 pt-1"
          >
            <input
              type="text"
              dir="ltr"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder={lang === 'ar' ? 'أو اكتب رقم الباركود يدوياً هنا...' : 'Or type barcode manually...'}
              className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              type="submit"
              className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black cursor-pointer shrink-0"
            >
              {lang === 'ar' ? 'تأكيد' : 'Submit'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
