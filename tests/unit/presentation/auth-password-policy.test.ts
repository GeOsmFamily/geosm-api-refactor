import { describe, it, expect } from 'vitest';
import { passwordSchema } from '../../../src/presentation/schemas/auth.schema.js';

describe('passwordSchema (RG-A-02)', () => {
  it.each(['abcdefg1', 'Motdepasse2026', 'éclair123x'])('accepte %s', (pwd) => {
    expect(passwordSchema.safeParse(pwd).success).toBe(true);
  });

  it.each(['court1a', 'sansaucunchiffre', '1234567890', ''])('refuse %s', (pwd) => {
    expect(passwordSchema.safeParse(pwd).success).toBe(false);
  });
});
