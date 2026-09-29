require('dotenv').config();

const path = require('path');
const express = require('express');
const { connectDB } = require('./config/db');
const filesRouter = require('./routes/files');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();
const port = Number(process.env.PORT) || 3000;

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
});
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', (req, res) => {
  res.json({ ok: true, storage: 'gridfs' });
});

app.use('/api/files', filesRouter);
app.use('/api', notFound);
app.use(errorHandler);

async function start() {
  const { mode } = await connectDB();

  if (mode === 'env') {
    console.log('Connected to MongoDB using MONGODB_URI.');
  } else if (mode === 'local') {
    console.log('Connected to local MongoDB at mongodb://127.0.0.1:27017/filevault.');
  } else {
    console.log('No MongoDB server found. Using an in-memory database.');
    console.log('Files are removed when this process stops. Set MONGODB_URI to keep them.');
  }

  app.listen(port, () => {
    console.log(`File Vault running at http://localhost:${port}`);
  });
}

start().catch((error) => {
  console.error('Failed to start:', error.message);
  process.exit(1);
});
