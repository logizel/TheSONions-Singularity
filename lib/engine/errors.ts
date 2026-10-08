/**
 * Typed engine input errors (D-20).
 *
 * Bad input (negative stock, wrong history length, gaps in history) throws —
 * never warning accumulation. The engine holds no secrets, performs no I/O,
 * and makes no network calls (threat T-02-01: guard-clauses are the whole
 * mitigation). Callers (Phase 3 API, tests) decide how to surface the throw.
 */
export class EngineInputError extends Error {
  readonly code = 'ENGINE_INPUT_ERROR';

  constructor(message: string) {
    super(message);
    this.name = 'EngineInputError';
  }
}
