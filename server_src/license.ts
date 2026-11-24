/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import crypto from 'crypto';
import os from 'os';

const LICENSE_SALT = process.env.LICENSE_SALT || 'SMARTPOS_PRO_ENTERPRISE_SECRET_SALT_2026#98765';
export const TRIAL_DAYS_LIMIT = 15;
export const TRIAL_INVOICES_LIMIT = 50;

/**
 * Returns a stable, unique Machine ID for the running hardware
 */
export function getMachineId(): string {
  try {
    const interfaces = os.networkInterfaces();
    let macAddress = '';
    const sortedNames = Object.keys(interfaces).sort();
    for (const name of sortedNames) {
      for (const net of interfaces[name] || []) {
        if (!net.internal && net.mac && net.mac !== '00:00:00:00:00:00') {
          macAddress = net.mac;
          break;
        }
      }
      if (macAddress) break;
    }

    const cpuModel = os.cpus()?.[0]?.model || 'GenericCPU';
    const rawFingerprint = `${os.hostname()}_${os.platform()}_${os.arch()}_${cpuModel}_${macAddress}`;
    const hash = crypto.createHash('sha256').update(rawFingerprint).digest('hex').toUpperCase();

    // Format: SPOS-XXXX-XXXX-XXXX
    return `SPOS-${hash.substring(0, 4)}-${hash.substring(4, 8)}-${hash.substring(8, 12)}`;
  } catch {
    return 'SPOS-COMM-2026-UNQ1';
  }
}

/**
 * Generates an activation key from a Machine ID
 */
export function generateActivationKey(machineId: string, customSalt?: string): string {
  const cleanMachineId = machineId.trim().toUpperCase();
  const salt = customSalt || LICENSE_SALT;
  const hmac = crypto.createHmac('sha256', salt).update(cleanMachineId).digest('hex').toUpperCase();

  // Format: ACTV-XXXX-XXXX-XXXX
  return `ACTV-${hmac.substring(0, 4)}-${hmac.substring(4, 8)}-${hmac.substring(8, 12)}`;
}

/**
 * Validates whether an activation key matches the Machine ID
 */
export function verifyActivationKey(machineId: string, inputKey: string): boolean {
  if (!machineId || !inputKey) return false;
  const expectedKey = generateActivationKey(machineId);
  const normalizedInput = inputKey.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
  return expectedKey === normalizedInput;
}

export interface LicenseRecord {
  isActivated: boolean;
  activationKey?: string;
  activatedAt?: string;
  machineId: string;
  firstLaunchDate: string;
  customerName?: string;
}

export interface LicenseStatus {
  isActivated: boolean;
  machineId: string;
  firstLaunchDate: string;
  daysRemaining: number;
  isTrialExpired: boolean;
  invoiceCount: number;
  maxTrialInvoices: number;
  invoicesRemaining: number;
  customerName?: string;
  activatedAt?: string;
}
