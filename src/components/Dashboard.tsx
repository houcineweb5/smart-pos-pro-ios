/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Invoice, Product, Customer, Language, StoreConfig, Supplier, Expense } from '../types';
import { languages } from '../languages';
import { TrendingUp, AlertCircle, ShoppingBag, ArrowUpRight, ArrowDownRight, Award, DollarSign, Layers, ReceiptText, Printer, FileDown } from 'lucide-react';
import { printHtmlContent, exportStructuredPdf, PdfDocumentMeta } from '../utils/printService';

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

  const resolveUnitCost = (item: Invoice['items'][number]) => {
    if (Number(item.purchasePrice) > 0) return Number(item.purchasePrice);
    const cleanName = String(item.productName || '').trim().toLowerCase();
    const matched = products.find(
      (p) =>
        (item.productId && p.id === item.productId) ||
        (cleanName && p.name.trim().toLowerCase() === cleanName)
    );
    return Number(matched?.purchasePrice || 0);
  };

  const getInvoiceNetFigures = (inv: Invoice) => {
    const returns = inv.returnedItems || [];
    const refundSum = returns.reduce((acc, r) => acc + Number(r.refundAmount || 0), 0);
    const netRev = Math.max(0, Number(inv.total || 0) - refundSum);

    let itemsProfit = 0;
    let registeredCount = 0;
    (inv.items || []).forEach((item) => {
      const qty = Number(item.quantity || 0);
      if (qty <= 0) return;
      const matchedProd = item.productId
        ? products.find((p) => p && p.id === item.productId)
        : undefined;
      // Unregistered items (without productId) do not enter into profits
      if (!item.productId || (!matchedProd && !(Number(item.purchasePrice) > 0))) {
        return;
      }
      const returnedQty = returns
        .filter((r) => r.productId === item.productId || r.productName === item.productName)
        .reduce((acc, r) => acc + Number(r.quantity || 0), 0);
      const effectiveQty = Math.max(0, qty - returnedQty);
      if (effectiveQty <= 0) return;

      registeredCount++;
      const unitCost = resolveUnitCost(item);
      const rawSelling = Number(item.sellingPrice) || 0;
      const discPct = Number(item.discount) || 0;
      const netUnitSelling =
        item.total !== undefined && item.total !== null && qty > 0
          ? Number(item.total) / qty
          : rawSelling * (1 - discPct / 100);
      itemsProfit += (netUnitSelling - unitCost) * effectiveQty;
    });

    if (registeredCount === 0) {
      return { netRev, netProfit: 0 };
    }

    const subtotal = Number(inv.subtotal) || 0;
    const rawDiscount = Number(inv.discount) || 0;
    const itemDiscountsSum = (inv.items || []).reduce(
      (s, it) => s + (Number(it.sellingPrice) || 0) * ((Number(it.discount) || 0) / 100) * (Number(it.quantity) || 0),
      0
    );
    const extraFlatDiscount = Math.max(0, rawDiscount - itemDiscountsSum);
    const netProfit = itemsProfit - (subtotal > 0 ? extraFlatDiscount : 0);

    return { netRev, netProfit };
  };

  // Advanced financial metrics
  const totalRevenue = periodInvoices.reduce((sum, inv) => sum + getInvoiceNetFigures(inv).netRev, 0);
  const totalTransactions = periodInvoices.length;
  
  // Calculate true net profit = selling total - purchase total (including raw item quantities & custom discounts)
  const totalProfit = periodInvoices.reduce((sum, inv) => sum + getInvoiceNetFigures(inv).netProfit, 0);

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
        const { netRev, netProfit } = getInvoiceNetFigures(inv);
        salesMap[dateKey].revenue += netRev;
        salesMap[dateKey].profit += netProfit;
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
    periodInvoices.forEach((inv) => {
      const returns = inv.returnedItems || [];
      inv.items.forEach((item) => {
        const returnedQty = returns
          .filter((r) => r.productId === item.productId || r.productName === item.productName)
          .reduce((acc, r) => acc + Number(r.quantity || 0), 0);
        const returnedAmt = returns
          .filter((r) => r.productId === item.productId || r.productName === item.productName)
          .reduce((acc, r) => acc + Number(r.refundAmount || 0), 0);
        const effQty = Math.max(0, Number(item.quantity || 0) - returnedQty);
        const effRev = Math.max(0, Number(item.total || 0) - returnedAmt);
        if (effQty <= 0) return;
        if (!productSales[item.productName]) {
          productSales[item.productName] = { quantity: 0, revenue: 0 };
        }
        productSales[item.productName].quantity += effQty;
        productSales[item.productName].revenue += effRev;
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

    periodInvoices.forEach((inv) => {
      const returns = inv.returnedItems || [];
      inv.items.forEach((item) => {
        const returnedAmt = returns
          .filter((r) => r.productId === item.productId || r.productName === item.productName)
          .reduce((acc, r) => acc + Number(r.refundAmount || 0), 0);
        const effRev = Math.max(0, Number(item.total || 0) - returnedAmt);
        if (effRev <= 0) return;
        const cleanName = String(item.productName || '').trim().toLowerCase();
        const prod = products.find(
          (p) => (item.productId && p.id === item.productId) || (cleanName && p.name.trim().toLowerCase() === cleanName)
        );
        const cat = prod ? prod.category : 'General';
        shares[cat] = (shares[cat] || 0) + effRev;
        grandTotal += effRev;
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

  const getPeriodMetrics = (mode: 'today' | 'week' | 'month' | 'all') => {
    const now = new Date();
    const invs = invoices.filter((inv) => {
      const invDate = new Date(inv.date);
      if (mode === 'today') return invDate.toDateString() === now.toDateString();
      if (mode === 'week') {
        const oneWeekAgo = new Date(now);
        oneWeekAgo.setDate(now.getDate() - 7);
        return invDate >= oneWeekAgo;
      }
      if (mode === 'month') {
        const oneMonthAgo = new Date(now);
        oneMonthAgo.setMonth(now.getMonth() - 1);
        return invDate >= oneMonthAgo;
      }
      return true;
    });
    const exps = (expenses || []).filter((exp) => {
      const expDate = new Date(exp.date);
      if (mode === 'today') return expDate.toDateString() === now.toDateString();
      if (mode === 'week') {
        const oneWeekAgo = new Date(now);
        oneWeekAgo.setDate(now.getDate() - 7);
        return expDate >= oneWeekAgo;
      }
      if (mode === 'month') {
        return expDate.getMonth() === now.getMonth() && expDate.getFullYear() === now.getFullYear();
      }
      return true;
    });
    const rev = invs.reduce((s, inv) => s + getInvoiceNetFigures(inv).netRev, 0);
    const grossProfit = invs.reduce((s, inv) => s + getInvoiceNetFigures(inv).netProfit, 0);
    const expSum = exps.reduce((s, e) => s + Number(e.amount || 0), 0);
    return {
      count: invs.length,
      rev,
      grossProfit,
      expSum,
      netProfit: grossProfit - expSum,
    };
  };

  const buildSalesAndDebtsReportData = () => {
    const daily = getPeriodMetrics('today');
    const weekly = getPeriodMetrics('week');
    const monthly = getPeriodMetrics('month');
    const allTime = getPeriodMetrics('all');

    const periodLabel =
      timeFilter === 'today'
        ? (lang === 'ar' ? 'اليوم' : 'Today')
        : timeFilter === 'week'
        ? (lang === 'ar' ? 'الأسبوع (آخر 7 أيام)' : 'This Week')
        : timeFilter === 'month'
        ? (lang === 'ar' ? 'الشهر' : 'This Month')
        : timeFilter === 'custom'
        ? `${fromDate || '...'} -> ${toDate || '...'}`
        : (lang === 'ar' ? 'الكل (شامل)' : 'All Time');

    const customersWithDebt = customers.filter((c) => Number(c.debt || 0) > 0);
    const suppliersWithDebt = suppliers.filter((s) => Number(s.debt || 0) > 0);
    const storeTitle = config.name || 'Smart POS';

    const reportPdfMeta: PdfDocumentMeta = {
      title: lang === 'ar' ? 'تقرير المبيعات والأرباح والديون' : 'Sales, Profits & Debts Report',
      docNumber: `REP-${new Date().toISOString().slice(0, 10)}`,
      date: new Date().toLocaleString('fr-FR'),
      storeName: storeTitle,
      storePhone: config.phone,
      storeAddress: config.address,
      storeEmail: config.email,
      storeRegNumber: config.registrationNumber,
      customerLabel: lang === 'ar' ? 'الفترة الزمنية للتقرير:' : 'Report Period:',
      customerName: periodLabel,
      currency: config.currency,
      mode: 'a4',
      isRTL,
      summaryCards: [
        {
          label: lang === 'ar' ? `مبيعات الفترة (${periodLabel})` : `Period Sales (${periodLabel})`,
          value: `${totalRevenue.toFixed(2)} ${config.currency} (${totalTransactions})`,
          color: '#0f172a'
        },
        {
          label: lang === 'ar' ? 'مجمل / صافي الربح' : 'Gross / Net Profit',
          value: `${totalProfit.toFixed(2)} / ${trueNetOperatingProfit.toFixed(2)} ${config.currency}`,
          color: '#047857'
        },
        {
          label: lang === 'ar' ? 'ديون الزبائن / الموردين' : 'Customer / Supplier Debts',
          value: `${totalDebt.toFixed(2)} / ${totalSupplierDebt.toFixed(2)} ${config.currency}`,
          color: '#be123c'
        }
      ],
      customTableHeaders: {
        name: lang === 'ar' ? 'الزبون / رقم الفاتورة' : 'Customer / Invoice',
        qty: lang === 'ar' ? 'التاريخ' : 'Date',
        price: lang === 'ar' ? 'ربح الفاتورة' : 'Profit',
        total: lang === 'ar' ? 'صافي الفاتورة' : 'Net Total'
      },
      items: periodInvoices.map((inv) => {
        const figs = getInvoiceNetFigures(inv);
        return {
          name: `${inv.customerName || '-'} (${inv.invoiceNumber || '#' + inv.id.slice(0, 8)})`,
          quantity: inv.date ? new Date(inv.date).toLocaleDateString('fr-FR') : '-',
          unitPrice: figs.netProfit,
          total: figs.netRev
        };
      }),
      extraSections: [
        {
          title: lang === 'ar' ? '1. ملخص الأرباح والمبيعات (اليومي، الأسبوعي، الشهري، الشامل)' : '1. Sales & Profits Summary',
          headers: [
            lang === 'ar' ? 'الفترة' : 'Period',
            lang === 'ar' ? 'الفواتير' : 'Invoices',
            lang === 'ar' ? 'المبيعات' : 'Sales',
            lang === 'ar' ? 'مجمل الربح' : 'Gross Profit',
            lang === 'ar' ? 'صافي الربح' : 'Net Profit'
          ],
          rows: [
            [
              lang === 'ar' ? 'اليوم' : 'Today',
              String(daily.count),
              `${daily.rev.toFixed(2)} ${config.currency}`,
              `${daily.grossProfit.toFixed(2)} ${config.currency}`,
              `${daily.netProfit.toFixed(2)} ${config.currency}`
            ],
            [
              lang === 'ar' ? 'الأسبوع (7 أيام)' : 'Weekly',
              String(weekly.count),
              `${weekly.rev.toFixed(2)} ${config.currency}`,
              `${weekly.grossProfit.toFixed(2)} ${config.currency}`,
              `${weekly.netProfit.toFixed(2)} ${config.currency}`
            ],
            [
              lang === 'ar' ? 'الشهر (30 يوم)' : 'Monthly',
              String(monthly.count),
              `${monthly.rev.toFixed(2)} ${config.currency}`,
              `${monthly.grossProfit.toFixed(2)} ${config.currency}`,
              `${monthly.netProfit.toFixed(2)} ${config.currency}`
            ],
            [
              lang === 'ar' ? 'الإجمالي العام' : 'All Time',
              String(allTime.count),
              `${allTime.rev.toFixed(2)} ${config.currency}`,
              `${allTime.grossProfit.toFixed(2)} ${config.currency}`,
              `${allTime.netProfit.toFixed(2)} ${config.currency}`
            ]
          ]
        },
        {
          title: lang === 'ar' ? '2. بيان الديون المستحقة (ديون الزبائن والموردين)' : '2. Customer & Supplier Debts',
          headers: [
            lang === 'ar' ? 'الاسم' : 'Name',
            lang === 'ar' ? 'الصفة' : 'Type',
            lang === 'ar' ? 'الهاتف' : 'Phone',
            lang === 'ar' ? 'مبلغ الدين' : 'Debt Amount'
          ],
          rows:
            customersWithDebt.length === 0 && suppliersWithDebt.length === 0
              ? [[lang === 'ar' ? 'لا توجد ديون مسجلة' : 'No active debts', '-', '-', `0.00 ${config.currency}`]]
              : [
                  ...customersWithDebt.map((c) => [
                    c.name,
                    lang === 'ar' ? 'زبون (كريدي)' : 'Customer',
                    c.phone || '-',
                    `${Number(c.debt || 0).toFixed(2)} ${config.currency}`
                  ]),
                  ...suppliersWithDebt.map((s) => [
                    s.name,
                    lang === 'ar' ? 'مورد' : 'Supplier',
                    s.phone || '-',
                    `${Number(s.debt || 0).toFixed(2)} ${config.currency}`
                  ])
                ]
        }
      ],
      subtotal: totalRevenue,
      total: totalRevenue,
      remainingDebt: totalDebt,
      notes: `${lang === 'ar' ? 'صافي الربح التشغيلي للفترة:' : 'Net Operating Profit:'} ${trueNetOperatingProfit.toFixed(2)} ${config.currency} | ${lang === 'ar' ? 'إجمالي ديون الزبائن:' : 'Customer Debts:'} ${totalDebt.toFixed(2)} ${config.currency}`
    };

    const html = `
      <style>
        .smartpos-report-print { font-family: 'Cairo', 'Tajawal', 'Segoe UI', Tahoma, Arial, sans-serif; color: #0f172a; background: #fff; font-size: 12px; direction: ${isRTL ? 'rtl' : 'ltr'}; }
        .smartpos-report-print * { box-sizing: border-box; }
        .smartpos-report-print .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px; }
        .smartpos-report-print .title { font-size: 18px; font-weight: 900; margin: 0; color: #1e1b4b; }
        .smartpos-report-print .subtitle { font-size: 11px; color: #475569; margin-top: 4px; font-weight: 700; }
        .smartpos-report-print .section-title { font-size: 13px; font-weight: 800; margin: 16px 0 8px; padding: 6px 10px; background: #f1f5f9; border-${isRTL ? 'right' : 'left'}: 4px solid #4f46e5; border-radius: 4px; }
        .smartpos-report-print table { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
        .smartpos-report-print th, .smartpos-report-print td { border: 1px solid #cbd5e1; padding: 7px 9px; text-align: ${isRTL ? 'right' : 'left'}; font-size: 11px; }
        .smartpos-report-print th { background: #f8fafc; font-weight: 800; color: #1e293b; }
        .smartpos-report-print .kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 14px; }
        .smartpos-report-print .kpi-box { border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px; background: #f8fafc; }
        .smartpos-report-print .kpi-label { font-size: 10px; color: #64748b; font-weight: 700; }
        .smartpos-report-print .kpi-val { font-size: 15px; font-weight: 900; margin-top: 3px; font-family: monospace; }
        .smartpos-report-print .profit { color: #047857; font-weight: 800; }
        .smartpos-report-print .debt { color: #be123c; font-weight: 800; }
      </style>
      <div class="smartpos-report-print" dir="${isRTL ? 'rtl' : 'ltr'}">
        <div class="header">
          <div>
            <h1 class="title">${storeTitle} - ${lang === 'ar' ? 'تقرير المبيعات والأرباح والديون' : 'Sales, Profits & Debts Report'}</h1>
            <div class="subtitle">${lang === 'ar' ? 'الفترة المحددة:' : 'Selected Period:'} ${periodLabel} | ${lang === 'ar' ? 'تاريخ الطباعة:' : 'Printed:'} ${new Date().toLocaleString('fr-FR')}</div>
          </div>
          <div style="text-align:${isRTL ? 'left' : 'right'}; font-size:11px; font-weight:700;">
            <div>${config.phone || ''}</div>
            <div>${config.address || ''}</div>
          </div>
        </div>

        <div class="kpi-grid">
          <div class="kpi-box">
            <div class="kpi-label">${lang === 'ar' ? 'مبيعات الفترة المحددة' : 'Selected Period Sales'} (${periodLabel})</div>
            <div class="kpi-val">${totalRevenue.toFixed(2)} ${config.currency} (${totalTransactions} ${lang === 'ar' ? 'فاتورة' : 'inv'})</div>
          </div>
          <div class="kpi-box">
            <div class="kpi-label">${lang === 'ar' ? 'إجمالي وصافي ربح الفترة' : 'Period Gross / Net Profit'}</div>
            <div class="kpi-val profit">${totalProfit.toFixed(2)} / ${trueNetOperatingProfit.toFixed(2)} ${config.currency}</div>
          </div>
          <div class="kpi-box">
            <div class="kpi-label">${lang === 'ar' ? 'ديون الزبائن / ديون الموردين' : 'Customer / Supplier Debts'}</div>
            <div class="kpi-val debt">${totalDebt.toFixed(2)} / ${totalSupplierDebt.toFixed(2)} ${config.currency}</div>
          </div>
        </div>

        <div class="section-title">${lang === 'ar' ? '1. ملخص الأرباح والمبيعات (اليومية، الأسبوعية، الشهرية، والشاملة)' : '1. Daily, Weekly, Monthly & Total Sales and Profits'}</div>
        <table>
          <thead>
            <tr>
              <th>${lang === 'ar' ? 'الفترة الزمنية' : 'Period'}</th>
              <th>${lang === 'ar' ? 'عدد الفواتير' : 'Invoices'}</th>
              <th>${lang === 'ar' ? 'إجمالي المبيعات' : 'Total Sales'}</th>
              <th>${lang === 'ar' ? 'مجمل الربح' : 'Gross Profit'}</th>
              <th>${lang === 'ar' ? 'المصاريف' : 'Expenses'}</th>
              <th>${lang === 'ar' ? 'صافي الربح الحقيقي' : 'True Net Profit'}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><b>${lang === 'ar' ? 'اليوم (يومي)' : 'Today (Daily)'}</b></td>
              <td>${daily.count}</td>
              <td>${daily.rev.toFixed(2)} ${config.currency}</td>
              <td class="profit">${daily.grossProfit.toFixed(2)} ${config.currency}</td>
              <td class="debt">${daily.expSum.toFixed(2)} ${config.currency}</td>
              <td class="profit">${daily.netProfit.toFixed(2)} ${config.currency}</td>
            </tr>
            <tr>
              <td><b>${lang === 'ar' ? 'الأسبوع (آخر 7 أيام)' : 'Weekly (Last 7 Days)'}</b></td>
              <td>${weekly.count}</td>
              <td>${weekly.rev.toFixed(2)} ${config.currency}</td>
              <td class="profit">${weekly.grossProfit.toFixed(2)} ${config.currency}</td>
              <td class="debt">${weekly.expSum.toFixed(2)} ${config.currency}</td>
              <td class="profit">${weekly.netProfit.toFixed(2)} ${config.currency}</td>
            </tr>
            <tr>
              <td><b>${lang === 'ar' ? 'الشهر (آخر 30 يوم)' : 'Monthly (Last 30 Days)'}</b></td>
              <td>${monthly.count}</td>
              <td>${monthly.rev.toFixed(2)} ${config.currency}</td>
              <td class="profit">${monthly.grossProfit.toFixed(2)} ${config.currency}</td>
              <td class="debt">${monthly.expSum.toFixed(2)} ${config.currency}</td>
              <td class="profit">${monthly.netProfit.toFixed(2)} ${config.currency}</td>
            </tr>
            <tr>
              <td><b>${lang === 'ar' ? 'الإجمالي العام (الكل)' : 'All Time Total'}</b></td>
              <td>${allTime.count}</td>
              <td>${allTime.rev.toFixed(2)} ${config.currency}</td>
              <td class="profit">${allTime.grossProfit.toFixed(2)} ${config.currency}</td>
              <td class="debt">${allTime.expSum.toFixed(2)} ${config.currency}</td>
              <td class="profit">${allTime.netProfit.toFixed(2)} ${config.currency}</td>
            </tr>
          </tbody>
        </table>

        <div class="section-title">${lang === 'ar' ? '2. بيان الديون المستحقة (ديون الزبائن وديون الموردين)' : '2. Customer & Supplier Debts Statement'}</div>
        <table>
          <thead>
            <tr>
              <th>${lang === 'ar' ? 'الاسم (زبون / مورد)' : 'Name'}</th>
              <th>${lang === 'ar' ? 'النوع' : 'Type'}</th>
              <th>${lang === 'ar' ? 'الهاتف' : 'Phone'}</th>
              <th>${lang === 'ar' ? 'مبلغ الدين' : 'Debt Amount'}</th>
            </tr>
          </thead>
          <tbody>
            ${customersWithDebt.map((c) => `
              <tr>
                <td><b>${c.name}</b></td>
                <td>${lang === 'ar' ? 'زبون (كريدي)' : 'Customer'}</td>
                <td>${c.phone || '-'}</td>
                <td class="debt">${Number(c.debt || 0).toFixed(2)} ${config.currency}</td>
              </tr>
            `).join('')}
            ${suppliersWithDebt.map((s) => `
              <tr>
                <td><b>${s.name}</b></td>
                <td>${lang === 'ar' ? 'مورد' : 'Supplier'}</td>
                <td>${s.phone || '-'}</td>
                <td class="debt">${Number(s.debt || 0).toFixed(2)} ${config.currency}</td>
              </tr>
            `).join('')}
            ${customersWithDebt.length === 0 && suppliersWithDebt.length === 0 ? `
              <tr><td colspan="4" style="text-align:center;">${lang === 'ar' ? 'لا توجد ديون مسجلة حالياً' : 'No active debts'}</td></tr>
            ` : ''}
          </tbody>
        </table>

        <div class="section-title">${lang === 'ar' ? `3. تفاصيل فواتير المبيعات والأرباح (${periodLabel})` : `3. Sales Invoices & Profits (${periodLabel})`}</div>
        <table>
          <thead>
            <tr>
              <th>${lang === 'ar' ? 'رقم الفاتورة' : 'Invoice #'}</th>
              <th>${lang === 'ar' ? 'التاريخ' : 'Date'}</th>
              <th>${lang === 'ar' ? 'الزبون' : 'Customer'}</th>
              <th>${lang === 'ar' ? 'مبلغ الفاتورة الصافي' : 'Net Total'}</th>
              <th>${lang === 'ar' ? 'ربح الفاتورة' : 'Profit'}</th>
            </tr>
          </thead>
          <tbody>
            ${periodInvoices.map((inv) => {
              const figs = getInvoiceNetFigures(inv);
              return `
                <tr>
                  <td>${inv.invoiceNumber || '#' + inv.id.slice(0, 8)}</td>
                  <td>${new Date(inv.date).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</td>
                  <td>${inv.customerName || '-'}</td>
                  <td>${figs.netRev.toFixed(2)} ${config.currency}</td>
                  <td class="profit">+${figs.netProfit.toFixed(2)} ${config.currency}</td>
                </tr>
              `;
            }).join('')}
            ${periodInvoices.length === 0 ? `
              <tr><td colspan="5" style="text-align:center;">${lang === 'ar' ? 'لا توجد فواتير في هذه الفترة' : 'No invoices in this period'}</td></tr>
            ` : ''}
          </tbody>
        </table>
      </div>
    `;

    return { html, reportPdfMeta };
  };

  const handlePrintReport = () => {
    const { html, reportPdfMeta } = buildSalesAndDebtsReportData();
    printHtmlContent(
      {
        title: `${reportPdfMeta.title} - ${config.name || 'Smart POS'}`,
        html,
        isRTL,
        mode: 'a4'
      },
      reportPdfMeta
    );
  };

  const handleExportReportPdf = async () => {
    const { reportPdfMeta } = buildSalesAndDebtsReportData();
    await exportStructuredPdf(reportPdfMeta, `Sales-Debts-Report-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

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

        {/* Period Selector & Print / PDF Buttons */}
        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <button
            type="button"
            onClick={handlePrintReport}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-sm transition cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>{lang === 'ar' ? 'طباعة التقرير (المبيعات والديون)' : 'Print Report (Sales & Debts)'}</span>
          </button>

          <button
            type="button"
            onClick={handleExportReportPdf}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-sm transition cursor-pointer"
          >
            <FileDown className="w-4 h-4" />
            <span>PDF</span>
          </button>

          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/50 flex-wrap gap-1">
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
