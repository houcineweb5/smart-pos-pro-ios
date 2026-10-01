/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Invoice, Product, Customer, Language, StoreConfig, Supplier, Expense } from '../types';
import { languages } from '../languages';
import { TrendingUp, AlertCircle, ShoppingBag, ArrowUpRight, ArrowDownRight, Award, DollarSign, Layers, ReceiptText } from 'lucide-react';

interface DashboardProps {
  invoices: Invoice[];
  products: Product[];
  customers: Customer[];
  suppliers?: Supplier[];
  expenses?: Expense[];
  config: StoreConfig;
  lang: Language;
}

export default function Dashboard({ invoices, products, customers, suppliers = [], expenses = [], config, lang }: DashboardProps) {
  const t = languages[lang];
  const isRTL = t.direction === 'rtl';

  const [timeFilter, setTimeFilter] = useState<'all' | 'today' | 'week' | 'month' | 'custom'>('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Filter invoices based on time periods
  const getFilteredInvoices = () => {
    const now = new Date();
    return invoices.filter((inv) => {
      const invDate = new Date(inv.date);
      if (timeFilter === 'today') {
        return invDate.toDateString() === now.toDateString();
      }
      if (timeFilter === 'week') {
        const oneWeekAgo = new Date(now);
        oneWeekAgo.setDate(now.getDate() - 7);
        return invDate >= oneWeekAgo;
      }
      if (timeFilter === 'month') {
        const oneMonthAgo = new Date(now);
        oneMonthAgo.setMonth(now.getMonth() - 1);
        return invDate >= oneMonthAgo;
      }
      if (timeFilter === 'custom') {
        let matches = true;
        const invDateTime = invDate.getTime();
        if (fromDate) {
          const start = new Date(fromDate).getTime();
          if (invDateTime < start) matches = false;
        }
        if (toDate) {
          const end = new Date(toDate);
          end.setHours(23, 59, 59, 999);
          if (invDateTime > end.getTime()) matches = false;
        }
        return matches;
      }
      return true; // all
    });
  };

  const periodInvoices = getFilteredInvoices();

  // Advanced financial metrics
  const totalRevenue = periodInvoices.reduce((sum, inv) => sum + inv.total, 0);
  const totalTransactions = periodInvoices.length;
  
  // Calculate true net profit = selling total - purchase total (including raw item quantities & custom discounts)
  const totalProfit = periodInvoices.reduce((sum, inv) => {
    let invoiceCost = 0;
    inv.items.forEach((item) => {
      invoiceCost += (item.purchasePrice * item.quantity);
    });
    // Profit is total revenue (including taxes) minus the purchase cost of sold inventory
    return sum + (inv.total - invoiceCost);
  }, 0);

  // Debt sum
  const totalDebt = customers.reduce((sum, c) => sum + Math.max(0, c.debt), 0);

  // Supplier debt sum
  const totalSupplierDebt = suppliers.reduce((sum, s) => sum + Math.max(0, s.debt), 0);
  const realAdjustedProfit = totalProfit - totalSupplierDebt;

  // Operating Expenses calculation for selected period
  const getFilteredExpenses = () => {
    const now = new Date();
    return (expenses || []).filter((exp) => {
      const expDate = new Date(exp.date);
      if (timeFilter === 'today') return expDate.toDateString() === now.toDateString();
      if (timeFilter === 'week') {
        const oneWeekAgo = new Date(now);
        oneWeekAgo.setDate(now.getDate() - 7);
        return expDate >= oneWeekAgo;
      }
      if (timeFilter === 'month') {
        return expDate.getMonth() === now.getMonth() && expDate.getFullYear() === now.getFullYear();
      }
      if (timeFilter === 'custom') {
        let matches = true;
        const expDateTime = expDate.getTime();
        if (fromDate) {
          const start = new Date(fromDate).getTime();
          if (expDateTime < start) matches = false;
        }
        if (toDate) {
          const end = new Date(toDate);
          end.setHours(23, 59, 59, 999);
          if (expDateTime > end.getTime()) matches = false;
        }
        return matches;
      }
      return true;
    });
  };

  const periodExpenses = getFilteredExpenses();
  const totalOperatingExpenses = periodExpenses.reduce((sum, e) => sum + e.amount, 0);
  const trueNetOperatingProfit = totalProfit - totalOperatingExpenses;

  // Products with low inventory alert
  const lowStockCount = products.filter((p) => p.stock <= p.minStock).length;

  // Compute daily sales for line chart visualization (Grouping last 7 dates)
  const getDailySalesData = () => {
    const salesMap: Record<string, { revenue: number; profit: number }> = {};
    const last7Days: string[] = [];

    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const label = d.toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' });
      last7Days.push(label);
      salesMap[d.toDateString()] = { revenue: 0, profit: 0 };
    }

    // Accumulate
    invoices.forEach((inv) => {
      const dateKey = new Date(inv.date).toDateString();
      if (salesMap[dateKey] !== undefined) {
        let cost = 0;
        inv.items.forEach((it) => { cost += (it.purchasePrice * it.quantity); });
        salesMap[dateKey].revenue += inv.total;
        salesMap[dateKey].profit += (inv.total - cost);
      }
    });

    return last7Days.map((label, index) => {
      const d = new Date(now);
      d.setDate(now.getDate() - (6 - index));
      const val = salesMap[d.toDateString()] || { revenue: 0, profit: 0 };
      return {
        label,
        revenue: val.revenue,
        profit: val.profit,
      };
    });
  };

  const dailyChartData = getDailySalesData();

  // Compute Top product rankings
  const getTopProducts = () => {
    const productSales: Record<string, { quantity: number; revenue: number }> = {};
    invoices.forEach((inv) => {
      inv.items.forEach((item) => {
        if (!productSales[item.productName]) {
          productSales[item.productName] = { quantity: 0, revenue: 0 };
        }
        productSales[item.productName].quantity += item.quantity;
        productSales[item.productName].revenue += item.total;
      });
    });

    return Object.entries(productSales)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 4);
  };

  const topProducts = getTopProducts();

  // Compute Categories share distribution
  const getCategoryShare = () => {
    const shares: Record<string, number> = {};
    let grandTotal = 0;

    invoices.forEach((inv) => {
      inv.items.forEach((item) => {
        const prod = products.find((p) => p.id === item.productId);
        const cat = prod ? prod.category : 'General';
        shares[cat] = (shares[cat] || 0) + item.total;
        grandTotal += item.total;
      });
    });

    return Object.entries(shares).map(([name, total]) => ({
      name,
      total,
      percentage: grandTotal > 0 ? (total / grandTotal) * 100 : 0,
    }));
  };

  const categoriesDistribution = getCategoryShare();

  const getThemePrimaryColor = (theme?: string) => {
    switch (theme) {
      case 'sky': return '#0ea5e9';
      case 'emerald': return '#10b981';
      case 'rose': return '#f43f5e';
      case 'amber': return '#f59e0b';
      case 'purple':
      case 'indigo':
      default:
        return '#6366f1';
    }
  };
  const themePrimary = getThemePrimaryColor(config.themeColor);

  return (
    <div className="space-y-5 animate-fade-in" id="dashboard-sec">
      {/* Upper stats bar and time options */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-slate-100 shadow-xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <TrendingUp className="w-6 h-6 text-indigo-600" />
            {t.reports.title}
          </h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            {lang === 'ar' ? 'متابعة وتدقيق الأرباح والمبيعات ومخزون المنتجات في الوقت الفعلي' : 'Realtime balance audits, transactional volumes, and visual warehouse forecasts.'}
          </p>
        </div>

        {/* Period Selector */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/50 self-start sm:self-auto flex-wrap gap-1">
          {['all', 'today', 'week', 'month', 'custom'].map((period) => (
            <button
              id={`report-time-${period}`}
              key={period}
              onClick={() => setTimeFilter(period as any)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition whitespace-nowrap uppercase cursor-pointer ${
                timeFilter === period ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {period === 'all'
                ? t.reports.period + ' All'
                : period === 'today'
                ? t.reports.today
                : period === 'week'
                ? t.reports.week
                : period === 'month'
                ? t.reports.month
                : (lang === 'ar' ? 'تاريخ مخصص' : 'Custom')}
            </button>
          ))}
        </div>
      </div>

      {timeFilter === 'custom' && (
        <div className="flex flex-col sm:flex-row gap-4 items-center bg-white p-4 rounded-xl border border-slate-100 shadow-xs text-xs animate-fade-in">
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

      {/* Modern High-contrast KPI Cards - Refined Compact Typography */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5" id="kpi-dash-cards">
        {/* Card 1: Gross Sales */}
        <div className="bg-white border border-slate-100 p-4 rounded-xl shadow-xs relative overflow-hidden flex flex-col justify-between h-32">
          <div className="flex justify-between items-start">
            <div className="text-start">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
                {t.reports.revenue}
              </span>
              <h2 className="text-base font-bold text-slate-900 mt-0.5 font-mono">{totalRevenue.toFixed(2)} {config.currency}</h2>
            </div>
            <span className="px-2 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg font-bold text-[10px] shadow-xs font-mono">
              MAD
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-emerald-600 pt-2 border-t border-slate-50">
            <ArrowUpRight className="w-3 h-3 shrink-0" />
            <span>{totalTransactions} {lang === 'ar' ? 'عملية بيع' : 'sales'}</span>
          </div>
        </div>

        {/* Card 2: Operating Expenses */}
        <div className="bg-white border border-rose-100 p-4 rounded-xl shadow-xs relative overflow-hidden flex flex-col justify-between h-32">
          <div className="flex justify-between items-start">
            <div className="text-start">
              <span className="text-[10px] text-rose-500 font-bold uppercase tracking-wider block">
                {lang === 'ar' ? 'المصاريف التشغيلية' : lang === 'fr' ? 'Dépenses' : 'Expenses'}
              </span>
              <h2 className="text-base font-bold text-rose-600 mt-0.5 font-mono">-{totalOperatingExpenses.toFixed(2)} {config.currency}</h2>
            </div>
            <span className="p-1.5 bg-rose-50 rounded-lg text-rose-600">
              <ReceiptText className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-rose-500 pt-2 border-t border-slate-50">
            <span>{periodExpenses.length} {lang === 'ar' ? 'مصروف مسجل' : 'logged'}</span>
          </div>
        </div>

        {/* Card 3: True Net Profit (After Expenses) */}
        <div className="bg-white border border-emerald-100 p-4 rounded-xl shadow-xs relative overflow-hidden flex flex-col justify-between h-32">
          <div className="flex justify-between items-start">
            <div className="text-start">
              <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider block">
                {lang === 'ar' ? 'صافي الربح الحقيقي' : lang === 'fr' ? 'Bénéfice Net Réel' : 'True Net Profit'}
              </span>
              <h2 className={`text-base font-bold mt-0.5 font-mono ${trueNetOperatingProfit >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                {trueNetOperatingProfit.toFixed(2)} {config.currency}
              </h2>
            </div>
            <span className="p-1.5 bg-emerald-50 rounded-lg text-emerald-600">
              <TrendingUp className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="flex justify-between items-center text-[10px] text-slate-500 pt-2 border-t border-slate-50">
            <span>{lang === 'ar' ? 'مجمل المبيعات:' : 'Gross:'}</span>
            <span className="font-bold text-slate-700 font-mono">{totalProfit.toFixed(2)}</span>
          </div>
        </div>

        {/* Card 4: Customer Debt */}
        <div className="bg-white border border-slate-100 p-4 rounded-xl shadow-xs relative overflow-hidden flex flex-col justify-between h-32">
          <div className="flex justify-between items-start">
            <div className="text-start">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                {t.reports.totalDebt}
              </span>
              <h2 className="text-base font-bold text-rose-600 mt-0.5 font-mono">{totalDebt.toFixed(2)} {config.currency}</h2>
            </div>
            <span className="p-1.5 bg-rose-50 rounded-lg text-rose-600">
              <AlertCircle className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-rose-500 pt-2 border-t border-slate-50">
            <AlertCircle className="w-3 h-3 shrink-0" />
            <span>{lang === 'ar' ? 'ديون الزبائن' : 'Customer debts'}</span>
          </div>
        </div>

        {/* Card 5: Supplier Debt */}
        <div className="bg-white border border-amber-100 p-4 rounded-xl shadow-xs relative overflow-hidden flex flex-col justify-between h-32">
          <div className="flex justify-between items-start">
            <div className="text-start">
              <span className="text-[10px] text-amber-700 font-bold uppercase tracking-wider block">
                {lang === 'ar' ? 'ديون الموردين' : 'Supplier Debts'}
              </span>
              <h2 className="text-base font-bold text-amber-700 mt-0.5 font-mono">{totalSupplierDebt.toFixed(2)} {config.currency}</h2>
            </div>
            <span className="p-1.5 bg-amber-50 rounded-lg text-amber-700">
              <ArrowDownRight className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-amber-700 pt-2 border-t border-slate-50">
            <span>{lang === 'ar' ? 'واجبة السداد للموردين' : 'Payable to vendors'}</span>
          </div>
        </div>

        {/* Card 6: Low Stock Products */}
        <div className="bg-white border border-slate-100 p-4 rounded-xl shadow-xs relative overflow-hidden flex flex-col justify-between h-32">
          <div className="flex justify-between items-start">
            <div className="text-start">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                {lang === 'ar' ? 'نواقص المخزن' : 'Low Stock'}
              </span>
              <h2 className="text-base font-bold text-slate-800 mt-0.5 font-mono">{lowStockCount} <span className="text-[11px] font-medium text-slate-400">{lang === 'ar' ? 'سلعة' : 'items'}</span></h2>
            </div>
            <span className="p-1.5 bg-slate-100 rounded-lg text-slate-600">
              <ShoppingBag className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-slate-500 pt-2 border-t border-slate-50">
            <span>{lang === 'ar' ? 'تحت الحد الأدنى' : 'Below threshold'}</span>
          </div>
        </div>
      </div>

      {/* Advanced Chart Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5" id="dashboard-charts-grid">
        {/* Left Span: Sales progression SVG Line Chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-800 mb-0.5">{t.reports.salesAnalysis}</h3>
            <p className="text-[11px] text-slate-400">Past days total revenue and profit trend lines.</p>
          </div>

          {/* Handcraft SVG progression chart block */}
          <div className="h-52 my-4 relative">
            <svg className="w-full h-full overflow-visible" viewBox="0 0 500 200" preserveAspectRatio="none">
              {/* Grid Lines */}
              <line x1="0" y1="20" x2="500" y2="20" stroke="#f1f5f9" strokeWidth="1" />
              <line x1="0" y1="80" x2="500" y2="80" stroke="#f1f5f9" strokeWidth="1" />
              <line x1="0" y1="140" x2="500" y2="140" stroke="#f1f5f9" strokeWidth="1" />
              <line x1="0" y1="180" x2="500" y2="180" stroke="#e2e8f0" strokeWidth="1.5" />

              {/* Dynamic Path Calculations */}
              {(() => {
                const maxVal = Math.max(...dailyChartData.map((d) => d.revenue), 100);
                const pointsRevenue = dailyChartData.map((d, idx) => {
                  const x = (idx / 6) * 500;
                  const y = 180 - (d.revenue / maxVal) * 150; // map value to SVG heights (0 to 150)
                  return `${x},${y}`;
                });

                const pointsProfit = dailyChartData.map((d, idx) => {
                  const x = (idx / 6) * 500;
                  const y = 180 - (d.profit / maxVal) * 150;
                  return `${x},${y}`;
                });

                return (
                  <>
                    {/* Revenue Area Fill & Path */}
                    <path
                      d={`M 0,180 L ${pointsRevenue.join(' L ')} L 500,180 Z`}
                      fill="url(#revGrad)"
                      opacity="0.25"
                    />
                    <path
                      d={`M ${pointsRevenue.join(' L ')}`}
                      fill="none"
                      stroke={themePrimary}
                      strokeWidth="3.5"
                      strokeLinecap="round"
                    />

                    {/* Profit Path */}
                    <path
                      d={`M ${pointsProfit.join(' L ')}`}
                      fill="none"
                      stroke="#10b981"
                      strokeWidth="2.5"
                      strokeDasharray="4 2"
                      strokeLinecap="round"
                    />

                    {/* Points markers */}
                    {pointsRevenue.map((pt, idx) => {
                      const [cx, cy] = pt.split(',');
                      return (
                        <g key={idx} className="group cursor-pointer">
                          <circle cx={cx} cy={cy} r="4.5" fill={themePrimary} stroke="#fff" strokeWidth="2" />
                          <circle cx={cx} cy={cy} r="9" fill={themePrimary} opacity="0" className="hover:opacity-20 transition" />
                        </g>
                      );
                    })}

                    {/* Gradient Definition */}
                    <defs>
                      <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={themePrimary} />
                        <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                  </>
                );
              })()}
            </svg>

            {/* Floating details panel */}
            <div className="absolute right-2 top-0 bg-slate-900 text-[10px] text-white p-2.5 rounded-lg space-y-1 z-10 shadow-lg font-mono">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                <span>Revenue ({config.currency})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span>Gains ({config.currency})</span>
              </div>
            </div>
          </div>

          {/* X axis tags rendering */}
          <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1 pt-2 border-t border-slate-50">
            {dailyChartData.map((d, index) => (
              <span key={index}>{d.label}</span>
            ))}
          </div>
        </div>

        {/* Right Span: Category distribution lists */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-800 mb-0.5">{t.reports.categoryDistribution}</h3>
            <p className="text-[11px] text-slate-400">Share percentages of sales segments.</p>
          </div>

          <div className="space-y-3.5 my-4 flex-1 flex flex-col justify-center">
            {categoriesDistribution.length > 0 ? (
              categoriesDistribution.map((cat, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between text-[11px] font-semibold">
                    <span className="text-slate-700 capitalize flex items-center gap-1">
                      <Layers className="w-3 h-3 text-slate-400" />
                      {cat.name}
                    </span>
                    <span className="text-slate-900 font-bold">{cat.percentage.toFixed(1)}%</span>
                  </div>
                  {/* Visual progression bar */}
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-600 rounded-full transition-all duration-500"
                      style={{ width: `${cat.percentage}%` }}
                    ></div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-slate-400 text-xs text-center py-10 font-bold">No active shares captured yet.</p>
            )}
          </div>
        </div>
      </div>

      {/* Top Sellers leaderboard and Urgent low stock notifications */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5" id="dashboard-rankings-box">
        {/* Top items products table leaderboard */}
        <div className="bg-white border border-slate-100 p-5 rounded-2xl shadow-xs">
          <h3 className="text-sm font-bold text-slate-800 mb-1 flex items-center gap-2">
            <Award className="w-4 h-4 text-indigo-500" />
            {t.reports.topSelling}
          </h3>
          <p className="text-[11px] text-slate-400 mb-3">The highly cataloged items sold in client directories.</p>

          <div className="space-y-2.5">
            {topProducts.length > 0 ? (
              topProducts.map((p, idx) => (
                <div key={idx} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-xs font-semibold">
                  <div className="flex items-center gap-2.5">
                    <span className="w-5 h-5 rounded-md bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-[10px]">
                      #{idx + 1}
                    </span>
                    <span className="text-slate-800 font-bold line-clamp-1 max-w-[170px] uppercase text-xs">{p.name}</span>
                  </div>

                  <div className="flex items-center gap-3 text-[11px]">
                    <span className="text-slate-400">Qty: <b className="text-slate-700 font-bold">{p.quantity}</b></span>
                    <span className="text-indigo-600 font-bold font-mono">{p.revenue.toFixed(2)} {config.currency}</span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-slate-400 text-xs text-center py-10">Waiting for invoicing records.</p>
            )}
          </div>
        </div>

        {/* Low warehouse notification and alert board */}
        <div className="bg-white border border-slate-150 p-5 rounded-2xl shadow-xs">
          <h3 className="text-sm font-bold text-slate-800 mb-1 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-500" />
            {t.reports.stockWarning}
          </h3>
          <p className="text-[11px] text-slate-400 mb-3">Warehouse tracking segments that reached minimum ordered thresholds.</p>

          <div className="space-y-2 max-h-[200px] overflow-y-auto no-scrollbar">
            {products.filter((p) => p.stock <= p.minStock).slice(0, 4).map((p) => (
              <div key={p.id} className="flex justify-between items-center p-2.5 bg-amber-50/50 border border-amber-100 text-xs font-semibold rounded-xl">
                <div>
                  <h4 className="font-bold text-amber-950 uppercase text-xs">{p.name}</h4>
                  <span className="text-[9px] text-amber-600 font-mono">CODE: {p.sku} | Unit: {p.unit}</span>
                </div>
                <div className="text-end">
                  <span className="font-bold text-amber-900 block text-xs">Stock: {p.stock}</span>
                  <span className="text-[9px] text-slate-400 block">Min: {p.minStock}</span>
                </div>
              </div>
            ))}
            {products.filter((p) => p.stock <= p.minStock).length === 0 && (
              <p className="text-emerald-700 font-bold text-xs text-center py-10">All warehouses are fully stocked ! No alarms present.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
