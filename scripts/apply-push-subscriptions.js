require('dotenv').config();
const mysql = require('mysql2/promise');

const PREVIOUS_MIGRATIONS = [
  { timestamp: 1730169600000, name: 'CreateInitialSchema1730169600000' },
  { timestamp: 1760918400000, name: 'CreateCustomerBalance1760918400000' },
  { timestamp: 1760918460000, name: 'AlterCustomerBalanceIdAutoIncrement1760918460000' },
  { timestamp: 1760919000000, name: 'AddClientsLineCredit1760919000000' },
  { timestamp: 1760920000000, name: 'CreateBalanceHistory1760920000000' },
  { timestamp: 1760920100000, name: 'AlterCustomerBalanceAddBalance1760920100000' },
  { timestamp: 1760920200000, name: 'RenameClientsLineCreditToCreditLine1760920200000' },
  { timestamp: 1760920400000, name: 'AlterBalanceHistoryAddIsPaid1760920400000' },
  { timestamp: 1760920500000, name: 'AddTransactionTimingColumns1760920500000' },
  { timestamp: 1760920600000, name: 'BackfillTransactionTimingColumns1760920600000' },
];

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: true,
  });

  await conn.query("SET time_zone = '-06:00'");

  const [users] = await conn.query("SHOW TABLES LIKE 'Users'");
  const [migTable] = await conn.query("SHOW TABLES LIKE 'migrations'");
  const [push] = await conn.query("SHOW TABLES LIKE 'PushSubscriptions'");

  console.log(
    JSON.stringify({
      hasUsers: users.length > 0,
      hasMigrationsTable: migTable.length > 0,
      hasPushSubscriptions: push.length > 0,
    }),
  );

  if (!users.length) {
    console.log('BD vacía: conviene correr npm run migration:run completo.');
    await conn.end();
    return;
  }

  // Tabla de control TypeORM
  await conn.query(`
    CREATE TABLE IF NOT EXISTS \`migrations\` (
      \`id\` INT NOT NULL AUTO_INCREMENT,
      \`timestamp\` BIGINT NOT NULL,
      \`name\` VARCHAR(255) NOT NULL,
      PRIMARY KEY (\`id\`)
    ) ENGINE=InnoDB
  `);

  const [existing] = await conn.query('SELECT name FROM migrations');
  const names = new Set(existing.map((r) => r.name));

  for (const m of PREVIOUS_MIGRATIONS) {
    if (!names.has(m.name)) {
      await conn.query(
        'INSERT INTO migrations (`timestamp`, `name`) VALUES (?, ?)',
        [m.timestamp, m.name],
      );
      console.log('Marcada como aplicada:', m.name);
    }
  }

  if (!push.length) {
    await conn.query(`
      CREATE TABLE IF NOT EXISTS \`PushSubscriptions\` (
        \`Id\` BIGINT NOT NULL AUTO_INCREMENT,
        \`UserId\` BIGINT NOT NULL,
        \`ClientId\` BIGINT NOT NULL,
        \`Endpoint\` VARCHAR(500) NOT NULL,
        \`P256dh\` VARCHAR(255) NOT NULL,
        \`Auth\` VARCHAR(255) NOT NULL,
        \`TimeZone\` VARCHAR(64) NOT NULL DEFAULT 'America/Mexico_City',
        \`CreatedAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`LastSentAt\` DATETIME NULL,
        PRIMARY KEY (\`Id\`),
        UNIQUE INDEX \`UQ_PushSubscriptions_Endpoint\` (\`Endpoint\` ASC),
        INDEX \`IX_PushSubscriptions_UserId\` (\`UserId\` ASC),
        INDEX \`IX_PushSubscriptions_ClientId\` (\`ClientId\` ASC),
        CONSTRAINT \`FK_PushSubscriptions_Users\`
          FOREIGN KEY (\`UserId\`)
          REFERENCES \`Users\` (\`Id\`)
          ON DELETE CASCADE
          ON UPDATE CASCADE,
        CONSTRAINT \`FK_PushSubscriptions_Clients\`
          FOREIGN KEY (\`ClientId\`)
          REFERENCES \`Clients\` (\`Id\`)
          ON DELETE CASCADE
          ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('Tabla PushSubscriptions creada');
  } else {
    console.log('PushSubscriptions ya existía');
  }

  const pushMig = 'CreatePushSubscriptions1760922000000';
  if (!names.has(pushMig)) {
    await conn.query(
      'INSERT INTO migrations (`timestamp`, `name`) VALUES (?, ?)',
      [1760922000000, pushMig],
    );
    console.log('Marcada como aplicada:', pushMig);
  }

  const [final] = await conn.query(
    'SELECT timestamp, name FROM migrations ORDER BY timestamp',
  );
  console.log('migrationsTotal=' + final.length);
  await conn.end();
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
