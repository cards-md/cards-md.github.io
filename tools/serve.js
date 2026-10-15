// node tools/serve.js: the site on http://localhost:8080, as Pages serves it: a file where there is one, else 404.html (status 404)
const http = require('http'), fs = require('fs'), path = require('path');
const root = process.argv[2] || path.join(__dirname, '..');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
http.createServer((req, res) => {
  const p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  const file = fs.existsSync(p) && fs.statSync(p).isFile() ? p : p.endsWith('/') && fs.existsSync(path.join(p, 'index.html')) ? path.join(p, 'index.html') : null;
  res.writeHead(file ? 200 : 404, { 'content-type': types[path.extname(file || '404.html')] || 'application/octet-stream' });
  res.end(fs.readFileSync(file || path.join(root, '404.html')));
}).listen(8080);
