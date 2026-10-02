const express = require('express');
const cors = require('cors');
const path = require('path');

// Database is Supabase; no local SQLite initialization is required.
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// ============================================================
// MIDDLEWARE
// ============================================================
app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ============================================================
// ROUTES
// ============================================================
const apiRouter = express.Router();

apiRouter.use('/auth', require('./routes/auth'));
apiRouter.use('/users', require('./routes/users'));
apiRouter.use('/leads', require('./routes/leads'));
apiRouter.use('/escalations', require('./routes/escalations'));
apiRouter.use('/projects', require('./routes/projects'));
apiRouter.use('/wallets', require('./routes/wallets'));
apiRouter.use('/notifications', require('./routes/notifications'));
apiRouter.use('/reports', require('./routes/reports'));
apiRouter.use('/files', require('./routes/files'));

// Health check
apiRouter.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), service: 'Dominova OS' });
});

// Mount router on both '/api' and '/' (supporting both local dev and serverless path routing)
app.use('/api', apiRouter);
app.use('/', apiRouter);

// ============================================================
// GLOBAL ERROR HANDLER
// ============================================================
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'File too large. Maximum size is 10MB.' });
  }
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

// 404 for unknown API routes
app.use('*', (req, res) => {
  res.status(404).json({ error: `Route ${req.originalUrl || req.url} not found` });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`\n🚀 Dominova OS Server running on http://localhost:${PORT}`);
    console.log(`📊 API available at http://localhost:${PORT}/api`);
    console.log(`\n💡 Run seed: node db/seed.js`);
  });
}

module.exports = app;
