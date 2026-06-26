import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../../src/config/env.config.js', () => ({
  config: {
    DATABASE_URL: 'postgresql://myuser:pass@localhost:5432/mydb?sslmode=require',
  },
}));

import { ConfigDbUseCase } from '../../../../../src/application/use-cases/admin/config-db.use-case.js';

describe('ConfigDbUseCase', () => {
  let useCase: ConfigDbUseCase;

  beforeEach(() => {
    useCase = new ConfigDbUseCase();
  });

  it('should return parsed database config', async () => {
    const result = await useCase.execute();
    expect(result.host).toBe('localhost');
    expect(result.port).toBe(5432);
    expect(result.database).toBe('mydb');
    expect(result.user).toBe('myuser');
    expect(result.ssl).toBe(true);
  });
});
