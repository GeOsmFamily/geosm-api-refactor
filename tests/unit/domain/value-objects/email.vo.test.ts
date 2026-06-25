import { describe, it, expect } from 'vitest';
import { Email } from '../../../../src/domain/value-objects/email.vo.js';
import { ValidationError } from '../../../../src/domain/errors/validation.error.js';

describe('Email Value Object', () => {
  it('should create a valid email', () => {
    const email = Email.create('Test@Example.COM');
    expect(email.value).toBe('test@example.com');
  });

  it('should trim whitespace', () => {
    const email = Email.create('  user@example.com  ');
    expect(email.value).toBe('user@example.com');
  });

  it('should throw on empty string', () => {
    expect(() => Email.create('')).toThrow(ValidationError);
  });

  it('should throw on invalid format', () => {
    expect(() => Email.create('notanemail')).toThrow(ValidationError);
    expect(() => Email.create('missing@tld')).toThrow(ValidationError);
    expect(() => Email.create('@example.com')).toThrow(ValidationError);
  });

  it('should compare emails correctly', () => {
    const a = Email.create('user@example.com');
    const b = Email.create('USER@Example.com');
    expect(a.equals(b)).toBe(true);
  });

  it('should return string via toString', () => {
    const email = Email.create('user@example.com');
    expect(email.toString()).toBe('user@example.com');
  });
});
