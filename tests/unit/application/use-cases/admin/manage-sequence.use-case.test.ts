import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ManageSequenceUseCase } from '../../../../../src/application/use-cases/admin/manage-sequence.use-case.js';

describe('ManageSequenceUseCase', () => {
  let useCase: ManageSequenceUseCase;
  let prisma: { $executeRawUnsafe: ReturnType<typeof vi.fn>; $queryRawUnsafe: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    prisma = {
      $executeRawUnsafe: vi.fn().mockResolvedValue(undefined),
      $queryRawUnsafe: vi.fn(),
    };
    useCase = new ManageSequenceUseCase(prisma as any);
  });

  it('should create a sequence with defaults', async () => {
    const result = await useCase.createSequence('my_seq');
    expect(result).toEqual({ name: 'my_seq', start: 1, increment: 1 });
    expect(prisma.$executeRawUnsafe).toHaveBeenCalledWith(
      'CREATE SEQUENCE IF NOT EXISTS "my_seq" START 1 INCREMENT 1',
    );
  });

  it('should sanitize sequence name', async () => {
    const result = await useCase.createSequence('my;DROP TABLE--seq');
    expect(result.name).toBe('myDROPTABLEseq');
  });

  it('should drop a sequence', async () => {
    const result = await useCase.dropSequence('my_seq');
    expect(result).toEqual({ name: 'my_seq', dropped: true });
    expect(prisma.$executeRawUnsafe).toHaveBeenCalledWith('DROP SEQUENCE IF EXISTS "my_seq"');
  });

  it('should list sequences', async () => {
    const rows = [{ sequence_name: 'seq1', start_value: '1', increment: '1' }];
    prisma.$queryRawUnsafe.mockResolvedValue(rows);
    const result = await useCase.listSequences();
    expect(result).toEqual(rows);
  });
});
