/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Product, Customer, Invoice, StoreConfig, Supplier, Purchase, Employee, ActivityLog, RepairOrder, Expense, CommercialDocument } from './types';

export const INITIAL_EXPENSES: Expense[] = [];

export const INITIAL_PRODUCTS: Product[] = [];

export const INITIAL_CUSTOMERS: Customer[] = [
  { id: 'walk-in', name: 'زبون عابر', phone: '', email: '', debt: 0, notes: 'الزبون الافتراضي للمبيعات النقدية المباشرة', createdAt: '2026-01-01T00:00:00Z' }
];

export const INITIAL_SUPPLIERS: Supplier[] = [];

export const INITIAL_PURCHASES: Purchase[] = [];

export const INITIAL_CONFIG: StoreConfig = {
  name: 'Smart Pos',
  phone: '',
  email: 'SmartPos@gmail.com',
  address: '',
  registrationNumber: '',
  currency: 'MAD',
  taxRate: 0,
  logoUrl: '',
  shortcutSellPrint: 'F1',
  shortcutShowReceipt: 'F2',
  shortcutSellNoReceipt: 'Enter',
  darkMode: false,
  themeColor: 'indigo'
};

export const INITIAL_COMMERCIAL_DOCUMENTS: CommercialDocument[] = [];

export const INITIAL_EMPLOYEES: Employee[] = [
  {
    id: 'emp-admin',
    username: 'admin',
    name: 'admin',
    role: 'admin',
    passwordHash: 'admin',
    allowedTabs: ['home', 'pos', 'invoices', 'inventory', 'customers', 'reports', 'settings', 'suppliers', 'purchases', 'purchase-entry', 'expenses', 'users', 'repairs', 'logs', 'devis', 'bon-commande', 'bon-livraison', 'commercial-documents', 'backup', 'mobile-sync'],
    createdAt: '2026-01-01T00:00:00Z'
  },
  {
    id: 'emp-user1',
    username: 'user1',
    name: 'USER1 Cashier',
    role: 'user',
    passwordHash: 'user1',
    allowedTabs: ['home', 'pos', 'invoices', 'customers', 'repairs', 'logs', 'devis', 'bon-commande', 'bon-livraison', 'commercial-documents'],
    createdAt: '2026-01-01T00:00:00Z'
  }
];

export const INITIAL_LOGS: ActivityLog[] = [
  { id: 'log-1', timestamp: '2026-01-01T00:00:00Z', userId: 'emp-admin', userName: 'Administrator', action: 'system_init', details: 'تم تهيئة النظام بالبيانات الافتراضية بنجاح' }
];

export const INITIAL_REPAIRS: RepairOrder[] = [];

export function getInitialInvoices(): Invoice[] {
  return [];
}

// Global persistence keys
const DB_PREFIX = 'sales_app_';
const KEYS = {
  products: DB_PREFIX + 'products',
  customers: DB_PREFIX + 'customers',
  suppliers: DB_PREFIX + 'suppliers',
  purchases: DB_PREFIX + 'purchases',
  invoices: DB_PREFIX + 'invoices',
  config: DB_PREFIX + 'config',
  employees: DB_PREFIX + 'employees',
  logs: DB_PREFIX + 'logs',
  repairs: DB_PREFIX + 'repairs',
  expenses: DB_PREFIX + 'expenses',
  commercialDocuments: DB_PREFIX + 'commercial_documents'
};

export function getStoredData() {
  if (typeof window === 'undefined') {
    return {
      products: INITIAL_PRODUCTS,
      customers: INITIAL_CUSTOMERS,
      suppliers: INITIAL_SUPPLIERS,
      purchases: INITIAL_PURCHASES,
      invoices: getInitialInvoices(),
      config: INITIAL_CONFIG,
      employees: INITIAL_EMPLOYEES,
      logs: INITIAL_LOGS,
      repairs: INITIAL_REPAIRS,
      expenses: INITIAL_EXPENSES,
      commercialDocuments: INITIAL_COMMERCIAL_DOCUMENTS
    };
  }

  // Check if store exists, otherwise initialize it
  let products = INITIAL_PRODUCTS;
  let customers = INITIAL_CUSTOMERS;
  let suppliers = INITIAL_SUPPLIERS;
  let purchases = INITIAL_PURCHASES;
  let invoices = getInitialInvoices();
  let config = INITIAL_CONFIG;
  let employees = INITIAL_EMPLOYEES;
  let logs = INITIAL_LOGS;
  let repairs = INITIAL_REPAIRS;
  let expenses = INITIAL_EXPENSES;

  const storedProd = localStorage.getItem(KEYS.products);
  if (storedProd) {
    try {
      products = JSON.parse(storedProd);
      if (products.some((p: Product) => p.name === 'iPhone 15 Pro 256GB')) {
        products = INITIAL_PRODUCTS;
        localStorage.setItem(KEYS.products, JSON.stringify(INITIAL_PRODUCTS));
      }
    } catch (e) {
      products = INITIAL_PRODUCTS;
    }
  } else {
    localStorage.setItem(KEYS.products, JSON.stringify(INITIAL_PRODUCTS));
  }

  const storedCust = localStorage.getItem(KEYS.customers);
  if (storedCust) {
    try {
      customers = JSON.parse(storedCust);
      if (customers.some((c: Customer) => c.name === 'Ahmad Al-Mansour')) {
        customers = INITIAL_CUSTOMERS;
        localStorage.setItem(KEYS.customers, JSON.stringify(INITIAL_CUSTOMERS));
      } else if (!customers.some((c: Customer) => c.id === 'walk-in' || c.name === 'زبون عابر')) {
        customers = [INITIAL_CUSTOMERS[0], ...customers];
        localStorage.setItem(KEYS.customers, JSON.stringify(customers));
      }
    } catch (e) {
      customers = INITIAL_CUSTOMERS;
    }
  } else {
    localStorage.setItem(KEYS.customers, JSON.stringify(INITIAL_CUSTOMERS));
  }

  const storedSupp = localStorage.getItem(KEYS.suppliers);
  if (storedSupp) suppliers = JSON.parse(storedSupp);
  else localStorage.setItem(KEYS.suppliers, JSON.stringify(INITIAL_SUPPLIERS));

  const storedPur = localStorage.getItem(KEYS.purchases);
  if (storedPur) {
    try {
      purchases = JSON.parse(storedPur);
    } catch (e) {
      purchases = INITIAL_PURCHASES;
    }
  } else {
    localStorage.setItem(KEYS.purchases, JSON.stringify(INITIAL_PURCHASES));
  }

  const storedInvs = localStorage.getItem(KEYS.invoices);
  if (storedInvs) invoices = JSON.parse(storedInvs);
  else localStorage.setItem(KEYS.invoices, JSON.stringify(getInitialInvoices()));

  const storedConfig = localStorage.getItem(KEYS.config);
  if (storedConfig) {
    try {
      config = JSON.parse(storedConfig);
      if (config.themeColor === 'slate' || config.themeColor === 'navy') {
        config.themeColor = 'indigo';
        localStorage.setItem(KEYS.config, JSON.stringify(config));
      }
    } catch (e) {
      config = INITIAL_CONFIG;
    }
  } else {
    localStorage.setItem(KEYS.config, JSON.stringify(INITIAL_CONFIG));
  }

  const storedEmp = localStorage.getItem(KEYS.employees);
  if (storedEmp) {
    try {
      employees = JSON.parse(storedEmp);
    } catch (e) {
      employees = INITIAL_EMPLOYEES;
    }
  } else {
    localStorage.setItem(KEYS.employees, JSON.stringify(INITIAL_EMPLOYEES));
  }

  const storedLogs = localStorage.getItem(KEYS.logs);
  if (storedLogs) {
    try {
      logs = JSON.parse(storedLogs);
    } catch (e) {
      logs = INITIAL_LOGS;
    }
  } else {
    localStorage.setItem(KEYS.logs, JSON.stringify(INITIAL_LOGS));
  }

  const storedRepairs = localStorage.getItem(KEYS.repairs);
  if (storedRepairs) {
    try {
      repairs = JSON.parse(storedRepairs);
    } catch (e) {
      repairs = INITIAL_REPAIRS;
    }
  } else {
    localStorage.setItem(KEYS.repairs, JSON.stringify(INITIAL_REPAIRS));
  }

  const storedExpenses = localStorage.getItem(KEYS.expenses);
  if (storedExpenses) {
    try {
      expenses = JSON.parse(storedExpenses);
    } catch (e) {
      expenses = INITIAL_EXPENSES;
    }
  } else {
    localStorage.setItem(KEYS.expenses, JSON.stringify(INITIAL_EXPENSES));
  }

  let commercialDocuments = INITIAL_COMMERCIAL_DOCUMENTS;
  const storedDocs = localStorage.getItem(KEYS.commercialDocuments);
  if (storedDocs) {
    try {
      commercialDocuments = JSON.parse(storedDocs);
    } catch (e) {
      commercialDocuments = INITIAL_COMMERCIAL_DOCUMENTS;
    }
  } else {
    localStorage.setItem(KEYS.commercialDocuments, JSON.stringify(INITIAL_COMMERCIAL_DOCUMENTS));
  }

  return { products, customers, suppliers, purchases, invoices, config, employees, logs, repairs, expenses, commercialDocuments };
}

export function saveStoredData(data: {
  products: Product[];
  customers: Customer[];
  suppliers: Supplier[];
  purchases: Purchase[];
  invoices: Invoice[];
  config: StoreConfig;
  employees: Employee[];
  logs: ActivityLog[];
  repairs: RepairOrder[];
  expenses?: Expense[];
  commercialDocuments?: CommercialDocument[];
}) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEYS.products, JSON.stringify(data.products));
  localStorage.setItem(KEYS.customers, JSON.stringify(data.customers));
  localStorage.setItem(KEYS.suppliers, JSON.stringify(data.suppliers));
  localStorage.setItem(KEYS.purchases, JSON.stringify(data.purchases));
  localStorage.setItem(KEYS.invoices, JSON.stringify(data.invoices));
  localStorage.setItem(KEYS.config, JSON.stringify(data.config));
  localStorage.setItem(KEYS.employees, JSON.stringify(data.employees));
  localStorage.setItem(KEYS.logs, JSON.stringify(data.logs));
  localStorage.setItem(KEYS.repairs, JSON.stringify(data.repairs));
  if (data.expenses) {
    localStorage.setItem(KEYS.expenses, JSON.stringify(data.expenses));
  }
  if (data.commercialDocuments) {
    localStorage.setItem(KEYS.commercialDocuments, JSON.stringify(data.commercialDocuments));
  }
}

export async function resetStoredToDefaults() {
  if (typeof window === 'undefined') return;

  const zeroData = {
    products: [],
    customers: INITIAL_CUSTOMERS,
    suppliers: [],
    purchases: [],
    invoices: [],
    config: INITIAL_CONFIG,
    employees: INITIAL_EMPLOYEES,
    logs: [{
      id: 'log_' + Date.now(),
      timestamp: new Date().toISOString(),
      userId: 'admin',
      userName: 'Administrator',
      action: 'تهيئة النظام',
      details: 'تمت فرمتة النظام وإعادة التعيين من الصفر بنجاح'
    }],
    repairs: [],
    expenses: [],
    commercialDocuments: []
  };

  // 1. Update localStorage
  saveStoredData(zeroData);

  // 2. Wipe SQLite database via API
  try {
    await fetch('/api/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(zeroData)
    });
  } catch (err) {
    console.error('Failed to reset database via /api/reset, trying /api/save:', err);
    try {
      await fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(zeroData)
      });
    } catch (e) {
      console.error('Failed to sync zero state to server:', e);
    }
  }

  // 3. Reload window cleanly
  window.location.reload();
}
