-- ============================================================
-- DOMINOVA INTERNAL OPERATING SYSTEM - DATABASE SCHEMA
-- ============================================================

PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

-- ============================================================
-- USERS & ROLES
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin', 'sales', 'manager', 'developer')),
  is_active INTEGER NOT NULL DEFAULT 1,
  avatar_url TEXT,
  phone TEXT,
  username TEXT,
  domain TEXT,
  employee_id TEXT,
  login_access INTEGER DEFAULT 1,
  joining_date TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- ============================================================
-- LEADS
-- ============================================================

CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id TEXT NOT NULL UNIQUE, -- DOM-LEAD-0001
  client_name TEXT NOT NULL,
  org_name TEXT,
  phone TEXT NOT NULL,
  email TEXT,
  google_business_url TEXT,
  instagram_url TEXT,
  other_url TEXT,
  lead_source TEXT DEFAULT 'Manual',
  assigned_to INTEGER REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'NEW'
    CHECK(status IN ('NEW','ASSIGNED','CONTACTED','INTERESTED','FOLLOW_UP','MANAGER_REVIEW','CONVERTED','LOST')),
  notes TEXT,
  requirements TEXT,
  quoted_amount REAL,
  advance_amount REAL DEFAULT 0,
  advance_received INTEGER NOT NULL DEFAULT 0,
  full_project_amount REAL,
  next_followup_date TEXT,
  last_contacted_at TEXT,
  project_confirmed INTEGER NOT NULL DEFAULT 0,
  project_confirmed_at TEXT,
  project_confirmed_by INTEGER REFERENCES users(id),
  project_id INTEGER REFERENCES projects(id),
  is_deleted INTEGER NOT NULL DEFAULT 0,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_leads_assigned_to ON leads(assigned_to);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_lead_id ON leads(lead_id);

-- ============================================================
-- LEAD FOLLOW-UPS
-- ============================================================

CREATE TABLE IF NOT EXISTS lead_followups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER NOT NULL REFERENCES leads(id),
  created_by INTEGER NOT NULL REFERENCES users(id),
  followup_date TEXT NOT NULL,
  followup_time TEXT,
  reason TEXT NOT NULL,
  client_position TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK(status IN ('PENDING','DONE','MISSED')),
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_followups_lead_id ON lead_followups(lead_id);
CREATE INDEX IF NOT EXISTS idx_followups_date ON lead_followups(followup_date);
CREATE INDEX IF NOT EXISTS idx_followups_created_by ON lead_followups(created_by);

-- ============================================================
-- MANAGER ESCALATIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS manager_escalations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER NOT NULL REFERENCES leads(id),
  salesperson_id INTEGER NOT NULL REFERENCES users(id),
  manager_id INTEGER REFERENCES users(id),
  quoted_price REAL,
  requirements TEXT,
  reason TEXT NOT NULL,
  salesperson_notes TEXT,
  manager_notes TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING_MANAGER'
    CHECK(status IN ('PENDING_MANAGER','IN_DISCUSSION','FOLLOW_UP','CONVERTED','LOST','CLOSED')),
  followup_date TEXT,
  is_deleted INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_escalations_lead_id ON manager_escalations(lead_id);
CREATE INDEX IF NOT EXISTS idx_escalations_manager_id ON manager_escalations(manager_id);
CREATE INDEX IF NOT EXISTS idx_escalations_salesperson_id ON manager_escalations(salesperson_id);

-- ============================================================
-- PROJECTS
-- ============================================================

CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL UNIQUE, -- DOM-PROJ-0001
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

CREATE INDEX IF NOT EXISTS idx_projects_project_id ON projects(project_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_developer_id ON projects(developer_id);
CREATE INDEX IF NOT EXISTS idx_projects_salesperson_id ON projects(salesperson_id);
CREATE INDEX IF NOT EXISTS idx_projects_lead_id ON projects(lead_id);

-- ============================================================
-- PROJECT STATUS HISTORY
-- ============================================================

CREATE TABLE IF NOT EXISTS project_status_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id),
  old_status TEXT,
  new_status TEXT NOT NULL,
  changed_by INTEGER NOT NULL REFERENCES users(id),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_psh_project_id ON project_status_history(project_id);

-- ============================================================
-- PROJECT MESSAGES (Communication)
-- ============================================================

CREATE TABLE IF NOT EXISTS project_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id),
  sender_id INTEGER NOT NULL REFERENCES users(id),
  message TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_messages_project_id ON project_messages(project_id);

-- ============================================================
-- PROJECT FILES
-- ============================================================

CREATE TABLE IF NOT EXISTS project_files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id),
  uploaded_by INTEGER NOT NULL REFERENCES users(id),
  file_name TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  file_path TEXT NOT NULL,
  description TEXT,
  is_deleted INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_files_project_id ON project_files(project_id);

-- ============================================================
-- PROJECT REVISIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS project_revisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id),
  revision_number INTEGER NOT NULL,
  rejection_reason TEXT NOT NULL,
  rejected_by INTEGER NOT NULL REFERENCES users(id),
  rejected_at TEXT NOT NULL DEFAULT (datetime('now')),
  resubmitted_at TEXT,
  resubmitted_url TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK(status IN ('PENDING','RESOLVED'))
);

CREATE INDEX IF NOT EXISTS idx_revisions_project_id ON project_revisions(project_id);

-- ============================================================
-- WALLETS
-- ============================================================

CREATE TABLE IF NOT EXISTS wallets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id),
  total_earned REAL NOT NULL DEFAULT 0,
  total_withdrawn REAL NOT NULL DEFAULT 0,
  available_balance REAL NOT NULL DEFAULT 0,
  pending_withdrawal REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON wallets(user_id);

-- ============================================================
-- WALLET TRANSACTIONS (Immutable Ledger)
-- ============================================================

CREATE TABLE IF NOT EXISTS wallet_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  transaction_id TEXT NOT NULL UNIQUE, -- TXN-0001
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
  note TEXT,
  status TEXT NOT NULL DEFAULT 'COMPLETED'
    CHECK(status IN ('PENDING','COMPLETED','REVERSED')),
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_wt_wallet_id ON wallet_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_wt_user_id ON wallet_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_wt_project_id ON wallet_transactions(project_id);

-- ============================================================
-- WITHDRAWALS
-- ============================================================

CREATE TABLE IF NOT EXISTS withdrawals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  withdrawal_id TEXT NOT NULL UNIQUE, -- WD-0001
  user_id INTEGER NOT NULL REFERENCES users(id),
  wallet_id INTEGER NOT NULL REFERENCES wallets(id),
  amount REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK(status IN ('PENDING','APPROVED','REJECTED','COMPLETED')),
  request_notes TEXT,
  admin_notes TEXT,
  reviewed_by INTEGER REFERENCES users(id),
  reviewed_at TEXT,
  transaction_id INTEGER REFERENCES wallet_transactions(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_withdrawals_user_id ON withdrawals(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON withdrawals(status);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'INFO'
    CHECK(type IN ('INFO','SUCCESS','WARNING','ERROR','ACTION_REQUIRED')),
  entity_type TEXT, -- 'lead', 'project', 'escalation', 'withdrawal', etc.
  entity_id INTEGER,
  link TEXT,
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);

-- ============================================================
-- AUDIT LOGS
-- ============================================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id INTEGER,
  old_value TEXT, -- JSON
  new_value TEXT, -- JSON
  description TEXT NOT NULL,
  ip_address TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_audit_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id);

-- ============================================================
-- LEAD ACTIVITY HISTORY
-- ============================================================

CREATE TABLE IF NOT EXISTS lead_activities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER NOT NULL REFERENCES leads(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  activity_type TEXT NOT NULL,
  description TEXT NOT NULL,
  metadata TEXT, -- JSON
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_lead_activities_lead_id ON lead_activities(lead_id);

-- ============================================================
-- SETTINGS
-- ============================================================

CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  description TEXT,
  updated_by INTEGER REFERENCES users(id),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Insert default settings
INSERT OR IGNORE INTO settings (key, value, description) VALUES
  ('advance_mandatory', 'false', 'Whether advance payment is mandatory before project conversion'),
  ('company_name', 'Dominova', 'Company display name'),
  ('currency_symbol', '₹', 'Currency symbol to display');
