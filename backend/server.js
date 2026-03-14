import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { getDbAsync } from './db/connection.js';
import { authMiddleware } from './lib/auth.js';
import authRouter from './routes/auth.js';
import productsRouter from './routes/products.js';
import warehousesRouter from './routes/warehouses.js';
import locationsRouter from './routes/locations.js';
import movementsRouter from './routes/movements.js';
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
app.use('/api/warehouses', warehousesRouter);
app.use('/api/locations', locationsRouter);
app.use('/api/movements', movementsRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/scheduled', scheduledRouter);

export { app };

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}
