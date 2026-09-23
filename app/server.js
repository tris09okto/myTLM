const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

// LiteSpeed sering memberikan path socket (string) ke process.env.PORT
const port = process.env.PORT || 3000;

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  // Tangkap error pada level koneksi
  server.on('error', (err) => {
    console.error('Server Error:', err);
    process.exit(1);
  });

  server.listen(port, (err) => {
    if (err) throw err;
    console.log(`> Ready on port/socket: ${port}`);
  });

  // Mencegah error "Server is not running" saat LiteSpeed mengirim SIGTERM
  const gracefulShutdown = () => {
    if (server && server.listening) {
      server.close(() => {
        process.exit(0);
      });
    } else {
      process.exit(0);
    }
  };

  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGINT', gracefulShutdown);

}).catch((ex) => {
  console.error(ex.stack);
  process.exit(1);
});