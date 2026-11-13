/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Product, Customer, CustomerPayment, Invoice, StoreConfig, Supplier, Purchase, Employee, ActivityLog, RepairOrder, Expense, CommercialDocument, Warehouse } from './types';

export const INITIAL_WAREHOUSES: Warehouse[] = [
  { id: 'wh-main', name: 'المستودع الرئيسي', location: 'المقر الرئيسي', isDefault: true }
];

export const INITIAL_EXPENSES: Expense[] = [];
export const INITIAL_CUSTOMER_PAYMENTS: CustomerPayment[] = [];

export const INITIAL_PRODUCTS: Product[] = [];

export const INITIAL_CUSTOMERS: Customer[] = [
  { id: 'walk-in', name: 'Client Divers', phone: '', email: '', debt: 0, notes: 'الزبون الافتراضي للمبيعات النقدية المباشرة', createdAt: '2026-01-01T00:00:00Z' }
];

export const INITIAL_SUPPLIERS: Supplier[] = [];

export const INITIAL_PURCHASES: Purchase[] = [];

export const INITIAL_CONFIG: StoreConfig = {
  name: 'Smart Pos',
  phone: '',
  email: 'SmartPos@gmail.com',
  address: '',
  registrationNumber: '',
  taxNumber: '',
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
    passwordHash: 'smartpos',
    photoUrl: '/sp-icon.png',
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
  commercialDocuments: DB_PREFIX + 'commercial_documents',
  customerPayments: DB_PREFIX + 'customer_payments',
  warehouses: DB_PREFIX + 'warehouses'
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
      commercialDocuments: INITIAL_COMMERCIAL_DOCUMENTS,
      warehouses: INITIAL_WAREHOUSES
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
      let changed = false;
      customers = customers.map((c: Customer) => {
        if (c.id === 'walk-in' || c.name === 'زبون عابر' || c.name === 'Walk-in' || c.name === 'Client de passage') {
          changed = true;
          return { ...c, name: 'Client Divers' };
        }
        return c;
      });
      if (!customers.some((c: Customer) => c.id === 'walk-in' || c.name === 'Client Divers')) {
        customers = [INITIAL_CUSTOMERS[0], ...customers];
        changed = true;
      }
      if (changed) {
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
      const parsedEmp: Employee[] = JSON.parse(storedEmp);
      let empChanged = false;
      employees = parsedEmp.map((emp) => {
        if (emp.id === 'emp-admin' || emp.username === 'admin') {
          const nextPwd = emp.passwordHash === 'admin' ? 'smartpos' : emp.passwordHash;
          const nextPhoto = '/sp-icon.png';
          if (emp.passwordHash !== nextPwd || emp.photoUrl !== nextPhoto) {
            empChanged = true;
            return { ...emp, passwordHash: nextPwd, photoUrl: nextPhoto };
          }
        }
        return emp;
      });
      if (empChanged) {
        localStorage.setItem(KEYS.employees, JSON.stringify(employees));
      }
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

  let customerPayments = INITIAL_CUSTOMER_PAYMENTS;
  const storedPayments = localStorage.getItem(KEYS.customerPayments);
  if (storedPayments) {
    try {
      customerPayments = JSON.parse(storedPayments);
    } catch (e) {
      customerPayments = INITIAL_CUSTOMER_PAYMENTS;
    }
  } else {
    localStorage.setItem(KEYS.customerPayments, JSON.stringify(INITIAL_CUSTOMER_PAYMENTS));
  }

  let warehouses = INITIAL_WAREHOUSES;
  const storedWarehouses = localStorage.getItem(KEYS.warehouses);
  if (storedWarehouses) {
    try {
      warehouses = JSON.parse(storedWarehouses);
      if (!Array.isArray(warehouses) || warehouses.length === 0) {
        warehouses = INITIAL_WAREHOUSES;
      }
    } catch (e) {
      warehouses = INITIAL_WAREHOUSES;
    }
  } else {
    localStorage.setItem(KEYS.warehouses, JSON.stringify(INITIAL_WAREHOUSES));
  }

  let deletedIds: string[] = [];
  const storedDeleted = localStorage.getItem('smartpos_deleted_ids_v1');
  if (storedDeleted) {
    try {
      const parsed = JSON.parse(storedDeleted);
      if (Array.isArray(parsed)) deletedIds = parsed;
    } catch {}
  }

  return { products, customers, suppliers, purchases, invoices, config, employees, logs, repairs, expenses, commercialDocuments, customerPayments, warehouses, deletedIds };
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
  customerPayments?: CustomerPayment[];
  warehouses?: Warehouse[];
  deletedIds?: string[];
}) {
  if (typeof window === 'undefined') return;
  const safeSet = (key: string, val: unknown) => {
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch (err) {
      console.warn(`Storage quota warning for ${key}:`, err);
      if (key === KEYS.products && Array.isArray(val)) {
        try {
          const lightProducts = val.map((p: any) => ({ ...p, imageUrl: '' }));
          localStorage.setItem(key, JSON.stringify(lightProducts));
        } catch {}
      }
    }
  };
  safeSet(KEYS.products, data.products);
  safeSet(KEYS.customers, data.customers);
  safeSet(KEYS.suppliers, data.suppliers);
  safeSet(KEYS.purchases, data.purchases);
  safeSet(KEYS.invoices, data.invoices);
  safeSet(KEYS.config, data.config);
  safeSet(KEYS.employees, data.employees);
  safeSet(KEYS.logs, (data.logs || []).slice(0, 300));
  safeSet(KEYS.repairs, data.repairs);
  if (data.expenses) {
    safeSet(KEYS.expenses, data.expenses);
  }
  if (data.commercialDocuments) {
    safeSet(KEYS.commercialDocuments, data.commercialDocuments);
  }
  if (data.customerPayments) {
    safeSet(KEYS.customerPayments, data.customerPayments);
  }
  if (data.warehouses) {
    safeSet(KEYS.warehouses, data.warehouses);
  }
  if (Array.isArray(data.deletedIds)) {
    safeSet('smartpos_deleted_ids_v1', data.deletedIds.slice(-1000));
  }
}

export function getZeroResetData(existingConfig?: StoreConfig, existingEmployees?: Employee[]) {
  return {
    products: [] as Product[],
    customers: INITIAL_CUSTOMERS,
    suppliers: [] as Supplier[],
    purchases: [] as Purchase[],
    invoices: [] as Invoice[],
    config: existingConfig ? { ...INITIAL_CONFIG, ...existingConfig } : INITIAL_CONFIG,
    employees: existingEmployees && existingEmployees.length > 0 ? existingEmployees : INITIAL_EMPLOYEES,
    logs: [{
      id: 'log_' + Date.now(),
      timestamp: new Date().toISOString(),
      userId: 'admin',
      userName: 'Administrator',
      action: 'تهيئة النظام',
      details: 'تمت فرمتة النظام وإعادة التعيين من الصفر بنجاح'
    }] as ActivityLog[],
    repairs: [] as RepairOrder[],
    expenses: [] as Expense[],
    commercialDocuments: [] as CommercialDocument[]
  };
}

export async function resetStoredToDefaults() {
  if (typeof window === 'undefined') return getZeroResetData();

  const zeroData = getZeroResetData();

  // 1. Clear POS sessions & update localStorage
  try {
    localStorage.removeItem('pos_active_sessions');
    Object.values(KEYS).forEach((k) => {
      try { localStorage.removeItem(k); } catch {}
    });
  } catch {}
  saveStoredData(zeroData);

  // 2. Wipe SQLite database via API
  try {
    const res = await fetch('/api/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(zeroData)
    });
    if (!res.ok) throw new Error('Reset returned non-200');
  } catch (err) {
    try {
      await fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(zeroData)
      });
    } catch (e) {
      // Offline or standalone iOS mode
    }
  }

  return zeroData;
}
