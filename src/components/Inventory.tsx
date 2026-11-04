import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Product, Language, StoreConfig, Warehouse } from '../types';
import { languages } from '../languages';
import { parseDecimal, sanitizeDecimalInput } from '../utils/numberInput';
import { printHtmlContent, exportCsvFile } from '../utils/printService';
import { compressImageFile } from '../utils/cloudSync';
import { INITIAL_WAREHOUSES } from '../dataStore';
import {
  Plus,
  Search,
  AlertCircle,
  Trash2,
  Edit3,
  X,
  Eye,
  Package,
  Download,
  Upload,
  Barcode,
  Printer,
  Check,
  CheckCircle2,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  Camera,
  BarChart3,
  TrendingUp,
  PieChart,
  PackageCheck,
  PackageX,
  DollarSign,
  Layers,
  Building2,
  FileText,
  MessageCircle,
  Copy,
  Share2,
  Tags,
  ArrowLeft
} from 'lucide-react';
import CameraBarcodeModal from './CameraBarcodeModal';

interface InventoryProps {
  products: Product[];
  config?: StoreConfig;
  onSaveProduct: (product: Product) => void;
  onDeleteProduct: (id: string) => void;
  lang: Language;
  warehouses?: Warehouse[];
  onSaveWarehouse?: (warehouse: Warehouse) => void;
  onDeleteWarehouse?: (id: string) => void;
}

export default function Inventory({ products, config, onSaveProduct, onDeleteProduct, lang, warehouses: initialWarehouses, onSaveWarehouse, onDeleteWarehouse }: InventoryProps) {
  const t = languages[lang];
  const isRTL = t.direction === 'rtl';
  const currency = config?.currency || 'DH';
  const storeName = config?.name || 'Store';

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isEditing, setIsEditing] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);
  const [cameraScanTarget, setCameraScanTarget] = useState<'search' | 'sku' | null>(null);

  // Custom states for sorting and delete modal
  const [sortBy, setSortBy] = useState<'sku' | 'name' | 'category' | 'purchasePrice' | 'sellingPrice' | 'stock'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);

  // Category selection modes & horizontal scroll ref
  const catScrollRef = useRef<HTMLDivElement>(null);
  const [isNewCategoryMode, setIsNewCategoryMode] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  // Barcode stickers modal states
  const [showBarcodeModal, setShowBarcodeModal] = useState(false);
  const [barcodeSearch, setBarcodeSearch] = useState('');
  const [barcodeSelection, setBarcodeSelection] = useState<Record<string, number>>({});
  const [barcodePrintMode, setBarcodePrintMode] = useState<'thermal' | 'a4'>('thermal');

  // Inventory Statistics Modal & Stock Status Filter
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [stockStatusFilter, setStockStatusFilter] = useState<'all' | 'in_stock' | 'out_of_stock' | 'low_stock' | 'expiring_soon'>('all');

  // CSV Import status
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importSummary, setImportSummary] = useState<{ show: boolean; imported: number; updated: number; total: number } | null>(null);

  // Extract unique categories
  const categories = ['all', ...Array.from(new Set(products.map((p) => p.category)))];

  // Warehouses State
  const [localWarehouses, setLocalWarehouses] = useState<Warehouse[]>(() => {
    if (initialWarehouses && initialWarehouses.length > 0) return initialWarehouses;
    try {
      const saved = localStorage.getItem('sales_app_warehouses');
      return saved ? JSON.parse(saved) : INITIAL_WAREHOUSES;
    } catch {
      return INITIAL_WAREHOUSES;
    }
  });

  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('all');
  const [showWarehouseModal, setShowWarehouseModal] = useState(false);
  const [newWhName, setNewWhName] = useState('');
  const [newWhLocation, setNewWhLocation] = useState('');
  const [showReorderModal, setShowReorderModal] = useState(false);

  const handleAddWarehouse = () => {
    if (!newWhName.trim()) {
      alert(lang === 'ar' ? 'يرجى كتابة اسم المخزن!' : 'Please enter warehouse name!');
      return;
    }
    const wh: Warehouse = {
      id: 'wh_' + Date.now(),
      name: newWhName.trim(),
      location: newWhLocation.trim() || undefined,
      isDefault: false
    };
    const updated = [...localWarehouses, wh];
    setLocalWarehouses(updated);
    try {
      localStorage.setItem('sales_app_warehouses', JSON.stringify(updated));
    } catch {}
    if (onSaveWarehouse) onSaveWarehouse(wh);
    setNewWhName('');
    setNewWhLocation('');
  };

  const handleDeleteWh = (whId: string) => {
    if (whId === 'wh-main' || localWarehouses.length <= 1) {
      alert(lang === 'ar' ? 'لا يمكن حذف المخزن الرئيسي الافتراضي!' : 'Cannot delete default main warehouse!');
      return;
    }
    const updated = localWarehouses.filter((w) => w.id !== whId);
    setLocalWarehouses(updated);
    try {
      localStorage.setItem('sales_app_warehouses', JSON.stringify(updated));
    } catch {}
    if (onDeleteWarehouse) onDeleteWarehouse(whId);
  };

  // Filters
  const filteredProducts = products.filter((p) => {
    const matchSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase()) ||
      p.category.toLowerCase().includes(search.toLowerCase());
    const matchCat = selectedCategory === 'all' || p.category === selectedCategory;
    const stockNum = Number(p.stock) || 0;
    const minStockNum = Number(p.minStock) || 0;

    const now = Date.now();
    const diffDays = p.expiryDate ? Math.ceil((new Date(p.expiryDate).getTime() - now) / (1000 * 60 * 60 * 24)) : null;
    const isExpiringSoon = diffDays !== null && diffDays <= 30;

    const matchStockStatus =
      stockStatusFilter === 'all' ||
      (stockStatusFilter === 'in_stock' && stockNum > 0) ||
      (stockStatusFilter === 'out_of_stock' && stockNum <= 0) ||
      (stockStatusFilter === 'low_stock' && stockNum > 0 && stockNum <= minStockNum) ||
      (stockStatusFilter === 'expiring_soon' && isExpiringSoon);

    const matchWarehouse = selectedWarehouse === 'all' || (p.warehouseId || 'wh-main') === selectedWarehouse;

    return matchSearch && matchCat && matchStockStatus && matchWarehouse;
  });

  // Safe sorting
  const sortedProducts = [...filteredProducts].sort((a, b) => {
    let fieldA = a[sortBy];
    let fieldB = b[sortBy];

    if (typeof fieldA === 'string') {
      fieldA = fieldA.toLowerCase();
      fieldB = fieldB.toLowerCase();
    }

    if (fieldA < fieldB) return sortOrder === 'asc' ? -1 : 1;
    if (fieldA > fieldB) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  const handleSort = (field: typeof sortBy) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const renderSortIndicator = (field: typeof sortBy) => {
    if (sortBy !== field) return <span className="text-slate-300 font-normal"> ↕</span>;
    return sortOrder === 'asc' ? <span className="text-indigo-600 font-bold"> ↑</span> : <span className="text-indigo-600 font-bold"> ↓</span>;
  };

  // Low stock alert products
  const lowStockProducts = products.filter((p) => p.stock <= p.minStock);

  const generateUniqueSku = () => {
    const existingSkus = new Set(products.map(p => (p.sku || '').trim().toLowerCase()));
    let candidate = '';
    do {
      candidate = Math.floor(10000000 + Math.random() * 90000000).toString();
    } while (existingSkus.has(candidate));
    return candidate;
  };

  const handleStartAdd = () => {
    setEditingProduct({
      id: '',
      sku: generateUniqueSku(),
      name: '',
      category: '',
      purchasePrice: '' as any,
      sellingPrice: '' as any,
      wholesalePrice: '' as any,
      stock: '' as any,
      minStock: '' as any,
      unit: 'pcs',
      imageUrl: '',
    });
    setIsNewCategoryMode(false);
    setNewCategoryName('');
    setIsEditing(true);
  };

  const handleStartEdit = (p: Product) => {
    setEditingProduct({ ...p });
    setIsNewCategoryMode(false);
    setNewCategoryName('');
    setIsEditing(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;

    const finalCategory = isNewCategoryMode ? newCategoryName.trim() : (editingProduct.category || '');
    const cleanSku = String(editingProduct.sku || '').trim();

    if (
      !editingProduct.name ||
      !cleanSku ||
      !finalCategory
    ) {
      alert(t.common.requiredFields);
      return;
    }

    // Prevent duplicate barcode (SKU)
    const duplicateProduct = products.find(
      p => p.id !== editingProduct.id && (p.sku || '').trim().toLowerCase() === cleanSku.toLowerCase()
    );
    if (duplicateProduct) {
      alert(
        lang === 'ar'
          ? `⚠️ كود الباركود (${cleanSku}) مستخدم مسبقاً للمنتج "${duplicateProduct.name}". لا يمكن تكرار نفس الباركود لأكثر من منتج!`
          : `⚠️ Barcode (${cleanSku}) is already assigned to "${duplicateProduct.name}". Duplicate barcodes are not allowed!`
      );
      return;
    }

    const parsedPurchase = parseDecimal(editingProduct.purchasePrice, 0);
    const parsedSelling = parseDecimal(editingProduct.sellingPrice, 0);
    const parsedWholesale =
      editingProduct.wholesalePrice === undefined || String(editingProduct.wholesalePrice).trim() === ''
        ? parsedSelling
        : parseDecimal(editingProduct.wholesalePrice, parsedSelling);
    const parsedStock = parseDecimal(editingProduct.stock, 0);
    const parsedMinStock =
      editingProduct.minStock === undefined || String(editingProduct.minStock).trim() === ''
        ? 5
        : parseDecimal(editingProduct.minStock, 5);

    const productToSave: Product = {
      id: editingProduct.id || 'prod_' + Date.now(),
      sku: cleanSku,
      name: editingProduct.name.trim(),
      category: finalCategory,
      purchasePrice: parsedPurchase,
      sellingPrice: parsedSelling,
      wholesalePrice: parsedWholesale,
      stock: parsedStock,
      minStock: parsedMinStock,
      unit: editingProduct.unit || 'pcs',
      imageUrl: editingProduct.imageUrl || undefined,
      expiryDate: editingProduct.expiryDate || undefined,
      warehouseId: editingProduct.warehouseId || 'wh-main',
    };

    onSaveProduct(productToSave);
    setIsEditing(false);
    setEditingProduct(null);
  };

  // CSV / Excel Export with explicit UTF-8 BOM
  // Ensures every element appears in its own distinct column in Microsoft Excel!
  const handleExportCSV = async () => {
    const headers = [
      'SKU',
      lang === 'ar' ? 'اسم المنتج' : 'Nom Produit',
      lang === 'ar' ? 'القسم' : 'Categorie',
      lang === 'ar' ? 'سعر الشراء' : 'Prix Achat',
      lang === 'ar' ? 'سعر البيع' : 'Prix Vente',
      lang === 'ar' ? 'سعر الجملة' : 'Prix Gros',
      lang === 'ar' ? 'المخزون' : 'Stock',
      lang === 'ar' ? 'الحد الادنى' : 'Min Stock',
      lang === 'ar' ? 'الوحدة' : 'Unite',
      lang === 'ar' ? 'تاريخ انتهاء الصلاحية' : 'Date Expiration'
    ];
    const rows = products.map(p => [
      `"${(p.sku || '').replace(/"/g, '""')}"`,
      `"${(p.name || '').replace(/"/g, '""')}"`,
      `"${(p.category || '').replace(/"/g, '""')}"`,
      Number(p.purchasePrice || 0).toFixed(2),
      Number(p.sellingPrice || 0).toFixed(2),
      Number(p.wholesalePrice ?? p.sellingPrice ?? 0).toFixed(2),
      Number(p.stock || 0),
      Number(p.minStock || 0),
      `"${(p.unit || 'pcs').replace(/"/g, '""')}"`,
      `"${p.expiryDate || ''}"`
    ]);

    // sep=;\r\n informs Microsoft Excel directly to use semicolon separator so each column is in its own cell!
    const csvContent = 'sep=;\r\n' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\r\n');
    const filename = `inventory_${new Date().toISOString().slice(0, 10)}.csv`;
    await exportCsvFile(csvContent, filename);
  };

  // CSV Import handler
  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        if (!text) return;

        const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0 && !line.trim().toLowerCase().startsWith('sep='));
        if (lines.length < 2) {
          alert(lang === 'ar' ? 'الملف فارغ أو لا يحتوي على بيانات كافية.' : 'File is empty or invalid.');
          return;
        }

        let importedCount = 0;
        let updatedCount = 0;

        const parseCSVLine = (line: string): string[] => {
          const result: string[] = [];
          let cur = '';
          let inQuotes = false;
          for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"' || char === "'") {
              inQuotes = !inQuotes;
            } else if ((char === ',' || char === ';') && !inQuotes) {
              result.push(cur.trim().replace(/^["']|["']$/g, ''));
              cur = '';
            } else {
              cur += char;
            }
          }
          result.push(cur.trim().replace(/^["']|["']$/g, ''));
          return result;
        };

        const firstRow = parseCSVLine(lines[0]);
        const hasHeader = isNaN(Number(firstRow[3])) && isNaN(Number(firstRow[4]));
        const startIdx = hasHeader ? 1 : 0;

        const parseNum = (val: string | undefined): number => {
          if (!val) return 0;
          const cleaned = String(val).replace(/,/g, '.').trim();
          const n = parseFloat(cleaned);
          return isNaN(n) ? 0 : n;
        };

        for (let i = startIdx; i < lines.length; i++) {
          const cols = parseCSVLine(lines[i]);
          if (cols.length < 5) continue;

          const sku = cols[0] || Math.floor(10000000 + Math.random() * 90000000).toString();
          const name = cols[1] || `Item ${i}`;
          const category = cols[2] || 'General';
          const purchasePrice = parseNum(cols[3]);
          const sellingPrice = parseNum(cols[4]);
          const wholesalePrice = cols[5] ? parseNum(cols[5]) : sellingPrice;
          const stock = cols[6] ? parseInt(cols[6].replace(/,/g, '.')) : 0;
          const minStock = cols[7] ? parseInt(cols[7].replace(/,/g, '.')) : 5;
          const unit = cols[8] || 'pcs';

          const existing = products.find(p => p.sku === sku);
          if (existing) {
            onSaveProduct({
              ...existing,
              name: name || existing.name,
              category: category || existing.category,
              purchasePrice: purchasePrice || existing.purchasePrice,
              sellingPrice: sellingPrice || existing.sellingPrice,
              wholesalePrice: wholesalePrice || existing.wholesalePrice,
              stock: !isNaN(stock) ? stock : existing.stock,
              minStock: !isNaN(minStock) ? minStock : existing.minStock,
              unit: unit || existing.unit,
            });
            updatedCount++;
          } else {
            onSaveProduct({
              id: 'prod_' + Date.now() + '_' + i,
              sku,
              name,
              category,
              purchasePrice,
              sellingPrice,
              wholesalePrice,
              stock: !isNaN(stock) ? stock : 0,
              minStock: !isNaN(minStock) ? minStock : 5,
              unit,
            });
            importedCount++;
          }
        }

        setImportSummary({
          show: true,
          imported: importedCount,
          updated: updatedCount,
          total: importedCount + updatedCount,
        });
      } catch (err) {
        console.error(err);
        alert(lang === 'ar' ? 'حدث خطأ أثناء قراءة ملف CSV.' : 'Error reading CSV file.');
      }
    };
    reader.readAsText(file, 'utf-8');
    e.target.value = '';
  };

  // Barcode vector generator
  const getBarcodeSvgString = (sku: string) => {
    const bars: { width: number; isSpace: boolean }[] = [];
    bars.push({ width: 2, isSpace: false });
    bars.push({ width: 1, isSpace: true });
    bars.push({ width: 2, isSpace: false });
    bars.push({ width: 1, isSpace: true });

    const cleanSku = (sku || '000000').slice(0, 14);
    for (let i = 0; i < cleanSku.length; i++) {
      const charCode = cleanSku.charCodeAt(i);
      const w1 = (charCode % 3) + 1;
      const w2 = ((charCode >> 1) % 3) + 1;
      const w3 = ((charCode >> 2) % 2) + 1;
      bars.push({ width: w1, isSpace: false });
      bars.push({ width: w2, isSpace: true });
      bars.push({ width: w3, isSpace: false });
      bars.push({ width: 1, isSpace: true });
    }

    bars.push({ width: 2, isSpace: false });
    bars.push({ width: 1, isSpace: true });
    bars.push({ width: 2, isSpace: false });

    let currentX = 5;
    let rects = '';
    bars.forEach(b => {
      const x = currentX;
      currentX += b.width * 2;
      if (!b.isSpace) {
        rects += `<rect x="${x}" y="0" width="${b.width * 2}" height="32" fill="#000" />`;
      }
    });

    return `
      <div style="display:flex; flex-direction:column; align-items:center; margin: 4px 0;">
        <svg width="${currentX + 5}" height="32" viewBox="0 0 ${currentX + 5} 32">
          ${rects}
        </svg>
        <span style="font-family: monospace; font-size: 10px; font-weight: 800; letter-spacing: 2px; color: #1e293b;">${cleanSku}</span>
      </div>
    `;
  };

  // Print Barcode stickers window (works on iPhone iOS & Desktop)
  const triggerPrintBarcodes = () => {
    const stickers: Product[] = [];
    (Object.entries(barcodeSelection) as [string, number][]).forEach(([prodId, count]) => {
      const prod = products.find(p => p.id === prodId);
      const countNum = Number(count);
      if (prod && countNum > 0) {
        for (let i = 0; i < countNum; i++) {
          stickers.push(prod);
        }
      }
    });

    if (stickers.length === 0) {
      alert(lang === 'ar' ? 'يرجى تحديد منتج واحد على الأقل وتحديد عدد الملصقات.' : 'Please select at least one item.');
      return;
    }

    const stickersHtml = stickers.map(p => `
      <div class="sticker-card">
        <div class="store-name">${storeName}</div>
        <div class="prod-name">${p.name}</div>
        <div class="barcode-container">
          ${getBarcodeSvgString(p.sku)}
        </div>
        <div class="price-tag">${p.sellingPrice.toFixed(2)} ${currency}</div>
      </div>
    `).join('');

    const isThermal = barcodePrintMode === 'thermal';

    const styleAndBodyHtml = `
      <style>
        ${isThermal ? `
          .stickers-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            width: 100%;
          }
          .sticker-card {
            width: 48mm;
            height: 28mm;
            max-width: 100%;
            box-sizing: border-box;
            padding: 1.5mm;
            margin: 0 auto 2mm auto;
            text-align: center;
            page-break-after: always;
            page-break-inside: avoid;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: space-between;
            overflow: hidden;
            border: 1px dashed #cbd5e1;
          }
          .store-name {
            font-size: 8px;
            font-weight: 700;
            text-transform: uppercase;
            color: #475569;
            line-height: 1;
          }
          .prod-name {
            font-size: 9.5px;
            font-weight: 800;
            color: #000;
            margin: 1px 0;
            max-width: 100%;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            line-height: 1.2;
          }
          .barcode-container {
            display: flex;
            justify-content: center;
            margin: 1px 0;
          }
          .price-tag {
            font-size: 11px;
            font-weight: 900;
            font-family: monospace;
            color: #000;
            border-top: 1px solid #cbd5e1;
            padding-top: 1px;
            width: 100%;
            line-height: 1.1;
          }
        ` : `
          .stickers-container {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 6mm;
          }
          .sticker-card {
            border: 1px dashed #cbd5e1;
            border-radius: 8px;
            padding: 8px 10px;
            text-align: center;
            page-break-inside: avoid;
            background: #fff;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: space-between;
            min-height: 115px;
            box-sizing: border-box;
          }
          .store-name {
            font-size: 9px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #64748b;
          }
          .prod-name {
            font-size: 11px;
            font-weight: 800;
            color: #0f172a;
            margin: 2px 0;
            max-width: 100%;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
          .barcode-container {
            display: flex;
            justify-content: center;
          }
          .price-tag {
            font-size: 13px;
            font-weight: 900;
            font-family: monospace;
            color: #0f172a;
            border-top: 1px solid #f1f5f9;
            padding-top: 3px;
            width: 100%;
          }
        `}
      </style>
      <div class="stickers-container">
        ${stickersHtml}
      </div>
    `;

    printHtmlContent({
      title: `Barcode Stickers - ${storeName}`,
      html: styleAndBodyHtml,
      isRTL,
      mode: isThermal ? '80mm' : 'a4',
    });
  };

  return (
    <div className="space-y-6" id="inventory-sec">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Package className="w-6 h-6 text-indigo-600" />
            {t.inventory.title}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {t.inventory.allProducts} ({products.length} {t.pos.itemsCount})
          </p>
        </div>

        {/* Action Buttons Toolbar */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Hidden File Input for CSV Import */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImportCSV}
            accept=".csv,text/csv"
            className="hidden"
          />

          {/* Import CSV */}
          <button
            id="btn-import-csv"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition text-xs cursor-pointer border border-slate-200"
            title={lang === 'ar' ? 'استيراد منتجات من ملف CSV / Excel' : 'Import products from CSV'}
          >
            <Upload className="w-4 h-4 text-slate-600" />
            <span>{lang === 'ar' ? 'استيراد CSV' : 'Import CSV'}</span>
          </button>

          {/* Export CSV */}
          <button
            id="btn-export-csv"
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition text-xs cursor-pointer border border-slate-200"
            title={lang === 'ar' ? 'تصدير المخزون كملف Excel / CSV مرتب في خانات منفصلة' : 'Export products to Excel'}
          >
            <Download className="w-4 h-4 text-emerald-600" />
            <span>{lang === 'ar' ? 'تصدير Excel' : 'Export Excel'}</span>
          </button>

          {/* Inventory Statistics Modal Button */}
          <button
            id="btn-inventory-stats"
            onClick={() => setShowStatsModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold rounded-xl transition text-xs cursor-pointer border border-emerald-200 shadow-2xs"
            title={lang === 'ar' ? 'عرض كافة إحصائيات المخزن، رأس المال، المنتجات المتوفرة والمنتهية' : 'Inventory Statistics & Valuation'}
          >
            <BarChart3 className="w-4 h-4 text-emerald-600" />
            <span>{lang === 'ar' ? 'إحصائيات المخزن' : 'Statistiques Stock'}</span>
          </button>

          {/* Manage Warehouses Button */}
          <button
            id="btn-manage-warehouses"
            onClick={() => setShowWarehouseModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold rounded-xl transition text-xs cursor-pointer border border-purple-200 shadow-2xs"
            title={lang === 'ar' ? 'إدارة المستودعات والمخازن المتعددة' : 'Manage Multiple Warehouses'}
          >
            <Building2 className="w-4 h-4 text-purple-600" />
            <span>{lang === 'ar' ? `المخازن (${localWarehouses.length})` : `Warehouses (${localWarehouses.length})`}</span>
          </button>

          {/* Auto Reorder Low Stock Button */}
          {lowStockProducts.length > 0 && (
            <button
              id="btn-auto-reorder-low-stock"
              onClick={() => setShowReorderModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl transition text-xs cursor-pointer shadow-xs animate-pulse"
              title={lang === 'ar' ? 'توليد سند طلب شراء للموردين بجميع النواقص' : 'Generate Purchase Order for Low Stock'}
            >
              <FileText className="w-4 h-4" />
              <span>{lang === 'ar' ? `طلب شراء نواقص (${lowStockProducts.length})` : `Reorder (${lowStockProducts.length})`}</span>
            </button>
          )}

          {/* Barcode Stickers Modal Button */}
          <button
            id="btn-open-barcode-stickers"
            onClick={() => {
              const initial: Record<string, number> = {};
              products.forEach(p => {
                if (p.stock > 0) initial[p.id] = Math.min(5, p.stock);
              });
              setBarcodeSelection(initial);
              setShowBarcodeModal(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-xl transition text-xs cursor-pointer border border-indigo-200"
            title={lang === 'ar' ? 'إنشاء وطباعة ملصقات الباركود' : 'Generate & Print Barcode Labels'}
          >
            <Barcode className="w-4 h-4 text-indigo-600" />
            <span>{lang === 'ar' ? 'طباعة الباركود' : 'Print Barcodes'}</span>
          </button>

          {/* Add Product Button */}
          <button
            id="btn-add-prod"
            onClick={handleStartAdd}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition duration-200 shadow-sm text-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{t.inventory.addProduct}</span>
          </button>
        </div>
      </div>

      {/* Notifications - Low Stock alerts */}
      {lowStockProducts.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5" id="stock-alerts-box">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-amber-900 text-base">{t.inventory.stockAlert}</h3>
              <p className="text-sm text-amber-700 mt-1 mb-3">{t.inventory.stockAlertDesc}</p>
              <div className="flex flex-wrap gap-2">
                {lowStockProducts.slice(0, 6).map((lp) => (
                  <span
                    key={lp.id}
                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-100 text-amber-800 rounded-lg text-xs font-medium border border-amber-200"
                  >
                    <span className="w-2 h-2 rounded-full bg-amber-600"></span>
                    {lp.name} ({lp.stock} {lp.unit} / Min: {lp.minStock})
                  </span>
                ))}
                {lowStockProducts.length > 6 && (
                  <span className="text-xs text-amber-600 flex items-center font-semibold bg-amber-100/50 px-2.5 py-1 rounded-lg">
                    + {lowStockProducts.length - 6} more...
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Search and Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        {/* Search Input */}
        <div className="relative flex-1 flex gap-2">
          <div className="relative flex-1">
            <span className={`absolute inset-y-0 ${isRTL ? 'right-4' : 'left-4'} flex items-center text-slate-400`}>
              <Search className="w-5 h-5" />
            </span>
            <input
              id="inv-search-input"
              type="text"
              placeholder={t.inventory.search}
              className={`w-full py-3 ${isRTL ? 'pr-12 pl-4' : 'pl-12 pr-4'} bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition duration-150 shadow-xs`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button
            type="button"
            onClick={() => setCameraScanTarget('search')}
            className="px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-xs cursor-pointer shrink-0 transition"
            title={lang === 'ar' ? 'مسح الباركود بالكاميرا للبحث' : 'Scan Barcode with Camera'}
          >
            <Camera className="w-4 h-4" />
            <span className="hidden sm:inline">{lang === 'ar' ? 'مسح باركود' : 'Scan'}</span>
          </button>
        </div>

        {/* Compact Horizontal Scrollable Category Bar with Left/Right Controls */}
        <div className="flex items-center gap-1.5 max-w-full md:max-w-md bg-white p-1 rounded-2xl border border-slate-200">
          <button
            type="button"
            onClick={() => {
              if (catScrollRef.current) {
                catScrollRef.current.scrollBy({ left: isRTL ? 150 : -150, behavior: 'smooth' });
              }
            }}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition shrink-0 cursor-pointer"
            title="Scroll"
          >
            <ChevronRight className={`w-4 h-4 ${isRTL ? '' : 'rotate-180'}`} />
          </button>

          <div ref={catScrollRef} className="flex gap-1.5 overflow-x-auto no-scrollbar scroll-smooth py-0.5">
            {categories.map((cat) => (
              <button
                id={`cat-filter-${cat}`}
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition whitespace-nowrap capitalize cursor-pointer shrink-0 ${
                  selectedCategory === cat
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cat === 'all' ? t.pos.allCategories : cat}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => {
              if (catScrollRef.current) {
                catScrollRef.current.scrollBy({ left: isRTL ? -150 : 150, behavior: 'smooth' });
              }
            }}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition shrink-0 cursor-pointer"
            title="Scroll"
          >
            <ChevronLeft className={`w-4 h-4 ${isRTL ? '' : 'rotate-180'}`} />
          </button>
        </div>

        {/* Warehouse Filter */}
        {localWarehouses.length > 1 && (
          <div className="flex items-center gap-1.5 bg-white px-3.5 py-2 rounded-2xl border border-slate-200 text-xs font-bold text-slate-700 shrink-0 shadow-2xs">
            <Building2 className="w-4 h-4 text-purple-600" />
            <select
              value={selectedWarehouse}
              onChange={(e) => setSelectedWarehouse(e.target.value)}
              className="bg-transparent border-none focus:outline-none cursor-pointer font-bold text-slate-800"
            >
              <option value="all">{lang === 'ar' ? '🏢 كل المستودعات' : '🏢 All Warehouses'}</option>
              {localWarehouses.map((wh) => (
                <option key={wh.id} value={wh.id}>📍 {wh.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Active Stock Status Filter Chip */}
      {stockStatusFilter !== 'all' && (
        <div className="flex items-center gap-2 px-3.5 py-2 bg-indigo-50 border border-indigo-200 rounded-2xl text-xs font-bold text-indigo-900 w-fit animate-fade-in shadow-2xs">
          <span>
            {lang === 'ar' ? 'تصفية المخزن حسب:' : 'Filter:'} <b className="text-indigo-950 font-black">{
              stockStatusFilter === 'in_stock' ? (lang === 'ar' ? 'المنتجات المتوفرة فقط' : 'In Stock only') :
              stockStatusFilter === 'out_of_stock' ? (lang === 'ar' ? 'المنتجات المنتهية (غير المتوفرة) فقط' : 'Out of Stock only') :
              stockStatusFilter === 'expiring_soon' ? (lang === 'ar' ? 'المنتجات قريبة من انتهاء الصلاحية (خلال 30 يوم)' : 'Expiring Soon only') :
              (lang === 'ar' ? 'المنتجات قريبة من النفاد' : 'Low Stock only')
            }</b>
          </span>
          <button
            type="button"
            onClick={() => setStockStatusFilter('all')}
            className="px-2 py-0.5 bg-indigo-200/80 hover:bg-indigo-300 rounded-lg text-indigo-900 cursor-pointer flex items-center gap-1 font-black text-[11px] transition"
            title={lang === 'ar' ? 'إلغاء التصفية وإظهار الكل' : 'Clear filter'}
          >
            <X className="w-3.5 h-3.5" />
            <span>{lang === 'ar' ? 'إلغاء التصفية' : 'Clear'}</span>
          </button>
        </div>
      )}

      {/* Mobile-Friendly Product Cards Grid (Optimized for iPhone & Mobile) */}
      <div className="block md:hidden space-y-3" id="inv-mobile-cards-section">
        {sortedProducts.length > 0 ? (
          sortedProducts.map((p) => {
            const isLow = p.stock <= p.minStock;
            const isOut = p.stock === 0;

            return (
              <div
                key={p.id}
                className="bg-white border border-slate-200/80 rounded-2xl p-3.5 shadow-xs space-y-3"
              >
                {/* Header: Name, Image, Category & Stock Status */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    {p.imageUrl ? (
                      <img
                        src={p.imageUrl}
                        alt={p.name}
                        className="w-11 h-11 rounded-xl object-cover shrink-0 border border-slate-200 shadow-2xs"
                      />
                    ) : (
                      <div className="w-11 h-11 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 shrink-0">
                        <Package className="w-5 h-5" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <h4 className="font-black text-slate-900 text-sm truncate leading-snug">
                        {p.name}
                      </h4>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        <span className="font-mono text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md font-semibold">
                          {p.sku}
                        </span>
                        <span className="text-[10px] text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md font-bold">
                          {p.category}
                        </span>
                        {p.expiryDate && (() => {
                          const diffDays = Math.ceil((new Date(p.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                          const isExpired = diffDays <= 0;
                          const isNear = diffDays > 0 && diffDays <= 30;
                          return (
                            <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md ${
                              isExpired ? 'bg-rose-100 text-rose-700' : isNear ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-500'
                            }`}>
                              {isExpired ? (lang === 'ar' ? '⚠️ منتهي' : '⚠️ Exp') : isNear ? (lang === 'ar' ? `⏳ ${diffDays} يوم` : `⏳ ${diffDays}d`) : `📅 ${p.expiryDate}`}
                            </span>
                          );
                        })()}
                      </div>
                    </div>
                  </div>

                  {/* Stock Badge */}
                  <div className="shrink-0 text-end">
                    <span
                      className={`text-xs font-black px-2.5 py-1 rounded-full inline-block ${
                        isOut
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : isLow
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      }`}
                    >
                      {p.stock} {p.unit}
                    </span>
                    <span className="block text-[10px] font-bold text-slate-400 mt-0.5">
                      {isOut ? t.inventory.outOfStock : isLow ? t.inventory.lowStock : t.inventory.okStock}
                    </span>
                  </div>
                </div>

                {/* Pricing Grid */}
                <div className="grid grid-cols-3 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-center">
                  <div className="p-1.5 bg-white rounded-lg border border-slate-200/60 shadow-2xs">
                    <span className="block text-[10px] font-bold text-slate-400">{t.inventory.sellingPrice}</span>
                    <span className="font-black text-xs sm:text-sm text-indigo-600 font-mono">
                      {p.sellingPrice.toFixed(2)}
                    </span>
                  </div>
                  <div className="p-1.5 bg-white rounded-lg border border-slate-200/60 shadow-2xs">
                    <span className="block text-[10px] font-bold text-slate-400">{t.inventory.purchasePrice}</span>
                    <span className="font-bold text-xs text-slate-700 font-mono">
                      {p.purchasePrice.toFixed(2)}
                    </span>
                  </div>
                  <div className="p-1.5 bg-white rounded-lg border border-slate-200/60 shadow-2xs">
                    <span className="block text-[10px] font-bold text-slate-400">
                      {lang === 'ar' ? 'الجملة' : 'Gros'}
                    </span>
                    <span className="font-bold text-xs text-slate-700 font-mono">
                      {(p.wholesalePrice ?? p.sellingPrice).toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Actions Row */}
                <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100">
                  <button
                    onClick={() => {
                      setBarcodeSelection({ [p.id]: Math.max(1, p.stock || 1) });
                      setShowBarcodeModal(true);
                    }}
                    className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                  >
                    <Barcode className="w-3.5 h-3.5" />
                    <span>{lang === 'ar' ? 'باركود' : 'Code'}</span>
                  </button>
                  <button
                    onClick={() => handleStartEdit(p)}
                    className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>{lang === 'ar' ? 'تعديل' : 'Modifier'}</span>
                  </button>
                  <button
                    onClick={() => setDeletingProductId(p.id)}
                    className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{lang === 'ar' ? 'حذف' : 'Supprimer'}</span>
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="bg-white rounded-2xl p-8 text-center text-slate-400 border border-slate-100">
            <Package className="w-10 h-10 stroke-[1.2] mx-auto text-slate-300 mb-2" />
            <p className="text-xs font-bold">No products found matching filters.</p>
          </div>
        )}
      </div>

      {/* Product Table Grid (Desktop & Tablet) */}
      <div className="hidden md:block bg-white border border-slate-100 rounded-2xl shadow-xs overflow-hidden" id="inv-table-section">
        <div className="overflow-x-auto">
          <table className="w-full text-right sm:text-inherit">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr className="text-slate-600 text-xs font-semibold uppercase tracking-wider text-center select-none">
                <th onClick={() => handleSort('sku')} className="px-6 py-4 text-start cursor-pointer hover:bg-slate-100/80 transition">
                  {t.inventory.sku}{renderSortIndicator('sku')}
                </th>
                <th onClick={() => handleSort('name')} className="px-6 py-4 text-start cursor-pointer hover:bg-slate-100/80 transition">
                  {t.inventory.name}{renderSortIndicator('name')}
                </th>
                <th onClick={() => handleSort('category')} className="px-6 py-4 text-start cursor-pointer hover:bg-slate-100/80 transition">
                  {t.inventory.category}{renderSortIndicator('category')}
                </th>
                <th onClick={() => handleSort('purchasePrice')} className="px-6 py-4 text-center cursor-pointer hover:bg-slate-100/80 transition">
                  {t.inventory.purchasePrice}{renderSortIndicator('purchasePrice')}
                </th>
                <th onClick={() => handleSort('sellingPrice')} className="px-6 py-4 text-center cursor-pointer hover:bg-slate-100/80 transition">
                  {t.inventory.sellingPrice}{renderSortIndicator('sellingPrice')}
                </th>
                <th onClick={() => handleSort('wholesalePrice' as any)} className="px-6 py-4 text-center cursor-pointer hover:bg-slate-100/80 transition">
                  {lang === 'ar' ? 'سعر الجملة' : lang === 'fr' ? 'Prix de gros' : 'Wholesale Price'}{renderSortIndicator('wholesalePrice' as any)}
                </th>
                <th onClick={() => handleSort('stock')} className="px-6 py-4 text-center cursor-pointer hover:bg-slate-100/80 transition">
                  {t.inventory.stock}{renderSortIndicator('stock')}
                </th>
                <th className="px-6 py-4 text-center">{t.inventory.actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {sortedProducts.length > 0 ? (
                sortedProducts.map((p) => {
                  const isLow = p.stock <= p.minStock;
                  const isOut = p.stock === 0;

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/50 transition">
                      <td className="px-6 py-4 font-mono font-medium text-slate-500 text-start">{p.sku}</td>
                      <td className="px-6 py-4 text-slate-900 font-semibold text-start">
                        <div className="flex items-center gap-2.5">
                          {p.imageUrl ? (
                            <img src={p.imageUrl} alt={p.name} className="w-9 h-9 rounded-lg object-cover shrink-0 border border-slate-200 shadow-2xs" />
                          ) : (
                            <div className="w-9 h-9 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 shrink-0">
                              <Package className="w-4 h-4" />
                            </div>
                          )}
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-900">{p.name}</span>
                            {p.expiryDate && (() => {
                              const diffDays = Math.ceil((new Date(p.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                              const isExpired = diffDays <= 0;
                              const isNear = diffDays > 0 && diffDays <= 30;
                              return (
                                <span className={`inline-flex items-center gap-1 text-[10px] font-black px-1.5 py-0.5 rounded-md w-fit mt-0.5 ${
                                  isExpired ? 'bg-rose-100 text-rose-700' : isNear ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-500'
                                }`}>
                                  {isExpired ? (lang === 'ar' ? '⚠️ منتهي الصلاحية' : '⚠️ Expired') : isNear ? (lang === 'ar' ? `⏳ ينتهي بعد ${diffDays} يوم` : `⏳ Exp: ${diffDays}d`) : `📅 ${p.expiryDate}`}
                                </span>
                              );
                            })()}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-start">
                        <span className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-md text-xs font-semibold">
                          {p.category}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-600 text-center font-mono">{p.purchasePrice.toFixed(2)} {currency}</td>
                      <td className="px-6 py-4 text-slate-900 font-bold text-center font-mono">{p.sellingPrice.toFixed(2)} {currency}</td>
                      <td className="px-6 py-4 text-slate-700 font-bold text-center font-mono">{(p.wholesalePrice ?? p.sellingPrice).toFixed(2)} {currency}</td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex flex-col items-center justify-center">
                          <span className={`font-semibold ${isOut ? 'text-red-600' : isLow ? 'text-amber-600' : 'text-slate-900'}`}>
                            {p.stock} {p.unit}
                          </span>
                          <span
                            className={`text-[10px] uppercase font-bold mt-0.5 px-2 py-0.5 rounded-full ${
                              isOut
                                ? 'bg-red-50 text-red-700'
                                : isLow
                                ? 'bg-amber-50 text-amber-700'
                                : 'bg-emerald-50 text-emerald-700'
                            }`}
                          >
                            {isOut ? t.inventory.outOfStock : isLow ? t.inventory.lowStock : t.inventory.okStock}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            id={`btn-barcode-${p.id}`}
                            onClick={() => {
                              setBarcodeSelection({ [p.id]: Math.max(1, p.stock || 1) });
                              setShowBarcodeModal(true);
                            }}
                            className="p-1.5 hover:bg-indigo-50 text-indigo-600 rounded-lg transition cursor-pointer"
                            title={lang === 'ar' ? 'طباعة باركود للمنتج' : 'Print Barcode'}
                          >
                            <Barcode className="w-4 h-4" />
                          </button>
                          <button
                            id={`btn-edit-${p.id}`}
                            onClick={() => handleStartEdit(p)}
                            className="p-1.5 hover:bg-slate-100 text-indigo-600 rounded-lg transition cursor-pointer"
                            title={t.inventory.editProduct}
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            id={`btn-delete-${p.id}`}
                            onClick={() => {
                              setDeletingProductId(p.id);
                            }}
                            className="p-1.5 hover:bg-rose-50 text-rose-600 rounded-lg transition cursor-pointer"
                            title={t.inventory.delete}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400">
                    <Package className="w-12 h-12 stroke-[1.2] mx-auto text-slate-300 mb-3" />
                    No products found matching filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Editor Modal Overlay - Safe Area Aware for iPhone Status Bar */}
      {isEditing && editingProduct && (() => {
        const cleanCurrentSku = String(editingProduct.sku || '').trim();
        const duplicateSkuProd = cleanCurrentSku
          ? products.find(p => p.id !== editingProduct.id && (p.sku || '').trim().toLowerCase() === cleanCurrentSku.toLowerCase())
          : undefined;

        return createPortal(
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-start sm:items-center justify-center px-3 sm:px-4 z-[200] overflow-y-auto safe-modal-overlay"
            style={{
              paddingTop: 'max(3.25rem, calc(env(safe-area-inset-top, 20px) + 1rem))',
              paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom, 20px))'
            }}
            id="edit-product-modal"
            dir={isRTL ? 'rtl' : 'ltr'}
          >
            <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-lg max-h-[calc(100dvh-4.75rem)] flex flex-col overflow-hidden animate-fade-in my-auto">
              <div className="flex justify-between items-center bg-slate-50 px-5 sm:px-6 py-3.5 border-b border-slate-100 shrink-0">
                <h2 className="font-black text-slate-800 text-base sm:text-lg">
                  {editingProduct.id ? t.inventory.editProduct : t.inventory.addProduct}
                </h2>
                <button
                  id="btn-close-modal"
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="p-1.5 hover:bg-slate-200 text-slate-400 hover:text-slate-600 rounded-xl transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSave} className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1">
                <div className="grid grid-cols-2 gap-4">
                  {/* Product Image Input with Preview & File Upload */}
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                      {lang === 'ar' ? 'صورة المنتج' : 'Product Image'}
                    </label>
                    <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                      <div className="w-16 h-16 rounded-xl border-2 border-dashed border-slate-300 bg-white flex items-center justify-center overflow-hidden shrink-0 shadow-2xs">
                        {editingProduct.imageUrl ? (
                          <img
                            src={editingProduct.imageUrl}
                            alt="Product Preview"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Package className="w-6 h-6 text-slate-400" />
                        )}
                      </div>
                      <div className="flex-1 space-y-2">
                        <input
                          id="form-p-image-url"
                          type="text"
                          placeholder={lang === 'ar' ? 'أدخل رابط الصورة (URL) هنا...' : 'https://example.com/photo.jpg'}
                          value={editingProduct.imageUrl || ''}
                          onChange={(e) => setEditingProduct({ ...editingProduct, imageUrl: e.target.value })}
                          className="w-full px-3 py-1.5 border border-slate-200 bg-white rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                        <div className="flex items-center gap-3">
                          <label className="px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold cursor-pointer transition flex items-center gap-1.5 border border-indigo-200">
                            <Upload className="w-3.5 h-3.5" />
                            <span>{lang === 'ar' ? 'اختيار صورة من الجهاز' : 'Upload File'}</span>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  try {
                                    const compressed = await compressImageFile(file, 220, 0.72);
                                    setEditingProduct({ ...editingProduct, imageUrl: compressed });
                                  } catch {
                                    const reader = new FileReader();
                                    reader.onload = (event) => {
                                      if (event.target?.result) {
                                        setEditingProduct({ ...editingProduct, imageUrl: event.target.result as string });
                                      }
                                    };
                                    reader.readAsDataURL(file);
                                  }
                                }
                              }}
                            />
                          </label>
                          {editingProduct.imageUrl && (
                            <button
                              type="button"
                              onClick={() => setEditingProduct({ ...editingProduct, imageUrl: '' })}
                              className="text-xs text-rose-500 hover:text-rose-700 font-bold cursor-pointer"
                            >
                              {lang === 'ar' ? 'إزالة الصورة' : 'Remove Image'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">{t.inventory.name} *</label>
                    <input
                      id="form-p-name"
                      required
                      type="text"
                      value={editingProduct.name || ''}
                      onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold text-slate-800"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">{t.inventory.sku} *</label>
                    <div className="flex gap-1.5">
                      <input
                        id="form-p-sku"
                        required
                        type="text"
                        value={editingProduct.sku || ''}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => setEditingProduct({ ...editingProduct, sku: e.target.value })}
                        className={`w-full px-3.5 py-2.5 border rounded-lg focus:outline-none focus:ring-2 font-mono font-medium ${
                          duplicateSkuProd
                            ? 'border-rose-400 bg-rose-50 text-rose-800 focus:ring-rose-500'
                            : 'border-slate-200 text-slate-700 focus:ring-indigo-500'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setCameraScanTarget('sku')}
                        className="px-3.5 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-200 rounded-lg transition cursor-pointer shrink-0 flex items-center justify-center gap-1.5 text-xs font-bold"
                        title={lang === 'ar' ? 'مسح باركود السلعة بالكاميرا' : 'Scan Barcode with Camera'}
                      >
                        <Camera className="w-4 h-4" />
                        <span className="hidden sm:inline">{lang === 'ar' ? 'مسح' : 'Scan'}</span>
                      </button>
                    </div>
                    {duplicateSkuProd && (
                      <p className="text-[11px] font-bold text-rose-600 mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>
                          {lang === 'ar'
                            ? `هذا الكود بار مكرر ومستخدم مسبقاً للمنتج: "${duplicateSkuProd.name}"`
                            : `Duplicate barcode! Already used by "${duplicateSkuProd.name}"`}
                        </span>
                      </p>
                    )}
                  </div>

                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">{t.inventory.category} *</label>
                    <div className="space-y-2">
                      <select
                        id="form-p-category-select"
                        required
                        value={isNewCategoryMode ? '__new__' : (editingProduct.category || '')}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === '__new__') {
                            setIsNewCategoryMode(true);
                            setEditingProduct({ ...editingProduct, category: '' });
                          } else {
                            setIsNewCategoryMode(false);
                            setEditingProduct({ ...editingProduct, category: val });
                          }
                        }}
                        className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700 font-medium bg-white"
                      >
                        <option value="" disabled>{lang === 'ar' ? '-- اختر الصنف --' : '-- Select Category --'}</option>
                        {Array.from(new Set(products.map((p) => p.category))).filter(Boolean).map((cat) => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                        <option value="__new__">➕ {lang === 'ar' ? 'إضافة صنف جديد...' : 'Create New Category...'}</option>
                      </select>

                      {isNewCategoryMode && (
                        <input
                          id="form-p-category-custom"
                          required
                          type="text"
                          placeholder={lang === 'ar' ? 'اكتب اسم الصنف الجديد هنا' : 'Type new category name...'}
                          value={newCategoryName}
                          onChange={(e) => {
                            setNewCategoryName(e.target.value);
                            setEditingProduct({ ...editingProduct, category: e.target.value });
                          }}
                          className="w-full px-3.5 py-2.5 border border-slate-200 bg-amber-50/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700 font-bold"
                        />
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">{t.inventory.purchasePrice} * ({currency})</label>
                    <input
                      id="form-p-purchase"
                      required
                      type="text"
                      inputMode="decimal"
                      placeholder="0.00"
                      onFocus={(e) => e.target.select()}
                      value={editingProduct.purchasePrice === 0 || (editingProduct.purchasePrice as any) === '0' ? '' : (editingProduct.purchasePrice ?? '')}
                      onChange={(e) => setEditingProduct({ ...editingProduct, purchasePrice: sanitizeDecimalInput(e.target.value) as any })}
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 font-bold font-mono placeholder:text-slate-300 placeholder:font-normal"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">{t.inventory.sellingPrice} * ({currency})</label>
                    <input
                      id="form-p-selling"
                      required
                      type="text"
                      inputMode="decimal"
                      placeholder="0.00"
                      onFocus={(e) => e.target.select()}
                      value={editingProduct.sellingPrice === 0 || (editingProduct.sellingPrice as any) === '0' ? '' : (editingProduct.sellingPrice ?? '')}
                      onChange={(e) => setEditingProduct({ ...editingProduct, sellingPrice: sanitizeDecimalInput(e.target.value) as any })}
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 font-bold font-mono placeholder:text-slate-300 placeholder:font-normal"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                      {lang === 'ar' ? `سعر البيع بالجملة (${currency})` : lang === 'fr' ? `Prix de gros (${currency})` : `Wholesale Price (${currency})`}
                    </label>
                    <input
                      id="form-p-wholesale"
                      type="text"
                      inputMode="decimal"
                      placeholder="0.00"
                      onFocus={(e) => e.target.select()}
                      value={editingProduct.wholesalePrice === 0 || (editingProduct.wholesalePrice as any) === '0' ? '' : (editingProduct.wholesalePrice ?? '')}
                      onChange={(e) => setEditingProduct({ ...editingProduct, wholesalePrice: sanitizeDecimalInput(e.target.value) as any })}
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 font-bold font-mono placeholder:text-slate-300 placeholder:font-normal"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">{t.inventory.stock} *</label>
                    <input
                      id="form-p-stock"
                      type="text"
                      inputMode="decimal"
                      placeholder="0"
                      onFocus={(e) => e.target.select()}
                      value={editingProduct.stock === 0 || (editingProduct.stock as any) === '0' ? '' : (editingProduct.stock ?? '')}
                      onChange={(e) => setEditingProduct({ ...editingProduct, stock: sanitizeDecimalInput(e.target.value) as any })}
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 font-bold font-mono placeholder:text-slate-300 placeholder:font-normal"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">{t.inventory.minStock}</label>
                    <input
                      id="form-p-minstock"
                      type="text"
                      inputMode="decimal"
                      placeholder="5"
                      onFocus={(e) => e.target.select()}
                      value={editingProduct.minStock === 0 || (editingProduct.minStock as any) === '0' ? '' : (editingProduct.minStock ?? '')}
                      onChange={(e) => setEditingProduct({ ...editingProduct, minStock: sanitizeDecimalInput(e.target.value) as any })}
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700 font-semibold font-mono placeholder:text-slate-300 placeholder:font-normal"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">{t.inventory.unit}</label>
                    <input
                      id="form-p-unit"
                      type="text"
                      placeholder="pcs, bag, kg, pack..."
                      value={editingProduct.unit || 'pcs'}
                      onChange={(e) => setEditingProduct({ ...editingProduct, unit: e.target.value })}
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-600"
                    />
                  </div>

                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                      {lang === 'ar' ? 'تاريخ انتهاء الصلاحية' : 'Expiry Date'}
                    </label>
                    <input
                      id="form-p-expiry"
                      type="date"
                      value={editingProduct.expiryDate || ''}
                      onChange={(e) => setEditingProduct({ ...editingProduct, expiryDate: e.target.value })}
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700 font-semibold"
                    />
                  </div>

                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                      {lang === 'ar' ? 'المستودع / المخزن' : 'Warehouse'}
                    </label>
                    <select
                      id="form-p-warehouse"
                      value={editingProduct.warehouseId || 'wh-main'}
                      onChange={(e) => setEditingProduct({ ...editingProduct, warehouseId: e.target.value })}
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700 font-bold bg-white"
                    >
                      {localWarehouses.map((wh) => (
                        <option key={wh.id} value={wh.id}>
                          {wh.name} {wh.location ? `(${wh.location})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                  <button
                    id="btn-edit-cancel"
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="px-4.5 py-2.5 hover:bg-slate-100 text-slate-600 font-bold rounded-xl transition cursor-pointer"
                  >
                    {t.inventory.cancel}
                  </button>
                  <button
                    id="btn-edit-save"
                    type="submit"
                    disabled={!!duplicateSkuProd}
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold rounded-xl transition cursor-pointer"
                  >
                    {t.inventory.save}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        );
      })()}

      {/* Custom Product Delete Dialog Overlay */}
      {deletingProductId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 safe-modal-overlay">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-md overflow-hidden p-6 space-y-4 animate-fade-in text-start">
            <div className={`flex items-center gap-3 text-rose-600 pb-2 border-b border-slate-100 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <Trash2 className="w-6 h-6 shrink-0" />
              <h3 className="text-lg font-black tracking-tight text-slate-800">
                {lang === 'ar' ? 'تاكيد حذف الصنف' : 'Confirm Product Deletion'}
              </h3>
            </div>
            <p className="text-sm text-slate-600 font-semibold leading-relaxed">
              {lang === 'ar'
                ? `هل أنت متأكد تماماً من رغبتك في حذف المنتج "${products.find(prod => prod.id === deletingProductId)?.name || ''}" ؟`
                : `Are you absolutely sure you want to delete "${products.find(prod => prod.id === deletingProductId)?.name || ''}" from the warehouse?`}
            </p>
            <div className="bg-rose-50 text-[11px] text-rose-800 p-3 rounded-xl border border-rose-100 font-medium leading-relaxed">
              {lang === 'ar'
                ? 'تنبيه: سيتم إزالة هذا المنتج نهائياً من الرفوف، لكن بيانات الفواتير السابقة لن تتأثر.'
                : 'Warning: This will permanent remove this product from catalog. Past generated receipts will preserve their items.'}
            </div>
            <div className={`flex items-center justify-end gap-3 pt-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <button
                id="btn-confirm-prod-cancel"
                onClick={() => setDeletingProductId(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
              >
                {t.inventory.cancel}
              </button>
              <button
                id="btn-confirm-prod-delete"
                onClick={() => {
                  onDeleteProduct(deletingProductId);
                  setDeletingProductId(null);
                }}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-xl text-xs transition cursor-pointer"
              >
                {t.inventory.delete}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Barcode Stickers Printing Modal */}
      {showBarcodeModal && createPortal(
        <div 
          className="fixed inset-0 z-[200] bg-slate-900/70 backdrop-blur-xs flex flex-col sm:items-center sm:justify-center p-0 sm:p-4 overflow-hidden"
          dir={isRTL ? 'rtl' : 'ltr'}
        >
          <div className="bg-white rounded-none sm:rounded-3xl shadow-2xl border-0 sm:border border-slate-100 w-full max-w-4xl h-full sm:h-auto sm:max-h-[92vh] overflow-hidden animate-fade-in text-start flex flex-col">
            {/* Top Header */}
            <div 
              className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center bg-slate-50 px-3.5 sm:px-6 py-3 sm:py-4 border-b border-slate-200 shrink-0 gap-2.5"
              style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top, 0px))' }}
            >
              <div className="flex items-center justify-between sm:justify-start gap-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-indigo-100 text-indigo-700 rounded-xl">
                    <Barcode className="w-5 h-5 text-indigo-600 shrink-0" />
                  </div>
                  <h3 className="font-bold text-slate-800 text-sm sm:text-base">
                    {lang === 'ar' ? 'مولد وطباعة ملصقات الباركود' : 'Barcode Labels & Sticker Printer'}
                  </h3>
                </div>

                {/* Mobile Header Close Button */}
                <button
                  type="button"
                  onClick={() => setShowBarcodeModal(false)}
                  className="sm:hidden flex items-center gap-1.5 px-3 py-1.5 bg-slate-200 hover:bg-slate-300 active:bg-slate-400 text-slate-800 rounded-xl text-xs font-black transition cursor-pointer shadow-2xs border border-slate-300"
                  title={lang === 'ar' ? 'إغلاق وعودة' : 'Fermer / Retour'}
                >
                  <ArrowLeft className={`w-3.5 h-3.5 ${isRTL ? 'rotate-180' : ''}`} />
                  <span>{lang === 'ar' ? 'عودة' : 'Retour'}</span>
                </button>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-3">
                <div className="flex bg-slate-200/80 p-0.5 rounded-xl text-xs font-bold flex-1 sm:flex-none">
                  <button
                    type="button"
                    onClick={() => setBarcodePrintMode('thermal')}
                    className={`flex-1 sm:flex-none px-2.5 py-1.5 rounded-lg transition cursor-pointer text-center ${
                      barcodePrintMode === 'thermal' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {lang === 'ar' ? 'طابعة حرارية رول (Roll)' : 'Thermal Roll'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setBarcodePrintMode('a4')}
                    className={`flex-1 sm:flex-none px-2.5 py-1.5 rounded-lg transition cursor-pointer text-center ${
                      barcodePrintMode === 'a4' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {lang === 'ar' ? 'ورق A4 متعدد' : 'A4 Sheet'}
                  </button>
                </div>

                <button
                  onClick={() => setShowBarcodeModal(false)}
                  className="hidden sm:flex p-1.5 hover:bg-slate-200 text-slate-400 hover:text-slate-700 rounded-lg transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Main Body */}
            <div 
              className="p-3 sm:p-6 overflow-y-auto flex-1 space-y-4 sm:space-y-6 overscroll-contain touch-pan-y"
              style={{ WebkitOverflowScrolling: 'touch' }}
            >
              {/* Selection Toolbar */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2.5 sm:gap-3 bg-slate-50 p-3 sm:p-4 rounded-2xl border border-slate-100">
                <div className="relative flex-1 w-full">
                  <Search className="w-4 h-4 text-slate-400 absolute start-3 top-3" />
                  <input
                    type="text"
                    placeholder={lang === 'ar' ? 'ابحث عن منتج بالاسم أو الباركود...' : 'Search items...'}
                    value={barcodeSearch}
                    onChange={(e) => setBarcodeSearch(e.target.value)}
                    className="w-full ps-9 pe-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    onClick={() => {
                      const all: Record<string, number> = {};
                      products.forEach(p => { all[p.id] = Math.max(1, p.stock || 1); });
                      setBarcodeSelection(all);
                    }}
                    className="flex-1 sm:flex-none px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition cursor-pointer text-center"
                  >
                    {lang === 'ar' ? 'تحديد الكل' : 'Select All'}
                  </button>
                  <button
                    onClick={() => setBarcodeSelection({})}
                    className="flex-1 sm:flex-none px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-500 border border-slate-200 rounded-xl text-xs font-bold transition cursor-pointer text-center"
                  >
                    {lang === 'ar' ? 'إلغاء التحديد' : 'Clear'}
                  </button>
                </div>
              </div>

              {/* Product Selection List: Mobile Responsive Cards (sm:hidden) */}
              <div className="block sm:hidden space-y-2">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block px-1">
                  {lang === 'ar' ? 'اختر المنتجات وحدد عدد الملصقات لكل منتج:' : 'Select products & stickers count:'}
                </span>
                <div className="space-y-2 max-h-72 overflow-y-auto p-1">
                  {products
                    .filter(p => p.name.toLowerCase().includes(barcodeSearch.toLowerCase()) || p.sku.toLowerCase().includes(barcodeSearch.toLowerCase()))
                    .map(p => {
                      const count = barcodeSelection[p.id] || 0;
                      const isChecked = count > 0;
                      return (
                        <div
                          key={p.id}
                          className={`p-3 rounded-2xl border transition-all ${
                            isChecked ? 'bg-indigo-50/50 border-indigo-200 shadow-2xs' : 'bg-white border-slate-200'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <label className="flex items-center gap-2 min-w-0 cursor-pointer flex-1">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  setBarcodeSelection({
                                    ...barcodeSelection,
                                    [p.id]: e.target.checked ? Math.max(1, p.stock || 1) : 0
                                  });
                                }}
                                className="rounded text-indigo-600 focus:ring-indigo-500 shrink-0 w-4 h-4"
                              />
                              <div className="min-w-0">
                                <span className="font-black text-slate-900 text-xs block truncate">{p.name}</span>
                                <span className="text-[10px] font-mono text-slate-500 block">{p.sku}</span>
                              </div>
                            </label>
                            <span className="font-mono font-black text-slate-800 text-xs shrink-0">
                              {p.sellingPrice.toFixed(2)} {currency}
                            </span>
                          </div>

                          <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
                            <span className="text-[10px] font-bold text-slate-500">{lang === 'ar' ? 'عدد الملصقات:' : 'Stickers:'}</span>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  const current = barcodeSelection[p.id] || 0;
                                  if (current > 0) {
                                    setBarcodeSelection({ ...barcodeSelection, [p.id]: current - 1 });
                                  }
                                }}
                                className="w-7 h-7 bg-slate-100 active:bg-slate-200 rounded-lg text-slate-700 font-black flex items-center justify-center text-sm cursor-pointer"
                              >
                                -
                              </button>
                              <input
                                type="number"
                                min="0"
                                max="500"
                                value={count}
                                onChange={(e) => {
                                  const val = Math.max(0, parseInt(e.target.value) || 0);
                                  setBarcodeSelection({ ...barcodeSelection, [p.id]: val });
                                }}
                                className="w-14 px-1 py-1 text-center font-black border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const current = barcodeSelection[p.id] || 0;
                                  setBarcodeSelection({ ...barcodeSelection, [p.id]: current + 1 });
                                }}
                                className="w-7 h-7 bg-indigo-50 active:bg-indigo-100 rounded-lg text-indigo-700 font-black flex items-center justify-center text-sm cursor-pointer"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Product Selection List: Desktop Table (hidden sm:block) */}
              <div className="hidden sm:block border border-slate-200 rounded-2xl overflow-hidden max-h-56 overflow-y-auto shadow-2xs">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold sticky top-0">
                    <tr>
                      <th className="p-3 text-start w-10">#</th>
                      <th className="p-3 text-start">{lang === 'ar' ? 'المنتج' : 'Product'}</th>
                      <th className="p-3 text-center">{lang === 'ar' ? 'الباركود (SKU)' : 'Barcode SKU'}</th>
                      <th className="p-3 text-center">{lang === 'ar' ? 'السعر' : 'Price'}</th>
                      <th className="p-3 text-center w-32">{lang === 'ar' ? 'عدد الملصقات' : 'Stickers Count'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-semibold">
                    {products
                      .filter(p => p.name.toLowerCase().includes(barcodeSearch.toLowerCase()) || p.sku.toLowerCase().includes(barcodeSearch.toLowerCase()))
                      .map(p => {
                        const count = barcodeSelection[p.id] || 0;
                        const isChecked = count > 0;
                        return (
                          <tr key={p.id} className={isChecked ? 'bg-indigo-50/40' : 'hover:bg-slate-50'}>
                            <td className="p-3 text-center">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  setBarcodeSelection({
                                    ...barcodeSelection,
                                    [p.id]: e.target.checked ? Math.max(1, p.stock || 1) : 0
                                  });
                                }}
                                className="rounded text-indigo-600 focus:ring-indigo-500"
                              />
                            </td>
                            <td className="p-3 text-slate-800 font-bold">{p.name}</td>
                            <td className="p-3 text-center font-mono text-slate-500">{p.sku}</td>
                            <td className="p-3 text-center font-mono font-bold text-slate-700">{p.sellingPrice.toFixed(2)} {currency}</td>
                            <td className="p-3 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <input
                                  type="number"
                                  min="0"
                                  max="500"
                                  value={count}
                                  onChange={(e) => {
                                    const val = Math.max(0, parseInt(e.target.value) || 0);
                                    setBarcodeSelection({ ...barcodeSelection, [p.id]: val });
                                  }}
                                  className="w-16 px-2 py-1 text-center font-bold border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 bg-white"
                                />
                                <span className="text-[10px] text-slate-400">{lang === 'ar' ? 'ملصق' : 'pcs'}</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>

              {/* Live Sticker Preview Box */}
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-500">
                    {lang === 'ar' ? 'معاينة شكل الملصقات قبل الطباعة:' : 'Live Labels Preview:'}
                  </h4>
                  <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-100">
                    {lang === 'ar'
                      ? `إجمالي الملصقات: ${(Object.values(barcodeSelection) as number[]).reduce((a, b) => a + Number(b), 0)} ملصق`
                      : `Total: ${(Object.values(barcodeSelection) as number[]).reduce((a, b) => a + Number(b), 0)} stickers`}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 sm:gap-3 bg-slate-100/70 p-3 sm:p-4 rounded-2xl border border-slate-200 max-h-56 sm:max-h-60 overflow-y-auto">
                  {(Object.entries(barcodeSelection) as [string, number][]).filter(([_, count]) => Number(count) > 0).length === 0 ? (
                    <div className="col-span-full py-6 sm:py-8 text-center text-slate-400 font-semibold text-xs">
                      {lang === 'ar' ? 'حدد المنتجات وعدد الملصقات لمعاينتها هنا.' : 'Select products above to preview labels.'}
                    </div>
                  ) : (
                    (Object.entries(barcodeSelection) as [string, number][])
                      .filter(([_, count]) => Number(count) > 0)
                      .map(([prodId, count]) => {
                        const prod = products.find(p => p.id === prodId);
                        if (!prod) return null;
                        return (
                          <div
                            key={prod.id}
                            className="bg-white rounded-xl border border-dashed border-slate-300 p-2.5 sm:p-3 flex flex-col items-center justify-between text-center shadow-xs"
                          >
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block truncate w-full">{storeName}</span>
                            <span className="text-xs font-black text-slate-800 line-clamp-1 mt-0.5">{prod.name}</span>
                            <div className="my-1 sm:my-1.5 w-full flex justify-center overflow-hidden" dangerouslySetInnerHTML={{ __html: getBarcodeSvgString(prod.sku) }} />
                            <span className="text-xs sm:text-sm font-black font-mono text-slate-900 border-t border-slate-100 pt-1 w-full block">
                              {prod.sellingPrice.toFixed(2)} {currency}
                            </span>
                            <span className="text-[9px] sm:text-[10px] text-indigo-600 font-bold mt-1 bg-indigo-50 px-2 py-0.5 rounded-full">
                              x{count} {lang === 'ar' ? 'نسخ' : 'copies'}
                            </span>
                          </div>
                        );
                      })
                  )}
                </div>
              </div>
            </div>

            {/* Footer with Prominent Actions */}
            <div 
              className="bg-slate-50 px-3.5 sm:px-6 py-2.5 sm:py-4 border-t border-slate-200 flex items-center justify-between gap-2.5 shrink-0"
              style={{ paddingBottom: 'max(0.85rem, env(safe-area-inset-bottom, 0px))' }}
            >
              <button
                type="button"
                onClick={() => setShowBarcodeModal(false)}
                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 bg-slate-200 hover:bg-slate-300 active:bg-slate-400 text-slate-800 text-xs font-black rounded-xl transition cursor-pointer border border-slate-300 shadow-2xs"
              >
                <ArrowLeft className={`w-4 h-4 shrink-0 ${isRTL ? 'rotate-180' : ''}`} />
                <span>{lang === 'ar' ? 'إغلاق وعودة' : 'Fermer / Retour'}</span>
              </button>
              <button
                id="btn-print-barcode-stickers-bottom"
                type="button"
                onClick={triggerPrintBarcodes}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-black rounded-xl transition cursor-pointer shadow-xs"
              >
                <Printer className="w-4 h-4 shrink-0" />
                <span>{lang === 'ar' ? 'بدء الطباعة الآن' : 'Print Labels Now'}</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* CSV Import Feedback Toast / Modal */}
      {importSummary && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 safe-modal-overlay">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-sm overflow-hidden p-6 text-center animate-fade-in space-y-4">
            <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-emerald-600">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-800">
                {lang === 'ar' ? 'تم استيراد البيانات بنجاح' : 'Import Completed'}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                {lang === 'ar'
                  ? `تمت معالجة ${importSummary.total} منتج من ملف CSV.`
                  : `Processed ${importSummary.total} products from CSV file.`}
              </p>
            </div>
            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 text-xs font-bold text-slate-600 space-y-1">
              <div className="flex justify-between">
                <span>{lang === 'ar' ? 'منتجات جديدة مضافة:' : 'New products added:'}</span>
                <span className="text-emerald-600 font-mono font-black">{importSummary.imported}</span>
              </div>
              <div className="flex justify-between">
                <span>{lang === 'ar' ? 'منتجات حالية تم تحديثها:' : 'Existing updated:'}</span>
                <span className="text-indigo-600 font-mono font-black">{importSummary.updated}</span>
              </div>
            </div>
            <button
              onClick={() => setImportSummary(null)}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-xs transition cursor-pointer"
            >
              {lang === 'ar' ? 'حسناً (موافق)' : 'OK'}
            </button>
          </div>
        </div>
      )}

      {/* Camera Barcode Scanner for Inventory Search or SKU Input */}
      <CameraBarcodeModal
        isOpen={cameraScanTarget !== null}
        onClose={() => setCameraScanTarget(null)}
        onScanCode={(code) => {
          if (cameraScanTarget === 'sku' && editingProduct) {
            const cleanScanned = String(code || '').trim();
            const existingProd = products.find(
              p => p.id !== editingProduct.id && (p.sku || '').trim().toLowerCase() === cleanScanned.toLowerCase()
            );
            if (existingProd) {
              alert(
                lang === 'ar'
                  ? `⚠️ تنبيه: الباركود الممسوح (${cleanScanned}) مسجل مسبقاً للمنتج "${existingProd.name}". لا يمكن تكرار الباركود!`
                  : `⚠️ Barcode (${cleanScanned}) is already assigned to "${existingProd.name}"!`
              );
            } else {
              setEditingProduct({ ...editingProduct, sku: cleanScanned });
            }
          } else {
            setSearch(code);
          }
          setCameraScanTarget(null);
        }}
        lang={lang}
        allowWirelessPcSend={false}
      />

      {/* Inventory Comprehensive Statistics Modal */}
      {showStatsModal && (() => {
        const totalProducts = products.length;
        const inStockProducts = products.filter(p => (Number(p.stock) || 0) > 0);
        const outOfStockProducts = products.filter(p => (Number(p.stock) || 0) <= 0);
        const lowStockList = products.filter(p => {
          const s = Number(p.stock) || 0;
          const ms = Number(p.minStock) || 0;
          return s > 0 && s <= ms;
        });
        const totalStockUnits = products.reduce((acc, p) => acc + (Number(p.stock) || 0), 0);
        const totalPurchaseValue = products.reduce((acc, p) => acc + (Math.max(0, Number(p.stock) || 0) * (Number(p.purchasePrice) || 0)), 0);
        const totalSellingValue = products.reduce((acc, p) => acc + (Math.max(0, Number(p.stock) || 0) * (Number(p.sellingPrice) || 0)), 0);
        const expectedProfit = totalSellingValue - totalPurchaseValue;
        const profitMargin = totalSellingValue > 0 ? (expectedProfit / totalSellingValue) * 100 : 0;

        const categoryStats = categories.filter(c => c !== 'all').map(cat => {
          const catProds = products.filter(p => p.category === cat);
          const catUnits = catProds.reduce((sum, p) => sum + (Number(p.stock) || 0), 0);
          const catPurchaseVal = catProds.reduce((sum, p) => sum + (Math.max(0, Number(p.stock) || 0) * (Number(p.purchasePrice) || 0)), 0);
          const catSellingVal = catProds.reduce((sum, p) => sum + (Math.max(0, Number(p.stock) || 0) * (Number(p.sellingPrice) || 0)), 0);
          return {
            category: cat,
            count: catProds.length,
            units: catUnits,
            purchaseValue: catPurchaseVal,
            sellingValue: catSellingVal,
            expectedProfit: catSellingVal - catPurchaseVal
          };
        }).sort((a, b) => b.sellingValue - a.sellingValue);

        return createPortal(
          <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 z-[200] safe-modal-overlay" dir={isRTL ? 'rtl' : 'ltr'}>
            <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-fade-in">
              {/* Modal Header */}
              <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-400">
                    <BarChart3 className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-black">
                      {lang === 'ar' ? 'إحصائيات المخزن ورأس المال الشاملة' : 'Inventory Statistics & Valuation'}
                    </h2>
                    <p className="text-xs text-slate-400">
                      {lang === 'ar' ? 'بيانات تفصيلية دقيقة عن المخزون، رأس المال، المنتجات المتوفرة والمنتهية' : 'Detailed breakdown of stock values, profit margins and availability'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowStatsModal(false)}
                  className="p-2 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1 text-slate-800">
                {/* 4 Key Metric Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                  {/* Card 1: Total Products */}
                  <div className="bg-gradient-to-br from-indigo-50 to-indigo-100/50 border border-indigo-200/80 rounded-2xl p-4">
                    <div className="flex items-center justify-between text-indigo-600 mb-2">
                      <span className="text-xs font-black">{lang === 'ar' ? 'مجموع المنتجات' : 'Total Products'}</span>
                      <Package className="w-4.5 h-4.5" />
                    </div>
                    <div className="text-xl sm:text-2xl font-black font-mono text-indigo-950">
                      {totalProducts} <span className="text-xs font-normal text-slate-600">{lang === 'ar' ? 'صنف' : 'items'}</span>
                    </div>
                    <div className="text-[11px] font-bold text-indigo-700 mt-1">
                      {totalStockUnits.toLocaleString()} {lang === 'ar' ? 'قطعة في المخزن' : 'units in stock'}
                    </div>
                  </div>

                  {/* Card 2: Purchase Value */}
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 border border-blue-200/80 rounded-2xl p-4">
                    <div className="flex items-center justify-between text-blue-600 mb-2">
                      <span className="text-xs font-black">{lang === 'ar' ? 'قيمة الشراء (رأس المال)' : 'Purchase Cost (Capital)'}</span>
                      <DollarSign className="w-4.5 h-4.5" />
                    </div>
                    <div className="text-xl sm:text-2xl font-black font-mono text-blue-950">
                      {totalPurchaseValue.toFixed(2)}
                    </div>
                    <div className="text-[11px] font-bold text-blue-700 mt-1">
                      {currency} ({lang === 'ar' ? 'تكلفة شراء المخزون الحالي' : 'cost of current stock'})
                    </div>
                  </div>

                  {/* Card 3: Selling Value */}
                  <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 border border-emerald-200/80 rounded-2xl p-4">
                    <div className="flex items-center justify-between text-emerald-600 mb-2">
                      <span className="text-xs font-black">{lang === 'ar' ? 'قيمة البيع (المبيعات المتوقعة)' : 'Total Selling Value'}</span>
                      <TrendingUp className="w-4.5 h-4.5" />
                    </div>
                    <div className="text-xl sm:text-2xl font-black font-mono text-emerald-950">
                      {totalSellingValue.toFixed(2)}
                    </div>
                    <div className="text-[11px] font-bold text-emerald-700 mt-1">
                      {currency} ({lang === 'ar' ? 'القيمة السوقية للمخزن' : 'market stock value'})
                    </div>
                  </div>

                  {/* Card 4: Expected Profit */}
                  <div className="bg-gradient-to-br from-purple-50 to-purple-100/50 border border-purple-200/80 rounded-2xl p-4">
                    <div className="flex items-center justify-between text-purple-600 mb-2">
                      <span className="text-xs font-black">{lang === 'ar' ? 'صافي الربح المتوقع' : 'Expected Profit'}</span>
                      <PieChart className="w-4.5 h-4.5" />
                    </div>
                    <div className="text-xl sm:text-2xl font-black font-mono text-purple-950">
                      {expectedProfit.toFixed(2)} <span className="text-xs text-purple-700 font-bold">{currency}</span>
                    </div>
                    <div className="text-[11px] font-bold text-purple-700 mt-1">
                      {lang === 'ar' ? 'هامش ربح:' : 'Margin:'} <b className="font-mono">%{profitMargin.toFixed(1)}</b>
                    </div>
                  </div>
                </div>

                {/* 3 Availability Status Filter Pills */}
                <div>
                  <h3 className="text-xs font-black text-slate-500 uppercase tracking-wider mb-2.5">
                    {lang === 'ar' ? 'حالة توفر المنتجات في المخزن:' : 'Stock Availability Status:'}
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* In Stock */}
                    <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-3.5 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                          <PackageCheck className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-black text-emerald-950">{lang === 'ar' ? 'منتجات متوفرة (موجودة)' : 'In Stock'}</div>
                          <div className="text-xs font-mono font-black text-emerald-700">{inStockProducts.length} {lang === 'ar' ? 'منتج متوفر' : 'items'}</div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setStockStatusFilter('in_stock');
                          setShowStatsModal(false);
                        }}
                        className="px-2.5 py-1 bg-white hover:bg-emerald-100 border border-emerald-300 text-emerald-800 text-[11px] font-black rounded-lg transition cursor-pointer shadow-2xs"
                      >
                        {lang === 'ar' ? 'عرض القائمة' : 'Filter'}
                      </button>
                    </div>

                    {/* Out of Stock */}
                    <div className="bg-rose-50/70 border border-rose-200 rounded-2xl p-3.5 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                          <PackageX className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-black text-rose-950">{lang === 'ar' ? 'منتجات نفذت (غير موجودة)' : 'Out of Stock'}</div>
                          <div className="text-xs font-mono font-black text-rose-700">{outOfStockProducts.length} {lang === 'ar' ? 'منتج منتهي' : 'items'}</div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setStockStatusFilter('out_of_stock');
                          setShowStatsModal(false);
                        }}
                        className="px-2.5 py-1 bg-white hover:bg-rose-100 border border-rose-300 text-rose-800 text-[11px] font-black rounded-lg transition cursor-pointer shadow-2xs"
                      >
                        {lang === 'ar' ? 'عرض القائمة' : 'Filter'}
                      </button>
                    </div>

                    {/* Low Stock Alert */}
                    <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-3.5 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                          <AlertCircle className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-black text-amber-950">{lang === 'ar' ? 'قريبة من النفاد (إنذار)' : 'Low Stock Alert'}</div>
                          <div className="text-xs font-mono font-black text-amber-700">{lowStockList.length} {lang === 'ar' ? 'منتج تحت الحد' : 'items'}</div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setStockStatusFilter('low_stock');
                          setShowStatsModal(false);
                        }}
                        className="px-2.5 py-1 bg-white hover:bg-amber-100 border border-amber-300 text-amber-800 text-[11px] font-black rounded-lg transition cursor-pointer shadow-2xs"
                      >
                        {lang === 'ar' ? 'عرض القائمة' : 'Filter'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Categories Distribution Table */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center gap-2 text-slate-800 font-black text-sm">
                    <Layers className="w-4 h-4 text-indigo-600" />
                    <span>{lang === 'ar' ? 'توزيع المخزون والقيمة حسب الأقسام:' : 'Inventory Breakdown by Category:'}</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500 font-black uppercase text-[10px]">
                          <th className="py-2 text-start">{lang === 'ar' ? 'القسم' : 'Category'}</th>
                          <th className="py-2 text-center">{lang === 'ar' ? 'عدد الأصناف' : 'Products'}</th>
                          <th className="py-2 text-center">{lang === 'ar' ? 'كمية القطع' : 'Units'}</th>
                          <th className="py-2 text-end">{lang === 'ar' ? 'قيمة الشراء' : 'Purchase Cost'}</th>
                          <th className="py-2 text-end">{lang === 'ar' ? 'قيمة البيع' : 'Selling Value'}</th>
                          <th className="py-2 text-end text-emerald-700">{lang === 'ar' ? 'الربح المتوقع' : 'Profit'}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-bold">
                        {categoryStats.map(cs => (
                          <tr key={cs.category} className="hover:bg-white/80 transition">
                            <td className="py-2.5 text-start font-black text-slate-900">{cs.category}</td>
                            <td className="py-2.5 text-center font-mono">{cs.count}</td>
                            <td className="py-2.5 text-center font-mono text-indigo-600">{cs.units}</td>
                            <td className="py-2.5 text-end font-mono text-slate-700">{cs.purchaseValue.toFixed(2)} {currency}</td>
                            <td className="py-2.5 text-end font-mono text-emerald-700">{cs.sellingValue.toFixed(2)} {currency}</td>
                            <td className="py-2.5 text-end font-mono text-emerald-600 font-black">+{cs.expectedProfit.toFixed(2)} {currency}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 shrink-0">
                <div className="text-xs font-bold text-slate-500">
                  {stockStatusFilter !== 'all' && (
                    <button
                      type="button"
                      onClick={() => setStockStatusFilter('all')}
                      className="text-rose-600 hover:text-rose-800 underline cursor-pointer"
                    >
                      {lang === 'ar' ? 'إعادة تعيين فلتر المخزون' : 'Reset Filter'}
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowStatsModal(false)}
                    className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-black rounded-xl transition cursor-pointer shadow-xs"
                  >
                    {lang === 'ar' ? 'إغلاق' : 'Close'}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        );
      })()}

      {/* Manage Warehouses Modal */}
      {showWarehouseModal && createPortal(
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 z-[200] safe-modal-overlay" dir={isRTL ? 'rtl' : 'ltr'}>
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-lg overflow-hidden animate-fade-in flex flex-col max-h-[90vh]">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <Building2 className="w-5 h-5 text-purple-400" />
                <h3 className="font-black text-base">
                  {lang === 'ar' ? 'إدارة المخازن والمستودعات' : 'Warehouses & Depots'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowWarehouseModal(false)}
                className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-5 flex-1">
              {/* Add New Warehouse Form */}
              <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-2xl space-y-3">
                <span className="text-xs font-black text-slate-700 block">
                  {lang === 'ar' ? '+ إضافة مستودع أو مخزن جديد' : '+ Add New Warehouse'}
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder={lang === 'ar' ? 'اسم المخزن (مثال: مخزن 2)' : 'Warehouse Name'}
                    value={newWhName}
                    onChange={(e) => setNewWhName(e.target.value)}
                    className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <input
                    type="text"
                    placeholder={lang === 'ar' ? 'الموقع / العنوان (اختياري)' : 'Location (Optional)'}
                    value={newWhLocation}
                    onChange={(e) => setNewWhLocation(e.target.value)}
                    className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAddWarehouse}
                  className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-black transition cursor-pointer shadow-xs"
                >
                  {lang === 'ar' ? 'حفظ وإضافة المخزن' : 'Add Warehouse'}
                </button>
              </div>

              {/* Existing Warehouses List */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                  {lang === 'ar' ? 'المستودعات المسجلة في النظام:' : 'Registered Warehouses:'}
                </span>
                {localWarehouses.map((wh) => {
                  const prodCount = products.filter((p) => (p.warehouseId || 'wh-main') === wh.id).length;
                  return (
                    <div
                      key={wh.id}
                      className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl shadow-2xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center font-black text-xs shrink-0">
                          <Building2 className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-black text-slate-900 flex items-center gap-2">
                            <span>{wh.name}</span>
                            {wh.id === 'wh-main' && (
                              <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-bold">
                                {lang === 'ar' ? 'الرئيسي' : 'Default'}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {wh.location ? `${wh.location} • ` : ''}
                            <b className="text-purple-700 font-mono">{prodCount}</b> {lang === 'ar' ? 'منتج مسجل' : 'products'}
                          </div>
                        </div>
                      </div>

                      {wh.id !== 'wh-main' && (
                        <button
                          type="button"
                          onClick={() => handleDeleteWh(wh.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                          title={lang === 'ar' ? 'حذف المخزن' : 'Delete'}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-slate-50 px-6 py-3 border-t border-slate-100 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setShowWarehouseModal(false)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-black rounded-xl transition cursor-pointer"
              >
                {lang === 'ar' ? 'تم (إغلاق)' : 'Close'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Auto Reorder Low Stock Modal */}
      {showReorderModal && createPortal(
        <div 
          className="fixed inset-0 z-[200] bg-slate-900/70 backdrop-blur-xs flex flex-col sm:items-center sm:justify-center p-0 sm:p-4 overflow-hidden"
          dir={isRTL ? 'rtl' : 'ltr'}
        >
          <div className="bg-white rounded-none sm:rounded-3xl shadow-2xl border-0 sm:border border-slate-100 w-full max-w-3xl h-full sm:h-auto sm:max-h-[90vh] overflow-hidden animate-fade-in flex flex-col">
            {/* Header */}
            <div 
              className="bg-slate-900 text-white px-3.5 sm:px-6 py-3 sm:py-4 flex items-center justify-between shrink-0 gap-2 border-b border-slate-800"
              style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top, 0px))' }}
            >
              <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                <div className="p-1.5 sm:p-2 bg-amber-500/20 text-amber-400 rounded-xl shrink-0">
                  <FileText className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-black text-xs sm:text-base truncate">
                    {lang === 'ar' ? 'سند طلب شراء النواقص للموردين' : 'Auto Purchase Order (Low Stock)'}
                  </h3>
                  <p className="text-[9px] sm:text-[11px] text-slate-400 truncate">
                    {lang === 'ar' ? `حصر تلقائي لـ ${lowStockProducts.length} منتج وصل للحد الأدنى من المخزون` : `Reorder list for ${lowStockProducts.length} items below minimum stock`}
                  </p>
                </div>
              </div>

              {/* Explicit Back / Close Button in Header */}
              <button
                type="button"
                onClick={() => setShowReorderModal(false)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-white rounded-xl text-xs font-black transition cursor-pointer shrink-0 shadow-2xs border border-slate-700"
                title={lang === 'ar' ? 'إغلاق وعودة' : 'Fermer / Retour'}
              >
                <ArrowLeft className={`w-3.5 h-3.5 ${isRTL ? 'rotate-180' : ''}`} />
                <span>{lang === 'ar' ? 'عودة' : 'Retour'}</span>
              </button>
            </div>

            {/* Content Body: Responsive Cards on Mobile + Table on Desktop */}
            <div 
              className="p-3 sm:p-5 overflow-y-auto space-y-3 sm:space-y-4 flex-1 overscroll-contain touch-pan-y"
              style={{ WebkitOverflowScrolling: 'touch' }}
            >
              {/* Mobile View: High-contrast responsive cards (sm:hidden) */}
              <div className="block sm:hidden space-y-2.5">
                {lowStockProducts.map((p, idx) => {
                  const suggested = Math.max(1, p.minStock * 2 - p.stock);
                  return (
                    <div key={p.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 shadow-2xs">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <span className="w-5 h-5 rounded-md bg-slate-200 text-slate-700 text-[10px] font-black flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <span className="font-black text-slate-900 text-xs">{p.name}</span>
                        </div>
                        <span className="px-1.5 py-0.5 bg-slate-200/80 text-slate-600 rounded text-[9px] font-mono shrink-0">
                          {p.sku}
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-1.5 pt-1 text-center">
                        <div className="bg-rose-50 border border-rose-100 rounded-lg p-1.5">
                          <span className="text-[9px] text-rose-600 font-bold block">{lang === 'ar' ? 'المتوفر' : 'Stock'}</span>
                          <span className="text-xs font-black font-mono text-rose-700">{p.stock} {p.unit}</span>
                        </div>
                        <div className="bg-slate-100/80 border border-slate-200 rounded-lg p-1.5">
                          <span className="text-[9px] text-slate-500 font-bold block">{lang === 'ar' ? 'الأدنى' : 'Min'}</span>
                          <span className="text-xs font-black font-mono text-slate-700">{p.minStock} {p.unit}</span>
                        </div>
                        <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-1.5">
                          <span className="text-[9px] text-indigo-600 font-bold block">{lang === 'ar' ? 'المطلوب' : 'Order'}</span>
                          <span className="text-xs font-black font-mono text-indigo-700">+{suggested} {p.unit}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 text-[11px]">
                        <span className="text-slate-500 font-medium">{lang === 'ar' ? 'سعر الشراء المقدر:' : 'Cost:'}</span>
                        <span className="font-black font-mono text-slate-800">{p.purchasePrice.toFixed(2)} {currency}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop / Tablet View: Wide Table (hidden sm:block) */}
              <div className="hidden sm:block border border-slate-200 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-start min-w-[550px]">
                    <thead className="bg-slate-50 border-b border-slate-200 font-black text-slate-600">
                      <tr>
                        <th className="p-3 text-start w-8">#</th>
                        <th className="p-3 text-start">{lang === 'ar' ? 'المنتج' : 'Product'}</th>
                        <th className="p-3 text-center">{lang === 'ar' ? 'المخزون الحالي' : 'Stock'}</th>
                        <th className="p-3 text-center">{lang === 'ar' ? 'الحد الأدنى' : 'Min'}</th>
                        <th className="p-3 text-center">{lang === 'ar' ? 'الكمية المقترحة' : 'Order Qty'}</th>
                        <th className="p-3 text-end">{lang === 'ar' ? 'سعر الشراء' : 'Cost'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-bold">
                      {lowStockProducts.map((p, idx) => {
                        const suggested = Math.max(1, p.minStock * 2 - p.stock);
                        return (
                          <tr key={p.id} className="hover:bg-slate-50/50">
                            <td className="p-3 text-slate-400 font-mono">{idx + 1}</td>
                            <td className="p-3">
                              <span className="font-black text-slate-900 block">{p.name}</span>
                              <span className="text-[10px] text-slate-400 font-mono">SKU: {p.sku}</span>
                            </td>
                            <td className="p-3 text-center font-mono font-black text-rose-600">{p.stock} {p.unit}</td>
                            <td className="p-3 text-center font-mono text-slate-500">{p.minStock}</td>
                            <td className="p-3 text-center font-mono font-black text-indigo-700">+{suggested} {p.unit}</td>
                            <td className="p-3 text-end font-mono text-slate-800">{p.purchasePrice.toFixed(2)} {currency}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Bottom Actions Bar */}
            <div 
              className="bg-slate-50 px-3 sm:px-6 py-3 sm:py-4 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shrink-0"
              style={{ paddingBottom: 'max(0.85rem, env(safe-area-inset-bottom, 0px))' }}
            >
              <span className="text-xs font-bold text-slate-600 text-center sm:text-start">
                {lang === 'ar' ? 'إجمالي الأصناف المطلوبة:' : 'Total items:'} <b className="font-mono text-slate-900">{lowStockProducts.length}</b>
              </span>
              <div className="grid grid-cols-3 sm:flex sm:items-center sm:justify-end gap-2 w-full sm:w-auto">
                {/* WhatsApp Share Button */}
                <button
                  type="button"
                  onClick={() => {
                    const lines = lowStockProducts.map((p, idx) => {
                      const qty = Math.max(1, p.minStock * 2 - p.stock);
                      return `${idx + 1}. *${p.name}* (${p.sku}) -> كمية: *${qty}* ${p.unit}`;
                    });
                    const msg = `*طلب شراء مواد ناقصة (${config?.name || 'SmartPOS'})*\nالتاريخ: ${new Date().toLocaleDateString('fr-FR')}\nعدد الأصناف: ${lowStockProducts.length}\n\n${lines.join('\n')}\n\nالرجاء تأكيد توفر الكميات وتاريخ التوريد. شكراً.`;
                    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
                  }}
                  className="flex items-center justify-center gap-1.5 px-2.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-[11px] sm:text-xs font-black transition cursor-pointer shadow-xs"
                >
                  <MessageCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{lang === 'ar' ? 'واتساب' : 'WhatsApp'}</span>
                </button>

                {/* Print Order Button */}
                <button
                  type="button"
                  onClick={() => {
                    const printHtml = `
                      <div style="font-family: Arial, sans-serif; padding: 20px; direction: ${isRTL ? 'rtl' : 'ltr'};">
                        <h2 style="margin: 0 0 10px 0; border-bottom: 2px solid #000; padding-bottom: 8px;">
                          ${config?.name || 'Smart POS'} - ${lang === 'ar' ? 'سند طلب شراء مواد ناقصة (Bon de Commande)' : 'Purchase Order'}
                        </h2>
                        <p style="font-size: 12px; color: #555; margin-bottom: 15px;">
                          ${lang === 'ar' ? 'التاريخ:' : 'Date:'} ${new Date().toLocaleDateString('fr-FR')} | ${lang === 'ar' ? 'عدد البنود:' : 'Items:'} ${lowStockProducts.length}
                        </p>
                        <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                          <thead>
                            <tr style="background: #f1f5f9; border-bottom: 1px solid #cbd5e1;">
                              <th style="padding: 8px; text-align: ${isRTL ? 'right' : 'left'};">#</th>
                              <th style="padding: 8px; text-align: ${isRTL ? 'right' : 'left'};">${lang === 'ar' ? 'اسم المنتج' : 'Item'}</th>
                              <th style="padding: 8px; text-align: center;">${lang === 'ar' ? 'المخزون الحالي' : 'Stock'}</th>
                              <th style="padding: 8px; text-align: center;">${lang === 'ar' ? 'الكمية المطلوبة' : 'Qty'}</th>
                              <th style="padding: 8px; text-align: ${isRTL ? 'left' : 'right'};">${lang === 'ar' ? 'سعر الشراء' : 'Cost'}</th>
                            </tr>
                          </thead>
                          <tbody>
                            ${lowStockProducts.map((p, idx) => `
                              <tr style="border-bottom: 1px solid #e2e8f0;">
                                <td style="padding: 8px;">${idx + 1}</td>
                                <td style="padding: 8px;"><b>${p.name}</b> (${p.sku})</td>
                                <td style="padding: 8px; text-align: center;">${p.stock} ${p.unit}</td>
                                <td style="padding: 8px; text-align: center; font-weight: bold;">${Math.max(1, p.minStock * 2 - p.stock)} ${p.unit}</td>
                                <td style="padding: 8px; text-align: ${isRTL ? 'left' : 'right'}; font-family: monospace;">${p.purchasePrice.toFixed(2)} ${currency}</td>
                              </tr>
                            `).join('')}
                          </tbody>
                        </table>
                      </div>
                    `;
                    printHtmlContent({ html: printHtml, title: 'PURCHASE-ORDER-LOW-STOCK', isRTL, mode: 'a4' });
                  }}
                  className="flex items-center justify-center gap-1.5 px-2.5 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-xl text-[11px] sm:text-xs font-black transition cursor-pointer shadow-xs"
                >
                  <Printer className="w-3.5 h-3.5 shrink-0" />
                  <span>{lang === 'ar' ? 'طباعة' : 'Print'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowReorderModal(false)}
                  className="flex items-center justify-center gap-1.5 px-2.5 py-2.5 bg-slate-200 hover:bg-slate-300 active:bg-slate-400 text-slate-800 rounded-xl text-[11px] sm:text-xs font-black transition cursor-pointer shadow-2xs border border-slate-300"
                >
                  <X className="w-3.5 h-3.5 shrink-0" />
                  <span>{lang === 'ar' ? 'إغلاق' : 'Fermer'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
