// Turns expected Postgres constraint errors into HTTP errors for the central error handler.

export const PG = {
  UNIQUE_VIOLATION: '23505',
  FOREIGN_KEY_VIOLATION: '23503',
  RESTRICT_VIOLATION: '23001', // ON DELETE RESTRICT on Postgres 18+ (older versions use 23503)
};

// `responses` maps a Postgres error code to [HTTP status, message].
// Any other error is returned unchanged and becomes a 500.
export function translateDbError(err, responses) {
  const response = responses[err.code];
  if (!response) return err;

  const [status, message] = response;
  return Object.assign(new Error(message, { cause: err }), { status });
}
