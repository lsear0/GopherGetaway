import { httpError } from './errorHandler.js';

/**
 * Request-body validation middleware factory.
 *
 * Runs the given Zod schema against req.body and replaces it with the parsed, typed,
 * and sanitized result. This is the server-side trust boundary: downstream code only
 * ever sees validated data, so client-supplied budget/duration/etc. can never slip
 * through unchecked.
 *
 * @param {import('zod').ZodType} schema
 */
export function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      // Flatten Zod issues into a compact, user-facing list without leaking internals.
      const details = result.error.issues.map((issue) => ({
        field: issue.path.join('.') || '(root)',
        message: issue.message,
      }));
      const err = httpError(400, 'Invalid request.');
      err.details = details;
      return next(err);
    }
    req.validatedBody = result.data;
    next();
  };
}
