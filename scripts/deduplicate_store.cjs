const fs = require('fs');
const path = require('path');

async function run() {
  console.log('--- Starting SmartPOS Deduplication & Reconciliation ---');
  
  // 1. Fetch latest data from Firebase
  const url = 'https://smartpos-a9fda-default-rtdb.firebaseio.com/smartpos_stores/store_01.json';
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch from Firebase: ${res.statusText}`);
  }
  const payload = await res.json();
  if (!payload || !payload.data) {
    throw new Error('No data found in Firebase payload');
  }

  const data = payload.data;
  const products = data.products || [];
  const invoices = data.invoices || [];
  const commercialDocuments = data.commercialDocuments || [];
  const purchases = data.purchases || [];
  let deletedIds = Array.isArray(data.deletedIds) ? [...data.deletedIds] : [];

  console.log(`Original state: ${products.length} products, ${invoices.length} invoices, ${commercialDocuments.length} docs, ${purchases.length} purchases.`);

  const normalize = (s) => (s || '').trim().toLowerCase().replace(/\s+/g, ' ');

  // Group products by normalized name AND/OR index
  // First, group by CSV index if available:
  const byIndex = new Map();
  const nonIndexed = [];

  for (const p of products) {
    const m = (p.id || '').match(/^prod_\d+_(\d+)$/);
    if (m) {
      const idx = m[1];
      if (!byIndex.has(idx)) byIndex.set(idx, []);
      byIndex.get(idx).push(p);
    } else {
      nonIndexed.push(p);
    }
  }

  const mergedProducts = [];
  const idRemap = new Map(); // oldId -> primaryId
  const removedIds = [];

  // Process indexed groups
  for (const [idx, list] of byIndex.entries()) {
    if (list.length === 1) {
      mergedProducts.push({ ...list[0] });
      continue;
    }

    // Sort: newest first (highest timestamp in ID)
    list.sort((a, b) => b.id.localeCompare(a.id));
    const primary = { ...list[0] };
    const secondaries = list.slice(1);

    // Sum stock across all copies
    const totalStock = list.reduce((sum, item) => sum + (Number(item.stock) || 0), 0);
    primary.stock = totalStock;

    // Check for upgraded attributes (e.g. real barcode on secondary)
    for (const sec of secondaries) {
      if ((!primary.sku || primary.sku.length <= 4) && sec.sku && sec.sku.length > primary.sku?.length) {
        primary.sku = sec.sku;
      }
      if (!primary.imageUrl && sec.imageUrl) primary.imageUrl = sec.imageUrl;
      if (!primary.warehouseId && sec.warehouseId) primary.warehouseId = sec.warehouseId;
      if (!primary.category && sec.category) primary.category = sec.category;
      if (!primary.unit && sec.unit) primary.unit = sec.unit;
      
      idRemap.set(sec.id, primary.id);
      removedIds.push(sec.id);
    }

    mergedProducts.push(primary);
  }

  // Process non-indexed products: check if any duplicate exists by name
  for (const p of nonIndexed) {
    const normName = normalize(p.name);
    const existing = mergedProducts.find(x => normalize(x.name) === normName);
    if (existing) {
      existing.stock = (Number(existing.stock) || 0) + (Number(p.stock) || 0);
      if (!existing.sku && p.sku) existing.sku = p.sku;
      if (!existing.imageUrl && p.imageUrl) existing.imageUrl = p.imageUrl;
      idRemap.set(p.id, existing.id);
      removedIds.push(p.id);
    } else {
      mergedProducts.push({ ...p });
    }
  }

  console.log(`Deduplication: Reduced ${products.length} products to ${mergedProducts.length} unique products.`);
  console.log(`Removed duplicate IDs: ${removedIds.length}`);

  // Remap in invoices
  let invoiceItemsUpdated = 0;
  for (const inv of invoices) {
    if (!inv.items || !Array.isArray(inv.items)) continue;
    for (const it of inv.items) {
      if (it.productId && idRemap.has(it.productId)) {
        it.productId = idRemap.get(it.productId);
        invoiceItemsUpdated++;
      }
    }
  }

  // Remap in commercialDocuments
  let docItemsUpdated = 0;
  for (const doc of commercialDocuments) {
    if (!doc.items || !Array.isArray(doc.items)) continue;
    for (const it of doc.items) {
      if (it.productId && idRemap.has(it.productId)) {
        it.productId = idRemap.get(it.productId);
        docItemsUpdated++;
      }
    }
  }

  // Remap in purchases
  let purItemsUpdated = 0;
  for (const pur of purchases) {
    if (!pur.items || !Array.isArray(pur.items)) continue;
    for (const it of pur.items) {
      if (it.productId && idRemap.has(it.productId)) {
        it.productId = idRemap.get(it.productId);
        purItemsUpdated++;
      }
    }
  }

  console.log(`Remapped in invoices: ${invoiceItemsUpdated} items`);
  console.log(`Remapped in commercial docs: ${docItemsUpdated} items`);
  console.log(`Remapped in purchases: ${purItemsUpdated} items`);

  // Add removed IDs to deletedIds
  const deletedSet = new Set(deletedIds);
  for (const rId of removedIds) {
    deletedSet.add(rId);
  }
  const updatedDeletedIds = Array.from(deletedSet);

  // Add activity log
  const newLog = {
    id: `log_dedup_${Date.now()}`,
    timestamp: new Date().toISOString(),
    userId: 'admin',
    userName: 'نظام المعالجة الذاتية',
    action: 'تنظيف المنتجات المكررة',
    details: `تم دمج ${removedIds.length} منتج مكرر بنجاح، وتوحيد المخزون، وإعادة ربط ${invoiceItemsUpdated} عنصر بالفواتير.`
  };
  const updatedLogs = [newLog, ...(data.logs || [])].slice(0, 150);

  // Construct new payload
  const updatedPayload = {
    ...payload,
    updatedAt: new Date().toISOString(),
    source: 'dedup_utility',
    data: {
      ...data,
      products: mergedProducts,
      invoices,
      commercialDocuments,
      purchases,
      deletedIds: updatedDeletedIds,
      logs: updatedLogs,
    }
  };

  // 2. Push to Firebase
  console.log('Pushing deduplicated payload to Firebase...');
  const putRes = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updatedPayload)
  });

  if (!putRes.ok) {
    throw new Error(`Firebase PUT failed: ${putRes.status} ${putRes.statusText}`);
  }
  console.log('✅ Firebase updated successfully!');

  // 3. Update local SQLite databases (both current and Desktop)
  const sqliteMod = require('node:sqlite');
  const dbsToUpdate = [
    path.join(__dirname, '..', 'database.sqlite'),
    'C:\\Users\\Houcine\\Desktop\\sales-and-invoicing-system\\database.sqlite'
  ];

  for (const dbPath of dbsToUpdate) {
    if (!fs.existsSync(dbPath)) continue;
    console.log(`Updating SQLite database at: ${dbPath}...`);
    try {
      const sdb = new sqliteMod.DatabaseSync(dbPath);
      sdb.exec('BEGIN TRANSACTION');
      
      // Update config deleted_ids
      sdb.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)').run('deleted_ids', JSON.stringify(updatedDeletedIds));

      // Remove deleted products
      for (const rId of removedIds) {
        sdb.prepare('DELETE FROM products WHERE id = ?').run(rId);
      }

      // Upsert merged products
      for (const p of mergedProducts) {
        sdb.prepare(`
          INSERT OR REPLACE INTO products 
          (id, sku, name, category, purchasePrice, sellingPrice, wholesalePrice, stock, minStock, unit, imageUrl, warehouseId)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          p.id,
          p.sku || '',
          p.name || '',
          p.category || 'عام',
          Number(p.purchasePrice) || 0,
          Number(p.sellingPrice) || 0,
          Number(p.wholesalePrice || p.sellingPrice) || 0,
          Number(p.stock) || 0,
          Number(p.minStock) || 5,
          p.unit || 'pcs',
          p.imageUrl || '',
          p.warehouseId || ''
        );
      }

      // Update invoices in sqlite
      for (const inv of invoices) {
        sdb.prepare(`
          INSERT OR REPLACE INTO invoices
          (id, invoiceNumber, date, customerId, customerName, items, subtotal, discount, tax, total, amountPaid, paymentMethod, status, notes, returnedItems, sellerId, sellerName, previousBalance)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          inv.id,
          inv.invoiceNumber || '',
          inv.date || '',
          inv.customerId || '',
          inv.customerName || '',
          JSON.stringify(inv.items || []),
          Number(inv.subtotal) || 0,
          Number(inv.discount) || 0,
          Number(inv.tax) || 0,
          Number(inv.total) || 0,
          Number(inv.amountPaid) || 0,
          inv.paymentMethod || 'cash',
          inv.status || 'paid',
          inv.notes || '',
          JSON.stringify(inv.returnedItems || []),
          inv.sellerId || '',
          inv.sellerName || '',
          Number(inv.previousBalance) || 0
        );
      }

      // Update stock_movements product IDs if any
      for (const [oldId, newId] of idRemap.entries()) {
        try {
          sdb.prepare('UPDATE stock_movements SET productId = ? WHERE productId = ?').run(newId, oldId);
        } catch {}
      }

      sdb.exec('COMMIT');
      console.log(`✅ SQLite updated at: ${dbPath}`);
    } catch (err) {
      console.error(`Error updating SQLite at ${dbPath}:`, err);
    }
  }

  // 4. Also notify running server at http://localhost:3000 if reachable
  try {
    const notifyRes = await fetch('http://localhost:3000/api/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedPayload.data)
    });
    console.log('Notified local server:', notifyRes.status);
  } catch (err) {
    console.log('Local server ping info:', err.message);
  }

  console.log('--- Deduplication Complete Successfully! ---');
}

run().catch(err => {
  console.error('Fatal error during deduplication:', err);
  process.exit(1);
});
