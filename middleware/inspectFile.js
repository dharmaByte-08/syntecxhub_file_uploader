const path = require('path');

const TEXT_TYPES = {
  '.txt': 'text/plain',
  '.csv': 'text/csv',
  '.json': 'application/json',
};

const SIGNATURES = [
  {
    type: 'image/jpeg',
    extensions: ['.jpg', '.jpeg'],
    test: (buffer) => buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff,
  },
  {
    type: 'image/png',
    extensions: ['.png'],
    test: (buffer) =>
      buffer.length >= 8 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47,
  },
  {
    type: 'image/gif',
    extensions: ['.gif'],
    test: (buffer) => {
      const header = buffer.subarray(0, 6).toString('ascii');
      return header === 'GIF87a' || header === 'GIF89a';
    },
  },
  {
    type: 'image/webp',
    extensions: ['.webp'],
    test: (buffer) =>
      buffer.length >= 12 &&
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP',
  },
  {
    type: 'application/pdf',
    extensions: ['.pdf'],
    test: (buffer) => buffer.subarray(0, 5).toString('ascii') === '%PDF-',
  },
];

function reject(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

function isZip(buffer) {
  return buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b && [0x03, 0x05, 0x07].includes(buffer[2]);
}

function isExecutable(buffer) {
  return buffer.length >= 2 && buffer[0] === 0x4d && buffer[1] === 0x5a;
}

function looksLikeText(buffer) {
  const sample = buffer.subarray(0, Math.min(buffer.length, 8192));
  return !sample.includes(0);
}

function inspectFile(buffer, originalname) {
  if (isExecutable(buffer)) {
    throw reject('This file is not allowed.');
  }

  const extension = path.extname(originalname || '').toLowerCase();
  const signature = SIGNATURES.find((item) => item.test(buffer));

  if (signature) {
    if (!signature.extensions.includes(extension)) {
      throw reject('File content does not match its extension.');
    }
    return signature.type;
  }

  if (isZip(buffer)) {
    if (extension === '.docx') {
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    }
    if (extension === '.zip') {
      return 'application/zip';
    }
    throw reject('File content does not match its extension.');
  }

  const textType = TEXT_TYPES[extension];
  if (!textType || !looksLikeText(buffer)) {
    throw reject('File type is not allowed. Use an image, PDF, text, CSV, JSON, ZIP, or DOCX file.');
  }

  if (extension === '.json') {
    let text = buffer.toString('utf8');
    if (text.charCodeAt(0) === 0xfeff) {
      text = text.slice(1);
    }
    try {
      JSON.parse(text);
    } catch {
      throw reject('The JSON file is not valid.');
    }
  }

  return textType;
}

module.exports = { inspectFile };
