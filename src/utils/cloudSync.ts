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
const DELETED_IDS_STORAGE_KEY = 'smartpos_deleted_ids_v1';

export function getDeletedIds(): string[] {
  try {
    const raw = localStorage.getItem(DELETED_IDS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.filter(Boolean);
    }
  } catch {}
  return [];
}

export function addDeletedIds(ids: (string | undefined | null)[]): string[] {
  const valid = ids.filter((x): x is string => Boolean(x && String(x).trim()));
  if (valid.length === 0) return getDeletedIds();
  try {
    const current = new Set(getDeletedIds());
    for (const id of valid) current.add(id);
    const next = Array.from(current).slice(-1000);
    localStorage.setItem(DELETED_IDS_STORAGE_KEY, JSON.stringify(next));
    return next;
  } catch {
    return valid;
  }
}

export function clearDeletedIds(): void {
  try {
    localStorage.removeItem(DELETED_IDS_STORAGE_KEY);
  } catch {}
}

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

/**
 * Normalize and validate Firebase Realtime Database URL
 * Handles missing https://, trailing paths (/smartpos_stores/..., .json), and console.firebase.google.com links.
 */
export function normalizeFirebaseUrl(rawUrl: string): { url: string; error?: string } {
  let u = String(rawUrl || '')
    .trim()
    .replace(/^['"]+|['"]+$/g, '');

  if (!u) {
    return { url: '', error: 'يرجى إدخال رابط قاعدة بيانات Firebase Realtime Database أولاً' };
  }

  // If user pasted the Firebase Console link:
  // e.g. https://console.firebase.google.com/u/0/project/my-proj/database/my-proj-default-rtdb/data/~2F
  if (u.includes('console.firebase.google.com')) {
    const dbMatch = u.match(/\/database\/([^/?#]+)/i);
    if (dbMatch && dbMatch[1]) {
      u = `https://${dbMatch[1]}.firebaseio.com`;
    } else {
      return {
        url: u,
        error:
          '⚠️ هذا رابط لوحة تحكم Firebase Console وليس رابط قاعدة البيانات! افتح قسم Realtime Database وانسخ الرابط الذي ينتهي بـ firebaseio.com أو firebasedatabase.app',
      };
    }
  }

  if (!/^https?:\/\//i.test(u)) {
    u = 'https://' + u;
  }

  try {
    const parsed = new URL(u);
    return { url: `${parsed.protocol}//${parsed.host}` };
  } catch {
    // Fallback cleanup
    u = u
      .replace(/\/smartpos_stores.*$/i, '')
      .replace(/\/smartpos_barcodes.*$/i, '')
      .replace(/\.json.*$/i, '')
      .replace(/\/+$/, '');
    return { url: u };
  }
}

function cleanUrl(url: string): string {
  let u = String(url || '').trim().replace(/^['"]+|['"]+$/g, '');
  if (u && !/^https?:\/\//i.test(u)) {
    u = 'https://' + u;
  }
  return u.replace(/\/+$/, '');
}

function formatFirebaseHttpError(status: number, errText: string): string {
  const lower = (errText || '').toLowerCase();
  if (status === 401 || status === 403 || lower.includes('permission denied')) {
    return '⛔ رفض الوصول (Permission Denied): افتح Firebase Console ← Realtime Database ← تبويب Rules واجعل القواعد {"rules": {".read": true, ".write": true}} ثم اضغط Publish.';
  }
  if (status === 404 || lower.includes('not found')) {
    return '❌ لم يتم العثور على قاعدة البيانات (404): تأكد من نسخ رابط Realtime Database الصحيح الذي ينتهي بـ firebaseio.com أو firebasedatabase.app';
  }
  return `خطأ من Firebase (${status}): ${errText}`;
}

export function getCloudSyncConfig(): CloudSyncConfig {
  try {
    const raw = localStorage.getItem(SYNC_CONFIG_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const rawFb = (parsed.firebaseUrl || '').trim();
      const normFb = rawFb ? normalizeFirebaseUrl(rawFb).url : '';
      return {
        enabled: Boolean(parsed.enabled),
        provider:
          parsed.provider === 'supabase'
            ? 'supabase'
            : parsed.provider === 'server'
            ? 'server'
            : 'firebase',
        firebaseUrl: normFb,
        firebaseSecret: (parsed.firebaseSecret || '').trim(),
        supabaseUrl: (parsed.supabaseUrl || '').trim(),
        supabaseKey: (parsed.supabaseKey || '').trim(),
        serverUrl: (parsed.serverUrl || '').trim(),
        storeId: (parsed.storeId || 'store_01').trim(),
        autoSync: parsed.autoSync !== undefined ? Boolean(parsed.autoSync) : true,
        syncIntervalSec: Math.max(15, Number(parsed.syncIntervalSec) || 20),
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
    syncIntervalSec: 20,
    deviceId: getDeviceId(),
  };
}

const LAST_CLOUD_UPDATED_AT_KEY = 'smartpos_last_cloud_updated_at_v1';
let memoryLastCloudUpdatedAt: string | null = null;

export function getLastKnownCloudUpdatedAt(storeId = 'store_01'): string | null {
  if (memoryLastCloudUpdatedAt) return memoryLastCloudUpdatedAt;
  try {
    return localStorage.getItem(`${LAST_CLOUD_UPDATED_AT_KEY}_${storeId}`);
  } catch {
    return null;
  }
}

export function setLastKnownCloudUpdatedAt(timestamp: string | undefined | null, storeId = 'store_01'): void {
  if (!timestamp) return;
  memoryLastCloudUpdatedAt = timestamp;
  try {
    localStorage.setItem(`${LAST_CLOUD_UPDATED_AT_KEY}_${storeId}`, timestamp);
  } catch {}
}

/**
 * Lightweight (~28 bytes) check against Firebase /smartpos_stores/{storeId}/updatedAt.json
 * Prevents downloading the entire store tree when nothing has changed in the cloud.
 */
export async function fetchFirebaseRemoteUpdatedAt(cfg: CloudSyncConfig = getCloudSyncConfig()): Promise<string | null> {
  if (cfg.provider !== 'firebase' || !cfg.firebaseUrl) return null;
  try {
    const norm = normalizeFirebaseUrl(cfg.firebaseUrl);
    if (!norm.url || norm.error) return null;
    const storeKey = encodeURIComponent((cfg.storeId || 'store_01').trim());
    const queryParts: string[] = [];
    if (cfg.firebaseSecret) {
      queryParts.push(`auth=${encodeURIComponent(cfg.firebaseSecret)}`);
    }
    const qs = queryParts.length > 0 ? `?${queryParts.join('&')}` : '';
    const res = await fetch(`${norm.url}/smartpos_stores/${storeKey}/updatedAt.json${qs}`, {
      method: 'GET',
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const val = await res.json();
    return typeof val === 'string' && val ? val : null;
  } catch {
    return null;
  }
}

export function saveCloudSyncConfig(cfg: CloudSyncConfig, syncToServerDb = true): void {
  try {
    const cleanCfg: CloudSyncConfig = {
      ...cfg,
      firebaseUrl: cfg.firebaseUrl ? normalizeFirebaseUrl(cfg.firebaseUrl).url : '',
      storeId: (cfg.storeId || 'store_01').trim(),
    };
    localStorage.setItem(SYNC_CONFIG_STORAGE_KEY, JSON.stringify(cleanCfg));
    if (syncToServerDb && typeof window !== 'undefined' && window.location.protocol.startsWith('http')) {
      fetch('/api/cloud-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cleanCfg),
      }).catch(() => {});
    }
  } catch (e) {
    console.warn('Failed to save cloud sync config:', e);
  }
}

/**
 * Load cloud sync config from the PC SQLite server if localStorage has not been configured yet
 */
export async function loadCloudSyncConfigFromServer(): Promise<CloudSyncConfig | null> {
  try {
    const res = await fetch('/api/cloud-config', { cache: 'no-store' });
    if (!res.ok) return null;
    const json = await res.json();
    if (json && json.ok && json.config && (json.config.firebaseUrl || json.config.supabaseUrl || json.config.serverUrl)) {
      const serverCfg: CloudSyncConfig = {
        ...getCloudSyncConfig(),
        ...json.config,
        firebaseUrl: json.config.firebaseUrl ? normalizeFirebaseUrl(json.config.firebaseUrl).url : '',
      };
      const localCfg = getCloudSyncConfig();
      if (!localCfg.firebaseUrl && !localCfg.supabaseUrl) {
        saveCloudSyncConfig(serverCfg, false);
      }
      return serverCfg;
    }
  } catch {
    // ignore when offline or on standalone mobile
  }
  return null;
}

/**
 * Push store dataset to Cloud (Firebase Realtime DB, Supabase, or Direct Server URL)
 * Uses a lightweight 28-byte updatedAt check first so it only pulls & merges existing remote records
 * when another device has actually pushed changes since our last sync!
 */
export async function pushDataToCloud(
  data: any,
  cfg: CloudSyncConfig = getCloudSyncConfig(),
  options: { skipPreMerge?: boolean } = {}
): Promise<{ ok: boolean; timestamp: string; mergedData?: any; error?: string }> {
  const timestamp = new Date().toISOString();
  const storeId = (cfg.storeId || 'store_01').trim();
  let finalData = data;

  try {
    // Pull & merge existing remote records before PUT only if remote updatedAt changed
    if (!options.skipPreMerge) {
      let shouldPullBeforePush = true;
      if (cfg.provider === 'firebase') {
        const remoteUpdatedAt = await fetchFirebaseRemoteUpdatedAt(cfg);
        const lastKnown = getLastKnownCloudUpdatedAt(storeId);
        if (!remoteUpdatedAt || (lastKnown && remoteUpdatedAt === lastKnown)) {
          shouldPullBeforePush = false;
        }
      }

      if (shouldPullBeforePush) {
        const existingCloud = await pullDataFromCloud(cfg).catch(() => null);
        if (existingCloud && existingCloud.ok && existingCloud.payload && existingCloud.payload.data) {
          // preferRemoteEdits = false means local edits win on modified items while any new invoices/items from the other device are kept!
          const { merged } = mergeStoreDatasets(data, existingCloud.payload.data, false);
          finalData = merged;
        }
      }
    }

    const combinedDeletedIds = addDeletedIds([
      ...(Array.isArray(finalData.deletedIds) ? finalData.deletedIds : []),
      ...getDeletedIds(),
    ]);
    finalData = { ...finalData, deletedIds: combinedDeletedIds };

    const payload = {
      updatedAt: timestamp,
      source: getDeviceId(),
      storeId,
      data: {
        products: finalData.products || [],
        customers: finalData.customers || [],
        suppliers: finalData.suppliers || [],
        purchases: finalData.purchases || [],
        invoices: finalData.invoices || [],
        config: finalData.config || {},
        employees: finalData.employees || [],
        repairs: finalData.repairs || [],
        expenses: finalData.expenses || [],
        commercialDocuments: finalData.commercialDocuments || [],
        warehouses: finalData.warehouses || [],
        deletedIds: combinedDeletedIds,
        logs: (finalData.logs || []).slice(0, 120),
      },
    };

    if (cfg.provider === 'firebase') {
      const norm = normalizeFirebaseUrl(cfg.firebaseUrl);
      if (!norm.url || norm.error) {
        return { ok: false, timestamp, error: norm.error || 'يرجى إدخال رابط قاعدة بيانات Firebase أولاً' };
      }
      const base = norm.url;
      const authParam = cfg.firebaseSecret ? `?auth=${encodeURIComponent(cfg.firebaseSecret)}` : '';
      const targetUrl = `${base}/smartpos_stores/${encodeURIComponent(storeId)}.json${authParam}`;

      const res = await fetch(targetUrl, {
        method: 'PUT',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(formatFirebaseHttpError(res.status, errText));
      }
      setLastKnownCloudUpdatedAt(timestamp, storeId);
    } else if (cfg.provider === 'supabase') {
      if (!cfg.supabaseUrl || !cfg.supabaseKey) {
        return { ok: false, timestamp, error: 'يرجى إدخال رابط Supabase ومفتاح API (Anon Key)' };
      }
      const base = cleanUrl(cfg.supabaseUrl);
      const targetUrl = `${base}/rest/v1/smartpos_sync?on_conflict=store_id`;

      const res = await fetch(targetUrl, {
        method: 'POST',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          apikey: cfg.supabaseKey,
          Authorization: `Bearer ${cfg.supabaseKey}`,
          Prefer: 'resolution=merge-duplicates',
        },
        body: JSON.stringify({
          store_id: storeId,
          updated_at: timestamp,
          payload: payload,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Supabase Error (${res.status}): ${errText}`);
      }
      setLastKnownCloudUpdatedAt(timestamp, storeId);
    } else if (cfg.provider === 'server') {
      const base = cfg.serverUrl ? cleanUrl(cfg.serverUrl) : '';
      const targetUrl = `${base}/api/save`;
      const res = await fetch(targetUrl, {
        method: 'POST',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload.data),
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Server Sync Error (${res.status}): ${errText}`);
      }
    }

    const updatedCfg = { ...cfg, firebaseUrl: cfg.firebaseUrl ? normalizeFirebaseUrl(cfg.firebaseUrl).url : '', lastSyncedAt: timestamp };
    saveCloudSyncConfig(updatedCfg);
    return { ok: true, timestamp, mergedData: finalData };
  } catch (err: any) {
    const msg = err?.message || 'Cloud push failed';
    if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('Load failed')) {
      return {
        ok: false,
        timestamp,
        error: '🌐 تعذر الاتصال بقاعدة بيانات Firebase: تأكد من صحة الرابط ومن اتصالك بالإنترنت.',
      };
    }
    return { ok: false, timestamp, error: msg };
  }
}

/**
 * Pull store dataset from Cloud (Firebase Realtime DB, Supabase, or Direct Server URL)
 * When options.onlyIfChanged is true, checks the lightweight 28-byte updatedAt field first
 * so the full database is ONLY downloaded when another device actually pushed an update!
 */
export async function pullDataFromCloud(
  cfg: CloudSyncConfig = getCloudSyncConfig(),
  options: { onlyIfChanged?: boolean } = {}
): Promise<{ ok: boolean; payload?: any; unchanged?: boolean; error?: string }> {
  const storeId = (cfg.storeId || 'store_01').trim();
  try {
    if (cfg.provider === 'firebase') {
      const norm = normalizeFirebaseUrl(cfg.firebaseUrl);
      if (!norm.url || norm.error) {
        return { ok: false, error: norm.error || 'يرجى إدخال رابط قاعدة بيانات Firebase أولاً' };
      }

      if (options.onlyIfChanged) {
        const remoteUpdatedAt = await fetchFirebaseRemoteUpdatedAt(cfg);
        const lastKnown = getLastKnownCloudUpdatedAt(storeId);
        if (remoteUpdatedAt && lastKnown && remoteUpdatedAt === lastKnown) {
          return { ok: true, unchanged: true, payload: null };
        }
      }

      const base = norm.url;
      const storeKey = encodeURIComponent(storeId);
      const queryParts: string[] = [];
      if (cfg.firebaseSecret) {
        queryParts.push(`auth=${encodeURIComponent(cfg.firebaseSecret)}`);
      }
      const qs = queryParts.length > 0 ? `?${queryParts.join('&')}` : '';
      const targetUrl = `${base}/smartpos_stores/${storeKey}.json${qs}`;

      const res = await fetch(targetUrl, {
        method: 'GET',
        cache: 'no-store',
        headers: {
          Accept: 'application/json',
        },
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(formatFirebaseHttpError(res.status, errText));
      }
      const json = await res.json();
      if (!json) {
        return { ok: true, payload: null };
      }
      // Support both wrapped { updatedAt, data: {...} } and direct dataset
      if (json.data && typeof json.data === 'object') {
        if (json.updatedAt) setLastKnownCloudUpdatedAt(json.updatedAt, storeId);
        return { ok: true, payload: json };
      }
      if (Array.isArray(json.products) || Array.isArray(json.invoices)) {
        const fallbackTs = json.updatedAt || new Date().toISOString();
        setLastKnownCloudUpdatedAt(fallbackTs, storeId);
        return {
          ok: true,
          payload: {
            updatedAt: fallbackTs,
            source: json.source || 'cloud',
            storeId,
            data: json,
          },
        };
      }
      return { ok: true, payload: null };
    } else if (cfg.provider === 'supabase') {
      if (!cfg.supabaseUrl || !cfg.supabaseKey) {
        return { ok: false, error: 'يرجى إدخال رابط Supabase ومفتاح API (Anon Key)' };
      }
      const base = cleanUrl(cfg.supabaseUrl);
      const targetUrl = `${base}/rest/v1/smartpos_sync?store_id=eq.${encodeURIComponent(storeId)}&select=*`;

      const res = await fetch(targetUrl, {
        method: 'GET',
        cache: 'no-store',
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
      if (rows[0].payload?.updatedAt) {
        setLastKnownCloudUpdatedAt(rows[0].payload.updatedAt, storeId);
      }
      return { ok: true, payload: rows[0].payload };
    } else {
      const base = cfg.serverUrl ? cleanUrl(cfg.serverUrl) : '';
      const targetUrl = `${base}/api/data`;
      const res = await fetch(targetUrl, { method: 'GET', cache: 'no-store' });
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
          storeId,
          data,
        },
      };
    }
  } catch (err: any) {
    const msg = err?.message || 'Cloud pull failed';
    if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('Load failed')) {
      return {
        ok: false,
        error: '🌐 تعذر الاتصال بقاعدة بيانات Firebase: تأكد من صحة الرابط ومن اتصالك بالإنترنت.',
      };
    }
    return { ok: false, error: msg };
  }
}

/**
 * Test connection (Read & Write) to Firebase / Supabase / Server and return diagnostic summary
 */
export async function testCloudConnection(
  cfg: CloudSyncConfig = getCloudSyncConfig()
): Promise<{
  ok: boolean;
  message: string;
  remoteStats?: { products: number; invoices: number; customers: number; lastUpdated?: string };
}> {
  const pullRes = await pullDataFromCloud(cfg);
  if (!pullRes.ok) {
    return { ok: false, message: pullRes.error || 'فشل الاتصال بقاعدة البيانات' };
  }

  // Test write permission on Firebase using a lightweight heartbeat ping
  if (cfg.provider === 'firebase') {
    const norm = normalizeFirebaseUrl(cfg.firebaseUrl);
    if (!norm.url || norm.error) {
      return { ok: false, message: norm.error || 'رابط Firebase غير صالح' };
    }
    const authParam = cfg.firebaseSecret ? `?auth=${encodeURIComponent(cfg.firebaseSecret)}` : '';
    const pingUrl = `${norm.url}/smartpos_ping/${encodeURIComponent((cfg.storeId || 'store_01').trim())}.json${authParam}`;
    try {
      const writeRes = await fetch(pingUrl, {
        method: 'PUT',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pingAt: new Date().toISOString(), device: getDeviceId() }),
      });
      if (!writeRes.ok) {
        const errText = await writeRes.text();
        return { ok: false, message: formatFirebaseHttpError(writeRes.status, errText) };
      }
    } catch {
      return {
        ok: false,
        message: '🌐 تعذر الكتابة في قاعدة بيانات Firebase. تأكد من صحة الرابط ومن الاتصال بالإنترنت.',
      };
    }
  }

  const d = pullRes.payload?.data;
  const remoteStats = {
    products: Array.isArray(d?.products) ? d.products.length : 0,
    invoices: Array.isArray(d?.invoices) ? d.invoices.length : 0,
    customers: Array.isArray(d?.customers) ? d.customers.length : 0,
    lastUpdated: pullRes.payload?.updatedAt,
  };

  return {
    ok: true,
    remoteStats,
    message: d
      ? `✅ الاتصال بقاعدة Firebase ناجح 100% (قراءة وكتابة)! السحابة تحتوي حالياً على: ${remoteStats.products} منتج، ${remoteStats.invoices} فاتورة، ${remoteStats.customers} زبون.`
      : '✅ الاتصال بقاعدة Firebase ناجح 100% (قراءة وكتابة)! القاعدة جاهزة؛ اضغط "رفع ومزامنة البيانات الآن" لرفع بياناتك.',
  };
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
): { merged: any; hasNewFromCloud: boolean; hasLocalChangesForCloud: boolean } {
  const localDeletedList: string[] = Array.isArray(localData?.deletedIds) ? localData.deletedIds : [];
  const cloudDeletedList: string[] = Array.isArray(cloudData?.deletedIds) ? cloudData.deletedIds : [];
  const mergedDeletedIds = addDeletedIds([...localDeletedList, ...cloudDeletedList, ...getDeletedIds()]);
  const deletedSet = new Set<string>(mergedDeletedIds);

  if (!cloudData) {
    return {
      merged: { ...localData, deletedIds: mergedDeletedIds },
      hasNewFromCloud: false,
      hasLocalChangesForCloud: true,
    };
  }

  let hasNewFromCloud = false;
  let hasLocalChangesForCloud = false;

  for (const dId of mergedDeletedIds) {
    if (!cloudDeletedList.includes(dId)) {
      hasLocalChangesForCloud = true;
    }
    if (!localDeletedList.includes(dId)) {
      hasNewFromCloud = true;
    }
  }

  // Check if localData or cloudData still holds any deleted items so we trigger cleanup
  const checkAndFilter = (arr: any[], isCloud: boolean) => {
    const out: any[] = [];
    for (const item of Array.isArray(arr) ? arr : []) {
      if (!item || !item.id) continue;
      if (deletedSet.has(item.id) || (item.convertedTo?.docId && deletedSet.has(item.convertedTo.docId))) {
        if (isCloud) hasLocalChangesForCloud = true;
        else hasNewFromCloud = true;
        continue;
      }
      out.push(item);
    }
    return out;
  };

  // 1. Merge Invoices (new invoices + updated payments/returns on existing invoices)
  const localInvoices: any[] = checkAndFilter(localData.invoices, false);
  const cloudInvoices: any[] = checkAndFilter(cloudData.invoices, true);
  const localInvMap = new Map(localInvoices.map((i: any) => [i.id, i]));
  const cloudInvMap = new Map(cloudInvoices.map((i: any) => [i.id, i]));
  const newCloudInvoices: any[] = [];
  const localOnlyInvoices: any[] = [];

  for (const lInv of localInvoices) {
    if (lInv && lInv.id && !cloudInvMap.has(lInv.id)) {
      localOnlyInvoices.push(lInv);
      hasLocalChangesForCloud = true;
    }
  }

  for (const cInv of cloudInvoices) {
    if (!cInv || !cInv.id || deletedSet.has(cInv.id)) continue;
    const existing = localInvMap.get(cInv.id);
    if (!existing) {
      newCloudInvoices.push(cInv);
      localInvMap.set(cInv.id, cInv);
      hasNewFromCloud = true;
    } else {
      const remotePaid = Number(cInv.amountPaid || 0);
      const localPaid = Number(existing.amountPaid || 0);
      const remoteReturnsLen = Array.isArray(cInv.returnedItems) ? cInv.returnedItems.length : 0;
      const localReturnsLen = Array.isArray(existing.returnedItems) ? existing.returnedItems.length : 0;
      if (remotePaid > localPaid || remoteReturnsLen > localReturnsLen || cInv.status !== existing.status) {
        if (preferRemoteEdits || remotePaid > localPaid || remoteReturnsLen > localReturnsLen) {
          localInvMap.set(cInv.id, cInv);
          hasNewFromCloud = true;
        } else {
          hasLocalChangesForCloud = true;
        }
      }
    }
  }

  // Compute per-product quantities sold in localOnlyInvoices vs newCloudInvoices
  const localOnlySoldByProduct = new Map<string, number>();
  for (const inv of localOnlyInvoices) {
    for (const it of inv.items || []) {
      if (it && it.productId) {
        localOnlySoldByProduct.set(
          it.productId,
          (localOnlySoldByProduct.get(it.productId) || 0) + Number(it.quantity || 0)
        );
      }
    }
  }

  const newCloudSoldByProduct = new Map<string, number>();
  for (const inv of newCloudInvoices) {
    for (const it of inv.items || []) {
      if (it && it.productId) {
        newCloudSoldByProduct.set(
          it.productId,
          (newCloudSoldByProduct.get(it.productId) || 0) + Number(it.quantity || 0)
        );
      }
    }
  }

  // 2. Merge Products accurately across all scenarios
  const localProducts: any[] = checkAndFilter(localData.products, false);
  const cloudProducts: any[] = checkAndFilter(cloudData.products, true);
  const localProdMap = new Map(localProducts.map((p: any) => [p.id, { ...p }]));
  const cloudProdMap = new Map(cloudProducts.map((p: any) => [p.id, p]));

  for (const lp of localProducts) {
    if (lp && lp.id && !cloudProdMap.has(lp.id)) {
      hasLocalChangesForCloud = true;
    }
  }

  for (const cp of cloudProducts) {
    if (!cp || !cp.id || deletedSet.has(cp.id)) continue;
    const existing = localProdMap.get(cp.id);
    if (!existing) {
      localProdMap.set(cp.id, { ...cp });
      hasNewFromCloud = true;
    } else {
      const localSoldQty = localOnlySoldByProduct.get(cp.id) || 0;
      const cloudSoldQty = newCloudSoldByProduct.get(cp.id) || 0;

      if (localSoldQty > 0 && cloudSoldQty > 0) {
        // Both devices sold this product independently before syncing: deduct cloudSoldQty from local stock
        const nextStock = Math.max(0, Number(existing.stock || 0) - cloudSoldQty);
        if (nextStock !== existing.stock) {
          localProdMap.set(cp.id, { ...existing, stock: nextStock });
          hasNewFromCloud = true;
          hasLocalChangesForCloud = true;
        }
      } else if (localSoldQty > 0 && cloudSoldQty === 0) {
        // Local device sold this product and cloud doesn't have that sale yet -> keep local stock
        hasLocalChangesForCloud = true;
      } else if (preferRemoteEdits) {
        // Cloud has latest state (including any cloud sales or product edits on the other device)
        if (
          existing.name !== cp.name ||
          existing.sellingPrice !== cp.sellingPrice ||
          existing.purchasePrice !== cp.purchasePrice ||
          existing.wholesalePrice !== cp.wholesalePrice ||
          existing.sku !== cp.sku ||
          existing.stock !== cp.stock ||
          existing.category !== cp.category ||
          existing.minStock !== cp.minStock ||
          existing.imageUrl !== cp.imageUrl
        ) {
          localProdMap.set(cp.id, { ...existing, ...cp });
          hasNewFromCloud = true;
        }
      } else if (cloudSoldQty > 0) {
        // Pre-merge before push: local is preferred for metadata, but deduct any newly discovered cloud sale
        const nextStock = Math.max(0, Number(existing.stock || 0) - cloudSoldQty);
        localProdMap.set(cp.id, { ...existing, stock: nextStock });
        hasNewFromCloud = true;
      }
    }
  }

  // Also if there were newCloudInvoices for a product that was only in localProdMap (not in cloudProducts)
  for (const [prodId, cloudSoldQty] of newCloudSoldByProduct.entries()) {
    if (!cloudProdMap.has(prodId) && localProdMap.has(prodId)) {
      const existing = localProdMap.get(prodId)!;
      localProdMap.set(prodId, {
        ...existing,
        stock: Math.max(0, Number(existing.stock || 0) - cloudSoldQty),
      });
      hasNewFromCloud = true;
    }
  }

  const mergedProducts = Array.from(localProdMap.values());

  // 3. Merge Customers
  const localCustomers: any[] = checkAndFilter(localData.customers, false);
  const cloudCustomers: any[] = checkAndFilter(cloudData.customers, true);
  const localCustMap = new Map(localCustomers.map((c: any) => [c.id, { ...c }]));
  const cloudCustMap = new Map(cloudCustomers.map((c: any) => [c.id, c]));

  for (const lc of localCustomers) {
    if (lc && lc.id && !cloudCustMap.has(lc.id)) {
      hasLocalChangesForCloud = true;
    }
  }

  for (const cc of cloudCustomers) {
    if (!cc || !cc.id || deletedSet.has(cc.id)) continue;
    const existing = localCustMap.get(cc.id);
    if (!existing) {
      localCustMap.set(cc.id, { ...cc });
      hasNewFromCloud = true;
    } else if (preferRemoteEdits) {
      if (
        existing.name !== cc.name ||
        existing.phone !== cc.phone ||
        existing.debt !== cc.debt ||
        existing.email !== cc.email ||
        existing.notes !== cc.notes
      ) {
        localCustMap.set(cc.id, { ...existing, ...cc });
        hasNewFromCloud = true;
      }
    } else {
      // If pre-merging before push and cloud had new unpaid invoices for this customer
      let extraCloudDebt = 0;
      for (const inv of newCloudInvoices) {
        if (inv.customerId === cc.id) {
          extraCloudDebt += Math.max(0, Number(inv.total || 0) - Number(inv.amountPaid || 0));
        }
      }
      if (extraCloudDebt > 0) {
        localCustMap.set(cc.id, { ...existing, debt: Number(existing.debt || 0) + extraCloudDebt });
        hasNewFromCloud = true;
      }
    }
  }
  const mergedCustomers = Array.from(localCustMap.values());

  // 4. Merge Suppliers
  const localSuppliers: any[] = checkAndFilter(localData.suppliers, false);
  const cloudSuppliers: any[] = checkAndFilter(cloudData.suppliers, true);
  const localSuppMap = new Map(localSuppliers.map((s: any) => [s.id, s]));
  const cloudSuppMap = new Map(cloudSuppliers.map((s: any) => [s.id, s]));
  for (const ls of localSuppliers) {
    if (ls && ls.id && !cloudSuppMap.has(ls.id)) hasLocalChangesForCloud = true;
  }
  for (const cs of cloudSuppliers) {
    if (!cs || !cs.id || deletedSet.has(cs.id)) continue;
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
  const localPurchases: any[] = checkAndFilter(localData.purchases, false);
  const cloudPurchases: any[] = checkAndFilter(cloudData.purchases, true);
  const localPurchMap = new Map(localPurchases.map((p: any) => [p.id, p]));
  const cloudPurchMap = new Map(cloudPurchases.map((p: any) => [p.id, p]));
  for (const lp of localPurchases) {
    if (lp && lp.id && !cloudPurchMap.has(lp.id)) hasLocalChangesForCloud = true;
  }
  for (const cp of cloudPurchases) {
    if (!cp || !cp.id || deletedSet.has(cp.id)) continue;
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
  const localExpenses: any[] = checkAndFilter(localData.expenses, false);
  const cloudExpenses: any[] = checkAndFilter(cloudData.expenses, true);
  const localExpMap = new Map(localExpenses.map((e: any) => [e.id, e]));
  const cloudExpMap = new Map(cloudExpenses.map((e: any) => [e.id, e]));
  for (const le of localExpenses) {
    if (le && le.id && !cloudExpMap.has(le.id)) hasLocalChangesForCloud = true;
  }
  for (const ce of cloudExpenses) {
    if (!ce || !ce.id || deletedSet.has(ce.id)) continue;
    if (!localExpMap.has(ce.id)) {
      localExpMap.set(ce.id, ce);
      hasNewFromCloud = true;
    }
  }
  const mergedExpenses = Array.from(localExpMap.values());

  // 7. Merge Repairs (SAV)
  const localRepairs: any[] = checkAndFilter(localData.repairs, false);
  const cloudRepairs: any[] = checkAndFilter(cloudData.repairs, true);
  const localRepMap = new Map(localRepairs.map((r: any) => [r.id, r]));
  const cloudRepMap = new Map(cloudRepairs.map((r: any) => [r.id, r]));
  for (const lr of localRepairs) {
    if (lr && lr.id && !cloudRepMap.has(lr.id)) hasLocalChangesForCloud = true;
  }
  for (const cr of cloudRepairs) {
    if (!cr || !cr.id || deletedSet.has(cr.id)) continue;
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

  // 8. Merge Commercial Documents (Devis, Bon de Commande, Bon de Livraison, Facture)
  const localDocs: any[] = checkAndFilter(localData.commercialDocuments, false);
  const cloudDocs: any[] = checkAndFilter(cloudData.commercialDocuments, true);
  const localDocMap = new Map(localDocs.map((d: any) => [d.id, d]));
  const cloudDocMap = new Map(cloudDocs.map((d: any) => [d.id, d]));
  for (const ld of localDocs) {
    if (ld && ld.id && !cloudDocMap.has(ld.id)) hasLocalChangesForCloud = true;
  }
  for (const cd of cloudDocs) {
    if (!cd || !cd.id || deletedSet.has(cd.id) || deletedSet.has('inv_fac_' + cd.id) || (cd.convertedTo?.docId && deletedSet.has(cd.convertedTo.docId))) continue;
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
  const normalizeEmp = (emp: any) => {
    if (emp && (emp.id === 'emp-admin' || String(emp.username || '').toLowerCase() === 'admin')) {
      return {
        ...emp,
        passwordHash: !emp.passwordHash || emp.passwordHash === 'admin' ? 'smartpos' : emp.passwordHash,
        photoUrl: '/sp-icon.png',
      };
    }
    return emp;
  };
  const rawCloudEmps: any[] = checkAndFilter(cloudData.employees, true);
  if (
    rawCloudEmps.some(
      (emp: any) =>
        emp &&
        (emp.id === 'emp-admin' || String(emp.username || '').toLowerCase() === 'admin') &&
        (!emp.passwordHash || emp.passwordHash === 'admin')
    )
  ) {
    hasLocalChangesForCloud = true;
  }
  const localEmployees: any[] = checkAndFilter(localData.employees, false).map(normalizeEmp);
  const cloudEmployees: any[] = rawCloudEmps.map(normalizeEmp);
  const localEmpMap = new Map(localEmployees.map((e: any) => [e.id, e]));
  for (const ce of cloudEmployees) {
    if (!ce || !ce.id || deletedSet.has(ce.id)) continue;
    const existing: any = localEmpMap.get(ce.id);
    if (!existing) {
      localEmpMap.set(ce.id, ce);
      hasNewFromCloud = true;
    } else if (
      preferRemoteEdits &&
      (existing.passwordHash !== ce.passwordHash ||
        existing.name !== ce.name ||
        existing.username !== ce.username ||
        existing.role !== ce.role ||
        JSON.stringify(existing.allowedTabs) !== JSON.stringify(ce.allowedTabs))
    ) {
      localEmpMap.set(ce.id, ce);
      hasNewFromCloud = true;
    }
  }
  const mergedEmployees = Array.from(localEmpMap.values());

  // 10. Store Config (Synchronize settings smoothly between Windows and mobile/iPhone)
  let mergedConfig = { ...(localData.config || {}) };
  if (cloudData.config && typeof cloudData.config === 'object' && Object.keys(cloudData.config).length > 0) {
    if (preferRemoteEdits) {
      const nextConfig = { ...mergedConfig, ...cloudData.config };
      // Keep local logo only if remote has empty logo
      if (!nextConfig.logoUrl && mergedConfig.logoUrl) {
        nextConfig.logoUrl = mergedConfig.logoUrl;
      }
      if (JSON.stringify(mergedConfig) !== JSON.stringify(nextConfig)) {
        mergedConfig = nextConfig;
        hasNewFromCloud = true;
      }
    } else {
      if (JSON.stringify(mergedConfig) !== JSON.stringify(cloudData.config)) {
        hasLocalChangesForCloud = true;
      }
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

  // 12. Merge Warehouses
  const localWhs: any[] = checkAndFilter(localData.warehouses || [], false);
  const cloudWhs: any[] = checkAndFilter(cloudData.warehouses || [], true);
  const localWhMap = new Map(localWhs.map((w: any) => [w.id, w]));
  const cloudWhMap = new Map(cloudWhs.map((w: any) => [w.id, w]));
  for (const lw of localWhs) {
    if (lw && lw.id && !cloudWhMap.has(lw.id)) hasLocalChangesForCloud = true;
  }
  for (const cw of cloudWhs) {
    if (!cw || !cw.id || deletedSet.has(cw.id)) continue;
    if (!localWhMap.has(cw.id)) {
      localWhMap.set(cw.id, cw);
      hasNewFromCloud = true;
    } else if (preferRemoteEdits) {
      localWhMap.set(cw.id, { ...localWhMap.get(cw.id), ...cw });
      hasNewFromCloud = true;
    }
  }
  const mergedWarehouses = Array.from(localWhMap.values());

  return {
    hasNewFromCloud,
    hasLocalChangesForCloud,
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
      warehouses: mergedWarehouses.length > 0 ? mergedWarehouses : (localData.warehouses || []),
      deletedIds: mergedDeletedIds,
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
      cache: 'no-store',
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
      const norm = normalizeFirebaseUrl(cfg.firebaseUrl);
      if (norm.url) {
        const authParam = cfg.firebaseSecret ? `?auth=${encodeURIComponent(cfg.firebaseSecret)}` : '';
        const targetUrl = `${norm.url}/smartpos_barcodes/${encodeURIComponent((cfg.storeId || 'store_01').trim())}.json${authParam}`;
        const res = await fetch(targetUrl, {
          method: 'PUT',
          cache: 'no-store',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: cleanCode, timestamp: Date.now() }),
        });
        if (res.ok) sent = true;
      }
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
    const norm = normalizeFirebaseUrl(cfg.firebaseUrl);
    if (!norm.url) return null;
    const queryParts = [`_t=${Date.now()}`];
    if (cfg.firebaseSecret) {
      queryParts.push(`auth=${encodeURIComponent(cfg.firebaseSecret)}`);
    }
    const baseTargetUrl = `${norm.url}/smartpos_barcodes/${encodeURIComponent((cfg.storeId || 'store_01').trim())}.json`;
    const targetUrl = `${baseTargetUrl}?${queryParts.join('&')}`;

    const res = await fetch(targetUrl, { method: 'GET', cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    if (data && data.code && data.timestamp) {
      // Clear it immediately from Firebase so it's only processed once
      const authOnly = cfg.firebaseSecret ? `?auth=${encodeURIComponent(cfg.firebaseSecret)}` : '';
      await fetch(`${baseTargetUrl}${authOnly}`, { method: 'DELETE', cache: 'no-store' });
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
  const normFb = cfg.firebaseUrl ? normalizeFirebaseUrl(cfg.firebaseUrl).url : '';
  const minimal = {
    p: cfg.provider,
    f: normFb,
    fs: cfg.firebaseSecret || '',
    su: cfg.supabaseUrl || '',
    sk: cfg.supabaseKey || '',
    srv: cfg.serverUrl || fallbackServerUrl || '',
    s: (cfg.storeId || 'store_01').trim(),
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

    const fbRaw = (parsed.f || current.firebaseUrl || '').trim();
    const fbClean = fbRaw ? normalizeFirebaseUrl(fbRaw).url : '';

    return {
      ...current,
      enabled: true,
      autoSync: true,
      provider,
      firebaseUrl: fbClean,
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

/**
 * Compress any image Data URL or File to a lightweight JPEG thumbnail (~8-15 KB)
 * so product photos and store logos never bloat Firebase Realtime Database bandwidth.
 */
export function compressImageDataUrl(
  dataUrl: string,
  maxDimension = 220,
  quality = 0.72
): Promise<string> {
  return new Promise((resolve) => {
    if (!dataUrl || !dataUrl.startsWith('data:image/') || dataUrl.length < 22000) {
      resolve(dataUrl);
      return;
    }
    try {
      const img = new Image();
      img.onload = () => {
        try {
          let w = img.naturalWidth || img.width || maxDimension;
          let h = img.naturalHeight || img.height || maxDimension;
          if (w > maxDimension || h > maxDimension) {
            if (w >= h) {
              h = Math.max(1, Math.round((h * maxDimension) / w));
              w = maxDimension;
            } else {
              w = Math.max(1, Math.round((w * maxDimension) / h));
              h = maxDimension;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(dataUrl);
            return;
          }
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          const compressed = canvas.toDataURL('image/jpeg', quality);
          resolve(compressed.length < dataUrl.length ? compressed : dataUrl);
        } catch {
          resolve(dataUrl);
        }
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    } catch {
      resolve(dataUrl);
    }
  });
}

export function compressImageFile(
  file: File,
  maxDimension = 220,
  quality = 0.72
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const raw = (ev.target?.result as string) || '';
      if (!raw) {
        reject(new Error('Empty file'));
        return;
      }
      const compressed = await compressImageDataUrl(raw, maxDimension, quality);
      resolve(compressed);
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}
