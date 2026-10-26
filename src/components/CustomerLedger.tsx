/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Customer, Invoice, ActivityLog, Language, StoreConfig } from '../types';
import { 
  ArrowLeft, Calendar, FileText, Printer, Search, TrendingUp, DollarSign, 
  CreditCard, CreditCard as DebtIcon, ChevronDown, ChevronUp, Clock, CheckCircle, AlertCircle, FileDown
} from 'lucide-react';
import { printHtmlContent, exportStructuredPdf, A4_PRINT_THEMES } from '../utils/printService';

interface CustomerLedgerProps {
  customer: Customer;
  invoices: Invoice[];
  logs: ActivityLog[];
  onClose: () => void;
  lang: Language;
  config: StoreConfig;
}

type FilterType = 'all' | 'invoices' | 'payments';

export default function CustomerLedger({ customer, invoices, logs, onClose, lang, config }: CustomerLedgerProps) {
  const isRTL = lang === 'ar';
  
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [expandedInvoiceIds, setExpandedInvoiceIds] = useState<Record<string, boolean>>({});

  const hasDateFilter = Boolean(selectedMonth || fromDate || toDate);

  const matchesDateFilter = (dateStr?: string) => {
    if (!hasDateFilter) return true;
    if (!dateStr) return false;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return false;

    if (selectedMonth) {
      const yearMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (yearMonth !== selectedMonth) return false;
    }
    if (fromDate) {
      const start = new Date(`${fromDate}T00:00:00`).getTime();
      if (d.getTime() < start) return false;
    }
    if (toDate) {
      const end = new Date(`${toDate}T23:59:59.999`).getTime();
      if (d.getTime() > end) return false;
    }
    return true;
  };

  // 1. Get client invoices
  const clientInvoices = invoices.filter((inv) => inv.customerId === customer.id);
  const dateFilteredClientInvoices = clientInvoices.filter((inv) => matchesDateFilter(inv.date));

  // 2. Extract debt settlements for this customer from raw activity logs
  const clientRepayments = logs.filter((log) => {
    const isDebtAction = log.action === 'customer_debt_settled';
    const mentionsCustomer = log.details.toLowerCase().includes(customer.name.toLowerCase()) || 
                             log.details.includes(customer.id);
    return isDebtAction && mentionsCustomer;
  });
  const dateFilteredRepayments = clientRepayments.filter((log) => matchesDateFilter(log.timestamp));

  // 3. Construct unified ledger timeline
  const ledgerItems = [
    ...clientInvoices.map((inv) => ({
      id: inv.id,
      date: inv.date,
      type: 'invoice' as const,
      reference: inv.invoiceNumber,
      title: isRTL ? 'فاتورة مبيعات' : lang === 'fr' ? 'Facture de Vente' : 'Sales Invoice',
      subtitle: inv.paymentMethod === 'debt' 
                ? (isRTL ? 'دفع مؤجل (دين)' : 'Deferred credit (Debt)') 
                : (isRTL ? `دفع نقداً (${inv.paymentMethod})` : `Direct payment (${inv.paymentMethod})`),
      total: inv.total,
      amountPaid: inv.amountPaid,
      debtCreated: inv.total - inv.amountPaid,
      raw: inv,
    })),
    ...clientRepayments.map((log) => {
      // Try to parse amount from details, e.g., "تسوية دفعة ديون بقيمة 150" or "payment of 150"
      const numMatch = log.details.match(/[\d.]+/);
      const parsedAmount = numMatch ? parseFloat(numMatch[0]) : 0;
      return {
        id: log.id,
        date: log.timestamp,
        type: 'payment' as const,
        reference: log.id.slice(-6).toUpperCase(),
        title: isRTL ? 'سداد ديون / دفعه حساب' : lang === 'fr' ? 'Règlement de Dette' : 'Debt Repayment',
        subtitle: isRTL ? 'تسوية حساب الزبون' : 'Client ledger adjustment',
        total: 0,
        amountPaid: parsedAmount,
        debtCreated: -parsedAmount,
        raw: log,
      };
    })
  ].sort((a, b) => {
    return new Date(b.date).getTime() - new Date(a.date).getTime(); // Newest first
  });

  // Filtered timeline
  const filteredLedger = ledgerItems.filter((item) => {
    // Search query matching
    const matchesSearch = item.reference.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          item.subtitle.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (!matchesSearch) return false;
    if (!matchesDateFilter(item.date)) return false;

    // Filter type matching
    if (filter === 'all') return true;
    if (filter === 'invoices') return item.type === 'invoice';
    if (filter === 'payments') return item.type === 'payment';
    return true;
  });

  // Math metrics sums (respects date/month filter when active)
  const activeInvoicesForStats = hasDateFilter ? dateFilteredClientInvoices : clientInvoices;
  const activeRepaymentsForStats = hasDateFilter ? dateFilteredRepayments : clientRepayments;
  const totalInvoicedSum = activeInvoicesForStats.reduce((sum, inv) => sum + inv.total, 0);
  const totalInvoicedPaidSum = activeInvoicesForStats.reduce((sum, inv) => sum + inv.amountPaid, 0);
  const totalOutstandingBillDebt = activeInvoicesForStats.reduce((sum, inv) => sum + (inv.total - inv.amountPaid), 0);
  const totalDirectRepayments = activeRepaymentsForStats.reduce((sum, log) => {
    const match = log.details.match(/[\d.]+/);
    return sum + (match ? parseFloat(match[0]) : 0);
  }, 0);

  // Profit earned from this customer's invoices (Total - Purchase Cost)
  const totalCustomerProfit = activeInvoicesForStats.reduce((sum, inv) => {
    const invoiceProfit = (inv.items || []).reduce((iSum, it) => {
      const buyPrice = Number(it.purchasePrice || 0);
      const sellTotal = Number(it.total || 0);
      const costTotal = buyPrice * Number(it.quantity || 1);
      return iSum + (sellTotal - costTotal);
    }, 0);
    return sum + invoiceProfit;
  }, 0);

  const toggleInvoiceExpand = (invoiceId: string) => {
    setExpandedInvoiceIds(prev => ({
      ...prev,
      [invoiceId]: !prev[invoiceId]
    }));
  };

  const triggerPrintLedger = () => {
    const printContent = document.getElementById('printable-ledger-area')?.innerHTML;
    if (!printContent) return;

    const activeA4 = A4_PRINT_THEMES[config.a4Theme || 'slate'] || A4_PRINT_THEMES.slate;
    const themePrimary = config.printPrimaryColor || activeA4.primary;
    const themeHeaderBg = config.printPrimaryColor || activeA4.headerBg;

    const styleAndBodyHtml = `
      <style>
        .ledger-print-wrap { 
          font-family: -apple-system, BlinkMacSystemFont, 'Cairo', 'Tajawal', sans-serif; 
          padding: 20px; 
          color: #1e293b; 
          direction: ${isRTL ? 'rtl' : 'ltr'}; 
          background: #fff;
        }
        .header { 
          display: flex; 
          justify-content: space-between; 
          align-items: center; 
          border-bottom: 2.5px solid ${themePrimary}; 
          padding-bottom: 20px; 
          margin-bottom: 24px; 
        }
        .title-box h1 { margin: 0; font-size: 22px; color: ${themePrimary}; font-weight: 800; }
        .title-box p { margin: 5px 0 0 0; font-size: 13px; color: #64748b; font-weight: 500; }
        .client-info-grid { 
          display: grid; 
          grid-template-columns: 1fr 1fr; 
          gap: 12px; 
          background: #f8fafc; 
          border: 1px solid ${activeA4.border}; 
          border-radius: 12px; 
          padding: 16px; 
          margin-bottom: 24px; 
        }
        .client-info-grid div { font-size: 12px; font-weight: 600; color: #475569; }
        .client-info-grid div strong { color: #0f172a; font-size: 13px; }
        .metrics-grid { 
          display: grid; 
          grid-template-columns: repeat(5, 1fr); 
          gap: 10px; 
          margin-bottom: 28px; 
        }
        .metric-card { 
          border: 1px solid ${activeA4.border}; 
          border-radius: 10px; 
          padding: 10px; 
          text-align: center; 
          background: #ffffff;
        }
        .metric-card span { font-size: 10px; font-weight: bold; text-transform: uppercase; color: #64748b; display: block; }
        .metric-card h2 { margin: 5px 0 0 0; font-size: 16px; font-weight: 900; }
        .red { color: #e11d48; }
        .green { color: #059669; }
        .emerald { color: #047857; }
        .blue { color: ${themePrimary}; }
        .ledger-table { width: 100%; border-collapse: collapse; margin-top: 16px; }
        .ledger-table th, .ledger-table td { 
          padding: 10px 12px; 
          border-bottom: 1px solid ${activeA4.border}; 
          text-align: ${isRTL ? 'right' : 'left'}; 
          font-size: 12px;
        }
        .ledger-table th { background-color: ${themeHeaderBg}; font-weight: bold; color: #ffffff; border-color: ${themeHeaderBg}; }
        .itemized-list { 
          font-size: 11px; 
          color: #64748b; 
          padding: 8px 12px; 
          background-color: #f8fafc; 
          border-radius: 6px; 
          margin-top: 5px; 
          list-style: none;
        }
        .itemized-list li { margin-bottom: 4px; border-bottom: 1px dashed #f1f5f9; padding-bottom: 3px; }
        .itemized-list li:last-child { border-bottom: none; }
        .bold { font-weight: bold; }
        .font-mono { font-family: monospace; font-weight: bold; }
        .footer { text-align: center; margin-top: 40px; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 15px; }
      </style>
      <div class="ledger-print-wrap">${printContent}</div>
    `;

    printHtmlContent(
      {
        title: `${isRTL ? 'كشف حساب زبون تفصيلي' : 'Customer Account Statement'} - ${customer.name}`,
        html: styleAndBodyHtml,
        isRTL,
        mode: 'a4'
      },
      buildLedgerPdfMeta()
    );
  };

  const buildLedgerPdfMeta = () => ({
    title: isRTL ? 'كشف حساب زبون تفصيلي' : 'Relevé de Compte Client',
    docNumber: `STMT-${customer.name}${selectedMonth ? `-${selectedMonth}` : ''}`,
    date: new Date().toLocaleDateString('fr-FR'),
    storeName: config.name || 'المتجر',
    storePhone: config.phone,
    storeEmail: config.email,
    storeAddress: config.address,
    storeRegNumber: config.registrationNumber,
    customerLabel: isRTL ? 'الزبون' : 'Client',
    customerName: customer.name,
    customerPhone: customer.phone,
    currency: config.currency,
    mode: 'a4' as const,
    isRTL,
    a4Theme: config.a4Theme || 'slate',
    themeColor: config.printPrimaryColor,
    summaryCards: [
      {
        label: isRTL ? 'إجمالي المشتريات والفوترة' : 'Total Invoiced',
        value: `${totalInvoicedSum.toFixed(2)} ${config.currency}`,
        color: '#0f172a'
      },
      {
        label: isRTL ? 'صافي الربح مع الزبون' : 'Bénéfice Client',
        value: `${totalCustomerProfit.toFixed(2)} ${config.currency}`,
        color: '#047857'
      },
      {
        label: isRTL ? 'إجمالي المدفوعات والتحصيلات' : 'Total Paid',
        value: `${(totalInvoicedPaidSum + totalDirectRepayments).toFixed(2)} ${config.currency}`,
        color: '#059669'
      },
      {
        label: isRTL ? 'الديون المتبقية بذمة الزبون' : 'Remaining Debt',
        value: `${(hasDateFilter ? Math.max(0, totalOutstandingBillDebt - totalDirectRepayments) : customer.debt).toFixed(2)} ${config.currency}`,
        color: '#e11d48'
      }
    ],
    hideQuantityAndUnitPrice: true,
    customTableHeaders: {
      name: isRTL ? 'البيان / الفاتورة' : 'Désignation',
      total: isRTL ? 'الإجمالي' : 'Total',
    },
    items: activeInvoicesForStats.map((inv) => ({
      name: `${inv.invoiceNumber} (${new Date(inv.date).toLocaleDateString('fr-FR')})`,
      quantity: 1,
      unitPrice: inv.total,
      total: inv.total
    })),
    subtotal: totalInvoicedSum,
    total: totalInvoicedSum,
    amountPaid: totalInvoicedPaidSum + totalDirectRepayments,
    remainingDebt: hasDateFilter ? Math.max(0, totalOutstandingBillDebt - totalDirectRepayments) : customer.debt,
    notes: customer.notes
  });

  const handleExportLedgerPdf = async () => {
    await exportStructuredPdf(buildLedgerPdfMeta());
  };

  const getTranslatedLabels = () => {
    if (isRTL) {
      return {
        statementTitle: 'كشف حساب الزبون وحركة المبيعات والديون التفصيلي',
        searchPlaceholder: 'ابحث برقم الفاتورة أو المعاملة...',
        allTrans: 'الكل',
        invoicesOnly: 'الفواتير والمشتريات',
        paymentsOnly: 'المدفوعات والتحصيلات',
        registeredOn: 'تاريخ التسجيل:',
        totalPurchased: 'إجمالي المشتريات والفوترة',
        totalProfit: 'أرباحنا مع الزبون',
        totalPaidOnInvoices: 'المدفوع المباشر بفواتير',
        totalSubRepayments: 'دفعات الحساب والديون اللاحقة',
        netOutstandingDebt: 'الديون المتبقية والذمم المالية',
        transactionDetails: 'تفاصيل معاملات الزبون',
        noTransactions: 'لم يتم العثور على أي حركات مالية مسجلة للزبون.',
        itemsPurchased: 'المنتجات والخدمات المشتراة:',
        amount: 'الملبغ:',
        payMethod: 'طريقة الدفع:',
        status: 'الحالة:',
        remaining: 'المتبقي كدين:',
        notes: 'ملاحظات:',
        receiptPrint: 'طباعة كشف الحساب والنشاط',
        backToDir: 'الرجوع لدليل الزبناء',
        debtor: 'الزبون المدين:',
        outstandingBillsSum: 'أقساط الديون ومجمل الفاتورة:',
        cashier: 'أمين الصندوق (الكاشير):',
        invoiceItems: 'عناصر الفاتورة المشتراة'
      };
    } else if (lang === 'fr') {
      return {
        statementTitle: "Relevé d'Activité & Grand Livre de Compte Client",
        searchPlaceholder: 'Rechercher par facture ou transaction...',
        allTrans: 'Tous',
        invoicesOnly: 'Factures de vente',
        paymentsOnly: 'Règlements & Dépôts',
        registeredOn: 'Enregistré le:',
        totalPurchased: 'Total Facturé',
        totalProfit: 'Bénéfice Réalisé',
        totalPaidOnInvoices: 'Payé Directement',
        totalSubRepayments: 'Règlements Ultérieurs',
        netOutstandingDebt: 'Reste à Payer (Créance)',
        transactionDetails: 'Détails de Compte Client',
        noTransactions: 'Aucune transaction enregistrée pour ce client.',
        itemsPurchased: 'Articles achetés:',
        amount: 'Montant:',
        payMethod: 'Paiement:',
        status: 'Statut:',
        remaining: 'Restant:',
        notes: 'Notes:',
        receiptPrint: 'Imprimer le relevé',
        backToDir: 'Retour aux clients',
        debtor: 'Client:',
        outstandingBillsSum: 'Total impayés:',
        cashier: 'Caissier:',
        invoiceItems: 'Articles de Facture'
      };
    } else {
      return {
        statementTitle: 'Customer Detailed Activity & Statement of Ledger',
        searchPlaceholder: 'Search by Invoice # or Reference...',
        allTrans: 'All Transactions',
        invoicesOnly: 'Purchases & Invoices',
        paymentsOnly: 'Settlements & Cash Payments',
        registeredOn: 'Registered On:',
        totalPurchased: 'Total Invoiced Value',
        totalProfit: 'Customer Profit Earned',
        totalPaidOnInvoices: 'Paid On Invoices',
        totalSubRepayments: 'Subsequent Settle Repayments',
        netOutstandingDebt: 'Net Outstanding Balance',
        transactionDetails: 'Customer Transaction Log',
        noTransactions: 'No transaction events found for this customer.',
        itemsPurchased: 'Items purchased:',
        amount: 'Amount:',
        payMethod: 'Payment method:',
        status: 'Status:',
        remaining: 'Remaining debt:',
        notes: 'Notes:',
        receiptPrint: 'Print Statement of Account',
        backToDir: 'Back to Directory',
        debtor: 'Customer:',
        outstandingBillsSum: 'Historical outstanding:',
        cashier: 'Cashier:',
        invoiceItems: 'Invoice Items purchased'
      };
    }
  };

  const labels = getTranslatedLabels();

  return (
    <div className="space-y-6 animate-fade-in" id="customer-ledger-wrapper">
      {/* Dynamic Navigation Action Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-100">
        <div className="flex items-center gap-3">
          <button
            id="btn-ledger-back"
            onClick={onClose}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-700 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shrink-0"
          >
            <ArrowLeft className={`w-4 h-4 ${isRTL ? 'rotate-180' : ''}`} />
            <span>{isRTL ? 'رجوع' : 'Retour'}</span>
          </button>
          <div className="text-start">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg sm:text-xl font-bold text-slate-800 tracking-tight">{customer.name}</h1>
              <span className="px-2.5 py-0.5 text-[10px] bg-slate-100 text-slate-600 font-bold rounded-full font-mono">
                {customer.phone}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1 font-semibold flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              <span>{labels.registeredOn} {new Date(customer.createdAt).toLocaleDateString()}</span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={handleExportLedgerPdf}
            className="flex-1 sm:flex-none justify-center flex items-center gap-1.5 px-3.5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition shadow-sm cursor-pointer"
          >
            <FileDown className="w-4 h-4" />
            <span>PDF</span>
          </button>
          <button
            id="btn-print-ledger-statement"
            onClick={triggerPrintLedger}
            className="flex-1 sm:flex-none justify-center flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl transition duration-200 shadow-sm cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>{labels.receiptPrint}</span>
          </button>
        </div>
      </div>

      {/* 5-Column Financial Statement Bento Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* Total Purchased / Invoiced */}
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs text-start">
          <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest block">
            {labels.totalPurchased}
          </span>
          <div className="flex items-baseline gap-1 mt-1.5">
            <span className="text-xl sm:text-2xl font-black text-slate-800 font-mono">
              {totalInvoicedSum.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
            <span className="text-xs font-semibold text-slate-500">{config.currency}</span>
          </div>
          <span className="text-[10px] font-bold text-indigo-600 block mt-1.5 bg-indigo-50/50 py-1 px-2.5 rounded-lg w-max">
            {activeInvoicesForStats.length} {isRTL ? 'فواتير مشتريات' : 'Sales bills'}
          </span>
        </div>

        {/* Customer Profit (أرباحنا مع الزبون) */}
        <div className="bg-white p-4 rounded-2xl border border-emerald-100 shadow-xs text-start bg-gradient-to-b from-emerald-50/40 to-white">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-emerald-700 font-extrabold uppercase tracking-widest block">
              {labels.totalProfit}
            </span>
            <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="flex items-baseline gap-1 mt-1.5">
            <span className="text-xl sm:text-2xl font-black text-emerald-700 font-mono">
              {totalCustomerProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
            <span className="text-xs font-semibold text-emerald-600">{config.currency}</span>
          </div>
          <span className="text-[10px] font-bold text-emerald-700 block mt-1.5 bg-emerald-100/60 py-1 px-2.5 rounded-lg w-max">
            {selectedMonth ? (isRTL ? `شهر ${selectedMonth}` : `Mois: ${selectedMonth}`) : (isRTL ? 'صافي الأرباح' : 'Gain net')}
          </span>
        </div>

        {/* Total Paid on Invoices */}
        <div className="bg-white p-4.5 rounded-2xl border border-slate-100 shadow-xs text-start">
          <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest block">
            {labels.totalPaidOnInvoices}
          </span>
          <div className="flex items-baseline gap-1 mt-1.5">
            <span className="text-2xl font-black text-emerald-600 font-mono">
              {totalInvoicedPaidSum.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
            <span className="text-xs font-semibold text-slate-500">{config.currency}</span>
          </div>
          <span className="text-[10px] font-bold text-emerald-600 block mt-1.5 bg-emerald-50/50 py-1 px-2.5 rounded-lg w-max">
            {activeInvoicesForStats.filter(i => i.status === 'paid').length} {isRTL ? 'مسواه بالكامل' : 'fully paid'}
          </span>
        </div>

        {/* Total subsequent debt settlements */}
        <div className="bg-white p-4.5 rounded-2xl border border-slate-100 shadow-xs text-start">
          <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest block">
            {labels.totalSubRepayments}
          </span>
          <div className="flex items-baseline gap-1 mt-1.5">
            <span className="text-2xl font-black text-blue-600 font-mono">
              {totalDirectRepayments.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
            <span className="text-xs font-semibold text-slate-500">{config.currency}</span>
          </div>
          <span className="text-[10px] font-bold text-blue-600 block mt-1.5 bg-blue-50/50 py-1 px-2.5 rounded-lg w-max">
            {activeRepaymentsForStats.length} {isRTL ? 'إيصالات تسديد المديونية' : 'Ledger receipts'}
          </span>
        </div>

        {/* PROFILE DEBT OR CREDIT STATUS */}
        <div className="bg-white p-4.5 rounded-2xl border border-slate-100 shadow-xs text-start">
          <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest block">
            {labels.netOutstandingDebt}
          </span>
          <div className="flex items-baseline gap-1 mt-1.5">
            <span className={`text-2xl font-black font-mono ${customer.debt > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
              {customer.debt.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
            <span className="text-xs font-semibold text-slate-500">{config.currency}</span>
          </div>
          <span className={`text-[10px] font-bold block mt-1.5 py-1 px-2.5 rounded-lg w-max ${
            customer.debt > 0 ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'
          }`}>
            {customer.debt > 0 
              ? (isRTL ? 'الزبون مطالب بالدفع (آجل)' : 'Client must repay debt') 
              : (isRTL ? 'الحساب مسوى تماماً' : 'Balance clear & settled')}
          </span>
        </div>
      </div>

      {/* Filter and Timeline Ledger Container */}
      <div className="bg-white border border-slate-100 rounded-3xl p-4 sm:p-6 shadow-xs flex flex-col space-y-4">
        {/* Search & Tabs Filtering */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex bg-slate-100 p-1 rounded-xl self-start flex-wrap gap-1">
            <button
              id="filter-tabs-all"
              onClick={() => setFilter('all')}
              className={`px-3.5 py-2 text-xs font-bold rounded-lg transition ${
                filter === 'all' ? 'bg-white shadow-xs text-slate-800' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {labels.allTrans}
            </button>
            <button
              id="filter-tabs-invoices"
              onClick={() => setFilter('invoices')}
              className={`px-3.5 py-2 text-xs font-bold rounded-lg transition ${
                filter === 'invoices' ? 'bg-white shadow-xs text-slate-800' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {labels.invoicesOnly}
            </button>
            <button
              id="filter-tabs-payments"
              onClick={() => setFilter('payments')}
              className={`px-3.5 py-2 text-xs font-bold rounded-lg transition ${
                filter === 'payments' ? 'bg-white shadow-xs text-slate-800' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {labels.paymentsOnly}
            </button>
          </div>

          <div className="relative w-full md:w-80">
            <input
              id="ledger-timeline-search"
              type="text"
              placeholder={labels.searchPlaceholder}
              className={`w-full text-xs font-bold py-2 bg-slate-50 text-slate-800 rounded-lg border border-slate-200 focus:ring-1 focus:ring-indigo-500 focus:outline-none pl-9 pr-4 ${
                isRTL ? 'text-right' : 'text-left'
              }`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          </div>
        </div>

        {/* Date & Month Search Bar (بحث بالشهر أو بالتاريخ من / إلى) */}
        <div className="flex flex-wrap items-center gap-3 bg-slate-50/90 p-3 rounded-2xl border border-slate-200/80 text-xs">
          <div className="flex items-center gap-1.5 text-indigo-700 font-black">
            <Calendar className="w-4 h-4 text-indigo-600 shrink-0" />
            <span>{isRTL ? 'بحث بالتاريخ أو بشهر معين:' : 'Filtrer par mois ou date:'}</span>
          </div>

          <div className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-xl border border-slate-200 shadow-2xs">
            <span className="font-bold text-slate-600">{isRTL ? 'الشهر:' : 'Mois:'}</span>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => {
                setSelectedMonth(e.target.value);
                if (e.target.value) {
                  setFromDate('');
                  setToDate('');
                }
              }}
              className="text-xs font-bold text-slate-800 focus:outline-none bg-transparent cursor-pointer"
            />
          </div>

          <div className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-xl border border-slate-200 shadow-2xs">
            <span className="font-bold text-slate-600">{isRTL ? 'من تاريخ:' : 'Du:'}</span>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value);
                if (e.target.value) setSelectedMonth('');
              }}
              className="text-xs font-bold text-slate-800 focus:outline-none bg-transparent cursor-pointer"
            />
          </div>

          <div className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-xl border border-slate-200 shadow-2xs">
            <span className="font-bold text-slate-600">{isRTL ? 'إلى تاريخ:' : 'Au:'}</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value);
                if (e.target.value) setSelectedMonth('');
              }}
              className="text-xs font-bold text-slate-800 focus:outline-none bg-transparent cursor-pointer"
            />
          </div>

          {hasDateFilter && (
            <button
              type="button"
              onClick={() => {
                setSelectedMonth('');
                setFromDate('');
                setToDate('');
              }}
              className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl font-bold transition cursor-pointer"
            >
              {isRTL ? 'إظهار كل التواريخ' : 'Réinitialiser'}
            </button>
          )}

          {hasDateFilter && (
            <div className="ms-auto flex items-center gap-2 text-[11px] font-black text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-xl border border-indigo-200">
              <span>
                {isRTL
                  ? `نتائج الفترة: ${filteredLedger.length} معاملة | المجموع: ${totalInvoicedSum.toFixed(2)} ${config.currency}`
                  : `Résultats: ${filteredLedger.length} | Total: ${totalInvoicedSum.toFixed(2)} ${config.currency}`}
              </span>
            </div>
          )}
        </div>

        {/* Unified Timeline Log */}
        <div className="space-y-4 pt-2">
          {filteredLedger.length > 0 ? (
            filteredLedger.map((item) => {
              const isInv = item.type === 'invoice';
              const invRaw = item.raw as Invoice;
              const isExpanded = !!expandedInvoiceIds[item.id];
              const remainingVal = isInv ? invRaw.total - invRaw.amountPaid : 0;

              return (
                <div 
                  key={item.id} 
                  className={`border rounded-2xl p-4 transition-all duration-200 text-start ${
                    isInv 
                      ? 'bg-white hover:bg-slate-50/20 border-slate-100' 
                      : 'bg-emerald-50/15 hover:bg-emerald-50/25 border-emerald-100/60'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                    {/* Time & Title info area */}
                    <div className="flex items-start gap-3">
                      <div className={`p-2.5 rounded-xl mt-0.5 shrink-0 ${
                        isInv ? 'bg-slate-100 text-slate-600' : 'bg-emerald-100 text-emerald-700'
                      }`}>
                        {isInv ? <FileText className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-extrabold text-slate-800 text-sm">{item.title}</h4>
                          <span className="font-mono text-[10px] px-2 py-0.5 bg-slate-100 text-slate-500 rounded-md font-bold uppercase">
                            #{item.reference}
                          </span>
                          {!isInv && (
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-bold rounded text-[9px] uppercase tracking-wide">
                              {isRTL ? 'تسديد دفعة دين' : 'Account repayment'}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 font-semibold">{item.subtitle}</p>
                        
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold">
                          <Clock className="w-3.5 h-3.5" />
                          <span>{item.date ? new Date(item.date).toLocaleString() : ''}</span>
                        </div>
                      </div>
                    </div>

                    {/* Transaction metrics */}
                    <div className="text-start sm:text-end space-y-1 self-stretch flex flex-col justify-between sm:items-end">
                      {isInv ? (
                        <>
                          <div className="flex items-baseline gap-1 sm:justify-end">
                            <span className="text-[10px] font-bold text-slate-400 capitalize">{isRTL ? 'إجمالي الفاتورة:' : 'Invoice Total:'}</span>
                            <span className="font-mono font-black text-slate-800 text-base">{invRaw.total.toFixed(2)}</span>
                            <span className="text-[10px] font-semibold text-slate-500">{config.currency}</span>
                          </div>

                          <div className="flex items-center gap-4 flex-wrap sm:justify-end text-[11px] font-semibold">
                            <span className="text-emerald-600">
                              {isRTL ? 'المدفوع:' : 'Paid:'} {invRaw.amountPaid.toFixed(2)} {config.currency}
                            </span>
                            {remainingVal > 0 ? (
                              <span className="text-rose-600">
                                {isRTL ? 'المتبقي (دين):' : 'Debt:'} {remainingVal.toFixed(2)} {config.currency}
                              </span>
                            ) : (
                              <span className="bg-emerald-100 text-emerald-800 font-extrabold px-1.5 py-0.5 rounded text-[9px]">
                                {isRTL ? 'مسددة بالكامل' : 'Paid in full'}
                              </span>
                            )}
                          </div>
                        </>
                      ) : (
                        <div className="flex flex-col sm:items-end justify-center h-full">
                          <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">
                            {isRTL ? 'المبلغ المستلم كدفعة سداد:' : 'Amount Logged / Settled:'}
                          </span>
                          <div className="flex items-baseline gap-1 mt-0.5">
                            <span className="text-emerald-700 font-mono font-extrabold text-base">-{item.amountPaid.toFixed(2)}</span>
                            <span className="text-xs font-semibold text-emerald-600">{config.currency}</span>
                          </div>
                        </div>
                      )}

                      {/* Expand Button for Invoice items */}
                      {isInv && (
                        <button
                          id={`btn-toggle-inv-items-${item.id}`}
                          onClick={() => toggleInvoiceExpand(item.id)}
                          className="text-[10px] font-extrabold text-slate-500 hover:text-slate-800 flex items-center gap-1 mt-1 transition focus:outline-none cursor-pointer self-start sm:self-auto bg-slate-50 hover:bg-slate-100 py-1 px-2.5 rounded-lg border border-slate-100"
                        >
                          {isExpanded ? (
                            <>
                              <span>{isRTL ? 'إخفاء عناصر المبيعات' : 'Hide purchase items'}</span>
                              <ChevronUp className="w-3 h-3" />
                            </>
                          ) : (
                            <>
                              <span>{isRTL ? 'عرض المنتجات المشتراة' : 'Show purchase items'}</span>
                              <ChevronDown className="w-3 h-3 text-slate-500" />
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Accordion Expandable area listing all item transactions inside the Invoice */}
                  {isInv && isExpanded && (
                    <div className="mt-4 border-t border-slate-100 pt-3 animate-slide-down">
                      <h5 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block mb-2">
                        {labels.invoiceItems}
                      </h5>
                      <div className="overflow-x-auto text-xs">
                        <table className="w-full text-start">
                          <thead>
                            <tr className="text-slate-400 font-extrabold border-b border-slate-50 text-[10px]">
                              <th className="pb-1.5 font-medium text-start">{isRTL ? 'اسم المنتج / الصنف' : 'Product name'}</th>
                              <th className="pb-1.5 font-medium text-end">{isRTL ? 'المجموع' : 'Subtotal'}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50/50">
                            {invRaw.items.map((it, idx) => (
                              <tr key={idx} className="text-slate-700 font-medium">
                                <td className="py-2 text-start font-semibold text-slate-800">{it.productName}</td>
                                <td className="py-2 text-end font-mono font-bold">{it.total.toFixed(2)} {config.currency}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Display optional invoice remarks or seller staff notes */}
                      {invRaw.notes && (
                        <div className="mt-3 bg-slate-50/80 p-2 rounded-lg border border-slate-100 text-[11px] text-slate-500 font-semibold italic text-start">
                          💡 {isRTL ? 'ملاحظة الفاتورة:' : 'Invoice Memo:'} {invRaw.notes}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="text-center py-12 border border-dashed border-slate-200 rounded-2xl">
              <AlertCircle className="w-8 h-8 text-slate-300 mx-auto stroke-[1.2] mb-2" />
              <p className="text-xs text-slate-400 font-semibold">{labels.noTransactions}</p>
            </div>
          )}
        </div>
      </div>

      {/* HIDDEN OFFSYSTEM STATIC LAYER PREPARED PURELY FOR WINDOW PRINT LAYOUTS */}
      <div id="printable-ledger-area" className="hidden">
        <div className="header">
          <div className="title-box">
            <h1>{labels.statementTitle}</h1>
            <p>{customer.name} — كشف حساب مالي تفصيلي للزبون ونشاطه للآجل والنقدي</p>
          </div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 'bold' }}>{labels.registeredOn} {new Date(customer.createdAt).toLocaleDateString()}</div>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>Date Statement Exported: {new Date().toLocaleString()}</div>
          </div>
        </div>

        <div className="client-info-grid">
          <div>{labels.debtor} <strong>{customer.name}</strong></div>
          <div>{isRTL ? 'رقم الهاتف:' : 'Phone Number:'} <strong>{customer.phone || '—'}</strong></div>
          <div>{isRTL ? 'البريد الإلكتروني:' : 'Email address:'} <strong>{customer.email || '—'}</strong></div>
          <div>{isRTL ? 'إجمالي فواتير الصفقات:' : 'Total deals count:'} <strong>{clientInvoices.length} فواتير مبيعات</strong></div>
        </div>

        <div className="metrics-grid">
          <div className="metric-card">
            <span>{labels.totalPurchased}</span>
            <h2 className="blue">{totalInvoicedSum.toFixed(2)} {config.currency}</h2>
          </div>
          <div className="metric-card">
            <span>{labels.totalProfit}</span>
            <h2 className="emerald">{totalCustomerProfit.toFixed(2)} {config.currency}</h2>
          </div>
          <div className="metric-card">
            <span>{labels.totalPaidOnInvoices}</span>
            <h2 className="green">{totalInvoicedPaidSum.toFixed(2)} {config.currency}</h2>
          </div>
          <div className="metric-card">
            <span>{labels.totalSubRepayments}</span>
            <h2 className="blue">{totalDirectRepayments.toFixed(2)} {config.currency}</h2>
          </div>
          <div className="metric-card">
            <span>{labels.netOutstandingDebt}</span>
            <h2 className="red">{customer.debt.toFixed(2)} {config.currency}</h2>
          </div>
        </div>

        <h3 style={{ margin: '25px 0 10px 0', fontSize: '16px', borderBottom: '2px solid #334155', paddingBottom: '5px' }}>
          {labels.transactionDetails}
        </h3>

        <table className="ledger-table">
          <thead>
            <tr>
              <th style={{ width: '15%' }}>{isRTL ? 'التاريخ والوقت' : 'Date & Time'}</th>
              <th style={{ width: '15%' }}>{isRTL ? 'رقم المعاملة' : 'Doc Reference'}</th>
              <th style={{ width: '20%' }}>{isRTL ? 'نوع الحركة' : 'Transaction Type'}</th>
              <th style={{ width: '15%', textAlignment: 'right' }}>{isRTL ? 'المشتريات / بضاعة' : 'Debit (Goods)'}</th>
              <th style={{ width: '15%', textAlignment: 'right' }}>{isRTL ? 'المبلغ المسدد' : 'Credit (Payments)'}</th>
              <th style={{ width: '20%', textAlignment: 'right' }}>{isRTL ? 'المتبقي كدين' : 'Remaining Balance'}</th>
            </tr>
          </thead>
          <tbody>
            {filteredLedger.map((item) => {
              const isInv = item.type === 'invoice';
              const invRaw = item.raw as Invoice;
              return (
                <React.Fragment key={item.id}>
                  <tr>
                    <td className="font-mono">{new Date(item.date).toLocaleDateString()}</td>
                    <td className="font-mono">{item.reference}</td>
                    <td>
                      <span className="bold">{item.title}</span><br />
                      <span style={{ fontSize: '10px', color: '#64748b' }}>{item.subtitle}</span>
                    </td>
                    <td className="font-mono bold text-right">
                      {isInv ? `${invRaw.total.toFixed(2)}` : '—'}
                    </td>
                    <td className="font-mono bold text-right text-emerald-600">
                      {isInv 
                        ? `${invRaw.amountPaid > 0 ? `-${invRaw.amountPaid.toFixed(2)}` : '0.00'}`
                        : `-${item.amountPaid.toFixed(2)}`
                      }
                    </td>
                    <td className="font-mono bold text-right red">
                      {isInv ? `${(invRaw.total - invRaw.amountPaid).toFixed(2)}` : '0.00'}
                    </td>
                  </tr>
                </React.Fragment>
              );
            })}
          </tbody>
        </table>

        <div className="footer">
          <p>{isRTL ? 'شكرا لتعاملكم معنا' : 'Thank you for your business / Merci pour votre confiance'}</p>
          <p style={{ fontSize: '10px', color: '#cbd5e1', marginTop: '10px' }}>Powered by AI Smart ERP Systems</p>
        </div>
      </div>
    </div>
  );
}
