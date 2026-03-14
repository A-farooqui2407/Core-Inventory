import { Router } from 'express';
import { getDbAsync, saveDb } from '../db/connection.js';
import { queryAll, queryOne, getLastId } from '../lib/db.js';
import { success, notFound, validationError } from '../lib/response.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const userId = req.user?.userId ?? 1;
    const db = await getDbAsync();
    const items = queryAll(db, 'SELECT * FROM categories WHERE user_id = ? ORDER BY name', [userId]);
    return success(res, { items });
  } catch (err) {
    return res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const userId = req.user?.userId ?? 1;
    const db = await getDbAsync();
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return validationError(res, 'Invalid category id');
    const row = queryOne(db, 'SELECT * FROM categories WHERE id = ? AND user_id = ?', [id, userId]);
    if (!row) return notFound(res, 'Category');
    return success(res, row);
  } catch (err) {
    return res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

router.post('/', async (req, res) => {
  try {
    const userId = req.user?.userId ?? 1;
    const { name, code, description } = req.body || {};
    if (!name || !String(name).trim()) return validationError(res, 'name is required');
    if (!code || !String(code).trim()) return validationError(res, 'code is required');
    const db = await getDbAsync();
    db.run(
      'INSERT INTO categories (name, code, description, user_id, updated_at) VALUES (?, ?, ?, ?, datetime("now"))',
      [name.trim(), code.trim(), description?.trim() ?? null, userId]
    );
    const id = getLastId(db);
    saveDb();
    const row = queryOne(db, 'SELECT * FROM categories WHERE id = ?', [id]);
    return success(res, row, 201);
  } catch (err) {
    if (err.message?.includes('UNIQUE')) return validationError(res, 'Category code already exists');
    return res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const userId = req.user?.userId ?? 1;
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return validationError(res, 'Invalid category id');
    const { name, code, description } = req.body || {};
    const db = await getDbAsync();
    const existing = queryOne(db, 'SELECT * FROM categories WHERE id = ? AND user_id = ?', [id, userId]);
    if (!existing) return notFound(res, 'Category');
    const n = (name != null && String(name).trim()) ? name.trim() : existing.name;
    const c = (code != null && String(code).trim()) ? code.trim() : existing.code;
    const d = description !== undefined ? (description?.trim() || null) : existing.description;
    db.run('UPDATE categories SET name=?, code=?, description=?, updated_at=datetime("now") WHERE id=? AND user_id=?', [n, c, d, id, userId]);
    saveDb();
    const row = queryOne(db, 'SELECT * FROM categories WHERE id = ?', [id]);
    return success(res, row);
  } catch (err) {
    if (err.message?.includes('UNIQUE')) return validationError(res, 'Category code already exists');
    return res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const userId = req.user?.userId ?? 1;
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return validationError(res, 'Invalid category id');
    const db = await getDbAsync();
    const existing = queryOne(db, 'SELECT id FROM categories WHERE id = ? AND user_id = ?', [id, userId]);
    if (!existing) return notFound(res, 'Category');
    db.run('UPDATE products SET category_id = NULL WHERE category_id = ? AND user_id = ?', [id, userId]);
    db.run('DELETE FROM categories WHERE id = ? AND user_id = ?', [id, userId]);
    saveDb();
    return success(res, { deleted: id });
  } catch (err) {
    return res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

export default router;
