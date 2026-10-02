const bcrypt = require('bcryptjs');
const { getDb } = require('./database');

const db = getDb();

// ============================================================
// HELPERS
// ============================================================

function nextId(prefix, table, column) {
  const row = db.prepare(`SELECT MAX(CAST(SUBSTR(${column}, LENGTH(?) + 1) AS INTEGER)) as n FROM ${table}`).get(prefix + '-');
  const n = (row.n || 0) + 1;
  return `${prefix}-${String(n).padStart(4, '0')}`;
}

function nextTransactionId() {
  const row = db.prepare(`SELECT COUNT(*) as n FROM wallet_transactions`).get();
  return `TXN-${String((row.n || 0) + 1).padStart(6, '0')}`;
}

function nextWithdrawalId() {
  const row = db.prepare(`SELECT COUNT(*) as n FROM withdrawals`).get();
  return `WD-${String((row.n || 0) + 1).padStart(4, '0')}`;
}

// ============================================================
// SEED USERS
// ============================================================

const users = [
  { name: 'Founder Admin', email: 'admin@dominova.in', password: 'Admin@123', role: 'admin', phone: '9000000001' },
  { name: 'Rahul Sharma', email: 'sales1@dominova.in', password: 'Sales@123', role: 'sales', phone: '9000000002' },
  { name: 'Priya Patel', email: 'sales2@dominova.in', password: 'Sales@123', role: 'sales', phone: '9000000003' },
  { name: 'Arjun Singh', email: 'sales3@dominova.in', password: 'Sales@123', role: 'sales', phone: '9000000004' },
  { name: 'Meera Nair', email: 'manager@dominova.in', password: 'Manager@123', role: 'manager', phone: '9000000005' },
  { name: 'Vikram Dev', email: 'dev1@dominova.in', password: 'Dev@123', role: 'developer', phone: '9000000006' },
  { name: 'Sneha Reddy', email: 'dev2@dominova.in', password: 'Dev@123', role: 'developer', phone: '9000000007' },
  { name: 'Kiran Kumar', email: 'dev3@dominova.in', password: 'Dev@123', role: 'developer', phone: '9000000008' },
  { name: 'Aditya Verma', email: 'dev4@dominova.in', password: 'Dev@123', role: 'developer', phone: '9000000009' },
  { name: 'Deepika Joshi', email: 'dev5@dominova.in', password: 'Dev@123', role: 'developer', phone: '9000000010' },
];

console.log('🌱 Seeding users...');
const insertUser = db.prepare(`
  INSERT OR IGNORE INTO users (name, email, password_hash, role, phone)
  VALUES (?, ?, ?, ?, ?)
`);

const insertWallet = db.prepare(`
  INSERT OR IGNORE INTO wallets (user_id, total_earned, total_withdrawn, available_balance, pending_withdrawal)
  VALUES (?, 0, 0, 0, 0)
`);

for (const u of users) {
  const hash = bcrypt.hashSync(u.password, 10);
  const result = insertUser.run(u.name, u.email, hash, u.role, u.phone);
  if (result.changes > 0) {
    insertWallet.run(result.lastInsertRowid);
  }
}

// Get user IDs
function getUserId(email) {
  return db.prepare('SELECT id FROM users WHERE email = ?').get(email).id;
}

const adminId = getUserId('admin@dominova.in');
const s1Id = getUserId('sales1@dominova.in');
const s2Id = getUserId('sales2@dominova.in');
const s3Id = getUserId('sales3@dominova.in');
const mgId = getUserId('manager@dominova.in');
const d1Id = getUserId('dev1@dominova.in');
const d2Id = getUserId('dev2@dominova.in');
const d3Id = getUserId('dev3@dominova.in');
const d4Id = getUserId('dev4@dominova.in');
const d5Id = getUserId('dev5@dominova.in');

// ============================================================
// SEED LEADS
// ============================================================

console.log('🌱 Seeding leads...');

const leads = [
  // 1. New unassigned lead
  {
    lead_id: 'DOM-LEAD-0001',
    client_name: 'Suresh Gupta',
    org_name: 'Gupta Sweets',
    phone: '9876543210',
    email: 'suresh@guptasweets.com',
    google_business_url: 'https://g.co/guptasweets',
    instagram_url: 'https://instagram.com/guptasweets',
    lead_source: 'Instagram',
    assigned_to: null,
    status: 'NEW',
    notes: 'Interested in a restaurant website',
    created_by: adminId,
  },
  // 2. Assigned to sales1
  {
    lead_id: 'DOM-LEAD-0002',
    client_name: 'Anita Mehta',
    org_name: 'Mehta Boutique',
    phone: '9876543211',
    email: 'anita@mehtaboutique.in',
    google_business_url: 'https://g.co/mehtaboutique',
    instagram_url: 'https://instagram.com/mehtaboutique',
    lead_source: 'Google',
    assigned_to: s1Id,
    status: 'ASSIGNED',
    notes: 'Fashion boutique, wants e-commerce site',
    created_by: adminId,
  },
  // 3. Contacted, follow-up required
  {
    lead_id: 'DOM-LEAD-0003',
    client_name: 'Ramesh Pillai',
    org_name: 'Pillai Real Estate',
    phone: '9876543212',
    email: 'ramesh@pillai.com',
    google_business_url: 'https://g.co/pillaiestates',
    lead_source: 'Referral',
    assigned_to: s1Id,
    status: 'FOLLOW_UP',
    notes: 'Called on 5th Sep. Client interested but wants to discuss after Diwali.',
    requirements: 'Property listing website with search filters and contact forms',
    quoted_amount: 35000,
    next_followup_date: '2026-10-25',
    last_contacted_at: datetime('2026-09-05'),
    created_by: adminId,
  },
  // 4. Interested lead
  {
    lead_id: 'DOM-LEAD-0004',
    client_name: 'Kavitha Rao',
    org_name: 'Kavitha Beauty Salon',
    phone: '9876543213',
    email: 'kavitha@beautysalon.in',
    instagram_url: 'https://instagram.com/kavithabeauty',
    lead_source: 'Instagram',
    assigned_to: s2Id,
    status: 'INTERESTED',
    notes: 'Very interested. Wants booking system integrated.',
    requirements: 'Salon booking website with appointment calendar',
    quoted_amount: 25000,
    last_contacted_at: datetime('2026-09-08'),
    created_by: adminId,
  },
  // 5. Manager review
  {
    lead_id: 'DOM-LEAD-0005',
    client_name: 'Harish Agarwal',
    org_name: 'Agarwal Motors',
    phone: '9876543214',
    email: 'harish@agarwalmotors.com',
    google_business_url: 'https://g.co/agarwalmotors',
    lead_source: 'Google',
    assigned_to: s2Id,
    status: 'MANAGER_REVIEW',
    notes: 'High value client. Needs founder to speak with.',
    requirements: 'Car dealership website with inventory management',
    quoted_amount: 85000,
    last_contacted_at: datetime('2026-09-07'),
    created_by: adminId,
  },
  // 6. Converted - will become a project
  {
    lead_id: 'DOM-LEAD-0006',
    client_name: 'Pooja Iyer',
    org_name: 'Iyer Catering',
    phone: '9876543215',
    email: 'pooja@iyercatering.com',
    google_business_url: 'https://g.co/iyercatering',
    instagram_url: 'https://instagram.com/iyercatering',
    lead_source: 'Referral',
    assigned_to: s1Id,
    status: 'CONVERTED',
    requirements: 'Catering website with menu, gallery, and contact',
    quoted_amount: 20000,
    advance_amount: 8000,
    full_project_amount: 20000,
    last_contacted_at: datetime('2026-09-01'),
    created_by: adminId,
  },
  // 7. Lost lead
  {
    lead_id: 'DOM-LEAD-0007',
    client_name: 'Vijay Nair',
    org_name: 'Nair Travels',
    phone: '9876543216',
    lead_source: 'Cold Call',
    assigned_to: s3Id,
    status: 'LOST',
    notes: 'Not interested, has own IT team.',
    created_by: adminId,
  },
  // 8. Another new lead for sales3
  {
    lead_id: 'DOM-LEAD-0008',
    client_name: 'Sunita Krishnan',
    org_name: 'Krishnan Clinics',
    phone: '9876543217',
    email: 'sunita@krish.clinic',
    google_business_url: 'https://g.co/krishnanclinic',
    lead_source: 'Google',
    assigned_to: s3Id,
    status: 'CONTACTED',
    notes: 'Doctor, wants appointment booking website',
    last_contacted_at: datetime('2026-09-09'),
    created_by: adminId,
  },
];

function datetime(d) { return d + ' 00:00:00'; }

const insertLead = db.prepare(`
  INSERT OR IGNORE INTO leads 
  (lead_id, client_name, org_name, phone, email, google_business_url, instagram_url, 
   lead_source, assigned_to, status, notes, requirements, quoted_amount, advance_amount,
   full_project_amount, next_followup_date, last_contacted_at, created_by)
  VALUES 
  (@lead_id, @client_name, @org_name, @phone, @email, @google_business_url, @instagram_url,
   @lead_source, @assigned_to, @status, @notes, @requirements, @quoted_amount, @advance_amount,
   @full_project_amount, @next_followup_date, @last_contacted_at, @created_by)
`);

for (const lead of leads) {
  insertLead.run({
    google_business_url: null, instagram_url: null, other_url: null,
    email: null, org_name: null, requirements: null, quoted_amount: null,
    advance_amount: null, full_project_amount: null, next_followup_date: null,
    last_contacted_at: null, notes: null,
    ...lead,
  });
}

// ============================================================
// SEED FOLLOW-UPS
// ============================================================

console.log('🌱 Seeding follow-ups...');

const lead3 = db.prepare('SELECT id FROM leads WHERE lead_id = ?').get('DOM-LEAD-0003');
if (lead3) {
  db.prepare(`INSERT OR IGNORE INTO lead_followups 
    (lead_id, created_by, followup_date, followup_time, reason, client_position, notes, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
    lead3.id, s1Id, '2026-10-25', '10:00',
    'Client asked to call after Diwali',
    '90% interested, evaluating budget',
    'Discuss final requirements and pricing',
    'PENDING'
  );
}

// ============================================================
// SEED MANAGER ESCALATION
// ============================================================

console.log('🌱 Seeding manager escalation...');

const lead5 = db.prepare('SELECT id FROM leads WHERE lead_id = ?').get('DOM-LEAD-0005');
if (lead5) {
  db.prepare(`INSERT OR IGNORE INTO manager_escalations
    (lead_id, salesperson_id, manager_id, quoted_price, requirements, reason, salesperson_notes, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
    lead5.id, s2Id, mgId, 85000,
    'Car dealership website with full inventory management system, EMI calculator, and CRM integration',
    'High-value client. Discussed pricing but client wants to speak with senior management before committing.',
    'Client is very serious. Price can be negotiated. Strongly recommend manager to close this.',
    'PENDING_MANAGER'
  );
}

// ============================================================
// SEED PROJECTS
// ============================================================

console.log('🌱 Seeding projects...');

const lead6 = db.prepare('SELECT id FROM leads WHERE lead_id = ?').get('DOM-LEAD-0006');

const projectData = [
  // P1: Pending Admin Approval
  {
    project_id: 'DOM-PROJ-0001',
    lead_id: lead6 ? lead6.id : null,
    salesperson_id: s1Id,
    developer_id: null,
    client_name: 'Pooja Iyer',
    org_name: 'Iyer Catering',
    phone: '9876543215',
    email: 'pooja@iyercatering.com',
    google_business_url: 'https://g.co/iyercatering',
    instagram_url: 'https://instagram.com/iyercatering',
    requirements: 'Full catering website with menu showcase, gallery, testimonials, contact form and WhatsApp integration',
    specifications: 'Mobile-first design, fast loading, SEO optimized, CMS for menu updates',
    website_expectations: 'Professional, warm colors (orange/gold theme), easy to navigate',
    full_project_amount: 20000,
    advance_amount: 8000,
    developer_payout: null,
    status: 'PENDING_ADMIN_APPROVAL',
    payment_status: 'PARTIAL',
    salesperson_notes: 'Client very happy with our portfolio. Advance paid via UPI. Wants delivery in 3 weeks.',
  },
  // P2: Available for developer
  {
    project_id: 'DOM-PROJ-0002',
    lead_id: null,
    salesperson_id: s2Id,
    developer_id: null,
    client_name: 'Akhil Stores',
    org_name: 'Akhil General Stores',
    phone: '9876543220',
    email: 'akhil@stores.com',
    google_business_url: 'https://g.co/akhilstores',
    instagram_url: null,
    requirements: 'E-commerce website for grocery store with cart, payment gateway and delivery tracking',
    specifications: 'WooCommerce style, Razorpay integration, UPI and card payment, WhatsApp order confirmation',
    website_expectations: 'Clean, modern grocery store theme. Must work perfectly on mobile.',
    full_project_amount: 30000,
    advance_amount: 15000,
    developer_payout: 9000,
    status: 'AVAILABLE_FOR_DEVELOPER',
    payment_status: 'PARTIAL',
    salesperson_notes: 'High-priority. Client wants launch before next month.',
  },
  // P3: Active development (assigned to dev1)
  {
    project_id: 'DOM-PROJ-0003',
    lead_id: null,
    salesperson_id: s1Id,
    developer_id: d1Id,
    client_name: 'TechStart Solutions',
    org_name: 'TechStart Solutions Pvt Ltd',
    phone: '9876543221',
    email: 'info@techstart.in',
    google_business_url: null,
    instagram_url: 'https://instagram.com/techstart_in',
    requirements: 'Corporate website with team page, services, portfolio, blog and contact form',
    specifications: 'React-based, fast loading, dark/light mode, AOS animations',
    website_expectations: 'Premium tech startup look. Dark theme with neon accents.',
    full_project_amount: 25000,
    advance_amount: 12500,
    developer_payout: 7500,
    status: 'IN_DEVELOPMENT',
    payment_status: 'PARTIAL',
    salesperson_notes: 'Tech-savvy client. Gave very detailed requirements.',
  },
  // P4: Submitted (pending final approval)
  {
    project_id: 'DOM-PROJ-0004',
    lead_id: null,
    salesperson_id: s3Id,
    developer_id: d2Id,
    client_name: 'Nisha Fashion House',
    org_name: 'Nisha Fashion',
    phone: '9876543222',
    email: 'nisha@fashionhouse.com',
    google_business_url: 'https://g.co/nishafashion',
    instagram_url: 'https://instagram.com/nishafashion',
    requirements: 'Fashion e-commerce with size guide, lookbook, wishlist and checkout',
    specifications: 'Elegant feminine design, Instagram feed integration, fast image loading',
    website_expectations: 'Luxury fashion website feel. Pink and gold theme.',
    full_project_amount: 35000,
    advance_amount: 20000,
    developer_payout: 10000,
    final_website_url: 'https://nisha-fashion-demo.netlify.app',
    status: 'PENDING_FINAL_APPROVAL',
    payment_status: 'PARTIAL',
    salesperson_notes: 'Premium client, very specific about design.',
    revision_count: 0,
  },
  // P5: Revision required
  {
    project_id: 'DOM-PROJ-0005',
    lead_id: null,
    salesperson_id: s2Id,
    developer_id: d3Id,
    client_name: 'Mehta Law Firm',
    org_name: 'Mehta & Associates',
    phone: '9876543223',
    email: 'contact@mehtalaw.com',
    google_business_url: 'https://g.co/mehtalaw',
    instagram_url: null,
    requirements: 'Law firm website with practice areas, team profiles, case results and consultation booking',
    specifications: 'Professional, trustworthy design, online consultation form, live chat',
    website_expectations: 'Authoritative and professional. Navy blue and gold.',
    full_project_amount: 28000,
    advance_amount: 14000,
    developer_payout: 8500,
    final_website_url: 'https://mehta-law-demo.netlify.app',
    status: 'REVISION_REQUIRED',
    payment_status: 'PARTIAL',
    salesperson_notes: 'Client is a lawyer, very detail-oriented.',
    final_rejection_reason: 'Contact form is not working. The consultation booking page loads slowly. Please fix both issues.',
    revision_count: 1,
  },
  // P6: Completed project
  {
    project_id: 'DOM-PROJ-0006',
    lead_id: null,
    salesperson_id: s1Id,
    developer_id: d4Id,
    client_name: 'Sharma Bakery',
    org_name: 'Sharma Bake House',
    phone: '9876543224',
    email: 'sharma@bakehouse.in',
    google_business_url: 'https://g.co/sharmabakery',
    instagram_url: 'https://instagram.com/sharmabakery',
    requirements: 'Bakery website with online ordering, delivery zones, custom cake builder',
    specifications: 'Warm cozy design, WhatsApp ordering, photo gallery, Google Maps integration',
    website_expectations: 'Homely and inviting. Brown, cream, and warm red palette.',
    full_project_amount: 18000,
    advance_amount: 18000,
    developer_payout: 5500,
    sales_commission: 2500,
    final_website_url: 'https://sharma-bakehouse.com',
    status: 'COMPLETED',
    payment_status: 'PAID',
    salesperson_notes: 'Full payment received before delivery.',
    revision_count: 0,
    completed_at: '2026-09-01 10:00:00',
    approved_by: adminId,
    approved_at: '2026-09-01 10:00:00',
  },
];

const insertProject = db.prepare(`
  INSERT OR IGNORE INTO projects
  (project_id, lead_id, salesperson_id, developer_id, client_name, org_name, phone, email,
   google_business_url, instagram_url, requirements, specifications, website_expectations,
   full_project_amount, advance_amount, developer_payout, sales_commission,
   final_website_url, status, payment_status, salesperson_notes, final_rejection_reason,
   revision_count, completed_at, approved_by, approved_at)
  VALUES
  (@project_id, @lead_id, @salesperson_id, @developer_id, @client_name, @org_name, @phone, @email,
   @google_business_url, @instagram_url, @requirements, @specifications, @website_expectations,
   @full_project_amount, @advance_amount, @developer_payout, @sales_commission,
   @final_website_url, @status, @payment_status, @salesperson_notes, @final_rejection_reason,
   @revision_count, @completed_at, @approved_by, @approved_at)
`);

for (const p of projectData) {
  insertProject.run({
    lead_id: null, developer_id: null, org_name: null, email: null,
    google_business_url: null, instagram_url: null, specifications: null,
    website_expectations: null, developer_payout: null, sales_commission: null,
    final_website_url: null, salesperson_notes: null, final_rejection_reason: null,
    revision_count: 0, completed_at: null, approved_by: null, approved_at: null,
    ...p,
  });
}

// ============================================================
// SEED PROJECT STATUS HISTORY
// ============================================================

console.log('🌱 Seeding project status history...');

function getProjectId(pid) {
  const row = db.prepare('SELECT id FROM projects WHERE project_id = ?').get(pid);
  return row ? row.id : null;
}

const psh = [
  { pid: 'DOM-PROJ-0002', statuses: ['PENDING_ADMIN_APPROVAL', 'AVAILABLE_FOR_DEVELOPER'], by: adminId },
  { pid: 'DOM-PROJ-0003', statuses: ['PENDING_ADMIN_APPROVAL', 'AVAILABLE_FOR_DEVELOPER', 'ASSIGNED', 'IN_DEVELOPMENT'], by: adminId },
  { pid: 'DOM-PROJ-0004', statuses: ['PENDING_ADMIN_APPROVAL', 'AVAILABLE_FOR_DEVELOPER', 'ASSIGNED', 'IN_DEVELOPMENT', 'SUBMITTED', 'PENDING_FINAL_APPROVAL'], by: adminId },
  { pid: 'DOM-PROJ-0005', statuses: ['PENDING_ADMIN_APPROVAL', 'AVAILABLE_FOR_DEVELOPER', 'ASSIGNED', 'IN_DEVELOPMENT', 'SUBMITTED', 'PENDING_FINAL_APPROVAL', 'REVISION_REQUIRED'], by: adminId },
  { pid: 'DOM-PROJ-0006', statuses: ['PENDING_ADMIN_APPROVAL', 'AVAILABLE_FOR_DEVELOPER', 'ASSIGNED', 'IN_DEVELOPMENT', 'SUBMITTED', 'PENDING_FINAL_APPROVAL', 'COMPLETED'], by: adminId },
];

const insertPsh = db.prepare(`INSERT OR IGNORE INTO project_status_history (project_id, old_status, new_status, changed_by) VALUES (?, ?, ?, ?)`);
for (const entry of psh) {
  const pid = getProjectId(entry.pid);
  if (!pid) continue;
  for (let i = 0; i < entry.statuses.length; i++) {
    insertPsh.run(pid, entry.statuses[i - 1] || null, entry.statuses[i], entry.by);
  }
}

// ============================================================
// SEED WALLET TRANSACTIONS FOR COMPLETED PROJECT
// ============================================================

console.log('🌱 Seeding wallet transactions...');

const p6Id = getProjectId('DOM-PROJ-0006');

function getWalletId(userId) {
  const row = db.prepare('SELECT id FROM wallets WHERE user_id = ?').get(userId);
  return row ? row.id : null;
}

// Developer d4 earned ₹5500 for DOM-PROJ-0006
const d4WalletId = getWalletId(d4Id);
if (p6Id && d4WalletId) {
  const existing = db.prepare('SELECT id FROM wallet_transactions WHERE project_id = ? AND type = ?').get(p6Id, 'DEVELOPER_EARNING');
  if (!existing) {
    db.prepare(`INSERT INTO wallet_transactions 
      (transaction_id, wallet_id, user_id, project_id, type, amount, direction, description, status, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      'TXN-000001', d4WalletId, d4Id, p6Id,
      'DEVELOPER_EARNING', 5500, 'CREDIT',
      'Project completion payout - DOM-PROJ-0006 (Sharma Bake House)',
      'COMPLETED', adminId
    );
    db.prepare(`UPDATE wallets SET total_earned = ?, available_balance = ?, updated_at = datetime('now') WHERE id = ?`).run(5500, 5500, d4WalletId);
  }
}

// Sales commission for s1 for DOM-PROJ-0006
const s1WalletId = getWalletId(s1Id);
if (p6Id && s1WalletId) {
  const existing = db.prepare('SELECT id FROM wallet_transactions WHERE project_id = ? AND type = ?').get(p6Id, 'SALES_COMMISSION');
  if (!existing) {
    db.prepare(`INSERT INTO wallet_transactions 
      (transaction_id, wallet_id, user_id, project_id, type, amount, direction, description, status, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      'TXN-000002', s1WalletId, s1Id, p6Id,
      'SALES_COMMISSION', 2500, 'CREDIT',
      'Sales commission - DOM-PROJ-0006 (Sharma Bake House)',
      'COMPLETED', adminId
    );
    db.prepare(`UPDATE wallets SET total_earned = ?, available_balance = ?, updated_at = datetime('now') WHERE id = ?`).run(2500, 2500, s1WalletId);
  }
}

// ============================================================
// SEED PROJECT REVISION
// ============================================================

console.log('🌱 Seeding project revisions...');
const p5Id = getProjectId('DOM-PROJ-0005');
if (p5Id) {
  const existing = db.prepare('SELECT id FROM project_revisions WHERE project_id = ?').get(p5Id);
  if (!existing) {
    db.prepare(`INSERT INTO project_revisions 
      (project_id, revision_number, rejection_reason, rejected_by)
      VALUES (?, ?, ?, ?)`).run(
      p5Id, 1,
      'Contact form is not working. The consultation booking page loads slowly. Please fix both issues.',
      adminId
    );
  }
}

// ============================================================
// SEED PROJECT MESSAGES
// ============================================================

console.log('🌱 Seeding project messages...');
const p3Id = getProjectId('DOM-PROJ-0003');
if (p3Id) {
  const existing = db.prepare('SELECT id FROM project_messages WHERE project_id = ?').get(p3Id);
  if (!existing) {
    const msgs = [
      { sender: d1Id, msg: 'Hi, I have reviewed the requirements. Does the client want a dark theme by default or a toggle?' },
      { sender: s1Id, msg: 'Client prefers dark mode by default, but the toggle is a great idea! Please include it.' },
      { sender: d1Id, msg: 'Understood. Also, does the client want a blog with CMS or just static pages?' },
      { sender: s1Id, msg: 'Client wants a simple blog they can update themselves. CMS would be perfect.' },
      { sender: d1Id, msg: 'Got it. I will set up a headless CMS. Expected delivery: 2 weeks.' },
    ];
    const ins = db.prepare('INSERT INTO project_messages (project_id, sender_id, message) VALUES (?, ?, ?)');
    for (const m of msgs) ins.run(p3Id, m.sender, m.msg);
  }
}

// ============================================================
// SEED NOTIFICATIONS
// ============================================================

console.log('🌱 Seeding notifications...');

const p2Id = getProjectId('DOM-PROJ-0002');

const notifs = [
  { user_id: d1Id, title: 'New Project Available', message: 'A new project (Akhil General Stores) is available for developers.', type: 'ACTION_REQUIRED', entity_type: 'project', entity_id: p2Id, link: '/developer/projects' },
  { user_id: d2Id, title: 'New Project Available', message: 'A new project (Akhil General Stores) is available for developers.', type: 'ACTION_REQUIRED', entity_type: 'project', entity_id: p2Id, link: '/developer/projects' },
  { user_id: adminId, title: 'Project Submitted for Approval', message: 'Nisha Fashion House website has been submitted by Sneha Reddy for final approval.', type: 'ACTION_REQUIRED', entity_type: 'project', entity_id: getProjectId('DOM-PROJ-0004'), link: '/admin/projects' },
  { user_id: d3Id, title: 'Revision Requested', message: 'Admin has requested revisions on the Mehta Law Firm project.', type: 'WARNING', entity_type: 'project', entity_id: p5Id, link: '/developer/my-project' },
  { user_id: adminId, title: 'Project Pending Review', message: 'Iyer Catering project is pending your approval.', type: 'ACTION_REQUIRED', entity_type: 'project', entity_id: getProjectId('DOM-PROJ-0001'), link: '/admin/projects' },
  { user_id: s1Id, title: 'Follow-up Due', message: 'Follow-up with Ramesh Pillai (Pillai Real Estate) is scheduled for 25 October.', type: 'INFO', entity_type: 'lead', entity_id: lead3 ? lead3.id : null, link: '/sales/followups' },
];

const insNotif = db.prepare(`INSERT OR IGNORE INTO notifications (user_id, title, message, type, entity_type, entity_id, link) VALUES (?, ?, ?, ?, ?, ?, ?)`);
for (const n of notifs) {
  insNotif.run(n.user_id, n.title, n.message, n.type, n.entity_type || null, n.entity_id || null, n.link || null);
}

// ============================================================
// SEED LEAD ACTIVITIES
// ============================================================

console.log('🌱 Seeding lead activities...');

const lead4 = db.prepare('SELECT id FROM leads WHERE lead_id = ?').get('DOM-LEAD-0004');
const lead6Row = db.prepare('SELECT id FROM leads WHERE lead_id = ?').get('DOM-LEAD-0006');

const activities = [
  { lead_id: lead3 ? lead3.id : null, user_id: s1Id, type: 'CONTACTED', desc: 'Called client. Client interested but asked to call after Diwali.' },
  { lead_id: lead3 ? lead3.id : null, user_id: s1Id, type: 'FOLLOW_UP_CREATED', desc: 'Follow-up scheduled for October 25, 2026.' },
  { lead_id: lead4 ? lead4.id : null, user_id: s2Id, type: 'CONTACTED', desc: 'Spoke with Kavitha Rao. Very interested. Wants appointment booking system.' },
  { lead_id: lead5 ? lead5.id : null, user_id: s2Id, type: 'ESCALATED_TO_MANAGER', desc: 'Lead escalated to manager for high-value client negotiation.' },
  { lead_id: lead6Row ? lead6Row.id : null, user_id: s1Id, type: 'CONVERTED', desc: 'Lead converted. Project DOM-PROJ-0001 created. Advance ₹8000 collected.' },
];

const insAct = db.prepare('INSERT INTO lead_activities (lead_id, user_id, activity_type, description) VALUES (?, ?, ?, ?)');
for (const a of activities) {
  if (a.lead_id) insAct.run(a.lead_id, a.user_id, a.type, a.desc);
}

console.log('✅ Seed complete!');
console.log('');
console.log('📋 Demo Accounts:');
console.log('  Admin:     admin@dominova.in     / Admin@123');
console.log('  Sales 1:   sales1@dominova.in    / Sales@123');
console.log('  Sales 2:   sales2@dominova.in    / Sales@123');
console.log('  Sales 3:   sales3@dominova.in    / Sales@123');
console.log('  Manager:   manager@dominova.in   / Manager@123');
console.log('  Dev 1:     dev1@dominova.in      / Dev@123');
console.log('  Dev 2:     dev2@dominova.in      / Dev@123');
console.log('  Dev 3:     dev3@dominova.in      / Dev@123');
console.log('  Dev 4:     dev4@dominova.in      / Dev@123');
console.log('  Dev 5:     dev5@dominova.in      / Dev@123');
