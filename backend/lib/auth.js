/**
 * Optional JWT auth. When AUTH_ENABLED=true, protect API routes.
 * Login: POST /api/auth/login { username, password } -> { token }.
 * Use header: Authorization: Bearer <token>
 */
import jwt from 'jsonwebtoken';

const AUTH_ENABLED = process.env.AUTH_ENABLED === 'true';
const SECRET = process.env.JWT_SECRET || 'coreinventory-dev-secret-change-in-production';
const ADMIN_USER = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASSWORD || 'admin';

export function isAuthEnabled() {
  return AUTH_ENABLED;
}

export function createToken(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: process.env.JWT_EXPIRES || '7d' });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, SECRET);
  } catch {
    return null;
  }
}

export function checkCredentials(username, password) {
  return username === ADMIN_USER && password === ADMIN_PASS;
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
