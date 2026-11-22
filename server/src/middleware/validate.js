// Validation middleware: runs before the route handler and answers 400 on bad input.

const MAX_PG_INTEGER = 2147483647;

// validateBody(schema) returns a middleware that checks req.body against a zod schema.
// On success req.body is replaced by the cleaned data (trimmed, unknown fields removed).
export function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        field: issue.path.join('.') || 'body',
        message: issue.message,
      }));
      return res.status(400).json({ error: 'Validation failed', details });
    }
    req.body = result.data;
    next();
  };
}

// Rejects ids like 'abc', '0' or '1.5' before they reach Postgres.
export function validateId(req, res, next) {
  const { id } = req.params;
  if (!/^[1-9]\d*$/.test(id) || Number(id) > MAX_PG_INTEGER) {
    return res.status(400).json({ error: 'Id must be a positive integer' });
  }
  next();
}
