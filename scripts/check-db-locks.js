require('dotenv').config();
const mysql = require('mysql2/promise');

(async () => {
  const c = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  console.log('=== OPEN TABLES (In_use > 0) ===');
  const [open] = await c.query('SHOW OPEN TABLES WHERE In_use > 0');
  console.log(open.length ? open : '(ninguna)');

  console.log('\n=== INNODB TRX ===');
  try {
    const [trx] = await c.query(
      'SELECT trx_id, trx_state, trx_started, trx_mysql_thread_id, LEFT(trx_query, 120) AS q FROM information_schema.innodb_trx',
    );
    console.log(trx.length ? trx : '(ninguna transacción abierta)');
  } catch (e) {
    console.log('(sin permiso PROCESS:', e.message + ')');
  }

  console.log('\n=== PROCESSLIST ===');
  try {
    const [proc] = await c.query(`
      SELECT ID, USER, HOST, DB, COMMAND, TIME, STATE, LEFT(INFO, 100) AS INFO
      FROM information_schema.PROCESSLIST
      WHERE DB = DATABASE() AND (COMMAND != 'Sleep' OR TIME > 5)
      ORDER BY TIME DESC
      LIMIT 20
    `);
    console.table(proc);
  } catch (e) {
    console.log('(sin permiso:', e.message + ')');
  }

  console.log('\n=== SELECT COUNT Transactions ===');
  const t0 = Date.now();
  const [cnt] = await c.query('SELECT COUNT(*) AS n FROM Transactions');
  console.log(`count=${cnt[0].n} (${Date.now() - t0}ms)`);

  await c.end();
})().catch((e) => {
  console.error('ERROR:', e.message);
  process.exit(1);
});
