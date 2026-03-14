import { Router } from 'express';
import { getDbAsync, saveDb } from '../db/connection.js';
import { queryOne, getLastId } from '../lib/db.js';
import { createToken, verifyToken, verifyTokenForRefresh, checkCredentials, isAuthEnabled, hashPassword, comparePassword, legacyHashPassword } from '../lib/auth.js';
import { sendOtpEmail } from '../lib/email.js';
import { success, validationError } from '../lib/response.js';

const router = Router();

const OTP_TTL_MS = 10 * 60 * 1000; // 10 min

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// GET /api/auth/status — whether auth is enabled (so frontend can show login or not)
router.get('/status', (_req, res) => {
  res.json({ ok: true, data: { authEnabled: isAuthEnabled() } });
});

// GET /api/auth/me — current user profile (requires Bearer token)
router.get('/me', async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Missing token' } });
  const payload = verifyToken(token);
  if (!payload?.sub) return res.status(401).json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Invalid token' } });
  try {
    const db = await getDbAsync();
    const user = queryOne(db, 'SELECT username, email FROM users WHERE username = ?', [payload.sub]);
    if (!user) return success(res, { username: payload.sub, email: null });
    return success(res, { username: user.username, email: user.email || null });
  } catch (_) {
    return success(res, { username: payload.sub, email: null });
  }
});

// POST /api/auth/refresh — { token } -> new token if within REFRESH_WINDOW_DAYS (public)
router.post('/refresh', async (req, res) => {
  const { token } = req.body || {};
  if (!token) return res.status(400).json({ ok: false, error: { code: 'VALIDATION', message: 'token is required' } });
  const payload = verifyTokenForRefresh(token);
  if (!payload || !payload.sub) return res.status(401).json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Token expired or invalid' } });
  let userId = payload.userId;
  if (userId == null) {
    const db = await getDbAsync();
    const u = queryOne(db, 'SELECT id FROM users WHERE username = ?', [payload.sub]);
    userId = u?.id ?? 1;
  }
  const newToken = createToken({ sub: payload.sub, userId });
  return success(res, { token: newToken });
});

// Simple email format validation (RFC 5322 simplified)
function isValidEmail(value) {
  if (!value || typeof value !== 'string') return false;
  const trimmed = value.trim();
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return trimmed.length > 0 && re.test(trimmed);
}

// POST /api/auth/signup — { username, password, email } -> create user, return { token }
router.post('/signup', async (req, res) => {
  const { username, password, email } = req.body || {};
  if (!username || !String(username).trim()) return validationError(res, 'username is required');
  if (!password || String(password).length < 4) return validationError(res, 'password must be at least 4 characters');
  const emailVal = email != null ? String(email).trim() : '';
  if (!emailVal) return validationError(res, 'email is required');
  if (!isValidEmail(emailVal)) return validationError(res, 'Please enter a valid email address');
  try {
    const db = await getDbAsync();
    const existing = queryOne(db, 'SELECT id FROM users WHERE username = ?', [username.trim()]);
    if (existing) return validationError(res, 'Username already exists');
    const hash = hashPassword(password);
    db.run(
      'INSERT INTO users (username, password_hash, email, updated_at) VALUES (?, ?, ?, datetime("now"))',
      [username.trim(), hash, emailVal]
    );
    const userId = getLastId(db);
    saveDb();
    const token = createToken({ sub: username.trim(), userId });
    return success(res, { token }, 201);
  } catch (err) {
    if (err.message?.includes('UNIQUE')) return validationError(res, 'Username already exists');
    return res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// POST /api/auth/login — { username, password } -> { token }
router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return validationError(res, 'username and password required');
  try {
    const db = await getDbAsync();
    const user = queryOne(db, 'SELECT id, password_hash FROM users WHERE username = ?', [username.trim()]);
    if (user) {
      if (comparePassword(password, user.password_hash)) {
        const token = createToken({ sub: username.trim(), userId: user.id });
        return success(res, { token });
      }
      // Migration: legacy SHA-256 hash — re-hash with bcrypt and update DB
      const legacyHash = legacyHashPassword(password);
      if (legacyHash === user.password_hash) {
        const newHash = hashPassword(password);
        db.run('UPDATE users SET password_hash = ?, updated_at = datetime("now") WHERE id = ?', [newHash, user.id]);
        saveDb();
        const token = createToken({ sub: username.trim(), userId: user.id });
        return success(res, { token });
      }
    }
  } catch (_) { /* users table may not exist */ }
  if (checkCredentials(username, password)) {
    const db = await getDbAsync();
    const adminUser = queryOne(db, 'SELECT id FROM users WHERE username = ?', [username.trim()]);
    const userId = adminUser ? adminUser.id : 1;
    const token = createToken({ sub: username, userId });
    return success(res, { token });
  }
  return res.status(401).json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' } });
});

// POST /api/auth/forgot-password — { username } -> OTP stored in DB, sent by email if user has email
router.post('/forgot-password', async (req, res) => {
  const { username } = req.body || {};
  if (!username || !String(username).trim()) return validationError(res, 'username is required');
  const un = username.trim();
  const key = un.toLowerCase();
  const code = generateOtp();
  const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString();
  try {
    const db = await getDbAsync();
    const user = queryOne(db, 'SELECT id, email FROM users WHERE username = ?', [un]);
    db.run('INSERT OR REPLACE INTO otp_store (username, otp, expires_at) VALUES (?, ?, ?)', [key, code, expiresAt]);
    saveDb();
    if (user?.email) {
      await sendOtpEmail(user.email, code);
    }
    const devOtp = process.env.NODE_ENV !== 'production' ? code : undefined;
    return success(res, { message: 'If the account exists, an OTP has been sent.', otp: devOtp });
  } catch (err) {
    return res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// POST /api/auth/reset-password — { username, otp, newPassword }
router.post('/reset-password', async (req, res) => {
  const { username, otp, newPassword } = req.body || {};
  if (!username || !otp || !newPassword) return validationError(res, 'username, otp and newPassword are required');
  if (String(newPassword).length < 4) return validationError(res, 'password must be at least 4 characters');
  const key = username.trim().toLowerCase();
  try {
    const db = await getDbAsync();
    const stored = queryOne(db, 'SELECT otp, expires_at FROM otp_store WHERE username = ?', [key]);
    if (!stored || new Date(stored.expires_at).getTime() < Date.now()) return validationError(res, 'OTP expired or invalid');
    if (stored.otp !== String(otp).trim()) return validationError(res, 'Invalid OTP');
    db.run('DELETE FROM otp_store WHERE username = ?', [key]);
    saveDb();
    const user = queryOne(db, 'SELECT id FROM users WHERE username = ?', [username.trim()]);
    if (!user) return validationError(res, 'User not found');
    const hash = hashPassword(newPassword);
    db.run('UPDATE users SET password_hash = ?, updated_at = datetime("now") WHERE id = ?', [hash, user.id]);
    saveDb();
    return success(res, { message: 'Password reset successfully' });
  } catch (err) {
    return res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

export default router;
