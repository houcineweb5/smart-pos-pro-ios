import React, { useState } from 'react';
import { Employee, Language, ActiveTab } from '../types';
import { Users, Shield, Lock, Key, Check, Plus, Trash2, Edit2, ShieldAlert, Upload } from 'lucide-react';

interface UsersManagementProps {
  currentUser: Employee;
  employees: Employee[];
  onSaveEmployee: (employee: Employee) => void;
  onDeleteEmployee: (id: string) => void;
  lang: Language;
}

export default function UsersManagement({
  currentUser,
  employees,
  onSaveEmployee,
  onDeleteEmployee,
  lang,
}: UsersManagementProps) {
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);

  // Form states
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'user'>('user');
  const [allowedTabs, setAllowedTabs] = useState<ActiveTab[]>(['home', 'pos', 'invoices', 'customers']);
  const [photoUrl, setPhotoUrl] = useState('');

  const translations = {
    ar: {
      title: 'إدارة الموظفين والصلاحيات',
      desc: 'إضافة حسابات للعمال والكاشير وتحديد الصفحات والأقسام المسموح لهم بزيارتها أو التعديل عليها.',
      addUserBtn: 'إضافة موظف جديد',
      listTitle: 'الموظفون الحاليون في النظام',
      tableHeaders: {
        emp: 'الموظف',
        username: 'اسم المستخدم',
        role: 'الدور الصلاحية',
        pages: 'الصفحات المرخصة',
        actions: 'إجراءات',
      },
      roles: {
        admin: 'مدير (صلاحيات كاملة)',
        user: 'موظف / كاشير',
      },
      form: {
        addTitle: 'إضافة حساب موظف جديد',
        editTitle: 'تعديل بيانات الحساب الصلاحيات',
        name: 'الاسم الكامل للموظف',
        username: 'اسم المستخدم للبيانات',
        password: 'كلمة المرور للدخول',
        role: 'الدور في النظام',
        permissions: 'تحديد صفحات الوصول المرخصة',
        save: 'حفظ الحساب والصلاحيات',
        cancel: 'إلغاء التراجع',
      },
      validation: {
        userExists: 'اسم المستخدم هذا مسجل مسبقاً لموظف آخر!',
        fillAll: 'يرجى إكمال الحقول المطلوبة.',
        deleted: 'تم حذف حساب الموظف بنجاح.',
        saved: 'تم حفظ حساب الموظف وتحديث الصلاحيات بنجاح!',
        selfDelete: 'عذراً، لا يمكنك حذف حسابك الحالي أثناء تسجيل الدخول!',
      },
      tabNames: {
        home: 'الرئيسية',
        pos: 'نقطة البيع (كاشير)',
        invoices: 'إدارة فواتير المبيعات',
        'commercial-documents': 'إدارة الوثائق التجارية (Facture / Devis / BC / BL)',
        'purchase-entry': 'فاتورة المشتريات (توريد)',
        inventory: 'إدارة المخزن والمنتجات',
        customers: 'سجل الزبناء والديون',
        expenses: 'المصاريف والأعباء',
        reports: 'التقارير المالية',
        settings: 'الإعدادات العامة',
        suppliers: 'سجل المورّدين والديون',
        purchases: 'إدارة فواتير المشتريات والديون',
        users: 'صلاحيات الموظفين والعمال',
        repairs: 'قسم الصيانة والإصلاحات',
        logs: 'سجل العمليات والأنشطة',
        backup: 'إدارة البيانات والنسخ الاحتياطي',
        'mobile-sync': 'تطبيق الهاتف والمزامنة',
      }
    },
    fr: {
      title: 'Gestion des Utilisateurs & Droits',
      desc: 'Créer des comptes pour vos employés ou caissiers et sélectionnez minutieusement les modules auxquels ils ont accès.',
      addUserBtn: 'Ajouter un Collaborateur',
      listTitle: 'Membres actuels de l’équipe',
      tableHeaders: {
        emp: 'Employé',
        username: "Nom d'utilisateur",
        role: 'Rôle / Permissions',
        pages: 'Modules Autorisés',
        actions: 'Actions',
      },
      roles: {
        admin: 'Admin (Accès Total)',
        user: 'Utilisateur / Caissier',
      },
      form: {
        addTitle: 'Créer un compte collaborateur',
        editTitle: 'Modifier le compte & permissions',
        name: 'Nom complet de l’employé',
        username: "Nom d'utilisateur",
        password: 'Mot de passe de connexion',
        role: 'Rôle assigné',
        permissions: 'Configurer les modules autorisés',
        save: 'Enregistrer le compte',
        cancel: 'Annuler',
      },
      validation: {
        userExists: "Ce nom d'utilisateur est déjà utilisé par un autre membre !",
        fillAll: 'Veuillez remplir tous les champs requis.',
        deleted: 'Compte employé supprimé avec succès.',
        saved: 'Le compte et ses droits ont été sauvegardés !',
        selfDelete: 'Vous ne pouvez pas supprimer votre propre compte actif !',
      },
      tabNames: {
        home: 'Accueil',
        pos: 'Point de Vente (POS)',
        invoices: 'Factures de Ventes',
        'commercial-documents': 'Documents Commerciaux (Facture / Devis / BC / BL)',
        'purchase-entry': 'Facture d\'Achat',
        inventory: 'Gestion du Stock',
        customers: 'Clients & Dettes',
        expenses: 'Dépenses & Charges',
        reports: 'Rapports Financiers',
        settings: 'Configuration',
        suppliers: 'Fournisseurs',
        purchases: 'Gestion Achats & Dettes',
        users: "Droits de l'équipe",
        repairs: 'Réparations & SAV',
        logs: "Journal d'activités",
        backup: 'Sauvegarde & Données',
        'mobile-sync': 'Synchronisation Mobile',
      }
    },
    en: {
      title: 'Staff Users & Access Rights',
      desc: 'Add user profiles for employees, cashiers, or managers, and assign which exact dashboards they can view or modify.',
      addUserBtn: 'Add New Staff Member',
      listTitle: 'Current Active Workforce',
      tableHeaders: {
        emp: 'Staff Member',
        username: 'Username',
        role: 'Base Authority',
        pages: 'Allowed Modules',
        actions: 'Actions',
      },
      roles: {
        admin: 'Admin (Full Clearance)',
        user: 'Staff / Standard User',
      },
      form: {
        addTitle: 'Add New Staff Account',
        editTitle: 'Edit Staff Account & Permissions',
        name: 'Full Employee Name',
        username: 'Login Username',
        password: 'Password Secret',
        role: 'Assigned Role',
        permissions: 'Grant Module Clearances',
        save: 'Save Profile & Roles',
        cancel: 'Cancel',
      },
      validation: {
        userExists: 'This username is already taken by another employee!',
        fillAll: 'Please fill in all mandatory fields.',
        deleted: 'Staff profile removed successfully.',
        saved: 'Staff permissions updated and written safely!',
        selfDelete: "Access denied: You cannot delete your own logged-in account!",
      },
      tabNames: {
        home: 'Home',
        pos: 'Point of Sale (POS)',
        invoices: 'Sales Invoices Management',
        'commercial-documents': 'Commercial Documents (Facture / Devis / BC / BL)',
        'purchase-entry': 'Purchase Invoice',
        inventory: 'Inventory & Stock',
        customers: 'Customers & Debts',
        expenses: 'Expenses & Charges',
        reports: 'Financial Reports',
        settings: 'Global Settings',
        suppliers: 'Suppliers Record',
        purchases: 'Purchases & Debts Management',
        users: 'Staff & Permissions',
        repairs: 'Repairs & Maintenance',
        logs: 'System Logs',
        backup: 'Backup & Data Management',
        'mobile-sync': 'Mobile Sync',
      }
    }
  };

  const t = translations[lang] || translations.en;
  const isRTL = lang === 'ar';

  const allSelectableTabs: ActiveTab[] = [
    'home',
    'pos',
    'invoices',
    'commercial-documents',
    'purchase-entry',
    'inventory',
    'customers',
    'expenses',
    'reports',
    'settings',
    'suppliers',
    'purchases',
    'users',
    'repairs',
    'logs',
    'backup',
    'mobile-sync',
  ];

  const resetForm = () => {
    setUsername('');
    setName('');
    setPassword('');
    setRole('user');
    setAllowedTabs(['home', 'pos', 'invoices', 'customers']);
    setPhotoUrl('');
    setEditingEmployee(null);
    setIsAddingNew(false);
  };

  const handleEditInit = (emp: Employee) => {
    setEditingEmployee(emp);
    setUsername(emp.username);
    setName(emp.name);
    setPassword(emp.passwordHash);
    setRole(emp.role);
    setAllowedTabs(emp.allowedTabs || []);
    setPhotoUrl(emp.id === 'emp-admin' || emp.username === 'admin' ? '/sp-icon.png' : emp.photoUrl || '');
    setIsAddingNew(true);
  };

  const handleToggleTab = (tab: ActiveTab) => {
    if (allowedTabs.includes(tab)) {
      setAllowedTabs(allowedTabs.filter((t) => t !== tab));
    } else {
      setAllowedTabs([...allowedTabs, tab]);
    }
  };

  const handleToggleAll = () => {
    if (allowedTabs.length >= allSelectableTabs.length) {
      setAllowedTabs([]);
    } else {
      setAllowedTabs(allSelectableTabs);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !username.trim() || !password.trim()) {
      alert(t.validation.fillAll);
      return;
    }

    const collision = employees.find(
      (emp) =>
        emp.username.toLowerCase() === username.trim().toLowerCase() &&
        emp.id !== (editingEmployee?.id || '')
    );

    if (collision) {
      alert(t.validation.userExists);
      return;
    }

    const isAdminUser = editingEmployee?.id === 'emp-admin' || username.trim().toLowerCase() === 'admin';
    const targetEmployee: Employee = {
      id: editingEmployee?.id || 'emp_' + Date.now(),
      username: username.trim().toLowerCase(),
      name: name.trim(),
      passwordHash: password,
      role,
      allowedTabs,
      photoUrl: isAdminUser ? '/sp-icon.png' : photoUrl,
      createdAt: editingEmployee?.createdAt || new Date().toISOString(),
    };

    onSaveEmployee(targetEmployee);
    alert(t.validation.saved);
    resetForm();
  };

  const handleDelete = (empId: string) => {
    if (empId === currentUser.id) {
      alert(t.validation.selfDelete);
      return;
    }

    const confirmMsg = lang === 'ar' ? 'هل أنت متأكد من حذف حساب هذا الموظف؟' : 'Are you sure you want to delete this staff account?';
    if (window.confirm(confirmMsg)) {
      onDeleteEmployee(empId);
      alert(t.validation.deleted);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in" id="users-tab-view">
      
      {/* Header section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 sm:p-6 rounded-3xl border border-slate-200">
        <div className="space-y-1 text-start">
          <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-600" />
            {t.title}
          </h2>
          <p className="text-slate-550 text-xs leading-relaxed max-w-2xl font-semibold">
            {t.desc}
          </p>
        </div>
        {!isAddingNew && (
          <button
            onClick={() => setIsAddingNew(true)}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black flex items-center gap-2 transition duration-200 self-stretch sm:self-auto justify-center cursor-pointer"
          >
            <Plus className="w-4.5 h-4.5" />
            {t.addUserBtn}
          </button>
        )}
      </div>

      {isAddingNew ? (
        /* Edit or Add Employee Form */
        <form onSubmit={handleSubmit} className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 space-y-6 text-start">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-sm font-black text-indigo-700 flex items-center gap-2">
              <Shield className="w-4.5 h-4.5" />
              {editingEmployee ? t.form.editTitle : t.form.addTitle}
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Field: Profile Photo */}
            <div className="md:col-span-3 flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200/60">
              <div className="w-16 h-16 rounded-full bg-slate-205 border border-slate-300 flex items-center justify-center font-black text-lg text-slate-700 uppercase overflow-hidden shrink-0">
                {photoUrl ? (
                  <img src={photoUrl} alt="Avatar Preview" className="w-full h-full object-cover" />
                ) : (
                  name ? name.slice(0, 2) : '📷'
                )}
              </div>
              <div className="space-y-1.5 text-start">
                <span className="block text-[11px] font-black text-slate-500 uppercase tracking-wider">
                  {lang === 'ar' ? 'الصورة الشخصية للموظف' : 'Employee Profile Photo'}
                </span>
                <div className="flex gap-2">
                  <input
                    type="file"
                    id="employee-avatar-file-input"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        setPhotoUrl(event.target?.result as string);
                      };
                      reader.readAsDataURL(file);
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => document.getElementById('employee-avatar-file-input')?.click()}
                    className="px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold rounded-lg text-xs transition cursor-pointer flex items-center gap-1"
                  >
                    <Upload className="w-3.5 h-3.5 text-indigo-600" />
                    <span>{lang === 'ar' ? 'تحميل صورة' : 'Upload Photo'}</span>
                  </button>
                  {photoUrl && (
                    <button
                      type="button"
                      onClick={() => setPhotoUrl('')}
                      className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 font-bold rounded-lg text-xs transition cursor-pointer"
                    >
                      {lang === 'ar' ? 'إزالة' : 'Remove'}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Field: Full Name */}
            <div className="space-y-1">
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider">{t.form.name}</label>
              <input
                type="text"
                required
                placeholder={lang === 'ar' ? 'أدخل الاسم الكامل' : 'Enter full name'}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white transition"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            {/* Field: Username */}
            <div className="space-y-1">
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider">{t.form.username}</label>
              <input
                type="text"
                required
                disabled={editingEmployee && editingEmployee.username === 'admin'}
                placeholder={lang === 'ar' ? 'مثال: cashier1' : 'e.g., cashier1'}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white transition disabled:opacity-50"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>

            {/* Field: Password */}
            <div className="space-y-1">
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider">{t.form.password}</label>
              <input
                type="text"
                required
                placeholder="Password123"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white transition"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          {/* Role Choice */}
          <div className="space-y-2">
            <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider block">{t.form.role}</label>
            <div className="flex flex-wrap gap-3 sm:gap-4">
              <label className="flex items-center gap-2 bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-200 cursor-pointer text-xs font-bold hover:bg-slate-100 transition">
                <input
                  type="radio"
                  name="user-role"
                  checked={role === 'admin'}
                  onChange={() => setRole('admin')}
                  className="accent-indigo-600"
                />
                <span className="text-slate-800">{t.roles.admin}</span>
              </label>

              <label className="flex items-center gap-2 bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-200 cursor-pointer text-xs font-bold hover:bg-slate-100 transition">
                <input
                  type="radio"
                  name="user-role"
                  checked={role === 'user'}
                  onChange={() => setRole('user')}
                  className="accent-indigo-600"
                />
                <span className="text-slate-800">{t.roles.user}</span>
              </label>
            </div>
          </div>

          {/* Allowed Modules Checklist */}
          <div className="bg-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-200/80 space-y-3">
            <div className="flex justify-between items-center border-b border-slate-200/60 pb-2">
              <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider">
                🛡️ {t.form.permissions}
              </span>
              <button
                type="button"
                onClick={handleToggleAll}
                className="px-2.5 py-1 text-[10px] font-extrabold text-indigo-700 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition cursor-pointer"
              >
                {allowedTabs.length >= allSelectableTabs.length ? (lang === 'ar' ? 'إلغاء تحديد الكل' : 'Deselect All') : (lang === 'ar' ? 'تحديد جميع الصفحات' : 'Select All')}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {allSelectableTabs.map((tab) => {
                const isSelected = allowedTabs.includes(tab);
                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => handleToggleTab(tab)}
                    className={`p-3 rounded-xl border flex items-center justify-between text-start text-xs font-bold transition cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-50/70 border-indigo-200 text-indigo-850 shadow-sm'
                        : 'bg-white border-slate-200 text-slate-800 hover:bg-slate-100/55'
                    }`}
                  >
                    <span>{(t.tabNames as any)[tab] || tab}</span>
                    <span className={`w-4.5 h-4.5 rounded-md flex items-center justify-center shrink-0 border ${
                      isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-transparent border-slate-300'
                    }`}>
                      {isSelected && <Check className="w-3.5 h-3.5 stroke-[4.5]" />}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Form Actions footer */}
          <div className="flex justify-end gap-3 border-t border-slate-100 pt-5">
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2 bg-slate-150 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              {t.form.cancel}
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition shadow-md shadow-indigo-600/10 cursor-pointer"
            >
              {t.form.save}
            </button>
          </div>
        </form>
      ) : (
        /* Employees workforce list */
        <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-150/70 bg-slate-50/50 flex items-center gap-2">
            <Shield className="w-4.5 h-4.5 text-indigo-600" />
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-wider">{t.listTitle}</h3>
          </div>

          {/* Mobile Card Layout for iPhone / Small Screens */}
          <div className="md:hidden divide-y divide-slate-100" dir={isRTL ? 'rtl' : 'ltr'}>
            {employees.map((emp) => {
              const isOwn = emp.id === currentUser.id;
              return (
                <div key={emp.id} className="p-4 space-y-3 hover:bg-slate-50/50 transition text-start">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {emp.id === 'emp-admin' || emp.username === 'admin' || emp.photoUrl ? (
                        <img
                          src={emp.id === 'emp-admin' || emp.username === 'admin' ? '/sp-icon.png' : emp.photoUrl}
                          alt={emp.name}
                          className="w-10 h-10 rounded-full object-cover border border-slate-200 shrink-0"
                        />
                      ) : (
                        <div className={`w-10 h-10 rounded-full font-black text-xs flex items-center justify-center border uppercase tracking-wider shrink-0 ${
                          emp.role === 'admin' ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-slate-100 border-slate-200 text-slate-600'
                        }`}>
                          {emp.name.slice(0, 2)}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="font-black text-slate-900 text-sm flex items-center gap-1.5 flex-wrap">
                          <span className="truncate">{emp.name}</span>
                          {isOwn && (
                            <span className="bg-indigo-600 text-white font-black text-[10px] px-2 py-0.5 rounded-full">
                              {lang === 'ar' ? 'أنت' : 'me'}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-xs">
                          <span className="font-mono font-bold text-indigo-600">@{emp.username}</span>
                          <span className="text-[10px] text-slate-400 font-mono">• ID: {emp.id}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleEditInit(emp)}
                        className="p-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl transition cursor-pointer"
                        title={lang === 'ar' ? 'تعديل' : 'Edit'}
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(emp.id)}
                        disabled={isOwn || emp.username === 'admin'}
                        className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl transition disabled:opacity-30 cursor-pointer"
                        title={lang === 'ar' ? 'حذف' : 'Delete'}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Role Badge */}
                  <div>
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-black rounded-lg ${
                      emp.role === 'admin'
                        ? 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                        : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                    }`}>
                      <Key className="w-3.5 h-3.5 stroke-[2.5]" />
                      {emp.role === 'admin' ? t.roles.admin : t.roles.user}
                    </span>
                  </div>

                  {/* Allowed Pages */}
                  <div className="space-y-1.5 pt-1">
                    <span className="block text-[10px] font-black text-slate-400 uppercase">
                      {t.tableHeaders.pages} ({(emp.allowedTabs || []).length}):
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {(emp.allowedTabs || []).map((tab) => (
                        <span
                          key={tab}
                          className="bg-slate-100 text-[10px] font-bold text-slate-700 px-2 py-1 rounded-lg border border-slate-200/70"
                        >
                          {(t.tabNames as any)[tab] || tab}
                        </span>
                      ))}
                      {(!emp.allowedTabs || emp.allowedTabs.length === 0) && (
                        <span className="text-red-500 font-extrabold text-[11px]">
                          ⚠️ {lang === 'ar' ? 'لا توجد صفحات مرخصة!' : 'No modules granted!'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-start text-xs" dir={isRTL ? 'rtl' : 'ltr'}>
              <thead>
                <tr className="bg-slate-50 text-slate-450 uppercase tracking-wider font-extrabold border-b border-slate-150 text-[10px]">
                  <th className="p-4 text-start font-black">{t.tableHeaders.emp}</th>
                  <th className="p-4 text-start font-black">{t.tableHeaders.username}</th>
                  <th className="p-4 text-start font-black">{t.tableHeaders.role}</th>
                  <th className="p-4 text-start font-black">{t.tableHeaders.pages}</th>
                  <th className="p-4 text-end font-black">{t.tableHeaders.actions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                {employees.map((emp) => {
                  const isOwn = emp.id === currentUser.id;
                  return (
                    <tr key={emp.id} className="hover:bg-slate-50/50 transition">
                      {/* Name Card */}
                      <td className="p-4 whitespace-nowrap">
                        <div className="flex items-center gap-2.5 text-start">
                          {emp.id === 'emp-admin' || emp.username === 'admin' || emp.photoUrl ? (
                            <img
                              src={emp.id === 'emp-admin' || emp.username === 'admin' ? '/sp-icon.png' : emp.photoUrl}
                              alt={emp.name}
                              className="w-9 h-9 rounded-full object-cover border border-slate-200"
                            />
                          ) : (
                            <div className={`w-9 h-9 rounded-full font-black text-xs flex items-center justify-center border uppercase tracking-wider ${
                              emp.role === 'admin' ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-slate-100 border-slate-200 text-slate-600'
                            }`}>
                              {emp.name.slice(0, 2)}
                            </div>
                          )}
                          <div className="space-y-0.5">
                            <span className="font-bold text-slate-800 text-[12px] block flex items-center gap-1.5">
                              {emp.name}
                              {isOwn && (
                                <span className="bg-indigo-600 text-white font-black text-[9px] px-1.5 py-0.5 rounded-full lowercase font-mono">
                                  {lang === 'ar' ? 'أنت' : 'me'}
                                </span>
                              )}
                            </span>
                            <span className="text-[10px] text-slate-400 block font-mono">
                              ID: {emp.id}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Username */}
                      <td className="p-4 whitespace-nowrap font-mono text-xs font-bold text-slate-800">
                        {emp.username}
                      </td>

                      {/* Role representation */}
                      <td className="p-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-black rounded-lg ${
                          emp.role === 'admin'
                            ? 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                        }`}>
                          <Key className="w-3.5 h-3.5 stroke-[2.5]" />
                          {emp.role === 'admin' ? t.roles.admin : t.roles.user}
                        </span>
                      </td>

                      {/* Clearances count and list preview */}
                      <td className="p-4 text-start font-mono max-w-[340px]">
                        <div className="flex flex-wrap gap-1 leading-normal">
                          {(emp.allowedTabs || []).map((tab) => (
                            <span
                              key={tab}
                              className="bg-slate-100/80 text-[10px] font-bold text-slate-700 px-2 py-0.5 rounded-md border border-slate-200/60"
                            >
                              {(t.tabNames as any)[tab] || tab}
                            </span>
                          ))}
                          {(!emp.allowedTabs || emp.allowedTabs.length === 0) && (
                            <span className="text-red-500 font-extrabold text-[10px]">
                              ⚠️ {lang === 'ar' ? 'لا توجد صفحات مرخصة!' : 'No modules granted!'}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="p-4 whitespace-nowrap text-end">
                        <div className="flex justify-end gap-1.5">
                          <button
                            onClick={() => handleEditInit(emp)}
                            className="p-1.5 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-500 rounded-lg transition cursor-pointer"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(emp.id)}
                            disabled={isOwn || emp.username === 'admin'}
                            className="p-1.5 bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-500 rounded-lg transition disabled:opacity-30 disabled:hover:bg-slate-100 disabled:hover:text-slate-500 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
