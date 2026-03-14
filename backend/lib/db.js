/**
 * sql.js query helpers: exec and return rows as objects
 */
export function queryAll(db, sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

export function queryOne(db, sql, params = []) {
  const rows = queryAll(db, sql, params);
  return rows[0] ?? null;
}

export function getLastId(db) {
  const row = queryOne(db, 'SELECT last_insert_rowid() as id');
  return row?.id ?? null;
}
