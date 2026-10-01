import React, { useState } from 'react';
import { Employee, Language } from '../types';
import { Lock, User, CheckCircle, ShieldAlert, Globe } from 'lucide-react';

interface LoginScreenProps {
  employees: Employee[];
  onLogin: (employee: Employee) => void;
  lang: Language;
  onSetLang: (lang: Language) => void;
}

export default function LoginScreen({ employees, onLogin, lang, onSetLang }: LoginScreenProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const translations = {
    ar: {
      title: 'نظام إدارة المبيعات والمخازن',
      subtitle: 'يرجى تسجيل الدخول للمتابعة',
      usernameLabel: 'اسم المستخدم',
      passwordLabel: 'كلمة المرور',
      loginBtn: 'تسجيل الدخول',
      errorMsg: 'اسم المستخدم أو كلمة المرور غير صحيحة!',
      demoNotice: 'ملاحظة: يمكنك الدخول بالحسابات الافتراضية التالية:',
      adminRole: 'مدير كامل الصلاحيات',
      cashierRole: 'كاشير (صلاحيات محدودة)',
      usernamePlace: 'مثال: admin',
      passwordPlace: '••••••••',
    },
    fr: {
      title: 'Système de Gestion de Vente & Stock',
      subtitle: 'Veuillez vous connecter pour continuer',
      usernameLabel: "Nom d'utilisateur",
      passwordLabel: 'Mot de passe',
      loginBtn: 'Se connecter',
      errorMsg: "Nom d'utilisateur ou mot de passe incorrect !",
      demoNotice: 'Note: Vous pouvez utiliser les comptes de démo suivants :',
      adminRole: 'Administrateur (Tous les accès)',
      cashierRole: 'Caissier (Accès limité)',
      usernamePlace: 'Ex: admin',
      passwordPlace: '••••••••',
    },
    en: {
      title: 'Sales & Inventory Management System',
      subtitle: 'Please sign in to your account',
      usernameLabel: 'Username',
      passwordLabel: 'Password',
      loginBtn: 'Sign In',
      errorMsg: 'Invalid username or password!',
      demoNotice: 'Note: You can sign in using these default accounts:',
      adminRole: 'Administrator (Full Access)',
      cashierRole: 'Cashier (Limited Access)',
      usernamePlace: 'e.g., admin',
      passwordPlace: '••••••••',
    }
  };

  const t = translations[lang] || translations.en;
  const isRTL = lang === 'ar';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmedUser = username.trim().toLowerCase();
    const found = employees.find(
      (emp) => emp.username.toLowerCase() === trimmedUser && emp.passwordHash === password
    );

    if (found) {
      onLogin(found);
    } else {
      setError(t.errorMsg);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4 font-sans" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl shadow-xl overflow-hidden hover:shadow-2xl transition-all duration-300">
        
        {/* Language Selection Header */}
        <div className="flex justify-end gap-1.5 p-4 bg-slate-50 border-b border-slate-100">
          <div className="flex items-center gap-1.5 mr-auto ml-0 text-slate-400 text-xs font-bold font-mono">
            <Globe className="w-4 h-4 text-slate-500" />
            <span>LANG:</span>
          </div>
          {(['ar', 'fr', 'en'] as const).map((l) => (
            <button
              key={l}
              onClick={() => onSetLang(l)}
              className={`px-2.5 py-1 text-[11px] font-black rounded-lg uppercase tracking-wider transition ${
                lang === l
                  ? 'bg-indigo-650 text-white shadow-sm'
                  : 'text-slate-550 hover:bg-slate-200'
              }`}
            >
              {l === 'ar' ? 'العربية' : l === 'fr' ? 'FR' : 'EN'}
            </button>
          ))}
        </div>

        {/* Brand Header */}
        <div className="p-8 text-center bg-gradient-to-b from-indigo-55/35 to-transparent">
          <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-600/10">
            <Lock className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-xl font-black text-slate-800 tracking-tight leading-snug">
            {t.title}
          </h2>
          <p className="text-slate-400 text-xs mt-1.5 font-semibold">
            {t.subtitle}
          </p>
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="px-8 pb-6 space-y-4">
          {error && (
            <div className="p-3.5 bg-rose-50 border border-rose-100 rounded-xl flex items-center gap-2.5 text-xs text-rose-700 font-bold animate-fade-in">
              <ShieldAlert className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-1 text-start">
            <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider">
              {t.usernameLabel}
            </label>
            <div className="relative">
              <span className={`absolute inset-y-0 ${isRTL ? 'left-3' : 'right-3'} flex items-center text-slate-400`}>
                <User className="w-4.5 h-4.5" />
              </span>
              <input
                type="text"
                required
                placeholder={t.usernamePlace}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-5/40 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition"
              />
            </div>
          </div>

          <div className="space-y-1 text-start">
            <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider">
              {t.passwordLabel}
            </label>
            <div className="relative">
              <span className={`absolute inset-y-0 ${isRTL ? 'left-3' : 'right-3'} flex items-center text-slate-400`}>
                <Lock className="w-4.5 h-4.5" />
              </span>
              <input
                type="password"
                required
                placeholder={t.passwordPlace}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-5/40 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl shadow-lg shadow-indigo-600/10 transition duration-300"
          >
            {t.loginBtn}
          </button>
        </form>

        {/* Demo Credentials Box */}
        <div className="p-6 bg-slate-50 border-t border-slate-100/85">
          <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-2.5 text-center">
            🔑 {t.demoNotice}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <div className="bg-white p-2.5 rounded-xl border border-slate-200/90 text-start flex flex-col gap-1">
              <span className="font-extrabold text-indigo-700 text-[10px] block">
                👑 {t.adminRole}
              </span>
              <div className="font-mono text-[10px] text-slate-550">
                <div>User: <span className="font-bold text-slate-800 bg-slate-100 px-1 rounded">admin</span></div>
                <div>Pass: <span className="font-bold text-slate-800 bg-slate-100 px-1 rounded">admin</span></div>
              </div>
            </div>

            <div className="bg-white p-2.5 rounded-xl border border-slate-200/90 text-start flex flex-col gap-1">
              <span className="font-extrabold text-emerald-700 text-[10px] block">
                💼 {t.cashierRole}
              </span>
              <div className="font-mono text-[10px] text-slate-550">
                <div>User: <span className="font-bold text-slate-800 bg-slate-100 px-1 rounded">user1</span></div>
                <div>Pass: <span className="font-bold text-slate-800 bg-slate-100 px-1 rounded">user1</span></div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
