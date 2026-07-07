import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Rellena VentaDurationSeconds (20s, delay fijo) y FHCheckStatus desde OperationAuditLog
 * para transacciones creadas antes de persistir esos campos.
 */
export class BackfillTransactionTimingColumns1760920600000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE \`Transactions\`
      SET \`VentaDurationSeconds\` = 20.00
      WHERE \`VentaDurationSeconds\` IS NULL
        AND (\`Code\` <> '' OR \`ResponseProvider\` IS NOT NULL)
    `);

    await queryRunner.query(`
      UPDATE \`TransactionsHistory\`
      SET \`VentaDurationSeconds\` = 20.00
      WHERE \`VentaDurationSeconds\` IS NULL
        AND (\`Code\` <> '' OR \`ResponseProvider\` IS NOT NULL)
    `);

    await queryRunner.query(`
      UPDATE \`Transactions\` t
      INNER JOIN (
        SELECT \`ReferenceId\`, MAX(\`FHRegister\`) AS \`fh\`
        FROM \`OperationAuditLog\`
        WHERE \`OperationType\` = 'check_status'
        GROUP BY \`ReferenceId\`
      ) a ON a.\`ReferenceId\` COLLATE utf8mb4_unicode_ci = t.\`ExternalId\` COLLATE utf8mb4_unicode_ci
      SET t.\`FHCheckStatus\` = a.\`fh\`
      WHERE t.\`FHCheckStatus\` IS NULL
    `);

    await queryRunner.query(`
      UPDATE \`TransactionsHistory\` t
      INNER JOIN (
        SELECT \`ReferenceId\`, MAX(\`FHRegister\`) AS \`fh\`
        FROM \`OperationAuditLog\`
        WHERE \`OperationType\` = 'check_status'
        GROUP BY \`ReferenceId\`
      ) a ON a.\`ReferenceId\` COLLATE utf8mb4_unicode_ci = t.\`ExternalId\` COLLATE utf8mb4_unicode_ci
      SET t.\`FHCheckStatus\` = a.\`fh\`
      WHERE t.\`FHCheckStatus\` IS NULL
    `);
  }

  public async down(): Promise<void> {
    // Sin reversa: no se puede distinguir filas rellenadas de las originales.
  }
}
