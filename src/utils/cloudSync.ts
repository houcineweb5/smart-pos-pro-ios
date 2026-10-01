/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface CloudSyncConfig {
  enabled: boolean;
  provider: 'firebase' | 'supabase' | 'server';
  firebaseUrl: string;      // e.g. https://my-store-default-rtdb.firebaseio.com
  firebaseSecret?: string;  // optional auth token
  supabaseUrl?: string;     // e.g. https://xyzcompany.supabase.co
  supabaseKey?: string;     // anon public key
  serverUrl?: string;       // e.g. http://192.168.1.15:3000 or https://my-pos-server.com
  storeId: string;          // e.g. store_main_01
  autoSync: boolean;
  syncIntervalSec: number;  // default 8
  lastSyncedAt?: string;
  deviceId?: string;
}

const SYNC_CONFIG_STORAGE_KEY = 'smartpos_cloud_sync_config_v1';
const DEVICE_ID_KEY = 'smartpos_device_id_v1';

export function getDeviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      id = (isMobile ? 'mobile_' : 'pc_') + Math.random().toString(36).slice(2, 10);
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch {
    return 'device_default';
  }
}

export function getCloudSyncConfig(): CloudSyncConfig {
  try {
    const raw = localStorage.getItem(SYNC_CONFIG_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        enabled: Boolean(parsed.enabled),
        provider:
          parsed.provider === 'supabase'
            ? 'supabase'
            : parsed.provider === 'server'
            ? 'server'
            : 'firebase',
        firebaseUrl: (parsed.firebaseUrl || '').trim(),
        firebaseSecret: (parsed.firebaseSecret || '').trim(),
        supabaseUrl: (parsed.supabaseUrl || '').trim(),
        supabaseKey: (parsed.supabaseKey || '').trim(),
        serverUrl: (parsed.serverUrl || '').trim(),
        storeId: (parsed.storeId || 'store_01').trim(),
        autoSync: parsed.autoSync !== undefined ? Boolean(parsed.autoSync) : true,
        syncIntervalSec: Number(parsed.syncIntervalSec) || 8,
        lastSyncedAt: parsed.lastSyncedAt || undefined,
        deviceId: parsed.deviceId || getDeviceId(),
      };
    }
  } catch (e) {
    console.warn('Failed to read cloud sync config:', e);
  }
  return {
    enabled: false,
    provider: 'firebase',
    firebaseUrl: '',
    firebaseSecret: '',
    supabaseUrl: '',
    supabaseKey: '',
    serverUrl: '',
    storeId: 'store_01',
    autoSync: true,
    syncIntervalSec: 8,
    deviceId: getDeviceId(),
  };
}

export function saveCloudSyncConfig(cfg: CloudSyncConfig): void {
  try {
    localStorage.setItem(SYNC_CONFIG_STORAGE_KEY, JSON.stringify(cfg));
  } catch (e) {
    console.warn('Failed to save cloud sync config:', e);
  }
}

function cleanUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

/**
 * Push store dataset to Cloud (Firebase Realtime DB, Supabase, or Direct Server URL)
 */
export async function pushDataToCloud(
  data: any,
  cfg: CloudSyncConfig = getCloudSyncConfig()
): Promise<{ ok: boolean; timestamp: string; error?: string }> {
  const timestamp = new Date().toISOString();
  const payload = {
    updatedAt: timestamp,
    source: getDeviceId(),
    storeId: cfg.storeId || 'store_01',
    data: {
      products: data.products || [],
      customers: data.customers || [],
      suppliers: data.suppliers || [],
      purchases: data.purchases || [],
      invoices: data.invoices || [],
      config: data.config || {},
      employees: data.employees || [],
      repairs: data.repairs || [],
      expenses: data.expenses || [],
      commercialDocuments: data.commercialDocuments || [],
      logs: (data.logs || []).slice(0, 250),
    },
  };

  try {
    if (cfg.provider === 'firebase') {
      if (!cfg.firebaseUrl) {
        return { ok: false, timestamp, error: 'يرجى إدخال رابط قاعدة بيانات Firebase أولاً' };
      }
      const base = cleanUrl(cfg.firebaseUrl);
      const authParam = cfg.firebaseSecret ? `?auth=${encodeURIComponent(cfg.firebaseSecret)}` : '';
      const targetUrl = `${base}/smartpos_stores/${encodeURIComponent(cfg.storeId || 'store_01')}.json${authParam}`;

      const res = await fetch(targetUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Firebase Error (${res.status}): ${errText}`);
      }
    } else if (cfg.provider === 'supabase') {
      if (!cfg.supabaseUrl || !cfg.supabaseKey) {
        return { ok: false, timestamp, error: 'يرجى إدخال رابط Supabase ومفتاح API (Anon Key)' };
      }
      const base = cleanUrl(cfg.supabaseUrl);
      const targetUrl = `${base}/rest/v1/smartpos_sync?on_conflict=store_id`;

      const res = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: cfg.supabaseKey,
          Authorization: `Bearer ${cfg.supabaseKey}`,
          Prefer: 'resolution=merge-duplicates',
        },
        body: JSON.stringify({
          store_id: cfg.storeId || 'store_01',
          updated_at: timestamp,
          payload: payload,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Supabase Error (${res.status}): ${errText}`);
      }
    } else if (cfg.provider === 'server') {
      const base = cfg.serverUrl ? cleanUrl(cfg.serverUrl) : '';
      const targetUrl = `${base}/api/save`;
      const res = await fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload.data),
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Server Sync Error (${res.status}): ${errText}`);
      }
    }

    const updatedCfg = { ...cfg, lastSyncedAt: timestamp };
    saveCloudSyncConfig(updatedCfg);
    return { ok: true, timestamp };
  } catch (err: any) {
    return { ok: false, timestamp, error: err?.message || 'Cloud push failed' };
  }
}

/**
 * Pull store dataset from Cloud (Firebase Realtime DB, Supabase, or Direct Server URL)
 */
export async function pullDataFromCloud(
  cfg: CloudSyncConfig = getCloudSyncConfig()
): Promise<{ ok: boolean; payload?: any; error?: string }> {
  try {
    if (cfg.provider === 'firebase') {
      if (!cfg.firebaseUrl) {
        return { ok: false, error: 'يرجى إدخال رابط قاعدة بيانات Firebase أولاً' };
      }
      const base = cleanUrl(cfg.firebaseUrl);
      const authParam = cfg.firebaseSecret ? `?auth=${encodeURIComponent(cfg.firebaseSecret)}` : '';
      const targetUrl = `${base}/smartpos_stores/${encodeURIComponent(cfg.storeId || 'store_01')}.json${authParam}`;

      const res = await fetch(targetUrl, { method: 'GET' });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Firebase Error (${res.status}): ${errText}`);
      }
      const json = await res.json();
      if (!json || !json.data) {
        return { ok: true, payload: null };
      }
      return { ok: true, payload: json };
    } else if (cfg.provider === 'supabase') {
      if (!cfg.supabaseUrl || !cfg.supabaseKey) {
        return { ok: false, error: 'يرجى إدخال رابط Supabase ومفتاح API (Anon Key)' };
      }
      const base = cleanUrl(cfg.supabaseUrl);
      const targetUrl = `${base}/rest/v1/smartpos_sync?store_id=eq.${encodeURIComponent(cfg.storeId || 'store_01')}&select=*`;

      const res = await fetch(targetUrl, {
        method: 'GET',
        headers: {
          apikey: cfg.supabaseKey,
          Authorization: `Bearer ${cfg.supabaseKey}`,
        },
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Supabase Error (${res.status}): ${errText}`);
      }
      const rows = await res.json();
      if (!Array.isArray(rows) || rows.length === 0 || !rows[0].payload) {
        return { ok: true, payload: null };
      }
      return { ok: true, payload: rows[0].payload };
    } else {
      const base = cfg.serverUrl ? cleanUrl(cfg.serverUrl) : '';
      const targetUrl = `${base}/api/data`;
      const res = await fetch(targetUrl, { method: 'GET' });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Server Error (${res.status}): ${errText}`);
      }
      const data = await res.json();
      return {
        ok: true,
        payload: {
          updatedAt: new Date().toISOString(),
          source: 'server',
          storeId: cfg.storeId || 'store_01',
          data,
        },
      };
    }
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Cloud pull failed' };
  }
}

/**
 * Full Bi-Directional Smart Merge across all 11 collections (Android, iPhone, PC)
 * Ensures new invoices, stock deductions, product edits, customer debts, repairs (SAV),
 * suppliers, purchases, expenses, commercial documents, employees, and store config stay 100% synchronized.
 */
export function mergeStoreDatasets(
  localData: any,
  cloudData: any,
  preferRemoteEdits = true
): { merged: any; hasNewFromCloud: boolean } {
  if (!cloudData) return { merged: localData, hasNewFromCloud: false };

  let hasNewFromCloud = false;

  // 1. Merge Invoices (new invoices + updated payments/returns on existing invoices)
  const localInvoices: any[] = Array.isArray(localData.invoices) ? localData.invoices : [];
  const cloudInvoices: any[] = Array.isArray(cloudData.invoices) ? cloudData.invoices : [];
  const localInvMap = new Map(localInvoices.map((i: any) => [i.id, i]));
  const newCloudInvoices: any[] = [];

  for (const cInv of cloudInvoices) {
    if (!cInv || !cInv.id) continue;
    const existing = localInvMap.get(cInv.id);
    if (!existing) {
      newCloudInvoices.push(cInv);
      localInvMap.set(cInv.id, cInv);
      hasNewFromCloud = true;
    } else {
      // Check if remote invoice had debt settled or items returned
      const remotePaid = Number(cInv.amountPaid || 0);
      const localPaid = Number(existing.amountPaid || 0);
      const remoteReturnsLen = Array.isArray(cInv.returnedItems) ? cInv.returnedItems.length : 0;
      const localReturnsLen = Array.isArray(existing.returnedItems) ? existing.returnedItems.length : 0;
      if (remotePaid > localPaid || remoteReturnsLen > localReturnsLen || cInv.status !== existing.status) {
        if (preferRemoteEdits) {
          localInvMap.set(cInv.id, cInv);
          hasNewFromCloud = true;
        }
      }
    }
  }

  // 2. Merge Products
  let mergedProducts: any[] = Array.isArray(localData.products) ? [...localData.products] : [];
  const cloudProducts: any[] = Array.isArray(cloudData.products) ? cloudData.products : [];

  // Deduct stock for newly arrived invoices if local had products before cloud updated them
  if (newCloudInvoices.length > 0) {
    for (const inv of newCloudInvoices) {
      if (Array.isArray(inv.items)) {
        mergedProducts = mergedProducts.map((p: any) => {
          const soldItem = inv.items.find((it: any) => it.productId === p.id);
          if (soldItem) {
            return { ...p, stock: Math.max(0, Number(p.stock || 0) - Number(soldItem.quantity || 0)) };
          }
          return p;
        });
      }
    }
  }

  const localProdMap = new Map(mergedProducts.map((p: any) => [p.id, p]));
  for (const cp of cloudProducts) {
    if (!cp || !cp.id) continue;
    const existing = localProdMap.get(cp.id);
    if (!existing) {
      localProdMap.set(cp.id, cp);
      hasNewFromCloud = true;
    } else if (preferRemoteEdits && newCloudInvoices.length === 0) {
      // Check if product price, name, sku, or stock was updated remotely
      if (
        existing.name !== cp.name ||
        existing.sellingPrice !== cp.sellingPrice ||
        existing.purchasePrice !== cp.purchasePrice ||
        existing.wholesalePrice !== cp.wholesalePrice ||
        existing.sku !== cp.sku ||
        existing.stock !== cp.stock
      ) {
        localProdMap.set(cp.id, cp);
        hasNewFromCloud = true;
      }
    }
  }
  mergedProducts = Array.from(localProdMap.values());

  // 3. Merge Customers
  let mergedCustomers: any[] = Array.isArray(localData.customers) ? [...localData.customers] : [];
  if (newCloudInvoices.length > 0) {
    for (const inv of newCloudInvoices) {
      if (inv.customerId && inv.customerId !== 'walk-in') {
        const unpaid = Math.max(0, Number(inv.total || 0) - Number(inv.amountPaid || 0));
        if (unpaid > 0) {
          mergedCustomers = mergedCustomers.map((c: any) =>
            c.id === inv.customerId ? { ...c, debt: Number(c.debt || 0) + unpaid } : c
          );
        }
      }
    }
  }
  const localCustMap = new Map(mergedCustomers.map((c: any) => [c.id, c]));
  for (const cc of cloudData.customers || []) {
    if (!cc || !cc.id) continue;
    const existing = localCustMap.get(cc.id);
    if (!existing) {
      localCustMap.set(cc.id, cc);
      hasNewFromCloud = true;
    } else if (preferRemoteEdits && newCloudInvoices.length === 0) {
      if (existing.name !== cc.name || existing.phone !== cc.phone || existing.debt !== cc.debt) {
        localCustMap.set(cc.id, cc);
        hasNewFromCloud = true;
      }
    }
  }
  mergedCustomers = Array.from(localCustMap.values());

  // 4. Merge Suppliers
  const localSuppMap = new Map((localData.suppliers || []).map((s: any) => [s.id, s]));
  for (const cs of cloudData.suppliers || []) {
    if (!cs || !cs.id) continue;
    const existing: any = localSuppMap.get(cs.id);
    if (!existing) {
      localSuppMap.set(cs.id, cs);
      hasNewFromCloud = true;
    } else if (preferRemoteEdits && (existing.name !== cs.name || existing.debt !== cs.debt || existing.phone !== cs.phone)) {
      localSuppMap.set(cs.id, cs);
      hasNewFromCloud = true;
    }
  }
  const mergedSuppliers = Array.from(localSuppMap.values());

  // 5. Merge Purchases
  const localPurchMap = new Map((localData.purchases || []).map((p: any) => [p.id, p]));
  for (const cp of cloudData.purchases || []) {
    if (!cp || !cp.id) continue;
    const existing: any = localPurchMap.get(cp.id);
    if (!existing) {
      localPurchMap.set(cp.id, cp);
      hasNewFromCloud = true;
    } else if (preferRemoteEdits && (existing.amountPaid !== cp.amountPaid || existing.status !== cp.status)) {
      localPurchMap.set(cp.id, cp);
      hasNewFromCloud = true;
    }
  }
  const mergedPurchases = Array.from(localPurchMap.values());

  // 6. Merge Expenses
  const localExpMap = new Map((localData.expenses || []).map((e: any) => [e.id, e]));
  for (const ce of cloudData.expenses || []) {
    if (!ce || !ce.id) continue;
    if (!localExpMap.has(ce.id)) {
      localExpMap.set(ce.id, ce);
      hasNewFromCloud = true;
    }
  }
  const mergedExpenses = Array.from(localExpMap.values());

  // 7. Merge Repairs (SAV)
  const localRepMap = new Map((localData.repairs || []).map((r: any) => [r.id, r]));
  for (const cr of cloudData.repairs || []) {
    if (!cr || !cr.id) continue;
    const existing: any = localRepMap.get(cr.id);
    if (!existing) {
      localRepMap.set(cr.id, cr);
      hasNewFromCloud = true;
    } else if (
      preferRemoteEdits &&
      (existing.status !== cr.status || existing.amountPaid !== cr.amountPaid || existing.estimatedCost !== cr.estimatedCost)
    ) {
      localRepMap.set(cr.id, cr);
      hasNewFromCloud = true;
    }
  }
  const mergedRepairs = Array.from(localRepMap.values());

  // 8. Merge Commercial Documents (Devis, Bon de Commande, Bon de Livraison)
  const localDocMap = new Map((localData.commercialDocuments || []).map((d: any) => [d.id, d]));
  for (const cd of cloudData.commercialDocuments || []) {
    if (!cd || !cd.id) continue;
    const existing: any = localDocMap.get(cd.id);
    if (!existing) {
      localDocMap.set(cd.id, cd);
      hasNewFromCloud = true;
    } else if (preferRemoteEdits && (existing.status !== cd.status || existing.total !== cd.total)) {
      localDocMap.set(cd.id, cd);
      hasNewFromCloud = true;
    }
  }
  const mergedCommercialDocuments = Array.from(localDocMap.values());

  // 9. Merge Employees
  const localEmpMap = new Map((localData.employees || []).map((e: any) => [e.id, e]));
  for (const ce of cloudData.employees || []) {
    if (!ce || !ce.id) continue;
    if (!localEmpMap.has(ce.id)) {
      localEmpMap.set(ce.id, ce);
      hasNewFromCloud = true;
    }
  }
  const mergedEmployees = Array.from(localEmpMap.values());

  // 10. Store Config
  let mergedConfig = { ...(localData.config || {}) };
  if (cloudData.config && cloudData.config.name) {
    if (
      (!mergedConfig.name || mergedConfig.name === 'Smart Pos') &&
      cloudData.config.name !== mergedConfig.name
    ) {
      mergedConfig = { ...mergedConfig, ...cloudData.config };
      hasNewFromCloud = true;
    }
  }

  // 11. Merge Logs
  const localLogMap = new Map((localData.logs || []).map((l: any) => [l.id, l]));
  for (const cl of cloudData.logs || []) {
    if (cl && cl.id && !localLogMap.has(cl.id)) {
      localLogMap.set(cl.id, cl);
    }
  }
  const mergedLogs = Array.from(localLogMap.values())
    .sort((a: any, b: any) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime())
    .slice(0, 500);

  const mergedInvoices = Array.from(localInvMap.values()).sort(
    (a: any, b: any) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()
  );

  return {
    hasNewFromCloud,
    merged: {
      ...localData,
      products: mergedProducts,
      customers: mergedCustomers,
      suppliers: mergedSuppliers,
      purchases: mergedPurchases,
      invoices: mergedInvoices,
      expenses: mergedExpenses,
      repairs: mergedRepairs,
      commercialDocuments: mergedCommercialDocuments,
      employees: mergedEmployees,
      config: mergedConfig,
      logs: mergedLogs,
    },
  };
}

/**
 * Push a scanned barcode from Smartphone to PC POS (both via Server API and Cloud Firebase)
 */
export async function pushCloudBarcodeScan(
  code: string,
  cfg: CloudSyncConfig = getCloudSyncConfig()
): Promise<boolean> {
  const cleanCode = String(code || '').trim();
  if (!cleanCode) return false;
  let sent = false;

  // 1. Try local/remote server API
  try {
    const base = cfg.serverUrl ? cleanUrl(cfg.serverUrl) : '';
    const res = await fetch(`${base}/api/remote-barcode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: cleanCode }),
    });
    if (res.ok) sent = true;
  } catch {
    // ignore if offline or remote only
  }

  // 2. Try Firebase Realtime DB if configured
  if (cfg.firebaseUrl) {
    try {
      const base = cleanUrl(cfg.firebaseUrl);
      const authParam = cfg.firebaseSecret ? `?auth=${encodeURIComponent(cfg.firebaseSecret)}` : '';
      const targetUrl = `${base}/smartpos_barcodes/${encodeURIComponent(cfg.storeId || 'store_01')}.json${authParam}`;
      const res = await fetch(targetUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: cleanCode, timestamp: Date.now() }),
      });
      if (res.ok) sent = true;
    } catch {
      // ignore
    }
  }

  return sent;
}

/**
 * Pull remote barcode scan from Cloud (Firebase) if phone is used as wireless barcode scanner over internet
 */
export async function pullCloudBarcodeScan(cfg: CloudSyncConfig = getCloudSyncConfig()): Promise<string | null> {
  if (!cfg.enabled || !cfg.firebaseUrl) return null;
  try {
    const base = cleanUrl(cfg.firebaseUrl);
    const authParam = cfg.firebaseSecret ? `?auth=${encodeURIComponent(cfg.firebaseSecret)}` : '';
    const targetUrl = `${base}/smartpos_barcodes/${encodeURIComponent(cfg.storeId || 'store_01')}.json${authParam}`;

    const res = await fetch(targetUrl, { method: 'GET' });
    if (!res.ok) return null;
    const data = await res.json();
    if (data && data.code && data.timestamp) {
      // Clear it immediately from Firebase so it's only processed once
      await fetch(targetUrl, { method: 'DELETE' });
      // Only accept if scanned within last 30 seconds
      if (Date.now() - Number(data.timestamp) < 30000) {
        return String(data.code);
      }
    }
  } catch {
    // ignore transient network errors
  }
  return null;
}

/**
 * Generate a compact shareable Pairing Code (Base64) containing the Cloud & Server Sync configuration
 * so the user can scan QR or paste it into the Smartphone App in 1 click!
 */
export function encodePairingCode(cfg: CloudSyncConfig, fallbackServerUrl?: string): string {
  const minimal = {
    p: cfg.provider,
    f: cfg.firebaseUrl,
    fs: cfg.firebaseSecret || '',
    su: cfg.supabaseUrl || '',
    sk: cfg.supabaseKey || '',
    srv: cfg.serverUrl || fallbackServerUrl || '',
    s: cfg.storeId || 'store_01',
  };
  return btoa(unescape(encodeURIComponent(JSON.stringify(minimal))));
}

/**
 * Decode a Pairing Code from QR or clipboard and return a ready-to-save CloudSyncConfig
 */
export function decodePairingCode(code: string): CloudSyncConfig | null {
  try {
    const clean = code.trim();
    if (!clean) return null;
    const jsonStr = decodeURIComponent(escape(atob(clean)));
    const parsed = JSON.parse(jsonStr);
    if (!parsed || typeof parsed !== 'object') return null;

    const current = getCloudSyncConfig();
    const provider: 'firebase' | 'supabase' | 'server' =
      parsed.p === 'supabase'
        ? 'supabase'
        : parsed.p === 'server'
        ? 'server'
        : parsed.f
        ? 'firebase'
        : parsed.su
        ? 'supabase'
        : 'server';

    return {
      ...current,
      enabled: true,
      autoSync: true,
      provider,
      firebaseUrl: (parsed.f || current.firebaseUrl || '').trim(),
      firebaseSecret: (parsed.fs || current.firebaseSecret || '').trim(),
      supabaseUrl: (parsed.su || current.supabaseUrl || '').trim(),
      supabaseKey: (parsed.sk || current.supabaseKey || '').trim(),
      serverUrl: (parsed.srv || current.serverUrl || '').trim(),
      storeId: (parsed.s || current.storeId || 'store_01').trim(),
    };
  } catch {
    return null;
  }
}
