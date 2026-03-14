# CoreInventory — Deploy Guide

This document describes how to run the app in production and deploy frontend and backend.

---

## Prerequisites

- Node.js 18+
- (Optional) PostgreSQL for production DB instead of SQLite

---

## 1. Backend (Node host)

### Local / VM production run

```bash
cd backend
npm ci
npm run init-db          # creates/updates SQLite DB
NODE_ENV=production node server.js
# Or: npm start  (ensure NODE_ENV=production in env)
```

### Environment variables (production)

| Variable | Description |
|----------|-------------|
| `PORT` | Server port (default 3000) |
| `NODE_ENV` | Set to `production` |
| `CORS_ORIGIN` | Frontend origin, e.g. `https://your-app.vercel.app` |
| `DATABASE_PATH` | Path to SQLite file (default: `./data/coreinventory.db`) |
| `AUTH_ENABLED` | Set to `true` to enable login (optional) |
| `JWT_SECRET` | Strong secret when auth enabled |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | Login credentials when auth enabled |

### Deploy to Railway / Render / Fly.io

1. Connect the repo and set root to `backend` (or deploy backend folder).
2. Set env vars as above.
3. Build: no build step (Node app).
4. Start: `npm start` or `node server.js`.
5. For SQLite: use a persistent volume for `data/` if the platform supports it; otherwise consider PostgreSQL.

---

## 2. Frontend (static host)

### Build

```bash
cd frontend
npm ci
npm run build
```

Output is in `frontend/dist/`.

### Environment

Set `VITE_API_URL` to the backend API base URL in production (e.g. `https://api.yourdomain.com/api`). If the frontend is served from the same host as the API, you can use a relative path `/api`.

### Deploy to Vercel / Netlify

1. Connect the repo and set root to `frontend`.
2. Build command: `npm run build`
3. Publish directory: `dist`
4. Add env var `VITE_API_URL` = your backend API URL (e.g. `https://your-backend.railway.app/api`)

---

## 3. Database

- **SQLite (default):** No extra setup. Ensure `backend/data/` is writable and persisted (volume or host disk).
- **PostgreSQL:** Not implemented in this codebase; would require swapping `db/connection.js` and schema for a PostgreSQL client and migrations.

---

## 4. Optional auth

1. Backend: set `AUTH_ENABLED=true`, `JWT_SECRET`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`.
2. Frontend: no config; it calls `GET /api/auth/status` and shows login when auth is enabled and token is missing.

---

## 5. Health checks

- **Backend:** `GET /api/health` (no DB), `GET /api/health/db` (DB connection).
- Use these for load balancer or platform health checks.

---

## Quick checklist

- [ ] Backend: `npm run init-db` then `npm start` with `NODE_ENV=production`
- [ ] Backend: set `CORS_ORIGIN` to frontend URL
- [ ] Frontend: build with `VITE_API_URL` set to backend API URL
- [ ] (Optional) Enable auth and set JWT + admin credentials
