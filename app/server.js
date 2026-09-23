const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');

const dev = process.env.NODE_ENV !== 'production';
// WAJIB: Kunci hostname ke localhost agar terdeteksi oleh Hostinger Proxy
const hostname = '127.0.0.1'; 
const port = process.env.PORT || 3000;

// Masukkan hostname dan port ke dalam konfigurasi Next.js
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  // Paksa server listen di 127.0.0.1, BUKAN 0.0.0.0
  server.listen(port, hostname, (err) => {
    if (err) throw err;
    console.log(`> Ready on http://${hostname}:${port}`);
  });

  // Penanganan Graceful Shutdown yang lebih solid
  const exitHandler = () => {
    if (server && server.listening) {
      server.close(() => process.exit(0));
    } else {
      process.exit(0);
    }
  };

  process.on('SIGTERM', exitHandler);
  process.on('SIGINT', exitHandler);

}).catch((ex) => {
  console.error(ex.stack);
  process.exit(1);
});