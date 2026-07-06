import { PrismaClient } from '@prisma/client';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('ManageSequenceUseCase');

export class ManageSequenceUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async createSequence(name: string, start: number = 1, increment: number = 1) {
    const safeName = name.replace(/[^a-zA-Z0-9_]/g, '');
    await this.prisma.$executeRawUnsafe(
      `CREATE SEQUENCE IF NOT EXISTS "${safeName}" START ${Number(start)} INCREMENT ${Number(increment)}`
    );
    logger.info('Sequence created', { name: safeName, start, increment });
    return { name: safeName, start, increment };
  }

  async dropSequence(name: string) {
    const safeName = name.replace(/[^a-zA-Z0-9_]/g, '');
    await this.prisma.$executeRawUnsafe(`DROP SEQUENCE IF EXISTS "${safeName}"`);
    logger.info('Sequence dropped', { name: safeName });
    return { name: safeName, dropped: true };
  }

  async listSequences() {
    const rows = await this.prisma.$queryRawUnsafe<{ sequence_name: string; start_value: string; increment: string }[]>(
      `SELECT sequence_name, start_value::text, increment::text FROM information_schema.sequences WHERE sequence_schema = 'public'`
    );
    return rows;
  }
}
