import { QueryRunner } from 'typeorm';

export async function columnExists(
  queryRunner: QueryRunner,
  table: string,
  column: string,
): Promise<boolean> {
  const rows: Array<Record<string, unknown>> = await queryRunner.query(
    `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column],
  );
  const row = rows[0];
  if (!row) return false;
  return Number(row.cnt ?? Object.values(row)[0]) > 0;
}
