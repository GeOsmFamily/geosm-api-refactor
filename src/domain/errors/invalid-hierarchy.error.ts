import { DomainError } from './domain.error.js';

/** Rattachement territorial incoherent (ex. un pays rattache a un autre pays). HTTP 422. */
export class InvalidHierarchyError extends DomainError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'INVALID_HIERARCHY', 422, details);
  }
}
