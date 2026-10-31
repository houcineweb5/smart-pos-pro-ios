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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmedUser = username.trim().toLowerCase();
    
    // First attempt server-authoritative API login
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: trimmedUser, password }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.ok && data.user) {
          if (data.token) {
            localStorage.setItem('smartpos_auth_token', data.token);
          }
          onLogin(data.user);
          return;
        }
      } else if (res.status === 429) {
        const errJson = await res.json().catch(() => ({}));
        setError(errJson.error || 'Too many attempts. Please wait.');
        return;
      }
    } catch {
      // Offline fallback for standalone mobile app
    }

    // Offline / Standalone Capacitor fallback
    const found = employees.find((emp) => {
      if (emp.username.toLowerCase() !== trimmedUser) return false;
      const effectivePwd =
        (emp.id === 'emp-admin' || emp.username.toLowerCase() === 'admin') &&
        (!emp.passwordHash || emp.passwordHash === 'admin')
          ? 'smartpos'
          : emp.passwordHash;
      return effectivePwd === password;
    });

    if (found) {
      onLogin(
        found.id === 'emp-admin' || found.username.toLowerCase() === 'admin'
          ? {
              ...found,
              passwordHash: '',
              photoUrl: '/sp-icon.png',
            }
          : { ...found, passwordHash: '' }
      );
    } else {
      setError(t.errorMsg);
    }
  };

  return (
    <div className="min-h-screen min-h-[100dvh] flex items-center justify-center bg-slate-100 p-4 font-sans safe-modal-overlay overflow-y-auto" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="w-full max-w-md my-auto bg-white border border-slate-200 rounded-3xl shadow-xl overflow-hidden hover:shadow-2xl transition-all duration-300">
        
        {/* Language Selection Header */}
        <div className="flex justify-end gap-1.5 p-4 bg-slate-50 border-b border-slate-100">
          <div className="flex items-center gap-1.5 mr-auto ml-0 text-slate-400 text-xs font-bold font-mono">
            <Globe className="w-4 h-4 text-slate-500" />
            <span>LANG:</span>
          </div>
          {(['ar', 'fr', 'en'] as const).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => onSetLang(l)}
              className={`px-2.5 py-1 text-[11px] font-black rounded-lg uppercase tracking-wider transition cursor-pointer ${
                lang === l
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-200'
              }`}
            >
              {l === 'ar' ? 'العربية' : l === 'fr' ? 'FR' : 'EN'}
            </button>
          ))}
        </div>

        {/* Brand Header */}
        <div className="p-8 text-center bg-gradient-to-b from-indigo-50/40 to-transparent">
          <img
            src="/sp-icon.png"
            alt="Smart POS Pro"
            className="w-20 h-20 rounded-2xl object-contain bg-white p-1 mx-auto mb-4 shadow-xl border border-indigo-100"
          />
          <h2 className="text-xl font-black text-slate-800 tracking-tight leading-snug">
            {t.title}
          </h2>
          <p className="text-slate-400 text-xs mt-1.5 font-semibold">
            {t.subtitle}
          </p>
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="px-8 pb-8 space-y-4">
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
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition"
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
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl shadow-lg shadow-indigo-600/10 transition duration-300 cursor-pointer"
          >
            {t.loginBtn}
          </button>
        </form>

      </div>
    </div>
  );
}
