#!/usr/bin/env node
/**
 * SmartPOS Pro - Clean Production Database Generator
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { DatabaseSync } = require('node:sqlite');

function createCleanDb(applyToMain) {
  const cwd = process.cwd();
  const targetDbFile = applyToMain 
    ? path.join(cwd, 'database.sqlite')
    : path.join(cwd, 'database_clean.sqlite');

  console.log('\n========================================================');
  console.log('  SmartPOS Pro - إنشاء قاعدة بيانات إنتاجية نظيفة للبيع');
  console.log('========================================================');
  console.log(`المسار المستهدف: ${targetDbFile}`);

  // Backup current database if applying to main
  if (applyToMain && fs.existsSync(targetDbFile)) {
    const bakDir = path.join(cwd, 'backups');
    if (!fs.existsSync(bakDir)) fs.mkdirSync(bakDir, { recursive: true });
    const bak = path.join(bakDir, `database_backup_before_clean_${Date.now()}.sqlite`);
    fs.copyFileSync(targetDbFile, bak);
    console.log(`📁 تم حفظ نسخة احتياطية من قاعدة بياناتك الحالية في:\n   ${bak}`);
  }

  // Remove target if separate clean db
  if (!applyToMain && fs.existsSync(targetDbFile)) {
    fs.unlinkSync(targetDbFile);
  }

  const db = new DatabaseSync(targetDbFile);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA busy_timeout = 5000;');

  db.exec(`
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
      imageUrl TEXT,
      expiryDate TEXT,
      warehouseId TEXT
    );

    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      name TEXT,
      phone TEXT,
      email TEXT,
      ice TEXT,
      address TEXT,
      debt REAL,
      creditLimit REAL,
      notes TEXT,
      createdAt TEXT
    );

    CREATE TABLE IF NOT EXISTS suppliers (
      id TEXT PRIMARY KEY,
      name TEXT,
      phone TEXT,
      email TEXT,
      address TEXT,
      ice TEXT,
      debt REAL,
      notes TEXT,
      createdAt TEXT
    );

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
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      invoiceNumber TEXT UNIQUE,
      date TEXT,
      customerId TEXT,
      customerName TEXT,
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
      returnedItems TEXT,
      sellerId TEXT,
      sellerName TEXT
    );

    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS employees (
      id TEXT PRIMARY KEY,
      username TEXT,
      name TEXT,
      role TEXT,
      passwordHash TEXT,
      allowedTabs TEXT,
      createdAt TEXT,
      photoUrl TEXT
    );

    CREATE TABLE IF NOT EXISTS logs (
      id TEXT PRIMARY KEY,
      timestamp TEXT,
      userId TEXT,
      userName TEXT,
      action TEXT,
      details TEXT
    );

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
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      amount REAL NOT NULL,
      category TEXT,
      date TEXT,
      notes TEXT,
      createdByName TEXT
    );

    CREATE TABLE IF NOT EXISTS commercial_documents (
      id TEXT PRIMARY KEY,
      docType TEXT,
      docNumber TEXT,
      date TEXT,
      validUntil TEXT,
      customerId TEXT,
      customerName TEXT,
      items TEXT,
      subtotal REAL,
      discount REAL,
      tax REAL,
      total REAL,
      status TEXT,
      notes TEXT,
      convertedInvoiceId TEXT,
      convertedDate TEXT,
      sellerId TEXT,
      sellerName TEXT,
      amountPaid REAL,
      previousBalance REAL,
      paymentMethod TEXT
    );

    CREATE TABLE IF NOT EXISTS customer_payments (
      id TEXT PRIMARY KEY,
      customerId TEXT,
      customerName TEXT,
      amount REAL,
      date TEXT,
      notes TEXT,
      receivedByName TEXT
    );

    CREATE TABLE IF NOT EXISTS stock_movements (
      id TEXT PRIMARY KEY,
      productId TEXT NOT NULL,
      productName TEXT,
      delta INTEGER NOT NULL,
      type TEXT NOT NULL,
      referenceId TEXT,
      referenceNumber TEXT,
      timestamp TEXT NOT NULL,
      userId TEXT,
      userName TEXT,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS warehouses (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      location TEXT,
      isDefault INTEGER DEFAULT 0,
      notes TEXT
    );
  `);

  // Clean out transactional data
  db.exec(`
    DELETE FROM invoices;
    DELETE FROM customer_payments;
    DELETE FROM stock_movements;
    DELETE FROM purchases;
    DELETE FROM expenses;
    DELETE FROM repairs;
    DELETE FROM commercial_documents;
    DELETE FROM logs;
    DELETE FROM customers;
    DELETE FROM warehouses;
  `);

  // Insert default walk-in customer
  db.prepare(`
    INSERT INTO customers (id, name, phone, email, ice, address, debt, creditLimit, notes, createdAt)
    VALUES ('walk-in', 'Client Divers', '', '', '', '', 0, 0, 'الزبون الافتراضي للمبيعات المباشرة', datetime('now'))
  `).run();

  // Insert default warehouse
  db.prepare(`
    INSERT INTO warehouses (id, name, location, isDefault, notes)
    VALUES ('wh-main', 'المستودع الرئيسي', 'المقر الرئيسي', 1, 'المستودع الافتراضي للنظام')
  `).run();

  // Clean default store config
  const cleanConfig = {
    name: 'Smart Pos',
    phone: '',
    email: '',
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
    themeColor: 'indigo',
    receiptTheme: 'classic',
    a4Theme: 'slate',
    defaultPrintMode: '80mm',
    showLogoOnInvoice: true,
    showPhoneOnInvoice: true,
    showAddressOnInvoice: true,
    showCashierOnInvoice: true,
    showBarcodeOnInvoice: true,
    receiptFooterMessage: 'شكراً لزيارتكم! مرحباً بكم دائماً',
    isConfigured: false
  };

  db.prepare(`
    INSERT OR REPLACE INTO config (key, value) VALUES ('store_config', ?)
  `).run(JSON.stringify(cleanConfig));

  db.prepare(`
    INSERT INTO logs (id, timestamp, userId, userName, action, details)
    VALUES ('log_init', datetime('now'), 'system', 'النظام', 'تهيئة النسخة الإنتاجية', 'تم تجهيز قاعدة البيانات التجارية النظيفة بنجاح')
  `).run();

  console.log('✅ تم إنشاء قاعدة البيانات النظيفة بنجاح!');
  console.log('   - الفواتير: 0');
  console.log('   - المشتريات: 0');
  console.log('   - الديون: 0');
  console.log('   - المصروفات: 0');
  console.log('   - وثائق تجارية: 0');
  console.log('   - العميل الافتراضي: Client Divers');
  console.log('   - معالج الترحيب والإعداد الأولي: مفعل تلقائياً');
  console.log('========================================================\n');
  db.close();
}

const args = process.argv.slice(2);
const isInteractive = args.includes('--interactive') || args.length === 0;

if (!isInteractive) {
  const applyToMain = args.includes('--apply-to-main');
  createCleanDb(applyToMain);
} else {
  console.log('======================================================================');
  console.log('        🗄️ SmartPOS Pro - أداة إعداد قاعدة بيانات إنتاجية للبيع');
  console.log('======================================================================\n');
  console.log('اختر أحد الخيارات التالية:');
  console.log('[1] إنشاء ملف منفصل database_clean.sqlite (بدون مساس ببياناتك الحالية)');
  console.log('[2] تنظيف قاعدة البيانات الرئيسية database.sqlite (مع أخذ نسخة احتياطية)');
  console.log('[3] إلغاء وخروج\n');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.question('أدخل رقم الخيار (1 أو 2 أو 3): ', (choice) => {
    const c = (choice || '').trim();
    if (c === '1') {
      createCleanDb(false);
    } else if (c === '2') {
      createCleanDb(true);
    } else {
      console.log('\nتم الإلغاء.');
    }
    rl.question('اضغط Enter للخروج...', () => {
      rl.close();
    });
  });
}
