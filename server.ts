/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { initDB, getData, saveData } from './server_db.js';

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

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Enable CORS so standalone mobile app files can sync with server
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
      return;
    }
    next();
  });

  // Middlewares
  app.use(express.json({ limit: '50mb' }));

  // Initialize SQLite database
  try {
    await initDB();
    console.log('SQLite database initialized successfully');
  } catch (err) {
    console.error('Failed to initialize SQLite database:', err);
  }

  // API: Local Network IPs for Smartphone QR Pairing
  app.get('/api/network-info', (req, res) => {
    res.json({
      ips: getLocalIPv4Addresses(),
      port: PORT,
    });
  });

  // API: Wireless Barcode Scanner Relay (Phone -> PC POS)
  app.post('/api/remote-barcode', (req, res) => {
    const code = req.body?.code ? String(req.body.code).trim() : '';
    if (code) {
      remoteBarcodeQueue.push(code);
    }
    res.json({ ok: true });
  });

  app.get('/api/remote-barcode', (req, res) => {
    const nextCode = remoteBarcodeQueue.shift() || null;
    res.json({ code: nextCode });
  });

  // API: Get unified ledger and records
  app.get('/api/data', async (req, res) => {
    try {
      const data = await getData();
      res.json(data);
    } catch (err: any) {
      console.error('Error fetching data from SQLite:', err);
      res.status(500).json({ error: err.message || 'Internal Server Error' });
    }
  });

  // API: Save and rewrite records safely
  app.post('/api/save', async (req, res) => {
    try {
      await saveData(req.body);
      res.json({ success: true });
    } catch (err: any) {
      console.error('Error saving data to SQLite:', err);
      res.status(500).json({ error: err.message || 'Internal Server Error' });
    }
  });

  // API: Hard reset database back to factory zero
  app.post('/api/reset', async (req, res) => {
    try {
      await saveData(req.body);
      res.json({ success: true });
    } catch (err: any) {
      console.error('Error resetting SQLite database:', err);
      res.status(500).json({ error: err.message || 'Internal Server Error' });
    }
  });

  // Serve mobile app on /mobile and /mobile.html
  app.get(['/mobile', '/mobile.html'], (req, res) => {
    const prodMobile = path.join(process.cwd(), 'dist', 'mobile.html');
    const devMobile = path.join(process.cwd(), 'public', 'mobile.html');
    if (fs.existsSync(prodMobile)) {
      res.sendFile(prodMobile);
    } else if (fs.existsSync(devMobile)) {
      res.sendFile(devMobile);
    } else {
      res.status(404).send('Mobile app not found');
    }
  });

  // Vite middleware for development vs static serve for production
  const distPath = path.join(process.cwd(), 'dist');
  const isProd = process.env.NODE_ENV === 'production' || fs.existsSync(path.join(distPath, 'index.html'));

  if (!isProd && process.env.NODE_ENV !== 'production') {
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

startServer();
