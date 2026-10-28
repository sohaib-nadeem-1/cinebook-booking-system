/**
 * Tiny transport shim. Every service call goes through `simulate()` so the UI already
 * handles async + loading + errors. When the Express API exists, replace the body of the
 * service functions with fetch('/api/...') — the signatures stay the same.
 */
let latency = import.meta.env.MODE === 'test' ? 0 : 450;
export const setLatency = (ms) => { latency = ms; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export async function simulate(fn, ms) {
  await wait(ms ?? latency);
  return fn();
}

export class ApiError extends Error {
  constructor(message, code = 'ERROR') { super(message); this.code = code; }
}
