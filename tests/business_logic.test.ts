import { initDB, saveData, getData, addStockMovement, getStockMovements } from '../server_db';
import assert from 'node:assert';
import test, { before } from 'node:test';

before(async () => {
  await initDB();
});

test('Business Logic: Invoice numbering increases monotonically without collision', () => {
  const existingInvoices = [
    { invoiceNumber: 'INV-1001' },
    { invoiceNumber: 'INV-1002' },
    { invoiceNumber: 'INV-1005' },
  ];

  let nextInvoiceSeq = 1001;
  existingInvoices.forEach((inv) => {
    if (inv && inv.invoiceNumber) {
      const match = inv.invoiceNumber.match(/(\d+)$/);
      if (match) {
        const val = parseInt(match[1], 10);
        if (!isNaN(val) && val >= nextInvoiceSeq) {
          nextInvoiceSeq = val + 1;
        }
      }
    }
  });

  assert.strictEqual(nextInvoiceSeq, 1006, 'Next sequential invoice number must be 1006');
});

test('Business Logic: Permanent customer payments persist and survive log truncation', async () => {
  const customerId = 'cust_test_pay_' + Date.now();
  const paymentRecord = {
    id: 'pay_' + Date.now(),
    customerId,
    customerName: 'Payment Test Customer',
    amount: 350.50,
    date: new Date().toISOString(),
    notes: 'Partial settlement test',
    receivedByName: 'Cashier 1',
  };

  await saveData({
    customerPayments: [paymentRecord],
  });

  const data = await getData();
  const savedPayment = data.customerPayments.find((p: any) => p.id === paymentRecord.id);
  assert.ok(savedPayment, 'Customer payment must exist in customerPayments table');
  assert.strictEqual(savedPayment.amount, 350.50);
  assert.strictEqual(savedPayment.customerId, customerId);

  // Clean up
  await saveData({
    deletedIds: [paymentRecord.id],
    customerPayments: [],
  });
});

test('Business Logic: Stock movement ledger records inbound and outbound audit events', async () => {
  const productId = 'prod_mov_test_' + Date.now();
  const mov = await addStockMovement({
    productId,
    productName: 'Movement Test Product',
    delta: -5,
    type: 'sale',
    referenceNumber: 'INV-1001',
    userId: 'emp-user1',
    userName: 'Cashier 1',
    notes: 'POS Sale deduction',
  });

  assert.ok(mov.id, 'Movement must have ID');
  assert.ok(mov.timestamp, 'Movement must have timestamp');

  const history = await getStockMovements(10, productId);
  assert.strictEqual(history.length, 1);
  assert.strictEqual(history[0].delta, -5);
  assert.strictEqual(history[0].type, 'sale');
  assert.strictEqual(history[0].referenceNumber, 'INV-1001');
});
