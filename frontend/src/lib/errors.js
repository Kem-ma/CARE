// Turns any error into a sentence in the visitor's language.
//  - our own errors carry a translation `key` (and optional `params`)
//  - Cognito errors carry a `code`, which we map to a friendly sentence
//  - anything else falls back to its own message, or a generic line
export function errorText(error, t) {
  if (error?.key) return t(error.key, error.params);
  if (error?.code) {
    const key = `auth.err.${error.code}`;
    const text = t(key);
    if (text !== key) return text;
  }
  return error?.message || t('auth.generic');
}

// An Error that knows which translation to show.
export function keyedError(message, key, params) {
  return Object.assign(new Error(message), { key, params });
}
