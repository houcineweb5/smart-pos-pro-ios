#!/usr/bin/env node
/**
 * SmartPOS Pro - Final Release Packager & Windows Installer Compiler
 * 
 * Steps performed:
 * 1. Runs `npm run build` (Vite frontend + Esbuild server.cjs bundle)
 * 2. Checks/Creates clean production database if needed
 * 3. Updates installer/payload.zip with the latest dist/ and database
 * 4. Compiles Final-Release/Setup-SmartPOS.exe using Microsoft .NET CSC
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const cwd = process.cwd();
const finalReleaseDir = path.join(cwd, 'Final-Release');
const installerDir = path.join(cwd, 'installer');
const payloadZip = path.join(installerDir, 'payload.zip');
const cscPath = 'C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe';

console.log('======================================================================');
console.log('       🚀 SmartPOS Pro - بناء الحزمة النهائية ومثبت الويندوز');
console.log('======================================================================\n');

// 1. Build Frontend & Server
console.log('[1/4] 🔨 جاري بناء وتجميع ملفات الويب والخادم (Vite + Esbuild)...');
try {
  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  execSync(`"${npmCmd}" run build`, { stdio: 'inherit', cwd, shell: true });
} catch (err) {
  console.error('\n❌ فشل تجميع المشروع (Build Failed). يرجى مراجعة الأخطاء أعلاه.');
  process.exit(1);
}

// 2. Check Database for Packaging
console.log('\n[2/4] 🗄️ التحقق من قاعدة بيانات التوزيع التجاري...');
let sourceDb = path.join(cwd, 'database_clean.sqlite');
if (!fs.existsSync(sourceDb)) {
  console.log('   - إنشاء قاعدة بيانات نظيفة تلقائياً...');
  try {
    execSync(`node "${path.join(cwd, 'scripts', 'create_clean_production_db.cjs')}"`, { stdio: 'inherit' });
  } catch (err) {
    sourceDb = path.join(cwd, 'database.sqlite');
  }
} else {
  console.log('   ✓ تم العثور على database_clean.sqlite النظيفة وسيتم تضمينها في الحزمة.');
}

// 3. Update payload.zip with latest dist & clean database
console.log('\n[3/4] 📦 تحديث حزمة الملفات المدمجة (payload.zip)...');
const stagingDir = path.join(cwd, 'temp_installer_staging');
try {
  if (fs.existsSync(stagingDir)) {
    fs.rmSync(stagingDir, { recursive: true, force: true });
  }
  fs.mkdirSync(stagingDir, { recursive: true });

  // Extract existing payload if exists
  if (fs.existsSync(payloadZip)) {
    execSync(`powershell -NoProfile -ExecutionPolicy Bypass -Command "Expand-Archive -Path '${payloadZip}' -DestinationPath '${stagingDir}' -Force"`);
  }

  // Copy fresh dist
  const distDir = path.join(cwd, 'dist');
  const targetDist = path.join(stagingDir, 'dist');
  if (fs.existsSync(targetDist)) fs.rmSync(targetDist, { recursive: true, force: true });
  fs.cpSync(distDir, targetDist, { recursive: true });

  // Copy database
  fs.copyFileSync(sourceDb, path.join(stagingDir, 'database.sqlite'));

  // Copy icon and launcher if exist
  if (fs.existsSync(path.join(installerDir, 'SmartPOS.ico'))) {
    fs.copyFileSync(path.join(installerDir, 'SmartPOS.ico'), path.join(stagingDir, 'SmartPOS.ico'));
  }
  if (fs.existsSync(path.join(cwd, 'SmartPOS.exe'))) {
    fs.copyFileSync(path.join(cwd, 'SmartPOS.exe'), path.join(stagingDir, 'SmartPOS.exe'));
  }
  if (fs.existsSync(path.join(cwd, 'SmartPOS-MasterTool.exe'))) {
    fs.copyFileSync(path.join(cwd, 'SmartPOS-MasterTool.exe'), path.join(stagingDir, 'SmartPOS-MasterTool.exe'));
  }

  // Update SmartPOS-Mobile with the latest mobile web app
  const mobileHtmlSource = path.join(cwd, 'public', 'mobile.html');
  if (fs.existsSync(mobileHtmlSource)) {
    fs.copyFileSync(mobileHtmlSource, path.join(stagingDir, 'SmartPOS-Mobile.html'));
  }

  // Include latest Android APK in the installation folder if present
  const candidateApks = [
    path.join(cwd, 'Android-Release', 'SmartPOS-Pro-Android.apk'),
    path.join(cwd, 'SmartPOS-Pro-Android.apk'),
    path.join(process.env.USERPROFILE || '', 'Desktop', 'SmartPOS-Pro-Android.apk')
  ];
  for (const apk of candidateApks) {
    if (fs.existsSync(apk)) {
      fs.copyFileSync(apk, path.join(stagingDir, 'SmartPOS-Mobile.apk'));
      fs.copyFileSync(apk, path.join(stagingDir, 'SmartPOS-Pro-Android.apk'));
      break;
    }
  }

  // Re-compress to payload.zip
  if (fs.existsSync(payloadZip)) fs.unlinkSync(payloadZip);
  execSync(`powershell -NoProfile -ExecutionPolicy Bypass -Command "Compress-Archive -Path '${stagingDir}\\*' -DestinationPath '${payloadZip}' -CompressionLevel Optimal"`);

  // Clean staging
  fs.rmSync(stagingDir, { recursive: true, force: true });
  console.log('   ✓ تم تحديث payload.zip بنجاح.');
} catch (err) {
  console.error('❌ خطأ أثناء تحديث payload.zip:', err.message);
  try { if (fs.existsSync(stagingDir)) fs.rmSync(stagingDir, { recursive: true, force: true }); } catch {}
  process.exit(1);
}

// 4. Compile Setup-SmartPOS.exe
console.log('\n[4/4] ⚙️ جاري ترجمة وبناء ملف التثبيت التنفيذي النهائي (Setup-SmartPOS.exe)...');
if (!fs.existsSync(finalReleaseDir)) {
  fs.mkdirSync(finalReleaseDir, { recursive: true });
}

const outputExe = path.join(finalReleaseDir, 'Setup-SmartPOS.exe');
const setupCs = path.join(installerDir, 'SetupInstaller.cs');
const icoPath = path.join(installerDir, 'SmartPOS.ico');
const uninstallerExe = path.join(installerDir, 'Uninstall.exe');

const compileCmd = `"${cscPath}" /target:winexe /out:"${outputExe}" /win32icon:"${icoPath}" /resource:"${payloadZip}" /resource:"${icoPath}" /resource:"${uninstallerExe}" "${setupCs}" /reference:System.IO.Compression.dll /reference:System.IO.Compression.FileSystem.dll /reference:System.Windows.Forms.dll`;

try {
  execSync(compileCmd, { stdio: 'inherit' });
  const stats = fs.statSync(outputExe);
  const sizeMb = (stats.size / (1024 * 1024)).toFixed(2);

  // Also copy MasterTool to Final-Release for quick developer access
  if (fs.existsSync(path.join(cwd, 'SmartPOS-MasterTool.exe'))) {
    fs.copyFileSync(path.join(cwd, 'SmartPOS-MasterTool.exe'), path.join(finalReleaseDir, 'SmartPOS-MasterTool.exe'));
  }

  console.log('\n======================================================================');
  console.log('🎉 تم إنشاء وتجهيز حزمة التثبيت النهائية بنجاح!');
  console.log('----------------------------------------------------------------------');
  console.log(`📁 مسار ملف التثبيت : ${outputExe}`);
  console.log(`⚖️ الحجم              : ${sizeMb} MB`);
  console.log('✨ هذا الملف المستقل تماماً هو الذي يُعطى للزبون لتثبيت البرنامج بضغطة زر واحدة.');
  console.log('======================================================================\n');
} catch (err) {
  console.error('\n❌ فشل ترجمة ملف التثبيت Setup-SmartPOS.exe');
  process.exit(1);
}
