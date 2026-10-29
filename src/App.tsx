/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Product, Customer, CustomerPayment, Supplier, Purchase, Invoice, InvoiceReturnItem, StoreConfig, Language, ActiveTab, PaymentStatus, Employee, ActivityLog, RepairOrder, Expense, CommercialDocument, CommercialDocType } from './types';
import { getStoredData, saveStoredData, resetStoredToDefaults } from './dataStore';
import { languages } from './languages';
import POS from './components/POS';
import Inventory from './components/Inventory';
import Customers from './components/Customers';
import Suppliers from './components/Suppliers';
import Purchases from './components/Purchases';
import Invoices from './components/Invoices';
import Expenses from './components/Expenses';
import Dashboard from './components/Dashboard';
import Settings from './components/Settings';
import UsersManagement from './components/UsersManagement';
import RepairsManagement from './components/RepairsManagement';
import ActivityLogs from './components/ActivityLogs';
import LoginScreen from './components/LoginScreen';
import Home from './components/Home';
import PurchaseEntry from './components/PurchaseEntry';
import CommercialDocuments from './components/CommercialDocuments';
import BackupManagement from './components/BackupManagement';
import MobileAndCloudSync from './components/MobileAndCloudSync';
import { getCloudSyncConfig, saveCloudSyncConfig, loadCloudSyncConfigFromServer, pushDataToCloud, pullDataFromCloud, mergeStoreDatasets, decodePairingCode, getDeletedIds, addDeletedIds, clearDeletedIds, compressImageDataUrl } from './utils/cloudSync';
import { exportDatabaseBackupFile } from './utils/printService';
import { Pin, ChevronLeft, ChevronRight, Home as SmartHome, LayoutDashboard, ShoppingCart, Receipt, Package, Users, Truck, ShoppingBag, Settings as SettingsIcon, Globe, PhoneCall, Shield, LogOut, ClipboardList, PenTool, ReceiptText, Moon, Sun, FileText, ScrollText, CheckSquare, FileSpreadsheet, Database, Smartphone, Menu, X, RefreshCw, Cloud } from 'lucide-react';

export default function App() {
  // Load database once on mount
  const [data, setData] = useState<{
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
    deletedIds?: string[];
  } | null>(null);

  const [lang, setLang] = useState<Language>('ar'); // default is Arabic, matching Arabic query primary intent
  const [activeTab, setActiveTab] = useState<ActiveTab>('home');
  const [isSidebarHovered, setIsSidebarHovered] = useState(false);
  const [isSidebarPinned, setIsSidebarPinned] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState<any>(null);
  const [isCloudSyncing, setIsCloudSyncing] = useState(false);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const [commercialDocCreateTrigger, setCommercialDocCreateTrigger] = useState(0);
  const sidebarHoverTimeout = React.useRef<any>(null);
  const cloudPushTimeoutRef = React.useRef<any>(null);
  const isSyncCycleInFlightRef = React.useRef<boolean>(false);

  const selectTab = (tab: ActiveTab, openCreateForm = false) => {
    if (tab === 'commercial-documents') {
      if (openCreateForm) {
        setCommercialDocCreateTrigger((prev) => prev + 1);
      } else {
        setCommercialDocCreateTrigger(0);
      }
    }
    setActiveTab(tab);
    setIsMobileMenuOpen(false);
  };

  // Capture PWA Install Prompt for 1-click Android / Desktop installation
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleTriggerPwaInstall = async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice.catch(() => {});
    setDeferredInstallPrompt(null);
  };

  // Track soft keyboard visibility on mobile to prevent bottom nav bar from floating over keyboard
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  useEffect(() => {
    let blurTimer: any = null;

    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) &&
        (target as HTMLInputElement).type !== 'checkbox' &&
        (target as HTMLInputElement).type !== 'radio'
      ) {
        setIsKeyboardVisible(true);
        document.body.classList.add('keyboard-open');
      }
    };

    const handleFocusOut = () => {
      clearTimeout(blurTimer);
      blurTimer = setTimeout(() => {
        const activeEl = document.activeElement;
        const isInputStillFocused =
          activeEl &&
          (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || (activeEl as HTMLElement).isContentEditable) &&
          (activeEl as HTMLInputElement).type !== 'checkbox' &&
          (activeEl as HTMLInputElement).type !== 'radio';
        if (!isInputStillFocused) {
          setIsKeyboardVisible(false);
          document.body.classList.remove('keyboard-open');
        }
      }, 120);
    };

    const handleViewportResize = () => {
      if (window.visualViewport) {
        const heightDiff = window.innerHeight - window.visualViewport.height;
        if (heightDiff > 120) {
          setIsKeyboardVisible(true);
          document.body.classList.add('keyboard-open');
        } else {
          const activeEl = document.activeElement;
          const isInputStillFocused =
            activeEl &&
            (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || (activeEl as HTMLElement).isContentEditable) &&
            (activeEl as HTMLInputElement).type !== 'checkbox' &&
            (activeEl as HTMLInputElement).type !== 'radio';
          if (!isInputStillFocused) {
            setIsKeyboardVisible(false);
            document.body.classList.remove('keyboard-open');
          }
        }
      }
    };

    window.addEventListener('focusin', handleFocusIn);
    window.addEventListener('focusout', handleFocusOut);
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleViewportResize);
    }

    return () => {
      clearTimeout(blurTimer);
      window.removeEventListener('focusin', handleFocusIn);
      window.removeEventListener('focusout', handleFocusOut);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleViewportResize);
      }
    };
  }, []);


  const handleSidebarMouseEnter = () => {
    if (sidebarHoverTimeout.current) {
      clearTimeout(sidebarHoverTimeout.current);
      sidebarHoverTimeout.current = null;
    }
    setIsSidebarHovered(true);
  };

  const handleSidebarMouseLeave = () => {
    sidebarHoverTimeout.current = setTimeout(() => {
      setIsSidebarHovered(false);
    }, 280);
  };

  const isSidebarOpen = isSidebarPinned || isSidebarHovered;

  const [currentUser, setCurrentUser] = useState<Employee | null>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sales_app_current_user');
      if (saved) {
        try {
          const parsed = JSON.parse(saved) as Employee;
          if (parsed) {
            if (!parsed.allowedTabs.includes('home')) {
              parsed.allowedTabs = ['home', ...parsed.allowedTabs];
            }
            ['devis', 'bon-commande', 'bon-livraison', 'commercial-documents'].forEach((tab: any) => {
              if (!parsed.allowedTabs.includes(tab)) {
                parsed.allowedTabs.push(tab);
              }
            });
            if (parsed.role === 'admin' || parsed.username === 'admin') {
              ['backup', 'mobile-sync', 'repairs', 'logs', 'expenses', 'purchase-entry'].forEach((tab: any) => {
                if (!parsed.allowedTabs.includes(tab)) {
                  parsed.allowedTabs.push(tab);
                }
              });
              parsed.photoUrl = '/sp-icon.png';
              if (parsed.passwordHash === 'admin') {
                parsed.passwordHash = 'smartpos';
              }
            }
          }
          return parsed;
        } catch (e) {
          return null;
        }
      }
    }
    return null;
  });

  // Auto-detect ?pair=... or ?tab=... in URL on smartphone launch
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const pairParam = params.get('pair');
    const tabParam = params.get('tab') as ActiveTab | null;

    if (tabParam) {
      setActiveTab(tabParam);
    }

    if (pairParam) {
      const decoded = decodePairingCode(pairParam);
      if (decoded) {
        saveCloudSyncConfig(decoded);
        setSyncNotice('🔗 تم ربط الهاتف تلقائياً ومزامنة بيانات المتجر!');
        setTimeout(() => setSyncNotice(null), 5000);
        // Clean URL query param without reloading
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, '', cleanUrl);
      }
    }
  }, []);

  // Ensure any official invoice (facture) in commercialDocuments is synced with invoices and stock
  // while strictly respecting deletedIds so deleted invoices/documents never return.
  const reconcileFacturesDataset = (dataset: any) => {
    if (!dataset) return dataset;
    const mergedDeleted = addDeletedIds([
      ...(Array.isArray(dataset.deletedIds) ? dataset.deletedIds : []),
      ...getDeletedIds(),
    ]);
    const deletedSet = new Set<string>(mergedDeleted);

    const rawDocs: CommercialDocument[] = Array.isArray(dataset.commercialDocuments) ? dataset.commercialDocuments : [];
    const docs = rawDocs.filter(
      (d) => d && !deletedSet.has(d.id) && !deletedSet.has('inv_doc_' + d.id)
    );
    const rawInvs: Invoice[] = Array.isArray(dataset.invoices) ? dataset.invoices : [];
    const invs = rawInvs.filter((inv) => inv && !deletedSet.has(inv.id));
    let prods: Product[] = (Array.isArray(dataset.products) ? dataset.products : []).filter(
      (p: Product) => p && !deletedSet.has(p.id)
    );
    let changed = docs.length !== rawDocs.length || invs.length !== rawInvs.length;

    const rawEmployees: Employee[] = Array.isArray(dataset.employees) ? dataset.employees : [];
    const normalizedEmployees = rawEmployees.map((emp) => {
      if (emp && (emp.id === 'emp-admin' || emp.username === 'admin')) {
        const nextPwd = emp.passwordHash === 'admin' ? 'smartpos' : emp.passwordHash;
        const nextPhoto = '/sp-icon.png';
        if (emp.passwordHash !== nextPwd || emp.photoUrl !== nextPhoto) {
          changed = true;
          return { ...emp, passwordHash: nextPwd, photoUrl: nextPhoto };
        }
      }
      return emp;
    });

    const findProd = (it: any) => {
      if (!it.productId) return undefined;
      return prods.find((p) => p.id === it.productId);
    };

    const updatedDocs = docs.map((doc) => {
      if (doc.docType !== 'facture' || doc.status === 'cancelled') return doc;
      if (deletedSet.has(doc.id) || deletedSet.has('inv_doc_' + doc.id)) return doc;
      const alreadySynced = invs.some(
        (inv) =>
          inv.id === 'inv_doc_' + doc.id ||
          inv.invoiceNumber === doc.docNumber ||
          (inv.notes && inv.notes.includes(doc.docNumber))
      );
      if (alreadySynced) return doc;

      changed = true;
      const enrichedItems = (doc.items || []).map((it) => {
        const matched = findProd(it);
        if (matched) {
          prods = prods.map((p) =>
            p.id === matched.id ? { ...p, stock: p.stock - Number(it.quantity || 0) } : p
          );
        }
        return {
          ...it,
          productId: matched ? matched.id : '',
          purchasePrice: matched ? Number(it.purchasePrice || matched.purchasePrice || 0) : 0,
        };
      });

      const paidAmount = doc.amountPaid !== undefined ? Number(doc.amountPaid) : doc.total;
      const unpaid = Math.max(0, doc.total - paidAmount);
      const status: PaymentStatus =
        paidAmount <= 0 && doc.total > 0 ? 'unpaid' : unpaid > 0.01 ? 'partial' : 'paid';

      invs.unshift({
        id: 'inv_doc_' + doc.id,
        invoiceNumber: doc.docNumber,
        date: doc.date,
        customerId: doc.customerId || 'walk-in',
        customerName: doc.customerName || 'زبون عام',
        items: enrichedItems,
        subtotal: doc.subtotal,
        discount: doc.discount,
        tax: doc.tax,
        total: doc.total,
        amountPaid: paidAmount,
        previousBalance: Number(doc.previousBalance || 0),
        paymentMethod: doc.paymentMethod || (unpaid > 0 ? 'debt' : 'cash'),
        status,
        notes: doc.notes || `فاتورة رسمية (${doc.docNumber})`,
        sellerName: doc.sellerName,
        isWholesale: doc.isWholesale ?? true,
        pricingMode: doc.pricingMode || 'wholesale',
      });

      return {
        ...doc,
        items: enrichedItems,
        status: (doc.status as string) === 'invoiced' ? 'validated' : doc.status,
      };
    });

    if (!changed && Array.isArray(dataset.deletedIds) && dataset.deletedIds.length === mergedDeleted.length) {
      return dataset;
    }
    return {
      ...dataset,
      employees: normalizedEmployees,
      products: prods,
      invoices: invs,
      commercialDocuments: updatedDocs,
      deletedIds: mergedDeleted,
    };
  };

  // Load from SQLite database / local storage / Cloud on mount
  useEffect(() => {
    (async () => {
      let cloudCfg = getCloudSyncConfig();
      if (!cloudCfg.firebaseUrl && !cloudCfg.supabaseUrl) {
        const srvCfg = await loadCloudSyncConfigFromServer();
        if (srvCfg) cloudCfg = srvCfg;
      }
      const apiBase = cloudCfg.provider === 'server' && cloudCfg.serverUrl ? cloudCfg.serverUrl.replace(/\/+$/, '') : '';

      try {
        const res = await fetch(`${apiBase}/api/data`, { cache: 'no-store' });
        if (!res.ok) throw new Error('Failed to fetch stats');
        const loaded = await res.json();
        if (loaded?.config?.logoUrl?.includes('images.unsplash.com')) {
          loaded.config.logoUrl = '';
        }
        let finalData = reconcileFacturesDataset(loaded);
        if (cloudCfg.enabled) {
          const cloudRes = await pullDataFromCloud(cloudCfg).catch(() => null);
          if (cloudRes?.ok && cloudRes.payload?.data) {
            const { merged, hasNewFromCloud, hasLocalChangesForCloud } = mergeStoreDatasets(finalData, cloudRes.payload.data, true);
            finalData = reconcileFacturesDataset(merged);
            if (hasNewFromCloud) {
              fetch(`${apiBase}/api/save`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(finalData),
              }).catch(() => {});
            }
            if (hasLocalChangesForCloud) {
              pushDataToCloud(finalData, cloudCfg, { skipPreMerge: true }).catch(() => {});
            }
          } else if (
            cloudRes?.ok &&
            !cloudRes.payload &&
            ((finalData.products && finalData.products.length > 0) || (finalData.invoices && finalData.invoices.length > 0))
          ) {
            pushDataToCloud(finalData, cloudCfg, { skipPreMerge: true }).catch(() => {});
          }
        }
        saveStoredData(finalData);
        setData(finalData);
      } catch (err) {
        console.warn('Database load fallback to local storage / cloud:', err);
        let loaded = reconcileFacturesDataset(getStoredData());
        if (loaded?.config?.logoUrl?.includes('images.unsplash.com')) {
          loaded.config.logoUrl = '';
        }
        if (cloudCfg.enabled) {
          const cloudRes = await pullDataFromCloud(cloudCfg).catch(() => null);
          if (cloudRes?.ok && cloudRes.payload?.data) {
            const { merged, hasLocalChangesForCloud } = mergeStoreDatasets(loaded, cloudRes.payload.data, true);
            loaded = reconcileFacturesDataset(merged);
            saveStoredData(loaded);
            if (hasLocalChangesForCloud) {
              pushDataToCloud(loaded, cloudCfg, { skipPreMerge: true }).catch(() => {});
            }
          }
        }
        setData(loaded);
      }
    })();
  }, []);

  // Automatically shrink any oversized Base64 product/logo images (>25KB) once after load to save Firebase bandwidth
  const didCompressImagesRef = React.useRef(false);
  useEffect(() => {
    if (!data || didCompressImagesRef.current) return;
    didCompressImagesRef.current = true;
    (async () => {
      let anyCompressed = false;
      const nextProducts = await Promise.all(
        (data.products || []).map(async (p) => {
          if (p?.imageUrl && p.imageUrl.startsWith('data:image/') && p.imageUrl.length > 25000) {
            const smaller = await compressImageDataUrl(p.imageUrl, 220, 0.72);
            if (smaller.length < p.imageUrl.length) {
              anyCompressed = true;
              return { ...p, imageUrl: smaller };
            }
          }
          return p;
        })
      );
      let nextLogo = data.config?.logoUrl || '';
      if (nextLogo && nextLogo.startsWith('data:image/') && nextLogo.length > 35000) {
        const smallerLogo = await compressImageDataUrl(nextLogo, 260, 0.78);
        if (smallerLogo.length < nextLogo.length) {
          nextLogo = smallerLogo;
          anyCompressed = true;
        }
      }
      if (anyCompressed) {
        updateDataState((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            products: nextProducts,
            config: { ...prev.config, logoUrl: nextLogo },
          };
        });
      }
    })();
  }, [data]);

  // Sync to local storage, SQLite, and Cloud whenever datasets change
  const updateDataState = (
    updater: (prev: typeof data) => typeof data,
    skipCloudPush = false,
    skipPreMerge = false
  ) => {
    setData((old) => {
      const rawNext = updater(old);
      if (!rawNext) return rawNext;
      const next = {
        ...rawNext,
        deletedIds: addDeletedIds([...(rawNext.deletedIds || []), ...getDeletedIds()]),
      };
      saveStoredData(next);
      const cloudCfg = getCloudSyncConfig();
      const apiBase = cloudCfg.provider === 'server' && cloudCfg.serverUrl ? cloudCfg.serverUrl.replace(/\/+$/, '') : '';

      fetch(`${apiBase}/api/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(next),
      }).catch(() => {});

      if (!skipCloudPush && cloudCfg.enabled && cloudCfg.autoSync) {
        if (cloudPushTimeoutRef.current) {
          clearTimeout(cloudPushTimeoutRef.current);
        }
        cloudPushTimeoutRef.current = setTimeout(() => {
          pushDataToCloud(next, cloudCfg, { skipPreMerge }).then((res) => {
            if (res.ok && res.mergedData) {
              const reconciled = reconcileFacturesDataset(res.mergedData);
              saveStoredData(reconciled);
              fetch(`${apiBase}/api/save`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(reconciled),
              }).catch(() => {});
            }
          }).catch(() => {});
        }, 1200);
      }
      return next;
    });
  };

  // Manual or background Cloud/Server Sync trigger
  const triggerSyncCycle = async (showFeedback = false) => {
    const cloudCfg = getCloudSyncConfig();
    if (!cloudCfg.enabled) {
      if (showFeedback) {
        selectTab('mobile-sync');
      }
      return;
    }
    if (isSyncCycleInFlightRef.current && !showFeedback) {
      return;
    }
    isSyncCycleInFlightRef.current = true;
    if (showFeedback) setIsCloudSyncing(true);
    try {
      const res = await pullDataFromCloud(cloudCfg, { onlyIfChanged: !showFeedback });
      if (res.unchanged) {
        return;
      }
      if (res.ok && res.payload && res.payload.data) {
        setData((prev) => {
          if (!prev) return prev;
          const { merged, hasNewFromCloud, hasLocalChangesForCloud } = mergeStoreDatasets(prev, res.payload.data, true);
          const reconciled = reconcileFacturesDataset(merged);
          if (hasNewFromCloud || hasLocalChangesForCloud || showFeedback) {
            saveStoredData(reconciled);
            fetch('/api/save', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(reconciled),
            }).catch(() => {});
            if (hasLocalChangesForCloud || showFeedback) {
              pushDataToCloud(reconciled, cloudCfg, { skipPreMerge: true }).catch(() => {});
            }
            if (showFeedback) {
              setSyncNotice('✓ تمت مزامنة البيانات مع السحابة والهواتف بنجاح!');
              setTimeout(() => setSyncNotice(null), 3500);
            }
            return reconciled;
          }
          return prev;
        });
      } else if (res.ok && !res.unchanged && (!res.payload || !res.payload.data)) {
        // Cloud store node is empty — push local data if available
        setData((prev) => {
          if (prev && (showFeedback || (prev.products && prev.products.length > 0) || (prev.invoices && prev.invoices.length > 0))) {
            pushDataToCloud(prev, cloudCfg, { skipPreMerge: true }).catch(() => {});
            if (showFeedback) {
              setSyncNotice('✓ تم رفع البيانات إلى السحابة بنجاح!');
              setTimeout(() => setSyncNotice(null), 3500);
            }
          }
          return prev;
        });
      } else if (!res.ok && showFeedback) {
        setSyncNotice(res.error || '⚠️ تعذر الاتصال بالسحابة، تحقق من إعدادات المزامنة');
        setTimeout(() => setSyncNotice(null), 5000);
      }
    } finally {
      isSyncCycleInFlightRef.current = false;
      if (showFeedback) setIsCloudSyncing(false);
    }
  };

  // Periodic background Cloud Pull & Merge + Instant wake/online sync for Android & iPhone
  useEffect(() => {
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      const cloudCfg = getCloudSyncConfig();
      if (cloudCfg.enabled && cloudCfg.autoSync) {
        triggerSyncCycle(false);
      }
    }, 22000);

    const handleWakeOrOnline = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        const cloudCfg = getCloudSyncConfig();
        if (cloudCfg.enabled && cloudCfg.autoSync) {
          triggerSyncCycle(false);
        }
      }
    };

    window.addEventListener('online', handleWakeOrOnline);
    document.addEventListener('visibilitychange', handleWakeOrOnline);

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', handleWakeOrOnline);
      document.removeEventListener('visibilitychange', handleWakeOrOnline);
    };
  }, []);

  const addLogMessage = (action: string, details: string, skipCloudPush = true) => {
    updateDataState((prev) => {
      if (!prev) return prev;
      const newLog: ActivityLog = {
        id: 'log_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        timestamp: new Date().toISOString(),
        userId: currentUser?.id || 'system',
        userName: currentUser?.name || 'System',
        action,
        details
      };
      return {
        ...prev,
        logs: [newLog, ...prev.logs].slice(0, 800) // Keep up to 800 logs
      };
    }, skipCloudPush);
  };

  const handleLogin = (employee: Employee) => {
    let finalEmp = { ...employee };
    if (!finalEmp.allowedTabs.includes('home')) {
      finalEmp.allowedTabs = ['home', ...finalEmp.allowedTabs];
    }
    ['devis', 'bon-commande', 'bon-livraison', 'commercial-documents'].forEach((tab: any) => {
      if (!finalEmp.allowedTabs.includes(tab)) {
        finalEmp.allowedTabs.push(tab);
      }
    });
    if (finalEmp.role === 'admin' || finalEmp.username === 'admin') {
      ['backup', 'mobile-sync', 'repairs', 'logs', 'expenses', 'purchase-entry'].forEach((tab: any) => {
        if (!finalEmp.allowedTabs.includes(tab)) {
          finalEmp.allowedTabs.push(tab);
        }
      });
      finalEmp.photoUrl = '/sp-icon.png';
    }
    setCurrentUser(finalEmp);
    localStorage.setItem('sales_app_current_user', JSON.stringify(finalEmp));
    if (finalEmp.allowedTabs && finalEmp.allowedTabs.length > 0) {
      setActiveTab(finalEmp.allowedTabs[0]);
    }
    setTimeout(() => {
      addLogMessage('login', `Employee ${finalEmp.name} logged in successfully`, true);
      triggerSyncCycle(false);
    }, 100);
  };

  const handleLogout = () => {
    if (currentUser) {
      addLogMessage('logout', `Employee ${currentUser.name} signed out`, true);
    }
    setCurrentUser(null);
    localStorage.removeItem('sales_app_current_user');
  };

  // Redirect if current activeTab is not in allowedTabs
  useEffect(() => {
    if (currentUser && currentUser.allowedTabs && !currentUser.allowedTabs.includes(activeTab)) {
      if (currentUser.allowedTabs.length > 0) {
        setActiveTab(currentUser.allowedTabs[0]);
      }
    }
  }, [currentUser, activeTab]);

  const handleSaveEmployee = (emp: Employee) => {
    updateDataState((prev) => {
      if (!prev) return prev;
      const idx = prev.employees.findIndex((e) => e.id === emp.id);
      const nextEmps = [...prev.employees];
      if (idx > -1) {
        nextEmps[idx] = emp;
      } else {
        nextEmps.push(emp);
      }
      // Keep session updated if editing current user
      if (currentUser && emp.id === currentUser.id) {
        setCurrentUser(emp);
        localStorage.setItem('sales_app_current_user', JSON.stringify(emp));
      }
      return { ...prev, employees: nextEmps };
    });
  };

  const handleDeleteEmployee = (id: string) => {
    updateDataState((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        employees: prev.employees.filter((e) => e.id !== id),
      };
    });
  };

  const handleSaveRepair = (repair: RepairOrder) => {
    updateDataState((prev) => {
      if (!prev) return prev;
      const idx = prev.repairs.findIndex((r) => r.id === repair.id);
      const nextRepairs = [...prev.repairs];
      let details = '';
      if (idx > -1) {
        nextRepairs[idx] = repair;
        details = `Updated SAV ticket ${repair.orderNumber} for ${repair.customerName} (${repair.itemName}) to status ${repair.status}`;
      } else {
        nextRepairs.push(repair);
        details = `Created SAV ticket ${repair.orderNumber} for ${repair.customerName} (${repair.itemName})`;
      }

      // Add log
      const newLog: ActivityLog = {
        id: 'log_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        timestamp: new Date().toISOString(),
        userId: currentUser?.id || 'system',
        userName: currentUser?.name || 'System',
        action: 'repair_saved',
        details
      };

      return {
        ...prev,
        repairs: nextRepairs,
        logs: [newLog, ...prev.logs].slice(0, 800)
      };
    });
  };

  const handleDeleteRepair = (id: string) => {
    updateDataState((prev) => {
      if (!prev) return prev;
      const toDelete = prev.repairs.find((r) => r.id === id);
      const nextRepairs = prev.repairs.filter((r) => r.id !== id);

      const newLog: ActivityLog = {
        id: 'log_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        timestamp: new Date().toISOString(),
        userId: currentUser?.id || 'system',
        userName: currentUser?.name || 'System',
        action: 'repair_deleted',
        details: lang === 'ar'
          ? `تم حذف أمر الصيانة رقم ${toDelete?.orderNumber || id} للزبون "${toDelete?.customerName || 'غير معروف'}"`
          : `Deleted SAV ticket ${toDelete?.orderNumber || id} for ${toDelete?.customerName || 'Unknown'}`
      };

      return {
        ...prev,
        repairs: nextRepairs,
        logs: [newLog, ...prev.logs].slice(0, 800)
      };
    });
  };

  const handleClearLogs = () => {
    updateDataState((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        logs: [],
      };
    });
  };

  const handleDeleteSingleLog = (id: string) => {
    updateDataState((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        logs: prev.logs.filter((l) => l.id !== id),
      };
    });
  };

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="flex flex-col items-center gap-2">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-500 font-bold">Please wait, launching databases...</p>
        </div>
      </div>
    );
  }

  // Intercept and prompt authentications
  if (currentUser === null) {
    return (
      <LoginScreen
        employees={data.employees}
        onLogin={handleLogin}
        lang={lang}
        onSetLang={setLang}
      />
    );
  }

  const { products, customers, suppliers, purchases, invoices, config, employees, logs, repairs } = data;
  const expenses = data.expenses || [];
  const commercialDocuments = data.commercialDocuments || [];
  const t = languages[lang];
  const isRTL = t.direction === 'rtl';

  // Commercial Documents handlers
  const handleSaveCommercialDoc = (doc: CommercialDocument) => {
    updateDataState((prev) => {
      if (!prev) return prev;
      const docs = prev.commercialDocuments || [];
      const idx = docs.findIndex((d) => d.id === doc.id);
      const oldDoc = idx > -1 ? docs[idx] : undefined;
      let nextDocs = [...docs];
      let nextProds = [...prev.products];
      let nextCusts = [...prev.customers];
      let nextInvoices = [...prev.invoices];

      const findMatchingProd = (it: any, prodsList: Product[]) => {
        if (!it.productId) return undefined;
        return prodsList.find((p) => p.id === it.productId);
      };

      // Enrich items with productId and purchasePrice when matching inventory product exists
      const enrichedItems = (doc.items || []).map((it) => {
        const matched = findMatchingProd(it, nextProds);
        return {
          ...it,
          productId: matched ? matched.id : '',
          purchasePrice: matched ? Number(it.purchasePrice || matched.purchasePrice || 0) : 0,
        };
      });

      const normalizedDoc: CommercialDocument = {
        ...doc,
        items: enrichedItems,
        amountPaid: doc.amountPaid !== undefined ? Number(doc.amountPaid) : doc.total,
        previousBalance: Number(doc.previousBalance || 0),
        paymentMethod: doc.paymentMethod || 'cash',
        sellerName: doc.sellerName || currentUser?.name,
        isWholesale: doc.isWholesale ?? true,
        pricingMode: doc.pricingMode || 'wholesale',
      };

      // If updating an existing official invoice (facture), first revert its previous stock & debt impact
      if (oldDoc && oldDoc.docType === 'facture' && oldDoc.status !== 'cancelled') {
        oldDoc.items.forEach((oldIt) => {
          const matchedOld = findMatchingProd(oldIt, nextProds);
          if (matchedOld) {
            nextProds = nextProds.map((p) =>
              p.id === matchedOld.id ? { ...p, stock: p.stock + Number(oldIt.quantity || 0) } : p
            );
          }
        });

        const existingInv = nextInvoices.find(
          (inv) => inv.id === 'inv_doc_' + oldDoc.id || inv.invoiceNumber === oldDoc.docNumber
        );
        const oldPaid =
          oldDoc.amountPaid !== undefined
            ? Number(oldDoc.amountPaid)
            : existingInv
            ? existingInv.amountPaid
            : oldDoc.total;
        const oldUnpaid = Math.max(0, oldDoc.total - oldPaid);
        if (oldUnpaid > 0 && oldDoc.customerId && oldDoc.customerId !== 'walk-in') {
          nextCusts = nextCusts.map((c) =>
            c.id === oldDoc.customerId ? { ...c, debt: Math.max(0, c.debt - oldUnpaid) } : c
          );
        }
      }

      // If the saved document is an official invoice (facture), apply stock deduction, debt, and sync with invoices
      if (normalizedDoc.docType === 'facture') {
        if (normalizedDoc.status !== 'cancelled') {
          normalizedDoc.items.forEach((newIt) => {
            const matchedNew = findMatchingProd(newIt, nextProds);
            if (matchedNew) {
              nextProds = nextProds.map((p) =>
                p.id === matchedNew.id ? { ...p, stock: p.stock - Number(newIt.quantity || 0) } : p
              );
            }
          });

          const paidVal =
            normalizedDoc.amountPaid !== undefined ? Number(normalizedDoc.amountPaid) : normalizedDoc.total;
          const unpaidRemainder = Math.max(0, normalizedDoc.total - paidVal);
          const invStatus: PaymentStatus =
            paidVal <= 0 && normalizedDoc.total > 0 ? 'unpaid' : unpaidRemainder > 0.01 ? 'partial' : 'paid';

          if (unpaidRemainder > 0 && normalizedDoc.customerId && normalizedDoc.customerId !== 'walk-in') {
            nextCusts = nextCusts.map((c) =>
              c.id === normalizedDoc.customerId ? { ...c, debt: c.debt + unpaidRemainder } : c
            );
          }

          const syncedInvoice: Invoice = {
            id: 'inv_doc_' + normalizedDoc.id,
            invoiceNumber: normalizedDoc.docNumber,
            date: normalizedDoc.date,
            customerId: normalizedDoc.customerId || 'walk-in',
            customerName: normalizedDoc.customerName || (lang === 'ar' ? 'زبون عام' : 'Client Comptoir'),
            items: enrichedItems,
            subtotal: normalizedDoc.subtotal,
            discount: normalizedDoc.discount,
            tax: normalizedDoc.tax,
            total: normalizedDoc.total,
            amountPaid: paidVal,
            previousBalance: Number(normalizedDoc.previousBalance || 0),
            paymentMethod: normalizedDoc.paymentMethod || (unpaidRemainder > 0 ? 'debt' : 'cash'),
            status: invStatus,
            notes:
              normalizedDoc.notes ||
              (lang === 'ar' ? `فاتورة رسمية (${normalizedDoc.docNumber})` : `Facture officielle (${normalizedDoc.docNumber})`),
            sellerId: currentUser?.id,
            sellerName: normalizedDoc.sellerName || currentUser?.name,
            isWholesale: normalizedDoc.isWholesale ?? true,
            pricingMode: normalizedDoc.pricingMode || 'wholesale',
          };

          const invIdx = nextInvoices.findIndex(
            (inv) => inv.id === 'inv_doc_' + normalizedDoc.id || inv.invoiceNumber === normalizedDoc.docNumber
          );
          if (invIdx > -1) {
            nextInvoices[invIdx] = syncedInvoice;
          } else {
            nextInvoices.unshift(syncedInvoice);
          }
        } else {
          // If marked cancelled, remove from active sales invoices
          nextInvoices = nextInvoices.filter(
            (inv) => inv.id !== 'inv_doc_' + normalizedDoc.id && inv.invoiceNumber !== normalizedDoc.docNumber
          );
        }
      }

      let details = '';
      if (idx > -1) {
        nextDocs[idx] = normalizedDoc;
        details = lang === 'ar' 
          ? `تم تحديث وثيقة تجارية ${normalizedDoc.docNumber} (${normalizedDoc.docType}) للزبون ${normalizedDoc.customerName}`
          : `Updated commercial document ${normalizedDoc.docNumber} (${normalizedDoc.docType}) for ${normalizedDoc.customerName}`;
      } else {
        nextDocs.unshift(normalizedDoc);
        details = lang === 'ar'
          ? `تم إنشاء وثيقة تجارية جديدة ${normalizedDoc.docNumber} (${normalizedDoc.docType}) للزبون ${normalizedDoc.customerName}`
          : `Created commercial document ${normalizedDoc.docNumber} (${normalizedDoc.docType}) for ${normalizedDoc.customerName}`;
      }

      const newLog: ActivityLog = {
        id: 'log_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        timestamp: new Date().toISOString(),
        userId: currentUser?.id || 'system',
        userName: currentUser?.name || 'System',
        action: 'commercial_doc_saved',
        details
      };

      return {
        ...prev,
        products: nextProds,
        customers: nextCusts,
        invoices: nextInvoices,
        commercialDocuments: nextDocs,
        logs: [newLog, ...prev.logs].slice(0, 800)
      };
    });
  };

  const handleDeleteCommercialDoc = (id: string) => {
    updateDataState((prev) => {
      if (!prev) return prev;
      const docs = prev.commercialDocuments || [];
      const target = docs.find((d) => d.id === id);
      const nextDocs = docs.filter((d) => d.id !== id);
      let nextProds = [...prev.products];
      let nextCusts = [...prev.customers];
      let nextInvoices = [...prev.invoices];
      const idsToDelete: string[] = [id, 'inv_doc_' + id];

      if (target && target.docType === 'facture' && target.status !== 'cancelled') {
        target.items.forEach((it) => {
          const cleanName = String(it.productName || '').trim().toLowerCase();
          const matched = nextProds.find(
            (p) =>
              (it.productId && p.id === it.productId) ||
              (cleanName &&
                (p.name.trim().toLowerCase() === cleanName ||
                  (p.sku && p.sku.trim().toLowerCase() === cleanName)))
          );
          if (matched) {
            nextProds = nextProds.map((p) =>
              p.id === matched.id ? { ...p, stock: p.stock + Number(it.quantity || 0) } : p
            );
          }
        });

        const linkedInv = nextInvoices.find(
          (inv) => inv.id === 'inv_doc_' + target.id || inv.invoiceNumber === target.docNumber
        );
        if (linkedInv) idsToDelete.push(linkedInv.id);
        const paidVal =
          target.amountPaid !== undefined
            ? Number(target.amountPaid)
            : linkedInv
            ? linkedInv.amountPaid
            : target.total;
        const unpaidRemainder = Math.max(0, target.total - paidVal);
        if (unpaidRemainder > 0 && target.customerId && target.customerId !== 'walk-in') {
          nextCusts = nextCusts.map((c) =>
            c.id === target.customerId ? { ...c, debt: Math.max(0, c.debt - unpaidRemainder) } : c
          );
        }

        nextInvoices = nextInvoices.filter(
          (inv) => inv.id !== 'inv_doc_' + target.id && inv.invoiceNumber !== target.docNumber
        );
      }

      const nextDeletedIds = addDeletedIds([...(prev.deletedIds || []), ...idsToDelete]);

      const newLog: ActivityLog = {
        id: 'log_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        timestamp: new Date().toISOString(),
        userId: currentUser?.id || 'system',
        userName: currentUser?.name || 'System',
        action: 'commercial_doc_deleted',
        details: target 
          ? (lang === 'ar' ? `تم حذف وثيقة ${target.docNumber} للزبون ${target.customerName}` : `Deleted document ${target.docNumber} for ${target.customerName}`)
          : 'Deleted commercial document'
      };

      return {
        ...prev,
        products: nextProds,
        customers: nextCusts,
        invoices: nextInvoices,
        commercialDocuments: nextDocs,
        deletedIds: nextDeletedIds,
        logs: [newLog, ...prev.logs].slice(0, 800)
      };
    }, false, true);
  };

  const handleCommercialDocConvertToInvoice = (_doc: CommercialDocument) => {
    // Official Factures (docType === 'facture') are now automatically synchronized
    // with sales invoices, inventory stock, and customer debt inside handleSaveCommercialDoc.
  };

  // State handlers

  const handleSaveExpense = (expense: Expense) => {
    updateDataState((prev) => {
      if (!prev) return prev;
      const prevExpenses = prev.expenses || [];
      const idx = prevExpenses.findIndex((e) => e.id === expense.id);
      let nextExpenses = [...prevExpenses];
      if (idx > -1) {
        nextExpenses[idx] = expense;
      } else {
        nextExpenses.unshift(expense);
      }

      const newLog: ActivityLog = {
        id: 'log_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        timestamp: new Date().toISOString(),
        userId: currentUser?.id || 'system',
        userName: currentUser?.name || 'System',
        action: 'expense_saved',
        details: lang === 'ar'
          ? `تم تسجيل مصروف: "${expense.title}" بقيمة ${expense.amount} ${prev.config.currency}`
          : `Recorded expense "${expense.title}" for ${expense.amount} ${prev.config.currency}`
      };

      return {
        ...prev,
        expenses: nextExpenses,
        logs: [newLog, ...prev.logs].slice(0, 800)
      };
    });
  };

  const handleDeleteExpense = (id: string) => {
    updateDataState((prev) => {
      if (!prev) return prev;
      const prevExpenses = prev.expenses || [];
      const target = prevExpenses.find((e) => e.id === id);
      const nextExpenses = prevExpenses.filter((e) => e.id !== id);
      const nextDeletedIds = addDeletedIds([...(prev.deletedIds || []), id]);

      const newLog: ActivityLog = {
        id: 'log_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        timestamp: new Date().toISOString(),
        userId: currentUser?.id || 'system',
        userName: currentUser?.name || 'System',
        action: 'expense_deleted',
        details: target 
          ? (lang === 'ar' ? `تم حذف المصروف: "${target.title}"` : `Deleted expense "${target.title}"`)
          : 'Deleted expense'
      };

      return {
        ...prev,
        expenses: nextExpenses,
        deletedIds: nextDeletedIds,
        logs: [newLog, ...prev.logs].slice(0, 800)
      };
    }, false, true);
  };

  const handleSaveSupplier = (supplier: Supplier) => {
    updateDataState((prev) => {
      if (!prev) return prev;
      const idx = prev.suppliers.findIndex((s) => s.id === supplier.id);
      let nextSupps = [...prev.suppliers];
      if (idx > -1) {
        nextSupps[idx] = supplier;
      } else {
        nextSupps.unshift(supplier);
      }
      return { ...prev, suppliers: nextSupps };
    });
  };

  const handleDeleteSupplier = (id: string) => {
    updateDataState((prev) => {
      if (!prev) return prev;
      const nextDeletedIds = addDeletedIds([...(prev.deletedIds || []), id]);
      return {
        ...prev,
        suppliers: prev.suppliers.filter((s) => s.id !== id),
        deletedIds: nextDeletedIds,
      };
    }, false, true);
  };

  const handleSavePurchase = (purchase: Purchase) => {
    updateDataState((prev) => {
      if (!prev) return prev;
      
      const debtAdjustment = purchase.total - purchase.amountPaid;
      
      const nextSupps = prev.suppliers.map((s) => {
        if (s.id === purchase.supplierId) {
          return { ...s, debt: (s.debt || 0) + debtAdjustment };
        }
        return s;
      });

      const nextProds = prev.products.map((p) => {
        const boughtItem = purchase.items.find((item) => item.productId === p.id);
        if (boughtItem) {
          const oldStock = p.stock || 0;
          const oldPrice = p.purchasePrice || 0;
          const boughtQty = boughtItem.quantity;
          const boughtPrice = boughtItem.purchasePrice;
          
          const newStock = oldStock + boughtQty;
          let newAvgPrice = oldPrice;
          if (newStock > 0) {
            newAvgPrice = ((oldStock * oldPrice) + (boughtQty * boughtPrice)) / newStock;
            newAvgPrice = Math.round(newAvgPrice * 100) / 100;
          }

          return { 
            ...p, 
            stock: newStock,
            purchasePrice: newAvgPrice
          };
        }
        return p;
      });

      // Maintain initial downpayment log if applicable
      const purchaseWithPaymentArray: Purchase = {
        ...purchase,
        payments: purchase.payments || (purchase.amountPaid > 0 ? [{
          id: 'pay_' + Date.now(),
          date: purchase.date,
          amount: purchase.amountPaid,
          notes: lang === 'ar' ? 'الدفعة الأولى المقدمة' : lang === 'fr' ? 'Acompte initial' : 'Initial down payment'
        }] : [])
      };

      const nextPurchases = [purchaseWithPaymentArray, ...prev.purchases];

      return {
        ...prev,
        suppliers: nextSupps,
        products: nextProds,
        purchases: nextPurchases,
      };
    });
  };

  const handleDeletePurchase = (id: string) => {
    updateDataState((prev) => {
      if (!prev) return prev;
      const targetPurchase = prev.purchases.find((p) => p.id === id);
      if (!targetPurchase) return prev;

      const debtToDeduct = targetPurchase.total - targetPurchase.amountPaid;
      
      const nextSupps = prev.suppliers.map((s) => {
        if (s.id === targetPurchase.supplierId) {
          return { ...s, debt: Math.max(0, (s.debt || 0) - debtToDeduct) };
        }
        return s;
      });

      const nextProds = prev.products.map((p) => {
        const boughtItem = targetPurchase.items.find((item) => item.productId === p.id);
        if (boughtItem) {
          const oldStock = p.stock || 0;
          const boughtQty = boughtItem.quantity;
          const boughtPrice = boughtItem.purchasePrice;
          
          const newStock = Math.max(0, oldStock - boughtQty);
          let revertedPrice = p.purchasePrice || 0;
          
          // Revert Weighted Average Cost if possible
          if (newStock > 0 && oldStock > boughtQty) {
            const originalTotalPrice = (oldStock * (p.purchasePrice || 0)) - (boughtQty * boughtPrice);
            revertedPrice = Math.max(0, originalTotalPrice / newStock);
            revertedPrice = Math.round(revertedPrice * 100) / 100;
          }

          return { 
            ...p, 
            stock: newStock,
            purchasePrice: revertedPrice
          };
        }
        return p;
      });

      const nextPurchases = prev.purchases.filter((p) => p.id !== id);
      const nextDeletedIds = addDeletedIds([...(prev.deletedIds || []), id]);

      const supplierObj = prev.suppliers.find(s => s.id === targetPurchase.supplierId);
      const supplierName = supplierObj ? supplierObj.name : (targetPurchase.supplierId || 'Unknown');

      const newLog: ActivityLog = {
        id: 'log_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        timestamp: new Date().toISOString(),
        userId: currentUser?.id || 'system',
        userName: currentUser?.name || 'System',
        action: 'purchase_deleted',
        details: lang === 'ar'
          ? `تم حذف فاتورة الشراء رقم ${targetPurchase.purchaseNumber || id} للمورد "${supplierName}". إجمالي الفاتورة: ${targetPurchase.total}`
          : `Deleted purchase invoice ${targetPurchase.purchaseNumber || id} from supplier "${supplierName}". Invoice Total was: ${targetPurchase.total}`
      };

      return {
        ...prev,
        suppliers: nextSupps,
        products: nextProds,
        purchases: nextPurchases,
        deletedIds: nextDeletedIds,
        logs: [newLog, ...prev.logs].slice(0, 800)
      };
    }, false, true);
  };

  const handleSettleSupplierDebt = (supplierId: string, amount: number, paymentNotes?: string) => {
    updateDataState((prev) => {
      if (!prev) return prev;
      
      let remainingPayment = amount;
      
      // Update supplier's overall debt
      const nextSupps = prev.suppliers.map((s) => {
        if (s.id === supplierId) {
          return { ...s, debt: Math.max(0, (s.debt || 0) - amount) };
        }
        return s;
      });

      // Distribute payment among this supplier's outstanding purchase bills (oldest first)
      const supplierPurchases = prev.purchases
        .filter((p) => p.supplierId === supplierId)
        .slice()
        .reverse(); // Make a copy and reverse to get oldest-first (since they are newest-first in the array)

      const updatedSuppPurchasesMap = new Map<string, Purchase>();

      for (const p of supplierPurchases) {
        if (remainingPayment <= 0) break;
        
        const unpaidForBill = p.total - p.amountPaid;
        if (unpaidForBill > 0) {
          const paymentForThisBill = Math.min(remainingPayment, unpaidForBill);
          remainingPayment -= paymentForThisBill;

          const newAmountPaid = p.amountPaid + paymentForThisBill;
          let newStatus: PaymentStatus = 'partial';
          if (newAmountPaid >= p.total) {
            newStatus = 'paid';
          }

          const newPaymentRecord = {
            id: 'pay_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
            date: new Date().toISOString(),
            amount: paymentForThisBill,
            notes: paymentNotes || (lang === 'ar' ? 'دفعة جزئية لتسوية الحساب' : lang === 'fr' ? 'Versement partiel' : 'Partial repayment installment')
          };

          const oldPaymentsArr = p.payments || [];
          updatedSuppPurchasesMap.set(p.id, {
            ...p,
            amountPaid: newAmountPaid,
            status: newStatus,
            payments: [...oldPaymentsArr, newPaymentRecord]
          });
        }
      }

      // Reassemble purchases
      const nextPurchases = prev.purchases.map((p) => {
        if (updatedSuppPurchasesMap.has(p.id)) {
          return updatedSuppPurchasesMap.get(p.id)!;
        }
        return p;
      });

      return {
        ...prev,
        suppliers: nextSupps,
        purchases: nextPurchases
      };
    });
  };

  const handleSaveProduct = (product: Product) => {
    updateDataState((prev) => {
      if (!prev) return prev;
      const idx = prev.products.findIndex((p) => p.id === product.id);
      let nextProds = [...prev.products];
      if (idx > -1) {
        nextProds[idx] = product;
      } else {
        nextProds.unshift(product);
      }
      return { ...prev, products: nextProds };
    });
  };

  const handleDeleteProduct = (id: string) => {
    updateDataState((prev) => {
      if (!prev) return prev;
      const nextDeletedIds = addDeletedIds([...(prev.deletedIds || []), id]);
      return {
        ...prev,
        products: prev.products.filter((p) => p.id !== id),
        deletedIds: nextDeletedIds,
      };
    }, false, true);
  };

  const handleSaveCustomer = (customer: Customer) => {
    updateDataState((prev) => {
      if (!prev) return prev;
      const idx = prev.customers.findIndex((c) => c.id === customer.id);
      let nextCusts = [...prev.customers];
      if (idx > -1) {
        nextCusts[idx] = customer;
      } else {
        nextCusts.unshift(customer);
      }
      return { ...prev, customers: nextCusts };
    });
  };

  const handleDeleteCustomer = (id: string) => {
    updateDataState((prev) => {
      if (!prev) return prev;
      const nextDeletedIds = addDeletedIds([...(prev.deletedIds || []), id]);
      return {
        ...prev,
        customers: prev.customers.filter((c) => c.id !== id),
        deletedIds: nextDeletedIds,
      };
    }, false, true);
  };

  const handleDeleteInvoice = (id: string) => {
    updateDataState((prev) => {
      if (!prev) return prev;
      const targetInvoice = prev.invoices.find((inv) => inv.id === id);
      if (!targetInvoice) return prev;

      // 1. Revert product stocks (add back quantities sold across all matching rows)
      const restoredProds = prev.products.map((p) => {
        const soldQty = (targetInvoice.items || [])
          .filter((it) => it.productId === p.id)
          .reduce((sum, it) => sum + Number(it.quantity || 0), 0);
        if (soldQty > 0) {
          return { ...p, stock: p.stock + soldQty };
        }
        return p;
      });

      // 2. Revert client profile debt balance (subtract invoice outstanding debt credit value)
      const restoredCusts = prev.customers.map((c) => {
        if (c.id === targetInvoice.customerId) {
          const unpaidRemainder = Number(targetInvoice.total || 0) - Number(targetInvoice.amountPaid || 0);
          if (unpaidRemainder > 0) {
            return { ...c, debt: Math.max(0, c.debt - unpaidRemainder) };
          }
        }
        return c;
      });

      // 3. Also remove linked official Facture in commercialDocuments if this invoice originated from one
      const idsToDelete: string[] = [id];
      const nextCommercialDocs = (prev.commercialDocuments || []).filter((d) => {
        const isLinked =
          d.docType === 'facture' &&
          ('inv_doc_' + d.id === targetInvoice.id || d.docNumber === targetInvoice.invoiceNumber);
        if (isLinked) {
          idsToDelete.push(d.id, 'inv_doc_' + d.id);
        }
        return !isLinked;
      });

      const nextDeletedIds = addDeletedIds([...(prev.deletedIds || []), ...idsToDelete]);

      // 4. Atomically add System Log in appropriate language
      const newLog: ActivityLog = {
        id: 'log_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        timestamp: new Date().toISOString(),
        userId: currentUser?.id || 'system',
        userName: currentUser?.name || 'System',
        action: 'invoice_deleted',
        details: lang === 'ar'
          ? `تم حذف فاتورة المبيعات رقم ${targetInvoice.invoiceNumber} للزبون "${targetInvoice.customerName}". إجمالي الفاتورة: ${targetInvoice.total} ${prev.config.currency}`
          : `Deleted sales invoice ${targetInvoice.invoiceNumber} for customer "${targetInvoice.customerName}". Total was: ${targetInvoice.total} ${prev.config.currency}`
      };

      const nextInvoices = prev.invoices.filter((inv) => inv.id !== id);

      return {
        ...prev,
        invoices: nextInvoices,
        commercialDocuments: nextCommercialDocs,
        products: restoredProds,
        customers: restoredCusts,
        deletedIds: nextDeletedIds,
        logs: [newLog, ...prev.logs].slice(0, 800)
      };
    }, false, true);
  };

  const handleEditInvoice = (updatedInvoice: Invoice) => {
    updateDataState((prev) => {
      if (!prev) return prev;
      const oldInvoice = prev.invoices.find((inv) => inv.id === updatedInvoice.id);
      if (!oldInvoice) return prev;

      let nextProds = [...prev.products];
      let nextCusts = [...prev.customers];

      // 1. Revert old stock deductions
      (oldInvoice.items || []).forEach((oldIt) => {
        if (oldIt.productId) {
          nextProds = nextProds.map((p) =>
            p.id === oldIt.productId ? { ...p, stock: p.stock + Number(oldIt.quantity || 0) } : p
          );
        }
      });

      // 2. Revert old customer debt
      const oldUnpaid = Math.max(0, Number(oldInvoice.total || 0) - Number(oldInvoice.amountPaid || 0));
      if (oldUnpaid > 0 && oldInvoice.customerId && oldInvoice.customerId !== 'walk-in') {
        nextCusts = nextCusts.map((c) =>
          c.id === oldInvoice.customerId ? { ...c, debt: Math.max(0, c.debt - oldUnpaid) } : c
        );
      }

      // 3. Apply new stock deductions
      (updatedInvoice.items || []).forEach((newIt) => {
        if (newIt.productId) {
          nextProds = nextProds.map((p) =>
            p.id === newIt.productId ? { ...p, stock: p.stock - Number(newIt.quantity || 0) } : p
          );
        }
      });

      // 4. Apply new customer debt
      const newUnpaid = Math.max(0, Number(updatedInvoice.total || 0) - Number(updatedInvoice.amountPaid || 0));
      if (newUnpaid > 0 && updatedInvoice.customerId && updatedInvoice.customerId !== 'walk-in') {
        nextCusts = nextCusts.map((c) =>
          c.id === updatedInvoice.customerId ? { ...c, debt: c.debt + newUnpaid } : c
        );
      }

      // 5. Update invoices list
      const nextInvoices = prev.invoices.map((inv) =>
        inv.id === updatedInvoice.id ? updatedInvoice : inv
      );

      // 6. Sync linked official Facture in commercialDocuments if applicable
      const nextCommercialDocs = (prev.commercialDocuments || []).map((d) => {
        const isLinked =
          d.docType === 'facture' &&
          ('inv_doc_' + d.id === updatedInvoice.id || d.docNumber === updatedInvoice.invoiceNumber);
        if (isLinked) {
          return {
            ...d,
            date: updatedInvoice.date,
            customerId: updatedInvoice.customerId,
            customerName: updatedInvoice.customerName,
            items: updatedInvoice.items,
            subtotal: updatedInvoice.subtotal,
            discount: updatedInvoice.discount,
            tax: updatedInvoice.tax,
            total: updatedInvoice.total,
            amountPaid: updatedInvoice.amountPaid,
            previousBalance: updatedInvoice.previousBalance,
            paymentMethod: updatedInvoice.paymentMethod,
            notes: updatedInvoice.notes,
          };
        }
        return d;
      });

      const newLog: ActivityLog = {
        id: 'log_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        timestamp: new Date().toISOString(),
        userId: currentUser?.id || 'system',
        userName: currentUser?.name || 'System',
        action: 'invoice_updated',
        details: lang === 'ar'
          ? `تم تعديل فاتورة المبيعات رقم ${updatedInvoice.invoiceNumber} للزبون "${updatedInvoice.customerName}" - الإجمالي الجديد: ${updatedInvoice.total.toFixed(2)} ${prev.config.currency}`
          : `Updated sales invoice ${updatedInvoice.invoiceNumber} for "${updatedInvoice.customerName}" - New Total: ${updatedInvoice.total.toFixed(2)} ${prev.config.currency}`
      };

      return {
        ...prev,
        invoices: nextInvoices,
        commercialDocuments: nextCommercialDocs,
        products: nextProds,
        customers: nextCusts,
        logs: [newLog, ...prev.logs].slice(0, 800)
      };
    });
  };

  // Repay customer debt ledger balance and distribute chronologically to outstanding invoices
  const handleSettleDebt = (customerId: string, amount: number) => {
    updateDataState((prev) => {
      if (!prev) return prev;

      // 1. Update customer's overall debt
      const updatedCusts = prev.customers.map((c) => {
        if (c.id === customerId) {
          return { ...c, debt: Math.max(0, c.debt - amount) };
        }
        return c;
      });

      // 2. Identify candidate invoices for this customer that are currently unpaid or partially paid
      const candidateInvoices = prev.invoices
        .filter((inv) => inv.customerId === customerId && (inv.status === 'unpaid' || inv.status === 'partial' || inv.total > inv.amountPaid))
        .sort((a, b) => {
          const tA = a.date ? new Date(a.date).getTime() : 0;
          const tB = b.date ? new Date(b.date).getTime() : 0;
          return tA - tB;
        });

      // 3. Chronologically distribute payment across these candidate invoices
      let remainingPayment = amount;
      const updatedInvs = prev.invoices.map((inv) => {
        const isCandidate = candidateInvoices.some((cand) => cand.id === inv.id);
        if (isCandidate && remainingPayment > 0) {
          const unpaidForInv = inv.total - inv.amountPaid;
          if (unpaidForInv > 0) {
            const paymentForThisInv = Math.min(remainingPayment, unpaidForInv);
            remainingPayment -= paymentForThisInv;
            const newAmountPaid = inv.amountPaid + paymentForThisInv;
            const remains = inv.total - newAmountPaid;
            return {
              ...inv,
              amountPaid: newAmountPaid,
              status: (remains <= 0.01 ? 'paid' : 'partial') as PaymentStatus
            };
          }
        }
        return inv;
      });

      // 4. Record permanent CustomerPayment and audit log
      const targetCustomer = prev.customers.find((c) => c.id === customerId);
      const newPayment: CustomerPayment = {
        id: 'pay_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        customerId,
        customerName: targetCustomer?.name || 'Customer',
        amount,
        date: new Date().toISOString(),
        notes: lang === 'ar' ? `تسوية دفعة ديون بقيمة ${amount} ${prev.config.currency}` : `Debt payment of ${amount} ${prev.config.currency}`,
        receivedByName: currentUser?.name || 'System'
      };
      const nextCustomerPayments = [newPayment, ...(prev.customerPayments || [])];

      const newLog: ActivityLog = {
        id: 'log_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        timestamp: new Date().toISOString(),
        userId: currentUser?.id || 'system',
        userName: currentUser?.name || 'System',
        action: 'customer_debt_settled',
        details: lang === 'ar'
          ? `تم تسوية دفعة ديون بقيمة ${amount} ${prev.config.currency} للزبون "${targetCustomer?.name || 'غير معروف'}".`
          : `Settled a debt payment of ${amount} ${prev.config.currency} for customer "${targetCustomer?.name || 'Unknown'}".`
      };

      return {
        ...prev,
        customers: updatedCusts,
        invoices: updatedInvs,
        customerPayments: nextCustomerPayments,
        logs: [newLog, ...prev.logs].slice(0, 800)
      };
    });
  };

  // Settle outstanding partial bill balance
  const handlePayInvoiceBalance = (invoiceId: string, amountPaid: number) => {
    updateDataState((prev) => {
      if (!prev) return prev;
      
      const invIdx = prev.invoices.findIndex((inv) => inv.id === invoiceId);
      if (invIdx === -1) return prev;

      const updatedInvs = [...prev.invoices];
      const targetInv = updatedInvs[invIdx];
      const newPaidVal = targetInv.amountPaid + amountPaid;
      const remains = targetInv.total - newPaidVal;
      
      updatedInvs[invIdx] = {
        ...targetInv,
        amountPaid: newPaidVal,
        status: remains <= 0.01 ? 'paid' : 'partial',
      };

      // Also reduce client corresponding debt
      const updatedCusts = prev.customers.map((c) => {
        if (c.id === targetInv.customerId) {
          return { ...c, debt: Math.max(0, c.debt - amountPaid) };
        }
        return c;
      });

      // Sync amountPaid on linked CommercialDocument if applicable
      const updatedCommercialDocs = (prev.commercialDocuments || []).map((d) => {
        if (
          d.docType === 'facture' &&
          ('inv_doc_' + d.id === targetInv.id || d.docNumber === targetInv.invoiceNumber)
        ) {
          return { ...d, amountPaid: newPaidVal };
        }
        return d;
      });

      return {
        ...prev,
        invoices: updatedInvs,
        commercialDocuments: updatedCommercialDocs,
        customers: updatedCusts,
      };
    });
  };

  // Return items from an invoice (Sales Return / رجوع المبيعات)
  const handleReturnInvoiceItems = (
    invoiceId: string, 
    returnList: { productId: string; quantity: number; unitPrice: number }[],
    notes?: string
  ) => {
    updateDataState((prev) => {
      if (!prev) return prev;
      const targetInvoice = prev.invoices.find((inv) => inv.id === invoiceId);
      if (!targetInvoice) return prev;

      // 1. Calculate return total
      const returnTotal = returnList.reduce((acc, it) => acc + (it.unitPrice * it.quantity), 0);

      // 2. Increment stock back for each returned item
      const updatedProds = prev.products.map((p) => {
        const retItem = returnList.find((it) => it.productId === p.id);
        if (retItem) {
          return { ...p, stock: p.stock + retItem.quantity };
        }
        return p;
      });

      // 3. Adjust customer balance if debt exists
      const updatedCusts = prev.customers.map((c) => {
        if (c.id === targetInvoice.customerId) {
          const unpaidForInv = targetInvoice.total - targetInvoice.amountPaid;
          if (unpaidForInv > 0) {
            const debtDeduction = Math.min(unpaidForInv, returnTotal);
            return { ...c, debt: Math.max(0, c.debt - debtDeduction) };
          }
        }
        return c;
      });

      // 4. Construct return records
      const newReturnRecords: InvoiceReturnItem[] = returnList.map((it) => {
        const itemObj = targetInvoice.items.find((i) => i.productId === it.productId);
        return {
          productId: it.productId,
          productName: itemObj ? itemObj.productName : it.productId,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          refundAmount: it.unitPrice * it.quantity,
          date: new Date().toISOString(),
          notes: notes || (lang === 'ar' ? 'إرجاع مبيعات' : 'Sales return')
        };
      });

      const existingReturns = targetInvoice.returnedItems || [];
      const combinedReturns = [...existingReturns, ...newReturnRecords];

      // Check if all items in invoice are now fully returned
      const totalSoldQty = targetInvoice.items.reduce((sum, it) => sum + it.quantity, 0);
      const totalReturnedQty = combinedReturns.reduce((sum, it) => sum + it.quantity, 0);
      const newStatus = totalReturnedQty >= totalSoldQty ? 'refunded' : targetInvoice.status;

      const updatedInvoice: Invoice = {
        ...targetInvoice,
        status: newStatus as Invoice['status'],
        returnedItems: combinedReturns,
        notes: targetInvoice.notes 
          ? `${targetInvoice.notes} | [${lang === 'ar' ? 'مرتجع بقيمة' : 'Return'}: ${returnTotal.toFixed(2)} ${prev.config.currency}]`
          : `[${lang === 'ar' ? 'مرتجع بقيمة' : 'Return'}: ${returnTotal.toFixed(2)} ${prev.config.currency}]`
      };

      const updatedInvoices = prev.invoices.map((inv) => inv.id === invoiceId ? updatedInvoice : inv);

      // 5. Add audit log
      const newLog: ActivityLog = {
        id: 'log_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        timestamp: new Date().toISOString(),
        userId: currentUser?.id || 'system',
        userName: currentUser?.name || 'System',
        action: 'sale_return',
        details: lang === 'ar'
          ? `إرجاع مبيعات من الفاتورة رقم ${targetInvoice.invoiceNumber} للزبون "${targetInvoice.customerName}" بقيمة ${returnTotal.toFixed(2)} ${prev.config.currency}`
          : `Sales return for invoice ${targetInvoice.invoiceNumber} (${targetInvoice.customerName}) worth ${returnTotal.toFixed(2)} ${prev.config.currency}`
      };

      return {
        ...prev,
        invoices: updatedInvoices,
        products: updatedProds,
        customers: updatedCusts,
        logs: [newLog, ...prev.logs].slice(0, 800)
      };
    });
  };

  // Add POS Invoiced sale transaction
  const handleAddTransaction = (invoice: Invoice) => {
    updateDataState((prev) => {
      if (!prev) return prev;

      // Stamp cashier on receipt
      const sellerInvoice: Invoice = {
        ...invoice,
        sellerId: invoice.sellerId || currentUser?.id,
        sellerName: invoice.sellerName || currentUser?.name
      };

      // 1. Reduce corresponding stock count
      const updatedProds = prev.products.map((p) => {
        const itemInInvoice = sellerInvoice.items.find((it) => it.productId === p.id);
        if (itemInInvoice) {
          return { ...p, stock: p.stock - itemInInvoice.quantity };
        }
        return p;
      });

      // 2. Increment client profile debt balance if paid deferred 'debt' mode or incomplete payment
      const updatedCusts = prev.customers.map((c) => {
        if (c.id === sellerInvoice.customerId) {
          const unpaidRemainder = sellerInvoice.total - sellerInvoice.amountPaid;
          if (unpaidRemainder > 0) {
            return { ...c, debt: c.debt + unpaidRemainder };
          }
        }
        return c;
      });

      // 3. Atomically add System Log
      const newLog: ActivityLog = {
        id: 'log_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        timestamp: new Date().toISOString(),
        userId: currentUser?.id || 'system',
        userName: currentUser?.name || 'System',
        action: 'sale_created',
        details: `Created invoice ${sellerInvoice.invoiceNumber} for ${sellerInvoice.customerName} - Total: ${sellerInvoice.total} ${prev.config.currency}`
      };

      return {
        ...prev,
        invoices: [sellerInvoice, ...prev.invoices],
        products: updatedProds,
        customers: updatedCusts,
        logs: [newLog, ...prev.logs].slice(0, 800)
      };
    });
  };

  const handleSaveConfig = (storeConfig: StoreConfig) => {
    updateDataState((prev) => {
      if (!prev) return prev;
      return { ...prev, config: storeConfig };
    });
    // Immediately push updated general settings to cloud so iPhone gets the update right away
    const cloudCfg = getCloudSyncConfig();
    if (cloudCfg.enabled) {
      setTimeout(() => {
        const currentData = getStoredData();
        pushDataToCloud({ ...currentData, config: storeConfig }, cloudCfg, { skipPreMerge: false }).catch(() => {});
      }, 60);
    }
  };

  const handleImportBackup = (imported: typeof data) => {
    setData(imported);
    saveStoredData(imported);
    const cloudCfg = getCloudSyncConfig();
    const apiBase = cloudCfg.provider === 'server' && cloudCfg.serverUrl ? cloudCfg.serverUrl.replace(/\/+$/, '') : '';
    fetch(`${apiBase}/api/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(imported),
    }).catch(() => {});
    if (cloudCfg.enabled) {
      pushDataToCloud(imported, cloudCfg, { skipPreMerge: true }).catch(() => {});
    }
  };

  const handleResetDatabase = async () => {
    const zeroData = await resetStoredToDefaults();
    setData(zeroData);
    saveStoredData(zeroData);

    const cloudCfg = getCloudSyncConfig();
    const apiBase = cloudCfg.provider === 'server' && cloudCfg.serverUrl ? cloudCfg.serverUrl.replace(/\/+$/, '') : '';

    if (apiBase) {
      try {
        await fetch(`${apiBase}/api/reset`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(zeroData),
        });
      } catch {
        fetch(`${apiBase}/api/save`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(zeroData),
        }).catch(() => {});
      }
    }

    if (cloudCfg.enabled || cloudCfg.firebaseUrl || cloudCfg.supabaseUrl) {
      try {
        await pushDataToCloud(zeroData, cloudCfg, { skipPreMerge: true });
      } catch (e) {
        console.warn('Cloud reset sync warning:', e);
      }
    }

    setSyncNotice(
      lang === 'ar'
        ? '✓ تمت فرمتة النظام وتصفير قاعدة البيانات بالكامل بنجاح!'
        : '✓ Database formatted and reset to zero successfully!'
    );
    setTimeout(() => setSyncNotice(null), 4500);
  };

  const handleExportBackup = async () => {
    if (!data) return;
    const filename = `SmartPos-Backup-${new Date().toISOString().slice(0, 10)}.json`;
    const result = await exportDatabaseBackupFile(JSON.stringify(data, null, 2), filename);
    if (result !== 'error') {
      setSyncNotice(
        lang === 'ar'
          ? '✓ تم تجهيز وحفظ نسخة قاعدة البيانات بنجاح'
          : '✓ Database backup saved successfully'
      );
      setTimeout(() => setSyncNotice(null), 3500);
    }
  };

  const activeTheme = (!config.themeColor || config.themeColor === 'slate' || config.themeColor === 'navy') ? 'indigo' : config.themeColor;
  const themeClass = `theme-${activeTheme}`;

  const getSidebarStatusTheme = (theme?: string) => {
    switch (theme) {
      case 'sky':
        return {
          badge: 'bg-sky-500/20 text-sky-300 border-sky-500/30',
          dot: 'bg-sky-400'
        };
      case 'emerald':
        return {
          badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
          dot: 'bg-emerald-400'
        };
      case 'rose':
        return {
          badge: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
          dot: 'bg-rose-400'
        };
      case 'amber':
        return {
          badge: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
          dot: 'bg-amber-400'
        };
      case 'purple':
      case 'indigo':
      default:
        return {
          badge: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
          dot: 'bg-indigo-400'
        };
    }
  };
  const statusTheme = getSidebarStatusTheme(activeTheme);

  return (
    <div
      dir={isRTL ? 'rtl' : 'ltr'}
      className={`flex h-screen w-full font-sans overflow-hidden antialiased select-none bg-slate-100 text-slate-800 ${themeClass}`}
      id="root-viewport-wrap"
    >
      {/* Floating Sync Notice Toast */}
      {syncNotice && (
        <div
          dir={isRTL ? 'rtl' : 'ltr'}
          className="fixed inset-x-0 z-[150] flex justify-center px-3 sm:px-6 pointer-events-none"
          style={{ top: 'max(3.5rem, calc(env(safe-area-inset-top, 0px) + 3rem))' }}
        >
          <div className="pointer-events-auto w-full max-w-md px-4 py-3 rounded-2xl bg-emerald-950/95 text-emerald-100 border border-emerald-500/50 shadow-2xl text-xs sm:text-sm font-bold leading-relaxed flex items-start gap-2.5">
            <Cloud className="w-4.5 h-4.5 text-emerald-400 shrink-0 mt-0.5" />
            <span className="flex-1 break-words text-start">{syncNotice}</span>
            <button
              type="button"
              onClick={() => setSyncNotice(null)}
              className="text-white/60 hover:text-white font-black text-xs px-1 cursor-pointer shrink-0"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Mobile Drawer Backdrop Overlay (< lg) */}
      {isMobileMenuOpen && (
        <div
          onClick={() => setIsMobileMenuOpen(false)}
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-40 lg:hidden animate-fade-in"
        />
      )}

      {/* Sidebar - Pinned on Desktop (lg+), Slide-over Drawer on Android & iPhone (< lg) */}
      <aside
        id="app-sidebar-panel"
        style={{
          paddingTop: 'env(safe-area-inset-top, 0px)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)'
        }}
        className={`w-64 bg-slate-900 text-white flex flex-col shrink-0 ltr:border-r rtl:border-l border-slate-800 z-50 lg:z-30 fixed lg:static inset-y-0 ${
          isRTL ? 'right-0' : 'left-0'
        } transition-transform duration-200 ease-in-out select-none ${
          isMobileMenuOpen
            ? 'translate-x-0 shadow-2xl'
            : isRTL
            ? 'translate-x-full lg:translate-x-0'
            : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="p-3.5 flex items-center justify-between gap-3 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <img
              src={config.logoUrl || '/sp-icon.png'}
              alt={config.name}
              className="w-10 h-10 rounded-xl object-contain bg-white p-0.5 shrink-0 shadow-md border border-indigo-400/30"
            />
            <div className="min-w-0 flex-1">
              <span className="font-black text-white tracking-tight block truncate text-sm uppercase text-start">
                {config.name}
              </span>
              <span className="text-[10px] text-slate-400 font-semibold block truncate text-start">
                {config.registrationNumber ? `VAT: ${config.registrationNumber}` : 'Smart POS Pro'}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(false)}
            className="lg:hidden p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Sidebar Nav links */}
        <nav className="flex-1 py-2.5 overflow-y-auto space-y-1 px-2 no-scrollbar">
          <div className="px-3 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider text-start">
            {isRTL ? 'لوحة التحكم' : 'Main Console'}
          </div>

          {/* 1. Home Tab (الرئيسية) */}
          {currentUser.allowedTabs.includes('home') && (
            <button
              id="sidebar-tab-home"
              onClick={() => selectTab('home')}
              className={`w-full flex items-center px-3 py-2 rounded-lg text-[13px] font-medium transition-all cursor-pointer text-start ${
                activeTab === 'home'
                  ? 'text-white font-bold bg-white/[0.08] rounded-lg'
                  : 'text-slate-300 hover:text-white hover:bg-white/[0.04] rounded-lg'
              }`}
            >
              <SmartHome className="w-4.5 h-4.5 mr-2.5 rtl:mr-0 rtl:ml-2.5 shrink-0 opacity-90" />
              <span className="truncate">{t.nav.home}</span>
            </button>
          )}

          {/* 2. POS Tab (نقطة البيع) */}
          {currentUser.allowedTabs.includes('pos') && (
            <button
              id="sidebar-tab-pos"
              onClick={() => selectTab('pos')}
              className={`w-full flex items-center px-3 py-2 rounded-lg text-[13px] font-medium transition-all cursor-pointer text-start ${
                activeTab === 'pos'
                  ? 'text-white font-bold bg-white/[0.08] rounded-lg'
                  : 'text-slate-300 hover:text-white hover:bg-white/[0.04] rounded-lg'
              }`}
            >
              <ShoppingCart className="w-4.5 h-4.5 mr-2.5 rtl:mr-0 rtl:ml-2.5 shrink-0 opacity-90" />
              <span className="truncate">{t.nav.pos}</span>
            </button>
          )}

          {/* 3. Invoices Tab (ادارة فواتير المبيعات) */}
          {currentUser.allowedTabs.includes('invoices') && (
            <button
              id="sidebar-tab-invoices"
              onClick={() => selectTab('invoices')}
              className={`w-full flex items-center px-3 py-2 rounded-lg text-[13px] font-medium transition-all cursor-pointer text-start ${
                activeTab === 'invoices'
                  ? 'text-white font-bold bg-white/[0.08] rounded-lg'
                  : 'text-slate-300 hover:text-white hover:bg-white/[0.04] rounded-lg'
              }`}
            >
              <Receipt className="w-4.5 h-4.5 mr-2.5 rtl:mr-0 rtl:ml-2.5 shrink-0 opacity-90" />
              <span className="truncate">{t.nav.invoices}</span>
            </button>
          )}

          {/* 4. Commercial Documents Tab (ادارة الوثائق التجارية) */}
          {(currentUser.allowedTabs.includes('commercial-documents') || currentUser.allowedTabs.includes('devis') || currentUser.allowedTabs.includes('bon-commande') || currentUser.allowedTabs.includes('bon-livraison')) && (
            <button
              id="sidebar-tab-commercial-documents"
              onClick={() => selectTab('commercial-documents')}
              className={`w-full flex items-center px-3 py-2 rounded-lg text-[13px] font-medium transition-all cursor-pointer text-start ${
                activeTab === 'commercial-documents' || activeTab === 'devis' || activeTab === 'bon-commande' || activeTab === 'bon-livraison'
                  ? 'text-white font-bold bg-white/[0.08] rounded-lg'
                  : 'text-slate-300 hover:text-white hover:bg-white/[0.04] rounded-lg'
              }`}
            >
              <FileSpreadsheet className="w-4.5 h-4.5 mr-2.5 rtl:mr-0 rtl:ml-2.5 shrink-0 opacity-90" />
              <span className="truncate">{t.nav.commercialDocuments}</span>
            </button>
          )}

          {/* 5. Customers Tab (سجل الزبناء والديون) */}
          {currentUser.allowedTabs.includes('customers') && (
            <button
              id="sidebar-tab-customers"
              onClick={() => selectTab('customers')}
              className={`w-full flex items-center px-3 py-2 rounded-lg text-[13px] font-medium transition-all cursor-pointer text-start ${
                activeTab === 'customers'
                  ? 'text-white font-bold bg-white/[0.08] rounded-lg'
                  : 'text-slate-300 hover:text-white hover:bg-white/[0.04] rounded-lg'
              }`}
            >
              <Users className="w-4.5 h-4.5 mr-2.5 rtl:mr-0 rtl:ml-2.5 shrink-0 opacity-90" />
              <span className="truncate">{t.nav.customers}</span>
            </button>
          )}

          {/* 6. Inventory Tab (ادارة المخزن) */}
          {currentUser.allowedTabs.includes('inventory') && (
            <button
              id="sidebar-tab-inventory"
              onClick={() => selectTab('inventory')}
              className={`w-full flex items-center px-3 py-2 rounded-lg text-[13px] font-medium transition-all cursor-pointer text-start ${
                activeTab === 'inventory'
                  ? 'text-white font-bold bg-white/[0.08] rounded-lg'
                  : 'text-slate-300 hover:text-white hover:bg-white/[0.04] rounded-lg'
              }`}
            >
              <Package className="w-4.5 h-4.5 mr-2.5 rtl:mr-0 rtl:ml-2.5 shrink-0 opacity-90" />
              <span className="truncate">{t.nav.inventory}</span>
            </button>
          )}

          {/* 7. Purchase Entry Tab (فاتورة مشتريات) */}
          {currentUser.allowedTabs.includes('purchase-entry') && (
            <button
              id="sidebar-tab-purchase-entry"
              onClick={() => selectTab('purchase-entry')}
              className={`w-full flex items-center px-3 py-2 rounded-lg text-[13px] font-medium transition-all cursor-pointer text-start ${
                activeTab === 'purchase-entry'
                  ? 'text-white font-bold bg-white/[0.08] rounded-lg'
                  : 'text-slate-300 hover:text-white hover:bg-white/[0.04] rounded-lg'
              }`}
            >
              <ShoppingBag className="w-4.5 h-4.5 mr-2.5 rtl:mr-0 rtl:ml-2.5 shrink-0 opacity-90" />
              <span className="truncate">{t.nav.purchaseEntry}</span>
            </button>
          )}

          {/* 8. Purchases Management Tab (ادارة فواتير المشتريات والديون) */}
          {currentUser.allowedTabs.includes('purchases') && (
            <button
              id="sidebar-tab-purchases"
              onClick={() => selectTab('purchases')}
              className={`w-full flex items-center px-3 py-2 rounded-lg text-[13px] font-medium transition-all cursor-pointer text-start ${
                activeTab === 'purchases'
                  ? 'text-white font-bold bg-white/[0.08] rounded-lg'
                  : 'text-slate-300 hover:text-white hover:bg-white/[0.04] rounded-lg'
              }`}
            >
              <ClipboardList className="w-4.5 h-4.5 mr-2.5 rtl:mr-0 rtl:ml-2.5 shrink-0 opacity-90" />
              <span className="truncate">{t.nav.purchases}</span>
            </button>
          )}

          {/* 9. Suppliers Tab (سجل الموردين) */}
          {currentUser.allowedTabs.includes('suppliers') && (
            <button
              id="sidebar-tab-suppliers"
              onClick={() => selectTab('suppliers')}
              className={`w-full flex items-center px-3 py-2 rounded-lg text-[13px] font-medium transition-all cursor-pointer text-start ${
                activeTab === 'suppliers'
                  ? 'text-white font-bold bg-white/[0.08] rounded-lg'
                  : 'text-slate-300 hover:text-white hover:bg-white/[0.04] rounded-lg'
              }`}
            >
              <Truck className="w-4.5 h-4.5 mr-2.5 rtl:mr-0 rtl:ml-2.5 shrink-0 opacity-90" />
              <span className="truncate">{t.nav.suppliers}</span>
            </button>
          )}

          {/* 10. Reports Tab (التقارير والاحصائيات) */}
          {currentUser.allowedTabs.includes('reports') && (
            <button
              id="sidebar-tab-reports"
              onClick={() => selectTab('reports')}
              className={`w-full flex items-center px-3 py-2 rounded-lg text-[13px] font-medium transition-all cursor-pointer text-start ${
                activeTab === 'reports'
                  ? 'text-white font-bold bg-white/[0.08] rounded-lg'
                  : 'text-slate-300 hover:text-white hover:bg-white/[0.04] rounded-lg'
              }`}
            >
              <LayoutDashboard className="w-4.5 h-4.5 mr-2.5 rtl:mr-0 rtl:ml-2.5 shrink-0 opacity-90" />
              <span className="truncate">{t.nav.reports}</span>
            </button>
          )}

          {/* 11. Expenses Tab (ادارة المصاريف اليومية) */}
          {currentUser.allowedTabs.includes('expenses') && (
            <button
              id="sidebar-tab-expenses"
              onClick={() => selectTab('expenses')}
              className={`w-full flex items-center px-3 py-2 rounded-lg text-[13px] font-medium transition-all cursor-pointer text-start ${
                activeTab === 'expenses'
                  ? 'text-white font-bold bg-white/[0.08] rounded-lg'
                  : 'text-slate-300 hover:text-white hover:bg-white/[0.04] rounded-lg'
              }`}
            >
              <ReceiptText className="w-4.5 h-4.5 mr-2.5 rtl:mr-0 rtl:ml-2.5 shrink-0 opacity-90" />
              <span className="truncate">{t.nav.expenses}</span>
            </button>
          )}

          {/* 12. Settings Tab (الاعدادات العامة) */}
          {currentUser.allowedTabs.includes('settings') && (
            <button
              id="sidebar-tab-settings"
              onClick={() => selectTab('settings')}
              className={`w-full flex items-center px-3 py-2 rounded-lg text-[13px] font-medium transition-all cursor-pointer text-start ${
                activeTab === 'settings'
                  ? 'text-white font-bold bg-white/[0.08] rounded-lg'
                  : 'text-slate-300 hover:text-white hover:bg-white/[0.04] rounded-lg'
              }`}
            >
              <SettingsIcon className="w-4.5 h-4.5 mr-2.5 rtl:mr-0 rtl:ml-2.5 shrink-0 opacity-90" />
              <span className="truncate">{t.nav.settings}</span>
            </button>
          )}

          {/* 13. Users Tab (المستخدمين والصلاحيات) */}
          {currentUser.allowedTabs.includes('users') && (
            <button
              id="sidebar-tab-users"
              onClick={() => selectTab('users')}
              className={`w-full flex items-center px-3 py-2 rounded-lg text-[13px] font-medium transition-all cursor-pointer text-start ${
                activeTab === 'users'
                  ? 'text-white font-bold bg-white/[0.08] rounded-lg'
                  : 'text-slate-300 hover:text-white hover:bg-white/[0.04] rounded-lg'
              }`}
            >
              <Shield className="w-4.5 h-4.5 mr-2.5 rtl:mr-0 rtl:ml-2.5 shrink-0 opacity-90" />
              <span className="truncate">{t.nav.users}</span>
            </button>
          )}

          {/* 14. Backup & Data Management Tab (ادارة البيانات والنسخ الاحتياطية) */}
          {(currentUser.allowedTabs.includes('backup') || currentUser.allowedTabs.includes('settings')) && (
            <button
              id="sidebar-tab-backup"
              onClick={() => selectTab('backup')}
              className={`w-full flex items-center px-3 py-2 rounded-lg text-[13px] font-medium transition-all cursor-pointer text-start ${
                activeTab === 'backup'
                  ? 'text-white font-bold bg-white/[0.08] rounded-lg'
                  : 'text-slate-300 hover:text-white hover:bg-white/[0.04] rounded-lg'
              }`}
            >
              <Database className="w-4.5 h-4.5 mr-2.5 rtl:mr-0 rtl:ml-2.5 shrink-0 opacity-90" />
              <span className="truncate">{t.nav.backup}</span>
            </button>
          )}

          {/* 15. System Logs Tab (سجل العمليات والانشطة) */}
          {currentUser.allowedTabs.includes('logs') && (
            <button
              id="sidebar-tab-logs"
              onClick={() => selectTab('logs')}
              className={`w-full flex items-center px-3 py-2 rounded-lg text-[13px] font-medium transition-all cursor-pointer text-start ${
                activeTab === 'logs'
                  ? 'text-white font-bold bg-white/[0.08] rounded-lg'
                  : 'text-slate-300 hover:text-white hover:bg-white/[0.04] rounded-lg'
              }`}
            >
              <ClipboardList className="w-4.5 h-4.5 mr-2.5 rtl:mr-0 rtl:ml-2.5 shrink-0 opacity-90" />
              <span className="truncate">{t.nav.logs}</span>
            </button>
          )}

          {/* 16. Repairs Tab (قسم الصيانة والاصلاحان) */}
          {currentUser.allowedTabs.includes('repairs') && (
            <button
              id="sidebar-tab-repairs"
              onClick={() => selectTab('repairs')}
              className={`w-full flex items-center px-3 py-2 rounded-lg text-[13px] font-medium transition-all cursor-pointer text-start ${
                activeTab === 'repairs'
                  ? 'text-white font-bold bg-white/[0.08] rounded-lg'
                  : 'text-slate-300 hover:text-white hover:bg-white/[0.04] rounded-lg'
              }`}
            >
              <PenTool className="w-4.5 h-4.5 mr-2.5 rtl:mr-0 rtl:ml-2.5 shrink-0 opacity-90" />
              <span className="truncate">{t.nav.repairs}</span>
            </button>
          )}

          {/* 17. Mobile App & Cloud Sync Tab (تطبيق الهاتف والمزامنة) */}
          <button
            id="sidebar-tab-mobile-sync"
            onClick={() => selectTab('mobile-sync')}
            className={`w-full flex items-center px-3 py-2 rounded-lg text-[13px] font-medium transition-all cursor-pointer text-start ${
              activeTab === 'mobile-sync'
                ? 'text-emerald-300 font-bold bg-emerald-500/15 border border-emerald-500/30 rounded-lg'
                : 'text-emerald-300/90 hover:text-white hover:bg-white/[0.04] rounded-lg'
            }`}
          >
            <Smartphone className="w-4.5 h-4.5 mr-2.5 rtl:mr-0 rtl:ml-2.5 shrink-0 opacity-90" />
            <span className="truncate">{t.nav.mobileSync}</span>
          </button>
        </nav>

        {/* System bottom details card */}
        <div className="p-3 border-t border-slate-800 text-[10px] shrink-0 bg-slate-950/40">
          <div className="flex justify-between items-center opacity-60 mb-1.5 font-mono text-[9px] uppercase tracking-wider text-slate-300">
            <span>Cloud + Mobile Sync</span>
            <span>v5.0</span>
          </div>
          <div id="sidebar-online-status" className={`${statusTheme.badge} p-1.5 rounded-lg border font-bold text-center text-[10px] tracking-wide uppercase flex items-center justify-center gap-1.5 transition-colors duration-200`}>
            <span className={`w-2 h-2 rounded-full ${statusTheme.dot} animate-pulse shrink-0`}></span>
            <span>{isRTL ? 'الحالة: متصل بالكامل' : 'Status: Full Online'}</span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-slate-50 relative h-screen overflow-hidden">
        {/* Top Header Row - Respects iPhone Status Bar / Dynamic Island Safe Area */}
        <header
          className="min-h-14 bg-white border-b border-slate-200 flex items-center justify-between px-3 sm:px-6 pb-2.5 shrink-0 z-20 shadow-xs"
          style={{ paddingTop: 'max(0.65rem, calc(env(safe-area-inset-top, 0px) + 0.35rem))' }}
        >
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {/* Mobile Hamburger Button (< lg) */}
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer shrink-0"
              title={lang === 'ar' ? 'القائمة الرئيسية' : 'Menu'}
            >
              <Menu className="w-5 h-5" />
            </button>

            <span className="hidden sm:inline-block text-[10px] font-black bg-slate-100 px-2.5 py-1 rounded text-indigo-600 uppercase tracking-widest shrink-0">
              {activeTab}
            </span>
            <h2 className="text-xs sm:text-sm font-bold text-slate-850 tracking-tight truncate">
              {activeTab === 'home' && t.nav.home}
              {activeTab === 'pos' && t.nav.pos}
              {activeTab === 'invoices' && t.nav.invoices}
              {(activeTab === 'commercial-documents' || activeTab === 'devis' || activeTab === 'bon-commande' || activeTab === 'bon-livraison') && t.nav.commercialDocuments}
              {activeTab === 'purchase-entry' && t.nav.purchaseEntry}
              {activeTab === 'inventory' && t.nav.inventory}
              {activeTab === 'customers' && t.nav.customers}
              {activeTab === 'suppliers' && t.nav.suppliers}
              {activeTab === 'purchases' && t.nav.purchases}
              {activeTab === 'reports' && t.nav.reports}
              {activeTab === 'settings' && t.nav.settings}
              {activeTab === 'users' && t.nav.users}
              {activeTab === 'repairs' && t.nav.repairs}
              {activeTab === 'logs' && t.nav.logs}
              {activeTab === 'backup' && t.nav.backup}
              {activeTab === 'mobile-sync' && (lang === 'ar' ? 'تطبيق الهاتف والمزامنة السحابية' : 'Mobile App & Cloud Sync')}
            </h2>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            {/* Instant Cloud/Phone Sync Status & Action Button */}
            <button
              type="button"
              onClick={() => triggerSyncCycle(true)}
              className="px-2.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 text-[10px] sm:text-xs font-black flex items-center gap-1.5 cursor-pointer transition"
              title={lang === 'ar' ? 'مزامنة البيانات الآن بين الهاتف والحاسوب' : 'Sync Now'}
            >
              <RefreshCw className={`w-3.5 h-3.5 text-emerald-600 ${isCloudSyncing ? 'animate-spin' : ''}`} />
              <span className="hidden md:inline">{lang === 'ar' ? 'مزامنة فورية' : 'Sync'}</span>
            </button>

            {/* 1-Click PWA Install Button if installable */}
            {deferredInstallPrompt && (
              <button
                type="button"
                onClick={handleTriggerPwaInstall}
                className="px-2.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] sm:text-xs font-black flex items-center gap-1 cursor-pointer shadow-2xs transition"
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>{lang === 'ar' ? 'تثبيت التطبيق' : 'Install'}</span>
              </button>
            )}

            {/* High density language switcher selection */}
            <div className="flex bg-slate-100 rounded-lg p-0.5 text-[10px] font-bold border border-slate-200">
              <button
                id="btn-lang-ar"
                onClick={() => setLang('ar')}
                className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded transition cursor-pointer font-bold ${
                  lang === 'ar' ? 'bg-white shadow-xs text-indigo-600' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                AR
              </button>
              <button
                id="btn-lang-fr"
                onClick={() => setLang('fr')}
                className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded transition cursor-pointer font-bold ${
                  lang === 'fr' ? 'bg-white shadow-xs text-indigo-600' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                FR
              </button>
              <button
                id="btn-lang-en"
                onClick={() => setLang('en')}
                className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded transition cursor-pointer font-bold ${
                  lang === 'en' ? 'bg-white shadow-xs text-indigo-600' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                EN
              </button>
            </div>

            {/* Admin User Badge */}
            <div className="flex items-center gap-2 sm:gap-3 border-l border-slate-200 pl-2 sm:pl-4 pr-1 sm:pr-4 rtl:border-l-0 rtl:border-r rtl:pr-2 sm:rtl:pr-4 rtl:pl-1 sm:rtl:pl-4 shrink-0">
              <div className="hidden sm:block text-right">
                <p className="text-[11.5px] font-black leading-none text-slate-800">{currentUser.name}</p>
                <p className="text-[9px] text-indigo-600 font-extrabold uppercase tracking-wider mt-0.5">
                  {currentUser.role === 'admin' ? (lang === 'ar' ? 'مدير عام الصلاحيات' : 'Admin') : (lang === 'ar' ? 'موظف مبيعات' : 'Staff')}
                </p>
              </div>
              {currentUser.role === 'admin' || currentUser.username === 'admin' || currentUser.photoUrl ? (
                <img
                  src={currentUser.role === 'admin' || currentUser.username === 'admin' ? '/sp-icon.png' : currentUser.photoUrl}
                  alt={currentUser.name}
                  className="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover border border-slate-200"
                />
              ) : (
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-black text-xs text-slate-700 uppercase">
                  {currentUser.name.slice(0, 2)}
                </div>
              )}

              {/* Functional Log out */}
              <button
                onClick={handleLogout}
                title={lang === 'ar' ? 'تسجيل الخروج' : 'Log Out'}
                className="p-1.5 bg-slate-50 hover:bg-rose-50 text-slate-450 hover:text-rose-600 rounded-lg border border-slate-200 hover:border-rose-100 transition duration-150 cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>

        {/* Dynamic Inner Active Section Viewport */}
        <div
          className="p-3 sm:p-6 pb-28 lg:pb-6 flex-1 overflow-y-auto min-h-0 bg-slate-50/70 no-scrollbar"
          id="main-content-display"
        >
          {activeTab === 'home' && (
            <Home
              invoices={invoices}
              products={products}
              customers={customers}
              suppliers={suppliers}
              logs={logs}
              config={config}
              lang={lang}
              currentUser={currentUser}
              onNavigate={selectTab}
            />
          )}

          {activeTab === 'pos' && (
            <POS
              products={products}
              customers={customers}
              config={config}
              onAddTransaction={handleAddTransaction}
              onReturnInvoice={handleReturnInvoiceItems}
              invoices={invoices}
              expenses={expenses}
              lang={lang}
              currentUser={currentUser}
            />
          )}

          {activeTab === 'invoices' && (
            <Invoices
              invoices={invoices}
              products={products}
              customers={customers}
              config={config}
              onPayInvoiceBalance={handlePayInvoiceBalance}
              onEditInvoice={handleEditInvoice}
              onDeleteInvoice={handleDeleteInvoice}
              onReturnInvoice={handleReturnInvoiceItems}
              onNavigate={(tab) => selectTab(tab, tab === 'commercial-documents')}
              lang={lang}
            />
          )}

          {(activeTab === 'commercial-documents' || activeTab === 'devis' || activeTab === 'bon-commande' || activeTab === 'bon-livraison') && (
            <CommercialDocuments
              initialType={
                activeTab === 'bon-commande' ? 'bon_commande' :
                activeTab === 'bon-livraison' ? 'bon_livraison' :
                activeTab === 'devis' ? 'devis' :
                'facture'
              }
              autoOpenCreateTrigger={commercialDocCreateTrigger}
              documents={commercialDocuments}
              products={products}
              customers={customers}
              config={config}
              onSaveDocument={handleSaveCommercialDoc}
              onDeleteDocument={handleDeleteCommercialDoc}
              onConvertToInvoice={handleCommercialDocConvertToInvoice}
              lang={lang}
            />
          )}

          {activeTab === 'purchase-entry' && (
            <PurchaseEntry
              suppliers={suppliers}
              products={products}
              config={config}
              purchasesCount={purchases.length}
              onSavePurchase={handleSavePurchase}
              onNavigate={selectTab}
              lang={lang}
              currentUser={currentUser}
            />
          )}

          {activeTab === 'inventory' && (
            <Inventory
              products={products}
              config={config}
              onSaveProduct={handleSaveProduct}
              onDeleteProduct={handleDeleteProduct}
              lang={lang}
            />
          )}

          {activeTab === 'customers' && (
            <Customers
              customers={customers}
              invoices={invoices}
              onSaveCustomer={handleSaveCustomer}
              onDeleteCustomer={handleDeleteCustomer}
              onSettleDebt={handleSettleDebt}
              lang={lang}
              config={config}
              logs={logs}
              customerPayments={data?.customerPayments || []}
            />
          )}

          {activeTab === 'suppliers' && (
            <Suppliers
              suppliers={suppliers}
              onSaveSupplier={handleSaveSupplier}
              onDeleteSupplier={handleDeleteSupplier}
              lang={lang}
            />
          )}

          {activeTab === 'purchases' && (
            <Purchases
              purchases={purchases || []}
              suppliers={suppliers}
              products={products}
              config={config}
              onSavePurchase={handleSavePurchase}
              onDeletePurchase={handleDeletePurchase}
              onSettleSupplierDebt={handleSettleSupplierDebt}
              lang={lang}
            />
          )}

          {activeTab === 'expenses' && (
            <Expenses
              expenses={expenses}
              config={config}
              onSaveExpense={handleSaveExpense}
              onDeleteExpense={handleDeleteExpense}
              lang={lang}
              currentUserName={currentUser?.name}
            />
          )}

          {activeTab === 'reports' && (
            <Dashboard
              invoices={invoices}
              products={products}
              customers={customers}
              suppliers={suppliers}
              expenses={expenses}
              config={config}
              lang={lang}
            />
          )}

          {activeTab === 'settings' && (
            <Settings
              config={config}
              onSaveConfig={handleSaveConfig}
              lang={lang}
              logs={logs}
              currentUser={currentUser}
            />
          )}

          {activeTab === 'backup' && (
            <BackupManagement
              onImportBackup={handleImportBackup}
              onExportBackup={handleExportBackup}
              onResetToDefaults={handleResetDatabase}
              lang={lang}
              logs={logs}
              productsCount={products.length}
              invoicesCount={invoices.length}
              customersCount={customers.length}
              suppliersCount={suppliers.length}
              isAdmin={currentUser?.role === 'admin'}
            />
          )}

          {activeTab === 'users' && (
            <UsersManagement
              currentUser={currentUser}
              employees={employees}
              onSaveEmployee={handleSaveEmployee}
              onDeleteEmployee={handleDeleteEmployee}
              lang={lang}
            />
          )}

          {activeTab === 'repairs' && (
            <RepairsManagement
              repairs={repairs}
              config={config}
              onSaveRepair={handleSaveRepair}
              onDeleteRepair={handleDeleteRepair}
              lang={lang}
            />
          )}

          {activeTab === 'logs' && (
            <ActivityLogs
              logs={logs}
              config={config}
              onClearLogs={handleClearLogs}
              onDeleteSingleLog={handleDeleteSingleLog}
              lang={lang}
            />
          )}

          {activeTab === 'mobile-sync' && (
            <MobileAndCloudSync
              allData={data}
              onUpdateAllData={(merged) => {
                const reconciled = reconcileFacturesDataset(merged);
                setData(reconciled);
                saveStoredData(reconciled);
                fetch('/api/save', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(reconciled),
                }).catch(() => {});
              }}
              config={config}
              lang={lang}
              deferredInstallPrompt={deferredInstallPrompt}
              onTriggerInstall={handleTriggerPwaInstall}
            />
          )}
        </div>

        {/* Native Smartphone Bottom Navigation Bar (< lg) for Android & iPhone */}
        <nav
          id="mobile-bottom-nav"
          className={`lg:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 grid grid-cols-5 z-30 shadow-lg transition-all duration-200 ease-in-out ${
            isKeyboardVisible ? 'translate-y-full opacity-0 pointer-events-none' : 'translate-y-0 opacity-100'
          }`}
          style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        >
          <button
            type="button"
            onClick={() => selectTab('home')}
            className={`py-2 flex flex-col items-center justify-center gap-0.5 text-[10px] font-black cursor-pointer transition ${
              activeTab === 'home' ? 'text-indigo-600' : 'text-slate-500'
            }`}
          >
            <SmartHome className="w-5 h-5" />
            <span>{lang === 'ar' ? 'الرئيسية' : 'Home'}</span>
          </button>

          <button
            type="button"
            onClick={() => selectTab('pos')}
            className={`py-2 flex flex-col items-center justify-center gap-0.5 text-[10px] font-black cursor-pointer transition ${
              activeTab === 'pos' ? 'text-indigo-600' : 'text-slate-500'
            }`}
          >
            <ShoppingCart className="w-5 h-5" />
            <span>{lang === 'ar' ? 'نقطة البيع' : 'POS'}</span>
          </button>

          <button
            type="button"
            onClick={() => selectTab('commercial-documents', true)}
            className={`py-2 flex flex-col items-center justify-center gap-0.5 text-[10px] font-black cursor-pointer transition ${
              activeTab === 'commercial-documents' ? 'text-indigo-600' : 'text-slate-500'
            }`}
          >
            <FileSpreadsheet className="w-5 h-5" />
            <span>{lang === 'ar' ? 'فاتورة' : lang === 'fr' ? 'Facture' : 'Invoice'}</span>
          </button>

          <button
            type="button"
            onClick={() => selectTab('invoices')}
            className={`py-2 flex flex-col items-center justify-center gap-0.5 text-[10px] font-black cursor-pointer transition ${
              activeTab === 'invoices' ? 'text-indigo-600' : 'text-slate-500'
            }`}
          >
            <ClipboardList className="w-5 h-5" />
            <span>{lang === 'ar' ? 'فواتير المبيعات' : lang === 'fr' ? 'Factures' : 'Sales Invoices'}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(true)}
            className={`py-2 flex flex-col items-center justify-center gap-0.5 text-[10px] font-black cursor-pointer transition ${
              isMobileMenuOpen ? 'text-indigo-600' : 'text-slate-500'
            }`}
          >
            <Menu className="w-5 h-5" />
            <span>{lang === 'ar' ? 'كل الأقسام' : 'More'}</span>
          </button>
        </nav>

        {/* Small humble footer pinned at the bottom panel on Desktop */}
        <footer className="hidden lg:flex h-8 bg-white border-t border-slate-200 items-center justify-between px-6 text-[10px] text-slate-400 font-semibold shrink-0">
          <span>{config.name} © 2026</span>
          <span className="font-mono text-[9px]">{isRTL ? 'البيانات مخزنة ومؤمنة محلياً وسحابياً' : 'All multilingual data secured locally & in cloud'}</span>
        </footer>
      </main>
    </div>
  );
}
