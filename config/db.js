const mongoose = require('mongoose');

let memoryServer;

async function connectDB() {
  if (process.env.MONGODB_URI) {
    await mongoose.connect(process.env.MONGODB_URI);
    return { mode: 'env' };
  }

  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/filevault', {
      serverSelectionTimeoutMS: 2000,
    });
    return { mode: 'local' };
  } catch {
    await mongoose.disconnect().catch(() => {});
  }

  const { MongoMemoryServer } = require('mongodb-memory-server');
  memoryServer = await MongoMemoryServer.create();
  await mongoose.connect(memoryServer.getUri());
  return { mode: 'memory' };
}

function getBucket() {
  const db = mongoose.connection.db;
  if (!db) {
    const error = new Error('Database is not connected.');
    error.status = 503;
    throw error;
  }
  return new mongoose.mongo.GridFSBucket(db, { bucketName: 'uploads' });
}

module.exports = { connectDB, getBucket };
