import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDbAsync, saveDb } from './connection.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = await getDbAsync();

db.run(`
  CREATE TABLE IF NOT EXISTS _schema_version (
    version INTEGER PRIMARY KEY,
    applied_at TEXT DEFAULT (datetime('now'))
  )
`);
db.run(`INSERT OR IGNORE INTO _schema_version (version) VALUES (1)`);

// Phase 2: Core data tables
db.run(`
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    sku TEXT UNIQUE NOT NULL,
    description TEXT,
    quantity REAL NOT NULL DEFAULT 0,
    unit TEXT DEFAULT 'pcs',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )
`);
db.run(`
  CREATE TABLE IF NOT EXISTS warehouses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL,
    address TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )
`);
db.run(`
  CREATE TABLE IF NOT EXISTS locations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    parent_id INTEGER REFERENCES locations(id),
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(warehouse_id, code)
  )
`);
db.run(`
  CREATE TABLE IF NOT EXISTS stock_movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL CHECK (type IN ('Receipt','Delivery','Transfer','Adjustment')),
    product_id INTEGER NOT NULL REFERENCES products(id),
    quantity REAL NOT NULL,
    from_location_id INTEGER REFERENCES locations(id),
    to_location_id INTEGER REFERENCES locations(id),
    reference TEXT,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )
`);

// Phase 5: Scheduled operations
db.run(`
  CREATE TABLE IF NOT EXISTS scheduled_operations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL CHECK (type IN ('Receipt','Delivery','Transfer','Pick','Stocktake')),
    product_id INTEGER REFERENCES products(id),
    quantity REAL,
    from_location_id INTEGER REFERENCES locations(id),
    to_location_id INTEGER REFERENCES locations(id),
    due_date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','done','cancelled')),
    reference TEXT,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )
`);

db.run(`INSERT OR IGNORE INTO _schema_version (version) VALUES (3)`);

// Migration 4: PDF workflow — categories, suppliers, documents, stock per location
const v4 = db.prepare('SELECT 1 FROM _schema_version WHERE version = 4').get();
if (!v4) {
  try {
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
    try { db.run('ALTER TABLE products ADD COLUMN category_id INTEGER REFERENCES categories(id)'); } catch (_) {}
    try { db.run('ALTER TABLE products ADD COLUMN reorder_min_quantity REAL'); } catch (_) {}
    try { db.run('ALTER TABLE products ADD COLUMN reorder_quantity REAL'); } catch (_) {}
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
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )`);
    db.run(`INSERT INTO _schema_version (version) VALUES (4)`);
    saveDb();
    if (process.env.NODE_ENV !== 'production') console.log('Migration 4 (PDF workflow) applied.');
  } catch (e) {
    console.error('Migration 4 error:', e.message);
  }
}

// Ensure users table exists (in case migration 4 was applied before users was added)
db.run(`CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
)`);

// Migration 5: multi-user data isolation — add user_id to all data tables
const v5 = db.prepare('SELECT 1 FROM _schema_version WHERE version = 5').get();
if (!v5) {
  try {
    const tables = [
      'products',
      'warehouses',
      'locations',
      'stock_movements',
      'scheduled_operations',
      'categories',
      'suppliers',
      'receipt_documents',
      'delivery_documents',
      'stock_balances',
    ];
    for (const table of tables) {
      try {
        db.run(`ALTER TABLE ${table} ADD COLUMN user_id INTEGER REFERENCES users(id)`);
      } catch (e) {
        if (!e.message || !e.message.includes('duplicate column')) throw e;
      }
    }
    // Backfill existing rows so nothing breaks (first user owns legacy data)
    for (const table of tables) {
      try {
        db.run(`UPDATE ${table} SET user_id = 1 WHERE user_id IS NULL`);
      } catch (_) { /* table might not have been created yet */ }
    }
    db.run(`INSERT INTO _schema_version (version) VALUES (5)`);
    saveDb();
    if (process.env.NODE_ENV !== 'production') console.log('Migration 5 (multi-user user_id) applied.');
  } catch (e) {
    console.error('Migration 5 error:', e.message);
  }
}

saveDb();

if (process.env.NODE_ENV !== 'production') console.log('Database initialized.');
process.exit(0);
