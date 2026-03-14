import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { getDbAsync, saveDb } from './db/connection.js';
import { authMiddleware } from './lib/auth.js';
import authRouter from './routes/auth.js';
import productsRouter from './routes/products.js';
import categoriesRouter from './routes/categories.js';
import suppliersRouter from './routes/suppliers.js';
import warehousesRouter from './routes/warehouses.js';
import locationsRouter from './routes/locations.js';
import movementsRouter from './routes/movements.js';
import receiptsRouter from './routes/receipts.js';
import deliveriesRouter from './routes/deliveries.js';
import stockBalancesRouter from './routes/stockBalances.js';
import dashboardRouter from './routes/dashboard.js';
import scheduledRouter from './routes/scheduled.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173' }));
app.use(express.json());

// Health (always public)
app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'coreinventory-api',
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/health/db', async (_req, res) => {
  try {
    const db = await getDbAsync();
    db.run('SELECT 1');
    res.json({
      ok: true,
      db: 'connected',
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(503).json({
      ok: false,
      db: 'disconnected',
      error: err.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Auth (optional): login and status — no token required
app.use('/api/auth', authRouter);

// Optional auth: protect all other /api routes when AUTH_ENABLED=true
app.use('/api', (req, res, next) => {
  if (req.path.startsWith('/auth')) return next();
  authMiddleware(req, res, next);
});

app.use('/api/products', productsRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/suppliers', suppliersRouter);
app.use('/api/warehouses', warehousesRouter);
app.use('/api/locations', locationsRouter);
app.use('/api/movements', movementsRouter);
app.use('/api/receipts', receiptsRouter);
app.use('/api/deliveries', deliveriesRouter);
app.use('/api/stock-balances', stockBalancesRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/scheduled', scheduledRouter);

export { app };

async function ensureAllTables() {
  try {
    const db = await getDbAsync();
    db.run(`CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      code TEXT UNIQUE NOT NULL,
      description TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS suppliers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      code TEXT UNIQUE NOT NULL,
      contact TEXT,
      address TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS stock_balances (
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      location_id INTEGER NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
      quantity REAL NOT NULL DEFAULT 0,
      updated_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (product_id, location_id)
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS receipt_documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      supplier_id INTEGER REFERENCES suppliers(id),
      status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','waiting','ready','done','canceled')),
      reference TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS receipt_lines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      receipt_id INTEGER NOT NULL REFERENCES receipt_documents(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id),
      quantity REAL NOT NULL,
      to_location_id INTEGER REFERENCES locations(id),
      created_at TEXT DEFAULT (datetime('now'))
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS delivery_documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','waiting','ready','done','canceled')),
      reference TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS delivery_lines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      delivery_id INTEGER NOT NULL REFERENCES delivery_documents(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id),
      quantity REAL NOT NULL,
      from_location_id INTEGER REFERENCES locations(id),
      created_at TEXT DEFAULT (datetime('now'))
    )`);
    try { db.run('ALTER TABLE products ADD COLUMN category_id INTEGER REFERENCES categories(id)'); } catch (_) {}
    try { db.run('ALTER TABLE products ADD COLUMN reorder_min_quantity REAL'); } catch (_) {}
    try { db.run('ALTER TABLE products ADD COLUMN reorder_quantity REAL'); } catch (_) {}
    saveDb();
    console.log('Database tables ensured.');
  } catch (e) {
    console.error('Failed to ensure database tables:', e.message);
  }
}

if (process.env.NODE_ENV !== 'test') {
  ensureAllTables().then(() => {
    app.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
    });
  });
}
