import { DataSource, EntityManager, QueryRunner } from 'typeorm';

/** Rollback que no lanza si la transacción ya cerró o falló. */
export async function safeRollback(queryRunner: QueryRunner): Promise<void> {
  try {
    if (queryRunner.isTransactionActive) {
      await queryRunner.rollbackTransaction();
    }
  } catch {
    // Evita TransactionNotStartedError enmascarando el error real.
  }
}

/** Devuelve la conexión al pool; imprescindible tras createQueryRunner(). */
export async function safeRelease(queryRunner: QueryRunner): Promise<void> {
  try {
    if (!queryRunner.isReleased) {
      await queryRunner.release();
    }
  } catch {
    // best-effort
  }
}

/**
 * Transacción acotada: commit/rollback/release garantizados.
 * No usar para trabajo lento externo (HTTP) dentro del callback.
 */
export async function runInTransaction<T>(
  dataSource: DataSource,
  fn: (manager: EntityManager) => Promise<T>,
): Promise<T> {
  const queryRunner = dataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();
  try {
    const result = await fn(queryRunner.manager);
    await queryRunner.commitTransaction();
    return result;
  } catch (e) {
    await safeRollback(queryRunner);
    throw e;
  } finally {
    await safeRelease(queryRunner);
  }
}
