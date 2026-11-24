#!/usr/bin/env node
/**
 * SmartPOS Pro - License Key Generator (Interactive & CLI)
 */

const crypto = require('crypto');
const readline = require('readline');

const LICENSE_SALT = process.env.LICENSE_SALT || 'SMARTPOS_PRO_ENTERPRISE_SECRET_SALT_2026#98765';

function generateActivationKey(machineId, salt = LICENSE_SALT) {
  const cleanId = machineId.trim().toUpperCase();
  const hmac = crypto.createHmac('sha256', salt).update(cleanId).digest('hex').toUpperCase();
  return `ACTV-${hmac.substring(0, 4)}-${hmac.substring(4, 8)}-${hmac.substring(8, 12)}`;
}

function printLicense(machineId, customer) {
  const key = generateActivationKey(machineId);
  console.log('\n======================================================================');
  console.log('✅ تم توليد مفتاح التفعيل بنجاح!');
  console.log('----------------------------------------------------------------------');
  console.log(`اسم العميل / المتجر          : ${customer}`);
  console.log(`معرف جهاز العميل (Machine ID): ${machineId}`);
  console.log(`مفتاح التفعيل (License Key)  : ${key}`);
  console.log('النوع                        : ترخيص تجاري دائم مدى الحياة (Lifetime License)');
  console.log('======================================================================\n');
  console.log('💡 قم بنسخ مفتاح التفعيل الظاهر أعلاه وأرسله للعميل لتفعيل نسخته.\n');
}

const args = process.argv.slice(2);

if (args.length > 0) {
  // CLI mode with arguments
  const machineId = args[0];
  const customer = args[1] || 'Commercial Customer';
  printLicense(machineId, customer);
} else {
  // Interactive mode (When double-clicked via .bat)
  console.log('======================================================================');
  console.log('           🔑 SmartPOS Pro - أداة توليد مفاتيح التفعيل للزبائن');
  console.log('======================================================================\n');
  console.log('هذه الأداة مخصصة لك فقط (صاحب ومطور البرنامج) لتوليد التراخيص.\n');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.question('يرجى إدخال معرف جهاز العميل (Machine ID): ', (machineId) => {
    const cleanId = (machineId || '').trim();
    if (!cleanId) {
      console.log('\n[خطأ] لم يتم إدخال معرف الجهاز!');
      rl.close();
      return;
    }

    rl.question('يرجى إدخال اسم المتجر أو الزبون (اختياري): ', (customer) => {
      const custName = (customer || '').trim() || 'عميل تجاري';
      printLicense(cleanId, custName);
      rl.question('اضغط Enter للخروج...', () => {
        rl.close();
      });
    });
  });
}
