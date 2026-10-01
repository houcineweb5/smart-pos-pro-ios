import React, { useState, useRef } from 'react';
import { Product, Language, StoreConfig } from '../types';
import { languages } from '../languages';
import { parseDecimal, sanitizeDecimalInput } from '../utils/numberInput';
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
} from 'lucide-react';
import CameraBarcodeModal from './CameraBarcodeModal';

interface InventoryProps {
  products: Product[];
  config?: StoreConfig;
  onSaveProduct: (product: Product) => void;
  onDeleteProduct: (id: string) => void;
  lang: Language;
}

export default function Inventory({ products, config, onSaveProduct, onDeleteProduct, lang }: InventoryProps) {
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

  // CSV Import status
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importSummary, setImportSummary] = useState<{ show: boolean; imported: number; updated: number; total: number } | null>(null);

  // Extract unique categories
  const categories = ['all', ...Array.from(new Set(products.map((p) => p.category)))];

  // Filters
  const filteredProducts = products.filter((p) => {
    const matchSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase()) ||
      p.category.toLowerCase().includes(search.toLowerCase());
    const matchCat = selectedCategory === 'all' || p.category === selectedCategory;
    return matchSearch && matchCat;
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

  const handleStartAdd = () => {
    setEditingProduct({
      id: '',
      sku: Math.floor(10000000 + Math.random() * 90000000).toString(),
      name: '',
      category: '',
      purchasePrice: 0,
      sellingPrice: 0,
      wholesalePrice: 0,
      stock: 0,
      minStock: 5,
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

    if (
      !editingProduct.name ||
      !editingProduct.sku ||
      !finalCategory ||
      editingProduct.purchasePrice === undefined ||
      editingProduct.sellingPrice === undefined ||
      editingProduct.stock === undefined
    ) {
      alert(t.common.requiredFields);
      return;
    }

    const productToSave: Product = {
      id: editingProduct.id || 'prod_' + Date.now(),
      sku: editingProduct.sku,
      name: editingProduct.name,
      category: finalCategory,
      purchasePrice: parseDecimal(editingProduct.purchasePrice),
      sellingPrice: parseDecimal(editingProduct.sellingPrice),
      wholesalePrice: parseDecimal(editingProduct.wholesalePrice ?? editingProduct.sellingPrice),
      stock: Number(editingProduct.stock),
      minStock: Number(editingProduct.minStock ?? 0),
      unit: editingProduct.unit || 'pcs',
      imageUrl: editingProduct.imageUrl || undefined,
    };

    onSaveProduct(productToSave);
    setIsEditing(false);
    setEditingProduct(null);
  };

  // CSV Export with UTF-8 BOM
  const handleExportCSV = () => {
    const headers = ['SKU', 'Name', 'Category', 'PurchasePrice', 'SellingPrice', 'WholesalePrice', 'Stock', 'MinStock', 'Unit'];
    const rows = products.map(p => [
      `"${(p.sku || '').replace(/"/g, '""')}"`,
      `"${(p.name || '').replace(/"/g, '""')}"`,
      `"${(p.category || '').replace(/"/g, '""')}"`,
      p.purchasePrice ?? 0,
      p.sellingPrice ?? 0,
      p.wholesalePrice ?? p.sellingPrice ?? 0,
      p.stock ?? 0,
      p.minStock ?? 0,
      `"${(p.unit || 'pcs').replace(/"/g, '""')}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `inventory_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
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

        const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
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

        for (let i = startIdx; i < lines.length; i++) {
          const cols = parseCSVLine(lines[i]);
          if (cols.length < 5) continue;

          const sku = cols[0] || Math.floor(10000000 + Math.random() * 90000000).toString();
          const name = cols[1] || `Item ${i}`;
          const category = cols[2] || 'General';
          const purchasePrice = parseFloat(cols[3]) || 0;
          const sellingPrice = parseFloat(cols[4]) || 0;
          const wholesalePrice = cols[5] ? parseFloat(cols[5]) : sellingPrice;
          const stock = cols[6] ? parseInt(cols[6]) : 0;
          const minStock = cols[7] ? parseInt(cols[7]) : 5;
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

  // Print Barcode stickers window
  const triggerPrintBarcodes = () => {
    const printWindow = window.open('', '', 'width=850,height=950');
    if (!printWindow) return;

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

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Barcode Stickers - ${storeName}</title>
          <style>
            ${isThermal ? `
              @page { size: auto; margin: 1.5mm; }
              body {
                font-family: system-ui, -apple-system, sans-serif;
                margin: 0;
                padding: 0;
                color: #000;
                background: #fff;
              }
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
                margin: 0 auto;
                text-align: center;
                page-break-after: always;
                page-break-inside: avoid;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: space-between;
                overflow: hidden;
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
              @page { size: A4; margin: 8mm; }
              body {
                font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
                margin: 0;
                padding: 0;
                color: #0f172a;
                background: #fff;
              }
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
            @media print {
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            }
          </style>
        </head>
        <body>
          <div class="stickers-container">
            ${stickersHtml}
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);
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
            title={lang === 'ar' ? 'تصدير المخزون كملف Excel / CSV' : 'Export products to CSV'}
          >
            <Download className="w-4 h-4 text-emerald-600" />
            <span>{lang === 'ar' ? 'تصدير Excel' : 'Export CSV'}</span>
          </button>

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
      </div>

      {/* Product Table Grid */}
      <div className="bg-white border border-slate-100 rounded-2xl shadow-xs overflow-hidden" id="inv-table-section">
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
                          <span className="font-bold text-slate-900">{p.name}</span>
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

      {/* Editor Modal Overlay */}
      {isEditing && editingProduct && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto" id="edit-product-modal">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-lg overflow-hidden animate-fade-in my-8">
            <div className="flex justify-between items-center bg-slate-50 px-6 py-4 border-b border-slate-100">
              <h2 className="font-bold text-slate-800 text-lg">
                {editingProduct.id ? t.inventory.editProduct : t.inventory.addProduct}
              </h2>
              <button
                id="btn-close-modal"
                onClick={() => setIsEditing(false)}
                className="p-1 hover:bg-slate-200 text-slate-400 hover:text-slate-600 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
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
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onload = (event) => {
                                  if (event.target?.result) {
                                    setEditingProduct({ ...editingProduct, imageUrl: event.target.result as string });
                                  }
                                };
                                reader.readAsDataURL(file);
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

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">{t.inventory.sku} *</label>
                  <div className="flex gap-1.5">
                    <input
                      id="form-p-sku"
                      required
                      type="text"
                      value={editingProduct.sku || ''}
                      onChange={(e) => setEditingProduct({ ...editingProduct, sku: e.target.value })}
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono font-medium text-slate-700"
                    />
                    <button
                      type="button"
                      onClick={() => setCameraScanTarget('sku')}
                      className="px-3 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-200 rounded-lg transition cursor-pointer shrink-0 flex items-center justify-center"
                      title={lang === 'ar' ? 'مسح باركود السلعة بالكاميرا' : 'Scan Barcode with Camera'}
                    >
                      <Camera className="w-4 h-4" />
                    </button>
                  </div>
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
                    value={editingProduct.purchasePrice ?? ''}
                    onChange={(e) => setEditingProduct({ ...editingProduct, purchasePrice: sanitizeDecimalInput(e.target.value) as any })}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700 font-semibold"
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
                    value={editingProduct.sellingPrice ?? ''}
                    onChange={(e) => setEditingProduct({ ...editingProduct, sellingPrice: sanitizeDecimalInput(e.target.value) as any })}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700 font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                    {lang === 'ar' ? `سعر البيع بالجملة * (${currency})` : lang === 'fr' ? `Prix de gros * (${currency})` : `Wholesale Price * (${currency})`}
                  </label>
                  <input
                    id="form-p-wholesale"
                    required
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={editingProduct.wholesalePrice ?? ''}
                    onChange={(e) => setEditingProduct({ ...editingProduct, wholesalePrice: sanitizeDecimalInput(e.target.value) as any })}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700 font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">{t.inventory.stock} *</label>
                  <input
                    id="form-p-stock"
                    required
                    type="number"
                    value={editingProduct.stock ?? 0}
                    onChange={(e) => setEditingProduct({ ...editingProduct, stock: Number(e.target.value) })}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700 font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">{t.inventory.minStock}</label>
                  <input
                    id="form-p-minstock"
                    type="number"
                    min="0"
                    value={editingProduct.minStock ?? 0}
                    onChange={(e) => setEditingProduct({ ...editingProduct, minStock: Number(e.target.value) })}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-500 font-medium"
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
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  id="btn-edit-cancel"
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4.5 py-2 hover:bg-slate-100 text-slate-600 font-medium rounded-lg transition"
                >
                  {t.inventory.cancel}
                </button>
                <button
                  id="btn-edit-save"
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition"
                >
                  {t.inventory.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom Product Delete Dialog Overlay */}
      {deletingProductId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
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
      {showBarcodeModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-4xl overflow-hidden animate-fade-in my-8 text-start flex flex-col max-h-[90vh]">
            {/* Top Header */}
            <div className="flex justify-between items-center bg-slate-50 px-6 py-4 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2">
                <Barcode className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-slate-800 text-base">
                  {lang === 'ar' ? 'مولد وطباعة ملصقات الباركود' : 'Barcode Labels & Sticker Printer'}
                </h3>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex bg-slate-200/80 p-0.5 rounded-lg text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setBarcodePrintMode('thermal')}
                    className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                      barcodePrintMode === 'thermal' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {lang === 'ar' ? 'طابعة حرارية رول (Roll)' : 'Thermal Roll'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setBarcodePrintMode('a4')}
                    className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                      barcodePrintMode === 'a4' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {lang === 'ar' ? 'ورق A4 متعدد' : 'A4 Sheet'}
                  </button>
                </div>
                <button
                  id="btn-print-barcode-stickers"
                  onClick={triggerPrintBarcodes}
                  className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>{lang === 'ar' ? 'طباعة الملصقات' : 'Print Stickers'}</span>
                </button>
                <button
                  onClick={() => setShowBarcodeModal(false)}
                  className="p-1.5 hover:bg-slate-200 text-slate-400 rounded-lg transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Main Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              {/* Selection Toolbar */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
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
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => {
                      const all: Record<string, number> = {};
                      products.forEach(p => { all[p.id] = Math.max(1, p.stock || 1); });
                      setBarcodeSelection(all);
                    }}
                    className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold transition cursor-pointer"
                  >
                    {lang === 'ar' ? 'تحديد الكل' : 'Select All'}
                  </button>
                  <button
                    onClick={() => setBarcodeSelection({})}
                    className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-500 border border-slate-200 rounded-lg text-xs font-bold transition cursor-pointer"
                  >
                    {lang === 'ar' ? 'إلغاء التحديد' : 'Clear'}
                  </button>
                </div>
              </div>

              {/* Product Selection List */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-56 overflow-y-auto">
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
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-500">
                    {lang === 'ar' ? 'معاينة شكل الملصقات قبل الطباعة:' : 'Live Labels Preview:'}
                  </h4>
                  <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-100">
                    {lang === 'ar'
                      ? `إجمالي الملصقات: ${(Object.values(barcodeSelection) as number[]).reduce((a, b) => a + Number(b), 0)} ملصق`
                      : `Total: ${(Object.values(barcodeSelection) as number[]).reduce((a, b) => a + Number(b), 0)} stickers`}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 bg-slate-100/70 p-4 rounded-2xl border border-slate-200 max-h-60 overflow-y-auto">
                  {(Object.entries(barcodeSelection) as [string, number][]).filter(([_, count]) => Number(count) > 0).length === 0 ? (
                    <div className="col-span-full py-8 text-center text-slate-400 font-semibold text-xs">
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
                            className="bg-white rounded-xl border border-dashed border-slate-300 p-3 flex flex-col items-center justify-between text-center shadow-xs"
                          >
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block truncate w-full">{storeName}</span>
                            <span className="text-xs font-black text-slate-800 line-clamp-1 mt-0.5">{prod.name}</span>
                            <div className="my-1.5" dangerouslySetInnerHTML={{ __html: getBarcodeSvgString(prod.sku) }} />
                            <span className="text-sm font-black font-mono text-slate-900 border-t border-slate-100 pt-1 w-full block">
                              {prod.sellingPrice.toFixed(2)} {currency}
                            </span>
                            <span className="text-[10px] text-indigo-600 font-bold mt-1 bg-indigo-50 px-2 py-0.5 rounded-full">
                              x{count} {lang === 'ar' ? 'نسخ' : 'copies'}
                            </span>
                          </div>
                        );
                      })
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex justify-end gap-3 shrink-0">
              <button
                onClick={() => setShowBarcodeModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                {t.inventory.cancel}
              </button>
              <button
                onClick={triggerPrintBarcodes}
                className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-xs"
              >
                <Printer className="w-4 h-4" />
                <span>{lang === 'ar' ? 'بدء الطباعة الآن' : 'Print Labels Now'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CSV Import Feedback Toast / Modal */}
      {importSummary && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
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
            setEditingProduct({ ...editingProduct, sku: code });
          } else {
            setSearch(code);
          }
          setCameraScanTarget(null);
        }}
        lang={lang}
        allowWirelessPcSend={false}
      />
    </div>
  );
}
