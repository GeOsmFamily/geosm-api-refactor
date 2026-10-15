import { DomainError } from './domain.error.js';

/** Action refusee temporairement ; `retryAfterSeconds` indique quand reessayer. */
export class TooManyRequestsError extends DomainError {
  constructor(message: string, code: string, retryAfterSeconds: number) {
    super(message, code, 429, { retryAfterSeconds });
  }
}
