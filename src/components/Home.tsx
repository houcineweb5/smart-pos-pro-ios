/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Invoice, Product, Customer, Supplier, ActivityLog, StoreConfig, Language, Employee, ActiveTab } from '../types';
import { languages } from '../languages';
import { 
  ShoppingCart, Package, PenTool, Settings, TrendingUp, DollarSign, Users, AlertTriangle, 
  ArrowRight, UserCheck, Clock, Activity, Zap, CheckCircle2, Truck, ShoppingBag, ClipboardList, Share2
} from 'lucide-react';
import { triggerHaptic } from '../utils/haptics';
import { shareContent } from '../utils/nativeShare';

interface HomeProps {
  invoices: Invoice[];
  products: Product[];
  customers: Customer[];
  suppliers: Supplier[];
  logs: ActivityLog[];
  config: StoreConfig;
  lang: Language;
  currentUser: Employee;
  onNavigate: (tab: ActiveTab) => void;
}

export default function Home({
  invoices,
  products,
  customers,
  suppliers,
  logs,
  config,
  lang,
  currentUser,
  onNavigate,
}: HomeProps) {
  const t = languages[lang];
  const isRTL = t.direction === 'rtl';

  const [hoveredDayIndex, setHoveredDayIndex] = useState<number | null>(null);

  // Theme color mappings so Home banner, badges, online status, and chart adapt dynamically
  const getThemeClasses = (theme?: string) => {
    switch (theme) {
      case 'sky':
        return {
          primaryHex: '#0ea5e9',
          bannerGrad: 'from-slate-950 via-sky-950 to-slate-900 border-sky-800/60',
          bannerBlob1: 'bg-sky-500/20',
          bannerBlob2: 'bg-cyan-500/15',
          bannerBadge: 'bg-sky-500/20 text-sky-300 border-sky-500/30',
          bannerIcon: 'text-sky-400',
          onlineBadge: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
          onlineDot: 'bg-sky-400',
          kpiBox: 'bg-sky-50 text-sky-700 border-sky-100',
          accentBadge: 'bg-sky-50 text-sky-700',
          strokeColor: '#0ea5e9',
          gradStop1: '#0ea5e9',
          gradStop2: '#38bdf8',
          chartFill: 'url(#homeRevGradSky)'
        };
      case 'emerald':
        return {
          primaryHex: '#10b981',
          bannerGrad: 'from-slate-950 via-emerald-950 to-slate-900 border-emerald-800/60',
          bannerBlob1: 'bg-emerald-500/20',
          bannerBlob2: 'bg-teal-500/15',
          bannerBadge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
          bannerIcon: 'text-emerald-400',
          onlineBadge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
          onlineDot: 'bg-emerald-400',
          kpiBox: 'bg-emerald-50 text-emerald-700 border-emerald-100',
          accentBadge: 'bg-emerald-50 text-emerald-700',
          strokeColor: '#10b981',
          gradStop1: '#10b981',
          gradStop2: '#34d399',
          chartFill: 'url(#homeRevGradEmerald)'
        };
      case 'rose':
        return {
          primaryHex: '#f43f5e',
          bannerGrad: 'from-slate-950 via-rose-950 to-slate-900 border-rose-800/60',
          bannerBlob1: 'bg-rose-500/20',
          bannerBlob2: 'bg-pink-500/15',
          bannerBadge: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
          bannerIcon: 'text-rose-400',
          onlineBadge: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
          onlineDot: 'bg-rose-400',
          kpiBox: 'bg-rose-50 text-rose-700 border-rose-100',
          accentBadge: 'bg-rose-50 text-rose-700',
          strokeColor: '#f43f5e',
          gradStop1: '#f43f5e',
          gradStop2: '#fb7185',
          chartFill: 'url(#homeRevGradRose)'
        };
      case 'amber':
        return {
          primaryHex: '#f59e0b',
          bannerGrad: 'from-slate-950 via-amber-950 to-slate-900 border-amber-800/60',
          bannerBlob1: 'bg-amber-500/20',
          bannerBlob2: 'bg-yellow-500/15',
          bannerBadge: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
          bannerIcon: 'text-amber-400',
          onlineBadge: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
          onlineDot: 'bg-amber-400',
          kpiBox: 'bg-amber-50 text-amber-700 border-amber-100',
          accentBadge: 'bg-amber-50 text-amber-700',
          strokeColor: '#f59e0b',
          gradStop1: '#f59e0b',
          gradStop2: '#fbbf24',
          chartFill: 'url(#homeRevGradAmber)'
        };
      case 'purple':
      case 'indigo':
      default:
        return {
          primaryHex: '#6366f1',
          bannerGrad: 'from-slate-950 via-indigo-950 to-slate-900 border-indigo-800/60',
          bannerBlob1: 'bg-indigo-500/20',
          bannerBlob2: 'bg-purple-500/15',
          bannerBadge: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
          bannerIcon: 'text-indigo-400',
          onlineBadge: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
          onlineDot: 'bg-indigo-400',
          kpiBox: 'bg-indigo-50 text-indigo-700 border-indigo-100',
          accentBadge: 'bg-indigo-50 text-indigo-700',
          strokeColor: '#6366f1',
          gradStop1: '#6366f1',
          gradStop2: '#818cf8',
          chartFill: 'url(#homeRevGradIndigo)'
        };
    }
  };

  const theme = getThemeClasses(config.themeColor);

  // Dynamic greeting based on time of day
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) {
      return lang === 'ar' ? 'صباح الخير' : lang === 'fr' ? 'Bonjour' : 'Good Morning';
    } else if (hour < 18) {
      return lang === 'ar' ? 'مساء الخير' : lang === 'fr' ? 'Bon après-midi' : 'Good Afternoon';
    } else {
      return lang === 'ar' ? 'مساء الخير' : lang === 'fr' ? 'Bonsoir' : 'Good Evening';
    }
  };

  // Date formatted in French/Latin numbers
  const formattedDate = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // Calculate statistics
  const now = new Date();
  
  const todayInvoices = invoices.filter((inv) => {
    const invDate = new Date(inv.date);
    return invDate.toDateString() === now.toDateString();
  });

  const thisMonthInvoices = invoices.filter((inv) => {
    const invDate = new Date(inv.date);
    return invDate.getMonth() === now.getMonth() && invDate.getFullYear() === now.getFullYear();
  });
  const monthRevenue = thisMonthInvoices.reduce((sum, inv) => sum + inv.total, 0);
  const todayRevenue = todayInvoices.reduce((sum, inv) => sum + inv.total, 0);
  const lowStockCount = products.filter((p) => p.stock <= p.minStock).length;
  const totalDebt = customers.reduce((sum, c) => sum + Math.max(0, c.debt), 0);

  const handleShareTodaySales = async (e: React.MouseEvent) => {
    e.stopPropagation();
    triggerHaptic('light');
    const storeName = config.name || 'Smart POS';
    const lines = [
      `📊 *${lang === 'ar' ? 'ملخص مبيعات اليوم السريع' : 'Résumé des ventes du jour'}*`,
      `🏪 *${storeName}*`,
      `📅 ${now.toLocaleDateString(lang === 'ar' ? 'ar-MA' : 'fr-FR')}`,
      '--------------------------------',
      `🛒 ${lang === 'ar' ? 'عدد الفواتير' : 'Nombre de tickets'}: ${todayInvoices.length}`,
      `💰 *${lang === 'ar' ? 'إجمالي المبيعات' : 'Total Ventes'}: ${todayRevenue.toFixed(2)} ${config.currency}*`,
      '--------------------------------',
      `👥 ${lang === 'ar' ? 'الديون المتبقية للزبناء' : 'Créances totales'}: ${totalDebt.toFixed(2)} ${config.currency}`,
      lowStockCount > 0 ? `⚠️ ${lang === 'ar' ? 'منتجات تحتاج تموين' : 'Alertes stock'}: ${lowStockCount}` : null
    ].filter(Boolean).join('\n');

    await shareContent({
      title: `${storeName} - ${lang === 'ar' ? 'مبيعات اليوم' : 'Ventes du jour'}`,
      text: lines,
      dialogTitle: lang === 'ar' ? 'مشاركة ملخص مبيعات اليوم' : 'Partager les ventes du jour'
    });
  };

  // SVG Chart points calculation for last 7 days with French labels
  const getDailySales = () => {
    const salesMap: Record<string, number> = {};
    const last7Days: { label: string; dateStr: string }[] = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const label = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
      last7Days.push({ label, dateStr: d.toDateString() });
      salesMap[d.toDateString()] = 0;
    }

    invoices.forEach((inv) => {
      const dateKey = new Date(inv.date).toDateString();
      if (salesMap[dateKey] !== undefined) {
        salesMap[dateKey] += inv.total;
      }
    });

    return last7Days.map((day) => ({
      label: day.label,
      value: salesMap[day.dateStr],
    }));
  };

  const chartData = getDailySales();
  const maxChartValue = Math.max(...chartData.map((d) => d.value), 100);

  const coords = chartData.map((d, idx) => {
    const x = (idx / 6) * 350 + 20;
    const y = 110 - (d.value / maxChartValue) * 80 - 10;
    return { x, y, value: d.value };
  });

  // Generate smooth natural wavy curve (Catmull-Rom spline)
  const generateCurvedPath = (pts: { x: number; y: number }[]) => {
    if (pts.length === 0) return '';
    if (pts.length === 1) return `M ${pts[0].x},${pts[0].y}`;

    let path = `M ${pts[0].x},${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = i > 0 ? pts[i - 1] : pts[i];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = i < pts.length - 2 ? pts[i + 2] : p2;

      const tension = 0.22;
      const cp1x = p1.x + (p2.x - p0.x) * tension;
      const cp1y = p1.y + (p2.y - p0.y) * tension;
      const cp2x = p2.x - (p3.x - p1.x) * tension;
      const cp2y = p2.y - (p3.y - p1.y) * tension;

      path += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
    }
    return path;
  };

  const curvedLinePath = generateCurvedPath(coords);
  const curvedAreaPath = coords.length > 0
    ? `${curvedLinePath} L ${coords[coords.length - 1].x.toFixed(1)},110 L ${coords[0].x.toFixed(1)},110 Z`
    : '';

  const weekTotalRevenue = chartData.reduce((sum, d) => sum + d.value, 0);
  const dailyAvgRevenue = weekTotalRevenue / 7;
  const peakDay = chartData.reduce((max, d) => d.value > max.value ? d : max, chartData[0] || { label: '', value: 0 });

  return (
    <div className="space-y-4 sm:space-y-5 animate-fade-in" id="home-dashboard-root">
      {/* 1. Welcoming Banner Card - Dynamic Theme Colors & Balanced Typography */}
      <div 
        id="home-welcome-banner" 
        className={`relative overflow-hidden bg-gradient-to-r ${theme.bannerGrad} text-white rounded-2xl p-4 md:px-6 md:py-4.5 min-h-[115px] md:min-h-[130px] shadow-sm border w-full flex flex-col justify-center transition-colors duration-300`}
      >
        <div className={`absolute top-0 right-0 w-80 h-80 ${theme.bannerBlob1} rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none`}></div>
        <div className={`absolute bottom-0 left-0 w-80 h-80 ${theme.bannerBlob2} rounded-full blur-3xl -ml-20 -mb-20 pointer-events-none`}></div>
        
        <div className="relative z-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3.5">
          <div className="space-y-1 text-start">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full ${theme.bannerBadge} text-[10px] font-bold border`}>
                <UserCheck className="w-3 h-3" />
                {currentUser.role === 'admin' ? (lang === 'ar' ? 'حساب مدير النظام' : 'Admin Profile') : (lang === 'ar' ? 'حساب موظف المبيعات' : 'Staff Profile')}
              </span>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full ${theme.onlineBadge} text-[10px] font-bold border`}>
                <span className={`w-1.5 h-1.5 rounded-full ${theme.onlineDot} animate-pulse`}></span>
                <span>{lang === 'ar' ? 'متصل بالكامل' : 'En ligne'}</span>
              </span>
            </div>
            
            <h1 className="text-base md:text-lg font-bold tracking-tight font-heading mt-0.5">
              {lang === 'ar' ? (
                <>
                  <span>مرحباً بك، {currentUser.name} 👋</span>{' '}
                  <span className="text-slate-300 font-medium text-sm md:text-base">في لوحة التحكم</span>
                </>
              ) : (
                `${getGreeting()}, ${currentUser.name}! 👋`
              )}
            </h1>
            <p className="text-[11px] text-slate-300 font-medium leading-relaxed max-w-xl">
              {lang === 'ar' 
                ? 'تصفح الإحصائيات السريعة، وأكمل معاملات البيع وأدر المخزون والفواتير بسهولة.'
                : 'Review key performance indicators, complete checkouts, and manage store operations.'}
            </p>
          </div>

          <div className="flex items-center gap-2 bg-slate-950/70 px-3 py-1.5 rounded-xl border border-slate-800/80 shrink-0 self-stretch sm:self-auto justify-center shadow-inner">
            <Clock className={`w-3.5 h-3.5 ${theme.bannerIcon} shrink-0`} />
            <div className="text-start">
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">
                {lang === 'ar' ? 'تاريخ اليوم' : 'Current Date'}
              </span>
              <span className="text-[11px] font-semibold text-slate-200 font-mono capitalize">{formattedDate}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Premium KPI Cards - Harmonized Refined Typography */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5" id="home-kpi-row">
        {/* Card 1: Monthly Sales */}
        <div className="bg-white border border-slate-100 p-4 rounded-xl shadow-xs flex items-center gap-3 transition hover:shadow-sm">
          <div className={`w-10 h-10 ${theme.kpiBox} rounded-xl flex items-center justify-center font-black text-xs font-mono border shrink-0`}>
            {config.currency || 'MAD'}
          </div>
          <div className="text-start">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
              {lang === 'ar' ? 'مبيعات هذا الشهر' : lang === 'fr' ? 'Ventes du Mois' : 'Monthly Revenue'}
            </span>
            <span className="text-base sm:text-lg font-bold text-slate-900 font-mono">
              {monthRevenue.toFixed(2)} <span className="text-[11px] text-slate-500 font-sans font-bold uppercase">{config.currency}</span>
            </span>
          </div>
        </div>

        {/* Card 2: Today Sales */}
        <div className="bg-white border border-slate-100 p-4 rounded-xl shadow-xs flex items-center justify-between gap-3 transition hover:shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <TrendingUp className="w-4.5 h-4.5" />
            </div>
            <div className="text-start">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
                {lang === 'ar' ? 'مبيعات اليوم' : 'Today\'s Sales'}
              </span>
              <span className="text-base sm:text-lg font-bold text-slate-900 font-mono">
                {todayRevenue.toFixed(2)} <span className="text-[11px] text-slate-500 font-sans font-bold uppercase">{config.currency}</span>
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleShareTodaySales}
            className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition cursor-pointer"
            title={lang === 'ar' ? 'مشاركة ملخص مبيعات اليوم' : 'Partager les ventes du jour'}
          >
            <Share2 className="w-4 h-4" />
          </button>
        </div>

        {/* Card 3: Pending Debt */}
        <div 
          onClick={() => onNavigate('customers')}
          className="bg-white border border-slate-100 p-4 rounded-xl shadow-xs flex items-center gap-3 transition hover:shadow-sm cursor-pointer hover:border-rose-200 group"
          title={lang === 'ar' ? 'انقر لعرض سجل الزبناء والديون' : 'Click to view Customers & Debts Ledger'}
        >
          <div className="p-2 bg-rose-50 text-rose-600 rounded-xl group-hover:scale-105 transition">
            <Users className="w-4.5 h-4.5" />
          </div>
          <div className="text-start">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
              {lang === 'ar' ? 'سجل الزبناء والديون' : 'Customers & Debts'}
            </span>
            <span className="text-base sm:text-lg font-bold text-rose-600 font-mono">
              {totalDebt.toFixed(2)} <span className="text-[11px] text-slate-500 font-sans font-bold uppercase">{config.currency}</span>
            </span>
          </div>
        </div>

        {/* Card 4: Low Stock */}
        <div className="bg-white border border-slate-100 p-4 rounded-xl shadow-xs flex items-center gap-3 transition hover:shadow-sm">
          <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
            <AlertTriangle className="w-4.5 h-4.5" />
          </div>
          <div className="text-start">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
              {lang === 'ar' ? 'سلع منخفضة المخزون' : 'Stock Alerts'}
            </span>
            <span className="text-base sm:text-lg font-bold text-amber-600 font-mono">
              {lowStockCount} <span className="text-[11px] text-slate-500 font-sans font-bold">{lang === 'ar' ? 'منتجات' : 'items'}</span>
            </span>
          </div>
        </div>
      </div>

            {/* 3. Quick Actions Shortcuts */}
      <div className="space-y-2.5">
        <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest text-start block">
          {lang === 'ar' ? 'روابط سريعة لأهم العمليات' : 'Quick Operations Shortcuts'}
        </h2>
        
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5" id="home-shortcuts-grid">
          {/* Action 1: New Sale */}
          <button
            id="shortcut-new-sale"
            onClick={() => onNavigate('pos')}
            className="group p-4 bg-white border border-slate-100 rounded-xl shadow-xs text-start transition duration-200 hover:border-indigo-200 hover:shadow-sm cursor-pointer flex flex-col justify-between h-28"
          >
            <span className={`p-2 ${theme.kpiBox} rounded-xl transition duration-300 group-hover:scale-105 shrink-0 self-start`}>
              <ShoppingCart className="w-4.5 h-4.5" />
            </span>
            <div className="flex justify-between items-end w-full">
              <div>
                <h3 className="font-bold text-slate-800 text-xs leading-snug">{lang === 'ar' ? 'نقطة البيع' : 'New Sales POS'}</h3>
                <p className="text-[9px] text-slate-400 font-medium mt-0.5">{lang === 'ar' ? 'فتح شاشة مبيعات جديدة' : 'Checkout client cart'}</p>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400 transition duration-300 group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1" />
            </div>
          </button>

          {/* Action 2: Customers & Debts */}
          <button
            id="shortcut-customers-debts"
            onClick={() => onNavigate('customers')}
            className="group p-4 bg-white border border-slate-100 rounded-xl shadow-xs text-start transition duration-200 hover:border-rose-200 hover:shadow-sm cursor-pointer flex flex-col justify-between h-28"
          >
            <span className="p-2 bg-rose-50 text-rose-600 rounded-xl transition duration-300 group-hover:scale-105 shrink-0 self-start">
              <Users className="w-4.5 h-4.5" />
            </span>
            <div className="flex justify-between items-end w-full">
              <div>
                <h3 className="font-bold text-slate-800 text-xs leading-snug">{lang === 'ar' ? 'الزبناء والديون' : 'Customers & Debts'}</h3>
                <p className="text-[9px] text-slate-400 font-medium mt-0.5">{lang === 'ar' ? 'سجل الزبائن والكريدي' : 'Client accounts ledger'}</p>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400 transition duration-300 group-hover:translate-x-1 text-rose-600 rtl:rotate-180 rtl:group-hover:-translate-x-1" />
            </div>
          </button>

          {/* Action 3: Add Product */}
          <button
            id="shortcut-add-product"
            onClick={() => onNavigate('inventory')}
            className="group p-4 bg-white border border-slate-100 rounded-xl shadow-xs text-start transition duration-200 hover:border-emerald-200 hover:shadow-sm cursor-pointer flex flex-col justify-between h-28"
          >
            <span className="p-2 bg-emerald-50 text-emerald-600 rounded-xl transition duration-300 group-hover:scale-105 shrink-0 self-start">
              <Package className="w-4.5 h-4.5" />
            </span>
            <div className="flex justify-between items-end w-full">
              <div>
                <h3 className="font-bold text-slate-800 text-xs leading-snug">{lang === 'ar' ? 'إدارة المخزن' : lang === 'fr' ? 'Gestion du Stock' : 'Inventory Management'}</h3>
                <p className="text-[9px] text-slate-400 font-medium mt-0.5">{lang === 'ar' ? 'تسجيل منتج، فحص وتعديل المخزون' : lang === 'fr' ? 'Gérer les produits et le stock' : 'Manage stock and products'}</p>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400 transition duration-300 group-hover:translate-x-1 text-emerald-600 rtl:rotate-180 rtl:group-hover:-translate-x-1" />
            </div>
          </button>

          {/* Action 4: Sales Invoices Management */}
          <button
            id="shortcut-sales-invoices"
            onClick={() => onNavigate('invoices')}
            className="group p-4 bg-white border border-slate-100 rounded-xl shadow-xs text-start transition duration-200 hover:border-amber-200 hover:shadow-sm cursor-pointer flex flex-col justify-between h-28"
          >
            <span className="p-2 bg-amber-50 text-amber-600 rounded-xl transition duration-300 group-hover:scale-105 shrink-0 self-start">
              <ClipboardList className="w-4.5 h-4.5" />
            </span>
            <div className="flex justify-between items-end w-full">
              <div>
                <h3 className="font-bold text-slate-800 text-xs leading-snug">{lang === 'ar' ? 'إدارة فواتير المبيعات' : lang === 'fr' ? 'Gestion des Factures' : 'Sales Invoices Management'}</h3>
                <p className="text-[9px] text-slate-400 font-medium mt-0.5">{lang === 'ar' ? 'عرض وتعديل فواتير المبيعات' : lang === 'fr' ? 'Consulter et modifier les factures' : 'View and edit sales invoices'}</p>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400 transition duration-300 group-hover:translate-x-1 text-amber-600 rtl:rotate-180 rtl:group-hover:-translate-x-1" />
            </div>
          </button>

          {/* Action 5: Settings */}
          <button
            id="shortcut-system-settings"
            onClick={() => onNavigate('settings')}
            className="group p-4 bg-white border border-slate-100 rounded-xl shadow-xs text-start transition duration-200 hover:border-slate-300 hover:shadow-sm cursor-pointer flex flex-col justify-between h-28"
          >
            <span className="p-2 bg-slate-100 text-slate-700 rounded-xl transition duration-300 group-hover:scale-105 shrink-0 self-start">
              <Settings className="w-4.5 h-4.5" />
            </span>
            <div className="flex justify-between items-end w-full">
              <div>
                <h3 className="font-bold text-slate-800 text-xs leading-snug">{lang === 'ar' ? 'إعدادات المنشأة' : 'Settings & Backups'}</h3>
                <p className="text-[9px] text-slate-400 font-medium mt-0.5">{lang === 'ar' ? 'النسخ الاحتياطي والألوان' : 'Configure system base'}</p>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400 transition duration-300 group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1" />
            </div>
          </button>
        </div>
      </div>

      {/* 4. Split Activity Section - Redesigned Sales Movement Indicator */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5" id="home-split-row">
        {/* Left Side: Completely Redesigned High-Impact Sales Trend Indicator */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-100 p-5 shadow-xs flex flex-col justify-between text-start relative overflow-hidden">
          {/* Header with Title and Trend Badge */}
          <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full`} style={{ backgroundColor: theme.primaryHex }} />
                <h3 className="text-sm font-bold text-slate-900">
                  {lang === 'ar' ? 'مؤشر حركة المبيعات' : 'Sales Activity Indicator'}
                </h3>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {lang === 'ar' ? 'تتبع فوري ومباشر لنسق المبيعات اليومية خلال آخر 7 أيام' : '7-day daily transactional momentum tracker'}
              </p>
            </div>

            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black ${theme.accentBadge} border border-slate-200/50 shadow-2xs shrink-0`}>
              <Activity className="w-3 h-3 animate-pulse" />
              <span>{lang === 'ar' ? 'مؤشر نشط' : 'Active Momentum'}</span>
            </div>
          </div>

          {/* Quick Stats Summary Strip */}
          <div className="grid grid-cols-3 gap-2 pt-3 pb-1">
            <div className="bg-slate-50/80 p-2 rounded-xl border border-slate-100 text-start">
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">
                {lang === 'ar' ? 'مبيعات الأسبوع' : '7D Total'}
              </span>
              <span className="text-xs sm:text-sm font-black text-slate-800 font-mono mt-0.5 block">
                {weekTotalRevenue.toFixed(0)} <span className="text-[9px] text-slate-400 font-normal">{config.currency}</span>
              </span>
            </div>

            <div className="bg-slate-50/80 p-2 rounded-xl border border-slate-100 text-start">
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">
                {lang === 'ar' ? 'المعدل اليومي' : 'Daily Avg'}
              </span>
              <span className="text-xs sm:text-sm font-black text-slate-800 font-mono mt-0.5 block">
                {dailyAvgRevenue.toFixed(0)} <span className="text-[9px] text-slate-400 font-normal">{config.currency}</span>
              </span>
            </div>

            <div className="bg-slate-50/80 p-2 rounded-xl border border-slate-100 text-start">
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">
                {lang === 'ar' ? 'أعلى يوم' : 'Peak Day'}
              </span>
              <span className="text-xs sm:text-sm font-black text-emerald-700 font-mono mt-0.5 block truncate">
                {peakDay.label}: {peakDay.value.toFixed(0)}
              </span>
            </div>
          </div>

          {/* Redesigned Interactive Chart Area */}
          <div className="h-44 my-2 relative">
            {/* Hover Tooltip display */}
            {hoveredDayIndex !== null && chartData[hoveredDayIndex] && (
              <div 
                className="absolute top-1 z-20 px-2.5 py-1 rounded-lg bg-slate-900 text-white text-[10px] font-mono shadow-md border border-slate-700 flex items-center gap-1.5 pointer-events-none transition-all duration-150 -translate-x-1/2"
                style={{ left: `${coords[hoveredDayIndex]?.x ? (coords[hoveredDayIndex].x / 390) * 100 : 50}%` }}
              >
                <span className="font-bold">{chartData[hoveredDayIndex].label}:</span>
                <span className="text-emerald-400 font-black">{chartData[hoveredDayIndex].value.toFixed(2)} {config.currency}</span>
              </div>
            )}

            <svg className="w-full h-full overflow-visible" viewBox="0 0 390 120" preserveAspectRatio="none">
              {/* Subtle background grid lines */}
              <line x1="15" y1="20" x2="375" y2="20" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="3 3" />
              <line x1="15" y1="60" x2="375" y2="60" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="3 3" />
              <line x1="15" y1="100" x2="375" y2="100" stroke="#e2e8f0" strokeWidth="1.5" />

              {/* Vertical Interactive Day Bars (Translucent Pillars) */}
              {coords.map((pt, idx) => {
                const barWidth = 26;
                const isHovered = hoveredDayIndex === idx;
                const barHeight = Math.max(8, 100 - pt.y);
                return (
                  <g 
                    key={`bar-${idx}`} 
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredDayIndex(idx)}
                    onMouseLeave={() => setHoveredDayIndex(null)}
                  >
                    <rect
                      x={pt.x - barWidth / 2}
                      y={pt.y}
                      width={barWidth}
                      height={barHeight}
                      rx="4"
                      fill={theme.strokeColor}
                      opacity={isHovered ? 0.28 : 0.08}
                      className="transition duration-150"
                    />
                  </g>
                );
              })}

              {/* Smooth Wavy Area Fill */}
              <path
                d={curvedAreaPath}
                fill="url(#homeThemeGrad)"
                opacity="0.32"
              />

              {/* Smooth Wavy Stroke Line with Theme Color */}
              <path
                d={curvedLinePath}
                fill="none"
                stroke={theme.strokeColor}
                strokeWidth="3.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Chart Points with Theme Aura Rings */}
              {coords.map((pt, idx) => {
                const isHovered = hoveredDayIndex === idx;
                return (
                  <g 
                    key={`pt-${idx}`} 
                    className="cursor-pointer group"
                    onMouseEnter={() => setHoveredDayIndex(idx)}
                    onMouseLeave={() => setHoveredDayIndex(null)}
                  >
                    <circle cx={pt.x} cy={pt.y} r={isHovered ? "11" : "7"} fill={theme.strokeColor} opacity={isHovered ? "0.35" : "0.18"} className="transition-all duration-150" />
                    <circle cx={pt.x} cy={pt.y} r={isHovered ? "5.5" : "4"} fill={theme.strokeColor} stroke="#ffffff" strokeWidth="2" />
                  </g>
                );
              })}

              {/* Dynamic Theme Gradient Definition */}
              <defs>
                <linearGradient id="homeThemeGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={theme.gradStop1} stopOpacity="0.85" />
                  <stop offset="70%" stopColor={theme.gradStop2} stopOpacity="0.15" />
                  <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
                </linearGradient>
              </defs>
            </svg>
          </div>

          {/* Bottom X-axis Day labels */}
          <div className="flex justify-between items-center text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider px-2 pt-2 border-t border-slate-100">
            {chartData.map((d, index) => {
              const isHovered = hoveredDayIndex === index;
              return (
                <span 
                  key={index}
                  onMouseEnter={() => setHoveredDayIndex(index)}
                  onMouseLeave={() => setHoveredDayIndex(null)}
                  className={`cursor-pointer transition-colors px-1 py-0.5 rounded ${isHovered ? 'bg-slate-900 text-white' : 'hover:text-slate-900'}`}
                >
                  {d.label}
                </span>
              );
            })}
          </div>
        </div>

        {/* Right Side: Activity Timeline - Redesigned Clear & Simplified */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-100 p-5 shadow-xs flex flex-col text-start">
          <div className="flex items-center justify-between pb-3.5 mb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                <Clock className="w-4 h-4 text-slate-600" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-800 leading-tight">
                  {lang === 'ar' ? 'سجل الأنشطة المباشر' : 'Live Activity Log'}
                </h3>
                <p className="text-[11px] text-slate-400 font-medium">
                  {lang === 'ar' ? 'آخر العمليات والأحداث المسجلة في النظام' : 'Recent audit operations'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onNavigate('logs')}
              className="px-2.5 py-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 border border-indigo-100 rounded-lg transition cursor-pointer flex items-center gap-1 shadow-2xs"
            >
              <span>{lang === 'ar' ? 'عرض الكل' : 'View All'}</span>
              <ArrowRight className={`w-3 h-3 ${isRTL ? 'rotate-180' : ''}`} />
            </button>
          </div>

          <div className="flex-1 space-y-2 max-h-[290px] overflow-y-auto pr-1 no-scrollbar">
            {logs.slice(0, 5).map((log) => {
              const act = (log.action || '').toLowerCase();
              const details = (log.details || '').toLowerCase();
              
              let IconComp = Activity;
              let badgeStyle = 'bg-slate-100 text-slate-700 border-slate-200/80';
              let iconStyle = 'bg-slate-100 text-slate-700';
              let actionTitle = lang === 'ar' ? 'نشاط عام' : 'System';

              if (act.includes('sale') || act.includes('invoice') || details.includes('فاتورة') || details.includes('invoice')) {
                IconComp = ShoppingCart;
                badgeStyle = 'bg-emerald-50 text-emerald-700 border-emerald-200/80';
                iconStyle = 'bg-emerald-100 text-emerald-700';
                actionTitle = lang === 'ar' ? 'عملية بيع' : 'Sale';
              } else if (act.includes('purchase') || act.includes('procure') || details.includes('شراء') || details.includes('مورد')) {
                IconComp = Truck;
                badgeStyle = 'bg-indigo-50 text-indigo-700 border-indigo-200/80';
                iconStyle = 'bg-indigo-100 text-indigo-700';
                actionTitle = lang === 'ar' ? 'فاتورة شراء' : 'Purchase';
              } else if (act.includes('product') || act.includes('inventory') || act.includes('stock') || details.includes('مخزن') || details.includes('منتج')) {
                IconComp = Package;
                badgeStyle = 'bg-amber-50 text-amber-700 border-amber-200/80';
                iconStyle = 'bg-amber-100 text-amber-700';
                actionTitle = lang === 'ar' ? 'حركة المخزون' : 'Inventory';
              } else if (act.includes('customer') || act.includes('debt') || act.includes('client') || details.includes('زبون') || details.includes('دين')) {
                IconComp = Users;
                badgeStyle = 'bg-purple-50 text-purple-700 border-purple-200/80';
                iconStyle = 'bg-purple-100 text-purple-700';
                actionTitle = lang === 'ar' ? 'حساب الزبون' : 'Customer';
              } else if (act.includes('expense') || act.includes('مصروف') || act.includes('charge')) {
                IconComp = DollarSign;
                badgeStyle = 'bg-rose-50 text-rose-700 border-rose-200/80';
                iconStyle = 'bg-rose-100 text-rose-700';
                actionTitle = lang === 'ar' ? 'مصاريف' : 'Expense';
              }

              const logTime = new Date(log.timestamp).toLocaleTimeString('fr-FR', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
              });

              return (
                <div
                  key={log.id}
                  className="p-2.5 bg-slate-50/70 hover:bg-slate-50 rounded-xl border border-slate-200/60 transition flex items-start gap-2.5 text-xs group"
                >
                  <div className={`w-7 h-7 rounded-lg ${iconStyle} flex items-center justify-center shrink-0 mt-0.5 shadow-2xs`}>
                    <IconComp className="w-3.5 h-3.5" />
                  </div>

                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-black border ${badgeStyle}`}>
                        {actionTitle}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono font-bold shrink-0">
                        {logTime}
                      </span>
                    </div>

                    <p className="text-slate-700 text-xs font-semibold leading-relaxed line-clamp-2">
                      {log.details}
                    </p>

                    <div className="flex items-center gap-1 text-[10px] text-slate-400 font-medium">
                      <UserCheck className="w-3 h-3 text-slate-400" />
                      <span>{log.userName || 'System'}</span>
                    </div>
                  </div>
                </div>
              );
            })}

            {logs.length === 0 && (
              <div className="text-center py-10 space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto opacity-70" />
                <p className="text-slate-400 text-xs font-bold">
                  {lang === 'ar' ? 'لا توجد أي أنشطة مسجلة حالياً.' : 'No system logs registered.'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
