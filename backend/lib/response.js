/**
 * Consistent API response helpers
 */
export function success(res, data, status = 200) {
  return res.status(status).json({ ok: true, data });
}

export function error(res, message, status = 400, code = 'BAD_REQUEST') {
  return res.status(status).json({
    ok: false,
    error: { code, message },
    timestamp: new Date().toISOString(),
  });
}

export function notFound(res, resource = 'Resource') {
  return error(res, `${resource} not found`, 404, 'NOT_FOUND');
}

export function validationError(res, message) {
  return error(res, message, 400, 'VALIDATION_ERROR');
}
