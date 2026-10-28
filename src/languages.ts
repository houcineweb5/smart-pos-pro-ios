/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Language } from './types';

export interface Translations {
  direction: 'rtl' | 'ltr';
  nav: {
    home: string;
    pos: string;
    invoices: string;
    purchaseEntry: string;
    inventory: string;
    customers: string;
    reports: string;
    settings: string;
    suppliers: string;
    purchases: string;
    users: string;
    repairs: string;
    logs: string;
    expenses: string;
    devis: string;
    bonCommande: string;
    bonLivraison: string;
    commercialDocuments: string;
    backup: string;
    mobileSync: string;
  };
  pos: {
    selectCustomer: string;
    walkInCustomer: string;
    searchProducts: string;
    allCategories: string;
    cart: string;
    emptyCart: string;
    subtotal: string;
    discount: string;
    tax: string;
    total: string;
    paymentMethod: string;
    amountPaid: string;
    change: string;
    notes: string;
    checkout: string;
    cash: string;
    card: string;
    debt: string;
    addDiscount: string;
    itemAdded: string;
    stockDetails: string;
    insufficientStock: string;
    transactionSuccess: string;
    itemsCount: string;
  };
  invoice: {
    title: string;
    number: string;
    date: string;
    customer: string;
    total: string;
    paid: string;
    remaining: string;
    status: string;
    actions: string;
    paidStatus: string;
    unpaidStatus: string;
    partialStatus: string;
    print: string;
    view: string;
    search: string;
    billTo: string;
    thankYou: string;
    receipt: string;
    allStatus: string;
    export: string;
  };
  inventory: {
    title: string;
    addProduct: string;
    editProduct: string;
    sku: string;
    name: string;
    category: string;
    purchasePrice: string;
    sellingPrice: string;
    stock: string;
    minStock: string;
    unit: string;
    actions: string;
    stockAlert: string;
    stockAlertDesc: string;
    save: string;
    delete: string;
    cancel: string;
    allProducts: string;
    outOfStock: string;
    lowStock: string;
    okStock: string;
    search: string;
  };
  customer: {
    title: string;
    addCustomer: string;
    editCustomer: string;
    name: string;
    phone: string;
    email: string;
    debt: string;
    history: string;
    notes: string;
    save: string;
    delete: string;
    cancel: string;
    payDebt: string;
    debtPlaceholder: string;
    payAmount: string;
    search: string;
    recentInvoices: string;
  };
  supplier: {
    title: string;
    addSupplier: string;
    editSupplier: string;
    name: string;
    phone: string;
    email: string;
    company: string;
    notes: string;
    save: string;
    delete: string;
    cancel: string;
    search: string;
  };
  purchase: {
    title: string;
    addPurchase: string;
    view: string;
    supplier: string;
    purchaseNumber: string;
    date: string;
    total: string;
    amountPaid: string;
    notes: string;
    status: string;
    debtToSupplier: string;
    ourOutstandingDebt: string;
    settleDebt: string;
    search: string;
    price: string;
    quantity: string;
    addItems: string;
    cancel: string;
    delete: string;
  };
  reports: {
    title: string;
    revenue: string;
    profit: string;
    transactions: string;
    totalDebt: string;
    salesAnalysis: string;
    topSelling: string;
    categoryDistribution: string;
    stockWarning: string;
    today: string;
    week: string;
    month: string;
    year: string;
    period: string;
    exportExcel: string;
    totalItemsSold: string;
    profitMargin: string;
  };
  settings: {
    title: string;
    storeName: string;
    storePhone: string;
    storeEmail: string;
    storeAddress: string;
    registrationNumber: string;
    taxNumber: string;
    currency: string;
    defaultTaxRate: string;
    save: string;
    resetData: string;
    resetConfirm: string;
    importExport: string;
    exportBtn: string;
    importBtn: string;
    importSuccess: string;
    saveBtn: string;
    updateSuccess: string;
  };
  common: {
    confirmDelete: string;
    saveSuccess: string;
    deleteSuccess: string;
    requiredFields: string;
    arabic: string;
    french: string;
    english: string;
  };
}

export const languages: Record<Language, Translations> = {
  ar: {
    direction: 'rtl',
    nav: {
      home: 'الرئيسية',
      pos: 'نقطة البيع',
      invoices: 'ادارة فواتير المبيعات',
      purchaseEntry: 'فاتورة مشتريات',
      inventory: 'ادارة المخزن',
      customers: 'سجل الزبناء والديون',
      reports: 'التقارير والاحصائيات',
      settings: 'الاعدادات العامة',
      suppliers: 'سجل الموردين',
      purchases: 'ادارة فواتير المشتريات والديون',
      users: 'المستخدمين والصلاحيات',
      repairs: 'قسم الصيانة والاصلاحان',
      logs: 'سجل العمليات والانشطة',
      expenses: 'ادارة المصاريف اليومية',
      devis: 'عروض الأسعار (Devis)',
      bonCommande: 'Bon de commande',
      bonLivraison: 'Bon de livraison',
      commercialDocuments: 'ادارة الوثائق التجارية',
      backup: 'ادارة البيانات والنسخ الاحتياطية',
      mobileSync: 'تطبيق الهاتف والمزامنة',
    },
    pos: {
      selectCustomer: 'اختر الزبون',
      walkInCustomer: 'Client Divers',
      searchProducts: 'ابحث عن منتج بالاسم أو الرمز (SKU)...',
      allCategories: 'جميع الفئات',
      cart: 'سلة المشتريات',
      emptyCart: 'سلة المشتريات فارغة. أضف بعض المنتجات للبدء.',
      subtotal: 'المجموع',
      discount: 'الخصم',
      tax: 'الضريبة',
      total: 'المجموع الإجمالي',
      paymentMethod: 'طريقة الدفع',
      amountPaid: 'المبلغ المدفوع',
      change: 'المبلغ المتبقي للزبون (الصرف)',
      notes: 'ملاحظات الفاتورة',
      checkout: 'إتمام عملية البيع وطباعة',
      cash: 'نقداً',
      card: 'بطاقة ائتمان',
      debt: 'دفع مؤجل (دين)',
      addDiscount: 'إضافة خصم (%)',
      itemAdded: 'تم إضافة المنتج إلى السلة',
      stockDetails: 'المخزون المتوفر',
      insufficientStock: 'المخزون غير كافٍ!',
      transactionSuccess: 'تمت العملية بنجاح وصدرت الفاتورة!',
      itemsCount: 'عدد المنتجات',
    },
    invoice: {
      title: 'الفواتير الصادرة',
      number: 'رقم الفاتورة',
      date: 'التاريخ',
      customer: 'الزبون',
      total: 'الإجمالي',
      paid: 'المدفوع',
      remaining: 'الباقي (كريدي)',
      status: 'الحالة',
      actions: 'إجراءات',
      paidStatus: 'مدفوعة كاملة',
      unpaidStatus: 'غير مدفوعة',
      partialStatus: 'مدفوعة جزئياً',
      print: 'طباعة الفاتورة',
      view: 'تفاصيل الفاتورة',
      search: 'ابحث برقم الفاتورة أو اسم الزبون...',
      billTo: 'الزبون :',
      thankYou: 'شكراً لتعاملكم معنا ومرحباً بكم في أي وقت!',
      receipt: 'فاتورة مبيعات',
      allStatus: 'كل الحالات',
      export: 'تصدير التقارير',
    },
    inventory: {
      title: 'مخزن المنتجات',
      addProduct: 'إضافة منتج جديد',
      editProduct: 'تعديل منتج',
      sku: 'الرمز / الباركود',
      name: 'اسم المنتج',
      category: 'الفئة',
      purchasePrice: 'سعر الشراء',
      sellingPrice: 'سعر البيع',
      stock: 'الكمية الحالية',
      minStock: 'الحد الأدنى للتنبيه',
      unit: 'وحدة القياس',
      actions: 'خيارات',
      stockAlert: 'المنتجات منخفضة المخزون',
      stockAlertDesc: 'المنتجات التي وصلت إلى حد الطلب الأدنى أو نفدت:',
      save: 'حفظ المنتج',
      delete: 'حذف',
      cancel: 'إلغاء',
      allProducts: 'جميع المنتجات',
      outOfStock: 'نفد من المخزن',
      lowStock: 'مخزون منخفض',
      okStock: 'متوفر وممتاز',
      search: 'ابحث باسم المنتج أو الرمز (SKU)...',
    },
    customer: {
      title: 'سجل الزبناء والديون',
      addCustomer: 'زبون جديد',
      editCustomer: 'تعديل الزبون',
      name: 'اسم الزبون',
      phone: 'رقم الهاتف',
      email: 'البريد الإلكتروني',
      debt: 'إجمالي الديون (له / عليه)',
      history: 'تاريخ فواتيره',
      notes: 'ملاحظات إضافية',
      save: 'حفظ البيانات',
      delete: 'حذف الزبون',
      cancel: 'إلغاء',
      payDebt: 'تسديد جزء من الدين',
      debtPlaceholder: 'قيمة الديون الحالية:',
      payAmount: 'المبلغ المدفوع حالياً للتسديد',
      search: 'ابحث عن زبون بالاسم أو الهاتف...',
      recentInvoices: 'آخر الفواتير الصادرة له',
    },
    supplier: {
      title: 'إدارة سجل المورّدين',
      addSupplier: 'مورّد جديد',
      editSupplier: 'تعديل المورّد',
      name: 'اسم المورّد / المندوب',
      phone: 'رقم الهاتف',
      email: 'البريد الإلكتروني',
      company: 'الشركة / المصنع',
      notes: 'ملاحظات التوريد',
      save: 'حفظ بيانات المورّد',
      delete: 'حذف المورّد',
      cancel: 'إلغاء',
      search: 'ابحث عن مورّد بالاسم أو الهاتف أو الشركة...',
    },
    purchase: {
      title: 'سجل فواتير المشتريات والديون المترتبة',
      addPurchase: 'تسجيل فاتورة شراء جديدة (توريد)',
      view: 'عرض تفاصيل الفاتورة',
      supplier: 'المورّد المورد',
      purchaseNumber: 'رقم فاتورة الشراء',
      date: 'تاريخ الشراء والسداد',
      total: 'إجمالي الفاتورة',
      amountPaid: 'المبلغ المدفوع كاش',
      notes: 'ملاحظات وتفاصيل التوريد',
      status: 'حالة سداد الفاتورة',
      debtToSupplier: 'الدين المترتب للمورد',
      ourOutstandingDebt: 'ديوني الإجمالية للموردين',
      settleDebt: 'تسديد دفعات ديون للمورد',
      search: 'ابحث في المشتريات باسم المورد أو رقم الفاتورة...',
      price: 'سعر تكلفة الشراء',
      quantity: 'الكمية المستوردة',
      addItems: 'إضافة سلع للمستودع',
      cancel: 'إلغاء الأمر',
      delete: 'حذف الفاتورة',
    },
    reports: {
      title: 'التقارير المالية المتقدمة',
      revenue: 'إجمالي الإيرادات (المبيعات)',
      profit: 'صـافي الأرباح المتوقعة',
      transactions: 'عدد الصفقات والفواتير',
      totalDebt: 'إجمالي الديون المعلقة',
      salesAnalysis: 'مؤشر حركة المبيعات والأرباح',
      topSelling: 'المنتجات الأكثر مبيعاً ورواجاً',
      categoryDistribution: 'تقسيم المبيعات حسب فئات السلع',
      stockWarning: 'إنذار النفاذ الفوري',
      today: 'اليوم',
      week: 'هذا الأسبوع',
      month: 'هذا الشهر',
      year: 'هذه السنة',
      period: 'فترة التقرير:',
      exportExcel: 'تصدير البيانات كـ JSON',
      totalItemsSold: 'إجمالي قطع السلع المباعة',
      profitMargin: 'هامش الربح المتوسط',
    },
    settings: {
      title: 'إعدادات النظام والمنشأة',
      storeName: 'اسم الشركة / المحل التجاري',
      storePhone: 'رقم هاتف المنشأة',
      storeEmail: 'البريد الإلكتروني للمنشأة',
      storeAddress: 'العنوان الكامل',
      registrationNumber: 'ICE (المعرف الموحد للمقاولة)',
      taxNumber: 'الرقم الضريبي أو السجل التجاري',
      currency: 'العملة الافتراضية',
      defaultTaxRate: 'نسبة ضريبة القيمة المضافة الافتراضية (%)',
      save: 'حفظ التعديلات العامة',
      resetData: 'تهيئة وتهديم البيانات (البدء من جديد)',
      resetConfirm: 'هل أنت متأكد من مسح جميع البيانات؟ هذا الإجراء لا يمكن التراجع عنه.',
      importExport: 'النسخ الاحتياطي واستعادة البيانات',
      exportBtn: 'تصدير قاعدة البيانات (Backup)',
      importBtn: 'استيراد قاعدة بيانات (Restore)',
      importSuccess: 'تم استعادة البيانات والتهيئة بنجاح!',
      saveBtn: 'حفظ الإعدادات',
      updateSuccess: 'تم تحديث البيانات بنجاح!',
    },
    common: {
      confirmDelete: 'هل أنت متأكد أنك تريد حذف هذا العنصر؟',
      saveSuccess: 'تم الحفظ وإدماج البيانات بنجاح.',
      deleteSuccess: 'تم حذف العنصر بنجاح.',
      requiredFields: 'يرجى مراجعة وتعبئة الحقول المطلوبة باللون الأحمر.',
      arabic: 'العربية',
      french: 'Français',
      english: 'English',
    },
  },
  fr: {
    direction: 'ltr',
    nav: {
      home: 'Accueil',
      pos: 'Point de Vente (Caisse)',
      invoices: 'Factures de Ventes',
      purchaseEntry: 'Facture d\'Achat',
      inventory: 'Stock & Inventaire',
      customers: 'Clients & Dettes',
      reports: 'Rapports Financiers',
      settings: 'Configuration',
      suppliers: 'Fournisseurs',
      purchases: 'Gestion Achats & Dettes',
      users: 'Utilisateurs & Droits',
      repairs: 'Réparations & SAV',
      logs: 'Journal d\'activités',
      expenses: 'Gestion des Dépenses',
      devis: 'Devis & Proforma',
      bonCommande: 'Bons de Commande',
      bonLivraison: 'Bons de Livraison',
      commercialDocuments: 'Documents Commerciaux',
      backup: 'Sauvegarde & Données',
      mobileSync: 'Application & Sync Cloud',
    },
    pos: {
      selectCustomer: 'Sélectionner Client',
      walkInCustomer: 'Client Divers',
      searchProducts: 'Rechercher produit par nom ou SKU...',
      allCategories: 'Toutes les catégories',
      cart: 'Panier',
      emptyCart: 'Le panier est vide. Ajoutez des produits.',
      subtotal: 'Sous-total',
      discount: 'Remise',
      tax: 'TVA',
      total: 'Total Général',
      paymentMethod: 'Mode de paiement',
      amountPaid: 'Montant versé',
      change: 'Rendu de monnaie',
      notes: 'Notes sur la facture',
      checkout: 'Valider & Imprimer',
      cash: 'Espèces',
      card: 'Carte bancaire',
      debt: 'Dette / Crédit',
      addDiscount: 'Ajouter Remise (%)',
      itemAdded: 'Produit ajouté au panier',
      stockDetails: 'Stock disponible',
      insufficientStock: 'Stock insuffisant !',
      transactionSuccess: 'Transaction validée, facture générée !',
      itemsCount: 'Nombre d\'articles',
    },
    invoice: {
      title: 'Factures Émises',
      number: 'N° Facture',
      date: 'Date',
      customer: 'Client',
      total: 'Total',
      paid: 'Payé',
      remaining: 'Reste',
      status: 'Statut',
      actions: 'Actions',
      paidStatus: 'Payée',
      unpaidStatus: 'Non Payée',
      partialStatus: 'Partielle',
      print: 'Imprimer',
      view: 'Détails',
      search: 'Rechercher facture ou client...',
      billTo: 'Facturé à :',
      thankYou: 'Merci pour votre confiance, à bientôt !',
      receipt: 'Facture de Vente',
      allStatus: 'Tous les statuts',
      export: 'Exporter Rapport',
    },
    inventory: {
      title: 'Gestion des Produits & Stock',
      addProduct: 'Ajouter Produit',
      editProduct: 'Modifier Produit',
      sku: 'Code / Barcode',
      name: 'Nom du Produit',
      category: 'Catégorie',
      purchasePrice: 'Prix d\'Achat',
      sellingPrice: 'Prix de Vente',
      stock: 'Quantité en Stock',
      minStock: 'Stock d\'Alerte Min',
      unit: 'Unité',
      actions: 'Actions',
      stockAlert: 'Alertes de Stock',
      stockAlertDesc: 'Produits en rupture ou sous le seuil critique :',
      save: 'Enregistrer le Produit',
      delete: 'Supprimer',
      cancel: 'Annuler',
      allProducts: 'Tous les Produits',
      outOfStock: 'Rupture',
      lowStock: 'Faible',
      okStock: 'Excellent',
      search: 'Rechercher par nom ou code...',
    },
    customer: {
      title: 'Gestion de Fichier Client',
      addCustomer: 'Ajouter Client',
      editCustomer: 'Modifier Client',
      name: 'Nom Complet',
      phone: 'Téléphone',
      email: 'E-mail',
      debt: 'Dettes accumulées',
      history: 'Historique d\'achats',
      notes: 'Remarques',
      save: 'Enregistrer',
      delete: 'Supprimer',
      cancel: 'Annuler',
      payDebt: 'Rembourser une dette',
      debtPlaceholder: 'Dette actuelle :',
      payAmount: 'Montant remboursé',
      search: 'Rechercher par nom ou téléphone...',
      recentInvoices: 'Factures récentes reliées',
    },
    supplier: {
      title: 'Gestion des Fournisseurs',
      addSupplier: 'Ajouter Fournisseur',
      editSupplier: 'Modifier Fournisseur',
      name: 'Nom du Fournisseur',
      phone: 'Téléphone',
      email: 'E-mail',
      company: 'Entreprise / Usine',
      notes: 'Remarques du Fournisseur',
      save: 'Enregistrer',
      delete: 'Supprimer',
      cancel: 'Annuler',
      search: 'Rechercher par entreprise, nom ou téléphone...',
    },
    purchase: {
      title: 'Registre des Achats & Dettes Payisbles',
      addPurchase: 'Nouvelle Facture d\'Achat (Approvisionnement)',
      view: 'Afficher les détails',
      supplier: 'Fournisseur',
      purchaseNumber: 'Numéro d\'Achat',
      date: 'Date de Facturation',
      total: 'Montant Total',
      amountPaid: 'Montant Payé Cash',
      notes: 'Remarques sur l\'achat',
      status: 'Statut du Paiement',
      debtToSupplier: 'Dette Restante envers lui',
      ourOutstandingDebt: 'Nos Dettes Fournisseurs Globales',
      settleDebt: 'Régler une partie de la dette',
      search: 'Rechercher achat par fournisseur ou numéro...',
      price: 'Prix d\'achat',
      quantity: 'Quantité fournie',
      addItems: 'Ajouter des articles',
      cancel: 'Annuler',
      delete: 'Supprimer Facture d\'Achat',
    },
    reports: {
      title: 'Rapports de Performance Financière',
      revenue: 'Chiffre d\'Affaires',
      profit: 'Bénéfice Net Simplifié',
      transactions: 'Ventes enregistrées',
      totalDebt: 'Dettes clients globales',
      salesAnalysis: 'Analyse des Ventes & Graphiques',
      topSelling: 'Top Produits les Plus Vendus',
      categoryDistribution: 'Ventes par Catégorie de Produit',
      stockWarning: 'Alertes urgentes de stock',
      today: 'Aujourd\'hui',
      week: 'Cette Semaine',
      month: 'Ce Mois',
      year: 'Cette Année',
      period: 'Période analysée :',
      exportExcel: 'Exporter base de données',
      totalItemsSold: 'Total Unités Vendues',
      profitMargin: 'Marge bénéficiaire moyenne',
    },
    settings: {
      title: 'Paramètres du Système',
      storeName: 'Nom de l\'établissement',
      storePhone: 'Téléphone Entreprise',
      storeEmail: 'E-mail Entreprise',
      storeAddress: 'Adresse Civique',
      registrationNumber: 'ICE (Identifiant Commun Entreprise)',
      taxNumber: 'N° Fiscal ou Registre de Commerce (IF / RC)',
      currency: 'Devise par défaut',
      defaultTaxRate: 'Taux TVA par défaut (%)',
      save: 'Sauvegarder les paramètres',
      resetData: 'Réinitialisation Générale (Vider la base)',
      resetConfirm: 'Êtes-vous sûr de vouloir vider TOUTE la base de données ? Action définitive.',
      importExport: 'Sauvegardes & Restauration',
      exportBtn: 'Exporter les Données',
      importBtn: 'Importer des Données',
      importSuccess: 'Base restaurée avec succès !',
      saveBtn: 'Enregistrer',
      updateSuccess: 'Configurations sauvegardées !',
    },
    common: {
      confirmDelete: 'Voulez-vous vraiment supprimer cet élément ?',
      saveSuccess: 'Élément enregistré avec succès !',
      deleteSuccess: 'Élément supprimé avec succès !',
      requiredFields: 'Veuillez vérifier les champs obligatoires.',
      arabic: 'العربية',
      french: 'Français',
      english: 'English',
    },
  },
  en: {
    direction: 'ltr',
    nav: {
      home: 'Home',
      pos: 'Point of Sale (POS)',
      invoices: 'Sales Invoices Management',
      purchaseEntry: 'Purchase Invoice',
      inventory: 'Inventory & Stock',
      customers: 'Customers & Debts',
      reports: 'Financial Reports',
      settings: 'Global Settings',
      suppliers: 'Suppliers',
      purchases: 'Purchases & Debts Management',
      users: 'Staff & Permissions',
      repairs: 'Repairs & Maintenance',
      logs: 'System Logs',
      expenses: 'Daily Expenses',
      devis: 'Quotations (Devis)',
      bonCommande: 'Purchase Orders',
      bonLivraison: 'Delivery Notes',
      commercialDocuments: 'Commercial Documents',
      backup: 'Backup & Data Management',
      mobileSync: 'Mobile App & Cloud Sync',
    },
    pos: {
      selectCustomer: 'Select Customer',
      walkInCustomer: 'Client Divers',
      searchProducts: 'Search product by name or SKU...',
      allCategories: 'All Categories',
      cart: 'Shopping Cart',
      emptyCart: 'Your cart is empty. Add products to get started.',
      subtotal: 'Subtotal',
      discount: 'Discount',
      tax: 'VAT / Tax',
      total: 'Final Total',
      paymentMethod: 'Payment Mode',
      amountPaid: 'Amount Paid',
      change: 'Change due to Client',
      notes: 'Invoice Notes',
      checkout: 'Checkout & Print Invoice',
      cash: 'Cash',
      card: 'Credit Card',
      debt: 'Delayed (On Debt)',
      addDiscount: 'Add Discount (%)',
      itemAdded: 'Product added to cart',
      stockDetails: 'Available stock',
      insufficientStock: 'Insufficient Stock in inventory !',
      transactionSuccess: 'Transaction completed and invoice generated !',
      itemsCount: 'Total items',
    },
    invoice: {
      title: 'Registered Invoices',
      number: 'Invoice Number',
      date: 'Date & Time',
      customer: 'Customer',
      total: 'Total',
      paid: 'Amount Paid',
      remaining: 'Due Balance',
      status: 'Status',
      actions: 'Actions',
      paidStatus: 'Fully Paid',
      unpaidStatus: 'Unpaid',
      partialStatus: 'Partially Paid',
      print: 'Print Receipt',
      view: 'View Details',
      search: 'Search by invoice code or customer...',
      billTo: 'Client Bill-To:',
      thankYou: 'Thank you for your business. Welcome back anytime!',
      receipt: 'Sales Invoice',
      allStatus: 'All Statuses',
      export: 'Export Report',
    },
    inventory: {
      title: 'Store Inventory Management',
      addProduct: 'Add New Product',
      editProduct: 'Edit Product Details',
      sku: 'SKU / Barcode',
      name: 'Product Name',
      category: 'Category Group',
      purchasePrice: 'Purchase Unit Cost',
      sellingPrice: 'Selling Unit Price',
      stock: 'Quantity Available',
      minStock: 'Quantity Alert Seuil',
      unit: 'Measuring Unit',
      actions: 'Actions',
      stockAlert: 'Low Stock Alerter',
      stockAlertDesc: 'Products depleted or running lower than threshold limit:',
      save: 'Save Product',
      delete: 'Delete',
      cancel: 'Cancel',
      allProducts: 'All Catalog Products',
      outOfStock: 'Out of Stock',
      lowStock: 'Low Stock Alert',
      okStock: 'Healthy Stock',
      search: 'Search catalog by SKU or title...',
    },
    customer: {
      title: 'Customer Directory & Accounts',
      addCustomer: 'Add Client Profile',
      editCustomer: 'Edit Customer Logs',
      name: 'Client Name',
      phone: 'Phone Number',
      email: 'Email ID',
      debt: 'Accounts Balance / Debt',
      history: 'Sales History Log',
      notes: 'Internal Comments',
      save: 'Save Customer',
      delete: 'Delete Client',
      cancel: 'Dismiss',
      payDebt: 'Settle unpaid balances',
      debtPlaceholder: 'Total Debt Due:',
      payAmount: 'Amount Paying now',
      search: 'Search directory by name or phone...',
      recentInvoices: 'Connected Recent Invoices',
    },
    supplier: {
      title: 'Suppliers Directory Group',
      addSupplier: 'Add Supplier Profile',
      editSupplier: 'Edit Supplier Details',
      name: 'Supplier Name / Rep',
      phone: 'Phone Number',
      email: 'Email Address',
      company: 'Company / Factory',
      notes: 'Supply Information / Comments',
      save: 'Save Supplier',
      delete: 'Delete Supplier',
      cancel: 'Dismiss',
      search: 'Search suppliers by company, name, or phone...',
    },
    purchase: {
      title: 'Purchases Registry & Vendor Accountables',
      addPurchase: 'Register New Purchase Bills (Procure)',
      view: 'View Detailed Bill',
      supplier: 'Vendor Supplier',
      purchaseNumber: 'PO/Bill Number',
      date: 'Purchase Date',
      total: 'Bill Total',
      amountPaid: 'Paid Amount Cash',
      notes: 'Procurement Remarks',
      status: 'Payment Status',
      debtToSupplier: 'Outstanding Supplier Debt',
      ourOutstandingDebt: 'Our Outstanding Vendor Debts',
      settleDebt: 'Settle Supplier Debt Payables',
      search: 'Search bills by supplier or bill number...',
      price: 'Purchase Unit Cost',
      quantity: 'Supplied Quantity',
      addItems: 'Add Stock Items',
      cancel: 'Cancel',
      delete: 'Purge Purchase Invoice',
    },
    reports: {
      title: 'Advanced Financial Board',
      revenue: 'Gross Revenue / Inflow',
      profit: 'Est. Net Gross Profit',
      transactions: 'Total Cleared Trades',
      totalDebt: 'Outstanding customer debt',
      salesAnalysis: 'Revenue vs Profit Analytics',
      topSelling: 'Highest Selling Inventory Items',
      categoryDistribution: 'Volume share by Classification',
      stockWarning: 'Immediate restock indicators',
      today: 'Today',
      week: 'This Week',
      month: 'This Month',
      year: 'This Year',
      period: 'Report timeframe:',
      exportExcel: 'Backup Database (JSON)',
      totalItemsSold: 'Physical items sold out',
      profitMargin: 'Avg Profit margin',
    },
    settings: {
      title: 'System & Corporate Settings',
      storeName: 'Establishment / Brand Name',
      storePhone: 'Store Phone Line',
      storeEmail: 'Corporate Email',
      storeAddress: 'Full Store Location',
      registrationNumber: 'ICE (Unified Enterprise ID)',
      taxNumber: 'Tax Registration / Commercial Register (IF / CR)',
      currency: 'Business Base Currency',
      defaultTaxRate: 'Default VAT Calculation (%)',
      save: 'Commit Corporate settings',
      resetData: 'Clear & Sanitize Database',
      resetConfirm: 'Are you sure you want to hard reset the database configuration? This wipes invoices and customer files.',
      importExport: 'Database Dump Backups (JSON)',
      exportBtn: 'Download Database Backup',
      importBtn: 'Upload Database Restore',
      importSuccess: 'Database restored correctly!',
      saveBtn: 'Save Details',
      updateSuccess: 'Settings updated correctly!',
    },
    common: {
      confirmDelete: 'Are you absolutely sure you want to clear this item?',
      saveSuccess: 'Data saved correctly.',
      deleteSuccess: 'Target entity removed correctly.',
      requiredFields: 'Please inspect requested highlights in red color.',
      arabic: 'العربية',
      french: 'Français',
      english: 'English',
    },
  },
};
