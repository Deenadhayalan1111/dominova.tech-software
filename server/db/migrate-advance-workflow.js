const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '../../data/dominova.db');

try {
  console.log('Opening database...');
  const db = new Database(DB_PATH);
  db.pragma('foreign_keys = OFF');
  
  console.log('Adding new columns to leads table...');
  try { db.exec(`ALTER TABLE leads ADD COLUMN advance_received INTEGER NOT NULL DEFAULT 0;`); } catch (e) { console.log('Column advance_received may already exist'); }
  try { db.exec(`ALTER TABLE leads ADD COLUMN project_confirmed INTEGER NOT NULL DEFAULT 0;`); } catch (e) { console.log('Column project_confirmed may already exist'); }
  try { db.exec(`ALTER TABLE leads ADD COLUMN project_confirmed_at TEXT;`); } catch (e) { console.log('Column project_confirmed_at may already exist'); }
  try { db.exec(`ALTER TABLE leads ADD COLUMN project_confirmed_by INTEGER REFERENCES users(id);`); } catch (e) { console.log('Column project_confirmed_by may already exist'); }
  try { db.exec(`ALTER TABLE leads ADD COLUMN project_id INTEGER REFERENCES projects(id);`); } catch (e) { console.log('Column project_id may already exist'); }

  console.log('Adding new columns to projects table...');
  try { db.exec(`ALTER TABLE projects ADD COLUMN frontend_developer_id INTEGER REFERENCES users(id);`); } catch (e) { console.log('Column frontend_developer_id may already exist'); }
  try { db.exec(`ALTER TABLE projects ADD COLUMN backend_developer_id INTEGER REFERENCES users(id);`); } catch (e) { console.log('Column backend_developer_id may already exist'); }
  try { db.exec(`ALTER TABLE projects ADD COLUMN hosting_developer_id INTEGER REFERENCES users(id);`); } catch (e) { console.log('Column hosting_developer_id may already exist'); }

  console.log('Recreating projects table for status check constraint...');
  db.exec(`DROP TABLE IF EXISTS projects_new;`);
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id TEXT NOT NULL UNIQUE,
      lead_id INTEGER REFERENCES leads(id),
      salesperson_id INTEGER NOT NULL REFERENCES users(id),
      developer_id INTEGER REFERENCES users(id),
      frontend_developer_id INTEGER REFERENCES users(id),
      backend_developer_id INTEGER REFERENCES users(id),
      hosting_developer_id INTEGER REFERENCES users(id),
      client_name TEXT NOT NULL,
      org_name TEXT,
      phone TEXT NOT NULL,
      email TEXT,
      google_business_url TEXT,
      instagram_url TEXT,
      other_url TEXT,
      requirements TEXT NOT NULL,
      specifications TEXT,
      website_expectations TEXT,
      full_project_amount REAL NOT NULL,
      advance_amount REAL NOT NULL DEFAULT 0,
      remaining_amount REAL GENERATED ALWAYS AS (full_project_amount - advance_amount) STORED,
      developer_payout REAL,
      backend_payout REAL DEFAULT 0,
      hosting_payout REAL DEFAULT 0,
      picked_components TEXT,
      sales_commission REAL,
      final_website_url TEXT,
      status TEXT NOT NULL DEFAULT 'PENDING_ADMIN_APPROVAL'
        CHECK(status IN (
          'PENDING_ADMIN_APPROVAL',
          'PENDING_FOUNDER_REVIEW',
          'PENDING_FOUNDER_ALLOCATION',
          'REJECTED_BY_ADMIN',
          'AVAILABLE_FOR_DEVELOPER',
          'AVAILABLE_FOR_DEVELOPERS',
          'ASSIGNED',
          'IN_DEVELOPMENT',
          'TESTING',
          'SUBMITTED',
          'PENDING_FINAL_APPROVAL',
          'REVISION_REQUIRED',
          'COMPLETED',
          'CLOSED'
        )),
      payment_status TEXT NOT NULL DEFAULT 'PENDING'
        CHECK(payment_status IN ('PENDING','PARTIAL','PAID','CONFIRMED')),
      admin_approval_notes TEXT,
      rejection_reason TEXT,
      final_rejection_reason TEXT,
      salesperson_notes TEXT,
      revision_count INTEGER NOT NULL DEFAULT 0,
      is_deleted INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      completed_at TEXT,
      approved_by INTEGER REFERENCES users(id),
      approved_at TEXT,
      deadline TEXT
    );
  `);
  
  console.log('Copying projects data...');
  db.exec(`
    INSERT INTO projects_new 
    SELECT 
      id, project_id, lead_id, salesperson_id, developer_id, 
      frontend_developer_id, backend_developer_id, hosting_developer_id,
      client_name, org_name, phone, email, google_business_url, instagram_url, other_url, 
      requirements, specifications, website_expectations, full_project_amount, advance_amount, 
      developer_payout, backend_payout, hosting_payout, picked_components, sales_commission, 
      final_website_url, status, payment_status, admin_approval_notes, rejection_reason, 
      final_rejection_reason, salesperson_notes, revision_count, is_deleted, created_at, 
      updated_at, completed_at, approved_by, approved_at, deadline
    FROM projects;
  `);
  
  console.log('Replacing projects table...');
  db.exec(`DROP TABLE projects;`);
  db.exec(`ALTER TABLE projects_new RENAME TO projects;`);
  
  console.log('Recreating projects indexes...');
  db.exec(`CREATE INDEX IF NOT EXISTS idx_projects_project_id ON projects(project_id);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_projects_developer_id ON projects(developer_id);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_projects_salesperson_id ON projects(salesperson_id);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_projects_lead_id ON projects(lead_id);`);
  
  console.log('Migration successful!');
  db.close();
} catch (error) {
  console.error('Migration failed:', error);
}
