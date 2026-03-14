import { Router } from 'express';
import { createToken, checkCredentials, isAuthEnabled } from '../lib/auth.js';
import { success, validationError } from '../lib/response.js';

const router = Router();

// GET /api/auth/status — whether auth is enabled (so frontend can show login or not)
router.get('/status', (_req, res) => {
  res.json({ ok: true, data: { authEnabled: isAuthEnabled() } });
});

// POST /api/auth/login — { username, password } -> { token }
router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return validationError(res, 'username and password required');
  if (!checkCredentials(username, password)) {
    return res.status(401).json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' } });
  }
  const token = createToken({ sub: username });
  return success(res, { token });
});

export default router;
