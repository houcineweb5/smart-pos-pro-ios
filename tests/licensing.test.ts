import { test } from 'node:test';
import assert from 'node:assert';
import { 
  getMachineId, 
  generateActivationKey, 
  verifyActivationKey, 
  TRIAL_DAYS_LIMIT, 
  TRIAL_INVOICES_LIMIT 
} from '../server_src/license.js';

test('Licensing: Machine ID generation is stable and non-empty', () => {
  const m1 = getMachineId();
  const m2 = getMachineId();
  assert.ok(m1.startsWith('SPOS-'));
  assert.strictEqual(m1, m2);
});

test('Licensing: Activation key validation correctly accepts valid key and rejects invalid', () => {
  const machineId = getMachineId();
  const validKey = generateActivationKey(machineId);

  assert.ok(validKey.startsWith('ACTV-'));
  assert.strictEqual(verifyActivationKey(machineId, validKey), true);
  assert.strictEqual(verifyActivationKey(machineId, validKey.toLowerCase()), true);
  assert.strictEqual(verifyActivationKey(machineId, 'ACTV-0000-0000-0000'), false);
  assert.strictEqual(verifyActivationKey('SPOS-FAKE-MACH-INE1', validKey), false);
});
