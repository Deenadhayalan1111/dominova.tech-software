const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '../../data/dominova.db');

try {
  console.log('Opening database...');
  const db = new Database(DB_PATH);
  
  // Create a new table with the updated constraint
  db.exec(`
    CREATE TABLE IF NOT EXISTS wallet_transactions_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transaction_id TEXT NOT NULL UNIQUE,
      wallet_id INTEGER NOT NULL REFERENCES wallets(id),
      user_id INTEGER NOT NULL REFERENCES users(id),
      project_id INTEGER REFERENCES projects(id),
      type TEXT NOT NULL
        CHECK(type IN (
          'DEVELOPER_EARNING',
          'SALES_COMMISSION',
          'WITHDRAWAL_DEBIT',
          'ADJUSTMENT_CREDIT',
          'ADJUSTMENT_DEBIT',
          'MANUAL_CREDIT'
        )),
      amount REAL NOT NULL,
      direction TEXT NOT NULL CHECK(direction IN ('CREDIT','DEBIT')),
      description TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'COMPLETED'
        CHECK(status IN ('PENDING','COMPLETED','REVERSED')),
      created_by INTEGER NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  
  console.log('Copying data...');
  db.exec(`
    INSERT INTO wallet_transactions_new 
    SELECT * FROM wallet_transactions;
  `);
  
  console.log('Replacing table...');
  db.exec(`DROP TABLE wallet_transactions;`);
  db.exec(`ALTER TABLE wallet_transactions_new RENAME TO wallet_transactions;`);
  
  console.log('Recreating indexes...');
  db.exec(`CREATE INDEX IF NOT EXISTS idx_wt_wallet_id ON wallet_transactions(wallet_id);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_wt_user_id ON wallet_transactions(user_id);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_wt_project_id ON wallet_transactions(project_id);`);
  
  console.log('Migration successful!');
  db.close();
} catch (error) {
  console.error('Migration failed:', error);
}
