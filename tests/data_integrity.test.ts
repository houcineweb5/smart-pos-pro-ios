import { initDB, saveData, getData } from '../server_db';
import assert from 'node:assert';
import test, { before } from 'node:test';

before(async () => {
  await initDB();
});

test('Data Integrity: Incremental save preserves unrelated records and does not wipe tables', async () => {
  const initial = await getData();
  const testCustomer = {
    id: 'cust_test_persist_' + Date.now(),
    name: 'Customer Safe Persist',
    phone: '0600000000',
    email: '',
    ice: '',
    address: 'City Center',
    debt: 120,
    notes: 'Safe customer',
    createdAt: new Date().toISOString(),
  };

  // Add the test customer
  await saveData({
    customers: [...initial.customers, testCustomer],
  });

  // Verify customer is saved
  let updated = await getData();
  const found = updated.customers.find((c: any) => c.id === testCustomer.id);
  assert.ok(found, 'New customer must be saved in database');
  assert.strictEqual(found.debt, 120);

  // Now perform an update ONLY modifying products (customers array is omitted)
  const testProduct = {
    id: 'prod_test_persist_' + Date.now(),
    sku: 'SKU-SAFE-99',
    name: 'Safe Product Item',
    category: 'General',
    purchasePrice: 50,
    sellingPrice: 80,
    wholesalePrice: 70,
    stock: 25,
    minStock: 5,
    unit: 'pcs',
    imageUrl: '',
  };

  await saveData({
    products: [...initial.products, testProduct],
  });

  // Critical verification: Customer MUST NOT be deleted even though customers was omitted!
  updated = await getData();
  const customerStillExists = updated.customers.find((c: any) => c.id === testCustomer.id);
  assert.ok(customerStillExists, 'Customer must NOT be deleted when only products are updated');

  const productExists = updated.products.find((p: any) => p.id === testProduct.id);
  assert.ok(productExists, 'Product must be saved');

  // Clean up test records using explicit deletedIds
  await saveData({
    deletedIds: [testCustomer.id, testProduct.id],
    products: updated.products.filter((p: any) => p.id !== testProduct.id),
    customers: updated.customers.filter((c: any) => c.id !== testCustomer.id),
  });

  const finalData = await getData();
  assert.strictEqual(
    finalData.customers.some((c: any) => c.id === testCustomer.id),
    false,
    'Explicit deletion should remove record'
  );
});
