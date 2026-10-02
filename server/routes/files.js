const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const supabase = require('../db/supabase');
const { authenticate } = require('../middleware/auth');

const UPLOADS_DIR = path.join(__dirname, '../../uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const projectDir = path.join(UPLOADS_DIR, `project_${req.params.projectId}`);
    if (!fs.existsSync(projectDir)) fs.mkdirSync(projectDir, { recursive: true });
    cb(null, projectDir);
  },
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.pdf', '.zip', '.doc', '.docx', '.txt'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('File type not allowed'));
  },
});

const router = express.Router();

// POST /api/files/project/:projectId — Upload file to project
router.post('/project/:projectId', authenticate, upload.single('file'), async (req, res) => {
  const { data: project, error: projectError } = await supabase.from('projects').select('*').eq('id', req.params.projectId).eq('is_deleted', 0).maybeSingle();
  if (projectError) return res.status(500).json({ error: 'Database error', message: projectError.message });
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const user = req.user;
  if (user.role === 'sales' && project.salesperson_id !== user.id) return res.status(403).json({ error: 'Access denied' });
  if (user.role === 'developer' && project.developer_id !== user.id) return res.status(403).json({ error: 'Access denied' });

  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const { data: savedFile, error: fileError } = await supabase.from('project_files').insert({
    project_id: project.id, uploaded_by: user.id, file_name: req.file.originalname,
    file_type: req.file.mimetype, file_size: req.file.size,
    file_path: req.file.path.replace(/\\/g, '/'), description: req.body.description || null
  }).select('id').single();
  if (fileError) {
    try { fs.unlinkSync(req.file.path); } catch {}
    return res.status(500).json({ error: 'Failed to save file record', message: fileError.message });
  }

  res.status(201).json({ message: 'File uploaded', fileId: savedFile.id, fileName: req.file.originalname });
});

// GET /api/files/:fileId — Download/view file
router.get('/:fileId', authenticate, async (req, res) => {
  const { data: file, error: fileError } = await supabase.from('project_files').select('*').eq('id', req.params.fileId).eq('is_deleted', 0).maybeSingle();
  if (fileError) return res.status(500).json({ error: 'Database error', message: fileError.message });
  if (!file) return res.status(404).json({ error: 'File not found' });

  // Auth check
  const { data: project, error: projectError } = await supabase.from('projects').select('*').eq('id', file.project_id).maybeSingle();
  if (projectError) return res.status(500).json({ error: 'Database error', message: projectError.message });
  if (!project) return res.status(404).json({ error: 'Project not found' });
  const user = req.user;
  if (user.role === 'sales' && project.salesperson_id !== user.id) return res.status(403).json({ error: 'Access denied' });
  if (user.role === 'developer' && project.developer_id !== user.id) return res.status(403).json({ error: 'Access denied' });

  if (!fs.existsSync(file.file_path)) return res.status(404).json({ error: 'File not found on disk' });
  res.download(file.file_path, file.file_name);
});

module.exports = router;
