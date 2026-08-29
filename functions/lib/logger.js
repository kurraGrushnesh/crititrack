"use strict";

/**
 * Logging shim.
 *
 * The library modules were written against `firebase-functions/logger`,
 * whose four methods (`info`, `warn`, `error`, `debug`) take a message
 * and an optional structured-context object. On Cloud Functions that
 * context is indexed by Cloud Logging; anywhere else it is just a second
 * argument to `console`.
 *
 * This keeps the same call sites working under a plain Node process on a
 * generic host, where the backend now also runs. Structured context is
 * serialised inline so nothing is silently dropped.
 *
 * @param {"log"|"warn"|"error"|"debug"} method
 * @return {(msg: unknown, ctx?: unknown) => void}
 */
function to(method) {
  return (msg, ctx) => {
    if (ctx === undefined) {
      console[method](msg);
      return;
    }
    try {
      console[method](msg, JSON.stringify(ctx));
    } catch {
      console[method](msg, ctx);
    }
  };
}

module.exports = {
  info: to("log"),
  warn: to("warn"),
  error: to("error"),
  debug: to("debug"),
};
