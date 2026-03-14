import initSqlJs from 'sql.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '..', 'data', 'coreinventory.db');

let db = null;
let dbReady = null;

async function loadDb() {
  const SQL = await initSqlJs();
  const dataDir = path.dirname(dbPath);
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  if (fs.existsSync(dbPath)) {
    const buf = fs.readFileSync(dbPath);
    db = new SQL.Database(buf);
  } else {
    db = new SQL.Database();
  }
  db.run('PRAGMA journal_mode = WAL');
  return db;
}

export function getDb() {
  if (db) return db;
  if (!dbReady) dbReady = loadDb();
  throw new Error('Database not ready yet; use getDbAsync() for async startup');
}

export async function getDbAsync() {
  if (db) return db;
  if (!dbReady) dbReady = loadDb();
  return dbReady;
}

export function saveDb() {
  if (db && dbPath) {
    const data = db.export();
    const buf = Buffer.from(data);
    fs.writeFileSync(dbPath, buf);
  }
}

export function closeDb() {
  if (db) {
    saveDb();
    db.close();
    db = null;
    dbReady = null;
  }
}
