/**
 * Central Express error handler. Any error passed to next(err) lands here.
 * Keeps error responses consistent and avoids leaking internals to the client.
 */
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  // eslint-disable-next-line no-console
  console.error(err);

  const status = err.status || 500;
  res.status(status).json({
    error: err.publicMessage || 'Something went wrong generating your trip.',
  });
}

/** Helper to create an error with an HTTP status and a safe, user-facing message. */
export function httpError(status, publicMessage) {
  const err = new Error(publicMessage);
  err.status = status;
  err.publicMessage = publicMessage;
  return err;
}
