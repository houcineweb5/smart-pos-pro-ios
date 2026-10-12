/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Product {
  id: string;
  sku: string; // Barcode or stock identifier
  name: string;
  category: string;
  purchasePrice: number;
  sellingPrice: number;
  wholesalePrice?: number; // wholesale price
  stock: number;
  minStock: number; // For low stock alerts
  unit: string; // Pcs, Kg, Box, etc.
  imageUrl?: string;
}

export type PaymentMethod = 'cash' | 'card' | 'debt';
export type PaymentStatus = 'paid' | 'unpaid' | 'partial' | 'refunded';

export interface InvoiceItem {
  productId: string;
  productName: string;
  sellingPrice: number;
  purchasePrice: number; // saved to compute actual gains from invoice
  quantity: number;
  discount: number; // percentage discount on items
  tax: number; // computed amount of tax
  total: number;
}

export interface InvoiceReturnItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  refundAmount: number;
  date: string;
  notes?: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  date: string;
  customerId: string; // "walk-in" for dynamic entries
  customerName: string;
  items: InvoiceItem[];
  subtotal: number;
  discount: number; // general percentage or fixed sum
  tax: number; // total tax sum
  total: number;
  amountPaid: number;
  previousBalance?: number; // Old credit / extra amount shown on invoice total only (excluded from statistics)
  paymentMethod: PaymentMethod;
  status: PaymentStatus;
  notes?: string;
  sellerId?: string;
  sellerName?: string;
  returnedItems?: InvoiceReturnItem[];
  isWholesale?: boolean;
  pricingMode?: 'retail' | 'wholesale' | 'installment';
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  ice?: string; // Tax Identifier / ICE
  debt: number; // Positive means they owe money
  notes?: string;
  createdAt: string;
}

export interface Supplier {
  id: string;
  name: string;
  phone: string;
  email: string;
  company: string;
  debt: number; // Positive means we owe this supplier money (our debt to them)
  notes?: string;
  createdAt: string;
}

export interface PurchaseItem {
  productId: string; // If registered, otherwise empty string/custom
  productName: string;
  purchasePrice: number;
  quantity: number;
  total: number;
}

export interface PurchasePayment {
  id: string;
  date: string;
  amount: number;
  notes?: string;
}

export interface Purchase {
  id: string;
  purchaseNumber: string;
  date: string;
  supplierId: string;
  supplierName: string;
  items: PurchaseItem[];
  total: number;
  amountPaid: number;
  status: PaymentStatus;
  notes?: string;
  payments?: PurchasePayment[];
}

export interface StoreConfig {
  name: string;
  phone: string;
  email: string;
  address: string;
  registrationNumber: string;
  currency: string;
  taxRate: number; // default tax percentage e.g. 15 for 15%
  logoUrl?: string;
  shortcutSellPrint?: string;
  shortcutShowReceipt?: string;
  shortcutSellNoReceipt?: string;
  darkMode?: boolean;
  themeColor?: string;
  receiptTheme?: 'classic' | 'navy' | 'emerald' | 'minimal' | 'modern';
  a4Theme?: 'slate' | 'indigo' | 'emerald' | 'burgundy' | 'amber';
  printPrimaryColor?: string;
  defaultPrintMode?: '80mm' | 'a4';
  showLogoOnInvoice?: boolean;
  showPhoneOnInvoice?: boolean;
  showAddressOnInvoice?: boolean;
  showEmailOnInvoice?: boolean;
  showTaxNumberOnInvoice?: boolean;
  showCashierOnInvoice?: boolean;
  showBarcodeOnInvoice?: boolean;
  showDebtOnInvoice?: boolean;
  receiptFooterMessage?: string;
  receiptReturnPolicy?: string;
  invoiceNotesDefault?: string;
}

export interface DashboardStats {
  totalSales: number;
  totalProfit: number;
  totalTransactions: number;
  totalDebt: number;
  lowStockCount: number;
  salesByDay: { date: string; amount: number; profit: number }[];
  topProducts: { name: string; quantity: number; revenue: number }[];
  categoriesDistribution: { name: string; value: number }[];
}

export type Language = 'ar' | 'fr' | 'en';
export type ActiveTab = 'home' | 'pos' | 'invoices' | 'purchase-entry' | 'inventory' | 'customers' | 'reports' | 'settings' | 'suppliers' | 'purchases' | 'expenses' | 'users' | 'repairs' | 'logs' | 'devis' | 'bon-commande' | 'bon-livraison' | 'commercial-documents' | 'backup' | 'mobile-sync';

export interface Employee {
  id: string;
  username: string;
  name: string;
  role: 'admin' | 'user';
  passwordHash: string; // Stored pass for simple mock/demo accounts
  allowedTabs: ActiveTab[];
  createdAt: string;
  photoUrl?: string;
}

export interface ActivityLog {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  action: string;
  details: string;
}

export type RepairStatus = 'received' | 'in_progress' | 'ready' | 'delivered' | 'cancelled';

export interface RepairOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  itemName: string;
  itemSerial?: string;
  issueDescription: string;
  status: RepairStatus;
  estimatedCost: number;
  amountPaid: number;
  estimatedDeliveryDate?: string;
  notes?: string;
  createdAt: string;
  sellerId?: string;
  sellerName?: string;
}

export interface Expense {
  id: string;
  title: string;
  amount: number;
  category: 'rent' | 'utilities' | 'salaries' | 'supplies' | 'transport' | 'other' | string;
  date: string;
  notes?: string;
  createdByName?: string;
}

export interface CashRegisterSession {
  id: string;
  openedAt: string;
  closedAt?: string;
  openedBy: string;
  closedBy?: string;
  openingBalance: number; // رصيد البداية في الصندوق
  cashSales: number;      // مبيعات كاش
  debtCollections: number;// تحصيل ديون كاش
  cashExpenses: number;   // مصاريف مدفوعة كاش
  expectedCash: number;   // المتوقع = افتتاح + مبيعات + تحصيل - مصاريف
  actualCash?: number;    // الفعلي المحسوب في الدرج
  difference?: number;    // الفارق = فعلي - متوقع
  status: 'open' | 'closed';
  notes?: string;
}

export type CommercialDocType = 'devis' | 'bon_commande' | 'bon_livraison' | 'facture';
export type CommercialDocStatus = 'draft' | 'validated' | 'converted' | 'cancelled';

export interface CommercialDocument {
  id: string;
  docType: CommercialDocType; // 'devis' | 'bon_commande' | 'bon_livraison' | 'facture'
  docNumber: string; // DEV-2026-001, BC-2026-001, BL-2026-001, FAC-2026-001
  date: string;
  validUntil?: string; // For quotes
  customerId: string;
  customerName: string;
  customerPhone?: string;
  customerAddress?: string;
  items: InvoiceItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  amountPaid?: number;
  previousBalance?: number;
  paymentMethod?: PaymentMethod;
  status: CommercialDocStatus;
  notes?: string;
  convertedTo?: { docType: CommercialDocType; docId: string; docNumber: string };
  convertedFrom?: { docType: CommercialDocType; docId: string; docNumber: string };
  sellerName?: string;
  isWholesale?: boolean;
  pricingMode?: 'retail' | 'wholesale' | 'installment';
}



