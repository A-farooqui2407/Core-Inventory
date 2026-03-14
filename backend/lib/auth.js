/**
 * Optional JWT auth. When AUTH_ENABLED=true, protect API routes.
 * Login: POST /api/auth/login { username, password } -> { token }.
 * Use header: Authorization: Bearer <token>
 */
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import bcrypt from 'bcrypt';

const AUTH_ENABLED = process.env.AUTH_ENABLED === 'true';
const SECRET = process.env.JWT_SECRET || 'coreinventory-dev-secret-change-in-production';
const ADMIN_USER = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASSWORD || 'admin';
/** In production, set ADMIN_PASSWORD_HASH to a bcrypt hash of the admin password (e.g. from bcrypt.hashSync(process.env.ADMIN_PASSWORD, 10)) */
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH;

const BCRYPT_ROUNDS = 10;

export function isAuthEnabled() {
  return AUTH_ENABLED;
}

export function createToken(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: process.env.JWT_EXPIRES || '7d' });
}

export function verifyToken(token, options = {}) {
  try {
    return jwt.verify(token, SECRET, options);
  } catch {
    return null;
  }
}

const REFRESH_WINDOW_DAYS = Number(process.env.REFRESH_WINDOW_DAYS) || 7;

/** Verify token for refresh: allow expired but require iat within REFRESH_WINDOW_DAYS. */
export function verifyTokenForRefresh(token) {
  const payload = verifyToken(token, { ignoreExpiration: true });
  if (!payload || !payload.iat) return null;
  const iatSeconds = typeof payload.iat === 'number' ? payload.iat : payload.iat.getTime() / 1000;
  const windowEnd = Date.now() / 1000 - REFRESH_WINDOW_DAYS * 24 * 60 * 60;
  if (iatSeconds < windowEnd) return null;
  return payload;
}

/** Hash password with bcrypt (used for signup and reset-password). */
export function hashPassword(password) {
  return bcrypt.hashSync(String(password), BCRYPT_ROUNDS);
}

/** Compare plaintext password with stored hash. Supports bcrypt and legacy SHA-256. */
export function comparePassword(plain, hash) {
  if (!hash) return false;
  if (bcrypt.compareSync(String(plain), hash)) return true;
  const legacyHash = legacyHashPassword(plain);
  return legacyHash === hash;
}

/** Legacy SHA-256 hash (for migration: re-hash to bcrypt on first login). Do not use for new passwords. */
export function legacyHashPassword(password) {
  return crypto.createHash('sha256').update(String(password)).digest('hex');
}

/**
 * Check admin credentials. If ADMIN_PASSWORD_HASH is set, compare with bcrypt; otherwise plaintext (backward compatible).
 * For production, set ADMIN_PASSWORD_HASH to a bcrypt hash and do not use ADMIN_PASSWORD.
 */
export function checkCredentials(username, password) {
  if (username !== ADMIN_USER) return false;
  if (ADMIN_PASSWORD_HASH) {
    return bcrypt.compareSync(String(password), ADMIN_PASSWORD_HASH);
  }
  return password === ADMIN_PASS;
}

export function authMiddleware(req, res, next) {
  if (!AUTH_ENABLED) return next();
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    return res.status(401).json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Missing or invalid token' } });
  }
  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Token expired or invalid' } });
  }
  req.user = payload;
  next();
}
