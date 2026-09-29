const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const { getBucket } = require('../config/db');
const { handleUpload } = require('../middleware/upload');
const { inspectFile } = require('../middleware/inspectFile');

const router = express.Router();

function parseId(id) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return null;
  }
  const objectId = new mongoose.Types.ObjectId(id);
  if (objectId.toString() !== id) {
    return null;
  }
  return objectId;
}

function safeName(name) {
  const base = path.basename(name || 'file').replace(/[^\w.\- ()]/g, '_').slice(0, 180);
  return base || 'file';
}

function contentDisposition(filename, download) {
  const type = download ? 'attachment' : 'inline';
  const ascii = filename.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '_');
  return `${type}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

function canPreview(contentType) {
  return (
    contentType.startsWith('image/') ||
    contentType === 'application/pdf' ||
    contentType.startsWith('text/')
  );
}

function toFileSummary(file) {
  return {
    id: file._id.toString(),
    filename: file.filename,
    contentType: file.contentType || 'application/octet-stream',
    size: file.length,
    uploadDate: file.uploadDate,
  };
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

router.get('/', async (req, res, next) => {
  try {
    const query = String(req.query.q || '').trim().slice(0, 80);
    const filter = query ? { filename: new RegExp(escapeRegex(query), 'i') } : {};
    const files = await mongoose.connection.db
      .collection('uploads.files')
      .find(filter)
      .sort({ uploadDate: -1 })
      .toArray();

    res.json({
      files: files.map(toFileSummary),
      count: files.length,
      totalSize: files.reduce((sum, file) => sum + file.length, 0),
    });
  } catch (error) {
    next(error);
  }
});

router.post('/', handleUpload, async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'Choose a file to upload. Send it as multipart/form-data in the field named "file".',
      });
    }

    if (req.file.size === 0) {
      return res.status(400).json({ error: 'The file is empty.' });
    }

    const filename = safeName(req.file.originalname);
    const contentType = inspectFile(req.file.buffer, filename);
    const bucket = getBucket();

    const stored = await new Promise((resolve, reject) => {
      const stream = bucket.openUploadStream(filename, {
        contentType,
        metadata: { originalName: req.file.originalname },
      });
      stream.on('error', reject);
      stream.on('finish', () => resolve(stream));
      stream.end(req.file.buffer);
    });

    res.status(201).json({
      id: stored.id.toString(),
      filename,
      contentType,
      size: req.file.size,
      uploadDate: stored.uploadDate || new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const objectId = parseId(req.params.id);
    if (!objectId) {
      return res.status(400).json({ error: 'Invalid file id.' });
    }

    const file = await mongoose.connection.db.collection('uploads.files').findOne({ _id: objectId });
    if (!file) {
      return res.status(404).json({ error: 'File not found.' });
    }

    const contentType = file.contentType || 'application/octet-stream';
    const forceDownload = req.query.download === '1';
    const disposition = forceDownload || !canPreview(contentType) ? true : false;

    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', file.length);
    res.setHeader('Content-Disposition', contentDisposition(file.filename, disposition));

    const download = getBucket().openDownloadStream(objectId);
    download.on('error', next);
    download.pipe(res);
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const objectId = parseId(req.params.id);
    if (!objectId) {
      return res.status(400).json({ error: 'Invalid file id.' });
    }

    try {
      await getBucket().delete(objectId);
    } catch (error) {
      if (error.message && error.message.toLowerCase().includes('file not found')) {
        return res.status(404).json({ error: 'File not found.' });
      }
      throw error;
    }

    res.json({ message: 'File deleted.', id: req.params.id });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
