import { Router } from 'express';
import { getDbAsync, saveDb } from '../db/connection.js';
import { queryOne } from '../lib/db.js';
import { createToken, checkCredentials, isAuthEnabled, hashPassword } from '../lib/auth.js';
import { success, validationError } from '../lib/response.js';

const router = Router();

// In-memory OTP store for password reset (username -> { code, expires })
const otpStore = new Map();
const OTP_TTL_MS = 10 * 60 * 1000; // 10 min

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// GET /api/auth/status — whether auth is enabled (so frontend can show login or not)
router.get('/status', (_req, res) => {
  res.json({ ok: true, data: { authEnabled: isAuthEnabled() } });
});

// POST /api/auth/signup — { username, password } -> create user, return { token }
router.post('/signup', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !String(username).trim()) return validationError(res, 'username is required');
  if (!password || String(password).length < 4) return validationError(res, 'password must be at least 4 characters');
  try {
    const db = await getDbAsync();
    const existing = queryOne(db, 'SELECT id FROM users WHERE username = ?', [username.trim()]);
    if (existing) return validationError(res, 'Username already exists');
    const hash = hashPassword(password);
    db.run('INSERT INTO users (username, password_hash, updated_at) VALUES (?, ?, datetime("now"))', [username.trim(), hash]);
    saveDb();
    const token = createToken({ sub: username.trim() });
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
    if (user && user.password_hash === hashPassword(password)) {
      const token = createToken({ sub: username.trim() });
      return success(res, { token });
    }
  } catch (_) { /* users table may not exist */ }
  if (checkCredentials(username, password)) {
    const token = createToken({ sub: username });
    return success(res, { token });
  }
  return res.status(401).json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' } });
});

// POST /api/auth/forgot-password — { username } -> OTP sent (in dev returns otp in response)
router.post('/forgot-password', async (req, res) => {
  const { username } = req.body || {};
  if (!username || !String(username).trim()) return validationError(res, 'username is required');
  const code = generateOtp();
  otpStore.set(username.trim().toLowerCase(), { code, expires: Date.now() + OTP_TTL_MS });
  const devOtp = process.env.NODE_ENV !== 'production' ? code : undefined;
  return success(res, { message: 'If the account exists, an OTP has been sent.', otp: devOtp });
});

// POST /api/auth/reset-password — { username, otp, newPassword }
router.post('/reset-password', async (req, res) => {
  const { username, otp, newPassword } = req.body || {};
  if (!username || !otp || !newPassword) return validationError(res, 'username, otp and newPassword are required');
  if (String(newPassword).length < 4) return validationError(res, 'password must be at least 4 characters');
  const key = username.trim().toLowerCase();
  const stored = otpStore.get(key);
  if (!stored || stored.expires < Date.now()) return validationError(res, 'OTP expired or invalid');
  if (stored.code !== String(otp).trim()) return validationError(res, 'Invalid OTP');
  otpStore.delete(key);
  try {
    const db = await getDbAsync();
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
