function notFound(req, res) {
  res.status(404).json({ error: 'Not found.' });
}

function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  console.error(err);
  const status = err.status || 500;
  const message = status === 500 ? 'Something went wrong.' : err.message;
  res.status(status).json({ error: message });
}

module.exports = { notFound, errorHandler };
