import React, { useState, useEffect } from 'react';
import { ShoppingBag, CheckCircle2, Clock } from 'lucide-react';

interface DisplayCartItem {
  name: string;
  quantity: number | string;
  unitPrice: number;
  total: number;
}

interface DisplayData {
  storeName: string;
  currency: string;
  items: DisplayCartItem[];
  subtotal: number;
  discount: number;
  total: number;
  amountPaid: number;
  changeDue: number;
  timestamp: number;
}

export default function CustomerDisplay() {
  const [data, setData] = useState<DisplayData>(() => {
    try {
      const saved = localStorage.getItem('smartpos_customer_display_data');
      return saved ? JSON.parse(saved) : {
        storeName: 'Smart POS',
        currency: 'د.ج',
        items: [],
        subtotal: 0,
        discount: 0,
        total: 0,
        amountPaid: 0,
        changeDue: 0,
        timestamp: Date.now()
      };
    } catch {
      return {
        storeName: 'Smart POS',
        currency: 'د.ج',
        items: [],
        subtotal: 0,
        discount: 0,
        total: 0,
        amountPaid: 0,
        changeDue: 0,
        timestamp: Date.now()
      };
    }
  });

  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    // 1. BroadcastChannel listener
    let bc: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        bc = new BroadcastChannel('smartpos_customer_display');
        bc.onmessage = (event) => {
          if (event.data) setData(event.data);
        };
      } catch {}
    }

    // 2. Storage event listener (across browser tabs)
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'smartpos_customer_display_data' && e.newValue) {
        try {
          setData(JSON.parse(e.newValue));
        } catch {}
      }
    };
    window.addEventListener('storage', handleStorage);

    // 3. Fallback interval check
    const interval = setInterval(() => {
      try {
        const saved = localStorage.getItem('smartpos_customer_display_data');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && parsed.timestamp !== data.timestamp) {
            setData(parsed);
          }
        }
      } catch {}
    }, 500);

    return () => {
      if (bc) bc.close();
      window.removeEventListener('storage', handleStorage);
      clearInterval(interval);
    };
  }, [data.timestamp]);

  const currency = data.currency || 'د.ج';
  const hasItems = data.items && data.items.length > 0;

  return (
    <div className="min-h-screen bg-slate-900 text-white font-sans flex flex-col justify-between p-4 sm:p-8 select-none" dir="rtl">
      {/* Top Header */}
      <header className="flex items-center justify-between pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/30">
            <ShoppingBag className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">{data.storeName}</h1>
            <p className="text-xs text-slate-400 font-bold">مرحباً بكم • Bienvenue • Welcome</p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-slate-800/80 px-4 py-2 rounded-xl border border-slate-700/60 text-slate-300 font-mono text-sm font-bold">
          <Clock className="w-4 h-4 text-indigo-400" />
          <span>{currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
        </div>
      </header>

      {/* Main Body: Cart Table & Summary Cards */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 my-6 overflow-hidden">
        {/* Left: Cart Items Table */}
        <div className="lg:col-span-2 bg-slate-800/50 border border-slate-800 rounded-3xl p-5 flex flex-col overflow-hidden shadow-xl">
          <div className="flex items-center justify-between pb-3 border-b border-slate-700/60 text-xs font-bold text-slate-400 uppercase tracking-wider">
            <span>المنتج / السلعة</span>
            <div className="flex items-center gap-8">
              <span>الكمية</span>
              <span>السعر</span>
              <span className="w-20 text-start">المجموع</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 py-3 no-scrollbar">
            {hasItems ? (
              data.items.map((it, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3.5 bg-slate-800/80 hover:bg-slate-700/60 rounded-2xl border border-slate-700/40 transition animate-fade-in"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span className="w-7 h-7 rounded-lg bg-indigo-600/30 text-indigo-400 font-mono font-black text-xs flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <span className="font-bold text-base text-slate-100 truncate">{it.name}</span>
                  </div>

                  <div className="flex items-center gap-8 text-sm font-mono font-bold shrink-0">
                    <span className="text-slate-300">×{it.quantity}</span>
                    <span className="text-slate-400">{Number(it.unitPrice).toFixed(2)}</span>
                    <span className="text-emerald-400 font-black text-base w-20 text-start">
                      {Number(it.total).toFixed(2)} <span className="text-xs text-slate-400 font-normal">{currency}</span>
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 py-16 space-y-3">
                <ShoppingBag className="w-16 h-16 stroke-[1] text-slate-600" />
                <p className="text-lg font-bold">بانتظار تمرير السلع عند الكاشير...</p>
                <p className="text-xs text-slate-500">سيتم عرض قائمة المشتريات ومجموع الحساب هنا فوراً</p>
              </div>
            )}
          </div>
        </div>

        {/* Right: Totals & Payment Highlights */}
        <div className="flex flex-col justify-between space-y-4">
          {/* Grand Total Card */}
          <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-3xl p-6 sm:p-8 shadow-2xl flex flex-col justify-between text-start border border-indigo-500/40">
            <div>
              <span className="text-xs font-black uppercase tracking-wider text-indigo-200 block mb-1">
                المجموع الإجمالي الواجب دفعه
              </span>
              <div className="text-4xl sm:text-5xl font-black font-mono tracking-tight text-white mt-2">
                {Number(data.total || 0).toLocaleString()}
                <span className="text-lg sm:text-2xl font-bold text-indigo-200 mr-2">{currency}</span>
              </div>
            </div>

            {data.discount > 0 && (
              <div className="mt-4 pt-3 border-t border-indigo-400/30 flex justify-between text-xs font-bold text-indigo-200">
                <span>الخصم الممنوح:</span>
                <span className="font-mono">-{Number(data.discount).toFixed(2)} {currency}</span>
              </div>
            )}
          </div>

          {/* Amount Paid & Change Due */}
          <div className="grid grid-cols-2 gap-4">
            {/* Paid */}
            <div className="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-4 text-start">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                المبلغ المستلم
              </span>
              <div className="text-2xl font-black font-mono text-slate-100">
                {Number(data.amountPaid || 0).toLocaleString()}
                <span className="text-xs text-slate-400 font-bold mr-1">{currency}</span>
              </div>
            </div>

            {/* Change Due */}
            <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-2xl p-4 text-start">
              <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block mb-1">
                الصرف المتبقي لك
              </span>
              <div className="text-2xl font-black font-mono text-emerald-300">
                {Number(data.changeDue || 0).toLocaleString()}
                <span className="text-xs text-emerald-400 font-bold mr-1">{currency}</span>
              </div>
            </div>
          </div>

          {/* Thank You Note */}
          <div className="bg-slate-800/40 border border-slate-800 rounded-2xl p-4 text-center text-slate-400 text-xs font-bold flex items-center justify-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>شكراً لزيارتكم ومرحباً بكم في أي وقت!</span>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center text-xs text-slate-500 pt-3 border-t border-slate-800/60 font-semibold">
        Smart POS Pro • شاشة العرض التفاعلية للزبائن
      </footer>
    </div>
  );
}
