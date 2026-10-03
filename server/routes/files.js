const express = require('express');
const multer = require('multer');
const path = require('path');
const supabase = require('../db/supabase');
const { authenticate } = require('../middleware/auth');

const BUCKET_NAME = process.env.SUPABASE_STORAGE_BUCKET || 'project-files';

// Use memoryStorage for Vercel serverless compatibility (no local filesystem writes)
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.pdf', '.zip', '.doc', '.docx', '.txt'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed'));
    }
  },
});

let bucketChecked = false;
async function ensureBucket() {
  if (bucketChecked) return;
  try {
    const { data: buckets, error } = await supabase.storage.listBuckets();
    if (!error && buckets) {
      const exists = buckets.some((b) => b.name === BUCKET_NAME);
      if (!exists) {
        await supabase.storage.createBucket(BUCKET_NAME, {
          public: false,
          fileSizeLimit: 10 * 1024 * 1024,
        });
      }
      bucketChecked = true;
    }
  } catch (err) {
    console.warn('Storage bucket check warning:', err.message);
  }
}

const router = express.Router();

// POST /api/files/project/:projectId — Upload file to project (Stored in Supabase Storage)
router.post('/project/:projectId', authenticate, upload.single('file'), async (req, res) => {
  try {
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', req.params.projectId)
      .eq('is_deleted', 0)
      .maybeSingle();

    if (projectError) return res.status(500).json({ error: 'Database error', message: projectError.message });
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const user = req.user;
    if (user.role === 'sales' && project.salesperson_id !== user.id) return res.status(403).json({ error: 'Access denied' });
    if (user.role === 'developer' && project.developer_id !== user.id) return res.status(403).json({ error: 'Access denied' });

    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    await ensureBucket();

    // Unique storage path in Supabase Storage
    const ext = path.extname(req.file.originalname);
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const storagePath = `project_${project.id}/${unique}${ext}`;

    const { error: storageError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(storagePath, req.file.buffer, {
        contentType: req.file.mimetype || 'application/octet-stream',
        upsert: false,
      });

    if (storageError) {
      console.error('Supabase storage upload error:', storageError);
      return res.status(500).json({ error: 'Failed to upload file to storage', message: storageError.message });
    }

    const { data: savedFile, error: fileError } = await supabase
      .from('project_files')
      .insert({
        project_id: project.id,
        uploaded_by: user.id,
        file_name: req.file.originalname,
        file_type: req.file.mimetype,
        file_size: req.file.size,
        file_path: storagePath,
        description: req.body.description || null,
      })
      .select('id')
      .single();

    if (fileError) {
      // Clean up uploaded file in storage if DB insert fails
      try {
        await supabase.storage.from(BUCKET_NAME).remove([storagePath]);
      } catch (_) {}
      return res.status(500).json({ error: 'Failed to save file record', message: fileError.message });
    }

    res.status(201).json({ message: 'File uploaded', fileId: savedFile.id, fileName: req.file.originalname });
  } catch (err) {
    console.error('File upload error:', err);
    res.status(500).json({ error: 'Server error during file upload', message: err.message });
  }
});

// GET /api/files/:fileId — Download/view file from Supabase Storage
router.get('/:fileId', authenticate, async (req, res) => {
  try {
    const { data: file, error: fileError } = await supabase
      .from('project_files')
      .select('*')
      .eq('id', req.params.fileId)
      .eq('is_deleted', 0)
      .maybeSingle();

    if (fileError) return res.status(500).json({ error: 'Database error', message: fileError.message });
    if (!file) return res.status(404).json({ error: 'File not found' });

    // Auth check
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', file.project_id)
      .maybeSingle();

    if (projectError) return res.status(500).json({ error: 'Database error', message: projectError.message });
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const user = req.user;
    if (user.role === 'sales' && project.salesperson_id !== user.id) return res.status(403).json({ error: 'Access denied' });
    if (user.role === 'developer' && project.developer_id !== user.id) return res.status(403).json({ error: 'Access denied' });

    // Download from Supabase storage
    const { data: blob, error: downloadError } = await supabase.storage
      .from(BUCKET_NAME)
      .download(file.file_path);

    if (downloadError || !blob) {
      console.error('Storage download error:', downloadError);
      return res.status(404).json({ error: 'File not found in storage' });
    }

    const arrayBuffer = await blob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.file_name)}"`);
    res.setHeader('Content-Type', file.file_type || 'application/octet-stream');
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
  } catch (err) {
    console.error('File download error:', err);
    res.status(500).json({ error: 'Server error during file download', message: err.message });
  }
});

module.exports = router;

