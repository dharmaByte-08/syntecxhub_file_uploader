const path = require('path');
const multer = require('multer');

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const ALLOWED_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.pdf',
  '.txt',
  '.csv',
  '.json',
  '.zip',
  '.docx',
]);

const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/json',
  'application/zip',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE, files: 1 },
  fileFilter(req, file, callback) {
    const extension = path.extname(file.originalname || '').toLowerCase();
    const genericType = !file.mimetype || file.mimetype === 'application/octet-stream';
    const allowed = ALLOWED_TYPES.has(file.mimetype) || (genericType && ALLOWED_EXTENSIONS.has(extension));

    if (!allowed) {
      const error = new Error(
        'File type is not allowed. Use an image, PDF, text, CSV, JSON, ZIP, or DOCX file.'
      );
      error.status = 400;
      return callback(error);
    }
    callback(null, true);
  },
});

function handleUpload(req, res, next) {
  upload.single('file')(req, res, (error) => {
    if (!error) {
      return next();
    }

    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File is larger than 10 MB.' });
      }
      return res.status(400).json({ error: error.message });
    }

    return res.status(error.status || 400).json({ error: error.message });
  });
}

module.exports = { handleUpload, MAX_FILE_SIZE, ALLOWED_TYPES, ALLOWED_EXTENSIONS };
