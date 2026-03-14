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

db.run(`INSERT OR IGNORE INTO _schema_version (version) VALUES (2)`);
saveDb();

console.log('Database initialized.');
process.exit(0);
