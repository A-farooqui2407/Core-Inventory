import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { getDbAsync } from './db/connection.js';
import productsRouter from './routes/products.js';
import warehousesRouter from './routes/warehouses.js';
import locationsRouter from './routes/locations.js';
import movementsRouter from './routes/movements.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173' }));
app.use(express.json());

// Health check (no DB required)
app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'coreinventory-api',
    timestamp: new Date().toISOString(),
  });
});

// Health check including DB connection
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

// Phase 2: Core API routes
app.use('/api/products', productsRouter);
app.use('/api/warehouses', warehousesRouter);
app.use('/api/locations', locationsRouter);
app.use('/api/movements', movementsRouter);

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
