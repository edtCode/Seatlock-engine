const { AppError } = require('../utils/errors');

/**
 * validate({ body, params, query, headers }) - each value is a Zod schema.
 * Parsed/coerced values are written back onto req.<key> so controllers
 * receive clean, typed data.
 */
function validate(schemas) {
  return function validationMiddleware(req, res, next) {
    try {
      for (const key of ['params', 'query', 'headers', 'body']) {
        const schema = schemas[key];
        if (!schema) continue;
        const parsed = schema.parse(req[key]);
        if (key === 'query' || key === 'params') {
          // req.query/req.params are getter-only in newer Express; mutate in place.
          Object.assign(req[key], parsed);
        } else {
          req[key] = parsed;
        }
      }
      next();
    } catch (err) {
      if (err.name === 'ZodError') {
        const details = err.errors.map((e) => ({
          path: e.path.join('.'),
          message: e.message,
        }));
        return next(new AppError('VALIDATION_ERROR', 'Request validation failed', details));
      }
      next(err);
    }
  };
}

module.exports = validate;
