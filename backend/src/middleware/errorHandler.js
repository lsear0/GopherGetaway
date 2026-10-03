/**
 * Central Express error handler. Any error passed to next(err) lands here.
 * Keeps error responses consistent and avoids leaking internals to the client.
 */
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  // eslint-disable-next-line no-console
  console.error(err);

  const status = err.status || 500;
  const body = {
    error: err.publicMessage || 'Something went wrong generating your trip.',
  };
  // Validation errors attach a field-level details array; surface it to the client.
  if (Array.isArray(err.details)) {
    body.details = err.details;
  }
  res.status(status).json(body);
}

/** Helper to create an error with an HTTP status and a safe, user-facing message. */
export function httpError(status, publicMessage) {
  const err = new Error(publicMessage);
  err.status = status;
  err.publicMessage = publicMessage;
  return err;
}
