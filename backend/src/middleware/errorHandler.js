/**
 * Central Express error handler. Any error passed to next(err) lands here.
 * Keeps error responses consistent and avoids leaking internals to the client.
 *
 * This is the merged version: it keeps the base's simple httpError() contract AND
 * adds Bear's MCP error classes so the copied MCP layer works unchanged.
 */
export class HttpError extends Error {
  constructor(status, publicMessage, options = {}) {
    super(options.message || publicMessage, options.cause ? { cause: options.cause } : undefined);
    this.name = options.name || 'HttpError';
    this.status = status;
    this.publicMessage = publicMessage;
    this.code = options.code;
    this.details = options.details;
  }
}

export class McpConnectionError extends HttpError {
  constructor(publicMessage, options = {}) {
    super(502, publicMessage, {
      ...options,
      name: 'McpConnectionError',
      code: options.code || 'MCP_CONNECTION_ERROR',
    });
  }
}

export class McpToolExecutionError extends HttpError {
  constructor(publicMessage, options = {}) {
    super(502, publicMessage, {
      ...options,
      name: 'McpToolExecutionError',
      code: options.code || 'MCP_TOOL_EXECUTION_ERROR',
    });
  }
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  // eslint-disable-next-line no-console
  console.error(err);

  const status = err.status || 500;
  const body = {
    error: err.publicMessage || 'Something went wrong generating your trip.',
  };
  if (err.code) body.code = err.code;
  // Validation errors attach a field-level details array; surface it to the client.
  if (Array.isArray(err.details) || (err.details && typeof err.details === 'object')) {
    body.details = err.details;
  }
  res.status(status).json(body);
}

/**
 * Helper to create an error with an HTTP status and a safe, user-facing message.
 * Backwards compatible with the base signature `httpError(status, message)`, and
 * accepts an optional `details` payload (Bear's extension).
 */
export function httpError(status, publicMessage, details) {
  return new HttpError(status, publicMessage, details ? { details } : {});
}
