const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = parseInt(process.env.PORT || '8080', 10);

console.log(`[Server] Starting on ${hostname}:${port}`);
console.log(`[Server] NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`[Server] PORT env var: ${process.env.PORT}`);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare()
  .then(() => {
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

    server.listen(port, hostname, () => {
      console.log(`[Server] Ready on http://${hostname}:${port}`);
      console.log(`[Server] Listening for Cloud Run health checks`);
    });

    server.on('error', (err) => {
      console.error('[Server] Error:', err);
      process.exit(1);
    });
  })
  .catch((err) => {
    console.error('[Server] Failed to start:', err);
    process.exit(1);
  });