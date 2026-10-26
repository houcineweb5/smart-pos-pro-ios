/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import path from 'path';
import { 
  INITIAL_PRODUCTS, 
  INITIAL_CUSTOMERS, 
  INITIAL_SUPPLIERS, 
  INITIAL_PURCHASES, 
  INITIAL_CONFIG, 
  INITIAL_EMPLOYEES, 
  INITIAL_LOGS, 
  INITIAL_REPAIRS,
  INITIAL_EXPENSES,
  INITIAL_COMMERCIAL_DOCUMENTS,
  getInitialInvoices
} from './src/dataStore.js';

let db: any = null;

export async function initDB() {
  if (db) return db;

  const dbFilePath = path.join(process.cwd(), 'database.sqlite');
  const sqliteMod: any = await import('node:sqlite');
  const rawDb = new sqliteMod.DatabaseSync(dbFilePath);

  db = {
    exec: async (sql: string) => {
      rawDb.exec(sql);
    },
    get: async (sql: string, params?: any[]) => {
      const stmt = rawDb.prepare(sql);
      return params && params.length > 0 ? stmt.get(...params) : stmt.get();
    },
    all: async (sql: string, params?: any[]) => {
      const stmt = rawDb.prepare(sql);
      return params && params.length > 0 ? stmt.all(...params) : stmt.all();
    },
    run: async (sql: string, params?: any[]) => {
      if (!params || params.length === 0) {
        rawDb.exec(sql);
        return;
      }
      const stmt = rawDb.prepare(sql);
      return stmt.run(...params);
    }
  };

  // 1. products
  await db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      sku TEXT,
      name TEXT,
      category TEXT,
      purchasePrice REAL,
      sellingPrice REAL,
      wholesalePrice REAL,
      stock INTEGER,
      minStock INTEGER,
      unit TEXT,
      imageUrl TEXT
    )
  `);

  try {
    await db.exec('ALTER TABLE products ADD COLUMN wholesalePrice REAL');
  } catch (e) {
    // Column already exists or table doesn't exist yet
  }

  try {
    await db.exec('ALTER TABLE products ADD COLUMN imageUrl TEXT');
  } catch (e) {
    // Column already exists
  }

  // 2. customers
  await db.exec(`
    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      name TEXT,
      phone TEXT,
      email TEXT,
      ice TEXT,
      address TEXT,
      debt REAL,
      notes TEXT,
      createdAt TEXT
    )
  `);

  try {
    await db.exec('ALTER TABLE customers ADD COLUMN ice TEXT');
  } catch (e) {
    // Column already exists
  }

  try {
    await db.exec('ALTER TABLE customers ADD COLUMN address TEXT');
  } catch (e) {
    // Column already exists
  }

  // 3. suppliers
  await db.exec(`
    CREATE TABLE IF NOT EXISTS suppliers (
      id TEXT PRIMARY KEY,
      name TEXT,
      phone TEXT,
      email TEXT,
      company TEXT,
      debt REAL,
      notes TEXT,
      createdAt TEXT
    )
  `);

  // 4. purchases
  await db.exec(`
    CREATE TABLE IF NOT EXISTS purchases (
      id TEXT PRIMARY KEY,
      purchaseNumber TEXT,
      date TEXT,
      supplierId TEXT,
      supplierName TEXT,
      items TEXT,
      total REAL,
      amountPaid REAL,
      status TEXT,
      notes TEXT,
      payments TEXT
    )
  `);

  try {
    await db.exec('ALTER TABLE purchases ADD COLUMN payments TEXT');
  } catch (e) {
    // Column already exists
  }

  // 5. invoices
  await db.exec(`
    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      invoiceNumber TEXT,
      date TEXT,
      customerId TEXT,
      customerName TEXT,
      items TEXT,
      subtotal REAL,
      discount REAL,
      tax REAL,
      total REAL,
      amountPaid REAL,
      paymentMethod TEXT,
      status TEXT,
      notes TEXT,
      returnedItems TEXT,
      sellerId TEXT,
      sellerName TEXT
    )
  `);

  try {
    await db.exec('ALTER TABLE invoices ADD COLUMN returnedItems TEXT');
  } catch (e) {
    // Column already exists
  }

  try {
    await db.exec('ALTER TABLE invoices ADD COLUMN sellerId TEXT');
  } catch (e) {
    // Column already exists
  }

  try {
    await db.exec('ALTER TABLE invoices ADD COLUMN sellerName TEXT');
  } catch (e) {
    // Column already exists
  }

  try {
    await db.exec('ALTER TABLE invoices ADD COLUMN previousBalance REAL');
  } catch (e) {
    // Column already exists
  }

  // 6. config
  await db.exec(`
    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `);

  // 7. employees
  await db.exec(`
    CREATE TABLE IF NOT EXISTS employees (
      id TEXT PRIMARY KEY,
      username TEXT,
      name TEXT,
      role TEXT,
      passwordHash TEXT,
      allowedTabs TEXT,
      createdAt TEXT,
      photoUrl TEXT
    )
  `);

  try {
    await db.exec('ALTER TABLE employees ADD COLUMN photoUrl TEXT');
  } catch (e) {
    // Column already exists
  }

  // 8. logs
  await db.exec(`
    CREATE TABLE IF NOT EXISTS logs (
      id TEXT PRIMARY KEY,
      timestamp TEXT,
      userId TEXT,
      userName TEXT,
      action TEXT,
      details TEXT
    )
  `);

  // 9. repairs
  await db.exec(`
    CREATE TABLE IF NOT EXISTS repairs (
      id TEXT PRIMARY KEY,
      orderNumber TEXT,
      customerName TEXT,
      customerPhone TEXT,
      itemName TEXT,
      itemSerial TEXT,
      issueDescription TEXT,
      status TEXT,
      estimatedCost REAL,
      amountPaid REAL,
      createdAt TEXT,
      estimatedDeliveryDate TEXT,
      notes TEXT,
      sellerId TEXT,
      sellerName TEXT
    )
  `);

  // 10. expenses
  await db.exec(`
    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      amount REAL NOT NULL,
      category TEXT,
      date TEXT,
      notes TEXT,
      createdByName TEXT
    )
  `);

  // 11. commercial_documents (devis, bon de commande, bon de livraison, facture)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS commercial_documents (
      id TEXT PRIMARY KEY,
      docType TEXT,
      docNumber TEXT,
      date TEXT,
      validUntil TEXT,
      customerId TEXT,
      customerName TEXT,
      customerPhone TEXT,
      customerAddress TEXT,
      items TEXT,
      subtotal REAL,
      discount REAL,
      tax REAL,
      total REAL,
      amountPaid REAL,
      previousBalance REAL,
      paymentMethod TEXT,
      status TEXT,
      notes TEXT,
      convertedTo TEXT,
      convertedFrom TEXT,
      sellerName TEXT
    )
  `);

  try {
    await db.exec('ALTER TABLE commercial_documents ADD COLUMN amountPaid REAL');
  } catch (e) {}
  try {
    await db.exec('ALTER TABLE commercial_documents ADD COLUMN previousBalance REAL');
  } catch (e) {}
  try {
    await db.exec('ALTER TABLE commercial_documents ADD COLUMN paymentMethod TEXT');
  } catch (e) {}

  // Ensure default store config exists
  const configExists = await db.get('SELECT COUNT(*) as count FROM config WHERE key = ?', ['store_config']);
  if (!configExists || configExists.count === 0) {
    await db.run('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)', ['store_config', JSON.stringify(INITIAL_CONFIG)]);
  }

  // Ensure default employees exist if employees table is empty
  const empExists = await db.get('SELECT COUNT(*) as count FROM employees');
  if (!empExists || empExists.count === 0) {
    for (const e of INITIAL_EMPLOYEES) {
      await db.run(
        'INSERT OR REPLACE INTO employees (id, username, name, role, passwordHash, allowedTabs, createdAt, photoUrl) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [e.id, e.username, e.name, e.role, e.passwordHash, JSON.stringify(e.allowedTabs), e.createdAt, e.photoUrl || '']
      );
    }
  } else {
    await db.run(
      `UPDATE employees SET photoUrl = '/sp-icon.png', passwordHash = CASE WHEN passwordHash = 'admin' THEN 'smartpos' ELSE passwordHash END WHERE id = 'emp-admin' OR username = 'admin'`
    );
  }

  // Ensure default walk-in customer exists if customers table is empty
  const custExists = await db.get('SELECT COUNT(*) as count FROM customers');
  if (!custExists || custExists.count === 0) {
    for (const c of INITIAL_CUSTOMERS) {
      await db.run(
        'INSERT OR REPLACE INTO customers (id, name, phone, email, debt, notes, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [c.id, c.name, c.phone, c.email, c.debt, c.notes, c.createdAt]
      );
    }
  }

  // Ensure initial log exists if logs table is empty
  const logExists = await db.get('SELECT COUNT(*) as count FROM logs');
  if (!logExists || logExists.count === 0) {
    for (const l of INITIAL_LOGS) {
      await db.run(
        'INSERT OR REPLACE INTO logs (id, timestamp, userId, userName, action, details) VALUES (?, ?, ?, ?, ?, ?)',
        [l.id, l.timestamp, l.userId, l.userName, l.action, l.details]
      );
    }
  }

  return db;
}

export async function getData() {
  const database = await initDB();

  const products = await database.all('SELECT * FROM products');
  const customers = await database.all('SELECT * FROM customers');
  const suppliers = await database.all('SELECT * FROM suppliers');

  const rawPurchases = await database.all('SELECT * FROM purchases');
  const purchases = rawPurchases.map((p: any) => ({
    ...p,
    items: JSON.parse(p.items),
    payments: p.payments ? JSON.parse(p.payments) : []
  }));

  const rawInvoices = await database.all('SELECT * FROM invoices');
  const invoices = rawInvoices.map((inv: any) => ({
    ...inv,
    items: JSON.parse(inv.items),
    returnedItems: inv.returnedItems ? JSON.parse(inv.returnedItems) : [],
    sellerId: inv.sellerId || '',
    sellerName: inv.sellerName || ''
  }));

  const configRow = await database.get('SELECT value FROM config WHERE key = ?', ['store_config']);
  const config = configRow ? JSON.parse(configRow.value) : INITIAL_CONFIG;

  const rawEmployees = await database.all('SELECT * FROM employees');
  const employees = rawEmployees.map((e: any) => ({
    ...e,
    allowedTabs: JSON.parse(e.allowedTabs)
  }));

  const logs = await database.all('SELECT * FROM logs ORDER BY timestamp DESC');

  const repairs = await database.all('SELECT * FROM repairs');

  const expenses = await database.all('SELECT * FROM expenses ORDER BY date DESC');

  const rawDocs = await database.all('SELECT * FROM commercial_documents ORDER BY date DESC');
  const commercialDocuments = (rawDocs || []).map((d: any) => ({
    ...d,
    items: JSON.parse(d.items || '[]'),
    convertedTo: d.convertedTo ? JSON.parse(d.convertedTo) : undefined,
    convertedFrom: d.convertedFrom ? JSON.parse(d.convertedFrom) : undefined
  }));

  const deletedRow = await database.get('SELECT value FROM config WHERE key = ?', ['deleted_ids']);
  let deletedIds: string[] = [];
  if (deletedRow && deletedRow.value) {
    try {
      const parsed = JSON.parse(deletedRow.value);
      if (Array.isArray(parsed)) deletedIds = parsed;
    } catch {}
  }

  return {
    products,
    customers,
    suppliers,
    purchases,
    invoices,
    config,
    employees,
    logs,
    repairs,
    expenses: expenses || [],
    commercialDocuments: commercialDocuments || [],
    deletedIds
  };
}

export async function getCloudConfigFromDB() {
  const database = await initDB();
  const row = await database.get('SELECT value FROM config WHERE key = ?', ['cloud_sync_config']);
  if (row && row.value) {
    try {
      return JSON.parse(row.value);
    } catch {
      return null;
    }
  }
  return null;
}

export async function saveCloudConfigToDB(cfg: any) {
  const database = await initDB();
  await database.run('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)', [
    'cloud_sync_config',
    JSON.stringify(cfg || {}),
  ]);
  return { ok: true };
}

export async function saveData(data: any) {
  const database = await initDB();

  await database.run('BEGIN TRANSACTION');
  try {
    // 1. Products
    if (data.products) {
      await database.run('DELETE FROM products');
      for (const p of data.products) {
        await database.run(
          'INSERT INTO products (id, sku, name, category, purchasePrice, sellingPrice, wholesalePrice, stock, minStock, unit, imageUrl) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [p.id, p.sku, p.name, p.category, p.purchasePrice, p.sellingPrice, p.wholesalePrice || p.sellingPrice, p.stock, p.minStock, p.unit, p.imageUrl || '']
        );
      }
    }

    // 2. Customers
    if (data.customers) {
      await database.run('DELETE FROM customers');
      for (const c of data.customers) {
        await database.run(
          'INSERT INTO customers (id, name, phone, email, ice, address, debt, notes, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [c.id, c.name, c.phone, c.email, c.ice || '', c.address || '', c.debt, c.notes, c.createdAt]
        );
      }
    }

    // 3. Suppliers
    if (data.suppliers) {
      await database.run('DELETE FROM suppliers');
      for (const s of data.suppliers) {
        await database.run(
          'INSERT INTO suppliers (id, name, phone, email, company, debt, notes, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [s.id, s.name, s.phone, s.email, s.company, s.debt, s.notes, s.createdAt]
        );
      }
    }

    // 4. Purchases
    if (data.purchases) {
      await database.run('DELETE FROM purchases');
      for (const pur of data.purchases) {
        await database.run(
          'INSERT INTO purchases (id, purchaseNumber, date, supplierId, supplierName, items, total, amountPaid, status, notes, payments) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [
            pur.id, pur.purchaseNumber, pur.date, pur.supplierId, pur.supplierName, JSON.stringify(pur.items),
            pur.total, pur.amountPaid, pur.status, pur.notes || '',
            pur.payments ? JSON.stringify(pur.payments) : '[]'
          ]
        );
      }
    }

    // 5. Invoices
    if (data.invoices) {
      await database.run('DELETE FROM invoices');
      for (const inv of data.invoices) {
        await database.run(
          'INSERT INTO invoices (id, invoiceNumber, date, customerId, customerName, items, subtotal, discount, tax, total, amountPaid, previousBalance, paymentMethod, status, notes, returnedItems, sellerId, sellerName) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [
            inv.id, inv.invoiceNumber, inv.date, inv.customerId || '', inv.customerName, JSON.stringify(inv.items),
            inv.subtotal, inv.discount, inv.tax, inv.total, inv.amountPaid, Number(inv.previousBalance || 0), inv.paymentMethod, inv.status, inv.notes || '',
            inv.returnedItems ? JSON.stringify(inv.returnedItems) : '[]',
            inv.sellerId || '', inv.sellerName || ''
          ]
        );
      }
    }

    // 6. Config
    if (data.config) {
      await database.run('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)', ['store_config', JSON.stringify(data.config)]);
    }

    if (Array.isArray(data.deletedIds)) {
      await database.run('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)', ['deleted_ids', JSON.stringify(data.deletedIds.slice(-1000))]);
    }

    // 7. Employees
    if (data.employees) {
      await database.run('DELETE FROM employees');
      for (const e of data.employees) {
        await database.run(
          'INSERT INTO employees (id, username, name, role, passwordHash, allowedTabs, createdAt, photoUrl) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [e.id, e.username, e.name, e.role, e.passwordHash, JSON.stringify(e.allowedTabs), e.createdAt, e.photoUrl || '']
        );
      }
    }

    // 8. Logs
    if (data.logs) {
      await database.run('DELETE FROM logs');
      for (const l of data.logs) {
        await database.run(
          'INSERT INTO logs (id, timestamp, userId, userName, action, details) VALUES (?, ?, ?, ?, ?, ?)',
          [l.id, l.timestamp, l.userId, l.userName, l.action, l.details]
        );
      }
    }

    // 9. Repairs
    if (data.repairs) {
      await database.run('DELETE FROM repairs');
      for (const r of data.repairs) {
        await database.run(
          'INSERT INTO repairs (id, orderNumber, customerName, customerPhone, itemName, itemSerial, issueDescription, status, estimatedCost, amountPaid, createdAt, estimatedDeliveryDate, notes, sellerId, sellerName) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [
            r.id, r.orderNumber, r.customerName, r.customerPhone, r.itemName, r.itemSerial || '', r.issueDescription, 
            r.status, r.estimatedCost, r.amountPaid, r.createdAt, r.estimatedDeliveryDate || '', r.notes || '', 
            r.sellerId || '', r.sellerName || ''
          ]
        );
      }
    }

    // 10. Expenses
    if (data.expenses) {
      await database.run('DELETE FROM expenses');
      for (const ex of data.expenses) {
        await database.run(
          'INSERT INTO expenses (id, title, amount, category, date, notes, createdByName) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [ex.id, ex.title, ex.amount, ex.category, ex.date, ex.notes || '', ex.createdByName || '']
        );
      }
    }

    // 11. Commercial Documents
    if (data.commercialDocuments) {
      await database.run('DELETE FROM commercial_documents');
      for (const d of data.commercialDocuments) {
        await database.run(
          'INSERT INTO commercial_documents (id, docType, docNumber, date, validUntil, customerId, customerName, customerPhone, customerAddress, items, subtotal, discount, tax, total, amountPaid, previousBalance, paymentMethod, status, notes, convertedTo, convertedFrom, sellerName) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [
            d.id, d.docType, d.docNumber, d.date, d.validUntil || '',
            d.customerId || '', d.customerName || '', d.customerPhone || '', d.customerAddress || '',
            JSON.stringify(d.items || []), d.subtotal || 0, d.discount || 0, d.tax || 0, d.total || 0,
            d.amountPaid !== undefined ? Number(d.amountPaid) : (d.total || 0),
            Number(d.previousBalance || 0),
            d.paymentMethod || 'cash',
            d.status || 'draft', d.notes || '',
            d.convertedTo ? JSON.stringify(d.convertedTo) : '',
            d.convertedFrom ? JSON.stringify(d.convertedFrom) : '',
            d.sellerName || ''
          ]
        );
      }
    }

    await database.run('COMMIT');
    return { success: true };
  } catch (error) {
    await database.run('ROLLBACK');
    console.error('Error saving data to SQLite:', error);
    throw error;
  }
}

export async function resetDB(zeroPayload?: any) {
  const database = await initDB();
  await database.run('BEGIN TRANSACTION');
  try {
    await database.run('DELETE FROM products');
    await database.run('DELETE FROM customers');
    await database.run('DELETE FROM suppliers');
    await database.run('DELETE FROM purchases');
    await database.run('DELETE FROM invoices');
    await database.run('DELETE FROM repairs');
    await database.run('DELETE FROM expenses');
    await database.run('DELETE FROM commercial_documents');
    await database.run('DELETE FROM logs');

    const customersToInsert = Array.isArray(zeroPayload?.customers) && zeroPayload.customers.length > 0
      ? zeroPayload.customers
      : INITIAL_CUSTOMERS;
    for (const c of customersToInsert) {
      await database.run(
        'INSERT INTO customers (id, name, phone, email, ice, address, debt, notes, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [c.id, c.name, c.phone || '', c.email || '', c.ice || '', c.address || '', c.debt || 0, c.notes || '', c.createdAt || new Date().toISOString()]
      );
    }

    await database.run(
      'INSERT INTO logs (id, timestamp, userId, userName, action, details) VALUES (?, ?, ?, ?, ?, ?)',
      ['log_' + Date.now(), new Date().toISOString(), 'admin', 'Administrator', 'تهيئة النظام', 'تمت فرمتة النظام وإعادة التعيين من الصفر بنجاح']
    );

    await database.run('COMMIT');
    return { success: true };
  } catch (error) {
    await database.run('ROLLBACK');
    console.error('Error resetting SQLite database:', error);
    throw error;
  }
}
