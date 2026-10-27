function notFound(req, res) {
  res.status(404).json({ success: false, message: 'The requested endpoint was not found.' });
}
function errorHandler(err, req, res, next) {
  if (err && err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ success: false, message: 'PDF must be 10 MB or smaller.' });
  if (err && err.message === 'Only PDF files are allowed.') return res.status(400).json({ success: false, message: err.message });
  console.error(err);
  res.status(500).json({ success: false, message: 'Something went wrong on the server.' });
}
module.exports = { notFound, errorHandler };
