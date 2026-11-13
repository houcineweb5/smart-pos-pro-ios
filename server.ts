/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { 
  initDB, 
  getData, 
  saveData, 
  resetDB, 
  getCloudConfigFromDB, 
  saveCloudConfigToDB,
  getEmployeeByUsername,
  getEmployeeById,
  addStockMovement,
  getStockMovements
} from './server_db.js';
import { verifyPassword, hashPassword } from './server_src/security.js';
import { 
  createSession, 
  revokeSession, 
  getSession, 
  requireAuth, 
  requireAdmin, 
  extractToken,
  checkLoginRateLimit, 
  recordFailedLogin, 
  resetLoginAttempts 
} from './server_src/auth.js';

let remoteBarcodeQueue: string[] = [];

function getLocalIPv4Addresses(): string[] {
  const interfaces = os.networkInterfaces();
  const ips: string[] = [];
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        ips.push(net.address);
      }
    }
  }
  return ips;
}

export function createExpressApp() {
  const app = express();

  // Security Headers
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  // CORS: Allow local network, loopback, and Capacitor paired origins safely
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
      const isAllowedOrigin =
        origin === 'null' ||
        origin.startsWith('http://localhost') ||
        origin.startsWith('http://127.0.0.1') ||
        origin.startsWith('capacitor://') ||
        origin.startsWith('ionic://') ||
        /^https?:\/\/(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/.test(origin);

      if (isAllowedOrigin) {
        res.header('Access-Control-Allow-Origin', origin);
        res.header('Access-Control-Allow-Credentials', 'true');
      } else {
        res.header('Access-Control-Allow-Origin', origin);
      }
    } else {
      res.header('Access-Control-Allow-Origin', '*');
    }
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
      return;
    }
    next();
  });

  // Body parser with rational limit
  app.use(express.json({ limit: '50mb' }));

  // PUBLIC ENDPOINT: Login
  app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body || {};
    const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
    const rateCheck = checkLoginRateLimit(`${clientIp}_${username}`);

    if (!rateCheck.allowed) {
      return res.status(429).json({
        ok: false,
        error: `Too many login attempts. Please try again in ${rateCheck.retryAfterSec || 60} seconds.`
      });
    }

    if (!username || !password || typeof username !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ ok: false, error: 'Username and password required' });
    }

    try {
      const emp = await getEmployeeByUsername(username);
      if (!emp) {
        recordFailedLogin(`${clientIp}_${username}`);
        return res.status(401).json({ ok: false, error: 'Invalid username or password' });
      }

      const valid = await verifyPassword(password, emp.passwordHash);
      if (!valid) {
        recordFailedLogin(`${clientIp}_${username}`);
        return res.status(401).json({ ok: false, error: 'Invalid username or password' });
      }

      // Successful login
      resetLoginAttempts(`${clientIp}_${username}`);
      const allowedTabs = typeof emp.allowedTabs === 'string' ? JSON.parse(emp.allowedTabs) : (emp.allowedTabs || []);
      const session = createSession({
        id: emp.id,
        username: emp.username,
        name: emp.name,
        role: emp.role,
        allowedTabs,
      });

      // Set cookie for browser sessions
      res.cookie('smartpos_token', session.token, {
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000,
      });

      res.json({
        ok: true,
        token: session.token,
        user: {
          id: emp.id,
          username: emp.username,
          name: emp.name,
          role: emp.role,
          photoUrl: emp.photoUrl || (emp.role === 'admin' ? '/sp-icon.png' : ''),
          allowedTabs,
        }
      });
    } catch (err: any) {
      console.error('Login error:', err);
      res.status(500).json({ ok: false, error: 'Internal server error' });
    }
  });

  // PUBLIC ENDPOINT: Logout
  app.post('/api/auth/logout', (req, res) => {
    const token = extractToken(req);
    if (token) {
      revokeSession(token);
    }
    res.clearCookie('smartpos_token');
    res.json({ ok: true });
  });

  // PROTECTED: Current session info
  app.get('/api/auth/me', requireAuth, (req, res) => {
    const user = (req as any).user;
    res.json({ ok: true, user });
  });

  // PUBLIC: Network IP list for pairing
  app.get('/api/network-info', (req, res) => {
    res.json({
      ips: getLocalIPv4Addresses(),
      port: Number(process.env.PORT) || 3000,
    });
  });

  // PROTECTED: Cloud Sync Configuration
  app.get('/api/cloud-config', requireAuth, async (req, res) => {
    try {
      const cfg = await getCloudConfigFromDB();
      res.json({ ok: true, config: cfg });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.post('/api/cloud-config', requireAuth, requireAdmin, async (req, res) => {
    try {
      await saveCloudConfigToDB(req.body);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // Barcode Relay (Phone -> PC POS) with length checks and bounded queue
  app.post('/api/remote-barcode', (req, res) => {
    const raw = req.body?.code;
    if (typeof raw === 'string') {
      const code = raw.trim().slice(0, 100);
      if (code) {
        if (remoteBarcodeQueue.length > 50) {
          remoteBarcodeQueue.shift();
        }
        remoteBarcodeQueue.push(code);
      }
    }
    res.json({ ok: true });
  });

  app.get('/api/remote-barcode', (req, res) => {
    const nextCode = remoteBarcodeQueue.shift() || null;
    res.json({ code: nextCode });
  });

  // PROTECTED: Full Store Data
  app.get('/api/data', requireAuth, async (req, res) => {
    try {
      const data = await getData();
      res.json(data);
    } catch (err: any) {
      console.error('Error fetching data from SQLite:', err);
      res.status(500).json({ error: err.message || 'Internal Server Error' });
    }
  });

  // PROTECTED: Incremental safe save with Role-Based Access Control
  app.post('/api/save', requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      if (user && user.role !== 'admin') {
        // Cashiers/users cannot modify employee credentials or roles
        if (req.body && req.body.employees && Array.isArray(req.body.employees)) {
          return res.status(403).json({
            ok: false,
            error: 'Forbidden: Only administrators can modify employee accounts or permissions'
          });
        }
        // Disallow normal users from tampering with store config
        if (req.body && req.body.config) {
          delete req.body.config;
        }
      }
      await saveData(req.body);
      res.json({ success: true });
    } catch (err: any) {
      console.error('Error saving data to SQLite:', err);
      res.status(500).json({ error: err.message || 'Internal Server Error' });
    }
  });

  // PROTECTED: Stock Movements
  app.get('/api/stock-movements', requireAuth, async (req, res) => {
    try {
      const { limit, productId } = req.query;
      const movements = await getStockMovements(Number(limit) || 100, productId as string);
      res.json({ ok: true, movements });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.post('/api/stock-movements', requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      const movement = {
        ...req.body,
        userId: user.userId,
        userName: user.name,
      };
      const result = await addStockMovement(movement);
      res.json({ ok: true, ...result });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // ADMIN-ONLY: Hard reset database back to factory zero
  app.post('/api/reset', requireAuth, requireAdmin, async (req, res) => {
    try {
      await resetDB(req.body);
      res.json({ success: true });
    } catch (err: any) {
      console.error('Error resetting SQLite database:', err);
      res.status(500).json({ error: err.message || 'Internal Server Error' });
    }
  });

  // Serve mobile app on /mobile and /mobile.html -> Redirect to modern responsive full app
  app.get(['/mobile', '/mobile.html'], (req, res) => {
    const queryString = req.url.includes('?') ? '?' + req.url.split('?')[1] : '';
    res.redirect(302, '/' + queryString);
  });

  // Download endpoints for Android APK & iOS IPA packages
  app.get(['/download/android', '/SmartPOS-Pro-Android.apk'], (req, res) => {
    const candidatePaths = [
      path.join(os.homedir(), 'Desktop', 'SmartPOS-Pro-Android.apk'),
      path.join(process.cwd(), 'Android-Release', 'SmartPOS-Pro-Android.apk'),
      path.join(process.cwd(), 'SmartPOS-Pro-Android.apk')
    ];
    const apkFile = candidatePaths.find((p) => fs.existsSync(p));
    if (apkFile) {
      res.download(apkFile, 'SmartPOS-Pro-Android.apk');
    } else {
      res.status(404).send('Android APK file not found');
    }
  });

  app.get(['/download/ios', '/SmartPOS-Pro-iOS.ipa'], (req, res) => {
    const candidatePaths = [
      path.join(os.homedir(), 'Desktop', 'SmartPOS-Pro-iOS.ipa'),
      path.join(process.cwd(), 'iOS-Release', 'SmartPOS-Pro-iOS.ipa'),
      path.join(process.cwd(), 'SmartPOS-Pro-iOS.ipa')
    ];
    const ipaFile = candidatePaths.find((p) => fs.existsSync(p));
    if (ipaFile) {
      res.download(ipaFile, 'SmartPOS-Pro-iOS.ipa');
    } else {
      res.status(404).send('iOS IPA file not found');
    }
  });

  app.get(['/download/mac', '/SmartPOS-Pro-macOS.dmg'], (req, res) => {
    const candidatePaths = [
      path.join(os.homedir(), 'Desktop', 'SmartPOS-Pro-macOS.dmg'),
      path.join(process.cwd(), 'Mac-Release', 'SmartPOS-Pro-macOS.dmg'),
      path.join(process.cwd(), 'SmartPOS-Pro-macOS.dmg')
    ];
    const dmgFile = candidatePaths.find((p) => fs.existsSync(p));
    if (dmgFile) {
      res.download(dmgFile, 'SmartPOS-Pro-macOS.dmg');
    } else {
      res.status(404).send('macOS DMG file not found');
    }
  });

  return app;
}

async function startServer() {
  const PORT = Number(process.env.PORT) || 3000;
  const app = createExpressApp();

  // Initialize SQLite database
  try {
    await initDB();
    console.log('SQLite database initialized successfully');
  } catch (err) {
    console.error('Failed to initialize SQLite database:', err);
  }

  // Vite middleware for development vs static serve for production
  const distPath = path.join(process.cwd(), 'dist');
  const isRunningBuiltServer = (process.argv[1] || '').includes('server.cjs');
  const isProd = process.env.NODE_ENV === 'production' || isRunningBuiltServer;

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    const ips = getLocalIPv4Addresses();
    console.log(`Server running on http://localhost:${PORT}`);
    if (ips.length > 0) {
      console.log(`Mobile App URL on Wi-Fi: http://${ips[0]}:${PORT}/mobile.html`);
    }
  });
}

// Only auto-start when executed directly
if (process.argv[1] && (process.argv[1].endsWith('server.ts') || process.argv[1].endsWith('server.cjs') || process.argv[1].endsWith('server.js'))) {
  startServer();
}
