/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Product, Customer, Invoice, PaymentMethod, Language, StoreConfig, InvoiceItem, Employee, Expense } from '../types';
import { languages } from '../languages';
import { 
  Search, ShoppingCart, Trash2, Plus, Minus, User, PlusCircle, CreditCard, Wallet, 
  AlertCircle, Sparkles, Printer, X, Edit2, Check, RotateCcw, ScanBarcode, CheckCircle2, Volume2, Lock,
  Eye, Package, Layers, ChevronDown, Camera
} from 'lucide-react';
import CashRegisterModal from './CashRegisterModal';
import CameraBarcodeModal from './CameraBarcodeModal';
import { generateBarcodeSvg } from '../utils/barcode';
import { parseDecimal, sanitizeDecimalInput } from '../utils/numberInput';
import { pullCloudBarcodeScan } from '../utils/cloudSync';

interface POSProps {
  products: Product[];
  customers: Customer[];
  config: StoreConfig;
  onAddTransaction: (invoice: Invoice) => void;
  onReturnInvoice?: (invoiceId: string, returnList: { productId: string; quantity: number; unitPrice: number }[], notes?: string) => void;
  invoices?: Invoice[];
  expenses?: Expense[];
  lang: Language;
  currentUser?: Employee | null;
}

interface CartItem {
  product: Product;
  quantity: number | string;
  discount: number | string; // custom percentage
  customPrice?: number | string; // custom editable selling price
}

interface POSSession {
  id: string;
  name: string;
  cart: CartItem[];
  customerId: string;
  paymentMethod: PaymentMethod;
  amountPaid: string;
  generalDiscount: string;
  notes: string;
  isWholesale?: boolean;
}

// Web Audio API Synthesizer for Barcode Scans
const playBeep = (type: 'success' | 'error' = 'success') => {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'success') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
      osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.08); // E6
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.12);
    } else {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(320, ctx.currentTime);
      osc.frequency.setValueAtTime(200, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.22);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.22);
    }
  } catch {
    // Audio playback muted or blocked by browser policy
  }
};

export default function POS({ products, customers, config, onAddTransaction, onReturnInvoice, invoices = [], expenses = [], lang, currentUser }: POSProps) {
  const t = languages[lang];
  const isRTL = t.direction === 'rtl';

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showCashRegisterModal, setShowCashRegisterModal] = useState(false);
  const [showCameraScanner, setShowCameraScanner] = useState(false);
  const [mobilePosView, setMobilePosView] = useState<'catalog' | 'cart'>('catalog');

  // Checkout details
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerId, setCustomerId] = useState<string>('walk-in');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [amountPaid, setAmountPaid] = useState<string>('');
  const [generalDiscount, setGeneralDiscount] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [isWholesale, setIsWholesale] = useState(false);
  const [pricingTier, setPricingTier] = useState<'retail' | 'wholesale' | 'installment'>('retail');
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  // Barcode feedback toast notification
  const [scanToast, setScanToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const barcodeBufferRef = useRef<{ text: string; lastTime: number }>({ text: '', lastTime: 0 });

  // Small thermal receipt popup state
  const [lastCheckedInvoice, setLastCheckedInvoice] = useState<Invoice | null>(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);

  // Direct checkout toast alert message state
  const [showDirectToast, setShowDirectToast] = useState<{ visible: boolean; invoiceNumber: string; total: number }>({
    visible: false,
    invoiceNumber: '',
    total: 0
  });

  // Session rename support states
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingSessionName, setEditingSessionName] = useState<string>('');

  // Multiple carts session administration
  const [sessions, setSessions] = useState<POSSession[]>(() => {
    const saved = localStorage.getItem('pos_active_sessions');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((s: any) => ({
            ...s,
            generalDiscount: s.generalDiscount !== undefined && s.generalDiscount !== null ? String(s.generalDiscount) : ''
          }));
        }
      } catch (e) {}
    }
    return [
      {
        id: 'session-1',
        name: lang === 'ar' ? 'الزبون 1' : 'Customer 1',
        cart: [],
        customerId: 'walk-in',
        paymentMethod: 'cash',
        amountPaid: '',
        generalDiscount: '',
        notes: '',
        isWholesale: false
      }
    ];
  });

  const [activeSessionId, setActiveSessionId] = useState<string>(() => {
    return sessions[0]?.id || 'session-1';
  });

  // Handle switching cart sessions
  const handleSwitchSession = (nextId: string) => {
    const updatedSessions = sessions.map(s => {
      if (s.id === activeSessionId) {
        return {
          ...s,
          cart,
          customerId,
          paymentMethod,
          amountPaid,
          generalDiscount,
          notes,
          isWholesale
        };
      }
      return s;
    });
    setSessions(updatedSessions);
    localStorage.setItem('pos_active_sessions', JSON.stringify(updatedSessions));

    const target = updatedSessions.find(s => s.id === nextId);
    if (target) {
      setActiveSessionId(nextId);
      setCart(target.cart);
      setCustomerId(target.customerId);
      setPaymentMethod(target.paymentMethod);
      setAmountPaid(target.amountPaid);
      setGeneralDiscount(target.generalDiscount !== undefined && target.generalDiscount !== null ? String(target.generalDiscount) : '');
      setNotes(target.notes);
      setIsWholesale(target.isWholesale || false);
    }
  };

  // Create new cart session
  const handleAddSession = () => {
    const updatedSessions = sessions.map(s => {
      if (s.id === activeSessionId) {
        return {
          ...s,
          cart,
          customerId,
          paymentMethod,
          amountPaid,
          generalDiscount,
          notes,
          isWholesale
        };
      }
      return s;
    });

    const nextNum = Math.max(...sessions.map(s => {
      const match = s.name.match(/\d+/);
      return match ? parseInt(match[0]) : 0;
    }), 0) + 1;

    const newSession: POSSession = {
      id: 'session-' + Date.now(),
      name: lang === 'ar' ? `الزبون ${nextNum}` : `Customer ${nextNum}`,
      cart: [],
      customerId: 'walk-in',
      paymentMethod: 'cash',
      amountPaid: '',
      generalDiscount: '',
      notes: '',
      isWholesale: false
    };

    const finalSessions = [...updatedSessions, newSession];
    setSessions(finalSessions);
    localStorage.setItem('pos_active_sessions', JSON.stringify(finalSessions));

    setActiveSessionId(newSession.id);
    setCart([]);
    setCustomerId('walk-in');
    setPaymentMethod('cash');
    setAmountPaid('');
    setGeneralDiscount('');
    setNotes('');
    setIsWholesale(false);
  };

  // Close/revoke active cart session
  const handleDeleteSession = (idToDelete: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (sessions.length <= 1) {
      alert(lang === 'ar' ? 'يجب إبقاء سلة واحدة مفتوحة على الأقل للكاشير!' : 'At least one active sales cart must remain open!');
      return;
    }

    const index = sessions.findIndex(s => s.id === idToDelete);
    const remainingSessions = sessions.filter(s => s.id !== idToDelete);
    setSessions(remainingSessions);
    localStorage.setItem('pos_active_sessions', JSON.stringify(remainingSessions));

    if (activeSessionId === idToDelete) {
      const nextActive = remainingSessions[index === 0 ? 0 : index - 1];
      setActiveSessionId(nextActive.id);
      setCart(nextActive.cart);
      setCustomerId(nextActive.customerId);
      setPaymentMethod(nextActive.paymentMethod);
      setAmountPaid(nextActive.amountPaid);
      setGeneralDiscount(nextActive.generalDiscount !== undefined && nextActive.generalDiscount !== null ? String(nextActive.generalDiscount) : '');
      setNotes(nextActive.notes);
      setIsWholesale(nextActive.isWholesale || false);
    }
  };

  // Proactive Sync of current local hooks input values to the sessions array state on change
  useEffect(() => {
    setSessions(prev => {
      const next = prev.map(s => {
        if (s.id === activeSessionId) {
          return {
            ...s,
            cart,
            customerId,
            paymentMethod,
            amountPaid,
            generalDiscount,
            notes,
            isWholesale
          };
        }
        return s;
      });
      localStorage.setItem('pos_active_sessions', JSON.stringify(next));
      return next;
    });
  }, [cart, customerId, paymentMethod, amountPaid, generalDiscount, notes, activeSessionId, isWholesale]);

  // Load User Custom Hotkeys Configurations
  const userHotkeys = (() => {
    const userId = currentUser?.id || 'general';
    const saved = localStorage.getItem(`pos_hotkeys_${userId}`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return {
      sellAndPrint: 'F1',
      showReceipt: 'F2',
      sellDirect: 'F4'
    };
  })();

  // Barcode feedback toast notification helper
  const showScanNotice = (message: string, type: 'success' | 'error') => {
    setScanToast({ message, type });
    playBeep(type);
    setTimeout(() => {
      setScanToast((prev) => (prev?.message === message ? null : prev));
    }, 2500);
  };

  // Barcode quick add handler: matches exact SKU or exact Name
  const handleBarcodeScan = (code: string) => {
    const clean = code.trim();
    if (!clean) return;

    const found = products.find(
      (p) => p.sku.toLowerCase() === clean.toLowerCase() || p.name.toLowerCase() === clean.toLowerCase()
    );

    if (found) {
      addToCart(found);
      setSearch('');
      if (found.stock <= 0) {
        showScanNotice(
          lang === 'ar'
            ? `⚠️ تنبيه: المنتج "${found.name}" نفد من المخزون!`
            : `⚠️ Warning: "${found.name}" is out of stock!`,
          'error'
        );
      } else {
        showScanNotice(
          lang === 'ar'
            ? `✓ تمت إضافة "${found.name}" إلى السلة`
            : `✓ Added "${found.name}" to cart`,
          'success'
        );
      }
    } else {
      showScanNotice(
        lang === 'ar'
          ? `❌ لا يوجد منتج بهذا الباركود: "${clean}"`
          : `❌ No product found for barcode: "${clean}"`,
        'error'
      );
    }
  };

  // Categories
  const categories = ['all', ...Array.from(new Set(products.map((p) => p.category)))];

  // Search filter
  const filteredProducts = products.filter((p) => {
    const s = search.toLowerCase();
    const matchesSearch = p.name.toLowerCase().includes(s) || p.sku.toLowerCase().includes(s);
    const matchesCat = selectedCategory === 'all' || p.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  const addToCart = (product: Product) => {
    const existingIndex = cart.findIndex((item) => item.product.id === product.id);
    if (existingIndex > -1) {
      const updated = [...cart];
      const curQty = parseDecimal(updated[existingIndex].quantity, 1);
      updated[existingIndex].quantity = curQty + 1;
      setCart(updated);
    } else {
      setCart([...cart, { product, quantity: 1, discount: 0 }]);
    }
  };

  const updateQty = (id: string, delta: number) => {
    const idx = cart.findIndex((item) => item.product.id === id);
    if (idx === -1) return;

    const cur = parseDecimal(cart[idx].quantity, 1);
    const newQty = cur + delta;
    if (newQty <= 0) {
      removeFromCart(id);
      return;
    }

    const updated = [...cart];
    updated[idx].quantity = Number.isInteger(newQty) ? newQty : Number(newQty.toFixed(3));
    setCart(updated);
  };

  const setQty = (id: string, qty: number | string) => {
    const idx = cart.findIndex((item) => item.product.id === id);
    if (idx === -1) return;

    const updated = [...cart];
    updated[idx].quantity = qty;
    setCart(updated);
  };

  const priceWarnTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const checkAndWarnBelowCost = (product: Product, rawPrice: number | string | undefined, rawDiscount: number | string, immediate = false) => {
    if (priceWarnTimeoutRef.current) {
      clearTimeout(priceWarnTimeoutRef.current);
    }
    if (rawPrice !== undefined && String(rawPrice).trim() === '') return;

    const triggerCheck = () => {
      const defaultPrice = isWholesale ? (product.wholesalePrice ?? product.sellingPrice) : product.sellingPrice;
      const numPrice = rawPrice !== undefined && String(rawPrice).trim() !== '' ? parseDecimal(rawPrice, defaultPrice) : defaultPrice;
      const numDisc = parseDecimal(rawDiscount, 0);
      const netUnitPrice = numPrice - (numPrice * (numDisc / 100));

      if (product.purchasePrice > 0 && netUnitPrice < product.purchasePrice) {
        showScanNotice(
          lang === 'ar'
            ? `⚠️ تنبيه: السعر المدخل للمنتج "${product.name}" (${netUnitPrice.toFixed(2)} ${config.currency}) أقل من سعر الشراء (${product.purchasePrice.toFixed(2)} ${config.currency})!`
            : `⚠️ Warning: Price for "${product.name}" (${netUnitPrice.toFixed(2)} ${config.currency}) is less than purchase price (${product.purchasePrice.toFixed(2)} ${config.currency})!`,
          'error'
        );
      }
    };

    if (immediate) {
      triggerCheck();
    } else {
      priceWarnTimeoutRef.current = setTimeout(triggerCheck, 650);
    }
  };

  const updateDiscount = (id: string, discount: number | string, immediateWarn = false) => {
    const idx = cart.findIndex((item) => item.product.id === id);
    if (idx === -1) return;

    const updated = [...cart];
    updated[idx].discount = discount;
    setCart(updated);
    checkAndWarnBelowCost(updated[idx].product, updated[idx].customPrice, discount, immediateWarn);
  };

  const removeFromCart = (id: string) => {
    setCart(cart.filter((item) => item.product.id !== id));
  };

  const updatePrice = (id: string, newPrice: number | string, immediateWarn = false) => {
    const idx = cart.findIndex((item) => item.product.id === id);
    if (idx === -1) return;

    const updated = [...cart];
    updated[idx].customPrice = newPrice;
    setCart(updated);
    checkAndWarnBelowCost(updated[idx].product, newPrice, updated[idx].discount, immediateWarn);
  };

  const resetPrice = (id: string) => {
    const idx = cart.findIndex((item) => item.product.id === id);
    if (idx === -1) return;

    const updated = [...cart];
    delete updated[idx].customPrice;
    setCart(updated);
  };

  // Math totals calculation
  const getTotals = () => {
    let subtotal = 0;
    cart.forEach((item) => {
      const defaultPrice = isWholesale ? (item.product.wholesalePrice ?? item.product.sellingPrice) : item.product.sellingPrice;
      const price = item.customPrice !== undefined && item.customPrice !== '' ? parseDecimal(item.customPrice, defaultPrice) : defaultPrice;
      const discount = parseDecimal(item.discount, 0);
      const qty = parseDecimal(item.quantity, 1);
      const discountAmount = price * (discount / 100);
      subtotal += (price - discountAmount) * qty;
    });

    const parsedGeneralDiscount = parseDecimal(generalDiscount, 0);
    const generalDiscountAmount = Math.max(0, Math.min(subtotal, parsedGeneralDiscount));
    const subtotalAfterDiscount = Math.max(0, subtotal - generalDiscountAmount);

    // General tax from Config
    const tax = subtotalAfterDiscount * (config.taxRate / 100);
    const total = subtotalAfterDiscount + tax;

    return {
      subtotal,
      generalDiscountAmount,
      tax,
      total,
    };
  };

  const { subtotal, generalDiscountAmount, tax, total } = getTotals();

  // Dynamic quick cash denominations
  const getQuickCashDenominations = (totalAmount: number) => {
    const denominations = [20, 50, 100, 200, 500];
    const roundedUp10 = Math.ceil(totalAmount / 10) * 10;
    const roundedUp50 = Math.ceil(totalAmount / 50) * 50;
    const set = new Set<number>();
    
    if (roundedUp10 > totalAmount) set.add(roundedUp10);
    if (roundedUp50 > totalAmount) set.add(roundedUp50);

    denominations.filter(d => d >= totalAmount).forEach(d => set.add(d));

    const sorted = Array.from(set).sort((a, b) => a - b);
    return sorted.slice(0, 4);
  };

  // Selected customer name
  const selectedCustObj = customers.find((c) => c.id === customerId);
  const customerName = selectedCustObj ? selectedCustObj.name : t.pos.walkInCustomer;

  // Change computation (supports walk-in and registered customers)
  const paidVal = paymentMethod === 'debt'
    ? parseDecimal(amountPaid)
    : amountPaid.trim() !== ''
    ? parseDecimal(amountPaid)
    : total;
  const changeDue = paymentMethod === 'debt' ? 0 : Math.max(0, paidVal - total);

  const printThermalReceiptWindow = (invoiceNumber: string) => {
    const printContent = document.getElementById('pos-thermal-receipt-body')?.innerHTML;
    if (printContent) {
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`
          <!DOCTYPE html>
          <html dir="${isRTL ? 'rtl' : 'ltr'}">
            <head>
              <meta charset="utf-8" />
              <title>RECEIPT-${invoiceNumber}</title>
              <link rel="preconnect" href="https://fonts.googleapis.com">
              <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
              <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@600;700;800;900&family=Tajawal:wght@700;800;900&display=swap" rel="stylesheet">
              <style>
                @page {
                  size: 80mm auto;
                  margin: 0;
                }
                * {
                  box-sizing: border-box;
                  margin: 0;
                  padding: 0;
                  color: #000 !important;
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                }
                body {
                  width: 70mm;
                  max-width: 70mm;
                  margin: 0 auto;
                  padding: 2mm 3mm;
                  font-family: 'Cairo', 'Tajawal', Tahoma, 'Simplified Arabic', -apple-system, BlinkMacSystemFont, Arial, sans-serif;
                  font-size: 12px;
                  font-weight: 700;
                  line-height: 1.4;
                  color: #000 !important;
                  background: #fff;
                  direction: ${isRTL ? 'rtl' : 'ltr'};
                  -webkit-font-smoothing: antialiased;
                  text-rendering: optimizeLegibility;
                }
                .text-center { text-align: center; }
                .text-start { text-align: start; }
                .text-end { text-align: end; }
                .font-bold { font-weight: 700; }
                .font-black { font-weight: 900; }
                .font-mono, .num, [class*="font-mono"] {
                  font-family: Arial, 'Trebuchet MS', 'Segoe UI', Tahoma, sans-serif !important;
                  font-variant-numeric: tabular-nums !important;
                  font-feature-settings: "tnum" 1 !important;
                  font-weight: 800 !important;
                  letter-spacing: 0.3px !important;
                }
                .divider { border-top: 1px solid #000 !important; margin: 6px 0; }
                .divider-thick { border-top: 2px solid #000 !important; margin: 8px 0; }
                .flex { display: flex; }
                .justify-between { justify-content: space-between; }
                .items-center { align-items: center; }
                .total-card {
                  border: 2px solid #000 !important;
                  padding: 6px 8px;
                  margin: 8px 0;
                  border-radius: 4px;
                  background: transparent !important;
                }
                table {
                  width: 100%;
                  border-collapse: collapse;
                  margin: 5px 0;
                }
                th {
                  border-bottom: 1.5px solid #000 !important;
                  padding: 4px 2px;
                  font-size: 11px;
                  font-weight: 900;
                  color: #000 !important;
                }
                td {
                  padding: 4px 2px;
                  vertical-align: middle;
                  font-size: 11px;
                  font-weight: 700;
                  color: #000 !important;
                }
                .border-b-row td {
                  border-bottom: 1px solid #000 !important;
                }
                @media print {
                  body { width: 70mm; max-width: 70mm; margin: 0 auto; padding: 1mm 2mm; }
                }
              </style>
            </head>
            <body onload="window.print(); window.close();">
              ${printContent}
            </body>
          </html>
        `);
        printWindow.document.close();
      } else {
        window.print();
      }
    }
  };

  const handleCheckoutFlow = (mode: 'print' | 'preview' | 'direct' = 'preview') => {
    if (cart.length === 0) {
      alert(t.pos.emptyCart);
      return;
    }

    if (paymentMethod === 'debt' && customerId === 'walk-in') {
      alert('Walk-in Customer cannot purchase on debt! Please select a registered customer profile.');
      return;
    }

    // Amount validation
    const verifiedPaid = paymentMethod === 'debt' 
      ? parseDecimal(amountPaid)
      : paidVal;
    
    // Construct transaction invoice items
    const invoiceItems: InvoiceItem[] = cart.map((item) => {
      const defaultPrice = isWholesale ? (item.product.wholesalePrice ?? item.product.sellingPrice) : item.product.sellingPrice;
      const rawPrice = item.customPrice !== undefined && item.customPrice !== '' ? parseDecimal(item.customPrice, defaultPrice) : defaultPrice;
      const discPercent = parseDecimal(item.discount, 0);
      const itemDisc = rawPrice * (discPercent / 100);
      const singlePrice = rawPrice - itemDisc;
      const lineTax = singlePrice * (config.taxRate / 100);
      const qty = parseDecimal(item.quantity, 1);
      
      return {
        productId: item.product.id,
        productName: item.product.name,
        sellingPrice: rawPrice,
        purchasePrice: item.product.purchasePrice,
        quantity: qty,
        discount: discPercent,
        tax: lineTax * qty,
        total: singlePrice * qty,
      };
    });

    const statusObj = paymentMethod === 'debt' 
      ? 'unpaid' 
      : verifiedPaid >= total 
      ? 'paid' 
      : verifiedPaid > 0 
      ? 'partial' 
      : 'unpaid';

    const newInvoice: Invoice = {
      id: 'inv_' + Date.now(),
      invoiceNumber: 'INV-' + Math.floor(1000 + Math.random() * 9000),
      date: new Date().toISOString(),
      customerId: customerId,
      customerName: customerName,
      items: invoiceItems,
      subtotal,
      discount: generalDiscountAmount, // General flat discount is saved
      tax,
      total,
      amountPaid: verifiedPaid,
      paymentMethod,
      status: statusObj as Invoice['status'],
      notes: notes,
      sellerName: currentUser?.name || 'System',
      isWholesale: isWholesale || pricingTier === 'wholesale',
      pricingMode: pricingTier,
    };

    onAddTransaction(newInvoice);

    // Dynamic handling based on mode
    if (mode === 'print') {
      setLastCheckedInvoice(newInvoice);
      setShowReceiptModal(true);
      
      // Auto triggers window print after render
      setTimeout(() => {
        printThermalReceiptWindow(newInvoice.invoiceNumber);
      }, 350);
    } else if (mode === 'preview') {
      setLastCheckedInvoice(newInvoice);
      setShowReceiptModal(true);
    } else if (mode === 'direct') {
      // Just toast / notice
      setShowDirectToast({
        visible: true,
        invoiceNumber: newInvoice.invoiceNumber,
        total: total
      });
      setTimeout(() => setShowDirectToast({ visible: false, invoiceNumber: '', total: 0 }), 3000);
    }

    // Instant Reset
    setCart([]);
    setAmountPaid('');
    setGeneralDiscount('');
    setNotes('');
    setCustomerId('walk-in');
    setPaymentMethod('cash');
    setIsWholesale(false);
  };

  // Keyboard Hotkeys & Hardware Barcode Scanner Listener Effect
  useEffect(() => {
    const activeSellAndPrintKey = (config.shortcutSellPrint || userHotkeys.sellAndPrint || 'F1').toUpperCase();
    const activeShowReceiptKey = (config.shortcutShowReceipt || userHotkeys.showReceipt || 'F2').toUpperCase();
    const activeSellDirectKey = (config.shortcutSellNoReceipt || userHotkeys.sellDirect || 'F4').toUpperCase();

    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput = activeEl && (
        activeEl.tagName === 'INPUT' || 
        activeEl.tagName === 'TEXTAREA' || 
        activeEl.tagName === 'SELECT'
      );

      // Escape key closes modals
      if (e.key === 'Escape') {
        if (showReceiptModal) {
          e.preventDefault();
          setShowReceiptModal(false);
          return;
        }
      }

      // F9 focuses the barcode search input
      if (e.key === 'F9') {
        e.preventDefault();
        const searchInput = document.getElementById('search-pos-products') as HTMLInputElement | null;
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
        }
        return;
      }

      // Hardware Wedge Barcode Scanner Listener (when focus is outside any form inputs)
      const now = Date.now();
      if (!isInput) {
        if (e.key === 'Enter') {
          if (barcodeBufferRef.current.text.length >= 3 && (now - barcodeBufferRef.current.lastTime < 250)) {
            e.preventDefault();
            const scannedCode = barcodeBufferRef.current.text;
            barcodeBufferRef.current = { text: '', lastTime: 0 };
            handleBarcodeScan(scannedCode);
            return;
          }
          barcodeBufferRef.current = { text: '', lastTime: 0 };
        } else if (e.key.length === 1) {
          if (now - barcodeBufferRef.current.lastTime > 120) {
            barcodeBufferRef.current = { text: e.key, lastTime: now };
          } else {
            barcodeBufferRef.current.text += e.key;
            barcodeBufferRef.current.lastTime = now;
          }
        }
      }

      let pressedKey = e.key;
      if (pressedKey === ' ') pressedKey = 'Space';
      const upperKey = pressedKey.toUpperCase();

      // Never trigger checkout shortcuts if actively typing in an input
      if (isInput) return;

      if (upperKey === activeSellAndPrintKey) {
        e.preventDefault();
        handleCheckoutFlow('print');
      } else if (upperKey === activeShowReceiptKey) {
        e.preventDefault();
        handleCheckoutFlow('preview');
      } else if (upperKey === activeSellDirectKey) {
        e.preventDefault();
        handleCheckoutFlow('direct');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [cart, customerId, paymentMethod, amountPaid, generalDiscount, notes, userHotkeys, config, showReceiptModal, products]);

  // Listen for Wireless Smartphone Barcode Scans (Local Wi-Fi & Cloud)
  useEffect(() => {
    const timer = setInterval(async () => {
      try {
        const res = await fetch('/api/remote-barcode');
        if (res.ok) {
          const data = await res.json();
          if (data && data.code) {
            handleBarcodeScan(String(data.code));
            return;
          }
        }
      } catch {}

      try {
        const cloudCode = await pullCloudBarcodeScan();
        if (cloudCode) {
          handleBarcodeScan(cloudCode);
        }
      } catch {}
    }, 2200);

    return () => clearInterval(timer);
  }, [cart, products]);

  const handleCheckout = (e: React.FormEvent) => {
    e.preventDefault();
    handleCheckoutFlow('preview');
  };

  const handleQuickPaySelect = (amt: number) => {
    setAmountPaid(amt.toString());
  };

  return (
    <div className="space-y-4 w-full relative" id="pos-root-container">
      {/* Floating Barcode Scan Toast Notice */}
      {scanToast && (
        <div 
          id="pos-scan-toast"
          className={`fixed top-5 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-2xl shadow-xl border flex items-center gap-2.5 text-xs font-black animate-fade-in ${
            scanToast.type === 'success' 
              ? 'bg-slate-950/95 text-emerald-400 border-emerald-500/50 backdrop-blur-md shadow-emerald-500/10' 
              : 'bg-slate-950/95 text-rose-400 border-rose-500/50 backdrop-blur-md shadow-rose-500/10'
          }`}
        >
          {scanToast.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          )}
          <span>{scanToast.message}</span>
        </div>
      )}

      {/* Mobile Quick Toggle: Products Catalog vs Cart & Checkout */}
      <div className="lg:hidden grid grid-cols-2 gap-2 bg-white p-1.5 rounded-2xl border border-slate-200 shadow-2xs">
        <button
          type="button"
          onClick={() => setMobilePosView('catalog')}
          className={`py-2.5 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition cursor-pointer ${
            mobilePosView === 'catalog'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Package className="w-4 h-4" />
          <span>{lang === 'ar' ? `المنتجات (${products.length})` : `Products (${products.length})`}</span>
        </button>
        <button
          type="button"
          onClick={() => setMobilePosView('cart')}
          className={`py-2.5 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition cursor-pointer ${
            mobilePosView === 'cart'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <ShoppingCart className="w-4 h-4" />
          <span>{lang === 'ar' ? 'السلة والدفع' : 'Cart & Pay'}</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500 text-white">
            {cart.length}
          </span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 w-full items-start" id="pos-view-grid">
      {/* Products Selection catalog Column (Placed on the RIGHT in both RTL & LTR, 7/12 width) */}
      <div className={`w-full min-w-0 ${mobilePosView === 'cart' ? 'hidden lg:flex' : 'flex'} flex-col ${isRTL ? 'lg:order-1' : 'lg:order-2'} lg:col-span-7 xl:col-span-7`}>
        <div className="bg-white border border-slate-100 rounded-2xl p-3.5 sm:p-5 shadow-sm space-y-4">
          {/* Top Search Controls with Barcode scanner support */}
          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <span className={`absolute inset-y-0 ${isRTL ? 'right-4' : 'left-4'} flex items-center text-slate-400`}>
                <Search className="w-5 h-5" />
              </span>
              <input
                id="search-pos-products"
                type="text"
                placeholder={lang === 'ar' ? `${t.pos.searchProducts} أو امسح الباركود...` : `${t.pos.searchProducts} or Scan Barcode...`}
                className={`w-full py-2.5 ${isRTL ? 'pr-11 pl-20' : 'pl-11 pr-20'} bg-slate-50 border border-slate-200/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-sm transition duration-150`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (search.trim()) {
                      handleBarcodeScan(search.trim());
                    }
                  }
                }}
              />
              <div className={`absolute inset-y-0 ${isRTL ? 'left-3' : 'right-3'} flex items-center gap-1.5 text-slate-400 pointer-events-none`}>
                <ScanBarcode className="w-4 h-4 text-indigo-500" />
                <span className="hidden sm:inline text-[10px] font-mono font-bold bg-slate-200/80 px-1.5 py-0.5 rounded text-slate-600">↵ Enter</span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                id="btn-pos-camera-scan"
                type="button"
                onClick={() => setShowCameraScanner(true)}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition shadow-xs cursor-pointer"
                title={lang === 'ar' ? 'مسح الباركود بكاميرا الهاتف' : 'Scan Barcode with Camera'}
              >
                <Camera className="w-4 h-4" />
                <span>{lang === 'ar' ? 'مسح بالكاميرا' : 'Scan Camera'}</span>
              </button>

              <button
                id="btn-pos-close-caisse"
                type="button"
                onClick={() => setShowCashRegisterModal(true)}
                className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black transition shadow-xs cursor-pointer shrink-0"
                title={lang === 'ar' ? 'تصفية وإغلاق الصندوق وطباعة تقرير Z' : 'Daily Cash Closing & Z-Report'}
              >
                <Lock className="w-4 h-4 text-emerald-400" />
                <span>{lang === 'ar' ? 'تقرير الصندوق (Z)' : 'Clôture (Z)'}</span>
              </button>
            </div>
          </div>

          {/* Categories select options - Sleek horizontal scrollable pill bar with white background styling */}
          <div className="flex items-center gap-1.5 overflow-x-auto p-1 bg-slate-50/80 rounded-xl border border-slate-100 max-w-full no-scrollbar">
            {categories.map((cat) => (
              <button
                id={`pos-cat-${cat}`}
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize tracking-wider transition whitespace-nowrap border cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {cat === 'all' ? t.pos.allCategories : cat}
              </button>
            ))}
          </div>

          {/* Products grid display - Responsive grid with 3 to 4 columns */}
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2.5 overflow-y-auto max-h-[640px] pr-1.5 no-scrollbar" id="catalog-products-grid">
            {filteredProducts.length > 0 ? (
              filteredProducts.map((p) => {
                const isOut = p.stock <= 0;
                const isLow = p.stock <= p.minStock;
                const displayPrice = isWholesale ? (p.wholesalePrice ?? p.sellingPrice) : p.sellingPrice;

                return (
                  <button
                    id={`pos-p-${p.id}`}
                    key={p.id}
                    onClick={() => addToCart(p)}
                    className="flex flex-col justify-between p-2.5 bg-slate-50/50 hover:bg-indigo-50/30 border border-slate-200/80 hover:border-indigo-300 text-start rounded-xl cursor-pointer transition select-none h-44 text-xs shadow-2xs hover:shadow-md animate-fade-in text-slate-800 font-sans group overflow-hidden"
                  >
                    <div className="w-full">
                      {/* Product Image Thumbnail */}
                      <div className="w-full h-20 rounded-lg bg-slate-100 overflow-hidden mb-1.5 relative flex items-center justify-center">
                        {p.imageUrl ? (
                          <img
                            src={p.imageUrl}
                            alt={p.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                          />
                        ) : (
                          <Package className="w-8 h-8 text-slate-300" />
                        )}
                        {isLow && (
                          <span className={`absolute top-1 start-1 text-[8px] font-bold px-1.5 py-0.5 rounded uppercase ${isOut ? 'bg-rose-600 text-white' : 'bg-amber-500 text-white'}`}>
                            {isOut ? 'DEPLETED' : 'LOW'}
                          </span>
                        )}
                      </div>

                      <div className="flex justify-between items-start gap-1">
                        <span className="text-[9px] text-slate-400 font-mono font-bold uppercase truncate">{p.sku}</span>
                        <span className="text-[9px] text-slate-400 font-medium">x{p.stock}</span>
                      </div>
                      <h3 className="font-bold text-slate-800 line-clamp-1 mt-0.5 leading-snug text-xs">{p.name}</h3>
                    </div>

                    <div className="flex justify-between items-baseline mt-1 pt-1.5 border-t border-slate-100 w-full">
                      <span className="text-sm font-black text-indigo-700 font-sans">
                        {displayPrice.toFixed(2)} {config.currency}
                      </span>
                      <span className="text-[9px] text-slate-400 font-medium capitalize">
                        {p.category}
                      </span>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="col-span-full text-center py-20 bg-slate-50/50 rounded-2xl border border-slate-100">
                <AlertCircle className="w-12 h-12 stroke-[1.2] mx-auto text-slate-300 mb-3" />
                <p className="text-slate-400 font-medium">No inventory products found matching search.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Cart, Invoicing Calculations and Checkout Side Section Column */}
      <div className={`w-full min-w-0 ${mobilePosView === 'catalog' ? 'hidden lg:flex' : 'flex'} flex-col justify-between ${isRTL ? 'lg:order-2' : 'lg:order-1'} lg:col-span-5 xl:col-span-5`} id="pos-billing-cart-shell">
        <div className="bg-white border border-slate-200/90 rounded-2xl p-3.5 sm:p-5 shadow-sm space-y-3.5">
          {/* Header: Title & Cart indicator with Sessions directly on the left side */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100" id="cart-indicator-line">
            {/* Right side (in RTL): Shopping cart title and count */}
            <div className="flex items-center gap-2.5 shrink-0">
              <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100/80 flex items-center justify-center text-indigo-600 shadow-2xs">
                <ShoppingCart className="w-4 h-4" />
              </div>
              <div className="flex items-center gap-1.5">
                <h2 className="font-black text-slate-900 text-sm sm:text-base leading-none">
                  {lang === 'ar' ? 'سلة المشتريات' : t.pos.cart}
                </h2>
                <span className="bg-indigo-600 text-white font-mono px-2 py-0.5 rounded-full text-[10px] font-black shadow-2xs">
                  {cart.length}
                </span>
              </div>
            </div>

            {/* Left side (in RTL): Sessions row + Add session button + Clear button */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 max-w-full justify-start sm:justify-end">
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                {sessions.map((s) => {
                  const isActive = s.id === activeSessionId;
                  const count = isActive ? cart.length : s.cart.length;
                  return (
                    <div
                      id={`cart-session-tab-${s.id}`}
                      key={s.id}
                      onClick={() => handleSwitchSession(s.id)}
                      className={`px-2 py-1 rounded-lg text-[11px] font-bold transition flex items-center gap-1.5 whitespace-nowrap border cursor-pointer shrink-0 select-none shadow-2xs ${
                        isActive
                          ? 'bg-slate-900 border-slate-900 text-white shadow-xs'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-800'
                      }`}
                      title={`${s.name} (${count})`}
                    >
                      <span>{s.name}</span>
                      <span className={`text-[9px] px-1 py-0.1 rounded-full font-mono font-bold ${
                        isActive ? 'bg-slate-700 text-slate-100' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {count}
                      </span>
                      {sessions.length > 1 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteSession(s.id, e);
                          }}
                          className={`hover:scale-110 transition p-0.5 rounded-md ${
                            isActive ? 'text-slate-400 hover:text-rose-400' : 'text-slate-400 hover:text-rose-600'
                          }`}
                          title={lang === 'ar' ? 'إغلاق هذه الجلسة' : 'Close this session'}
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              <button
                id="btn-pos-add-cart-session"
                type="button"
                onClick={handleAddSession}
                className="p-1 px-2 bg-white hover:bg-indigo-50 text-indigo-600 hover:text-indigo-700 border border-slate-200 hover:border-indigo-300 rounded-lg transition cursor-pointer shrink-0 shadow-2xs flex items-center gap-1 text-[11px] font-bold"
                title={lang === 'ar' ? 'فتح جلسة بيع جديدة' : 'New Cart Session'}
              >
                <Plus className="w-3 h-3" />
                <span>{lang === 'ar' ? 'جلسة' : 'New'}</span>
              </button>

              {cart.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(lang === 'ar' ? 'هل أنت متأكد من تفريغ سلة المشتريات بالكامل؟' : 'Are you sure you want to clear the entire cart?')) {
                      setCart([]);
                      setAmountPaid('');
                      setGeneralDiscount('');
                    }
                  }}
                  className="p-1 px-2 text-rose-600 hover:text-white bg-rose-50 hover:bg-rose-600 border border-rose-200 hover:border-rose-600 rounded-lg text-[11px] font-bold transition cursor-pointer shadow-2xs flex items-center gap-1 shrink-0"
                  title={lang === 'ar' ? 'إفراغ سلة المشتريات' : 'Clear shopping cart'}
                >
                  <Trash2 className="w-3 h-3" />
                  <span className="hidden sm:inline">{lang === 'ar' ? 'إفراغ' : 'Clear'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Customer Selection & Wholesale/Installment Buttons (Unified Single Row) */}
          <div className="bg-slate-50/90 p-2 rounded-xl border border-slate-200/80">
            <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap">
              {/* Customer Selector with "زبون عابر" by default */}
              <div className="flex-1 min-w-[130px] relative flex items-center bg-white border border-slate-200 rounded-lg px-2 py-1 shadow-2xs focus-within:ring-1 focus-within:ring-indigo-500 focus-within:border-indigo-500">
                <User className="w-3.5 h-3.5 text-indigo-600 shrink-0 me-1" />
                <select
                  id="pos-customer-select"
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  className="w-full bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer truncate"
                >
                  <option value="walk-in">{t.pos.walkInCustomer}</option>
                  {customers
                    .filter(c => !customerSearch || c.name.toLowerCase().includes(customerSearch.toLowerCase()) || c.phone.includes(customerSearch))
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.debt > 0 ? `(${lang === 'ar' ? 'دين' : 'Debt'}: ${c.debt.toFixed(0)} ${config.currency})` : ''}
                      </option>
                    ))}
                </select>
                {selectedCustObj && selectedCustObj.debt > 0 && (
                  <span className="text-[9px] font-mono font-bold text-rose-600 bg-rose-50 border border-rose-200 px-1 py-0.2 rounded shrink-0 whitespace-nowrap ms-1">
                    {lang === 'ar' ? 'دين' : 'Debt'}: {selectedCustObj.debt.toFixed(0)}
                  </span>
                )}
              </div>

              {/* Quick filter clients field ("فلترة") */}
              <div className="relative w-20 sm:w-24 shrink-0">
                <input
                  type="text"
                  placeholder={lang === 'ar' ? '🔍 فلترة...' : '🔍 Filter...'}
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-[11px] font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-2xs"
                  title={lang === 'ar' ? 'بحث وتصفية في قائمة الزبائن' : 'Quick filter clients'}
                />
                {customerSearch && (
                  <button
                    type="button"
                    onClick={() => setCustomerSearch('')}
                    className="absolute inset-y-0 end-1 flex items-center text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                )}
              </div>

              {/* Only Wholesale Price button (سعر جملة) */}
              <button
                type="button"
                onClick={() => {
                  if (pricingTier === 'wholesale') {
                    setPricingTier('retail');
                    setIsWholesale(false);
                  } else {
                    setPricingTier('wholesale');
                    setIsWholesale(true);
                  }
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-black transition cursor-pointer shrink-0 border shadow-2xs ${
                  pricingTier === 'wholesale'
                    ? 'bg-amber-500 border-amber-500 text-white shadow-xs'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-amber-50 hover:text-amber-700 hover:border-amber-300'
                }`}
                title={lang === 'ar' ? 'تفعيل / إلغاء سعر الجملة' : 'Prix de gros'}
              >
                {lang === 'ar' ? 'سعر جملة' : 'Gros'}
              </button>

              {/* Only Installment Price button (تقسيط) */}
              <button
                type="button"
                onClick={() => {
                  if (pricingTier === 'installment') {
                    setPricingTier('retail');
                    setIsWholesale(false);
                  } else {
                    setPricingTier('installment');
                    setIsWholesale(false);
                    setPaymentMethod('debt');
                    if (!notes.includes('تقسيط')) setNotes(notes ? `${notes} | تقسيط` : 'تقسيط');
                  }
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-black transition cursor-pointer shrink-0 border shadow-2xs ${
                  pricingTier === 'installment'
                    ? 'bg-purple-600 border-purple-600 text-white shadow-xs'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-purple-50 hover:text-purple-700 hover:border-purple-300'
                }`}
                title={lang === 'ar' ? 'تفعيل / إلغاء البيع بالتقسيط' : 'Facilité de paiement'}
              >
                {lang === 'ar' ? 'تقسيط' : 'Facilité'}
              </button>
            </div>
          </div>

          {/* Cart Header Column Labels */}
          {cart.length > 0 && (
            <div className="flex items-center justify-between gap-1.5 px-2 py-1 text-[10px] font-black text-slate-400 border-b border-slate-100 uppercase">
              <span className="flex-1 text-start">{lang === 'ar' ? 'المنتج' : 'Article'}</span>
              <span className="w-20 text-center">{lang === 'ar' ? 'السعر' : 'Prix'}</span>
              <span className="w-22 text-center">{lang === 'ar' ? 'الكمية' : 'Qté'}</span>
              <span className="w-11 text-center">{lang === 'ar' ? 'خصم%' : 'Rem%'}</span>
              <span className="w-16 text-end">{lang === 'ar' ? 'المجموع' : 'Total'}</span>
              <span className="w-6"></span>
            </div>
          )}

          {/* Cart items list with generous scrolling area and non-overlapping item cards */}
          <div className="space-y-1.5 min-h-[220px] max-h-[440px] overflow-y-auto pr-1 no-scrollbar border-b border-slate-100 pb-2">
            {cart.length > 0 ? (
              cart.map((item) => {
                const defaultPrice = isWholesale ? (item.product.wholesalePrice ?? item.product.sellingPrice) : item.product.sellingPrice;
                const numericPrice = item.customPrice !== undefined && item.customPrice !== '' ? parseDecimal(item.customPrice, defaultPrice) : defaultPrice;
                const numericQty = parseDecimal(item.quantity, 1);
                const numericDisc = parseDecimal(item.discount, 0);
                const effectiveUnitPrice = numericPrice - (numericPrice * (numericDisc / 100));
                const subTotalLine = effectiveUnitPrice * numericQty;
                const isBelowPurchasePrice =
                  (item.customPrice === undefined || String(item.customPrice).trim() !== '') &&
                  item.product.purchasePrice > 0 &&
                  effectiveUnitPrice < item.product.purchasePrice;

                return (
                  <div
                    key={item.product.id}
                    className={`px-2 py-1.5 bg-white hover:bg-slate-50 rounded-xl border transition text-xs shadow-2xs ${
                      isBelowPurchasePrice ? 'border-amber-300 bg-amber-50/20' : 'border-slate-200/80'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      {/* 1. Product Name */}
                      <div className="flex-1 min-w-[85px] truncate text-start">
                        <span className="font-bold text-slate-800 text-xs truncate block" title={item.product.name}>
                          {item.product.name}
                        </span>
                      </div>

                      {/* 2. Unit Price - Enlarged width */}
                      <div className="w-20 shrink-0">
                        <input
                          id={`p-price-${item.product.id}`}
                          type="text"
                          inputMode="decimal"
                          value={item.customPrice !== undefined ? item.customPrice : defaultPrice}
                          onChange={(e) => {
                            const raw = sanitizeDecimalInput(e.target.value);
                            updatePrice(item.product.id, raw);
                          }}
                          onBlur={(e) => {
                            if (String(item.customPrice ?? '').trim() === '') {
                              resetPrice(item.product.id);
                            } else {
                              updatePrice(item.product.id, parseDecimal(e.target.value), true);
                            }
                          }}
                          className={`w-full text-center border rounded px-1.5 py-0.5 font-bold font-mono text-xs focus:outline-none ${
                            isBelowPurchasePrice
                              ? 'bg-amber-50 border-amber-400 text-rose-700 focus:border-rose-500'
                              : item.customPrice !== undefined
                              ? 'bg-slate-50 border-slate-200 text-amber-600 focus:border-indigo-500'
                              : 'bg-slate-50 border-slate-200 text-slate-800 focus:border-indigo-500'
                          }`}
                          title={lang === 'ar' ? 'السعر' : 'Price'}
                        />
                      </div>

                      {/* 3. Quantity Controls [-] [qty] [+] - Enlarged width */}
                      <div className="w-22 shrink-0 flex items-center justify-between bg-slate-50 border border-slate-200 rounded p-0.5">
                        <button
                          id={`qty-minus-${item.product.id}`}
                          type="button"
                          onClick={() => updateQty(item.product.id, -1)}
                          className="w-4.5 h-4.5 rounded bg-white hover:bg-slate-200 text-slate-700 flex items-center justify-center transition cursor-pointer font-bold shrink-0 text-[10px] shadow-2xs"
                        >
                          <Minus className="w-2.5 h-2.5" />
                        </button>
                        <input
                          id={`qty-input-${item.product.id}`}
                          type="text"
                          inputMode="decimal"
                          value={item.quantity === 0 || item.quantity === '0' ? '' : item.quantity}
                          onChange={(e) => {
                            const raw = sanitizeDecimalInput(e.target.value);
                            setQty(item.product.id, raw);
                          }}
                          onBlur={(e) => {
                            const val = parseDecimal(e.target.value, 0);
                            if (val <= 0) {
                              removeFromCart(item.product.id);
                            } else {
                              setQty(item.product.id, val);
                            }
                          }}
                          className="w-10 text-center font-bold font-mono text-xs focus:outline-none bg-transparent"
                        />
                        <button
                          id={`qty-plus-${item.product.id}`}
                          type="button"
                          onClick={() => updateQty(item.product.id, 1)}
                          className="w-4.5 h-4.5 rounded bg-white hover:bg-slate-200 text-slate-700 flex items-center justify-center transition cursor-pointer font-bold shrink-0 text-[10px] shadow-2xs"
                        >
                          <Plus className="w-2.5 h-2.5" />
                        </button>
                      </div>

                      {/* 4. Discount % */}
                      <div className="w-11 shrink-0 flex items-center">
                        <input
                          id={`p-disc-${item.product.id}`}
                          type="text"
                          inputMode="decimal"
                          placeholder="0%"
                          value={item.discount === 0 || item.discount === '0' ? '' : item.discount}
                          onChange={(e) => {
                            const raw = sanitizeDecimalInput(e.target.value);
                            updateDiscount(item.product.id, raw);
                          }}
                          onBlur={(e) => {
                            const val = Math.max(0, Math.min(100, parseDecimal(e.target.value, 0)));
                            updateDiscount(item.product.id, val === 0 ? '' : val, true);
                          }}
                          className="w-full text-center bg-slate-50 border border-slate-200 rounded px-0.5 py-0.5 font-bold font-mono text-[11px] focus:outline-none focus:border-indigo-500"
                          title={lang === 'ar' ? 'الخصم %' : 'Discount %'}
                        />
                      </div>

                      {/* 5. Line Total */}
                      <div className="w-16 shrink-0 text-end font-mono font-black text-slate-900 text-xs">
                        {subTotalLine.toFixed(2)}
                      </div>

                      {/* 6. Delete Button */}
                      <button
                        id={`btn-rem-cart-${item.product.id}`}
                        type="button"
                        onClick={() => removeFromCart(item.product.id)}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded transition cursor-pointer shrink-0"
                        title={t.inventory.delete}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {isBelowPurchasePrice && (
                      <div className="mt-1.5 px-2 py-1 bg-amber-50 border border-amber-200 rounded-lg text-[10px] font-bold text-amber-800 flex items-center gap-1.5 text-start">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span>
                          {lang === 'ar'
                            ? `تنبيه: السعر (${effectiveUnitPrice.toFixed(2)} ${config.currency}) أقل من سعر الشراء (${item.product.purchasePrice.toFixed(2)} ${config.currency})`
                            : `Warning: Price (${effectiveUnitPrice.toFixed(2)} ${config.currency}) is below purchase price (${item.product.purchasePrice.toFixed(2)} ${config.currency})`}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="text-center py-10 text-slate-400 space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto text-slate-300">
                  <ShoppingCart className="w-6 h-6 stroke-[1.4]" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-500">
                    {lang === 'ar' ? 'سلة المشتريات فارغة' : t.pos.emptyCart}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {lang === 'ar' ? 'اختر منتجات من القائمة أو امسح الباركود' : 'Select products or scan barcode'}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Checkout billing details form */}
          <form onSubmit={handleCheckout} className="space-y-3 pt-1">
            {/* 1. Financial Breakdown & Net Total Card */}
            <div className="bg-slate-50/90 p-3 rounded-2xl border border-slate-200/80 space-y-2.5 shadow-2xs">
              {/* Row: Subtotal & General Discount */}
              <div className="grid grid-cols-2 gap-2.5 items-center text-xs">
                {/* Subtotal */}
                <div className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded-xl border border-slate-200 shadow-2xs">
                  <span className="text-[11px] font-bold text-slate-500 truncate">
                    {lang === 'ar' ? 'المجموع الفرعي:' : `${t.pos.subtotal}:`}
                  </span>
                  <span className="font-mono font-black text-slate-800 text-xs shrink-0">
                    {subtotal.toFixed(2)} <span className="text-[10px] text-slate-400 font-sans">{config.currency}</span>
                  </span>
                </div>

                {/* General Discount */}
                <div className="flex items-center justify-between bg-white px-2.5 py-1 rounded-xl border border-rose-200 shadow-2xs">
                  <label htmlFor="checkout-general-discount-field" className="text-[11px] font-black text-rose-600 cursor-pointer shrink-0">
                    {lang === 'ar' ? 'خصم إضافي:' : 'Remise:'}
                  </label>
                  <div className="flex items-center gap-1 justify-end">
                    <span className="text-rose-500 text-xs font-black">-</span>
                    <input
                      id="checkout-general-discount-field"
                      type="text"
                      inputMode="decimal"
                      placeholder="0.00"
                      className="w-16 bg-transparent text-end text-xs font-black font-mono text-rose-700 focus:outline-none"
                      value={generalDiscount}
                      onChange={(e) => {
                        setGeneralDiscount(sanitizeDecimalInput(e.target.value));
                      }}
                    />
                    <span className="text-[9px] text-slate-400 font-bold">{config.currency}</span>
                  </div>
                </div>
              </div>

              {/* Tax row if taxRate > 0 */}
              {config.taxRate > 0 && (
                <div className="flex items-center justify-between text-xs px-1 text-slate-500">
                  <span className="font-medium">{lang === 'ar' ? `الضريبة (${config.taxRate}%):` : `Tax (${config.taxRate}%):`}</span>
                  <span className="font-mono font-bold text-slate-700">+{tax.toFixed(2)} {config.currency}</span>
                </div>
              )}

              {/* Grand Total Banner - Compact Height, Single Solid Color */}
              <div className="bg-slate-900 text-white py-2 px-3 sm:py-2.5 sm:px-3.5 rounded-xl flex items-center justify-between shadow-xs border border-slate-800">
                <span className="text-xs font-black text-slate-100">
                  {lang === 'ar' ? 'المجموع الإجمالي المطلوب:' : t.pos.total}
                </span>
                <div className="text-end font-mono flex items-baseline gap-1">
                  <span className="text-xl sm:text-2xl font-black text-white tracking-tight">
                    {total.toFixed(2)}
                  </span>
                  <span className="text-xs text-indigo-300 font-sans font-bold">
                    {config.currency}
                  </span>
                </div>
              </div>
            </div>

            {/* 2. Payment Method Selector */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-black text-slate-600 block">
                {lang === 'ar' ? 'طريقة الدفع:' : `${t.pos.paymentMethod}:`}
              </label>
              <div className="grid grid-cols-3 gap-1.5 bg-slate-100 p-1 rounded-xl">
                <button
                  id="pay-cash-btn"
                  type="button"
                  onClick={() => { setPaymentMethod('cash'); setAmountPaid(''); }}
                  className={`py-2 px-2 text-xs font-black rounded-lg flex items-center justify-center gap-1.5 cursor-pointer transition ${
                    paymentMethod === 'cash'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                  }`}
                >
                  <Wallet className="w-3.5 h-3.5 shrink-0" />
                  <span>{t.pos.cash}</span>
                </button>

                <button
                  id="pay-card-btn"
                  type="button"
                  onClick={() => { setPaymentMethod('card'); setAmountPaid(total.toFixed(2)); }}
                  className={`py-2 px-2 text-xs font-black rounded-lg flex items-center justify-center gap-1.5 cursor-pointer transition ${
                    paymentMethod === 'card'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                  }`}
                >
                  <CreditCard className="w-3.5 h-3.5 shrink-0" />
                  <span>{t.pos.card}</span>
                </button>

                <button
                  id="pay-debt-btn"
                  type="button"
                  onClick={() => { setPaymentMethod('debt'); setAmountPaid('0'); }}
                  className={`py-2 px-2 text-xs font-black rounded-lg flex items-center justify-center gap-1.5 cursor-pointer transition ${
                    paymentMethod === 'debt'
                      ? 'bg-rose-700 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                  }`}
                >
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{t.pos.debt}</span>
                </button>
              </div>
            </div>

            {/* 3. Tender / Amount Paid (when not debt) */}
            {paymentMethod !== 'debt' ? (
              <div className="bg-slate-50/90 p-2 rounded-xl border border-slate-200/80 shadow-2xs">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 shrink-0">
                    <label htmlFor="paid-input-amount" className="text-xs font-black text-slate-700 cursor-pointer whitespace-nowrap">
                      {t.pos.amountPaid}
                    </label>
                    {total > 0 && (
                      <button
                        id="quick-pay-exact"
                        type="button"
                        onClick={() => handleQuickPaySelect(parseFloat(total.toFixed(2)))}
                        className="text-[10px] text-emerald-700 hover:text-emerald-800 font-black cursor-pointer underline whitespace-nowrap"
                        title={lang === 'ar' ? 'دفع المبلغ بالضبط' : 'Paiement exact'}
                      >
                        ({lang === 'ar' ? 'المبلغ بالضبط' : 'Exact'})
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {/* Amount input box */}
                    <div className="relative flex items-center bg-white border border-slate-300 rounded-lg px-2 py-1 shadow-2xs focus-within:ring-1 focus-within:ring-indigo-500 w-32 sm:w-36 shrink-0">
                      <input
                        id="paid-input-amount"
                        required
                        type="text"
                        inputMode="decimal"
                        placeholder={total.toFixed(2)}
                        className="w-full bg-transparent font-mono font-black text-sm text-slate-900 text-end focus:outline-none"
                        value={amountPaid}
                        onChange={(e) => setAmountPaid(sanitizeDecimalInput(e.target.value))}
                      />
                      <span className="text-[11px] text-slate-400 font-bold ms-1 shrink-0 font-mono">
                        {config.currency}
                      </span>
                    </div>

                    {/* Left of the input box: عدد المنتجات */}
                    <span className="text-[11px] font-black text-indigo-700 bg-white border border-indigo-100 px-2 py-1 rounded-lg shadow-2xs whitespace-nowrap shrink-0">
                      {lang === 'ar' ? `عدد المنتجات: ${cart.reduce((s, it) => s + parseDecimal(it.quantity, 0), 0)}` : `Articles: ${cart.reduce((s, it) => s + parseDecimal(it.quantity, 0), 0)}`}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-rose-50/90 p-2 rounded-xl border border-rose-200/80 shadow-2xs flex items-center justify-between text-xs font-black text-rose-800">
                <span>{lang === 'ar' ? 'البيع بالدين (تسجيل آجل)' : 'Debt sale (credit)'}</span>
                <span className="text-[11px] font-black bg-white border border-rose-200 text-rose-800 px-2 py-0.5 rounded-lg shadow-2xs">
                  {lang === 'ar' ? `عدد المنتجات: ${cart.reduce((s, it) => s + parseDecimal(it.quantity, 0), 0)}` : `Articles: ${cart.reduce((s, it) => s + parseDecimal(it.quantity, 0), 0)}`}
                </span>
              </div>
            )}

            {/* 4. Action Buttons: Direct Sell + Sell & Print + Preview */}
            <div className="grid grid-cols-3 gap-2 pt-1">
              {/* Direct Sale */}
              <button
                id="checkout-btn-direct"
                type="button"
                disabled={cart.length === 0}
                onClick={() => handleCheckoutFlow('direct')}
                className={`py-3 px-2 text-center text-xs font-black rounded-xl transition flex flex-col sm:flex-row items-center justify-center gap-1.5 border cursor-pointer active:scale-95 shadow-xs ${
                  cart.length === 0
                    ? 'bg-slate-50 text-slate-350 border-slate-200 cursor-not-allowed opacity-60'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-700 shadow-emerald-600/10'
                }`}
                title={lang === 'ar' ? 'البيع المباشر السريع (F4)' : 'Quick Direct Sale (F4)'}
              >
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-200" />
                <span className="truncate">{lang === 'ar' ? 'بيع مباشر' : 'Vente Directe'}</span>
                <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-emerald-800/80 text-emerald-100 select-none">
                  [F4]
                </span>
              </button>

              {/* Sell & Print */}
              <button
                id="checkout-btn-print"
                type="button"
                disabled={cart.length === 0}
                onClick={() => handleCheckoutFlow('print')}
                className={`py-3 px-2 text-center text-xs font-black rounded-xl transition flex flex-col sm:flex-row items-center justify-center gap-1.5 border cursor-pointer active:scale-95 shadow-xs ${
                  cart.length === 0
                    ? 'bg-slate-50 text-slate-350 border-slate-200 cursor-not-allowed opacity-60'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-700 shadow-indigo-600/10'
                }`}
                title={lang === 'ar' ? `البيع والطباعة (${userHotkeys.sellAndPrint})` : `Sell & Print (${userHotkeys.sellAndPrint})`}
              >
                <Printer className="w-4 h-4 shrink-0 text-indigo-200" />
                <span className="truncate">{lang === 'ar' ? 'بيع وطباعة' : 'Imprimer'}</span>
                <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-indigo-800/80 text-indigo-100 select-none">
                  [{userHotkeys.sellAndPrint}]
                </span>
              </button>

              {/* Preview */}
              <button
                id="checkout-btn-preview"
                type="button"
                disabled={cart.length === 0}
                onClick={() => handleCheckoutFlow('preview')}
                className={`py-3 px-2 text-center text-xs font-black rounded-xl transition flex flex-col sm:flex-row items-center justify-center gap-1.5 border-2 cursor-pointer active:scale-95 shadow-xs ${
                  cart.length === 0
                    ? 'bg-slate-50 text-slate-350 border-slate-200 cursor-not-allowed opacity-60'
                    : 'bg-white border-indigo-600 hover:bg-indigo-50 text-indigo-700'
                }`}
                title={lang === 'ar' ? `عرض ومعاينة (${userHotkeys.showReceipt})` : `View (${userHotkeys.showReceipt})`}
              >
                <Eye className="w-4 h-4 shrink-0 text-indigo-600" />
                <span className="truncate">{lang === 'ar' ? 'معاينة' : 'Aperçu'}</span>
                <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-slate-100 text-slate-600 select-none">
                  [{userHotkeys.showReceipt}]
                </span>
              </button>
            </div>

            {/* Keyboard Shortcuts Guide Strip */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 flex items-center justify-between gap-1 flex-wrap text-[9px] font-bold text-slate-500">
              <div className="flex items-center gap-1.5 flex-wrap">
                <kbd className="bg-slate-200 px-1 py-0.5 rounded text-slate-700 font-mono">F1</kbd><span>{lang === 'ar' ? 'بيع+طباعة' : 'Print'}</span>
                <span className="text-slate-300">•</span>
                <kbd className="bg-slate-200 px-1 py-0.5 rounded text-slate-700 font-mono">F2</kbd><span>{lang === 'ar' ? 'معاينة' : 'Preview'}</span>
                <span className="text-slate-300">•</span>
                <kbd className="bg-slate-200 px-1 py-0.5 rounded text-slate-700 font-mono">F4</kbd><span>{lang === 'ar' ? 'بيع سريع' : 'Fast'}</span>
                <span className="text-slate-300">•</span>
                <kbd className="bg-slate-200 px-1 py-0.5 rounded text-slate-700 font-mono">F9</kbd><span>{lang === 'ar' ? 'باركود' : 'Barcode'}</span>
                <span className="text-slate-300">•</span>
                <kbd className="bg-slate-200 px-1 py-0.5 rounded text-slate-700 font-mono">Esc</kbd><span>{lang === 'ar' ? 'إغلاق' : 'Close'}</span>
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* POS Quick Thermal Receipt Modal */}
      {showReceiptModal && lastCheckedInvoice && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-sm overflow-hidden animate-fade-in flex flex-col max-h-[90vh]">
            {/* Header / Actions Menu */}
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between shrink-0 mb-1">
              <div className="flex items-center gap-1.5 font-bold">
                <Printer className="w-4 h-4 text-indigo-400" />
                <span className="text-[11.5px] font-black">{lang === 'ar' ? 'نموذج الفاتورة السريعة' : 'Thermal Receipt'}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  id="btn-pos-receipt-print"
                  onClick={() => printThermalReceiptWindow(lastCheckedInvoice.invoiceNumber)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-650 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition shrink-0 cursor-pointer shadow-xs"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>{lang === 'ar' ? 'طباعة الوصل' : 'Print Receipt'}</span>
                </button>
                <button
                  id="btn-pos-receipt-close"
                  onClick={() => setShowReceiptModal(false)}
                  className="text-slate-400 hover:text-white transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Simulated Thermal A80 Print Viewport */}
            <div className="flex-1 overflow-y-auto p-4 bg-slate-100 flex justify-center">
              <div 
                id="pos-thermal-receipt-body" 
                className="w-[70mm] max-w-[70mm] p-2.5 bg-white shadow-md rounded-md border border-slate-300 text-xs font-bold leading-normal text-black"
                style={{ direction: isRTL ? 'rtl' : 'ltr', fontFamily: "'Cairo', 'Tajawal', Tahoma, 'Simplified Arabic', sans-serif" }}
              >
                {/* Header: Logo & Store Info */}
                {config.logoUrl ? (
                  <div className="text-center mb-2">
                    <img 
                      src={config.logoUrl} 
                      alt="Logo" 
                      className="h-10 object-contain mx-auto" 
                      referrerPolicy="no-referrer"
                    />
                  </div>
                ) : (
                  <div className="text-center font-black text-sm text-black uppercase tracking-wider mb-1">
                    🛒 {config.name}
                  </div>
                )}

                <h3 className="text-center font-black text-base text-black mt-0.5 mb-0.5 tracking-tight">
                  {config.name}
                </h3>
                {config.address && (
                  <p className="text-center text-[11px] text-black font-semibold mt-0 mb-0.5 leading-snug">
                    {config.address}
                  </p>
                )}
                <div className="text-center text-[11px] text-black font-semibold">
                  {config.phone && <span>{lang === 'ar' ? 'هاتف:' : 'Tel:'} {config.phone}</span>}
                  {config.registrationNumber && (
                    <span> • {lang === 'ar' ? 'س.ت:' : 'RC:'} {config.registrationNumber}</span>
                  )}
                </div>

                {/* Double solid separator */}
                <div className="divider-thick border-t-2 border-solid border-black my-2"></div>

                {/* Receipt Title & Meta Badge */}
                <div className="text-center mb-2">
                  <span className="inline-block px-2.5 py-0.5 bg-black text-white text-[11px] font-black rounded uppercase tracking-wider">
                    {lang === 'ar' ? 'وصل بيع نقدي' : 'Sales Receipt'}
                  </span>
                </div>

                <div className="space-y-1 text-[11px] text-black font-bold">
                  <div className="flex justify-between items-center">
                    <span className="text-black">{lang === 'ar' ? 'رقم الوصل:' : 'Receipt #:'}</span>
                    <span className="font-mono font-black text-xs text-black">{lastCheckedInvoice.invoiceNumber}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-black">{lang === 'ar' ? 'التاريخ والوقت:' : 'Date & Time:'}</span>
                    <span className="font-mono text-[11px] font-bold">
                      {lastCheckedInvoice.date ? new Date(lastCheckedInvoice.date).toLocaleString(undefined, {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit'
                      }) : ''}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-black">{lang === 'ar' ? 'الكاشير / البائع:' : 'Cashier:'}</span>
                    <span className="font-bold text-black">{lastCheckedInvoice.sellerName || 'System'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-black">{lang === 'ar' ? 'الزبون:' : 'Customer:'}</span>
                    <span className="font-bold text-black">{lastCheckedInvoice.customerName}</span>
                  </div>
                </div>

                <div className="divider border-t border-solid border-black my-2"></div>

                {/* Items Table - Single Line Layout (المنتج, العدد, السعر, المجموع) */}
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b-2 border-solid border-black font-black text-black text-[11px]">
                      <th className="text-start pb-1.5 w-[42%]">{lang === 'ar' ? 'المنتج' : 'Item'}</th>
                      <th className="text-center pb-1.5 px-1 w-[16%]">{lang === 'ar' ? 'العدد' : 'Qty'}</th>
                      <th className="text-end pb-1.5 px-1 w-[21%]">{lang === 'ar' ? 'السعر' : 'Price'}</th>
                      <th className="text-end pb-1.5 w-[21%]">{lang === 'ar' ? 'المجموع' : 'Total'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-solid divide-black">
                    {lastCheckedInvoice.items.map((item) => (
                      <tr key={item.productId} className="border-b-row">
                        <td className="py-1 text-start font-bold text-black text-[11px] leading-tight align-middle">
                          <span>{item.productName}</span>
                          {item.discount > 0 && (
                            <span className="text-[9px] font-bold text-black ms-0.5">(-{item.discount}%)</span>
                          )}
                        </td>
                        <td className="py-1 text-center font-mono font-bold px-1 text-black text-[11px] align-middle whitespace-nowrap">{item.quantity}</td>
                        <td className="py-1 text-end font-mono font-bold text-black px-1 text-[11px] align-middle whitespace-nowrap">{item.sellingPrice.toFixed(2)}</td>
                        <td className="py-1 text-end font-mono font-black text-black text-[11px] align-middle whitespace-nowrap">
                          {item.total.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="divider-thick border-t-2 border-solid border-black my-2"></div>

                {/* Financial Summary */}
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between font-bold text-black">
                    <span>{lang === 'ar' ? 'المجموع الفرعي:' : 'Subtotal:'}</span>
                    <span className="font-mono font-bold">{lastCheckedInvoice.subtotal.toFixed(2)} {config.currency}</span>
                  </div>
                  {lastCheckedInvoice.discount > 0 && (
                    <div className="flex justify-between text-black font-bold">
                      <span>{lang === 'ar' ? 'خصم خاص:' : 'Discount:'}</span>
                      <span className="font-mono font-bold">-{lastCheckedInvoice.discount.toFixed(2)} {config.currency}</span>
                    </div>
                  )}
                  {lastCheckedInvoice.tax > 0 && (
                    <div className="flex justify-between text-black font-semibold">
                      <span>{lang === 'ar' ? 'ضريبة القيمة المضافة:' : 'VAT:'}</span>
                      <span className="font-mono font-bold">+{lastCheckedInvoice.tax.toFixed(2)} {config.currency}</span>
                    </div>
                  )}

                  {/* PROMINENT TOTAL DUE BOX - SINGLE LINE */}
                  <div className="total-card my-2 p-1.5 border-2 border-solid border-black rounded text-black bg-transparent">
                    <div className="flex justify-between items-center whitespace-nowrap" style={{ whiteSpace: 'nowrap' }}>
                      <span className="font-black text-xs uppercase tracking-wide">
                        {lang === 'ar' ? 'المجموع الإجمالي:' : 'Total Due:'}
                      </span>
                      <span className="font-mono font-black text-sm">
                        {lastCheckedInvoice.total.toFixed(2)} {config.currency}
                      </span>
                    </div>
                  </div>

                  {/* Settlement & Payment Method */}
                  <div className="space-y-1 pt-1 font-semibold text-[11px]">
                    <div className="flex justify-between items-center">
                      <span className="text-black font-bold">{lang === 'ar' ? 'طريقة السداد:' : 'Payment Method:'}</span>
                      <span className="font-black text-black">
                        {lastCheckedInvoice.paymentMethod === 'cash' 
                          ? (lang === 'ar' ? 'نقداً (كاش)' : 'Cash')
                          : lastCheckedInvoice.paymentMethod === 'card'
                          ? (lang === 'ar' ? 'بطاقة بنكية' : 'Card')
                          : (lang === 'ar' ? 'دين (آجل)' : 'Debt (Credit)')}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-black font-bold">{lang === 'ar' ? 'عدد المنتجات:' : 'Items Count:'}</span>
                      <span className="font-mono font-black text-black">{lastCheckedInvoice.items.reduce((s, it) => s + it.quantity, 0)}</span>
                    </div>

                    {lastCheckedInvoice.paymentMethod === 'debt' ? (
                      <div className="flex justify-between items-center text-black border border-black p-1 rounded font-black mt-1">
                        <span>{lang === 'ar' ? 'المتبقي كدين على العميل:' : 'Remaining Debt:'}</span>
                        <span className="font-mono font-black">{(lastCheckedInvoice.total - lastCheckedInvoice.amountPaid).toFixed(2)} {config.currency}</span>
                      </div>
                    ) : (
                      lastCheckedInvoice.amountPaid > lastCheckedInvoice.total && (
                        <div className="flex justify-between items-center text-emerald-800 bg-emerald-50 border border-emerald-200 p-1 rounded font-black mt-1">
                          <span>{lang === 'ar' ? 'الباقي للزبون (الصرف):' : 'Change Given:'}</span>
                          <span className="font-mono">{(lastCheckedInvoice.amountPaid - lastCheckedInvoice.total).toFixed(2)} {config.currency}</span>
                        </div>
                      )
                    )}
                  </div>
                </div>

                {/* Real SVG Barcode - Prints 100% reliably on thermal printers */}
                <div 
                  className="my-3 pt-1 flex justify-center items-center"
                  dangerouslySetInnerHTML={{ __html: generateBarcodeSvg(lastCheckedInvoice.invoiceNumber, 36) }}
                />

                <div className="divider border-t border-solid border-black my-2"></div>

                {/* Footer notes */}
                <div className="text-[9px] text-center text-slate-600 font-bold space-y-0.5 leading-snug">
                  <p>{lang === 'ar' ? 'شكراً لزيارتكم! نتطلع لخدمتكم دائماً.' : 'Thank you for your business!'}</p>
                  <p className="text-[8px] text-slate-400">{lang === 'ar' ? 'السلع المباعة تستبدل أو تسترجع وفق الشروط' : 'Goods can be exchanged or returned per policy'}</p>
                  {config.phone && <p className="font-black text-slate-800 mt-1">{config.phone}</p>}
                </div>
              </div>
            </div>

            {/* Bottom confirmation footer to reset cart */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 shrink-0 text-center">
              <button
                id="btn-pos-receipt-next-trans"
                onClick={() => setShowReceiptModal(false)}
                className="w-full py-2.5 bg-indigo-650 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition cursor-pointer shadow-xs"
              >
                {lang === 'ar' ? 'فتح معاملة جديدة كاشير (موافق)' : 'Start New Transaction'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDirectToast.visible && (
        <div className="fixed bottom-6 right-6 bg-slate-950 text-white px-5 py-4 rounded-2xl border border-emerald-505/20 shadow-2xl flex items-center gap-3.5 animate-bounce z-50 max-w-sm">
          <div className="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-500 flex items-center justify-center shrink-0">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
          </div>
          <div className="text-start">
            <p className="text-xs font-black">
              {lang === 'ar' ? 'تم البيع والحفظ بنجاح (بدون طباعة/وصل) !' : 'Invoice saved directly!'}
            </p>
            <p className="text-[10px] text-slate-400 font-mono mt-0.5">
              {showDirectToast.invoiceNumber} · {showDirectToast.total.toFixed(2)} {config.currency}
            </p>
          </div>
        </div>
      )}

      {showCashRegisterModal && (
        <CashRegisterModal
          isOpen={showCashRegisterModal}
          onClose={() => setShowCashRegisterModal(false)}
          invoices={invoices}
          expenses={expenses}
          config={config}
          currentUser={currentUser}
          lang={lang}
        />
      )}

      {/* Mobile Floating Cart Bar when browsing catalog */}
      {mobilePosView === 'catalog' && cart.length > 0 && (
        <div className="lg:hidden fixed bottom-16 left-3 right-3 z-30">
          <button
            type="button"
            onClick={() => setMobilePosView('cart')}
            className="w-full py-3.5 px-4 bg-slate-900 text-white rounded-2xl shadow-2xl border border-indigo-500/40 flex items-center justify-between cursor-pointer active:scale-98 transition"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center font-mono font-black text-xs">
                {cart.reduce((s, it) => s + parseDecimal(it.quantity, 0), 0)}
              </div>
              <span className="text-xs font-black">
                {lang === 'ar' ? 'عرض السلة وإتمام البيع' : 'View Cart & Checkout'}
              </span>
            </div>
            <div className="font-mono font-black text-sm text-emerald-400">
              {total.toFixed(2)} {config.currency} ←
            </div>
          </button>
        </div>
      )}

      {/* Smartphone Camera Barcode Scanner Modal */}
      <CameraBarcodeModal
        isOpen={showCameraScanner}
        onClose={() => setShowCameraScanner(false)}
        onScanCode={(code) => handleBarcodeScan(code)}
        lang={lang}
        allowWirelessPcSend={true}
      />
    </div>
  </div>
);
}
